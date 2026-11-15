// 可设种子的随机数（mulberry32）。全作不用 Math.random 决定任何规则结果。
export function createRNG(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => a;
  return next;
}
export const chance = (rng, p) => rng() < p;
export const rfloat = (rng, lo, hi) => lo + rng() * (hi - lo);
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
