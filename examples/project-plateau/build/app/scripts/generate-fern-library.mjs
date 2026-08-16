import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { triangleCount, writeBinaryGlb } from './gltf-export.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(APP, 'public/assets/fern-library-original-v1.glb');
const SUPPORT_PLANE_Y = -0.12;

function addAttributeDefaults(geometry, { flex = 0, colour = 0xffffff } = {}) {
  const positions = geometry.getAttribute('position');
  if (!geometry.getAttribute('uv')) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(
      Array.from({ length: positions.count }, () => [0.5, flex]).flat(),
      2,
    ));
  }
  if (!geometry.getAttribute('color')) {
    const base = new THREE.Color(colour);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      Array.from({ length: positions.count }, () => [base.r, base.g, base.b]).flat(),
      3,
    ));
  }
  if (!geometry.getAttribute('uv1')) {
    geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(
      Array.from({ length: positions.count }, () => [0, flex]).flat(),
      2,
    ));
  }
  return geometry;
}

function createClosedRhizome() {
  const sides = 12;
  const rings = [
    { y: SUPPORT_PLANE_Y, radius: 0.15 },
    { y: -0.07, radius: 0.19 },
    { y: 0.005, radius: 0.125 },
    { y: 0.035, radius: 0.065 },
  ];
  const positions = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  const colour = new THREE.Color();
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const radius = ring.radius * (1 + Math.sin(side * 2.3) * 0.035);
      positions.push(Math.cos(angle) * radius, ring.y, Math.sin(angle) * radius * 0.94);
      uvs.push(side / sides, ringIndex / (rings.length - 1) * 0.1);
      flexUvs.push(0, 0);
      colour.setHSL(
        0.07 + ringIndex * 0.01,
        0.26 - ringIndex * 0.02,
        0.075 + ringIndex * 0.013,
      );
      colors.push(colour.r, colour.g, colour.b);
    }
  }
  const bottomCentre = positions.length / 3;
  positions.push(0, SUPPORT_PLANE_Y, 0);
  uvs.push(0.5, 0);
  flexUvs.push(0, 0);
  colors.push(0.08, 0.105, 0.07);
  const topCentre = positions.length / 3;
  positions.push(0, 0.05, 0);
  uvs.push(0.5, 0.14);
  flexUvs.push(0, 0);
  colors.push(0.1, 0.085, 0.052);
  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const lower = ringIndex * sides + side;
      const lowerNext = ringIndex * sides + next;
      const upper = (ringIndex + 1) * sides + side;
      const upperNext = (ringIndex + 1) * sides + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(bottomCentre, next, side);
    const top = (rings.length - 1) * sides;
    indices.push(top + side, top + next, topCentre);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = {
    profile: 'closed-buried-fern-rhizome',
    supportPlaneY: SUPPORT_PLANE_Y,
    supportVertexCount: sides + 1,
    supportModel: 'broad-coplanar-rhizome-base-under-frond-crown',
  };
  return geometry;
}

function frondCentres({ angle, length, rise, droop, segments, phase }) {
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
  return Array.from({ length: segments + 1 }, (_, segment) => {
    const t = segment / segments;
    const radial = length * (t * (0.96 + Math.sin(t * Math.PI) * 0.08));
    const centre = direction.clone().multiplyScalar(radial);
    centre.addScaledVector(tangent, Math.sin(t * Math.PI) * Math.sin(phase) * length * 0.035);
    centre.y = Math.max(0.028, 0.07
      + Math.sin(t * Math.PI) * rise
      + t * 0.12
      - t * t * droop);
    return centre;
  });
}

function createTube(points, { baseRadius, tipRadius, radialSegments = 5, hue, phase }) {
  const positions = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  const indices = [];
  const colour = new THREE.Color();
  const direction = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const t = pointIndex / (points.length - 1);
    const previous = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    direction.subVectors(next, previous).normalize();
    lateral.crossVectors(direction, up);
    if (lateral.lengthSq() < 0.001) lateral.set(1, 0, 0);
    lateral.normalize();
    binormal.crossVectors(lateral, direction).normalize();
    const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, t ** 0.72);
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + phase * 0.07;
      const point = points[pointIndex].clone()
        .addScaledVector(lateral, Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(...point);
      uvs.push(side / radialSegments, t);
      flexUvs.push(0, t);
      colour.setHSL(hue + t * 0.018, 0.34 + t * 0.08, 0.17 + t * 0.08);
      colors.push(colour.r, colour.g, colour.b);
    }
  }
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      const lower = pointIndex * radialSegments + side;
      const lowerNext = pointIndex * radialSegments + nextSide;
      const upper = (pointIndex + 1) * radialSegments + side;
      const upperNext = (pointIndex + 1) * radialSegments + nextSide;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const baseCentre = positions.length / 3;
  positions.push(...points[0]);
  uvs.push(0.5, 0);
  flexUvs.push(0, 0);
  colors.push(colors[0], colors[1], colors[2]);
  const tipCentre = positions.length / 3;
  positions.push(...points.at(-1));
  uvs.push(0.5, 1);
  flexUvs.push(0, 1);
  colors.push(...colors.slice(-3));
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments;
    indices.push(baseCentre, nextSide, side);
    const tip = (points.length - 1) * radialSegments;
    indices.push(tip + side, tip + nextSide, tipCentre);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = {
    profile: 'closed-tapered-frond-rachis',
    supportModel: 'rachis-base-overlaps-buried-rhizome',
  };
  return geometry;
}

function pushLeaflet(vertices, uvs, flexUvs, colors, {
  centre,
  forward,
  tangent,
  side,
  length,
  width,
  flex,
  hue,
  shade,
}) {
  const lateral = tangent.clone().multiplyScalar(side);
  const root = centre.clone().addScaledVector(lateral, 0.018);
  const front = centre.clone()
    .addScaledVector(lateral, length * 0.48)
    .addScaledVector(forward, width * 0.56);
  front.y += length * 0.045;
  const ridge = centre.clone()
    .addScaledVector(lateral, length * 0.52);
  ridge.y += length * 0.085;
  const tip = centre.clone()
    .addScaledVector(lateral, length)
    .addScaledVector(forward, width * 0.1);
  tip.y -= length * 0.075;
  tip.y = Math.max(0.018, tip.y);
  const rear = centre.clone()
    .addScaledVector(lateral, length * 0.45)
    .addScaledVector(forward, -width * 0.56);
  rear.y += length * 0.035;
  rear.y = Math.max(0.022, rear.y);
  const points = [
    root, front, ridge,
    front, tip, ridge,
    root, ridge, rear,
    ridge, tip, rear,
  ];
  const textureUvs = [
    [0.5, 0], [1, 0.46], [0.5, 0.53],
    [1, 0.46], [0.5, 1], [0.5, 0.53],
    [0.5, 0], [0.5, 0.53], [0, 0.44],
    [0.5, 0.53], [0.5, 1], [0, 0.44],
  ];
  const colour = new THREE.Color();
  points.forEach((point, index) => {
    vertices.push(...point);
    uvs.push(textureUvs[index][0], textureUvs[index][1]);
    flexUvs.push(0, flex);
    const ridgeVertex = textureUvs[index][0] === 0.5
      && textureUvs[index][1] > 0.5
      && textureUvs[index][1] < 0.6;
    colour.setHSL(hue, 0.5, shade + (ridgeVertex ? 0.045 : 0));
    colors.push(colour.r, colour.g, colour.b);
  });
}

function createLeaflets(spec, variantIndex) {
  const vertices = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  for (let frondIndex = 0; frondIndex < spec.frondCount; frondIndex += 1) {
    const angle = (frondIndex / spec.frondCount) * Math.PI * 2
      + spec.angleOffset
      + Math.sin(frondIndex * 2.17 + variantIndex) * 0.11;
    const length = spec.length * (0.88 + (frondIndex % 4) * 0.055);
    const centres = frondCentres({
      angle,
      length,
      rise: spec.rise * (0.9 + (frondIndex % 3) * 0.06),
      droop: spec.droop * (0.9 + (frondIndex % 5) * 0.035),
      segments: spec.segments,
      phase: variantIndex * 2.7 + frondIndex,
    });
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    for (let segment = 1; segment < spec.segments; segment += 1) {
      const t = segment / spec.segments;
      const leafletLength = spec.leafletLength
        * Math.sin(t * Math.PI) ** 0.55
        * (1 - t * 0.34)
        * (0.92 + Math.sin(segment * 2.4 + frondIndex) * 0.06);
      const leafletWidth = leafletLength * (0.48 + t * 0.04);
      for (const side of [-1, 1]) {
        pushLeaflet(vertices, uvs, flexUvs, colors, {
          centre: centres[segment],
          forward: direction,
          tangent,
          side,
          length: leafletLength,
          width: leafletWidth,
          flex: t,
          hue: spec.hue + Math.sin(frondIndex * 1.9 + segment) * 0.008,
          shade: 0.325 + t * 0.065 + (segment % 2) * 0.012,
        });
      }
    }
    const tipCentre = centres.at(-1);
    pushLeaflet(vertices, uvs, flexUvs, colors, {
      centre: tipCentre,
      forward: direction,
      tangent,
      side: 1,
      length: spec.leafletLength * 0.62,
      width: spec.leafletLength * 0.13,
      flex: 1,
      hue: spec.hue,
      shade: 0.37,
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    profile: `attached-pinnate-leaflets-${spec.id}`,
    supportModel: 'each-leaflet-root-overlaps-load-bearing-rachis',
    flexProfile: 'uv1-y-base-constrained-to-tip-flexible-independent-of-texture-uv',
    frondCount: spec.frondCount,
    leafletPairsPerFrond: spec.segments - 1,
  };
  return geometry;
}

const VARIANTS = Object.freeze([
  Object.freeze({
    id: 'brook-arch-fern', frondCount: 9, segments: 12, length: 1.58,
    rise: 0.64, droop: 0.43, leafletLength: 0.46, angleOffset: 0.12, hue: 0.32,
  }),
  Object.freeze({
    id: 'upland-feather-fern', frondCount: 8, segments: 14, length: 1.46,
    rise: 0.86, droop: 0.24, leafletLength: 0.4, angleOffset: 0.37, hue: 0.305,
  }),
  Object.freeze({
    id: 'low-cycad-fern', frondCount: 11, segments: 11, length: 1.26,
    rise: 0.42, droop: 0.31, leafletLength: 0.38, angleOffset: -0.16, hue: 0.285,
  }),
]);

function buildVariant(spec, variantIndex) {
  const structuralParts = [addAttributeDefaults(createClosedRhizome())];
  for (let frondIndex = 0; frondIndex < spec.frondCount; frondIndex += 1) {
    const angle = (frondIndex / spec.frondCount) * Math.PI * 2
      + spec.angleOffset
      + Math.sin(frondIndex * 2.17 + variantIndex) * 0.11;
    const length = spec.length * (0.88 + (frondIndex % 4) * 0.055);
    const centres = frondCentres({
      angle,
      length,
      rise: spec.rise * (0.9 + (frondIndex % 3) * 0.06),
      droop: spec.droop * (0.9 + (frondIndex % 5) * 0.035),
      segments: spec.segments,
      phase: variantIndex * 2.7 + frondIndex,
    });
    structuralParts.push(createTube(centres, {
      baseRadius: 0.026,
      tipRadius: 0.0055,
      radialSegments: 5,
      hue: spec.hue - 0.035,
      phase: frondIndex,
    }));
  }
  const structure = mergeGeometries(structuralParts, false);
  structuralParts.forEach((geometry) => geometry.dispose());
  structure.computeBoundingBox();
  structure.computeBoundingSphere();
  structure.userData = {
    profile: `closed-rhizome-and-rachis-${spec.id}`,
    topology: 'closed-rhizome-plus-overlapping-closed-petioles',
    supportPlaneY: SUPPORT_PLANE_Y,
    supportVertexCount: 13,
    supportModel: 'buried-rhizome-to-overlapping-petioles-to-attached-leaflets',
    centreOfMassProjection: 'inside-rhizome-support-polygon',
    frondCount: spec.frondCount,
  };
  const leaflets = createLeaflets(spec, variantIndex);

  const group = new THREE.Group();
  group.name = `fern-variant-${variantIndex + 1}-${spec.id}`;
  group.userData = {
    variantId: spec.id,
    variantIndex,
    frondCount: spec.frondCount,
    leafletPairsPerFrond: spec.segments - 1,
    drawCalls: 2,
    supportModel: 'buried-rhizome-to-closed-rachis-to-attached-pinnate-leaflets',
  };
  const structureMesh = new THREE.Mesh(structure, new THREE.MeshStandardMaterial({
    name: `${spec.id}-rhizome-rachis`,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
  }));
  structureMesh.name = 'fern-load-bearing-structure';
  structureMesh.userData.name = structureMesh.name;
  const leafMesh = new THREE.Mesh(leaflets, new THREE.MeshStandardMaterial({
    name: `${spec.id}-attached-leaflets`,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  }));
  leafMesh.name = 'fern-attached-leaflets';
  leafMesh.userData.name = leafMesh.name;
  for (const mesh of [structureMesh, leafMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(structureMesh, leafMesh);
  return group;
}

const root = new THREE.Group();
root.name = 'fern-library-original-v1';
root.userData = {
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  botanicalReference: 'generic-humid-pinnate-ground-ferns-and-stiff-cycad-like-rosettes',
  supportModel: 'three-rooted-fern-variants-with-closed-structure-and-attached-leaflets',
  variantCount: VARIANTS.length,
  drawCallsPerVariant: 2,
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
    fronds: variant.userData.frondCount,
    leafletPairsPerFrond: variant.userData.leafletPairsPerFrond,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  };
});
console.log(JSON.stringify({
  output: OUTPUT,
  bytes: result.byteLength,
  variants: variantMetrics,
  totalTriangles: variantMetrics.reduce((sum, variant) => sum + variant.triangles, 0),
  supportPlaneY: SUPPORT_PLANE_Y,
}, null, 2));
