import * as THREE from 'three';

import {
  BROOK_FREE_SURFACE_PROFILE,
  BROOK_SURFACE_DRAW_PROFILE,
  buildBrookHydrology,
} from './brook-hydrology.js';
import { createBrookMaterial } from './brook-material.js';
import { PALETTE, seededRandom } from './config.js';
import {
  createDeadwoodMaterial,
  createDriftwoodGeometry,
} from './deadwood-rendering.js';
import { TRACK_IMPRESSION } from './environment-layout.js';
import {
  createWeatheredRockGeometry,
  renderedRockObstacleCandidate,
  settleRockOnTerrain,
} from './rock-rendering.js';
import {
  BROOK_CONTROL_POINTS,
  brookFluvialProcessAt,
  terrainEcologyAt,
  terrainGradient,
  terrainHeight,
} from './terrain.js';
import { terrainColorAt } from './terrain-surface.js';
import { soilTextures, waterTextures } from './terrain-material-textures.js';
import { primitive } from './world-rendering.js';

function trackWorldCoordinates(localX, localZ) {
  const cosine = Math.cos(TRACK_IMPRESSION.rotation);
  const sine = Math.sin(TRACK_IMPRESSION.rotation);
  return {
    x: TRACK_IMPRESSION.x + (cosine * localX + sine * localZ) * TRACK_IMPRESSION.scale,
    z: TRACK_IMPRESSION.z + (-sine * localX + cosine * localZ) * TRACK_IMPRESSION.scale,
  };
}

function makeHydrologicalRibbon(points, width, color, hydrology) {
  const vertices = [];
  const colors = [];
  const uvs = [];
  const flowDirections = [];
  const flowEnergies = [];
  const waterDepthMeters = [];
  const indices = [];
  const longitudinalSubdivisions = BROOK_FREE_SURFACE_PROFILE.longitudinalSubdivisions;
  const crossSectionVertices = BROOK_FREE_SURFACE_PROFILE.crossSectionVertices;
  const longitudinalRows = (points.length - 1) * longitudinalSubdivisions + 1;
  const current = new THREE.Vector3();
  const tangentStart = new THREE.Vector3();
  const tangentEnd = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let row = 0; row < longitudinalRows; row += 1) {
    const sourcePosition = row / longitudinalSubdivisions;
    const segment = Math.min(points.length - 2, Math.floor(sourcePosition));
    const interpolation = row === longitudinalRows - 1 ? 1 : sourcePosition - segment;
    current.lerpVectors(points[segment], points[segment + 1], interpolation);
    tangentStart.subVectors(
      points[Math.min(points.length - 1, segment + 1)],
      points[Math.max(0, segment - 1)],
    );
    tangentEnd.subVectors(
      points[Math.min(points.length - 1, segment + 2)],
      points[segment],
    );
    tangent.lerpVectors(tangentStart, tangentEnd, interpolation);
    const dx = tangent.x;
    const dz = tangent.z;
    const length = Math.hypot(dx, dz) || 1;
    const px = -dz / length;
    const pz = dx / length;
    const widthBreak = 0.9
      + Math.sin(sourcePosition * 1.71 + points.length * 0.13) * 0.08
      + Math.sin(sourcePosition * 0.63 + 1.4) * 0.045;
    const half = width * widthBreak * 0.5;
    const progress = row / (longitudinalRows - 1);
    const waterLevel = THREE.MathUtils.lerp(
      hydrology.waterLevels[segment],
      hydrology.waterLevels[segment + 1],
      interpolation,
    );
    const flowDirection = THREE.MathUtils.lerp(
      hydrology.flowDirections[segment],
      hydrology.flowDirections[segment + 1],
      interpolation,
    );
    const flowEnergy = THREE.MathUtils.lerp(
      hydrology.flowEnergies[segment],
      hydrology.flowEnergies[segment + 1],
      interpolation,
    );
    for (let crossIndex = 0; crossIndex < crossSectionVertices; crossIndex += 1) {
      const crossProgress = crossIndex / (crossSectionVertices - 1);
      const normalizedOffset = THREE.MathUtils.lerp(1.08, -1.08, crossProgress);
      const offset = half * normalizedOffset;
      const x = current.x + px * offset;
      const z = current.z + pz * offset;
      const alpha = 1 - THREE.MathUtils.smoothstep(Math.abs(normalizedOffset), 0.82, 1.08);
      vertices.push(x, waterLevel, z);
      colors.push(1, 1, 1, alpha);
      uvs.push(crossProgress, progress);
      flowDirections.push(flowDirection);
      flowEnergies.push(flowEnergy);
      waterDepthMeters.push(Math.max(0, waterLevel - terrainHeight(x, z)));
    }
    if (row < longitudinalRows - 1) {
      const currentOffset = row * crossSectionVertices;
      const nextOffset = (row + 1) * crossSectionVertices;
      for (let band = 0; band < crossSectionVertices - 1; band += 1) {
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
  geometry.setAttribute('flowDirection', new THREE.Float32BufferAttribute(flowDirections, 1));
  geometry.setAttribute('flowEnergy', new THREE.Float32BufferAttribute(flowEnergies, 1));
  geometry.setAttribute(
    'waterDepthMeters',
    new THREE.Float32BufferAttribute(waterDepthMeters, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
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
    // Only disturbed mud is allowed to replace the terrain surface. The old
    // radial alpha kept the entire carrier ellipse opaque, which rendered as a
    // pale circular "spotlight" around an otherwise physical print. Couple
    // coverage to pressure, displaced rim and standing water instead; the
    // outer radial fade is now only a safety feather at the mesh boundary.
    const radialFeather = 1 - THREE.MathUtils.smoothstep(normalizedRadius, 0.82, 1);
    const disturbanceCoverage = THREE.MathUtils.clamp(Math.max(
      inside * 0.96,
      rim,
      wetCompression * 0.9,
      puddle * 0.92,
    ), 0, 1);
    const alpha = radialFeather * disturbanceCoverage;
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
  return geometry;
}

function makeThreeToedTrack(scene) {
  const group = new THREE.Group();
  const trackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    roughnessMap: soilTextures.roughness,
    bumpMap: soilTextures.height,
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
  group.name = 'world.connected_route.three-toed-track';
  scene.add(group);
  return group;
}

function makeRouteAndBrook(scene) {
  const brookControlPoints = BROOK_CONTROL_POINTS
    .map(([x, z]) => new THREE.Vector3(x, 0, z));
  const brookPoints = smoothPath(brookControlPoints, 8);
  const brookHydrology = buildBrookHydrology(brookPoints, terrainHeight, { width: 3.4 });
  const brook = makeHydrologicalRibbon(
    brookPoints,
    3.4,
    PALETTE.water,
    brookHydrology,
  );
  brook.material.dispose();
  brook.material = createBrookMaterial(waterTextures, soilTextures);
  brook.name = 'world.connected_route.brook';
  // Draw the channel ahead of every standing transparent element. See
  // BROOK_SURFACE_DRAW_PROFILE: the ribbon's world-space vertices leave the mesh
  // origin at (0, 0, 0), so the default transparent sort could place the water
  // in front of the campfire flames it should sit behind.
  brook.renderOrder = BROOK_SURFACE_DRAW_PROFILE.surfaceRenderOrder;
  scene.add(brook);

  // The former 48 static torus arcs were screen dressing rather than water
  // motion: they neither advected nor responded to depth, grade or obstacles.
  // Keep a named zero-draw group for the quality/capture plumbing while all
  // visible ripple motion is resolved by the measured-column surface shader.
  const brookRipples = new THREE.Group();
  brookRipples.name = 'world.connected_route.brook-ripples';
  scene.add(brookRipples);

  const brookStoneCount = 56;
  const activeBedStoneCount = 36;
  const brookStoneGeometry = createWeatheredRockGeometry(1831, 1);
  const brookStones = new THREE.InstancedMesh(
    brookStoneGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x858e89,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.06,
      dithering: true,
    }),
    brookStoneCount,
  );
  const random = seededRandom(482);
  const dummy = new THREE.Object3D();
  const stoneColor = new THREE.Color();
  const brookStoneSupportEvidence = [];
  const brookObstacleCandidates = [];
  for (let index = 0; index < brookStoneCount; index += 1) {
    const depositionClass = index < activeBedStoneCount
      ? 'active-channel-bed-load'
      : 'inner-bend-point-bar-coarse-lag';
    let segment = 0;
    let point = null;
    let direction = null;
    let process = null;
    let ecology = null;
    for (let attempt = 0; attempt < 96; attempt += 1) {
      segment = Math.min(
        brookPoints.length - 2,
        Math.floor(random() * (brookPoints.length - 1)),
      );
      const t = random();
      point = brookPoints[segment].clone().lerp(brookPoints[segment + 1], t);
      direction = brookPoints[segment + 1].clone().sub(brookPoints[segment]);
      const acrossChannel = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
      if (depositionClass === 'active-channel-bed-load') {
        point.addScaledVector(acrossChannel, (random() - 0.5) * 2.8);
      } else {
        const bankSide = random() < 0.5 ? -1 : 1;
        point.addScaledVector(acrossChannel, bankSide * (3.2 + random() * 4.1));
      }
      process = brookFluvialProcessAt(point.x, point.z);
      ecology = terrainEcologyAt(point.x, point.z);
      const physicallyAccepted = depositionClass === 'active-channel-bed-load'
        ? process.distance <= 1.8
        : process.pointBar > 0.14
          && ecology.pointBarDeposit > 0.1
          && ecology.routeWear < 0.18;
      if (physicallyAccepted) break;
      point = null;
    }
    if (!point) {
      throw new Error(`Unable to place ${depositionClass} from brook process source`);
    }
    const scale = depositionClass === 'active-channel-bed-load'
      ? 0.08 + random() * 0.18
      : 0.07 + random() * 0.14;
    const flowYaw = Math.atan2(-direction.z, direction.x);
    const support = settleRockOnTerrain(dummy, brookStoneGeometry, {
      id: `brook-bed-cobble-${index + 1}`,
      x: point.x,
      z: point.z,
      yaw: flowYaw + (random() - 0.5) * 0.42,
      scale: [scale * (0.8 + random() * 0.6), scale * 0.55, scale],
      burial: 0.03,
      solid: false,
    });
    brookStoneSupportEvidence.push(Object.freeze({
      ...support,
      depositionClass,
      channelDistance: Number(process.distance.toFixed(4)),
      pointBarProcess: Number(process.pointBar.toFixed(4)),
      pointBarDeposit: Number(ecology.pointBarDeposit.toFixed(4)),
      routeWear: Number(ecology.routeWear.toFixed(4)),
    }));
    brookObstacleCandidates.push(renderedRockObstacleCandidate(
      support.id,
      depositionClass,
      brookStoneGeometry,
      dummy.matrix,
    ));
    brookStones.setMatrixAt(index, dummy.matrix);
    stoneColor.setHSL(0.41 + random() * 0.035, 0.06 + random() * 0.06, 0.2 + random() * 0.085);
    brookStones.setColorAt(index, stoneColor);
  }
  brookStones.name = 'world.connected_route.brook-stones';
  brookStones.castShadow = true;
  brookStones.receiveShadow = true;
  brookStones.material.userData.mapping = 'no-spherical-uv-texture-sampling';
  brookStones.userData.collisionRole = 'non-solid-sub-step-stream-bed-decor';
  scene.add(brookStones);

  const driftwoodCount = 10;
  const driftwoodMaterial = createDeadwoodMaterial({ wet: true });
  const driftwoodCounts = [4, 3, 3];
  const driftwoodMeshes = driftwoodCounts.map((count, variant) => (
    new THREE.InstancedMesh(createDriftwoodGeometry(variant), driftwoodMaterial, count)
  ));
  const driftwoodIndices = [0, 0, 0];
  const driftwoodColor = new THREE.Color();
  const driftwoodRandom = seededRandom(1169);
  const driftwoodSupportPoint = new THREE.Vector3();
  const driftwoodTerrainNormal = new THREE.Vector3();
  const driftwoodSlopeFrame = new THREE.Quaternion();
  const driftwoodYawFrame = new THREE.Quaternion();
  const driftwoodSupportEvidence = {
    instanceCount: 0,
    supportSampleCount: 0,
    minimumClearance: Infinity,
    maximumClearance: -Infinity,
    maximumTerrainSlope: 0,
  };
  const measureDriftwoodSupport = (geometry) => {
    let minimumClearance = Infinity;
    let maximumClearance = -Infinity;
    for (const coordinates of geometry.userData.supportPoints) {
      driftwoodSupportPoint.set(...coordinates).applyMatrix4(dummy.matrix);
      const clearance = driftwoodSupportPoint.y
        - terrainHeight(driftwoodSupportPoint.x, driftwoodSupportPoint.z);
      minimumClearance = Math.min(minimumClearance, clearance);
      maximumClearance = Math.max(maximumClearance, clearance);
    }
    return { minimumClearance, maximumClearance };
  };
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
    const gradient = terrainGradient(point.x, point.z, 0.45);
    const terrainSlopeAtPlacement = Math.hypot(gradient.x, gradient.z);
    driftwoodTerrainNormal.set(-gradient.x, 1, -gradient.z).normalize();
    driftwoodSlopeFrame.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      driftwoodTerrainNormal,
    );
    driftwoodYawFrame.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.atan2(direction.z, direction.x) + (driftwoodRandom() - 0.5) * 0.75,
    );
    dummy.position.set(point.x, terrainHeight(point.x, point.z) + 0.12, point.z);
    dummy.quaternion.multiplyQuaternions(driftwoodSlopeFrame, driftwoodYawFrame);
    const scale = 0.72 + driftwoodRandom() * 0.58;
    dummy.scale.set(
      scale * (0.91 + driftwoodRandom() * 0.18),
      scale * (0.9 + driftwoodRandom() * 0.16),
      scale * (0.91 + driftwoodRandom() * 0.18),
    );
    dummy.updateMatrix();
    const variant = index % driftwoodMeshes.length;
    const driftwood = driftwoodMeshes[variant];
    const instanceIndex = driftwoodIndices[variant];
    let support = measureDriftwoodSupport(driftwood.geometry);
    dummy.position.y -= support.maximumClearance - 0.008;
    dummy.updateMatrix();
    support = measureDriftwoodSupport(driftwood.geometry);
    if (support.maximumClearance > 0.016 || support.minimumClearance < -0.12) {
      throw new Error(`could not gravity-settle brook driftwood instance ${index}`);
    }
    driftwood.setMatrixAt(instanceIndex, dummy.matrix);
    driftwoodColor.setHSL(
      0.075 + driftwoodRandom() * 0.035,
      0.035 + driftwoodRandom() * 0.025,
      0.54 + driftwoodRandom() * 0.07,
    );
    driftwood.setColorAt(instanceIndex, driftwoodColor);
    driftwoodIndices[variant] += 1;
    driftwoodSupportEvidence.instanceCount += 1;
    driftwoodSupportEvidence.supportSampleCount += driftwood.geometry.userData.supportPoints.length;
    driftwoodSupportEvidence.minimumClearance = Math.min(
      driftwoodSupportEvidence.minimumClearance,
      support.minimumClearance,
    );
    driftwoodSupportEvidence.maximumClearance = Math.max(
      driftwoodSupportEvidence.maximumClearance,
      support.maximumClearance,
    );
    driftwoodSupportEvidence.maximumTerrainSlope = Math.max(
      driftwoodSupportEvidence.maximumTerrainSlope,
      terrainSlopeAtPlacement,
    );
  }
  driftwoodMeshes.forEach((driftwood, index) => {
    driftwood.name = index === 0
      ? 'world.connected_route.brook-driftwood'
      : `world.connected_route.brook-driftwood-variant-${index + 1}`;
    driftwood.castShadow = true;
    driftwood.receiveShadow = true;
    driftwood.userData.supportModel = driftwood.geometry.userData.supportModel;
    driftwood.userData.collisionRole = 'non-solid-visual-accent';
    driftwood.userData.moistureClass = driftwoodMaterial.userData.moistureClass;
  });
  scene.add(...driftwoodMeshes);
  makeThreeToedTrack(scene);

  return {
    brook,
    brookHydrology,
    driftwood: driftwoodMeshes,
    driftwoodSupportEvidence: Object.freeze(driftwoodSupportEvidence),
    brookRipples,
    brookStones,
    brookPoints,
    brookObstacleCandidates: Object.freeze(brookObstacleCandidates),
  };
}

export { makeRouteAndBrook };
