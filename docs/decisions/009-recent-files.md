# 009 — Recent files

**Date:** 2026-10-22
**Status:** Accepted (M2 completion)
**Related:** [005 — file format](005-file-format-and-export.md), CLAUDE.md rule 9

## Decision

- The recent list (max 10 `.loom` files) lives in the **main process**, in
  `userData/recent.json`. Main adds a path whenever the user opens or saves a
  `.loom` through a dialog or plain Save.
- The renderer can only **list** it and ask to **open a path that is already
  in the list** (`recent:open` refuses anything else). A compromised or buggy
  renderer cannot use it to read arbitrary files.
- Listing drops files that no longer exist; opening a vanished file removes
  it and shows a message.
- Shown in **File → Recent** (up to 6) with "Clear recent files", and on the
  welcome screen (up to 5).
- **Browser build:** no recent files — a browser has no file paths.

## Alternatives considered

- **localStorage list in the renderer + generic `file:read(path)` IPC:** less
  code, but exposes reading any path to the renderer.
- **OS jump lists (`app.addRecentDocument`):** nice extra; can be added on top
  later without changing this list.
