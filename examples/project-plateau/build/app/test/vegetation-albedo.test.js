import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  VEGETATION_ALBEDO_FAMILIES,
  VEGETATION_ALBEDO_PROFILE,
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from '../src/vegetation-albedo.js';

test('foliage albedo families stay bounded and respond to physical habitat sources', () => {
  for (const family of VEGETATION_ALBEDO_FAMILIES) {
    const dry = vegetationLeafTint(family, { wetness: 0, slope: 0.12, individual: 0.5 });
    const wet = vegetationLeafTint(family, { wetness: 0.5, slope: 0.02, individual: 0.5 });
    for (const sample of [dry, wet]) {
      assert.ok(sample.lightness >= VEGETATION_ALBEDO_PROFILE.minimumInstanceLightness);
      assert.ok(sample.lightness <= VEGETATION_ALBEDO_PROFILE.maximumInstanceLightness);
      assert.ok(
        sample.saturation >= VEGETATION_ALBEDO_PROFILE.minimumInstanceSaturation
          && sample.saturation <= VEGETATION_ALBEDO_PROFILE.maximumInstanceSaturation,
      );
    }
    assert.ok(wet.lightness < dry.lightness, `${family} wet film must lower diffuse leaf return`);
  }
});

test('material multipliers remain mid-value dielectric colours instead of white tint layers', () => {
  for (const [family, value] of Object.entries(VEGETATION_BASE_COLOURS)) {
    const colour = new THREE.Color(value);
    const luminance = colour.r * 0.2126 + colour.g * 0.7152 + colour.b * 0.0722;
    assert.ok(luminance >= 0.18, `${family} base is crushed: ${luminance}`);
    assert.ok(luminance <= 0.4, `${family} base is an over-bright multiplier: ${luminance}`);
  }
  const structure = vegetationStructureTint({ wetness: 0.35, individual: 0.8 });
  assert.ok(structure.lightness >= 0.56 && structure.lightness <= 0.7);
});
