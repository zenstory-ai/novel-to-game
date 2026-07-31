export const INITIAL_PLAYER = Object.freeze({
  position: Object.freeze({ x: 3, z: 70 }),
  heading: 0,
  pitch: 0,
});

export const NAVIGATION = Object.freeze({
  bounds: Object.freeze({ minX: -43, maxX: 29, minZ: -90, maxZ: 91 }),
  playerRadius: 0.6,
  obstacles: Object.freeze([
    Object.freeze({ id: 'fort-tent-west', type: 'circle', x: -3, z: 80, radius: 3.4 }),
    Object.freeze({ id: 'fort-tent-east', type: 'circle', x: 5, z: 84, radius: 3.4 }),
    Object.freeze({ id: 'brook-boulder', type: 'circle', x: -7.5, z: 35, radius: 2.2 }),
    Object.freeze({ id: 'basalt-wall', type: 'box', minX: 27, maxX: 45, minZ: -85, maxZ: 65 }),
  ]),
});

export const EXPOSURE_SECONDS = 2;
export const CONTACT_SECONDS = 3;
export const INITIAL_LIGHT_SECONDS = 420;

export const RESULT_BANDS = Object.freeze([
  Object.freeze({
    key: 'returned-without-record', min: 0, max: 0,
    title: 'Returned without a record',
    copy: 'You returned with a story. Stories are what they came to dispute.',
  }),
  Object.freeze({
    key: 'insufficient-record', min: 1, max: 3,
    title: 'Insufficient record',
    copy: 'The plates survived. The animal never stands clear.',
  }),
  Object.freeze({
    key: 'corroborating-record', min: 4, max: 5,
    title: 'Corroborating record',
    copy: 'Living form, more than one angle. The argument can begin again.',
  }),
  Object.freeze({
    key: 'strong-field-record', min: 6, max: 7,
    title: 'Strong field record',
    copy: 'Scale. Living form. Behavior. The field record holds.',
  }),
]);

const SPEED = Object.freeze({ walk: 4.2, sprint: 6.8, crouch: 2.2 });
const THREAT_STATES = Object.freeze(['distant', 'watch', 'search', 'attack']);

function clonePosition(position) {
  return { x: position.x, z: position.z };
}

function clonePlate(plate) {
  return { ...plate };
}

function copyState(state, changes = {}) {
  return {
    ...state,
    position: clonePosition(state.position),
    lastStablePosition: clonePosition(state.lastStablePosition),
    plates: state.plates.map(clonePlate),
    pendingExposure: state.pendingExposure ? { ...state.pendingExposure } : null,
    ...changes,
  };
}

function emptyPlate(index) {
  return {
    index,
    status: 'unexposed',
    points: 0,
    lostPoints: 0,
    label: null,
    frameKey: null,
  };
}

export function createPlayerState() {
  return {
    position: clonePosition(INITIAL_PLAYER.position),
    lastStablePosition: clonePosition(INITIAL_PLAYER.position),
    heading: INITIAL_PLAYER.heading,
    pitch: INITIAL_PLAYER.pitch,
    stance: 'walk',
    elapsedSeconds: 0,
    distanceTravelled: 0,
    paused: false,
    pauseReason: null,
    boundaryRecoveries: 0,
    collisions: 0,
    lastEvent: 'clean-start',
    zone: 'fort',
    zoneHistory: ['fort'],
    reachedGlade: false,
    inCover: false,
    coverSeconds: 0,
    sprintExposureSeconds: 0,
    sprintEscalationCharged: false,
    threatAwareness: 0,
    threatState: 'distant',
    lastThreatEvent: 'distant',
    attackSeconds: 0,
    examinedTrack: false,
    observedBehavior: false,
    lastObservation: null,
    cameraRaised: false,
    plateRailRevealed: false,
    pendingExposure: null,
    previewSeconds: 0,
    lastProofEvent: null,
    plates: Array.from({ length: 4 }, (_, index) => emptyPlate(index)),
    cartridges: 2,
    rifleRaised: false,
    rifleRevealed: false,
    gunshotFired: false,
    brookResponse: null,
    shotCount: 0,
    bodyMargin: 1,
    failed: false,
    failureCause: null,
    contactCount: 0,
    remainingLight: INITIAL_LIGHT_SECONDS,
    returnRoute: null,
    returnCostSeconds: 0,
    returnStrike: false,
    runStatus: 'active',
    result: null,
  };
}

export function restartPlayer() {
  return createPlayerState();
}

export function setPaused(state, paused, reason = null) {
  return copyState(state, {
    paused,
    pauseReason: paused ? reason : null,
    lastEvent: paused ? `paused:${reason ?? 'manual'}` : 'resumed',
  });
}

export function zoneForPosition(position, reachedGlade = false) {
  if (position.z >= 62) return 'fort';
  if (position.z >= 34) return 'brook-blind';
  if (position.z <= 3) return 'iguanodon-glade';
  if (reachedGlade) return position.x < 3 ? 'covered-return' : 'exposed-creek';
  return position.x < 3 ? 'canopy-overlook' : 'basalt-shelf';
}

export function examine(state) {
  if (state.paused || state.failed || state.pendingExposure) return copyState(state);
  if (state.zone === 'brook-blind') {
    return copyState(state, {
      examinedTrack: true,
      lastObservation: 'Three toes. Fresh. The brook runs back to camp.',
      lastEvent: 'examined:track',
    });
  }
  if (state.zone === 'iguanodon-glade') {
    return copyState(state, {
      observedBehavior: true,
      lastObservation: 'The young keep close while the adults feed.',
      lastEvent: 'examined:behavior',
    });
  }
  return copyState(state, { lastEvent: 'examine:no-trace' });
}

export function frameForState(state) {
  const frames = {
    fort: {
      key: 'empty-fort', points: 0, label: 'EMPTY — no living subject in frame.', exposure: 0,
    },
    'brook-blind': state.examinedTrack
      ? { key: 'brook-partial', points: 1, label: 'PARTIAL — foliage hides the flank.', exposure: 1 }
      : { key: 'brook-unread', points: 0, label: 'UNCLEAR — the track has not been read.', exposure: 1 },
    'canopy-overlook': {
      key: 'canopy-flank', points: 1, label: 'FORM — a full flank clears the fern.', exposure: 1,
    },
    'basalt-shelf': {
      key: 'basalt-scale', points: 2, label: 'CONTEXT — basalt gives scale.', exposure: 2,
    },
    'iguanodon-glade': state.observedBehavior
      ? { key: 'glade-behavior', points: 2, label: 'BEHAVIOR — young play beside the adults.', exposure: 2 }
      : { key: 'glade-form', points: 1, label: 'FORM — the family stands clear.', exposure: 2 },
    'covered-return': {
      key: 'return-occluded', points: 1, label: 'PARTIAL — thorn hides the body.', exposure: 1,
    },
    'exposed-creek': {
      key: 'creek-scale', points: 2, label: 'CONTEXT — the open creek gives scale.', exposure: 2,
    },
  };
  return { ...frames[state.zone] };
}

export function intactEvidence(state) {
  return state.plates.reduce(
    (total, plate) => total + (plate.status === 'exposed' ? plate.points : 0),
    0,
  );
}

export function resultBandForEvidence(points) {
  const bounded = Math.max(0, Math.min(7, points));
  return RESULT_BANDS.find((band) => bounded >= band.min && bounded <= band.max);
}

export function setCameraRaised(state, raised) {
  if (state.pendingExposure) return copyState(state, { cameraRaised: true, rifleRaised: false });
  const canRaise = !state.paused
    && !state.failed
    && state.plates.some((plate) => plate.status === 'unexposed');
  const cameraRaised = Boolean(raised && canRaise);
  return copyState(state, {
    cameraRaised,
    plateRailRevealed: state.plateRailRevealed || cameraRaised,
    rifleRaised: cameraRaised ? false : state.rifleRaised,
    lastEvent: cameraRaised ? 'camera:raised' : state.lastEvent,
  });
}

export function startExposure(state) {
  if (state.paused || state.failed || !state.cameraRaised || state.pendingExposure) {
    return copyState(state);
  }
  const plateIndex = state.plates.findIndex((plate) => plate.status === 'unexposed');
  if (plateIndex < 0) return copyState(state, { cameraRaised: false, lastEvent: 'camera:no-plates' });
  return copyState(state, {
    pendingExposure: {
      ...frameForState(state),
      plateIndex,
      remainingSeconds: EXPOSURE_SECONDS,
      zone: state.zone,
    },
    previewSeconds: 0,
    rifleRaised: false,
    lastEvent: 'camera:shutter-commit',
  });
}

export function setRifleRaised(state, raised) {
  const rifleRaised = Boolean(
    raised && !state.paused && !state.failed && !state.pendingExposure && state.cartridges > 0,
  );
  return copyState(state, {
    rifleRaised,
    rifleRevealed: state.rifleRevealed || rifleRaised,
    cameraRaised: rifleRaised ? false : state.cameraRaised,
    lastEvent: rifleRaised ? 'rifle:raised' : state.lastEvent,
  });
}

export function fireDefensiveShot(state) {
  if (state.paused || state.failed || state.pendingExposure || !state.rifleRaised || state.cartridges <= 0) {
    return copyState(state);
  }
  const interrupted = state.threatAwareness === 3;
  const awareness = interrupted ? Math.max(0, state.threatAwareness - 2) : state.threatAwareness;
  return copyState(state, {
    cartridges: state.cartridges - 1,
    rifleRaised: false,
    rifleRevealed: true,
    gunshotFired: true,
    brookResponse: 'answering-call',
    shotCount: state.shotCount + 1,
    threatAwareness: awareness,
    threatState: THREAT_STATES[awareness],
    attackSeconds: 0,
    lastThreatEvent: interrupted ? 'defensive-shot-interrupt' : 'defensive-shot-missed-window',
    lastEvent: interrupted ? 'rifle:interrupt' : 'rifle:missed-window',
  });
}

function highestValueIntactPlateIndex(plates) {
  let best = -1;
  let bestPoints = -1;
  plates.forEach((plate, index) => {
    if (plate.status === 'exposed' && plate.points > bestPoints) {
      best = index;
      bestPoints = plate.points;
    }
  });
  return best;
}

export function applyThreatContact(state) {
  if (state.failed) return copyState(state);
  if (state.bodyMargin <= 0) {
    return copyState(state, {
      failed: true,
      failureCause: 'second-unblocked-strike',
      runStatus: 'failure',
      result: {
        kind: 'failure',
        cause: 'second-unblocked-strike',
        title: 'The second pass',
        copy: 'The second pass found you in open ground.',
        cue: 'Break the dive under the trees, or fire before contact.',
      },
      rifleRaised: false,
      cameraRaised: false,
      pendingExposure: null,
      attackSeconds: 0,
      contactCount: state.contactCount + 1,
      lastThreatEvent: 'second-contact-failure',
      lastEvent: 'failure:second-contact',
    });
  }

  const plates = state.plates.map(clonePlate);
  const crackedIndex = highestValueIntactPlateIndex(plates);
  if (crackedIndex >= 0) {
    plates[crackedIndex] = {
      ...plates[crackedIndex],
      status: 'cracked',
      lostPoints: plates[crackedIndex].points,
      points: 0,
    };
  }
  return copyState(state, {
    plates,
    bodyMargin: 0,
    cameraRaised: false,
    pendingExposure: null,
    attackSeconds: 0,
    contactCount: state.contactCount + 1,
    threatAwareness: 1,
    threatState: 'watch',
    lastThreatEvent: 'contact-recovered',
    lastEvent: crackedIndex >= 0 ? `contact:plate-${crackedIndex + 1}-cracked` : 'contact:body-margin',
  });
}

function crackHighestValuePlate(state) {
  const plates = state.plates.map(clonePlate);
  const crackedIndex = highestValueIntactPlateIndex(plates);
  if (crackedIndex >= 0) {
    plates[crackedIndex] = {
      ...plates[crackedIndex],
      status: 'cracked',
      lostPoints: plates[crackedIndex].points,
      points: 0,
    };
  }
  return { plates, crackedIndex };
}

function commitReturnRoute(state, zone) {
  if (state.returnRoute || !state.reachedGlade) return state;
  if (zone !== 'covered-return' && zone !== 'exposed-creek') return state;

  const route = zone === 'covered-return' ? 'covered' : 'exposed';
  const cost = route === 'covered' ? 28 : state.gunshotFired ? 18 : 12;
  let next = copyState(state, {
    returnRoute: route,
    returnCostSeconds: cost,
    remainingLight: Math.max(0, state.remainingLight - cost),
    lastEvent: `return:${route}:committed`,
    brookResponse: route === 'exposed' && state.gunshotFired ? 'brush-moving' : state.brookResponse,
  });

  if (route === 'exposed' && state.threatAwareness === 3 && !state.gunshotFired) {
    const strike = crackHighestValuePlate(next);
    next = copyState(next, {
      plates: strike.plates,
      returnStrike: true,
      attackSeconds: 0,
      threatAwareness: 1,
      threatState: 'watch',
      lastThreatEvent: 'exposed-return-case-strike',
      lastEvent: strike.crackedIndex >= 0
        ? `return:plate-${strike.crackedIndex + 1}-cracked`
        : 'return:case-strike-empty',
    });
  }
  return next;
}

function submitAtFort(state) {
  const evidence = intactEvidence(state);
  const band = resultBandForEvidence(evidence);
  return copyState(state, {
    runStatus: 'result',
    cameraRaised: false,
    rifleRaised: false,
    pendingExposure: null,
    result: {
      kind: 'alive',
      band: band.key,
      title: band.title,
      copy: band.copy,
      evidence,
      survivingPlates: state.plates.filter((plate) => plate.status === 'exposed').length,
      route: state.returnRoute,
      brookResponse: state.brookResponse,
      remainingLight: Number(state.remainingLight.toFixed(1)),
      gunshotCallback: state.gunshotFired
        ? 'The report carried. Something answered by the brook.'
        : null,
    },
    lastEvent: `result:${band.key}`,
  });
}

function failForTimeout(state) {
  return copyState(state, {
    failed: true,
    failureCause: 'remaining-light-expired',
    runStatus: 'failure',
    cameraRaised: false,
    rifleRaised: false,
    pendingExposure: null,
    result: {
      kind: 'failure',
      cause: 'remaining-light-expired',
      title: 'The basin went dark',
      copy: 'The basin went dark. The brook was no longer enough.',
      cue: 'Leave the last frame, or take the shorter return while it is still usable.',
    },
    lastEvent: 'failure:remaining-light-expired',
  });
}

function insideBounds(position) {
  const { bounds, playerRadius } = NAVIGATION;
  return (
    position.x >= bounds.minX + playerRadius
    && position.x <= bounds.maxX - playerRadius
    && position.z >= bounds.minZ + playerRadius
    && position.z <= bounds.maxZ - playerRadius
  );
}

function obstacleAt(position) {
  const radius = NAVIGATION.playerRadius;
  return NAVIGATION.obstacles.find((obstacle) => {
    if (obstacle.type === 'circle') {
      return Math.hypot(position.x - obstacle.x, position.z - obstacle.z) < obstacle.radius + radius;
    }
    return (
      position.x > obstacle.minX - radius
      && position.x < obstacle.maxX + radius
      && position.z > obstacle.minZ - radius
      && position.z < obstacle.maxZ + radius
    );
  });
}

function updateThreatState(state, zone, stance, deltaSeconds, travelled) {
  const entered = zone !== state.zone;
  const inCover = zone === 'canopy-overlook' || zone === 'covered-return';
  let awareness = state.threatAwareness;
  let coverSeconds = inCover ? state.coverSeconds + deltaSeconds : 0;
  const sprintExposureSeconds = stance === 'sprint' && travelled > 0 && (zone === 'basalt-shelf' || zone === 'exposed-creek')
    ? state.sprintExposureSeconds + deltaSeconds
    : 0;
  let sprintEscalationCharged = state.sprintEscalationCharged;
  let event = state.lastThreatEvent;

  if (entered && (zone === 'canopy-overlook' || zone === 'basalt-shelf')) {
    awareness = Math.max(awareness, 1);
    event = 'territory-watch';
  }
  if (entered && zone === 'iguanodon-glade') {
    awareness = Math.max(awareness, 2);
    event = 'glade-search';
  }
  if (sprintExposureSeconds >= 1 && !sprintEscalationCharged) {
    awareness = Math.min(3, awareness + 1);
    sprintEscalationCharged = true;
    event = 'exposed-sprint';
  }
  if (stance !== 'sprint' || inCover) sprintEscalationCharged = false;
  if (coverSeconds >= 6) {
    awareness = Math.max(0, awareness - 1);
    coverSeconds -= 6;
    event = 'cover-deescalation';
  }

  return {
    awareness,
    threatState: THREAT_STATES[awareness],
    inCover,
    coverSeconds,
    sprintExposureSeconds,
    sprintEscalationCharged,
    event,
  };
}

function resolveObstacleMovement(position, delta) {
  const full = { x: position.x + delta.x, z: position.z + delta.z };
  const hit = obstacleAt(full);
  if (!hit) return { position: full, collision: null };

  const xOnly = { x: position.x + delta.x, z: position.z };
  if (Math.abs(delta.x) > 1e-8 && !obstacleAt(xOnly)) {
    return { position: xOnly, collision: hit.id };
  }
  const zOnly = { x: position.x, z: position.z + delta.z };
  if (Math.abs(delta.z) > 1e-8 && !obstacleAt(zOnly)) {
    return { position: zOnly, collision: hit.id };
  }
  return { position: clonePosition(position), collision: hit.id };
}

function finalizeExposure(state, pending, threat) {
  const plates = state.plates.map(clonePlate);
  plates[pending.plateIndex] = {
    ...plates[pending.plateIndex],
    status: 'exposed',
    points: pending.points,
    label: pending.label,
    frameKey: pending.key,
  };
  const awareness = Math.min(3, threat.awareness + pending.exposure);
  return {
    plates,
    pendingExposure: null,
    previewSeconds: 4,
    cameraRaised: false,
    threatAwareness: awareness,
    threatState: THREAT_STATES[awareness],
    lastThreatEvent: pending.exposure > 0 ? `plate-exposure:+${pending.exposure}` : threat.event,
    lastProofEvent: {
      plateIndex: pending.plateIndex,
      frameKey: pending.key,
      points: pending.points,
      label: pending.label,
      zone: pending.zone,
    },
    lastEvent: `plate:${pending.plateIndex + 1}:exposed`,
  };
}

export function stepPlayer(state, input = {}, rawDeltaSeconds = 0) {
  const deltaSeconds = Math.max(0, Math.min(rawDeltaSeconds, 1));
  if (state.paused || state.runStatus !== 'active') return copyState(state);

  const heading = Number.isFinite(input.heading) ? input.heading : state.heading;
  const pitch = Number.isFinite(input.pitch) ? input.pitch : state.pitch;
  const forward = Math.max(-1, Math.min(1, input.forward ?? 0));
  const right = Math.max(-1, Math.min(1, input.right ?? 0));
  const magnitude = Math.hypot(forward, right);
  const normalizedForward = magnitude > 1 ? forward / magnitude : forward;
  const normalizedRight = magnitude > 1 ? right / magnitude : right;
  const stance = input.crouch ? 'crouch' : input.sprint ? 'sprint' : 'walk';
  const toolMultiplier = state.pendingExposure ? 0 : state.cameraRaised ? 0.35 : 1;
  const distance = SPEED[stance] * toolMultiplier * deltaSeconds;
  const delta = {
    x: (Math.sin(heading) * normalizedForward + Math.cos(heading) * normalizedRight) * distance,
    z: (-Math.cos(heading) * normalizedForward + Math.sin(heading) * normalizedRight) * distance,
  };
  const full = { x: state.position.x + delta.x, z: state.position.z + delta.z };

  let resolved;
  let boundaryRecovered = false;
  if (!insideBounds(full)) {
    resolved = { position: clonePosition(state.lastStablePosition), collision: null };
    boundaryRecovered = true;
  } else {
    resolved = resolveObstacleMovement(state.position, delta);
  }
  const travelled = Math.hypot(
    resolved.position.x - state.position.x,
    resolved.position.z - state.position.z,
  );
  const reachedGlade = state.reachedGlade || resolved.position.z <= 3;
  const zone = zoneForPosition(resolved.position, reachedGlade);
  const threat = updateThreatState(state, zone, stance, deltaSeconds, travelled);
  const zoneHistory = zone === state.zone ? [...state.zoneHistory] : [...state.zoneHistory, zone];
  const pendingExposure = state.pendingExposure
    ? { ...state.pendingExposure, remainingSeconds: Math.max(0, state.pendingExposure.remainingSeconds - deltaSeconds) }
    : null;
  let next = copyState(state, {
    position: clonePosition(resolved.position),
    lastStablePosition: clonePosition(resolved.position),
    heading,
    pitch,
    stance,
    elapsedSeconds: state.elapsedSeconds + deltaSeconds,
    remainingLight: Math.max(0, state.remainingLight - deltaSeconds),
    distanceTravelled: state.distanceTravelled + travelled,
    boundaryRecoveries: state.boundaryRecoveries + (boundaryRecovered ? 1 : 0),
    collisions: state.collisions + (resolved.collision ? 1 : 0),
    lastEvent: boundaryRecovered
      ? 'boundary-recovery'
      : resolved.collision
        ? `collision:${resolved.collision}`
        : travelled > 0 ? 'movement' : state.lastEvent === 'clean-start' ? 'idle' : state.lastEvent,
    zone,
    zoneHistory,
    reachedGlade,
    inCover: threat.inCover,
    coverSeconds: threat.coverSeconds,
    sprintExposureSeconds: threat.sprintExposureSeconds,
    sprintEscalationCharged: threat.sprintEscalationCharged,
    threatAwareness: threat.awareness,
    threatState: threat.threatState,
    lastThreatEvent: threat.event,
    pendingExposure,
    previewSeconds: Math.max(0, state.previewSeconds - deltaSeconds),
  });

  if (pendingExposure && pendingExposure.remainingSeconds <= 0) {
    next = copyState(next, finalizeExposure(next, pendingExposure, threat));
  }

  next = commitReturnRoute(next, zone);
  if (zone === 'fort' && next.returnRoute) return submitAtFort(next);
  if (next.remainingLight <= 0 && zone !== 'fort') return failForTimeout(next);

  const attackSeconds = next.threatAwareness === 3 && !next.inCover
    ? next.attackSeconds + deltaSeconds
    : 0;
  next.attackSeconds = attackSeconds;
  if (attackSeconds >= CONTACT_SECONDS) next = applyThreatContact(next);
  return next;
}
