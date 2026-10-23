// Packed colours in ImageData byte order on little-endian machines:
// 0xAABBGGRR, so a Uint32Array view over ImageData.data reads them directly
// (decision 004). Always keep values unsigned (>>> 0).

export type Packed = number

export const TRANSPARENT: Packed = 0

export function pack(r: number, g: number, b: number, a = 255): Packed {
  return ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0
}

export function red(c: Packed): number {
  return c & 255
}
export function green(c: Packed): number {
  return (c >>> 8) & 255
}
export function blue(c: Packed): number {
  return (c >>> 16) & 255
}
export function alpha(c: Packed): number {
  return c >>> 24
}

export function withAlpha(c: Packed, a: number): Packed {
  return ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0
}

const hex2 = (n: number): string => n.toString(16).padStart(2, '0')

/** `#rrggbb`, or `#rrggbbaa` when not fully opaque. */
export function toHex(c: Packed, forceAlpha = false): string {
  const a = alpha(c)
  const base = `#${hex2(red(c))}${hex2(green(c))}${hex2(blue(c))}`
  return a === 255 && !forceAlpha ? base : base + hex2(a)
}

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa` (with or without `#`). null when invalid. */
export function parseHex(text: string): Packed | null {
  let s = text.trim().replace(/^#/, '').toLowerCase()
  if (!/^[0-9a-f]+$/.test(s)) return null
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('')
  if (s.length !== 6 && s.length !== 8) return null
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255
  return pack(r, g, b, a)
}

export interface Hsv {
  h: number // 0–360
  s: number // 0–1
  v: number // 0–1
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = v - c
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function packedToHsv(c: Packed): Hsv {
  return rgbToHsv(red(c), green(c), blue(c))
}

export function hsvToPacked(hsv: Hsv, a = 255): Packed {
  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return pack(r, g, b, a)
}

/**
 * Source-over of `src` onto `dst` with an extra opacity (0–255) applied to
 * src. Straight (non-premultiplied) alpha in and out.
 */
export function blendOver(dst: Packed, src: Packed, opacity = 255): Packed {
  const sa = (alpha(src) * opacity) / 255
  if (sa <= 0) return dst
  const da = alpha(dst)
  if (sa >= 255 || da === 0) return withAlpha(src, Math.round(sa))
  const saN = sa / 255
  const daN = da / 255
  const outA = saN + daN * (1 - saN)
  const mix = (s: number, d: number): number => Math.round((s * saN + d * daN * (1 - saN)) / outA)
  return pack(mix(red(src), red(dst)), mix(green(src), green(dst)), mix(blue(src), blue(dst)), Math.round(outA * 255))
}

/** Relative luminance-ish, used to pick readable text over a swatch. */
export function isLight(c: Packed): boolean {
  return red(c) * 0.299 + green(c) * 0.587 + blue(c) * 0.114 > 150
}
