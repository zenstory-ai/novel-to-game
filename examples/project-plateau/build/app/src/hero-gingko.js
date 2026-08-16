import * as THREE from 'three';

export const HERO_GINGKO_ASSET = Object.freeze({
  url: '/assets/hero-gingko-original-v2.glb',
  version: 'original-hero-gingko-v2',
  bytes: 3_878_144,
  triangles: 123_624,
  drawCalls: 2,
  leafCount: 1_971,
  sha256: '3c2192dc6d4be1ab811a41cc287a38067c14d2e2cd3bcb4accd662a35b738b89',
  provenance: 'project-original-deterministic-offline-authored-mesh',
  generator: 'app/scripts/generate-hero-gingko.mjs',
  rights: 'project-original-code-authored-output',
});

export const HERO_GINGKO_SURFACE_PROFILE = Object.freeze({
  version: 'correlated-bark-albedo-roughness-relief-v1',
  resolution: 128,
  repeatScaleMeters: Object.freeze({ around: 0.65, along: 0.46 }),
  roughnessRange: Object.freeze([0.86, 0.98]),
  bumpScaleMeters: 0.008,
  textureObjectCount: 2,
  boundary: 'project-generated-bark-scale-optics-not-photogrammetry-or-species-age-proof',
});

export const HERO_GINGKO_WIND_PROFILE = Object.freeze({
  version: 'hierarchical-gentle-breeze-wind-v1',
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.12,
  verticalTipDisplacementMeters: 0.024,
  macroFrequencyHz: 0.37,
  flutterFrequencyHz: 1.62,
  flexAttribute: 'uv1-y',
  hierarchy: Object.freeze({
    rootAndTrunk: Object.freeze([0, 0]),
    scaffold: Object.freeze([0.05, 0.32]),
    secondary: Object.freeze([0.28, 0.56]),
    twig: Object.freeze([0.52, 0.82]),
    leaf: Object.freeze([0.4, 1]),
  }),
  supportModel: 'fixed-root-and-trunk-with-stiffness-ordered-scaffold-secondary-twig-and-leaf',
  shadowModel: 'identical-colour-and-depth-pass-displacement-function-and-uniforms',
  reducedMotionModel: 'zero-time-zero-strength-fixed-rest-pose',
});

const HERO_GINGKO_WIND_UNIFORMS = Object.freeze({
  time: { value: 0 },
  strength: { value: HERO_GINGKO_WIND_PROFILE.horizontalTipDisplacementMeters },
  verticalStrength: { value: HERO_GINGKO_WIND_PROFILE.verticalTipDisplacementMeters },
});

function smoothstep01(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function heroGingkoWindDisplacement({
  elapsed = 0,
  worldPosition = [0, 0, 0],
  flex = 0,
  phaseRank = 0,
  strength = HERO_GINGKO_WIND_PROFILE.horizontalTipDisplacementMeters,
  verticalStrength = HERO_GINGKO_WIND_PROFILE.verticalTipDisplacementMeters,
} = {}) {
  const anchor = smoothstep01(flex) ** 2;
  if (anchor === 0 || (strength === 0 && verticalStrength === 0)) {
    return Object.freeze([0, 0, 0]);
  }
  const phase = phaseRank * Math.PI * 2;
  const macro = Math.sin(
    elapsed * HERO_GINGKO_WIND_PROFILE.macroFrequencyHz * Math.PI * 2
      + worldPosition[0] * 0.031 + worldPosition[2] * 0.027 + phase,
  );
  const flutter = Math.sin(
    elapsed * HERO_GINGKO_WIND_PROFILE.flutterFrequencyHz * Math.PI * 2
      - worldPosition[0] * 0.067 + worldPosition[2] * 0.059 + phase * 1.73,
  );
  const response = anchor * (macro * 0.82 + flutter * 0.18);
  return Object.freeze([
    HERO_GINGKO_WIND_PROFILE.direction[0] * response * strength,
    anchor * flutter * verticalStrength,
    HERO_GINGKO_WIND_PROFILE.direction[2] * response * strength,
  ]);
}

function injectHeroGingkoWindVertex(shader, uniforms) {
  shader.uniforms.heroGingkoWindTime = uniforms.time;
  shader.uniforms.heroGingkoWindStrength = uniforms.strength;
  shader.uniforms.heroGingkoWindVerticalStrength = uniforms.verticalStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      attribute vec2 heroGingkoFlex;
      uniform float heroGingkoWindTime;
      uniform float heroGingkoWindStrength;
      uniform float heroGingkoWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float heroGingkoWindAnchor = smoothstep(0.0, 1.0, heroGingkoFlex.y);
      heroGingkoWindAnchor *= heroGingkoWindAnchor;
      vec4 heroGingkoWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      vec3 heroGingkoWindWorldDirection = normalize(vec3(
        ${HERO_GINGKO_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      mat3 heroGingkoWindBasis = mat3(modelMatrix);
      vec3 heroGingkoWindLocalDirection = normalize(vec3(
        dot(heroGingkoWindBasis[0], heroGingkoWindWorldDirection),
        dot(heroGingkoWindBasis[1], heroGingkoWindWorldDirection),
        dot(heroGingkoWindBasis[2], heroGingkoWindWorldDirection)
      ));
      float heroGingkoWindPhase = heroGingkoFlex.x * 6.28318530718;
      float heroGingkoWindMacro = sin(
        heroGingkoWindTime * ${(HERO_GINGKO_WIND_PROFILE.macroFrequencyHz * Math.PI * 2).toFixed(5)}
        + dot(heroGingkoWindWorldPoint.xz, vec2(0.031, 0.027))
        + heroGingkoWindPhase
      );
      float heroGingkoWindFlutter = sin(
        heroGingkoWindTime * ${(HERO_GINGKO_WIND_PROFILE.flutterFrequencyHz * Math.PI * 2).toFixed(5)}
        + dot(heroGingkoWindWorldPoint.xz, vec2(-0.067, 0.059))
        + heroGingkoWindPhase * 1.73
      );
      float heroGingkoWindResponse = heroGingkoWindAnchor
        * (heroGingkoWindMacro * 0.82 + heroGingkoWindFlutter * 0.18);
      transformed += heroGingkoWindLocalDirection * heroGingkoWindResponse
        * heroGingkoWindStrength;
      transformed.y += heroGingkoWindAnchor * heroGingkoWindFlutter
        * heroGingkoWindVerticalStrength;
    `);
}

function createHeroGingkoDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: sourceMaterial.side,
  });
  material.onBeforeCompile = (shader) => {
    injectHeroGingkoWindVertex(shader, HERO_GINGKO_WIND_UNIFORMS);
  };
  material.customProgramCacheKey = () => (
    `hero-gingko-depth-${HERO_GINGKO_WIND_PROFILE.version}-${sourceMaterial.name}`
  );
  material.userData.windUniforms = HERO_GINGKO_WIND_UNIFORMS;
  material.userData.shadowModel = HERO_GINGKO_WIND_PROFILE.shadowModel;
  return material;
}

function dataTexture(name, data, colorSpace) {
  const texture = new THREE.DataTexture(
    data,
    HERO_GINGKO_SURFACE_PROFILE.resolution,
    HERO_GINGKO_SURFACE_PROFILE.resolution,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = name;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  texture.userData = {
    provenance: 'project-original-deterministic-runtime-authored-texture',
    profile: HERO_GINGKO_SURFACE_PROFILE.version,
  };
  texture.needsUpdate = true;
  return texture;
}

function createBarkSurfaceTextures() {
  const size = HERO_GINGKO_SURFACE_PROFILE.resolution;
  const albedo = new Uint8Array(size * size * 4);
  const surface = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const longFurrow = Math.sin(
        u * Math.PI * 2 * 2.0
          + Math.sin(v * Math.PI * 2 * 0.37 + u * Math.PI * 2 * 0.41) * 0.48,
      );
      const splitFurrow = Math.sin(
        u * Math.PI * 2 * 4.7
          + Math.sin(v * Math.PI * 2 * 0.83 - u * Math.PI * 2 * 0.29) * 0.72,
      ) * 0.31;
      const plateBreak = Math.sin(
        v * Math.PI * 2 * 1.15 + u * Math.PI * 2 * 0.63
          + Math.sin(u * Math.PI * 2 * 2.3) * 0.4,
      ) * 0.17;
      const height = THREE.MathUtils.clamp(
        0.56 + longFurrow * 0.095 + splitFurrow * 0.075 + plateBreak * 0.055,
        0.18,
        0.88,
      );
      const furrowDepth = 1 - height;
      const shade = THREE.MathUtils.clamp(0.94 - furrowDepth * 0.2 + plateBreak * 0.025, 0.74, 0.98);
      const roughness = THREE.MathUtils.clamp(0.9 + furrowDepth * 0.08, 0.86, 0.98);
      const offset = (y * size + x) * 4;
      albedo[offset] = Math.round(255 * shade * 0.98);
      albedo[offset + 1] = Math.round(255 * shade * 0.96);
      albedo[offset + 2] = Math.round(255 * shade * 0.92);
      albedo[offset + 3] = 255;
      surface[offset] = Math.round(255 * height);
      surface[offset + 1] = Math.round(255 * roughness);
      surface[offset + 2] = Math.round(255 * height);
      surface[offset + 3] = 255;
    }
  }
  return Object.freeze({
    albedo: dataTexture(
      'world.landmark.fort-gingko.bark-albedo',
      albedo,
      THREE.SRGBColorSpace,
    ),
    surface: dataTexture(
      'world.landmark.fort-gingko.bark-roughness-height',
      surface,
      THREE.NoColorSpace,
    ),
  });
}

const BARK_SURFACE_TEXTURES = createBarkSurfaceTextures();

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.8, 0.8);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.42);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.onBeforeCompile = (shader) => {
    injectHeroGingkoWindVertex(shader, HERO_GINGKO_WIND_UNIFORMS);
  };
  prepared.customProgramCacheKey = () => (
    `hero-gingko-colour-${HERO_GINGKO_WIND_PROFILE.version}-${prepared.name}`
  );
  prepared.userData = {
    ...prepared.userData,
    windProfile: HERO_GINGKO_WIND_PROFILE,
    windUniforms: HERO_GINGKO_WIND_UNIFORMS,
  };
  if (prepared.name.includes('hero-gingko-bark')) {
    prepared.map = BARK_SURFACE_TEXTURES.albedo;
    prepared.roughness = 1;
    prepared.roughnessMap = BARK_SURFACE_TEXTURES.surface;
    prepared.bumpMap = BARK_SURFACE_TEXTURES.surface;
    prepared.bumpScale = HERO_GINGKO_SURFACE_PROFILE.bumpScaleMeters;
    prepared.envMapIntensity = Math.min(prepared.envMapIntensity, 0.3);
    prepared.userData = {
      ...prepared.userData,
      surfaceProfile: HERO_GINGKO_SURFACE_PROFILE.version,
      roughnessRange: [...HERO_GINGKO_SURFACE_PROFILE.roughnessRange],
      energyModel: 'opaque-non-emissive-zero-metalness-rough-bark-dielectric',
    };
  }
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.hero-gingko.template';
  template.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry = object.geometry.clone();
    const flex = object.geometry.getAttribute('uv1');
    object.geometry.setAttribute(
      'heroGingkoFlex',
      flex ?? new THREE.Float32BufferAttribute(
        new Float32Array(object.geometry.attributes.position.count * 2),
        2,
      ),
    );
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepareMaterial)
      : prepareMaterial(object.material);
    if (!Array.isArray(object.material)) {
      object.customDepthMaterial = createHeroGingkoDepthMaterial(object.material);
    }
  });
  template.updateMatrixWorld(true);
  const productionRoot = template.getObjectByName('hero-gingko-original-v2');
  template.userData.supportSnapshot = productionRoot?.userData.supportSnapshot
    ? structuredClone(productionRoot.userData.supportSnapshot)
    : null;
  return template;
}

export function createCachedHeroGingkoLoader({
  assetUrl = HERO_GINGKO_ASSET.url,
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

export const loadHeroGingkoTemplate = createCachedHeroGingkoLoader();

export function attachHeroGingkoVisual(anchor, template) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  const visual = template.clone(true);
  visual.name = 'world.landmark.fort-gingko.asset-visual';
  visual.position.y = 0.022;
  visual.userData.supportModel = 'terrain-root-flare-to-collared-scaffold-to-short-shoot-fan-leaf';
  visual.userData.energyModel = 'non-emissive-dielectric-bark-and-leaf-albedo';
  visual.userData.supportSnapshot = template.userData.supportSnapshot
    ? structuredClone(template.userData.supportSnapshot)
    : null;
  visual.userData.surfaceProfile = { ...HERO_GINGKO_SURFACE_PROFILE };
  visual.userData.windProfile = HERO_GINGKO_WIND_PROFILE;
  visual.userData.windUniforms = HERO_GINGKO_WIND_UNIFORMS;
  anchor.add(visual);
  anchor.userData.fallback.visible = false;
  anchor.userData.assetVisual = visual;
  return visual;
}

export function updateHeroGingkoWind(anchor, elapsed, reducedMotion = false) {
  const visual = anchor.userData.assetVisual;
  if (!visual?.userData.windUniforms) return;
  const uniforms = visual.userData.windUniforms;
  uniforms.time.value = reducedMotion ? 0 : elapsed;
  uniforms.strength.value = reducedMotion
    ? 0
    : HERO_GINGKO_WIND_PROFILE.horizontalTipDisplacementMeters;
  uniforms.verticalStrength.value = reducedMotion
    ? 0
    : HERO_GINGKO_WIND_PROFILE.verticalTipDisplacementMeters;
}
