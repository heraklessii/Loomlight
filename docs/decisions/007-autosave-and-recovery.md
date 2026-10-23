# 007 — Autosave and crash recovery

**Date:** 2026-10-22
**Status:** Accepted (M2, user request: "otomatik kayıt")
**Related:** CLAUDE.md rule 6, [005 — file format](005-file-format-and-export.md)

## Decision

"Autosave" in Loomlight means a **recovery copy**, not writing the user's
file. Rule 6 stays: saving the `.loom` file is always explicit.

- While the sprite has unsaved changes, a recovery copy (`.loom` bytes + name,
  path, time) is written **at most every 4 s** after a change
  (`state/autosave.ts`). Writing is best effort and never blocks drawing.
- **Electron:** `%APPDATA%\Loomlight\recovery\current.loom` + `current.json`,
  written atomically (temp file + rename) by the main process.
- **Browser build:** IndexedDB (`loomlight` / `recovery`).
- **One slot** — Loomlight edits one sprite at a time.
- The copy is **removed** on a successful save, on "Don't save" when closing,
  and when a sprite is created or opened (the user already confirmed
  discarding).
- On start, if a copy exists, a dialog offers **Recover** (opens it as an
  unsaved sprite with its old name/path) or **Discard**.

## Why not autosave into the file

Pixel art is iterative; silently overwriting the user's file removes the
"revert to last save" safety net and surprises people coming from Aseprite.
A recovery copy covers the real risk — crashes, power loss, closed browser
tab — without changing the file.

## Verified

Electron build: draw → copy appears in `%APPDATA%\Loomlight\recovery` →
process killed → restart shows the dialog → Recover restores the pixels and
marks the sprite unsaved. Browser build: same flow through IndexedDB on reload.

## Revisit when

- Multiple open documents (tabs) arrive → one slot per document.
- Users ask for real autosave to file → an opt-in setting, off by default.
