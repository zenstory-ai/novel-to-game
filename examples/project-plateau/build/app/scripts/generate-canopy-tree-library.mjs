import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { triangleCount, writeBinaryGlb } from './gltf-export.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(APP, 'public/assets/canopy-tree-library-original-v7.glb');
const SUPPORT_PLANE_Y = -0.22;

const VARIANTS = Object.freeze([
  Object.freeze({
    id: 'humid-buttress-broadleaf',
    family: 'elliptic-waxy',
    barkFamily: 'wet-furrowed',
    trunkHeight: 5.05,
    crownRise: 2.05,
    primaryCount: 7,
    secondaryPerPrimary: 3,
    crownRadius: 2.75,
    leanX: -0.08,
    leanZ: 0.05,
    leafLength: 0.5,
    leavesPerAnchor: 7,
    hue: 0.315,
  }),
  Object.freeze({
    id: 'open-asymmetric-broadleaf',
    family: 'elliptic-waxy',
    barkFamily: 'wet-furrowed',
    trunkHeight: 5.28,
    crownRise: 2.22,
    primaryCount: 6,
    secondaryPerPrimary: 3,
    crownRadius: 3.05,
    leanX: 0.11,
    leanZ: -0.06,
    leafLength: 0.53,
    leavesPerAnchor: 7,
    hue: 0.325,
  }),
  Object.freeze({
    id: 'plate-barked-compound-broadleaf',
    family: 'compound-lanceolate',
    barkFamily: 'plate-barked',
    trunkHeight: 5.42,
    crownRise: 2.12,
    primaryCount: 7,
    secondaryPerPrimary: 3,
    crownRadius: 2.9,
    leanX: -0.035,
    leanZ: -0.1,
    leafLength: 0.44,
    leavesPerAnchor: 7,
    hue: 0.298,
  }),
  Object.freeze({
    id: 'layered-araucaria',
    family: 'araucaria-whorl',
    barkFamily: 'wet-furrowed',
    trunkHeight: 6.9,
    crownRise: 0,
    primaryCount: 49,
    secondaryPerPrimary: 0,
    crownRadius: 2.65,
    leanX: 0.025,
    leanZ: 0.035,
    leafLength: 0.31,
    leavesPerAnchor: 6,
    hue: 0.305,
  }),
]);

function createClosedTube(points, {
  baseRadius,
  tipRadius,
  radialSegments = 7,
  hue = 0.08,
  saturation = 0.25,
  lightness = 0.18,
  flexStart = 0,
  flexEnd = 0,
  phase = 0,
} = {}) {
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
    const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, t ** 0.78);
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + phase * 0.07;
      const point = points[pointIndex].clone()
        .addScaledVector(lateral, Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(...point);
      uvs.push(side / radialSegments, t);
      flexUvs.push(0, THREE.MathUtils.lerp(flexStart, flexEnd, t));
      colour.setHSL(
        hue + Math.sin(phase * 0.7 + side) * 0.004,
        saturation,
        lightness + t * 0.045 + Math.sin(side * 1.9 + pointIndex) * 0.008,
      );
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
  flexUvs.push(0, flexStart);
  colors.push(...colors.slice(0, 3));
  const tipCentre = positions.length / 3;
  positions.push(...points.at(-1));
  uvs.push(0.5, 1);
  flexUvs.push(0, flexEnd);
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
  return geometry;
}

function createTrunk(spec, variantIndex) {
  const sides = 12;
  const rings = 22;
  const structuralHeight = spec.family === 'araucaria-whorl'
    ? spec.trunkHeight
    : spec.trunkHeight + spec.crownRise * 0.42;
  const positions = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  const indices = [];
  const colour = new THREE.Color();
  for (let ringIndex = 0; ringIndex < rings; ringIndex += 1) {
    const t = ringIndex / (rings - 1);
    const y = THREE.MathUtils.lerp(SUPPORT_PLANE_Y, structuralHeight, t);
    const rootFlare = Math.exp(-t * 9.5) * (spec.family === 'araucaria-whorl' ? 0.18 : 0.31);
    const barkRelief = Math.sin(t * Math.PI * (spec.barkFamily === 'plate-barked' ? 15 : 9)
      + variantIndex * 0.7) * 0.016;
    const baseRadius = spec.family === 'araucaria-whorl' ? 0.36 : 0.43;
    const topRadius = spec.family === 'araucaria-whorl' ? 0.17 : 0.045;
    const radius = THREE.MathUtils.lerp(baseRadius, topRadius, t ** 0.72)
      + rootFlare + barkRelief;
    const centreX = spec.leanX * t ** 1.4 + Math.sin(t * 5.7 + variantIndex) * 0.012;
    const centreZ = spec.leanZ * t ** 1.45 + Math.sin(t * 6.3 - variantIndex) * 0.011;
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2 + 0.06;
      const furrow = 1 + Math.sin(side * (spec.barkFamily === 'plate-barked' ? 4.1 : 2.7)
        + ringIndex * 0.27) * 0.032;
      positions.push(
        centreX + Math.cos(angle) * radius * furrow,
        y,
        centreZ + Math.sin(angle) * radius * (2 - furrow),
      );
      uvs.push(side / sides, t * 5.2);
      flexUvs.push(0, 0);
      colour.setHSL(
        spec.barkFamily === 'plate-barked' ? 0.055 : 0.095,
        spec.barkFamily === 'plate-barked' ? 0.31 : 0.23,
        0.145 + t * 0.035 + Math.max(0, barkRelief) * 0.8,
      );
      colors.push(colour.r, colour.g, colour.b);
    }
  }
  for (let ringIndex = 0; ringIndex < rings - 1; ringIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const lower = ringIndex * sides + side;
      const lowerNext = ringIndex * sides + next;
      const upper = (ringIndex + 1) * sides + side;
      const upperNext = (ringIndex + 1) * sides + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const bottomCentre = positions.length / 3;
  positions.push(0, SUPPORT_PLANE_Y, 0);
  uvs.push(0.5, 0);
  flexUvs.push(0, 0);
  colors.push(0.07, 0.045, 0.024);
  const topCentre = positions.length / 3;
  positions.push(spec.leanX, structuralHeight, spec.leanZ);
  uvs.push(0.5, 1);
  flexUvs.push(0, 0);
  colors.push(0.18, 0.12, 0.07);
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(bottomCentre, next, side);
    const top = (rings - 1) * sides;
    indices.push(top + side, top + next, topCentre);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRootMantle(parts, spec, variantIndex) {
  const rootCount = spec.family === 'araucaria-whorl' ? 6 : 8;
  for (let rootIndex = 0; rootIndex < rootCount; rootIndex += 1) {
    const angle = rootIndex / rootCount * Math.PI * 2 + variantIndex * 0.23;
    const length = (spec.family === 'araucaria-whorl' ? 0.68 : 0.82)
      + (rootIndex % 3) * 0.08;
    parts.push(createClosedTube([
      new THREE.Vector3(Math.cos(angle) * 0.16, 0.34, Math.sin(angle) * 0.16),
      new THREE.Vector3(Math.cos(angle) * 0.46, 0.03, Math.sin(angle) * 0.46),
      new THREE.Vector3(
        Math.cos(angle) * length,
        SUPPORT_PLANE_Y + 0.05,
        Math.sin(angle) * length,
      ),
    ], {
      baseRadius: 0.19,
      tipRadius: 0.05,
      radialSegments: 5,
      hue: spec.barkFamily === 'plate-barked' ? 0.052 : 0.09,
      saturation: 0.27,
      lightness: 0.13,
      phase: rootIndex,
    }));
  }
}

function addFracturedBranchStub(parts, {
  origin,
  direction,
  length,
  baseRadius,
  hue,
  phase,
}) {
  const axis = direction.clone().normalize();
  const bend = new THREE.Vector3(-axis.z, 0, axis.x)
    .multiplyScalar(Math.sin(phase * 1.37) * length * 0.08);
  const fractureBase = origin.clone()
    .addScaledVector(axis, length * 0.64)
    .addScaledVector(bend, 0.55);
  const fracture = origin.clone()
    .addScaledVector(axis, length)
    .add(bend);
  parts.push(createClosedTube([origin, fractureBase, fracture], {
    baseRadius,
    tipRadius: baseRadius * 0.48,
    radialSegments: 6,
    hue,
    saturation: 0.22,
    lightness: 0.165,
    phase,
  }));

  const lateral = new THREE.Vector3(-axis.z, 0, axis.x).normalize();
  const normal = new THREE.Vector3().crossVectors(lateral, axis).normalize();
  for (let splinterIndex = 0; splinterIndex < 3; splinterIndex += 1) {
    const angle = splinterIndex / 3 * Math.PI * 2 + phase * 0.19;
    const splinterDirection = axis.clone()
      .addScaledVector(lateral, Math.cos(angle) * 0.22)
      .addScaledVector(normal, Math.sin(angle) * 0.22)
      .normalize();
    const splinterEnd = fracture.clone().addScaledVector(
      splinterDirection,
      length * (0.11 + splinterIndex * 0.025),
    );
    parts.push(createClosedTube([fracture.clone().addScaledVector(axis, -0.025), splinterEnd], {
      baseRadius: baseRadius * 0.19,
      tipRadius: baseRadius * 0.035,
      radialSegments: 4,
      hue: 0.072,
      saturation: 0.31,
      lightness: 0.24,
      phase: phase * 3 + splinterIndex,
    }));
  }
}

function broadleafBranches(parts, anchors, spec, variantIndex) {
  const crownOrigin = new THREE.Vector3(
    spec.leanX * 0.69,
    spec.trunkHeight * 0.59,
    spec.leanZ * 0.69,
  );
  const barkHue = spec.barkFamily === 'plate-barked' ? 0.055 : 0.09;
  // Four paired upper scaffolds fill the vertical crown volume that a mature
  // gravitropic leader actually supports. They replace, rather than add to,
  // the leaf budget removed by one wind-broken primary below.
  for (let leaderLevel = 0; leaderLevel < 4; leaderLevel += 1) {
    const levelT = leaderLevel / 3;
    const point = new THREE.Vector3(
      spec.leanX * (0.74 + levelT * 0.32),
      spec.trunkHeight * 0.84 + spec.crownRise * (0.06 + levelT * 0.5),
      spec.leanZ * (0.74 + levelT * 0.32),
    );
    for (let side = 0; side < 2; side += 1) {
      const angle = variantIndex * 0.43 + leaderLevel * 1.91 + side * Math.PI;
      const direction = new THREE.Vector3(
        Math.cos(angle),
        0.19 + levelT * 0.14,
        Math.sin(angle),
      ).normalize();
      const upperElbow = point.clone().addScaledVector(direction, 0.39 + levelT * 0.07);
      upperElbow.y += 0.055;
      const twigEnd = point.clone().addScaledVector(direction, 0.86 + levelT * 0.16);
      twigEnd.y += 0.09 + levelT * 0.05;
      parts.push(createClosedTube([point, upperElbow, twigEnd], {
        baseRadius: 0.046 - levelT * 0.012,
        tipRadius: 0.009,
        radialSegments: 5,
        hue: barkHue,
        saturation: 0.25,
        lightness: 0.175,
        phase: variantIndex * 11 + leaderLevel * 2 + side,
      }));
      for (const [anchorPoint, offset, flex] of [
        [point.clone().lerp(upperElbow, 0.7), 0, 0.76],
        [upperElbow.clone().lerp(twigEnd, 0.58), 1, 0.87],
        [twigEnd, 2, 0.96],
      ]) {
        anchors.push(Object.freeze({
          point: anchorPoint,
          direction,
          phase: (variantIndex * 31 + leaderLevel * 2 + side) * 3 + offset,
          flex,
        }));
      }
    }
  }
  const brokenPrimaryIndex = (variantIndex * 2 + 1) % spec.primaryCount;
  for (let primaryIndex = 0; primaryIndex < spec.primaryCount; primaryIndex += 1) {
    const angle = primaryIndex / spec.primaryCount * Math.PI * 2
      + variantIndex * 0.37
      + Math.sin(primaryIndex * 1.7 + variantIndex) * 0.13;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const branchScale = 0.88 + (primaryIndex % 4) * 0.055;
    const origin = crownOrigin.clone();
    const crownLayer = ((primaryIndex * 3 + variantIndex) % spec.primaryCount)
      / Math.max(spec.primaryCount - 1, 1);
    origin.y += spec.crownRise * (0.08 + crownLayer * 0.54);
    if (primaryIndex === brokenPrimaryIndex) {
      addFracturedBranchStub(parts, {
        origin,
        direction: direction.clone().add(new THREE.Vector3(0, 0.19, 0)),
        length: spec.crownRadius * 0.29,
        baseRadius: 0.12,
        hue: barkHue,
        phase: variantIndex * 17 + primaryIndex,
      });
      continue;
    }
    const elbow = origin.clone()
      .addScaledVector(direction, spec.crownRadius * 0.25 * branchScale)
      .addScaledVector(tangent, Math.sin(primaryIndex * 2.1) * 0.18);
    elbow.y += spec.crownRise * (0.12 + (primaryIndex % 2) * 0.04);
    const shoulder = origin.clone()
      .addScaledVector(direction, spec.crownRadius * 0.49 * branchScale)
      .addScaledVector(tangent, Math.sin(primaryIndex * 1.6) * 0.24);
    shoulder.y += spec.crownRise * (0.21 + (primaryIndex % 3) * 0.035);
    const end = origin.clone()
      .addScaledVector(direction, spec.crownRadius * 0.69 * branchScale)
      .addScaledVector(tangent, Math.sin(primaryIndex * 1.3) * 0.28);
    end.y += spec.crownRise * (0.27 + (primaryIndex % 3) * 0.055);
    parts.push(createClosedTube([origin, elbow, shoulder, end], {
      baseRadius: 0.115,
      tipRadius: 0.038,
      radialSegments: 6,
      hue: barkHue,
      saturation: 0.25,
      lightness: 0.16,
      phase: primaryIndex,
    }));
    const primaryDirection = end.clone().sub(shoulder).normalize();
    for (const [point, anchorDirection, offset, flex] of [
      [elbow.clone().lerp(shoulder, 0.58), shoulder.clone().sub(elbow).normalize(), 0, 0.56],
      [shoulder.clone().lerp(end, 0.54), primaryDirection, 1, 0.64],
      [end, primaryDirection, 2, 0.72],
    ]) {
      anchors.push(Object.freeze({
        point,
        direction: anchorDirection,
        phase: primaryIndex * 3 + offset + 0.41,
        flex,
      }));
    }
    for (let secondaryIndex = 0; secondaryIndex < spec.secondaryPerPrimary; secondaryIndex += 1) {
      const side = secondaryIndex - 1;
      const secondaryDirection = direction.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), side * 0.46 + Math.sin(primaryIndex) * 0.07);
      const secondaryOrigin = elbow.clone().lerp(end, 0.46 + secondaryIndex * 0.17);
      const reach = spec.crownRadius * (0.27 + secondaryIndex * 0.028)
        * (0.92 + (primaryIndex % 3) * 0.04);
      const secondaryEnd = secondaryOrigin.clone()
        .addScaledVector(secondaryDirection, reach)
        .addScaledVector(tangent, side * 0.12);
      secondaryEnd.y += spec.crownRise * (0.035 + (secondaryIndex % 2) * 0.055)
        - Math.abs(side) * 0.12
        + Math.sin(primaryIndex * 1.8 + secondaryIndex) * 0.095;
      parts.push(createClosedTube([
        secondaryOrigin,
        secondaryOrigin.clone().lerp(secondaryEnd, 0.55).add(new THREE.Vector3(0, 0.07, 0)),
        secondaryEnd,
      ], {
        baseRadius: 0.048,
        tipRadius: 0.017,
        radialSegments: 5,
        hue: barkHue,
        saturation: 0.25,
        lightness: 0.17,
        phase: primaryIndex * 3 + secondaryIndex,
      }));
      const tertiaryDirection = secondaryDirection.clone().applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (side === 0 ? (primaryIndex % 2 ? -1 : 1) : -side) * 0.31,
      );
      const tertiaryEnd = secondaryEnd.clone()
        .addScaledVector(
          tertiaryDirection,
          spec.crownRadius * (0.2 + (primaryIndex % 2) * 0.025),
        );
      tertiaryEnd.y += 0.08 + Math.sin(primaryIndex * 2.3 + secondaryIndex) * 0.09;
      parts.push(createClosedTube([
        secondaryEnd,
        secondaryEnd.clone().lerp(tertiaryEnd, 0.56).add(new THREE.Vector3(0, 0.04, 0)),
        tertiaryEnd,
      ], {
        baseRadius: 0.019,
        tipRadius: 0.007,
        radialSegments: 4,
        hue: barkHue,
        saturation: 0.25,
        lightness: 0.175,
        phase: primaryIndex * 7 + secondaryIndex,
      }));
      const anchorPhase = primaryIndex * spec.secondaryPerPrimary + secondaryIndex;
      for (const [point, anchorDirection, offset, flex] of [
        [secondaryOrigin.clone().lerp(secondaryEnd, 0.4), secondaryDirection, 0, 0.7],
        [secondaryOrigin.clone().lerp(secondaryEnd, 0.72), secondaryDirection, 1, 0.78],
        [secondaryEnd, secondaryDirection, 2, 0.84],
        [secondaryEnd.clone().lerp(tertiaryEnd, 0.5), tertiaryDirection, 3, 0.9],
        [tertiaryEnd, tertiaryDirection, 4, 0.96],
      ]) {
        anchors.push(Object.freeze({
          point,
          direction: anchorDirection,
          phase: anchorPhase * 5 + offset,
          flex,
        }));
      }
    }
  }
}

function araucariaBranches(parts, anchors, spec, variantIndex) {
  const whorls = 7;
  const perWhorl = 6;
  const brokenBranches = new Set(['1:2', '3:5']);
  for (let whorl = 0; whorl < whorls; whorl += 1) {
    const t = whorl / (whorls - 1);
    const y = 2.35 + t * 4.15;
    const radius = THREE.MathUtils.lerp(spec.crownRadius, 0.8, t ** 0.82);
    for (let branchIndex = 0; branchIndex < perWhorl; branchIndex += 1) {
      const angle = branchIndex / perWhorl * Math.PI * 2 + whorl * 0.39 + variantIndex * 0.11;
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const origin = new THREE.Vector3(
        spec.leanX * (y / spec.trunkHeight),
        y,
        spec.leanZ * (y / spec.trunkHeight),
      );
      if (brokenBranches.has(`${whorl}:${branchIndex}`)) {
        addFracturedBranchStub(parts, {
          origin,
          direction: direction.clone().add(new THREE.Vector3(0, 0.08 + t * 0.08, 0)),
          length: radius * 0.31,
          baseRadius: THREE.MathUtils.lerp(0.12, 0.075, t),
          hue: 0.09,
          phase: whorl * perWhorl + branchIndex,
        });
        continue;
      }
      const middle = origin.clone().addScaledVector(direction, radius * 0.52);
      middle.y += 0.16 + t * 0.08;
      const end = origin.clone().addScaledVector(direction, radius);
      end.y += -0.08 + t * 0.32;
      parts.push(createClosedTube([origin, middle, end], {
        baseRadius: THREE.MathUtils.lerp(0.12, 0.075, t),
        tipRadius: 0.024,
        radialSegments: 4,
        hue: 0.09,
        saturation: 0.24,
        lightness: 0.16,
        phase: whorl * perWhorl + branchIndex,
      }));
      const branchletDirection = direction.clone().applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (branchIndex % 2 ? -1 : 1) * 0.22,
      );
      const branchletEnd = end.clone()
        .addScaledVector(branchletDirection, 0.34 + (whorl % 2) * 0.05);
      branchletEnd.y += 0.12 + t * 0.08;
      parts.push(createClosedTube([end, branchletEnd], {
        baseRadius: 0.022,
        tipRadius: 0.007,
        radialSegments: 4,
        hue: 0.09,
        saturation: 0.24,
        lightness: 0.17,
        phase: whorl * perWhorl + branchIndex + 0.5,
      }));
      for (const [point, anchorDirection, offset] of [
        [origin.clone().lerp(middle, 0.42), direction, 0],
        [origin.clone().lerp(middle, 0.82), direction, 1],
        [middle.clone().lerp(end, 0.5), direction, 2],
        [middle.clone().lerp(end, 0.88), direction, 3],
        [branchletEnd, branchletDirection, 4],
      ]) {
        anchors.push(Object.freeze({
          point,
          direction: anchorDirection,
          phase: (whorl * perWhorl + branchIndex) * 5 + offset,
          flex: 0.72 + t * 0.24,
        }));
      }
    }
  }
  // Sixteen supported leader anchors replace the ten anchors removed with the
  // two broken whorl branches, keeping the existing total leaf budget intact.
  for (let topIndex = 0; topIndex < 8; topIndex += 1) {
    const angle = topIndex / 8 * Math.PI * 2 + 0.3;
    const base = new THREE.Vector3(
      spec.leanX + Math.cos(angle) * 0.08,
      spec.trunkHeight - 0.72 + (topIndex % 2) * 0.18,
      spec.leanZ + Math.sin(angle) * 0.08,
    );
    const direction = new THREE.Vector3(
      Math.cos(angle) * 0.46,
      0.74,
      Math.sin(angle) * 0.46,
    ).normalize();
    const end = base.clone().addScaledVector(direction, 0.52 + (topIndex % 3) * 0.06);
    parts.push(createClosedTube([base, end], {
      baseRadius: 0.018,
      tipRadius: 0.005,
      radialSegments: 4,
      hue: 0.09,
      saturation: 0.24,
      lightness: 0.17,
      phase: 70 + topIndex,
    }));
    for (const [point, offset] of [[base.clone().lerp(end, 0.55), 0], [end, 1]]) {
      anchors.push(Object.freeze({
        point,
        direction,
        phase: whorls * perWhorl * 5 + topIndex * 2 + offset,
        flex: 0.93 + offset * 0.05,
      }));
    }
  }
}

function pushLeaf(buffers, {
  root,
  direction,
  length,
  width,
  flex,
  hue,
  shade,
  camber,
  roll,
  variation,
}) {
  const forward = direction.clone().normalize();
  const lateral = new THREE.Vector3(-forward.z, 0, forward.x);
  if (lateral.lengthSq() < 0.001) lateral.set(1, 0, 0);
  lateral.normalize().applyAxisAngle(forward, roll);
  const baseIndex = buffers.positions.length / 3;
  const colour = new THREE.Color();
  const damageRank = ((variation * 17.317 + 0.173) % 1 + 1) % 1;
  const damaged = damageRank >= 0.72;
  if (damaged) buffers.damagedLeafCount += 1;
  const damageSide = (((variation * 29.731 + 0.417) % 1 + 1) % 1) >= 0.5
    ? 1
    : -1;
  const vertexRecords = [{
    point: root.clone(),
    uv: [0.5, 0],
    progress: 0,
    side: 0,
  }];
  for (const progress of [0.24, 0.52, 0.78]) {
    const centre = root.clone().addScaledVector(forward, length * progress);
    centre.y += Math.sin(progress * Math.PI) * camber - progress * length * 0.055;
    const profileWidth = width * Math.sin(progress * Math.PI) ** 0.72;
    for (const side of [-1, 1]) {
      const notch = damaged && side === damageSide
        ? 1 - Math.exp(-((progress - 0.58) ** 2) / 0.018) * 0.68
        : 1;
      vertexRecords.push({
        point: centre.clone().addScaledVector(lateral, profileWidth * side * notch),
        uv: [side < 0 ? 0 : 1, progress],
        progress,
        side,
      });
    }
  }
  const tip = root.clone().addScaledVector(forward, length);
  tip.y -= length * 0.055;
  vertexRecords.push({ point: tip, uv: [0.5, 1], progress: 1, side: 0 });
  vertexRecords.forEach(({ point, uv, progress, side }) => {
    buffers.positions.push(...point);
    buffers.uvs.push(...uv);
    buffers.flexUvs.push(
      variation,
      THREE.MathUtils.clamp(flex + (progress - 0.5) * 0.16, 0, 1),
    );
    colour.setHSL(hue, 0.48, shade + (side < 0 ? 0.028 : progress * 0.012));
    buffers.colors.push(colour.r, colour.g, colour.b);
  });
  // root, three paired cross-sections, tip: one root fan, two quads and one
  // tip fan. The root remains exactly on the branch axis while the middle pair
  // can carry a one-sided missing margin without disconnecting the lamina.
  buffers.indices.push(
    baseIndex, baseIndex + 1, baseIndex + 2,
    baseIndex + 1, baseIndex + 3, baseIndex + 2,
    baseIndex + 2, baseIndex + 3, baseIndex + 4,
    baseIndex + 3, baseIndex + 5, baseIndex + 4,
    baseIndex + 4, baseIndex + 5, baseIndex + 6,
    baseIndex + 5, baseIndex + 7, baseIndex + 6,
  );
}

function createLeaves(spec, anchors, variantIndex) {
  const buffers = {
    positions: [], uvs: [], flexUvs: [], colors: [], indices: [], damagedLeafCount: 0,
  };
  const worldUp = new THREE.Vector3(0, 1, 0);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (const anchor of anchors) {
    const branchAxis = anchor.direction.clone().normalize();
    const branchSide = new THREE.Vector3().crossVectors(branchAxis, worldUp);
    if (branchSide.lengthSq() < 0.001) branchSide.set(1, 0, 0);
    branchSide.normalize();
    const branchNormal = new THREE.Vector3()
      .crossVectors(branchSide, branchAxis)
      .normalize();
    for (let leafIndex = 0; leafIndex < spec.leavesPerAnchor; leafIndex += 1) {
      const azimuth = leafIndex * goldenAngle
        + anchor.phase * 0.37
        + variantIndex * 0.19;
      const radialStrength = spec.family === 'araucaria-whorl'
        ? 0.48 + (leafIndex % 3) * 0.09
        : 0.62 + (leafIndex % 4) * 0.08;
      const radial = branchAxis.clone()
        .multiplyScalar(spec.family === 'araucaria-whorl' ? 0.82 : 0.68)
        .addScaledVector(branchSide, Math.cos(azimuth) * radialStrength)
        .addScaledVector(branchNormal, Math.sin(azimuth) * radialStrength)
        .addScaledVector(
          worldUp,
          (spec.family === 'araucaria-whorl' ? 0.04 : 0.1)
            + Math.sin(anchor.phase * 0.73 + leafIndex * 1.41) * 0.08,
        )
        .normalize();
      const length = spec.leafLength * (
        0.82 + (leafIndex % 5) * 0.045 + Math.sin(anchor.phase * 1.3 + leafIndex) * 0.035
      );
      const width = length * (spec.family === 'compound-lanceolate'
        ? 0.24
        : spec.family === 'araucaria-whorl' ? 0.145 : 0.34);
      // Leaves emerge at successive nodes along the terminal twig instead of
      // sharing one star-shaped origin. Moving only backward along the known
      // branch axis keeps every root inside its closed supporting tube.
      const attachmentOffset = spec.family === 'araucaria-whorl'
        ? 0.035 + (leafIndex % 4) * 0.028
        : 0.055 + (leafIndex % 5) * 0.042;
      const root = anchor.point.clone().addScaledVector(branchAxis, -attachmentOffset);
      pushLeaf(buffers, {
        root,
        direction: radial,
        length,
        width,
        flex: THREE.MathUtils.clamp(anchor.flex + (leafIndex % 3) * 0.025, 0, 1),
        hue: spec.hue + Math.sin(anchor.phase * 0.9 + leafIndex) * 0.008,
        shade: (spec.family === 'araucaria-whorl' ? 0.255 : 0.285)
          + (leafIndex % 3) * 0.018,
        camber: width * 0.31,
        roll: azimuth * 0.43 + Math.sin(anchor.phase * 1.17 + leafIndex * 1.93) * 0.34,
        variation: ((Math.sin(
          anchor.phase * 12.9898 + leafIndex * 78.233 + variantIndex * 37.719,
        ) * 43_758.5453) % 1 + 1) % 1,
      });
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(buffers.flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    profile: `indexed-cambered-attached-leaves-${spec.id}`,
    topology: 'indexed-six-triangle-eight-vertex-cambered-laminae',
    supportModel: 'every-leaf-root-overlaps-a-closed-terminal-branch',
    flexProfile: 'uv1-y-rigid-branch-root-to-flexible-leaf-tip',
    variationProfile: 'uv1-x-stable-leaf-retention-rank',
    attachmentDistribution: 'distributed-nodes-along-closed-primary-secondary-and-tertiary-branch-axes',
    leafCount: anchors.length * spec.leavesPerAnchor,
    trianglesPerLeaf: 6,
    verticesPerLeaf: 8,
    damagedLeafCount: buffers.damagedLeafCount,
    partialLaminaDamage:
      'stable-one-sided-missing-margin-plus-colour-depth-shared-rare-perforation',
  };
  return geometry;
}

function buildVariant(spec, variantIndex) {
  const parts = [createTrunk(spec, variantIndex)];
  const anchors = [];
  addRootMantle(parts, spec, variantIndex);
  if (spec.family === 'araucaria-whorl') {
    araucariaBranches(parts, anchors, spec, variantIndex);
  } else {
    broadleafBranches(parts, anchors, spec, variantIndex);
  }
  const structure = mergeGeometries(parts, false);
  parts.forEach((geometry) => geometry.dispose());
  structure.computeBoundingBox();
  structure.computeBoundingSphere();
  const structurePositions = structure.getAttribute('position');
  let supportVertexCount = 0;
  for (let index = 0; index < structurePositions.count; index += 1) {
    if (structurePositions.getY(index) <= SUPPORT_PLANE_Y + 0.035) supportVertexCount += 1;
  }
  structure.userData = {
    profile: `closed-root-trunk-hierarchical-branch-structure-${spec.id}`,
    topology: 'closed-root-mantle-plus-overlapping-closed-trunk-primary-and-secondary-branches',
    supportPlaneY: SUPPORT_PLANE_Y,
    supportVertexCount,
    supportModel: 'buried-root-mantle-to-gravitropic-trunk-to-closed-branch-hierarchy',
    branchAnchorCount: anchors.length,
    crownArchitecture: spec.family === 'araucaria-whorl'
      ? 'seven-load-bearing-whorls-with-two-fractured-limbs-and-supported-leader-twigs'
      : 'vertically-stratified-primary-and-upper-scaffold-crown-with-one-fractured-limb',
    brokenBranchCount: spec.family === 'araucaria-whorl' ? 2 : 1,
    fractureSplinterCount: spec.family === 'araucaria-whorl' ? 6 : 3,
    trunkHeight: spec.trunkHeight,
    barkFamily: spec.barkFamily,
  };
  const leaves = createLeaves(spec, anchors, variantIndex);
  const group = new THREE.Group();
  group.name = `canopy-tree-variant-${variantIndex + 1}-${spec.id}`;
  group.userData = {
    variantId: spec.id,
    variantIndex,
    family: spec.family,
    barkFamily: spec.barkFamily,
    branchAnchorCount: anchors.length,
    crownArchitecture: structure.userData.crownArchitecture,
    brokenBranchCount: structure.userData.brokenBranchCount,
    fractureSplinterCount: structure.userData.fractureSplinterCount,
    leafCount: leaves.userData.leafCount,
    drawCalls: 2,
    supportModel: 'buried-root-mantle-to-trunk-to-closed-branches-to-attached-leaves',
  };
  const structureMaterial = new THREE.MeshStandardMaterial({
    name: `${spec.id}-structure`, color: 0xffffff, vertexColors: true,
    roughness: 0.96, metalness: 0,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    name: `${spec.id}-leaves`, color: 0xffffff, vertexColors: true,
    roughness: 0.91, metalness: 0, side: THREE.DoubleSide,
  });
  const structureMesh = new THREE.Mesh(structure, structureMaterial);
  structureMesh.name = 'canopy-tree-load-bearing-structure';
  structureMesh.userData.name = structureMesh.name;
  const leafMesh = new THREE.Mesh(leaves, leafMaterial);
  leafMesh.name = 'canopy-tree-attached-leaves';
  leafMesh.userData.name = leafMesh.name;
  for (const mesh of [structureMesh, leafMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

const root = new THREE.Group();
root.name = 'canopy-tree-library-original-v7';
root.userData = {
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  botanicalReference: 'buttressed-broadleaf-hierarchical-crown-and-layered-araucaria',
  supportModel: 'buried-root-mantle-to-trunk-to-closed-branches-to-attached-leaves',
  collisionModel: 'solid-visible-trunk-with-non-solid-branches-and-pliable-leaves',
  crownArchitecture:
    'vertical-crown-volume-with-closed-load-bearing-scaffolds-and-wind-fractured-limb-stubs',
  variantCount: VARIANTS.length,
  drawCalls: VARIANTS.length * 2,
};
VARIANTS.forEach((spec, index) => root.add(buildVariant(spec, index)));

const result = await writeBinaryGlb(root, OUTPUT);

const trianglesByVariant = root.children.map(triangleCount);
const leafCounts = root.children.map((variant) => variant.userData.leafCount);
const damagedLeafCounts = root.children.map((variant) => (
  variant.children.find((mesh) => mesh.name === 'canopy-tree-attached-leaves')
    .geometry.userData.damagedLeafCount
));
const branchAnchorCounts = root.children.map((variant) => variant.userData.branchAnchorCount);
const supportVertexCounts = root.children.map((variant) => (
  variant.children.find((mesh) => mesh.name === 'canopy-tree-load-bearing-structure')
    .geometry.userData.supportVertexCount
));
const boundsByVariant = root.children.map((variant) => {
  const bounds = new THREE.Box3().setFromObject(variant);
  return { min: bounds.min.toArray(), max: bounds.max.toArray() };
});
console.log(JSON.stringify({
  output: OUTPUT,
  bytes: result.byteLength,
  triangles: trianglesByVariant.reduce((sum, value) => sum + value, 0),
  trianglesByVariant,
  drawCalls: root.userData.drawCalls,
  supportPlaneY: SUPPORT_PLANE_Y,
  variantIds: VARIANTS.map(({ id }) => id),
  leafCounts,
  damagedLeafCounts,
  branchAnchorCounts,
  supportVertexCounts,
  boundsByVariant,
}, null, 2));
