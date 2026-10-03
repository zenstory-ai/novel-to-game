import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIVE_SECONDS,
  compositionForEvidence,
  rangeForEvidence,
} from '../src/field-photography.js';
import {
  CONTACT_SECONDS,
  EXPOSURE_SECONDS,
  INITIAL_LIGHT_SECONDS,
  INITIAL_PLAYER,
  MAX_STEADY_DRIFT_RADIANS,
  NAVIGATION,
  FAMILY_NOTICE_METERS,
  applyThreatContact,
  createPlayerState,
  examine,
  fireDefensiveShot,
  familyMomentForState,
  frameForState,
  intactEvidence,
  resultBandForEvidence,
  restartPlayer,
  releaseTransientTools,
  setCameraRaised,
  setPaused,
  setRifleRaised,
  startExposure,
  stepPlayer,
  zoneForPosition,
} from '../src/simulation.js';

test('fresh and restarted player states are clean copies', () => {
  const first = createPlayerState();
  first.position.x += 9;
  first.elapsedSeconds = 88;
  first.boundaryRecoveries = 3;
  const restarted = restartPlayer(first);
  assert.deepEqual(restarted.position, INITIAL_PLAYER.position);
  assert.equal(restarted.elapsedSeconds, 0);
  assert.equal(restarted.boundaryRecoveries, 0);
  assert.equal(restarted.paused, false);
  assert.notEqual(restarted.position, INITIAL_PLAYER.position);
});

test('walking, sprinting and crouching have ordered deterministic speeds', () => {
  const walk = stepPlayer(createPlayerState(), { forward: 1 }, 1);
  const sprint = stepPlayer(createPlayerState(), { forward: 1, sprint: true }, 1);
  const crouch = stepPlayer(createPlayerState(), { forward: 1, crouch: true }, 1);
  const walkDistance = INITIAL_PLAYER.position.z - walk.position.z;
  const sprintDistance = INITIAL_PLAYER.position.z - sprint.position.z;
  const crouchDistance = INITIAL_PLAYER.position.z - crouch.position.z;
  assert.ok(sprintDistance > walkDistance);
  assert.ok(walkDistance > crouchDistance);
  assert.equal(walk.stance, 'walk');
  assert.equal(sprint.stance, 'sprint');
  assert.equal(crouch.stance, 'crouch');
});

test('movement accelerates, coasts briefly, and settles instead of snapping between speeds', () => {
  const started = stepPlayer(createPlayerState(), { forward: 1 }, 0.1);
  const startedSpeed = Math.hypot(started.velocity.x, started.velocity.z);
  assert.ok(startedSpeed > 0 && startedSpeed < 4.2, started.velocity);

  const cruising = stepPlayer(started, { forward: 1 }, 0.6);
  const cruisingSpeed = Math.hypot(cruising.velocity.x, cruising.velocity.z);
  assert.ok(cruisingSpeed > startedSpeed, cruising.velocity);
  assert.ok(cruisingSpeed <= 4.2 + 1e-9, cruising.velocity);

  const released = stepPlayer(cruising, {}, 0.05);
  const releasedSpeed = Math.hypot(released.velocity.x, released.velocity.z);
  assert.ok(releasedSpeed < cruisingSpeed && releasedSpeed > 0, released.velocity);

  const settled = stepPlayer(released, {}, 0.5);
  assert.ok(Math.hypot(settled.velocity.x, settled.velocity.z) < 1e-9, settled.velocity);
});

test('a fast reversal must shed forward velocity before building speed backward', () => {
  const forward = stepPlayer(createPlayerState(), { forward: 1, sprint: true }, 0.7);
  const reversed = stepPlayer(forward, { forward: -1, sprint: true }, 0.1);
  const headingForward = { x: 0, z: -1 };
  const forwardComponent = (
    reversed.velocity.x * headingForward.x + reversed.velocity.z * headingForward.z
  );
  assert.ok(forwardComponent < Math.hypot(forward.velocity.x, forward.velocity.z), reversed.velocity);
  assert.ok(forwardComponent > -6.8, reversed.velocity);
});

test('rotated view keeps WASD aligned with the camera horizontal axes', () => {
  const heading = 0.73;
  const duration = 0.25;
  const origin = INITIAL_PLAYER.position;
  const forward = stepPlayer(createPlayerState(), { forward: 1, heading }, duration);
  const right = stepPlayer(createPlayerState(), { right: 1, heading }, duration);

  assert.ok(Math.abs(forward.position.x - (origin.x - Math.sin(heading) * forward.distanceTravelled)) < 1e-9);
  assert.ok(Math.abs(forward.position.z - (origin.z - Math.cos(heading) * forward.distanceTravelled)) < 1e-9);
  assert.ok(Math.abs(right.position.x - (origin.x + Math.cos(heading) * right.distanceTravelled)) < 1e-9);
  assert.ok(Math.abs(right.position.z - (origin.z - Math.sin(heading) * right.distanceTravelled)) < 1e-9);
});

test('pause freezes both world time and movement', () => {
  const paused = setPaused(createPlayerState(), true, 'manual');
  const after = stepPlayer(paused, { forward: 1, sprint: true }, 4);
  assert.deepEqual(after.position, paused.position);
  assert.equal(after.elapsedSeconds, 0);
  assert.equal(after.pauseReason, 'manual');
});

test('jump has deterministic takeoff, apex and landing without double-jump', () => {
  const start = createPlayerState();
  const rising = stepPlayer(start, { jump: true }, 0.1);
  assert.equal(rising.grounded, false);
  assert.ok(rising.verticalOffset > 0, rising);
  assert.ok(rising.verticalVelocity > 0, rising);

  const repeated = stepPlayer(rising, { jump: true }, 0.1);
  assert.ok(repeated.verticalVelocity < rising.verticalVelocity, repeated);

  let player = rising;
  let apex = player.verticalOffset;
  for (let step = 0; step < 120 && !player.grounded; step += 1) {
    player = stepPlayer(player, {}, 1 / 60);
    apex = Math.max(apex, player.verticalOffset);
  }
  assert.ok(apex > 1 && apex < 1.2, apex);
  assert.equal(player.grounded, true);
  assert.equal(player.verticalOffset, 0);
  assert.equal(player.verticalVelocity, 0);
});

test('jump is rejected while crouching, holding a tool, exposing or paused', () => {
  const crouching = stepPlayer(createPlayerState(), { jump: true, crouch: true }, 0.1);
  assert.equal(crouching.grounded, true);

  const camera = stepPlayer(setCameraRaised(createPlayerState(), true), { jump: true }, 0.1);
  assert.equal(camera.grounded, true);

  const rifle = stepPlayer(setRifleRaised(createPlayerState(), true), { jump: true }, 0.1);
  assert.equal(rifle.grounded, true);

  const exposing = createPlayerState();
  exposing.pendingExposure = { key: 'test', remainingSeconds: 1 };
  const exposureStep = stepPlayer(exposing, { jump: true }, 0.1);
  assert.equal(exposureStep.grounded, true);

  const paused = setPaused(createPlayerState(), true, 'manual');
  const frozen = stepPlayer(paused, { jump: true }, 0.5);
  assert.equal(frozen.grounded, true);
  assert.equal(frozen.verticalOffset, 0);
});

test('one large delta and fixed slices produce the same ballistic landing', () => {
  const large = stepPlayer(createPlayerState(), { jump: true }, 1);
  let sliced = stepPlayer(createPlayerState(), { jump: true }, 1 / 60);
  for (let step = 1; step < 60; step += 1) sliced = stepPlayer(sliced, {}, 1 / 60);
  assert.equal(large.grounded, true);
  assert.equal(sliced.grounded, true);
  assert.ok(Math.abs(large.verticalOffset - sliced.verticalOffset) < 1e-9);
  assert.ok(Math.abs(large.verticalVelocity - sliced.verticalVelocity) < 1e-9);
});

test('focus loss releases held tools while preserving an exposure already in flight', () => {
  const rifleHeld = setRifleRaised(createPlayerState(), true);
  assert.equal(releaseTransientTools(rifleHeld).rifleRaised, false);

  const cameraHeld = setCameraRaised(createPlayerState(), true);
  const cameraReleased = releaseTransientTools(cameraHeld);
  assert.equal(cameraReleased.cameraRaised, false);
  assert.equal(cameraReleased.rifleRaised, false);

  const exposing = startExposure(cameraHeld);
  const exposurePreserved = releaseTransientTools(exposing);
  assert.ok(exposurePreserved.pendingExposure);
  assert.equal(exposurePreserved.cameraRaised, true);
  assert.equal(exposurePreserved.rifleRaised, false);
});

test('a solid obstacle blocks penetration and permits axis sliding', () => {
  const player = createPlayerState();
  player.position = { x: -7, z: 80 };
  player.lastStablePosition = { ...player.position };
  const after = stepPlayer(player, { forward: 1, right: 1 }, 0.5);
  const localX = Math.SQRT1_2 * ((after.position.x + 3) - (after.position.z - 80));
  const localZ = Math.SQRT1_2 * ((after.position.x + 3) + (after.position.z - 80));
  assert.ok(
    Math.abs(localX) >= 2.55 + 0.6 - 1e-6
      || Math.abs(localZ) >= 3.2 + 0.6 - 1e-6,
    after.position,
  );
  assert.notDeepEqual(after.position, player.position);
  assert.equal(after.collisions, 1);
});

test('a long simulation step cannot tunnel through a circular obstacle', () => {
  const boulder = NAVIGATION.obstacles.find((collider) => collider.id === 'brook-boulder');
  const player = createPlayerState();
  player.position = { x: -7.5, z: 38 };
  player.lastStablePosition = { ...player.position };
  const after = stepPlayer(player, { forward: 1, sprint: true }, 1);

  assert.ok(
    after.position.z >= boulder.z + boulder.radius + NAVIGATION.playerRadius - 1e-6,
    after.position,
  );
  assert.ok(after.collisions > 0, after);
});

test('leaving the navigable world recovers the last stable position', () => {
  const player = createPlayerState();
  player.position = { x: 0, z: -89.8 };
  player.lastStablePosition = { ...player.position };
  const after = stepPlayer(player, { forward: 1 }, 1);
  assert.deepEqual(after.position, player.lastStablePosition);
  assert.equal(after.boundaryRecoveries, 1);
  assert.equal(after.lastEvent, 'boundary-recovery');
});

// What the renderer reports for one animal on the glass.
function seen(subject, extras = {}) {
  return {
    subject, role: null, inFrameFraction: 1, projectedSize: 0.5, centred: true, occluded: false, ...extras,
  };
}
const FAMILY = (extras = {}) => [
  seen('iguanodon', { role: 'graze', ...extras }),
  seen('iguanodon', { role: 'young-play', ...extras }),
  seen('iguanodon', { role: 'branch-pull', ...extras }),
];

function placed(x, z, changes = {}, evidence = []) {
  const player = { ...createPlayerState(), ...changes };
  player.position = { x, z };
  player.lastStablePosition = { x, z };
  return stepPlayer(player, { frameEvidence: evidence }, 0.1);
}

function teleport(player, x, z, evidence = player.frameEvidence) {
  return stepPlayer(
    { ...player, position: { x, z }, lastStablePosition: { x, z }, velocity: { x: 0, z: 0 } },
    { frameEvidence: evidence },
    0.1,
  );
}

function expose(player, evidence, input = {}, liveEvidence = evidence) {
  let next = startExposure(setCameraRaised(player, true), evidence);
  for (let step = 0; step < 4 && next.pendingExposure; step += 1) {
    next = stepPlayer(next, { frameEvidence: liveEvidence, ...input }, EXPOSURE_SECONDS / 4);
  }
  return next;
}

function gladeWatching(changes = {}) {
  const player = placed(3, -2, { reachedGlade: true }, FAMILY());
  return { ...examine(player), ...changes };
}

test('cover is the thorn band: its blind counts, open grass beside it does not', () => {
  assert.equal(zoneForPosition({ x: 0, z: 70 }), 'fort');
  assert.equal(zoneForPosition({ x: 0, z: 45 }), 'brook-blind');
  assert.equal(zoneForPosition({ x: -3.7, z: 18 }), 'canopy-overlook');
  assert.equal(zoneForPosition({ x: 1, z: 18 }), 'basalt-shelf');
  assert.equal(zoneForPosition({ x: -3.7, z: 18 }, true), 'covered-return');
  assert.equal(zoneForPosition({ x: 7, z: 18 }, true), 'exposed-creek');
  assert.equal(zoneForPosition({ x: -1.1, z: -11.5 }), 'iguanodon-glade');
  assert.equal(placed(-1.1, -11.5).inCover, true);
  assert.equal(placed(1, 18).inCover, false);
  assert.equal(placed(-3.7, 18).inCover, true);
});

test('a newcomer reaches the glade intact and the first dive circles before it strikes', () => {
  let player = placed(3, 45, {}, FAMILY({ projectedSize: 0.3 }));
  player = examine(player);
  player = expose(player, FAMILY({ projectedSize: 0.3 }));
  assert.equal(player.threatAwareness, 1);
  player = teleport(player, 9, 18, FAMILY());
  player = expose(player, FAMILY());
  assert.equal(player.threatAwareness, 2);
  player = teleport(player, 3, -2, FAMILY());
  assert.equal(player.zone, 'iguanodon-glade');
  assert.equal(player.threatState, 'search');
  assert.equal(player.plates.filter((plate) => plate.status === 'cracked').length, 0);

  player = examine(player);
  player = { ...player, familyBehaviorSeconds: 1 };
  player = expose(player, FAMILY());
  assert.equal(player.plates[2].behavior, 'young-play');
  assert.equal(player.threatState, 'attack');
  for (let step = 0; step < CONTACT_SECONDS * 10 - 1; step += 1) player = stepPlayer(player, { frameEvidence: [] }, 0.1);
  assert.equal(player.contactCount, 0, 'the full warning plays before contact');
  for (let step = 0; step < 2; step += 1) player = stepPlayer(player, { frameEvidence: [] }, 0.1);
  assert.equal(player.contactCount, 1);
  assert.deepEqual(player.plates.map((plate) => plate.status), ['exposed', 'exposed', 'cracked', 'unexposed']);
});

test('two open glade plates back to back draw the dive, and it takes the latest plate', () => {
  let player = gladeWatching();
  assert.equal(player.threatAwareness, 1);
  player = expose(player, FAMILY());
  player = expose(player, FAMILY());
  assert.equal(player.threatState, 'attack');
  for (let step = 0; step < CONTACT_SECONDS * 10 + 1; step += 1) {
    player = stepPlayer(player, { frameEvidence: [] }, 0.1);
  }
  assert.equal(player.plates[1].status, 'cracked');
  assert.equal(player.plates[0].status, 'exposed');
  assert.equal(player.failed, false);
});

test('one plate never adds more than one step of awareness, and cover takes it back', () => {
  let player = placed(9, 18, {}, FAMILY());
  player = expose(player, [seen('pterodactyl'), ...FAMILY()]);
  assert.equal(player.threatAwareness, 2);
  assert.equal(player.lastThreatEvent, 'plate-exposure:+1');

  let standing = { ...placed(-3.7, 18, { reachedGlade: true }), threatAwareness: 3, threatState: 'attack' };
  let crouching = standing;
  for (let second = 0; second < 4; second += 1) {
    standing = stepPlayer(standing, {}, 1);
    crouching = stepPlayer(crouching, { crouch: true }, 1);
  }
  assert.equal(standing.threatState, 'attack');
  assert.equal(standing.contactCount, 0, 'no strike lands under the thorns');
  assert.equal(crouching.threatState, 'search');
});

test('framing and range come from what the glass holds', () => {
  assert.equal(compositionForEvidence(seen('iguanodon')), 'clear');
  assert.equal(compositionForEvidence(seen('iguanodon', { inFrameFraction: 0.4, centred: false })), 'edge');
  assert.equal(compositionForEvidence(seen('iguanodon', { inFrameFraction: 0.2, centred: false })), 'empty');
  assert.equal(compositionForEvidence(seen('iguanodon', { occluded: true })), 'occluded');
  // A centred animal larger than the plate is a clean frame, not an edge.
  assert.equal(compositionForEvidence(seen('iguanodon', { inFrameFraction: 0.6, projectedSize: 1.2 })), 'clear');
  assert.equal(compositionForEvidence(seen('iguanodon', { inFrameFraction: 0.6, projectedSize: 0.4 })), 'edge');
  assert.equal(rangeForEvidence(seen('iguanodon', { projectedSize: 1 })), 'close');
  assert.equal(rangeForEvidence(seen('iguanodon', { projectedSize: 0.5 })), 'fair');
  assert.equal(rangeForEvidence(seen('iguanodon', { projectedSize: 0.2 })), 'distant');

  const shelf = placed(9, 18, {}, FAMILY());
  assert.equal(frameForState(shelf).key, 'basalt-scale');
  assert.equal(frameForState(shelf).points, 2);
  const speck = { ...shelf, frameEvidence: FAMILY({ projectedSize: 0.2 }) };
  assert.equal(frameForState(speck).range, 'distant');
  assert.equal(frameForState(speck).points, 1);
  assert.equal(frameForState({ ...shelf, frameEvidence: [] }).key, 'empty-subject');
  assert.equal(frameForState({ ...shelf, frameEvidence: FAMILY({ inFrameFraction: 0.2 }) }).key, 'subject-glimpse');

  let wasted = expose({ ...shelf, frameEvidence: [] }, []);
  assert.equal(wasted.plates[0].frameKey, 'empty-subject');
  assert.equal(wasted.plates[0].points, 0);
  assert.equal(wasted.threatAwareness, shelf.threatAwareness);
});

test('the brook needs the spoor read first, and its far view is a smudge', () => {
  let player = placed(3, 45, {}, FAMILY({ projectedSize: 0.3 }));
  assert.equal(frameForState(player).points, 0);
  player = examine(player);
  const far = frameForState(player);
  assert.equal(far.key, 'brook-flank');
  assert.equal(far.range, 'distant');
  assert.equal(far.points, 1);
  const fern = frameForState({ ...player, frameEvidence: FAMILY({ occluded: true }) });
  assert.equal(fern.key, 'brook-partial');
  assert.equal(fern.composition, 'occluded');
});

test('the circling wing is a subject wherever it is rendered, inside the dive window', () => {
  const attack = {
    ...placed(9, 18, {}, FAMILY()),
    threatAwareness: 3,
    threatState: 'attack',
    attackSeconds: 1,
    frameEvidence: [seen('pterodactyl', { projectedSize: 0.6 }), ...FAMILY()],
  };
  const dive = frameForState(attack);
  assert.equal(dive.key, 'pterodactyl-dive');
  assert.equal(dive.behavior, 'predatory-dive');
  assert.equal(frameForState({ ...attack, attackSeconds: DIVE_SECONDS.max + 0.1 }).key, 'basalt-scale');

  // Tracking a moving wing is not camera shake; losing it empties the plate.
  const tracked = expose(attack, attack.frameEvidence, { heading: 0.4 });
  assert.equal(tracked.plates[0].frameKey, 'pterodactyl-dive');
  assert.equal(tracked.plates[0].stability, 'steady');
  assert.equal(tracked.plates[0].points, 2);
  const lost = expose(attack, attack.frameEvidence, {}, FAMILY());
  assert.equal(lost.plates[0].frameKey, 'empty-subject');
  assert.equal(lost.plates[0].points, 0);
});

test('behaviour is graded at the click; only an alarm mid-exposure takes it away', () => {
  const late = { ...gladeWatching(), familyBehaviorSeconds: 4.4 };
  assert.equal(frameForState(late).key, 'glade-young-play');
  const caught = expose(late, FAMILY());
  assert.equal(caught.plates[0].behavior, 'young-play');
  assert.equal(caught.plates[0].points, 2);

  const early = { ...gladeWatching(), familyBehaviorSeconds: 0.5 };
  assert.equal(expose(early, FAMILY()).plates[0].behavior, null);

  let alarmed = startExposure(setCameraRaised(late, true), FAMILY());
  alarmed = { ...alarmed, threatAwareness: 3, threatState: 'attack' };
  for (let step = 0; step < 4; step += 1) alarmed = stepPlayer(alarmed, { frameEvidence: FAMILY() }, 0.5);
  assert.equal(alarmed.plates[0].frameKey, 'behavior-lost');
  assert.equal(alarmed.plates[0].behavior, null);
});

test('camera drift smears a plate unless the scout is braced', () => {
  const shelf = placed(9, 18, {}, FAMILY());
  const shaken = expose(shelf, FAMILY(), { heading: MAX_STEADY_DRIFT_RADIANS * 1.5 });
  assert.equal(shaken.plates[0].frameKey, 'shaken-frame');
  assert.equal(shaken.plates[0].sourceFrameKey, 'basalt-scale');
  assert.equal(shaken.plates[0].points, 1);
  const braced = expose(
    stepPlayer(shelf, { crouch: true, frameEvidence: FAMILY() }, 0.1),
    FAMILY(),
    { crouch: true, heading: MAX_STEADY_DRIFT_RADIANS * 1.5 },
  );
  assert.equal(braced.plates[0].stability, 'steady');
  assert.equal(braced.plates[0].points, 2);
});

test('watching the family opens its young-play and branch-pull windows', () => {
  let player = placed(3, -2, { reachedGlade: true }, FAMILY());
  player = stepPlayer(player, { frameEvidence: FAMILY() }, 1);
  player = stepPlayer(player, { frameEvidence: FAMILY() }, 1);
  assert.equal(player.observedBehavior, true);
  player = stepPlayer(player, { frameEvidence: FAMILY() }, 1);
  assert.equal(frameForState(player).key, 'glade-young-play');
  const caught = expose(player, FAMILY());
  assert.equal(frameForState({ ...caught, familyBehaviorSeconds: 1 }).key, 'glade-young-repeat');
  assert.equal(frameForState({ ...caught, familyBehaviorSeconds: 6 }).key, 'glade-branch-pull');
  // The behaviour must be on the glass: only the grazing adult framed is a quiet frame.
  const grazerOnly = { ...player, frameEvidence: [seen('iguanodon', { role: 'graze' })] };
  assert.equal(frameForState(grazerOnly).key, 'glade-form');
});

test('walking up to the family alarms it; crouching close does not', () => {
  const nearest = { x: -2.2, z: -24.8 };
  const distance = FAMILY_NOTICE_METERS.upright - 2;
  const upright = placed(nearest.x, nearest.z + distance, { reachedGlade: true }, FAMILY());
  assert.equal(upright.familyMoment, 'glade-alarm');
  let crouched = { ...createPlayerState(), reachedGlade: true, position: { x: nearest.x, z: nearest.z + distance } };
  crouched.lastStablePosition = { ...crouched.position };
  crouched = stepPlayer(crouched, { crouch: true, frameEvidence: FAMILY() }, 0.1);
  assert.notEqual(crouched.familyMoment, 'glade-alarm');
});

test('the rifle turns a dive in time and says so when it is too late', () => {
  let player = { ...createPlayerState(), threatAwareness: 3, threatState: 'attack', attackSeconds: 1.5 };
  player = fireDefensiveShot(setRifleRaised(player, true));
  assert.equal(player.cartridges, 1);
  assert.equal(player.threatState, 'watch');
  assert.equal(player.lastThreatEvent, 'defensive-shot-interrupt');

  const struck = applyThreatContact({ ...createPlayerState(), elapsedSeconds: 10 });
  const late = fireDefensiveShot(setRifleRaised({ ...struck, elapsedSeconds: 11 }, true));
  assert.equal(late.lastThreatEvent, 'defensive-shot-too-late');
  const idle = fireDefensiveShot(setRifleRaised(createPlayerState(), true));
  assert.equal(idle.lastThreatEvent, 'defensive-shot-missed-window');
});

test('a later contact without body margin fails while the first contact remains recoverable', () => {
  const first = applyThreatContact(createPlayerState());
  assert.equal(first.failed, false);
  assert.equal(first.bodyMargin, 0);
  const second = applyThreatContact(first);
  assert.equal(second.failed, true);
  assert.equal(second.failureCause, 'second-unblocked-strike');
});

test('pause freezes a raised camera and live shutter commitment without spending a plate', () => {
  let player = startExposure(setCameraRaised(createPlayerState(), true));
  player = setPaused(player, true, 'window-inactive');
  const after = stepPlayer(player, {}, 20);
  assert.equal(after.pendingExposure.remainingSeconds, EXPOSURE_SECONDS);
  assert.equal(after.plates[0].status, 'unexposed');
  assert.equal(after.elapsedSeconds, 0);
});

test('restart clears observation, proof, damage and action history', () => {
  let player = createPlayerState();
  player = examine({ ...player, zone: 'brook-blind' });
  player.plates[0] = { ...player.plates[0], status: 'exposed', points: 2 };
  player.bodyMargin = 0;
  player.gunshotFired = true;
  player.cartridges = 1;
  const restarted = restartPlayer(player);
  assert.equal(restarted.examinedTrack, false);
  assert.equal(restarted.plates.every((plate) => plate.status === 'unexposed'), true);
  assert.equal(restarted.bodyMargin, 1);
  assert.equal(restarted.cartridges, 2);
  assert.equal(restarted.remainingLight, INITIAL_LIGHT_SECONDS);
  assert.equal(restarted.runStatus, 'active');
});

test('intact evidence and all four result thresholds are deterministic', () => {
  const player = createPlayerState();
  player.plates = [
    { ...player.plates[0], status: 'exposed', points: 2 },
    { ...player.plates[1], status: 'cracked', points: 0, lostPoints: 2 },
    { ...player.plates[2], status: 'exposed', points: 1 },
    player.plates[3],
  ];
  assert.equal(intactEvidence(player), 3);
  assert.equal(resultBandForEvidence(0).key, 'returned-without-record');
  assert.equal(resultBandForEvidence(3).key, 'insufficient-record');
  assert.equal(resultBandForEvidence(5).key, 'corroborating-record');
  assert.equal(resultBandForEvidence(7).key, 'strong-field-record');
});

test('routes cost only their walk; the open creek under attack strikes the latest plate', () => {
  const proof = (changes = {}) => {
    const player = { ...createPlayerState(), reachedGlade: true, zone: 'iguanodon-glade', ...changes };
    player.plates = player.plates.map((plate, index) => ({
      ...plate, status: index < 3 ? 'exposed' : 'unexposed', points: index < 3 ? 2 : 0,
    }));
    return player;
  };
  let covered = teleport(proof(), -3.7, 18);
  assert.equal(covered.returnRoute, 'covered');
  assert.ok(Math.abs(covered.remainingLight - (INITIAL_LIGHT_SECONDS - 0.1)) < 1e-8);
  covered = teleport(covered, 0, 70);
  assert.equal(covered.result.band, 'strong-field-record');
  assert.equal(covered.result.route, 'covered');

  const struck = teleport(proof({ threatAwareness: 3, threatState: 'attack' }), 7, 18);
  assert.equal(struck.returnRoute, 'exposed');
  assert.equal(struck.returnStrike, true);
  assert.equal(struck.plates[2].status, 'cracked');
  assert.equal(struck.plates[0].status, 'exposed');
  assert.equal(struck.bodyMargin, 1);
});

test('running out of light names the cause and a cue that fits the run', () => {
  const idle = placed(3, 45, { remainingLight: 0.05 });
  assert.equal(idle.failureCause, 'remaining-light-expired');
  assert.equal(idle.result.cue, 'The sun does not wait for a decision — keep moving down the spoor.');
  const spent = { ...createPlayerState(), remainingLight: 0.05 };
  spent.plates[0] = { ...spent.plates[0], status: 'exposed', points: 1 };
  assert.match(teleport(spent, 3, 45).result.cue, /leave the last plate unmade/);
});

test('the drinking stegosaurus is a plate only while it drinks and is on the glass', () => {
  const drinkingClock = 8 + 17 + 10;
  const glade = placed(3, 1, { reachedGlade: true, stegosaurusClock: drinkingClock }, []);
  const aimed = { ...glade, frameEvidence: [seen('stegosaurus', { projectedSize: 0.8 })] };
  assert.equal(frameForState(aimed).key, 'stegosaurus-drinking');
  assert.equal(frameForState(aimed).behavior, 'drinking');
  assert.notEqual(frameForState({ ...aimed, frameEvidence: FAMILY() }).subject, 'stegosaurus');
  assert.notEqual(frameForState({ ...aimed, stegosaurusClock: 2 }).subject, 'stegosaurus');
});
