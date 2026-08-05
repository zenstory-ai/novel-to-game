# Tree grounding regression

## Root cause

The authored trunk geometry was changed to a bottom-origin mesh whose root plane
is `y=0`, but instanced placement still retained the old centre-origin lift
(`+2.9` / `+3.3 * scale`). That raised otherwise valid trunks above the terrain.
The reused dummy transform also retained crown tilt on the next trunk instance,
which made some contacts look even less stable.

## Correction

- Place each trunk at sampled terrain height minus the authored `0.035 * scale`
  root-seat offset.
- Reset the dummy rotation before every trunk matrix is written.
- Keep crowns independently tilted; do not leak their transform into a trunk.

## Evidence

- `glade-grounded.png`: current glade tree contacts.
- `horizon-grounded.png`: current distant and route-edge contacts.
- `browser.json`: source-bound runtime context.
- `app/test/foundation.test.js`: `every instanced tree keeps its authored root
  plane in contact with terrain` locks the placement contract.

