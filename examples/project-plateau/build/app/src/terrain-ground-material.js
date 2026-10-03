import * as THREE from 'three';
import { GROUND_LAYER_NAMES, GROUND_TILE_METERS } from './ground-layers.js';

// Height-blended PBR ground: the per-vertex ecology masks already computed for
// the terrain (humus, wet bank, route wear, point bar, bedrock...) choose
// between five Blender-baked layers; each layer's own height map decides the
// exact transition, so pebbles poke through mud and leaves pile over moss.
// Steep faces switch to triplanar projection so banks and cliffs never smear.
// Scenic landforms without ecology attributes pass fixed `masks` instead.
const LAYER_DEFINES = GROUND_LAYER_NAMES
  .map((name, index) => `#define GROUND_${name.toUpperCase()} ${index}`)
  .join('\n');

const ATTRIBUTE_MASKS = `
  attribute float terrainWetness;
  attribute float terrainSlope;
  attribute float terrainBasaltInfluence;
  attribute float terrainBedrockExposure;
  attribute float terrainHumus;
  attribute float terrainWetBank;
  attribute float terrainMineralExposure;
  attribute float terrainRouteWear;
  attribute float terrainAlluvium;
  attribute vec4 terrainFluvialSurface;
`;

const ATTRIBUTE_MASK_VERTEX = `
  float rockMask = max(max(terrainBedrockExposure, terrainBasaltInfluence * 0.85),
    smoothstep(0.55, 0.95, terrainSlope));
  float gravelMask = max(max(terrainFluvialSurface.x, terrainMineralExposure * 0.7),
    terrainAlluvium * 0.45);
  float mudMask = max(max(terrainWetBank, terrainWetness * 0.75),
    max(terrainRouteWear * 0.85, max(terrainFluvialSurface.z * 0.7, terrainFluvialSurface.y * 0.55)));
  float mossMask = max(terrainFluvialSurface.w, 0.35 * (1.0 - terrainHumus)) + 0.12;
  vGroundMaskA = vec4(terrainHumus, mossMask, mudMask, gravelMask);
  vGroundMaskB = vec4(rockMask, max(terrainWetBank, terrainWetness * 0.7), 0.0, 0.0);
`;

const FIXED_MASK_VERTEX = `
  vGroundMaskA = groundFixedMaskA;
  vGroundMaskB = groundFixedMaskB;
`;

export function createGroundMaterial(textures, { masks = null, side = THREE.FrontSide, tileMeters = GROUND_TILE_METERS } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    side,
  });
  const fixed = masks ? {
    a: new THREE.Vector4(masks.litter ?? 0, masks.moss ?? 0, masks.mud ?? 0, masks.gravel ?? 0),
    b: new THREE.Vector4(masks.rock ?? 0, masks.wet ?? 0, 0, 0),
  } : null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.groundAlbedo = { value: textures.albedo };
    shader.uniforms.groundNormal = { value: textures.normal };
    shader.uniforms.groundOrh = { value: textures.orh };
    shader.uniforms.groundTile = { value: 1 / tileMeters };
    if (fixed) {
      shader.uniforms.groundFixedMaskA = { value: fixed.a };
      shader.uniforms.groundFixedMaskB = { value: fixed.b };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        ${fixed ? 'uniform vec4 groundFixedMaskA;\nuniform vec4 groundFixedMaskB;' : ATTRIBUTE_MASKS}
        varying vec4 vGroundMaskA;
        varying vec4 vGroundMaskB;
        varying vec3 vGroundWorld;
      `)
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        ${fixed ? FIXED_MASK_VERTEX : ATTRIBUTE_MASK_VERTEX}
        vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        ${LAYER_DEFINES}
        precision highp sampler2DArray;
        uniform sampler2DArray groundAlbedo;
        uniform sampler2DArray groundNormal;
        uniform sampler2DArray groundOrh;
        uniform float groundTile;
        varying vec4 vGroundMaskA;
        varying vec4 vGroundMaskB;
        varying vec3 vGroundWorld;

        float groundHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float groundNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), u.x),
            mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        vec3 groundAlbedoOut;
        vec3 groundNormalOut;
        vec3 groundOrhOut;

        // Triplanar fetch; flat ground (w.y ~ 1) pays for a single projection.
        vec4 groundFetch(sampler2DArray map, vec3 p, vec3 w, float layer) {
          if (w.y > 0.995) return texture(map, vec3(p.xz, layer));
          return texture(map, vec3(p.zy, layer)) * w.x
            + texture(map, vec3(p.xz, layer)) * w.y
            + texture(map, vec3(p.xy, layer)) * w.z;
        }

        // Whiteout-blended triplanar normal (tangent green is image-up, i.e. -v).
        vec3 groundFetchNormal(vec3 p, vec3 w, vec3 n, float layer) {
          vec3 ty = texture(groundNormal, vec3(p.xz, layer)).xyz * 2.0 - 1.0;
          ty.y = -ty.y;
          vec3 worldY = vec3(ty.x + n.x, abs(ty.z) * n.y, ty.y + n.z);
          if (w.y > 0.995) return worldY;
          vec3 tx = texture(groundNormal, vec3(p.zy, layer)).xyz * 2.0 - 1.0;
          vec3 tz = texture(groundNormal, vec3(p.xy, layer)).xyz * 2.0 - 1.0;
          tx.y = -tx.y;
          tz.y = -tz.y;
          vec3 worldX = vec3(abs(tx.z) * n.x, tx.y + n.y, tx.x + n.z);
          vec3 worldZ = vec3(tz.x + n.x, tz.y + n.y, abs(tz.z) * n.z);
          return worldX * w.x + worldY * w.y + worldZ * w.z;
        }

        void sampleGround(vec3 p, vec3 pB, vec3 w, vec3 n, float detailMix, float weights[5]) {
          groundAlbedoOut = vec3(0.0);
          groundNormalOut = vec3(0.0);
          groundOrhOut = vec3(0.0);
          for (int layer = 0; layer < 5; layer++) {
            float weight = weights[layer];
            if (weight < 0.004) continue;
            float slice = float(layer);
            vec3 a = mix(groundFetch(groundAlbedo, p, w, slice).rgb,
              groundFetch(groundAlbedo, pB, w, slice).rgb, detailMix);
            vec3 o = mix(groundFetch(groundOrh, p, w, slice).rgb,
              groundFetch(groundOrh, pB, w, slice).rgb, detailMix * 0.5);
            groundAlbedoOut += a * weight;
            groundNormalOut += groundFetchNormal(p, w, n, slice) * weight;
            groundOrhOut += o * weight;
          }
        }
      `)
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec3 groundGeoNormal = normalize(cross(dFdx(vGroundWorld), dFdy(vGroundWorld)));
        if (groundGeoNormal.y < 0.0) groundGeoNormal = -groundGeoNormal;
        vec3 groundW = pow(abs(groundGeoNormal), vec3(4.0));
        groundW /= groundW.x + groundW.y + groundW.z;
        vec3 groundP = vGroundWorld * groundTile;
        // A rotated, larger second sample and a macro noise break up tiling.
        vec3 groundPB = vec3(
          groundP.x * 0.79 - groundP.z * 0.61,
          groundP.y,
          groundP.x * 0.61 + groundP.z * 0.79
        ) * 0.41 + vec3(0.37, 0.0, 0.11);
        float groundMacro = groundNoise(vGroundWorld.xz * 0.07) * 0.65
          + groundNoise(vGroundWorld.xz * 0.21) * 0.35;
        float detailMix = 0.5 * smoothstep(0.25, 0.75, groundNoise(vGroundWorld.xz * 0.11));

        float masks[5];
        masks[GROUND_LITTER] = vGroundMaskA.x * (0.75 + groundMacro * 0.5);
        masks[GROUND_MOSS] = vGroundMaskA.y * (1.25 - groundMacro * 0.5);
        masks[GROUND_MUD] = vGroundMaskA.z;
        masks[GROUND_GRAVEL] = vGroundMaskA.w;
        masks[GROUND_ROCK] = vGroundMaskB.x;
        float heights[5];
        float blendTop = -10.0;
        for (int layer = 0; layer < 5; layer++) {
          heights[layer] = groundFetch(groundOrh, groundP, groundW, float(layer)).b;
          blendTop = max(blendTop, masks[layer] * 1.4 + heights[layer] * 0.6);
        }
        float weights[5];
        float weightSum = 0.0;
        for (int layer = 0; layer < 5; layer++) {
          weights[layer] = max(masks[layer] * 1.4 + heights[layer] * 0.6 - (blendTop - 0.22), 0.0);
          weightSum += weights[layer];
        }
        for (int layer = 0; layer < 5; layer++) weights[layer] /= max(weightSum, 1e-4);
        sampleGround(groundP, groundPB, groundW, groundGeoNormal, detailMix, weights);

        float groundWet = clamp(vGroundMaskB.y, 0.0, 1.0);
        vec3 groundColor = groundAlbedoOut;
        groundColor *= mix(1.0, 0.52, groundWet);
        groundColor *= 0.86 + groundMacro * 0.28;
        groundColor *= mix(1.0, groundOrhOut.r, 0.45);
        // Steep red earth reads as bedded sediment, not a smooth wash.
        float groundStrata = smoothstep(0.15, 0.6, 1.0 - groundGeoNormal.y) * weights[GROUND_ROCK];
        float groundBand = sin(vGroundWorld.y * 5.5 + groundNoise(vGroundWorld.xz * 0.3) * 4.0);
        groundColor *= mix(1.0, 0.62 + 0.3 * smoothstep(-0.6, 0.6, groundBand), groundStrata);
        // Basalt, not terracotta: pull the rock layer toward blue-black and oxblood.
        float groundRockLuma = dot(groundColor, vec3(0.2126, 0.7152, 0.0722));
        vec3 groundBasalt = mix(vec3(groundRockLuma), groundColor, 0.6) * vec3(0.9, 0.9, 1.02);
        groundColor = mix(groundColor, groundBasalt * 0.85, weights[GROUND_ROCK]);
        diffuseColor.rgb = groundColor;
      `)
      .replace('#include <normal_fragment_maps>', `
        normal = normalize((viewMatrix * vec4(normalize(groundNormalOut), 0.0)).xyz);
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        // Wet ground glistens but never out-shines the sun: only the brook
        // margin itself (wetness near 1) is allowed below a 0.42 roughness.
        float groundRoughFloor = mix(0.42, 0.32, smoothstep(0.8, 1.0, groundWet));
        roughnessFactor = clamp(mix(groundOrhOut.g, groundOrhOut.g * 0.35, groundWet), groundRoughFloor, 1.0);
      `)
      .replace('#include <aomap_fragment>', `
        #include <aomap_fragment>
        float groundAo = mix(1.0, groundOrhOut.r, 0.85);
        reflectedLight.indirectDiffuse *= groundAo;
        reflectedLight.indirectSpecular *= groundAo;
      `);
  };
  material.customProgramCacheKey = () => `plateau-layered-ground-v2-${fixed ? 'fixed' : 'terrain'}`;
  material.userData.surface = 'blender-baked-height-blended-ground';
  return material;
}
