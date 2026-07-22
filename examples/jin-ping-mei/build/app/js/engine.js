// 纯游戏引擎:不依赖 DOM,node 可直接跑自测。
// 合同支点:
//  - 只有「藏」提升暗账;「持」「结」「谋」提升明账并消耗暗账资源;
//    不存在既涨明账又涨暗账的动作。
//  - 对手真实状态永不可见;传闻带可信度且可能为假。
//  - 一切随机走 seedRNG;同种子同操作逐字节可复现。
//  - 第79回明账清零;五种结局按暗账与风声判定;全程无中途 Game Over。

import { createRNG, next, rint, chance, pick } from './rng.js';
import {
  RIVALS, SERVANTS, CRED_TRUTH, RUMOR_TEXTS, SCHEMES, SCHEME_STEP, SCHEME_WIND,
  DUTIES, TUILU, FESTIVALS, ENDING, YANXI, YE_WEIGHT, YE_COST, YE_HAO, YE_BONUS,
  SHI_COST, SHI_BONUS, SHI_SEEN_P,
  HAO, LODGING_TEXTS, VISITS,
} from './data.js';

export const ACTS = { 1: 'act1', 2: 'act2', 3: 'act3' };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap100 = (v) => clamp(v, 0, 100);

// ---------- 新开局 ----------
export function newGame(seed) {
  const rng = createRNG(seed);
  const rivals = {};
  for (const [id, def] of Object.entries(RIVALS)) {
    rivals[id] = {
      id, name: def.name, style: def.style, offBoard: !!def.offBoard,
      joined: def.join <= 1, alive: true,
      ming: def.ming, si: def.si,           // 隐藏真实状态
      hostility: 0,                          // 对玩家的敌意(隐藏)
      affection: 0,                          // 对玩家的暗好(隐藏)
      scheme: null,                          // {target, progress}
      recent: [],                            // 本令动作(供传闻与动线)
    };
  }
  return {
    version: 2,
    seed, rng,
    festival: 1,
    phase: 'event',                          // event → actions → (clear/ending/epilogue)
    ap: 3,
    player: {
      tiyan: 10, chong: 10,
      sifang: 0, renqing: { yue: 0, pan: 0, pinger: 0, xuee: 0, chunmei: 0 },
      tuilu: [], gongzhong: 0,
      fengsheng: 0, jinzu: 0,
      hao: 0,                                // 耗:不上榜的暗指标,暗账负债项
      faluoEver: false, faluoCount: 0,
      duty: null,
    },
    rivals,
    rumors: [],        // {id,servant,target,kind,text,cred,truth,verified,festival}
    rumorSeq: 0,
    schemes: [],       // {id,key,target,progress,informers,rumorId}
    schemeSeq: 0,
    flags: {},         // 剧情标记(揭发/换取好处等)
    sightings: [],     // 本令结算产生的仆役动线 {servant,from,to,note}
    lodging: 'yue',    // 家主今夜歇在谁院里(开局依礼在正房)
    lodgingHistory: {},// festival → houseId
    yeTonight: false,  // 本令玩家是否已布置「争夜」
    shiTonight: false, // 本令玩家是否已「结·私」(主动示意,铺垫争夜)
    shiTrace: null,    // 「结·私」留下的痕迹 {rival} — 结算时化成话柄
    visit: null,       // 本令上门事件(见 VISITS),进行动阶段时掷定
    lastVisit: 0,      // 上次有人上门的节令(保证每2-3令至少一次)
    bestRank: null,
    lastRank: null,
    log: [],           // 结算记录 [{festival, text}]
    floats: [],        // 待 UI 弹出的双色浮字 {k:'gold'|'ink'|'red', t}
    event: FESTIVALS[0],
    ending: null,
    over: false,
  };
}

// ---------- 派生视图 ----------
export function festivalDef(state) {
  return FESTIVALS[state.festival - 1];
}

export function actOf(state) {
  return festivalDef(state).act;
}

// 明账是否已作废(第79回后)
export function mingDead(state) {
  return state.festival >= 19;
}

// 退路的实际开价:薛媒婆递过李衙内的话,「官媒门路」便宜一百两。
export function tuiluCost(state, line) {
  const def = TUILU[line];
  if (!def) return Infinity;
  if (line === 'guanmei' && state.flags.yaneiLine) return def.cost - 100;
  return def.cost;
}

// 六房排行榜:玩家与对手同一量纲(0-100);春梅不上榜,死者撤榜。
export function leaderboard(state) {
  if (mingDead(state)) return [];
  const rows = [];
  const p = state.player;
  rows.push({ id: 'player', name: '孟玉楼', score: Math.round((p.tiyan + p.chong) / 2), you: true });
  for (const r of Object.values(state.rivals)) {
    if (r.offBoard || !r.joined || !r.alive) continue;
    rows.push({ id: r.id, name: r.name, score: r.ming });
  }
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((row, i) => (row.rank = i + 1));
  return rows;
}

export function playerRank(state) {
  const lb = leaderboard(state);
  const me = lb.find((r) => r.you);
  return me ? me.rank : null;
}

function pushFloat(state, k, label, delta) {
  if (!delta) return;
  state.floats.push({ k, t: `${delta > 0 ? '+' : ''}${delta} ${label}` });
}

// ---------- 行动合法性 ----------
export function actionError(state, a) {
  const p = state.player;
  if (state.phase !== 'actions') return '现在不是行动的时候';
  if (state.over) return '已至终局';
  if (p.jinzu > 0) return '禁足中';
  const cost = a.type === 'chi' ? 2 : 1;
  if (state.ap < cost) return '行动点不足';
  switch (a.type) {
    case 'ye': {
      // 「争夜」是「结」的高风险高回报版本:只涨明账与耗,绝不涨暗账。
      // 银子只能从私房出——置办今夜的一桌酒菜、一副头面,走不得公中的账。
      if (mingDead(state)) return '明账已清,无人可争';
      if (state.yeTonight) return '今夜已布置下了';
      if (p.sifang < YE_COST) return '私房不够置办';
      return null;
    }
    case 'shi': {
      // 「结·私」:主动示意。只抬本节令留宿权重与一点明账,绝不涨暗账。
      if (mingDead(state)) return '明账已清,示意也递不到他手里';
      if (state.shiTonight) return '本令已递过一份了';
      if (p.sifang < SHI_COST) return '私房不够备这份东西';
      return null;
    }
    case 'tan': {
      const sv = SERVANTS[a.servant];
      if (!sv) return '没有这个人';
      if (p.sifang < sv.price) return '私房不够付线钱';
      const t = state.rivals[a.target];
      if (!t || !t.joined || !t.alive) return '探不到这一房';
      return null;
    }
    case 'jie': {
      if (a.target !== 'ximen' && !(state.rivals[a.target]?.joined && state.rivals[a.target]?.alive)) return '这一房结不着';
      const costSilver = a.size === 'big' ? 150 : 50;
      if (a.fund === 'si' && p.sifang < costSilver) return '私房不够';
      if (a.fund === 'gong' && p.gongzhong < costSilver) return '公中银不够';
      if (a.fund === 'gong' && !p.duty) return '不曾担差事,动不了公中';
      return null;
    }
    case 'mou': {
      if (festivalDef(state).act < 2) return '还没到用谋的时候';
      if (!SCHEMES[a.scheme]) return '没有这条谋算';
      const t = state.rivals[a.target];
      if (!t || !t.joined || !t.alive) return '谋不到这一房';
      if (a.scheme === 'zuoshi') {
        const r = state.rumors.find((x) => x.id === a.rumorId && x.target === a.target && x.verified === true);
        if (!r) return '须有一条对那一房已证实的传闻';
      }
      return null;
    }
    case 'chi': {
      if (!DUTIES[a.duty]) return '没有这件差事';
      if (mingDead(state)) return '明账已清,差事无用';
      // 位分靠后有真实代价:好差事轮不到你
      const rank = playerRank(state);
      if (rank !== null && rank >= 5 && a.duty !== 'puzhang') return '位次太靠后,接不到这件差事';
      return null;
    }
    case 'cang': {
      if (a.mode === 'help') {
        const t = state.rivals[a.target];
        if (!t || !t.joined || !t.alive) return '助不到这一房';
        if (p.sifang < 40) return '私房不够';
      }
      if (a.mode === 'tuilu') {
        const def = TUILU[a.line];
        if (!def) return '没有这条路';
        if (state.festival < def.open) return '这条路还没开';
        if (p.tuilu.includes(a.line)) return '这条路已在你手里';
        if (p.sifang < tuiluCost(state, a.line)) return '私房不够';
      }
      return null;
    }
    case 'verify': {
      const r = state.rumors.find((x) => x.id === a.rumorId);
      if (!r) return '没有这条传闻';
      if (r.verified !== null) return '这条已经验过';
      return null;
    }
    default:
      return '不识此令';
  }
}

// ---------- 行动执行(只改 state;浮字进 state.floats) ----------
export function applyAction(state, a) {
  const err = actionError(state, a);
  if (err) return { ok: false, msg: err };
  const p = state.player;
  const dead = mingDead(state);
  state.ap -= a.type === 'chi' ? 2 : 1;
  switch (a.type) {
    case 'tan': return doTan(state, a);
    case 'jie': return doJie(state, a, dead);
    case 'mou': return doMou(state, a);
    case 'chi': return doChi(state, a);
    case 'cang': return doCang(state, a);
    case 'ye': return doYe(state);
    case 'shi': return doShi(state);
    case 'verify': return doVerify(state, a);
  }
  return { ok: false, msg: '不识此令' };
}

function doTan(state, a) {
  const p = state.player;
  const sv = SERVANTS[a.servant];
  p.sifang -= sv.price;
  if (sv.price) pushFloat(state, 'ink', '私房', -sv.price);
  // 你买得越多,被卖得越勤
  const bought = state.rumors.filter((r) => r.festival === state.festival).length;
  if (bought >= 1 && chance(state.rng, 0.3)) {
    p.fengsheng = cap100(p.fengsheng + 3);
    pushFloat(state, 'red', '风声', 3);
  }
  const t = state.rivals[a.target];
  const cred = sv.closeTo === a.target ? '高' : (chance(state.rng, 0.6) ? '中' : '低');
  const truth = chance(state.rng, CRED_TRUTH[cred]);
  const rumor = makeRumor(state, a.servant, a.target, cred, truth);
  state.rumors.push(rumor);
  return { ok: true, rumor };
}

function makeRumor(state, servant, target, cred, truth) {
  const t = state.rivals[target];
  // 真传闻依据对象本令真实动向;假传闻是编的
  let kind = 'calm';
  if (truth) {
    if (t.recent.length) kind = t.recent[0].kind;
    else if (t.hostility > 40) kind = 'hostile';
  } else {
    kind = pick(state.rng, ['cang', 'zheng', 'scheme', 'hostile', 'calm']);
  }
  const others = Object.values(state.rivals).filter((r) => r.id !== target && r.joined && r.alive && !r.offBoard);
  const other = others.length ? pick(state.rng, others).name : '别';
  // 同一对象已在手的传闻不重复投放同一句:三张一样的卡片看起来像 bug,不像情报。
  // 仍然只消耗一次 rng 抽取,同种子同操作逐字节可复现不受影响。
  const sub = (s) => s.replaceAll('{name}', t.name).replaceAll('{other}', other);
  const used = new Set(state.rumors.filter((r) => r.target === target).map((r) => r.text));
  const all = RUMOR_TEXTS[kind];
  const fresh = all.filter((s) => !used.has(sub(s)));
  let text = sub(pick(state.rng, fresh.length ? fresh : all));
  if (!truth) {
    // 假传闻:内容虚构,与事实无关(甚至可能矛盾)
  }
  state.rumorSeq += 1;
  return {
    id: `r${state.rumorSeq}`, servant, target, kind, text, cred, truth,
    verified: null, festival: state.festival,
  };
}

function doVerify(state, a) {
  const r = state.rumors.find((x) => x.id === a.rumorId);
  r.verified = r.truth;
  return { ok: true, rumor: r };
}

// 「争夜」:置办今夜,争家主歇在自己院里。成败在节令结算的留宿抽签里定。
// 只涨明账与「耗」,绝不涨任何暗账——它是「结」的高风险高回报版本,不是第六类行动的例外。
function doYe(state) {
  const p = state.player;
  p.sifang -= YE_COST;
  pushFloat(state, 'ink', '私房', -YE_COST);
  p.hao = Math.min(100, p.hao + YE_HAO);
  pushFloat(state, 'ink', '耗', YE_HAO);
  state.yeTonight = true;
  return { ok: true };
}

// 「结·私」:备一份只送给家主的东西(一方帕子、一支钗、一句话带出去)。
// 抬本节令留宿抽签的权重(SHI_BONUS,与「争夜」可叠加),添一点宠;
// 但东西过手留下痕迹——若被仆役瞧见,风声起,那一房也可能拿去当话柄。
// 支点:只影响明账与留宿权重,绝不涨暗账。
function doShi(state) {
  const p = state.player;
  p.sifang -= SHI_COST;
  pushFloat(state, 'ink', '私房', -SHI_COST);
  p.chong = cap100(p.chong + 2);
  pushFloat(state, 'gold', '宠', 2);
  state.shiTonight = true;
  let seen = false;
  if (chance(state.rng, SHI_SEEN_P)) {
    seen = true;
    p.fengsheng = cap100(p.fengsheng + 4);
    pushFloat(state, 'red', '风声', 4);
    const pool = Object.values(state.rivals).filter((r) => r.joined && r.alive && !r.offBoard);
    if (pool.length) {
      const r = pick(state.rng, pool);
      r.hostility += 6;
      state.shiTrace = { rival: r.id };
      sighting(state, pick(state.rng, ['daian', 'xiaoyu', 'fengmama']), 'player', r.id);
    }
  }
  return { ok: true, seen };
}

function doJie(state, a, dead) {
  const p = state.player;
  const silver = a.size === 'big' ? 150 : 50;
  if (a.fund === 'gong') {
    p.gongzhong -= silver;
    p.fengsheng = cap100(p.fengsheng + 8);
    pushFloat(state, 'red', '风声', 8);
  } else {
    p.sifang -= silver;
    pushFloat(state, 'ink', '私房', -silver);
  }
  if (dead) return { ok: true, msg: '明账已清,礼再厚也上不了榜' };
  const boost = festivalDef(state).mingBoost ? 1.5 : 1;
  let dT = 0, dC = 0;
  if (a.target === 'ximen') {
    dC = Math.round((a.size === 'big' ? 12 : 5) * boost);
    dT = a.size === 'big' ? 4 : 0;
  } else {
    const t = state.rivals[a.target];
    t.affection += a.size === 'big' ? 15 : 6;
    dT = Math.round((a.size === 'big' ? 6 : 3) * boost);
    dC = a.size === 'big' ? 3 : 1;
  }
  p.tiyan = cap100(p.tiyan + dT);
  p.chong = cap100(p.chong + dC);
  pushFloat(state, 'gold', '体面', dT);
  pushFloat(state, 'gold', '宠', dC);
  return { ok: true };
}

function doMou(state, a) {
  const p = state.player;
  let s = state.schemes.find((x) => x.key === a.scheme && x.target === a.target);
  if (!s) {
    state.schemeSeq += 1;
    s = { id: `s${state.schemeSeq}`, key: a.scheme, target: a.target, progress: 0, informers: [], rumorId: a.rumorId ?? null };
    state.schemes.push(s);
  }
  s.progress = clamp(s.progress + SCHEME_STEP, 0, 100);
  // 每推一次,多一名知情者
  const pool = Object.keys(SERVANTS).filter((x) => !s.informers.includes(x));
  if (pool.length) s.informers.push(pick(state.rng, pool));
  p.fengsheng = cap100(p.fengsheng + SCHEME_WIND);
  pushFloat(state, 'red', '风声', SCHEME_WIND);
  // 「谋」涨明账:运作的姿态被人看见
  if (!mingDead(state)) {
    p.chong = cap100(p.chong + 2);
    pushFloat(state, 'gold', '宠', 2);
  }
  return { ok: true, scheme: s };
}

function doChi(state, a) {
  const p = state.player;
  const d = DUTIES[a.duty];
  const boost = festivalDef(state).mingBoost ? 1.5 : 1;
  const dT = Math.round(d.tiyan * boost), dC = Math.round(d.chong * boost);
  p.tiyan = cap100(p.tiyan + dT);
  p.chong = cap100(p.chong + dC);
  p.gongzhong = clamp(p.gongzhong + d.gong, 0, 400);
  p.duty = a.duty;
  pushFloat(state, 'gold', '体面', dT);
  pushFloat(state, 'gold', '宠', dC);
  pushFloat(state, 'ink', '公中', d.gong);
  return { ok: true };
}

function doCang(state, a) {
  const p = state.player;
  // 「藏」是全局唯一提升暗账的动作,且不给任何明账
  if (a.mode === 'save') {
    let gain = 30;
    if (p.duty === 'puzhang') gain += 15;       // 理铺账者有余银可截
    const boost = actOf(state) === 3 ? 1.2 : 1;
    gain = Math.round(gain * boost);
    p.sifang += gain;
    pushFloat(state, 'ink', '私房', gain);
    return { ok: true };
  }
  if (a.mode === 'help') {
    p.sifang -= 40;
    p.renqing[a.target] = cap100((p.renqing[a.target] ?? 0) + 15);
    pushFloat(state, 'ink', '私房', -40);
    pushFloat(state, 'ink', '人情', 15);
    return { ok: true };
  }
  if (a.mode === 'tuilu') {
    const def = TUILU[a.line];
    const cost = tuiluCost(state, a.line);
    p.sifang -= cost;
    p.tuilu.push(a.line);
    pushFloat(state, 'ink', '私房', -cost);
    return { ok: true };
  }
  return { ok: false, msg: '不识此藏' };
}

// ---------- 事件选择 ----------
export function eventChoiceError(state, choice) {
  const p = state.player;
  if (choice.needSi && p.sifang < choice.needSi) return '私房不够';
  if (choice.needRq && (p.renqing[choice.needRq.who] ?? 0) < choice.needRq.n) return '人情不够';
  return null;
}

export function applyEventChoice(state, choiceId) {
  const ev = state.event;
  const choice = ev.choices?.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, msg: '没有这条路' };
  const err = eventChoiceError(state, choice);
  if (err) return { ok: false, msg: err };
  applyEffects(state, choice.effects ?? {});
  if (choice.effects?.flag) state.flags[choice.effects.flag] = true;
  state.phase = 'actions';
  state.ap = state.player.jinzu > 0 ? 0 : 3;
  rollVisit(state);
  return { ok: true, choice };
}

export function skipEventIfNoChoice(state) {
  if (state.event.choices?.length) return false;
  state.phase = 'actions';
  state.ap = state.player.jinzu > 0 || state.event.clear || state.event.ending || state.event.epilogue ? 0 : 3;
  rollVisit(state);
  return true;
}

// ---------- 上门事件 ----------
// 进入行动阶段时掷定:距上次满 3 令必有人来,否则四成概率。每令至多一次。
// 掷定走 seedRNG;不应答的人,节令一过就自己走了(advance 里清掉)。
function rollVisit(state) {
  const ev = state.event;
  if (ev.clear || ev.ending || ev.epilogue || mingDead(state)) return;
  if (state.phase !== 'actions' || state.ap <= 0) return;
  if (state.festival < 2) return;
  const due = state.festival - state.lastVisit >= 3;
  if (!due && !chance(state.rng, 0.4)) return;
  const pool = VISITS.filter((v) => state.festival >= v.min && (!v.cond || v.cond(state)));
  if (!pool.length) return;
  let total = 0;
  for (const v of pool) total += v.weight ?? 2;
  let roll = next(state.rng) * total;
  let sel = pool[0];
  for (const v of pool) { roll -= v.weight ?? 2; if (roll <= 0) { sel = v; break; } }
  state.visit = { id: sel.id };
}

export function visitDef(state) {
  return VISITS.find((v) => v.id === state.visit?.id) ?? null;
}

export function applyVisitChoice(state, choiceId) {
  const def = visitDef(state);
  if (!def) return { ok: false, msg: '没有人来' };
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, msg: '没有这条路' };
  const err = eventChoiceError(state, choice);
  if (err) return { ok: false, msg: err };
  applyEffects(state, choice.effects ?? {});
  if (choice.effects?.flag) state.flags[choice.effects.flag] = state.festival;
  if (choice.effects?.unflag) delete state.flags[choice.effects.unflag];
  state.lastVisit = state.festival;
  state.visit = null;
  return { ok: true, choice, def };
}

function applyEffects(state, fx) {
  const p = state.player;
  if (fx.tiyan) { p.tiyan = cap100(p.tiyan + fx.tiyan); pushFloat(state, 'gold', '体面', fx.tiyan); }
  if (fx.chong) { p.chong = cap100(p.chong + fx.chong); pushFloat(state, 'gold', '宠', fx.chong); }
  if (fx.sifang) { p.sifang = Math.max(0, p.sifang + fx.sifang); pushFloat(state, 'ink', '私房', fx.sifang); }
  if (fx.feng) { p.fengsheng = cap100(p.fengsheng + fx.feng); pushFloat(state, 'red', '风声', fx.feng); }
  if (fx.gong) { p.gongzhong = clamp(p.gongzhong + fx.gong, 0, 400); }
  if (fx.hao) { p.hao = Math.min(100, p.hao + fx.hao); pushFloat(state, 'ink', '耗', fx.hao); }
  if (fx.lodging === 'player') state.lodgingOverride = 'player'; // 家主迎灯:今夜留宿直接落定
  if (fx.hostility) {
    for (const [who, d] of Object.entries(fx.hostility)) {
      const r = state.rivals[who];
      if (r) r.hostility = Math.max(0, r.hostility + d); // 敌意是隐藏状态,不弹浮字
    }
  }
  if (fx.affection) {
    for (const [who, d] of Object.entries(fx.affection)) {
      const r = state.rivals[who];
      if (r) r.affection = Math.max(0, r.affection + d); // 暗好同理
    }
  }
  if (fx.renqing) {
    for (const [who, d] of Object.entries(fx.renqing)) {
      p.renqing[who] = cap100((p.renqing[who] ?? 0) + d);
      pushFloat(state, 'ink', '人情', d);
    }
  }
}

// ---------- 节令提交:对手行动 → 结算 → 推进 ----------
export function submitTurn(state) {
  const report = { sightings: [], notes: [], rankBefore: state.lastRank, cleared: false, ending: null };
  const p = state.player;
  const ev = festivalDef(state);

  // 对手行动(死者除外)
  for (const r of Object.values(state.rivals)) {
    if (!r.joined || !r.alive) continue;
    rivalAct(state, r, report);
  }
  // 玩家谋算:泄密判定与生效
  settleSchemes(state, report);
  // 留宿:家主今夜歇在谁院里(争夜的成败在此落定)
  settleLodging(state, report);
  // 差事反噬
  if (p.duty && ev.dutyRisk && chance(state.rng, 0.5)) {
    p.tiyan = cap100(p.tiyan - 8);
    pushFloat(state, 'gold', '体面', -8);
    report.notes.push('你办的差事出了纰漏,你是第一责任人。');
  }
  // 宴席结算
  if (ev.settle === 'yanxi' && !mingDead(state)) {
    const tier = YANXI.find((t) => p.chong >= t.minChong);
    if (tier) {
      p.tiyan = cap100(p.tiyan + tier.tiyan);
      pushFloat(state, 'gold', '体面', tier.tiyan);
      report.notes.push(tier.text);
    }
  }
  if (ev.settle === 'puzi') {
    if (p.tuilu.includes('puzi')) {
      p.sifang += 200;
      pushFloat(state, 'ink', '私房', 200);
      report.notes.push('韩道国跑了,但你早留的铺子门路替你保住了本钱。');
    } else {
      const loss = Math.min(100, p.sifang);
      p.sifang -= loss;
      if (loss) pushFloat(state, 'ink', '私房', -loss);
      report.notes.push('铺子关张,你也折了一笔。');
    }
  }
  if (ev.settle === 'fenpei') {
    const rq = p.renqing.yue ?? 0;
    const share = rq >= 20 ? 150 : rq >= 10 ? 80 : 0;
    if (share) {
      p.sifang += share;
      pushFloat(state, 'ink', '私房', share);
      report.notes.push('月娘分派家产,念旧情给了你一份。');
    } else {
      report.notes.push('分家的单子上,你的名下没添几行。');
    }
  }
  // 宠衰减、风声回落
  p.chong = cap100(p.chong - 3);
  p.fengsheng = cap100(p.fengsheng - 4);
  // 发落
  if (p.fengsheng >= 90) applyFaluo(state, report);
  // 月例
  if (!mingDead(state)) {
    p.sifang += 18;
  }
  // 排行榜记录
  const lb = leaderboard(state);
  const me = lb.find((r) => r.you);
  if (me) {
    state.lastRank = me.rank;
    if (state.bestRank === null || me.rank < state.bestRank) state.bestRank = me.rank;
    report.rankAfter = me.rank;
  }
  report.sightings = state.sightings;
  advance(state, report);
  return report;
}

// 留宿判定:各房按脾性权重与当前明账加权抽签(走 seedRNG,同种子逐字节可复现)。
// 中签者涨明账;玩家中签另添三分耗——承宠本身也耗人。争夜落败则起风声、结怨。
function settleLodging(state, report) {
  if (mingDead(state)) return;
  const p = state.player;
  // 「结·私」留下的痕迹:东西过了手,话就长在别人舌头上
  if (state.shiTrace) {
    const tr = state.rivals[state.shiTrace.rival];
    if (tr) report.notes.push(`你递出去的那份心意,叫${tr.name}院里的人瞧见了——明日这话就值钱了。`);
  }
  // 家主深夜迎灯:上门事件里已把今夜的灯定下,不走抽签
  if (state.lodgingOverride === 'player') {
    state.lodging = 'player';
    state.lodgingHistory[state.festival] = 'player';
    p.chong = cap100(p.chong + 10);
    p.tiyan = cap100(p.tiyan + 3);
    pushFloat(state, 'gold', '宠', 10);
    pushFloat(state, 'gold', '体面', 3);
    report.notes.push(LODGING_TEXTS.playerWin);
    report.lodging = { house: 'player', ye: false, pan: false };
    return;
  }
  const bids = [{ id: 'player', w: Math.max(1, p.chong) * (state.yeTonight ? 2.2 : 1) + (state.yeTonight ? YE_BONUS : 0) + (state.shiTonight ? SHI_BONUS : 0) }];
  for (const r of Object.values(state.rivals)) {
    if (!r.joined || !r.alive) continue;
    // 李娇儿从不经营家主的心:她的明账是坐出来的体面,换不成灯
    const w = (YE_WEIGHT[r.id] ?? 4) + (r.id === 'lijiaoer' ? 0 : r.ming * 0.1);
    bids.push({ id: r.id, w });
  }
  let total = 0;
  for (const b of bids) total += b.w;
  let roll = next(state.rng) * total;
  let win = bids[0];
  for (const b of bids) { roll -= b.w; if (roll <= 0) { win = b; break; } }
  state.lodging = win.id;
  state.lodgingHistory[state.festival] = win.id;
  if (win.id === 'player') {
    p.chong = cap100(p.chong + 10);
    p.tiyan = cap100(p.tiyan + 3);
    p.hao = Math.min(100, p.hao + 3);
    pushFloat(state, 'gold', '宠', 10);
    pushFloat(state, 'gold', '体面', 3);
    if (state.yeTonight) {
      // 争来的夜,满宅都看见了:各房敌意直线上升
      for (const r of Object.values(state.rivals)) if (r.joined && r.alive) r.hostility += 12;
      report.notes.push(LODGING_TEXTS.playerYeWin);
      report.lodging = { house: 'player', ye: true, pan: false };
    } else {
      report.notes.push(LODGING_TEXTS.playerWin);
      report.lodging = { house: 'player', ye: false, pan: false };
    }
  } else {
    const r = state.rivals[win.id];
    r.ming = cap100(r.ming + 6);
    if (state.yeTonight) {
      p.fengsheng = cap100(p.fengsheng + 5);
      pushFloat(state, 'red', '风声', 5);
      r.hostility += 8;
      report.notes.push(LODGING_TEXTS.yeFail.replaceAll('{name}', r.name));
      report.lodging = { house: r.id, ye: 'fail', pan: win.id === 'pan' };
    } else {
      const key = win.id === 'pan' ? 'rivalPan' : 'rival';
      report.notes.push(LODGING_TEXTS[key].replaceAll('{name}', r.name));
      report.lodging = { house: r.id, ye: false, pan: win.id === 'pan' };
    }
  }
}

function applyFaluo(state, report) {
  const p = state.player;
  p.faluoEver = true;
  p.faluoCount += 1;
  p.tiyan = cap100(p.tiyan - 25);
  p.chong = cap100(p.chong - 20);
  const fine = Math.round(p.sifang * 0.3);
  p.sifang -= fine;
  p.jinzu = 2; // advance 即减一,余下的 1 正好禁足下一令——禁足要真的禁
  p.fengsheng = 55;
  pushFloat(state, 'gold', '体面', -25);
  pushFloat(state, 'gold', '宠', -20);
  pushFloat(state, 'ink', '私房', -fine);
  report.faluo = { fine };
  report.notes.push(`风声传到了大娘子耳朵里:降位分,罚没私房 ${fine} 两,禁足一令。是重挫,不是终局。`);
}

function rivalAct(state, r, report) {
  const acts = r.style === 'aggressive' ? 2 : (chance(state.rng, 0.5) ? 2 : 1);
  for (let i = 0; i < acts; i++) rivalOneAct(state, r, report);
}

function rivalOneAct(state, r, report) {
  const p = state.player;
  const f = state.festival;
  const act2 = f >= 7;
  const hostileToPinger = act2 && r.id === 'pan' && state.rivals.pinger.alive;
  switch (r.style) {
    case 'aggressive': {
      // 潘金莲:争宠最快,也最会出手
      if (act2 && chance(state.rng, 0.45)) {
        rivalScheme(state, r, hostileToPinger ? state.rivals.pinger : pickTarget(state, r), report);
      } else {
        const g = rint(state.rng, 6, 12);
        r.ming = cap100(r.ming + g);
        r.recent = [{ kind: 'zheng' }];
      }
      break;
    }
    case 'defensive': {
      if (chance(state.rng, 0.5)) {
        r.si += rint(state.rng, 50, 100);
        r.recent = [{ kind: 'cang' }];
      } else {
        r.ming = cap100(r.ming + rint(state.rng, 3, 7));
        r.recent = [{ kind: 'zheng' }];
      }
      break;
    }
    case 'steady': {
      r.ming = cap100(r.ming + rint(state.rng, 4, 8));
      r.recent = [{ kind: 'zheng' }];
      break;
    }
    case 'hoarder': {
      r.si += rint(state.rng, 60, 120);
      r.ming = cap100(r.ming + rint(state.rng, 1, 4));
      r.recent = [{ kind: 'cang' }];
      break;
    }
    case 'chaos': {
      // 孙雪娥:便宜且不计后果,常把话往外递
      if (chance(state.rng, 0.4)) {
        p.fengsheng = cap100(p.fengsheng + 2);
        pushFloat(state, 'red', '风声', 2);
        report.notes.push('厨下有人嚼你的舌根。');
        sighting(state, 'xiaoyu', 'xuee', 'yue');
      } else {
        r.ming = cap100(r.ming + rint(state.rng, 2, 6));
        r.recent = [{ kind: 'calm' }];
      }
      break;
    }
    case 'climber': {
      // 庞春梅:不上榜,暗中跃迁;后期暴起。开罪过她的人,箱笼更常被动。
      // 财多招贼:箱笼越沉,她下手越狠——藏银不是无本的买卖。
      r.ming = cap100(r.ming + rint(state.rng, 4, 10));
      const stealP = 0.25 + Math.min(0.25, r.hostility / 200);
      if (f >= 12 && chance(state.rng, stealP) && p.sifang > 0) {
        const steal = Math.min(30 + Math.floor(p.sifang / 500) * 10, p.sifang);
        p.sifang -= steal;
        pushFloat(state, 'ink', '私房', -steal);
        report.notes.push('你房里的箱笼像是被人动过。');
        sighting(state, 'daian', 'chunmei', 'player');
      }
      r.recent = [{ kind: 'zheng' }];
      break;
    }
  }
  // 敌意高且会用谋的对手,可能算计玩家
  if (r.style === 'aggressive' && act2 && r.hostility > 30 && chance(state.rng, 0.3) && !mingDead(state)) {
    p.tiyan = cap100(p.tiyan - 8);
    p.chong = cap100(p.chong - 4);
    pushFloat(state, 'gold', '体面', -8);
    pushFloat(state, 'gold', '宠', -4);
    report.notes.push(`${r.name}在暗处给你使了一回绊子。`);
    sighting(state, 'daian', r.id, 'yue');
  }
}

function pickTarget(state, r) {
  // 潘金莲第30回后把官哥儿母子视为最大威胁;否则盯榜首
  const lb = leaderboard(state).filter((x) => x.id !== r.id && !x.you);
  if (lb.length && chance(state.rng, 0.5)) return state.rivals[lb[0].id];
  const pool = Object.values(state.rivals).filter((x) => x.id !== r.id && x.joined && x.alive && !x.offBoard);
  return pool.length ? pick(state.rng, pool) : r;
}

function rivalScheme(state, r, target, report) {
  if (!target || target.id === r.id) return;
  r.scheme = r.scheme ?? { target: target.id, progress: 0 };
  r.scheme.target = target.id;
  r.scheme.progress += rint(state.rng, 30, 50);
  r.recent = [{ kind: 'scheme', target: target.id }];
  sighting(state, pick(state.rng, ['daian', 'xiaoyu', 'fengmama']), r.id, target.id);
  if (r.scheme.progress >= 100) {
    target.ming = cap100(target.ming - 14);
    r.scheme = null;
    report.notes.push('宅里起了一阵风言风语,有人吃了暗亏。');
  }
}

function sighting(state, servant, from, to) {
  state.sightings.push({ servant, from, to });
}

function settleSchemes(state, report) {
  const p = state.player;
  const done = [];
  for (const s of state.schemes) {
    // 泄密:知情者越多、风声越高,越可能漏
    const leakP = 0.05 * s.informers.length + (p.fengsheng >= 60 ? 0.06 : 0);
    if (chance(state.rng, leakP)) {
      const t = state.rivals[s.target];
      t.hostility += 30;
      p.fengsheng = cap100(p.fengsheng + 18);
      pushFloat(state, 'red', '风声', 18);
      report.notes.push(`${SCHEMES[s.key].name}泄了——知情者里有人把话递了出去。`);
      sighting(state, s.informers[0] ?? 'daian', 'player', s.target);
      done.push(s);
      continue;
    }
    if (s.progress >= 100) {
      const def = SCHEMES[s.key];
      const t = state.rivals[s.target];
      t.ming = cap100(t.ming - def.mingHit);
      t.hostility += 15;
      if (!mingDead(state)) {
        p.tiyan = cap100(p.tiyan + def.selfTiyan);
        pushFloat(state, 'gold', '体面', def.selfTiyan);
      }
      if (def.reveal) report.reveal = { target: s.target, ming: t.ming, si: t.si };
      report.notes.push(`${SCHEMES[s.key].name}成了。`);
      done.push(s);
    }
  }
  state.schemes = state.schemes.filter((s) => !done.includes(s));
}

// ---------- 节令进入效应(入门/亡故/解锁/赠传闻/清零/结局都在节令开始时生效) ----------
function enterFestival(state) {
  const ev = festivalDef(state);
  if (ev.join) for (const id of ev.join) state.rivals[id].joined = true;
  if (ev.dead) for (const id of ev.dead) state.rivals[id].alive = false;
  if (ev.unlockMou) state.flags.mou = true;
  if (ev.grantRumor) makeGrantedRumor(state, ev.grantRumor);
  if (ev.clear) {
    // 第79回明账清零:位分/体面/宠归零,排行榜撤下,公中散尽。
    // 清零前的三值暂存,供演出逐项褪色(体面→宠→位次,三拍)。
    state.flags.lastMing = { tiyan: state.player.tiyan, chong: state.player.chong, rank: state.lastRank };
    state.player.tiyan = 0;
    state.player.chong = 0;
    state.player.gongzhong = 0;
    state.lastRank = null;
  }
  if (ev.ending) state.ending = computeEnding(state);
  state.event = ev;
  state.phase = 'event';
}

// ---------- 推进节令 ----------
function advance(state, report) {
  const p = state.player;
  state.sightings = [];
  for (const r of Object.values(state.rivals)) r.recent = [];
  p.duty = null;
  state.yeTonight = false;
  state.shiTonight = false;
  state.shiTrace = null;
  state.lodgingOverride = null;
  state.visit = null; // 没应声的人,节令一过就自己走了
  if (p.jinzu > 0) p.jinzu -= 1;

  if (state.festival >= 24) {
    state.over = true;
    return;
  }
  state.festival += 1;
  enterFestival(state);
  if (state.event.clear) report.cleared = true;
  if (state.event.ending) report.ending = state.ending;
}

function makeGrantedRumor(state, g) {
  const t = state.rivals[g.target];
  const kind = g.kind ?? (t.recent.length ? t.recent[0].kind : 'calm');
  const text = pick(state.rng, RUMOR_TEXTS[kind] ?? RUMOR_TEXTS.calm)
    .replaceAll('{name}', t.name).replaceAll('{other}', '别');
  state.rumorSeq += 1;
  state.rumors.push({
    id: `r${state.rumorSeq}`, servant: g.servant, target: g.target, kind, text,
    cred: g.cred, truth: g.truth, verified: null, festival: state.festival, granted: true,
  });
}

// ---------- 结局 ----------
// 阶梯按(私房档 × 退路条数)定五档,两条轴都连续起作用:
//  tl≥2 且 si≥高档 → 改嫁李衙内;tl≥1 且 si≥中档 → 归娘家;
//  有路没钱(tl≥1,si<中档) → 投奔不起,守寡留府;无路有钱(tl=0,si≥中档) → 守寡留府;
//  无路无钱 → 遣散流落。发落过且风声未回落者,一切皆空。
export function computeEnding(state) {
  const p = state.player;
  const si = p.sifang, tl = p.tuilu.length, wind = p.fengsheng;
  let key;
  if (p.faluoEver && wind >= ENDING.windHigh) key = 'faluo';
  else if (tl >= 2 && si >= ENDING.siHigh && wind < ENDING.windHigh) key = 'liyanei';
  else if (tl >= 1 && si >= ENDING.siMid) key = 'niangjia';
  else if (tl >= 1 || si >= ENDING.siMid) key = 'shoufu';
  else key = 'liuluo';
  // 耗是暗账的负债项:长期争宠的人,到分家时已经病了,走不远。
  // 耗≥55 出路降一档,≥85 降两档;不推翻发落判定,只削弱出路。
  const DOWN = { liyanei: 'niangjia', niangjia: 'shoufu', shoufu: 'shoufu', liuluo: 'liuluo', faluo: 'faluo' };
  if (p.hao >= HAO.grave) key = DOWN[DOWN[key]];
  else if (p.hao >= HAO.weak) key = DOWN[key];
  return {
    key, sifang: si, tuilu: tl, wind,
    hao: p.hao, haoWeak: p.hao >= HAO.weak,
    bestRank: state.bestRank,
    faluoCount: p.faluoCount,
  };
}

// ---------- 存读 ----------
export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const s = JSON.parse(json);
  if (s.version !== 2) return null;
  return s;
}
