import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import { makeRouteAndBrook, makeTerrain } from '../src/world-terrain.js';

test('terrain and connected route keep their scene construction contract', () => {
  const scene = new THREE.Scene();
  const terrain = makeTerrain(scene);
  const route = makeRouteAndBrook(scene);

  assert.equal(terrain.name, 'world.connected_route.terrain');
  assert.equal(terrain.geometry.getAttribute('position').count, 24_505);
  assert.equal(terrain.geometry.index.count, 145_152);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(terrain.geometry.attributes)
        .map(([name, attribute]) => [name, attribute.itemSize]),
    ),
    {
      position: 3,
      normal: 3,
      uv: 2,
      color: 3,
      terrainWetness: 1,
      terrainExposure: 1,
      terrainBasaltInfluence: 1,
      terrainHumus: 1,
      terrainWetBank: 1,
      terrainMineralExposure: 1,
      terrainRouteWear: 1,
      terrainAlluvium: 1,
      terrainFluvialSurface: 4,
      terrainSlope: 1,
      terrainBedrockExposure: 1,
      terrainColluvium: 1,
    },
  );

  assert.deepEqual(Object.keys(route), [
    'brook',
    'brookHydrology',
    'driftwood',
    'driftwoodSupportEvidence',
    'brookRipples',
    'brookStones',
    'brookPoints',
    'brookObstacleCandidates',
  ]);
  assert.deepEqual(
    scene.children.map(({ name }) => name),
    [
      'world.connected_route.terrain',
      'world.connected_route.brook',
      'world.connected_route.brook-ripples',
      'world.connected_route.brook-stones',
      'world.connected_route.brook-driftwood',
      'world.connected_route.brook-driftwood-variant-2',
      'world.connected_route.brook-driftwood-variant-3',
      'world.connected_route.three-toed-track',
    ],
  );
  assert.deepEqual(
    [
      route.brook.geometry.getAttribute('position').count,
      route.brook.geometry.index.count,
      route.brookHydrology.waterLevels.length,
      route.brookHydrology.reaches.length,
      route.brookHydrology.confluenceIndex,
      route.brookStones.count,
      route.brookObstacleCandidates.length,
    ],
    [3_757, 20_736, 73, 19, 35, 56, 56],
  );
  assert.deepEqual(route.driftwood.map(({ count }) => count), [4, 3, 3]);
  assert.equal(route.driftwoodSupportEvidence.instanceCount, 10);
  assert.equal(route.driftwoodSupportEvidence.supportSampleCount, 41);
  assert.ok(route.driftwoodSupportEvidence.minimumClearance >= -0.04);
  assert.ok(route.driftwoodSupportEvidence.maximumClearance <= 0.009);
});
