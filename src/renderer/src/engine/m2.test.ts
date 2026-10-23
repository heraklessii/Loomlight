import { describe, expect, it } from 'vitest'
import { pack } from './color'
import { readLoom, writeLoom } from './format'
import { buildSheet } from './sheet'
import { addFrame, celKey, createSprite, ensureCel, nextPlaybackFrame, removeFrame, snapshotStructure, restoreStructure, tagAt, tagRange } from './sprite'
import { flipSprite, floatingFromPixels, rotateFloating, rotateSprite, scaleFloating } from './transform'

const A = pack(255, 0, 0)
const B = pack(0, 255, 0)
const C = pack(0, 0, 255)
const D = pack(255, 255, 0)

function spriteWithFrames(n: number) {
  const sp = createSprite(2, 1, 0, [], 'L')
  for (let i = 1; i < n; i++) addFrame(sp, i)
  return sp
}

describe('floating rotate / scale', () => {
  // 2×1 block [A B] → cw: column A over B
  it('rotates 90° both ways and 180°', () => {
    const f = floatingFromPixels(new Uint32Array([A, B, C, D]), 2, 2, 4, 4)
    expect([...rotateFloating(f, 'cw').pixels]).toEqual([C, A, D, B])
    expect([...rotateFloating(f, 'ccw').pixels]).toEqual([B, D, A, C])
    expect([...rotateFloating(f, '180').pixels]).toEqual([D, C, B, A])
    const wide = floatingFromPixels(new Uint32Array([A, B, C]), 3, 1, 0, 5)
    const r = rotateFloating(wide, 'cw')
    expect([r.w, r.h, r.x, r.y]).toEqual([1, 3, 1, 4])
    expect([...r.pixels]).toEqual([A, B, C])
  })
  it('scales with nearest neighbour and keeps the shape', () => {
    const f = { ...floatingFromPixels(new Uint32Array([A, B]), 2, 1, 0, 0), shape: new Uint8Array([1, 0]) }
    const s = scaleFloating(f, 4, 2, 3, 3)
    expect([...s.pixels]).toEqual([A, A, B, B, A, A, B, B])
    expect([...s.shape]).toEqual([1, 1, 0, 0, 1, 1, 0, 0])
    expect([s.x, s.y]).toEqual([3, 3])
  })
})

describe('whole-sprite flip / rotate', () => {
  it('rotates every cel and swaps the size', () => {
    const sp = createSprite(2, 1, 0, [], 'L')
    addFrame(sp, 1)
    ensureCel(sp, sp.layers[0].id, sp.frames[0].id).data.set([A, B])
    ensureCel(sp, sp.layers[0].id, sp.frames[1].id).data.set([C, D])
    rotateSprite(sp, 'cw')
    expect([sp.width, sp.height]).toEqual([1, 2])
    expect([...sp.cels.get(celKey(sp.layers[0].id, sp.frames[1].id))!.data]).toEqual([C, D])
    rotateSprite(sp, 'ccw')
    expect([...sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data]).toEqual([A, B])
    flipSprite(sp, 'horizontal')
    expect([...sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data]).toEqual([B, A])
    rotateSprite(sp, '180')
    expect([...sp.cels.get(celKey(sp.layers[0].id, sp.frames[0].id))!.data]).toEqual([A, B])
  })
})

describe('tags', () => {
  it('finds ranges and loops forward / reverse / ping-pong', () => {
    const sp = spriteWithFrames(6)
    const f = sp.frames
    sp.tags.push({ id: 't1', name: 'walk', from: f[1].id, to: f[3].id, color: '#e8a33d', direction: 'forward' })
    expect(tagRange(sp, sp.tags[0])).toEqual([1, 3])
    expect(tagAt(sp, 2)?.name).toBe('walk')
    expect(tagAt(sp, 5)).toBeNull()
    const st = { dir: 1 as 1 | -1 }
    expect(nextPlaybackFrame(sp, 3, st)).toBe(1)
    expect(nextPlaybackFrame(sp, 5, st)).toBe(0)
    sp.tags[0].direction = 'reverse'
    expect(nextPlaybackFrame(sp, 1, st)).toBe(3)
    sp.tags[0].direction = 'pingpong'
    const seq = [1]
    for (let i = 0; i < 6; i++) seq.push(nextPlaybackFrame(sp, seq.at(-1)!, st))
    expect(seq).toEqual([1, 2, 3, 2, 1, 2, 3])
  })
  it('shrinks or drops tags when an endpoint frame is deleted', () => {
    const sp = spriteWithFrames(5)
    const f = sp.frames
    sp.tags.push({ id: 'a', name: 'a', from: f[1].id, to: f[3].id, color: '#e8a33d', direction: 'forward' })
    sp.tags.push({ id: 'b', name: 'b', from: f[4].id, to: f[4].id, color: '#e8a33d', direction: 'forward' })
    removeFrame(sp, f[1].id)
    expect(tagRange(sp, sp.tags[0])).toEqual([1, 2])
    removeFrame(sp, sp.frames[3].id)
    expect(sp.tags.map((t) => t.id)).toEqual(['a'])
  })
  it('are part of undo snapshots, .loom files and sheet JSON', async () => {
    const sp = spriteWithFrames(4)
    const before = snapshotStructure(sp)
    sp.tags.push({ id: 'x', name: 'idle', from: sp.frames[2].id, to: sp.frames[3].id, color: '#5aa9e6', direction: 'pingpong' })
    restoreStructure(sp, before)
    expect(sp.tags).toHaveLength(0)
    sp.tags.push({ id: 'x', name: 'idle', from: sp.frames[2].id, to: sp.frames[3].id, color: '#5aa9e6', direction: 'pingpong' })
    const back = await readLoom(await writeLoom(sp))
    expect(back.tags).toEqual(sp.tags)
    expect(buildSheet(sp, 'row', 1, 's.png').json.meta.frameTags).toEqual([{ name: 'idle', from: 2, to: 3, direction: 'pingpong', color: '#5aa9e6' }])
    const sub = buildSheet(sp, 'row', 1, 's.png', [2, 3])
    expect(sub.json.frames).toHaveLength(2)
    expect(sub.json.meta.frameTags[0]).toMatchObject({ from: 0, to: 1 })
  })
})
