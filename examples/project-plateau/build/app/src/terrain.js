import {
  COVER_ARCH_LAYOUT,
  HABITAT_TREE_LAYOUT,
  HERO_GINGKO_LAYOUT,
  VEGETATION_LAYOUT,
} from './environment-layout.js';

const TERRAIN_SEED = 1847;
const BASALT_ESCARPMENT_RISE_START_X = 29.15;
const BASALT_ESCARPMENT_FULL_RISE_X = 32.5;
const BASALT_ESCARPMENT_ELEVATION_METERS = 3.15;
const SMOOTHSTEP_MAXIMUM_DERIVATIVE = 1.5;
export const BASALT_ESCARPMENT_PROFILE = Object.freeze({
  riseStartX: BASALT_ESCARPMENT_RISE_START_X,
  fullRiseX: BASALT_ESCARPMENT_FULL_RISE_X,
  elevationMeters: BASALT_ESCARPMENT_ELEVATION_METERS,
  transitionRunMeters: Number(
    (BASALT_ESCARPMENT_FULL_RISE_X - BASALT_ESCARPMENT_RISE_START_X).toFixed(3),
  ),
  maximumAnalyticGradient: Number((
    BASALT_ESCARPMENT_ELEVATION_METERS
    * SMOOTHSTEP_MAXIMUM_DERIVATIVE
    / (BASALT_ESCARPMENT_FULL_RISE_X - BASALT_ESCARPMENT_RISE_START_X)
  ).toFixed(6)),
  sourceZs: Object.freeze([-50, -26, -3]),
  topology: 'continuous-heightfield-no-overhang',
  stabilityModel: 'smoothstep-rise-bounded-by-intact-bedrock-slope-limit',
});

const LOOSE_REGOLITH_ANGLE_DEGREES = 34;
const FULL_BEDROCK_ANGLE_DEGREES = 55;
export const EAST_ESCARPMENT_SURFACE_PROFILE = Object.freeze({
  model: 'angle-of-repose-bedrock-exposure-and-source-coupled-colluvium',
  looseRegolithAngleDegrees: LOOSE_REGOLITH_ANGLE_DEGREES,
  looseRegolithGradient: Number(
    Math.tan(LOOSE_REGOLITH_ANGLE_DEGREES * Math.PI / 180).toFixed(6),
  ),
  fullBedrockAngleDegrees: FULL_BEDROCK_ANGLE_DEGREES,
  fullBedrockGradient: Number(
    Math.tan(FULL_BEDROCK_ANGLE_DEGREES * Math.PI / 180).toFixed(6),
  ),
  colluviumToeReachMeters: 6.5,
  bedrockReliefScale: 0.58,
  jointModel: 'source-basalt-joints-with-bounded-optical-relief',
  stratificationModel: 'world-height-bed-contacts-gated-by-source-bedrock-exposure',
  stratificationPeriodsMeters: Object.freeze([0.58, 1.74]),
  maximumStratificationAlbedoReduction: 0.11,
  overlayGeometryCount: 0,
  slopeSource: 'rendered-heightfield-normal-not-sub-grid-analytic-probe',
  massTransfer: 'unstable-regolith-exposes-source-bedrock-and-stable-toe-retains-colluvium',
});

export const TERRAIN_GEOMORPHOLOGY_PROFILE = Object.freeze({
  model: 'named-process-relief-brook-incision-meander-bars-cutbanks-and-glade-terrace',
  brookIncisionDepthMeters: 0.22,
  pointBarAccretionMeters: 0.34,
  cutBankErosionMeters: 0.14,
  alluvialBenchHeightMeters: 0.22,
  gladeTerraceRiserMeters: 0.62,
  topology: 'single-cpu-heightfield-shared-by-rendering-collision-placement-and-hydrology',
});

export const TERRAIN_FLUVIAL_SURFACE_PROFILE = Object.freeze({
  model: 'meander-energy-sorted-point-bar-floodplain-silt-and-cut-bank-exposure',
  processSource: 'shared-brook-control-line-heightfield-and-bank-curvature',
  bankSurfaceModel: 'terrain-integrated-wet-bank-point-bar-floodplain-and-cut-bank-fields',
  bankTopology: 'single-shared-render-and-collision-heightfield',
  bankOverlayGeometryCount: 0,
  bankOverlayDrawCalls: 0,
  wetBankRoughnessRange: Object.freeze([0.76, 0.99]),
  contactModel: 'water-feather-over-shared-terrain-bank-no-raised-ribbon',
  pointBarMaterial: 'inner-bend-coarse-sand-and-rounded-fine-gravel',
  floodplainMaterial: 'low-energy-overbank-silt-and-clay',
  cutBankMaterial: 'outer-bend-exposed-cohesive-subsoil',
  pointBarReliefAmplitudeMeters: 0.13,
  floodplainReliefAmplitudeMeters: 0.045,
  cutBankReliefAmplitudeMeters: 0.11,
  grainOrdering: 'cut-bank-erosion-to-bed-load-to-inner-bend-lag-to-overbank-fines',
});

const freezeControlLine = (points) => Object.freeze(
  points.map(([x, z]) => Object.freeze([x, z])),
);

// These source lines are shared by navigation, the brook and the ground-process
// model. A travelled route is rendered by compaction inside the terrain
// material itself; it is not a second transparent ribbon laid above the soil.
export const BROOK_CONTROL_POINTS = freezeControlLine([
  [-14, 88], [-11, 69], [-16, 51], [-10, 33], [-13, 15], [-7, -4],
  [-12, -22], [-8, -39], [-15, -58], [-11, -78],
]);
export const MAIN_ROUTE_CONTROL_POINTS = freezeControlLine([
  [3, 88], [4, 67], [0, 50], [8, 31], [11, 12], [4, -8], [10, -31], [3, -54],
]);
export const COVERED_FORK_CONTROL_POINTS = freezeControlLine([
  [5, 35], [-4, 25], [-12, 13], [-10, 1], [0, -13],
]);
export const EXPOSED_FORK_CONTROL_POINTS = freezeControlLine([
  [5, 35], [13, 25], [20, 13], [18, 0], [7, -14],
]);

export const TERRAIN_ROUTE_SURFACE_PROFILE = Object.freeze({
  version: 'terrain-integrated-footfall-compaction-v1',
  source: 'three-authored-navigation-control-lines',
  topology: 'single-shared-render-and-collision-heightfield',
  surfaceResponse: 'litter-suppression-colour-compaction-relief-and-roughness',
  overlayGeometryCount: 0,
  overlayDrawCalls: 0,
  collisionChange: 'none',
  mainRouteInfluenceMeters: Object.freeze([1.4, 3.25]),
  coveredForkInfluenceMeters: Object.freeze([1.05, 2.55]),
  exposedForkInfluenceMeters: Object.freeze([1.15, 2.8]),
});

export const TERRAIN_BRYOPHYTE_PROFILE = Object.freeze({
  model: 'canopy-shade-moisture-hollow-and-stable-substrate-bryophyte-establishment',
  sourceCanopyKinds: Object.freeze([
    '128-main-canopy-trees',
    '12-habitat-tree-ferns',
    '5-cover-arches',
    '1-hero-gingko',
  ]),
  exclusions: Object.freeze([
    'route-compaction',
    'unstable-mineral-exposure',
    'active-point-bar-reworking',
    'cut-bank-erosion',
  ]),
  topology: 'thin-living-cover-inside-shared-terrain-material-no-overlay-geometry',
  collisionChange: 'none',
});

const GROUND_PROCESS_PROFILE = Object.freeze({
  model: 'source-coupled-canopy-litter-hydrology-slope-and-footfall',
  canopySources: VEGETATION_LAYOUT.trees.length
    + HABITAT_TREE_LAYOUT.length
    + COVER_ARCH_LAYOUT.length
    + 1,
  routeLines: 3,
  brookLines: 1,
  randomMasks: 0,
  bryophyteModel: TERRAIN_BRYOPHYTE_PROFILE.model,
});

export const TERRAIN_ECOLOGY_PROFILE = GROUND_PROCESS_PROFILE;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const normalized = clamp((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function hash2d(x, z, seed) {
  let value = Math.imul(x | 0, 374761393)
    + Math.imul(z | 0, 668265263)
    + Math.imul(seed | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 2147483647.5 - 1;
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const ux = tx * tx * (3 - 2 * tx);
  const uz = tz * tz * (3 - 2 * tz);
  const lower = hash2d(x0, z0, seed) * (1 - ux) + hash2d(x0 + 1, z0, seed) * ux;
  const upper = hash2d(x0, z0 + 1, seed) * (1 - ux)
    + hash2d(x0 + 1, z0 + 1, seed) * ux;
  return lower * (1 - uz) + upper * uz;
}

function fbm(x, z, seed, octaves = 4) {
  let amplitude = 0.56;
  let frequency = 1;
  let total = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / normalization;
}

export function terrainVariation(x, z) {
  const warpX = fbm(x * 0.009 + 7.1, z * 0.009 - 3.4, TERRAIN_SEED + 17, 3) * 10;
  const warpZ = fbm(x * 0.009 - 8.3, z * 0.009 + 5.6, TERRAIN_SEED + 43, 3) * 8;
  const warpedX = x + warpX;
  const warpedZ = z + warpZ;
  const broad = fbm(warpedX * 0.012, warpedZ * 0.012, TERRAIN_SEED, 4);
  const rolling = fbm(warpedX * 0.031, warpedZ * 0.031, TERRAIN_SEED + 271, 3);
  const hummocks = fbm(warpedX * 0.072, warpedZ * 0.072, TERRAIN_SEED + 593, 2);
  return broad * 0.66 + rolling * 0.27 + hummocks * 0.07;
}

export function basaltSourceContinuity(z) {
  const sourceBand = BASALT_ESCARPMENT_PROFILE.sourceZs.reduce((strongest, sourceZ) => (
    Math.max(strongest, Math.exp(-((z - sourceZ) ** 2) / (2 * 18 ** 2)))
  ), 0);
  return smoothstep(0.22, 0.72, sourceBand);
}

export function basaltEscarpmentHeight(x, z) {
  // The red formations belong to one raised eastern geological shoulder. The
  // transition begins exactly at the non-playable side of the x=29 navigation
  // boundary, so traversal remains unchanged while the visible cliff no longer
  // reads as isolated props planted on the basin floor. The smoothstep run is
  // long enough that its maximum derivative stays within the declared intact-
  // bedrock slope limit instead of producing an implausible near-vertical wall.
  // The player's capsule centre is clamped at x=28.4, safely west of the rise.
  const eastRise = smoothstep(
    BASALT_ESCARPMENT_PROFILE.riseStartX,
    BASALT_ESCARPMENT_PROFILE.fullRiseX,
    x,
  );
  if (eastRise <= 0) return 0;
  const longitudinalContinuity = basaltSourceContinuity(z);
  const erodedBreakup = 1 + fbm(
    x * 0.032 + 4.7,
    z * 0.046 - 7.2,
    TERRAIN_SEED + 1103,
    3,
  ) * 0.11;
  return eastRise
    * longitudinalContinuity
    * BASALT_ESCARPMENT_PROFILE.elevationMeters
    * erodedBreakup;
}

export function eastEscarpmentSurfaceAt(
  x,
  z,
  renderedGradient = terrainSlope(x, z),
) {
  const gradient = Math.max(0, Number.isFinite(renderedGradient) ? renderedGradient : 0);
  const sourceContinuity = basaltSourceContinuity(z);
  const faceVicinity = smoothstep(27.5, 28.75, x) * (1 - smoothstep(
    BASALT_ESCARPMENT_PROFILE.fullRiseX + 0.25,
    BASALT_ESCARPMENT_PROFILE.fullRiseX + 1.75,
    x,
  ));
  const unstableRegolith = smoothstep(
    EAST_ESCARPMENT_SURFACE_PROFILE.looseRegolithGradient,
    EAST_ESCARPMENT_SURFACE_PROFILE.fullBedrockGradient,
    gradient,
  );
  const bedrockExposure = clamp(sourceContinuity * faceVicinity * unstableRegolith);

  const toeDistance = BASALT_ESCARPMENT_PROFILE.riseStartX - x;
  const downslopeToe = smoothstep(0.15, 0.65, toeDistance)
    * (1 - smoothstep(3, EAST_ESCARPMENT_SURFACE_PROFILE.colluviumToeReachMeters, toeDistance));
  const stableDeposition = 1 - smoothstep(
    EAST_ESCARPMENT_SURFACE_PROFILE.looseRegolithGradient * 0.68,
    EAST_ESCARPMENT_SURFACE_PROFILE.looseRegolithGradient,
    gradient,
  );
  const depositionalBreakup = 0.84 + fbm(
    x * 0.061 - 2.8,
    z * 0.037 + 6.3,
    TERRAIN_SEED + 2203,
    3,
  ) * 0.16;
  const colluvium = clamp(
    sourceContinuity * downslopeToe * stableDeposition * depositionalBreakup,
  );

  return Object.freeze({
    renderedGradient: gradient,
    sourceContinuity,
    bedrockExposure,
    colluvium,
  });
}

export function terrainProcessRelief(x, z) {
  const fluvial = brookFluvialProcessAt(x, z);
  const brookDistance = fluvial.distance;
  // The active channel removes material at its centre. The full depth is
  // confined beneath the rendered ribbon and relaxes over a broad bank, so a
  // player crossing the covered fork sees a shallow cut rather than a trench.
  const brookIncision = -(
    1 - smoothstep(0.85, 5.2, brookDistance)
  ) * TERRAIN_GEOMORPHOLOGY_PROFILE.brookIncisionDepthMeters;

  // Sediment does not form a uniform ring around a real meandering channel.
  // Point bars accrete on the inside of bends, while a smaller older-floodplain
  // bench survives farther out. Both terms come from the same nearest channel
  // frame that drives the material classification below.
  const benchBreakup = 0.88 + fbm(
    x * 0.024 + 2.7,
    z * 0.019 - 4.1,
    TERRAIN_SEED + 1511,
    3,
  ) * 0.12;
  const pointBar = fluvial.pointBar
    * TERRAIN_GEOMORPHOLOGY_PROFILE.pointBarAccretionMeters
    * benchBreakup;
  const alluvialBench = fluvial.floodplainBench
    * TERRAIN_GEOMORPHOLOGY_PROFILE.alluvialBenchHeightMeters
    * benchBreakup;
  const cutBank = -fluvial.cutBank
    * TERRAIN_GEOMORPHOLOGY_PROFILE.cutBankErosionMeters;

  // The family glade occupies an older floodplain surface. A broad irregular
  // riser separates its low interior from the surrounding ground while keeping
  // the protected centre and route gently walkable. The term saturates outside
  // the rim instead of forming a decorative torus that would fall back down.
  const gladeWarp = fbm(
    x * 0.018 - 3.2,
    z * 0.016 + 5.8,
    TERRAIN_SEED + 1877,
    3,
  ) * 0.055;
  const gladeRadius = Math.hypot((x - 1.5) / 35, (z + 33) / 43) + gladeWarp;
  const activeChannelExclusion = smoothstep(4.8, 10.5, brookDistance);
  const gladeTerrace = smoothstep(0.69, 1.02, gladeRadius)
    * activeChannelExclusion
    * TERRAIN_GEOMORPHOLOGY_PROFILE.gladeTerraceRiserMeters;

  return brookIncision + pointBar + alluvialBench + cutBank + gladeTerrace;
}

export function terrainHeight(x, z) {
  const variation = terrainVariation(x, z);
  const broadRolls = variation * 3.15;
  const eastShoulder = Math.exp(-(((x - 52) ** 2) / 820 + ((z + 32) ** 2) / 4200)) * 0.9;
  const westShoulder = Math.exp(-(((x + 60) ** 2) / 1050 + ((z - 10) ** 2) / 4700)) * 0.72;
  const brookBasin = -Math.exp(-(((x + 9) ** 2) / 760 + ((z - 24) ** 2) / 2100)) * 0.82;
  const gladeBowl = -Math.exp(-((x * x) / 1150 + ((z + 30) ** 2) / 980)) * 0.36;
  return broadRolls
    + eastShoulder
    + westShoulder
    + brookBasin
    + gladeBowl
    + terrainProcessRelief(x, z)
    + basaltEscarpmentHeight(x, z);
}

export function terrainGradient(x, z, sampleDistance = 0.25) {
  const distance = Math.max(0.01, sampleDistance);
  return {
    x: (
      terrainHeight(x + distance, z) - terrainHeight(x - distance, z)
    ) / (distance * 2),
    z: (
      terrainHeight(x, z + distance) - terrainHeight(x, z - distance)
    ) / (distance * 2),
  };
}

export function terrainSlope(x, z) {
  const gradient = terrainGradient(x, z, 0.35);
  return Math.hypot(gradient.x, gradient.z);
}

export function terrainWetness(x, z) {
  const brook = Math.exp(-((x + 11) ** 2) / 78);
  const basin = Math.exp(-((z - 27) ** 2) / 2400);
  const hollow = clamp((-terrainHeight(x, z) + 0.7) / 3.6);
  return clamp(brook * (0.55 + basin * 0.32) + hollow * 0.24);
}

function pointToSegmentDistance(x, z, start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-8) return Math.hypot(x - start[0], z - start[1]);
  const projection = clamp(
    ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared,
  );
  return Math.hypot(
    x - (start[0] + dx * projection),
    z - (start[1] + dz * projection),
  );
}

function normalizedSegment(points, index) {
  const start = points[Math.max(0, Math.min(points.length - 2, index))];
  const end = points[Math.max(1, Math.min(points.length - 1, index + 1))];
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

function nearestControlLineFrame(x, z, points) {
  let nearest = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const lengthSquared = dx * dx + dz * dz;
    const projection = lengthSquared <= 1e-8 ? 0 : clamp(
      ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared,
    );
    const projectedX = start[0] + dx * projection;
    const projectedZ = start[1] + dz * projection;
    const offsetX = x - projectedX;
    const offsetZ = z - projectedZ;
    const distance = Math.hypot(offsetX, offsetZ);
    if (nearest && distance >= nearest.distance) continue;
    const tangent = normalizedSegment(points, index);
    const before = normalizedSegment(points, index - 1);
    const after = normalizedSegment(points, index + 1);
    nearest = {
      distance,
      signedDistance: tangent.x * offsetZ - tangent.z * offsetX,
      progress: (index + projection) / (points.length - 1),
      turn: before.x * after.z - before.z * after.x,
    };
  }
  return nearest ?? {
    distance: Infinity,
    signedDistance: 0,
    progress: 0,
    turn: 0,
  };
}

export function brookFluvialProcessAt(x, z) {
  const frame = nearestControlLineFrame(x, z, BROOK_CONTROL_POINTS);
  const curvatureStrength = smoothstep(0.025, 0.18, Math.abs(frame.turn));
  const bendDirection = frame.turn < 0 ? -1 : 1;
  const innerOffset = frame.signedDistance * bendDirection;
  const innerBank = smoothstep(0.35, 2.6, innerOffset);
  const outerBank = smoothstep(0.35, 2.6, -innerOffset);
  const pointBarBand = smoothstep(1.7, 3.4, frame.distance)
    * (1 - smoothstep(6.4, 9.2, frame.distance));
  const cutBankBand = smoothstep(1.25, 2.1, frame.distance)
    * (1 - smoothstep(3.9, 6.2, frame.distance));
  const floodplainBand = smoothstep(6.8, 9.4, frame.distance)
    * (1 - smoothstep(13.2, 18.5, frame.distance));
  const longitudinalSorting = 0.72 + fbm(
    x * 0.017 + 8.1,
    z * 0.014 - 2.3,
    TERRAIN_SEED + 2039,
    3,
  ) * 0.28;
  const confluenceFan = Math.exp(
    -(((x + 10.5) / 13.5) ** 2 + ((z - 6.9) / 17) ** 2),
  ) * smoothstep(4.8, 9.5, frame.distance);
  return Object.freeze({
    distance: frame.distance,
    signedDistance: frame.signedDistance,
    progress: frame.progress,
    curvatureStrength,
    pointBar: pointBarBand * innerBank * curvatureStrength * longitudinalSorting,
    cutBank: cutBankBand * outerBank * curvatureStrength,
    floodplainBench: clamp(
      floodplainBand * (0.38 + curvatureStrength * 0.32) * longitudinalSorting
        + confluenceFan * 0.46,
    ),
  });
}

function distanceToControlLine(x, z, points) {
  let nearest = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    nearest = Math.min(
      nearest,
      pointToSegmentDistance(x, z, points[index], points[index + 1]),
    );
  }
  return nearest;
}

function lineInfluence(x, z, points, innerRadius, outerRadius) {
  return 1 - smoothstep(
    innerRadius,
    outerRadius,
    distanceToControlLine(x, z, points),
  );
}

function canopyLitterSourceInfluence(x, z) {
  let remainingBareGround = 1;
  VEGETATION_LAYOUT.trees.forEach((tree) => {
    // These are the actual 128 mature canopy placements. Their retained litter
    // and ground shade belong in the same ecology field as their rendered
    // trunks instead of leaving most of the forest floor classified as open
    // mineral soil. Radius follows the authored mature scale; overlapping
    // crowns combine by remaining uncovered area rather than summing above 1.
    const radius = 4.1 + tree.scale * 2.8;
    const influence = 1 - smoothstep(
      radius * 0.18,
      radius,
      Math.hypot(x - tree.x, z - tree.z),
    );
    remainingBareGround *= 1 - influence * 0.78;
  });
  HABITAT_TREE_LAYOUT.forEach(([sourceX, sourceZ, scale]) => {
    // These are tree-ferns, not broad canopy trees. The litter footprint stays
    // just beyond the mature frond crown instead of painting an implausible
    // seven-to-eight metre radius around a narrow trunk.
    const radius = 2.6 + scale * 1.45;
    const influence = 1 - smoothstep(
      radius * 0.2,
      radius,
      Math.hypot(x - sourceX, z - sourceZ),
    );
    remainingBareGround *= 1 - influence * 0.86;
  });
  COVER_ARCH_LAYOUT.forEach(({ centerX, z: sourceZ, spread }) => {
    const radius = spread + 2.2;
    const influence = 1 - smoothstep(
      radius * 0.25,
      radius,
      Math.hypot(x - centerX, z - sourceZ),
    );
    remainingBareGround *= 1 - influence * 0.58;
  });
  const gingkoRadius = 9.4;
  const gingkoInfluence = 1 - smoothstep(
    gingkoRadius * 0.18,
    gingkoRadius,
    Math.hypot(x - HERO_GINGKO_LAYOUT.x, z - HERO_GINGKO_LAYOUT.z),
  );
  remainingBareGround *= 1 - gingkoInfluence * 0.92;
  return 1 - remainingBareGround;
}

function terrainHollowRetention(x, z) {
  const sampleDistance = 2.2;
  const center = terrainHeight(x, z);
  const neighbourMean = (
    terrainHeight(x - sampleDistance, z)
    + terrainHeight(x + sampleDistance, z)
    + terrainHeight(x, z - sampleDistance)
    + terrainHeight(x, z + sampleDistance)
  ) * 0.25;
  // Positive values are shallow concavities where washed litter and fine soil
  // can settle. Convex shoulders shed both instead of receiving a noise mask.
  return smoothstep(-0.015, 0.11, neighbourMean - center);
}

export function terrainEcologyAt(x, z) {
  const wetness = terrainWetness(x, z);
  const slope = terrainSlope(x, z);
  const height = terrainHeight(x, z);
  const exposure = clamp((height + 2.1) / 5.4);
  const canopySource = canopyLitterSourceInfluence(x, z);
  const hollowRetention = terrainHollowRetention(x, z);
  const routeWear = Math.max(
    lineInfluence(x, z, MAIN_ROUTE_CONTROL_POINTS, 1.4, 3.25),
    lineInfluence(x, z, COVERED_FORK_CONTROL_POINTS, 1.05, 2.55),
    lineInfluence(x, z, EXPOSED_FORK_CONTROL_POINTS, 1.15, 2.8),
  );
  const brookProximity = lineInfluence(x, z, BROOK_CONTROL_POINTS, 1.75, 7.2);
  const wetBank = clamp(
    brookProximity * (0.34 + wetness * 0.78) * (1 - routeWear * 0.16),
  );
  const retention = clamp(
    (1 - smoothstep(0.09, 0.3, slope)) * 0.72 + hollowRetention * 0.28,
  );
  const mineralExposure = clamp(
    (smoothstep(0.08, 0.3, slope) * 0.7 + exposure * 0.3)
      * (1 - canopySource * 0.68)
      * (1 - wetBank * 0.82)
      * (1 - routeWear * 0.24),
  );
  const humus = clamp(
    canopySource
      * (0.38 + retention * 0.62)
      * (1 - wetBank * 0.32)
      * (1 - routeWear * 0.9)
      * (1 - mineralExposure * 0.58),
  );
  const fluvial = brookFluvialProcessAt(x, z);
  const stablePointBarSurface = 1 - smoothstep(0.18, 0.34, slope);
  const stableFloodplainSurface = 1 - smoothstep(0.12, 0.3, slope);
  const pointBarDeposit = clamp(
    fluvial.pointBar
      * stablePointBarSurface
      * (1 - wetBank * 0.34)
      * (0.78 + hollowRetention * 0.22)
      * (1 - humus * 0.48)
      * (1 - routeWear * 0.52),
  );
  const floodplainSilt = clamp(
    fluvial.floodplainBench
      * stableFloodplainSurface
      * (1 - wetBank * 0.78)
      * (0.68 + hollowRetention * 0.32)
      * (1 - humus * 0.42)
      * (1 - routeWear * 0.38)
      * (1 - pointBarDeposit * 0.46),
  );
  const cutBankExposure = clamp(
    fluvial.cutBank
      * (0.72 + wetBank * 0.18)
      * (1 - humus * 0.7)
      * (1 - routeWear * 0.44),
  );
  const alluvium = Math.max(pointBarDeposit, floodplainSilt);
  const stableSubstrate = 1 - smoothstep(0.09, 0.3, slope);
  const shadedMoisture = canopySource
    * (0.52 + wetness * 0.28 + hollowRetention * 0.2);
  const humidBankColonization = wetBank
    * (0.08 + canopySource * 0.22 + hollowRetention * 0.12);
  const bryophyte = clamp(
    (shadedMoisture + humidBankColonization)
      * stableSubstrate
      * (1 - routeWear * 0.92)
      * (1 - mineralExposure * 0.72)
      * (1 - pointBarDeposit * 0.58)
      * (1 - cutBankExposure * 0.82),
  );

  return Object.freeze({
    humus,
    wetBank,
    mineralExposure,
    routeWear,
    alluvium,
    pointBarDeposit,
    floodplainSilt,
    cutBankExposure,
    canopySource,
    hollowRetention,
    bryophyte,
  });
}
