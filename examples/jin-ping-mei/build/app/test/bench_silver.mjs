#!/usr/bin/env node
// 银钱经济收紧后的实测基准(改动 5/6):
//  A. 束搜索实测「权谋风月」六日能攒到的最高银钱(secretsUsed>=2),供门槛取值;
//  B. 同条件但禁用四个资源侧选项,量出「刻意经营」与「随手打」的差距;
//  C. 四个成对选择各自在可达状态集上做双臂对照,判定资源侧是否真有值得选的局。
// 用法: node test/bench_silver.mjs
import * as E from '../js/engine.js';
import { HEROINE_IDS, OPENING_CHOICES } from '../js/data.js';

const BEAM = 8000;
const RESOURCE_OPTIONS = {
  pinger_ask_money: 'pinger_settle_room',
  pinger_take_cash: 'pinger_protect_books',
  jiaoer_take_box: 'jiaoer_buy_name',
  xuee_pay_shortfall: 'xuee_check_storehouse',
};

function key(s) {
  return JSON.stringify([
    s.day, s.phase, s.over,
    s.resources.silver, s.resources.power, s.resources.repute, s.resources.exposure,
    s.resources.house, s.resources.strain,
    [...s.secrets].sort(), [...s.secretsUsed].sort(), Object.keys(s.flags).sort(),
    HEROINE_IDS.map((id) => [s.relations[id].qing, s.relations[id].yu, s.relations[id].du]),
    HEROINE_IDS.map((id) => s.visits[id]),
    Object.values(s.household).map((h) => h.regard),
    s.morning?.id, s.currentHeroine, s.currentHouseholdEvent, s.selectedDayAction,
  ]);
}

const step = (cand, label, fn) => {
  const state = E.snapshot(cand.state);
  const result = fn(state);
  if (result && result.ok === false) return null;
  return { state, path: [...cand.path, label] };
};

function expand(cand, forbid) {
  const s = cand.state;
  switch (s.phase) {
    case 'opening':
      return OPENING_CHOICES.map((c) => step(cand, `开局:${c.id}`, (n) => E.chooseOpening(n, c.id)));
    case 'morning':
      return E.morningOptions(s)
        .filter((o) => !o.disabled && o.id !== 'appease')
        .map((o) => step(cand, `晨:${o.id}`, (n) => E.resolveMorning(n, o.id)));
    case 'day':
      return E.dayOptions(s)
        .filter((o) => !o.disabled)
        .map((o) => step(cand, `白日:${o.id}`, (n) => E.chooseDayAction(n, o.id)));
    case 'household':
      return E.householdOptions(s)
        .filter((o) => !o.disabled && !forbid.has(o.id))
        .map((o) => step(cand, `宅中:${o.id}`, (n) => E.resolveHouseholdEvent(n, o.id)));
    case 'banquet':
      return [step(cand, '宴席:banquet_honor_yue', (n) => E.chooseBanquet(n, 'banquet_honor_yue'))];
    case 'choose_visit':
      return HEROINE_IDS.map((h) => step(cand, `黄昏:${h}`, (n) => E.startVisit(n, h)));
    case 'visit':
      return E.visitChoices(s, s.currentHeroine)
        .filter((o) => !o.disabled && !forbid.has(o.id))
        .map((o) => step(cand, `路线:${o.id}`, (n) => E.chooseVisit(n, o.id)));
    case 'night':
      return [step(cand, '夜:talk', (n) => E.chooseNight(n, 'talk'))];
    case 'scene':
      return [step(cand, '册页:合上', (n) => E.closeScene(n))];
    default:
      return [cand];
  }
}

// 剪枝按 secretsUsed 分桶:递过秘密的状态银钱偏瘦,单一按银钱排序会把权谋支路剪没。
function runBeam(forbid = new Set(), watchers = null) {
  let beam = [{ state: E.newGame(42), path: [] }];
  let guard = 0;
  while (beam.some((c) => !c.state.over) && guard++ < 120) {
    let next = [];
    for (const cand of beam) {
      if (cand.state.over) { next.push(cand); continue; }
      if (watchers && (cand.state.phase === 'household' || cand.state.phase === 'visit')) watchers(cand.state);
      next.push(...expand(cand, forbid));
    }
    const best = new Map();
    for (const cand of next.filter(Boolean)) {
      const k = key(cand.state);
      const prev = best.get(k);
      if (!prev || cand.state.resources.silver > prev.state.resources.silver) best.set(k, cand);
    }
    const byUsed = new Map();
    for (const cand of best.values()) {
      const bucket = byUsed.get(cand.state.secretsUsed.length) ?? [];
      bucket.push(cand);
      byUsed.set(cand.state.secretsUsed.length, bucket);
    }
    next = [...byUsed.values()].flatMap((bucket) =>
      bucket.sort((a, b) => b.state.resources.silver - a.state.resources.silver).slice(0, BEAM));
    beam = next;
  }
  return beam;
}

// 银钱导向的既定续走:晨间取免费项、白日第 3 日能递话就递、其余翻账,
// 黄昏取当场银子最多的一拍。用于成对选择的双臂对照——同一状态、同一续走,只差那一臂。
function greedyFinish(state) {
  const s = E.snapshot(state);
  let guard = 0;
  while (!s.over && guard++ < 200) {
    if (s.phase === 'morning') {
      const o = E.morningOptions(s).find((x) => !x.disabled && x.id !== 'appease');
      E.resolveMorning(s, o.id);
    } else if (s.phase === 'day') {
      const opts = E.dayOptions(s).filter((o) => !o.disabled);
      const pick = (s.day === 3 && opts.find((o) => o.id === 'office'))
        ?? opts.find((o) => o.id === 'ledger') ?? opts[0];
      E.chooseDayAction(s, pick.id);
    } else if (s.phase === 'household') {
      E.resolveHouseholdEvent(s, E.householdOptions(s).find((o) => !o.disabled).id);
    } else if (s.phase === 'banquet') {
      E.chooseBanquet(s, 'banquet_honor_yue');
    } else if (s.phase === 'scene') {
      E.closeScene(s);
    } else if (s.phase === 'choose_visit') {
      let best = null;
      for (const h of HEROINE_IDS) {
        const n = E.snapshot(s);
        E.startVisit(n, h);
        for (const c of E.visitChoices(n, h)) {
          if (c.disabled) continue;
          const gain = c.effects?.silver ?? 0;
          if (!best || gain > best.gain) best = { h, id: c.id, gain };
        }
      }
      E.startVisit(s, best.h);
      E.chooseVisit(s, best.id);
    } else if (s.phase === 'night') {
      E.chooseNight(s, 'talk');
    } else break;
  }
  return s;
}

console.log('== A. 权谋路线最高银钱(束搜索, secretsUsed>=2) ==');
const beam = runBeam();
const intrigue = beam.filter((c) => c.state.over && c.state.secretsUsed.length >= 2);
intrigue.sort((a, b) => b.state.resources.silver - a.state.resources.silver);
const top = intrigue[0];
console.log(`最高银钱: ${top.state.resources.silver} 两(power ${top.state.resources.power}, exposure ${top.state.resources.exposure}, ending ${top.state.ending.id})`);
console.log(`路径: ${top.path.join(' → ')}`);
console.log(`前十候选: ${intrigue.slice(0, 10).map((c) => c.state.resources.silver).join(', ')}`);

console.log('\n== B. 禁用四个资源侧选项后的最高银钱 ==');
const beamNoRes = runBeam(new Set(Object.keys(RESOURCE_OPTIONS)));
const intrigueNoRes = beamNoRes
  .filter((c) => c.state.over && c.state.secretsUsed.length >= 2)
  .sort((a, b) => b.state.resources.silver - a.state.resources.silver);
console.log(`最高银钱: ${intrigueNoRes[0].state.resources.silver} 两(禁用资源侧)`);
console.log(`资源侧差距: ${top.state.resources.silver - intrigueNoRes[0].state.resources.silver} 两`);

console.log('\n== C. 四个成对选择的双臂对照(可达状态集 + 既定续走) ==');
const samples = new Map(Object.keys(RESOURCE_OPTIONS).map((id) => [id, new Map()]));
runBeam(new Set(), (state) => {
  const choices = state.phase === 'household' ? E.householdOptions(state) : E.visitChoices(state, state.currentHeroine);
  for (const id of Object.keys(RESOURCE_OPTIONS)) {
    if (choices.some((c) => c.id === id && !c.disabled)) {
      samples.get(id).set(key(state), E.snapshot(state));
    }
  }
});
for (const [id, pairId] of Object.entries(RESOURCE_OPTIONS)) {
  const states = [...samples.get(id).values()].slice(0, 40);
  let wins = 0;
  let bestCase = null;
  for (const before of states) {
    const runArm = (choiceId) => {
      const s = E.snapshot(before);
      if (s.phase === 'household') E.resolveHouseholdEvent(s, choiceId);
      else E.chooseVisit(s, choiceId);
      return greedyFinish(s);
    };
    const res = runArm(id);
    const rel = runArm(pairId);
    const resBad = res.history.some((x) => x.type === 'collector' && !x.paid);
    const relBad = rel.history.some((x) => x.type === 'collector' && !x.paid);
    const diff = res.resources.silver - rel.resources.silver;
    if (diff > 0 || (diff === 0 && relBad && !resBad)) {
      wins += 1;
      if (!bestCase || diff > bestCase.diff) {
        bestCase = { diff, resSilver: res.resources.silver, relSilver: rel.resources.silver, day: before.day, resBad, relBad };
      }
    }
  }
  const verdict = wins > 0 ? `值得选(${wins}/${states.length} 个可达状态)` : '永远不值得选';
  console.log(`${id} vs ${pairId}: ${verdict}${bestCase ? `; 最佳例: 第${bestCase.day}日, ${bestCase.resSilver} vs ${bestCase.relSilver} 两(差 ${bestCase.diff}, 催账闹门 ${bestCase.relBad}→${bestCase.resBad})` : ''}`);
}
