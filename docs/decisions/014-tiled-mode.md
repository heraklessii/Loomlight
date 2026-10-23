# 014 — Tiled mode

**Date:** 2026-10-22
**Status:** Accepted (M3)

## Decision

View → Tiled mode: **off / both axes / horizontal / vertical** (editor
setting, not saved in the file).

- The viewport draws the composite of the current frame in the 8 (or 2)
  neighbouring tiles around the sprite, so seams are visible while drawing.
- Strokes **wrap**: the stroke session's write function takes coordinates
  modulo the sprite size on the tiled axes, so a line drawn across the right
  edge continues on the left. The same function serves preview and commit
  (rule 2). The bucket starts at the wrapped point.
- The brush footprint and the status-bar position show the wrapped pixel.

## Not in this step

Wrap-around flood fill (a fill region continuing across the edge) and
wrapped shape previews outside the centre tile beyond what the wrapped
pixels already show.
