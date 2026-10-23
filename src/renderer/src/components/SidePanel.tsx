import { useEffect, useRef, useState } from 'react'
import { alpha, hsvToPacked, packedToHsv, parseHex, toHex, withAlpha, type Hsv, type Packed } from '@engine/color'
import { PALETTES } from '@engine/palettes'
import { compositeFrame } from '@engine/sprite'
import type { PaletteFormat } from '@engine/palette-io'
import { addPaletteColor, exportPaletteFile, importPaletteFile, loadPalette, removePaletteColor } from '../actions'
import { beginPaletteEdit, endPaletteEdit, isEditingPalette, updatePaletteEdit } from '../state/palette-edit'
import { t } from '../i18n'
import { getSprite, subscribeDoc, useDocVersion } from '../state/document'
import { useEditor } from '../state/editor'
import { Icons } from './icons'

export function SidePanel() {
  return (
    <aside className="side">
      <PreviewPanel />
      <ColorPanel />
      <PalettePanel />
    </aside>
  )
}

/** Live preview of the current frame at an integer scale; follows playback. */
function PreviewPanel() {
  const ref = useRef<HTMLCanvasElement>(null)
  const playing = useEditor((s) => s.playing)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const draw = () => {
      raf = 0
      const sprite = getSprite()
      if (!sprite) return
      const box = canvas.parentElement!
      const scale = Math.max(1, Math.floor(Math.min((box.clientWidth - 16) / sprite.width, (box.clientHeight - 16) / sprite.height)))
      if (canvas.width !== sprite.width || canvas.height !== sprite.height) {
        canvas.width = sprite.width
        canvas.height = sprite.height
      }
      canvas.style.width = `${sprite.width * scale}px`
      canvas.style.height = `${sprite.height * scale}px`
      const img = new ImageData(sprite.width, sprite.height)
      compositeFrame(sprite, useEditor.getState().frameIndex, new Uint32Array(img.data.buffer))
      ctx.putImageData(img, 0, 0)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    const unsubDoc = subscribeDoc(schedule)
    const unsubEd = useEditor.subscribe((s, p) => {
      if (s.frameIndex !== p.frameIndex) schedule()
    })
    schedule()
    return () => {
      cancelAnimationFrame(raf)
      unsubDoc()
      unsubEd()
    }
  }, [])

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">{t('Preview')}</span>
        {playing && <span className="hint">{t('Playing')}</span>}
      </div>
      <div className="preview-box checker-bg">
        <canvas ref={ref} />
      </div>
    </section>
  )
}

function ColorPanel() {
  useDocVersion()
  const primary = useEditor((s) => s.primary)
  const paletteIndex = useEditor((s) => s.paletteIndex)
  const secondary = useEditor((s) => s.secondary)
  const editing = useEditor((s) => s.editing)
  const setColor = useEditor((s) => s.setColor)
  const setEditing = useEditor((s) => s.setEditing)
  const swap = useEditor((s) => s.swapColors)
  const color = editing === 'primary' ? primary : secondary

  // keep hue/saturation stable when the colour is grey or black
  const [hsv, setHsv] = useState<Hsv>(() => packedToHsv(color))
  const lastSet = useRef<Packed>(color)
  useEffect(() => {
    if (color !== lastSet.current) {
      const next = packedToHsv(color)
      setHsv((prev) => ({ h: next.s === 0 || next.v === 0 ? prev.h : next.h, s: next.v === 0 ? prev.s : next.s, v: next.v }))
      lastSet.current = color
    }
  }, [color])

  // indexed sprite: the picker edits the selected palette entry and its pixels follow live (decision 010)
  const sprite = getSprite()
  const paletteTarget = (): number | null =>
    sprite?.colorMode === 'indexed' && editing === 'primary' && paletteIndex !== null && sprite.palette[paletteIndex] === primary ? paletteIndex : null
  const editsPalette = paletteTarget() !== null

  const a = alpha(color)
  const apply = (next: Hsv, nextAlpha = a) => {
    setHsv(next)
    const packed = hsvToPacked(next, isEditingPalette() ? 255 : nextAlpha)
    lastSet.current = packed
    setColor(editing, packed)
    if (isEditingPalette()) updatePaletteEdit(packed)
  }

  const [hexText, setHexText] = useState(toHex(color).slice(1))
  useEffect(() => setHexText(toHex(color).slice(1)), [color])

  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const alphaRef = useRef<HTMLDivElement>(null)

  const dragOn = (ref: React.RefObject<HTMLDivElement | null>, fn: (fx: number, fy: number) => void) => (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const target = paletteTarget()
    if (target !== null) beginPaletteEdit(target)
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect()
      fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)))
    }
    move(e)
    const onMove = (ev: PointerEvent) => move(ev)
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      if (isEditingPalette()) endPaletteEdit()
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  const hueColor = toHex(hsvToPacked({ h: hsv.h, s: 1, v: 1 }))
  const opaque = toHex(withAlpha(color, 255))

  return (
    <section className="panel" data-tour="colors">
      <div className="panel-head">
        <span className="panel-title">{t('Colour')}</span>
        {editsPalette && <span className="mode-chip" data-tip={t('Editing palette entry {n} — its pixels change too', { n: (paletteIndex ?? 0) + 1 })}>{t('Palette entry {n}', { n: (paletteIndex ?? 0) + 1 })}</span>}
        <button className="icon-btn small" onClick={swap} data-tip={`${t('Swap colours')}  X`}>
          <Icons.swap size={15} />
        </button>
      </div>
      <div className="swatch-pair">
        <button className={`swatch-big checker-bg${editing === 'primary' ? ' editing' : ''}`} onClick={() => setEditing('primary')} data-tip={t('Primary (left click)')}>
          <span className="swatch-fill" style={{ background: toHex(primary, true) }} />
        </button>
        <button className={`swatch-big checker-bg${editing === 'secondary' ? ' editing' : ''}`} onClick={() => setEditing('secondary')} data-tip={t('Secondary (right click)')}>
          <span className="swatch-fill" style={{ background: toHex(secondary, true) }} />
        </button>
        <label className="hex-field">
          <span>#</span>
          <input
            value={hexText}
            spellCheck={false}
            maxLength={8}
            onChange={(e) => {
              setHexText(e.target.value)
              const c = parseHex(e.target.value)
              if (c !== null && (e.target.value.length === 6 || e.target.value.length === 8)) {
                lastSet.current = -1
                const target = paletteTarget()
                if (target !== null && beginPaletteEdit(target)) {
                  updatePaletteEdit(c)
                  endPaletteEdit()
                }
                setColor(editing, target !== null ? (c | 0xff000000) >>> 0 : c)
              }
            }}
            onBlur={() => setHexText(toHex(color).slice(1))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      </div>

      <div ref={svRef} className="sv-box" style={{ background: hueColor }} onPointerDown={dragOn(svRef, (fx, fy) => apply({ h: hsv.h, s: fx, v: 1 - fy }))}>
        <div className="layer-white" />
        <div className="layer-black" />
        <div className="picker-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: opaque }} />
      </div>
      <div ref={hueRef} className="strip hue" onPointerDown={dragOn(hueRef, (fx) => apply({ ...hsv, h: Math.min(359.9, fx * 360) }))}>
        <div className="strip-knob" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }} />
      </div>
      <div ref={alphaRef} className="strip checker-bg" onPointerDown={dragOn(alphaRef, (fx) => apply(hsv, Math.round(fx * 255)))}>
        <div className="strip-fill" style={{ background: `linear-gradient(to right, transparent, ${opaque})` }} />
        <div className="strip-knob" style={{ left: `${(a / 255) * 100}%` }} />
      </div>
    </section>
  )
}

function PalettePanel() {
  useDocVersion()
  const sprite = getSprite()
  const primary = useEditor((s) => s.primary)
  const secondary = useEditor((s) => s.secondary)
  const setColor = useEditor((s) => s.setColor)
  const paletteIndex = useEditor((s) => s.paletteIndex)
  const [preset, setPreset] = useState('')
  const [exportFmt, setExportFmt] = useState('')
  if (!sprite) return null
  const indexed = sprite.colorMode === 'indexed'
  const inPalette = sprite.palette.includes(primary)

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">{t('Palette')}</span>
        {indexed && <span className="mode-chip" data-tip={t('Indexed: every pixel is a palette colour; editing a colour recolours the sprite')}>{t('Indexed')}</span>}
        <select
          className="select"
          value={preset}
          onChange={(e) => {
            if (e.target.value) loadPalette(e.target.value)
            setPreset('')
          }}
          aria-label={t('Load palette')}
        >
          <option value="">{t('Load palette…')}</option>
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.colors.length})
            </option>
          ))}
        </select>
      </div>
      <div className="palette-grid">
        {sprite.palette.map((c, i) => (
          <button
            key={`${c}-${i}`}
            className={`pal-swatch${(indexed ? i === paletteIndex : c === primary) ? ' primary' : c === secondary ? ' secondary' : ''}`}
            style={{ background: toHex(c, true) }}
            title={toHex(c)}
            onPointerDown={(e) => {
              if (e.button === 2) setColor('secondary', c)
              else if (e.button === 0) {
                setColor('primary', c)
                useEditor.getState().set({ paletteIndex: i, editing: 'primary' })
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
        ))}
        <button className="pal-add" onClick={() => (inPalette ? removePaletteColor(primary) : addPaletteColor(primary))} data-tip={inPalette ? t('Remove the primary colour') : t('Add the primary colour')}>
          {inPalette ? <Icons.minus size={14} /> : <Icons.plus size={14} />}
        </button>
      </div>
      <div className="panel-foot hint">{t('Left click: primary · Right click: secondary')}</div>
      <div className="palette-io">
        <button className="toggle-chip" onClick={() => void importPaletteFile()}>
          <Icons.folder size={14} />
          {t('Import…')}
        </button>
        <select
          className="select"
          value={exportFmt}
          aria-label={t('Export palette')}
          onChange={(e) => {
            if (e.target.value) void exportPaletteFile(e.target.value as PaletteFormat)
            setExportFmt('')
          }}
        >
          <option value="">{t('Export as…')}</option>
          <option value="gpl">GIMP (.gpl)</option>
          <option value="hex">Lospec (.hex)</option>
          <option value="pal">JASC (.pal)</option>
          <option value="png">PNG (.png)</option>
        </select>
      </div>
    </section>
  )
}
