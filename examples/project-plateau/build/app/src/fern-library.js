import * as THREE from 'three';

import {
  VEGETATION_ALBEDO_PROFILE,
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from './vegetation-albedo.js';

export const FERN_LIBRARY_ASSET = Object.freeze({
  url: '/assets/fern-library-original-v1.glb',
  version: 'original-fern-library-v1',
  bytes: 551_328,
  triangles: 6_594,
  trianglesByVariant: Object.freeze([2_094, 2_160, 2_340]),
  drawCalls: 6,
  drawCallsPerVariant: 2,
  variantCount: 3,
  variantIds: Object.freeze([
    'brook-arch-fern',
    'upland-feather-fern',
    'low-cycad-fern',
  ]),
  supportPlaneY: -0.12,
  sha256: '15fb84b00565da300a8a0b2a50769eb787bc27cf15cb5d028cdf3a4b765ea2f3',
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  generator: 'app/scripts/generate-fern-library.mjs',
  rights: 'project-original-code-authored-output',
  supportModel: 'buried-rhizome-to-closed-rachis-to-attached-pinnate-leaflets',
  collisionRole: 'non-solid-pliable-understory',
});

export const FERN_WIND_PROFILE = Object.freeze({
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.105,
  verticalTipDisplacementMeters: 0.024,
  macroFrequencyHz: 0.74,
  flutterFrequencyHz: 2.05,
  flexAttribute: 'uv1-y',
  supportModel: 'buried-rhizome-fixed-rachis-and-leaflets-progressively-flexible',
  shadowModel: 'identical-colour-and-depth-pass-displacement-function-and-uniforms',
});

const FERN_BURIAL_DEPTH = 0.03;
const SUPPORT_CLEARANCE_RANGE = Object.freeze([-0.055, 0.018]);

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.86, 0.86);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.34);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.dithering = true;
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.fern-library.template';
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
  template.userData.provenance = FERN_LIBRARY_ASSET.provenance;
  template.userData.supportModel = FERN_LIBRARY_ASSET.supportModel;
  return template;
}

export function createCachedFernLibraryLoader({
  assetUrl = FERN_LIBRARY_ASSET.url,
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

export const loadFernLibraryTemplate = createCachedFernLibraryLoader();

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
  texture.userData.source = 'deterministic-original-code-authored-correlated-leaf-surface';
  texture.needsUpdate = true;
  return texture;
}

export function createFernSurfaceTextures(size = 64) {
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const midrib = Math.exp(-((u - 0.5) ** 2) / 0.0028);
      const sideVeins = Math.max(0, Math.sin((v * 9.5 + Math.abs(u - 0.5) * 5.2) * Math.PI));
      const cellular = Math.sin((u * 13.1 + v * 7.7) * Math.PI * 2) * 0.025
        + Math.sin((u * 5.3 - v * 11.2) * Math.PI * 2) * 0.018;
      const surface = THREE.MathUtils.clamp(
        0.78 + midrib * 0.13 + sideVeins * 0.035 + cellular,
        0.68,
        0.96,
      );
      const roughness = THREE.MathUtils.clamp(
        0.94 - midrib * 0.08 - sideVeins * 0.025 - cellular * 0.35,
        0.83,
        0.98,
      );
      const height = THREE.MathUtils.clamp(
        0.43 + midrib * 0.43 + sideVeins * 0.17 + cellular,
        0.2,
        1,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(surface * 0.9 * 255);
      albedoData[offset + 1] = Math.round(surface * 0.98 * 255);
      albedoData[offset + 2] = Math.round(surface * 0.84 * 255);
      albedoData[offset + 3] = 255;
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(height * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  return Object.freeze({
    albedo: makeTexture('world.material.fern-leaf-albedo', albedoData, size, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.fern-leaf-roughness', roughnessData, size),
    height: makeTexture('world.material.fern-leaf-height', heightData, size),
  });
}

function injectFernWindVertex(shader, uniforms) {
  shader.uniforms.fernWindTime = uniforms.time;
  shader.uniforms.fernWindStrength = uniforms.strength;
  shader.uniforms.fernWindVerticalStrength = uniforms.verticalStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      attribute vec2 fernFlex;
      uniform float fernWindTime;
      uniform float fernWindStrength;
      uniform float fernWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float fernWindAnchor = smoothstep(0.0, 1.0, fernFlex.y);
      vec4 fernWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      mat3 fernWindBasis = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        fernWindWorldPoint = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        fernWindBasis = mat3(modelMatrix) * mat3(instanceMatrix);
      #endif
      vec3 fernWindWorldDirection = normalize(vec3(
        ${FERN_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      vec3 fernWindLocalDirection = normalize(vec3(
        dot(fernWindBasis[0], fernWindWorldDirection),
        dot(fernWindBasis[1], fernWindWorldDirection),
        dot(fernWindBasis[2], fernWindWorldDirection)
      ));
      float fernWindMacro = sin(
        fernWindTime * ${FERN_WIND_PROFILE.macroFrequencyHz.toFixed(2)}
        + dot(fernWindWorldPoint.xz, vec2(0.061, 0.047))
      );
      float fernWindFlutter = sin(
        fernWindTime * ${FERN_WIND_PROFILE.flutterFrequencyHz.toFixed(2)}
        + dot(fernWindWorldPoint.xz, vec2(-0.103, 0.081))
      );
      float fernWindResponse = fernWindAnchor
        * (fernWindMacro * 0.82 + fernWindFlutter * 0.18);
      transformed += fernWindLocalDirection * fernWindResponse * fernWindStrength;
      transformed.y += fernWindAnchor * fernWindFlutter * fernWindVerticalStrength;
    `);
}

function addThinLeafTransmission(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_begin>',
    `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
  vec3 fernSurfaceNormal = normalize( geometryNormal );
  vec3 fernSunDirection = normalize( directionalLights[ 0 ].direction );
  float fernLightSide = dot( fernSurfaceNormal, fernSunDirection );
  float fernViewSide = dot( fernSurfaceNormal, geometryViewDir );
  float fernOppositeSides = saturate( - fernLightSide * fernViewSide );
  float fernIncidence = max( abs( fernLightSide ), 0.24 );
  vec3 fernAbsorption = vec3( 1.72, 0.7, 2.28 );
  vec3 fernTransmittance = exp( - fernAbsorption * 0.62 / fernIncidence );
  float fernShadowVisibility = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow fernTransmissionShadow = directionalLightShadows[ 0 ];
    fernShadowVisibility = receiveShadow ? getShadow(
      directionalShadowMap[ 0 ],
      fernTransmissionShadow.shadowMapSize,
      fernTransmissionShadow.shadowIntensity,
      fernTransmissionShadow.shadowBias,
      fernTransmissionShadow.shadowRadius,
      vDirectionalShadowCoord[ 0 ]
    ) : 1.0;
  #endif
  reflectedLight.directDiffuse += directionalLights[ 0 ].color
    * material.diffuseContribution
    * fernTransmittance
    * pow( fernOppositeSides, 0.48 )
    * fernShadowVisibility
    * RECIPROCAL_PI
    * 0.44;
#endif`,
  );
}

function createFernMaterials() {
  const textures = createFernSurfaceTextures();
  const windUniforms = Object.freeze({
    time: { value: 0 },
    strength: { value: FERN_WIND_PROFILE.horizontalTipDisplacementMeters },
    verticalStrength: { value: FERN_WIND_PROFILE.verticalTipDisplacementMeters },
  });
  const structure = new THREE.MeshStandardMaterial({
    color: VEGETATION_BASE_COLOURS.fernStructure,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: VEGETATION_BASE_COLOURS.fernLeaf,
    vertexColors: true,
    map: textures.albedo,
    roughness: 0.91,
    roughnessMap: textures.roughness,
    bumpMap: textures.height,
    bumpScale: 0.016,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  for (const [role, material] of [['structure', structure], ['leaflet', leaf]]) {
    material.onBeforeCompile = (shader) => {
      injectFernWindVertex(shader, windUniforms);
      if (role === 'leaflet') addThinLeafTransmission(shader);
    };
    material.customProgramCacheKey = () => `fern-library-v1-${role}-shared-wind`;
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.dithering = true;
    material.userData = {
      surface: role === 'leaflet'
        ? 'pinnate-leaflet-correlated-albedo-roughness-height'
        : 'closed-rhizome-and-rachis-load-bearing-structure',
      energyModel: role === 'leaflet'
        ? 'shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric'
        : 'non-emissive-dielectric-plant-structure',
      family: `original-fern-${role}`,
      windModel: FERN_WIND_PROFILE,
      windUniforms,
      textureChannels: role === 'leaflet' ? textures : null,
      albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
    };
  }
  return Object.freeze({ structure, leaf, textures, windUniforms });
}

function createFernDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sourceMaterial.map,
    side: sourceMaterial.side,
  });
  const uniforms = sourceMaterial.userData.windUniforms;
  material.onBeforeCompile = (shader) => injectFernWindVertex(shader, uniforms);
  material.customProgramCacheKey = () => (
    `fern-library-depth-v1-${sourceMaterial.userData.family}`
  );
  material.userData.windUniforms = uniforms;
  material.userData.shadowModel = FERN_WIND_PROFILE.shadowModel;
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
      const structure = meshes.find((mesh) => mesh.name === 'fern-load-bearing-structure');
      const leaflets = meshes.find((mesh) => mesh.name === 'fern-attached-leaflets');
      if (!structure || !leaflets) {
        throw new Error(`Fern variant ${group.userData.variantId} is missing its load path`);
      }
      return Object.freeze({
        id: group.userData.variantId,
        structure: structure.geometry,
        leaflets: leaflets.geometry,
      });
    });
}

export function classifyFernHabitat(placement, { terrainGradient, terrainWetness }) {
  const gradient = terrainGradient(placement.x, placement.z);
  const slope = Math.hypot(gradient.x, gradient.z);
  const wetness = terrainWetness(placement.x, placement.z);
  const variantIndex = wetness >= 0.18
    ? 0
    : slope >= 0.08 ? 1 : placement.variantIndex;
  return Object.freeze({
    variantIndex,
    slope,
    wetness,
    niche: variantIndex === 0
      ? 'humid-brook-margin'
      : variantIndex === 1 ? 'drained-upland-slope' : 'sheltered-low-understory',
  });
}

function supportPoints(geometry) {
  const positions = geometry.getAttribute('position');
  const points = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) <= FERN_LIBRARY_ASSET.supportPlaneY + 0.002) {
      points.push(new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      ));
    }
  }
  return points;
}

function transformedFernSize(variant, matrix) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const geometry of [variant.structure, variant.leaflets]) {
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
      bounds.expandByPoint(point);
    }
  }
  return bounds.getSize(new THREE.Vector3());
}

function fernInstanceMatrix(placement, geometry, terrainHeight, terrainGradient) {
  const gradient = terrainGradient(placement.x, placement.z);
  const normal = new THREE.Vector3(-gradient.x, 1, -gradient.z).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    placement.rotation,
  );
  const quaternion = tilt.multiply(yaw);
  const scale = new THREE.Vector3(...placement.instanceScale);
  const position = new THREE.Vector3(placement.x, 0, placement.z);
  const matrix = new THREE.Matrix4().compose(position, quaternion, scale);
  const localSupport = supportPoints(geometry);
  if (localSupport.length === 0) throw new Error('Fern structure has no support-plane vertices');
  const requiredY = localSupport.map((point) => {
    const world = point.clone().applyMatrix4(matrix);
    return terrainHeight(world.x, world.z) - world.y;
  });
  position.y = requiredY.reduce((sum, value) => sum + value, 0) / requiredY.length
    - FERN_BURIAL_DEPTH;
  matrix.compose(position, quaternion, scale);
  let clearances = localSupport.map((point) => {
    const world = point.clone().applyMatrix4(matrix);
    return world.y - terrainHeight(world.x, world.z);
  });
  // Terrain curvature can put opposite edges of one broad rhizome at slightly
  // different depths even after its support plane follows the local tangent.
  // Translate the whole plant only along gravity, by the smallest amount that
  // keeps every support vertex inside the physical contact band. This preserves
  // the authored slope alignment rather than rotating individual fronds or
  // widening the acceptance threshold to hide one steep placement.
  const minimumAdjustment = SUPPORT_CLEARANCE_RANGE[0] - Math.min(...clearances);
  const maximumAdjustment = SUPPORT_CLEARANCE_RANGE[1] - Math.max(...clearances);
  if (minimumAdjustment > maximumAdjustment) {
    throw new Error(`Fern support plane cannot conform to terrain at placement ${placement.index}`);
  }
  const settlementAdjustment = Math.max(
    minimumAdjustment + 0.00001,
    Math.min(0, maximumAdjustment - 0.00001),
  );
  position.y += settlementAdjustment;
  matrix.compose(position, quaternion, scale);
  clearances = localSupport.map((point) => {
    const world = point.clone().applyMatrix4(matrix);
    return world.y - terrainHeight(world.x, world.z);
  });
  const supportedVertexCount = clearances.filter((clearance) => (
    clearance >= SUPPORT_CLEARANCE_RANGE[0]
      && clearance <= SUPPORT_CLEARANCE_RANGE[1]
  )).length;
  return Object.freeze({
    matrix,
    normal: normal.toArray(),
    supportVertexCount: localSupport.length,
    supportedVertexCount,
    supportRatio: supportedVertexCount / localSupport.length,
    minimumClearance: Math.min(...clearances),
    maximumClearance: Math.max(...clearances),
  });
}

export function attachFernLibraryVisual(anchor, template, placements, {
  terrainHeight,
  terrainGradient,
  terrainWetness,
} = {}) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  if (!terrainHeight || !terrainGradient || !terrainWetness) {
    throw new Error('Fern placement requires terrain height, gradient, and wetness functions');
  }
  const variants = extractVariants(template);
  if (variants.length !== FERN_LIBRARY_ASSET.variantCount) {
    throw new Error(`Expected ${FERN_LIBRARY_ASSET.variantCount} fern variants, received ${variants.length}`);
  }
  const classified = placements.map((placement) => ({
    placement,
    habitat: classifyFernHabitat(placement, { terrainGradient, terrainWetness }),
  }));
  const counts = FERN_LIBRARY_ASSET.variantIds.map((_, variantIndex) => (
    classified.filter(({ habitat }) => habitat.variantIndex === variantIndex).length
  ));
  const materials = createFernMaterials();
  const group = new THREE.Group();
  group.name = 'world.connected_route.ferns.original-library';
  const instancedByVariant = variants.map((variant, variantIndex) => {
    const geometries = [variant.structure, variant.leaflets].map((source) => {
      const geometry = source.clone();
      const flex = geometry.getAttribute('uv1');
      if (!flex) throw new Error(`${variant.id} is missing independent flex coordinates`);
      geometry.setAttribute('fernFlex', flex);
      return geometry;
    });
    const meshes = geometries.map((geometry, roleIndex) => {
      const material = roleIndex === 0 ? materials.structure : materials.leaf;
      const mesh = new THREE.InstancedMesh(geometry, material, counts[variantIndex]);
      mesh.name = `world.connected_route.ferns.${variant.id}.${roleIndex === 0 ? 'structure' : 'leaflets'}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = createFernDepthMaterial(material);
      mesh.userData.variantId = variant.id;
      mesh.userData.role = roleIndex === 0 ? 'load-bearing-structure' : 'attached-leaflets';
      mesh.userData.collisionRole = FERN_LIBRARY_ASSET.collisionRole;
      mesh.userData.supportModel = FERN_LIBRARY_ASSET.supportModel;
      group.add(mesh);
      return mesh;
    });
    return meshes;
  });
  const instanceIndices = counts.map(() => 0);
  const supportEvidence = [];
  const habitatCounts = {
    'humid-brook-margin': 0,
    'drained-upland-slope': 0,
    'sheltered-low-understory': 0,
  };
  const leafTint = new THREE.Color();
  const structureTint = new THREE.Color();
  classified.forEach(({ placement, habitat }) => {
    const { variantIndex } = habitat;
    const instanceIndex = instanceIndices[variantIndex];
    let fittedPlacement = placement;
    let evidence = fernInstanceMatrix(
      placement,
      variants[variantIndex].structure,
      terrainHeight,
      terrainGradient,
    );
    let worldSize = transformedFernSize(variants[variantIndex], evidence.matrix);
    const initialDiameter = Math.max(worldSize.x, worldSize.z);
    const envelopeScale = Math.min(
      1,
      placement.maxDiameterMeters === undefined
        ? 1
        : placement.maxDiameterMeters / initialDiameter,
      placement.maxHeightMeters === undefined
        ? 1
        : placement.maxHeightMeters / worldSize.y,
    );
    if (envelopeScale < 1) {
      fittedPlacement = {
        ...placement,
        instanceScale: placement.instanceScale.map((value) => value * envelopeScale),
      };
      evidence = fernInstanceMatrix(
        fittedPlacement,
        variants[variantIndex].structure,
        terrainHeight,
        terrainGradient,
      );
      worldSize = transformedFernSize(variants[variantIndex], evidence.matrix);
    }
    const individual = THREE.MathUtils.clamp(placement.color[2], 0, 1);
    const leafAlbedo = vegetationLeafTint([
      'fern-humid',
      'fern-upland',
      'fern-sheltered',
    ][variantIndex], {
      wetness: habitat.wetness,
      slope: habitat.slope,
      individual,
    });
    leafTint.setHSL(leafAlbedo.hue, leafAlbedo.saturation, leafAlbedo.lightness);
    const structureAlbedo = vegetationStructureTint({
      hue: 0.1,
      wetness: habitat.wetness,
      individual,
      baseLightness: 0.65,
    });
    structureTint.setHSL(
      structureAlbedo.hue,
      structureAlbedo.saturation,
      structureAlbedo.lightness,
    );
    instancedByVariant[variantIndex].forEach((mesh) => {
      mesh.setMatrixAt(instanceIndex, evidence.matrix);
      mesh.setColorAt(
        instanceIndex,
        mesh.userData.role === 'load-bearing-structure' ? structureTint : leafTint,
      );
    });
    supportEvidence.push(Object.freeze({
      index: placement.index,
      variantId: variants[variantIndex].id,
      niche: habitat.niche,
      slope: habitat.slope,
      wetness: habitat.wetness,
      sourceRole: placement.sourceRole ?? 'primary-understory',
      diameter: Math.max(worldSize.x, worldSize.z),
      height: worldSize.y,
      maxDiameterMeters: placement.maxDiameterMeters ?? null,
      maxHeightMeters: placement.maxHeightMeters ?? null,
      matureEnvelopeScaleFactor: envelopeScale,
      dimensionEnvelopePass: (
        placement.maxDiameterMeters === undefined
        || Math.max(worldSize.x, worldSize.z) <= placement.maxDiameterMeters
      ) && (
        placement.maxHeightMeters === undefined
        || worldSize.y <= placement.maxHeightMeters
      ),
      ...evidence,
    }));
    habitatCounts[habitat.niche] += 1;
    instanceIndices[variantIndex] += 1;
  });
  instancedByVariant.flat().forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  const supportedVertexCount = supportEvidence.reduce(
    (sum, evidence) => sum + evidence.supportedVertexCount,
    0,
  );
  const supportVertexCount = supportEvidence.reduce(
    (sum, evidence) => sum + evidence.supportVertexCount,
    0,
  );
  const dimensionSummary = Object.freeze(Object.fromEntries(
    [...new Set(supportEvidence.map((evidence) => evidence.sourceRole))].map((sourceRole) => {
      const matching = supportEvidence.filter((evidence) => evidence.sourceRole === sourceRole);
      return [sourceRole, Object.freeze({
        instanceCount: matching.length,
        maximumDiameterMeters: Math.max(...matching.map((evidence) => evidence.diameter)),
        maximumHeightMeters: Math.max(...matching.map((evidence) => evidence.height)),
        maxDiameterMeters: matching[0].maxDiameterMeters,
        maxHeightMeters: matching[0].maxHeightMeters,
        envelopePassCount: matching.filter(
          (evidence) => evidence.dimensionEnvelopePass,
        ).length,
      })];
    }),
  ));
  group.userData = {
    assetVersion: FERN_LIBRARY_ASSET.version,
    supportModel: FERN_LIBRARY_ASSET.supportModel,
    collisionRole: FERN_LIBRARY_ASSET.collisionRole,
    energyModel: 'non-emissive-dielectric-plant-surfaces',
    albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
    instanceCount: placements.length,
    drawCalls: FERN_LIBRARY_ASSET.drawCalls,
    counts,
    habitatCounts,
    supportEvidence,
    dimensionSummary,
    supportSummary: Object.freeze({
      supportVertexCount,
      supportedVertexCount,
      supportRatio: supportedVertexCount / supportVertexCount,
      minimumClearance: Math.min(...supportEvidence.map((evidence) => evidence.minimumClearance)),
      maximumClearance: Math.max(...supportEvidence.map((evidence) => evidence.maximumClearance)),
      burialDepth: FERN_BURIAL_DEPTH,
      clearanceRange: [...SUPPORT_CLEARANCE_RANGE],
    }),
    materials,
  };
  anchor.add(group);
  anchor.userData.assetVisual = group;
  anchor.userData.visualSource = FERN_LIBRARY_ASSET.version;
  anchor.userData.supportEvidence = group.userData.supportSummary;
  const fallbackMeshes = anchor.userData.fallbackMeshes ?? [];
  fallbackMeshes.forEach((mesh) => { mesh.visible = false; });
  return group;
}

export function updateFernLibraryWind(anchor, elapsed, reducedMotion = false) {
  const materials = anchor.userData.assetVisual?.userData.materials;
  if (!materials) return;
  materials.windUniforms.time.value = reducedMotion ? 0 : elapsed;
  materials.windUniforms.strength.value = reducedMotion
    ? 0
    : FERN_WIND_PROFILE.horizontalTipDisplacementMeters;
  materials.windUniforms.verticalStrength.value = reducedMotion
    ? 0
    : FERN_WIND_PROFILE.verticalTipDisplacementMeters;
}
