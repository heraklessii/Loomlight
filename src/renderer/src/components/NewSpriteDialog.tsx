import { useState } from 'react'
import { MAX_SPRITE_SIZE } from '@engine/sprite'
import { BACKGROUNDS, newSprite } from '../actions'
import { t } from '../i18n'
import { useUi } from '../state/ui'
import { Dialog } from './Dialog'
import { Icons } from './icons'

const SIZES = [16, 24, 32, 48, 64, 128, 256]

type Bg = keyof typeof BACKGROUNDS

export function NewSpriteDialog() {
  const [w, setW] = useState(32)
  const [h, setH] = useState(32)
  const [bg, setBg] = useState<Bg>('transparent')
  const valid = w >= 1 && h >= 1 && w <= MAX_SPRITE_SIZE && h <= MAX_SPRITE_SIZE
  const clamp = (v: string) => Math.max(0, Math.min(MAX_SPRITE_SIZE, Math.round(Number(v) || 0)))

  const create = () => {
    if (valid) newSprite(w, h, BACKGROUNDS[bg])
  }

  return (
    <Dialog title={t('New sprite')} icon={<Icons.fileNew size={20} />}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <div className="field">
          <span className="field-label">{t('Size')}</span>
          <div className="row">
            <input className="num-input" type="number" min={1} max={MAX_SPRITE_SIZE} value={w} onChange={(e) => setW(clamp(e.target.value))} aria-label={t('Width')} autoFocus />
            <span className="hint">×</span>
            <input className="num-input" type="number" min={1} max={MAX_SPRITE_SIZE} value={h} onChange={(e) => setH(clamp(e.target.value))} aria-label={t('Height')} />
            <span className="hint">px</span>
          </div>
          <div className="chips">
            {SIZES.map((s) => (
              <button
                type="button"
                key={s}
                className={`chip-btn${w === s && h === s ? ' on' : ''}`}
                onClick={() => {
                  setW(s)
                  setH(s)
                }}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('Background')}</span>
          <div className="choice-cards">
            {(['transparent', 'white', 'black'] as Bg[]).map((b) => (
              <button type="button" key={b} className={`choice-card${bg === b ? ' on' : ''}`} onClick={() => setBg(b)}>
                <span className={`bg-swatch${b === 'transparent' ? ' checker-bg' : ''}`} style={b === 'transparent' ? undefined : { background: b }} />
                <span className="title">{b === 'transparent' ? t('Transparent') : b === 'white' ? t('White') : t('Black')}</span>
              </button>
            ))}
          </div>
        </div>
        {!valid && <div className="hint">{t('Width and height must be between 1 and {max}.', { max: MAX_SPRITE_SIZE })}</div>}
        <div className="footer">
          <button type="button" className="btn ghost" onClick={() => useUi.getState().openDialog(null)}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={!valid}>
            {t('Create')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
