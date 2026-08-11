import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  BROOK_FREE_SURFACE_PROFILE,
  BROOK_HYDROLOGY_PROFILE,
  BROOK_OBSTACLE_FLOW_PROFILE,
  BROOK_REFLECTION_PROFILE,
  BROOK_SURFACE_DRAW_PROFILE,
  brookFlowFrameAt,
  buildBrookObstacleFlowField,
  buildBrookHydrology,
} from '../src/brook-hydrology.js';
import { BROOK_CONTROL_POINTS, terrainHeight } from '../src/terrain.js';

function sampledBrookPoints() {
  const controls = BROOK_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal', 0.5);
  return curve.getSpacedPoints((controls.length - 1) * 8);
}

test('brook hydrology drains both mapped headwaters toward one interior saturated hollow', () => {
  const points = sampledBrookPoints();
  const hydrology = buildBrookHydrology(points, terrainHeight, { width: 3.4 });
  assert.equal(hydrology.profile, BROOK_HYDROLOGY_PROFILE);
  assert.equal(hydrology.waterLevels.length, 73);
  assert.ok(hydrology.confluenceIndex > 0);
  assert.ok(hydrology.confluenceIndex < points.length - 1);
  assert.equal(hydrology.flowDirections[0], 1);
  assert.equal(hydrology.flowDirections.at(-1), -1);
  assert.equal(hydrology.flowDirections[hydrology.confluenceIndex], 0);
  for (let index = 0; index < hydrology.confluenceIndex; index += 1) {
    assert.ok(
      hydrology.waterLevels[index] > hydrology.waterLevels[index + 1],
      `north reach row ${index} must lose gravitational head downstream`,
    );
  }
  for (let index = hydrology.confluenceIndex + 1; index < points.length; index += 1) {
    assert.ok(
      hydrology.waterLevels[index] > hydrology.waterLevels[index - 1],
      `south reach row ${index} must lose gravitational head toward the confluence`,
    );
  }
  assert.ok(
    hydrology.minimumMeasuredDownstreamGrade
      >= BROOK_HYDROLOGY_PROFILE.minimumDownstreamGrade - 1e-9,
  );
  assert.equal(hydrology.crossChannelGrade, 0);
  assert.equal(hydrology.flowEnergies.length, hydrology.waterLevels.length);
  assert.ok(hydrology.flowEnergies.every((energy) => energy >= 0 && energy <= 1));
  assert.ok(hydrology.maximumFlowEnergy > 0.9);
  assert.ok(hydrology.maximumMeasuredDownstreamGrade > 0.06);
  assert.ok(hydrology.maximumPondingDepth < 0.16);
  assert.ok(hydrology.maximumBedClearance < 0.28);
});

test('each reflection reach is an upward local free-surface plane that never crosses the divide', () => {
  const points = sampledBrookPoints();
  const hydrology = buildBrookHydrology(points, terrainHeight, { width: 3.4 });
  assert.ok(hydrology.reaches.length >= 10);
  for (const reach of hydrology.reaches) {
    assert.ok(Math.abs(reach.normal.length() - 1) < 1e-9);
    assert.ok(reach.normal.y > 0.99);
    assert.ok(reach.downstreamDrop > 0);
    assert.ok(reach.halfWidth >= 2.1);
    assert.ok(reach.halfLength > 1);
    assert.ok(reach.maxSurfaceDeviation < 0.22);
    if (reach.branch === 'north-headwater') {
      assert.ok(reach.endIndex <= hydrology.confluenceIndex);
      assert.ok(reach.grade < 0);
    } else {
      assert.ok(reach.startIndex >= hydrology.confluenceIndex);
      assert.ok(reach.grade > 0);
    }
  }
});

test('brook reflection quality uses a bounded screen-space trace over a complete fallback', () => {
  assert.deepEqual(BROOK_REFLECTION_PROFILE.stepsByQuality, {
    low: 0,
    balanced: 12,
    high: 20,
  });
  assert.equal(BROOK_REFLECTION_PROFILE.maximumRangeMeters, 38);
  assert.ok(BROOK_REFLECTION_PROFILE.constantThicknessMeters > 0);
  assert.ok(BROOK_REFLECTION_PROFILE.constantThicknessMeters < 0.2);
  assert.ok(BROOK_REFLECTION_PROFILE.depthScaledThicknessPerMeter > 0);
  assert.match(BROOK_REFLECTION_PROFILE.model, /screen-space-reflected-ray/);
  assert.match(BROOK_REFLECTION_PROFILE.fallback, /local-planar/);
  assert.match(BROOK_REFLECTION_PROFILE.evidenceBoundary, /cannot-recover/);
});

test('brook obstacle flow accepts only rendered clasts that reach the upper water column', () => {
  const points = sampledBrookPoints();
  const hydrology = buildBrookHydrology(points, terrainHeight, { width: 3.4 });
  const sourcePoint = points[18];
  const frame = brookFlowFrameAt(points, hydrology, sourcePoint.x, sourcePoint.z);
  const bedElevation = terrainHeight(sourcePoint.x, sourcePoint.z);
  const field = buildBrookObstacleFlowField(points, hydrology, [
    {
      id: 'rendered-emergent-clast',
      sourceClass: 'active-channel-bed-load',
      x: sourcePoint.x,
      z: sourcePoint.z,
      radiusMeters: 0.24,
      bottomElevation: bedElevation - 0.01,
      topElevation: frame.waterLevel + 0.035,
      bedElevation,
    },
    {
      id: 'rendered-deep-clast',
      sourceClass: 'active-channel-bed-load',
      x: sourcePoint.x + 0.18,
      z: sourcePoint.z,
      radiusMeters: 0.12,
      bottomElevation: bedElevation - 0.01,
      topElevation: bedElevation + 0.015,
      bedElevation,
    },
    {
      id: 'rendered-bank-clast',
      sourceClass: 'historical-high-flow-rounded-lag',
      x: sourcePoint.x + 4.2,
      z: sourcePoint.z,
      radiusMeters: 0.42,
      bottomElevation: bedElevation,
      topElevation: frame.waterLevel + 0.25,
      bedElevation,
    },
  ]);
  assert.equal(field.profile, BROOK_OBSTACLE_FLOW_PROFILE);
  assert.equal(field.candidateCount, 3);
  assert.equal(field.qualifyingCount, 1);
  assert.equal(field.selected.length, 1);
  assert.equal(field.selected[0].id, 'rendered-emergent-clast');
  assert.equal(field.selected[0].flowDirection.dot(frame.flowDirection), 1);
  assert.ok(field.selected[0].wakeLengthMeters > field.selected[0].radiusMeters * 4);
  assert.ok(
    field.selected[0].normalSlope <= BROOK_OBSTACLE_FLOW_PROFILE.maximumSurfaceNormalSlope,
  );
  assert.ok(field.selected[0].aeration <= BROOK_OBSTACLE_FLOW_PROFILE.maximumAeration);
  assert.deepEqual(
    field.rejected.map(({ id, reason }) => [id, reason]),
    [
      ['rendered-deep-clast', 'too-deep-to-resolve-at-free-surface'],
      ['rendered-bank-clast', 'outside-rendered-wetted-channel'],
    ],
  );
});

test('brook obstacle flow directions converge from both headwaters and remain budget bounded', () => {
  const points = sampledBrookPoints();
  const hydrology = buildBrookHydrology(points, terrainHeight, { width: 3.4 });
  const north = brookFlowFrameAt(points, hydrology, points[7].x, points[7].z);
  const south = brookFlowFrameAt(points, hydrology, points[62].x, points[62].z);
  const northTangent = points[north.segmentIndex + 1].clone()
    .sub(points[north.segmentIndex]).setY(0).normalize();
  const southTangent = points[south.segmentIndex + 1].clone()
    .sub(points[south.segmentIndex]).setY(0).normalize();
  assert.ok(north.flowDirection.dot(new THREE.Vector2(northTangent.x, northTangent.z)) > 0.999);
  assert.ok(south.flowDirection.dot(new THREE.Vector2(southTangent.x, southTangent.z)) < -0.999);
  assert.deepEqual(BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality, {
    low: 4,
    balanced: 8,
    high: 12,
  });
  assert.equal(BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount, 12);
  assert.match(BROOK_OBSTACLE_FLOW_PROFILE.evidenceBoundary, /not-cfd/);
  assert.equal(BROOK_FREE_SURFACE_PROFILE.longitudinalSubdivisions, 4);
  assert.equal(BROOK_FREE_SURFACE_PROFILE.crossSectionVertices, 13);
  assert.equal(BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters, 0.038);
  assert.ok(
    BROOK_FREE_SURFACE_PROFILE.maximumUpstreamCompressionMeters
      > BROOK_FREE_SURFACE_PROFILE.maximumWakeAmplitudeMeters,
  );
  assert.match(BROOK_FREE_SURFACE_PROFILE.volumeContract, /zero-mean-oscillatory-wake/);
  assert.match(BROOK_FREE_SURFACE_PROFILE.evidenceBoundary, /not-shallow-water-cfd/);
});

test('brook surface is ordered ahead of standing transparent scene elements', () => {
  // The campfire flames keep three.js' default render order and write no depth,
  // so the channel cannot rely on the whole-object transparent sort to stay
  // behind them: the ribbon's world-space vertices leave its origin at (0, 0, 0),
  // up to 88 m from the water on screen. Pin the contract against the default a
  // standing transparent mesh actually gets.
  const standingTransparent = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
  );
  assert.equal(
    standingTransparent.renderOrder,
    BROOK_SURFACE_DRAW_PROFILE.standingTransparentRenderOrder,
  );
  assert.ok(
    BROOK_SURFACE_DRAW_PROFILE.surfaceRenderOrder
      < BROOK_SURFACE_DRAW_PROFILE.standingTransparentRenderOrder,
  );
  assert.match(BROOK_SURFACE_DRAW_PROFILE.sortHazard, /origin-does-not-track-visible-water/);
  assert.match(
    BROOK_SURFACE_DRAW_PROFILE.evidenceBoundary,
    /not-per-fragment-depth-sorting/,
  );
});
