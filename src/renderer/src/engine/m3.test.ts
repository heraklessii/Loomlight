import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { AsepriteError, readAseprite } from './aseprite'
import { pack } from './color'
import { readLoom, writeLoom } from './format'
import { createImage, getPixel } from './image'
import { ditherAllows, shadeColor } from './ink'
import { nearestIndex, paletteFromPixels, parsePalette, quantizeImage, remapByIndex, serializePalette } from './palette-io'
import { addLayer, celKey, compositeFrame, createSprite, ensureCel } from './sprite'
import { beginStroke, DEFAULT_TOOL_OPTIONS, type ToolOptions } from './tools'

const R = pack(255, 0, 0)
const G = pack(0, 255, 0)
const B = pack(0, 0, 255)
const opts = (o: Partial<ToolOptions> = {}): ToolOptions => ({ ...DEFAULT_TOOL_OPTIONS, ...o })

describe('ink and dither', () => {
  it('dither patterns paint the expected share of a 4×4 block', () => {
    const share = (d: Parameters<typeof ditherAllows>[0]) => {
      let n = 0
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherAllows(d, x, y)) n++
      return n
    }
    expect([share('none'), share('75'), share('50'), share('25'), share('checker')]).toEqual([16, 12, 8, 4, 8])
    expect(ditherAllows('checker', -1, 0)).toBe(ditherAllows('checker', 3, 0))
  })
  it('shading moves one step along the palette, once per stroke', () => {
    expect(shadeColor(R, [R, G, B], 1)).toBe(G)
    expect(shadeColor(B, [R, G, B], 1)).toBe(B)
    expect(shadeColor(R, [R, G, B], -1)).toBe(R)
    expect(shadeColor(pack(1, 2, 3), [R, G, B], 1)).toBe(pack(1, 2, 3))
    const cel = createImage(4, 1, R)
    const s = beginStroke({ tool: 'pencil', cel, x: 0, y: 0, color: 0, options: opts({ ink: 'shading' }), palette: [R, G, B], shadeDir: 1 })!
    s.move(3, 0, false)
    s.move(0, 0, false) // back over the same pixels: no second step
    s.end()
    expect([...cel.data]).toEqual([G, G, G, G])
  })
  it('dithered pencil paints a checker', () => {
    const cel = createImage(4, 1)
    const s = beginStroke({ tool: 'pencil', cel, x: 0, y: 0, color: R, options: opts({ dither: 'checker' }) })!
    s.move(3, 0, false)
    s.end()
    expect([...cel.data].map((p) => (p ? 1 : 0))).toEqual([1, 0, 1, 0])
  })
  it('tiled mode wraps strokes and fills', () => {
    const cel = createImage(4, 4)
    const s = beginStroke({ tool: 'pencil', cel, x: 5, y: -1, color: R, options: opts(), wrap: 'both' })!
    s.end()
    expect(getPixel(cel, 1, 3)).toBe(R)
    const noWrap = createImage(4, 4)
    beginStroke({ tool: 'pencil', cel: noWrap, x: 5, y: -1, color: R, options: opts() })!.end()
    expect(noWrap.data.every((p) => p === 0)).toBe(true)
  })
})

describe('palette files and colour reduction', () => {
  const colors = [R, G, B]
  it('round-trips GIMP, Lospec hex and JASC palettes', () => {
    for (const fmt of ['gpl', 'hex', 'pal'] as const) {
      expect(parsePalette(`p.${fmt}`, serializePalette(fmt, colors, 'Test'))).toEqual(colors)
    }
    expect(parsePalette('a.hex', '#FF0000\n00ff00\n\n')).toEqual([R, G])
    expect(() => parsePalette('a.gpl', 'nope')).toThrow()
    expect(() => parsePalette('a.xyz', 'ff0000')).toThrow()
  })
  it('reads palette images and snaps colours', () => {
    expect(paletteFromPixels(new Uint32Array([R, 0, R, G]))).toEqual([R, G])
    expect(nearestIndex(colors, pack(250, 10, 10))).toBe(0)
    const img = createImage(3, 1)
    img.data.set([pack(240, 5, 5), pack(0, 0, 255, 60), pack(10, 250, 20)])
    expect(quantizeImage(img, colors)).toBe(true)
    expect([...img.data]).toEqual([R, 0, G])
  })
  it('swaps palettes by index', () => {
    const img = createImage(3, 1)
    img.data.set([R, G, B])
    remapByIndex(img, [R, G, B], [B, R])
    expect([...img.data]).toEqual([B, R, B]) // index 2 has no partner: nearest of the new palette
  })
})

describe('.loom M3 fields', () => {
  it('keeps colour mode and reference layers, never composites references', async () => {
    const sp = createSprite(2, 1, 0, [R, G], 'Base')
    sp.colorMode = 'indexed'
    const ref = addLayer(sp, 1, 'Ref')
    ref.kind = 'reference'
    sp.references.set(ref.id, { image: { width: 1, height: 1, data: new Uint32Array([B]) }, x: 3, y: -2, scale: 2.5 })
    ensureCel(sp, sp.layers[0].id, sp.frames[0].id).data.set([R, 0])
    const out = new Uint32Array(2)
    compositeFrame(sp, 0, out)
    expect([...out]).toEqual([R, 0])
    const back = await readLoom(await writeLoom(sp))
    expect(back.colorMode).toBe('indexed')
    expect(back.layers[1].kind).toBe('reference')
    const r = back.references.get(back.layers[1].id)!
    expect([r.x, r.y, r.scale, r.image.data[0]]).toEqual([3, -2, 2.5, B])
  })
})

// --- a tiny .aseprite writer, enough to exercise the importer

function aseFile(opts: { w: number; h: number; depth: 32 | 8; frames: Array<{ duration: number; chunks: Uint8Array[] }> }): Uint8Array {
  const frames = opts.frames.map((f) => {
    const body = concat(f.chunks)
    const head = new Uint8Array(16)
    const dv = new DataView(head.buffer)
    dv.setUint32(0, 16 + body.length, true)
    dv.setUint16(4, 0xf1fa, true)
    dv.setUint16(6, f.chunks.length, true)
    dv.setUint16(8, f.duration, true)
    dv.setUint32(12, f.chunks.length, true)
    return concat([head, body])
  })
  const body = concat(frames)
  const head = new Uint8Array(128)
  const dv = new DataView(head.buffer)
  dv.setUint32(0, 128 + body.length, true)
  dv.setUint16(4, 0xa5e0, true)
  dv.setUint16(6, opts.frames.length, true)
  dv.setUint16(8, opts.w, true)
  dv.setUint16(10, opts.h, true)
  dv.setUint16(12, opts.depth, true)
  dv.setUint32(14, 1, true) // layer opacity valid
  head[28] = 0 // transparent index
  return concat([head, body])
}

function chunk(type: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(6 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, out.length, true)
  dv.setUint16(4, type, true)
  out.set(data, 6)
  return out
}

function bytesOf(...parts: Array<[number, 'b' | 'w' | 's' | 'd'] | Uint8Array | string>): Uint8Array {
  const out: number[] = []
  for (const p of parts) {
    if (p instanceof Uint8Array) out.push(...p)
    else if (typeof p === 'string') {
      const t = new TextEncoder().encode(p)
      out.push(t.length & 255, t.length >> 8, ...t)
    } else {
      const [v, k] = p
      const n = k === 'b' ? 1 : k === 'd' ? 4 : 2
      for (let i = 0; i < n; i++) out.push((v >> (8 * i)) & 255)
    }
  }
  return Uint8Array.from(out)
}

const layerChunk = (name: string, flags = 1, type = 0, level = 0, opacity = 255) =>
  chunk(0x2004, bytesOf([flags, 'w'], [type, 'w'], [level, 'w'], [0, 'w'], [0, 'w'], [0, 'w'], [opacity, 'b'], new Uint8Array(3), name))

const celHead = (layer: number, x: number, y: number, type: number, opacity = 255) => bytesOf([layer, 'w'], [x, 's'], [y, 's'], [opacity, 'b'], [type, 'w'], [0, 's'], new Uint8Array(5))

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

describe('.aseprite import', () => {
  it('reads RGBA layers, raw / compressed / linked cels, groups and tags', async () => {
    const rgba = (...cs: number[][]) => Uint8Array.from(cs.flat())
    const raw = concat([celHead(1, 1, 0, 0), bytesOf([2, 'w'], [1, 'w']), rgba([255, 0, 0, 255], [0, 255, 0, 255])])
    const zipped = concat([celHead(2, 0, 0, 2, 128), bytesOf([1, 'w'], [1, 'w']), deflateSync(rgba([0, 0, 255, 255]))])
    const tags = chunk(0x2018, bytesOf([1, 'w'], new Uint8Array(8), [0, 'w'], [1, 'w'], [2, 'b'], [0, 'w'], new Uint8Array(6), Uint8Array.from([10, 20, 30, 0]), 'walk'))
    const file = aseFile({
      w: 3,
      h: 2,
      depth: 32,
      frames: [
        { duration: 120, chunks: [layerChunk('Group', 1, 1, 0), layerChunk('Body', 1, 0, 1), layerChunk('Top', 1, 0, 0), chunk(0x2005, raw), chunk(0x2005, zipped), tags] },
        { duration: 80, chunks: [chunk(0x2005, concat([celHead(1, 0, 0, 1), bytesOf([0, 'w'])]))] }
      ]
    })
    const { sprite, warnings } = await readAseprite(file)
    expect(warnings).toEqual([])
    expect([sprite.width, sprite.height]).toEqual([3, 2])
    expect(sprite.layers.map((l) => l.name)).toEqual(['Body', 'Top'])
    expect(sprite.frames.map((f) => f.duration)).toEqual([120, 80])
    const body0 = sprite.cels.get(celKey(sprite.layers[0].id, sprite.frames[0].id))!
    expect([...body0.data]).toEqual([0, R, G, 0, 0, 0])
    const body1 = sprite.cels.get(celKey(sprite.layers[0].id, sprite.frames[1].id))!
    expect([...body1.data]).toEqual([...body0.data])
    expect(body1.data).not.toBe(body0.data)
    const top = sprite.cels.get(celKey(sprite.layers[1].id, sprite.frames[0].id))!
    expect(top.data[0]).toBe(pack(0, 0, 255, 128)) // cel opacity baked into alpha
    expect(sprite.tags).toHaveLength(1)
    expect(sprite.tags[0]).toMatchObject({ name: 'walk', direction: 'pingpong', color: '#0a141e' })
  })
  it('reads indexed sprites with their palette and transparent index', async () => {
    const pal = chunk(0x2019, bytesOf([3, 'd'], [0, 'd'], [2, 'd'], new Uint8Array(8), [0, 'w'], Uint8Array.from([0, 0, 0, 0]), [0, 'w'], Uint8Array.from([255, 0, 0, 255]), [0, 'w'], Uint8Array.from([0, 0, 255, 255])))
    const cel = concat([celHead(0, 0, 0, 0), bytesOf([3, 'w'], [1, 'w']), Uint8Array.from([1, 0, 2])])
    const { sprite } = await readAseprite(aseFile({ w: 3, h: 1, depth: 8, frames: [{ duration: 100, chunks: [pal, layerChunk('L'), chunk(0x2005, cel)] }] }))
    expect(sprite.colorMode).toBe('indexed')
    expect(sprite.palette).toEqual([R, B])
    expect([...sprite.cels.values()][0].data).toEqual(new Uint32Array([R, 0, B]))
  })
  it('refuses other files', async () => {
    await expect(readAseprite(new Uint8Array(200))).rejects.toBeInstanceOf(AsepriteError)
  })
})
