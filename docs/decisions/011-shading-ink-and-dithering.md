# 011 — Shading ink and dithering

**Date:** 2026-10-22
**Status:** Accepted (M3)
**Related:** CLAUDE.md rules 1–2, `engine/ink.ts`, `engine/tools.ts`

## Shading ink (pencil)

Aseprite's beloved "shading": instead of painting a colour, each pixel moves
**one step along the palette** — left button forward, right button back.
Pixels whose colour is not in the palette (and transparent ones) stay as they
are. A pixel is shaded **once per stroke** (going back over it does not run
down the ramp). The ramp is the whole sprite palette; ordering the palette
from dark to light is how artists set it up.

*Alternative:* a separate ramp selection in the palette (Aseprite's way) —
more power, one more concept. Revisit if users ask for multiple ramps.

## Dithering

A dither pattern decides **whether** a pixel is touched; the ink decides what
it becomes. Patterns are anchored to **sprite coordinates**, so overlapping
strokes line up: `Off`, ordered (Bayer 4×4) `75 %`, `50 %`, `25 %`, and
`Checker`. Applies to pencil, line, rectangle, ellipse and the bucket.

Both live in the single write function of a stroke session, so the preview
of a shape equals the committed pixels (rule 2), and they combine with the
selection mask, mirror and tiled mode.
