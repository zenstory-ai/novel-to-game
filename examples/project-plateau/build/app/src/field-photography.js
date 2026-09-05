import { FAMILY_LAYOUT, PTERODACTYL_ORBIT_CENTER } from './environment-layout.js';

export const FAMILY_BEHAVIOR_CYCLE_SECONDS = 10;
export const MAX_STEADY_DRIFT_RADIANS = 0.075;

const CLEAR_HEADING_RADIANS = 0.34;
const EDGE_HEADING_RADIANS = 0.68;
const CLEAR_FAMILY_PITCH_RADIANS = 0.38;
const EDGE_FAMILY_PITCH_RADIANS = 0.75;
const DIVE_PITCH_RADIANS = Object.freeze({ min: 0.16, max: 0.68, edgeMin: 0.06, edgeMax: 0.86 });
const DIVE_SECONDS = Object.freeze({ min: 0.5, max: 3 });

const familyCenter = centerOf(FAMILY_LAYOUT);
const youngPlayCenter = centerOf(
  FAMILY_LAYOUT.filter(({ behaviorRole }) => behaviorRole === 'young-play'),
);
const branchPullCenter = centerOf(
  FAMILY_LAYOUT.filter(({ behaviorRole }) => behaviorRole === 'branch-pull'),
);

function centerOf(subjects) {
  const divisor = Math.max(1, subjects.length);
  return Object.freeze({
    x: subjects.reduce((total, subject) => total + subject.x, 0) / divisor,
    z: subjects.reduce((total, subject) => total + subject.z, 0) / divisor,
  });
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function targetHeading(position, target) {
  const deltaX = target.x - position.x;
  const deltaZ = target.z - position.z;
  return Math.atan2(-deltaX, -deltaZ);
}

function horizontalCompositionForTarget(state, target) {
  const error = Math.abs(wrapAngle((state.heading ?? 0) - targetHeading(state.position, target)));
  if (error <= CLEAR_HEADING_RADIANS) return 'clear';
  if (error <= EDGE_HEADING_RADIANS) return 'edge';
  return 'empty';
}

function familyCompositionForTarget(state, target) {
  const horizontal = horizontalCompositionForTarget(state, target);
  const pitchError = Math.abs(state.pitch ?? 0);
  const vertical = pitchError <= CLEAR_FAMILY_PITCH_RADIANS
    ? 'clear'
    : pitchError <= EDGE_FAMILY_PITCH_RADIANS ? 'edge' : 'empty';
  if (horizontal === 'empty' || vertical === 'empty') return 'empty';
  return horizontal === 'edge' || vertical === 'edge' ? 'edge' : 'clear';
}

function hasCaptured(state, frameKey) {
  return state.plates.some(
    (plate) => plate.status === 'exposed'
      && (plate.frameKey === frameKey || plate.sourceFrameKey === frameKey),
  );
}

function downgradeRepeatedHighValueFrame(state, frame) {
  if (frame.points < 2 || !hasCaptured(state, frame.key)) return frame;
  return {
    ...frame,
    key: `${frame.key}-repeat`,
    points: 1,
    label: 'The same telling view is already in the case.',
    behavior: null,
  };
}

function pterodactylFrameForState(state) {
  if (state.threatState !== 'attack'
    || state.attackSeconds < DIVE_SECONDS.min
    || state.attackSeconds >= DIVE_SECONDS.max
    || (state.pitch ?? 0) < DIVE_PITCH_RADIANS.edgeMin) return null;

  const horizontal = horizontalCompositionForTarget(state, PTERODACTYL_ORBIT_CENTER);
  const pitch = state.pitch ?? 0;
  const vertical = pitch >= DIVE_PITCH_RADIANS.min && pitch <= DIVE_PITCH_RADIANS.max
    ? 'clear'
    : pitch <= DIVE_PITCH_RADIANS.edgeMax ? 'edge' : 'empty';
  if (horizontal === 'empty' || vertical === 'empty') {
    return {
      key: 'empty-sky', points: 0, label: 'The dive passed beyond the edge of the plate.', exposure: 0,
      composition: 'empty', subject: null, behavior: null, familyMoment: familyMomentForState(state),
    };
  }
  const composition = horizontal === 'edge' || vertical === 'edge' ? 'edge' : 'clear';
  if (composition === 'edge') {
    return {
      key: 'pterodactyl-edge', points: 1, label: 'Only the descending wingtip caught the plate.', exposure: 2,
      composition, subject: 'pterodactyl', behavior: null, familyMoment: familyMomentForState(state),
    };
  }
  const repeated = hasCaptured(state, 'pterodactyl-dive');
  return {
    key: repeated ? 'pterodactyl-repeat' : 'pterodactyl-dive',
    points: repeated ? 1 : 2,
    label: repeated
      ? 'That folded dive is already in the case.'
      : 'The whole wing folded into its dive and held on glass.',
    exposure: 2,
    composition,
    subject: 'pterodactyl',
    behavior: 'predatory-dive',
    familyMoment: familyMomentForState(state),
  };
}

export function cameraDriftFromExposure(pending, heading, pitch) {
  const headingDrift = wrapAngle((heading ?? 0) - (pending.startHeading ?? 0));
  const pitchDrift = (pitch ?? 0) - (pending.startPitch ?? 0);
  return Math.hypot(headingDrift, pitchDrift);
}

const COMPOSITION_QUALITY = Object.freeze({ empty: 0, unread: 0, edge: 1, clear: 2 });

function worseComposition(first, second) {
  return (COMPOSITION_QUALITY[second] ?? 0) < (COMPOSITION_QUALITY[first] ?? 0)
    ? second
    : first;
}

export function createPendingExposure(state, plateIndex, durationSeconds) {
  const frame = frameForState(state);
  const braced = state.stance === 'crouch' || state.inCover;
  return {
    ...frame,
    plateIndex,
    remainingSeconds: durationSeconds,
    zone: state.zone,
    startHeading: state.heading,
    startPitch: state.pitch,
    maxCameraDrift: 0,
    braced,
    driftLimit: MAX_STEADY_DRIFT_RADIANS * (braced ? 1.8 : 1),
    initialSubject: frame.subject,
    initialBehavior: frame.behavior,
    maxExposureRisk: frame.exposure,
    continuousSubject: frame.subject !== null,
    continuousBehavior: frame.behavior !== null,
    worstComposition: frame.composition,
  };
}

export function updatePendingExposure(pending, liveFrame, heading, pitch, deltaSeconds) {
  return {
    ...pending,
    ...liveFrame,
    plateIndex: pending.plateIndex,
    zone: pending.zone,
    remainingSeconds: Math.max(0, pending.remainingSeconds - deltaSeconds),
    startHeading: pending.startHeading,
    startPitch: pending.startPitch,
    maxCameraDrift: Math.max(
      pending.maxCameraDrift ?? 0,
      cameraDriftFromExposure(pending, heading, pitch),
    ),
    braced: pending.braced,
    driftLimit: pending.driftLimit,
    initialSubject: pending.initialSubject,
    initialBehavior: pending.initialBehavior,
    maxExposureRisk: Math.max(
      pending.maxExposureRisk ?? pending.exposure ?? 0,
      liveFrame.exposure ?? 0,
    ),
    continuousSubject: pending.continuousSubject
      && liveFrame.subject !== null
      && liveFrame.subject === pending.initialSubject,
    continuousBehavior: pending.continuousBehavior
      && liveFrame.behavior === pending.initialBehavior,
    worstComposition: worseComposition(pending.worstComposition, liveFrame.composition),
  };
}

export function proofForExposure(pending) {
  const trackedMovingSubject = pending.initialSubject === 'pterodactyl'
    && pending.continuousSubject
    && pending.worstComposition !== 'empty';
  const shaken = !trackedMovingSubject
    && pending.maxCameraDrift > (pending.driftLimit ?? MAX_STEADY_DRIFT_RADIANS);
  let proof = shaken ? {
    key: 'shaken-frame',
    points: pending.points > 0 ? 1 : 0,
    label: 'The camera wandered; the telling detail dissolved in the silver.',
    composition: 'shaken',
    subject: pending.subject,
    behavior: null,
    stability: 'shaken',
  } : { ...pending, stability: 'steady' };
  if (!pending.continuousSubject || pending.worstComposition === 'empty') {
    proof = {
      ...proof, key: 'empty-subject', points: 0,
      label: 'The living shape left before the glass had taken it.',
      composition: 'empty', subject: null, behavior: null,
    };
  } else if (pending.worstComposition === 'edge' && proof.points > 1) {
    proof = {
      ...proof, key: 'family-edge', points: 1,
      label: 'The body crossed the edge while the plate was still open.',
      composition: 'edge', behavior: null,
    };
  } else if (proof.behavior && (
    !pending.initialBehavior
    || !pending.continuousBehavior
    || proof.behavior !== pending.initialBehavior
  ) && proof.points > 1) {
    proof = {
      ...proof, key: 'behavior-lost', points: 1,
      label: 'The animal remained, but the movement ended too soon.', behavior: null,
    };
  }
  return proof;
}

function emptySubjectFrame(familyMoment) {
  return {
    key: 'empty-subject',
    points: 0,
    label: 'The living shape stands outside the plate.',
    exposure: 0,
    composition: 'empty',
    subject: null,
    behavior: null,
    familyMoment,
  };
}

function edgeSubjectFrame(familyMoment) {
  return {
    key: 'family-edge',
    points: 1,
    label: 'A living shape reaches the very edge of the plate.',
    exposure: 1,
    composition: 'edge',
    subject: 'iguanodon-family',
    behavior: null,
    familyMoment,
  };
}

export function familyMomentForState(state) {
  if (state.reachedGlade && state.threatAwareness >= 3) return 'glade-alarm';
  if (!state.observedBehavior) return 'glade-routine';
  const rawClock = Number.isFinite(state.familyBehaviorSeconds) ? state.familyBehaviorSeconds : 0;
  const clock = ((rawClock % FAMILY_BEHAVIOR_CYCLE_SECONDS) + FAMILY_BEHAVIOR_CYCLE_SECONDS)
    % FAMILY_BEHAVIOR_CYCLE_SECONDS;
  if (clock >= 0.8 && clock < 4.6) return 'glade-young-play';
  if (clock >= 5.2 && clock < 9) return 'glade-branch-pull';
  return 'glade-routine';
}

function familyTargetForMoment(moment) {
  if (moment === 'glade-young-play') return youngPlayCenter;
  if (moment === 'glade-branch-pull') return branchPullCenter;
  return familyCenter;
}

function familyFrameForState(state, baseFrame) {
  const familyMoment = familyMomentForState(state);
  const composition = familyCompositionForTarget(state, familyTargetForMoment(familyMoment));
  if (composition === 'empty') return emptySubjectFrame(familyMoment);
  if (composition === 'edge') return edgeSubjectFrame(familyMoment);

  if (state.zone !== 'iguanodon-glade') {
    return { ...baseFrame, composition, subject: 'iguanodon-family', behavior: null, familyMoment };
  }
  if (!state.observedBehavior || familyMoment === 'glade-routine') {
    return {
      key: 'glade-form',
      points: 1,
      label: 'The family stands clear, quiet between movements.',
      exposure: 2,
      composition,
      subject: 'iguanodon-family',
      behavior: null,
      familyMoment,
    };
  }
  if (familyMoment === 'glade-alarm') {
    return {
      key: 'glade-alarm',
      points: 1,
      label: 'Every head lifts; the undisturbed moment is gone.',
      exposure: 2,
      composition,
      subject: 'iguanodon-family',
      behavior: 'alarm',
      familyMoment,
    };
  }

  const behavior = familyMoment === 'glade-young-play' ? 'young-play' : 'branch-pull';
  if (hasCaptured(state, familyMoment)) {
    return {
      key: familyMoment === 'glade-young-play' ? 'glade-young-repeat' : 'glade-branch-repeat',
      points: 1,
      label: `The ${behavior === 'young-play' ? 'young at play' : 'bending bough'} is already in the case.`,
      exposure: 2,
      composition,
      subject: 'iguanodon-family',
      behavior,
      familyMoment,
    };
  }
  return {
    key: familyMoment,
    points: 2,
    label: behavior === 'young-play'
      ? 'The young run clear across the pale bar, still unaware.'
      : 'The adult draws down the bough, still unaware.',
    exposure: 2,
    composition,
    subject: 'iguanodon-family',
    behavior,
    familyMoment,
  };
}

function orientedStaticFrame(state, baseFrame) {
  const familyMoment = familyMomentForState(state);
  const composition = familyCompositionForTarget(state, familyTargetForMoment(familyMoment));
  if (composition === 'empty') return emptySubjectFrame(familyMoment);
  if (composition === 'edge') return edgeSubjectFrame(familyMoment);
  return { ...baseFrame, familyMoment };
}

export function frameForState(state) {
  const pterodactylFrame = pterodactylFrameForState(state);
  if (pterodactylFrame) return pterodactylFrame;
  const familyMoment = familyMomentForState(state);
  const frames = {
    fort: {
      key: 'empty-fort', points: 0, label: 'The fort stands empty on the glass.', exposure: 0,
      composition: 'empty', subject: null, behavior: null, familyMoment,
    },
    'brook-blind': state.examinedTrack
      ? {
        key: 'brook-partial', points: 1, label: 'Wet fern hides half the flank.', exposure: 1,
        composition: 'edge', subject: 'iguanodon-family', behavior: null, familyMoment,
      }
      : {
        key: 'brook-unread', points: 0, label: 'Mud and water, before the spoor was understood.', exposure: 1,
        composition: 'unread', subject: null, behavior: null, familyMoment,
      },
    'canopy-overlook': {
      key: 'canopy-flank', points: 1, label: 'A full flank clears the fern roof.', exposure: 1,
      composition: 'clear', subject: 'iguanodon-family', behavior: null, familyMoment,
    },
    'basalt-shelf': {
      key: 'basalt-scale', points: 2, label: 'The adult passes beneath the red stone wall.', exposure: 2,
      composition: 'clear', subject: 'iguanodon-family', behavior: null, familyMoment,
    },
    'iguanodon-glade': {
      key: 'glade-form', points: 1, label: 'The family stands together on the river bar.', exposure: 2,
      composition: 'clear', subject: 'iguanodon-family', behavior: null, familyMoment,
    },
    'covered-return': {
      key: 'return-occluded', points: 1, label: 'Thorn closes across the body.', exposure: 1,
      composition: 'edge', subject: 'iguanodon-family', behavior: null, familyMoment,
    },
    'exposed-creek': {
      key: 'creek-scale', points: 2, label: 'Animal and open creek share the plate.', exposure: 2,
      composition: 'clear', subject: 'iguanodon-family', behavior: null, familyMoment,
    },
  };
  const frame = frames[state.zone];
  if (!frame) return frames.fort;
  if (state.zone === 'fort') return { ...frame };
  const composed = state.zone === 'brook-blind'
    ? orientedStaticFrame(state, frame)
    : familyFrameForState(state, frame);
  return downgradeRepeatedHighValueFrame(state, composed);
}
