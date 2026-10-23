# 010 — Indexed colour mode and palette files

**Date:** 2026-10-22
**Status:** Accepted (M3)
**Related:** [004 — document model](004-document-model.md), [005 — file format](005-file-format-and-export.md)

## Indexed mode

`Sprite.colorMode` is `'rgba'` or `'indexed'`. Cels **stay packed RGBA** in
both modes; "indexed" means *every opaque pixel is a palette colour* and the
palette is the source of truth.

- **Convert to indexed** (Sprite menu) snaps every pixel to the nearest
  palette colour (weighted RGB), alpha < 128 → transparent. One undo step.
- In indexed mode the colour picker edits the **selected palette entry**
  ("Palette entry N" chip). While dragging, every pixel of that colour follows
  live (`state/palette-edit.ts`: affected cels are replaced by copies at the
  start, only the remembered positions are rewritten per move) and the whole
  gesture is **one undo step** — a palette swap.
- Drawing colours, pastes and imports are snapped to the palette; the
  eyedropper selects the matching entry.
- Loading / importing a palette in indexed mode **remaps by index** (entry i →
  new entry i, extra entries snap to nearest) — classic palette swap. In RGB
  mode the pixels are kept.
- The palette is now part of structure snapshots, so palette edits (add,
  remove, load, import) are undoable.

**Why RGBA storage:** no second pixel format in the raster path, export and
compositing unchanged (rules 1–2). Indices are derived when needed.
*Revisit* if palettes with duplicate colours must stay distinct.

## Palette files (`engine/palette-io.ts`)

| Format | Read | Write |
|---|---|---|
| GIMP `.gpl` | ✅ | ✅ |
| Lospec `.hex` (also `.txt`) | ✅ | ✅ |
| JASC `.pal` | ✅ | ✅ |
| PNG (any image: unique opaque colours in reading order; strip on export) | ✅ | ✅ |

Max 256 colours. Import: palette panel "Import…" or Sprite → Import palette;
export: palette panel "Export as…" (format) or Sprite → Export palette (.gpl).
