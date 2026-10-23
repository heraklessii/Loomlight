// File IO: through the Electron bridge when present, otherwise browser
// upload/download (npm run dev:web).

import type { CloseStrings, FileFilter, LoomlightApi, RecentFile, RecoveryData, RecoveryMeta } from '@shared/ipc'

const api = (window as unknown as { loomlight?: LoomlightApi }).loomlight

export const isElectron = !!api

export interface PickedFile {
  name: string
  path: string | null
  bytes: Uint8Array
}

export async function pickFile(filters: FileFilter[]): Promise<PickedFile | null> {
  if (api) return api.openFile(filters)
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = filters.flatMap((f) => f.extensions.map((e) => '.' + e)).join(',')
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve({ name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** Save dialog (Electron) or a download (browser). Returns the saved path, '' for a download, null when cancelled. */
export async function saveFileAs(defaultName: string, filters: FileFilter[], bytes: Uint8Array): Promise<string | null> {
  if (api) return api.saveFile(defaultName, filters, bytes)
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]))
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return ''
}

export async function writeFile(path: string, bytes: Uint8Array): Promise<void> {
  if (!api) throw new Error('No file system in the browser')
  await api.writeFile(path, bytes)
}

export function reportDirty(dirty: boolean, strings: CloseStrings): void {
  api?.setDirty(dirty, strings)
}

export function setWindowTitle(title: string): void {
  if (api) api.setTitle(title)
  else document.title = title
}

export function onSaveBeforeClose(handler: () => void): void {
  api?.onSaveBeforeClose(handler)
}

export function closeWindow(): void {
  api?.closeNow()
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

// --- crash recovery (decision 007): Electron keeps it in userData, the browser in IndexedDB

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('loomlight', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('recovery')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbDo<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction('recovery', mode).objectStore('recovery'))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

export async function writeRecovery(bytes: Uint8Array, meta: RecoveryMeta): Promise<void> {
  if (api) return api.writeRecovery(bytes, meta)
  await idbDo('readwrite', (st) => st.put({ meta, bytes }, 'current'))
}

export async function readRecovery(): Promise<RecoveryData | null> {
  try {
    if (api) return await api.readRecovery()
    return (await idbDo<RecoveryData | undefined>('readonly', (st) => st.get('current'))) ?? null
  } catch {
    return null
  }
}

export async function clearRecovery(): Promise<void> {
  try {
    if (api) await api.clearRecovery()
    else await idbDo('readwrite', (st) => st.delete('current'))
  } catch {
    // nothing to clear
  }
}

// --- recent files (decision 009): Electron only — a browser has no file paths

export async function listRecent(): Promise<RecentFile[]> {
  try {
    return api ? await api.listRecent() : []
  } catch {
    return []
  }
}

export async function openRecent(path: string): Promise<PickedFile | null> {
  return api ? api.openRecent(path) : null
}

export async function clearRecent(): Promise<void> {
  await api?.clearRecent()
}

export function setNativeTheme(theme: 'dark' | 'light'): void {
  api?.setTheme(theme)
}
