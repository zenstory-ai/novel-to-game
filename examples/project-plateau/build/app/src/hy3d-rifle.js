import * as THREE from 'three';

export const HY3D_RIFLE_ASSET = Object.freeze({
  url: '/assets/expedition-rifle-hands-hy3d-v31-50k-1k.glb',
  version: 'hy3d-v3.1-expedition-rifle-hands-v1-50k-1k',
  bytes: 1_000_112,
  triangles: 50_000,
  textureSize: 1024,
  approximateGpuMiB: 18,
  sourceCreationId: 'd8456aef-2144-4d3f-a860-21adf21250b8',
  sourceAssetId: '93f11215-ec3c-4c65-aff9-832045ac73ef',
  sourceReferenceSha256: 'cb0da7f456853c68960623e4d1b5d9160a89dd0d11d4d1d3ba5d4b0dda829c89',
  integratedHands: 2,
  gripRoles: Object.freeze(['fore-end-support', 'trigger-grip']),
});

const MODEL_SCALE = 4.3;

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.roughness = Math.max(prepared.roughness ?? 0.7, 0.82);
  prepared.metalness = Math.min(prepared.metalness ?? 0.72, 0.5);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.38);
  if (prepared.normalScale) prepared.normalScale.multiplyScalar(0.62);
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.hy3d.expedition-rifle-hands.template';
  template.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    object.frustumCulled = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepareMaterial)
      : prepareMaterial(object.material);
  });
  template.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(template);
  template.userData.sourceBounds = {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
  };
  return template;
}

export function createCachedHy3dRifleLoader({
  assetUrl = HY3D_RIFLE_ASSET.url,
  loaderFactory,
} = {}) {
  let templatePromise;
  return function loadTemplate() {
    if (!templatePromise) {
      templatePromise = Promise.resolve()
        .then(async () => {
          if (loaderFactory) return loaderFactory();
          const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
          return new GLTFLoader();
        })
        .then((loader) => loader.loadAsync(assetUrl))
        .then((gltf) => prepareTemplate(gltf.scene))
        .catch((error) => {
          templatePromise = undefined;
          throw error;
        });
    }
    return templatePromise;
  };
}

export const loadHy3dRifleTemplate = createCachedHy3dRifleLoader();

export function createHy3dRifleInstance(template, { scale = MODEL_SCALE } = {}) {
  const visual = new THREE.Group();
  const model = template.clone(true);
  visual.name = 'tool.period_rifle_hands.hy3d_visual';
  visual.userData.assetVersion = HY3D_RIFLE_ASSET.version;
  visual.userData.singleAssetPath = true;
  model.name = 'tool.period_rifle_hands.hy3d_model';
  model.scale.setScalar(scale);
  visual.add(model);
  visual.userData.integratedHands = HY3D_RIFLE_ASSET.integratedHands;
  visual.userData.gripRoles = [...HY3D_RIFLE_ASSET.gripRoles];
  return visual;
}

export function attachHy3dRifleVisual(mount, template) {
  if (mount.userData.hy3dVisual) return mount.userData.hy3dVisual;
  const visual = createHy3dRifleInstance(template);
  mount.add(visual);
  mount.userData.hy3dVisual = visual;
  mount.userData.visualSource = HY3D_RIFLE_ASSET.version;
  return visual;
}
