import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  RIDGE_SURFACE_PROFILE,
  SUN_DIRECTION,
  createAtmosphere,
} from '../src/atmosphere.js';

test('atmosphere composition preserves every named visual layer', () => {
  const scene = new THREE.Scene();
  const atmosphere = createAtmosphere(scene);

  assert.equal(scene.getObjectByName('world.atmosphere'), atmosphere);
  assert.deepEqual(
    atmosphere.children.map(({ name }) => name),
    [
      'world.atmosphere.gradient-sky',
      'world.atmosphere.cloud-veil',
      'world.atmosphere.cloud-deck',
      'world.atmosphere.cloud-banks',
      'world.atmosphere.far-ridge',
      'world.atmosphere.near-ridge',
      'world.atmosphere.mist-near',
      'world.atmosphere.mist-mid',
      'world.atmosphere.mist-far',
    ],
  );
  assert.equal(atmosphere.getObjectByName('world.atmosphere.cloud-volumes').children.length, 11);
  assert.equal(atmosphere.getObjectByName('world.atmosphere.cloud-puff-fallback').count, 56);

  const ridgeContract = [
    ['world.atmosphere.far-ridge', 555, 507, 224],
    ['world.atmosphere.near-ridge', 648, 581, 291],
  ];
  for (const [name, trunks, broadCrowns, narrowCrowns] of ridgeContract) {
    const ridge = atmosphere.getObjectByName(name);
    assert.equal(ridge.geometry.attributes.position.count, 949);
    assert.equal(ridge.geometry.index.count, 5_184);
    assert.deepEqual(
      ridge.children[0].children.map(({ count }) => count),
      [trunks, broadCrowns, narrowCrowns],
    );
    assert.equal(ridge.children[0].userData.placements.length, trunks);
  }
  for (const name of [
    'world.atmosphere.mist-near',
    'world.atmosphere.mist-mid',
    'world.atmosphere.mist-far',
  ]) {
    assert.equal(atmosphere.getObjectByName(name).children.length, 6);
  }
});

test('atmosphere update keeps quality fallback and reduced-motion behavior stable', () => {
  const atmosphere = createAtmosphere(new THREE.Scene());
  const veil = atmosphere.getObjectByName('world.atmosphere.cloud-veil');
  const banks = atmosphere.getObjectByName('world.atmosphere.cloud-banks');
  const firstVolume = banks.userData.volumes.children[0];

  atmosphere.userData.update(12.5, false, 'low');
  assert.equal(veil.material.uniforms.time.value, 12.5);
  assert.equal(banks.userData.volumes.visible, false);
  assert.equal(banks.userData.fallback.visible, true);
  assert.equal(firstVolume.material.uniforms.stepCount.value, 12);

  atmosphere.userData.update(23, true, 'high');
  assert.equal(veil.material.uniforms.time.value, 0);
  assert.equal(banks.userData.volumes.visible, true);
  assert.equal(banks.userData.fallback.visible, false);
  assert.equal(firstVolume.material.uniforms.stepCount.value, 18);
  assert.deepEqual(firstVolume.position.toArray(), firstVolume.userData.basePosition);
});

test('atmosphere public lighting and ridge-surface constants stay fixed', () => {
  assert.ok(Math.abs(SUN_DIRECTION.length() - 1) < 1e-12);
  assert.deepEqual(
    SUN_DIRECTION.toArray().map((value) => Number(value.toFixed(12))),
    [-0.439956006599, 0.549945008249, 0.709929010648],
  );
  assert.equal(RIDGE_SURFACE_PROFILE.version, 'process-coupled-distant-ridge-surface-v2');
  assert.deepEqual(
    [
      RIDGE_SURFACE_PROFILE.broadDetailPeriodMeters,
      RIDGE_SURFACE_PROFILE.fineDetailPeriodMeters,
      RIDGE_SURFACE_PROFILE.microDetailPeriodMeters,
    ],
    [37, 13, 9],
  );
});
