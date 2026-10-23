// Builds the itch.io demo sprite with Loomlight's own engine (no hand-made
// bitmaps): a 32×32 night scene with a flickering lantern — 4 layers, 4
// frames, a ping-pong tag. Writes the .loom (for screenshots), a GIF and PNGs.
//
//   npx vite-node scripts/marketing/make-demo.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { parseHex, type Packed } from '../../src/renderer/src/engine/color'
import { ditherAllows } from '../../src/renderer/src/engine/ink'
import { writeLoom } from '../../src/renderer/src/engine/format'
import { encodeGif } from '../../src/renderer/src/engine/gif'
import { setPixel } from '../../src/renderer/src/engine/image'
import { paletteColors } from '../../src/renderer/src/engine/palettes'
import { encodePng } from '../../src/renderer/src/engine/png'
import { ellipse } from '../../src/renderer/src/engine/raster'
import { upscale } from '../../src/renderer/src/engine/scale'
import { addFrame, addLayer, compositeFrame, createSprite, ensureCel } from '../../src/renderer/src/engine/sprite'

const OUT = new URL('../../marketing/itch/demo/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const hex = (h: string): Packed => parseHex(h)!
const C = {
  k: hex('#181425'),
  n1: hex('#262b44'),
  n2: hex('#3a4466'),
  G: hex('#5a6988'),
  g: hex('#3a4466'),
  y: hex('#fee761'),
  w: hex('#ffffff'),
  o: hex('#f77622'),
  a: hex('#feae34'),
  s1: hex('#c0cbdc'),
  s2: hex('#8b9bb4'),
  hill: hex('#193c3e'),
  hill2: hex('#265c42'),
  grass: hex('#3e8948'),
  stone: hex('#5a6988'),
  stone2: hex('#8b9bb4')
}

const LANTERN = [
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
  '...kkkkkkkkkk...'
]
const FLAMES = [
  ['ywyy', 'yooy', 'yoay'],
  ['yywy', 'yooy', 'yaoy'],
  ['yyyy', 'ywoy', 'yoay'],
  ['ywyy', 'yoay', 'yooy']
]
const GLOW = [10, 11, 10, 9]
const STARS: Array<[number, number, number]> = [
  [3, 3, 0], [9, 6, 1], [26, 2, 2], [22, 8, 3], [29, 11, 0], [5, 12, 2], [14, 2, 1], [18, 5, 3]
]

const W = 32
const H = 32
const sprite = createSprite(W, H, 0, paletteColors('endesga32'), 'Sky')
const glow = addLayer(sprite, 1, 'Glow')
const ground = addLayer(sprite, 2, 'Ground')
const lantern = addLayer(sprite, 3, 'Lantern')
for (let f = 1; f < 4; f++) addFrame(sprite, f, sprite.frames[0].id)
sprite.frames.forEach((fr) => (fr.duration = 140))
sprite.tags.push({ id: 'tflicker', name: 'flicker', from: sprite.frames[0].id, to: sprite.frames[3].id, color: '#e8a33d', direction: 'pingpong' })

sprite.frames.forEach((frame, f) => {
  // sky: three bands, stars twinkle per frame
  const sky = ensureCel(sprite, sprite.layers[0].id, frame.id)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setPixel(sky, x, y, y < 10 ? C.k : y < 19 ? C.n1 : C.n2)
  for (const [x, y, phase] of STARS) setPixel(sky, x, y, (f + phase) % 4 === 0 ? C.w : (f + phase) % 2 ? C.s2 : C.s1)

  // glow: dithered amber rings (the same patterns as the dither brush), breathing with the flame
  const gl = ensureCel(sprite, glow.id, frame.id)
  const r = GLOW[f]
  const ring = (inset: number, pattern: '25' | '50', color: Packed) =>
    ellipse(16 - r + inset, 18 - r + inset, 15 + r - inset, 17 + r - inset, true, (x, y) => ditherAllows(pattern, x, y) && setPixel(gl, x, y, color))
  ring(0, '25', C.n2)
  ring(2, '50', C.n2)
  ring(4, '25', hex('#733e39'))
  ring(6, '50', hex('#b86f50'))

  // ground: a hill and the stone the lantern stands on
  const gr = ensureCel(sprite, ground.id, frame.id)
  for (let x = 0; x < W; x++) {
    const top = 25 + Math.round(1.6 * Math.sin((x + 3) / 5))
    for (let y = top; y < H; y++) setPixel(gr, x, y, y === top ? C.grass : y < top + 3 ? C.hill2 : C.hill)
  }
  for (let x = 10; x < 22; x++) {
    setPixel(gr, x, 25, C.stone2)
    setPixel(gr, x, 26, C.stone)
  }

  // lantern with this frame's flame
  const ln = ensureCel(sprite, lantern.id, frame.id)
  LANTERN.forEach((row, y) => {
    let col = 0
    for (let x = 0; x < 16; x++) {
      let ch = row[x]
      if (ch === '#') ch = FLAMES[f][y - 7][col++]
      const color = (C as Record<string, Packed>)[ch]
      if (color) setPixel(ln, 8 + x, 11 + y, color)
    }
  })
})

const buf = new Uint32Array(W * H)
const frames = sprite.frames.map((fr, i) => {
  compositeFrame(sprite, i, buf)
  return { pixels: upscale(buf, W, H, 8), delayMs: fr.duration }
})
// ping-pong order for the GIF, like the tag plays it
const order = [0, 1, 2, 3, 2, 1]
writeFileSync(new URL('lantern.gif', OUT), encodeGif(W * 8, H * 8, order.map((i) => frames[i])))
compositeFrame(sprite, 0, buf)
writeFileSync(new URL('lantern-8x.png', OUT), await encodePng(upscale(buf, W, H, 8), W * 8, H * 8))
writeFileSync(new URL('lantern-1x.png', OUT), await encodePng(buf.slice(), W, H))
writeFileSync(new URL('lantern.loom', OUT), await writeLoom(sprite))
console.log('demo written to marketing/itch/demo/')
