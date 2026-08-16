import * as THREE from 'three';
import { seededRandom } from './config.js';

function createSoilDetailTextures() {
  const size = 256;
  const heights = new Float32Array(size * size);
  const aggregateChips = new Float32Array(size * size);
  const organicFibres = new Float32Array(size * size);
  const poreCavities = new Float32Array(size * size);
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
  const hashCell = (x, y, salt) => {
    let value = Math.imul(x + salt * 17, 374761393)
      + Math.imul(y - salt * 11, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };
  const cellularDistance = (u, v, cells, salt) => {
    const px = u * cells;
    const py = v * cells;
    const baseX = Math.floor(px);
    const baseY = Math.floor(py);
    let nearest = Infinity;
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const cellX = baseX + offsetX;
        const cellY = baseY + offsetY;
        const wrappedX = ((cellX % cells) + cells) % cells;
        const wrappedY = ((cellY % cells) + cells) % cells;
        const pointX = cellX + 0.18 + hashCell(wrappedX, wrappedY, salt) * 0.64;
        const pointY = cellY + 0.18 + hashCell(wrappedX, wrappedY, salt + 19) * 0.64;
        nearest = Math.min(nearest, Math.hypot(px - pointX, py - pointY));
      }
    }
    return nearest;
  };
  const sparseCellularFeature = (
    u,
    v,
    cells,
    salt,
    density,
    minimumRadius,
    maximumRadius,
  ) => {
    const px = u * cells;
    const py = v * cells;
    const baseX = Math.floor(px);
    const baseY = Math.floor(py);
    let feature = 0;
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
        const cellX = baseX + offsetX;
        const cellY = baseY + offsetY;
        const wrappedX = wrap(cellX, cells);
        const wrappedY = wrap(cellY, cells);
        if (hashCell(wrappedX, wrappedY, salt + 43) > density) continue;
        const pointX = cellX + 0.12 + hashCell(wrappedX, wrappedY, salt) * 0.76;
        const pointY = cellY + 0.12 + hashCell(wrappedX, wrappedY, salt + 19) * 0.76;
        const radius = THREE.MathUtils.lerp(
          minimumRadius,
          maximumRadius,
          hashCell(wrappedX, wrappedY, salt + 71),
        );
        const distance = Math.hypot(px - pointX, py - pointY);
        feature = Math.max(
          feature,
          1 - THREE.MathUtils.smoothstep(distance, radius * 0.38, radius),
        );
      }
    }
    return feature;
  };
  const broadGrid = makeGrid(7, 621);
  const mesoGrid = makeGrid(23, 631);
  const grainGrid = makeGrid(61, 641);
  const moistureGrid = makeGrid(13, 647);
  const mineralGrid = makeGrid(31, 653);
  const organicGrid = makeGrid(37, 677);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = tileNoise(broadGrid, 7, u, v);
      const meso = tileNoise(mesoGrid, 23, u + (broad - 0.5) * 0.04, v - (broad - 0.5) * 0.035);
      const grain = tileNoise(grainGrid, 61, u - (meso - 0.5) * 0.015, v + (meso - 0.5) * 0.012);
      const aggregateDistance = cellularDistance(u, v, 31, 659);
      const aggregateChip = 1 - THREE.MathUtils.smoothstep(aggregateDistance, 0.1, 0.29);
      const sparseAggregateChip = sparseCellularFeature(
        u,
        v,
        31,
        727,
        0.24,
        0.09,
        0.28,
      );
      const organicCarrier = tileNoise(
        organicGrid,
        37,
        u + (meso - 0.5) * 0.012,
        v - (grain - 0.5) * 0.01,
      );
      const fibreWaveA = Math.abs(Math.sin((u * 11 + v * 7) * Math.PI * 2));
      const fibreWaveB = Math.abs(Math.sin((u * 5 - v * 17) * Math.PI * 2));
      const fibreLine = Math.max(
        1 - THREE.MathUtils.smoothstep(fibreWaveA, 0.025, 0.13),
        (1 - THREE.MathUtils.smoothstep(fibreWaveB, 0.02, 0.11)) * 0.78,
      );
      const organicFibre = fibreLine * THREE.MathUtils.smoothstep(
        organicCarrier,
        0.57,
        0.84,
      );
      const poreCavity = sparseCellularFeature(
        u + 0.173,
        v - 0.219,
        47,
        761,
        0.16,
        0.05,
        0.16,
      );
      aggregateChips[y * size + x] = sparseAggregateChip;
      organicFibres[y * size + x] = organicFibre;
      poreCavities[y * size + x] = poreCavity;
      heights[y * size + x] = THREE.MathUtils.clamp(
        0.5 + (broad - 0.5) * 0.28 + (meso - 0.5) * 0.17
          + (grain - 0.5) * 0.065 + aggregateChip * 0.035,
        0.24,
        0.76,
      );
    }
  }

  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const offset = index * 4;
      const height = heights[index];
      const u = x / size;
      const v = y / size;
      const moisture = tileNoise(moistureGrid, 13, u + 0.19, v - 0.13);
      const mineral = tileNoise(mineralGrid, 31, u - 0.07, v + 0.23);
      const aggregateChip = aggregateChips[index];
      albedoData[offset] = Math.round(THREE.MathUtils.clamp(
        151 + height * 19 + mineral * 11 + aggregateChip * 14,
        0,
        255,
      ));
      albedoData[offset + 1] = Math.round(THREE.MathUtils.clamp(
        145 + height * 17 + moisture * 10 + aggregateChip * 8,
        0,
        255,
      ));
      albedoData[offset + 2] = Math.round(THREE.MathUtils.clamp(
        118 + height * 12 + moisture * 7 + aggregateChip * 3,
        0,
        255,
      ));
      albedoData[offset + 3] = Math.round(aggregateChip * 255);

      const roughness = THREE.MathUtils.clamp(
        0.83 + (1 - height) * 0.13 - moisture * 0.04
          + (mineral - 0.5) * 0.035 - aggregateChip * 0.035,
        0.74,
        0.99,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([
        roughnessByte,
        roughnessByte,
        roughnessByte,
        Math.round(organicFibres[index] * 255),
      ], offset);
      const heightByte = Math.round(height * 255);
      heightData.set([
        heightByte,
        heightByte,
        heightByte,
        Math.round(poreCavities[index] * 255),
      ], offset);
    }
  }

  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 10);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.soil-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.soil-roughness', roughnessData),
    height: makeTexture('world.material.soil-macro-detail', heightData),
  });
}

function createTerrainMacroControlTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const makeGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const broadGrid = makeGrid(7, 661);
  const mineralGrid = makeGrid(17, 673);
  const gritGrid = makeGrid(41, 691);
  const sample = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x) % cells;
    const y0 = Math.floor(y) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = THREE.MathUtils.smoothstep(x - Math.floor(x), 0, 1);
    const ty = THREE.MathUtils.smoothstep(y - Math.floor(y), 0, 1);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = sample(broadGrid, 7, u, v);
      const mineral = sample(mineralGrid, 17, u + broad * 0.08, v - broad * 0.06);
      const grit = sample(gritGrid, 41, u - mineral * 0.035, v + mineral * 0.025);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(broad * 255);
      data[offset + 1] = Math.round(mineral * 255);
      data[offset + 2] = Math.round(grit * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.terrain-macro-control';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createWaterDetailTextures() {
  const size = 128;
  const heights = new Float32Array(size * size);
  const random = seededRandom(733);
  const makePeriodicGrid = (cells) => Array.from(
    { length: cells * cells },
    () => random(),
  );
  const broadGrid = makePeriodicGrid(9);
  const mediumGrid = makePeriodicGrid(23);
  const fineGrid = makePeriodicGrid(47);
  const samplePeriodicGrid = (grid, cells, u, v) => {
    const wrappedU = ((u % 1) + 1) % 1;
    const wrappedV = ((v % 1) + 1) % 1;
    const gx = wrappedU * cells;
    const gy = wrappedV * cells;
    const x0 = Math.floor(gx) % cells;
    const y0 = Math.floor(gy) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const txRaw = gx - Math.floor(gx);
    const tyRaw = gy - Math.floor(gy);
    const tx = txRaw * txRaw * (3 - 2 * txRaw);
    const ty = tyRaw * tyRaw * (3 - 2 * tyRaw);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = samplePeriodicGrid(broadGrid, 9, u, v);
      const medium = samplePeriodicGrid(
        mediumGrid,
        23,
        u + (broad - 0.5) * 0.075,
        v - (broad - 0.5) * 0.11,
      );
      const fine = samplePeriodicGrid(
        fineGrid,
        47,
        u - (medium - 0.5) * 0.035,
        v + (broad - 0.5) * 0.045,
      );
      const flowRidge = 0.5 + Math.sin(
        Math.PI * 2 * (v * 5 + u * 0.65 + (broad - 0.5) * 1.7),
      ) * 0.5;
      const value = THREE.MathUtils.clamp(
        0.22 + broad * 0.46 + medium * 0.23 + fine * 0.08 + flowRidge * 0.025,
        0.18,
        0.82,
      );
      heights[y * size + x] = value;
    }
  }
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const sample = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const height = heights[y * size + x];
      const deepBand = 0.5 + Math.sin(y * 0.052 + x * 0.071) * 0.15;
      albedoData[offset] = Math.round(54 + height * 10 + deepBand * 5);
      albedoData[offset + 1] = Math.round(92 + height * 13 + deepBand * 7);
      albedoData[offset + 2] = Math.round(94 + height * 14 + deepBand * 8);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(0.34 + (1 - height) * 0.26, 0.32, 0.62);
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * 1.2;
      const dz = (sample(x, y - 1) - sample(x, y + 1)) * 1.2;
      const normal = new THREE.Vector3(dx, dz, 1).normalize();
      normalData[offset] = Math.round((normal.x * 0.5 + 0.5) * 255);
      normalData[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      normalData[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      normalData[offset + 3] = 255;
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 6.5);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.brook-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.brook-roughness', roughnessData),
    normal: makeTexture('world.material.brook-normal', normalData),
  });
}

const soilTextures = createSoilDetailTextures();
const terrainMacroControlTexture = createTerrainMacroControlTexture();
const waterTextures = createWaterDetailTextures();

export { soilTextures, terrainMacroControlTexture, waterTextures };
