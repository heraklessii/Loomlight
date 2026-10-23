// PixelImage: a width × height grid of packed colours (decision 004).

import type { Packed } from './color'

export interface PixelImage {
  width: number
  height: number
  data: Uint32Array
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function createImage(width: number, height: number, fill: Packed = 0): PixelImage {
  const data = new Uint32Array(width * height)
  if (fill !== 0) data.fill(fill)
  return { width, height, data }
}

export function cloneImage(img: PixelImage): PixelImage {
  return { width: img.width, height: img.height, data: img.data.slice() }
}

export function inBounds(img: PixelImage, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < img.width && y < img.height
}

export function getPixel(img: PixelImage, x: number, y: number): Packed {
  return inBounds(img, x, y) ? img.data[y * img.width + x] : 0
}

export function setPixel(img: PixelImage, x: number, y: number, c: Packed): void {
  if (inBounds(img, x, y)) img.data[y * img.width + x] = c
}

export function isEmpty(img: PixelImage): boolean {
  const d = img.data
  for (let i = 0; i < d.length; i++) if (d[i] !== 0) return false
  return true
}

/** Copies a rectangle out of an image. */
export function copyRegion(img: PixelImage, r: Rect): Uint32Array {
  const out = new Uint32Array(r.w * r.h)
  for (let y = 0; y < r.h; y++) {
    const start = (r.y + y) * img.width + r.x
    out.set(img.data.subarray(start, start + r.w), y * r.w)
  }
  return out
}

/** Writes a rectangle (as produced by copyRegion) back into an image. */
export function pasteRegion(img: PixelImage, r: Rect, pixels: Uint32Array): void {
  for (let y = 0; y < r.h; y++) {
    img.data.set(pixels.subarray(y * r.w, (y + 1) * r.w), (r.y + y) * img.width + r.x)
  }
}

/** Bounding rectangle of pixels that differ between two same-size images, or null. */
export function diffBounds(a: PixelImage, b: PixelImage): Rect | null {
  const w = a.width
  const h = a.height
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (a.data[row + x] !== b.data[row + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** Bounding rectangle of non-transparent pixels, or null when empty. */
export function contentBounds(img: PixelImage): Rect | null {
  return diffBounds(img, createImage(img.width, img.height))
}

/** Shifts all pixels by (dx, dy); pixels moved outside are dropped. */
export function shiftImage(src: PixelImage, dx: number, dy: number, out: PixelImage): void {
  out.data.fill(0)
  const { width: w, height: h } = src
  for (let y = 0; y < h; y++) {
    const ty = y + dy
    if (ty < 0 || ty >= h) continue
    for (let x = 0; x < w; x++) {
      const tx = x + dx
      if (tx < 0 || tx >= w) continue
      out.data[ty * w + tx] = src.data[y * w + x]
    }
  }
}
