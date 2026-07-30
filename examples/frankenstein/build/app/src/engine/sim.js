// The simulation. Deterministic: no random draw anywhere in this file.
// Fixed 60 Hz tick; identical tick-indexed input reproduces identical state.
//
// Ordering convention (GAME_DESIGN §6.3): a day runs dawn -> daylight ->
// night. The night that closes day N is night N and ends at dawn N+1; a load
// carried on night N first shows in Felix's day on day N+1.

import {
  MINUTE_TICKS, WALK_SPEED, COTTAGER_SPEED, OBSTACLES, LOS_ONLY, REACH,
  HOVEL_MOUTH, DOOR, STY, POOL, MILK_HOUSE, WELL, OUTHOUSE, WOOD_EDGE,
  GARDEN, DOOR_APRON, COST, HOLD_TICKS, OWN_FOOD_PER_NIGHT, FORAGE_YIELD,
  TAKE_YIELD, MAX_FIRING, STORE_GONE_DAWNS, UNEASE_MAX,
  LISTEN_GAIN, LISTEN_GAIN_AFTER_CAP, LISTEN_SOFT_CAP,
  LESSON_FIRST, LESSON_LATER, LESSON_FIRST_NIGHT, PORTMANTEAU_WORDS,
  JOURNAL_GATE, WALK_NOTICE_WORDS, EXCHANGE_GATES, WALK, CONE, THAW_NIGHT,
  BASE_NIGHT_MINUTES, EXCHANGE_SECONDS,
} from './constants.js';
import { buildTonight } from './state.js';
import { activeCones, felixDawnCone, taperLitNow, lessonWindow } from './schedule.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- geometry

function segmentHitsRect(ax, ay, bx, by, r) {
  // Liang–Barsky; true if the segment crosses the rectangle's interior.
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x0, r.x1 - ax, ay - r.y0, r.y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}

function lineOfSight(ax, ay, bx, by) {
  for (const r of OBSTACLES) {
    if (segmentHitsRect(ax, ay, bx, by, r)) return false;
  }
  for (const r of LOS_ONLY) {
    if (segmentHitsRect(ax, ay, bx, by, r)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// 2 = inner band (seen), 1 = outer band (clip), 0.5 = near miss, 0 = clear.
export function coneBand(cone, px, py) {
  const dx = px - cone.x, dy = py - cone.y;
  const d = Math.hypot(dx, dy);
  const diff = Math.abs(angleDiff(Math.atan2(dy, dx), cone.angle));
  const wide = cone.wide || cone.dawnDoor;
  const innerR = wide ? CONE.felixDawnInnerReach : CONE.innerReach;
  const innerA = wide ? CONE.felixDawnInnerHalfAngle : CONE.innerHalfAngle;
  const outerR = wide ? CONE.felixDawnOuterReach : CONE.outerReach;
  const outerA = wide ? CONE.felixDawnOuterHalfAngle : CONE.outerHalfAngle;
  if (d > CONE.nearReach && d > outerR) return 0;
  if (cone.deadZone && d < CONE.windowDeadZone) return 0; // he watches the yard, not his feet
  if (!lineOfSight(cone.x, cone.y, px, py)) return 0;
  if (d <= innerR && diff <= innerA) return 2;
  if (d <= outerR && diff <= outerA) return 1;
  if (d <= CONE.nearReach && diff <= CONE.nearHalfAngle) return 0.5;
  return 0;
}

// ---------------------------------------------------------------- run flow

export function startNight(state) {
  // Snapshot the dawn this night's routines are keyed to.
  state.dawn = { firing: state.firing, store: state.store, unease: state.unease };
  const base = BASE_NIGHT_MINUTES[state.night - 1];
  const penalty = state.dawn.firing >= 4 ? 2 : state.dawn.firing >= 2 ? 1 : 0;
  state.nightLength = base - penalty;
  state.minute = 0;
  state.nightMinutesLeft = state.nightLength;
  state.tonight = buildTonight(state, penalty);
  state.ownFood = Math.max(0, state.ownFood - OWN_FOOD_PER_NIGHT);
  state.creature.inHovel = true;
  state.creature.x = HOVEL_MOUTH.x;
  state.creature.y = HOVEL_MOUTH.y;
  state.creature.carrying = false;
  state.calmTicks = 0;
  state.target = null;
  state.phase = 'night';
  state.phaseTick = 0;
}

function latchSlip(state) {
  if (state.walkSlipped) return;
  state.walkSlipped = true;
  state.events.push({ type: 'slip' });
  if (state.walk) {
    state.walk.day = WALK.errandDay;
    state.walk.slots = Math.max(1, state.walk.slots - WALK.slipSlotLoss);
  }
}

function selectWalk(state) {
  const s = state.store;
  let walk;
  if (s >= 3) walk = { day: WALK.longDay, slots: WALK.longSlots, band: 'long' };
  else if (s === 2) walk = { day: WALK.shortDay, slots: WALK.shortSlots, band: 'short' };
  else walk = { day: WALK.errandDay, slots: WALK.errandSlots, band: 'errand' };
  if (state.walkSlipped) {
    walk.day = WALK.errandDay;
    walk.slots = Math.max(1, walk.slots - WALK.slipSlotLoss);
  }
  state.walk = walk;
}

// Night N has ended; compute dawn N+1 (GAME_DESIGN §6.2, §7).
export function computeDawn(state) {
  const t = state.tonight;
  const N = state.night;
  const felixWalked = !state.felixFreeToday;            // day N's errand

  state.firing = clamp(state.firing + (felixWalked ? 1 : 0) - 1, 0, MAX_FIRING);

  const thaw = N >= THAW_NIGHT;
  const gain = thaw ? (state.felixFreeToday ? 4 : 3) : 2;
  state.store = Math.max(0, state.store + gain - 3 - t.takes);
  if (thaw && state.felixFreeToday) state.freeThawDays++;

  // Unease: decay through an incident-free night. A Firing-0 dawn is not an
  // incident. The Firing trigger fires once per unbroken run of zero dawns.
  if (t.incidents === 0) state.unease = Math.max(0, state.unease - 1);
  if (state.firing === 0) {
    state.zeroFiringRun++;
    if (state.zeroFiringRun >= 2 && !state.zeroFiringUneaseFired) {
      state.zeroFiringUneaseFired = true;
      state.unease = Math.min(UNEASE_MAX, state.unease + 1);
    }
  } else {
    state.zeroFiringRun = 0;
    state.zeroFiringUneaseFired = false;
  }
  if (state.unease >= UNEASE_MAX) latchSlip(state);

  if (state.store === 0) state.zeroStoreRun++; else state.zeroStoreRun = 0;
  if (state.zeroStoreRun >= STORE_GONE_DAWNS) state.familyGone = true;

  state.day = N + 1;
  state.night = N + 1;
  state.felixFreeToday = state.firing >= 2;
  if (state.day === WALK.selectDawn && !state.walk) selectWalk(state);
}

export function endNight(state) {
  computeDawn(state);
  state.phase = 'dawnRead';
  state.phaseTick = 0;
  state.events.push({ type: 'dawn', day: state.day });
}

// What comes after the dawn read: the next night, the walk, or an ending.
export function advanceFromDawn(state) {
  if (state.familyGone) {
    state.ending = 'want';
    state.phase = 'epilogue';
    state.phaseTick = 0;
    return;
  }
  if (state.walk && state.day === state.walk.day) {
    startWalk(state);
    return;
  }
  startNight(state);
}

// ---------------------------------------------------------------- actions

function nearestActionable(state) {
  const c = state.creature;
  const near = (p, r = REACH) => Math.hypot(c.x - p.x, c.y - p.y) <= r;
  if (c.carrying && near(DOOR, 34)) return 'putDown';
  if (!c.carrying && state.tonight.loadAvailable && near(OUTHOUSE, 40)) return 'takeLoad';
  if (!state.tonight.waterDrawn && near(WELL, 30)) return 'water';
  if (state.night < THAW_NIGHT && !state.tonight.pathCleared && near(DOOR_APRON, 30)) return 'path';
  if (near(MILK_HOUSE, 30)) return 'take';
  if (!state.tonight.foraged && near(WOOD_EDGE, 44)) return 'forage';
  if (!state.portmanteauFound && near(WOOD_EDGE, 30)) return 'search';
  if (near(HOVEL_MOUTH, 24)) return 'goIn';
  return null;
}

export function availableAction(state) {
  if (state.phase !== 'night') return null;
  const t = state.tonight;
  if (t && t.action) return null;
  const c = state.creature;
  if (c.inHovel) {
    const lw = lessonWindow(state);
    if (state.night >= LESSON_FIRST_NIGHT && !t.lessonDone &&
        state.minute >= lw.start && state.minute + COST.lesson <= lw.end + 0.03) return 'lesson';
    if (t.listening) return 'stopListen';
    return 'listen';
  }
  return nearestActionable(state);
}

function startAction(state, kind, ticks) {
  state.tonight.action = { kind, ticksLeft: ticks, totalTicks: ticks, acc: 0, minted: 0 };
}

function applyContext(state) {
  const t = state.tonight;
  const c = state.creature;
  const mt = state.minuteTicks;
  if (c.inHovel) {
    const a = availableAction(state);
    if (a === 'lesson') {
      const total = state.night === LESSON_FIRST_NIGHT ? LESSON_FIRST : LESSON_LATER;
      startAction(state, 'lesson', COST.lesson * mt);
      t.action.lessonTotal = total;
      state.events.push({ type: 'lessonStart' });
    } else if (a === 'listen') {
      t.listening = true;
      t.listenBlockLeft = COST.listen * mt;
      state.events.push({ type: 'listenStart' });
    } else if (a === 'stopListen') {
      t.listening = false;
    }
    return;
  }
  const a = nearestActionable(state);
  switch (a) {
    case 'putDown': {
      c.carrying = false;
      t.carryDone = true;
      state.carriesTotal++;
      state.firing = clamp(state.firing + 1, 0, MAX_FIRING);
      if (c.hungryCarry) {
        // The load cost five minutes, not four: the extra minute lands now.
        state.minute = Math.min(state.nightLength, state.minute + (COST.carryHungryMinutes - COST.carryMinutes));
      }
      c.hungryCarry = false;
      state.events.push({ type: 'putDown', firing: state.firing });
      break;
    }
    case 'takeLoad':
      c.carrying = true;
      c.hungryCarry = state.ownFood <= 0;
      t.loadAvailable = false;
      state.events.push({ type: 'takeLoad' });
      break;
    case 'water': startAction(state, 'water', HOLD_TICKS.water * mt); break;
    case 'path': startAction(state, 'path', HOLD_TICKS.path * mt); break;
    case 'take': startAction(state, 'take', HOLD_TICKS.take * mt); break;
    case 'forage':
      // Traversal-costed: the walk is the whole cost. The yield lands now.
      t.foraged = true;
      state.ownFood += FORAGE_YIELD;
      state.events.push({ type: 'forage' });
      break;
    case 'search':
      state.portmanteauFound = true;
      state.words += PORTMANTEAU_WORDS;
      state.events.push({ type: 'portmanteau', words: state.words });
      break;
    case 'goIn':
      c.inHovel = true;
      c.x = HOVEL_MOUTH.x; c.y = HOVEL_MOUTH.y;
      state.events.push({ type: 'goIn' });
      break;
  }
}

function dropLoad(state) {
  const c = state.creature;
  if (!c.carrying) return;
  c.carrying = false;
  c.hungryCarry = false;
  state.tonight.loadDroppedAt = { x: c.x, y: c.y };
  state.tonight.incidents++;
  state.droppedLoads++;
  state.unease = Math.min(UNEASE_MAX, state.unease + 1);
  state.events.push({ type: 'drop' });
  if (state.unease >= UNEASE_MAX) latchSlip(state);
}

function completeAction(state) {
  const t = state.tonight;
  const action = t.action;
  const kind = action.kind;
  t.action = null;
  switch (kind) {
    case 'water': t.waterDrawn = true; state.events.push({ type: 'water' }); break;
    case 'path': t.pathCleared = true; state.events.push({ type: 'path' }); break;
    case 'take':
      t.takes++;
      state.takesTotal++;
      state.ownFood += TAKE_YIELD;
      state.events.push({ type: 'take' });
      break;
    case 'forage':
      t.foraged = true;
      state.ownFood += FORAGE_YIELD;
      state.events.push({ type: 'forage' });
      break;
    case 'lesson': {
      // Flush any float-boundary remainder so the full yield always lands.
      const remaining = action.lessonTotal - action.minted;
      if (remaining > 0) state.words += remaining;
      t.lessonDone = true;
      state.lessonsAttended++;
      state.events.push({ type: 'lessonDone', words: state.words });
      break;
    }
    case 'journal':
      t.journalDone = true;
      state.journalRead = true;
      state.events.push({ type: 'journal' });
      break;
  }
}

function mintListenBlock(state) {
  const doubled = state.night < THAW_NIGHT && state.felixFreeToday; // frost, Felix reading aloud
  const base = state.words < LISTEN_SOFT_CAP ? LISTEN_GAIN : LISTEN_GAIN_AFTER_CAP;
  const gain = doubled ? base * 2 : base;
  state.words += gain;
  state.listensCompleted++;
  state.events.push({ type: 'word', gain, words: state.words, doubled });
}

// ---------------------------------------------------------------- movement

// Click-to-move routes around obstacles on a visibility graph over the
// obstacle corners, inflated by the creature's radius. Deterministic.
function inflate(r, m) {
  return { x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m };
}
function pointIn(r, x, y) { return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1; }
function walkVisible(ax, ay, bx, by) {
  for (const r of OBSTACLES) {
    const ir = inflate(r, 8);
    // A rect containing an endpoint cannot be routed out of; skip it.
    if (pointIn(ir, ax, ay) || pointIn(ir, bx, by)) continue;
    if (segmentHitsRect(ax, ay, bx, by, ir)) return false;
  }
  return true;
}
function computePath(sx, sy, tx, ty) {
  if (walkVisible(sx, sy, tx, ty)) return [{ x: tx, y: ty }];
  const nodes = [{ x: sx, y: sy }, { x: tx, y: ty }];
  for (const r of OBSTACLES) {
    const corners = [
      { x: r.x0 - 9, y: r.y0 - 9 }, { x: r.x1 + 9, y: r.y0 - 9 },
      { x: r.x0 - 9, y: r.y1 + 9 }, { x: r.x1 + 9, y: r.y1 + 9 },
    ];
    // A corner inside another obstacle's push zone is unreachable.
    for (const c of corners) {
      const blocked = OBSTACLES.some(o => o !== r && pointIn(inflate(o, 8), c.x, c.y));
      if (!blocked) nodes.push(c);
    }
  }
  const n = nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u === -1 || u === 1) break;
    done[u] = true;
    for (let v = 1; v < n; v++) {
      if (done[v] || !walkVisible(nodes[u].x, nodes[u].y, nodes[v].x, nodes[v].y)) continue;
      const w = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
      if (w < dist[v]) { dist[v] = w; prev[v] = u; }
    }
  }
  if (!isFinite(dist[1])) return [{ x: tx, y: ty }];
  const path = [];
  for (let v = 1; v !== -1; v = prev[v]) path.unshift(nodes[v]);
  if (path.length && path[0] === nodes[0]) path.shift(); // drop the start node
  return path;
}

function moveCreature(state, input) {
  const c = state.creature;
  const speed = WALK_SPEED / state.minuteTicks; // px per tick
  let vx = 0, vy = 0;
  if (input.kx || input.ky) {
    const n = Math.hypot(input.kx, input.ky) || 1;
    vx = (input.kx / n) * speed;
    vy = (input.ky / n) * speed;
    state.target = null;
    state.path = null;
  } else if (state.path && state.path.length) {
    const wp = state.path[0];
    const dx = wp.x - c.x, dy = wp.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) { state.path.shift(); }
    else { vx = (dx / d) * speed; vy = (dy / d) * speed; }
  }
  c.moving = !!(vx || vy);
  if (!c.moving) return;
  c.facing = Math.atan2(vy, vx);
  c.x += vx; c.y += vy;
  // Push out of obstacles (circle radius 8).
  for (const r of OBSTACLES) {
    const nx = clamp(c.x, r.x0, r.x1), ny = clamp(c.y, r.y0, r.y1);
    const dx = c.x - nx, dy = c.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < 64) {
      if (d2 === 0) { c.y = r.y1 + 8; continue; }
      const d = Math.sqrt(d2);
      c.x = nx + (dx / d) * 8;
      c.y = ny + (dy / d) * 8;
    }
  }
  c.x = clamp(c.x, 24, 1256);
  c.y = clamp(c.y, 24, 776);
}

function nightTriggers(state) {
  const c = state.creature;
  const t = state.tonight;
  // The pig drive: walking through the sty.
  if (!t.pigDriven && c.x > 500 && c.x < 542 && c.y > 224 && c.y < 252) {
    t.pigDriven = true;
    state.events.push({ type: 'pig' });
  }
  // A footprint in the garden beds.
  if (!t.gardenPrint && Math.hypot(c.x - GARDEN.x, c.y - GARDEN.y) < 48) {
    t.gardenPrint = true;
    t.incidents++;
    state.unease = Math.min(UNEASE_MAX, state.unease + 1);
    state.events.push({ type: 'garden' });
    if (state.unease >= UNEASE_MAX) latchSlip(state);
  }
  // The pool, under moonlight: the reflection, once.
  if (!state.poolSeen && Math.hypot(c.x - POOL.x, c.y - POOL.y) < 26) {
    state.poolSeen = true;
    state.events.push({ type: 'pool' });
  }
}

// ---------------------------------------------------------------- the night

export function tickNight(state, input) {
  const t = state.tonight;
  const c = state.creature;
  const mt = state.minuteTicks;

  state.minute += 1 / mt;
  state.nightMinutesLeft = Math.max(0, state.nightLength - state.minute);

  // The taper warning (unease >= 2).
  if (!t.taperWarned && taperLitNow(state, mt)) {
    t.taperWarned = true;
    state.events.push({ type: 'taper' });
  }

  // Edges.
  if (input.drop) dropLoad(state);
  if (input.exit && c.inHovel && !t.action) {
    t.listening = false;
    c.inHovel = false;
    state.target = null;
    state.events.push({ type: 'goOut' });
  }
  if (input.journal && c.inHovel && !t.action && !t.listening &&
      state.words >= JOURNAL_GATE && !t.journalDone) {
    startAction(state, 'journal', COST.journal * mt);
    state.events.push({ type: 'journalStart' });
  }
  if (input.action) {
    if (t.action) {
      // pressing again during a hold aborts it (station actions only)
      if (t.action.kind !== 'lesson') { t.action = null; }
    } else {
      applyContext(state);
    }
  }

  // Movement aborts station work.
  const wantsMove = !c.inHovel && (input.kx || input.ky || input.target);
  if (input.target &&
      (!state.target || state.target.x !== input.target.x || state.target.y !== input.target.y)) {
    state.target = input.target;
    state.path = computePath(c.x, c.y, input.target.x, input.target.y);
  }
  if (wantsMove && t.action) {
    if (t.action.kind === 'lesson') state.events.push({ type: 'lessonAbort' });
    t.action = null;
  }
  if (wantsMove && t.listening) t.listening = false;

  if (c.inHovel) {
    // Station work at the chink.
    if (t.listening) {
      t.listenBlockLeft--;
      if (t.listenBlockLeft <= 0) {
        mintListenBlock(state);
        t.listenBlockLeft = COST.listen * mt;
      }
    }
  } else if (!t.action) {
    moveCreature(state, input);
    nightTriggers(state);
  }

  if (t.action) {
    t.action.ticksLeft--;
    if (t.action.kind === 'lesson') {
      // Words arrive one scratch at a time, paced to the repetitions.
      t.action.acc += t.action.lessonTotal / t.action.totalTicks;
      while (t.action.acc >= 1) {
        t.action.acc -= 1;
        t.action.minted++;
        state.words++;
        state.events.push({ type: 'word', gain: 1, words: state.words, lesson: true });
      }
    }
    if (t.action.ticksLeft <= 0) completeAction(state);
  }

  // Cones — only while their owner is awake, and only against a creature
  // outside the hovel.
  if (!c.inHovel) {
    let worst = 0;
    let seer = null;
    for (const cone of activeCones(state)) {
      const band = coneBand(cone, c.x, c.y);
      if (band > worst) { worst = band; seer = cone.owner; }
    }
    if (worst >= 1) state.calmTicks = 0; else state.calmTicks++;
    if (worst === 2) {
      beginSeen(state, seer, 'night');
      return;
    }
    if (worst === 1 && state.calmTicks === 0 && !t.clipLatch) {
      t.clipLatch = true;
      t.incidents++;
      state.clips++;
      state.unease = Math.min(UNEASE_MAX, state.unease + 1);
      state.events.push({ type: 'clip', unease: state.unease, x: c.x, y: c.y, night: state.night, minute: state.minute });
      if (state.unease >= UNEASE_MAX) latchSlip(state);
    }
    if (worst < 1) t.clipLatch = false;
    if (worst === 0.5 && !t.nearLatch) { t.nearLatch = true; state.events.push({ type: 'near' }); }
    if (worst < 0.5) t.nearLatch = false;
  }

  // First light. The deadline is L; a tick-grid grace of 0.1 night-minutes
  // keeps action quantization from manufacturing incidents the design did
  // not intend. Felix's door cone still appears at L.
  if (state.minute >= state.nightLength + 0.1) {
    // At the hovel mouth as the sky greys counts as inside: the designed
    // routes end at the mouth exactly as the night closes.
    const atMouth = Math.hypot(c.x - HOVEL_MOUTH.x, c.y - HOVEL_MOUTH.y) <= 32;
    if (!c.inHovel && !atMouth) {
      const band = coneBand(felixDawnCone(state), c.x, c.y);
      if (band === 2) {
        beginSeen(state, 'felix', 'firstlight');
        return;
      }
      t.incidents++; // caught outside at first light
      state.unease = Math.min(UNEASE_MAX, state.unease + 1);
      if (state.unease >= UNEASE_MAX) latchSlip(state);
      if (c.carrying) { c.carrying = false; t.loadDroppedAt = { x: c.x, y: c.y }; }
      state.events.push({ type: 'firstlight', x: c.x, y: c.y, night: state.night, minute: state.minute });
    }
    c.inHovel = true;
    c.x = HOVEL_MOUTH.x; c.y = HOVEL_MOUTH.y;
    endNight(state);
  }
}

function beginSeen(state, by, context) {
  state.phase = 'seen';
  state.phaseTick = 0;
  state.ending = 'seen';
  state.seenBy = by;
  state.seenContext = context;
  state.events.push({ type: 'seen', by, context });
}

// ---------------------------------------------------------------- the walk

export function startWalk(state) {
  state.phase = 'walk';
  state.phaseTick = 0;
  state.walkScene = {
    stage: 'exit',        // the three go out at the gate
    stageTick: 0,
    crossStartTick: null,
    knockTick: null,
  };
  state.creature.inHovel = false;
  state.creature.x = HOVEL_MOUTH.x;
  state.creature.y = HOVEL_MOUTH.y;
}

export function tickWalk(state, input) {
  const w = state.walkScene;
  w.stageTick++;
  if (w.stage === 'exit') {
    if (w.stageTick >= 120) { // two seconds and the way is clear
      w.stage = 'cross';
      w.stageTick = 0;
      w.crossStartTick = state.tick;
    }
    return;
  }
  if (w.stage === 'cross') {
    if (input.target &&
        (!state.target || state.target.x !== input.target.x || state.target.y !== input.target.y)) {
      state.target = input.target;
      state.path = computePath(state.creature.x, state.creature.y, input.target.x, input.target.y);
    }
    moveCreature(state, input);
    if (input.action && Math.hypot(state.creature.x - DOOR.x, state.creature.y - DOOR.y) <= 40) {
      w.knockTick = state.tick;
      startDoor(state);
    }
  }
}

function startDoor(state) {
  const w = state.walkScene;
  const waited = (w.knockTick - w.crossStartTick) / 60; // real seconds
  let penalty = state.words < WALK_NOTICE_WORDS ? 1 : 0;
  penalty += waited < WALK.knockEarlySeconds ? 1 : Math.floor(waited / WALK.slotSeconds);
  const slots = Math.max(0, state.walk.slots - penalty);
  state.door = {
    slots,
    clockTicks: slots * WALK.slotSeconds * 60,
    index: 0,                 // exchanges completed (0 = admitted only)
    exchangeTicks: 0,         // lock while an exchange plays
    knockWait: waited,
  };
  state.phase = 'door';
  state.phaseTick = 0;
  state.events.push({ type: 'knock', slots });
}

export function doorCanSpeak(state) {
  const d = state.door;
  if (!d || d.index >= EXCHANGE_GATES.length) return false;
  if (state.words < EXCHANGE_GATES[d.index]) return false;
  if (d.index === EXCHANGE_GATES.length - 1 && state.carriesTotal === 0) return false;
  return true;
}

export function tickDoor(state, input) {
  const d = state.door;
  if (d.exchangeTicks > 0) d.exchangeTicks--;
  // The walk's clock runs while the exchanges play; it ends on whatever is
  // in progress.
  d.clockTicks--;
  if (d.clockTicks <= 0) {
    state.exchangesReached = d.index;
    state.ending = d.index === 0 ? 'silence' : 'door';
    state.phase = 'aftermath';
    state.phaseTick = 0;
    state.events.push({ type: 'doorOpens' });
    return;
  }
  if (d.exchangeTicks <= 0 && input.action && doorCanSpeak(state)) {
    d.index++;
    state.exchangesReached = d.index;
    d.exchangeTicks = EXCHANGE_SECONDS * 60; // one exchange holds the room for one slot
    state.events.push({ type: 'exchange', index: d.index });
  }
}

// ---------------------------------------------------------------- epilogue

// The variant keys the epilogue's lines are chosen from (GAME_DESIGN §15).
export function epilogueModel(state) {
  return {
    ending: state.ending,
    exchange5: state.exchangesReached >= 5,
    exchanges: state.exchangesReached,
    nothingPutBy: state.takesTotal >= 3,
    journal: state.journalRead,
    satUp: state.walkSlipped,             // unease reached 3 and latched
    beds: state.freeThawDays,
    storeAtFlight: state.store,
    firingAtFlight: state.firing,
    fewLessons: state.lessonsAttended < 2,
    seenBy: state.seenBy,
    seenContext: state.seenContext,
  };
}

// ---------------------------------------------------------------- dispatch

export function tick(state, input) {
  state.tick++;
  state.phaseTick++;
  switch (state.phase) {
    case 'night': tickNight(state, input); break;
    case 'walk': tickWalk(state, input); break;
    case 'door': tickDoor(state, input); break;
    default: break; // title, coldOpen, dawnRead, seen, aftermath, epilogue: scene-paced
  }
}

// The active cone set, exposed for the test hook and the renderer.
export { activeCones };
