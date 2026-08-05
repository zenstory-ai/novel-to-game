import * as THREE from 'three';

export const HY3D_FIELD_CAMERA_ASSET = Object.freeze({
  url: '/assets/field-camera-hands-hy3d-v31-50k-v4-rear-view-1k.glb',
  version: 'hy3d-v3.1-field-camera-hands-v4-rear-view-50k-1k',
  bytes: 1_108_408,
  triangles: 50_000,
  textureSize: 1024,
  approximateGpuMiB: 18,
  sourceCreationId: '165c0431-9378-4ac9-99a6-034c1011583e',
  sourceAssetId: 'd9fa9671-32b3-4599-92b4-7982203ab6e7',
  sourceReferenceSha256: '65fb884ff960f61716b0fb09ab1df5af6be7b216d38a0cd05d2ddc7f23545582',
  integratedHands: 2,
  gripRoles: Object.freeze(['camera-left-grip', 'camera-right-grip']),
});

const MODEL_SCALE = 2.2;

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.roughness = Math.max(prepared.roughness ?? 0.72, 0.74);
  prepared.metalness = Math.min(prepared.metalness ?? 0.68, 0.72);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.62);
  if (prepared.normalScale) prepared.normalScale.multiplyScalar(0.72);
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.hy3d.field-camera-hands.template';
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

export function createCachedHy3dFieldCameraLoader({
  assetUrl = HY3D_FIELD_CAMERA_ASSET.url,
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

export const loadHy3dFieldCameraTemplate = createCachedHy3dFieldCameraLoader();

export function createHy3dFieldCameraInstance(template, { scale = MODEL_SCALE } = {}) {
  const visual = new THREE.Group();
  const model = template.clone(true);
  visual.name = 'tool.field_camera_hands.hy3d_visual';
  visual.userData.assetVersion = HY3D_FIELD_CAMERA_ASSET.version;
  visual.userData.singleAssetPath = true;
  visual.userData.opticalForward = [0, 0, -1];
  visual.userData.playerFacingSide = 'ground-glass-back';
  model.name = 'tool.field_camera_hands.hy3d_model';
  model.scale.setScalar(scale);
  visual.add(model);
  visual.userData.integratedHands = HY3D_FIELD_CAMERA_ASSET.integratedHands;
  visual.userData.gripRoles = [...HY3D_FIELD_CAMERA_ASSET.gripRoles];
  return visual;
}

export function attachHy3dFieldCameraVisual(mount, template) {
  if (mount.userData.hy3dVisual) return mount.userData.hy3dVisual;
  const visual = createHy3dFieldCameraInstance(template);
  mount.add(visual);
  mount.userData.hy3dVisual = visual;
  mount.userData.visualSource = HY3D_FIELD_CAMERA_ASSET.version;
  return visual;
}
