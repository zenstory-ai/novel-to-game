import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  attachBrookBoulderVisual,
  BROOK_BOULDER_ASSET,
  createCachedBrookBoulderLoader,
} from '../src/brook-boulder.js';

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

function massProperties(geometry) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.index?.array;
  const vertexAt = (index) => indices?.[index] ?? index;
  const length = indices?.length ?? positions.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const contribution = new THREE.Vector3();
  let volume = 0;
  for (let index = 0; index < length; index += 3) {
    a.fromBufferAttribute(positions, vertexAt(index));
    b.fromBufferAttribute(positions, vertexAt(index + 1));
    c.fromBufferAttribute(positions, vertexAt(index + 2));
    const tetrahedronVolume = a.dot(cross.crossVectors(b, c)) / 6;
    volume += tetrahedronVolume;
    contribution.copy(a).add(b).add(c).multiplyScalar(tetrahedronVolume / 4);
    centroid.add(contribution);
  }
  return { volume, centroid: centroid.divideScalar(volume) };
}

function convexHull(points) {
  const unique = [...new Map(points.map((point) => [point.join(','), point])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (origin, a, b) => (
    (a[0] - origin[0]) * (b[1] - origin[1])
      - (a[1] - origin[1]) * (b[0] - origin[0])
  );
  const half = (ordered) => {
    const result = [];
    for (const point of ordered) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), point) <= 0) {
        result.pop();
      }
      result.push(point);
    }
    return result;
  };
  return [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
}

function fixtureTemplate() {
  const template = new THREE.Group();
  for (const name of [
    'brook-boulder-load-bearing-mass',
    ...Array.from({ length: 5 }, (_, index) => `brook-boulder-spall-${index + 1}`),
  ]) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0xffffff,
        emissiveIntensity: 2,
        envMapIntensity: 3,
      }),
    );
    mesh.name = name;
    template.add(mesh);
  }
  return template;
}

test('original brook boulder is deterministic, compact and project-owned', () => {
  assert.equal(BROOK_BOULDER_ASSET.url, '/assets/brook-boulder-original-v6.glb');
  assert.equal(BROOK_BOULDER_ASSET.version, 'original-brook-boulder-v6');
  assert.ok(BROOK_BOULDER_ASSET.bytes < 230_000);
  assert.equal(BROOK_BOULDER_ASSET.triangles, 1_626);
  assert.equal(BROOK_BOULDER_ASSET.massTriangles, 1_344);
  assert.equal(BROOK_BOULDER_ASSET.apronTriangles, 282);
  assert.equal(BROOK_BOULDER_ASSET.drawCalls, 6);
  assert.equal(BROOK_BOULDER_ASSET.fragmentCount, 5);
  assert.equal(
    BROOK_BOULDER_ASSET.provenance,
    'project-original-deterministic-offline-authored-geometry',
  );
  assert.equal(BROOK_BOULDER_ASSET.rights, 'project-original-code-authored-output');
  assert.equal(
    BROOK_BOULDER_ASSET.transportClass,
    'immobile-residual-bank-erratic-reexposed-on-inner-bend',
  );

  const asset = new URL(`../public${BROOK_BOULDER_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  assert.equal(statSync(asset).size, BROOK_BOULDER_ASSET.bytes);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    BROOK_BOULDER_ASSET.sha256,
  );
});

test('brook boulder mass and spall apron are closed, outward-facing and load-bearing', async () => {
  const asset = new URL(`../public${BROOK_BOULDER_ASSET.url}`, import.meta.url);
  const bytes = readFileSync(asset);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const root = gltf.scene.getObjectByName('brook-boulder-original-v6');
  assert.equal(
    root.userData.albedoModel,
    'coordinate-weathering-and-porosity-varied-capillary-front',
  );
  assert.equal(root.userData.transportClass, BROOK_BOULDER_ASSET.transportClass);
  assert.equal(
    root.userData.normalModel,
    'forty-two-degree-selective-fracture-crease-with-continuous-weathered-normals',
  );
  const meshes = [];
  let triangles = 0;
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    meshes.push(object);
    const geometry = object.geometry;
    const meshTriangles = (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    triangles += meshTriangles;
    assert.ok(geometry.attributes.normal, object.name);
    assert.ok(geometry.attributes.color, object.name);
    assert.ok(geometry.attributes.uv, object.name);
    assert.equal(object.material.metalness, 0, object.name);
    assert.ok(object.material.roughness >= 0.9, object.name);
    assert.equal(object.material.emissive.getHex(), 0, object.name);
    const colourValues = Array.from(geometry.attributes.color.array);
    assert.ok(Math.max(...colourValues) < 0.14, {
      object: object.name,
      maximumColourChannel: Math.max(...colourValues),
    });
    const nonManifold = [...edgeUseCounts(geometry).values()].filter((count) => count !== 2);
    assert.deepEqual(nonManifold, [], `${object.name} contains an open or non-manifold edge`);
    const supportPlaneY = geometry.userData.supportPlaneY;
    assert.ok(Math.abs(supportPlaneY - BROOK_BOULDER_ASSET.supportPlaneY) < 1e-6);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    let supportVertices = 0;
    let downwardNormals = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) <= supportPlaneY + 0.0002) supportVertices += 1;
      if (normals.getY(index) < -0.65) downwardNormals += 1;
    }
    assert.ok(supportVertices >= 6, { object: object.name, supportVertices });
    assert.ok(downwardNormals >= 1, { object: object.name, downwardNormals });
  });
  assert.equal(meshes.length, BROOK_BOULDER_ASSET.drawCalls);
  assert.equal(triangles, BROOK_BOULDER_ASSET.triangles);

  const mass = gltf.scene.getObjectByName('brook-boulder-load-bearing-mass');
  const spalls = Array.from(
    { length: BROOK_BOULDER_ASSET.fragmentCount },
    (_, index) => gltf.scene.getObjectByName(`brook-boulder-spall-${index + 1}`),
  );
  assert.equal(mass.geometry.userData.supportModel, 'coplanar-broad-base-under-centre-of-mass');
  assert.equal(mass.geometry.userData.centreOfMassProjection, 'inside-support-polygon');
  assert.ok(mass.geometry.userData.supportVertexCount >= 12);
  assert.ok(mass.geometry.userData.fracturePlaneCount >= 4);
  assert.equal(
    mass.geometry.userData.normalModel,
    'forty-two-degree-selective-fracture-crease-with-continuous-weathered-normals',
  );
  assert.equal(mass.geometry.index, null, 'fracture faces need independent authored normals');
  assert.equal(mass.geometry.userData.surfaceSectors, 48);
  assert.equal(mass.geometry.userData.surfaceRingCount, 14);
  assert.ok(
    BROOK_BOULDER_ASSET.massTriangles >= 1_300,
    'review-scale silhouette needs authored geometry rather than a low-poly normal-map disguise',
  );
  const massPositions = mass.geometry.getAttribute('position');
  const massNormals = mass.geometry.getAttribute('normal');
  const normalGroups = new Map();
  for (let index = 0; index < massPositions.count; index += 1) {
    const key = [
      massPositions.getX(index),
      massPositions.getY(index),
      massPositions.getZ(index),
    ].map((value) => Math.round(value * 100_000)).join(',');
    const normals = normalGroups.get(key) ?? [];
    normals.push(new THREE.Vector3().fromBufferAttribute(massNormals, index));
    normalGroups.set(key, normals);
  }
  let continuousVertices = 0;
  let selectiveCreaseVertices = 0;
  for (const normals of normalGroups.values()) {
    let maximumAngle = 0;
    for (let first = 0; first < normals.length; first += 1) {
      for (let second = first + 1; second < normals.length; second += 1) {
        maximumAngle = Math.max(maximumAngle, normals[first].angleTo(normals[second]));
      }
    }
    if (maximumAngle < THREE.MathUtils.degToRad(2)) continuousVertices += 1;
    if (maximumAngle > THREE.MathUtils.degToRad(8)) selectiveCreaseVertices += 1;
  }
  assert.ok(continuousVertices / normalGroups.size > 0.9, {
    continuousVertices,
    uniqueVertices: normalGroups.size,
  });
  assert.ok(selectiveCreaseVertices >= 40 && selectiveCreaseVertices <= 70, {
    selectiveCreaseVertices,
  });
  const { volume, centroid } = massProperties(mass.geometry);
  assert.ok(volume > 1.7 && volume < 1.9, { volume });
  const supportPoints = [];
  for (let index = 0; index < massPositions.count; index += 1) {
    if (Math.abs(massPositions.getY(index) - BROOK_BOULDER_ASSET.supportPlaneY) > 1e-5) {
      continue;
    }
    supportPoints.push([massPositions.getX(index), massPositions.getZ(index)]);
  }
  const hull = convexHull(supportPoints);
  assert.ok(hull.length >= 10);
  const centreProjection = [centroid.x, centroid.z];
  const supportMargins = hull.map((start, index) => {
    const end = hull[(index + 1) % hull.length];
    const edgeX = end[0] - start[0];
    const edgeZ = end[1] - start[1];
    return (
      edgeX * (centreProjection[1] - start[1])
        - edgeZ * (centreProjection[0] - start[0])
    ) / Math.hypot(edgeX, edgeZ);
  });
  assert.ok(Math.min(...supportMargins) > 0.5, {
    centreOfMass: centroid.toArray(),
    minimumSupportMargin: Math.min(...supportMargins),
  });
  assert.ok(spalls.every(Boolean));
  for (const [index, spall] of spalls.entries()) {
    assert.equal(spall.geometry.userData.fragmentIndex, index);
    assert.equal(
      spall.geometry.userData.supportModel,
      'independent-fragment-resting-on-bank-sediment',
    );
  }
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3());
  const massSize = new THREE.Box3().setFromObject(mass).getSize(new THREE.Vector3());
  assert.ok(massSize.x >= 1.9 && massSize.x <= 1.92, massSize.toArray());
  assert.ok(massSize.y >= 1.11 && massSize.y <= 1.13, massSize.toArray());
  assert.ok(massSize.z >= 1.65 && massSize.z <= 1.67, massSize.toArray());
  assert.ok(size.x >= 2.5 && size.x <= 2.56, size.toArray());
  assert.ok(size.y >= 1.11 && size.y <= 1.13, size.toArray());
  assert.ok(size.z >= 2.1 && size.z <= 2.14, size.toArray());
  assert.ok(bounds.min.y <= -0.559, bounds.min.toArray());
});

test('cached brook boulder loader enforces dielectric material bounds', async () => {
  let loads = 0;
  const load = createCachedBrookBoulderLoader({
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
    assert.ok(object.material.roughness >= 0.9);
    assert.equal(object.material.metalness, 0);
    assert.ok(object.material.envMapIntensity <= 0.22);
    assert.equal(object.material.emissive.getHex(), 0);
    assert.equal(object.material.emissiveIntensity, 0);
    assert.equal(object.material.flatShading, false);
  });
});

test('brook boulder attaches once with correlated surface maps and hides its fallback', async () => {
  const load = createCachedBrookBoulderLoader({
    loaderFactory: () => ({ loadAsync: async () => ({ scene: fixtureTemplate() }) }),
  });
  const template = await load();
  const anchor = new THREE.Group();
  const fallback = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  anchor.userData.fallback = fallback;
  anchor.add(fallback);
  const textures = {
    albedo: new THREE.Texture(),
    roughness: new THREE.Texture(),
    height: new THREE.Texture(),
  };
  const first = attachBrookBoulderVisual(anchor, template, textures);
  const second = attachBrookBoulderVisual(anchor, template, textures);
  assert.equal(first, second);
  assert.equal(fallback.visible, false);
  assert.equal(first.userData.assetVersion, BROOK_BOULDER_ASSET.version);
  assert.equal(first.userData.supportModel, BROOK_BOULDER_ASSET.supportModel);
  assert.equal(first.userData.collisionRole, BROOK_BOULDER_ASSET.collisionRole);
  assert.equal(first.userData.transportClass, BROOK_BOULDER_ASSET.transportClass);
  assert.equal(first.userData.normalModel, BROOK_BOULDER_ASSET.normalModel);
  const mass = first.getObjectByName('brook-boulder-load-bearing-mass');
  const spalls = Array.from(
    { length: BROOK_BOULDER_ASSET.fragmentCount },
    (_, index) => first.getObjectByName(`brook-boulder-spall-${index + 1}`),
  );
  for (const mesh of [mass, ...spalls]) {
    assert.equal(mesh.material.map, null);
    assert.equal(mesh.material.roughnessMap, null);
    assert.equal(mesh.material.bumpMap, null);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissive.getHex(), 0);
    assert.equal(
      mesh.material.userData.mapping,
      'seam-free-object-space-triplanar-albedo-roughness-relief',
    );
    assert.equal(mesh.material.userData.triplanarTextures.albedo, textures.albedo);
    assert.equal(mesh.material.userData.triplanarTextures.roughness, textures.roughness);
    assert.equal(mesh.material.userData.triplanarTextures.height, textures.height);
    assert.equal(
      mesh.material.userData.albedoModel,
      'coordinate-weathering-and-porosity-varied-capillary-front',
    );
    assert.deepEqual(mesh.material.userData.capillaryBand, {
      nominalFrontY: -0.455,
      porosityVariationMeters: 0.09,
      lowerTransitionMeters: 0.08,
      upperTransitionMeters: 0.07,
      saturatedRoughness: 0.74,
      porositySource: 'same-correlated-height-field-as-optical-relief',
    });
  }
  assert.equal(mass.material.color.getHex(), 0x747c76);
  assert.ok(spalls.every((spall) => spall.material.color.getHex() === 0x6b746e));
  assert.equal(mass.material.customProgramCacheKey(), 'brook-boulder-triplanar-v5-mass');
  assert.equal(mass.material.userData.reliefScale, 0.24);
  assert.ok(spalls.every((spall) => (
    spall.material.customProgramCacheKey() === 'brook-boulder-triplanar-v5-spall'
      && spall.material.userData.reliefScale === 0.16
  )));
});
