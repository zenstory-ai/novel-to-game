import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { DAYLIGHT_ENERGY_PROFILE } from '../src/daylight-energy.js';
import {
  createHeightFogController,
  heightFogTransmittance,
  integratedHeightFogOpticalDepth,
} from '../src/height-fog.js';

test('analytic height fog integrates extinction along the actual vertical segment', () => {
  const lowHorizontal = integratedHeightFogOpticalDepth({
    distanceMeters: 100,
    cameraHeightMeters: 4,
    fragmentHeightMeters: 4,
  });
  const highHorizontal = integratedHeightFogOpticalDepth({
    distanceMeters: 100,
    cameraHeightMeters: 34,
    fragmentHeightMeters: 34,
  });
  const risingSegment = integratedHeightFogOpticalDepth({
    distanceMeters: 100,
    cameraHeightMeters: 4,
    fragmentHeightMeters: 34,
  });

  assert.ok(lowHorizontal > risingSegment);
  assert.ok(risingSegment > highHorizontal);
  assert.ok(lowHorizontal > 0.3 && lowHorizontal < 0.5, lowHorizontal);
  assert.equal(integratedHeightFogOpticalDepth({
    distanceMeters: 0,
    cameraHeightMeters: 4,
    fragmentHeightMeters: 4,
  }), 0);
  assert.ok(heightFogTransmittance({
    distanceMeters: 200,
    cameraHeightMeters: 4,
    fragmentHeightMeters: 4,
  }) < heightFogTransmittance({
    distanceMeters: 50,
    cameraHeightMeters: 4,
    fragmentHeightMeters: 4,
  }));
});

test('height fog controller patches physical materials once and reports its boundary', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const material = new THREE.MeshStandardMaterial();
  const excluded = new THREE.ShaderMaterial();
  scene.add(
    new THREE.Mesh(new THREE.BoxGeometry(), material),
    new THREE.Mesh(new THREE.BoxGeometry(), excluded),
  );
  const controller = createHeightFogController(
    camera,
    new THREE.Vector3(-0.44, 0.55, 0.71).normalize(),
  );
  const first = controller.applyTo(scene);
  const second = controller.applyTo(scene);

  assert.equal(first.version, 'analytic-height-aerial-perspective-v1');
  assert.equal(first.installedMaterialCount, 1);
  assert.equal(first.skippedShaderMaterialCount, 1);
  assert.deepEqual(second, first);
  assert.equal(material.userData.heightFog.version, first.version);
  assert.match(material.customProgramCacheKey(), /plateau-analytic-height-fog-v1/);
  assert.equal(excluded.userData.heightFog, undefined);
  assert.equal(first.extinctionAtBasePerMeter, DAYLIGHT_ENERGY_PROFILE.fogDensityPerMeter);
});
