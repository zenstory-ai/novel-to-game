import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import { SUN_DIRECTION } from '../src/atmosphere.js';
import { createFieldLighting } from '../src/field-lighting.js';
import { createViewmodelController } from '../src/viewmodel.js';

test('field lighting preserves the authored energy and shadow rig', () => {
  const scene = new THREE.Scene();
  const { sun } = createFieldLighting(scene);

  assert.equal(scene.children.length, 9);
  assert.equal(sun.type, 'DirectionalLight');
  assert.equal(sun.intensity, 2.65);
  assert.ok(sun.position.clone().normalize().distanceTo(SUN_DIRECTION) < 1e-12);
  assert.ok(Math.abs(sun.position.length() - 106) < 1e-12);
  assert.deepEqual(sun.shadow.mapSize.toArray(), [2048, 2048]);
  assert.deepEqual(
    [
      sun.shadow.camera.left,
      sun.shadow.camera.right,
      sun.shadow.camera.top,
      sun.shadow.camera.bottom,
      sun.shadow.camera.near,
      sun.shadow.camera.far,
    ],
    [-58, 58, 74, -74, 8, 230],
  );
});

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
