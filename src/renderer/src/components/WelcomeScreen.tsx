import { useEffect, useRef } from 'react'
import { parseHex } from '@engine/color'
import { BACKGROUNDS, newSprite, openFile, openRecentFile } from '../actions'
import { t, tk } from '../i18n'
import { startTour } from '../state/tour'
import { useUi } from '../state/ui'
import { Icons, LogoMark } from './icons'

const PRESETS = [
  { size: 16, what: tk('Icon') },
  { size: 32, what: tk('Character') },
  { size: 64, what: tk('Portrait') },
  { size: 128, what: tk('Scene') }
]

export function WelcomeScreen() {
  const openDialog = useUi((s) => s.openDialog)
  const recent = useUi((s) => s.recent)
  return (
    <main className="welcome">
      <div className="welcome-inner">
        <div>
          <LogoMark size={44} />
          <h1>
            Loom<span className="light">light</span>
          </h1>
          <p className="tagline">{t('A free, open-source pixel art editor. Draw, layer, animate and export — pixel-exact.')}</p>
          <div className="actions">
            <button className="btn primary large" onClick={() => openDialog('new')}>
              <Icons.fileNew size={18} />
              {t('New sprite')}
            </button>
            <button className="btn large" onClick={() => void openFile()}>
              <Icons.folder size={18} />
              {t('Open…')}
            </button>
          </div>
          {recent.length > 0 && (
            <>
              <div className="section-label">{t('Recent')}</div>
              <div className="recent-list">
                {recent.slice(0, 5).map((r) => (
                  <button key={r.path} className="recent-item" onClick={() => void openRecentFile(r.path)} title={r.path}>
                    <Icons.clock size={15} />
                    <span className="name">{r.name}</span>
                    <span className="path">{r.path}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="section-label">{t('Quick start')}</div>
          <div className="preset-grid" data-tour="new-sprite">
            {PRESETS.map((p) => {
              const g = 12 + Math.log2(p.size) * 4
              return (
                <button key={p.size} className="preset-card" onClick={() => newSprite(p.size, p.size, BACKGROUNDS.transparent)}>
                  <span className="glyph">
                    <span style={{ width: g, height: g }} />
                  </span>
                  <span className="size">
                    {p.size}×{p.size}
                  </span>
                  <span className="what">{t(p.what)}</span>
                </button>
              )
            })}
          </div>
          <button className="tour-link" onClick={startTour}>
            {t('New here? Take the tour')}
          </button>
          <div className="tips">
            <kbd>B E G I</kbd>
            <span>{t('Pencil, eraser, bucket, eyedropper')}</span>
            <kbd>Alt+N</kbd>
            <span>{t('New animation frame')}</span>
            <kbd>Enter</kbd>
            <span>{t('Play the animation')}</span>
            <kbd>Ctrl+K</kbd>
            <span>{t('Every command, searchable')}</span>
          </div>
        </div>
        <div className="welcome-art">
          <div className="art-frame checker-bg">
            <Lantern />
          </div>
        </div>
      </div>
    </main>
  )
}

// A tiny two-frame lantern drawn by the same pixels-in, pixels-out idea as the editor.
const LANTERN_COLORS: Record<string, string> = {
  k: '#181425',
  G: '#5a6988',
  g: '#3a4466',
  y: '#fee761',
  w: '#ffffff',
  o: '#f77622',
  a: '#feae34'
}

const BASE = [
  '................',
  '......kkkk......',
  '.....k....k.....',
  '.....k....k.....',
  '...kkkkkkkkkk...',
  '...kGGGGGGGGk...',
  '...kkkkkkkkkk...',
  '....kgyyyygk....',
  '....kg####gk....',
  '....kg####gk....',
  '....kg####gk....',
  '....kgyyyygk....',
  '...kkkkkkkkkk...',
  '...kGGGGGGGGk...',
  '...kkkkkkkkkk...',
  '................'
]

const FLAMES = [
  ['ywyy', 'yooy', 'yoay'],
  ['yywy', 'yooy', 'yaoy']
]

function Lantern() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    let frame = 0
    const draw = () => {
      const img = ctx.createImageData(16, 16)
      const px = new Uint32Array(img.data.buffer)
      BASE.forEach((row, y) => {
        let flameCol = 0
        for (let x = 0; x < 16; x++) {
          let ch = row[x]
          if (ch === '#') ch = FLAMES[frame][y - 8][flameCol++]
          const hex = LANTERN_COLORS[ch]
          if (hex) px[y * 16 + x] = parseHex(hex)!
        }
      })
      ctx.putImageData(img, 0, 0)
    }
    draw()
    const id = window.setInterval(() => {
      frame = 1 - frame
      draw()
    }, 420)
    return () => window.clearInterval(id)
  }, [])
  return <canvas ref={ref} width={16} height={16} style={{ width: 256, height: 256 }} aria-label={t('Animated lantern drawn in pixel art')} />
}
