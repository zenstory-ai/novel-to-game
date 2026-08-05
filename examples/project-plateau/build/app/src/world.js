import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  applyHy3dIguanodonPose,
  HY3D_IGUANODON_ASSET,
  upgradeIguanodonFamilyWithHy3d,
} from './hy3d-iguanodon.js';
import {
  applyHy3dPterodactylPose,
  HY3D_PTERODACTYL_ASSET,
  upgradePterodactylFlockWithHy3d,
} from './hy3d-pterodactyl.js';
import {
  attachHy3dFieldCameraVisual,
  HY3D_FIELD_CAMERA_ASSET,
  loadHy3dFieldCameraTemplate,
} from './hy3d-field-camera.js';
import {
  attachHy3dRifleVisual,
  HY3D_RIFLE_ASSET,
  loadHy3dRifleTemplate,
} from './hy3d-rifle.js';
import { createIguanodon } from './iguanodon.js';
import { createPterodactyl } from './pterodactyl.js';
import { PALETTE, SCENE_BUDGET, seededRandom } from './config.js';
import {
  BROOK_BOULDER,
  COVER_ARCH_LAYOUT,
  FAMILY_LAYOUT,
  FEEDING_BRANCH,
  FOREGROUND_FROND_LAYOUT,
  FORT_FIREPIT,
  FORT_TENT_LAYOUT,
  HABITAT_TREE_LAYOUT,
  VEGETATION_LAYOUT,
} from './environment-layout.js';
import {
  terrainHeight,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from './terrain.js';

export { terrainHeight } from './terrain.js';

function toNonIndexed(geometry) {
  if (!geometry.index) return geometry;
  const expanded = geometry.toNonIndexed();
  geometry.dispose();
  return expanded;
}

function mergeParts(parts) {
  const expanded = parts.map(toNonIndexed);
  expanded.forEach((part) => {
    for (const attribute of Object.keys(part.attributes)) {
      if (attribute !== 'position') part.deleteAttribute(attribute);
    }
  });
  const merged = mergeGeometries(expanded, false);
  expanded.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function transformGeometry(geometry, position, scale, rotation = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function createVerticalLoft(rings, radialSegments = 7) {
  const vertices = [];
  const indices = [];
  rings.forEach(([y, centreX, centreZ, radiusX, radiusZ, roll = 0]) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + roll;
      vertices.push(
        centreX + Math.cos(angle) * radiusX,
        y,
        centreZ + Math.sin(angle) * radiusZ,
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
  vertices.push(rings[0][1], rings[0][0], rings[0][2]);
  const topCentre = vertices.length / 3;
  const top = rings.at(-1);
  vertices.push(top[1], top[0], top[2]);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createCylinderBetween(start, end, startRadius, endRadius, radialSegments = 6) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const geometry = new THREE.CylinderGeometry(
    endRadius,
    startRadius,
    direction.length(),
    radialSegments,
    1,
    false,
  );
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    from.clone().addScaledVector(direction, 0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  ));
  return geometry;
}

function createPrehistoricTrunkGeometry() {
  const parts = [createVerticalLoft([
    [0, 0, 0, 0.68, 0.6],
    [0.7, 0.03, -0.04, 0.52, 0.48, 0.08],
    [2.3, -0.08, 0.1, 0.39, 0.35, -0.05],
    [4.2, 0.12, 0.04, 0.3, 0.27, 0.1],
    [5.8, 0.22, -0.1, 0.22, 0.2, -0.04],
  ], 7)];
  const roots = [0.1, 1.37, 2.66, 3.94, 5.2];
  roots.forEach((angle, index) => {
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.18, 0.2, Math.sin(angle) * 0.18],
      [Math.cos(angle) * (0.92 + (index % 2) * 0.18), 0.035, Math.sin(angle) * (0.92 + (index % 2) * 0.18)],
      0.31,
      0.075,
      5,
    ));
  });
  parts.push(
    createCylinderBetween([0.08, 4.35, 0.02], [1.28, 5.3, 0.34], 0.24, 0.09, 6),
    createCylinderBetween([0.02, 4.78, -0.04], [-0.92, 5.5, -0.5], 0.2, 0.075, 6),
    createCylinderBetween([0.16, 5.1, -0.08], [0.62, 5.82, -0.72], 0.16, 0.06, 5),
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
  geometry.userData.profile = 'buttressed-bent-branching';
  geometry.userData.surface = 'directional-bark-plane-variation';
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
    new THREE.DodecahedronGeometry(1, 0),
    position,
    scale,
    rotation,
  ));
  const geometry = mergeParts(parts);
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
  geometry.userData.surface = 'broken-canopy-plane-variation';
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
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.frondSegments = frondSegments;
  geometry.userData.variant = variant;
  geometry.userData.surface = 'ribbed-frond-color-break';
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
        new THREE.IcosahedronGeometry(1, 0),
        [Math.cos(angle) * radius * 0.52, y, Math.sin(angle) * radius * 0.52],
        [radius * 0.62, 0.16 + tierIndex * 0.015, 0.28],
        [0, -angle, (branch % 2 - 0.5) * 0.08],
      ));
    }
  });
  parts.push(transformGeometry(new THREE.DodecahedronGeometry(1, 0), [0, 2.36, 0], [0.42, 0.48, 0.42]));
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
  geometry.userData.surface = 'tiered-needle-plane-variation';
  return geometry;
}

function createTreeFernTrunkGeometry() {
  const parts = [createVerticalLoft([
      [0, 0, 0, 0.34, 0.32],
      [0.42, 0.02, -0.02, 0.31, 0.29, 0.08],
      [1.18, -0.025, 0.025, 0.285, 0.27, -0.06],
      [2.05, 0.035, -0.03, 0.25, 0.235, 0.1],
      [2.72, 0.055, 0.02, 0.21, 0.2, -0.04],
    ], 8)];
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
  geometry.userData.surface = 'alternating-leaf-scar-bands-with-buttress-roots';
  return geometry;
}

function createFracturedBasaltGeometry(radialSegments = 6) {
  const rings = [
    [-0.5, 1.05, 0, 0, 0.82],
    [-0.22, 1, 0.025, -0.018, 0.96],
    [-0.18, 1.035, 0.005, 0.012, 0.72],
    [0.08, 0.99, -0.018, 0.025, 0.94],
    [0.12, 1.025, 0.012, 0.005, 0.7],
    [0.34, 0.98, 0.025, -0.01, 0.93],
    [0.5, 0.95, 0, 0, 0.88],
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
  geometry.userData.fractureRings = rings.length;
  geometry.userData.irregularTop = true;
  geometry.userData.profile = 'fractured-tapered-column';
  return geometry;
}

function createSoilDetailTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = seededRandom(621);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wave = (
        Math.sin(x * 0.17)
        + Math.sin(y * 0.13)
        + Math.sin((x + y) * 0.061)
        + Math.sin(Math.hypot(x - 34, y - 82) * 0.12)
      ) * 0.25;
      const value = THREE.MathUtils.clamp(0.84 + wave * 0.14 + (random() - 0.5) * 0.07, 0.66, 0.99);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(value * 255);
      data[offset + 1] = Math.round(value * 0.98 * 255);
      data[offset + 2] = Math.round(value * 0.89 * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.soil-macro-detail';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 17);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createWaterDetailTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = seededRandom(733);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const longRipple = Math.sin(y * 0.42 + Math.sin(x * 0.12) * 2.4) * 0.5;
      const crossRipple = Math.sin(x * 0.23 - y * 0.1) * 0.24;
      const value = THREE.MathUtils.clamp(
        0.52 + longRipple * 0.2 + crossRipple * 0.12 + (random() - 0.5) * 0.05,
        0.24,
        0.82,
      );
      const offset = (y * size + x) * 4;
      const byte = Math.round(value * 255);
      data[offset] = byte;
      data[offset + 1] = byte;
      data[offset + 2] = byte;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.brook-ripple-detail';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 18);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createBasaltDetailTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = seededRandom(1297);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const verticalFracture = Math.abs(Math.sin(x * 0.19 + Math.sin(y * 0.08) * 1.8));
      const mineralBand = Math.sin(y * 0.31 + x * 0.045) * 0.5
        + Math.sin(y * 0.095 - x * 0.12) * 0.24;
      const crack = verticalFracture > 0.965 ? -0.22 : 0;
      const value = THREE.MathUtils.clamp(
        0.76 + mineralBand * 0.13 + crack + (random() - 0.5) * 0.075,
        0.38,
        0.98,
      );
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(value * 255);
      data[offset + 1] = Math.round(value * 0.94 * 255);
      data[offset + 2] = Math.round(value * 0.88 * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.basalt-mineral-fracture-detail';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 6.5);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const shared = {
  trunkGeometry: createPrehistoricTrunkGeometry(),
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
  trunkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    flatShading: true,
    dithering: true,
  }),
  crownMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.91,
    flatShading: true,
    dithering: true,
  }),
  fernMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    side: THREE.DoubleSide,
    flatShading: true,
  }),
  treeFernTrunkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.96,
    flatShading: true,
  }),
};

const GLADE_SIGHTLINE_HALF_WIDTH = 22;
const soilDetailTexture = createSoilDetailTexture();
const waterDetailTexture = createWaterDetailTexture();
const basaltDetailTexture = createBasaltDetailTexture();
const TRACK_IMPRESSION = Object.freeze({
  x: -1.65,
  z: 35.75,
  rotation: 0.44,
  scale: 2.08,
});

export function pterodactylAttackPose(attackSeconds = 0, reducedMotion = false) {
  const clock = Math.max(0, Number.isFinite(attackSeconds) ? attackSeconds : 0);
  // The threat must already be crossing the exposed corridor when the player
  // reaches for the rifle. Delaying all approach motion until 0.34 s left the
  // first defensive read as a distant bird in empty sky.
  const rawApproach = THREE.MathUtils.clamp((clock - 0.18) / 0.74, 0, 1);
  const easedApproach = rawApproach * rawApproach * (3 - 2 * rawApproach);
  const rawRecovery = THREE.MathUtils.clamp((clock - 2.24) / (3.05 - 2.24), 0, 1);
  const recovery = rawRecovery * rawRecovery * (3 - 2 * rawRecovery);
  const attackEnvelope = easedApproach * (1 - recovery);
  const approach = reducedMotion ? attackEnvelope * 0.38 : attackEnvelope;
  const rawFlightProgress = THREE.MathUtils.clamp((clock - 0.12) / 1.4, 0, 1);
  const easedFlightProgress = rawFlightProgress * rawFlightProgress * (3 - 2 * rawFlightProgress);
  const stage = clock < 0.5
    ? 'search'
    : clock < 0.92 ? 'fold-dive' : clock < 2.24 ? 'attack' : 'pull-up';
  return {
    stage,
    approach,
    recovery,
    flightProgress: reducedMotion ? easedFlightProgress * 0.38 : easedFlightProgress,
    wingFold: THREE.MathUtils.clamp(0.08 + approach * 0.74, 0, 0.82),
    pitch: THREE.MathUtils.lerp(0.06 + approach * 0.5, -0.2, recovery),
  };
}

export function pterodactylWingBeat(elapsed, phase = 0, awareness = 0, reducedMotion = false) {
  const tempo = reducedMotion ? 0.72 : 4.15 + awareness * 0.38;
  const cycle = elapsed * tempo + phase;
  const sine = Math.sin(cycle);
  const asymmetricStroke = sine >= 0
    ? sine ** 0.72
    : -((-sine) ** 1.28);
  return asymmetricStroke * (reducedMotion ? 0.045 : 0.29 + awareness * 0.035);
}

const PTERODACTYL_LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const PTERODACTYL_WORLD_UP = new THREE.Vector3(0, 1, 0);
const PTERODACTYL_ORBIT_CENTER = Object.freeze({ x: 0, z: -9 });
const THREAT_TRANSITION_SECONDS = 0.55;
export const PTERODACTYL_ATTACK_CYCLE_SECONDS = 4.4;

function alignPterodactylToTravel(mesh, velocity, roll = 0) {
  if (velocity.lengthSq() <= 1e-10) return;
  const direction = velocity.clone().normalize();
  const localZInWorld = direction.clone().negate();
  const referenceUp = Math.abs(direction.dot(PTERODACTYL_WORLD_UP)) > 0.98
    ? new THREE.Vector3(0, 0, 1)
    : PTERODACTYL_WORLD_UP;
  const localXInWorld = referenceUp.clone().cross(localZInWorld).normalize();
  const localYInWorld = localZInWorld.clone().cross(localXInWorld).normalize();
  const rotationBasis = new THREE.Matrix4().makeBasis(
    localXInWorld,
    localYInWorld,
    localZInWorld,
  );
  mesh.quaternion.setFromRotationMatrix(rotationBasis);
  mesh.rotateZ(roll);
  mesh.userData.flightDirection = direction;
}

function cubicBezierPoint(start, controlA, controlB, end, progress) {
  const inverse = 1 - progress;
  return new THREE.Vector3(
    inverse ** 3 * start.x
      + 3 * inverse ** 2 * progress * controlA.x
      + 3 * inverse * progress ** 2 * controlB.x
      + progress ** 3 * end.x,
    inverse ** 3 * start.y
      + 3 * inverse ** 2 * progress * controlA.y
      + 3 * inverse * progress ** 2 * controlB.y
      + progress ** 3 * end.y,
    inverse ** 3 * start.z
      + 3 * inverse ** 2 * progress * controlA.z
      + 3 * inverse * progress ** 2 * controlB.z
      + progress ** 3 * end.z,
  );
}

export function pterodactylAttackFlightState({
  attackClock,
  attackOrigin,
  playerPosition,
  reducedMotion,
}) {
  const finiteClock = Number.isFinite(attackClock) ? attackClock : 0;
  const cycleClock = ((finiteClock % PTERODACTYL_ATTACK_CYCLE_SECONDS)
    + PTERODACTYL_ATTACK_CYCLE_SECONDS) % PTERODACTYL_ATTACK_CYCLE_SECONDS;
  const pose = pterodactylAttackPose(cycleClock, reducedMotion);
  const approach = pose.approach;
  const flightProgress = pose.flightProgress;
  const diveStart = new THREE.Vector3(-4.6, 10.4, -24);
  const diveControlA = new THREE.Vector3(-4.05, 10.05, -20);
  const diveControlB = new THREE.Vector3(-3.15, 7.45, -13.5);
  const diveEnd = new THREE.Vector3(-2.6, 6.5, -9.8);
  const divePosition = cubicBezierPoint(
    diveStart,
    diveControlA,
    diveControlB,
    diveEnd,
    flightProgress,
  );
  const recoveryProgress = pose.recovery;
  const recoveryPosition = cubicBezierPoint(
    diveEnd,
    new THREE.Vector3(-1.9, 6.55, -7.3),
    new THREE.Vector3(2.8, 9.2, -3.2),
    new THREE.Vector3(7.5, 12.2, 1.4),
    recoveryProgress,
  );
  const attackPosition = divePosition.lerp(recoveryPosition, recoveryProgress);
  // The visual-review cycle continues through a wide, high return arc and
  // meets the next dive at the same point and tangent. The former 3.2-second
  // modulo jumped directly from recoveryEnd to diveStart by ~28 world units.
  const returnProgress = THREE.MathUtils.smoothstep(
    cycleClock,
    3.05,
    PTERODACTYL_ATTACK_CYCLE_SECONDS,
  );
  const returnPosition = cubicBezierPoint(
    new THREE.Vector3(7.5, 12.2, 1.4),
    new THREE.Vector3(9.85, 13.7, 3.7),
    new THREE.Vector3(-5.15, 10.75, -28),
    diveStart,
    returnProgress,
  );
  const authoredPosition = cycleClock > 3.05 ? returnPosition : attackPosition;
  // `playerPosition` remains as a compatibility alias for authored/test
  // callers. The live world passes a position latched once when the attack
  // begins; it must never pass the player's continuously changing position.
  const origin = attackOrigin ?? playerPosition ?? { x: 0, z: 0 };
  return {
    pose,
    approach,
    position: authoredPosition.add(new THREE.Vector3(
      origin.x,
      0,
      origin.z,
    )),
  };
}

function terrainColorAt(x, z) {
  const drySoil = new THREE.Color(0x5f583f);
  const mossSoil = new THREE.Color(0x354d38);
  const exposedSoil = new THREE.Color(0x756548);
  const wetSoil = new THREE.Color(0x183b3b);
  const variation = terrainVariation(x, z);
  const wetness = terrainWetness(x, z);
  const slope = terrainSlope(x, z);
  const height = terrainHeight(x, z);
  const gladeDistance = Math.hypot((x - 1) / 28, (z + 30) / 38);
  const gladeSunWeight = 1 - THREE.MathUtils.smoothstep(gladeDistance, 0.34, 0.96);
  const exposure = THREE.MathUtils.clamp((height + 2.1) / 5.4, 0, 1);
  const mossWeight = THREE.MathUtils.clamp(
    0.4 + variation * 0.32 + (1 - exposure) * 0.24 - slope * 0.7,
    0.08,
    0.82,
  );
  const exposedWeight = THREE.MathUtils.clamp(exposure * 0.5 + slope * 1.2, 0, 0.62);
  const color = drySoil
    .lerp(mossSoil, mossWeight)
    .lerp(exposedSoil, exposedWeight)
    .lerp(wetSoil, wetness * 0.82);
  color.offsetHSL(0, 0, variation * 0.045);
  color.offsetHSL(0.012 * gladeSunWeight, -0.035 * gladeSunWeight, 0.11 * gladeSunWeight);
  return color;
}

function trackLocalCoordinates(worldX, worldZ) {
  const dx = worldX - TRACK_IMPRESSION.x;
  const dz = worldZ - TRACK_IMPRESSION.z;
  const cosine = Math.cos(TRACK_IMPRESSION.rotation);
  const sine = Math.sin(TRACK_IMPRESSION.rotation);
  return {
    x: (cosine * dx - sine * dz) / TRACK_IMPRESSION.scale,
    z: (sine * dx + cosine * dz) / TRACK_IMPRESSION.scale,
  };
}

function trackWorldCoordinates(localX, localZ) {
  const cosine = Math.cos(TRACK_IMPRESSION.rotation);
  const sine = Math.sin(TRACK_IMPRESSION.rotation);
  return {
    x: TRACK_IMPRESSION.x + (cosine * localX + sine * localZ) * TRACK_IMPRESSION.scale,
    z: TRACK_IMPRESSION.z + (-sine * localX + cosine * localZ) * TRACK_IMPRESSION.scale,
  };
}

function trackSubsurfaceClearance(worldX, worldZ) {
  const local = trackLocalCoordinates(worldX, worldZ);
  const radialDistance = Math.hypot(local.x / 1.14, (local.z + 0.4) / 1.52);
  const concealedInterior = 1 - THREE.MathUtils.smoothstep(radialDistance, 0.58, 0.78);
  return -concealedInterior * 0.24;
}

function makeTerrain(scene) {
  const widthSegments = 96;
  const heightSegments = 112;
  const geometry = new THREE.PlaneGeometry(180, 210, widthSegments, heightSegments);
  const positions = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    positions.setZ(i, terrainHeight(x, z) + trackSubsurfaceClearance(x, z));
    const color = terrainColorAt(x, z);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.trackSubsurfaceClearance = 'concealed-cutaway-under-impression';
  geometry.userData.profile = 'warped-multiscale-heightfield';
  geometry.userData.widthSegments = widthSegments;
  geometry.userData.heightSegments = heightSegments;
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: soilDetailTexture,
    roughnessMap: soilDetailTexture,
    bumpMap: soilDetailTexture,
    bumpScale: 0.09,
    roughness: 1,
    metalness: 0,
  });
  material.userData.surface = 'slope-wetness-exposure-vertex-palette';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'world.connected_route.terrain';
  scene.add(mesh);
  return mesh;
}

function makeRibbon(points, width, color, yOffset = 0) {
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    const px = -dz / length;
    const pz = dx / length;
    const widthBreak = 0.9
      + Math.sin(i * 1.71 + points.length * 0.13) * 0.08
      + Math.sin(i * 0.63 + 1.4) * 0.045;
    const half = width * widthBreak * 0.5;
    const offsets = [half * 1.08, half * 0.82, -half * 0.82, -half * 1.08];
    const alphas = [0, 1, 1, 0];
    const progress = points.length > 1 ? i / (points.length - 1) : 0;
    offsets.forEach((offset, crossIndex) => {
      const x = current.x + px * offset;
      const z = current.z + pz * offset;
      vertices.push(x, terrainHeight(x, z) + yOffset, z);
      colors.push(1, 1, 1, alphas[crossIndex]);
      uvs.push(crossIndex / 3, progress);
    });
    if (i < points.length - 1) {
      const currentOffset = i * 4;
      const nextOffset = (i + 1) * 4;
      for (let band = 0; band < 3; band += 1) {
        const a = currentOffset + band;
        const b = currentOffset + band + 1;
        const c = nextOffset + band;
        const d = nextOffset + band + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.yOffset = yOffset;
  geometry.userData.profile = 'terrain-conforming-feathered-ribbon';
  geometry.userData.crossSectionVertices = 4;
  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ribbon.receiveShadow = true;
  return ribbon;
}

function smoothPath(points, divisionsPerSpan = 7) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  return curve.getSpacedPoints(Math.max(12, (points.length - 1) * divisionsPerSpan));
}

function offsetPath(points, distance) {
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const direction = after.clone().sub(before).setY(0).normalize();
    return point.clone().add(new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(distance));
  });
}

function createDriftwoodGeometry(variant = 0) {
  const layouts = [
    [
      [[-1.35, 0, 0], [1.3, 0.08, 0.12], 0.17, 0.105],
      [[-0.42, 0.025, 0], [-0.86, 0.44, -0.28], 0.085, 0.026],
      [[0.18, 0.05, 0.04], [0.66, 0.5, 0.36], 0.095, 0.03],
      [[0.82, 0.07, 0.08], [1.08, 0.34, -0.24], 0.065, 0.022],
    ],
    [
      [[-1.18, 0.03, -0.08], [1.42, 0.13, -0.02], 0.145, 0.08],
      [[-0.68, 0.05, -0.05], [-0.28, 0.58, 0.24], 0.075, 0.022],
      [[0.46, 0.1, -0.02], [0.92, 0.36, -0.42], 0.082, 0.025],
    ],
    [
      [[-1.46, 0.02, 0.08], [1.16, 0.18, -0.16], 0.19, 0.115],
      [[-0.88, 0.06, 0.03], [-1.18, 0.31, 0.43], 0.09, 0.028],
      [[-0.08, 0.1, -0.02], [0.18, 0.63, -0.18], 0.11, 0.035],
      [[0.62, 0.15, -0.1], [0.94, 0.47, 0.22], 0.072, 0.024],
    ],
  ];
  const geometry = mergeParts(layouts[variant % layouts.length].map(([
    start, end, startRadius, endRadius,
  ]) => createCylinderBetween(start, end, startRadius, endRadius, variant === 1 ? 6 : 7)));
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const barkBreak = Math.sin(x * 8.4 + y * 15.7 - z * 5.2) * 0.13;
    const shade = THREE.MathUtils.clamp(0.76 + barkBreak, 0.54, 0.95);
    colors.push(shade, shade * 0.88, shade * 0.7);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = 'branched-bank-driftwood';
  geometry.userData.variant = `weathered-form-${variant + 1}`;
  geometry.userData.surface = 'broken-bark-color-banding';
  return geometry;
}

function distanceToTaperedTrackSegment(
  x,
  z,
  startX,
  startZ,
  endX,
  endZ,
  baseRadius,
  tipRadius,
) {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const projection = THREE.MathUtils.clamp(
    ((x - startX) * segmentX + (z - startZ) * segmentZ) / lengthSquared,
    0,
    1,
  );
  const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, projection);
  return Math.hypot(
    x - (startX + segmentX * projection),
    z - (startZ + segmentZ * projection),
  ) - radius;
}

function trackImpressionFields(x, z) {
  const pad = (Math.hypot((x - 0.045) / 0.35, (z - 0.11) / 0.27) - 1) * 0.27;
  const metatarsalBridge = (Math.hypot((x + 0.025) / 0.43, (z + 0.19) / 0.36) - 1) * 0.34;
  const centreToe = distanceToTaperedTrackSegment(
    x, z, 0.015, -0.14, -0.055, -1.42, 0.22, 0.125,
  );
  const leftToe = distanceToTaperedTrackSegment(
    x, z, -0.105, -0.11, -0.74, -0.99, 0.215, 0.135,
  );
  const rightToe = distanceToTaperedTrackSegment(
    x, z, 0.11, -0.1, 0.64, -0.86, 0.205, 0.145,
  );
  return {
    pad,
    bridge: metatarsalBridge,
    centreToe,
    leftToe,
    rightToe,
  };
}

function trackImpressionDistance(x, z) {
  return Math.min(...Object.values(trackImpressionFields(x, z)));
}

function trackPressureAt(x, z) {
  const spots = [
    [0, -1.35, 0.22, 1],
    [-0.67, -0.9, 0.24, 0.78],
    [0.67, -0.9, 0.24, 0.78],
    [0, 0.12, 0.34, 0.52],
  ];
  return THREE.MathUtils.clamp(spots.reduce((total, [spotX, spotZ, spread, weight]) => {
    const distanceSquared = (x - spotX) ** 2 + (z - spotZ) ** 2;
    return total + Math.exp(-distanceSquared / (spread * spread)) * weight;
  }, 0), 0, 1);
}

function createTrackMudImpressionGeometry() {
  const radialRings = 32;
  const segments = 96;
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const pressedMud = new THREE.Color(0x07191a);
  const compressedRim = new THREE.Color(0xb29c6c);
  const standingWater = new THREE.Color(0x4c6964);

  function writeVertex(localX, localZ, normalizedRadius) {
    const world = trackWorldCoordinates(localX, localZ);
    const fields = trackImpressionFields(localX, localZ);
    const edgeNoise = Math.sin(localX * 19.4 + localZ * 11.7) * 0.009
      + Math.sin(localX * 8.2 - localZ * 23.1) * 0.006;
    const distance = Math.min(...Object.values(fields)) + edgeNoise;
    const inside = 1 - THREE.MathUtils.smoothstep(distance, -0.025, 0.065);
    const compression = (field) => 1 - THREE.MathUtils.smoothstep(field, -0.02, 0.055);
    const centreCompression = compression(fields.centreToe);
    const leftCompression = compression(fields.leftToe) * 0.86;
    const rightCompression = compression(fields.rightToe) * 0.7;
    const toeCompression = Math.max(centreCompression, leftCompression, rightCompression);
    const padCompression = Math.max(compression(fields.pad), compression(fields.bridge) * 0.72);
    const rawRim = Math.exp(-((distance / 0.03) ** 2));
    const collapsedEdge = THREE.MathUtils.clamp(
      0.68
        + Math.sin(localX * 13.8 - localZ * 8.5) * 0.24
        - Math.exp(-(((localX - 0.53) / 0.2) ** 2 + ((localZ + 0.69) / 0.24) ** 2)) * 0.52,
      0.12,
      1,
    );
    const rim = rawRim * collapsedEdge;
    const pressure = trackPressureAt(localX, localZ);
    const depression = inside * 0.018
      + padCompression * 0.018
      + centreCompression * (0.037 + pressure * 0.03)
      + leftCompression * 0.019
      + rightCompression * 0.012;
    const rimLift = rim * 0.015;
    const mottle = Math.sin(localX * 9.3 + localZ * 6.7) * 0.0015
      * (1 - normalizedRadius);
    vertices.push(
      world.x,
      terrainHeight(world.x, world.z) + 0.012 - depression + rimLift + mottle,
      world.z,
    );

    const wetCompression = THREE.MathUtils.clamp(
      inside * 0.4 + padCompression * 0.28 + toeCompression * 0.78,
      0,
      0.96,
    );
    const color = terrainColorAt(world.x, world.z).lerp(pressedMud, wetCompression);
    const puddle = THREE.MathUtils.clamp(
      Math.exp(-(((localX + 0.12) / 0.28) ** 2 + ((localZ + 0.46) / 0.46) ** 2))
        * inside * (0.35 + pressure * 0.5),
      0,
      0.38,
    );
    color.lerp(standingWater, puddle);
    color.lerp(compressedRim, rim * 0.58);
    color.offsetHSL(0, 0, Math.sin(localX * 7.1 - localZ * 8.3) * 0.008);
    const alpha = 1 - THREE.MathUtils.smoothstep(normalizedRadius, 0.82, 1);
    colors.push(color.r, color.g, color.b, alpha);
    uvs.push(localX / 2.4 + 0.5, (localZ + 0.4) / 3.1 + 0.5);
  }

  writeVertex(0, -0.4, 0);
  for (let ring = 1; ring <= radialRings; ring += 1) {
    const normalizedRadius = ring / radialRings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const irregularity = 1 + (
        Math.sin(angle * 5 + 0.8) * 0.025
        + Math.sin(angle * 9 - 0.35) * 0.014
      ) * normalizedRadius;
      writeVertex(
        Math.cos(angle) * 1.14 * normalizedRadius * irregularity,
        -0.4 + Math.sin(angle) * 1.52 * normalizedRadius * irregularity,
        normalizedRadius,
      );
    }
  }

  const ringIndex = (ring, segment) => 1 + (ring - 1) * segments + ((segment + segments) % segments);
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, ringIndex(1, segment + 1), ringIndex(1, segment));
  }
  for (let ring = 1; ring < radialRings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const inner = ringIndex(ring, segment);
      const innerNext = ringIndex(ring, segment + 1);
      const outer = ringIndex(ring + 1, segment);
      const outerNext = ringIndex(ring + 1, segment + 1);
      indices.push(inner, innerNext, outer, innerNext, outerNext, outer);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'deformed-tridactyl-mud-impression';
  geometry.userData.toeCount = 3;
  geometry.userData.longestToe = 'centre';
  geometry.userData.tipProfile = 'rounded-pressure-spread';
  geometry.userData.edgeProfile = 'asymmetric-collapsed-wet-mud';
  geometry.userData.softEdge = true;
  geometry.userData.toeTipDepthVariation = true;
  geometry.userData.physicalRelief = true;
  geometry.userData.terrainCutaway = true;
  geometry.userData.edgeAlpha = true;
  geometry.userData.reliefDepthMeters = 0.104;
  return geometry;
}

function makeThreeToedTrack(scene) {
  const group = new THREE.Group();
  const trackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    roughnessMap: soilDetailTexture,
    bumpMap: soilDetailTexture,
    bumpScale: 0.006,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.54,
    flatShading: false,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const impression = primitive(
    trackMaterial,
    createTrackMudImpressionGeometry(),
    [0, 0, 0],
    [1, 1, 1],
  );
  impression.name = 'world.track.deformed-three-toed-impression';
  impression.userData.contactShape = 'terrain-deformed-tridactyl-print';
  impression.castShadow = false;
  impression.receiveShadow = true;
  impression.renderOrder = 1;
  group.add(impression);
  const clodCount = 13;
  const clods = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x3b4234, roughness: 0.98, flatShading: true }),
    clodCount,
  );
  const clodLocalAnchors = [
    [-0.48, 0.18], [0.46, 0.22], [-0.62, -0.28], [0.57, -0.34],
    [-0.86, -0.72], [-0.52, -1.03], [-0.18, -1.48], [0.2, -1.37],
    [0.56, -0.93], [0.74, -0.66], [-0.28, 0.42], [0.17, 0.4], [0.72, -0.12],
  ];
  const clodRandom = seededRandom(2057);
  const clodDummy = new THREE.Object3D();
  clodLocalAnchors.forEach(([localX, localZ], index) => {
    const world = trackWorldCoordinates(
      localX + (clodRandom() - 0.5) * 0.1,
      localZ + (clodRandom() - 0.5) * 0.1,
    );
    const scale = 0.065 + clodRandom() * 0.095;
    clodDummy.position.set(world.x, terrainHeight(world.x, world.z) + scale * 0.28, world.z);
    clodDummy.rotation.set(clodRandom() * 0.8, clodRandom() * Math.PI, clodRandom() * 0.45);
    clodDummy.scale.set(scale * (1.05 + clodRandom() * 0.7), scale * 0.42, scale);
    clodDummy.updateMatrix();
    clods.setMatrixAt(index, clodDummy.matrix);
  });
  clods.name = 'world.track.displaced-mud-clods';
  clods.castShadow = true;
  clods.receiveShadow = true;
  clods.userData.profile = 'irregular-perimeter-displacement';
  group.add(clods);
  // Keep the print inside the opening field of view without turning it into a
  // UI-sized emblem. Its asymmetric toe pressure must carry the first read.
  group.userData.worldAnchor = {
    x: TRACK_IMPRESSION.x,
    z: TRACK_IMPRESSION.z,
    rotation: TRACK_IMPRESSION.rotation,
    scale: TRACK_IMPRESSION.scale,
  };
  group.name = 'world.connected_route.three-toed-track';
  group.userData.firstRead = 'three-toed-print';
  group.userData.openingSightline = true;
  scene.add(group);
  return group;
}

function makeRouteAndBrook(scene) {
  const brookControlPoints = [
    [-14, 88], [-11, 69], [-16, 51], [-10, 33], [-13, 15], [-7, -4],
    [-12, -22], [-8, -39], [-15, -58], [-11, -78],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const brookPoints = smoothPath(brookControlPoints, 8);
  const brookBank = makeRibbon(brookPoints, 6.8, 0x35443a, 0.07);
  brookBank.material.roughness = 0.98;
  brookBank.material.metalness = 0;
  brookBank.material.opacity = 0.72;
  brookBank.material.map = soilDetailTexture;
  brookBank.material.roughnessMap = soilDetailTexture;
  brookBank.material.bumpMap = soilDetailTexture;
  brookBank.material.bumpScale = 0.035;
  brookBank.material.userData.surface = 'feathered-wet-bank-transition';
  brookBank.name = 'world.connected_route.brook-wet-bank';
  const brook = makeRibbon(brookPoints, 3.4, PALETTE.water, 0.12);
  brook.material.dispose();
  brook.material = new THREE.MeshPhysicalMaterial({
    color: 0x47757b,
    map: waterDetailTexture,
    roughness: 0.48,
    roughnessMap: waterDetailTexture,
    bumpMap: waterDetailTexture,
    bumpScale: 0.075,
    metalness: 0,
    ior: 1.33,
    specularIntensity: 0.06,
    specularColor: new THREE.Color(0x8da7a0),
    clearcoat: 0.08,
    clearcoatRoughness: 0.48,
    transparent: true,
    opacity: 0.74,
    vertexColors: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: 0x0a1817,
    emissiveIntensity: 0.03,
  });
  brook.material.userData.surface = 'procedural-ripple-microdetail';
  brook.material.userData.motion = 'animated-downstream-uv-flow';
  brook.name = 'world.connected_route.brook';
  const leftWetEdge = makeRibbon(offsetPath(brookPoints, 1.92), 0.62, 0x253a34, 0.095);
  const rightWetEdge = makeRibbon(offsetPath(brookPoints, -1.92), 0.58, 0x2d4037, 0.095);
  for (const [edge, side] of [[leftWetEdge, 'left'], [rightWetEdge, 'right']]) {
    edge.material.opacity = 0.68;
    edge.material.roughness = 0.98;
    edge.material.metalness = 0;
    edge.material.map = soilDetailTexture;
    edge.material.roughnessMap = soilDetailTexture;
    edge.material.bumpMap = soilDetailTexture;
    edge.material.bumpScale = 0.04;
    edge.material.userData.surface = 'collapsed-saturated-brook-edge';
    edge.name = `world.connected_route.brook-${side}-wet-edge`;
  }
  scene.add(brookBank, leftWetEdge, rightWetEdge, brook);

  const rippleGeometry = new THREE.TorusGeometry(0.72, 0.012, 4, 24, Math.PI * 1.15);
  rippleGeometry.rotateX(Math.PI / 2);
  const brookRipples = new THREE.InstancedMesh(
    rippleGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x739a97,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    }),
    48,
  );
  const rippleRandom = seededRandom(913);
  const rippleDummy = new THREE.Object3D();
  for (let index = 0; index < 48; index += 1) {
    const segment = index % (brookPoints.length - 1);
    const t = 0.12 + rippleRandom() * 0.76;
    const point = brookPoints[segment].clone().lerp(brookPoints[segment + 1], t);
    const direction = brookPoints[segment + 1].clone().sub(brookPoints[segment]);
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    point.addScaledVector(tangent, (rippleRandom() - 0.5) * 0.72);
    rippleDummy.position.set(
      point.x,
      terrainHeight(point.x, point.z) + 0.162,
      point.z,
    );
    rippleDummy.rotation.set(0, Math.atan2(-tangent.z, tangent.x), 0);
    rippleDummy.scale.set(0.9 + rippleRandom() * 1.1, 1, 0.34 + rippleRandom() * 0.24);
    rippleDummy.updateMatrix();
    brookRipples.setMatrixAt(index, rippleDummy.matrix);
  }
  brookRipples.name = 'world.connected_route.brook-ripples';
  brookRipples.frustumCulled = false;
  scene.add(brookRipples);

  const brookStoneCount = 56;
  const brookStones = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true }),
    brookStoneCount,
  );
  const random = seededRandom(482);
  const dummy = new THREE.Object3D();
  const stoneColor = new THREE.Color();
  for (let index = 0; index < brookStoneCount; index += 1) {
    const segment = Math.min(brookPoints.length - 2, Math.floor(random() * (brookPoints.length - 1)));
    const t = random();
    const point = brookPoints[segment].clone().lerp(brookPoints[segment + 1], t);
    const direction = brookPoints[segment + 1].clone().sub(brookPoints[segment]);
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    point.addScaledVector(tangent, (random() - 0.5) * 4.6);
    const scale = 0.12 + random() * 0.32;
    dummy.position.set(point.x, terrainHeight(point.x, point.z) + 0.1 + scale * 0.12, point.z);
    dummy.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.2);
    dummy.scale.set(scale * (0.8 + random() * 0.6), scale * 0.38, scale);
    dummy.updateMatrix();
    brookStones.setMatrixAt(index, dummy.matrix);
    stoneColor.setHSL(0.41 + random() * 0.035, 0.06 + random() * 0.06, 0.2 + random() * 0.085);
    brookStones.setColorAt(index, stoneColor);
  }
  brookStones.name = 'world.connected_route.brook-stones';
  brookStones.castShadow = true;
  brookStones.receiveShadow = true;
  scene.add(brookStones);

  const driftwoodCount = 10;
  const driftwoodMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.97,
    flatShading: true,
  });
  const driftwoodCounts = [4, 3, 3];
  const driftwoodMeshes = driftwoodCounts.map((count, variant) => (
    new THREE.InstancedMesh(createDriftwoodGeometry(variant), driftwoodMaterial, count)
  ));
  const driftwoodIndices = [0, 0, 0];
  const driftwoodColor = new THREE.Color();
  const driftwoodRandom = seededRandom(1169);
  for (let index = 0; index < driftwoodCount; index += 1) {
    let segment;
    let point;
    do {
      segment = 4 + Math.floor(driftwoodRandom() * (brookPoints.length - 9));
      point = brookPoints[segment].clone();
    } while (Math.hypot(point.x - TRACK_IMPRESSION.x, point.z - TRACK_IMPRESSION.z) < 6.5);
    const before = brookPoints[Math.max(0, segment - 1)];
    const after = brookPoints[Math.min(brookPoints.length - 1, segment + 1)];
    const direction = after.clone().sub(before).setY(0).normalize();
    const side = index % 2 ? -1 : 1;
    const lateral = new THREE.Vector3(-direction.z, 0, direction.x)
      .multiplyScalar(side * (2.15 + driftwoodRandom() * 0.85));
    point.add(lateral);
    dummy.position.set(point.x, terrainHeight(point.x, point.z) + 0.12, point.z);
    dummy.rotation.set(
      (driftwoodRandom() - 0.5) * 0.2,
      Math.atan2(direction.z, direction.x) + (driftwoodRandom() - 0.5) * 0.75,
      (driftwoodRandom() - 0.5) * 0.12,
    );
    const scale = 0.72 + driftwoodRandom() * 0.58;
    dummy.scale.set(
      scale * (0.85 + driftwoodRandom() * 0.34),
      scale * (0.76 + driftwoodRandom() * 0.42),
      scale * (0.82 + driftwoodRandom() * 0.4),
    );
    dummy.updateMatrix();
    const variant = index % driftwoodMeshes.length;
    const driftwood = driftwoodMeshes[variant];
    const instanceIndex = driftwoodIndices[variant];
    driftwood.setMatrixAt(instanceIndex, dummy.matrix);
    driftwoodColor.setHSL(
      0.075 + driftwoodRandom() * 0.035,
      0.2 + driftwoodRandom() * 0.12,
      0.18 + driftwoodRandom() * 0.075,
    );
    driftwood.setColorAt(instanceIndex, driftwoodColor);
    driftwoodIndices[variant] += 1;
  }
  driftwoodMeshes.forEach((driftwood, index) => {
    driftwood.name = index === 0
      ? 'world.connected_route.brook-driftwood'
      : `world.connected_route.brook-driftwood-variant-${index + 1}`;
    driftwood.castShadow = true;
    driftwood.receiveShadow = true;
  });
  scene.add(...driftwoodMeshes);
  makeThreeToedTrack(scene);

  const routePoints = smoothPath([
    [3, 88], [4, 67], [0, 50], [8, 31], [11, 12], [4, -8], [10, -31], [3, -54],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), 7);
  const route = makeRibbon(routePoints, 4.8, 0x655f48, 0.055);
  route.material.opacity = 0.46;
  route.material.roughness = 0.94;
  route.material.metalness = 0;
  route.material.map = soilDetailTexture;
  route.material.bumpMap = soilDetailTexture;
  route.material.bumpScale = 0.024;
  route.material.userData.surface = 'worn-soil-route-not-color-strip';
  route.name = 'world.connected_route.track';
  const canopyFork = makeRibbon(smoothPath([
    [5, 35], [-4, 25], [-12, 13], [-10, 1], [0, -13],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), 7), 3.7, 0x485342, 0.07);
  canopyFork.material.opacity = 0.48;
  canopyFork.material.roughness = 0.96;
  canopyFork.material.metalness = 0;
  canopyFork.material.map = soilDetailTexture;
  canopyFork.material.bumpMap = soilDetailTexture;
  canopyFork.material.bumpScale = 0.022;
  canopyFork.name = 'world.connected_route.covered_fork';
  const basaltFork = makeRibbon(smoothPath([
    [5, 35], [13, 25], [20, 13], [18, 0], [7, -14],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), 7), 4.2, 0x705a45, 0.075);
  basaltFork.material.opacity = 0.5;
  basaltFork.material.roughness = 0.9;
  basaltFork.material.metalness = 0;
  basaltFork.material.map = soilDetailTexture;
  basaltFork.material.bumpMap = soilDetailTexture;
  basaltFork.material.bumpScale = 0.02;
  basaltFork.name = 'world.connected_route.exposed_fork';
  scene.add(route, canopyFork, basaltFork);
  return {
    brook,
    brookBank,
    leftWetEdge,
    rightWetEdge,
    driftwood: driftwoodMeshes,
    brookRipples,
    route,
    canopyFork,
    basaltFork,
  };
}

function createOrganicArchGeometry(spread, index) {
  const sway = (index % 2 ? 1 : -1) * 0.18;
  const points = [
    [-spread + 0.08, 5.05, 0.02],
    [-spread * 0.68, 5.7, -0.24 + sway],
    [-spread * 0.28, 6.28, 0.16 - sway],
    [spread * 0.12, 6.52, -0.14],
    [spread * 0.52, 6.16, 0.26 + sway],
    [spread - 0.1, 5.12, -0.02],
  ];
  const radii = [0.29, 0.255, 0.22, 0.185, 0.15, 0.105];
  const parts = [];
  for (let point = 0; point < points.length - 1; point += 1) {
    parts.push(createCylinderBetween(
      points[point],
      points[point + 1],
      radii[point],
      radii[point + 1],
      8,
    ));
  }
  parts.push(
    createCylinderBetween(points[2], [-spread * 0.52, 6.82, -0.62], 0.17, 0.055, 7),
    createCylinderBetween(points[3], [spread * 0.42, 6.94, 0.54], 0.14, 0.045, 7),
  );
  const geometry = mergeParts(parts);
  geometry.userData.profile = 'curved-tapered-forked-branch';
  return geometry;
}

function makeCoverArches(scene) {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: 0x526958,
    roughness: 0.92,
    vertexColors: true,
    emissive: 0x132119,
    emissiveIntensity: 0.32,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: 0x37694a,
    roughness: 0.9,
    vertexColors: true,
    emissive: 0x0a1a11,
    emissiveIntensity: 0.2,
  });
  COVER_ARCH_LAYOUT.forEach(({ centerX, z, spread }, index) => {
    const ground = terrainHeight(centerX, z);
    const leftGround = terrainHeight(centerX - spread, z);
    const rightGround = terrainHeight(centerX + spread, z);
    const left = primitive(
      bark,
      shared.trunkGeometry,
      [centerX - spread, leftGround, z],
      [0.82, 1.06 + index * 0.015, 0.82],
      [0, index * 0.72 + 0.2, 0],
    );
    const right = primitive(
      bark,
      shared.trunkGeometry,
      [centerX + spread, rightGround, z],
      [0.84, 1.04 + index * 0.012, 0.84],
      [0, -index * 0.61 - 0.45, 0],
    );
    const crown = primitive(
      bark,
      createOrganicArchGeometry(spread, index),
      [centerX, ground, z],
      [1, 1, 1],
      [0, 0, 0],
    );
    crown.name = `organic-arch-bough-${index + 1}`;
    const leftCrown = primitive(
      leaf,
      shared.crownGeometry,
      [centerX - spread * 0.72, ground + 5.9, z - 0.12],
      [0.9, 0.78, 0.88],
      [0, index * 0.54, 0],
    );
    const rightCrown = primitive(
      leaf,
      shared.crownGeometry,
      [centerX + spread * 0.72, ground + 5.95, z + 0.16],
      [0.92, 0.76, 0.9],
      [0, -index * 0.47, 0],
    );
    const centreLeft = primitive(
      leaf,
      shared.crownAccentGeometry,
      [centerX - spread * 0.23, ground + 6.48, z - 0.22],
      [0.68, 0.6, 0.64],
      [0.05, index * 0.41, -0.04],
    );
    centreLeft.name = `joint-breaking-foliage-${index + 1}-left`;
    const centreRight = primitive(
      leaf,
      shared.crownAccentGeometry,
      [centerX + spread * 0.24, ground + 6.34, z + 0.18],
      [0.66, 0.56, 0.62],
      [-0.04, -index * 0.38, 0.05],
    );
    centreRight.name = `joint-breaking-foliage-${index + 1}-right`;
    group.add(left, right, crown, leftCrown, rightCrown, centreLeft, centreRight);
  });
  group.name = 'world.connected_route.cover_arches';
  group.userData.archCount = COVER_ARCH_LAYOUT.length;
  group.userData.minimumHalfClearance = 3.5;
  group.userData.profile = 'curved-tapered-branch-arches';
  scene.add(group);
  return group;
}

function placeVegetation(scene) {
  const trunkMesh = new THREE.InstancedMesh(
    shared.trunkGeometry,
    shared.trunkMaterial,
    SCENE_BUDGET.trees,
  );
  const crownMesh = new THREE.InstancedMesh(
    shared.crownGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const crownAccentMesh = new THREE.InstancedMesh(
    shared.crownAccentGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const araucariaMesh = new THREE.InstancedMesh(
    shared.araucariaGeometry,
    shared.crownMaterial,
    Math.ceil(SCENE_BUDGET.trees / 3),
  );
  const dummy = new THREE.Object3D();
  const trunkColor = new THREE.Color();
  const crownColor = new THREE.Color();
  let araucariaIndex = 0;

  VEGETATION_LAYOUT.trees.forEach((tree) => {
    const {
      index: i, x, z, scale, isAraucaria,
    } = tree;
    const y = terrainHeight(x, z);
    const crownClusterScale = 0.92 + ((i * 7) % 5) * 0.04;
    const crownValueShift = (Math.floor(i / 5) % 3 - 1) * 0.026;
    // The current authored trunk loft starts at y=0. The previous placement
    // still treated it like a center-origin cylinder and lifted every tree by
    // roughly half its height. Reset all Euler axes as well: otherwise a
    // crown's tilt leaks into the next trunk through the reused dummy object.
    dummy.position.set(x, y - 0.035 * scale, z);
    dummy.rotation.set(0, tree.trunkYaw, 0);
    dummy.scale.set(...tree.trunkScale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    trunkColor.setHSL(...tree.trunkColor);
    trunkMesh.setColorAt(i, trunkColor);

    if (isAraucaria) {
      dummy.position.set(x, y + 5.72 * scale, z);
      dummy.rotation.set(0, tree.canopyYaw, 0);
      dummy.scale.set(...tree.canopyScale).multiplyScalar(crownClusterScale);
      dummy.updateMatrix();
      araucariaMesh.setMatrixAt(araucariaIndex, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(0, crownValueShift * 0.55, crownValueShift);
      araucariaMesh.setColorAt(araucariaIndex, crownColor);
      araucariaIndex += 1;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownAccentMesh.setMatrixAt(i, dummy.matrix);
      crownMesh.setColorAt(i, crownColor);
      crownAccentMesh.setColorAt(i, crownColor);
    } else {
      const [crownOffsetX, crownOffsetZ] = tree.crownOffset;
      dummy.position.set(x + crownOffsetX, y + 6.15 * scale, z + crownOffsetZ);
      dummy.rotation.set(...tree.crownRotation);
      dummy.scale.set(...tree.crownScale).multiplyScalar(crownClusterScale);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(0, crownValueShift * 0.55, crownValueShift);
      crownMesh.setColorAt(i, crownColor);

      dummy.position.set(
        x + tree.accentOffset[0],
        y + 7.05 * scale,
        z + tree.accentOffset[1],
      );
      dummy.rotation.set(...tree.accentRotation);
      dummy.scale.set(...tree.accentScale).multiplyScalar(2 - crownClusterScale);
      dummy.updateMatrix();
      crownAccentMesh.setMatrixAt(i, dummy.matrix);
      crownColor.offsetHSL(0.01, -0.02, 0.035);
      crownAccentMesh.setColorAt(i, crownColor);
    }
  });
  trunkMesh.name = 'world.connected_route.tree_trunks';
  crownMesh.name = 'world.connected_route.canopy';
  crownAccentMesh.name = 'world.connected_route.canopy-highlights';
  araucariaMesh.name = 'world.connected_route.araucaria-canopy';
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  crownAccentMesh.castShadow = true;
  crownAccentMesh.receiveShadow = true;
  araucariaMesh.castShadow = true;
  araucariaMesh.receiveShadow = true;
  scene.add(trunkMesh, crownMesh, crownAccentMesh, araucariaMesh);

  const fernMeshes = shared.fernGeometries.map((geometry, variantIndex) => {
    const count = Math.floor((SCENE_BUDGET.ferns + 2 - variantIndex) / 3);
    return new THREE.InstancedMesh(geometry, shared.fernMaterial, count);
  });
  const fernInstanceIndices = [0, 0, 0];
  VEGETATION_LAYOUT.ferns.forEach((fern) => {
    const {
      x, z, scale, variantIndex,
    } = fern;
    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(0, fern.rotation, 0);
    dummy.scale.set(...fern.instanceScale);
    dummy.updateMatrix();
    const fernMesh = fernMeshes[variantIndex];
    const instanceIndex = fernInstanceIndices[variantIndex];
    fernMesh.setMatrixAt(instanceIndex, dummy.matrix);
    crownColor.setHSL(...fern.color);
    fernMesh.setColorAt(instanceIndex, crownColor);
    fernInstanceIndices[variantIndex] += 1;
  });
  fernMeshes.forEach((fernMesh, index) => {
    fernMesh.name = index === 0
      ? 'world.connected_route.ferns'
      : `world.connected_route.ferns-variant-${index + 1}`;
    fernMesh.castShadow = true;
    fernMesh.receiveShadow = true;
  });
  scene.add(...fernMeshes);

  const stoneCount = 96;
  const stoneMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, flatShading: true }),
    stoneCount,
  );
  VEGETATION_LAYOUT.stones.forEach((stone) => {
    const {
      index, x, z, scale,
    } = stone;
    dummy.position.set(x, terrainHeight(x, z) + scale * 0.2, z);
    dummy.rotation.set(...stone.rotation);
    const visualClusterScale = 0.72 + ((index * 5) % 7) * 0.06;
    dummy.scale.set(...stone.instanceScale).multiplyScalar(visualClusterScale);
    dummy.updateMatrix();
    stoneMesh.setMatrixAt(index, dummy.matrix);
    crownColor.setHSL(...stone.color);
    crownColor.offsetHSL(0, -0.025, (Math.floor(index / 9) % 3 - 1) * 0.025 - 0.025);
    stoneMesh.setColorAt(index, crownColor);
  });
  stoneMesh.name = 'world.connected_route.ground-stones';
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  scene.add(stoneMesh);
}

function makeHabitatAccents(scene) {
  // The broad central sightline stays open, while authored tree-fern sentinels
  // provide near/mid/far scale at its margins.  This avoids solving depth with
  // indiscriminate scatter or a repeated wall of identical canopy crowns.
  const placements = HABITAT_TREE_LAYOUT;
  const trunks = new THREE.InstancedMesh(
    shared.treeFernTrunkGeometry,
    shared.treeFernTrunkMaterial,
    placements.length,
  );
  const crownCounts = shared.treeFernCrownGeometries.map((_, variantIndex) => (
    placements.filter((__, index) => index % shared.treeFernCrownGeometries.length === variantIndex).length
  ));
  const crownMeshes = shared.treeFernCrownGeometries.map((geometry, variantIndex) => (
    new THREE.InstancedMesh(geometry, shared.fernMaterial, crownCounts[variantIndex])
  ));
  const crownIndices = crownMeshes.map(() => 0);
  const skirts = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    placements.length * 2,
  );
  const foregroundPlacements = FOREGROUND_FROND_LAYOUT;
  const foregroundFronds = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    foregroundPlacements.length,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const random = seededRandom(1889);

  placements.forEach(([x, z, scale, yaw], index) => {
    const ground = terrainHeight(x, z);
    dummy.position.set(x, ground - 0.02, z);
    dummy.rotation.set((random() - 0.5) * 0.12, yaw, (random() - 0.5) * 0.1);
    dummy.scale.set(scale * 0.92, scale * (1.03 + random() * 0.12), scale * 0.92);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.245 + random() * 0.025, 0.25, 0.19 + random() * 0.04);
    trunks.setColorAt(index, color);

    dummy.position.set(x, ground + 2.65 * scale, z);
    dummy.rotation.set(-0.12 + random() * 0.24, yaw + random() * 0.55, 0.09 - random() * 0.18);
    dummy.scale.set(
      scale * (0.82 + random() * 0.38),
      scale * (0.86 + random() * 0.28),
      scale * (0.78 + random() * 0.4),
    );
    dummy.updateMatrix();
    const crownVariant = index % crownMeshes.length;
    const crownMesh = crownMeshes[crownVariant];
    const crownIndex = crownIndices[crownVariant];
    crownMesh.setMatrixAt(crownIndex, dummy.matrix);
    color.setHSL(0.31 + random() * 0.04, 0.46 + random() * 0.08, 0.17 + random() * 0.055);
    crownMesh.setColorAt(crownIndex, color);
    crownIndices[crownVariant] += 1;

    for (let skirt = 0; skirt < 2; skirt += 1) {
      const angle = yaw + skirt * Math.PI + (random() - 0.5) * 0.5;
      const radius = scale * (0.64 + random() * 0.35);
      const skirtX = x + Math.cos(angle) * radius;
      const skirtZ = z + Math.sin(angle) * radius;
      dummy.position.set(skirtX, terrainHeight(skirtX, skirtZ) + 0.025, skirtZ);
      dummy.rotation.set(0, angle + random(), 0);
      dummy.scale.setScalar(scale * (0.72 + random() * 0.3));
      dummy.updateMatrix();
      const skirtIndex = index * 2 + skirt;
      skirts.setMatrixAt(skirtIndex, dummy.matrix);
      color.setHSL(0.295 + random() * 0.05, 0.4 + random() * 0.1, 0.18 + random() * 0.045);
      skirts.setColorAt(skirtIndex, color);
    }
  });

  foregroundPlacements.forEach(([x, z, scale, yaw], index) => {
    const ground = terrainHeight(x, z);
    dummy.position.set(x, ground + 0.025, z);
    dummy.rotation.set(0, yaw, (index % 2 ? -1 : 1) * 0.035);
    dummy.scale.set(scale * 1.18, scale * 0.72, scale);
    dummy.updateMatrix();
    foregroundFronds.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.305 + random() * 0.025, 0.45 + random() * 0.07, 0.115 + random() * 0.025);
    foregroundFronds.setColorAt(index, color);
  });

  trunks.name = 'world.connected_route.tree-fern-sentinels';
  skirts.name = 'world.connected_route.tree-fern-understory';
  foregroundFronds.name = 'world.connected_route.foreground-depth-fronds';
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crownMeshes.forEach((crownMesh, index) => {
    crownMesh.name = index === 0
      ? 'world.connected_route.tree-fern-crowns'
      : `world.connected_route.tree-fern-crowns-variant-${index + 1}`;
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crownMesh.userData.compositionRole = 'asymmetric-midground-depth';
  });
  skirts.castShadow = true;
  skirts.receiveShadow = true;
  foregroundFronds.castShadow = true;
  foregroundFronds.receiveShadow = true;
  foregroundFronds.userData.compositionRole = 'dark-foreground-depth-frame';
  trunks.userData.compositionRole = 'sightline-margin-scale-anchor';
  scene.add(trunks, ...crownMeshes, skirts, foregroundFronds);
  return {
    trunks, crowns: crownMeshes, skirts, foregroundFronds,
  };
}

function makeDegradableGroundAccents(scene) {
  const group = new THREE.Group();
  const wetlandCount = 36;
  const marginCount = 28;
  const wetland = new THREE.InstancedMesh(
    shared.fernGeometries[1],
    shared.fernMaterial,
    wetlandCount,
  );
  const margins = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    marginCount,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const random = seededRandom(2719);

  // Follow the brook at irregular intervals, but stay outside its open water
  // and the opening track read. These are visual instances only: they never
  // enter collision or navigation truth.
  for (let index = 0; index < wetlandCount; index += 1) {
    const t = (index + 0.35 + random() * 0.3) / wetlandCount;
    const z = THREE.MathUtils.lerp(82, -66, t);
    const brookX = -11.5 + Math.sin(z * 0.071) * 3.1;
    const side = index % 2 ? -1 : 1;
    const x = brookX + side * (3.1 + random() * 2.2);
    const trackDistance = Math.hypot(x - TRACK_IMPRESSION.x, z - TRACK_IMPRESSION.z);
    const finalZ = trackDistance < 7 ? z + (z > TRACK_IMPRESSION.z ? 7 : -7) : z;
    const scale = 0.62 + random() * 0.72;
    dummy.position.set(x, terrainHeight(x, finalZ) + 0.02, finalZ);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.07);
    dummy.scale.set(scale * (0.72 + random() * 0.28), scale * (1.1 + random() * 0.35), scale);
    dummy.updateMatrix();
    wetland.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.36 + random() * 0.035, 0.34 + random() * 0.12, 0.16 + random() * 0.055);
    wetland.setColorAt(index, color);
  }

  // Alternate route margins and depth bands so the plateau no longer reads
  // as one flat horizontal strip or a regularly spaced tree row.
  for (let index = 0; index < marginCount; index += 1) {
    const nearBand = index < 12;
    const side = index % 2 ? -1 : 1;
    const z = nearBand
      ? 48 + random() * 34
      : -54 + random() * 70;
    const x = side * (nearBand ? 14 + random() * 10 : 20 + random() * 13);
    const scale = nearBand ? 1.35 + random() * 1.25 : 0.9 + random() * 1.05;
    dummy.position.set(x, terrainHeight(x, z) + 0.025, z);
    dummy.rotation.set(0, random() * Math.PI * 2, side * (0.04 + random() * 0.08));
    dummy.scale.set(scale * (1.12 + random() * 0.32), scale * (0.68 + random() * 0.22), scale);
    dummy.updateMatrix();
    margins.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.3 + random() * 0.035, 0.4 + random() * 0.11, nearBand ? 0.105 : 0.15 + random() * 0.04);
    margins.setColorAt(index, color);
  }

  wetland.name = 'world.connected_route.degradable-wetland-accents';
  margins.name = 'world.connected_route.degradable-margin-accents';
  for (const mesh of [wetland, margins]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
    mesh.userData.qualityProfile = 'balanced-high-only';
  }
  wetland.userData.compositionRole = 'irregular-wetland-midground-rhythm';
  margins.userData.compositionRole = 'foreground-midground-depth-break';
  group.name = 'world.connected_route.degradable-ground-accents';
  group.userData.profile = 'deterministic-non-solid-instanced-accents';
  group.userData.instanceCount = wetlandCount + marginCount;
  group.userData.drawCalls = 2;
  group.userData.quality = 'balanced';
  group.add(wetland, margins);
  scene.add(group);
  return group;
}

function makeBrookBoulder(scene) {
  const geometry = new THREE.DodecahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x53584f,
    roughness: 0.96,
    flatShading: true,
  });
  const boulder = new THREE.Mesh(geometry, material);
  boulder.position.set(
    BROOK_BOULDER.x,
    terrainHeight(BROOK_BOULDER.x, BROOK_BOULDER.z) + 1.18,
    BROOK_BOULDER.z,
  );
  boulder.rotation.set(-0.12, 0.54, 0.18);
  boulder.scale.set(1.85, 1.32, 1.68);
  boulder.castShadow = true;
  boulder.receiveShadow = true;
  boulder.name = 'world.connected_route.brook-boulder';
  boulder.userData.collisionRole = 'solid-boulder';
  scene.add(boulder);
  return boulder;
}

function makeBasalt(scene) {
  const geometry = createFracturedBasaltGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    flatShading: true,
  });
  const pillarMaterial = material.clone();
  pillarMaterial.map = basaltDetailTexture;
  pillarMaterial.roughnessMap = basaltDetailTexture;
  pillarMaterial.bumpMap = basaltDetailTexture;
  pillarMaterial.bumpScale = 0.075;
  pillarMaterial.emissive.set(0x542019);
  pillarMaterial.emissiveIntensity = 0.34;
  pillarMaterial.userData.surface = 'fractured-mineral-banding';
  const pillars = new THREE.InstancedMesh(geometry, pillarMaterial, SCENE_BUDGET.basaltPillars);
  const seamGeometry = new THREE.TorusGeometry(1, 0.026, 4, 6, Math.PI * 1.35);
  seamGeometry.rotateX(Math.PI / 2);
  seamGeometry.userData.profile = 'irregular-column-fracture-seam';
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0x51342d,
    roughness: 0.82,
    metalness: 0,
    flatShading: true,
  });
  const seams = new THREE.InstancedMesh(
    seamGeometry,
    seamMaterial,
    SCENE_BUDGET.basaltPillars,
  );
  const spallGeometry = new THREE.DodecahedronGeometry(1, 0);
  spallGeometry.userData.profile = 'attached-basalt-spall-ledge';
  const spalls = new THREE.InstancedMesh(
    spallGeometry,
    material,
    SCENE_BUDGET.basaltPillars,
  );
  const crustGeometry = new THREE.DodecahedronGeometry(1, 0);
  crustGeometry.userData.profile = 'thin-mineral-weathering-crust';
  const crusts = new THREE.InstancedMesh(
    crustGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.015,
      flatShading: true,
    }),
    SCENE_BUDGET.basaltPillars * 2,
  );
  const dummy = new THREE.Object3D();
  const attached = new THREE.Object3D();
  const attachedMatrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const random = seededRandom(720);
  const clusters = [
    { x: 34, z: -50, yaw: 0.22 },
    { x: 36.5, z: -26, yaw: -0.18 },
    { x: 34.5, z: -3, yaw: 0.34 },
  ];
  const packedColumnLayout = [
    [0, 0, 1],
    [-2.15, 0.35, 0.82],
    [2.05, 0.55, 0.72],
    [-1.1, -2.05, 0.58],
    [1.25, -2.15, 0.46],
    [3.15, -1.25, 0.34],
  ];
  let crustIndex = 0;
  for (let i = 0; i < SCENE_BUDGET.basaltPillars; i += 1) {
    const cluster = Math.floor(i / 6);
    const local = i % 6;
    const formation = clusters[cluster];
    const [layoutX, layoutZ, heightFactor] = packedColumnLayout[local];
    const localX = cluster === 1 ? -layoutX * 0.82 : layoutX * (cluster === 2 ? 1.18 : 1);
    const localZ = layoutZ * (cluster === 0 ? 0.86 : cluster === 2 ? 1.32 : 1.08);
    const cos = Math.cos(formation.yaw);
    const sin = Math.sin(formation.yaw);
    const x = formation.x + localX * cos - localZ * sin + (random() - 0.5) * 0.45;
    const z = formation.z + localX * sin + localZ * cos + (random() - 0.5) * 0.45;
    const broken = heightFactor < 0.6;
    const clusterHeightScale = [0.9, 0.72, 1.16][cluster];
    const h = (5.4 + heightFactor * 17.5 + random() * 1.8) * clusterHeightScale;
    const radius = 1.28 + random() * 0.48;
    const ground = terrainHeight(x, z);
    const pillarYaw = formation.yaw + random() * 0.9;
    dummy.position.set(x, ground + h / 2 - 0.34, z);
    dummy.rotation.set(
      (random() - 0.5) * (broken ? 0.18 : 0.07),
      pillarYaw,
      (random() - 0.5) * (local === 5 ? 0.62 : broken ? 0.28 : 0.09),
    );
    dummy.scale.set(
      radius * (0.9 + random() * 0.16),
      h,
      radius * (0.84 + random() * 0.15),
    );
    dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
    const pillarMatrix = dummy.matrix.clone();
    color.setHSL(0.018 + random() * 0.014, 0.45 + random() * 0.1, 0.255 + random() * 0.065);
    pillars.setColorAt(i, color);

    const seamLevel = 0.24 + random() * 0.52;
    attached.position.set(0, seamLevel - 0.5, 0);
    attached.rotation.set(0, random() * 0.22, 0);
    attached.scale.set(1.02, (0.72 + random() * 0.35) / h, 0.96);
    attached.updateMatrix();
    attachedMatrix.multiplyMatrices(pillarMatrix, attached.matrix);
    seams.setMatrixAt(i, attachedMatrix);

    const ledgeAngle = (i % 3) * 2.03 + random() * 0.42;
    const ledgeLevel = 0.31 + random() * 0.38;
    attached.position.set(
      Math.cos(ledgeAngle) * 0.9,
      ledgeLevel - 0.5,
      Math.sin(ledgeAngle) * 0.9,
    );
    attached.rotation.set((random() - 0.5) * 0.4, ledgeAngle, (random() - 0.5) * 0.3);
    attached.scale.set(
      0.32 + random() * 0.3,
      (0.16 + random() * 0.22) / h,
      0.24 + random() * 0.22,
    );
    attached.updateMatrix();
    attachedMatrix.multiplyMatrices(pillarMatrix, attached.matrix);
    spalls.setMatrixAt(i, attachedMatrix);
    color.offsetHSL(0.004, -0.04, -0.035);
    spalls.setColorAt(i, color);

    for (let patch = 0; patch < 2; patch += 1) {
      const patchAngle = (patch ? 2.12 : -1.26) + (random() - 0.5) * 0.55;
      const patchLevel = 0.22 + patch * 0.43 + random() * 0.12;
      attached.position.set(
        Math.cos(patchAngle) * 0.98,
        patchLevel - 0.5,
        Math.sin(patchAngle) * 0.98,
      );
      attached.rotation.set(
        (random() - 0.5) * 0.24,
        -patchAngle + Math.PI / 2,
        (random() - 0.5) * 0.3,
      );
      attached.scale.set(
        0.14 + random() * 0.16,
        (0.34 + random() * 0.72) / h,
        (0.035 + random() * 0.035) / radius,
      );
      attached.updateMatrix();
      attachedMatrix.multiplyMatrices(pillarMatrix, attached.matrix);
      crusts.setMatrixAt(crustIndex, attachedMatrix);
      color.setHSL(
        0.045 + random() * 0.03,
        0.28 + random() * 0.16,
        0.28 + random() * 0.09,
      );
      crusts.setColorAt(crustIndex, color);
      crustIndex += 1;
    }
  }
  pillars.name = 'world.connected_route.red_basalt';
  pillars.castShadow = true;
  pillars.receiveShadow = true;
  seams.name = 'world.connected_route.red-basalt-fracture-seams';
  seams.castShadow = false;
  seams.receiveShadow = true;
  spalls.name = 'world.connected_route.red-basalt-spall-ledges';
  spalls.castShadow = true;
  spalls.receiveShadow = true;
  crusts.name = 'world.connected_route.red-basalt-mineral-crusts';
  crusts.castShadow = false;
  crusts.receiveShadow = true;

  const rubbleCount = 44;
  const rubble = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    material,
    rubbleCount,
  );
  const rubbleRandom = seededRandom(904);
  for (let index = 0; index < rubbleCount; index += 1) {
    const z = -65 + rubbleRandom() * 68;
    const x = 25 + rubbleRandom() * 20;
    const scale = 0.38 + rubbleRandom() * 1.25;
    dummy.position.set(x, terrainHeight(x, z) + scale * 0.38, z);
    dummy.rotation.set(rubbleRandom() * Math.PI, rubbleRandom() * Math.PI, rubbleRandom() * Math.PI);
    dummy.scale.set(scale, scale * (0.48 + rubbleRandom() * 0.36), scale * (0.72 + rubbleRandom() * 0.4));
    dummy.updateMatrix();
    rubble.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.022 + rubbleRandom() * 0.018, 0.38 + rubbleRandom() * 0.12, 0.23 + rubbleRandom() * 0.08);
    rubble.setColorAt(index, color);
  }
  rubble.name = 'world.connected_route.red-basalt-rubble';
  rubble.castShadow = true;
  rubble.receiveShadow = true;
  scene.add(pillars, seams, spalls, crusts, rubble);
}

function primitive(material, geometry, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeIguanodon(scene, x, z, scale, heading, young, behaviorRole) {
  const group = createIguanodon({
    young,
    materialVariant: young ? 'moss' : 'slate',
  });
  const { rig } = group.userData;
  const restPose = {
    neckZ: rig.neckPivot.rotation.z,
    headZ: rig.headPivot.rotation.z,
    jawZ: rig.jawPivot.rotation.z,
    tailZ: rig.tailPivots.map((pivot) => pivot.rotation.z),
    tailY: rig.tailPivots.map((pivot) => pivot.rotation.y),
    limbZ: Object.fromEntries(Object.entries(rig.limbs).map(([key, limb]) => [key, {
      upper: limb.upper.rotation.z,
      mid: limb.mid.rotation.z,
      distal: limb.distal.rotation.z,
    }])),
  };
  group.position.set(x, terrainHeight(x, z) + 0.035, z);
  group.rotation.y = heading;
  group.scale.setScalar(scale);
  group.userData = {
    ...group.userData,
    baseX: x,
    baseY: group.position.y,
    baseZ: z,
    baseHeading: heading,
    phase: x * 0.7 + z,
    young,
    behaviorRole,
    headPivot: rig.headPivot,
    rig,
    restPose,
  };
  scene.add(group);
  return group;
}

function makeFamily(scene) {
  return FAMILY_LAYOUT.map((animal) => makeIguanodon(
    scene,
    animal.x,
    animal.z,
    animal.scale,
    animal.heading,
    animal.young,
    animal.behaviorRole,
  ));
}

function makeFeedingBranch(scene) {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: 0x4a4632,
    vertexColors: true,
    roughness: 0.94,
    flatShading: true,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: PALETTE.wetFern,
    vertexColors: true,
    roughness: 0.9,
    flatShading: true,
  });
  const trunk = primitive(bark, shared.trunkGeometry, [0, 0, 0], [0.72, 1.18, 0.72]);
  const branchPivot = new THREE.Group();
  branchPivot.position.set(0, 4.6, 0);
  const bough = primitive(
    bark,
    createCylinderBetween([0, 0, 0], [-5.35, -0.08, 0.12], 0.26, 0.11, 7),
    [0, 0, 0],
    [1, 1, 1],
  );
  const upperTwig = primitive(
    bark,
    createCylinderBetween([-2.3, 0, 0.06], [-3.15, 0.72, 0.48], 0.105, 0.045, 6),
    [0, 0, 0],
    [1, 1, 1],
  );
  const lowerTwig = primitive(
    bark,
    createCylinderBetween([-3.55, -0.03, 0.08], [-4.25, 0.48, -0.52], 0.09, 0.04, 6),
    [0, 0, 0],
    [1, 1, 1],
  );
  branchPivot.add(bough, upperTwig, lowerTwig);
  for (let index = 0; index < 5; index += 1) {
    const crown = primitive(
      leaf,
      shared.crownAccentGeometry,
      [-1.35 - index * 0.84, 0.26 + (index % 2) * 0.34, (index % 2 - 0.5) * 0.62],
      [0.64 + (index % 2) * 0.08, 0.55, 0.62],
      [0, index * 0.48, (index % 2 - 0.5) * 0.16],
    );
    branchPivot.add(crown);
  }
  group.add(trunk, branchPivot);
  group.position.set(
    FEEDING_BRANCH.x,
    terrainHeight(FEEDING_BRANCH.x, FEEDING_BRANCH.z),
    FEEDING_BRANCH.z,
  );
  group.name = 'subject.iguanodon_family.feeding_branch';
  group.userData.branchPivot = branchPivot;
  group.userData.contactPoint = new THREE.Vector3(-5.35, -0.08, 0.12);
  group.userData.leafClusters = branchPivot.children.slice(3);
  group.userData.leafRestRotations = group.userData.leafClusters.map((cluster) => (
    cluster.rotation.clone()
  ));
  scene.add(group);
  return group;
}

function makeGladeSunLane(scene) {
  const group = new THREE.Group();
  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: {
      glowColor: { value: new THREE.Color(0xd5b36a) },
      glowOpacity: { value: 0.16 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 glowColor;
      uniform float glowOpacity;
      void main() {
        vec2 p = (vUv - 0.5) * vec2(1.25, 0.82);
        float radial = 1.0 - smoothstep(0.2, 0.56, length(p));
        float broken = 0.76
          + sin(vUv.x * 27.0 + vUv.y * 11.0) * 0.12
          + sin(vUv.x * 9.0 - vUv.y * 19.0) * 0.08;
        gl_FragColor = vec4(glowColor, glowOpacity * radial * broken);
      }
    `,
  });
  const groundGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    glowMaterial,
  );
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.set(1, terrainHeight(1, -30) + 0.055, -30);
  groundGlow.scale.set(17, 24, 1);
  groundGlow.receiveShadow = true;
  groundGlow.name = 'world.iguanodon_glade.sun_lane.ground-feather';

  const random = seededRandom(1461);
  const motePositions = [];
  for (let index = 0; index < 120; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    motePositions.push(
      1 + Math.cos(angle) * radius * 13,
      0.6 + random() * 8.4,
      -30 + Math.sin(angle) * radius * 18,
    );
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3));
  moteGeometry.userData.profile = 'local-humidity-sun-motes';
  const moteMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      moteColor: { value: new THREE.Color(0xe8cd8b) },
      moteOpacity: { value: 0.14 },
    },
    vertexShader: `
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(18.0 / max(1.0, -viewPosition.z), 1.15, 3.2);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 moteColor;
      uniform float moteOpacity;
      void main() {
        float distanceFromCentre = length(gl_PointCoord - 0.5);
        float softDisc = 1.0 - smoothstep(0.18, 0.5, distanceFromCentre);
        if (softDisc <= 0.01) discard;
        gl_FragColor = vec4(moteColor, moteOpacity * softDisc);
      }
    `,
  });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.name = 'world.iguanodon_glade.sun_lane.humidity-motes';
  motes.frustumCulled = false;

  const shaftGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const shafts = new THREE.Group();
  [
    [-8.5, 10.5, -25.5, 6.4, 21, -0.08, 0.15],
    [0.5, 11.2, -33, 8.2, 23, 0.05, 0.62],
    [8.2, 10.2, -40, 5.6, 20, -0.04, 1.08],
  ].forEach(([x, y, z, width, height, yaw, phase], index) => {
    const shaftMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        shaftColor: { value: new THREE.Color(0xf0d69c) },
        shaftOpacity: { value: 0.035 - index * 0.004 },
        phase: { value: phase },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 shaftColor;
        uniform float shaftOpacity;
        uniform float phase;
        uniform float time;
        void main() {
          float sideFade = smoothstep(0.0, 0.24, vUv.x)
            * (1.0 - smoothstep(0.68, 1.0, vUv.x));
          float verticalFade = smoothstep(0.02, 0.28, vUv.y)
            * (1.0 - smoothstep(0.72, 1.0, vUv.y));
          float humidBreak = 0.72
            + sin(vUv.y * 12.0 + vUv.x * 5.0 + phase + time) * 0.16
            + sin(vUv.y * 29.0 - vUv.x * 9.0 - phase * 1.7) * 0.08;
          float alpha = shaftOpacity * sideFade * verticalFade * humidBreak;
          if (alpha <= 0.002) discard;
          gl_FragColor = vec4(shaftColor, alpha);
        }
      `,
    });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.set(x, y, z);
    shaft.rotation.y = yaw;
    shaft.scale.set(width, height, 1);
    shaft.name = `world.iguanodon_glade.sun_lane.humidity-shaft-${index + 1}`;
    shaft.userData.profile = 'broken-world-space-humidity-shaft';
    shafts.add(shaft);
  });
  shafts.name = 'world.iguanodon_glade.sun_lane.humidity-shafts';
  shafts.userData.profile = 'localized-broken-volumetric-planes';

  group.add(groundGlow, shafts, motes);
  group.userData.profile = 'feathered-ground-light-with-local-humidity';
  group.userData.motes = motes;
  group.userData.shafts = shafts;
  group.name = 'world.iguanodon_glade.sun_lane';
  scene.add(group);
  return group;
}

function makePterodactyl(scene, radius, height, phase, scale = 1) {
  const group = createPterodactyl();
  const { rig } = group.userData;
  const restPose = Object.fromEntries(['leftWing', 'rightWing'].map((side) => [side, {
    shoulder: rig[side].shoulder.rotation.clone(),
    elbow: rig[side].elbow.rotation.clone(),
    wrist: rig[side].wrist.rotation.clone(),
  }]));
  group.scale.setScalar(scale);
  group.name = 'threat.pterodactyl.distant';
  group.userData = {
    ...group.userData,
    radius,
    height,
    phase,
    baseScale: scale,
    restPose,
  };
  scene.add(group);
  return group;
}

function makePterodactylShadow(scene) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.46);
  shape.lineTo(0.42, -0.2);
  shape.lineTo(1.45, -0.12);
  shape.lineTo(2.35, 0.08);
  shape.lineTo(1.18, 0.28);
  shape.lineTo(0.34, 0.34);
  shape.lineTo(0, 0.64);
  shape.lineTo(-0.34, 0.34);
  shape.lineTo(-1.18, 0.28);
  shape.lineTo(-2.35, 0.08);
  shape.lineTo(-1.45, -0.12);
  shape.lineTo(-0.42, -0.2);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(Math.PI / 2);
  geometry.userData.profile = 'moving-winged-ground-shadow';
  const material = new THREE.MeshBasicMaterial({
    color: 0x14231f,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.name = 'threat.pterodactyl.projected-shadow';
  shadow.visible = false;
  shadow.renderOrder = 2;
  shadow.userData.targetPosition = new THREE.Vector3();
  shadow.userData.smoothingScale = new THREE.Vector3(1, 1, 1);

  // Two quiet outer silhouettes soften the otherwise cut-paper edge without
  // adding a screen-space blur pass or another dynamic shadow map.
  [
    [1.1, 0.085],
    [1.22, 0.035],
  ].forEach(([scale, opacity], index) => {
    const haloMaterial = material.clone();
    haloMaterial.opacity = opacity;
    haloMaterial.polygonOffsetFactor = -4 - index;
    const halo = new THREE.Mesh(geometry, haloMaterial);
    halo.name = `threat.pterodactyl.projected-shadow-soft-edge-${index + 1}`;
    halo.position.y = 0.003 * (index + 1);
    halo.scale.setScalar(scale);
    halo.renderOrder = 1;
    shadow.add(halo);
  });
  scene.add(shadow);
  return shadow;
}

function makeFamilyContactShadows(scene, family) {
  const group = new THREE.Group();
  group.name = 'subject.iguanodon_family.contact-shadows';
  const geometry = new THREE.CircleGeometry(1, 28);
  geometry.rotateX(-Math.PI / 2);
  geometry.userData.profile = 'tight-foot-contact-shadow';

  family.forEach((animal, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x17251f,
      transparent: true,
      opacity: animal.userData.young ? 0.17 : 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const shadow = new THREE.Mesh(geometry, material);
    shadow.name = `subject.iguanodon_family.contact-shadow-${index + 1}`;
    shadow.userData.profile = 'tight-foot-contact-shadow';
    shadow.userData.familyIndex = index;
    shadow.renderOrder = 1;
    group.add(shadow);
  });

  scene.add(group);
  return group;
}

function createTentPanelGeometry(vertices, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeAFrameTent() {
  const tent = new THREE.Group();
  const width = 5.1;
  const length = 6.4;
  const ridgeHeight = 3.35;
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const canvasMaterial = new THREE.MeshStandardMaterial({
    color: 0xad9770,
    emissive: 0x392719,
    emissiveIntensity: 0.34,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const endMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f7957,
    emissive: 0x2f2117,
    emissiveIntensity: 0.28,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const entryMaterial = new THREE.MeshStandardMaterial({
    color: 0x242824,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x493929,
    roughness: 0.88,
  });

  const roof = new THREE.Mesh(
    createTentPanelGeometry(
      [
        -halfWidth, 0.2, -halfLength,
        0, ridgeHeight, -halfLength,
        0, ridgeHeight, halfLength,
        -halfWidth, 0.2, halfLength,
        0, ridgeHeight, -halfLength,
        halfWidth, 0.2, -halfLength,
        halfWidth, 0.2, halfLength,
        0, ridgeHeight, halfLength,
      ],
      [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    ),
    canvasMaterial,
  );
  roof.name = 'canvas-roof';
  roof.castShadow = true;
  roof.receiveShadow = true;
  tent.add(roof);

  const seamPoints = [];
  for (const z of [-halfLength * 0.5, 0, halfLength * 0.5]) {
    seamPoints.push(
      new THREE.Vector3(-halfWidth + 0.018, 0.215, z),
      new THREE.Vector3(0, ridgeHeight + 0.018, z),
      new THREE.Vector3(0, ridgeHeight + 0.018, z),
      new THREE.Vector3(halfWidth - 0.018, 0.215, z),
    );
  }
  const canvasSeams = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(seamPoints),
    new THREE.LineBasicMaterial({ color: 0x74694f, transparent: true, opacity: 0.62 }),
  );
  canvasSeams.name = 'canvas-seams';
  tent.add(canvasSeams);

  const rear = new THREE.Mesh(
    createTentPanelGeometry(
      [
        -halfWidth, 0.2, halfLength,
        halfWidth, 0.2, halfLength,
        0, ridgeHeight, halfLength,
      ],
      [0, 1, 2],
    ),
    endMaterial,
  );
  rear.name = 'rear-canvas-panel';
  rear.castShadow = true;
  tent.add(rear);

  const darkEntry = new THREE.Mesh(
    createTentPanelGeometry(
      [-1.18, 0.18, -halfLength - 0.035, 1.18, 0.18, -halfLength - 0.035, 0, 2.72, -halfLength - 0.035],
      [0, 1, 2],
    ),
    entryMaterial,
  );
  darkEntry.name = 'dark-entry';
  tent.add(darkEntry);

  for (const side of [-1, 1]) {
    const flap = new THREE.Mesh(
      createTentPanelGeometry(
        [
          0, ridgeHeight, -halfLength - 0.06,
          side * halfWidth, 0.2, -halfLength - 0.06,
          side * 0.82, 0.2, -halfLength - 0.08,
        ],
        [0, 1, 2],
      ),
      endMaterial,
    );
    flap.name = side < 0 ? 'entry-flap-left' : 'entry-flap-right';
    flap.castShadow = true;
    tent.add(flap);
  }

  const ridgePole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.075, length + 0.7, 7),
    poleMaterial,
  );
  ridgePole.name = 'ridge-pole';
  ridgePole.position.y = ridgeHeight + 0.04;
  ridgePole.rotation.x = Math.PI / 2;
  ridgePole.castShadow = true;
  tent.add(ridgePole);
  for (const z of [-halfLength - 0.12, halfLength + 0.12]) {
    const upright = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, ridgeHeight + 0.25, 7),
      poleMaterial,
    );
    upright.position.set(0, ridgeHeight / 2, z);
    upright.castShadow = true;
    tent.add(upright);
  }

  const ropeGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, ridgeHeight, -halfLength),
    new THREE.Vector3(0, 0.04, -halfLength - 2.1),
    new THREE.Vector3(0, ridgeHeight, halfLength),
    new THREE.Vector3(0, 0.04, halfLength + 2.1),
  ]);
  const ropes = new THREE.LineSegments(
    ropeGeometry,
    new THREE.LineBasicMaterial({ color: 0x6c6049, transparent: true, opacity: 0.72 }),
  );
  ropes.name = 'guy-ropes';
  tent.add(ropes);
  tent.userData.profile = 'pitched-expedition-a-frame';
  return tent;
}

function makeSmokeTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1)) * 2 - 1;
      const v = (y / (size - 1)) * 2 - 1;
      const warpedX = u + Math.sin((v + 0.23) * 5.1) * 0.085;
      const edgeNoise = Math.sin(u * 13.7 + v * 8.3) * 0.045
        + Math.sin(u * 5.4 - v * 11.2) * 0.028;
      const distance = Math.hypot(warpedX * 0.9, v * 1.08) + edgeNoise;
      const feather = THREE.MathUtils.smoothstep(1 - distance, 0, 0.58);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(255 * feather * feather);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'world.material.soft-smoke-wisp';
  return texture;
}

function makeFort(scene) {
  const tents = new THREE.Group();
  tents.name = 'world.connected_route.fort-tents';
  for (const { x, z, rotation } of FORT_TENT_LAYOUT) {
    const tent = makeAFrameTent();
    tent.position.set(x, terrainHeight(x, z), z);
    tent.rotation.y = rotation;
    tents.add(tent);
  }
  scene.add(tents);

  const fireX = FORT_FIREPIT.x;
  const fireZ = FORT_FIREPIT.z;
  const fireGround = terrainHeight(fireX, fireZ);
  const firepit = new THREE.Group();
  firepit.name = 'world.connected_route.fort-firepit';
  firepit.userData.profile = 'stone-ring-and-charred-logs';
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x4b4a42, roughness: 1 });
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMaterial);
    stone.position.set(Math.cos(angle) * 0.72, 0.16, Math.sin(angle) * 0.72);
    stone.scale.set(1.2, 0.62, 0.84);
    stone.rotation.y = angle;
    stone.castShadow = true;
    firepit.add(stone);
  }
  const logMaterial = new THREE.MeshStandardMaterial({ color: 0x2d241d, roughness: 0.95 });
  for (const rotation of [-0.62, 0.62]) {
    const directionX = Math.cos(rotation) * 0.72;
    const directionZ = Math.sin(rotation) * 0.72;
    const log = new THREE.Mesh(
      createCylinderBetween(
        [-directionX, 0.27, -directionZ],
        [directionX, 0.31, directionZ],
        0.12,
        0.105,
        7,
      ),
      logMaterial,
    );
    log.castShadow = true;
    firepit.add(log);
  }
  const flameGroup = new THREE.Group();
  flameGroup.name = 'camp-flames';
  const flameColors = [0xffb23e, 0xf4762b, 0xffd77a];
  [[-0.2, 0.02, 1.14], [0.18, -0.08, 1.34], [0.02, 0.18, 0.96]].forEach(
    ([x, z, height], index) => {
      const flameGeometry = createVerticalLoft([
        [0, 0, 0, 0.15, 0.12],
        [height * 0.28, 0.035, -0.02, 0.2, 0.15],
        [height * 0.64, -0.045, 0.025, 0.11, 0.085],
        [height, 0.035, -0.015, 0.012, 0.012],
      ], 6);
      flameGeometry.computeVertexNormals();
      const flame = new THREE.Mesh(
        flameGeometry,
        new THREE.MeshBasicMaterial({
          color: flameColors[index],
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      flame.position.set(x, 0.34, z);
      flame.userData.baseScale = 1.68 + index * 0.14;
      flameGroup.add(flame);
    },
  );
  const emberGlow = new THREE.PointLight(0xff8a3a, 6.8, 20, 1.85);
  emberGlow.name = 'ember-glow';
  emberGlow.position.y = 0.72;
  emberGlow.castShadow = false;
  firepit.add(flameGroup, emberGlow);
  firepit.position.set(fireX, fireGround, fireZ);
  scene.add(firepit);

  const smoke = new THREE.Group();
  const smokeTexture = makeSmokeTexture();
  for (let index = 0; index < 9; index += 1) {
    const smokeColor = new THREE.Color(PALETTE.smoke).lerp(
      new THREE.Color(0xd1ad78),
      (1 - index / 8) * 0.22,
    );
    const wisp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTexture,
      color: smokeColor,
      transparent: true,
      opacity: 0.31 - index * 0.012,
      depthWrite: false,
    }));
    const windLean = -index * 0.18;
    const baseX = windLean + Math.sin(index * 1.61) * (0.08 + index * 0.012);
    const baseY = 0.58 + index * 0.79;
    wisp.position.set(baseX, baseY, Math.cos(index * 1.27) * 0.16);
    wisp.userData.baseX = baseX;
    wisp.userData.baseY = baseY;
    wisp.userData.windLean = windLean;
    wisp.userData.baseRotation = Math.sin(index * 2.17) * 0.2;
    wisp.scale.set(1.58 + index * 0.15, 1.9 + index * 0.22, 1);
    wisp.material.rotation = wisp.userData.baseRotation;
    wisp.renderOrder = 1;
    smoke.add(wisp);
  }
  smoke.position.set(fireX, fireGround + 0.42, fireZ);
  smoke.name = 'world.connected_route.fort_smoke';
  smoke.userData.profile = 'layered-billboard-wisps';
  smoke.userData.campFlames = flameGroup;
  smoke.userData.emberGlow = emberGlow;

  const signal = new THREE.Group();
  const signalX = 7.4;
  const signalZ = 73.2;
  const signalGround = terrainHeight(signalX, signalZ);
  signal.name = 'world.connected_route.fort-signal';
  signal.position.set(signalX, signalGround, signalZ);
  const signalPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.085, 4.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x493929, roughness: 0.9 }),
  );
  signalPole.name = 'signal-pole';
  signalPole.position.y = 2.4;
  signalPole.castShadow = true;
  const flagGeometry = createTentPanelGeometry(
    [
      0, 0.56, 0,
      0, -0.56, 0,
      -1.3, -0.42, 0,
      -1.3, 0.42, 0,
      -2.6, -0.5, 0,
      -2.6, 0.08, 0,
    ],
    [0, 1, 2, 0, 2, 3, 3, 2, 4, 3, 4, 5],
  );
  const signalFlag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xb75236,
      emissive: 0x3a140d,
      emissiveIntensity: 0.36,
      roughness: 0.88,
      side: THREE.DoubleSide,
    }),
  );
  signalFlag.name = 'signal-flag';
  signalFlag.position.y = 4.12;
  signalFlag.castShadow = true;
  signalFlag.userData.profile = 'wind-readable-camp-signal';
  signalFlag.userData.basePositions = Float32Array.from(
    signalFlag.geometry.attributes.position.array,
  );
  signal.add(signalPole, signalFlag);
  scene.add(signal);
  smoke.userData.campSignal = signalFlag;
  scene.add(smoke);
  return smoke;
}

function makeBrookResponse(scene) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x2a4c35, roughness: 0.94 });
  for (let index = 0; index < 5; index += 1) {
    const frond = new THREE.Mesh(shared.fernGeometries[index % shared.fernGeometries.length], material);
    frond.position.set((index - 2) * 0.72, 0.04, (index % 3) * 0.42);
    frond.scale.setScalar(1.1 + (index % 2) * 0.22);
    frond.rotation.z = (index - 2) * 0.08;
    frond.castShadow = true;
    frond.receiveShadow = true;
    group.add(frond);
  }
  group.position.set(-10.5, terrainHeight(-10.5, 47), 47);
  group.name = 'world.connected_route.brook_response';
  group.userData.response = null;
  scene.add(group);
  return group;
}

function makeFieldCameraMount(scene) {
  const group = new THREE.Group();
  group.position.set(2.8, 1.55, 67);
  group.rotation.set(-0.06, Math.PI, 0);
  group.scale.setScalar(0.64);
  group.name = 'tool.field_camera';
  group.userData.singleAssetPath = true;
  scene.add(group);
  return group;
}

function makeRifleMount(scene) {
  const group = new THREE.Group();
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false,
  });
  const flash = primitive(
    flashMaterial,
    new THREE.ConeGeometry(0.28, 1.1, 8),
    [0, 0.11, -3.32],
    [1, 1, 1],
    [-Math.PI / 2, 0, 0],
  );
  flash.name = 'tool.period_rifle.muzzle_flash';
  flash.visible = false;
  group.add(flash);
  group.position.set(2.8, 1.2, 67);
  group.rotation.set(-0.16, Math.PI, 0);
  group.scale.setScalar(0.34);
  group.name = 'tool.period_rifle';
  group.userData.flash = flash;
  group.userData.singleAssetPath = true;
  scene.add(group);
  return group;
}

export function createWorld(scene) {
  const terrain = makeTerrain(scene);
  const routeAndBrook = makeRouteAndBrook(scene);
  const brookBoulder = makeBrookBoulder(scene);
  const coverArches = makeCoverArches(scene);
  placeVegetation(scene);
  const habitatAccents = makeHabitatAccents(scene);
  const degradableGroundAccents = makeDegradableGroundAccents(scene);
  makeBasalt(scene);
  const family = makeFamily(scene);
  const familyContactShadows = makeFamilyContactShadows(scene, family);
  const feedingBranch = makeFeedingBranch(scene);
  const gladeSunLane = makeGladeSunLane(scene);
  const pterodactyls = [
    makePterodactyl(scene, 29, 23, 0.0, 0.88),
    makePterodactyl(scene, 31, 18.5, 2.2, 0.46),
    makePterodactyl(scene, 35, 20.5, 4.1, 0.32),
  ];
  const pterodactylShadow = makePterodactylShadow(scene);
  const smoke = makeFort(scene);
  const brookResponse = makeBrookResponse(scene);
  const fieldCamera = makeFieldCameraMount(scene);
  const rifle = makeRifleMount(scene);
  let renderedThreatState = 'distant';
  let renderedThreatResponse = 'orbit';
  let renderedAttackStage = 'orbit';
  let renderedAttackProgress = 0;
  let renderedFamilyMoment = 'glade-young-play';
  let observedShotCount = 0;
  let flashSeconds = 0;
  let previousThreatAwareness = null;
  let visualOrbitAwareness = 0;
  let hasRenderedThreatFrame = false;
  let previousWorldElapsed = null;
  const attackAnchor = new THREE.Vector3();
  let attackEntryPosition = null;
  let attackEntryScale = null;
  let attackEntryElapsed = 0;
  let attackExitPosition = null;
  let attackExitScale = null;
  let attackExitElapsed = 0;
  let familyVisualStatus = 'procedural-fallback';
  let familyVisualError = null;
  let pterodactylVisualStatus = 'procedural-fallback';
  let pterodactylVisualError = null;
  let fieldCameraVisualStatus = 'required-not-loaded';
  let fieldCameraVisualError = null;
  let rifleVisualStatus = 'required-not-loaded';
  let rifleVisualError = null;
  let assetVisualPromise = null;

  function enableHy3dVisuals() {
    if (!assetVisualPromise) {
      familyVisualStatus = 'loading';
      pterodactylVisualStatus = 'loading';
      fieldCameraVisualStatus = 'loading';
      rifleVisualStatus = 'loading';
      const familyTask = upgradeIguanodonFamilyWithHy3d(family, { includeYoung: true })
        .then((result) => {
          familyVisualStatus = 'hy3d-family-ready';
          return { status: familyVisualStatus, ...result };
        })
        .catch((error) => {
          familyVisualStatus = 'procedural-fallback';
          familyVisualError = error instanceof Error ? error.message : String(error);
          return { status: familyVisualStatus, upgraded: 0, error: familyVisualError };
        });
      const pterodactylTask = upgradePterodactylFlockWithHy3d(pterodactyls)
        .then((result) => {
          pterodactylVisualStatus = 'hy3d-flock-ready';
          return { status: pterodactylVisualStatus, ...result };
        })
        .catch((error) => {
          pterodactylVisualStatus = 'procedural-fallback';
          pterodactylVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: pterodactylVisualStatus,
            upgraded: 0,
            error: pterodactylVisualError,
          };
        });
      const rifleTask = loadHy3dRifleTemplate()
        .then((template) => {
          attachHy3dRifleVisual(rifle, template);
          rifleVisualStatus = 'hy3d-rifle-ready';
          return { status: rifleVisualStatus, attached: 1 };
        })
        .catch((error) => {
          rifleVisualStatus = 'error';
          rifleVisualError = error instanceof Error ? error.message : String(error);
          throw new Error(`Required HY3D rifle failed to load: ${rifleVisualError}`);
        });
      const fieldCameraTask = loadHy3dFieldCameraTemplate()
        .then((template) => {
          attachHy3dFieldCameraVisual(fieldCamera, template);
          fieldCameraVisualStatus = 'hy3d-field-camera-ready';
          return { status: fieldCameraVisualStatus, attached: 1 };
        })
        .catch((error) => {
          fieldCameraVisualStatus = 'error';
          fieldCameraVisualError = error instanceof Error ? error.message : String(error);
          throw new Error(`Required HY3D field camera failed to load: ${fieldCameraVisualError}`);
        });
      assetVisualPromise = Promise.all([
        familyTask,
        pterodactylTask,
        fieldCameraTask,
        rifleTask,
      ])
        .then(([familyResult, pterodactylResult, fieldCameraResult, rifleResult]) => ({
          familyResult,
          pterodactylResult,
          fieldCameraResult,
          rifleResult,
        }))
        .catch((error) => {
          assetVisualPromise = null;
          throw error;
        });
    }
    return assetVisualPromise;
  }

  return {
    family,
    coverArches,
    habitatAccents,
    degradableGroundAccents,
    pterodactyls,
    pterodactylShadow,
    smoke,
    brookResponse,
    brookBoulder,
    fieldCamera,
    rifle,
    enableHy3dVisuals,
    update(elapsed, reducedMotion = false, runtime = {}) {
      const awareness = Math.max(0, Math.min(3, runtime.threatAwareness ?? 0));
      const visualQuality = ['low', 'balanced', 'high'].includes(runtime.quality)
        ? runtime.quality
        : 'balanced';
      degradableGroundAccents.visible = visualQuality !== 'low';
      degradableGroundAccents.userData.quality = visualQuality;
      renderedThreatState = ['distant', 'watch', 'search', 'attack'][awareness];
      renderedThreatResponse = awareness === 3 && runtime.inCover ? 'cover-pull-up' : 'orbit';
      const playerPosition = runtime.playerPosition ?? { x: 0, z: 0 };
      const deltaSeconds = Math.max(0, Number(runtime.deltaSeconds) || 0);
      const orbitDeltaSeconds = Object.hasOwn(runtime, 'deltaSeconds')
        ? deltaSeconds
        : previousWorldElapsed === null
          ? Math.max(0, Number(elapsed) || 0)
          : Math.max(0, (Number(elapsed) || 0) - previousWorldElapsed);
      const enteringAttack = awareness === 3 && previousThreatAwareness !== 3;
      const leavingAttack = awareness !== 3 && previousThreatAwareness === 3;
      if (enteringAttack) {
        attackAnchor.set(playerPosition.x, 0, playerPosition.z);
        attackEntryPosition = hasRenderedThreatFrame ? pterodactyls[0].position.clone() : null;
        attackEntryScale = hasRenderedThreatFrame ? pterodactyls[0].scale.x : null;
        attackEntryElapsed = elapsed;
        attackExitPosition = null;
        attackExitScale = null;
      } else if (leavingAttack) {
        attackExitPosition = pterodactyls[0].position.clone();
        attackExitScale = pterodactyls[0].scale.x;
        attackExitElapsed = elapsed;
        attackEntryPosition = null;
        attackEntryScale = null;
      }
      const orbitAwarenessTarget = Math.min(2, awareness);
      const orbitBlend = deltaSeconds > 0
        ? 1 - Math.exp(-deltaSeconds * 0.9)
        : 1;
      visualOrbitAwareness = THREE.MathUtils.lerp(
        visualOrbitAwareness,
        orbitAwarenessTarget,
        orbitBlend,
      );
      const requestedFamilyMoment = runtime.familyMoment;
      renderedFamilyMoment = requestedFamilyMoment === 'glade-young-play'
        || requestedFamilyMoment === 'glade-branch-pull'
        ? requestedFamilyMoment
        : elapsed % 12 < 6 ? 'glade-young-play' : 'glade-branch-pull';
      waterDetailTexture.offset.y = -(elapsed * (reducedMotion ? 0.008 : 0.035)) % 1;
      waterDetailTexture.offset.x = Math.sin(elapsed * 0.11) * (reducedMotion ? 0.004 : 0.014);
      routeAndBrook.brook.material.userData.flowOffset = Number(waterDetailTexture.offset.y.toFixed(4));
      gladeSunLane.userData.motes.rotation.y = reducedMotion ? 0 : elapsed * 0.006;
      const eventClarity = awareness === 3 ? 0.68 : awareness === 2 ? 0.84 : 1;
      gladeSunLane.userData.motes.material.uniforms.moteOpacity.value = (reducedMotion
        ? 0.085
        : 0.125 + Math.sin(elapsed * 0.37) * 0.018) * eventClarity;
      gladeSunLane.userData.shafts.children.forEach((shaft) => {
        shaft.material.uniforms.time.value = reducedMotion ? 0 : elapsed * 0.04;
        const shaftIndex = Number(shaft.name.slice(-1)) - 1;
        shaft.material.uniforms.shaftOpacity.value = (0.035 - shaftIndex * 0.004)
          * eventClarity;
      });
      brookResponse.userData.response = runtime.brookResponse ?? null;
      const responseStrength = runtime.brookResponse === 'brush-moving'
        ? 0.24
        : runtime.brookResponse === 'answering-call' ? 0.08 : 0.015;
      brookResponse.children.forEach((frond, index) => {
        frond.rotation.z = (index - 2) * 0.08
          + Math.sin(elapsed * (2.4 + index * 0.12) + index) * responseStrength;
      });
      if ((runtime.shotCount ?? 0) > observedShotCount) {
        observedShotCount = runtime.shotCount;
        flashSeconds = 0.1;
      }
      flashSeconds = Math.max(0, flashSeconds - (runtime.deltaSeconds ?? 0));
      rifle.userData.flash.visible = flashSeconds > 0;
      rifle.userData.flash.material.opacity = flashSeconds > 0 ? flashSeconds * 8 : 0;
      const speed = reducedMotion ? 0.08 : 0.18;
      pterodactyls.forEach((mesh, index) => {
        const { radius, height, phase } = mesh.userData;
        const isPrimary = index === 0;
        const previousVisualScale = mesh.scale.x;
        mesh.visible = isPrimary || awareness === 0;
        const lowerAwareness = Math.floor(visualOrbitAwareness);
        const upperAwareness = Math.ceil(visualOrbitAwareness);
        const awarenessFraction = visualOrbitAwareness - lowerAwareness;
        const orbitRadii = [radius, 26, 17];
        const orbitHeights = [height, 9.4, 7.8];
        const stateRadius = isPrimary
          ? THREE.MathUtils.lerp(
            orbitRadii[lowerAwareness],
            orbitRadii[upperAwareness],
            awarenessFraction,
          )
          : radius;
        const stateHeight = isPrimary
          ? THREE.MathUtils.lerp(
            orbitHeights[lowerAwareness],
            orbitHeights[upperAwareness],
            awarenessFraction,
          )
          : height;
        const speedAwareness = isPrimary ? visualOrbitAwareness : 0;
        const stateSpeed = speed * (1 + speedAwareness * 0.42) * (1 + index * 0.08);
        mesh.userData.orbitAngle = (mesh.userData.orbitAngle ?? phase)
          + orbitDeltaSeconds * stateSpeed;
        const angle = mesh.userData.orbitAngle;
        const flightVelocity = new THREE.Vector3();
        let diveApproach = 0;
        let attackWingFold = 0;
        let attackRecovery = 0;
        if (isPrimary && awareness === 3 && runtime.inCover) {
          const targetPosition = new THREE.Vector3(
            attackAnchor.x + Math.cos(angle) * 3,
            stateHeight + 12 + Math.sin(angle * 1.6) * 0.7,
            attackAnchor.z - 17 + Math.sin(angle) * 3,
          );
          const transition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(attackEntryPosition ?? targetPosition).lerp(targetPosition, transition);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            attackEntryScale ?? mesh.userData.baseScale,
            mesh.userData.baseScale,
            transition,
          ));
          flightVelocity.set(
            -Math.sin(angle) * 3 * stateSpeed,
            Math.cos(angle * 1.6) * 1.12 * stateSpeed,
            Math.cos(angle) * 3 * stateSpeed,
          );
        } else if (isPrimary && awareness === 3) {
          const attackClock = Number.isFinite(runtime.attackSeconds)
            ? runtime.attackSeconds
            : elapsed;
          const flight = pterodactylAttackFlightState({
            attackClock,
            attackOrigin: attackAnchor,
            reducedMotion,
          });
          const nextFlight = pterodactylAttackFlightState({
            attackClock: attackClock + 1 / 120,
            attackOrigin: attackAnchor,
            reducedMotion,
          });
          const { pose: attackPose } = flight;
          diveApproach = flight.approach;
          attackWingFold = attackPose.wingFold;
          attackRecovery = attackPose.recovery;
          renderedAttackStage = attackPose.stage;
          renderedAttackProgress = diveApproach;
          // Graze the creek-side route edge instead of flying into the exact
          // camera centre. Orient against this same authored curve so the
          // animal cannot slide sideways or pitch upward while descending.
          const attackScale = mesh.userData.baseScale
            * (0.96 + diveApproach * 0.5);
          const transition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          const entryPosition = attackEntryPosition ?? flight.position;
          const nextTransition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed + 1 / 120 - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(entryPosition).lerp(flight.position, transition);
          flightVelocity
            .copy(entryPosition)
            .lerp(nextFlight.position, nextTransition)
            .sub(mesh.position);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            attackEntryScale ?? attackScale,
            attackScale,
            transition,
          ));
        } else {
          const xRadius = stateRadius;
          const zRadius = stateRadius * 0.35;
          const targetPosition = new THREE.Vector3(
            PTERODACTYL_ORBIT_CENTER.x + Math.cos(angle) * xRadius,
            stateHeight + Math.sin(angle * 2) * 1.2,
            PTERODACTYL_ORBIT_CENTER.z + Math.sin(angle) * zRadius,
          );
          const exitTransition = isPrimary && attackExitPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackExitElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(
            isPrimary && attackExitPosition ? attackExitPosition : targetPosition,
          ).lerp(targetPosition, exitTransition);
          flightVelocity.set(
            -Math.sin(angle) * xRadius * stateSpeed,
            Math.cos(angle * 2) * 2.4 * stateSpeed,
            Math.cos(angle) * zRadius * stateSpeed,
          );
          const orbitScale = mesh.userData.baseScale
            * (isPrimary
              ? THREE.MathUtils.lerp(1, 0.82, Math.min(1, visualOrbitAwareness))
              : 1);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            isPrimary && attackExitScale ? attackExitScale : orbitScale,
            orbitScale,
            exitTransition,
          ));
          mesh.rotation.x = 0;
        }
        const poseBlend = mesh.userData.hasRenderedFlightPose && deltaSeconds > 0
          ? 1 - Math.exp(-deltaSeconds * 10)
          : 1;
        const desiredVisualScale = mesh.scale.x;
        mesh.scale.setScalar(THREE.MathUtils.lerp(
          previousVisualScale,
          desiredVisualScale,
          poseBlend,
        ));
        mesh.name = `threat.pterodactyl.${isPrimary ? renderedThreatState : 'distant'}`;
        const authoredWingFold = isPrimary && awareness === 3 && !runtime.inCover
          ? Math.max(attackWingFold, 0.1 + diveApproach * 0.7)
          : 0;
        const wingFold = THREE.MathUtils.lerp(
          mesh.userData.renderedWingFold ?? authoredWingFold,
          authoredWingFold,
          poseBlend,
        );
        mesh.userData.renderedWingFold = wingFold;
        const wingBeat = pterodactylWingBeat(elapsed, phase, awareness, reducedMotion)
          * (1 - wingFold * 0.78);
        for (const [sideName, sideSign] of [['leftWing', -1], ['rightWing', 1]]) {
          const wing = mesh.userData.rig[sideName];
          const rest = mesh.userData.restPose[sideName];
          const bend = -sideSign * (wingFold * 0.02 + wingBeat);
          wing.shoulder.rotation.set(
            rest.shoulder.x,
            rest.shoulder.y + sideSign * wingFold * 0.24,
            rest.shoulder.z + bend,
          );
          wing.elbow.rotation.set(
            rest.elbow.x,
            rest.elbow.y + sideSign * wingFold * 0.48,
            rest.elbow.z + bend * 0.34,
          );
          wing.wrist.rotation.set(
            rest.wrist.x,
            rest.wrist.y + sideSign * wingFold * 0.62,
            rest.wrist.z + bend * 0.2,
          );
        }
        const morphPose = runtime.pterodactylMorphPose ?? {
          wingUp: Math.max(0, wingBeat) * 3.25,
          wingDown: Math.max(0, -wingBeat) * 3.25,
          diveFold: wingFold,
        };
        applyHy3dPterodactylPose(mesh, morphPose);
        mesh.userData.flightPose = {
          wingBeat: Number(wingBeat.toFixed(4)),
          wingFold: Number(wingFold.toFixed(4)),
          mode: wingFold > 0.55 ? 'fold-dive' : wingBeat >= 0 ? 'upstroke' : 'downstroke',
        };
        mesh.userData.rig.head.rotation.x = awareness === 3
          ? -0.08 - diveApproach * 0.3
          : Math.sin(angle * 1.7) * 0.025;
        mesh.userData.rig.tail.rotation.y = Math.sin(angle * 1.4) * 0.08;
        const directAttack = isPrimary && awareness === 3 && !runtime.inCover;
        const rollAmplitude = awareness === 3 ? 0.08 : 0.16 + awareness * 0.035;
        const authoredFlightRoll = directAttack
          ? -0.04 - diveApproach * 0.05 + attackRecovery * 0.1
          : Math.sin(angle * 2.4) * rollAmplitude;
        const flightRoll = THREE.MathUtils.lerp(
          mesh.userData.renderedFlightRoll ?? authoredFlightRoll,
          authoredFlightRoll,
          poseBlend,
        );
        mesh.userData.renderedFlightRoll = flightRoll;
        alignPterodactylToTravel(mesh, flightVelocity, flightRoll);
        mesh.userData.flightPose.bank = Number(flightRoll.toFixed(4));
        mesh.userData.flightPose.direction = mesh.userData.flightDirection
          ? mesh.userData.flightDirection.toArray().map((value) => Number(value.toFixed(4)))
          : null;
        mesh.userData.hasRenderedFlightPose = true;
      });
      if (runtime.captureThreatPose === 'family' || runtime.captureThreatPose === 'dive') {
        const primary = pterodactyls[0];
        const dive = runtime.captureThreatPose === 'dive';
        primary.position.set(dive ? 3.8 : -4, dive ? 5.3 : 10.5, dive ? -21.5 : -31);
        primary.rotation.set(
          dive ? 0.62 : 0.12,
          dive ? Math.PI + 0.46 : Math.PI,
          dive ? -0.62 : -0.12,
        );
        primary.scale.setScalar(primary.userData.baseScale * (dive ? 1.18 : 0.86));
        applyHy3dPterodactylPose(primary, {
          wingUp: dive ? 0 : 0.2,
          wingDown: 0,
          diveFold: dive ? 0.9 : 0,
        });
      }
      const primaryThreat = pterodactyls[0];
      const shadowVisible = awareness >= 2 && !runtime.inCover;
      pterodactylShadow.visible = shadowVisible;
      if (shadowVisible) {
        const shadowTarget = awareness === 3
          ? attackAnchor
          : PTERODACTYL_ORBIT_CENTER;
        const attackShadowPull = awareness === 3
          ? 0.3 + renderedAttackProgress * 0.32
          : 0.38;
        const shadowX = THREE.MathUtils.lerp(primaryThreat.position.x, shadowTarget.x, attackShadowPull);
        const shadowZ = THREE.MathUtils.lerp(
          primaryThreat.position.z,
          shadowTarget.z - (awareness === 3
            ? THREE.MathUtils.lerp(3.8, 1.2, renderedAttackProgress)
            : 3.8),
          awareness === 3 ? 0.3 + renderedAttackProgress * 0.28 : 0.36,
        );
        const shadowTargetPosition = pterodactylShadow.userData.targetPosition.set(
          shadowX,
          terrainHeight(shadowX, shadowZ) + 0.048,
          shadowZ,
        );
        const shadowBlend = pterodactylShadow.userData.wasVisible
          ? deltaSeconds > 0 ? 1 - Math.exp(-deltaSeconds * 8) : 1
          : 1;
        if (pterodactylShadow.userData.wasVisible) {
          pterodactylShadow.position.lerp(shadowTargetPosition, shadowBlend);
        } else {
          pterodactylShadow.position.copy(shadowTargetPosition);
        }
        pterodactylShadow.rotation.y = THREE.MathUtils.lerp(
          pterodactylShadow.rotation.y,
          primaryThreat.rotation.y,
          shadowBlend,
        );
        const shadowScale = 1.34 + renderedAttackProgress * 1.42;
        pterodactylShadow.userData.smoothingScale.setScalar(shadowScale);
        pterodactylShadow.scale.lerp(
          pterodactylShadow.userData.smoothingScale,
          shadowBlend,
        );
        pterodactylShadow.material.opacity = THREE.MathUtils.lerp(
          pterodactylShadow.material.opacity,
          (awareness === 3 ? 0.27 : 0.19) + renderedAttackProgress * 0.18,
          shadowBlend,
        );
      }
      pterodactylShadow.userData.wasVisible = shadowVisible;
      if (awareness !== 3) {
        renderedAttackStage = 'orbit';
        renderedAttackProgress = 0;
      }
      previousThreatAwareness = awareness;
      previousWorldElapsed = Number(elapsed) || 0;
      hasRenderedThreatFrame = true;
      family.forEach((animal, index) => {
        const {
          baseX,
          baseY,
          baseZ,
          baseHeading,
          behaviorRole,
          phase,
          rig,
          restPose,
        } = animal.userData;
        const youngPlay = behaviorRole === 'young-play' && renderedFamilyMoment === 'glade-young-play';
        const branchPull = behaviorRole === 'branch-pull' && renderedFamilyMoment === 'glade-branch-pull';
        const motion = reducedMotion ? 0.12 : 1;
        const breath = Math.sin(elapsed * 0.82 + phase);
        animal.position.x = baseX;
        animal.position.z = baseZ;
        animal.position.y = baseY + breath * 0.012 * motion;
        animal.rotation.y = baseHeading;
        animal.rotation.z = Math.sin(elapsed * 0.45 + index) * 0.004 * motion;

        const contactShadow = familyContactShadows.children[index];
        const contactScale = animal.userData.young ? 0.88 : 1.36;
        contactShadow.visible = animal.visible;
        contactShadow.position.set(
          baseX,
          terrainHeight(baseX, baseZ) + 0.045,
          baseZ,
        );
        contactShadow.rotation.y = baseHeading;
        contactShadow.scale.set(contactScale * 1.55, 1, contactScale * 0.68);

        rig.neckPivot.rotation.z = restPose.neckZ + breath * 0.018 * motion;
        rig.headPivot.rotation.z = restPose.headZ - breath * 0.012 * motion;
        rig.jawPivot.rotation.z = restPose.jawZ;
        rig.tailPivots.forEach((pivot, tailIndex) => {
          pivot.rotation.z = restPose.tailZ[tailIndex]
            + Math.sin(elapsed * 0.42 + phase + tailIndex * 0.52) * (0.004 + tailIndex * 0.002) * motion;
          pivot.rotation.y = restPose.tailY[tailIndex]
            + Math.sin(elapsed * 0.34 + phase + tailIndex * 0.58)
            * (0.008 + tailIndex * 0.008) * motion;
        });
        Object.entries(rig.limbs).forEach(([key, limb], limbIndex) => {
          limb.upper.rotation.z = restPose.limbZ[key].upper;
          limb.mid.rotation.z = restPose.limbZ[key].mid;
          limb.distal.rotation.z = restPose.limbZ[key].distal;
          limb.root.rotation.y = Math.sin(elapsed * 0.42 + phase + limbIndex) * 0.008 * motion;
        });

        if (behaviorRole === 'graze') {
          rig.neckPivot.rotation.z = restPose.neckZ - 0.3 + breath * 0.025 * motion;
          rig.headPivot.rotation.z = restPose.headZ - 0.18 - breath * 0.018 * motion;
          rig.jawPivot.rotation.z = restPose.jawZ + (0.035 + Math.sin(elapsed * 2.1) * 0.022) * motion;
          applyHy3dIguanodonPose(animal, {
            graze: 0.78 + breath * 0.16 * motion,
            tailLeft: Math.max(0, breath) * 0.18 * motion,
            tailRight: Math.max(0, -breath) * 0.18 * motion,
          });
        }

        if (youngPlay) {
          // Play is a planted bow-and-counterstep, not a sliding root orbit.
          // Two diagonal feet remain the weight-bearing pair while the named
          // neck, head, limb and tail pivots carry the visible action.
          const playPhase = elapsed * 2.1 + phase;
          const playSignal = Math.sin(playPhase * 1.18);
          const strideSignal = Math.sin(playPhase * 1.42);
          const stride = strideSignal * 0.38 * motion;
          const brace = Math.max(0, strideSignal) * 0.3 * motion;
          const socialTurn = animal.userData.baseX < 0 ? 1 : -1;
          const leadWeight = animal.userData.baseX < 0 ? 1 : 0.72;
          animal.position.y += (
            Math.max(0, playSignal) * 0.132
              - Math.max(0, -playSignal) * 0.045
          ) * leadWeight * motion;
          animal.rotation.y = baseHeading
            + socialTurn * (0.15 + Math.sin(playPhase * 0.72) * 0.2) * motion;
          animal.rotation.z += strideSignal * 0.072 * leadWeight * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + 0.26 + playSignal * 0.34 * motion;
          rig.headPivot.rotation.z = restPose.headZ + 0.12 - playSignal * 0.3 * motion;
          rig.jawPivot.rotation.z = restPose.jawZ + Math.max(0, -playSignal) * 0.035 * motion;
          rig.limbs.leftFore.upper.rotation.z += stride;
          rig.limbs.rightFore.upper.rotation.z -= stride;
          rig.limbs.leftHind.upper.rotation.z -= stride * 0.72;
          rig.limbs.rightHind.upper.rotation.z += stride * 0.72;
          rig.limbs.leftFore.mid.rotation.z += brace;
          rig.limbs.rightHind.mid.rotation.z += brace * 0.7;
          rig.limbs.rightFore.mid.rotation.z += Math.max(0, -stride) * 0.42;
          rig.limbs.leftHind.mid.rotation.z += Math.max(0, stride) * 0.3;
          rig.limbs.leftFore.root.rotation.y += socialTurn * strideSignal * 0.09 * motion;
          rig.limbs.rightFore.root.rotation.y -= socialTurn * strideSignal * 0.075 * motion;
          rig.limbs.leftHind.root.rotation.y -= socialTurn * strideSignal * 0.065 * motion;
          rig.limbs.rightHind.root.rotation.y += socialTurn * strideSignal * 0.085 * motion;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y -= playSignal * (0.075 + tailIndex * 0.038) * motion;
            pivot.rotation.z += playSignal * (0.03 + tailIndex * 0.011) * motion;
          });
          applyHy3dIguanodonPose(animal, {
            play: 0.46 + playSignal * 0.5 * motion,
            tailLeft: Math.max(0, playSignal) * motion,
            tailRight: Math.max(0, -playSignal) * motion,
          });
        } else if (branchPull) {
          const pullCycle = (Math.sin(elapsed * 3.4) + 1) * 0.5;
          const pull = 0.14 + pullCycle * 0.86 * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + 0.36 * pull;
          rig.headPivot.rotation.z = restPose.headZ - 0.62 * pull;
          rig.jawPivot.rotation.z = restPose.jawZ + 0.14 * pull;
          rig.limbs.leftFore.upper.rotation.z = restPose.limbZ.leftFore.upper - 0.54 * pull;
          rig.limbs.rightFore.upper.rotation.z = restPose.limbZ.rightFore.upper - 0.54 * pull;
          rig.limbs.leftFore.mid.rotation.z = restPose.limbZ.leftFore.mid + 0.17 * pull;
          rig.limbs.rightFore.mid.rotation.z = restPose.limbZ.rightFore.mid + 0.17 * pull;
          rig.limbs.leftHind.upper.rotation.z = restPose.limbZ.leftHind.upper + 0.07 * pull;
          rig.limbs.rightHind.upper.rotation.z = restPose.limbZ.rightHind.upper + 0.07 * pull;
          animal.rotation.z -= 0.022 * pull;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y += pull * (0.018 + tailIndex * 0.012);
          });
          applyHy3dIguanodonPose(animal, {
            reach: pull,
            tailLeft: pull * 0.28,
          });
        } else if (behaviorRole === 'stay-close') {
          rig.neckPivot.rotation.z = restPose.neckZ + 0.06;
          rig.headPivot.rotation.z = restPose.headZ + 0.04;
          applyHy3dIguanodonPose(animal, {
            play: 0.2,
            tailRight: Math.max(0, breath) * 0.16 * motion,
            tailLeft: Math.max(0, -breath) * 0.16 * motion,
          });
        } else if (behaviorRole !== 'graze') {
          applyHy3dIguanodonPose(animal);
        }
      });
      const branchPull = renderedFamilyMoment === 'glade-branch-pull';
      const pullCycle = (Math.sin(elapsed * 3.4) + 1) * 0.5;
      // The bough flexes at the jaw contact instead of swinging through a
      // large disconnected arc. The dinosaur supplies most of the action;
      // the rooted tree only yields a few degrees under load.
      feedingBranch.userData.branchPivot.rotation.z = branchPull
        ? 0.03 + pullCycle * (reducedMotion ? 0.05 : 0.12)
        : 0.03;
      feedingBranch.userData.leafClusters.forEach((cluster, index) => {
        const rest = feedingBranch.userData.leafRestRotations[index];
        cluster.rotation.set(
          rest.x + (branchPull ? Math.sin(elapsed * 7.2 + index) * 0.08 * pullCycle : 0),
          rest.y,
          rest.z + (branchPull ? Math.cos(elapsed * 6.4 + index) * 0.045 * pullCycle : 0),
        );
      });
      smoke.children.forEach((puff, index) => {
        const drift = reducedMotion ? 0.04 : 0.14 + index * 0.012;
        puff.position.x = puff.userData.baseX + Math.sin(elapsed * 0.22 + index) * drift;
        puff.position.y = puff.userData.baseY
          + Math.sin(elapsed * 0.16 + index * 0.7) * (reducedMotion ? 0.04 : 0.14);
        puff.material.rotation = puff.userData.baseRotation
          + (reducedMotion ? 0 : Math.sin(elapsed * 0.09 + index) * 0.12);
      });
      smoke.userData.campFlames.children.forEach((flame, index) => {
        const flicker = reducedMotion
          ? 1
          : 0.86 + Math.sin(elapsed * (5.2 + index * 0.7) + index * 1.8) * 0.14;
        flame.scale.set(
          flame.userData.baseScale * (1.02 - flicker * 0.04),
          flame.userData.baseScale * flicker,
          flame.userData.baseScale * (0.96 + flicker * 0.03),
        );
        flame.rotation.y = index * 1.7 + (reducedMotion ? 0 : Math.sin(elapsed * 2.1 + index) * 0.12);
      });
      smoke.userData.emberGlow.intensity = reducedMotion
        ? 2.85
        : 2.85 + Math.sin(elapsed * 5.6) * 0.22;
      const signalFlag = smoke.userData.campSignal;
      const signalPositions = signalFlag.geometry.attributes.position;
      const basePositions = signalFlag.userData.basePositions;
      for (let index = 0; index < signalPositions.count; index += 1) {
        const offset = index * 3;
        const distanceFromHoist = THREE.MathUtils.clamp(-basePositions[offset] / 2.6, 0, 1);
        signalPositions.setY(
          index,
          basePositions[offset + 1]
            + Math.sin(elapsed * (reducedMotion ? 0.32 : 1.75) + distanceFromHoist * 2.1)
              * distanceFromHoist * (reducedMotion ? 0.02 : 0.085),
        );
        signalPositions.setZ(
          index,
          basePositions[offset + 2]
            + Math.sin(elapsed * (reducedMotion ? 0.45 : 2.8) + distanceFromHoist * 4.2)
              * distanceFromHoist * (reducedMotion ? 0.035 : 0.15),
        );
      }
      signalPositions.needsUpdate = true;
      signalFlag.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 1.65) * 0.035;
    },
    threatSnapshot() {
      const primary = pterodactyls[0];
      return {
        state: renderedThreatState,
        response: renderedThreatResponse,
        attackStage: renderedAttackStage,
        attackProgress: Number(renderedAttackProgress.toFixed(3)),
        flightPose: primary.userData.flightPose ?? null,
        position: {
          x: Number(primary.position.x.toFixed(2)),
          y: Number(primary.position.y.toFixed(2)),
          z: Number(primary.position.z.toFixed(2)),
        },
        scale: Number(primary.scale.x.toFixed(4)),
        anchorModel: 'fixed-world-orbit-latched-attack-origin',
      };
    },
    brookResponseSnapshot() {
      return {
        state: brookResponse.userData.response,
        position: {
          x: Number(brookResponse.position.x.toFixed(2)),
          y: Number(brookResponse.position.y.toFixed(2)),
          z: Number(brookResponse.position.z.toFixed(2)),
        },
      };
    },
    familySnapshot() {
      const pullingAdult = family.find((animal) => animal.userData.behaviorRole === 'branch-pull');
      const jawPosition = pullingAdult.userData.rig.jawPivot.getWorldPosition(new THREE.Vector3());
      const branchTip = feedingBranch.userData.branchPivot.localToWorld(
        feedingBranch.userData.contactPoint.clone(),
      );
      return {
        moment: renderedFamilyMoment,
        adults: family.filter((animal) => !animal.userData.young).length,
        young: family.filter((animal) => animal.userData.young).length,
        branchAngle: Number(feedingBranch.userData.branchPivot.rotation.z.toFixed(3)),
        branchContactDistance: Number(jawPosition.distanceTo(branchTip).toFixed(3)),
        positions: family.map((animal) => ({
          x: Number(animal.position.x.toFixed(3)),
          y: Number(animal.position.y.toFixed(3)),
          z: Number(animal.position.z.toFixed(3)),
        })),
        roles: family.map((animal) => animal.userData.behaviorRole),
      };
    },
    assetSnapshot() {
      return {
        terrain: {
          profile: terrain.geometry.userData.profile,
          vertices: terrain.geometry.attributes.position.count,
          surface: terrain.material.userData.surface,
        },
        fieldCamera: {
          version: HY3D_FIELD_CAMERA_ASSET.version,
          visualStatus: fieldCameraVisualStatus,
          visualError: fieldCameraVisualError,
          loaded: Boolean(fieldCamera.userData.hy3dVisual),
          singleAssetPath: true,
          bytes: HY3D_FIELD_CAMERA_ASSET.bytes,
          triangles: HY3D_FIELD_CAMERA_ASSET.triangles,
          visibleParts: fieldCamera.children.length,
          hands: {
            loaded: Boolean(fieldCamera.userData.hy3dVisual),
            styleVersion: HY3D_FIELD_CAMERA_ASSET.version,
            hands: HY3D_FIELD_CAMERA_ASSET.integratedHands,
            gripRoles: [...HY3D_FIELD_CAMERA_ASSET.gripRoles],
            drawCalls: fieldCamera.userData.hy3dVisual ? 1 : 0,
            integratedWithTool: true,
          },
        },
        rifle: {
          version: HY3D_RIFLE_ASSET.version,
          visualStatus: rifleVisualStatus,
          visualError: rifleVisualError,
          loaded: Boolean(rifle.userData.hy3dVisual),
          singleAssetPath: true,
          bytes: HY3D_RIFLE_ASSET.bytes,
          triangles: HY3D_RIFLE_ASSET.triangles,
          visibleParts: rifle.children.length,
          hands: {
            loaded: Boolean(rifle.userData.hy3dVisual),
            styleVersion: HY3D_RIFLE_ASSET.version,
            hands: HY3D_RIFLE_ASSET.integratedHands,
            gripRoles: [...HY3D_RIFLE_ASSET.gripRoles],
            drawCalls: rifle.userData.hy3dVisual ? 1 : 0,
            integratedWithTool: true,
          },
        },
        pterodactyl: {
          silhouette: pterodactyls[0].userData.silhouette,
          projectedShadow: pterodactylShadow.geometry.userData.profile,
          visibleParts: pterodactyls[0].children.length,
          visualStatus: pterodactylVisualStatus,
          visualError: pterodactylVisualError,
          hy3d: {
            version: HY3D_PTERODACTYL_ASSET.version,
            bytes: HY3D_PTERODACTYL_ASSET.bytes,
            loaded: pterodactyls.filter((pterodactyl) => pterodactyl.userData.hy3dVisual).length,
            sharedResource: true,
            runtimeMorphPose: true,
            poseTargets: ['wingUp', 'wingDown', 'diveFold'],
          },
        },
        cover: {
          archCount: coverArches.userData.archCount,
          visibleParts: coverArches.children.length,
        },
        family: {
          adults: family.filter((animal) => !animal.userData.young).length,
          young: family.filter((animal) => animal.userData.young).length,
          behaviors: ['graze', 'branch-pull', 'young-play'],
          branchPresent: feedingBranch.parent === scene,
          visualStatus: familyVisualStatus,
          visualError: familyVisualError,
          hy3d: {
            version: HY3D_IGUANODON_ASSET.version,
            bytes: HY3D_IGUANODON_ASSET.bytes,
            loadedAdults: family.filter((animal) => (
              !animal.userData.young && animal.userData.hy3dVisual
            )).length,
            loadedYoung: family.filter((animal) => (
              animal.userData.young && animal.userData.hy3dVisual
            )).length,
            sharedResource: true,
            staticSourceMesh: true,
            runtimeMorphPose: true,
            poseTargets: ['graze', 'reach', 'play', 'tailLeft', 'tailRight', 'juvenile'],
          },
          visibleParts: family.reduce((total, animal) => total + animal.children.length, 0)
            + feedingBranch.children.length,
        },
        gladeComposition: {
          sightlineHalfWidth: GLADE_SIGHTLINE_HALF_WIDTH,
          sunLanePresent: gladeSunLane.parent === scene,
          shadowCastingSubjects: family.filter((animal) => (
            animal.children.some((part) => part.castShadow)
          )).length,
          familyWidth: Math.max(...family.map((animal) => animal.userData.baseX))
            - Math.min(...family.map((animal) => animal.userData.baseX)),
        },
        degradableGroundAccents: {
          profile: degradableGroundAccents.userData.profile,
          quality: degradableGroundAccents.userData.quality,
          visible: degradableGroundAccents.visible,
          instanceCount: degradableGroundAccents.userData.instanceCount,
          drawCalls: degradableGroundAccents.userData.drawCalls,
          collisionRole: 'non-solid-visual-accent',
        },
      };
    },
  };
}
