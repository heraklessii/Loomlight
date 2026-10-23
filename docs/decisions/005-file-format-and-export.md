# 005 — `.loom` file format and export

**Date:** 2026-10-22
**Status:** Accepted (extension `.loom` is a proposal)
**Related:** [004 — document model](004-document-model.md)

## `.loom` (version 1)

UTF-8 JSON:

```json
{
  "format": "loomlight",
  "version": 1,
  "width": 32, "height": 32,
  "palette": ["#be4a2f", "..."],
  "layers": [{ "id": "l1", "name": "Layer 1", "visible": true, "locked": false, "opacity": 255 }],
  "frames": [{ "id": "f1", "duration": 100 }],
  "cels": [{ "layer": "l1", "frame": "f1", "encoding": "rgba-gzip-base64", "data": "H4sI..." }]
}
```

- Cel data: raw RGBA bytes (row-major, `width × height × 4`), gzip via
  `CompressionStream`, base64. Empty cels are omitted.
- Readable and diff-friendly metadata; pixels compress very well (pixel art
  is mostly runs).
- The reader validates sizes and ignores unknown fields; a newer
  `version` than supported is refused with a clear message.

### Alternatives

- **PNG per cel inside a zip:** viewable in other tools, but needs a zip
  library and an async PNG round-trip on every save.
- **`.aseprite` as the native format:** binary, owned by another product's
  evolution; an importer is planned instead (M3).

## Export

| Format | Details |
|---|---|
| **PNG** | Current frame composite; integer scale 1–16× (nearest) |
| **Sprite sheet PNG** | All frames in a row, a column, or a near-square grid; optional JSON (frame rects + durations, Aseprite-like "frames" array) |
| **GIF** | Own GIF89a encoder: global palette from exact colours (≤ 255 + 1 transparent index); if more colours, popularity palette + nearest mapping; per-frame delay in 1/100 s (minimum 2 cs, browsers clamp lower values); disposal "restore to background" so transparent frames do not smear; infinite loop |

Exported pixels must equal the composite buffer exactly (rule 2): the PNG
path writes the same `Uint32Array` that the viewport shows at 100 %.
