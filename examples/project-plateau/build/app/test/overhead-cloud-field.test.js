import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createHeightFogController } from '../src/height-fog.js';
import {
  OVERHEAD_CLOUD_PROFILE,
  createCloudDensityData,
  createOverheadCloudField,
  projectPointToCloudLevel,
} from '../src/overhead-cloud-field.js';

const SUN_DIRECTION = new THREE.Vector3(-0.44, 0.55, 0.71).normalize();

test('overhead cloud density is deterministic, seamless-scale and coverage bounded', () => {
  const first = createCloudDensityData();
  const second = createCloudDensityData();
  assert.equal(first.resolution, 256);
  assert.deepEqual(first.data, second.data);
  assert.deepEqual(first.statistics, {
    minimum: 0.2031,
    maximum: 0.8381,
    mean: 0.5095,
    coverageFraction: 0.3456,
  });
  assert.equal(first.data.length, 256 * 256);
  assert.ok(first.statistics.coverageFraction > 0.3);
  assert.ok(first.statistics.coverageFraction < 0.42);
});

test('ground projection and transmittance use the same advected cloud field', () => {
  const clouds = createOverheadCloudField(SUN_DIRECTION);
  const point = new THREE.Vector3(12, 2, -18);
  const hit = projectPointToCloudLevel(point, SUN_DIRECTION);
  assert.equal(
    hit.y,
    OVERHEAD_CLOUD_PROFILE.altitudeMeters
      + OVERHEAD_CLOUD_PROFILE.thicknessMeters * 0.5,
  );
  const travel = hit.clone().sub(point);
  assert.ok(travel.clone().normalize().dot(SUN_DIRECTION) > 0.999999);
  const beforeDensity = clouds.densityAt(point.x, point.z);
  const beforeTransmittance = clouds.sunTransmittanceAt(point);
  clouds.update(30, false, 'balanced');
  assert.notEqual(clouds.densityAt(point.x, point.z), beforeDensity);
  assert.notEqual(clouds.sunTransmittanceAt(point), beforeTransmittance);
  assert.deepEqual(clouds.snapshot().windOffsetMeters, [31.5, 8.4]);
  assert.ok(clouds.sunTransmittanceAt(point) >= 0.58);
  assert.ok(clouds.sunTransmittanceAt(point) <= 1);
  clouds.update(30, true, 'balanced');
  assert.deepEqual(clouds.snapshot().windOffsetMeters, [0, 0]);
});

test('cloud shadow patch chains after height fog and is disabled completely on low', () => {
  const camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({ fog: true });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const heightFog = createHeightFogController(camera, SUN_DIRECTION);
  heightFog.applyTo(scene);
  const clouds = createOverheadCloudField(SUN_DIRECTION);
  const snapshot = clouds.applyTo(scene);
  assert.equal(snapshot.shadow.installedMaterialCount, 1);
  assert.equal(material.userData.overheadCloudShadow.version, OVERHEAD_CLOUD_PROFILE.version);
  assert.match(material.customProgramCacheKey(), /plateau-overhead-cloud-shadow-v1/);

  const shader = {
    uniforms: {},
    vertexShader: '#include <fog_pars_vertex>\n#include <fog_vertex>',
    fragmentShader: [
      '#include <fog_pars_fragment>',
      '#include <lights_fragment_begin>',
      '#include <fog_fragment>',
    ].join('\n'),
  };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.uniforms.plateauCloudDensityMap.value.isDataTexture);
  assert.match(shader.fragmentShader, /plateauCloudSunTransmittance/);
  assert.match(shader.fragmentShader, /reflectedLight\.directDiffuse/);
  assert.match(shader.fragmentShader, /vPlateauFogWorldPosition/);

  clouds.update(4, false, 'low');
  assert.equal(clouds.mesh.visible, false);
  assert.equal(shader.uniforms.plateauCloudQualityStrength.value, 0);
  clouds.update(4, false, 'high');
  assert.equal(clouds.mesh.visible, true);
  assert.equal(shader.uniforms.plateauCloudQualityStrength.value, 1);
});
