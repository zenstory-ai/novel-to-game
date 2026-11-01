import * as THREE from 'three';
import { createCachedGltfLoader } from './cached-gltf.js';

export const BASALT_SHELF_ASSET = Object.freeze({
  url: '/assets/basalt-shelf-original-v2.glb',
  bytes: 256_828,
  triangles: 1_860,
  trianglesByVariant: [660, 560, 640],
  variantIds: ['needle-buttress', 'split-saddle', 'terraced-fan'],
  variantCount: 3,
  drawCalls: 2,
  shelfCount: 3,
  fragmentCount: 6,
  supportModel: 'three-distinct-buried-bedrock-to-wall-to-bench-to-spall-load-paths',
  localBounds: {
    min: [-3.9492926597595215, -0.6600000262260437, -2.5858030319213867],
    max: [4.089529514312744, 10.319999694824219, 2.4985127449035645],
  },
});

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.9, 0.9);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.32);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.flatShading = true;
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.basalt-shelf.template';
  template.traverse((object) => {
    if (!object.isMesh) return;
    // glTF import de-duplicates repeated node names with numeric suffixes.
    // Each selected variant lives alone at runtime, so restore the authored
    // semantic name used by support measurement after variant pruning.
    object.name = object.userData.name ?? object.name;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepareMaterial)
      : prepareMaterial(object.material);
  });
  template.updateMatrixWorld(true);
  template.userData.supportModel = BASALT_SHELF_ASSET.supportModel;
  return template;
}

export function createCachedBasaltShelfLoader({ assetUrl = BASALT_SHELF_ASSET.url, loaderFactory } = {}) {
  return createCachedGltfLoader({ assetUrl, prepare: prepareTemplate, loaderFactory });
}

export const loadBasaltShelfTemplate = createCachedBasaltShelfLoader();

function applySurfaceTextures(material, surfaceTextures) {
  const prepared = prepareMaterial(material);
  if (!surfaceTextures) return prepared;
  // Vertex colours already contain the deep-to-oxidized basalt range, while
  // the correlated albedo texture contributes mineral breakup. Keeping the
  // exported red base colour here would multiply the energy twice and turn
  // physically matte rock into an unreadable near-black silhouette.
  prepared.color.set(0xffffff);
  prepared.map = surfaceTextures.albedo ?? null;
  prepared.roughnessMap = surfaceTextures.roughness ?? null;
  prepared.bumpMap = surfaceTextures.height ?? null;
  prepared.bumpScale = 0.042;
  prepared.userData = {
    ...prepared.userData,
    surface: 'oxidized-basalt-fracture-plane-and-horizontal-weathering-shelf',
    mapping: 'authored-face-planar-uv-with-correlated-albedo-roughness-relief',
    energyModel: 'non-emissive-dielectric-rock-albedo',
  };
  prepared.needsUpdate = true;
  return prepared;
}

export function attachBasaltShelfVisual(anchor, template, surfaceTextures) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  const visual = template.clone(true);
  const variants = [];
  visual.traverse((object) => {
    if (object.userData?.variantId) variants.push(object);
  });
  let variantId = BASALT_SHELF_ASSET.variantIds[anchor.userData.formationIndex]
    ?? BASALT_SHELF_ASSET.variantIds[0];
  if (variants.length) {
    const selected = variants.find((variant) => variant.userData.variantId === variantId)
      ?? variants[anchor.userData.formationIndex % variants.length];
    variantId = selected.userData.variantId;
    for (const variant of variants) {
      if (variant !== selected) variant.parent?.remove(variant);
    }
  }
  visual.name = `world.connected_route.red-basalt-shelf.asset-${anchor.userData.formationIndex + 1}`;
  visual.traverse((object) => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => applySurfaceTextures(material, surfaceTextures))
      : applySurfaceTextures(object.material, surfaceTextures);
  });
  visual.userData.variantId = variantId;
  visual.userData.supportModel = BASALT_SHELF_ASSET.supportModel;
  visual.userData.energyModel = 'non-emissive-dielectric-rock-albedo';
  visual.userData.collisionRole = 'non-solid-outside-navigation-boundary';
  anchor.add(visual);
  anchor.userData.assetVisual = visual;
  anchor.userData.variantId = variantId;
  return visual;
}
