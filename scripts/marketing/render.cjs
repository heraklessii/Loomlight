// Renders the itch.io page images from the HTML compositions in
// marketing/itch/ with Electron's Chromium, so fonts and pixel art look
// exactly as designed. Size and device scale are fixed through the DevTools
// protocol, so the Windows display scale (125 %, 150 %) never leaks in.
//
//   npm run marketing:render   (or: npx electron scripts/marketing/render.cjs cover|banner|background-tile)

const { app, BrowserWindow, dialog } = require('electron')
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

const DIR = join(__dirname, '../../marketing/itch')
const OUT = join(DIR, 'out')

const JOBS = [
  { html: 'cover.html', name: 'cover', w: 630, h: 500, scales: [1] },
  { html: 'banner.html', name: 'banner', w: 960, h: 300, scales: [1] },
  { html: 'background.html', name: 'background-tile', w: 96, h: 96, scales: [1] },
  // the user's HERA creator profile (not Loomlight): marketing/hera-profile/
  { dir: '../hera-profile', html: 'header.html', name: 'hera-header', w: 1920, h: 480, scales: [1] },
  { dir: '../hera-profile', html: 'preview.html', name: 'hera-preview', w: 2000, h: 1100, scales: [1] }
]

// a build script never shows dialogs: errors go to the console and the exit code
dialog.showErrorBox = (title, content) => console.error(`${title}\n${content}`)
process.on('uncaughtException', (err) => {
  console.error(err)
  app.exit(1)
})

// windows are created one after another: closing one must not quit the app
app.on('window-all-closed', () => {})

async function render(job, scale) {
  // shown but placed off-screen: hidden windows do not always paint
  const win = new BrowserWindow({ show: true, x: -6000, y: 0, width: job.w, height: job.h, frame: false, skipTaskbar: true, focusable: false })
  try {
    await win.loadFile(join(DIR, job.dir ?? '.', job.html))
    // Chromium remembers zoom per origin: always render at 100 %
    win.webContents.setZoomFactor(1)
    const cdp = win.webContents.debugger
    cdp.attach('1.3')
    await cdp.sendCommand('Emulation.setDeviceMetricsOverride', { width: job.w, height: job.h, deviceScaleFactor: scale, mobile: false })
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))')
    const shot = await cdp.sendCommand('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: job.w, height: job.h, scale: 1 }
    })
    const file = `${job.name}-${job.w * scale}x${job.h * scale}.png`
    writeFileSync(join(job.dir ? join(DIR, job.dir, 'out') : OUT, file), Buffer.from(shot.data, 'base64'))
    console.log(`wrote ${file}`)
    cdp.detach()
  } finally {
    win.destroy()
  }
}

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true })
  try {
    // one image per run: a second hidden window sometimes never paints
    const only = process.argv.find((a) => JOBS.some((j) => j.name === a))
    for (const job of JOBS.filter((j) => !only || j.name === only)) for (const scale of job.scales) await render(job, scale)
    app.exit(0)
  } catch (err) {
    console.error('render failed:', err)
    app.exit(1)
  }
})
