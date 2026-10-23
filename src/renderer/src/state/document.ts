// The live sprite and its history (decision 004). Pixel buffers live here,
// outside React; components subscribe to revision counters (rule 4):
//   revision — bumps on every pixel change (canvas, preview)
//   version  — bumps on committed changes (timeline, title, dirty flag)

import { useSyncExternalStore } from 'react'
import { History, pixelPatch, structureChange, type Focus, type HistoryEntry } from '@engine/history'
import type { PixelImage, Rect } from '@engine/image'
import { snapshotStructure, type Sprite, type StructureSnapshot } from '@engine/sprite'
import { useEditor } from './editor'

interface DocState {
  sprite: Sprite | null
  name: string
  path: string | null
  dirty: boolean
  revision: number
  version: number
}

const state: DocState = { sprite: null, name: '', path: null, dirty: false, revision: 0, version: 0 }
const history = new History()
const listeners = new Set<() => void>()

// Hooks for the selection module (avoids an import cycle):
//   beforeEdit — commits floating pixels before undo/redo/structural edits
//   onReplace  — clears selection state when another document is opened
let beforeEdit: (() => void) | null = null
const replaceHooks: Array<() => void> = []

export function setBeforeEditHook(fn: () => void): void {
  beforeEdit = fn
}

export function onDocumentReplaced(fn: () => void): void {
  replaceHooks.push(fn)
}

/** Commits pending floating pixels (paste / lifted selection). */
export function flushPending(): void {
  beforeEdit?.()
}

function emit(): void {
  for (const l of listeners) l()
}

export function subscribeDoc(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSprite(): Sprite | null {
  return state.sprite
}

export function getDoc(): Readonly<DocState> {
  return state
}

export function getHistory(): History {
  return history
}

/** Replaces the open document (new / open / import). */
export function setDocument(sprite: Sprite, name: string, path: string | null): void {
  state.sprite = sprite
  state.name = name
  state.path = path
  state.dirty = false
  history.clear()
  for (const h of replaceHooks) h()
  useEditor.getState().set({ activeLayerId: sprite.layers.at(-1)!.id, frameIndex: 0, frameRange: null, playing: false })
  useEditor.getState().requestFit()
  commit(false)
}

export function closeDocument(): void {
  state.sprite = null
  history.clear()
  for (const h of replaceHooks) h()
  commit(false)
}

export function setFileInfo(name: string, path: string | null): void {
  state.name = name
  state.path = path
  state.dirty = false
  commit(false)
}

/** Pixels changed but the change is not committed yet (stroke in progress). */
export function touch(): void {
  state.revision++
  emit()
}

/** A committed change: redraw everything; `dirty` marks unsaved changes. */
export function commit(dirty = true): void {
  if (dirty) state.dirty = true
  state.revision++
  state.version++
  emit()
}

export function currentFocus(): Focus {
  const e = useEditor.getState()
  return { layerId: e.activeLayerId, frameIndex: e.frameIndex }
}

/** `label` is an English source string (tk); it is translated when shown. */
export function pushPixelEdit(label: string, cel: PixelImage, rect: Rect, before: Uint32Array, after: Uint32Array): void {
  history.push(pixelPatch(label, cel, rect, before, after, currentFocus()))
  commit()
}

/**
 * Runs a structural edit (layers, frames, cel map) as one undo step.
 * `fn` may return the focus to show afterwards.
 */
export function structural(label: string, fn: (sprite: Sprite) => Focus | void): boolean {
  flushPending()
  const sprite = state.sprite
  if (!sprite) return false
  const focusBefore = currentFocus()
  const before = snapshotStructure(sprite)
  const focusAfter = fn(sprite) ?? currentFocus()
  const after = snapshotStructure(sprite)
  history.push(structureChange(label, sprite, before, after, focusBefore, focusAfter))
  applyFocus(focusAfter)
  commit()
  return true
}

function applyFocus(f: Focus | undefined): void {
  const sprite = state.sprite
  if (!f || !sprite) return
  const layerId = sprite.layers.some((l) => l.id === f.layerId) ? f.layerId : sprite.layers.at(-1)!.id
  const frameIndex = Math.max(0, Math.min(sprite.frames.length - 1, f.frameIndex))
  useEditor.getState().setActive(layerId, frameIndex)
}

/**
 * Finishes a structural edit that was applied live (dragging a reference
 * layer): `before` was taken when the gesture started.
 */
export function structuralFrom(label: string, before: StructureSnapshot, focus?: Focus): void {
  const sprite = state.sprite
  if (!sprite) return
  history.push(structureChange(label, sprite, before, snapshotStructure(sprite), focus ?? currentFocus(), focus ?? currentFocus()))
  commit()
}

/** Pushes a ready-made entry (selection changes, floating commits). */
export function pushEntry(entry: HistoryEntry): void {
  entry.focusBefore ??= currentFocus()
  entry.focusAfter ??= currentFocus()
  history.push(entry)
  commit(entry.dirty !== false)
}

export function undo(): HistoryEntry | null {
  flushPending()
  const e = history.undo()
  if (e) {
    applyFocus(e.focusBefore)
    commit(e.dirty !== false)
  }
  return e
}

export function redo(): HistoryEntry | null {
  flushPending()
  const e = history.redo()
  if (e) {
    applyFocus(e.focusAfter)
    commit(e.dirty !== false)
  }
  return e
}

/** Re-renders on every pixel change. */
export function useDocRevision(): number {
  return useSyncExternalStore(subscribeDoc, () => state.revision)
}

/** Re-renders on committed changes only. */
export function useDocVersion(): number {
  return useSyncExternalStore(subscribeDoc, () => state.version)
}
