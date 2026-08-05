import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

import {
  attachHy3dRifleVisual,
  createCachedHy3dRifleLoader,
  createHy3dRifleInstance,
  HY3D_RIFLE_ASSET,
} from '../src/hy3d-rifle.js';

function templateWithMesh() {
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.25, 1.15),
    new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.9 }),
  ));
  return template;
}

test('HY3D rifle-and-hands viewmodel is the only production gun asset and stays within budget', () => {
  assert.equal(HY3D_RIFLE_ASSET.url, '/assets/expedition-rifle-hands-hy3d-v31-50k-1k.glb');
  assert.ok(HY3D_RIFLE_ASSET.bytes < 1_100_000);
  assert.equal(HY3D_RIFLE_ASSET.triangles, 50_000);
  assert.equal(HY3D_RIFLE_ASSET.textureSize, 1024);
  assert.ok(HY3D_RIFLE_ASSET.approximateGpuMiB <= 18);
  assert.equal(HY3D_RIFLE_ASSET.integratedHands, 2);
  assert.deepEqual(HY3D_RIFLE_ASSET.gripRoles, ['fore-end-support', 'trigger-grip']);
  const asset = new URL(`../public${HY3D_RIFLE_ASSET.url}`, import.meta.url);
  assert.equal(statSync(asset).size, HY3D_RIFLE_ASSET.bytes);
  assert.equal(
    createHash('sha256').update(readFileSync(asset)).digest('hex'),
    'db4f0a6dc2cab117e913b9179d31882c02c64c1f20de0e8645a06ba1f39c411c',
  );
});

test('rifle loader caches one matte local template', async () => {
  let loads = 0;
  const load = createCachedHy3dRifleLoader({
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
  assert.ok(mesh.material.roughness >= 0.72);
  assert.ok(mesh.material.metalness <= 0.78);
  assert.ok(first.userData.sourceBounds);
});

test('rifle mount receives one integrated HY3D held-rifle visual without procedural hands', async () => {
  const load = createCachedHy3dRifleLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: templateWithMesh() }) }),
  });
  const template = await load();
  const mount = new THREE.Group();
  const first = attachHy3dRifleVisual(mount, template);
  const second = attachHy3dRifleVisual(mount, template);
  assert.equal(first, second);
  assert.equal(mount.children.length, 1);
  assert.equal(first.userData.singleAssetPath, true);
  assert.equal(first.userData.integratedHands, 2);
  assert.deepEqual(first.userData.gripRoles, ['fore-end-support', 'trigger-grip']);
  assert.equal(first.children[0].scale.x, 4.3);
  assert.equal(first.getObjectByProperty('isMesh', true).geometry.type, 'BoxGeometry');
});

test('standalone held-rifle instance preserves the long local-Z silhouette plus hand width', () => {
  const template = templateWithMesh();
  const visual = createHy3dRifleInstance(template);
  const bounds = new THREE.Box3().setFromObject(visual);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.z > size.y * 4);
  assert.ok(size.z > size.x * 2.5);
});
