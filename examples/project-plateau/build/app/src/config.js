export const PRODUCT_BUDGET = Object.freeze({
  targetViewport: Object.freeze([1440, 900]),
  minimumViewport: Object.freeze([1280, 720]),
  medianFps: 45,
  onePercentLowFps: 30,
  initialCompressedBytes: 20 * 1024 * 1024,
  totalBytes: 50 * 1024 * 1024,
  ttiMs: 8000,
});

export const PALETTE = Object.freeze({
  canopy: 0x193c2b,
  fern: 0x3f6a43,
  wetFern: 0x527b50,
  basalt: 0x8b3f2f,
  basaltShade: 0x613128,
  amber: 0xf2d08b,
  dusk: 0x243947,
  canvas: 0xe8dfc7,
  smoke: 0xc7cec7,
  brass: 0xb08b4f,
  slate: 0x596766,
  water: 0x7ba7a0,
  soil: 0x4e4935,
});

export const SCENE_BUDGET = Object.freeze({
  trees: 128,
  ferns: 120,
  basaltPillars: 18,
  adultIguanodons: 2,
  youngIguanodons: 3,
  pterodactyls: 3,
});

export function seededRandom(seed = 139) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}

export function onePercentLowFps(frameTimes) {
  if (!frameTimes.length) return 0;
  const slowFrameCount = Math.max(1, Math.ceil(frameTimes.length * 0.01));
  const slowest = [...frameTimes].sort((a, b) => b - a).slice(0, slowFrameCount);
  const averageSlowFrameMs = slowest.reduce((sum, value) => sum + value, 0) / slowest.length;
  return averageSlowFrameMs > 0 ? 1000 / averageSlowFrameMs : 0;
}
