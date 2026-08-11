import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './config.js';

export const BRYOPHYTE_GROUND_LAYER_PROFILE = Object.freeze({
  version: 'supported-bryophyte-herbaceous-ground-layer-v2',
  targetInstances: 640,
  variantIds: Object.freeze(['moss-mat', 'clubmoss-spray', 'humid-grass-tuft']),
  drawCalls: 3,
  sourceModel: 'terrain-bryophyte-humus-wet-bank-slope-and-disturbance',
  supportModel: 'terrain-height-subgrade-rhizome-with-bounded-burial',
  loadPath: 'subgrade-rhizome-to-closed-creeping-stems-or-cambered-blade-volumes',
  collisionRole: 'non-solid-compressible-ground-vegetation',
  energyModel: 'opaque-non-emissive-zero-metalness-organic-dielectric',
});

function normalizeRootedGeometry(geometry, profile) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const centreX = (bounds.min.x + bounds.max.x) * 0.5;
  const centreZ = (bounds.min.z + bounds.max.z) * 0.5;
  const width = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, 0.001);
  const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    positions.setXYZ(
      index,
      (positions.getX(index) - centreX) / width,
      (positions.getY(index) - bounds.min.y) / height,
      (positions.getZ(index) - centreZ) / width,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const rootedVertices = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) <= 0.001) rootedVertices.push(index);
  }
  geometry.userData.profile = profile;
  geometry.userData.closedVolumes = true;
  geometry.userData.rootVertexCount = rootedVertices.length;
  geometry.userData.rootY = 0;
  return geometry;
}

function createMossMatGeometry() {
  const root = new THREE.SphereGeometry(0.095, 10, 5);
  root.scale(1, 0.14, 1);
  root.translate(0, -0.006, 0);
  const shoots = Array.from({ length: 21 }, (_, index) => {
    const angle = index * 2.399963;
    const radius = Math.sqrt((index + 0.5) / 21) * 0.42;
    const start = new THREE.Vector3(
      Math.cos(angle + index * 0.07) * radius * 0.34,
      0.018,
      Math.sin(angle - index * 0.05) * radius * 0.28,
    );
    const height = 0.05 + (index % 5) * 0.013;
    const end = new THREE.Vector3(
      Math.cos(angle + 0.09 * (index % 3)) * radius,
      height,
      Math.sin(angle + 0.09 * (index % 3)) * radius * 0.82,
    );
    return taperedStem(start, end, 0.009, 0.004, 5);
  });
  const parts = [root, ...shoots];
  const compatibleParts = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const geometry = mergeGeometries(compatibleParts, false);
  for (const part of new Set([...parts, ...compatibleParts])) part.dispose();
  if (!geometry) throw new Error('Unable to merge moss mat geometry');
  return normalizeRootedGeometry(geometry, 'closed-rooted-creeping-bryophyte-spray');
}

function taperedStem(start, end, lowerRadius, upperRadius = lowerRadius * 0.55, sides = 5) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(
    upperRadius,
    lowerRadius,
    length,
    sides,
    1,
    false,
  );
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    midpoint,
    quaternion,
    new THREE.Vector3(1, 1, 1),
  ));
  return geometry;
}

function createStemClusterGeometry(profile, bladeCount, spread, heightRange, radius) {
  const root = new THREE.SphereGeometry(0.105, 10, 5);
  root.scale(1, 0.14, 1);
  root.translate(0, -0.006, 0);
  const parts = [root];
  for (let index = 0; index < bladeCount; index += 1) {
    const angle = (index / bladeCount) * Math.PI * 2 + (index % 2) * 0.19;
    const radial = spread * (0.58 + (index % 4) * 0.12);
    const height = THREE.MathUtils.lerp(
      heightRange[0],
      heightRange[1],
      ((index * 37) % bladeCount) / Math.max(1, bladeCount - 1),
    );
    const start = new THREE.Vector3(
      Math.cos(angle) * radial * 0.08,
      0.008,
      Math.sin(angle) * radial * 0.08,
    );
    const end = new THREE.Vector3(
      Math.cos(angle) * radial,
      height,
      Math.sin(angle) * radial,
    );
    parts.push(taperedStem(start, end, radius, radius * 0.1, index % 3 === 0 ? 6 : 5));
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error(`Unable to merge ${profile} geometry`);
  return normalizeRootedGeometry(geometry, profile);
}

function createBladeVolume(points, baseHalfWidth, thickness) {
  const radialSegments = 4;
  const positions = [];
  const uvs = [];
  const indices = [];
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
    const width = THREE.MathUtils.lerp(baseHalfWidth, 0.0015, t ** 0.74);
    const depth = THREE.MathUtils.lerp(thickness, 0.0007, t ** 0.82);
    const ring = [
      point.clone().addScaledVector(lateral, width),
      point.clone().addScaledVector(binormal, depth),
      point.clone().addScaledVector(lateral, -width),
      point.clone().addScaledVector(binormal, -depth),
    ];
    ring.forEach((vertex, side) => {
      positions.push(...vertex);
      uvs.push(side / radialSegments, t);
    });
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
  const tipCentre = positions.length / 3;
  positions.push(...points.at(-1));
  uvs.push(0.5, 1);
  const tipOffset = (points.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(baseCentre, next, side);
    indices.push(tipOffset + side, tipOffset + next, tipCentre);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createHumidGrassTuftGeometry() {
  const root = new THREE.SphereGeometry(0.105, 10, 5);
  root.scale(1, 0.14, 1);
  root.translate(0, -0.006, 0);
  const bladeCount = 12;
  const parts = [root];
  for (let index = 0; index < bladeCount; index += 1) {
    const angle = (index / bladeCount) * Math.PI * 2 + (index % 3) * 0.11;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const height = 0.62 + ((index * 7) % bladeCount) / (bladeCount - 1) * 0.38;
    const spread = 0.17 + (index % 4) * 0.026;
    const points = Array.from({ length: 7 }, (_, pointIndex) => {
      const t = pointIndex / 6;
      const point = direction.clone().multiplyScalar(spread * t ** 1.35);
      point.addScaledVector(tangent, Math.sin(t * Math.PI) * Math.sin(index * 1.73) * 0.018);
      point.y = 0.005 + height * (t - 0.13 * t * t);
      return point;
    });
    parts.push(createBladeVolume(points, 0.024 + (index % 3) * 0.003, 0.0045));
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Unable to merge humid grass tuft geometry');
  return normalizeRootedGeometry(
    geometry,
    'closed-subgrade-rooted-cambered-humid-grass-tuft',
  );
}

function terrainNormalAt(x, z, terrainGradient) {
  const gradient = terrainGradient(x, z);
  return new THREE.Vector3(-gradient.x, 1, -gradient.z).normalize();
}

export function createBryophyteGroundLayer({
  terrainHeight,
  terrainGradient,
  terrainEcologyAt,
  blocksPlacement = () => false,
  targetCount = BRYOPHYTE_GROUND_LAYER_PROFILE.targetInstances,
}) {
  const random = seededRandom(59321);
  const candidates = [];
  const step = 2.7;
  for (let z = -88; z <= 88; z += step) {
    for (let x = -76; x <= 76; x += step) {
      const candidateX = x + (random() - 0.5) * step * 0.76;
      const candidateZ = z + (random() - 0.5) * step * 0.76;
      if (blocksPlacement(candidateX, candidateZ)) continue;
      const ecology = terrainEcologyAt(candidateX, candidateZ);
      const gradient = terrainGradient(candidateX, candidateZ);
      const slope = Math.hypot(gradient.x, gradient.z);
      if (
        slope > 0.28
        || ecology.routeWear > 0.16
        || ecology.mineralExposure > 0.7
        || ecology.pointBarDeposit > 0.46
        || ecology.cutBankExposure > 0.42
        || ecology.wetBank > 0.96
      ) continue;
      const suitability = THREE.MathUtils.clamp(
        ecology.bryophyte * 0.72
          + ecology.humus * 0.42
          + ecology.wetBank * 0.18
          + ecology.hollowRetention * 0.08,
        0,
        1,
      );
      if (suitability < 0.055 || random() > 0.28 + suitability * 0.78) continue;
      let variantIndex = 1;
      if (ecology.wetBank > 0.26) variantIndex = 2;
      else if (ecology.bryophyte > ecology.humus * 0.62) variantIndex = 0;
      candidates.push({
        x: candidateX,
        z: candidateZ,
        y: terrainHeight(candidateX, candidateZ),
        slope,
        ecology,
        suitability,
        variantIndex,
        yaw: random() * Math.PI * 2,
        individual: random(),
      });
    }
  }
  candidates.sort((left, right) => (
    right.suitability - left.suitability
    || left.z - right.z
    || left.x - right.x
  ));
  const placements = candidates.slice(0, Math.max(0, targetCount));
  const geometries = [
    createMossMatGeometry(),
    createStemClusterGeometry('closed-rooted-clubmoss-spray', 9, 0.34, [0.42, 0.78], 0.026),
    createHumidGrassTuftGeometry(),
  ];
  const materials = [0x33492e, 0x2f4837, 0x3d5738].map((baseColor, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      vertexColors: false,
      roughness: index === 2 ? 0.91 : 0.96,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0,
      envMapIntensity: index === 0 ? 0.12 : index === 1 ? 0.16 : 0.18,
      flatShading: false,
      fog: true,
    });
    material.userData.surface = 'opaque-matte-ground-organic-dielectric';
    material.userData.energyModel = BRYOPHYTE_GROUND_LAYER_PROFILE.energyModel;
    return material;
  });
  const counts = geometries.map((_, variantIndex) => (
    placements.filter((placement) => placement.variantIndex === variantIndex).length
  ));
  const meshes = geometries.map((geometry, variantIndex) => {
    const mesh = new THREE.InstancedMesh(geometry, materials[variantIndex], counts[variantIndex]);
    mesh.name = `world.environment-density.bryophyte-ground.${BRYOPHYTE_GROUND_LAYER_PROFILE.variantIds[variantIndex]}`;
    mesh.castShadow = variantIndex !== 0;
    mesh.receiveShadow = true;
    mesh.userData.variantId = BRYOPHYTE_GROUND_LAYER_PROFILE.variantIds[variantIndex];
    mesh.userData.collisionRole = BRYOPHYTE_GROUND_LAYER_PROFILE.collisionRole;
    return mesh;
  });
  const indices = [0, 0, 0];
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const burialDepth = 0.026;
  for (const placement of placements) {
    const { variantIndex, individual } = placement;
    const mesh = meshes[variantIndex];
    const instanceIndex = indices[variantIndex];
    dummy.position.set(placement.x, placement.y - burialDepth, placement.z);
    dummy.quaternion.identity();
    if (variantIndex === 0) {
      dummy.quaternion.setFromUnitVectors(
        up,
        terrainNormalAt(placement.x, placement.z, terrainGradient),
      );
      dummy.rotateY(placement.yaw);
      const width = THREE.MathUtils.lerp(0.48, 1, individual);
      dummy.scale.set(width, THREE.MathUtils.lerp(0.05, 0.1, individual), width * 0.82);
    } else {
      dummy.rotation.set(0, placement.yaw, 0);
      const width = variantIndex === 1
        ? THREE.MathUtils.lerp(0.34, 0.62, individual)
        : THREE.MathUtils.lerp(0.24, 0.42, individual);
      const height = variantIndex === 1
        ? THREE.MathUtils.lerp(0.2, 0.4, individual)
        : THREE.MathUtils.lerp(0.24, 0.48, individual);
      dummy.scale.set(width, height, width);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(instanceIndex, dummy.matrix);
    placement.rootY = placement.y - burialDepth;
    placement.burialDepth = burialDepth;
    indices[variantIndex] += 1;
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }
  const group = new THREE.Group();
  group.name = 'world.environment-density.bryophyte-ground-layer';
  group.add(...meshes);
  const supportEvidence = Object.freeze({
    rootCount: placements.length,
    supportedRootCount: placements.length,
    supportRatio: placements.length > 0 ? 1 : 0,
    minimumRootClearance: -burialDepth,
    maximumRootClearance: -burialDepth,
    settlementAxis: 'world-gravity-for-stems-terrain-normal-for-low-moss-mats',
  });
  group.userData.profile = BRYOPHYTE_GROUND_LAYER_PROFILE.version;
  group.userData.instanceCount = placements.length;
  group.userData.counts = Object.freeze(Object.fromEntries(
    BRYOPHYTE_GROUND_LAYER_PROFILE.variantIds.map((variantId, index) => [variantId, counts[index]]),
  ));
  group.userData.drawCalls = BRYOPHYTE_GROUND_LAYER_PROFILE.drawCalls;
  group.userData.placements = Object.freeze(placements.map((placement) => Object.freeze(placement)));
  group.userData.supportEvidence = supportEvidence;
  group.userData.distributionModel = BRYOPHYTE_GROUND_LAYER_PROFILE.sourceModel;
  group.userData.collisionRole = BRYOPHYTE_GROUND_LAYER_PROFILE.collisionRole;
  group.userData.energyModel = BRYOPHYTE_GROUND_LAYER_PROFILE.energyModel;
  group.userData.geometries = Object.freeze(geometries);
  return group;
}
