import { useEffect, type ReactNode } from 'react'
import { t } from '../i18n'
import { useUi } from '../state/ui'
import { Icons } from './icons'

export function Dialog({ title, icon, children, width }: { title: string; icon?: ReactNode; children: ReactNode; width?: number }) {
  const close = () => useUi.getState().openDialog(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} style={width ? { width } : undefined}>
        <h2>
          {icon}
          <span style={{ flex: 1 }}>{title}</span>
          <button className="icon-btn small" onClick={close} aria-label={t('Close')}>
            <Icons.close size={15} />
          </button>
        </h2>
        {children}
      </div>
    </div>
  )
}
