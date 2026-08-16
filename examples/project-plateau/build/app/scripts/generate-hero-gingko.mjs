import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { writeBinaryGlb } from './gltf-export.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(APP, 'public/assets/hero-gingko-original-v2.glb');
const UP = new THREE.Vector3(0, 1, 0);
const SOURCE_AXIS = new THREE.Vector3(1, 0, 0);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const random = seededRandom(19120406);

function trunkCenterAt(y) {
  const t = THREE.MathUtils.clamp((y + 0.24) / 12.04, 0, 1);
  return new THREE.Vector3(
    Math.sin(t * 3.65) * 0.13 + t * 0.12,
    y,
    Math.sin(t * 2.45 + 0.7) * 0.09 - t * 0.075,
  );
}

function trunkRadiusAt(y) {
  const t = THREE.MathUtils.clamp((y + 0.24) / 12.04, 0, 1);
  const taper = THREE.MathUtils.lerp(0.82, 0.065, t ** 0.76);
  const basalFlare = Math.exp(-(((y - 0.12) / 0.62) ** 2)) * 0.22;
  return taper + basalFlare;
}

function framesAlong(points) {
  const frames = [];
  let previousNormal = null;
  points.forEach((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const tangent = after.clone().sub(before).normalize();
    let normal;
    if (previousNormal) {
      normal = previousNormal.clone().addScaledVector(
        tangent,
        -previousNormal.dot(tangent),
      );
      if (normal.lengthSq() < 1e-6) normal = null;
    }
    if (!normal) {
      const reference = Math.abs(tangent.y) > 0.86
        ? new THREE.Vector3(1, 0, 0)
        : UP;
      normal = reference.clone().addScaledVector(tangent, -reference.dot(tangent));
    }
    normal.normalize();
    const binormal = tangent.clone().cross(normal).normalize();
    normal.copy(binormal).cross(tangent).normalize();
    previousNormal = normal.clone();
    frames.push({ point, tangent, normal, binormal });
  });
  return frames;
}

function taperedTube(points, radii, {
  radialSegments = 10,
  phase = 0,
  ripple = 0.018,
  oval = 1,
  capStart = true,
  capEnd = true,
  flexStart = 0,
  flexEnd = 0,
  phaseRank = 0,
} = {}) {
  const frames = framesAlong(points);
  const vertices = [];
  const uvs = [];
  const flexUvs = [];
  const indices = [];
  const circumferenceRepeats = Math.max(1, (Math.PI * 2 * Math.max(...radii)) / 0.65);
  const cumulativeLength = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulativeLength.push(cumulativeLength.at(-1) + points[index].distanceTo(points[index - 1]));
  }
  frames.forEach(({ point, normal, binormal }, ringIndex) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + phase;
      const barkRelief = 1
        + Math.sin(angle * 5 + ringIndex * 0.31 + phase * 3) * ripple
        + Math.sin(angle * 9 - ringIndex * 0.17) * ripple * 0.38;
      const radius = radii[ringIndex] * barkRelief;
      const offset = normal.clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius * oval);
      vertices.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
      uvs.push(
        (side / radialSegments) * circumferenceRepeats + phase / (Math.PI * 2),
        cumulativeLength[ringIndex] / 0.46,
      );
      flexUvs.push(
        phaseRank,
        THREE.MathUtils.lerp(flexStart, flexEnd, ringIndex / (frames.length - 1)),
      );
    }
  });
  for (let ring = 0; ring < frames.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  if (capStart) {
    const centre = vertices.length / 3;
    vertices.push(...points[0].toArray());
    uvs.push(0.5, 0);
    flexUvs.push(phaseRank, flexStart);
    for (let side = 0; side < radialSegments; side += 1) {
      indices.push(centre, (side + 1) % radialSegments, side);
    }
  }
  if (capEnd) {
    const centre = vertices.length / 3;
    vertices.push(...points.at(-1).toArray());
    uvs.push(0.5, cumulativeLength.at(-1) / 0.46);
    flexUvs.push(phaseRank, flexEnd);
    const ring = (frames.length - 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      indices.push(centre, ring + side, ring + ((side + 1) % radialSegments));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function cubicPath(start, end, {
  forward,
  lateral = new THREE.Vector3(),
  firstLift = 0.2,
  secondLift = 0.65,
  segments = 8,
} = {}) {
  const delta = end.clone().sub(start);
  const planarLength = new THREE.Vector2(delta.x, delta.z).length();
  const travel = forward?.clone().normalize()
    ?? new THREE.Vector3(delta.x, 0, delta.z).normalize();
  const control1 = start.clone()
    .addScaledVector(travel, planarLength * 0.28)
    .addScaledVector(UP, delta.y * firstLift)
    .addScaledVector(lateral, 0.25);
  const control2 = start.clone()
    .addScaledVector(travel, planarLength * 0.68)
    .addScaledVector(UP, delta.y * secondLift)
    .addScaledVector(lateral, 0.75);
  const curve = new THREE.CubicBezierCurve3(start, control1, control2, end);
  return curve.getPoints(segments);
}

function pathPoint(path, t) {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (path.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(path.length - 1, low + 1);
  return path[low].clone().lerp(path[high], scaled - low);
}

function pathTangent(path, t) {
  const epsilon = 1 / Math.max(12, path.length * 2);
  return pathPoint(path, Math.min(1, t + epsilon))
    .sub(pathPoint(path, Math.max(0, t - epsilon)))
    .normalize();
}

function tubeRadii(count, start, end, power = 0.82, collar = 1.12) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const radius = THREE.MathUtils.lerp(start, end, t ** power);
    return index === 0 ? radius * collar : radius;
  });
}

function closedFanLeaf(baseFlex = 0.82, phaseRank = 0) {
  const outline = [
    [0, 0],
    [0.24, -0.1],
    [0.55, -0.44],
    [0.84, -0.55],
    [1, -0.35],
    [0.76, 0],
    [1, 0.35],
    [0.84, 0.55],
    [0.55, 0.44],
    [0.24, 0.1],
  ];
  const thickness = 0.014;
  const vertices = [0.5, thickness * 0.72, 0];
  const flexUvs = [phaseRank, THREE.MathUtils.lerp(baseFlex, 1, 0.5)];
  outline.forEach(([x, z]) => vertices.push(x, thickness * 0.5, z));
  outline.forEach(([x]) => flexUvs.push(phaseRank, THREE.MathUtils.lerp(baseFlex, 1, x)));
  const bottomCentre = vertices.length / 3;
  vertices.push(0.5, -thickness * 0.72, 0);
  flexUvs.push(phaseRank, THREE.MathUtils.lerp(baseFlex, 1, 0.5));
  outline.forEach(([x, z]) => vertices.push(x, -thickness * 0.5, z));
  outline.forEach(([x]) => flexUvs.push(phaseRank, THREE.MathUtils.lerp(baseFlex, 1, x)));
  const indices = [];
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    const top = index + 1;
    const topNext = next + 1;
    const bottom = bottomCentre + index + 1;
    const bottomNext = bottomCentre + next + 1;
    indices.push(0, top, topNext);
    indices.push(bottomCentre, bottomNext, bottom);
    indices.push(top, bottom, topNext, topNext, bottom, bottomNext);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function mergePositionParts(parts, { keepUv = false, keepUv1 = false } = {}) {
  const normalized = parts.map((geometry) => {
    const source = geometry.clone();
    geometry.dispose();
    for (const attribute of Object.keys(source.attributes)) {
      if (attribute !== 'position' && !(keepUv && attribute === 'uv')) {
        if (!(keepUv1 && attribute === 'uv1')) source.deleteAttribute(attribute);
      }
    }
    return source;
  });
  const merged = mergeGeometries(normalized, false);
  normalized.forEach((geometry) => geometry.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function addVertexColours(geometry, family) {
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    if (family === 'bark') {
      const furrow = Math.sin(y * 4.8 + x * 9.7 - z * 7.9) * 0.07
        + Math.sin(y * 12.6 - x * 5.1 + z * 3.7) * 0.035;
      const lowerDamp = THREE.MathUtils.clamp(1 - Math.max(y, 0) / 4.5, 0, 1);
      const shade = THREE.MathUtils.clamp(0.77 + furrow - lowerDamp * 0.08, 0.58, 0.9);
      colors.push(shade * 0.68, shade * 0.58, shade * 0.47);
    } else {
      const spatial = Math.sin(x * 5.3 + z * 7.1 + y * 2.9) * 0.04;
      const height = THREE.MathUtils.clamp((y - 6.5) / 6.3, 0, 1);
      const exposure = THREE.MathUtils.clamp((Math.abs(x) + Math.abs(z) - 2.8) / 4.2, 0, 1);
      const shade = THREE.MathUtils.clamp(0.72 + spatial + height * 0.05, 0.62, 0.83);
      colors.push(
        shade * THREE.MathUtils.lerp(0.62, 0.78, exposure),
        shade * THREE.MathUtils.lerp(0.82, 0.88, height),
        shade * THREE.MathUtils.lerp(0.42, 0.34, exposure),
      );
    }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

const barkParts = [];
const rootTips = [];
const branchJunctions = [];
const twigPaths = [];
const leafBearingPaths = [];
const allometricRatios = [];

const trunkPoints = Array.from({ length: 35 }, (_, index) => {
  const t = index / 34;
  return trunkCenterAt(THREE.MathUtils.lerp(-0.24, 11.8, t));
});
const trunkRadii = trunkPoints.map((point) => trunkRadiusAt(point.y));
barkParts.push(taperedTube(trunkPoints, trunkRadii, {
  radialSegments: 24,
  ripple: 0.026,
  oval: 0.91,
  phase: 0.17,
}));

// Broad roots begin inside the basal flare, lose radius continuously and finish
// below the terrain plane. Their shallow middle sections read as buttress flare;
// the load-bearing tips never stand on top of the soil like radial feet.
const rootAngles = [0.06, 0.86, 1.69, 2.61, 3.48, 4.4, 5.31];
rootAngles.forEach((angle, index) => {
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const sideways = new THREE.Vector3(-direction.z, 0, direction.x);
  const length = 1.35 + (index % 3) * 0.16;
  const path = [
    trunkCenterAt(0.24).addScaledVector(direction, 0.2),
    trunkCenterAt(0.14).addScaledVector(direction, 0.58).addScaledVector(sideways, (index % 2 ? 1 : -1) * 0.05),
    trunkCenterAt(-0.01).addScaledVector(direction, length * 0.72),
    trunkCenterAt(-0.2).addScaledVector(direction, length),
  ];
  barkParts.push(taperedTube(path, [0.34, 0.25, 0.115, 0.032], {
    radialSegments: 12,
    phase: angle * 0.73,
    ripple: 0.022,
    oval: 0.76,
  }));
  rootTips.push(path.at(-1));
});

const scaffoldProfiles = [
  { y: 4.75, yaw: -2.72, reach: 4.35, lift: 2.55, radius: 0.26, bend: -0.22 },
  { y: 5.25, yaw: -1.84, reach: 3.75, lift: 2.95, radius: 0.235, bend: 0.18 },
  { y: 5.72, yaw: -0.94, reach: 4.2, lift: 2.7, radius: 0.225, bend: -0.2 },
  { y: 6.16, yaw: -0.08, reach: 4.55, lift: 2.45, radius: 0.205, bend: 0.23 },
  { y: 6.62, yaw: 0.77, reach: 4.0, lift: 2.75, radius: 0.19, bend: -0.19 },
  { y: 7.08, yaw: 1.62, reach: 3.8, lift: 2.82, radius: 0.175, bend: 0.18 },
  { y: 7.54, yaw: 2.44, reach: 3.65, lift: 2.72, radius: 0.16, bend: -0.17 },
  { y: 8.02, yaw: -3.02, reach: 3.25, lift: 2.92, radius: 0.145, bend: 0.15 },
  { y: 8.48, yaw: -1.82, reach: 3.0, lift: 3.05, radius: 0.13, bend: -0.14 },
  { y: 8.88, yaw: 0.88, reach: 2.85, lift: 3.18, radius: 0.12, bend: 0.13 },
];

function addTwig(start, yaw, reach, lift, phase, parentRadius = 0.045) {
  const direction = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const lateral = new THREE.Vector3(-direction.z, 0, direction.x)
    .multiplyScalar((random() - 0.5) * 0.18);
  const end = start.clone()
    .addScaledVector(direction, reach)
    .add(new THREE.Vector3(0, lift, 0))
    .add(lateral);
  const path = cubicPath(start, end, {
    forward: direction,
    lateral,
    firstLift: 0.28,
    secondLift: 0.68,
    segments: 5,
  });
  const startRadius = Math.min(parentRadius * 0.68, 0.038);
  const endRadius = 0.012;
  barkParts.push(taperedTube(path, tubeRadii(path.length, startRadius, endRadius, 0.84, 1.08), {
    radialSegments: 6,
    phase,
    ripple: 0.014,
    flexStart: 0.52,
    flexEnd: 0.82,
    phaseRank: (phase * 0.173) % 1,
  }));
  twigPaths.push(path);
  leafBearingPaths.push({ path, flexStart: 0.52, flexEnd: 0.82 });
  return { path, startRadius, endRadius };
}

scaffoldProfiles.forEach((profile, scaffoldIndex) => {
  const direction = new THREE.Vector3(Math.cos(profile.yaw), 0, Math.sin(profile.yaw));
  const lateralAxis = new THREE.Vector3(-direction.z, 0, direction.x);
  const start = trunkCenterAt(profile.y).addScaledVector(direction, trunkRadiusAt(profile.y) * 0.08);
  const end = start.clone()
    .addScaledVector(direction, profile.reach)
    .addScaledVector(lateralAxis, profile.bend)
    .add(new THREE.Vector3(0, profile.lift, 0));
  const path = cubicPath(start, end, {
    forward: direction,
    lateral: lateralAxis.clone().multiplyScalar(profile.bend),
    firstLift: 0.19,
    secondLift: 0.62,
    segments: 9,
  });
  const scaffoldEndRadius = 0.068 + (scaffoldIndex % 2) * 0.006;
  barkParts.push(taperedTube(
    path,
    tubeRadii(path.length, profile.radius, scaffoldEndRadius, 0.74, 1.16),
    {
      radialSegments: 14,
      phase: profile.yaw * 0.31,
      ripple: 0.021,
      oval: 0.94,
      flexStart: 0.05,
      flexEnd: 0.32,
      phaseRank: (scaffoldIndex * 0.137) % 1,
    },
  ));
  branchJunctions.push({
    order: 1,
    parent: 'trunk',
    point: start.toArray(),
    parentRadius: trunkRadiusAt(profile.y),
    childRadius: profile.radius,
  });

  const secondaryEnds = [];
  [-1, 1].forEach((side, sideIndex) => {
    const splitT = 0.56 + sideIndex * 0.13;
    const split = pathPoint(path, splitT);
    const splitTangent = pathTangent(path, splitT);
    const splitYaw = Math.atan2(splitTangent.z, splitTangent.x)
      + side * (0.55 + (scaffoldIndex % 3) * 0.07);
    const secondaryDirection = new THREE.Vector3(Math.cos(splitYaw), 0, Math.sin(splitYaw));
    const secondaryLateral = new THREE.Vector3(-secondaryDirection.z, 0, secondaryDirection.x);
    const reach = 1.35 + (scaffoldIndex % 3) * 0.16 + sideIndex * 0.11;
    const lift = 0.62 + ((scaffoldIndex + sideIndex) % 3) * 0.12;
    const secondaryEnd = split.clone()
      .addScaledVector(secondaryDirection, reach)
      .addScaledVector(secondaryLateral, side * 0.13)
      .add(new THREE.Vector3(0, lift, 0));
    const secondaryPath = cubicPath(split, secondaryEnd, {
      forward: secondaryDirection,
      lateral: secondaryLateral.clone().multiplyScalar(side * 0.12),
      firstLift: 0.22,
      secondLift: 0.66,
      segments: 7,
    });
    const secondaryStartRadius = 0.075 + (scaffoldIndex % 2) * 0.006;
    const secondaryEndRadius = 0.043;
    barkParts.push(taperedTube(
      secondaryPath,
      tubeRadii(secondaryPath.length, secondaryStartRadius, secondaryEndRadius, 0.78, 1.13),
      {
        radialSegments: 9,
        phase: splitYaw * 0.27,
        ripple: 0.018,
        flexStart: 0.28,
        flexEnd: 0.56,
        phaseRank: ((scaffoldIndex * 2 + sideIndex) * 0.193) % 1,
      },
    ));
    branchJunctions.push({
      order: 2,
      parent: `scaffold-${scaffoldIndex}`,
      point: split.toArray(),
      parentRadius: THREE.MathUtils.lerp(profile.radius, scaffoldEndRadius, splitT ** 0.74),
      childRadius: secondaryStartRadius,
    });
    secondaryEnds.push({ point: secondaryEnd, yaw: splitYaw, radius: secondaryEndRadius });
    leafBearingPaths.push({
      path: secondaryPath.slice(2),
      flexStart: 0.36,
      flexEnd: 0.62,
    });
    [-1, 1].forEach((twigSide, twigIndex) => {
      const twig = addTwig(
        secondaryEnd,
        splitYaw + twigSide * (0.34 + twigIndex * 0.05),
        0.82 + ((scaffoldIndex + sideIndex + twigIndex) % 3) * 0.12,
        0.28 + ((scaffoldIndex + twigIndex) % 3) * 0.11,
        scaffoldIndex * 0.37 + sideIndex + twigIndex * 0.19,
        secondaryEndRadius,
      );
      allometricRatios.push((2 * twig.startRadius ** 2) / secondaryEndRadius ** 2);
    });
  });

  [-1, 1].forEach((side, terminalIndex) => {
    addTwig(
      end,
      profile.yaw + side * (0.31 + (scaffoldIndex % 2) * 0.05),
      0.88 + (scaffoldIndex % 3) * 0.1,
      0.34 + terminalIndex * 0.13,
      scaffoldIndex * 0.41 + terminalIndex * 0.23,
      scaffoldEndRadius,
    );
  });
  allometricRatios.push((2 * 0.038 ** 2) / scaffoldEndRadius ** 2);
});

// The central leader remains load-bearing but its upper metre is broken into
// supported short shoots. This keeps the trunk termination inside live crown
// volume instead of exposing a flat pollarded pole above the canopy.
for (let index = 0; index < 8; index += 1) {
  const y = 9.35 + index * 0.31;
  const yaw = index * 2.399963229728653 + 0.42;
  const start = trunkCenterAt(y);
  addTwig(
    start,
    yaw,
    0.62 + (index % 3) * 0.18,
    0.38 + ((index + 1) % 3) * 0.11,
    4.9 + index * 0.33,
    Math.min(0.062, trunkRadiusAt(y) * 0.42),
  );
}

// A few sealed short stubs make age and pruning history visible without adding
// unsupported snag geometry or a separate material/draw call.
const pruningStubs = [
  { y: 3.7, yaw: 2.25, reach: 0.46, lift: 0.12, radius: 0.13 },
  { y: 5.05, yaw: 0.52, reach: 0.38, lift: -0.03, radius: 0.105 },
  { y: 6.85, yaw: -2.08, reach: 0.34, lift: 0.08, radius: 0.085 },
  { y: 8.18, yaw: 2.78, reach: 0.29, lift: 0.06, radius: 0.07 },
];
pruningStubs.forEach((stub, index) => {
  const direction = new THREE.Vector3(Math.cos(stub.yaw), 0, Math.sin(stub.yaw));
  const start = trunkCenterAt(stub.y).addScaledVector(direction, trunkRadiusAt(stub.y) * 0.05);
  const end = start.clone().addScaledVector(direction, stub.reach).addScaledVector(UP, stub.lift);
  const path = cubicPath(start, end, { forward: direction, segments: 3 });
  barkParts.push(taperedTube(path, tubeRadii(path.length, stub.radius, stub.radius * 0.72, 0.9, 1.15), {
    radialSegments: 10,
    phase: index * 0.7,
    ripple: 0.018,
  }));
});

const barkGeometry = mergePositionParts(barkParts, { keepUv: true, keepUv1: true });
addVertexColours(barkGeometry, 'bark');
barkGeometry.userData = {
  profile: 'mature-gingko-curved-load-bearing-hierarchy-v2',
  supportModel: 'buried-root-tip-to-flared-trunk-to-collared-scaffold-to-secondary-to-twig',
  rootCount: rootTips.length,
  scaffoldBranchCount: scaffoldProfiles.length,
  secondaryBranchCount: scaffoldProfiles.length * 2,
  twigCount: twigPaths.length,
  leafBearingShootCount: leafBearingPaths.length,
  pruningStubCount: pruningStubs.length,
  minimumRootTipDepthMeters: Math.min(...rootTips.map((point) => -point.y)),
  maximumAllometricAreaRatio: Math.max(...allometricRatios),
  branchCollars: 'child-first-ring-overlaps-parent-centreline-and-flares-8-to-16-percent',
  surface: 'smooth-curved-tubes-with-multiscale-geometric-fluting-and-vertex-bark-variation',
  flexProfile: 'uv1-y-fixed-root-and-trunk-to-progressively-flexible-scaffold-secondary-and-twig',
};

const leafParts = [];
let leafCount = 0;
let maximumLeafSupportGap = 0;
leafBearingPaths.forEach(({ path: twigPath, flexStart, flexEnd }, twigIndex) => {
  const nodeCount = 7;
  for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
    const t = 0.17 + (nodeIndex / (nodeCount - 1)) * 0.83;
      const attachedT = THREE.MathUtils.clamp(t + (random() - 0.5) * 0.012, 0, 1);
      const shootPoint = pathPoint(twigPath, attachedT);
      const tangent = pathTangent(twigPath, attachedT);
    const reference = Math.abs(tangent.y) > 0.82 ? new THREE.Vector3(1, 0, 0) : UP;
    const sideA = reference.clone().addScaledVector(tangent, -reference.dot(tangent)).normalize();
    const sideB = tangent.clone().cross(sideA).normalize();
    const leavesAtNode = 3 + ((twigIndex + nodeIndex) % 5 === 0 ? 1 : 0);
    for (let leafIndex = 0; leafIndex < leavesAtNode; leafIndex += 1) {
      const azimuth = (leafIndex / leavesAtNode) * Math.PI * 2
        + twigIndex * 0.61
        + nodeIndex * 0.37
        + (random() - 0.5) * 0.22;
      const radial = sideA.clone().multiplyScalar(Math.cos(azimuth))
        .addScaledVector(sideB, Math.sin(azimuth));
      const direction = radial.multiplyScalar(0.82)
        .addScaledVector(UP, 0.24 + random() * 0.24)
        .addScaledVector(tangent, 0.14)
        .normalize();
      const petioleStart = shootPoint.clone();
      const supportGap = petioleStart.distanceTo(shootPoint);
      maximumLeafSupportGap = Math.max(maximumLeafSupportGap, supportGap);
      const petioleLength = 0.085 + random() * 0.055;
      const petioleEnd = petioleStart.clone().addScaledVector(direction, petioleLength);
      const shootFlex = THREE.MathUtils.lerp(flexStart, flexEnd, attachedT);
      const phaseRank = ((twigIndex * 17 + nodeIndex * 5 + leafIndex) * 0.037) % 1;
      leafParts.push(taperedTube(
        [petioleStart, petioleEnd],
        [0.0062, 0.0034],
        {
          radialSegments: 4,
          ripple: 0,
          capStart: true,
          capEnd: true,
          flexStart: shootFlex,
          flexEnd: Math.min(0.94, shootFlex + 0.08),
          phaseRank,
        },
      ));
      const blade = closedFanLeaf(Math.min(0.94, shootFlex + 0.08), phaseRank);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(SOURCE_AXIS, direction);
      quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(
        SOURCE_AXIS,
        (random() - 0.5) * 1.25,
      ));
      const scale = 0.205 + random() * 0.095;
      blade.applyMatrix4(new THREE.Matrix4().compose(
        petioleEnd,
        quaternion,
        new THREE.Vector3(scale, scale, scale),
      ));
      leafParts.push(blade);
      leafCount += 1;
    }
  }
});

const leafGeometry = mergePositionParts(leafParts, { keepUv1: true });
addVertexColours(leafGeometry, 'leaf');
leafGeometry.userData = {
  profile: 'small-bilobed-fan-leaves-distributed-along-supported-outer-twigs-v2',
  botanicalFamily: 'Ginkgo-biloba-fan-leaf-and-short-shoot-grammar',
  leafCount,
  twigCount: twigPaths.length,
  leafBearingShootCount: leafBearingPaths.length,
  maximumLeafSupportGapMeters: maximumLeafSupportGap,
  sizeRangeMeters: [0.205, 0.3],
  supportModel: 'outer-twig-node-to-petiole-to-closed-fan-blade',
  energyModel: 'opaque-non-emissive-zero-metalness-dielectric-leaf',
  flexProfile: 'uv1-y-supported-shoot-to-petiole-to-flexible-fan-tip',
};

const root = new THREE.Group();
root.name = 'hero-gingko-original-v2';
root.userData = {
  version: 'original-hero-gingko-v2',
  provenance: 'project-original-deterministic-offline-authored-mesh',
  botanicalReference: 'generic-Ginkgo-biloba-mature-growth-root-flare-short-shoot-and-fan-leaf-grammar',
  groundPlaneY: 0,
  drawCalls: 2,
  supportSnapshot: {
    rootCount: rootTips.length,
    buriedRootTipCount: rootTips.filter((point) => point.y < 0).length,
    minimumRootTipDepthMeters: Math.min(...rootTips.map((point) => -point.y)),
    scaffoldBranchCount: scaffoldProfiles.length,
    secondaryBranchCount: scaffoldProfiles.length * 2,
    twigCount: twigPaths.length,
    leafBearingShootCount: leafBearingPaths.length,
    leafCount,
    pruningStubCount: pruningStubs.length,
    maximumLeafSupportGapMeters: maximumLeafSupportGap,
    maximumAllometricAreaRatio: Math.max(...allometricRatios),
  },
};
const bark = new THREE.Mesh(barkGeometry, new THREE.MeshStandardMaterial({
  name: 'hero-gingko-bark-v2',
  color: 0x665445,
  vertexColors: true,
  roughness: 0.96,
  metalness: 0,
  envMapIntensity: 0.3,
}));
bark.name = 'hero-gingko-load-bearing-bark';
bark.castShadow = true;
bark.receiveShadow = true;
const leaves = new THREE.Mesh(leafGeometry, new THREE.MeshStandardMaterial({
  name: 'hero-gingko-leaves-v2',
  color: 0x7c8d5e,
  vertexColors: true,
  roughness: 0.88,
  metalness: 0,
  envMapIntensity: 0.24,
  side: THREE.DoubleSide,
}));
leaves.name = 'hero-gingko-supported-fan-leaves';
leaves.castShadow = true;
leaves.receiveShadow = true;
root.add(bark, leaves);

const buffer = await writeBinaryGlb(root, OUTPUT);

const triangles = [barkGeometry, leafGeometry].reduce((total, geometry) => (
  total + (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3
), 0);
const bounds = new THREE.Box3().setFromObject(root);
console.log(JSON.stringify({
  output: OUTPUT,
  bytes: buffer.byteLength,
  sha256: createHash('sha256').update(buffer).digest('hex'),
  triangles,
  drawCalls: root.children.length,
  bounds: {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
  },
  leaves: leafCount,
  supportSnapshot: root.userData.supportSnapshot,
}, null, 2));
