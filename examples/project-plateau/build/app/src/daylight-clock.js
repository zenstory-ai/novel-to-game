import * as THREE from 'three';
import { SUN_DIRECTION, applyAtmosphereEnvironment } from './atmosphere-sky.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';

// The 300-second light budget made visible: the sun sinks from about 17 to
// 13 degrees (still clear of the western wall from the glade), reddens and weakens; fog warms and the exposure opens a little.
const START_ELEVATION = Math.asin(SUN_DIRECTION.y);
// Ends above the western wall so the last-light sun disc stays in view.
const END_ELEVATION = THREE.MathUtils.degToRad(13);
const AZIMUTH = Math.atan2(SUN_DIRECTION.z, SUN_DIRECTION.x);
const SUN_COLOR = Object.freeze({ start: new THREE.Color(0xffc98a), end: new THREE.Color(0xff9a5a) });
const WARM_FOG = new THREE.Color(0xc29a7c);
const SKY_DUSK = Object.freeze({
  zenith: new THREE.Color(0x2e4470),
  upper: new THREE.Color(0xc89a86),
  horizon: new THREE.Color(0xf07f45),
  sun: new THREE.Color(0xffa860),
});

// Most of the sky change is held for the final minute, so last light reads
// as an evening, not as the same afternoon a little dimmer.
function duskWeight(t) {
  return t * 0.4 + THREE.MathUtils.smoothstep(t, 0.6, 1) * 0.6;
}
const ENVIRONMENT_REFRESH_SECONDS = 30;

export function sunDirectionForProgress(progress, target = new THREE.Vector3()) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const elevation = THREE.MathUtils.lerp(START_ELEVATION, END_ELEVATION, t);
  return target.set(
    Math.cos(elevation) * Math.cos(AZIMUTH),
    Math.sin(elevation),
    Math.cos(elevation) * Math.sin(AZIMUTH),
  );
}

export function createDaylightClock({ scene, renderer, sun, hemisphere, environment }) {
  const baseFog = scene.fog.color.clone();
  const sky = scene.getObjectByName('world.atmosphere.painted-sky')?.material.uniforms;
  const baseSky = sky && {
    zenith: sky.zenithColor.value.clone(),
    upper: sky.upperColor.value.clone(),
    horizon: sky.horizonWarm.value.clone(),
    horizonCool: sky.horizonCool.value.clone(),
    sun: sky.sunColor.value.clone(),
  };
  let environmentTarget = environment;
  let environmentProgress = 0;
  let lastRefreshAt = -Infinity;
  return {
    // `progress` is 0 at full light and 1 when the light runs out.
    update(progress, nowSeconds) {
      const t = THREE.MathUtils.clamp(progress, 0, 1);
      sunDirectionForProgress(t, SUN_DIRECTION);
      sun.color.copy(SUN_COLOR.start).lerp(SUN_COLOR.end, t);
      sun.intensity = DAYLIGHT_ENERGY_PROFILE.sunIntensity * THREE.MathUtils.lerp(1, 0.6, t);
      hemisphere.intensity = DAYLIGHT_ENERGY_PROFILE.hemisphereIntensity * THREE.MathUtils.lerp(1, 0.55, t);
      scene.fog.color.copy(baseFog).lerp(WARM_FOG, t * 0.6);
      renderer.toneMappingExposure = DAYLIGHT_ENERGY_PROFILE.toneMappingExposure + 0.1 * t;
      if (sky) {
        const dusk = duskWeight(t);
        sky.zenithColor.value.copy(baseSky.zenith).lerp(SKY_DUSK.zenith, dusk * 0.8);
        sky.upperColor.value.copy(baseSky.upper).lerp(SKY_DUSK.upper, dusk * 0.85);
        sky.horizonWarm.value.copy(baseSky.horizon).lerp(SKY_DUSK.horizon, dusk);
        sky.horizonCool.value.copy(baseSky.horizonCool).lerp(SKY_DUSK.upper, dusk * 0.6);
        sky.sunColor.value.copy(baseSky.sun).lerp(SKY_DUSK.sun, dusk);
      }
      const stale = Math.abs(t - environmentProgress) > 0.02;
      if (stale && nowSeconds - lastRefreshAt >= ENVIRONMENT_REFRESH_SECONDS) {
        environmentTarget = applyAtmosphereEnvironment(scene, renderer, environmentTarget);
        environmentProgress = t;
        lastRefreshAt = nowSeconds;
      }
    },
    reset(nowSeconds) {
      lastRefreshAt = -Infinity;
      this.update(0, nowSeconds);
    },
  };
}
