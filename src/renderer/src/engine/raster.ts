// The only raster code in Loomlight (rule 2): preview and commit both call
// these functions. Everything here is integer and pixel-exact (rule 1).

import type { Packed } from './color'
import type { PixelImage } from './image'

export type Plot = (x: number, y: number) => void

/** Bresenham line, both ends inclusive. */
export function line(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    plot(x, y)
    if (x === x1 && y === y1) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Rectangle between two corners (inclusive), outline or filled. */
export function rect(x0: number, y0: number, x1: number, y1: number, filled: boolean, plot: Plot): void {
  const left = Math.min(x0, x1)
  const right = Math.max(x0, x1)
  const top = Math.min(y0, y1)
  const bottom = Math.max(y0, y1)
  if (filled || right - left < 2 || bottom - top < 2) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) plot(x, y)
    return
  }
  for (let x = left; x <= right; x++) {
    plot(x, top)
    plot(x, bottom)
  }
  for (let y = top + 1; y < bottom; y++) {
    plot(left, y)
    plot(right, y)
  }
}

/**
 * Ellipse inscribed in the rectangle between two corners (inclusive), after
 * A. Zingl's "plotEllipseRect" — handles even widths/heights exactly.
 */
export function ellipse(ax: number, ay: number, bx: number, by: number, filled: boolean, plot: Plot): void {
  let x0 = Math.min(ax, bx)
  let x1 = Math.max(ax, bx)
  let y0 = Math.min(ay, by)
  let y1 = Math.max(ay, by)
  if (x1 - x0 < 2 || y1 - y0 < 2) {
    rect(x0, y0, x1, y1, true, plot)
    return
  }

  const top = y0
  const rows = new Map<number, [number, number]>()
  const put = (x: number, y: number): void => {
    const span = rows.get(y)
    if (!span) rows.set(y, [x, x])
    else {
      if (x < span[0]) span[0] = x
      if (x > span[1]) span[1] = x
    }
    if (!filled) plot(x, y)
  }

  let a = x1 - x0
  const b = y1 - y0
  let b1 = b & 1
  let dx = 4 * (1 - a) * b * b
  let dy = 4 * (b1 + 1) * a * a
  let err = dx + dy + b1 * a * a
  y0 += (b + 1) >> 1
  y1 = y0 - b1
  a = 8 * a * a
  b1 = 8 * b * b
  do {
    put(x1, y0)
    put(x0, y0)
    put(x0, y1)
    put(x1, y1)
    const e2 = 2 * err
    if (e2 <= dy) {
      y0++
      y1--
      dy += a
      err += dy
    }
    if (e2 >= dx || 2 * err > dy) {
      x0++
      x1--
      dx += b1
      err += dx
    }
  } while (x0 <= x1)
  while (y0 - y1 <= b) {
    put(x0 - 1, y0)
    put(x1 + 1, y0++)
    put(x0 - 1, y1)
    put(x1 + 1, y1--)
  }

  if (filled) {
    for (let y = top; y <= top + b; y++) {
      const span = rows.get(y)
      if (!span) continue
      for (let x = span[0]; x <= span[1]; x++) plot(x, y)
    }
  }
}

export type BrushShape = 'square' | 'round'

/** Pixel offsets of a brush footprint relative to the cursor pixel. */
export function brushOffsets(size: number, shape: BrushShape): Array<[number, number]> {
  const n = Math.max(1, Math.round(size))
  const start = -Math.floor(n / 2)
  const out: Array<[number, number]> = []
  const c = (n - 1) / 2
  const r = n / 2 - 0.25
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (shape === 'round' && n > 2) {
        const dx = i - c
        const dy = j - c
        if (dx * dx + dy * dy > r * r) continue
      }
      out.push([start + i, start + j])
    }
  }
  return out
}

export type Mirror = 'none' | 'horizontal' | 'vertical' | 'both'

/** Wraps a plot so every pixel is also drawn mirrored across the sprite centre. */
export function mirrored(plot: Plot, mode: Mirror, width: number, height: number): Plot {
  if (mode === 'none') return plot
  return (x, y) => {
    plot(x, y)
    const mx = width - 1 - x
    const my = height - 1 - y
    if (mode === 'horizontal' || mode === 'both') plot(mx, y)
    if (mode === 'vertical' || mode === 'both') plot(x, my)
    if (mode === 'both') plot(mx, my)
  }
}

/** Plot that writes one colour into an image, ignoring out-of-bounds pixels. */
export function writer(img: PixelImage, color: Packed): Plot {
  const { width: w, height: h, data } = img
  return (x, y) => {
    if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = color
  }
}

/** Expands a plot to stamp a brush footprint at each point. */
export function stamped(plot: Plot, offsets: Array<[number, number]>): Plot {
  if (offsets.length === 1 && offsets[0][0] === 0 && offsets[0][1] === 0) return plot
  return (x, y) => {
    for (const [dx, dy] of offsets) plot(x + dx, y + dy)
  }
}

/**
 * Flood fill from (x, y) with an exact colour match. `contiguous` = 4-connected
 * region; otherwise every pixel of that colour. Returns false when nothing changed.
 */
export function floodFill(img: PixelImage, x: number, y: number, color: Packed, contiguous: boolean): boolean {
  const { width: w, height: h, data } = img
  if (x < 0 || y < 0 || x >= w || y >= h) return false
  const target = data[y * w + x]
  if (target === color) return false
  if (!contiguous) {
    for (let i = 0; i < data.length; i++) if (data[i] === target) data[i] = color
    return true
  }
  // scanline fill
  const stack: number[] = [x, y]
  while (stack.length) {
    const sy = stack.pop()!
    let sx = stack.pop()!
    const row = sy * w
    while (sx > 0 && data[row + sx - 1] === target) sx--
    let spanUp = false
    let spanDown = false
    for (let cx = sx; cx < w && data[row + cx] === target; cx++) {
      data[row + cx] = color
      if (sy > 0) {
        const up = data[row - w + cx] === target
        if (up && !spanUp) {
          stack.push(cx, sy - 1)
          spanUp = true
        } else if (!up) spanUp = false
      }
      if (sy < h - 1) {
        const down = data[row + w + cx] === target
        if (down && !spanDown) {
          stack.push(cx, sy + 1)
          spanDown = true
        } else if (!down) spanDown = false
      }
    }
  }
  return true
}
