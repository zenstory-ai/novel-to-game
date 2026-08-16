import * as THREE from 'three';
import { seededRandom } from './config.js';

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

export { createMistLayer };
