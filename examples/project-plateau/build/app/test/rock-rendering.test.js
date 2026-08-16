import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import * as rocks from '../src/rock-rendering.js';

test('rock rendering keeps its public facade and authored family geometry', () => {
  assert.deepEqual(Object.keys(rocks), [
    'basaltDetailTextures',
    'createFracturedBasaltGeometry',
    'createNonColumnarRockGeometry',
    'createWeatheredRockGeometry',
    'makeNonColumnarRockFamilies',
    'renderedRockObstacleCandidate',
    'rockTextures',
    'settleRockOnTerrain',
  ]);
  assert.equal(rocks.basaltDetailTextures.albedo.name, 'world.material.basalt-albedo');
  assert.equal(rocks.rockTextures.albedo.name, 'world.material.weathered-rock-albedo');

  const families = ['fluvial-cobble', 'bedded-slab', 'angular-talus'];
  const geometries = families.map((family) => rocks.createNonColumnarRockGeometry(family));
  assert.deepEqual(
    geometries.map((geometry) => geometry.getAttribute('position').count),
    [86, 378, 63],
  );
  assert.deepEqual(
    geometries.map(({ userData }) => [userData.family, userData.supportVertexCount]),
    [
      ['fluvial-cobble', 29],
      ['bedded-slab', 54],
      ['angular-talus', 18],
    ],
  );
});

test('rock family assembly preserves scene, support and brook obstacle evidence', () => {
  const scene = new THREE.Scene();
  const group = rocks.makeNonColumnarRockFamilies(scene);

  assert.equal(scene.children.at(-1), group);
  assert.equal(group.name, 'world.authored-non-columnar-rock-families');
  assert.deepEqual(
    group.children.map((mesh) => [
      mesh.userData.family,
      mesh.count,
      mesh.userData.supportEvidence.length,
    ]),
    [
      ['fluvial-cobble', 6, 6],
      ['bedded-slab', 6, 6],
      ['angular-talus', 6, 6],
    ],
  );
  assert.equal(group.userData.brookObstacleCandidates.length, 6);
});
