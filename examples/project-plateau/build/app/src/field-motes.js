import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere-sky.js';

// Pollen, seed fluff and midges drifting in a box that wraps around the
// camera. They only really show when backlit by the low sun, which is exactly
// when they sell the humid air.
const COUNT = 700;
const BOX = new THREE.Vector3(26, 7, 26);

export function createFieldMotes(scene) {
  const seeds = new Float32Array(COUNT * 4);
  for (let index = 0; index < COUNT; index += 1) {
    seeds[index * 4] = Math.random();
    seeds[index * 4 + 1] = Math.random();
    seeds[index * 4 + 2] = Math.random();
    seeds[index * 4 + 3] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 4));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      moteCamera: { value: new THREE.Vector3() },
      moteBox: { value: BOX },
      moteTime: { value: 0 },
      moteSun: { value: SUN_DIRECTION },
      moteColor: { value: new THREE.Color(0xffe2b0) },
      motePixelRatio: { value: 1 },
    },
    vertexShader: `
      attribute vec4 seed;
      uniform vec3 moteCamera;
      uniform vec3 moteBox;
      uniform float moteTime;
      uniform vec3 moteSun;
      uniform float motePixelRatio;
      varying float vMoteGlow;
      void main() {
        vec3 drift = vec3(
          sin(moteTime * (0.21 + seed.w * 0.2) + seed.x * 40.0) * 0.6 + moteTime * 0.18,
          sin(moteTime * (0.37 + seed.x * 0.3) + seed.y * 30.0) * 0.35,
          cos(moteTime * (0.17 + seed.y * 0.2) + seed.z * 50.0) * 0.6 + moteTime * 0.07
        );
        vec3 local = seed.xyz * moteBox + drift;
        vec3 world = moteCamera + mod(local - moteCamera + moteBox * 0.5, moteBox) - moteBox * 0.5;
        world.y = moteCamera.y - 2.0 + mod(local.y, moteBox.y);
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vec3 toMote = normalize(world - moteCamera);
        float backlit = pow(max(dot(toMote, normalize(moteSun)), 0.0), 5.0);
        float twinkle = 0.6 + 0.4 * sin(moteTime * (2.0 + seed.w * 5.0) + seed.z * 20.0);
        float distanceFade = 1.0 - smoothstep(6.0, 13.0, length(world - moteCamera));
        vMoteGlow = (0.05 + backlit * 1.6) * twinkle * distanceFade;
        gl_PointSize = (1.2 + seed.w * 2.4) * motePixelRatio * (9.0 / max(-mvPosition.z, 0.5));
      }
    `,
    fragmentShader: `
      uniform vec3 moteColor;
      varying float vMoteGlow;
      void main() {
        vec2 offset = gl_PointCoord - 0.5;
        float soft = smoothstep(0.5, 0.0, length(offset));
        gl_FragColor = vec4(moteColor * vMoteGlow * soft, 1.0);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'world.atmosphere.field-motes';
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);
  return {
    points,
    update(camera, elapsed, reducedMotion, pixelRatio) {
      material.uniforms.moteCamera.value.copy(camera.position);
      material.uniforms.moteTime.value = reducedMotion ? 0 : elapsed;
      material.uniforms.motePixelRatio.value = pixelRatio;
    },
  };
}
