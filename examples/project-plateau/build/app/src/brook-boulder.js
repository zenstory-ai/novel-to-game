import * as THREE from 'three';

export const BROOK_BOULDER_ASSET = Object.freeze({
  url: '/assets/brook-boulder-original-v6.glb',
  version: 'original-brook-boulder-v6',
  bytes: 225_260,
  triangles: 1_626,
  massTriangles: 1_344,
  apronTriangles: 282,
  drawCalls: 6,
  fragmentCount: 5,
  supportPlaneY: -0.56,
  sha256: '888e28b4aca0bfc964e78d89ea8d27a0af19ea45293fbb64d8a694a8ce5a9f09',
  provenance: 'project-original-deterministic-offline-authored-geometry',
  generator: 'app/scripts/generate-brook-boulder.mjs',
  rights: 'project-original-code-authored-output',
  supportModel: 'broad-buried-mass-base-with-independent-sediment-supported-spall',
  collisionRole: 'solid-main-mass-with-non-solid-sub-step-spall-apron',
  transportClass: 'immobile-residual-bank-erratic-reexposed-on-inner-bend',
  normalModel: 'forty-two-degree-selective-fracture-crease-with-continuous-weathered-normals',
  localBounds: Object.freeze({
    min: Object.freeze([-1.282905101776123, -0.5600000023841858, -1.121328592300415]),
    max: Object.freeze([1.2698676586151123, 0.5580000281333923, 1.0035854578018188]),
  }),
});

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.9, 0.9);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.22);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.flatShading = false;
  prepared.dithering = true;
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.brook-boulder.template';
  let meshes = 0;
  let triangles = 0;
  template.traverse((object) => {
    if (!object.isMesh) return;
    object.name = object.userData.name ?? object.name;
    meshes += 1;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    object.castShadow = true;
    object.receiveShadow = true;
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
  template.userData.meshes = meshes;
  template.userData.triangles = triangles;
  template.userData.provenance = BROOK_BOULDER_ASSET.provenance;
  template.userData.supportModel = BROOK_BOULDER_ASSET.supportModel;
  template.userData.normalModel = BROOK_BOULDER_ASSET.normalModel;
  return template;
}

export function createCachedBrookBoulderLoader({
  assetUrl = BROOK_BOULDER_ASSET.url,
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

export const loadBrookBoulderTemplate = createCachedBrookBoulderLoader();

function applySurfaceTextures(material, surfaceTextures, objectName) {
  const prepared = prepareMaterial(material);
  const spall = objectName.startsWith('brook-boulder-spall-');
  // Real weathered stone sits well below white diffuse albedo. The former
  // white multiplier clipped the sunward crown into a chalk/plastic read.
  // The GLB already carries the physical stone albedo. This is a restrained
  // neutral multiplier, not a second full-strength tint; multiplying the same
  // dark value twice pushed the rejected earlier review render almost to black.
  prepared.color.set(spall ? 0x6b746e : 0x747c76);
  prepared.map = null;
  prepared.roughnessMap = null;
  prepared.bumpMap = null;
  prepared.onBeforeCompile = (shader) => {
    shader.uniforms.brookRockAlbedo = { value: surfaceTextures?.albedo ?? null };
    shader.uniforms.brookRockRoughness = { value: surfaceTextures?.roughness ?? null };
    shader.uniforms.brookRockHeight = { value: surfaceTextures?.height ?? null };
    shader.uniforms.brookRockReliefScale = { value: spall ? 0.16 : 0.24 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vBrookRockObjectPosition;
        varying vec3 vBrookRockObjectNormal;
      `)
      .replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        vBrookRockObjectNormal = objectNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vBrookRockObjectPosition = transformed;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D brookRockAlbedo;
        uniform sampler2D brookRockRoughness;
        uniform sampler2D brookRockHeight;
        uniform float brookRockReliefScale;
        varying vec3 vBrookRockObjectPosition;
        varying vec3 vBrookRockObjectNormal;

        vec3 brookRockBlendWeights() {
          vec3 weights = pow(abs(normalize(vBrookRockObjectNormal)), vec3(3.2));
          return weights / max(dot(weights, vec3(1.0)), 0.0001);
        }

        vec3 sampleBrookRockAlbedo() {
          vec3 weights = brookRockBlendWeights();
          vec3 point = vBrookRockObjectPosition * 2.15;
          vec3 xSample = texture2D(brookRockAlbedo, point.zy + vec2(0.17, 0.29)).rgb;
          vec3 ySample = texture2D(brookRockAlbedo, point.xz + vec2(0.41, 0.13)).rgb;
          vec3 zSample = texture2D(brookRockAlbedo, point.xy + vec2(0.07, 0.47)).rgb;
          return xSample * weights.x + ySample * weights.y + zSample * weights.z;
        }

        float sampleBrookRockRoughness() {
          vec3 weights = brookRockBlendWeights();
          vec3 point = vBrookRockObjectPosition * 2.15;
          return texture2D(brookRockRoughness, point.zy + vec2(0.17, 0.29)).g * weights.x
            + texture2D(brookRockRoughness, point.xz + vec2(0.41, 0.13)).g * weights.y
            + texture2D(brookRockRoughness, point.xy + vec2(0.07, 0.47)).g * weights.z;
        }

        float sampleBrookRockHeight() {
          vec3 weights = brookRockBlendWeights();
          vec3 point = vBrookRockObjectPosition * 2.15;
          return texture2D(brookRockHeight, point.zy + vec2(0.17, 0.29)).r * weights.x
            + texture2D(brookRockHeight, point.xz + vec2(0.41, 0.13)).r * weights.y
            + texture2D(brookRockHeight, point.xy + vec2(0.07, 0.47)).r * weights.z;
        }

        vec3 perturbBrookRockNormal(
          vec3 surfacePosition,
          vec3 surfaceNormal,
          vec2 heightDerivatives,
          float direction
        ) {
          vec3 sigmaX = normalize(dFdx(surfacePosition));
          vec3 sigmaY = normalize(dFdy(surfacePosition));
          vec3 responseX = cross(sigmaY, surfaceNormal);
          vec3 responseY = cross(surfaceNormal, sigmaX);
          float determinant = dot(sigmaX, responseX) * direction;
          vec3 gradient = sign(determinant)
            * (heightDerivatives.x * responseX + heightDerivatives.y * responseY);
          return normalize(abs(determinant) * surfaceNormal - gradient);
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 brookRockSample = sampleBrookRockAlbedo();
        float brookRockLuma = dot(brookRockSample, vec3(0.2126, 0.7152, 0.0722));
        float brookRockMineral = smoothstep(0.1, 0.46, brookRockLuma);
        vec3 brookRockTint = brookRockSample / max(brookRockLuma, 0.08);
        float brookRockPorosity = sampleBrookRockHeight();
        diffuseColor.rgb *= mix(0.88, 1.08, brookRockMineral)
          * mix(vec3(1.0), brookRockTint, 0.16);
        float brookRockWetFront = -0.455
          + (brookRockPorosity - 0.5) * 0.09;
        float brookRockCapillaryBand = 1.0 - smoothstep(
          brookRockWetFront - 0.08,
          brookRockWetFront + 0.07,
          vBrookRockObjectPosition.y
        );
        diffuseColor.rgb *= mix(
          vec3(1.0),
          vec3(0.52, 0.64, 0.58),
          brookRockCapillaryBand * 0.28
        );
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float brookRockRelief = brookRockPorosity;
        vec2 brookRockReliefGradient = vec2(
          dFdx(brookRockRelief),
          dFdy(brookRockRelief)
        ) * brookRockReliefScale;
        normal = perturbBrookRockNormal(
          -vViewPosition,
          normal,
          brookRockReliefGradient,
          faceDirection
        );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(
          mix(roughnessFactor, sampleBrookRockRoughness(), 0.74),
          0.88,
          1.0
        );
        float brookRockRoughnessFront = -0.455
          + (brookRockPorosity - 0.5) * 0.09;
        float brookRockWetRoughness = 1.0 - smoothstep(
          brookRockRoughnessFront - 0.08,
          brookRockRoughnessFront + 0.07,
          vBrookRockObjectPosition.y
        );
        roughnessFactor = mix(roughnessFactor, 0.74, brookRockWetRoughness * 0.48);
      `);
  };
  prepared.customProgramCacheKey = () => `brook-boulder-triplanar-v5-${spall ? 'spall' : 'mass'}`;
  prepared.userData = {
    ...prepared.userData,
    surface: objectName.startsWith('brook-boulder-spall-')
      ? 'settled-spall-with-correlated-bank-weathering'
      : 'dense-weathered-bank-erratic-with-selective-fracture-creases-and-porosity-varied-capillary-front',
    mapping: 'seam-free-object-space-triplanar-albedo-roughness-relief',
    energyModel: 'non-emissive-dielectric-rock-albedo',
    albedoModel: 'coordinate-weathering-and-porosity-varied-capillary-front',
    capillaryBand: Object.freeze({
      nominalFrontY: -0.455,
      porosityVariationMeters: 0.09,
      lowerTransitionMeters: 0.08,
      upperTransitionMeters: 0.07,
      saturatedRoughness: 0.74,
      porositySource: 'same-correlated-height-field-as-optical-relief',
    }),
    triplanarTextures: Object.freeze({
      albedo: surfaceTextures?.albedo ?? null,
      roughness: surfaceTextures?.roughness ?? null,
      height: surfaceTextures?.height ?? null,
    }),
    reliefScale: spall ? 0.16 : 0.24,
  };
  prepared.needsUpdate = true;
  return prepared;
}

export function attachBrookBoulderVisual(anchor, template, surfaceTextures) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  const visual = template.clone(true);
  visual.name = 'world.connected_route.brook-boulder.original-asset';
  visual.traverse((object) => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => applySurfaceTextures(material, surfaceTextures, object.name))
      : applySurfaceTextures(object.material, surfaceTextures, object.name);
  });
  visual.userData.assetVersion = BROOK_BOULDER_ASSET.version;
  visual.userData.supportModel = BROOK_BOULDER_ASSET.supportModel;
  visual.userData.energyModel = 'non-emissive-dielectric-rock-albedo';
  visual.userData.collisionRole = BROOK_BOULDER_ASSET.collisionRole;
  visual.userData.transportClass = BROOK_BOULDER_ASSET.transportClass;
  visual.userData.normalModel = BROOK_BOULDER_ASSET.normalModel;
  anchor.add(visual);
  anchor.userData.assetVisual = visual;
  anchor.userData.visualSource = BROOK_BOULDER_ASSET.version;
  if (anchor.userData.fallback) anchor.userData.fallback.visible = false;
  return visual;
}
