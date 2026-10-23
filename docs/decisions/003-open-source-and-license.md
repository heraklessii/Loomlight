# 003 — Free, open source; licence

**Date:** 2026-10-22
**Status:** Accepted — free + open source, **GPL-3.0-or-later** (user, 2026-10-22)
**Related:** Muicut decision 004 (same reasoning)

## Decision (user)

Loomlight is a **free, open-source** pixel art tool.

## Licence proposal — GPL-3.0-or-later

| | **GPL-3.0** (proposal) | MIT |
|---|---|---|
| Can someone ship a closed, paid fork? | **No** — derivatives stay GPL | Yes |
| Contributions from companies / embedding | Less attractive | Very easy |
| Compatible dependencies | Electron, React, Zustand (MIT); fonts (OFL) — all fine | Same |
| Precedent in the niche | LibreSprite (GPL-2), Krita, GIMP | Pixelorama (MIT) |

**Why GPL:** Aseprite itself moved from GPL to a paid, source-available
licence; LibreSprite exists because the GPL fork stayed open. GPL keeps
Loomlight's work from being repackaged as a closed paid app — the same
reason the user chose GPL for Muicut.

**Cost:** Loomlight's engine cannot be embedded into a closed product by
others. Loomlight is a standalone app, so the cost is small. The copyright
holder (the user) can still relicense their own code.

## Consequences

- `LICENSE` (GPL-3.0 text) and `THIRD-PARTY-NOTICES.txt` ship in the package.
- Fonts are SIL OFL 1.1 — notices listed.
- Built-in palettes are colour lists credited to their authors
  (Endesga 32 — ENDESGA, PICO-8 — Lexaloffle, Sweetie 16 — GrafxKid,
  DawnBringer 16 — DawnBringer).
- **External contributions (PRs)** are accepted only with the user's
  approval; if code may later move into a closed sibling product, the
  Muicut rule applies (only the user's own code moves).
- Offline rule unchanged: free does not mean telemetry.
- Publishing the repository / releases happens only with the user's approval.

## When to revisit

- If the user prefers MIT for maximum adoption (Pixelorama's choice).
