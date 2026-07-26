// 《风月总账》纯状态引擎：无 DOM、无纯 RNG 路线门槛。

import {
  HEROINE_IDS, HEROINES, HOUSEHOLD_IDS, HOUSEHOLD, HOUSEHOLD_EVENTS,
  DAY_NAMES, DAY_PRESSURE, DAY_ACTIONS,
  OPENING_CHOICES, ROUTE_CHOICES, BANQUET_CHOICES, SCENES, ENDINGS,
} from './data.js';

export const SAVE_VERSION = 4;
export const MAX_DAY = 6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cap100 = (value) => clamp(value, 0, 100);

const makeRel = () => ({ qing: 8, yu: 6, du: 0, ignored: 0, reasons: [] });
const makeHousehold = () => Object.fromEntries(HOUSEHOLD_IDS.map((id) => [id, { regard: 0, reasons: [] }]));

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
    household: makeHousehold(),
    secrets: [],
    secretsUsed: [],
    flags: {},
    history: [],
    log: [],
    currentHeroine: null,
    selectedDayAction: null,
    currentHouseholdEvent: null,
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

function changeHousehold(state, effect, reason = '') {
  if (!effect?.id || !state.household?.[effect.id]) return;
  const row = state.household[effect.id];
  row.regard = clamp(row.regard + (effect.regard ?? 0), -100, 100);
  if (reason && effect.regard) {
    row.reasons.unshift(reason);
    row.reasons = row.reasons.slice(0, 2);
  }
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
  if (effects.household) changeHousehold(state, effects.household, reason);
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
    changeRel(state, 'wu_yueniang', { qing: 14, yu: 3 }, '正堂那日，你把账交给了她');
    changeRel(state, 'pan_jinlian', { du: 5 }, '正堂那杯酒，你先晾了她');
    changeResources(state, { house: 5, repute: 1 });
    addFlag(state, 'yue_respected');
  } else {
    changeRel(state, 'pan_jinlian', { qing: 10, yu: 16 }, '正堂那日，你喝了她递来的酒');
    changeRel(state, 'wu_yueniang', { du: 10 }, '她守着账，你却先喝了金莲的酒');
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
      if (usable) hint = `拿${secretName(usable)}去说话；这条人情会见光。`;
      else if (state.resources.silver < 30) hint = '没话可递，手里也凑不出三十两。';
    }
    if (option.id === 'ledger' && state.flags.pinger_same_chest) hint = '瓶儿已经摊开她的账，这回能多追回一些。';
    return { ...option, hint, disabled: option.id === 'office' && !usableSecret(state) && state.resources.silver < 30 };
  });
}

const RELATIONSHIP_SECRETS = [
  'merchant_route', 'pan_rumor', 'shop_fraud', 'pinger_funds', 'yue_backing',
  'meng_favor', 'kitchen_witness',
];
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
    meng_favor: '玉楼递过的名帖', kitchen_witness: '雪娥在后仓看见的事',
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
      text = `你把账翻过一遍，追回 ${gain} 两。`;
      break;
    }
    case 'office': {
      const secret = usableSecret(state);
      if (secret) {
        removeSecret(state, secret);
        state.secretsUsed.push(secret);
        changeResources(state, { power: 1, exposure: 12, silver: state.day === 3 ? 45 : 0 });
        text = `你把${secretName(secret)}递给门里的人。事情办了，你的名字也跟着传了进去。`;
      } else if (r.silver >= 30) {
        changeResources(state, { silver: -30, power: 1, exposure: 4 });
        text = '三十两递进去，守门人总算让开。';
      } else return { ok: false, error: '没话可递，也没银子可送。' };
      break;
    }
    case 'listen': {
      const secret = ['steward_shortfall', 'gate_mood', 'warehouse_key', 'servant_footsteps', 'banquet_whisper', 'collector_price'][state.day - 1];
      addSecret(state, secret);
      changeResources(state, { exposure: 7 });
      text = `你问到一句准话：${({
        steward_shortfall: '短款出在采买', gate_mood: '守门人怕官面', warehouse_key: '赃货藏在后仓',
        servant_footsteps: '昨夜有人停在门外', banquet_whisper: '席上有人等你失约', collector_price: '追账人肯拿消息换银',
      })[secret]}。`;
      break;
    }
    case 'banquet': {
      if (r.silver < 35) return { ok: false, error: '三十五两也摆不出一桌像样的。' };
      changeResources(state, { silver: -35, repute: 1, house: 3 });
      text = '席面订下，先付三十五两。等人坐齐，你才好开口。';
      break;
    }
    default:
      return { ok: false, error: '不识这条路。' };
  }
  state.selectedDayAction = actionId;
  record(state, 'day_action', { action: actionId, text });
  state.log.push(text);
  const householdEvent = HOUSEHOLD_EVENTS[state.day];
  if (householdEvent) {
    state.currentHouseholdEvent = householdEvent.id;
    state.phase = 'household';
  } else {
    state.phase = state.day === 5 ? 'banquet' : 'choose_visit';
  }
  return { ok: true, text };
}

export function currentHouseholdEvent(state) {
  const event = HOUSEHOLD_EVENTS[state.day];
  return event?.id === state.currentHouseholdEvent ? event : null;
}

export function householdOptions(state) {
  if (state.phase !== 'household') return [];
  return currentHouseholdEvent(state)?.choices.map((choice) => ({
    ...choice,
    disabled: choice.id === 'jiaoer_buy_name' && state.resources.silver < 20,
  })) ?? [];
}

export function resolveHouseholdEvent(state, choiceId) {
  if (state.phase !== 'household') return { ok: false, error: '廊下这句话已经说过去了。' };
  const event = currentHouseholdEvent(state);
  if (!event) return { ok: false, error: '眼下没有人在这里等你。' };
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '她没听懂你这句话。' };
  if (choice.id === 'jiaoer_buy_name' && state.resources.silver < 20) {
    return { ok: false, error: '二十两凑不齐，娇儿连匣子都没打开。' };
  }
  applyEffects(state, choice.effects, null, choice.text);
  record(state, 'household', { event: event.id, actor: event.actor, choice: choice.id });
  state.log.push(choice.text);
  state.currentHouseholdEvent = null;
  state.phase = state.day === 5 ? 'banquet' : 'choose_visit';
  return { ok: true, text: choice.text };
}

export function banquetOptions(state) {
  return BANQUET_CHOICES.map((choice) => ({
    ...choice,
    disabled: choice.id === 'banquet_balance' && (state.flags.broken_pan_word || state.flags.pinger_exposed || state.flags.broken_yue_word),
    locked: choice.id === 'banquet_balance' ? '先前有人被你晾过，这三杯斟得再齐也没人肯信。' : '',
  }));
}

export function chooseBanquet(state, choiceId) {
  if (state.phase !== 'banquet') return { ok: false, error: '还没到开席的时候。' };
  const choice = BANQUET_CHOICES.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个席面选择。' };
  if (choiceId === 'banquet_balance' && (state.flags.broken_pan_word || state.flags.pinger_exposed || state.flags.broken_yue_word)) {
    return { ok: false, error: '先前有人被你晾过。这三杯斟得再齐，也没人肯喝。' };
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
    preludeReason: '你在人前还没给够她正堂的脸。',
    explicit: rel.qing >= 55 && state.flags.kept_yue_word && state.resources.house >= 50 && !state.flags.broken_yue_word && ['ledger', 'banquet'].includes(state.selectedDayAction),
    explicitReason: '先办成答应她的事。今日的账或席面，也得收拾干净。',
  };
  if (heroineId === 'pan_jinlian') return {
    prelude: rel.qing >= 25 && rel.yu >= 40,
    preludeReason: '她还等着一句不躲闪的真话。',
    explicit: rel.qing >= 40 && rel.yu >= 60 && (state.flags.pan_promised || state.flags.kept_pan_word) && !state.flags.broken_pan_word && state.selectedDayAction === 'listen',
    explicitReason: '先还她那杯酒。今日问来的口风，也别瞒着她。',
  };
  return {
    prelude: rel.qing >= 35 && state.flags.pinger_route,
    preludeReason: '那本账，她还没敢交到你手里。',
    explicit: rel.qing >= 55 && state.flags.protected_pinger && !state.flags.pinger_exposed && ['ledger', 'office'].includes(state.selectedDayAction),
    explicitReason: '先替她守住那本账。今日的外债，也得亲手办妥。',
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
    changeRel(state, heroine, { qing: 2, du: -5 }, '她停下时，你没有再往前');
    text = '你替她掩好衣襟，起身时没有闩死房门。';
  } else if (actionId === 'talk') {
    changeRel(state, heroine, { qing: 8, yu: 6, du: -5 }, '你留下来听她把话说完');
    text = '更漏响过一声，你仍坐在原处。她又替你添了半盏茶。';
  } else if (actionId === 'prelude') {
    unlockScene(state, option.scene);
    changeRel(state, heroine, { qing: 7, yu: 10, du: -4 }, '她点头以后，你才靠近');
    changeResources(state, { strain: 3 });
    state.pendingScene = option.scene;
    state.sceneReturnPhase = 'after_night';
    state.phase = 'scene';
    text = SCENES[option.scene].body;
  } else {
    unlockScene(state, option.scene);
    if (heroine === 'wu_yueniang') {
      changeRel(state, heroine, { qing: 10, yu: 6, du: -8 }, '答应她的事办成后，你留在正堂');
      changeResources(state, { house: 8, strain: 8 });
      addSecret(state, 'yue_backing');
      addFlag(state, 'yue_morning_help');
    } else if (heroine === 'pan_jinlian') {
      changeRel(state, heroine, { qing: 9, yu: 9, du: -10 }, '你还了她那杯酒，留在花园角门');
      changeResources(state, { strain: 12, exposure: 6 });
      addSecret(state, 'pan_rumor');
      addFlag(state, 'pan_morning_claim');
    } else {
      changeRel(state, heroine, { qing: 12, yu: 6, du: -8 }, '你先护住她的账，才在私院留下');
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
      title: '两日前那句话，月娘还记着',
      text: '月娘把一张名单压在账簿下：“采买短款的人，我叫到正堂了。你自己来问。”',
    };
  }
  if (state.flags.yue_morning_help && !state.flags.yue_help_paid) {
    return {
      id: 'yue_help', actor: 'wu_yueniang', tone: 'backing',
      title: '催账人先被请去了正堂',
      text: '月娘早已叫人添茶：“外头那笔账，我先替你留住人。官人洗把脸再来。”',
    };
  }
  if (state.flags.pinger_morning_route && !state.flags.pinger_route_paid) {
    return { id: 'pinger_help', actor: 'li_pinger', tone: 'backing', title: '茶盘下压着一张货单', text: '瓶儿把茶放下，小声道：“拿这张去城门，别再送那三十两。”' };
  }
  if (state.flags.pan_morning_claim && !state.flags.pan_claim_paid) {
    return { id: 'pan_claim', actor: 'pan_jinlian', tone: 'jealous', title: '金莲天亮就堵在门口', text: '金莲扶着门框：“昨夜叫得那样亲。怎么见了日头，官人又不认得我了？”' };
  }
  if (rel.du >= 18) {
    return {
      id: 'jealousy', actor, tone: 'jealous',
      title: `${HEROINES[actor].short}来敲门`,
      text: `${HEROINES[actor].name}朝${HEROINES[visited].house}那边看了一眼：“昨夜那扇门，关得可真早。”`,
    };
  }
  return {
    id: 'quiet', actor: visited, tone: 'quiet', title: '天亮了',
    text: `${HEROINES[visited].name}叫人送来一盏醒酒茶。另两处院门还没开，廊下倒已经有人走过两趟。`,
  };
}

export function morningOptions(state) {
  if (state.phase !== 'morning' || !state.morning) return [];
  if (state.morning.id === 'jealousy' || state.morning.id === 'pan_claim') return [
    { id: 'appease', label: '带她去挑首饰', hint: '花二十两，先让她把门让开', disabled: state.resources.silver < 20 },
    { id: 'explain', label: '关门跟她说', hint: '院里会猜，至少她能听见实话' },
    { id: 'stand', label: '由她生气', hint: '你不改口，这两日也别指望她消气' },
  ];
  return [
    { id: 'accept', label: '把东西收下', hint: '她肯帮，你也当面领这份情' },
    { id: 'note', label: '只道一声知道了', hint: '不欠新话，照旧办今日的事' },
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
      changeRel(state, actor, { qing: 4, du: -18 }, '你带她出去挑了一件东西');
    } else if (choiceId === 'explain') {
      changeResources(state, { exposure: 5 });
      changeRel(state, actor, { qing: 2, du: -10 }, '你关上门，把昨夜的去处说清了');
    } else {
      changeResources(state, { house: -3 });
      changeRel(state, actor, { du: 10 }, '你由她生气，也没有改口');
    }
    if (event.id === 'pan_claim') addFlag(state, 'pan_claim_paid');
  } else if (event.id === 'yue_delayed') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '先接下正堂这句话。' };
    if (choiceId === 'accept') {
      addSecret(state, 'yue_backing');
      changeRel(state, 'wu_yueniang', { qing: 6, du: -6 }, '两日前交给她的账，今日替你找出了人');
      changeResources(state, { house: 5 });
    }
    addFlag(state, 'yue_delayed_paid');
  } else if (event.id === 'yue_help') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '正堂还在等你接这笔账。' };
    if (choiceId === 'accept') {
      addSecret(state, 'yue_backing');
      changeRel(state, 'wu_yueniang', { qing: 4, du: -5 }, '月娘替你把催账人留在正堂');
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

export function householdTier(regard) {
  if (regard >= 15) return '肯替你说话';
  if (regard <= -15) return '把这笔记下了';
  return '还在看你';
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
    householdResults: HOUSEHOLD_IDS.map((householdId) => ({
      id: householdId,
      name: HOUSEHOLD[householdId].name,
      result: householdTier(state.household[householdId].regard),
      regard: state.household[householdId].regard,
    })),
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
    if (!HEROINE_IDS.every((id) => state?.relations?.[id])) return null;
    if (state.version === 3) {
      state.version = SAVE_VERSION;
      state.household = makeHousehold();
      state.currentHouseholdEvent = null;
    }
    if (state.version !== SAVE_VERSION || !HOUSEHOLD_IDS.every((id) => state.household?.[id])) return null;
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
