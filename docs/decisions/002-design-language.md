# 002 — Design language

**Date:** 2026-10-22
**Status:** Accepted by the user (2026-10-22) after seeing the app; values
below are tokens in `styles.css`
**Related:** [001 — tech stack](001-tech-stack.md)

## Principles

| Principle | Why |
|---|---|
| **Neutral surfaces** (pure greys, no tint) | Pixel artists judge colour against the background. A blue- or warm-tinted UI shifts perceived hue of the artwork |
| **One accent, used sparingly** | Active tool, primary action, focus, current frame. Everything else is grey |
| **Selection is ink, not accent** | Selected layer/cel uses a light neutral highlight so it does not compete with sprite colours |
| **Pixel identity, readable UI** | The pixel face is for brand and titles only; dense controls use a highly legible sans |
| **Square-ish geometry** | 6–10 px radius, 28 px controls — a tool for pixels should feel crisp, not bubbly |
| **No glass/blur** | GPU and visual noise; the canvas is the star |
| **Motion is short and purposeful** | 120–180 ms, one easing curve, no decorative animation |

## Identity

**Accent: amber `#ffb547`** — "light" in Loomlight; warm, readable on dark
grey, and far from the reds/greens artists paint with most. Ink on accent is
near-black. Danger is a separate red `#ef5a5a`.

| Candidate | Value | Note |
|---|---|---|
| **Amber** (chosen) | `#ffb547` | Warm "lamp light", distinct from Muicut's coral |
| Thread violet | `#9d8cff` | Pretty, but many AI products use it |
| Teal | `#3fd0c0` | Collides with Muita's turquoise family colour |

**Fonts** (all SIL OFL, bundled from npm — never loaded from the network):

| Role | Face | Why |
|---|---|---|
| UI text | **Plus Jakarta Sans** (variable) | Friendly, open apertures, excellent at 12–13 px, distinct from Segoe UI |
| Brand, dialog titles, empty states | **Pixelify Sans** (variable) | A real pixel face with weights 400–700; gives the app its pixel soul without hurting legibility |
| Numbers: coordinates, hex, sizes | **JetBrains Mono** (variable) | Tabular, unambiguous `0/O`, `1/l` for hex input |

**Wordmark:** a 3×3 "woven" pixel mark (alternating amber/neutral pixels —
a loom's weave) next to "Loomlight" in Pixelify Sans.

**Surfaces:** `#111111 → #1a1a1a → #222 → #2a2a2a → #333` steps; canvas
area `#161616` so the checkerboard (`#2b2b2b` / `#343434` by default) reads
as "transparent" without glare.

## Layout patterns

- Layers live in the **timeline** (Aseprite model): one grid of
  layers × frames.
- Right column: **animated preview**, **colour picker**, **palette** — the
  three things an artist checks constantly.
- **Context bar** under the title shows only the options of the active tool.
- **Command palette** `Ctrl+K` lists every command with its shortcut — the
  same list drives menus and keys.

## When to revisit

- The user dislikes the accent or a face after seeing the app.
- A light theme is requested (M4) — tokens are already centralised.
