# Loomlight

**A free, open-source pixel art editor and sprite animation tool.**
Draw pixel by pixel, work in layers, animate across frames and export PNG,
sprite sheets or GIFs — pixel-exact, offline, no account.

> Status: v0.1 — milestones M1–M4 done. Windows installer; macOS and Linux
> packages build in CI. Arayüz İngilizce ve Türkçe.

## Features

- Pencil, eraser, paint bucket, eyedropper, line, rectangle, ellipse, move, hand
- Brush size 1–64 (square / round), pixel-perfect strokes, horizontal/vertical mirror
- Layers (visibility, lock, opacity, merge down) and frames in one timeline
- Playback with per-frame duration, onion skin, live preview
- HSV colour picker with alpha, built-in palettes (Endesga 32, PICO-8, Sweetie 16, DawnBringer 16)
- Undo/redo for every edit
- `.loom` project files; open PNG images
- Export PNG, sprite sheet (+ JSON) and animated GIF at integer scales
- Selection (rectangle, lasso, magic wand), move / scale / rotate / flip, copy & paste with other apps
- Frame tags with forward / reverse / ping-pong playback; recent files; crash recovery
- Shading ink, dithering, indexed colour with live palette swaps, palette files (.gpl, .hex, .pal, PNG)
- Tiled mode for seamless tiles, reference image layers, `.aseprite` import
- Aseprite-style shortcuts (all customisable), `Ctrl+K` command palette, dark and light themes, first-run tour, English and Turkish UI

## Development

```bash
npm install
npm run dev        # Electron app
npm run dev:web    # renderer only, in a browser at http://localhost:5317
npm test           # engine tests
npm run dist       # Windows installer into dist/
npm run dist:mac   # macOS (on a Mac)
npm run dist:linux # Linux (on Linux)
```

Project docs live in [`docs/`](docs/project_overview.md); contributor/agent
instructions in [`CLAUDE.md`](CLAUDE.md).

## License

GPL-3.0-or-later — see [LICENSE](LICENSE) and
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
