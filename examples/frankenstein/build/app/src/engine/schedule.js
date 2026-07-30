// Cottager schedules and cone sets for one night. Every variant is keyed to
// state read at the previous dawn (GAME_DESIGN §6.5), snapshotted at dusk.
// Cones exist only while their owner is awake, and only along these paths.
// Light is not sight: the taper, the fire and lit windows throw no cone.

import {
  DOOR, STY, WOODPILE, WELL, SOUTH_WINDOW, ROUTES, COTTAGER_SPEED,
  RETIRING_WINDOW, DAWN_WINDOW, FELIX_WAKE_FRACTION, FELIX_WAKE_MINUTES,
} from './constants.js';

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function polyLength(route) {
  let L = 0;
  for (let i = 1; i < route.length; i++) L += dist(route[i - 1], route[i]);
  return L;
}

// Position and facing at `d` px along a looping polyline.
function travelAlong(route, d, loop) {
  const total = polyLength(route);
  if (loop) d = ((d % total) + total) % total;
  else d = Math.min(d, total - 0.001);
  let acc = 0;
  for (let i = 1; i < route.length; i++) {
    const seg = dist(route[i - 1], route[i]);
    if (d <= acc + seg) {
      const t = (d - acc) / seg;
      return {
        x: route[i - 1].x + (route[i].x - route[i - 1].x) * t,
        y: route[i - 1].y + (route[i].y - route[i - 1].y) * t,
        angle: Math.atan2(route[i].y - route[i - 1].y, route[i].x - route[i - 1].x),
      };
    }
    acc += seg;
  }
  const last = route[route.length - 1], prev = route[route.length - 2];
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
}

export function retiringWindow(state) {
  const shift = state.dawn.firing >= 2 ? 1 : 0;          // retiring, late
  const width = state.dawn.firing >= 4 ? RETIRING_WINDOW + 1 : RETIRING_WINDOW;
  return { start: shift, end: shift + width };
}

// The lesson window is 0 -> 5 (6 at Firing >= 4). It is not shifted by the
// late retiring: only then does the reference line's night 4 close.
export function lessonWindow(state) {
  return { start: 0, end: state.dawn.firing >= 4 ? RETIRING_WINDOW + 1 : RETIRING_WINDOW };
}

// The active cone set at the current minute of the current night.
// Returns [{ owner, x, y, angle, wide }].
export function activeCones(state) {
  const m = state.minute;
  const L = state.nightLength;
  const t = state.tonight;
  const cones = [];
  const ret = retiringWindow(state);

  const agathaRetiring = () => {
    let d = (m - ret.start) * COTTAGER_SPEED;
    if (d < 0) return null;
    // Unease >= 1: an extra yard pass at dusk, before her circuit.
    if (state.dawn.unease >= 1) {
      const passLen = polyLength(ROUTES.agathaExtraPass);
      if (d < passLen) {
        const p = travelAlong(ROUTES.agathaExtraPass, d, false);
        return { owner: 'agatha', ...p, wide: false };
      }
      d -= passLen;
    }
    // The pig drive bends her circuit: she holds at the sty two minutes.
    if (t.pigDriven) {
      const toSty = dist(DOOR, STY);
      const holdPx = 2 * COTTAGER_SPEED;
      if (d >= toSty && d < toSty + holdPx) {
        return { owner: 'agatha', x: STY.x, y: STY.y, angle: Math.PI / 2, wide: false };
      }
      if (d >= toSty + holdPx) d -= holdPx;
    }
    const p = travelAlong(ROUTES.agathaRetiring, d, true);
    return { owner: 'agatha', ...p, wide: false };
  };

  // Felix at the window all night (unease latched at 3) overrides his retiring post.
  if (state.walkSlipped) {
    cones.push({ owner: 'felix', x: SOUTH_WINDOW.x, y: SOUTH_WINDOW.y, angle: Math.PI / 2, wide: true, deadZone: true });
  } else {
    if (m >= ret.start && m < ret.end) {
      cones.push({ owner: 'felix', x: DOOR.x, y: DOOR.y, angle: Math.PI / 2, wide: false });
    }
    // Unease >= 2: Felix wakes at 55% of the night for two minutes.
    if (state.dawn.unease >= 2) {
      const wake = FELIX_WAKE_FRACTION * L;
      if (m >= wake && m < wake + FELIX_WAKE_MINUTES) {
        const d = (m - wake) * COTTAGER_SPEED;
        const p = travelAlong(ROUTES.felixWake, d, false);
        cones.push({ owner: 'felix', ...p, wide: false });
      }
    }
  }

  if (m >= ret.start && m < ret.end) {
    const a = agathaRetiring();
    if (a) cones.push(a);
  }

  // Dawn window: Agatha's circuit unless the water was drawn and (before the
  // thaw) the path cleared. Store <= 2 at dawn: she rises a minute early.
  const dawnStart = L - DAWN_WINDOW - (state.dawn.store <= 2 ? 1 : 0);
  const suppressed = t.waterDrawn && (state.night >= 5 || t.pathCleared);
  if (m >= dawnStart && m < L && !suppressed && !state.walkSlipped) {
    const d = (m - dawnStart) * COTTAGER_SPEED;
    const p = travelAlong(ROUTES.agathaDawn, d, false);
    cones.push({ owner: 'agatha', ...p, wide: false });
  }

  return cones;
}

// Felix opens the door at first light: a wide cone across the yard, checked
// once, at the exact minute L.
export function felixDawnCone(state) {
  return { owner: 'felix', x: DOOR.x, y: DOOR.y, angle: Math.PI / 2, wide: true, dawnDoor: true };
}

// The taper lights 2.5 night-minutes (20 real seconds) ahead of Felix waking.
export function taperLitNow(state, minuteTicks) {
  if (state.dawn.unease < 2 || state.walkSlipped) return false;
  const wake = FELIX_WAKE_FRACTION * state.nightLength;
  const lead = 20 * 60 / minuteTicks; // 20 real seconds expressed in night-minutes
  return state.minute >= wake - lead;
}
