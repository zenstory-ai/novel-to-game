import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { triangleCount, writeBinaryGlb } from './gltf-export.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(APP, 'public/assets/basalt-shelf-original-v2.glb');
const OUTLINE = Object.freeze([
  [-0.98, -0.46], [-0.62, -0.92], [-0.08, -1], [0.55, -0.9], [1, -0.5],
  [0.93, 0.08], [0.72, 0.72], [0.2, 0.96], [-0.43, 0.89], [-0.91, 0.48],
]);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function closedLoft(rings, phase = 0) {
  const vertices = [];
  const indices = [];
  const count = OUTLINE.length;
  rings.forEach((ring, ringIndex) => {
    OUTLINE.forEach(([outlineX, outlineZ], side) => {
      const wave = 1
        + Math.sin(side * 2.17 + ringIndex * 1.31 + phase) * (ring.jagged ?? 0.04)
        + Math.sin(side * 4.11 - ringIndex * 0.73 + phase * 0.7) * 0.018;
      const twist = ring.twist ?? 0;
      const x = outlineX * ring.scaleX * wave;
      const z = outlineZ * ring.scaleZ * wave;
      vertices.push(
        ring.x + x * Math.cos(twist) - z * Math.sin(twist),
        ring.y,
        ring.z + x * Math.sin(twist) + z * Math.cos(twist),
      );
    });
  });
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < count; side += 1) {
      const next = (side + 1) % count;
      const a = ring * count + side;
      const b = ring * count + next;
      const c = (ring + 1) * count + side;
      const d = (ring + 1) * count + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottom = vertices.length / 3;
  vertices.push(rings[0].x, rings[0].y, rings[0].z);
  const topRing = rings.at(-1);
  const top = vertices.length / 3;
  vertices.push(topRing.x, topRing.y, topRing.z);
  const topOffset = (rings.length - 1) * count;
  for (let side = 0; side < count; side += 1) {
    const next = (side + 1) % count;
    indices.push(bottom, next, side, top, topOffset + side, topOffset + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry;
}

function slab({ x, y, z, scaleX, scaleZ, thickness, twist = 0, phase = 0 }) {
  return closedLoft([
    {
      x, y: y - thickness * 0.54, z,
      scaleX: scaleX * 0.94, scaleZ: scaleZ * 0.93, twist,
    },
    { x, y: y + thickness * 0.46, z, scaleX, scaleZ, twist: twist + 0.015 },
  ], phase);
}

function spall({ x, y, z, sx, sy, sz, phase }, random) {
  return closedLoft([
    { x, y, z, scaleX: sx, scaleZ: sz, jagged: 0.09, twist: phase * 0.08 },
    {
      x: x + (random() - 0.5) * 0.12,
      y: y + sy,
      z: z + (random() - 0.5) * 0.1,
      scaleX: sx * (0.76 + random() * 0.12),
      scaleZ: sz * (0.74 + random() * 0.14),
      jagged: 0.1,
      twist: phase * 0.08 + (random() - 0.5) * 0.16,
    },
  ], phase);
}

function mergeBare(parts) {
  const expanded = parts.map((geometry) => {
    const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const attribute of Object.keys(source.attributes)) {
      if (attribute !== 'position') source.deleteAttribute(attribute);
    }
    return source;
  });
  const merged = mergeGeometries(expanded, false);
  expanded.forEach((geometry) => geometry.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function addFaceUvsAndColours(geometry, family, colourPhase) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uvs = new Float32Array(positions.count * 2);
  const colors = new Float32Array(positions.count * 3);
  const deep = new THREE.Color(0x342724);
  const red = new THREE.Color(0x875043);
  const oxide = new THREE.Color(0xa06a52);
  const colour = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const nx = Math.abs(normals.getX(index));
    const ny = Math.abs(normals.getY(index));
    const nz = Math.abs(normals.getZ(index));
    if (ny >= nx && ny >= nz) {
      uvs[index * 2] = x * 0.21;
      uvs[index * 2 + 1] = z * 0.21;
    } else if (nx >= nz) {
      uvs[index * 2] = z * 0.21;
      uvs[index * 2 + 1] = y * 0.21;
    } else {
      uvs[index * 2] = x * 0.21;
      uvs[index * 2 + 1] = y * 0.21;
    }
    const verticalFace = 1 - ny;
    const lowerDarkening = THREE.MathUtils.clamp((0.8 - y) / 1.7, 0, 1);
    const mineralBand = Math.sin(
      y * 2.43 + x * 1.17 - z * 0.83 + colourPhase,
    ) * 0.5 + 0.5;
    const oxidation = THREE.MathUtils.clamp(
      0.38 + verticalFace * 0.24 + mineralBand * 0.16 - lowerDarkening * 0.3,
      0.08,
      0.82,
    );
    colour.copy(deep).lerp(red, oxidation);
    if (family === 'spall') colour.lerp(oxide, 0.09 + mineralBand * 0.1);
    colors[index * 3] = colour.r;
    colors[index * 3 + 1] = colour.g;
    colors[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

const VARIANTS = Object.freeze([
  Object.freeze({
    id: 'needle-buttress',
    massifs: Object.freeze([
      Object.freeze([
        { x: 0, y: -0.64, z: 0.05, scaleX: 3.72, scaleZ: 2.38 },
        { x: -0.08, y: 0.12, z: 0, scaleX: 3.84, scaleZ: 2.46, twist: 0.025 },
        { x: -0.18, y: 1.32, z: 0.18, scaleX: 3.25, scaleZ: 2.05, twist: 0.04 },
      ]),
      Object.freeze([
        { x: -0.32, y: 0.56, z: 0.72, scaleX: 2.92, scaleZ: 1.36 },
        { x: -0.22, y: 2.34, z: 0.78, scaleX: 3.02, scaleZ: 1.31, twist: 0.025 },
        { x: -0.48, y: 4.82, z: 0.86, scaleX: 2.68, scaleZ: 1.16, twist: -0.03 },
        { x: -0.17, y: 7.26, z: 0.82, scaleX: 2.42, scaleZ: 1.08, twist: 0.035 },
        { x: -0.55, y: 9.42, z: 0.78, scaleX: 2.02, scaleZ: 0.96, twist: -0.02 },
        { x: -0.42, y: 10.32, z: 0.72, scaleX: 1.72, scaleZ: 0.82, twist: 0.04 },
      ]),
      Object.freeze([
        { x: 2.18, y: 0.42, z: 0.42, scaleX: 1.48, scaleZ: 1.42 },
        { x: 2.12, y: 2.6, z: 0.48, scaleX: 1.42, scaleZ: 1.34, twist: -0.04 },
        { x: 1.84, y: 6.68, z: 0.66, scaleX: 0.96, scaleZ: 0.92, twist: -0.02 },
      ]),
      Object.freeze([
        { x: -1.88, y: 0.2, z: -0.72, scaleX: 1.1, scaleZ: 0.88 },
        { x: -1.78, y: 1.8, z: -0.74, scaleX: 1.03, scaleZ: 0.8, twist: 0.06 },
        { x: -1.72, y: 3.05, z: -0.62, scaleX: 0.82, scaleZ: 0.66, twist: -0.03 },
      ]),
    ]),
    shelves: Object.freeze([
      { x: -0.2, y: 2.55, z: -0.66, scaleX: 3.3, scaleZ: 1.74, thickness: 0.5 },
      { x: -0.62, y: 4.92, z: -0.08, scaleX: 2.55, scaleZ: 1.28, thickness: 0.44 },
      { x: 1.92, y: 5.18, z: -0.02, scaleX: 1.22, scaleZ: 1.18, thickness: 0.38 },
    ]),
    spalls: Object.freeze([
      { x: -2.75, y: 1.24, z: -0.82, sx: 0.58, sy: 0.72, sz: 0.52 },
      { x: 2.92, y: 1.22, z: -0.28, sx: 0.66, sy: 0.64, sz: 0.56 },
      { x: -2.18, y: 2.71, z: -1.28, sx: 0.54, sy: 0.55, sz: 0.48 },
      { x: 0.76, y: 2.7, z: -1.42, sx: 0.7, sy: 0.48, sz: 0.52 },
      { x: -1.68, y: 5.04, z: -0.66, sx: 0.48, sy: 0.44, sz: 0.44 },
      { x: 1.05, y: 5.03, z: -0.48, sx: 0.52, sy: 0.42, sz: 0.4 },
    ]),
  }),
  Object.freeze({
    id: 'split-saddle',
    massifs: Object.freeze([
      Object.freeze([
        { x: 0, y: -0.66, z: 0.05, scaleX: 3.78, scaleZ: 2.42 },
        { x: 0.04, y: 0.18, z: 0.02, scaleX: 3.9, scaleZ: 2.5, twist: -0.02 },
        { x: 0.1, y: 1.18, z: 0.12, scaleX: 3.42, scaleZ: 2.14, twist: 0.035 },
      ]),
      Object.freeze([
        { x: -1.62, y: 0.54, z: 0.54, scaleX: 1.72, scaleZ: 1.42 },
        { x: -1.78, y: 2.8, z: 0.62, scaleX: 1.68, scaleZ: 1.28, twist: -0.08 },
        { x: -1.55, y: 5.5, z: 0.56, scaleX: 1.42, scaleZ: 1.12, twist: 0.04 },
        { x: -1.9, y: 7.85, z: 0.48, scaleX: 1.04, scaleZ: 0.88, twist: -0.05 },
      ]),
      Object.freeze([
        { x: 1.72, y: 0.5, z: 0.46, scaleX: 1.68, scaleZ: 1.5 },
        { x: 1.82, y: 2.5, z: 0.52, scaleX: 1.62, scaleZ: 1.34, twist: 0.07 },
        { x: 1.58, y: 4.8, z: 0.48, scaleX: 1.34, scaleZ: 1.16, twist: -0.04 },
        { x: 1.88, y: 6.72, z: 0.42, scaleX: 0.96, scaleZ: 0.86, twist: 0.07 },
      ]),
      Object.freeze([
        { x: 0.05, y: 0.2, z: -0.92, scaleX: 1.45, scaleZ: 0.82 },
        { x: -0.08, y: 1.5, z: -0.9, scaleX: 1.28, scaleZ: 0.75, twist: 0.06 },
        { x: 0.12, y: 2.75, z: -0.78, scaleX: 0.9, scaleZ: 0.62, twist: -0.04 },
      ]),
    ]),
    shelves: Object.freeze([
      { x: -1.55, y: 3.02, z: -0.42, scaleX: 2.05, scaleZ: 1.25, thickness: 0.46 },
      { x: 1.62, y: 2.6, z: -0.5, scaleX: 1.92, scaleZ: 1.18, thickness: 0.43 },
    ]),
    spalls: Object.freeze([
      { x: -2.8, y: 1.15, z: -0.64, sx: 0.62, sy: 0.62, sz: 0.52 },
      { x: 2.75, y: 1.12, z: -0.4, sx: 0.58, sy: 0.7, sz: 0.5 },
      { x: -1.94, y: 3.17, z: -0.92, sx: 0.52, sy: 0.48, sz: 0.43 },
      { x: 1.46, y: 2.75, z: -0.92, sx: 0.56, sy: 0.45, sz: 0.46 },
      { x: 2.36, y: 2.76, z: -0.58, sx: 0.44, sy: 0.5, sz: 0.4 },
    ]),
  }),
  Object.freeze({
    id: 'terraced-fan',
    massifs: Object.freeze([
      Object.freeze([
        { x: 0, y: -0.65, z: 0.05, scaleX: 3.76, scaleZ: 2.4 },
        { x: -0.02, y: 0.16, z: 0.02, scaleX: 3.88, scaleZ: 2.48, twist: 0.018 },
        { x: -0.12, y: 1.25, z: 0.14, scaleX: 3.38, scaleZ: 2.12, twist: -0.03 },
      ]),
      Object.freeze([
        { x: 0.42, y: 0.48, z: 0.65, scaleX: 2.35, scaleZ: 1.42 },
        { x: 0.18, y: 2.55, z: 0.72, scaleX: 2.28, scaleZ: 1.3, twist: 0.08 },
        { x: 0.62, y: 5.08, z: 0.68, scaleX: 1.92, scaleZ: 1.14, twist: -0.07 },
        { x: 0.16, y: 7.28, z: 0.58, scaleX: 1.5, scaleZ: 0.98, twist: 0.08 },
        { x: 0.52, y: 9.12, z: 0.52, scaleX: 1.08, scaleZ: 0.82, twist: -0.06 },
      ]),
      Object.freeze([
        { x: -2.18, y: 0.36, z: 0.2, scaleX: 1.34, scaleZ: 1.35 },
        { x: -2.12, y: 2.12, z: 0.18, scaleX: 1.3, scaleZ: 1.24, twist: -0.08 },
        { x: -2.3, y: 3.92, z: 0.28, scaleX: 1.04, scaleZ: 0.96, twist: 0.06 },
      ]),
      Object.freeze([
        { x: 2.34, y: 0.3, z: -0.22, scaleX: 1.25, scaleZ: 1.12 },
        { x: 2.4, y: 1.68, z: -0.16, scaleX: 1.15, scaleZ: 1.02, twist: 0.08 },
        { x: 2.18, y: 3.18, z: -0.04, scaleX: 0.9, scaleZ: 0.82, twist: -0.07 },
      ]),
    ]),
    shelves: Object.freeze([
      { x: 0.2, y: 2.72, z: -0.55, scaleX: 2.92, scaleZ: 1.5, thickness: 0.48 },
      { x: 0.42, y: 5.2, z: -0.02, scaleX: 2.1, scaleZ: 1.24, thickness: 0.42 },
      { x: -2.12, y: 2.22, z: -0.35, scaleX: 1.35, scaleZ: 1.05, thickness: 0.4 },
    ]),
    spalls: Object.freeze([
      { x: -2.95, y: 1.12, z: -0.48, sx: 0.62, sy: 0.66, sz: 0.52 },
      { x: 2.92, y: 1.1, z: -0.3, sx: 0.64, sy: 0.62, sz: 0.54 },
      { x: -1.7, y: 2.38, z: -0.78, sx: 0.5, sy: 0.5, sz: 0.45 },
      { x: 0.85, y: 2.9, z: -1.16, sx: 0.62, sy: 0.46, sz: 0.48 },
      { x: -0.72, y: 5.32, z: -0.48, sx: 0.48, sy: 0.43, sz: 0.42 },
      { x: 1.18, y: 5.3, z: -0.34, sx: 0.46, sy: 0.44, sz: 0.4 },
    ]),
  }),
]);

function buildVariant(spec, variantIndex) {
  const random = seededRandom(18_431_217 + variantIndex * 9_973);
  const massifParts = spec.massifs.map((rings, index) => closedLoft(
    rings.map((ring) => ({ ...ring, jagged: ring.jagged ?? 0.05 + index * 0.006 })),
    variantIndex * 4.7 + index * 1.3,
  ));
  spec.shelves.forEach((shelf, index) => massifParts.push(slab({
    ...shelf,
    twist: (index % 2 ? 1 : -1) * (0.025 + variantIndex * 0.012),
    phase: variantIndex * 5 + index + 2.4,
  })));
  const spallParts = spec.spalls.map((support, index) => spall({
    ...support,
    phase: variantIndex * 7 + index + 1,
  }, random));
  const massifGeometry = mergeBare(massifParts);
  const spallGeometry = mergeBare(spallParts);
  addFaceUvsAndColours(massifGeometry, 'massif', variantIndex * 1.7);
  addFaceUvsAndColours(spallGeometry, 'spall', variantIndex * 1.7);
  massifGeometry.userData = {
    profile: `original-volumetric-basalt-${spec.id}`,
    supportModel: 'buried-plinth-to-overlapping-load-bearing-mass-and-short-benches',
    groundPlaneY: 0,
    contactDepthMeters: Math.abs(spec.massifs[0][0].y),
    shelfCount: spec.shelves.length,
    mainVolumeCount: massifParts.length,
    topology: 'closed-overlapping-load-bearing-volumes',
    variantId: spec.id,
  };
  spallGeometry.userData = {
    profile: `supported-basalt-spalls-${spec.id}`,
    supportModel: 'resting-on-bedrock-or-horizontal-mineral-bench',
    fragmentCount: spec.spalls.length,
    topology: 'closed-supported-volumes',
    variantId: spec.id,
  };
  const group = new THREE.Group();
  group.name = `basalt-shelf-variant-${variantIndex + 1}-${spec.id}`;
  group.userData = {
    variantIndex,
    variantId: spec.id,
    shelfCount: spec.shelves.length,
    fragmentCount: spec.spalls.length,
    drawCalls: 2,
    supportModel: 'buried-bedrock-plinth-to-distinct-wall-system-to-supported-spalls',
  };
  const massif = new THREE.Mesh(massifGeometry, new THREE.MeshStandardMaterial({
    name: `basalt-shelf-${spec.id}-massif`,
    color: 0x8c5749,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  }));
  massif.name = 'basalt-shelf-load-bearing-massif';
  const spalls = new THREE.Mesh(spallGeometry, new THREE.MeshStandardMaterial({
    name: `basalt-shelf-${spec.id}-spalls`,
    color: 0x915d4c,
    vertexColors: true,
    roughness: 0.93,
    metalness: 0,
    flatShading: true,
  }));
  spalls.name = 'basalt-shelf-supported-spalls';
  for (const mesh of [massif, spalls]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(massif, spalls);
  return group;
}

const root = new THREE.Group();
root.name = 'basalt-shelf-original-v2-library';
root.userData = {
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  geologicalReference: 'generic-columnar-basalt-fracture-planes-weathering-benches-and-spalls',
  variantCount: VARIANTS.length,
  drawCallsPerVariant: 2,
  supportModel: 'three-distinct-buried-bedrock-to-wall-to-bench-to-spall-load-paths',
};
const variants = VARIANTS.map(buildVariant);
root.add(...variants);

const result = await writeBinaryGlb(root, OUTPUT);

const variantMetrics = variants.map((variant) => {
  const triangles = triangleCount(variant);
  const bounds = new THREE.Box3().setFromObject(variant);
  return {
    id: variant.userData.variantId,
    triangles,
    drawCalls: variant.userData.drawCalls,
    shelves: variant.userData.shelfCount,
    fragments: variant.userData.fragmentCount,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  };
});
console.log(JSON.stringify({
  output: OUTPUT,
  bytes: result.byteLength,
  variants: variantMetrics,
  totalTriangles: variantMetrics.reduce((sum, variant) => sum + variant.triangles, 0),
  supportModel: root.userData.supportModel,
}, null, 2));
