import * as THREE from 'three';
import {
  FERN_LIBRARY_LAYOUT,
  FLUVIAL_ROCK_TRANSPORT_PROFILE,
} from './environment-layout.js';
import { buildBrookObstacleFlowField } from './brook-hydrology.js';
import { makeNonColumnarRockFamilies } from './rock-rendering.js';
import { applyBrookObstacleFlowField } from './brook-material.js';
import { createBrookSceneCapture } from './brook-scene-capture.js';
import { createWorldAnimationController } from './world-animation.js';
import { createWorldAssetVisualLoader } from './world-asset-visuals.js';
import { createWorldAssetSnapshot } from './world-snapshot.js';
import { makeRiverRoomLandforms, makeRouteAndBrook, makeTerrain } from './world-terrain.js';
import {
  makeDegradableGroundAccents,
  makeEnvironmentDensity,
  makeHabitatAccents,
  makeRiparianCover,
  placeVegetation,
} from './world-vegetation.js';
import { makeBasalt, makeBrookBoulder } from './world-geology.js';
import {
  makeBrookResponse,
  makeFieldCameraMount,
  makeFort,
  makeHeroGingko,
  makeRifleMount,
} from './world-landmarks.js';
import {
  PTERODACTYL_ATTACK_CYCLE_SECONDS,
  makeFamily,
  makeFamilyContactShadows,
  makeFeedingBranch,
  makeGladeSunLane,
  makePterodactyl,
  makePterodactylShadow,
  pterodactylAttackFlightState,
  pterodactylAttackPose,
  pterodactylWingBeat,
} from './world-subjects.js';

export { terrainHeight } from './terrain.js';
export { CANOPY_WIND_PROFILE } from './vegetation-leaf-materials.js';
export {
  PTERODACTYL_ATTACK_CYCLE_SECONDS,
  pterodactylAttackFlightState,
  pterodactylAttackPose,
  pterodactylWingBeat,
};

export { loadOptionalAssetVisual } from './world-asset-visuals.js';

export function createWorld(scene) {
  const terrain = makeTerrain(scene);
  const routeAndBrook = makeRouteAndBrook(scene);
  const riverRoom = makeRiverRoomLandforms(scene);
  const brookBoulder = makeBrookBoulder(scene);
  const riparianCover = makeRiparianCover(scene);
  const coverArches = riparianCover.group;
  const vegetation = placeVegetation(scene);
  const nonColumnarRockFamilies = makeNonColumnarRockFamilies(scene);
  const brookObstacleFlowField = buildBrookObstacleFlowField(
    routeAndBrook.brookPoints,
    routeAndBrook.brookHydrology,
    [
      ...routeAndBrook.brookObstacleCandidates,
      ...nonColumnarRockFamilies.userData.brookObstacleCandidates,
    ],
    { width: FLUVIAL_ROCK_TRANSPORT_PROFILE.brookWidthMeters },
  );
  applyBrookObstacleFlowField(routeAndBrook.brook.material, brookObstacleFlowField);
  const habitatAccents = makeHabitatAccents(scene);
  vegetation.fernAssetAnchor.userData.fallbackMeshes = Object.freeze([
    ...vegetation.fernMeshes,
    habitatAccents.foregroundFronds,
  ]);
  const degradableGroundAccents = makeDegradableGroundAccents(scene);
  const accentFernAssetAnchor = new THREE.Group();
  accentFernAssetAnchor.name = 'world.connected_route.ferns.accent-asset-anchor';
  accentFernAssetAnchor.userData.fallbackMeshes = Object.freeze([
    habitatAccents.skirts,
    ...degradableGroundAccents.userData.proceduralFallbackMeshes,
    ...riverRoom.userData.proceduralFallbackMeshes,
  ]);
  accentFernAssetAnchor.userData.placements = Object.freeze([
    ...habitatAccents.fernLibraryPlacements,
    ...degradableGroundAccents.userData.fernLibraryPlacements,
    ...riverRoom.userData.fernLibraryPlacements,
  ].map((placement, index) => Object.freeze({
    ...placement,
    index: FERN_LIBRARY_LAYOUT.length + index,
  })));
  degradableGroundAccents.add(accentFernAssetAnchor);
  const environmentDensity = makeEnvironmentDensity(scene);
  const basalt = makeBasalt(scene);
  const family = makeFamily(scene);
  const familyContactShadows = makeFamilyContactShadows(scene, family);
  const feedingBranch = makeFeedingBranch(scene);
  const gladeSunLane = makeGladeSunLane(scene);
  const pterodactyls = [
    makePterodactyl(scene, 29, 23, 0.0, 0.88),
    makePterodactyl(scene, 31, 18.5, 2.2, 0.46),
    makePterodactyl(scene, 35, 20.5, 4.1, 0.32),
  ];
  const pterodactylShadow = makePterodactylShadow(scene);
  const smoke = makeFort(scene);
  const heroGingko = makeHeroGingko(scene);
  const brookResponse = makeBrookResponse(scene);
  const fieldCamera = makeFieldCameraMount(scene);
  const rifle = makeRifleMount(scene);
  const brookSceneCapture = createBrookSceneCapture(
    scene,
    routeAndBrook.brook,
    routeAndBrook.brookHydrology,
    [
      routeAndBrook.brookRipples,
      fieldCamera,
      rifle,
    ],
  );
  const enableHy3dVisuals = createWorldAssetVisualLoader({
    accentFernAssetAnchor,
    basalt,
    brookBoulder,
    brookResponse,
    environmentDensity,
    family,
    fieldCamera,
    habitatAccents,
    heroGingko,
    pterodactyls,
    rifle,
    riparianCover,
    riverRoom,
    vegetation,
  });
  const animationController = createWorldAnimationController({
    accentFernAssetAnchor,
    brookObstacleFlowField,
    brookResponse,
    brookSceneCapture,
    coverArches,
    degradableGroundAccents,
    environmentDensity,
    family,
    familyContactShadows,
    feedingBranch,
    gladeSunLane,
    habitatAccents,
    heroGingko,
    nonColumnarRockFamilies,
    pterodactyls,
    pterodactylShadow,
    rifle,
    riparianCover,
    routeAndBrook,
    smoke,
    vegetation,
  });

  return {
    family,
    vegetation,
    coverArches,
    habitatAccents,
    degradableGroundAccents,
    environmentDensity,
    pterodactyls,
    pterodactylShadow,
    smoke,
    heroGingko,
    basalt,
    brookResponse,
    brookBoulder,
    nonColumnarRockFamilies,
    fieldCamera,
    rifle,
    enableHy3dVisuals,
    prepareBrookRender(renderer, camera, quality = 'balanced', frameIndex = 0) {
      brookSceneCapture.prepare(renderer, camera, quality, frameIndex);
    },
    requestBrookReflectionRefresh() {
      brookSceneCapture.requestReflectionRefresh();
    },
    update: animationController.update,
    threatSnapshot: animationController.threatSnapshot,
    brookResponseSnapshot: animationController.brookResponseSnapshot,
    familySnapshot: animationController.familySnapshot,
    assetSnapshot() {
      return createWorldAssetSnapshot({
        basalt,
        brookBoulder,
        brookSceneCapture,
        coverArches,
        degradableGroundAccents,
        environmentDensity,
        family,
        fieldCamera,
        habitatAccents,
        heroGingko,
        nonColumnarRockFamilies,
        pterodactyls,
        rifle,
        riparianCover,
        routeAndBrook,
        terrain,
        vegetation,
      });
    },
  };
}
