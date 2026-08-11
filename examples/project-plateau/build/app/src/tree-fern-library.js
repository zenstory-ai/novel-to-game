import * as THREE from 'three';

import {
  VEGETATION_ALBEDO_PROFILE,
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from './vegetation-albedo.js';

export const TREE_FERN_LIBRARY_ASSET = Object.freeze({
  url: '/assets/tree-fern-library-original-v1.glb',
  version: 'original-tree-fern-library-v1',
  bytes: 883_332,
  triangles: 19_788,
  trianglesByVariant: Object.freeze([6_652, 5_872, 7_264]),
  drawCalls: 9,
  drawCallsPerVariant: 3,
  variantCount: 3,
  variantIds: Object.freeze([
    'humid-arch-tree-fern',
    'storm-swept-tree-fern',
    'sheltered-tier-tree-fern',
  ]),
  frondCounts: Object.freeze([15, 12, 18]),
  supportPlaneY: -0.18,
  sha256: '23b8f4f2ccac9797bd0a00038962dd30b01c935d465543b22ca4813db0bd9b6e',
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  generator: 'app/scripts/generate-tree-fern-library.mjs',
  rights: 'project-original-code-authored-output',
  supportModel: 'buried-root-flare-to-fibrous-trunk-to-closed-rachis-to-attached-leaflet',
  collisionRole: 'solid-fibrous-trunk-with-non-solid-pliable-fronds-and-sub-step-roots',
  growthModel: 'gravitropic-vertical-trunk-with-gravity-settled-root-mantle',
  matureEnvelope: Object.freeze({
    maximumCrownDiameterMeters: 6.15,
    maximumHeightMeters: 6.15,
  }),
});

export const TREE_FERN_WIND_PROFILE = Object.freeze({
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.165,
  verticalTipDisplacementMeters: 0.034,
  macroFrequencyHz: 0.58,
  flutterFrequencyHz: 1.72,
  flexAttribute: 'uv1-y',
  supportModel: 'fixed-root-and-trunk-with-progressively-flexible-rachises-and-leaflets',
  shadowModel: 'identical-colour-and-depth-pass-displacement-function-and-uniforms',
});

const ROOT_BURIAL_DEPTH = 0.018;
const SUPPORT_CONTACT_CEILING = TREE_FERN_LIBRARY_ASSET.supportPlaneY + 0.031;
const SUPPORT_CLEARANCE_RANGE = Object.freeze([-0.24, 0]);

function prepareMaterial(material) {
  if (!material) return material;
  const prepared = material.clone();
  prepared.metalness = 0;
  prepared.roughness = Math.max(prepared.roughness ?? 0.9, 0.9);
  prepared.envMapIntensity = Math.min(prepared.envMapIntensity ?? 1, 0.34);
  prepared.emissive?.set(0x000000);
  prepared.emissiveIntensity = 0;
  prepared.dithering = true;
  prepared.needsUpdate = true;
  return prepared;
}

function prepareTemplate(source) {
  const template = source.clone(true);
  template.name = 'asset.original.tree-fern-library.template';
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
  template.userData.provenance = TREE_FERN_LIBRARY_ASSET.provenance;
  template.userData.supportModel = TREE_FERN_LIBRARY_ASSET.supportModel;
  return template;
}

export function createCachedTreeFernLibraryLoader({
  assetUrl = TREE_FERN_LIBRARY_ASSET.url,
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

export const loadTreeFernLibraryTemplate = createCachedTreeFernLibraryLoader();

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

function createCorrelatedTextures({
  size,
  source,
  prefix,
  repeat,
  sample,
}) {
  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const height = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue, rough, relief] = sample(
        x / (size - 1),
        y / (size - 1),
      );
      const offset = (y * size + x) * 4;
      albedo.set([
        Math.round(THREE.MathUtils.clamp(red, 0, 1) * 255),
        Math.round(THREE.MathUtils.clamp(green, 0, 1) * 255),
        Math.round(THREE.MathUtils.clamp(blue, 0, 1) * 255),
        255,
      ], offset);
      const roughnessByte = Math.round(THREE.MathUtils.clamp(rough, 0, 1) * 255);
      roughness.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(THREE.MathUtils.clamp(relief, 0, 1) * 255);
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

export function createTreeFernSurfaceTextures(size = 64) {
  const barkSource = 'deterministic-original-code-authored-correlated-tree-fern-bark';
  const leafSource = 'deterministic-original-code-authored-correlated-tree-fern-leaf';
  const bark = createCorrelatedTextures({
    size,
    source: barkSource,
    prefix: 'tree-fern-fibrous-bark',
    repeat: true,
    sample(u, v) {
      const fibres = Math.abs(Math.sin((u * 13.2 + Math.sin(v * 5.1) * 0.42) * Math.PI));
      const scars = Math.exp(-((Math.sin(v * Math.PI * 9.4)) ** 2) / 0.045);
      const cellular = Math.sin((u * 6.2 + v * 8.1) * Math.PI * 2) * 0.025;
      const value = 0.48 + fibres * 0.13 + scars * 0.09 + cellular;
      return [
        value * 0.78,
        value * 0.64,
        value * 0.48,
        0.97 - fibres * 0.055 - scars * 0.025,
        0.3 + fibres * 0.42 + scars * 0.22 + cellular,
      ];
    },
  });
  const leaf = createCorrelatedTextures({
    size,
    source: leafSource,
    prefix: 'tree-fern-leaf',
    repeat: false,
    sample(u, v) {
      const midrib = Math.exp(-((u - 0.5) ** 2) / 0.0026);
      const sideVeins = Math.max(0, Math.sin((v * 10.2 + Math.abs(u - 0.5) * 4.8) * Math.PI));
      const cellular = Math.sin((u * 12.6 + v * 7.8) * Math.PI * 2) * 0.02;
      const value = 0.72 + midrib * 0.13 + sideVeins * 0.035 + cellular;
      return [
        value * 0.74,
        value * 0.96,
        value * 0.67,
        0.95 - midrib * 0.075 - sideVeins * 0.025,
        0.34 + midrib * 0.46 + sideVeins * 0.16 + cellular,
      ];
    },
  });
  return Object.freeze({ bark, leaf });
}

function injectTreeFernWindVertex(shader, uniforms) {
  shader.uniforms.treeFernWindTime = uniforms.time;
  shader.uniforms.treeFernWindStrength = uniforms.strength;
  shader.uniforms.treeFernWindVerticalStrength = uniforms.verticalStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      attribute vec2 treeFernFlex;
      uniform float treeFernWindTime;
      uniform float treeFernWindStrength;
      uniform float treeFernWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float treeFernWindAnchor = smoothstep(0.0, 1.0, treeFernFlex.y);
      vec4 treeFernWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      mat3 treeFernWindBasis = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        treeFernWindWorldPoint = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        treeFernWindBasis = mat3(modelMatrix) * mat3(instanceMatrix);
      #endif
      vec3 treeFernWindWorldDirection = normalize(vec3(
        ${TREE_FERN_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      vec3 treeFernWindLocalDirection = normalize(vec3(
        dot(treeFernWindBasis[0], treeFernWindWorldDirection),
        dot(treeFernWindBasis[1], treeFernWindWorldDirection),
        dot(treeFernWindBasis[2], treeFernWindWorldDirection)
      ));
      float treeFernWindMacro = sin(
        treeFernWindTime * ${TREE_FERN_WIND_PROFILE.macroFrequencyHz.toFixed(2)}
        + dot(treeFernWindWorldPoint.xz, vec2(0.047, 0.039))
      );
      float treeFernWindFlutter = sin(
        treeFernWindTime * ${TREE_FERN_WIND_PROFILE.flutterFrequencyHz.toFixed(2)}
        + dot(treeFernWindWorldPoint.xz, vec2(-0.081, 0.067))
      );
      float treeFernWindResponse = treeFernWindAnchor
        * (treeFernWindMacro * 0.86 + treeFernWindFlutter * 0.14);
      transformed += treeFernWindLocalDirection * treeFernWindResponse * treeFernWindStrength;
      transformed.y += treeFernWindAnchor * treeFernWindFlutter
        * treeFernWindVerticalStrength;
    `);
}

function addThinLeafTransmission(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_begin>',
    `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
  vec3 treeFernSurfaceNormal = normalize( geometryNormal );
  vec3 treeFernSunDirection = normalize( directionalLights[ 0 ].direction );
  float treeFernLightSide = dot( treeFernSurfaceNormal, treeFernSunDirection );
  float treeFernViewSide = dot( treeFernSurfaceNormal, geometryViewDir );
  float treeFernOppositeSides = saturate( - treeFernLightSide * treeFernViewSide );
  float treeFernIncidence = max( abs( treeFernLightSide ), 0.24 );
  vec3 treeFernAbsorption = vec3( 1.82, 0.72, 2.36 );
  vec3 treeFernTransmittance = exp( - treeFernAbsorption * 0.68 / treeFernIncidence );
  float treeFernShadowVisibility = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow treeFernTransmissionShadow = directionalLightShadows[ 0 ];
    treeFernShadowVisibility = receiveShadow ? getShadow(
      directionalShadowMap[ 0 ],
      treeFernTransmissionShadow.shadowMapSize,
      treeFernTransmissionShadow.shadowIntensity,
      treeFernTransmissionShadow.shadowBias,
      treeFernTransmissionShadow.shadowRadius,
      vDirectionalShadowCoord[ 0 ]
    ) : 1.0;
  #endif
  reflectedLight.directDiffuse += directionalLights[ 0 ].color
    * material.diffuseContribution
    * treeFernTransmittance
    * pow( treeFernOppositeSides, 0.48 )
    * treeFernShadowVisibility
    * RECIPROCAL_PI
    * 0.38;
#endif`,
  );
}

function createTreeFernMaterials() {
  const textures = createTreeFernSurfaceTextures();
  const windUniforms = Object.freeze({
    time: { value: 0 },
    strength: { value: TREE_FERN_WIND_PROFILE.horizontalTipDisplacementMeters },
    verticalStrength: { value: TREE_FERN_WIND_PROFILE.verticalTipDisplacementMeters },
  });
  const rootTrunk = new THREE.MeshStandardMaterial({
    color: 0xaea79b,
    vertexColors: true,
    map: textures.bark.albedo,
    roughness: 0.96,
    roughnessMap: textures.bark.roughness,
    bumpMap: textures.bark.height,
    bumpScale: 0.022,
    metalness: 0,
  });
  const rachis = new THREE.MeshStandardMaterial({
    color: VEGETATION_BASE_COLOURS.treeFernRachis,
    vertexColors: true,
    roughness: 0.93,
    metalness: 0,
  });
  const leaflet = new THREE.MeshStandardMaterial({
    color: VEGETATION_BASE_COLOURS.treeFernLeaf,
    vertexColors: true,
    map: textures.leaf.albedo,
    roughness: 0.92,
    roughnessMap: textures.leaf.roughness,
    bumpMap: textures.leaf.height,
    bumpScale: 0.012,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  for (const [role, material] of [
    ['root-trunk', rootTrunk],
    ['rachis', rachis],
    ['leaflet', leaflet],
  ]) {
    material.onBeforeCompile = (shader) => {
      injectTreeFernWindVertex(shader, windUniforms);
      if (role === 'leaflet') addThinLeafTransmission(shader);
    };
    material.customProgramCacheKey = () => `tree-fern-library-v1-${role}-shared-wind`;
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.dithering = true;
    material.userData = {
      family: `original-tree-fern-${role}`,
      surface: role === 'root-trunk'
        ? 'fibrous-tree-fern-trunk-correlated-albedo-roughness-height'
        : role === 'rachis'
          ? 'closed-load-bearing-rachis'
          : 'cambered-pinnate-leaflet-correlated-albedo-roughness-height',
      energyModel: role === 'leaflet'
        ? 'shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric'
        : 'non-emissive-dielectric-plant-structure',
      windModel: TREE_FERN_WIND_PROFILE,
      windUniforms,
      albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
      textureChannels: role === 'root-trunk'
        ? textures.bark
        : role === 'leaflet' ? textures.leaf : null,
    };
  }
  return Object.freeze({ rootTrunk, rachis, leaflet, textures, windUniforms });
}

function createTreeFernDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sourceMaterial.map,
    side: sourceMaterial.side,
  });
  const uniforms = sourceMaterial.userData.windUniforms;
  material.onBeforeCompile = (shader) => injectTreeFernWindVertex(shader, uniforms);
  material.customProgramCacheKey = () => (
    `tree-fern-library-depth-v1-${sourceMaterial.userData.family}`
  );
  material.userData.windUniforms = uniforms;
  material.userData.shadowModel = TREE_FERN_WIND_PROFILE.shadowModel;
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
      const rootTrunk = meshes.find((mesh) => mesh.name === 'tree-fern-root-trunk');
      const rachises = meshes.find(
        (mesh) => mesh.name === 'tree-fern-load-bearing-rachises',
      );
      const leaflets = meshes.find((mesh) => mesh.name === 'tree-fern-attached-leaflets');
      if (!rootTrunk || !rachises || !leaflets) {
        throw new Error(`Tree fern variant ${group.userData.variantId} is missing its load path`);
      }
      return Object.freeze({
        id: group.userData.variantId,
        rootTrunk: rootTrunk.geometry,
        rachises: rachises.geometry,
        leaflets: leaflets.geometry,
      });
    });
}

export function classifyTreeFernHabitat(placement, { terrainGradient, terrainWetness }) {
  const gradient = terrainGradient(placement.x, placement.z);
  const slope = Math.hypot(gradient.x, gradient.z);
  const wetness = terrainWetness(placement.x, placement.z);
  const variantIndex = wetness >= 0.18
    ? 0
    : wetness <= 0.08 || (placement.x > 20 && slope >= 0.08) ? 1 : 2;
  return Object.freeze({
    variantIndex,
    slope,
    wetness,
    niche: variantIndex === 0
      ? 'humid-retentive-margin'
      : variantIndex === 1 ? 'wind-exposed-drained-margin' : 'sheltered-humus-margin',
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

function transformedTreeFernSize(variant, matrix) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const geometry of [variant.rootTrunk, variant.rachises, variant.leaflets]) {
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
      bounds.expandByPoint(point);
    }
  }
  return bounds.getSize(new THREE.Vector3());
}

function treeFernInstanceMatrix(placement, geometry, terrainHeight) {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    placement.rotation,
  );
  const scale = new THREE.Vector3(placement.scale, placement.scale, placement.scale);
  const position = new THREE.Vector3(placement.x, 0, placement.z);
  const matrix = new THREE.Matrix4().compose(position, quaternion, scale);
  const localSupport = supportPoints(geometry);
  if (localSupport.length === 0) {
    throw new Error('Tree fern root-trunk has no support-contact vertices');
  }
  const requiredY = localSupport.map((point) => {
    const world = point.clone().applyMatrix4(matrix);
    return terrainHeight(world.x, world.z) - world.y;
  });
  // The trunk stays gravitropically vertical. The entire root mantle moves only
  // along gravity until its lowest terrain contact is buried, so no root vertex
  // can hover merely because the local ground is sloped.
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
    rotation: placement.rotation,
    supportVertexCount: localSupport.length,
    supportedVertexCount,
    supportRatio: supportedVertexCount / localSupport.length,
    minimumClearance: Math.min(...clearances),
    maximumClearance: Math.max(...clearances),
    matureTerrainFitScale: placement.scale,
    verticalAxis: [0, 1, 0],
  });
}

function terrainFittedTreeFernEvidence(placement, geometry, terrainHeight) {
  let fittedPlacement = placement;
  let evidence = treeFernInstanceMatrix(fittedPlacement, geometry, terrainHeight);
  const maximumRootRelief = Math.abs(SUPPORT_CLEARANCE_RANGE[0]) - ROOT_BURIAL_DEPTH;
  for (let attempt = 0; attempt < 3 && evidence.supportRatio < 1; attempt += 1) {
    const rootRelief = evidence.maximumClearance - evidence.minimumClearance;
    const fit = THREE.MathUtils.clamp(
      (maximumRootRelief / Math.max(rootRelief, 0.0001)) * 0.995,
      0.72,
      0.995,
    );
    fittedPlacement = Object.freeze({
      ...placement,
      scale: fittedPlacement.scale * fit,
    });
    evidence = treeFernInstanceMatrix(fittedPlacement, geometry, terrainHeight);
  }
  return evidence;
}

function normalisePlacement(raw, index) {
  if (Array.isArray(raw)) {
    return Object.freeze({
      index,
      x: raw[0],
      z: raw[1],
      scale: raw[2],
      rotation: raw[3],
    });
  }
  return Object.freeze({ index, ...raw });
}

export function attachTreeFernLibraryVisual(anchor, template, rawPlacements, {
  terrainHeight,
  terrainGradient,
  terrainWetness,
} = {}) {
  if (anchor.userData.assetVisual) return anchor.userData.assetVisual;
  if (!terrainHeight || !terrainGradient || !terrainWetness) {
    throw new Error('Tree fern placement requires terrain height, gradient, and wetness functions');
  }
  const variants = extractVariants(template);
  if (variants.length !== TREE_FERN_LIBRARY_ASSET.variantCount) {
    throw new Error(
      `Expected ${TREE_FERN_LIBRARY_ASSET.variantCount} tree fern variants, received ${variants.length}`,
    );
  }
  const placements = rawPlacements.map(normalisePlacement);
  const classified = placements.map((placement) => ({
    placement,
    habitat: classifyTreeFernHabitat(placement, { terrainGradient, terrainWetness }),
  }));
  const counts = TREE_FERN_LIBRARY_ASSET.variantIds.map((_, variantIndex) => (
    classified.filter(({ habitat }) => habitat.variantIndex === variantIndex).length
  ));
  const materials = createTreeFernMaterials();
  const group = new THREE.Group();
  group.name = 'world.connected_route.tree-ferns.original-library';
  const roles = Object.freeze([
    Object.freeze({ key: 'rootTrunk', label: 'root-trunk', material: materials.rootTrunk }),
    Object.freeze({ key: 'rachises', label: 'load-bearing-rachises', material: materials.rachis }),
    Object.freeze({ key: 'leaflets', label: 'attached-leaflets', material: materials.leaflet }),
  ]);
  const instancedByVariant = variants.map((variant, variantIndex) => roles.map((role) => {
    const geometry = variant[role.key].clone();
    const flex = geometry.getAttribute('uv1');
    if (!flex) throw new Error(`${variant.id} ${role.label} is missing independent flex coordinates`);
    geometry.setAttribute('treeFernFlex', flex);
    const mesh = new THREE.InstancedMesh(geometry, role.material, counts[variantIndex]);
    mesh.name = `world.connected_route.tree-ferns.${variant.id}.${role.label}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = createTreeFernDepthMaterial(role.material);
    mesh.userData.variantId = variant.id;
    mesh.userData.role = role.label;
    mesh.userData.supportModel = TREE_FERN_LIBRARY_ASSET.supportModel;
    mesh.userData.collisionRole = TREE_FERN_LIBRARY_ASSET.collisionRole;
    group.add(mesh);
    return mesh;
  }));
  const instanceIndices = counts.map(() => 0);
  const supportEvidence = [];
  const habitatCounts = {
    'humid-retentive-margin': 0,
    'wind-exposed-drained-margin': 0,
    'sheltered-humus-margin': 0,
  };
  const tints = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  classified.forEach(({ placement, habitat }) => {
    const variant = variants[habitat.variantIndex];
    const evidence = terrainFittedTreeFernEvidence(
      placement,
      variant.rootTrunk,
      terrainHeight,
    );
    const worldSize = transformedTreeFernSize(variant, evidence.matrix);
    const individual = (placement.index % 7) / 6;
    const structureAlbedo = vegetationStructureTint({
      hue: 0.075,
      wetness: habitat.wetness,
      individual,
      baseLightness: 0.64,
    });
    tints[0].setHSL(
      structureAlbedo.hue,
      structureAlbedo.saturation,
      structureAlbedo.lightness,
    );
    const leafAlbedo = vegetationLeafTint([
      'tree-fern-humid',
      'tree-fern-exposed',
      'tree-fern-sheltered',
    ][habitat.variantIndex], {
      wetness: habitat.wetness,
      slope: habitat.slope,
      individual,
    });
    tints[1].setHSL(
      leafAlbedo.hue,
      leafAlbedo.saturation * 0.68,
      leafAlbedo.lightness * 0.92,
    );
    tints[2].setHSL(leafAlbedo.hue, leafAlbedo.saturation, leafAlbedo.lightness);
    const instanceIndex = instanceIndices[habitat.variantIndex];
    instancedByVariant[habitat.variantIndex].forEach((mesh, roleIndex) => {
      mesh.setMatrixAt(instanceIndex, evidence.matrix);
      mesh.setColorAt(instanceIndex, tints[roleIndex]);
    });
    const diameter = Math.max(worldSize.x, worldSize.z);
    const height = worldSize.y;
    supportEvidence.push(Object.freeze({
      index: placement.index,
      variantId: variant.id,
      niche: habitat.niche,
      slope: habitat.slope,
      wetness: habitat.wetness,
      diameter,
      height,
      dimensionEnvelopePass: diameter <= TREE_FERN_LIBRARY_ASSET.matureEnvelope
        .maximumCrownDiameterMeters
        && height <= TREE_FERN_LIBRARY_ASSET.matureEnvelope.maximumHeightMeters,
      ...evidence,
    }));
    const placementAnchor = anchor.children[placement.index];
    if (placementAnchor?.userData.treeFernPlacementAnchor) {
      placementAnchor.position.copy(evidence.position);
      placementAnchor.rotation.set(0, placement.rotation, 0);
      placementAnchor.scale.setScalar(evidence.matureTerrainFitScale);
      placementAnchor.userData.variantId = variant.id;
      placementAnchor.userData.supportEvidence = evidence;
    }
    habitatCounts[habitat.niche] += 1;
    instanceIndices[habitat.variantIndex] += 1;
  });
  instancedByVariant.flat().forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  const supportVertexCount = supportEvidence.reduce(
    (sum, evidence) => sum + evidence.supportVertexCount, 0,
  );
  const supportedVertexCount = supportEvidence.reduce(
    (sum, evidence) => sum + evidence.supportedVertexCount, 0,
  );
  group.userData = {
    assetVersion: TREE_FERN_LIBRARY_ASSET.version,
    supportModel: TREE_FERN_LIBRARY_ASSET.supportModel,
    collisionRole: TREE_FERN_LIBRARY_ASSET.collisionRole,
    growthModel: TREE_FERN_LIBRARY_ASSET.growthModel,
    energyModel: 'non-emissive-dielectric-plant-surfaces',
    albedoProfile: VEGETATION_ALBEDO_PROFILE.version,
    instanceCount: placements.length,
    drawCalls: TREE_FERN_LIBRARY_ASSET.drawCalls,
    counts,
    habitatCounts,
    supportEvidence,
    dimensionSummary: Object.freeze({
      instanceCount: supportEvidence.length,
      maximumDiameterMeters: Math.max(...supportEvidence.map((evidence) => evidence.diameter)),
      maximumHeightMeters: Math.max(...supportEvidence.map((evidence) => evidence.height)),
      maximumCrownDiameterMeters: TREE_FERN_LIBRARY_ASSET.matureEnvelope
        .maximumCrownDiameterMeters,
      maximumMatureHeightMeters: TREE_FERN_LIBRARY_ASSET.matureEnvelope.maximumHeightMeters,
      envelopePassCount: supportEvidence.filter(
        (evidence) => evidence.dimensionEnvelopePass,
      ).length,
    }),
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
  anchor.userData.visualSource = TREE_FERN_LIBRARY_ASSET.version;
  anchor.userData.supportEvidence = group.userData.supportSummary;
  (anchor.userData.fallbackMeshes ?? []).forEach((mesh) => { mesh.visible = false; });
  return group;
}

export function updateTreeFernLibraryWind(anchor, elapsed, reducedMotion = false) {
  const materials = anchor.userData.assetVisual?.userData.materials;
  if (!materials) return;
  materials.windUniforms.time.value = reducedMotion ? 0 : elapsed;
  materials.windUniforms.strength.value = reducedMotion
    ? 0
    : TREE_FERN_WIND_PROFILE.horizontalTipDisplacementMeters;
  materials.windUniforms.verticalStrength.value = reducedMotion
    ? 0
    : TREE_FERN_WIND_PROFILE.verticalTipDisplacementMeters;
}
