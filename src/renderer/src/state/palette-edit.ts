// Live palette-entry editing for indexed sprites (decision 010). While the
// colour picker is dragged, every pixel of the entry's colour follows it on
// the canvas; the whole gesture becomes one undo step.
//
// At the start, cels that use the colour are replaced by copies (so the old
// buffers stay intact for undo) and the affected pixel positions are
// remembered; each update rewrites only those positions.

import type { Packed } from '@engine/color'
import type { PixelImage } from '@engine/image'
import { tk } from '../i18n'
import { getSprite, pushEntry, touch } from './document'

interface Session {
  index: number
  palBefore: Packed[]
  cels: Array<{ key: string; before: PixelImage; after: PixelImage; at: Uint32Array }>
}

let session: Session | null = null

/** Starts editing palette entry `index`. Returns false when there is nothing to edit. */
export function beginPaletteEdit(index: number): boolean {
  const sprite = getSprite()
  if (!sprite || index < 0 || index >= sprite.palette.length) return false
  if (session) endPaletteEdit()
  const old = sprite.palette[index]
  const cels: Session['cels'] = []
  for (const [key, cel] of sprite.cels) {
    const at: number[] = []
    for (let i = 0; i < cel.data.length; i++) if (cel.data[i] === old) at.push(i)
    if (at.length === 0) continue
    const after: PixelImage = { width: cel.width, height: cel.height, data: cel.data.slice() }
    sprite.cels.set(key, after)
    cels.push({ key, before: cel, after, at: Uint32Array.from(at) })
  }
  session = { index, palBefore: sprite.palette.slice(), cels }
  return true
}

export function updatePaletteEdit(color: Packed): void {
  const sprite = getSprite()
  if (!sprite || !session) return
  const c = (color | 0xff000000) >>> 0
  sprite.palette[session.index] = c
  for (const { after, at } of session.cels) for (const i of at) after.data[i] = c
  touch()
}

/** Ends the gesture as one undo step (nothing is recorded if the colour did not change). */
export function endPaletteEdit(): void {
  const sprite = getSprite()
  const s = session
  session = null
  if (!sprite || !s) return
  const palAfter = sprite.palette.slice()
  if (palAfter[s.index] === s.palBefore[s.index]) {
    for (const c of s.cels) sprite.cels.set(c.key, c.before)
    touch()
    return
  }
  const bytes = s.cels.reduce((n, c) => n + c.after.data.byteLength, 0) + 64
  pushEntry({
    label: tk('Change palette colour'),
    bytes,
    undo: () => {
      const sp = getSprite()
      if (!sp) return
      sp.palette = s.palBefore.slice()
      for (const c of s.cels) sp.cels.set(c.key, c.before)
    },
    redo: () => {
      const sp = getSprite()
      if (!sp) return
      sp.palette = palAfter.slice()
      for (const c of s.cels) sp.cels.set(c.key, c.after)
    }
  })
}

export function isEditingPalette(): boolean {
  return session !== null
}
