import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { FERN_LIBRARY_LAYOUT, VEGETATION_LAYOUT } from '../src/environment-layout.js';
import {
  attachFernLibraryVisual,
  classifyFernHabitat,
  createCachedFernLibraryLoader,
  createFernSurfaceTextures,
  FERN_LIBRARY_ASSET,
  FERN_WIND_PROFILE,
  updateFernLibraryWind,
} from '../src/fern-library.js';
import { terrainGradient, terrainHeight, terrainWetness } from '../src/terrain.js';
import { createWorld } from '../src/world.js';

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

function fixtureTemplate() {
  const root = new THREE.Group();
  FERN_LIBRARY_ASSET.variantIds.forEach((variantId, variantIndex) => {
    const group = new THREE.Group();
    group.userData.variantId = variantId;
    group.userData.variantIndex = variantIndex;
    for (const name of ['fern-load-bearing-structure', 'fern-attached-leaflets']) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
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
  const asset = new URL(`../public${FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const load = createCachedFernLibraryLoader({
    loaderFactory: () => ({
      async loadAsync() {
        return new GLTFLoader().parseAsync(arrayBuffer, '');
      },
    }),
  });
  return load();
}

test('original fern library is deterministic, compact, diverse and project-owned', () => {
  assert.equal(FERN_LIBRARY_ASSET.url, '/assets/fern-library-original-v1.glb');
  assert.equal(FERN_LIBRARY_ASSET.version, 'original-fern-library-v1');
  assert.ok(FERN_LIBRARY_ASSET.bytes < 600_000);
  assert.equal(FERN_LIBRARY_ASSET.triangles, 6_594);
  assert.deepEqual(FERN_LIBRARY_ASSET.trianglesByVariant, [2_094, 2_160, 2_340]);
  assert.equal(FERN_LIBRARY_ASSET.drawCalls, 6);
  assert.equal(FERN_LIBRARY_ASSET.drawCallsPerVariant, 2);
  assert.equal(FERN_LIBRARY_ASSET.variantCount, 3);
  assert.deepEqual(FERN_LIBRARY_ASSET.variantIds, [
    'brook-arch-fern', 'upland-feather-fern', 'low-cycad-fern',
  ]);
  assert.equal(
    FERN_LIBRARY_ASSET.provenance,
    'project-original-deterministic-offline-authored-mesh-library',
  );
  assert.equal(FERN_LIBRARY_ASSET.rights, 'project-original-code-authored-output');

  const asset = new URL(`../public${FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, FERN_LIBRARY_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), FERN_LIBRARY_ASSET.sha256);
});

test('fern variants preserve a closed root-to-rachis load path and independent flex coordinates', async () => {
  const asset = new URL(`../public${FERN_LIBRARY_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const variants = [];
  gltf.scene.traverse((child) => {
    if (child.userData.variantId) variants.push(child);
  });
  let triangles = 0;
  assert.equal(variants.length, FERN_LIBRARY_ASSET.variantCount);
  assert.deepEqual(variants.map((variant) => variant.userData.variantId), FERN_LIBRARY_ASSET.variantIds);
  for (const variant of variants) {
    const meshes = variant.children.filter((child) => child.isMesh);
    assert.equal(meshes.length, FERN_LIBRARY_ASSET.drawCallsPerVariant, variant.name);
    const structure = meshes.find((mesh) => mesh.userData.name === 'fern-load-bearing-structure');
    const leaflets = meshes.find((mesh) => mesh.userData.name === 'fern-attached-leaflets');
    assert.ok(structure, variant.name);
    assert.ok(leaflets, variant.name);
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      assert.ok(geometry.attributes.normal, mesh.name);
      assert.ok(geometry.attributes.color, mesh.name);
      assert.ok(geometry.attributes.uv, mesh.name);
      assert.ok(geometry.attributes.uv1, mesh.name);
      assert.equal(geometry.attributes.uv1.count, geometry.attributes.position.count, mesh.name);
      assert.equal(mesh.material.metalness, 0, mesh.name);
      assert.ok(mesh.material.roughness >= 0.88, mesh.name);
      assert.equal(mesh.material.emissive.getHex(), 0, mesh.name);
    }
    const nonManifold = [...edgeUseCounts(structure.geometry).values()]
      .filter((count) => count !== 2);
    assert.deepEqual(nonManifold, [], `${variant.name} structure has an open edge`);
    assert.equal(
      structure.geometry.userData.supportModel,
      'buried-rhizome-to-overlapping-petioles-to-attached-leaflets',
    );
    assert.equal(
      leaflets.geometry.userData.supportModel,
      'each-leaflet-root-overlaps-load-bearing-rachis',
    );
    const structurePositions = structure.geometry.getAttribute('position');
    const structureNormals = structure.geometry.getAttribute('normal');
    const structureFlex = structure.geometry.getAttribute('uv1');
    let supportVertices = 0;
    let downwardNormals = 0;
    let flexibleRachisVertices = 0;
    for (let index = 0; index < structurePositions.count; index += 1) {
      if (structurePositions.getY(index) <= FERN_LIBRARY_ASSET.supportPlaneY + 0.002) {
        supportVertices += 1;
        assert.equal(structureFlex.getY(index), 0);
      }
      if (structureNormals.getY(index) < -0.65) downwardNormals += 1;
      if (structureFlex.getY(index) > 0.9) flexibleRachisVertices += 1;
    }
    assert.equal(supportVertices, 13, variant.name);
    assert.ok(downwardNormals >= 1, variant.name);
    assert.ok(flexibleRachisVertices >= variant.userData.frondCount, variant.name);
    const leafPositions = leaflets.geometry.getAttribute('position');
    const leafFlex = leaflets.geometry.getAttribute('uv1');
    let minimumLeafY = Infinity;
    let minimumFlex = Infinity;
    let maximumFlex = -Infinity;
    for (let index = 0; index < leafPositions.count; index += 1) {
      minimumLeafY = Math.min(minimumLeafY, leafPositions.getY(index));
      minimumFlex = Math.min(minimumFlex, leafFlex.getY(index));
      maximumFlex = Math.max(maximumFlex, leafFlex.getY(index));
    }
    assert.ok(minimumLeafY >= 0.0179, { variant: variant.name, minimumLeafY });
    assert.ok(minimumFlex > 0 && minimumFlex <= 0.13, { variant: variant.name, minimumFlex });
    assert.equal(maximumFlex, 1, variant.name);
  }
  assert.equal(triangles, FERN_LIBRARY_ASSET.triangles);
});

test('cached fern loader clamps imported materials to non-emissive dielectric bounds', async () => {
  let loads = 0;
  const load = createCachedFernLibraryLoader({
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
    assert.equal(object.castShadow, true);
    assert.equal(object.receiveShadow, true);
    assert.ok(object.material.roughness >= 0.86);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.34);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
  });
});

test('fern surface texture channels are correlated, bounded and locally authored', () => {
  const textures = createFernSurfaceTextures(16);
  assert.equal(textures.albedo.name, 'world.material.fern-leaf-albedo');
  assert.equal(textures.roughness.name, 'world.material.fern-leaf-roughness');
  assert.equal(textures.height.name, 'world.material.fern-leaf-height');
  assert.equal(textures.albedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(textures.roughness.colorSpace, THREE.NoColorSpace);
  assert.equal(textures.height.colorSpace, THREE.NoColorSpace);
  for (const texture of Object.values(textures)) {
    assert.equal(
      texture.userData.source,
      'deterministic-original-code-authored-correlated-leaf-surface',
    );
    assert.equal(texture.image.width, 16);
    assert.equal(texture.image.height, 16);
  }
  const albedo = textures.albedo.image.data;
  const roughness = textures.roughness.image.data;
  const height = textures.height.image.data;
  const centre = ((8 * 16) + 8) * 4;
  const edge = ((8 * 16) + 1) * 4;
  assert.ok(albedo[centre] > albedo[edge]);
  assert.ok(roughness[centre] < roughness[edge]);
  assert.ok(height[centre] > height[edge]);
});

test('habitat classification prioritizes moisture and slope before seeded variation', () => {
  const flat = () => ({ x: 0, z: 0 });
  assert.equal(classifyFernHabitat({ x: 0, z: 0, variantIndex: 2 }, {
    terrainGradient: flat,
    terrainWetness: () => 0.6,
  }).variantIndex, 0);
  assert.equal(classifyFernHabitat({ x: 0, z: 0, variantIndex: 2 }, {
    terrainGradient: () => ({ x: 0.1, z: 0 }),
    terrainWetness: () => 0,
  }).variantIndex, 1);
  assert.equal(classifyFernHabitat({ x: 0, z: 0, variantIndex: 2 }, {
    terrainGradient: flat,
    terrainWetness: () => 0,
  }).variantIndex, 2);
});

test('fern library settles every rhizome, hides fallback and couples colour/depth wind', async () => {
  const template = await loadActualTemplate();
  const anchor = new THREE.Group();
  const fallbackMeshes = Array.from({ length: 3 }, () => ({ visible: true }));
  anchor.userData.fallbackMeshes = fallbackMeshes;
  const first = attachFernLibraryVisual(anchor, template, FERN_LIBRARY_LAYOUT, {
    terrainHeight,
    terrainGradient,
    terrainWetness,
  });
  const second = attachFernLibraryVisual(anchor, template, FERN_LIBRARY_LAYOUT, {
    terrainHeight,
    terrainGradient,
    terrainWetness,
  });
  assert.equal(first, second);
  assert.ok(fallbackMeshes.every((mesh) => mesh.visible === false));
  assert.equal(first.userData.assetVersion, FERN_LIBRARY_ASSET.version);
  assert.equal(first.userData.instanceCount, 132);
  assert.equal(first.children.length, FERN_LIBRARY_ASSET.drawCalls);
  assert.deepEqual(first.userData.counts, [44, 54, 34]);
  assert.deepEqual(first.userData.habitatCounts, {
    'humid-brook-margin': 44,
    'drained-upland-slope': 54,
    'sheltered-low-understory': 34,
  });
  assert.equal(first.userData.supportEvidence.length, 132);
  assert.equal(first.userData.supportSummary.supportRatio, 1);
  assert.equal(first.userData.supportSummary.supportVertexCount, 1_716);
  assert.ok(first.userData.supportSummary.minimumClearance >= -0.055);
  assert.ok(first.userData.supportSummary.maximumClearance <= 0.018);
  assert.equal(first.userData.collisionRole, 'non-solid-pliable-understory');
  assert.equal(first.userData.albedoProfile, 'source-coupled-bounded-foliage-albedo-v1');

  for (const mesh of first.children) {
    assert.equal(mesh.count, first.userData.counts[FERN_LIBRARY_ASSET.variantIds.indexOf(
      mesh.userData.variantId,
    )]);
    assert.ok(mesh.geometry.attributes.fernFlex);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
    assert.equal(mesh.material.emissiveIntensity, 0);
    assert.equal(
      mesh.material.userData.albedoProfile,
      'source-coupled-bounded-foliage-albedo-v1',
    );
    assert.equal(mesh.castShadow, true);
    assert.equal(mesh.receiveShadow, true);
    assert.equal(mesh.userData.collisionRole, FERN_LIBRARY_ASSET.collisionRole);
    assert.equal(
      mesh.customDepthMaterial.userData.windUniforms,
      mesh.material.userData.windUniforms,
    );
    assert.equal(mesh.customDepthMaterial.userData.shadowModel, FERN_WIND_PROFILE.shadowModel);
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
    assert.equal(colourShader.uniforms.fernWindTime, depthShader.uniforms.fernWindTime);
    assert.match(colourShader.vertexShader, /fernFlex\.y/);
    assert.match(colourShader.vertexShader, /instanceMatrix/);
  }

  updateFernLibraryWind(anchor, 14.75, false);
  assert.equal(first.userData.materials.windUniforms.time.value, 14.75);
  assert.equal(
    first.userData.materials.windUniforms.strength.value,
    FERN_WIND_PROFILE.horizontalTipDisplacementMeters,
  );
  updateFernLibraryWind(anchor, 18, true);
  assert.equal(first.userData.materials.windUniforms.time.value, 0);
  assert.equal(first.userData.materials.windUniforms.strength.value, 0);
  assert.equal(first.userData.materials.windUniforms.verticalStrength.value, 0);
});

test('original ferns replace all static procedural skirt and wetland accents within mature envelopes', async () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const anchor = scene.getObjectByName('world.connected_route.ferns.accent-asset-anchor');
  assert.ok(anchor?.isGroup);
  assert.equal(anchor.userData.placements.length, 88);
  assert.deepEqual(Object.fromEntries([
    'tree-fern-understory-skirt-replacement',
    'degradable-wetland-accent-replacement',
    'degradable-margin-accent-replacement',
  ].map((role) => [
    role,
    anchor.userData.placements.filter((placement) => placement.sourceRole === role).length,
  ])), {
    'tree-fern-understory-skirt-replacement': 24,
    'degradable-wetland-accent-replacement': 36,
    'degradable-margin-accent-replacement': 28,
  });
  assert.equal(anchor.userData.fallbackMeshes.length, 3);
  assert.ok(anchor.userData.fallbackMeshes.every((mesh) => mesh.visible));

  const visual = attachFernLibraryVisual(
    anchor,
    await loadActualTemplate(),
    anchor.userData.placements,
    { terrainHeight, terrainGradient, terrainWetness },
  );
  assert.equal(visual.userData.instanceCount, 88);
  assert.deepEqual(visual.userData.counts, [44, 20, 24]);
  assert.deepEqual(visual.userData.habitatCounts, {
    'humid-brook-margin': 44,
    'drained-upland-slope': 20,
    'sheltered-low-understory': 24,
  });
  assert.ok(anchor.userData.fallbackMeshes.every((mesh) => !mesh.visible));
  assert.equal(visual.userData.supportSummary.supportVertexCount, 1_144);
  assert.equal(visual.userData.supportSummary.supportedVertexCount, 1_144);
  assert.equal(visual.userData.supportSummary.supportRatio, 1);
  assert.ok(visual.userData.supportSummary.minimumClearance >= -0.055);
  assert.ok(visual.userData.supportSummary.maximumClearance <= 0.018);
  for (const dimensions of Object.values(visual.userData.dimensionSummary)) {
    assert.equal(dimensions.envelopePassCount, dimensions.instanceCount);
    assert.ok(dimensions.maximumDiameterMeters <= dimensions.maxDiameterMeters);
    assert.ok(dimensions.maximumHeightMeters <= dimensions.maxHeightMeters);
  }
  updateFernLibraryWind(anchor, 14.75, false);
  assert.equal(visual.userData.materials.windUniforms.time.value, 14.75);
  world.update(14.75, false, { quality: 'low' });
  assert.equal(anchor.parent.visible, false);
  world.update(14.75, false, { quality: 'balanced' });
  assert.equal(anchor.parent.visible, true);
});
