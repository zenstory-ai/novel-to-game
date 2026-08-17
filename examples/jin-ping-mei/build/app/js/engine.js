// 《风月总账》纯状态引擎：无 DOM、无纯 RNG 路线门槛。

import {
  HEROINE_IDS, HEROINES, HOUSEHOLD_IDS, HOUSEHOLD, HOUSEHOLD_EVENTS,
  DAY_NAMES, DAY_PRESSURE, DAY_ACTIONS,
  OPENING_CHOICES, ROUTE_CHOICES, ACCORD_CHOICES, JOINT_ACTIONS, SHARED_NIGHT_CHOICES,
  BANQUET_CHOICES, SCENES, ENDINGS,
} from './data.js';

export const SAVE_VERSION = 10;
export const ACCORD_KEYS = Object.freeze(['order', 'truth', 'safety']);
export const JOINT_ACTION_TARGET = 2;
const JOINT_ACTION_IDS = new Set(JOINT_ACTIONS.map((choice) => choice.id));
const SAVE_PHASES = new Set([
  'opening', 'morning', 'day', 'joint_result', 'household', 'banquet',
  'choose_visit', 'visit', 'night', 'scene', 'shared_night', 'ending',
]);
const MORNING_EVENT_IDS = new Set(['jealousy', 'pan_claim', 'yue_delayed', 'yue_help', 'pinger_help', 'quiet']);
const RESOURCE_KEYS = Object.freeze(['silver', 'power', 'repute', 'exposure', 'strain', 'house']);

// 破裂规则(GAME_DESIGN 第 5 节「拒绝／破裂」):公开越过她两次、或宅门 house<30,
// 路线冷却一天。此前实现用单次失信旗标永久锁死明确场景,既漏了计数与 house 触发,
// 也把「冷却」做成了「永久」——独立 QA 记为 F1。
export const BREAK_OVERRIDE_LIMIT = 2;
export const BREAK_HOUSE_FLOOR = 30;
// 公开越过对应的旗标:每次置位记一次越过。
const OVERRIDE_FLAG_TO_HEROINE = Object.freeze({
  broken_yue_word: 'wu_yueniang',
  broken_pan_word: 'pan_jinlian',
  pinger_exposed: 'li_pinger',
});

// 身体耗损的读取点(F2):`strain` 原先只写不读,常驻 HUD 的代价条一局都不结账。
// 现在它决定次日撑不撑得起需要露面的场面,并在休息之夜回落——代价条会结账,
// 但不锁死任何一条深线的内容。
export const STRAIN_STRAINED = 30;   // 撑不起「走官面 / 整席面」
export const STRAIN_REST_RELIEF = 6; // 不进亲密场景的一夜回落
// 曝光的读取点(F3):它不是权谋结局的奖励门,是每日结转开始咬人的代价条。
// 三档:传过街(封口钱) → 传进院(全员妒) → 进了别人的账(官面与三杯同斟关门)。
export const EXPOSURE_STREET = 25;
export const EXPOSURE_HOUSEHOLD = 40;
export const EXPOSURE_LEDGERED = 55;
export const MAX_DAY = 6;
// 宅中用度(银钱经济收紧):家声越高,日子越贵。每日结转扣一笔,次晨报在现场画面上;
// 银子不够扣到 0 为止,摆不起的场面自己塌——宅门与家声跟着掉,不许出现负银。
export const UPKEEP_BASE = 6;
export const UPKEEP_PER_REPUTE = 3;
// 第 4 日催账硬到期:第 3 日晨间先给一句可见口风,第 4 日结转时收账,不是无预告的惩罚。
export const COLLECTOR_WARNING_DAY = 3;
export const COLLECTOR_DUE_DAY = 4;
export const COLLECTOR_PRICE = 40;
// 安抚按妒分档:妒越拖越贵,按钮要报当前实价,不写死「二十两」。
export const APPEASE_BASE = 20;
export const APPEASE_DU_FLOOR = 40;
// 权谋收束的银钱门槛:收紧后的实测值(test/bench_silver.mjs,实测记录见 GAME_DESIGN 第 10 节)——
// 不用资源侧选项实测封顶 181,全采封顶 350;240 要求至少为银子动一处真格的。
export const INTRIGUE_SILVER = 240;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cap100 = (value) => clamp(value, 0, 100);

// 银钱在市井文案里用汉字报数:十五两、四十两。
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function silverText(n) {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return `十${CN_NUM[n - 10]}`;
  const ones = n % 10;
  return `${CN_NUM[Math.floor(n / 10)]}十${ones ? CN_NUM[ones] : ''}`;
}

// 安抚实价:妒过四十两起步价之后,每多一点妒加一两。
export function appeaseCost(state, heroineId) {
  return APPEASE_BASE + Math.max(0, (state.relations[heroineId]?.du ?? 0) - APPEASE_DU_FLOOR);
}

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
    resources: { silver: 120, power: 2, repute: 3, exposure: 0, strain: 0, house: 65 },
    relations,
    household: makeHousehold(),
    secrets: [],
    secretsUsed: [],
    flags: {},
    publicOverrides: { wu_yueniang: 0, pan_jinlian: 0, li_pinger: 0 },
    routeReopensOn: { wu_yueniang: 0, pan_jinlian: 0, li_pinger: 0 },
    // 每名女主的个人弧线按「她的第几次」走,不按日历天——
    // 轮换顺序不再把任何人的好选项锁死(设计评审 §3)。
    visits: Object.fromEntries(HEROINE_IDS.map((id) => [id, 0])),
    accords: { order: false, truth: false, safety: false },
    jointActions: [],
    history: [],
    log: [],
    currentHeroine: null,
    selectedDayAction: null,
    currentHouseholdEvent: null,
    morning: null,
    pendingScene: null,
    sceneReturnPhase: null,
    sharedNightChoice: null,
    currentJointAction: null,
    unlocked: [],
    ending: null,
    over: false,
  };
}

export function dayDef(state) {
  let pressure = DAY_PRESSURE[state.day - 1];
  // 话传出了这条街:曝光的头一档后果,每天都让玩家看见它在扣钱。
  if (state.resources.exposure >= EXPOSURE_STREET) {
    pressure = `门房今早又打发走一个来打听的。${pressure}`;
  }
  return { day: state.day, name: DAY_NAMES[state.day - 1], pressure };
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
  if (!id) return;
  state.flags[id] = true;
  const heroine = OVERRIDE_FLAG_TO_HEROINE[id];
  if (heroine) {
    state.publicOverrides[heroine] = (state.publicOverrides[heroine] ?? 0) + 1;
    evaluateBreak(state, heroine);
  }
}

// 破裂判定:公开越过达上限、或宅门跌破下限。触发则该路线冷却一天(次日重开),
// 不是永久锁死。house 跌破会同时冷却全部三条线——正堂不稳时谁都不肯留门。
export function evaluateBreak(state, heroineId) {
  const overrides = state.publicOverrides[heroineId] ?? 0;
  if (overrides < BREAK_OVERRIDE_LIMIT) return false;
  state.routeReopensOn[heroineId] = state.day + 1;
  record(state, 'route_break', { heroine: heroineId, cause: 'overrides', overrides });
  return true;
}

export function evaluateHouseBreak(state) {
  if (state.resources.house >= BREAK_HOUSE_FLOOR) return;
  for (const id of HEROINE_IDS) {
    if (state.routeReopensOn[id] > state.day) continue;
    state.routeReopensOn[id] = state.day + 1;
  }
  record(state, 'route_break', { heroine: null, cause: 'house', house: state.resources.house });
}

// 路线是否在冷却中。旧档缺这两个字段时按「未冷却」回退,不影响读档。
export function routeCooling(state, heroineId) {
  return (state.routeReopensOn?.[heroineId] ?? 0) > state.day;
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
  if (effects.strain) r.strain = clamp(r.strain + effects.strain, 0, 100);
  if (effects.house) r.house = cap100(r.house + effects.house);
  if (effects.house && state.routeReopensOn) evaluateHouseBreak(state);
}

function applyEffects(state, effects = {}, currentHeroine = null, reason = '') {
  changeResources(state, effects);
  if (effects.rel && currentHeroine) changeRel(state, currentHeroine, effects.rel, reason);
  if (effects.relAll) {
    for (const [id, delta] of Object.entries(effects.relAll)) changeRel(state, id, delta, reason);
  }
  if (effects.household) changeHousehold(state, effects.household, reason);
  if (effects.accord && ACCORD_KEYS.includes(effects.accord)) state.accords[effects.accord] = true;
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
    // 曝光第三档:官面上有人记了你一笔,走官面这条路今日关上。
    const ledgered = option.id === 'office' && state.resources.exposure >= EXPOSURE_LEDGERED;
    if (option.id === 'office') {
      const usable = usableSecret(state);
      if (ledgered) hint = '你的名字已经进了别人的账。今日递不进去话。';
      else if (usable) hint = `拿${secretName(usable)}去说话；这条人情会见光。`;
      else if (state.resources.silver < 30) hint = '没话可递，手里也凑不出三十两。';
    }
    if (option.id === 'ledger' && state.flags.pinger_same_chest) hint = '瓶儿已经摊开她的账，这回能多追回一些。';
    // 身体耗损的读取点:需要露面撑场的两条路,撑不住就走不了(F2)。
    const strained = state.resources.strain >= STRAIN_STRAINED && ['office', 'banquet'].includes(option.id);
    if (strained) hint = '昨夜撑得太狠，今日撑不起这个场面。';
    return {
      ...option,
      hint,
      disabled: strained || ledgered || (option.id === 'office' && !usableSecret(state) && state.resources.silver < 30),
    };
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
      const gain = 22 + (state.flags.pinger_same_chest ? 16 : 0) + (state.day === 6 ? 12 : 0);
      changeResources(state, { silver: gain });
      if (state.day === 3) addSecret(state, 'steward_gap');
      text = `你把账翻过一遍，追回 ${gain} 两。`;
      break;
    }
    case 'office': {
      if (r.exposure >= EXPOSURE_LEDGERED) return { ok: false, error: '你的名字已经进了别人的账。今日递不进去话。' };
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
  advanceAfterDayAction(state);
  return { ok: true, text };
}

function advanceAfterDayAction(state) {
  const householdEvent = HOUSEHOLD_EVENTS[state.day];
  if (householdEvent) {
    state.currentHouseholdEvent = householdEvent.id;
    state.phase = 'household';
  } else {
    state.phase = state.day === 5 ? 'banquet' : 'choose_visit';
  }
}

export function jointActionOptions(state) {
  const completed = completedJointActions(state);
  return JOINT_ACTIONS.map((choice) => {
    const missing = choice.requires.filter((key) => !state.accords?.[key]);
    const used = completed.has(choice.id);
    return {
      ...choice,
      disabled: state.phase !== 'day' || used || missing.length > 0,
      locked: used
        ? '这一组已经合办过一桩，不再重复刷同一件事。'
        : missing.length
          ? `还缺院约：${missing.map((key) => accordStatus(state).find((row) => row.key === key)?.label).join('、')}。`
          : '',
    };
  });
}

function completedJointActions(state) {
  return new Set((state.jointActions ?? []).filter((id) => JOINT_ACTION_IDS.has(id)));
}

export function jointActionCount(state) {
  return completedJointActions(state).size;
}

export function chooseJointAction(state, actionId) {
  if (state.phase !== 'day') return { ok: false, error: '眼下不是合办差事的时候。' };
  const choice = jointActionOptions(state).find((item) => item.id === actionId);
  if (!choice) return { ok: false, error: '没有这桩联院差事。' };
  if (choice.disabled) return { ok: false, error: choice.locked };
  applyEffects(state, choice.effects, null, choice.text);
  state.jointActions.push(choice.id);
  state.selectedDayAction = choice.id;
  state.currentJointAction = choice.id;
  record(state, 'joint_action', { action: choice.id, participants: [...choice.participants] });
  state.log.push(choice.text);
  state.phase = 'joint_result';
  return { ok: true, text: choice.text };
}

export function currentJointAction(state) {
  return JOINT_ACTIONS.find((choice) => choice.id === state.currentJointAction) ?? null;
}

export function continueJointAction(state) {
  if (state.phase !== 'joint_result' || !currentJointAction(state)) {
    return { ok: false, error: '眼下没有待收的联院差事。' };
  }
  state.currentJointAction = null;
  advanceAfterDayAction(state);
  return { ok: true };
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
  // 失信或外传都会让三杯同斟没人肯接;两条理由各说各的,别拿错那句糊弄玩家。
  const exposed = state.resources.exposure >= EXPOSURE_LEDGERED;
  const betrayed = state.flags.broken_pan_word || state.flags.pinger_exposed || state.flags.broken_yue_word;
  return BANQUET_CHOICES.map((choice) => ({
    ...choice,
    disabled: choice.id === 'banquet_balance' && (betrayed || exposed),
    locked: choice.id === 'banquet_balance'
      ? (exposed ? '外头的闲话先进了席，这三杯谁也不敢接。' : '先前有人被你晾过，这三杯斟得再齐也没人肯信。')
      : '',
  }));
}

export function chooseBanquet(state, choiceId) {
  if (state.phase !== 'banquet') return { ok: false, error: '还没到开席的时候。' };
  const choice = BANQUET_CHOICES.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个席面选择。' };
  if (choiceId === 'banquet_balance' && state.resources.exposure >= EXPOSURE_LEDGERED) {
    return { ok: false, error: '外头的闲话先进了席，这三杯谁也不敢接。' };
  }
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

export function accordStatus(state) {
  const rows = [
    { key: 'order', heroine: 'wu_yueniang', label: '正堂定账', glyph: '账' },
    { key: 'truth', heroine: 'pan_jinlian', label: '去处说真', glyph: '真' },
    { key: 'safety', heroine: 'li_pinger', label: '私钥在手', glyph: '钥' },
  ];
  return rows.map((row) => ({ ...row, complete: !!state.accords?.[row.key] }));
}

export function sharedNightStatus(state) {
  const missing = accordStatus(state).filter((row) => !row.complete);
  const jointComplete = jointActionCount(state);
  let reason = '';
  if (!state.flags.banquet_balanced) reason = '中秋那三杯还没一同斟满。';
  else if (missing.length) reason = `还缺：${missing.map((row) => row.label).join('、')}。`;
  else if (jointComplete < JOINT_ACTION_TARGET) {
    reason = `还要让不同院门合办两桩事（${jointComplete}/${JOINT_ACTION_TARGET}）。`;
  }
  else {
    const low = HEROINE_IDS.find((id) => state.relations[id].qing < 30);
    const angry = HEROINE_IDS.find((id) => state.relations[id].du >= 70);
    if (low) reason = `${HEROINES[low].short}还没肯把这件事当成三个人的事。`;
    else if (angry) reason = `${HEROINES[angry].short}的火还没压下去。`;
    else if (state.resources.house < 45) reason = '宅门还没稳住，三个人谁也不肯替你收外账。';
  }
  return {
    visible: state.day === MAX_DAY && state.phase === 'choose_visit',
    ready: !reason,
    reason,
    complete: ACCORD_KEYS.filter((key) => state.accords?.[key]).length,
    total: ACCORD_KEYS.length,
    jointComplete: Math.min(jointComplete, JOINT_ACTION_TARGET),
    jointTotal: JOINT_ACTION_TARGET,
  };
}

export function startSharedNight(state) {
  if (state.phase !== 'choose_visit' || state.day !== MAX_DAY) {
    return { ok: false, error: '还没到请三人同席的时候。' };
  }
  state.currentHeroine = null;
  state.phase = 'shared_night';
  record(state, 'shared_night_start', { accordCount: accordStatus(state).filter((row) => row.complete).length });
  return { ok: true };
}

export function sharedNightOptions(state) {
  if (state.phase !== 'shared_night') return [];
  const status = sharedNightStatus({ ...state, phase: 'choose_visit' });
  return SHARED_NIGHT_CHOICES.map((choice) => ({
    ...choice,
    disabled: choice.id === 'shared_divide_roles'
      ? !status.ready
      : choice.id === 'shared_buy_quiet' && state.resources.silver < 40,
    locked: choice.id === 'shared_divide_roles' && !status.ready
      ? status.reason
      : choice.id === 'shared_buy_quiet' && state.resources.silver < 40
        ? '手里凑不出四十两。'
        : '',
  }));
}

export function chooseSharedNight(state, choiceId) {
  if (state.phase !== 'shared_night') return { ok: false, error: '三个人还没坐到同一张桌上。' };
  const choice = sharedNightOptions(state).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个同席选择。' };
  if (choice.disabled) return { ok: false, error: choice.locked };
  applyEffects(state, choice.effects, null, choice.text);
  state.sharedNightChoice = choiceId;
  record(state, 'shared_night', { choice: choiceId, public: true });
  state.log.push(choice.text);
  if (choiceId === 'shared_divide_roles') {
    unlockScene(state, 'inner_court_accord');
    state.pendingScene = 'inner_court_accord';
    state.sceneReturnPhase = 'after_shared_night';
    state.phase = 'scene';
    return { ok: true, text: choice.text, scene: 'inner_court_accord' };
  }
  finishSharedNight(state);
  return { ok: true, text: choice.text, scene: null };
}

function finishSharedNight(state) {
  state.selectedDayAction = null;
  state.ending = determineEnding(state);
  state.phase = 'ending';
  state.over = true;
}

// 个人弧线的拍号 = 你第几次进她的门(结算成功才计次),钳在最后一拍。
// 取代旧的 state.day - 1:按日历天索引会让轮换玩家撞上「好选项被锁、只能选伤害项」。
function routeStep(state, heroineId) {
  return Math.min(state.visits?.[heroineId] ?? 0, (ROUTE_CHOICES[heroineId]?.length ?? 1) - 1);
}

export function visitChoices(state, heroineId) {
  const rows = ROUTE_CHOICES[heroineId]?.[routeStep(state, heroineId)] ?? [];
  const accord = ACCORD_CHOICES[heroineId];
  const choices = accord && !state.accords?.[accord.effects.accord] ? [...rows, accord] : rows;
  return choices.map((choice) => ({
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
  const choice = visitChoices(state, state.currentHeroine).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个回应。' };
  if (choice.condition && !hasToken(state, choice.condition)) return { ok: false, error: choice.locked || '前面的话还没接上。' };
  applyEffects(state, choice.effects, state.currentHeroine, choice.text);
  if (choice.effects.accord) {
    record(state, 'accord_term', { heroine: state.currentHeroine, term: choice.effects.accord, choice: choiceId });
  } else {
    state.visits[state.currentHeroine] = (state.visits[state.currentHeroine] ?? 0) + 1;
    record(state, 'visit_choice', { heroine: state.currentHeroine, choice: choiceId, public: state.day === 5 });
  }
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
    explicit: rel.qing >= 55 && state.flags.kept_yue_word && state.resources.house >= 50 && !routeCooling(state, 'wu_yueniang') && ['ledger', 'banquet'].includes(state.selectedDayAction),
    explicitReason: routeCooling(state, 'wu_yueniang') ? '“正堂不是替你擦屁股的。”今日她不留门。' : '先办成答应她的事。今日的账或席面，也得收拾干净。',
  };
  if (heroineId === 'pan_jinlian') return {
    prelude: rel.qing >= 25 && rel.yu >= 40,
    preludeReason: '她还等着一句不躲闪的真话。',
    explicit: rel.qing >= 40 && rel.yu >= 60 && (state.flags.pan_promised || state.flags.kept_pan_word) && !routeCooling(state, 'pan_jinlian') && state.selectedDayAction === 'listen',
    explicitReason: routeCooling(state, 'pan_jinlian') ? '“空话留给席上说。”她今日笑着关门。' : '先还她那杯酒。今日问来的口风，也别瞒着她。',
  };
  return {
    prelude: rel.qing >= 35 && state.flags.pinger_route,
    preludeReason: '那本账，她还没敢交到你手里。',
    explicit: rel.qing >= 55 && state.flags.protected_pinger && !routeCooling(state, 'li_pinger') && ['ledger', 'office'].includes(state.selectedDayAction),
    explicitReason: routeCooling(state, 'li_pinger') ? '“你要的是箱子，不是我。”钥匙今日收着。' : '先替她守住那本账。今日的外债，也得亲手办妥。',
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
    changeResources(state, { strain: -STRAIN_REST_RELIEF }); // 不进场景的一夜,身体缓过来一些
    text = '你替她掩好衣襟，起身时没有闩死房门。';
  } else if (actionId === 'talk') {
    changeRel(state, heroine, { qing: 8, yu: 6, du: -5 }, '你留下来听她把话说完');
    changeResources(state, { strain: -STRAIN_REST_RELIEF });
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
  } else if (next === 'after_shared_night') {
    finishSharedNight(state);
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
  const notes = [applyUpkeep(state)];
  if (state.day === COLLECTOR_WARNING_DAY) notes.push({ type: 'collector_warning' });
  if (state.day === COLLECTOR_DUE_DAY + 1) notes.push(settleCollector(state));
  applyExposurePressure(state);
  state.morning = buildMorning(state, visited, notes);
  state.phase = 'morning';
}

// 每日结转先扣宅中用度:6 + 声望×3。家声从此是要养的资产——
// 整席面添的每一点声望,都让后面每一天更贵。
function applyUpkeep(state) {
  const r = state.resources;
  const cost = UPKEEP_BASE + r.repute * UPKEEP_PER_REPUTE;
  const paid = Math.min(r.silver, cost);
  r.silver -= paid;
  if (paid < cost) {
    changeResources(state, { house: -4, repute: -1 });
    record(state, 'upkeep_short', { cost, paid });
  }
  state.log.push(upkeepText(cost, paid));
  return { type: 'upkeep', cost, paid };
}

// 第 4 日结转收账:四十两了结;拿不出,他就闹上门,宅门、暴露与三人的妒一起涨。
function settleCollector(state) {
  if (state.resources.silver >= COLLECTOR_PRICE) {
    state.resources.silver -= COLLECTOR_PRICE;
    record(state, 'collector', { paid: true });
    state.log.push(collectorText(true));
    return { type: 'collector', paid: true };
  }
  changeResources(state, { house: -8, exposure: 10 });
  for (const id of HEROINE_IDS) changeRel(state, id, { du: 5 }, '催账人闹上门，全院都听见了');
  record(state, 'collector', { paid: false });
  state.log.push(collectorText(false));
  return { type: 'collector', paid: false };
}

function upkeepText(cost, paid) {
  if (paid >= cost) return `灶上、门房、针线，昨日又去了${silverText(cost)}两。`;
  if (paid > 0) return `灶上、门房、针线，昨日要${silverText(cost)}两，柜上只抹出${silverText(paid)}两。撑不起的场面，自己塌了一角。`;
  return `灶上、门房、针线，昨日要${silverText(cost)}两，柜上一两也抹不出来。撑不起的场面，自己塌了一角。`;
}

function collectorText(paid) {
  return paid
    ? `门外那人点走${silverText(COLLECTOR_PRICE)}两，说了句“两讫”，掸掸袖子走了。`
    : '门外那人见不着银子，拍着门框骂了半条街，邻里都探出头来看。';
}

// 曝光每日结转(F3):高曝光从这夜起开始咬人,三档全部落在场面上。
// ≥25 门房替你打发打听的人,封口钱日扣十五两;≥40 闲话传进院,三人都记一笔妒;
// ≥55 的第三档(官面与三杯同斟关门)在 dayOptions()/banquetOptions() 里读。
function applyExposurePressure(state) {
  const exposure = state.resources.exposure;
  if (exposure >= EXPOSURE_STREET) {
    changeResources(state, { silver: -15 });
    state.log.push('门房替你打发走一个来打听的人，十五两封口钱先记在账上。');
  }
  if (exposure >= EXPOSURE_HOUSEHOLD) {
    for (const id of HEROINE_IDS) changeRel(state, id, { du: 4 }, '外头的话，传到院里了');
  }
}

// 晨间画面 = 昨夜回响 + 结转报条。报条落在现场画面上(灶上、门房、门外的人),
// 不写账单术语;玩家在第 3 日晨就能看见催账口风,还有机会用白日动作备银。
function buildMorning(state, visited, notes = []) {
  const event = pickMorningEvent(state, visited);
  event.notes = notes.map((note) => {
    if (note.type === 'upkeep') return upkeepText(note.cost, note.paid);
    if (note.type === 'collector') return collectorText(note.paid);
    return '门外那收账的今日又来问了一回，说这笔账拖不过明日。';
  });
  // 催账的那两个早晨给一张门前画面:预告那天他还在门外等,到期那天门已经开过。
  // 一句报条说得清数目,说不清"有人正站在门口"——那是玩家该提前两天看见的压力。
  if (notes.some((note) => note.type === 'collector_warning' || note.type === 'collector')) {
    event.scene = 'scene/gate_collector';
  }
  return event;
}

function pickMorningEvent(state, visited) {
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
  if (state.morning.id === 'jealousy' || state.morning.id === 'pan_claim') {
    // 按钮报当前实价:妒越深,哄她开门越贵,拖着不安抚只会更贵。
    const cost = appeaseCost(state, state.morning.actor);
    return [
      { id: 'appease', label: '带她去挑首饰', hint: `花${silverText(cost)}两，先让她把门让开`, disabled: state.resources.silver < cost },
      { id: 'explain', label: '关门跟她说', hint: '院里会猜，至少她能听见实话' },
      { id: 'stand', label: '由她生气', hint: '你不改口，这两日也别指望她消气' },
    ];
  }
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
      const cost = appeaseCost(state, actor);
      if (state.resources.silver < cost) return { ok: false, error: `手里连哄人的${silverText(cost)}两都没有。` };
      changeResources(state, { silver: -cost, house: 3 });
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

// 五档刻度:第一格边界压到开局增量能跨过的位置(情 18 / 欲 16 / 妒 4),
// 让日 1 的第一次选择当场点亮左栏,而不是九个标签一个不动。
export function relationTier(value, kind) {
  if (kind === 'qing') return value >= 80 ? '只认你' : value >= 60 ? '知心' : value >= 38 ? '亲近' : value >= 18 ? '有话说' : '生疏';
  if (kind === 'yu') return value >= 78 ? '不放你走' : value >= 58 ? '主动' : value >= 34 ? '发热' : value >= 16 ? '留意你' : '克制';
  return value >= 70 ? '要翻脸' : value >= 44 ? '要说法' : value >= 20 ? '发酸' : value >= 4 ? '记着了' : '平静';
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
  if (
    state.flags.harem_coalition
    && state.unlocked.includes('inner_court_accord')
    && jointActionCount(state) >= JOINT_ACTION_TARGET
    && HEROINE_IDS.every((heroine) => qing[heroine] >= 30 && state.relations[heroine].du < 70)
    && state.resources.house >= 45
    && state.flags.banquet_balanced
  ) {
    id = 'balanced';
  } else if (qing[top] >= 60 && explicitByHeroine[top] && sorted.slice(1).every((heroine) => qing[heroine] < 50)) {
    id = 'exclusive';
  } else if (state.secretsUsed.length >= 2 && (state.resources.power >= 4 || state.resources.silver >= INTRIGUE_SILVER)) {
    // 曝光不再是权谋的达成条件(F3:高曝光是代价,不是奖励),它只决定这一局的成色。
    id = 'intrigue';
  }
  let text = ENDINGS[id].text;
  let intrigueCost = null;
  let missedBy = null;
  if (id === 'intrigue') {
    intrigueCost = state.resources.exposure >= EXPOSURE_LEDGERED ? 'burned' : state.resources.exposure >= EXPOSURE_STREET ? 'watched' : 'clean';
    text = ENDINGS.intrigue.texts[intrigueCost];
  } else if (id === 'unstable') {
    // F4:输要输得明白——按优先级回读具体差在哪一条,不再共用一句收尾。
    if (qing[top] >= 60 && !explicitByHeroine[top]) missedBy = 'no_scene';
    else if (qing[top] >= 60) missedBy = 'second_too_close';
    else if (!state.flags.banquet_balanced && HEROINE_IDS.some((heroine) => state.publicOverrides[heroine] > 0)) missedBy = 'broke_word';
    else if (state.secretsUsed.length >= 2) missedBy = 'not_enough_power';
    else missedBy = 'spread_thin';
    text = ENDINGS.unstable.texts[missedBy].replace('{name}', HEROINES[top].name);
  }
  const routeResult = id === 'exclusive' ? ({
    wu_yueniang: state.flags.yue_co_rule ? '共掌一宅' : '一院灯深',
    pan_jinlian: state.flags.pan_open_choice ? '火里同谋' : '话已算数',
    li_pinger: state.flags.pinger_same_chest ? '同箱共命' : '钥匙未收',
  })[top] : null;
  return {
    id,
    title: ENDINGS[id].title,
    tag: ENDINGS[id].tag,
    text,
    intrigueCost,
    missedBy,
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

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasFiniteFields = (value, keys) => isRecord(value) && keys.every((key) => Number.isFinite(value[key]));

function validCurrentSave(state) {
  if (!isRecord(state) || state.version !== SAVE_VERSION) return false;
  if (!Number.isFinite(state.seed) || !Number.isInteger(state.day) || state.day < 1 || state.day > MAX_DAY) return false;
  if (!SAVE_PHASES.has(state.phase) || typeof state.over !== 'boolean') return false;
  if (!hasFiniteFields(state.resources, RESOURCE_KEYS)) return false;
  if (!isRecord(state.flags)) return false;
  for (const key of ['secrets', 'secretsUsed', 'history', 'log', 'jointActions', 'unlocked']) {
    if (!Array.isArray(state[key])) return false;
  }
  if (!HEROINE_IDS.every((id) => (
    hasFiniteFields(state.relations?.[id], ['qing', 'yu', 'du', 'ignored'])
    && Array.isArray(state.relations[id].reasons)
    && Number.isFinite(state.publicOverrides?.[id])
    && Number.isFinite(state.routeReopensOn?.[id])
    && Number.isInteger(state.visits?.[id])
  ))) return false;
  if (!HOUSEHOLD_IDS.every((id) => (
    hasFiniteFields(state.household?.[id], ['regard'])
    && Array.isArray(state.household[id].reasons)
  ))) return false;
  if (!ACCORD_KEYS.every((key) => typeof state.accords?.[key] === 'boolean')) return false;
  const completed = new Set(state.jointActions);
  if (completed.size !== state.jointActions.length || [...completed].some((id) => !JOINT_ACTION_IDS.has(id))) return false;
  if (state.unlocked.some((id) => !SCENES[id])) return false;
  if (state.phase === 'joint_result' && (!JOINT_ACTION_IDS.has(state.currentJointAction) || !completed.has(state.currentJointAction))) return false;
  if (state.phase !== 'joint_result' && state.currentJointAction !== null) return false;
  if (['visit', 'night'].includes(state.phase) && !HEROINE_IDS.includes(state.currentHeroine)) return false;
  if (state.phase === 'scene') {
    if (!SCENES[state.pendingScene] || !['choose_visit', 'after_night', 'after_shared_night'].includes(state.sceneReturnPhase)) return false;
    if (state.sceneReturnPhase === 'after_night' && !HEROINE_IDS.includes(state.currentHeroine)) return false;
    if (state.sceneReturnPhase === 'after_night' && SCENES[state.pendingScene].heroine !== state.currentHeroine) return false;
    if (state.sceneReturnPhase === 'choose_visit' && (state.day !== 5 || state.pendingScene !== 'banquet_conflict')) return false;
    if (state.sceneReturnPhase === 'after_shared_night' && (
      state.day !== MAX_DAY
      || state.pendingScene !== 'inner_court_accord'
      || state.sharedNightChoice !== 'shared_divide_roles'
      || !state.flags.harem_coalition
      || jointActionCount(state) < JOINT_ACTION_TARGET
    )) return false;
  } else if (state.pendingScene !== null || state.sceneReturnPhase !== null) return false;
  if (state.phase === 'morning') {
    if (!isRecord(state.morning)
      || !MORNING_EVENT_IDS.has(state.morning.id)
      || !HEROINE_IDS.includes(state.morning.actor)
      || !['tone', 'title', 'text'].every((key) => typeof state.morning[key] === 'string')
      || !Array.isArray(state.morning.notes)) return false;
  } else if (state.morning !== null) return false;
  if (state.phase === 'household' && state.currentHouseholdEvent !== HOUSEHOLD_EVENTS[state.day]?.id) return false;
  if (state.phase === 'opening' && state.day !== 1) return false;
  if (state.phase === 'morning' && state.day < 2) return false;
  if (state.phase === 'banquet' && state.day !== 5) return false;
  if (state.phase === 'shared_night' && (state.day !== MAX_DAY || state.sharedNightChoice !== null)) return false;
  if (state.phase === 'ending') {
    if (state.day !== MAX_DAY || !state.over || !isRecord(state.ending) || !ENDINGS[state.ending.id]) return false;
  } else if (state.over || state.ending !== null) return false;
  return true;
}

export function deserialize(raw) {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (!validCurrentSave(state)) return null;
    if (state.phase === 'ending') state.ending = determineEnding(state);
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
