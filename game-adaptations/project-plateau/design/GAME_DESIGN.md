# Game Design · Project Plateau

## One-page experience definition and player promise

**Working title:** *Project Plateau: Proof Before Dark*

| Promise element | Locked statement |
|---|---|
| Player identity | You are the expedition's forward scout, carrying a field camera and the responsibility to return with evidence. |
| Core action | Read the terrain and wildlife, expose a limited glass plate from a chosen position, then protect the record on the way back. |
| World response | The same position and time that improve the record also expose the player; wildlife changes from distant behavior to watching, searching and attacking, while cover and noise alter its response. |
| Target feeling | Earn a clear look at an impossible living world, then feel the weight of having to bring that look home. |

The main type is a **real-time first-person 3D survival adventure**. Ecological
stealth and field photography support that type in that order. When scope or
clarity conflicts arise, retain traversal → observation → threat response →
return. Remove extra fauna, lore, combat, collection and spectacle before
weakening that loop.

The complete prototype is one connected-zone run from Fort Challenger to an
iguanodon observation site and back. A nearby pterodactyl territory supplies
the changing pressure. The player may return alive with no useful record, with
disputable plates, or with a strong field record; only the last state fulfills
the full player promise. The London audience remains outside the slice, so the
game reports evidence quality without claiming that belief has been proven.

## Type grounding and precedent principles

The following five lines are the **same-play verb list**. Build and QA must copy
them verbatim and provide evidence for each:

1. **Traverse first-person connected terrain between relative safety and an objective space.**
2. **Observe or search the environment for route, objective and threat information.**
3. **Commit to an exposed objective interaction while the threat state can change.**
4. **Evade through cover or route choice, or spend a limited defensive response.**
5. **Reach relative safety with the acquired objective state intact.**

These verbs and the leave-safety → read-world → acquire-objective → survive-
response → reach-safety loop are shared by the verified *Subnautica*, *Alien:
Isolation* and *The Long Dark* precedents recorded at concept selection.

| Borrowed principle | Project Plateau conversion | Deliberately not borrowed |
|---|---|---|
| *Subnautica*: an ecosystem can be both the reason to approach and the reason to retreat. | The objective interaction records a living subject; observation position and behavior determine evidence value, then animal response changes the return. | Underwater movement, oxygen, crafting, bases, vehicles, alien fiction, creatures and interface. |
| *Alien: Isolation*: a strong threat changes route and timing while limited tools create space rather than dominance. | Pterodactyl awareness is readable through calls, gaze, circling and dives; tree cover and one loud response alter the next route state. | Franchise creature, station layout, tracker, flamethrower, hiding lockers, gore and retro-future styling. |
| *The Long Dark*: the world gives information without drawing the answer. | Brook sound, three-toed tracks, fern movement, canopy and red basalt replace objective trails; the player learns which route remains defensible. | Broad survival simulation, needs meters, crafting, winter wilderness, permadeath and sandbox scale. |

The unique conversion is the object and consequence of the exposed interaction:
the familiar inspect/acquire action becomes a one-use photographic plate. Its
value can be weak, strong or destroyed, and the player still has to carry it
back. No new genre is claimed.

## First-minute premise copy

Player-visible launch copy is English and appears exactly as written below.
The field-report voice is restrained, direct and concrete.

| Time / screen | Exact text | Purpose |
|---|---|---|
| Opening field-order card, before control | `FIELD ORDER // FORWARD SCOUT` | Identity. |
| Same card | `Photograph living proof. Return to Fort Challenger before sundown.` | Goal and deadline. |
| Same card, final line | `A sighting without the plate will not survive London.` | Full completion condition. |
| First controllable view | `Move [WASD] · Look [Mouse]` | Only the minimum input appears. |
| Three-toed track, on approach | `Examine the track [E]` | First meaningful action. |
| Immediate field note after inspection | `Three toes. Fresh. The brook runs back to camp.` | Rewards observation and establishes the return landmark. |
| First covered view of the herd | `Raise camera [Right Mouse]` | Reveals the signature tool only when it has a subject. |
| Camera raised | `Hold steady. Release the shutter [Left Mouse]` | Explains the commit action. |
| First partial plate preview | `PARTIAL — foliage hides the flank.` | Teaches proof quality through a concrete defect. |

The order card clears on movement or after six seconds. No lore paragraph,
settings panel or secondary meter competes with it. The first frame under
player control has one focal point: a sunlit three-toed track crossing the dark
brook edge toward a gap in the ferns. Fort structures and the distant red cliff
remain readable but subordinate.

## Three-part action arc

| Phase | Newly usable verb(s) | Newly reachable space | Observable phase-end marker |
|---|---|---|---|
| Explore | `examine` joins movement and looking; the player can identify track direction and the brook's return relation. | Fort threshold → brook trail → covered observation blind. | The first glass plate is exposed and its concrete framing defect appears. |
| Develop | `choose observation position`, `hold frame` and `wait for behavior` join the loop; plate results begin to compound into a field record. | The route forks between a canopy overlook and an exposed basalt shelf, then opens onto the iguanodon glade. | Adult and juvenile behavior is recorded or missed; the pterodactyl shifts from distant call to visible watch/search. |
| Mature | `read threat state`, `use defensive shot`, `choose return route` and `extract` become necessary combinations. | The return fork opens a long covered thorn route and a short exposed creek route back to Fort Challenger. | The Fort gate closes behind the player and the recovered plates are read into one result. |

The final phase therefore has both new actions and a new reachable state. A
larger counter alone never advances the arc.

## Experience pillars

| Pillar | Observable playtest evidence | Veto signal |
|---|---|---|
| Read the living route | A first-time player reaches the glade and later chooses a return route using brook sound, cover and animal cues without a continuous objective line. | The tester wall-hugs, follows a HUD arrow or cannot explain why one route is safer. |
| Proof is an exposed action | The tester changes angle or timing to improve a plate and understands that the held frame increased exposure. | Shutter presses are safe collectibles, or plate grades feel unrelated to the image and behavior seen. |
| Defense creates escape, not dominance | Cover is used before ammunition; a shot creates an escape window and a changed downstream problem. | Shooting every visible animal is reliable, cheap or necessary for a strong result. |

## Two-layer loop and mastery type

### Five-to-thirty-second loop

```text
read one signal or threat pose
  -> choose movement, cover, camera commitment or defense
  -> receive same-beat motion / sound / plate feedback
  -> route, evidence or threat state changes
```

- **Ordinary first-time play:** reacts after a call or dive begins, takes the
  first unobstructed frame, and uses the nearest route.
- **Skilled play:** anticipates a behavior window, lets cover lower awareness,
  commits only when scale and behavior share the frame, and saves ammunition
  for a deadline-dependent route reversal.

### One-to-five-minute loop

```text
leave a safe landmark
  -> assemble several route and behavior observations
  -> turn limited plates into a record
  -> absorb the ecological response
  -> revise the return plan
  -> extract a readable outcome
```

- **Ordinary first-time play:** can survive with partial evidence after learning
  one cue late.
- **Skilled play:** produces a strong field record, retains a recoverable body
  margin and ammunition, and chooses the return response appropriate to the
  remaining light.

Mastery is **renewable judgment within a mostly deterministic run**. Subject
pose, awareness and remaining light create repeated timing decisions, but the
prototype does not promise a procedural or endlessly replayable ecosystem.
Knowledge of the route helps on replay; executing the clean frame and return
still requires reading the current state.

## Real-time type contract

| Contract field | Rule that affects decisions |
|---|---|
| View and movement | Continuous first-person look and ground movement; walking, sprinting and crouching change exposure and travel time. No third-person cutaway performs a player verb. |
| Interaction timing | Examining is brief and cancellable. Raising the camera slows movement; releasing the shutter commits the player for two seconds and consumes the selected plate. |
| Camera information | Before commitment, the view shows subject coverage, obstruction and stability but not the resulting point total. After commitment, a short plate preview names the dominant visible strength or defect. |
| Threat information | Awareness is hidden numerically. Calls, head/gaze direction, wing cadence, shadow speed and dive posture expose its four states in the world. |
| Defensive timing | The rifle can interrupt a committed dive only before contact. It is inaccurate as a killing tool and its report changes the direct return route. |
| Spatial counterplay | Dense canopy blocks a clean aerial dive but also obstructs photographs. Open basalt gives scale and framing at the cost of visibility. |
| Submission points | A shutter release permanently spends one plate. Entering either return route commits its time/cost profile. Crossing the Fort gate submits the run. |
| Randomness | P0 uses no outcome-changing randomness. The same state and action yield the same result; small ambient animation variation may not change windows, damage or route timing. |
| Failure and recovery | A second unblocked strike, expiration of remaining light outside the Fort, or leaving the navigable world ends the run. Restart returns to the field order with the same initial state in one action. |
| Pause / focus | Pause freezes the world and reveals controls. Losing browser focus also freezes input and time; returning never spends a plate or fires a shot. |

## World rules, state and necessary systems

There is one core system and two supporting systems.

### Core system — exposed proof

| Observable cause | World / state response | Readable feedback |
|---|---|---|
| Player examines tracks or behavior before raising the camera. | Context cues become eligible to improve a later frame; no score is granted yet. | Field note names only what was actually seen; subject pose or route highlight changes in-world. |
| Player releases the shutter. | One unexposed plate becomes exposed; the frame receives zero, one or two evidence points; camera commitment may raise wildlife awareness. | Shutter, plate-slide sound, brief monochrome plate preview and one concrete strength/defect. |
| Frame contains a complete subject silhouette or a source-grounded scale reference. | One evidence point is awarded for clarity/context. | The preview outline is complete; note names `full flank` or `basalt gives scale`. |
| Frame also contains a readable living behavior that was observed rather than staged by gunfire. | A second point is awarded. | The preview names the behavior: `young play beside the adults` or `adult pulls down the branch`. |
| An exposed plate breaks. | Its evidence points are removed immediately. | A visible slot cracks, its preview fractures and the current record grade drops. |
| Player crosses the Fort gate. | Intact evidence points are classified; survival and proof are reported separately. | Physical plates are laid out, then one short result line appears. |

### Support system A — wildlife awareness

| Observable cause | World / state response | Readable feedback |
|---|---|---|
| Player remains behind dense cover for six uninterrupted seconds. | Pterodactyl awareness falls by one state, to a minimum of distant. | Wing cadence widens, gaze leaves the player and calls recede. |
| Player exposes a plate from cover. | Awareness rises by one state. | Nearest animal turns its head; one answering call. |
| Player exposes a plate in open sight or sprints across the shelf within the visible territory. | Awareness rises by two for the plate or one for the sprint, capped at attack. | Shadow tightens, circling becomes a direct line, then wings fold into a dive. |
| Player fires before contact. | The current attack is interrupted and awareness falls by two; the report is remembered by the return route. | Muzzle flash and echo; the pterodactyl sheers away; a deeper call answers near the brook. |
| A dive reaches the player. | One body margin and the highest-value intact plate are lost; awareness returns to watch. A later hit with no margin ends the run. | Knockdown, torn sleeve, case impact and the exact cracked plate. |

### Support system B — route, cover and limited defense

| Observable cause | World / state response | Readable feedback |
|---|---|---|
| Player follows the brook or reorients to red basalt / Fort smoke. | Route confidence is conveyed without a stored navigation score. | Water grows louder toward camp; cliff and smoke align through canopy gaps. |
| Player enters dense thorn/canopy route. | Travel takes longer; aerial contact cannot land while the player remains under cover. | Branches scrape the camera; shadow passes over but cannot descend. |
| Player enters exposed creek route while wildlife is in attack. | Travel is faster, but one attack reaches the case unless interrupted; the best intact plate breaks. | Open sky, accelerating wing beats and a marked case strike. |
| Player fires and then uses the creek route. | The immediate passage is safe, but the gunshot adds delay and a terrestrial silhouette/call at the final brook crossing. | Echo travels toward camp; the brook-side brush moves before the player arrives. |
| Player abandons the plate case. | Fastest survival route opens; all evidence becomes unavailable for the ending. | Case lands in view; camera/plate HUD disappears; Fort smoke becomes the sole focus. |

### Resource and state audit

| Resource / measure | What it measures | Production | Consumption | Scarcity ratio in a strong run | Rule read point |
|---|---|---|---|---|---|
| Remaining light | Time before the return trail becomes an automatic failure. | Starts at 420 seconds; never replenished. | Real play and route commitments consume it continuously. | 420 available / roughly 330–390 desired = 1.08–1.27. | Route choice, timeout and extraction result. |
| Four glass-plate slots | Remaining chances to make a record and the physical survival of the record. | Four intact, unexposed plates at start; no new plates. | Every shutter spends one unexposed plate; a case strike cracks one intact plate. | Four available / four desirable exposures = 1.0. | Camera availability, evidence total and ending grade. |
| Intact evidence points | Quality/context visible across recovered plate previews. | Each exposed intact plate adds zero, one or two; the authored run maximum is seven. | Breaking a plate removes its points. | Seven authored points / six needed for the strongest field grade = 1.17. | Plate feedback, current record band and final result. |
| Two rifle cartridges | Number of loud emergency interruptions. | Two at start; no production. | One per shot whether timed correctly or not. | Two available / up to three tempting pressure moments = 0.67. | Fire availability, attack interruption and gunshot route consequence. |
| Wildlife awareness | How directly the pterodactyl has localized the player. | Cover plate +1; open plate +2; exposed sprint +1. | Six seconds of cover -1; timely shot -2; bounded from zero to three. | Not an inventory resource; both increases and decreases occur in every intended line. | Distant / watch / search / attack behavior and route strike. |
| Body margin | One recoverable contact before the next contact ends the run. | One at start; never restored. | An unblocked dive consumes it. | One available / two authored potential contacts = 0.5. | Contact consequence, danger feedback and death condition. |
| A shot was fired | Persistent action-history flag, not a score. | Set by any rifle discharge. | Never cleared during the run. | N/A; one write is sufficient. | Brook-route response and field-report callback at extraction. |

No stamina, hunger, crafting, general health bar, inventory grid, XP, kill count
or currency exists. Route confidence is communicated, not accumulated. The
action-history flag is read later and therefore is not orphan state.

## Numeric budget

### Threshold reachability

| Threshold / target | Start | Typical single change | Minimum actions | Reachability calculation |
|---|---:|---:|---:|---|
| Any recovered record | 0 evidence | A partial plate adds 1 | 1 shutter | `0 + 1 = 1`; reachable in the teaching beat. |
| Corroborating field record | 0 evidence | A clear contextual/behavior plate adds 2 | 3 shutters on the authored route | Tutorial partial `1` + clear scale `2` + clear behavior `2` = `5`, crossing the `4` threshold. |
| Strong field record | 0 evidence | Three later strong frames add 2 each | 4 shutters | Tutorial partial `1` + scale `2` + young-at-play behavior `2` + branch-pull behavior `2` = `7`; threshold is `6`, so three good later decisions are required. |
| Survive one mistake | 1 body margin | One unblocked strike costs 1 and one best plate | 1 avoided follow-up | `1 - 1 = 0`; the next unblocked strike fails. |
| Use every tempting defense window | 2 cartridges | Each timely interruption costs 1 | Impossible to cover all 3 authored pressure moments | `2 - 3 = -1`; the player must solve at least one pressure moment with cover or route. |
| Finish before dark | 420 seconds | Core decisions consume about 20–70 seconds each | 5 authored beats | Strong reference path: `60 + 70 + 75 + 55 + 80 = 340`, leaving `80` seconds; deliberate recovery may spend up to the remaining buffer. |

### Result bands

| Survival | Intact evidence | Result | Player-visible interpretation |
|---|---:|---|---|
| Failed | any | Run failure | The cause and next adjustable action appear; evidence is not evaluated. |
| Alive | 0 | Returned without a record | A story reached camp, but no plate did. |
| Alive | 1–3 | Insufficient record | Some image survived; obstruction, blur or missing context leaves it weak. |
| Alive | 4–5 | Corroborating record | Multiple readable features support the expedition claim but do not settle all doubt. |
| Alive | 6–7 | Strong field record | Scale, living form and behavior are present across intact plates; the prototype's full promise is met. |

### Passing reference path

```text
start: 420 seconds, 4 clean plates, 0 evidence, 2 cartridges,
       awareness 0, body margin 1

inspect track and reach blind                 -> 360 s
partial covered tutorial plate                -> evidence 1, plates 3 unused, awareness 1
take basalt scale frame after reading shadow  -> 290 s, evidence 3, awareness 2
wait under broad fern, record young at play   -> 215 s, evidence 5, awareness 2
record adult pull branch, retreat into cover  -> 160 s, evidence 7, awareness 3 then 2
use covered return and reach Fort             -> 80 s, evidence 7, 4 intact, 2 cartridges

result: alive + strong field record
```

The path reaches the top band through three later correct observation choices,
not through the tutorial plate or starting state.

## Decision-depth example

Representative decision: the pterodactyl is visibly in **attack** at the final
return fork. Remaining light, intact plate previews and cartridges are all
visible. Outcome priority is survival first, then recovered evidence band,
then retained resources/time. Route costs are deterministic.

| Visible state | Covered thorn route: 28 s, no plate loss | Exposed creek: 12 s, best plate breaks at attack | Warning shot + creek: 18 s, 1 cartridge, no plate loss | Drop case + sprint: 8 s, all proof lost | Best action and why |
|---|---|---|---|---|---|
| 40 s; evidence 7 on 4 plates; 1 cartridge | Alive, evidence 7, 12 s left | Alive, evidence 5, 28 s left | Alive, evidence 7, 22 s left, no cartridge, gunshot callback | Alive, evidence 0, 32 s left | **Covered route** preserves the top band without noise. |
| 20 s; evidence 7 on 4 plates; 1 cartridge | Timeout before Fort | Alive, evidence 5, 8 s left | Alive, evidence 7, 2 s left, gunshot callback | Alive, evidence 0, 12 s left | **Warning shot + creek** is the only strong-record finish. |
| 20 s; evidence 5 on 3 plates; 0 cartridges | Timeout before Fort | Alive, evidence 3, 8 s left | Unavailable | Alive, evidence 0, 12 s left | **Exposed creek** preserves an insufficient but real record. |
| 10 s; evidence 2 on 1 plate; 0 cartridges | Timeout before Fort | Timeout before Fort | Unavailable | Alive, evidence 0, 2 s left | **Drop case + sprint** is the only survival result. |

No action is best in more than one of the four representative states. “Always
take the biggest number” and “always save ammunition” both fail.

## Genre-fidelity go / no-go

| Question | Decision | Implementable evidence required |
|---|---|---|
| Does the world use the core system against the player? | **GO** | Wildlife reads the player's covered/open camera commitment; it withdraws or creates behavior windows and escalates awareness while the player tries to improve proof. |
| Does every non-teaching beat contain a real choice? | **GO** | Each later beat offers a faster/exposed or slower/covered commitment whose proof, light and threat consequences differ; no route is always correct. |
| Does the signature fantasy live in a repeated core verb? | **GO** | The player exposes multiple plates, sees different concrete frame results, then protects those exact plates through the return. No cutscene grants the record. |
| Does the headline system offer non-dominated options? | **GO** | Covered framing, exposed framing, waiting for behavior and abandoning a frame are each optimal under different light/awareness/plate states; the return table proves a parallel route flip. |

If wildlife ignores camera exposure, every plate grades identically, or one
return action dominates the decision table, the design returns to this gate
before adding content.

## Level map and route grammar

```text
                         [Canopy overlook]
                        /                  \
[Fort Challenger]--[Brook blind]        [Iguanodon glade]
        ^               \                  /        \
        |                [Basalt shelf]---          [Rookery sightline]
        |                                             (not enterable)
        |                    return fork
        +---------[Covered thorn route] <   > [Exposed creek route]
```

| Space | Visible range and landmark | Main route | Optional risk route | Choice it creates |
|---|---|---|---|---|
| Fort Challenger | Thorn wall, camp smoke, giant gingko and red cliff through canopy. | Brook exits the gate toward fresh tracks. | None; this is safety and submission. | Establishes what “home” looks and sounds like before the player leaves it. |
| Brook blind | Short sight lines, loud water, three-toed print and a narrow leaf gap onto the herd. | Examine track, follow water, take a safe partial frame. | Skip the frame and proceed with more plate capacity but no teaching reward. | Information now versus capacity later. |
| Canopy overlook | Broad fern leaves break the sky; herd visible through moving gaps. | Longer covered descent to the glade. | Wait for a behavior window from concealment. | Lower awareness and behavior evidence versus time. |
| Basalt shelf | Open sky, red rock scale and complete animal silhouette. | Short exposed descent to the glade. | Hold a clean scale frame while the pterodactyl can localize the player. | Better proof and saved time versus threat escalation. |
| Iguanodon glade | Two adults and three young, grazed clearing, rookery shadow beyond trees. | Read the family and return when pressure changes. | Remain for a young-at-play or branch-pull behavior frame while the aerial shadow approaches. | Lock a strong record now or preserve safety/body margin. |
| Covered thorn return | Fort smoke is intermittent; branches occlude the sky. | Slow, safe aerial counter-route. | Optional cover pause lowers awareness before committing. | Spend time to protect evidence. |
| Exposed creek return | Water points directly to Fort; open crossings show the sky. | Fast route whose cost depends on threat and shot history. | Timely rifle interruption protects the case but calls a second danger toward the brook. | Spend evidence, ammunition or time based on remaining state. |

The rookery crater is a distant visual and threat source, not a playable biome.
The central lake, far caves, factions and detached pinnacle are outside this
slice. This preserves a connected 3D place without implying a true open world.

## Five-beat level pacing

### 1. Teach — Fort to brook blind

- **Tension goal:** curiosity with safe consequence.
- **Known:** the field order, movement/look, Fort as the return point.
- **New:** examine a track, use brook sound, raise/commit the camera, read one
  concrete plate defect.
- **Cold start, first 60 seconds:** at 0–6 seconds the field order appears; by
  10 seconds control begins on the sunlit track; by 30 seconds the player can
  examine it; by 45 seconds the herd silhouette is visible; by 60 seconds the
  first plate can expose and immediately show `PARTIAL — foliage hides the
  flank.`
- **Pressure if ignored:** no instant damage. Skipping observation leaves the
  player without the track context note; leaving without any plate can only
  produce survival without proof.
- **End marker:** first plate preview.

### 2. Variation — canopy overlook versus basalt shelf

- **Tension goal:** make “better evidence costs exposure” visible.
- **Known:** plate commitment and a partial framing defect.
- **New:** two observation positions change proof and awareness differently.
- **Pressure if ignored:** sprinting into the open and exposing a plate pushes
  wildlife toward search/attack; it does not merely play an alarm line.
- **Feedback:** leaf occlusion versus complete flank and basalt scale; distant
  call becomes head turn, tighter shadow and circling path.
- **End marker:** the player enters the glade with the pterodactyl at a readable
  awareness state.

### 3. Combination — family behavior under the rookery shadow

- **Tension goal:** combine observation timing, frame quality and cover.
- **Known:** position affects proof; cover affects awareness.
- **New:** the young playing around the adults and an adult pulling down a
  branch create short strong evidence windows while a passing shadow shows that
  the territorial threat is also gaining a line on the player.
- **Required combination:** observe the adult orientation, choose a frame and
  leave or cover before the dive line completes.
- **Optional mastery synergy:** crouch beneath the broad fern and wait for the
  shadow to turn the herd; the fern prevents a clean dive while the behavior
  remains frameable through a low gap. Missing this synergy still allows a
  lower-value exposed frame or a warning shot that buys space but cannot stage
  the behavior bonus.
- **End marker:** the family behavior is recorded or the window closes and the
  return fork opens.

### 4. Test — altered return

- **Tension goal:** transfer learned cover/exposure rules with less prompting.
- **Known:** current plate band, remaining light, cartridges and threat pose.
- **New:** covered route, exposed shortcut and loud interruption now trade the
  same resources against one another.
- **No route label says “safe” or “fast.”** Canopy, water, shadow and time expose
  the consequence.
- **Measurable target:** the Strong reference script below must finish with
  evidence 6–7, at least one cartridge and 30–120 seconds. The Mixed script must
  finish with evidence 4–5 and a gunshot callback. The Panic script must trigger
  an explicit failure or no-record result; it may not reach the strong band.
- **End marker:** the player sees Fort smoke through the final cover gap or
  drops the plate case.

Bound deterministic reference scripts:

| Script | Fixed action sequence | Required result |
|---|---|---|
| Strong | Inspect track → partial tutorial frame → basalt scale frame → cover until awareness drops → young-at-play frame → branch-pull frame → covered return → Fort. | Alive; evidence 6–7; body margin retained; at least one cartridge; 30–120 seconds remain. |
| Mixed | Inspect track → partial frame → covered clear frame → hurried glade frame → leave the later behavior window → fire once at return attack → exposed creek → Fort. | Alive; evidence 4–5; at least two plates remain; the gunshot callback appears. |
| Panic | Skip track → sprint shelf → expose every plate immediately without stable behavior → fire both rounds after attacks begin → take creek without cover discipline. | Second hit, timeout or returned evidence 0–3; never strong. At least one failure/rejection state must be exercised. |

P0 has deterministic outcomes, so no seed can rescue the Panic sequence or
break the Strong sequence. If later ambient seeds affect decision windows, the
three scripts must retain these bands under every supported seed.

### 5. Fate return — Fort gate and field record

- **Tension goal:** release physical danger, then make the player's action
  history legible without a victory speech.
- **Known:** the case and body reached camp or did not.
- **Resolution:** the view remains first-person as surviving plates are set on a
  light board. Broken slots stay broken. Each intact preview contributes its
  recorded strengths/defects, then the result line appears.
- **Action-history callback:** if a rifle was fired, a second line reads:
  `The report carried. Something answered by the brook.` This explains the
  altered route and does not change the proof grade after the fact.
- **Restart:** `Take the route again` returns to the same field order and clean
  initial state.

## First-screen focus and disclosure states

| Element | First controllable frame | Reveal trigger | Persistent behavior |
|---|---|---|---|
| Sunlit three-toed track | **Sole visual focal point** | Already visible; examine prompt appears only in range. | Becomes ordinary world geometry after inspection. |
| Field order | Fading one-line strap after the opening card | Control begins. | Can be recalled from pause; does not remain as a large objective panel. |
| Plate rail | Hidden | Camera first raised. | Four small physical slots remain; preview marks show zero/one/two evidence cues without a large score. |
| Remaining-light watch | Folded/minimal | First plate exposed or player checks the watch. | Shows exact remaining seconds when opened; a small sunset hand remains afterward. |
| Cartridge display | Hidden | Rifle first raised or a dive commits. | Two chamber marks remain while weapon is active, then collapse. |
| Plate preview | Hidden | Each shutter result. | Appears briefly; all previews are reviewable only while safe or paused. |
| Threat meter | Absent | Never. | Calls, gaze, shadows and dive pose are the interface. |
| Result panel | Hidden | Fort gate submission or failure. | Replaces action HUD; displays cause, recovered plates and restart action. |

The camera overlay cannot hide plate condition, remaining light or the threat's
central silhouette. No minimap, compass ribbon, damage number, hit marker,
objective beam or floating creature label is present.

## Feedback and failure

Every core input closes within the same beat:

- **Examine:** hand/eye settles on trace → short concrete field note → route or
  subject behavior becomes legible.
- **Raise camera:** leather/metal movement and narrower frame → obstruction and
  stability indicators appear on the image itself.
- **Release shutter:** mechanical release and two-second commitment → plate
  slides out → monochrome result names one strength or defect.
- **Enter cover:** canopy closes and wing sound widens → dive line breaks →
  threat posture de-escalates after the required duration.
- **Fire:** flash/report/recoil → current dive veers away → a distant answering
  call and changed brook motion announce the deferred cost.
- **Plate damage:** case strike and glass crack → the exact preview fractures →
  record band visibly falls.

| Failure / partial result | Exact result text | Actionable next-run cue |
|---|---|---|
| Second unblocked strike | `The second pass found you in open ground.` | `Break the dive under the trees, or fire before contact.` |
| Remaining light expires outside Fort | `The basin went dark. The brook was no longer enough.` | `Leave the last frame, or take the shorter return while it is still usable.` |
| Leaves navigable terrain | `The red cliff gives no path here.` | Camera returns to the last stable ground; this is recovery, not a run-ending skill judgment. |
| Alive, no evidence | `You returned with a story. Stories are what they came to dispute.` | `Expose a plate, then keep the case with you.` |
| Insufficient evidence | `The plates survived. The animal never stands clear.` | The result lays out the exact occluded/unstable previews. |
| Corroborating record | `Living form, more than one angle. The argument can begin again.` | Shows which missing cue—scale or behavior—kept the record below strong. |
| Strong field record | `Scale. Living form. Behavior. The field record holds.` | No deterministic claim about public belief or subjective fun. |

Death/failure never says only `Game Over`. Restart is available immediately,
and the result does not conceal the plate or route consequence that caused it.

## Social presentation assumption

This slice is pure single-player. There is no login, leaderboard, ghost,
co-op partner, simulated teammate or network state. Fort Challenger and the
field order establish an expedition outside the current route, but no AI ally
performs observation, defense or extraction for the player. The result is local
to the run and is not compared with other players.

## Minimum playtest, scope, non-goals and acceptance

### Maximum-risk playtest question

Can a first-time player move from cover into a better observation position,
create a visibly stronger photographic record, recognize that the commitment
changed the wildlife threat, and alter the return route or defensive choice so
the record reaches Fort intact?

The minimum valid test is the full connected route with four physical plate
slots, at least two evidence-quality outcomes, all four awareness behaviors,
two return responses and the Fort submission. A camera sandbox, movement demo
or isolated chase cannot answer the question.

### Observation protocol

Record behavior before asking opinion:

1. Did the tester perform a meaningful examine or camera action within 30
   seconds of gaining control?
2. Which world signal did they use to reach and later relocate Fort?
3. Did they change framing position or timing after seeing a weak plate?
4. What did they think the pterodactyl was doing in each visible state, and
   which cue caused their route decision?
5. Did they use cover before ammunition? If not, what feedback made the shot
   appear cheaper?
6. Can they distinguish survival, insufficient evidence and a strong field
   record from the result screen alone?

Trigger a design revision if most first-time sessions cannot connect framing
to evidence quality, cannot distinguish watch/search/attack from animation and
sound, or treat firing at every sighting as the safest route to strong proof.
This protocol does not claim to verify fun or balance deterministically.

### Explicit non-goals

- A true open world, free-form ecosystem simulation or complete plateau.
- Amazon approach, detached pinnacle, central lake, cave village or faction
  conflict.
- Crafting, survival needs, loot inventory, progression tree or base building.
- Multiple weapons, creature killing, hunting trophies or boss battle.
- Dialogue choice, cinematic chapter retelling or London hearing.
- Multiple proof species, a full bestiary or modern paleontology lesson.
- Mobile/touch, multiplayer, backend, accounts, analytics or monetization.
- Modern film/game imagery, actor likenesses, music, creature designs or UI.

### Acceptance conditions

- A cold player can complete one start → observe → record → response → return →
  result → restart loop in the locked session window.
- Every same-play verb has observed state-change evidence; none is performed
  only by text or a cutscene.
- The first meaningful action is available within 30 seconds and the first
  plate consequence within 60 seconds.
- The Strong, Mixed and Panic reference paths reach their declared deterministic
  result bands; no authored test suite is skipped.
- The decision-depth table remains true against the final tuned values; any
  implementation drift is reconciled deliberately rather than accepted
  silently.
- The player can read the four wildlife states without a threat meter at target
  viewport.
- At least one strong-proof route uses no shot, and firing never awards behavior
  evidence.
- Failure identifies the consumed plate/time/body resource and one adjustable
  next action.
- Pause, focus loss, submission and restart cannot accidentally spend a plate,
  advance time or fire.
- Target viewport, performance, payload and loading thresholds remain those in
  the approved intake brief and are measured in the heaviest real state.
- Build verification reports actual toolchain/runtime, discovers all suites,
  executes one clean complete run and captures state/browser/visual evidence;
  unavailable channels are marked not run with a reason.

### Minimum recorded play paths

QA must capture, not merely describe:

1. the Strong reference path with all five core verbs and a no-shot return;
2. the Mixed path with a timely shot, its brook response and a corroborating
   result;
3. the Panic path reaching the declared failure/insufficient outcome;
4. one recoverable hit that breaks the displayed highest-value plate;
5. pause/focus loss during a raised camera and during a committed dive;
6. restart from each terminal state back to a clean field order.

## Character content levels and upgrade gates

| Content | Current level | Minimum delivery | Upgrade gate |
|---|---|---|---|
| Forward scout | Core player role, not a predefined hero route | Performed verbs, physical equipment, field-note uncertainty and outcome history. | Identity-specific biography is added only if testers need motive after understanding the loop. |
| Expedition / Fort Challenger | Atmosphere context | Field order, camp silhouette, smoke landmark and plate review point. | Visible companions or dialogue require evidence that absence blocks the proof/extraction premise. |
| Challenger, Summerlee and Roxton | Mention-only atmosphere | Names may appear on equipment tags or recovered notes, never as tutorial voices that perform decisions. | A support short line requires one consequential choice, persistent attitude and downstream callback; none is promised in P0. |
| Zambo and Maretas | Source-credit boundary; absent from this route | Their logistics/local knowledge are not reassigned to the player. | They enter only with a source-grounded route where their contribution is visible and they retain agency. |
| Iguanodon family | Core ecological subject | Distant grazing, young playing near adults, an adult pulling down a branch, family withdrawal and readable non-hostility. | Additional behavior needs evidence that it improves proof decisions rather than spectacle. |
| Pterodactyl | Core pressure agent | Four readable awareness states, cover interaction, dive, firearm interruption and departure. | A second threat species enters only if the first already passes legibility and the return decision lacks depth. |

No relationship or ethical-choice state is written in this prototype, so no
relationship route is silently implied. The gunshot action-history flag is a
system consequence and is visibly read at the brook and result; it does not
stand in for a character relationship.

## Audience, cultural and language scope

- **Audience calibration:** players already know mouse-look and WASD, so the
  first minute teaches only the source-specific examine/camera consequence.
  Decision density rises after the first plate; UI density stays low enough to
  leave the animal, route and camera frame readable.
- **Launch language:** English for all interface, prompts, field notes and
  results. No bilingual duplication. Planning remains English because the
  example manifest locks `en`.
- **Localization scope:** P0 ships English only. Copy keeps variables out of
  word order, reserves enough layout width for future expansion, and does not
  bake text into gameplay textures except optional source labels with a
  transcribed accessible equivalent.
- **Reading order:** field order → world focal point → one contextual action →
  immediate consequence. Prompts are one short action line; field notes name
  one observation; result copy is at most two short sentences before details.
- **Typeface requirement:** highly readable Latin body face at minimum viewport;
  period display lettering may appear only in headings and equipment labels.
  Italic handwriting never carries required action or failure information.
- **Cultural boundary:** colonial hierarchy, racial pseudoscience, extermination
  and trophy/resource conquest are excluded from the reward loop. Accala or
  expedition-worker knowledge cannot be detached from its author and credited
  to the scout. All creatures are redrawn from text plus original licensed
  research; later adaptation imagery is out of scope.

### Player-visible voice

The voice is **restrained expedition field report**: short English sentences,
concrete nouns, visible uncertainty and physical consequence. It may sound
period-aware through objects and cadence, but never uses fake archaic speech or
copies the novel's slurs and grandstanding.

| Voice surface | Purpose and pressure | Sentence habits | Never says |
|---|---|---|---|
| Field order | Send the scout toward proof and back under a deadline. | Clipped imperative; one object and one condition per line. | “Embark on an epic journey,” system terminology, praise or certain species claims. |
| Scout field note | Record what the player actually observed and distinguish inference. | Concrete fragment or short sentence; `looks like`, `fresh`, `full flank`, `cannot tell` when uncertain. | Omniscient explanation, emotion labels, modern meme language or taxonomy the frame cannot support. |
| Result report | Read back plates, damage, route and action history. | Physical evidence first; judgment second; no victory speech. | A deterministic claim that London believes, that the game is fun, or that wildlife was conquered. |

### Anti-slop writing checks

Player copy must be edited to remove symmetrical slogans, “not A but B”
constructions, omniscient foreshadowing, summary uplift, stacked adjectives,
generic `Objective updated` language, fake quotations and emotion labels. A
prompt names an action; feedback names the physical consequence; the result
reads the player's actual record. No line repeats information already legible
from the adjacent plate, watch or threat animation.
