// Chapter XII: the stegosaurus comes down the path to the drinking-place,
// drinks, and lumbers away. One deterministic timeline drives both the
// simulation (what a plate can record) and the rendered animal.
export const STEGOSAURUS_TIMELINE = Object.freeze({
  delay: 8,
  approach: 17,
  drinking: 30,
  turn: 3,
  leaving: 16,
});

const START = Object.freeze({ x: -41, z: -20 });
const DRINK = Object.freeze({ x: -13.8, z: -11.5 });
const EXIT = Object.freeze({ x: -42, z: -2 });
// Head to the north-east bank: broadside to the glade, muzzle in the brook.
const DRINK_HEADING = 2.5;

function ease(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function headingFrom(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

// `heading` is the world yaw of the animal's forward direction measured like
// the scout's (atan2(dx, dz)); `stride` is 0 when standing.
export function stegosaurusPose(clockSeconds) {
  const timeline = STEGOSAURUS_TIMELINE;
  if (!Number.isFinite(clockSeconds) || clockSeconds < timeline.delay) {
    return { phase: 'absent', x: START.x, z: START.z, heading: headingFrom(START, DRINK), stride: 0 };
  }
  let t = clockSeconds - timeline.delay;
  if (t < timeline.approach) {
    const p = t / timeline.approach;
    const e = ease(p);
    return {
      phase: 'approach',
      x: lerp(START.x, DRINK.x, e),
      z: lerp(START.z, DRINK.z, e) + Math.sin(p * Math.PI) * 2.2,
      heading: lerp(headingFrom(START, DRINK), DRINK_HEADING, ease(Math.max(0, (p - 0.75) / 0.25))),
      stride: Math.min(1, Math.min(p, 1 - p) * 6),
    };
  }
  t -= timeline.approach;
  if (t < timeline.drinking) {
    return { phase: 'drinking', x: DRINK.x, z: DRINK.z, heading: DRINK_HEADING, stride: 0 };
  }
  t -= timeline.drinking;
  if (t < timeline.turn) {
    const p = ease(t / timeline.turn);
    return {
      phase: 'leaving',
      x: DRINK.x,
      z: DRINK.z,
      heading: lerp(DRINK_HEADING, headingFrom(DRINK, EXIT) + Math.PI * 2, p),
      stride: 0.5,
    };
  }
  t -= timeline.turn;
  if (t < timeline.leaving) {
    const p = t / timeline.leaving;
    return {
      phase: 'leaving',
      x: lerp(DRINK.x, EXIT.x, ease(p)),
      z: lerp(DRINK.z, EXIT.z, ease(p)),
      heading: headingFrom(DRINK, EXIT),
      stride: Math.min(1, (1 - p) * 6),
    };
  }
  return { phase: 'gone', x: EXIT.x, z: EXIT.z, heading: headingFrom(DRINK, EXIT), stride: 0 };
}
