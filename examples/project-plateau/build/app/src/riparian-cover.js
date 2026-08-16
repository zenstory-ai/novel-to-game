import * as THREE from 'three';

import {
  COVER_ARCH_LAYOUT,
  COVER_RIPARIAN_TREE_LAYOUT,
} from './environment-layout.js';
import { terrainHeight } from './terrain.js';
import { shared } from './vegetation-rendering.js';
import { barkTextures } from './vegetation-textures.js';
import {
  createCylinderBetween,
  mergeParts,
  primitive,
} from './world-rendering.js';

function createRootSupportedRiparianBoughGeometry({
  rootX,
  rootHeightOffset,
  side,
  treeIndex,
  trunkHeightScale,
}) {
  const inward = side === 'left' ? 1 : -1;
  const joinY = rootHeightOffset + 4.18 * trunkHeightScale;
  const reach = 1.58 + ((treeIndex * 7) % 5) * 0.19;
  const rise = 1.02 + ((treeIndex * 3) % 4) * 0.17;
  const drift = ((treeIndex * 11) % 7 - 3) * 0.11;
  const start = [rootX + inward * 0.04, joinY, 0];
  const shoulder = [rootX + inward * 0.62, joinY + 0.48, drift * 0.45];
  const crownNode = [rootX + inward * reach, joinY + rise, drift];
  const parts = [
    createCylinderBetween(start, shoulder, 0.245, 0.165, 9),
    createCylinderBetween(shoulder, crownNode, 0.165, 0.072, 8),
    createCylinderBetween(
      shoulder,
      [rootX - inward * (0.54 + (treeIndex % 3) * 0.13), joinY + 0.88, -drift - 0.34],
      0.132,
      0.05,
      8,
    ),
    createCylinderBetween(
      [
        rootX + inward * reach * 0.62,
        joinY + rise * 0.62,
        drift * 0.62,
      ],
      [
        rootX + inward * (reach * 0.82),
        joinY + rise + 0.66 + (treeIndex % 2) * 0.18,
        drift - inward * 0.48,
      ],
      0.105,
      0.042,
      7,
    ),
  ];
  const geometry = mergeParts(parts);
  geometry.userData.profile = 'single-root-supported-asymmetric-riparian-bough';
  return geometry;
}

function makeRiparianCover(scene) {
  const group = new THREE.Group();
  const assetAnchor = new THREE.Group();
  assetAnchor.name = 'world.connected_route.cover-riparian-tree-asset-anchor';
  COVER_RIPARIAN_TREE_LAYOUT.forEach((tree) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.name = `world.connected_route.cover-riparian-tree-placement-${tree.index + 1}`;
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    placementAnchor.userData.canopyTreePlacementAnchor = true;
    assetAnchor.add(placementAnchor);
  });
  const leafDetails = new THREE.InstancedMesh(
    shared.leafDetailGeometry,
    shared.leafDetailMaterial,
    COVER_ARCH_LAYOUT.length * 6,
  );
  const leafDummy = new THREE.Object3D();
  const leafColor = new THREE.Color();
  const bark = new THREE.MeshStandardMaterial({
    color: 0x765e46,
    roughness: 0.92,
    vertexColors: true,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 0.3,
    map: barkTextures.albedo,
    roughnessMap: barkTextures.roughness,
    bumpMap: barkTextures.height,
    bumpScale: 0.03,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: 0x557b59,
    roughness: 0.86,
    vertexColors: true,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 0.32,
  });
  COVER_ARCH_LAYOUT.forEach(({ centerX, z, spread }, index) => {
    const ground = terrainHeight(centerX, z);
    const leftTree = COVER_RIPARIAN_TREE_LAYOUT[index * 2];
    const rightTree = COVER_RIPARIAN_TREE_LAYOUT[index * 2 + 1];
    const leftGround = terrainHeight(leftTree.x, leftTree.z);
    const rightGround = terrainHeight(rightTree.x, rightTree.z);
    const leftHeightScale = 1 + (leftTree.scale - 0.76) * 0.85;
    const rightHeightScale = 1 + (rightTree.scale - 0.76) * 0.85;
    const left = primitive(
      bark,
      shared.trunkGeometry,
      [leftTree.x, leftGround, leftTree.z],
      [0.74 + leftTree.scale * 0.1, leftHeightScale, 0.74 + leftTree.scale * 0.1],
      [0, leftTree.trunkYaw, 0],
    );
    left.name = `riparian-rooted-trunk-${index + 1}-left`;
    const right = primitive(
      bark,
      shared.trunkGeometry,
      [rightTree.x, rightGround, rightTree.z],
      [0.74 + rightTree.scale * 0.1, rightHeightScale, 0.74 + rightTree.scale * 0.1],
      [0, rightTree.trunkYaw, 0],
    );
    right.name = `riparian-rooted-trunk-${index + 1}-right`;
    const leftReach = 1.58 + ((leftTree.index * 7) % 5) * 0.19;
    const rightReach = 1.58 + ((rightTree.index * 7) % 5) * 0.19;
    const leftRise = 1.02 + ((leftTree.index * 3) % 4) * 0.17;
    const rightRise = 1.02 + ((rightTree.index * 3) % 4) * 0.17;
    const leftDrift = ((leftTree.index * 11) % 7 - 3) * 0.11;
    const rightDrift = ((rightTree.index * 11) % 7 - 3) * 0.11;
    const leftJoinY = leftGround - ground + 4.18 * leftHeightScale;
    const rightJoinY = rightGround - ground + 4.18 * rightHeightScale;
    const leftBough = primitive(
      bark,
      createRootSupportedRiparianBoughGeometry({
        rootX: -spread,
        rootHeightOffset: leftGround - ground,
        side: 'left',
        treeIndex: leftTree.index,
        trunkHeightScale: leftHeightScale,
      }),
      [centerX, ground, z],
      [1, 1, 1],
      [0, 0, 0],
    );
    leftBough.name = `root-supported-riparian-bough-${index + 1}-left`;
    const rightBough = primitive(
      bark,
      createRootSupportedRiparianBoughGeometry({
        rootX: spread,
        rootHeightOffset: rightGround - ground,
        side: 'right',
        treeIndex: rightTree.index,
        trunkHeightScale: rightHeightScale,
      }),
      [centerX, ground, z],
      [1, 1, 1],
      [0, 0, 0],
    );
    rightBough.name = `root-supported-riparian-bough-${index + 1}-right`;
    const leftCrown = primitive(
      leaf,
      shared.crownGeometry,
      [
        centerX - spread + leftReach * 0.48,
        ground + leftJoinY + leftRise * 0.58,
        z + leftDrift * 0.5,
      ],
      [0.4 + leftTree.scale * 0.055, 0.3 + leftTree.scale * 0.035, 0.38],
      [0.03, leftTree.trunkYaw * 0.58, -0.035],
    );
    leftCrown.name = `tree-supported-crown-${index + 1}-left`;
    const rightCrown = primitive(
      leaf,
      shared.crownGeometry,
      [
        centerX + spread - rightReach * 0.48,
        ground + rightJoinY + rightRise * 0.58,
        z + rightDrift * 0.5,
      ],
      [0.39 + rightTree.scale * 0.06, 0.29 + rightTree.scale * 0.04, 0.4],
      [-0.035, rightTree.trunkYaw * 0.54, 0.04],
    );
    rightCrown.name = `tree-supported-crown-${index + 1}-right`;
    const dominantTree = index % 2 === 0 ? leftTree : rightTree;
    const dominantReach = index % 2 === 0 ? leftReach : rightReach;
    const dominantJoinY = index % 2 === 0 ? leftJoinY : rightJoinY;
    const dominantRise = index % 2 === 0 ? leftRise : rightRise;
    const dominantDrift = index % 2 === 0 ? leftDrift : rightDrift;
    const dominantDirection = index % 2 === 0 ? 1 : -1;
    const overlapCrown = primitive(
      leaf,
      shared.crownAccentGeometry,
      [
        centerX + dominantDirection * (-spread + dominantReach * 0.94),
        ground + dominantJoinY + dominantRise + 0.2,
        z + dominantDrift,
      ],
      [0.34, 0.27, 0.33],
      [0.04, dominantTree.trunkYaw * 0.42, dominantDirection * -0.05],
    );
    overlapCrown.name = `tree-supported-overlap-crown-${index + 1}-${dominantTree.side}`;
    group.add(left, right, leftBough, rightBough, leftCrown, rightCrown, overlapCrown);
    const leafAnchors = [
      [leftTree.x - 0.35, leftGround + 5.36 * leftHeightScale, z - 0.38, 1.12, leftTree.trunkYaw],
      [leftTree.x + leftReach * 0.46, ground + leftJoinY + leftRise * 0.72, z + leftDrift - 0.24, 1.04, leftTree.trunkYaw + 0.72],
      [leftTree.x + leftReach * 0.92, ground + leftJoinY + leftRise + 0.3, z + leftDrift + 0.16, 0.98, leftTree.trunkYaw + 1.1],
      [rightTree.x - rightReach * 0.9, ground + rightJoinY + rightRise + 0.22, z + rightDrift - 0.18, 0.96, rightTree.trunkYaw - 0.7],
      [rightTree.x - rightReach * 0.44, ground + rightJoinY + rightRise * 0.7, z + rightDrift + 0.28, 1.04, rightTree.trunkYaw + 0.48],
      [rightTree.x + 0.42, rightGround + 5.28 * rightHeightScale, z + 0.34, 1.1, rightTree.trunkYaw],
    ];
    leafAnchors.forEach(([x, y, leafZ, scale, yaw], anchorIndex) => {
      const leafIndex = index * 6 + anchorIndex;
      leafDummy.position.set(x, y, leafZ);
      leafDummy.rotation.set(0, yaw, 0);
      leafDummy.scale.set(scale, scale * 0.72, scale);
      leafDummy.updateMatrix();
      leafDetails.setMatrixAt(leafIndex, leafDummy.matrix);
      leafColor.setHSL(
        0.315 + anchorIndex * 0.007,
        0.42,
        0.44 + (index % 2) * 0.018 + (anchorIndex % 3) * 0.014,
      );
      leafDetails.setColorAt(leafIndex, leafColor);
    });
  });
  leafDetails.name = 'world.connected_route.cover-arch-leaf-detail';
  // The closed crown masses already cast the aggregate canopy shadow. The
  // visible leaf blades are a geometric detail LOD: casting or receiving the
  // proxy volume again would count the same leaf area twice and blacken their
  // physically transmitted underside. The interior crown is the bounded
  // aggregate occluder; the outer blades resolve shape and sun transmission.
  leafDetails.castShadow = false;
  leafDetails.receiveShadow = false;
  leafDetails.userData.supportModel = shared.leafDetailGeometry.userData.supportModel;
  leafDetails.userData.shadowModel = 'aggregate-crown-owns-canopy-occlusion';
  group.add(leafDetails);
  group.name = 'world.connected_route.cover_arches';
  group.userData.profile = 'asymmetric-riparian-overlap-canopy';
  group.userData.collisionRole = 'solid-visible-trunks-with-non-solid-branches-and-pliable-leaves';
  assetAnchor.userData.fallbackMeshes = Object.freeze([...group.children]);
  scene.add(group, assetAnchor);
  return Object.freeze({ group, assetAnchor });
}

export { makeRiparianCover };
