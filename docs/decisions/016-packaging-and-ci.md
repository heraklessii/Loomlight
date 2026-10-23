# 016 — Packaging for Windows, macOS, Linux; CI builds

**Date:** 2026-10-22
**Status:** Accepted (M4). Windows built and checked locally; macOS / Linux
configured and built by CI only
**Related:** [003 — licence](003-open-source-and-license.md), CLAUDE.md "Don't" (no publishing without approval)

## Decision

| Platform | Targets | How to build |
|---|---|---|
| Windows | NSIS installer + portable zip (x64) | `npm run dist` on Windows |
| macOS | dmg + zip (x64 and arm64) | `npm run dist:mac` on a Mac, or CI |
| Linux | AppImage + deb (x64) | `npm run dist:linux` on Linux, or CI |

- `.github/workflows/build.yml` builds all three on GitHub's runners when
  started by hand or on a `v*` tag: tests, typecheck and i18n gate first,
  then `electron-builder --publish never`; packages are uploaded as
  **workflow artifacts only**. Nothing is published to GitHub Releases or
  itch.io without the user (CLAUDE.md).
- Builds are **unsigned**: Windows shows SmartScreen, macOS needs right-click →
  Open (Gatekeeper). Signing needs certificates (Windows code-signing, Apple
  Developer ID) — a user decision, later.
- The app has no runtime npm dependencies (everything is bundled by Vite),
  so the package holds only `out/`, the licence and the notices.

## Measured (2026-10-22, Windows)

`Loomlight-Setup-0.1.0.exe` 105 MB, zip 147 MB, unpacked 363 MB (mostly
Electron/Chromium). The unpacked app starts from `file:`, has the preload
bridge, loads the bundled fonts and shows the first-run tour.

## Revisit when

- Size matters on itch.io → consider Tauri (decision 001 lists it).
- The user wants auto-updates → still no network by default (rule 9); itch's
  app updates installs by itself.
