import { t } from '../i18n'
import { Dialog } from './Dialog'
import { LogoMark } from './icons'

export function AboutDialog() {
  return (
    <Dialog title="Loomlight" icon={<LogoMark size={22} />}>
      <div className="about">
        <p>{t('A free and open-source pixel art editor and animation tool.')}</p>
        <p className="hint">{t('Version {v} · GPL-3.0-or-later · No account, no cloud, no telemetry.', { v: '0.1.0' })}</p>
        <p className="hint">{t('Fonts: Plus Jakarta Sans, Pixelify Sans, JetBrains Mono (SIL OFL). Palettes by ENDESGA, Lexaloffle, GrafxKid and DawnBringer.')}</p>
      </div>
    </Dialog>
  )
}
