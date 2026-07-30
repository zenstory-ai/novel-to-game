// Grey-box renderer. Flat coloured shapes, no art: the core loop must be
// verified in this state before any engraved work. Every element here is
// later restyled by the engraved layer; the skin layer swaps generated
// plates in underneath the drawn figures on each image's own onload.

import { STRINGS } from './strings.js';
import * as skin from './skin.js';
import {
  COTTAGE, DOOR, STY, POOL, MILK_HOUSE, WELL, OUTHOUSE, WOODPILE, GARDEN,
  WOOD_EDGE, LANE_GATE, HOVEL_MOUTH, DOOR_APRON, PLATE, OBSTACLES,
} from './engine/constants.js';
import { activeCones } from './engine/schedule.js';
import { availableAction } from './engine/sim.js';
import { coneBand } from './engine/sim.js';

export const PAL = {
  paper: '#e9e0cb', plate: '#d6c9ae', ink: '#2a2119', ink2: '#5a4c3c',
  nightDeep: '#161e2e', nightMid: '#2c3a52', snow: '#c6cfdb',
  cone: '#93a8c6', amber: '#d8913f', taper: '#f0cd82', red: '#a83218',
  creature: '#14100c', cottager: '#8a7a66',
};

// ART_DIRECTION §9: Libre Caslon Text for body, dialogue and prompts; Libre
// Caslon Display for the title and cards. The faces load through the skin
// layer's font/* keys; until a face resolves (or if it never does) the stack
// falls through to Georgia — the two classes stay distinct either way.
const FONT_BODY = '"Libre Caslon Text", Georgia, "Times New Roman", serif';
const FONT_DISP = '"Libre Caslon Display", Georgia, "Times New Roman", serif';

export function fontBody(px) { return `${px}px ${FONT_BODY}`; }
export function fontDisp(px) { return `${px}px ${FONT_DISP}`; }

// ---------------------------------------------------------------- helpers

function rect(ctx, x0, y0, x1, y1, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); }
}
function disc(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
export function wedge(ctx, x, y, angle, halfAngle, reach, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, reach, angle - halfAngle, angle + halfAngle);
  ctx.closePath(); ctx.fill();
}
function text(ctx, str, x, y, px, colour, align = 'left', font = null) {
  ctx.fillStyle = colour;
  ctx.font = font || fontBody(px);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}
function wavy(ctx, x, y, w, colour) {
  ctx.strokeStyle = colour; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= w; i += 4) ctx.lineTo(x + i, y + Math.sin(i / 4) * 1.5);
  ctx.stroke();
}

// ------------------------------------------------------- engraving helpers

// Deterministic pseudo-jitter for engraving marks: a hash of the mark's index.
// Never Math.random, and never the engine's seeded RNG — the sim's seed stream
// belongs to the rules, and drawing from it would desync replays. The same
// mark lands the same way on every frame, so nothing flickers.
function det(i, salt = 0) {
  let h = (Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
  h ^= h >>> 16;
  return (h >>> 8) / 16777216;   // 0..1
}

// The engraving workhorse: parallel ink lines clipped to a rect. Shade is line
// density and brokenness, never a gradient or a soft shadow (ART_DIRECTION
// §16.3). With broken > 0 the lines come out as dashes seeded by line index,
// so the same patch hatches identically on every frame.
export function hatch(ctx, x0, y0, x1, y1, { spacing = 5, angle = 0, colour = PAL.ink, width = 1, broken = 0 } = {}) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const r = Math.hypot(x1 - x0, y1 - y0) / 2 + spacing;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.strokeStyle = colour; ctx.lineWidth = width;
  let n = 0;
  for (let d = -r; d <= r; d += spacing, n++) {
    ctx.beginPath();
    if (broken > 0) {
      ctx.setLineDash([5 + det(n, 1) * 9, 2 + det(n, 2) * 6 * broken]);
      ctx.lineDashOffset = det(n, 3) * 12;
    }
    ctx.moveTo(-r, d); ctx.lineTo(r, d);
    ctx.stroke();
  }
  ctx.restore();
}

// A board's ragged horizontal edge — the break where the loose plank sits over
// the cold slot. The silhouette is a sawtooth seeded by position along the
// break: the same break every frame, and never a clean 1.5 px rule (TASK 1).
// dir -1: the board mass lies above the edge (teeth hang down); +1: below.
function plankBreak(ctx, x0, x1, y, dir) {
  ctx.fillStyle = PAL.nightDeep;
  ctx.beginPath();
  ctx.moveTo(x0, y + dir * 16);
  ctx.lineTo(x0, y);
  let n = 0;
  for (let x = x0; x < x1 - 6; x += 7, n++) {
    ctx.lineTo(x + 3.5, y - dir * (1.5 + det(n, Math.round(y)) * 8));
    ctx.lineTo(x + 7, y - dir * (0.5 + det(n, 91) * 2.5));
  }
  ctx.lineTo(x1, y);
  ctx.lineTo(x1, y + dir * 16);
  ctx.closePath();
  ctx.fill();
  // the board's face next to the break: broken grain lines on the mass side
  hatch(ctx, x0, dir < 0 ? y - 13 : y + 3, x1, dir < 0 ? y - 3 : y + 13,
    { spacing: 4, angle: 0, colour: withAlpha(PAL.ink2, 0.55), width: 1, broken: 1 });
}

// The slot's end caps: the neighbouring boards' ends, broken off vertical.
// dir -1: the mass lies left of the edge; +1: right.
function plankEnd(ctx, x, y0, y1, dir) {
  ctx.fillStyle = PAL.nightDeep;
  ctx.beginPath();
  ctx.moveTo(x + dir * 8, y0);
  ctx.lineTo(x, y0);
  let n = 0;
  for (let y = y0; y < y1 - 6; y += 7, n++) {
    ctx.lineTo(x - dir * (1.5 + det(n, Math.round(x)) * 6), y + 3.5);
    ctx.lineTo(x - dir * (0.5 + det(n, 37) * 2), y + 7);
  }
  ctx.lineTo(x, y1);
  ctx.lineTo(x + dir * 8, y1);
  ctx.closePath();
  ctx.fill();
}

// The chink's silhouette — one deterministic generator shared by the clip
// (aperturePath) and the board cover laid over the seam (drawApertureCover).
// The language is §7.1's, measured off the regenerated plate/hovel (F12):
// the wall's planks run vertically, so the side edges are long, nearly
// straight board edges broken by a few splintered bites, and the top and
// bottom edges are the planks' broken ends — uneven stepped runs at a
// handful of depths, not the uniform 7 px fringe that read as a pinked
// mount (QA_REPORT F13). Everything is seeded by det(), so the silhouette is
// identical on every frame and never touches the sim's seed stream.
//
// The returned polylines are the cover's inner edges — the line where board
// mass meets visible room. aperturePath traces them shifted 2 px toward the
// boards, so the room always reaches 2 px under the mass: no sliver of
// plate shows at the seam, and no room pixel escapes onto the boards. The
// bounds keep the QA probe's envelopes with margin (qa_browser.py:
// left min 172, right max 578, bottom max 466) and keep the room clip
// inside plate/room's drawn rect.
function apertureEdges(ax, ay, aw, ah) {
  const xL = ax + 14, xR = ax + aw - 14;      // side baselines: 174, 576
  const yT = ay + 14, yB = ay + ah - 15;      // broken-end baselines: 164, 465
  // The planks' broken ends, left to right: runs of one to three plank
  // widths at a few depths — mostly shallow, a few broke deep — with a torn
  // splinter at some joins. inward +1 hangs down (top edge), -1 rises (bottom).
  const ends = (base, salt, inward, levels) => {
    const pts = [];
    let x = xL, i = 0, level = levels[0];
    pts.push([x, base + inward * level]);
    while (x < xR) {
      const nx = Math.min(xR, x + 28 + Math.round(det(i, salt + 7) * 62));
      pts.push([nx, base + inward * level]);
      if (nx >= xR) break;
      const next = levels[Math.floor(det(i, salt + 13) * levels.length)];
      if (det(i, salt + 21) < 0.4) {
        // a splinter at the join: a narrow spike past the deeper break
        const deep = Math.max(level, next) + 3 + Math.round(det(i, salt + 33) * 3);
        pts.push([nx + 1.5, base + inward * deep]);
        pts.push([nx + 3, base + inward * next]);
        x = nx + 3;
      } else {
        pts.push([nx, base + inward * next]);
        x = nx;
      }
      level = next;
      i++;
    }
    return pts;
  };
  // The side edges: a long straight board edge with a few splintered bites.
  // Bite positions are authored, not seeded — each QA probe lane (left
  // y 204-258, right y 210-333) must hold one or the torn-line gate loses
  // its signal; depths and lengths stay det()-seeded.
  const side = (xBase, salt, inward, bites) => {
    const pts = [[xBase, yT - 8]];
    for (const [by, bl] of bites) {
      const bd = 4 + Math.round(det(by, salt) * 3);
      pts.push([xBase, by]);
      pts.push([xBase + inward * bd, by + Math.round(bl * 0.45)]);
      pts.push([xBase + inward * Math.round(bd * 0.6), by + bl]);
    }
    pts.push([xBase, yB + 8]);
    return pts;
  };
  return {
    top: ends(yT, 61, 1, [0, 0, 4, 9, 15, 22]),
    bottom: ends(yB, 92, -1, [0, 0, 4, 9, 14]),
    left: side(xL, 43, 1, [[214, 11], [331, 9], [421, 12]]),
    right: side(xR, 53, -1, [[238, 10], [322, 11], [428, 9]]),
  };
}

// The clip the room is drawn through (ART_DIRECTION §7.1's "ragged
// aperture", §16.3's "the aperture mask"): the silhouette shifted 2 px
// toward the boards, so the room's rim always hides under the cover mass.
export function aperturePath(ctx, ax, ay, aw, ah) {
  const E = apertureEdges(ax, ay, aw, ah);
  ctx.beginPath();
  E.top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 2) : ctx.moveTo(x, y - 2)));
  for (const [x, y] of E.right) ctx.lineTo(x + 2, y);
  for (let i = E.bottom.length - 1; i >= 0; i--) ctx.lineTo(E.bottom[i][0], E.bottom[i][1] + 2);
  for (let i = E.left.length - 1; i >= 0; i--) ctx.lineTo(E.left[i][0] - 2, E.left[i][1]);
  ctx.closePath();
}

// The boards around the chink: night-deep masses filled between the
// silhouette and a mostly straight outer edge, grained vertically — the
// wall's planks run vertical, so the broken ends get end-grain ticks. The
// top mass rises to y 115-121: high enough to swallow the plate's own
// opening (F13's 52x11 sliver at y 126-137) and tuck under the roof beam,
// whose lower edge sits at y ~112-117 on the regenerated plate/hovel.
function drawApertureCover(ctx, ax, ay, aw, ah, E) {
  const x0 = ax - 20, x1 = ax + aw + 20;
  // A mostly straight outer edge with a few shallow notches — the long
  // board-course line of §7.1, not a rule.
  const outerLine = (x0, x1, base, salt, inward) => {
    const pts = [[x0, base]];
    let x = x0, i = 0;
    while (x < x1) {
      const nx = Math.min(x1, x + 60 + Math.round(det(i, salt) * 90));
      pts.push([nx, base + inward * Math.round(det(i, salt + 3) * 5)]);
      x = nx; i++;
    }
    return pts;
  };
  // Fill one mass (outer edge forward, silhouette back), then grain it —
  // vertical lines, the wall's plank run — clipped to the mass itself.
  const mass = (outer, inner, grain) => {
    ctx.save();
    ctx.beginPath();
    outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
    ctx.closePath();
    ctx.fillStyle = PAL.nightDeep;
    ctx.fill();
    ctx.clip();
    hatch(ctx, grain[0], grain[1], grain[2], grain[3],
      { spacing: 5, angle: Math.PI / 2, colour: withAlpha(PAL.ink2, 0.5), width: 1, broken: 1 });
    ctx.restore();
  };
  // sides first (y 112-492), then top and bottom over their ends
  mass([[x0, 112], [x0 + 5 + Math.round(det(1, 81) * 3), 300], [x0, 492]],
    E.left, [x0 - 2, 112, ax + 18, 492]);
  mass([[x1, 112], [x1 - 5 - Math.round(det(1, 83) * 3), 300], [x1, 492]],
    E.right, [ax + aw - 18, 112, x1 + 2, 492]);
  mass(outerLine(x0, x1, 115, 85, 1), E.top, [x0, 110, x1, 192]);
  mass(outerLine(x0, x1, 488, 87, -1), E.bottom, [x0, 444, x1, 490]);
  // end-grain ticks at the broken ends: short horizontal strokes where the
  // skyline steps, on the mass side of the edge
  ctx.strokeStyle = withAlpha(PAL.ink, 0.6); ctx.lineWidth = 1;
  for (const E2 of [E.top, E.bottom]) {
    const dir = E2 === E.top ? -1 : 1;
    for (let i = 1; i < E2.length - 1; i++) {
      const dy = E2[i][1] - E2[i - 1][1];
      if (Math.abs(dy) >= 4 && E2[i][0] - E2[i - 1][0] < 4) {
        ctx.beginPath();
        ctx.moveTo(E2[i][0] - 5, E2[i][1] + dir * 2);
        ctx.lineTo(E2[i][0] + 5, E2[i][1] + dir * 2);
        ctx.stroke();
      }
    }
  }
}

// Gloss an utterance against the player's vocabulary: known words print,
// unknown words are engraved wavy rules of the same length.
export function glossText(ctx, str, wordsKnown, x, y, px, colour, align = 'center') {
  const known = new Set(wordsKnown.map(w => w.toLowerCase()));
  const words = str.split(' ');
  ctx.font = fontBody(px);
  const widths = words.map(w => Math.max(ctx.measureText(w).width, w.length * px * 0.42));
  const gap = px * 0.35;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < words.length; i++) {
    const bare = words[i].replace(/[^a-z'’-]/gi, '').toLowerCase();
    if (known.has(bare)) text(ctx, words[i], cx, y, px, colour);
    else wavy(ctx, cx, y - px * 0.3, widths[i], PAL.ink2);
    cx += widths[i] + gap;
  }
}

// ---------------------------------------------------------------- the plate

// ------------------------------------------------------ the holding plate
//
// ART_DIRECTION §3.1 puts the whole holding in plan on one non-scrolling plate;
// §16.3 lists that plate as Canvas 2D work — "walls in section, three hatched
// ground types, trees in outline, the pool, the sty, the well, the woodpile,
// the path, the lane gate" — and §P5 says shade is hatching, never a gradient.
// Every rect below that also appears in engine/constants.js OBSTACLES is drawn
// on the collision figure itself, so the drawing cannot drift from the geometry
// the creature is actually pushed out of.
//
// §4.4 allows exactly three ground surfaces and no fourth:
//   snow          blank ground with the paper's chain lines showing
//   cleared path   fine stipple (the apron to the lane gate, and to the milk-house)
//   thawed earth   broken horizontal lines; ruled furrows when Felix had a free
//                  thaw day, which is a flag on the same generator, not a fourth
// §4.4 also fixes where detail is spent: the open ground between the outhouse and
// the door is the emptiest region on the plate, because that is where the player
// is exposed and has to read a cone against nothing. Nothing decorative is drawn
// there — the hatch stops at its edge.

// Laid-paper chain lines: the widely spaced marks of the mould, not shading.
// They give the snow field its "blank paper" read without tinting it (§4.4).
function chainLines(ctx, x0, y0, x1, y1, colour) {
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = 1;
  for (let x = x0 + 30, n = 0; x < x1; x += 58, n++) {
    // Barely there on purpose: this is the mould's mark on blank paper, not
    // shading. Strong enough and the snow field reads as ruled cloth, which is
    // the one thing §4.4 says the emptiest region must not do.
    ctx.globalAlpha = 0.045 + det(n, 91) * 0.025;
    ctx.beginPath(); ctx.moveTo(x + det(n, 92) * 2, y0); ctx.lineTo(x - det(n, 93) * 2, y1);
    ctx.stroke();
  }
  ctx.restore();
}

// Fine stipple: the cleared path. Dots, deterministic, so "work you did" reads
// as a worked surface rather than a wider line (§4.4).
function stippleBand(ctx, ax, ay, bx, by, halfW, colour, density = 0.7) {
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len, uy = (by - ay) / len;
  const n = Math.round(len * density);
  ctx.fillStyle = colour;
  for (let i = 0; i < n; i++) {
    const t = (i + det(i, 11) * 0.9) / n;
    const off = (det(i, 12) - 0.5) * 2 * halfW;
    const x = ax + ux * len * t - uy * off, y = ay + uy * len * t + ux * off;
    const r = 0.6 + det(i, 13) * 0.8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

// Thawed earth, and its one flag. Broken horizontals read as ground that has
// given up its snow; with furrows the same generator rules them tight and solid,
// which is the only way the plate says Felix had a free day and turned the beds.
function thawedEarth(ctx, x0, y0, x1, y1, furrows, colour) {
  if (furrows > 0) {
    const step = Math.max(5, (y1 - y0) / (furrows + 1));
    ctx.strokeStyle = colour; ctx.lineWidth = 1.2;
    for (let y = y0 + step, n = 0; y < y1 - 1; y += step, n++) {
      ctx.beginPath(); ctx.moveTo(x0 + 2, y); ctx.lineTo(x1 - 2, y); ctx.stroke();
    }
    return;
  }
  hatch(ctx, x0, y0, x1, y1, { spacing: 6, angle: 0, colour, width: 1, broken: 1.4 });
}

// A contact shadow: the §3.2 "can I interact" language. An actionable object is
// a closed contour with a cast shadow; scenery is an open outline with none. The
// shadow is hatched, not blurred — a soft shadow would be the one gradient on
// the plate.
function contactShadow(ctx, x0, y0, x1, y1, colour) {
  // The offset scales with the object, or a 14 px well head carries the same
  // shadow as a 180 px cottage and the small actionables turn to mush.
  const d = Math.max(2.5, Math.min(5, Math.min(x1 - x0, y1 - y0) / 7));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y0 + d); ctx.lineTo(x1 + d, y0 + d + d);
  ctx.lineTo(x1 + d, y1 + d); ctx.lineTo(x0 + d + d, y1 + d);
  ctx.lineTo(x0 + d, y1); ctx.lineTo(x1, y1);
  ctx.closePath(); ctx.clip();
  hatch(ctx, x0, y0, x1 + d + 1, y1 + d + 1,
    { spacing: 2.4, angle: Math.PI / 4, colour, width: 1 });
  ctx.restore();
}

// An outbuilding in plan: walls in section (a ruled band, hatched between the
// two lines), roof cut away. Actionable ones carry the contact shadow.
function planBuilding(ctx, x0, y0, x1, y1, ink, actionable) {
  if (actionable) contactShadow(ctx, x0, y0, x1, y1, ink);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  // Wall thickness and its hatch both scale with the building, so the section
  // reads as a section at 14 px as well as at 180 px.
  const t = Math.max(2, Math.min(3.5, Math.min(x1 - x0, y1 - y0) / 9));
  ctx.strokeRect(x0 + t, y0 + t, (x1 - x0) - 2 * t, (y1 - y0) - 2 * t);
  ctx.save();                                       // hatch the wall band only
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.rect(x0 + t, y0 + t, (x1 - x0) - 2 * t, (y1 - y0) - 2 * t);
  ctx.clip('evenodd');
  hatch(ctx, x0, y0, x1, y1,
    { spacing: Math.max(2.6, t * 0.9), angle: Math.PI / 4, colour: ink, width: 1 });
  ctx.restore();
}

// The ground and the fixed structures, cached. drawHolding runs on every one of
// 60 frames a second and this layer is several hundred strokes, so it is drawn
// once per distinct state and blitted. The key carries every value the layer
// reads; anything that answers to live state is drawn over it, never into it.
let groundCache = null;

function holdingGround(state, daylight) {
  const cleared = state.night >= 5 || !!(state.tonight && state.tonight.pathCleared);
  const thawed = state.night >= 5;
  const furrows = thawed ? state.freeThawDays : 0;
  const key = `${daylight}|${cleared}|${thawed}|${furrows}`;
  if (groundCache && groundCache.key === key) return groundCache.canvas;

  const cv = groundCache && groundCache.canvas
    ? groundCache.canvas : Object.assign(document.createElement('canvas'),
      { width: PLATE.w, height: PLATE.h });
  const g = cv.getContext('2d');
  g.clearRect(0, 0, PLATE.w, PLATE.h);
  const ink = daylight ? PAL.ink : PAL.snow;      // the mark colour of the night
  const ink2 = daylight ? PAL.ink2 : '#7c8aa6';

  rect(g, 0, 0, PLATE.w, PLATE.h, daylight ? PAL.paper : PAL.nightDeep);
  rect(g, 40, 40, PLATE.w - 40, PLATE.h - 40, daylight ? PAL.plate : PAL.nightMid);
  chainLines(g, 40, 40, PLATE.w - 40, PLATE.h - 40, ink);

  // Cleared path: the apron to the lane gate, and the apron to the milk-house.
  if (cleared) {
    stippleBand(g, DOOR_APRON.x, DOOR_APRON.y, LANE_GATE.x, LANE_GATE.y, 7, ink, 0.9);
    stippleBand(g, DOOR_APRON.x, DOOR_APRON.y, MILK_HOUSE.x, MILK_HOUSE.y + 16, 6, ink, 0.7);
  } else {
    g.save();
    g.strokeStyle = ink2; g.lineWidth = 1; g.globalAlpha = 0.7;
    g.setLineDash([6, 7]);
    g.beginPath();
    g.moveTo(DOOR_APRON.x, DOOR_APRON.y); g.lineTo(LANE_GATE.x, LANE_GATE.y);
    g.stroke();
    g.restore();
  }

  // The near wood: "a broken canopy outline" (§4.5) — trees in outline, never a
  // filled mass and never hatched into a thicket. The canopies themselves are
  // the edge; the wood is dense because it is drawn as many small marks, not
  // because tone was laid under them.
  g.save();
  g.strokeStyle = ink; g.lineWidth = 1.3; g.globalAlpha = 0.9;
  for (let i = 0; i < 13; i++) {
    // One tree: a closed lobed canopy in outline, and a trunk tick beneath it.
    // Drawn as a jittered radial polygon rather than arcs — arcs left open read
    // as loose spirals at this scale, which is scribble, not a wood.
    const cx = 108 + det(i, 21) * 122, cy = 150 + i * 9.5 + det(i, 22) * 6;
    const r = 10 + det(i, 23) * 9;
    const lobes = 7 + Math.floor(det(i, 27) * 3);
    g.beginPath();
    for (let k = 0; k <= lobes; k++) {
      const a = (k / lobes) * Math.PI * 2;
      const rr = r * (0.72 + det(i * 31 + k, 28) * 0.5);
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.82;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.stroke();
    g.beginPath();                                                 // the trunk
    g.moveTo(cx, cy + r * 0.7); g.lineTo(cx + det(i, 29) * 3 - 1.5, cy + r * 0.7 + 5);
    g.stroke();
  }
  g.restore();

  // The cottage: the only ruled rectilinear plan on the plate, walls in
  // section, roof cut away, one ruled hearth square, drawn once and never
  // varied (§4.4). It is scenery, so no contact shadow.
  // §4.4 is explicit that the interior is *not* a ground type: "flat plate tone
  // with the walls in section and a ruled hearth square". So no hatch inside —
  // the flat tone is what makes the one warm room in the world read as the place
  // the hatching is not.
  rect(g, COTTAGE.x0, COTTAGE.y0, COTTAGE.x1, COTTAGE.y1,
    daylight ? '#cbbf9f' : '#3a4761');
  planBuilding(g, COTTAGE.x0, COTTAGE.y0, COTTAGE.x1, COTTAGE.y1, daylight ? PAL.ink : PAL.snow, false);
  const hx = COTTAGE.x0 + 26, hy = COTTAGE.y1 - 56;                // the hearth
  g.strokeStyle = daylight ? PAL.ink : PAL.snow; g.lineWidth = 1.5;
  g.strokeRect(hx, hy, 40, 40);
  hatch(g, hx + 2, hy + 2, hx + 38, hy + 38,
    { spacing: 4, angle: 0, colour: daylight ? PAL.ink : PAL.snow, width: 1 });
  g.strokeStyle = ink; g.lineWidth = 1;                            // the south window
  g.beginPath(); g.moveTo(620, COTTAGE.y1); g.lineTo(660, COTTAGE.y1); g.stroke();

  // The hovel: a lean-to trapezoid against the cottage's back wall, opening
  // north (§4.5). Its collision rect is 606,272-654,298; the trapezoid is drawn
  // on that footprint so the shape the player sees is the shape that blocks.
  g.beginPath();
  g.moveTo(606, 298); g.lineTo(654, 298); g.lineTo(648, 272); g.lineTo(612, 272);
  g.closePath();
  g.fillStyle = daylight ? '#bfae8c' : '#33405a'; g.fill();
  g.strokeStyle = daylight ? PAL.ink : PAL.snow; g.lineWidth = 1.5; g.stroke();
  hatch(g, 608, 274, 652, 296, { spacing: 3, angle: -Math.PI / 3, colour: ink, width: 1 });
  g.strokeStyle = ink; g.lineWidth = 2;                            // the mouth, north
  g.beginPath(); g.moveTo(618, 272); g.lineTo(642, 272); g.stroke();

  // The sty: a small curved-walled square, knee height, walkable (§4.5). Its
  // wall breaks cones but not movement, so it is drawn as wall only.
  g.strokeStyle = ink; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(508, 252); g.lineTo(508, 234);
  g.quadraticCurveTo(508, 228, 514, 228);
  g.lineTo(526, 228);
  g.quadraticCurveTo(532, 228, 532, 234);
  g.lineTo(532, 252);
  g.stroke();
  hatch(g, 509, 229, 531, 251, { spacing: 6, angle: Math.PI / 5, colour: ink2, width: 1, broken: 1.6 });

  // The pool: the only pure unhatched white ellipse on the plate (§4.5).
  g.fillStyle = PAL.snow;
  g.beginPath(); g.ellipse(POOL.x, POOL.y, 22, 12, 0, 0, Math.PI * 2); g.fill();

  // Outbuildings. Actionable ones (milk-house, well, outhouse) take the closed
  // contour and the cast contact shadow; the woodpile is cover, so it stays an
  // open outline with no shadow (§3.2).
  planBuilding(g, 696, 238, 724, 264, daylight ? PAL.ink : PAL.snow, true);   // milk-house
  planBuilding(g, 463, 293, 477, 307, daylight ? PAL.ink : PAL.snow, true);   // well head
  planBuilding(g, 296, 470, 324, 500, daylight ? PAL.ink : PAL.snow, true);   // outhouse
  g.strokeStyle = ink; g.lineWidth = 1.5;                                     // woodpile
  g.strokeRect(454, 418, 52, 22);
  for (let i = 0; i < 7; i++) {                     // log ends, stacked in courses
    const x = 458 + i * 7;
    g.beginPath(); g.ellipse(x, 424 + det(i, 31) * 2, 2.4, 2.8, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(x + 3, 434 + det(i, 32) * 2, 2.4, 2.8, 0, 0, Math.PI * 2); g.stroke();
  }

  // The garden beds: the only furrowable surface, and the only thawed earth.
  const bx0 = GARDEN.x - 45, by0 = GARDEN.y - 35, bx1 = GARDEN.x + 45, by1 = GARDEN.y + 35;
  g.strokeStyle = ink; g.lineWidth = 1.2;
  g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
  if (thawed) {
    rect(g, bx0 + 1, by0 + 1, bx1 - 1, by1 - 1, daylight ? '#c9b892' : '#31405c');
    thawedEarth(g, bx0 + 3, by0 + 3, bx1 - 3, by1 - 3, furrows, ink);
  } else {
    // Under snow the beds are still beds: their divisions show as the faintest
    // ridges, and nothing else. Snow records no footprint here, because the
    // design has no tracking system and §4.4 forbids the art selling one.
    g.save();
    g.strokeStyle = ink; g.lineWidth = 1; g.globalAlpha = 0.16;
    for (let i = 1; i <= 3; i++) {
      const y = by0 + ((by1 - by0) * i) / 4;
      g.beginPath(); g.moveTo(bx0 + 4, y); g.lineTo(bx1 - 4, y); g.stroke();
    }
    g.restore();
  }

  // The lane gate: a landmark, not an exit (§4.5).
  g.strokeStyle = ink2; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(LANE_GATE.x - 12, LANE_GATE.y); g.lineTo(LANE_GATE.x + 12, LANE_GATE.y);
  g.stroke();
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(LANE_GATE.x - 12, LANE_GATE.y - 6); g.lineTo(LANE_GATE.x - 12, LANE_GATE.y + 6);
  g.moveTo(LANE_GATE.x + 12, LANE_GATE.y - 6); g.lineTo(LANE_GATE.x + 12, LANE_GATE.y + 6);
  g.stroke();

  groundCache = { key, canvas: cv };
  return cv;
}

export function drawHolding(ctx, state, opts = {}) {
  const daylight = !!opts.daylight;
  ctx.drawImage(holdingGround(state, daylight), 0, 0);
  const ink = daylight ? PAL.ink : PAL.snow;

  // Everything below answers to live state, so it is drawn over the cached
  // ground every frame — never baked into it.

  // The portmanteau at the wood's edge, until it is found.
  disc(ctx, WOOD_EDGE.x, WOOD_EDGE.y, 6,
    state.portmanteauFound ? PAL.ink2 : ink);
  if (!state.portmanteauFound) {
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(WOOD_EDGE.x, WOOD_EDGE.y, 9, 0, Math.PI * 2); ctx.stroke();
  }

  // The pig: driven or settled.
  if (state.tonight && state.tonight.pigDriven) disc(ctx, STY.x, STY.y, 5, PAL.cottager);
  else disc(ctx, STY.x, STY.y, 4, daylight ? PAL.ink2 : '#7c8aa6');

  // The load by the outhouse, or dropped where it lies.
  if (state.tonight && state.tonight.loadAvailable && !daylight) {
    rect(ctx, OUTHOUSE.x - 12, OUTHOUSE.y - 34, OUTHOUSE.x + 12, OUTHOUSE.y - 24, PAL.amber, PAL.ink);
  }
  if (state.tonight && state.tonight.loadDroppedAt) {
    const d = state.tonight.loadDroppedAt;
    rect(ctx, d.x - 10, d.y - 5, d.x + 10, d.y + 5, PAL.amber, PAL.ink);
  }
  // The pile at the door IS Firing: one course per point, 0..4.
  drawPile(ctx, state.firing, daylight);
  // Felix's tools on the nail: the dusk read of his day.
  if (state.felixFreeToday) {
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(716, 414); ctx.lineTo(716, 424); ctx.moveTo(720, 414); ctx.lineTo(720, 424); ctx.stroke();
  }
}

// The pile at the door IS Firing: one course per point, 0..4. One drawing
// serves both of its reads — the yard plan, and the strip of yard seen through
// the cold slot (ART_DIRECTION §7.1, §16.3 "the pile courses") — so the two
// can never drift into separate implementations. `at` carries only the frame
// geometry; the stacking rule is shared.
function drawPile(ctx, firing, daylight, at = {}) {
  const g = { x: DOOR.x + 8, yBase: DOOR.y + 10, w: 26, courseH: 4, step: 6, ...at };
  const fill = daylight ? '#8a6f4d' : '#a08c68';
  for (let i = 0; i < firing; i++) {
    const off = (det(i, 17) - 0.5) * 2;          // courses never stack machine-true
    const y1 = g.yBase - i * g.step, y0 = y1 - g.courseH;
    rect(ctx, g.x + off, y0, g.x + g.w + off, y1, fill, PAL.ink);
    // grain along the course: one broken cut line, two when the course is tall
    const grains = g.courseH >= 6 ? 2 : 1;
    ctx.strokeStyle = withAlpha(PAL.ink, 0.75); ctx.lineWidth = 1;
    for (let k = 0; k < grains; k++) {
      const gy = y0 + (g.courseH * (k + 1)) / (grains + 1);
      ctx.setLineDash([4 + det(i, 50 + k) * 5, 2 + det(i, 60 + k) * 3]);
      ctx.beginPath();
      ctx.moveTo(g.x + off + 2 + det(i, 30 + k) * 4, gy);
      ctx.lineTo(g.x + g.w + off - 2 - det(i, 40 + k) * 4, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the log end, when the course is big enough to carry it
    if (g.courseH >= 5) {
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(g.x + off + 3, (y0 + y1) / 2, 1.8, g.courseH * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function drawCreature(ctx, state) {
  const c = state.creature;
  if (c.inHovel) return;
  disc(ctx, c.x, c.y, c.carrying ? 15 : 13, PAL.creature);
  if (c.carrying) rect(ctx, c.x - 14, c.y - 20, c.x + 14, c.y - 12, PAL.amber, PAL.ink);
}

export function drawCottagers(ctx, state) {
  for (const cone of activeCones(state)) {
    const wide = cone.wide || cone.dawnDoor;
    const outerR = wide ? 260 : 150, outerA = wide ? 0.96 : 0.56;
    const innerR = wide ? 165 : 95, innerA = wide ? 0.52 : 0.35;
    wedge(ctx, cone.x, cone.y, cone.angle, outerA, outerR, withAlpha(PAL.cone, 0.18));
    wedge(ctx, cone.x, cone.y, cone.angle, innerA, innerR, withAlpha(PAL.cone, 0.30));
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cone.x, cone.y);
    ctx.arc(cone.x, cone.y, outerR, cone.angle - outerA, cone.angle + outerA);
    ctx.closePath(); ctx.stroke();
    disc(ctx, cone.x, cone.y, 8, cone.owner === 'felix' ? '#6a5a48' : '#7a6a58');
  }
}

export function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// The moon arc: the game's only permanent HUD element. No digits, ever.
export function drawMoonArc(ctx, state) {
  const cx = PLATE.w * 0.875, cy = PLATE.h * 0.085, r = 52;
  const frac = state.nightLength > 0 ? Math.max(0, 1 - state.minute / state.nightLength) : 1;
  ctx.strokeStyle = PAL.snow; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * frac); ctx.stroke();
  if (frac > 0 && frac < 1) {
    const a = Math.PI + Math.PI * frac;
    disc(ctx, cx + r * Math.cos(a), cy + r * Math.sin(a), 7, PAL.snow);
  }
  if (frac <= 2 / Math.max(1, state.nightLength) && frac > 0) {
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * frac); ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function drawPrompt(ctx, str, opts) {
  if (!str) return;
  const px = Math.round(15 * (opts.textScale || 1));
  rect(ctx, 0, PLATE.h * 0.88, PLATE.w, PLATE.h * 0.96, withAlpha(PAL.paper, 0.88));
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, PLATE.h * 0.88); ctx.lineTo(PLATE.w, PLATE.h * 0.88);
  ctx.moveTo(0, PLATE.h * 0.96); ctx.lineTo(PLATE.w, PLATE.h * 0.96); ctx.stroke();
  text(ctx, str, PLATE.w / 2, PLATE.h * 0.935, px, PAL.ink, 'center');
}

// ---------------------------------------------------------------- the hovel

// The hovel interior is the read-out screen: aperture with the room, the
// slot with the pile, the heap, the plank of scratches.
export function drawHovel(ctx, state, view, opts) {
  if (!skin.drawPlate(ctx, 'plate/hovel', 0, 0, PLATE.w, PLATE.h)) {
    rect(ctx, 0, 0, PLATE.w, PLATE.h, PAL.nightDeep);
    // low roof line
    rect(ctx, 0, 0, PLATE.w, 90, '#0c1220');
    // straw
    rect(ctx, 0, 560, PLATE.w, PLATE.h, '#1a2338');
    skin.stampKey(ctx, 'plate/hovel', 0, 96);
  }
  // The aperture (the chink) with the room inside.
  const ax = 160, ay = 150, aw = 430, ah = 330;
  drawRoom(ctx, state, ax, ay, aw, ah, view, opts);
  // The cold slot, lower right: the yard strip and the pile at the door.
  drawColdSlot(ctx, state, view);
  // Everything on the straw sits above the prompt band (0.88h = 704). The band is
  // opaque paper; anything drawn under it is simply not readable, and §3.3 puts
  // occlusion tolerance at zero. Heap, plank and bundle are raised to clear it.
  const FLOOR = 690;
  // The heap of his own food on the straw.
  const heap = Math.min(12, state.ownFood);
  if (heap > 0) {
    ctx.fillStyle = '#6a5a3c';
    ctx.beginPath();
    ctx.moveTo(220, FLOOR);
    ctx.lineTo(220 + 30 + heap * 8, FLOOR);
    ctx.lineTo(220 + 15 + heap * 4, FLOOR - 10 - heap * 6);
    ctx.closePath(); ctx.fill();
  }
  // The plank, and the scratches that ARE Words: grouped in fives, five groups to a row.
  // The board is engraved, not filled: grain lines run with the plank, the ends
  // show end-grain, the top edge catches the room's light and the foot sits on
  // a hatched contact shadow. drawScratches itself is left exactly as it was.
  const px0 = 460, py0 = FLOOR - 130, px1 = 860, py1 = FLOOR - 20;
  rect(ctx, px0, py0, px1, py1, '#3a3020');
  hatch(ctx, px0 + 2, py0 + 2, px1 - 2, py1 - 2,
    { spacing: 6, angle: 0, colour: withAlpha(PAL.ink, 0.7), width: 1, broken: 1.1 });
  hatch(ctx, px0, py0, px0 + 10, py1,
    { spacing: 4, angle: Math.PI / 2, colour: withAlpha(PAL.ink, 0.55), width: 1, broken: 0.8 });
  hatch(ctx, px1 - 10, py0, px1, py1,
    { spacing: 4, angle: Math.PI / 2, colour: withAlpha(PAL.ink, 0.55), width: 1, broken: 0.8 });
  for (let k = 0; k < 3; k++) {                 // knots, seeded not random
    const kx = px0 + 50 + det(k, 71) * (px1 - px0 - 100);
    const ky = py0 + 16 + det(k, 72) * (py1 - py0 - 32);
    ctx.strokeStyle = withAlpha(PAL.ink, 0.8); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(kx, ky, 4.5, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(kx, ky, 2, 1, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = PAL.ink2; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py0); ctx.stroke();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px0, py1); ctx.lineTo(px1, py1); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0, py1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px1, py0); ctx.lineTo(px1, py1); ctx.stroke();
  hatch(ctx, px0 + 4, py1 + 1, px1 - 4, py1 + 11,
    { spacing: 3, angle: 0, colour: withAlpha(PAL.ink, 0.45), width: 1, broken: 1 });
  drawScratches(ctx, state.words, 480, FLOOR - 110);
  // The journal bundle.
  if (state.words >= 62 && !state.journalRead) drawJournal(ctx, FLOOR, false);
  if (state.journalRead) drawJournal(ctx, FLOOR, true);
}

// The cold slot, lower right: not a swatch but a strip of the yard seen
// through the gap where the loose plank sits — ground, the corner of the
// cottage, and the pile of cut wood at the door (ART_DIRECTION §7.1). The
// gap's edges are the boards' own broken ends, not a stroked rect.
function drawColdSlot(ctx, state, view) {
  const sx = 900, sy = 480, sw = 260, sh = 90;
  const dawn = view === 'dawn';
  const hz = sy + sh - 24;                       // the yard's ground line
  // night air above the yard, then the ground itself: the holding's night
  // plate, carried into lines
  rect(ctx, sx, sy, sx + sw, sy + sh, dawn ? PAL.plate : PAL.nightMid);
  hatch(ctx, sx, sy + 6, sx + sw, hz - 4,
    { spacing: 9, angle: 0, colour: withAlpha(dawn ? PAL.ink2 : PAL.snow, 0.16), width: 1, broken: 1.4 });
  hatch(ctx, sx, hz, sx + sw, sy + sh,
    { spacing: 4, angle: 0, colour: withAlpha(dawn ? PAL.ink2 : PAL.snow, 0.5), width: 1, broken: 0.9 });
  // the corner of the cottage: weatherboards, and the shadow side of the turn
  const wx0 = sx + 14, wx1 = sx + 112;
  rect(ctx, wx0, sy, wx1, hz, dawn ? '#cbbf9f' : '#4a5a78');
  hatch(ctx, wx0, sy, wx1, hz,
    { spacing: 7, angle: Math.PI / 2, colour: withAlpha(PAL.ink, 0.65), width: 1, broken: 0.5 });
  hatch(ctx, wx1 - 18, sy, wx1, hz,
    { spacing: 3.5, angle: Math.PI / 2, colour: withAlpha(PAL.ink, 0.8), width: 1, broken: 0.3 });
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(wx1, sy); ctx.lineTo(wx1, hz); ctx.stroke();
  // the pile of cut wood at the door, against the corner — the same courses
  // the yard plan draws
  drawPile(ctx, state.firing, dawn, { x: sx + 96, yBase: sy + sh - 9, w: 48, courseH: 6, step: 10 });
  hatch(ctx, sx + 92, sy + sh - 8, sx + 152, sy + sh - 2,
    { spacing: 2.5, angle: 0, colour: withAlpha(PAL.ink, 0.6), width: 1, broken: 0.7 });
  // and over everything, the gap itself: the boards' ragged breaks and ends
  plankBreak(ctx, sx - 6, sx + sw + 6, sy + 2, -1);
  plankBreak(ctx, sx - 6, sx + sw + 6, sy + sh - 2, 1);
  plankEnd(ctx, sx + 2, sy + 2, sy + sh - 2, -1);
  plankEnd(ctx, sx + sw - 2, sy + 2, sy + sh - 2, 1);
}

// The journal bundle: a sewn paper parcel on the straw, drawn in lines. While
// unread it stays a dark, cord-tied packet; read, it lies paler with its
// leaves fanned — the two states must read apart at a glance (TASK 4).
function drawJournal(ctx, FLOOR, read) {
  const bx = 880, by = FLOOR - 90, bw = 50, bh = 40;
  rect(ctx, bx, by, bx + bw, by + bh, read ? '#b0a37e' : '#8a7a5c');
  // the parcel's volume: shade gathered toward the foot, in lines
  hatch(ctx, bx + 1, by + bh * 0.5, bx + bw - 1, by + bh - 1,
    { spacing: 3, angle: -0.45, colour: withAlpha(PAL.ink, read ? 0.4 : 0.65), width: 1, broken: 0.7 });
  hatch(ctx, bx + 1, by + 1, bx + bw - 1, by + bh * 0.5,
    { spacing: 5, angle: -0.45, colour: withAlpha(PAL.ink, read ? 0.25 : 0.4), width: 1, broken: 1 });
  if (read) {
    // open leaves: three page edges fanning from the fold
    ctx.strokeStyle = PAL.ink2; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const ly = by + 8 + k * 7;
      ctx.beginPath(); ctx.moveTo(bx + 6, ly); ctx.lineTo(bx + bw - 8 - det(k, 81) * 6, ly + 1); ctx.stroke();
    }
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + 6, by + 5); ctx.lineTo(bx + 6, by + bh - 6); ctx.stroke();
  } else {
    // the cord: one wrap each way, and the knot
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.58, by); ctx.lineTo(bx + bw * 0.58, by + bh);
    ctx.moveTo(bx, by + bh * 0.42); ctx.lineTo(bx + bw, by + bh * 0.42);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw * 0.58, by + bh * 0.42, 2.4, 0, Math.PI * 2); ctx.stroke();
  }
  // the folded corner
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(bx + bw - 9, by); ctx.lineTo(bx + bw, by + 9); ctx.stroke();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  // contact shadow on the straw, in lines
  hatch(ctx, bx + 3, by + bh + 1, bx + bw + 6, by + bh + 8,
    { spacing: 2.5, angle: 0, colour: withAlpha(PAL.ink, 0.4), width: 1, broken: 1 });
}

function drawScratches(ctx, words, x0, y0) {
  ctx.strokeStyle = PAL.paper; ctx.lineWidth = 1.5;
  let i = 0;
  for (let row = 0; row < 4 && i < words; row++) {
    for (let g = 0; g < 5 && i < words; g++) {
      const gx = x0 + g * 72, gy = y0 + row * 24;
      for (let k = 0; k < 5 && i < words; k++, i++) {
        ctx.beginPath();
        ctx.moveTo(gx + k * 10, gy);
        ctx.lineTo(gx + k * 10 + 3, gy + 14);
        ctx.stroke();
      }
    }
  }
}

// The room through the chink. One composition; state reads as substitution.
// The aperture is the torn gap of §7.1, not a rectangle: the room is clipped
// to aperturePath and the board masses are laid over the seam — one shared
// silhouette (apertureEdges), seeded by det(), identical every frame. The
// straight stroked rule is gone with the rectangle, and the uniform fringe
// that replaced it is gone too (F13).
function drawRoom(ctx, state, ax, ay, aw, ah, view, opts) {
  ctx.save();
  aperturePath(ctx, ax, ay, aw, ah);
  ctx.clip();
  // plate/room is the empty stage; every figure and state object is drawn on top.
  if (!skin.drawPlate(ctx, 'plate/room', ax, ay, aw, ah)) {
    rect(ctx, ax, ay, ax + aw, ay + ah, '#efe6d2', PAL.ink);
    skin.stampKey(ctx, 'plate/room', ax + 18, ay + 22);   // inside the mask
  }
  const dawn = view === 'dawn';
  // Anchors are fractions of the aperture so the drawn state objects register on
  // plate/room's real features (hearth mouth, board, window) instead of on the
  // positions the greybox happened to use. Measured off the plate itself.
  const A = (fx, fy) => ({ x: ax + fx * aw, y: ay + fy * ah });
  const HEARTH = { mouth: A(0.21, 0.62), floor: A(0.21, 0.79), w: aw * 0.23 };
  const BOARD = { left: A(0.55, 0.60), right: A(0.93, 0.60), top: A(0.55, 0.585) };
  const STOOL = A(0.715, 0.80);
  const WINDOW = A(0.81, 0.33);

  // The fire in the hearth mouth, scaling with Firing. Nothing is drawn when the
  // hearth is cold: the empty mouth is already on the plate.
  if (state.firing > 0) {
    const big = state.firing >= 2;
    const fw = HEARTH.w * (big ? 0.62 : 0.4);
    const fh = ah * (big ? 0.20 : 0.10);
    const g = ctx.createRadialGradient(HEARTH.floor.x, HEARTH.floor.y, 2,
      HEARTH.floor.x, HEARTH.floor.y, fw * 1.6);
    g.addColorStop(0, withAlpha(PAL.amber, 0.95));
    g.addColorStop(1, withAlpha(PAL.amber, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(HEARTH.floor.x, HEARTH.floor.y, fw * 1.6, fh * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.amber;
    ctx.beginPath();
    ctx.moveTo(HEARTH.floor.x - fw / 2, HEARTH.floor.y);
    ctx.lineTo(HEARTH.floor.x + fw / 2, HEARTH.floor.y);
    ctx.lineTo(HEARTH.floor.x, HEARTH.floor.y - fh);
    ctx.closePath(); ctx.fill();
  }
  // The board carries Store alone: plates stand on the real table top.
  const plates = state.store >= 5 ? 4 : state.store >= 3 ? 3 : 2;
  const span = BOARD.right.x - BOARD.left.x;
  for (let i = 0; i < plates; i++) {
    const px = BOARD.left.x + span * ((i + 0.5) / plates);
    disc(ctx, px, BOARD.top.y, Math.max(4, aw * 0.018), '#efe6d2');
    ctx.strokeStyle = PAL.ink2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, BOARD.top.y, Math.max(4, aw * 0.018), 0, Math.PI * 2); ctx.stroke();
  }
  // Figures, at room scale. De Lacey never walks alone; Agatha moves to the board
  // once Safie is in the house.
  const headR = Math.max(5, aw * 0.026);
  const figure = (pt, fill, r = headR) => {
    disc(ctx, pt.x, pt.y, r, fill);
    ctx.fillStyle = fill;
    ctx.fillRect(pt.x - r * 0.8, pt.y + r * 0.6, r * 1.6, r * 2.2);
  };
  figure(A(0.33, 0.62), PAL.cottager);                       // De Lacey, chair by the hearth
  figure(state.night >= 4 ? A(0.62, 0.66) : A(0.40, 0.72), '#7a6a58', headR * 0.9); // Agatha
  if (state.walkSlipped) figure({ x: WINDOW.x, y: WINDOW.y + ah * 0.20 }, '#6a5a48'); // Felix at the window
  else if (state.felixFreeToday) figure(A(0.86, 0.66), '#6a5a48');                    // Felix at the table
  if (state.night >= 4) figure(A(0.74, 0.66), '#1a1512', headR * 0.9);                // Safie
  // The taper on the sill (unease >= 2) and the latched stick (unease 3).
  if (state.unease >= 2) {
    disc(ctx, WINDOW.x, WINDOW.y, Math.max(3, aw * 0.012), PAL.taper);
  }
  if (state.walkSlipped) {
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(STOOL.x, STOOL.y);
    ctx.lineTo(STOOL.x + aw * 0.02, STOOL.y - ah * 0.14);
    ctx.stroke();
  }
  // The bundle of firing inside the door (Firing >= 2).
  if (state.firing >= 2) {
    rect(ctx, ax + aw * 0.90, ay + ah * 0.80, ax + aw * 0.99, ay + ah * 0.86, '#a08c68', PAL.ink);
  }
  // The first white flower (the thaw) — degradable, drawn as a dot here.
  if (state.night >= 5) disc(ctx, BOARD.right.x - aw * 0.03, BOARD.top.y - ah * 0.02, Math.max(3, aw * 0.011), PAL.snow);
  ctx.restore();
  // The boards over the seam: one shared silhouette with the clip (F13) —
  // the room reaches 2 px under the masses, so no plate sliver shows at the
  // seam and no room pixel escapes. The cover also swallows the plate's own
  // opening above the chink (the 52x11 sliver at y 126-137).
  drawApertureCover(ctx, ax, ay, aw, ah, apertureEdges(ax, ay, aw, ah));
}

// ---------------------------------------------------------------- the cold open

// The held chink (GAME_DESIGN §10 beat 1, 0:00-0:22), drawn off the seconds
// of held watch so the hold always moves the picture: the close room with
// its small fire, the old man and the girl; the guitar at 0:06; Felix home
// under the load at 0:14, the girl helping him off with it; the taper out
// at 0:18 and the view pulled back into the hovel's wide interior; the
// loose plank lifting at 0:22. `glow` is the hold itself made visible — the
// aperture dims the moment the player lets go.
export function drawColdOpen(ctx, state, coldTime, glow, opts) {
  const ax = 160, ay = 150, aw = 430, ah = 330;
  const TAPER_OUT = 17.2, PULL_BACK = 18, PULL_FADE = 2, PLANK_LIFT = 22;
  if (coldTime < PULL_BACK) {
    // Black, then one ragged aperture.
    rect(ctx, 0, 0, PLATE.w, PLATE.h, PAL.nightDeep);
    ctx.save();
    aperturePath(ctx, ax, ay, aw, ah);
    ctx.clip();
    if (!skin.drawPlate(ctx, 'plate/room', ax, ay, aw, ah)) {
      rect(ctx, ax, ay, ax + aw, ay + ah, '#efe6d2', PAL.ink);
      skin.stampKey(ctx, 'plate/room', ax + 18, ay + 22);
    }
    const A = (fx, fy) => ({ x: ax + fx * aw, y: ay + fy * ah });
    const headR = Math.max(5, aw * 0.026);
    const figure = (pt, fill, r = headR) => {
      disc(ctx, pt.x, pt.y, r, fill);
      ctx.fillStyle = fill;
      ctx.fillRect(pt.x - r * 0.8, pt.y + r * 0.6, r * 1.6, r * 2.2);
    };
    // A small fire — the cold open's one warm thing, whatever Firing says.
    const hf = A(0.21, 0.79);
    const fw = aw * 0.23 * 0.4, fh = ah * 0.10;
    const gr = ctx.createRadialGradient(hf.x, hf.y, 2, hf.x, hf.y, fw * 1.6);
    gr.addColorStop(0, withAlpha(PAL.amber, 0.95));
    gr.addColorStop(1, withAlpha(PAL.amber, 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(hf.x, hf.y, fw * 1.6, fh * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.amber;
    ctx.beginPath();
    ctx.moveTo(hf.x - fw / 2, hf.y); ctx.lineTo(hf.x + fw / 2, hf.y); ctx.lineTo(hf.x, hf.y - fh);
    ctx.closePath(); ctx.fill();
    // The old man with his head on his hands (chapter 11): the body, then
    // the bowed head carried low and forward of the shoulders.
    const man = A(0.30, 0.64);
    ctx.fillStyle = PAL.cottager;
    ctx.fillRect(man.x - headR * 0.9, man.y + headR * 0.7, headR * 1.8, headR * 2.4);
    disc(ctx, man.x + headR * 0.7, man.y + headR * 1.1, headR * 0.85, PAL.cottager);
    // 0:06 — he takes up the guitar.
    if (coldTime >= 6) {
      ctx.fillStyle = '#8a6f4d';
      ctx.beginPath();
      ctx.ellipse(man.x + headR * 0.6, man.y + headR * 2.2, headR * 1.2, headR * 0.85, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(man.x + headR * 1.4, man.y + headR * 1.9);
      ctx.lineTo(man.x + headR * 2.6, man.y + headR * 0.9);
      ctx.stroke();
    }
    // The girl — sewing at his feet until 0:14, then up to the door to meet
    // Felix and help him off with the load.
    const meet = Math.max(0, Math.min(1, (coldTime - 14) / 1.5));
    const g0 = A(0.40, 0.78), g1 = A(0.74, 0.68);
    const girl = { x: g0.x + (g1.x - g0.x) * meet, y: g0.y + (g1.y - g0.y) * meet };
    figure(girl, '#7a6a58', headR * 0.9);
    if (meet === 0) {
      // the needle: one short stroke, lifted and set
      ctx.strokeStyle = PAL.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(girl.x + headR, girl.y + headR * 1.2);
      ctx.lineTo(girl.x + headR * 1.6, girl.y + headR * (0.9 + 0.3 * Math.sin(coldTime * 3.2)));
      ctx.stroke();
    }
    // 0:14 — Felix home, bearing a load of wood on his shoulders.
    if (coldTime >= 14) {
      const felix = A(0.86, 0.64);
      figure(felix, '#6a5a48');
      if (meet < 1) {
        rect(ctx, felix.x - 18, felix.y - headR * 2.2, felix.x + 18, felix.y - headR * 0.9, PAL.amber, PAL.ink);
      } else {
        // helped off with it: the load lowered between them
        rect(ctx, felix.x - 34, felix.y + headR * 2.2, felix.x + 6, felix.y + headR * 3.0, PAL.amber, PAL.ink);
      }
    }
    ctx.restore();
    drawApertureCover(ctx, ax, ay, aw, ah, apertureEdges(ax, ay, aw, ah));
    // The hold is the light: let go and the chink dims.
    rect(ctx, 0, 0, PLATE.w, PLATE.h, withAlpha(PAL.nightDeep, (1 - glow) * 0.72));
    // 0:18 — the taper goes out ahead of the pull-back.
    if (coldTime > TAPER_OUT) {
      rect(ctx, 0, 0, PLATE.w, PLATE.h,
        withAlpha(PAL.nightDeep, Math.min(1, (coldTime - TAPER_OUT) / (PULL_BACK - TAPER_OUT))));
    }
  } else {
    // The view pulled back: the hovel's wide interior — the wall of loose
    // planks and, through the cold slot, the yard beyond.
    drawHovel(ctx, state, 'dusk', opts);
    const fade = Math.max(0, 1 - (coldTime - PULL_BACK) / PULL_FADE);
    if (fade > 0) rect(ctx, 0, 0, PLATE.w, PLATE.h, withAlpha(PAL.nightDeep, fade));
    if (coldTime >= PLANK_LIFT) {
      // 0:22 — the loose plank lifts: a widening gap of cold light along the
      // slot's foot, the plank's dark mass tipped up off it.
      const k = Math.min(1, coldTime - PLANK_LIFT);
      const sx = 900, sy = 480, sw = 260, sh = 90;
      ctx.fillStyle = withAlpha(PAL.snow, 0.85);
      ctx.fillRect(sx + 4, sy + sh - 2 - k * 9, sw - 8, k * 9);
      ctx.fillStyle = PAL.nightDeep;
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + sh - 2 - k * 9);
      ctx.lineTo(sx + sw - 2, sy + sh - 2 - k * 9 - k * 5);
      ctx.lineTo(sx + sw - 2, sy + sh - 2 - k * 9 - k * 5 - 7);
      ctx.lineTo(sx + 2, sy + sh - 2 - k * 9 - 7);
      ctx.closePath(); ctx.fill();
    }
  }
  // The hold's progress: one thin rule above the prompt band, no digits.
  ctx.fillStyle = withAlpha(PAL.amber, 0.55);
  ctx.fillRect(0, PLATE.h * 0.88 - 5, PLATE.w * Math.min(1, coldTime / 23), 2);
}

// ---------------------------------------------------------------- cards & title

// The card's paper, centred on the plate. Card ink must never leave it: the
// paper is the one light ground on a night-deep plate, so a glyph off its
// edge is a glyph lost (QA_REPORT F8). The sheet itself grows with the
// text-size setting — a reader who asks for larger type gets a larger
// sheet, not the same sheet with the shrink ladder quietly eating the
// difference (QA_REPORT F10b) — and it never crosses the air the moon arc
// (bottom edge 0.085h + 52 + stroke ~= 122) and the prompt band (top
// 0.88h = 704) need, nor the plate's side margins.
const CARD_BASE_W = PLATE.w * 0.56;   // 716.8 at textScale 1 — the F8 geometry
const CARD_BASE_H = PLATE.h * 0.40;   // 320, centred on the plate
const CARD_LIMITS = { x0: 96, y0: 132, x1: PLATE.w - 96, y1: 688 };
const CARD_PAD_X = 56;         // inner side margins: ink never nears the deckle
const CARD_PAD_TOP = 24;
const CARD_PAD_BOTTOM = 20;
const CARD_SHRINK = [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6, 0.54];

// ART_DIRECTION §9, transcribed: card body 22 px with a floor of 13 px it
// "must never cross"; the first line 30 px (§9 sets it no floor — 14 stays
// as the ladder's last resort); leading 1.5; measure <= 62 characters.
// §9's sizes are "before the text-size multiplier", so both classes take
// the multiplier here.
const CARD_BODY = 22, CARD_BODY_FLOOR = 13;
const CARD_TITLE = 30, CARD_TITLE_FLOOR = 14;
const CARD_LEADING = 1.5;
const CARD_MEASURE = 62;
// The measure turned into pixels is measured, not assumed: 62 characters of
// the game's own prose in the line's own face and size. Caslon sets wider
// than the Georgia stack the layout was tuned against, so any carried-over
// constant would wrap at the wrong place (TASK F10). Exactly CARD_MEASURE
// characters by construction.
const MEASURE_SAMPLE = ('for many months i have lived against your wall and i have learned '
  + 'your speech by listening at the chink').slice(0, CARD_MEASURE);

function cardPaper(scale) {
  const w = Math.min(CARD_BASE_W * scale, CARD_LIMITS.x1 - CARD_LIMITS.x0);
  const h = Math.min(CARD_BASE_H * scale, CARD_LIMITS.y1 - CARD_LIMITS.y0);
  return {
    x0: Math.max(CARD_LIMITS.x0, PLATE.w / 2 - w / 2),
    x1: Math.min(CARD_LIMITS.x1, PLATE.w / 2 + w / 2),
    y0: Math.max(CARD_LIMITS.y0, PLATE.h / 2 - h / 2),
    y1: Math.min(CARD_LIMITS.y1, PLATE.h / 2 + h / 2),
  };
}

// Wrap one logical line to physical lines measuring <= maxWidth AND holding
// <= maxChars characters, word by word (the same measureText walk glossText
// does). §9's two caps both bind: a line breaks at whichever it reaches
// first, so the gate can assert the measure in characters as well as pixels
// and never find a narrow-lettered line sneaking past 62. A single word
// wider than the measure stays whole on its own line — the layout reports
// the overflow rather than breaking the word.
function wrapCardLine(ctx, str, font, maxWidth, maxChars) {
  ctx.font = font;
  const space = ctx.measureText(' ').width;
  const out = [];
  let cur = '', curW = 0;
  for (const w of str.split(' ')) {
    const ww = ctx.measureText(w).width;
    if (cur && (curW + space + ww > maxWidth || cur.length + 1 + w.length > maxChars)) {
      out.push({ str: cur, width: curW });
      cur = w; curW = ww;
    } else {
      cur = cur ? cur + ' ' + w : w;
      curW = curW ? curW + space + ww : ww;
    }
  }
  if (cur) out.push({ str: cur, width: curW });
  return out;
}

// Pure layout for drawCard; measures, never draws. §9's setting: single
// column, left-aligned, ragged right. Every logical line wraps to the
// narrower of the paper's inner width and the 62-character measure in its
// own face, then the ladder steps type down — leading holds at 1.5 at every
// rung — until the block clears the paper's foot and the button zone
// anchored there. Nothing is truncated and nothing leaves the paper; if the
// smallest setting still misfits it is returned as-is and the QA gate fails
// loudly instead of spilling ink onto the night.
export function layoutCard(ctx, lines, opts = {}, buttons = []) {
  const scale = opts.textScale || 1;
  const paper = cardPaper(scale);
  const innerW = (paper.x1 - paper.x0) - CARD_PAD_X * 2;
  const textX = paper.x0 + CARD_PAD_X;
  const textTop0 = paper.y0 + CARD_PAD_TOP;
  // Buttons anchor at the paper's foot (drawCard keeps their geometry); the
  // text block must end above the topmost button's hit zone.
  const textLimit = buttons.length
    ? paper.y1 - 60 - (buttons.length - 1) * 44 - 30
    : paper.y1 - CARD_PAD_BOTTOM;
  // §9's leading, per line size, with one pixel of air as the degenerate
  // floor so a line can never sit on its own ascenders.
  const leadOf = (px) => Math.max(px + 1, Math.round(px * CARD_LEADING));
  let laid = null;
  for (const shrink of CARD_SHRINK) {
    const pxTitle = Math.max(CARD_TITLE_FLOOR, Math.round(CARD_TITLE * scale * shrink));
    const px = Math.max(CARD_BODY_FLOOR, Math.round(CARD_BODY * scale * shrink));
    ctx.font = fontDisp(pxTitle);
    const titleMeasure = ctx.measureText(MEASURE_SAMPLE).width;
    ctx.font = fontBody(px);
    const bodyMeasure = ctx.measureText(MEASURE_SAMPLE).width;
    const phys = [];
    lines.forEach((ln, i) => {
      const disp = i === 0, p = disp ? pxTitle : px;
      const wrapW = Math.min(innerW, disp ? titleMeasure : bodyMeasure);
      for (const w of wrapCardLine(ctx, ln, disp ? fontDisp(p) : fontBody(p), wrapW, CARD_MEASURE)) {
        phys.push({ ...w, px: p, disp, x: textX, src: i });
      }
    });
    let baseline = textTop0 + (phys.length ? phys[0].px : 0);
    for (const l of phys) { l.baseline = baseline; baseline += leadOf(l.px); }
    const textTop = phys.length ? phys[0].baseline - 0.8 * phys[0].px : textTop0;
    const textBottom = phys.length
      ? phys[phys.length - 1].baseline + 0.35 * phys[phys.length - 1].px : textTop0;
    laid = {
      lines: phys, shrink, px, pxTitle, leading: leadOf(px), innerW, textX, align: 'left',
      measureChars: CARD_MEASURE,
      paperX0: paper.x0, paperY0: paper.y0, paperX1: paper.x1, paperY1: paper.y1,
      paperTop: paper.y0, paperBottom: paper.y1, padX: CARD_PAD_X,
      textTop, textBottom, textLimit,
      totalH: textBottom - textTop, availH: textLimit - textTop0,
    };
    if (textBottom <= textLimit) return laid;
  }
  return laid;
}

// Hit boxes for a card's logical text lines, in drawCard's own geometry:
// how a card's rows (the options plate) become mouse targets without
// leaving the card idiom. Each box spans the paper's inner width and
// reaches halfway to its neighbours, so a click anywhere on the row lands.
// A logical line that wrapped to nothing (the empty string) yields null.
export function cardLineHits(ctx, lines, opts = {}) {
  const laid = layoutCard(ctx, lines, opts, []);
  const groups = [];
  for (const ln of laid.lines) {
    const g = groups[ln.src] || (groups[ln.src] = { first: ln, last: ln });
    g.last = ln;
  }
  return lines.map((_, i) => {
    const g = groups[i];
    if (!g) return null;
    const prev = groups[i - 1], next = groups[i + 1];
    const y0 = prev ? (prev.last.baseline + g.first.baseline) / 2
                    : g.first.baseline - 0.8 * g.first.px - 6;
    const y1 = next ? (g.last.baseline + next.first.baseline) / 2
                    : g.last.baseline + 0.35 * g.last.px + 6;
    return { x: laid.paperX0 + 24, y: y0, w: (laid.paperX1 - 24) - (laid.paperX0 + 24), h: y1 - y0 };
  });
}

export function drawCard(ctx, lines, opts, buttons = []) {const laid = layoutCard(ctx, lines, opts, buttons);
  rect(ctx, 0, 0, PLATE.w, PLATE.h, PAL.nightDeep);
  rect(ctx, laid.paperX0, laid.paperY0, laid.paperX1, laid.paperY1, PAL.paper, PAL.ink);
  for (const ln of laid.lines) {
    text(ctx, ln.str, ln.x, ln.baseline, ln.px, PAL.ink, 'left',
      ln.disp ? fontDisp(ln.px) : null);
  }
  // The foot verbs are §8.4 letterpress buttons, not card text: they stay
  // centred on the paper like the title plate's verbs, hit boxes unchanged.
  const bs = [];
  buttons.forEach((b, i) => {
    const by = laid.paperY1 - 60 - (buttons.length - 1 - i) * 44;
    text(ctx, b.label, PLATE.w / 2, by, Math.round(19 * (opts.textScale || 1)), b.focus ? PAL.ink : PAL.ink2, 'center');
    if (b.focus) {
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
      const w = ctx.measureText(b.label).width;
      ctx.beginPath(); ctx.moveTo(PLATE.w / 2 - w / 2, by + 6); ctx.lineTo(PLATE.w / 2 + w / 2, by + 6); ctx.stroke();
    }
    bs.push({ id: b.id, x: PLATE.w / 2 - 140, y: by - 24, w: 280, h: 34 });
  });
  return bs;
}

export function drawTitle(ctx, state, opts, beat, buttons) {
  // plate/title through the skin layer; greybox with the key name until it loads.
  if (!skin.drawPlate(ctx, 'plate/paper', 0, 0, PLATE.w, PLATE.h)) {
    rect(ctx, 0, 0, PLATE.w, PLATE.h, PAL.paper);
  }
  // The plate stops at 0.72h so the title block below it clears the platemark.
  // At PLATE.h-180 the 30 px title sat on the border line and the rule cut the
  // letterforms — §3.3 puts occlusion tolerance at zero.
  const tx = 80, ty = 60, tw = PLATE.w - 160, th = PLATE.h * 0.72 - 60;
  if (skin.drawPlate(ctx, 'plate/title', tx, ty, tw, th)) {
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
    ctx.strokeRect(tx, ty, tw, th);
  } else {
    rect(ctx, tx, ty, PLATE.w - 80, PLATE.h * 0.72, PAL.plate, PAL.ink);
    // The cottage at night with one lit window, in flat shapes.
    rect(ctx, 480, 260, 800, 460, PAL.nightMid, PAL.ink);
    if (beat >= 4) rect(ctx, 600, 320, 640, 360, PAL.amber, PAL.ink);
    rect(ctx, 140, 380, 240, 440, PAL.nightDeep, PAL.ink); // the hovel, bottom-left
    skin.stampKey(ctx, 'plate/title', tx, ty);
  }
  if (beat >= 5) {
    text(ctx, STRINGS.title.book, PLATE.w / 2, PLATE.h * 0.78, 30, PAL.ink, 'center', fontDisp(30));
    text(ctx, STRINGS.title.slice, PLATE.w / 2, PLATE.h * 0.825, 20, PAL.ink2, 'center');
  }
  if (beat >= 6) {
    return buttons.map((b, i) => {
      const by = PLATE.h * 0.87 + i * 0.001 + i * 34;
      text(ctx, b.label, PLATE.w / 2, by, 19, b.focus ? PAL.ink : PAL.ink2, 'center');
      if (b.focus) {
        ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5;
        const w = ctx.measureText(b.label).width;
        ctx.beginPath(); ctx.moveTo(PLATE.w / 2 - w / 2, by + 6); ctx.lineTo(PLATE.w / 2 + w / 2, by + 6); ctx.stroke();
      }
      return { id: b.id, x: PLATE.w / 2 - 160, y: by - 24, w: 320, h: 32 };
    });
  }
  return [];
}

// ---------------------------------------------------------------- the door

export function drawDoorScene(ctx, state, opts, subtitle) {
  // plate/door: the room from the doorway. Figures and the clock draw over it.
  if (!skin.drawPlate(ctx, 'plate/door', 0, 0, PLATE.w, PLATE.h)) {
    rect(ctx, 0, 0, PLATE.w, PLATE.h, '#3a2f22');
    rect(ctx, 300, 100, 980, 700, '#efe6d2', PAL.ink);
    skin.stampKey(ctx, 'plate/door', 300, 100);
  }
  // firelight behind De Lacey
  rect(ctx, 340, 480, 430, 620, PAL.amber, PAL.ink2);
  disc(ctx, 385, 555, 26, '#e8a84c');
  // De Lacey by the fire, head toward the voice.
  disc(ctx, 560, 430, 26, PAL.cottager);
  rect(ctx, 534, 456, 586, 560, PAL.cottager);
  // the guitar set aside
  rect(ctx, 620, 520, 660, 560, '#8a6f4d', PAL.ink);
  // the window onto the lane; a figure appears as the walk ends
  rect(ctx, 780, 240, 920, 400, PAL.snow, PAL.ink);
  if (state.door && state.door.clockTicks < 900) {
    rect(ctx, 830, 300, 856, 380, PAL.ink2);
  }
  // daylight across the floor, lengthening with the clock
  if (state.door) {
    const frac = 1 - state.door.clockTicks / (state.door.slots * 30 * 60 || 1);
    ctx.fillStyle = withAlpha(PAL.snow, 0.35);
    ctx.beginPath();
    ctx.moveTo(300, 700); ctx.lineTo(300 + 300 + frac * 380, 700); ctx.lineTo(300 + 140 + frac * 200, 560); ctx.lineTo(300, 560);
    ctx.closePath(); ctx.fill();
  }
  // the creature's shadow across the floor in front of him
  ctx.fillStyle = withAlpha(PAL.creature, 0.5);
  ctx.beginPath(); ctx.ellipse(420, 660, 120, 22, 0, 0, Math.PI * 2); ctx.fill();
  if (subtitle) {
    rect(ctx, PLATE.w * 0.12, PLATE.h * 0.74, PLATE.w * 0.88, PLATE.h * 0.94, withAlpha(PAL.paper, 0.92));
    subtitle.forEach((ln, i) => {
      const px = Math.round(18 * (opts.textScale || 1));
      text(ctx, ln, PLATE.w / 2, PLATE.h * 0.74 + 42 + i * (px + 14), px, PAL.ink, 'center');
    });
  }
}

export function drawViewportFallback(ctx) {
  rect(ctx, 0, 0, PLATE.w, PLATE.h, PAL.nightDeep);
  rect(ctx, PLATE.w * 0.22, PLATE.h * 0.30, PLATE.w * 0.78, PLATE.h * 0.70, PAL.paper, PAL.ink);
  text(ctx, STRINGS.viewport.line, PLATE.w / 2, PLATE.h * 0.46, 26, PAL.ink, 'center', fontDisp(26));
  text(ctx, STRINGS.viewport.size, PLATE.w / 2, PLATE.h * 0.54, 18, PAL.ink2, 'center');
}
