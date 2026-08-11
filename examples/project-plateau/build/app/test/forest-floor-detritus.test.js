import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOREST_FLOOR_DETRITUS_PROFILE,
  createForestFloorDetritusGeometry,
  createForestFloorDetritusLayer,
} from '../src/forest-floor-detritus.js';

function height(x, z) {
  return Math.sin(x * 0.035) * 0.22 + Math.cos(z * 0.028) * 0.18;
}

function gradient(x, z) {
  return {
    x: Math.cos(x * 0.035) * 0.22 * 0.035,
    z: -Math.sin(z * 0.028) * 0.18 * 0.028,
  };
}

function ecology(x, z) {
  const variation = (Math.sin(x * 0.17 + z * 0.11) + 1) * 0.5;
  return {
    humus: 0.46 + variation * 0.32,
    routeWear: variation * 0.08,
    wetBank: variation * 0.18,
    mineralExposure: 0.08 + variation * 0.18,
    slope: Math.hypot(gradient(x, z).x, gradient(x, z).z),
  };
}

const SOURCES = Object.freeze([
  Object.freeze([-14, 12, 1]),
  Object.freeze([13, 4, 0.9]),
  Object.freeze([-11, -16, 1.15]),
  Object.freeze([15, -22, 1.05]),
]);

function nonManifoldEdgeCount(geometry) {
  const position = geometry.getAttribute('position');
  const edges = new Map();
  const key = (index) => [
    position.getX(index),
    position.getY(index),
    position.getZ(index),
  ].map((value) => Math.round(value * 1e5)).join(':');
  const add = (start, end) => {
    const edge = start < end ? `${start}|${end}` : `${end}|${start}`;
    edges.set(edge, (edges.get(edge) ?? 0) + 1);
  };
  for (let index = 0; index < position.count; index += 3) {
    const a = key(index);
    const b = key(index + 1);
    const c = key(index + 2);
    add(a, b);
    add(b, c);
    add(c, a);
  }
  return [...edges.values()].filter((count) => count !== 2).length;
}

test('forest-floor detritus variants are closed, bounded organic clusters', () => {
  const identities = new Set();
  for (let variant = 0; variant < FOREST_FLOOR_DETRITUS_PROFILE.variantIds.length; variant += 1) {
    const geometry = createForestFloorDetritusGeometry(variant);
    geometry.computeBoundingBox();
    const size = {
      x: geometry.boundingBox.max.x - geometry.boundingBox.min.x,
      y: geometry.boundingBox.max.y - geometry.boundingBox.min.y,
      z: geometry.boundingBox.max.z - geometry.boundingBox.min.z,
    };
    assert.equal(
      geometry.userData.variantId,
      FOREST_FLOOR_DETRITUS_PROFILE.variantIds[variant],
    );
    assert.ok((geometry.index?.count ?? geometry.getAttribute('position').count) / 3 < 500);
    assert.ok(Math.max(size.x, size.z) <= FOREST_FLOOR_DETRITUS_PROFILE.maximumClusterDiameterMeters);
    assert.ok(size.y <= FOREST_FLOOR_DETRITUS_PROFILE.maximumClusterHeightMeters);
    assert.ok(geometry.boundingBox.min.y >= -1e-7);
    assert.ok(geometry.userData.supportPoints.length >= 12);
    assert.equal(nonManifoldEdgeCount(geometry), 0);
    assert.ok(geometry.getAttribute('color'));
    assert.ok(geometry.getAttribute('normal'));
    identities.add([
      geometry.userData.leafCount,
      geometry.userData.twigCount,
      geometry.userData.barkCount,
      geometry.userData.coneCount,
    ].join(':'));
  }
  assert.equal(identities.size, 4);
});

test('detritus placement is deterministic, ecology-gated and terrain-supported', () => {
  const options = {
    terrainHeight: height,
    terrainGradient: gradient,
    terrainEcologyAt: ecology,
    sources: SOURCES,
    heroSource: SOURCES[0],
    count: 60,
  };
  const first = createForestFloorDetritusLayer(options);
  const second = createForestFloorDetritusLayer(options);
  assert.equal(first.children.length, FOREST_FLOOR_DETRITUS_PROFILE.drawCalls);
  assert.equal(first.userData.instanceCount, 60);
  assert.deepEqual(first.userData.counts, [10, 10, 10, 30]);
  assert.deepEqual(first.userData.sourceRoleCounts, {
    canopyHabitat: 30,
    heroGingkoInterRoot: 30,
  });
  assert.deepEqual(first.userData.placements, second.userData.placements);
  assert.equal(first.userData.supportEvidence.supportRatio, 1);
  assert.ok(
    first.userData.supportEvidence.minimumClearance
      >= -FOREST_FLOOR_DETRITUS_PROFILE.burialDepth - 1e-5,
  );
  assert.ok(
    first.userData.supportEvidence.maximumClearance
      <= FOREST_FLOOR_DETRITUS_PROFILE.maximumSupportClearance,
  );
  for (const placement of first.userData.placements) {
    assert.ok(placement.humus >= FOREST_FLOOR_DETRITUS_PROFILE.minimumHumus);
    assert.ok(placement.routeWear <= FOREST_FLOOR_DETRITUS_PROFILE.maximumRouteWear);
    assert.ok(placement.wetBank <= FOREST_FLOOR_DETRITUS_PROFILE.maximumWetBank);
    assert.ok(
      placement.mineralExposure
        <= FOREST_FLOOR_DETRITUS_PROFILE.maximumMineralExposure,
    );
    assert.ok(placement.slope <= FOREST_FLOOR_DETRITUS_PROFILE.maximumSlope);
  }
  const heroPlacements = first.userData.placements.filter(
    ({ sourceRole }) => sourceRole === 'hero-gingko-inter-root',
  );
  assert.equal(heroPlacements.length, 30);
  for (const placement of heroPlacements) {
    const radius = Math.hypot(placement.x - SOURCES[0][0], placement.z - SOURCES[0][1]);
    assert.ok(radius >= FOREST_FLOOR_DETRITUS_PROFILE.heroGingkoRadiusMeters[0] - 1e-5);
    assert.ok(radius <= FOREST_FLOOR_DETRITUS_PROFILE.heroGingkoRadiusMeters[1] + 1e-5);
    const angle = Math.atan2(placement.z - SOURCES[0][1], placement.x - SOURCES[0][0]);
    const nearestRoot = Math.min(...FOREST_FLOOR_DETRITUS_PROFILE.heroRootAnglesRadians.map(
      (rootAngle) => Math.abs(Math.atan2(Math.sin(angle - rootAngle), Math.cos(angle - rootAngle))),
    ));
    assert.ok(nearestRoot >= FOREST_FLOOR_DETRITUS_PROFILE.minimumRootAngularSeparationRadians);
  }
  for (const mesh of first.children) {
    assert.equal(mesh.userData.collisionRole, FOREST_FLOOR_DETRITUS_PROFILE.collisionRole);
    assert.equal(mesh.material.metalness, 0);
    assert.equal(mesh.material.emissiveIntensity, 0);
    assert.equal(mesh.material.transparent, false);
  }
});

test('detritus placement honours authored-read exclusions', () => {
  const layer = createForestFloorDetritusLayer({
    terrainHeight: height,
    terrainGradient: gradient,
    terrainEcologyAt: ecology,
    sources: SOURCES,
    heroSource: SOURCES[0],
    blocksPlacement: (x) => x > 0,
    count: 45,
  });
  assert.ok(layer.userData.placements.every(({ x }) => x <= 0));
});
