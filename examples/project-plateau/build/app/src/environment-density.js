import * as THREE from 'three';

import { createBryophyteGroundLayer } from './bryophyte-ground-layer.js';
import { NAVIGATION_BOUNDS } from './collision-layout.js';
import { SCENE_BUDGET, seededRandom } from './config.js';
import {
  createDeadwoodMaterial,
  createDriftwoodGeometry,
} from './deadwood-rendering.js';
import {
  FAMILY_LAYOUT,
  HABITAT_TREE_LAYOUT,
  HERO_GINGKO_LAYOUT,
  TRACK_IMPRESSION,
} from './environment-layout.js';
import { createForestFloorDetritusLayer } from './forest-floor-detritus.js';
import {
  createForestSuccessionLayout,
  FOREST_SUCCESSION_PROFILE,
} from './forest-succession.js';
import {
  terrainEcologyAt,
  terrainGradient,
  terrainHeight,
  terrainSlope,
  terrainWetness,
} from './terrain.js';
import {
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from './vegetation-albedo.js';
import { shared } from './vegetation-rendering.js';

function makeDegradableGroundAccents(scene) {
  const group = new THREE.Group();
  const wetlandCount = 36;
  const marginCount = 28;
  const wetland = new THREE.InstancedMesh(
    shared.fernGeometries[1],
    shared.fernMaterial,
    wetlandCount,
  );
  const margins = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    marginCount,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const random = seededRandom(2719);
  const fernLibraryPlacements = [];

  // Follow the brook at irregular intervals, but stay outside its open water
  // and the opening track read. These are visual instances only: they never
  // enter collision or navigation truth.
  for (let index = 0; index < wetlandCount; index += 1) {
    const t = (index + 0.35 + random() * 0.3) / wetlandCount;
    const z = THREE.MathUtils.lerp(82, -66, t);
    const brookX = -11.5 + Math.sin(z * 0.071) * 3.1;
    const side = index % 2 ? -1 : 1;
    const x = brookX + side * (3.1 + random() * 2.2);
    const trackDistance = Math.hypot(x - TRACK_IMPRESSION.x, z - TRACK_IMPRESSION.z);
    const finalZ = trackDistance < 7 ? z + (z > TRACK_IMPRESSION.z ? 7 : -7) : z;
    const scale = 0.62 + random() * 0.72;
    const rotation = random() * Math.PI * 2;
    const tilt = (random() - 0.5) * 0.07;
    const instanceScale = [
      scale * (0.72 + random() * 0.28),
      scale * (1.1 + random() * 0.35),
      scale,
    ];
    dummy.position.set(x, terrainHeight(x, finalZ) + 0.02, finalZ);
    dummy.rotation.set(0, rotation, tilt);
    dummy.scale.set(...instanceScale);
    dummy.updateMatrix();
    wetland.setMatrixAt(index, dummy.matrix);
    const wetlandColor = [
      0.36 + random() * 0.035,
      0.34 + random() * 0.12,
      0.16 + random() * 0.055,
    ];
    color.setHSL(...wetlandColor);
    wetland.setColorAt(index, color);
    fernLibraryPlacements.push(Object.freeze({
      index,
      x,
      z: finalZ,
      scale: scale * 0.32,
      variantIndex: 0,
      rotation,
      instanceScale: Object.freeze(instanceScale.map((value) => value * 0.32)),
      color: Object.freeze(wetlandColor),
      sourceRole: 'degradable-wetland-accent-replacement',
      maxDiameterMeters: 1.4,
      maxHeightMeters: 0.5,
    }));
  }

  // Alternate route margins and depth bands so the plateau no longer reads
  // as one flat horizontal strip or a regularly spaced tree row.
  for (let index = 0; index < marginCount; index += 1) {
    const nearBand = index < 18;
    const side = index % 2 ? -1 : 1;
    const z = nearBand ? 64 - random() * 103 : -54 + random() * 70;
    const corridorCentre = z > 18 ? 3 : 1;
    const marginDistance = z > 18 ? 4.4 : z > -15 ? 6 : 8.2;
    const x = nearBand
      ? corridorCentre + side * (marginDistance + random() * 2)
      : side * (20 + random() * 13);
    const scale = nearBand ? 1.8 + random() * 1.8 : 0.9 + random() * 1.05;
    const rotation = random() * Math.PI * 2;
    const tilt = side * (0.04 + random() * 0.08);
    const instanceScale = [
      scale * (1.12 + random() * 0.32),
      scale * (0.68 + random() * 0.22),
      scale,
    ];
    dummy.position.set(x, terrainHeight(x, z) + 0.025, z);
    dummy.rotation.set(0, rotation, tilt);
    dummy.scale.set(...instanceScale);
    dummy.updateMatrix();
    margins.setMatrixAt(index, dummy.matrix);
    const marginColor = [
      0.3 + random() * 0.035,
      0.4 + random() * 0.11,
      nearBand ? 0.105 : 0.15 + random() * 0.04,
    ];
    color.setHSL(...marginColor);
    margins.setColorAt(index, color);
    const matureScale = Math.min(0.72, scale * 0.28);
    const scaleRatio = matureScale / scale;
    fernLibraryPlacements.push(Object.freeze({
      index: wetlandCount + index,
      x,
      z,
      scale: matureScale,
      variantIndex: 2,
      rotation,
      instanceScale: Object.freeze(instanceScale.map((value) => value * scaleRatio)),
      color: Object.freeze(marginColor),
      sourceRole: 'degradable-margin-accent-replacement',
      maxDiameterMeters: nearBand ? 2.6 : 1.8,
      maxHeightMeters: nearBand ? 1.4 : 0.9,
    }));
  }

  wetland.name = 'world.connected_route.degradable-wetland-accents';
  margins.name = 'world.connected_route.degradable-margin-accents';
  for (const mesh of [wetland, margins]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
  }
  group.name = 'world.connected_route.degradable-ground-accents';
  group.userData.profile = 'deterministic-non-solid-instanced-accents';
  group.userData.instanceCount = wetlandCount + marginCount;
  group.userData.fernLibraryPlacements = Object.freeze(fernLibraryPlacements);
  group.userData.proceduralFallbackMeshes = Object.freeze([wetland, margins]);
  group.add(wetland, margins);
  scene.add(group);
  return group;
}

function makeEnvironmentDensity(scene) {
  const group = new THREE.Group();
  const random = seededRandom(4871);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const groundCoverMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.34,
  });
  const broadleafGroundCoverMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.42,
  });
  const coverCounts = shared.groundCoverGeometries.map((_, variant) => (
    Math.floor((SCENE_BUDGET.groundCover + 2 - variant) / 3)
  ));
  const coverMeshes = shared.groundCoverGeometries.map((geometry, variant) => {
    const material = variant === 2 ? broadleafGroundCoverMaterial : groundCoverMaterial;
    const mesh = new THREE.InstancedMesh(geometry, material, coverCounts[variant]);
    mesh.name = `world.environment-density.ground-cover-${variant + 1}`;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
    return mesh;
  });
  const coverIndices = [0, 0, 0];
  const coverPlacements = [];

  function blocksAuthoredRead(x, z) {
    if (Math.hypot(x - TRACK_IMPRESSION.x, z - TRACK_IMPRESSION.z) < 5.8) return true;
    if (Math.hypot(x - 1, z - 81) < 18) return true;
    if (z > 18 && z < 72 && Math.abs(x - 3) < 5.8) return true;
    if (z > -58 && z <= 18 && Math.abs(x - 1) < 8.5) return true;
    return FAMILY_LAYOUT.some((animal) => Math.hypot(x - animal.x, z - animal.z) < 3.2);
  }

  // Low, pliable plants can approach the walking corridor much more closely
  // than trunks, deadfall or moss mats. Keeping only a narrow boot-width seam
  // open replaces the old bare "game lane" with readable edge parallax while
  // leaving every collision, track impression and animal silhouette untouched.
  function blocksGroundCoverRead(x, z) {
    if (Math.hypot(x - TRACK_IMPRESSION.x, z - TRACK_IMPRESSION.z) < 3.8) return true;
    if (Math.hypot(x - 1, z - 81) < 13) return true;
    if (z > 18 && z < 72 && Math.abs(x - 3) < 2) return true;
    if (z > -58 && z <= 18 && Math.abs(x - 1) < 3.6) return true;
    return FAMILY_LAYOUT.some((animal) => Math.hypot(x - animal.x, z - animal.z) < 3.2);
  }

  const forestFloorDetritus = createForestFloorDetritusLayer({
    terrainHeight,
    terrainGradient,
    terrainEcologyAt,
    sources: HABITAT_TREE_LAYOUT,
    heroSource: [HERO_GINGKO_LAYOUT.x, HERO_GINGKO_LAYOUT.z, HERO_GINGKO_LAYOUT.scale],
    blocksPlacement: blocksAuthoredRead,
    count: SCENE_BUDGET.forestFloorDetritus,
  });
  const bryophyteGroundLayer = createBryophyteGroundLayer({
    terrainHeight,
    terrainGradient,
    terrainEcologyAt,
    blocksPlacement: blocksAuthoredRead,
    targetCount: SCENE_BUDGET.bryophyteGround,
  });

  const shadeClusters = HABITAT_TREE_LAYOUT.map(([x, z, scale], index) => ({
    x,
    z,
    radius: 3.6 + scale * 2.1,
    microclimate: index % 2 ? 'broken-canopy-shade' : 'trunk-dripline',
  }));
  const wetlandClusters = Array.from({ length: 12 }, (_, index) => {
    const z = THREE.MathUtils.lerp(76, -66, index / 11);
    const brookX = -11.5 + Math.sin(z * 0.071) * 3.1;
    const side = index % 2 ? -1 : 1;
    return {
      x: brookX + side * (4.8 + (index % 3) * 0.62),
      z,
      radius: 3.2 + (index % 4) * 0.55,
      microclimate: 'brook-bank-moisture',
    };
  });
  const routeEdgeClusters = Array.from({ length: 12 }, (_, index) => {
    const z = THREE.MathUtils.lerp(66, -46, index / 11);
    const corridorCentre = z > 18 ? 3 : 1;
    const corridorHalfWidth = z > 18 ? 4 : 6.2;
    const side = index % 2 ? -1 : 1;
    return {
      x: corridorCentre + side * (corridorHalfWidth + (index % 3) * 0.65),
      z,
      radius: 2.2 + (index % 4) * 0.38,
      microclimate: 'route-edge-parallax',
    };
  });
  const coverClusters = [...routeEdgeClusters, ...shadeClusters, ...wetlandClusters];

  for (let index = 0; index < SCENE_BUDGET.groundCover; index += 1) {
    let cluster = coverClusters[index % coverClusters.length];
    let x;
    let z;
    let attempts = 0;
    do {
      if (attempts > 0 && attempts % 6 === 0) {
        cluster = coverClusters[(index + attempts / 6) % coverClusters.length];
      }
      const angle = random() * Math.PI * 2;
      const radius = cluster.radius * random() ** 1.55;
      x = cluster.x + Math.cos(angle) * radius;
      z = cluster.z + Math.sin(angle) * radius * (0.72 + random() * 0.42);
      attempts += 1;
    } while (blocksGroundCoverRead(x, z) && attempts < 30);
    const variant = index % coverMeshes.length;
    const wetness = terrainWetness(x, z);
    const scale = cluster.microclimate === 'route-edge-parallax'
      ? 0.9 + random() ** 1.18 * 1.8
      : 0.42 + random() ** 1.35 * 1.12;
    const tiltX = (random() - 0.5) * 0.05;
    const rotation = random() * Math.PI * 2;
    const tiltZ = (random() - 0.5) * 0.08;
    const instanceScale = [
      scale * (0.72 + random() * 0.52),
      scale * (0.72 + random() * 0.58),
      scale * (0.72 + random() * 0.52),
    ];
    dummy.position.set(x, terrainHeight(x, z) + 0.018, z);
    dummy.rotation.set(tiltX, rotation, tiltZ);
    dummy.scale.set(...instanceScale);
    dummy.updateMatrix();
    const mesh = coverMeshes[variant];
    const instanceIndex = coverIndices[variant];
    mesh.setMatrixAt(instanceIndex, dummy.matrix);
    const coverColor = [
      0.285 + wetness * 0.075 + random() * 0.035,
      0.34 + random() * 0.16,
      0.115 + random() * 0.075,
    ];
    color.setHSL(...coverColor);
    mesh.setColorAt(instanceIndex, color);
    coverPlacements.push(Object.freeze({
      index,
      x,
      z,
      scale,
      variantIndex: variant,
      rotation,
      instanceScale: Object.freeze(instanceScale),
      color: Object.freeze(coverColor),
      microclimate: cluster.microclimate,
    }));
    coverIndices[variant] += 1;
  }

  const groundCoverAssetAnchor = new THREE.Group();
  groundCoverAssetAnchor.name = 'world.environment-density.ground-cover.asset-anchor';
  groundCoverAssetAnchor.userData.fallbackMeshes = coverMeshes;

  const forestSuccession = createForestSuccessionLayout({
    count: SCENE_BUDGET.distantTrees,
    terrainHeight,
    terrainGradient,
    terrainWetness,
    navigationBounds: NAVIGATION_BOUNDS,
  });
  const forestEdgeTrees = Object.freeze(forestSuccession.placements
    .map((placement, index) => Object.freeze({
      index,
      x: placement.x,
      z: placement.z,
      scale: placement.heightScale * 0.92,
      trunkYaw: placement.yaw,
      isAraucaria: placement.crownVariant === 1,
      barkFamily: placement.crownVariant === 1 || index % 3 !== 2
        ? 'wet-furrowed'
        : 'plate-barked',
      leafFamily: placement.crownVariant === 1
        ? 'araucaria-whorl'
        : index % 3 === 2 ? 'compound-lanceolate' : 'elliptic-waxy',
      successionCohortId: placement.cohortId,
      successionAgeClass: placement.ageClass,
      successionWindDamage: placement.windDamage,
    })));
  // Keep the old low-detail batch only as a complete loading fallback. At the
  // accepted runtime all twelve cohorts use the same root-to-leaf original
  // asset, so the southern skyline cannot collapse into unrelated pale blobs.
  const simplifiedForestPlacements = forestSuccession.placements;
  const forestEdgeAssetAnchor = new THREE.Group();
  forestEdgeAssetAnchor.name = 'world.environment-density.forest-edge.original-canopy-anchor';
  forestEdgeAssetAnchor.userData.fallbackMeshes = Object.freeze([]);
  forestEdgeAssetAnchor.userData.placements = forestEdgeTrees;
  forestEdgeTrees.forEach((tree) => {
    const anchor = new THREE.Group();
    anchor.name = `world.environment-density.forest-edge-placement-${tree.index + 1}`;
    anchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    anchor.userData.canopyTreePlacementAnchor = true;
    forestEdgeAssetAnchor.add(anchor);
  });
  const distantTrunkMaterial = new THREE.MeshStandardMaterial({
    color: 0xa69a88,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.18,
  });
  distantTrunkMaterial.emissive.set(0x000000);
  distantTrunkMaterial.emissiveIntensity = 0;
  distantTrunkMaterial.userData = {
    surface: 'bounded-distant-bark-dielectric-response',
    energyModel: 'non-emissive-dielectric-forest-boundary-structure',
  };
  const distantTrunks = new THREE.InstancedMesh(
    shared.trunkGeometry,
    distantTrunkMaterial,
    simplifiedForestPlacements.length,
  );
  const distantCrownMaterials = [
    VEGETATION_BASE_COLOURS.canopyBroadleaf,
    VEGETATION_BASE_COLOURS.canopyAraucaria,
    VEGETATION_BASE_COLOURS.treeFernLeaf,
  ].map((baseColour, crownVariant) => {
    const material = new THREE.MeshStandardMaterial({
      color: baseColour,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.24,
    });
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.userData = {
      surface: 'bounded-distant-canopy-dielectric-response',
      energyModel: 'non-emissive-dielectric-diffuse-forest-boundary-foliage',
      crownVariant,
      successionProfile: FOREST_SUCCESSION_PROFILE.version,
    };
    return material;
  });
  const distantCrownCounts = [0, 1, 2].map((crownVariant) => (
    simplifiedForestPlacements.filter((placement) => (
      placement.crownVariant === crownVariant
    )).length
  ));
  const distantCrownMeshes = [
    new THREE.InstancedMesh(
      shared.crownGeometry, distantCrownMaterials[0], distantCrownCounts[0],
    ),
    new THREE.InstancedMesh(
      shared.araucariaGeometry, distantCrownMaterials[1], distantCrownCounts[1],
    ),
    new THREE.InstancedMesh(
      shared.treeFernCrownGeometries[1], distantCrownMaterials[2], distantCrownCounts[2],
    ),
  ];
  const distantCrownIndices = [0, 0, 0];
  simplifiedForestPlacements.forEach((placement, simplifiedIndex) => {
    const {
      x, z, groundY, yaw, trunkScale, crownVariant, crownScale,
      crownOffset, heightScale, wetness, slope, individual,
    } = placement;
    dummy.position.set(x, groundY - 0.025, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(...trunkScale);
    dummy.updateMatrix();
    distantTrunks.setMatrixAt(simplifiedIndex, dummy.matrix);
    const structureAlbedo = vegetationStructureTint({
      hue: crownVariant === 1 ? 0.075 : 0.09,
      wetness,
      individual,
      baseLightness: 0.61,
    });
    color.setHSL(
      structureAlbedo.hue,
      structureAlbedo.saturation,
      structureAlbedo.lightness,
    );
    distantTrunks.setColorAt(simplifiedIndex, color);

    const sourceCrownHeight = crownVariant === 2 ? 2.72 : crownVariant === 1 ? 5.7 : 6.02;
    dummy.position.set(
      x + crownOffset[0],
      groundY + sourceCrownHeight * heightScale,
      z + crownOffset[1],
    );
    dummy.rotation.set(0, yaw + placement.windDamage * 0.28, 0);
    dummy.scale.set(...crownScale);
    dummy.updateMatrix();
    const distantCrownMesh = distantCrownMeshes[crownVariant];
    const distantCrownIndex = distantCrownIndices[crownVariant];
    distantCrownMesh.setMatrixAt(distantCrownIndex, dummy.matrix);
    const leafAlbedo = vegetationLeafTint([
      'canopy-drained-broadleaf',
      'canopy-araucaria',
      'tree-fern-exposed',
    ][crownVariant], {
      wetness,
      slope,
      individual,
    });
    color.setHSL(leafAlbedo.hue, leafAlbedo.saturation, leafAlbedo.lightness);
    distantCrownMesh.setColorAt(distantCrownIndex, color);
    distantCrownIndices[crownVariant] += 1;
  });
  distantTrunks.name = 'world.environment-density.distant-trunks';
  // These low-detail crowns remain outside the navigation boundary and do not
  // enter the directional shadow pass. The complete mid-distance edge assets
  // below carry the visible local shadow relationship instead.
  distantTrunks.castShadow = false;
  distantTrunks.receiveShadow = true;
  distantCrownMeshes.forEach((mesh, index) => {
    mesh.name = index === 0
      ? 'world.environment-density.distant-canopy'
      : `world.environment-density.distant-canopy-variant-${index + 1}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  });
  forestEdgeAssetAnchor.userData.fallbackMeshes = Object.freeze([
    distantTrunks,
    ...distantCrownMeshes,
  ]);

  const deadfallMaterial = createDeadwoodMaterial();
  const deadfallMeshes = [0, 1, 2].map((variant) => {
    const count = Math.floor((SCENE_BUDGET.deadfall + 2 - variant) / 3);
    const mesh = new THREE.InstancedMesh(createDriftwoodGeometry(variant), deadfallMaterial, count);
    mesh.name = `world.environment-density.deadfall-${variant + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
    return mesh;
  });
  const deadfallIndices = [0, 0, 0];
  const supportPoint = new THREE.Vector3();
  const terrainNormal = new THREE.Vector3();
  const slopeFrame = new THREE.Quaternion();
  const yawFrame = new THREE.Quaternion();
  const measureDeadfallSupport = (geometry) => {
    let minimumClearance = Infinity;
    let maximumClearance = -Infinity;
    for (const coordinates of geometry.userData.supportPoints) {
      supportPoint.set(...coordinates).applyMatrix4(dummy.matrix);
      const clearance = supportPoint.y - terrainHeight(supportPoint.x, supportPoint.z);
      minimumClearance = Math.min(minimumClearance, clearance);
      maximumClearance = Math.max(maximumClearance, clearance);
    }
    return { minimumClearance, maximumClearance };
  };
  for (let index = 0; index < SCENE_BUDGET.deadfall; index += 1) {
    const variant = index % deadfallMeshes.length;
    const geometry = deadfallMeshes[variant].geometry;
    let settled = false;
    let support = null;
    for (let attempt = 0; attempt < 80 && !settled; attempt += 1) {
      const side = index % 2 ? -1 : 1;
      const z = -65 + random() * 132;
      const x = side * (12 + random() * 37);
      const scale = 0.72 + random() * 0.86;
      const yaw = random() * Math.PI;
      const candidateSlope = terrainSlope(x, z);
      if (candidateSlope > 0.18 || blocksAuthoredRead(x, z)) continue;
      const gradient = terrainGradient(x, z, 0.45);
      terrainNormal.set(-gradient.x, 1, -gradient.z).normalize();
      slopeFrame.setFromUnitVectors(new THREE.Vector3(0, 1, 0), terrainNormal);
      yawFrame.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      dummy.position.set(x, terrainHeight(x, z) + 0.09 * scale, z);
      dummy.quaternion.multiplyQuaternions(slopeFrame, yawFrame);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      support = measureDeadfallSupport(geometry);
      dummy.position.y -= support.maximumClearance - 0.012;
      dummy.updateMatrix();
      support = measureDeadfallSupport(geometry);
      settled = support.maximumClearance <= 0.02 && support.minimumClearance >= -0.14;
    }
    if (!settled || !support) throw new Error(`could not settle deadfall instance ${index}`);
    const deadfallMesh = deadfallMeshes[variant];
    const deadfallInstanceIndex = deadfallIndices[variant];
    deadfallMesh.setMatrixAt(deadfallInstanceIndex, dummy.matrix);
    color.setHSL(
      0.075 + (index % 4) * 0.008,
      0.035 + (index % 3) * 0.008,
      0.62 - terrainWetness(dummy.position.x, dummy.position.z) * 0.075
        + ((index * 7) % 5 - 2) * 0.012,
    );
    deadfallMesh.setColorAt(deadfallInstanceIndex, color);
    deadfallIndices[variant] += 1;
  }

  group.add(
    forestFloorDetritus,
    bryophyteGroundLayer,
    ...coverMeshes,
    groundCoverAssetAnchor,
    forestEdgeAssetAnchor,
    distantTrunks,
    ...distantCrownMeshes,
    ...deadfallMeshes,
  );
  group.name = 'world.environment-density';
  group.userData.profile = 'near-mid-far-instanced-habitat-density';
  group.userData.forestEdgeAssetAnchor = forestEdgeAssetAnchor;
  group.userData.forestEdgeTrees = forestEdgeTrees;
  group.userData.instanceCount = SCENE_BUDGET.groundCover
    + SCENE_BUDGET.forestFloorDetritus
    + bryophyteGroundLayer.userData.instanceCount
    + SCENE_BUDGET.distantTrees * 2
    + SCENE_BUDGET.deadfall;
  group.userData.groundCoverMeshes = Object.freeze(coverMeshes);
  group.userData.groundCoverPlacements = Object.freeze(coverPlacements);
  group.userData.groundCoverAssetAnchor = groundCoverAssetAnchor;
  group.userData.collisionRole = 'non-solid-visual-accent';
  scene.add(group);
  return group;
}

export { makeDegradableGroundAccents, makeEnvironmentDensity };
