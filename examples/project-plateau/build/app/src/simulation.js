import { planarAxesForHeading } from './controller.js';
import {
  FAMILY_BEHAVIOR_CYCLE_SECONDS,
  MAX_STEADY_DRIFT_RADIANS,
  cameraDriftFromExposure,
  familyMomentForState,
  frameForState,
} from './field-photography.js';
import { integrateMovement } from './simulation-movement.js';
export {
  FAMILY_BEHAVIOR_CYCLE_SECONDS,
  MAX_STEADY_DRIFT_RADIANS,
  familyMomentForState,
  frameForState,
};
export {
  JUMP,
  NAVIGATION,
  collisionAt,
  collisionContractSnapshot,
  resolveObstacleStep,
} from './simulation-movement.js';
import { terrainHeight } from './terrain.js';

export const INITIAL_PLAYER = Object.freeze({
  position: Object.freeze({ x: 3, z: 70 }),
  groundY: terrainHeight(3, 70),
  heading: 0,
  pitch: 0,
});

export const EXPOSURE_SECONDS = 2;
export const CONTACT_SECONDS = 3;
export const INITIAL_LIGHT_SECONDS = 180;
export const ABANDON_HOLD_SECONDS = 0.8;
export const RETURN_ROUTE_SECONDS = Object.freeze({
  covered: 28,
  exposed: 12,
  exposedAfterShot: 18,
  abandoned: 8,
});
export const ABANDONED_RECORD_COPY = 'The case stayed in the basin. The plates stayed with it.';
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
    key: 'strong-field-record', min: 6, max: 8,
    title: 'Strong field record',
    copy: 'Scale. Living form. Behavior. The field record holds.',
  }),
]);

const SPEED = Object.freeze({ walk: 4.2, sprint: 6.8, crouch: 2.2 });
const ACCELERATION = Object.freeze({ walk: 18, sprint: 18, crouch: 16 });
const DECELERATION = 18;
const REVERSAL_ACCELERATION = 30;
const KEYBOARD_LOOK_RADIANS_PER_SECOND = Object.freeze({ horizontal: 1.2, vertical: 1 });
const CROUCH_COVER_RECOVERY_MULTIPLIER = 1.8;
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
    sourceFrameKey: null,
    stability: null,
    composition: null,
    subject: null,
    behavior: null,
    recoverable: true,
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
    familyBehaviorSeconds: 0,
    familyMoment: 'glade-routine',
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
    caseAbandoned: false,
    caseDropPosition: null,
    abandonHoldSeconds: 0,
    abandonedPlates: 0,
    abandonedEvidence: 0,
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
      familyBehaviorSeconds: 0,
      familyMoment: 'glade-routine',
      lastObservation: 'The young shift first. The feeding adult reaches after them.',
      lastEvent: 'examined:behavior',
    });
  }
  return copyState(state, { lastEvent: 'examine:no-trace' });
}

export function intactEvidence(state) {
  if (state.caseAbandoned) return 0;
  return state.plates.reduce(
    (total, plate) => total + (plate.status === 'exposed' ? plate.points : 0),
    0,
  );
}

export function abandonAvailable(state) {
  return state.runStatus === 'active' && !state.paused && !state.failed && !state.caseAbandoned;
}

export function abandonPromptDue(state) {
  return abandonAvailable(state)
    && state.reachedGlade
    && !state.returnRoute
    && state.remainingLight < RETURN_ROUTE_SECONDS.covered;
}

export function resultBandForEvidence(points) {
  const bounded = Math.max(0, Math.min(8, points));
  return RESULT_BANDS.find((band) => bounded >= band.min && bounded <= band.max);
}

export function setCameraRaised(state, raised) {
  if (state.pendingExposure) return copyState(state, { cameraRaised: true, rifleRaised: false });
  const canRaise = !state.paused
    && !state.failed
    && !state.caseAbandoned
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
      startHeading: state.heading,
      startPitch: state.pitch,
      maxCameraDrift: 0,
      braced: state.stance === 'crouch' || state.inCover,
      driftLimit: MAX_STEADY_DRIFT_RADIANS * ((state.stance === 'crouch' || state.inCover) ? 1.8 : 1),
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
  // With the case left in the basin there is no case strapped to the scout to strike.
  const crackedIndex = state.caseAbandoned ? -1 : highestValueIntactPlateIndex(plates);
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

const PLATE_COUNT_WORDS = Object.freeze(['No', 'One', 'Two', 'Three', 'Four']);

function commitCaseAbandon(state) {
  const abandonedPlates = state.plates.filter((plate) => plate.status === 'exposed').length;
  const abandonedEvidence = state.plates.reduce(
    (total, plate) => total + (plate.status === 'exposed' ? plate.points : 0),
    0,
  );
  // Keep every plate's recorded state; the drop only marks the case unrecoverable.
  const plates = state.plates.map((plate) => ({ ...plate, recoverable: false }));
  return copyState(state, {
    caseAbandoned: true,
    caseDropPosition: clonePosition(state.position),
    plates,
    abandonedPlates,
    abandonedEvidence,
    abandonHoldSeconds: 0,
    cameraRaised: false,
    pendingExposure: null,
    lastObservation: abandonedPlates > 0
      ? `The case is down. ${PLATE_COUNT_WORDS[abandonedPlates]} recorded plate${abandonedPlates === 1 ? ' stays' : 's stay'} in the basin.`
      : 'The case is down. Nothing was exposed on its plates.',
    lastEvent: 'case:abandoned',
  });
}

function commitReturnRoute(state, zone) {
  if (state.returnRoute || !state.reachedGlade) return state;
  if (zone !== 'covered-return' && zone !== 'exposed-creek') return state;

  const route = zone === 'covered-return' ? 'covered' : 'exposed';
  const cost = state.caseAbandoned
    ? RETURN_ROUTE_SECONDS.abandoned
    : route === 'covered'
      ? RETURN_ROUTE_SECONDS.covered
      : state.gunshotFired
        ? RETURN_ROUTE_SECONDS.exposedAfterShot
        : RETURN_ROUTE_SECONDS.exposed;
  let next = copyState(state, {
    returnRoute: route,
    returnCostSeconds: cost,
    remainingLight: Math.max(0, state.remainingLight - cost),
    lastEvent: `return:${route}:committed`,
    brookResponse: route === 'exposed' && state.gunshotFired ? 'brush-moving' : state.brookResponse,
  });

  if (route === 'exposed' && state.threatAwareness === 3 && !state.gunshotFired && !state.caseAbandoned) {
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
  const aerialEvidence = state.plates.some(
    (plate) => plate.status === 'exposed' && plate.behavior === 'predatory-dive',
  );
  const gunshotCallback = state.gunshotFired
    ? 'The report carried. Something answered by the brook.'
    : null;
  return copyState(state, {
    runStatus: 'result',
    cameraRaised: false,
    rifleRaised: false,
    pendingExposure: null,
    result: {
      kind: 'alive',
      band: band.key,
      title: band.title,
      copy: state.caseAbandoned ? ABANDONED_RECORD_COPY : band.copy,
      evidence,
      survivingPlates: state.caseAbandoned
        ? 0
        : state.plates.filter((plate) => plate.status === 'exposed').length,
      route: state.returnRoute,
      brookResponse: state.brookResponse,
      remainingLight: Number(state.remainingLight.toFixed(1)),
      caseAbandoned: state.caseAbandoned,
      abandonedPlates: state.abandonedPlates,
      aerialEvidence,
      gunshotCallback,
      recordCallback: [
        aerialEvidence ? 'The plate fixes the wing at the instant it commits to the dive.' : null,
        gunshotCallback,
      ].filter(Boolean).join(' ') || null,
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

function updateThreatState(state, zone, stance, deltaSeconds, travelled) {
  const entered = zone !== state.zone;
  const inCover = zone === 'canopy-overlook' || zone === 'covered-return';
  let awareness = state.threatAwareness;
  const coverRecoveryRate = stance === 'crouch' ? CROUCH_COVER_RECOVERY_MULTIPLIER : 1;
  let coverSeconds = inCover ? state.coverSeconds + deltaSeconds * coverRecoveryRate : 0;
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

function finalizeExposure(state, pending, threat) {
  const shaken = pending.maxCameraDrift > (pending.driftLimit ?? MAX_STEADY_DRIFT_RADIANS);
  const proof = shaken
    ? {
      key: 'shaken-frame',
      points: pending.points > 0 ? 1 : 0,
      label: 'SMEARED — camera drift erased the decisive detail.',
      composition: 'shaken',
      subject: pending.subject,
      behavior: null,
      stability: 'shaken',
    }
    : { ...pending, stability: 'steady' };
  const plates = state.plates.map(clonePlate);
  plates[pending.plateIndex] = {
    ...plates[pending.plateIndex],
    status: 'exposed',
    points: proof.points,
    label: proof.label,
    frameKey: proof.key,
    sourceFrameKey: pending.key,
    stability: proof.stability,
    composition: proof.composition,
    subject: proof.subject,
    behavior: proof.behavior,
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
      frameKey: proof.key,
      sourceFrameKey: pending.key,
      stability: proof.stability,
      points: proof.points,
      label: proof.label,
      zone: pending.zone,
      composition: proof.composition,
      subject: proof.subject,
      behavior: proof.behavior,
      familyMoment: pending.familyMoment,
    },
    lastEvent: `plate:${pending.plateIndex + 1}:exposed`,
  };
}

export function stepPlayer(state, input = {}, rawDeltaSeconds = 0) {
  const deltaSeconds = Math.max(0, Math.min(rawDeltaSeconds, 1));
  if (state.paused || state.runStatus !== 'active') return copyState(state);

  const heading = (Number.isFinite(input.heading) ? input.heading : state.heading)
    + (input.lookHorizontal ?? 0) * KEYBOARD_LOOK_RADIANS_PER_SECOND.horizontal * deltaSeconds;
  const pitch = Math.max(-1.15, Math.min(
    1.1,
    (Number.isFinite(input.pitch) ? input.pitch : state.pitch)
      + (input.lookVertical ?? 0) * KEYBOARD_LOOK_RADIANS_PER_SECOND.vertical * deltaSeconds,
  ));
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
  const familyBehaviorSeconds = state.observedBehavior && reachedGlade
    ? (state.familyBehaviorSeconds + deltaSeconds) % FAMILY_BEHAVIOR_CYCLE_SECONDS
    : state.familyBehaviorSeconds;
  const familyMoment = familyMomentForState({
    ...state,
    reachedGlade,
    threatAwareness: threat.awareness,
    familyBehaviorSeconds,
  });
  const zoneHistory = zone === state.zone ? [...state.zoneHistory] : [...state.zoneHistory, zone];
  const pendingExposure = state.pendingExposure
    ? {
      ...state.pendingExposure,
      remainingSeconds: Math.max(0, state.pendingExposure.remainingSeconds - deltaSeconds),
      maxCameraDrift: Math.max(
        state.pendingExposure.maxCameraDrift ?? 0,
        cameraDriftFromExposure(state.pendingExposure, heading, pitch),
      ),
    }
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
    familyBehaviorSeconds,
    familyMoment,
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

  // The case release is a held input, not a tap: an accidental touch must never
  // destroy a run's record, and releasing early cancels with no cost.
  const abandonHoldSeconds = input.abandon && !state.caseAbandoned
    ? state.abandonHoldSeconds + deltaSeconds
    : 0;
  next = copyState(next, { abandonHoldSeconds });
  if (abandonHoldSeconds >= ABANDON_HOLD_SECONDS && !next.caseAbandoned) {
    next = commitCaseAbandon(next);
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
