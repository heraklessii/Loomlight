// The drawing viewport: pointer input → stroke sessions, zoom/pan, brush
// preview. Drawing is synchronous into the cel; the canvas redraws on the
// next animation frame (rule 3). No React state per pointer move.

import { useEffect, useRef, useState } from 'react'
import { brushOffsets, mirrored } from '@engine/raster'
import { combineMasks, polygonMask, rectMask, wandMask, type SelectMode } from '@engine/selection'
import { getCel, isReference, snapshotStructure, type ensureCel, type StructureSnapshot } from '@engine/sprite'
import { nearestIndex } from '@engine/palette-io'
import { createImage } from '@engine/image'
import { beginStroke, BRUSH_TOOLS, EDITING_TOOLS, SELECTION_TOOLS, type StrokeSession, type ToolId } from '@engine/tools'
import { sampleColor, zoomAround, zoomBy } from '../actions'
import { t, tk } from '../i18n'
import { handlePoints, HANDLE_PX, ViewportRenderer, type Footprint, type Handle, type Overlay } from '../render/viewport'
import { getSprite, pushPixelEdit, structuralFrom, subscribeDoc, touch } from '../state/document'
import { useCursor, useEditor, ZOOM_STEPS } from '../state/editor'
import { onThemeChange } from '../state/settings'
import { changeSelection, commitFloating, editableCel, floatingSourceSize, getFloating, getSelection, liftSelection, moveFloatingTo, setFloatingRect } from '../state/selection'
import { Icons } from './icons'
import { TOOL_META } from './ToolBar'

type Drag =
  | { kind: 'pan'; x: number; y: number; panX: number; panY: number }
  | { kind: 'stroke'; session: StrokeSession; label: string; cel: ReturnType<typeof ensureCel> }
  | { kind: 'pick'; slot: 'primary' | 'secondary' }
  | { kind: 'float'; x0: number; y0: number; fx: number; fy: number }
  | { kind: 'scale'; handle: Handle; l: number; t: number; r: number; b: number }
  | { kind: 'ref'; layerId: string; cx: number; cy: number; rx: number; ry: number; before: StructureSnapshot }
  | { kind: 'select'; tool: 'marquee' | 'lasso'; mode: SelectMode; x0: number; y0: number; x1: number; y1: number; points: Array<[number, number]> }

const PICK_TOOLS = new Set<ToolId>(['pencil', 'eraser', 'bucket', 'line', 'rectangle', 'ellipse'])

const HANDLE_CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }

export function CanvasView() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tool = useEditor((s) => s.tool)
  const zoom = useEditor((s) => s.zoom)
  const [spaceDown, setSpaceDown] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current!
    const renderer = new ViewportRenderer(canvas)
    let raf = 0
    let hover: { x: number; y: number } | null = null
    let drag: Drag | null = null
    let lastPoint: { x: number; y: number } | null = null
    let space = false
    let alt = false
    let wheelAcc = 0
    let fitted = false
    let phase = 0

    const footprint = (): Footprint | null => {
      const ed = useEditor.getState()
      const sprite = getSprite()
      if (!hover || !sprite || space) return null
      if (drag && drag.kind !== 'stroke') return null
      const tool = alt && PICK_TOOLS.has(ed.tool) ? 'eyedropper' : ed.tool
      if (drag && tool !== 'pencil' && tool !== 'eraser') return null
      if (tool === 'hand' || tool === 'move' || tool === 'marquee' || tool === 'lasso') return null
      if (tool === 'bucket' || tool === 'eyedropper' || tool === 'wand') return { pixels: [[hover.x, hover.y]], color: null }
      const pixels: Array<[number, number]> = []
      const put = mirrored((x, y) => pixels.push([x, y]), ed.options.mirror, sprite.width, sprite.height)
      for (const [dx, dy] of brushOffsets(ed.options.brushSize, ed.options.brushShape)) put(hover.x + dx, hover.y + dy)
      const outline = tool === 'eraser' || drag || (tool === 'pencil' && ed.options.ink === 'shading')
      return { pixels, color: outline ? null : ed.primary }
    }

    const draw = () => {
      raf = 0
      const ed = useEditor.getState()
      const pending: Overlay['pending'] =
        drag?.kind === 'select' ? (drag.tool === 'marquee' ? { kind: 'rect', x0: drag.x0, y0: drag.y0, x1: drag.x1, y1: drag.y1 } : { kind: 'lasso', points: drag.points }) : null
      renderer.render(
        getSprite(),
        ed.frameIndex,
        { zoom: ed.zoom, panX: ed.panX, panY: ed.panY, showGrid: ed.showGrid, onionSkin: ed.onionSkin, tiled: ed.tiled },
        { footprint: footprint(), selection: getSelection(), floating: getFloating(), pending, phase }
      )
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }

    const fit = () => {
      const sprite = getSprite()
      if (!sprite) return
      const vw = canvas.clientWidth
      const vh = canvas.clientHeight
      if (vw < 10 || vh < 10) return
      const margin = 56
      const zf = Math.min((vw - margin * 2) / sprite.width, (vh - margin * 2) / sprite.height)
      const z = zf >= 1 ? ([...ZOOM_STEPS].reverse().find((s) => s <= zf) ?? 1) : Math.max(0.05, zf)
      useEditor.getState().setView(z, Math.round((vw - sprite.width * z) / 2), Math.round((vh - sprite.height * z) / 2))
      fitted = true
    }

    const toSprite = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect()
      const ed = useEditor.getState()
      return {
        x: Math.floor((e.clientX - r.left - ed.panX) / ed.zoom),
        y: Math.floor((e.clientY - r.top - ed.panY) / ed.zoom),
        cx: e.clientX - r.left,
        cy: e.clientY - r.top
      }
    }

    const updateHover = (x: number, y: number) => {
      const sprite = getSprite()
      if (hover && hover.x === x && hover.y === y) return
      hover = { x, y }
      // tiled mode: the neighbouring tiles are the same pixels
      const tiled = useEditor.getState().tiled
      if (sprite && (tiled === 'x' || tiled === 'both')) x = ((x % sprite.width) + sprite.width) % sprite.width
      if (sprite && (tiled === 'y' || tiled === 'both')) y = ((y % sprite.height) + sprite.height) % sprite.height
      const inside = !!sprite && x >= 0 && y >= 0 && x < sprite.width && y < sprite.height
      useCursor.getState().set(inside ? x : null, inside ? y : null, inside ? sampleColor(x, y) : null)
      schedule()
    }

    /** The scale handle of the floating block under a canvas point (CSS px), if any. */
    const handleAt = (cx: number, cy: number): Handle | null => {
      const f = getFloating()
      if (!f) return null
      const ed = useEditor.getState()
      for (const [hx, hy, h] of handlePoints(f)) {
        if (Math.abs(ed.panX + hx * ed.zoom - cx) <= HANDLE_PX && Math.abs(ed.panY + hy * ed.zoom - cy) <= HANDLE_PX) return h
      }
      return null
    }

    /** Indexed sprites only take palette colours (decision 010). */
    const indexedColor = (c: number): number => {
      const sprite = getSprite()
      if (!sprite || sprite.colorMode !== 'indexed' || c >>> 24 === 0 || sprite.palette.length === 0) return c
      return sprite.palette[nearestIndex(sprite.palette, c)]
    }

    const pick = (x: number, y: number, slot: 'primary' | 'secondary') => {
      const c = sampleColor(x, y)
      if (c === null) return
      const ed = useEditor.getState()
      ed.setColor(slot, c)
      const sprite = getSprite()
      if (slot === 'primary' && sprite) ed.set({ paletteIndex: sprite.palette.includes(c) ? sprite.palette.indexOf(c) : null })
    }

    const onPointerDown = (e: PointerEvent) => {
      const sprite = getSprite()
      if (!sprite || drag) return
      const ed = useEditor.getState()
      const p = toSprite(e)
      canvas.setPointerCapture(e.pointerId)
      if (ed.playing) ed.set({ playing: false })

      if (e.button === 1 || space || ed.tool === 'hand') {
        drag = { kind: 'pan', x: e.clientX, y: e.clientY, panX: ed.panX, panY: ed.panY }
        setDragging(true)
        return
      }
      if (e.button !== 0 && e.button !== 2) return
      const slot = e.button === 2 ? 'secondary' : 'primary'

      // floating pixels: drag them with any tool; a click elsewhere drops them
      const fl = getFloating()
      const handle = e.button === 0 ? handleAt(p.cx, p.cy) : null
      if (fl && handle) {
        drag = { kind: 'scale', handle, l: fl.x, t: fl.y, r: fl.x + fl.w, b: fl.y + fl.h }
        return
      }
      if (fl) {
        if (e.button === 0 && p.x >= fl.x && p.y >= fl.y && p.x < fl.x + fl.w && p.y < fl.y + fl.h) {
          drag = { kind: 'float', x0: p.x, y0: p.y, fx: fl.x, fy: fl.y }
          return
        }
        commitFloating()
      }

      if (SELECTION_TOOLS.has(ed.tool)) {
        const mode: SelectMode = e.shiftKey && e.altKey ? 'intersect' : e.shiftKey ? 'add' : e.altKey ? 'subtract' : 'replace'
        if (ed.tool === 'wand') {
          const frame = sprite.frames[ed.frameIndex]
          const cel = getCel(sprite, ed.activeLayerId, frame.id) ?? createImage(sprite.width, sprite.height)
          changeSelection(combineMasks(getSelection(), wandMask(cel, p.x, p.y, ed.options.contiguous), mode), tk('Magic wand'))
          return
        }
        drag = { kind: 'select', tool: ed.tool as 'marquee' | 'lasso', mode, x0: p.x, y0: p.y, x1: p.x, y1: p.y, points: [[p.x, p.y]] }
        schedule()
        return
      }

      // move tool on a reference layer places the image (decision 012)
      const activeLayer = sprite.layers.find((l) => l.id === ed.activeLayerId)
      const ref = activeLayer && isReference(activeLayer) ? sprite.references.get(activeLayer.id) : undefined
      if (ed.tool === 'move' && ref && e.button === 0) {
        if (activeLayer!.locked) return
        drag = { kind: 'ref', layerId: activeLayer!.id, cx: p.cx, cy: p.cy, rx: ref.x, ry: ref.y, before: snapshotStructure(sprite) }
        return
      }

      const sel = getSelection()
      if (ed.tool === 'move' && sel && e.button === 0 && p.x >= 0 && p.y >= 0 && p.x < sel.width && p.y < sel.height && sel.data[p.y * sel.width + p.x]) {
        if (liftSelection()) {
          const f = getFloating()!
          drag = { kind: 'float', x0: p.x, y0: p.y, fx: f.x, fy: f.y }
        }
        return
      }

      if (ed.tool === 'eyedropper' || (e.altKey && PICK_TOOLS.has(ed.tool))) {
        drag = { kind: 'pick', slot }
        pick(p.x, p.y, slot)
        return
      }
      if (!EDITING_TOOLS.has(ed.tool)) return
      const cel = editableCel()
      if (!cel) return
      const freehand = ed.tool === 'pencil' || ed.tool === 'eraser'
      const session = beginStroke({
        tool: ed.tool,
        cel,
        x: p.x,
        y: p.y,
        color: indexedColor(slot === 'secondary' ? ed.secondary : ed.primary),
        options: ed.options,
        lineFrom: freehand && e.shiftKey && lastPoint ? lastPoint : undefined,
        mask: sel?.data,
        palette: sprite.palette,
        shadeDir: slot === 'secondary' ? -1 : 1,
        wrap: ed.tiled
      })
      if (!session) return
      drag = { kind: 'stroke', session, label: TOOL_META[ed.tool].label, cel }
      lastPoint = { x: p.x, y: p.y }
      touch()
    }

    const onPointerMove = (e: PointerEvent) => {
      const p = toSprite(e)
      updateHover(p.x, p.y)
      if (!drag) {
        const h = handleAt(p.cx, p.cy)
        canvas.style.cursor = h ? HANDLE_CURSOR[h] : ''
        return
      }
      if (drag.kind === 'scale') {
        const ed = useEditor.getState()
        const fx = Math.round((p.cx - ed.panX) / ed.zoom)
        const fy = Math.round((p.cy - ed.panY) / ed.zoom)
        let { l, t, r, b } = drag
        const hd = drag.handle
        if (hd.includes('w')) l = Math.min(fx, r - 1)
        if (hd.includes('e')) r = Math.max(fx, l + 1)
        if (hd.includes('n')) t = Math.min(fy, b - 1)
        if (hd.includes('s')) b = Math.max(fy, t + 1)
        const src = floatingSourceSize()
        if (e.shiftKey && src && hd.length === 2) {
          // keep the source proportions from the opposite corner
          const w = r - l
          const h = Math.max(1, Math.round((w * src.h) / src.w))
          if (hd.includes('n')) t = b - h
          else b = t + h
        }
        setFloatingRect(l, t, r - l, b - t)
        return
      }
      if (drag.kind === 'ref') {
        const ed = useEditor.getState()
        const r = getSprite()?.references.get(drag.layerId)
        if (r) {
          r.x = drag.rx + (p.cx - drag.cx) / ed.zoom
          r.y = drag.ry + (p.cy - drag.cy) / ed.zoom
          touch()
        }
        return
      }
      if (drag.kind === 'pan') {
        const ed = useEditor.getState()
        ed.setView(ed.zoom, drag.panX + (e.clientX - drag.x), drag.panY + (e.clientY - drag.y))
        return
      }
      if (drag.kind === 'pick') {
        pick(p.x, p.y, drag.slot)
        return
      }
      if (drag.kind === 'float') {
        moveFloatingTo(drag.fx + p.x - drag.x0, drag.fy + p.y - drag.y0)
        return
      }
      if (drag.kind === 'select') {
        drag.x1 = p.x
        drag.y1 = p.y
        const last = drag.points[drag.points.length - 1]
        if (last[0] !== p.x || last[1] !== p.y) drag.points.push([p.x, p.y])
        schedule()
        return
      }
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
      for (const ev of events.length ? events : [e]) {
        const q = toSprite(ev)
        drag.session.move(q.x, q.y, e.shiftKey)
      }
      lastPoint = { x: p.x, y: p.y }
      touch()
    }

    const finish = (e: PointerEvent) => {
      if (!drag) return
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      if (drag.kind === 'stroke') {
        const res = drag.session.end()
        if (res) pushPixelEdit(drag.label, drag.cel, res.rect, res.before, res.after)
        else touch()
      }
      if (drag.kind === 'select') finishSelection(drag)
      if (drag.kind === 'ref') {
        const r = getSprite()?.references.get(drag.layerId)
        if (r && (r.x !== drag.rx || r.y !== drag.ry)) structuralFrom(tk('Move reference'), drag.before)
      }
      drag = null
      setDragging(false)
      schedule()
    }

    const finishSelection = (d: Extract<Drag, { kind: 'select' }>) => {
      const sprite = getSprite()
      if (!sprite) return
      const click = d.tool === 'marquee' ? d.x0 === d.x1 && d.y0 === d.y1 : d.points.length < 3
      if (click) {
        // a plain click with a selection tool deselects (Aseprite habit)
        if (d.mode === 'replace' && getSelection()) changeSelection(null, tk('Deselect'))
        return
      }
      const m = d.tool === 'marquee' ? rectMask(sprite.width, sprite.height, d.x0, d.y0, d.x1, d.y1) : polygonMask(sprite.width, sprite.height, d.points)
      changeSelection(combineMasks(getSelection(), m, d.mode), d.tool === 'marquee' ? tk('Rectangle select') : tk('Lasso select'))
    }

    const onLeave = () => {
      hover = null
      useCursor.getState().set(null, null, null)
      schedule()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!getSprite()) return
      wheelAcc += e.deltaY
      if (Math.abs(wheelAcc) < 40) return
      const dir = wheelAcc < 0 ? 1 : -1
      wheelAcc = 0
      const p = toSprite(e)
      const ed = useEditor.getState()
      zoomAround(dir, p.cx, p.cy, ed.zoom, ed.panX, ed.panY)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (e.code === 'Space' && !typing) {
        e.preventDefault()
        if (!space) {
          space = true
          setSpaceDown(true)
          schedule()
        }
      }
      if (e.key === 'Alt') {
        e.preventDefault()
        alt = true
        schedule()
      }
      if (e.key === 'Escape' && drag?.kind === 'stroke') {
        drag.session.cancel()
        drag = null
        setDragging(false)
        touch()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space = false
        setSpaceDown(false)
        schedule()
      }
      if (e.key === 'Alt') {
        alt = false
        schedule()
      }
    }
    const onBlur = () => {
      space = false
      alt = false
      setSpaceDown(false)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    // marching ants
    const ants = window.setInterval(() => {
      if (getSelection() || getFloating() || drag?.kind === 'select') {
        phase = (phase + 1) % 8
        schedule()
      }
    }, 110)

    const unsubTheme = onThemeChange(() => {
      renderer.refreshColors()
      schedule()
    })
    const unsubDoc = subscribeDoc(schedule)
    const unsubEd = useEditor.subscribe((s, prev) => {
      if (s.fitRequest !== prev.fitRequest) fit()
      schedule()
    })
    // keep the view centred when the viewport resizes (panels, window)
    let lastW = canvas.clientWidth
    let lastH = canvas.clientHeight
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!fitted) fit()
      else if (w !== lastW || h !== lastH) {
        const ed = useEditor.getState()
        ed.setView(ed.zoom, ed.panX + Math.round((w - lastW) / 2), ed.panY + Math.round((h - lastH) / 2))
      }
      lastW = w
      lastH = h
      schedule()
    })
    ro.observe(canvas)
    fit()
    schedule()

    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(ants)
      unsubTheme()
      unsubDoc()
      unsubEd()
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const cursorClass = spaceDown || tool === 'hand' ? 'panning' : tool === 'move' ? 'tool-move' : BRUSH_TOOLS.has(tool) || SELECTION_TOOLS.has(tool) || tool === 'bucket' || tool === 'eyedropper' ? 'tool-cross' : ''

  return (
    <div className={`viewport ${cursorClass}${dragging ? ' dragging' : ''}`} ref={wrapRef} data-viewport data-tour="canvas">
      <canvas ref={canvasRef} />
      <div className="viewport-hud">
        <button className="icon-btn small" onClick={() => zoomBy(-1)} data-tip={`${t('Zoom out')}  -`}>
          <Icons.minus size={15} />
        </button>
        <div className="zoom-label">{Math.round(zoom * 100)}%</div>
        <button className="icon-btn small" onClick={() => zoomBy(1)} data-tip={`${t('Zoom in')}  +`}>
          <Icons.plus size={15} />
        </button>
        <button className="icon-btn small" onClick={() => useEditor.getState().requestFit()} data-tip={`${t('Fit on screen')}  Ctrl+0`}>
          <Icons.grid size={15} />
        </button>
      </div>
    </div>
  )
}
