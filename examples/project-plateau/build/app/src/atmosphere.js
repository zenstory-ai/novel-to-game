import * as THREE from 'three';
import { createMistLayer } from './atmosphere-mist.js';
import { createRidge } from './atmosphere-ridges.js';
import { createDisplaySky } from './atmosphere-sky.js';

export function createAtmosphere(scene) {
  const group = new THREE.Group();
  group.name = 'world.atmosphere';
  const sky = createDisplaySky();
  group.add(
    sky,
    createRidge('world.atmosphere.far-ridge', -154, 74, -18, [12, 31], 0x394840, 811),
    createRidge('world.atmosphere.near-ridge', -104.5, 65, -16, [8, 23], 0x3c4a35, 419, true),
    createMistLayer('world.atmosphere.mist-near', -47, 0.048, 0x9fb7ad, 241),
    createMistLayer('world.atmosphere.mist-mid', -82, 0.082, 0xa7bdb6, 517),
    createMistLayer('world.atmosphere.mist-far', -116, 0.122, 0xb2c4c0, 881),
  );
  group.userData.ridgeForestSnapshot = () => {
    const ridges = ['far-ridge', 'near-ridge'].map((ridge) => {
      const object = group.getObjectByName(`world.atmosphere.${ridge}`);
      return object?.userData.forest ?? null;
    }).filter(Boolean);
    return { ridgeCount: ridges.length, ridges };
  };
  group.userData.update = (elapsed, reducedMotion = false) => {
    sky.material.uniforms.time.value = reducedMotion ? 0 : elapsed;
  };
  scene.add(group);
  return group;
}

export { RIDGE_SURFACE_PROFILE } from './atmosphere-ridges.js';
export { SUN_DIRECTION, applyAtmosphereEnvironment } from './atmosphere-sky.js';
