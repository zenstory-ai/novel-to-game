# Analysis coverage · Project Plateau

## Source boundary

- Source of truth: `../source/the-lost-world.txt`
- Edition record: `../source/SOURCE.md`
- SHA-256: `9fa6ee046745c09b5077f68c232f210ac672196d27e25b1aca13dbc643805c65`
- Segmentation rule: `^\s*CHAPTER\s+([IVXLCDM]+)\s*$`
- Counted body: line 95 through line 8016, ending before the Project Gutenberg
  end marker. Header, contents, license, and duplicated contents labels are not
  chapter bodies.
- Analysis run: 2026-07-31 PT

Line numbers refer to Python `str.splitlines()` over the exact recorded UTF-8
file. They are stable for the recorded hash even though the downloaded file
uses CRLF line endings.

## Stable chapter ledger

| # | Title | Source lines | Status | Gameability trace |
|---:|---|---:|---|---|
| 1 | “There Are Heroisms All Round Us” | 95–331 | success | Malone turns a private desire for heroic distinction into a search for dangerous reporting work; the motive is usable context, but the chapter's gender attitudes are not world truth. |
| 2 | “Try Your Luck with Professor Challenger” | 332–643 | success | McArdle assigns Malone to test Challenger's disputed claim, making investigation and credible reporting the actionable mission. |
| 3 | “He is a Perfectly Impossible Person” | 644–948 | success | Malone gains access through deception, survives Challenger's test and violence, then converts confrontation into provisional trust. |
| 4 | “It's Just the very Biggest Thing in the World” | 949–1611 | success | Maple White's sketchbook, photographs, a damaged specimen and the red-cliff account form an evidence chain for an isolated plateau. |
| 5 | “Question!” | 1612–2095 | success | Public doubt produces a formal expedition; Challenger, Summerlee, Roxton and Malone take distinct investigative roles. |
| 6 | “I was the Flail of the Lord” | 2096–2436 | success | Roxton's history establishes expedition competence and colonial violence; the party equips for the Amazon rather than proving the claim through narration. |
| 7 | “To-morrow we Disappear into the Unknown” | 2437–2779 | success | The expedition commits to a secret route with boats, porters, supplies and Zambo as the eventual link to the world below. |
| 8 | “The Outlying Pickets of the New World” | 2780–3228 | success | River, rapids, portage, reed tunnel, forest tunnel, bamboo and fern plain create a readable sequence from ordinary world to the red cliffs. |
| 9 | “Who could have Foreseen it?” | 3229–4097 | success | The party finds Maple White's camp, fails to find an ascent, bridges a chasm with a felled tree, crosses, then is stranded when Gomez destroys the bridge. |
| 10 | “The most Wonderful Things have Happened” | 4098–4613 | success | Fort Challenger, a guiding brook, tracks, iguanodons and the pterodactyl rookery establish observation under escalating ecological pressure. |
| 11 | “For once I was the Hero” | 4614–5208 | success | Fire repels a night predator, gunfire is withheld as a noisy last resort, food is tested through bird behavior, and Malone climbs above the canopy to chart the lake and caves. |
| 12 | “It was Dreadful in the Forest” | 5209–5720 | success | Malone follows the brook to the central lake, records cave fires and fauna, reads a predator's scent-to-sight pursuit, survives a human trap, and returns to a ransacked camp. |
| 13 | “A Sight which I shall Never Forget” | 5721–6264 | success | Roxton and Malone use concealment, open-ground speed and rifles to recover the professors and six Accala captives; four survivors reveal a route toward the lake settlement. |
| 14 | “Those Were the Real Conquests” | 6265–6768 | success | Maretas guides the group to the Accala; the chapter then turns rescue into extermination and bondage, an explicit ethical boundary rather than prototype spectacle. |
| 15 | “Our Eyes have seen Great Wonders” | 6769–7365 | success | Elevated caves defeat large predators, conventional rifle fire fails against one threat, a secret eighteen-cave chart reveals the forked exit tunnel, and the party extracts by rope. |
| 16 | “A Procession! A Procession!” | 7366–8016 | success | Damaged photographs and portable collections are challenged as insufficient; a live pterodactyl changes public belief, while diamonds motivate another expedition. |

## Final count

```text
source units: 16
successful units: 16
failed units: 0
successful set: {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
source set:     {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
gate: successful set == source set -> PASS
```

There are no unread, retried, substituted, or failed chapter bodies. The
compressed conclusions and chapter citations are in `SOURCE_BIBLE.md`.
