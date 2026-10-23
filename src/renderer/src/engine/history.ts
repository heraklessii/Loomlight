// Undo/redo bounded by bytes, not steps (rule 5, decision 004).

import { pasteRegion, type PixelImage, type Rect } from './image'
import { restoreStructure, type Sprite, type StructureSnapshot } from './sprite'

/** Where the editor was focused; restored on undo/redo so the user sees the change. */
export interface Focus {
  layerId: string
  frameIndex: number
}

export interface HistoryEntry {
  label: string
  bytes: number
  focusBefore?: Focus
  focusAfter?: Focus
  /** false for edits that do not change the saved file (selection) */
  dirty?: boolean
  undo(): void
  redo(): void
}

export const DEFAULT_HISTORY_BUDGET = 256 * 1024 * 1024

export class History {
  private done: HistoryEntry[] = []
  private undone: HistoryEntry[] = []
  private used = 0

  constructor(private budget = DEFAULT_HISTORY_BUDGET) {}

  push(entry: HistoryEntry): void {
    this.done.push(entry)
    this.used += entry.bytes
    for (const e of this.undone) this.used -= e.bytes
    this.undone = []
    while (this.used > this.budget && this.done.length > 1) {
      const dropped = this.done.shift()!
      this.used -= dropped.bytes
    }
  }

  undo(): HistoryEntry | null {
    const e = this.done.pop()
    if (!e) return null
    e.undo()
    this.undone.push(e)
    return e
  }

  redo(): HistoryEntry | null {
    const e = this.undone.pop()
    if (!e) return null
    e.redo()
    this.done.push(e)
    return e
  }

  get canUndo(): boolean {
    return this.done.length > 0
  }
  get canRedo(): boolean {
    return this.undone.length > 0
  }
  get undoLabel(): string | null {
    return this.done.at(-1)?.label ?? null
  }
  get redoLabel(): string | null {
    return this.undone.at(-1)?.label ?? null
  }
  get bytesUsed(): number {
    return this.used
  }
  get size(): number {
    return this.done.length
  }

  clear(): void {
    this.done = []
    this.undone = []
    this.used = 0
  }
}

/** A changed rectangle of one cel: before/after pixels. */
export function pixelPatch(label: string, cel: PixelImage, rect: Rect, before: Uint32Array, after: Uint32Array, focus?: Focus): HistoryEntry {
  return {
    label,
    bytes: (before.byteLength + after.byteLength) + 64,
    focusBefore: focus,
    focusAfter: focus,
    undo: () => pasteRegion(cel, rect, before),
    redo: () => pasteRegion(cel, rect, after)
  }
}

/** Layers/frames/cel-map change. Buffers are shared by reference (safe because undo is LIFO). */
export function structureChange(label: string, sprite: Sprite, before: StructureSnapshot, after: StructureSnapshot, focusBefore?: Focus, focusAfter?: Focus): HistoryEntry {
  const prev = new Set(before.cels.values())
  const newBuffers = [...after.cels.values()].filter((c) => !prev.has(c))
  const bytes = 256 * (after.layers.length + after.frames.length) + newBuffers.reduce((s, c) => s + c.data.byteLength, 0)
  return {
    label,
    bytes,
    focusBefore,
    focusAfter,
    undo: () => restoreStructure(sprite, before),
    redo: () => restoreStructure(sprite, after)
  }
}
