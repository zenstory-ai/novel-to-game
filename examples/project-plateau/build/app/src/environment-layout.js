import { SCENE_BUDGET, seededRandom } from './config.js';

export const COVER_ARCH_LAYOUT = Object.freeze([
  Object.freeze({ centerX: -7, z: 28, spread: 3.5 }),
  Object.freeze({ centerX: -12, z: 18, spread: 3.82 }),
  Object.freeze({ centerX: -17, z: 8, spread: 3.5 }),
  Object.freeze({ centerX: -22, z: -3, spread: 3.82 }),
  Object.freeze({ centerX: -13, z: 13, spread: 3.5 }),
]);

// Preserve the approved ten trunk/root anchors and route clearance, but treat
// them as individual riparian trees rather than five load-bearing arches. The
// scale, age and wind history vary above ground only; x/z remain the authored
// collision and terrain-ecology sources.
const COVER_RIPARIAN_GROWTH = Object.freeze([
  Object.freeze([0.82, -0.34, 'elliptic-waxy', 'submature', 0.08]),
  Object.freeze([0.94, 0.76, 'compound-lanceolate', 'mature', 0.04]),
  Object.freeze([0.88, 1.42, 'elliptic-waxy', 'mature', 0.06]),
  Object.freeze([0.76, -1.08, 'elliptic-waxy', 'pioneer', 0.18]),
  Object.freeze([0.96, 2.18, 'compound-lanceolate', 'mature', 0.05]),
  Object.freeze([0.84, -2.46, 'elliptic-waxy', 'submature', 0.13]),
  Object.freeze([0.79, 0.28, 'elliptic-waxy', 'pioneer', 0.2]),
  Object.freeze([0.92, 2.92, 'compound-lanceolate', 'mature', 0.07]),
  Object.freeze([0.86, -1.72, 'elliptic-waxy', 'submature', 0.12]),
  Object.freeze([0.9, 1.05, 'elliptic-waxy', 'mature', 0.09]),
]);

export const COVER_RIPARIAN_TREE_LAYOUT = Object.freeze(COVER_ARCH_LAYOUT.flatMap(
  ({ centerX, z, spread }, pairIndex) => [-1, 1].map((side, sideIndex) => {
    const index = pairIndex * 2 + sideIndex;
    const [scale, trunkYaw, leafFamily, successionAgeClass, successionWindDamage] =
      COVER_RIPARIAN_GROWTH[index];
    return Object.freeze({
      index,
      pairIndex,
      side: side < 0 ? 'left' : 'right',
      x: centerX + spread * side,
      z,
      scale,
      trunkYaw,
      leafFamily,
      // One established Araucaria and one low-wetness exposed broadleaf break
      // the repeated paired silhouette without inventing new root positions.
      isAraucaria: index === 8,
      openCanopyExposure: index === 6,
      successionAgeClass,
      successionWindDamage,
    });
  }),
));

export const HABITAT_TREE_LAYOUT = Object.freeze([
  [-25, 53, 1.06, 0.2], [25.5, 49, 0.9, 2.6],
  [-23, 31, 0.92, 1.1], [27, 24, 1.08, 3.4],
  [-26, 11, 1.18, 2.0], [26, 3, 0.88, 0.65],
  [-24.5, -13, 1.26, 4.2], [25.5, -18, 1.02, 2.85],
  [-24, -42, 1.14, 5.1], [25, -49, 1.04, 1.75],
  [-28, -67, 1.22, 3.25], [27, -70, 0.94, 0.35],
].map((placement) => Object.freeze(placement)));

export const FOREGROUND_FROND_LAYOUT = Object.freeze([
  [-10.5, 54, 1.7, 0.2], [11.8, 43, 1.45, 2.6],
  [-13.2, 27, 1.85, 1.1], [13.8, 12, 1.62, 3.4],
  [-14.4, -4, 1.94, 2.0], [14.8, -16, 1.56, 0.65],
  [-15.8, -27, 2.08, 4.2], [15.4, -39, 1.78, 2.85],
  [-17.2, -51, 2.16, 5.1], [17.5, -60, 1.72, 1.75],
  [-18.5, -71, 2.24, 3.25], [18.2, -78, 1.82, 0.35],
].map((placement) => Object.freeze(placement)));

export const FORT_TENT_LAYOUT = Object.freeze([
  Object.freeze({ id: 'fort-tent-west', x: -3, z: 80, rotation: Math.PI / 4 }),
  Object.freeze({ id: 'fort-tent-east', x: 5, z: 84, rotation: Math.PI / 4 }),
]);

export const FORT_FIREPIT = Object.freeze({ id: 'fort-firepit', x: -8, z: 78 });
export const HERO_GINGKO_LAYOUT = Object.freeze({
  id: 'fort-gingko',
  x: 16,
  z: 37,
  rotation: -0.38,
  scale: 1,
  collisionRadius: 1.48,
  collisionHeight: 12.8,
});
export const BASALT_FORMATION_LAYOUT = Object.freeze([
  Object.freeze({ x: 37.5, z: -50, yaw: 0.22, dipX: -0.018, dipZ: 0.032 }),
  Object.freeze({ x: 36.5, z: -26, yaw: -0.18, dipX: 0.026, dipZ: -0.022 }),
  Object.freeze({ x: 37.5, z: -3, yaw: 0.34, dipX: -0.012, dipZ: 0.024 }),
]);
export const BROOK_BOULDER = Object.freeze({
  id: 'brook-boulder',
  x: -7.5,
  z: 35,
  collisionRadius: 1.45,
  collisionHeight: 1.2,
  transportClass: 'immobile-residual-bank-erratic-reexposed-on-inner-bend',
  presentFlowMobility: 'immobile',
});

export const FLUVIAL_ROCK_TRANSPORT_PROFILE = Object.freeze({
  model: 'active-bedload-historical-flood-lag-and-residual-bank-erratic',
  brookWidthMeters: 3.4,
  presentMobileLongAxisMeters: Object.freeze([0.16, 0.55]),
  historicalLagLongAxisMeters: Object.freeze([1.06, 1.32]),
  historicalLagMaximumBrookWidthFraction: 0.39,
  residualErraticLongAxisMeters: 2.48,
  mobilityContract: 'only-non-solid-sub-step-clasts-move-with-present-flow',
  hydraulicEvidenceBoundary: 'grade-only-water-model-does-not-prove-exact-transport-competence',
});

// These rocks are authored as geological placements rather than uniform set
// dressing. The six solid brook clasts are historical high-flow lag, not
// present-day cobbles: their long axes stay below 39% of the 3.4 m brook width
// and their colliders match the reduced visual envelopes. Glade slabs mark the
// drier bowl margin without cluttering the family sightline, and talus blocks
// collect at the ridge apron beyond the navigation boundary. Playable rocks
// carry matching static colliders; ridge-foot talus is explicitly distant.
export const NON_COLUMNAR_ROCK_LAYOUT = Object.freeze([
  Object.freeze({
    id: 'brook-cobble-east-1', family: 'fluvial-cobble', x: -9.6, z: 37.1,
    yaw: 0.34, scale: [0.62, 0.61, 0.5], burial: 0.075,
    solid: true, collisionRadius: 0.62, collisionHeight: 0.47,
    transportClass: 'historical-high-flow-rounded-lag', presentFlowMobility: 'immobile',
  }),
  Object.freeze({
    id: 'brook-cobble-west-1', family: 'fluvial-cobble', x: -17.8, z: 47,
    yaw: -0.22, scale: [0.56, 0.56, 0.45], burial: 0.07,
    solid: true, collisionRadius: 0.56, collisionHeight: 0.44,
    transportClass: 'historical-high-flow-rounded-lag', presentFlowMobility: 'immobile',
  }),
  Object.freeze({
    id: 'brook-cobble-east-2', family: 'fluvial-cobble', x: -5.2, z: 27.8,
    yaw: 0.29, scale: [0.52, 0.54, 0.43], burial: 0.065,
    solid: true, collisionRadius: 0.52, collisionHeight: 0.43,
    transportClass: 'historical-high-flow-rounded-lag', presentFlowMobility: 'immobile',
  }),
  Object.freeze({
    id: 'brook-cobble-west-2', family: 'fluvial-cobble', x: -16.1, z: 20.4,
    yaw: -0.18, scale: [0.6, 0.58, 0.48], burial: 0.08,
    solid: true, collisionRadius: 0.6, collisionHeight: 0.45,
    transportClass: 'historical-high-flow-rounded-lag', presentFlowMobility: 'immobile',
  }),
  Object.freeze({
    id: 'brook-cobble-east-3', family: 'fluvial-cobble', x: -3.8, z: 10.2,
    yaw: 0.4, scale: [0.5, 0.52, 0.42], burial: 0.06,
    solid: true, collisionRadius: 0.5, collisionHeight: 0.43,
    transportClass: 'historical-high-flow-rounded-lag', presentFlowMobility: 'immobile',
  }),
  Object.freeze({
    id: 'brook-cobble-west-3', family: 'fluvial-cobble', x: -16.7, z: 2.8,
    yaw: -0.12, scale: [0.55, 0.56, 0.45], burial: 0.07,
    solid: true, collisionRadius: 0.55, collisionHeight: 0.44,
    transportClass: 'historical-high-flow-rounded-lag', presentFlowMobility: 'immobile',
  }),

  Object.freeze({
    id: 'glade-slab-west-1', family: 'bedded-slab', x: -18.5, z: -19.5,
    yaw: -0.46, scale: [1.34, 1.22, 1.02], burial: 0.06,
    solid: true, collisionRadius: 1.12, collisionHeight: 0.72,
  }),
  Object.freeze({
    id: 'glade-slab-west-2', family: 'bedded-slab', x: -21.5, z: -34.5,
    yaw: -0.2, scale: [1.12, 1.08, 0.86], burial: 0.055,
    solid: true, collisionRadius: 0.94, collisionHeight: 0.64,
  }),
  Object.freeze({
    id: 'glade-slab-west-3', family: 'bedded-slab', x: -16.8, z: -49,
    yaw: 0.31, scale: [1.26, 1.16, 0.92], burial: 0.065,
    solid: true, collisionRadius: 1.04, collisionHeight: 0.68,
  }),
  Object.freeze({
    id: 'glade-slab-east-1', family: 'bedded-slab', x: 24.2, z: -21.5,
    yaw: 0.62, scale: [0.78, 0.72, 0.64], burial: 0.06,
    solid: true, collisionRadius: 0.8, collisionHeight: 0.44,
  }),
  Object.freeze({
    id: 'glade-slab-east-2', family: 'bedded-slab', x: 22.8, z: -36.5,
    yaw: 0.18, scale: [1.38, 1.26, 1.0], burial: 0.065,
    solid: true, collisionRadius: 1.14, collisionHeight: 0.74,
  }),
  Object.freeze({
    id: 'glade-slab-east-3', family: 'bedded-slab', x: 16.4, z: -52,
    yaw: -0.28, scale: [1.08, 1.04, 0.84], burial: 0.055,
    solid: true, collisionRadius: 0.9, collisionHeight: 0.62,
  }),

  Object.freeze({
    id: 'ridge-talus-west-1', family: 'angular-talus', x: -38, z: -92,
    yaw: -0.24, scale: [1.72, 1.12, 1.34], burial: 0.09, solid: false,
  }),
  Object.freeze({
    id: 'ridge-talus-west-2', family: 'angular-talus', x: -49, z: -96,
    yaw: 0.26, scale: [1.34, 0.92, 1.1], burial: 0.08, solid: false,
  }),
  Object.freeze({
    id: 'ridge-talus-centre-1', family: 'angular-talus', x: -13, z: -95,
    yaw: -0.1, scale: [1.48, 1.02, 1.2], burial: 0.085, solid: false,
  }),
  Object.freeze({
    id: 'ridge-talus-centre-2', family: 'angular-talus', x: 7, z: -98,
    yaw: 0.36, scale: [1.24, 0.84, 1.02], burial: 0.075, solid: false,
  }),
  Object.freeze({
    id: 'ridge-talus-east-1', family: 'angular-talus', x: 28, z: -93,
    yaw: 0.18, scale: [1.6, 1.08, 1.26], burial: 0.09, solid: false,
  }),
  Object.freeze({
    id: 'ridge-talus-east-2', family: 'angular-talus', x: 43, z: -97,
    yaw: -0.3, scale: [1.3, 0.9, 1.08], burial: 0.08, solid: false,
  }),
]);
// The branch tip is authored to meet the branch-pulling adult's jaw at the
// peak of the pull. Keep this placement coupled to the contact regression in
// foundation.test.js; moving the tree independently recreates the visibly
// disconnected "tree and dinosaur move together" failure.
export const FEEDING_BRANCH = Object.freeze({ id: 'feeding-branch', x: 18.35, z: -39.4 });

export const FAMILY_LAYOUT = Object.freeze([
  Object.freeze({ id: 'iguanodon-adult-graze', x: -8, z: -31, scale: 1.22, heading: -0.32, young: false, behaviorRole: 'graze' }),
  Object.freeze({ id: 'iguanodon-adult-branch', x: 10.5, z: -39, scale: 1.14, heading: 0.18, young: false, behaviorRole: 'branch-pull' }),
  Object.freeze({ id: 'iguanodon-young-play-a', x: -2.2, z: -24.8, scale: 0.72, heading: 0.58, young: true, behaviorRole: 'young-play' }),
  Object.freeze({ id: 'iguanodon-young-play-b', x: 3.4, z: -27.2, scale: 0.66, heading: 0.58 + Math.PI, young: true, behaviorRole: 'young-play' }),
  Object.freeze({ id: 'iguanodon-young-close', x: 2.5, z: -35, scale: 0.73, heading: 2.15, young: true, behaviorRole: 'stay-close' }),
]);

function createVegetationLayout() {
  const random = seededRandom(139);
  const trees = [];
  const ferns = [];
  const stones = [];
  const trunkFamilyIndices = {
    'wet-furrowed': 0,
    'plate-barked': 0,
  };
  const canopyFamilyIndices = {
    'elliptic-waxy': 0,
    'compound-lanceolate': 0,
  };

  for (let index = 0; index < SCENE_BUDGET.trees; index += 1) {
    let x;
    let z;
    do {
      x = (random() - 0.5) * 150;
      z = (random() - 0.5) * 190;
    } while (
      (Math.abs(x - 4) < 13 && z > -78)
      || (z > -58 && z < 16 && Math.abs(x - 1) < 32)
      || (z > -70 && z < 42 && x > -70 && x < 35)
      || Math.hypot(x - 18, z - 77) < 21
    );
    const isAraucaria = index % 3 === 0;
    const broadleafFamily = Math.floor(index / 3) % 2;
    const barkFamily = isAraucaria || broadleafFamily === 0
      ? 'wet-furrowed'
      : 'plate-barked';
    const leafFamily = isAraucaria
      ? 'araucaria-whorl'
      : broadleafFamily === 0 ? 'elliptic-waxy' : 'compound-lanceolate';
    const scale = 0.68 + random() * 0.62;
    const trunkYaw = random() * Math.PI;
    const trunkScaleX = scale * (isAraucaria ? 0.68 : 0.86 + random() * 0.22);
    const trunkScaleY = scale * (isAraucaria ? 1.14 : 1);
    const trunkScaleZ = scale * (isAraucaria ? 0.68 : 0.86 + random() * 0.2);
    const trunkColor = barkFamily === 'plate-barked'
      ? [0.055 + random() * 0.018, 0.24 + random() * 0.055, 0.205 + random() * 0.045]
      : [0.105 + random() * 0.025, 0.2 + random() * 0.04, 0.18 + random() * 0.045];
    const tree = {
      index, x, z, scale, isAraucaria, trunkYaw,
      trunkScale: [trunkScaleX, trunkScaleY, trunkScaleZ],
      trunkColor,
      barkFamily,
      leafFamily,
      trunkFamilyIndex: trunkFamilyIndices[barkFamily],
    };
    trunkFamilyIndices[barkFamily] += 1;

    if (!isAraucaria) {
      tree.canopyFamilyIndex = canopyFamilyIndices[leafFamily];
      canopyFamilyIndices[leafFamily] += 1;
    }

    if (isAraucaria) {
      tree.canopyYaw = random() * Math.PI;
      tree.canopyScale = [
        scale * (0.92 + random() * 0.16),
        scale * 1.08,
        scale * (0.92 + random() * 0.16),
      ];
      tree.crownColor = [
        0.31 + random() * 0.035,
        0.45 + random() * 0.08,
        0.12 + random() * 0.045,
      ];
    } else {
      const crownOffsetX = (random() - 0.5) * 0.9;
      const crownOffsetZ = (random() - 0.5) * 0.7;
      tree.crownOffset = [crownOffsetX, crownOffsetZ];
      tree.crownRotation = [random() * 0.15, random() * Math.PI, random() * 0.1];
      tree.crownScale = [
        scale * (0.96 + random() * 0.28),
        scale * 0.62,
        scale * (0.82 + random() * 0.24),
      ];
      tree.crownColor = [
        0.32 + random() * 0.045,
        0.42 + random() * 0.1,
        0.14 + random() * 0.055,
      ];
      tree.accentOffset = [
        crownOffsetX + (random() - 0.5) * 2.1 * scale,
        crownOffsetZ + (random() - 0.5) * 1.3 * scale,
      ];
      tree.accentRotation = [random() * 0.18, random() * Math.PI, random() * 0.13];
      tree.accentScale = [
        scale * (0.78 + random() * 0.2),
        scale * 0.5,
        scale * (0.7 + random() * 0.18),
      ];
    }
    trees.push(Object.freeze(tree));
  }

  for (let index = 0; index < SCENE_BUDGET.ferns; index += 1) {
    let x;
    let z;
    let host;
    do {
      host = trees[Math.floor(random() * trees.length)];
      const angle = random() * Math.PI * 2;
      const radius = 1.8 + random() ** 1.7 * 6.4;
      x = host.x + Math.cos(angle) * radius;
      z = host.z + Math.sin(angle) * radius;
    } while (
      Math.abs(x) > 68
      || Math.abs(z) > 94
      || Math.hypot(x + 5.4, z - 35.4) < 4.8
      || (z > -58 && z < 18 && Math.abs(x - 1) < 22)
      || (z >= 18 && z < 68 && Math.abs(x + 3) < 9)
      || Math.hypot(x - 1, z - 81) < 18
    );
    const scale = 0.28 + random() * 0.64;
    const variantIndex = index % 3;
    const variantScale = variantIndex === 1
      ? [0.78, 1.18, 0.8]
      : variantIndex === 2 ? [1.28, 0.72, 1.18] : [1, 1, 1];
    ferns.push(Object.freeze({
      index,
      x,
      z,
      scale,
      variantIndex,
      rotation: random() * Math.PI,
      instanceScale: [
        scale * (0.85 + random() * 0.2) * variantScale[0],
        scale * variantScale[1],
        scale * (0.85 + random() * 0.2) * variantScale[2],
      ],
      color: [
        0.29 + random() * 0.055,
        0.2 + random() * 0.12,
        0.12 + random() * 0.045,
      ],
    }));
  }

  for (let index = 0; index < 96; index += 1) {
    const x = (random() - 0.5) * 125;
    const z = (random() - 0.5) * 160;
    const scale = 0.24 + random() * 0.82;
    stones.push(Object.freeze({
      index,
      x,
      z,
      scale,
      rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
      instanceScale: [scale * (0.7 + random() * 0.5), scale * 0.46, scale],
      color: [
        0.12 + random() * 0.05,
        0.1 + random() * 0.1,
        0.23 + random() * 0.08,
      ],
    }));
  }

  return Object.freeze({
    trees: Object.freeze(trees),
    ferns: Object.freeze(ferns),
    stones: Object.freeze(stones),
  });
}

export const VEGETATION_LAYOUT = createVegetationLayout();

// The foreground layout was originally authored for a very small procedural
// frond and therefore used 1.5–2.2x placement scales. Reusing those values on
// the original fern asset would create implausible multi-metre leaves. These
// derived placements preserve the composition while keeping mature fern crowns
// around 1–1.6 m across, with every part scaled together from the rhizome.
export const FERN_LIBRARY_LAYOUT = Object.freeze([
  ...VEGETATION_LAYOUT.ferns,
  ...FOREGROUND_FROND_LAYOUT.map(([x, z, scale, yaw], offset) => {
    const matureScale = scale * 0.23;
    return Object.freeze({
      index: VEGETATION_LAYOUT.ferns.length + offset,
      x,
      z,
      scale: matureScale,
      variantIndex: 2,
      rotation: yaw,
      instanceScale: Object.freeze([
        matureScale * 1.04,
        matureScale * 0.86,
        matureScale,
      ]),
      color: Object.freeze([0.305 + (offset % 3) * 0.006, 0.24, 0.13]),
      sourceRole: 'foreground-depth-frond-replacement',
    });
  }),
]);
