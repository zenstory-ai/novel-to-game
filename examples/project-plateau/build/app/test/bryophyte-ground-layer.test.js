import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BRYOPHYTE_GROUND_LAYER_PROFILE,
  createBryophyteGroundLayer,
} from '../src/bryophyte-ground-layer.js';
import {
  terrainEcologyAt,
  terrainGradient,
  terrainHeight,
} from '../src/terrain.js';

function buildLayer(overrides = {}) {
  return createBryophyteGroundLayer({
    terrainHeight,
    terrainGradient,
    terrainEcologyAt,
    ...overrides,
  });
}

test('bryophyte ground layer is deterministic, ecology-gated and terrain-supported', () => {
  const first = buildLayer();
  const second = buildLayer();
  assert.equal(first.userData.instanceCount, BRYOPHYTE_GROUND_LAYER_PROFILE.targetInstances);
  assert.deepEqual(first.userData.counts, {
    'moss-mat': 393,
    'clubmoss-spray': 169,
    'humid-grass-tuft': 78,
  });
  assert.deepEqual(first.userData.placements, second.userData.placements);
  assert.equal(first.userData.supportEvidence.rootCount, 640);
  assert.equal(first.userData.supportEvidence.supportedRootCount, 640);
  assert.equal(first.userData.supportEvidence.supportRatio, 1);
  assert.equal(first.userData.supportEvidence.minimumRootClearance, -0.026);
  assert.equal(first.userData.supportEvidence.maximumRootClearance, -0.026);
  for (const placement of first.userData.placements) {
    assert.equal(placement.y, terrainHeight(placement.x, placement.z));
    assert.equal(placement.rootY, placement.y - placement.burialDepth);
    assert.equal(placement.burialDepth, 0.026);
    assert.ok(placement.slope <= 0.28);
    assert.ok(placement.ecology.routeWear <= 0.16);
    assert.ok(placement.ecology.mineralExposure <= 0.7);
    assert.ok(placement.ecology.pointBarDeposit <= 0.46);
    assert.ok(placement.ecology.cutBankExposure <= 0.42);
    assert.ok(placement.ecology.wetBank <= 0.96);
  }
});

test('bryophyte variants use closed rooted volumes and passive organic materials', () => {
  const layer = buildLayer();
  assert.equal(layer.children.length, BRYOPHYTE_GROUND_LAYER_PROFILE.drawCalls);
  for (const mesh of layer.children) {
    assert.ok(mesh.count > 0);
    assert.equal(mesh.geometry.userData.closedVolumes, true);
    assert.ok(mesh.geometry.userData.rootVertexCount > 0);
    assert.equal(mesh.geometry.userData.rootY, 0);
    assert.equal(mesh.userData.collisionRole, BRYOPHYTE_GROUND_LAYER_PROFILE.collisionRole);
    assert.equal(mesh.material.transparent, false);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissiveIntensity, 0);
    assert.ok(mesh.material.roughness >= 0.9);
    assert.ok(mesh.material.envMapIntensity <= 0.18);
  }
  const humidGrass = layer.children.find((mesh) => mesh.userData.variantId === 'humid-grass-tuft');
  assert.equal(
    humidGrass.geometry.userData.profile,
    'closed-subgrade-rooted-cambered-humid-grass-tuft',
  );
  assert.ok(
    (humidGrass.geometry.index?.count ?? humidGrass.geometry.attributes.position.count) / 3 >= 700,
    'humid grass must use closed tapered blade volumes rather than blunt cylinders',
  );
  const positions = humidGrass.geometry.getAttribute('position');
  let minimumBaseX = Infinity;
  let maximumBaseX = -Infinity;
  let minimumBaseZ = Infinity;
  let maximumBaseZ = -Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > 0.05) continue;
    minimumBaseX = Math.min(minimumBaseX, positions.getX(index));
    maximumBaseX = Math.max(maximumBaseX, positions.getX(index));
    minimumBaseZ = Math.min(minimumBaseZ, positions.getZ(index));
    maximumBaseZ = Math.max(maximumBaseZ, positions.getZ(index));
  }
  assert.ok(Math.max(maximumBaseX - minimumBaseX, maximumBaseZ - minimumBaseZ) < 0.45);
});

test('bryophyte placement honours authored-read exclusions', () => {
  const layer = buildLayer({
    blocksPlacement: (x) => x > 0,
    targetCount: 240,
  });
  assert.equal(layer.userData.instanceCount, 240);
  assert.ok(layer.userData.placements.every(({ x }) => x <= 0));
});
