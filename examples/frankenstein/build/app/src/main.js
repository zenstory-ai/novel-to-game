// Boot, input, the fixed-timestep loop, and the scene manager.
// Engine phases (night / walk / door) are simulated by the engine at a fixed
// 60 Hz tick; scene-paced phases (title, cold open, dawn read, seen,
// aftermath, epilogue, after-run) are driven here from the same tick.

import { createRun } from './engine/state.js';
import * as engine from './engine/sim.js';
import {
  MINUTE_TICKS, FAST_MINUTE_TICKS, PLATE, HOVEL_MOUTH, DOOR,
  OUTHOUSE, WELL, MILK_HOUSE, WOOD_EDGE, DOOR_APRON,
  THAW_NIGHT, STY_GROUND,
} from './engine/constants.js';
import { STRINGS, glossWords } from './strings.js';
import * as R from './render.js';
import * as skin from './skin.js';
import * as audio from './audio.js';

const params = new URLSearchParams(location.search);
const seed = params.get('seed') || 'hovel-01';
const fast = params.get('fast') === '1';

const canvas = document.getElementById('plate');
const ctx = canvas.getContext('2d');

// ---------------------------------------------------------------- options

const OPTIONS_KEY = 'hovel.options';
const options = Object.assign(
  { textScale: 1, inkHeavy: false, sound: true, murmur: true, reducedMotion: false },
  JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}'));
function saveOptions() { localStorage.setItem(OPTIONS_KEY, JSON.stringify(options)); }

// ---------------------------------------------------------------- run state

let state = createRun(seed);
state.minuteTicks = fast ? FAST_MINUTE_TICKS : MINUTE_TICKS;
state.phase = 'title';

// Scene bookkeeping (not simulation state).
const scene = {
  buttons: [],
  focus: 0,
  coldTime: 0,
  coldGlow: 0.3,       // the hold made visible: 1 while held, 0.3 let go
  coldHeld: false,
  minted: [],          // minted-word animations { word, t }
  speech: null,        // current overheard utterance { speaker, text, t }
  titleBeat: 0,
  epilogueStep: 0,
  holdTicks: 0,
  queuedAction: null,  // mouse: walk to an actionable and act on arrival
  optionRows: [],      // the options plate's row hit boxes (cardLineHits)
  hx: -1, hy: -1,      // last-seen mouse position: hover applies on movement
  listenedUtterance: 0,
  moonGone: 0,
  guitarCold: false,   // the cold-open guitar (GAME_DESIGN §10, 0:06), once
};
function resetScene() {
  scene.buttons = []; scene.focus = 0; scene.coldTime = 0; scene.minted = [];
  scene.speech = null; scene.titleBeat = 0; scene.epilogueStep = 0;
  scene.holdTicks = 0; scene.queuedAction = null; scene.listenedUtterance = 0;
  scene.moonGone = 0; scene.guitarCold = false;
  scene.coldGlow = 0.3; scene.optionRows = []; scene.hx = scene.hy = -1;
}

// Run-scoped, not scene-scoped: Agatha's latch sounds once per run (the
// engine's own never-set flag is state.firstCarryLatchSeen), and resetScene
// runs at every dawn advance, which must not re-arm it. restart() re-arms.
let latchPlayed = false;
// The guitar's nightly arming is run-scoped the same way: the hour is seeded
// (§13.2), the phrase never varies, and each night it sounds once.
let guitarNight = 0;
let guitarDone = false;
// Footfall pacing: steps are distance, not ticks (§13.3 "Continuous, low").
let stepAcc = 0;
const lastPos = { x: null, y: null };

function restart() {
  state = createRun(seed);
  state.minuteTicks = fast ? FAST_MINUTE_TICKS : MINUTE_TICKS;
  state.phase = 'title';
  latchPlayed = false;
  guitarNight = 0; guitarDone = false;
  stepAcc = 0; lastPos.x = null; lastPos.y = null;
  resetScene();
}

// ---------------------------------------------------------------- input

const keys = new Set();
const edges = { action: false, drop: false, exit: false, journal: false, advance: false };
let mouse = { x: 0, y: 0, down: false, clicked: false };

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (PLATE.w / r.width),
    y: (e.clientY - r.top) * (PLATE.h / r.height),
  };
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  audio.resume(); // the autoplay gate lifts on the first real gesture
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'e' || k === ' ') { edges.action = true; e.preventDefault(); }
  if (k === 'q') edges.drop = true;
  if (k === 'x') edges.exit = true;
  if (k === 'j') edges.journal = true;
  if (k === 'enter') edges.advance = true;
  if (k === 'arrowup' || k === 'w') scene.focus--;
  if (k === 'arrowdown' || k === 's') scene.focus++;
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => { const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y; });
canvas.addEventListener('mousedown', (e) => { audio.resume(); const p = canvasPos(e); mouse = { x: p.x, y: p.y, down: true, clicked: true }; });
window.addEventListener('mouseup', () => { mouse.down = false; });

function inputVector() {
  let kx = 0, ky = 0;
  if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
  if (keys.has('arrowright') || keys.has('d')) kx += 1;
  if (keys.has('arrowup') || keys.has('w')) ky -= 1;
  if (keys.has('arrowdown') || keys.has('s')) ky += 1;
  return { kx, ky };
}

function consumeEdges() {
  // Read mouse.clicked BEFORE clearing it: one mousedown produces exactly one
  // edge, consumed by exactly one tick even when a frame runs several ticks.
  const e = { ...edges, clicked: mouse.clicked };
  edges.action = edges.drop = edges.exit = edges.journal = edges.advance = false;
  mouse.clicked = false;
  return e;
}

// ---------------------------------------------------------------- prompts

const P = STRINGS.prompts;

function yardPrompt() {
  const a = engine.availableAction(state);
  switch (a) {
    case 'putDown': return P.putDown;
    case 'takeLoad': return P.takeLoad;
    case 'water': return P.water;
    case 'path': return P.path;
    case 'take': return P.take;
    case 'forage': return P.forage;
    case 'search': return P.search;
    case 'goIn': return P.goIn;
    default: return state.creature.carrying ? P.letLie : null;
  }
}
function hovelPrompt() {
  const a = engine.availableAction(state);
  if (a === 'lesson') return P.lesson;
  if (a === 'stopListen') return P.stopListen;
  if (state.tonight && state.tonight.listening) return P.stopListen;
  return `${P.listen} · ${P.liftPlank}`;
}

// ---------------------------------------------------------------- scenes

function setButtons(labels) {
  scene.buttons = labels.map((label, i) => ({ id: label, label, focus: i === ((scene.focus % labels.length) + labels.length) % labels.length }));
}
function activateButton(id) {
  if (state.phase === 'title') {
    if (id === STRINGS.title.verbs[0]) { state.phase = 'coldOpen'; state.phaseTick = 0; }
    else if (id === STRINGS.title.verbs[1]) { state.phase = 'options'; state.phaseTick = 0; scene.focus = 0; }
    else if (id === STRINGS.title.verbs[2]) { state.phase = 'about'; state.phaseTick = 0; }
  } else if (state.phase === 'options') {
    state.phase = 'title'; state.phaseTick = 0; scene.focus = 0;
  } else if (state.phase === 'about') {
    state.phase = 'title'; state.phaseTick = 0; scene.focus = 0;
  } else if (state.phase === 'afterRun') {
    restart();
  }
}

function clickButtons(e) {
  for (const b of scene._hit || []) {
    if (e.x >= b.x && e.x <= b.x + b.w && e.y >= b.y && e.y <= b.y + b.h) {
      activateButton(b.id);
      return true;
    }
  }
  return false;
}

// What the mouse click means in the yard (GAME_DESIGN §5: mouse-primary, one
// context action). A click that lands on a hotspot walks the creature there
// and acts on arrival; any other click is a plain walk. Radii mirror the
// engine's interaction reaches (sim.js nearestActionable) so the arrival
// queue fires inside the reach the engine will honour; the engine still
// adjudicates the action itself when the injected edge lands.
const YARD_HOTSPOTS = [
  { p: DOOR, r: 34 },        // the pile: put the load down
  { p: OUTHOUSE, r: 40 },    // take the load up
  { p: WELL, r: 30 },        // draw water
  { p: DOOR_APRON, r: 30 },  // clear the path
  { p: MILK_HOUSE, r: 30 },  // take
  { p: WOOD_EDGE, r: 44 },   // forage / search
  { p: HOVEL_MOUTH, r: 24 }, // slip back inside
];

function yardClick(x, y) {
  for (const h of YARD_HOTSPOTS) {
    if (Math.hypot(x - h.p.x, y - h.p.y) <= h.r) {
      scene.queuedAction = { x: h.p.x, y: h.p.y, r: h.r };
      return { x: h.p.x, y: h.p.y }; // snap the walk target to the hotspot
    }
  }
  scene.queuedAction = null;
  return { x, y };
}

// The queued context action: after a click on a hotspot, act when the
// creature arrives inside its reach. Keyboard movement or a fresh click
// elsewhere cancels the queue.
function maybeQueuedAction(input) {
  const q = scene.queuedAction;
  if (!q) return input;
  if (input.kx || input.ky) { scene.queuedAction = null; return input; }
  if (Math.hypot(state.creature.x - q.x, state.creature.y - q.y) <= q.r - 2) {
    scene.queuedAction = null;
    return { ...input, action: true };
  }
  // Cancel a queue the walk can no longer serve — but not on the tick that
  // created it. `state.target` is assigned inside engine.tick, which runs after
  // this function, so on the click's own tick the creature has not started
  // moving and state.target is still null: without `input.target` here the
  // guard cancelled every queue the instant it was made, and a hotspot click
  // walked the creature over and then just stood there. `input.target` is the
  // snapped hotspot point on that tick and null afterwards, which is exactly
  // the one tick that needs excluding.
  if (!state.creature.moving && !state.target && !input.target) scene.queuedAction = null;
  return input;
}

// ---------------------------------------------------------------- per-phase

// The title reveal: six beats at a brisk pace. The old 45-tick beat put the
// first verb 4.5 s out and gave clicks nothing to land on — it read as a
// stall. Now the verbs are up in ~1.6 s, a click completes the reveal at
// once, and Enter or Space activates the focused verb immediately.
const TITLE_BEAT_TICKS = 16;
const TITLE_REVEALED = 6 * TITLE_BEAT_TICKS; // phaseTick at full reveal

function tickTitle(input) {
  scene.titleBeat = Math.min(6, Math.floor(state.phaseTick / TITLE_BEAT_TICKS));
  setButtons(STRINGS.title.verbs);
  // Hover moves the focus underline — but only on real mouse movement, so a
  // parked mouse never fights the keyboard's arrows.
  const moved = input.x !== scene.hx || input.y !== scene.hy;
  scene.hx = input.x; scene.hy = input.y;
  if (moved) {
    for (let i = 0; i < (scene._hit || []).length; i++) {
      const b = scene._hit[i];
      if (input.x >= b.x && input.x <= b.x + b.w && input.y >= b.y && input.y <= b.y + b.h) scene.focus = i;
    }
  }
  if (input.advance || input.action) {
    activateButton(scene.buttons[((scene.focus % 3) + 3) % 3].id);
    return;
  }
  if (input.clicked) {
    if (scene.titleBeat >= 6) clickButtons(input);
    else { state.phaseTick = TITLE_REVEALED; scene.titleBeat = 6; }
  }
}

function tickOptions(input) {
  // Rows are hover/click targets (cardLineHits over the card's own layout);
  // the keyboard drives the same rows by focus. Enter or Space applies the
  // focused row, a click applies the row it lands on — and the last row is a
  // mouse-reachable way back, which the plate never had.
  const rows = ['textScale', 'ink', 'sound', 'murmur', 'motion', 'back'];
  const moved = input.x !== scene.hx || input.y !== scene.hy;
  scene.hx = input.x; scene.hy = input.y;
  let target = -1;
  scene.optionRows.forEach((b, i) => {
    if (!b) return;
    const inside = input.x >= b.x && input.x <= b.x + b.w && input.y >= b.y && input.y <= b.y + b.h;
    if (inside && moved) scene.focus = i;
    if (inside && input.clicked) target = i;
  });
  if (input.advance || input.action) target = ((scene.focus % rows.length) + rows.length) % rows.length;
  if (target === 0) { options.textScale = options.textScale >= 1.5 ? 1 : options.textScale + 0.25; saveOptions(); }
  else if (target === 1) { options.inkHeavy = !options.inkHeavy; saveOptions(); }
  else if (target === 2) { options.sound = !options.sound; audio.setSound(options.sound); saveOptions(); }
  else if (target === 3) { options.murmur = !options.murmur; saveOptions(); }
  else if (target === 4) { options.reducedMotion = !options.reducedMotion; saveOptions(); }
  else if (target === 5) {
    state.phase = 'title'; state.phaseTick = TITLE_REVEALED; scene.focus = 0;
    scene._hit = []; scene.optionRows = [];
  }
}

function tickColdOpen(input) {
  const held = keys.has('e') || keys.has(' ') || keys.has('enter') || mouse.down;
  if (held) scene.coldTime += 1 / 60;
  // The hold is the light: the chink brightens under a held hand and dims
  // the moment it lets go — the scene answers the player from second 0.
  scene.coldGlow += ((held ? 1 : 0.3) - scene.coldGlow) * 0.06;
  // 0:00 aperture · 0:06 the guitar · 0:14 Felix with the load · 0:18 the taper
  // goes out and the view pulls back · 0:22 the plank lifts · then the yard.
  if (scene.coldTime >= 23) {
    engine.startNight(state);
  }
}

function tickNight(input) {
  const v = inputVector();
  const e = {
    kx: v.kx, ky: v.ky,
    target: input.clicked && !state.creature.inHovel ? yardClick(input.x, input.y) : null,
    action: input.action,
    drop: input.drop,
    exit: input.exit || (input.clicked && state.creature.inHovel && input.x > 860 && input.y > 440),
    journal: input.journal,
  };
  if (input.clicked && state.creature.inHovel && !(input.x > 860 && input.y > 440)) e.action = true;
  engine.tick(state, maybeQueuedAction(e));
  drainEvents();
}

function tickDawnRead(input) {
  engine.tick(state, {});
  if (input.action || input.advance || input.clicked) {
    engine.advanceFromDawn(state);
    resetScene();
  }
}

function tickWalk(input) {
  const v = inputVector();
  let target = null;
  if (input.clicked) {
    // The door is the walk's one hotspot: a click on it walks over and knocks.
    if (Math.hypot(input.x - DOOR.x, input.y - DOOR.y) <= 40) {
      scene.queuedAction = { x: DOOR.x, y: DOOR.y, r: 40 };
      target = { x: DOOR.x, y: DOOR.y };
    } else {
      scene.queuedAction = null;
      target = { x: input.x, y: input.y };
    }
  }
  engine.tick(state, maybeQueuedAction({
    kx: v.kx, ky: v.ky,
    target,
    action: input.action,
  }));
}

function tickDoor(input) {
  engine.tick(state, { action: input.action || input.clicked });
  drainEvents();
}

function tickSeen(input) {
  engine.tick(state, {});
  // 2 s hold with no interface, then the card; any key moves to the epilogue.
  if (state.phaseTick > 120 && scene.epilogueStep === 0) scene.epilogueStep = 1;
  if (scene.epilogueStep === 1 && (input.action || input.advance || input.clicked)) {
    state.phase = 'epilogue';
    state.phaseTick = 0;
    scene.epilogueStep = 0;
  }
}

function tickAftermath(input) {
  engine.tick(state, {});
  // Felix, the stick, then the withheld hand: hold the context action.
  const held = keys.has('e') || keys.has(' ') || mouse.down;
  if (held) scene.holdTicks++;
  if (scene.holdTicks >= 42 || state.phaseTick > 60 * 12) { // 700 ms, or it passes
    state.phase = 'epilogue';
    state.phaseTick = 0;
    scene.epilogueStep = 0;
    scene.holdTicks = 0;
  }
}

function tickEpilogue(input) {
  engine.tick(state, {});
  const step = scene.epilogueStep;
  const adv = input.action || input.advance || input.clicked;
  const steps = epilogueSteps();
  if (step < steps.length) {
    const s = steps[step];
    if (s.hold) {
      const held = keys.has('e') || keys.has(' ') || mouse.down;
      if (held) scene.holdTicks++;
      scene.moonGone = Math.min(1, scene.holdTicks / (s.hold * 60));
      if (scene.moonGone >= 1) { scene.epilogueStep++; scene.holdTicks = 0; }
    } else if (adv || state.phaseTick > s.minTicks) {
      scene.epilogueStep++;
      state.phaseTick = 0;
    }
  } else {
    state.phase = 'afterRun';
    state.phaseTick = 0;
  }
}

function epilogueSteps() {
  const m = engine.epilogueModel(state);
  if (m.ending === 'want') {
    return [
      { kind: 'gone', minTicks: 60 * 6 },
      { kind: 'dark', minTicks: 60 * 4 },
      { kind: 'moonset', hold: 5 },
      { kind: 'fire', minTicks: 60 * 3 },
      { kind: 'closing', minTicks: 60 * 8 },
    ];
  }
  return [
    { kind: 'lane', minTicks: 60 * 8 },
    { kind: 'dark', minTicks: 60 * 4 },
    { kind: 'moonset', hold: 5 },
    { kind: 'fire', minTicks: 60 * 3 },
    { kind: 'closing', minTicks: 60 * 8 },
  ];
}

function tickAfterRun(input) {
  setButtons([STRINGS.cards.restart]);
  if (input.advance || input.action) activateButton(STRINGS.cards.restart);
  if (input.clicked) clickButtons(input);
}

function drainEvents() {
  for (const ev of state.events.splice(0)) {
    if (ev.type === 'word') {
      const w = STRINGS.vocab[Math.min(ev.words - 1, STRINGS.vocab.length - 1)];
      scene.minted.push({ word: w, t: 0 });
      scene.speech = null;
    } else if (ev.type === 'listenStart') {
      const u = STRINGS.overheard.listening[state.listensCompleted % STRINGS.overheard.listening.length];
      scene.speech = { ...u, t: 0 };
    } else if (ev.type === 'portmanteau') {
      scene.speech = { speaker: null, text: STRINGS.moments.portmanteau, t: 0, narration: true };
    } else if (ev.type === 'journal') {
      scene.speech = { speaker: null, text: STRINGS.moments.journalRead, t: 0, narration: true };
    } else if (ev.type === 'putDown') {
      // Wood settling on wood (§13.3) — the game's reward sound.
      audio.play('load-down');
    } else if (ev.type === 'taper') {
      // The warning sound (§13.3): a taper lit ahead of Felix waking.
      audio.play('taper-strike');
    } else if (ev.type === 'dawn') {
      // First light, and only first light: the bird is the sound of the
      // deadline (§13.2), so it is scheduled here and nowhere else.
      audio.play('dawn-bird');
      // Agatha's hand on the latch (ART_DIRECTION §13.3, GAME_DESIGN §10 beat
      // 1): the first dawn after a load has been put at their door, once per
      // run. The engine declares state.firstCarryLatchSeen for exactly this
      // beat but never sets it (no latch event exists — written up in
      // build/COMPLETION.md), so the moment is derived here from the dawn
      // event and carriesTotal. The engine is not told the audio exists.
      if (state.carriesTotal >= 1 && !latchPlayed) {
        latchPlayed = true;
        audio.play('latch');
      }
    }
  }
}

// ---------------------------------------------------------------- audio sync
//
// The state-class sounds (ART_DIRECTION §13.2): beds that follow state rather
// than events, paced once per frame from the state itself. The hearth mirrors
// render.js's fire read exactly (Firing 0 -> silence, 1 -> small, >= 2 ->
// built high), so the second, non-visual channel for the fire peaks at the
// same read the visual does and the two never disagree.

function surfaceKey() {
  const c = state.creature;
  // Straw is the sty's floor; earth is the thaw; grit is the path the creature
  // cleared himself, and only where he cleared it; everything else is snow.
  if (c.x > STY_GROUND.x0 && c.x < STY_GROUND.x1 && c.y > STY_GROUND.y0 && c.y < STY_GROUND.y1) {
    return 'footfall/straw';
  }
  if (state.night >= THAW_NIGHT) return 'footfall/earth';
  if (state.tonight && state.tonight.pathCleared &&
      Math.hypot(c.x - DOOR_APRON.x, c.y - DOOR_APRON.y) <= 96) return 'footfall/path';
  return 'footfall/snow';
}

function syncAudio() {
  const inHovelView = (state.phase === 'night' && state.creature.inHovel) ||
    state.phase === 'dawnRead' || state.phase === 'coldOpen';
  const fire = state.firing >= 2 ? 2 : state.firing > 0 ? 1 : 0;
  audio.setBed('hearth/small', 'hovel', inHovelView && fire === 1 ? 1 : 0);
  audio.setBed('hearth/high', 'hovel', inHovelView && fire === 2 ? 1 : 0);
  const night = state.phase === 'night';
  // The yard layer rises across the last two night-minutes (§13.2): dawn is
  // heard before it is seen.
  const layer2 = night ? Math.max(0, Math.min(1, (2 - state.nightMinutesLeft) / 2)) : 0;
  audio.setBed('wind', state.creature.inHovel ? 'hovel' : 'yard', night ? 1 : 0, { layer2 });

  // De Lacey at his own hours (§13.3): one seeded minute each night, the same
  // phrase — and the cold open's 0:06 beat (GAME_DESIGN §10).
  if (night) {
    if (guitarNight !== state.night) { guitarNight = state.night; guitarDone = false; }
    if (!guitarDone && state.minute >= audio.guitarHour()) {
      guitarDone = true;
      audio.play('guitar');
    }
  }
  if (state.phase === 'coldOpen' && !scene.guitarCold && scene.coldTime >= 6) {
    scene.guitarCold = true;
    audio.play('guitar');
  }

  // Footfalls: one scuff per step walked, on the surface under him.
  if (night && !state.creature.inHovel && state.creature.moving) {
    if (lastPos.x !== null) {
      stepAcc += Math.hypot(state.creature.x - lastPos.x, state.creature.y - lastPos.y);
    }
    if (stepAcc >= 26) {
      stepAcc = 0;
      audio.play(surfaceKey());
    }
  } else {
    stepAcc = 0;
  }
  lastPos.x = state.creature.x;
  lastPos.y = state.creature.y;
}

// ---------------------------------------------------------------- render

function render() {
  ctx.clearRect(0, 0, PLATE.w, PLATE.h);
  const opts = { textScale: options.textScale, inkHeavy: options.inkHeavy };
  switch (state.phase) {
    case 'title': {
      const btns = scene.buttons.map((b, i) => ({ ...b, focus: i === ((scene.focus % 3) + 3) % 3 }));
      scene._hit = R.drawTitle(ctx, state, opts, scene.titleBeat, btns);
      break;
    }
    case 'options': renderOptions(opts); break;
    case 'about': renderAbout(opts); break;
    case 'coldOpen': renderColdOpen(opts); break;
    case 'night': renderNight(opts); break;
    case 'dawnRead': renderDawn(opts); break;
    case 'walk': renderWalk(opts); break;
    case 'door': renderDoor(opts); break;
    case 'seen': renderSeen(opts); break;
    case 'aftermath': renderAftermath(opts); break;
    case 'epilogue': renderEpilogue(opts); break;
    case 'afterRun': renderAfterRun(opts); break;
  }
  // Transient minted words, in their lane.
  for (const m of scene.minted) {
    m.t += 1 / 60;
    const y = 480 - m.t * 60;
    if (m.t < 1.6) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, 2 - m.t);
      ctx.fillStyle = R.withAlpha(R.PAL.nightDeep, 0.4);
      ctx.beginPath(); ctx.ellipse(735, y - 6, 46, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = R.PAL.ink; ctx.lineWidth = 2;
      ctx.fillStyle = R.PAL.paper;
      ctx.font = R.fontBody(18);
      ctx.textAlign = 'center';
      ctx.strokeText(m.word, 735, y);
      ctx.fillText(m.word, 735, y);
      ctx.restore();
    }
  }
  scene.minted = scene.minted.filter(m => m.t < 1.6);
  if (scene.speech) {
    scene.speech.t += 1 / 60;
    if (scene.speech.t > 4) scene.speech = null;
  }
}

function renderOptions(opts) {
  const O = STRINGS.options;
  const rows = [
    `${O.textSize}: ${O.textSizeValues[options.textScale === 1 ? 0 : options.textScale === 1.25 ? 1 : 2]}`,
    `${O.ink}: ${O.inkValues[options.inkHeavy ? 1 : 0]}`,
    `${O.sound}: ${O.onOff[options.sound ? 1 : 0]}`,
    `${O.murmur}: ${O.onOff[options.murmur ? 1 : 0]}`,
    `${O.motion}: ${O.onOff[options.reducedMotion ? 1 : 0]}`,
    O.back,
  ];
  const f = ((scene.focus % rows.length) + rows.length) % rows.length;
  const lines = [O.title, ...rows.map((r, i) => (i === f ? `— ${r} —` : r))];
  R.drawCard(ctx, lines, opts, []);
  // The rows' mouse targets, measured off the same layout the card drew.
  scene.optionRows = R.cardLineHits(ctx, lines, opts).slice(1);
}

function renderAbout(opts) {
  scene._hit = R.drawCard(ctx, STRINGS.about, opts, [{ id: 'back', label: STRINGS.about[2], focus: true }]);
}

function renderColdOpen(opts) {
  // The held chink and its beats (GAME_DESIGN §10, 0:00-0:22) live in the
  // render layer off scene.coldTime, so the hold always moves the picture.
  R.drawColdOpen(ctx, state, scene.coldTime, scene.coldGlow, opts);
  R.drawPrompt(ctx, scene.coldTime >= 22 ? P.liftPlank : P.keepWatching, opts);
}

function renderNight(opts) {
  if (state.creature.inHovel) {
    R.drawHovel(ctx, state, 'dusk', opts);
    if (scene.speech) {
      const known = glossWords(state);
      R.glossText(ctx, scene.speech.text, scene.speech.narration ? scene.speech.text.split(' ') : known,
        375, 540, Math.round(18 * (opts.textScale || 1)), R.PAL.paper);
    }
    R.drawPrompt(ctx, hovelPrompt(), opts);
  } else {
    R.drawHolding(ctx, state);
    R.drawCottagers(ctx, state);
    R.drawCreature(ctx, state);
    R.drawMoonArc(ctx, state);
    R.drawPrompt(ctx, yardPrompt(), opts);
  }
}

function renderDawn(opts) {
  R.drawHovel(ctx, state, 'dawn', opts);
  R.drawPrompt(ctx, P.letDayPass, opts);
}

function renderWalk(opts) {
  R.drawHolding(ctx, state, { daylight: true });
  // The three go out at the gate during the first two seconds.
  if (state.walkScene && state.walkScene.stage === 'exit') {
    const t = state.walkScene.stageTick / 120;
    const gx = 640, gy = 545 - t * 60;
    R.drawCreature(ctx, state);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#6a5a48';
      ctx.beginPath(); ctx.arc(gx - 12 + i * 12, gy - i * 8, 7, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    R.drawCreature(ctx, state);
    const near = Math.hypot(state.creature.x - DOOR.x, state.creature.y - DOOR.y) <= 40;
    R.drawPrompt(ctx, near ? P.knock : null, opts);
  }
}

function renderDoor(opts) {
  const d = state.door;
  let subtitle = null;
  if (d) {
    if (d.index === 0 && !d.spoken0) {
      subtitle = [state.walkSlipped ? STRINGS.door.answerWary : STRINGS.door.answer];
      if (!engine.doorCanSpeak(state) && d.exchangeTicks <= 0) {
        subtitle.push(STRINGS.door.sitSilence);
      }
    } else {
      const ex = STRINGS.door.exchanges[d.index];
      if (ex) subtitle = [ex.me, ex.him].filter(Boolean);
    }
    if (d.index >= 5) subtitle = [STRINGS.door.closingTrue];
  }
  R.drawDoorScene(ctx, state, opts, subtitle);
  if (d && engine.doorCanSpeak(state) && d.exchangeTicks <= 0) R.drawPrompt(ctx, P.answer, opts);
  if (d && d.index === 0 && !engine.doorCanSpeak(state)) R.drawPrompt(ctx, null, opts);
}

function renderSeen(opts) {
  // The world frozen; the whitened wedge; then the card.
  R.drawHolding(ctx, state);
  const cones = engine.activeCones(state);
  for (const cone of cones) {
    const wide = cone.wide || cone.dawnDoor;
    R.wedge(ctx, cone.x, cone.y, cone.angle, wide ? 0.96 : 0.56, wide ? 260 : 150, R.withAlpha(R.PAL.paper, 0.85));
  }
  // His shadow across the person who saw him.
  const seer = cones.find(c => c.owner === state.seenBy);
  if (seer) {
    ctx.fillStyle = R.withAlpha(R.PAL.creature, 0.55);
    ctx.beginPath();
    ctx.ellipse(seer.x, seer.y + 14, 40, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  R.drawCreature(ctx, state);
  if (scene.epilogueStep >= 1) {
    const lines = state.seenContext === 'firstlight'
      ? [STRINGS.failure.header, STRINGS.failure.seenFirstLight]
      : state.seenBy === 'agatha'
        ? [STRINGS.failure.header, STRINGS.failure.seenAgatha]
        : [STRINGS.failure.header, STRINGS.failure.seenFelix];
    scene._hit = R.drawCard(ctx, lines, opts, []);
  }
}

function renderAftermath(opts) {
  R.drawDoorScene(ctx, state, opts, null);
  // The withheld hand: a hand opens, rises, holds, lowers.
  const t = Math.min(1, scene.holdTicks / 42);
  ctx.strokeStyle = R.PAL.ink; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(420, 640);
  ctx.lineTo(470 + t * 30, 580 - t * 60);
  ctx.stroke();
  R.drawPrompt(ctx, P.stayHand, opts);
}

function renderEpilogue(opts) {
  const m = engine.epilogueModel(state);
  const steps = epilogueSteps();
  const s = steps[Math.min(scene.epilogueStep, steps.length - 1)];
  switch (s.kind) {
    case 'gone':
      scene._hit = R.drawCard(ctx, [STRINGS.epilogue.gone.line1, STRINGS.epilogue.gone.line2], opts, []);
      break;
    case 'lane': {
      const lines = [...STRINGS.epilogue.lane];
      if (m.satUp) lines.push(STRINGS.epilogue.laneSatUp);
      lines.push(m.beds >= 3 ? STRINGS.epilogue.laneAnswerProduce : STRINGS.epilogue.laneAnswer);
      scene._hit = R.drawCard(ctx, lines, opts, []);
      break;
    }
    case 'dark':
      R.drawHovel(ctx, state, 'dawn', opts);
      // The room goes dark, the boards do not: darken through the same ragged
      // mask the room is clipped to (drawHovel's aperture, 160,150,430,330).
      ctx.save();
      R.aperturePath(ctx, 160, 150, 430, 330);
      ctx.clip();
      ctx.fillStyle = R.withAlpha(R.PAL.nightDeep, 0.85);
      ctx.fillRect(160, 150, 430, 330);
      ctx.restore();
      scene._hit = R.drawCard(ctx, [STRINGS.epilogue.darkDay], opts, []);
      break;
    case 'moonset':
      R.drawHolding(ctx, state);
      R.drawCreature(ctx, state);
      // the arc runs down as the player holds
      ctx.strokeStyle = R.PAL.snow; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(PLATE.w * 0.875, PLATE.h * 0.085, 52, Math.PI, Math.PI + Math.PI * (1 - scene.moonGone)); ctx.stroke();
      R.drawPrompt(ctx, P.waitMoon, opts);
      break;
    case 'fire': {
      // The first red in the game.
      ctx.fillStyle = R.PAL.nightDeep;
      ctx.fillRect(0, 0, PLATE.w, PLATE.h);
      const t = Math.min(1, state.phaseTick / 156);
      ctx.fillStyle = R.PAL.red;
      ctx.beginPath();
      ctx.ellipse(PLATE.w / 2, PLATE.h / 2, 60 + t * 500, 40 + t * 340, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'closing': {
      const lines = closingLines(m);
      scene._hit = R.drawCard(ctx, lines, opts, []);
      break;
    }
  }
}

function closingLines(m) {
  const C = STRINGS.epilogue.closing;
  const lines = [];
  if (m.ending === 'want') {
    lines.push(m.nothingPutBy ? C.theft : C.fed);
  } else {
    lines.push(m.exchange5 ? C.labourTrue : C.labourFalse);
  }
  if (m.nothingPutBy && m.ending !== 'want') lines.push(C.theft);
  if (m.fewLessons && m.ending !== 'want') lines.push(C.fewWords);
  lines.push(m.journal ? C.journal : C.noJournal);
  return lines.slice(0, 3);
}

function renderAfterRun(opts) {
  const btns = [{ id: STRINGS.cards.restart, label: STRINGS.cards.restart, focus: true }];
  scene._hit = R.drawCard(ctx, [STRINGS.cards.endOfRun], opts, btns);
}

// ---------------------------------------------------------------- the loop

const TICK = 1 / 60;
let last = performance.now(), acc = 0, interactive = false;

function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= TICK) {
    acc -= TICK;
    const e = consumeEdges();
    const input = {
      ...e, x: mouse.x, y: mouse.y, clicked: e.clicked,
      focusDelta: 0,
    };
    step(input);
    interactive = true;
  }
  render();
  syncAudio();
}

function step(input) {
  switch (state.phase) {
    // engine.tick owns state.phaseTick, and the title reveal is paced off it
    // (titleBeat = phaseTick/45). Without this call the beat stays 0 forever:
    // the title text and the three verbs are never drawn and the first screen
    // is two blank shapes with no way in.
    case 'title': engine.tick(state, {}); tickTitle(input); break;
    case 'options': tickOptions(input); break;
    case 'about': if (input.advance || input.action || input.clicked) { state.phase = 'title'; state.phaseTick = TITLE_REVEALED; } engine.tick(state, {}); break;
    case 'coldOpen': engine.tick(state, {}); tickColdOpen(input); break;
    case 'night': tickNight(input); break;
    case 'dawnRead': tickDawnRead(input); break;
    case 'walk': tickWalk(input); break;
    case 'door': tickDoor(input); break;
    case 'seen': tickSeen(input); break;
    case 'aftermath': tickAftermath(input); break;
    case 'epilogue': tickEpilogue(input); break;
    case 'afterRun': tickAfterRun(input); break;
  }
}

// Viewport fallback: the game does not reflow.
function fitCanvas() {
  const w = window.innerWidth, h = window.innerHeight;
  const scale = Math.min(w / PLATE.w, h / PLATE.h);
  canvas.style.width = `${Math.floor(PLATE.w * scale)}px`;
  canvas.style.height = `${Math.floor(PLATE.h * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Kick off the skin layer. Nothing waits on it: each plate appears the frame after
// it decodes, and any key that never arrives stays a greybox carrying its key name.
skin.load();

// Kick off the audio layer the same way. The context stays suspended until
// the first real input (resume lives in the input handlers), and every cue
// learns where the creature is listening from at schedule time (§13.1) —
// hovel through the wall, yard open. Nothing routes to 'room' yet: the
// slice's door scene plays at the threshold, never inside their room.
audio.load();
audio.setSound(options.sound);
audio.onPosition(() => (state.creature.inHovel ? 'hovel' : 'yard'));
audio.onPhase(() => state.phase);
audio.setSeed(seed);

// The test hook: current state, the tick index, and the active cone set.
// layoutCard is the render layer's pure card measure (QA_REPORT F8): the
// browser harness drives it over every card string and asserts the fit.
window.__game = {
  get state() { return state; },
  get tick() { return state.tick; },
  get phase() { return state.phase; },
  get cones() { return engine.activeCones(state); },
  get interactive() { return interactive; },
  get epilogueStep() { return scene.epilogueStep; },
  get minted() { return scene.minted; },
  get optionRows() { return scene.optionRows; },
  engine,
  restart,
  STRINGS,
  layoutCard: (lines, opts, buttons) => R.layoutCard(ctx, lines, opts, buttons),
  get pendingKeys() { return skin.pending(); },
  get audioPending() { return audio.pending(); },
  get audioGatedPending() { return audio.gatedPending(); },
  get audioStatus() { return audio.status(); },
  get audioBeds() { return audio.beds(); },
  get audioPlayed() { return audio.playedCues(); },
  audioAudition: (key, opts) => audio.audition(key, opts),
};

requestAnimationFrame(frame);
