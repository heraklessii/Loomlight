// Writes build/icon.png (512×512): the woven 4×4 pixel mark on a dark tile.
// Uses the engine's own PNG encoder (Node 24 strips the TypeScript types).
import { writeFileSync, mkdirSync } from 'node:fs'
import { encodePng } from '../src/renderer/src/engine/png.ts'

const S = 512
const px = new Uint32Array(S * S)
const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
const TILE = pack(0x14, 0x14, 0x14)
const WARP = pack(0xff, 0xb5, 0x47)
const WEFT = pack(0xed, 0xed, 0xed)
const R = 96 // tile corner radius
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const cx = Math.min(x, S - 1 - x)
    const cy = Math.min(y, S - 1 - y)
    const corner = cx < R && cy < R && (R - cx) ** 2 + (R - cy) ** 2 > R * R
    if (!corner) px[y * S + x] = TILE
  }
}
const cell = 80
const gap = 16
const origin = (S - (4 * cell + 3 * gap)) / 2
for (let j = 0; j < 4; j++) {
  for (let i = 0; i < 4; i++) {
    const c = (i + j) % 2 === 0 ? WARP : WEFT
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) px[(origin + j * (cell + gap) + y) * S + origin + i * (cell + gap) + x] = c
    }
  }
}
mkdirSync(new URL('../build/', import.meta.url), { recursive: true })
writeFileSync(new URL('../build/icon.png', import.meta.url), await encodePng(px, S, S))
console.log('build/icon.png written')
