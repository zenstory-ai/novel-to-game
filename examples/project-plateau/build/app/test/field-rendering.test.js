import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import { createViewmodelController } from '../src/viewmodel.js';

test('viewmodel controller owns deterministic camera, rifle and recoil pose state', () => {
  const fieldCamera = new THREE.Group();
  const rifle = new THREE.Group();
  const viewmodel = createViewmodelController({ fieldCamera, rifle });
  const player = {
    shotCount: 0,
    paused: false,
    velocity: { x: 0, z: 0 },
    distanceTravelled: 0,
  };

  viewmodel.update(1_000, player, true);
  assert.deepEqual(fieldCamera.position.toArray(), [0.59, -0.91, -1.52]);
  assert.deepEqual(rifle.position.toArray(), [0.72, -0.91, -1.14]);
  assert.equal(fieldCamera.scale.x, 0.39);
  assert.equal(rifle.scale.x, 0.205);

  viewmodel.update(1_000, { ...player, shotCount: 1 }, true);
  viewmodel.update(1_075, { ...player, shotCount: 1 }, true);
  assert.ok(Math.abs(rifle.position.y - (-0.9175)) < 1e-12);
  assert.ok(Math.abs(rifle.position.z - (-1.1)) < 1e-12);
  assert.ok(Math.abs(rifle.rotation.x - (-0.0025)) < 1e-12);

  viewmodel.update(1_200, { ...player, shotCount: 1 }, true);
  assert.deepEqual(rifle.position.toArray(), [0.72, -0.91, -1.14]);
});
