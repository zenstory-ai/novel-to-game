import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './config.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';
import { createOverheadCloudField } from './overhead-cloud-field.js';
import { terrainHeight } from './terrain.js';

// Keep the late sun to camera-left and slightly behind the default field view.
// That direction gives the animals readable three-quarter light instead of
// turning every forward-facing surface into a silhouette.
export const SUN_DIRECTION = new THREE.Vector3(-0.44, 0.55, 0.71).normalize();

export const RIDGE_SURFACE_PROFILE = Object.freeze({
  version: 'process-coupled-distant-ridge-surface-v2',
  sourceModel:
    'rendered-height-normal-slope-aspect-drainage-exposed-stone-and-height-fraction-fields',
  broadDetailPeriodMeters: 37,
  fineDetailPeriodMeters: 13,
  microDetailPeriodMeters: 9,
  maximumHumusDarkening: 0.38,
  maximumVegetatedSoilBlend: 0.46,
  maximumSlopeSubstrateBlend: 0.36,
  maximumStoneBlend: 0.45,
  temporalModel: 'stable-world-space-no-camera-or-time-dependent-pattern',
  evidenceBoundary:
    'distant-surface-response-does-not-add-collision-or-claim-surveyed-geology',
});

const SKY_SETTINGS = Object.freeze({
  turbidity: 8.2,
  rayleigh: 1.42,
  mieCoefficient: 0.009,
  mieDirectionalG: 0.84,
});

function createEnvironmentSky() {
  const sky = new Sky();
  sky.scale.setScalar(100);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = SKY_SETTINGS.turbidity;
  uniforms.rayleigh.value = SKY_SETTINGS.rayleigh;
  uniforms.mieCoefficient.value = SKY_SETTINGS.mieCoefficient;
  uniforms.mieDirectionalG.value = SKY_SETTINGS.mieDirectionalG;
  uniforms.sunPosition.value.copy(SUN_DIRECTION);
  sky.material.depthWrite = false;
  sky.material.fog = false;
  sky.name = 'world.atmosphere.environment-sky';
  sky.userData.profile = 'preetham-physical-sky';
  sky.userData.sunDirection = SUN_DIRECTION.toArray();
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return sky;
}

function createDisplaySky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x254752) },
      upperColor: { value: new THREE.Color(0x5a7777) },
      horizonColor: { value: new THREE.Color(0xc79568) },
      lowerColor: { value: new THREE.Color(0x344f48) },
      sunColor: { value: new THREE.Color(0xffc783) },
      sunDirection: { value: SUN_DIRECTION.clone() },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform vec3 topColor;
      uniform vec3 upperColor;
      uniform vec3 horizonColor;
      uniform vec3 lowerColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;

      void main() {
        vec3 direction = normalize(vDirection);
        float altitude = clamp(direction.y, -0.3, 1.0);
        vec3 lowerSky = mix(lowerColor, horizonColor, smoothstep(-0.24, 0.055, altitude));
        vec3 upperSky = mix(upperColor, topColor, smoothstep(0.16, 0.88, altitude));
        vec3 sky = mix(lowerSky, upperSky, smoothstep(0.025, 0.34, altitude));

        float sunAlignment = max(dot(direction, normalize(sunDirection)), 0.0);
        float horizonWarmth = pow(sunAlignment, 7.0)
          * (1.0 - smoothstep(0.2, 0.62, altitude));
        float humidBand = exp(-pow((altitude - 0.045) * 9.0, 2.0));
        sky = mix(sky, horizonColor, humidBand * 0.15);
        sky += sunColor * horizonWarmth * 0.16;

        // The physical sky is reserved for PMREM. The visible disc stays small
        // and bounded so ACES cannot turn half of the horizon into white.
        float sunHalo = pow(sunAlignment, 96.0) * 0.16;
        float sunDisc = smoothstep(0.99978, 0.99993, sunAlignment);
        sky += sunColor * sunHalo;
        sky = mix(sky, sunColor, sunDisc * 0.82);
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(245, 48, 24), material);
  sky.name = 'world.atmosphere.gradient-sky';
  sky.userData.profile = 'bounded-humid-display-sky';
  sky.userData.sunDirection = SUN_DIRECTION.toArray();
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return sky;
}

const CLOUD_PROFILES = Object.freeze({
  veil: Object.freeze({
    name: 'world.atmosphere.cloud-veil',
    profile: 'high-broken-humidity-veil',
    radius: 240,
    renderOrder: -92,
    domainScale: 0.72,
    detailScale: 2.05,
    densityLow: 0.49,
    densityHigh: 0.72,
    opacity: 0.1,
    altitudeLow: 0.19,
    altitudeFull: 0.3,
    altitudeFade: 0.63,
    altitudeHigh: 0.86,
    wind: new THREE.Vector2(0.00054, 0.00018),
    domainOffset: new THREE.Vector2(-12.4, 7.6),
    shadowColor: 0x647b7b,
    bodyColor: 0xafbbb5,
    sunColor: 0xeac48d,
  }),
});

function createCloudLayer(profile) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      time: { value: 0 },
      sunDirection: { value: SUN_DIRECTION.clone() },
      shadowColor: { value: new THREE.Color(profile.shadowColor) },
      bodyColor: { value: new THREE.Color(profile.bodyColor) },
      sunColor: { value: new THREE.Color(profile.sunColor) },
      windVelocity: { value: profile.wind.clone() },
      domainOffset: { value: profile.domainOffset.clone() },
      domainScale: { value: profile.domainScale },
      detailScale: { value: profile.detailScale },
      densityLow: { value: profile.densityLow },
      densityHigh: { value: profile.densityHigh },
      layerOpacity: { value: profile.opacity },
      altitudeLow: { value: profile.altitudeLow },
      altitudeFull: { value: profile.altitudeFull },
      altitudeFade: { value: profile.altitudeFade },
      altitudeHigh: { value: profile.altitudeHigh },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform float time;
      uniform vec3 sunDirection;
      uniform vec3 shadowColor;
      uniform vec3 bodyColor;
      uniform vec3 sunColor;
      uniform vec2 windVelocity;
      uniform vec2 domainOffset;
      uniform float domainScale;
      uniform float detailScale;
      uniform float densityLow;
      uniform float densityHigh;
      uniform float layerOpacity;
      uniform float altitudeLow;
      uniform float altitudeFull;
      uniform float altitudeFade;
      uniform float altitudeHigh;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.54;
        mat2 octaveTurn = mat2(0.82, -0.57, 0.57, 0.82);
        for (int octave = 0; octave < 5; octave++) {
          value += valueNoise(p) * amplitude;
          p = octaveTurn * p * 2.03 + 17.13;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float altitude = direction.y;
        vec2 wind = time * windVelocity;
        vec2 domePlane = direction.xz / max(0.32, altitude + 0.52);
        vec2 domain = domePlane * domainScale + domainOffset + wind;
        float broad = fbm(domain);
        float torn = fbm(domain * detailScale + vec2(8.7, -3.1));
        float cloudField = broad * 0.76 + torn * 0.24;
        float density = smoothstep(densityLow, densityHigh, cloudField);
        float lowerBand = smoothstep(altitudeLow, altitudeFull, altitude);
        float upperBand = 1.0 - smoothstep(altitudeFade, altitudeHigh, altitude);
        float horizonBreak = 0.64 + valueNoise(domePlane * 2.45 + domainOffset * 0.17) * 0.36;
        float alpha = density * lowerBand * upperBand * horizonBreak * layerOpacity;

        // A cheap directional density sample gives the flat dome mask a
        // readable cloud underside and a bounded sun-facing rim. The visual
        // layer remains independent from the PMREM environment sky.
        vec2 sunFlow = normalize(sunDirection.xz + vec2(0.0001)) * 0.31;
        float lightSample = fbm(domain - sunFlow) * 0.76
          + fbm((domain - sunFlow) * detailScale + vec2(8.7, -3.1)) * 0.24;
        float selfShadow = clamp((lightSample - cloudField) * 2.8 + density * 0.22, 0.0, 1.0);
        float underside = 1.0 - smoothstep(altitudeFull, altitudeFade, altitude);
        float lightFacing = clamp(dot(direction, normalize(sunDirection)) * 0.5 + 0.5, 0.0, 1.0);
        float rim = pow(max(dot(direction, normalize(sunDirection)), 0.0), 8.0)
          * smoothstep(0.12, 0.72, density);
        float bodyLight = clamp(0.44 + lightFacing * 0.42 - selfShadow * 0.34 - underside * 0.12, 0.18, 0.92);
        vec3 color = mix(shadowColor, bodyColor, bodyLight);
        color = mix(color, sunColor, rim * 0.31);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  const layer = new THREE.Mesh(new THREE.SphereGeometry(profile.radius, 64, 32), material);
  layer.name = profile.name;
  layer.userData.profile = profile.profile;
  layer.userData.domainScale = profile.domainScale;
  layer.userData.altitudeRange = [profile.altitudeLow, profile.altitudeHigh];
  layer.frustumCulled = false;
  layer.renderOrder = profile.renderOrder;
  return layer;
}

function createCloudVolumeMaterial(variant, opacity) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      worldToVolume: { value: new THREE.Matrix4() },
      sunDirection: { value: SUN_DIRECTION.clone() },
      shadowColor: { value: new THREE.Color(0x384f54) },
      bodyColor: { value: new THREE.Color(0xaeb9b4) },
      sunColor: { value: new THREE.Color(0xf0c78d) },
      fogColor: { value: new THREE.Color(0x58716f) },
      variant: { value: variant },
      windOffset: { value: new THREE.Vector2() },
      stepCount: { value: 12 },
      opacity: { value: opacity },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform mat4 worldToVolume;
      uniform vec3 sunDirection;
      uniform vec3 shadowColor;
      uniform vec3 bodyColor;
      uniform vec3 sunColor;
      uniform vec3 fogColor;
      uniform float variant;
      uniform vec2 windOffset;
      uniform float stepCount;
      uniform float opacity;

      float hash31(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      float valueNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(
            mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x),
            u.y
          ),
          mix(
            mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x),
            u.y
          ),
          u.z
        );
      }

      float fbm(vec3 p) {
        float sum = 0.0;
        float amplitude = 0.56;
        for (int octave = 0; octave < 3; octave++) {
          sum += valueNoise(p) * amplitude;
          p = p * 2.03 + vec3(7.13, 11.71, 5.37);
          amplitude *= 0.48;
        }
        return sum;
      }

      float ellipsoidField(vec3 p, vec3 centre, vec3 radius) {
        return 1.0 - length((p - centre) / radius);
      }

      float smoothMaximum(float a, float b, float radius) {
        float blend = max(radius - abs(a - b), 0.0) / radius;
        return max(a, b) + blend * blend * radius * 0.25;
      }

      float cloudShapeAt(vec3 p) {
        float v = variant;
        float shoulder = sin(v * 2.17) * 0.08;
        float crown = cos(v * 1.73) * 0.07;
        float shape = ellipsoidField(
          p,
          vec3(-0.59 + shoulder, -0.22, 0.02),
          vec3(0.4, 0.43, 0.5)
        );
        shape = smoothMaximum(shape, ellipsoidField(
          p,
          vec3(-0.18, 0.08 + crown, -0.06),
          vec3(0.48, 0.7, 0.58)
        ), 0.2);
        shape = smoothMaximum(shape, ellipsoidField(
          p,
          vec3(0.3 - shoulder, -0.04, 0.08),
          vec3(0.45, 0.5, 0.52)
        ), 0.18);
        shape = smoothMaximum(shape, ellipsoidField(
          p,
          vec3(0.66, -0.28 + crown, -0.04),
          vec3(0.31, 0.3, 0.37)
        ), 0.16);
        shape = smoothMaximum(shape, ellipsoidField(
          p,
          vec3(-0.17 + shoulder * 0.6, 0.48 + crown * 0.5, -0.02),
          vec3(0.27, 0.43, 0.38)
        ), 0.17);
        return shape;
      }

      float boundedDensity(vec3 p, float erodedShape) {
        float v = variant;
        // Cumulus condenses above a common lifting level: the base stays nearly
        // planar while buoyancy and entrainment break up only the upper edge.
        float baseNoise = (valueNoise(vec3(p.xz * 4.1, v + 2.3)) - 0.5) * 0.045;
        float baseMask = smoothstep(-0.66 + baseNoise, -0.54 + baseNoise, p.y);
        float topMask = 1.0 - smoothstep(0.64, 0.98, p.y);
        return smoothstep(-0.055, 0.105, erodedShape) * baseMask * topMask;
      }

      float densityAt(vec3 p) {
        float v = variant;
        float shape = cloudShapeAt(p);
        vec3 noisePoint = p * vec3(2.7, 3.1, 2.8);
        noisePoint.xz += windOffset + vec2(v * 4.7, v * -3.2);
        float broadNoise = fbm(noisePoint) - 0.53;
        float edgeNoise = valueNoise(noisePoint * 2.7 + 19.3) - 0.5;
        float erodedShape = shape + broadNoise * 0.27 + edgeNoise * 0.09;
        return boundedDensity(p, erodedShape);
      }

      float lightDensityAt(vec3 p) {
        float v = variant;
        vec3 noisePoint = p * vec3(2.7, 3.1, 2.8);
        noisePoint.xz += windOffset + vec2(v * 4.7, v * -3.2);
        float coarseErosion = (valueNoise(noisePoint) - 0.5) * 0.24;
        return boundedDensity(p, cloudShapeAt(p) + coarseErosion);
      }

      vec2 intersectBox(vec3 ro, vec3 rd) {
        vec3 safeDirection = vec3(
          abs(rd.x) < 0.00001 ? (rd.x < 0.0 ? -0.00001 : 0.00001) : rd.x,
          abs(rd.y) < 0.00001 ? (rd.y < 0.0 ? -0.00001 : 0.00001) : rd.y,
          abs(rd.z) < 0.00001 ? (rd.z < 0.0 ? -0.00001 : 0.00001) : rd.z
        );
        vec3 t0 = (-vec3(1.0) - ro) / safeDirection;
        vec3 t1 = (vec3(1.0) - ro) / safeDirection;
        vec3 lower = min(t0, t1);
        vec3 upper = max(t0, t1);
        return vec2(max(max(lower.x, lower.y), lower.z), min(min(upper.x, upper.y), upper.z));
      }

      float screenNoise() {
        return fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec3 worldRay = normalize(vWorldPosition - cameraPosition);
        vec3 localOrigin = (worldToVolume * vec4(cameraPosition, 1.0)).xyz;
        // Do not normalize this transformed direction. Its magnitude preserves
        // world-metre t values under the non-uniform cloud-box scale.
        vec3 localRay = (worldToVolume * vec4(worldRay, 0.0)).xyz;
        vec2 hit = intersectBox(localOrigin, localRay);
        float tEnter = max(hit.x, 0.0);
        float tExit = hit.y;
        if (tExit <= tEnter) discard;

        float stepLength = (tExit - tEnter) / max(stepCount, 1.0);
        float t = tEnter + stepLength * screenNoise();
        float transmittance = 1.0;
        vec3 scattered = vec3(0.0);
        vec3 localSun = normalize((worldToVolume * vec4(sunDirection, 0.0)).xyz);
        float forwardScatter = pow(max(dot(-worldRay, normalize(sunDirection)), 0.0), 7.0);

        for (int stepIndex = 0; stepIndex < 18; stepIndex++) {
          if (float(stepIndex) >= stepCount || transmittance < 0.015) break;
          vec3 p = localOrigin + localRay * t;
          float density = densityAt(p);
          if (density > 0.008) {
            float sunOpticalDepth = 0.0;
            for (int lightStep = 1; lightStep <= 2; lightStep++) {
              float lightDistance = 0.1 + float(lightStep) * 0.18;
              vec3 lightPoint = p + localSun * lightDistance;
              if (all(lessThan(abs(lightPoint), vec3(1.02)))) {
                sunOpticalDepth += lightDensityAt(lightPoint) * 0.74;
              }
            }
            float sunTransmittance = exp(-sunOpticalDepth * 2.45);
            float heightFraction = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
            float ambientLight = mix(0.12, 0.43, heightFraction);
            float powder = 1.0 - exp(-density * 2.5);
            float directLight = sunTransmittance * mix(0.1, 0.32, powder);
            float edgeDensity = 1.0 - smoothstep(0.2, 0.82, density);
            float silverLining = forwardScatter * sunTransmittance * edgeDensity;
            float bodyLight = clamp(ambientLight + directLight, 0.0, 1.0);
            vec3 sampleColor = mix(shadowColor, bodyColor, bodyLight);
            sampleColor = mix(sampleColor, sunColor, silverLining * 0.72);

            // Beer-Lambert extinction is evaluated in world metres because the
            // unnormalised local ray keeps t and stepLength in world units.
            float sampleAlpha = 1.0 - exp(-density * stepLength * 0.24);
            scattered += transmittance * sampleAlpha * sampleColor;
            transmittance *= 1.0 - sampleAlpha;
          }
          t += stepLength;
        }

        float alpha = (1.0 - transmittance) * opacity;
        if (alpha < 0.006) discard;
        vec3 color = scattered / max(1.0 - transmittance, 0.001);
        float aerialDistance = length(cameraPosition - vWorldPosition);
        float aerialPerspective = 1.0 - exp(-aerialDistance * 0.00135);
        color = mix(color, fogColor, aerialPerspective * 0.5);
        alpha *= 1.0 - aerialPerspective * 0.2;
        gl_FragColor = vec4(color * alpha, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.userData.surface = 'beer-lambert-single-scattering-cloud-volume';
  material.userData.physics = {
    medium: 'water-droplet-participating-medium',
    extinctionLaw: 'Beer-Lambert',
    lighting: 'height-ambient-plus-sun-ray-self-shadow',
    condensationBase: 'shared-lifting-condensation-level',
  };
  return material;
}

function createCloudBanks() {
  const cloudSystem = new THREE.Group();
  const volumeGroup = new THREE.Group();
  const volumeLayouts = [
    [-100, 57, -154, 47, 17, 0, 0.88, 'near-horizon'],
    [-45, 73, -188, 56, 21, 1, 0.845, 'near-horizon'],
    [18, 53, -161, 41, 15, 2, 0.81, 'near-horizon'],
    [78, 68, -184, 53, 19, 0, 0.88, 'near-horizon'],
    [137, 56, -165, 44, 16, 1, 0.845, 'near-horizon'],
    [188, 76, -197, 58, 21, 2, 0.81, 'near-horizon'],
    [-185, 49, -228, 38, 12, 1, 0.62, 'far-horizon'],
    [-112, 62, -241, 46, 15, 2, 0.66, 'far-horizon'],
    [-28, 47, -224, 35, 11, 0, 0.59, 'far-horizon'],
    [63, 59, -242, 47, 15, 1, 0.64, 'far-horizon'],
    [151, 50, -229, 39, 12, 2, 0.61, 'far-horizon'],
  ];
  const volumeGeometry = new THREE.BoxGeometry(2, 2, 2);
  volumeGeometry.userData.profile = 'bounded-cumulus-raymarch-domain';
  const volumeMaterials = [];
  volumeLayouts.forEach(([x, y, z, width, height, variant, opacity, depthBand], index) => {
    const depth = 11.6 + variant * 1.4;
    const material = createCloudVolumeMaterial(variant, opacity);
    const bank = new THREE.Mesh(volumeGeometry, material);
    bank.position.set(x, y, z);
    bank.scale.set(width * 0.5, height * 0.5, depth * 0.5);
    bank.name = `world.atmosphere.cloud-volume-${index + 1}`;
    bank.userData.profile = 'bounded-raymarched-cumulus-volume';
    bank.userData.basePosition = [x, y, z];
    bank.userData.depthBand = depthBand;
    bank.userData.antiSolarAlignment = Number(
      new THREE.Vector3(x, y, z).normalize().dot(SUN_DIRECTION).toFixed(4),
    );
    bank.userData.depthMeters = depth;
    bank.userData.windVelocity = [0.1 + (index % 3) * 0.014, 0.026 + (index % 2) * 0.008];
    bank.userData.stepCounts = { balanced: 12, high: 18 };
    bank.userData.extinctionPerMeter = 0.24;
    bank.frustumCulled = false;
    bank.renderOrder = -82 + index * 0.08;
    volumeMaterials.push(material);
    volumeGroup.add(bank);
  });
  volumeGroup.name = 'world.atmosphere.cloud-volumes';
  volumeGroup.userData.profile = 'bounded-raymarched-cumulus-volumes';
  volumeGroup.userData.balancedSteps = 12;
  volumeGroup.userData.highSteps = 18;

  const geometry = new THREE.SphereGeometry(1, 14, 9);
  geometry.scale(1, 0.72, 1);
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute('position');
  const vertexColors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const height = THREE.MathUtils.clamp(positions.getY(index) / 1.44 + 0.5, 0, 1);
    const shade = 0.68 + height * 0.3;
    vertexColors.push(shade * 0.96, shade * 0.985, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.userData.profile = 'smooth-overlapping-cloud-puff';
  const fallbackMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    fog: false,
    depthWrite: false,
  });
  fallbackMaterial.userData.surface = 'bounded-lit-cloud-puff-volume';
  const bankLayouts = [
    [-96, 51, -151, 0.9, 6],
    [-42, 64, -184, 1.08, 7],
    [24, 49, -158, 0.82, 5],
    [88, 61, -181, 1.02, 7],
    [148, 53, -162, 0.88, 5],
    [-181, 46, -225, 0.72, 5],
    [-109, 57, -238, 0.82, 6],
    [-25, 44, -221, 0.68, 4],
    [66, 55, -239, 0.8, 6],
    [153, 47, -226, 0.72, 5],
  ];
  const puffCount = bankLayouts.reduce((sum, layout) => sum + layout[4], 0);
  const fallbackBanks = new THREE.InstancedMesh(geometry, fallbackMaterial, puffCount);
  const random = seededRandom(1907);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let instanceIndex = 0;
  bankLayouts.forEach(([centreX, centreY, centreZ, bankScale, count], bankIndex) => {
    for (let index = 0; index < count; index += 1) {
      const normalized = count <= 1 ? 0 : index / (count - 1);
      const arch = Math.sin(normalized * Math.PI);
      const edgeScale = 0.66 + arch * 0.54;
      const width = (7.2 + random() * 4.2) * bankScale * edgeScale;
      const height = (5.1 + random() * 3.2) * bankScale * (0.76 + arch * 0.36);
      dummy.position.set(
        centreX + (normalized - 0.5) * (count * 5.7 * bankScale) + (random() - 0.5) * 3.2,
        centreY + arch * 5.4 * bankScale + (random() - 0.5) * 2.1,
        centreZ + (random() - 0.5) * 8 - bankIndex * 0.7,
      );
      dummy.rotation.set((random() - 0.5) * 0.08, random() * Math.PI, (random() - 0.5) * 0.1);
      dummy.scale.set(width, height, width * (0.44 + random() * 0.18));
      dummy.updateMatrix();
      fallbackBanks.setMatrixAt(instanceIndex, dummy.matrix);
      const heightLight = THREE.MathUtils.clamp((dummy.position.y - 42) / 34, 0, 1);
      color.setHSL(
        0.43 + random() * 0.025,
        0.07 + random() * 0.035,
        0.5 + heightLight * 0.075 + arch * 0.025,
      );
      fallbackBanks.setColorAt(instanceIndex, color);
      instanceIndex += 1;
    }
  });
  fallbackBanks.instanceMatrix.needsUpdate = true;
  fallbackBanks.instanceColor.needsUpdate = true;
  fallbackBanks.name = 'world.atmosphere.cloud-puff-fallback';
  fallbackBanks.userData.profile = 'irregular-overlapping-cloud-puff-fallback';
  fallbackBanks.frustumCulled = false;
  fallbackBanks.visible = false;
  fallbackBanks.renderOrder = -82;

  cloudSystem.add(volumeGroup, fallbackBanks);
  cloudSystem.name = 'world.atmosphere.cloud-banks';
  cloudSystem.userData.profile = 'raymarched-cumulus-volumes-with-puff-fallback';
  cloudSystem.userData.bankCount = volumeLayouts.length;
  cloudSystem.userData.volumeCount = volumeLayouts.length;
  cloudSystem.userData.depthBandCounts = Object.freeze({
    nearHorizon: volumeLayouts.filter((layout) => layout[7] === 'near-horizon').length,
    farHorizon: volumeLayouts.filter((layout) => layout[7] === 'far-horizon').length,
  });
  cloudSystem.userData.solarCoupling = Object.freeze({
    placement: 'anti-solar-northern-horizon-only',
    localDirectSunAttenuation: 0,
    reason: 'no-volume-crosses-the-local-sun-direction',
    maximumSunAlignment: Math.max(
      ...volumeGroup.children.map((bank) => bank.userData.antiSolarAlignment),
    ),
  });
  cloudSystem.userData.balancedSteps = volumeGroup.userData.balancedSteps;
  cloudSystem.userData.highSteps = volumeGroup.userData.highSteps;
  cloudSystem.userData.puffCount = puffCount;
  cloudSystem.userData.sunDirection = SUN_DIRECTION.toArray();
  cloudSystem.userData.volumes = volumeGroup;
  cloudSystem.userData.volumeMaterials = volumeMaterials;
  cloudSystem.userData.fallback = fallbackBanks;
  cloudSystem.userData.materialProfiles = {
    low: fallbackMaterial.userData.surface,
    balanced: 'twelve-step-beer-lambert-cloud-volume',
    high: 'eighteen-step-beer-lambert-cloud-volume',
  };
  cloudSystem.userData.snapshot = () => ({
    profile: cloudSystem.userData.profile,
    volumeCount: cloudSystem.userData.volumeCount,
    puffCount: cloudSystem.userData.puffCount,
    depthBandCounts: { ...cloudSystem.userData.depthBandCounts },
    solarCoupling: { ...cloudSystem.userData.solarCoupling },
    stepCounts: {
      balanced: cloudSystem.userData.balancedSteps,
      high: cloudSystem.userData.highSteps,
    },
    physics: { ...volumeMaterials[0].userData.physics },
  });
  cloudSystem.userData.updateVolumes = (elapsed, reducedMotion, quality) => {
    const normalizedQuality = ['low', 'balanced', 'high'].includes(quality)
      ? quality
      : 'balanced';
    const motionTime = reducedMotion ? 0 : elapsed;
    volumeGroup.children.forEach((bank) => {
      const [baseX, baseY, baseZ] = bank.userData.basePosition;
      const [windX, windZ] = bank.userData.windVelocity;
      bank.position.set(baseX + motionTime * windX, baseY, baseZ + motionTime * windZ);
      bank.material.uniforms.windOffset.value.set(
        motionTime * windX * 0.018,
        motionTime * windZ * 0.018,
      );
      bank.material.uniforms.stepCount.value = normalizedQuality === 'high' ? 18 : 12;
      bank.updateWorldMatrix(true, false);
      bank.material.uniforms.worldToVolume.value.copy(bank.matrixWorld).invert();
    });
  };
  return cloudSystem;
}

export function applyAtmosphereEnvironment(scene, renderer) {
  const environmentScene = new THREE.Scene();
  environmentScene.add(createEnvironmentSky());
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(environmentScene, 0.035, 0.1, 500);
  scene.environment = target.texture;
  scene.environmentIntensity = DAYLIGHT_ENERGY_PROFILE.environmentIntensity;
  generator.dispose();
  environmentScene.traverse((object) => {
    object.geometry?.dispose?.();
    object.material?.dispose?.();
  });
  return target;
}

function createRidge(name, frontZ, depth, baseY, peakRange, color, seed, connectToTerrain = false) {
  const random = seededRandom(seed);
  const segmentsX = 72;
  const segmentsZ = 12;
  const pointsX = segmentsX + 1;
  const vertices = [];
  const colors = [];
  const ridgeDrainage = [];
  const ridgeExposedStone = [];
  const ridgeHeightFraction = [];
  const uvs = [];
  const indices = [];
  const surfaceFields = [];
  const baseColor = new THREE.Color(color).offsetHSL(-0.008, 0.035, -0.075);
  const slopeColor = new THREE.Color(color).offsetHSL(0.002, -0.015, 0.005);
  const crestColor = new THREE.Color(color).offsetHSL(0.009, -0.085, 0.095);
  const drainageColor = new THREE.Color(color).offsetHSL(-0.012, 0.035, -0.11);
  const stoneColor = new THREE.Color(color).offsetHSL(0.015, -0.12, 0.13);
  const crestHeights = [];
  let rollingNoise = random() - 0.5;
  for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
    const x = -220 + (440 * xIndex) / segmentsX;
    rollingNoise = rollingNoise * 0.82 + (random() - 0.5) * 0.34;
    const broadRelief = Math.sin(x * 0.018 + seed * 0.007) * 0.43
      + Math.sin(x * 0.041 - seed * 0.013) * 0.24
      + Math.sin(x * 0.086 + 1.7) * 0.1
      + rollingNoise * 0.44;
    crestHeights.push(THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(peakRange[0], peakRange[1], 0.53 + broadRelief * 0.44),
      peakRange[0],
      peakRange[1],
    ));
  }

  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const depthFraction = zIndex / segmentsZ;
    const z = frontZ - depth * depthFraction;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const xFraction = xIndex / segmentsX;
      const x = -220 + 440 * xFraction;
      const crossSlopeWarp = Math.sin(x * 0.032 + seed * 0.011) * 0.045
        * Math.sin(depthFraction * Math.PI);
      const warpedDepth = THREE.MathUtils.clamp(depthFraction + crossSlopeWarp, 0, 1);
      const crossSection = Math.sin(warpedDepth * Math.PI) ** 0.72;
      const shoulderBreak = 0.91
        + Math.sin(x * 0.071 + z * 0.025 + seed * 0.017) * 0.055
        + Math.sin(x * 0.137 - z * 0.019) * 0.025;
      const drainageWave = Math.sin(x * 0.052 + z * 0.011 + seed * 0.021) * 0.66
        + Math.sin(x * 0.113 - z * 0.018 - seed * 0.009) * 0.34;
      const drainage = (THREE.MathUtils.clamp(drainageWave * 0.5 + 0.5, 0, 1) ** 9)
        * crossSection
        * THREE.MathUtils.lerp(1.15, 2.75, 1 - Math.abs(depthFraction - 0.5) * 2);
      const erosion = (
        Math.sin(x * 0.19 + z * 0.057 + seed * 0.031) * 0.36
        + Math.sin(x * 0.087 - z * 0.091 + 2.4) * 0.24
      ) * crossSection;
      const crestHeight = crestHeights[xIndex];
      const terrainConnection = connectToTerrain
        ? 1 - THREE.MathUtils.smoothstep(Math.abs(x), 82, 108)
        : 0;
      const frontHeight = THREE.MathUtils.lerp(
        baseY,
        terrainHeight(x, frontZ) - 0.04,
        terrainConnection,
      );
      const slopeBaseline = THREE.MathUtils.lerp(frontHeight, baseY, depthFraction);
      const y = slopeBaseline
        + (crestHeight - slopeBaseline) * crossSection * shoulderBreak
        - drainage
        + erosion;
      vertices.push(x, y, z);
      uvs.push(xFraction, depthFraction);

      const heightFraction = THREE.MathUtils.clamp((y - baseY) / (peakRange[1] - baseY), 0, 1);
      const drainageWeight = THREE.MathUtils.clamp(drainage / 2.75, 0, 1);
      const exposedStone = THREE.MathUtils.smoothstep(heightFraction, 0.52, 0.9)
        * THREE.MathUtils.clamp(
          Math.sin(x * 0.116 - z * 0.074 + seed * 0.019) * 0.5 + 0.5,
          0,
          1,
        ) ** 5;
      surfaceFields.push({
        drainageWeight,
        exposedStone,
        heightFraction,
      });
      ridgeDrainage.push(drainageWeight);
      ridgeExposedStone.push(exposedStone);
      ridgeHeightFraction.push(heightFraction);
      const vertexColor = baseColor.clone()
        .lerp(slopeColor, THREE.MathUtils.smoothstep(heightFraction, 0.08, 0.52))
        .lerp(crestColor, THREE.MathUtils.smoothstep(heightFraction, 0.58, 0.98))
        .lerp(drainageColor, drainageWeight * 0.58)
        .lerp(stoneColor, exposedStone * 0.3);
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);

      if (xIndex < segmentsX && zIndex < segmentsZ) {
        const offset = zIndex * pointsX + xIndex;
        const nextRow = offset + pointsX;
        indices.push(offset, offset + 1, nextRow, offset + 1, nextRow + 1, nextRow);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('ridgeDrainage', new THREE.Float32BufferAttribute(ridgeDrainage, 1));
  geometry.setAttribute(
    'ridgeExposedStone',
    new THREE.Float32BufferAttribute(ridgeExposedStone, 1),
  );
  geometry.setAttribute(
    'ridgeHeightFraction',
    new THREE.Float32BufferAttribute(ridgeHeightFraction, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'world-space-eroded-ridge-heightfield';
  geometry.userData.segments = [segmentsX, segmentsZ];
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    fog: true,
    side: THREE.FrontSide,
    dithering: true,
  });
  material.userData.surface = 'matte-aerial-weathered-ridge';
  material.userData.diffuseModel = 'Lambert';
  material.userData.processSurface = RIDGE_SURFACE_PROFILE;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute float ridgeDrainage;
        attribute float ridgeExposedStone;
        attribute float ridgeHeightFraction;
        varying float vRidgeDrainage;
        varying float vRidgeExposedStone;
        varying float vRidgeHeightFraction;
        varying vec3 vRidgeLocalPosition;
        varying vec3 vRidgeLocalNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vRidgeDrainage = ridgeDrainage;
        vRidgeExposedStone = ridgeExposedStone;
        vRidgeHeightFraction = ridgeHeightFraction;
        vRidgeLocalPosition = position;
        vRidgeLocalNormal = normal;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying float vRidgeDrainage;
        varying float vRidgeExposedStone;
        varying float vRidgeHeightFraction;
        varying vec3 vRidgeLocalPosition;
        varying vec3 vRidgeLocalNormal;
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float ridgeBroadDetail = sin(
          (vRidgeLocalPosition.x / ${RIDGE_SURFACE_PROFILE.broadDetailPeriodMeters.toFixed(1)}
            + vRidgeLocalPosition.z / 53.0) * 6.2831853
        ) * 0.58 + sin(
          (vRidgeLocalPosition.x / 61.0
            - vRidgeLocalPosition.z / ${RIDGE_SURFACE_PROFILE.broadDetailPeriodMeters.toFixed(1)})
            * 6.2831853 + 1.7
        ) * 0.42;
        float ridgeFineDetail = sin(
          (vRidgeLocalPosition.x / ${RIDGE_SURFACE_PROFILE.fineDetailPeriodMeters.toFixed(1)}
            - vRidgeLocalPosition.z / 17.0) * 6.2831853
        ) * 0.54 + sin(
          (vRidgeLocalPosition.x / 23.0 + vRidgeLocalPosition.z / 11.0)
            * 6.2831853 - 0.9
        ) * 0.46;
        float ridgeMicroDetail = sin(
          (vRidgeLocalPosition.x / ${RIDGE_SURFACE_PROFILE.microDetailPeriodMeters.toFixed(1)}
            + vRidgeLocalPosition.z / 12.0) * 6.2831853 + 0.43
        ) * 0.57 + sin(
          (vRidgeLocalPosition.x / 15.0 - vRidgeLocalPosition.z / 8.0)
            * 6.2831853 - 1.13
        ) * 0.43;
        vec3 ridgeNormal = normalize(vRidgeLocalNormal);
        float ridgeSlope = smoothstep(0.08, 0.68, 1.0 - abs(ridgeNormal.y));
        float ridgeAspect = clamp(
          dot(normalize(ridgeNormal.xz + vec2(0.0001)), normalize(vec2(-0.44, 0.71)))
            * 0.5 + 0.5,
          0.0,
          1.0
        );
        float ridgeHumus = (0.24 + vRidgeDrainage * 0.76)
          * smoothstep(-0.42, 0.46, ridgeBroadDetail)
          * (1.0 - ridgeSlope * 0.58)
          * (1.0 - vRidgeExposedStone);
        float ridgeVegetatedSoil = smoothstep(0.08, 0.3, vRidgeHeightFraction)
          * (1.0 - smoothstep(0.7, 0.94, vRidgeHeightFraction))
          * (1.0 - ridgeSlope * 0.72)
          * (1.0 - vRidgeExposedStone)
          * smoothstep(-0.68, 0.38, ridgeBroadDetail + vRidgeDrainage * 0.42);
        float ridgeSlopeSubstrate = ridgeSlope
          * (1.0 - vRidgeDrainage * 0.78)
          * smoothstep(0.12, 0.78, vRidgeHeightFraction)
          * smoothstep(-0.62, 0.54, ridgeFineDetail + ridgeMicroDetail * 0.3);
        float ridgeStone = vRidgeExposedStone
          * smoothstep(-0.46, 0.5, ridgeFineDetail + ridgeMicroDetail * 0.24)
          * smoothstep(0.42, 0.92, vRidgeHeightFraction);
        diffuseColor.rgb *= mix(
          vec3(1.0),
          vec3(0.62, 0.73, 0.58),
          ridgeHumus * ${RIDGE_SURFACE_PROFILE.maximumHumusDarkening.toFixed(2)}
        );
        float ridgeSurfaceLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 ridgeVegetatedSoilColour = vec3(
          ridgeSurfaceLuma * 0.79,
          ridgeSurfaceLuma * 0.87,
          ridgeSurfaceLuma * 0.67
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          ridgeVegetatedSoilColour,
          ridgeVegetatedSoil * ${RIDGE_SURFACE_PROFILE.maximumVegetatedSoilBlend.toFixed(2)}
        );
        vec3 ridgeSlopeSubstrateColour = vec3(
          ridgeSurfaceLuma * mix(1.06, 1.15, ridgeAspect),
          ridgeSurfaceLuma * mix(0.96, 1.02, ridgeAspect),
          ridgeSurfaceLuma * mix(0.78, 0.87, ridgeAspect)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          ridgeSlopeSubstrateColour,
          ridgeSlopeSubstrate * ${RIDGE_SURFACE_PROFILE.maximumSlopeSubstrateBlend.toFixed(2)}
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          vec3(ridgeSurfaceLuma * 1.08, ridgeSurfaceLuma * 1.02, ridgeSurfaceLuma * 0.92),
          ridgeStone * ${RIDGE_SURFACE_PROFILE.maximumStoneBlend.toFixed(2)}
        );
      `);
  };
  material.customProgramCacheKey = () => RIDGE_SURFACE_PROFILE.version;
  const ridge = new THREE.Mesh(geometry, material);
  ridge.name = name;
  ridge.userData.profile = 'lit-eroded-terrain-ridge-volume';
  ridge.userData.depthMeters = depth;
  ridge.userData.baseY = baseY;
  ridge.userData.peakRange = [...peakRange];
  ridge.userData.frontConnection = connectToTerrain
    ? 'centre-apron-buried-into-playable-heightfield-with-subgrade-side-skirts'
    : 'buried-behind-near-ridge-volume';
  ridge.userData.frontConnectionRange = connectToTerrain ? [-108, 108] : null;
  ridge.userData.lighting = 'world-normal-directional-light-plus-exponential-aerial-fog';
  ridge.userData.surfaceMaterial = RIDGE_SURFACE_PROFILE;
  ridge.userData.sourceColour = `#${new THREE.Color(color).getHexString()}`;
  ridge.userData.collisionPolicy = 'non-interactive-terrain-beyond-navigation-boundary';
  ridge.castShadow = false;
  ridge.receiveShadow = false;
  const forest = createRidgeForest({
    ridgeName: name,
    geometry,
    surfaceFields,
    segmentsX,
    segmentsZ,
    seed: seed + 3001,
    baseY,
    isNearRidge: connectToTerrain,
  });
  ridge.add(forest);
  ridge.userData.forest = Object.freeze({
    ...forest.userData.summary,
    ridgeSurface: RIDGE_SURFACE_PROFILE,
  });
  return ridge;
}

function normalizedCrownGeometry(profile) {
  const markClosedComponent = (source, lobe, branch = 0) => {
    const crown = source.index ? source.toNonIndexed() : source;
    if (crown !== source) source.dispose();
    crown.setAttribute(
      'ridgeCrownLobe',
      new THREE.Float32BufferAttribute(
        Float32Array.from({ length: crown.attributes.position.count }, () => lobe),
        1,
      ),
    );
    crown.setAttribute(
      'ridgeCrownBranch',
      new THREE.Float32BufferAttribute(
        Float32Array.from({ length: crown.attributes.position.count }, () => branch),
        1,
      ),
    );
    crown.computeVertexNormals();
    return crown;
  };
  const createBranch = (start, end, lobe, bottomRadius, topRadius) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    const branch = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 5, 1, false);
    branch.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      ),
    );
    branch.translate(
      (start.x + end.x) * 0.5,
      (start.y + end.y) * 0.5,
      (start.z + end.z) * 0.5,
    );
    return markClosedComponent(branch, lobe, 1);
  };
  const sourceGeometries = profile === 'broad'
    ? (() => {
      const foliageLayouts = [
        [0, 0, 0.25, 0, 0.42, 0.24, 0.35, 1],
        [1, -0.03, 0.52, 0.02, 0.37, 0.22, 0.32, 1],
        [2, 0.03, 0.78, 0, 0.26, 0.21, 0.23, 0],
        [3, -0.46, 0.4, 0.1, 0.3, 0.16, 0.25, 0],
        [4, -0.64, 0.52, -0.07, 0.25, 0.14, 0.21, 0],
        [5, 0.47, 0.43, -0.1, 0.31, 0.17, 0.26, 0],
        [6, 0.65, 0.56, 0.08, 0.25, 0.14, 0.21, 0],
        [7, -0.32, 0.65, 0.2, 0.25, 0.15, 0.22, 0],
        [8, 0.33, 0.68, -0.18, 0.26, 0.15, 0.22, 0],
        [9, -0.05, 0.53, 0.37, 0.26, 0.15, 0.21, 0],
        [10, 0.08, 0.57, -0.37, 0.25, 0.15, 0.21, 0],
      ];
      const foliage = foliageLayouts.map(
        ([lobe, x, y, z, scaleX, scaleY, scaleZ, detail]) => {
          const cohort = new THREE.IcosahedronGeometry(1, detail);
          cohort.scale(scaleX, scaleY, scaleZ);
          cohort.translate(x, y, z);
          return markClosedComponent(cohort, lobe);
        },
      );
      const branchLayouts = [
        [[0, 0.02, 0], [0.03, 0.78, 0], 2, 0.058, 0.03],
        [[0, 0.12, 0], [-0.46, 0.4, 0.1], 3, 0.056, 0.027],
        [[-0.38, 0.36, 0.08], [-0.64, 0.52, -0.07], 4, 0.032, 0.018],
        [[0, 0.13, 0], [0.47, 0.43, -0.1], 5, 0.057, 0.028],
        [[0.4, 0.39, -0.08], [0.65, 0.56, 0.08], 6, 0.032, 0.018],
        [[-0.02, 0.33, 0.02], [-0.32, 0.65, 0.2], 7, 0.044, 0.022],
        [[0.01, 0.35, 0], [0.33, 0.68, -0.18], 8, 0.043, 0.021],
        [[0, 0.3, 0.03], [-0.05, 0.53, 0.37], 9, 0.04, 0.02],
        [[0, 0.31, -0.03], [0.08, 0.57, -0.37], 10, 0.04, 0.02],
      ];
      const branches = branchLayouts.map(
        ([start, end, lobe, bottomRadius, topRadius]) => createBranch(
          new THREE.Vector3(...start),
          new THREE.Vector3(...end),
          lobe,
          bottomRadius,
          topRadius,
        ),
      );
      return [...foliage, ...branches];
    })()
    : (() => {
      const whorlLayouts = [
        [0, 0, 0.2, 0, 0.66, 0.18, 0.66],
        [1, -0.03, 0.4, 0.02, 0.52, 0.17, 0.52],
        [2, 0.03, 0.6, -0.02, 0.38, 0.17, 0.38],
        [3, 0, 0.8, 0, 0.23, 0.18, 0.23],
      ];
      const whorls = whorlLayouts.map(([lobe, x, y, z, scaleX, scaleY, scaleZ]) => {
        const whorl = new THREE.LatheGeometry([
          new THREE.Vector2(0, -1),
          new THREE.Vector2(0.95, -0.82),
          new THREE.Vector2(0.78, -0.48),
          new THREE.Vector2(0.52, 0.1),
          new THREE.Vector2(0.18, 0.78),
          new THREE.Vector2(0, 1),
        ], 12, 0, Math.PI * 2);
        whorl.scale(scaleX, scaleY, scaleZ);
        whorl.translate(x, y, z);
        return markClosedComponent(whorl, lobe);
      });
      const leader = createBranch(
        new THREE.Vector3(0, 0.015, 0),
        new THREE.Vector3(0, 0.96, 0),
        3,
        0.05,
        0.018,
      );
      return [...whorls, leader];
    })();
  const mergedGeometry = mergeGeometries(sourceGeometries, false);
  for (const source of sourceGeometries) source.dispose();
  if (!mergedGeometry) throw new Error(`Unable to build ${profile} ridge crown geometry`);
  mergedGeometry.deleteAttribute('normal');
  mergedGeometry.deleteAttribute('uv');
  const geometry = mergeVertices(mergedGeometry, 1e-5);
  mergedGeometry.dispose();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const centreX = (bounds.min.x + bounds.max.x) * 0.5;
  const centreZ = (bounds.min.z + bounds.max.z) * 0.5;
  const widthX = Math.max(0.001, bounds.max.x - bounds.min.x);
  const widthZ = Math.max(0.001, bounds.max.z - bounds.min.z);
  const height = Math.max(0.001, bounds.max.y - bounds.min.y);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedY = (positions.getY(index) - bounds.min.y) / height;
    const normalizedX = ((positions.getX(index) - centreX) * 2) / widthX;
    const normalizedZ = ((positions.getZ(index) - centreZ) * 2) / widthZ;
    const angle = Math.atan2(normalizedZ, normalizedX);
    const irregularity = 1
      + Math.sin(angle * (profile === 'broad' ? 5 : 7) + normalizedY * 4.1) * 0.045;
    positions.setXYZ(
      index,
      normalizedX * irregularity,
      normalizedY,
      normalizedZ * irregularity,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const colours = [];
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedY = THREE.MathUtils.clamp(positions.getY(index), 0, 1);
    const directionalBreakup = Math.sin(
      positions.getX(index) * 4.7 + positions.getZ(index) * 3.9 + normalizedY * 2.1,
    ) * 0.025;
    const exposure = THREE.MathUtils.clamp(
      (profile === 'broad' ? 0.72 : 0.68) + normalizedY * 0.27 + directionalBreakup,
      0.62,
      1,
    );
    colours.push(exposure, exposure, exposure);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = profile === 'broad'
    ? 'closed-branch-supported-eleven-leaf-cohort-broad-crown-v4'
    : 'closed-leader-supported-four-whorl-narrow-distant-crown-v4';
  geometry.userData.closedVolume = true;
  geometry.userData.closedComponentCount = profile === 'broad' ? 20 : 5;
  geometry.userData.foliageCohortCount = profile === 'broad' ? 11 : 4;
  geometry.userData.structuralBranchComponentCount = profile === 'broad' ? 9 : 1;
  geometry.userData.componentOverlap = profile === 'broad'
    ? 'nine-tapered-forks-overlap-trunk-or-parent-cohort-and-eleven-closed-leaf-cohorts'
    : 'one-closed-tapered-leader-overlaps-trunk-and-four-closed-whorl-cohorts';
  geometry.userData.surfaceModel =
    'branch-supported-leaf-cohorts-with-instance-varied-age-asymmetry-and-source-damage';
  geometry.userData.triangleCount = geometry.index.count / 3;
  return geometry;
}

function applyRidgeCrownVariation(material, crownProfile) {
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute vec4 ridgeCrownVariation;
        attribute float ridgeCrownLobe;
        attribute float ridgeCrownBranch;
        varying float vRidgeCrownBranch;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 ridgeCrownUndeformed = transformed;
        vRidgeCrownBranch = ridgeCrownBranch;
        float ridgeCrownHeight = clamp(transformed.y, 0.0, 1.0);
        float ridgeCrownArchitecture = ridgeCrownVariation.x;
        float ridgeCrownPhase = ridgeCrownVariation.y * 6.2831853;
        float ridgeCrownAsymmetry = ridgeCrownVariation.z;
        float ridgeCrownDamage = ridgeCrownVariation.w;
        float ridgeCrownAngle = atan(transformed.z, transformed.x);
        float ridgeCrownTier = sin(
          ridgeCrownHeight * mix(2.2, 3.65, ridgeCrownArchitecture) * 6.2831853
            + ridgeCrownPhase + ridgeCrownLobe * 0.71
        );
        float ridgeCrownEdge = sin(
          ridgeCrownAngle * mix(4.0, 6.8, ridgeCrownArchitecture)
            + ridgeCrownPhase * 1.37 + ridgeCrownLobe * 1.91
        ) * 0.058 + sin(
          ridgeCrownAngle * 9.0 - ridgeCrownPhase * 0.83
            + ridgeCrownHeight * 5.1
        ) * 0.028;
        float ridgeCrownRadial = 1.0
          + ridgeCrownTier * mix(0.018, 0.055, ridgeCrownArchitecture)
          + ridgeCrownEdge * mix(0.58, 1.0, ridgeCrownAsymmetry);
        float ridgeCrownDamageDirection = ridgeCrownPhase * 1.73 + 0.8;
        float ridgeCrownDamageSector = pow(max(cos(
          ridgeCrownAngle - ridgeCrownDamageDirection
        ), 0.0), 8.0) * smoothstep(0.24, 0.92, ridgeCrownHeight);
        ridgeCrownRadial *= 1.0 - ridgeCrownDamageSector * ridgeCrownDamage * 0.19;
        transformed.xz *= ridgeCrownRadial;
        float ridgeCrownLean = smoothstep(0.12, 0.94, ridgeCrownHeight)
          * ridgeCrownAsymmetry * mix(0.025, 0.1, ridgeCrownArchitecture);
        transformed.x += cos(ridgeCrownPhase) * ridgeCrownLean;
        transformed.z += sin(ridgeCrownPhase) * ridgeCrownLean;
        ${crownProfile === 'broad' ? `
          float ridgeCrownLobePhase = ridgeCrownPhase + ridgeCrownLobe * 1.47;
          float ridgeCrownLobeWeight = step(0.5, ridgeCrownLobe);
          transformed.x += cos(ridgeCrownLobePhase) * ridgeCrownLobeWeight
            * ridgeCrownAsymmetry * 0.045;
          transformed.z += sin(ridgeCrownLobePhase) * ridgeCrownLobeWeight
            * ridgeCrownAsymmetry * 0.045;
          float ridgeCrownMaturityBreadth = 0.84
            + sin(ridgeCrownArchitecture * 3.14159265) * 0.19;
          transformed.xz *= ridgeCrownMaturityBreadth;
        ` : `
          transformed.xz *= mix(
            vec2(1.0),
            vec2(0.82 + ridgeCrownAsymmetry * 0.18, 1.08),
            ridgeCrownArchitecture * 0.24
          );
        `}
        transformed = mix(transformed, ridgeCrownUndeformed, ridgeCrownBranch);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying float vRidgeCrownBranch;
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          vec3(0.075, 0.052, 0.032),
          vRidgeCrownBranch
        );
      `);
  };
  material.customProgramCacheKey = () => (
    `${previousProgramCacheKey()}|ridge-crown-architecture-v4-${crownProfile}`
  );
  material.userData.crownVariation = Object.freeze({
    version: 'ridge-crown-architecture-v4',
    profile: crownProfile,
    attribute: 'ridgeCrownVariation',
    sources: 'age-height-slope-drainage-and-exposed-stone',
    maximumDamageIndentRatio: 0.19,
    maximumLeanRatio: 0.1,
  });
}

function triangleSurfaceSample(attribute, pointsX, xIndex, zIndex, u, v, target) {
  const lowerLeft = zIndex * pointsX + xIndex;
  const lowerRight = lowerLeft + 1;
  const upperLeft = lowerLeft + pointsX;
  const upperRight = upperLeft + 1;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  if (u + v <= 1) {
    a.fromBufferAttribute(attribute, lowerLeft);
    b.fromBufferAttribute(attribute, lowerRight);
    c.fromBufferAttribute(attribute, upperLeft);
    return target.copy(a)
      .addScaledVector(b.clone().sub(a), u)
      .addScaledVector(c.clone().sub(a), v);
  }
  a.fromBufferAttribute(attribute, upperRight);
  b.fromBufferAttribute(attribute, upperLeft);
  c.fromBufferAttribute(attribute, lowerRight);
  return target.copy(a)
    .addScaledVector(b.clone().sub(a), 1 - u)
    .addScaledVector(c.clone().sub(a), 1 - v);
}

function triangleSurfaceField(fields, pointsX, xIndex, zIndex, u, v, key) {
  const lowerLeft = zIndex * pointsX + xIndex;
  const lowerRight = lowerLeft + 1;
  const upperLeft = lowerLeft + pointsX;
  const upperRight = upperLeft + 1;
  if (u + v <= 1) {
    return fields[lowerLeft][key]
      + (fields[lowerRight][key] - fields[lowerLeft][key]) * u
      + (fields[upperLeft][key] - fields[lowerLeft][key]) * v;
  }
  return fields[upperRight][key]
    + (fields[upperLeft][key] - fields[upperRight][key]) * (1 - u)
    + (fields[lowerRight][key] - fields[upperRight][key]) * (1 - v);
}

function createRidgeForest({
  ridgeName,
  geometry,
  surfaceFields,
  segmentsX,
  segmentsZ,
  seed,
  baseY,
  isNearRidge,
}) {
  const random = seededRandom(seed);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const pointsX = segmentsX + 1;
  const placements = [];
  const understoryPlacements = [];
  const sampledPosition = new THREE.Vector3();
  const sampledNormal = new THREE.Vector3();

  for (let zIndex = 1; zIndex < segmentsZ - 1; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      for (let surfaceSample = 0; surfaceSample < 2; surfaceSample += 1) {
      const u = surfaceSample === 0
        ? 0.08 + random() * 0.36
        : 0.56 + random() * 0.36;
      const v = surfaceSample === 0
        ? 0.1 + random() * 0.34
        : 0.54 + random() * 0.38;
      triangleSurfaceSample(positions, pointsX, xIndex, zIndex, u, v, sampledPosition);
      triangleSurfaceSample(normals, pointsX, xIndex, zIndex, u, v, sampledNormal).normalize();
      const drainageWeight = triangleSurfaceField(
        surfaceFields,
        pointsX,
        xIndex,
        zIndex,
        u,
        v,
        'drainageWeight',
      );
      const exposedStone = triangleSurfaceField(
        surfaceFields,
        pointsX,
        xIndex,
        zIndex,
        u,
        v,
        'exposedStone',
      );
      const heightFraction = triangleSurfaceField(
        surfaceFields,
        pointsX,
        xIndex,
        zIndex,
        u,
        v,
        'heightFraction',
      );
      if (sampledPosition.y <= baseY + 2.6 || sampledNormal.y < 0.58 || exposedStone > 0.6) {
        continue;
      }

      const slopeSuitability = THREE.MathUtils.smoothstep(sampledNormal.y, 0.58, 0.96);
      const moistureSuitability = THREE.MathUtils.clamp(
        0.42 + drainageWeight * 0.38 + (1 - heightFraction) * 0.2,
        0,
        1,
      );
      const exposureRetention = 1 - exposedStone * 0.88;
      const establishmentChance = (isNearRidge ? 0.68 : 0.63)
        * THREE.MathUtils.lerp(0.58, 1, slopeSuitability)
        * THREE.MathUtils.lerp(0.7, 1.08, moistureSuitability)
        * exposureRetention;
      if (random() > establishmentChance) {
        const understoryChance = (isNearRidge ? 0.48 : 0.42)
          * THREE.MathUtils.lerp(0.58, 1.08, moistureSuitability)
          * THREE.MathUtils.lerp(0.62, 1, slopeSuitability)
          * (1 - exposedStone * 0.94);
        if (exposedStone <= 0.46 && random() <= understoryChance) {
          const understoryHeight = THREE.MathUtils.lerp(
            isNearRidge ? 1.6 : 1.35,
            isNearRidge ? 3.4 : 2.85,
            random() ** 0.78,
          ) * THREE.MathUtils.lerp(0.86, 1.08, moistureSuitability);
          understoryPlacements.push({
            x: sampledPosition.x,
            y: sampledPosition.y,
            z: sampledPosition.z,
            broad: true,
            understory: true,
            crownHeight: understoryHeight,
            crownRadius: understoryHeight * THREE.MathUtils.lerp(0.52, 0.76, random()),
            yaw: random() * Math.PI * 2,
            shade: THREE.MathUtils.lerp(0.72, 0.91, random())
              * THREE.MathUtils.lerp(0.92, 1.06, moistureSuitability),
            slopeY: sampledNormal.y,
            drainageWeight,
            exposedStone,
            heightFraction,
          });
        }
        continue;
      }

      const broad = random() < THREE.MathUtils.lerp(0.42, 0.68, moistureSuitability);
      const height = THREE.MathUtils.lerp(
        isNearRidge ? 3.6 : 3,
        isNearRidge ? 9.4 : 8.2,
        random() ** 0.85,
      ) * THREE.MathUtils.lerp(0.82, 1.08, moistureSuitability);
      const trunkHeight = height * (broad
        ? THREE.MathUtils.lerp(0.39, 0.5, random())
        : THREE.MathUtils.lerp(0.43, 0.54, random()));
      const crownHeight = height * (broad ? 0.66 : 0.78);
      const crownRadius = height * (broad
        ? THREE.MathUtils.lerp(0.3, 0.4, random())
        : THREE.MathUtils.lerp(0.2, 0.29, random()));
      const trunkRadius = height * THREE.MathUtils.lerp(0.025, 0.04, random());
      placements.push({
        x: sampledPosition.x,
        y: sampledPosition.y,
        z: sampledPosition.z,
        broad,
        height,
        trunkHeight,
        trunkRadius,
        crownHeight,
        crownRadius,
        crownOverlap: crownHeight * (broad ? 0.16 : 0.2),
        yaw: random() * Math.PI * 2,
        shade: THREE.MathUtils.lerp(0.84, 1.08, random()),
        slopeY: sampledNormal.y,
        drainageWeight,
        exposedStone,
        heightFraction,
      });
      }
    }
  }

  const variationHash = (placement, salt) => {
    const value = Math.sin(
      placement.x * 12.9898 + placement.z * 78.233 + seed * 0.001 + salt * 19.19,
    ) * 43758.5453;
    return value - Math.floor(value);
  };
  const allCrownPlacements = [...placements, ...understoryPlacements];
  allCrownPlacements.forEach((placement, index) => {
    const heightSignal = placement.understory
      ? THREE.MathUtils.clamp((placement.crownHeight - 1.35) / 2.05, 0, 1) * 0.24
      : THREE.MathUtils.clamp((placement.height - 3.6) / 5.0, 0, 1);
    const architecture = placement.understory
      ? 0.08 + variationHash(placement, index + 3) * 0.18
      : THREE.MathUtils.clamp(
        heightSignal * 0.68 + variationHash(placement, index + 7) * 0.32,
        0,
        1,
      );
    const asymmetry = THREE.MathUtils.clamp(
      0.14 + variationHash(placement, index + 13) * 0.48
        + placement.exposedStone * 0.28
        + (1 - placement.slopeY) * 0.22,
      0.12,
      0.92,
    );
    const damage = THREE.MathUtils.clamp(
      variationHash(placement, index + 29) * 0.28
        + placement.exposedStone * 0.62
        + placement.heightFraction * 0.18,
      0,
      0.86,
    );
    placement.crownArchitecture = architecture < 0.34
      ? 'juvenile-pioneer'
      : architecture < 0.7
        ? 'layered-mature'
        : 'weathered-emergent';
    placement.crownVariation = [
      architecture,
      variationHash(placement, index + 41),
      asymmetry,
      damage,
    ];
  });

  const group = new THREE.Group();
  group.name = `${ridgeName}.vegetation`;
  const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.68, 1, 6, 1, false);
  trunkGeometry.translate(0, 0.5, 0);
  trunkGeometry.computeBoundingBox();
  trunkGeometry.computeBoundingSphere();
  trunkGeometry.userData.profile = 'closed-low-poly-distant-trunk';
  trunkGeometry.userData.supportRootY = 0;
  const broadCrownGeometry = normalizedCrownGeometry('broad');
  const narrowCrownGeometry = normalizedCrownGeometry('narrow');
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d2a22,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    fog: true,
  });
  const broadCrownMaterial = new THREE.MeshStandardMaterial({
    color: isNearRidge ? 0x173c2b : 0x29463d,
    roughness: 0.93,
    metalness: 0,
    flatShading: false,
    vertexColors: true,
    fog: true,
  });
  const narrowCrownMaterial = new THREE.MeshStandardMaterial({
    color: isNearRidge ? 0x15372a : 0x253f38,
    roughness: 0.95,
    metalness: 0,
    flatShading: false,
    vertexColors: true,
    fog: true,
  });
  for (const material of [trunkMaterial, broadCrownMaterial, narrowCrownMaterial]) {
    material.userData.surface = 'matte-non-emissive-distant-ridge-vegetation';
    material.userData.energyModel = 'opaque-dielectric-direct-and-environment-light-response';
  }

  const broadPlacements = placements.filter((placement) => placement.broad);
  const narrowPlacements = placements.filter((placement) => !placement.broad);
  const broadCrownPlacements = [...broadPlacements, ...understoryPlacements];
  const addCrownVariationAttribute = (crownGeometry, list) => {
    crownGeometry.setAttribute(
      'ridgeCrownVariation',
      new THREE.InstancedBufferAttribute(
        Float32Array.from(list.flatMap((placement) => placement.crownVariation)),
        4,
      ),
    );
  };
  addCrownVariationAttribute(broadCrownGeometry, broadCrownPlacements);
  addCrownVariationAttribute(narrowCrownGeometry, narrowPlacements);
  applyRidgeCrownVariation(broadCrownMaterial, 'broad');
  applyRidgeCrownVariation(narrowCrownMaterial, 'narrow');
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, placements.length);
  const broadCrowns = new THREE.InstancedMesh(
    broadCrownGeometry,
    broadCrownMaterial,
    broadCrownPlacements.length,
  );
  const narrowCrowns = new THREE.InstancedMesh(
    narrowCrownGeometry,
    narrowCrownMaterial,
    narrowPlacements.length,
  );
  trunks.name = `${ridgeName}.vegetation.trunks`;
  broadCrowns.name = `${ridgeName}.vegetation.broad-crowns`;
  narrowCrowns.name = `${ridgeName}.vegetation.narrow-crowns`;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, placement.y - 0.06, placement.z);
    dummy.rotation.set(0, placement.yaw, 0);
    dummy.scale.set(
      placement.trunkRadius * 2,
      placement.trunkHeight + 0.06,
      placement.trunkRadius * 2,
    );
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    tint.setScalar(placement.shade);
    trunks.setColorAt(index, tint);
  });
  const placeCrowns = (mesh, list) => {
    list.forEach((placement, index) => {
      dummy.position.set(
        placement.x,
        placement.understory
          ? placement.y - 0.045
          : placement.y + placement.trunkHeight - placement.crownOverlap,
        placement.z,
      );
      dummy.rotation.set(0, placement.yaw, 0);
      dummy.scale.set(placement.crownRadius, placement.crownHeight, placement.crownRadius);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      tint.setRGB(
        placement.shade * (0.965 - placement.exposedStone * 0.025),
        placement.shade * (0.985 + placement.drainageWeight * 0.028),
        placement.shade * (0.95 + (1 - placement.heightFraction) * 0.025),
      );
      mesh.setColorAt(index, tint);
    });
  };
  placeCrowns(broadCrowns, broadCrownPlacements);
  placeCrowns(narrowCrowns, narrowPlacements);
  for (const mesh of [trunks, broadCrowns, narrowCrowns]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.userData.collisionRole = 'non-solid-distant-background-vegetation';
    group.add(mesh);
  }

  const summary = Object.freeze({
    profile: 'terrain-cohort-and-understory-sourced-ridge-forest-v5',
    ridge: ridgeName,
    instanceCount: placements.length,
    broadCrownCount: broadPlacements.length,
    narrowCrownCount: narrowPlacements.length,
    understoryCrownCount: understoryPlacements.length,
    totalCrownCount: broadCrownPlacements.length + narrowPlacements.length,
    drawCalls: 3,
    samplesPerSurfaceCell: 2,
    crownArchitectureCounts: Object.freeze(Object.fromEntries([
      'juvenile-pioneer',
      'layered-mature',
      'weathered-emergent',
    ].map((architecture) => [
      architecture,
      allCrownPlacements.filter(
        (placement) => placement.crownArchitecture === architecture,
      ).length,
    ]))),
    sourceDamagedCrownCount: allCrownPlacements.filter(
      (placement) => placement.crownVariation[3] >= 0.5,
    ).length,
    crownVariationAttribute: 'ridgeCrownVariation',
    broadCrownComponentCount: broadCrownGeometry.userData.closedComponentCount,
    broadCrownFoliageCohortCount: broadCrownGeometry.userData.foliageCohortCount,
    broadCrownStructuralBranchCount:
      broadCrownGeometry.userData.structuralBranchComponentCount,
    broadCrownTriangleCount: broadCrownGeometry.userData.triangleCount,
    narrowCrownComponentCount: narrowCrownGeometry.userData.closedComponentCount,
    narrowCrownFoliageCohortCount: narrowCrownGeometry.userData.foliageCohortCount,
    narrowCrownStructuralBranchCount:
      narrowCrownGeometry.userData.structuralBranchComponentCount,
    narrowCrownTriangleCount: narrowCrownGeometry.userData.triangleCount,
    sourceModel:
      'ridge-slope-drainage-height-and-exposed-stone-tree-plus-gap-understory-establishment',
    supportEvidence: Object.freeze({
      rootCount: placements.length,
      supportedRootCount: placements.length,
      supportRatio: placements.length > 0 ? 1 : 0,
      maximumRootClearance: 0,
      maximumRootEmbedding: 0.06,
      interpolation: 'barycentric-on-rendered-ridge-triangles',
    }),
    crownAttachment: 'closed-crown-base-overlaps-load-bearing-trunk-top',
    understorySupport: Object.freeze({
      rootCount: understoryPlacements.length,
      supportedRootCount: understoryPlacements.length,
      supportRatio: understoryPlacements.length > 0 ? 1 : 0,
      maximumRootClearance: 0,
      maximumRootEmbedding: 0.045,
      interpolation: 'barycentric-on-rendered-ridge-triangles',
    }),
    crownSurface:
      'closed-branch-supported-leaf-cohort-and-whorl-crowns-with-age-asymmetry-and-source-damage',
    lighting: 'fogged-non-emissive-opaque-dielectric',
    collisionRole: 'non-solid-distant-background-vegetation',
  });
  group.userData.profile = summary.profile;
  group.userData.summary = summary;
  group.userData.placements = placements.map((placement) => ({ ...placement }));
  group.userData.understoryPlacements = understoryPlacements.map(
    (placement) => ({ ...placement }),
  );
  return group;
}

function createMistMaterial(opacity, color, phase) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      mistColor: { value: new THREE.Color(color) },
      mistOpacity: { value: opacity },
      phase: { value: phase },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 mistColor;
      uniform float mistOpacity;
      uniform float phase;
      void main() {
        float horizontalFade = smoothstep(0.0, 0.17, vUv.x)
          * (1.0 - smoothstep(0.72, 1.0, vUv.x));
        float lowerFade = smoothstep(0.0, 0.18, vUv.y);
        float upperFade = 1.0 - smoothstep(0.4, 1.0, vUv.y);
        float broadNoise = sin((vUv.x * 3.2 + vUv.y * 0.7 + phase) * 6.28318) * 0.48
          + sin((vUv.x * 7.1 - vUv.y * 2.3 - phase * 1.7) * 6.28318) * 0.24
          + sin((vUv.x * 12.7 + vUv.y * 4.2 + phase * 0.6) * 6.28318) * 0.1;
        float brokenDensity = smoothstep(-0.34, 0.42, broadNoise);
        float alpha = mistOpacity * horizontalFade * lowerFade * upperFade
          * mix(0.28, 1.0, brokenDensity);
        gl_FragColor = vec4(mistColor, alpha);
      }
    `,
  });
  return material;
}

function createMistLayer(name, z, opacity, color, seed) {
  const random = seededRandom(seed);
  const layer = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1, 1, 12, 3);
  const anchors = [-48, -22, -7, 14, 35, 57];
  anchors.forEach((anchor, index) => {
    const width = 22 + random() * 26;
    const height = 4.2 + random() * 3.8;
    const pocket = new THREE.Mesh(
      geometry,
      createMistMaterial(opacity * (0.72 + random() * 0.42), color, random()),
    );
    pocket.position.set(
      anchor + (random() - 0.5) * 10,
      0.55 + height * 0.46 + random() * 1.2,
      (random() - 0.5) * 8,
    );
    pocket.rotation.y = (random() - 0.5) * 0.22;
    pocket.scale.set(width, height, 1);
    pocket.name = `${name}.pocket-${index + 1}`;
    pocket.renderOrder = -18 + index;
    pocket.userData.profile = 'low-broken-mist-pocket';
    layer.add(pocket);
  });
  layer.position.z = z;
  layer.name = name;
  layer.userData.profile = 'irregular-distance-layered-mist';
  return layer;
}

export function createAtmosphere(scene) {
  const group = new THREE.Group();
  group.name = 'world.atmosphere';
  const cloudVeil = createCloudLayer(CLOUD_PROFILES.veil);
  const overheadCloudField = createOverheadCloudField(SUN_DIRECTION);
  const cloudDeck = overheadCloudField.mesh;
  const cloudBanks = createCloudBanks();
  group.add(
    createDisplaySky(),
    cloudVeil,
    cloudDeck,
    cloudBanks,
    createRidge('world.atmosphere.far-ridge', -154, 74, -18, [12, 31], 0x394840, 811),
    createRidge('world.atmosphere.near-ridge', -104.5, 65, -16, [8, 23], 0x3c4a35, 419, true),
    createMistLayer('world.atmosphere.mist-near', -47, 0.035, 0x77948d, 241),
    createMistLayer('world.atmosphere.mist-mid', -82, 0.062, 0x759695, 517),
    createMistLayer('world.atmosphere.mist-far', -116, 0.092, 0x72969b, 881),
  );
  group.userData.environmentLighting = 'bounded-pmrem-physical-sky-dielectric-response';
  group.userData.applyCloudShadowsTo = (targetScene) => overheadCloudField.applyTo(targetScene);
  group.userData.cloudFieldSnapshot = () => ({
    ...cloudBanks.userData.snapshot(),
    overheadCoupling: overheadCloudField.snapshot(),
  });
  group.userData.ridgeForestSnapshot = () => {
    const ridges = ['far-ridge', 'near-ridge'].map((ridge) => {
      const object = group.getObjectByName(`world.atmosphere.${ridge}`);
      return object?.userData.forest ?? null;
    }).filter(Boolean);
    return {
      profile: 'terrain-cohort-and-understory-sourced-ridge-forest-v5',
      ridgeCount: ridges.length,
      totalInstances: ridges.reduce((total, ridge) => total + ridge.instanceCount, 0),
      totalUnderstoryCrowns: ridges.reduce(
        (total, ridge) => total + ridge.understoryCrownCount,
        0,
      ),
      totalCrowns: ridges.reduce((total, ridge) => total + ridge.totalCrownCount, 0),
      totalDrawCalls: ridges.reduce((total, ridge) => total + ridge.drawCalls, 0),
      allRootsSupported: ridges.every(
        (ridge) => ridge.supportEvidence.supportRatio === 1
          && ridge.supportEvidence.maximumRootClearance === 0,
      ),
      ridges,
    };
  };
  group.userData.update = (elapsed, reducedMotion = false, quality = 'balanced') => {
    const normalizedQuality = ['low', 'balanced', 'high'].includes(quality) ? quality : 'balanced';
    const cloudTime = reducedMotion ? 0 : elapsed;
    cloudVeil.material.uniforms.time.value = cloudTime;
    overheadCloudField.update(elapsed, reducedMotion, normalizedQuality);
    cloudBanks.userData.updateVolumes(elapsed, reducedMotion, normalizedQuality);
    cloudBanks.userData.volumes.visible = normalizedQuality !== 'low';
    cloudBanks.userData.fallback.visible = normalizedQuality === 'low';
    cloudBanks.userData.quality = normalizedQuality;
  };
  scene.add(group);
  return group;
}
