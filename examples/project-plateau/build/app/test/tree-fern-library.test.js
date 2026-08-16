import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { HABITAT_TREE_LAYOUT } from '../src/environment-layout.js';
import { terrainGradient, terrainHeight, terrainWetness } from '../src/terrain.js';
import {
  TREE_FERN_LIBRARY_ASSET,
  attachTreeFernLibraryVisual,
  createCachedTreeFernLibraryLoader,
  updateTreeFernLibraryWind,
} from '../src/tree-fern-library.js';


function fixtureTemplate() {
  const root = new THREE.Group();
  TREE_FERN_LIBRARY_ASSET.variantIds.forEach((variantId, variantIndex) => {
    const group = new THREE.Group();
    group.userData.variantId = variantId;
    group.userData.variantIndex = variantIndex;
    for (const name of [
      'tree-fern-root-trunk',
      'tree-fern-load-bearing-rachises',
      'tree-fern-attached-leaflets',
    ]) {
      const geometry = new THREE.BoxGeometry();
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
  const asset = new URL(`../public${TREE_FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const load = createCachedTreeFernLibraryLoader({
    loaderFactory: () => ({
      loadAsync: () => new GLTFLoader().parseAsync(arrayBuffer, ''),
    }),
  });
  return load();
}

test('original tree-fern library is deterministic, bounded and project-owned', () => {
  const asset = new URL('../public' + TREE_FERN_LIBRARY_ASSET.url, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, TREE_FERN_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), TREE_FERN_LIBRARY_ASSET.sha256);
  assert.ok(TREE_FERN_LIBRARY_ASSET.triangles <= 20_000);
  assert.equal(TREE_FERN_LIBRARY_ASSET.variantIds.length, TREE_FERN_LIBRARY_ASSET.variantCount);
  assert.ok(TREE_FERN_LIBRARY_ASSET.drawCalls <= 9);
});


test('cached tree-fern loader clamps imported materials to dielectric bounds', async () => {
  let loads = 0;
  const load = createCachedTreeFernLibraryLoader({
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
    assert.ok(object.material.roughness >= 0.9);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.34);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});



test('tree-fern library stays vertical, grounds all roots and couples colour/depth wind', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  HABITAT_TREE_LAYOUT.forEach(([x, z]) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.position.set(x, terrainHeight(x, z), z);
    anchor.add(placementAnchor);
  });
  const fallbackMeshes = Array.from({ length: 4 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const terrain = { terrainHeight, terrainGradient, terrainWetness };
  const first = attachTreeFernLibraryVisual(anchor, template, HABITAT_TREE_LAYOUT, terrain);
  const second = attachTreeFernLibraryVisual(anchor, template, HABITAT_TREE_LAYOUT, terrain);
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, HABITAT_TREE_LAYOUT.length);
  assert.equal(first.children.length, TREE_FERN_LIBRARY_ASSET.drawCalls);
  for (const mesh of first.children) {
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
  }
  updateTreeFernLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  updateTreeFernLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
});
