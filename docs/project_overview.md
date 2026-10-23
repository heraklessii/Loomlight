# Loomlight — Project Overview

> **Status (2026-10-22, M4 complete).** M1–M3 done (drawing, layers,
> frames, selection, transforms, tags, inks, dither, indexed colour, palette
> files, tiled mode, reference layers, `.aseprite` import, EN + TR). **M4 is
> done:** first-run tour, custom shortcuts, light / system theme, Windows
> installer built and checked, macOS / Linux packaging + CI workflow. Next:
> the itch.io page, planned with the user.
> Gaps are ☐ in the tables; where work stopped is the top entry of `worklog.md`.
> The user's own requests are tagged **[request]**.

## Product

A **free and open-source** pixel art editor and sprite animation tool
(decision 003) in the spirit of Aseprite **[request]**. Draw, layer,
animate, export. The interface is English first with Turkish from day one
**[request]**, with its own visual identity (decision 002) **[request: a
nice font and a nice interface]**. Distribution: **GitHub + itch.io**.

**Why free:** Aseprite is paid (source-available, not open source);
LibreSprite froze at an old Aseprite fork; Pixelorama is the main open
alternative. There is room for a modern, fast, friendly free tool — its
value is **feel, exactness and polish**, not a feature count.

### Target

| | |
|---|---|
| **Main use** | Game sprites, tiles, icons, short animation loops |
| **Typical canvas** | 16×16 – 128×128 |
| **Supported** | Up to 2048×2048, a few hundred frames, dozens of layers |
| **User** | Indie game developer or hobby pixel artist; many come from Aseprite |
| **Platform** | Windows first; Electron keeps macOS/Linux a build away |

**One-sentence yardstick:** opening Loomlight, making a 32×32 four-frame
walk cycle and exporting it as a GIF and a sprite sheet must take no
settings window and no waiting.

---

## Interface layout (decision 002)

```
┌ title: ▣ Loomlight · File Edit Sprite Layer Frame View · document name ●  ·  ⌘K · EN|TR · [Export] ┐
├ tool options: context of the active tool (size, shape, pixel-perfect, fill, mirror …) ─────────────┤
│ tools │                                                                     │ preview (animated)   │
│  ✎   │                    canvas viewport                                  │ colour picker (HSV)  │
│  ⌫   │        checkerboard · sprite · pixel grid · brush preview           │ palette              │
│  …   │                                                                     │                      │
├───────┴─────────────────────────────────────────────────────────────────────┴──────────────────────┤
│ timeline: ▶ fps · onion · layer rows (eye, lock, name) × frame columns (cels)                      │
└ status: cursor x,y · colour under cursor · sprite size · zoom ──────────────────────────────────────┘
```

- **Layers live in the timeline** (rows = layers, columns = frames) like
  Aseprite — one place for both, no separate layer panel.
- **Right column** holds what the artist looks at constantly: a live
  animated preview at 1×/2×, the colour picker and the palette.
- `Tab` hides/shows the timeline (Aseprite habit).

---

## Scope

Scope is split into **milestones**; each leaves a usable program.

### M1 — Draw and animate (first usable version)

| Feature | Status | Note |
|---|---|---|
| New sprite (size presets, transparent/white/black background) | ✅ | Welcome screen + dialog |
| Canvas: zoom around cursor, pan (Space / middle mouse / Hand), fit | ✅ | Integer zoom steps, nearest-neighbour |
| Pixel grid, checkerboard | ✅ | Grid from 6× zoom |
| Pencil, eraser (size 1–64, square/round) | ✅ | Bresenham between events, coalesced events |
| Pixel-perfect stroke (size 1) | ✅ | Removes L-corners |
| Shift+click straight line from last point | ✅ | Aseprite habit |
| Bucket fill (contiguous / global) | ✅ | 4-connected, exact colour match |
| Eyedropper (and `Alt` while drawing) | ✅ | Samples the visible composite |
| Line, rectangle, ellipse (outline / filled, Shift constrains) | ✅ | Same raster for preview and commit (rule 2) |
| Move tool (shift cel content) | ✅ | |
| Mirror symmetry (horizontal / vertical) | ✅ | |
| Primary / secondary colour, swap (`X`), HSV picker, hex, alpha | ✅ | |
| Palettes (Endesga 32, PICO-8, Sweetie 16, DawnBringer 16), add colour | ✅ | |
| Layers: add, duplicate, delete, rename, reorder, hide, lock, opacity | ✅ | In the timeline |
| Frames: add (copy), add empty, duplicate, delete, reorder, duration | ✅ | |
| Playback, live preview, onion skin (previous/next) | ✅ | |
| Undo / redo (byte budget, region patches) | ✅ | |
| Save / open `.loom` (decision 005) | ✅ | Title shows unsaved mark; close asks |
| Import PNG as new sprite | ✅ | |
| Export: PNG (frame), sprite sheet (row / grid / column) + JSON, GIF | ✅ | Integer scale 1–16× |
| Command palette (`Ctrl+K`), menus, EN/TR switch | ✅ | |
| Selection, copy / paste, canvas size, autosave | → | Moved to M2 (done there) |

### M2 — Edit like a pro

| Feature | Status | Note |
|---|---|---|
| Rectangle / lasso / magic wand selection **[request]** | ✅ | Marching ants; Shift add, Alt subtract, click deselects; every tool respects the selection (decision 006) |
| Select all / deselect / invert | ✅ | `Ctrl+A` / `Ctrl+D` / `Ctrl+Shift+I` |
| Copy, cut, paste, paste as new layer **[request]** | ✅ | Floating paste (drag, arrows, Enter / Esc); system clipboard as PNG both ways |
| Move selected pixels, flip H/V | ✅ | Move tool or arrows lift the selection; `Shift+H` / `Shift+V` |
| Rotate 90° / scale a selection | ✅ | Edit menu + context bar; 8 scale handles on floating pixels (Shift keeps proportions), always rescaled from the unscaled source |
| Canvas size / sprite size (nearest) / crop to selection **[request]** | ✅ | Anchor grid, keep proportions, % chips |
| Flip / rotate whole sprite (all frames) | ✅ | Sprite menu; 90° swaps width and height |
| Autosave + crash recovery **[request]** | ✅ | Recovery copy every ≤ 4 s while dirty; never overwrites the file (decision 007) |
| Recent files | ✅ | Electron: File menu + welcome screen; list owned by main (decision 009) |
| Tags (frame ranges named "walk", "idle"), loop direction | ✅ | Timeline tag row, Shift+click range, ping-pong playback, export one tag, Aseprite `meta.frameTags` (decision 008) |

### M3 — Colour and craft

| Feature | Status | Note |
|---|---|---|
| Shading ink (shift colour along palette ramp) **[request]** | ✅ | Pencil ink: left click forward, right click back, once per stroke (decision 011) |
| Dithering brushes / patterns **[request]** | ✅ | Off / 75 / 50 / 25 % ordered Bayer / checker, anchored to sprite pixels; pencil, shapes, bucket |
| Indexed colour mode **[request]** | ✅ | Convert, picker edits the palette entry with live recolouring (one undo step), palette swap by index (decision 010) |
| Palette import/export (`.gpl`, `.hex`, `.pal`, PNG) **[request]** | ✅ | Palette panel + Sprite menu; palette edits are undoable |
| Tiled mode (wrap-around preview for seamless tiles) **[request]** | ✅ | Off / both / horizontal / vertical; strokes wrap (decision 014). Wrap-around flood fill ☐ |
| Reference image layer **[request]** | ✅ | Any image, smooth scaled, opacity, Move tool + scale/fit, never exported (decision 012) |
| `.aseprite` / `.ase` import **[request]** | ✅ | RGBA/gray/indexed, groups flattened, raw/zlib/linked cels, palettes, tags, reference layers (decision 013) |

### M4 — Polish

| Feature | Status | Note |
|---|---|---|
| First-run tour | ✅ | 7 steps over real elements, goals advance by themselves; Help → Show the tour (decision 015) |
| Custom shortcuts | ✅ | Help → Settings → Keyboard shortcuts: record, conflict → Replace, per-command default, reset all |
| Light theme | ✅ | Dark (default) / Light / System; canvas and Electron title bar follow |
| Packaging for macOS / Linux | ◐ | Config + CI workflow (dmg/zip, AppImage/deb) ready; built only on CI — not run yet. Windows installer ✅ built and checked (decision 016) |
| Code signing (Windows, macOS) | ☐ | Needs certificates — user decision |
| **itch.io page [request]** | Texts (EN + TR), cover image, background, fonts, colours, screenshots/GIFs — **planned together with the user later** (2026-10-22). Publishing only with approval |

### Out of scope (deliberate)

- Vector tools, smooth brushes, anti-aliased painting — Loomlight is pixel-exact (rule 1).
- 3D, tilemap level editor, scripting/plugin system (v1).
- Cloud, accounts, online galleries (rule 9).
- Generative AI.

---

## Core concepts and data model (decision 004)

```
Sprite
 ├─ width, height
 ├─ layers[]   (bottom → top): id, name, visible, locked, opacity (0–255)
 ├─ frames[]   (left → right): id, duration (ms)
 ├─ cels       Map<"layerId:frameId", PixelImage>   (absent = empty)
 └─ palette    packed RGBA colours
PixelImage { width, height, data: Uint32Array }   // little-endian 0xAABBGGRR
```

- A **cel** is the image of one layer in one frame. Cels are full sprite
  size; an absent cel is empty (no memory).
- Colours are packed `Uint32` in the same byte order as `ImageData`, so a
  composite is written to the canvas without conversion.
- **History** stores, per stroke, only the changed rectangle (before/after);
  structural edits (layers, frames) store a cheap snapshot of the arrays and
  the cel map (buffer references). The stack is capped at 256 MB.

---

## Shortcuts

| Action | Shortcut | Source |
|---|---|---|
| Pencil | `B` | Aseprite |
| Eraser | `E` | Aseprite |
| Bucket fill | `G` | Aseprite |
| Eyedropper (hold `Alt` while drawing) | `I` | Aseprite |
| Line | `L` | Aseprite |
| Rectangle / ellipse | `U` / `Shift+U` | Aseprite |
| Move | `V` | Aseprite |
| Hand (or hold `Space`) | `H` | Aseprite |
| Rectangle select / lasso / magic wand | `M` / `Q` / `W` | Aseprite |
| Select all / deselect / invert | `Ctrl+A` / `Ctrl+D` / `Ctrl+Shift+I` | Aseprite |
| Cut / copy / paste / paste as new layer | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` / `Ctrl+Shift+V` | Common |
| Drop / cancel floating pixels | `Enter` / `Esc` | Aseprite |
| Nudge selection pixels (8 px with Shift) | Arrow keys | Aseprite |
| Flip horizontal / vertical | `Shift+H` / `Shift+V` | Aseprite |
| Select a frame range | `Shift`+click frame numbers | Aseprite |
| Canvas size / sprite size | `Ctrl+Alt+C` / `Ctrl+Alt+I` | Aseprite / Photoshop |
| Swap primary / secondary colour | `X` | Aseprite |
| Brush size − / + | `[` / `]` | Aseprite |
| Toggle pixel-perfect | `Shift+P` | |
| Toggle mirror (horizontal) | `Shift+M` | |
| Pan while held / pick colour while held | `Space` / `Alt` | Aseprite |
| Previous / next frame | `,` / `.` | Aseprite |
| First / last frame | `Home` / `End` | Aseprite |
| Play / stop | `Enter` | Aseprite |
| New frame (copy of current) | `Alt+N` | Aseprite |
| New empty frame | `Alt+B` | |
| Delete frame | `Alt+C` | Aseprite |
| New layer | `Shift+Ctrl+N` | Aseprite |
| Toggle onion skin | `F3` | Aseprite |
| Toggle pixel grid | `Ctrl+'` | Aseprite |
| Toggle timeline | `Tab` | Aseprite |
| Shading ink: forward / back | Left / right click (pencil, Shading) | Aseprite |
| Zoom in / out | `+` / `-` (or wheel) | Aseprite |
| Fit on screen / 100 % | `Ctrl+0` / `Ctrl+1` | Photoshop |
| Delete pixels (selection, or whole cel) | `Delete` | Aseprite |
| Merge down | `Ctrl+E` | Aseprite / Photoshop |
| Rename layer | `F2` (or double-click) | |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z` | Common |
| New / open / save / save as | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` | Common |
| Export | `Ctrl+Shift+E` | `Ctrl+E` is Merge down (Aseprite/Photoshop habit) |
| Command palette | `Ctrl+K` | Muicut family |
| Settings (theme, language, shortcuts, tour) | `Ctrl+,` | Common (VS Code, browsers) |

Every shortcut can be changed in Settings → Keyboard shortcuts; this table lists the defaults.

---

## Code Map

Three layers: **`src/shared/`** pure types shared by main and renderer,
**`src/main/`** Electron (dialogs, disk), **`src/renderer/`** interface +
pixel engine.

### `src/shared/`

| File | Job |
|---|---|
| `ipc.ts` | IPC channel names, `LoomlightApi` (type of the preload bridge), file filter and recovery types |

### `src/main/` and `src/preload/`

| File | Job |
|---|---|
| `main/index.ts` | Window (hidden title bar + overlay that follows the theme), **offline guard** (blocks http/https), IPC: open/save dialogs, read/write file, unsaved-changes prompt on close, recovery copy in `userData/recovery` (atomic write, cleared on "Don't save"), recent list in `userData/recent.json` (opens only listed paths) |
| `preload/index.ts` | `window.loomlight` bridge (`LoomlightApi`) |

### `src/renderer/src/engine/` — pixel engine (pure, vitest)

| File | Job |
|---|---|
| `color.ts` | Packed RGBA (`0xAABBGGRR`), hex ↔ packed, RGB ↔ HSV, source-over blend |
| `image.ts` | `PixelImage`: create, clone, get/set, region copy/diff, bounds |
| `raster.ts` | Bresenham line, rectangle, midpoint ellipse, brush stamps (square/round), flood fill (contiguous/global), mirror points — **the only raster code** (rule 2) |
| `sprite.ts` | `Sprite` model: layers, frames, cels, **tags**, ids; structural ops (add/remove/move/duplicate/merge down; frame removal shrinks tags), tag ranges + `nextPlaybackFrame` (forward / reverse / ping-pong), frame and single-pixel composite, structure snapshots for history |
| `history.ts` | Undo/redo stack with byte budget: pixel patches and structural snapshots |
| `tools.ts` | Tool ids (incl. selection tools), tool option defaults (ink, dither), stroke sessions (pencil/eraser/shape/move/bucket) with one write function: tiled wrap → selection mask → dither → ink (simple / shading) |
| `ink.ts` | Dither patterns (Bayer 4×4 levels, checker) and shading-ink colour step (decision 011) |
| `palette-io.ts` | Palette files (.gpl, .hex, .pal parse/write; PNG via pixels / strip), nearest colour, quantize, index remap (decision 010) |
| `aseprite.ts` | `.aseprite` / `.ase` reader → `Sprite` (decision 013) |
| `selection.ts` | Selection masks: rectangle, lasso polygon, magic wand, add/subtract/intersect, invert, crop/place shapes, merged outline segments for marching ants |
| `transform.ts` | Floating blocks (extract, clear, stamp, flip, rotate 90°/180°, nearest scale), canvas resize with anchors, crop, sprite scale, whole-sprite flip / rotate |
| `palettes.ts` | Built-in palettes |
| `gif.ts` | GIF89a encoder: palette building (exact ≤ 255 colours, else popularity + nearest), LZW, transparency, loop, per-frame delay |
| `sheet.ts` | Sprite sheet layout (row / column / grid), optional frame subset, JSON metadata with Aseprite-style `frameTags` |
| `format.ts` | `.loom` read/write: JSON + gzip-compressed base64 cels, tags, colour mode, reference images (decisions 005, 008, 010, 012) |
| `scale.ts` | Integer nearest-neighbour upscale and block copy for export |
| `png.ts` | Own RGBA PNG encoder (`CompressionStream('deflate')` + CRC) — byte-exact export, no canvas premultiply round-trip |
| `engine.test.ts` · `selection.test.ts` · `m2.test.ts` · `m3.test.ts` | vitest for all of the above (colour, raster, tools, history, sprite, sheet, LZW/GIF, PNG, `.loom`; masks, clipped strokes, floating, canvas transforms; rotate/scale floating, sprite flip/rotate, tags + playback order; inks, dither, tiled wrap, palette files, quantize/remap, M3 `.loom` fields, `.aseprite` byte streams) |

### `src/renderer/src/` — interface

| File | Job |
|---|---|
| `main.tsx` · `App.tsx` | Entry, fonts, `window.__loom` dev handle; layout shell, global shortcuts (+ floating Enter/Esc/arrows, native paste event), playback timer, recovery check, drag-and-drop open, window title / unsaved guard |
| `state/document.ts` | The live `Sprite`, its history, file path / dirty flag; `useDocRevision()` (React subscribes to the revision, not to pixels — rule 4) |
| `state/editor.ts` | Zustand: tool + options, colours, active layer/frame, timeline frame range, view (zoom/pan), toggles (grid, onion, timeline), playback |
| `state/ui.ts` | Dialogs (incl. tag editor), command palette, toasts, recent files list |
| `state/selection.ts` | Live selection + floating pixels: change selection (undoable, not dirty), lift (selection or whole cel), start paste, move/nudge/flip/rotate/scale from the unscaled source, commit (one undo step), cancel; `editableCel()`, `useHasFloating()` |
| `state/palette-edit.ts` | Live palette-entry editing in indexed mode: copy affected cels, rewrite remembered positions per move, one undo step (decision 010) |
| `state/settings.ts` | Machine settings (theme pref, shortcut overrides, tour seen) persisted in localStorage; `applyTheme()` / `onThemeChange()` (decision 015) |
| `state/tour.ts` · `components/Tour.tsx` | First-run tour steps (`data-tour` targets, auto-advance goals), spotlight + card |
| `state/autosave.ts` | Recovery copy scheduler (≤ 4 s while dirty) and `discardRecovery()` (decision 007) |
| `clipboard.ts` | Internal clip + system clipboard PNG/token, paste-event and async-API readers, image decoding |
| `actions.ts` | User actions (new/open/save/import PNG + .aseprite/export (all frames or a tag)/recover, colour mode, palette load/import/export/add/remove, reference layers, tiled mode, recent files, layer & frame ops, tags, undo/redo, select all/deselect/invert, flip/rotate pixels and canvas, copy/cut/paste, canvas/sprite size, crop) |
| `commands.ts` | **Single command list** driving menus, the command palette and shortcuts; `effectiveKeys()` (custom overrides), key matcher, `specFromEvent()` recorder, `conflictsWith()` |
| `platform.ts` | File IO through the Electron bridge, or upload/download in a browser; recovery copy via IPC or IndexedDB; recent files (Electron) |
| `render/viewport.ts` | Canvas drawing: checkerboard, tiled neighbours, composite in segments around reference layers (smooth-scaled, clipped), onion skin, grid, brush preview (wrapped in tiled mode), marching ants (selection, floating block, marquee/lasso in progress), scale handles; `handlePoints()` shared with hit testing |
| `components/TitleBar.tsx` | Brand, menus (from `commands.ts`), document name + unsaved dot, command palette button, EN/TR switch, Export |
| `components/ToolBar.tsx` · `ToolOptions.tsx` | Tool column, context bar for the active tool (ink, dither, reference scale / fit) |
| `components/CanvasView.tsx` | Viewport: pointer input (coalesced events) → stroke sessions (shading direction, tiled wrap, indexed colour snap), Shift-line, Alt-pick, selection tools, reference-layer drag, dragging floating pixels, Space/middle pan, wheel zoom, fit/centre on resize, ants timer, zoom HUD |
| `components/SidePanel.tsx` | Right column: animated preview, HSV/alpha colour picker + hex (edits the palette entry in indexed mode), palette grid (load preset, add/remove, import, export as .gpl/.hex/.pal/.png) |
| `components/Timeline.tsx` | Tag row, layer rows × frame columns, Shift+click frame range, playback, onion skin, new tag, layer/frame actions |
| `components/StatusBar.tsx` | Cursor position, colour under cursor, size, zoom |
| `components/SettingsDialog.tsx` | Settings: theme, language, tour; keyboard shortcut editor |
| `components/ResizeDialog.tsx` · `RecoveryDialog.tsx` · `TagDialog.tsx` | Canvas size / sprite size (anchor grid, keep proportions); recover-or-discard prompt; tag name / frames / loop / colour / delete |
| `components/WelcomeScreen.tsx` · `NewSpriteDialog.tsx` · `ExportDialog.tsx` · `AboutDialog.tsx` · `CommandPalette.tsx` · `Toasts.tsx` · `Dialog.tsx` | Start screen (presets, animated lantern), dialogs, palette, toasts |
| `components/icons.tsx` | Own line icon set + the woven `LogoMark` |
| `i18n/index.ts` · `tr.ts` | `t()` / `tk()` / `tn()`, Turkish dictionary |
| `styles.css` | Loomlight tokens (neutral greys, amber accent, Plus Jakarta Sans + Pixelify Sans + JetBrains Mono), light-theme overrides, component styles |

### Scripts and config

| File | Job |
|---|---|
| `scripts/i18n-check.mjs` | Turkish dictionary gate |
| `scripts/make-icon.mjs` · `build/icon.png` | App icon generated with the engine's PNG encoder (`npm run icon`) |
| `.claude/launch.json` | `loomlight-web` dev server for the browser pane |
| `electron.vite.config.ts` · `vite.web.config.ts` | Electron build; browser-only dev server |
| `electron-builder.yml` · `LICENSE` · `THIRD-PARTY-NOTICES.txt` | Packages: Windows NSIS + zip, macOS dmg + zip, Linux AppImage + deb, `.loom` association; GPL-3.0 text, notices (decision 016) |
| `scripts/marketing/make-demo.ts` · `render.cjs` · `screenshots.mjs` · `marketing/itch/` | itch.io page: demo sprite built with the engine; HTML compositions rendered to cover / banner / background PNGs; real-app screenshots (throw-away profile, off-screen window); `page.md` (every field, EN + TR description, pricing $0 or donate); `preview.html` |
| `.github/workflows/build.yml` | Manual / tag CI: test, typecheck, i18n, build all three platforms, upload artifacts (never publishes) |

---

## Open questions (for the user)

**Answered (2026-10-22):**

| Question | Answer |
|---|---|
| Name | **Loomlight** |
| Price / licence | Free, open source (licence proposal: GPL-3.0-or-later, decision 003) |
| Model | Aseprite-like pixel art editor |
| Language | English primary, Turkish too |
| Visual identity | **Accepted** (2026-10-22): amber accent, Plus Jakarta Sans + Pixelify Sans |
| Licence | **GPL-3.0-or-later** accepted (2026-10-22) |
| M2 scope | Selection tools, copy/paste, canvas resize, autosave; then "finish all of M2 in one go" (2026-10-22) |

**Planned with the user later:** the itch.io page — texts, cover, background,
fonts, colours (user, 2026-10-22).

**Proposals waiting for a look (made without asking, easy to change):**

1. Platform: Windows first, macOS/Linux later?
2. File extension `.loom` (decision 005).
3. Whether to init a git repository / publish on GitHub — not done.
