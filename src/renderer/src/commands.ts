// The single command list (rule 7): menus, the command palette and keyboard
// shortcuts are all driven from here. Labels are English source strings
// marked with tk() and translated at render time.

import * as A from './actions'
import { tk } from './i18n'
import { getHistory, getSprite } from './state/document'
import { useEditor } from './state/editor'
import { getSelection, hasFloating } from './state/selection'
import { startTour } from './state/tour'
import { useSettings } from './state/settings'
import { useUi } from './state/ui'
import type { ToolId } from '@engine/tools'

export type MenuId = 'file' | 'edit' | 'select' | 'sprite' | 'layer' | 'frame' | 'view' | 'tools' | 'help'

export interface Command {
  id: string
  label: string
  menu: MenuId
  /** Shortcut specs, e.g. 'Ctrl+Shift+N', 'Alt+N', ',', 'Shift+U'. The first is shown. */
  keys?: string[]
  run(): void
  /** Needs an open sprite. */
  needsSprite?: boolean
  enabled?(): boolean
  checked?(): boolean
  /** Starts a separator group in menus. */
  separator?: boolean
  /** Shortcut is shown but left to the browser (paste must arrive as a paste event). */
  native?: boolean
}

const tool = (id: ToolId) => () => useEditor.getState().setTool(id)
const ed = () => useEditor.getState()

export const MENUS: Array<{ id: MenuId; label: string }> = [
  { id: 'file', label: tk('File') },
  { id: 'edit', label: tk('Edit') },
  { id: 'select', label: tk('Select') },
  { id: 'sprite', label: tk('Sprite') },
  { id: 'layer', label: tk('Layer') },
  { id: 'frame', label: tk('Frame') },
  { id: 'view', label: tk('View') },
  { id: 'help', label: tk('Help') }
]

export const COMMANDS: Command[] = [
  // file
  { id: 'file.new', label: tk('New sprite…'), menu: 'file', keys: ['Ctrl+N'], run: () => useUi.getState().openDialog('new') },
  { id: 'file.open', label: tk('Open…'), menu: 'file', keys: ['Ctrl+O'], run: () => void A.openFile() },
  { id: 'file.save', label: tk('Save'), menu: 'file', keys: ['Ctrl+S'], needsSprite: true, run: () => void A.save(), separator: true },
  { id: 'file.saveAs', label: tk('Save as…'), menu: 'file', keys: ['Ctrl+Shift+S'], needsSprite: true, run: () => void A.save(true) },
  { id: 'file.export', label: tk('Export…'), menu: 'file', keys: ['Ctrl+Shift+E'], needsSprite: true, run: () => useUi.getState().openDialog('export'), separator: true },

  // edit
  { id: 'edit.undo', label: tk('Undo'), menu: 'edit', keys: ['Ctrl+Z'], needsSprite: true, run: A.undo, enabled: () => getHistory().canUndo },
  { id: 'edit.redo', label: tk('Redo'), menu: 'edit', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], needsSprite: true, run: A.redo, enabled: () => getHistory().canRedo },
  { id: 'edit.cut', label: tk('Cut'), menu: 'edit', keys: ['Ctrl+X'], needsSprite: true, run: () => void A.cut(), separator: true },
  { id: 'edit.copy', label: tk('Copy'), menu: 'edit', keys: ['Ctrl+C'], needsSprite: true, run: () => void A.copy() },
  { id: 'edit.paste', label: tk('Paste'), menu: 'edit', keys: ['Ctrl+V'], needsSprite: true, native: true, run: () => void A.paste(false) },
  { id: 'edit.pasteLayer', label: tk('Paste as new layer'), menu: 'edit', keys: ['Ctrl+Shift+V'], needsSprite: true, native: true, run: () => void A.paste(true) },
  { id: 'edit.clear', label: tk('Delete pixels'), menu: 'edit', keys: ['Delete', 'Backspace'], needsSprite: true, run: A.clearCel },
  { id: 'edit.flipH', label: tk('Flip horizontal'), menu: 'edit', keys: ['Shift+H'], needsSprite: true, run: () => A.flip('horizontal'), separator: true },
  { id: 'edit.flipV', label: tk('Flip vertical'), menu: 'edit', keys: ['Shift+V'], needsSprite: true, run: () => A.flip('vertical') },
  { id: 'edit.rotCW', label: tk('Rotate 90° clockwise'), menu: 'edit', needsSprite: true, run: () => A.rotate('cw') },
  { id: 'edit.rotCCW', label: tk('Rotate 90° counter-clockwise'), menu: 'edit', needsSprite: true, run: () => A.rotate('ccw') },
  { id: 'edit.rot180', label: tk('Rotate 180°'), menu: 'edit', needsSprite: true, run: () => A.rotate('180') },
  { id: 'edit.swap', label: tk('Swap primary and secondary colour'), menu: 'edit', keys: ['X'], run: () => ed().swapColors() },
  { id: 'edit.brushUp', label: tk('Increase brush size'), menu: 'edit', keys: [']'], run: () => A.brushSize(1), separator: true },
  { id: 'edit.brushDown', label: tk('Decrease brush size'), menu: 'edit', keys: ['['], run: () => A.brushSize(-1) },
  { id: 'edit.pixelPerfect', label: tk('Pixel-perfect strokes'), menu: 'edit', keys: ['Shift+P'], run: () => ed().setOptions({ pixelPerfect: !ed().options.pixelPerfect }), checked: () => ed().options.pixelPerfect },
  {
    id: 'edit.mirror',
    label: tk('Mirror horizontally'),
    menu: 'edit',
    keys: ['Shift+M'],
    run: () => {
      const m = ed().options.mirror
      ed().setOptions({ mirror: m === 'none' ? 'horizontal' : m === 'horizontal' ? 'none' : m === 'both' ? 'vertical' : 'both' })
    },
    checked: () => ed().options.mirror === 'horizontal' || ed().options.mirror === 'both'
  },

  // select
  { id: 'select.all', label: tk('Select all'), menu: 'select', keys: ['Ctrl+A'], needsSprite: true, run: A.selectAllPixels },
  { id: 'select.none', label: tk('Deselect'), menu: 'select', keys: ['Ctrl+D'], needsSprite: true, run: A.deselect, enabled: () => !!getSelection() || hasFloating() },
  { id: 'select.invert', label: tk('Invert selection'), menu: 'select', keys: ['Ctrl+Shift+I'], needsSprite: true, run: A.invertSelection },
  { id: 'select.marquee', label: tk('Rectangle select'), menu: 'select', keys: ['M'], run: tool('marquee'), separator: true },
  { id: 'select.lasso', label: tk('Lasso select'), menu: 'select', keys: ['Q'], run: tool('lasso') },
  { id: 'select.wand', label: tk('Magic wand'), menu: 'select', keys: ['W'], run: tool('wand') },

  // sprite
  { id: 'sprite.canvas', label: tk('Canvas size…'), menu: 'sprite', keys: ['Ctrl+Alt+C'], needsSprite: true, run: () => useUi.getState().openDialog('canvasSize') },
  { id: 'sprite.size', label: tk('Sprite size…'), menu: 'sprite', keys: ['Ctrl+Alt+I'], needsSprite: true, run: () => useUi.getState().openDialog('spriteSize') },
  { id: 'sprite.crop', label: tk('Crop to selection'), menu: 'sprite', needsSprite: true, run: A.cropToSelection, enabled: () => !!getSelection(), separator: true },
  { id: 'sprite.flipH', label: tk('Flip canvas horizontal'), menu: 'sprite', needsSprite: true, run: () => A.flipCanvas('horizontal'), separator: true },
  { id: 'sprite.flipV', label: tk('Flip canvas vertical'), menu: 'sprite', needsSprite: true, run: () => A.flipCanvas('vertical') },
  { id: 'sprite.rotCW', label: tk('Rotate canvas 90° clockwise'), menu: 'sprite', needsSprite: true, run: () => A.rotateCanvas('cw') },
  { id: 'sprite.rotCCW', label: tk('Rotate canvas 90° counter-clockwise'), menu: 'sprite', needsSprite: true, run: () => A.rotateCanvas('ccw') },
  { id: 'sprite.rot180', label: tk('Rotate canvas 180°'), menu: 'sprite', needsSprite: true, run: () => A.rotateCanvas('180') },
  { id: 'sprite.rgb', label: tk('Colour mode: RGB'), menu: 'sprite', needsSprite: true, run: () => A.setColorMode('rgba'), checked: () => getSprite()?.colorMode === 'rgba', separator: true },
  { id: 'sprite.indexed', label: tk('Colour mode: Indexed'), menu: 'sprite', needsSprite: true, run: () => A.setColorMode('indexed'), checked: () => getSprite()?.colorMode === 'indexed' },
  { id: 'sprite.importPalette', label: tk('Import palette…'), menu: 'sprite', needsSprite: true, run: () => void A.importPaletteFile(), separator: true },
  { id: 'sprite.exportPalette', label: tk('Export palette (.gpl)…'), menu: 'sprite', needsSprite: true, run: () => void A.exportPaletteFile('gpl') },

  // layer
  { id: 'layer.new', label: tk('New layer'), menu: 'layer', keys: ['Ctrl+Shift+N'], needsSprite: true, run: A.addLayer },
  { id: 'layer.reference', label: tk('New reference layer…'), menu: 'layer', needsSprite: true, run: () => void A.addReferenceLayer() },
  { id: 'layer.duplicate', label: tk('Duplicate layer'), menu: 'layer', needsSprite: true, run: A.duplicateLayer },
  { id: 'layer.delete', label: tk('Delete layer'), menu: 'layer', needsSprite: true, run: A.deleteLayer },
  { id: 'layer.rename', label: tk('Rename layer'), menu: 'layer', keys: ['F2'], needsSprite: true, run: () => useUi.getState().setRenaming(ed().activeLayerId), separator: true },
  { id: 'layer.up', label: tk('Move layer up'), menu: 'layer', needsSprite: true, run: () => A.moveLayer(1) },
  { id: 'layer.down', label: tk('Move layer down'), menu: 'layer', needsSprite: true, run: () => A.moveLayer(-1) },
  { id: 'layer.merge', label: tk('Merge down'), menu: 'layer', keys: ['Ctrl+E'], needsSprite: true, run: A.mergeDown, separator: true },

  // frame
  { id: 'frame.new', label: tk('New frame'), menu: 'frame', keys: ['Alt+N'], needsSprite: true, run: () => A.newFrame(false) },
  { id: 'frame.newEmpty', label: tk('New empty frame'), menu: 'frame', keys: ['Alt+B'], needsSprite: true, run: () => A.newFrame(true) },
  { id: 'frame.delete', label: tk('Delete frame'), menu: 'frame', keys: ['Alt+C'], needsSprite: true, run: A.deleteFrame },
  { id: 'frame.left', label: tk('Move frame left'), menu: 'frame', needsSprite: true, run: () => A.moveFrame(-1), separator: true },
  { id: 'frame.right', label: tk('Move frame right'), menu: 'frame', needsSprite: true, run: () => A.moveFrame(1) },
  { id: 'frame.prev', label: tk('Previous frame'), menu: 'frame', keys: [','], needsSprite: true, run: () => A.goToFrame('prev'), separator: true },
  { id: 'frame.next', label: tk('Next frame'), menu: 'frame', keys: ['.'], needsSprite: true, run: () => A.goToFrame('next') },
  { id: 'frame.first', label: tk('First frame'), menu: 'frame', keys: ['Home'], needsSprite: true, run: () => A.goToFrame('first') },
  { id: 'frame.last', label: tk('Last frame'), menu: 'frame', keys: ['End'], needsSprite: true, run: () => A.goToFrame('last') },
  { id: 'frame.play', label: tk('Play / stop'), menu: 'frame', keys: ['Enter'], needsSprite: true, run: A.togglePlay, checked: () => ed().playing, separator: true },
  { id: 'frame.onion', label: tk('Onion skin'), menu: 'frame', keys: ['F3'], run: () => ed().toggle('onionSkin'), checked: () => ed().onionSkin },
  { id: 'frame.newTag', label: tk('New tag from selected frames'), menu: 'frame', needsSprite: true, run: A.newTag, separator: true },

  // view
  { id: 'view.zoomIn', label: tk('Zoom in'), menu: 'view', keys: ['+', '='], needsSprite: true, run: () => A.zoomBy(1) },
  { id: 'view.zoomOut', label: tk('Zoom out'), menu: 'view', keys: ['-'], needsSprite: true, run: () => A.zoomBy(-1) },
  { id: 'view.fit', label: tk('Fit on screen'), menu: 'view', keys: ['Ctrl+0'], needsSprite: true, run: () => ed().requestFit() },
  { id: 'view.actual', label: tk('Actual size'), menu: 'view', keys: ['Ctrl+1'], needsSprite: true, run: A.actualSize },
  { id: 'view.grid', label: tk('Pixel grid'), menu: 'view', keys: ["Ctrl+'"], run: () => ed().toggle('showGrid'), checked: () => ed().showGrid, separator: true },
  { id: 'view.timeline', label: tk('Timeline'), menu: 'view', keys: ['Tab'], run: () => ed().toggle('showTimeline'), checked: () => ed().showTimeline },
  { id: 'view.tiledOff', label: tk('Tiled mode: off'), menu: 'view', run: () => A.setTiled('none'), checked: () => ed().tiled === 'none', separator: true },
  { id: 'view.tiledBoth', label: tk('Tiled mode: both axes'), menu: 'view', run: () => A.setTiled('both'), checked: () => ed().tiled === 'both' },
  { id: 'view.tiledX', label: tk('Tiled mode: horizontal'), menu: 'view', run: () => A.setTiled('x'), checked: () => ed().tiled === 'x' },
  { id: 'view.tiledY', label: tk('Tiled mode: vertical'), menu: 'view', run: () => A.setTiled('y'), checked: () => ed().tiled === 'y' },
  { id: 'view.palette', label: tk('Command palette'), menu: 'view', keys: ['Ctrl+K'], run: () => useUi.getState().setPaletteOpen(true), separator: true },

  // tools (palette + keys only)
  { id: 'tool.pencil', label: tk('Pencil'), menu: 'tools', keys: ['B'], run: tool('pencil') },
  { id: 'tool.eraser', label: tk('Eraser'), menu: 'tools', keys: ['E'], run: tool('eraser') },
  { id: 'tool.bucket', label: tk('Paint bucket'), menu: 'tools', keys: ['G'], run: tool('bucket') },
  { id: 'tool.eyedropper', label: tk('Eyedropper'), menu: 'tools', keys: ['I'], run: tool('eyedropper') },
  { id: 'tool.line', label: tk('Line'), menu: 'tools', keys: ['L'], run: tool('line') },
  { id: 'tool.rectangle', label: tk('Rectangle'), menu: 'tools', keys: ['U'], run: tool('rectangle') },
  { id: 'tool.ellipse', label: tk('Ellipse'), menu: 'tools', keys: ['Shift+U'], run: tool('ellipse') },
  { id: 'tool.move', label: tk('Move'), menu: 'tools', keys: ['V'], run: tool('move') },
  { id: 'tool.hand', label: tk('Hand'), menu: 'tools', keys: ['H'], run: tool('hand') },

  // help
  { id: 'help.palette', label: tk('All commands and shortcuts'), menu: 'help', run: () => useUi.getState().setPaletteOpen(true) },
  { id: 'help.tour', label: tk('Show the tour'), menu: 'help', run: () => startTour() },
  { id: 'help.settings', label: tk('Settings…'), menu: 'help', keys: ['Ctrl+,'], run: () => useUi.getState().openDialog('settings'), separator: true },
  { id: 'help.about', label: tk('About Loomlight'), menu: 'help', run: () => useUi.getState().openDialog('about') }
]

export function isEnabled(cmd: Command): boolean {
  if (cmd.needsSprite && !getSprite()) return false
  return cmd.enabled ? cmd.enabled() : true
}

// --- shortcuts

interface KeySpec {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

function parseSpec(spec: string): KeySpec {
  const parts = spec.split('+')
  // '+' alone or 'Ctrl++'
  let key = parts.pop()!
  if (key === '' && spec.endsWith('+')) {
    key = '+'
    parts.pop()
  }
  return { ctrl: parts.includes('Ctrl'), shift: parts.includes('Shift'), alt: parts.includes('Alt'), key: key.toLowerCase() }
}

// --- custom shortcuts (decision 015): settings override the default keys per command

let specCache: { from: Record<string, string[]>; specs: Map<string, KeySpec[]> } | null = null

/** The keys a command answers to now: the user's override, else its defaults. */
export function effectiveKeys(cmd: Command): string[] {
  const o = useSettings.getState().shortcuts[cmd.id]
  return o ?? cmd.keys ?? []
}

export function isCustomized(cmd: Command): boolean {
  return cmd.id in useSettings.getState().shortcuts
}

function specs(): Map<string, KeySpec[]> {
  const from = useSettings.getState().shortcuts
  if (!specCache || specCache.from !== from) {
    specCache = { from, specs: new Map(COMMANDS.map((c) => [c.id, effectiveKeys(c).map(parseSpec)])) }
  }
  return specCache.specs
}

/** Layout-independent key name: letters by character (Turkish İ/ı included), else e.key. */
function keyName(e: KeyboardEvent): string {
  const k = e.key
  if (k.length === 1) {
    if (k === 'İ' || k === 'ı') return 'i'
    const lower = k.toLowerCase()
    if (/^[a-z0-9]$/.test(lower)) return lower
    // Alt combos may produce symbols; fall back to the physical letter
    if (/^Key[A-Z]$/.test(e.code) && !/[ -~]/.test(k)) return e.code.slice(3).toLowerCase()
    return k
  }
  if (k === 'Unidentified' && /^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase()
  return k.toLowerCase()
}

/** Normalised modifiers + key of an event, as the matcher sees them. */
function eventSpec(e: KeyboardEvent): KeySpec & { symbol: boolean } {
  const key = keyName(e)
  const symbol = key.length === 1 && !/[a-z0-9]/.test(key)
  // AltGr (= Ctrl+Alt on Windows) types symbols like [ ] on many layouts; letters keep real Ctrl+Alt combos
  const altGraph = symbol && (e.getModifierState?.('AltGraph') ?? false)
  return { key, symbol, ctrl: (e.ctrlKey || e.metaKey) && !altGraph, alt: e.altKey && !altGraph, shift: e.shiftKey }
}

function specMatches(spec: KeySpec, ev: KeySpec & { symbol: boolean }): boolean {
  if (spec.key !== ev.key || spec.ctrl !== ev.ctrl || spec.alt !== ev.alt) return false
  // Shift is part of typing symbols on many layouts; only letters/named keys check it
  return ev.symbol || spec.shift === ev.shift
}

export function commandForEvent(e: KeyboardEvent): Command | null {
  const ev = eventSpec(e)
  const all = specs()
  for (const cmd of COMMANDS) {
    for (const spec of all.get(cmd.id)!) if (specMatches(spec, ev)) return cmd
  }
  return null
}

const NAMED: Record<string, string> = { arrowleft: 'Left', arrowright: 'Right', arrowup: 'Up', arrowdown: 'Down', escape: 'Esc', ' ': 'Space' }

/**
 * Shortcut spec for a key press while recording ("Ctrl+Shift+K"), or null for
 * a lone modifier. Symbols drop Shift (it is how they are typed).
 */
export function specFromEvent(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(e.key)) return null
  const ev = eventSpec(e)
  let key = ev.key
  if (key.length === 1) key = /[a-z]/.test(key) ? key.toUpperCase() : key
  else key = NAMED[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
  const parts: string[] = []
  if (ev.ctrl) parts.push('Ctrl')
  if (ev.alt) parts.push('Alt')
  if (ev.shift && !ev.symbol) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

/** Commands (other than `exceptId`) already using a spec. */
export function conflictsWith(spec: string, exceptId: string): Command[] {
  const target = parseSpec(spec)
  const same = (a: KeySpec) => a.key === target.key && a.ctrl === target.ctrl && a.alt === target.alt && a.shift === target.shift
  return COMMANDS.filter((c) => c.id !== exceptId && effectiveKeys(c).map(parseSpec).some(same))
}

/** Display form of a shortcut ("Ctrl+Shift+N"). */
export function shortcutLabel(cmd: Command): string | null {
  return effectiveKeys(cmd)[0] ?? null
}
