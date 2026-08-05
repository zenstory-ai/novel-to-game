import {
  BROOK_BOULDER,
  COVER_ARCH_LAYOUT,
  FAMILY_LAYOUT,
  FEEDING_BRANCH,
  FORT_FIREPIT,
  FORT_TENT_LAYOUT,
  HABITAT_TREE_LAYOUT,
  VEGETATION_LAYOUT,
} from './environment-layout.js';

export const NAVIGATION_BOUNDS = Object.freeze({
  minX: -43,
  maxX: 29,
  minZ: -90,
  maxZ: 91,
});

export const PLAYER_CAPSULE = Object.freeze({
  radius: 0.6,
  height: 1.78,
  eyeHeight: 1.62,
  maximumGroundStep: 0.42,
});

function circle({
  id,
  x,
  z,
  radius,
  height,
  category,
  visualAnchor,
  visualIndex = null,
}) {
  return Object.freeze({
    id,
    type: 'circle',
    x,
    z,
    radius,
    baseOffset: 0,
    height,
    category,
    visualAnchor,
    visualIndex,
  });
}

function orientedBox({
  id,
  x,
  z,
  halfX,
  halfZ,
  rotation,
  height,
  category,
  visualAnchor,
  visualIndex = null,
}) {
  return Object.freeze({
    id,
    type: 'oriented-box',
    x,
    z,
    halfX,
    halfZ,
    rotation,
    baseOffset: 0,
    height,
    category,
    visualAnchor,
    visualIndex,
  });
}

function horizontalCapsule({
  id,
  x,
  z,
  halfLength,
  radius,
  rotation,
  height,
  category,
  visualAnchor,
  visualIndex,
  visualX,
  visualZ,
}) {
  return Object.freeze({
    id,
    type: 'horizontal-capsule',
    x,
    z,
    halfLength,
    radius,
    rotation,
    baseOffset: 0,
    height,
    category,
    visualAnchor,
    visualIndex,
    visualX,
    visualZ,
  });
}

const tentColliders = FORT_TENT_LAYOUT.map((tent, index) => orientedBox({
  ...tent,
  halfX: 2.55,
  halfZ: 3.2,
  height: 3.6,
  category: 'shelter',
  visualAnchor: 'world.connected_route.fort-tents',
  visualIndex: index,
}));

const archTrunkColliders = COVER_ARCH_LAYOUT.flatMap((arch, archIndex) => (
  [-1, 1].map((side, sideIndex) => circle({
    id: `cover-arch-${archIndex + 1}-${side < 0 ? 'left' : 'right'}-trunk`,
    x: arch.centerX + arch.spread * side,
    z: arch.z,
    radius: 0.72,
    height: 6.2,
    category: 'tree-trunk',
    visualAnchor: 'world.connected_route.cover_arches',
    visualIndex: archIndex * 7 + sideIndex,
  }))
));

const habitatTreeColliders = HABITAT_TREE_LAYOUT.map(([x, z, scale], index) => circle({
  id: `habitat-tree-${index + 1}`,
  x,
  z,
  radius: Math.max(0.42, scale * 0.48),
  height: scale * 5.6,
  category: 'tree-trunk',
  visualAnchor: 'world.connected_route.tree-fern-sentinels',
  visualIndex: index,
}));

const vegetationTreeColliders = VEGETATION_LAYOUT.trees
  .filter((tree) => (
    tree.x >= NAVIGATION_BOUNDS.minX - 1
    && tree.x <= NAVIGATION_BOUNDS.maxX + 1
    && tree.z >= NAVIGATION_BOUNDS.minZ - 1
    && tree.z <= NAVIGATION_BOUNDS.maxZ + 1
  ))
  .map((tree) => circle({
    id: `vegetation-tree-${tree.index + 1}`,
    x: tree.x,
    z: tree.z,
    radius: Math.max(0.42, Math.max(tree.trunkScale[0], tree.trunkScale[2]) * 0.72),
    height: tree.trunkScale[1] * 6,
    category: 'tree-trunk',
    visualAnchor: 'world.connected_route.tree_trunks',
    visualIndex: tree.index,
  }));

const familyColliders = FAMILY_LAYOUT.map((animal, index) => {
  const centreOffset = -1.05 * animal.scale;
  return horizontalCapsule({
    id: animal.id,
    x: animal.x + Math.cos(animal.heading) * centreOffset,
    z: animal.z - Math.sin(animal.heading) * centreOffset,
    halfLength: 3.85 * animal.scale,
    radius: 1.03 * animal.scale,
    rotation: animal.heading,
    height: animal.young ? 2.7 : 4.9,
    category: 'living-subject',
    visualAnchor: animal.young
      ? 'subject.iguanodon_family.young'
      : 'subject.iguanodon_family.adult',
    visualIndex: index,
    visualX: animal.x,
    visualZ: animal.z,
  });
});

export const STATIC_COLLIDERS = Object.freeze([
  ...tentColliders,
  circle({
    ...FORT_FIREPIT,
    radius: 0.95,
    height: 1.15,
    category: 'hazard',
    visualAnchor: 'world.connected_route.fort-firepit',
  }),
  circle({
    ...BROOK_BOULDER,
    radius: 1.85,
    height: 2.7,
    category: 'boulder',
    visualAnchor: 'world.connected_route.brook-boulder',
  }),
  ...archTrunkColliders,
  ...habitatTreeColliders,
  ...vegetationTreeColliders,
  circle({
    ...FEEDING_BRANCH,
    radius: 0.66,
    height: 6.4,
    category: 'tree-trunk',
    visualAnchor: 'subject.iguanodon_family.feeding_branch',
  }),
  ...familyColliders,
]);

export const NON_SOLID_COLLISION_POLICY = Object.freeze({
  lowDecor: Object.freeze(['ferns', 'ground-stones', 'driftwood', 'basalt-rubble']),
  traversableSurface: Object.freeze(['brook-water', 'route-ribbons']),
  airborneThreat: 'state-driven-contact; no ground capsule',
  canopy: 'visual cover only; trunks remain solid',
});
