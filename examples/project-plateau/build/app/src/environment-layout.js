import { SCENE_BUDGET, seededRandom } from './config.js';

export const COVER_ARCH_LAYOUT = Object.freeze([
  Object.freeze({ centerX: -7, z: 28, spread: 3.5 }),
  Object.freeze({ centerX: -12, z: 18, spread: 3.82 }),
  Object.freeze({ centerX: -17, z: 8, spread: 3.5 }),
  Object.freeze({ centerX: -22, z: -3, spread: 3.82 }),
  Object.freeze({ centerX: -13, z: 13, spread: 3.5 }),
]);

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
export const BROOK_BOULDER = Object.freeze({ id: 'brook-boulder', x: -7.5, z: 35 });
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
    const scale = 0.68 + random() * 0.62;
    const trunkYaw = random() * Math.PI;
    const trunkScaleX = scale * (isAraucaria ? 0.68 : 0.86 + random() * 0.22);
    const trunkScaleY = scale * (isAraucaria ? 1.14 : 1);
    const trunkScaleZ = scale * (isAraucaria ? 0.68 : 0.86 + random() * 0.2);
    const trunkColor = [0.24 + random() * 0.035, 0.2, 0.19 + random() * 0.055];
    const tree = {
      index, x, z, scale, isAraucaria, trunkYaw,
      trunkScale: [trunkScaleX, trunkScaleY, trunkScaleZ],
      trunkColor,
    };

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
