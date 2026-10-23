// Edit a frame tag: name, colour, frame range, loop direction (decision 008).

import { useState } from 'react'
import { TAG_COLORS, tagRange, type LoopDirection } from '@engine/sprite'
import { deleteTag, updateTag } from '../actions'
import { t } from '../i18n'
import { getSprite } from '../state/document'
import { useUi } from '../state/ui'
import { Dialog } from './Dialog'
import { Icons } from './icons'

export function TagDialog({ id }: { id: string }) {
  const sprite = getSprite()!
  const tag = sprite.tags.find((x) => x.id === id)
  const range = tag ? tagRange(sprite, tag) : null
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[0])
  const [direction, setDirection] = useState<LoopDirection>(tag?.direction ?? 'forward')
  const [from, setFrom] = useState((range?.[0] ?? 0) + 1)
  const [to, setTo] = useState((range?.[1] ?? 0) + 1)
  const close = () => useUi.getState().openDialog(null)
  if (!tag || !range) return null
  const n = sprite.frames.length
  const clampFrame = (v: string) => Math.max(1, Math.min(n, Math.round(Number(v) || 1)))

  const apply = () => {
    updateTag(id, { name, color, direction, from: Math.min(from, to) - 1, to: Math.max(from, to) - 1 })
    close()
  }

  const directions: Array<{ id: LoopDirection; label: string }> = [
    { id: 'forward', label: t('Forward') },
    { id: 'reverse', label: t('Reverse') },
    { id: 'pingpong', label: t('Ping-pong') }
  ]

  return (
    <Dialog title={t('Tag')} icon={<Icons.tag size={20} />}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <div className="field">
          <label htmlFor="tag-name">{t('Name')}</label>
          <input id="tag-name" className="text-input" style={{ height: 'var(--ctl)' }} value={name} onChange={(e) => setName(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        </div>
        <div className="field">
          <span className="field-label">{t('Frames')}</span>
          <div className="row">
            <input className="num-input" type="number" min={1} max={n} value={from} onChange={(e) => setFrom(clampFrame(e.target.value))} aria-label={t('From frame')} />
            <span className="hint">–</span>
            <input className="num-input" type="number" min={1} max={n} value={to} onChange={(e) => setTo(clampFrame(e.target.value))} aria-label={t('To frame')} />
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('Loop')}</span>
          <div className="seg" style={{ justifySelf: 'start' }}>
            {directions.map((d) => (
              <button type="button" key={d.id} className={direction === d.id ? 'on' : ''} onClick={() => setDirection(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('Colour')}</span>
          <div className="row">
            {TAG_COLORS.map((c) => (
              <button type="button" key={c} className={`tag-swatch${c === color ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="footer">
          <button
            type="button"
            className="btn ghost"
            style={{ marginRight: 'auto' }}
            onClick={() => {
              deleteTag(id)
              close()
            }}
          >
            <Icons.trash size={15} />
            {t('Delete tag')}
          </button>
          <button type="button" className="btn ghost" onClick={close}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn primary">
            {t('Apply')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
