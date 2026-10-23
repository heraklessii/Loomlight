import { useEffect, useMemo, useRef, useState } from 'react'
import { COMMANDS, isEnabled, MENUS, shortcutLabel } from '../commands'
import { t } from '../i18n'
import { useUi } from '../state/ui'
import { Icons } from './icons'

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  if (!open) return null
  return <PaletteBody />
}

function PaletteBody() {
  const setOpen = useUi((s) => s.setPaletteOpen)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const groupLabel = (menu: string) => {
    const m = MENUS.find((x) => x.id === menu)
    return m ? t(m.label) : t('Tools')
  }

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return COMMANDS.filter(isEnabled).filter((c) => {
      if (!q) return true
      const hay = `${t(c.label)} ${c.label} ${groupLabel(c.menu)}`.toLocaleLowerCase()
      return q.split(/\s+/).every((w) => hay.includes(w))
    })
  }, [query])

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => setSel(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const run = (i: number) => {
    const cmd = items[i]
    if (!cmd) return
    setOpen(false)
    cmd.run()
  }

  return (
    <>
      <div className="scrim" style={{ background: 'transparent' }} onPointerDown={() => setOpen(false)} />
      <div className="cmdk" role="dialog" aria-label={t('Command palette')}>
        <div className="cmdk-input">
          <Icons.search size={18} />
          <input
            ref={inputRef}
            value={query}
            placeholder={t('Type a command…')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(items.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') run(sel)
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {items.length === 0 && <div className="cmdk-empty">{t('No matching command')}</div>}
          {items.map((c, i) => (
            <button key={c.id} className={`cmdk-item${i === sel ? ' sel' : ''}`} onPointerEnter={() => setSel(i)} onClick={() => run(i)}>
              <span className="group">{groupLabel(c.menu)}</span>
              <span className="label">{t(c.label)}</span>
              {shortcutLabel(c) && <kbd>{shortcutLabel(c)}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
