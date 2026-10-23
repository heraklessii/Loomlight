// Selection and floating pixels (decision 006). Like cels, masks and floating
// buffers live outside React; changes go through the document store so the
// canvas redraws and history records them.
//
// Floating = pixels lifted from the active cel (Move on a selection) or
// pasted. While floating, the cel shows base + floating; commit writes one
// history step (pixels + selection), cancel restores the cel.

import { copyRegion, diffBounds, pasteRegion, type PixelImage } from '@engine/image'
import { ensureCel } from '@engine/sprite'
import { type Mask, selectAll as selectAllMask, shapeToMask } from '@engine/selection'
import { useSyncExternalStore } from 'react'
import { clearMasked, extract, flipFloating, rotateFloating, scaleFloating, stamp, type Axis, type Floating, type Turn } from '@engine/transform'
import { t, tk } from '../i18n'
import { getSprite, onDocumentReplaced, pushEntry, setBeforeEditHook, touch } from './document'
import { useEditor } from './editor'
import { toast } from './ui'

interface FloatState {
  f: Floating
  /** unscaled source (current orientation); scaling always starts from it so repeated drags do not degrade */
  src: Floating
  /** keep the selection as it was on commit (whole-cel transforms without a selection) */
  keepSelection: boolean
  cel: PixelImage
  /** cel pixels under the floating block (selection cleared when lifted) */
  base: Uint32Array
  /** cel pixels before lifting / pasting */
  orig: Uint32Array
  selBefore: Mask | null
  label: string
}

let selection: Mask | null = null
let floating: FloatState | null = null

// floating start/end listeners (the context bar shows selection actions while floating)
const floatListeners = new Set<() => void>()
function setFloating(next: FloatState | null): void {
  const changed = (floating === null) !== (next === null)
  floating = next
  if (changed) for (const l of floatListeners) l()
}

export function useHasFloating(): boolean {
  return useSyncExternalStore(
    (cb) => {
      floatListeners.add(cb)
      return () => floatListeners.delete(cb)
    },
    () => floating !== null
  )
}

export function getSelection(): Mask | null {
  const sprite = getSprite()
  if (selection && (!sprite || selection.width !== sprite.width || selection.height !== sprite.height)) selection = null
  return selection
}

export function getFloating(): Floating | null {
  return floating?.f ?? null
}

export function hasFloating(): boolean {
  return floating !== null
}

/** The active cel if it can be edited; tells the user why not otherwise. */
export function editableCel(): PixelImage | null {
  const sprite = getSprite()
  if (!sprite) return null
  const ed = useEditor.getState()
  const layer = sprite.layers.find((l) => l.id === ed.activeLayerId)
  const frame = sprite.frames[ed.frameIndex]
  if (!layer || !frame) return null
  if (layer.kind === 'reference') {
    toast(t('Reference layers cannot be drawn on — use the Move tool to place them.'))
    return null
  }
  if (layer.locked) {
    toast(t('The layer is locked.'))
    return null
  }
  if (!layer.visible) {
    toast(t('The layer is hidden — show it to draw.'))
    return null
  }
  return ensureCel(sprite, layer.id, frame.id)
}

/** Replaces the selection as one undo step (does not mark the file dirty). */
export function changeSelection(next: Mask | null, label: string = tk('Select')): void {
  commitFloating()
  const before = getSelection()
  if (before === next || (!before && !next)) return
  selection = next
  pushEntry({
    label,
    bytes: (next?.data.byteLength ?? 0) + 64,
    dirty: false,
    undo: () => {
      selection = before
    },
    redo: () => {
      selection = next
    }
  })
}

/** Lifts the selected pixels of the active cel into a floating block. */
export function liftSelection(label: string = tk('Move selection'), whole = false): boolean {
  if (floating) return true
  const sprite = getSprite()
  const sel = whole && sprite ? selectAllMask(sprite.width, sprite.height) : getSelection()
  if (!sel) return false
  const cel = editableCel()
  if (!cel) return false
  const orig = cel.data.slice()
  const f = extract(cel, sel)
  clearMasked(cel, sel)
  setFloating({ f, src: f, keepSelection: whole, cel, base: cel.data.slice(), orig, selBefore: whole ? getSelection() : sel, label })
  redraw()
  return true
}

/** Starts floating pixels that are not on the cel yet (paste). */
export function startFloating(f: Floating, label: string): boolean {
  commitFloating()
  const cel = editableCel()
  if (!cel) return false
  const orig = cel.data.slice()
  setFloating({ f, src: f, keepSelection: false, cel, base: orig.slice(), orig, selBefore: getSelection(), label })
  redraw()
  return true
}

function redraw(): void {
  if (!floating) return
  floating.cel.data.set(floating.base)
  stamp(floating.cel, floating.f)
  touch()
}

export function moveFloatingTo(x: number, y: number): void {
  if (!floating || (floating.f.x === x && floating.f.y === y)) return
  floating.f = { ...floating.f, x, y }
  redraw()
}

export function nudgeFloating(dx: number, dy: number): void {
  if (floating) moveFloatingTo(floating.f.x + dx, floating.f.y + dy)
}

export function flipFloatingAxis(axis: Axis): void {
  if (!floating) return
  const { f } = floating
  floating.src = flipFloating(floating.src, axis)
  floating.f = scaleFloating(floating.src, f.w, f.h, f.x, f.y)
  redraw()
}

export function rotateFloatingTurn(turn: Turn): void {
  if (!floating) return
  const { f } = floating
  const src = rotateFloating(floating.src, turn)
  floating.src = src
  const w = turn === '180' ? f.w : f.h
  const h = turn === '180' ? f.h : f.w
  floating.f = scaleFloating(src, w, h, f.x + Math.floor((f.w - w) / 2), f.y + Math.floor((f.h - h) / 2))
  if (floating.label === 'Move selection') floating.label = tk('Transform selection')
  redraw()
}

/** Resizes the floating block (nearest neighbour from the unscaled source). */
export function setFloatingRect(x: number, y: number, w: number, h: number): void {
  if (!floating) return
  const f = floating.f
  if (f.x === x && f.y === y && f.w === w && f.h === h) return
  floating.f = scaleFloating(floating.src, Math.max(1, w), Math.max(1, h), x, y)
  if (floating.label === 'Move selection') floating.label = tk('Transform selection')
  redraw()
}

export function floatingSourceSize(): { w: number; h: number } | null {
  return floating ? { w: floating.src.w, h: floating.src.h } : null
}

/** Writes the floating pixels into the cel as one undo step (pixels + selection). */
export function commitFloating(): void {
  const fl = floating
  if (!fl) return
  setFloating(null)
  const { cel, f } = fl
  const before: PixelImage = { width: cel.width, height: cel.height, data: fl.orig }
  const rect = diffBounds(before, cel)
  const selBefore = fl.selBefore
  const selAfter = fl.keepSelection ? selBefore : shapeToMask(f.shape, f.w, f.h, f.x, f.y, cel.width, cel.height)
  selection = selAfter
  const b = rect ? copyRegion(before, rect) : null
  const a = rect ? copyRegion(cel, rect) : null
  pushEntry({
    label: fl.label,
    bytes: (b?.byteLength ?? 0) * 2 + (selAfter?.data.byteLength ?? 0) + 64,
    dirty: rect !== null,
    undo: () => {
      if (rect && b) pasteRegion(cel, rect, b)
      selection = selBefore
    },
    redo: () => {
      if (rect && a) pasteRegion(cel, rect, a)
      selection = selAfter
    }
  })
}

/** Throws the floating pixels away and restores the cel. */
export function cancelFloating(): void {
  if (!floating) return
  floating.cel.data.set(floating.orig)
  setFloating(null)
  touch()
}

/** Deletes the floating content (lifted pixels stay cleared), keeping the selection. */
export function deleteFloating(): void {
  if (!floating) return
  floating.f = { ...floating.f, pixels: new Uint32Array(floating.f.pixels.length) }
  floating.label = tk('Clear')
  redraw()
  commitFloating()
}

/** Pixels of the floating block (for copy while floating). */
export function floatingContent(): Floating | null {
  return floating ? { ...floating.f } : null
}

setBeforeEditHook(commitFloating)
onDocumentReplaced(() => {
  setFloating(null)
  selection = null
})

// switching layer or frame drops the floating pixels where they are
useEditor.subscribe((s, p) => {
  if (floating && (s.activeLayerId !== p.activeLayerId || s.frameIndex !== p.frameIndex)) commitFloating()
})
