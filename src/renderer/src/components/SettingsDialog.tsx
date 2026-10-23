// Settings (decision 015): theme, language, tour, keyboard shortcuts.

import { useEffect, useMemo, useState } from 'react'
import { COMMANDS, conflictsWith, effectiveKeys, isCustomized, MENUS, specFromEvent, type Command } from '../commands'
import { setLocale, t, useLocale } from '../i18n'
import { useSettings, type ThemePref } from '../state/settings'
import { startTour } from '../state/tour'
import { useUi } from '../state/ui'
import { Dialog } from './Dialog'
import { Icons } from './icons'

type Tab = 'general' | 'shortcuts'

export function SettingsDialog() {
  const [tab, setTab] = useState<Tab>('general')
  return (
    <Dialog title={t('Settings')} icon={<Icons.grid size={20} />} width={560}>
      <div className="seg settings-tabs">
        <button className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}>
          {t('General')}
        </button>
        <button className={tab === 'shortcuts' ? 'on' : ''} onClick={() => setTab('shortcuts')}>
          {t('Keyboard shortcuts')}
        </button>
      </div>
      {tab === 'general' ? <General /> : <Shortcuts />}
    </Dialog>
  )
}

function General() {
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const locale = useLocale()
  const themes: Array<{ id: ThemePref; label: string }> = [
    { id: 'dark', label: t('Dark') },
    { id: 'light', label: t('Light') },
    { id: 'system', label: t('System') }
  ]
  return (
    <>
      <div className="field">
        <span className="field-label">{t('Theme')}</span>
        <div className="seg" style={{ justifySelf: 'start' }}>
          {themes.map((th) => (
            <button key={th.id} className={theme === th.id ? 'on' : ''} onClick={() => setTheme(th.id)}>
              {th.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">{t('Language')}</span>
        <div className="seg" style={{ justifySelf: 'start' }}>
          <button className={locale === 'en' ? 'on' : ''} onClick={() => setLocale('en')}>
            English
          </button>
          <button className={locale === 'tr' ? 'on' : ''} onClick={() => setLocale('tr')}>
            Türkçe
          </button>
        </div>
      </div>
      <div className="field">
        <span className="field-label">{t('Tour')}</span>
        <button
          className="btn"
          style={{ justifySelf: 'start' }}
          onClick={() => {
            useUi.getState().openDialog(null)
            startTour()
          }}
        >
          {t('Show the tour')}
        </button>
      </div>
    </>
  )
}

interface Pending {
  id: string
  spec: string
  conflicts: Command[]
}

function Shortcuts() {
  const shortcuts = useSettings((s) => s.shortcuts)
  const setShortcut = useSettings((s) => s.setShortcut)
  const resetShortcuts = useSettings((s) => s.resetShortcuts)
  const [query, setQuery] = useState('')
  const [recording, setRecording] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  // record the next key press; capture phase so no other shortcut (or Esc-to-close) fires
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setShortcut(recording, [])
        setRecording(null)
        return
      }
      const spec = specFromEvent(e)
      if (!spec) return
      const conflicts = conflictsWith(spec, recording)
      if (conflicts.length) setPending({ id: recording, spec, conflicts })
      else setShortcut(recording, [spec])
      setRecording(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, setShortcut])

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const label = (id: string) => {
      const m = MENUS.find((x) => x.id === id)
      return m ? t(m.label) : t('Tools')
    }
    const order = [...MENUS.map((m) => m.id), 'tools']
    return order
      .map((menu) => ({
        menu,
        title: label(menu),
        items: COMMANDS.filter((c) => c.menu === menu && (!q || `${t(c.label)} ${c.label} ${effectiveKeys(c).join(' ')}`.toLocaleLowerCase().includes(q)))
      }))
      .filter((g) => g.items.length)
    // re-run when overrides change so chips refresh
  }, [query, shortcuts])

  const replace = () => {
    if (!pending) return
    const same = (k: string) => k.toLowerCase() === pending.spec.toLowerCase()
    for (const c of pending.conflicts) setShortcut(c.id, effectiveKeys(c).filter((k) => !same(k)))
    setShortcut(pending.id, [pending.spec])
    setPending(null)
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <input className="text-input" style={{ flex: 1, height: 'var(--ctl)' }} placeholder={t('Search commands…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn ghost" onClick={resetShortcuts} disabled={Object.keys(shortcuts).length === 0}>
          {t('Reset all')}
        </button>
      </div>
      <div className="hint">{t('Click a shortcut, then press the new keys. Backspace removes it, Esc cancels.')}</div>
      {pending && (
        <div className="conflict">
          <span style={{ flex: 1 }}>
            {t('{keys} is used by {command}.', { keys: pending.spec, command: pending.conflicts.map((c) => t(c.label)).join(', ') })}
          </span>
          <button className="btn" onClick={() => setPending(null)}>
            {t('Cancel')}
          </button>
          <button className="btn primary" onClick={replace}>
            {t('Replace')}
          </button>
        </div>
      )}
      <div className="shortcut-list">
        {groups.map((g) => (
          <div key={g.menu}>
            <div className="shortcut-group">{g.title}</div>
            {g.items.map((c) => {
              const keys = effectiveKeys(c)
              const custom = isCustomized(c)
              return (
                <div className="shortcut-row" key={c.id}>
                  <span className="label">{t(c.label)}</span>
                  <button
                    className={`key-chip${recording === c.id ? ' recording' : ''}${custom ? ' custom' : ''}${keys.length ? '' : ' none'}`}
                    aria-label={t('Shortcut for {command}', { command: t(c.label) })}
                    onClick={() => setRecording(recording === c.id ? null : c.id)}
                  >
                    {recording === c.id ? t('Press keys…') : keys.length ? keys.join(' · ') : t('None')}
                  </button>
                  {custom && (
                    <button className="icon-btn small" onClick={() => setShortcut(c.id, null)} data-tip={t('Back to default')}>
                      <Icons.undo size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
