// Sprite sheet layout and JSON metadata (decision 005).

import { blit, upscale } from './scale'
import { compositeFrame, tagRange, type LoopDirection, type Sprite } from './sprite'

export type SheetLayout = 'row' | 'column' | 'grid'

export interface SheetGeometry {
  columns: number
  rows: number
  width: number
  height: number
}

export function sheetGeometry(frameCount: number, cellW: number, cellH: number, layout: SheetLayout): SheetGeometry {
  let columns = frameCount
  let rows = 1
  if (layout === 'column') {
    columns = 1
    rows = frameCount
  } else if (layout === 'grid') {
    columns = Math.ceil(Math.sqrt(frameCount))
    rows = Math.ceil(frameCount / columns)
  }
  return { columns, rows, width: columns * cellW, height: rows * cellH }
}

export interface SheetResult {
  width: number
  height: number
  pixels: Uint32Array
  json: SheetJson
}

export interface SheetJson {
  frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number }; duration: number }>
  meta: {
    app: string
    version: string
    image: string
    size: { w: number; h: number }
    scale: string
    frameTags: Array<{ name: string; from: number; to: number; direction: LoopDirection; color: string }>
  }
}

/** `indices`: which frames to export (default: all), in order. */
export function buildSheet(sprite: Sprite, layout: SheetLayout, scale: number, imageName: string, indices?: number[]): SheetResult {
  const order = indices ?? sprite.frames.map((_, i) => i)
  const cw = sprite.width * scale
  const ch = sprite.height * scale
  const g = sheetGeometry(order.length, cw, ch, layout)
  const pixels = new Uint32Array(g.width * g.height)
  const frameBuf = new Uint32Array(sprite.width * sprite.height)
  const frames: SheetJson['frames'] = []
  order.forEach((fi, i) => {
    const f = sprite.frames[fi]
    compositeFrame(sprite, fi, frameBuf)
    const scaled = upscale(frameBuf, sprite.width, sprite.height, scale)
    const x = (i % g.columns) * cw
    const y = Math.floor(i / g.columns) * ch
    blit(pixels, g.width, scaled, cw, ch, x, y)
    frames.push({ filename: `${i}`, frame: { x, y, w: cw, h: ch }, duration: f.duration })
  })
  return {
    width: g.width,
    height: g.height,
    pixels,
    json: {
      frames,
      meta: { app: 'Loomlight', version: '1', image: imageName, size: { w: g.width, h: g.height }, scale: String(scale), frameTags: frameTags(sprite, order) }
    }
  }
}

/** Tags fully inside the exported frames, with indices relative to the export (Aseprite's meta.frameTags). */
function frameTags(sprite: Sprite, order: number[]): SheetJson['meta']['frameTags'] {
  const out: SheetJson['meta']['frameTags'] = []
  for (const tag of sprite.tags) {
    const r = tagRange(sprite, tag)
    if (!r) continue
    const from = order.indexOf(r[0])
    const to = order.indexOf(r[1])
    if (from < 0 || to < 0) continue
    out.push({ name: tag.name, from, to, direction: tag.direction, color: tag.color })
  }
  return out
}
