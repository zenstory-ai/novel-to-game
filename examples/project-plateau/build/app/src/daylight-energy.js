export const DAYLIGHT_ENERGY_PROFILE = Object.freeze({
  version: 'late-humid-daylight-energy-v2',
  toneMappingExposure: 0.98,
  fogDensityPerMeter: 0.0058,
  environmentIntensity: 0.3,
  ambientIntensity: 0.08,
  hemisphereIntensity: 0.68,
  sunIntensity: 2.65,
  canopyRimIntensity: 0.3,
  subjectFillIntensity: 0.28,
  gladeBounceIntensity: 1,
  basaltBounceIntensity: 0.48,
  aerialPerspective: Object.freeze({
    version: 'analytic-height-aerial-perspective-v1',
    baseHeightMeters: -4,
    scaleHeightMeters: 22,
    extinctionAtBasePerMeter: 0.0058,
    mieAnisotropy: 0.58,
    sunScatterStrength: 0.28,
    maximumFogOpacity: 0.88,
    integrationModel: 'analytic-exponential-height-density-along-view-segment',
    scatteringModel: 'bounded-henyey-greenstein-solar-single-scattering',
  }),
  energySources: Object.freeze({
    environment: 'preetham-sky-pmrem-specular-and-rough-dielectric-response',
    hemisphere: 'upper-sky-irradiance-and-dark-ground-bounce',
    ambient: 'bounded-residual-multiple-scattering-only',
    direct: 'single-approved-sun-direction',
    fog: 'analytic-height-density-with-sun-direction-single-scattering',
  }),
});

export function daylightEnergyRatios(profile = DAYLIGHT_ENERGY_PROFILE) {
  return Object.freeze({
    skyToResidualAmbient: profile.hemisphereIntensity / profile.ambientIntensity,
    sunToSky: profile.sunIntensity / profile.hemisphereIntensity,
    environmentToSky: profile.environmentIntensity / profile.hemisphereIntensity,
  });
}
