import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  HERO_GINGKO_ASSET,
  HERO_GINGKO_SURFACE_PROFILE,
  HERO_GINGKO_WIND_PROFILE,
  attachHeroGingkoVisual,
  createCachedHeroGingkoLoader,
  heroGingkoWindDisplacement,
  updateHeroGingkoWind,
} from '../src/hero-gingko.js';

function fixtureTemplate() {
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({
      name: 'hero-gingko-bark-v2',
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0xffffff,
      emissiveIntensity: 2,
      envMapIntensity: 3,
    }),
  ));
  return template;
}

test('original hero gingko asset is reproducible and remains inside its delivery budget', () => {
  assert.equal(HERO_GINGKO_ASSET.url, '/assets/hero-gingko-original-v2.glb');
  assert.equal(HERO_GINGKO_ASSET.version, 'original-hero-gingko-v2');
  assert.ok(HERO_GINGKO_ASSET.bytes < 5_000_000);
  assert.ok(HERO_GINGKO_ASSET.triangles <= 125_000);
  assert.equal(HERO_GINGKO_ASSET.drawCalls, 2);
  assert.ok(HERO_GINGKO_ASSET.leafCount >= 1_900);
  assert.ok(HERO_GINGKO_ASSET.leafCount <= 2_050);
  assert.equal(
    HERO_GINGKO_ASSET.provenance,
    'project-original-deterministic-offline-authored-mesh',
  );
  assert.equal(HERO_GINGKO_ASSET.rights, 'project-original-code-authored-output');

  const asset = new URL(`../public${HERO_GINGKO_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, HERO_GINGKO_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    HERO_GINGKO_ASSET.sha256,
  );
});

test('production gingko keeps a closed two-material load path and buries root tips', async () => {
  const asset = new URL(`../public${HERO_GINGKO_ASSET.url}`, import.meta.url);
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
    assert.equal(object.material.metalness, 0, object.name);
    assert.ok(object.material.roughness >= 0.8, object.name);
    assert.equal(object.material.emissive.getHex(), 0, object.name);
  });
  assert.equal(meshes.length, HERO_GINGKO_ASSET.drawCalls);
  assert.equal(triangles, HERO_GINGKO_ASSET.triangles);
  assert.ok(meshes.some((mesh) => mesh.name === 'hero-gingko-load-bearing-bark'));
  assert.ok(meshes.some((mesh) => mesh.name === 'hero-gingko-supported-fan-leaves'));

  const production = gltf.scene.getObjectByName('hero-gingko-original-v2');
  const bark = gltf.scene.getObjectByName('hero-gingko-load-bearing-bark');
  const leaves = gltf.scene.getObjectByName('hero-gingko-supported-fan-leaves');
  assert.deepEqual(production.userData.supportSnapshot, {
    rootCount: 7,
    buriedRootTipCount: 7,
    minimumRootTipDepthMeters: 0.2,
    scaffoldBranchCount: 10,
    secondaryBranchCount: 20,
    twigCount: 68,
    leafBearingShootCount: 88,
    leafCount: HERO_GINGKO_ASSET.leafCount,
    pruningStubCount: 4,
    maximumLeafSupportGapMeters: 0,
    maximumAllometricAreaRatio: 0.9248000000000001,
  });
  assert.equal(bark.geometry.userData.profile, 'mature-gingko-curved-load-bearing-hierarchy-v2');
  assert.equal(bark.geometry.userData.branchCollars,
    'child-first-ring-overlaps-parent-centreline-and-flares-8-to-16-percent');
  assert.ok(bark.geometry.userData.maximumAllometricAreaRatio <= 1);
  assert.equal(leaves.geometry.userData.twigCount, 68);
  assert.equal(leaves.geometry.userData.leafBearingShootCount, 88);
  assert.deepEqual(leaves.geometry.userData.sizeRangeMeters, [0.205, 0.3]);
  assert.equal(leaves.geometry.userData.maximumLeafSupportGapMeters, 0);
  const barkFlex = bark.geometry.getAttribute('uv1');
  const leafFlex = leaves.geometry.getAttribute('uv1');
  const flexRange = (attribute) => Array.from({ length: attribute.count }, (_, index) => (
    attribute.getY(index)
  )).reduce(([minimum, maximum], value) => [
    Math.min(minimum, value), Math.max(maximum, value),
  ], [Infinity, -Infinity]);
  const [barkMinimum, barkMaximum] = flexRange(barkFlex);
  const [leafMinimum, leafMaximum] = flexRange(leafFlex);
  assert.equal(barkMinimum, HERO_GINGKO_WIND_PROFILE.hierarchy.rootAndTrunk[0]);
  assert.ok(barkMaximum >= 0.81 && barkMaximum <= 0.83, barkMaximum);
  assert.ok(leafMinimum >= 0.4 && leafMinimum <= 0.41, leafMinimum);
  assert.equal(leafMaximum, HERO_GINGKO_WIND_PROFILE.hierarchy.leaf[1]);

  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  assert.ok(bounds.min.y <= -0.28, bounds.min.toArray());
  assert.ok(bounds.max.y >= 12.8, bounds.max.toArray());
  assert.ok(bounds.getSize(new THREE.Vector3()).x >= 10.7, bounds.getSize(new THREE.Vector3()));
});

test('cached gingko loader enforces matte non-emissive dielectric materials', async () => {
  let loads = 0;
  const load = createCachedHeroGingkoLoader({
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
  assert.ok(mesh.material.roughness >= 0.8);
  assert.equal(mesh.material.metalness, 0);
  assert.ok(mesh.material.envMapIntensity <= 0.42);
  assert.equal(mesh.material.emissive.getHex(), 0);
  assert.equal(mesh.material.emissiveIntensity, 0);
  assert.equal(mesh.material.map.name, 'world.landmark.fort-gingko.bark-albedo');
  assert.equal(mesh.material.roughnessMap.name,
    'world.landmark.fort-gingko.bark-roughness-height');
  assert.equal(mesh.material.bumpMap, mesh.material.roughnessMap);
  assert.equal(mesh.material.bumpScale, HERO_GINGKO_SURFACE_PROFILE.bumpScaleMeters);
  assert.equal(mesh.material.userData.surfaceProfile, HERO_GINGKO_SURFACE_PROFILE.version);
  assert.deepEqual(mesh.material.userData.roughnessRange, [0.86, 0.98]);
  assert.equal(mesh.material.userData.windProfile.version, HERO_GINGKO_WIND_PROFILE.version);
  assert.equal(mesh.geometry.getAttribute('heroGingkoFlex').count,
    mesh.geometry.attributes.position.count);
  assert.ok(mesh.customDepthMaterial?.isMeshDepthMaterial);
  assert.equal(mesh.customDepthMaterial.userData.shadowModel,
    HERO_GINGKO_WIND_PROFILE.shadowModel);
  assert.equal(first.userData.meshes, 1);
  assert.equal(first.userData.triangles, 12);
  assert.deepEqual(first.userData.sourceBounds.min, [-0.5, -1, -0.5]);
  assert.deepEqual(first.userData.sourceBounds.max, [0.5, 1, 0.5]);
});

test('gingko visual attaches once and preserves grounded fallback behavior', async () => {
  const load = createCachedHeroGingkoLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: fixtureTemplate() }) }),
  });
  const template = await load();
  const anchor = new THREE.Group();
  const fallback = new THREE.Group();
  anchor.add(fallback);
  anchor.userData.fallback = fallback;

  const first = attachHeroGingkoVisual(anchor, template);
  const second = attachHeroGingkoVisual(anchor, template);
  assert.equal(first, second);
  assert.equal(anchor.children.filter((child) => child === first).length, 1);
  assert.equal(fallback.visible, false);
  assert.equal(first.position.y, 0.022);
  assert.equal(first.userData.assetVersion, HERO_GINGKO_ASSET.version);
  assert.equal(first.userData.supportModel,
    'terrain-root-flare-to-collared-scaffold-to-short-shoot-fan-leaf');
  assert.equal(first.userData.energyModel, 'non-emissive-dielectric-bark-and-leaf-albedo');
  assert.equal(first.userData.supportSnapshot, null);
  assert.equal(first.userData.surfaceProfile.version, HERO_GINGKO_SURFACE_PROFILE.version);
  updateHeroGingkoWind(anchor, 8.5, false);
  assert.deepEqual(first.userData.windSnapshot, {
    time: 8.5,
    strength: HERO_GINGKO_WIND_PROFILE.horizontalTipDisplacementMeters,
    verticalStrength: HERO_GINGKO_WIND_PROFILE.verticalTipDisplacementMeters,
    reducedMotion: false,
    rootAndTrunkFlex: [0, 0],
    maximumFlex: 1,
    shadowModel: HERO_GINGKO_WIND_PROFILE.shadowModel,
  });
  updateHeroGingkoWind(anchor, 12, true);
  assert.equal(first.userData.windSnapshot.time, 0);
  assert.equal(first.userData.windSnapshot.strength, 0);
  assert.equal(first.userData.windSnapshot.verticalStrength, 0);
  assert.equal(first.userData.windSnapshot.reducedMotion, true);
});

test('hierarchical gingko wind fixes the root and bounds supported crown motion', () => {
  assert.deepEqual(heroGingkoWindDisplacement({
    elapsed: 7.25,
    worldPosition: [16, 0, 37],
    flex: 0,
    phaseRank: 0.4,
  }), [0, 0, 0]);
  const first = heroGingkoWindDisplacement({
    elapsed: 7.25,
    worldPosition: [16, 12, 37],
    flex: 1,
    phaseRank: 0.14,
  });
  const second = heroGingkoWindDisplacement({
    elapsed: 7.25,
    worldPosition: [16, 12, 37],
    flex: 1,
    phaseRank: 0.74,
  });
  assert.ok(first.every(Number.isFinite));
  assert.ok(Math.hypot(first[0], first[2])
    <= HERO_GINGKO_WIND_PROFILE.horizontalTipDisplacementMeters + 1e-9, first);
  assert.ok(Math.abs(first[1])
    <= HERO_GINGKO_WIND_PROFILE.verticalTipDisplacementMeters + 1e-9, first);
  assert.notDeepEqual(first, second);
});
