import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  COVER_RIPARIAN_TREE_LAYOUT,
  VEGETATION_LAYOUT,
} from '../src/environment-layout.js';
import { terrainGradient, terrainHeight, terrainWetness } from '../src/terrain.js';
import {
  CANOPY_TREE_LIBRARY_ASSET,
  CANOPY_TREE_LEAF_RETENTION_PROFILE,
  CANOPY_TREE_SURFACE_VARIATION_PROFILE,
  CANOPY_TREE_WIND_PROFILE,
  attachCanopyTreeLibraryVisual,
  canopyTreeLeafRetention,
  classifyCanopyTreeHabitat,
  createCachedCanopyTreeLibraryLoader,
  createCanopyTreeSurfaceTextures,
  updateCanopyTreeLibraryWind,
} from '../src/canopy-tree-library.js';

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
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.url, '/assets/canopy-tree-library-original-v7.glb');
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.version, 'original-canopy-tree-library-v7');
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.bytes, 2_134_992);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.triangles, 33_102);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.trianglesByVariant, [7_896, 6_930, 7_896, 10_380]);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.drawCalls, 8);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.drawCallsPerVariant, 2);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.leafCounts, [924, 798, 924, 1_296]);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.damagedLeafCounts, [249, 240, 243, 370]);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.branchAnchorCounts, [132, 114, 132, 216]);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.supportVertexCounts, [29, 29, 29, 25]);
  assert.equal(
    CANOPY_TREE_LIBRARY_ASSET.provenance,
    'project-original-deterministic-offline-authored-mesh-library',
  );
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.rights, 'project-original-code-authored-output');
  assert.equal(
    CANOPY_TREE_LIBRARY_ASSET.leafAttachmentDistribution,
    'distributed-nodes-along-closed-primary-secondary-and-tertiary-branch-axes',
  );
  assert.equal(
    CANOPY_TREE_LIBRARY_ASSET.leafCoverageModel,
    'higher-node-density-with-bounded-nine-point-five-percent-leaf-growth',
  );
  assert.equal(
    CANOPY_TREE_LIBRARY_ASSET.leafNodeHierarchy,
    'primary-secondary-tertiary-and-araucaria-whorl-axes',
  );
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.leafCountGrowthPercent, 9.5);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.assetTriangleGrowthPercent, 0.82);
  assert.equal(
    CANOPY_TREE_LIBRARY_ASSET.assetTriangleGrowthBaseline,
    'v6-to-v7-stratified-crown-and-fractured-limb-architecture',
  );
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.roundedLaminaTriangleGrowthPercent, 92.41);
  assert.equal(
    CANOPY_TREE_LIBRARY_ASSET.roundedLaminaTriangleGrowthBaseline,
    'v5-to-v6-rounded-lamina-topology',
  );
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.trianglesPerLeaf, 6);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.verticesPerLeaf, 8);
  assert.equal(CANOPY_TREE_LIBRARY_ASSET.leafSurfaceTriangleMultiplier, 3);
  assert.match(CANOPY_TREE_LIBRARY_ASSET.partialLaminaDamage, /missing-margin/);
  assert.match(CANOPY_TREE_LIBRARY_ASSET.crownArchitecture, /upper-scaffolds/);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.brokenBranchCounts, [1, 1, 1, 2]);
  assert.deepEqual(CANOPY_TREE_LIBRARY_ASSET.fractureSplinterCounts, [3, 3, 3, 6]);
  assert.match(CANOPY_TREE_LIBRARY_ASSET.crownBudgetModel, /reallocated/);
  const asset = new URL(`../public${CANOPY_TREE_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, CANOPY_TREE_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    CANOPY_TREE_LIBRARY_ASSET.sha256,
  );
});

test('every tree variant keeps closed roots and hierarchical branches with attached leaves', async () => {
  const asset = new URL(`../public${CANOPY_TREE_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const variants = [];
  gltf.scene.traverse((object) => {
    if (Number.isInteger(object.userData.variantIndex)) variants.push(object);
  });
  let triangles = 0;
  assert.equal(variants.length, 4);
  assert.deepEqual(
    variants.map((variant) => variant.userData.variantId),
    CANOPY_TREE_LIBRARY_ASSET.variantIds,
  );
  for (const [variantIndex, variant] of variants.entries()) {
    const meshes = variant.children.filter((child) => child.isMesh);
    const structure = meshes.find(
      (mesh) => mesh.userData.name === 'canopy-tree-load-bearing-structure',
    );
    const leaves = meshes.find((mesh) => mesh.userData.name === 'canopy-tree-attached-leaves');
    assert.equal(meshes.length, 2, variant.name);
    assert.ok(structure, variant.name);
    assert.ok(leaves, variant.name);
    for (const mesh of meshes) {
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      assert.ok(mesh.geometry.index, mesh.name);
      assert.ok(mesh.geometry.attributes.normal, mesh.name);
      assert.ok(mesh.geometry.attributes.color, mesh.name);
      assert.ok(mesh.geometry.attributes.uv, mesh.name);
      assert.ok(mesh.geometry.attributes.uv1, mesh.name);
      assert.equal(mesh.material.metalness, 0, mesh.name);
      assert.ok(mesh.material.roughness >= 0.9, mesh.name);
      assert.equal(mesh.material.emissive.getHex(), 0, mesh.name);
    }
    const nonManifold = [...edgeUseCounts(structure.geometry).values()]
      .filter((count) => count !== 2);
    assert.deepEqual(nonManifold, [], `${variant.name} has an open structural edge`);
    const positions = structure.geometry.getAttribute('position');
    const flex = structure.geometry.getAttribute('uv1');
    let supportVertices = 0;
    let minimumY = Infinity;
    for (let index = 0; index < positions.count; index += 1) {
      minimumY = Math.min(minimumY, positions.getY(index));
      if (positions.getY(index) <= CANOPY_TREE_LIBRARY_ASSET.supportPlaneY + 0.036) {
        supportVertices += 1;
        assert.equal(flex.getY(index), 0);
      }
    }
    assert.ok(Math.abs(minimumY - CANOPY_TREE_LIBRARY_ASSET.supportPlaneY) < 0.000_01);
    assert.equal(supportVertices, CANOPY_TREE_LIBRARY_ASSET.supportVertexCounts[variantIndex]);
    assert.equal(
      leaves.geometry.userData.leafCount,
      CANOPY_TREE_LIBRARY_ASSET.leafCounts[variantIndex],
    );
    assert.equal(leaves.geometry.userData.trianglesPerLeaf, 6);
    assert.equal(leaves.geometry.userData.verticesPerLeaf, 8);
    assert.equal(
      leaves.geometry.userData.damagedLeafCount,
      CANOPY_TREE_LIBRARY_ASSET.damagedLeafCounts[variantIndex],
    );
    assert.match(leaves.geometry.userData.partialLaminaDamage, /missing-margin/);
    assert.equal(
      structure.geometry.userData.branchAnchorCount,
      CANOPY_TREE_LIBRARY_ASSET.branchAnchorCounts[variantIndex],
    );
    assert.equal(
      structure.geometry.userData.brokenBranchCount,
      CANOPY_TREE_LIBRARY_ASSET.brokenBranchCounts[variantIndex],
    );
    assert.equal(
      structure.geometry.userData.fractureSplinterCount,
      CANOPY_TREE_LIBRARY_ASSET.fractureSplinterCounts[variantIndex],
    );
    assert.match(structure.geometry.userData.crownArchitecture, /fractured/);
    const leafFlex = leaves.geometry.getAttribute('uv1');
    assert.ok(Math.max(...leafFlex.array) >= 0.9, variant.name);
    const retentionRanks = Array.from(
      { length: leafFlex.count },
      (_, index) => leafFlex.getX(index),
    );
    assert.ok(Math.min(...retentionRanks) >= 0, variant.name);
    assert.ok(Math.max(...retentionRanks) <= 1, variant.name);
    assert.ok(new Set(retentionRanks.map((value) => value.toFixed(4))).size >= 40, variant.name);
    assert.equal(
      leaves.geometry.userData.variationProfile,
      'uv1-x-stable-leaf-retention-rank',
    );
    assert.equal(
      leaves.geometry.userData.attachmentDistribution,
      CANOPY_TREE_LIBRARY_ASSET.leafAttachmentDistribution,
    );
    const leafPositions = leaves.geometry.getAttribute('position');
    const distinctAttachmentRoots = new Set();
    for (let leafIndex = 0; leafIndex < leaves.geometry.userData.leafCount; leafIndex += 1) {
      const rootIndex = leafIndex * CANOPY_TREE_LIBRARY_ASSET.verticesPerLeaf;
      distinctAttachmentRoots.add([
        leafPositions.getX(rootIndex),
        leafPositions.getY(rootIndex),
        leafPositions.getZ(rootIndex),
      ].map((value) => value.toFixed(5)).join(','));
    }
    const minimumNodesPerAnchor = variantIndex === 3 ? 4 : 5;
    assert.ok(
      distinctAttachmentRoots.size
        >= CANOPY_TREE_LIBRARY_ASSET.branchAnchorCounts[variantIndex] * minimumNodesPerAnchor,
      `${variant.name} concentrates leaves onto too few physical branch nodes`,
    );
  }
  assert.equal(triangles, CANOPY_TREE_LIBRARY_ASSET.triangles);
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
  assert.equal(first.userData.meshes, 8);
  assert.equal(first.userData.triangles, 96);
  first.traverse((object) => {
    if (!object.isMesh) return;
    assert.ok(object.material.roughness >= 0.9);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.32);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});

test('canopy bark and leaf surface channels remain correlated and locally authored', () => {
  const textures = createCanopyTreeSurfaceTextures(16);
  for (const [family, source] of [
    ['wetBark', 'deterministic-original-code-authored-correlated-wet-furrowed-bark'],
    ['plateBark', 'deterministic-original-code-authored-correlated-plate-bark'],
    ['leaf', 'deterministic-original-code-authored-correlated-canopy-leaf'],
  ]) {
    assert.equal(textures[family].albedo.colorSpace, THREE.SRGBColorSpace);
    assert.equal(textures[family].roughness.colorSpace, THREE.NoColorSpace);
    assert.equal(textures[family].height.colorSpace, THREE.NoColorSpace);
    for (const texture of Object.values(textures[family])) {
      assert.equal(texture.userData.source, source);
    }
  }
  const centre = ((8 * 16) + 8) * 4;
  const edge = ((8 * 16) + 1) * 4;
  assert.notEqual(textures.leaf.albedo.image.data[centre], textures.leaf.albedo.image.data[edge]);
  assert.notEqual(textures.leaf.height.image.data[centre], textures.leaf.height.image.data[edge]);
});

test('canopy habitat selection respects species and local hydrology before variation', () => {
  const dependencies = {
    terrainGradient: () => ({ x: 0.04, z: 0.02 }),
    terrainWetness: () => 0.2,
  };
  assert.equal(classifyCanopyTreeHabitat({
    x: 0, z: 0, isAraucaria: true, leafFamily: 'araucaria-whorl',
  }, dependencies).variantIndex, 3);
  assert.equal(classifyCanopyTreeHabitat({
    x: 0, z: 0, isAraucaria: false, leafFamily: 'compound-lanceolate',
  }, dependencies).variantIndex, 2);
  assert.equal(classifyCanopyTreeHabitat({
    x: 0, z: 0, isAraucaria: false, leafFamily: 'elliptic-waxy',
  }, dependencies).variantIndex, 0);
  assert.equal(classifyCanopyTreeHabitat({
    x: 0, z: 0, isAraucaria: false, leafFamily: 'elliptic-waxy',
  }, { ...dependencies, terrainWetness: () => 0.02 }).variantIndex, 1);
  assert.equal(classifyCanopyTreeHabitat({
    x: 0,
    z: 0,
    isAraucaria: false,
    leafFamily: 'elliptic-waxy',
    openCanopyExposure: true,
  }, { ...dependencies, terrainWetness: () => 0.15 }).variantIndex, 1);
  assert.equal(classifyCanopyTreeHabitat({
    x: 0,
    z: 0,
    isAraucaria: false,
    leafFamily: 'elliptic-waxy',
    openCanopyExposure: true,
  }, { ...dependencies, terrainWetness: () => 0.4 }).variantIndex, 0);
});

test('leaf retention is stable and sourced from age, wind damage and habitat stress', () => {
  const shelteredPioneer = canopyTreeLeafRetention({
    index: 4,
    successionAgeClass: 'pioneer',
    successionWindDamage: 0.08,
  }, { slope: 0.02, wetness: 0.22 });
  const exposedMature = canopyTreeLeafRetention({
    index: 4,
    successionAgeClass: 'mature',
    successionWindDamage: 0.64,
  }, { slope: 0.31, wetness: 0.01 });
  assert.deepEqual(
    canopyTreeLeafRetention({
      index: 4,
      successionAgeClass: 'pioneer',
      successionWindDamage: 0.08,
    }, { slope: 0.02, wetness: 0.22 }),
    shelteredPioneer,
  );
  assert.ok(shelteredPioneer.retention > exposedMature.retention);
  assert.ok(exposedMature.retention >= CANOPY_TREE_LEAF_RETENTION_PROFILE.minimumRetention);
  assert.ok(shelteredPioneer.retention <= CANOPY_TREE_LEAF_RETENTION_PROFILE.maximumRetention);
  assert.equal(
    shelteredPioneer.sourceModel,
    CANOPY_TREE_LEAF_RETENTION_PROFILE.sourceModel,
  );
});

test('surface history is stable, bounded and shared by colour and depth leaf rejection', () => {
  assert.equal(
    CANOPY_TREE_SURFACE_VARIATION_PROFILE.version,
    'stable-individual-bark-scar-and-lamina-damage-v1',
  );
  assert.match(CANOPY_TREE_SURFACE_VARIATION_PROFILE.structureModel, /healed-scar/);
  assert.match(CANOPY_TREE_SURFACE_VARIATION_PROFILE.leafModel, /edge-notches/);
  assert.ok(CANOPY_TREE_SURFACE_VARIATION_PROFILE.maximumScarHeightMeters <= 1);
  assert.ok(CANOPY_TREE_SURFACE_VARIATION_PROFILE.maximumScarAngularFraction <= 0.25);
  assert.ok(CANOPY_TREE_SURFACE_VARIATION_PROFILE.damagedLeafRankThreshold >= 0.7);
  assert.ok(
    CANOPY_TREE_SURFACE_VARIATION_PROFILE.perforatedLeafRankThreshold
      > CANOPY_TREE_SURFACE_VARIATION_PROFILE.damagedLeafRankThreshold,
  );
  assert.match(CANOPY_TREE_SURFACE_VARIATION_PROFILE.temporalModel, /stable/);
  assert.match(CANOPY_TREE_SURFACE_VARIATION_PROFILE.shadowModel, /colour-and-depth/);
});

test('128 canopy trees remain vertical, supported, dimensioned and wind-shadow coupled', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  for (const tree of VEGETATION_LAYOUT.trees) {
    const placementAnchor = new THREE.Group();
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    placementAnchor.userData.canopyTreePlacementAnchor = true;
    anchor.add(placementAnchor);
  }
  const fallbackMeshes = Array.from({ length: 9 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const first = attachCanopyTreeLibraryVisual(
    anchor,
    template,
    VEGETATION_LAYOUT.trees,
    { terrainHeight, terrainGradient, terrainWetness },
  );
  const second = attachCanopyTreeLibraryVisual(
    anchor,
    template,
    VEGETATION_LAYOUT.trees,
    { terrainHeight, terrainGradient, terrainWetness },
  );
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.instanceCount, 128);
  assert.deepEqual(first.userData.counts, [6, 37, 42, 43]);
  assert.deepEqual(first.userData.habitatCounts, {
    'humid-retentive-broadleaf': 6,
    'drained-open-broadleaf': 37,
    'plate-barked-compound-margin': 42,
    'raised-araucaria-tier': 43,
  });
  assert.equal(first.children.length, 8);
  assert.equal(first.userData.supportSummary.supportVertexCount, 3_540);
  assert.equal(first.userData.supportSummary.supportedVertexCount, 3_540);
  assert.equal(first.userData.supportSummary.supportRatio, 1);
  assert.ok(first.userData.supportSummary.minimumClearance >= -0.82);
  assert.ok(first.userData.supportSummary.maximumClearance <= 0);
  assert.equal(first.userData.supportSummary.settlementAxis, 'world-gravity-only');
  assert.equal(first.userData.albedoProfile, 'source-coupled-bounded-foliage-albedo-v1');
  assert.equal(
    first.userData.surfaceVariation,
    CANOPY_TREE_SURFACE_VARIATION_PROFILE,
  );
  assert.equal(
    first.userData.leafRetentionSummary.version,
    'age-wind-and-habitat-leaf-retention-v1',
  );
  assert.equal(first.userData.leafRetentionSummary.ageCounts.unspecified, 128);
  assert.ok(first.userData.leafRetentionSummary.minimumRetention >= 0.82);
  assert.ok(first.userData.leafRetentionSummary.maximumRetention <= 0.985);
  assert.ok(
    first.userData.leafRetentionSummary.maximumRetention
      - first.userData.leafRetentionSummary.minimumRetention > 0.01,
  );
  for (const dimensions of first.userData.dimensionSummary) {
    assert.equal(dimensions.envelopePassCount, dimensions.instanceCount, dimensions.id);
    assert.ok(dimensions.maximumDiameterMeters <= dimensions.maximumCrownDiameterMeters);
    assert.ok(dimensions.maximumHeightMeters <= dimensions.maximumMatureHeightMeters);
  }
  const renderedTriangles = first.userData.counts.reduce(
    (sum, count, index) => sum + count * CANOPY_TREE_LIBRARY_ASSET.trianglesByVariant[index],
    0,
  );
  assert.equal(renderedTriangles, 1_081_758);
  assert.ok(renderedTriangles <= 1_100_000);
  for (const tree of VEGETATION_LAYOUT.trees) {
    const placementAnchor = anchor.children[tree.index];
    assert.equal(placementAnchor.position.x, tree.x);
    assert.equal(placementAnchor.position.z, tree.z);
    assert.equal(placementAnchor.rotation.x, 0);
    assert.equal(placementAnchor.rotation.z, 0);
  }
  for (const mesh of first.children) {
    assert.ok(mesh.geometry.attributes.canopyTreeFlex);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
    if (mesh.userData.role === 'attached-leaves') {
      const retention = mesh.geometry.getAttribute('canopyTreeLeafRetention');
      assert.ok(retention?.isInstancedBufferAttribute);
      assert.equal(retention.count, mesh.count);
      assert.ok(Math.min(...retention.array) >= 0.82);
      assert.ok(Math.max(...retention.array) <= 0.985);
      assert.equal(
        mesh.material.userData.albedoProfile,
        'source-coupled-bounded-foliage-albedo-v1',
      );
      assert.equal(
        mesh.material.userData.surfaceVariationModel,
        CANOPY_TREE_SURFACE_VARIATION_PROFILE,
      );
    } else {
      const surfaceVariation = mesh.geometry.getAttribute('canopyTreeStructureVariation');
      assert.ok(surfaceVariation?.isInstancedBufferAttribute);
      assert.equal(surfaceVariation.count, mesh.count);
      assert.ok(Math.min(...surfaceVariation.array) >= 0);
      assert.ok(Math.max(...surfaceVariation.array) <= 1);
      assert.ok(new Set(Array.from(surfaceVariation.array, (value) => value.toFixed(4))).size > 1);
      assert.equal(
        mesh.material.userData.surfaceVariationModel,
        CANOPY_TREE_SURFACE_VARIATION_PROFILE,
      );
    }
    assert.equal(
      mesh.customDepthMaterial.userData.windUniforms,
      mesh.material.userData.windUniforms,
    );
    const colourShader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <uv_pars_vertex>\n#include <begin_vertex>\n#include <project_vertex>',
      fragmentShader: '#include <common>\n#include <uv_pars_fragment>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <alphatest_fragment>\n#include <lights_fragment_begin>',
    };
    const depthShader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <alphatest_fragment>',
    };
    mesh.material.onBeforeCompile(colourShader);
    mesh.customDepthMaterial.onBeforeCompile(depthShader);
    assert.equal(
      colourShader.uniforms.canopyTreeWindTime,
      depthShader.uniforms.canopyTreeWindTime,
    );
    if (mesh.userData.role === 'attached-leaves') {
      assert.match(colourShader.vertexShader, /canopyTreeWindResponse/);
      assert.match(depthShader.vertexShader, /canopyTreeWindResponse/);
      assert.match(colourShader.vertexShader, /transformed \+= canopyTreeWindLocalDirection/);
      assert.match(depthShader.vertexShader, /transformed \+= canopyTreeWindLocalDirection/);
      assert.match(colourShader.fragmentShader, /canopyTreeLeafRetentionRank/);
      assert.match(depthShader.fragmentShader, /canopyTreeLeafRetentionRank/);
      assert.match(colourShader.fragmentShader, /canopyTreeEdgeNotch/);
      assert.match(depthShader.fragmentShader, /canopyTreeEdgeNotch/);
      assert.match(colourShader.fragmentShader, /canopyTreePerforation/);
      assert.match(depthShader.fragmentShader, /canopyTreePerforation/);
      assert.match(colourShader.fragmentShader, /discard/);
      assert.match(depthShader.fragmentShader, /discard/);
    } else {
      assert.match(colourShader.vertexShader, /canopyTreeStructureVariation/);
      assert.match(colourShader.fragmentShader, /canopyTreeScarCore/);
      assert.match(colourShader.fragmentShader, /canopyTreeScarCallus/);
      assert.doesNotMatch(depthShader.fragmentShader, /canopyTreeScarCore/);
    }
  }
  updateCanopyTreeLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  assert.equal(
    first.userData.materials.windUniforms.strength.value,
    CANOPY_TREE_WIND_PROFILE.horizontalTipDisplacementMeters,
  );
  updateCanopyTreeLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
  assert.equal(first.userData.materials.windUniforms.verticalStrength.value, 0);
});

test('riparian cover reuses all four complete tree silhouettes on ten supported roots', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  for (const tree of COVER_RIPARIAN_TREE_LAYOUT) {
    const placementAnchor = new THREE.Group();
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    placementAnchor.userData.canopyTreePlacementAnchor = true;
    anchor.add(placementAnchor);
  }
  const fallbackMeshes = Array.from({ length: 36 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const visual = attachCanopyTreeLibraryVisual(
    anchor,
    template,
    COVER_RIPARIAN_TREE_LAYOUT,
    { terrainHeight, terrainGradient, terrainWetness },
  );
  assert.equal(visual.userData.instanceCount, 10);
  assert.deepEqual(visual.userData.counts, [5, 1, 3, 1]);
  assert.equal(visual.userData.supportSummary.supportVertexCount, 286);
  assert.equal(visual.userData.supportSummary.supportedVertexCount, 286);
  assert.equal(visual.userData.supportSummary.supportRatio, 1);
  assert.ok(visual.userData.supportSummary.minimumClearance >= -0.82);
  assert.ok(visual.userData.supportSummary.maximumClearance <= 0);
  assert.deepEqual(visual.userData.leafRetentionSummary.ageCounts, {
    submature: 3,
    mature: 5,
    pioneer: 2,
  });
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.ok(visual.userData.dimensionSummary.every(
    ({ instanceCount, envelopePassCount }) => instanceCount === envelopePassCount,
  ));
});
