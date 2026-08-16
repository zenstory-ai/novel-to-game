import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  applyBrookObstacleFlowField,
  createBrookMaterial,
} from '../src/brook-material.js';
import { createBrookSceneCapture } from '../src/brook-scene-capture.js';
import {
  soilTextures,
  terrainMacroControlTexture,
  waterTextures,
} from '../src/terrain-material-textures.js';

function byteSum(texture) {
  return texture.image.data.reduce((total, value) => total + value, 0);
}

test('terrain and brook texture generation remains deterministic', () => {
  const textureContract = [
    [soilTextures.albedo, 'world.material.soil-albedo', 256, 29_914_544],
    [soilTextures.roughness, 'world.material.soil-roughness', 256, 44_022_486],
    [soilTextures.height, 'world.material.soil-macro-detail', 256, 25_742_857],
    [terrainMacroControlTexture, 'world.material.terrain-macro-control', 256, 41_736_016],
    [waterTextures.albedo, 'world.material.brook-albedo', 128, 8_655_054],
    [waterTextures.roughness, 'world.material.brook-roughness', 128, 9_652_662],
    [waterTextures.normal, 'world.material.brook-normal', 128, 12_529_918],
  ];

  for (const [texture, name, size, expectedByteSum] of textureContract) {
    assert.equal(texture.name, name);
    assert.deepEqual([texture.image.width, texture.image.height], [size, size]);
    assert.equal(byteSum(texture), expectedByteSum, `${name} pixel contract changed`);
  }
});

test('brook material and obstacle flow preserve the public uniform contract', () => {
  const material = createBrookMaterial(waterTextures, soilTextures);
  assert.equal(material.name, 'Project Plateau measured-column shallow brook');
  assert.equal(material.type, 'ShaderMaterial');
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  assert.equal(Object.keys(material.uniforms).length, 44);

  const obstacle = {
    x: -4.5,
    z: 11.25,
    radiusMeters: 0.3,
    upperColumnContact: 0.72,
    flowDirection: new THREE.Vector2(0.6, -0.8),
    wakeLengthMeters: 2.4,
    wakeHalfWidthMeters: 0.55,
    deflectionRadiusMeters: 0.7,
    normalSlope: 0.12,
    aeration: 0.31,
    roughnessGain: 0.24,
  };
  applyBrookObstacleFlowField(material, { selected: [obstacle], rejected: [] });

  assert.equal(material.uniforms.obstacleCount.value, 1);
  assert.deepEqual(
    material.uniforms.obstacleCenterRadiusContact.value[0].toArray(),
    [-4.5, 11.25, 0.3, 0.72],
  );
  assert.deepEqual(
    material.uniforms.obstacleFlowWake.value[0].toArray(),
    [0.6, -0.8, 2.4, 0.55],
  );
  assert.deepEqual(
    material.uniforms.obstacleResponse.value[0].toArray(),
    [0.7, 0.12, 0.31, 0.24],
  );
});

test('brook scene capture exposes the same fallback and low-quality lifecycle', () => {
  const scene = new THREE.Scene();
  const brook = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    createBrookMaterial(waterTextures, soilTextures),
  );
  scene.add(brook);
  const reach = {
    id: 'test-reach',
    branch: 'main',
    center: new THREE.Vector3(0, 1, 0),
    normal: new THREE.Vector3(0, 1, 0),
    tangent: new THREE.Vector3(0, 0, 1),
    halfWidth: 2,
    halfLength: 5,
    maxSurfaceDeviation: 0.02,
  };

  const capture = createBrookSceneCapture(scene, brook, { reaches: [reach] });
  assert.deepEqual(capture.snapshot(), {
    status: 'pending-renderer',
    quality: 'balanced',
    reflectionResolution: [512, 256],
    panoramaBuilds: 1,
    sourceObjectCount: 0,
    planarResolution: [320, 180],
    planarCaptures: 0,
    reachCount: 1,
    activeReachId: 'test-reach',
    activeBranch: 'main',
    activePlaneHeight: 1,
    activePlaneNormal: [0, 1, 0],
    activePlaneTolerance: 0.1,
    reachSwitches: 0,
    refractionResolution: [480, 270],
    refractionCaptures: 0,
    reflectionMode: 'scene-layout-equirectangular-probe-fallback',
    planarMode: 'camera-selected-oblique-clipped-gravity-reach-reflection',
    refractionMode: 'same-camera-depth-refracted-scene-with-channel-bed-fallback',
    ssrMode: 'pending-same-camera-depth-screen-space-reflection',
    ssrSteps: 12,
    ssrRangeMeters: 38,
    renderError: null,
  });

  capture.setQuality('low');
  assert.deepEqual(
    {
      status: capture.snapshot().status,
      quality: capture.snapshot().quality,
      ssrMode: capture.snapshot().ssrMode,
      ssrSteps: capture.snapshot().ssrSteps,
      refractionMode: capture.snapshot().refractionMode,
    },
    {
      status: 'disabled-low',
      quality: 'low',
      ssrMode: 'disabled-low',
      ssrSteps: 0,
      refractionMode: 'channel-bed-fallback-low-quality',
    },
  );
});
