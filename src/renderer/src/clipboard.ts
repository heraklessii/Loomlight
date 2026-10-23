// Clipboard (decision 006). Copies go to an internal clip (exact pixels,
// remembers the position) and to the system clipboard as PNG, so pixels can
// be pasted into other apps and images from other apps can be pasted here.
// A text token next to the PNG tells us the system clipboard still holds our
// own copy, in which case the exact internal clip is used.

import { encodePng } from '@engine/png'

export interface Clip {
  pixels: Uint32Array
  w: number
  h: number
  /** where it was copied from (null for images from other apps) */
  x: number | null
  y: number | null
}

let internal: Clip | null = null
let token = ''
let systemHoldsOurs = false

export function hasClip(): boolean {
  return internal !== null
}

export async function writeClip(clip: Clip): Promise<void> {
  internal = clip
  token = `loomlight-clip:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  systemHoldsOurs = false
  try {
    const png = await encodePng(clip.pixels, clip.w, clip.h)
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': new Blob([png as BlobPart], { type: 'image/png' }),
        'text/plain': new Blob([token], { type: 'text/plain' })
      })
    ])
    systemHoldsOurs = true
  } catch {
    // no system clipboard access (browser permission): the internal clip still works
  }
}

/** Reads what to paste from a paste event (no permission needed). */
export async function clipFromPasteEvent(e: ClipboardEvent): Promise<Clip | null> {
  const data = e.clipboardData
  if (!data) return internal
  if (internal && data.getData('text/plain') === token) return internal
  const file = [...data.files].find((f) => f.type.startsWith('image/'))
  if (file) return decodeToClip(file)
  return systemHoldsOurs ? null : internal
}

/** Reads the system clipboard on request (menu / palette); falls back to the internal clip. */
export async function clipFromSystem(): Promise<Clip | null> {
  try {
    // a permission prompt may never be answered: fall back to the internal clip
    const items = await Promise.race([
      navigator.clipboard.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('clipboard timeout')), 1500))
    ])
    for (const item of items) {
      if (internal && item.types.includes('text/plain')) {
        const text = await (await item.getType('text/plain')).text()
        if (text === token) return internal
      }
      const type = item.types.find((ty) => ty.startsWith('image/'))
      if (type) return decodeToClip(await item.getType(type))
    }
    return systemHoldsOurs ? null : internal
  } catch {
    return internal
  }
}

async function decodeToClip(blob: Blob): Promise<Clip | null> {
  const img = await decodeImage(blob)
  return img ? { pixels: img.data, w: img.width, h: img.height, x: null, y: null } : null
}

/** Decodes a PNG/any browser image into straight-alpha packed pixels. */
export async function decodeImage(blob: Blob): Promise<{ width: number; height: number; data: Uint32Array } | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  } catch {
    return null
  }
  const { width, height } = bitmap
  const ctx = new OffscreenCanvas(width, height).getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return { width, height, data: new Uint32Array(ctx.getImageData(0, 0, width, height).data.buffer.slice(0)) }
}
