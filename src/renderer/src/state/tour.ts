// First-run tour (decision 015): a few steps over the real interface. Each
// step points at an element marked with `data-tour` and moves on by itself
// when the user does the thing (draws, adds a frame, opens Export) — or with
// "Next". Seen once, it does not start again; Help → Show the tour reopens it.

import { create } from 'zustand'
import { BACKGROUNDS, newSprite } from '../actions'
import { tk } from '../i18n'
import { getHistory, getSprite } from './document'
import { useSettings } from './settings'
import { useUi } from './ui'

export interface TourStep {
  id: string
  /** `data-tour` value of the element to highlight; null = centred card */
  target: string | null
  title: string
  body: string
  /** the step is done when this becomes true (checked continuously) */
  done?: () => boolean
  /** the step points into the editor: without a sprite the tour goes back to the first step */
  needsSprite?: boolean
  /** replaces "Next": a button that does the step for the user (the first step cannot be skipped) */
  action?: { label: string; run: () => void }
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'start',
    target: 'new-sprite',
    title: tk('Start a sprite'),
    body: tk('Pick a size to begin — 32×32 is a good first sprite.'),
    done: () => getSprite() !== null,
    action: { label: tk('Use 32×32'), run: () => newSprite(32, 32, BACKGROUNDS.transparent) }
  },
  {
    id: 'tools',
    needsSprite: true,
    target: 'tools',
    title: tk('Your tools'),
    body: tk('Pencil B, eraser E, bucket G, eyedropper I and more. Hover a tool to see its key.')
  },
  {
    id: 'draw',
    needsSprite: true,
    target: 'canvas',
    title: tk('Draw'),
    body: tk('Draw on the canvas. Right click paints the secondary colour, Alt picks a colour, the wheel zooms.'),
    done: () => getHistory().canUndo
  },
  {
    id: 'colors',
    needsSprite: true,
    target: 'colors',
    title: tk('Colours'),
    body: tk('Choose colours here. Below, the palette can be loaded, imported and exported.')
  },
  {
    id: 'frames',
    needsSprite: true,
    target: 'frames',
    title: tk('Animate'),
    body: tk('Add a frame (Alt+N) and draw the next pose.'),
    done: () => (getSprite()?.frames.length ?? 0) > 1
  },
  {
    id: 'play',
    needsSprite: true,
    target: 'play',
    title: tk('Play'),
    body: tk('Press Enter or this button to play. Tags (Shift+click frame numbers) loop part of an animation.')
  },
  {
    id: 'export',
    needsSprite: true,
    target: 'export',
    title: tk('Export'),
    body: tk('PNG, sprite sheet or GIF — pixel-exact. Ctrl+K finds every command.'),
    done: () => useUi.getState().dialog === 'export'
  }
]

interface TourState {
  active: boolean
  index: number
}

export const useTour = create<TourState>(() => ({ active: false, index: 0 }))

function firstOpen(from: number): number {
  let i = from
  while (i < TOUR_STEPS.length && TOUR_STEPS[i].done?.()) i++
  return i
}

export function startTour(): void {
  const index = firstOpen(0)
  useTour.setState({ active: index < TOUR_STEPS.length, index })
}

export function nextStep(): void {
  const index = firstOpen(useTour.getState().index + 1)
  if (index >= TOUR_STEPS.length) endTour()
  else useTour.setState({ index })
}

export function endTour(): void {
  useTour.setState({ active: false, index: 0 })
  useSettings.getState().setTourSeen(true)
}

/** Advances when the current step's goal is reached. Called on a short timer while the tour is open. */
export function checkTour(): void {
  const { active, index } = useTour.getState()
  if (!active) return
  // an editor step without an open sprite (closed, or skipped ahead): back to the first open step
  if (TOUR_STEPS[index]?.needsSprite && !getSprite()) {
    useTour.setState({ index: firstOpen(0) })
    return
  }
  if (TOUR_STEPS[index]?.done?.()) nextStep()
}
