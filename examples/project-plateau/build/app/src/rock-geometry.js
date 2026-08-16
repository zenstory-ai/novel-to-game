import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

function createFracturedBasaltGeometry(radialSegments = 6) {
  const rings = [
    [-0.5, 1.04, 0, 0, 0.8],
    [-0.34, 1.015, 0.018, -0.012, 0.84],
    [-0.19, 1.035, 0.026, -0.018, 0.88],
    [-0.04, 1.0, 0.008, 0.014, 0.83],
    [0.11, 1.025, -0.016, 0.024, 0.89],
    [0.25, 0.99, -0.022, 0.006, 0.82],
    [0.38, 0.975, 0.012, -0.014, 0.87],
    [0.5, 0.94, 0, 0, 0.78],
  ];
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  rings.forEach(([y, radius, offsetX, offsetZ, shade], ringIndex) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + 0.08;
      const jaggedTop = ringIndex === rings.length - 1
        ? [0.035, -0.02, 0.055, -0.035, 0.015, -0.012][side]
        : 0;
      vertices.push(
        offsetX + Math.cos(angle) * radius,
        y + jaggedTop,
        offsetZ + Math.sin(angle) * radius,
      );
      colors.push(shade, shade, shade);
      uvs.push(side / radialSegments, ringIndex / (rings.length - 1));
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottomCentre = vertices.length / 3;
  vertices.push(0, -0.5, 0);
  colors.push(0.78, 0.78, 0.78);
  uvs.push(0.5, 0.5);
  const topCentre = vertices.length / 3;
  vertices.push(0, 0.51, 0);
  colors.push(0.88, 0.88, 0.88);
  uvs.push(0.5, 0.5);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'subtly-tapered-polygonal-cooling-column';
  return geometry;
}

function createSmallWeatheredStoneGeometry() {
  // Small bed-load and ground stones still need a real support footprint.
  // A sphere supported only by duplicated pole vertices sinks its rounded
  // lower shell through the terrain and exposes a sharp dark intersection
  // band. Ten perimeter contacts plus one bottom centre make a closed,
  // non-overlapping base while the upper courses preserve an abraded pebble.
  const radialSegments = 10;
  const rings = [
    { y: 0, radiusX: 1, radiusZ: 0.88, offsetX: 0.01, offsetZ: -0.006 },
    { y: 0.1, radiusX: 0.96, radiusZ: 0.84, offsetX: 0.018, offsetZ: -0.008 },
    { y: 0.36, radiusX: 0.9, radiusZ: 0.8, offsetX: 0.012, offsetZ: 0.004 },
    { y: 0.69, radiusX: 0.72, radiusZ: 0.65, offsetX: -0.018, offsetZ: 0.01 },
    { y: 0.93, radiusX: 0.39, radiusZ: 0.35, offsetX: -0.035, offsetZ: 0.004 },
  ];
  const positions = [];
  const uvs = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      const abrasion = 1
        + Math.sin(angle * 3 + ringIndex * 0.73) * 0.025
        + Math.sin(angle * 5 - ringIndex * 0.31) * 0.012;
      positions.push(
        ring.offsetX + Math.cos(angle) * ring.radiusX * abrasion,
        ring.y,
        ring.offsetZ + Math.sin(angle) * ring.radiusZ * abrasion,
      );
      uvs.push(side / radialSegments, ring.y / 1.08);
    }
  }
  const bottomCapOffset = positions.length / 3;
  for (let side = 0; side < radialSegments; side += 1) {
    const source = side * 3;
    positions.push(positions[source], positions[source + 1], positions[source + 2]);
    uvs.push(
      positions[source] * 0.48 + 0.5,
      positions[source + 2] * 0.48 + 0.5,
    );
  }
  const bottomCentre = positions.length / 3;
  positions.push(0.01, 0, -0.006);
  uvs.push(0.5, 0.5);
  const topCentre = positions.length / 3;
  positions.push(-0.045, 1.08, 0);
  uvs.push(0.5, 1);

  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lowerOffset = ringIndex * radialSegments;
    const upperOffset = (ringIndex + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      indices.push(
        lowerOffset + side,
        upperOffset + side,
        lowerOffset + next,
        upperOffset + side,
        upperOffset + next,
        lowerOffset + next,
      );
    }
  }
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, bottomCapOffset + side, bottomCapOffset + next);
    indices.push(topOffset + side, topCentre, topOffset + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function createWeatheredRockGeometry(seed, detail = 2) {
  // Keep a shared-vertex surface, but make the silhouette respond to erosion
  // and fracture planes rather than merely scaling a sphere. Broad clipped
  // faces remain continuous at their weathered edges, avoiding both a plastic
  // capsule and the unrelated per-triangle lighting of the old icosahedron.
  const geometry = detail <= 1
    ? createSmallWeatheredStoneGeometry()
    : new THREE.SphereGeometry(1, 14, 9);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const heroRock = detail > 1;
  const point = new THREE.Vector3();
  const fracturePlanes = [
    [new THREE.Vector3(0.83, 0.18, 0.52).normalize(), 0.76],
    [new THREE.Vector3(-0.68, 0.34, 0.65).normalize(), 0.78],
    [new THREE.Vector3(0.12, 0.58, -0.81).normalize(), 0.8],
  ];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const shelf = Math.sin(x * 4.7 + y * 2.3 - z * 3.1 + seed * 0.013) * 0.11;
    const broad = Math.sin(x * 2.1 - z * 2.8 + seed * 0.021) * 0.09;
    const scale = 0.94 + shelf + broad;
    let nextX;
    let nextY;
    let nextZ;
    if (heroRock) {
      nextX = x * scale * (0.98 + y * 0.09) + Math.sin(y * 4.1 + seed) * 0.055;
      nextY = y * scale * 0.84 + Math.sin(x * 3.8 - z * 4.2) * 0.045;
      nextZ = z * scale * (0.94 - y * 0.045) + Math.sin(x * 3.2 + seed * 0.1) * 0.05;
      if (nextY < -0.52) nextY = -0.52 + (nextY + 0.52) * 0.1;
      if (nextY > 0.48) nextY = 0.48 + (nextY - 0.48) * 0.36;
    } else {
      const heightFraction = y / 1.08;
      const crownCamber = Math.sin(Math.PI * heightFraction);
      const abrasion = 0.97 + shelf * 0.34 + broad * 0.28;
      nextX = x * abrasion + Math.sin(y * 4.1 + seed) * crownCamber * 0.035;
      nextY = y <= 0.0001
        ? 0
        : y + crownCamber * (
          x * 0.025
          - z * 0.018
          + Math.sin(x * 3.8 - z * 4.2) * 0.014
        );
      nextZ = z * (abrasion * 0.98) + Math.sin(x * 3.2 + seed * 0.1)
        * crownCamber * 0.03;
    }
    if (heroRock) {
      point.set(nextX, nextY, nextZ);
      for (const [normal, limit] of fracturePlanes) {
        const distance = point.dot(normal);
        if (distance > limit) point.addScaledVector(normal, -(distance - limit) * 0.78);
      }
      nextX = point.x;
      nextY = point.y;
      nextZ = point.z;
    }
    positions.setXYZ(index, nextX, nextY, nextZ);
    const heightLight = THREE.MathUtils.clamp(nextY * 0.065, -0.045, 0.065);
    const mineralBreak = Math.sin(nextX * 4.1 - nextZ * 3.7 + seed * 0.04) * 0.035;
    const shade = THREE.MathUtils.clamp(
      (heroRock ? 0.76 : 0.94) + heightLight + mineralBreak,
      heroRock ? 0.62 : 0.84,
      heroRock ? 0.86 : 1.03,
    );
    colors.push(
      shade * 0.93,
      shade,
      shade * 0.92,
    );
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = `weathered-fractured-rock-detail-${detail}`;
  geometry.userData.supportVertexCount = heroRock ? null : Array.from(
    { length: positions.count },
    (_, index) => positions.getY(index),
  ).filter((height) => height <= 0.0001).length;
  return geometry;
}

const NON_COLUMNAR_ROCK_PROFILES = Object.freeze({
  'fluvial-cobble': Object.freeze({
    seed: 31,
    profile: 'historical-high-flow-rounded-lag-clast',
    fractureModel: 'long-duration-abrasion-with-muted-broad-faces',
    materialColor: 0x4c5550,
    flatShading: false,
    bumpScale: 0.023,
    moistureModel: 'porosity-varied-low-capillary-front',
  }),
  'bedded-slab': Object.freeze({
    seed: 47,
    profile: 'joint-bounded-tabular-plateau-slab',
    fractureModel: 'closed-irregular-ring-stack-with-two-load-bearing-bedding-ledges',
    materialColor: 0x5a5044,
    flatShading: false,
    bumpScale: 0.029,
  }),
  'angular-talus': Object.freeze({
    seed: 73,
    profile: 'joint-bounded-angular-talus-block',
    fractureModel: 'three-broad-joint-planes-with-sharp-spall-faces',
    materialColor: 0x57483d,
    flatShading: true,
    bumpScale: 0.034,
  }),
});

function createBeddedSlabGeometry() {
  // A bedded slab is a stack of joint-bounded plates, not a vertically squashed
  // sphere. Repeating the same irregular perimeter through paired equal-height
  // rings creates two real bedding ledges while preserving one closed mass and
  // a broad coplanar support polygon.
  const perimeter = [
    [-1.04, -0.34],
    [-0.66, -0.7],
    [0.14, -0.78],
    [0.82, -0.55],
    [1.0, -0.02],
    [0.74, 0.62],
    [0.12, 0.78],
    [-0.7, 0.63],
    [-1.02, 0.23],
  ];
  const rings = [
    {
      y: 0, sx: 0.86, sz: 0.83, ox: 0.03, oz: -0.01,
      edge: [0, -0.025, 0.025, -0.015, 0.02, -0.02, 0.015, -0.01, 0.025],
    },
    {
      y: 0.14, sx: 1, sz: 1, ox: 0, oz: 0,
      edge: [0.02, -0.015, 0.03, -0.025, 0.01, -0.035, 0.02, -0.02, 0.025],
    },
    {
      y: 0.14, sx: 0.94, sz: 0.93, ox: -0.025, oz: 0.012,
      edge: [-0.01, -0.07, 0.015, -0.09, -0.035, 0.005, -0.075, -0.02, -0.1],
    },
    {
      y: 0.34, sx: 0.9, sz: 0.88, ox: -0.05, oz: 0.018,
      edge: [0.015, -0.035, 0.025, -0.06, -0.015, 0.02, -0.045, 0.005, -0.07],
    },
    {
      y: 0.34, sx: 0.94, sz: 0.92, ox: -0.065, oz: 0.024,
      edge: [0.055, -0.01, 0.075, 0, -0.025, 0.065, -0.005, 0.085, 0.015],
    },
    {
      y: 0.52, sx: 0.8, sz: 0.77, ox: -0.13, oz: 0.012,
      edge: [0.04, -0.035, 0.06, -0.045, 0.005, 0.035, -0.055, 0.02, -0.06],
    },
    {
      y: 0.57, sx: 0.74, sz: 0.7, ox: -0.18, oz: 0,
      edge: [0.03, -0.06, 0.055, -0.035, -0.015, 0.045, -0.07, 0.025, -0.05],
    },
  ];
  const crownOffsets = [0.005, 0.035, 0.012, -0.022, -0.03, 0.004, 0.045, 0.026, -0.015];
  const positions = [];
  const uvs = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (const [pointIndex, [x, z]] of perimeter.entries()) {
      const crownOffset = ringIndex === rings.length - 1 ? crownOffsets[pointIndex] : 0;
      const edgeScale = 1 + ring.edge[pointIndex];
      const px = x * ring.sx * edgeScale + ring.ox;
      const py = ring.y + crownOffset + (ringIndex === 0 ? 0 : x * 0.018 + z * 0.012);
      const pz = z * ring.sz * edgeScale + ring.oz;
      positions.push(px, py, pz);
      uvs.push(px * 0.42 + 0.5, pz * 0.42 + 0.5);
    }
  }
  const ringSize = perimeter.length;
  const bottomCentre = positions.length / 3;
  positions.push(0.02, 0, 0);
  uvs.push(0.5, 0.5);
  const topCentre = positions.length / 3;
  positions.push(-0.18, 0.58, 0);
  uvs.push(0.43, 0.5);
  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let pointIndex = 0; pointIndex < ringSize; pointIndex += 1) {
      const next = (pointIndex + 1) % ringSize;
      const lower = ringIndex * ringSize + pointIndex;
      const lowerNext = ringIndex * ringSize + next;
      const upper = (ringIndex + 1) * ringSize + pointIndex;
      const upperNext = (ringIndex + 1) * ringSize + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const topOffset = (rings.length - 1) * ringSize;
  for (let pointIndex = 0; pointIndex < ringSize; pointIndex += 1) {
    const next = (pointIndex + 1) % ringSize;
    indices.push(bottomCentre, pointIndex, next);
    indices.push(topOffset + pointIndex, topCentre, topOffset + next);
  }
  const indexedGeometry = new THREE.BufferGeometry();
  indexedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexedGeometry.setIndex(indices);
  const geometry = toCreasedNormals(indexedGeometry, THREE.MathUtils.degToRad(31));
  indexedGeometry.dispose();
  return geometry;
}

function createFluvialCobbleGeometry() {
  // A transported cobble needs one load-bearing footprint and one continuous
  // rounded shell. Clamping a sphere's lower latitude rings onto the same
  // plane leaves overlapping coplanar faces, which render as a false black
  // seam at the bank contact. This ring stack keeps every side course at a
  // unique elevation and closes the support plane with one downward cap.
  const radialSegments = 14;
  const rings = [
    { y: 0, radiusX: 1.005, radiusZ: 0.82, offsetX: 0.015, offsetZ: -0.01 },
    { y: 0.085, radiusX: 0.98, radiusZ: 0.78, offsetX: 0.025, offsetZ: -0.008 },
    { y: 0.32, radiusX: 0.94, radiusZ: 0.76, offsetX: 0.018, offsetZ: 0.006 },
    { y: 0.56, radiusX: 0.78, radiusZ: 0.64, offsetX: -0.015, offsetZ: 0.012 },
    { y: 0.755, radiusX: 0.42, radiusZ: 0.36, offsetX: -0.035, offsetZ: 0.005 },
  ];
  const positions = [];
  const uvs = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      const broadFaceVariation = 1
        + Math.sin(angle * 3 + ringIndex * 0.71) * 0.018
        + Math.sin(angle * 5 - ringIndex * 0.43) * 0.009;
      const x = ring.offsetX + Math.cos(angle) * ring.radiusX * broadFaceVariation;
      const z = ring.offsetZ + Math.sin(angle) * ring.radiusZ * broadFaceVariation;
      positions.push(x, ring.y, z);
      uvs.push(side / radialSegments, ring.y / 0.84);
    }
  }
  const bottomCapOffset = positions.length / 3;
  for (let side = 0; side < radialSegments; side += 1) {
    const source = side * 3;
    positions.push(positions[source], positions[source + 1], positions[source + 2]);
    uvs.push(
      positions[source] * 0.48 + 0.5,
      positions[source + 2] * 0.48 + 0.5,
    );
  }
  const bottomCentre = positions.length / 3;
  positions.push(0.015, 0, -0.01);
  uvs.push(0.5, 0.5);
  const topCentre = positions.length / 3;
  positions.push(-0.055, 0.84, 0);
  uvs.push(0.5, 1);

  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lowerOffset = ringIndex * radialSegments;
    const upperOffset = (ringIndex + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      indices.push(
        lowerOffset + side,
        upperOffset + side,
        lowerOffset + next,
        upperOffset + side,
        upperOffset + next,
        lowerOffset + next,
      );
    }
  }
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, bottomCapOffset + side, bottomCapOffset + next);
    indices.push(topOffset + side, topCentre, topOffset + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function createNonColumnarRockGeometry(family) {
  const profile = NON_COLUMNAR_ROCK_PROFILES[family];
  const geometry = family === 'fluvial-cobble'
    ? createFluvialCobbleGeometry()
    : family === 'bedded-slab'
      ? createBeddedSlabGeometry()
      : new THREE.SphereGeometry(1, 8, 6);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const point = new THREE.Vector3();
  const talusPlanes = [
    [new THREE.Vector3(0.88, 0.08, 0.47).normalize(), 0.73],
    [new THREE.Vector3(-0.64, 0.22, 0.74).normalize(), 0.76],
    [new THREE.Vector3(0.12, 0.66, -0.74).normalize(), 0.74],
  ];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    let nextX;
    let nextY;
    let nextZ;
    if (family === 'fluvial-cobble') {
      const abrasion = 1
        + Math.sin(x * 4.1 - z * 3.3 + profile.seed) * 0.035
        + Math.sin(y * 5.7 + x * 2.2) * 0.022;
      nextX = x * abrasion * (1.04 + y * 0.045) + Math.sin(y * 3.7) * 0.045;
      nextZ = z * abrasion * 0.82 + Math.cos(y * 4.2 + 0.7) * 0.045;
      const heightFraction = y / 0.84;
      const crownCamber = Math.sin(Math.PI * heightFraction);
      nextY = y <= 0.0001
        ? 0
        : y + crownCamber * (
          x * 0.036
          - z * 0.022
          + Math.sin(x * 3.2 - z * 2.4) * 0.017
        );
      nextX *= 1.00755;
    } else if (family === 'bedded-slab') {
      nextX = x;
      nextY = y;
      nextZ = z;
    } else {
      const facetBreak = 1
        + Math.sin(x * 4.7 - z * 5.1 + profile.seed) * 0.055
        + Math.sin(y * 5.9 + z * 2.4) * 0.035;
      point.set(x * facetBreak * 0.93, y * 0.52, z * facetBreak * 0.86);
      for (const [normal, limit] of talusPlanes) {
        const distance = point.dot(normal);
        if (distance > limit) point.addScaledVector(normal, -(distance - limit) * 0.86);
      }
      nextX = point.x;
      nextY = Math.max(-0.38, point.y) + 0.38;
      nextZ = point.z;
    }
    positions.setXYZ(index, nextX, nextY, nextZ);
    const heightFraction = family === 'fluvial-cobble'
      ? nextY / 0.84
      : family === 'bedded-slab' ? nextY / 0.8 : nextY / 1.02;
    const beddingShade = family === 'bedded-slab'
      ? Math.sin(nextY * 22.5) * 0.045
      : 0;
    const facetShade = family === 'angular-talus'
      ? Math.sin(nextX * 3.8 - nextZ * 4.4) * 0.06
      : Math.sin(nextX * 2.6 + nextZ * 3.1) * 0.025;
    const shade = THREE.MathUtils.clamp(
      0.83 + heightFraction * 0.12 + beddingShade + facetShade,
      0.68,
      1.02,
    );
    colors.push(shade * 0.98, shade, shade * 0.95);
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (family !== 'bedded-slab') geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = profile.profile;
  geometry.userData.family = family;
  geometry.userData.supportVertexCount = Array.from(
    { length: positions.count },
    (_, index) => positions.getY(index),
  ).filter((height) => height <= 0.0001).length;
  return geometry;
}

export {
  NON_COLUMNAR_ROCK_PROFILES,
  createFracturedBasaltGeometry,
  createNonColumnarRockGeometry,
  createWeatheredRockGeometry,
};
