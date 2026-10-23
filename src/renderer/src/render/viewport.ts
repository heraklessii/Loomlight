// Draws the canvas viewport: background, checkerboard, onion skin, the
// composited frame (nearest-neighbour), pixel grid and the brush footprint.
// Works in device pixels so pixel edges stay crisp (rule 1).

import { compositeFrame, isReference, type Layer, type Reference, type Sprite } from '@engine/sprite'
import type { PixelImage } from '@engine/image'
import type { Tiled } from '@engine/tools'
import type { Packed } from '@engine/color'
import { red, green, blue, alpha } from '@engine/color'
import { cropMask, maskEdges, type Mask } from '@engine/selection'
import type { Floating } from '@engine/transform'

export interface ViewParams {
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  onionSkin: boolean
  tiled: Tiled
}

export interface Footprint {
  /** sprite pixels (already mirrored) */
  pixels: Array<[number, number]>
  /** fill colour, or null for an outline only (eraser, bucket, eyedropper) */
  color: Packed | null
}

/** Everything drawn on top of the sprite. */
export interface Overlay {
  footprint: Footprint | null
  selection: Mask | null
  floating: Floating | null
  /** selection being dragged out (marquee / lasso), in sprite pixels */
  pending: { kind: 'rect'; x0: number; y0: number; x1: number; y1: number } | { kind: 'lasso'; points: Array<[number, number]> } | null
  /** marching-ants phase in px */
  phase: number
}

const GRID_MIN_PX = 6

/** Size of the scale handles of a floating block, in CSS px. */
export const HANDLE_PX = 7

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** Handle positions in sprite coordinates (pixel corners / edge middles). */
export function handlePoints(f: Floating): Array<[number, number, Handle]> {
  const l = f.x
  const t = f.y
  const r = f.x + f.w
  const b = f.y + f.h
  const cx = (l + r) / 2
  const cy = (t + b) / 2
  return [
    [l, t, 'nw'],
    [cx, t, 'n'],
    [r, t, 'ne'],
    [r, cy, 'e'],
    [r, b, 'se'],
    [cx, b, 's'],
    [l, b, 'sw'],
    [l, cy, 'w']
  ]
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

class FrameSurface {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  buf: Uint32Array
  image: ImageData
  constructor(w: number, h: number) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.ctx = this.canvas.getContext('2d')!
    this.image = new ImageData(w, h)
    this.buf = new Uint32Array(this.image.data.buffer)
  }
  draw(sprite: Sprite, frameIndex: number, from?: number, to?: number): HTMLCanvasElement {
    compositeFrame(sprite, frameIndex, this.buf, from, to)
    this.ctx.putImageData(this.image, 0, 0)
    return this.canvas
  }
}

export class ViewportRenderer {
  private ctx: CanvasRenderingContext2D
  private surfaces: FrameSurface[] = []
  private surfaceKey = ''
  private colors = {
    bg: '#161616',
    checkA: '#2b2b2b',
    checkB: '#343434',
    grid: 'rgba(255,255,255,0.07)',
    edge: 'rgba(255,255,255,0.14)',
    antsDark: '#000000',
    antsLight: '#ffffff'
  }
  private checker: CanvasPattern | null = null
  private maskEdges = new WeakMap<Mask, number[]>()
  private shapeEdges = new WeakMap<Uint8Array, number[]>()
  private checkerDpr = 0
  private refCanvases = new WeakMap<PixelImage, HTMLCanvasElement>()

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.refreshColors()
  }

  /** Re-reads the canvas tokens (theme change). */
  refreshColors(): void {
    this.checker = null
    this.colors = {
      bg: cssVar('--canvas-bg', this.colors.bg),
      checkA: cssVar('--checker-a', this.colors.checkA),
      checkB: cssVar('--checker-b', this.colors.checkB),
      grid: cssVar('--pixel-grid', this.colors.grid),
      edge: cssVar('--sprite-edge', this.colors.edge),
      antsDark: cssVar('--ants-dark', this.colors.antsDark),
      antsLight: cssVar('--ants-light', this.colors.antsLight)
    }
  }

  private surface(i: number, sprite: Sprite): FrameSurface {
    const key = `${sprite.width}x${sprite.height}`
    if (key !== this.surfaceKey) {
      this.surfaces = []
      this.surfaceKey = key
    }
    return (this.surfaces[i] ??= new FrameSurface(sprite.width, sprite.height))
  }

  private checkerPattern(dpr: number): CanvasPattern {
    if (this.checker && this.checkerDpr === dpr) return this.checker
    const cell = Math.max(4, Math.round(8 * dpr))
    const c = document.createElement('canvas')
    c.width = c.height = cell * 2
    const g = c.getContext('2d')!
    g.fillStyle = this.colors.checkA
    g.fillRect(0, 0, cell * 2, cell * 2)
    g.fillStyle = this.colors.checkB
    g.fillRect(cell, 0, cell, cell)
    g.fillRect(0, cell, cell, cell)
    this.checker = this.ctx.createPattern(c, 'repeat')!
    this.checkerDpr = dpr
    return this.checker
  }

  render(sprite: Sprite | null, frameIndex: number, view: ViewParams, overlay: Overlay): void {
    const footprint = overlay.footprint
    const { canvas, ctx } = this
    const dpr = window.devicePixelRatio || 1
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const ch = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = this.colors.bg
    ctx.fillRect(0, 0, cw, ch)
    if (!sprite) return

    const scale = view.zoom * dpr
    const ox = Math.round(view.panX * dpr)
    const oy = Math.round(view.panY * dpr)
    const sw = Math.round(sprite.width * scale)
    const sh = Math.round(sprite.height * scale)

    // checkerboard = transparency
    const pattern = this.checkerPattern(dpr)
    pattern.setTransform(new DOMMatrix().translate(ox, oy))
    ctx.fillStyle = pattern
    ctx.fillRect(ox, oy, sw, sh)

    // tiled mode: the composite repeats around the sprite (pixel layers only)
    const tx = view.tiled === 'x' || view.tiled === 'both'
    const ty = view.tiled === 'y' || view.tiled === 'both'
    if (tx || ty) {
      const full = this.surface(0, sprite).draw(sprite, frameIndex)
      for (const dy of ty ? [-1, 0, 1] : [0]) {
        for (const dx of tx ? [-1, 0, 1] : [0]) {
          if (dx === 0 && dy === 0) continue
          ctx.fillStyle = pattern
          ctx.fillRect(ox + dx * sw, oy + dy * sh, sw, sh)
          ctx.drawImage(full, ox + dx * sw, oy + dy * sh, sw, sh)
        }
      }
    }

    // onion skin behind the current frame
    const n = sprite.frames.length
    if (view.onionSkin && n > 1) {
      ctx.globalAlpha = 0.28
      if (frameIndex > 0) ctx.drawImage(this.surface(1, sprite).draw(sprite, frameIndex - 1), ox, oy, sw, sh)
      if (frameIndex < n - 1) ctx.drawImage(this.surface(2, sprite).draw(sprite, frameIndex + 1), ox, oy, sw, sh)
      ctx.globalAlpha = 1
    }
    this.drawLayers(sprite, frameIndex, ox, oy, sw, sh, scale)

    // pixel grid
    if (view.showGrid && scale >= GRID_MIN_PX) {
      ctx.fillStyle = this.colors.grid
      const x0 = Math.max(0, Math.floor(-ox / scale))
      const x1 = Math.min(sprite.width, Math.ceil((cw - ox) / scale))
      const y0 = Math.max(0, Math.floor(-oy / scale))
      const y1 = Math.min(sprite.height, Math.ceil((ch - oy) / scale))
      for (let x = x0 + 1; x < x1; x++) ctx.fillRect(ox + Math.round(x * scale), oy, 1, sh)
      for (let y = y0 + 1; y < y1; y++) ctx.fillRect(ox, oy + Math.round(y * scale), sw, 1)
    }

    // sprite edge
    ctx.strokeStyle = this.colors.edge
    ctx.lineWidth = 1
    ctx.strokeRect(ox - 0.5, oy - 0.5, sw + 1, sh + 1)

    if (footprint && footprint.pixels.length) this.drawFootprint(footprint, sprite, ox, oy, scale, view.tiled)
    this.drawSelection(overlay, ox, oy, scale)
  }

  private drawSelection(o: Overlay, ox: number, oy: number, scale: number): void {
    const { ctx } = this
    const px = (v: number): number => Math.round(v * scale)
    const path = new Path2D()
    const addSegs = (segs: number[], bx: number, by: number): void => {
      for (let i = 0; i < segs.length; i += 4) {
        const x1 = ox + px(bx + segs[i]) + 0.5
        const y1 = oy + px(by + segs[i + 1]) + 0.5
        const x2 = ox + px(bx + segs[i + 2]) + 0.5
        const y2 = oy + px(by + segs[i + 3]) + 0.5
        path.moveTo(x1, y1)
        path.lineTo(x2, y2)
      }
    }
    if (o.floating) {
      const f = o.floating
      let segs = this.shapeEdges.get(f.shape)
      if (!segs) this.shapeEdges.set(f.shape, (segs = maskEdges(f.shape, f.w, f.h)))
      addSegs(segs, f.x, f.y)
    } else if (o.selection) {
      const m = o.selection
      let segs = this.maskEdges.get(m)
      if (!segs) this.maskEdges.set(m, (segs = maskEdges(cropMask(m), m.bounds.w, m.bounds.h)))
      addSegs(segs, m.bounds.x, m.bounds.y)
    }
    const p = o.pending
    if (p?.kind === 'rect') {
      const l = Math.min(p.x0, p.x1)
      const r = Math.max(p.x0, p.x1) + 1
      const t = Math.min(p.y0, p.y1)
      const b = Math.max(p.y0, p.y1) + 1
      path.rect(ox + px(l) + 0.5, oy + px(t) + 0.5, px(r) - px(l), px(b) - px(t))
    } else if (p?.kind === 'lasso' && p.points.length) {
      p.points.forEach(([x, y], i) => {
        const cx = ox + px(x + 0.5)
        const cy = oy + px(y + 0.5)
        if (i === 0) path.moveTo(cx, cy)
        else path.lineTo(cx, cy)
      })
    }
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.lineDashOffset = -o.phase
    ctx.strokeStyle = this.colors.antsDark
    ctx.stroke(path)
    ctx.lineDashOffset = -o.phase + 4
    ctx.strokeStyle = this.colors.antsLight
    ctx.stroke(path)
    ctx.setLineDash([])
    if (o.floating) this.drawHandles(o.floating, ox, oy, scale)
  }

  private drawHandles(f: Floating, ox: number, oy: number, scale: number): void {
    const { ctx } = this
    const dpr = window.devicePixelRatio || 1
    const size = Math.round(HANDLE_PX * dpr)
    for (const [hx, hy] of handlePoints(f)) {
      const x = Math.round(ox + hx * scale - size / 2)
      const y = Math.round(oy + hy * scale - size / 2)
      ctx.fillStyle = this.colors.antsDark
      ctx.fillRect(x - 1, y - 1, size + 2, size + 2)
      ctx.fillStyle = this.colors.antsLight
      ctx.fillRect(x, y, size, size)
    }
  }

  /**
   * Pixel layers of the frame with reference layers in their stacking order.
   * Without references this is one composite (the common, fast case).
   */
  private drawLayers(sprite: Sprite, frameIndex: number, ox: number, oy: number, sw: number, sh: number, scale: number): void {
    const { ctx } = this
    const refs = sprite.layers.map((l, i) => (isReference(l) && l.visible ? i : -1)).filter((i) => i >= 0)
    if (refs.length === 0) {
      ctx.drawImage(this.surface(0, sprite).draw(sprite, frameIndex), ox, oy, sw, sh)
      return
    }
    let start = 0
    let k = 3
    for (const r of [...refs, sprite.layers.length]) {
      if (r > start) ctx.drawImage(this.surface(k++, sprite).draw(sprite, frameIndex, start, r), ox, oy, sw, sh)
      const layer = sprite.layers[r]
      const ref = layer && sprite.references.get(layer.id)
      if (layer && ref) this.drawReference(layer, ref, ox, oy, sw, sh, scale)
      start = r + 1
    }
  }

  private drawReference(layer: Layer, ref: Reference, ox: number, oy: number, sw: number, sh: number, scale: number): void {
    const { ctx } = this
    let c = this.refCanvases.get(ref.image)
    if (!c) {
      c = document.createElement('canvas')
      c.width = ref.image.width
      c.height = ref.image.height
      const img = new ImageData(ref.image.width, ref.image.height)
      new Uint32Array(img.data.buffer).set(ref.image.data)
      c.getContext('2d')!.putImageData(img, 0, 0)
      this.refCanvases.set(ref.image, c)
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(ox, oy, sw, sh)
    ctx.clip()
    ctx.globalAlpha = layer.opacity / 255
    // a reference is a photo or sketch, not pixel art: smooth scaling is fine here
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(c, ox + ref.x * scale, oy + ref.y * scale, ref.image.width * ref.scale * scale, ref.image.height * ref.scale * scale)
    ctx.restore()
    ctx.imageSmoothingEnabled = false
  }

  private drawFootprint(fp: Footprint, sprite: Sprite, ox: number, oy: number, scale: number, tiled: Tiled): void {
    const { ctx } = this
    const wx = tiled === 'x' || tiled === 'both'
    const wy = tiled === 'y' || tiled === 'both'
    const wrap = (v: number, n: number, on: boolean) => (on ? ((v % n) + n) % n : v)
    if (wx || wy) fp = { ...fp, pixels: fp.pixels.map(([x, y]) => [wrap(x, sprite.width, wx), wrap(y, sprite.height, wy)]) }
    const inside = fp.pixels.filter(([x, y]) => x >= 0 && y >= 0 && x < sprite.width && y < sprite.height)
    const px = (v: number): number => Math.round(v * scale)
    if (fp.color !== null) {
      const c = fp.color
      ctx.fillStyle = `rgba(${red(c)},${green(c)},${blue(c)},${alpha(c) / 255})`
      for (const [x, y] of inside) ctx.fillRect(ox + px(x), oy + px(y), px(x + 1) - px(x), px(y + 1) - px(y))
    }
    if (scale < 3) return
    // outline of the footprint's outer edge, two-tone so it reads on any colour
    const set = new Set(fp.pixels.map(([x, y]) => `${x},${y}`))
    const path = new Path2D()
    for (const [x, y] of fp.pixels) {
      const l = ox + px(x)
      const r = ox + px(x + 1)
      const t = oy + px(y)
      const b = oy + px(y + 1)
      if (!set.has(`${x},${y - 1}`)) {
        path.moveTo(l, t + 0.5)
        path.lineTo(r, t + 0.5)
      }
      if (!set.has(`${x},${y + 1}`)) {
        path.moveTo(l, b - 0.5)
        path.lineTo(r, b - 0.5)
      }
      if (!set.has(`${x - 1},${y}`)) {
        path.moveTo(l + 0.5, t)
        path.lineTo(l + 0.5, b)
      }
      if (!set.has(`${x + 1},${y}`)) {
        path.moveTo(r - 0.5, t)
        path.lineTo(r - 0.5, b)
      }
    }
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.stroke(path)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.stroke(path)
  }
}
