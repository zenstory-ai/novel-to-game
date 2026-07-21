// 可复现种子随机数(mulberry32)。同 seed 同调用序列 = 同结果。
// 游戏内一切随机(传闻真伪/谋算成败/泄密判定/对手行动)都必须走它。
// 状态可序列化:save/load 时把 state.a 存入存档,保证读档后继续同一流。

export function createRNG(seed) {
  return { a: (seed >>> 0) || 1 };
}

export function next(rng) {
  rng.a |= 0;
  rng.a = (rng.a + 0x6d2b79f5) | 0;
  let t = Math.imul(rng.a ^ (rng.a >>> 15), 1 | rng.a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// [min, max] 整数
export function rint(rng, min, max) {
  return min + Math.floor(next(rng) * (max - min + 1));
}

// 概率判定
export function chance(rng, p) {
  return next(rng) < p;
}

// 从数组均匀取一个
export function pick(rng, arr) {
  return arr[Math.floor(next(rng) * arr.length)];
}
