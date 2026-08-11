import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTACT_SECONDS,
  EXPOSURE_SECONDS,
  INITIAL_LIGHT_SECONDS,
  INITIAL_PLAYER,
  NAVIGATION,
  applyThreatContact,
  createPlayerState,
  examine,
  fireDefensiveShot,
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

test('the measured compact route starts with a 180-second light budget', () => {
  assert.equal(INITIAL_LIGHT_SECONDS, 180);
  assert.equal(createPlayerState().remainingLight, 180);
});

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

test('zone topology distinguishes the observation fork and both return routes', () => {
  assert.equal(zoneForPosition({ x: 0, z: 70 }), 'fort');
  assert.equal(zoneForPosition({ x: 0, z: 45 }), 'brook-blind');
  assert.equal(zoneForPosition({ x: 0, z: 18 }), 'canopy-overlook');
  assert.equal(zoneForPosition({ x: 7, z: 18 }), 'basalt-shelf');
  assert.equal(zoneForPosition({ x: 0, z: -20 }), 'iguanodon-glade');
  assert.equal(zoneForPosition({ x: 0, z: 18 }, true), 'covered-return');
  assert.equal(zoneForPosition({ x: 7, z: 18 }, true), 'exposed-creek');
});

test('territory, glade, open proof and cover produce four readable threat states', () => {
  let player = createPlayerState();
  player.position = { x: 0, z: 18 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.zone, 'canopy-overlook');
  assert.equal(player.threatState, 'watch');

  player.position = { x: 0, z: -10 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.zone, 'iguanodon-glade');
  assert.equal(player.threatState, 'search');

  player = startExposure(setCameraRaised(player, true));
  player = stepPlayer(player, {}, 1);
  player = stepPlayer(player, {}, 1);
  assert.equal(player.threatState, 'attack');
  assert.equal(player.lastThreatEvent, 'plate-exposure:+2');

  player.position = { x: 0, z: 18 };
  player.lastStablePosition = { ...player.position };
  for (let second = 0; second < 6; second += 1) player = stepPlayer(player, {}, 1);
  assert.equal(player.zone, 'covered-return');
  assert.equal(player.threatState, 'search');
  assert.equal(player.lastThreatEvent, 'cover-deescalation');
});

test('examining the brook makes context eligible without awarding evidence', () => {
  let player = createPlayerState();
  player.position = { x: 0, z: 45 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(frameForState(player).points, 0);
  player = examine(player);
  assert.equal(player.examinedTrack, true);
  assert.equal(player.lastObservation, 'Three toes. Fresh. The brook runs back to camp.');
  assert.equal(player.plates.reduce((total, plate) => total + plate.points, 0), 0);
  assert.equal(frameForState(player).points, 1);
});

test('successive observed glade plates record young play and branch pull separately', () => {
  const player = createPlayerState();
  player.zone = 'iguanodon-glade';
  player.observedBehavior = true;
  const play = frameForState(player);
  assert.equal(play.key, 'glade-young-play');
  assert.match(play.label, /young play/i);

  player.plates[0] = {
    ...player.plates[0],
    status: 'exposed',
    points: play.points,
    label: play.label,
    frameKey: play.key,
  };
  const branch = frameForState(player);
  assert.equal(branch.key, 'glade-branch-pull');
  assert.match(branch.label, /branch/i);
  assert.equal(branch.points, 2);
});

test('camera raise slows movement and shutter commits one physical plate for two live seconds', () => {
  let normal = createPlayerState();
  normal.position = { x: 0, z: 45 };
  normal.lastStablePosition = { ...normal.position };
  normal = stepPlayer(normal, {}, 0.1);
  normal = examine(normal);

  const walking = stepPlayer(normal, { forward: 1 }, 1);
  let camera = setCameraRaised(normal, true);
  const careful = stepPlayer(camera, { forward: 1 }, 1);
  assert.ok(normal.position.z - careful.position.z < normal.position.z - walking.position.z);
  assert.equal(camera.plateRailRevealed, true);

  camera = startExposure(camera);
  assert.equal(camera.pendingExposure.remainingSeconds, EXPOSURE_SECONDS);
  const held = stepPlayer(camera, { forward: 1 }, 1);
  assert.deepEqual(held.position, camera.position);
  assert.equal(held.plates[0].status, 'unexposed');
  const exposed = stepPlayer(held, { forward: 1 }, 1);
  assert.equal(exposed.pendingExposure, null);
  assert.equal(exposed.plates[0].status, 'exposed');
  assert.equal(exposed.plates[0].points, 1);
  assert.equal(exposed.plates[0].label, 'PARTIAL — foliage hides the flank.');
  assert.equal(exposed.threatAwareness, 1);
  assert.equal(exposed.cameraRaised, false);
});

test('open proof adds two awareness states and contact cracks the best intact plate', () => {
  let player = createPlayerState();
  player.position = { x: 8, z: 18 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.threatAwareness, 1);
  player = startExposure(setCameraRaised(player, true));
  for (let second = 0; second < EXPOSURE_SECONDS; second += 1) player = stepPlayer(player, {}, 1);
  assert.equal(player.threatState, 'attack');
  assert.equal(player.plates[0].points, 2);

  for (let second = 0; second < CONTACT_SECONDS; second += 1) player = stepPlayer(player, {}, 1);
  assert.equal(player.bodyMargin, 0);
  assert.equal(player.threatState, 'watch');
  assert.equal(player.plates[0].status, 'cracked');
  assert.equal(player.plates[0].points, 0);
  assert.equal(player.plates[0].lostPoints, 2);
  assert.equal(player.failed, false);
});

test('a later contact without body margin fails while the first contact remains recoverable', () => {
  const first = applyThreatContact(createPlayerState());
  assert.equal(first.failed, false);
  assert.equal(first.bodyMargin, 0);
  const second = applyThreatContact(first);
  assert.equal(second.failed, true);
  assert.equal(second.failureCause, 'second-unblocked-strike');
});

test('a timely raised-rifle shot spends one cartridge and interrupts attack', () => {
  let player = createPlayerState();
  player.threatAwareness = 3;
  player.threatState = 'attack';
  player.attackSeconds = 1.5;
  player = setRifleRaised(player, true);
  player = fireDefensiveShot(player);
  assert.equal(player.cartridges, 1);
  assert.equal(player.gunshotFired, true);
  assert.equal(player.brookResponse, 'answering-call');
  assert.equal(player.shotCount, 1);
  assert.equal(player.threatAwareness, 1);
  assert.equal(player.threatState, 'watch');
  assert.equal(player.attackSeconds, 0);
  assert.equal(player.lastThreatEvent, 'defensive-shot-interrupt');
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
  assert.equal(restarted.gunshotFired, false);
  assert.equal(restarted.cartridges, 2);
  assert.equal(restarted.remainingLight, INITIAL_LIGHT_SECONDS);
  assert.equal(restarted.returnRoute, null);
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

test('covered return commits its deterministic cost once and submits intact proof at Fort', () => {
  let player = createPlayerState();
  player.reachedGlade = true;
  player.zone = 'iguanodon-glade';
  player.position = { x: 0, z: -8 };
  player.lastStablePosition = { ...player.position };
  player.plates = player.plates.map((plate, index) => ({
    ...plate,
    status: index < 3 ? 'exposed' : 'unexposed',
    points: index < 3 ? 2 : 0,
  }));
  player.position = { x: 0, z: 18 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.returnRoute, 'covered');
  assert.equal(player.returnCostSeconds, 28);
  assert.equal(player.remainingLight, INITIAL_LIGHT_SECONDS - 28.1);
  const afterHold = stepPlayer(player, {}, 0.1);
  assert.equal(afterHold.returnCostSeconds, 28);
  assert.ok(Math.abs(afterHold.remainingLight - (INITIAL_LIGHT_SECONDS - 28.2)) < 1e-8);

  player = afterHold;
  player.position = { x: 0, z: 70 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.runStatus, 'result');
  assert.equal(player.result.band, 'strong-field-record');
  assert.equal(player.result.evidence, 6);
  assert.equal(player.result.route, 'covered');
});

test('an attack-state exposed return cracks the best plate without spending body margin', () => {
  let player = createPlayerState();
  player.reachedGlade = true;
  player.zone = 'iguanodon-glade';
  player.position = { x: 7, z: 18 };
  player.lastStablePosition = { ...player.position };
  player.threatAwareness = 3;
  player.threatState = 'attack';
  player.plates[0] = { ...player.plates[0], status: 'exposed', points: 1 };
  player.plates[1] = { ...player.plates[1], status: 'exposed', points: 2 };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.returnRoute, 'exposed');
  assert.equal(player.returnCostSeconds, 12);
  assert.equal(player.returnStrike, true);
  assert.equal(player.plates[1].status, 'cracked');
  assert.equal(player.bodyMargin, 1);
  assert.equal(player.threatState, 'watch');
});

test('a fired-shot exposed return costs eighteen seconds and preserves its best plate', () => {
  let player = createPlayerState();
  player.reachedGlade = true;
  player.zone = 'iguanodon-glade';
  player.position = { x: 7, z: 18 };
  player.lastStablePosition = { ...player.position };
  player.threatAwareness = 1;
  player.threatState = 'watch';
  player.gunshotFired = true;
  player.plates[0] = { ...player.plates[0], status: 'exposed', points: 2 };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.returnRoute, 'exposed');
  assert.equal(player.returnCostSeconds, 18);
  assert.equal(player.returnStrike, false);
  assert.equal(player.plates[0].status, 'exposed');
  assert.equal(player.brookResponse, 'brush-moving');

  player.position = { x: 0, z: 70 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.result.brookResponse, 'brush-moving');
  assert.equal(player.result.gunshotCallback, 'The report carried. Something answered by the brook.');
});

test('remaining light expires outside Fort with exact cause and actionable cue', () => {
  let player = createPlayerState();
  player.zone = 'brook-blind';
  player.position = { x: 0, z: 45 };
  player.lastStablePosition = { ...player.position };
  player.remainingLight = 0.05;
  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.runStatus, 'failure');
  assert.equal(player.failureCause, 'remaining-light-expired');
  assert.equal(player.result.copy, 'The basin went dark. The brook was no longer enough.');
  assert.equal(player.result.cue, 'Leave the last frame, or take the shorter return while it is still usable.');
});
