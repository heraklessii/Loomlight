# 015 — Settings: light theme, custom shortcuts, first-run tour

**Date:** 2026-10-22
**Status:** Accepted (M4; the user left the choices to Claude: "sen bilirsin")
**Related:** [002 — design language](002-design-language.md), CLAUDE.md rule 7

## Settings store

`state/settings.ts` (Zustand) holds machine settings, not sprite data:
theme preference, shortcut overrides, tour seen. Persisted in
`localStorage` (Electron keeps it in the app profile); every read/write is
guarded and the defaults always work. Language stays in `i18n` (own key).
UI: **Help → Settings…** (`Ctrl+,`), tabs *General* (theme, language, tour)
and *Keyboard shortcuts*.

## Light theme

- `Dark` (default) / `Light` / `System` (follows `prefers-color-scheme`).
- Same principles as decision 002: neutral greys, one amber accent. Light
  values override the tokens under `:root[data-theme='light']`; amber *text*
  uses a darker `--accent-text` (amber on white is unreadable).
- The canvas renderer re-reads its colour tokens on theme change; Electron's
  title-bar overlay and window background follow via IPC (`app:set-theme`).

## Custom shortcuts

- Overrides are stored per command id; `effectiveKeys()` = override or the
  default keys. Menus, palette, tooltips and the key matcher all use it, so
  one list still drives everything (rule 7).
- Recording: click a key chip, press the keys (captured before any other
  handler). Backspace removes the shortcut, Esc cancels. A key already used
  elsewhere shows a warning with **Replace** (moves the key) or Cancel.
- "Back to default" per command and "Reset all". Symbols ignore Shift and
  AltGr exactly like the matcher, so a recorded key always matches.

## First-run tour

- Starts on the welcome screen at first launch (unless a recovery copy is
  offered); Help → Show the tour, Settings and the welcome link reopen it.
- Seven steps over **real elements** (`data-tour`): pick a size → tools →
  draw → colours → add a frame → play → export. Steps with a goal advance by
  themselves when it is reached (sprite exists, something drawn, 2+ frames,
  Export open); others have *Next*. A spotlight + card; it never blocks
  clicks — the user does the step itself.

## Alternatives considered

- Tour that swallows clicks outside the target (Muicut): safer guidance, but
  heavier; Loomlight's steps are simple enough to leave the app usable.
- Shortcut presets ("Aseprite", "Photoshop"): later, if asked.
