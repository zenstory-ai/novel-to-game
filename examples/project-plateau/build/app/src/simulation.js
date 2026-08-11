import { planarAxesForHeading } from './controller.js';
import {
  NAVIGATION_BOUNDS,
  NON_SOLID_COLLISION_POLICY,
  PLAYER_CAPSULE,
  STATIC_COLLIDERS,
} from './collision-layout.js';
import { terrainHeight } from './terrain.js';

export const INITIAL_PLAYER = Object.freeze({
  position: Object.freeze({ x: 3, z: 70 }),
  groundY: terrainHeight(3, 70),
  heading: 0,
  pitch: 0,
});

export const NAVIGATION = Object.freeze({
  bounds: NAVIGATION_BOUNDS,
  playerRadius: PLAYER_CAPSULE.radius,
  playerCapsule: PLAYER_CAPSULE,
  obstacles: STATIC_COLLIDERS,
  nonSolidPolicy: NON_SOLID_COLLISION_POLICY,
});

export const EXPOSURE_SECONDS = 2;
export const CONTACT_SECONDS = 3;
export const INITIAL_LIGHT_SECONDS = 180;
export const JUMP = Object.freeze({ speed: 5.8, gravity: 15 });

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
const ACCELERATION = Object.freeze({ walk: 18, sprint: 18, crouch: 16 });
const DECELERATION = 18;
const REVERSAL_ACCELERATION = 30;
const FIXED_MOVEMENT_STEP = 1 / 60;
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
    velocity: clonePosition(state.velocity ?? { x: 0, z: 0 }),
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
    groundY: INITIAL_PLAYER.groundY,
    verticalOffset: 0,
    verticalVelocity: 0,
    grounded: true,
    velocity: { x: 0, z: 0 },
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
    velocity: paused ? { x: 0, z: 0 } : clonePosition(state.velocity),
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
  const hasYoungPlay = state.plates.some((plate) => (
    plate.frameKey === 'glade-young-play' || plate.frameKey === 'glade-behavior'
  ));
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
      ? hasYoungPlay
        ? { key: 'glade-branch-pull', points: 2, label: 'BEHAVIOR — an adult pulls the branch down.', exposure: 2 }
        : { key: 'glade-young-play', points: 2, label: 'BEHAVIOR — young play beside the adults.', exposure: 2 }
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
    velocity: { x: 0, z: 0 },
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

export function releaseTransientTools(state) {
  return copyState(state, {
    rifleRaised: false,
    cameraRaised: Boolean(state.pendingExposure),
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

function verticalRangesOverlap(position, obstacle, explicitPlayerBottom = null) {
  const playerBottom = Number.isFinite(explicitPlayerBottom)
    ? explicitPlayerBottom
    : terrainHeight(position.x, position.z);
  const playerTop = playerBottom + PLAYER_CAPSULE.height;
  const obstacleBottom = terrainHeight(obstacle.x, obstacle.z) + obstacle.baseOffset;
  const obstacleTop = obstacleBottom + obstacle.height;
  return playerBottom < obstacleTop && playerTop > obstacleBottom;
}

function localPoint(position, obstacle) {
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  const dx = position.x - obstacle.x;
  const dz = position.z - obstacle.z;
  return {
    x: cosine * dx - sine * dz,
    z: sine * dx + cosine * dz,
  };
}

function worldPoint(position, obstacle) {
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    x: obstacle.x + cosine * position.x + sine * position.z,
    z: obstacle.z - sine * position.x + cosine * position.z,
  };
}

export function collisionAt(position, playerBottom = null) {
  const radius = PLAYER_CAPSULE.radius;
  return STATIC_COLLIDERS.find((obstacle) => {
    if (!verticalRangesOverlap(position, obstacle, playerBottom)) return false;
    if (obstacle.type === 'circle') {
      return Math.hypot(position.x - obstacle.x, position.z - obstacle.z)
        < obstacle.radius + radius - 1e-7;
    }
    const local = localPoint(position, obstacle);
    if (obstacle.type === 'horizontal-capsule') {
      const closestX = Math.max(-obstacle.halfLength, Math.min(obstacle.halfLength, local.x));
      return Math.hypot(local.x - closestX, local.z) < obstacle.radius + radius - 1e-7;
    }
    return (
      Math.abs(local.x) < obstacle.halfX + radius - 1e-7
      && Math.abs(local.z) < obstacle.halfZ + radius - 1e-7
    );
  }) ?? null;
}

function separateCircle(position, previous, obstacle, playerBottom = null) {
  if (!verticalRangesOverlap(position, obstacle, playerBottom)) return null;
  const requiredDistance = obstacle.radius + PLAYER_CAPSULE.radius;
  const dx = position.x - obstacle.x;
  const dz = position.z - obstacle.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= requiredDistance - 1e-7) return null;
  let normalX = dx;
  let normalZ = dz;
  if (distance <= 1e-8) {
    normalX = previous.x - obstacle.x;
    normalZ = previous.z - obstacle.z;
    const previousDistance = Math.hypot(normalX, normalZ);
    if (previousDistance <= 1e-8) {
      normalX = 1;
      normalZ = 0;
    } else {
      normalX /= previousDistance;
      normalZ /= previousDistance;
    }
  } else {
    normalX /= distance;
    normalZ /= distance;
  }
  return {
    position: {
      x: obstacle.x + normalX * requiredDistance,
      z: obstacle.z + normalZ * requiredDistance,
    },
    normal: { x: normalX, z: normalZ },
  };
}

function separateOrientedBox(position, previous, obstacle, playerBottom = null) {
  if (!verticalRangesOverlap(position, obstacle, playerBottom)) return null;
  const local = localPoint(position, obstacle);
  const previousLocal = localPoint(previous, obstacle);
  const halfX = obstacle.halfX + PLAYER_CAPSULE.radius;
  const halfZ = obstacle.halfZ + PLAYER_CAPSULE.radius;
  if (Math.abs(local.x) >= halfX - 1e-7 || Math.abs(local.z) >= halfZ - 1e-7) return null;
  const xPenetration = halfX - Math.abs(local.x);
  const zPenetration = halfZ - Math.abs(local.z);
  const resolved = { ...local };
  let localNormal;
  if (xPenetration <= zPenetration) {
    const sign = Math.sign(local.x) || Math.sign(previousLocal.x) || 1;
    resolved.x = sign * halfX;
    localNormal = { x: sign, z: 0 };
  } else {
    const sign = Math.sign(local.z) || Math.sign(previousLocal.z) || 1;
    resolved.z = sign * halfZ;
    localNormal = { x: 0, z: sign };
  }
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    position: worldPoint(resolved, obstacle),
    normal: {
      x: cosine * localNormal.x + sine * localNormal.z,
      z: -sine * localNormal.x + cosine * localNormal.z,
    },
  };
}

function separateHorizontalCapsule(position, previous, obstacle, playerBottom = null) {
  if (!verticalRangesOverlap(position, obstacle, playerBottom)) return null;
  const local = localPoint(position, obstacle);
  const previousLocal = localPoint(previous, obstacle);
  const closestX = Math.max(-obstacle.halfLength, Math.min(obstacle.halfLength, local.x));
  const requiredDistance = obstacle.radius + PLAYER_CAPSULE.radius;
  let normalX = local.x - closestX;
  let normalZ = local.z;
  const distance = Math.hypot(normalX, normalZ);
  if (distance >= requiredDistance - 1e-7) return null;
  if (distance <= 1e-8) {
    const previousClosestX = Math.max(
      -obstacle.halfLength,
      Math.min(obstacle.halfLength, previousLocal.x),
    );
    normalX = previousLocal.x - previousClosestX;
    normalZ = previousLocal.z;
    const previousDistance = Math.hypot(normalX, normalZ);
    if (previousDistance <= 1e-8) {
      normalX = 0;
      normalZ = 1;
    } else {
      normalX /= previousDistance;
      normalZ /= previousDistance;
    }
  } else {
    normalX /= distance;
    normalZ /= distance;
  }
  const resolvedLocal = {
    x: closestX + normalX * requiredDistance,
    z: normalZ * requiredDistance,
  };
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    position: worldPoint(resolvedLocal, obstacle),
    normal: {
      x: cosine * normalX + sine * normalZ,
      z: -sine * normalX + cosine * normalZ,
    },
  };
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

export function resolveObstacleStep(position, delta, options = {}) {
  let resolved = { x: position.x + delta.x, z: position.z + delta.z };
  const currentGround = terrainHeight(position.x, position.z);
  const desiredGround = terrainHeight(resolved.x, resolved.z);
  if (!options.airborne && Math.abs(desiredGround - currentGround) > PLAYER_CAPSULE.maximumGroundStep) {
    return { position: clonePosition(position), collision: 'terrain-step', normal: null };
  }
  const playerBottom = Number.isFinite(options.playerBottom) ? options.playerBottom : null;

  let collision = null;
  let normal = null;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    let separated = false;
    for (const obstacle of STATIC_COLLIDERS) {
      const result = obstacle.type === 'circle'
        ? separateCircle(resolved, position, obstacle, playerBottom)
        : obstacle.type === 'horizontal-capsule'
          ? separateHorizontalCapsule(resolved, position, obstacle, playerBottom)
          : separateOrientedBox(resolved, position, obstacle, playerBottom);
      if (!result) continue;
      resolved = result.position;
      collision ??= obstacle.id;
      normal = result.normal;
      separated = true;
    }
    if (!separated) break;
  }
  return { position: resolved, collision, normal };
}

function moveTowardsVector(current, target, maximumDelta) {
  const difference = { x: target.x - current.x, z: target.z - current.z };
  const distance = Math.hypot(difference.x, difference.z);
  if (distance <= maximumDelta || distance <= 1e-12) return clonePosition(target);
  const scale = maximumDelta / distance;
  return {
    x: current.x + difference.x * scale,
    z: current.z + difference.z * scale,
  };
}

function integrateMovement(state, targetVelocity, response, deltaSeconds, jumpRequested) {
  const stepCount = Math.max(1, Math.ceil(deltaSeconds / FIXED_MOVEMENT_STEP));
  const stepSeconds = deltaSeconds / stepCount;
  let position = clonePosition(state.position);
  let velocity = clonePosition(state.velocity ?? { x: 0, z: 0 });
  let travelled = 0;
  let collision = null;
  let boundaryRecovered = false;
  let groundY = Number.isFinite(state.groundY)
    ? state.groundY
    : terrainHeight(position.x, position.z);
  let verticalOffset = Math.max(0, Number(state.verticalOffset) || 0);
  let verticalVelocity = Number(state.verticalVelocity) || 0;
  let grounded = state.grounded ?? verticalOffset <= 1e-8;
  let worldFootY = groundY + verticalOffset;
  let jumped = false;
  let landed = false;

  const initialRecovery = resolveObstacleStep(position, { x: 0, z: 0 }, {
    playerBottom: worldFootY,
    airborne: !grounded,
  });
  if (initialRecovery.collision) {
    position = initialRecovery.position;
    velocity = { x: 0, z: 0 };
    collision = initialRecovery.collision;
    groundY = terrainHeight(position.x, position.z);
    if (grounded) worldFootY = groundY;
  }

  for (let step = 0; step < stepCount; step += 1) {
    if (jumpRequested && grounded) {
      verticalVelocity = JUMP.speed;
      grounded = false;
      jumped = true;
    }
    jumpRequested = false;

    let nextFootY = worldFootY;
    if (!grounded) {
      nextFootY += verticalVelocity * stepSeconds - 0.5 * JUMP.gravity * stepSeconds ** 2;
      verticalVelocity -= JUMP.gravity * stepSeconds;
    }
    velocity = moveTowardsVector(velocity, targetVelocity, response * stepSeconds);
    const delta = { x: velocity.x * stepSeconds, z: velocity.z * stepSeconds };
    const full = { x: position.x + delta.x, z: position.z + delta.z };
    if (!insideBounds(full)) {
      position = clonePosition(state.lastStablePosition);
      velocity = { x: 0, z: 0 };
      boundaryRecovered = true;
      groundY = terrainHeight(position.x, position.z);
      if (grounded || nextFootY <= groundY) {
        grounded = true;
        verticalVelocity = 0;
        worldFootY = groundY;
      } else {
        worldFootY = nextFootY;
      }
      break;
    }
    const desiredGround = terrainHeight(full.x, full.z);
    const resolved = resolveObstacleStep(position, delta, {
      playerBottom: grounded ? desiredGround : nextFootY,
      airborne: !grounded,
    });
    const actual = {
      x: resolved.position.x - position.x,
      z: resolved.position.z - position.z,
    };
    if (resolved.collision) {
      velocity = {
        x: actual.x / stepSeconds,
        z: actual.z / stepSeconds,
      };
      const speed = Math.hypot(velocity.x, velocity.z);
      const requestedSpeed = Math.hypot(targetVelocity.x, targetVelocity.z);
      if (speed > requestedSpeed && speed > 1e-8) {
        const scale = requestedSpeed / speed;
        velocity.x *= scale;
        velocity.z *= scale;
      }
    }
    travelled += Math.hypot(actual.x, actual.z);
    position = resolved.position;
    collision ??= resolved.collision;
    groundY = terrainHeight(position.x, position.z);
    if (grounded) {
      worldFootY = groundY;
      verticalVelocity = 0;
    } else if (nextFootY <= groundY) {
      worldFootY = groundY;
      verticalVelocity = 0;
      grounded = true;
      landed = true;
    } else {
      worldFootY = nextFootY;
    }
  }

  verticalOffset = grounded ? 0 : Math.max(0, worldFootY - groundY);

  return {
    position,
    groundY,
    verticalOffset,
    verticalVelocity,
    grounded,
    velocity,
    travelled,
    collision,
    boundaryRecovered,
    jumped,
    landed,
  };
}

export function collisionContractSnapshot() {
  const categories = {};
  for (const collider of STATIC_COLLIDERS) {
    categories[collider.category] = (categories[collider.category] ?? 0) + 1;
  }
  return {
    model: 'vertical-capsule-on-heightfield-with-ballistic-jump',
    broadPhase: 'authored-static-collider-list',
    resolution: 'iterative-depenetration-with-surface-slide',
    fixedMovementStepSeconds: FIXED_MOVEMENT_STEP,
    jump: {
      speed: JUMP.speed,
      gravity: JUMP.gravity,
      restrictedByTools: true,
    },
    capsule: { ...PLAYER_CAPSULE },
    navigationBounds: { ...NAVIGATION_BOUNDS },
    colliderCount: STATIC_COLLIDERS.length,
    categories,
    nonSolidPolicy: NON_SOLID_COLLISION_POLICY,
  };
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
  const axes = planarAxesForHeading(heading);
  const targetSpeed = SPEED[stance] * toolMultiplier;
  const targetVelocity = {
    x: (axes.forward.x * normalizedForward + axes.right.x * normalizedRight) * targetSpeed,
    z: (axes.forward.z * normalizedForward + axes.right.z * normalizedRight) * targetSpeed,
  };
  const velocity = state.velocity ?? { x: 0, z: 0 };
  const reversing = (velocity.x * targetVelocity.x + velocity.z * targetVelocity.z) < 0;
  const response = magnitude <= 1e-8
    ? DECELERATION
    : reversing ? REVERSAL_ACCELERATION : ACCELERATION[stance];
  const resolved = integrateMovement(
    state,
    targetVelocity,
    state.pendingExposure ? Number.POSITIVE_INFINITY : response,
    deltaSeconds,
    Boolean(
      input.jump
      && state.grounded
      && !input.crouch
      && !state.cameraRaised
      && !state.rifleRaised
      && !state.pendingExposure
    ),
  );
  const travelled = resolved.travelled;
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
    groundY: resolved.groundY,
    verticalOffset: resolved.verticalOffset,
    verticalVelocity: resolved.verticalVelocity,
    grounded: resolved.grounded,
    velocity: clonePosition(resolved.velocity),
    heading,
    pitch,
    stance,
    elapsedSeconds: state.elapsedSeconds + deltaSeconds,
    remainingLight: Math.max(0, state.remainingLight - deltaSeconds),
    distanceTravelled: state.distanceTravelled + travelled,
    boundaryRecoveries: state.boundaryRecoveries + (resolved.boundaryRecovered ? 1 : 0),
    collisions: state.collisions + (resolved.collision ? 1 : 0),
    lastEvent: resolved.boundaryRecovered
      ? 'boundary-recovery'
      : resolved.collision
        ? `collision:${resolved.collision}`
        : resolved.landed
          ? 'land'
          : resolved.jumped
            ? 'jump'
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
