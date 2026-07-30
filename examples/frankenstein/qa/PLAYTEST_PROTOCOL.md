# PLAYTEST_PROTOCOL · Frankenstein — The Hovel

For a first-time player. **20–30 minutes** is the brief's estimate (row 7) and nothing has ever
been timed with a real person, so one of the things this session buys is that number.

## Before you start — the one rule that matters

**Do not read `design/` or `analysis/` first.** Your first-contact comprehension is spendable
exactly once, and §1 of this protocol is the only chance anyone gets to measure it. If you have
already read the design documents, say so in the notes; the answers to Part 1 are then worth much
less and that is fine, but it should be recorded rather than quietly ignored.

## Running it

```bash
cd examples/frankenstein/build/app
python3 -m http.server 5199
```

Open **http://127.0.0.1:5199/** — no flags. (`?fast=1` and `?seed=42` exist for the test harness;
playing with them defeats the point.)

**Controls.** Arrows or WASD to move. **The context action is `E` or `Space` and must be _held_,
not tapped** — a press that releases inside one frame does nothing. `Q` drops what you carry,
`X` lifts the plank to go out or come back, `J` opens the journal once you have it, `Enter`
advances cards. Mouse works throughout: click the title verbs, click to walk, click a thing to
walk over and act on it.

Play **one run to an ending**, whatever ending you reach. Do not restart to get a better one.

---

## Part 1 — First contact (answer *before* you read anything)

Stop and write these down at the moment stated. Rough answers are fine; wrong answers are the
valuable ones.

**At the title, before pressing anything.** What do you think this is about? What do you expect to
be doing?

**After the cold open, the moment you first control something.** What just happened? What are you?
Where are you?

**At the end of night 1.** In your own words: what is the game asking you to do? What are the three
verbs at the chink? What are the scratch marks on the plank in the foreground? What is the heap
next to them?

**At the first dawn read.** Something changed on the screen from what you did last night. What?
Did you cause it deliberately or find out afterwards?

---

## Part 2 — Staged observation

Note the time on your own clock at each point, and anything that confused you.

| Point | Watch for |
|---|---|
| **The cold open** | It wants ~23 seconds of continuously **held** input before the first night. Did you think it had frozen? Did you let go? *(This is known finding F4 — it is a deliberate authored beat, and we want to know whether it reads as one or as a bug.)* |
| **Night 1** | Did you work out that you can go outside at all? What told you? |
| **Your first carry** | Did you understand that the wood you put at their door is for them, not you? |
| **The first cone that nearly caught you** | Did you understand the threat before it was on you, or only after? |
| **The dawn read** | Can you tell what your night bought? Is the household's fire visibly different? Can you hear that it is different? |
| **The first lesson** | The window is narrow and opens at the start of a night. Did you find it, or find it by accident? |
| **Day 8, the walk** | The shift from night to daylight, and from hiding to crossing in the open. Did the change land? |
| **The door** | Five exchanges on a real-time clock. Did you feel time pressing? Did you know you could simply say nothing? |
| **Your ending** | Which one did you get — `door`, `seen`, `want`, or `silence`? Did it feel like a consequence of your play, or like something that happened to you? |

---

## Part 3 — Known-suspicious spots

Look at these deliberately. We already believe something is off; independent eyes decide whether it
matters.

- **F4 — the 23-second held cold open.** As above. The single most likely place to lose a player in
  the first minute.
- **F13 — the chink.** The aperture you watch the room through was reshaped this round to read as
  prised-apart boards rather than a decorative fringe. Does it read as a gap in a boarded wall, or
  as a picture frame? Compare it with the wall around it.
- **The signature moments.** See `qa/evidence/signature-frames.md` for the frame-by-frame verdicts
  against `ART_DIRECTION` §14. Anything marked **fail** there is a place to look hard.
- **Sound.** All twelve gated cues are procedural — there are no audio files. The hearth's level
  follows the household's fire, and the wind's second layer rises in the last two night-minutes as
  the dawn warning. Do you hear either of those *as information*, or only as atmosphere?

---

## Part 4 — After the run

1. What was the game about?
2. What were you afraid of?
3. What did you want that you could not get?
4. Was there a point where you stopped reading the screen and started playing from habit? Where?
5. Would you play a second run? The stated replay hook is that a second run buys more language from
   the same night budget — was that legible, or news to you now?
6. **Time check:** how long did the run actually take, against the brief's 20–30 minutes?

## What to do with the answers

File them at `qa/evidence/onboarding.md` (Part 1, verbatim, before any discussion) and
`qa/evidence/playtest-01.md` (Parts 2–4). Part 1 must be written down before you read the design
documents or discuss the run with anyone, or it is not onboarding evidence — it is a second
opinion from someone who already knows the answers.

Until Part 1 exists from a genuine first-time player, the `qa` gate cannot read `PASS`, however
green the automated suite is: 336 browser assertions establish that the slice works, and none of
them establish that it lands.
