import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

import {
  applyHy3dPterodactylPose,
  attachHy3dPterodactylVisual,
  createCachedHy3dPterodactylLoader,
  createHy3dPterodactylInstance,
  HY3D_PTERODACTYL_ASSET,
  HY3D_PTERODACTYL_POSE_TARGETS,
  upgradePterodactylFlockWithHy3d,
} from '../src/hy3d-pterodactyl.js';
import { createPterodactyl } from '../src/pterodactyl.js';

function templateWithMesh() {
  const template = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 0.4, 0.8);
  const surfaceMap = new THREE.DataTexture(new Uint8Array([128, 192, 0, 255]), 1, 1);
  surfaceMap.needsUpdate = true;
  // Give the fixture a central, low appendage vertex so the dive pose must
  // prove it tucks legs as well as narrowing the outer wing span.
  geometry.getAttribute('position').setXYZ(0, 0, -0.2, 0.08);
  template.add(new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.4,
      roughnessMap: surfaceMap,
      metalnessMap: surfaceMap,
    }),
  ));
  return template;
}

test('HY3D pterodactyl asset stays within the approved shared delivery budget', () => {
  assert.ok(HY3D_PTERODACTYL_ASSET.bytes < 1_350_000);
  assert.ok(HY3D_PTERODACTYL_ASSET.triangles <= 30_500);
  assert.equal(HY3D_PTERODACTYL_ASSET.textureSize, 1024);
  assert.ok(HY3D_PTERODACTYL_ASSET.approximateSharedGpuMiB <= 19);
  const asset = new URL(`../public${HY3D_PTERODACTYL_ASSET.url}`, import.meta.url);
  assert.equal(statSync(asset).size, HY3D_PTERODACTYL_ASSET.bytes);
  assert.equal(
    createHash('sha256').update(readFileSync(asset)).digest('hex'),
    'e55fb8979f4349e8887943395ca58979dc417fd30f7df2fe438062161c620113',
  );
});

test('pterodactyl loader caches one matte template with shared flight morphs', async () => {
  let loads = 0;
  const load = createCachedHy3dPterodactylLoader({
    loaderFactory: () => ({
      async loadAsync() {
        loads += 1;
        return { scene: templateWithMesh() };
      },
    }),
  });
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(first, second);
  assert.equal(loads, 1);
  const mesh = first.getObjectByProperty('isMesh', true);
  assert.deepEqual(
    mesh.geometry.userData.hy3dPterodactylPoseTargets,
    [...HY3D_PTERODACTYL_POSE_TARGETS],
  );
  assert.equal(
    mesh.geometry.userData.silhouetteRefinement,
    'integrated-torso-wing-root-volume',
  );
  assert.ok(mesh.material.roughness >= 0.95);
  assert.equal(mesh.material.metalness, 0);
  assert.ok(mesh.material.roughnessMap?.isTexture);
  assert.equal(mesh.material.metalnessMap, null);
  assert.ok(mesh.material.envMapIntensity >= 0.38 && mesh.material.envMapIntensity <= 0.46);
  assert.ok(mesh.material.emissiveIntensity <= 0.03);
  const positions = mesh.geometry.getAttribute('position');
  const diveFold = mesh.geometry.morphAttributes.position[
    mesh.morphTargetDictionary.diveFold
  ];
  const wingUp = mesh.geometry.morphAttributes.position[
    mesh.morphTargetDictionary.wingUp
  ];
  const wingDown = mesh.geometry.morphAttributes.position[
    mesh.morphTargetDictionary.wingDown
  ];
  let widestIndex = 0;
  for (let index = 1; index < positions.count; index += 1) {
    if (Math.abs(positions.getX(index)) > Math.abs(positions.getX(widestIndex))) widestIndex = index;
  }
  assert.ok(
    Math.abs(positions.getX(widestIndex) + diveFold.getX(widestIndex))
      < Math.abs(positions.getX(widestIndex)) * 0.36,
    'full dive fold must visibly narrow the wing span',
  );
  let lowestCentralIndex = -1;
  for (let index = 0; index < positions.count; index += 1) {
    if (Math.abs(positions.getX(index)) > 0.04) continue;
    if (lowestCentralIndex < 0 || positions.getY(index) < positions.getY(lowestCentralIndex)) {
      lowestCentralIndex = index;
    }
  }
  assert.ok(lowestCentralIndex >= 0);
  assert.ok(
    diveFold.getY(lowestCentralIndex) > 0.17,
    'full dive fold must tuck the central legs against the body',
  );
  assert.ok(
    Math.abs(wingUp.getY(widestIndex) - wingDown.getY(widestIndex))
      > Math.abs(positions.getX(widestIndex)) * 0.5,
    'full upstroke and downstroke must create a visibly different wing silhouette',
  );
});

test('flight instances share geometry and accept independent morph poses', async () => {
  const load = createCachedHy3dPterodactylLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: templateWithMesh() }) }),
  });
  const template = await load();
  const first = createPterodactyl();
  const second = createPterodactyl();
  attachHy3dPterodactylVisual(first, template);
  attachHy3dPterodactylVisual(second, template);
  const firstMesh = first.userData.hy3dVisual.userData.morphMeshes[0];
  const secondMesh = second.userData.hy3dVisual.userData.morphMeshes[0];
  assert.equal(firstMesh.geometry, secondMesh.geometry);
  assert.equal(firstMesh.material, secondMesh.material);

  applyHy3dPterodactylPose(first, { wingDown: 0.7, diveFold: 0.35 });
  assert.equal(firstMesh.morphTargetInfluences[firstMesh.morphTargetDictionary.wingDown], 0.7);
  assert.equal(firstMesh.morphTargetInfluences[firstMesh.morphTargetDictionary.diveFold], 0.35);
  assert.equal(secondMesh.morphTargetInfluences[secondMesh.morphTargetDictionary.wingDown], 0);
});

test('flock upgrade hides procedural meshes once and reuses the HY3D template', async () => {
  const flock = [createPterodactyl(), createPterodactyl(), createPterodactyl()];
  const firstFallback = flock[0].getObjectByProperty('isMesh', true);
  const result = await upgradePterodactylFlockWithHy3d(flock, {
    loadTemplate: async () => {
      const load = createCachedHy3dPterodactylLoader({
        loaderFactory: () => ({ loadAsync: async () => ({ scene: templateWithMesh() }) }),
      });
      return load();
    },
  });
  assert.deepEqual(result, { upgraded: 3, reused: false });
  assert.equal(firstFallback.visible, false);
  assert.ok(flock.every((pterodactyl) => pterodactyl.userData.hy3dVisual));
  const repeated = await upgradePterodactylFlockWithHy3d(flock);
  assert.deepEqual(repeated, { upgraded: 3, reused: true });
});

test('standalone visual uses the expected scale, orientation and centered source', () => {
  const template = templateWithMesh();
  template.userData.sourceCenter = [0, 0.2, 0.05];
  const visual = createHy3dPterodactylInstance(template);
  assert.equal(visual.children[0].rotation.y, Math.PI);
  assert.equal(visual.children[0].scale.x, 9.2);
  assert.deepEqual(
    visual.children[0].children[0].position.toArray().map((value) => (
      Math.abs(value) < Number.EPSILON ? 0 : value
    )),
    [0, -0.2, -0.05],
  );
});
