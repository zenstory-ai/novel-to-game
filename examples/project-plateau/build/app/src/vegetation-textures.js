import * as THREE from 'three';
import { seededRandom } from './config.js';

function createLeafClusterTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = seededRandom(7613);
  const leaves = Array.from({ length: 15 }, (_, index) => ({
    x: -0.68 + random() * 1.36,
    y: -0.62 + random() * 1.24,
    radiusX: 0.12 + random() * 0.16,
    radiusY: 0.075 + random() * 0.1,
    angle: random() * Math.PI + (index % 2 ? 0.32 : -0.22),
    shade: 0.76 + random() * 0.22,
  }));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      let coverage = 0;
      let shade = 0;
      for (const leaf of leaves) {
        const cosine = Math.cos(leaf.angle);
        const sine = Math.sin(leaf.angle);
        const dx = u - leaf.x;
        const dy = v - leaf.y;
        const localX = (dx * cosine + dy * sine) / leaf.radiusX;
        const localY = (-dx * sine + dy * cosine) / leaf.radiusY;
        const distance = localX * localX + localY * localY;
        const leafCoverage = 1 - THREE.MathUtils.smoothstep(distance, 0.76, 1.12);
        if (leafCoverage > coverage) {
          coverage = leafCoverage;
          const midrib = Math.exp(-Math.abs(localY) * 13) * 0.12;
          shade = leaf.shade + midrib;
        }
      }
      const twigDistance = Math.abs(v * 0.52 - u * 0.15 + 0.06);
      const twigCoverage = twigDistance < 0.028 && Math.abs(u) < 0.72 ? 0.92 : 0;
      if (twigCoverage > coverage) {
        coverage = twigCoverage;
        shade = 0.68;
      }
      const offset = (y * size + x) * 4;
      const fineBreak = (Math.sin(x * 1.73 + y * 0.91) * 0.5 + 0.5) * 0.055;
      const value = THREE.MathUtils.clamp(shade - fineBreak, 0, 1);
      data[offset] = Math.round(value * 0.88 * 255);
      data[offset + 1] = Math.round(value * 255);
      data[offset + 2] = Math.round(value * 0.78 * 255);
      data[offset + 3] = Math.round(coverage * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.leaf-cluster-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.userData.family = 'elliptic-waxy';
  texture.needsUpdate = true;
  return texture;
}

function createCompoundLeafClusterTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const leaflets = [];
  for (let index = 1; index < 10; index += 1) {
    const t = index / 10;
    const spineX = -0.76 + t * 1.5;
    const spineY = -0.13 + Math.sin(t * Math.PI) * 0.18 + (t - 0.5) * 0.16;
    for (const side of [-1, 1]) {
      leaflets.push({
        x: spineX - side * 0.015,
        y: spineY + side * (0.17 + Math.sin(t * Math.PI) * 0.07),
        radiusX: 0.125 + Math.sin(t * Math.PI) * 0.045,
        radiusY: 0.047 + Math.sin(t * Math.PI) * 0.018,
        angle: side * (0.86 - t * 0.24) + 0.08,
        shade: 0.75 + t * 0.16 + (index % 3) * 0.018,
      });
    }
  }
  // A terminal leaflet continues the rachis rather than forming an arbitrary
  // detached oval at the atlas edge.
  leaflets.push({
    x: 0.72,
    y: 0.1,
    radiusX: 0.16,
    radiusY: 0.052,
    angle: 0.18,
    shade: 0.92,
  });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      let coverage = 0;
      let shade = 0;
      for (const leaflet of leaflets) {
        const cosine = Math.cos(leaflet.angle);
        const sine = Math.sin(leaflet.angle);
        const dx = u - leaflet.x;
        const dy = v - leaflet.y;
        const localX = (dx * cosine + dy * sine) / leaflet.radiusX;
        const localY = (-dx * sine + dy * cosine) / leaflet.radiusY;
        const distance = localX * localX + localY * localY;
        const leafletCoverage = 1 - THREE.MathUtils.smoothstep(distance, 0.72, 1.12);
        if (leafletCoverage > coverage) {
          coverage = leafletCoverage;
          const midrib = Math.exp(-Math.abs(localY) * 16) * 0.1;
          shade = leaflet.shade + midrib;
        }
      }
      const t = THREE.MathUtils.clamp((u + 0.78) / 1.56, 0, 1);
      const spineY = -0.13 + Math.sin(t * Math.PI) * 0.18 + (t - 0.5) * 0.16;
      const twigCoverage = Math.abs(v - spineY) < 0.024 && u > -0.82 && u < 0.82 ? 0.94 : 0;
      if (twigCoverage > coverage) {
        coverage = twigCoverage;
        shade = 0.64;
      }
      const offset = (y * size + x) * 4;
      const veinBreak = (Math.sin(x * 1.27 - y * 0.83) * 0.5 + 0.5) * 0.04;
      const value = THREE.MathUtils.clamp(shade - veinBreak, 0, 1);
      data[offset] = Math.round(value * 0.78 * 255);
      data[offset + 1] = Math.round(value * 255);
      data[offset + 2] = Math.round(value * 0.7 * 255);
      data[offset + 3] = Math.round(coverage * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.compound-lanceolate-leaf-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.userData.family = 'compound-lanceolate';
  texture.needsUpdate = true;
  return texture;
}

function createBarkDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const random = seededRandom(8941);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const verticalFurrow = Math.abs(Math.sin(x * 0.31 + Math.sin(y * 0.045) * 1.9));
      const brokenPlate = Math.sin(y * 0.23 + x * 0.07) * 0.12
        + Math.sin(y * 0.067 - x * 0.16) * 0.07;
      const fissure = verticalFurrow > 0.94 ? -0.28 : 0;
      const value = THREE.MathUtils.clamp(
        0.68 + verticalFurrow * 0.15 + brokenPlate + fissure + (random() - 0.5) * 0.06,
        0.26,
        0.94,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(value * 0.78 * 255);
      albedoData[offset + 1] = Math.round(value * 0.69 * 255);
      albedoData[offset + 2] = Math.round(value * 0.52 * 255);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(0.82 + (1 - value) * 0.17, 0.78, 0.99);
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
    texture.repeat.set(3.5, 6.5);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.userData.family = 'wet-furrowed-buttress';
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.bark-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.bark-roughness', roughnessData),
    height: makeTexture('world.material.bark-height', heightData),
  });
}

function createPlateBarkDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const random = seededRandom(8963);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const row = Math.floor(v * 9);
      const staggeredU = (u + (row % 2) * 0.12 + Math.sin(v * Math.PI * 2) * 0.018) % 1;
      const verticalCell = Math.abs((staggeredU * 5) % 1 - 0.5) * 2;
      const horizontalCell = Math.abs((v * 9) % 1 - 0.5) * 2;
      const edgeDistance = Math.min(verticalCell, horizontalCell);
      const fissure = edgeDistance > 0.88 ? -0.26 : 0;
      const fibrousLift = Math.sin((u * 7 + v * 1.8) * Math.PI * 2) * 0.07
        + Math.sin((u * 3 - v * 4.4) * Math.PI * 2) * 0.035;
      const value = THREE.MathUtils.clamp(
        0.67 + fibrousLift + fissure + (random() - 0.5) * 0.045,
        0.25,
        0.9,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(value * 0.82 * 255);
      albedoData[offset + 1] = Math.round(value * 0.61 * 255);
      albedoData[offset + 2] = Math.round(value * 0.43 * 255);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(0.86 + (1 - value) * 0.12, 0.82, 0.99);
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
    texture.repeat.set(3.2, 5.8);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.userData.family = 'plate-barked-fibrous';
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture(
      'world.material.plate-bark-albedo',
      albedoData,
      THREE.SRGBColorSpace,
    ),
    roughness: makeTexture('world.material.plate-bark-roughness', roughnessData),
    height: makeTexture('world.material.plate-bark-height', heightData),
  });
}

const barkTextures = createBarkDetailTextures();
const plateBarkTextures = createPlateBarkDetailTextures();
const leafClusterTexture = createLeafClusterTexture();
const compoundLeafClusterTexture = createCompoundLeafClusterTexture();

export { barkTextures, compoundLeafClusterTexture, leafClusterTexture, plateBarkTextures };
