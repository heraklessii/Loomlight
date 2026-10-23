// GIF89a encoder (decision 005): global palette, LZW, 1-bit transparency,
// per-frame delay, infinite loop. Pixel art usually fits 255 colours
// exactly; otherwise a popularity palette with nearest mapping is used.

export interface GifFrame {
  /** packed 0xAABBGGRR, width × height */
  pixels: Uint32Array
  delayMs: number
}

const ALPHA_CUTOFF = 128

export function encodeGif(width: number, height: number, frames: GifFrame[]): Uint8Array {
  const { palette, hasTransparent, lookup } = buildPalette(frames)
  const transparentIndex = hasTransparent ? palette.length : -1
  const colorCount = palette.length + (hasTransparent ? 1 : 0)
  const tableBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, colorCount))))
  const tableSize = 1 << tableBits

  const out = new ByteWriter()
  out.text('GIF89a')
  out.u16(width)
  out.u16(height)
  out.byte(0x80 | (7 << 4) | (tableBits - 1))
  out.byte(0)
  out.byte(0)
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] ?? 0
    out.byte(c & 255)
    out.byte((c >>> 8) & 255)
    out.byte((c >>> 16) & 255)
  }

  if (frames.length > 1) {
    out.bytes([0x21, 0xff, 0x0b])
    out.text('NETSCAPE2.0')
    out.bytes([0x03, 0x01, 0x00, 0x00, 0x00])
  }

  const minCode = Math.max(2, tableBits)
  const indices = new Uint8Array(width * height)
  for (const frame of frames) {
    for (let i = 0; i < indices.length; i++) {
      const c = frame.pixels[i]
      indices[i] = c >>> 24 < ALPHA_CUTOFF ? transparentIndex : lookup(c & 0xffffff)
    }
    // Graphic Control Extension: disposal 2 (restore to background) + transparency
    out.bytes([0x21, 0xf9, 0x04, (2 << 2) | (hasTransparent ? 1 : 0)])
    out.u16(Math.max(2, Math.round(frame.delayMs / 10)))
    out.byte(hasTransparent ? transparentIndex : 0)
    out.byte(0)
    // Image descriptor
    out.byte(0x2c)
    out.u16(0)
    out.u16(0)
    out.u16(width)
    out.u16(height)
    out.byte(0)
    out.byte(minCode)
    const data = lzwEncode(indices, minCode)
    for (let p = 0; p < data.length; p += 255) {
      const n = Math.min(255, data.length - p)
      out.byte(n)
      out.bytes(data.subarray(p, p + n))
    }
    out.byte(0)
  }
  out.byte(0x3b)
  return out.result()
}

interface PaletteResult {
  /** 0x00BBGGRR entries */
  palette: number[]
  hasTransparent: boolean
  lookup(rgb: number): number
}

function buildPalette(frames: GifFrame[]): PaletteResult {
  const counts = new Map<number, number>()
  let hasTransparent = false
  for (const f of frames) {
    const px = f.pixels
    for (let i = 0; i < px.length; i++) {
      const c = px[i]
      if (c >>> 24 < ALPHA_CUTOFF) {
        hasTransparent = true
        continue
      }
      const rgb = c & 0xffffff
      counts.set(rgb, (counts.get(rgb) ?? 0) + 1)
    }
  }
  const max = hasTransparent ? 255 : 256
  let palette = [...counts.keys()]
  if (palette.length > max) palette = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c)
  if (palette.length === 0) palette = [0]
  const index = new Map<number, number>()
  palette.forEach((c, i) => index.set(c, i))
  return {
    palette,
    hasTransparent,
    lookup(rgb) {
      const hit = index.get(rgb)
      if (hit !== undefined) return hit
      const near = nearest(palette, rgb)
      index.set(rgb, near)
      return near
    }
  }
}

function nearest(palette: number[], rgb: number): number {
  const r = rgb & 255
  const g = (rgb >>> 8) & 255
  const b = (rgb >>> 16) & 255
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i]
    const dr = (c & 255) - r
    const dg = ((c >>> 8) & 255) - g
    const db = ((c >>> 16) & 255) - b
    const d = dr * dr * 3 + dg * dg * 4 + db * db * 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Variable-length LZW as GIF expects it (same code-size rules as the decoder). */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let codeSize = minCodeSize + 1
  let next = eoi + 1
  let table = new Map<number, number>()
  const bits = new BitWriter()

  bits.write(clear, codeSize)
  if (indices.length === 0) {
    bits.write(eoi, codeSize)
    return bits.result()
  }
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = (prefix << 8) | k
    const found = table.get(key)
    if (found !== undefined) {
      prefix = found
      continue
    }
    bits.write(prefix, codeSize)
    if (next === 4096) {
      bits.write(clear, codeSize)
      table = new Map()
      codeSize = minCodeSize + 1
      next = eoi + 1
    } else {
      if (next >= 1 << codeSize) codeSize++
      table.set(key, next++)
    }
    prefix = k
  }
  bits.write(prefix, codeSize)
  bits.write(eoi, codeSize)
  return bits.result()
}

class BitWriter {
  private buf: number[] = []
  private cur = 0
  private n = 0
  write(code: number, size: number): void {
    this.cur |= code << this.n
    this.n += size
    while (this.n >= 8) {
      this.buf.push(this.cur & 255)
      this.cur >>>= 8
      this.n -= 8
    }
  }
  result(): Uint8Array {
    if (this.n > 0) this.buf.push(this.cur & 255)
    return Uint8Array.from(this.buf)
  }
}

class ByteWriter {
  private chunks: number[] = []
  byte(b: number): void {
    this.chunks.push(b & 255)
  }
  bytes(arr: ArrayLike<number>): void {
    for (let i = 0; i < arr.length; i++) this.chunks.push(arr[i] & 255)
  }
  u16(v: number): void {
    this.byte(v & 255)
    this.byte((v >>> 8) & 255)
  }
  text(s: string): void {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i))
  }
  result(): Uint8Array {
    return Uint8Array.from(this.chunks)
  }
}
