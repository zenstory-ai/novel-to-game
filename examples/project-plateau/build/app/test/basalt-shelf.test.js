import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  BASALT_SHELF_ASSET,
  attachBasaltShelfVisual,
  createCachedBasaltShelfLoader,
} from '../src/basalt-shelf.js';

function fixtureTemplate() {
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(2, 4, 2),
    new THREE.MeshStandardMaterial({
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0xffffff,
      emissiveIntensity: 2,
      envMapIntensity: 3,
    }),
  ));
  return template;
}

function edgeUseCounts(geometry) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.index
    ? Array.from(geometry.index.array)
    : Array.from({ length: positions.count }, (_, index) => index);
  const key = (index) => [
    positions.getX(index),
    positions.getY(index),
    positions.getZ(index),
  ].map((value) => Math.round(value * 100_000)).join(',');
  const counts = new Map();
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const vertices = [key(indices[triangle]), key(indices[triangle + 1]), key(indices[triangle + 2])];
    for (let edge = 0; edge < 3; edge += 1) {
      const ends = [vertices[edge], vertices[(edge + 1) % 3]].sort();
      const edgeKey = `${ends[0]}|${ends[1]}`;
      counts.set(edgeKey, (counts.get(edgeKey) ?? 0) + 1);
    }
  }
  return counts;
}

test('original basalt shelf is deterministic, original and inside the environment budget', () => {
  assert.equal(BASALT_SHELF_ASSET.url, '/assets/basalt-shelf-original-v2.glb');
  assert.equal(BASALT_SHELF_ASSET.version, 'original-basalt-shelf-v2-library');
  assert.ok(BASALT_SHELF_ASSET.bytes < 300_000);
  assert.ok(BASALT_SHELF_ASSET.triangles <= 2_000);
  assert.equal(BASALT_SHELF_ASSET.variantCount, 3);
  assert.deepEqual(BASALT_SHELF_ASSET.variantIds, [
    'needle-buttress', 'split-saddle', 'terraced-fan',
  ]);
  assert.deepEqual(BASALT_SHELF_ASSET.trianglesByVariant, [660, 560, 640]);
  assert.equal(BASALT_SHELF_ASSET.drawCalls, 2);
  assert.equal(BASALT_SHELF_ASSET.shelfCount, 3);
  assert.equal(BASALT_SHELF_ASSET.fragmentCount, 6);
  assert.equal(
    BASALT_SHELF_ASSET.provenance,
    'project-original-deterministic-offline-authored-mesh-library',
  );
  assert.equal(BASALT_SHELF_ASSET.rights, 'project-original-code-authored-output');

  const asset = new URL(`../public${BASALT_SHELF_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, BASALT_SHELF_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    BASALT_SHELF_ASSET.sha256,
  );
});

test('basalt shelf meshes are closed and preserve a buried plinth-to-shelf support chain', async () => {
  const asset = new URL(`../public${BASALT_SHELF_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const meshes = [];
  let triangles = 0;
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    meshes.push(object);
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    assert.ok(object.geometry.attributes.normal, object.name);
    assert.ok(object.geometry.attributes.color, object.name);
    assert.ok(object.geometry.attributes.uv, object.name);
    assert.equal(object.material.metalness, 0, object.name);
    assert.ok(object.material.roughness >= 0.9, object.name);
    assert.equal(object.material.emissive.getHex(), 0, object.name);
    const openEdges = [...edgeUseCounts(object.geometry).values()].filter((count) => count !== 2);
    assert.deepEqual(openEdges, [], `${object.name} contains an open or non-manifold boundary`);
  });
  assert.equal(meshes.length, BASALT_SHELF_ASSET.drawCalls * BASALT_SHELF_ASSET.variantCount);
  assert.equal(triangles, BASALT_SHELF_ASSET.triangles);

  const variants = [];
  gltf.scene.traverse((object) => {
    if (object.userData?.variantId) variants.push(object);
  });
  assert.equal(variants.length, BASALT_SHELF_ASSET.variantCount);
  assert.deepEqual(variants.map(({ userData }) => userData.variantId), BASALT_SHELF_ASSET.variantIds);
  const heights = [];
  for (const variant of variants) {
    const variantMeshes = variant.children.filter((child) => child.isMesh);
    assert.equal(variantMeshes.length, BASALT_SHELF_ASSET.drawCalls, variant.name);
    const massif = variant.children.find(
      (child) => child.userData.name === 'basalt-shelf-load-bearing-massif',
    );
    const spalls = variant.children.find(
      (child) => child.userData.name === 'basalt-shelf-supported-spalls',
    );
    assert.equal(
      massif.geometry.userData.supportModel,
      'buried-plinth-to-overlapping-load-bearing-mass-and-short-benches',
    );
    assert.ok(massif.geometry.userData.contactDepthMeters >= 0.64);
    assert.equal(massif.geometry.userData.shelfCount, variant.userData.shelfCount);
    assert.equal(spalls.geometry.userData.fragmentCount, variant.userData.fragmentCount);
    assert.equal(
      spalls.geometry.userData.supportModel,
      'resting-on-bedrock-or-horizontal-mineral-bench',
    );
    const bounds = new THREE.Box3().setFromObject(variant);
    heights.push(Number(bounds.max.y.toFixed(2)));
    assert.ok(bounds.min.y <= -0.63, bounds.min.toArray());
    assert.ok(bounds.max.y >= 7.8, bounds.max.toArray());
    assert.ok(bounds.getSize(new THREE.Vector3()).x >= 7.4);
    assert.ok(bounds.getSize(new THREE.Vector3()).z >= 4.7);
    const massifPositions = massif.geometry.getAttribute('position');
    const sampledMassCentre = new THREE.Vector3();
    for (let index = 0; index < massifPositions.count; index += 1) {
      sampledMassCentre.x += massifPositions.getX(index);
      sampledMassCentre.y += massifPositions.getY(index);
      sampledMassCentre.z += massifPositions.getZ(index);
    }
    sampledMassCentre.divideScalar(massifPositions.count);
    assert.ok(
      Math.hypot(sampledMassCentre.x, sampledMassCentre.z) < 0.2,
      { variant: variant.name, sampledMassCentre },
    );
    const spallPositions = spalls.geometry.getAttribute('position');
    let minimumSpallY = Infinity;
    for (let index = 0; index < spallPositions.count; index += 1) {
      minimumSpallY = Math.min(minimumSpallY, spallPositions.getY(index));
    }
    assert.ok(minimumSpallY >= 1.09, { variant: variant.name, minimumSpallY });
  }
  assert.equal(new Set(heights).size, BASALT_SHELF_ASSET.variantCount, heights);
});

test('cached basalt loader clamps rock materials to dielectric energy bounds', async () => {
  let loads = 0;
  const load = createCachedBasaltShelfLoader({
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
  const mesh = first.getObjectByProperty('isMesh', true);
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);
  assert.ok(mesh.material.roughness >= 0.9);
  assert.equal(mesh.material.metalness, 0);
  assert.ok(mesh.material.envMapIntensity <= 0.32);
  assert.equal(mesh.material.emissive.getHex(), 0);
  assert.equal(mesh.material.emissiveIntensity, 0);
  assert.equal(mesh.material.flatShading, true);
});

test('basalt visual attaches once and receives the correlated geological texture set', async () => {
  const load = createCachedBasaltShelfLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: fixtureTemplate() }) }),
  });
  const template = await load();
  const anchor = new THREE.Group();
  anchor.userData.formationIndex = 1;
  const textures = {
    albedo: new THREE.Texture(),
    roughness: new THREE.Texture(),
    height: new THREE.Texture(),
  };
  const first = attachBasaltShelfVisual(anchor, template, textures);
  const second = attachBasaltShelfVisual(anchor, template, textures);
  assert.equal(first, second);
  assert.equal(anchor.children.filter((child) => child === first).length, 1);
  const mesh = first.getObjectByProperty('isMesh', true);
  assert.equal(mesh.material.map, textures.albedo);
  assert.equal(mesh.material.roughnessMap, textures.roughness);
  assert.equal(mesh.material.bumpMap, textures.height);
  assert.equal(mesh.material.bumpScale, 0.042);
  assert.equal(mesh.material.color.getHex(), 0xffffff);
  assert.equal(mesh.material.metalness, 0);
  assert.equal(mesh.material.emissive.getHex(), 0);
  assert.equal(
    mesh.material.userData.mapping,
    'authored-face-planar-uv-with-correlated-albedo-roughness-relief',
  );
  assert.equal(first.userData.supportModel, BASALT_SHELF_ASSET.supportModel);
  assert.equal(first.userData.collisionRole, 'non-solid-outside-navigation-boundary');
});
