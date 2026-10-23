# 006 — Selection, floating pixels and clipboard

**Date:** 2026-10-22
**Status:** Accepted (M2, user request: "seçim araçları, kopyala/yapıştır, tuval boyutlandırma")
**Related:** [004 — document model](004-document-model.md)

## Selection model

- A selection is a **mask**: one byte per sprite pixel (`engine/selection.ts`),
  with cached bounds. Masks are **immutable** — every change makes a new mask,
  so history entries keep references instead of copies.
- Tools: **Rectangle select** (`M`), **Lasso** (`Q`, polygon through pixel
  centres, even-odd fill + its own outline), **Magic wand** (`W`, exact colour
  of the active layer, contiguous or global). Modifiers at pointer-down:
  `Shift` add, `Alt` subtract, `Shift+Alt` intersect; a plain click deselects
  (Aseprite habits).
- Selection changes are **undo steps** that do not mark the file dirty
  (`HistoryEntry.dirty = false`). The selection is not saved in `.loom`.
- **Every drawing tool respects the selection**: strokes get the mask and the
  plot writes only selected pixels; the bucket fills, then restores pixels
  outside the mask. Delete clears only selected pixels.

## Floating pixels

Moving or pasting pixels uses one mechanism (`state/selection.ts`):

- **Lift** (Move tool inside a selection, arrow keys): selected pixels go into
  a `Floating` block, the cel underneath is cleared.
- **Paste**: the clip becomes a floating block on the active layer.
- While floating, the cel holds `base + floating` (so composite, preview and
  export need no special case); the block can be dragged with **any tool**,
  nudged with arrows (`Shift` = 8 px), flipped (`Shift+H` / `Shift+V`).
- **Enter** or clicking outside drops it as **one** undo step (pixel patch +
  selection change); **Esc** restores the cel exactly. Transparent floating
  pixels never erase what is below (Aseprite's default "opaque" paste).
- Undo/redo, layer/frame switches, structural edits, save and export first
  drop pending floating pixels (`flushPending` hook — avoids an import cycle
  between the document and selection modules).

## Clipboard

- **Copy** takes the floating block, else the selection of the active layer,
  else the layer's non-empty bounds. It goes to an **internal clip** (exact
  pixels, remembers the position) and to the **system clipboard** as PNG plus
  a text token.
- **Paste**: `Ctrl+V` is left to the browser so a `paste` event arrives with
  the clipboard data (no permission prompt). If the token matches, the exact
  internal clip is used; otherwise an image from another app is decoded. With
  no paste event (menu, palette) the async Clipboard API is tried with a
  1.5 s timeout, falling back to the internal clip.
- Placement: where it was copied from if it fits, otherwise centred.
  "Paste as new layer" (`Ctrl+Shift+V`) adds a layer first.

## Canvas transforms

`engine/transform.ts`: **Canvas size** (new buffers, anchor grid),
**Sprite size** (nearest-neighbour, keep-proportions option, 50–400 %
chips), **Crop to selection**. All are structural undo steps and replace cel
buffers instead of mutating them, so structure snapshots stay valid.

## Alternatives considered

- **Selection as rectangle only:** simpler, but lasso and wand are core pixel
  art tools.
- **Paste straight into the cel:** no floating state, but the pixels under the
  paste would be lost the moment the user moves it.
- **Electron `clipboard` module via IPC:** reliable, but the web Clipboard API
  works in both the browser build and Electron, and the paste event needs no
  permission. Revisit if other apps fail to read our PNG.
