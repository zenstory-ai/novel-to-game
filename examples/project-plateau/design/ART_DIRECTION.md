# Art Direction · Project Plateau

targetFinish: playable-prototype

## Creative position

**Stylized expedition naturalism:** a humid prehistoric basin seen through the material
discipline of an early field expedition. The living world is deep green, mineral red
and late amber; evidence is silver-black glass, ivory paper, mahogany and brass.

The game must not read as a sepia museum display, glossy theme-park jungle, modern
military shooter, asset-store collage or trophy hunt. Source facts come from the 1912
novel; modern adaptation designs, logos, likenesses, dialogue and music are excluded.

## Camera and composition

- First-person eye height and moderate field of view preserve walking scale. Tools stay
  low until used and never hide the route.
- The first frame reads track → dark canopy; the brook opens a few steps on. The player
  understands a physical route before seeing a prompt.
- Camera-raised views prioritise full animal silhouette, behaviour and one scale anchor;
  frame brackets remain peripheral.
- Return-pressure views prioritise flight corridor, nearest cover and route opening in
  that order.
- Reduced motion removes bob, recoil kick and shake without changing state timing.

The title uses a physical field plate containing a living-world view. Results place
recovered plates in the Fort light before any verdict copy. Failure holds the last
actionable world frame beneath a restrained field card.

## World and character grammar

### World

- Fort: vertical timber, canvas, ordered cases and one monumental gingko landmark.
- Brook: pale shallow flow over a grey bar, dark wet stones and a fern roof that reveals direction.
- Basalt: warm red shelves and broken planes that establish geological scale.
- Glade: broad warm opening framed by dense near foliage and cool humid depth.
- Covered return: interlocking thorn and canopy arches; exposed creek remains visibly
  faster and more dangerous.

Vegetation uses near/mid/far layers and a few recognisable families rather than repeated
cones. Terrain, roots and rocks meet the ground; route anchors remain readable without
text.

### Creatures

Iguanodons read as heavy, grounded herbivores: deep torso, weight-bearing limbs,
balanced tail, small alert head and distinct adult/young scale. They graze, play, pull a
branch and withdraw. No enemy outline, health bar or reward pose is allowed.

The pterodactyl reads through narrow membrane wings, long head, folded/extended states
and a continuous shadow path. It must not resemble a bird, bat or modern franchise
creature. Distant, watch, search and attack states remain distinguishable at gameplay
distance.

### Expedition tools

The field camera is a mahogany rectangle with black bellows, brass fittings and gripping
hands. The period rifle is dark wood and restrained metal with no modern attachments.
The plate case exposes four physical slots and visible recorded/cracked states.

## Functional colour, light and material

| Function | Treatment |
|---|---|
| Safe orientation | Ivory paper, muted brass and warm Fort light |
| Living route | Humid greens, silver water and cool canopy fill |
| Geological scale | Restrained basalt red and warm broken planes |
| Evidence | Silver-black glass with ivory edge and local captured contrast |
| Threat | Charcoal membrane silhouette, directional shadow and sound; never colour alone |
| Deadline | Longer shadow, cooler canopy and reduced ambient lift; no full-screen tint |

Materials are physically based and baked from real geometry where the eye lands most
(ground, stegosaurus skin). Bloom, noise and texture never substitute for form.

## HUD and interaction feedback

The HUD is an expedition field system, not a survival dashboard. Plates sit on one edge,
light on the other, with cartridges beside it once the rifle is relevant; contextual
prompts sit low and clear when their condition ends. The only centred text is the red
attack banner (threat, nearest cover direction, crouch and rifle keys) and the contact
banner naming the broken plate. No minimap, objective arrow, threat meter or score ticker.
A field note gives way while the camera is raised so the viewfinder reading stays clear.

The opening order contains only the commission and first movement/examination verbs. The
full control reference belongs to pause. Plate slots show physical empty, exposed or cracked
state without point fill; daylight uses field language rather than seconds. The viewfinder
describes what touches the glass, while the developed plate is where an observation receives
its name. Result plates carry one short field annotation each and remain more prominent than
the verdict copy.

Prompts name actions. Feedback names physical consequences: foliage hid the flank, a
plate cracked, the report changed the route, or the brook remains exposed. Grayscale,
captions and shape/motion redundancy carry every critical rule.

## Motion and sound

- Walking tools have restrained inertia; camera commitment is deliberate and readable.
- Family behaviour originates from grounded feet, head, neck and tail counter-motion;
  whole-body sine bob and skating are rejected.
- The pterodactyl moves continuously through space, pulls up over canopy and shears away
  from a timely shot; it never clips or hovers.
- Plate insertion, shutter, glass handling, wing calls, cover contact, rifle report,
  distant answer and Fort gate each have distinct local sounds.
- Music is sparse and subordinate to route and threat audio. Captions identify important
  off-screen sounds without narrating emotion.

## Signature moments

1. **The plate breathes:** title plate shifts from still evidence to a living brook view.
2. **Three toes cross the water:** the first track catches warm light over silver water.
3. **Family in the silver frame:** adult, young, basalt and entering wing shadow share a
   committed camera view.
4. **Open water, folded wings:** the return fork exposes threat corridor, cover and the
   cost of the direct route.
5. **What reached camp:** surviving plates are physically placed before the result text.
6. **The second pass:** the last cause frame remains visible beneath failure and restart.

Each moment is reached through ordinary play. The small-screen/WebGL fallback may use a
short capture of the same build, palette and route, but it is not a separate cinematic
truth source or QA path.

## Asset priorities and degradations

Required: connected route and collision, camera, plate case, rifle, adult/young family,
pterodactyl states, functional light, edge HUD and directional audio. Extra markings,
rookery population, small flora, volumetric humidity, Fort dressing and secondary hand
motion may degrade or disappear without changing the loop.

Required assets may use simple original geometry during foundation work, but the final
playable prototype must keep recognisable silhouettes, state changes and material roles.
Missing focal tools or creatures cannot silently fall back to invisible or unrelated
content.

## Risks and evidence boundary

Close frames can reveal weak anatomy; dense foliage can hide the route; warm light can
collapse into sepia; field UI can become a report dashboard. These are reviewed against
representative gameplay frames, not converted into an automated beauty score. Machine QA proves rendering and state, not composition,
anatomy, comfort or subjective finish.

## Rendering look (2026-10)

Target: a cohesive stylised-realistic basin in late, low light — long shadows, humid
aerial depth, lush ground — not a flat toy diorama. The route, collisions, wildlife timing
and evidence outcomes are unchanged by the look.

- **Light:** one low warm sun over the western wall, ahead-left of the outbound walk, so
  animals, trunks and banks carry a lit edge and a long shadow toward the scout. Sky fill
  comes from a hemisphere light plus a PMREM of the same painted sky the player sees. The
  sun's shadow frustum follows the view and is texel-snapped. No invented fill lights.
- **Scale:** first-person eye at 1.8 m (crouch 1.15 m). Iguanodons and the stegosaurus
  must tower; grass reaches the knee.
- **Post:** linear-HDR GTAO, restrained bloom (sun, water glints only), a log-contrast and
  split-tone grade (teal shade, amber light), AgX tone mapping, then SMAA/FXAA. Height fog
  with sun-side scattering separates foreground, family and forest wall.
- **Sky:** painted dome — zenith blue, warm horizon toward the sun, a cumulus band and
  cirrus. Floating cloud-puff meshes are rejected.
- **Ground:** five Blender-baked PBR layers (litter, moss, mud, gravel, rock) chosen by the
  terrain's own ecology masks and blended by layer height; steep faces go triplanar and
  read as bedded red sediment. The worn path stays bare mud with water-filled prints.
- **Life in the frame:** wind-swayed instanced grass rings (near + far) avoid the path,
  gravel bars, banks and rock; backlit foliage glows; pollen motes only show against the
  sun; creatures get countershading and a warm rim when backlit.
- **Rejected:** sepia wash, crushed black canopy, neon greens, puddles that read as snow,
  full-screen tint. Threat may darken and desaturate the frame edges only while a dive is
  committed, alongside call, shadow and flight path.

### Authored scenes (unchanged)

The river room keeps its incised terraces, point bars, backwaters and meadow masses
outside the protected walking seam (east of x=29 / south of z=-90 for high walls; ≤0.3 m
inside the basin). Scenes: Fort threshold, track bend, family crossing, return fork, and the
title as a live silver plate onto the same world. Chapter XII adds a fifth: the
stegosaurus drinking broadside at the west bank of the brook beyond the glade.
