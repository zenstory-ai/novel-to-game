import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { FERN_LIBRARY_LAYOUT } from '../src/environment-layout.js';
import {
  attachFernLibraryVisual,
  createCachedFernLibraryLoader,
  FERN_LIBRARY_ASSET,
  updateFernLibraryWind,
} from '../src/fern-library.js';
import { terrainGradient, terrainHeight, terrainWetness } from '../src/terrain.js';


function fixtureTemplate() {
  const root = new THREE.Group();
  FERN_LIBRARY_ASSET.variantIds.forEach((variantId, variantIndex) => {
    const group = new THREE.Group();
    group.userData.variantId = variantId;
    group.userData.variantIndex = variantIndex;
    for (const name of ['fern-load-bearing-structure', 'fern-attached-leaflets']) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.setAttribute('uv1', geometry.getAttribute('uv').clone());
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0xffffff,
        emissiveIntensity: 2,
        envMapIntensity: 3,
      }));
      mesh.name = name;
      mesh.userData.name = name;
      group.add(mesh);
    }
    root.add(group);
  });
  return root;
}

async function loadActualTemplate() {
  const asset = new URL(`../public${FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const load = createCachedFernLibraryLoader({
    loaderFactory: () => ({
      async loadAsync() {
        return new GLTFLoader().parseAsync(arrayBuffer, '');
      },
    }),
  });
  return load();
}

test('original fern library is deterministic, compact, diverse and project-owned', () => {
  const asset = new URL('../public' + FERN_LIBRARY_ASSET.url, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, FERN_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), FERN_LIBRARY_ASSET.sha256);
  assert.ok(FERN_LIBRARY_ASSET.triangles <= 7_000);
  assert.equal(FERN_LIBRARY_ASSET.variantIds.length, FERN_LIBRARY_ASSET.variantCount);
  assert.ok(FERN_LIBRARY_ASSET.drawCalls <= 6);
});


test('cached fern loader clamps imported materials to non-emissive dielectric bounds', async () => {
  let loads = 0;
  const load = createCachedFernLibraryLoader({
    assetUrl: '/fixture.glb',
    loaderFactory: () => ({
      async loadAsync(url) {
        loads += 1;
        assert.equal(url, '/fixture.glb');
        return { scene: fixtureTemplate() };
      },
    }),
  });
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(first, second);
  assert.equal(loads, 1);
  first.traverse((object) => {
    if (!object.isMesh) return;
    assert.equal(object.castShadow, true);
    assert.equal(object.receiveShadow, true);
    assert.ok(object.material.roughness >= 0.86);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.34);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});



test('fern library settles every rhizome, hides fallback and couples colour/depth wind', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  const fallbackMeshes = Array.from({ length: 3 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const terrain = { terrainHeight, terrainGradient, terrainWetness };
  const first = attachFernLibraryVisual(anchor, template, FERN_LIBRARY_LAYOUT, terrain);
  const second = attachFernLibraryVisual(anchor, template, FERN_LIBRARY_LAYOUT, terrain);
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, FERN_LIBRARY_LAYOUT.length);
  assert.equal(first.children.length, FERN_LIBRARY_ASSET.drawCalls);
  for (const mesh of first.children) {
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
  }
  updateFernLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  updateFernLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
});
