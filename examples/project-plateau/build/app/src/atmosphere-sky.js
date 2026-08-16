import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { seededRandom } from './config.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';

// Keep the late sun to camera-left and slightly behind the default field view.
// That direction gives the animals readable three-quarter light instead of
// turning every forward-facing surface into a silhouette.
export const SUN_DIRECTION = new THREE.Vector3(-0.44, 0.55, 0.71).normalize();

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
  layer.frustumCulled = false;
  layer.renderOrder = profile.renderOrder;
  return layer;
}

function createCloudVeil() {
  return createCloudLayer(CLOUD_PROFILES.veil);
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
  material.userData.physics = Object.freeze({
    medium: 'water-droplet-participating-medium',
    extinctionLaw: 'Beer-Lambert',
    lighting: 'height-ambient-plus-sun-ray-self-shadow',
    condensationBase: 'shared-lifting-condensation-level',
  });
  return material;
}

function createCloudBanks() {
  const cloudSystem = new THREE.Group();
  const volumeGroup = new THREE.Group();
  const volumeLayouts = [
    [-100, 57, -154, 47, 17, 0, 0.88],
    [-45, 73, -188, 56, 21, 1, 0.845],
    [18, 53, -161, 41, 15, 2, 0.81],
    [78, 68, -184, 53, 19, 0, 0.88],
    [137, 56, -165, 44, 16, 1, 0.845],
    [188, 76, -197, 58, 21, 2, 0.81],
    [-185, 49, -228, 38, 12, 1, 0.62],
    [-112, 62, -241, 46, 15, 2, 0.66],
    [-28, 47, -224, 35, 11, 0, 0.59],
    [63, 59, -242, 47, 15, 1, 0.64],
    [151, 50, -229, 39, 12, 2, 0.61],
  ];
  const volumeGeometry = new THREE.BoxGeometry(2, 2, 2);
  volumeGeometry.userData.profile = 'bounded-cumulus-raymarch-domain';
  volumeLayouts.forEach(([x, y, z, width, height, variant, opacity], index) => {
    const depth = 11.6 + variant * 1.4;
    const material = createCloudVolumeMaterial(variant, opacity);
    const bank = new THREE.Mesh(volumeGeometry, material);
    bank.position.set(x, y, z);
    bank.scale.set(width * 0.5, height * 0.5, depth * 0.5);
    bank.name = `world.atmosphere.cloud-volume-${index + 1}`;
    bank.userData.profile = 'bounded-raymarched-cumulus-volume';
    bank.userData.basePosition = [x, y, z];
    bank.userData.windVelocity = [0.1 + (index % 3) * 0.014, 0.026 + (index % 2) * 0.008];
    bank.frustumCulled = false;
    bank.renderOrder = -82 + index * 0.08;
    volumeGroup.add(bank);
  });
  volumeGroup.name = 'world.atmosphere.cloud-volumes';
  volumeGroup.userData.profile = 'bounded-raymarched-cumulus-volumes';

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
  cloudSystem.userData.volumeCount = volumeLayouts.length;
  cloudSystem.userData.puffCount = puffCount;
  cloudSystem.userData.volumes = volumeGroup;
  cloudSystem.userData.fallback = fallbackBanks;
  cloudSystem.userData.snapshot = () => ({
    profile: cloudSystem.userData.profile,
    volumeCount: cloudSystem.userData.volumeCount,
    puffCount: cloudSystem.userData.puffCount,
    stepCounts: {
      balanced: 12,
      high: 18,
    },
    physics: { ...volumeGroup.children[0].material.userData.physics },
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

export {
  createCloudBanks,
  createCloudVeil,
  createDisplaySky,
};
