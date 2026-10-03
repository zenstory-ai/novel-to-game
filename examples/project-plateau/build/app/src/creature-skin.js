import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere-sky.js';

const SUN_RIM_COLOR = new THREE.Color(0xffc98a);

// Shared creature shading on top of the authored albedo/normal maps:
// countershading (paler underside), a soft wrap of sky fill, and a warm rim
// when the low sun sits behind the animal, so backlit silhouettes keep their
// edges against foliage instead of collapsing into flat dark shapes.
export function applyCreatureSkin(material, { rim = 0.45, belly = 0.22 } = {}) {
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.creatureSunDirection = { value: SUN_DIRECTION };
    shader.uniforms.creatureSunColor = { value: SUN_RIM_COLOR };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform vec3 creatureSunDirection;
        uniform vec3 creatureSunColor;
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        vec3 creatureWorldNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        float creatureBelly = smoothstep(0.2, -0.7, creatureWorldNormal.y);
        diffuseColor.rgb *= 1.0 + creatureBelly * ${belly.toFixed(3)};
        vec3 creatureView = normalize(vViewPosition);
        vec3 creatureSun = normalize((viewMatrix * vec4(creatureSunDirection, 0.0)).xyz);
        float creatureFacing = 1.0 - clamp(dot(normal, creatureView), 0.0, 1.0);
        float creatureBehind = clamp(dot(-creatureView, creatureSun) * 0.6 + 0.4, 0.0, 1.0);
        totalEmissiveRadiance += creatureSunColor * diffuseColor.rgb
          * pow(creatureFacing, 3.0) * creatureBehind * ${rim.toFixed(3)};
      `);
  };
  material.customProgramCacheKey = () => `${previousKey()}|creature-skin-v1`;
  material.needsUpdate = true;
  return material;
}
