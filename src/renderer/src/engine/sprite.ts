// Sprite document model (decision 004): layers × frames, one full-size cel
// per (layer, frame) pair; an absent cel is empty.

import { blendOver, type Packed } from './color'
import { cloneImage, createImage, type PixelImage } from './image'

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  /** 0–255 */
  opacity: number
  /** 'reference': an image to trace over — shown, never exported or drawn on (decision 012) */
  kind?: 'pixel' | 'reference'
}

/** Image of a reference layer: any size, placed in sprite pixels, frame-independent. */
export interface Reference {
  image: PixelImage
  x: number
  y: number
  /** sprite pixels per image pixel */
  scale: number
}

/** 'indexed': every pixel is a palette colour; palette edits recolour the sprite (decision 010). */
export type ColorMode = 'rgba' | 'indexed'

export interface Frame {
  id: string
  /** milliseconds */
  duration: number
}

export type LoopDirection = 'forward' | 'reverse' | 'pingpong'

/** A named frame range ("walk", "idle"), decision 008. Endpoints are frame ids so inserts keep them. */
export interface Tag {
  id: string
  name: string
  from: string
  to: string
  /** #rrggbb — a UI mark, not artwork */
  color: string
  direction: LoopDirection
}

export const TAG_COLORS = ['#e8a33d', '#5aa9e6', '#7bc96f', '#e86a8e', '#a98ae6', '#e6d35a']

export interface Sprite {
  width: number
  height: number
  /** bottom → top */
  layers: Layer[]
  /** left → right */
  frames: Frame[]
  cels: Map<string, PixelImage>
  palette: Packed[]
  tags: Tag[]
  colorMode: ColorMode
  /** reference layer images by layer id */
  references: Map<string, Reference>
}

export const DEFAULT_FRAME_MS = 100
export const MAX_SPRITE_SIZE = 2048

let idCounter = 0
export function newId(prefix: string): string {
  idCounter++
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`
}

export function celKey(layerId: string, frameId: string): string {
  return `${layerId}:${frameId}`
}

export function createSprite(width: number, height: number, background: Packed, palette: Packed[], layerName: string): Sprite {
  const layer: Layer = { id: newId('l'), name: layerName, visible: true, locked: false, opacity: 255 }
  const frame: Frame = { id: newId('f'), duration: DEFAULT_FRAME_MS }
  const sprite: Sprite = { width, height, layers: [layer], frames: [frame], cels: new Map(), palette: palette.slice(), tags: [], colorMode: 'rgba', references: new Map() }
  if (background !== 0) sprite.cels.set(celKey(layer.id, frame.id), createImage(width, height, background))
  return sprite
}

export function getCel(sprite: Sprite, layerId: string, frameId: string): PixelImage | undefined {
  return sprite.cels.get(celKey(layerId, frameId))
}

export function ensureCel(sprite: Sprite, layerId: string, frameId: string): PixelImage {
  const key = celKey(layerId, frameId)
  let cel = sprite.cels.get(key)
  if (!cel) {
    cel = createImage(sprite.width, sprite.height)
    sprite.cels.set(key, cel)
  }
  return cel
}

export function layerIndex(sprite: Sprite, id: string): number {
  return sprite.layers.findIndex((l) => l.id === id)
}

/** Inserts a new empty layer at `index` (0 = bottom). */
export function addLayer(sprite: Sprite, index: number, name: string): Layer {
  const layer: Layer = { id: newId('l'), name, visible: true, locked: false, opacity: 255 }
  sprite.layers.splice(clampIndex(index, sprite.layers.length), 0, layer)
  return layer
}

export function duplicateLayer(sprite: Sprite, id: string, name: string): Layer | null {
  const i = layerIndex(sprite, id)
  if (i < 0) return null
  const src = sprite.layers[i]
  const copy: Layer = { ...src, id: newId('l'), name }
  sprite.layers.splice(i + 1, 0, copy)
  const ref = sprite.references.get(src.id)
  if (ref) sprite.references.set(copy.id, { ...ref })
  for (const f of sprite.frames) {
    const cel = getCel(sprite, src.id, f.id)
    if (cel) sprite.cels.set(celKey(copy.id, f.id), cloneImage(cel))
  }
  return copy
}

export function removeLayer(sprite: Sprite, id: string): boolean {
  const i = layerIndex(sprite, id)
  if (i < 0 || sprite.layers.length <= 1) return false
  sprite.layers.splice(i, 1)
  for (const f of sprite.frames) sprite.cels.delete(celKey(id, f.id))
  sprite.references.delete(id)
  return true
}

export function moveLayer(sprite: Sprite, from: number, to: number): void {
  const [layer] = sprite.layers.splice(from, 1)
  sprite.layers.splice(clampIndex(to, sprite.layers.length), 0, layer)
}

/** Merges the layer into the one below it. Returns the lower layer. */
export function mergeDown(sprite: Sprite, id: string): Layer | null {
  const i = layerIndex(sprite, id)
  if (i <= 0) return null
  const upper = sprite.layers[i]
  const lower = sprite.layers[i - 1]
  if (isReference(upper) || isReference(lower)) return null
  for (const f of sprite.frames) {
    const top = getCel(sprite, upper.id, f.id)
    if (!top) continue
    const base = sprite.cels.has(celKey(lower.id, f.id)) ? cloneImage(getCel(sprite, lower.id, f.id)!) : createImage(sprite.width, sprite.height)
    if (upper.visible) {
      for (let p = 0; p < base.data.length; p++) {
        const s = top.data[p]
        if (s !== 0) base.data[p] = blendOver(base.data[p], s, upper.opacity)
      }
    }
    sprite.cels.set(celKey(lower.id, f.id), base)
  }
  removeLayer(sprite, upper.id)
  return lower
}

/** Inserts a frame at `index`; copies cels of `copyFrom` when given. */
export function addFrame(sprite: Sprite, index: number, copyFrom?: string): Frame {
  const src = copyFrom ? sprite.frames.find((f) => f.id === copyFrom) : undefined
  const frame: Frame = { id: newId('f'), duration: src?.duration ?? DEFAULT_FRAME_MS }
  sprite.frames.splice(clampIndex(index, sprite.frames.length), 0, frame)
  if (src) {
    for (const l of sprite.layers) {
      const cel = getCel(sprite, l.id, src.id)
      if (cel) sprite.cels.set(celKey(l.id, frame.id), cloneImage(cel))
    }
  }
  return frame
}

export function removeFrame(sprite: Sprite, id: string): boolean {
  const i = sprite.frames.findIndex((f) => f.id === id)
  if (i < 0 || sprite.frames.length <= 1) return false
  // tags that end on this frame shrink inward; one-frame tags on it disappear
  sprite.tags = sprite.tags.flatMap((tag) => {
    const r = tagRange(sprite, tag)
    if (!r || (tag.from !== id && tag.to !== id)) return [tag]
    if (r[0] === r[1]) return []
    const from = r[0] === i ? sprite.frames[i + 1].id : sprite.frames[r[0]].id
    const to = r[1] === i ? sprite.frames[i - 1].id : sprite.frames[r[1]].id
    return [{ ...tag, from, to }]
  })
  sprite.frames.splice(i, 1)
  for (const l of sprite.layers) sprite.cels.delete(celKey(l.id, id))
  return true
}

export function moveFrame(sprite: Sprite, from: number, to: number): void {
  const [frame] = sprite.frames.splice(from, 1)
  sprite.frames.splice(clampIndex(to, sprite.frames.length), 0, frame)
}

export function isReference(layer: Layer | undefined): boolean {
  return layer?.kind === 'reference'
}

/**
 * Composites visible pixel layers [from, to) of one frame into `out`
 * (width × height). Reference layers are never part of the composite.
 */
export function compositeFrame(sprite: Sprite, frameIndex: number, out: Uint32Array, from = 0, to = sprite.layers.length): void {
  out.fill(0)
  const frame = sprite.frames[frameIndex]
  if (!frame) return
  for (let li = from; li < to; li++) {
    const layer = sprite.layers[li]
    if (!layer.visible || layer.opacity === 0 || isReference(layer)) continue
    const cel = getCel(sprite, layer.id, frame.id)
    if (!cel) continue
    const src = cel.data
    const op = layer.opacity
    for (let i = 0; i < src.length; i++) {
      const s = src[i]
      if (s === 0) continue
      if (op === 255 && s >>> 24 === 255) out[i] = s
      else out[i] = blendOver(out[i], s, op)
    }
  }
}

/** Composite colour of one pixel (status bar, eyedropper) without compositing the frame. */
export function compositePixel(sprite: Sprite, frameIndex: number, x: number, y: number): Packed {
  const frame = sprite.frames[frameIndex]
  if (!frame || x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return 0
  const i = y * sprite.width + x
  let out: Packed = 0
  for (const layer of sprite.layers) {
    if (!layer.visible || layer.opacity === 0 || isReference(layer)) continue
    const s = getCel(sprite, layer.id, frame.id)?.data[i] ?? 0
    if (s !== 0) out = layer.opacity === 255 && s >>> 24 === 255 ? s : blendOver(out, s, layer.opacity)
  }
  return out
}

/** [first, last] frame index of a tag (always ordered), or null if an endpoint is gone. */
export function tagRange(sprite: Sprite, tag: Tag): [number, number] | null {
  const a = sprite.frames.findIndex((f) => f.id === tag.from)
  const b = sprite.frames.findIndex((f) => f.id === tag.to)
  if (a < 0 || b < 0) return null
  return a <= b ? [a, b] : [b, a]
}

/** The first tag containing a frame index. */
export function tagAt(sprite: Sprite, index: number): Tag | null {
  for (const tag of sprite.tags) {
    const r = tagRange(sprite, tag)
    if (r && index >= r[0] && index <= r[1]) return tag
  }
  return null
}

/**
 * Next frame during playback: loops the tag under the current frame with its
 * direction, or all frames forward. `state.dir` carries ping-pong direction.
 */
export function nextPlaybackFrame(sprite: Sprite, current: number, state: { dir: 1 | -1 }): number {
  const tag = tagAt(sprite, current)
  const [a, b] = (tag && tagRange(sprite, tag)) ?? [0, sprite.frames.length - 1]
  if (a === b) return a
  const direction = tag?.direction ?? 'forward'
  if (direction === 'forward') return current + 1 > b ? a : current + 1
  if (direction === 'reverse') return current - 1 < a ? b : current - 1
  let next = current + state.dir
  if (next > b || next < a) {
    state.dir = state.dir === 1 ? -1 : 1
    next = current + state.dir
  }
  return next
}

export function totalDuration(sprite: Sprite): number {
  return sprite.frames.reduce((sum, f) => sum + f.duration, 0)
}

export function nextLayerName(sprite: Sprite, base: string): string {
  const used = new Set(sprite.layers.map((l) => l.name))
  for (let n = sprite.layers.length + 1; ; n++) {
    const name = `${base} ${n}`
    if (!used.has(name)) return name
  }
}

// --- structure snapshots for history (decision 004)

export interface StructureSnapshot {
  width: number
  height: number
  layers: Layer[]
  frames: Frame[]
  cels: Map<string, PixelImage>
  tags: Tag[]
  palette: Packed[]
  colorMode: ColorMode
  references: Map<string, Reference>
}

export function snapshotStructure(sprite: Sprite): StructureSnapshot {
  return {
    width: sprite.width,
    height: sprite.height,
    layers: sprite.layers.map((l) => ({ ...l })),
    frames: sprite.frames.map((f) => ({ ...f })),
    cels: new Map(sprite.cels),
    tags: sprite.tags.map((t) => ({ ...t })),
    palette: sprite.palette.slice(),
    colorMode: sprite.colorMode,
    references: new Map([...sprite.references].map(([k, r]) => [k, { ...r }]))
  }
}

export function restoreStructure(sprite: Sprite, snap: StructureSnapshot): void {
  sprite.width = snap.width
  sprite.height = snap.height
  sprite.layers = snap.layers.map((l) => ({ ...l }))
  sprite.frames = snap.frames.map((f) => ({ ...f }))
  sprite.cels = new Map(snap.cels)
  sprite.tags = snap.tags.map((t) => ({ ...t }))
  sprite.palette = snap.palette.slice()
  sprite.colorMode = snap.colorMode
  sprite.references = new Map([...snap.references].map(([k, r]) => [k, { ...r }]))
}

function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(length, i))
}
