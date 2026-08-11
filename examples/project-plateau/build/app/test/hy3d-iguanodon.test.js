import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

import {
  applyHy3dIguanodonPose,
  HY3D_IGUANODON_ASSET,
  HY3D_POSE_TARGETS,
  IGUANODON_SKIN_SURFACE,
  attachHy3dIguanodonVisual,
  createCachedHy3dIguanodonLoader,
  createHy3dIguanodonInstance,
  upgradeIguanodonFamilyWithHy3d,
} from '../src/hy3d-iguanodon.js';
import { createIguanodon } from '../src/iguanodon.js';

function templateWithMesh() {
  const template = new THREE.Group();
  const surfaceMap = new THREE.DataTexture(new Uint8Array([128, 192, 0, 255]), 1, 1);
  surfaceMap.needsUpdate = true;
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.3,
      roughnessMap: surfaceMap,
      metalnessMap: surfaceMap,
    }),
  ));
  return template;
}

function anatomicalTemplate() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.34, 0.31, 0, // skull
    -0.12, 0.25, 0, // neck / shoulder
    0.12, 0.22, 0, // spine
    0.52, 0.24, 0, // tail base
    -0.18, 0.05, 0.12, // swing fore foot
    0.18, 0.04, -0.1, // swing hind foot
    -0.18, 0.05, -0.12, // planted fore support
    0.18, 0.04, 0.1, // planted hind support
  ], 3));
  return new THREE.Group().add(new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial(),
  ));
}

test('HY3D production asset stays within the approved shared package and render budget', () => {
  assert.equal(HY3D_IGUANODON_ASSET.url, '/assets/iguanodon-hy3d-v35-stylized.glb');
  assert.ok(HY3D_IGUANODON_ASSET.bytes < 1_100_000);
  assert.ok(HY3D_IGUANODON_ASSET.triangles <= 25_000);
  assert.equal(HY3D_IGUANODON_ASSET.textureSize, 1024);
  assert.ok(HY3D_IGUANODON_ASSET.approximateSharedGpuMiB <= 19);
  const asset = new URL(`../public${HY3D_IGUANODON_ASSET.url}`, import.meta.url);
  assert.equal(statSync(asset).size, HY3D_IGUANODON_ASSET.bytes);
  assert.equal(
    createHash('sha256').update(readFileSync(asset)).digest('hex'),
    '74a46de82a54dcdb25119e24d3db87485ad814a37a5a92d28756b9e9cbb60de5',
  );
});

test('cached loader fetches once and reuses a prepared template', async () => {
  let loads = 0;
  const source = templateWithMesh();
  const load = createCachedHy3dIguanodonLoader({
    assetUrl: '/fixture.glb',
    loaderFactory: () => ({
      async loadAsync(url) {
        loads += 1;
        assert.equal(url, '/fixture.glb');
        return { scene: source };
      },
    }),
  });
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(first, second);
  assert.equal(loads, 1);
  const mesh = first.children[0];
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);
  assert.equal(mesh.material.isMeshPhysicalMaterial, true);
  assert.equal(mesh.material.roughness, 1);
  assert.equal(mesh.material.metalness, 0);
  assert.ok(mesh.material.roughnessMap?.isTexture);
  assert.deepEqual(mesh.material.userData.roughnessRemap.range, [0.72, 0.94]);
  assert.equal(
    mesh.material.userData.roughnessRemap.source,
    'authored-packed-map-green-channel',
  );
  assert.match(mesh.material.customProgramCacheKey(), /bounded-dry-skin-roughness-v1/);
  const shader = {
    vertexShader: '',
    fragmentShader: '#include <roughnessmap_fragment>',
  };
  mesh.material.onBeforeCompile(shader, {});
  assert.match(shader.fragmentShader, /mix\(0\.72, 0\.94/);
  assert.equal(mesh.material.metalnessMap, null);
  assert.equal(mesh.material.ior, IGUANODON_SKIN_SURFACE.approximateIndexOfRefraction);
  assert.equal(mesh.material.specularIntensity, IGUANODON_SKIN_SURFACE.specularIntensity);
  assert.equal(mesh.material.clearcoat, 0);
  assert.equal(mesh.material.transmission, 0);
  assert.equal(mesh.material.envMapIntensity, IGUANODON_SKIN_SURFACE.environmentIntensity);
  assert.equal(mesh.material.emissive.getHex(), 0x000000);
  assert.equal(mesh.material.emissiveIntensity, 0);
  assert.deepEqual(mesh.material.color.toArray(), IGUANODON_SKIN_SURFACE.albedoMultiplierLinear);
  assert.deepEqual(mesh.material.normalScale.toArray(), IGUANODON_SKIN_SURFACE.normalScale);
  assert.deepEqual(mesh.material.userData.skinSurface, IGUANODON_SKIN_SURFACE);
  assert.deepEqual(mesh.geometry.userData.hy3dPoseTargets, [...HY3D_POSE_TARGETS]);
  assert.equal(mesh.geometry.userData.silhouetteRefinement, 'narrow-integrated-beak');
  assert.equal(
    mesh.geometry.userData.normalContinuity.model,
    'crease-bounded-coincident-position-average-across-uv-seams',
  );
  assert.equal(mesh.geometry.userData.normalContinuity.creaseDegrees, 52);
  assert.deepEqual(Object.keys(mesh.morphTargetDictionary), [...HY3D_POSE_TARGETS]);
});

test('shared morph targets restore behavioral posing without duplicating the source mesh', async () => {
  const load = createCachedHy3dIguanodonLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: templateWithMesh() }) }),
  });
  const template = await load();
  const animal = createIguanodon();
  attachHy3dIguanodonVisual(animal, template);
  applyHy3dIguanodonPose(animal, { graze: 0.8, tailRight: 0.45 });
  const mesh = animal.userData.hy3dVisual.userData.morphMeshes[0];
  assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.graze], 0.8);
  assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.tailRight], 0.45);
  assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.reach], 0);
});

test('young family members reuse the adult mesh with a persistent juvenile proportion morph', async () => {
  const load = createCachedHy3dIguanodonLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: templateWithMesh() }) }),
  });
  const template = await load();
  const adult = createIguanodon();
  const young = createIguanodon({ young: true });
  attachHy3dIguanodonVisual(adult, template);
  attachHy3dIguanodonVisual(young, template);
  applyHy3dIguanodonPose(adult);
  applyHy3dIguanodonPose(young, { play: 0.5 });
  const adultMesh = adult.userData.hy3dVisual.userData.morphMeshes[0];
  const youngMesh = young.userData.hy3dVisual.userData.morphMeshes[0];
  const juvenileIndex = youngMesh.morphTargetDictionary.juvenile;
  assert.equal(adultMesh.morphTargetInfluences[juvenileIndex], 0);
  assert.equal(youngMesh.morphTargetInfluences[juvenileIndex], 1);
  assert.equal(youngMesh.morphTargetInfluences[youngMesh.morphTargetDictionary.play], 0.5);
  assert.ok(
    youngMesh.geometry.morphAttributes.position[juvenileIndex].array.some((value) => value !== 0),
  );
});

test('HY3D instances share heavy geometry and material resources', () => {
  const template = templateWithMesh();
  const first = createHy3dIguanodonInstance(template);
  const second = createHy3dIguanodonInstance(template);
  const firstMesh = first.getObjectByProperty('isMesh', true);
  const secondMesh = second.getObjectByProperty('isMesh', true);
  assert.equal(firstMesh.geometry, secondMesh.geometry);
  assert.equal(firstMesh.material, secondMesh.material);
  assert.equal(first.children[0].rotation.y, Math.PI);
  assert.equal(first.children[0].scale.x, 8.25);
  const firstSpikes = first.getObjectByName('subject.iguanodon_family.thumb-spikes');
  const secondSpikes = second.getObjectByName('subject.iguanodon_family.thumb-spikes');
  assert.ok(firstSpikes?.isMesh);
  assert.equal(firstSpikes.geometry, secondSpikes.geometry);
  assert.equal(firstSpikes.material, secondSpikes.material);
  assert.equal(firstSpikes.geometry.userData.profile, 'paired-iguanodon-thumb-spikes');
  assert.ok(firstSpikes.geometry.userData.gameplayReadableLength >= 0.06);
  assert.ok(firstSpikes.geometry.userData.gameplayReadableLength <= 0.07);
  assert.ok(firstSpikes.geometry.userData.worldReadableLength >= 0.5);
  assert.ok(firstSpikes.geometry.userData.worldReadableLength <= 0.58);
  assert.equal(firstSpikes.geometry.userData.anatomicalDirection, 'upright-forward-outboard');
  const spikePositions = firstSpikes.geometry.getAttribute('position');
  for (const side of [-1, 1]) {
    const sideVertices = Array.from({ length: spikePositions.count }, (_, index) => ({
      y: spikePositions.getY(index),
      z: spikePositions.getZ(index),
    })).filter(({ z }) => Math.sign(z) === side);
    const yRange = Math.max(...sideVertices.map(({ y }) => y))
      - Math.min(...sideVertices.map(({ y }) => y));
    const zRange = Math.max(...sideVertices.map(({ z }) => z))
      - Math.min(...sideVertices.map(({ z }) => z));
    assert.ok(yRange > zRange * 2, 'each thumb spike must rise from the hand instead of splaying like a floor blade');
  }
  assert.equal(first.userData.speciesHandSilhouette, 'paired-thumb-spikes');
  const speciesDetails = first.getObjectByName('subject.iguanodon_family.species-silhouette-details');
  assert.ok(speciesDetails?.isGroup);
  assert.equal(speciesDetails.userData.profile, 'three-toed-hindfoot');
  let hindToes = 0;
  speciesDetails.traverse((object) => {
    if (object.userData.anatomicalFeature === 'hind-toe') hindToes += 1;
  });
  assert.equal(hindToes, 6);
});

test('play and reach poses move anatomy while keeping a diagonal support pair planted', async () => {
  const load = createCachedHy3dIguanodonLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: anatomicalTemplate() }) }),
  });
  const template = await load();
  const mesh = template.getObjectByProperty('isMesh', true);
  const play = mesh.geometry.morphAttributes.position[
    mesh.morphTargetDictionary.play
  ];
  const reach = mesh.geometry.morphAttributes.position[
    mesh.morphTargetDictionary.reach
  ];

  assert.ok(Math.abs(play.getY(0)) > 0.025, 'play must visibly bow the skull');
  assert.ok(Math.abs(play.getY(2)) > 0.02, 'play must alter the spine weight line');
  assert.ok(Math.abs(play.getY(3)) > 0.025, 'play must counter-lift the tail base');
  assert.ok(Math.abs(reach.getX(0)) > 0.025, 'reach must extend the skull toward contact');
  assert.ok(Math.abs(reach.getY(1)) > 0.025, 'reach must recruit neck/shoulder effort');
  for (const swingFootIndex of [4, 5]) {
    assert.ok(play.getY(swingFootIndex) > 0.02, 'play must lift the stepping diagonal');
  }
  for (const footIndex of [6, 7]) {
    assert.equal(play.getX(footIndex), 0);
    assert.equal(play.getY(footIndex), 0);
    assert.equal(play.getZ(footIndex), 0);
  }
});

test('adult HY3D swap hides the fallback without changing family roles or young assets', async () => {
  const family = [
    createIguanodon(),
    createIguanodon(),
    createIguanodon({ young: true, materialVariant: 'moss' }),
  ];
  family[0].userData.behaviorRole = 'graze';
  family[1].userData.behaviorRole = 'branch-pull';
  family[2].userData.behaviorRole = 'young-play';
  const fallbackMesh = family[0].getObjectByProperty('isMesh', true);

  const result = await upgradeIguanodonFamilyWithHy3d(family, {
    loadTemplate: async () => templateWithMesh(),
  });
  assert.deepEqual(result, { upgraded: 2, reused: false });
  assert.equal(fallbackMesh.visible, false);
  assert.ok(family[0].userData.hy3dVisual);
  assert.ok(family[1].userData.hy3dVisual);
  assert.equal(family[2].userData.hy3dVisual, undefined);
  assert.deepEqual(family.map((animal) => animal.userData.behaviorRole), [
    'graze', 'branch-pull', 'young-play',
  ]);
});

test('production family mode can reuse the same HY3D resource for adults and young', async () => {
  const family = [createIguanodon(), createIguanodon({ young: true })];
  const result = await upgradeIguanodonFamilyWithHy3d(family, {
    includeYoung: true,
    loadTemplate: async () => templateWithMesh(),
  });
  assert.deepEqual(result, { upgraded: 2, reused: false });
  assert.ok(family.every((animal) => animal.userData.hy3dVisual));
  const meshes = family.map((animal) => (
    animal.userData.hy3dVisual.getObjectByProperty('isMesh', true)
  ));
  assert.equal(meshes[0].geometry, meshes[1].geometry);
  assert.equal(meshes[0].material, meshes[1].material);
});

test('attaching twice is idempotent and preserves the procedural fallback meshes', () => {
  const animal = createIguanodon();
  const template = templateWithMesh();
  const first = attachHy3dIguanodonVisual(animal, template);
  const fallbackCount = animal.userData.fallbackMeshes.length;
  const second = attachHy3dIguanodonVisual(animal, template);
  assert.equal(first, second);
  assert.ok(fallbackCount > 40);
  assert.equal(animal.userData.fallbackMeshes.length, fallbackCount);
});
