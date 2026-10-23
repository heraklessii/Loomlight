// User actions. UI components and commands call these; they talk to the
// document store, the editor store and the platform layer.

import { pack, type Packed } from '@engine/color'
import { encodeGif } from '@engine/gif'
import { LOOM_EXTENSION, LoomFormatError, readLoom, writeLoom } from '@engine/format'
import { contentBounds, copyRegion } from '@engine/image'
import { invertMask, rectMask, selectAll } from '@engine/selection'
import { anchorOffset, clearMasked, cropSprite, extract, flipSprite, floatingFromPixels, resizeCanvas, rotateSprite, scaleSprite, type Anchor, type Axis, type Turn } from '@engine/transform'
import { DEFAULT_PALETTE_ID, paletteColors } from '@engine/palettes'
import { encodePng } from '@engine/png'
import { upscale } from '@engine/scale'
import { buildSheet, type SheetLayout } from '@engine/sheet'
import {
  addFrame as addFrameOp,
  addLayer as addLayerOp,
  celKey,
  compositeFrame,
  compositePixel,
  createSprite,
  duplicateLayer as duplicateLayerOp,
  getCel,
  layerIndex,
  MAX_SPRITE_SIZE,
  mergeDown as mergeDownOp,
  moveFrame as moveFrameOp,
  moveLayer as moveLayerOp,
  removeFrame,
  removeLayer,
  newId,
  tagRange,
  TAG_COLORS,
  isReference,
  type ColorMode,
  type LoopDirection,
  type Sprite
} from '@engine/sprite'
import { MAX_BRUSH, type Tiled } from '@engine/tools'
import { AsepriteError, readAseprite } from '@engine/aseprite'
import { MAX_PALETTE, nearestIndex, PaletteFormatError, paletteFromPixels, paletteStrip, parsePalette, quantizeImage, remapByIndex, serializePalette, type PaletteFormat } from '@engine/palette-io'
import type { RecoveryData } from '@shared/ipc'
import { clipFromSystem, decodeImage, writeClip, type Clip } from './clipboard'
import { t, tk } from './i18n'
import { baseName, clearRecent, closeWindow, isElectron, listRecent, onSaveBeforeClose, openRecent, pickFile, saveFileAs, writeFile } from './platform'
import { commit, flushPending, getDoc, getSprite, pushPixelEdit, redo as redoDoc, setDocument, setFileInfo, structural, undo as undoDoc } from './state/document'
import { useEditor, ZOOM_STEPS } from './state/editor'
import { changeSelection, commitFloating, deleteFloating, flipFloatingAxis, floatingContent, getSelection, hasFloating, liftSelection, rotateFloatingTurn, startFloating } from './state/selection'
import { discardRecovery } from './state/autosave'
import { toast, useUi } from './state/ui'

// --- helpers

function activeLayer(sprite: Sprite) {
  const id = useEditor.getState().activeLayerId
  return sprite.layers.find((l) => l.id === id) ?? sprite.layers.at(-1)!
}

function activeFrame(sprite: Sprite) {
  return sprite.frames[Math.min(useEditor.getState().frameIndex, sprite.frames.length - 1)]
}

function layerName(sprite: Sprite): string {
  const used = new Set(sprite.layers.map((l) => l.name))
  for (let n = sprite.layers.length + 1; ; n++) {
    const name = t('Layer {n}', { n })
    if (!used.has(name)) return name
  }
}

function confirmDiscard(): boolean {
  return !getDoc().dirty || window.confirm(t('Discard unsaved changes?'))
}

function loomFilter() {
  return { name: t('Loomlight sprite'), extensions: [LOOM_EXTENSION] }
}

let currentPaletteId = DEFAULT_PALETTE_ID

// --- document

export function newSprite(width: number, height: number, background: Packed): void {
  if (!confirmDiscard()) return
  const sprite = createSprite(width, height, background, paletteColors(currentPaletteId), t('Layer {n}', { n: 1 }))
  void discardRecovery()
  setDocument(sprite, t('Untitled'), null)
  useUi.getState().openDialog(null)
}

export async function openFile(): Promise<void> {
  if (!confirmDiscard()) return
  const file = await pickFile([
    { name: t('Sprites and images'), extensions: [LOOM_EXTENSION, 'aseprite', 'ase', 'png'] },
    loomFilter(),
    { name: t('Aseprite file'), extensions: ['aseprite', 'ase'] },
    { name: t('PNG image'), extensions: ['png'] }
  ])
  if (!file) return
  await openBytes(file.name, file.path, file.bytes)
}

export async function openBytes(name: string, path: string | null, bytes: Uint8Array): Promise<void> {
  try {
    if (/\.png$/i.test(name)) {
      await importPng(name, bytes)
      return
    }
    if (/\.(aseprite|ase)$/i.test(name)) {
      await importAseprite(name, bytes)
      return
    }
    const sprite = await readLoom(bytes)
    if (sprite.palette.length === 0) sprite.palette = paletteColors(currentPaletteId)
    void discardRecovery()
    setDocument(sprite, name, path)
    snapColorsToPalette()
    if (path) void refreshRecent()
  } catch (err) {
    if (err instanceof LoomFormatError) {
      const msg = { 'not-loom': t('This is not a Loomlight file.'), 'newer-version': t('This file was made by a newer version of Loomlight.'), corrupt: t('The file is damaged and could not be opened.') }[err.code]
      toast(msg, 'error')
    } else toast(t('Could not open the file.'), 'error')
  }
}

/** .aseprite / .ase → a new unsaved .loom sprite (decision 013). */
async function importAseprite(name: string, bytes: Uint8Array): Promise<void> {
  try {
    const { sprite, warnings } = await readAseprite(bytes)
    if (sprite.palette.length === 0) sprite.palette = paletteColors(currentPaletteId)
    void discardRecovery()
    setDocument(sprite, baseName(name) + '.' + LOOM_EXTENSION, null)
    commit(true) // imported, not saved as .loom yet
    snapColorsToPalette()
    if (warnings.includes('tilemaps')) toast(t('Tilemap layers are not supported and were skipped.'))
    if (warnings.includes('blend-modes')) toast(t('Layer blend modes were imported as Normal.'))
  } catch (err) {
    toast(err instanceof AsepriteError ? t('This Aseprite file could not be read.') : t('Could not open the file.'), 'error')
  }
}

async function importPng(name: string, bytes: Uint8Array): Promise<void> {
  const img = await decodeImage(new Blob([bytes as BlobPart], { type: 'image/png' }))
  if (!img) {
    toast(t('Could not read the image.'), 'error')
    return
  }
  const { width, height, data } = img
  if (width > MAX_SPRITE_SIZE || height > MAX_SPRITE_SIZE) {
    toast(t('Images up to {max}×{max} px can be opened.', { max: MAX_SPRITE_SIZE }), 'error')
    return
  }
  const sprite = createSprite(width, height, 0, paletteColors(currentPaletteId), t('Layer {n}', { n: 1 }))
  sprite.cels.set(celKey(sprite.layers[0].id, sprite.frames[0].id), { width, height, data })
  void discardRecovery()
  setDocument(sprite, baseName(name) + '.' + LOOM_EXTENSION, null)
  commit(true) // the imported image is not saved as a sprite yet
}

/** Reopens the crash-recovery copy; it stays unsaved until the user saves. */
export async function restoreRecovery(data: RecoveryData): Promise<void> {
  try {
    const sprite = await readLoom(data.bytes)
    setDocument(sprite, data.meta.name, data.meta.path)
    commit(true)
    toast(t('Recovered {name}', { name: data.meta.name }))
  } catch {
    toast(t('The recovery copy could not be read.'), 'error')
    await discardRecovery()
  }
}

export async function save(saveAs = false): Promise<boolean> {
  flushPending()
  const sprite = getSprite()
  if (!sprite) return false
  const doc = getDoc()
  const bytes = await writeLoom(sprite)
  try {
    if (!saveAs && doc.path && isElectron) {
      await writeFile(doc.path, bytes)
      setFileInfo(doc.name, doc.path)
      await discardRecovery()
      void refreshRecent()
      toast(t('Saved'))
      return true
    }
    const name = baseName(doc.name || t('Untitled')) + '.' + LOOM_EXTENSION
    const path = await saveFileAs(name, [loomFilter()], bytes)
    if (path === null) return false
    setFileInfo(path ? path.split(/[\\/]/).pop()! : name, path || null)
    await discardRecovery()
    void refreshRecent()
    toast(t('Saved'))
    return true
  } catch {
    toast(t('Could not save the file.'), 'error')
    return false
  }
}

onSaveBeforeClose(async () => {
  if (await save()) closeWindow()
})

// --- export

export async function exportPng(scale: number): Promise<void> {
  flushPending()
  const sprite = getSprite()
  if (!sprite) return
  const buf = new Uint32Array(sprite.width * sprite.height)
  compositeFrame(sprite, useEditor.getState().frameIndex, buf)
  const png = await encodePng(upscale(buf, sprite.width, sprite.height, scale), sprite.width * scale, sprite.height * scale)
  await saveExport(baseName(getDoc().name) + '.png', 'png', png)
}

export async function exportSheet(layout: SheetLayout, scale: number, withJson: boolean, indices?: number[], suffix = ''): Promise<void> {
  flushPending()
  const sprite = getSprite()
  if (!sprite) return
  const name = baseName(getDoc().name) + suffix + '-sheet'
  const sheet = buildSheet(sprite, layout, scale, name + '.png', indices)
  const png = await encodePng(sheet.pixels, sheet.width, sheet.height)
  const path = await saveExport(name + '.png', 'png', png)
  if (path === null || !withJson) return
  const json = new TextEncoder().encode(JSON.stringify(sheet.json, null, 2))
  if (path) await writeFile(path.replace(/\.png$/i, '') + '.json', json)
  else await saveFileAs(name + '.json', [{ name: 'JSON', extensions: ['json'] }], json)
}

export async function exportGif(scale: number, indices?: number[], suffix = ''): Promise<void> {
  flushPending()
  const sprite = getSprite()
  if (!sprite) return
  const buf = new Uint32Array(sprite.width * sprite.height)
  const frames = (indices ?? sprite.frames.map((_, i) => i)).map((i) => {
    compositeFrame(sprite, i, buf)
    return { pixels: upscale(buf, sprite.width, sprite.height, scale), delayMs: sprite.frames[i].duration }
  })
  const gif = encodeGif(sprite.width * scale, sprite.height * scale, frames)
  await saveExport(baseName(getDoc().name) + suffix + '.gif', 'gif', gif)
}

async function saveExport(name: string, ext: string, bytes: Uint8Array): Promise<string | null> {
  const label = ext === 'gif' ? t('GIF animation') : t('PNG image')
  try {
    const path = await saveFileAs(name, [{ name: label, extensions: [ext] }], bytes)
    if (path !== null) {
      toast(t('Exported {name}', { name: path ? path.split(/[\\/]/).pop()! : name }))
      useUi.getState().openDialog(null)
    }
    return path
  } catch {
    toast(t('Could not save the file.'), 'error')
    return null
  }
}

// --- history

export function undo(): void {
  if (useEditor.getState().playing) useEditor.getState().set({ playing: false })
  const e = undoDoc()
  if (!e) toast(t('Nothing to undo'))
}

export function redo(): void {
  const e = redoDoc()
  if (!e) toast(t('Nothing to redo'))
}

// --- layers

export function addLayer(): void {
  structural(tk('New layer'), (sprite) => {
    const layer = addLayerOp(sprite, layerIndex(sprite, activeLayer(sprite).id) + 1, layerName(sprite))
    return { layerId: layer.id, frameIndex: useEditor.getState().frameIndex }
  })
}

export function duplicateLayer(): void {
  structural(tk('Duplicate layer'), (sprite) => {
    const src = activeLayer(sprite)
    const copy = duplicateLayerOp(sprite, src.id, t('{name} copy', { name: src.name }))
    if (copy) return { layerId: copy.id, frameIndex: useEditor.getState().frameIndex }
  })
}

export function deleteLayer(): void {
  const sprite = getSprite()
  if (!sprite) return
  if (sprite.layers.length <= 1) {
    toast(t('A sprite needs at least one layer.'))
    return
  }
  structural(tk('Delete layer'), (s) => {
    const i = layerIndex(s, activeLayer(s).id)
    removeLayer(s, s.layers[i].id)
    return { layerId: s.layers[Math.max(0, i - 1)].id, frameIndex: useEditor.getState().frameIndex }
  })
}

export function moveLayer(delta: number): void {
  const sprite = getSprite()
  if (!sprite) return
  const i = layerIndex(sprite, activeLayer(sprite).id)
  const to = i + delta
  if (to < 0 || to >= sprite.layers.length) return
  structural(tk('Move layer'), (s) => moveLayerOp(s, i, to))
}

export function mergeDown(): void {
  const sprite = getSprite()
  if (!sprite) return
  const i = layerIndex(sprite, activeLayer(sprite).id)
  if (i <= 0) {
    toast(t('There is no layer below to merge into.'))
    return
  }
  if (isReference(sprite.layers[i]) || isReference(sprite.layers[i - 1])) {
    toast(t('Reference layers cannot be merged.'))
    return
  }
  structural(tk('Merge down'), (s) => {
    const lower = mergeDownOp(s, s.layers[i].id)
    if (lower) return { layerId: lower.id, frameIndex: useEditor.getState().frameIndex }
  })
}

export function renameLayer(id: string, name: string): void {
  const trimmed = name.trim()
  const sprite = getSprite()
  const layer = sprite?.layers.find((l) => l.id === id)
  if (!layer || !trimmed || trimmed === layer.name) return
  structural(tk('Rename layer'), (s) => {
    s.layers[layerIndex(s, id)].name = trimmed
  })
}

/** Visibility, lock and opacity are layer settings: saved, but not undo steps. */
export function setLayerProp(id: string, patch: { visible?: boolean; locked?: boolean; opacity?: number }): void {
  const layer = getSprite()?.layers.find((l) => l.id === id)
  if (!layer) return
  Object.assign(layer, patch)
  commit()
}

// --- frames

export function newFrame(empty = false): void {
  structural(empty ? tk('New empty frame') : tk('New frame'), (sprite) => {
    const cur = activeFrame(sprite)
    const index = sprite.frames.indexOf(cur) + 1
    addFrameOp(sprite, index, empty ? undefined : cur.id)
    return { layerId: useEditor.getState().activeLayerId, frameIndex: index }
  })
}

export function deleteFrame(): void {
  const sprite = getSprite()
  if (!sprite) return
  if (sprite.frames.length <= 1) {
    toast(t('A sprite needs at least one frame.'))
    return
  }
  structural(tk('Delete frame'), (s) => {
    const i = useEditor.getState().frameIndex
    removeFrame(s, s.frames[i].id)
    return { layerId: useEditor.getState().activeLayerId, frameIndex: Math.min(i, s.frames.length - 1) }
  })
}

export function moveFrame(delta: number): void {
  const sprite = getSprite()
  if (!sprite) return
  const i = useEditor.getState().frameIndex
  const to = i + delta
  if (to < 0 || to >= sprite.frames.length) return
  structural(tk('Move frame'), (s) => {
    moveFrameOp(s, i, to)
    return { layerId: useEditor.getState().activeLayerId, frameIndex: to }
  })
}

export function setFrameDuration(ms: number): void {
  const sprite = getSprite()
  if (!sprite) return
  const value = Math.max(10, Math.min(60000, Math.round(ms)))
  const frame = activeFrame(sprite)
  if (frame.duration === value) return
  structural(tk('Frame duration'), (s) => {
    s.frames[s.frames.indexOf(activeFrame(s))].duration = value
  })
}

export function goToFrame(index: number | 'next' | 'prev' | 'first' | 'last'): void {
  const sprite = getSprite()
  if (!sprite) return
  const n = sprite.frames.length
  const cur = useEditor.getState().frameIndex
  const next = index === 'next' ? (cur + 1) % n : index === 'prev' ? (cur - 1 + n) % n : index === 'first' ? 0 : index === 'last' ? n - 1 : Math.max(0, Math.min(n - 1, index))
  useEditor.getState().setFrame(next)
}

export function togglePlay(): void {
  const sprite = getSprite()
  if (!sprite || sprite.frames.length < 2) {
    useEditor.getState().set({ playing: false })
    if (sprite) toast(t('Add a frame to play an animation.'))
    return
  }
  useEditor.getState().toggle('playing')
}

// --- cels and colours

/** Delete: the floating pixels, the selected pixels, or the whole cel. */
export function clearCel(): void {
  const sprite = getSprite()
  if (!sprite) return
  if (hasFloating()) {
    deleteFloating()
    return
  }
  const layer = activeLayer(sprite)
  if (layer.locked) {
    toast(t('The layer is locked.'))
    return
  }
  const cel = getCel(sprite, layer.id, activeFrame(sprite).id)
  if (!cel) return
  const sel = getSelection()
  const rect = sel ? sel.bounds : { x: 0, y: 0, w: cel.width, h: cel.height }
  const before = copyRegion(cel, rect)
  if (sel) clearMasked(cel, sel)
  else cel.data.fill(0)
  pushPixelEdit(tk('Clear'), cel, rect, before, copyRegion(cel, rect))
}

// --- selection

export function selectAllPixels(): void {
  const sprite = getSprite()
  if (sprite) changeSelection(selectAll(sprite.width, sprite.height), tk('Select all'))
}

export function deselect(): void {
  if (hasFloating()) commitFloating()
  if (getSelection()) changeSelection(null, tk('Deselect'))
}

export function invertSelection(): void {
  const sprite = getSprite()
  if (sprite) changeSelection(invertMask(getSelection(), sprite.width, sprite.height), tk('Invert selection'))
}

/**
 * Flips or rotates the floating pixels, else the selected pixels, else the
 * whole active cel (rotation turns around the centre; pixels leaving the
 * canvas are clipped). One undo step.
 */
function transformPixels(label: string, apply: () => void): void {
  if (!getSprite()) return
  if (hasFloating()) {
    apply()
    return
  }
  if (liftSelection(label, !getSelection())) {
    apply()
    commitFloating()
  }
}

export function flip(axis: Axis): void {
  transformPixels(axis === 'horizontal' ? tk('Flip horizontal') : tk('Flip vertical'), () => flipFloatingAxis(axis))
}

export function rotate(turn: Turn): void {
  const label = turn === 'cw' ? tk('Rotate 90° clockwise') : turn === 'ccw' ? tk('Rotate 90° counter-clockwise') : tk('Rotate 180°')
  transformPixels(label, () => rotateFloatingTurn(turn))
}

/** Flips every layer and frame. */
export function flipCanvas(axis: Axis): void {
  if (!getSprite()) return
  structural(axis === 'horizontal' ? tk('Flip canvas horizontal') : tk('Flip canvas vertical'), (s) => flipSprite(s, axis))
}

/** Rotates every layer and frame; 90° turns swap width and height. */
export function rotateCanvas(turn: Turn): void {
  if (!getSprite()) return
  structural(turn === 'cw' ? tk('Rotate canvas 90° clockwise') : turn === 'ccw' ? tk('Rotate canvas 90° counter-clockwise') : tk('Rotate canvas 180°'), (s) => rotateSprite(s, turn))
  useEditor.getState().requestFit()
}

// --- tags (decision 008)

/** Frames the timeline has selected (Shift+click on frame numbers), else the current frame. */
export function selectedFrameRange(): [number, number] {
  const { frameRange, frameIndex } = useEditor.getState()
  return frameRange ?? [frameIndex, frameIndex]
}

export function newTag(): void {
  const sprite = getSprite()
  if (!sprite) return
  const [a, b] = selectedFrameRange()
  const id = newId('t')
  structural(tk('New tag'), (s) => {
    s.tags.push({ id, name: t('Tag {n}', { n: s.tags.length + 1 }), from: s.frames[a].id, to: s.frames[b].id, color: TAG_COLORS[s.tags.length % TAG_COLORS.length], direction: 'forward' })
  })
  useUi.getState().editTag(id)
}

export function updateTag(id: string, patch: { name?: string; color?: string; direction?: LoopDirection; from?: number; to?: number }): void {
  const sprite = getSprite()
  const tag = sprite?.tags.find((x) => x.id === id)
  if (!sprite || !tag) return
  structural(tk('Edit tag'), (s) => {
    const tg = s.tags.find((x) => x.id === id)!
    if (patch.name !== undefined && patch.name.trim()) tg.name = patch.name.trim()
    if (patch.color) tg.color = patch.color
    if (patch.direction) tg.direction = patch.direction
    const clamp = (i: number) => Math.max(0, Math.min(s.frames.length - 1, i))
    if (patch.from !== undefined) tg.from = s.frames[clamp(patch.from)].id
    if (patch.to !== undefined) tg.to = s.frames[clamp(patch.to)].id
  })
}

export function deleteTag(id: string): void {
  structural(tk('Delete tag'), (s) => {
    s.tags = s.tags.filter((x) => x.id !== id)
  })
}

/** Jumps to a tag and selects its frames (playback then loops it). */
export function selectTag(id: string): void {
  const sprite = getSprite()
  const tag = sprite?.tags.find((x) => x.id === id)
  const r = sprite && tag ? tagRange(sprite, tag) : null
  if (!r) return
  useEditor.getState().set({ frameIndex: r[0], frameRange: r[0] === r[1] ? null : r })
}

/** Frame indices for an export: all frames, or one tag's range. */
export function exportFrames(tagId: string | null): number[] {
  const sprite = getSprite()
  if (!sprite) return []
  const tag = tagId ? sprite.tags.find((x) => x.id === tagId) : null
  const r = tag ? tagRange(sprite, tag) : null
  if (!r) return sprite.frames.map((_, i) => i)
  return Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i)
}

// --- recent files (Electron; decision 009)

export async function refreshRecent(): Promise<void> {
  useUi.getState().setRecent(await listRecent())
}

export async function openRecentFile(path: string): Promise<void> {
  if (!confirmDiscard()) return
  const file = await openRecent(path)
  if (!file) {
    toast(t('The file could not be found. It was removed from the list.'), 'error')
    await refreshRecent()
    return
  }
  await openBytes(file.name, file.path, file.bytes)
  await refreshRecent()
}

export async function clearRecentFiles(): Promise<void> {
  await clearRecent()
  await refreshRecent()
}

// --- clipboard

/** What copy takes: the floating block, the selection of the active cel, or the cel's content. */
function clipOfSelection(): Clip | null {
  const sprite = getSprite()
  if (!sprite) return null
  const fl = floatingContent()
  if (fl) return { pixels: fl.pixels, w: fl.w, h: fl.h, x: fl.x, y: fl.y }
  const cel = getCel(sprite, activeLayer(sprite).id, activeFrame(sprite).id)
  if (!cel) return null
  let mask = getSelection()
  if (!mask) {
    const b = contentBounds(cel)
    mask = b ? rectMask(sprite.width, sprite.height, b.x, b.y, b.x + b.w - 1, b.y + b.h - 1) : null
  }
  if (!mask) return null
  const f = extract(cel, mask)
  return { pixels: f.pixels, w: f.w, h: f.h, x: f.x, y: f.y }
}

export async function copy(): Promise<boolean> {
  const clip = clipOfSelection()
  if (!clip) {
    toast(t('Nothing to copy'))
    return false
  }
  await writeClip(clip)
  toast(t('Copied {w}×{h} px', { w: clip.w, h: clip.h }))
  return true
}

export async function cut(): Promise<void> {
  const clip = clipOfSelection()
  if (!clip) {
    toast(t('Nothing to copy'))
    return
  }
  await writeClip(clip)
  clearCel()
}

/** Places a clip as floating pixels: where it was copied from if it fits, else centred. */
export function pasteClip(clip: Clip | null, asNewLayer = false): void {
  const sprite = getSprite()
  if (!sprite) return
  if (!clip) {
    toast(t('Nothing to paste'))
    return
  }
  if (asNewLayer) addLayer()
  const fits = clip.x !== null && clip.y !== null && clip.x >= 0 && clip.y >= 0 && clip.x + clip.w <= sprite.width && clip.y + clip.h <= sprite.height
  const x = fits ? clip.x! : Math.floor((sprite.width - clip.w) / 2)
  const y = fits ? clip.y! : Math.floor((sprite.height - clip.h) / 2)
  let pixels = clip.pixels
  if (sprite.colorMode === 'indexed') {
    const img = { width: clip.w, height: clip.h, data: pixels.slice() }
    quantizeImage(img, sprite.palette)
    pixels = img.data
  }
  if (startFloating(floatingFromPixels(pixels, clip.w, clip.h, x, y), asNewLayer ? tk('Paste as new layer') : tk('Paste'))) {
    if (clip.w > sprite.width || clip.h > sprite.height) toast(t('The pasted image is larger than the sprite; drag it into place.'))
  }
}

export async function paste(asNewLayer = false): Promise<void> {
  pasteClip(await clipFromSystem(), asNewLayer)
}

// --- sprite size

export function resizeCanvasTo(width: number, height: number, anchor: Anchor): void {
  const sprite = getSprite()
  if (!sprite || (width === sprite.width && height === sprite.height)) return
  const { dx, dy } = anchorOffset(anchor, sprite.width, sprite.height, width, height)
  structural(tk('Canvas size'), (s) => resizeCanvas(s, width, height, dx, dy))
  useEditor.getState().requestFit()
}

export function scaleSpriteTo(width: number, height: number): void {
  const sprite = getSprite()
  if (!sprite || (width === sprite.width && height === sprite.height)) return
  structural(tk('Sprite size'), (s) => scaleSprite(s, width, height))
  useEditor.getState().requestFit()
}

export function cropToSelection(): void {
  const sel = getSelection()
  if (!sel) {
    toast(t('Select an area first.'))
    return
  }
  const r = sel.bounds
  structural(tk('Crop'), (s) => cropSprite(s, r))
  useEditor.getState().requestFit()
}

/** Colour of the visible composite at a sprite pixel. */
export function sampleColor(x: number, y: number): Packed | null {
  const sprite = getSprite()
  if (!sprite || x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return null
  return compositePixel(sprite, useEditor.getState().frameIndex, x, y)
}

/**
 * Replaces the palette as one undo step. Indexed sprites are recoloured by
 * index (palette swap); RGB sprites keep their pixels.
 */
function replacePalette(label: string, colors: Packed[]): void {
  const sprite = getSprite()
  if (!sprite || colors.length === 0) return
  structural(label, (s) => {
    if (s.colorMode === 'indexed') {
      const old = s.palette.slice()
      for (const [key, cel] of s.cels) {
        const copy = { width: cel.width, height: cel.height, data: cel.data.slice() }
        if (remapByIndex(copy, old, colors)) s.cels.set(key, copy)
      }
    }
    s.palette = colors.slice(0, MAX_PALETTE)
  })
  useEditor.getState().set({ paletteIndex: null })
}

export function loadPalette(id: string): void {
  currentPaletteId = id
  replacePalette(tk('Load palette'), paletteColors(id))
}

export function addPaletteColor(color: Packed): void {
  const sprite = getSprite()
  const c = (color | 0xff000000) >>> 0
  if (!sprite || sprite.palette.includes(c)) return
  if (sprite.palette.length >= MAX_PALETTE) {
    toast(t('A palette holds up to {n} colours.', { n: MAX_PALETTE }))
    return
  }
  structural(tk('Add palette colour'), (s) => {
    s.palette.push(c)
  })
}

/** Removes a colour; in an indexed sprite its pixels move to the nearest remaining colour. */
export function removePaletteColor(color: Packed): void {
  const sprite = getSprite()
  if (!sprite || sprite.palette.length <= 1) return
  structural(tk('Remove palette colour'), (s) => {
    s.palette = s.palette.filter((c) => c !== color)
    if (s.colorMode === 'indexed') {
      for (const [key, cel] of s.cels) {
        const copy = { width: cel.width, height: cel.height, data: cel.data.slice() }
        if (quantizeImage(copy, s.palette)) s.cels.set(key, copy)
      }
    }
  })
  useEditor.getState().set({ paletteIndex: null })
}

// --- colour mode (decision 010)

export function setColorMode(mode: ColorMode): void {
  const sprite = getSprite()
  if (!sprite || sprite.colorMode === mode) return
  if (mode === 'indexed' && sprite.palette.length === 0) {
    toast(t('Load a palette first.'))
    return
  }
  structural(mode === 'indexed' ? tk('Convert to indexed') : tk('Convert to RGB'), (s) => {
    s.colorMode = mode
    if (mode === 'indexed') {
      for (const [key, cel] of s.cels) {
        const copy = { width: cel.width, height: cel.height, data: cel.data.slice() }
        if (quantizeImage(copy, s.palette)) s.cels.set(key, copy)
      }
    }
  })
  if (mode === 'indexed') snapColorsToPalette()
  toast(mode === 'indexed' ? t('Indexed mode: every pixel is a palette colour.') : t('RGB mode'))
}

/** In indexed mode the primary/secondary colours must be palette colours. */
export function snapColorsToPalette(): void {
  const sprite = getSprite()
  if (!sprite || sprite.colorMode !== 'indexed' || sprite.palette.length === 0) return
  const ed = useEditor.getState()
  const snap = (c: Packed) => (c >>> 24 === 0 ? c : sprite.palette[nearestIndex(sprite.palette, c)])
  const primary = snap(ed.primary)
  ed.set({ primary, secondary: snap(ed.secondary), paletteIndex: sprite.palette.indexOf(primary) })
}

// --- palette files (decision 010)

export async function importPaletteFile(): Promise<void> {
  const file = await pickFile([{ name: t('Palettes'), extensions: ['gpl', 'hex', 'pal', 'png', 'txt'] }])
  if (!file) return
  try {
    let colors: Packed[]
    if (/\.png$/i.test(file.name)) {
      const img = await decodeImage(new Blob([file.bytes as BlobPart], { type: 'image/png' }))
      if (!img) throw new PaletteFormatError('bad image')
      colors = paletteFromPixels(img.data)
    } else colors = parsePalette(file.name, new TextDecoder().decode(file.bytes))
    replacePalette(tk('Import palette'), colors)
    toast(t('Loaded {n} colours from {name}', { n: colors.length, name: file.name }))
  } catch {
    toast(t('This palette file could not be read.'), 'error')
  }
}

export async function exportPaletteFile(format: PaletteFormat): Promise<void> {
  const sprite = getSprite()
  if (!sprite) return
  const name = baseName(getDoc().name || 'palette') + '-palette.' + format
  const bytes =
    format === 'png'
      ? await encodePng(paletteStrip(sprite.palette), sprite.palette.length, 1)
      : new TextEncoder().encode(serializePalette(format, sprite.palette, baseName(getDoc().name || 'Loomlight')))
  const label = { gpl: 'GIMP palette', hex: 'Lospec HEX', pal: 'JASC palette', png: 'PNG' }[format]
  const path = await saveFileAs(name, [{ name: label, extensions: [format] }], bytes)
  if (path !== null) toast(t('Exported {name}', { name: path ? path.split(/[\\/]/).pop()! : name }))
}

// --- reference layers (decision 012)

export async function addReferenceLayer(): Promise<void> {
  const sprite = getSprite()
  if (!sprite) return
  const file = await pickFile([{ name: t('Images'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }])
  if (!file) return
  const img = await decodeImage(new Blob([file.bytes as BlobPart]))
  if (!img || img.width > 8192 || img.height > 8192) {
    toast(t('Could not read the image.'), 'error')
    return
  }
  const scale = Math.min(sprite.width / img.width, sprite.height / img.height)
  structural(tk('New reference layer'), (s) => {
    const layer = addLayerOp(s, s.layers.length, baseName(file.name))
    layer.kind = 'reference'
    layer.opacity = 160
    s.references.set(layer.id, {
      image: { width: img.width, height: img.height, data: img.data },
      x: (s.width - img.width * scale) / 2,
      y: (s.height - img.height * scale) / 2,
      scale
    })
    return { layerId: layer.id, frameIndex: useEditor.getState().frameIndex }
  })
  useEditor.getState().setTool('move')
  toast(t('Reference layer added — the Move tool places it; it is never exported.'))
}

export function setReferenceScale(layerId: string, scale: number): void {
  const sprite = getSprite()
  const ref = sprite?.references.get(layerId)
  if (!sprite || !ref || !(scale > 0)) return
  structural(tk('Scale reference'), (s) => {
    const r = s.references.get(layerId)!
    // keep the centre in place
    const cx = r.x + (r.image.width * r.scale) / 2
    const cy = r.y + (r.image.height * r.scale) / 2
    r.scale = scale
    r.x = cx - (r.image.width * scale) / 2
    r.y = cy - (r.image.height * scale) / 2
  })
}

export function fitReference(layerId: string): void {
  const sprite = getSprite()
  const ref = sprite?.references.get(layerId)
  if (!sprite || !ref) return
  const scale = Math.min(sprite.width / ref.image.width, sprite.height / ref.image.height)
  structural(tk('Fit reference'), (s) => {
    const r = s.references.get(layerId)!
    r.scale = scale
    r.x = (s.width - r.image.width * scale) / 2
    r.y = (s.height - r.image.height * scale) / 2
  })
}

// --- tiled mode (decision 014)

export function setTiled(mode: Tiled): void {
  useEditor.getState().set({ tiled: mode })
}

// --- view and tools

export function zoomBy(direction: 1 | -1): void {
  const { zoom, panX, panY } = useEditor.getState()
  const el = document.querySelector<HTMLElement>('[data-viewport]')
  const cx = el ? el.clientWidth / 2 : 0
  const cy = el ? el.clientHeight / 2 : 0
  zoomAround(direction, cx, cy, zoom, panX, panY)
}

export function zoomAround(direction: 1 | -1, cx: number, cy: number, zoom: number, panX: number, panY: number): void {
  let next = zoom
  if (direction > 0) next = ZOOM_STEPS.find((z) => z > zoom + 1e-6) ?? zoom
  else next = [...ZOOM_STEPS].reverse().find((z) => z < zoom - 1e-6) ?? Math.max(0.1, zoom / 2)
  if (next === zoom) return
  const k = next / zoom
  useEditor.getState().setView(next, cx - (cx - panX) * k, cy - (cy - panY) * k)
}

export function actualSize(): void {
  const sprite = getSprite()
  const el = document.querySelector<HTMLElement>('[data-viewport]')
  if (!sprite || !el) return
  useEditor.getState().setView(1, Math.round((el.clientWidth - sprite.width) / 2), Math.round((el.clientHeight - sprite.height) / 2))
}

export function brushSize(delta: number): void {
  const { options, setOptions } = useEditor.getState()
  setOptions({ brushSize: Math.max(1, Math.min(MAX_BRUSH, options.brushSize + delta)) })
}

export const BACKGROUNDS = {
  transparent: 0,
  white: pack(255, 255, 255),
  black: pack(0, 0, 0)
} as const
