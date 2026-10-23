// Canvas size (add/remove room around the pixels, with an anchor) and
// Sprite size (nearest-neighbour scale) — one dialog, two modes.

import { useState } from 'react'
import { MAX_SPRITE_SIZE } from '@engine/sprite'
import type { Anchor } from '@engine/transform'
import { resizeCanvasTo, scaleSpriteTo } from '../actions'
import { t } from '../i18n'
import { getSprite } from '../state/document'
import { useUi } from '../state/ui'
import { Dialog } from './Dialog'
import { Icons } from './icons'

const ANCHORS: Anchor[] = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se']
const PERCENTS = [50, 200, 300, 400]

export function ResizeDialog({ mode: initial }: { mode: 'canvas' | 'scale' }) {
  const sprite = getSprite()!
  const [mode, setMode] = useState(initial)
  const [w, setW] = useState(sprite.width)
  const [h, setH] = useState(sprite.height)
  const [lock, setLock] = useState(true)
  const [anchor, setAnchor] = useState<Anchor>('c')
  const valid = w >= 1 && h >= 1 && w <= MAX_SPRITE_SIZE && h <= MAX_SPRITE_SIZE
  const clamp = (v: string) => Math.max(0, Math.min(MAX_SPRITE_SIZE, Math.round(Number(v) || 0)))
  const ratio = sprite.height / sprite.width

  const setWidth = (v: number) => {
    setW(v)
    if (mode === 'scale' && lock) setH(Math.max(1, Math.round(v * ratio)))
  }
  const setHeight = (v: number) => {
    setH(v)
    if (mode === 'scale' && lock) setW(Math.max(1, Math.round(v / ratio)))
  }

  const apply = () => {
    if (!valid) return
    useUi.getState().openDialog(null)
    if (mode === 'canvas') resizeCanvasTo(w, h, anchor)
    else scaleSpriteTo(w, h)
  }

  return (
    <Dialog title={mode === 'canvas' ? t('Canvas size') : t('Sprite size')} icon={<Icons.resize size={20} />}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <div className="field">
          <div className="seg" style={{ justifySelf: 'start' }}>
            <button type="button" className={mode === 'canvas' ? 'on' : ''} onClick={() => setMode('canvas')}>
              {t('Canvas size')}
            </button>
            <button type="button" className={mode === 'scale' ? 'on' : ''} onClick={() => setMode('scale')}>
              {t('Sprite size')}
            </button>
          </div>
          <div className="hint">
            {mode === 'canvas' ? t('Adds or removes room around the pixels; nothing is stretched.') : t('Scales every layer and frame with nearest-neighbour — pixels stay crisp.')}
          </div>
        </div>

        <div className="field">
          <span className="field-label">{t('Size')}</span>
          <div className="row">
            <input className="num-input" type="number" min={1} max={MAX_SPRITE_SIZE} value={w} onChange={(e) => setWidth(clamp(e.target.value))} aria-label={t('Width')} autoFocus />
            <span className="hint">×</span>
            <input className="num-input" type="number" min={1} max={MAX_SPRITE_SIZE} value={h} onChange={(e) => setHeight(clamp(e.target.value))} aria-label={t('Height')} />
            <span className="hint">px</span>
            {mode === 'scale' && (
              <label className="checkbox" style={{ marginLeft: 8 }}>
                <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
                {t('Keep proportions')}
              </label>
            )}
          </div>
          <div className="hint mono">{t('Now: {w}×{h} px', { w: sprite.width, h: sprite.height })}</div>
          {mode === 'scale' && (
            <div className="chips">
              {PERCENTS.map((p) => (
                <button
                  type="button"
                  key={p}
                  className={`chip-btn${w === Math.round((sprite.width * p) / 100) && h === Math.round((sprite.height * p) / 100) ? ' on' : ''}`}
                  onClick={() => {
                    setW(Math.max(1, Math.round((sprite.width * p) / 100)))
                    setH(Math.max(1, Math.round((sprite.height * p) / 100)))
                  }}
                >
                  {p}%
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'canvas' && (
          <div className="field">
            <span className="field-label">{t('Anchor')}</span>
            <div className="anchor-grid" role="radiogroup" aria-label={t('Anchor')}>
              {ANCHORS.map((a) => (
                <button type="button" key={a} role="radio" aria-checked={anchor === a} className={anchor === a ? 'on' : ''} onClick={() => setAnchor(a)} />
              ))}
            </div>
          </div>
        )}

        {!valid && <div className="hint">{t('Width and height must be between 1 and {max}.', { max: MAX_SPRITE_SIZE })}</div>}
        <div className="footer">
          <button type="button" className="btn ghost" onClick={() => useUi.getState().openDialog(null)}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={!valid}>
            {t('Apply')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
