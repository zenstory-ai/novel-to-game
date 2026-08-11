import * as THREE from 'three';

const CLOUD_SHADER_VERSION = 'plateau-overhead-cloud-shadow-v1';

export const OVERHEAD_CLOUD_PROFILE = Object.freeze({
  version: 'world-space-overhead-cloud-and-sun-shadow-v1',
  resolution: 256,
  domainMeters: 2048,
  altitudeMeters: 620,
  thicknessMeters: 220,
  coverageThreshold: 0.555,
  edgeWidth: 0.055,
  windVelocityMetersPerSecond: Object.freeze([1.05, 0.28]),
  shadowSamples: 2,
  shadowExtinctionPerMeter: 0.00155,
  minimumSunTransmittance: 0.58,
  visibleOpacity: 0.74,
  visibleMaximumDistanceMeters: 3000,
  minimumResolvedFeatureMeters: 32,
  qualityPolicy: 'disabled-low-enabled-balanced-and-high',
  lightingBoundary:
    'shared-density-direct-light-attenuation-not-a-fluid-or-microphysical-cloud-model',
});

function integerHash(x, y, seed) {
  let value = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(y + seed, 0x27d4eb2d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

function smoothstep01(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function periodicValueNoise(u, v, cells, seed) {
  const x = u * cells;
  const y = v * cells;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep01(x - x0);
  const ty = smoothstep01(y - y0);
  const wrap = (value) => ((value % cells) + cells) % cells;
  const a = integerHash(wrap(x0), wrap(y0), seed);
  const b = integerHash(wrap(x0 + 1), wrap(y0), seed);
  const c = integerHash(wrap(x0), wrap(y0 + 1), seed);
  const d = integerHash(wrap(x0 + 1), wrap(y0 + 1), seed);
  const lower = THREE.MathUtils.lerp(a, b, tx);
  const upper = THREE.MathUtils.lerp(c, d, tx);
  return THREE.MathUtils.lerp(lower, upper, ty);
}

export function createCloudDensityData({
  resolution = OVERHEAD_CLOUD_PROFILE.resolution,
  seed = 1907,
} = {}) {
  const data = new Uint8Array(resolution * resolution);
  let minimum = 1;
  let maximum = 0;
  let sum = 0;
  let covered = 0;
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const u = (x + 0.5) / resolution;
      const v = (y + 0.5) / resolution;
      const weather = periodicValueNoise(u, v, 2, seed + 5);
      const broad = periodicValueNoise(u, v, 4, seed + 17) * 0.4
        + periodicValueNoise(u, v, 8, seed + 31) * 0.26
        + periodicValueNoise(u, v, 16, seed + 47) * 0.17
        + periodicValueNoise(u, v, 32, seed + 71) * 0.11
        + periodicValueNoise(u, v, 64, seed + 89) * 0.06;
      const weatherThreshold = THREE.MathUtils.lerp(-0.09, 0.08, weather);
      const density = THREE.MathUtils.clamp(broad + weatherThreshold, 0, 1);
      const byte = Math.round(density * 255);
      data[y * resolution + x] = byte;
      minimum = Math.min(minimum, density);
      maximum = Math.max(maximum, density);
      sum += density;
      if (density >= OVERHEAD_CLOUD_PROFILE.coverageThreshold) covered += 1;
    }
  }
  return Object.freeze({
    data,
    resolution,
    statistics: Object.freeze({
      minimum: Number(minimum.toFixed(4)),
      maximum: Number(maximum.toFixed(4)),
      mean: Number((sum / data.length).toFixed(4)),
      coverageFraction: Number((covered / data.length).toFixed(4)),
    }),
  });
}

function repeatedCoordinate(value, size) {
  return ((value % size) + size) % size;
}

function sampleDensityData(field, worldX, worldZ, windOffset, profile) {
  const domain = profile.domainMeters;
  const u = repeatedCoordinate(worldX + windOffset.x, domain) / domain;
  const v = repeatedCoordinate(worldZ + windOffset.y, domain) / domain;
  const x = u * field.resolution - 0.5;
  const y = v * field.resolution - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const read = (ix, iy) => {
    const wrappedX = repeatedCoordinate(ix, field.resolution);
    const wrappedY = repeatedCoordinate(iy, field.resolution);
    return field.data[wrappedY * field.resolution + wrappedX] / 255;
  };
  const lower = THREE.MathUtils.lerp(read(x0, y0), read(x0 + 1, y0), tx);
  const upper = THREE.MathUtils.lerp(read(x0, y0 + 1), read(x0 + 1, y0 + 1), tx);
  return THREE.MathUtils.lerp(lower, upper, ty);
}

function remapDensity(fieldValue, profile) {
  const lower = profile.coverageThreshold - profile.edgeWidth;
  const upper = profile.coverageThreshold + profile.edgeWidth;
  return smoothstep01((fieldValue - lower) / (upper - lower));
}

export function projectPointToCloudLevel(
  point,
  sunDirection,
  levelMeters = OVERHEAD_CLOUD_PROFILE.altitudeMeters
    + OVERHEAD_CLOUD_PROFILE.thicknessMeters * 0.5,
) {
  const safeSunY = Math.max(sunDirection.y, 0.08);
  const distance = Math.max(0, (levelMeters - point.y) / safeSunY);
  return new THREE.Vector3(
    point.x + sunDirection.x * distance,
    levelMeters,
    point.z + sunDirection.z * distance,
  );
}

function createDensityTexture(field) {
  const texture = new THREE.DataTexture(
    field.data,
    field.resolution,
    field.resolution,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.name = 'world.atmosphere.overhead-cloud-density';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createVisibleCloudLayer(texture, uniforms, sunDirection, profile) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      densityMap: uniforms.plateauCloudDensityMap,
      windOffset: uniforms.plateauCloudWindOffset,
      sunDirection: { value: sunDirection },
      domainMeters: uniforms.plateauCloudDomainMeters,
      altitudeMeters: uniforms.plateauCloudAltitudeMeters,
      thicknessMeters: uniforms.plateauCloudThicknessMeters,
      coverageThreshold: uniforms.plateauCloudCoverageThreshold,
      edgeWidth: uniforms.plateauCloudEdgeWidth,
      qualityStrength: uniforms.plateauCloudQualityStrength,
      layerOpacity: { value: profile.visibleOpacity },
      maximumDistance: { value: profile.visibleMaximumDistanceMeters },
      shadowColor: { value: new THREE.Color(0x526668) },
      bodyColor: { value: new THREE.Color(0xabb8b2) },
      sunColor: { value: new THREE.Color(0xe7bc82) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vCloudDirection;
      void main() {
        vCloudDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vCloudDirection;
      uniform sampler2D densityMap;
      uniform vec2 windOffset;
      uniform vec3 sunDirection;
      uniform float domainMeters;
      uniform float altitudeMeters;
      uniform float thicknessMeters;
      uniform float coverageThreshold;
      uniform float edgeWidth;
      uniform float qualityStrength;
      uniform float layerOpacity;
      uniform float maximumDistance;
      uniform vec3 shadowColor;
      uniform vec3 bodyColor;
      uniform vec3 sunColor;

      float cloudDensityAt(vec2 worldXZ) {
        float field = texture2D(
          densityMap,
          (worldXZ + windOffset) / domainMeters
        ).r;
        return smoothstep(
          coverageThreshold - edgeWidth,
          coverageThreshold + edgeWidth,
          field
        );
      }

      void main() {
        vec3 direction = normalize(vCloudDirection);
        if (direction.y <= 0.008 || qualityStrength <= 0.001) discard;
        float lowerLevel = altitudeMeters + thicknessMeters * 0.18;
        float middleLevel = altitudeMeters + thicknessMeters * 0.5;
        float upperLevel = altitudeMeters + thicknessMeters * 0.82;
        float lowerDistance = max(
          0.0,
          (lowerLevel - cameraPosition.y) / max(direction.y, 0.008)
        );
        float middleDistance = max(
          0.0,
          (middleLevel - cameraPosition.y) / max(direction.y, 0.008)
        );
        float upperDistance = max(
          0.0,
          (upperLevel - cameraPosition.y) / max(direction.y, 0.008)
        );
        vec2 lowerHitXZ = cameraPosition.xz + direction.xz * lowerDistance;
        vec2 middleHitXZ = cameraPosition.xz + direction.xz * middleDistance;
        vec2 upperHitXZ = cameraPosition.xz + direction.xz * upperDistance;
        float lowerDensity = cloudDensityAt(lowerHitXZ);
        float middleDensity = cloudDensityAt(middleHitXZ);
        float upperDensity = cloudDensityAt(upperHitXZ);
        float silhouetteDensity = max(
          middleDensity,
          max(lowerDensity * 0.86, upperDensity * 0.74)
        );
        float integratedDensity = (
          lowerDensity * 0.42 + middleDensity * 0.36 + upperDensity * 0.22
        );
        float sunPath = thicknessMeters * 0.38 / max(sunDirection.y, 0.08);
        float lightDensity = (
          cloudDensityAt(middleHitXZ + sunDirection.xz * sunPath)
          + cloudDensityAt(upperHitXZ + sunDirection.xz * sunPath * 0.55)
        ) * 0.5;
        float sunTransmittance = exp(-lightDensity * 0.92);
        float facing = clamp(dot(direction, normalize(sunDirection)), 0.0, 1.0);
        float rim = pow(facing, 10.0)
          * (1.0 - smoothstep(0.42, 0.92, silhouetteDensity));
        float underside = 1.0 - smoothstep(0.08, 0.54, direction.y);
        float bodyLight = clamp(
          0.3 + sunTransmittance * 0.43
            + upperDensity * 0.08 - lowerDensity * 0.13
            - underside * 0.1,
          0.14,
          0.86
        );
        vec3 color = mix(shadowColor, bodyColor, bodyLight);
        color = mix(color, sunColor, rim * 0.56);
        float grazingFade = smoothstep(0.012, 0.075, direction.y);
        float distanceFade = 1.0 - smoothstep(
          maximumDistance * 0.72,
          maximumDistance,
          middleDistance
        );
        float opticalAlpha = 1.0 - exp(-integratedDensity * 1.7);
        float alpha = max(opticalAlpha, silhouetteDensity * 0.32)
          * layerOpacity * grazingFade * distanceFade * qualityStrength;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.userData.surface = 'shared-density-overhead-cloud-underside';
  material.userData.densityTexture = texture.name;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(239, 64, 32), material);
  mesh.name = 'world.atmosphere.cloud-deck';
  mesh.userData.profile = 'world-space-shared-density-overhead-cloud-deck';
  mesh.userData.altitudeRangeMeters = [
    profile.altitudeMeters,
    profile.altitudeMeters + profile.thicknessMeters,
  ];
  mesh.userData.domainMeters = profile.domainMeters;
  mesh.frustumCulled = false;
  mesh.renderOrder = -90;
  return mesh;
}

function installCloudShadowOnMaterial(material, uniforms, profile) {
  if (!material?.userData.heightFog || material.userData.overheadCloudShadow) return false;
  const lit = material.isMeshStandardMaterial
    || material.isMeshPhysicalMaterial
    || material.isMeshLambertMaterial
    || material.isMeshPhongMaterial;
  if (!lit || material.fog === false) return false;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')
      || !shader.fragmentShader.includes('#include <fog_pars_fragment>')) return;
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `
        #include <fog_pars_fragment>
        #ifdef USE_FOG
          uniform sampler2D plateauCloudDensityMap;
          uniform vec2 plateauCloudWindOffset;
          uniform vec3 plateauCloudSunDirection;
          uniform float plateauCloudDomainMeters;
          uniform float plateauCloudAltitudeMeters;
          uniform float plateauCloudThicknessMeters;
          uniform float plateauCloudCoverageThreshold;
          uniform float plateauCloudEdgeWidth;
          uniform float plateauCloudShadowExtinction;
          uniform float plateauCloudMinimumTransmittance;
          uniform float plateauCloudQualityStrength;

          float plateauCloudDensityAt(vec2 worldXZ) {
            float field = texture2D(
              plateauCloudDensityMap,
              (worldXZ + plateauCloudWindOffset) / plateauCloudDomainMeters
            ).r;
            return smoothstep(
              plateauCloudCoverageThreshold - plateauCloudEdgeWidth,
              plateauCloudCoverageThreshold + plateauCloudEdgeWidth,
              field
            );
          }

          float plateauCloudSunTransmittance(vec3 worldPosition) {
            float safeSunY = max(plateauCloudSunDirection.y, 0.08);
            float lowerLevel = plateauCloudAltitudeMeters
              + plateauCloudThicknessMeters * 0.3;
            float upperLevel = plateauCloudAltitudeMeters
              + plateauCloudThicknessMeters * 0.7;
            float lowerDistance = max(
              0.0,
              (lowerLevel - worldPosition.y) / safeSunY
            );
            float upperDistance = max(
              0.0,
              (upperLevel - worldPosition.y) / safeSunY
            );
            float density = (
              plateauCloudDensityAt(
                worldPosition.xz + plateauCloudSunDirection.xz * lowerDistance
              )
              + plateauCloudDensityAt(
                worldPosition.xz + plateauCloudSunDirection.xz * upperDistance
              )
            ) * 0.5;
            float opticalDepth = density
              * plateauCloudThicknessMeters / safeSunY
              * plateauCloudShadowExtinction;
            return clamp(
              exp(-opticalDepth),
              plateauCloudMinimumTransmittance,
              1.0
            );
          }
        #endif
      `)
      .replace('#include <lights_fragment_begin>', `
        #include <lights_fragment_begin>
        #ifdef USE_FOG
          float plateauCloudKeyTransmittance = mix(
            1.0,
            plateauCloudSunTransmittance(vPlateauFogWorldPosition),
            plateauCloudQualityStrength
          );
          reflectedLight.directDiffuse *= plateauCloudKeyTransmittance;
          reflectedLight.directSpecular *= plateauCloudKeyTransmittance;
        #endif
      `);
  };
  material.customProgramCacheKey = () => (
    `${previousProgramCacheKey()}|${CLOUD_SHADER_VERSION}`
  );
  material.userData.overheadCloudShadow = Object.freeze({
    version: profile.version,
    densitySource: 'shared-project-generated-world-space-density-texture',
    projection: 'two-sample-sun-path-through-cloud-layer',
    minimumSunTransmittance: profile.minimumSunTransmittance,
  });
  material.needsUpdate = true;
  return true;
}

export function createOverheadCloudField(
  sunDirection,
  profile = OVERHEAD_CLOUD_PROFILE,
) {
  const field = createCloudDensityData({ resolution: profile.resolution });
  const texture = createDensityTexture(field);
  const windOffset = new THREE.Vector2();
  const uniforms = {
    plateauCloudDensityMap: { value: texture },
    plateauCloudWindOffset: { value: windOffset },
    plateauCloudSunDirection: { value: sunDirection },
    plateauCloudDomainMeters: { value: profile.domainMeters },
    plateauCloudAltitudeMeters: { value: profile.altitudeMeters },
    plateauCloudThicknessMeters: { value: profile.thicknessMeters },
    plateauCloudCoverageThreshold: { value: profile.coverageThreshold },
    plateauCloudEdgeWidth: { value: profile.edgeWidth },
    plateauCloudShadowExtinction: { value: profile.shadowExtinctionPerMeter },
    plateauCloudMinimumTransmittance: { value: profile.minimumSunTransmittance },
    plateauCloudQualityStrength: { value: 1 },
  };
  const mesh = createVisibleCloudLayer(texture, uniforms, sunDirection, profile);
  const installedMaterials = new WeakSet();
  let installedMaterialCount = 0;
  let skippedMaterialCount = 0;
  let quality = 'balanced';

  const api = {
    mesh,
    texture,
    applyTo(scene) {
      const materials = new Set();
      scene.traverse((object) => {
        if (!object.material) return;
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      });
      materials.forEach((material) => {
        if (installedMaterials.has(material)) return;
        installedMaterials.add(material);
        if (installCloudShadowOnMaterial(material, uniforms, profile)) {
          installedMaterialCount += 1;
        } else {
          skippedMaterialCount += 1;
        }
      });
      return api.snapshot();
    },
    update(elapsed, reducedMotion = false, nextQuality = 'balanced') {
      quality = ['low', 'balanced', 'high'].includes(nextQuality)
        ? nextQuality
        : 'balanced';
      const time = reducedMotion ? 0 : elapsed;
      windOffset.set(
        time * profile.windVelocityMetersPerSecond[0],
        time * profile.windVelocityMetersPerSecond[1],
      );
      const strength = quality === 'low' ? 0 : 1;
      uniforms.plateauCloudQualityStrength.value = strength;
      mesh.visible = strength > 0;
      mesh.material.uniforms.time.value = time;
    },
    densityAt(worldX, worldZ) {
      return remapDensity(
        sampleDensityData(field, worldX, worldZ, windOffset, profile),
        profile,
      );
    },
    sunTransmittanceAt(point) {
      const levels = [0.3, 0.7];
      const density = levels.reduce((total, fraction) => {
        const level = profile.altitudeMeters + profile.thicknessMeters * fraction;
        const hit = projectPointToCloudLevel(point, sunDirection, level);
        return total + api.densityAt(hit.x, hit.z);
      }, 0) / levels.length;
      const pathLength = profile.thicknessMeters / Math.max(sunDirection.y, 0.08);
      return THREE.MathUtils.clamp(
        Math.exp(-density * pathLength * profile.shadowExtinctionPerMeter),
        profile.minimumSunTransmittance,
        1,
      );
    },
    snapshot() {
      return {
        ...profile,
        windVelocityMetersPerSecond: [...profile.windVelocityMetersPerSecond],
        densityTexture: {
          name: texture.name,
          objectCount: 1,
          statistics: { ...field.statistics },
        },
        visibleLayer: {
          profile: mesh.userData.profile,
          drawCalls: 1,
          densitySamplesPerFragment: 5,
          replacesPreviousDeckDrawCall: true,
        },
        shadow: {
          model: 'same-density-two-sample-sun-path-beer-lambert-transmittance',
          installedMaterialCount,
          skippedMaterialCount,
          additionalDrawCalls: 0,
          collisionChange: 'none',
        },
        quality,
        windOffsetMeters: windOffset.toArray(),
      };
    },
  };
  return Object.freeze(api);
}
