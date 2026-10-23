// Floating pixels (lifted selection / paste) and sprite-wide transforms:
// canvas resize, nearest-neighbour scale, crop (decision 006).

import type { PixelImage, Rect } from './image'
import type { Mask } from './selection'
import { cropMask } from './selection'
import type { Sprite } from './sprite'

/** A block of pixels hovering over a cel until it is committed. */
export interface Floating {
  w: number
  h: number
  /** packed colours, w × h (0 outside the shape) */
  pixels: Uint32Array
  /** 1 = part of the floating shape */
  shape: Uint8Array
  /** top-left in sprite pixels (may be outside the sprite) */
  x: number
  y: number
}

/** Copies the selected pixels of a cel into a floating block (the cel is not changed). */
export function extract(cel: PixelImage, mask: Mask): Floating {
  const { x, y, w, h } = mask.bounds
  const shape = cropMask(mask)
  const pixels = new Uint32Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (shape[j * w + i]) pixels[j * w + i] = cel.data[(y + j) * cel.width + x + i]
    }
  }
  return { w, h, pixels, shape, x, y }
}

/** Makes selected pixels transparent. */
export function clearMasked(cel: PixelImage, mask: Mask): void {
  const { x, y, w, h } = mask.bounds
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      const k = j * cel.width + i
      if (mask.data[k]) cel.data[k] = 0
    }
  }
}

/** Writes the floating block onto a cel; transparent floating pixels keep what is below. */
export function stamp(cel: PixelImage, f: Floating): void {
  for (let j = 0; j < f.h; j++) {
    const ty = f.y + j
    if (ty < 0 || ty >= cel.height) continue
    for (let i = 0; i < f.w; i++) {
      const tx = f.x + i
      if (tx < 0 || tx >= cel.width) continue
      const p = f.pixels[j * f.w + i]
      if (p >>> 24 !== 0) cel.data[ty * cel.width + tx] = p
    }
  }
}

export type Axis = 'horizontal' | 'vertical'

export function flipFloating(f: Floating, axis: Axis): Floating {
  const pixels = new Uint32Array(f.pixels.length)
  const shape = new Uint8Array(f.shape.length)
  for (let j = 0; j < f.h; j++) {
    for (let i = 0; i < f.w; i++) {
      const si = axis === 'horizontal' ? f.w - 1 - i : i
      const sj = axis === 'vertical' ? f.h - 1 - j : j
      pixels[j * f.w + i] = f.pixels[sj * f.w + si]
      shape[j * f.w + i] = f.shape[sj * f.w + si]
    }
  }
  return { ...f, pixels, shape }
}

/** A floating block from plain pixels (paste): every pixel is part of the shape. */
export function floatingFromPixels(pixels: Uint32Array, w: number, h: number, x: number, y: number): Floating {
  return { w, h, pixels: pixels.slice(), shape: new Uint8Array(w * h).fill(1), x, y }
}

export type Anchor = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se'

/** Offset of the old content inside the new canvas for an anchor. */
export function anchorOffset(anchor: Anchor, oldW: number, oldH: number, newW: number, newH: number): { dx: number; dy: number } {
  const col = anchor.endsWith('w') ? 0 : anchor.endsWith('e') ? 2 : 1
  const row = anchor.startsWith('n') ? 0 : anchor.startsWith('s') ? 2 : 1
  return {
    dx: col === 0 ? 0 : col === 2 ? newW - oldW : Math.floor((newW - oldW) / 2),
    dy: row === 0 ? 0 : row === 2 ? newH - oldH : Math.floor((newH - oldH) / 2)
  }
}

/** Resizes the canvas: every cel is copied into a new buffer at (dx, dy). Mutates the sprite (new cel buffers). */
export function resizeCanvas(sprite: Sprite, newW: number, newH: number, dx: number, dy: number): void {
  const cels = new Map<string, PixelImage>()
  for (const [key, cel] of sprite.cels) {
    const data = new Uint32Array(newW * newH)
    for (let y = 0; y < cel.height; y++) {
      const ty = y + dy
      if (ty < 0 || ty >= newH) continue
      const x0 = Math.max(0, -dx)
      const x1 = Math.min(cel.width, newW - dx)
      if (x1 <= x0) continue
      data.set(cel.data.subarray(y * cel.width + x0, y * cel.width + x1), ty * newW + x0 + dx)
    }
    cels.set(key, { width: newW, height: newH, data })
  }
  sprite.cels = cels
  sprite.width = newW
  sprite.height = newH
}

export function cropSprite(sprite: Sprite, r: Rect): void {
  resizeCanvas(sprite, r.w, r.h, -r.x, -r.y)
}

/** Nearest-neighbour scale of every cel to newW × newH. */
export function scaleSprite(sprite: Sprite, newW: number, newH: number): void {
  const cels = new Map<string, PixelImage>()
  const xs = new Int32Array(newW)
  for (let x = 0; x < newW; x++) xs[x] = Math.min(sprite.width - 1, Math.floor(((x + 0.5) * sprite.width) / newW))
  for (const [key, cel] of sprite.cels) {
    const data = new Uint32Array(newW * newH)
    for (let y = 0; y < newH; y++) {
      const sy = Math.min(sprite.height - 1, Math.floor(((y + 0.5) * sprite.height) / newH))
      const row = sy * cel.width
      for (let x = 0; x < newW; x++) data[y * newW + x] = cel.data[row + xs[x]]
    }
    cels.set(key, { width: newW, height: newH, data })
  }
  sprite.cels = cels
  sprite.width = newW
  sprite.height = newH
}

export type Turn = 'cw' | 'ccw' | '180'

/** Rotates a floating block by 90° steps around its centre. */
export function rotateFloating(f: Floating, turn: Turn): Floating {
  if (turn === '180') return flipFloating(flipFloating(f, 'horizontal'), 'vertical')
  const nw = f.h
  const nh = f.w
  const pixels = new Uint32Array(nw * nh)
  const shape = new Uint8Array(nw * nh)
  for (let j = 0; j < nh; j++) {
    for (let i = 0; i < nw; i++) {
      const sx = turn === 'cw' ? j : f.w - 1 - j
      const sy = turn === 'cw' ? f.h - 1 - i : i
      pixels[j * nw + i] = f.pixels[sy * f.w + sx]
      shape[j * nw + i] = f.shape[sy * f.w + sx]
    }
  }
  return { w: nw, h: nh, pixels, shape, x: f.x + Math.floor((f.w - nw) / 2), y: f.y + Math.floor((f.h - nh) / 2) }
}

/** Nearest-neighbour resize of a floating block to w × h at (x, y). */
export function scaleFloating(src: Floating, w: number, h: number, x: number, y: number): Floating {
  if (w === src.w && h === src.h) return { ...src, x, y }
  const pixels = new Uint32Array(w * h)
  const shape = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    const sy = Math.min(src.h - 1, Math.floor(((j + 0.5) * src.h) / h))
    for (let i = 0; i < w; i++) {
      const sx = Math.min(src.w - 1, Math.floor(((i + 0.5) * src.w) / w))
      pixels[j * w + i] = src.pixels[sy * src.w + sx]
      shape[j * w + i] = src.shape[sy * src.w + sx]
    }
  }
  return { w, h, pixels, shape, x, y }
}

function mapCels(sprite: Sprite, newW: number, newH: number, fn: (src: PixelImage, dst: Uint32Array) => void): void {
  const cels = new Map<string, PixelImage>()
  for (const [key, cel] of sprite.cels) {
    const data = new Uint32Array(newW * newH)
    fn(cel, data)
    cels.set(key, { width: newW, height: newH, data })
  }
  sprite.cels = cels
  sprite.width = newW
  sprite.height = newH
}

/** Mirrors every cel of every layer and frame. */
export function flipSprite(sprite: Sprite, axis: Axis): void {
  const { width: w, height: h } = sprite
  mapCels(sprite, w, h, (src, dst) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = axis === 'horizontal' ? w - 1 - x : x
        const sy = axis === 'vertical' ? h - 1 - y : y
        dst[y * w + x] = src.data[sy * w + sx]
      }
    }
  })
}

/** Rotates the whole sprite (all cels); 90° turns swap width and height. */
export function rotateSprite(sprite: Sprite, turn: Turn): void {
  const { width: w, height: h } = sprite
  const nw = turn === '180' ? w : h
  const nh = turn === '180' ? h : w
  mapCels(sprite, nw, nh, (src, dst) => {
    for (let j = 0; j < nh; j++) {
      for (let i = 0; i < nw; i++) {
        let sx: number
        let sy: number
        if (turn === 'cw') {
          sx = j
          sy = h - 1 - i
        } else if (turn === 'ccw') {
          sx = w - 1 - j
          sy = i
        } else {
          sx = w - 1 - i
          sy = h - 1 - j
        }
        dst[j * nw + i] = src.data[sy * w + sx]
      }
    }
  })
}
