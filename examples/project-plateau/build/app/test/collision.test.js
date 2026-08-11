import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INITIAL_PLAYER,
  NAVIGATION,
  collisionAt,
  collisionContractSnapshot,
  createPlayerState,
  resolveObstacleStep,
  stepPlayer,
} from '../src/simulation.js';
import { terrainHeight, terrainGradient } from '../src/terrain.js';
import { HABITAT_TREE_LAYOUT, VEGETATION_LAYOUT } from '../src/environment-layout.js';

function orientedPoint(obstacle, localX, localZ) {
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    x: obstacle.x + cosine * localX + sine * localZ,
    z: obstacle.z - sine * localX + cosine * localZ,
  };
}

test('collision contract is a jumping 3D capsule with authored solid/non-solid policy', () => {
  const contract = collisionContractSnapshot();
  assert.equal(contract.model, 'vertical-capsule-on-heightfield-with-ballistic-jump');
  assert.equal(contract.resolution, 'iterative-depenetration-with-surface-slide');
  assert.equal(contract.fixedMovementStepSeconds, 1 / 60);
  assert.deepEqual(contract.jump, {
    speed: 5.8,
    gravity: 15,
    restrictedByTools: true,
  });
  assert.equal(contract.capsule.radius, NAVIGATION.playerRadius);
  assert.ok(contract.capsule.height > contract.capsule.eyeHeight);
  assert.ok(contract.colliderCount >= 50, contract);
  assert.ok(contract.categories['tree-trunk'] >= 20, contract);
  assert.equal(contract.categories.shelter, 2);
  assert.equal(contract.categories['living-subject'], 5);
  assert.match(contract.nonSolidPolicy.airborneThreat, /state-driven-contact/);
});

test('every solid collider is finite, uniquely identified and tied to a visible anchor', () => {
  const identifiers = new Set();
  for (const collider of NAVIGATION.obstacles) {
    assert.ok(!identifiers.has(collider.id), collider.id);
    identifiers.add(collider.id);
    assert.ok(Number.isFinite(collider.x) && Number.isFinite(collider.z), collider);
    assert.ok(collider.height > 0, collider);
    assert.ok(collider.visualAnchor, collider);
    if (collider.type === 'circle') assert.ok(collider.radius > 0, collider);
    else if (collider.type === 'horizontal-capsule') {
      assert.ok(collider.radius > 0 && collider.halfLength > 0, collider);
      assert.ok(Number.isFinite(collider.rotation), collider);
    } else {
      assert.equal(collider.type, 'oriented-box');
      assert.ok(collider.halfX > 0 && collider.halfZ > 0, collider);
      assert.ok(Number.isFinite(collider.rotation), collider);
    }
  }
});

test('tree-fern collision follows the solid trunk instead of the pliable crown', () => {
  const colliders = NAVIGATION.obstacles.filter(({ id }) => id.startsWith('habitat-tree-'));
  assert.equal(colliders.length, HABITAT_TREE_LAYOUT.length);
  colliders.forEach((collider, index) => {
    const [x, z, scale] = HABITAT_TREE_LAYOUT[index];
    assert.equal(collider.x, x);
    assert.equal(collider.z, z);
    assert.equal(collider.height, scale * 3.5);
    assert.equal(collider.radius, Math.max(0.42, scale * 0.48));
    assert.equal(collider.visualAnchor, 'world.connected_route.tree-fern-sentinels');
    assert.equal(collider.visualIndex, index);
  });
});

test('canopy-tree collision stays registered to shared placement anchors', () => {
  const colliders = NAVIGATION.obstacles.filter(({ id }) => id.startsWith('vegetation-tree-'));
  assert.ok(colliders.length > 0);
  colliders.forEach((collider) => {
    const tree = VEGETATION_LAYOUT.trees[collider.visualIndex];
    assert.ok(tree, collider.id);
    assert.equal(collider.x, tree.x);
    assert.equal(collider.z, tree.z);
    assert.equal(collider.visualAnchor, 'world.connected_route.canopy-tree-sentinels');
    assert.equal(collider.height, tree.trunkScale[1] * 6);
  });
});

test('spawn and authored route checkpoints are outside all solid geometry', () => {
  const checkpoints = [
    INITIAL_PLAYER.position,
    { x: 0, z: 45 },
    { x: 0, z: 18 },
    { x: 7, z: 18 },
    { x: 0, z: -10 },
    { x: 0, z: 70 },
  ];
  checkpoints.forEach((position) => assert.equal(collisionAt(position), null, position));
});

test('circle contact follows the curved surface instead of axis-sticking', () => {
  const boulder = NAVIGATION.obstacles.find((collider) => collider.id === 'brook-boulder');
  const start = {
    x: boulder.x + boulder.radius + NAVIGATION.playerRadius + 0.18,
    z: boulder.z,
  };
  const resolved = resolveObstacleStep(start, { x: -0.34, z: -0.5 });
  assert.equal(resolved.collision, 'brook-boulder');
  assert.ok(resolved.position.z < start.z, resolved);
  assert.ok(resolved.position.x < start.x, resolved);
  assert.equal(collisionAt(resolved.position), null);
});

test('rotated tent collider preserves tangential movement along its authored canvas wall', () => {
  const tent = NAVIGATION.obstacles.find((collider) => collider.id === 'fort-tent-west');
  const start = orientedPoint(tent, -(tent.halfX + NAVIGATION.playerRadius + 0.04), -1.6);
  const desired = orientedPoint(tent, -2.95, -1.05);
  const resolved = resolveObstacleStep(start, {
    x: desired.x - start.x,
    z: desired.z - start.z,
  });
  assert.equal(resolved.collision, tent.id);
  assert.equal(collisionAt(resolved.position), null);
  const resolvedLocal = {
    x: Math.cos(tent.rotation) * (resolved.position.x - tent.x)
      - Math.sin(tent.rotation) * (resolved.position.z - tent.z),
    z: Math.sin(tent.rotation) * (resolved.position.x - tent.x)
      + Math.cos(tent.rotation) * (resolved.position.z - tent.z),
  };
  assert.ok(Math.abs(resolvedLocal.x) >= tent.halfX + NAVIGATION.playerRadius - 1e-6);
  assert.ok(resolvedLocal.z > -1.6, resolvedLocal);
});

test('an invalid overlap is deterministically depenetrated before movement resumes', () => {
  const boulder = NAVIGATION.obstacles.find((collider) => collider.id === 'brook-boulder');
  const resolved = resolveObstacleStep({ x: boulder.x, z: boulder.z }, { x: 0, z: 0 });
  assert.equal(resolved.collision, boulder.id);
  assert.equal(collisionAt(resolved.position), null);
  assert.ok(Math.abs(
    Math.hypot(resolved.position.x - boulder.x, resolved.position.z - boulder.z)
      - (boulder.radius + NAVIGATION.playerRadius),
  ) < 1e-6);
});

test('simulation ground height follows the same heightfield used by rendering', () => {
  const player = stepPlayer(createPlayerState(), { forward: 1, right: 0.35 }, 0.8);
  assert.equal(player.groundY, terrainHeight(player.position.x, player.position.z));
  const gradient = terrainGradient(player.position.x, player.position.z);
  assert.ok(Math.hypot(gradient.x, gradient.z) < 0.15, gradient);
});

test('an airborne capsule still collides with tall authored solids', () => {
  const tent = NAVIGATION.obstacles.find((collider) => collider.id === 'fort-tent-west');
  const start = orientedPoint(tent, -(tent.halfX + NAVIGATION.playerRadius + 0.08), 0);
  const desired = orientedPoint(tent, -(tent.halfX + NAVIGATION.playerRadius - 0.4), 0);
  const playerBottom = terrainHeight(start.x, start.z) + 1.05;
  const resolved = resolveObstacleStep(
    start,
    { x: desired.x - start.x, z: desired.z - start.z },
    { playerBottom, airborne: true },
  );
  assert.equal(resolved.collision, tent.id);
});
