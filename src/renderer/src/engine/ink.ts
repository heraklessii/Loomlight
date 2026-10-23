// Inks and dither patterns (decision 011). Both work per pixel inside the
// same raster path as plain drawing (rule 2): the plot decides *whether* a
// pixel is touched (dither) and *what* it becomes (ink).

import type { Packed } from './color'

export type Ink = 'simple' | 'shading'

/** Share of pixels a dithered brush paints. 'none' = every pixel. */
export type Dither = 'none' | '75' | '50' | '25' | 'checker'

export const DITHERS: Dither[] = ['none', '75', '50', '25', 'checker']

// 4×4 ordered (Bayer) matrix, values 0–15
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Whether a dither pattern paints the pixel at absolute sprite coordinates (x, y). */
export function ditherAllows(d: Dither, x: number, y: number): boolean {
  if (d === 'none') return true
  const mx = ((x % 4) + 4) % 4
  const my = ((y % 4) + 4) % 4
  if (d === 'checker') return ((mx + my) & 1) === 0
  const level = d === '75' ? 12 : d === '50' ? 8 : 4
  return BAYER4[my * 4 + mx] < level
}

/**
 * Shading ink: moves a colour one step along the palette ramp (Aseprite's
 * "shading"). `dir` +1 = towards the end of the palette, −1 = towards the
 * start. Colours that are not in the palette (or transparent) stay unchanged.
 */
export function shadeColor(c: Packed, palette: Packed[], dir: 1 | -1): Packed {
  if (c >>> 24 === 0) return c
  const i = palette.indexOf(c)
  if (i < 0) return c
  const j = Math.max(0, Math.min(palette.length - 1, i + dir))
  return palette[j]
}
