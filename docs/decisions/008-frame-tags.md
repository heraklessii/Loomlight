# 008 — Frame tags

**Date:** 2026-10-22
**Status:** Accepted (M2 completion)
**Related:** [004 — document model](004-document-model.md), [005 — file format](005-file-format-and-export.md)

## Decision

A sprite has `tags: Tag[]` — named frame ranges ("walk", "idle") with a
colour and a loop direction (`forward`, `reverse`, `pingpong`), like
Aseprite's tags.

- **Endpoints are frame ids**, not indices: inserting or moving frames keeps
  a tag attached to the same frames. Deleting an endpoint frame shrinks the
  tag inward; deleting the only frame of a one-frame tag removes it.
- Tags are part of **structure snapshots**, so every tag edit is one undo step.
- **Timeline:** a tag row above the frame numbers. Shift+click frame numbers
  selects a range (`frameRange` in the editor store); "New tag" makes a tag
  from it. Click a tag to select its frames, double-click to edit (name,
  frames, loop, colour, delete).
- **Playback** loops the tag under the current frame with its direction
  (`nextPlaybackFrame`, tested); outside any tag all frames play forward.
- **Export:** GIF and sprite sheet can export all frames or one tag (file
  name gets the tag name). Sheet JSON carries Aseprite-style
  `meta.frameTags` (`name`, `from`, `to`, `direction`, `color`) relative to
  the exported frames, so game engines that read Aseprite JSON work.
- **`.loom`:** optional `tags` array; the format version stays 1 because
  older readers simply ignore the field. Tags pointing at unknown frames are
  dropped on load.

## Alternatives considered

- **Index ranges:** simpler, but every frame insert/move would have to fix
  up every tag, and bugs there silently corrupt animations.
- **Tags as a separate panel:** more room, but the timeline is where frames
  are; a thin row there keeps the "one place" rule of decision 002.

## Revisit when

- Overlapping tags become common — bars currently overlap in one row;
  stack them in lanes.
