import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import {
  attachHy3dFieldCameraVisual,
  createCachedHy3dFieldCameraLoader,
  createHy3dFieldCameraInstance,
  HY3D_FIELD_CAMERA_ASSET,
} from '../src/hy3d-field-camera.js';

function templateWithMesh() {
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.43, 0.85),
    new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.9 }),
  ));
  return template;
}

test('field-camera loader caches one matte local template', async () => {
  let loads = 0;
  const load = createCachedHy3dFieldCameraLoader({
    assetUrl: '/fixture.glb',
    loaderFactory: () => ({
      async loadAsync(url) {
        loads += 1;
        assert.equal(url, '/fixture.glb');
        return { scene: templateWithMesh() };
      },
    }),
  });
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(first, second);
  assert.equal(loads, 1);
  const mesh = first.getObjectByProperty('isMesh', true);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, false);
  assert.ok(mesh.material.roughness >= 0.74);
  assert.ok(mesh.material.metalness <= 0.72);
});

test('camera mount receives one integrated HY3D held-camera visual without procedural hands', async () => {
  const load = createCachedHy3dFieldCameraLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: templateWithMesh() }) }),
  });
  const template = await load();
  const mount = new THREE.Group();
  const first = attachHy3dFieldCameraVisual(mount, template);
  const second = attachHy3dFieldCameraVisual(mount, template);
  assert.equal(first, second);
  assert.equal(mount.children.length, 1);
  assert.equal(first.children[0].scale.x, 2.2);
});

test('standalone held camera keeps the wide hand-and-forearm silhouette from the reference', () => {
  const visual = createHy3dFieldCameraInstance(templateWithMesh());
  const size = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3());
  assert.ok(size.x > size.y);
  assert.ok(size.z > size.y);
  assert.ok(size.z > size.x * 0.95);
});

test('held camera points its lens away from the player instead of presenting the front element', () => {
  const visual = createHy3dFieldCameraInstance(templateWithMesh());
  const model = visual.getObjectByName('tool.field_camera_hands.hy3d_model');
  const opticalForward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(model.quaternion)
    .normalize();
  assert.ok(opticalForward.z < -0.99, opticalForward.toArray());
  assert.ok(model.quaternion.angleTo(new THREE.Quaternion()) < 1e-8);
  assert.deepEqual(visual.userData.opticalForward, [0, 0, -1]);
  assert.equal(visual.userData.playerFacingSide, 'ground-glass-back');
});
