import * as THREE from 'three';

import { SCENE_BUDGET, seededRandom } from './config.js';
import {
  FOREGROUND_FROND_LAYOUT,
  HABITAT_TREE_LAYOUT,
  VEGETATION_LAYOUT,
} from './environment-layout.js';
import {
  createWeatheredRockGeometry,
  rockTextures,
  settleRockOnTerrain,
} from './rock-rendering.js';
import { terrainHeight } from './terrain.js';
import { createLeafWindDepthMaterial } from './vegetation-leaf-materials.js';
import { shared } from './vegetation-rendering.js';

function placeVegetation(scene) {
  const canopyTreeAssetAnchor = new THREE.Group();
  canopyTreeAssetAnchor.name = 'world.connected_route.canopy-tree-sentinels';
  VEGETATION_LAYOUT.trees.forEach((tree) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.name = `world.connected_route.canopy-tree-placement-${tree.index + 1}`;
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    placementAnchor.userData.canopyTreePlacementAnchor = true;
    canopyTreeAssetAnchor.add(placementAnchor);
  });
  const wetTrunkCount = VEGETATION_LAYOUT.trees.filter(
    ({ barkFamily }) => barkFamily === 'wet-furrowed',
  ).length;
  const plateTrunkCount = VEGETATION_LAYOUT.trees.length - wetTrunkCount;
  const trunkMeshes = {
    'wet-furrowed': new THREE.InstancedMesh(
      shared.trunkGeometry,
      shared.trunkMaterial,
      wetTrunkCount,
    ),
    'plate-barked': new THREE.InstancedMesh(
      shared.plateBarkedTrunkGeometry,
      shared.plateBarkMaterial,
      plateTrunkCount,
    ),
  };
  const crownMesh = new THREE.InstancedMesh(
    shared.crownGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const crownAccentMesh = new THREE.InstancedMesh(
    shared.crownAccentGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const ellipticTreeCount = VEGETATION_LAYOUT.trees.filter(
    ({ leafFamily }) => leafFamily === 'elliptic-waxy',
  ).length;
  const compoundTreeCount = VEGETATION_LAYOUT.trees.filter(
    ({ leafFamily }) => leafFamily === 'compound-lanceolate',
  ).length;
  const canopyBranchMeshes = {
    'elliptic-waxy': new THREE.InstancedMesh(
      shared.canopyBranchGeometry,
      shared.trunkMaterial,
      ellipticTreeCount,
    ),
    'compound-lanceolate': new THREE.InstancedMesh(
      shared.canopyBranchGeometry,
      shared.plateBarkMaterial,
      compoundTreeCount,
    ),
  };
  const araucariaMesh = new THREE.InstancedMesh(
    shared.araucariaGeometry,
    shared.crownMaterial,
    VEGETATION_LAYOUT.trees.filter(({ isAraucaria }) => isAraucaria).length,
  );
  const leafDetailMeshes = {
    'elliptic-waxy': new THREE.InstancedMesh(
      shared.canopyLeafGeometries[0],
      shared.canopyLeafMaterials[0],
      ellipticTreeCount,
    ),
    'compound-lanceolate': new THREE.InstancedMesh(
      shared.canopyLeafGeometries[1],
      shared.canopyLeafMaterials[1],
      compoundTreeCount,
    ),
  };
  const dummy = new THREE.Object3D();
  const trunkColor = new THREE.Color();
  const crownColor = new THREE.Color();
  let araucariaIndex = 0;

  VEGETATION_LAYOUT.trees.forEach((tree) => {
    const {
      index: i, x, z, scale, isAraucaria,
    } = tree;
    const y = terrainHeight(x, z);
    const crownClusterScale = 0.5 + ((i * 7) % 5) * 0.024;
    const crownValueShift = (Math.floor(i / 5) % 3 - 1) * 0.026;
    // The current authored trunk loft starts at y=0. The previous placement
    // still treated it like a center-origin cylinder and lifted every tree by
    // roughly half its height. Reset all Euler axes as well: otherwise a
    // crown's tilt leaks into the next trunk through the reused dummy object.
    dummy.position.set(x, y - 0.035 * scale, z);
    dummy.rotation.set(0, tree.trunkYaw, 0);
    dummy.scale.set(...tree.trunkScale);
    dummy.updateMatrix();
    const trunkMesh = trunkMeshes[tree.barkFamily];
    trunkMesh.setMatrixAt(tree.trunkFamilyIndex, dummy.matrix);
    trunkColor.setHSL(...tree.trunkColor);
    trunkMesh.setColorAt(tree.trunkFamilyIndex, trunkColor);

    if (!isAraucaria) {
      dummy.position.set(x, y + 4.78 * scale, z);
      dummy.rotation.set(0, tree.trunkYaw + tree.crownRotation[1] * 0.16, 0);
      dummy.scale.set(
        scale * 1.08,
        scale * (0.94 + (i % 4) * 0.035),
        scale * (0.94 + ((i + 2) % 5) * 0.028),
      );
      dummy.updateMatrix();
      const canopyBranchMesh = canopyBranchMeshes[tree.leafFamily];
      canopyBranchMesh.setMatrixAt(tree.canopyFamilyIndex, dummy.matrix);
      canopyBranchMesh.setColorAt(tree.canopyFamilyIndex, trunkColor);

      const leafDetailMesh = leafDetailMeshes[tree.leafFamily];
      leafDetailMesh.setMatrixAt(tree.canopyFamilyIndex, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(
        tree.leafFamily === 'compound-lanceolate' ? -0.012 : 0.006,
        tree.leafFamily === 'compound-lanceolate' ? 0.012 : 0.008,
        tree.leafFamily === 'compound-lanceolate' ? 0.4 : 0.42,
      );
      leafDetailMesh.setColorAt(tree.canopyFamilyIndex, crownColor);
    }

    if (isAraucaria) {
      dummy.position.set(x, y + 5.72 * scale, z);
      dummy.rotation.set(0, tree.canopyYaw, 0);
      dummy.scale.set(...tree.canopyScale).multiplyScalar(crownClusterScale);
      dummy.updateMatrix();
      araucariaMesh.setMatrixAt(araucariaIndex, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(0, crownValueShift * 0.55, crownValueShift);
      araucariaMesh.setColorAt(araucariaIndex, crownColor);
      araucariaIndex += 1;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownAccentMesh.setMatrixAt(i, dummy.matrix);
      crownMesh.setColorAt(i, crownColor);
      crownAccentMesh.setColorAt(i, crownColor);
    } else {
      const [crownOffsetX, crownOffsetZ] = tree.crownOffset;
      dummy.position.set(x + crownOffsetX, y + 6.15 * scale, z + crownOffsetZ);
      dummy.rotation.set(...tree.crownRotation);
      dummy.scale.set(...tree.crownScale).multiplyScalar(crownClusterScale * 0.94);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(0, crownValueShift * 0.55, crownValueShift);
      crownMesh.setColorAt(i, crownColor);

      dummy.position.set(
        x + tree.accentOffset[0],
        y + 7.05 * scale,
        z + tree.accentOffset[1],
      );
      dummy.rotation.set(...tree.accentRotation);
      dummy.scale.set(...tree.accentScale).multiplyScalar(0.58 + (i % 3) * 0.035);
      dummy.updateMatrix();
      crownAccentMesh.setMatrixAt(i, dummy.matrix);
      crownColor.offsetHSL(0.01, -0.02, 0.035);
      crownAccentMesh.setColorAt(i, crownColor);
    }
  });
  trunkMeshes['wet-furrowed'].name = 'world.connected_route.tree_trunks';
  trunkMeshes['plate-barked'].name = 'world.connected_route.tree_trunks-plate-barked';
  canopyBranchMeshes['elliptic-waxy'].name = 'world.connected_route.canopy-load-bearing-branches';
  canopyBranchMeshes['compound-lanceolate'].name = 'world.connected_route.canopy-load-bearing-branches-plate-barked';
  crownMesh.name = 'world.connected_route.canopy';
  crownAccentMesh.name = 'world.connected_route.canopy-highlights';
  araucariaMesh.name = 'world.connected_route.araucaria-canopy';
  leafDetailMeshes['elliptic-waxy'].name = 'world.connected_route.canopy-leaf-detail';
  leafDetailMeshes['compound-lanceolate'].name = 'world.connected_route.canopy-leaf-detail-compound';
  Object.values(trunkMeshes).forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'solid-visible-trunk-family';
  });
  Object.values(canopyBranchMeshes).forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  crownAccentMesh.castShadow = true;
  crownAccentMesh.receiveShadow = true;
  araucariaMesh.castShadow = true;
  araucariaMesh.receiveShadow = true;
  Object.values(leafDetailMeshes).forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = createLeafWindDepthMaterial(mesh.material);
    mesh.userData.collisionRole = 'non-solid-leaf-spray';
  });
  canopyTreeAssetAnchor.userData.fallbackMeshes = Object.freeze([
    ...Object.values(trunkMeshes),
    ...Object.values(canopyBranchMeshes),
    crownMesh,
    crownAccentMesh,
    araucariaMesh,
    ...Object.values(leafDetailMeshes),
  ]);
  scene.add(
    canopyTreeAssetAnchor,
    ...Object.values(trunkMeshes),
    ...Object.values(canopyBranchMeshes),
    crownMesh,
    crownAccentMesh,
    araucariaMesh,
    ...Object.values(leafDetailMeshes),
  );

  const fernMeshes = shared.fernGeometries.map((geometry, variantIndex) => {
    const count = Math.floor((SCENE_BUDGET.ferns + 2 - variantIndex) / 3);
    return new THREE.InstancedMesh(geometry, shared.fernMaterial, count);
  });
  const fernInstanceIndices = [0, 0, 0];
  VEGETATION_LAYOUT.ferns.forEach((fern) => {
    const {
      x, z, scale, variantIndex,
    } = fern;
    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(0, fern.rotation, 0);
    dummy.scale.set(...fern.instanceScale);
    dummy.updateMatrix();
    const fernMesh = fernMeshes[variantIndex];
    const instanceIndex = fernInstanceIndices[variantIndex];
    fernMesh.setMatrixAt(instanceIndex, dummy.matrix);
    crownColor.setHSL(...fern.color);
    fernMesh.setColorAt(instanceIndex, crownColor);
    fernInstanceIndices[variantIndex] += 1;
  });
  fernMeshes.forEach((fernMesh, index) => {
    fernMesh.name = index === 0
      ? 'world.connected_route.ferns'
      : `world.connected_route.ferns-variant-${index + 1}`;
    fernMesh.castShadow = true;
    fernMesh.receiveShadow = true;
  });
  scene.add(...fernMeshes);
  const fernAssetAnchor = new THREE.Group();
  fernAssetAnchor.name = 'world.connected_route.ferns.asset-anchor';
  fernAssetAnchor.userData.fallbackMeshes = fernMeshes;
  scene.add(fernAssetAnchor);

  const stoneCount = 96;
  const groundStoneGeometry = createWeatheredRockGeometry(1571, 1).scale(0.42, 0.42, 0.42);
  const stoneMesh = new THREE.InstancedMesh(
    groundStoneGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.97,
      map: rockTextures.albedo,
      roughnessMap: rockTextures.roughness,
      bumpMap: rockTextures.height,
      bumpScale: 0.018,
    }),
    stoneCount,
  );
  VEGETATION_LAYOUT.stones.forEach((stone) => {
    const {
      index, x, z, scale,
    } = stone;
    const visualClusterScale = 0.72 + ((index * 5) % 7) * 0.06;
    settleRockOnTerrain(dummy, groundStoneGeometry, {
      id: `ground-stone-${index + 1}`,
      x,
      z,
      yaw: stone.rotation[1],
      scale: stone.instanceScale.map((value) => value * visualClusterScale),
      burial: 0.025,
      solid: false,
    });
    stoneMesh.setMatrixAt(index, dummy.matrix);
    crownColor.setHSL(...stone.color);
    crownColor.offsetHSL(0, -0.025, (Math.floor(index / 9) % 3 - 1) * 0.025 - 0.025);
    stoneMesh.setColorAt(index, crownColor);
  });
  stoneMesh.name = 'world.connected_route.ground-stones';
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.userData.collisionRole = 'non-solid-sub-step-ground-decor';
  scene.add(stoneMesh);
  return Object.freeze({
    trunkMeshes: Object.freeze(Object.values(trunkMeshes)),
    canopyBranchMeshes: Object.freeze(Object.values(canopyBranchMeshes)),
    leafDetailMeshes: Object.freeze(Object.values(leafDetailMeshes)),
    crownMesh,
    crownAccentMesh,
    araucariaMesh,
    fernMeshes: Object.freeze(fernMeshes),
    fernAssetAnchor,
    canopyTreeAssetAnchor,
    profile: 'two-broadleaf-bark-and-leaf-families-plus-araucaria',
  });
}

function makeHabitatAccents(scene) {
  // The broad central sightline stays open, while authored tree-fern sentinels
  // provide near/mid/far scale at its margins.  This avoids solving depth with
  // indiscriminate scatter or a repeated wall of identical canopy crowns.
  const placements = HABITAT_TREE_LAYOUT;
  const treeFernAssetAnchor = new THREE.Group();
  treeFernAssetAnchor.name = 'world.connected_route.tree-fern-sentinels';
  placements.forEach(([x, z], index) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.name = `world.connected_route.tree-fern-placement-${index + 1}`;
    placementAnchor.position.set(x, terrainHeight(x, z), z);
    placementAnchor.userData.treeFernPlacementAnchor = true;
    treeFernAssetAnchor.add(placementAnchor);
  });
  const trunks = new THREE.InstancedMesh(
    shared.treeFernTrunkGeometry,
    shared.treeFernTrunkMaterial,
    placements.length,
  );
  const crownCounts = shared.treeFernCrownGeometries.map((_, variantIndex) => (
    placements.filter((__, index) => index % shared.treeFernCrownGeometries.length === variantIndex).length
  ));
  const crownMeshes = shared.treeFernCrownGeometries.map((geometry, variantIndex) => (
    new THREE.InstancedMesh(geometry, shared.fernMaterial, crownCounts[variantIndex])
  ));
  const crownIndices = crownMeshes.map(() => 0);
  const skirts = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    placements.length * 2,
  );
  const foregroundPlacements = FOREGROUND_FROND_LAYOUT;
  const foregroundFronds = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    foregroundPlacements.length,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const random = seededRandom(1889);
  const fernLibraryPlacements = [];

  placements.forEach(([x, z, scale, yaw], index) => {
    const ground = terrainHeight(x, z);
    dummy.position.set(x, ground - 0.02, z);
    dummy.rotation.set((random() - 0.5) * 0.12, yaw, (random() - 0.5) * 0.1);
    dummy.scale.set(scale * 0.92, scale * (1.03 + random() * 0.12), scale * 0.92);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.245 + random() * 0.025, 0.25, 0.19 + random() * 0.04);
    trunks.setColorAt(index, color);

    dummy.position.set(x, ground + 2.65 * scale, z);
    dummy.rotation.set(-0.12 + random() * 0.24, yaw + random() * 0.55, 0.09 - random() * 0.18);
    dummy.scale.set(
      scale * (0.82 + random() * 0.38),
      scale * (0.86 + random() * 0.28),
      scale * (0.78 + random() * 0.4),
    );
    dummy.updateMatrix();
    const crownVariant = index % crownMeshes.length;
    const crownMesh = crownMeshes[crownVariant];
    const crownIndex = crownIndices[crownVariant];
    crownMesh.setMatrixAt(crownIndex, dummy.matrix);
    color.setHSL(0.31 + random() * 0.04, 0.46 + random() * 0.08, 0.17 + random() * 0.055);
    crownMesh.setColorAt(crownIndex, color);
    crownIndices[crownVariant] += 1;

    for (let skirt = 0; skirt < 2; skirt += 1) {
      const angle = yaw + skirt * Math.PI + (random() - 0.5) * 0.5;
      const radius = scale * (0.64 + random() * 0.35);
      const skirtX = x + Math.cos(angle) * radius;
      const skirtZ = z + Math.sin(angle) * radius;
      const skirtRotation = angle + random();
      const skirtScale = scale * (0.72 + random() * 0.3);
      dummy.position.set(skirtX, terrainHeight(skirtX, skirtZ) + 0.025, skirtZ);
      dummy.rotation.set(0, skirtRotation, 0);
      dummy.scale.setScalar(skirtScale);
      dummy.updateMatrix();
      const skirtIndex = index * 2 + skirt;
      skirts.setMatrixAt(skirtIndex, dummy.matrix);
      const skirtColor = [
        0.295 + random() * 0.05,
        0.4 + random() * 0.1,
        0.18 + random() * 0.045,
      ];
      color.setHSL(...skirtColor);
      skirts.setColorAt(skirtIndex, color);
      const matureScale = skirtScale * 0.36;
      fernLibraryPlacements.push(Object.freeze({
        index: skirtIndex,
        x: skirtX,
        z: skirtZ,
        scale: matureScale,
        variantIndex: 2,
        rotation: skirtRotation,
        instanceScale: Object.freeze([matureScale, matureScale * 0.92, matureScale]),
        color: Object.freeze(skirtColor),
        sourceRole: 'tree-fern-understory-skirt-replacement',
        maxDiameterMeters: 1.45,
        maxHeightMeters: 0.4,
      }));
    }
  });

  foregroundPlacements.forEach(([x, z, scale, yaw], index) => {
    const ground = terrainHeight(x, z);
    dummy.position.set(x, ground + 0.025, z);
    dummy.rotation.set(0, yaw, (index % 2 ? -1 : 1) * 0.035);
    dummy.scale.set(scale * 1.18, scale * 0.72, scale);
    dummy.updateMatrix();
    foregroundFronds.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.305 + random() * 0.025, 0.45 + random() * 0.07, 0.115 + random() * 0.025);
    foregroundFronds.setColorAt(index, color);
  });

  trunks.name = 'world.connected_route.tree-fern-sentinels.procedural-trunks';
  skirts.name = 'world.connected_route.tree-fern-understory';
  foregroundFronds.name = 'world.connected_route.foreground-depth-fronds';
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crownMeshes.forEach((crownMesh, index) => {
    crownMesh.name = index === 0
      ? 'world.connected_route.tree-fern-crowns.procedural'
      : `world.connected_route.tree-fern-crowns.procedural-variant-${index + 1}`;
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
  });
  skirts.castShadow = true;
  skirts.receiveShadow = true;
  foregroundFronds.castShadow = true;
  foregroundFronds.receiveShadow = true;
  treeFernAssetAnchor.userData.fallbackMeshes = Object.freeze([trunks, ...crownMeshes]);
  scene.add(treeFernAssetAnchor, trunks, ...crownMeshes, skirts, foregroundFronds);
  return {
    treeFernAssetAnchor,
    trunks,
    crowns: crownMeshes,
    skirts,
    foregroundFronds,
    fernLibraryPlacements: Object.freeze(fernLibraryPlacements),
  };
}

export { makeHabitatAccents, placeVegetation };
