import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_PLAYER,
  createPlayerState,
  restartPlayer,
  setPaused,
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
