// 火脉残图：独立于战斗 RNG 的可复现短探索。
// 外层三掘后可见好就收，或深入两掘；深层妖气失控只丢深层所得。

import { createRNG } from './rng.js';

export const HUNT_GUIDES = {
  wukong: {
    key: 'wukong',
    name: '悟空 · 火眼金睛',
    desc: '深入后辨出同类地脉里的真妖穴；这不能从五行明牌推出。',
  },
  bajie: {
    key: 'bajie',
    name: '八戒 · 九齿钉耙',
    desc: '每层第一掘免费翻开一处相邻地块，容易连脉，也可能惊妖。',
  },
  sha: {
    key: 'sha',
    name: '沙僧 · 稳守行囊',
    desc: '挡住首次妖气反扑；适合带着已得宝物稳步深入。',
  },
};

export const HUNT_RULES = {
  outerDigs: 3,
  deepDigs: 2,
  maxThreat: 4,
  deepEntryThreat: 1,
  safeSettleItem: 'bihuofu',
};

const OUTER_TILES = [
  { kind: 'supply', element: '水', reward: { jinchuang: 1 }, name: '清泉药囊' },
  { kind: 'supply', element: '火', reward: { falidan: 1 }, name: '暖泉丹匣' },
  { kind: 'supply', element: '土', reward: { xingshi: 1 }, name: '镇妖石匣' },
  { kind: 'relic', element: '金', relics: 1, name: '五行残简' },
  { kind: 'relic', element: '金', relics: 1, name: '鎏金残简' },
  { kind: 'vein', element: '木', name: '盘根连脉' },
  { kind: 'vein', element: '木', name: '藤纹连脉' },
  { kind: 'trap', element: '火', threat: 2, name: '余火妖穴' },
  { kind: 'empty', element: '土', name: '旧炉空腔' },
];

const DEEP_TILES = [
  { kind: 'supply', element: '火', reward: { falidan: 1 }, name: '火候丹匣' },
  { kind: 'supply', element: '土', reward: { wubaodan: 1 }, name: '五宝丹匣' },
  { kind: 'relic', element: '金', relics: 2, name: '炉砖铭简' },
  { kind: 'vein', element: '木', name: '地根暗脉' },
  { kind: 'trap', element: '火', threat: 2, name: '伏火妖窟' },
  { kind: 'trap', element: '金', threat: 2, name: '赤金妖窟' },
];

function cloneTiles(tiles) {
  return tiles.map((tile, index) => ({ ...tile, reward: tile.reward ? { ...tile.reward } : null, index }));
}

function shuffle(rng, values) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.map((tile, index) => ({ ...tile, index }));
}

function mergeItems(target, source) {
  for (const [key, amount] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + amount;
  }
}

function takeItems(target, source) {
  mergeItems(target, source);
  for (const key of Object.keys(source)) delete source[key];
}

function layerTiles(state) {
  return state.layers[state.layer];
}

function layerWidth() {
  return 3;
}

function neighbors(index, length) {
  const width = layerWidth();
  const row = Math.floor(index / width);
  const col = index % width;
  const out = [];
  if (col > 0) out.push(index - 1);
  if (col < width - 1 && index + 1 < length) out.push(index + 1);
  if (row > 0) out.push(index - width);
  if (index + width < length) out.push(index + width);
  return out;
}

function firstHiddenNeighbor(state, index) {
  const tiles = layerTiles(state);
  return neighbors(index, tiles.length).find((candidate) => !state.revealed[state.layer].includes(candidate));
}

function event(state, type, detail = {}) {
  const entry = { type, layer: state.layer, ...detail };
  state.events.push(entry);
  return entry;
}

function bankCarried(state) {
  takeItems(state.bankedItems, state.carriedItems);
  state.bankedRelics += state.carriedRelics;
  state.carriedRelics = 0;
}

function finishResult(state, { deepSuccess }) {
  bankCarried(state);
  if (deepSuccess) mergeItems(state.bankedItems, { dahuandan: 1 });
  const relics = state.bankedRelics;
  state.status = 'finished';
  state.result = {
    seed: state.seed,
    guide: state.guide,
    deepened: state.deepened,
    forcedRetreat: state.forcedRetreat,
    items: { ...state.bankedItems },
    relics,
    growth: {
      unit: state.guide,
      potentialPoints: relics,
      skillPoints: deepSuccess ? 1 : 0,
    },
    events: state.events.map((entry) => ({ ...entry })),
  };
  return state.result;
}

function forceRetreat(state) {
  state.carriedItems = {};
  state.carriedRelics = 0;
  state.forcedRetreat = true;
  state.status = 'retreating';
  event(state, 'forced_retreat', { threat: state.threat });
}

function reveal(state, index, source = 'dig') {
  if (state.status !== 'playing') return [];
  const tiles = layerTiles(state);
  const tile = tiles[index];
  if (!tile || state.revealed[state.layer].includes(index)) return [];
  state.revealed[state.layer].push(index);
  const emitted = [event(state, 'reveal', { index, source, kind: tile.kind, element: tile.element, name: tile.name })];

  if (tile.kind === 'supply') {
    mergeItems(state.carriedItems, tile.reward);
    emitted.push(event(state, 'supply', { index, reward: { ...tile.reward }, name: tile.name }));
  } else if (tile.kind === 'relic') {
    state.carriedRelics += tile.relics;
    emitted.push(event(state, 'relic', { index, amount: tile.relics, name: tile.name }));
  } else if (tile.kind === 'trap') {
    if (state.guide === 'sha' && !state.guideUsed.shaGuard) {
      state.guideUsed.shaGuard = true;
      emitted.push(event(state, 'guard', { index, name: tile.name }));
    } else {
      state.threat += tile.threat;
      emitted.push(event(state, 'trap', { index, amount: tile.threat, threat: state.threat, name: tile.name }));
      if (state.layer === 'deep' && state.threat >= HUNT_RULES.maxThreat) {
        forceRetreat(state);
        return emitted;
      }
    }
  } else if (tile.kind === 'vein') {
    const chained = firstHiddenNeighbor(state, index);
    emitted.push(event(state, 'vein', { index, chained }));
    if (chained != null) emitted.push(...reveal(state, chained, 'vein'));
  } else {
    emitted.push(event(state, 'empty', { index, name: tile.name }));
  }
  return emitted;
}

export function createTreasureHunt(seed, guide) {
  if (!HUNT_GUIDES[guide]) throw new Error(`未知探路者：${guide}`);
  const rng = createRNG(seed);
  return {
    seed,
    guide,
    layer: 'outer',
    status: 'playing',
    deepened: false,
    forcedRetreat: false,
    threat: 0,
    paidDigs: { outer: 0, deep: 0 },
    revealed: { outer: [], deep: [] },
    layers: {
      outer: shuffle(rng, cloneTiles(OUTER_TILES)),
      deep: shuffle(rng, cloneTiles(DEEP_TILES)),
    },
    bankedItems: {},
    carriedItems: {},
    bankedRelics: 0,
    carriedRelics: 0,
    guideUsed: { bajieOuter: false, bajieDeep: false, shaGuard: false },
    events: [],
    result: null,
  };
}

export function digTreasureTile(state, index) {
  if (state.status !== 'playing') return [];
  const limit = state.layer === 'outer' ? HUNT_RULES.outerDigs : HUNT_RULES.deepDigs;
  if (state.paidDigs[state.layer] >= limit) return [];
  if (state.revealed[state.layer].includes(index)) return [];

  const emitted = reveal(state, index, 'dig');
  state.paidDigs[state.layer] += 1;
  event(state, 'paid_dig', { index, count: state.paidDigs[state.layer] });
  if (state.status === 'retreating') {
    finishResult(state, { deepSuccess: false });
    return emitted;
  }

  const guideFlag = state.layer === 'outer' ? 'bajieOuter' : 'bajieDeep';
  if (state.status === 'playing' && state.guide === 'bajie' && !state.guideUsed[guideFlag]) {
    state.guideUsed[guideFlag] = true;
    const chained = firstHiddenNeighbor(state, index);
    event(state, 'bajie_chain', { index, chained });
    if (chained != null) emitted.push(...reveal(state, chained, 'bajie'));
  }
  return emitted;
}

export function canChooseDepth(state) {
  return state.status === 'playing'
    && state.layer === 'outer'
    && state.paidDigs.outer >= HUNT_RULES.outerDigs;
}

export function enterTreasureDepth(state) {
  if (!canChooseDepth(state)) throw new Error('尚未完成外层三掘');
  bankCarried(state);
  state.layer = 'deep';
  state.deepened = true;
  state.threat = Math.max(HUNT_RULES.deepEntryThreat, state.threat);
  event(state, 'enter_deep', { threat: state.threat });
  return state;
}

export function canFinishDepth(state) {
  return state.status === 'playing'
    && state.layer === 'deep'
    && state.paidDigs.deep >= HUNT_RULES.deepDigs;
}

export function settleTreasureHunt(state) {
  if (!canChooseDepth(state)) throw new Error('当前不可收手');
  const reward = { [HUNT_RULES.safeSettleItem]: 1 };
  mergeItems(state.carriedItems, reward);
  event(state, 'safe_settle', { reward: { ...reward } });
  return finishResult(state, { deepSuccess: false });
}

export function finishTreasureDepth(state) {
  if (!canFinishDepth(state)) throw new Error('深层尚未探完');
  event(state, 'deep_success', { threat: state.threat });
  return finishResult(state, { deepSuccess: true });
}

export function visibleTreasureState(state) {
  const tiles = layerTiles(state);
  const revealed = new Set(state.revealed[state.layer]);
  return {
    guide: state.guide,
    layer: state.layer,
    status: state.status,
    deepened: state.deepened,
    forcedRetreat: state.forcedRetreat,
    threat: state.threat,
    maxThreat: HUNT_RULES.maxThreat,
    digsUsed: state.paidDigs[state.layer],
    digsLimit: state.layer === 'outer' ? HUNT_RULES.outerDigs : HUNT_RULES.deepDigs,
    bankedItems: { ...state.bankedItems },
    carriedItems: { ...state.carriedItems },
    bankedRelics: state.bankedRelics,
    carriedRelics: state.carriedRelics,
    safeSettleReward: canChooseDepth(state)
      ? { [HUNT_RULES.safeSettleItem]: 1 }
      : {},
    tiles: tiles.map((tile, index) => ({
      index,
      element: tile.element,
      revealed: revealed.has(index),
      kind: revealed.has(index) ? tile.kind : null,
      name: revealed.has(index) ? tile.name : null,
      dangerMarked: state.layer === 'deep' && state.guide === 'wukong' && tile.kind === 'trap',
    })),
    canChooseDepth: canChooseDepth(state),
    canFinishDepth: canFinishDepth(state),
    result: state.result ? { ...state.result } : null,
  };
}
