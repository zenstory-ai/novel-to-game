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
  TREE_FERN_WIND_PROFILE,
  attachTreeFernLibraryVisual,
  classifyTreeFernHabitat,
  createCachedTreeFernLibraryLoader,
  createTreeFernSurfaceTextures,
  updateTreeFernLibraryWind,
} from '../src/tree-fern-library.js';

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
  assert.equal(TREE_FERN_LIBRARY_ASSET.url, '/assets/tree-fern-library-original-v1.glb');
  assert.equal(TREE_FERN_LIBRARY_ASSET.version, 'original-tree-fern-library-v1');
  assert.equal(TREE_FERN_LIBRARY_ASSET.bytes, 883_332);
  assert.equal(TREE_FERN_LIBRARY_ASSET.triangles, 19_788);
  assert.deepEqual(TREE_FERN_LIBRARY_ASSET.trianglesByVariant, [6_652, 5_872, 7_264]);
  assert.equal(TREE_FERN_LIBRARY_ASSET.drawCalls, 9);
  assert.equal(TREE_FERN_LIBRARY_ASSET.drawCallsPerVariant, 3);
  assert.equal(TREE_FERN_LIBRARY_ASSET.variantCount, 3);
  assert.deepEqual(TREE_FERN_LIBRARY_ASSET.frondCounts, [15, 12, 18]);
  assert.equal(
    TREE_FERN_LIBRARY_ASSET.provenance,
    'project-original-deterministic-offline-authored-mesh-library',
  );
  assert.equal(TREE_FERN_LIBRARY_ASSET.rights, 'project-original-code-authored-output');
  const asset = new URL(`../public${TREE_FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, TREE_FERN_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    TREE_FERN_LIBRARY_ASSET.sha256,
  );
});

test('each tree fern keeps a closed root-to-rachis load path and attached pinnate crown', async () => {
  const asset = new URL(`../public${TREE_FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const variants = [];
  gltf.scene.traverse((object) => {
    if (Number.isInteger(object.userData.variantIndex)) variants.push(object);
  });
  let triangles = 0;
  assert.equal(variants.length, TREE_FERN_LIBRARY_ASSET.variantCount);
  assert.deepEqual(
    variants.map((variant) => variant.userData.variantId),
    TREE_FERN_LIBRARY_ASSET.variantIds,
  );
  for (const variant of variants) {
    const meshes = variant.children.filter((child) => child.isMesh);
    const rootTrunk = meshes.find((mesh) => mesh.userData.name === 'tree-fern-root-trunk');
    const rachises = meshes.find(
      (mesh) => mesh.userData.name === 'tree-fern-load-bearing-rachises',
    );
    const leaflets = meshes.find(
      (mesh) => mesh.userData.name === 'tree-fern-attached-leaflets',
    );
    assert.equal(meshes.length, 3, variant.name);
    assert.ok(rootTrunk, variant.name);
    assert.ok(rachises, variant.name);
    assert.ok(leaflets, variant.name);
    meshes.forEach((mesh) => {
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      assert.ok(mesh.geometry.index, `${mesh.name} must retain shared indexed vertices`);
      assert.ok(mesh.geometry.attributes.normal, mesh.name);
      assert.ok(mesh.geometry.attributes.color, mesh.name);
      assert.ok(mesh.geometry.attributes.uv, mesh.name);
      assert.ok(mesh.geometry.attributes.uv1, mesh.name);
      assert.equal(mesh.material.metalness, 0, mesh.name);
      assert.ok(mesh.material.roughness >= 0.9, mesh.name);
      assert.equal(mesh.material.emissive.getHex(), 0, mesh.name);
    });
    for (const structure of [rootTrunk, rachises]) {
      const nonManifold = [...edgeUseCounts(structure.geometry).values()]
        .filter((count) => count !== 2);
      assert.deepEqual(nonManifold, [], `${structure.name} has an open structural edge`);
    }
    const rootPositions = rootTrunk.geometry.getAttribute('position');
    const rootFlex = rootTrunk.geometry.getAttribute('uv1');
    let supportVertices = 0;
    let minimumY = Infinity;
    for (let index = 0; index < rootPositions.count; index += 1) {
      minimumY = Math.min(minimumY, rootPositions.getY(index));
      if (rootPositions.getY(index) <= TREE_FERN_LIBRARY_ASSET.supportPlaneY + 0.031) {
        supportVertices += 1;
        assert.equal(rootFlex.getY(index), 0);
      }
    }
    assert.ok(Math.abs(minimumY - TREE_FERN_LIBRARY_ASSET.supportPlaneY) < 0.000_01);
    assert.equal(supportVertices, 34, variant.name);
    const rachisFlex = rachises.geometry.getAttribute('uv1');
    const leafletFlex = leaflets.geometry.getAttribute('uv1');
    assert.ok(Math.max(...rachisFlex.array.filter((_, index) => index % 2 === 1)) === 1);
    assert.ok(Math.max(...leafletFlex.array.filter((_, index) => index % 2 === 1)) > 0.9);
    assert.equal(
      leaflets.geometry.userData.trianglesPerLeaflet,
      8,
      variant.name,
    );
  }
  assert.equal(triangles, TREE_FERN_LIBRARY_ASSET.triangles);
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
  assert.equal(first.userData.meshes, 9);
  assert.equal(first.userData.triangles, 108);
  first.traverse((object) => {
    if (!object.isMesh) return;
    assert.ok(object.material.roughness >= 0.9);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.34);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});

test('tree-fern bark and leaf texture channels remain correlated and locally authored', () => {
  const textures = createTreeFernSurfaceTextures(16);
  assert.equal(textures.bark.albedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(textures.bark.roughness.colorSpace, THREE.NoColorSpace);
  assert.equal(textures.leaf.albedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(textures.leaf.height.colorSpace, THREE.NoColorSpace);
  for (const texture of Object.values(textures.bark)) {
    assert.equal(
      texture.userData.source,
      'deterministic-original-code-authored-correlated-tree-fern-bark',
    );
  }
  for (const texture of Object.values(textures.leaf)) {
    assert.equal(
      texture.userData.source,
      'deterministic-original-code-authored-correlated-tree-fern-leaf',
    );
  }
  const centre = ((8 * 16) + 8) * 4;
  const edge = ((8 * 16) + 1) * 4;
  assert.notEqual(textures.leaf.albedo.image.data[centre], textures.leaf.albedo.image.data[edge]);
  assert.notEqual(textures.leaf.height.image.data[centre], textures.leaf.height.image.data[edge]);
});

test('tree-fern habitat classification responds to moisture, exposure and shelter', () => {
  assert.equal(classifyTreeFernHabitat({ x: -20, z: 0 }, {
    terrainGradient: () => ({ x: 0.02, z: 0 }),
    terrainWetness: () => 0.22,
  }).variantIndex, 0);
  assert.equal(classifyTreeFernHabitat({ x: 24, z: 0 }, {
    terrainGradient: () => ({ x: 0.1, z: 0 }),
    terrainWetness: () => 0.12,
  }).variantIndex, 1);
  assert.equal(classifyTreeFernHabitat({ x: -24, z: 0 }, {
    terrainGradient: () => ({ x: 0.04, z: 0 }),
    terrainWetness: () => 0.12,
  }).variantIndex, 2);
});

test('tree-fern library stays vertical, grounds all roots and couples colour/depth wind', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  HABITAT_TREE_LAYOUT.forEach(([x, z], index) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.position.set(x, terrainHeight(x, z), z);
    placementAnchor.name = `world.connected_route.tree-fern-placement-${index + 1}`;
    placementAnchor.userData.treeFernPlacementAnchor = true;
    anchor.add(placementAnchor);
  });
  const fallbackMeshes = Array.from({ length: 4 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const first = attachTreeFernLibraryVisual(
    anchor,
    template,
    HABITAT_TREE_LAYOUT,
    { terrainHeight, terrainGradient, terrainWetness },
  );
  const second = attachTreeFernLibraryVisual(
    anchor,
    template,
    HABITAT_TREE_LAYOUT,
    { terrainHeight, terrainGradient, terrainWetness },
  );
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, 12);
  assert.deepEqual(first.userData.counts, [2, 7, 3]);
  assert.deepEqual(first.userData.habitatCounts, {
    'humid-retentive-margin': 2,
    'wind-exposed-drained-margin': 7,
    'sheltered-humus-margin': 3,
  });
  assert.equal(first.children.length, TREE_FERN_LIBRARY_ASSET.drawCalls);
  assert.equal(first.userData.supportSummary.supportVertexCount, 408);
  assert.equal(first.userData.supportSummary.supportedVertexCount, 408);
  assert.equal(first.userData.supportSummary.supportRatio, 1);
  assert.ok(first.userData.supportSummary.minimumClearance >= -0.24);
  assert.ok(first.userData.supportSummary.maximumClearance <= 0);
  assert.equal(first.userData.supportSummary.settlementAxis, 'world-gravity-only');
  assert.ok(first.userData.supportEvidence.every((evidence) => (
    evidence.matureTerrainFitScale >= HABITAT_TREE_LAYOUT[evidence.index][2] * 0.72
      && evidence.matureTerrainFitScale <= HABITAT_TREE_LAYOUT[evidence.index][2]
  )));
  assert.equal(first.userData.albedoProfile, 'source-coupled-bounded-foliage-albedo-v1');
  assert.equal(first.userData.dimensionSummary.envelopePassCount, 12);
  assert.ok(first.userData.dimensionSummary.maximumDiameterMeters <= 6.15);
  assert.ok(first.userData.dimensionSummary.maximumHeightMeters <= 6.15);
  for (let index = 0; index < HABITAT_TREE_LAYOUT.length; index += 1) {
    const placementAnchor = anchor.children[index];
    assert.equal(placementAnchor.position.x, HABITAT_TREE_LAYOUT[index][0]);
    assert.equal(placementAnchor.position.z, HABITAT_TREE_LAYOUT[index][1]);
    assert.equal(placementAnchor.rotation.x, 0);
    assert.equal(placementAnchor.rotation.z, 0);
    assert.ok(placementAnchor.userData.supportEvidence);
  }
  for (const mesh of first.children) {
    assert.ok(mesh.geometry.attributes.treeFernFlex);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
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
    assert.equal(
      colourShader.uniforms.treeFernWindTime,
      depthShader.uniforms.treeFernWindTime,
    );
  }
  updateTreeFernLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  assert.equal(
    first.userData.materials.windUniforms.strength.value,
    TREE_FERN_WIND_PROFILE.horizontalTipDisplacementMeters,
  );
  updateTreeFernLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
  assert.equal(first.userData.materials.windUniforms.verticalStrength.value, 0);
});
