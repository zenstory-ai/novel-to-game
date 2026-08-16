import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeadwoodMaterial,
  createDriftwoodGeometry,
} from '../src/deadwood-rendering.js';
import {
  CANOPY_WIND_PROFILE,
  createLeafWindDepthMaterial,
} from '../src/vegetation-leaf-materials.js';
import { shared } from '../src/vegetation-rendering.js';
import { barkTextures } from '../src/vegetation-textures.js';

function byteSum(texture) {
  return texture.image.data.reduce((total, value) => total + value, 0);
}

test('shared vegetation geometry and bark textures remain deterministic', () => {
  assert.deepEqual(
    [
      shared.trunkGeometry.attributes.position.count,
      shared.plateBarkedTrunkGeometry.attributes.position.count,
      shared.canopyBranchGeometry.attributes.position.count,
      shared.crownGeometry.attributes.position.count,
      shared.crownAccentGeometry.attributes.position.count,
      shared.araucariaGeometry.attributes.position.count,
      shared.treeFernTrunkGeometry.attributes.position.count,
      shared.leafDetailGeometry.attributes.position.count,
    ],
    [1_062, 1_716, 1_092, 3_240, 2_160, 6_000, 540, 2_172],
  );
  assert.deepEqual(
    shared.groundCoverGeometries.map((geometry) => geometry.attributes.position.count),
    [81, 99, 210],
  );
  assert.deepEqual(
    shared.canopyLeafGeometries.map((geometry) => [
      geometry.attributes.position.count,
      geometry.index.count,
    ]),
    [[64, 96], [64, 96]],
  );
  assert.deepEqual(
    Object.entries(barkTextures).map(([key, texture]) => [
      key,
      texture.name,
      texture.image.width,
      byteSum(texture),
    ]),
    [
      ['albedo', 'world.material.bark-albedo', 128, 10_098_660],
      ['roughness', 'world.material.bark-roughness', 128, 15_069_468],
      ['height', 'world.material.bark-height', 128, 13_103_946],
    ],
  );
});

test('leaf wind and depth materials keep one shared displacement contract', () => {
  assert.deepEqual(CANOPY_WIND_PROFILE.direction, [0.82, 0, 0.57]);
  assert.equal(CANOPY_WIND_PROFILE.horizontalTipDisplacementMeters, 0.085);
  assert.equal(CANOPY_WIND_PROFILE.verticalTipDisplacementMeters, 0.018);
  assert.deepEqual(
    shared.canopyLeafMaterials.map((material) => [
      material.userData.family,
      material.customProgramCacheKey(),
      createLeafWindDepthMaterial(material).depthPacking,
    ]),
    [
      ['elliptic-waxy', 'thin-leaf-beer-lambert-v3-elliptic-waxy-anchored-wind', 3201],
      ['compound-lanceolate', 'thin-leaf-beer-lambert-v3-compound-lanceolate-anchored-wind', 3201],
    ],
  );
});

test('driftwood variants and wetness materials preserve their authored contract', () => {
  assert.deepEqual(
    [0, 1, 2].map((variant) => {
      const geometry = createDriftwoodGeometry(variant);
      return [
        geometry.attributes.position.count,
        geometry.index.count,
        geometry.userData.supportPoints.length,
      ];
    }),
    [[630, 2_736, 2], [482, 2_088, 7], [630, 2_736, 4]],
  );
  const dry = createDeadwoodMaterial();
  const wet = createDeadwoodMaterial({ wet: true });
  assert.deepEqual(
    [
      [dry.roughness, dry.bumpScale, dry.userData.moistureClass],
      [wet.roughness, wet.bumpScale, wet.userData.moistureClass],
    ],
    [
      [0.96, 0.024, 'forest-floor-dry-to-damp'],
      [0.9, 0.016, 'brook-bank-wet'],
    ],
  );
});
