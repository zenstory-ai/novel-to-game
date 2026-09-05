import {
  attachBasaltShelfVisual,
  loadBasaltShelfTemplate,
} from './basalt-shelf.js';
import {
  attachBrookBoulderVisual,
  loadBrookBoulderTemplate,
} from './brook-boulder.js';
import {
  attachCanopyTreeLibraryVisual,
  loadCanopyTreeLibraryTemplate,
} from './canopy-tree-library.js';
import {
  COVER_RIPARIAN_TREE_LAYOUT,
  FERN_LIBRARY_LAYOUT,
  HABITAT_TREE_LAYOUT,
  VEGETATION_LAYOUT,
} from './environment-layout.js';
import {
  attachFernLibraryVisual,
  loadFernLibraryTemplate,
} from './fern-library.js';
import {
  attachGroundCoverLibraryVisual,
  loadGroundCoverLibraryTemplate,
} from './ground-cover-library.js';
import {
  attachHeroGingkoVisual,
  loadHeroGingkoTemplate,
} from './hero-gingko.js';
import {
  attachHy3dFieldCameraVisual,
  loadHy3dFieldCameraTemplate,
} from './hy3d-field-camera.js';
import {
  upgradeIguanodonFamilyWithHy3d,
} from './hy3d-iguanodon.js';
import {
  upgradePterodactylFlockWithHy3d,
} from './hy3d-pterodactyl.js';
import {
  attachHy3dRifleVisual,
  loadHy3dRifleTemplate,
} from './hy3d-rifle.js';
import {
  basaltDetailTextures,
  rockTextures,
} from './rock-rendering.js';
import {
  terrainGradient,
  terrainHeight,
  terrainWetness,
} from './terrain.js';
import {
  attachTreeFernLibraryVisual,
  loadTreeFernLibraryTemplate,
} from './tree-fern-library.js';
import { settleBrookBoulderAsset } from './world-geology.js';

export async function loadOptionalAssetVisual({ load, attach, onLoadFailure }) {
  let template;
  try {
    template = await load();
  } catch (error) {
    return onLoadFailure(error);
  }
  return attach(template);
}

export function createWorldAssetVisualLoader({
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
}) {
  let assetVisualPromise = null;
  function enableHy3dVisuals() {
    if (assetVisualPromise) return assetVisualPromise;

    const requiredTasks = [
      upgradeIguanodonFamilyWithHy3d(family, { includeYoung: true }),
      upgradePterodactylFlockWithHy3d(pterodactyls),
      loadHy3dFieldCameraTemplate().then((template) => {
        attachHy3dFieldCameraVisual(fieldCamera, template);
      }),
      loadHy3dRifleTemplate().then((template) => {
        attachHy3dRifleVisual(rifle, template);
      }),
    ];

    const optionalTasks = [
      loadOptionalAssetVisual({
        load: loadHeroGingkoTemplate,
        attach: (template) => {
          attachHeroGingkoVisual(heroGingko, template);
        },
        onLoadFailure: () => {
          heroGingko.userData.fallback.visible = true;
        },
      }),
      loadOptionalAssetVisual({
        load: loadBasaltShelfTemplate,
        attach: (template) => {
          basalt.assetAnchors.forEach((anchor) => {
            attachBasaltShelfVisual(anchor, template, basaltDetailTextures);
          });
          basalt.proceduralFallback.visible = false;
        },
        onLoadFailure: () => {
          basalt.proceduralFallback.visible = true;
        },
      }),
      loadOptionalAssetVisual({
        load: loadBrookBoulderTemplate,
        attach: (template) => {
          attachBrookBoulderVisual(brookBoulder, template, rockTextures);
          settleBrookBoulderAsset(brookBoulder);
        },
        onLoadFailure: () => {
          brookBoulder.userData.fallback.visible = true;
        },
      }),
      loadOptionalAssetVisual({
        load: loadFernLibraryTemplate,
        attach: (template) => {
          attachFernLibraryVisual(
            vegetation.fernAssetAnchor,
            template,
            FERN_LIBRARY_LAYOUT,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          attachFernLibraryVisual(
            accentFernAssetAnchor,
            template,
            accentFernAssetAnchor.userData.placements,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          attachFernLibraryVisual(
            brookResponse.userData.assetAnchor,
            template,
            brookResponse.userData.assetAnchor.userData.placements,
            { terrainHeight, terrainGradient, terrainWetness },
          );
        },
        onLoadFailure: () => {
          for (const anchor of [
            vegetation.fernAssetAnchor,
            accentFernAssetAnchor,
            brookResponse.userData.assetAnchor,
          ]) {
            anchor.userData.fallbackMeshes.forEach((mesh) => { mesh.visible = true; });
            if (anchor.userData.assetVisual) anchor.userData.assetVisual.visible = false;
          }
        },
      }),
      loadOptionalAssetVisual({
        load: loadGroundCoverLibraryTemplate,
        attach: (template) => {
          attachGroundCoverLibraryVisual(
            environmentDensity.userData.groundCoverAssetAnchor,
            template,
            environmentDensity.userData.groundCoverPlacements,
            { terrainHeight, terrainGradient },
          );
        },
        onLoadFailure: () => {
          environmentDensity.userData.groundCoverMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
        },
      }),
      loadOptionalAssetVisual({
        load: loadTreeFernLibraryTemplate,
        attach: (template) => {
          attachTreeFernLibraryVisual(
            habitatAccents.treeFernAssetAnchor,
            template,
            HABITAT_TREE_LAYOUT,
            { terrainHeight, terrainGradient, terrainWetness },
          );
        },
        onLoadFailure: () => {
          habitatAccents.treeFernAssetAnchor.userData.fallbackMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
          if (habitatAccents.treeFernAssetAnchor.userData.assetVisual) {
            habitatAccents.treeFernAssetAnchor.userData.assetVisual.visible = false;
          }
        },
      }),
      loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          attachCanopyTreeLibraryVisual(
            vegetation.canopyTreeAssetAnchor,
            template,
            VEGETATION_LAYOUT.trees,
            { terrainHeight, terrainGradient, terrainWetness },
          );
        },
        onLoadFailure: () => {
          vegetation.canopyTreeAssetAnchor.userData.fallbackMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
          if (vegetation.canopyTreeAssetAnchor.userData.assetVisual) {
            vegetation.canopyTreeAssetAnchor.userData.assetVisual.visible = false;
          }
        },
      }),
      loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          const visual = attachCanopyTreeLibraryVisual(
            riparianCover.assetAnchor,
            template,
            COVER_RIPARIAN_TREE_LAYOUT,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          visual.name = 'world.connected_route.cover-riparian-trees.original-canopy-library';
        },
        onLoadFailure: () => {
          riparianCover.assetAnchor.userData.fallbackMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
          if (riparianCover.assetAnchor.userData.assetVisual) {
            riparianCover.assetAnchor.userData.assetVisual.visible = false;
          }
        },
      }),
      loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          const visual = attachCanopyTreeLibraryVisual(
            environmentDensity.userData.forestEdgeAssetAnchor,
            template,
            environmentDensity.userData.forestEdgeTrees,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          visual.name = 'world.environment-density.forest-edge.original-canopy-library';
        },
        onLoadFailure: () => {
          if (environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual) {
            environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual.visible = false;
          }
        },
      }),
      loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          const visual = attachCanopyTreeLibraryVisual(
            riverRoom.userData.canopyAssetAnchor,
            template,
            riverRoom.userData.canopyTreePlacements,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          visual.name = 'world.river-room.terrace-canopy.original-library';
        },
        onLoadFailure: () => {
          if (riverRoom.userData.canopyAssetAnchor.userData.assetVisual) {
            riverRoom.userData.canopyAssetAnchor.userData.assetVisual.visible = false;
          }
        },
      }),
    ];

    assetVisualPromise = Promise.all([...requiredTasks, ...optionalTasks])
      .then(() => undefined)
      .catch((error) => {
        assetVisualPromise = null;
        throw error;
      });
    return assetVisualPromise;
  }
  return enableHy3dVisuals;
}
