import * as THREE from 'three';

import { seededRandom } from './config.js';
import { createDeadwoodMaterial, createDriftwoodGeometry } from './deadwood-rendering.js';
import { createWeatheredRockGeometry } from './rock-rendering.js';
import { brookFluvialProcessAt, terrainHeight } from './terrain.js';
import { createGroundLayers } from './ground-layers.js';
import { createGroundMaterial } from './terrain-ground-material.js';
import { shared } from './vegetation-rendering.js';

export const RIVER_ROOM_PROFILE = Object.freeze({
  terraces: 4,
  pointBars: 2,
  backwaters: 2,
  meadowMats: 4,
  meadowTufts: 360,
  bankSedges: 72,
  libraryFerns: 40,
  terraceTrees: 52,
  boundaryRocks: 16,
  boundaryDeadwood: 8,
  collisionRole: 'non-solid-scenic-landform',
});

function makeTerraceRibbon({ name, points, outward, width, height, seed }, groundTextures) {
  const random = seededRandom(seed);
  const positions = [];
  const colors = [];
  const indices = [];
  const lower = new THREE.Color(0x4f3328);
  const lowerFace = new THREE.Color(0x6b412f);
  const upperFace = new THREE.Color(0x805039);
  const top = new THREE.Color(0x40533f);
  const sampledPoints = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
    0.5,
  ).getSpacedPoints((points.length - 1) * 4);

  sampledPoints.forEach(({ x, z }, station) => {
    const base = terrainHeight(x, z) - 0.12;
    const rise = height * (0.78 + random() * 0.34);
    const lowerX = x + outward[0] * (1.4 + random() * 0.65);
    const lowerZ = z + outward[1] * (1.4 + random() * 0.65);
    const shoulderX = x + outward[0] * (3.5 + random() * 1.1);
    const shoulderZ = z + outward[1] * (3.5 + random() * 1.1);
    const backX = x + outward[0] * (width + random() * 2.5);
    const backZ = z + outward[1] * (width + random() * 2.5);
    const row = [
      [x, base, z, lower],
      [lowerX, base + rise * (0.3 + random() * 0.08), lowerZ, lowerFace],
      [shoulderX, base + rise, shoulderZ, upperFace],
      [
        backX,
        base + rise + Math.min(height * 0.12, 0.3) + random() * Math.min(height * 0.08, 0.25),
        backZ,
        top,
      ],
    ];
    row.forEach(([px, py, pz, baseColor], lane) => {
      positions.push(px, py, pz);
      const tint = baseColor.clone().offsetHSL(
        (random() - 0.5) * 0.012,
        (random() - 0.5) * 0.035,
        (random() - 0.5) * 0.045 + (lane === 1 ? 0.025 : 0),
      );
      colors.push(tint.r, tint.g, tint.b);
    });
    if (station === 0) return;
    const previous = (station - 1) * 4;
    const current = station * 4;
    for (let lane = 0; lane < 3; lane += 1) {
      indices.push(
        previous + lane, current + lane, previous + lane + 1,
        current + lane, current + lane + 1, previous + lane + 1,
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createGroundMaterial(groundTextures, {
    masks: { rock: 0.8, mud: 0.5, moss: 0.35, litter: 0.2 },
    side: THREE.DoubleSide,
    tileMeters: 5.5,
  });
  const terrace = new THREE.Mesh(geometry, material);
  terrace.name = name;
  terrace.castShadow = true;
  terrace.receiveShadow = true;
  terrace.userData.collisionRole = RIVER_ROOM_PROFILE.collisionRole;
  terrace.userData.authoredRiseMeters = height;
  return terrace;
}

function makeGroundPatch(name, x, z, radiusX, radiusZ, seed, palette, groundTextures) {
  const random = seededRandom(seed);
  const segments = 72;
  const rings = 10;
  const isWater = name.includes('backwater');
  // A dry patch ends at the brook bank: inside the wetted channel its vertices
  // sink under the terrain, so the water lies over the channel bed, never over
  // a sheet of meadow with a straight polygon edge.
  const surfaceY = (px, pz) => {
    const lift = terrainHeight(px, pz) + 0.055;
    if (isWater) return lift;
    const channel = 1 - THREE.MathUtils.smoothstep(brookFluvialProcessAt(px, pz).distance, 1.9, 2.7);
    return lift - channel * 0.25;
  };
  const positions = [x, terrainHeight(x, z) + 0.045, z];
  const colors = [];
  const indices = [];
  const centre = new THREE.Color(palette[0]);
  colors.push(centre.r, centre.g, centre.b);
  const edgeShape = Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return 0.82 + random() * 0.28 + Math.sin(angle * 3 + seed) * 0.07;
  });
  const edgeColors = Array.from({ length: segments }, (_, index) => {
    const color = new THREE.Color(palette[1 + (index % (palette.length - 1))]);
    color.offsetHSL(0, (random() - 0.5) * 0.04, (random() - 0.5) * 0.055);
    return color;
  });
  for (let ring = 1; ring <= rings; ring += 1) {
    const radial = ring / rings;
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      const scallop = THREE.MathUtils.lerp(1, edgeShape[index], radial);
      const px = x + Math.cos(angle) * radiusX * scallop * radial;
      const pz = z + Math.sin(angle) * radiusZ * scallop * radial;
      positions.push(px, surfaceY(px, pz), pz);
      const color = centre.clone().lerp(edgeColors[index], radial);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(0, 1 + index, 1 + next);
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const inner = 1 + (ring - 1) * segments;
    const outer = 1 + ring * segments;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(
        inner + index, outer + index, inner + next,
        outer + index, outer + next, inner + next,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const isMeadow = name.includes('meadow');
  const material = createGroundMaterial(groundTextures, {
    masks: isWater
      ? { mud: 1, gravel: 0.25, wet: 1 }
      : isMeadow ? { moss: 0.8, litter: 0.45 } : { gravel: 1, mud: 0.35, wet: 0.25 },
    side: THREE.DoubleSide,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -2;
  const patch = new THREE.Mesh(geometry, material);
  patch.name = name;
  patch.receiveShadow = true;
  patch.userData.collisionRole = 'non-solid-surface-read';
  return patch;
}

function makeMeadowTufts() {
  const group = new THREE.Group();
  group.name = 'world.river-room.meadow-tuft-masses';
  const random = seededRandom(8011);
  const clusters = [
    { x: -18, z: -7, radiusX: 10.2, radiusZ: 16.2, density: 1.08 },
    { x: 19, z: -8, radiusX: 7.2, radiusZ: 15.2, density: 0.92 },
    { x: -21, z: -39, radiusX: 8.2, radiusZ: 12.4, density: 1.18 },
    { x: 21, z: -42, radiusX: 6.2, radiusZ: 11.4, density: 0.88 },
  ];
  const counts = shared.groundCoverGeometries.map((_, variant) => (
    Math.floor((RIVER_ROOM_PROFILE.meadowTufts + 2 - variant) / 3)
  ));
  // Same lit, sun-transmitting foliage material and lightness range as the
  // bank sedges: a dark tint on a dark base read as near-black cut-outs.
  const meshes = shared.groundCoverGeometries.map((geometry, variant) => {
    const mesh = new THREE.InstancedMesh(geometry, shared.fernMaterial, counts[variant]);
    mesh.name = `world.river-room.meadow-tufts-${variant + 1}`;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-pliant-meadow';
    return mesh;
  });
  const indices = [0, 0, 0];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let index = 0; index < RIVER_ROOM_PROFILE.meadowTufts; index += 1) {
    const cluster = clusters[index % clusters.length];
    const variant = index % meshes.length;
    const angle = random() * Math.PI * 2;
    // A square-root radius fills each authored meadow rather than making a
    // ring of evenly spaced props. The route and family remain in the gaps
    // between these four offset masses.
    const radius = Math.sqrt(random()) * (0.35 + cluster.density * 0.65);
    const x = cluster.x + Math.cos(angle) * cluster.radiusX * radius;
    const z = cluster.z + Math.sin(angle) * cluster.radiusZ * radius;
    const scale = (variant === 2 ? 0.72 : 0.68) + random() * (variant === 2 ? 0.52 : 0.62);
    dummy.position.set(x, terrainHeight(x, z) + 0.045, z);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.08);
    dummy.scale.set(scale * (0.72 + random() * 0.42), scale, scale * (0.8 + random() * 0.36));
    dummy.updateMatrix();
    const meshIndex = indices[variant];
    meshes[variant].setMatrixAt(meshIndex, dummy.matrix);
    color.setHSL(
      0.22 + random() * 0.07,
      0.26 + random() * 0.12,
      0.23 + random() * 0.08,
    );
    meshes[variant].setColorAt(meshIndex, color);
    indices[variant] += 1;
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  group.add(...meshes);
  return group;
}

function makeBankSedges() {
  const mesh = new THREE.InstancedMesh(
    shared.groundCoverGeometries[1],
    shared.fernMaterial,
    RIVER_ROOM_PROFILE.bankSedges,
  );
  const random = seededRandom(9271);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const clusters = [
    [-18, -25, 7, 12], [-16, -44, 8, 9], [-4, -17, 7, 8],
    [16, -28, 6, 11], [20, -46, 7, 8], [-15, 7, 7, 10],
  ];
  for (let index = 0; index < RIVER_ROOM_PROFILE.bankSedges; index += 1) {
    const [cx, cz, rx, rz] = clusters[index % clusters.length];
    const angle = random() * Math.PI * 2;
    const radius = 0.55 + random() * 0.5;
    const x = cx + Math.cos(angle) * rx * radius;
    const z = cz + Math.sin(angle) * rz * radius;
    const scale = 1.2 + random() * 1.65;
    dummy.position.set(x, terrainHeight(x, z) + 0.04, z);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.1);
    dummy.scale.set(scale * (0.55 + random() * 0.2), scale, scale * 0.72);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.2 + random() * 0.07, 0.26 + random() * 0.08, 0.36 + random() * 0.12);
    mesh.setColorAt(index, color);
  }
  mesh.name = 'world.river-room.bank-sedge-masses';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.collisionRole = 'non-solid-visual-accent';
  return mesh;
}

function makeFernPlacements() {
  const random = seededRandom(7213);
  const clusters = [
    [-19, -20, 6, 9], [-18, -42, 7, 8], [17, -20, 5, 8],
    [20, -44, 6, 8], [-13, 4, 5, 8], [13, 2, 5, 7],
  ];
  return Object.freeze(Array.from({ length: RIVER_ROOM_PROFILE.libraryFerns }, (_, index) => {
    const [cx, cz, rx, rz] = clusters[index % clusters.length];
    const angle = random() * Math.PI * 2;
    const x = cx + Math.cos(angle) * rx * (0.35 + random() * 0.65);
    const z = cz + Math.sin(angle) * rz * (0.35 + random() * 0.65);
    const scale = 0.72 + random() * 0.5;
    return Object.freeze({
      index,
      x,
      z,
      scale,
      variantIndex: index % 3,
      rotation: random() * Math.PI * 2,
      instanceScale: Object.freeze([scale * (0.82 + random() * 0.24), scale, scale]),
      color: Object.freeze([0.29 + random() * 0.045, 0.42 + random() * 0.09, 0.13 + random() * 0.045]),
      sourceRole: 'river-room-authored-bank-mass',
      maxDiameterMeters: 3.4,
      maxHeightMeters: 2.4,
    });
  }));
}

function makeTerraceTreePlacements() {
  const random = seededRandom(8167);
  const bands = [
    { from: [30.5, 20], to: [30.7, -62], side: 1, scale: [1.18, 1.92] },
    { from: [-44.2, 20], to: [-44.4, -62], side: -1, scale: [1.08, 1.76] },
    { from: [-38, -94], to: [-8, -94], side: 0, scale: [0.72, 1.18] },
    { from: [8, -94], to: [42, -94], side: 0, scale: [0.7, 1.22] },
  ];
  return Object.freeze(Array.from({ length: RIVER_ROOM_PROFILE.terraceTrees }, (_, index) => {
    const band = bands[index % bands.length];
    const progress = (Math.floor(index / bands.length) + 0.25 + random() * 0.5)
      / Math.ceil(RIVER_ROOM_PROFILE.terraceTrees / bands.length);
    const x = THREE.MathUtils.lerp(band.from[0], band.to[0], progress)
      + (random() - 0.5) * (band.side === 0 ? 3.5 : 2.2)
      + band.side * (2.5 + random() * 5);
    const z = THREE.MathUtils.lerp(band.from[1], band.to[1], progress)
      + (random() - 0.5) * (band.side === 0 ? 3 : 4.5);
    return Object.freeze({
      index,
      x,
      z,
      scale: THREE.MathUtils.lerp(band.scale[0], band.scale[1], random()),
      trunkYaw: random() * Math.PI * 2,
      leafFamily: index % 5 === 0 ? 'compound-lanceolate' : 'elliptic-waxy',
      successionAgeClass: index % 6 === 0 ? 'pioneer' : index % 3 === 0 ? 'submature' : 'mature',
      successionWindDamage: 0.03 + random() * 0.22,
      openCanopyExposure: index % 7 === 0,
      isAraucaria: index % 9 === 0,
    });
  }));
}

function makeBoundaryStillLife() {
  const group = new THREE.Group();
  group.name = 'world.river-room.boundary-still-life';
  const random = seededRandom(9053);
  const rockGeometry = createWeatheredRockGeometry(9059, 1);
  const rocks = new THREE.InstancedMesh(
    rockGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x40443d,
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
      envMapIntensity: 0.18,
    }),
    RIVER_ROOM_PROFILE.boundaryRocks,
  );
  const deadwood = new THREE.InstancedMesh(
    createDriftwoodGeometry(2),
    createDeadwoodMaterial({ wet: false }),
    RIVER_ROOM_PROFILE.boundaryDeadwood,
  );
  const dummy = new THREE.Object3D();
  const clusters = [
    { x: 31.2, z: -4, spreadX: 2.4, spreadZ: 12 },
    { x: 31.4, z: -39, spreadX: 2.8, spreadZ: 13 },
    { x: -44.6, z: -10, spreadX: 2.6, spreadZ: 14 },
    { x: -44.8, z: -47, spreadX: 2.4, spreadZ: 11 },
  ];
  for (let index = 0; index < RIVER_ROOM_PROFILE.boundaryRocks; index += 1) {
    const cluster = clusters[index % clusters.length];
    const x = cluster.x + (random() - 0.5) * cluster.spreadX;
    const z = cluster.z + (random() - 0.5) * cluster.spreadZ;
    const scale = 0.5 + random() * 1.15;
    dummy.position.set(x, terrainHeight(x, z) + scale * 0.16, z);
    dummy.rotation.set(random() * 0.24, random() * Math.PI * 2, random() * 0.2);
    dummy.scale.set(scale * (0.8 + random() * 0.7), scale * 0.62, scale);
    dummy.updateMatrix();
    rocks.setMatrixAt(index, dummy.matrix);
  }
  for (let index = 0; index < RIVER_ROOM_PROFILE.boundaryDeadwood; index += 1) {
    const cluster = clusters[index % clusters.length];
    const x = cluster.x + (random() - 0.5) * cluster.spreadX;
    const z = cluster.z + (random() - 0.5) * cluster.spreadZ;
    const scale = 0.9 + random() * 0.7;
    dummy.position.set(x, terrainHeight(x, z) + 0.12, z);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.16);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    deadwood.setMatrixAt(index, dummy.matrix);
  }
  for (const mesh of [rocks, deadwood]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-unreachable-boundary-scenery';
  }
  rocks.name = 'world.river-room.boundary-rock-groups';
  deadwood.name = 'world.river-room.boundary-deadwood-groups';
  group.add(rocks, deadwood);
  return group;
}

export function makeRiverRoomLandforms(scene, groundLayers = createGroundLayers()) {
  const groundTextures = groundLayers.textures;
  const group = new THREE.Group();
  group.name = 'world.river-room.incised-basin';
  group.userData.profile = RIVER_ROOM_PROFILE;
  const terraces = [
    makeTerraceRibbon({ name: 'world.river-room.east-red-earth-terrace', points: [[30.6, 8], [30.8, -6], [30.5, -20], [30.9, -35], [30.6, -52]], outward: [1, 0], width: 18, height: 5.4, seed: 4101 }, groundTextures),
    makeTerraceRibbon({ name: 'world.river-room.west-wet-terrace', points: [[-25, 12], [-23, -3], [-26, -18], [-24, -35], [-28, -51]], outward: [-1, 0], width: 5, height: 0.28, seed: 4117 }, groundTextures),
    makeTerraceRibbon({ name: 'world.river-room.far-terrace-west', points: [[-36, -91], [-28, -91.4], [-20, -91.2], [-10, -91.5]], outward: [0, -1], width: 18, height: 6.2, seed: 4133 }, groundTextures),
    makeTerraceRibbon({ name: 'world.river-room.far-terrace-east', points: [[8, -91.5], [18, -91.2], [28, -91.6], [38, -91.3]], outward: [0, -1], width: 18, height: 6.4, seed: 4153 }, groundTextures),
  ];
  const pointBars = [
    makeGroundPatch('world.river-room.family-point-bar', -7.5, -31, 10, 15, 611, [0x7f7458, 0x9c8a60, 0x655f4b], groundTextures),
    makeGroundPatch('world.river-room.track-point-bar', -10.5, 19, 7.5, 12, 641, [0x766d55, 0x927f58, 0x5e5948], groundTextures),
  ];
  const backwaters = [
    makeGroundPatch('world.river-room.backwater-west', -19, -29, 4.8, 8.5, 677, [0x5a9694, 0x76b7b0, 0x3f7778], groundTextures),
    makeGroundPatch('world.river-room.backwater-south', -8, -49, 5.6, 5.2, 691, [0x568c8e, 0x79b4ad, 0x3c7074], groundTextures),
  ];
  const meadowMats = [
    makeGroundPatch('world.river-room.meadow-near-west', -18, -7, 11, 18, 733, [0x506044, 0x687650, 0x3f523b], groundTextures),
    makeGroundPatch('world.river-room.meadow-near-east', 19, -8, 8, 17, 751, [0x596449, 0x71805a, 0x46553e], groundTextures),
    makeGroundPatch('world.river-room.meadow-family-west', -21, -39, 9, 14, 769, [0x4b5e43, 0x65754f, 0x3d503a], groundTextures),
    makeGroundPatch('world.river-room.meadow-family-east', 21, -42, 7, 13, 787, [0x536448, 0x6a7952, 0x40533c], groundTextures),
  ];
  const bankSedges = makeBankSedges();
  const meadowTufts = makeMeadowTufts();
  const boundaryStillLife = makeBoundaryStillLife();
  const canopyAssetAnchor = new THREE.Group();
  canopyAssetAnchor.name = 'world.river-room.terrace-canopy-asset-anchor';
  group.add(
    ...terraces,
    ...pointBars,
    ...backwaters,
    ...meadowMats,
    meadowTufts,
    bankSedges,
    boundaryStillLife,
    canopyAssetAnchor,
  );
  group.userData.fernLibraryPlacements = makeFernPlacements();
  group.userData.canopyTreePlacements = makeTerraceTreePlacements();
  group.userData.canopyAssetAnchor = canopyAssetAnchor;
  group.userData.proceduralFallbackMeshes = Object.freeze([bankSedges]);
  scene.add(group);
  return group;
}
