import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import { createAtmosphere } from '../src/atmosphere.js';
import { createWorld } from '../src/world.js';

test('world facade preserves its public snapshot and wind API', () => {
  const world = createWorld(new THREE.Scene());

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
  assert.equal(snapshot.terrain.vertices, 24505);
  assert.equal(snapshot.brook.sceneCapture.status, 'pending-renderer');
  assert.equal(snapshot.environmentDensity.instanceCount, 1696);
  assert.deepEqual(Object.keys(world.brookResponseSnapshot()), ['state', 'position']);
});
