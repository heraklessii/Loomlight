import { useEffect, useRef, useState } from 'react'
import { clearRecentFiles, openRecentFile, refreshRecent } from '../actions'
import { COMMANDS, isEnabled, MENUS, shortcutLabel, type MenuId } from '../commands'
import { setLocale, t, useLocale } from '../i18n'
import { getDoc, getSprite, useDocVersion } from '../state/document'
import { useEditor } from '../state/editor'
import { useUi } from '../state/ui'
import { Icons, LogoMark } from './icons'

export function TitleBar() {
  useDocVersion()
  const locale = useLocale()
  const sprite = getSprite()
  const doc = getDoc()
  const openDialog = useUi((s) => s.openDialog)
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)

  return (
    <header className="titlebar">
      <div className="brand">
        <LogoMark size={18} />
        <span>Loomlight</span>
      </div>
      <MenuBar />
      <div className="doc-title">
        {sprite && (
          <>
            <span className="name">{doc.name}</span>
            {doc.dirty && <span className="dirty-dot" title={t('Unsaved changes')} />}
            <span className="dims mono">
              {sprite.width}×{sprite.height}
            </span>
            {sprite.colorMode === 'indexed' && <span className="dims">· {t('Indexed')}</span>}
          </>
        )}
      </div>
      <div className="titlebar-actions">
        <button className="icon-btn" data-tip={`${t('Command palette')}  Ctrl+K`} data-tip-side="bottom" onClick={() => setPaletteOpen(true)}>
          <Icons.search size={17} />
        </button>
        <div className="seg" role="group" aria-label={t('Language')}>
          <button className={locale === 'en' ? 'on' : ''} onClick={() => setLocale('en')}>
            EN
          </button>
          <button className={locale === 'tr' ? 'on' : ''} onClick={() => setLocale('tr')}>
            TR
          </button>
        </div>
        {sprite && (
          <button className="btn primary" data-tour="export" onClick={() => openDialog('export')}>
            <Icons.export size={16} />
            {t('Export')}
          </button>
        )}
      </div>
    </header>
  )
}

function MenuBar() {
  const [open, setOpen] = useState<MenuId | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const recent = useUi((s) => s.recent)
  useEffect(() => {
    if (open === 'file') void refreshRecent()
  }, [open])
  // re-render checked states when toggles change
  useEditor((s) => [s.showGrid, s.onionSkin, s.showTimeline, s.playing, s.options.pixelPerfect, s.options.mirror, s.tiled].join())
  useDocVersion()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-root" ref={root}>
      {MENUS.map((m) => (
        <div className="menu-anchor" key={m.id}>
          <button
            className={`menu-button${open === m.id ? ' open' : ''}`}
            onClick={() => setOpen(open === m.id ? null : m.id)}
            onPointerEnter={() => open && setOpen(m.id)}
          >
            {t(m.label)}
          </button>
          {open === m.id && (
            <div className="menu-pop" role="menu">
              {COMMANDS.filter((c) => c.menu === m.id).map((c, i) => (
                <div key={c.id}>
                  {c.separator && i > 0 && <div className="menu-sep" />}
                  <button
                    className="menu-item"
                    role="menuitem"
                    disabled={!isEnabled(c)}
                    onClick={() => {
                      setOpen(null)
                      c.run()
                    }}
                  >
                    <span className="check">{c.checked?.() && <Icons.check size={14} />}</span>
                    <span className="label">{t(c.label)}</span>
                    {shortcutLabel(c) && <kbd>{shortcutLabel(c)}</kbd>}
                  </button>
                  {c.id === 'file.open' && recent.length > 0 && (
                    <>
                      <div className="menu-sep" />
                      <div className="menu-label">{t('Recent')}</div>
                      {recent.slice(0, 6).map((r) => (
                        <button
                          key={r.path}
                          className="menu-item"
                          title={r.path}
                          onClick={() => {
                            setOpen(null)
                            void openRecentFile(r.path)
                          }}
                        >
                          <span className="check">
                            <Icons.clock size={13} />
                          </span>
                          <span className="label">{r.name}</span>
                        </button>
                      ))}
                      <button
                        className="menu-item"
                        onClick={() => {
                          setOpen(null)
                          void clearRecentFiles()
                        }}
                      >
                        <span className="check" />
                        <span className="label hint">{t('Clear recent files')}</span>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
