import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { triangleCount, writeBinaryGlb } from './gltf-export.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(APP, 'public/assets/ground-cover-library-original-v3.glb');
const SUPPORT_PLANE_Y = -0.08;
const PETIOLE_PROFILE = Object.freeze({
  radialSegments: 6,
  arrowheadBaseRadius: 0.011,
  arrowheadTipRadius: 0.0048,
  rosetteBaseRadius: 0.0095,
  rosetteTipRadius: 0.0042,
  sedgeBaseRadius: 0.008,
  sedgeTipRadius: 0.0035,
});

function createRootCrown({ radius, hue }) {
  const sides = 14;
  const rings = [
    // The load-bearing rhizome belongs below the soil surface. V1 expanded to
    // a wide crown above its support plane and read as a repeated ten-sided
    // flower pot. V2 keeps a closed mass and broad support, but tapers before
    // grade so only attached petiole/sheath bases emerge from the soil.
    { y: SUPPORT_PLANE_Y, radius: radius * 0.46 },
    { y: -0.062, radius: radius * 0.72 },
    { y: -0.043, radius: radius * 0.52 },
    { y: -0.027, radius: radius * 0.2 },
  ];
  const positions = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  const colour = new THREE.Color();
  rings.forEach((ring, ringIndex) => {
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * Math.PI * 2;
      const irregular = 1 + Math.sin(side * 2.31 + ringIndex) * 0.045;
      positions.push(
        Math.cos(angle) * ring.radius * irregular,
        ring.y,
        Math.sin(angle) * ring.radius * irregular,
      );
      uvs.push(side / sides, ringIndex / (rings.length - 1) * 0.12);
      flexUvs.push(-1, 0);
      colour.setHSL(hue, 0.18, 0.055 + ringIndex * 0.009);
      colors.push(colour.r, colour.g, colour.b);
    }
  });
  const bottomCentre = positions.length / 3;
  positions.push(0, SUPPORT_PLANE_Y, 0);
  uvs.push(0.5, 0);
  flexUvs.push(-1, 0);
  colors.push(0.07, 0.055, 0.032);
  const topCentre = positions.length / 3;
  positions.push(0, -0.022, 0);
  uvs.push(0.5, 0.1);
  flexUvs.push(-1, 0);
  colors.push(0.055, 0.048, 0.031);
  const indices = [];
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const lower = ring * sides + side;
      const lowerNext = ring * sides + next;
      const upper = (ring + 1) * sides + side;
      const upperNext = (ring + 1) * sides + next;
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
    profile: 'closed-subgrade-tapered-ground-cover-rhizome-crown',
    supportPlaneY: SUPPORT_PLANE_Y,
    supportVertexCount: sides + 1,
    supportModel: 'broad-coplanar-subgrade-rhizome-under-projected-leaf-mass',
  };
  return geometry;
}

function createTube(points, {
  baseRadius,
  tipRadius,
  startFlex,
  endFlex,
  leafPhase,
  hue,
  phase,
}) {
  const radialSegments = PETIOLE_PROFILE.radialSegments;
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
  points.forEach((point, pointIndex) => {
    const t = pointIndex / (points.length - 1);
    const previous = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    direction.subVectors(next, previous).normalize();
    lateral.crossVectors(direction, up);
    if (lateral.lengthSq() < 0.001) lateral.set(1, 0, 0);
    lateral.normalize();
    binormal.crossVectors(lateral, direction).normalize();
    const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, t ** 0.72);
    const flex = THREE.MathUtils.lerp(startFlex, endFlex, t);
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = side / radialSegments * Math.PI * 2 + phase * 0.09;
      const vertex = point.clone()
        .addScaledVector(lateral, Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(...vertex);
      uvs.push(side / radialSegments, t);
      flexUvs.push(leafPhase, flex);
      colour.setHSL(hue + t * 0.018, 0.38 + t * 0.06, 0.17 + t * 0.09);
      colors.push(colour.r, colour.g, colour.b);
    }
  });
  for (let ring = 0; ring < points.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const lower = ring * radialSegments + side;
      const lowerNext = ring * radialSegments + next;
      const upper = (ring + 1) * radialSegments + side;
      const upperNext = (ring + 1) * radialSegments + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const baseCentre = positions.length / 3;
  positions.push(...points[0]);
  uvs.push(0.5, 0);
  flexUvs.push(leafPhase, startFlex);
  colors.push(...colors.slice(0, 3));
  const tipCentre = positions.length / 3;
  positions.push(...points.at(-1));
  uvs.push(0.5, 1);
  flexUvs.push(leafPhase, endFlex);
  colors.push(...colors.slice(-3));
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(baseCentre, next, side);
    const tip = (points.length - 1) * radialSegments;
    indices.push(tip + side, tip + next, tipCentre);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = {
    profile: 'closed-tapered-ground-cover-petiole',
    supportModel: 'petiole-base-overlaps-buried-root-crown',
    radialSegments,
    leafPhase,
  };
  return geometry;
}

function createSurfaceBuffer() {
  return { positions: [], uvs: [], flexUvs: [], colors: [], indices: [] };
}

function pushTriangle(buffer, vertices) {
  const first = buffer.positions.length / 3;
  vertices.forEach(({ point, uv, flex, hue, shade }) => {
    buffer.positions.push(...point);
    buffer.uvs.push(...uv);
    buffer.flexUvs.push(0, flex);
    const colour = new THREE.Color().setHSL(hue, 0.48, shade);
    buffer.colors.push(colour.r, colour.g, colour.b);
  });
  buffer.indices.push(first, first + 1, first + 2);
}

function vertex(point, uv, flex, hue, shade) {
  return { point, uv, flex, hue, shade };
}

function pushArrowheadLeaf(buffer, {
  root,
  direction,
  tangent,
  length,
  width,
  flex,
  hue,
  shade,
  leafPhase,
}) {
  pushCurvedLeaf(buffer, {
    root, direction, tangent, length, width, flex, hue, shade, leafPhase,
    widthProfile: (t) => Math.pow(Math.sin(Math.PI * t), 0.62)
      * (1 + Math.exp(-((t - 0.28) ** 2) / 0.018) * 0.12),
    arch: length * 0.085,
    droop: length * 0.09,
    camber: width * 0.14,
  });
}

function pushEllipticLeaf(buffer, {
  root,
  direction,
  tangent,
  length,
  width,
  flex,
  hue,
  shade,
  leafPhase,
}) {
  pushCurvedLeaf(buffer, {
    root, direction, tangent, length, width, flex, hue, shade, leafPhase,
    widthProfile: (t) => Math.pow(Math.sin(Math.PI * t), 0.78),
    arch: length * 0.07,
    droop: length * 0.065,
    camber: width * 0.12,
  });
}

// A leaf is a thin, continuously curved membrane, not a handful of independent
// triangular plates. Sharing vertices across nine longitudinal spans gives the
// blade a rounded silhouette and continuous normals while the centre ridge
// supplies a small amount of physically plausible camber.
function pushCurvedLeaf(buffer, {
  root,
  direction,
  tangent,
  length,
  width,
  flex,
  hue,
  shade,
  widthProfile,
  arch,
  droop,
  camber,
  leafPhase,
}) {
  const segments = 9;
  const first = buffer.positions.length / 3;
  for (let segment = 0; segment <= segments; segment += 1) {
    const t = segment / segments;
    const profile = Math.max(0.012, widthProfile(t));
    const centre = root.clone().addScaledVector(direction, length * t);
    centre.addScaledVector(tangent, Math.sin(t * Math.PI) * Math.sin(length * 17) * 0.012);
    centre.y += Math.sin(t * Math.PI) * arch - t * t * droop;
    const localFlex = THREE.MathUtils.lerp(flex, 1, t ** 0.82);
    for (const [side, u] of [[1, 0], [0, 0.5], [-1, 1]]) {
      const edgeAsymmetry = side === 0 ? 1 : 1 + side * Math.sin(t * 11.3 + length * 9) * 0.025;
      const point = centre.clone().addScaledVector(
        tangent,
        side * width * profile * edgeAsymmetry,
      );
      if (side === 0) point.y += camber * profile;
      const colour = new THREE.Color().setHSL(
        hue + side * 0.002,
        0.48,
        shade + (side === 0 ? 0.042 : 0) + t * 0.012,
      );
      buffer.positions.push(...point);
      buffer.uvs.push(u, t);
      buffer.flexUvs.push(leafPhase, localFlex);
      buffer.colors.push(colour.r, colour.g, colour.b);
    }
  }
  for (let segment = 0; segment < segments; segment += 1) {
    const lower = first + segment * 3;
    const upper = lower + 3;
    buffer.indices.push(
      lower, upper, lower + 1,
      lower + 1, upper, upper + 1,
      lower + 1, upper + 1, lower + 2,
      lower + 2, upper + 1, upper + 2,
    );
  }
}

function pushSedgeBlade(buffer, {
  centres,
  tangent,
  baseWidth,
  hue,
  shade,
  leafPhase,
}) {
  const first = buffer.positions.length / 3;
  centres.forEach((centre, index) => {
    const t = index / (centres.length - 1);
    const width = THREE.MathUtils.lerp(baseWidth, 0.005, t ** 0.7);
    const profile = Math.sin(t * Math.PI);
    for (const [side, u] of [[1, 0], [0, 0.5], [-1, 1]]) {
      const point = centre.clone().addScaledVector(tangent, side * width);
      if (side === 0) point.y += baseWidth * 0.22 * profile;
      const colour = new THREE.Color().setHSL(
        hue + side * 0.0015,
        0.38,
        shade + t * 0.045 + (side === 0 ? 0.018 : 0),
      );
      buffer.positions.push(...point);
      buffer.uvs.push(u, t);
      buffer.flexUvs.push(leafPhase, t);
      buffer.colors.push(colour.r, colour.g, colour.b);
    }
  });
  for (let segment = 0; segment < centres.length - 1; segment += 1) {
    const lower = first + segment * 3;
    const upper = lower + 3;
    buffer.indices.push(
      lower, upper, lower + 1,
      lower + 1, upper, upper + 1,
      lower + 1, upper + 1, lower + 2,
      lower + 2, upper + 1, upper + 2,
    );
  }
}

function surfaceGeometry(buffer, spec) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffer.uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(buffer.flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffer.colors, 3));
  geometry.setIndex(buffer.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    profile: `attached-ground-cover-leaves-${spec.id}`,
    supportModel: 'each-cambered-leaf-root-overlaps-a-closed-petiole-or-sheath',
    flexProfile: 'uv1-y-root-constrained-to-tip-flexible-independent-of-texture-uv',
    leafCount: spec.leafCount,
  };
  return geometry;
}

const VARIANTS = Object.freeze([
  Object.freeze({
    id: 'brook-arrowhead-colony',
    type: 'arrowhead',
    leafCount: 9,
    rootRadius: 0.13,
    hue: 0.335,
  }),
  Object.freeze({
    id: 'shade-elliptic-rosette',
    type: 'elliptic',
    leafCount: 10,
    rootRadius: 0.12,
    hue: 0.305,
  }),
  Object.freeze({
    id: 'slope-sedge-fan',
    type: 'sedge',
    leafCount: 18,
    rootRadius: 0.105,
    hue: 0.285,
  }),
]);

function buildVariant(spec, variantIndex) {
  const structuralParts = [createRootCrown({ radius: spec.rootRadius, hue: 0.075 })];
  const leaves = createSurfaceBuffer();
  for (let leafIndex = 0; leafIndex < spec.leafCount; leafIndex += 1) {
    const angle = leafIndex / spec.leafCount * Math.PI * 2
      + variantIndex * 0.27
      + Math.sin(leafIndex * 2.13 + variantIndex) * 0.12;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const agePhase = ((leafIndex * 7 + variantIndex * 3) % spec.leafCount)
      / Math.max(1, spec.leafCount - 1);
    const maturity = THREE.MathUtils.lerp(0.58, 1, agePhase);
    const leafPhase = leafIndex / Math.max(1, spec.leafCount - 1);
    if (spec.type === 'arrowhead') {
      const petioleLength = (0.205 + (leafIndex % 3) * 0.026) * maturity;
      const root = new THREE.Vector3().addScaledVector(
        direction,
        spec.rootRadius * THREE.MathUtils.lerp(0.1, 0.24, maturity),
      );
      root.y = -0.019;
      const bend = direction.clone().multiplyScalar(petioleLength * 0.58);
      bend.addScaledVector(tangent, Math.sin(leafIndex * 1.71) * 0.018);
      bend.y = THREE.MathUtils.lerp(0.105, 0.168, maturity) + (leafIndex % 2) * 0.014;
      const tip = direction.clone().multiplyScalar(petioleLength);
      tip.addScaledVector(tangent, Math.sin(leafIndex * 1.7) * 0.028);
      tip.y = THREE.MathUtils.lerp(0.15, 0.225, maturity) + (leafIndex % 3) * 0.012;
      structuralParts.push(createTube([root, bend, tip], {
        baseRadius: PETIOLE_PROFILE.arrowheadBaseRadius,
        tipRadius: PETIOLE_PROFILE.arrowheadTipRadius,
        startFlex: 0,
        endFlex: 0.46,
        leafPhase,
        hue: spec.hue - 0.025,
        phase: leafIndex,
      }));
      const leafDirection = direction.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(leafIndex * 2.31) * 0.11)
        .setY(THREE.MathUtils.lerp(0.46, 0.08, maturity))
        .normalize();
      pushArrowheadLeaf(leaves, {
        root: tip,
        direction: leafDirection,
        tangent,
        length: (0.31 + (leafIndex % 3) * 0.032) * THREE.MathUtils.lerp(0.8, 1, maturity),
        width: (0.104 + (leafIndex % 2) * 0.014) * THREE.MathUtils.lerp(0.82, 1, maturity),
        flex: 0.46,
        hue: spec.hue + Math.sin(leafIndex * 1.8) * 0.008,
        shade: 0.31 + (leafIndex % 3) * 0.018,
        leafPhase,
      });
    } else if (spec.type === 'elliptic') {
      const petioleLength = (0.14 + (leafIndex % 4) * 0.018) * maturity;
      const root = direction.clone().multiplyScalar(
        spec.rootRadius * THREE.MathUtils.lerp(0.08, 0.2, maturity),
      );
      root.y = -0.019;
      const bend = direction.clone().multiplyScalar(petioleLength * 0.62);
      bend.addScaledVector(tangent, Math.sin(leafIndex * 1.93) * 0.015);
      bend.y = THREE.MathUtils.lerp(0.07, 0.112, maturity) + (leafIndex % 3) * 0.009;
      const tip = direction.clone().multiplyScalar(petioleLength);
      tip.addScaledVector(tangent, Math.sin(leafIndex * 1.37) * 0.02);
      tip.y = THREE.MathUtils.lerp(0.1, 0.152, maturity) + (leafIndex % 2) * 0.01;
      structuralParts.push(createTube([root, bend, tip], {
        baseRadius: PETIOLE_PROFILE.rosetteBaseRadius,
        tipRadius: PETIOLE_PROFILE.rosetteTipRadius,
        startFlex: 0,
        endFlex: 0.4,
        leafPhase,
        hue: spec.hue - 0.02,
        phase: leafIndex,
      }));
      const leafDirection = direction.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(leafIndex * 2.07) * 0.14)
        .setY(THREE.MathUtils.lerp(0.52, 0.05, maturity))
        .normalize();
      pushEllipticLeaf(leaves, {
        root: tip,
        direction: leafDirection,
        tangent,
        length: (0.29 + (leafIndex % 3) * 0.035) * THREE.MathUtils.lerp(0.78, 1, maturity),
        width: (0.1 + (leafIndex % 2) * 0.015) * THREE.MathUtils.lerp(0.8, 1, maturity),
        flex: 0.4,
        hue: spec.hue + Math.sin(leafIndex * 2.1) * 0.009,
        shade: 0.3 + (leafIndex % 4) * 0.016,
        leafPhase,
      });
    } else {
      const length = (0.52 + (leafIndex % 5) * 0.045) * THREE.MathUtils.lerp(0.74, 1, maturity);
      const root = direction.clone().multiplyScalar(spec.rootRadius * 0.16);
      root.y = -0.018;
      const sheathTip = direction.clone().multiplyScalar(0.075 + (leafIndex % 3) * 0.01);
      sheathTip.y = 0.09 + (leafIndex % 2) * 0.009;
      structuralParts.push(createTube([root, sheathTip], {
        baseRadius: PETIOLE_PROFILE.sedgeBaseRadius,
        tipRadius: PETIOLE_PROFILE.sedgeTipRadius,
        startFlex: 0,
        endFlex: 0.16,
        leafPhase,
        hue: spec.hue - 0.018,
        phase: leafIndex,
      }));
      const centres = Array.from({ length: 9 }, (_, pointIndex) => {
        const t = pointIndex / 8;
        const centre = sheathTip.clone().addScaledVector(direction, length * t * 0.72);
        centre.addScaledVector(tangent, Math.sin(t * Math.PI) * Math.sin(leafIndex * 1.4) * 0.025);
        centre.y += Math.sin(t * Math.PI) * length * 0.72 + t * length * 0.12
          - t * t * length * 0.34;
        return centre;
      });
      pushSedgeBlade(leaves, {
        centres,
        tangent,
        baseWidth: 0.019 + (leafIndex % 3) * 0.003,
        hue: spec.hue + Math.sin(leafIndex * 1.6) * 0.008,
        shade: 0.29 + (leafIndex % 4) * 0.014,
        leafPhase,
      });
    }
  }
  const structure = mergeGeometries(structuralParts, false);
  structuralParts.forEach((geometry) => geometry.dispose());
  structure.computeBoundingBox();
  structure.computeBoundingSphere();
  structure.userData = {
    profile: `closed-root-and-petiole-structure-${spec.id}`,
    topology: 'closed-subgrade-rhizome-plus-overlapping-closed-petioles-or-sheaths',
    supportPlaneY: SUPPORT_PLANE_Y,
    supportVertexCount: 15,
    supportModel: 'subgrade-rhizome-crown-to-overlapping-petiole-to-attached-cambered-leaf',
    centreOfMassProjection: 'inside-root-crown-support-polygon',
    leafCount: spec.leafCount,
    radialSegments: PETIOLE_PROFILE.radialSegments,
    maximumPetioleRadiusMeters: spec.type === 'arrowhead'
      ? PETIOLE_PROFILE.arrowheadBaseRadius
      : spec.type === 'elliptic'
        ? PETIOLE_PROFILE.rosetteBaseRadius
        : PETIOLE_PROFILE.sedgeBaseRadius,
    architectureModel: 'mixed-age-asymmetric-petiole-and-leaf-hierarchy',
    instanceVariationAttribute: 'uv1-x-leaf-phase',
  };
  const leafGeometry = surfaceGeometry(leaves, spec);

  const group = new THREE.Group();
  group.name = `ground-cover-variant-${variantIndex + 1}-${spec.id}`;
  group.userData = {
    variantId: spec.id,
    variantIndex,
    leafCount: spec.leafCount,
    drawCalls: 2,
    supportModel: 'subgrade-rhizome-crown-to-closed-petiole-to-attached-cambered-leaf-surface',
  };
  const structureMesh = new THREE.Mesh(structure, new THREE.MeshStandardMaterial({
    name: `${spec.id}-root-petiole`,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
  }));
  structureMesh.name = 'ground-cover-load-bearing-structure';
  structureMesh.userData.name = structureMesh.name;
  const leafMesh = new THREE.Mesh(leafGeometry, new THREE.MeshStandardMaterial({
    name: `${spec.id}-attached-leaves`,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  }));
  leafMesh.name = 'ground-cover-attached-leaves';
  leafMesh.userData.name = leafMesh.name;
  for (const mesh of [structureMesh, leafMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(structureMesh, leafMesh);
  return group;
}

const root = new THREE.Group();
root.name = 'ground-cover-library-original-v3';
root.userData = {
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  botanicalReference: 'generic-humid-arrowhead-shade-rosette-and-slope-sedge-ground-cover',
  supportModel: 'three-subgrade-rhizome-ground-cover-variants-with-mixed-age-closed-structure-and-attached-cambered-leaves',
  architectureModel: 'mixed-age-asymmetric-petiole-and-leaf-hierarchy-with-instance-phase',
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
    leaves: variant.userData.leafCount,
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
