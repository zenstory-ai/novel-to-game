// 可复现种子随机数(mulberry32)。同 seed 同调用序列 = 同结果。
// 战斗内一切随机(命中/暴击/伤害浮动/AI 选目标/逃跑)都必须走它。

export function createRNG(seed) {
  let a = seed >>> 0;
  const next = function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

// [min, max) 浮点
export function rfloat(rng, min, max) {
  return min + rng() * (max - min);
}

// [min, max] 整数
export function rint(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// 概率判定
export function chance(rng, p) {
  return rng() < p;
}

// 从数组均匀取一个
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
