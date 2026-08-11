import * as THREE from 'three';

import {
  VEGETATION_ALBEDO_PROFILE,
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from './vegetation-albedo.js';

export const CANOPY_TREE_LIBRARY_ASSET = Object.freeze({
  url: '/assets/canopy-tree-library-original-v7.glb',
  version: 'original-canopy-tree-library-v7',
  bytes: 2_134_992,
  triangles: 33_102,
  trianglesByVariant: Object.freeze([7_896, 6_930, 7_896, 10_380]),
  drawCalls: 8,
  drawCallsPerVariant: 2,
  variantCount: 4,
  variantIds: Object.freeze([
    'humid-buttress-broadleaf',
    'open-asymmetric-broadleaf',
    'plate-barked-compound-broadleaf',
    'layered-araucaria',
  ]),
  leafCounts: Object.freeze([924, 798, 924, 1_296]),
  damagedLeafCounts: Object.freeze([249, 240, 243, 370]),
  branchAnchorCounts: Object.freeze([132, 114, 132, 216]),
  supportVertexCounts: Object.freeze([29, 29, 29, 25]),
  supportPlaneY: -0.22,
  sha256: '16f105bc453d588fe2b2335e9a29736e0f19e9a766c11ef4945c8740993a5858',
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  generator: 'app/scripts/generate-canopy-tree-library.mjs',
  rights: 'project-original-code-authored-output',
  supportModel: 'buried-root-mantle-to-trunk-to-closed-branches-to-attached-leaves',
  collisionRole: 'solid-visible-trunk-with-non-solid-branches-and-pliable-leaves',
  growthModel: 'gravitropic-vertical-trunk-with-gravity-settled-root-mantle',
  leafAttachmentDistribution:
    'distributed-nodes-along-closed-primary-secondary-and-tertiary-branch-axes',
  leafCoverageModel:
    'higher-node-density-with-bounded-nine-point-five-percent-leaf-growth',
  leafNodeHierarchy: 'primary-secondary-tertiary-and-araucaria-whorl-axes',
  leafCountGrowthPercent: 9.5,
  assetTriangleGrowthPercent: 0.82,
  assetTriangleGrowthBaseline: 'v6-to-v7-stratified-crown-and-fractured-limb-architecture',
  roundedLaminaTriangleGrowthPercent: 92.41,
  roundedLaminaTriangleGrowthBaseline: 'v5-to-v6-rounded-lamina-topology',
  trianglesPerLeaf: 6,
  verticesPerLeaf: 8,
  leafSurfaceTriangleMultiplier: 3,
  partialLaminaDamage:
    'stable-one-sided-missing-margin-plus-colour-depth-shared-rare-perforation',
  crownArchitecture:
    'vertical-crown-volume-with-closed-upper-scaffolds-and-wind-fractured-limb-stubs',
  brokenBranchCounts: Object.freeze([1, 1, 1, 2]),
  fractureSplinterCounts: Object.freeze([3, 3, 3, 6]),
  crownBudgetModel:
    'existing-leaf-budget-reallocated-from-broken-horizontal-limbs-to-supported-upper-scaffolds',
  matureEnvelope: Object.freeze({
    maximumCrownDiameterMeters: 10,
    maximumHeightMeters: 9.9,
  }),
});

export const CANOPY_TREE_WIND_PROFILE = Object.freeze({
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.095,
  verticalTipDisplacementMeters: 0.022,
  macroFrequencyHz: 0.43,
  flutterFrequencyHz: 1.48,
  flexAttribute: 'uv1-y',
  supportModel: 'fixed-root-trunk-and-branches-with-progressively-flexible-attached-leaves',
  shadowModel: 'identical-colour-and-depth-pass-displacement-function-and-uniforms',
});

export const CANOPY_TREE_LEAF_RETENTION_PROFILE = Object.freeze({
  version: 'age-wind-and-habitat-leaf-retention-v1',
  sourceModel: 'succession-age-wind-damage-slope-wetness-and-stable-individual-rank',
  minimumRetention: 0.82,
  maximumRetention: 0.985,
  windDamageLoss: 0.09,
  maximumSlopeLoss: 0.015,
  maximumDrynessLoss: 0.015,
  maximumIndividualLoss: 0.008,
  ageBaseline: Object.freeze({
    mature: 0.965,
    submature: 0.975,
    pioneer: 0.985,
    unspecified: 0.97,
  }),
  temporalModel: 'stable-per-instance-no-camera-or-time-dependent-leaf-popping',
  shadowModel: 'identical-colour-and-depth-pass-leaf-rejection',
});

export const CANOPY_TREE_SURFACE_VARIATION_PROFILE = Object.freeze({
  version: 'stable-individual-bark-scar-and-lamina-damage-v1',
  structureModel:
    'instance-ranked-trunk-localised-healed-scar-with-callus-and-exposed-heartwood-response',
  leafModel:
    'stable-per-leaf-edge-notches-and-rare-lamina-perforation-from-authored-retention-rank',
  structureVariationSource: 'stable-tree-index-rank-plus-recorded-wind-damage',
  leafVariationSource: 'asset-authored-uv1-x-stable-complete-lamina-rank',
  maximumScarHeightMeters: 0.96,
  maximumScarAngularFraction: 0.22,
  damagedLeafRankThreshold: 0.72,
  perforatedLeafRankThreshold: 0.92,
  temporalModel: 'stable-no-time-or-camera-dependent-surface-popping',
  shadowModel: 'identical-partial-lamina-rejection-in-colour-and-depth-passes',
  evidenceBoundary:
    'bounded-surface-history-does-not-claim-species-specific-palaeobotanical-damage-rates',
});

const ROOT_BURIAL_DEPTH = 0.025;
const SUPPORT_CONTACT_CEILING = CANOPY_TREE_LIBRARY_ASSET.supportPlaneY + 0.036;
const SUPPORT_CLEARANCE_RANGE = Object.freeze([-0.82, 0]);

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.9, 0.9);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.32);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.dithering = true;
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.canopy-tree-library.template';
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
  template.userData.meshes = meshes;
  template.userData.triangles = triangles;
  template.userData.provenance = CANOPY_TREE_LIBRARY_ASSET.provenance;
  template.userData.supportModel = CANOPY_TREE_LIBRARY_ASSET.supportModel;
  return template;
}

export function createCachedCanopyTreeLibraryLoader({
  assetUrl = CANOPY_TREE_LIBRARY_ASSET.url,
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

export const loadCanopyTreeLibraryTemplate = createCachedCanopyTreeLibraryLoader();

function makeTexture(name, data, size, source, colorSpace = THREE.NoColorSpace, repeat = false) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.userData.source = source;
  texture.needsUpdate = true;
  return texture;
}

function correlatedTextures({ size, prefix, source, repeat, sample }) {
  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const height = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const values = sample(x / (size - 1), y / (size - 1));
      const offset = (y * size + x) * 4;
      albedo.set(values.slice(0, 3).map((value) => (
        Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255)
      )).concat(255), offset);
      const roughnessByte = Math.round(THREE.MathUtils.clamp(values[3], 0, 1) * 255);
      roughness.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(THREE.MathUtils.clamp(values[4], 0, 1) * 255);
      height.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  return Object.freeze({
    albedo: makeTexture(
      `world.material.${prefix}-albedo`, albedo, size, source, THREE.SRGBColorSpace, repeat,
    ),
    roughness: makeTexture(
      `world.material.${prefix}-roughness`, roughness, size, source, THREE.NoColorSpace, repeat,
    ),
    height: makeTexture(
      `world.material.${prefix}-height`, height, size, source, THREE.NoColorSpace, repeat,
    ),
  });
}

export function createCanopyTreeSurfaceTextures(size = 64) {
  const wetBark = correlatedTextures({
    size,
    prefix: 'canopy-tree-wet-furrowed-bark',
    source: 'deterministic-original-code-authored-correlated-wet-furrowed-bark',
    repeat: true,
    sample(u, v) {
      const furrow = Math.abs(Math.sin((u * 9.2 + Math.sin(v * 4.8) * 0.35) * Math.PI));
      const moss = Math.max(0, Math.sin((u * 3.4 - v * 2.6) * Math.PI * 2));
      const value = 0.5 + furrow * 0.14 + moss * 0.035;
      return [value * 0.72, value * 0.61, value * 0.46, 0.97 - furrow * 0.06, 0.3 + furrow * 0.5];
    },
  });
  const plateBark = correlatedTextures({
    size,
    prefix: 'canopy-tree-plate-bark',
    source: 'deterministic-original-code-authored-correlated-plate-bark',
    repeat: true,
    sample(u, v) {
      const vertical = Math.abs(Math.sin((u * 6.1 + Math.sin(v * 3.2) * 0.24) * Math.PI));
      const plates = Math.exp(-((Math.sin(v * Math.PI * 7.4)) ** 2) / 0.05);
      const value = 0.52 + vertical * 0.1 + plates * 0.13;
      return [value * 0.76, value * 0.58, value * 0.42, 0.96 - plates * 0.055, 0.28 + vertical * 0.28 + plates * 0.38];
    },
  });
  const leaf = correlatedTextures({
    size,
    prefix: 'canopy-tree-leaf',
    source: 'deterministic-original-code-authored-correlated-canopy-leaf',
    repeat: false,
    sample(u, v) {
      const midrib = Math.exp(-((u - 0.5) ** 2) / 0.003);
      const veins = Math.max(0, Math.sin((v * 8.8 + Math.abs(u - 0.5) * 4.4) * Math.PI));
      const cellular = Math.sin((u * 11.3 + v * 7.2) * Math.PI * 2) * 0.018;
      const value = 0.73 + midrib * 0.12 + veins * 0.032 + cellular;
      return [value * 0.73, value * 0.96, value * 0.65, 0.94 - midrib * 0.075 - veins * 0.02, 0.34 + midrib * 0.44 + veins * 0.15];
    },
  });
  return Object.freeze({ wetBark, plateBark, leaf });
}

function injectCanopyTreeWindVertex(shader, uniforms, leafRetention = false) {
  shader.uniforms.canopyTreeWindTime = uniforms.time;
  shader.uniforms.canopyTreeWindStrength = uniforms.strength;
  shader.uniforms.canopyTreeWindVerticalStrength = uniforms.verticalStrength;
  const leafRetentionDeclarations = leafRetention ? `
      attribute float canopyTreeLeafRetention;
      varying float canopyTreeLeafRetentionRank;
      varying float canopyTreeInstanceRetention;
  ` : '';
  const leafRetentionAssignment = leafRetention ? `
      canopyTreeLeafRetentionRank = canopyTreeFlex.x;
      canopyTreeInstanceRetention = canopyTreeLeafRetention;
  ` : '';
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      attribute vec2 canopyTreeFlex;
      ${leafRetentionDeclarations}
      uniform float canopyTreeWindTime;
      uniform float canopyTreeWindStrength;
      uniform float canopyTreeWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      ${leafRetentionAssignment}
      float canopyTreeWindAnchor = smoothstep(0.0, 1.0, canopyTreeFlex.y);
      vec4 canopyTreeWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      mat3 canopyTreeWindBasis = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        canopyTreeWindWorldPoint = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        canopyTreeWindBasis = mat3(modelMatrix) * mat3(instanceMatrix);
      #endif
      vec3 canopyTreeWindWorldDirection = normalize(vec3(
        ${CANOPY_TREE_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      vec3 canopyTreeWindLocalDirection = normalize(vec3(
        dot(canopyTreeWindBasis[0], canopyTreeWindWorldDirection),
        dot(canopyTreeWindBasis[1], canopyTreeWindWorldDirection),
        dot(canopyTreeWindBasis[2], canopyTreeWindWorldDirection)
      ));
      float canopyTreeWindMacro = sin(
        canopyTreeWindTime * ${CANOPY_TREE_WIND_PROFILE.macroFrequencyHz.toFixed(2)}
        + dot(canopyTreeWindWorldPoint.xz, vec2(0.031, 0.027))
      );
      float canopyTreeWindFlutter = sin(
        canopyTreeWindTime * ${CANOPY_TREE_WIND_PROFILE.flutterFrequencyHz.toFixed(2)}
        + dot(canopyTreeWindWorldPoint.xz, vec2(-0.067, 0.059))
      );
      float canopyTreeWindResponse = canopyTreeWindAnchor
        * (canopyTreeWindMacro * 0.84 + canopyTreeWindFlutter * 0.16);
      transformed += canopyTreeWindLocalDirection * canopyTreeWindResponse
        * canopyTreeWindStrength;
      transformed.y += canopyTreeWindAnchor * canopyTreeWindFlutter
        * canopyTreeWindVerticalStrength;
    `);
}

function injectCanopyTreeLeafRetentionFragment(shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `
      #include <common>
      varying float canopyTreeLeafRetentionRank;
      varying float canopyTreeInstanceRetention;
    `)
    .replace('#include <alphatest_fragment>', `
      #include <alphatest_fragment>
      #ifdef USE_MAP
        float canopyTreeDamageRank = fract(
          canopyTreeLeafRetentionRank * 17.317 + 0.173
        );
        float canopyTreeDamageEnabled = step(
          ${CANOPY_TREE_SURFACE_VARIATION_PROFILE.damagedLeafRankThreshold.toFixed(2)},
          canopyTreeDamageRank
        );
        float canopyTreeDamageSide = step(
          0.5,
          fract(canopyTreeLeafRetentionRank * 29.731 + 0.417)
        );
        vec2 canopyTreeNotchCentre = vec2(
          mix(0.17, 0.83, canopyTreeDamageSide),
          mix(0.5, 0.67, fract(canopyTreeLeafRetentionRank * 11.913))
        );
        vec2 canopyTreeNotchScale = vec2(0.085, 0.11);
        float canopyTreeEdgeNotch = 1.0 - smoothstep(
          0.72,
          1.0,
          length((vMapUv - canopyTreeNotchCentre) / canopyTreeNotchScale)
        );
        float canopyTreePerforationEnabled = step(
          ${CANOPY_TREE_SURFACE_VARIATION_PROFILE.perforatedLeafRankThreshold.toFixed(2)},
          fract(canopyTreeLeafRetentionRank * 23.117 + 0.61)
        );
        vec2 canopyTreePerforationCentre = vec2(
          0.5 + (fract(canopyTreeLeafRetentionRank * 7.41) - 0.5) * 0.2,
          0.45 + fract(canopyTreeLeafRetentionRank * 13.71) * 0.24
        );
        float canopyTreePerforation = 1.0 - smoothstep(
          0.72,
          1.0,
          length((vMapUv - canopyTreePerforationCentre) / vec2(0.035, 0.052))
        );
        if (
          canopyTreeDamageEnabled * canopyTreeEdgeNotch > 0.5
          || canopyTreePerforationEnabled * canopyTreePerforation > 0.5
        ) discard;
      #endif
      if (canopyTreeLeafRetentionRank > canopyTreeInstanceRetention) discard;
    `);
}

function injectCanopyTreeStructureVariation(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <uv_pars_vertex>', `
      #include <uv_pars_vertex>
      attribute float canopyTreeStructureVariation;
      varying float canopyTreeStructureVariationRank;
      varying vec3 canopyTreeStructureLocalPosition;
    `)
    .replace('#include <project_vertex>', `
      canopyTreeStructureVariationRank = canopyTreeStructureVariation;
      canopyTreeStructureLocalPosition = transformed;
      #include <project_vertex>
    `);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <uv_pars_fragment>', `
      #include <uv_pars_fragment>
      varying float canopyTreeStructureVariationRank;
      varying vec3 canopyTreeStructureLocalPosition;
    `)
    .replace('#include <map_fragment>', `
      #include <map_fragment>
      float canopyTreeTrunkRadius = length(canopyTreeStructureLocalPosition.xz);
      float canopyTreeTrunkMask = 1.0 - smoothstep(0.52, 0.82, canopyTreeTrunkRadius);
      float canopyTreeScarCentreY = 1.05
        + fract(canopyTreeStructureVariationRank * 1.731) * 3.15;
      float canopyTreeBarkAngle = atan(
        canopyTreeStructureLocalPosition.z,
        canopyTreeStructureLocalPosition.x
      ) / (2.0 * PI) + 0.5;
      float canopyTreeScarAngle = fract(
        canopyTreeStructureVariationRank * 2.417 + 0.13
      );
      float canopyTreeScarAngularDistance = abs(
        fract(canopyTreeBarkAngle - canopyTreeScarAngle + 0.5) - 0.5
      );
      float canopyTreeScarVerticalDistance = abs(
        canopyTreeStructureLocalPosition.y - canopyTreeScarCentreY
      );
      float canopyTreeScarCore = canopyTreeTrunkMask
        * (1.0 - smoothstep(0.055, 0.105, canopyTreeScarAngularDistance))
        * (1.0 - smoothstep(0.24, 0.48, canopyTreeScarVerticalDistance));
      float canopyTreeScarCallus = canopyTreeTrunkMask
        * (1.0 - smoothstep(0.08, 0.145, canopyTreeScarAngularDistance))
        * (1.0 - smoothstep(0.37, 0.56, canopyTreeScarVerticalDistance));
      canopyTreeScarCallus = max(canopyTreeScarCallus - canopyTreeScarCore, 0.0);
      diffuseColor.rgb = mix(
        diffuseColor.rgb,
        diffuseColor.rgb * vec3(0.78, 0.68, 0.54),
        canopyTreeScarCore * 0.68
      );
      diffuseColor.rgb = mix(
        diffuseColor.rgb,
        diffuseColor.rgb * vec3(1.13, 1.02, 0.84),
        canopyTreeScarCallus * 0.42
      );
    `)
    .replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.83, canopyTreeScarCore * 0.36);
      roughnessFactor = mix(roughnessFactor, 0.98, canopyTreeScarCallus * 0.24);
    `);
}

function addThinLeafTransmission(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_begin>',
    `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
  vec3 canopyTreeSurfaceNormal = normalize( geometryNormal );
  vec3 canopyTreeSunDirection = normalize( directionalLights[ 0 ].direction );
  float canopyTreeLightSide = dot( canopyTreeSurfaceNormal, canopyTreeSunDirection );
  float canopyTreeViewSide = dot( canopyTreeSurfaceNormal, geometryViewDir );
  float canopyTreeOppositeSides = saturate( - canopyTreeLightSide * canopyTreeViewSide );
  float canopyTreeIncidence = max( abs( canopyTreeLightSide ), 0.24 );
  vec3 canopyTreeAbsorption = vec3( 1.78, 0.69, 2.3 );
  vec3 canopyTreeTransmittance = exp( - canopyTreeAbsorption * 0.66 / canopyTreeIncidence );
  float canopyTreeShadowVisibility = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow canopyTreeTransmissionShadow = directionalLightShadows[ 0 ];
    canopyTreeShadowVisibility = receiveShadow ? getShadow(
      directionalShadowMap[ 0 ],
      canopyTreeTransmissionShadow.shadowMapSize,
      canopyTreeTransmissionShadow.shadowIntensity,
      canopyTreeTransmissionShadow.shadowBias,
      canopyTreeTransmissionShadow.shadowRadius,
      vDirectionalShadowCoord[ 0 ]
    ) : 1.0;
  #endif
  reflectedLight.directDiffuse += directionalLights[ 0 ].color
    * material.diffuseContribution
    * canopyTreeTransmittance
    * pow( canopyTreeOppositeSides, 0.5 )
    * canopyTreeShadowVisibility
    * RECIPROCAL_PI
    * 0.37;
#endif`,
  );
}

function createCanopyTreeMaterials() {
  const textures = createCanopyTreeSurfaceTextures();
  const windUniforms = Object.freeze({
    time: { value: 0 },
    strength: { value: CANOPY_TREE_WIND_PROFILE.horizontalTipDisplacementMeters },
    verticalStrength: { value: CANOPY_TREE_WIND_PROFILE.verticalTipDisplacementMeters },
  });
  function structureMaterial(barkFamily) {
    const bark = barkFamily === 'plate-barked' ? textures.plateBark : textures.wetBark;
    const material = new THREE.MeshStandardMaterial({
      color: barkFamily === 'plate-barked' ? 0xb6aa9a : 0xaaa89d,
      vertexColors: true,
      map: bark.albedo,
      roughness: 0.96,
      roughnessMap: bark.roughness,
      bumpMap: bark.height,
      bumpScale: barkFamily === 'plate-barked' ? 0.024 : 0.02,
      metalness: 0,
    });
    material.userData.textureChannels = bark;
    return material;
  }
  function leafMaterial(family) {
    const material = new THREE.MeshStandardMaterial({
      color: family === 'araucaria-whorl'
        ? VEGETATION_BASE_COLOURS.canopyAraucaria
        : VEGETATION_BASE_COLOURS.canopyBroadleaf,
      vertexColors: true,
      map: textures.leaf.albedo,
      roughness: 0.91,
      roughnessMap: textures.leaf.roughness,
      bumpMap: textures.leaf.height,
      bumpScale: family === 'araucaria-whorl' ? 0.008 : 0.011,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    material.userData.textureChannels = textures.leaf;
    return material;
  }
  const structures = Object.freeze({
    'wet-furrowed': structureMaterial('wet-furrowed'),
    'plate-barked': structureMaterial('plate-barked'),
  });
  const leaves = Object.freeze({
    'elliptic-waxy': leafMaterial('elliptic-waxy'),
    'compound-lanceolate': leafMaterial('compound-lanceolate'),
    'araucaria-whorl': leafMaterial('araucaria-whorl'),
  });
  for (const [family, material] of Object.entries(structures)) {
    material.onBeforeCompile = (shader) => {
      injectCanopyTreeWindVertex(shader, windUniforms);
      injectCanopyTreeStructureVariation(shader);
    };
    material.customProgramCacheKey = () => (
      `canopy-tree-library-v7-${family}-structure-wind-surface-history`
    );
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.dithering = true;
    material.userData = {
      ...material.userData,
      family: `original-canopy-tree-${family}-structure`,
      surface: `${family}-correlated-albedo-roughness-height`,
      energyModel: 'non-emissive-dielectric-plant-structure',
      windModel: CANOPY_TREE_WIND_PROFILE,
      windUniforms,
      surfaceVariationModel: CANOPY_TREE_SURFACE_VARIATION_PROFILE,
    };
  }
  for (const [family, material] of Object.entries(leaves)) {
    material.onBeforeCompile = (shader) => {
      injectCanopyTreeWindVertex(shader, windUniforms, true);
      injectCanopyTreeLeafRetentionFragment(shader);
      addThinLeafTransmission(shader);
    };
    material.customProgramCacheKey = () => (
      `canopy-tree-library-v7-${family}-leaf-wind-partial-lamina-damage`
    );
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.dithering = true;
    material.userData = {
      ...material.userData,
      family: `original-canopy-tree-${family}-leaves`,
      surface: `${family}-indexed-cambered-attached-leaves`,
      energyModel: 'shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric',
      albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
      windModel: CANOPY_TREE_WIND_PROFILE,
      windUniforms,
      leafRetentionModel: CANOPY_TREE_LEAF_RETENTION_PROFILE,
      surfaceVariationModel: CANOPY_TREE_SURFACE_VARIATION_PROFILE,
    };
  }
  return Object.freeze({ structures, leaves, textures, windUniforms });
}

function createCanopyTreeDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sourceMaterial.map,
    side: sourceMaterial.side,
  });
  const uniforms = sourceMaterial.userData.windUniforms;
  const usesLeafRetention = Boolean(sourceMaterial.userData.leafRetentionModel);
  material.onBeforeCompile = (shader) => {
    injectCanopyTreeWindVertex(shader, uniforms, usesLeafRetention);
    if (usesLeafRetention) injectCanopyTreeLeafRetentionFragment(shader);
  };
  material.customProgramCacheKey = () => (
    `canopy-tree-library-depth-v7-${sourceMaterial.userData.family}`
  );
  material.userData.windUniforms = uniforms;
  material.userData.shadowModel = CANOPY_TREE_WIND_PROFILE.shadowModel;
  return material;
}

function extractVariants(template) {
  const groups = [];
  template.traverse((child) => {
    if (Number.isInteger(child.userData.variantIndex)) groups.push(child);
  });
  return groups
    .sort((a, b) => a.userData.variantIndex - b.userData.variantIndex)
    .map((group) => {
      const meshes = [];
      group.traverse((object) => {
        if (object.isMesh) meshes.push(object);
      });
      const structure = meshes.find(
        (mesh) => mesh.name === 'canopy-tree-load-bearing-structure',
      );
      const leaves = meshes.find((mesh) => mesh.name === 'canopy-tree-attached-leaves');
      if (!structure || !leaves) {
        throw new Error(`Canopy tree variant ${group.userData.variantId} is missing its load path`);
      }
      return Object.freeze({
        id: group.userData.variantId,
        family: group.userData.family,
        barkFamily: group.userData.barkFamily,
        structure: structure.geometry,
        leaves: leaves.geometry,
      });
    });
}

export function classifyCanopyTreeHabitat(tree, { terrainGradient, terrainWetness }) {
  const gradient = terrainGradient(tree.x, tree.z);
  const slope = Math.hypot(gradient.x, gradient.z);
  const wetness = terrainWetness(tree.x, tree.z);
  const variantIndex = tree.isAraucaria
    ? 3
    : tree.leafFamily === 'compound-lanceolate'
      ? 2
      : tree.openCanopyExposure && wetness < 0.2
        ? 1
        : wetness >= 0.1 ? 0 : 1;
  return Object.freeze({
    variantIndex,
    slope,
    wetness,
    niche: variantIndex === 0
      ? 'humid-retentive-broadleaf'
      : variantIndex === 1
        ? 'drained-open-broadleaf'
        : variantIndex === 2 ? 'plate-barked-compound-margin' : 'raised-araucaria-tier',
  });
}

function stableIndividualRank(index = 0) {
  const value = Math.sin((index + 1) * 12.9898 + 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

export function canopyTreeLeafRetention(tree, habitat) {
  const profile = CANOPY_TREE_LEAF_RETENTION_PROFILE;
  const ageClass = tree.successionAgeClass ?? 'unspecified';
  const ageBaseline = profile.ageBaseline[ageClass] ?? profile.ageBaseline.unspecified;
  const windDamage = THREE.MathUtils.clamp(tree.successionWindDamage ?? 0, 0, 1);
  const slopeStress = THREE.MathUtils.clamp(habitat.slope / 0.35, 0, 1);
  const drynessStress = 1 - THREE.MathUtils.clamp(habitat.wetness / 0.2, 0, 1);
  const individualRank = stableIndividualRank(tree.index);
  const retention = THREE.MathUtils.clamp(
    ageBaseline
      - windDamage * profile.windDamageLoss
      - slopeStress * profile.maximumSlopeLoss
      - drynessStress * profile.maximumDrynessLoss
      - individualRank * profile.maximumIndividualLoss,
    profile.minimumRetention,
    profile.maximumRetention,
  );
  return Object.freeze({
    retention,
    ageClass,
    ageBaseline,
    windDamage,
    slopeStress,
    drynessStress,
    individualRank,
    sourceModel: profile.sourceModel,
  });
}

function supportPoints(geometry) {
  const positions = geometry.getAttribute('position');
  const points = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) <= SUPPORT_CONTACT_CEILING) {
      points.push(new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      ));
    }
  }
  return points;
}

function transformedCanopyTreeSize(variant, matrix) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const geometry of [variant.structure, variant.leaves]) {
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
      bounds.expandByPoint(point);
    }
  }
  return bounds.getSize(new THREE.Vector3());
}

function canopyTreeInstanceMatrix(tree, geometry, terrainHeight) {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    tree.trunkYaw,
  );
  const scale = new THREE.Vector3(tree.scale, tree.scale, tree.scale);
  const position = new THREE.Vector3(tree.x, 0, tree.z);
  const matrix = new THREE.Matrix4().compose(position, quaternion, scale);
  const localSupport = supportPoints(geometry);
  if (localSupport.length === 0) {
    throw new Error('Canopy tree structure has no root-contact vertices');
  }
  const requiredY = localSupport.map((point) => {
    const world = point.clone().applyMatrix4(matrix);
    return terrainHeight(world.x, world.z) - world.y;
  });
  position.y = Math.min(...requiredY) - ROOT_BURIAL_DEPTH;
  matrix.compose(position, quaternion, scale);
  const clearances = localSupport.map((point) => {
    const world = point.clone().applyMatrix4(matrix);
    return world.y - terrainHeight(world.x, world.z);
  });
  const supportedVertexCount = clearances.filter((clearance) => (
    clearance >= SUPPORT_CLEARANCE_RANGE[0]
      && clearance <= SUPPORT_CLEARANCE_RANGE[1]
  )).length;
  return Object.freeze({
    matrix,
    position: position.clone(),
    supportVertexCount: localSupport.length,
    supportedVertexCount,
    supportRatio: supportedVertexCount / localSupport.length,
    minimumClearance: Math.min(...clearances),
    maximumClearance: Math.max(...clearances),
    verticalAxis: [0, 1, 0],
  });
}

export function attachCanopyTreeLibraryVisual(anchor, template, trees, {
  terrainHeight,
  terrainGradient,
  terrainWetness,
} = {}) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  if (!terrainHeight || !terrainGradient || !terrainWetness) {
    throw new Error('Canopy tree placement requires terrain height, gradient, and wetness functions');
  }
  const variants = extractVariants(template);
  if (variants.length !== CANOPY_TREE_LIBRARY_ASSET.variantCount) {
    throw new Error(
      `Expected ${CANOPY_TREE_LIBRARY_ASSET.variantCount} canopy variants, received ${variants.length}`,
    );
  }
  const classified = trees.map((tree) => ({
    tree,
    habitat: classifyCanopyTreeHabitat(tree, { terrainGradient, terrainWetness }),
  }));
  const counts = variants.map((_, variantIndex) => (
    classified.filter(({ habitat }) => habitat.variantIndex === variantIndex).length
  ));
  const materials = createCanopyTreeMaterials();
  const group = new THREE.Group();
  group.name = 'world.connected_route.canopy-trees.original-library';
  const instancedByVariant = variants.map((variant, variantIndex) => {
    const roles = [
      {
        key: 'structure', label: 'load-bearing-structure',
        material: materials.structures[variant.barkFamily],
      },
      {
        key: 'leaves', label: 'attached-leaves',
        material: materials.leaves[variant.family],
      },
    ];
    return roles.map((role) => {
      const geometry = variant[role.key].clone();
      const flex = geometry.getAttribute('uv1');
      if (!flex) throw new Error(`${variant.id} ${role.label} is missing flex coordinates`);
      geometry.setAttribute('canopyTreeFlex', flex);
      if (role.key === 'leaves') {
        geometry.setAttribute(
          'canopyTreeLeafRetention',
          new THREE.InstancedBufferAttribute(new Float32Array(counts[variantIndex]), 1),
        );
      } else {
        geometry.setAttribute(
          'canopyTreeStructureVariation',
          new THREE.InstancedBufferAttribute(new Float32Array(counts[variantIndex]), 1),
        );
      }
      const mesh = new THREE.InstancedMesh(geometry, role.material, counts[variantIndex]);
      mesh.name = `world.connected_route.canopy-trees.${variant.id}.${role.label}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = createCanopyTreeDepthMaterial(role.material);
      mesh.userData.variantId = variant.id;
      mesh.userData.role = role.label;
      mesh.userData.supportModel = CANOPY_TREE_LIBRARY_ASSET.supportModel;
      mesh.userData.collisionRole = CANOPY_TREE_LIBRARY_ASSET.collisionRole;
      group.add(mesh);
      return mesh;
    });
  });
  const instanceIndices = counts.map(() => 0);
  const supportEvidence = [];
  const leafRetentionEvidence = [];
  const habitatCounts = {
    'humid-retentive-broadleaf': 0,
    'drained-open-broadleaf': 0,
    'plate-barked-compound-margin': 0,
    'raised-araucaria-tier': 0,
  };
  const structureTint = new THREE.Color();
  const leafTint = new THREE.Color();
  classified.forEach(({ tree, habitat }) => {
    const variant = variants[habitat.variantIndex];
    const evidence = canopyTreeInstanceMatrix(tree, variant.structure, terrainHeight);
    const worldSize = transformedCanopyTreeSize(variant, evidence.matrix);
    const individual = (tree.index % 7) / 6;
    const structureAlbedo = vegetationStructureTint({
      hue: variant.barkFamily === 'plate-barked' ? 0.055 : 0.09,
      wetness: habitat.wetness,
      individual,
      baseLightness: variant.barkFamily === 'plate-barked' ? 0.68 : 0.64,
    });
    structureTint.setHSL(
      structureAlbedo.hue,
      structureAlbedo.saturation,
      structureAlbedo.lightness,
    );
    const leafAlbedo = vegetationLeafTint([
      'canopy-humid-broadleaf',
      'canopy-drained-broadleaf',
      'canopy-compound-margin',
      'canopy-araucaria',
    ][habitat.variantIndex], {
      wetness: habitat.wetness,
      slope: habitat.slope,
      individual,
    });
    leafTint.setHSL(leafAlbedo.hue, leafAlbedo.saturation, leafAlbedo.lightness);
    const leafRetention = canopyTreeLeafRetention(tree, habitat);
    const instanceIndex = instanceIndices[habitat.variantIndex];
    instancedByVariant[habitat.variantIndex].forEach((mesh) => {
      mesh.setMatrixAt(instanceIndex, evidence.matrix);
      mesh.setColorAt(instanceIndex, mesh.userData.role === 'load-bearing-structure'
        ? structureTint
        : leafTint);
      if (mesh.userData.role === 'attached-leaves') {
        mesh.geometry.getAttribute('canopyTreeLeafRetention')
          .setX(instanceIndex, leafRetention.retention);
      } else {
        const surfaceVariation = THREE.MathUtils.clamp(
          stableIndividualRank(tree.index) * 0.74
            + (tree.successionWindDamage ?? 0) * 0.26,
          0,
          1,
        );
        mesh.geometry.getAttribute('canopyTreeStructureVariation')
          .setX(instanceIndex, surfaceVariation);
      }
    });
    const diameter = Math.max(worldSize.x, worldSize.z);
    const height = worldSize.y;
    supportEvidence.push(Object.freeze({
      index: tree.index,
      variantId: variant.id,
      niche: habitat.niche,
      slope: habitat.slope,
      wetness: habitat.wetness,
      diameter,
      height,
      dimensionEnvelopePass: diameter <= CANOPY_TREE_LIBRARY_ASSET.matureEnvelope
        .maximumCrownDiameterMeters
        && height <= CANOPY_TREE_LIBRARY_ASSET.matureEnvelope.maximumHeightMeters,
      ...evidence,
    }));
    leafRetentionEvidence.push(Object.freeze({
      index: tree.index,
      variantId: variant.id,
      niche: habitat.niche,
      ...leafRetention,
    }));
    const placementAnchor = anchor.children[tree.index];
    if (placementAnchor?.userData.canopyTreePlacementAnchor) {
      placementAnchor.position.copy(evidence.position);
      placementAnchor.rotation.set(0, tree.trunkYaw, 0);
      placementAnchor.scale.setScalar(tree.scale);
      placementAnchor.userData.variantId = variant.id;
      placementAnchor.userData.supportEvidence = evidence;
      placementAnchor.userData.leafRetentionEvidence = leafRetention;
    }
    habitatCounts[habitat.niche] += 1;
    instanceIndices[habitat.variantIndex] += 1;
  });
  instancedByVariant.flat().forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (mesh.geometry.getAttribute('canopyTreeLeafRetention')) {
      mesh.geometry.getAttribute('canopyTreeLeafRetention').needsUpdate = true;
    }
    if (mesh.geometry.getAttribute('canopyTreeStructureVariation')) {
      mesh.geometry.getAttribute('canopyTreeStructureVariation').needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  });
  const supportVertexCount = supportEvidence.reduce(
    (sum, evidence) => sum + evidence.supportVertexCount, 0,
  );
  const supportedVertexCount = supportEvidence.reduce(
    (sum, evidence) => sum + evidence.supportedVertexCount, 0,
  );
  const dimensionSummary = variants.map((variant, variantIndex) => {
    const matching = supportEvidence.filter((evidence) => evidence.variantId === variant.id);
    return Object.freeze({
      id: variant.id,
      instanceCount: matching.length,
      maximumDiameterMeters: Math.max(...matching.map((evidence) => evidence.diameter)),
      maximumHeightMeters: Math.max(...matching.map((evidence) => evidence.height)),
      maximumCrownDiameterMeters: CANOPY_TREE_LIBRARY_ASSET.matureEnvelope
        .maximumCrownDiameterMeters,
      maximumMatureHeightMeters: CANOPY_TREE_LIBRARY_ASSET.matureEnvelope.maximumHeightMeters,
      envelopePassCount: matching.filter((evidence) => evidence.dimensionEnvelopePass).length,
      variantIndex,
    });
  });
  group.userData = {
    assetVersion: CANOPY_TREE_LIBRARY_ASSET.version,
    supportModel: CANOPY_TREE_LIBRARY_ASSET.supportModel,
    collisionRole: CANOPY_TREE_LIBRARY_ASSET.collisionRole,
    growthModel: CANOPY_TREE_LIBRARY_ASSET.growthModel,
    energyModel: 'non-emissive-dielectric-plant-surfaces',
    albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
    instanceCount: trees.length,
    drawCalls: CANOPY_TREE_LIBRARY_ASSET.drawCalls,
    counts,
    habitatCounts,
    supportEvidence,
    leafRetentionEvidence,
    leafRetentionSummary: Object.freeze({
      version: CANOPY_TREE_LEAF_RETENTION_PROFILE.version,
      sourceModel: CANOPY_TREE_LEAF_RETENTION_PROFILE.sourceModel,
      temporalModel: CANOPY_TREE_LEAF_RETENTION_PROFILE.temporalModel,
      shadowModel: CANOPY_TREE_LEAF_RETENTION_PROFILE.shadowModel,
      minimumRetention: Math.min(...leafRetentionEvidence.map(({ retention }) => retention)),
      maximumRetention: Math.max(...leafRetentionEvidence.map(({ retention }) => retention)),
      meanRetention: leafRetentionEvidence.reduce(
        (sum, { retention }) => sum + retention, 0,
      ) / leafRetentionEvidence.length,
      damagedInstanceCount: leafRetentionEvidence.filter(
        ({ retention }) => retention < 0.9,
      ).length,
      ageCounts: Object.freeze(leafRetentionEvidence.reduce((countsByAge, { ageClass }) => ({
        ...countsByAge,
        [ageClass]: (countsByAge[ageClass] ?? 0) + 1,
      }), {})),
    }),
    surfaceVariation: CANOPY_TREE_SURFACE_VARIATION_PROFILE,
    dimensionSummary,
    supportSummary: Object.freeze({
      supportVertexCount,
      supportedVertexCount,
      supportRatio: supportedVertexCount / supportVertexCount,
      minimumClearance: Math.min(...supportEvidence.map((evidence) => evidence.minimumClearance)),
      maximumClearance: Math.max(...supportEvidence.map((evidence) => evidence.maximumClearance)),
      burialDepth: ROOT_BURIAL_DEPTH,
      clearanceRange: [...SUPPORT_CLEARANCE_RANGE],
      settlementAxis: 'world-gravity-only',
    }),
    materials,
  };
  anchor.add(group);
  anchor.userData.assetVisual = group;
  anchor.userData.visualSource = CANOPY_TREE_LIBRARY_ASSET.version;
  anchor.userData.supportEvidence = group.userData.supportSummary;
  (anchor.userData.fallbackMeshes ?? []).forEach((mesh) => { mesh.visible = false; });
  return group;
}

export function updateCanopyTreeLibraryWind(anchor, elapsed, reducedMotion = false) {
  const materials = anchor.userData.assetVisual?.userData.materials;
  if (!materials) return;
  materials.windUniforms.time.value = reducedMotion ? 0 : elapsed;
  materials.windUniforms.strength.value = reducedMotion
    ? 0
    : CANOPY_TREE_WIND_PROFILE.horizontalTipDisplacementMeters;
  materials.windUniforms.verticalStrength.value = reducedMotion
    ? 0
    : CANOPY_TREE_WIND_PROFILE.verticalTipDisplacementMeters;
}
