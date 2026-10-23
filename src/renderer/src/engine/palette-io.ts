// Palette files and colour reduction (decision 010).
// Formats: GIMP .gpl, Lospec .hex, JASC .pal (text); PNG is handled by the
// caller (decode → `paletteFromPixels`, encode → `paletteStrip`).

import { alpha, blue, green, pack, red, toHex, type Packed } from './color'
import type { PixelImage } from './image'

export type PaletteFormat = 'gpl' | 'hex' | 'pal' | 'png'

export const MAX_PALETTE = 256

export class PaletteFormatError extends Error {}

/** Parses a text palette by extension. Returns opaque colours in file order. */
export function parsePalette(name: string, text: string): Packed[] {
  const ext = name.toLowerCase().split('.').pop()
  const lines = text.replace(/\r/g, '').split('\n')
  const colors: Packed[] = []
  if (ext === 'gpl') {
    if (!(lines[0] ?? '').startsWith('GIMP Palette')) throw new PaletteFormatError('Not a GIMP palette')
    for (const line of lines.slice(1)) {
      const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/.exec(line)
      if (m) colors.push(pack(+m[1], +m[2], +m[3]))
    }
  } else if (ext === 'hex' || ext === 'txt') {
    for (const line of lines) {
      const m = /^\s*#?([0-9a-f]{6})\s*$/i.exec(line)
      if (m) colors.push(pack(parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)))
    }
  } else if (ext === 'pal') {
    if (lines[0]?.trim() !== 'JASC-PAL') throw new PaletteFormatError('Not a JASC palette')
    for (const line of lines.slice(3)) {
      const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/.exec(line)
      if (m) colors.push(pack(+m[1], +m[2], +m[3]))
    }
  } else throw new PaletteFormatError('Unknown palette format')
  if (colors.length === 0) throw new PaletteFormatError('The palette has no colours')
  return colors.slice(0, MAX_PALETTE)
}

export function serializePalette(format: Exclude<PaletteFormat, 'png'>, colors: Packed[], name: string): string {
  const rgb = (c: Packed): [number, number, number] => [red(c), green(c), blue(c)]
  if (format === 'gpl') {
    const body = colors.map((c) => {
      const [r, g, b] = rgb(c)
      return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${toHex(c).slice(1)}`
    })
    return [`GIMP Palette`, `Name: ${name}`, `Columns: 8`, `#`, ...body, ''].join('\n')
  }
  if (format === 'hex') return colors.map((c) => toHex(c).slice(1, 7)).join('\n') + '\n'
  return ['JASC-PAL', '0100', String(colors.length), ...colors.map((c) => rgb(c).join(' ')), ''].join('\r\n')
}

/** Unique opaque colours of an image in reading order (a palette PNG, or any image). */
export function paletteFromPixels(pixels: Uint32Array): Packed[] {
  const seen = new Set<Packed>()
  const out: Packed[] = []
  for (const p of pixels) {
    if (alpha(p) < 128) continue
    const c = (p | 0xff000000) >>> 0
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
    if (out.length >= MAX_PALETTE) break
  }
  if (out.length === 0) throw new PaletteFormatError('The image has no opaque colours')
  return out
}

/** One pixel per colour, in a row — the usual palette PNG. */
export function paletteStrip(colors: Packed[]): Uint32Array {
  return Uint32Array.from(colors.map((c) => (c | 0xff000000) >>> 0))
}

// --- colour reduction

/** Index of the nearest palette colour (weighted RGB distance). */
export function nearestIndex(palette: Packed[], c: Packed): number {
  const r = red(c)
  const g = green(c)
  const b = blue(c)
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i]
    const dr = red(p) - r
    const dg = green(p) - g
    const db = blue(p) - b
    const d = dr * dr * 3 + dg * dg * 4 + db * db * 2
    if (d < bestD) {
      bestD = d
      best = i
      if (d === 0) break
    }
  }
  return best
}

/** Snaps every pixel to the nearest palette colour; alpha < 128 becomes transparent. Returns true if anything changed. */
export function quantizeImage(img: PixelImage, palette: Packed[]): boolean {
  if (palette.length === 0) return false
  const cache = new Map<Packed, Packed>()
  let changed = false
  const d = img.data
  for (let i = 0; i < d.length; i++) {
    const p = d[i]
    if (p === 0) continue
    let q: Packed
    if (alpha(p) < 128) q = 0
    else {
      const hit = cache.get(p)
      if (hit !== undefined) q = hit
      else {
        q = palette[nearestIndex(palette, p)]
        cache.set(p, q)
      }
    }
    if (q !== p) {
      d[i] = q
      changed = true
    }
  }
  return changed
}

/**
 * Palette swap: pixels with colour from[i] become to[i]. Colours from[i]
 * beyond `to` snap to the nearest colour of `to`. Returns true if anything changed.
 */
export function remapByIndex(img: PixelImage, from: Packed[], to: Packed[]): boolean {
  if (to.length === 0) return false
  const map = new Map<Packed, Packed>()
  from.forEach((c, i) => {
    if (!map.has(c)) map.set(c, i < to.length ? to[i] : to[nearestIndex(to, c)])
  })
  let changed = false
  const d = img.data
  for (let i = 0; i < d.length; i++) {
    const q = map.get(d[i])
    if (q !== undefined && q !== d[i]) {
      d[i] = q
      changed = true
    }
  }
  return changed
}

export function isOpaque(c: Packed): boolean {
  return alpha(c) === 255
}
