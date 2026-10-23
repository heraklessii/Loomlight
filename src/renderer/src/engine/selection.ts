// Selection masks (decision 006): one byte per sprite pixel (1 = selected).
// Masks are treated as immutable — every change makes a new mask, so history
// can keep references.

import type { PixelImage, Rect } from './image'
import { line } from './raster'

export interface Mask {
  width: number
  height: number
  data: Uint8Array
  /** bounding rectangle of selected pixels (never null for a finished mask) */
  bounds: Rect
}

export type SelectMode = 'replace' | 'add' | 'subtract' | 'intersect'

/** Computes bounds; returns null when nothing is selected. */
export function finishMask(width: number, height: number, data: Uint8Array): Mask | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (data[row + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { width, height, data, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } }
}

export function selectAll(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height).fill(1), bounds: { x: 0, y: 0, w: width, h: height } }
}

/** Rectangle between two corners (inclusive), clipped to the sprite. */
export function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number): Mask | null {
  const data = new Uint8Array(width * height)
  const l = Math.max(0, Math.min(x0, x1))
  const r = Math.min(width - 1, Math.max(x0, x1))
  const t = Math.max(0, Math.min(y0, y1))
  const b = Math.min(height - 1, Math.max(y0, y1))
  for (let y = t; y <= b; y++) data.fill(1, y * width + l, y * width + r + 1)
  return finishMask(width, height, data)
}

/** Lasso: polygon through pixel centres, filled (even-odd) and including its own outline. */
export function polygonMask(width: number, height: number, points: Array<[number, number]>): Mask | null {
  const data = new Uint8Array(width * height)
  const put = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < width && y < height) data[y * width + x] = 1
  }
  const n = points.length
  if (n === 0) return null
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[i]
    const [bx, by] = points[(i + 1) % n]
    line(ax, ay, bx, by, put)
  }
  if (n >= 3) {
    for (let y = 0; y < height; y++) {
      const cy = y + 0.5
      const xs: number[] = []
      for (let i = 0; i < n; i++) {
        const [ax, ay] = points[i]
        const [bx, by] = points[(i + 1) % n]
        const ay2 = ay + 0.5
        const by2 = by + 0.5
        if ((ay2 <= cy && by2 > cy) || (by2 <= cy && ay2 > cy)) {
          xs.push(ax + 0.5 + ((cy - ay2) / (by2 - ay2)) * (bx - ax))
        }
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil(xs[k] - 0.5))
        const to = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5))
        if (to >= from) data.fill(1, y * width + from, y * width + to + 1)
      }
    }
  }
  return finishMask(width, height, data)
}

/** Magic wand: pixels with exactly the colour under (x, y), contiguous (4-connected) or everywhere. */
export function wandMask(img: PixelImage, x: number, y: number, contiguous: boolean): Mask | null {
  const { width: w, height: h, data: px } = img
  if (x < 0 || y < 0 || x >= w || y >= h) return null
  const target = px[y * w + x]
  const data = new Uint8Array(w * h)
  if (!contiguous) {
    for (let i = 0; i < px.length; i++) if (px[i] === target) data[i] = 1
    return finishMask(w, h, data)
  }
  const stack = [y * w + x]
  data[y * w + x] = 1
  while (stack.length) {
    const i = stack.pop()!
    const cx = i % w
    const visit = (j: number): void => {
      if (!data[j] && px[j] === target) {
        data[j] = 1
        stack.push(j)
      }
    }
    if (cx > 0) visit(i - 1)
    if (cx < w - 1) visit(i + 1)
    if (i >= w) visit(i - w)
    if (i < w * (h - 1)) visit(i + w)
  }
  return finishMask(w, h, data)
}

export function combineMasks(base: Mask | null, next: Mask | null, mode: SelectMode): Mask | null {
  if (mode === 'replace') return next
  if (!base) return mode === 'add' ? next : null
  if (!next) return mode === 'intersect' ? null : base
  const out = new Uint8Array(base.data.length)
  const a = base.data
  const b = next.data
  for (let i = 0; i < out.length; i++) {
    out[i] = mode === 'add' ? a[i] | b[i] : mode === 'subtract' ? a[i] & (b[i] ^ 1) : a[i] & b[i]
  }
  return finishMask(base.width, base.height, out)
}

export function invertMask(mask: Mask | null, width: number, height: number): Mask | null {
  if (!mask) return selectAll(width, height)
  const out = new Uint8Array(mask.data.length)
  for (let i = 0; i < out.length; i++) out[i] = mask.data[i] ^ 1
  return finishMask(width, height, out)
}

/**
 * Outline of a w×h shape as merged segments [x1, y1, x2, y2, …] in shape
 * coordinates (pixel corners). Used for marching ants.
 */
export function maskEdges(shape: Uint8Array, w: number, h: number): number[] {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : shape[y * w + x])
  const segs: number[] = []
  for (let y = 0; y <= h; y++) {
    let start = -1
    for (let x = 0; x <= w; x++) {
      const edge = x < w && at(x, y - 1) !== at(x, y)
      if (edge && start < 0) start = x
      if (!edge && start >= 0) {
        segs.push(start, y, x, y)
        start = -1
      }
    }
  }
  for (let x = 0; x <= w; x++) {
    let start = -1
    for (let y = 0; y <= h; y++) {
      const edge = y < h && at(x - 1, y) !== at(x, y)
      if (edge && start < 0) start = y
      if (!edge && start >= 0) {
        segs.push(x, start, x, y)
        start = -1
      }
    }
  }
  return segs
}

/** The part of the mask inside its bounds, as a compact shape. */
export function cropMask(mask: Mask): Uint8Array {
  const { x, y, w, h } = mask.bounds
  const out = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) out.set(mask.data.subarray((y + j) * mask.width + x, (y + j) * mask.width + x + w), j * w)
  return out
}

/** Places a compact shape at (x, y) in a new sprite-size mask (clipped). */
export function shapeToMask(shape: Uint8Array, w: number, h: number, x: number, y: number, width: number, height: number): Mask | null {
  const data = new Uint8Array(width * height)
  for (let j = 0; j < h; j++) {
    const ty = y + j
    if (ty < 0 || ty >= height) continue
    for (let i = 0; i < w; i++) {
      const tx = x + i
      if (tx >= 0 && tx < width && shape[j * w + i]) data[ty * width + tx] = 1
    }
  }
  return finishMask(width, height, data)
}
