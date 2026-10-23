// Integer nearest-neighbour upscale for export (rule 1).

export function upscale(src: Uint32Array, width: number, height: number, factor: number): Uint32Array {
  const f = Math.max(1, Math.floor(factor))
  if (f === 1) return src.slice()
  const ow = width * f
  const out = new Uint32Array(ow * height * f)
  for (let y = 0; y < height; y++) {
    const row = new Uint32Array(ow)
    for (let x = 0; x < width; x++) row.fill(src[y * width + x], x * f, x * f + f)
    for (let k = 0; k < f; k++) out.set(row, (y * f + k) * ow)
  }
  return out
}

/** Copies a w × h block into a larger buffer at (dx, dy). */
export function blit(dst: Uint32Array, dstWidth: number, src: Uint32Array, w: number, h: number, dx: number, dy: number): void {
  for (let y = 0; y < h; y++) dst.set(src.subarray(y * w, (y + 1) * w), (dy + y) * dstWidth + dx)
}
