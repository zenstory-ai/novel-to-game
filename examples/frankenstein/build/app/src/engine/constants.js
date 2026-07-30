// Engine constants for The Hovel.
// Every coordinate and cost here is fixed by GAME_DESIGN §6.5 and §7.
// This file is the engine's own copy; qa/design_invariants.mjs transcribes
// its expectations from the design document independently and must not
// import from here.

export const TICK_HZ = 60;
export const MINUTE_TICKS = 480;          // 1 night-minute = 8 real seconds at 60 Hz
export const FAST_MINUTE_TICKS = 60;      // ?fast=1: 1 night-minute = 1 real second (tests only)
export const WALK_SPEED = 290;            // px per night-minute

// Landmarks (GAME_DESIGN §6.5), origin top-left on the 1280x800 plate.
export const HOVEL_MOUTH = { x: 630, y: 265 };
export const COTTAGE = { x0: 550, y0: 300, x1: 730, y1: 410 };
export const DOOR = { x: 700, y: 425 };           // cottage door and the pile
export const STY = { x: 520, y: 240 };
export const POOL = { x: 640, y: 195 };
export const MILK_HOUSE = { x: 710, y: 252 };
export const WELL = { x: 470, y: 300 };
export const OUTHOUSE = { x: 310, y: 485 };
export const WOODPILE = { x: 480, y: 430 };
export const GARDEN = { x: 850, y: 480 };
export const WOOD_EDGE = { x: 200, y: 215 };      // near wood; the portmanteau lies here
export const LANE_GATE = { x: 640, y: 545 };
export const DOOR_APRON = { x: 700, y: 440 };
export const SOUTH_WINDOW = { x: 640, y: 414 };   // Felix's watch position at unease 3
export const CHINK = { x: 560, y: 300 };          // the boarded window; listening point (in-hovel)

// Obstacle rectangles. Movement push-out uses OBSTACLES; cone line-of-sight
// uses OBSTACLES plus LOS_ONLY (the sty wall: knee height, breaks a cone,
// and the creature walks through the sty to drive the pig).
export const OBSTACLES = [
  { x0: COTTAGE.x0, y0: COTTAGE.y0, x1: COTTAGE.x1, y1: COTTAGE.y1 }, // cottage
  { x0: 606, y0: 272, x1: 654, y1: 298 },   // hovel lean-to against the cottage's back wall
  { x0: 696, y0: 238, x1: 724, y1: 264 },   // milk-house
  { x0: 463, y0: 293, x1: 477, y1: 307 },   // well head
  { x0: 296, y0: 470, x1: 324, y1: 500 },   // outhouse
  { x0: 454, y0: 418, x1: 506, y1: 440 },   // woodpile (knee height; breaks cones)
];
export const LOS_ONLY = [
  { x0: 508, y0: 228, x1: 532, y1: 252 },   // sty wall
];
export const STY_GROUND = { x0: 500, y0: 224, x1: 542, y1: 252 }; // walking here drives the pig

// Interaction radii.
export const REACH = 26;                  // how close the creature must be to act

// Designed routes (GAME_DESIGN §6.5). Traversal-costed actions are charged
// for what the creature actually walks; these polylines are the designed
// routes the tolerance band is measured against.
export const CARRY_ROUTE = [
  HOVEL_MOUTH,
  { x: 520, y: 268 }, { x: 470, y: 320 }, { x: 450, y: 400 }, { x: 400, y: 450 },
  OUTHOUSE,
  { x: 440, y: 470 }, { x: 490, y: 445 }, { x: 600, y: 455 }, { x: 680, y: 435 },
  DOOR,
  { x: 760, y: 400 }, { x: 790, y: 340 }, { x: 750, y: 285 }, { x: 690, y: 262 },
  HOVEL_MOUTH,
];
export const FORAGE_ROUTE = [
  HOVEL_MOUTH,
  { x: 540, y: 240 }, { x: 400, y: 225 }, { x: 280, y: 218 },
  WOOD_EDGE,
  { x: 280, y: 218 }, { x: 400, y: 225 }, { x: 540, y: 240 },
  HOVEL_MOUTH,
];

// The six state fields, and their starting values (GAME_DESIGN §7).
export const START = {
  firing: 0,
  store: 6,
  unease: 0,
  ownFood: 3,
  words: 0,
};

// Night structure.
export const BASE_NIGHT_MINUTES = [14, 14, 13, 12, 11, 10, 9, 8]; // nights 1..8
export const FIRING_PENALTY_1 = 2;       // Firing >= 2 at dawn -> night -1
export const FIRING_PENALTY_2 = 4;       // Firing >= 4 at dawn -> night -2 and lesson window +1
export const RETIRING_WINDOW = 5;        // minutes 0..5 (6 at Firing >= 4)
export const DAWN_WINDOW = 2;            // last two minutes of the night
export const FELIX_WAKE_FRACTION = 0.55; // unease >= 2: Felix wakes at 55% of the night
export const FELIX_WAKE_MINUTES = 2;
export const TAPER_LEAD_SECONDS = 20;    // taper lights this far ahead of Felix waking
export const THAW_NIGHT = 5;             // snow gone from the path from night 5
export const MAX_FIRING = 4;

// Action costs (night-minutes). Hold times are the flat charge minus the
// designed walk, so a direct route totals exactly the design's figure.
export const COST = {
  carryMinutes: 4,        // traversal; designed route 1158 px
  carryHungryMinutes: 5,  // when own food is 0 at the moment of the carry
  forageMinutes: 3,       // traversal; designed route 869 px; no hold
  water: 2,               // walk 1.13 + hold 0.87
  path: 3,                // walk 1.30 + hold 1.70
  take: 1,                // walk 0.56 + hold 0.44
  listen: 2,              // per 2-minute block at the chink
  lesson: 5,              // hold at the chink inside the lesson window
  journal: 4,             // hold at the chink, Words >= 62
};
export const HOLD_TICKS = {              // hold durations, in night-minutes
  water: 0.76,          // the well walk routes at 1.24: 1.24 + 0.76 = 2
  path: 1.03,           // the apron walk routes around the cottage: 1.97 + 1.03 = 3
  take: 0.44,
  forage: 0,             // the walk is the whole cost
};
// Each door exchange holds the room for one slot's span.
export const EXCHANGE_SECONDS = 30;

// Resource rules (GAME_DESIGN §6.2).
export const OWN_FOOD_PER_NIGHT = 3;
export const FORAGE_YIELD = 6;
export const TAKE_YIELD = 6;
export const FIRING_BURN_PER_DAY = 1;
export const STORE_WINTER_GAIN = 2;
export const STORE_THAW_GAIN = 3;
export const STORE_THAW_FREE_GAIN = 4;   // thaw day with Felix free
export const STORE_EATEN_PER_DAY = 3;
export const STORE_TWO_PLATE = 2;        // Store <= 2 -> two plates, Agatha rises early
export const STORE_GONE_DAWNS = 3;       // 0 at three consecutive dawns -> the family leaves
export const UNEASE_MAX = 3;

// Words (GAME_DESIGN §6.2, §7).
export const LISTEN_GAIN = 2;            // per 2-minute block, first 16 words
export const LISTEN_GAIN_AFTER_CAP = 1;
export const LISTEN_SOFT_CAP = 16;
export const LESSON_FIRST = 20;          // night 4
export const LESSON_LATER = 16;
export const LESSON_FIRST_NIGHT = 4;
export const PORTMANTEAU_WORDS = 8;      // once
export const JOURNAL_GATE = 62;
export const WALK_NOTICE_WORDS = 44;     // understand the walk being planned
export const EXCHANGE_GATES = [40, 52, 62, 72, 80]; // the five door exchanges

// The walk (GAME_DESIGN §7 final table).
export const WALK = {
  longDay: 8, longSlots: 5,    // Store 3 at dawn 6
  shortDay: 8, shortSlots: 3,  // Store 2 at dawn 6
  errandDay: 9, errandSlots: 2,// Store <= 1 at dawn 6
  selectDawn: 6,
  slipSlotLoss: 2,             // unease 3 latches: walk slips a day and loses 2 slots
  knockEarlySeconds: 15,       // knocking within this costs one slot
  slotSeconds: 30,             // waiting costs one slot per this many seconds
};

// Cones. Outer band reach/half-angle, inner band reach/half-angle (radians),
// and a near-miss ring beyond the outer band.
export const CONE = {
  outerReach: 150, outerHalfAngle: 0.56,
  innerReach: 95, innerHalfAngle: 0.35,
  nearReach: 185, nearHalfAngle: 0.70,
  felixDawnOuterReach: 260, felixDawnOuterHalfAngle: 0.96,
  felixDawnInnerReach: 165, felixDawnInnerHalfAngle: 0.52,
  windowDeadZone: 80,       // Felix at the window watches the yard, not his feet
};
export const COTTAGER_SPEED = 200;       // px per night-minute (creature: 290)

// Cottager routine waypoints (GAME_DESIGN §6.5).
export const ROUTES = {
  agathaRetiring: [DOOR, STY, MILK_HOUSE, DOOR],
  agathaDawn: [DOOR, WELL, DOOR],
  felixWake: [DOOR, WOODPILE, DOOR],
  agathaExtraPass: [DOOR, LANE_GATE, DOOR], // unease >= 1: extra yard pass at dusk
};

export const PLATE = { w: 1280, h: 800 };
