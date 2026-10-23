// `.loom` file format, version 1 (decision 005): JSON metadata with
// gzip-compressed, base64-encoded RGBA cels.

import { parseHex, toHex } from './color'
import { celKey, MAX_SPRITE_SIZE, type ColorMode, type Frame, type Layer, type LoopDirection, type Reference, type Sprite, type Tag } from './sprite'

export const LOOM_VERSION = 1
export const LOOM_EXTENSION = 'loom'

export type LoomErrorCode = 'not-loom' | 'newer-version' | 'corrupt'

export class LoomFormatError extends Error {
  constructor(public code: LoomErrorCode, message: string) {
    super(message)
  }
}

interface LoomCel {
  layer: string
  frame: string
  encoding: 'rgba-gzip-base64'
  data: string
}

interface LoomFile {
  format: 'loomlight'
  version: number
  width: number
  height: number
  palette: string[]
  layers: Layer[]
  frames: Frame[]
  cels: LoomCel[]
  /** optional (added in M2, readers without it ignore the field) */
  tags?: Tag[]
  /** optional (M3) */
  colorMode?: ColorMode
  /** optional (M3): images of reference layers */
  references?: LoomReference[]
}

interface LoomReference {
  layer: string
  x: number
  y: number
  scale: number
  width: number
  height: number
  encoding: 'rgba-gzip-base64'
  data: string
}

export async function writeLoom(sprite: Sprite): Promise<Uint8Array> {
  const cels: LoomCel[] = []
  for (const layer of sprite.layers) {
    for (const frame of sprite.frames) {
      const cel = sprite.cels.get(celKey(layer.id, frame.id))
      if (!cel || !cel.data.some((p) => p !== 0)) continue
      const raw = new Uint8Array(cel.data.buffer, cel.data.byteOffset, cel.data.byteLength)
      cels.push({ layer: layer.id, frame: frame.id, encoding: 'rgba-gzip-base64', data: toBase64(await gzip(raw)) })
    }
  }
  const file: LoomFile = {
    format: 'loomlight',
    version: LOOM_VERSION,
    width: sprite.width,
    height: sprite.height,
    palette: sprite.palette.map((c) => toHex(c)),
    layers: sprite.layers.map(({ id, name, visible, locked, opacity, kind }) => (kind === 'reference' ? { id, name, visible, locked, opacity, kind } : { id, name, visible, locked, opacity })),
    frames: sprite.frames.map(({ id, duration }) => ({ id, duration })),
    tags: sprite.tags.map(({ id, name, from, to, color, direction }) => ({ id, name, from, to, color, direction })),
    colorMode: sprite.colorMode,
    references: await writeReferences(sprite),
    cels
  }
  return new TextEncoder().encode(JSON.stringify(file, null, 1))
}

export async function readLoom(bytes: Uint8Array): Promise<Sprite> {
  let file: LoomFile
  try {
    file = JSON.parse(new TextDecoder().decode(bytes)) as LoomFile
  } catch {
    throw new LoomFormatError('not-loom', 'Not a Loomlight file')
  }
  if (!file || file.format !== 'loomlight') throw new LoomFormatError('not-loom', 'Not a Loomlight file')
  if (typeof file.version !== 'number' || file.version > LOOM_VERSION) throw new LoomFormatError('newer-version', 'Made by a newer Loomlight')
  const { width, height } = file
  if (!isSize(width) || !isSize(height) || !Array.isArray(file.layers) || !Array.isArray(file.frames)) {
    throw new LoomFormatError('corrupt', 'Invalid sprite header')
  }
  if (file.layers.length === 0 || file.frames.length === 0) throw new LoomFormatError('corrupt', 'No layers or frames')

  const layers: Layer[] = file.layers.map((l, i) => ({
    id: String(l.id),
    name: typeof l.name === 'string' ? l.name : `Layer ${i + 1}`,
    visible: l.visible !== false,
    locked: l.locked === true,
    opacity: clampByte(l.opacity ?? 255),
    ...(l.kind === 'reference' ? { kind: 'reference' as const } : {})
  }))
  const frames: Frame[] = file.frames.map((f) => ({ id: String(f.id), duration: Math.max(10, Math.round(Number(f.duration) || 100)) }))
  const layerIds = new Set(layers.map((l) => l.id))
  const frameIds = new Set(frames.map((f) => f.id))
  const sprite: Sprite = {
    width,
    height,
    layers,
    frames,
    cels: new Map(),
    palette: (file.palette ?? []).map((h) => parseHex(h)).filter((c): c is number => c !== null),
    tags: (Array.isArray(file.tags) ? file.tags : [])
      .filter((t) => t && frameIds.has(String(t.from)) && frameIds.has(String(t.to)))
      .map((t, i) => ({
        id: String(t.id ?? `t${i}`),
        name: typeof t.name === 'string' ? t.name : `Tag ${i + 1}`,
        from: String(t.from),
        to: String(t.to),
        color: /^#[0-9a-f]{6}$/i.test(String(t.color)) ? String(t.color) : '#e8a33d',
        direction: (['forward', 'reverse', 'pingpong'] as LoopDirection[]).includes(t.direction) ? t.direction : 'forward'
      })),
    colorMode: file.colorMode === 'indexed' ? 'indexed' : 'rgba',
    references: new Map()
  }
  for (const r of file.references ?? []) {
    const layer = layers.find((l) => l.id === r.layer)
    if (!layer || layer.kind !== 'reference' || !isRefSize(r.width) || !isRefSize(r.height)) continue
    const raw = await gunzip(fromBase64(r.data))
    if (raw.byteLength !== r.width * r.height * 4) throw new LoomFormatError('corrupt', 'Reference size mismatch')
    const data = new Uint32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
    sprite.references.set(layer.id, { image: { width: r.width, height: r.height, data }, x: Number(r.x) || 0, y: Number(r.y) || 0, scale: Number(r.scale) > 0 ? Number(r.scale) : 1 })
  }
  for (const cel of file.cels ?? []) {
    if (!layerIds.has(cel.layer) || !frameIds.has(cel.frame)) continue
    if (cel.encoding !== 'rgba-gzip-base64') throw new LoomFormatError('corrupt', 'Unknown cel encoding')
    const raw = await gunzip(fromBase64(cel.data))
    if (raw.byteLength !== width * height * 4) throw new LoomFormatError('corrupt', 'Cel size mismatch')
    const data = new Uint32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
    sprite.cels.set(celKey(cel.layer, cel.frame), { width, height, data })
  }
  return sprite
}

async function writeReferences(sprite: Sprite): Promise<LoomReference[]> {
  const out: LoomReference[] = []
  for (const [layer, ref] of sprite.references as Map<string, Reference>) {
    const d = ref.image.data
    const raw = new Uint8Array(d.buffer, d.byteOffset, d.byteLength)
    out.push({ layer, x: ref.x, y: ref.y, scale: ref.scale, width: ref.image.width, height: ref.image.height, encoding: 'rgba-gzip-base64', data: toBase64(await gzip(raw)) })
  }
  return out
}

function isRefSize(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 8192
}

function isSize(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_SPRITE_SIZE
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)))
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  return pipe(data, new CompressionStream('gzip'))
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  try {
    return await pipe(data, new DecompressionStream('gzip'))
  } catch {
    throw new LoomFormatError('corrupt', 'Damaged cel data')
  }
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([data as BlobPart])
  const buf = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer()
  return new Uint8Array(buf)
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(text: string): Uint8Array {
  let bin: string
  try {
    bin = atob(text)
  } catch {
    throw new LoomFormatError('corrupt', 'Damaged cel data')
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
