import * as THREE from 'three';

import { BASALT_FORMATION_LAYOUT, TRACK_IMPRESSION } from './environment-layout.js';
import { createGroundLayers } from './ground-layers.js';
import { createGroundMaterial } from './terrain-ground-material.js';
import {
  basaltEscarpmentHeight,
  eastEscarpmentSurfaceAt,
  terrainEcologyAt,
  terrainHeight,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from './terrain.js';

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

function makeTerrain(scene, groundLayers = createGroundLayers()) {
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
  const material = createGroundMaterial(groundLayers.textures);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'world.connected_route.terrain';
  scene.add(mesh);
  return mesh;
}

export { makeTerrain, terrainColorAt };
