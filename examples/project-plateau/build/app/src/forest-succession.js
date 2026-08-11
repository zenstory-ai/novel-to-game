import { seededRandom } from './config.js';

export const FOREST_SUCCESSION_PROFILE = Object.freeze({
  version: 'terrain-sourced-boundary-forest-succession-v2',
  placementModel: 'twelve-cohorts-with-golden-angle-age-strata',
  supportModel: 'vertical-trunk-centre-root-plane-buried-at-rendered-terrain-height',
  collisionModel: 'load-bearing-trunks-wholly-outside-navigation-crowns-may-overhang',
  growthModel: 'age-stratified-whole-tree-original-assets-with-allometric-fallback-lod',
  boundaryClearanceMeters: 2.8,
  crownOverlapThreshold: 0.92,
  ageClasses: Object.freeze({
    mature: Object.freeze({ minimumHeightScale: 0.82, maximumHeightScale: 1.2 }),
    submature: Object.freeze({ minimumHeightScale: 0.58, maximumHeightScale: 0.8 }),
    pioneer: Object.freeze({ minimumHeightScale: 0.36, maximumHeightScale: 0.55 }),
  }),
});

export const FOREST_SUCCESSION_COHORTS = Object.freeze([
  Object.freeze({ id: 'south-west-ridge', boundary: 'south', x: -68, z: -101, radiusX: 13, radiusZ: 7, exposure: 0.72 }),
  Object.freeze({ id: 'south-west-saddle', boundary: 'south', x: -42, z: -103, radiusX: 12, radiusZ: 7, exposure: 0.61 }),
  Object.freeze({ id: 'south-hollow-head', boundary: 'south', x: -15, z: -101, radiusX: 12, radiusZ: 7, exposure: 0.43 }),
  Object.freeze({ id: 'south-central-rise', boundary: 'south', x: 12, z: -103, radiusX: 12, radiusZ: 7, exposure: 0.58 }),
  Object.freeze({ id: 'south-east-shoulder', boundary: 'south', x: 39, z: -102, radiusX: 12, radiusZ: 7, exposure: 0.76 }),
  Object.freeze({ id: 'south-east-ridge', boundary: 'south', x: 67, z: -100, radiusX: 13, radiusZ: 7, exposure: 0.84 }),
  Object.freeze({ id: 'west-glade-edge', boundary: 'west', x: -51, z: -46, radiusX: 7, radiusZ: 15, exposure: 0.46 }),
  Object.freeze({ id: 'west-brook-edge', boundary: 'west', x: -52, z: -10, radiusX: 7, radiusZ: 15, exposure: 0.36 }),
  Object.freeze({ id: 'west-return-edge', boundary: 'west', x: -52, z: 31, radiusX: 7, radiusZ: 16, exposure: 0.52 }),
  Object.freeze({ id: 'east-glade-edge', boundary: 'east', x: 38, z: -47, radiusX: 7, radiusZ: 15, exposure: 0.63 }),
  Object.freeze({ id: 'east-basalt-edge', boundary: 'east', x: 39, z: -9, radiusX: 7, radiusZ: 15, exposure: 0.78 }),
  Object.freeze({ id: 'east-return-edge', boundary: 'east', x: 39, z: 32, radiusX: 7, radiusZ: 16, exposure: 0.69 }),
]);

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function projectOutsideNavigation(x, z, cohort, bounds) {
  const clearance = FOREST_SUCCESSION_PROFILE.boundaryClearanceMeters;
  if (cohort.boundary === 'south') {
    return { x, z: Math.min(z, bounds.minZ - clearance) };
  }
  if (cohort.boundary === 'west') {
    return { x: Math.min(x, bounds.minX - clearance), z };
  }
  return { x: Math.max(x, bounds.maxX + clearance), z };
}

function ageClassForLocalIndex(localIndex, perCohort) {
  const fraction = localIndex / perCohort;
  if (fraction < 0.5) return 'mature';
  if (fraction < 0.75) return 'submature';
  return 'pioneer';
}

function ageHeightScale(ageClass, random) {
  const range = FOREST_SUCCESSION_PROFILE.ageClasses[ageClass];
  return range.minimumHeightScale
    + random() * (range.maximumHeightScale - range.minimumHeightScale);
}

function crownVariantFor({ wetness, slope, exposure, localIndex }) {
  if (wetness >= 0.19 && localIndex % 3 === 2) return 2;
  if (exposure + slope * 2.4 >= 0.74 && localIndex % 3 === 1) return 1;
  return 0;
}

function outsideNavigation(placement, bounds) {
  const radius = placement.trunkClearanceRadius;
  return placement.x + radius < bounds.minX
    || placement.x - radius > bounds.maxX
    || placement.z + radius < bounds.minZ
    || placement.z - radius > bounds.maxZ;
}

function overlapSummary(placements) {
  let links = 0;
  const linked = new Set();
  for (let first = 0; first < placements.length; first += 1) {
    for (let second = first + 1; second < placements.length; second += 1) {
      const a = placements[first];
      const b = placements[second];
      if (a.cohortId !== b.cohortId) continue;
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (distance <= (a.crownRadiusMeters + b.crownRadiusMeters)
        * FOREST_SUCCESSION_PROFILE.crownOverlapThreshold) {
        links += 1;
        linked.add(first);
        linked.add(second);
      }
    }
  }
  return Object.freeze({ links, linkedTreeCount: linked.size });
}

export function createForestSuccessionLayout({
  count,
  terrainHeight,
  terrainGradient,
  terrainWetness,
  navigationBounds,
  seed = 12_481,
} = {}) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('Forest succession count must be a positive integer');
  }
  if (count % FOREST_SUCCESSION_COHORTS.length !== 0) {
    throw new RangeError('Forest succession count must divide evenly across the twelve cohorts');
  }
  if (!terrainHeight || !terrainGradient || !terrainWetness || !navigationBounds) {
    throw new Error('Forest succession requires terrain and navigation authority');
  }
  const random = seededRandom(seed);
  const perCohort = count / FOREST_SUCCESSION_COHORTS.length;
  const placements = [];
  const ageCounts = { mature: 0, submature: 0, pioneer: 0 };
  const crownVariantCounts = [0, 0, 0];
  const cohortCounts = Object.fromEntries(
    FOREST_SUCCESSION_COHORTS.map(({ id }) => [id, 0]),
  );

  for (let index = 0; index < count; index += 1) {
    const cohortIndex = index % FOREST_SUCCESSION_COHORTS.length;
    const localIndex = Math.floor(index / FOREST_SUCCESSION_COHORTS.length);
    const cohort = FOREST_SUCCESSION_COHORTS[cohortIndex];
    const radialFraction = Math.sqrt((localIndex + 0.28 + random() * 0.34) / perCohort);
    const angle = localIndex * GOLDEN_ANGLE + cohortIndex * 0.71 + (random() - 0.5) * 0.28;
    const rawX = cohort.x + Math.cos(angle) * cohort.radiusX * radialFraction;
    const rawZ = cohort.z + Math.sin(angle) * cohort.radiusZ * radialFraction;
    const position = projectOutsideNavigation(rawX, rawZ, cohort, navigationBounds);
    const gradient = terrainGradient(position.x, position.z);
    const slope = Math.hypot(gradient.x, gradient.z);
    const wetness = clamp(terrainWetness(position.x, position.z));
    const ageClass = ageClassForLocalIndex(localIndex, perCohort);
    const heightScale = ageHeightScale(ageClass, random);
    // Tree height and load-bearing diameter cannot be varied independently.
    // The exponent keeps pioneers thinner relative to height while preventing
    // mature trunks from becoming stretched cylinders.
    const radialScale = heightScale ** 1.34 * (0.9 + random() * 0.18);
    const windDamage = clamp(
      cohort.exposure * 0.44 + Math.min(0.24, slope * 1.8) + random() * 0.12,
      0.08,
      0.72,
    );
    const crownVariant = crownVariantFor({
      wetness, slope, exposure: cohort.exposure, localIndex,
    });
    const crownRadialScale = heightScale ** 0.86 * (0.9 + random() * 0.2);
    const crownVerticalScale = heightScale ** 0.96 * (0.91 + random() * 0.15);
    const yaw = random() * Math.PI * 2;
    const windSign = cohort.boundary === 'west' ? 1 : -1;
    const crownOffset = Object.freeze([
      windSign * windDamage * heightScale * 0.34,
      (random() - 0.5) * windDamage * heightScale * 0.18,
    ]);
    const crownScale = Object.freeze([
      crownRadialScale * (1 - windDamage * 0.13),
      crownVerticalScale * (1 - windDamage * 0.09),
      crownRadialScale * (0.92 + random() * 0.13),
    ]);
    const crownRadiusMeters = (crownVariant === 1 ? 2.65 : crownVariant === 2 ? 2.25 : 2.9)
      * Math.max(crownScale[0], crownScale[2]);
    const placement = Object.freeze({
      index,
      cohortId: cohort.id,
      boundary: cohort.boundary,
      x: position.x,
      z: position.z,
      groundY: terrainHeight(position.x, position.z),
      slope,
      wetness,
      exposure: cohort.exposure,
      ageClass,
      heightScale,
      radialScale,
      trunkScale: Object.freeze([radialScale, heightScale, radialScale]),
      trunkClearanceRadius: 0.62 * radialScale,
      crownVariant,
      crownScale,
      crownOffset,
      crownRadiusMeters,
      windDamage,
      yaw,
      individual: (localIndex + cohortIndex / FOREST_SUCCESSION_COHORTS.length)
        / perCohort,
    });
    if (!outsideNavigation(placement, navigationBounds)) {
      throw new Error(`Forest cohort ${cohort.id} placed a load-bearing trunk inside navigation`);
    }
    placements.push(placement);
    ageCounts[ageClass] += 1;
    crownVariantCounts[crownVariant] += 1;
    cohortCounts[cohort.id] += 1;
  }

  const overlap = overlapSummary(placements);
  return Object.freeze({
    profile: FOREST_SUCCESSION_PROFILE,
    placements: Object.freeze(placements),
    summary: Object.freeze({
      instanceCount: placements.length,
      cohortCount: FOREST_SUCCESSION_COHORTS.length,
      cohortCounts: Object.freeze(cohortCounts),
      ageCounts: Object.freeze(ageCounts),
      crownVariantCounts: Object.freeze(crownVariantCounts),
      outsideNavigationCount: placements.filter((placement) => (
        outsideNavigation(placement, navigationBounds)
      )).length,
      crownOverlapLinks: overlap.links,
      overlapLinkedTreeCount: overlap.linkedTreeCount,
      maximumSlope: Math.max(...placements.map(({ slope }) => slope)),
      wetnessRange: Object.freeze([
        Math.min(...placements.map(({ wetness }) => wetness)),
        Math.max(...placements.map(({ wetness }) => wetness)),
      ]),
      maximumWindDamage: Math.max(...placements.map(({ windDamage }) => windDamage)),
    }),
  });
}
