# 004 — Document model, rendering and history

**Date:** 2026-10-22
**Status:** Accepted
**Related:** [001 — tech stack](001-tech-stack.md), [005 — file format](005-file-format-and-export.md)

## Model

```
Sprite { width, height, layers[], frames[], cels: Map<"layerId:frameId", PixelImage>, palette }
PixelImage { width, height, data: Uint32Array }   // 0xAABBGGRR (little-endian RGBA bytes)
```

- **Cels are full sprite size**, no per-cel offset. Simpler raster code and
  history; memory is fine for pixel art (64×64 = 16 KB per cel).
  *Revisit* for 2048² sprites with hundreds of frames (cel bounds trimming).
- **Absent cel = empty.** A cel is allocated on the first stroke.
- **Packed colours in `ImageData` byte order**: the composite buffer is
  written to the canvas through a `Uint32Array` view, no per-pixel
  conversion. Little-endian is assumed (every Electron target is LE).
- Layer opacity 0–255 applies at composite time; pixels themselves are
  stored straight (non-premultiplied).
- Drawing **replaces** pixels (including alpha) rather than blending — the
  pixel-art expectation (what you click is what you get).

## Pixel buffers stay out of React (rule 4)

The live `Sprite` lives in `state/document.ts`. Mutations bump a revision
number; React components subscribe with `useDocRevision()`. The viewport
redraws on `requestAnimationFrame` when the revision or view changes.
Zustand holds only editor state (tool, colours, active layer/frame, view).

## Rendering

1. Composite visible layers of the frame into one `Uint32Array`
   (source-over with layer opacity).
2. Put it into a sprite-sized offscreen canvas.
3. `drawImage` scaled by the integer zoom with smoothing off, on top of a
   checkerboard; onion skin frames drawn at reduced alpha before the
   current one; grid lines and the brush preview drawn in screen space.

Zoom is an integer step table (1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64)
plus fractional "fit" values below 1 for large sprites.

## Strokes

A stroke session is created on pointer-down:

- `base` = copy of the cel before the stroke.
- Pencil/eraser: stamp the brush along the Bresenham line from the previous
  point (coalesced events included); pixel-perfect removes L-corners by
  restoring them from `base`.
- Shapes: restore from `base`, raster the shape — the same function on each
  move and on release (rule 2).
- On release: the changed rectangle is diffed against `base`; only that
  region's before/after goes to history.

## History

- **Pixel patch:** `{ cel key, rect, before, after }` — bytes = 2 × rect area × 4.
- **Structure snapshot:** layers/frames arrays (shallow copies) + the cel
  map (buffer references) before and after. Safe because undo is LIFO: when
  a structure snapshot is restored, every later pixel patch on those
  buffers has already been undone.
- Budget **256 MB**; oldest entries are dropped first. Redo stack is cleared
  on a new edit.

## Alternatives considered

- **Whole-cel snapshots per stroke:** simplest, but a 512² cel is 1 MB per
  stroke — budget gone in minutes.
- **Command replay (store tool + points):** smallest, but undo needs replay
  from a checkpoint and every tool must be deterministic forever.
- **Immutable cels (copy on write per stroke):** clean with React, but a
  copy per stroke step is wasteful; the patch approach gives the same
  safety.
