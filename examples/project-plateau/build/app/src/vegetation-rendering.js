import * as THREE from 'three';
import {
  createCylinderBetween,
  createVerticalLoft,
  mergeParts,
  mergeSmoothParts,
  transformGeometry,
} from './world-rendering.js';
import {
  applyThinLeafTransmission,
} from './vegetation-leaf-materials.js';
import {
  barkTextures,
  compoundLeafClusterTexture,
  leafClusterTexture,
  plateBarkTextures,
} from './vegetation-textures.js';

function createPrehistoricTrunkGeometry() {
  const parts = [createVerticalLoft([
    [0, 0, 0, 0.68, 0.6],
    [0.7, 0.03, -0.04, 0.52, 0.48, 0.08],
    [2.3, -0.08, 0.1, 0.39, 0.35, -0.05],
    [4.2, 0.12, 0.04, 0.3, 0.27, 0.1],
    [5.8, 0.22, -0.1, 0.22, 0.2, -0.04],
  ], 11)];
  const roots = [0.1, 1.37, 2.66, 3.94, 5.2];
  roots.forEach((angle, index) => {
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.18, 0.2, Math.sin(angle) * 0.18],
      [Math.cos(angle) * (0.92 + (index % 2) * 0.18), 0.035, Math.sin(angle) * (0.92 + (index % 2) * 0.18)],
      0.31,
      0.075,
      7,
    ));
  });
  parts.push(
    createCylinderBetween([0.08, 4.35, 0.02], [1.28, 5.3, 0.34], 0.24, 0.09, 9),
    createCylinderBetween([0.02, 4.78, -0.04], [-0.92, 5.5, -0.5], 0.2, 0.075, 9),
    createCylinderBetween([0.16, 5.1, -0.08], [0.62, 5.82, -0.72], 0.16, 0.06, 8),
  );
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const faceBreak = normals ? Math.abs(normals.getX(index)) * 0.08 : 0;
    const barkRidge = Math.sin(y * 3.4 + x * 7.1 - z * 5.3) * 0.12
      + Math.sin(y * 8.7 - x * 2.8) * 0.05;
    const shade = THREE.MathUtils.clamp(0.78 + barkRidge + faceBreak, 0.57, 1);
    colors.push(shade, shade * 0.96, shade * 0.84);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 6.2);
  geometry.userData.profile = 'buttressed-bent-branching';
  geometry.userData.barkFamily = 'wet-furrowed-buttress';
  return geometry;
}

function createPlateBarkedTrunkGeometry() {
  const radialSegments = 14;
  const rings = [
    [0, 0, 0, 0.72, 0.64],
    [0.32, 0.02, -0.025, 0.63, 0.57],
    [0.78, 0.045, -0.055, 0.54, 0.49],
    [1.35, 0.015, 0.015, 0.48, 0.43],
    [2.05, -0.075, 0.09, 0.415, 0.37],
    [2.78, -0.09, 0.125, 0.365, 0.325],
    [3.48, -0.02, 0.08, 0.325, 0.29],
    [4.12, 0.09, 0.015, 0.29, 0.255],
    [4.72, 0.165, -0.055, 0.255, 0.225],
    [5.25, 0.205, -0.095, 0.225, 0.2],
    [5.72, 0.225, -0.115, 0.19, 0.17],
  ];
  const vertices = [];
  const indices = [];
  rings.forEach(([y, centreX, centreZ, radiusX, radiusZ], ringIndex) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + 0.08;
      // The relief is part of the load-bearing trunk surface: long radial
      // flutes continue between rings while smaller staggered plates vary with
      // height. Nothing is offset as a floating bark decal.
      const longFlute = Math.sin(angle * 5 + 0.32) * 0.055;
      const plateStep = Math.sin(angle * 3 - ringIndex * 1.17) * 0.028
        + Math.sin(angle * 7 + ringIndex * 0.73) * 0.014;
      const relief = 1 + longFlute + plateStep;
      vertices.push(
        centreX + Math.cos(angle) * radiusX * relief,
        y,
        centreZ + Math.sin(angle) * radiusZ * relief,
      );
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
  vertices.push(rings[0][1], 0, rings[0][2]);
  const topCentre = vertices.length / 3;
  const top = rings.at(-1);
  vertices.push(top[1], top[0], top[2]);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const trunk = new THREE.BufferGeometry();
  trunk.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  trunk.setIndex(indices);

  const parts = [trunk];
  [0.25, 1.53, 2.82, 4.08, 5.38].forEach((angle, index) => {
    const length = 0.86 + (index % 2) * 0.19;
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.22, 0.2, Math.sin(angle) * 0.22],
      [Math.cos(angle) * length, 0.035, Math.sin(angle) * length],
      0.29,
      0.07,
      8,
    ));
  });
  parts.push(
    createCylinderBetween([0.04, 4.28, 0.02], [1.12, 5.2, 0.52], 0.225, 0.078, 9),
    createCylinderBetween([-0.01, 4.62, 0.01], [-1.08, 5.34, -0.26], 0.19, 0.066, 9),
    createCylinderBetween([0.12, 5.02, -0.06], [0.52, 5.72, -0.78], 0.15, 0.052, 8),
  );
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const faceLight = normals ? Math.abs(normals.getZ(index)) * 0.055 : 0;
    const plateValue = Math.sin(y * 4.6 - x * 5.8 + z * 3.3) * 0.085
      + Math.sin(y * 9.8 + x * 2.4) * 0.035;
    const shade = THREE.MathUtils.clamp(0.73 + plateValue + faceLight, 0.52, 0.94);
    colors.push(shade, shade * 0.9, shade * 0.74);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 6.1);
  geometry.userData.profile = 'fluted-plate-barked-buttressed-trunk';
  geometry.userData.barkFamily = 'plate-barked-fibrous';
  geometry.userData.supportModel = 'coplanar-root-flare-with-five-buttresses';
  return geometry;
}

function createCanopyClusterGeometry(accent = false) {
  const lobes = accent ? [
    [[-0.72, 0.05, 0.18], [0.82, 0.46, 0.72], [0.08, 0.45, -0.05]],
    [[0.34, 0.18, -0.38], [0.76, 0.38, 0.62], [-0.06, -0.18, 0.08]],
    [[0.82, -0.02, 0.3], [0.58, 0.34, 0.52], [0.12, 0.18, 0.04]],
    [[-0.05, 0.44, 0.46], [0.62, 0.32, 0.56], [0.04, 0.38, -0.12]],
  ] : [
    [[-1.18, -0.04, 0.16], [1.05, 0.62, 0.92], [0.05, 0.32, 0.02]],
    [[-0.26, 0.28, -0.7], [1.08, 0.66, 0.82], [-0.08, -0.2, 0.1]],
    [[0.92, -0.02, 0.22], [0.96, 0.58, 0.88], [0.12, 0.42, -0.04]],
    [[0.14, 0.62, 0.54], [0.9, 0.5, 0.78], [-0.04, 0.12, 0.08]],
    [[0.45, 0.46, -0.36], [0.74, 0.42, 0.68], [0.08, -0.38, -0.03]],
    [[-0.58, 0.48, 0.52], [0.7, 0.4, 0.62], [-0.12, 0.25, 0.06]],
  ];
  const parts = lobes.map(([position, scale, rotation]) => transformGeometry(
    new THREE.IcosahedronGeometry(1, 2),
    position,
    scale,
    rotation,
  ));
  const geometry = mergeSmoothParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const sunBreak = Math.sin(x * 4.7 + z * 6.2 + y * 3.1) * 0.09;
    const heightBreak = THREE.MathUtils.clamp(y * 0.07, -0.03, 0.08);
    const shade = THREE.MathUtils.clamp(0.82 + sunBreak + heightBreak, 0.64, 1);
    colors.push(shade * 0.86, shade, shade * 0.76);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = accent ? 'asymmetric-accent-lobes' : 'asymmetric-multi-lobe';
  return geometry;
}

const CANOPY_PRIMARY_BRANCHES = Object.freeze([
  [[0, 0, 0], [-1.55, 0.72, 0.32], 0.2, 0.085],
  [[0.04, 0.08, 0], [1.48, 0.62, 0.52], 0.19, 0.08],
  [[0, 0.16, -0.03], [-0.5, 1.08, -1.28], 0.17, 0.065],
  [[0.03, 0.24, 0.04], [0.72, 1.26, -0.72], 0.16, 0.06],
  [[-0.02, 0.34, 0.06], [0.18, 1.58, 0.66], 0.145, 0.052],
]);

const CANOPY_SECONDARY_BRANCHES = Object.freeze([
  [[-1.24, 0.61, 0.26], [-2.08, 0.92, 0.78], 0.09, 0.035],
  [[-1.18, 0.58, 0.22], [-1.74, 1.04, -0.42], 0.08, 0.03],
  [[1.16, 0.52, 0.42], [2.02, 0.86, 0.12], 0.085, 0.032],
  [[1.1, 0.5, 0.4], [1.56, 1.05, 1.02], 0.075, 0.028],
  [[-0.4, 0.94, -1.05], [-1.15, 1.32, -1.58], 0.07, 0.026],
  [[0.58, 1.09, -0.62], [1.18, 1.52, -1.18], 0.068, 0.024],
  [[0.16, 1.36, 0.54], [-0.32, 1.91, 1.08], 0.062, 0.022],
  [[0.17, 1.38, 0.55], [0.72, 1.84, 0.92], 0.058, 0.02],
]);

const CANOPY_LEAF_ANCHORS = Object.freeze(CANOPY_SECONDARY_BRANCHES.map(([, end]) => end));

function createCanopyBranchGeometry() {
  // One visible load path runs from the trunk crown into every major leaf
  // mass. Intersecting tapered cylinders are intentional branch unions; they
  // prevent the canopy cards from reading as unsupported green clouds.
  const parts = [...CANOPY_PRIMARY_BRANCHES, ...CANOPY_SECONDARY_BRANCHES].map(([
    start,
    end,
    startRadius,
    endRadius,
  ]) => createCylinderBetween(start, end, startRadius, endRadius, 7));
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const mineral = Math.sin(y * 7.2 + x * 3.9 - z * 5.4) * 0.08;
    const shade = THREE.MathUtils.clamp(0.7 + mineral + y * 0.025, 0.53, 0.82);
    colors.push(shade, shade * 0.93, shade * 0.78);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 2.2);
  geometry.userData.profile = 'load-bearing-radial-branch-whorl';
  geometry.userData.supportModel = 'trunk-to-primary-to-leaf-cluster';
  return geometry;
}

function createGroundCoverGeometry(variant = 0) {
  const vertices = [];
  const colors = [];
  const bladeCount = 9 + variant * 2;
  for (let index = 0; index < bladeCount; index += 1) {
    const angle = (index / bladeCount) * Math.PI * 2 + variant * 0.31;
    const radial = 0.05 + (index % 4) * 0.075;
    const height = 0.44 + ((index * 5 + variant * 3) % 7) * 0.075;
    const width = 0.055 + ((index + variant) % 3) * 0.018;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const base = direction.clone().multiplyScalar(radial);
    const middle = base.clone().addScaledVector(direction, height * 0.19);
    middle.y = height * 0.58;
    const tip = base.clone().addScaledVector(direction, height * (0.28 + variant * 0.025));
    tip.y = height;
    const baseLeft = base.clone().addScaledVector(tangent, width);
    const baseRight = base.clone().addScaledVector(tangent, -width);
    const middleLeft = middle.clone().addScaledVector(tangent, width * 0.62);
    const middleRight = middle.clone().addScaledVector(tangent, -width * 0.62);
    for (const point of [
      baseLeft, middleLeft, baseRight,
      baseRight, middleLeft, middleRight,
      middleLeft, tip, middleRight,
    ]) {
      vertices.push(point.x, point.y, point.z);
      const heightWeight = point.y / height;
      const shade = 0.72 + heightWeight * 0.24 + Math.sin(index * 2.7) * 0.035;
      colors.push(shade * 0.78, shade, shade * 0.68);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = `curved-blade-ground-cover-${variant + 1}`;
  return geometry;
}

function createBroadleafGroundCoverGeometry() {
  const vertices = [];
  const colors = [];
  const leafCount = 7;
  const segments = 5;
  for (let leaf = 0; leaf < leafCount; leaf += 1) {
    const angle = (leaf / leafCount) * Math.PI * 2 + (leaf % 2 ? 0.16 : -0.09);
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const length = 0.62 + (leaf % 3) * 0.13;
    const width = 0.14 + ((leaf * 2) % 4) * 0.025;
    const centres = [];
    const leftEdges = [];
    const rightEdges = [];
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const centre = direction.clone().multiplyScalar(length * t);
      centre.addScaledVector(tangent, Math.sin(t * Math.PI) * (leaf % 2 ? 0.035 : -0.028));
      centre.y = 0.025 + Math.sin(t * Math.PI) * (0.2 + (leaf % 3) * 0.035) + t * 0.055;
      const halfWidth = Math.pow(Math.sin(t * Math.PI), 0.72) * width + 0.008;
      centres.push(centre);
      leftEdges.push(centre.clone().addScaledVector(tangent, halfWidth));
      rightEdges.push(centre.clone().addScaledVector(tangent, -halfWidth));
    }
    for (let segment = 0; segment < segments; segment += 1) {
      const points = [
        leftEdges[segment],
        leftEdges[segment + 1],
        rightEdges[segment],
        rightEdges[segment],
        leftEdges[segment + 1],
        rightEdges[segment + 1],
      ];
      points.forEach((point, pointIndex) => {
        vertices.push(point.x, point.y, point.z);
        const t = (segment + (pointIndex === 1 || pointIndex === 4 || pointIndex === 5 ? 1 : 0))
          / segments;
        const midrib = pointIndex === 0 || pointIndex === 3 ? 0.025 : 0;
        const shade = 0.72 + t * 0.2 + midrib + (leaf % 3) * 0.025;
        colors.push(shade * 0.76, shade, shade * 0.67);
      });
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'broad-waxy-lanceolate-understory-rosette';
  geometry.userData.leafCount = leafCount;
  return geometry;
}

function createClosedLeafBladeGeometry(length, width, thickness = 0.028, camber = 0.045) {
  const outline = [
    [0, 0],
    [length * 0.17, width * 0.28],
    [length * 0.46, width * 0.5],
    [length * 0.76, width * 0.34],
    [length, 0],
    [length * 0.76, -width * 0.34],
    [length * 0.46, -width * 0.5],
    [length * 0.17, -width * 0.28],
  ];
  const vertices = [length * 0.48, thickness * 0.5 + camber, 0];
  outline.forEach(([x, z]) => vertices.push(x, thickness * 0.5, z));
  const bottomCentre = vertices.length / 3;
  vertices.push(length * 0.48, -thickness * 0.5, 0);
  outline.forEach(([x, z]) => vertices.push(x, -thickness * 0.5, z));
  const indices = [];
  const outlineCount = outline.length;
  for (let index = 0; index < outlineCount; index += 1) {
    const next = (index + 1) % outlineCount;
    const top = 1 + index;
    const topNext = 1 + next;
    const bottom = bottomCentre + 1 + index;
    const bottomNext = bottomCentre + 1 + next;
    indices.push(0, top, topNext);
    indices.push(bottomCentre, bottomNext, bottom);
    indices.push(top, bottom, topNext, topNext, bottom, bottomNext);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createVolumetricLeafSprayGeometry() {
  const parts = [
    createCylinderBetween([-1.02, 0, 0], [1.08, 0.055, 0], 0.035, 0.016, 6),
    createCylinderBetween([-0.22, 0.012, 0], [0.58, 0.16, 0.62], 0.026, 0.011, 6),
  ];
  const leafSpecs = [];
  [-0.78, -0.42, -0.05, 0.32, 0.67].forEach((x, index) => {
    [-1, 1].forEach((side) => {
      leafSpecs.push({
        base: [x, 0.025 + index * 0.006, 0],
        direction: [0.2 + index * 0.035, 0.08 + (index % 2) * 0.045, side],
        length: 0.58 + (index % 3) * 0.07,
        width: 0.5 + (index % 2) * 0.06,
        // Alternating petiole torsion prevents an impossible perfectly planar
        // roof. Edge leaves roll and droop more than the protected inner pair.
        roll: side * (0.32 + index * 0.095),
      });
    });
  });
  leafSpecs.push(
    {
      base: [1.02, 0.052, 0], direction: [1, 0.12, 0.08],
      length: 0.74, width: 0.56, roll: -0.28,
    },
    {
      base: [0.23, 0.095, 0.35], direction: [-0.18, 0.08, 1],
      length: 0.56, width: 0.46, roll: 0.46,
    },
    {
      base: [0.52, 0.148, 0.58], direction: [0.56, 0.13, 0.82],
      length: 0.62, width: 0.48, roll: -0.38,
    },
  );
  const sourceAxis = new THREE.Vector3(1, 0, 0);
  leafSpecs.forEach(({ base, direction, length, width, roll }) => {
    const basePoint = new THREE.Vector3(...base);
    const leafDirection = new THREE.Vector3(...direction).normalize();
    const petioleEnd = basePoint.clone().addScaledVector(leafDirection, 0.12);
    parts.push(createCylinderBetween(
      basePoint.toArray(),
      petioleEnd.toArray(),
      0.012,
      0.006,
      5,
    ));
    const quaternion = new THREE.Quaternion().setFromUnitVectors(sourceAxis, leafDirection);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(sourceAxis, roll));
    const blade = createClosedLeafBladeGeometry(length, width);
    blade.applyMatrix4(new THREE.Matrix4().compose(
      petioleEnd,
      quaternion,
      new THREE.Vector3(1, 1, 1),
    ));
    parts.push(blade);
  });
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const surfaceVariation = Math.sin(x * 5.7 - z * 4.3 + y * 8.1) * 0.045;
    const shade = THREE.MathUtils.clamp(0.9 + surfaceVariation, 0.83, 0.97);
    colors.push(shade * 0.76, shade, shade * 0.7);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = 'branch-supported-volumetric-leaf-spray';
  geometry.userData.leafCount = leafSpecs.length;
  geometry.userData.supportModel = 'bough-to-rachis-to-petiole-to-leaf-blade';
  geometry.userData.energyModel = 'finite-thickness-leaf-with-aggregate-crown-shadow-proxy';
  return geometry;
}

function createSupportedCanopyLeafGeometry(family = 'elliptic-waxy') {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const cardsPerAnchor = 2;
  CANOPY_LEAF_ANCHORS.forEach((anchor, anchorIndex) => {
    const radialYaw = Math.atan2(anchor[0], anchor[2]);
    for (let cardIndex = 0; cardIndex < cardsPerAnchor; cardIndex += 1) {
      const base = vertices.length / 3;
      const width = family === 'compound-lanceolate'
        ? 1.05 + (anchorIndex % 3) * 0.09
        : 0.9 + (anchorIndex % 3) * 0.08;
      const height = family === 'compound-lanceolate'
        ? 0.46 + (anchorIndex % 2) * 0.045
        : 0.56 + (anchorIndex % 2) * 0.055;
      const yaw = radialYaw + cardIndex * (Math.PI / cardsPerAnchor) + anchorIndex * 0.17;
      const pitch = -0.12 + ((anchorIndex + cardIndex) % 3) * 0.12;
      const roll = (cardIndex - (cardsPerAnchor - 1) * 0.5) * 0.13;
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll));
      // The card centre sits at the terminal secondary-branch point. The atlas
      // itself contains the continuing twig/rachis, so every visible spray has
      // an explicit load path into wood instead of hovering around crown centre.
      const centre = new THREE.Vector3(...anchor).add(new THREE.Vector3(
        Math.cos(radialYaw) * 0.12,
        0.04 + cardIndex * 0.035,
        Math.sin(radialYaw) * 0.12,
      ));
      const corners = [
        new THREE.Vector3(-width * 0.5, -height * 0.5, 0),
        new THREE.Vector3(width * 0.5, -height * 0.5, 0),
        new THREE.Vector3(width * 0.5, height * 0.5, 0),
        new THREE.Vector3(-width * 0.5, height * 0.5, 0),
      ];
      corners.forEach((corner) => {
        corner.applyQuaternion(rotation).add(centre);
        vertices.push(corner.x, corner.y, corner.z);
      });
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const familyTint = family === 'compound-lanceolate'
    ? [0.8, 0.96, 0.68]
    : [0.74, 1, 0.72];
  const colors = [];
  for (let index = 0; index < vertices.length / 3; index += 1) {
    const shade = 0.9 + (index % 4) * 0.025;
    colors.push(
      familyTint[0] * shade,
      familyTint[1] * shade,
      familyTint[2] * shade,
    );
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = `branch-tip-supported-${family}-leaf-sprays`;
  geometry.userData.family = family;
  geometry.userData.supportModel = 'secondary-branch-tip-to-visible-rachis';
  return geometry;
}

function addCylindricalUvs(geometry, heightScale) {
  const positions = geometry.getAttribute('position');
  const uvs = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    uvs.push(Math.atan2(z, x) / (Math.PI * 2) + 0.5, y / heightScale);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

function createFernGeometry({
  frondCount = 8,
  frondSegments = 6,
  lengthScale = 1,
  liftScale = 1,
  angleOffset = 0,
  centralShoots = 3,
  variant = 'rosette',
} = {}) {
  const vertices = [];
  for (let index = 0; index < frondCount; index += 1) {
    const angle = (index / frondCount) * Math.PI * 2 + angleOffset + Math.sin(index * 1.73) * 0.045;
    const length = (0.92 + (index % 3) * 0.15) * lengthScale;
    const lift = (0.46 + (index % 4) * 0.08) * liftScale;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const leftEdge = [];
    const rightEdge = [];
    const centres = [];
    for (let segment = 0; segment <= frondSegments; segment += 1) {
      const t = segment / frondSegments;
      const centre = direction.clone().multiplyScalar(length * t);
      centre.y = 0.04 + Math.sin(t * Math.PI) * lift + t * 0.04;
      const width = (0.045 + Math.sin(t * Math.PI) * 0.1) * (1 - t * 0.36);
      centres.push(centre);
      leftEdge.push(centre.clone().addScaledVector(tangent, width));
      rightEdge.push(centre.clone().addScaledVector(tangent, -width));
    }
    for (let segment = 0; segment < frondSegments; segment += 1) {
      const a = leftEdge[segment];
      const b = rightEdge[segment];
      const c = leftEdge[segment + 1];
      const d = rightEdge[segment + 1];
      for (const point of [a, c, b, b, c, d]) vertices.push(...point);
    }
    for (let segment = 1; segment < frondSegments; segment += 1) {
      const t = segment / frondSegments;
      const leafletLength = (0.24 + Math.sin(t * Math.PI) * 0.12) * (1 - t * 0.28);
      const forward = direction.clone().multiplyScalar(0.12);
      const leftTip = centres[segment].clone().addScaledVector(tangent, leafletLength).add(forward);
      const rightTip = centres[segment].clone().addScaledVector(tangent, -leafletLength).add(forward);
      const nextCentre = centres[Math.min(frondSegments, segment + 1)];
      for (const point of [centres[segment], leftTip, nextCentre, centres[segment], nextCentre, rightTip]) {
        vertices.push(...point);
      }
    }
  }
  for (let index = 0; index < centralShoots; index += 1) {
    const angle = (index / centralShoots) * Math.PI * 2 + 0.45 + angleOffset;
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const base = new THREE.Vector3(0, 0.04, 0);
    const left = tangent.clone().multiplyScalar(0.11).add(new THREE.Vector3(0, 0.58, 0));
    const right = tangent.clone().multiplyScalar(-0.11).add(new THREE.Vector3(0, 0.58, 0));
    const tip = new THREE.Vector3(Math.cos(angle) * 0.18, 1.12, Math.sin(angle) * 0.18);
    for (const point of [base, left, tip, base, tip, right]) vertices.push(...point);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const ribBreak = Math.sin(x * 8.7 - z * 6.2 + y * 5.1) * 0.08;
    const heightBreak = THREE.MathUtils.clamp(y * 0.12, 0, 0.1);
    const shade = THREE.MathUtils.clamp(0.82 + ribBreak + heightBreak, 0.65, 1);
    colors.push(shade * 0.84, shade, shade * 0.74);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 2.9);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createAraucariaGeometry() {
  const parts = [];
  const tiers = [
    [1.48, 0.62],
    [1.22, 1.12],
    [0.98, 1.6],
    [0.72, 2.02],
  ];
  tiers.forEach(([radius, y], tierIndex) => {
    const branchCount = 6;
    for (let branch = 0; branch < branchCount; branch += 1) {
      const angle = (branch / branchCount) * Math.PI * 2 + tierIndex * 0.38;
      parts.push(transformGeometry(
        new THREE.IcosahedronGeometry(1, 1),
        [Math.cos(angle) * radius * 0.52, y, Math.sin(angle) * radius * 0.52],
        [radius * 0.62, 0.16 + tierIndex * 0.015, 0.28],
        [0, -angle, (branch % 2 - 0.5) * 0.08],
      ));
    }
  });
  parts.push(transformGeometry(new THREE.IcosahedronGeometry(1, 1), [0, 2.36, 0], [0.42, 0.48, 0.42]));
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const shade = THREE.MathUtils.clamp(
      0.8 + Math.sin(positions.getY(index) * 5.2 + positions.getX(index) * 4.1) * 0.12,
      0.64,
      1,
    );
    colors.push(shade * 0.84, shade, shade * 0.74);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = 'whorled-araucaria-branches';
  return geometry;
}

function createTreeFernTrunkGeometry() {
  const parts = [createVerticalLoft([
      [0, 0, 0, 0.34, 0.32],
      [0.42, 0.02, -0.02, 0.31, 0.29, 0.08],
      [1.18, -0.025, 0.025, 0.285, 0.27, -0.06],
      [2.05, 0.035, -0.03, 0.25, 0.235, 0.1],
      [2.72, 0.055, 0.02, 0.21, 0.2, -0.04],
    ], 10)];
  [0.25, 1.82, 3.34, 4.96].forEach((angle, index) => {
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.12, 0.18, Math.sin(angle) * 0.12],
      [Math.cos(angle) * (0.58 + (index % 2) * 0.16), 0.03, Math.sin(angle) * (0.58 + (index % 2) * 0.16)],
      0.19,
      0.045,
      5,
    ));
  });
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const x = positions.getX(index);
    const ringBreak = Math.sin(y * 15.4 + x * 4.1) * 0.11;
    const shade = THREE.MathUtils.clamp(0.76 + ringBreak, 0.58, 0.9);
    colors.push(shade, shade * 0.92, shade * 0.72);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'ring-scarred-tree-fern-trunk';
  return geometry;
}

const shared = {
  trunkGeometry: createPrehistoricTrunkGeometry(),
  plateBarkedTrunkGeometry: createPlateBarkedTrunkGeometry(),
  canopyBranchGeometry: createCanopyBranchGeometry(),
  crownGeometry: createCanopyClusterGeometry(),
  crownAccentGeometry: createCanopyClusterGeometry(true),
  araucariaGeometry: createAraucariaGeometry(),
  treeFernTrunkGeometry: createTreeFernTrunkGeometry(),
  treeFernCrownGeometries: [
    createFernGeometry({
      frondCount: 14,
      frondSegments: 8,
      lengthScale: 2.25,
      liftScale: 0.72,
      angleOffset: 0.12,
      centralShoots: 6,
      variant: 'broad-tree-fern-crown',
    }),
    createFernGeometry({
      frondCount: 11,
      frondSegments: 9,
      lengthScale: 2.48,
      liftScale: 1.02,
      angleOffset: 0.36,
      centralShoots: 4,
      variant: 'wind-broken-tree-fern-crown',
    }),
    createFernGeometry({
      frondCount: 17,
      frondSegments: 7,
      lengthScale: 1.88,
      liftScale: 0.56,
      angleOffset: -0.18,
      centralShoots: 7,
      variant: 'dense-low-tree-fern-crown',
    }),
  ],
  fernGeometries: [
    createFernGeometry({ variant: 'open-rosette' }),
    createFernGeometry({
      frondCount: 6,
      frondSegments: 7,
      lengthScale: 1.22,
      liftScale: 1.18,
      angleOffset: 0.21,
      centralShoots: 2,
      variant: 'upright-feather',
    }),
    createFernGeometry({
      frondCount: 10,
      frondSegments: 5,
      lengthScale: 0.94,
      liftScale: 0.62,
      angleOffset: -0.17,
      centralShoots: 4,
      variant: 'low-cycad',
    }),
  ],
  groundCoverGeometries: [
    createGroundCoverGeometry(0),
    createGroundCoverGeometry(1),
    createBroadleafGroundCoverGeometry(),
  ],
  leafDetailGeometry: createVolumetricLeafSprayGeometry(),
  canopyLeafGeometries: [
    createSupportedCanopyLeafGeometry('elliptic-waxy'),
    createSupportedCanopyLeafGeometry('compound-lanceolate'),
  ],
  trunkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    flatShading: false,
    dithering: true,
    envMapIntensity: 0.46,
    map: barkTextures.albedo,
    roughnessMap: barkTextures.roughness,
    bumpMap: barkTextures.height,
    bumpScale: 0.035,
  }),
  plateBarkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    flatShading: false,
    dithering: true,
    envMapIntensity: 0.34,
    map: plateBarkTextures.albedo,
    roughnessMap: plateBarkTextures.roughness,
    bumpMap: plateBarkTextures.height,
    bumpScale: 0.028,
  }),
  crownMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.84,
    flatShading: false,
    dithering: true,
    emissive: 0x07130d,
    emissiveIntensity: 0.025,
    envMapIntensity: 0.52,
  }),
  fernMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    side: THREE.DoubleSide,
    flatShading: false,
    envMapIntensity: 0.5,
  }),
  treeFernTrunkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.91,
    flatShading: false,
    envMapIntensity: 0.42,
    map: barkTextures.albedo,
    roughnessMap: barkTextures.roughness,
    bumpMap: barkTextures.height,
    bumpScale: 0.028,
  }),
  leafDetailMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 0.38,
  }),
  canopyLeafMaterials: [leafClusterTexture, compoundLeafClusterTexture].map((texture) => (
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      vertexColors: true,
      alphaTest: 0.34,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0,
      envMapIntensity: 0.24,
    })
  )),
};
applyThinLeafTransmission(shared.leafDetailMaterial, 'cover-volumetric-waxy');
shared.canopyLeafMaterials.forEach((material, index) => {
  material.userData.family = index === 0 ? 'elliptic-waxy' : 'compound-lanceolate';
  applyThinLeafTransmission(material, material.userData.family, true);
});

export {
  shared,
};
