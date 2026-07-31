import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTACT_SECONDS,
  EXPOSURE_SECONDS,
  INITIAL_PLAYER,
  applyThreatContact,
  createPlayerState,
  examine,
  fireDefensiveShot,
  frameForState,
  restartPlayer,
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

test('pause freezes both world time and movement', () => {
  const paused = setPaused(createPlayerState(), true, 'manual');
  const after = stepPlayer(paused, { forward: 1, sprint: true }, 4);
  assert.deepEqual(after.position, paused.position);
  assert.equal(after.elapsedSeconds, 0);
  assert.equal(after.pauseReason, 'manual');
});

test('a solid obstacle blocks penetration and permits axis sliding', () => {
  const player = createPlayerState();
  player.position = { x: -7, z: 80 };
  player.lastStablePosition = { ...player.position };
  const after = stepPlayer(player, { forward: 1, right: 1 }, 0.5);
  const distanceFromTent = Math.hypot(after.position.x + 3, after.position.z - 80);
  assert.ok(distanceFromTent >= 4.0, after.position);
  assert.notDeepEqual(after.position, player.position);
  assert.equal(after.collisions, 1);
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

test('territory, glade, exposed sprint and cover produce four readable threat states', () => {
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

  player.position = { x: 7, z: 18 };
  player.lastStablePosition = { ...player.position };
  player = stepPlayer(player, { forward: 1, sprint: true }, 1);
  assert.equal(player.zone, 'exposed-creek');
  assert.equal(player.threatState, 'attack');
  assert.equal(player.lastThreatEvent, 'exposed-sprint');

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
});
