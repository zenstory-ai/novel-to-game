export const DAYLIGHT_ENERGY_PROFILE = Object.freeze({
  version: 'low-western-sun-v3',
  toneMappingExposure: 1.18,
  fogDensityPerMeter: 0.0044,
  environmentIntensity: 0.6,
  hemisphereIntensity: 0.7,
  sunIntensity: 3.6,
  aerialPerspective: Object.freeze({
    version: 'analytic-height-aerial-perspective-v1',
    baseHeightMeters: -4,
    scaleHeightMeters: 22,
    extinctionAtBasePerMeter: 0.0044,
    mieAnisotropy: 0.58,
    sunScatterStrength: 0.3,
    maximumFogOpacity: 0.82,
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

