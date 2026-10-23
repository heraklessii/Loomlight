# 012 — Reference layers

**Date:** 2026-10-22
**Status:** Accepted (M3)
**Related:** [004 — document model](004-document-model.md)

## Decision

A layer can be `kind: 'reference'`: it holds one image of **any size**
(`Sprite.references`, keyed by layer id) with a position and scale in sprite
pixels. It is frame-independent.

- **Shown, never exported:** `compositeFrame` skips reference layers, so the
  preview, onion skin, PNG/GIF/sheet export and the eyedropper ignore it.
  Only the viewport draws it, in its stacking order (pixel layers below and
  above are composited in segments).
- Drawn with **smooth scaling** and the layer opacity (default 63 %) — it is a
  photo or sketch, not pixel art; the pixel-exact rule applies to pixels, not
  to tracing aids. Clipped to the sprite area.
- **Move tool** drags it (one undo step); the context bar has scale (%) and
  "Fit to sprite". Drawing tools refuse it with a message; merge down refuses.
- Saved in `.loom` (`references`, gzip RGBA like cels, up to 8192 px).
- `.aseprite` reference layers import as reference layers.

## Alternatives considered

- **Import the image as a normal layer:** exported by accident, and scaling it
  to the sprite destroys the detail the artist wants to trace.
- **Overlay outside the document (view setting):** lost on save.
