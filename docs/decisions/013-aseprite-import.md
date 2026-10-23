# 013 — `.aseprite` import

**Date:** 2026-10-22
**Status:** Accepted (M3) — read-only importer
**Related:** [005 — file format](005-file-format-and-export.md), [008 — tags](008-frame-tags.md)

## Decision

`engine/aseprite.ts` reads `.aseprite` / `.ase` files following the public
file specification (aseprite/aseprite → `docs/ase-file-specs.md`). Opening one
(File → Open, drag and drop) creates an **unsaved `.loom`** with the same
name — Loomlight never writes `.aseprite`.

| Imported | How |
|---|---|
| RGBA / grayscale / indexed sprites | Indexed → indexed colour mode with the file palette; transparent index respected (not on background layers) |
| Normal layers, visibility, opacity | Group layers are flattened; a child of a hidden group is hidden |
| Raw, compressed (zlib) and linked cels | Placed at their offset in full-size cels; linked cels become independent copies; cel opacity is baked into alpha |
| Palette chunks (new and old) | Transparent slots dropped from the drawing palette |
| Tags | Name, range, colour, direction (ping-pong reverse → ping-pong) |
| Reference layers | Become Loomlight reference layers (decision 012) |

**Not imported** (with a message when present): tilemap layers, blend modes
other than normal (treated as normal). Silently ignored: slices, user data,
external files, colour profiles.

## Why an importer, not the native format

Aseprite's format follows Aseprite's own evolution; owning a writer would tie
Loomlight to it. Reading is enough to bring existing work over.

## Verification

`m3.test.ts` builds real `.aseprite` byte streams (RGBA with a group, raw +
zlib + linked cels, tags; indexed with palette and transparent index) and
checks the result pixel by pixel.
