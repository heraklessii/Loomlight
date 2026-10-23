// Editor state (Zustand). Only UI/editor values — never pixel buffers (rule 4).

import { create } from 'zustand'
import { pack, type Packed } from '@engine/color'
import { DEFAULT_TOOL_OPTIONS, MAX_BRUSH, type Tiled, type ToolId, type ToolOptions } from '@engine/tools'

export const ZOOM_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64]

export type ColorSlot = 'primary' | 'secondary'

interface EditorState {
  tool: ToolId
  options: ToolOptions
  primary: Packed
  secondary: Packed
  /** Which swatch the colour picker edits. */
  editing: ColorSlot
  /** Selected palette entry (indexed mode: the picker edits this entry) */
  paletteIndex: number | null
  /** Tiled mode: the sprite repeats around itself and drawing wraps (decision 014) */
  tiled: Tiled

  activeLayerId: string
  frameIndex: number
  /** frames selected in the timeline (Shift+click), inclusive; null = just the current frame */
  frameRange: [number, number] | null

  zoom: number
  panX: number
  panY: number
  /** Incremented to ask the canvas to fit the sprite into the viewport. */
  fitRequest: number

  showGrid: boolean
  onionSkin: boolean
  showTimeline: boolean
  playing: boolean

  setTool(tool: ToolId): void
  setOptions(patch: Partial<ToolOptions>): void
  setColor(slot: ColorSlot, color: Packed): void
  setEditing(slot: ColorSlot): void
  swapColors(): void
  setActive(layerId: string, frameIndex?: number): void
  setFrame(frameIndex: number): void
  setView(zoom: number, panX: number, panY: number): void
  requestFit(): void
  toggle(key: 'showGrid' | 'onionSkin' | 'showTimeline' | 'playing'): void
  set(patch: Partial<EditorState>): void
}

export const useEditor = create<EditorState>((set) => ({
  tool: 'pencil',
  options: { ...DEFAULT_TOOL_OPTIONS },
  // visible on the dark checkerboard from the first stroke (Endesga red / ink)
  primary: pack(0xe4, 0x3b, 0x44),
  secondary: pack(0x18, 0x14, 0x25),
  editing: 'primary',
  paletteIndex: null,
  tiled: 'none',

  activeLayerId: '',
  frameIndex: 0,
  frameRange: null,

  zoom: 8,
  panX: 0,
  panY: 0,
  fitRequest: 0,

  showGrid: true,
  onionSkin: false,
  showTimeline: true,
  playing: false,

  setTool: (tool) => set({ tool }),
  setOptions: (patch) =>
    set((s) => {
      const options = { ...s.options, ...patch }
      options.brushSize = Math.max(1, Math.min(MAX_BRUSH, Math.round(options.brushSize)))
      return { options }
    }),
  setColor: (slot, color) => set(slot === 'primary' ? { primary: color >>> 0 } : { secondary: color >>> 0 }),
  setEditing: (editing) => set({ editing }),
  swapColors: () => set((s) => ({ primary: s.secondary, secondary: s.primary })),
  setActive: (activeLayerId, frameIndex) => set(frameIndex === undefined ? { activeLayerId } : { activeLayerId, frameIndex }),
  setFrame: (frameIndex) => set({ frameIndex }),
  setView: (zoom, panX, panY) => set({ zoom, panX, panY }),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<EditorState>),
  set: (patch) => set(patch)
}))

/** Hover position in sprite pixels — kept apart so pointer moves only re-render the status bar. */
interface CursorState {
  x: number | null
  y: number | null
  color: Packed | null
  set(x: number | null, y: number | null, color: Packed | null): void
}

export const useCursor = create<CursorState>((set) => ({
  x: null,
  y: null,
  color: null,
  set: (x, y, color) => set({ x, y, color })
}))
