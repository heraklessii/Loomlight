# Worklog

A new entry is added at the end of every meaningful work session (newest on
top). Format:

```
## YYYY-MM-DD — Short title

**Done:**
- ...

**Changed files:**
- ...

**Known gaps / TODO:**
- ...
```

---

## 2026-10-23 — Public on GitHub + HERA GitHub profile

**Done (user approved publishing both):**
- Loomlight is public: https://github.com/heraklessii/Loomlight (GPL-3.0 detected by GitHub, description + 10 topics). `git init` here, first commit `d07a9b9`. `.gitignore` keeps the author's own profile assets (`marketing/hera-profile/`, `marketing/github-profile/`, `make-hera.ts`, abandoned `make-scene.ts`) out of the repo.
- GitHub profile README (heraklessii/heraklessii) rewritten: HERA banner, open-source table (Loomlight, Muivly, Muiren, Muiply, Muiget, Muifly, Muiren Bot, Ved: Recure TR) with licences, games/studio apps listed as itch-only. Draft kept in `marketing/github-profile/`.
- GitHub links added to `marketing/itch/page.md` (EN/TR + sidebar link), HERA `profile.md` bio and `README.md` (Download section).

**Known gaps / TODO:**
- MuiLabs is public but has no licence, so it is not listed as open source. Pinned repos on the profile can only be set by the user (GitHub → Customize your pins).
- The CI workflow has not run on GitHub yet (check its trigger before the first release tag).

## 2026-10-23 — HERA creator profile assets (user's own itch page)

**Done:**
- Not a Loomlight asset: header, background and bio for the user's HERA itch.io profile. Pixel scenes drawn with the engine (fog watchtower = Fogwardens, lit town = Muitown, blossom tree + petals = Petalfall), night sky in violet with teal fog; middle kept calm for the profile column.
- Header text (HERA wordmark, teal/violet/pink rule, "small offline tools & cozy games") rendered by `render.cjs hera-header` (jobs can now carry their own `dir`).
- `profile.md`: image settings, theme colours/fonts, bio EN + TR.
- Round 2 (user's screenshot): itch draws the background right behind the bio, so the full scene repeated the header and hurt readability → replaced by a quiet 64×64 star tile (640×640, repeat); `preview.html` + `render.cjs hera-preview` mock the profile layout.

**Changed files:**
- `scripts/marketing/make-hera.ts` (new), `scripts/marketing/render.cjs`
- `marketing/hera-profile/{header.html, profile.md, out/*}` (new)

**Known gaps / TODO:**
- The user sets it up on itch; Petalfall/Fogwardens one-liners are placeholders to check. `scripts/marketing/make-scene.ts` (abandoned Loomlight cover redo) is unused.
- Could move `marketing/hera-profile/` to the Mui folder; it lives here for the render pipeline.

## 2026-10-23 — itch.io page, draft 1 (assets + texts)

The user started the itch.io page ("yazılar, cover, arka plan, font ve renkler").
**Nothing published; no commit.**

**Done:**

- Researched itch's current options: cover 315:250 (630×500 recommended),
  any Google Font in the theme editor, separate button / header colours,
  fixed background image, 960 px page column, 3–5 screenshots, 10 tags.
- `scripts/marketing/make-demo.ts` (`npm run marketing:demo`): a 32×32,
  4-layer, 4-frame lantern scene built with the engine (dithered glow,
  ping-pong tag) → `marketing/itch/demo/` (.loom, GIF, PNGs).
- `marketing/itch/{cover,banner,background}.html` + `assets.css` + bundled
  fonts; `scripts/marketing/render.cjs` (`npm run marketing:render`) →
  `out/cover-630x500.png`, `out/banner-960x300.png`, `out/background-tile-96x96.png`.
- `marketing/itch/page.md`: every itch field (basics, theme colours/fonts,
  tags, uploads) and the description in English and Turkish.

**Problems on the way (the user saw error dialogs):** a syntax error in my
render script made Electron show "JavaScript error" dialogs on each try;
Chromium had remembered a 2× zoom for `file://` from an earlier attempt
(everything rendered magnified); hidden windows did not always paint. Fixed:
syntax-check before running, dialogs routed to the console, zoom forced to
100 %, an off-screen visible window, one image per run. 2× images dropped.

**Later the same day:** pricing set by the user — **$0 or donate**.
`scripts/marketing/screenshots.mjs` (`npm run marketing:screens`) drives the
built app with a throw-away profile and an off-screen window
(`LOOMLIGHT_USER_DATA`, `LOOMLIGHT_CAPTURE` in `src/main/index.ts`), opens the
demo through the real drop handler and captures 5 scenes at 1280×800 (editor
+ onion skin, export GIF, indexed + shading, tiled, light theme).
`marketing/itch/preview.html` (`npm run marketing:preview`, port 5320) shows
banner, theme colours, fonts, screenshots and the EN/TR description read
from `page.md`; verified in the browser pane (6 headings per language,
images load, fonts load).

**Next:** the user's itch.io account / project URL; uploading and theming
the page (only with the user's go-ahead).

---

## 2026-10-22 (late night) — M4 complete: tour, custom shortcuts, light theme, packaging

The user asked "M4 ne?", then left the choice to Claude ("sen bilirsin").
Chosen: do M4 now (the itch.io page needs the user's input and will use this
step's screenshots and installer). Mid-turn the user reported a tour bug:
pressing Next on the first step without picking a size moved into editor
steps with no editor — fixed the same turn. **No commit** (no repository).

**Done:**

- **Settings (decision 015):** `state/settings.ts` (theme, shortcut overrides,
  tour seen; localStorage, guarded), `SettingsDialog.tsx` (Help → Settings…,
  `Ctrl+,`): General (theme Dark/Light/System, language, tour) and Keyboard
  shortcuts (search, record, conflict → Replace, per-command default, reset).
- **Light theme:** token overrides under `[data-theme='light']`, new
  `--accent-text` for readable amber text, literal colours moved to tokens;
  canvas renderer re-reads colours; Electron title-bar overlay + window
  background follow via `app:set-theme`.
- **Custom shortcuts:** `effectiveKeys()` everywhere (matcher, menus, palette,
  tooltips), `specFromEvent()` recorder, `conflictsWith()`.
- **First-run tour:** `state/tour.ts` + `Tour.tsx`; 7 steps over `data-tour`
  targets, goals advance by themselves. **Fix (user report):** step 1 has no
  "Next" but "Use 32×32" (creates the sprite); editor steps are marked
  `needsSprite` and fall back to step 1 if no sprite is open.
- **Packaging (decision 016):** mac (dmg/zip x64+arm64) and linux
  (AppImage/deb) config, `dist:mac` / `dist:linux`, `.github/workflows/build.yml`
  (manual / tag, tests + gates, artifacts only, never publishes).
- Docs: decisions 015, 016; overview (status, M4 table, shortcuts, code
  map), CLAUDE.md, README.

**Verification:**

- `npm test` 56/56; typecheck ✓; oxlint ✓; i18n 337 strings, 0 missing.
- Browser pane: fresh profile → tour starts on the welcome screen; real
  input through all 7 steps (preset click, draw, Alt+N, Ctrl+Shift+E) →
  tour ends, `tourSeen` stored. After the fix: step 1 shows "Skip tour /
  Use 32×32", clicking it opens a 32×32 sprite and moves to "Your tools".
  Settings: light theme applied (body #f5f5f5, white checkerboard); Pencil →
  P recorded, Eraser → P shows "P is used by Pencil" → Replace → stored
  `{eraser: [P], pencil: []}`; in the editor P selects the eraser, the tooltip
  says "Eraser  P", B and E do nothing; settings reset afterwards.
- `npm run dist`: `Loomlight-Setup-0.1.0.exe` 105 MB, zip 147 MB, unsigned.
  The unpacked `Loomlight.exe` starts from `file:`, bridge present, dev handle
  absent, fonts loaded, first-run tour shown. Rebuilt after the tour fix.

**Known gaps / TODO:**

- macOS / Linux packages never built (no Mac / Linux here; CI workflow not
  run — needs a GitHub repository, which is the user's decision).
- No code signing (SmartScreen / Gatekeeper warnings).
- Electron title-bar overlay colour change in light theme not visually
  checked (IPC call only).
- Next: the itch.io page with the user.

---

## 2026-10-22 (night) — M3 complete: inks, dither, indexed colour, palette files, tiled mode, reference layers, .aseprite import

The user asked for all of M3 in one go. Mid-turn they added: **an itch.io
page will be set up together later** (texts, cover, background, fonts,
colours) — recorded in the overview (M4 + open items) and CLAUDE.md; not
started. **No commit** (no repository).

**Done:**

- **Model:** `Sprite.colorMode`, `Layer.kind = 'reference'`,
  `Sprite.references`; palette, colour mode and references are part of
  structure snapshots (palette edits are now undoable). `compositeFrame`
  takes a layer range and always skips references. `.loom` gains optional
  `colorMode` and `references` (version still 1; old files open with defaults
  — verified with a pre-M3 recovery copy).
- **Shading ink + dithering (decision 011):** `engine/ink.ts`; one write
  function per stroke: tiled wrap → selection mask → dither → ink. Shading
  changes a pixel once per stroke; left/right click = forward/back.
- **Indexed colour (decision 010):** convert (quantize), drawing/paste snap
  to the palette, eyedropper selects the entry, the picker edits the selected
  entry live with all its pixels (`state/palette-edit.ts`, one undo step),
  palette load/import remaps by index in indexed mode.
- **Palette files:** `engine/palette-io.ts` (.gpl/.hex/.pal + PNG); palette
  panel Import… / Export as…, Sprite menu entries.
- **Tiled mode (decision 014):** View menu; neighbour tiles drawn; strokes,
  footprint and cursor position wrap.
- **Reference layers (decision 012):** Layer → New reference layer…;
  segmented viewport compositing, smooth scaled and clipped, Move tool drag
  (`structuralFrom` for live gestures), scale % / Fit in the context bar,
  REF marker in the timeline, drawing/merging refused.
- **`.aseprite` import (decision 013):** `engine/aseprite.ts`; File → Open and
  drag & drop; warnings for tilemaps / blend modes.
- 53 new TR strings; decisions 010–014; overview, CLAUDE.md updated.

**Verification:**

- `npm test` 56/56 (11 new in `m3.test.ts`, incl. real `.aseprite` byte
  streams built in the test); typecheck ✓; oxlint ✓; i18n 300 strings, 0 missing.
- Browser pane, real input: pre-M3 recovery opened with defaults. Shading
  drag over a red row → exactly the 8 red pixels became the next palette
  colour (#f77622), transparent and other rows untouched, outline cursor.
  Dither 50 % filled 8×8 rectangle → 32/64 pixels, checker visible. Tiled
  both: stroke on the right neighbour landed at x = 1–4, all 9 tiles show it.
  Convert to indexed → 516/516 pixels in palette, primary bound to entry 9;
  dragging the picker recoloured 508 pixels across 5 frames as one undo step,
  Ctrl+Z / Ctrl+Y exact. Reference layer via the real menu + injected file
  input: fitted ×8, opacity 160, drawn above, absent from the preview /
  export composite, Move drag one undo step, pencil refused with a message.
  Palette import (.gpl via the panel button, injected file): 3 colours,
  516 pixels remapped. `.aseprite` via Ctrl+O (injected 293-byte file):
  8×8, layer, durations 150/90, tag "idle", pixels and linked cel correct,
  opened as unsaved `hero.loom`.
- Electron build launches (bridge, fonts, welcome).

**Known gaps / TODO:**

- Palette export and reference/palette dialogs in Electron not exercised
  (native dialogs); export bytes covered by unit tests.
- Wrap-around flood fill in tiled mode; shading ramp = whole palette (no
  ramp selection); overlapping tags still overlap.
- In short windows the hue/alpha sliders sit just above the timeline; the
  side panel scrolls.
- itch.io page (with the user), M4, `npm run dist` still to do.

---

## 2026-10-22 (evening) — M2 complete: transforms, canvas flip/rotate, tags, recent files

The user said "devam et", then "hepsini tek seferde bitir" — finish every
remaining M2 item in one go. **No commit** (no repository).

**Done:**

- **Rotate / scale a selection:** `rotateFloating` (90° cw/ccw, 180°) and
  `scaleFloating` (nearest) in `engine/transform.ts`. Floating state keeps an
  unscaled `src`, so repeated scaling never degrades. 8 scale handles drawn
  by the viewport (`handlePoints` shared with hit testing), Shift keeps
  proportions on corners, resize cursors on hover. Edit menu + context-bar
  buttons (flip H/V, rotate). Without a selection, flip/rotate act on the whole
  cel (temporary lift, selection kept). Undo label "Transform selection".
- **Flip / rotate canvas** (Sprite menu): `flipSprite`, `rotateSprite` over all
  layers and frames; 90° swaps size; structural undo.
- **Frame tags (decision 008):** `Sprite.tags` with frame-id endpoints, colour,
  loop direction; frame deletion shrinks/drops tags; in structure snapshots
  and `.loom` (optional field, version still 1). Timeline tag row, Shift+click
  frame range, new-tag button, `TagDialog.tsx`; playback loops the tag under
  the playhead (forward / reverse / ping-pong); Export can take one tag (file
  name suffix) and sheet JSON has Aseprite-style `meta.frameTags`.
- **Recent files (decision 009):** main-owned `userData/recent.json` (max 10),
  added on open/save of `.loom`, missing files dropped, `recent:open` only for
  listed paths; File menu "Recent" (+ clear) and welcome-screen list.
- **Fixes:** context bar now refreshes while pixels float (`useHasFloating`);
  window shorter than the tool column no longer pushes the workspace under
  the timeline (`minmax(0, 1fr)` rows, scrolling tool bar).
- Docs: decisions 008, 009; overview (status, M2 table all ✅, code map,
  shortcut); CLAUDE.md status.

**Verification:**

- `npm test` 45/45 (6 new in `m2.test.ts`); typecheck ✓ (web + node); oxlint ✓;
  i18n 247 strings, 0 missing.
- Browser pane, real input: 6×4 filled rect → select → arrow lift → drag the
  SE handle → 12×8 → rotate-cw button → 8×12 at (6,2) → Enter: 96 px, one undo
  step "Transform selection". Sprite → Rotate canvas 90° cw: all 96 px at
  `(31−y, x)`, Ctrl+Z restores exactly. 5 frames → Shift+click 2–4 → tag
  button → dialog "walk", ping-pong, green → bar shows; playback sequence
  1,2,3,2,1,2,3… stays inside the tag.
- **Electron build:** seeded `recent.json` with a real `.loom` (made by the
  app's own writer) and a missing path → welcome lists only `walk.loom`,
  click opens it (5 frames, tag "walk ◀▶", not dirty), missing entry removed
  from the file. Test files removed afterwards.

**Known gaps / TODO:**

- Overlapping tags draw on top of each other in the single tag row.
- Tag export from the GIF/sheet dialog verified through `exportFrames` /
  `buildSheet` tests, not by writing a file.
- Still not run: `npm run dist`; "Don't save" clearing recovery; real Ctrl+V
  keystroke in Electron.
- M3 (shading ink, dithering, indexed colour, palette files, tiled mode,
  `.aseprite` import) not started.

---

## 2026-10-22 (later) — M2: selection, clipboard, canvas size, crash recovery

The user accepted the visual identity and GPL-3.0 and asked for M2: selection
tools, copy/paste, canvas resize, autosave. **No commit** (no repository).

**Done:**

- **Selection (decision 006):** `engine/selection.ts` masks — rectangle,
  lasso (even-odd polygon + outline), magic wand (contiguous/global),
  add/subtract/intersect, invert, merged outline segments. Tools `M` / `Q` /
  `W`; Shift add, Alt subtract, click deselects; Select all / Deselect /
  Invert (`Ctrl+A` / `Ctrl+D` / `Ctrl+Shift+I`). Selection changes are undo
  steps that do not mark the file dirty. All drawing tools and Delete are
  clipped to the selection. Marching ants in the viewport (cached edges).
- **Floating pixels:** `state/selection.ts` + `engine/transform.ts`. Move tool
  inside a selection or arrow keys lift pixels; paste floats; drag with any
  tool, arrows nudge (Shift = 8), `Shift+H` / `Shift+V` flip, Enter / click
  outside drops as one undo step, Esc restores. Undo, structural edits,
  layer/frame switch, save and export drop pending floats first (hook in
  `state/document.ts`, no import cycle).
- **Clipboard:** `clipboard.ts` — internal exact clip + system clipboard PNG
  with a token; `Ctrl+V` handled as a native paste event (no permission
  prompt), async API with 1.5 s timeout for menu paste; "Paste as new layer".
- **Sprite menu:** Canvas size (anchor grid), Sprite size (nearest, keep
  proportions, % chips), Crop to selection — `ResizeDialog.tsx`.
- **Crash recovery (decision 007):** `state/autosave.ts` writes a recovery
  copy ≤ 4 s after changes while dirty — Electron `userData/recovery`
  (atomic), browser IndexedDB; cleared on save / "Don't save" / new / open;
  `RecoveryDialog.tsx` on start.
- New "Select" and "Sprite" menus; new icons; 41 new TR strings; Ctrl+Alt
  shortcuts fixed (AltGr override now applies to symbol keys only).
- Docs: decisions 006, 007; 002/003 marked accepted; overview status, scope,
  shortcuts, code map; CLAUDE.md status and rule 6.

**Verification:**

- `npm test` 39/39 (11 new: masks, clipped strokes, floating, canvas
  transforms); typecheck ✓; oxlint ✓; i18n 217 strings, 0 missing.
- Browser pane, real pointer/keys: filled rect → marquee → Move drag lifts
  pixels (ants follow, area cleared) → Enter → pixel checks → Ctrl+Z / Ctrl+Y
  restore exactly (64 px constant); Ctrl+C toast, Ctrl+V floats at the copy
  position, drag + Shift+H + Enter; wand 25 px; Ctrl+Alt+C 32→48×40 content
  centred; palette "kırp" → 5×5; Sprite size 200 % → 10×10; two undos → back
  to 48×40 with 90 px; lasso 19×19 = 361 px; synthetic paste event with a PNG
  from "another app" floats centred, colour exact; Esc cancels.
- Browser recovery: reload after edits → dialog → Recover restored 64 px.
- **Electron build:** draw → `%APPDATA%\Loomlight\recovery\current.loom`
  written; system clipboard holds a 32×32 image + token (read with .NET);
  process **killed** → relaunch shows the dialog → Recover restores the
  stroke, sprite marked unsaved. Test recovery files removed afterwards.

**Known gaps / TODO:**

- Not verified: "Don't save" clearing recovery (native dialog), Ctrl+V as a
  real keystroke in Electron (CDP `paste` command sent, result not observed;
  the paste-event path was verified with a synthetic event in the browser),
  pasting our PNG into another app (clipboard contents verified only).
- Rotate 90° / scale a selection, flip/rotate whole sprite, recent files,
  tags — still ☐ in M2.
- The context bar does not refresh while a paste floats until it is dropped
  (floating changes do not bump the document version).
- `npm run dist` still not run.

---

## 2026-10-22 — Project start: docs, M1 foundation, live-verified

The user asked for an Aseprite-like pixel art app named **Loomlight**: free and
open source, a nice font and interface, **English primary + Turkish**, with
`CLAUDE.md` and `docs/` modelled on Muicut. **No git repository, no commit**
(not asked).

**Done:**

- **Docs:** `CLAUDE.md`, `docs/project_overview.md` (scope M1–M4, layout,
  data model, shortcuts, code map), decisions **001** stack, **002** design
  language, **003** licence (GPL proposal), **004** document model /
  rendering / history, **005** `.loom` format and export. Docs are in English
  (the product's primary language).
- **Stack:** Electron 43 + React 19 + TS 7 + Vite 7 + Zustand 5 (Muicut's
  versions); `npm run dev:web` runs the renderer in a browser.
- **Engine (pure, tested):** packed `0xAABBGGRR` colours, Bresenham /
  Zingl ellipse / rect / brush stamps / mirror / scanline flood fill, stroke
  sessions (pixel-perfect, Shift constrain, shift-click line, move), sprite
  model with merge down, byte-budget history (region patches + structure
  snapshots), GIF89a encoder, own PNG encoder, sprite sheet, `.loom` gzip+base64.
- **UI:** title bar with menus from the single command list, tool bar, context
  options bar, canvas viewport (device-pixel crisp, checkerboard, grid from
  6 px, onion skin, two-tone brush outline), preview / HSV picker / palette,
  Aseprite-style timeline (layers × frames, play, duration, opacity),
  status bar, welcome screen with an animated pixel lantern, New / Export /
  About dialogs, `Ctrl+K` palette, toasts, drag-and-drop open, EN/TR switch.
- **Identity:** amber `#ffb547`, Plus Jakarta Sans + Pixelify Sans +
  JetBrains Mono, woven 4×4 logo; `build/icon.png` from `scripts/make-icon.mjs`.

**Verification:**

- `npm test` 28/28; typecheck ✓ (node + web); oxlint ✓; i18n 176 strings, 0 missing.
- Live in the browser pane (`dev:web`), real pointer input: pencil stroke
  connected, rectangle, undo (22 px left, 1 history entry), ellipse + bucket
  fill, Alt+N new frame + move tool, F3 onion skin, Enter playback cycles
  frames 0↔1, TR interface, Ctrl+Shift+E export dialog, Ctrl+K → "Yeni
  katman" → Ctrl+Z restores focus.
- Export exactness in-page: PNG at 3× decoded back with **0 differing
  pixels**; GIF frame 0 decoded by Chromium **0 differing pixels**.
- Electron build (`electron-vite build`) launched with CDP: page loads from
  `out/`, `window.loomlight` bridge present, fonts loaded, welcome screen shown.

**Changed files:** everything is new — `CLAUDE.md`, `README.md`, `LICENSE`,
`THIRD-PARTY-NOTICES.txt`, `docs/**`, `package.json`, configs,
`src/main/index.ts`, `src/preload/index.ts`, `src/shared/ipc.ts`,
`src/renderer/**`, `scripts/{i18n-check,make-icon}.mjs`, `build/icon.png`,
`electron-builder.yml`, `.claude/launch.json`.

**Known gaps / TODO:**

- Not run: `npm run dist` (installer), real save/open dialogs in Electron
  (only the browser download path and the `.loom` round-trip test).
- Selection tools, copy/paste, canvas resize, autosave/recovery — M2.
- GIF encoding runs on the main thread (fine for typical sprites; move to a
  worker for long/large animations — rule 3).
- Visibility/lock/opacity are not undo steps; a structural redo can restore
  an older visibility value (documented choice, revisit if it bothers users).
- Layer/frame drag-to-reorder in the timeline (commands exist, no drag yet).
- Open proposals for the user: accent/fonts, GPL vs MIT, `.loom` extension,
  Windows-only vs cross-platform, git/GitHub.
