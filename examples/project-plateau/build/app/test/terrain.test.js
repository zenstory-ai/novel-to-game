import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { SCENE_BUDGET } from '../src/config.js';
import { VEGETATION_LAYOUT } from '../src/environment-layout.js';
import {
  terrainGradient,
  terrainHeight,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from '../src/terrain.js';
import { createWorld } from '../src/world.js';

test('terrain field is deterministic, finite and visibly multi-scale', () => {
  const samples = [];
  for (let z = -90; z <= 90; z += 10) {
    for (let x = -80; x <= 80; x += 10) {
      const first = terrainHeight(x, z);
      const second = terrainHeight(x, z);
      assert.equal(first, second);
      assert.ok(Number.isFinite(first));
      assert.ok(Number.isFinite(terrainVariation(x, z)));
      samples.push(first);
    }
  }

  const relief = Math.max(...samples) - Math.min(...samples);
  assert.ok(relief >= 2.8, `terrain relief is still too flat: ${relief}`);
  assert.ok(relief <= 7.5, `terrain relief exceeds the traversal budget: ${relief}`);

  const oneMetreChanges = [
    Math.abs(terrainHeight(23, 18) - terrainHeight(24, 18)),
    Math.abs(terrainHeight(-31, -52) - terrainHeight(-31, -51)),
    Math.abs(terrainHeight(42, 63) - terrainHeight(43, 63)),
  ];
  assert.ok(oneMetreChanges.some((change) => change >= 0.015), oneMetreChanges);
});

test('terrain derivatives stay gentle on the playable route while preserving rolling relief', () => {
  const route = [
    [0, 70], [0, 45], [0, 18], [-10, 18], [-17, 8], [0, -10], [0, -30], [12, -40],
  ];
  for (const [x, z] of route) {
    const gradient = terrainGradient(x, z);
    assert.ok(Math.hypot(gradient.x, gradient.z) <= 0.2, { x, z, gradient });
    assert.ok(terrainSlope(x, z) <= 0.2, { x, z, slope: terrainSlope(x, z) });
  }

  assert.ok(terrainWetness(-11, 34) > terrainWetness(48, 34));
  assert.ok(terrainVariation(-37, -48) !== terrainVariation(37, 48));
});

test('terrain renders as a bounded low-cost layer without a repeated marker-like ground-cover field', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const terrain = scene.getObjectByName('world.connected_route.terrain');

  assert.equal(terrain.geometry.userData.profile, 'warped-multiscale-heightfield');
  assert.ok(terrain.geometry.userData.widthSegments >= 96);
  assert.ok(terrain.geometry.userData.heightSegments >= 112);
  assert.equal(terrain.material.userData.surface, 'slope-wetness-exposure-vertex-palette');
  assert.equal(scene.getObjectByName('world.connected_route.ground-cover'), undefined);
  assert.equal(VEGETATION_LAYOUT.ferns.length, SCENE_BUDGET.ferns);
  assert.ok(VEGETATION_LAYOUT.ferns.every(({ x, z }) => (
    !(z > -58 && z < 18 && Math.abs(x - 1) < 22)
  )), 'fern clusters must not repopulate the protected family sightline');
});
