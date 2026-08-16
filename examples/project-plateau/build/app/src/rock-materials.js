import * as THREE from 'three';

import { seededRandom } from './config.js';
import { NON_COLUMNAR_ROCK_PROFILES } from './rock-geometry.js';

function createBasaltDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const makeGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const wrap = (value, cells) => ((value % cells) + cells) % cells;
  const tileNoise = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const x0 = wrap(floorX, cells);
    const y0 = wrap(floorY, cells);
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = THREE.MathUtils.smoothstep(x - floorX, 0, 1);
    const ty = THREE.MathUtils.smoothstep(y - floorY, 0, 1);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  const broadGrid = makeGrid(7, 1297);
  const mesoGrid = makeGrid(19, 1301);
  const grainGrid = makeGrid(47, 1303);
  const fractureGrid = makeGrid(23, 1307);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = tileNoise(broadGrid, 7, u, v);
      const meso = tileNoise(
        mesoGrid,
        19,
        u + (broad - 0.5) * 0.055,
        v - (broad - 0.5) * 0.04,
      );
      const grain = tileNoise(grainGrid, 47, u - (meso - 0.5) * 0.018, v);
      const fracture = tileNoise(
        fractureGrid,
        23,
        u + (meso - 0.5) * 0.022,
        0.17 + (v - 0.5) * 0.035,
      );
      const sparseCrack = fracture > 0.86 ? (fracture - 0.86) * 2.6 : 0;
      const height = THREE.MathUtils.clamp(
        0.45 + (broad - 0.5) * 0.2 + (meso - 0.5) * 0.24
          + (grain - 0.5) * 0.08 - sparseCrack,
        0.12,
        0.78,
      );
      const offset = (y * size + x) * 4;
      const albedo = THREE.MathUtils.clamp(0.67 + (height - 0.45) * 0.42, 0.48, 0.82);
      albedoData.set([
        Math.round(albedo * 255),
        Math.round(albedo * 0.93 * 255),
        Math.round(albedo * 0.88 * 255),
        255,
      ], offset);
      const roughness = THREE.MathUtils.clamp(
        0.89 + (1 - height) * 0.09 + sparseCrack * 0.05,
        0.88,
        0.99,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(height * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.15, 5.25);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.basalt-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.basalt-roughness', roughnessData),
    height: makeTexture('world.material.basalt-height', heightData),
  });
}

function createRockDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const makeNoiseGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const macroGrid = makeNoiseGrid(5, 1439);
  const mesoGrid = makeNoiseGrid(13, 1447);
  const grainGrid = makeNoiseGrid(29, 1453);
  const lichenGrid = makeNoiseGrid(9, 1459);
  const tileNoise = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x) % cells;
    const y0 = Math.floor(y) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const fx = THREE.MathUtils.smoothstep(x - Math.floor(x), 0, 1);
    const fy = THREE.MathUtils.smoothstep(y - Math.floor(y), 0, 1);
    const top = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], fx);
    const bottom = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], fx);
    return THREE.MathUtils.lerp(top, bottom, fy);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const macro = tileNoise(macroGrid, 5, u, v);
      const meso = tileNoise(mesoGrid, 13, u, v);
      const grain = tileNoise(grainGrid, 29, u, v);
      const lichenNoise = tileNoise(lichenGrid, 9, u + 0.17, v - 0.11);
      const value = THREE.MathUtils.clamp(
        0.54 + (macro - 0.5) * 0.22 + (meso - 0.5) * 0.13
          + (grain - 0.5) * 0.055,
        0.4,
        0.74,
      );
      const moss = THREE.MathUtils.clamp(
        THREE.MathUtils.smoothstep(lichenNoise, 0.58, 0.86) * 0.72,
        0,
        1,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(value * (0.93 - moss * 0.07) * 255);
      albedoData[offset + 1] = Math.round(value * (0.96 + moss * 0.025) * 255);
      albedoData[offset + 2] = Math.round(value * (0.9 - moss * 0.055) * 255);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(
        0.82 + (1 - value) * 0.14 + moss * 0.035,
        0.84,
        0.99,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(value * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.4, 1.9);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.weathered-rock-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.weathered-rock-roughness', roughnessData),
    height: makeTexture('world.material.weathered-rock-height', heightData),
  });
}

function createNonColumnarRockMaterial(family) {
  const profile = NON_COLUMNAR_ROCK_PROFILES[family];
  const material = new THREE.MeshStandardMaterial({
    color: profile.materialColor,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: profile.flatShading,
    envMapIntensity: 0.08,
    dithering: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.familyRockAlbedo = { value: rockTextures.albedo };
    shader.uniforms.familyRockRoughness = { value: rockTextures.roughness };
    shader.uniforms.familyRockHeight = { value: rockTextures.height };
    shader.uniforms.familyRockReliefScale = { value: profile.bumpScale * 7.2 };
    shader.uniforms.familyRockBankMoisture = { value: family === 'fluvial-cobble' ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vFamilyRockObjectPosition;
        varying vec3 vFamilyRockObjectNormal;
      `)
      .replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        vFamilyRockObjectNormal = objectNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vFamilyRockObjectPosition = transformed;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D familyRockAlbedo;
        uniform sampler2D familyRockRoughness;
        uniform sampler2D familyRockHeight;
        uniform float familyRockReliefScale;
        uniform float familyRockBankMoisture;
        varying vec3 vFamilyRockObjectPosition;
        varying vec3 vFamilyRockObjectNormal;

        vec3 familyRockBlendWeights() {
          vec3 weights = pow(abs(normalize(vFamilyRockObjectNormal)), vec3(2.8));
          return weights / max(dot(weights, vec3(1.0)), 0.0001);
        }

        vec3 sampleFamilyRockAlbedo() {
          vec3 weights = familyRockBlendWeights();
          vec3 point = vFamilyRockObjectPosition * 1.42;
          vec3 xSample = texture2D(familyRockAlbedo, point.zy + vec2(0.17, 0.29)).rgb;
          vec3 ySample = texture2D(familyRockAlbedo, point.xz + vec2(0.41, 0.13)).rgb;
          vec3 zSample = texture2D(familyRockAlbedo, point.xy + vec2(0.07, 0.47)).rgb;
          return xSample * weights.x + ySample * weights.y + zSample * weights.z;
        }

        float sampleFamilyRockRoughness() {
          vec3 weights = familyRockBlendWeights();
          vec3 point = vFamilyRockObjectPosition * 1.42;
          return texture2D(familyRockRoughness, point.zy + vec2(0.17, 0.29)).g * weights.x
            + texture2D(familyRockRoughness, point.xz + vec2(0.41, 0.13)).g * weights.y
            + texture2D(familyRockRoughness, point.xy + vec2(0.07, 0.47)).g * weights.z;
        }

        float sampleFamilyRockHeight() {
          vec3 weights = familyRockBlendWeights();
          vec3 point = vFamilyRockObjectPosition * 1.42;
          return texture2D(familyRockHeight, point.zy + vec2(0.17, 0.29)).r * weights.x
            + texture2D(familyRockHeight, point.xz + vec2(0.41, 0.13)).r * weights.y
            + texture2D(familyRockHeight, point.xy + vec2(0.07, 0.47)).r * weights.z;
        }

        vec3 perturbFamilyRockNormal(
          vec3 surfacePosition,
          vec3 surfaceNormal,
          vec2 heightDerivatives,
          float direction
        ) {
          vec3 sigmaX = normalize(dFdx(surfacePosition));
          vec3 sigmaY = normalize(dFdy(surfacePosition));
          vec3 responseX = cross(sigmaY, surfaceNormal);
          vec3 responseY = cross(surfaceNormal, sigmaX);
          float determinant = dot(sigmaX, responseX) * direction;
          vec3 gradient = sign(determinant)
            * (heightDerivatives.x * responseX + heightDerivatives.y * responseY);
          return normalize(abs(determinant) * surfaceNormal - gradient);
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 familyRockSample = sampleFamilyRockAlbedo();
        float familyRockLuma = dot(familyRockSample, vec3(0.2126, 0.7152, 0.0722));
        float familyRockMineral = smoothstep(0.12, 0.45, familyRockLuma);
        vec3 familyRockTint = familyRockSample / max(familyRockLuma, 0.08);
        float familyRockPorosityHeight = sampleFamilyRockHeight();
        diffuseColor.rgb *= mix(0.76, 1.08, familyRockMineral)
          * mix(vec3(1.0), familyRockTint, 0.2);
        float familyRockCapillaryFront = 0.13
          + (familyRockPorosityHeight - 0.5) * 0.07;
        float familyRockMoisture = (1.0 - smoothstep(
          familyRockCapillaryFront - 0.055,
          familyRockCapillaryFront + 0.07,
          vFamilyRockObjectPosition.y
        )) * familyRockBankMoisture;
        diffuseColor.rgb *= mix(
          vec3(1.0),
          vec3(0.54, 0.66, 0.6),
          familyRockMoisture * 0.36
        );
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float familyRockRelief = familyRockPorosityHeight;
        vec2 familyRockReliefGradient = vec2(
          dFdx(familyRockRelief),
          dFdy(familyRockRelief)
        ) * familyRockReliefScale;
        normal = perturbFamilyRockNormal(
          -vViewPosition,
          normal,
          familyRockReliefGradient,
          faceDirection
        );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(
          mix(roughnessFactor, sampleFamilyRockRoughness(), 0.76),
          0.88,
          1.0
        );
        float familyRockWetFront = 0.13
          + (familyRockPorosityHeight - 0.5) * 0.07;
        float familyRockWetness = (1.0 - smoothstep(
          familyRockWetFront - 0.055,
          familyRockWetFront + 0.07,
          vFamilyRockObjectPosition.y
        )) * familyRockBankMoisture;
        roughnessFactor = mix(roughnessFactor, 0.78, familyRockWetness * 0.48);
      `);
  };
  material.customProgramCacheKey = () => `non-columnar-rock-triplanar-v2-${family}`;
  material.userData.triplanarTextures = Object.freeze({
    albedo: rockTextures.albedo,
    roughness: rockTextures.roughness,
    height: rockTextures.height,
  });
  material.userData.mapping = 'seam-free-object-space-triplanar';
  return material;
}

const basaltDetailTextures = createBasaltDetailTextures();
const rockTextures = createRockDetailTextures();

export { basaltDetailTextures, createNonColumnarRockMaterial, rockTextures };
