# Signature frames — §14's nine moments, judged

Date: 2026-07-29. Judged by eye from real frames produced by the browser suite, against
`ART_DIRECTION` §14's beat sheets and protected regions. **This is the first pass in the project
that judges the finished thing rather than asserting about it**, and it is deliberately not a
table of nine passes.

Frames are from `qa/evidence/browser/` at the 336-assertion green build.

| # | Moment | Verdict | Why |
|---|---|---|---|
| M1 | Title — *One lit window* | **pass** | `01_keyboard_title.jpg`. The engraved plate carries the moonlit holding with one lit window; the title sets in Libre Caslon Display over laid paper, three verbs below the platemark. Reads as the 18th-century book plate §7 asks for |
| M2 | Cold open — *The chink* | **not judged** | Frame captured (`02_keyboard_cold_open.jpg`) but not assessed against its beat sheet this pass. Honest gap, not a pass |
| M3 | The yard — *The carry* | **fail** | See *The yard was never drawn* below. The core action happens on placeholder geometry |
| M4 | The hovel at dawn — *The read* | **partial** | `15_campaign_hovel_dawn.jpg`. The read-out works: the hearth is visibly larger than at night, the cold slot has turned from night-blue to daylight, the tally plank carries its marks. But the aperture sits in a flat navy panel (F13 below), and the yard strip in the slot is flat fill |
| M5 | The lesson at the chink — *The minting* | **partial** | `12_campaign_lesson_mint.jpg`. The minted word ("forest") appears and the plank gains a scratch, so the mechanic reads. But the word floats in empty dark with no connection to the chink it came through or the plank it lands on — the minting has no gesture |
| M6 | First light (transition) | **not judged** | A transition, not a still; the frame set does not capture it. Needs a video or a beat-by-beat capture to judge honestly |
| M7 | The door, day 8 (climax) | **pass, with debt** | `19_campaign_door.jpg`. De Lacey by the fire with his guitar on the engraved door plate, "Who is there? Come in." lands. Debt: the creature, the pile and the doorway are still flat Canvas boxes over the plate |
| M8 | Being seen (failure) | **pass** | `34_seen_freeze.jpg` / `35_seen_card.jpg`. Both cones whiten, the creature is caught inside Agatha's, his shadow falls across the seer, the world freezes, and the SEEN card lands after the 2 s hold. This is the most complete moment in the game |
| M9 | The moon sets, and the fire (result) | **fail** | `22_campaign_moonset.jpg`. Same cause as M3 |

## The yard was never drawn

This is the finding of the pass, and it is bigger than the two frames it fails.

§16.3 lists as Canvas 2D work: *"The entire holding plate (walls in section, three hatched ground
types, trees in outline, the pool, the sty, the well, the woodpile, the path, the lane gate)"*.
**None of it exists.** What ships is flat-filled rectangles and two polylines on a navy field, with
no hatching of any kind — the placeholder geometry the build started from.

§3.1 does specify the yard *in plan*, so the top-down layout is correct and is not the problem. The
problem is that the plan was never rendered: three hatched ground types are one flat colour, the
pool, sty, well, woodpile, path and lane gate are unlabelled boxes.

This matters more than a cosmetic note because **the yard is where the game is played**. Every
night's carry, every cone evasion, the whole of M3, happens on it. The hovel interior is finished to
a high standard and the screen the player spends most of their time on is not.

Scope estimate: this is comparable to items 5 and 6 combined, and it is the single largest
remaining piece of art work in the slice.

## F13 — the aperture reshape regressed

Filed as fixed-then-worse, honestly:

The third attempt at §7.1's "ragged aperture" replaced the uniform 7 px sawtooth with stepped
plank-end runs. The pixel gates still pass — right-edge boundary variance rose 16.28 → 36.71 px²,
consistent with genuinely irregular breaks — but **at game scale it reads worse than what it
replaced**. The room now sits inside a large flat navy panel whose inner edge is castellated; it
reads as a picture on a mat board with a battlement-shaped window. The panel itself carries no
engraving, which is the same defect class item 5 was created to remove.

Attempt 1 was a rectangle. Attempt 2 read as pinking shears. Attempt 3 reads as battlements. Three
approaches have now failed the same way: they treat the aperture as *an outline to cut* rather than
*board mass to lay over the room*. The regenerated `plate/hovel` shows the correct read — long
straight board edges with the grain, splintered breaks across it, and no surrounding panel at all.

**Recommendation:** the next attempt should delete the cover panel entirely and clip the room
directly against the plate's own opening, taking the silhouette from the plate rather than
generating one. Whether to revert attempt 3 in the meantime is a judgement call for a human eye —
the gates are green either way.

## What this pass establishes

Four of nine judged sound (M1, M7, M8, and M4/M5 in their mechanics), two failed on a single shared
cause, two unjudged, one regression found. The suite's 336 assertions were all green throughout —
none of them could see any of this, which is the point of looking.

---

## Re-judgement pending (2026-07-30)

The frames this pass judged came from the build **before** the holding plate was drawn. F15 is
now fixed: the yard is an engraved plan — walls in section, the three ground hatches, trees in
outline, contact shadows on the actionable objects — and it is gated at pixel level in the browser
suite.

So **M3 and M9's stated cause is removed**, and their `fail` verdicts above no longer describe the
build. They are **not** hereby upgraded. Both need judging again by eye against §14's beat sheets
on the current frames (`10_campaign_yard_plate.jpg`, `11_campaign_n3_carry.jpg`,
`23_campaign_moonset.jpg`), and that judgement has not been made. Reading a `pass` into a moment
because the defect underneath it was fixed is exactly the move `qa-contract.md` forbids — the
whole point of this pass is that someone looks.

What can be said without judging: the core action no longer happens on placeholder geometry, and
the open ground it crosses is empty *by* §4.4 rather than by omission. What is still visibly thin
in these frames, and would be the substance of a re-judgement: the creature and the load he
carries are a filled disc and a small amber bar, so the carry has a read-out but no figure; and
M4's remark about the yard strip in the cold slot being flat fill is now inconsistent with the
plan it looks onto, which uses `drawPile`'s shared geometry.

M1, M2, M4–M8 are untouched by F15 and their verdicts above stand as written.
