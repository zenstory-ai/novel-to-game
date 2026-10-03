import * as THREE from 'three';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';

// Late sun low over the western wall, ahead-left of the outbound walk (-z).
// Side/back light models every animal, trunk and bank with a lit edge and a
// long shadow that streams across the route toward the scout.
export const SUN_DIRECTION = new THREE.Vector3(-0.8, 0.3, -0.52).normalize();

const SKY_COLORS = Object.freeze({
  zenith: 0x2b6690,
  upper: 0x6fa7c4,
  horizonWarm: 0xf3c98e,
  horizonCool: 0xa9c6c6,
  ground: 0x2c3a2a,
  sun: 0xfff0d2,
});

const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip.xyww;
  }
`;

// One painted sky drives both the visible dome and the PMREM environment, so
// reflected and ambient colour always agree with what the player sees above.
const SKY_FRAGMENT = `
  varying vec3 vDirection;
  uniform vec3 zenithColor;
  uniform vec3 upperColor;
  uniform vec3 horizonWarm;
  uniform vec3 horizonCool;
  uniform vec3 groundColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform float time;
  uniform float showSunDisc;

  float skyHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float skyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
      mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float skyFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * skyNoise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    vec3 sunDir = normalize(sunDirection);
    float altitude = direction.y;
    float sunCos = dot(direction, sunDir);
    float sunAzimuth = max(dot(normalize(direction.xz + 1e-4), normalize(sunDir.xz)), 0.0);

    vec3 horizon = mix(horizonCool, horizonWarm, pow(sunAzimuth, 2.5));
    vec3 sky = mix(horizon, upperColor, smoothstep(0.0, 0.32, altitude));
    sky = mix(sky, zenithColor, smoothstep(0.3, 0.95, altitude));
    // Mie forward glow and a hot core around the low sun.
    float glow = pow(max(sunCos, 0.0), 8.0) * 0.24 + pow(max(sunCos, 0.0), 80.0) * 0.8;
    sky += sunColor * glow * (1.0 - smoothstep(0.1, 0.7, altitude) * 0.5);

    // Cumulus band and high cirrus projected onto a flat cloud ceiling.
    if (altitude > 0.0) {
      vec2 cloudUv = direction.xz / (altitude + 0.09);
      float drift = time * 0.004;
      float cumulus = skyFbm(cloudUv * 1.15 + vec2(drift, drift * 0.3));
      cumulus = smoothstep(0.5, 0.78, cumulus) * smoothstep(0.015, 0.09, altitude)
        * (1.0 - smoothstep(0.35, 0.75, altitude));
      float lightProbe = skyFbm(cloudUv * 1.15 + vec2(drift, drift * 0.3) + sunDir.xz * 0.18);
      float selfShadow = clamp((lightProbe - 0.48) * 2.6, 0.0, 1.0);
      vec3 cloudLit = mix(vec3(1.0, 0.93, 0.82), sunColor * 1.15, pow(max(sunCos, 0.0), 3.0));
      vec3 cloudShade = mix(horizonCool * 0.78, vec3(0.52, 0.56, 0.62), 0.45);
      vec3 cloudColor = mix(cloudLit, cloudShade, selfShadow * 0.85);
      cloudColor += sunColor * pow(max(sunCos, 0.0), 12.0) * (1.0 - cumulus) * 1.6;
      float cirrus = skyFbm(vec2(cloudUv.x * 0.35, cloudUv.y * 2.6) + vec2(drift * 2.0, 0.0));
      cirrus = smoothstep(0.55, 0.9, cirrus) * smoothstep(0.08, 0.4, altitude) * 0.35;
      sky = mix(sky, mix(cloudLit, horizon, 0.35), cirrus);
      sky = mix(sky, cloudColor, cumulus * 0.92);
    }

    float disc = smoothstep(0.99955, 0.99985, sunCos) * showSunDisc;
    sky = mix(sky, sunColor * 6.0, disc);
    vec3 below = mix(horizon * 0.82, groundColor, smoothstep(0.0, -0.25, altitude));
    sky = mix(below, sky, smoothstep(-0.02, 0.012, altitude));
    gl_FragColor = vec4(sky, 1.0);
  }
`;

function createSkyMaterial({ showSunDisc = 1 } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenithColor: { value: new THREE.Color(SKY_COLORS.zenith) },
      upperColor: { value: new THREE.Color(SKY_COLORS.upper) },
      horizonWarm: { value: new THREE.Color(SKY_COLORS.horizonWarm) },
      horizonCool: { value: new THREE.Color(SKY_COLORS.horizonCool) },
      groundColor: { value: new THREE.Color(SKY_COLORS.ground) },
      sunColor: { value: new THREE.Color(SKY_COLORS.sun) },
      sunDirection: { value: SUN_DIRECTION },
      time: { value: 0 },
      showSunDisc: { value: showSunDisc },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
  });
}

function createDisplaySky() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(245, 48, 24), createSkyMaterial());
  sky.name = 'world.atmosphere.painted-sky';
  sky.userData.profile = 'painted-sky-with-cumulus-band';
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return sky;
}

// The sun moves through the run: the PMREM sky is rebuilt on request and the
// previous one released.
export function applyAtmosphereEnvironment(scene, renderer, previous = null) {
  previous?.dispose();
  const environmentScene = new THREE.Scene();
  const envSky = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 16),
    createSkyMaterial({ showSunDisc: 0 }),
  );
  environmentScene.add(envSky);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(environmentScene, 0.02, 0.1, 400);
  scene.environment = target.texture;
  scene.environmentIntensity = DAYLIGHT_ENERGY_PROFILE.environmentIntensity;
  generator.dispose();
  envSky.geometry.dispose();
  envSky.material.dispose();
  return target;
}

export { SKY_COLORS, createDisplaySky };
