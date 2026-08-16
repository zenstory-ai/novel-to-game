import * as THREE from 'three';

export const HY3D_PTERODACTYL_ASSET = Object.freeze({
  url: '/assets/pterodactyl-hy3d-v35-stylized.glb',
  version: 'hy3d-v3.5-stylized-30k-1k',
  bytes: 1_327_456,
  triangles: 30_496,
  textureSize: 1024,
  approximateSharedGpuMiB: 19,
});

export const HY3D_PTERODACTYL_POSE_TARGETS = Object.freeze([
  'wingUp',
  'wingDown',
  'diveFold',
]);

const MODEL_SCALE = 9.2;

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function refinePterodactylSilhouette(geometry) {
  const position = geometry.getAttribute('position');
  if (!position || geometry.userData.silhouetteRefinement) return;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const influence = 1 - smoothstep(0.07, 0.23, Math.abs(x));
    if (influence <= 0) continue;
    const y = position.getY(index);
    const z = position.getZ(index);
    position.setY(index, 0.19 + (y - 0.19) * (1 + influence * 0.18));
    position.setZ(index, 0.025 + (z - 0.025) * (1 + influence * 0.14));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.silhouetteRefinement = 'integrated-torso-wing-root-volume';
}

function rotateWingPoint(x, y, angle, side) {
  const pivotX = side * 0.09;
  const pivotY = 0.235;
  const dx = x - pivotX;
  const dy = y - pivotY;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    pivotX + dx * cosine - dy * sine,
    pivotY + dx * sine + dy * cosine,
  ];
}

function createPoseAttribute(position, poseName) {
  const deltas = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const side = Math.sign(x) || 1;
    const span = Math.abs(x);
    const wingInfluence = smoothstep(0.1, 0.31, span);
    let nextX = x;
    let nextY = y;
    let nextZ = z;

    if (poseName === 'wingUp' || poseName === 'wingDown') {
      const direction = poseName === 'wingUp' ? 1 : -1;
      const [bentX, bentY] = rotateWingPoint(x, y, side * direction * 0.36, side);
      nextX = THREE.MathUtils.lerp(x, bentX, wingInfluence);
      nextY = THREE.MathUtils.lerp(y, bentY, wingInfluence);
    } else if (poseName === 'diveFold') {
      const normalizedSpan = smoothstep(0.09, 0.56, span);
      const foldedX = side * (0.09 + Math.max(0, span - 0.09) * 0.14);
      const centralInfluence = 1 - smoothstep(0.055, 0.17, span);
      const lowerInfluence = 1 - smoothstep(0.07, 0.18, y);
      const appendageTuck = centralInfluence * lowerInfluence;
      nextX = THREE.MathUtils.lerp(x, foldedX, wingInfluence);
      nextY -= normalizedSpan * 0.028;
      nextZ -= normalizedSpan ** 1.25 * 0.49;
      // HY3D's static stance leaves both feet hanging below a head-on dive.
      // Pull the lower central silhouette into the torso only during the fold;
      // the authored standing/orbit mesh remains untouched.
      nextY += appendageTuck * 0.22;
      nextZ = THREE.MathUtils.lerp(nextZ, 0.02, appendageTuck * 0.68);
    }

    const offset = index * 3;
    deltas[offset] = nextX - x;
    deltas[offset + 1] = nextY - y;
    deltas[offset + 2] = nextZ - z;
  }
  const attribute = new THREE.BufferAttribute(deltas, 3);
  attribute.name = poseName;
  return attribute;
}

function addSharedPoseTargets(geometry) {
  if (geometry.userData.hy3dPterodactylPoseTargets) return;
  const position = geometry.getAttribute('position');
  if (!position) return;
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = HY3D_PTERODACTYL_POSE_TARGETS.map((poseName) => (
    createPoseAttribute(position, poseName)
  ));
  geometry.userData.hy3dPterodactylPoseTargets = [...HY3D_PTERODACTYL_POSE_TARGETS];
}

function prepareMaterial(material) {
  if (!material) return material;
  material.metalnessMap = null;
  material.roughness = 0.98;
  material.metalness = 0;
  material.envMapIntensity = 0.42;
  material.color?.offsetHSL(0.006, 0.02, -0.04);
  if (material.emissive) {
    material.emissive.set(0x161d1c);
    material.emissiveIntensity = 0.028;
  }
  if (material.normalScale) material.normalScale.multiplyScalar(0.76);
  material.needsUpdate = true;
  return material;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  const preparedGeometries = new Map();
  template.name = 'asset.hy3d.pterodactyl.template';
  template.traverse((object) => {
    if (!object.isMesh) return;
    const sourceGeometry = object.geometry;
    if (!preparedGeometries.has(sourceGeometry)) {
      const preparedGeometry = sourceGeometry.clone();
      refinePterodactylSilhouette(preparedGeometry);
      addSharedPoseTargets(preparedGeometry);
      preparedGeometries.set(sourceGeometry, preparedGeometry);
    }
    object.geometry = preparedGeometries.get(sourceGeometry);
    object.updateMorphTargets();
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepareMaterial)
      : prepareMaterial(object.material);
  });
  template.updateMatrixWorld(true);
  template.userData.sourceCenter = new THREE.Box3()
    .setFromObject(template)
    .getCenter(new THREE.Vector3())
    .toArray();
  return template;
}

export function createCachedHy3dPterodactylLoader({
  assetUrl = HY3D_PTERODACTYL_ASSET.url,
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

export const loadHy3dPterodactylTemplate = createCachedHy3dPterodactylLoader();

export function createHy3dPterodactylInstance(template, { scale = MODEL_SCALE } = {}) {
  const visual = new THREE.Group();
  const orientation = new THREE.Group();
  const model = template.clone(true);
  const sourceCenter = new THREE.Vector3().fromArray(template.userData.sourceCenter ?? [0, 0, 0]);
  visual.name = 'threat.pterodactyl.hy3d_visual';
  orientation.name = 'threat.pterodactyl.hy3d_orientation';
  orientation.rotation.y = Math.PI;
  orientation.scale.setScalar(scale);
  model.name = 'threat.pterodactyl.hy3d_model';
  model.position.copy(sourceCenter).multiplyScalar(-1);
  orientation.add(model);
  visual.add(orientation);

  const morphMeshes = [];
  model.traverse((object) => {
    if (object.isMesh && object.morphTargetDictionary) morphMeshes.push(object);
  });
  visual.userData.morphMeshes = morphMeshes;
  return visual;
}

export function applyHy3dPterodactylPose(pterodactyl, pose = {}) {
  const morphMeshes = pterodactyl.userData.hy3dVisual?.userData.morphMeshes ?? [];
  for (const mesh of morphMeshes) {
    for (const target of HY3D_PTERODACTYL_POSE_TARGETS) {
      const index = mesh.morphTargetDictionary[target];
      if (index === undefined) continue;
      mesh.morphTargetInfluences[index] = THREE.MathUtils.clamp(pose[target] ?? 0, 0, 1);
    }
  }
}

export function attachHy3dPterodactylVisual(pterodactyl, template) {
  if (pterodactyl.userData.hy3dVisual) return pterodactyl.userData.hy3dVisual;
  const fallbackMeshes = [];
  pterodactyl.traverse((object) => {
    if (object.isMesh) fallbackMeshes.push(object);
  });
  const visual = createHy3dPterodactylInstance(template);
  pterodactyl.add(visual);
  fallbackMeshes.forEach((mesh) => { mesh.visible = false; });
  pterodactyl.userData.hy3dVisual = visual;
  return visual;
}

export async function upgradePterodactylFlockWithHy3d(
  flock,
  { loadTemplate = loadHy3dPterodactylTemplate } = {},
) {
  if (flock.every((pterodactyl) => pterodactyl.userData.hy3dVisual)) {
    return { upgraded: flock.length, reused: true };
  }
  const template = await loadTemplate();
  flock.forEach((pterodactyl) => attachHy3dPterodactylVisual(pterodactyl, template));
  return { upgraded: flock.length, reused: false };
}
