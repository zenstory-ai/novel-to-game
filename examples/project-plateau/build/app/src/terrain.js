const TERRAIN_SEED = 1847;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const normalized = clamp((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function hash2d(x, z, seed) {
  let value = Math.imul(x | 0, 374761393)
    + Math.imul(z | 0, 668265263)
    + Math.imul(seed | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 2147483647.5 - 1;
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const ux = tx * tx * (3 - 2 * tx);
  const uz = tz * tz * (3 - 2 * tz);
  const lower = hash2d(x0, z0, seed) * (1 - ux) + hash2d(x0 + 1, z0, seed) * ux;
  const upper = hash2d(x0, z0 + 1, seed) * (1 - ux)
    + hash2d(x0 + 1, z0 + 1, seed) * ux;
  return lower * (1 - uz) + upper * uz;
}

function fbm(x, z, seed, octaves = 4) {
  let amplitude = 0.56;
  let frequency = 1;
  let total = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / normalization;
}

export function terrainVariation(x, z) {
  const warpX = fbm(x * 0.009 + 7.1, z * 0.009 - 3.4, TERRAIN_SEED + 17, 3) * 10;
  const warpZ = fbm(x * 0.009 - 8.3, z * 0.009 + 5.6, TERRAIN_SEED + 43, 3) * 8;
  const warpedX = x + warpX;
  const warpedZ = z + warpZ;
  const broad = fbm(warpedX * 0.012, warpedZ * 0.012, TERRAIN_SEED, 4);
  const rolling = fbm(warpedX * 0.031, warpedZ * 0.031, TERRAIN_SEED + 271, 3);
  const hummocks = fbm(warpedX * 0.072, warpedZ * 0.072, TERRAIN_SEED + 593, 2);
  return broad * 0.66 + rolling * 0.27 + hummocks * 0.07;
}

export function terrainHeight(x, z) {
  const variation = terrainVariation(x, z);
  const broadRolls = variation * 3.15;
  const eastShoulder = Math.exp(-(((x - 52) ** 2) / 820 + ((z + 32) ** 2) / 4200)) * 0.9;
  const westShoulder = Math.exp(-(((x + 60) ** 2) / 1050 + ((z - 10) ** 2) / 4700)) * 0.72;
  const brookBasin = -Math.exp(-(((x + 9) ** 2) / 760 + ((z - 24) ** 2) / 2100)) * 0.82;
  const gladeBowl = -Math.exp(-((x * x) / 1150 + ((z + 30) ** 2) / 980)) * 0.36;
  return broadRolls + eastShoulder + westShoulder + brookBasin + gladeBowl;
}

export function terrainGradient(x, z, sampleDistance = 0.25) {
  const distance = Math.max(0.01, sampleDistance);
  return {
    x: (
      terrainHeight(x + distance, z) - terrainHeight(x - distance, z)
    ) / (distance * 2),
    z: (
      terrainHeight(x, z + distance) - terrainHeight(x, z - distance)
    ) / (distance * 2),
  };
}

export function terrainSlope(x, z) {
  const gradient = terrainGradient(x, z, 0.35);
  return Math.hypot(gradient.x, gradient.z);
}

export function terrainWetness(x, z) {
  const brook = Math.exp(-((x + 11) ** 2) / 78);
  const basin = Math.exp(-((z - 27) ** 2) / 2400);
  const hollow = clamp((-terrainHeight(x, z) + 0.7) / 3.6);
  return clamp(brook * (0.55 + basin * 0.32) + hollow * 0.24);
}
