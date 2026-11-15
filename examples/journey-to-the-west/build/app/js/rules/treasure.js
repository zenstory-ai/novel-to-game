// 火脉残图：独立于战斗随机序列的短探索。
// 外层三掘 → 见好就收（得避火符），或把外层所得封存后深入两掘；深层妖气满格只丢深层所得。

import { createRNG } from '../core/rng.js';
import { ITEMS } from '../data/combat.js';

export const GUIDES = {
  wukong: { key: 'wukong', name: '悟空探路', perk: '火眼金睛', desc: '进了深层，能一眼认出哪两处是妖穴。' },
  bajie: { key: 'bajie', name: '八戒探路', perk: '九齿钉耙', desc: '每层第一耙连带翻开旁边一块，可能连着宝，也可能惊了妖。' },
  sha: { key: 'sha', name: '沙僧探路', perk: '稳守行囊', desc: '替全队挡下头一回妖气反扑。' },
};

export const HUNT = { outerDigs: 3, deepDigs: 2, maxThreat: 4, deepEntryThreat: 1, safeItem: 'bihuofu', deepItem: 'dahuandan' };

const OUTER = [
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
const DEEP = [
  { kind: 'supply', element: '火', reward: { falidan: 1 }, name: '火候丹匣' },
  { kind: 'supply', element: '土', reward: { wubaodan: 1 }, name: '五宝丹匣' },
  { kind: 'relic', element: '金', relics: 2, name: '炉砖铭简' },
  { kind: 'vein', element: '木', name: '地根暗脉' },
  { kind: 'trap', element: '火', threat: 2, name: '伏火妖窟' },
  { kind: 'trap', element: '金', threat: 2, name: '赤金妖窟' },
];

function shuffled(rng, tiles) {
  const out = tiles.map((t) => ({ ...t }));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const addItems = (into, from) => { for (const [k, n] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + n; };

export function createHunt(seed, guide, { clue = false } = {}) {
  if (!GUIDES[guide]) throw new Error(`未知探路者 ${guide}`);
  const rng = createRNG(seed);
  return {
    seed, guide, clue, layer: 'outer', status: 'playing', deepened: false, forced: false,
    threat: 0, digs: { outer: 0, deep: 0 }, open: { outer: [], deep: [] },
    tiles: { outer: shuffled(rng, OUTER), deep: shuffled(rng, DEEP) },
    banked: {}, carried: {}, bankedRelics: 0, carriedRelics: 0,
    used: { clue: false, sha: false, bajieOuter: false, bajieDeep: false },
    result: null,
  };
}

function neighbors(index, length) {
  const out = [];
  const col = index % 3;
  if (col > 0) out.push(index - 1);
  if (col < 2 && index + 1 < length) out.push(index + 1);
  if (index - 3 >= 0) out.push(index - 3);
  if (index + 3 < length) out.push(index + 3);
  return out;
}

function hiddenNeighbor(state, index) {
  return neighbors(index, state.tiles[state.layer].length).find((i) => !state.open[state.layer].includes(i));
}

function bank(state) {
  addItems(state.banked, state.carried);
  state.carried = {};
  state.bankedRelics += state.carriedRelics;
  state.carriedRelics = 0;
}

function finish(state, deepSuccess) {
  bank(state);
  if (deepSuccess) addItems(state.banked, { [HUNT.deepItem]: 1 });
  state.status = 'finished';
  state.result = {
    guide: state.guide, deepened: state.deepened, forced: state.forced, clueUsed: state.used.clue,
    items: { ...state.banked }, relics: state.bankedRelics,
    potential: state.bankedRelics, skillPoint: deepSuccess ? 1 : 0,
  };
  return state.result;
}

function reveal(state, index, via) {
  const tile = state.tiles[state.layer][index];
  if (!tile || state.status !== 'playing' || state.open[state.layer].includes(index)) return [];
  state.open[state.layer].push(index);
  const ev = [{ t: 'reveal', index, via, kind: tile.kind, name: tile.name, element: tile.element }];
  if (tile.kind === 'supply') {
    addItems(state.carried, tile.reward);
    ev.push({ t: 'supply', index, reward: { ...tile.reward } });
  } else if (tile.kind === 'relic') {
    state.carriedRelics += tile.relics;
    ev.push({ t: 'relic', index, amount: tile.relics });
  } else if (tile.kind === 'trap') {
    if (state.layer === 'outer' && state.clue && !state.used.clue) {
      state.used.clue = true;
      ev.push({ t: 'clue', index });
    } else if (state.guide === 'sha' && !state.used.sha) {
      state.used.sha = true;
      ev.push({ t: 'guard', index });
    } else {
      state.threat += tile.threat;
      ev.push({ t: 'trap', index, amount: tile.threat, threat: state.threat });
      if (state.layer === 'deep' && state.threat >= HUNT.maxThreat) {
        state.carried = {}; state.carriedRelics = 0; state.forced = true;
        ev.push({ t: 'forced' });
        finish(state, false);
      }
    }
  } else if (tile.kind === 'vein') {
    const next = hiddenNeighbor(state, index);
    ev.push({ t: 'vein', index, next });
    if (next != null) ev.push(...reveal(state, next, 'vein'));
  }
  return ev;
}

export function dig(state, index) {
  if (state.status !== 'playing') return [];
  const limit = state.layer === 'outer' ? HUNT.outerDigs : HUNT.deepDigs;
  if (state.digs[state.layer] >= limit || state.open[state.layer].includes(index)) return [];
  state.digs[state.layer] += 1;
  const ev = reveal(state, index, 'dig');
  const flag = state.layer === 'outer' ? 'bajieOuter' : 'bajieDeep';
  if (state.status === 'playing' && state.guide === 'bajie' && !state.used[flag]) {
    state.used[flag] = true;
    const next = hiddenNeighbor(state, index);
    if (next != null) { ev.push({ t: 'rake', index, next }); ev.push(...reveal(state, next, 'rake')); }
  }
  return ev;
}

export const atFork = (state) => state.status === 'playing' && state.layer === 'outer' && state.digs.outer >= HUNT.outerDigs;
export const deepDone = (state) => state.status === 'playing' && state.layer === 'deep' && state.digs.deep >= HUNT.deepDigs;

export function settleSafe(state) {
  if (!atFork(state)) throw new Error('外层三掘未完');
  addItems(state.carried, { [HUNT.safeItem]: 1 });
  return finish(state, false);
}

export function goDeep(state) {
  if (!atFork(state)) throw new Error('外层三掘未完');
  bank(state);
  state.layer = 'deep';
  state.deepened = true;
  state.threat = Math.max(HUNT.deepEntryThreat, state.threat);
}

export function finishDeep(state) {
  if (!deepDone(state)) throw new Error('深层未探完');
  return finish(state, true);
}

// 界面可见的部分：未掘的地块只露五行；悟空在深层另能认出妖穴
export function view(state) {
  const open = new Set(state.open[state.layer]);
  return {
    guide: state.guide, layer: state.layer, status: state.status, threat: state.threat, maxThreat: HUNT.maxThreat,
    digs: state.digs[state.layer], digLimit: state.layer === 'outer' ? HUNT.outerDigs : HUNT.deepDigs,
    banked: { ...state.banked }, carried: { ...state.carried }, bankedRelics: state.bankedRelics, carriedRelics: state.carriedRelics,
    clueReady: state.layer === 'outer' && state.clue && !state.used.clue,
    shaReady: state.guide === 'sha' && !state.used.sha,
    atFork: atFork(state), deepDone: deepDone(state),
    tiles: state.tiles[state.layer].map((tile, index) => ({
      index, element: tile.element, open: open.has(index),
      kind: open.has(index) ? tile.kind : null, name: open.has(index) ? tile.name : null,
      reward: open.has(index) ? tile.reward ?? null : null, relics: open.has(index) ? tile.relics ?? 0 : 0,
      marked: !open.has(index) && state.layer === 'deep' && state.guide === 'wukong' && tile.kind === 'trap',
    })),
  };
}

// 所得一栏：物品与残简并列，什么都没有才写「无」（不出现「无、残简 2」）
export const haulText = (items, relics = 0) => [...Object.entries(items).map(([k, n]) => `${ITEMS[k].name} ×${n}`), ...(relics ? [`残简 ${relics}`] : [])].join('、') || '无';
