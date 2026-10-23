import { BRUSH_TOOLS, MAX_BRUSH, SELECTION_TOOLS } from '@engine/tools'
import type { Mirror } from '@engine/raster'
import { DITHERS, type Dither } from '@engine/ink'
import { cropToSelection, deselect, fitReference, flip, invertSelection, rotate, setReferenceScale } from '../actions'
import { t } from '../i18n'
import { getSprite, useDocVersion } from '../state/document'
import { getSelection, useHasFloating } from '../state/selection'
import { useEditor } from '../state/editor'
import { useSettings } from '../state/settings'
import { Icons } from './icons'
import { TOOL_META, toolShortcut } from './ToolBar'

export function ToolOptions() {
  useDocVersion()
  const floating = useHasFloating()
  useSettings((s) => s.shortcuts)
  const tool = useEditor((s) => s.tool)
  const o = useEditor((s) => s.options)
  const set = useEditor((s) => s.setOptions)
  const Icon = Icons[TOOL_META[tool].icon]
  const brush = BRUSH_TOOLS.has(tool)
  const freehand = tool === 'pencil' || tool === 'eraser'
  const shape = tool === 'rectangle' || tool === 'ellipse'
  const dithers = tool === 'pencil' || tool === 'line' || shape || tool === 'bucket'
  const activeLayerId = useEditor((s) => s.activeLayerId)
  const sprite = getSprite()
  const refLayer = sprite?.layers.find((l) => l.id === activeLayerId && l.kind === 'reference')
  const ref = refLayer ? sprite!.references.get(refLayer.id) : undefined
  const ditherLabel = (d: Dither) => (d === 'none' ? t('Off') : d === 'checker' ? t('Checker') : `${d}%`)
  const mirrorH = o.mirror === 'horizontal' || o.mirror === 'both'
  const mirrorV = o.mirror === 'vertical' || o.mirror === 'both'
  const setMirror = (h: boolean, v: boolean): void => {
    const m: Mirror = h && v ? 'both' : h ? 'horizontal' : v ? 'vertical' : 'none'
    set({ mirror: m })
  }

  return (
    <div className="toolopts">
      <div className="tool-name">
        <Icon size={16} />
        {t(TOOL_META[tool].label)}
        <span className="kbd">{toolShortcut(tool)}</span>
      </div>

      {brush && (
        <>
          <div className="opt">
            <span>{t('Size')}</span>
            <input type="range" min={1} max={32} value={Math.min(32, o.brushSize)} onChange={(e) => set({ brushSize: Number(e.target.value) })} style={{ width: 110 }} />
            <input
              className="num-input"
              type="number"
              min={1}
              max={MAX_BRUSH}
              value={o.brushSize}
              onChange={(e) => set({ brushSize: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="seg" role="group" aria-label={t('Brush shape')}>
            <button className={o.brushShape === 'square' ? 'on' : ''} onClick={() => set({ brushShape: 'square' })} data-tip={t('Square brush')} data-tip-side="bottom">
              <Icons.brushSquare size={14} />
            </button>
            <button className={o.brushShape === 'round' ? 'on' : ''} onClick={() => set({ brushShape: 'round' })} data-tip={t('Round brush')} data-tip-side="bottom">
              <Icons.brushRound size={14} />
            </button>
          </div>
        </>
      )}

      {tool === 'pencil' && (
        <div className="seg" role="group" aria-label={t('Ink')}>
          <button className={o.ink === 'simple' ? 'on' : ''} onClick={() => set({ ink: 'simple' })} data-tip={t('Paints the colour')} data-tip-side="bottom">
            {t('Simple')}
          </button>
          <button className={o.ink === 'shading' ? 'on' : ''} onClick={() => set({ ink: 'shading' })} data-tip={t('Shifts existing colours along the palette: left click forward, right click back')} data-tip-side="bottom">
            {t('Shading')}
          </button>
        </div>
      )}

      {dithers && (
        <div className="opt">
          <span>{t('Dither')}</span>
          <select className="select" value={o.dither} onChange={(e) => set({ dither: e.target.value as Dither })} aria-label={t('Dither')}>
            {DITHERS.map((d) => (
              <option key={d} value={d}>
                {ditherLabel(d)}
              </option>
            ))}
          </select>
        </div>
      )}

      {tool === 'move' && refLayer && ref && (
        <div className="opt">
          <span>{t('Reference scale')}</span>
          <input
            className="num-input"
            type="number"
            min={1}
            max={10000}
            key={ref.scale}
            defaultValue={Math.round(ref.scale * 100)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onBlur={(e) => setReferenceScale(refLayer.id, Number(e.target.value) / 100)}
          />
          <span className="hint">%</span>
          <button className="toggle-chip" onClick={() => fitReference(refLayer.id)}>
            {t('Fit to sprite')}
          </button>
        </div>
      )}

      {freehand && (
        <button
          className={`toggle-chip${o.pixelPerfect ? ' on' : ''}`}
          onClick={() => set({ pixelPerfect: !o.pixelPerfect })}
          data-tip={t('Removes doubled corner pixels from 1-px strokes  Shift+P')}
          data-tip-side="bottom"
        >
          <Icons.pixelPerfect size={14} />
          {t('Pixel-perfect')}
        </button>
      )}

      {shape && (
        <button className={`toggle-chip${o.filled ? ' on' : ''}`} onClick={() => set({ filled: !o.filled })}>
          <Icons.filled size={14} />
          {t('Filled')}
        </button>
      )}

      {(tool === 'bucket' || tool === 'wand') && (
        <button
          className={`toggle-chip${o.contiguous ? ' on' : ''}`}
          onClick={() => set({ contiguous: !o.contiguous })}
          data-tip={t('Off: replace the colour everywhere in the layer')}
          data-tip-side="bottom"
        >
          <Icons.contiguous size={14} />
          {t('Contiguous')}
        </button>
      )}

      {brush && (
        <>
          <div className="opt-sep" />
          <div className="opt">
            <span>{t('Mirror')}</span>
            <button className={`icon-btn small${mirrorH ? ' on' : ''}`} onClick={() => setMirror(!mirrorH, mirrorV)} data-tip={`${t('Mirror horizontally')}  Shift+M`} data-tip-side="bottom">
              <Icons.mirrorH size={16} />
            </button>
            <button className={`icon-btn small${mirrorV ? ' on' : ''}`} onClick={() => setMirror(mirrorH, !mirrorV)} data-tip={t('Mirror vertically')} data-tip-side="bottom">
              <Icons.mirrorV size={16} />
            </button>
          </div>
        </>
      )}

      {(SELECTION_TOOLS.has(tool) || tool === 'move') && (getSelection() || floating) && (
        <>
          <div className="opt-sep" />
          <button className="toggle-chip" onClick={deselect} data-tip="Ctrl+D" data-tip-side="bottom">
            <Icons.close size={14} />
            {t('Deselect')}
          </button>
          <button className="toggle-chip" onClick={invertSelection} data-tip="Ctrl+Shift+I" data-tip-side="bottom">
            <Icons.marquee size={14} />
            {t('Invert')}
          </button>
          <button className="toggle-chip" onClick={cropToSelection}>
            <Icons.crop size={14} />
            {t('Crop')}
          </button>
          <div className="opt-sep" />
          <button className="icon-btn small" onClick={() => flip('horizontal')} data-tip={`${t('Flip horizontal')}  Shift+H`} data-tip-side="bottom">
            <Icons.flipH size={16} />
          </button>
          <button className="icon-btn small" onClick={() => flip('vertical')} data-tip={`${t('Flip vertical')}  Shift+V`} data-tip-side="bottom">
            <Icons.flipV size={16} />
          </button>
          <button className="icon-btn small" onClick={() => rotate('ccw')} data-tip={t('Rotate 90° counter-clockwise')} data-tip-side="bottom">
            <Icons.rotateCCW size={16} />
          </button>
          <button className="icon-btn small" onClick={() => rotate('cw')} data-tip={t('Rotate 90° clockwise')} data-tip-side="bottom">
            <Icons.rotateCW size={16} />
          </button>
        </>
      )}

      <div className="hint" style={{ marginLeft: 'auto' }}>
        {hintFor(tool)}
      </div>
    </div>
  )
}

function hintFor(tool: string): string {
  switch (tool) {
    case 'pencil':
    case 'eraser':
      return t('Right-click: secondary colour · Shift+click: straight line · Alt: pick colour')
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return t('Shift: constrain (45° / square / circle)')
    case 'bucket':
      return t('Right-click fills with the secondary colour')
    case 'eyedropper':
      return t('Left: primary · Right: secondary')
    case 'move':
      return t('Drag inside a selection to move its pixels · Handles scale (Shift keeps proportions) · Enter drops, Esc cancels')
    case 'marquee':
    case 'lasso':
      return t('Shift: add · Alt: subtract · Click: deselect · Arrows move the pixels')
    case 'wand':
      return t('Selects pixels of the same colour · Shift: add · Alt: subtract')
    default:
      return t('Space + drag pans with any tool · Wheel zooms')
  }
}
