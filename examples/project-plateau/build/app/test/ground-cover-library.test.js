import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  attachGroundCoverLibraryVisual,
  classifyGroundCoverHabitat,
  createCachedGroundCoverLibraryLoader,
  createGroundCoverSurfaceTextures,
  GROUND_COVER_ARCHITECTURE_PROFILE,
  GROUND_COVER_LIBRARY_ASSET,
  GROUND_COVER_WIND_PROFILE,
  updateGroundCoverLibraryWind,
} from '../src/ground-cover-library.js';
import { terrainGradient, terrainHeight } from '../src/terrain.js';
import { createWorld } from '../src/world.js';

function edgeUseCounts(geometry) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.index
    ? Array.from(geometry.index.array)
    : Array.from({ length: positions.count }, (_, index) => index);
  const key = (index) => [
    positions.getX(index), positions.getY(index), positions.getZ(index),
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
  assert.equal(
    GROUND_COVER_LIBRARY_ASSET.url,
    '/assets/ground-cover-library-original-v3.glb',
  );
  assert.equal(GROUND_COVER_LIBRARY_ASSET.version, 'original-ground-cover-library-v3');
  assert.ok(GROUND_COVER_LIBRARY_ASSET.bytes < 130_000);
  assert.equal(GROUND_COVER_LIBRARY_ASSET.triangles, 2_712);
  assert.deepEqual(GROUND_COVER_LIBRARY_ASSET.trianglesByVariant, [760, 832, 1_120]);
  assert.equal(GROUND_COVER_LIBRARY_ASSET.drawCalls, 6);
  assert.equal(GROUND_COVER_LIBRARY_ASSET.variantCount, 3);
  assert.deepEqual(GROUND_COVER_LIBRARY_ASSET.leafCounts, [9, 10, 18]);
  assert.equal(
    GROUND_COVER_LIBRARY_ASSET.provenance,
    'project-original-deterministic-offline-authored-mesh-library',
  );
  assert.equal(GROUND_COVER_LIBRARY_ASSET.rights, 'project-original-code-authored-output');
  const asset = new URL(`../public${GROUND_COVER_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, GROUND_COVER_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    GROUND_COVER_LIBRARY_ASSET.sha256,
  );
});

test('each ground-cover family keeps a closed root-to-petiole load path and attached leaf flex', async () => {
  const asset = new URL(`../public${GROUND_COVER_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const variants = [];
  gltf.scene.traverse((object) => {
    if (object.userData.variantId) variants.push(object);
  });
  let triangles = 0;
  const maximumPetioleRadii = [];
  assert.equal(variants.length, GROUND_COVER_LIBRARY_ASSET.variantCount);
  assert.deepEqual(
    variants.map((variant) => variant.userData.variantId),
    GROUND_COVER_LIBRARY_ASSET.variantIds,
  );
  for (const variant of variants) {
    const meshes = variant.children.filter((child) => child.isMesh);
    const structure = meshes.find(
      (mesh) => mesh.userData.name === 'ground-cover-load-bearing-structure',
    );
    const leaves = meshes.find(
      (mesh) => mesh.userData.name === 'ground-cover-attached-leaves',
    );
    assert.equal(meshes.length, 2, variant.name);
    assert.ok(structure, variant.name);
    assert.ok(leaves, variant.name);
    meshes.forEach((mesh) => {
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      assert.ok(mesh.geometry.attributes.normal, mesh.name);
      assert.ok(mesh.geometry.attributes.color, mesh.name);
      assert.ok(mesh.geometry.attributes.uv, mesh.name);
      assert.ok(mesh.geometry.attributes.uv1, mesh.name);
      assert.equal(mesh.material.metalness, 0, mesh.name);
      assert.ok(mesh.material.roughness >= 0.88, mesh.name);
      assert.equal(mesh.material.emissive.getHex(), 0, mesh.name);
    });
    const nonManifold = [...edgeUseCounts(structure.geometry).values()]
      .filter((count) => count !== 2);
    assert.deepEqual(nonManifold, [], `${variant.name} has an open structural edge`);
    assert.equal(
      structure.geometry.userData.supportModel,
      'subgrade-rhizome-crown-to-overlapping-petiole-to-attached-cambered-leaf',
    );
    assert.equal(
      leaves.geometry.userData.supportModel,
      'each-cambered-leaf-root-overlaps-a-closed-petiole-or-sheath',
    );
    assert.equal(structure.geometry.userData.radialSegments, 6, variant.name);
    assert.equal(
      structure.geometry.userData.architectureModel,
      GROUND_COVER_ARCHITECTURE_PROFILE.model,
      variant.name,
    );
    assert.equal(
      structure.geometry.userData.instanceVariationAttribute,
      'uv1-x-leaf-phase',
      variant.name,
    );
    maximumPetioleRadii.push(structure.geometry.userData.maximumPetioleRadiusMeters);
    const positions = structure.geometry.getAttribute('position');
    const flex = structure.geometry.getAttribute('uv1');
    let supportVertices = 0;
    let flexiblePetioleVertices = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) <= GROUND_COVER_LIBRARY_ASSET.supportPlaneY + 0.002) {
        supportVertices += 1;
        assert.equal(flex.getY(index), 0);
      }
      if (flex.getY(index) > 0.15) flexiblePetioleVertices += 1;
    }
    assert.equal(supportVertices, 15, variant.name);
    assert.ok(flexiblePetioleVertices >= variant.userData.leafCount, variant.name);
    const leafFlex = leaves.geometry.getAttribute('uv1');
    const leafPositions = leaves.geometry.getAttribute('position');
    let maximumFlex = -Infinity;
    const leafPhases = new Set();
    for (let index = 0; index < leafFlex.count; index += 1) {
      maximumFlex = Math.max(maximumFlex, leafFlex.getY(index));
      leafPhases.add(Number(leafFlex.getX(index).toFixed(5)));
    }
    assert.equal(maximumFlex, 1, variant.name);
    assert.equal(leafPhases.size, variant.userData.leafCount, variant.name);
    const structurePositions = structure.geometry.getAttribute('position');
    let maximumAttachmentGap = 0;
    for (const phase of leafPhases) {
      const structureIndices = [];
      const leafIndices = [];
      for (let index = 0; index < flex.count; index += 1) {
        if (Math.abs(flex.getX(index) - phase) < 0.0001) structureIndices.push(index);
      }
      for (let index = 0; index < leafFlex.count; index += 1) {
        if (Math.abs(leafFlex.getX(index) - phase) < 0.0001) leafIndices.push(index);
      }
      const structureTipFlex = Math.max(...structureIndices.map((index) => flex.getY(index)));
      const leafRootFlex = Math.min(...leafIndices.map((index) => leafFlex.getY(index)));
      const structureTipIndices = structureIndices.filter(
        (index) => Math.abs(flex.getY(index) - structureTipFlex) < 0.0001,
      );
      const leafRootIndices = leafIndices.filter(
        (index) => Math.abs(leafFlex.getY(index) - leafRootFlex) < 0.0001,
      );
      const averagePosition = (positions, indices) => indices.reduce(
        (point, index) => point.add(new THREE.Vector3(
          positions.getX(index), positions.getY(index), positions.getZ(index),
        )),
        new THREE.Vector3(),
      ).multiplyScalar(1 / indices.length);
      maximumAttachmentGap = Math.max(
        maximumAttachmentGap,
        averagePosition(structurePositions, structureTipIndices)
          .distanceTo(averagePosition(leafPositions, leafRootIndices)),
      );
    }
    assert.ok(
      maximumAttachmentGap <= GROUND_COVER_ARCHITECTURE_PROFILE.maximumAttachmentGapMeters,
      `${variant.name} leaf/petiole gap ${maximumAttachmentGap}`,
    );
  }
  assert.equal(triangles, GROUND_COVER_LIBRARY_ASSET.triangles);
  assert.deepEqual(
    maximumPetioleRadii,
    GROUND_COVER_ARCHITECTURE_PROFILE.maximumPetioleRadiusMetersByVariant,
  );
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
  assert.equal(first.userData.meshes, 6);
  assert.equal(first.userData.triangles, 72);
  first.traverse((object) => {
    if (!object.isMesh) return;
    assert.ok(object.material.roughness >= 0.86);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.32);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});

test('ground-cover surface texture channels are correlated and locally authored', () => {
  const textures = createGroundCoverSurfaceTextures(16);
  assert.equal(textures.albedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(textures.roughness.colorSpace, THREE.NoColorSpace);
  assert.equal(textures.height.colorSpace, THREE.NoColorSpace);
  for (const texture of Object.values(textures)) {
    assert.equal(
      texture.userData.source,
      'deterministic-original-code-authored-correlated-ground-cover-surface-v3',
    );
  }
  const centre = ((8 * 16) + 8) * 4;
  const edge = ((8 * 16) + 1) * 4;
  assert.ok(textures.albedo.image.data[centre] > textures.albedo.image.data[edge]);
  assert.ok(textures.roughness.image.data[centre] < textures.roughness.image.data[edge]);
  assert.ok(textures.height.image.data[centre] > textures.height.image.data[edge]);
});

test('habitat classification gives brook moisture and steep slopes deterministic priority', () => {
  assert.equal(classifyGroundCoverHabitat({
    index: 1, x: 0, z: 0, microclimate: 'brook-bank-moisture',
  }, { terrainGradient: () => ({ x: 0, z: 0 }) }).variantIndex, 0);
  assert.equal(classifyGroundCoverHabitat({
    index: 2, x: 0, z: 0, microclimate: 'brook-bank-moisture',
  }, { terrainGradient: () => ({ x: 0, z: 0 }) }).variantIndex, 2);
  assert.equal(classifyGroundCoverHabitat({
    index: 1, x: 0, z: 0, microclimate: 'trunk-dripline',
  }, { terrainGradient: () => ({ x: 0.12, z: 0 }) }).variantIndex, 2);
  assert.equal(classifyGroundCoverHabitat({
    index: 1, x: 0, z: 0, microclimate: 'trunk-dripline',
  }, { terrainGradient: () => ({ x: 0, z: 0 }) }).variantIndex, 1);
});

test('ground-cover library settles every root crown and couples colour/depth wind', async () => {
  const world = createWorld(new THREE.Scene());
  const placements = world.environmentDensity.userData.groundCoverPlacements;
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  const fallbackMeshes = Array.from({ length: 3 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const first = attachGroundCoverLibraryVisual(anchor, template, placements, {
    terrainHeight,
    terrainGradient,
  });
  const second = attachGroundCoverLibraryVisual(anchor, template, placements, {
    terrainHeight,
    terrainGradient,
  });
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, 360);
  assert.deepEqual(first.userData.counts, [120, 64, 176]);
  assert.deepEqual(first.userData.habitatCounts, {
    'drained-slope-sedge': 116,
    'canopy-shade-rosette': 64,
    'brook-margin-arrowhead': 120,
    'brook-margin-sedge': 60,
  });
  assert.equal(first.children.length, GROUND_COVER_LIBRARY_ASSET.drawCalls);
  assert.equal(first.userData.supportSummary.supportVertexCount, 5_400);
  assert.equal(first.userData.supportSummary.supportedVertexCount, 5_400);
  assert.equal(first.userData.supportSummary.supportRatio, 1);
  assert.ok(first.userData.supportSummary.minimumClearance >= -0.065);
  assert.ok(first.userData.supportSummary.maximumClearance <= -0.035);
  assert.equal(first.userData.collisionRole, 'non-solid-pliable-ground-cover');
  assert.equal(first.userData.dimensionSummary.length, 3);
  for (const dimensions of first.userData.dimensionSummary) {
    assert.equal(dimensions.envelopePassCount, dimensions.instanceCount, dimensions.id);
    assert.ok(
      dimensions.maximumDiameterMeters <= dimensions.maxDiameterMeters,
      `${dimensions.id} diameter exceeds its mature envelope`,
    );
    assert.ok(
      dimensions.maximumHeightMeters <= dimensions.maxHeightMeters,
      `${dimensions.id} height exceeds its mature envelope`,
    );
  }
  assert.equal(first.userData.albedoProfile, 'source-coupled-bounded-foliage-albedo-v1');
  assert.equal(first.userData.architectureProfile, GROUND_COVER_ARCHITECTURE_PROFILE);
  for (const mesh of first.children) {
    assert.ok(mesh.geometry.attributes.groundCoverFlex);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
    assert.ok(mesh.material.envMapIntensity <= 0.18);
    assert.equal(
      mesh.material.userData.albedoProfile,
      'source-coupled-bounded-foliage-albedo-v1',
    );
    assert.equal(
      mesh.customDepthMaterial.userData.windUniforms,
      mesh.material.userData.windUniforms,
    );
    const colourShader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <lights_fragment_begin>',
    };
    const depthShader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '',
    };
    mesh.material.onBeforeCompile(colourShader);
    mesh.customDepthMaterial.onBeforeCompile(depthShader);
    assert.equal(colourShader.vertexShader, depthShader.vertexShader);
    assert.match(colourShader.vertexShader, /groundCoverInstanceSeed/);
    assert.match(colourShader.vertexShader, /groundCoverStaticAnchor/);
    assert.equal(
      colourShader.uniforms.groundCoverWindTime,
      depthShader.uniforms.groundCoverWindTime,
    );
  }
  updateGroundCoverLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  assert.equal(
    first.userData.materials.windUniforms.strength.value,
    GROUND_COVER_WIND_PROFILE.horizontalTipDisplacementMeters,
  );
  updateGroundCoverLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
  assert.equal(first.userData.materials.windUniforms.verticalStrength.value, 0);
});
