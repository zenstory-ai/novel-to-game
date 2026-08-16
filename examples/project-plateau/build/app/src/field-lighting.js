import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';

export function createFieldLighting(scene) {
  const ambient = new THREE.AmbientLight(
    0x718889,
    DAYLIGHT_ENERGY_PROFILE.ambientIntensity,
  );
  const hemisphere = new THREE.HemisphereLight(
    0x91aaa9,
    0x2b372e,
    DAYLIGHT_ENERGY_PROFILE.hemisphereIntensity,
  );
  const sun = new THREE.DirectionalLight(0xffbd70, DAYLIGHT_ENERGY_PROFILE.sunIntensity);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(106);
  sun.target.position.set(1, 0, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -58;
  sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 74;
  sun.shadow.camera.bottom = -74;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 230;
  sun.shadow.bias = -0.00045;
  sun.shadow.normalBias = 0.028;
  sun.shadow.radius = 2.4;
  const gladeFill = new THREE.PointLight(
    0xe9a85f,
    DAYLIGHT_ENERGY_PROFILE.gladeBounceIntensity,
    48,
    2.05,
  );
  gladeFill.position.set(-4, 13, -18);
  const canopyRim = new THREE.DirectionalLight(
    0x82b6bc,
    DAYLIGHT_ENERGY_PROFILE.canopyRimIntensity,
  );
  canopyRim.position.set(32, 24, -36);
  const subjectFill = new THREE.DirectionalLight(
    0xd8c3a0,
    DAYLIGHT_ENERGY_PROFILE.subjectFillIntensity,
  );
  subjectFill.position.set(-12, 15, 36);
  subjectFill.target.position.set(1, 2.2, -33);
  const basaltBounce = new THREE.PointLight(
    0x8a7770,
    DAYLIGHT_ENERGY_PROFILE.basaltBounceIntensity,
    56,
    2.15,
  );
  basaltBounce.position.set(23, 11, -21);
  scene.add(
    ambient,
    hemisphere,
    sun,
    sun.target,
    gladeFill,
    canopyRim,
    subjectFill,
    subjectFill.target,
    basaltBounce,
  );
  return { sun };
}
