import { useUi } from '../state/ui'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.kind === 'error' ? ' error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
