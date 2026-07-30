// Run state. Six state fields and no seventh (GAME_DESIGN §6.2): night
// minutes, Firing, Store, unease, own food, Words. Everything else is a
// flag or a derived convenience, never a seventh metered field.

import { START, HOVEL_MOUTH, BASE_NIGHT_MINUTES, FIRING_PENALTY_2, MINUTE_TICKS } from './constants.js';

export function createRun(seed) {
  return {
    seed: seed || 'hovel-01',
    tick: 0,                    // global tick index, monotonic for the whole run
    phase: 'title',             // title|coldOpen|dusk|night|dawnRead|walk|door|aftermath|epilogue|afterRun
    phaseTick: 0,

    // --- the six fields ---
    nightMinutesLeft: 0,        // the shrinking clock, in minutes (float during play)
    firing: START.firing,
    store: START.store,
    unease: START.unease,
    ownFood: START.ownFood,
    words: START.words,

    // --- calendar. A day runs dawn -> daylight -> night. ---
    // The night that closes day N is night N and ends at dawn N+1.
    day: 1,                     // the current day (its night is night N)
    night: 1,
    nightLength: 0,             // minutes, set at dusk
    minute: 0,                  // minutes elapsed in the current night (float)
    minuteTicks: MINUTE_TICKS,  // ticks per night-minute (?fast=1 lowers it, tests only)
    dawn: { firing: START.firing, store: START.store, unease: START.unease }, // snapshot the night is keyed to
    target: null,               // mouse destination
    calmTicks: 0,
    walkScene: null,

    // --- creature ---
    creature: {
      x: HOVEL_MOUTH.x, y: HOVEL_MOUTH.y,
      carrying: false,          // a load of firing on the shoulder
      inHovel: true,
      hungryCarry: false,       // own food was 0 when this load was taken up
      moving: false,
      facing: Math.PI / 2,
    },

    // --- tonight's working set (reset at each dusk) ---
    tonight: null,

    // --- household bookkeeping across days ---
    felixFreeToday: false,      // read from Firing at the current dawn
    freeThawDays: 0,            // count of thaw days with Felix free -> the turned beds
    zeroFiringRun: START.firing === 0 ? 1 : 0, // dawn 1 already counts
    zeroFiringUneaseFired: false, // the trigger fires once per unbroken run of zero dawns
    zeroStoreRun: 0,            // consecutive dawns at Store 0
    familyGone: false,
    walkSlipped: false,         // unease 3 latches the slip; decay does not restore it

    // --- the walk and the door ---
    walk: null,                 // { day, slots, band } selected at dawn 6
    door: null,                 // door-scene state while it runs

    // --- lifetime flags ---
    carriesTotal: 0,
    takesTotal: 0,
    lessonsAttended: 0,
    listensCompleted: 0,
    portmanteauFound: false,
    journalRead: false,
    poolSeen: false,
    firstCarryLatchSeen: false, // Agatha's hand on the latch, shown once
    droppedLoads: 0,
    clips: 0,
    ending: null,               // 'seen'|'want'|'silence'|'door'
    seenBy: null,               // who saw him, for the failure card
    seenContext: null,          // where, for the failure card
    exchangesReached: 0,

    // --- presentation queues (drained by render/audio each frame) ---
    events: [],                 // { type, ... } — words minted, clips, latches...
  };
}

// Per-night working set, built at dusk from the state read at that dawn.
export function buildTonight(state, firingPenalty) {
  return {
    waterDrawn: false,
    pathCleared: false,
    pigDriven: false,
    gardenPrint: false,
    incidents: 0,               // clips, drops, garden prints, first-light — unease sources
    carryDone: false,           // one load of cut wood per night
    loadDroppedAt: null,        // {x,y} while a dropped load lies in the yard
    loadAvailable: true,        // Felix's load waits by the outhouse
    foraged: false,
    takes: 0,                   // takes from their store this night
    lessonDone: false,
    journalDone: false,
    listening: false,
    listenBlockLeft: 0,
    taperWarned: false,
    clipLatch: false,
    nearLatch: false,
    firingPenalty,
    action: null,               // active station action { kind, ticksLeft, totalTicks }
  };
}

export function nightLengthFor(state) {
  const base = BASE_NIGHT_MINUTES[state.night - 1];
  const penalty = state.firing >= FIRING_PENALTY_2 ? 2 : state.firing >= 2 ? 1 : 0;
  return { base, penalty, length: base - penalty };
}
