import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DAYLIGHT_ENERGY_PROFILE,
  daylightEnergyRatios,
} from '../src/daylight-energy.js';

test('late humid daylight derives fill from the sky instead of directionless exposure', () => {
  const profile = DAYLIGHT_ENERGY_PROFILE;
  const ratios = daylightEnergyRatios(profile);
  assert.equal(profile.version, 'late-humid-daylight-energy-v2');
  assert.equal(profile.toneMappingExposure, 0.98);
  assert.equal(profile.fogDensityPerMeter, 0.0058);
  assert.equal(profile.environmentIntensity, 0.3);
  assert.equal(profile.ambientIntensity, 0.08);
  assert.equal(profile.hemisphereIntensity, 0.68);
  assert.equal(profile.sunIntensity, 2.65);
  assert.ok(ratios.skyToResidualAmbient >= 8);
  assert.ok(ratios.sunToSky > 3 && ratios.sunToSky < 4.5);
  assert.ok(ratios.environmentToSky > 0.4 && ratios.environmentToSky < 0.5);
  assert.equal(
    profile.energySources.environment,
    'preetham-sky-pmrem-specular-and-rough-dielectric-response',
  );
  assert.equal(
    profile.energySources.hemisphere,
    'upper-sky-irradiance-and-dark-ground-bounce',
  );
  assert.equal(profile.energySources.ambient, 'bounded-residual-multiple-scattering-only');
  assert.equal(profile.energySources.direct, 'single-approved-sun-direction');
  assert.equal(
    profile.energySources.fog,
    'analytic-height-density-with-sun-direction-single-scattering',
  );
  assert.deepEqual(profile.aerialPerspective, {
    version: 'analytic-height-aerial-perspective-v1',
    baseHeightMeters: -4,
    scaleHeightMeters: 22,
    extinctionAtBasePerMeter: 0.0058,
    mieAnisotropy: 0.58,
    sunScatterStrength: 0.28,
    maximumFogOpacity: 0.88,
    integrationModel: 'analytic-exponential-height-density-along-view-segment',
    scatteringModel: 'bounded-henyey-greenstein-solar-single-scattering',
  });
});

test('daylight ratios are finite and do not mutate the locked profile', () => {
  const ratios = daylightEnergyRatios();
  assert.ok(Object.values(ratios).every(Number.isFinite));
  assert.ok(Object.isFrozen(ratios));
  assert.ok(Object.isFrozen(DAYLIGHT_ENERGY_PROFILE));
  assert.ok(Object.isFrozen(DAYLIGHT_ENERGY_PROFILE.energySources));
  assert.ok(Object.isFrozen(DAYLIGHT_ENERGY_PROFILE.aerialPerspective));
});
