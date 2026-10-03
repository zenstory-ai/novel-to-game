import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';

const SHADOW_HALF_EXTENT = 38;
const SHADOW_DISTANCE = 160;
const forward = new THREE.Vector3();
const focus = new THREE.Vector3();

// One warm key (the low sun), one sky/ground hemisphere and the PMREM sky.
// The sun's shadow frustum is fitted around the view and snapped to whole
// texels so long late-day shadows stay crisp and do not swim while walking.
export function createFieldLighting(scene) {
  const hemisphere = new THREE.HemisphereLight(
    0x9fc4d6,
    0x3b3a26,
    DAYLIGHT_ENERGY_PROFILE.hemisphereIntensity,
  );
  const sun = new THREE.DirectionalLight(0xffc98a, DAYLIGHT_ENERGY_PROFILE.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -SHADOW_HALF_EXTENT;
  sun.shadow.camera.right = SHADOW_HALF_EXTENT;
  sun.shadow.camera.top = SHADOW_HALF_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_HALF_EXTENT;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = SHADOW_DISTANCE * 2;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 2.2;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(hemisphere, sun, sun.target);

  function follow(camera) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    focus.copy(camera.position).addScaledVector(forward, SHADOW_HALF_EXTENT * 0.55);
    const texel = (SHADOW_HALF_EXTENT * 2) / sun.shadow.mapSize.x;
    focus.x = Math.round(focus.x / texel) * texel;
    focus.z = Math.round(focus.z / texel) * texel;
    focus.y = 0;
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(SUN_DIRECTION, SHADOW_DISTANCE);
    sun.target.updateMatrixWorld();
  }

  return { sun, hemisphere, follow };
}
