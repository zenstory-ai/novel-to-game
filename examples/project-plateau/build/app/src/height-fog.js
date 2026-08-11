import * as THREE from 'three';

import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';

const FOG_SHADER_VERSION = 'plateau-analytic-height-fog-v1';

function heightDensityAt(heightMeters, profile) {
  return Math.exp(
    -(heightMeters - profile.baseHeightMeters) / profile.scaleHeightMeters,
  );
}

export function integratedHeightFogOpticalDepth({
  distanceMeters,
  cameraHeightMeters,
  fragmentHeightMeters,
}, profile = DAYLIGHT_ENERGY_PROFILE.aerialPerspective) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  const heightDelta = fragmentHeightMeters - cameraHeightMeters;
  const normalizedDelta = heightDelta / profile.scaleHeightMeters;
  const cameraDensity = heightDensityAt(cameraHeightMeters, profile);
  const averageDensity = Math.abs(normalizedDelta) < 1e-6
    ? cameraDensity
    : cameraDensity * (1 - Math.exp(-normalizedDelta)) / normalizedDelta;
  return Math.max(
    0,
    profile.extinctionAtBasePerMeter * distanceMeters * averageDensity,
  );
}

export function heightFogTransmittance(segment, profile) {
  return Math.exp(-integratedHeightFogOpticalDepth(segment, profile));
}

function installHeightFogOnMaterial(material, uniforms, profile) {
  if (!material || material.fog === false || material.userData.heightFog) return false;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    const requiredChunks = [
      '#include <fog_pars_vertex>',
      '#include <fog_vertex>',
      '#include <fog_pars_fragment>',
      '#include <fog_fragment>',
    ];
    if (!requiredChunks.every((chunk) => (
      shader.vertexShader.includes(chunk) || shader.fragmentShader.includes(chunk)
    ))) return;
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', `
        #include <fog_pars_vertex>
        #ifdef USE_FOG
          varying vec3 vPlateauFogWorldPosition;
        #endif
      `)
      .replace('#include <fog_vertex>', `
        #include <fog_vertex>
        #ifdef USE_FOG
          vec4 plateauFogWorldPosition = vec4(transformed, 1.0);
          #ifdef USE_BATCHING
            plateauFogWorldPosition = batchingMatrix * plateauFogWorldPosition;
          #endif
          #ifdef USE_INSTANCING
            plateauFogWorldPosition = instanceMatrix * plateauFogWorldPosition;
          #endif
          vPlateauFogWorldPosition = (modelMatrix * plateauFogWorldPosition).xyz;
        #endif
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `
        #include <fog_pars_fragment>
        #ifdef USE_FOG
          varying vec3 vPlateauFogWorldPosition;
          uniform vec3 plateauFogCameraPosition;
          uniform vec3 plateauFogSunDirection;
          uniform vec3 plateauFogSunColor;
          uniform float plateauFogBaseHeight;
          uniform float plateauFogScaleHeight;
          uniform float plateauFogExtinction;
          uniform float plateauFogMieAnisotropy;
          uniform float plateauFogSunScatterStrength;
          uniform float plateauFogMaximumOpacity;
        #endif
      `)
      .replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          vec3 plateauFogSegment = vPlateauFogWorldPosition - plateauFogCameraPosition;
          float plateauFogDistance = length(plateauFogSegment);
          float plateauFogHeightDelta = vPlateauFogWorldPosition.y
            - plateauFogCameraPosition.y;
          float plateauFogNormalizedDelta = plateauFogHeightDelta / plateauFogScaleHeight;
          float plateauFogCameraDensity = exp(
            -(plateauFogCameraPosition.y - plateauFogBaseHeight) / plateauFogScaleHeight
          );
          float plateauFogAverageDensity = abs(plateauFogNormalizedDelta) < 0.001
            ? plateauFogCameraDensity
            : plateauFogCameraDensity
              * (1.0 - exp(-plateauFogNormalizedDelta))
              / plateauFogNormalizedDelta;
          plateauFogAverageDensity = clamp(plateauFogAverageDensity, 0.025, 2.5);
          float plateauFogOpticalDepth = plateauFogExtinction
            * plateauFogDistance * plateauFogAverageDensity;
          float plateauFogFactor = clamp(
            1.0 - exp(-plateauFogOpticalDepth),
            0.0,
            plateauFogMaximumOpacity
          );

          vec3 plateauFogViewDirection = plateauFogDistance > 0.0001
            ? plateauFogSegment / plateauFogDistance
            : vec3(0.0, 0.0, -1.0);
          float plateauFogCosTheta = clamp(dot(
            plateauFogViewDirection,
            normalize(plateauFogSunDirection)
          ), -1.0, 1.0);
          float plateauFogG = plateauFogMieAnisotropy;
          float plateauFogPhase = (1.0 - plateauFogG * plateauFogG) / pow(max(
            1.0 + plateauFogG * plateauFogG
              - 2.0 * plateauFogG * plateauFogCosTheta,
            0.02
          ), 1.5);
          float plateauFogForwardScatter = clamp(
            (plateauFogPhase - 0.42) * 0.115,
            0.0,
            1.0
          ) * plateauFogSunScatterStrength
            * (1.0 - exp(-plateauFogOpticalDepth * 0.72));
          vec3 plateauFogScatterColor = mix(
            fogColor,
            plateauFogSunColor,
            plateauFogForwardScatter
          );
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            plateauFogScatterColor,
            plateauFogFactor
          );
        #endif
      `);
  };
  material.customProgramCacheKey = () => (
    `${previousProgramCacheKey()}|${FOG_SHADER_VERSION}`
  );
  material.userData.heightFog = Object.freeze({
    version: profile.version,
    integrationModel: profile.integrationModel,
    scatteringModel: profile.scatteringModel,
  });
  material.needsUpdate = true;
  return true;
}

export function createHeightFogController(
  camera,
  sunDirection,
  profile = DAYLIGHT_ENERGY_PROFILE.aerialPerspective,
) {
  const installedMaterials = new WeakSet();
  const uniforms = {
    plateauFogCameraPosition: { value: camera.position },
    plateauFogSunDirection: { value: sunDirection },
    plateauFogSunColor: { value: new THREE.Color(0xffbd70) },
    plateauFogBaseHeight: { value: profile.baseHeightMeters },
    plateauFogScaleHeight: { value: profile.scaleHeightMeters },
    plateauFogExtinction: { value: profile.extinctionAtBasePerMeter },
    plateauFogMieAnisotropy: { value: profile.mieAnisotropy },
    plateauFogSunScatterStrength: { value: profile.sunScatterStrength },
    plateauFogMaximumOpacity: { value: profile.maximumFogOpacity },
  };
  let installedCount = 0;
  let skippedShaderMaterialCount = 0;

  return Object.freeze({
    applyTo(scene) {
      const materials = new Set();
      scene.traverse((object) => {
        if (!object.material) return;
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      });
      materials.forEach((material) => {
        if (installedMaterials.has(material)) return;
        installedMaterials.add(material);
        if (material.isShaderMaterial) {
          skippedShaderMaterialCount += 1;
          return;
        }
        if (installHeightFogOnMaterial(material, uniforms, profile)) installedCount += 1;
      });
      return this.snapshot();
    },
    snapshot() {
      return {
        ...profile,
        installedMaterialCount: installedCount,
        skippedShaderMaterialCount,
        shaderVersion: FOG_SHADER_VERSION,
        fallbackFogModel: 'three-fog-exp2-for-unpatched-custom-shaders',
      };
    },
  });
}
