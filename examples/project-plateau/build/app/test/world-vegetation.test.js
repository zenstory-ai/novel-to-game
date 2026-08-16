import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  makeDegradableGroundAccents,
  makeEnvironmentDensity,
  makeHabitatAccents,
  makeRiparianCover,
  placeVegetation,
} from '../src/world-vegetation.js';

test('vegetation factories preserve their authored scene contract', () => {
  const scene = new THREE.Scene();
  const riparian = makeRiparianCover(scene);
  const vegetation = placeVegetation(scene);
  const habitat = makeHabitatAccents(scene);
  const groundAccents = makeDegradableGroundAccents(scene);
  const density = makeEnvironmentDensity(scene);

  assert.deepEqual(Object.keys(riparian), ['group', 'assetAnchor']);
  assert.deepEqual(
    [riparian.group.name, riparian.group.children.length, riparian.assetAnchor.children.length],
    ['world.connected_route.cover_arches', 36, 10],
  );
  assert.deepEqual(Object.keys(vegetation), [
    'trunkMeshes',
    'canopyBranchMeshes',
    'leafDetailMeshes',
    'crownMesh',
    'crownAccentMesh',
    'araucariaMesh',
    'fernMeshes',
    'fernAssetAnchor',
    'canopyTreeAssetAnchor',
    'profile',
  ]);
  assert.deepEqual(vegetation.trunkMeshes.map(({ count }) => count), [86, 42]);
  assert.deepEqual(vegetation.canopyBranchMeshes.map(({ count }) => count), [43, 42]);
  assert.deepEqual(vegetation.leafDetailMeshes.map(({ count }) => count), [43, 42]);
  assert.deepEqual(
    [
      vegetation.crownMesh.count,
      vegetation.crownAccentMesh.count,
      vegetation.araucariaMesh.count,
      ...vegetation.fernMeshes.map(({ count }) => count),
      vegetation.canopyTreeAssetAnchor.children.length,
    ],
    [128, 128, 43, 40, 40, 40, 128],
  );

  assert.deepEqual(
    [
      habitat.trunks.count,
      ...habitat.crowns.map(({ count }) => count),
      habitat.skirts.count,
      habitat.foregroundFronds.count,
      habitat.fernLibraryPlacements.length,
    ],
    [12, 4, 4, 4, 24, 12, 24],
  );
  assert.deepEqual(
    [groundAccents.children.length, groundAccents.userData.instanceCount],
    [2, 64],
  );
  assert.deepEqual(
    [density.children.length, density.userData.instanceCount],
    [14, 1_696],
  );
  assert.deepEqual(
    density.children.map(({ count }) => count).filter(Number.isInteger),
    [120, 120, 120, 144, 117, 24, 3, 6, 6, 6],
  );
  assert.equal(density.userData.groundCoverPlacements.length, 360);
});
