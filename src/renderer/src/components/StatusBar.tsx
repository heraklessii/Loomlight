import { toHex } from '@engine/color'
import { t } from '../i18n'
import { getHistory, getSprite, useDocVersion } from '../state/document'
import { useCursor, useEditor } from '../state/editor'

export function StatusBar() {
  useDocVersion()
  const sprite = getSprite()
  const x = useCursor((s) => s.x)
  const y = useCursor((s) => s.y)
  const color = useCursor((s) => s.color)
  const zoom = useEditor((s) => s.zoom)
  const frameIndex = useEditor((s) => s.frameIndex)
  if (!sprite) return <footer className="statusbar" />
  const history = getHistory()

  return (
    <footer className="statusbar">
      <span className="item mono">
        {x !== null && y !== null ? `x ${x}  y ${y}` : t('Outside the sprite')}
      </span>
      {color !== null && (
        <span className="item mono">
          <span className="chip checker-bg" style={{ background: color >>> 24 ? toHex(color, true) : undefined }} />
          {color >>> 24 ? toHex(color) : t('transparent')}
        </span>
      )}
      <span className="spacer" />
      <span className="item">{history.undoLabel ? t('Last: {action}', { action: t(history.undoLabel) }) : ''}</span>
      <span className="item mono">
        {sprite.width}×{sprite.height}
      </span>
      <span className="item">
        {t('Frame {n} of {count}', { n: frameIndex + 1, count: sprite.frames.length })}
      </span>
      <span className="item mono">{Math.round(zoom * 100)}%</span>
    </footer>
  )
}
