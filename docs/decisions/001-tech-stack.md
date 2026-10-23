# 001 — Tech stack

**Date:** 2026-10-22
**Status:** Accepted (proposal; revisit after M1 is used on real sprites)
**Related:** [002 — design language](002-design-language.md), [004 — document model](004-document-model.md)

## Decision

Electron + React + TypeScript + Vite + Zustand, packaged with
electron-builder. The **same stack as Muicut**, the author's sister project.

The drawing surface is **Canvas 2D**: cels are `Uint32Array` buffers in
`ImageData` byte order, composited in JS and blitted with
`imageSmoothingEnabled = false`.

## Why

1. **Known ground.** Muicut proved the approaches on this stack: `t()` + a
   dictionary gate for two languages, live verification, packaging,
   worklog/decision discipline. The experience carries over.
2. **Pixel art is small.** A 128×128 sprite is 16 K pixels; even
   2048×2048 × 10 layers composites in a few milliseconds in typed arrays.
   WebGL would add a second code path for little gain at these sizes and
   would make "preview = result" (rule 2) harder.
3. **Chromium pinned by Electron.** Canvas, `CompressionStream`, pointer
   events with `getCoalescedEvents` and `pointerrawupdate` behave the same on
   every machine.
4. **The renderer also runs in a plain browser** (`npm run dev:web`), so UI
   work can be iterated and verified in a browser pane without Electron.

## Alternatives considered

- **Tauri (Rust + WebView2).** Much smaller package (~10 MB vs ~100 MB). But
  WebView2's version depends on the user's Edge, and the Muicut tooling does
  not carry over. *Revisit* if package size becomes a real complaint on itch.
- **Native (C++ / SDL / Skia — Aseprite's route).** Fastest and smallest, but
  the interface would be rebuilt from scratch without web layout, and
  iteration speed drops sharply.
- **Godot (Pixelorama's route).** Good for a pixel tool, but the UI toolkit
  is Godot's own; neither the author's design system nor Muicut's
  infrastructure transfers.
- **WebGL compositor.** Deferred: only worth it if huge canvases
  (4096², 50+ layers) prove slow — measured, not assumed.

## When to revisit

- Composite + blit of a 2048×2048 sprite with 20 layers takes > 8 ms per
  stroke step → dirty-rect compositing first, WebGL second.
