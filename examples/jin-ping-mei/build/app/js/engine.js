// 《风月总账》纯状态引擎：无 DOM、无纯 RNG 路线门槛。

import {
  HEROINE_IDS, HEROINES, DAY_NAMES, DAY_PRESSURE, DAY_ACTIONS,
  OPENING_CHOICES, ROUTE_CHOICES, BANQUET_CHOICES, SCENES, ENDINGS,
} from './data.js';

export const SAVE_VERSION = 3;
export const MAX_DAY = 6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cap100 = (value) => clamp(value, 0, 100);

const makeRel = () => ({ qing: 8, yu: 6, du: 0, ignored: 0, reasons: [] });

export function newGame(seed = 42) {
  const relations = Object.fromEntries(HEROINE_IDS.map((id) => [id, makeRel()]));
  relations.wu_yueniang.qing = 10;
  relations.pan_jinlian.yu = 10;
  return {
    version: SAVE_VERSION,
    seed: Number.isFinite(Number(seed)) ? Number(seed) : 42,
    day: 1,
    phase: 'opening',
    resources: { silver: 180, power: 2, repute: 3, exposure: 0, strain: 0, house: 65 },
    relations,
    secrets: [],
    secretsUsed: [],
    flags: {},
    history: [],
    log: [],
    currentHeroine: null,
    selectedDayAction: null,
    morning: null,
    pendingScene: null,
    sceneReturnPhase: null,
    unlocked: [],
    ending: null,
    over: false,
  };
}

export function dayDef(state) {
  return { day: state.day, name: DAY_NAMES[state.day - 1], pressure: DAY_PRESSURE[state.day - 1] };
}

export function hasToken(state, token) {
  return !!state.flags[token] || state.secrets.includes(token);
}

function addReason(rel, text) {
  rel.reasons.unshift(text);
  rel.reasons = rel.reasons.slice(0, 3);
}

function addSecret(state, id) {
  if (id && !state.secrets.includes(id)) state.secrets.push(id);
}

function removeSecret(state, id) {
  const index = state.secrets.indexOf(id);
  if (index >= 0) state.secrets.splice(index, 1);
}

function addFlag(state, id) {
  if (id) state.flags[id] = true;
}

function changeRel(state, heroineId, delta = {}, reason = '') {
  const rel = state.relations[heroineId];
  if (!rel) return;
  for (const key of ['qing', 'yu', 'du']) {
    if (delta[key]) rel[key] = cap100(rel[key] + delta[key]);
  }
  if (reason && Object.values(delta).some(Boolean)) addReason(rel, reason);
}

function changeResources(state, effects = {}) {
  const r = state.resources;
  if (effects.silver) r.silver = Math.max(0, r.silver + effects.silver);
  if (effects.power) r.power = clamp(r.power + effects.power, 0, 6);
  if (effects.repute) r.repute = clamp(r.repute + effects.repute, 0, 6);
  if (effects.exposure) r.exposure = cap100(r.exposure + effects.exposure);
  if (effects.strain) r.strain = cap100(r.strain + effects.strain);
  if (effects.house) r.house = cap100(r.house + effects.house);
}

function applyEffects(state, effects = {}, currentHeroine = null, reason = '') {
  changeResources(state, effects);
  if (effects.rel && currentHeroine) changeRel(state, currentHeroine, effects.rel, reason);
  if (effects.relAll) {
    for (const [id, delta] of Object.entries(effects.relAll)) changeRel(state, id, delta, reason);
  }
  for (const secret of effects.secrets ?? []) addSecret(state, secret);
  for (const flag of effects.flags ?? []) addFlag(state, flag);
}

function record(state, type, payload = {}) {
  state.history.push({ day: state.day, type, ...payload });
}

export function chooseOpening(state, choiceId) {
  if (state.phase !== 'opening') return { ok: false, error: '正堂这句话已经说过了。' };
  const choice = OPENING_CHOICES.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个选择。' };
  if (choiceId === 'respect_yue') {
    changeRel(state, 'wu_yueniang', { qing: 14, yu: 3 }, '你在正堂把主账权给了她');
    changeRel(state, 'pan_jinlian', { du: 5 }, '你先给了月娘体面');
    changeResources(state, { house: 5, repute: 1 });
    addFlag(state, 'yue_respected');
  } else {
    changeRel(state, 'pan_jinlian', { qing: 10, yu: 16 }, '你在正堂接了她的酒');
    changeRel(state, 'wu_yueniang', { du: 10 }, '你在正堂先接了金莲的酒');
    changeResources(state, { house: -4 });
    addFlag(state, 'pan_promised');
  }
  record(state, 'opening', { choice: choiceId, public: true });
  state.log.push(choice.text);
  state.phase = 'day';
  return { ok: true, text: choice.text };
}

export function dayOptions(state) {
  return Object.values(DAY_ACTIONS).map((option) => {
    let hint = option.description;
    if (option.id === 'office') {
      const usable = usableSecret(state);
      if (usable) hint = `用“${secretName(usable)}”压事；会添暴露。`;
      else if (state.resources.silver < 30) hint = '手里没消息，也拿不出三十两。';
    }
    if (option.id === 'ledger' && state.flags.pinger_same_chest) hint = '瓶儿与你同算，银钱收益更高。';
    return { ...option, hint, disabled: option.id === 'office' && !usableSecret(state) && state.resources.silver < 30 };
  });
}

const RELATIONSHIP_SECRETS = ['merchant_route', 'pan_rumor', 'shop_fraud', 'pinger_funds', 'yue_backing'];
const DAY_SECRETS = [
  'steward_shortfall', 'gate_mood', 'warehouse_key',
  'servant_footsteps', 'banquet_whisper', 'collector_price', 'steward_gap',
];

function usableSecret(state) {
  return [...RELATIONSHIP_SECRETS, ...DAY_SECRETS].find((id) => state.secrets.includes(id)) ?? null;
}

function secretName(id) {
  return ({
    merchant_route: '瓶儿的货路', pan_rumor: '金莲听来的口风', shop_fraud: '掌柜偷货',
    pinger_funds: '瓶儿的私账', yue_backing: '月娘的正堂背书',
    steward_shortfall: '采买短款', gate_mood: '守门人的软处', warehouse_key: '后仓钥匙',
    servant_footsteps: '门外脚步', banquet_whisper: '席上口风', collector_price: '追账人的价码',
    steward_gap: '管事账上的缺口',
  })[id] ?? id;
}

export function chooseDayAction(state, actionId) {
  if (state.phase !== 'day') return { ok: false, error: '眼下不是办白日事的时候。' };
  if (!DAY_ACTIONS[actionId]) return { ok: false, error: '没有这条路。' };
  let text = '';
  const r = state.resources;
  switch (actionId) {
    case 'ledger': {
      const gain = 35 + (state.flags.pinger_same_chest ? 25 : 0) + (state.day === 6 ? 20 : 0);
      changeResources(state, { silver: gain });
      if (state.day === 3) addSecret(state, 'steward_gap');
      text = `账清了一遍，手里多出 ${gain} 两。`;
      break;
    }
    case 'office': {
      const secret = usableSecret(state);
      if (secret) {
        removeSecret(state, secret);
        state.secretsUsed.push(secret);
        changeResources(state, { power: 1, exposure: 12, silver: state.day === 3 ? 45 : 0 });
        text = `你拿“${secretName(secret)}”去说话。事压下了，经手人也记住了你。`;
      } else if (r.silver >= 30) {
        changeResources(state, { silver: -30, power: 1, exposure: 4 });
        text = '三十两递进门，官面松了一层。';
      } else return { ok: false, error: '没消息，也没银子。' };
      break;
    }
    case 'listen': {
      const secret = ['steward_shortfall', 'gate_mood', 'warehouse_key', 'servant_footsteps', 'banquet_whisper', 'collector_price'][state.day - 1];
      addSecret(state, secret);
      changeResources(state, { exposure: 7 });
      text = `消息有了：${({
        steward_shortfall: '短款出在采买', gate_mood: '守门人怕官面', warehouse_key: '赃货藏在后仓',
        servant_footsteps: '昨夜有人停在门外', banquet_whisper: '席上有人等你失约', collector_price: '追账人肯拿消息换银',
      })[secret]}。`;
      break;
    }
    case 'banquet': {
      if (r.silver < 35) return { ok: false, error: '三十五两也摆不出一桌像样的。' };
      changeResources(state, { silver: -35, repute: 1, house: 3 });
      text = '席面备下。花的是银子，买的是当众说话的先手。';
      break;
    }
    default:
      return { ok: false, error: '不识这条路。' };
  }
  state.selectedDayAction = actionId;
  record(state, 'day_action', { action: actionId, text });
  state.log.push(text);
  state.phase = state.day === 5 ? 'banquet' : 'choose_visit';
  return { ok: true, text };
}

export function banquetOptions(state) {
  return BANQUET_CHOICES.map((choice) => ({
    ...choice,
    disabled: choice.id === 'banquet_balance' && (state.flags.broken_pan_word || state.flags.pinger_exposed || state.flags.broken_yue_word),
    locked: choice.id === 'banquet_balance' ? '有人已经在席前抓住你的失约。' : '',
  }));
}

export function chooseBanquet(state, choiceId) {
  if (state.phase !== 'banquet') return { ok: false, error: '还没到开席的时候。' };
  const choice = BANQUET_CHOICES.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个席面选择。' };
  if (choiceId === 'banquet_balance' && (state.flags.broken_pan_word || state.flags.pinger_exposed || state.flags.broken_yue_word)) {
    return { ok: false, error: '你先前失过约，三杯倒得一样也没人信。' };
  }
  applyEffects(state, choice.effects, null, '中秋席上的公开选择');
  record(state, 'banquet', { choice: choiceId, public: true });
  unlockScene(state, 'banquet_conflict');
  state.pendingScene = 'banquet_conflict';
  state.sceneReturnPhase = 'choose_visit';
  state.phase = 'scene';
  state.log.push(choice.text);
  return { ok: true, text: choice.text, scene: 'banquet_conflict' };
}

export function visitChoices(state, heroineId) {
  const rows = ROUTE_CHOICES[heroineId]?.[state.day - 1] ?? [];
  return rows.map((choice) => ({
    ...choice,
    disabled: !!choice.condition && !hasToken(state, choice.condition),
  }));
}

export function startVisit(state, heroineId) {
  if (state.phase !== 'choose_visit') return { ok: false, error: '现在还不能去她屋里。' };
  if (!HEROINE_IDS.includes(heroineId)) return { ok: false, error: '没有这处院门。' };
  state.currentHeroine = heroineId;
  state.phase = 'visit';
  record(state, 'visit_start', { heroine: heroineId, visible: true });
  return { ok: true };
}

export function chooseVisit(state, choiceId) {
  if (state.phase !== 'visit' || !state.currentHeroine) return { ok: false, error: '先选一处院门。' };
  const choice = (ROUTE_CHOICES[state.currentHeroine]?.[state.day - 1] ?? []).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个回应。' };
  if (choice.condition && !hasToken(state, choice.condition)) return { ok: false, error: choice.locked || '前面的话还没接上。' };
  applyEffects(state, choice.effects, state.currentHeroine, choice.text);
  record(state, 'visit_choice', { heroine: state.currentHeroine, choice: choiceId, public: state.day === 5 });
  state.log.push(choice.text);
  state.phase = 'night';
  return { ok: true, text: choice.text };
}

function explicitSceneId(heroineId) {
  return ({ wu_yueniang: 'yue_explicit', pan_jinlian: 'pan_explicit', li_pinger: 'pinger_explicit' })[heroineId];
}

function preludeSceneId(heroineId) {
  return ({ wu_yueniang: 'yue_prelude', pan_jinlian: 'pan_prelude', li_pinger: 'pinger_prelude' })[heroineId];
}

function nightEligibility(state, heroineId) {
  const rel = state.relations[heroineId];
  if (heroineId === 'wu_yueniang') return {
    prelude: rel.qing >= 28 && state.resources.repute >= 3,
    preludeReason: '她还没信你会把正堂当一回事。',
    explicit: rel.qing >= 55 && state.flags.kept_yue_word && state.resources.house >= 50 && !state.flags.broken_yue_word && ['ledger', 'banquet'].includes(state.selectedDayAction),
    explicitReason: '要先守约、稳住宅子；今天还得把账或席面办清。',
  };
  if (heroineId === 'pan_jinlian') return {
    prelude: rel.qing >= 25 && rel.yu >= 40,
    preludeReason: '她还在等你拿一句真话换近一步。',
    explicit: rel.qing >= 40 && rel.yu >= 60 && (state.flags.pan_promised || state.flags.kept_pan_word) && !state.flags.broken_pan_word && state.selectedDayAction === 'listen',
    explicitReason: '她要你先兑现承诺；今天探来的话也得让她参与。',
  };
  return {
    prelude: rel.qing >= 35 && state.flags.pinger_route,
    preludeReason: '她还没把安全与账本一起托给你。',
    explicit: rel.qing >= 55 && state.flags.protected_pinger && !state.flags.pinger_exposed && ['ledger', 'office'].includes(state.selectedDayAction),
    explicitReason: '先护住她的账与秘密；今天还得亲手理账或压事。',
  };
}

export function nightOptions(state) {
  if (!state.currentHeroine) return [];
  const e = nightEligibility(state, state.currentHeroine);
  return [
    { id: 'leave', disabled: false },
    { id: 'talk', disabled: false },
    { id: 'prelude', scene: preludeSceneId(state.currentHeroine), disabled: !e.prelude, locked: e.preludeReason },
    { id: 'explicit', scene: explicitSceneId(state.currentHeroine), disabled: !e.explicit, locked: e.explicitReason },
  ];
}

export function chooseNight(state, actionId) {
  if (state.phase !== 'night' || !state.currentHeroine) return { ok: false, error: '夜里的话还没到这里。' };
  const option = nightOptions(state).find((item) => item.id === actionId);
  if (!option) return { ok: false, error: '没有这个夜间选择。' };
  if (option.disabled) return { ok: false, error: option.locked };
  const heroine = state.currentHeroine;
  let text = '';
  if (actionId === 'leave') {
    changeRel(state, heroine, { qing: 2, du: -5 }, '你在她停下时也停下');
    text = '你替她把门留了一线，没有拿今晚逼下一步。';
  } else if (actionId === 'talk') {
    changeRel(state, heroine, { qing: 8, yu: 6, du: -5 }, '你陪她把话说完');
    text = '更漏过了一声。你没急着走，也没急着往下逼。';
  } else if (actionId === 'prelude') {
    unlockScene(state, option.scene);
    changeRel(state, heroine, { qing: 7, yu: 10, du: -4 }, '你尊重她的意愿，走到更近一步');
    changeResources(state, { strain: 3 });
    state.pendingScene = option.scene;
    state.sceneReturnPhase = 'after_night';
    state.phase = 'scene';
    text = SCENES[option.scene].body;
  } else {
    unlockScene(state, option.scene);
    if (heroine === 'wu_yueniang') {
      changeRel(state, heroine, { qing: 10, yu: 6, du: -8 }, '你守约后在正堂留下');
      changeResources(state, { house: 8, strain: 8 });
      addSecret(state, 'yue_backing');
      addFlag(state, 'yue_morning_help');
    } else if (heroine === 'pan_jinlian') {
      changeRel(state, heroine, { qing: 9, yu: 9, du: -10 }, '你兑现承诺，在花园留下');
      changeResources(state, { strain: 12, exposure: 6 });
      addSecret(state, 'pan_rumor');
      addFlag(state, 'pan_morning_claim');
    } else {
      changeRel(state, heroine, { qing: 12, yu: 6, du: -8 }, '你先护住她，才在私院留下');
      changeResources(state, { house: 4, strain: 8 });
      addSecret(state, 'merchant_route');
      addFlag(state, 'pinger_morning_route');
    }
    for (const other of HEROINE_IDS.filter((id) => id !== heroine)) {
      changeRel(state, other, { du: 9 }, `她知道你昨夜留在${HEROINES[heroine].house}`);
    }
    state.pendingScene = option.scene;
    state.sceneReturnPhase = 'after_night';
    state.phase = 'scene';
    text = SCENES[option.scene].body;
  }
  record(state, 'night', { heroine, action: actionId, scene: option.scene ?? null, visible: actionId !== 'leave' });
  state.log.push(text);
  if (!option.scene) advanceAfterNight(state);
  return { ok: true, text, scene: option.scene ?? null };
}

function unlockScene(state, sceneId) {
  if (!SCENES[sceneId]) throw new Error(`未知场景 ${sceneId}`);
  if (!state.unlocked.includes(sceneId)) state.unlocked.push(sceneId);
}

export function closeScene(state) {
  if (state.phase !== 'scene' || !state.pendingScene) return { ok: false, error: '没有待收的册页。' };
  const next = state.sceneReturnPhase;
  state.pendingScene = null;
  state.sceneReturnPhase = null;
  if (next === 'choose_visit') {
    state.phase = 'choose_visit';
  } else {
    advanceAfterNight(state);
  }
  return { ok: true };
}

function advanceAfterNight(state) {
  const visited = state.currentHeroine;
  for (const id of HEROINE_IDS) {
    const rel = state.relations[id];
    if (id === visited) rel.ignored = 0;
    else {
      rel.ignored += 1;
      const rise = state.history.at(-1)?.action === 'leave' ? 2 : 5;
      rel.du = cap100(rel.du + rise);
      addReason(rel, `你第${state.day}日去了${HEROINES[visited].house}`);
    }
  }
  state.currentHeroine = null;
  state.selectedDayAction = null;
  if (state.day >= MAX_DAY) {
    state.ending = determineEnding(state);
    state.phase = 'ending';
    state.over = true;
    return;
  }
  state.day += 1;
  state.morning = buildMorning(state, visited);
  state.phase = 'morning';
}

function buildMorning(state, visited) {
  const candidates = HEROINE_IDS.filter((id) => id !== visited).sort((a, b) => state.relations[b].du - state.relations[a].du);
  const actor = candidates[0];
  const rel = state.relations[actor];
  if (state.day === 3 && state.flags.yue_respected && !state.flags.yue_delayed_paid) {
    return {
      id: 'yue_delayed', actor: 'wu_yueniang', tone: 'backing',
      title: '两日前的话有了回音',
      text: '月娘把采买短款的名字压在账下：“你那日给我体面，今日我替你把人叫来。”',
    };
  }
  if (state.flags.yue_morning_help && !state.flags.yue_help_paid) {
    return {
      id: 'yue_help', actor: 'wu_yueniang', tone: 'backing',
      title: '正堂先替你挡了一桩',
      text: '月娘已经把催账人请到正堂：“昨夜的话我记得。外头这笔，今日一同办。”',
    };
  }
  if (state.flags.pinger_morning_route && !state.flags.pinger_route_paid) {
    return { id: 'pinger_help', actor: 'li_pinger', tone: 'backing', title: '瓶儿送来货路', text: '瓶儿把一张货单压在茶盘下。城门那桩事，今天可以不花银。' };
  }
  if (state.flags.pan_morning_claim && !state.flags.pan_claim_paid) {
    return { id: 'pan_claim', actor: 'pan_jinlian', tone: 'jealous', title: '金莲来收一句话', text: '金莲天一亮就来：“昨夜说得热。今日在人前，也别装不认。”' };
  }
  if (rel.du >= 18) {
    return {
      id: 'jealousy', actor, tone: 'jealous',
      title: `${HEROINES[actor].short}来敲门`,
      text: `${HEROINES[actor].name}知道你昨夜去了${HEROINES[visited].house}。她不要一个数字，要你当面接住这件事。`,
    };
  }
  return {
    id: 'quiet', actor: visited, tone: 'quiet', title: '天亮了',
    text: `昨夜的门已经关上。${HEROINES[visited].name}记得你做了什么，另外两处院门也记得你没去。`,
  };
}

export function morningOptions(state) {
  if (state.phase !== 'morning' || !state.morning) return [];
  if (state.morning.id === 'jealousy' || state.morning.id === 'pan_claim') return [
    { id: 'appease', label: '哄住她', hint: '花二十两，把原因说开', disabled: state.resources.silver < 20 },
    { id: 'explain', label: '把话说明', hint: '少降妒，多一点暴露' },
    { id: 'stand', label: '不改昨夜选择', hint: '她更酸，你守住原决定' },
  ];
  return [
    { id: 'accept', label: '接住这份情', hint: '让这次回响进入今天的局面' },
    { id: 'note', label: '先记在账上', hint: '不加码，只继续' },
  ];
}

export function resolveMorning(state, choiceId) {
  if (state.phase !== 'morning' || !state.morning) return { ok: false, error: '眼下没人来敲门。' };
  const event = state.morning;
  const actor = event.actor;
  if (event.id === 'jealousy' || event.id === 'pan_claim') {
    if (!['appease', 'explain', 'stand'].includes(choiceId)) return { ok: false, error: '她还在等你的回答。' };
    if (choiceId === 'appease') {
      if (state.resources.silver < 20) return { ok: false, error: '手里连哄人的二十两都没有。' };
      changeResources(state, { silver: -20, house: 3 });
      changeRel(state, actor, { qing: 4, du: -18 }, '你当面把昨夜说开');
    } else if (choiceId === 'explain') {
      changeResources(state, { exposure: 5 });
      changeRel(state, actor, { qing: 2, du: -10 }, '你把昨夜的来龙去脉说给她听');
    } else {
      changeResources(state, { house: -3 });
      changeRel(state, actor, { du: 10 }, '你没有改昨夜的选择');
    }
    if (event.id === 'pan_claim') addFlag(state, 'pan_claim_paid');
  } else if (event.id === 'yue_delayed') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '先接下正堂这句话。' };
    if (choiceId === 'accept') {
      addSecret(state, 'yue_backing');
      changeRel(state, 'wu_yueniang', { qing: 6, du: -6 }, '两日前的尊重换来今日背书');
      changeResources(state, { house: 5 });
    }
    addFlag(state, 'yue_delayed_paid');
  } else if (event.id === 'yue_help') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '正堂还在等你接这笔账。' };
    if (choiceId === 'accept') {
      addSecret(state, 'yue_backing');
      changeRel(state, 'wu_yueniang', { qing: 4, du: -5 }, '月娘把昨夜的共同承诺带进白日');
      changeResources(state, { house: 4 });
    }
    addFlag(state, 'yue_help_paid');
  } else if (event.id === 'pinger_help') {
    if (choiceId === 'accept') addSecret(state, 'merchant_route');
    addFlag(state, 'pinger_route_paid');
  }
  record(state, 'morning', { event: event.id, actor, choice: choiceId });
  state.log.push(event.text);
  state.morning = null;
  state.phase = 'day';
  return { ok: true, text: event.text };
}

export function relationTier(value, kind) {
  if (kind === 'qing') return value >= 60 ? '知心' : value >= 30 ? '亲近' : '生疏';
  if (kind === 'yu') return value >= 60 ? '主动' : value >= 30 ? '发热' : '克制';
  return value >= 70 ? '要翻脸' : value >= 30 ? '发酸' : '平静';
}

export function determineEnding(state) {
  const explicitByHeroine = Object.fromEntries(HEROINE_IDS.map((id) => [id, state.unlocked.includes(explicitSceneId(id))]));
  const qing = Object.fromEntries(HEROINE_IDS.map((id) => [id, state.relations[id].qing]));
  const sorted = HEROINE_IDS.slice().sort((a, b) => qing[b] - qing[a]);
  const top = sorted[0];
  let id = 'unstable';
  if (HEROINE_IDS.every((heroine) => qing[heroine] >= 30 && state.relations[heroine].du < 70) && state.resources.house >= 45 && state.flags.banquet_balanced) {
    id = 'balanced';
  } else if (qing[top] >= 60 && explicitByHeroine[top] && sorted.slice(1).every((heroine) => qing[heroine] < 50)) {
    id = 'exclusive';
  } else if (state.secretsUsed.length >= 2 && (state.resources.power >= 4 || state.resources.silver >= 250) && state.resources.exposure >= 25) {
    id = 'intrigue';
  }
  const routeResult = id === 'exclusive' ? ({
    wu_yueniang: state.flags.yue_co_rule ? '共掌一宅' : '一院灯深',
    pan_jinlian: state.flags.pan_open_choice ? '火里同谋' : '话已算数',
    li_pinger: state.flags.pinger_same_chest ? '同箱共命' : '钥匙未收',
  })[top] : null;
  return {
    id,
    ...ENDINGS[id],
    routeResult,
    heroine: id === 'exclusive' ? top : null,
    heroineName: id === 'exclusive' ? HEROINES[top].name : null,
    resources: { ...state.resources },
    relations: structuredClone(state.relations),
    unlocked: [...state.unlocked],
    unseen: Object.keys(SCENES).filter((sceneId) => !state.unlocked.includes(sceneId)),
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(raw) {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (state?.version !== SAVE_VERSION || !HEROINE_IDS.every((id) => state.relations?.[id])) return null;
    return state;
  } catch {
    return null;
  }
}

export function snapshot(state) {
  return structuredClone(state);
}

export function sceneIsAdultSafe(scene) {
  return !!scene && scene.participants.every((id) => HEROINE_IDS.includes(id));
}
