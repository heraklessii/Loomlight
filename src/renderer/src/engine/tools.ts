// Tools and stroke sessions. A session owns a copy of the cel taken at
// pointer-down (`base`); shapes are re-rastered from it on every move with
// the same functions used on release (rule 2).

import type { Packed } from './color'
import { cloneImage, copyRegion, diffBounds, shiftImage, type PixelImage, type Rect } from './image'
import { ditherAllows, shadeColor, type Dither, type Ink } from './ink'
import { brushOffsets, ellipse, floodFill, line, mirrored, rect, stamped, type BrushShape, type Mirror, type Plot } from './raster'

/** Tiled mode (decision 014): drawing wraps around these axes. */
export type Tiled = 'none' | 'x' | 'y' | 'both'

export type ToolId = 'pencil' | 'eraser' | 'bucket' | 'eyedropper' | 'line' | 'rectangle' | 'ellipse' | 'marquee' | 'lasso' | 'wand' | 'move' | 'hand'

export const TOOL_IDS: ToolId[] = ['pencil', 'eraser', 'bucket', 'eyedropper', 'line', 'rectangle', 'ellipse', 'marquee', 'lasso', 'wand', 'move', 'hand']

/** Tools that change the selection instead of pixels. */
export const SELECTION_TOOLS = new Set<ToolId>(['marquee', 'lasso', 'wand'])

/** Tools that change pixels (need an editable layer). */
export const EDITING_TOOLS = new Set<ToolId>(['pencil', 'eraser', 'bucket', 'line', 'rectangle', 'ellipse', 'move'])

/** Tools whose footprint follows the brush size. */
export const BRUSH_TOOLS = new Set<ToolId>(['pencil', 'eraser', 'line', 'rectangle', 'ellipse'])

export interface ToolOptions {
  brushSize: number
  brushShape: BrushShape
  pixelPerfect: boolean
  filled: boolean
  contiguous: boolean
  mirror: Mirror
  /** pencil only */
  ink: Ink
  /** pencil, shapes, bucket */
  dither: Dither
}

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  brushSize: 1,
  brushShape: 'square',
  pixelPerfect: false,
  filled: false,
  contiguous: true,
  mirror: 'none',
  ink: 'simple',
  dither: 'none'
}

export const MAX_BRUSH = 64

export interface StrokeResult {
  rect: Rect
  before: Uint32Array
  after: Uint32Array
}

export interface StrokeSession {
  /** Pointer moved to (x, y). `constrain` = Shift held. */
  move(x: number, y: number, constrain: boolean): void
  /** Finishes the stroke; returns the changed region or null when nothing changed. */
  end(): StrokeResult | null
  /** Restores the cel to its state before the stroke. */
  cancel(): void
}

export interface StrokeStart {
  tool: ToolId
  cel: PixelImage
  x: number
  y: number
  color: Packed
  options: ToolOptions
  /** Shift+click: draw a straight line from this point (pencil/eraser). */
  lineFrom?: { x: number; y: number }
  /** Selection (1 byte per pixel): when present, only selected pixels change. */
  mask?: Uint8Array
  /** Shading ink ramp (the sprite palette) and direction: +1 primary button, −1 secondary. */
  palette?: Packed[]
  shadeDir?: 1 | -1
  /** Tiled mode: coordinates wrap around the sprite. */
  wrap?: Tiled
}

export function beginStroke(s: StrokeStart): StrokeSession | null {
  const base = cloneImage(s.cel)
  const { cel, options } = s
  const color = s.tool === 'eraser' ? 0 : s.color
  const { width: w, height: h } = cel
  const offsets = brushOffsets(options.brushSize, options.brushShape)
  const mask = s.mask
  const wrapX = s.wrap === 'x' || s.wrap === 'both'
  const wrapY = s.wrap === 'y' || s.wrap === 'both'
  /** Pixel index after tiled wrapping, or −1 outside the sprite. */
  const index = (x: number, y: number): number => {
    if (wrapX) x = ((x % w) + w) % w
    if (wrapY) y = ((y % h) + h) % h
    return x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1
  }
  const dither = options.dither ?? 'none'
  const shading = s.tool === 'pencil' && options.ink === 'shading' && !!s.palette?.length
  // shading changes each pixel once per stroke (re-shading would run down the ramp)
  const shaded = shading ? new Uint8Array(w * h) : null
  const write: Plot = (x, y) => {
    const i = index(x, y)
    if (i < 0 || (mask && !mask[i]) || !ditherAllows(dither, i % w, (i / w) | 0)) return
    if (shaded) {
      if (shaded[i]) return
      shaded[i] = 1
      cel.data[i] = shadeColor(base.data[i], s.palette!, s.shadeDir ?? 1)
    } else cel.data[i] = color
  }
  const paint: Plot = stamped(mirrored(write, options.mirror, w, h), offsets)

  const finish = (): StrokeResult | null => {
    const r = diffBounds(base, cel)
    if (!r) return null
    return { rect: r, before: copyRegion(base, r), after: copyRegion(cel, r) }
  }
  const cancel = (): void => cel.data.set(base.data)

  switch (s.tool) {
    case 'pencil':
    case 'eraser': {
      const perfect = options.pixelPerfect && offsets.length === 1
      const restore: Plot = mirrored((x, y) => {
        const i = index(x, y)
        if (i >= 0) {
          cel.data[i] = base.data[i]
          if (shaded) shaded[i] = 0
        }
      }, options.mirror, w, h)
      const trail: Array<[number, number]> = []
      let last = s.lineFrom ? { ...s.lineFrom } : { x: s.x, y: s.y }

      const visit: Plot = (x, y) => {
        const prev = trail.at(-1)
        if (prev && prev[0] === x && prev[1] === y) return
        paint(x, y)
        trail.push([x, y])
        if (perfect && trail.length >= 3) {
          const [ax, ay] = trail[trail.length - 3]
          const [bx, by] = trail[trail.length - 2]
          // L-corner: a and the new point are diagonal neighbours, b touches both orthogonally
          if (Math.abs(ax - x) === 1 && Math.abs(ay - y) === 1 && (bx === ax || by === ay) && (bx === x || by === y)) {
            restore(bx, by)
            trail.splice(trail.length - 2, 1)
          }
        }
      }
      line(last.x, last.y, s.x, s.y, visit)
      last = { x: s.x, y: s.y }
      return {
        move(x, y) {
          if (x === last.x && y === last.y) return
          line(last.x, last.y, x, y, visit)
          last = { x, y }
        },
        end: finish,
        cancel
      }
    }

    case 'line':
    case 'rectangle':
    case 'ellipse': {
      const x0 = s.x
      const y0 = s.y
      const draw = (x: number, y: number, constrain: boolean): void => {
        cel.data.set(base.data)
        shaded?.fill(0)
        let x1 = x
        let y1 = y
        if (constrain) [x1, y1] = constrainEnd(s.tool, x0, y0, x, y)
        if (s.tool === 'line') line(x0, y0, x1, y1, paint)
        else if (s.tool === 'rectangle') rect(x0, y0, x1, y1, options.filled, paint)
        else ellipse(x0, y0, x1, y1, options.filled, paint)
      }
      draw(x0, y0, false)
      return { move: draw, end: finish, cancel }
    }

    case 'move': {
      const x0 = s.x
      const y0 = s.y
      return {
        move(x, y) {
          shiftImage(base, x - x0, y - y0, cel)
        },
        end: finish,
        cancel
      }
    }

    case 'bucket': {
      const start = index(s.x, s.y)
      const inside = start >= 0 && (!mask || mask[start] === 1)
      if (inside && floodFill(cel, start % w, (start / w) | 0, color, options.contiguous)) {
        for (let i = 0; i < cel.data.length; i++) {
          if ((mask && !mask[i]) || !ditherAllows(dither, i % w, (i / w) | 0)) cel.data[i] = base.data[i]
        }
      }
      return { move() {}, end: finish, cancel }
    }

    default:
      return null
  }
}

/** Shift-constrained end point: 45° steps for lines, squares/circles for shapes. */
export function constrainEnd(tool: ToolId, x0: number, y0: number, x: number, y: number): [number, number] {
  const dx = x - x0
  const dy = y - y0
  if (tool === 'line') {
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (adx > ady * 2) return [x, y0]
    if (ady > adx * 2) return [x0, y]
    const d = Math.max(adx, ady)
    return [x0 + Math.sign(dx) * d, y0 + Math.sign(dy) * d]
  }
  const d = Math.max(Math.abs(dx), Math.abs(dy))
  return [x0 + (dx < 0 ? -d : d), y0 + (dy < 0 ? -d : d)]
}
