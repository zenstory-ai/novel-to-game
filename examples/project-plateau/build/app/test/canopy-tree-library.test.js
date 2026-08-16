import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { VEGETATION_LAYOUT } from '../src/environment-layout.js';
import { terrainGradient, terrainHeight, terrainWetness } from '../src/terrain.js';
import {
  CANOPY_TREE_LIBRARY_ASSET,
  attachCanopyTreeLibraryVisual,
  createCachedCanopyTreeLibraryLoader,
  updateCanopyTreeLibraryWind,
} from '../src/canopy-tree-library.js';


function fixtureTemplate() {
  const root = new THREE.Group();
  CANOPY_TREE_LIBRARY_ASSET.variantIds.forEach((variantId, variantIndex) => {
    const group = new THREE.Group();
    group.userData.variantId = variantId;
    group.userData.variantIndex = variantIndex;
    group.userData.family = variantIndex === 3
      ? 'araucaria-whorl'
      : variantIndex === 2 ? 'compound-lanceolate' : 'elliptic-waxy';
    group.userData.barkFamily = variantIndex === 2 ? 'plate-barked' : 'wet-furrowed';
    for (const name of ['canopy-tree-load-bearing-structure', 'canopy-tree-attached-leaves']) {
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
  const asset = new URL(`../public${CANOPY_TREE_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const load = createCachedCanopyTreeLibraryLoader({
    loaderFactory: () => ({
      loadAsync: () => new GLTFLoader().parseAsync(arrayBuffer, ''),
    }),
  });
  return load();
}

test('original canopy-tree library is deterministic, budget matched and project-owned', () => {
  const asset = new URL('../public' + CANOPY_TREE_LIBRARY_ASSET.url, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, CANOPY_TREE_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), CANOPY_TREE_LIBRARY_ASSET.sha256);
  assert.ok(CANOPY_TREE_LIBRARY_ASSET.triangles <= 34_000);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.variantIds.length, CANOPY_TREE_LIBRARY_ASSET.variantCount);
  assert.ok(CANOPY_TREE_LIBRARY_ASSET.drawCalls <= 8);
});


test('cached canopy-tree loader clamps imported materials to dielectric bounds', async () => {
  let loads = 0;
  const load = createCachedCanopyTreeLibraryLoader({
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
    assert.ok(object.material.envMapIntensity <= 0.32);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});





test('128 canopy trees remain vertical, supported, dimensioned and wind-shadow coupled', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  for (const tree of VEGETATION_LAYOUT.trees) {
    const placementAnchor = new THREE.Group();
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    anchor.add(placementAnchor);
  }
  const fallbackMeshes = Array.from({ length: 9 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const terrain = { terrainHeight, terrainGradient, terrainWetness };
  const first = attachCanopyTreeLibraryVisual(anchor, template, VEGETATION_LAYOUT.trees, terrain);
  const second = attachCanopyTreeLibraryVisual(anchor, template, VEGETATION_LAYOUT.trees, terrain);
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, VEGETATION_LAYOUT.trees.length);
  assert.equal(first.children.length, CANOPY_TREE_LIBRARY_ASSET.drawCalls);
  for (const mesh of first.children) {
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
  }
  updateCanopyTreeLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  updateCanopyTreeLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
});
