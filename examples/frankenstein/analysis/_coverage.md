# Coverage — Frankenstein; or, The Modern Prometheus

Self-contained record of the deconstruction pass. `_progress.md` carries only a one-line pointer
to this file, per the pipeline contract.

## Boundary table

| Field | Value |
|---|---|
| Source | Project Gutenberg, 1818 text, public domain |
| Source file | `source/frankenstein.txt` |
| Heading pattern | `^Chapter (\d{1,2})\s*$` (arabic), per `example.json` |
| Units | 24 chapters + Walton's 4 framing letters |
| Adapted range | Chapters XI–XVI (the creature's own narration; the hovel year) |

## Batch result

| Metric | Count |
|---|---|
| Source units | 24 |
| Succeeded | 24 |
| Failed | 0 |
| Gaps | none |

All 24 chapters are cited in `SOURCE_BIBLE.md` (§ Full-book coverage). Walton's framing letters
were read for frame and voice but carry no adapted material: the slice sits entirely inside the
creature's retrospective narration, which is itself nested two frames deep (Walton → Victor →
the creature).

## Note on the adapted range

The full-book pass exists so the adaptation boundary is a *choice* rather than an artefact of
partial reading. Chapters XI–XVI were selected because they are the only stretch narrated by the
creature himself, and the only one where he is an observer with a daily routine rather than a
pursued figure — which is what makes a nightly loop possible at all. Reasoning and the hard
vetoes are in `concepts/CONCEPT.md`; the boundary itself is recorded in
`design/GAME_DESIGN.md` §17 Adaptation boundary.
