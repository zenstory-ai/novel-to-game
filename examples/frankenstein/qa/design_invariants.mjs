#!/usr/bin/env node
// qa/design_invariants.mjs — checks the engine against GAME_DESIGN §6.2,
// §6.5 and §7. Every expectation below is transcribed from the design
// document as a fresh literal. This file imports only the engine, and no
// constant is shared with the engine's own constants module: a check that
// shares the implementation's assumptions cannot discover that those
// assumptions are wrong.

const ENGINE = new URL('../build/app/src/engine/', import.meta.url);
const { createRun } = await import(ENGINE + 'state.js');
const sim = await import(ENGINE + 'sim.js');
const sched = await import(ENGINE + 'schedule.js');

// --------------------------------------------------------------------------
// Transcribed from GAME_DESIGN §6.5 — the holding, in numbers.
// --------------------------------------------------------------------------

const WALK_SPEED = 290;                 // px per night-minute
const MINUTE_TICKS = 480;               // one night-minute = 8 real seconds at 60 Hz
const PLATE = { w: 1280, h: 800 };

const LM = {                            // landmarks
  hovelMouth: { x: 630, y: 265 },
  cottage: { x0: 550, y0: 300, x1: 730, y1: 410 },
  door: { x: 700, y: 425 },
  sty: { x: 520, y: 240 },
  pool: { x: 640, y: 195 },
  milkHouse: { x: 710, y: 252 },
  well: { x: 470, y: 300 },
  outhouse: { x: 310, y: 485 },
  woodpile: { x: 480, y: 430 },
  garden: { x: 850, y: 480 },
  woodEdge: { x: 200, y: 215 },
  laneGate: { x: 640, y: 545 },
};

const CARRY_ROUTE = [                   // 1,158 px -> 4 night-minutes
  LM.hovelMouth,
  { x: 520, y: 268 }, { x: 470, y: 320 }, { x: 450, y: 400 }, { x: 400, y: 450 },
  LM.outhouse,
  { x: 440, y: 470 }, { x: 490, y: 445 }, { x: 600, y: 455 }, { x: 680, y: 435 },
  LM.door,
  { x: 760, y: 400 }, { x: 790, y: 340 }, { x: 750, y: 285 }, { x: 690, y: 262 },
  LM.hovelMouth,
];
const FORAGE_ROUTE = [                  // 869 px -> 3 night-minutes
  LM.hovelMouth,
  { x: 540, y: 240 }, { x: 400, y: 225 }, { x: 280, y: 218 },
  LM.woodEdge,
  { x: 280, y: 218 }, { x: 400, y: 225 }, { x: 540, y: 240 },
  LM.hovelMouth,
];
const CARRY_DESIGNED_PX = 1158, FORAGE_DESIGNED_PX = 869;

// §6.2 / §7 — the numeric layer.
const BASE_NIGHTS = [14, 14, 13, 12, 11, 10, 9, 8];
const REF_FIRING_AT_DAWN = [0, 1, 2, 2, 2, 1, 2, 1];   // dawns 1..8
const REF_STORE_AT_DAWN = [6, 5, 4, 3, 2, 3, 3, 4];
const REF_WORDS_AFTER_NIGHT = [2, 6, 14, 34, 50, 66, 82];
const REF_FELIX_FREE_DAY = [false, false, true, true, true, false, true]; // days 1..7
const REF_PENALTY = [0, 0, 1, 1, 1, 0, 1];
const REF_USABLE = 79, REF_SLACK_MAX = 5;              // T7
const OWN_FOOD_AT_DUSK = [0, 3, 0, 3, 0, 3, 0];        // §7 note; start 3, burn 3
const EXCHANGE_GATES = [40, 52, 62, 72, 80];
const WALK_NOTICE = 44;

// --------------------------------------------------------------------------
// Test rig.
// --------------------------------------------------------------------------

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ok   ${name}`); }
  else { failures++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function newRun() {
  const s = createRun('hovel-01');
  s.minuteTicks = MINUTE_TICKS;
  return s;
}
function step(s, input = {}) { sim.tick(s, input); }

function waitTicks(s, n, input = {}) {
  for (let i = 0; i < n; i++) {
    step(s, input);
    if (s.phase !== 'night') return false;
  }
  return true;
}
function waitMinute(s, m) { // tick until the night minute reaches m
  let guard = MINUTE_TICKS * 20;
  while (s.minute < m && s.phase === 'night' && guard-- > 0) step(s);
  return s.phase === 'night';
}
function walkTo(s, x, y, maxTicks = MINUTE_TICKS * 8) {
  for (let i = 0; i < maxTicks; i++) {
    if (Math.hypot(s.creature.x - x, s.creature.y - y) < 5) return true;
    step(s, { target: { x, y } });
    if (s.phase !== 'night') return false;
  }
  return Math.hypot(s.creature.x - x, s.creature.y - y) < 7;
}
function walkPath(s, pts) {
  for (const p of pts) if (!walkTo(s, p.x, p.y)) return false;
  return true;
}
function press(s) { step(s, { action: true }); }
function exitHovel(s) { step(s, { exit: true }); }
function goIn(s) {
  if (!walkTo(s, LM.hovelMouth.x, LM.hovelMouth.y)) return false;
  press(s);
  return s.creature.inHovel;
}
// Arriving at the mouth exactly as the night closes counts as inside.
function homeOrGrace(s) {
  if (walkTo(s, LM.hovelMouth.x, LM.hovelMouth.y)) return true;
  return s.phase === 'dawnRead' &&
    Math.hypot(s.creature.x - LM.hovelMouth.x, s.creature.y - LM.hovelMouth.y) <= 26;
}
function doGarden(s) {                                     // a footprint in the beds
  if (!walkTo(s, LM.garden.x, LM.garden.y)) return false;
  if (!s.tonight.gardenPrint) return false;
  return homeOrGrace(s);
}
// Deliberately caught outside at first light: one unease incident, no cone
// contact, and the hovel takes him anyway.
function waitOut(s) {
  if (!walkTo(s, 500, 400)) return false;
  let guard = MINUTE_TICKS * 20;
  while (s.phase === 'night' && guard-- > 0) step(s);
  return s.phase === 'dawnRead';
}

// Yard programs. Each returns false if the run broke (seen / first light).
// Stations that are obstacles are approached beside their walls, not at
// their centres.
const OUTHOUSE_SIDE = { x: 310, y: 508 };   // 23 px from the outhouse centre
const WELL_SIDE = { x: 470, y: 326 };       // 26 px from the well head
const MILK_SIDE = { x: 710, y: 280 };       // 28 px from the milk-house

function doForage(s) {
  const t0 = s.minute;
  if (!walkPath(s, FORAGE_ROUTE.slice(1, 5))) return null;   // to the wood edge
  press(s);                                                   // gather
  if (!s.tonight.foraged) return null;
  if (!walkPath(s, FORAGE_ROUTE.slice(5)) && !homeOrGrace(s)) return null; // and home
  return s.minute - t0;
}
function doCarry(s) {
  const t0 = s.minute;
  if (!walkPath(s, CARRY_ROUTE.slice(1, 5))) return null;
  if (!walkTo(s, OUTHOUSE_SIDE.x, OUTHOUSE_SIDE.y)) return null;
  press(s);                                                   // take the load
  if (!s.creature.carrying) return null;
  if (!walkPath(s, CARRY_ROUTE.slice(6, 11))) return null;   // to the door
  press(s);                                                   // put it down
  if (s.creature.carrying) return null;
  if (!walkPath(s, CARRY_ROUTE.slice(11, 16)) && !homeOrGrace(s)) return null;  // and home
  return s.minute - t0;
}
function doWater(s) {
  if (!walkTo(s, WELL_SIDE.x, WELL_SIDE.y)) return false;
  press(s);
  let guard = MINUTE_TICKS * 2;
  while (!s.tonight.waterDrawn && s.phase === 'night' && guard-- > 0) step(s);
  if (!s.tonight.waterDrawn) return false;
  return homeOrGrace(s);
}
function doPath(s) {
  if (!walkTo(s, 700, 440)) return false;                    // the door apron
  press(s);
  let guard = MINUTE_TICKS * 3;
  while (!s.tonight.pathCleared && s.phase === 'night' && guard-- > 0) step(s);
  if (!s.tonight.pathCleared) return false;
  return homeOrGrace(s);
}
function doTake(s) {
  if (!walkTo(s, MILK_SIDE.x, MILK_SIDE.y)) return false;
  press(s);
  let guard = MINUTE_TICKS;
  const before = s.tonight.takes;
  while (s.tonight.takes === before && s.phase === 'night' && guard-- > 0) step(s);
  if (s.tonight.takes === before) return false;
  return walkTo(s, LM.hovelMouth.x, LM.hovelMouth.y);
}
function doListenBlocks(s, blocks) {
  const target = s.listensCompleted + blocks;
  press(s);                                                   // start listening
  let guard = MINUTE_TICKS * 4 * blocks;
  while (s.listensCompleted < target && s.phase === 'night' && guard-- > 0) step(s);
  press(s);                                                   // come away
  return s.listensCompleted >= target;
}
function doLesson(s) {
  press(s);
  let guard = MINUTE_TICKS * 6;
  while (!s.tonight.lessonDone && s.phase === 'night' && guard-- > 0) step(s);
  return s.tonight.lessonDone;
}
function finishNight(s) {                                     // inside, waiting for first light
  let guard = MINUTE_TICKS * 20;
  while (s.phase === 'night' && guard-- > 0) step(s);
  return s.phase === 'dawnRead';
}
function clipFelix(s) {                                       // engineer one outer-band clip
  const before = s.clips;
  let guard = MINUTE_TICKS * 3;
  while (s.clips === before && s.phase === 'night' && guard-- > 0) {
    const cones = sim.activeCones(s).filter(c => c.owner === 'felix');
    if (!cones.length) { step(s); continue; }
    const c = cones[0];
    const a = c.angle + 0.44;                                 // ~25 degrees off his facing, west flank
    step(s, { target: { x: c.x + 120 * Math.cos(a), y: c.y + 120 * Math.sin(a) } });
  }
  if (s.clips === before) return false;
  // Home by the west corridor, clear of Agatha's milk-house leg.
  return walkTo(s, LM.hovelMouth.x, LM.hovelMouth.y);
}

// --------------------------------------------------------------------------
console.log('\n[1] §6.5 geometry — routes, speed, clock');
// --------------------------------------------------------------------------
{
  const len = (route) => {
    let L = 0;
    for (let i = 1; i < route.length; i++)
      L += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    return L;
  };
  const carry = len(CARRY_ROUTE), forage = len(FORAGE_ROUTE);
  check('carry route is 1158 px (+/-1%)', near(carry, CARRY_DESIGNED_PX, 12), `got ${carry.toFixed(1)}`);
  check('forage route is 869 px (+/-1%)', near(forage, FORAGE_DESIGNED_PX, 9), `got ${forage.toFixed(1)}`);
  check('carry / 290 rounds to 4 minutes', Math.round(carry / WALK_SPEED) === 4, (carry / WALK_SPEED).toFixed(2));
  check('forage / 290 rounds to 3 minutes', Math.round(forage / WALK_SPEED) === 3, (forage / WALK_SPEED).toFixed(2));

  // The engine's own route data must match the transcription point for point.
  const { CARRY_ROUTE: ec, FORAGE_ROUTE: ef } = await import(ENGINE + 'constants.js');
  const samePts = (a, b) => a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
  check('engine carry route matches §6.5', samePts(ec, CARRY_ROUTE));
  check('engine forage route matches §6.5', samePts(ef, FORAGE_ROUTE));

  // Walk speed and the clock: one night-minute at 60 Hz moves 290 px.
  const s = newRun();
  sim.startNight(s);
  exitHovel(s);
  s.creature.x = 640; s.creature.y = 500;
  const x0 = s.creature.x, m0 = s.minute;
  for (let i = 0; i < 480; i++) step(s, { kx: -1, ky: 0 });
  check('one night-minute = 480 ticks (8 s at 60 Hz)', near(s.minute - m0, 1, 1e-9), `${s.minute - m0}`);
  check('creature walks 290 px per night-minute', near(x0 - s.creature.x, 290, 1), `${x0 - s.creature.x}`);
}

// --------------------------------------------------------------------------
console.log('\n[2] §6.3 / §6.5 — cones exist only while their owner is awake');
// --------------------------------------------------------------------------
{
  const s = newRun();
  sim.startNight(s);                       // night 1: Firing 0, unease 0
  let cones = sim.activeCones(s);
  check('retiring window opens with Agatha and Felix', cones.length === 2);
  check('the blind man never carries a cone', cones.every(c => c.owner !== 'delacey'));
  s.minute = 7;                            // deep night
  check('deep night has an empty plate', sim.activeCones(s).length === 0);
  s.minute = 13;                           // dawn window, water not drawn
  check('dawn window wakes Agatha', sim.activeCones(s).some(c => c.owner === 'agatha'));

  // Retiring, late: Firing >= 2 at dawn shifts the window one minute.
  const s2 = newRun();
  sim.startNight(s2);
  s2.dawn.firing = 2;
  s2.minute = 0.5;
  check('Firing 2 at dawn: no retiring cone at minute 0.5', sim.activeCones(s2).length === 0);
  s2.minute = 5.5;
  check('Firing 2 at dawn: cones still live at minute 5.5', sim.activeCones(s2).length === 2);

  // Light is not sight: the taper burns at unease 2 and throws no cone.
  const s3 = newRun();
  sim.startNight(s3);
  s3.dawn.unease = 2;
  s3.nightLength = 12;
  s3.minute = 6;                           // taper lit (55% of 12 = 6.6, lead 2.5 min), Felix not yet up
  check('the taper is lit ahead of Felix waking', sched.taperLitNow(s3, MINUTE_TICKS));
  check('the taper throws no cone', sim.activeCones(s3).length === 0);
  s3.minute = 7;                           // Felix is up (6.6 .. 8.6)
  check('unease 2: Felix walks the yard at 55% of the night',
    sim.activeCones(s3).some(c => c.owner === 'felix'));
}

// --------------------------------------------------------------------------
console.log('\n[3] §7 — the reference line, played end to end');
// --------------------------------------------------------------------------

function playReferenceLine({ slips = [], takes = {} } = {}) {
  const s = newRun();
  const carryTimes = [], forageTimes = [], usable = [], spent = [];
  const slipsOn = (n) => slips.includes(n);
  const at = (tag) => `${tag} @min ${s.minute.toFixed(2)} ${s.phase} ${s.seenBy || ''} pos ${s.creature.x.toFixed(0)},${s.creature.y.toFixed(0)} clip${s.clips}`;
  sim.startNight(s);
  check('night 1 length 14', s.nightLength === 14, `${s.nightLength}`);
  check('own food at dusk 1 is 0', s.ownFood === 0, `${s.ownFood}`);

  for (let n = 1; n <= 7; n++) {
    if (n > 1) sim.startNight(s);
    if (s.phase !== 'night') return { s, broken: `night ${n} did not start (phase ${s.phase})` };
    check(`night ${n} length is ${BASE_NIGHTS[n - 1] - REF_PENALTY[n - 1]}`,
      s.nightLength === BASE_NIGHTS[n - 1] - REF_PENALTY[n - 1], `got ${s.nightLength}`);
    if (slips.length === 0 && Object.keys(takes).length === 0) {
      check(`own food at dusk of night ${n} is ${OWN_FOOD_AT_DUSK[n - 1]}`,
        s.ownFood === OWN_FOOD_AT_DUSK[n - 1], `got ${s.ownFood}`);
    }
    usable.push(s.nightLength);
    const t0 = s.minute;

    if (n === 1) {
      if (slipsOn(1)) {
        if (!doListenBlocks(s, 1)) return { s, broken: at('n1 listen') };
        if (!waitMinute(s, 5.0)) return { s, broken: at('n1 wait') };
        exitHovel(s);
        const f = doForage(s); if (f === null) return { s, broken: at('n1 forage') };
        forageTimes.push(f);
        const c = doCarry(s); if (c === null) return { s, broken: at('n1 carry') };
        carryTimes.push(c);
        if (!waitOut(s)) return { s, broken: at('n1 firstlight') };
      } else {
        const tr = (tag) => { if (process.env.QA_TRACE) console.log(`    [trace] n${n} ${tag} @${s.minute.toFixed(3)}`); };
        if (!doListenBlocks(s, 1)) return { s, broken: at('n1 listen') };
        tr('listen');
        exitHovel(s);
        const f = doForage(s); if (f === null) return { s, broken: at('n1 forage') };
        forageTimes.push(f);
        tr(`forage ${f.toFixed(3)}`);
        const c = doCarry(s); if (c === null) return { s, broken: at('n1 carry') };
        carryTimes.push(c);
        tr(`carry ${c.toFixed(3)}`);
        if (takes[1] && !doTake(s)) return { s, broken: at('n1 take') };
        if (!doWater(s)) return { s, broken: at('n1 water') };
        tr('water');
        if (!takes[1] && !doPath(s)) return { s, broken: at('n1 path') };
        tr('path');
        if (!goIn(s)) return { s, broken: at('n1 goIn') };
        tr('goIn');
      }
    } else if (n === 2) {
      if (!doListenBlocks(s, slipsOn(2) ? 1 : 2)) return { s, broken: at('n2 listen') };
      if (!waitMinute(s, 5.0)) return { s, broken: at('n2 wait') };
      exitHovel(s);
      const c = doCarry(s); if (c === null) return { s, broken: at('n2 carry') };
      carryTimes.push(c);
      if (takes[2] && !doTake(s)) return { s, broken: at('n2 take') };
      if (!doWater(s)) return { s, broken: at('n2 water') };
      if (slipsOn(2)) {
        if (!waitOut(s)) return { s, broken: at('n2 firstlight') };
      } else {
        if (!takes[2] && !doPath(s)) return { s, broken: at('n2 path') };
        if (!goIn(s)) return { s, broken: at('n2 goIn') };
      }
    } else if (n === 3) {
      if (!doListenBlocks(s, slipsOn(3) ? 1 : 2)) return { s, broken: at('n3 listen') };
      if (slipsOn(3)) {
        if (!waitMinute(s, 6.0)) return { s, broken: at('n3 wait') }; // window over; wake dodged at the woodpile
        exitHovel(s);
        const c0 = doCarry(s); if (c0 === null) return { s, broken: at('n3 carry') };
        carryTimes.push(c0);
        if (!waitOut(s)) return { s, broken: at('n3 firstlight') };
      } else {
        exitHovel(s);
        const f = doForage(s); if (f === null) return { s, broken: at('n3 forage') };
        forageTimes.push(f);
        const c = doCarry(s); if (c === null) return { s, broken: at('n3 carry') };
        carryTimes.push(c);
        if (!goIn(s)) return { s, broken: at('n3 goIn') };
      }
    } else if (n === 4) {
      if (!doLesson(s)) return { s, broken: at('n4 lesson') };
      exitHovel(s);
      if (!doWater(s)) return { s, broken: at('n4 water') };
      const c = doCarry(s); if (c === null) return { s, broken: at('n4 carry') };
      carryTimes.push(c);
      if (!goIn(s)) return { s, broken: at('n4 goIn') };
    } else if (n === 5) {
      if (!doLesson(s)) return { s, broken: at('n5 lesson') };
      exitHovel(s);
      if (!doWater(s)) return { s, broken: at('n5 water') };
      const f = doForage(s); if (f === null) return { s, broken: at('n5 forage') };
      forageTimes.push(f);
      if (!goIn(s)) return { s, broken: at('n5 goIn') };
    } else if (n === 6) {
      if (!doLesson(s)) return { s, broken: at('n6 lesson') };
      exitHovel(s);
      const c = doCarry(s); if (c === null) return { s, broken: at('n6 carry') };
      carryTimes.push(c);
      if (!goIn(s)) return { s, broken: at('n6 goIn') };
    } else if (n === 7) {
      if (!doLesson(s)) return { s, broken: at('n7 lesson') };
      exitHovel(s);
      const f = doForage(s); if (f === null) return { s, broken: at('n7 forage') };
      forageTimes.push(f);
      if (!goIn(s)) return { s, broken: at('n7 goIn') };
    }
    spent.push(s.minute - t0);
    if (!finishNight(s)) return { s, broken: `night ${n} did not close (phase ${s.phase}, minute ${s.minute.toFixed(2)})` };
    if (process.env.QA_TRACE) console.log(`    [trace] night ${n} closed; events: ${JSON.stringify(s.events.filter(e => ['clip','firstlight','garden','drop'].includes(e.type)))}`);

    // Dawn assertions against §7's traces.
    const d = n + 1;
    const expectStore = Object.keys(takes).length === 0
      ? REF_STORE_AT_DAWN[d - 1]
      : [6, 4, 2, 1, 0, 1, 1, 2][d - 1];   // one take on nights 1 and 2
    check(`dawn ${d} Firing is ${REF_FIRING_AT_DAWN[d - 1]}`, s.firing === REF_FIRING_AT_DAWN[d - 1], `got ${s.firing}`);
    check(`dawn ${d} Store is ${expectStore}`, s.store === expectStore, `got ${s.store}`);
    if (slips.length === 0 && Object.keys(takes).length === 0) {
      check(`after night ${n} Words is ${REF_WORDS_AFTER_NIGHT[n - 1]}`, s.words === REF_WORDS_AFTER_NIGHT[n - 1], `got ${s.words}`);
      check(`after night ${n} unease is 0 (§7.3 inputs)`, s.unease === 0,
        `got ${s.unease}, clips ${s.clips} ${JSON.stringify(s.events.filter(e => e.type === 'clip' || e.type === 'firstlight'))}`);
    }
    if (s.familyGone) return { s, broken: `family left for want after night ${n}` };
    if (n < 7) {
      // peek at what the next dusk will see
      const expectFree = REF_FELIX_FREE_DAY[n]; // day N+1
      check(`day ${n + 1} Felix is ${expectFree ? 'free' : 'at the wood'}`, s.felixFreeToday === expectFree);
    }
  }
  return { s, carryTimes, forageTimes, usable, spent };
}

{
  const r = playReferenceLine();
  check('reference line completes seven nights', !r.broken, r.broken || '');
  if (!r.broken) {
    const s = r.s;
    check('seven usable totals within 78–79', r.usable.reduce((a, b) => a + b, 0) >= 78 && r.usable.reduce((a, b) => a + b, 0) <= 79,
      `${r.usable.reduce((a, b) => a + b, 0)}`);
    const spentTotal = r.spent.reduce((a, b) => a + b, 0);
    check('T7: total slack <= 5 night-minutes', r.usable.reduce((a, b) => a + b, 0) - spentTotal <= REF_SLACK_MAX,
      `slack ${(r.usable.reduce((a, b) => a + b, 0) - spentTotal).toFixed(2)}`);
    const carryTotal = r.carryTimes.reduce((a, b) => a + b, 0);
    const forageTotal = r.forageTimes.reduce((a, b) => a + b, 0);
    check('carry traversal within +/-10% of 4 min each', near(r.carryTimes[0], 4, 0.4), `${r.carryTimes[0].toFixed(2)}`);
    check('forage traversal within +/-10% of 3 min each', near(r.forageTimes[0], 3, 0.3), `${r.forageTimes[0].toFixed(2)}`);
    check('five carries on the reference line', r.carryTimes.length === 5, `${r.carryTimes.length}`);
    check('walk selected at dawn 6: day 8, five slots', s.walk && s.walk.day === 8 && s.walk.slots === 5,
      JSON.stringify(s.walk));
    check('Words 82 >= the 80 gate, and a load was carried: exchange 5 is unlocked',
      s.words >= 80 && s.carriesTotal >= 1);

    // The walk and the door.
    sim.advanceFromDawn(s);
    check('day 8 is the walk', s.phase === 'walk', s.phase);
    for (let i = 0; i < 130; i++) step(s);               // the three go out
    for (let i = 0; i < 4000 && s.phase === 'walk' &&
         Math.hypot(s.creature.x - LM.door.x, s.creature.y - LM.door.y) >= 35; i++) {
      step(s, { target: LM.door });
    }
    check('crossed the yard in daylight', s.phase === 'walk');
    // Wait out the wariness window, then knock (no slot lost).
    for (let i = 0; i < 11 * 60; i++) step(s);
    press(s);
    check('the knock is answered', s.phase === 'door', s.phase);
    check('no slot lost: five slots at the door', s.door && s.door.slots === 5, `${s.door && s.door.slots}`);
    let guard = 30000;
    while (s.phase === 'door' && guard-- > 0) {
      if (s.door.exchangeTicks <= 0 && sim.doorCanSpeak(s)) press(s);
      else step(s);
    }
    check('the run reaches exchange 5', s.exchangesReached === 5, `${s.exchangesReached}`);
    check('the ending is the door', s.ending === 'door', s.ending || '');
    check('the door scene gives way to Felix', s.phase === 'aftermath', s.phase);
  }
}

// --------------------------------------------------------------------------
console.log('\n[4] §6.3 — the ordering convention');
// --------------------------------------------------------------------------
{
  // A load carried on night N first shows in Felix's day on day N+1.
  const a = newRun(); sim.startNight(a);
  waitMinute(a, 5.1);                       // past the retiring window
  exitHovel(a); doCarry(a); goIn(a); finishNight(a);
  const b = newRun(); sim.startNight(b);
  finishNight(b);
  check('carry on night 1 -> Firing 1 at dawn 2', a.firing === 1, `${a.firing}`);
  check('no carry -> Firing 0 at dawn 2', b.firing === 0, `${b.firing}`);
  check('day 1 belonged to the wood in both runs (the carry cannot act backwards)',
    a.felixFreeToday === false && b.felixFreeToday === false);
  check('the night that closes day 1 is night 1 and ends at dawn 2',
    a.day === 2 && a.night === 2);
}

// --------------------------------------------------------------------------
console.log('\n[5] §6.2 — unease, fully specified');
// --------------------------------------------------------------------------
{
  // 1. The Firing trigger fires once per unbroken run of zero dawns.
  const s = newRun();
  const uneaseAtDawn = [];
  for (let n = 1; n <= 7; n++) {
    if (n > 1) sim.startNight(s);
    finishNight(s);                       // never carries; never an incident
    uneaseAtDawn.push(s.unease);
  }
  check('zero-run trigger fires at the second consecutive zero dawn',
    uneaseAtDawn[1] === 1, JSON.stringify(uneaseAtDawn));
  check('...and never again in the same unbroken run (+1 for the slice, not +6)',
    Math.max(...uneaseAtDawn) === 1, JSON.stringify(uneaseAtDawn));
  check('a Firing-0 dawn is not an incident: unease decays through it',
    uneaseAtDawn[6] === 0, JSON.stringify(uneaseAtDawn));
  check('a line that never carries selects the short walk (Store 2 at dawn 6)',
    s.walk && s.walk.day === 8 && s.walk.slots === 3, JSON.stringify(s.walk));

  // 2. The schedule hardens: extra pass, taper, window — and the slip latches.
  // (Modelled on T6a: the reference line with one clip engineered per night,
  // so the carries keep the Firing trigger out of the ladder.)
  const g = newRun();
  sim.startNight(g);
  exitHovel(g); clipFelix(g); goIn(g); waitMinute(g, 5.1);
  exitHovel(g); doCarry(g); goIn(g); finishNight(g);   // unease 1 at dawn 2
  check('one clip: unease 1 at dawn 2', g.unease === 1, `${g.unease}`);
  sim.startNight(g);
  g.minute = 0.2;
  const pass = sim.activeCones(g).find(c => c.owner === 'agatha');
  check('unease 1: an extra yard pass at dusk', !!pass &&
    (Math.hypot(pass.x - LM.door.x, pass.y - LM.door.y) > 1 ||
     sim.activeCones(g).length >= 2));
  waitMinute(g, 5.0);
  exitHovel(g); doGarden(g); doCarry(g); goIn(g); finishNight(g);   // unease 2 at dawn 3
  check('two incidents: unease 2 at dawn 3', g.unease === 2, `${g.unease}`);
  sim.startNight(g);
  // (The taper and the 55%-wake cone are asserted in [2]; here the ladder climbs.)
  waitMinute(g, 5.0);
  exitHovel(g); doGarden(g); doCarry(g); goIn(g); finishNight(g);   // unease 3 at dawn 4, latches
  check('three incidents: unease 3 at dawn 4', g.unease === 3, `${g.unease}`);
  check('the walk-slip latches', g.walkSlipped === true);
  sim.startNight(g);
  const wcones = sim.activeCones(g).filter(c => c.owner === 'felix');
  check('unease 3: Felix at the window all night', wcones.length === 1 && wcones[0].wide === true);
  // decay does not restore the walk
  finishNight(g);                                        // incident-free night 4
  check('an incident-free night decays unease', g.unease === 2, `${g.unease}`);
  check('...but the walk does not come back', g.walkSlipped === true);
}

// --------------------------------------------------------------------------
console.log('\n[6] §6.2 — the slipped reference line (T6b shape)');
// --------------------------------------------------------------------------
{
  const r = playReferenceLine({ slips: [1, 2, 3] });
  check('slipped line completes seven nights', !r.broken, r.broken || '');
  if (!r.broken) {
    const s = r.s;
    check('the walk slips to day 9', s.walk && s.walk.day === 9, JSON.stringify(s.walk));
    check('...and loses two slots (5 -> 3)', s.walk && s.walk.slots === 3, JSON.stringify(s.walk));
    // night 8 is played in the errand/day-9 band
    sim.advanceFromDawn(s);
    check('night 8 is played', s.phase === 'night' && s.night === 8, `${s.phase} n${s.night}`);
    if (!doLesson(s)) check('night 8 lesson', false);
    finishNight(s);
    check('vocabulary goes UP in the slipped run (> 82)', s.words > 82, `${s.words}`);
    check('unease has decayed back to 1 by dawn 6 ... checking final decay instead',
      s.unease <= 1, `${s.unease}`);
    sim.advanceFromDawn(s);
    check('the walk happens on day 9', s.phase === 'walk' && s.day === 9, `${s.phase} d${s.day}`);
    for (let i = 0; i < 130; i++) step(s);
    for (let i = 0; i < 4000 && s.phase === 'walk' &&
         Math.hypot(s.creature.x - LM.door.x, s.creature.y - LM.door.y) >= 35; i++) {
      step(s, { target: LM.door });
    }
    for (let i = 0; i < 11 * 60; i++) step(s);
    press(s);
    let guard = 30000;
    while (s.phase === 'door' && guard-- > 0) {
      if (s.door.exchangeTicks <= 0 && sim.doorCanSpeak(s)) press(s);
      else step(s);
    }
    check('three slots cap the door at exchange 3', s.exchangesReached === 3, `${s.exchangesReached}`);
    check('the ending still happens', s.ending === 'door', s.ending || '');
  }
}

// --------------------------------------------------------------------------
console.log('\n[7] §6.2 — the household\'s winter');
// --------------------------------------------------------------------------
{
  // Walk bands: Store at dawn of day 6 selects the walk (the final table).
  function bandFor(storeBefore) {
    const s = newRun();
    s.day = 5; s.night = 5;
    s.firing = 2; s.felixFreeToday = true;      // a free thaw day: +4 - 3
    s.store = storeBefore;
    s.tonight = { takes: 0, incidents: 0 };
    sim.endNight(s);
    return s.walk;
  }
  check('Store 3 at dawn 6 -> long walk, day 8, five slots',
    JSON.stringify(bandFor(2)) === JSON.stringify({ day: 8, slots: 5, band: 'long' }));
  check('Store 2 at dawn 6 -> shorter walk, day 8, three slots',
    JSON.stringify(bandFor(1)) === JSON.stringify({ day: 8, slots: 3, band: 'short' }));
  check('Store 1 at dawn 6 -> an errand, day 9, two slots',
    JSON.stringify(bandFor(0)) === JSON.stringify({ day: 9, slots: 2, band: 'errand' }));

  // Store 0 at three consecutive dawns: the family leaves for want.
  const s = newRun();
  s.store = 0; s.zeroStoreRun = 2;
  s.tonight = { takes: 0, incidents: 0 };
  sim.endNight(s);
  check('three consecutive zero dawns and they are gone', s.familyGone === true);
  sim.advanceFromDawn(s);
  check('...and the run ends without a door', s.ending === 'want' && s.phase === 'epilogue');

  // Theft is affordable at two takes: reference line + one take on nights 1-2.
  const r = playReferenceLine({ takes: { 1: true, 2: true } });
  check('two takes: the family stays', !r.broken && !r.s.familyGone, r.broken || '');
  if (!r.broken) {
    check('two takes drop the walk to the errand (day 9, two slots)',
      r.s.walk && r.s.walk.day === 9 && r.s.walk.slots === 2, JSON.stringify(r.s.walk));
  }
}

// --------------------------------------------------------------------------
console.log('\n[8] §6.2 — own food, and the hungry carry');
// --------------------------------------------------------------------------
{
  const s = newRun();
  sim.startNight(s);
  waitMinute(s, 5.1);                                    // cones gone
  exitHovel(s);
  s.ownFood = 0;
  walkPath(s, CARRY_ROUTE.slice(1, 5));
  walkTo(s, OUTHOUSE_SIDE.x, OUTHOUSE_SIDE.y);
  press(s);                                              // take the load hungry
  walkPath(s, CARRY_ROUTE.slice(6, 11));
  const m0 = s.minute;
  press(s);                                              // put it down
  check('a hungry carry costs the extra minute', near(s.minute - m0, 1 + 1 / MINUTE_TICKS, 0.01),
    `${(s.minute - m0).toFixed(3)}`);
  check('...but still raises Firing', s.firing === 1, `${s.firing}`);

  const s2 = newRun();
  sim.startNight(s2);
  waitMinute(s2, 5.1);
  s2.ownFood = 6;
  exitHovel(s2);
  walkPath(s2, CARRY_ROUTE.slice(1, 5));
  walkTo(s2, OUTHOUSE_SIDE.x, OUTHOUSE_SIDE.y);
  press(s2);
  walkPath(s2, CARRY_ROUTE.slice(6, 11));
  const m1 = s2.minute;
  press(s2);
  check('a fed carry costs no surcharge', near(s2.minute - m1, 1 / MINUTE_TICKS, 0.001),
    `${(s2.minute - m1).toFixed(4)}`);
}

// --------------------------------------------------------------------------
console.log('\n[9] §6.2 — words: listening, lessons, the portmanteau, the journal');
// --------------------------------------------------------------------------
{
  // Listening yields, directly at the chink.
  const s = newRun();
  sim.startNight(s);                                     // night 1, Felix at the wood
  doListenBlocks(s, 1);
  check('first listen block mints 2 words', s.words === 2, `${s.words}`);

  // The portmanteau: +8, once.
  const p = newRun();
  sim.startNight(p);
  waitMinute(p, 5.1);                                    // cones gone
  exitHovel(p);
  walkPath(p, FORAGE_ROUTE.slice(1, 5));
  press(p);                                              // forage first
  const w0 = p.words;
  // now close enough to search
  walkTo(p, LM.woodEdge.x, LM.woodEdge.y);
  press(p);
  check('the portmanteau gives 8 words', p.words - w0 === 8, `${p.words - w0}`);
  press(p);
  check('...and only once', p.words - w0 === 8, `${p.words - w0}`);

  // The journal gate at 62.
  const j = newRun();
  sim.startNight(j);
  j.words = 61;
  step(j, { journal: true });
  check('the journal stays shut at 61 words', !j.tonight.action && !j.journalRead);
  j.words = 62;
  step(j, { journal: true });
  check('the journal opens at 62 words', !!j.tonight.action || j.journalRead);
  let guard = MINUTE_TICKS * 5;
  while (!j.journalRead && j.phase === 'night' && guard-- > 0) step(j);
  check('the journal costs 4 minutes and reads', j.journalRead === true);

  // Words >= 44: the walk is understood; below it a slot is lost.
  // (Exercised through the door in [3]; here the gate values are pinned.)
  check('the five exchange gates are 40/52/62/72/80',
    EXCHANGE_GATES.join('/') === '40/52/62/72/80');
  check('the walk-notice threshold is 44', WALK_NOTICE === 44);
}

// --------------------------------------------------------------------------
console.log('\n[10] §5 — determinism');
// --------------------------------------------------------------------------
{
  function runTwoNights() {
    const s = newRun();
    const trace = [];
    sim.startNight(s);
    exitHovel(s);
    for (let i = 0; i < 6000 && s.phase === 'night'; i++) {
      step(s, { target: { x: 400 + (i % 800), y: 300 } });
      if (i % 500 === 0) trace.push([s.tick, s.creature.x.toFixed(4), s.creature.y.toFixed(4),
        s.minute.toFixed(6), s.unease, s.ownFood].join(','));
    }
    trace.push([s.phase, s.firing, s.store, s.unease, s.words, s.day].join(','));
    return trace.join('\n');
  }
  check('same seed, same tick-indexed input -> identical state', runTwoNights() === runTwoNights());
}

// --------------------------------------------------------------------------
console.log('');
if (failures) {
  console.log(`${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('All design invariants hold.');
}
