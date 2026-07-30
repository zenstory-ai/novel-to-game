// Seeded PRNG for ambience ONLY (which bird, which hour the guitar is taken
// up, the pig's grunts). The simulation never draws from this — GAME_DESIGN
// §5: identical tick-indexed input reproduces identical state at every tick.

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The ambience table for one run. Nothing here may be read by the simulation.
export function ambienceFor(seedString) {
  const rand = mulberry32(hashSeed(seedString || 'hovel-01'));
  return {
    bird: Math.floor(rand() * 3),                 // which species sings at first light
    guitarHour: 0.15 + rand() * 0.6,              // when in the evening De Lacey takes it up
    pigGruntOffsets: [rand(), rand(), rand()],    // grunt spacing while driven
    airVariant: Math.floor(rand() * 2),           // which ordering of the one air's phrases
  };
}
