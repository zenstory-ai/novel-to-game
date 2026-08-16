import * as THREE from 'three';

import { PALETTE } from './config.js';
import { BASALT_FORMATION_LAYOUT, TRACK_IMPRESSION } from './environment-layout.js';
import { basaltDetailTextures } from './rock-rendering.js';
import {
  basaltEscarpmentHeight,
  eastEscarpmentSurfaceAt,
  terrainEcologyAt,
  terrainHeight,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from './terrain.js';
import {
  soilTextures,
  terrainMacroControlTexture,
} from './terrain-material-textures.js';

function terrainColorAt(x, z, ecology = terrainEcologyAt(x, z)) {
  const drySoil = new THREE.Color(0x756c52);
  const mossSoil = new THREE.Color(0x465943);
  const exposedSoil = new THREE.Color(0x806d53);
  const wetSoil = new THREE.Color(0x304b45);
  const humusSoil = new THREE.Color(0x394334);
  const bryophyteSoil = new THREE.Color(0x3f5439);
  const compactedSoil = new THREE.Color(0x625b49);
  const pointBarSediment = new THREE.Color(0x817963);
  const floodplainSilt = new THREE.Color(0x746b57);
  const cutBankSubsoil = new THREE.Color(0x674c3b);
  const variation = terrainVariation(x, z);
  const wetness = terrainWetness(x, z);
  const slope = terrainSlope(x, z);
  const height = terrainHeight(x, z);
  const exposure = THREE.MathUtils.clamp((height + 2.1) / 5.4, 0, 1);
  const mossWeight = THREE.MathUtils.clamp(
    0.4 + variation * 0.32 + (1 - exposure) * 0.24 - slope * 0.7,
    0.08,
    0.82,
  );
  const exposedWeight = THREE.MathUtils.clamp(exposure * 0.5 + slope * 1.2, 0, 0.62);
  const color = drySoil
    .lerp(mossSoil, mossWeight)
    .lerp(exposedSoil, exposedWeight)
    .lerp(wetSoil, Math.max(wetness * 0.38, ecology.wetBank * 0.58))
    .lerp(humusSoil, ecology.humus * 0.64)
    .lerp(bryophyteSoil, ecology.bryophyte * 0.38)
    .lerp(floodplainSilt, ecology.floodplainSilt * 0.58)
    .lerp(pointBarSediment, ecology.pointBarDeposit * 0.56)
    .lerp(cutBankSubsoil, ecology.cutBankExposure * 0.62)
    .lerp(exposedSoil, ecology.mineralExposure * 0.28)
    .lerp(compactedSoil, ecology.routeWear * 0.32);
  color.offsetHSL(0, 0, variation * 0.025);
  return color;
}

function trackLocalCoordinates(worldX, worldZ) {
  const dx = worldX - TRACK_IMPRESSION.x;
  const dz = worldZ - TRACK_IMPRESSION.z;
  const cosine = Math.cos(TRACK_IMPRESSION.rotation);
  const sine = Math.sin(TRACK_IMPRESSION.rotation);
  return {
    x: (cosine * dx - sine * dz) / TRACK_IMPRESSION.scale,
    z: (sine * dx + cosine * dz) / TRACK_IMPRESSION.scale,
  };
}

function trackSubsurfaceClearance(worldX, worldZ) {
  const local = trackLocalCoordinates(worldX, worldZ);
  const radialDistance = Math.hypot(local.x / 1.14, (local.z + 0.4) / 1.52);
  const concealedInterior = 1 - THREE.MathUtils.smoothstep(radialDistance, 0.58, 0.78);
  return -concealedInterior * 0.24;
}

function basaltWeatheringInfluence(worldX, worldZ) {
  const sourcedApron = BASALT_FORMATION_LAYOUT.reduce((strongest, formation) => {
    // Weathered mineral fragments spread downslope toward the playable west
    // side, but stay coupled to their source formation instead of becoming a
    // generic red terrain tint across the basin.
    const apronCentreX = formation.x - 2.4;
    const normalizedX = (worldX - apronCentreX) / 9.2;
    const normalizedZ = (worldZ - formation.z) / 8.4;
    const radialDistance = Math.hypot(normalizedX, normalizedZ);
    const influence = 1 - THREE.MathUtils.smoothstep(radialDistance, 0.24, 1);
    return Math.max(strongest, influence);
  }, 0);
  const escarpmentRelief = THREE.MathUtils.clamp(
    basaltEscarpmentHeight(worldX, worldZ) / 3.15,
    0,
    1,
  );
  const exposedWestFace = 1 - THREE.MathUtils.smoothstep(worldX, 32, 42);
  const connectedCliff = escarpmentRelief * exposedWestFace * 0.8;
  return Math.max(sourcedApron, connectedCliff);
}

function makeTerrain(scene) {
  // Source-coupled transition masks need sub-canopy and trail edges to bend
  // continuously. The older ~1.9 m grid exposed individual interpolation
  // triangles once the fake glade colour wash was removed.
  const widthSegments = 144;
  const heightSegments = 168;
  const geometry = new THREE.PlaneGeometry(180, 210, widthSegments, heightSegments);
  const positions = geometry.attributes.position;
  const colors = [];
  const wetnesses = [];
  const slopes = [];
  const exposures = [];
  const basaltInfluences = [];
  const bedrockExposures = [];
  const colluviumWeights = [];
  const humusWeights = [];
  const wetBankWeights = [];
  const mineralExposureWeights = [];
  const routeWearWeights = [];
  const alluviumWeights = [];
  const pointBarDepositWeights = [];
  const floodplainSiltWeights = [];
  const cutBankExposureWeights = [];
  const bryophyteWeights = [];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    const height = terrainHeight(x, z);
    positions.setZ(i, height + trackSubsurfaceClearance(x, z));
    const ecology = terrainEcologyAt(x, z);
    const color = terrainColorAt(x, z, ecology);
    colors.push(color.r, color.g, color.b);
    wetnesses.push(terrainWetness(x, z));
    exposures.push(THREE.MathUtils.clamp((height + 2.1) / 5.4, 0, 1));
    basaltInfluences.push(basaltWeatheringInfluence(x, z));
    humusWeights.push(ecology.humus);
    wetBankWeights.push(ecology.wetBank);
    mineralExposureWeights.push(ecology.mineralExposure);
    routeWearWeights.push(ecology.routeWear);
    alluviumWeights.push(ecology.alluvium);
    pointBarDepositWeights.push(ecology.pointBarDeposit);
    floodplainSiltWeights.push(ecology.floodplainSilt);
    cutBankExposureWeights.push(ecology.cutBankExposure);
    bryophyteWeights.push(ecology.bryophyte);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('terrainWetness', new THREE.Float32BufferAttribute(wetnesses, 1));
  geometry.setAttribute('terrainExposure', new THREE.Float32BufferAttribute(exposures, 1));
  geometry.setAttribute(
    'terrainBasaltInfluence',
    new THREE.Float32BufferAttribute(basaltInfluences, 1),
  );
  geometry.setAttribute('terrainHumus', new THREE.Float32BufferAttribute(humusWeights, 1));
  geometry.setAttribute('terrainWetBank', new THREE.Float32BufferAttribute(wetBankWeights, 1));
  geometry.setAttribute(
    'terrainMineralExposure',
    new THREE.Float32BufferAttribute(mineralExposureWeights, 1),
  );
  geometry.setAttribute('terrainRouteWear', new THREE.Float32BufferAttribute(routeWearWeights, 1));
  geometry.setAttribute('terrainAlluvium', new THREE.Float32BufferAttribute(alluviumWeights, 1));
  const fluvialSurfaceWeights = [];
  for (let index = 0; index < pointBarDepositWeights.length; index += 1) {
    fluvialSurfaceWeights.push(
      pointBarDepositWeights[index],
      floodplainSiltWeights[index],
      cutBankExposureWeights[index],
      bryophyteWeights[index],
    );
  }
  geometry.setAttribute(
    'terrainFluvialSurface',
    new THREE.Float32BufferAttribute(fluvialSurfaceWeights, 4),
  );
  geometry.computeVertexNormals();
  const meshNormals = geometry.getAttribute('normal');
  for (let index = 0; index < positions.count; index += 1) {
    // PlaneGeometry is still in its local XY plane here, so local +Z is world
    // up after the pending -90 degree X rotation. Deriving slope from this
    // rendered normal keeps a one-cell cliff from being missed by a much
    // smaller analytic probe at the grid endpoints.
    const up = Math.max(Math.abs(meshNormals.getZ(index)), 1e-5);
    const renderedGradient = Math.hypot(
      meshNormals.getX(index),
      meshNormals.getY(index),
    ) / up;
    const worldX = positions.getX(index);
    const worldZ = -positions.getY(index);
    const surface = eastEscarpmentSurfaceAt(worldX, worldZ, renderedGradient);
    slopes.push(THREE.MathUtils.clamp(renderedGradient / 0.32, 0, 1));
    bedrockExposures.push(surface.bedrockExposure);
    colluviumWeights.push(surface.colluvium);
  }
  geometry.setAttribute('terrainSlope', new THREE.Float32BufferAttribute(slopes, 1));
  geometry.setAttribute(
    'terrainBedrockExposure',
    new THREE.Float32BufferAttribute(bedrockExposures, 1),
  );
  geometry.setAttribute(
    'terrainColluvium',
    new THREE.Float32BufferAttribute(colluviumWeights, 1),
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.userData.profile =
    'named-process-heightfield-with-brook-glade-and-east-escarpment';
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainMacroControl = { value: terrainMacroControlTexture };
    shader.uniforms.terrainSoilAlbedo = { value: soilTextures.albedo };
    shader.uniforms.terrainSoilRoughness = { value: soilTextures.roughness };
    shader.uniforms.terrainSoilHeight = { value: soilTextures.height };
    shader.uniforms.terrainBasaltAlbedo = { value: basaltDetailTextures.albedo };
    shader.uniforms.terrainBasaltRoughness = { value: basaltDetailTextures.roughness };
    shader.uniforms.terrainBasaltHeight = { value: basaltDetailTextures.height };
    shader.uniforms.terrainBasaltBase = { value: new THREE.Color(PALETTE.basalt) };
    shader.uniforms.terrainPointBarBase = { value: new THREE.Color(0x817963) };
    shader.uniforms.terrainFloodplainSiltBase = { value: new THREE.Color(0x746b57) };
    shader.uniforms.terrainCutBankBase = { value: new THREE.Color(0x674c3b) };
    shader.uniforms.terrainBryophyteBase = { value: new THREE.Color(0x3f5439) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute float terrainWetness;
        attribute float terrainSlope;
        attribute float terrainExposure;
        attribute float terrainBasaltInfluence;
        attribute float terrainBedrockExposure;
        attribute float terrainColluvium;
        attribute float terrainHumus;
        attribute float terrainWetBank;
        attribute float terrainMineralExposure;
        attribute float terrainRouteWear;
        attribute vec4 terrainFluvialSurface;
        varying vec4 vTerrainClimate;
        varying vec4 vTerrainGeology;
        varying vec4 vTerrainEcology;
        varying vec4 vTerrainFluvial;
        varying vec3 vTerrainWorldPosition;
      `)
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vTerrainClimate = vec4(
          terrainWetness,
          terrainSlope,
          terrainExposure,
          terrainBasaltInfluence
        );
        vTerrainGeology = vec4(
          terrainBedrockExposure,
          terrainColluvium,
          terrainMineralExposure,
          terrainFluvialSurface.z
        );
        vTerrainEcology = vec4(
          terrainHumus,
          terrainWetBank,
          terrainRouteWear,
          terrainFluvialSurface.x
        );
        vTerrainFluvial = vec4(
          terrainFluvialSurface.y,
          terrainFluvialSurface.w,
          0.0,
          0.0
        );
        vTerrainWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D terrainMacroControl;
        uniform sampler2D terrainSoilAlbedo;
        uniform sampler2D terrainSoilRoughness;
        uniform sampler2D terrainSoilHeight;
        uniform sampler2D terrainBasaltAlbedo;
        uniform sampler2D terrainBasaltRoughness;
        uniform sampler2D terrainBasaltHeight;
        uniform vec3 terrainBasaltBase;
        uniform vec3 terrainPointBarBase;
        uniform vec3 terrainFloodplainSiltBase;
        uniform vec3 terrainCutBankBase;
        uniform vec3 terrainBryophyteBase;
        varying vec4 vTerrainClimate;
        varying vec4 vTerrainGeology;
        varying vec4 vTerrainEcology;
        varying vec4 vTerrainFluvial;
        varying vec3 vTerrainWorldPosition;

        #define vTerrainWetness vTerrainClimate.x
        #define vTerrainSlope vTerrainClimate.y
        #define vTerrainExposure vTerrainClimate.z
        #define vTerrainBasaltInfluence vTerrainClimate.w
        #define vTerrainBedrockExposure vTerrainGeology.x
        #define vTerrainColluvium vTerrainGeology.y
        #define vTerrainMineralExposure vTerrainGeology.z
        #define vTerrainCutBankExposure vTerrainGeology.w
        #define vTerrainHumus vTerrainEcology.x
        #define vTerrainWetBank vTerrainEcology.y
        #define vTerrainRouteWear vTerrainEcology.z
        #define vTerrainPointBarDeposit vTerrainEcology.w
        #define vTerrainFloodplainSilt vTerrainFluvial.x
        #define vTerrainBryophyte vTerrainFluvial.y

        vec3 perturbTerrainSurfaceNormal(
          vec3 surfacePosition,
          vec3 surfaceNormal,
          vec2 heightDerivatives,
          float direction
        ) {
          vec3 sigmaX = dFdx(surfacePosition);
          vec3 sigmaY = dFdy(surfacePosition);
          vec3 responseX = cross(sigmaY, surfaceNormal);
          vec3 responseY = cross(surfaceNormal, sigmaX);
          float determinant = dot(sigmaX, responseX) * direction;
          vec3 gradient = sign(determinant)
            * (heightDerivatives.x * responseX + heightDerivatives.y * responseY);
          return normalize(abs(determinant) * surfaceNormal - gradient);
        }

        vec4 sampleTerrainProjected(
          sampler2D surfaceMap,
          vec3 surfacePosition,
          vec3 geometricNormal
        ) {
          vec3 projectionWeights = pow(abs(geometricNormal), vec3(4.0));
          projectionWeights /= max(
            projectionWeights.x + projectionWeights.y + projectionWeights.z,
            0.0001
          );
          return texture2D(surfaceMap, surfacePosition.zy) * projectionWeights.x
            + texture2D(surfaceMap, surfacePosition.xz) * projectionWeights.y
            + texture2D(surfaceMap, surfacePosition.xy) * projectionWeights.z;
        }

      `)
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 terrainMacroUv = vTerrainWorldPosition.xz * 0.0068 + vec2(0.17, -0.23);
        vec2 terrainMesoUv = mat2(0.819, -0.574, 0.574, 0.819)
          * vTerrainWorldPosition.xz * 0.021;
        vec4 terrainMacroSample = texture2D(terrainMacroControl, terrainMacroUv);
        vec4 terrainMesoSample = texture2D(terrainMacroControl, terrainMesoUv);
        vec3 terrainGeometricWorldNormal = normalize(cross(
          dFdx(vTerrainWorldPosition),
          dFdy(vTerrainWorldPosition)
        ));
        vec3 terrainSoilPositionA = vTerrainWorldPosition * 0.0212766
          + vec3(0.37, 0.11, -0.19);
        vec3 terrainRotatedWorldPosition = vec3(
          vTerrainWorldPosition.x * 0.766 - vTerrainWorldPosition.z * 0.643,
          vTerrainWorldPosition.y,
          vTerrainWorldPosition.x * 0.643 + vTerrainWorldPosition.z * 0.766
        );
        vec3 terrainSoilPositionB = terrainRotatedWorldPosition * 0.0769231
          + vec3(-0.28, 0.23, 0.43);
        float terrainViewDistance = length(cameraPosition - vTerrainWorldPosition);
        float terrainMediumDetailFade = 1.0 - smoothstep(
          45.0,
          110.0,
          terrainViewDistance
        );
        float terrainFineDetailFade = 1.0 - smoothstep(
          18.0,
          58.0,
          terrainViewDistance
        );
        vec2 terrainFineUv = mat2(0.643, -0.766, 0.766, 0.643)
          * vTerrainWorldPosition.xz * 0.78 + vec2(0.31, -0.27);
        vec4 terrainSoilFineAlbedo = texture2D(terrainSoilAlbedo, terrainFineUv);
        vec4 terrainSoilFineRoughness = texture2D(terrainSoilRoughness, terrainFineUv);
        vec4 terrainSoilFineHeight = texture2D(terrainSoilHeight, terrainFineUv);
        vec4 terrainSoilAlbedoA = sampleTerrainProjected(
          terrainSoilAlbedo,
          terrainSoilPositionA,
          terrainGeometricWorldNormal
        );
        vec4 terrainSoilAlbedoB = sampleTerrainProjected(
          terrainSoilAlbedo,
          terrainSoilPositionB,
          terrainGeometricWorldNormal
        );
        float terrainMediumBlend = 0.52 * terrainMediumDetailFade;
        vec3 terrainSoilMicro = mix(
          terrainSoilAlbedoA.rgb,
          terrainSoilAlbedoB.rgb,
          terrainMediumBlend
        );
        float terrainSoilRoughnessA = sampleTerrainProjected(
          terrainSoilRoughness,
          terrainSoilPositionA,
          terrainGeometricWorldNormal
        ).g;
        float terrainSoilRoughnessB = sampleTerrainProjected(
          terrainSoilRoughness,
          terrainSoilPositionB,
          terrainGeometricWorldNormal
        ).g;
        float terrainSoilHeightA = sampleTerrainProjected(
          terrainSoilHeight,
          terrainSoilPositionA,
          terrainGeometricWorldNormal
        ).r;
        float terrainSoilHeightB = sampleTerrainProjected(
          terrainSoilHeight,
          terrainSoilPositionB,
          terrainGeometricWorldNormal
        ).r;
        float terrainSoilMicroLuma = dot(
          terrainSoilMicro,
          vec3(0.2126, 0.7152, 0.0722)
        );
        float terrainSoilFineLuma = dot(
          terrainSoilFineAlbedo.rgb,
          vec3(0.2126, 0.7152, 0.0722)
        );
        float terrainMicroRoughnessSample = mix(
          terrainSoilRoughnessA,
          terrainSoilRoughnessB,
          terrainMediumBlend
        );
        float terrainMicroHeightSample = mix(
          terrainSoilHeightA,
          terrainSoilHeightB,
          terrainMediumBlend
        );
        float terrainMicroCavity = smoothstep(
          0.025,
          0.19,
          (terrainSoilHeightA - terrainSoilHeightB) * terrainMediumDetailFade
        );
        vec3 terrainBasaltPosition = vec3(
          vTerrainWorldPosition.x * 0.906 - vTerrainWorldPosition.z * 0.423,
          vTerrainWorldPosition.y,
          vTerrainWorldPosition.x * 0.423 + vTerrainWorldPosition.z * 0.906
        ) * 0.24 + vec3(0.11, -0.17, 0.31);
        vec3 terrainBasaltSample = sampleTerrainProjected(
          terrainBasaltAlbedo,
          terrainBasaltPosition,
          terrainGeometricWorldNormal
        ).rgb;
        float terrainBasaltLuma = dot(
          terrainBasaltSample,
          vec3(0.2126, 0.7152, 0.0722)
        );
        float terrainBasaltRoughnessSample = sampleTerrainProjected(
          terrainBasaltRoughness,
          terrainBasaltPosition,
          terrainGeometricWorldNormal
        ).g;
        float terrainBasaltHeightSample = sampleTerrainProjected(
          terrainBasaltHeight,
          terrainBasaltPosition,
          terrainGeometricWorldNormal
        ).r;
        float broadBreak = terrainMacroSample.r * 2.0 - 1.0;
        float mineralBreak = terrainMesoSample.g * 2.0 - 1.0;
        float gritBreak = terrainMesoSample.b * 2.0 - 1.0;
        float dampPocket = clamp(max(
          vTerrainWetness * (0.72 + terrainMacroSample.g * 0.42),
          vTerrainWetBank * (0.86 + terrainMacroSample.g * 0.16)
        ), 0.0, 1.0);
        float mineralShelf = clamp(max(
          vTerrainSlope * 0.72 + vTerrainExposure * 0.28,
          vTerrainMineralExposure
        ), 0.0, 1.0);
        float retainedHumus = clamp(
          vTerrainHumus * (0.82 + terrainMacroSample.r * 0.24),
          0.0,
          1.0
        );
        float bryophyteTexture = smoothstep(
          0.24,
          0.78,
          terrainMacroSample.r * 0.42
            + terrainMesoSample.g * 0.38
            + terrainMesoSample.b * 0.2
        );
        float establishedBryophyte = clamp(
          vTerrainBryophyte * mix(0.48, 1.0, bryophyteTexture),
          0.0,
          1.0
        );
        float terrainFineStone = smoothstep(
          0.72,
          0.93,
          terrainSoilFineAlbedo.a
        ) * terrainFineDetailFade * clamp(max(
          max(vTerrainMineralExposure * 0.92, vTerrainPointBarDeposit * 0.88),
          max(vTerrainColluvium * 0.68, vTerrainCutBankExposure * 0.46)
        ),
          0.0,
          1.0
        ) * (1.0 - vTerrainRouteWear * 0.34);
        float terrainFineOrganic = smoothstep(
          0.46,
          0.8,
          terrainSoilFineRoughness.a
        ) * terrainFineDetailFade * retainedHumus
          * (1.0 - vTerrainRouteWear * 0.86)
          * (1.0 - mineralShelf * 0.58)
          * (1.0 - vTerrainPointBarDeposit * 0.72);
        float terrainFinePore = smoothstep(
          0.72,
          0.94,
          terrainSoilFineHeight.a
        ) * terrainFineDetailFade * clamp(
          vTerrainCutBankExposure * 0.62
            + vTerrainFloodplainSilt * 0.22
            + retainedHumus * 0.08,
          0.0,
          0.7
        )
          * (1.0 - dampPocket * 0.7)
          * (1.0 - vTerrainFloodplainSilt * 0.74)
          * (1.0 - establishedBryophyte * 0.58);
        terrainMicroCavity *= (1.0 - dampPocket * 0.2)
          * (1.0 - vTerrainPointBarDeposit * 0.14)
          * (1.0 - vTerrainFloodplainSilt * 0.68)
          * (1.0 - vTerrainRouteWear * 0.62)
          * (1.0 - establishedBryophyte * 0.32);
        terrainMicroCavity = clamp(
          terrainMicroCavity * (1.0 + vTerrainCutBankExposure * 0.12),
          0.0,
          1.0
        );
        vec3 drainageResponse = vec3(0.72, 0.86, 0.82);
        vec3 mineralResponse = vec3(1.16, 0.96, 0.79);
        vec3 humusResponse = vec3(0.62, 0.72, 0.57);
        vec3 compactedResponse = vec3(0.9, 0.88, 0.79);
        diffuseColor.rgb *= terrainSoilMicro;
        diffuseColor.rgb *= 0.94 + broadBreak * 0.17 + mineralBreak * 0.075 + gritBreak * 0.035;
        float terrainSoilAggregateContrast = clamp(
          (terrainSoilMicroLuma - 0.39) * 2.45,
          -0.16,
          0.17
        );
        float terrainAggregateVisibility = (
          0.28 + smoothstep(
            0.28,
            0.76,
            terrainMesoSample.b * 0.64 + terrainMacroSample.g * 0.36
          ) * 0.72
        ) * (1.0 - dampPocket * 0.48);
        diffuseColor.rgb *= 1.0
          + terrainSoilAggregateContrast * terrainAggregateVisibility;
        vec3 terrainSoilChromaticity = terrainSoilMicro / max(terrainSoilMicroLuma, 0.08);
        diffuseColor.rgb *= mix(vec3(1.0), terrainSoilChromaticity, 0.11);
        float terrainFineAggregateContrast = clamp(
          (terrainSoilFineLuma - 0.39) * 2.2,
          -0.1,
          0.11
        ) * terrainFineDetailFade * (1.0 - dampPocket * 0.52);
        diffuseColor.rgb *= 1.0 + terrainFineAggregateContrast * 0.42;
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * mineralResponse * 1.035,
          terrainFineStone * 0.24
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * vec3(0.54, 0.58, 0.46),
          terrainFineOrganic * 0.34
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * humusResponse,
          retainedHumus * 0.48
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * drainageResponse,
          dampPocket * 0.46
        );
        vec3 bryophyteSurface = terrainBryophyteBase
          * mix(0.82, 1.1, terrainSoilMicroLuma)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.08);
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          bryophyteSurface,
          establishedBryophyte * 0.68
        );
        float pointBarCoarseFraction = clamp(
          terrainMesoSample.b * 0.68 + terrainMacroSample.g * 0.32,
          0.0,
          1.0
        );
        vec3 pointBarSediment = terrainPointBarBase
          * mix(0.82, 1.12, pointBarCoarseFraction)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.13);
        vec3 floodplainSilt = terrainFloodplainSiltBase
          * mix(0.94, 1.05, terrainMacroSample.r)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.08);
        vec3 cutBankSubsoil = terrainCutBankBase
          * mix(0.86, 1.08, terrainSoilMicroLuma)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.1);
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          floodplainSilt,
          vTerrainFloodplainSilt * 0.62 * (1.0 - dampPocket * 0.32)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          pointBarSediment,
          vTerrainPointBarDeposit * mix(0.48, 0.7, pointBarCoarseFraction)
            * (1.0 - dampPocket * 0.24)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          cutBankSubsoil,
          vTerrainCutBankExposure * mix(0.54, 0.72, dampPocket)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * mineralResponse,
          mineralShelf * 0.31
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * compactedResponse,
          vTerrainRouteWear * 0.18
        );
        float terrainBasaltBreakup = smoothstep(
          0.32,
          0.7,
          terrainMacroSample.b * 0.46 + terrainMesoSample.r * 0.54
        );
        float terrainWeatheringWeight = clamp(
          vTerrainBasaltInfluence * (0.16 + terrainBasaltBreakup * 0.52)
            + vTerrainBasaltInfluence * vTerrainBasaltInfluence * 0.1,
          0.0,
          0.74
        );
        float terrainBasaltWeight = max(
          terrainWeatheringWeight,
          vTerrainBedrockExposure * mix(0.88, 0.96, terrainBasaltBreakup)
        );
        terrainBasaltWeight = max(
          terrainBasaltWeight,
          vTerrainColluvium * mix(0.32, 0.68, terrainBasaltBreakup)
        );
        terrainBasaltWeight = clamp(terrainBasaltWeight, 0.0, 0.96);
        vec3 terrainBasaltChromaticity = terrainBasaltSample
          / max(terrainBasaltLuma, 0.08);
        vec3 terrainBasaltWeathered = terrainBasaltBase
          * mix(0.7, 1.32, terrainBasaltLuma)
          * mix(vec3(1.0), terrainBasaltChromaticity, 0.16);
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          terrainBasaltWeathered,
          terrainBasaltWeight
        );
        float terrainBedPhaseFine = sin(
          vTerrainWorldPosition.y * 10.833
            + vTerrainWorldPosition.z * 0.055
            + broadBreak * 0.72
        ) * 0.5 + 0.5;
        float terrainBedPhaseBroad = sin(
          vTerrainWorldPosition.y * 3.611
            - vTerrainWorldPosition.z * 0.019
            + mineralBreak * 0.46
        ) * 0.5 + 0.5;
        float terrainBedContact = max(
          smoothstep(0.82, 0.97, terrainBedPhaseFine) * 0.72,
          smoothstep(0.88, 0.985, terrainBedPhaseBroad)
        );
        float exposedStrata = vTerrainBedrockExposure
          * mix(0.52, 1.0, terrainBasaltBreakup);
        diffuseColor.rgb *= 1.0 - terrainBedContact * exposedStrata * 0.11;
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float terrainSurfaceHeight = mix(
          terrainMicroHeightSample,
          terrainBasaltHeightSample,
          terrainBasaltWeight
        ) - terrainBedContact * exposedStrata * 0.065;
        float terrainReliefAmplitudeMeters = mix(
          0.16,
          0.21,
          max(mineralShelf, terrainBasaltWeight)
        );
        terrainReliefAmplitudeMeters = mix(
          terrainReliefAmplitudeMeters,
          0.13,
          vTerrainPointBarDeposit
        );
        terrainReliefAmplitudeMeters = mix(
          terrainReliefAmplitudeMeters,
          0.045,
          vTerrainFloodplainSilt
        );
        terrainReliefAmplitudeMeters = mix(
          terrainReliefAmplitudeMeters,
          0.11,
          vTerrainCutBankExposure
        );
        float terrainSurfaceHeightMeters = terrainSurfaceHeight
          * terrainReliefAmplitudeMeters
          + terrainFineStone * 0.0025;
        vec2 terrainSurfaceGradient = vec2(
          dFdx(terrainSurfaceHeightMeters),
          dFdy(terrainSurfaceHeightMeters)
        )
          * (1.0 - dampPocket * 0.38)
          * (1.0 - vTerrainRouteWear * 0.32)
          * (1.0 - establishedBryophyte * 0.3)
          * mix(1.0, 0.58, vTerrainBedrockExposure)
          * (1.0 + vTerrainMineralExposure * 0.16);
        normal = perturbTerrainSurfaceNormal(
          -vViewPosition,
          normal,
          terrainSurfaceGradient,
          faceDirection
        );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(
          terrainMicroRoughnessSample - vTerrainWetness * 0.14 + vTerrainSlope * 0.035
            + (terrainMesoSample.b - 0.5) * 0.055,
          0.68,
          0.99
        );
        roughnessFactor = mix(
          roughnessFactor,
          terrainMicroRoughnessSample,
          0.48
        );
        roughnessFactor = mix(
          roughnessFactor,
          terrainSoilFineRoughness.g,
          terrainFineDetailFade * 0.18 * (1.0 - dampPocket * 0.38)
        );
        roughnessFactor = mix(
          roughnessFactor,
          terrainBasaltRoughnessSample,
          terrainBasaltWeight * 0.76
        );
        roughnessFactor = mix(roughnessFactor, 0.965, retainedHumus * 0.42);
        roughnessFactor = mix(roughnessFactor, 0.975, establishedBryophyte * 0.58);
        roughnessFactor = mix(roughnessFactor, 0.925, vTerrainPointBarDeposit * 0.54);
        roughnessFactor = mix(roughnessFactor, 0.985, vTerrainFloodplainSilt * 0.66);
        roughnessFactor = mix(
          roughnessFactor,
          mix(0.95, 0.79, dampPocket),
          vTerrainCutBankExposure * 0.62
        );
        roughnessFactor = mix(roughnessFactor, 0.76, vTerrainWetBank * 0.52);
        roughnessFactor = mix(roughnessFactor, 0.985, vTerrainMineralExposure * 0.38);
        roughnessFactor = mix(roughnessFactor, 0.91, vTerrainRouteWear * 0.34);
        roughnessFactor = mix(roughnessFactor, 0.9, terrainFineStone * 0.3);
        roughnessFactor = mix(roughnessFactor, 0.985, terrainFineOrganic * 0.46);
        roughnessFactor = clamp(roughnessFactor, 0.7, 0.99);
      `)
      .replace('#include <aomap_fragment>', `
        #include <aomap_fragment>
        float terrainCombinedCavity = clamp(max(
          terrainMicroCavity,
          terrainFinePore * 0.05 + terrainFineOrganic * 0.035
        ), 0.0, 1.0);
        float terrainCavityOcclusion = mix(1.0, 0.74, terrainCombinedCavity);
        reflectedLight.indirectDiffuse *= terrainCavityOcclusion;
        reflectedLight.indirectSpecular *= mix(1.0, 0.86, terrainCombinedCavity);
      `);
  };
  material.customProgramCacheKey = () => 'terrain-ecological-geological-micro-surface-v13';
  material.userData.surface = 'source-coupled-ecological-soil-and-basalt-weathering';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'world.connected_route.terrain';
  scene.add(mesh);
  return mesh;
}

export { makeTerrain, terrainColorAt };
