import * as THREE from 'three';
import { seededRandom } from './config.js';

function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x123646) },
      upperColor: { value: new THREE.Color(0x426d72) },
      horizonColor: { value: new THREE.Color(0xd6aa68) },
      lowerColor: { value: new THREE.Color(0x294b48) },
      sunColor: { value: new THREE.Color(0xffdda0) },
      sunDirection: { value: new THREE.Vector3(-0.42, 0.24, -0.88).normalize() },
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
        float h = clamp(vDirection.y, -0.25, 1.0);
        vec3 lowerSky = mix(lowerColor, horizonColor, smoothstep(-0.22, 0.08, h));
        vec3 upperSky = mix(upperColor, topColor, smoothstep(0.12, 0.82, h));
        vec3 sky = mix(lowerSky, upperSky, smoothstep(0.02, 0.34, h));
        float azimuth = atan(vDirection.z, vDirection.x);
        float cloudField = sin(azimuth * 3.7 + h * 13.0)
          + sin(azimuth * 7.3 - h * 9.0 + 1.7) * 0.48
          + sin(azimuth * 12.1 + h * 17.0 - 0.8) * 0.2;
        float cloudAltitude = smoothstep(0.08, 0.24, h) * (1.0 - smoothstep(0.5, 0.74, h));
        float cloudWisps = smoothstep(0.72, 1.22, cloudField) * cloudAltitude;
        float highVeil = smoothstep(0.58, 1.28,
          sin(azimuth * 2.1 - h * 18.0 + 0.4)
            + sin(azimuth * 5.4 + h * 11.0) * 0.38
        ) * smoothstep(0.3, 0.52, h) * (1.0 - smoothstep(0.75, 0.94, h));
        float cloudShadow = smoothstep(0.28, 1.08, -cloudField) * cloudAltitude;
        sky *= 1.0 - cloudShadow * 0.052;
        sky = mix(sky, mix(upperColor, sunColor, 0.24), cloudWisps * 0.18);
        sky = mix(sky, mix(upperColor, horizonColor, 0.34), highVeil * 0.105);
        float alignment = max(dot(normalize(vDirection), sunDirection), 0.0);
        float haze = pow(alignment, 18.0) * 0.16;
        float disc = smoothstep(0.9981, 0.99915, alignment);
        sky += sunColor * haze;
        sky = mix(sky, sunColor, disc * 0.94);
        float humidBand = exp(-pow((h - 0.055) * 10.5, 2.0)) * 0.1;
        sky = mix(sky, horizonColor, humidBand);
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(245, 32, 18), material);
  sky.name = 'world.atmosphere.gradient-sky';
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return sky;
}

function createRidge(name, z, baseY, peakRange, color, seed) {
  const random = seededRandom(seed);
  const points = 37;
  const vertices = [];
  const indices = [];
  for (let index = 0; index < points; index += 1) {
    const x = -220 + (440 * index) / (points - 1);
    const ridgeY = peakRange[0]
      + random() * (peakRange[1] - peakRange[0])
      + Math.sin(index * 0.83) * 3.2;
    vertices.push(x, baseY, z, x, ridgeY, z);
    if (index < points - 1) {
      const offset = index * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ridge = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide }),
  );
  ridge.name = name;
  return ridge;
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
  group.add(
    createSky(),
    createRidge('world.atmosphere.far-ridge', -166, -17, [12, 27], 0x31515a, 811),
    createRidge('world.atmosphere.near-ridge', -128, -15, [8, 20], 0x23443e, 419),
    createMistLayer('world.atmosphere.mist-near', -47, 0.035, 0x77948d, 241),
    createMistLayer('world.atmosphere.mist-mid', -82, 0.062, 0x759695, 517),
    createMistLayer('world.atmosphere.mist-far', -116, 0.092, 0x72969b, 881),
  );
  scene.add(group);
  return group;
}
