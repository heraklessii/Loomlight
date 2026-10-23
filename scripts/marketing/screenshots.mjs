// Captures the itch.io screenshots from the real, built app (npm run build
// first). Runs Electron with a throw-away profile and an off-screen window
// (LOOMLIGHT_CAPTURE / LOOMLIGHT_USER_DATA, see src/main/index.ts), opens the
// demo sprite through the real drag-and-drop path, sets up each scene through
// the interface and saves 1280×800 PNGs to marketing/itch/out/screens/.
//
//   npm run marketing:screens

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'marketing/itch/out/screens')
const DEMO = join(ROOT, 'marketing/itch/demo/lantern.loom')
const PORT = 9339
const W = 1280
const H = 800

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'loomlight-capture-'))

const electron = join(ROOT, 'node_modules/electron/dist/electron.exe')
const child = spawn(electron, ['.', `--remote-debugging-port=${PORT}`], {
  cwd: ROOT,
  env: { ...process.env, LOOMLIGHT_CAPTURE: '1', LOOMLIGHT_USER_DATA: profile },
  stdio: 'ignore'
})

let ws
try {
  // --- connect
  let target
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500)
    try {
      target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')
    } catch {
      // not up yet
    }
  }
  if (!target) throw new Error('the app did not start')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id)
      pending.delete(d.id)
      if (d.error) reject(new Error(d.error.message))
      else resolve(d.result)
    }
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'page error')
    return r.result.value
  }
  const size = () => send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  const shot = async (name) => {
    await sleep(500)
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
    writeFileSync(join(OUT, name), Buffer.from(r.data, 'base64'))
    console.log('wrote', name)
  }

  // --- page helpers (run inside the app)
  await ev(`
    window.__cap = {
      byText(sel, text) { return [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text) },
      click(sel, text) { const e = text ? this.byText(sel, text) : document.querySelector(sel); if (!e) throw new Error('not found: ' + sel + ' ' + (text || '')); e.click() },
      async menu(menu, item) { this.click('.menu-button', menu); await new Promise((r) => setTimeout(r, 150)); this.click('.menu-item .label', item) },
      key(key, mods = {}) { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })) }
    }; true`)

  // first launch in a fresh profile: skip the tour, dark theme
  await ev(`localStorage.setItem('loomlight.settings', JSON.stringify({ theme: 'dark', shortcuts: {}, tourSeen: true })); location.reload(); true`)
  await sleep(1500)
  await size()
  await ev(`
    window.__cap = {
      byText(sel, text) { return [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text) },
      click(sel, text) { const e = text ? this.byText(sel, text) : document.querySelector(sel); if (!e) throw new Error('not found: ' + sel + ' ' + (text || '')); e.click() },
      async menu(menu, item) { this.click('.menu-button', menu); await new Promise((r) => setTimeout(r, 150)); this.click('.menu-item .label', item) },
      key(key, mods = {}) { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })) }
    }; true`)

  // --- open the demo through the real drop handler
  const b64 = readFileSync(DEMO).toString('base64')
  await ev(`(async () => {
    const bin = atob('${b64}'); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'lantern.loom'))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 800))
    return document.querySelector('.doc-title .name')?.textContent
  })()`)

  // 1 — the editor: lantern layer, frame 2, onion skin
  await ev(`__cap.click('.tl-layer .lname', 'Lantern'); __cap.click('[data-frame-head="1"]'); __cap.click('.toggle-chip', 'Onion skin'); true`)
  await shot('01-editor.png')

  // 2 — export dialog (GIF)
  await ev(`__cap.click('[data-tour="export"]'); true`)
  await shot('02-export.png')
  await ev(`__cap.key('Escape'); __cap.click('.toggle-chip', 'Onion skin'); true`)

  // 3 — indexed colour + shading ink
  await ev(`__cap.menu('Sprite', 'Colour mode: Indexed').then(() => true)`)
  await sleep(300)
  await ev(`__cap.key('b'); __cap.click('.seg button', 'Shading'); document.querySelectorAll('.pal-swatch')[9].dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true })); true`)
  await shot('03-indexed-shading.png')
  await sleep(2800) // let the mode toast fade before the next scenes

  // 4 — tiled mode, zoomed out to show the neighbours
  await ev(`__cap.menu('View', 'Tiled mode: both axes').then(() => { __cap.key('-'); __cap.key('-'); return true })`)
  await shot('04-tiled.png')
  await ev(`__cap.menu('View', 'Tiled mode: off').then(() => { __cap.key('0', { ctrlKey: true }); return true })`)

  // 5 — light theme, selection tool with marching ants around the lantern
  await ev(`__cap.key(',', { ctrlKey: true }); true`)
  await sleep(200)
  await ev(`__cap.click('.seg button', 'Light'); __cap.key('Escape'); __cap.key('w'); true`)
  await shot('05-light.png')
} finally {
  try {
    ws?.close()
  } catch {
    // closed
  }
  child.kill()
  await sleep(800)
  rmSync(profile, { recursive: true, force: true })
}
