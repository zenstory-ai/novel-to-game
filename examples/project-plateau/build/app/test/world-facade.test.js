import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import { createAtmosphere } from '../src/atmosphere.js';
import { CANOPY_WIND_PROFILE, createWorld } from '../src/world.js';

test('world facade preserves its public snapshot and wind API', () => {
  const world = createWorld(new THREE.Scene());

  assert.deepEqual(CANOPY_WIND_PROFILE.direction, [0.82, 0, 0.57]);
  assert.equal(typeof world.assetSnapshot, 'function');
  assert.equal(typeof world.brookResponseSnapshot, 'function');
  const snapshot = world.assetSnapshot();
  assert.deepEqual(Object.keys(snapshot), [
    'terrain',
    'brook',
    'brookBoulder',
    'canopyTreeLibrary',
    'vegetation',
    'treeFernLibrary',
    'fernLibrary',
    'nonColumnarRocks',
    'basaltShelf',
    'basaltRubble',
    'fieldCamera',
    'rifle',
    'pterodactyl',
    'cover',
    'heroGingko',
    'family',
    'gladeComposition',
    'degradableGroundAccents',
    'groundCoverLibrary',
    'environmentDensity',
  ]);
  assert.deepEqual(snapshot.terrain, {
    profile: 'named-process-heightfield-with-brook-glade-and-east-escarpment',
    vertices: 24505,
    surface: 'source-coupled-ecological-soil-and-basalt-weathering',
  });
  assert.equal(snapshot.brook.sceneCapture.status, 'pending-renderer');
  assert.equal(snapshot.environmentDensity.instanceCount, 1696);
  assert.deepEqual(Object.keys(world.brookResponseSnapshot()), ['state', 'position']);
});

test('atmosphere facade preserves lighting, cloud and ridge observations', () => {
  const atmosphere = createAtmosphere(new THREE.Scene());

  assert.equal(
    atmosphere.userData.environmentLighting,
    'bounded-pmrem-physical-sky-dielectric-response',
  );
  assert.equal(typeof atmosphere.userData.cloudFieldSnapshot, 'function');
  assert.equal(typeof atmosphere.userData.ridgeForestSnapshot, 'function');
  assert.equal(atmosphere.userData.ridgeForestSnapshot().ridgeCount, 2);
  assert.deepEqual(atmosphere.userData.cloudFieldSnapshot().physics, {
    medium: 'water-droplet-participating-medium',
    extinctionLaw: 'Beer-Lambert',
    lighting: 'height-ambient-plus-sun-ray-self-shadow',
    condensationBase: 'shared-lifting-condensation-level',
  });
  const [farRidge, nearRidge] = atmosphere.userData.ridgeForestSnapshot().ridges;
  assert.deepEqual(
    [
      farRidge.broadCrownComponentCount,
      farRidge.broadCrownFoliageCohortCount,
      farRidge.broadCrownStructuralBranchCount,
      farRidge.narrowCrownComponentCount,
      farRidge.narrowCrownFoliageCohortCount,
      farRidge.narrowCrownStructuralBranchCount,
    ],
    [20, 11, 9, 5, 4, 1],
  );
  assert.ok(farRidge.broadCrownTriangleCount > 0);
  assert.ok(farRidge.narrowCrownTriangleCount > 0);
  assert.ok(nearRidge.broadCrownTriangleCount > 0);
  assert.ok(nearRidge.narrowCrownTriangleCount > 0);
  assert.equal(
    atmosphere.userData.cloudFieldSnapshot().overheadCoupling.version,
    'world-space-overhead-cloud-and-sun-shadow-v1',
  );
});
