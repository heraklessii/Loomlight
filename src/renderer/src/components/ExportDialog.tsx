import { useState } from 'react'
import { sheetGeometry, type SheetLayout } from '@engine/sheet'
import { exportFrames, exportGif, exportPng, exportSheet } from '../actions'
import { t } from '../i18n'
import { isElectron } from '../platform'
import { getSprite } from '../state/document'
import { useUi } from '../state/ui'
import { Dialog } from './Dialog'
import { Icons } from './icons'

type Kind = 'png' | 'sheet' | 'gif'
const SCALES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]

export function ExportDialog() {
  const sprite = getSprite()!
  const multi = sprite.frames.length > 1
  const [kind, setKind] = useState<Kind>(multi ? 'gif' : 'png')
  const [scale, setScale] = useState(sprite.width <= 64 ? 4 : 1)
  const [layout, setLayout] = useState<SheetLayout>('row')
  const [json, setJson] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tagId, setTagId] = useState<string>('')
  const frames = exportFrames(tagId || null)
  const tagName = sprite.tags.find((tg) => tg.id === tagId)?.name
  const suffix = tagName ? '-' + tagName.replace(/[\\/:*?"<>|\s]+/g, '_') : ''

  let outW = sprite.width * scale
  let outH = sprite.height * scale
  if (kind === 'sheet') {
    const g = sheetGeometry(frames.length, outW, outH, layout)
    outW = g.width
    outH = g.height
  }

  const run = async () => {
    setBusy(true)
    try {
      if (kind === 'png') await exportPng(scale)
      else if (kind === 'sheet') await exportSheet(layout, scale, json, frames, suffix)
      else await exportGif(scale, frames, suffix)
    } finally {
      setBusy(false)
    }
  }

  const kinds: Array<{ id: Kind; title: string; sub: string }> = [
    { id: 'png', title: t('PNG'), sub: t('Current frame') },
    { id: 'sheet', title: t('Sprite sheet'), sub: t('All frames, one PNG') },
    { id: 'gif', title: t('GIF'), sub: t('Animation') }
  ]

  return (
    <Dialog title={t('Export')} icon={<Icons.export size={20} />} width={480}>
      <div className="field">
        <span className="field-label">{t('Format')}</span>
        <div className="choice-cards">
          {kinds.map((k) => (
            <button key={k.id} className={`choice-card${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)}>
              <span className="title">{k.title}</span>
              <span className="sub">{k.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {kind !== 'png' && sprite.tags.length > 0 && (
        <div className="field">
          <span className="field-label">{t('Frames')}</span>
          <div className="chips">
            <button className={`chip-btn${tagId === '' ? ' on' : ''}`} onClick={() => setTagId('')}>
              {t('All frames')}
            </button>
            {sprite.tags.map((tg) => (
              <button key={tg.id} className={`chip-btn${tagId === tg.id ? ' on' : ''}`} onClick={() => setTagId(tg.id)}>
                {tg.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === 'sheet' && (
        <div className="field">
          <span className="field-label">{t('Layout')}</span>
          <div className="row">
            <div className="seg">
              {(['row', 'column', 'grid'] as SheetLayout[]).map((l) => (
                <button key={l} className={layout === l ? 'on' : ''} onClick={() => setLayout(l)}>
                  {l === 'row' ? t('Row') : l === 'column' ? t('Column') : t('Grid')}
                </button>
              ))}
            </div>
            <label className="checkbox" style={{ marginLeft: 12 }}>
              <input type="checkbox" checked={json} onChange={(e) => setJson(e.target.checked)} />
              {t('Also save JSON data')}
            </label>
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">{t('Scale')}</span>
        <div className="chips">
          {SCALES.map((s) => (
            <button key={s} className={`chip-btn${scale === s ? ' on' : ''}`} onClick={() => setScale(s)}>
              {s}×
            </button>
          ))}
        </div>
        <div className="hint mono">
          {t('Output: {w}×{h} px', { w: outW, h: outH })}
          {kind !== 'png' && ` · ${t('{n} frames', { n: frames.length })}`}
        </div>
      </div>

      {kind === 'gif' && <div className="hint">{t('GIF keeps transparency as on/off and up to 256 colours — perfect for pixel art.')}</div>}
      {!isElectron && <div className="hint" style={{ marginTop: 6 }}>{t('In the browser the file is downloaded.')}</div>}

      <div className="footer">
        <button className="btn ghost" onClick={() => useUi.getState().openDialog(null)}>
          {t('Cancel')}
        </button>
        <button className="btn primary" disabled={busy} onClick={run}>
          <Icons.export size={16} />
          {busy ? t('Exporting…') : t('Export')}
        </button>
      </div>
    </Dialog>
  )
}
