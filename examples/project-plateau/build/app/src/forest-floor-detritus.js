import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { seededRandom } from './config.js';

export const FOREST_FLOOR_DETRITUS_PROFILE = Object.freeze({
  version: 'source-coupled-forest-floor-detritus-v2',
  count: 390,
  heroGingkoCount: 30,
  variantIds: Object.freeze([
    'curled-broadleaf-litter',
    'twig-and-bark-fall',
    'cone-husk-and-leaf-scatter',
    'hero-gingko-fan-leaf-fall',
  ]),
  drawCalls: 4,
  maximumClusterDiameterMeters: 1.08,
  maximumClusterHeightMeters: 0.2,
  maximumSlope: 0.28,
  minimumHumus: 0.08,
  maximumRouteWear: 0.16,
  maximumWetBank: 0.65,
  maximumMineralExposure: 0.58,
  burialDepth: 0.008,
  maximumSupportClearance: 0.035,
  heroGingkoRadiusMeters: Object.freeze([1.45, 4.85]),
  heroRootAnglesRadians: Object.freeze([0.06, 0.86, 1.69, 2.61, 3.48, 4.4, 5.31]),
  minimumRootAngularSeparationRadians: 0.18,
  distributionModel:
    'canopy-source-and-hollow-retained-organic-fall-plus-hero-gingko-inter-root-litter-with-disturbance-exclusion',
  supportModel: 'gravity-settled-local-tangent-plane-with-multipoint-terrain-contact',
  collisionRole: 'non-solid-compressible-forest-floor-detritus',
  energyModel: 'opaque-non-emissive-dielectric-dry-and-decaying-organic-matter',
});

const LEAF_COLOURS = Object.freeze([
  Object.freeze([0.075, 0.038, 0.014]),
  Object.freeze([0.12, 0.062, 0.019]),
  Object.freeze([0.052, 0.028, 0.011]),
  Object.freeze([0.165, 0.085, 0.024]),
]);
const WOOD_COLOURS = Object.freeze([
  Object.freeze([0.058, 0.031, 0.012]),
  Object.freeze([0.09, 0.048, 0.017]),
  Object.freeze([0.038, 0.022, 0.009]),
]);
const GINGKO_LEAF_COLOURS = Object.freeze([
  Object.freeze([0.22, 0.115, 0.018]),
  Object.freeze([0.175, 0.076, 0.012]),
  Object.freeze([0.27, 0.15, 0.026]),
  Object.freeze([0.13, 0.058, 0.01]),
]);

function addColour(geometry, rgb) {
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const shade = 0.9 + Math.sin(index * 2.173 + rgb[0] * 19.4) * 0.08;
    colours[index * 3] = rgb[0] * shade;
    colours[index * 3 + 1] = rgb[1] * shade;
    colours[index * 3 + 2] = rgb[2] * shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function settleGeometryBase(geometry) {
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createClosedLeaf({
  length,
  width,
  yaw,
  x,
  z,
  curl,
  colour,
}) {
  const outline = [
    [-0.5, 0],
    [-0.27, 0.34],
    [0.08, 0.5],
    [0.5, 0],
    [0.08, -0.5],
    [-0.27, -0.34],
  ];
  const thickness = 0.0055;
  const positions = [];
  const uvs = [];
  const colours = [];
  const indices = [];
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);

  for (const layer of [0, 1]) {
    outline.forEach(([u, v]) => {
      const localX = u * length;
      const localZ = v * width;
      const rotatedX = localX * cosine - localZ * sine;
      const rotatedZ = localX * sine + localZ * cosine;
      const arch = Math.sin((u + 0.5) * Math.PI) * curl;
      const edgeCurl = Math.abs(v) ** 1.4 * curl * 0.42;
      positions.push(x + rotatedX, layer ? thickness + arch + edgeCurl : 0, z + rotatedZ);
      uvs.push(u + 0.5, v + 0.5);
      const shade = 0.86 + (u + 0.5) * 0.11 + Math.abs(v) * 0.04;
      colours.push(colour[0] * shade, colour[1] * shade, colour[2] * shade);
    });
  }
  const bottomCentre = positions.length / 3;
  positions.push(x, 0, z);
  uvs.push(0.5, 0.5);
  colours.push(...colour.map((value) => value * 0.82));
  const topCentre = positions.length / 3;
  positions.push(x, thickness + curl, z);
  uvs.push(0.5, 0.5);
  colours.push(...colour);
  for (let side = 0; side < outline.length; side += 1) {
    const next = (side + 1) % outline.length;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, outline.length + next, outline.length + side);
    indices.push(side, outline.length + side, next);
    indices.push(next, outline.length + side, outline.length + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createClosedGingkoLeaf({
  length,
  width,
  yaw,
  x,
  z,
  curl,
  colour,
}) {
  // A concave distal notch preserves the source species' bilobed fan grammar;
  // the petiole end remains narrow and the complete fallen lamina is closed.
  const outline = [
    [-0.5, 0],
    [-0.3, 0.11],
    [-0.08, 0.36],
    [0.24, 0.5],
    [0.48, 0.34],
    [0.32, 0],
    [0.48, -0.34],
    [0.24, -0.5],
    [-0.08, -0.36],
    [-0.3, -0.11],
  ];
  const thickness = 0.0048;
  const positions = [];
  const uvs = [];
  const colours = [];
  const indices = [];
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  for (const layer of [0, 1]) {
    outline.forEach(([u, v]) => {
      const localX = u * length;
      const localZ = v * width;
      const rotatedX = localX * cosine - localZ * sine;
      const rotatedZ = localX * sine + localZ * cosine;
      const fanArch = Math.sin((u + 0.5) * Math.PI) * curl;
      const edgeCurl = Math.abs(v) ** 1.5 * curl * 0.34;
      positions.push(
        x + rotatedX,
        layer ? thickness + fanArch + edgeCurl : 0,
        z + rotatedZ,
      );
      uvs.push(u + 0.5, v + 0.5);
      const shade = 0.84 + (u + 0.5) * 0.12 + Math.abs(v) * 0.035;
      colours.push(colour[0] * shade, colour[1] * shade, colour[2] * shade);
    });
  }
  const bottomCentre = positions.length / 3;
  positions.push(x, 0, z);
  uvs.push(0.5, 0.5);
  colours.push(...colour.map((value) => value * 0.8));
  const topCentre = positions.length / 3;
  positions.push(x, thickness + curl, z);
  uvs.push(0.5, 0.5);
  colours.push(...colour);
  for (let side = 0; side < outline.length; side += 1) {
    const next = (side + 1) % outline.length;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, outline.length + next, outline.length + side);
    indices.push(side, outline.length + side, next);
    indices.push(next, outline.length + side, outline.length + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createLyingTwig({ length, radius, yaw, x, z, colour }) {
  const geometry = new THREE.CylinderGeometry(
    radius * 0.68,
    radius,
    length,
    6,
    2,
    false,
  );
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateY(yaw);
  geometry.translate(x, 0, z);
  settleGeometryBase(geometry);
  addColour(geometry, colour);
  return geometry;
}

function createBarkFragment({ x, z, scaleX, scaleZ, yaw, colour }) {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  geometry.scale(scaleX, 0.022 + scaleX * 0.035, scaleZ);
  geometry.rotateY(yaw);
  geometry.translate(x, 0, z);
  settleGeometryBase(geometry);
  addColour(geometry, colour);
  return geometry;
}

function createConeHusk({ x, z, scale, yaw, colour }) {
  const geometry = new THREE.ConeGeometry(scale * 0.38, scale, 7, 2, false);
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateY(yaw);
  geometry.translate(x, 0, z);
  settleGeometryBase(geometry);
  addColour(geometry, colour);
  return geometry;
}

export function createForestFloorDetritusGeometry(variantIndex = 0) {
  const variant = variantIndex % FOREST_FLOOR_DETRITUS_PROFILE.variantIds.length;
  const random = seededRandom(9107 + variant * 173);
  const parts = [];
  const leafCount = [5, 3, 3, 7][variant];
  const twigCount = [2, 5, 2, 2][variant];
  const barkCount = [1, 3, 2, 0][variant];
  const coneCount = [0, 0, 2, 0][variant];

  for (let index = 0; index < leafCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const createLeaf = variant === 3 ? createClosedGingkoLeaf : createClosedLeaf;
    parts.push(createLeaf({
      length: (variant === 3 ? 0.15 : 0.18) + random() * (variant === 3 ? 0.09 : 0.13),
      width: (variant === 3 ? 0.12 : 0.07) + random() * (variant === 3 ? 0.065 : 0.055),
      yaw: angle + (random() - 0.5) * 1.4,
      x: (random() - 0.5) * (variant === 3 ? 0.52 : 0.48) + Math.cos(angle) * 0.045,
      z: (random() - 0.5) * (variant === 3 ? 0.42 : 0.34) + Math.sin(angle) * 0.035,
      curl: 0.008 + random() * (variant === 3 ? 0.014 : 0.018),
      colour: variant === 3
        ? GINGKO_LEAF_COLOURS[index % GINGKO_LEAF_COLOURS.length]
        : LEAF_COLOURS[(index + variant) % LEAF_COLOURS.length],
    }));
  }
  for (let index = 0; index < twigCount; index += 1) {
    const angle = random() * Math.PI * 2;
    parts.push(createLyingTwig({
      length: (variant === 3 ? 0.12 : 0.2) + random() * (variant === 3 ? 0.16 : 0.32),
      radius: (variant === 3 ? 0.006 : 0.009) + random() * (variant === 3 ? 0.006 : 0.013),
      yaw: angle,
      x: (random() - 0.5) * 0.38,
      z: (random() - 0.5) * 0.3,
      colour: WOOD_COLOURS[(index + variant) % WOOD_COLOURS.length],
    }));
  }
  for (let index = 0; index < barkCount; index += 1) {
    parts.push(createBarkFragment({
      x: (random() - 0.5) * 0.48,
      z: (random() - 0.5) * 0.38,
      scaleX: 0.055 + random() * 0.07,
      scaleZ: 0.08 + random() * 0.1,
      yaw: random() * Math.PI,
      colour: WOOD_COLOURS[(index + 1 + variant) % WOOD_COLOURS.length],
    }));
  }
  for (let index = 0; index < coneCount; index += 1) {
    parts.push(createConeHusk({
      x: (random() - 0.5) * 0.4,
      z: (random() - 0.5) * 0.34,
      scale: 0.1 + random() * 0.045,
      yaw: random() * Math.PI,
      colour: WOOD_COLOURS[(index + variant) % WOOD_COLOURS.length],
    }));
  }

  const mergeParts = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const geometry = mergeGeometries(mergeParts, false);
  parts.forEach((part) => part.dispose());
  mergeParts.forEach((part, index) => {
    if (part !== parts[index]) part.dispose();
  });
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const positions = geometry.getAttribute('position');
  const supportPoints = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > geometry.boundingBox.min.y + 0.001) continue;
    supportPoints.push(Object.freeze([
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    ]));
  }
  geometry.userData = {
    profile: 'closed-curled-leaf-twig-bark-and-husk-cluster',
    variantId: FOREST_FLOOR_DETRITUS_PROFILE.variantIds[variant],
    leafCount,
    twigCount,
    barkCount,
    coneCount,
    speciesSource: variant === 3 ? 'hero-gingko-bilobed-fan-leaf' : 'mixed-canopy-organic-fall',
    supportPoints: Object.freeze(supportPoints),
    supportModel: FOREST_FLOOR_DETRITUS_PROFILE.supportModel,
    collisionRole: FOREST_FLOOR_DETRITUS_PROFILE.collisionRole,
  };
  return geometry;
}

function createDetritusMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.15,
    side: THREE.FrontSide,
    dithering: true,
  });
  material.emissive.set(0x000000);
  material.emissiveIntensity = 0;
  material.userData = {
    surface: 'dry-curled-leaf-weathered-bark-and-woody-husk-dielectric',
    energyModel: FOREST_FLOOR_DETRITUS_PROFILE.energyModel,
  };
  return material;
}

function acceptedEcology(ecology) {
  return ecology.humus >= FOREST_FLOOR_DETRITUS_PROFILE.minimumHumus
    && ecology.routeWear <= FOREST_FLOOR_DETRITUS_PROFILE.maximumRouteWear
    && ecology.wetBank <= FOREST_FLOOR_DETRITUS_PROFILE.maximumWetBank
    && ecology.mineralExposure <= FOREST_FLOOR_DETRITUS_PROFILE.maximumMineralExposure
    && ecology.slope <= FOREST_FLOOR_DETRITUS_PROFILE.maximumSlope;
}

export function createForestFloorDetritusLayer({
  terrainHeight,
  terrainGradient,
  terrainEcologyAt,
  sources,
  heroSource = null,
  blocksPlacement = () => false,
  count = FOREST_FLOOR_DETRITUS_PROFILE.count,
} = {}) {
  if (!terrainHeight || !terrainGradient || !terrainEcologyAt || !sources?.length) {
    throw new Error('forest floor detritus requires terrain functions and canopy sources');
  }
  const group = new THREE.Group();
  const material = createDetritusMaterial();
  const geometries = FOREST_FLOOR_DETRITUS_PROFILE.variantIds.map((_, index) => (
    createForestFloorDetritusGeometry(index)
  ));
  const heroCount = heroSource
    ? Math.min(FOREST_FLOOR_DETRITUS_PROFILE.heroGingkoCount, count)
    : 0;
  const generalCount = count - heroCount;
  const counts = geometries.map((_, variant) => (
    variant === geometries.length - 1
      ? heroCount
      : Math.floor((generalCount + 2 - variant) / 3)
  ));
  const meshes = geometries.map((geometry, variant) => {
    const mesh = new THREE.InstancedMesh(geometry, material, counts[variant]);
    mesh.name = `world.environment-density.forest-floor-detritus-${variant + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.variantId = FOREST_FLOOR_DETRITUS_PROFILE.variantIds[variant];
    mesh.userData.collisionRole = FOREST_FLOOR_DETRITUS_PROFILE.collisionRole;
    return mesh;
  });
  const meshIndices = geometries.map(() => 0);
  const random = seededRandom(9137);
  const placements = [];
  const colour = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const supportPoint = new THREE.Vector3();
  let supportVertexCount = 0;
  let supportedVertexCount = 0;
  let minimumClearance = Infinity;
  let maximumClearance = -Infinity;

  for (let index = 0; index < count; index += 1) {
    const heroLitter = index >= generalCount;
    const variant = heroLitter ? meshes.length - 1 : index % (meshes.length - 1);
    let settled = null;
    for (let attempt = 0; attempt < 320 && !settled; attempt += 1) {
      const source = heroLitter ? heroSource : sources[Math.floor(random() * sources.length)];
      let angle;
      let radius;
      if (heroLitter) {
        const heroIndex = index - generalCount;
        const rootAngles = FOREST_FLOOR_DETRITUS_PROFILE.heroRootAnglesRadians;
        const rootIndex = heroIndex % rootAngles.length;
        const startAngle = rootAngles[rootIndex];
        const endAngle = rootAngles[(rootIndex + 1) % rootAngles.length]
          + (rootIndex === rootAngles.length - 1 ? Math.PI * 2 : 0);
        angle = (startAngle + endAngle) * 0.5 + (random() - 0.5) * 0.28;
        radius = THREE.MathUtils.lerp(
          FOREST_FLOOR_DETRITUS_PROFILE.heroGingkoRadiusMeters[0],
          FOREST_FLOOR_DETRITUS_PROFILE.heroGingkoRadiusMeters[1],
          random() ** 0.78,
        );
      } else {
        angle = random() * Math.PI * 2;
        radius = 1.15 + random() ** 0.72 * (5.5 + source[2] * 1.35);
      }
      const x = source[0] + Math.cos(angle) * radius;
      const z = source[1] + Math.sin(angle) * radius * (
        heroLitter ? 1 : 0.72 + random() * 0.36
      );
      const sourceEcology = terrainEcologyAt(x, z);
      const sourceGradient = terrainGradient(x, z, 0.24);
      const ecology = {
        ...sourceEcology,
        slope: Number.isFinite(sourceEcology.slope)
          ? sourceEcology.slope
          : Math.hypot(sourceGradient.x, sourceGradient.z),
      };
      if (!acceptedEcology(ecology) || blocksPlacement(x, z)) continue;
      const candidate = {
        x,
        z,
        ecology,
        sourceIndex: heroLitter ? -1 : sources.indexOf(source),
        sourceRole: heroLitter ? 'hero-gingko-inter-root' : 'canopy-habitat',
      };
      const scale = heroLitter
        ? 0.64 + random() ** 1.1 * 0.28
        : 0.5 + random() ** 1.2 * 0.32;
      const yaw = random() * Math.PI * 2;
      const normal = new THREE.Vector3(-sourceGradient.x, 1, -sourceGradient.z).normalize();
      const align = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const turn = new THREE.Quaternion().setFromAxisAngle(normal, yaw);
      const quaternion = turn.multiply(align);
      const position = new THREE.Vector3(x, terrainHeight(x, z), z);
      const instanceScale = new THREE.Vector3(
        scale * (0.88 + random() * 0.24),
        scale,
        scale * (0.88 + random() * 0.24),
      );
      const matrix = new THREE.Matrix4().compose(position, quaternion, instanceScale);
      let requiredLift = -Infinity;
      for (const point of geometries[variant].userData.supportPoints) {
        supportPoint.fromArray(point).applyMatrix4(matrix);
        requiredLift = Math.max(
          requiredLift,
          terrainHeight(supportPoint.x, supportPoint.z)
            - FOREST_FLOOR_DETRITUS_PROFILE.burialDepth
            - supportPoint.y,
        );
      }
      position.y += requiredLift;
      matrix.compose(position, quaternion, instanceScale);
      const clearances = geometries[variant].userData.supportPoints.map((point) => {
        supportPoint.fromArray(point).applyMatrix4(matrix);
        return supportPoint.y - terrainHeight(supportPoint.x, supportPoint.z);
      });
      const instanceMinimumClearance = Math.min(...clearances);
      const instanceMaximumClearance = Math.max(...clearances);
      if (
        instanceMaximumClearance
          > FOREST_FLOOR_DETRITUS_PROFILE.maximumSupportClearance
      ) continue;
      settled = {
        candidate,
        scale,
        yaw,
        position,
        matrix,
        clearances,
        instanceMinimumClearance,
        instanceMaximumClearance,
      };
    }
    if (!settled) throw new Error(`could not place forest-floor detritus instance ${index}`);

    const {
      candidate,
      scale,
      yaw,
      position,
      matrix,
      clearances,
      instanceMinimumClearance,
      instanceMaximumClearance,
    } = settled;
    supportVertexCount += clearances.length;
    supportedVertexCount += clearances.filter((clearance) => (
      clearance <= FOREST_FLOOR_DETRITUS_PROFILE.maximumSupportClearance
    )).length;
    minimumClearance = Math.min(minimumClearance, instanceMinimumClearance);
    maximumClearance = Math.max(maximumClearance, instanceMaximumClearance);

    const instanceIndex = meshIndices[variant];
    meshes[variant].setMatrixAt(instanceIndex, matrix);
    const wetDarkening = candidate.ecology.wetBank * 0.1;
    if (candidate.sourceRole === 'hero-gingko-inter-root') {
      colour.setRGB(
        0.88 - wetDarkening + random() * 0.035,
        0.76 - wetDarkening + random() * 0.03,
        0.52 - wetDarkening + random() * 0.025,
      );
    } else {
      colour.setRGB(
        0.76 - wetDarkening + random() * 0.04,
        0.72 - wetDarkening + random() * 0.035,
        0.64 - wetDarkening + random() * 0.03,
      );
    }
    meshes[variant].setColorAt(instanceIndex, colour);
    meshIndices[variant] += 1;
    placements.push(Object.freeze({
      index,
      variantIndex: variant,
      variantId: FOREST_FLOOR_DETRITUS_PROFILE.variantIds[variant],
      x: candidate.x,
      y: position.y,
      z: candidate.z,
      scale,
      yaw,
      sourceIndex: candidate.sourceIndex,
      sourceRole: candidate.sourceRole,
      humus: candidate.ecology.humus,
      routeWear: candidate.ecology.routeWear,
      wetBank: candidate.ecology.wetBank,
      mineralExposure: candidate.ecology.mineralExposure,
      slope: candidate.ecology.slope,
      minimumSupportClearance: instanceMinimumClearance,
      maximumSupportClearance: instanceMaximumClearance,
    }));
  }

  meshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  const supportEvidence = Object.freeze({
    supportVertexCount,
    supportedVertexCount,
    supportRatio: supportVertexCount ? supportedVertexCount / supportVertexCount : 0,
    minimumClearance,
    maximumClearance,
    burialDepth: FOREST_FLOOR_DETRITUS_PROFILE.burialDepth,
  });
  group.add(...meshes);
  group.name = 'world.environment-density.forest-floor-detritus';
  group.userData = {
    profile: FOREST_FLOOR_DETRITUS_PROFILE.version,
    instanceCount: count,
    counts: Object.freeze(counts),
    drawCalls: FOREST_FLOOR_DETRITUS_PROFILE.drawCalls,
    geometries: Object.freeze(geometries),
    material,
    placements: Object.freeze(placements),
    sourceRoleCounts: Object.freeze({
      canopyHabitat: placements.filter(
        ({ sourceRole }) => sourceRole === 'canopy-habitat',
      ).length,
      heroGingkoInterRoot: placements.filter(
        ({ sourceRole }) => sourceRole === 'hero-gingko-inter-root',
      ).length,
    }),
    heroGingkoModel: Object.freeze({
      source: heroSource ? Object.freeze([...heroSource]) : null,
      radiusMeters: FOREST_FLOOR_DETRITUS_PROFILE.heroGingkoRadiusMeters,
      rootAnglesRadians: FOREST_FLOOR_DETRITUS_PROFILE.heroRootAnglesRadians,
      minimumRootAngularSeparationRadians:
        FOREST_FLOOR_DETRITUS_PROFILE.minimumRootAngularSeparationRadians,
      placement: 'inter-root-sectors-on-shared-rendered-terrain-tangent',
    }),
    supportEvidence,
    distributionModel: FOREST_FLOOR_DETRITUS_PROFILE.distributionModel,
    supportModel: FOREST_FLOOR_DETRITUS_PROFILE.supportModel,
    collisionRole: FOREST_FLOOR_DETRITUS_PROFILE.collisionRole,
  };
  return group;
}
