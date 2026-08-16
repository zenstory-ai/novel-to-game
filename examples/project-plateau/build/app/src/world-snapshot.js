function assetState(anchor) {
  return {
    loaded: Boolean(anchor?.userData?.assetVisual),
    fallbackVisible: anchor?.userData?.fallbackMeshes?.some((mesh) => mesh.visible) ?? false,
  };
}

export function createWorldAssetSnapshot({
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
}) {
  return {
    terrain: {
      profile: terrain.geometry.userData.profile,
      vertices: terrain.geometry.attributes.position.count,
      surface: terrain.material.userData.surface,
    },
    brook: {
      pointCount: routeAndBrook.brookPoints.length,
      stoneInstances: routeAndBrook.brookStones.count,
      sceneCapture: brookSceneCapture.snapshot(),
    },
    brookBoulder: {
      name: brookBoulder.name,
      loaded: Boolean(brookBoulder.userData.assetVisual),
    },
    canopyTreeLibrary: assetState(vegetation.canopyTreeAssetAnchor),
    vegetation: {
      treeCount: vegetation.canopyTreeAssetAnchor.children.length,
      fernCount: vegetation.fernMeshes.length,
    },
    treeFernLibrary: assetState(habitatAccents.treeFernAssetAnchor),
    fernLibrary: assetState(vegetation.fernAssetAnchor),
    nonColumnarRocks: {
      familyCount: nonColumnarRockFamilies.children.length,
      brookObstacleCount: nonColumnarRockFamilies.userData.brookObstacleCandidates.length,
    },
    basaltShelf: {
      name: 'world.connected_route.red-basalt-shelf',
      loaded: basalt.assetAnchors.some((anchor) => Boolean(anchor.userData.assetVisual)),
    },
    basaltRubble: {
      instanceCount: basalt.rubble.count,
    },
    fieldCamera: assetState(fieldCamera),
    rifle: assetState(rifle),
    pterodactyl: {
      count: pterodactyls.length,
      upgradedCount: pterodactyls.filter((animal) => animal.userData.hy3dVisual).length,
    },
    cover: {
      archCount: coverArches.children.length,
      ...assetState(riparianCover.assetAnchor),
    },
    heroGingko: {
      name: heroGingko.name,
      loaded: Boolean(heroGingko.userData.assetVisual),
    },
    family: {
      adults: family.filter((animal) => !animal.userData.young).length,
      young: family.filter((animal) => animal.userData.young).length,
    },
    gladeComposition: {
      familyWidth: Math.max(...family.map((animal) => animal.userData.baseX))
        - Math.min(...family.map((animal) => animal.userData.baseX)),
    },
    degradableGroundAccents: {
      profile: degradableGroundAccents.userData.profile,
      instanceCount: degradableGroundAccents.userData.instanceCount,
      visible: degradableGroundAccents.visible,
    },
    groundCoverLibrary: assetState(environmentDensity.userData.groundCoverAssetAnchor),
    environmentDensity: {
      profile: environmentDensity.userData.profile,
      instanceCount: environmentDensity.userData.instanceCount,
      visible: environmentDensity.visible,
    },
  };
}
