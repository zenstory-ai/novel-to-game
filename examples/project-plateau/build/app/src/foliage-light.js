import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere-sky.js';

const SUN_TINT = new THREE.Color(0xffd29a);

// Thin foliage lets the low sun glow through it when the scout looks toward
// the light. Without this, backlit understorey reads as black cut-outs
// against the bright haze.
export function applyFoliageLight(material, strength = 0.9) {
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.foliageSunDirection = { value: SUN_DIRECTION };
    shader.uniforms.foliageSunTint = { value: SUN_TINT };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform vec3 foliageSunDirection;
        uniform vec3 foliageSunTint;
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        vec3 foliageView = normalize(vViewPosition);
        vec3 foliageSun = normalize((viewMatrix * vec4(foliageSunDirection, 0.0)).xyz);
        float foliageBacklit = pow(max(dot(-foliageView, foliageSun), 0.0), 3.0);
        totalEmissiveRadiance += foliageSunTint * diffuseColor.rgb * foliageBacklit * ${strength.toFixed(2)};
      `);
  };
  material.customProgramCacheKey = () => `${previousKey()}|foliage-light-v1`;
  material.needsUpdate = true;
  return material;
}
