import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_PLAYER,
  createPlayerState,
  restartPlayer,
  setPaused,
  stepPlayer,
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
