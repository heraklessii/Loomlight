import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { checkTour, endTour, nextStep, TOUR_STEPS, useTour } from '../state/tour'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const PAD = 6
const CARD_W = 300

/** Spotlight + card over the real interface. Never blocks clicks: the user does the step itself. */
export function Tour() {
  const { active, index } = useTour()
  const [box, setBox] = useState<Box | null>(null)
  const step = TOUR_STEPS[index]

  useEffect(() => {
    if (!active) return
    const measure = () => {
      checkTour()
      const target = TOUR_STEPS[useTour.getState().index]?.target
      const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null
      const r = el?.getBoundingClientRect()
      setBox(r && r.width > 0 ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null)
    }
    measure()
    const id = window.setInterval(measure, 200)
    window.addEventListener('resize', measure)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
    }
  }, [active, index])

  if (!active || !step) return null

  // card next to the target: below if there is room, else above, else beside
  const vw = window.innerWidth
  const vh = window.innerHeight
  let cardStyle: React.CSSProperties = { left: (vw - CARD_W) / 2, top: vh / 2 - 90 }
  if (box) {
    const left = Math.max(12, Math.min(vw - CARD_W - 12, box.x + box.w / 2 - CARD_W / 2))
    if (box.y + box.h + 190 < vh) cardStyle = { left, top: box.y + box.h + 12 }
    else if (box.y > 200) cardStyle = { left, top: box.y - 12, transform: 'translateY(-100%)' }
    else cardStyle = { left: Math.min(vw - CARD_W - 12, box.x + box.w + 12), top: Math.max(12, box.y) }
  }
  const last = index === TOUR_STEPS.length - 1

  return (
    <div className="tour" aria-live="polite">
      {box ? <div className="tour-spot" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      <div className="tour-card" style={{ ...cardStyle, width: CARD_W }} role="dialog" aria-label={t(step.title)}>
        <div className="tour-count mono">
          {index + 1} / {TOUR_STEPS.length}
        </div>
        <h3>{t(step.title)}</h3>
        <p>{t(step.body)}</p>
        <div className="tour-actions">
          <button className="btn ghost" onClick={endTour}>
            {t('Skip tour')}
          </button>
          {step.action ? (
            <button
              className="btn primary"
              onClick={() => {
                step.action!.run()
                checkTour()
              }}
            >
              {t(step.action.label)}
            </button>
          ) : (
            <button className="btn primary" onClick={last ? endTour : nextStep}>
              {last ? t('Finish') : t('Next')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
