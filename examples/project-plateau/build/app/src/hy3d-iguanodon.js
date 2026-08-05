import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HY3D_IGUANODON_ASSET = Object.freeze({
  url: '/assets/iguanodon-hy3d-v35-stylized.glb',
  version: 'hy3d-v3.5-stylized-25k-1k',
  bytes: 1_089_008,
  triangles: 24_996,
  textureSize: 1024,
  approximateSharedGpuMiB: 19,
});

const ADULT_MODEL_SCALE = 8.25;
const THUMB_SPIKE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xb2a272,
  roughness: 0.78,
  metalness: 0,
  flatShading: true,
});

const TOE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x343837,
  roughness: 0.86,
  metalness: 0,
  flatShading: true,
});

function createHindToeGeometry(spread = 0) {
  const length = 0.052 - Math.abs(spread) * 0.004;
  const direction = new THREE.Vector3(-0.98, -0.12, spread * 0.18).normalize();
  const geometry = new THREE.ConeGeometry(0.0085, length, 6, 1, false);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  ));
  geometry.translate(
    0.105 + direction.x * length * 0.5,
    0.028 + direction.y * length * 0.5,
    spread * 0.022 + direction.z * length * 0.5,
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'grounded-three-toed-hindfoot-claw';
  return geometry;
}

const HIND_TOE_GEOMETRIES = [-1, 0, 1].map(createHindToeGeometry);

function createSpeciesSilhouetteDetails() {
  const details = new THREE.Group();
  details.name = 'subject.iguanodon_family.species-silhouette-details';
  details.userData.profile = 'three-toed-hindfoot';

  for (const side of [-1, 1]) {
    HIND_TOE_GEOMETRIES.forEach((geometry, index) => {
      const toe = new THREE.Mesh(geometry, TOE_MATERIAL);
      toe.name = `subject.iguanodon_family.${side < 0 ? 'left' : 'right'}-hind-toe-${index + 1}`;
      toe.position.z = side * 0.108;
      toe.userData.anatomicalFeature = 'hind-toe';
      details.add(toe);
    });
  }

  details.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return details;
}

function createThumbSpikeGeometry() {
  const makeSpike = (side) => {
    // The source model is normalised to roughly 1.15 m nose-to-tail before the
    // 8.25x delivery scale. A 0.09 source-unit spike became a 0.74 m lateral
    // blade in the runtime. Keep a strong diagnostic silhouette, but point the
    // first digit upward, forward and slightly outward like an Iguanodon hand.
    const height = 0.07;
    const direction = new THREE.Vector3(-0.42, 0.86, side * 0.28).normalize();
    const geometry = new THREE.ConeGeometry(0.008, height, 7, 1, false);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    ));
    geometry.translate(
      -0.188 + direction.x * height * 0.5,
      0.058 + direction.y * height * 0.5,
      side * 0.132 + direction.z * height * 0.5,
    );
    return geometry;
  };
  const left = makeSpike(1);
  const right = makeSpike(-1);
  const geometry = mergeGeometries([left, right], false);
  left.dispose();
  right.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'paired-iguanodon-thumb-spikes';
  geometry.userData.gameplayReadableLength = 0.07;
  geometry.userData.worldReadableLength = 0.07 * ADULT_MODEL_SCALE;
  geometry.userData.anatomicalDirection = 'upright-forward-outboard';
  return geometry;
}

const THUMB_SPIKE_GEOMETRY = createThumbSpikeGeometry();
export const HY3D_POSE_TARGETS = Object.freeze([
  'graze',
  'reach',
  'play',
  'tailLeft',
  'tailRight',
  'juvenile',
]);

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function refineIguanodonSilhouette(geometry) {
  const position = geometry.getAttribute('position');
  if (!position || geometry.userData.silhouetteRefinement) return;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    if (x >= -0.24 || y <= 0.18) continue;
    const influence = smoothstep(-0.24, -0.42, x);
    position.setX(index, x - influence * 0.024);
    position.setZ(index, position.getZ(index) * (1 - influence * 0.22));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.silhouetteRefinement = 'narrow-integrated-beak';
}

function bendHead(x, y, angle, influence) {
  const pivotX = -0.075;
  const pivotY = 0.285;
  const dx = x - pivotX;
  const dy = y - pivotY;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const bentX = pivotX + dx * cosine - dy * sine;
  const bentY = pivotY + dx * sine + dy * cosine;
  return [
    THREE.MathUtils.lerp(x, bentX, influence),
    THREE.MathUtils.lerp(y, bentY, influence),
  ];
}

function createPoseAttribute(position, poseName) {
  const deltas = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    let nextX = x;
    let nextY = y;
    let nextZ = z;
    const neckInfluence = smoothstep(-0.04, -0.24, x) * smoothstep(0.19, 0.31, y);

    if (poseName === 'graze') {
      [nextX, nextY] = bendHead(x, y, 0.34, neckInfluence);
    } else if (poseName === 'reach') {
      [nextX, nextY] = bendHead(x, y, -0.38, neckInfluence);
      nextX -= neckInfluence * 0.078;
      nextY += neckInfluence * 0.032;
      const shoulderInfluence = smoothstep(0.1, -0.1, x) * smoothstep(0.1, 0.24, y);
      nextY += shoulderInfluence * 0.022;
    } else if (poseName === 'play') {
      // A diagonal play-step: skull/front shoulder bow, hips/tail counter-lift,
      // one fore and opposite hind foot lift while the other diagonal remains
      // planted. This preserves a weight-bearing pair without reducing the
      // behavior to an upper-body morph.
      [nextX, nextY] = bendHead(x, y, 0.72, neckInfluence);
      const upperBody = smoothstep(0.32, -0.08, x) * smoothstep(0.1, 0.24, y);
      const tailCounter = smoothstep(0.16, 0.58, x) * smoothstep(0.1, 0.25, y);
      const lowerLimb = smoothstep(0.14, 0.015, y);
      const swingFore = smoothstep(-0.08, -0.25, x)
        * smoothstep(0.025, 0.085, z)
        * lowerLimb;
      const swingHind = smoothstep(0.08, 0.27, x)
        * smoothstep(-0.025, -0.085, z)
        * lowerLimb;
      nextX -= upperBody * 0.034;
      nextY -= upperBody * 0.11;
      nextY += tailCounter * 0.085;
      nextX -= swingFore * 0.042;
      nextY += swingFore * 0.094;
      nextX += swingHind * 0.038;
      nextY += swingHind * 0.088;
    } else if (poseName === 'tailLeft' || poseName === 'tailRight') {
      const tailInfluence = smoothstep(0.22, 0.69, x);
      const direction = poseName === 'tailLeft' ? 1 : -1;
      nextZ += direction * tailInfluence ** 1.35 * 0.085;
    } else if (poseName === 'juvenile') {
      const headInfluence = smoothstep(-0.04, -0.29, x) * smoothstep(0.16, 0.31, y);
      const largerHeadX = -0.24 + (x + 0.24) * 1.13;
      const largerHeadY = 0.245 + (y - 0.245) * 1.16;
      const largerHeadZ = z * 1.18;
      nextX = THREE.MathUtils.lerp(x, largerHeadX, headInfluence);
      nextY = THREE.MathUtils.lerp(y, largerHeadY, headInfluence);
      nextZ = THREE.MathUtils.lerp(z, largerHeadZ, headInfluence);
      const tailInfluence = smoothstep(0.16, 0.68, x);
      const shorterTailX = 0.16 + Math.max(0, x - 0.16) * 0.82;
      nextX = THREE.MathUtils.lerp(nextX, shorterTailX, tailInfluence);
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
  if (geometry.userData.hy3dPoseTargets) return;
  const position = geometry.getAttribute('position');
  if (!position) return;
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = HY3D_POSE_TARGETS.map((poseName) => (
    createPoseAttribute(position, poseName)
  ));
  geometry.userData.hy3dPoseTargets = [...HY3D_POSE_TARGETS];
}

function prepareTemplate(source) {
  const template = source.clone(true);
  const preparedGeometries = new Map();
  template.name = 'asset.hy3d.iguanodon.template';
  template.traverse((object) => {
    if (!object.isMesh) return;
    const sourceGeometry = object.geometry;
    if (!preparedGeometries.has(sourceGeometry)) {
      const preparedGeometry = sourceGeometry.clone();
      refineIguanodonSilhouette(preparedGeometry);
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
  return template;
}

function prepareMaterial(material) {
  if (!material) return material;
  // HY3D's baked PBR maps are useful for previews but too glossy beside the
  // authored matte world. Keep color/normal detail while removing the
  // metallic-roughness map's photoreal highlights.
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.roughness = 0.92;
  material.metalness = 0;
  material.envMapIntensity = Math.min(material.envMapIntensity ?? 1, 0.34);
  material.color?.offsetHSL(0.008, -0.02, 0.1);
  if (material.emissive) {
    material.emissive.set(0x2a2114);
    material.emissiveIntensity = 0.18;
  }
  if (material.normalScale) material.normalScale.multiplyScalar(0.58);
  material.needsUpdate = true;
  return material;
}

export function createCachedHy3dIguanodonLoader({
  assetUrl = HY3D_IGUANODON_ASSET.url,
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

export const loadHy3dIguanodonTemplate = createCachedHy3dIguanodonLoader();

export function createHy3dIguanodonInstance(template, { scale = ADULT_MODEL_SCALE } = {}) {
  const visual = new THREE.Group();
  const model = template.clone(true);
  visual.name = 'subject.iguanodon_family.hy3d_visual';
  visual.userData.assetVersion = HY3D_IGUANODON_ASSET.version;
  visual.userData.staticSourceMesh = true;
  visual.userData.runtimeMorphPose = true;
  visual.userData.speciesHandSilhouette = 'paired-thumb-spikes';
  model.name = 'subject.iguanodon_family.hy3d_model';
  model.rotation.y = Math.PI;
  model.scale.setScalar(scale);
  const morphMeshes = [];
  model.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary) return;
    morphMeshes.push(object);
  });
  visual.userData.morphMeshes = morphMeshes;
  const thumbSpikes = new THREE.Mesh(THUMB_SPIKE_GEOMETRY, THUMB_SPIKE_MATERIAL);
  thumbSpikes.name = 'subject.iguanodon_family.thumb-spikes';
  thumbSpikes.castShadow = true;
  thumbSpikes.receiveShadow = true;
  thumbSpikes.userData.anatomicalFeature = 'iguanodon-thumb-spike';
  model.add(thumbSpikes, createSpeciesSilhouetteDetails());
  visual.add(model);
  return visual;
}

export function applyHy3dIguanodonPose(animal, pose = {}) {
  const morphMeshes = animal.userData.hy3dVisual?.userData.morphMeshes ?? [];
  for (const mesh of morphMeshes) {
    for (const target of HY3D_POSE_TARGETS) {
      const index = mesh.morphTargetDictionary[target];
      if (index === undefined) continue;
      const requested = target === 'juvenile'
        ? pose[target] ?? (animal.userData.young ? 1 : 0)
        : pose[target] ?? 0;
      mesh.morphTargetInfluences[index] = THREE.MathUtils.clamp(requested, 0, 1);
    }
  }
}

export function attachHy3dIguanodonVisual(animal, template) {
  if (animal.userData.hy3dVisual) return animal.userData.hy3dVisual;

  const fallbackMeshes = [];
  animal.traverse((object) => {
    if (object.isMesh) fallbackMeshes.push(object);
  });

  const visual = createHy3dIguanodonInstance(template);
  animal.add(visual);
  fallbackMeshes.forEach((mesh) => { mesh.visible = false; });
  animal.userData.fallbackMeshes = fallbackMeshes;
  animal.userData.hy3dVisual = visual;
  animal.userData.visualSource = HY3D_IGUANODON_ASSET.version;
  animal.userData.visualStaticPose = false;
  return visual;
}

export async function upgradeIguanodonFamilyWithHy3d(
  family,
  { loadTemplate = loadHy3dIguanodonTemplate, includeYoung = false } = {},
) {
  const candidates = family.filter((animal) => includeYoung || !animal.userData.young);
  if (candidates.every((animal) => animal.userData.hy3dVisual)) {
    return { upgraded: candidates.length, reused: true };
  }

  const template = await loadTemplate();
  candidates.forEach((animal) => attachHy3dIguanodonVisual(animal, template));
  return { upgraded: candidates.length, reused: false };
}
