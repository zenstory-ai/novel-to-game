# Game Design · Project Plateau

## Player promise

In one 1–3 minute first-person expedition, cross a readable prehistoric basin,
photograph behaviour that can survive scrutiny, escape the ecosystem's response and
return the physical plates to Fort Challenger.

The player is a forward scout, not a hunter. Success comes from reading terrain,
exposure and animal behaviour; defense only reopens an escape route. The design adapts
the novel's disputed sightings, dangerous field observations and damaged-proof return
from Chapters 4, 10–12 and 16.

## Experience profile and pillars

- **Type:** real-time first-person 3D connected-zone survival adventure.
- **Mastery:** route knowledge, observation timing and threat reading; no build grind.
- **Session:** 180 seconds available; a learned path finishes in 45–120 seconds.
- **Outcome:** the physical record that reaches Fort, not enemies defeated.

Three pillars govern every system:

1. **Read the living route:** water, tracks, calls, silhouettes and canopy communicate
   where to go and what may happen.
2. **Proof is exposed action:** a useful plate requires position, framing and a live
   commitment while the threat can change.
3. **Defense buys escape:** cover is primary; one of two cartridges can interrupt a dive
   but worsens the direct brook return.

## Core loop and action arc

```text
move and inspect → choose a view → expose a plate → read the response
→ use cover or a cartridge → choose the return → submit surviving plates
```

| Phase | New decision | Space opened | Phase-end marker |
|---|---|---|---|
| Explore | Read track direction, brook relation and cover | Fort → brook → observation blind | First plate is exposed and its defect is visible |
| Develop | Trade safety for scale or behaviour evidence | Canopy/basalt fork → iguanodon glade | Family behaviour is recorded or missed; threat becomes visible |
| Mature | Combine threat state, cover, defense and route | Covered thorn return or exposed creek | Fort gate closes and surviving plates are resolved |

## World response and systems

### Evidence

The player carries four glass plates. Raising the field camera exposes the player;
releasing the shutter spends one plate after a live commitment. A plate earns visible
cues for subject scale, clear body framing or behaviour, up to seven total authored
points across the run. The preview shows the actual obstruction and behaviour captured,
not an abstract quality bar.

### Wildlife awareness

The pterodactyl moves through distant, watch, search and attack behaviour. The numeric
state is hidden; silhouette, call, shadow and flight path communicate it. Dense canopy
breaks a dive but obstructs photography. The iguanodon family withdraws rather than
becoming combat targets.

### Route and defense

Open basalt offers scale and clean framing but high exposure. Canopy offers safety and
poor framing. A timely rifle shot consumes a cartridge and shears away one dive; its
noise makes the direct creek route less safe. The long thorn route is slower but offers
cover. Leaving navigable space returns the player to stable ground rather than causing
an invisible death.

### State budget

| State | Values and consequence |
|---|---|
| Light | 180 seconds; expiry outside Fort fails the run |
| Plates | Four physical slots; each becomes unexposed, recorded, cracked or lost |
| Evidence | 0–7 visible cues derived from captured conditions |
| Body margin | One recoverable contact; a second unblocked hit fails |
| Rifle | Two cartridges; firing changes threat and return conditions |
| Route history | Observation position, cover use, shot history and chosen return persist to result |

No outcome-changing randomness is required. Pause and focus loss freeze input, time and
pending consumption. Restart restores one clean initial state.

## Results and failure

Alive results are **No record** (0), **Insufficient** (1–3), **Corroborating**
(4–5) and **Strong field record** (6–7). Results first place the surviving physical
plates, then state what they support. Cracked or lost plates cannot contribute.

Failure occurs through deadline expiry outside Fort or a second unblocked contact. The
last actionable relation—threat direction, nearest cover, remaining plate or route—is
held beneath the cause card. Restart is the only reset.

## Level route and pacing

1. **Fort threshold:** a sunlit three-toed track teaches movement and examination.
2. **Brook blind:** water and cover establish the return relation; the first partial
   plate makes framing consequences visible.
3. **Canopy/basalt fork:** safety and evidence quality become incompatible.
4. **Glade:** adult and young behaviour, red basalt scale and the entering threat combine
   every learned rule.
5. **Altered return:** the player chooses covered thorns or exposed creek under the
   consequences of prior exposure and gunfire, then reaches Fort.

The first controllable frame centres the track and brook edge. No minimap, objective
arrow or lore panel competes with it. Contextual prompts disappear after use; route and
threat information stays in the world.

## Feedback and interface

- Camera raise narrows attention without freezing the world; the plate preview retains
  the captured composition.
- Calls, wing shadow and flight path carry threat escalation; colour is redundant.
- Edge UI shows plates, remaining light and cartridges. It never exposes awareness as a
  number or turns the centre into a dashboard.
- Reduced motion removes head bob, shake and FOV kick while retaining timing and state.
- Text scales to 150%; captions identify direction and source for important calls.
- Focus loss pauses safely. Keyboard/mouse controls remain available from pause.

Player-visible writing uses clipped expedition-field language and observable facts.
It avoids omniscient species certainty, conquest language, fake archaism, generic
objective messages and claims that London now believes.

## Playable prototype and boundaries

A representative Strong path leaves Fort, records the brook and basalt scale, captures
two glade behaviours, breaks the final dive with cover, returns by the covered route and
restarts cleanly. A fired-shot path must show the downstream route cost. Exact inputs
and current evidence belong to the build verifier, not this design document.

The prototype includes one connected route, four plates, one family, one threat, cover,
two defensive shots, four alive result bands, two failures and restart. It excludes a
full plateau, crafting, progression, loot, killing, multiple weapons, dialogue choices,
multiplayer, mobile/touch, backend and modern adaptation imagery.

Fun, comfort, long-term balance and publication quality remain open subjective risks;
the build only needs to prove the designed causal loop in the selected runtime.
