# CLAUDE.md

Project instructions for Claude Code working in this repository. Read this
file and `docs/project_overview.md` at the start of every session.

## What Is This Project

> **Status (2026-10-22): M1–M4 complete** — drawing tools, layers × frames,
> timeline, undo/redo, `.loom`, PNG / sheet / GIF export, selection and
> transforms, clipboard, tags, recent files, crash recovery, inks, dither,
> indexed colour, palette files, tiled mode, reference layers, `.aseprite`
> import, **first-run tour, custom shortcuts, light theme, Windows installer,
> macOS/Linux CI packaging**, EN + TR. Next: an **itch.io page** the user
> wants to design together (texts, cover, background, fonts, colours) — do
> not start it unasked; nothing is published without approval. Open ☐ items and where
> work stopped: top entry of `docs/worklog.md`. What is done / missing:
> `docs/project_overview.md` → Scope tables. Selection & clipboard:
> decision 006; autosave: 007; tags: 008; recent files: 009; indexed colour
> & palette files: 010; inks & dither: 011; reference layers: 012;
> `.aseprite` import: 013; tiled mode: 014; settings/theme/shortcuts/tour:
> 015; packaging & CI: 016.
>
> **Free and open source, GPL-3.0-or-later** (decision 003), **Windows
> first** (Electron keeps macOS/Linux one build away), interface **English
> first, Turkish from day one**, distribution **GitHub + itch.io**.

**Loomlight** is a desktop **pixel art editor and sprite animation tool** in
the spirit of Aseprite: draw pixel by pixel, work in layers, animate across
frames, export PNG / sprite sheets / GIF. The goal is not to clone every
Aseprite button but to give a **fast, friendly, free** tool that feels
modern from the first click.

- **Primary user:** indie game developers and hobby pixel artists making
  sprites (16×16 – 256×256), tiles and short loops.
- **Typical canvas:** 16–128 px square; supported up to 2048×2048 and a few
  hundred frames.
- **Aseprite muscle memory is respected:** tool keys (B, E, G, I, L, U, V,
  H), `,` / `.` frames, `Alt+N` new frame, `Enter` play — see
  `project_overview.md` → Shortcuts.

Three priorities, in this order:

1. **Every pixel lands where the cursor is, instantly.** Input latency and
   exactness beat features. A stroke must never skip pixels, blur, or lag.
2. **Simplicity.** New sprite → draw → animate → export works without
   opening a settings window.
3. **A beautiful, own interface.** Neutral surfaces so artwork colours are
   judged correctly, one warm accent, a pixel display face for identity
   (decision 002).

## Which Document to Read When

| Question | File |
|---|---|
| **"Which file does this?"** | `docs/project_overview.md` → **Code Map**. Look here before scanning the repo |
| "What does the product do, what is in scope?" | `docs/project_overview.md` → Scope |
| "Why was it built this way?" | `docs/decisions/NNN-*.md` |
| "What was done when?" (last ~10 sessions) | `docs/worklog.md` |
| "How did Muicut do this?" | `../Mui/Muicut/docs/` — sister project by the same author; **read** for approaches (i18n gate, live verification, worklog discipline) |

Keeping the code map fresh is your job: **when you add a file or a file's
job changes**, update `project_overview.md` → Code Map in the same session.

## Tech Stack (decision 001)

- **Shell:** Electron (main: file dialogs and file IO; renderer: everything else)
- **UI:** React + TypeScript + Vite
- **State:** Zustand — **only editor/UI state** (active tool, colours, active
  layer/frame, view, revision counter). Pixel buffers live in the engine's
  `Sprite` object, never in React or Zustand state (rule 4)
- **Drawing surface:** Canvas 2D with `imageSmoothingEnabled = false`; pixels
  are `Uint32Array` RGBA buffers written straight into `ImageData`
- **Export:** PNG via canvas, own GIF89a encoder (LZW), own sprite-sheet packer
- **Packaging:** electron-builder (NSIS + zip)

The renderer also runs in a plain browser (`npm run dev:web`) with a
download/upload fallback for files — used for fast iteration and live
verification in the browser pane. Before changing the stack, read
`docs/decisions/` and open a new decision record.

## Critical Product Rules (never forget these)

1. **Pixels are exact.** No anti-aliasing, no smoothing, no sub-pixel
   positions anywhere in the drawing path. Scaling is nearest-neighbour and
   integer. Lines are Bresenham, ellipses are midpoint — the same function
   is used for preview and commit.

2. **Preview = result.** What the canvas shows while dragging a shape is
   exactly what is committed on pointer-up, and what is exported is exactly
   what the canvas shows at 100 %. One raster function per shape, never two.

3. **The interface never waits.** Pointer events are handled
   synchronously into the cel buffer and the canvas is redrawn on the next
   animation frame. Heavy work (GIF encoding of long animations, big
   imports) shows progress and never blocks drawing.

4. **Pixel buffers stay out of React.** Cels are `Uint32Array`s owned by the
   `Sprite`; React subscribes to a revision counter. Never put image data in
   component state or the Zustand store.

5. **Undo is bounded by bytes, not steps.** History stores the changed
   region of a stroke, not the whole cel; the stack is capped by a byte
   budget. Every user-visible edit is undoable as one step.

6. **The user's file is never lost.** Saving is explicit; unsaved changes
   are marked in the title and asked about on close. Autosave writes only a
   **recovery copy**, never the user's file (decision 007). Importing a PNG
   never modifies the PNG.

7. **Shortcuts follow Aseprite where they exist** (table in
   `project_overview.md`). A new tool must not take a key Aseprite users
   expect; update the table when adding one. `Ctrl+K` is the command
   palette (family convention from Muicut).

8. **Simplicity is a feature.** A feature that needs a new panel, menu or
   mode is asked about first. The default flow works without any dialog
   except "New sprite".

9. **Offline.** No account, no cloud, no telemetry, no update check. Any
   dependency that needs the network is asked about first. The main process
   blocks http/https requests.

10. **Two-language UI from day one.** Every user-visible string is written
    as `t("English text")`; the Turkish entry goes into
    `src/renderer/src/i18n/tr.ts`. `npm run i18n:check` fails on a missing
    entry. English is the source language.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Electron + Vite development mode |
| `npm run dev:web` | Renderer only, in a browser (http://localhost:5317) — file IO falls back to upload/download |
| `npm run build` | Build into `out/` |
| `npm test` | vitest — pure engine (raster, fill, history, GIF, PNG, file format, sheet, selection masks, transforms) |
| `npm run icon` | Regenerates `build/icon.png` |
| `npm run lint` · `npm run typecheck` · `npm run i18n:check` | Fast gate |
| `npm run dist` | Windows installer into `dist/` (NSIS + zip) |
| `npm run dist:mac` · `npm run dist:linux` | macOS dmg/zip · Linux AppImage/deb — run on that OS, or via the CI workflow (`.github/workflows/build.yml`) |

## Verification

- **Pure logic** (raster ops, flood fill, history, GIF bytes, `.loom`
  round-trip, sheet layout) lives in vitest — fast, every session.
- **Drawing, canvas and UI** are verified live: `npm run dev:web` in the
  browser pane, real pointer input, screenshots. "It compiles" is not
  verification.
- **Exactness is a test subject:** a drawn line/ellipse must match the
  engine's reference pixels; an exported PNG must equal the composite
  buffer byte for byte.

## Code Standards

- TypeScript strict mode.
- React components are functional and hook based.
- **Engine is separate from UI:** sprite model, raster ops, tools, history,
  encoders live under `src/renderer/src/engine/`, know nothing of React, and
  are tested.
- File dialogs and disk IO always in the main process, over IPC
  (`src/shared/ipc.ts`); the renderer goes through `platform.ts`.
- Comments and commit messages in English or Turkish; identifiers in English.
- No colour or size literals in component files — use the tokens in
  `styles.css` (decision 002).

## Workflow Expectation (worklog discipline)

At the END of every meaningful work session, add an entry at the top of
`docs/worklog.md`: date, what was done, which files changed, known gaps/TODO.

For every architectural choice (new library, data model, shortcut scheme,
file format) open `docs/decisions/NNN-short-title.md`: why, which
alternatives, when to revisit.

Before starting a large feature, check that it is defined in
`project_overview.md` → Scope; if not, ask the user first.

## Don't

- Add generative AI features (unless the user asks).
- Add cloud/sync/accounts.
- Change the shortcut scheme silently.
- Put pixel buffers into React state or Zustand.
- Write a second raster path for preview vs. commit (rule 2).
- Add a component with a GPL-3.0-incompatible licence without a decision
  record (decision 003).
- Create a public repository or publish code/builds on the user's behalf
  without approval.
- Skip the `docs/` discipline.
