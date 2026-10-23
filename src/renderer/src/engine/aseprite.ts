// .aseprite / .ase importer (decision 013), read-only. Follows the public
// file spec (github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md):
// RGBA / grayscale / indexed sprites, layers (groups flattened), raw /
// compressed / linked cels, palettes, tags, reference layers.
// Not imported: tilemaps, blend modes other than normal, user data, slices.

import { pack, type Packed } from './color'
import { createImage, type PixelImage } from './image'
import { celKey, MAX_SPRITE_SIZE, newId, type Frame, type Layer, type LoopDirection, type Reference, type Sprite, type Tag } from './sprite'

export class AsepriteError extends Error {}

export type AsepriteWarning = 'blend-modes' | 'tilemaps'

export interface AsepriteImport {
  sprite: Sprite
  warnings: AsepriteWarning[]
}

const CHUNK_OLD_PALETTE = 0x0004
const CHUNK_LAYER = 0x2004
const CHUNK_CEL = 0x2005
const CHUNK_TAGS = 0x2018
const CHUNK_PALETTE = 0x2019

const LAYER_VISIBLE = 1
const LAYER_BACKGROUND = 8
const LAYER_REFERENCE = 64

class Reader {
  private dv: DataView
  constructor(
    private bytes: Uint8Array,
    public pos = 0
  ) {
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  need(n: number): void {
    if (this.pos + n > this.bytes.length) throw new AsepriteError('Unexpected end of file')
  }
  byte(): number {
    this.need(1)
    return this.dv.getUint8(this.pos++)
  }
  word(): number {
    this.need(2)
    const v = this.dv.getUint16(this.pos, true)
    this.pos += 2
    return v
  }
  short(): number {
    this.need(2)
    const v = this.dv.getInt16(this.pos, true)
    this.pos += 2
    return v
  }
  dword(): number {
    this.need(4)
    const v = this.dv.getUint32(this.pos, true)
    this.pos += 4
    return v
  }
  skip(n: number): void {
    this.need(n)
    this.pos += n
  }
  slice(n: number): Uint8Array {
    this.need(n)
    const s = this.bytes.subarray(this.pos, this.pos + n)
    this.pos += n
    return s
  }
  string(): string {
    const n = this.word()
    return new TextDecoder().decode(this.slice(n))
  }
}

interface RawLayer {
  flags: number
  type: number
  level: number
  blend: number
  opacity: number
  name: string
  /** effective visibility after parent groups */
  visible: boolean
}

interface RawCel {
  layer: number
  x: number
  y: number
  opacity: number
  w: number
  h: number
  pixels?: Uint8Array
  linkedFrame?: number
}

export async function readAseprite(bytes: Uint8Array): Promise<AsepriteImport> {
  if (bytes.length < 128) throw new AsepriteError('Not an Aseprite file')
  const r = new Reader(bytes)
  r.dword() // file size
  if (r.word() !== 0xa5e0) throw new AsepriteError('Not an Aseprite file')
  const frameCount = r.word()
  const width = r.word()
  const height = r.word()
  const depth = r.word()
  const headerFlags = r.dword()
  r.word() // speed (deprecated)
  r.skip(8)
  const transparentIndex = r.byte()
  r.skip(3)
  r.word() // number of colours
  if (![32, 16, 8].includes(depth)) throw new AsepriteError('Unsupported colour depth')
  if (width < 1 || height < 1 || width > MAX_SPRITE_SIZE || height > MAX_SPRITE_SIZE) throw new AsepriteError('Unsupported sprite size')
  const layerOpacityValid = (headerFlags & 1) !== 0

  const warnings = new Set<AsepriteWarning>()
  const rawLayers: RawLayer[] = []
  const groupVisible: boolean[] = []
  const frames: Frame[] = []
  const celsPerFrame: RawCel[][] = []
  let palette: Packed[] = []
  let newPalette = false
  const tags: Array<{ from: number; to: number; dir: number; color: [number, number, number]; name: string }> = []

  let pos = 128
  for (let f = 0; f < frameCount; f++) {
    const fr = new Reader(bytes, pos)
    const frameBytes = fr.dword()
    if (fr.word() !== 0xf1fa) throw new AsepriteError('Damaged frame header')
    const oldChunks = fr.word()
    const duration = fr.word()
    fr.skip(2)
    const newChunks = fr.dword()
    const chunkCount = newChunks !== 0 ? newChunks : oldChunks
    frames.push({ id: newId('f'), duration: Math.max(10, duration || 100) })
    const cels: RawCel[] = []
    for (let c = 0; c < chunkCount; c++) {
      const start = fr.pos
      const size = fr.dword()
      const type = fr.word()
      if (size < 6) throw new AsepriteError('Damaged chunk')
      const end = start + size
      const cr = new Reader(bytes.subarray(0, end), fr.pos)
      if (type === CHUNK_LAYER) {
        const flags = cr.word()
        const ltype = cr.word()
        const level = cr.word()
        cr.word()
        cr.word()
        const blend = cr.word()
        const opacity = cr.byte()
        cr.skip(3)
        const name = cr.string()
        groupVisible.length = level
        const parentsVisible = groupVisible.every(Boolean)
        const visible = parentsVisible && (flags & LAYER_VISIBLE) !== 0
        if (ltype === 1) groupVisible[level] = visible
        rawLayers.push({ flags, type: ltype, level, blend, opacity: layerOpacityValid ? opacity : 255, name, visible })
        if (ltype === 2) warnings.add('tilemaps')
        if (ltype === 0 && blend !== 0) warnings.add('blend-modes')
      } else if (type === CHUNK_CEL) {
        const layer = cr.word()
        const x = cr.short()
        const y = cr.short()
        const opacity = cr.byte()
        const celType = cr.word()
        cr.short() // z-index
        cr.skip(5)
        if (celType === 0) {
          const w = cr.word()
          const h = cr.word()
          cels.push({ layer, x, y, opacity, w, h, pixels: cr.slice(w * h * (depth / 8)) })
        } else if (celType === 1) {
          cels.push({ layer, x, y, opacity, w: 0, h: 0, linkedFrame: cr.word() })
        } else if (celType === 2) {
          const w = cr.word()
          const h = cr.word()
          const pixels = await inflate(cr.slice(end - cr.pos))
          if (pixels.length < w * h * (depth / 8)) throw new AsepriteError('Damaged cel data')
          cels.push({ layer, x, y, opacity, w, h, pixels })
        } else warnings.add('tilemaps')
      } else if (type === CHUNK_PALETTE) {
        newPalette = true
        const total = cr.dword()
        const first = cr.dword()
        const last = cr.dword()
        cr.skip(8)
        if (palette.length < total) palette = palette.concat(Array.from({ length: total - palette.length }, () => 0))
        for (let i = first; i <= last; i++) {
          const pflags = cr.word()
          const cr8 = cr.byte()
          const cg = cr.byte()
          const cb = cr.byte()
          const ca = cr.byte()
          if (pflags & 1) cr.string()
          palette[i] = pack(cr8, cg, cb, ca)
        }
      } else if (type === CHUNK_OLD_PALETTE && !newPalette) {
        const packets = cr.word()
        let index = 0
        for (let k = 0; k < packets; k++) {
          index += cr.byte()
          const n = cr.byte() || 256
          for (let i = 0; i < n; i++) palette[index++] = pack(cr.byte(), cr.byte(), cr.byte())
        }
      } else if (type === CHUNK_TAGS) {
        const n = cr.word()
        cr.skip(8)
        for (let k = 0; k < n; k++) {
          const from = cr.word()
          const to = cr.word()
          const dir = cr.byte()
          cr.word() // repeat
          cr.skip(6)
          const color: [number, number, number] = [cr.byte(), cr.byte(), cr.byte()]
          cr.byte()
          tags.push({ from, to, dir, color, name: cr.string() })
        }
      }
      fr.pos = end
    }
    celsPerFrame.push(cels)
    pos += frameBytes
  }

  // --- build the sprite: normal layers become pixel layers, reference layers references
  const layers: Layer[] = []
  const layerIdByIndex = new Map<number, string>()
  rawLayers.forEach((l, i) => {
    if (l.type !== 0) return
    const ref = (l.flags & LAYER_REFERENCE) !== 0
    const layer: Layer = { id: newId('l'), name: l.name || `Layer ${layers.length + 1}`, visible: l.visible, locked: false, opacity: l.opacity }
    if (ref) layer.kind = 'reference'
    layers.push(layer)
    layerIdByIndex.set(i, layer.id)
  })
  if (layers.length === 0 || frames.length === 0) throw new AsepriteError('No layers or frames to import')

  const sprite: Sprite = {
    width,
    height,
    layers,
    frames,
    cels: new Map(),
    // drawing palette: the file's colours without transparent slots
    palette: palette.filter((c) => c !== undefined && c >>> 24 !== 0).slice(0, 256),
    tags: [],
    colorMode: depth === 8 ? 'indexed' : 'rgba',
    references: new Map()
  }

  const toPacked = (px: Uint8Array, i: number, background: boolean): Packed => {
    if (depth === 32) return pack(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3])
    if (depth === 16) {
      const v = px[i * 2]
      return pack(v, v, v, px[i * 2 + 1])
    }
    const idx = px[i]
    if (idx === transparentIndex && !background) return 0
    return palette[idx] ?? 0
  }

  const decoded = new Map<string, PixelImage>() // "layerIndex:frame" → image (for linked cels)
  for (let f = 0; f < frames.length; f++) {
    for (const cel of celsPerFrame[f]) {
      const raw = rawLayers[cel.layer]
      const layerId = layerIdByIndex.get(cel.layer)
      if (!raw || !layerId) continue
      let img: PixelImage | undefined
      if (cel.linkedFrame !== undefined) {
        const src = decoded.get(`${cel.layer}:${cel.linkedFrame}`)
        if (src) img = { width: src.width, height: src.height, data: src.data.slice() }
      } else if (cel.pixels) {
        const background = (raw.flags & LAYER_BACKGROUND) !== 0
        if (raw.flags & LAYER_REFERENCE) {
          // reference layers keep their own size and position (first cel wins)
          if (!sprite.references.has(layerId)) {
            const image = createImage(cel.w, cel.h)
            for (let i = 0; i < cel.w * cel.h; i++) image.data[i] = toPacked(cel.pixels, i, background)
            sprite.references.set(layerId, { image, x: cel.x, y: cel.y, scale: 1 } satisfies Reference)
          }
          continue
        }
        img = createImage(width, height)
        for (let y = 0; y < cel.h; y++) {
          const ty = cel.y + y
          if (ty < 0 || ty >= height) continue
          for (let x = 0; x < cel.w; x++) {
            const tx = cel.x + x
            if (tx < 0 || tx >= width) continue
            let p = toPacked(cel.pixels, y * cel.w + x, background)
            if (cel.opacity < 255 && p >>> 24 !== 0) p = ((p & 0x00ffffff) | (Math.round(((p >>> 24) * cel.opacity) / 255) << 24)) >>> 0
            img.data[ty * width + tx] = p
          }
        }
      }
      if (!img) continue
      decoded.set(`${cel.layer}:${f}`, img)
      sprite.cels.set(celKey(layerId, frames[f].id), img)
    }
  }

  const dirs: LoopDirection[] = ['forward', 'reverse', 'pingpong', 'pingpong']
  for (const t of tags) {
    if (t.from >= frames.length || t.to >= frames.length) continue
    const hex = '#' + t.color.map((v) => v.toString(16).padStart(2, '0')).join('')
    const tag: Tag = { id: newId('t'), name: t.name, from: frames[Math.min(t.from, t.to)].id, to: frames[Math.max(t.from, t.to)].id, color: hex, direction: dirs[t.dir] ?? 'forward' }
    sprite.tags.push(tag)
  }

  return { sprite, warnings: [...warnings] }
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    throw new AsepriteError('Damaged cel data')
  }
}
