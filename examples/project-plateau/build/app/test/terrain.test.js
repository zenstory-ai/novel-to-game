import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { SCENE_BUDGET } from '../src/config.js';
import { VEGETATION_LAYOUT } from '../src/environment-layout.js';
import {
  BASALT_ESCARPMENT_PROFILE,
  BROOK_CONTROL_POINTS,
  COVERED_FORK_CONTROL_POINTS,
  EAST_ESCARPMENT_SURFACE_PROFILE,
  EXPOSED_FORK_CONTROL_POINTS,
  MAIN_ROUTE_CONTROL_POINTS,
  TERRAIN_BRYOPHYTE_PROFILE,
  TERRAIN_ECOLOGY_PROFILE,
  TERRAIN_FLUVIAL_SURFACE_PROFILE,
  TERRAIN_GEOMORPHOLOGY_PROFILE,
  basaltEscarpmentHeight,
  basaltSourceContinuity,
  brookFluvialProcessAt,
  eastEscarpmentSurfaceAt,
  terrainEcologyAt,
  terrainGradient,
  terrainHeight,
  terrainProcessRelief,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from '../src/terrain.js';
import { createWorld } from '../src/world.js';

test('terrain field is deterministic, finite and visibly multi-scale', () => {
  const samples = [];
  for (let z = -90; z <= 90; z += 10) {
    for (let x = -80; x <= 80; x += 10) {
      const first = terrainHeight(x, z);
      const second = terrainHeight(x, z);
      assert.equal(first, second);
      assert.ok(Number.isFinite(first));
      assert.ok(Number.isFinite(terrainVariation(x, z)));
      samples.push(first);
    }
  }

  const relief = Math.max(...samples) - Math.min(...samples);
  assert.ok(relief >= 2.8, `terrain relief is still too flat: ${relief}`);
  assert.ok(relief <= 7.5, `terrain relief exceeds the traversal budget: ${relief}`);

  const oneMetreChanges = [
    Math.abs(terrainHeight(23, 18) - terrainHeight(24, 18)),
    Math.abs(terrainHeight(-31, -52) - terrainHeight(-31, -51)),
    Math.abs(terrainHeight(42, 63) - terrainHeight(43, 63)),
  ];
  assert.ok(oneMetreChanges.some((change) => change >= 0.015), oneMetreChanges);
});

test('terrain derivatives stay gentle on the playable route while preserving rolling relief', () => {
  const route = [
    [0, 70], [0, 45], [0, 18], [-10, 18], [-17, 8], [0, -10], [0, -30], [12, -40],
  ];
  for (const [x, z] of route) {
    const gradient = terrainGradient(x, z);
    assert.ok(Math.hypot(gradient.x, gradient.z) <= 0.2, { x, z, gradient });
    assert.ok(terrainSlope(x, z) <= 0.2, { x, z, slope: terrainSlope(x, z) });
  }

  assert.ok(terrainWetness(-11, 34) > terrainWetness(48, 34));
  assert.ok(terrainVariation(-37, -48) !== terrainVariation(37, 48));
});

test('named geomorphic relief couples brook incision, bend-side deposition and glade terrace', () => {
  assert.deepEqual(TERRAIN_GEOMORPHOLOGY_PROFILE, {
    model: 'named-process-relief-brook-incision-meander-bars-cutbanks-and-glade-terrace',
    brookIncisionDepthMeters: 0.22,
    pointBarAccretionMeters: 0.34,
    cutBankErosionMeters: 0.14,
    alluvialBenchHeightMeters: 0.22,
    gladeTerraceRiserMeters: 0.62,
    topology: 'single-cpu-heightfield-shared-by-rendering-collision-placement-and-hydrology',
  });
  const channel = terrainProcessRelief(-11, 40);
  const depositionalBank = terrainProcessRelief(-5, 40);
  const erodingBank = terrainProcessRelief(-17, 40);
  const innerProcess = brookFluvialProcessAt(-5, 40);
  const outerProcess = brookFluvialProcessAt(-17, 40);
  assert.ok(depositionalBank - channel > 0.35, { channel, depositionalBank });
  assert.ok(depositionalBank - erodingBank > 0.3, { depositionalBank, erodingBank });
  assert.ok(innerProcess.pointBar > 0.25, innerProcess);
  assert.equal(innerProcess.cutBank, 0);
  assert.ok(outerProcess.cutBank > 0.4, outerProcess);
  assert.equal(outerProcess.pointBar, 0);
  const gladeInterior = terrainProcessRelief(1.5, -33);
  const gladeExterior = terrainProcessRelief(35, -33);
  assert.ok(gladeExterior - gladeInterior > 0.2, { gladeInterior, gladeExterior });
  assert.ok(terrainEcologyAt(-5, 40).alluvium > 0.18);
  assert.ok(terrainEcologyAt(25, -30).alluvium < 0.0001);
});

test('meander surfaces sort coarse point-bar lag, overbank fines and eroded cut-bank subsoil', () => {
  assert.deepEqual(TERRAIN_FLUVIAL_SURFACE_PROFILE, {
    model: 'meander-energy-sorted-point-bar-floodplain-silt-and-cut-bank-exposure',
    processSource: 'shared-brook-control-line-heightfield-and-bank-curvature',
    bankSurfaceModel: 'terrain-integrated-wet-bank-point-bar-floodplain-and-cut-bank-fields',
    bankTopology: 'single-shared-render-and-collision-heightfield',
    bankOverlayGeometryCount: 0,
    bankOverlayDrawCalls: 0,
    wetBankRoughnessRange: [0.76, 0.99],
    contactModel: 'water-feather-over-shared-terrain-bank-no-raised-ribbon',
    pointBarMaterial: 'inner-bend-coarse-sand-and-rounded-fine-gravel',
    floodplainMaterial: 'low-energy-overbank-silt-and-clay',
    cutBankMaterial: 'outer-bend-exposed-cohesive-subsoil',
    pointBarReliefAmplitudeMeters: 0.13,
    floodplainReliefAmplitudeMeters: 0.045,
    cutBankReliefAmplitudeMeters: 0.11,
    grainOrdering: 'cut-bank-erosion-to-bed-load-to-inner-bend-lag-to-overbank-fines',
  });
  const innerBend = terrainEcologyAt(-5, 40);
  const outerBend = terrainEcologyAt(-17, 40);
  const oldFloodplain = terrainEcologyAt(0, -30);
  const activeChannel = terrainEcologyAt(-11, 40);

  assert.ok(innerBend.pointBarDeposit > 0.2, innerBend);
  assert.equal(innerBend.cutBankExposure, 0, innerBend);
  assert.ok(outerBend.cutBankExposure > 0.3, outerBend);
  assert.equal(outerBend.pointBarDeposit, 0, outerBend);
  assert.ok(oldFloodplain.floodplainSilt > 0.18, oldFloodplain);
  assert.equal(oldFloodplain.pointBarDeposit, 0, oldFloodplain);
  assert.equal(activeChannel.pointBarDeposit, 0, activeChannel);
  assert.equal(activeChannel.floodplainSilt, 0, activeChannel);
});

test('ecological ground transitions follow physical sources instead of a random mask', () => {
  assert.deepEqual(TERRAIN_ECOLOGY_PROFILE, {
    model: 'source-coupled-canopy-litter-hydrology-slope-and-footfall',
    canopySources: 146,
    routeLines: 3,
    brookLines: 1,
    randomMasks: 0,
    bryophyteModel: 'canopy-shade-moisture-hollow-and-stable-substrate-bryophyte-establishment',
  });
  assert.equal(BROOK_CONTROL_POINTS.length, 10);
  assert.equal(MAIN_ROUTE_CONTROL_POINTS.length, 8);
  assert.equal(COVERED_FORK_CONTROL_POINTS.length, 5);
  assert.equal(EXPOSED_FORK_CONTROL_POINTS.length, 5);

  const underCanopy = terrainEcologyAt(-25, 53);
  const brookBank = terrainEcologyAt(-11, 40);
  const compactedRoute = terrainEcologyAt(8, 31);
  const exposedEscarpment = terrainEcologyAt(29.3, -26);
  const openGlade = terrainEcologyAt(0, -30);
  const mainCanopy = terrainEcologyAt(
    VEGETATION_LAYOUT.trees[0].x,
    VEGETATION_LAYOUT.trees[0].z,
  );

  assert.ok(underCanopy.humus > 0.45, underCanopy);
  assert.ok(underCanopy.canopySource > 0.8, underCanopy);
  assert.ok(brookBank.wetBank > 0.95, brookBank);
  assert.ok(compactedRoute.routeWear > 0.98, compactedRoute);
  assert.ok(compactedRoute.humus < 0.05, compactedRoute);
  assert.ok(exposedEscarpment.mineralExposure > 0.7, exposedEscarpment);
  assert.ok(openGlade.humus < 0.05, openGlade);
  assert.ok(openGlade.wetBank < 0.05, openGlade);
  assert.ok(mainCanopy.canopySource >= 0.78, mainCanopy);
  assert.ok(mainCanopy.humus > 0.55, mainCanopy);
  assert.ok(mainCanopy.bryophyte > 0.3, mainCanopy);
  assert.equal(openGlade.bryophyte, 0);
  assert.equal(compactedRoute.bryophyte, 0);
  assert.deepEqual(TERRAIN_BRYOPHYTE_PROFILE, {
    model: 'canopy-shade-moisture-hollow-and-stable-substrate-bryophyte-establishment',
    sourceCanopyKinds: [
      '128-main-canopy-trees',
      '12-habitat-tree-ferns',
      '5-cover-arches',
      '1-hero-gingko',
    ],
    exclusions: [
      'route-compaction',
      'unstable-mineral-exposure',
      'active-point-bar-reworking',
      'cut-bank-erosion',
    ],
    topology: 'thin-living-cover-inside-shared-terrain-material-no-overlay-geometry',
    collisionChange: 'none',
  });
  assert.equal(brookBank.alluvium, 0, brookBank);
  assert.equal(brookBank.pointBarDeposit, 0, brookBank);
  assert.equal(brookBank.floodplainSilt, 0, brookBank);
  assert.ok(openGlade.alluvium > 0.15, openGlade);
});

test('the basalt sources rise from one continuous shoulder outside navigation', () => {
  assert.equal(BASALT_ESCARPMENT_PROFILE.topology, 'continuous-heightfield-no-overhang');
  assert.ok(BASALT_ESCARPMENT_PROFILE.riseStartX > 29);
  assert.equal(BASALT_ESCARPMENT_PROFILE.transitionRunMeters, 3.35);
  assert.equal(
    BASALT_ESCARPMENT_PROFILE.stabilityModel,
    'smoothstep-rise-bounded-by-intact-bedrock-slope-limit',
  );
  assert.ok(
    BASALT_ESCARPMENT_PROFILE.maximumAnalyticGradient
      <= EAST_ESCARPMENT_SURFACE_PROFILE.fullBedrockGradient,
    BASALT_ESCARPMENT_PROFILE,
  );
  for (const z of [-50, -38, -26, -14, -3]) {
    assert.equal(basaltEscarpmentHeight(29, z), 0);
    assert.ok(basaltEscarpmentHeight(34, z) >= 2.5, { z });
    assert.ok(basaltEscarpmentHeight(42, z) >= 2.5, { z });
  }
  assert.equal(basaltEscarpmentHeight(0, -30), 0);
  assert.equal(basaltEscarpmentHeight(12, -40), 0);
  assert.ok(terrainHeight(34, -26) - terrainHeight(29, -26) >= 2.6);
  const boundaryGradient = terrainGradient(28.4, -26, 0.05);
  assert.ok(Math.abs(boundaryGradient.x) < 0.08, boundaryGradient);
  assert.equal(basaltEscarpmentHeight(28.4, -26), 0);
});

test('unstable east-escarpment regolith exposes bedrock while the stable toe retains colluvium', () => {
  assert.deepEqual(EAST_ESCARPMENT_SURFACE_PROFILE, {
    model: 'angle-of-repose-bedrock-exposure-and-source-coupled-colluvium',
    looseRegolithAngleDegrees: 34,
    looseRegolithGradient: 0.674509,
    fullBedrockAngleDegrees: 55,
    fullBedrockGradient: 1.428148,
    colluviumToeReachMeters: 6.5,
    bedrockReliefScale: 0.58,
    jointModel: 'source-basalt-joints-with-bounded-optical-relief',
    stratificationModel: 'world-height-bed-contacts-gated-by-source-bedrock-exposure',
    stratificationPeriodsMeters: [0.58, 1.74],
    maximumStratificationAlbedoReduction: 0.11,
    overlayGeometryCount: 0,
    slopeSource: 'rendered-heightfield-normal-not-sub-grid-analytic-probe',
    massTransfer: 'unstable-regolith-exposes-source-bedrock-and-stable-toe-retains-colluvium',
  });
  assert.equal(basaltSourceContinuity(-26), 1);
  assert.equal(basaltSourceContinuity(70), 0);
  const exposedFace = eastEscarpmentSurfaceAt(29.4, -26, 1.43);
  const stableToe = eastEscarpmentSurfaceAt(27.5, -26, 0.1);
  const unrelatedSteepGround = eastEscarpmentSurfaceAt(0, -26, 1.43);
  assert.equal(exposedFace.bedrockExposure, 1);
  assert.equal(exposedFace.colluvium, 0);
  assert.equal(stableToe.bedrockExposure, 0);
  assert.ok(stableToe.colluvium > 0.8, stableToe);
  assert.equal(unrelatedSteepGround.bedrockExposure, 0);
  assert.equal(unrelatedSteepGround.colluvium, 0);
});

test('terrain renders as a bounded low-cost layer without a repeated marker-like ground-cover field', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const terrain = scene.getObjectByName('world.connected_route.terrain');

  assert.equal(
    terrain.geometry.userData.profile,
    'named-process-heightfield-with-brook-glade-and-east-escarpment',
  );
  assert.ok(terrain.geometry.userData.widthSegments >= 96);
  assert.ok(terrain.geometry.userData.heightSegments >= 112);
  assert.equal(
    terrain.material.userData.surface,
    'source-coupled-ecological-soil-and-basalt-weathering',
  );
  assert.deepEqual(terrain.material.userData.layers, [
    'navigation-exterior-basalt-escarpment-relief',
    'vertex-drainage-zone',
    'vertex-slope-mineral-zone',
    'world-space-broad-breakup',
    'rotated-mesoscale-grit',
    'distance-faded-projected-correlated-soil-albedo-roughness-relief',
    'near-field-habitat-gated-stone-organic-pore-inclusions',
    'sub-grid-cavity-indirect-occlusion',
    'canopy-and-hollow-retained-humus',
    'canopy-shade-moisture-and-stability-bryophyte-cover',
    'brook-hydrology-saturated-bank',
    'slope-and-exposure-mineral-washout',
    'route-footfall-litter-suppression-and-compaction',
    'inner-bend-point-bar-coarse-sand-and-fine-gravel',
    'low-energy-overbank-floodplain-silt',
    'outer-bend-cohesive-cut-bank-exposure',
    'angle-of-repose-bedrock-exposure',
    'source-coupled-cliff-toe-colluvium',
    'formation-sourced-basalt-weathering-apron',
  ]);
  assert.deepEqual(terrain.material.userData.surfaceDetail, {
    projection: 'continuous-world-space-triplanar',
    triplanarSharpness: 4,
    coarsePeriodMeters: 47,
    mediumPeriodMeters: 13,
    mediumFadeMeters: [45, 110],
    finePeriodMeters: 1.282,
    fineFadeMeters: [18, 58],
    fineInclusionChannels: {
      stone: 'soil-albedo-alpha',
      organic: 'soil-roughness-alpha',
      pore: 'soil-height-alpha',
    },
    fineInclusionModel: 'habitat-gated-sparse-irregular-stone-organic-and-pore-microstructure',
    maximumFineReliefAmplitudeMeters: 0.0025,
    normalSource: 'projected-meso-height-plus-source-gated-sparse-fine-stone',
    normalReliefAmplitudeMeters: [0.16, 0.21],
    cavityOcclusionFloor: 0.74,
    cavityLightingScope: 'indirect-diffuse-and-specular-only',
    compactionResponse: 'wet-alluvial-and-route-surfaces-reduce-relief-and-cavity',
    bryophyteResponse: 'living-cover-darkens-albedo-fills-fine-relief-and-retains-high-roughness',
  });
  assert.ok(terrain.geometry.getAttribute('terrainHumus'));
  assert.ok(terrain.geometry.getAttribute('terrainWetBank'));
  assert.ok(terrain.geometry.getAttribute('terrainMineralExposure'));
  assert.ok(terrain.geometry.getAttribute('terrainRouteWear'));
  assert.ok(terrain.geometry.getAttribute('terrainAlluvium'));
  assert.equal(terrain.geometry.getAttribute('terrainFluvialSurface').itemSize, 4);
  assert.ok(terrain.geometry.getAttribute('terrainBedrockExposure'));
  assert.ok(terrain.geometry.getAttribute('terrainColluvium'));
  assert.ok(terrain.geometry.userData.surfaceGeology.ranges.bedrockExposure.maximum > 0.85);
  assert.ok(terrain.geometry.userData.surfaceGeology.ranges.colluvium.maximum > 0.85);
  assert.equal(
    terrain.geometry.userData.ecology.model,
    TERRAIN_ECOLOGY_PROFILE.model,
  );
  assert.equal(terrain.geometry.userData.ecology.randomMasks, 0);
  assert.ok(terrain.geometry.userData.ecology.ranges.humus.maximum > 0.6);
  assert.ok(terrain.geometry.userData.ecology.ranges.wetBank.maximum > 0.9);
  assert.ok(terrain.geometry.userData.ecology.ranges.mineralExposure.maximum > 0.7);
  assert.ok(terrain.geometry.userData.ecology.ranges.routeWear.maximum > 0.95);
  assert.ok(terrain.geometry.userData.ecology.ranges.alluvium.maximum > 0.55);
  assert.ok(terrain.geometry.userData.ecology.ranges.humus.mean > 0.09);
  assert.ok(terrain.geometry.userData.ecology.ranges.bryophyte.mean > 0.06);
  assert.deepEqual(terrain.geometry.userData.fluvialSurface, {
    ...TERRAIN_FLUVIAL_SURFACE_PROFILE,
    ranges: {
      pointBarDeposit: { minimum: 0, maximum: 0.5699, mean: 0.0055 },
      floodplainSilt: { minimum: 0, maximum: 0.4145, mean: 0.0217 },
      cutBankExposure: { minimum: 0, maximum: 0.8533, mean: 0.0059 },
    },
  });
  assert.deepEqual(
    terrain.geometry.userData.ecology.geomorphology,
    TERRAIN_GEOMORPHOLOGY_PROFILE,
  );
  assert.equal(scene.getObjectByName('world.connected_route.ground-cover'), undefined);
  assert.equal(VEGETATION_LAYOUT.ferns.length, SCENE_BUDGET.ferns);
  assert.ok(VEGETATION_LAYOUT.ferns.every(({ x, z }) => (
    !(z > -58 && z < 18 && Math.abs(x - 1) < 22)
  )), 'fern clusters must not repopulate the protected family sightline');
});

test('soil aggregate uses correlated albedo, roughness and relief instead of decorative noise', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const terrain = scene.getObjectByName('world.connected_route.terrain');
  const { albedo, roughness, height } = terrain.material.userData.microTextures;
  const albedoBytes = albedo.image.data;
  const roughnessBytes = roughness.image.data;
  const heightBytes = height.image.data;
  const heights = [];
  const luminances = [];
  const roughnesses = [];
  const stoneCandidates = [];
  const organicCandidates = [];
  const poreCandidates = [];
  for (let index = 0; index < heightBytes.length; index += 4) {
    heights.push(heightBytes[index] / 255);
    luminances.push((
      albedoBytes[index] * 0.2126
      + albedoBytes[index + 1] * 0.7152
      + albedoBytes[index + 2] * 0.0722
    ) / 255);
    roughnesses.push(roughnessBytes[index] / 255);
    stoneCandidates.push(albedoBytes[index + 3] / 255);
    organicCandidates.push(roughnessBytes[index + 3] / 255);
    poreCandidates.push(heightBytes[index + 3] / 255);
  }
  const correlation = (left, right) => {
    const leftMean = left.reduce((total, value) => total + value, 0) / left.length;
    const rightMean = right.reduce((total, value) => total + value, 0) / right.length;
    let covariance = 0;
    let leftVariance = 0;
    let rightVariance = 0;
    for (let index = 0; index < left.length; index += 1) {
      const leftDelta = left[index] - leftMean;
      const rightDelta = right[index] - rightMean;
      covariance += leftDelta * rightDelta;
      leftVariance += leftDelta ** 2;
      rightVariance += rightDelta ** 2;
    }
    return covariance / Math.sqrt(leftVariance * rightVariance);
  };
  assert.ok(correlation(heights, luminances) > 0.5);
  assert.ok(correlation(heights, roughnesses) < -0.6);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.4);
  for (const [name, candidates, minimumCoverage, maximumCoverage] of [
    ['stone', stoneCandidates, 0.002, 0.16],
    ['organic', organicCandidates, 0.005, 0.03],
    ['pore', poreCandidates, 0.001, 0.06],
  ]) {
    const coverage = candidates.filter((value) => value > 0.5).length / candidates.length;
    assert.ok(Math.max(...candidates) - Math.min(...candidates) > 0.9, name);
    assert.ok(
      coverage > minimumCoverage && coverage < maximumCoverage,
      `${name}: ${coverage}`,
    );
  }
  for (const texture of Object.values(terrain.material.userData.microTextures)) {
    assert.equal(
      texture.userData.generation,
      'tileable-multiscale-sparse-inclusion-v3',
    );
  }
});
