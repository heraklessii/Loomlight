import { useState } from 'react'
import type { RecoveryData } from '@shared/ipc'
import { restoreRecovery } from '../actions'
import { getLocale, t } from '../i18n'
import { discardRecovery } from '../state/autosave'
import { useUi } from '../state/ui'
import { Dialog } from './Dialog'
import { Icons } from './icons'

export function RecoveryDialog({ data }: { data: RecoveryData }) {
  const [busy, setBusy] = useState(false)
  const when = new Date(data.meta.savedAt).toLocaleString(getLocale() === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const close = () => useUi.getState().openDialog(null)

  return (
    <Dialog title={t('Recover unsaved work?')} icon={<Icons.undo size={20} />}>
      <p className="hint" style={{ fontSize: 'var(--fs-m)', marginTop: 0 }}>
        {t('Loomlight was closed with unsaved changes. A recovery copy of {name} from {time} is available.', { name: data.meta.name, time: when })}
      </p>
      <div className="footer">
        <button
          className="btn ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await discardRecovery()
            close()
          }}
        >
          {t('Discard')}
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await restoreRecovery(data)
            close()
          }}
        >
          {t('Recover')}
        </button>
      </div>
    </Dialog>
  )
}
