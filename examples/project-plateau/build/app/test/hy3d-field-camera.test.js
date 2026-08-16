import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
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

test('HY3D camera-and-hands viewmodel is the only production camera asset and stays within budget', () => {
  assert.equal(HY3D_FIELD_CAMERA_ASSET.url, '/assets/field-camera-hands-hy3d-v31-50k-v4-rear-view-1k.glb');
  assert.ok(HY3D_FIELD_CAMERA_ASSET.bytes < 1_120_000);
  assert.equal(HY3D_FIELD_CAMERA_ASSET.triangles, 50_000);
  assert.equal(HY3D_FIELD_CAMERA_ASSET.textureSize, 1024);
  assert.ok(HY3D_FIELD_CAMERA_ASSET.approximateGpuMiB <= 18);
  assert.equal(HY3D_FIELD_CAMERA_ASSET.integratedHands, 2);
  assert.deepEqual(HY3D_FIELD_CAMERA_ASSET.gripRoles, ['camera-left-grip', 'camera-right-grip']);
  const asset = new URL(`../public${HY3D_FIELD_CAMERA_ASSET.url}`, import.meta.url);
  assert.equal(statSync(asset).size, HY3D_FIELD_CAMERA_ASSET.bytes);
  assert.equal(
    createHash('sha256').update(readFileSync(asset)).digest('hex'),
    'b9130671704349c7e287c2edd7fa812e9f95ac04f19596957be6bd69fe1e5193',
  );
});

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
