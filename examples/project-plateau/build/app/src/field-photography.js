import { stegosaurusPose } from './stegosaurus-path.js';

export const FAMILY_BEHAVIOR_CYCLE_SECONDS = 10;
export const MAX_STEADY_DRIFT_RADIANS = 0.075;

// A plate is graded from what the live camera actually holds. The renderer
// projects a handful of anchor points per animal and reports, per subject,
// how much of the outline is on the glass, how large it stands (its longest
// projected extent as a fraction of the plate height) and whether terrain or
// leaves block it. These fractions turn that into framing and range. With
// the 26-degree lens an adult (about ten metres long) reads close inside ~30 m,
// fair to ~70 m, and distant beyond; a young animal at about half that.
export const FRAME_EVIDENCE_THRESHOLDS = Object.freeze({
  clearInFrame: 0.8,
  edgeInFrame: 0.3,
  fillsFrameInFrame: 0.6,
  fillsFrameSize: 0.87,
  closeSize: 0.93,
  fairSize: 0.45,
});

// Attack clock window in which the hunting pass can be taken: it opens as the
// wing drops into its low circle and closes as it folds, 1.5 s before the strike, so a
// two-second exposure can finish with time left to swap to the rifle.
export const DIVE_SECONDS = Object.freeze({ min: 0.6, max: 4 });

const COMPOSITION_QUALITY = Object.freeze({ empty: 0, unread: 0, occluded: 1, edge: 1, clear: 2 });

// An animal larger than the plate is still a clean frame when its body is on
// the glass with only its head and tail cut.
export function compositionForEvidence(entry) {
  if (!entry || !(entry.inFrameFraction >= FRAME_EVIDENCE_THRESHOLDS.edgeInFrame)) return 'empty';
  if (entry.occluded) return 'occluded';
  const fillsFrame = entry.centred
    && entry.inFrameFraction >= FRAME_EVIDENCE_THRESHOLDS.fillsFrameInFrame
    && entry.projectedSize >= FRAME_EVIDENCE_THRESHOLDS.fillsFrameSize;
  return entry.inFrameFraction >= FRAME_EVIDENCE_THRESHOLDS.clearInFrame || fillsFrame ? 'clear' : 'edge';
}

export function rangeForEvidence(entry) {
  const size = entry?.projectedSize ?? 0;
  if (size >= FRAME_EVIDENCE_THRESHOLDS.closeSize) return 'close';
  if (size >= FRAME_EVIDENCE_THRESHOLDS.fairSize) return 'fair';
  return 'distant';
}

function bestEvidence(evidence, predicate) {
  let best = null;
  for (const entry of evidence) {
    if (!predicate(entry)) continue;
    if (!best) {
      best = entry;
      continue;
    }
    const quality = COMPOSITION_QUALITY[compositionForEvidence(entry)];
    const bestQuality = COMPOSITION_QUALITY[compositionForEvidence(best)];
    if (quality > bestQuality
      || (quality === bestQuality && (entry.projectedSize ?? 0) > (best.projectedSize ?? 0))) {
      best = entry;
    }
  }
  return best;
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

// Edge, leaf-blocked or distant subjects can show what was there, never prove it.
function capForGlass(frame) {
  if (!frame.subject) return frame;
  if (frame.composition === 'edge' || frame.composition === 'occluded' || frame.range === 'distant') {
    return { ...frame, points: Math.min(frame.points, 1) };
  }
  return frame;
}

// Nothing counted on the glass. If part of an animal still reached it, say so:
// the scout should learn to centre or close in, not that the animal moved.
function emptySubjectFrame(familyMoment, evidence = []) {
  const glimpse = evidence.some((entry) => entry.subject !== 'pterodactyl' && entry.inFrameFraction > 0);
  return {
    key: glimpse ? 'subject-glimpse' : 'empty-subject',
    points: 0,
    label: glimpse
      ? 'Only the edge of a body touched the glass. Centre it, or close in.'
      : 'Only river light reached the glass.',
    exposure: 0,
    composition: 'empty',
    subject: null,
    behavior: null,
    familyMoment,
    range: null,
    size: 0,
  };
}

function pterodactylFrameForState(state, evidence, familyMoment) {
  if (state.threatState !== 'attack'
    || state.attackSeconds < DIVE_SECONDS.min
    || state.attackSeconds >= DIVE_SECONDS.max) return null;
  const bird = bestEvidence(evidence, (entry) => entry.subject === 'pterodactyl');
  const composition = compositionForEvidence(bird);
  if (composition === 'empty') return null;
  const shared = {
    exposure: 2,
    composition,
    subject: 'pterodactyl',
    familyMoment,
    range: rangeForEvidence(bird),
    size: bird.projectedSize ?? 0,
  };
  if (composition !== 'clear') {
    return {
      ...shared, key: 'pterodactyl-edge', points: 1, behavior: null,
      label: 'Only a wingtip crossed the plate.',
    };
  }
  const repeated = hasCaptured(state, 'pterodactyl-dive');
  return {
    ...shared,
    key: repeated ? 'pterodactyl-repeat' : 'pterodactyl-dive',
    points: repeated ? 1 : 2,
    label: repeated
      ? 'That hunting pass is already in the case.'
      : 'The hunting wing banks low over you, held whole on glass.',
    behavior: repeated ? null : 'predatory-dive',
  };
}

// The drinking-place beat (Chapter XII).
function stegosaurusFrameForState(state, evidence, familyMoment) {
  const pose = stegosaurusPose(state.stegosaurusClock);
  if (pose.phase === 'absent' || pose.phase === 'gone') return null;
  const animal = bestEvidence(evidence, (entry) => entry.subject === 'stegosaurus');
  const composition = compositionForEvidence(animal);
  if (composition === 'empty') return null;
  const shared = {
    composition,
    subject: 'stegosaurus',
    familyMoment,
    range: rangeForEvidence(animal),
    size: animal.projectedSize ?? 0,
  };
  if (composition !== 'clear') {
    return {
      ...shared, key: 'stegosaurus-edge', points: 1, exposure: 1, behavior: null,
      label: composition === 'occluded'
        ? 'Reeds cross the plated back.'
        : 'Only the plated tail crosses the edge of the glass.',
    };
  }
  if (pose.phase === 'drinking') {
    return {
      ...shared,
      key: 'stegosaurus-drinking',
      points: 2,
      label: 'Arched back, triangular fringes, the bird-like head down at the water.',
      exposure: 2,
      behavior: 'drinking',
    };
  }
  return {
    ...shared, key: 'stegosaurus-walking', points: 1, exposure: 1, behavior: null,
    label: 'The plated back moves through the reeds.',
  };
}

const ZONE_FRAMES = Object.freeze({
  'brook-blind': Object.freeze({
    key: 'brook-flank', points: 1, label: 'The family far down the bar, small on the glass.', exposure: 1,
  }),
  'canopy-overlook': Object.freeze({
    key: 'canopy-flank', points: 1, label: 'A full flank clears the fern roof.', exposure: 1,
  }),
  'basalt-shelf': Object.freeze({
    key: 'basalt-scale', points: 2, label: 'The adult passes beneath the red stone wall.', exposure: 2,
  }),
  'covered-return': Object.freeze({
    key: 'return-occluded', points: 1, label: 'Thorn closes across the body.', exposure: 1,
  }),
  'exposed-creek': Object.freeze({
    key: 'creek-scale', points: 2, label: 'Animal and open creek share the plate.', exposure: 2,
  }),
});

export function familyMomentForState(state) {
  if (state.reachedGlade && (state.threatAwareness >= 3 || (state.familyAlarmSeconds ?? 0) > 0)) {
    return 'glade-alarm';
  }
  if (!state.observedBehavior) return 'glade-routine';
  const rawClock = Number.isFinite(state.familyBehaviorSeconds) ? state.familyBehaviorSeconds : 0;
  const clock = ((rawClock % FAMILY_BEHAVIOR_CYCLE_SECONDS) + FAMILY_BEHAVIOR_CYCLE_SECONDS)
    % FAMILY_BEHAVIOR_CYCLE_SECONDS;
  if (clock >= 0.8 && clock < 4.6) return 'glade-young-play';
  if (clock >= 5.2 && clock < 9) return 'glade-branch-pull';
  return 'glade-routine';
}

const BEHAVIOUR_ROLES = Object.freeze({
  'glade-young-play': 'young-play',
  'glade-branch-pull': 'branch-pull',
});

function gladeFrame(state, familyMoment, behaviourOnGlass) {
  if (familyMoment === 'glade-alarm') {
    return {
      key: 'glade-alarm', points: 1, label: 'Every head lifts; the undisturbed moment is gone.',
      exposure: 2, behavior: 'alarm',
    };
  }
  const behavior = BEHAVIOUR_ROLES[familyMoment];
  if (!state.observedBehavior || !behavior || !behaviourOnGlass) {
    return {
      key: 'glade-form', points: 1, label: 'The family stands clear, quiet between movements.',
      exposure: 2, behavior: null,
    };
  }
  if (hasCaptured(state, familyMoment)) {
    return {
      key: behavior === 'young-play' ? 'glade-young-repeat' : 'glade-branch-repeat',
      points: 1,
      label: `The ${behavior === 'young-play' ? 'young at play' : 'bending bough'} is already in the case.`,
      exposure: 2,
      behavior,
    };
  }
  return {
    key: familyMoment,
    points: 2,
    label: behavior === 'young-play'
      ? 'The young run clear across the pale bar, still unaware.'
      : 'The adult draws down the bough, still unaware.',
    exposure: 2,
    behavior,
  };
}

function familyFrameForState(state, evidence, familyMoment) {
  if (state.zone === 'brook-blind' && !state.examinedTrack) {
    return {
      key: 'brook-unread', points: 0, label: 'Mud and water, before the spoor was understood.', exposure: 1,
      composition: 'unread', subject: null, behavior: null, familyMoment, range: null, size: 0,
    };
  }
  const behaviourRole = BEHAVIOUR_ROLES[familyMoment];
  const anyAnimal = bestEvidence(evidence, (entry) => entry.subject === 'iguanodon');
  const actor = behaviourRole
    ? bestEvidence(evidence, (entry) => entry.subject === 'iguanodon' && entry.role === behaviourRole)
    : null;
  const behaviourOnGlass = compositionForEvidence(actor) !== 'empty';
  const chosen = behaviourOnGlass ? actor : anyAnimal;
  const composition = compositionForEvidence(chosen);
  if (composition === 'empty') return emptySubjectFrame(familyMoment, evidence);

  const base = state.zone === 'iguanodon-glade'
    ? gladeFrame(state, familyMoment, behaviourOnGlass)
    : { ...(ZONE_FRAMES[state.zone] ?? ZONE_FRAMES['basalt-shelf']), behavior: null };
  const frame = {
    ...base,
    composition,
    subject: 'iguanodon-family',
    familyMoment,
    range: rangeForEvidence(chosen),
    size: chosen.projectedSize ?? 0,
  };
  if (composition === 'edge') {
    return { ...frame, key: 'family-edge', label: 'A living shape reaches the very edge of the plate.' };
  }
  if (composition === 'occluded') {
    return state.zone === 'brook-blind'
      ? { ...frame, key: 'brook-partial', label: 'Wet fern hides half the flank.' }
      : { ...frame, key: 'subject-occluded', label: 'Leaves and thorn cross the body.' };
  }
  return frame;
}

export function frameForState(state) {
  const evidence = state.frameEvidence ?? [];
  const familyMoment = familyMomentForState(state);
  if (state.zone === 'fort' || !state.zone) {
    return {
      key: 'empty-fort', points: 0, label: 'The fort stands empty on the glass.', exposure: 0,
      composition: 'empty', subject: null, behavior: null, familyMoment, range: null, size: 0,
    };
  }
  const dive = pterodactylFrameForState(state, evidence, familyMoment);
  if (dive) return capForGlass(dive);
  const stegosaurus = stegosaurusFrameForState(state, evidence, familyMoment);
  const family = familyFrameForState(state, evidence, familyMoment);
  // The larger animal on the glass is the plate's subject, but an exposure in
  // flight stays with the animal it opened on while that animal is in frame.
  const held = state.pendingExposure?.openFrame?.subject;
  const subjectFrame = held === 'stegosaurus' && stegosaurus
    ? stegosaurus
    : held === 'iguanodon-family' && family.subject
      ? family
      : stegosaurus && (!family.subject || stegosaurus.size >= family.size)
        ? stegosaurus
        : family;
  return capForGlass(downgradeRepeatedHighValueFrame(state, subjectFrame));
}

export function cameraDriftFromExposure(pending, heading, pitch) {
  const headingDrift = wrapAngle((heading ?? 0) - (pending.startHeading ?? 0));
  const pitchDrift = (pitch ?? 0) - (pending.startPitch ?? 0);
  return Math.hypot(headingDrift, pitchDrift);
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function worseComposition(first, second) {
  return (COMPOSITION_QUALITY[second] ?? 0) < (COMPOSITION_QUALITY[first] ?? 0)
    ? second
    : first;
}

const RANGE_ORDER = Object.freeze({ close: 2, fair: 1, distant: 0 });

function worseRange(first, second) {
  if (!first) return second;
  if (!second) return first;
  return RANGE_ORDER[second] < RANGE_ORDER[first] ? second : first;
}

// The plate is graded from the frame at shutter-open: what the animal was
// doing when you clicked counts. The exposure then only has to keep the same
// animal on the glass, hold the camera still, and survive an alarm.
export function createPendingExposure(state, plateIndex, durationSeconds) {
  const frame = frameForState(state);
  const braced = state.stance === 'crouch' || state.inCover;
  return {
    ...frame,
    openFrame: frame,
    plateIndex,
    remainingSeconds: durationSeconds,
    zone: state.zone,
    startHeading: state.heading,
    startPitch: state.pitch,
    maxCameraDrift: 0,
    braced,
    driftLimit: MAX_STEADY_DRIFT_RADIANS * (braced ? 1.8 : 1),
    maxExposureRisk: frame.exposure,
    continuousSubject: frame.subject !== null,
    alarmDuringExposure: false,
    worstComposition: frame.composition,
    worstRange: frame.range,
  };
}

export function updatePendingExposure(pending, liveFrame, heading, pitch, deltaSeconds) {
  const openFrame = pending.openFrame;
  return {
    ...pending,
    ...liveFrame,
    openFrame,
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
    maxExposureRisk: Math.max(pending.maxExposureRisk ?? 0, liveFrame.exposure ?? 0),
    continuousSubject: pending.continuousSubject
      && liveFrame.subject !== null
      && liveFrame.subject === openFrame.subject,
    alarmDuringExposure: pending.alarmDuringExposure
      || (liveFrame.familyMoment === 'glade-alarm' && openFrame.familyMoment !== 'glade-alarm'),
    worstComposition: worseComposition(pending.worstComposition, liveFrame.composition),
    worstRange: worseRange(pending.worstRange, liveFrame.range),
  };
}

const FAMILY_BEHAVIOURS = new Set(['young-play', 'branch-pull']);

export function proofForExposure(pending) {
  const openFrame = pending.openFrame ?? pending;
  // An unread plate keeps its own reason; the animals were there, the scout did not know them.
  if (openFrame.composition === 'unread') return capForGlass({ ...openFrame, stability: 'steady' });
  // Empty at the click keeps its own reason; only an animal lost mid-exposure 'left'.
  if (!openFrame.subject) return { ...openFrame, points: 0, stability: 'steady' };
  if (!pending.continuousSubject || pending.worstComposition === 'empty') {
    return {
      ...openFrame, key: 'empty-subject', points: 0,
      label: 'The living shape left before the glass had taken it.',
      composition: 'empty', subject: null, behavior: null, range: null, stability: 'steady',
    };
  }
  const trackedMovingSubject = openFrame.subject === 'pterodactyl';
  const shaken = !trackedMovingSubject
    && pending.maxCameraDrift > (pending.driftLimit ?? MAX_STEADY_DRIFT_RADIANS);
  let proof = {
    ...openFrame,
    composition: pending.worstComposition,
    range: pending.worstRange ?? openFrame.range,
    stability: shaken ? 'shaken' : 'steady',
  };
  if (pending.alarmDuringExposure && FAMILY_BEHAVIOURS.has(openFrame.behavior)) {
    proof = {
      ...proof, key: 'behavior-lost', points: 1, behavior: null,
      label: 'Every head came up before the glass had taken the movement.',
    };
  }
  if (shaken) {
    proof = {
      ...proof, key: 'shaken-frame', points: Math.min(proof.points, 1),
      label: 'The camera wandered; the telling detail dissolved in the silver.',
    };
  }
  return capForGlass(proof);
}
