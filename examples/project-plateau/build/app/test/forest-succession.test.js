import assert from 'node:assert/strict';
import test from 'node:test';

import { NAVIGATION_BOUNDS } from '../src/collision-layout.js';
import {
  createForestSuccessionLayout,
  FOREST_SUCCESSION_COHORTS,
  FOREST_SUCCESSION_PROFILE,
} from '../src/forest-succession.js';
import { terrainGradient, terrainHeight, terrainWetness } from '../src/terrain.js';

function build() {
  return createForestSuccessionLayout({
    count: 144,
    terrainHeight,
    terrainGradient,
    terrainWetness,
    navigationBounds: NAVIGATION_BOUNDS,
  });
}

test('boundary forest succession is deterministic, cohort-based and age stratified', () => {
  const first = build();
  const second = build();
  assert.deepEqual(first, second);
  assert.equal(first.profile.version, 'terrain-sourced-boundary-forest-succession-v2');
  assert.equal(first.summary.instanceCount, 144);
  assert.equal(first.summary.cohortCount, FOREST_SUCCESSION_COHORTS.length);
  assert.ok(Object.values(first.summary.cohortCounts).every((count) => count === 12));
  assert.deepEqual(first.summary.ageCounts, { mature: 72, submature: 36, pioneer: 36 });
  assert.equal(first.summary.crownVariantCounts.reduce((sum, count) => sum + count, 0), 144);
  assert.ok(first.summary.crownOverlapLinks >= 60);
  assert.ok(first.summary.overlapLinkedTreeCount >= 80);
});

test('every load-bearing boundary trunk remains outside navigation and supported by terrain', () => {
  const forest = build();
  assert.equal(forest.summary.outsideNavigationCount, forest.summary.instanceCount);
  for (const tree of forest.placements) {
    const radius = tree.trunkClearanceRadius;
    assert.ok(
      tree.x + radius < NAVIGATION_BOUNDS.minX
        || tree.x - radius > NAVIGATION_BOUNDS.maxX
        || tree.z + radius < NAVIGATION_BOUNDS.minZ
        || tree.z - radius > NAVIGATION_BOUNDS.maxZ,
      tree.cohortId,
    );
    assert.equal(tree.groundY, terrainHeight(tree.x, tree.z));
    assert.ok(Number.isFinite(tree.slope));
    assert.ok(tree.wetness >= 0 && tree.wetness <= 1);
    assert.ok(tree.windDamage >= 0.08 && tree.windDamage <= 0.72);
    assert.ok(tree.crownRadiusMeters > tree.trunkClearanceRadius);
  }
  assert.equal(
    forest.profile.collisionModel,
    'load-bearing-trunks-wholly-outside-navigation-crowns-may-overhang',
  );
});

test('age variation follows coupled height, diameter and crown allometry', () => {
  const forest = build();
  for (const tree of forest.placements) {
    const range = FOREST_SUCCESSION_PROFILE.ageClasses[tree.ageClass];
    assert.ok(tree.heightScale >= range.minimumHeightScale);
    assert.ok(tree.heightScale <= range.maximumHeightScale);
    assert.deepEqual(tree.trunkScale, [
      tree.radialScale,
      tree.heightScale,
      tree.radialScale,
    ]);
    assert.ok(tree.trunkScale.every(Number.isFinite));
    assert.ok(tree.crownScale.every((value) => Number.isFinite(value) && value > 0));
    if (tree.ageClass === 'pioneer') {
      assert.ok(
        tree.radialScale < tree.heightScale,
        'pioneer trunks must become proportionally thinner rather than uniformly miniaturised',
      );
    }
  }
});
