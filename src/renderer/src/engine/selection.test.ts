import { describe, expect, it } from 'vitest'
import { pack } from './color'
import { createImage, getPixel, setPixel } from './image'
import { combineMasks, invertMask, maskEdges, polygonMask, rectMask, selectAll, shapeToMask, wandMask } from './selection'
import { anchorOffset, clearMasked, extract, flipFloating, floatingFromPixels, resizeCanvas, scaleSprite, stamp, cropSprite } from './transform'
import { beginStroke, DEFAULT_TOOL_OPTIONS } from './tools'
import { celKey, createSprite, ensureCel } from './sprite'

const RED = pack(255, 0, 0)
const BLUE = pack(0, 0, 255)

const count = (d: Uint8Array) => d.reduce((s, v) => s + v, 0)

describe('selection masks', () => {
  it('builds clipped rectangles with bounds', () => {
    const m = rectMask(8, 8, 6, 6, 10, 2)!
    expect(m.bounds).toEqual({ x: 6, y: 2, w: 2, h: 5 })
    expect(count(m.data)).toBe(10)
    expect(rectMask(4, 4, 9, 9, 12, 12)).toBeNull()
  })
  it('fills lasso polygons including the outline', () => {
    const m = polygonMask(10, 10, [[1, 1], [8, 1], [8, 8], [1, 8]])!
    expect(m.bounds).toEqual({ x: 1, y: 1, w: 8, h: 8 })
    expect(count(m.data)).toBe(64)
    const tri = polygonMask(10, 10, [[0, 0], [9, 0], [0, 9]])!
    expect(tri.data[0]).toBe(1)
    expect(tri.data[9 * 10 + 9]).toBe(0)
  })
  it('magic wand selects contiguous or global colour', () => {
    const img = createImage(5, 1)
    img.data.set([RED, RED, BLUE, RED, RED])
    expect(count(wandMask(img, 0, 0, true)!.data)).toBe(2)
    expect(count(wandMask(img, 0, 0, false)!.data)).toBe(4)
  })
  it('combines add / subtract / intersect and inverts', () => {
    const a = rectMask(6, 1, 0, 0, 3, 0)
    const b = rectMask(6, 1, 2, 0, 5, 0)
    expect(count(combineMasks(a, b, 'add')!.data)).toBe(6)
    expect(count(combineMasks(a, b, 'subtract')!.data)).toBe(2)
    expect(count(combineMasks(a, b, 'intersect')!.data)).toBe(2)
    expect(combineMasks(null, b, 'subtract')).toBeNull()
    expect(combineMasks(a, b, 'replace')).toBe(b)
    expect(count(invertMask(a, 6, 1)!.data)).toBe(2)
    expect(invertMask(selectAll(6, 1), 6, 1)).toBeNull()
  })
  it('outlines a shape with merged segments', () => {
    // a 2×2 square → 4 segments
    expect(maskEdges(new Uint8Array([1, 1, 1, 1]), 2, 2)).toHaveLength(16)
  })
  it('places shapes and clips them', () => {
    const m = shapeToMask(new Uint8Array([1, 1, 1, 1]), 2, 2, 3, 3, 4, 4)!
    expect(m.bounds).toEqual({ x: 3, y: 3, w: 1, h: 1 })
  })
})

describe('strokes inside a selection', () => {
  it('pencil and bucket only touch selected pixels', () => {
    const cel = createImage(6, 1)
    const mask = rectMask(6, 1, 0, 0, 2, 0)!.data
    const s = beginStroke({ tool: 'pencil', cel, x: 0, y: 0, color: RED, options: DEFAULT_TOOL_OPTIONS, mask })!
    s.move(5, 0, false)
    s.end()
    expect([...cel.data].map((p) => (p ? 1 : 0))).toEqual([1, 1, 1, 0, 0, 0])
    const fill = beginStroke({ tool: 'bucket', cel, x: 4, y: 0, color: BLUE, options: DEFAULT_TOOL_OPTIONS, mask })!
    expect(fill.end()).toBeNull()
  })
})

describe('floating pixels', () => {
  it('lifts, moves, flips and stamps', () => {
    const cel = createImage(4, 4)
    setPixel(cel, 1, 1, RED)
    setPixel(cel, 2, 1, BLUE)
    const mask = rectMask(4, 4, 1, 1, 2, 1)!
    const f = extract(cel, mask)
    clearMasked(cel, mask)
    expect(getPixel(cel, 1, 1)).toBe(0)
    const flipped = flipFloating({ ...f, x: 0, y: 3 }, 'horizontal')
    stamp(cel, flipped)
    expect(getPixel(cel, 0, 3)).toBe(BLUE)
    expect(getPixel(cel, 1, 3)).toBe(RED)
  })
  it('transparent floating pixels keep what is below; off-canvas is clipped', () => {
    const cel = createImage(2, 2, RED)
    stamp(cel, floatingFromPixels(new Uint32Array([0, BLUE, BLUE, BLUE]), 2, 2, 1, 1))
    expect(getPixel(cel, 1, 1)).toBe(RED)
    expect([...cel.data].filter((p) => p === BLUE)).toHaveLength(0)
  })
})

describe('canvas transforms', () => {
  it('anchors and resizes every cel', () => {
    expect(anchorOffset('c', 4, 4, 8, 6)).toEqual({ dx: 2, dy: 1 })
    expect(anchorOffset('se', 4, 4, 2, 2)).toEqual({ dx: -2, dy: -2 })
    const sp = createSprite(2, 2, 0, [], 'L')
    const cel = ensureCel(sp, sp.layers[0].id, sp.frames[0].id)
    cel.data.set([RED, 0, 0, BLUE])
    resizeCanvas(sp, 4, 4, 1, 1)
    const out = sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!
    expect(out.width).toBe(4)
    expect(getPixel(out, 1, 1)).toBe(RED)
    expect(getPixel(out, 2, 2)).toBe(BLUE)
    expect(cel.data[0]).toBe(RED) // old buffer untouched (history keeps it)
    cropSprite(sp, { x: 2, y: 2, w: 1, h: 1 })
    expect(sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data[0]).toBe(BLUE)
  })
  it('scales with nearest neighbour', () => {
    const sp = createSprite(2, 1, 0, [], 'L')
    ensureCel(sp, sp.layers[0].id, sp.frames[0].id).data.set([RED, BLUE])
    scaleSprite(sp, 4, 2)
    expect([...sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data]).toEqual([RED, RED, BLUE, BLUE, RED, RED, BLUE, BLUE])
    scaleSprite(sp, 2, 1)
    expect([...sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data]).toEqual([RED, BLUE])
  })
})
