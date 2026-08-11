export const VEGETATION_ALBEDO_PROFILE = Object.freeze({
  version: 'source-coupled-bounded-foliage-albedo-v1',
  energyModel: 'non-emissive-dielectric-diffuse-plus-shadowed-thin-leaf-transmission',
  minimumInstanceLightness: 0.42,
  maximumInstanceLightness: 0.66,
  minimumInstanceSaturation: 0.035,
  maximumInstanceSaturation: 0.12,
  wetLeafDiffuseLoss: 0.075,
  drainedExposureGain: 0.028,
  individualVariationSpan: 0.022,
  sourceModel: 'material-pigment-plus-neutral-habitat-wetness-slope-and-bounded-individual-age',
});

export const VEGETATION_BASE_COLOURS = Object.freeze({
  canopyBroadleaf: 0x8d9d89,
  canopyAraucaria: 0x748173,
  treeFernLeaf: 0x899985,
  treeFernRachis: 0x89917f,
  fernLeaf: 0x8f9e86,
  fernStructure: 0xa79780,
  groundCoverLeaf: 0x788871,
  groundCoverStructure: 0x707965,
});

const FAMILY_PROFILES = Object.freeze({
  // The material colour and correlated albedo texture already carry the leaf
  // pigment spectrum. Instance colour is therefore deliberately close to a
  // neutral multiplier: repeating a saturated green at all three layers would
  // multiply red/blue away and create the implausible neon-green result.
  'canopy-humid-broadleaf': Object.freeze({ hue: 0.318, saturation: 0.09, lightness: 0.53 }),
  'canopy-drained-broadleaf': Object.freeze({ hue: 0.302, saturation: 0.06, lightness: 0.57 }),
  'canopy-compound-margin': Object.freeze({ hue: 0.292, saturation: 0.07, lightness: 0.555 }),
  'canopy-araucaria': Object.freeze({ hue: 0.305, saturation: 0.055, lightness: 0.47 }),
  'tree-fern-humid': Object.freeze({ hue: 0.31, saturation: 0.085, lightness: 0.53 }),
  'tree-fern-exposed': Object.freeze({ hue: 0.29, saturation: 0.06, lightness: 0.575 }),
  'tree-fern-sheltered': Object.freeze({ hue: 0.3, saturation: 0.075, lightness: 0.545 }),
  'fern-humid': Object.freeze({ hue: 0.322, saturation: 0.095, lightness: 0.565 }),
  'fern-upland': Object.freeze({ hue: 0.284, saturation: 0.055, lightness: 0.605 }),
  'fern-sheltered': Object.freeze({ hue: 0.305, saturation: 0.075, lightness: 0.58 }),
  'ground-cover-arrowhead': Object.freeze({ hue: 0.318, saturation: 0.085, lightness: 0.52 }),
  'ground-cover-rosette': Object.freeze({ hue: 0.302, saturation: 0.065, lightness: 0.505 }),
  'ground-cover-sedge': Object.freeze({ hue: 0.27, saturation: 0.055, lightness: 0.53 }),
});

export const VEGETATION_ALBEDO_FAMILIES = Object.freeze(Object.keys(FAMILY_PROFILES));

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function vegetationLeafTint(family, {
  wetness = 0,
  slope = 0,
  individual = 0.5,
} = {}) {
  const profile = FAMILY_PROFILES[family];
  if (!profile) throw new RangeError(`Unknown vegetation albedo family: ${family}`);
  const boundedWetness = clamp(wetness);
  const drainedExposure = clamp(slope / 0.18);
  const boundedIndividual = clamp(individual);
  const lightness = clamp(
    profile.lightness
      - boundedWetness * VEGETATION_ALBEDO_PROFILE.wetLeafDiffuseLoss
      + drainedExposure * VEGETATION_ALBEDO_PROFILE.drainedExposureGain
      + (boundedIndividual - 0.5) * VEGETATION_ALBEDO_PROFILE.individualVariationSpan,
    VEGETATION_ALBEDO_PROFILE.minimumInstanceLightness,
    VEGETATION_ALBEDO_PROFILE.maximumInstanceLightness,
  );
  const saturation = clamp(
    profile.saturation + boundedWetness * 0.015 - drainedExposure * 0.01,
    VEGETATION_ALBEDO_PROFILE.minimumInstanceSaturation,
    VEGETATION_ALBEDO_PROFILE.maximumInstanceSaturation,
  );
  return Object.freeze({
    hue: profile.hue,
    saturation,
    lightness,
    family,
  });
}

export function vegetationStructureTint({
  hue = 0.09,
  wetness = 0,
  individual = 0.5,
  baseLightness = 0.66,
} = {}) {
  return Object.freeze({
    hue,
    saturation: clamp(0.075 + wetness * 0.035, 0.06, 0.13),
    lightness: clamp(
      baseLightness - clamp(wetness) * 0.045 + (clamp(individual) - 0.5) * 0.018,
      0.56,
      0.7,
    ),
  });
}
