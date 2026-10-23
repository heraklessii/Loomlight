import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { IPC, type CloseStrings, type FileFilter, type RecentFile, type RecoveryMeta } from '@shared/ipc'

let win: BrowserWindow | null = null

// Marketing captures (scripts/marketing/screenshots.mjs): a throw-away profile so the
// user's settings, recent files and recovery copy are never touched, and an
// off-screen window so nothing pops up on the desktop.
const CAPTURE = process.env['LOOMLIGHT_CAPTURE'] === '1'
if (process.env['LOOMLIGHT_USER_DATA']) app.setPath('userData', process.env['LOOMLIGHT_USER_DATA'])
let dirty = false
let closeStrings: CloseStrings | null = null
let forceClose = false

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0e0e0e',
    title: 'Loomlight',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0e0e0e', symbolColor: '#b8b8b8', height: 40 },
    ...(CAPTURE ? { x: -8000, y: 0, skipTaskbar: true } : {}),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => win?.show())

  win.on('close', (e) => {
    if (forceClose || !dirty || !win) return
    e.preventDefault()
    const s = closeStrings ?? { title: 'Loomlight', message: 'Save changes before closing?', save: 'Save', discard: "Don't save", cancel: 'Cancel' }
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      title: s.title,
      message: s.message,
      buttons: [s.save, s.discard, s.cancel],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    if (choice === 0) win.webContents.send(IPC.confirmClose)
    else if (choice === 1) {
      // "Don't save" is a decision: the recovery copy goes too
      void clearRecovery().finally(() => {
        forceClose = true
        win?.close()
      })
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}

function toElectronFilters(filters: FileFilter[]): Electron.FileFilter[] {
  return filters.map((f) => ({ name: f.name, extensions: f.extensions }))
}

ipcMain.handle(IPC.openFile, async (_e, filters: FileFilter[]) => {
  if (!win) return null
  const res = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: toElectronFilters(filters) })
  if (res.canceled || res.filePaths.length === 0) return null
  const path = res.filePaths[0]
  const bytes = new Uint8Array(await readFile(path))
  if (/\.loom$/i.test(path)) await addRecent(path)
  return { path, name: basename(path), bytes }
})

ipcMain.handle(IPC.saveFile, async (_e, defaultName: string, filters: FileFilter[], bytes: Uint8Array) => {
  if (!win) return null
  const res = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters: toElectronFilters(filters) })
  if (res.canceled || !res.filePath) return null
  await writeFile(res.filePath, bytes)
  if (/\.loom$/i.test(res.filePath)) await addRecent(res.filePath)
  return res.filePath
})

ipcMain.handle(IPC.writeFile, async (_e, path: string, bytes: Uint8Array) => {
  await writeFile(path, bytes)
  if (/\.loom$/i.test(path)) await addRecent(path)
})

// --- recent files (decision 009): the list is owned here, so the renderer can
// only reopen paths the user picked in a dialog before
const RECENT_MAX = 10
const recentPath = (): string => join(app.getPath('userData'), 'recent.json')

async function readRecent(): Promise<RecentFile[]> {
  try {
    const list = JSON.parse(await readFile(recentPath(), 'utf8')) as RecentFile[]
    return Array.isArray(list) ? list.filter((r) => typeof r?.path === 'string') : []
  } catch {
    return []
  }
}

async function saveRecent(list: RecentFile[]): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(recentPath(), JSON.stringify(list.slice(0, RECENT_MAX)))
}

async function addRecent(path: string): Promise<void> {
  const list = (await readRecent()).filter((r) => r.path.toLowerCase() !== path.toLowerCase())
  await saveRecent([{ path, name: basename(path) }, ...list])
}

ipcMain.handle(IPC.recentList, async () => {
  const list = await readRecent()
  const alive: RecentFile[] = []
  for (const r of list) {
    try {
      await access(r.path)
      alive.push(r)
    } catch {
      // moved or deleted: drop it
    }
  }
  if (alive.length !== list.length) await saveRecent(alive)
  return alive
})

ipcMain.handle(IPC.recentOpen, async (_e, path: string) => {
  const list = await readRecent()
  if (!list.some((r) => r.path === path)) return null
  try {
    const bytes = new Uint8Array(await readFile(path))
    await addRecent(path)
    return { path, name: basename(path), bytes }
  } catch {
    await saveRecent(list.filter((r) => r.path !== path))
    return null
  }
})

ipcMain.handle(IPC.recentClear, () => saveRecent([]))

// --- crash recovery (decision 007): one slot, written atomically
const recoveryDir = (): string => join(app.getPath('userData'), 'recovery')
const recoveryFile = (): string => join(recoveryDir(), 'current.loom')
const recoveryMeta = (): string => join(recoveryDir(), 'current.json')

async function clearRecovery(): Promise<void> {
  await rm(recoveryFile(), { force: true })
  await rm(recoveryMeta(), { force: true })
}

ipcMain.handle(IPC.recoveryWrite, async (_e, bytes: Uint8Array, meta: RecoveryMeta) => {
  await mkdir(recoveryDir(), { recursive: true })
  await writeFile(recoveryFile() + '.tmp', bytes)
  await rename(recoveryFile() + '.tmp', recoveryFile())
  await writeFile(recoveryMeta() + '.tmp', JSON.stringify(meta))
  await rename(recoveryMeta() + '.tmp', recoveryMeta())
})

ipcMain.handle(IPC.recoveryRead, async () => {
  try {
    const meta = JSON.parse(await readFile(recoveryMeta(), 'utf8')) as RecoveryMeta
    const bytes = new Uint8Array(await readFile(recoveryFile()))
    return { meta, bytes }
  } catch {
    return null
  }
})

ipcMain.handle(IPC.recoveryClear, () => clearRecovery())

ipcMain.on(IPC.setDirty, (_e, value: boolean, strings: CloseStrings) => {
  dirty = value
  closeStrings = strings
})

ipcMain.on(IPC.setTitle, (_e, title: string) => win?.setTitle(title))

const THEME_CHROME = {
  dark: { color: '#0e0e0e', symbolColor: '#b8b8b8' },
  light: { color: '#ebebeb', symbolColor: '#3a3a3a' }
}

ipcMain.on(IPC.setTheme, (_e, theme: 'dark' | 'light') => {
  const chrome = THEME_CHROME[theme === 'light' ? 'light' : 'dark']
  win?.setBackgroundColor(chrome.color)
  try {
    win?.setTitleBarOverlay({ ...chrome, height: 40 })
  } catch {
    // overlay not available on this platform
  }
})

ipcMain.on(IPC.closeNow, () => {
  forceClose = true
  win?.close()
})

app.whenReady().then(() => {
  // Offline guard (rule 9): the app never talks to the network on its own.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, cb) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    cb({ cancel: !(devUrl && details.url.startsWith(devUrl)) })
  })
  createWindow()
})

app.on('window-all-closed', () => app.quit())
