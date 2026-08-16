import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  attachGroundCoverLibraryVisual,
  createCachedGroundCoverLibraryLoader,
  GROUND_COVER_LIBRARY_ASSET,
  updateGroundCoverLibraryWind,
} from '../src/ground-cover-library.js';
import { terrainGradient, terrainHeight } from '../src/terrain.js';
import { createWorld } from '../src/world.js';


function fixtureTemplate() {
  const root = new THREE.Group();
  GROUND_COVER_LIBRARY_ASSET.variantIds.forEach((variantId, variantIndex) => {
    const group = new THREE.Group();
    group.userData.variantId = variantId;
    group.userData.variantIndex = variantIndex;
    for (const name of [
      'ground-cover-load-bearing-structure',
      'ground-cover-attached-leaves',
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
  const asset = new URL(`../public${GROUND_COVER_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const load = createCachedGroundCoverLibraryLoader({
    loaderFactory: () => ({
      loadAsync: () => new GLTFLoader().parseAsync(arrayBuffer, ''),
    }),
  });
  return load();
}

test('original ground-cover library is deterministic, compact, diverse and project-owned', () => {
  const asset = new URL('../public' + GROUND_COVER_LIBRARY_ASSET.url, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, GROUND_COVER_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), GROUND_COVER_LIBRARY_ASSET.sha256);
  assert.ok(GROUND_COVER_LIBRARY_ASSET.triangles <= 3_000);
  assert.equal(GROUND_COVER_LIBRARY_ASSET.variantIds.length, GROUND_COVER_LIBRARY_ASSET.variantCount);
  assert.ok(GROUND_COVER_LIBRARY_ASSET.drawCalls <= 6);
});


test('cached ground-cover loader clamps imported materials to dielectric bounds', async () => {
  let loads = 0;
  const load = createCachedGroundCoverLibraryLoader({
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
    assert.ok(object.material.roughness >= 0.86);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.32);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});



test('ground-cover library settles every root crown and couples colour/depth wind', async () => {
  const world = createWorld(new THREE.Scene());
  const placements = world.environmentDensity.userData.groundCoverPlacements;
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  const fallbackMeshes = Array.from({ length: 3 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const terrain = { terrainHeight, terrainGradient };
  const first = attachGroundCoverLibraryVisual(anchor, template, placements, terrain);
  const second = attachGroundCoverLibraryVisual(anchor, template, placements, terrain);
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, placements.length);
  assert.equal(first.children.length, GROUND_COVER_LIBRARY_ASSET.drawCalls);
  for (const mesh of first.children) {
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
  }
  updateGroundCoverLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  updateGroundCoverLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
});
