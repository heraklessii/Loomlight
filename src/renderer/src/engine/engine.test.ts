import { describe, expect, it } from 'vitest'
import { blendOver, hsvToPacked, pack, packedToHsv, parseHex, toHex } from './color'
import { readLoom, writeLoom, LoomFormatError } from './format'
import { encodeGif, lzwEncode } from './gif'
import { History, pixelPatch, structureChange } from './history'
import { createImage, getPixel, setPixel } from './image'
import { brushOffsets, ellipse, floodFill, line, rect } from './raster'
import { buildSheet, sheetGeometry } from './sheet'
import { upscale } from './scale'
import { encodePng } from './png'
import { addFrame, addLayer, celKey, compositeFrame, createSprite, ensureCel, mergeDown, removeLayer, snapshotStructure } from './sprite'
import { beginStroke, DEFAULT_TOOL_OPTIONS, type ToolOptions } from './tools'

const RED = pack(255, 0, 0)
const BLUE = pack(0, 0, 255)

function points(fn: (plot: (x: number, y: number) => void) => void): string[] {
  const out: string[] = []
  fn((x, y) => out.push(`${x},${y}`))
  return out
}

function render(w: number, h: number, pts: string[]): string {
  const grid = Array.from({ length: h }, () => Array(w).fill('.'))
  for (const p of pts) {
    const [x, y] = p.split(',').map(Number)
    grid[y][x] = '#'
  }
  return grid.map((r) => r.join('')).join('\n')
}

describe('color', () => {
  it('packs in ImageData byte order', () => {
    const c = pack(1, 2, 3, 4)
    const bytes = new Uint8Array(new Uint32Array([c]).buffer)
    expect([...bytes]).toEqual([1, 2, 3, 4])
  })
  it('round-trips hex', () => {
    expect(toHex(parseHex('#be4a2f')!)).toBe('#be4a2f')
    expect(toHex(parseHex('abc')!)).toBe('#aabbcc')
    expect(toHex(parseHex('#11223380')!)).toBe('#11223380')
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('zzzzzz')).toBeNull()
  })
  it('round-trips hsv', () => {
    for (const hex of ['#be4a2f', '#0099db', '#ffffff', '#000000', '#63c74d']) {
      const c = parseHex(hex)!
      expect(toHex(hsvToPacked(packedToHsv(c)))).toBe(hex)
    }
  })
  it('blends source-over', () => {
    expect(blendOver(RED, BLUE)).toBe(BLUE)
    expect(blendOver(0, pack(0, 0, 255, 128))).toBe(pack(0, 0, 255, 128))
    const half = blendOver(pack(255, 255, 255), pack(0, 0, 0), 128)
    expect(half & 255).toBe(127)
  })
})

describe('raster', () => {
  it('draws Bresenham lines with both ends', () => {
    const pts = points((p) => line(0, 0, 4, 2, p))
    expect(pts[0]).toBe('0,0')
    expect(pts.at(-1)).toBe('4,2')
    expect(pts).toHaveLength(5)
    expect(points((p) => line(3, 3, 3, 3, p))).toEqual(['3,3'])
  })
  it('draws rectangle outlines without duplicates', () => {
    const pts = points((p) => rect(0, 0, 3, 2, false, p))
    expect(new Set(pts).size).toBe(pts.length)
    expect(render(4, 3, pts)).toBe('####\n#..#\n####')
  })
  it('draws ellipses inside their box, symmetric, even sizes too', () => {
    for (const [w, h] of [[5, 5], [6, 4], [8, 8], [3, 7], [16, 9]]) {
      const pts = points((p) => ellipse(0, 0, w - 1, h - 1, false, p))
      const set = new Set(pts)
      for (const s of set) {
        const [x, y] = s.split(',').map(Number)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(w)
        expect(y).toBeLessThan(h)
        expect(set.has(`${w - 1 - x},${y}`)).toBe(true)
        expect(set.has(`${x},${h - 1 - y}`)).toBe(true)
      }
      // touches all four sides of the box
      const xs = [...set].map((s) => Number(s.split(',')[0]))
      const ys = [...set].map((s) => Number(s.split(',')[1]))
      expect(Math.min(...xs)).toBe(0)
      expect(Math.max(...xs)).toBe(w - 1)
      expect(Math.min(...ys)).toBe(0)
      expect(Math.max(...ys)).toBe(h - 1)
    }
    expect(render(5, 5, points((p) => ellipse(0, 0, 4, 4, false, p)))).toBe('.###.\n#...#\n#...#\n#...#\n.###.')
  })
  it('fills ellipses as solid spans', () => {
    const filled = new Set(points((p) => ellipse(0, 0, 6, 6, true, p)))
    expect(filled.has('3,3')).toBe(true)
    expect(filled.has('0,0')).toBe(false)
  })
  it('builds brush footprints', () => {
    expect(brushOffsets(1, 'square')).toEqual([[0, 0]])
    expect(brushOffsets(2, 'round')).toHaveLength(4)
    expect(brushOffsets(3, 'round')).toHaveLength(5) // plus
    expect(brushOffsets(3, 'square')).toHaveLength(9)
  })
  it('flood fills contiguous and global', () => {
    const img = createImage(5, 5)
    for (let y = 0; y < 5; y++) setPixel(img, 2, y, RED) // wall
    expect(floodFill(img, 0, 0, BLUE, true)).toBe(true)
    expect(getPixel(img, 1, 4)).toBe(BLUE)
    expect(getPixel(img, 3, 0)).toBe(0)
    expect(floodFill(img, 0, 0, BLUE, true)).toBe(false)
    floodFill(img, 2, 2, BLUE, false)
    expect(getPixel(img, 2, 0)).toBe(BLUE)
  })
})

describe('tools', () => {
  const opts = (o: Partial<ToolOptions> = {}): ToolOptions => ({ ...DEFAULT_TOOL_OPTIONS, ...o })

  it('pencil connects fast moves and reports the dirty rect', () => {
    const cel = createImage(10, 10)
    const s = beginStroke({ tool: 'pencil', cel, x: 0, y: 0, color: RED, options: opts() })!
    s.move(9, 0, false)
    const r = s.end()!
    expect(r.rect).toEqual({ x: 0, y: 0, w: 10, h: 1 })
    for (let x = 0; x < 10; x++) expect(getPixel(cel, x, 0)).toBe(RED)
    expect(r.before.every((p) => p === 0)).toBe(true)
  })
  it('pixel-perfect removes L corners', () => {
    const cel = createImage(6, 6)
    const s = beginStroke({ tool: 'pencil', cel, x: 0, y: 0, color: RED, options: opts({ pixelPerfect: true }) })!
    s.move(1, 0, false)
    s.move(1, 1, false)
    s.move(2, 1, false)
    s.move(2, 2, false)
    s.end()
    expect(getPixel(cel, 1, 0)).toBe(0)
    expect(getPixel(cel, 1, 1)).toBe(RED)
    expect(getPixel(cel, 2, 1)).toBe(0)
    expect(getPixel(cel, 2, 2)).toBe(RED)
  })
  it('shape preview equals commit and restores on each move', () => {
    const cel = createImage(10, 10)
    const s = beginStroke({ tool: 'rectangle', cel, x: 1, y: 1, color: RED, options: opts() })!
    s.move(8, 8, false)
    s.move(3, 3, false)
    s.end()
    expect(getPixel(cel, 8, 8)).toBe(0)
    expect(getPixel(cel, 3, 3)).toBe(RED)
    expect(getPixel(cel, 2, 2)).toBe(0)
  })
  it('shift constrains rectangles to squares', () => {
    const cel = createImage(10, 10)
    const s = beginStroke({ tool: 'rectangle', cel, x: 0, y: 0, color: RED, options: opts({ filled: true }) })!
    s.move(5, 2, true)
    s.end()
    expect(getPixel(cel, 5, 5)).toBe(RED)
  })
  it('mirror paints the opposite side', () => {
    const cel = createImage(8, 4)
    const s = beginStroke({ tool: 'pencil', cel, x: 1, y: 1, color: RED, options: opts({ mirror: 'horizontal' }) })!
    s.end()
    expect(getPixel(cel, 6, 1)).toBe(RED)
  })
  it('eraser clears and cancel restores', () => {
    const cel = createImage(4, 4, RED)
    const s = beginStroke({ tool: 'eraser', cel, x: 1, y: 1, color: BLUE, options: opts() })!
    expect(getPixel(cel, 1, 1)).toBe(0)
    s.cancel()
    expect(getPixel(cel, 1, 1)).toBe(RED)
  })
  it('move shifts the cel content', () => {
    const cel = createImage(4, 4)
    setPixel(cel, 0, 0, RED)
    const s = beginStroke({ tool: 'move', cel, x: 1, y: 1, color: 0, options: opts() })!
    s.move(3, 2, false)
    s.end()
    expect(getPixel(cel, 2, 1)).toBe(RED)
    expect(getPixel(cel, 0, 0)).toBe(0)
  })
})

describe('sprite + history', () => {
  it('composites layers with opacity', () => {
    const sp = createSprite(2, 1, 0, [], 'Layer 1')
    const top = addLayer(sp, 1, 'Layer 2')
    ensureCel(sp, sp.layers[0].id, sp.frames[0].id).data.fill(RED)
    const c = ensureCel(sp, top.id, sp.frames[0].id)
    c.data[0] = BLUE
    const out = new Uint32Array(2)
    compositeFrame(sp, 0, out)
    expect(out[0]).toBe(BLUE)
    expect(out[1]).toBe(RED)
    top.visible = false
    compositeFrame(sp, 0, out)
    expect(out[0]).toBe(RED)
  })
  it('undoes and redoes pixel patches and structure', () => {
    const sp = createSprite(4, 4, 0, [], 'Layer 1')
    const h = new History()
    const cel = ensureCel(sp, sp.layers[0].id, sp.frames[0].id)
    const s = beginStroke({ tool: 'pencil', cel, x: 1, y: 1, color: RED, options: DEFAULT_TOOL_OPTIONS })!
    const r = s.end()!
    h.push(pixelPatch('Pencil', cel, r.rect, r.before, r.after))
    const before = snapshotStructure(sp)
    addFrame(sp, 1, sp.frames[0].id)
    h.push(structureChange('New frame', sp, before, snapshotStructure(sp)))
    expect(sp.frames).toHaveLength(2)
    h.undo()
    expect(sp.frames).toHaveLength(1)
    h.undo()
    expect(getPixel(cel, 1, 1)).toBe(0)
    h.redo()
    h.redo()
    expect(getPixel(cel, 1, 1)).toBe(RED)
    expect(sp.frames).toHaveLength(2)
    expect(getPixel(sp.cels.get(celKey(sp.layers[0].id, sp.frames[1].id))!, 1, 1)).toBe(RED)
  })
  it('drops oldest entries over the byte budget', () => {
    const h = new History(1000)
    for (let i = 0; i < 10; i++) h.push({ label: 'x', bytes: 300, undo() {}, redo() {} })
    expect(h.bytesUsed).toBeLessThanOrEqual(1000)
    expect(h.size).toBe(3)
  })
  it('keeps at least one layer and merges down', () => {
    const sp = createSprite(1, 1, 0, [], 'Layer 1')
    expect(removeLayer(sp, sp.layers[0].id)).toBe(false)
    const top = addLayer(sp, 1, 'Layer 2')
    ensureCel(sp, top.id, sp.frames[0].id).data[0] = BLUE
    mergeDown(sp, top.id)
    expect(sp.layers).toHaveLength(1)
    expect(sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data[0]).toBe(BLUE)
  })
})

describe('export', () => {
  it('upscales by integer factors', () => {
    const out = upscale(new Uint32Array([1, 2, 3, 4]), 2, 2, 2)
    expect([...out]).toEqual([1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 4, 4])
  })
  it('lays out sprite sheets', () => {
    expect(sheetGeometry(5, 16, 16, 'row')).toEqual({ columns: 5, rows: 1, width: 80, height: 16 })
    expect(sheetGeometry(5, 16, 16, 'grid')).toEqual({ columns: 3, rows: 2, width: 48, height: 32 })
    const sp = createSprite(2, 2, RED, [], 'Layer 1')
    addFrame(sp, 1, sp.frames[0].id)
    const sheet = buildSheet(sp, 'row', 1, 'a.png')
    expect(sheet.width).toBe(4)
    expect(sheet.json.frames[1].frame.x).toBe(2)
    expect(sheet.pixels.every((p) => p === RED)).toBe(true)
  })
  it('encodes LZW that a reference decoder reads back', () => {
    const data = new Uint8Array(5000)
    for (let i = 0; i < data.length; i++) data[i] = (i * 7 + (i >> 5)) % 13
    const decoded = lzwDecode(lzwEncode(data, 4), 4, data.length)
    expect([...decoded]).toEqual([...data])
  })
  it('writes a well-formed GIF', () => {
    const px = new Uint32Array([RED, 0, BLUE, RED])
    const gif = encodeGif(2, 2, [{ pixels: px, delayMs: 100 }, { pixels: px, delayMs: 50 }])
    expect(String.fromCharCode(...gif.subarray(0, 6))).toBe('GIF89a')
    expect(gif.at(-1)).toBe(0x3b)
    expect(gif[10] & 0x80).toBe(0x80)
  })
})

describe('png', () => {
  it('writes a valid RGBA PNG whose pixels inflate back byte for byte', async () => {
    const { inflateSync } = await import('node:zlib')
    const px = new Uint32Array([RED, 0, BLUE, pack(1, 2, 3, 128)])
    const png = await encodePng(px, 2, 2)
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const idatLen = new DataView(png.buffer).getUint32(33)
    const raw = inflateSync(png.subarray(41, 41 + idatLen))
    const rows = [...raw]
    expect(rows[0]).toBe(0)
    const back = new Uint8Array([...rows.slice(1, 9), ...rows.slice(10, 18)])
    expect([...new Uint32Array(back.buffer)]).toEqual([...px])
  })
})

describe('.loom format', () => {
  it('round-trips a sprite', async () => {
    const sp = createSprite(3, 2, 0, [RED, BLUE], 'Base')
    addLayer(sp, 1, 'Top').opacity = 128
    addFrame(sp, 1, sp.frames[0].id).duration = 250
    ensureCel(sp, sp.layers[1].id, sp.frames[1].id).data.set([RED, 0, BLUE, 0, 0, RED])
    const back = await readLoom(await writeLoom(sp))
    expect(back.width).toBe(3)
    expect(back.layers.map((l) => [l.name, l.opacity])).toEqual([['Base', 255], ['Top', 128]])
    expect(back.frames[1].duration).toBe(250)
    expect([...back.cels.get(celKey(sp.layers[1].id, sp.frames[1].id))!.data]).toEqual([RED, 0, BLUE, 0, 0, RED])
    expect(back.palette).toEqual([RED, BLUE])
  })
  it('refuses foreign and newer files', async () => {
    await expect(readLoom(new TextEncoder().encode('hello'))).rejects.toBeInstanceOf(LoomFormatError)
    const newer = new TextEncoder().encode(JSON.stringify({ format: 'loomlight', version: 99 }))
    await expect(readLoom(newer)).rejects.toMatchObject({ code: 'newer-version' })
  })
})

/** Minimal GIF LZW decoder for the test. */
function lzwDecode(bytes: Uint8Array, minCode: number, count: number): Uint8Array {
  const clear = 1 << minCode
  const eoi = clear + 1
  let size = minCode + 1
  let dict: number[][] = []
  const reset = (): void => {
    dict = []
    for (let i = 0; i < clear; i++) dict[i] = [i]
    dict[clear] = []
    dict[eoi] = []
    size = minCode + 1
  }
  reset()
  const out: number[] = []
  let bitPos = 0
  const read = (): number => {
    let v = 0
    for (let i = 0; i < size; i++, bitPos++) v |= ((bytes[bitPos >> 3] >> (bitPos & 7)) & 1) << i
    return v
  }
  let prev: number[] | null = null
  while (out.length < count) {
    const code = read()
    if (code === clear) {
      reset()
      prev = null
      continue
    }
    if (code === eoi) break
    let entry: number[]
    if (dict[code]) entry = dict[code]
    else entry = [...prev!, prev![0]]
    out.push(...entry)
    if (prev) dict.push([...prev, entry[0]])
    if (dict.length === 1 << size && size < 12) size++
    prev = entry
  }
  return Uint8Array.from(out)
}
