import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './config.js';
import { barkTextures } from './vegetation-textures.js';

function createDeadwoodSegmentGeometry(
  start,
  end,
  startRadius,
  endRadius,
  {
    seed,
    ringCount = 7,
    radialSegments = 12,
    brokenEnd = true,
  },
) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const axis = to.clone().sub(from);
  const length = axis.length();
  const tangent = axis.clone().normalize();
  const reference = Math.abs(tangent.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const radialA = new THREE.Vector3().crossVectors(tangent, reference).normalize();
  const radialB = new THREE.Vector3().crossVectors(tangent, radialA).normalize();
  const random = seededRandom(seed);
  const bowA = (random() - 0.5) * Math.min(length * 0.035, startRadius * 0.65);
  const bowB = (random() - 0.5) * Math.min(length * 0.025, startRadius * 0.48);
  const phase = random() * Math.PI * 2;
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const ringOffsets = [];
  const point = new THREE.Vector3();
  const centre = new THREE.Vector3();

  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ring / (ringCount - 1);
    centre.lerpVectors(from, to, t);
    const bend = Math.sin(t * Math.PI);
    centre.addScaledVector(radialA, bowA * bend);
    centre.addScaledVector(radialB, bowB * bend);
    centre.y -= bend * Math.min(0.035, length * 0.012);
    const nominalRadius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    ringOffsets.push(vertices.length / 3);
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      const furrow = Math.sin(angle * 3 + phase + t * 2.7) * 0.045
        + Math.sin(angle * 7 - phase * 0.7 + t * 5.1) * 0.022;
      const radius = nominalRadius * (1 + furrow);
      const fractureAdvance = brokenEnd && ring === ringCount - 1
        ? endRadius * (0.08 + (Math.sin(angle * 2.5 + phase) * 0.5 + 0.5) * 0.48)
        : 0;
      point.copy(centre)
        .addScaledVector(tangent, fractureAdvance)
        .addScaledVector(radialA, Math.cos(angle) * radius)
        .addScaledVector(radialB, Math.sin(angle) * radius);
      vertices.push(point.x, point.y, point.z);
      const barkShade = THREE.MathUtils.clamp(
        0.86
          + Math.sin(angle * 5.2 + t * 13.7 + phase) * 0.075
          + Math.sin(t * 31.1 - angle * 1.8) * 0.035,
        0.72,
        0.98,
      );
      colors.push(0.82 * barkShade, 0.76 * barkShade, 0.64 * barkShade);
      uvs.push(side / radialSegments, t * length * 1.8);
    }
  }

  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    const current = ringOffsets[ring];
    const nextRing = ringOffsets[ring + 1];
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      indices.push(
        current + side,
        current + next,
        nextRing + side,
        current + next,
        nextRing + next,
        nextRing + side,
      );
    }
  }

  const addEndGrain = (ringIndex, reverse) => {
    const sourceOffset = ringOffsets[ringIndex];
    const capOffset = vertices.length / 3;
    const capCentre = new THREE.Vector3();
    for (let side = 0; side < radialSegments; side += 1) {
      const sourceIndex = (sourceOffset + side) * 3;
      point.set(vertices[sourceIndex], vertices[sourceIndex + 1], vertices[sourceIndex + 2]);
      capCentre.add(point);
      vertices.push(point.x, point.y, point.z);
      const grain = 0.86 + Math.sin(side * 2.3 + phase) * 0.08;
      colors.push(0.74 * grain, 0.53 * grain, 0.32 * grain);
      const angle = (side / radialSegments) * Math.PI * 2;
      uvs.push(0.5 + Math.cos(angle) * 0.46, 0.5 + Math.sin(angle) * 0.46);
    }
    capCentre.multiplyScalar(1 / radialSegments);
    const centreIndex = vertices.length / 3;
    vertices.push(capCentre.x, capCentre.y, capCentre.z);
    colors.push(0.71, 0.49, 0.28);
    uvs.push(0.5, 0.5);
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      if (reverse) indices.push(centreIndex, capOffset + next, capOffset + side);
      else indices.push(centreIndex, capOffset + side, capOffset + next);
    }
  };
  addEndGrain(0, true);
  addEndGrain(ringCount - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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
  const layout = layouts[variant % layouts.length];
  const parts = layout.map(([start, end, startRadius, endRadius], segmentIndex) => (
    createDeadwoodSegmentGeometry(start, end, startRadius, endRadius, {
      seed: 11_717 + variant * 331 + segmentIndex * 47,
    })
  ));
  const addSplinter = (start, end, radius, index) => {
    parts.push(createDeadwoodSegmentGeometry(start, end, radius, radius * 0.08, {
      seed: 14_119 + variant * 503 + index * 71,
      ringCount: 4,
      radialSegments: 6,
      brokenEnd: false,
    }));
  };
  layout.forEach(([start, end, , endRadius], segmentIndex) => {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const tangent = to.clone().sub(from).normalize();
    const side = new THREE.Vector3().crossVectors(
      tangent,
      Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0),
    ).normalize();
    const splitStart = to.clone().addScaledVector(tangent, -endRadius * 0.32);
    const splitEnd = to.clone()
      .addScaledVector(tangent, endRadius * (0.72 + (segmentIndex % 2) * 0.22))
      .addScaledVector(side, endRadius * (segmentIndex % 2 ? -0.36 : 0.34));
    addSplinter(splitStart.toArray(), splitEnd.toArray(), endRadius * 0.24, segmentIndex);
  });
  const [mainStart, mainEnd, mainStartRadius] = layout[0];
  const mainFrom = new THREE.Vector3(...mainStart);
  const mainTo = new THREE.Vector3(...mainEnd);
  const reverseTangent = mainFrom.clone().sub(mainTo).normalize();
  addSplinter(
    mainFrom.clone().addScaledVector(reverseTangent, -mainStartRadius * 0.18).toArray(),
    mainFrom.clone().addScaledVector(reverseTangent, mainStartRadius * 0.72).toArray(),
    mainStartRadius * 0.2,
    layout.length,
  );
  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute('position');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const supportPoints = [];
  const minimumY = geometry.boundingBox.min.y;
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > minimumY + 0.024) continue;
    supportPoints.push(Object.freeze([
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    ]));
  }
  geometry.userData.profile = 'closed-curved-branched-deadwood-with-jagged-fibre-breaks';
  geometry.userData.supportPoints = Object.freeze(supportPoints);
  geometry.userData.supportModel = 'gravity-settled-tangent-aligned-multipoint-deadfall';
  return geometry;
}

function createDeadwoodMaterial({ wet = false } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: wet ? 0.9 : 0.96,
    roughnessMap: barkTextures.roughness,
    map: barkTextures.albedo,
    bumpMap: barkTextures.height,
    bumpScale: wet ? 0.016 : 0.024,
    metalness: 0,
    flatShading: false,
    envMapIntensity: wet ? 0.12 : 0.08,
    dithering: true,
  });
  material.emissive.set(0x000000);
  material.emissiveIntensity = 0;
  material.userData = {
    surface: wet
      ? 'water-darkened-furrowed-bark-and-broken-end-grain'
      : 'dry-weathered-furrowed-bark-and-broken-end-grain',
    energyModel: 'opaque-non-emissive-dielectric-weathered-wood',
    moistureClass: wet ? 'brook-bank-wet' : 'forest-floor-dry-to-damp',
    textureChannels: Object.freeze({
      albedo: barkTextures.albedo.name,
      roughness: barkTextures.roughness.name,
      height: barkTextures.height.name,
    }),
  };
  return material;
}

export { createDeadwoodMaterial, createDriftwoodGeometry };
