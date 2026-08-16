import * as THREE from 'three';

import {
  VEGETATION_ALBEDO_PROFILE,
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from './vegetation-albedo.js';

export const GROUND_COVER_LIBRARY_ASSET = Object.freeze({
  url: '/assets/ground-cover-library-original-v3.glb',
  bytes: 127_188,
  triangles: 2_712,
  drawCalls: 6,
  variantCount: 3,
  variantIds: Object.freeze([
    'brook-arrowhead-colony',
    'shade-elliptic-rosette',
    'slope-sedge-fan',
  ]),
  supportPlaneY: -0.08,
  sha256: '344a899894b845aa0c5fce5057ac1b9c4b0c006c3bb87b1aaafe7b81b8b3a264',
});

export const GROUND_COVER_ARCHITECTURE_PROFILE = Object.freeze({
  model: 'mixed-age-asymmetric-petiole-and-leaf-hierarchy',
  leafPhaseAttribute: 'uv1-x',
  petioleRadialSegments: 6,
  maximumPetioleRadiusMetersByVariant: Object.freeze([0.011, 0.0095, 0.008]),
  instanceYawVariationRadians: 0.11,
  instanceRadialVariation: 0.14,
  instanceVerticalVariationMeters: 0.022,
  maximumAttachmentGapMeters: 0.0001,
  attachmentModel: 'shared-leaf-phase-and-flex-at-closed-petiole-to-lamina-junction',
});

export const GROUND_COVER_WIND_PROFILE = Object.freeze({
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.065,
  verticalTipDisplacementMeters: 0.014,
  macroFrequencyHz: 0.78,
  flutterFrequencyHz: 2.45,
  flexAttribute: 'uv1-y',
  supportModel: 'subgrade-rhizome-fixed-petiole-and-leaf-progressively-flexible',
  shadowModel: 'identical-colour-and-depth-pass-displacement-function-and-uniforms',
});

// Placement scales originally drove much smaller procedural blades. Applying
// them directly to authored plants produced metre-scale rosettes and arrowhead
// leaves. Each family is therefore constrained to a measured mature envelope;
// these are geometry scales, so roots, stems, leaves and wind all remain coupled.
export const GROUND_COVER_DIMENSION_PROFILE = Object.freeze([
  Object.freeze({
    id: 'brook-arrowhead-colony', scale: 0.36, maxDiameterMeters: 0.88, maxHeightMeters: 0.38,
  }),
  Object.freeze({
    id: 'shade-elliptic-rosette', scale: 0.31, maxDiameterMeters: 0.66, maxHeightMeters: 0.23,
  }),
  Object.freeze({
    id: 'slope-sedge-fan', scale: 0.36, maxDiameterMeters: 0.74, maxHeightMeters: 0.56,
  }),
]);

const BURIAL_DEPTH = 0.052;
const SUPPORT_CLEARANCE_RANGE = Object.freeze([-0.065, -0.035]);

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.86, 0.86);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.32);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.dithering = true;
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.ground-cover-library.template';
  template.traverse((object) => {
    if (!object.isMesh) return;
    object.name = object.userData.name ?? object.name;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepareMaterial)
      : prepareMaterial(object.material);
  });
  return template;
}

export function createCachedGroundCoverLibraryLoader({
  assetUrl = GROUND_COVER_LIBRARY_ASSET.url,
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

export const loadGroundCoverLibraryTemplate = createCachedGroundCoverLibraryLoader();

function makeTexture(name, data, size, colorSpace = THREE.NoColorSpace) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createGroundCoverSurfaceTextures(size = 96) {
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const midrib = Math.exp(-((u - 0.5) ** 2) / 0.0032);
      const veinWave = Math.sin(
        (v * 8.6 - Math.abs(u - 0.5) * 3.8 + Math.sin(v * Math.PI) * 0.18) * Math.PI,
      );
      const veins = Math.exp(-(veinWave * veinWave) / 0.045)
        * THREE.MathUtils.smoothstep(Math.abs(u - 0.5), 0.04, 0.48);
      const cells = Math.sin((u * 10.7 + v * 6.1) * Math.PI * 2) * 0.025
        + Math.sin((u * 4.1 - v * 8.7) * Math.PI * 2) * 0.016;
      const surface = THREE.MathUtils.clamp(0.8 + midrib * 0.11 + veins * 0.03 + cells, 0.7, 0.96);
      const roughness = THREE.MathUtils.clamp(0.93 - midrib * 0.07 - veins * 0.02, 0.84, 0.98);
      const height = THREE.MathUtils.clamp(0.4 + midrib * 0.44 + veins * 0.16 + cells, 0.18, 1);
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(surface * 0.9 * 255);
      albedoData[offset + 1] = Math.round(surface * 0.98 * 255);
      albedoData[offset + 2] = Math.round(surface * 0.83 * 255);
      albedoData[offset + 3] = 255;
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(height * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  return Object.freeze({
    albedo: makeTexture(
      'world.material.ground-cover-leaf-albedo',
      albedoData,
      size,
      THREE.SRGBColorSpace,
    ),
    roughness: makeTexture('world.material.ground-cover-leaf-roughness', roughnessData, size),
    height: makeTexture('world.material.ground-cover-leaf-height', heightData, size),
  });
}

function injectGroundCoverWindVertex(shader, uniforms) {
  shader.uniforms.groundCoverWindTime = uniforms.time;
  shader.uniforms.groundCoverWindStrength = uniforms.strength;
  shader.uniforms.groundCoverWindVerticalStrength = uniforms.verticalStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      attribute vec2 groundCoverFlex;
      uniform float groundCoverWindTime;
      uniform float groundCoverWindStrength;
      uniform float groundCoverWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float groundCoverWindAnchor = smoothstep(0.0, 1.0, groundCoverFlex.y);
      #ifdef USE_INSTANCING
        float groundCoverInstanceSeed = fract(sin(dot(
          instanceMatrix[3].xz,
          vec2(12.9898, 78.233)
        )) * 43758.5453);
        float groundCoverLeafSeed = fract(
          groundCoverInstanceSeed * 0.754877666
          + max(groundCoverFlex.x, 0.0) * 0.569840296
        );
        float groundCoverStaticAnchor = smoothstep(0.0, 0.55, groundCoverFlex.y);
        float groundCoverYaw = (groundCoverLeafSeed - 0.5)
          * ${(GROUND_COVER_ARCHITECTURE_PROFILE.instanceYawVariationRadians * 2).toFixed(3)}
          * groundCoverStaticAnchor;
        mat2 groundCoverYawRotation = mat2(
          cos(groundCoverYaw), -sin(groundCoverYaw),
          sin(groundCoverYaw), cos(groundCoverYaw)
        );
        transformed.xz = groundCoverYawRotation * transformed.xz;
        float groundCoverRadialScale = 1.0 + (groundCoverLeafSeed - 0.5)
          * ${(GROUND_COVER_ARCHITECTURE_PROFILE.instanceRadialVariation * 2).toFixed(3)}
          * groundCoverStaticAnchor;
        transformed.xz *= groundCoverRadialScale;
        transformed.y += (groundCoverLeafSeed - 0.5)
          * ${(GROUND_COVER_ARCHITECTURE_PROFILE.instanceVerticalVariationMeters * 2).toFixed(3)}
          * groundCoverStaticAnchor;
      #endif
      vec4 groundCoverWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      mat3 groundCoverWindBasis = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        groundCoverWindWorldPoint = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        groundCoverWindBasis = mat3(modelMatrix) * mat3(instanceMatrix);
      #endif
      vec3 groundCoverWindWorldDirection = normalize(vec3(
        ${GROUND_COVER_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      vec3 groundCoverWindLocalDirection = normalize(vec3(
        dot(groundCoverWindBasis[0], groundCoverWindWorldDirection),
        dot(groundCoverWindBasis[1], groundCoverWindWorldDirection),
        dot(groundCoverWindBasis[2], groundCoverWindWorldDirection)
      ));
      float groundCoverWindMacro = sin(
        groundCoverWindTime * ${GROUND_COVER_WIND_PROFILE.macroFrequencyHz.toFixed(2)}
        + dot(groundCoverWindWorldPoint.xz, vec2(0.067, 0.051))
      );
      float groundCoverWindFlutter = sin(
        groundCoverWindTime * ${GROUND_COVER_WIND_PROFILE.flutterFrequencyHz.toFixed(2)}
        + dot(groundCoverWindWorldPoint.xz, vec2(-0.119, 0.093))
      );
      float groundCoverWindResponse = groundCoverWindAnchor
        * (groundCoverWindMacro * 0.76 + groundCoverWindFlutter * 0.24);
      transformed += groundCoverWindLocalDirection
        * groundCoverWindResponse
        * groundCoverWindStrength;
      transformed.y += groundCoverWindAnchor
        * groundCoverWindFlutter
        * groundCoverWindVerticalStrength;
    `);
}

function addThinLeafTransmission(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_begin>',
    `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
  vec3 groundCoverSurfaceNormal = normalize( geometryNormal );
  vec3 groundCoverSunDirection = normalize( directionalLights[ 0 ].direction );
  float groundCoverLightSide = dot( groundCoverSurfaceNormal, groundCoverSunDirection );
  float groundCoverViewSide = dot( groundCoverSurfaceNormal, geometryViewDir );
  float groundCoverOppositeSides = saturate( - groundCoverLightSide * groundCoverViewSide );
  float groundCoverIncidence = max( abs( groundCoverLightSide ), 0.25 );
  vec3 groundCoverAbsorption = vec3( 1.78, 0.72, 2.34 );
  vec3 groundCoverTransmittance = exp(
    - groundCoverAbsorption * 0.64 / groundCoverIncidence
  );
  float groundCoverShadowVisibility = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow groundCoverTransmissionShadow = directionalLightShadows[ 0 ];
    groundCoverShadowVisibility = receiveShadow ? getShadow(
      directionalShadowMap[ 0 ],
      groundCoverTransmissionShadow.shadowMapSize,
      groundCoverTransmissionShadow.shadowIntensity,
      groundCoverTransmissionShadow.shadowBias,
      groundCoverTransmissionShadow.shadowRadius,
      vDirectionalShadowCoord[ 0 ]
    ) : 1.0;
  #endif
  reflectedLight.directDiffuse += directionalLights[ 0 ].color
    * material.diffuseContribution
    * groundCoverTransmittance
    * pow( groundCoverOppositeSides, 0.5 )
    * groundCoverShadowVisibility
    * RECIPROCAL_PI
    * 0.22;
#endif`,
  );
}

function createGroundCoverMaterials() {
  const textures = createGroundCoverSurfaceTextures();
  const windUniforms = Object.freeze({
    time: { value: 0 },
    strength: { value: GROUND_COVER_WIND_PROFILE.horizontalTipDisplacementMeters },
    verticalStrength: { value: GROUND_COVER_WIND_PROFILE.verticalTipDisplacementMeters },
  });
  const structure = new THREE.MeshStandardMaterial({
    color: VEGETATION_BASE_COLOURS.groundCoverStructure,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.12,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: VEGETATION_BASE_COLOURS.groundCoverLeaf,
    vertexColors: true,
    map: textures.albedo,
    roughness: 0.9,
    roughnessMap: textures.roughness,
    bumpMap: textures.height,
    bumpScale: 0.012,
    metalness: 0,
    envMapIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  for (const [role, material] of [['structure', structure], ['leaf', leaf]]) {
    material.onBeforeCompile = (shader) => {
      injectGroundCoverWindVertex(shader, windUniforms);
      if (role === 'leaf') addThinLeafTransmission(shader);
    };
    material.customProgramCacheKey = () => `ground-cover-library-v3-${role}-shared-architecture-wind`;
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.dithering = true;
    material.userData = {
      surface: role === 'leaf'
        ? 'attached-cambered-ground-cover-leaves-correlated-albedo-roughness-height'
        : 'subgrade-rhizome-crown-and-emergent-petiole-load-bearing-structure',
      energyModel: role === 'leaf'
        ? 'shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric'
        : 'non-emissive-dielectric-plant-structure',
      family: `original-ground-cover-${role}`,
      windModel: GROUND_COVER_WIND_PROFILE,
      windUniforms,
      textureChannels: role === 'leaf' ? textures : null,
      albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
      architectureProfile: GROUND_COVER_ARCHITECTURE_PROFILE,
    };
  }
  return Object.freeze({ structure, leaf, textures, windUniforms });
}

function createGroundCoverDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sourceMaterial.map,
    side: sourceMaterial.side,
  });
  const uniforms = sourceMaterial.userData.windUniforms;
  material.onBeforeCompile = (shader) => injectGroundCoverWindVertex(shader, uniforms);
  material.customProgramCacheKey = () => (
    `ground-cover-library-depth-v3-${sourceMaterial.userData.family}`
  );
  material.userData.windUniforms = uniforms;
  return material;
}

function extractVariants(template) {
  const groups = [];
  template.traverse((object) => {
    if (Number.isInteger(object.userData.variantIndex)) groups.push(object);
  });
  return groups
    .sort((a, b) => a.userData.variantIndex - b.userData.variantIndex)
    .map((group) => {
      const meshes = [];
      group.traverse((object) => {
        if (object.isMesh) meshes.push(object);
      });
      const structure = meshes.find(
        (mesh) => mesh.name === 'ground-cover-load-bearing-structure',
      );
      const leaves = meshes.find((mesh) => mesh.name === 'ground-cover-attached-leaves');
      if (!structure || !leaves) {
        throw new Error(`Ground-cover variant ${group.userData.variantId} is missing its load path`);
      }
      return Object.freeze({
        id: group.userData.variantId,
        structure: structure.geometry,
        leaves: leaves.geometry,
      });
    });
}

export function classifyGroundCoverHabitat(placement, { terrainGradient }) {
  const gradient = terrainGradient(placement.x, placement.z);
  const slope = Math.hypot(gradient.x, gradient.z);
  let variantIndex;
  let niche;
  if (placement.microclimate === 'brook-bank-moisture') {
    variantIndex = placement.index % 3 === 2 ? 2 : 0;
    niche = variantIndex === 0 ? 'brook-margin-arrowhead' : 'brook-margin-sedge';
  } else if (slope >= 0.08 || placement.index % 4 === 0) {
    variantIndex = 2;
    niche = 'drained-slope-sedge';
  } else {
    variantIndex = 1;
    niche = 'canopy-shade-rosette';
  }
  return Object.freeze({ variantIndex, niche, slope });
}

function supportPoints(geometry) {
  const positions = geometry.getAttribute('position');
  const points = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) <= GROUND_COVER_LIBRARY_ASSET.supportPlaneY + 0.002) {
      points.push(new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      ));
    }
  }
  return points;
}

function transformedVariantSize(variant, matrix) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  const instanceSeed = ((Math.sin(
    matrix.elements[12] * 12.9898 + matrix.elements[14] * 78.233,
  ) * 43758.5453) % 1 + 1) % 1;
  for (const geometry of [variant.structure, variant.leaves]) {
    const positions = geometry.getAttribute('position');
    const flex = geometry.getAttribute('uv1');
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index);
      if (flex) {
        const leafPhase = Math.max(flex.getX(index), 0);
        const leafSeed = ((
          instanceSeed * 0.754877666 + leafPhase * 0.569840296
        ) % 1 + 1) % 1;
        const anchor = THREE.MathUtils.smoothstep(flex.getY(index), 0, 0.55);
        const yaw = (leafSeed - 0.5)
          * GROUND_COVER_ARCHITECTURE_PROFILE.instanceYawVariationRadians * 2
          * anchor;
        const cosine = Math.cos(yaw);
        const sine = Math.sin(yaw);
        const x = point.x;
        const z = point.z;
        const radialScale = 1 + (leafSeed - 0.5)
          * GROUND_COVER_ARCHITECTURE_PROFILE.instanceRadialVariation * 2
          * anchor;
        point.x = (x * cosine - z * sine) * radialScale;
        point.z = (x * sine + z * cosine) * radialScale;
        point.y += (leafSeed - 0.5)
          * GROUND_COVER_ARCHITECTURE_PROFILE.instanceVerticalVariationMeters * 2
          * anchor;
      }
      point.applyMatrix4(matrix);
      bounds.expandByPoint(point);
    }
  }
  return bounds.getSize(new THREE.Vector3());
}

function instanceMatrix(placement, geometry, terrainHeight, terrainGradient, variantIndex) {
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    placement.rotation,
  );
  const physicalScale = GROUND_COVER_DIMENSION_PROFILE[variantIndex].scale;
  const scale = new THREE.Vector3(...placement.instanceScale).multiplyScalar(physicalScale);
  const localSupport = supportPoints(geometry);
  if (localSupport.length === 0) throw new Error('Ground-cover structure has no support vertices');

  function settleAt(x, z) {
    const gradient = terrainGradient(x, z);
    const normal = new THREE.Vector3(-gradient.x, 1, -gradient.z).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal,
    );
    const quaternion = tilt.multiply(yaw);
    const position = new THREE.Vector3(x, 0, z);
    const matrix = new THREE.Matrix4().compose(position, quaternion, scale);
    const requiredY = localSupport.map((point) => {
      const world = point.clone().applyMatrix4(matrix);
      return terrainHeight(world.x, world.z) - world.y;
    });
    position.y = requiredY.reduce((sum, value) => sum + value, 0) / requiredY.length
      - BURIAL_DEPTH;
    matrix.compose(position, quaternion, scale);
    const clearances = localSupport.map((point) => {
      const world = point.clone().applyMatrix4(matrix);
      return world.y - terrainHeight(world.x, world.z);
    });
    const minimumAdjustment = SUPPORT_CLEARANCE_RANGE[0] - Math.min(...clearances);
    const maximumAdjustment = SUPPORT_CLEARANCE_RANGE[1] - Math.max(...clearances);
    if (minimumAdjustment > maximumAdjustment) return null;
    const adjustment = Math.max(
      minimumAdjustment + 0.00001,
      Math.min(0, maximumAdjustment - 0.00001),
    );
    position.y += adjustment;
    matrix.compose(position, quaternion, scale);
    return Object.freeze({ matrix });
  }

  // An analytic escarpment can put a generated point exactly across a sharp
  // break. A plant cannot bridge that unsupported crease, so try the smallest
  // deterministic move onto adjacent continuous soil instead of enlarging the
  // allowed clearance or pretending the root crown can float.
  const candidates = [{ x: placement.x, z: placement.z }];
  for (const distance of [0.12, 0.24, 0.36, 0.48]) {
    for (let step = 0; step < 12; step += 1) {
      const angle = (step / 12) * Math.PI * 2 + placement.index * 0.37;
      candidates.push({
        x: placement.x + Math.cos(angle) * distance,
        z: placement.z + Math.sin(angle) * distance,
      });
    }
  }
  for (const candidate of candidates) {
    const settled = settleAt(candidate.x, candidate.z);
    if (settled) return settled;
  }
  throw new Error(
    `Ground-cover root crown cannot find continuous soil within 0.48m at placement ${placement.index}`,
  );
}

export function attachGroundCoverLibraryVisual(anchor, template, placements, {
  terrainHeight,
  terrainGradient,
} = {}) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  if (!terrainHeight || !terrainGradient) {
    throw new Error('Ground-cover placement requires terrain height and gradient functions');
  }
  const variants = extractVariants(template);
  if (variants.length !== GROUND_COVER_LIBRARY_ASSET.variantCount) {
    throw new Error(`Expected 3 ground-cover variants, received ${variants.length}`);
  }
  const classified = placements.map((placement) => ({
    placement,
    habitat: classifyGroundCoverHabitat(placement, { terrainGradient }),
  }));
  const counts = GROUND_COVER_LIBRARY_ASSET.variantIds.map((_, variantIndex) => (
    classified.filter(({ habitat }) => habitat.variantIndex === variantIndex).length
  ));
  const materials = createGroundCoverMaterials();
  const group = new THREE.Group();
  group.name = 'world.environment-density.ground-cover.original-library';
  const instancedByVariant = variants.map((variant, variantIndex) => {
    const geometries = [variant.structure, variant.leaves].map((source) => {
      const geometry = source.clone();
      const flex = geometry.getAttribute('uv1');
      if (!flex) throw new Error(`${variant.id} is missing independent flex coordinates`);
      geometry.setAttribute('groundCoverFlex', flex);
      return geometry;
    });
    return geometries.map((geometry, roleIndex) => {
      const material = roleIndex === 0 ? materials.structure : materials.leaf;
      const mesh = new THREE.InstancedMesh(geometry, material, counts[variantIndex]);
      mesh.name = `world.environment-density.ground-cover.${variant.id}.${roleIndex === 0 ? 'structure' : 'leaves'}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = createGroundCoverDepthMaterial(material);
      mesh.userData.variantId = variant.id;
      mesh.userData.role = roleIndex === 0 ? 'load-bearing-structure' : 'attached-leaves';
      group.add(mesh);
      return mesh;
    });
  });
  const instanceIndices = counts.map(() => 0);
  const leafTint = new THREE.Color();
  const structureTint = new THREE.Color();
  classified.forEach(({ placement, habitat }) => {
    const { variantIndex } = habitat;
    const index = instanceIndices[variantIndex];
    const dimensionProfile = GROUND_COVER_DIMENSION_PROFILE[variantIndex];
    let fittedPlacement = placement;
    let evidence = instanceMatrix(
      placement,
      variants[variantIndex].structure,
      terrainHeight,
      terrainGradient,
      variantIndex,
    );
    let worldSize = transformedVariantSize(variants[variantIndex], evidence.matrix);
    const initialDiameter = Math.max(worldSize.x, worldSize.z);
    const envelopeScale = Math.min(
      1,
      dimensionProfile.maxDiameterMeters / initialDiameter,
      dimensionProfile.maxHeightMeters / worldSize.y,
    );
    if (envelopeScale < 1) {
      const boundedScale = envelopeScale * 0.9995;
      fittedPlacement = {
        ...placement,
        instanceScale: placement.instanceScale.map((value) => value * boundedScale),
      };
      evidence = instanceMatrix(
        fittedPlacement,
        variants[variantIndex].structure,
        terrainHeight,
        terrainGradient,
        variantIndex,
      );
      worldSize = transformedVariantSize(variants[variantIndex], evidence.matrix);
    }
    const individual = THREE.MathUtils.clamp(placement.color[2], 0, 1);
    const habitatWetness = habitat.niche.startsWith('brook-margin')
      ? 0.34
      : habitat.niche === 'canopy-shade-rosette' ? 0.13 : 0.045;
    const leafAlbedo = vegetationLeafTint([
      'ground-cover-arrowhead',
      'ground-cover-rosette',
      'ground-cover-sedge',
    ][variantIndex], {
      wetness: habitatWetness,
      slope: habitat.slope,
      individual,
    });
    leafTint.setHSL(leafAlbedo.hue, leafAlbedo.saturation, leafAlbedo.lightness);
    const structureAlbedo = vegetationStructureTint({
      hue: 0.27,
      wetness: habitatWetness,
      individual,
      baseLightness: 0.58,
    });
    structureTint.setHSL(
      structureAlbedo.hue,
      structureAlbedo.saturation,
      structureAlbedo.lightness,
    );
    instancedByVariant[variantIndex].forEach((mesh) => {
      mesh.setMatrixAt(index, evidence.matrix);
      mesh.setColorAt(
        index,
        mesh.userData.role === 'load-bearing-structure' ? structureTint : leafTint,
      );
    });
    instanceIndices[variantIndex] += 1;
  });
  instancedByVariant.flat().forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  group.userData = {
    instanceCount: placements.length,
    materials,
  };
  anchor.add(group);
  anchor.userData.assetVisual = group;
  (anchor.userData.fallbackMeshes ?? []).forEach((mesh) => { mesh.visible = false; });
  return group;
}

export function updateGroundCoverLibraryWind(anchor, elapsed, reducedMotion = false) {
  const materials = anchor.userData.assetVisual?.userData.materials;
  if (!materials) return;
  materials.windUniforms.time.value = reducedMotion ? 0 : elapsed;
  materials.windUniforms.strength.value = reducedMotion
    ? 0
    : GROUND_COVER_WIND_PROFILE.horizontalTipDisplacementMeters;
  materials.windUniforms.verticalStrength.value = reducedMotion
    ? 0
    : GROUND_COVER_WIND_PROFILE.verticalTipDisplacementMeters;
}
