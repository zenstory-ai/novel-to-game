// 《风月总账》纯状态引擎：无 DOM、无纯 RNG 路线门槛。

import {
  HEROINE_IDS, HEROINES, HOUSEHOLD_IDS, HOUSEHOLD, HOUSEHOLD_EVENTS, JIAOER_RECKONINGS, JIAOER_AFTERMATHS,
  DAY_DEFS, DAY_NAMES, DAY_PRESSURE, DAY_ACTIONS, DAY_AGENDAS, DAY_PRESSURE_RULES, DAY_PRESSURE_VARIANTS, DAY_FAVOR_SOLUTIONS, FAVOR_RECKONINGS, EARLY_DAY_LIVING_ECHOES, DAY4_FLOOR_PREPARATIONS, DAY7_ACCOUNT_LIVING_ECHOES, DAY8_DRIVER_LIVING_ECHOES, DAY9_STOVE_LIVING_ECHOES, DAY9_DEED_PREPARATIONS, DAY9_DEED_JOINT_PREPARATIONS, DAY10_DEED_ECHOES, DAY12_SALT_LIVING_ECHOES, DAY13_COUNCIL_ECHOES, DAY14_DRAFT_PREPARATIONS, DAY14_EMERGENCY_LIVING_ECHOES, DAY15_DRAFT_ECHOES, DAY16_HEARING_LIVING_ECHOES, DAY17_CROWD_LIVING_ECHOES, DAY18_TRADE_PREPARATIONS, DAY18_VAULT_LIVING_ECHOES, DAY19_JIAOER_ECHOES,
  OPENING_CHOICES, OPENING_AFTERMATHS, ROUTE_CHOICES, ROUTE_BRANCHES, ACCORD_CHOICES, JOINT_ACTIONS, PORTABLE_PRECEDENTS, SHARED_NIGHT_CHOICES, DAY19_PRICE_PREPARATIONS,
  ACCORD_META, COALITION_PROOF_META, PERSONAL_FINALES, PERSONAL_FINALE_RESPONSES, PERSONAL_FINALE_DEPARTURES, ALLIANCE_ASSEMBLY_RESPONSES, ALLIANCE_NIGHT_BEATS, ALLIANCE_CHOICE_RESPONSES, ALLIANCE_NIGHT_TABLEAUS, ALLIANCE_NIGHT_COMBINATIONS, SHARED_AFTERGLOW_BEATS, SHARED_AFTERGLOW_RESPONSES, SHARED_AFTERGLOW_TABLEAUS, SHARED_AFTERGLOW_COMBINATIONS, COLLAPSE_FINALES, SHARED_DAWN_CHOICES, SHARED_DAWN_RESPONSES, PUBLIC_EVENTS, PUBLIC_EVIDENCE_CHAIN, DAY5_PUBLIC_OPENINGS, DAY5_PUBLIC_OPENING_LONG_ECHOES, DAY10_PUBLIC_OPENINGS, DAY15_PUBLIC_OPENINGS, DAY15_OPENING_EVIDENCE, DAY10_PUBLIC_PREPARATIONS, DAY5_PUBLIC_PREPARATIONS, PUBLIC_FOLLOWUPS, PUBLIC_FOLLOWUP_AFTERMATHS, ACT_TRANSITIONS, ACT_TRANSITION_VARIANTS, ACT_TRANSITION_AFTERMATHS, ACT_TRANSITION_AFTERMATH_VARIANTS, EXTERNAL_REBUTTALS, EXTERNAL_REBUTTAL_ACTORS, FIVE_PRIVATE_PRICES, DAY20_RECKONING_PREPARATIONS, FINAL_RECKONING, FINAL_RECKONING_AFTERMATHS, MORNING_SETTLEMENTS, COUNCIL_EVENTS, COUNCIL_AFTERMATHS, COUNCIL_7_HISTORY_VARIANTS, COUNCIL_7_AFTERMATH_VARIANTS, COUNCIL_7_LONG_ECHOES, COUNCIL_12_EVIDENCE_VARIANTS, DAY4_FLOOR_TRANSACTION_VARIANTS, DAY9_DEED_TRANSACTION_VARIANTS, JIAOER_EARLY_LONG_ECHOES, COUNCIL_12_DAY14_DRAFT_VARIANTS, DAY14_DRAFT_DISPOSITIONS, COUNCIL_17_DAY18_VARIANTS, SCENES,
  NIGHT_OUTCOMES, ORDINARY_NIGHT_CODAS, ORDINARY_NIGHT_MORNINGS, NIGHT_CONVERSATIONS, NIGHT_CONVERSATION_CODAS, NIGHT_CONVERSATION_ECHOES, NIGHT_CONVERSATION_MORNINGS, NIGHT_CONVERSATION_FUTURES, NIGHT_CONVERSATION_OBSERVERS, NIGHT_CONVERSATION_STAKES, NIGHT_RELATIONSHIP_PATTERNS, ROUTE_AFTERMATHS, ROUTE_AFTERMATH_RESOLUTIONS, ROUTE_AFTERMATH_STAKES, ROUTE_AFTERMATH_STAKE_RETURNS, ROUTE_MILESTONES, ROUTE_RECKONINGS, DUSK_INVITATIONS, DUSK_INVITATION_AFTERMATHS, RIVALRY_MORNINGS, RIVALRY_VISITED_REPLIES, PERSONAL_AFTERGLOWS, PERSONAL_AFTERGLOW_AFTERMATHS, INTIMACY_ARRANGEMENT_ECHOES, HOUSE_CRISES, HOUSE_CRISIS_RESPONSES, HOUSE_CRISIS_STRUCTURE_CARDS, HOUSE_CRISIS_AFTERMATHS, PAIR_INTERLUDES, PAIR_INTERLUDE_AFTERMATHS, ENDINGS, EPILOGUES, FATE_CODA,
} from './data.js';

export const SAVE_VERSION = 67;
export const ACCORD_KEYS = Object.freeze(Object.values(ACCORD_META).map((row) => row.key));
export const JOINT_ACTION_TARGET = 5;
export const PRESSURE_TARGET = 16;
export const PUBLIC_EVENT_DAYS = Object.freeze(Object.keys(PUBLIC_EVENTS).map(Number).sort((a, b) => a - b));
export const PUBLIC_BALANCE_FLAGS = Object.freeze(PUBLIC_EVENT_DAYS.map((day) => PUBLIC_EVENTS[day].balanceFlag));
export const COALITION_CHOICE_ID = SHARED_NIGHT_CHOICES.find((choice) => choice.effects?.flags?.includes('harem_coalition'))?.id;
const JOINT_ACTION_IDS = new Set(JOINT_ACTIONS.map((choice) => choice.id));
const PORTABLE_PRECEDENT_OUTCOMES = new Set(['stand', 'narrow', 'withdraw']);
const PORTABLE_PRECEDENT_CHOICE_IDS = new Set(['honor_precedent', 'named_exception', 'inside_only']);
const MORNING_SETTLEMENT_CAUSES = new Set(['upkeep_short', 'exposure_fee']);
const MORNING_SETTLEMENT_CHOICE_IDS = new Set(['accept_stop', 'narrow_authorization', 'publish_gap']);
const SAVE_PHASES = new Set([
  'opening', 'opening_aftermath', 'crisis', 'crisis_aftermath', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'act_transition', 'act_aftermath', 'day', 'day_aftermath', 'joint_result', 'portable_precedent', 'household', 'household_aftermath', 'council', 'council_aftermath', 'banquet', 'public_evidence', 'public_followup', 'public_aftermath', 'five_private_prices', 'final_reckoning', 'final_aftermath', 'dusk_invitation', 'dusk_invitation_aftermath',
  'choose_visit', 'visit', 'route_aftermath', 'night', 'scene', 'personal_afterglow', 'personal_afterglow_aftermath', 'personal_finale', 'personal_finale_result', 'alliance_assembly', 'alliance_night', 'alliance_night_result', 'shared_night', 'shared_afterglow', 'shared_afterglow_result',
  'shared_dawn', 'shared_dawn_result', 'collapse_finale', 'collapse_finale_result', 'ending',
]);
const SHARED_AFTERGLOW_CHOICE_IDS = new Set(SHARED_AFTERGLOW_BEATS.flatMap((beat) => beat.choices.map((choice) => choice.id)));
const SHARED_DAWN_CHOICE_IDS = new Set(SHARED_DAWN_CHOICES.map((choice) => choice.id));
const ALLIANCE_NIGHT_CHOICE_IDS = new Set(ALLIANCE_NIGHT_BEATS.flatMap((beat) => beat.choices.map((choice) => choice.id)));
const ALLIANCE_ASSEMBLY_OUTCOMES = new Set(['join', 'amend', 'withdraw']);
const PERSONAL_FINALE_CHOICE_IDS = new Set(Object.values(PERSONAL_FINALES).flatMap((finale) => finale.beats.flatMap((beat) => beat.choices.map((choice) => choice.id))));
const PERSONAL_FINALE_DEPARTURE_OUTCOMES = new Set(['accept', 'amend', 'refuse']);
const INTIMACY_ARRANGEMENT_LANES = Object.freeze({
  yue_pre_coda_keep:'private', yue_pre_coda_burn:'private', yue_exp_coda_self:'private', yue_exp_coda_you:'covenant',
  pan_pre_coda_report:'covenant', pan_pre_coda_ask:'private', pan_exp_coda_her_voice:'private', pan_exp_coda_minimum:'covenant',
  pinger_pre_coda_her_original:'private', pinger_pre_coda_double_lock:'covenant', pinger_exp_coda_notice:'private', pinger_exp_coda_map:'covenant',
  meng_pre_coda_her_veto:'private', meng_pre_coda_your_debt:'covenant', meng_exp_coda_invite:'private', meng_exp_coda_empty_day:'covenant',
  xuee_pre_coda_rest_note:'covenant', xuee_pre_coda_cold:'covenant', xuee_exp_coda_yours:'private', xuee_exp_coda_rotate:'covenant',
});
const COLLAPSE_CHOICE_IDS = new Set(Object.values(COLLAPSE_FINALES).flatMap((finale) => finale.choices.map((choice) => choice.id)));
const COLLAPSE_CAUSES = new Set(Object.keys(COLLAPSE_FINALES));
const ROUTE_AFTERMATH_CHOICE_IDS = new Set(['public', 'direct', 'private']);
const ROUTE_AFTERMATH_CHOICE_LABELS = Object.freeze({
  public: '把这笔拿到长案',
  direct: '让她们自己谈',
  private: '把后果留在门内',
});
const MEMORY_RECKONING_CHOICE_LABELS = Object.freeze({
  keep: '照原话兑现',
  rewrite: '承认旧约不够，重谈',
  deny: '说那晚不作数',
});
const FAVOR_RECKONING_CHOICE_LABELS = Object.freeze({
  honor: '把欠下的人、名与银一并补上',
  rewrite: '承认旧还法不够，和两院重谈',
  deny: '说她当日本就该替宅里做',
});
const DUSK_INVITATION_APPROACH_LABELS = Object.freeze({
  accept: '赴她的约',
  open: '请她当面说完',
  decline: '诚实说明今夜不去',
});
const RIVALRY_CHOICE_LABELS = Object.freeze({
  admit: '当着两人认下偏爱',
  direct: '退开，让她们互问',
  hide: '只护昨夜那一院',
});

function routeAftermathStake(heroineId, act, choiceId) {
  const row = ROUTE_AFTERMATH_STAKES[heroineId]?.[act - 1]?.[choiceId];
  if (!row?.label || !row?.text || !isRecord(row.resources) || !Object.keys(row.resources).length) return null;
  const resources = { ...row.resources };
  return {
    label:row.label,
    text:row.text,
    resources,
    resourceText:forecastTextFromEffects(resources),
  };
}

function routeAftermathStakeReturn(heroineId, act, choiceId) {
  const row = ROUTE_AFTERMATH_STAKE_RETURNS[heroineId]?.[act - 1]?.[choiceId];
  if (!row?.returnText || !row?.observerText || !row?.question || !isRecord(row.results)
    || !['keep', 'rewrite', 'deny'].every((id) => typeof row.results[id] === 'string' && row.results[id])) return null;
  return {
    returnText:row.returnText,
    observerText:row.observerText,
    question:row.question,
    results:{ ...row.results },
  };
}
const MORNING_EVENT_IDS = new Set([
  'jealousy', 'rivalry', 'pan_claim', 'yue_delayed', 'yue_help', 'pinger_help',
  'meng_invitation', 'xuee_breakfast', 'quiet',
]);
const RESOURCE_KEYS = Object.freeze(['silver', 'power', 'repute', 'exposure', 'strain', 'house']);
export const PAIR_IDS = Object.freeze(HEROINE_IDS.flatMap((left, index) => HEROINE_IDS.slice(index + 1).map((right) => `${left}|${right}`)));
const INITIAL_BONDS = Object.freeze({
  'wu_yueniang|pan_jinlian': -3,
  'wu_yueniang|li_pinger': 3,
  'wu_yueniang|meng_yulou': 8,
  'wu_yueniang|sun_xuee': 4,
  'pan_jinlian|li_pinger': -2,
  'pan_jinlian|meng_yulou': -4,
  'pan_jinlian|sun_xuee': 7,
  'li_pinger|meng_yulou': 4,
  'li_pinger|sun_xuee': 2,
  'meng_yulou|sun_xuee': 5,
});
const DAY_PREFERENCES = Object.freeze({
  wu_yueniang: Object.freeze(['ledger', 'banquet']),
  pan_jinlian: Object.freeze(['listen']),
  li_pinger: Object.freeze(['ledger', 'office']),
  meng_yulou: Object.freeze(['office', 'banquet']),
  sun_xuee: Object.freeze(['ledger', 'listen']),
});
export const FAVOR_QING_FLOOR = 18;
export const FAVOR_BOND_FLOOR = 0;
export const FAVOR_HONOR_COST = 18;
const NETWORK_REACTIONS = Object.freeze({
  wu_yueniang: Object.freeze({
    agree: (actor) => `月娘把${HEROINES[actor].short}递来的东西压进总账：“这一步我接，下一步也照此留名。”`,
    resist: (actor) => `月娘没有接${HEROINES[actor].short}的话，只问你：“她今日替你开门，明日的后果写谁名下？”`,
  }),
  pan_jinlian: Object.freeze({
    agree: (actor) => `金莲用扇尖点了点${HEROINES[actor].short}的证物：“这回我不拆她的台，先拆外头那句谎。”`,
    resist: (actor) => `金莲当着${HEROINES[actor].short}的面笑了一声：“法子漂亮。官人若漏说代价，我替你补。”`,
  }),
  li_pinger: Object.freeze({
    agree: (actor) => `瓶儿核过${HEROINES[actor].short}报的数，才把自己的钥匙放到桌边：“能对上，我便接下一手。”`,
    resist: (actor) => `瓶儿把钥匙重新系回腕上：“${HEROINES[actor].short}能替你开这道门，我的货却不跟着押进去。”`,
  }),
  meng_yulou: Object.freeze({
    agree: (actor) => `玉楼替${HEROINES[actor].short}补全回帖，却把功劳仍写回原名：“人情接得住，名字也不能接丢。”`,
    resist: (actor) => `玉楼仍对${HEROINES[actor].short}笑着，手里的名帖却没有递出：“这份情面，还没说清由谁来还。”`,
  }),
  sun_xuee: Object.freeze({
    agree: (actor) => `雪娥把${HEROINES[actor].short}那一页压到米斗下：“数和实物都合，我就照这份办。”`,
    resist: (actor) => `雪娥没接${HEROINES[actor].short}递来的漂亮话，只把缺掉的那一斗米摆到你面前：“先说谁补。”`,
  }),
});
const AFTERMATH_OBSERVERS = Object.freeze({
  wu_yueniang: Object.freeze(['pan_jinlian', 'li_pinger', 'sun_xuee', 'meng_yulou']),
  pan_jinlian: Object.freeze(['wu_yueniang', 'meng_yulou', 'li_pinger', 'sun_xuee']),
  li_pinger: Object.freeze(['sun_xuee', 'wu_yueniang', 'pan_jinlian', 'meng_yulou']),
  meng_yulou: Object.freeze(['pan_jinlian', 'sun_xuee', 'wu_yueniang', 'li_pinger']),
  sun_xuee: Object.freeze(['li_pinger', 'pan_jinlian', 'meng_yulou', 'wu_yueniang']),
});
const DAY_ACTION_BASE = Object.freeze({
  ledger: Object.freeze({ silver: 14 }),
  office: Object.freeze({ power: 1, exposure: 5 }),
  listen: Object.freeze({ exposure: 6 }),
  banquet: Object.freeze({ repute: 1, house: 3 }),
});
const COALITION_BOND_FLOOR = 0;
const COALITION_COVENANT_FLOOR = 2;

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
  broken_meng_word: 'meng_yulou',
  broken_xuee_word: 'sun_xuee',
});
const HEROINE_BOUNDARY_FLAGS = Object.freeze({
  wu_yueniang:Object.freeze({ broken:'broken_yue_word', repaired:'yue_branch_repaired' }),
  pan_jinlian:Object.freeze({ broken:'broken_pan_word', repaired:'pan_branch_repaired' }),
  li_pinger:Object.freeze({ broken:'pinger_exposed', repaired:'pinger_branch_repaired' }),
  meng_yulou:Object.freeze({ broken:'broken_meng_word', repaired:'meng_branch_repaired' }),
  sun_xuee:Object.freeze({ broken:'broken_xuee_word', repaired:'xuee_branch_repaired' }),
});

// 旧越界是历史事实，不能删旗标；但具名修复也必须真的恢复权限。按真实拜访
// 顺序重演「越界／修复」，才能同时支持修复后重开与后来再次越界重新关门。
function routeBoundaryBreachActive(state, heroineId) {
  const contract = HEROINE_BOUNDARY_FLAGS[heroineId];
  if (!contract || !state?.flags?.[contract.broken]) return false;
  let active = null;
  for (const entry of state.history ?? []) {
    if (entry.type !== 'visit_choice' || entry.heroine !== heroineId) continue;
    const flags = routeChoiceById(heroineId, entry.choice)?.effects?.flags ?? [];
    if (flags.includes(contract.broken)) active = true;
    if (flags.includes(contract.repaired)) active = false;
  }
  return active ?? !state.flags[contract.repaired];
}

function anyRouteBoundaryBreachActive(state) {
  return HEROINE_IDS.some((heroineId) => routeBoundaryBreachActive(state, heroineId));
}

// 身体耗损的读取点(F2):`strain` 原先只写不读,常驻 HUD 的代价条一局都不结账。
// 现在它决定次日撑不撑得起需要露面的场面,并在休息之夜回落——代价条会结账,
// 但不锁死任何一条深线的内容。
export const STRAIN_STRAINED = 30;   // 撑不起「走官面 / 整席面」
export const STRAIN_REST_RELIEF = 6; // 不进亲密场景的一夜回落
// 曝光的读取点(F3):它不是权谋结局的奖励门,是每日结转开始咬人的代价条。
// 三档:传过街(封口钱) → 传进院(全员妒) → 进了别人的账(官面与公开同盟关门)。
export const EXPOSURE_STREET = 25;
export const EXPOSURE_HOUSEHOLD = 40;
export const EXPOSURE_LEDGERED = 55;
export const MAX_DAY = 20;
// 宅中用度(银钱经济收紧):家声越高,日子越贵。每日结转扣一笔,次晨报在现场画面上;
// 银子不够扣到 0 为止,摆不起的场面自己塌——宅门与家声跟着掉,不许出现负银。
export const UPKEEP_BASE = 4;
export const UPKEEP_PER_REPUTE = 2;
// 第 4 日催账硬到期:第 3 日晨间先给一句可见口风,第 4 日结转时收账,不是无预告的惩罚。
export const COLLECTOR_WARNING_DAY = 3;
export const COLLECTOR_DUE_DAY = 4;
export const COLLECTOR_PRICE = 40;
// 安抚按妒分档:妒越拖越贵,按钮要报当前实价,不写死「二十两」。
export const APPEASE_BASE = 20;
export const APPEASE_DU_FLOOR = 40;
// 权谋收束的银钱门槛：二十日长局必须持续经营货路，不能靠开场银与日常翻账顺手撞上。
export const INTRIGUE_SILVER = 420;
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

export function choiceSilverCost(choice) {
  return Math.max(0, -(choice?.effects?.silver ?? 0));
}

function cannotAfford(state, choice) {
  return choiceSilverCost(choice) > state.resources.silver;
}

function costLockedText(choice) {
  return `手里凑不出${silverText(choiceSilverCost(choice))}两。`;
}

// 安抚实价:妒过四十两起步价之后,每多一点妒加一两。
export function appeaseCost(state, heroineId) {
  return APPEASE_BASE + Math.max(0, (state.relations[heroineId]?.du ?? 0) - APPEASE_DU_FLOOR);
}

const makeRel = () => ({ qing: 8, yu: 6, du: 0, ignored: 0, reasons: [] });
const makeHousehold = () => Object.fromEntries(HOUSEHOLD_IDS.map((id) => [id, { regard: 0, reasons: [] }]));
const makeBonds = () => Object.fromEntries(PAIR_IDS.map((id) => [id, INITIAL_BONDS[id] ?? 0]));
const makeRouteStances = () => Object.fromEntries(HEROINE_IDS.map((id) => [id, { covenant: 0, private: 0 }]));

export function bondKey(left, right) {
  const leftIndex = HEROINE_IDS.indexOf(left);
  const rightIndex = HEROINE_IDS.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0 || leftIndex === rightIndex) return null;
  return leftIndex < rightIndex ? `${left}|${right}` : `${right}|${left}`;
}

export function bondValue(state, left, right) {
  const key = bondKey(left, right);
  return key ? state.bonds?.[key] ?? 0 : 0;
}

export function bondTier(value) {
  if (value >= 24) return '肯互保';
  if (value >= 10) return '能合办';
  if (value >= 0) return '留着话';
  if (value >= -10) return '彼此提防';
  return '不肯同桌';
}

export function bondStatus(state) {
  return PAIR_IDS.map((id) => {
    const [left, right] = id.split('|');
    const value = state.bonds?.[id] ?? 0;
    return { id, left, right, value, tier: bondTier(value) };
  });
}

export function haremOutlook(state) {
  const pairs = bondStatus(state).map((row) => {
    const members = [row.left, row.right];
    const personalReady = members.filter((id) => (
      state.relations[id].qing >= 52
      && state.relations[id].du < 70
      && heroineAccordReady(state, id)
      && routeStance(state, id).covenant >= 1
      && state.unlocked.includes(preludeSceneId(id))
    )).length;
    const score = state.relations[row.left].qing + state.relations[row.right].qing + row.value * 2 + personalReady * 12;
    return {
      ...row,
      members,
      personalReady,
      ready: personalReady === 2 && row.value >= 10,
      score,
    };
  }).sort((left, right) => right.score - left.score);
  const top = pairs[0] ?? null;
  const personalReadiness = !top
    ? ''
    : top.personalReady === 2
      ? '两人的凭信都已备齐'
      : top.personalReady === 1
        ? '一人的凭信已经备齐，另一院仍在观望'
        : '两人的凭信都还没有备齐';
  return {
    topPair: top,
    pairCount: pairs.filter((row) => row.ready).length,
    summary: !top
      ? '还没有形成可读的院间同盟。'
      : top.ready
        ? `${HEROINES[top.left].short}与${HEROINES[top.right].short}已经具备双院成盟的基础。`
        : `${HEROINES[top.left].short}与${HEROINES[top.right].short}最接近成盟：${personalReadiness}，两院${top.tier}。`,
  };
}

function routeChoiceLane(heroineId, choiceId) {
  for (const branch of Object.values(ROUTE_BRANCHES[heroineId] ?? {})) {
    for (const rows of Object.values(branch)) {
      const choice = rows.find((row) => row.id === choiceId);
      if (choice) return choice.lane;
    }
  }
  for (const step of ROUTE_CHOICES[heroineId] ?? []) {
    const index = step.findIndex((choice) => choice.id === choiceId);
    if (index >= 0) return index === 0 ? 'covenant' : 'private';
  }
  return null;
}

function dominantRouteLane(stance) {
  if ((stance?.covenant ?? 0) > (stance?.private ?? 0)) return 'covenant';
  if ((stance?.private ?? 0) > (stance?.covenant ?? 0)) return 'private';
  return null;
}

function routeRowsFor(heroineId, stepIndex, stance) {
  const lane = dominantRouteLane(stance);
  return (lane && ROUTE_BRANCHES[heroineId]?.[stepIndex]?.[lane])
    ?? ROUTE_CHOICES[heroineId]?.[stepIndex]
    ?? [];
}

function allRouteChoices(heroineId) {
  const base = (ROUTE_CHOICES[heroineId] ?? []).flat();
  const branches = Object.values(ROUTE_BRANCHES[heroineId] ?? {})
    .flatMap((branch) => Object.values(branch).flat());
  return [...base, ...branches];
}

function routeBondChanges(heroineId, lane) {
  if (lane === 'covenant') {
    return JOINT_ACTIONS
      .filter((choice) => choice.participants?.includes(heroineId))
      .map((choice) => ({ other: choice.participants.find((id) => id !== heroineId), delta: 2 }));
  }
  if (lane === 'private') {
    return HEROINE_IDS.filter((id) => id !== heroineId).map((other) => ({ other, delta: -1 }));
  }
  return [];
}

export function routeStance(state, heroineId) {
  const row = state.routeStances?.[heroineId] ?? { covenant: 0, private: 0 };
  return {
    covenant: row.covenant,
    private: row.private,
    tone: row.covenant === row.private ? '两面都在看' : row.covenant > row.private ? '更信共同承担' : '更信私下情分',
  };
}

const ROUTE_BRANCH_MEMORY = Object.freeze({
  wu_yueniang: Object.freeze({
    covenant: '她已经不再问你肯不肯交权，而会追问每一份权力由谁复核、何时换手。',
    private: '她记得你总把最难看的账先带进她门内；这一次会追问信任是否又让她独自遮丑。',
  }),
  pan_jinlian: Object.freeze({
    covenant: '她已经把锋利磨成人人可用的追问程序；这一次要看你是否也肯受同一套真话约束。',
    private: '她记得那些只在角门内成立的偏话；这一次会逼你分清亲近、撒谎与可停止的追问。',
  }),
  li_pinger: Object.freeze({
    covenant: '她已经愿意共同周转，却仍把归属与同意分得很清；这一次会检验共用是否悄悄变成占有。',
    private: '她记得你曾先护住她的退路；这一次会问亲近能否容许钥匙、货票与离开的路继续在她手里。',
  }),
  meng_yulou: Object.freeze({
    covenant: '她已经让人情留下经手与回礼；这一次会检验体面劳动能否被拒绝、轮换和真正结清。',
    private: '她记得那些不欠回礼的门内时刻；这一次会问你能否爱她而不立刻借她的名字再开一扇门。',
  }),
  sun_xuee: Object.freeze({
    covenant: '她已经把灶上劳动唱到人名；这一次会检验轮值、工钱与停手权是否真能少靠一个人硬撑。',
    private: '她记得你曾在门内叫她歇下；这一次会问亲近能否不附带新差事，也能变成所有人的停工权。',
  }),
});

export function routeBranchContext(state, heroineId) {
  const stepIndex = routeStep(state, heroineId);
  const stance = state.routeStances?.[heroineId] ?? { covenant: 0, private: 0 };
  const lane = dominantRouteLane(stance);
  if (!lane || !ROUTE_BRANCHES[heroineId]?.[stepIndex]?.[lane]) return null;
  const lead = lane === 'covenant' ? stance.covenant : stance.private;
  const other = lane === 'covenant' ? stance.private : stance.covenant;
  return {
    heroine: heroineId,
    step: stepIndex + 1,
    lane,
    label: lane === 'covenant' ? '共担回声' : '私情回声',
    score: `${lane === 'covenant' ? '共担' : '私情'} ${lead} · ${lane === 'covenant' ? '私情' : '共担'} ${other}`,
    title: `前 ${stepIndex} 次选择把第 ${stepIndex + 1} 章带到这里`,
    body: ROUTE_BRANCH_MEMORY[heroineId]?.[lane] ?? '她会按此前真实选择改变这一章，而不是给出固定续页。',
  };
}

function changeBond(state, left, right, delta) {
  const key = bondKey(left, right);
  if (!key || !delta) return;
  state.bonds[key] = clamp((state.bonds[key] ?? 0) + delta, -100, 100);
}

function dayNetworkChanges(day, actionId, actor) {
  const focus = DAY_AGENDAS[day - 1]?.focus ?? [];
  return [...new Set(focus.filter((id) => id !== actor))].map((observer) => ({
    observer,
    delta: DAY_PREFERENCES[observer]?.includes(actionId) ? 4 : -2,
  }));
}

function applyDayNetwork(state, actionId, actor) {
  const changes = dayNetworkChanges(state.day, actionId, actor);
  for (const row of changes) {
    changeBond(state, actor, row.observer, row.delta);
    changeRel(
      state,
      row.observer,
      row.delta > 0 ? { qing: 1, du: -1 } : { du: 2 },
      row.delta > 0
        ? `${HEROINES[actor].short}这回办事，她肯接下一手`
        : `${HEROINES[actor].short}这回办事，她没有接话`,
    );
  }
  return changes;
}

function dayNetworkReaction(actor, changes) {
  return changes.map((row) => {
    const voice = NETWORK_REACTIONS[row.observer];
    return row.delta > 0 ? voice?.agree(actor) : voice?.resist(actor);
  }).filter(Boolean).join(' ');
}

function dayActionHistory(state) {
  return state.history.filter((entry) => entry.type === 'day_action' || entry.type === 'joint_action');
}

export function dayActionStreak(state, actionId) {
  let streak = 0;
  for (const entry of [...dayActionHistory(state)].reverse()) {
    if (entry.type !== 'day_action' || entry.action !== actionId) break;
    streak += 1;
  }
  return streak;
}

export function pressureMomentum(state) {
  let resolved = 0;
  let missed = 0;
  for (const entry of [...dayActionHistory(state)].reverse()) {
    if (entry.resolved) {
      if (missed) break;
      resolved += 1;
    } else {
      if (resolved) break;
      missed += 1;
    }
  }
  return {
    resolved,
    missed,
    label: resolved >= 3 ? `连收 ${resolved} 局` : missed >= 2 ? `连失 ${missed} 局` : resolved ? `已收 ${resolved} 局` : missed ? `漏了 ${missed} 局` : '局势未定',
  };
}

function dayActionEconomy(state, actionId) {
  const act = Math.min(4, Math.ceil(state.day / 5));
  const repeated = dayActionStreak(state, actionId);
  const correct = dayPressureRule(state)?.counter === actionId;
  const tired = correct ? 0 : repeated;
  if (actionId === 'ledger') {
    const routeBonus = state.flags.pinger_same_chest ? 10 : 0;
    const lateBonus = state.day >= 16 ? 6 : 0;
    return { silver: Math.max(4, DAY_ACTION_BASE.ledger.silver + routeBonus + lateBonus - tired * 7) };
  }
  if (actionId === 'office') {
    return { power: 1, exposure: DAY_ACTION_BASE.office.exposure + tired * 3, silverCost: 22 + act * 3 };
  }
  if (actionId === 'listen') return { exposure: DAY_ACTION_BASE.listen.exposure + tired * 4 };
  return { repute: 1, house: Math.max(1, DAY_ACTION_BASE.banquet.house - tired), silverCost: 26 + act * 3 };
}

function forecastText(state, actionId) {
  const row = dayActionEconomy(state, actionId);
  const parts = [];
  if (row.silver) parts.push(`银+${row.silver}`);
  if (row.silverCost) parts.push(`银-${row.silverCost}`);
  if (row.power) parts.push(`势+${row.power}`);
  if (row.repute) parts.push(`声+${row.repute}`);
  if (row.house) parts.push(`宅+${row.house}`);
  if (row.exposure) parts.push(`露+${row.exposure}`);
  const repeated = dayActionStreak(state, actionId);
  if (repeated && dayPressureRule(state)?.counter !== actionId) parts.push(`旧法×${repeated + 1}，收益衰减`);
  return parts.join(' · ');
}

function normalizedSeed(seed) {
  const parsed = Number(seed);
  return Number.isSafeInteger(parsed) ? parsed : 42;
}

export function pressureVariantIndex(seed, day) {
  let value = (normalizedSeed(seed) ^ Math.imul(day, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return value & 1;
}

export function nextSeed(seed) {
  const next = (normalizedSeed(seed) + 104729) % 2147483647;
  return next || 42;
}

function pressureRuleFor(seed, day) {
  const base = DAY_PRESSURE_RULES[day - 1];
  if (!base) return null;
  const variant = pressureVariantIndex(seed, day);
  return variant === 1
    ? { ...base, ...DAY_PRESSURE_VARIANTS[day - 1], variant }
    : { ...base, variant };
}

function dayIntelFor(seed, day) {
  const base = DAY_DEFS[day - 1]?.intel;
  if (!base) return null;
  const rule = pressureRuleFor(seed, day);
  return rule?.variant === 1
    ? { ...base, label: rule.intelLabel, reveal: rule.reveal }
    : base;
}

export function dayPressureRule(state, day = state.day) {
  return pressureRuleFor(state.seed, day);
}

export function dayFavorSolution(state, day = state.day) {
  const row = DAY_FAVOR_SOLUTIONS[day - 1];
  if (!row) return null;
  const stance = state.routeStances?.[row.heroine] ?? { covenant: 0, private: 0 };
  const qing = state.relations?.[row.heroine]?.qing ?? 0;
  const bond = bondValue(state, row.heroine, row.observer);
  const accord = heroineAccordReady(state, row.heroine);
  const leverageReady = accord
    || stance.covenant + stance.private >= 2
    || (qing >= FAVOR_QING_FLOOR && bond >= FAVOR_BOND_FLOOR);
  const ready = day <= MAX_DAY - 2 && leverageReady;
  return {
    ...row,
    day,
    qing,
    bond,
    accord,
    stance: stance.covenant + stance.private,
    ready,
    dueDay: Math.min(MAX_DAY, day + 2),
    requirement: day > MAX_DAY - 2
      ? '终局前已没有两日可供追账；这一手不能再借她的名义先斩后奏'
      : ready
      ? `${HEROINES[row.heroine].short}愿意先押自己的${row.action === 'ledger' ? '账与实物' : row.action === 'office' ? '名与回帖' : row.action === 'listen' ? '口供与锋利话' : '席面与人情'}；第${Math.min(MAX_DAY, day + 2)}日会来追账`
      : `${HEROINES[row.heroine].short}情分需到“有话说”，且与${HEROINES[row.observer].short}至少不再彼此提防；立过院约或走深两拍也可`,
  };
}

function pressureResolutionPlan(state, actionId, joint = false) {
  const rule = dayPressureRule(state);
  if (!rule) return { resolved: false, resolution: 'miss', favor: null };
  if (joint) return { resolved: true, resolution: 'joint', favor: null };
  if (rule.counter === actionId) return { resolved: true, resolution: 'clean', favor: null };
  const favor = dayFavorSolution(state);
  if (favor?.action === actionId && favor.ready) return { resolved: true, resolution: 'favor', favor };
  return { resolved: false, resolution: 'miss', favor: null };
}

function resolvePressure(state, actionId, joint = false, planned = null) {
  const rule = dayPressureRule(state);
  if (!rule) return { resolved: false, text: '' };
  const plan = planned ?? pressureResolutionPlan(state, actionId, joint);
  const resolved = plan.resolved;
  if (resolved) {
    if (!state.resolvedPressures.includes(rule.id)) state.resolvedPressures.push(rule.id);
    const reward = plan.resolution === 'favor'
      ? { house: 2, exposure: -3, strain: 1 }
      : actionId === 'ledger'
      ? { house: 3, exposure: -6 }
      : actionId === 'listen'
        // 问对了口风，就是把消息收在可验的人里，不该反向把曝光堆到公议无法进行。
        ? { house: 3, exposure: -7 }
        : actionId === 'banquet'
          ? { house: 5, exposure: -4 }
          : { house: 4, exposure: -8 };
    const momentum = pressureMomentum(state);
    if (momentum.resolved >= 2) {
      reward.house = (reward.house ?? 0) + 2;
      reward.power = 1;
    }
    if (momentum.missed >= 2) {
      reward.house = (reward.house ?? 0) + 6;
      reward.strain = -4;
    }
    changeResources(state, reward);
    for (const heroine of DAY_AGENDAS[state.day - 1]?.focus ?? []) {
      changeRel(state, heroine, { qing: momentum.resolved >= 2 || momentum.missed >= 2 ? 3 : 2, du: momentum.missed >= 2 ? -5 : -2 }, `第${state.day}日真正的缺口被你收住了`);
    }
    if (plan.resolution === 'favor') {
      changeRel(state, plan.favor.heroine, { qing: 6, du: -3 }, `第${state.day}日你让她拿自己的情面替全宅先压住危局`);
      changeRel(state, plan.favor.observer, { du: 3 }, `${HEROINES[plan.favor.heroine].short}替你先付的代价还没有说清`);
      changeBond(state, plan.favor.heroine, plan.favor.observer, -2);
    }
    const swing = momentum.missed >= 2
      ? ' 你没有再硬套旧办法，五院顺着这次改手把前两日漏掉的证据一并抢了回来。'
      : momentum.resolved >= 2
        ? ' 连着几日都没让对手换掉证据，五院终于敢把下一手也压给你。'
        : '';
    const resolvedText = plan.resolution === 'favor'
      ? `${plan.favor.resolved} ${HEROINES[plan.favor.heroine].short}没有把这一步说成白帮：${plan.favor.debtTitle}，第${plan.favor.dueDay}日要当面结。`
      : rule.resolved;
    return {
      resolved: true,
      resolution: plan.resolution,
      favor: plan.favor,
      text: `${resolvedText}${swing}`,
    };
  }
  const momentum = pressureMomentum(state);
  const missPenalty = Math.min(10, 4 + momentum.missed * 2);
  changeResources(state, { house: -missPenalty, strain: 2 + momentum.missed });
  for (const heroine of DAY_AGENDAS[state.day - 1]?.focus ?? []) {
    changeRel(state, heroine, { du: 3 + momentum.missed * 2 }, `第${state.day}日真正的缺口没有收住`);
  }
  if (momentum.missed >= 1) {
    const focus = DAY_AGENDAS[state.day - 1]?.focus ?? [];
    for (let index = 0; index < focus.length; index += 1) {
      for (const other of focus.slice(index + 1)) changeBond(state, focus[index], other, -2);
    }
  }
  return { resolved: false, resolution: 'miss', favor: null, text: `${rule.missed}${momentum.missed >= 1 ? ' 对手已经看出你总用同一种办法，下一次失手会更伤宅门。' : ''}` };
}

export function newGame(seed = 42) {
  const relations = Object.fromEntries(HEROINE_IDS.map((id) => [id, makeRel()]));
  relations.wu_yueniang.qing = 10;
  relations.pan_jinlian.yu = 10;
  return {
    version: SAVE_VERSION,
    seed: normalizedSeed(seed),
    day: 1,
    phase: 'opening',
    resources: { silver: 220, power: 2, repute: 3, exposure: 0, strain: 0, house: 65 },
    relations,
    bonds: makeBonds(),
    routeStances: makeRouteStances(),
    household: makeHousehold(),
    secrets: [],
    secretsUsed: [],
    selectedSecret: null,
    flags: {},
    publicOverrides: Object.fromEntries(HEROINE_IDS.map((id) => [id, 0])),
    routeReopensOn: Object.fromEntries(HEROINE_IDS.map((id) => [id, 0])),
    // 每名女主的个人弧线按「她的第几次」走,不按日历天——
    // 轮换顺序不再把任何人的好选项锁死(设计评审 §3)。
    visits: Object.fromEntries(HEROINE_IDS.map((id) => [id, 0])),
    accords: Object.fromEntries(ACCORD_KEYS.map((key) => [key, false])),
    jointActions: [],
    resolvedPressures: [],
    history: [],
    log: [],
    currentHeroine: null,
    routeAftermath: null,
    personalAfterglow: null,
    personalAfterglowAftermath: null,
    nightConversation: null,
    nightCoda: null,
    personalFinale: null,
    personalFinaleChoices: [],
    allianceAssembly: null,
    currentCrisis: null,
    crisisAftermath: null,
    openingAftermath: null,
    pairInterlude: null,
    favorReckoning: null,
    memoryReckoning: null,
    duskInvitation: null,
    duskInvitationAftermath: null,
    dayAftermath: null,
    councilAftermath: null,
    publicEvidence: null,
    publicAftermath: null,
    actAftermath: null,
    externalEffectAudit: null,
    finalReckoningAftermath: null,
    fivePrivatePrices: null,
    householdAftermath: null,
    selectedDayAction: null,
    currentHouseholdEvent: null,
    morning: null,
    morningSettlement: null,
    pendingScene: null,
    sceneReturnPhase: null,
    sceneBeat: 0,
    sharedNightChoice: null,
    allianceMembers: [],
    allianceChoices: [],
    sharedAfterglowChoices: [],
    sharedDawnChoice: null,
    collapseFinale: null,
    currentJointAction: null,
    jointActionBeat: 0,
    portablePrecedent: null,
    unlocked: [],
    ending: null,
    fateCoda: null,
    over: false,
  };
}

function earlyDayLivingContext(state) {
  const echoes = EARLY_DAY_LIVING_ECHOES[state.day];
  if (!echoes) return null;
  const sourceDay = state.day - 1;
  const source = recordedDayPreparation(state, sourceDay, echoes);
  if (!source) return null;
  return {
    sourceDay,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day18VaultLivingContext(state) {
  if (state.day !== 18) return null;
  const source = recordedDayPreparation(state, 17, DAY18_VAULT_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:17,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day14EmergencyLivingContext(state) {
  if (state.day !== 14) return null;
  const source = recordedDayPreparation(state, 13, DAY14_EMERGENCY_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:13,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day16HearingLivingContext(state) {
  if (state.day !== 16) return null;
  const source = recordedDayPreparation(state, 15, DAY16_HEARING_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:15,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day17CrowdLivingContext(state) {
  if (state.day !== 17) return null;
  const source = recordedDayPreparation(state, 16, DAY17_CROWD_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:16,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day12SaltLivingContext(state) {
  if (state.day !== 12) return null;
  const source = recordedDayPreparation(state, 11, DAY12_SALT_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:11,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day7AccountLivingContext(state) {
  if (state.day !== 7) return null;
  const source = recordedDayPreparation(state, 6, DAY7_ACCOUNT_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:6,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day8DriverLivingContext(state) {
  if (state.day !== 8) return null;
  const source = recordedDayPreparation(state, 7, DAY8_DRIVER_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:7,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

function day9StoveLivingContext(state) {
  if (state.day !== 9) return null;
  const source = recordedDayPreparation(state, 8, DAY9_STOVE_LIVING_ECHOES);
  if (!source) return null;
  return {
    sourceDay:8,
    sourceAction:source.action,
    sourceActor:source.actor,
    ...source.preparation,
  };
}

export function dayDef(state) {
  const definition = DAY_DEFS[state.day - 1];
  const agenda = dayAgenda(state);
  const rule = dayPressureRule(state);
  let pressure = agenda?.earlyEcho?.pressure
    ?? agenda?.accountEcho?.pressure
    ?? agenda?.driverEcho?.pressure
    ?? agenda?.stoveEcho?.pressure
    ?? agenda?.saltEcho?.pressure
    ?? agenda?.emergencyEcho?.pressure
    ?? agenda?.hearingEcho?.pressure
    ?? agenda?.crowdEcho?.pressure
    ?? agenda?.vaultEcho?.pressure
    ?? definition?.pressure
    ?? DAY_PRESSURE[state.day - 1];
  // 话传出了这条街:曝光的头一档后果,每天都让玩家看见它在扣钱。
  if (state.resources.exposure >= EXPOSURE_STREET) {
    pressure = `门房今早又打发走一个来打听的。${pressure}`;
  }
  const rebuttal = state.day === 17 ? recordedExternalRebuttal(state) : null;
  const nightLedger = state.day === 13 ? recordedNightLedger(state) : null;
  return {
    day: state.day,
    id: definition?.id ?? `day_${state.day}`,
    act: definition?.act ?? Math.ceil(state.day / 5),
    name: definition?.name ?? DAY_NAMES[state.day - 1],
    pressure,
    dilemma: agenda?.dilemma ?? '',
    tell: rule?.tell ?? ({
      ledger: '众人的说法都绕开数目，只有原账页上的墨迹不肯改口。',
      office: '门外人不怕私下争执，只怕一张有人具名的回执。',
      listen: '几份说法在同一处停顿，先问清这句比先花钱更要紧。',
      banquet: '证人分开时各说各话，得让他们在同一张桌上彼此接话。',
    })[rule?.counter] ?? '',
    focus: agenda?.focus ?? [],
    externalPressure:rebuttal ? {
      sourceResult:rebuttal.sourceResult,
      label:rebuttal.choice.label,
      text:rebuttal.choice.day17Echo,
    } : null,
    nightLedger:nightLedger ? {
      factId:nightLedger.factId,
      sourceChoice:nightLedger.sourceChoice,
      actChoice:nightLedger.actChoice,
      choice:nightLedger.choice,
      publicOpeningChoice:nightLedger.publicOpeningChoice,
      publicOpeningLabel:nightLedger.publicOpeningLabel,
      title:nightLedger.day13.title,
      text:`${nightLedger.day13.text} ${nightLedger.publicOpeningLongEcho.day13.text}`,
      permission:nightLedger.day13.permission,
      publicOpeningText:nightLedger.publicOpeningLongEcho.day13.text,
    } : null,
    deedEcho:agenda?.deedEcho ?? null,
    councilEcho:agenda?.councilEcho ?? null,
    earlyEcho:agenda?.earlyEcho ?? null,
    accountEcho:agenda?.accountEcho ?? null,
    driverEcho:agenda?.driverEcho ?? null,
    stoveEcho:agenda?.stoveEcho ?? null,
    saltEcho:agenda?.saltEcho ?? null,
    emergencyEcho:agenda?.emergencyEcho ?? null,
    hearingEcho:agenda?.hearingEcho ?? null,
    crowdEcho:agenda?.crowdEcho ?? null,
    vaultEcho:agenda?.vaultEcho ?? null,
  };
}

export function dayAgenda(state) {
  const agenda = DAY_AGENDAS[state.day - 1] ?? null;
  if (!agenda) return null;
  const earlyEcho = earlyDayLivingContext(state);
  if (earlyEcho) {
    return {
      ...agenda,
      dilemma:earlyEcho.dilemma,
      earlyEcho,
    };
  }
  const accountEcho = day7AccountLivingContext(state);
  if (accountEcho) {
    return {
      ...agenda,
      dilemma:accountEcho.dilemma,
      accountEcho,
    };
  }
  const driverEcho = day8DriverLivingContext(state);
  if (driverEcho) {
    return {
      ...agenda,
      dilemma:driverEcho.dilemma,
      driverEcho,
    };
  }
  const stoveEcho = day9StoveLivingContext(state);
  if (stoveEcho) {
    return {
      ...agenda,
      dilemma:stoveEcho.dilemma,
      stoveEcho,
    };
  }
  const saltEcho = day12SaltLivingContext(state);
  if (saltEcho) {
    return {
      ...agenda,
      dilemma:saltEcho.dilemma,
      saltEcho,
    };
  }
  const emergencyEcho = day14EmergencyLivingContext(state);
  if (emergencyEcho) {
    return {
      ...agenda,
      dilemma:emergencyEcho.dilemma,
      emergencyEcho,
    };
  }
  const hearingEcho = day16HearingLivingContext(state);
  if (hearingEcho) {
    return {
      ...agenda,
      dilemma:hearingEcho.dilemma,
      hearingEcho,
    };
  }
  const crowdEcho = day17CrowdLivingContext(state);
  if (crowdEcho) {
    return {
      ...agenda,
      dilemma:crowdEcho.dilemma,
      crowdEcho,
    };
  }
  const vaultEcho = day18VaultLivingContext(state);
  if (vaultEcho) {
    return {
      ...agenda,
      dilemma:vaultEcho.dilemma,
      vaultEcho,
    };
  }
  if (state.day === 10) {
    const deed = recordedJiaoerDeedDisposition(state);
    const echo = deed ? DAY10_DEED_ECHOES[deed.aftermath] : null;
    if (!echo) return agenda;
    return {
      ...agenda,
      dilemma:echo.dilemma,
      deedEcho:{ choice:deed.opening, aftermath:deed.aftermath, label:echo.label, text:echo.pressure },
      actions:Object.fromEntries(Object.entries(agenda.actions).map(([id, move]) => [id, {
        ...move,
        text:[move.text, echo.actions[id]].filter(Boolean).join(' '),
      }])),
    };
  }
  if (state.day === 13) {
    const council = day13CouncilLivingContext(state);
    const echo = council ? DAY13_COUNCIL_ECHOES[council.choice] : null;
    if (!echo) return agenda;
    return {
      ...agenda,
      dilemma:echo.dilemma,
      councilEcho:{ ...council, label:echo.label, text:council.text },
      actions:Object.fromEntries(Object.entries(agenda.actions).map(([id, move]) => [id, {
        ...move,
        text:[move.text, echo.actions[id], council.materialText].filter(Boolean).join(' '),
      }])),
    };
  }
  return agenda;
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
  if (state.selectedSecret === id) state.selectedSecret = null;
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
// 不是永久锁死。house 跌破会同时冷却全部五条线——正堂不稳时谁都不肯留门。
export function evaluateBreak(state, heroineId) {
  const overrides = state.publicOverrides[heroineId] ?? 0;
  if (overrides < BREAK_OVERRIDE_LIMIT) return false;
  // 失信通常在夜里发生；写 day+2 才会让「次日」真正冷一日，day+1 会在
  // 当夜结算递增日数后立刻过期，等于从未关门。
  state.routeReopensOn[heroineId] = state.day + 2;
  record(state, 'route_break', { heroine: heroineId, cause: 'overrides', overrides });
  return true;
}

export function evaluateHouseBreak(state) {
  if (state.resources.house >= BREAK_HOUSE_FLOOR) return;
  for (const id of HEROINE_IDS) {
    if (state.routeReopensOn[id] > state.day) continue;
    state.routeReopensOn[id] = state.day + 2;
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
  applyRelationDelta(rel, delta, reason);
}

function applyRelationDelta(rel, delta = {}, reason = '') {
  for (const key of ['qing', 'yu', 'du']) {
    if (delta[key]) rel[key] = cap100(rel[key] + delta[key]);
  }
  if (reason && Object.values(delta).some(Boolean)) addReason(rel, reason);
}

function setIgnored(state, heroineId, value) {
  const rel = state.relations[heroineId];
  if (!rel) return;
  rel.ignored = value;
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
  applyResourceDelta(state.resources, effects);
  if (effects.house && state.routeReopensOn) evaluateHouseBreak(state);
}

function applyResourceDelta(r, effects = {}) {
  if (effects.silver) r.silver = Math.max(0, r.silver + effects.silver);
  if (effects.power) r.power = clamp(r.power + effects.power, 0, 6);
  if (effects.repute) r.repute = clamp(r.repute + effects.repute, 0, 6);
  if (effects.exposure) r.exposure = cap100(r.exposure + effects.exposure);
  if (effects.strain) r.strain = clamp(r.strain + effects.strain, 0, 100);
  if (effects.house) r.house = cap100(r.house + effects.house);
}

function applyEffects(state, effects = {}, currentHeroine = null, reason = '') {
  changeResources(state, effects);
  if (effects.rel && currentHeroine) changeRel(state, currentHeroine, effects.rel, reason);
  if (effects.relAll) {
    for (const [id, delta] of Object.entries(effects.relAll)) changeRel(state, id, delta, reason);
  }
  if (effects.household) changeHousehold(state, effects.household, reason);
  for (const [left, right, delta] of effects.bonds ?? []) changeBond(state, left, right, delta);
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
  applyEffects(state, choice.effects, null, `开场：${choice.label}`);
  record(state, 'opening', { choice: choiceId, public: true });
  state.log.push(choice.text);
  state.openingAftermath = { choice: choiceId, beat: 0 };
  state.phase = 'opening_aftermath';
  return { ok: true, text: choice.text };
}

export function currentOpeningAftermath(state) {
  if (state.phase !== 'opening_aftermath' || !state.openingAftermath) return null;
  const row = state.openingAftermath;
  const chapter = OPENING_AFTERMATHS[row.choice];
  const openingRows = state.history.filter((entry) => entry.type === 'opening');
  if (!chapter || openingRows.length !== 1 || openingRows[0].choice !== row.choice
    || !Number.isInteger(row.beat) || row.beat < 0 || row.beat >= chapter.beats.length) return null;
  return {
    ...row,
    ...chapter,
    count: chapter.beats.length,
    current: chapter.beats[row.beat],
    previous: chapter.beats.slice(0, row.beat),
  };
}

export function advanceOpeningAftermath(state) {
  const chapter = currentOpeningAftermath(state);
  if (!chapter) return { ok: false, error: '正堂开场没有接到下一页。' };
  if (chapter.beat + 1 < chapter.count) {
    state.openingAftermath.beat += 1;
    return { ok: true };
  }
  state.log.push(chapter.memory);
  state.openingAftermath = null;
  state.phase = 'day';
  return { ok: true };
}

export function openingMemory(state) {
  const opening = state.history.find((entry) => entry.type === 'opening');
  const chapter = opening ? OPENING_AFTERMATHS[opening.choice] : null;
  return chapter ? {
    choice: opening.choice,
    title: chapter.title,
    memory: chapter.memory,
    publicEcho: chapter.publicEcho,
    day15Text:chapter.day15Text,
    day15ChoiceTexts:{ ...chapter.day15ChoiceTexts },
    finalText:chapter.finalText,
    finalChoiceTexts:{ ...chapter.finalChoiceTexts },
    finalAftermathTexts:[...chapter.finalAftermathTexts],
    endingTexts:{ ...chapter.endingTexts },
    epilogueTexts:{ ...chapter.epilogueTexts },
    fateText:chapter.fateText,
  } : null;
}

function morningSettlementIdentity(row) {
  return `${row.day}:${row.cause}:${row.heroine}`;
}

function activeMorningSettlementRows(state) {
  const restored = new Set(state.history.filter((entry) => entry.type === 'morning_settlement_restore')
    .map((entry) => `${entry.settlementDay}:${entry.cause}:${entry.heroine}`));
  return state.history.filter((entry) => entry.type === 'morning_settlement' && !restored.has(morningSettlementIdentity(entry)));
}

export function recordedMorningSettlements(state) {
  const uses = new Set(state.history.filter((entry) => entry.type === 'morning_settlement_use')
    .map((entry) => `${entry.settlementDay}:${entry.cause}:${entry.heroine}`));
  const restores = new Map(state.history.filter((entry) => entry.type === 'morning_settlement_restore')
    .map((entry) => [`${entry.settlementDay}:${entry.cause}:${entry.heroine}`, entry]));
  return state.history.filter((entry) => entry.type === 'morning_settlement').map((row) => {
    const heroine = MORNING_SETTLEMENTS.heroines[row.heroine];
    const resolution = MORNING_SETTLEMENTS.resolutions[row.heroine]?.[row.cause]?.[row.choice];
    const identity = morningSettlementIdentity(row);
    return {
      day:row.day, cause:row.cause, sourceDay:row.sourceDay, sourceId:row.sourceId,
      heroine:row.heroine, object:row.object, restriction:row.restriction, recovery:row.recovery,
      choice:row.choice, used:uses.has(identity), restored:restores.has(identity),
      restoration:restores.get(identity)?.result ?? null,
      title:resolution?.title ?? MORNING_SETTLEMENTS.causes[row.cause]?.title ?? '晨簿落名',
      restrictionLabel:heroine?.restriction.label ?? row.restriction,
      recoveryLabel:heroine?.recovery.label ?? row.recovery,
    };
  });
}

function morningActionRestriction(state, actionId) {
  const uses = new Set(state.history.filter((entry) => entry.type === 'morning_settlement_use')
    .map((entry) => `${entry.settlementDay}:${entry.cause}:${entry.heroine}`));
  const rows = activeMorningSettlementRows(state).filter((entry) => entry.restriction === actionId);
  const accepted = rows.filter((entry) => entry.choice === 'accept_stop');
  const allNarrowed = rows.filter((entry) => entry.choice === 'narrow_authorization');
  const narrowed = allNarrowed.filter((entry) => !uses.has(morningSettlementIdentity(entry)));
  const spent = allNarrowed.filter((entry) => uses.has(morningSettlementIdentity(entry)));
  // 窄授权只保一次行动。用毕后原物回到本人手里，同类行动真正停下；
  // 公开缺口则用持续曝光换持续权限，三项选择因此不再形成严格优劣梯子。
  const stopped = [...accepted, ...spent];
  const publicRows = rows.filter((entry) => entry.choice === 'publish_gap');
  const lockedBy = accepted[0] ?? spent[0] ?? null;
  return { rows, accepted, stopped, narrowed, spent, publicRows, lockedBy };
}

function morningRestrictionText(row) {
  if (!row) return '';
  const data = MORNING_SETTLEMENTS.heroines[row.heroine];
  if (row.choice === 'narrow_authorization') {
    return `${HEROINES[row.heroine].short}给出的“一物一次”已经用完，${row.object}回到本人手里；先${data?.recovery?.label ?? '具名补回'}，这条行动才会重开。`;
  }
  return `${HEROINES[row.heroine].short}在第${row.day}日收回了${row.object}；先${data?.recovery?.label ?? '具名补回'}，这条行动才会重新开放。`;
}

function morningSettlementRelief(state, cause) {
  const rows = activeMorningSettlementRows(state).filter((row) => row.cause === cause);
  return {
    upkeep:rows.some((row) => row.choice === 'accept_stop') ? 6 : 0,
    feeWaivedBy:rows.find((row) => ['accept_stop','publish_gap'].includes(row.choice)) ?? null,
  };
}

function morningRecoveryOnlyLead(rows) {
  const names = [...new Set(rows.map((row) => HEROINES[row.heroine]?.short).filter(Boolean))].join('、') || '晨簿具名人';
  return `${names}只把晨簿回执递到具名见证人面前；这一步不送新帖、不添官势，也不替今日危局收口。`;
}

const DAY13_NIGHT_LEDGER_SCOPES = Object.freeze({
  council_7_tonight:Object.freeze({
    ledger:Object.freeze({ label:'逐笔重取本人答复', hint:'旧夜簿已经失效；本人今日重答多少，私借总账才写多少', result:'第七夜旧页没有被拿来预填。月娘逐人重取今日答复，金莲保留每次改口，瓶儿未放行的货单仍退出总账。', meta:'旧页失效 · 今日逐人重答' }),
    office:Object.freeze({ label:'只递今日新签回单', hint:'官面只收本人今日新签的借款范围，不认第七夜夜簿', result:'玉楼只递本人今日新签的回单；旧院名、旧去处与未重答的借物理由全被裁下。', meta:'旧页失效 · 只递新签' }),
    listen:Object.freeze({ label:'重新问谁今日仍认', hint:'旧夜答复不能证明今日动机；重新问本人仍认哪一笔', result:'金莲没有从第七夜去处猜谁护谁，只把今日重新承认的借款与催还原话逐句分开。', meta:'旧页失效 · 动机重问' }),
    banquet:Object.freeze({ label:'让本人今日各放一栏', hint:'同席不等于续期；每人只公开今日重新放行的私借一栏', result:'席上没有续用第七夜的统一授权；五个人分别放行本人今日愿意公开的一栏，未答部分仍留白。', meta:'旧页失效 · 当日放行' }),
  }),
  council_7_their_turn:Object.freeze({
    ledger:Object.freeze({ label:'按本人签核各自一笔', hint:'每张签只开放落字者的一笔；空栏与旁人的借据不能代开', result:'月娘只编五张本人签的日期，瓶儿开放本人一笔货单，雪娥撤回工簿一栏；其余签不能补她们的空白。', meta:'本人签 · 一签只开本人一笔' }),
    office:Object.freeze({ label:'各递本人签过的一栏', hint:'官面收到的是分开的本人栏，不是一张五院总代表帖', result:'玉楼把本人名帖范围折进签内，月娘只核签名；官面收到五份可各自撤回的窄栏，没有总代表。', meta:'本人签 · 不得合成总代表' }),
    listen:Object.freeze({ label:'各问本人愿答的范围', hint:'部分开放、拒答与撤回都有效；不能拿一人的回答补另一人', result:'金莲逐人问到本人签的边界便停，瓶儿只答货单，雪娥撤回工簿动机；没有答案被拼成五院共同口径。', meta:'本人签 · 部分开放有效' }),
    banquet:Object.freeze({ label:'五签分栏同席核对', hint:'同席只核五份本人签，不把部分开放扩写成整案', result:'五份本人签同时摆上席面，却仍逐栏归本人；玉楼只校冲突，月娘不替空签落字。', meta:'本人签 · 同席不扩权' }),
  }),
  council_7_hide:Object.freeze({
    ledger:Object.freeze({ label:'只核具名银数与经手', hint:'没有去处副本；只认借据、银数与具名经手，不猜夜宿动机', result:'月娘把夜宿、忠诚与私情推断全部删掉，只核具名银数与经手；瓶儿的私钥、雪娥的工簿仍各归本人。', meta:'无去处副本 · 不从空白推断' }),
    office:Object.freeze({ label:'递不含夜宿推断的回单', hint:'回单只写可核借款事实；沉默不能补成担保或动机', result:'玉楼退回一张把未答写成默认担保的帖，只递银数、日期与本人签；门房责任页没有变成证物。', meta:'沉默非同意 · 回单只写真事' }),
    listen:Object.freeze({ label:'不能从沉默反推', hint:'第七夜没有去处副本；“从没催还”不能证明忠诚、动机或谁在幕后', result:'没有人拿夜宿空白替这句推断作证。金莲收起问题，私借链失去这条捷径，也保住沉默不被写成答案。', meta:'沉默非证据 · 此路关闭', disabled:true }),
    banquet:Object.freeze({ label:'只让具名借据同席', hint:'同席不得拿夜宿猜测串联五院；只摆本人具名的借据与回单', result:'席上只摆本人具名的借据、回单与银数，所有关于第七夜去处的猜测都被挡在门外。', meta:'无去处副本 · 同席不补猜' }),
  }),
});

function day13NightLedgerScope(state, actionId, move) {
  if (state.day !== 13 || !move) return null;
  const ledger = recordedNightLedger(state);
  const scope = ledger ? DAY13_NIGHT_LEDGER_SCOPES[ledger.choice]?.[actionId] : null;
  if (!scope) return null;
  const publicOpeningText = ledger.publicOpeningLongEcho.day13.actionTexts[actionId];
  const result = [scope.result, publicOpeningText].filter(Boolean).join(' ');
  return {
    ...scope,
    result,
    factId:ledger.factId,
    choice:ledger.choice,
    publicOpeningChoice:ledger.publicOpeningChoice,
    publicOpeningLabel:ledger.publicOpeningLabel,
    publicOpeningText,
    text:`${move.text} ${result}`,
  };
}

export function dayOptions(state) {
  const agenda = dayAgenda(state);
  const pressureRule = dayPressureRule(state);
  const favor = dayFavorSolution(state);
  const methodTags = { ledger: '查账与实物', office: '具名与回执', listen: '口供与破绽', banquet: '同席与互证' };
  return Object.values(DAY_ACTIONS).map((option) => {
    const move = agenda?.actions?.[option.id];
    const nightLedgerScope = day13NightLedgerScope(state, option.id, move);
    const morningRestriction = morningActionRestriction(state, option.id);
    const recoveryRows = activeMorningSettlementRows(state).filter((row) => row.recovery === option.id);
    let hint = nightLedgerScope?.hint ?? move?.hint ?? option.description;
    // 曝光第三档:官面上有人记了你一笔,走官面这条路今日关上。
    // 晨簿恢复允许走一条只核回执、不递新帖的窄路；否则高曝光会把唯一恢复动作永久锁死。
    const ledgered = option.id === 'office' && state.resources.exposure >= EXPOSURE_LEDGERED && !recoveryRows.length;
    if (option.id === 'office') {
      const usable = usableSecrets(state);
      const selected = usable.find((row) => row.id === state.selectedSecret);
      if (ledgered) hint = '你的名字已经进了别人的账。今日递不进去话。';
      else if (recoveryRows.length && state.resources.exposure >= EXPOSURE_LEDGERED) hint = `今日只办${HEROINES[recoveryRows[0].heroine].short}晨簿里的具名回执；不递新帖，也不借此添官势。`;
      else if (selected) hint = `拿${selected.label}去说话；只消耗这一条。`;
      else if (usable.length && state.resources.silver >= dayActionEconomy(state, option.id).silverCost) hint = `不压证据便付${silverText(dayActionEconomy(state, option.id).silverCost)}两；也可先在证据板另挑一条。`;
      else if (usable.length) hint = '银不够送；先在证据板挑一条仍有效的消息。';
      else if (recoveryRows.length && state.resources.silver < dayActionEconomy(state, option.id).silverCost) hint = `无须送银；今日只核${HEROINES[recoveryRows[0].heroine].short}的晨簿回执，不处理别的官面事。`;
      else if (state.resources.silver < dayActionEconomy(state, option.id).silverCost) hint = `没话可递，手里也凑不出${silverText(dayActionEconomy(state, option.id).silverCost)}两。`;
    }
    if (option.id === 'ledger' && state.flags.pinger_same_chest) hint = '瓶儿已经摊开她的账，这回能多追回一些。';
    // 身体耗损的读取点:需要露面撑场的两条路,撑不住就走不了(F2)。
    const strained = state.resources.strain >= STRAIN_STRAINED && ['office', 'banquet'].includes(option.id) && !recoveryRows.length;
    if (strained) hint = '昨夜撑得太狠，今日撑不起这个场面。';
    const economy = dayActionEconomy(state, option.id);
    const unaffordable = option.id === 'banquet' && state.resources.silver < economy.silverCost;
    if (unaffordable) hint = `${silverText(economy.silverCost)}两也摆不出今日这桌。`;
    if (morningRestriction.lockedBy) hint = morningRestrictionText(morningRestriction.lockedBy);
    else if (morningRestriction.narrowed.length) {
      const row = morningRestriction.narrowed[0];
      hint = `${HEROINES[row.heroine].short}只放行${MORNING_SETTLEMENTS.heroines[row.heroine]?.narrow?.limit ?? '一物、一次'}；用过即收回，仍须${MORNING_SETTLEMENTS.heroines[row.heroine]?.recovery?.label ?? '具名补回'}。`;
    } else if (morningRestriction.publicRows.length) {
      const row = morningRestriction.publicRows[0];
      hint = `${HEROINES[row.heroine].short}的${row.object}仍归本人；此路只能顶着已经公开的缺口继续，额外露+4。`;
    }
    const network = move?.actor ? dayNetworkChanges(state.day, option.id, move.actor) : [];
    const observers = network.map((row) => HEROINES[row.observer].short);
    const clean = pressureRule?.counter === option.id;
    const favorPath = favor?.action === option.id;
    const resolutionMeta = clean
      ? '顺着眼前征兆收口，不欠新的人情'
      : favorPath
        ? favor.requirement
        : '能拿到眼前收益，但未必收得住真正缺口';
    return {
      ...option,
      ...(move ?? {}),
      ...(nightLedgerScope ? { label:nightLedgerScope.label, text:nightLedgerScope.text, nightLedgerScope } : {}),
      id: option.id,
      hint,
      meta: `${move?.actor ? `${HEROINES[move.actor].short}会记住${observers.length ? ` · 牵动${observers.join('、')}` : ''} · ` : ''}${methodTags[option.id]} · ${forecastText(state, option.id)} · ${resolutionMeta}${nightLedgerScope ? ` · ${nightLedgerScope.meta}` : ''}${morningRestriction.narrowed.length ? ' · 晨簿仅放一次' : morningRestriction.publicRows.length ? ' · 缺口公开在案' : ''}${recoveryRows.length ? ` · 具名补回${recoveryRows.map((row) => row.object).join('、')}` : ''}`,
      resolvesPressure: clean || (favorPath && favor.ready),
      resolutionPath: clean ? 'clean' : favorPath ? (favor.ready ? 'favor' : 'favor_locked') : 'miss',
      favorDueDay: favorPath ? favor.dueDay : null,
      disabled: !!nightLedgerScope?.disabled || !!morningRestriction.lockedBy || strained || ledgered || unaffordable || (option.id === 'office' && !recoveryRows.length && !state.selectedSecret && state.resources.silver < economy.silverCost),
    };
  });
}

const RELATIONSHIP_SECRETS = [
  'merchant_route', 'pan_rumor', 'shop_fraud', 'pinger_funds', 'yue_backing',
  'meng_guest_list', 'xuee_storehouse_mark', 'kitchen_witness',
];
const DAY_SECRETS = DAY_DEFS.map((day) => day.intel.id);

function secretExpiry(id) {
  const index = DAY_DEFS.findIndex((day) => day.intel.id === id);
  return index >= 0 ? Math.min(MAX_DAY, index + 7) : null;
}

function secretSource(id, state = null) {
  if (state && id === 'collector_floor') {
    const floor = recordedJiaoerFloorDisposition(state);
    if (floor?.disposition === 'verified_purchase') return '娇儿交付的具名底价纸';
    if (floor?.disposition === 'unverified_clue') return '第四日拒买后留下的待核口风';
  }
  if (state && id === 'old_deed') {
    const deed = recordedJiaoerDeedDisposition(state);
    if (deed?.aftermath === 'jiaoer_9_copy_index') return '瓶儿保管的五院索引授权抄本';
    if (deed?.aftermath === 'jiaoer_9_copy_case') return '瓶儿本案柜内的授权抄本';
    if (deed?.aftermath === 'jiaoer_9_take_return') return '月娘保管的押名窄抄与归还记录';
    if (deed?.aftermath === 'jiaoer_9_take_hold') return '瓶儿限期封存的透墨原契';
  }
  const day = DAY_DEFS.find((row) => row.intel.id === id);
  if (day) return `${day.name}听来的口风`;
  return ({
    merchant_route: '瓶儿交出的货路', pan_rumor: '金莲拆出的旧话', shop_fraud: '金莲报出的人名',
    pinger_funds: '瓶儿摊开的私账', yue_backing: '月娘带入正堂的真账',
    meng_guest_list: '玉楼署名的来客册', xuee_storehouse_mark: '雪娥认出的后仓封痕',
    kitchen_witness: '灶上留下的实物证词', old_deed: '娇儿匣中的旧契',
    collector_floor: '娇儿报出的债底价', draft_mark: '银票票角暗记', escape_route: '娇儿卖出的逃路',
  })[id] ?? '宅内交来的证物';
}

export function secretInventory(state) {
  return state.secrets.map((id) => {
    const expiresOn = secretExpiry(id);
    const expired = expiresOn !== null && state.day > expiresOn;
    return {
      id,
      label: secretName(id, state),
      source: secretSource(id, state),
      confidence: id === 'collector_floor' && recordedJiaoerFloorDisposition(state)?.disposition === 'verified_purchase'
        ? '娇儿具名'
        : id === 'old_deed' && recordedJiaoerDeedDisposition(state)
          ? '物件位置已核'
          : DAY_SECRETS.includes(id) ? '待互证' : '有人署名',
      expiresOn,
      expired,
      selected: state.selectedSecret === id,
    };
  });
}

function usableSecrets(state) {
  return secretInventory(state).filter((row) => !row.expired && [...RELATIONSHIP_SECRETS, ...DAY_SECRETS, ...KNOWN_SECRET_IDS].includes(row.id));
}

export function selectSecret(state, secretId) {
  if (state.phase !== 'day') return { ok: false, error: '只有白日走官面前能挑这份证据。' };
  if (secretId === null) {
    state.selectedSecret = null;
    return { ok: true, text: '你把官帖下的证据收回，改用现银开路。' };
  }
  const row = usableSecrets(state).find((item) => item.id === secretId);
  if (!row) return { ok: false, error: '这份消息已经不在手里，或时效已经过了。' };
  state.selectedSecret = secretId;
  return { ok: true, text: `你把“${row.label}”单独压在官帖下。` };
}

function secretName(id, state = null) {
  const dayIndex = DAY_DEFS.findIndex((day) => day.intel.id === id);
  const dayIntel = dayIndex >= 0 && state ? dayIntelFor(state.seed, dayIndex + 1) : DAY_DEFS[dayIndex]?.intel;
  return dayIntel?.label ?? ({
    merchant_route: '瓶儿的货路', pan_rumor: '金莲听来的口风', shop_fraud: '掌柜偷货',
    pinger_funds: '瓶儿的私账', yue_backing: '月娘的正堂背书',
    meng_favor: '玉楼递过的名帖', meng_guest_list: '玉楼记下的来客名册',
    xuee_storehouse_mark: '雪娥认出的锁绳', kitchen_witness: '雪娥在后仓看见的事',
    steward_shortfall: '采买短款', gate_mood: '守门人的软处', warehouse_key: '后仓钥匙',
    servant_footsteps: '门外脚步', banquet_whisper: '席上口风', collector_price: '追账人的价码',
    steward_gap: '管事账上的缺口',
  })[id] ?? id;
}

export function chooseDayAction(state, actionId) {
  if (state.phase !== 'day') return { ok: false, error: '眼下不是办白日事的时候。' };
  const available = dayOptions(state).find((option) => option.id === actionId);
  if (!available) return { ok: false, error: '没有这条路。' };
  if (available.disabled) return { ok: false, error: available.hint || '今日走不了这条路。' };
  const morningRestriction = morningActionRestriction(state, actionId);
  const activeBeforeAction = activeMorningSettlementRows(state);
  const recoveryRows = activeBeforeAction.filter((row) => row.recovery === actionId);
  const move = dayAgenda(state)?.actions?.[actionId];
  const actionText = available.text ?? move?.text;
  const r = state.resources;
  const economy = dayActionEconomy(state, actionId);
  const officeSecret = actionId === 'office' ? usableSecrets(state).find((row) => row.id === state.selectedSecret)?.id ?? null : null;
  const recoveryOnly = actionId === 'office' && recoveryRows.length > 0 && (
    r.exposure >= EXPOSURE_LEDGERED
    || r.strain >= STRAIN_STRAINED
    || (!officeSecret && r.silver < economy.silverCost)
  );
  // 人情解是否成立必须在今日收益、好感与院间变动结算前判定，不能靠点下按钮
  // 临时涨的三点情分把一笔本来借不到的人情倒算成可用。
  const pressurePlan = recoveryOnly
    ? { resolved:false, resolution:'miss', favor:null }
    : pressureResolutionPlan(state, actionId);
  let text = '';
  let secretUsed = null;
  switch (actionId) {
    case 'ledger': {
      const gain = economy.silver;
      changeResources(state, { silver: gain });
      if (state.day === 3) addSecret(state, 'steward_gap');
      const gainText = state.day === 14
        ? `票号把先前多扣的验票押金与误收费退回${silverText(gain)}两；银票本金仍未兑出。`
        : state.day === 18
          ? `旧路线账中重复收取的手续费退回${silverText(gain)}两；这笔不是封口价，也没有买到任何答案。`
          : `柜上实收${silverText(gain)}两。`;
      text = `${actionText ?? '你从掌柜的笑脸一直翻到最后一页墨迹。'} ${gainText}`;
      break;
    }
    case 'office': {
      if (recoveryOnly) {
        changeResources(state, { exposure:1 });
        text = morningRecoveryOnlyLead(recoveryRows);
      } else if (r.exposure >= EXPOSURE_LEDGERED) return { ok: false, error: '你的名字已经进了别人的账。今日递不进去话。' };
      else if (officeSecret) {
        removeSecret(state, officeSecret);
        state.secretsUsed.push(officeSecret);
        secretUsed = officeSecret;
        changeResources(state, { power: 1, exposure: economy.exposure, silver: state.day === 3 ? 45 : 0 });
        text = `${actionText ?? '守门人终于侧身让路。'} 你递进去的是${secretName(officeSecret, state)}，这条消息从此不再只属于你。`;
      } else if (r.silver >= economy.silverCost) {
        changeResources(state, { silver: -economy.silverCost, power: 1, exposure: economy.exposure });
        text = `${actionText ?? '守门人终于给你让出半扇门。'} ${silverText(economy.silverCost)}两落进他的袖口，你的名字也留在了门里。`;
      } else return { ok: false, error: '没话可递，也没银子可送。' };
      break;
    }
    case 'listen': {
      const intel = dayIntelFor(state.seed, state.day);
      if (!intel) return { ok: false, error: '今日没有可追的口风。' };
      const secret = intel.id;
      addSecret(state, secret);
      changeResources(state, { exposure: economy.exposure });
      text = `${actionText ?? '来人把声音压到茶气底下。'} 临走前，他留下${intel.label}：${intel.reveal}。`;
      break;
    }
    case 'banquet': {
      if (r.silver < economy.silverCost) return { ok: false, error: `${silverText(economy.silverCost)}两也摆不出今日这桌。` };
      changeResources(state, { silver: -economy.silverCost, repute: economy.repute, house: economy.house });
      text = `${actionText ?? '酒、果子和五只新杯一起送进宅里。'} ${silverText(economy.silverCost)}两从账上抹掉，席上说过的话却收不回去。`;
      break;
    }
    default:
      return { ok: false, error: '不识这条路。' };
  }
  // day_action.actor 始终是当日议程里真正经手该行动的人；晨簿主人另由
  // morning_settlement_restore 具名。这样恢复窄路不会悄悄改写白日行动的
  // 院间经手关系，也能与历史重放使用的 dayNetworkChanges 保持同一事实。
  const actionActor = move?.actor ?? null;
  if (actionActor) {
    changeRel(state, actionActor, { qing: recoveryOnly ? 1 : 3, du: -1 }, recoveryOnly
      ? `第${state.day}日，她只经手晨簿允许的具名回执，没有把它扩成一趟新的官面差事`
      : `第${state.day}日，你照${HEROINES[actionActor].short}看重的办法办了白日事`);
  }
  const network = move?.actor ? applyDayNetwork(state, actionId, move.actor) : [];
  const pressure = resolvePressure(state, actionId, false, pressurePlan);
  const crossTalk = move?.actor ? dayNetworkReaction(move.actor, network) : '';
  const settlementEchoes = [];
  const nightLedger = state.day === 13 ? recordedNightLedger(state) : null;
  if (nightLedger) {
    settlementEchoes.push(`${nightLedger.day13.title}：${nightLedger.day13.text} ${nightLedger.publicOpeningLongEcho.day13.text} ${nightLedger.day13.permission}`);
  }
  if (morningRestriction.narrowed.length) {
    const names = morningRestriction.narrowed.map((row) => HEROINES[row.heroine].short).join('、');
    settlementEchoes.push(`${names}只放出晨簿所写的一物一次；这一回用完，原物立即回到本人手里。`);
  }
  if (morningRestriction.publicRows.length) {
    changeResources(state, { exposure:4 });
    const names = morningRestriction.publicRows.map((row) => HEROINES[row.heroine].short).join('、');
    settlementEchoes.push(`${names}没有交出本人原物；你顶着已公开的缺口继续办，露又添四。`);
  }
  const restored = recoveryRows;
  for (const row of restored) {
    const restoration = MORNING_SETTLEMENTS.heroines[row.heroine]?.recovery?.result;
    if (restoration) settlementEchoes.push(restoration);
  }
  const executionText = [text, ...settlementEchoes].filter(Boolean).join(' ');
  text = executionText;
  text = [executionText, crossTalk, pressure.text].filter(Boolean).join(' ');
  state.selectedSecret = null;
  state.selectedDayAction = actionId;
  record(state, 'day_action', {
    action: actionId, actor: actionActor, text, executionText,
    outcomeText: pressure.text, resolved: pressure.resolved, resolution: pressure.resolution,
    favorHeroine: pressure.favor?.heroine ?? null, favorObserver: pressure.favor?.observer ?? null,
    network, secretUsed,
  });
  for (const row of morningRestriction.narrowed) {
    record(state, 'morning_settlement_use', {
      settlementDay:row.day, cause:row.cause, heroine:row.heroine, action:actionId,
    });
  }
  for (const row of restored) {
    const result = MORNING_SETTLEMENTS.heroines[row.heroine]?.recovery?.result ?? '';
    record(state, 'morning_settlement_restore', {
      settlementDay:row.day, cause:row.cause, heroine:row.heroine, action:actionId, result,
    });
  }
  if (restored.length) {
    const restoredText = restored.map((row) => `${HEROINES[row.heroine].short}的${row.object}`).join('、');
    state.log.push(`${restoredText}已经由今日“${available.label}”留下具体复核结果；旧限制只按这份结果重开。`);
  }
  state.log.push(text);
  state.dayAftermath = {
    event: DAY_DEFS[state.day - 1].id,
    action: actionId,
    actor: actionActor,
    beat: 0,
  };
  state.phase = 'day_aftermath';
  return { ok: true, text };
}

function currentDayActionEntry(state) {
  return [...state.history].reverse().find((entry) => entry.type === 'day_action' && entry.day === state.day) ?? null;
}

export function currentDayAftermath(state) {
  if (state.phase !== 'day_aftermath' || !state.dayAftermath) return null;
  const entry = currentDayActionEntry(state);
  const move = DAY_AGENDAS[state.day - 1]?.actions?.[state.dayAftermath.action];
  const rule = dayPressureRule(state);
  if (!entry || !move
    || entry.action !== state.dayAftermath.action
    || entry.actor !== state.dayAftermath.actor
    || state.dayAftermath.event !== DAY_DEFS[state.day - 1]?.id) return null;
  const reactions = entry.network.map((row) => {
    const voice = NETWORK_REACTIONS[row.observer];
    return {
      heroine: row.observer,
      delta: row.delta,
      tone: row.delta > 0 ? '接下这一手' : '不肯替你遮代价',
      text: row.delta > 0 ? voice?.agree(entry.actor) : voice?.resist(entry.actor),
    };
  }).filter((row) => row.text);
  const beats = [
    {
      id: 'execution',
      kicker: `第 ${state.day} 日 · 你选了${move.label}`,
      title: `${HEROINES[entry.actor].short}先把手伸进局里`,
      body: entry.executionText,
      speaker: entry.actor,
      reactions: [],
      resolved: null,
    },
    {
      id: 'network',
      kicker: '同一件事 · 旁院当场接话',
      title: reactions.length > 1 ? '另外两院没有站在画外' : `${HEROINES[reactions[0]?.heroine]?.short ?? '旁院'}决定接不接下一手`,
      body: reactions.length > 1
        ? `${HEROINES[entry.actor].short}的办法同时碰到两处边界。她们不是给你加减分，而是在决定以后还肯不肯互相递证。`
        : `${HEROINES[entry.actor].short}办完这一手，另一院立刻把自己的条件摆了出来。`,
      speaker: null,
      reactions,
      resolved: null,
    },
    {
      id: 'consequence',
      kicker: `${DAY_DEFS[state.day - 1].name} · 危局回手`,
      title: entry.resolved ? '这条线索终于扣回原账' : '真正的缺口从另一边裂开',
      body: entry.outcomeText,
      speaker: null,
      reactions: [],
      resolved: entry.resolved,
      truth: entry.resolved ? rule?.truth ?? '' : rule?.missed ?? '',
    },
  ];
  return {
    event: state.dayAftermath.event,
    action: entry.action,
    actor: entry.actor,
    beat: state.dayAftermath.beat,
    count: beats.length,
    current: beats[state.dayAftermath.beat] ?? null,
    beats,
  };
}

export function advanceDayAftermath(state) {
  const story = currentDayAftermath(state);
  if (!story?.current) return { ok: false, error: '这段白日后果已经翻过去了。' };
  if (story.beat < story.count - 1) {
    state.dayAftermath.beat += 1;
    return { ok: true, text: story.current.body };
  }
  const text = story.current.body;
  state.dayAftermath = null;
  advanceAfterDayAction(state);
  return { ok: true };
}

function duskInvitationCandidate(state) {
  if (state.day < 4 || state.day >= MAX_DAY) return null;
  const seen = new Set(state.history.filter((entry) => entry.type === 'dusk_invitation').map((entry) => entry.heroine));
  const heroine = HEROINE_IDS
    .filter((id) => (
      !seen.has(id)
      && DUSK_INVITATIONS[id]
      && state.visits[id] >= 2
      && state.relations[id].qing >= 35
      && state.relations[id].du < 80
      && !routeComplete(state, id)
      && !routeCooling(state, id)
    ))
    .sort((left, right) => {
      const score = (id) => state.relations[id].qing * 2 + state.relations[id].yu + state.relations[id].ignored * 5 + state.visits[id] * 4 - state.relations[id].du;
      return score(right) - score(left);
    })[0];
  if (!heroine) return null;
  return { event: DUSK_INVITATIONS[heroine].id, heroine, witness: DUSK_INVITATIONS[heroine].witness };
}

function enterVisitHub(state) {
  state.duskInvitation = duskInvitationCandidate(state);
  state.phase = state.duskInvitation ? 'dusk_invitation' : 'choose_visit';
}

export function currentDuskInvitation(state) {
  if (state.phase !== 'dusk_invitation' || !state.duskInvitation) return null;
  const expected = duskInvitationCandidate(state);
  if (!expected || JSON.stringify(expected) !== JSON.stringify(state.duskInvitation)) return null;
  return { ...expected, ...DUSK_INVITATIONS[expected.heroine] };
}

export function duskInvitationOptions(state) {
  const event = currentDuskInvitation(state);
  if (!event) return [];
  return [
    { id:'accept', label:'赴她的约', hint:'今夜先回应她主动提出的需要，再进入她的路线现场', meta:'情欲上升 · 直接进入她的院门', text:event.results.accept, disabled:false },
    { id:'open', label:'请她当面说完', hint:`让${HEROINES[event.witness].short}也听见要求与边界，不把主动邀约变成旁院猜测`, meta:'两院互信上升 · 仍可自由选择院门', text:event.results.open, disabled:false },
    { id:'decline', label:'诚实说明今夜不去', hint:'不许明日补偿，也不用白日公事替自己找理由', meta:'她会失落，但不会被两份承诺同时吊着', text:event.results.decline, disabled:false },
  ];
}

export function resolveDuskInvitation(state, choiceId) {
  const event = currentDuskInvitation(state);
  const choice = duskInvitationOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok:false, error:'这次主动邀约已经错过去了。' };
  if (choiceId === 'accept') {
    changeRel(state, event.heroine, { qing:5, yu:4, du:-3 }, '她主动来请，而你没有让这份需要继续藏在院门后');
    changeRel(state, event.witness, { du:3 }, `${HEROINES[event.heroine].short}的主动邀约当着她的面得到回应`);
    changeBond(state, event.heroine, event.witness, -1);
  } else if (choiceId === 'open') {
    changeRel(state, event.heroine, { qing:3, du:-4 }, '她的主动要求可以在旁院看见的地方说清，而不被嘲成争宠');
    changeRel(state, event.witness, { qing:2, du:-3 }, `她亲耳听见${HEROINES[event.heroine].short}要的是什么，不必再猜`);
    changeBond(state, event.heroine, event.witness, 5);
    changeResources(state, { house:3, exposure:1 });
  } else {
    changeRel(state, event.heroine, { qing:1, du:4 }, '你拒绝了今夜，却没有再许一个用来拖延的明日');
    changeRel(state, event.witness, { qing:1 }, `她看见你没有用假承诺哄住${HEROINES[event.heroine].short}`);
    changeResources(state, { house:1 });
  }
  record(state, 'dusk_invitation', { event:event.event, heroine:event.heroine, witness:event.witness, choice:choiceId });
  state.log.push(choice.text);
  state.duskInvitationAftermath = {
    event:event.event, heroine:event.heroine, witness:event.witness, approach:choiceId, beat:0, resolution:null,
  };
  state.duskInvitation = null;
  state.phase = 'dusk_invitation_aftermath';
  return { ok:true, text:choice.text };
}

export function currentDuskInvitationAftermath(state) {
  if (state.phase !== 'dusk_invitation_aftermath' || !state.duskInvitationAftermath) return null;
  const row = state.duskInvitationAftermath;
  const event = DUSK_INVITATIONS[row.heroine];
  const chapter = DUSK_INVITATION_AFTERMATHS[row.heroine]?.[row.approach];
  if (!event
    || !chapter
    || row.event !== event.id
    || row.witness !== event.witness
    || !['accept', 'open', 'decline'].includes(row.approach)
    || !Number.isInteger(row.beat)
    || row.beat < 0
    || row.beat > 2) return null;
  if (row.resolution) {
    const choice = chapter.choices.find((item) => item.id === row.resolution.choice);
    if (!choice || row.resolution.text !== choice.body) return null;
    return {
      ...row, count:4, step:3, speaker:row.heroine, current:{ title:choice.title, body:choice.body },
      choice, resolved:true, awaitingChoice:false,
    };
  }
  if (row.beat === 0) {
    return {
      ...row, count:4, step:0, speaker:row.heroine,
      current:{ title:'她先接住了你的回答', body:event.results[row.approach] },
      resolved:false, awaitingChoice:false,
    };
  }
  const beat = chapter.beats[row.beat - 1];
  if (!beat) return null;
  return {
    ...row, count:4, step:row.beat,
    speaker:beat.speaker === 'witness' ? row.witness : row.heroine,
    current:beat, resolved:false, awaitingChoice:row.beat === 2,
  };
}

export function duskInvitationAftermathOptions(state) {
  const story = currentDuskInvitationAftermath(state);
  if (!story?.awaitingChoice) return [];
  return DUSK_INVITATION_AFTERMATHS[story.heroine][story.approach].choices.map((choice) => ({
    ...choice,
    meta: `${HEROINES[story.heroine].short}与${HEROINES[story.witness].short}都会记住这项安排`,
    disabled:false,
  }));
}

export function advanceDuskInvitationAftermath(state) {
  const story = currentDuskInvitationAftermath(state);
  if (!story?.current) return { ok:false, error:'这次邀约的后话已经翻过去了。' };
  if (story.resolved) {
    const heroine = story.heroine;
    const approach = story.approach;
    state.duskInvitationAftermath = null;
    state.phase = 'choose_visit';
    if (approach === 'accept') {
      const result = startVisit(state, heroine);
      if (!result.ok) return result;
    }
    return { ok:true };
  }
  if (story.awaitingChoice) return { ok:false, error:'先决定这次主动邀约怎样真正落地。' };
  state.duskInvitationAftermath.beat += 1;
  return { ok:true, text:story.current.body };
}

export function resolveDuskInvitationAftermath(state, choiceId) {
  const story = currentDuskInvitationAftermath(state);
  const choice = duskInvitationAftermathOptions(state).find((item) => item.id === choiceId);
  if (!story || !choice) return { ok:false, error:'这项邀约安排已经接不到了。' };
  applyEffects(state, choice.effects, story.heroine, `主动邀约后续：${choice.label}`);
  if (Object.keys(choice.witnessRel ?? {}).length) {
    changeRel(state, story.witness, choice.witnessRel, `${HEROINES[story.heroine].short}的主动邀约没有把她排除在后果之外`);
  }
  if (choice.pairBond) changeBond(state, story.heroine, story.witness, choice.pairBond);
  record(state, 'dusk_invitation_aftermath', {
    event:story.event, heroine:story.heroine, witness:story.witness, approach:story.approach, choice:choice.id,
  });
  state.log.push(choice.body);
  state.duskInvitationAftermath.resolution = { choice:choice.id, text:choice.body };
  return { ok:true, text:choice.body };
}

export function duskInvitationMemory(state, heroineId) {
  if (!state || !Array.isArray(state.history) || !HEROINE_IDS.includes(heroineId)) return null;
  const source = state.history.find((entry) => entry.type === 'dusk_invitation' && entry.heroine === heroineId);
  const event = DUSK_INVITATIONS[heroineId];
  if (!source || !event
    || source.event !== event.id
    || source.witness !== event.witness
    || !DUSK_INVITATION_APPROACH_LABELS[source.choice]) return null;
  const resolution = state.history.find((entry) => (
    entry.type === 'dusk_invitation_aftermath'
    && entry.day === source.day
    && entry.event === source.event
    && entry.heroine === heroineId
    && entry.witness === source.witness
    && entry.approach === source.choice
  ));
  const chapter = DUSK_INVITATION_AFTERMATHS[heroineId]?.[source.choice];
  const choice = chapter?.choices.find((row) => row.id === resolution?.choice);
  if (!resolution || !chapter || !choice || !HEROINES[source.witness]) return null;
  return {
    day:source.day,
    event:source.event,
    heroine:heroineId,
    witness:source.witness,
    witnessName:HEROINES[source.witness].name,
    approach:source.choice,
    approachLabel:DUSK_INVITATION_APPROACH_LABELS[source.choice],
    invitationTitle:event.title,
    invitationBody:event.body,
    heroineLine:event.heroineLine,
    witnessLine:event.witnessLine,
    approachResult:event.results[source.choice],
    witnessQuestionTitle:chapter.beats[0].title,
    witnessQuestion:chapter.beats[0].body,
    heroineQuestionTitle:chapter.beats[1].title,
    heroineQuestion:chapter.beats[1].body,
    choice:choice.id,
    choiceLabel:choice.label,
    choiceHint:choice.hint,
    title:choice.title,
    outcome:choice.body,
  };
}

function advanceAfterDayAction(state) {
  const householdEvent = HOUSEHOLD_EVENTS[state.day];
  if (householdEvent) {
    state.currentHouseholdEvent = householdEvent.id;
    state.phase = 'household';
  } else if (COUNCIL_EVENTS[state.day]) {
    state.phase = 'council';
  } else if (state.day === 19) {
    const day16 = fivePrivatePriceDay16Source(state);
    state.fivePrivatePrices = {
      event:FIVE_PRIVATE_PRICES.id, day16Mode:day16.mode, day16Result:day16.result,
      protocol:null, replies:[], beat:0, right:null, coalition:null,
    };
    state.phase = 'five_private_prices';
  } else if (state.day === MAX_DAY) {
    state.phase = 'final_reckoning';
  } else {
    if (PUBLIC_EVENTS[state.day]) state.phase = 'banquet';
    else enterVisitHub(state);
  }
}

const FIVE_PRICE_ACCORD = Object.freeze({
  wu_yueniang:'order', pan_jinlian:'truth', li_pinger:'safety', meng_yulou:'grace', sun_xuee:'hearth',
});
const FIVE_PRICE_OUTCOMES = new Set(['accept', 'counter', 'refuse', 'expose']);
const FIVE_PRICE_PROTOCOL_IDS = new Set(FIVE_PRIVATE_PRICES.protocols.map((row) => row.id));
const FIVE_PRICE_RIGHT_IDS = new Set(FIVE_PRIVATE_PRICES.rights.map((row) => row.id));

function fivePrivatePriceDay16Source(state) {
  const row = state.history.find((entry) => entry.type === 'external_rebuttal' && entry.day === 16) ?? null;
  const choice = row?.choice ?? '';
  const result = ['complete','rebuttable','broken'].includes(row?.sourceResult) ? row.sourceResult : null;
  const mode = choice.includes('_street') ? 'street' : choice.includes('_limited') ? 'limited' : 'scoped';
  return { mode, result };
}

function fivePrivatePriceDay16Mode(state) {
  return fivePrivatePriceDay16Source(state).mode;
}

function day19JiaoerMemory(state) {
  const ledger = jiaoerLedger(state);
  const aftermath = ledger.aftermaths[18];
  const echo = DAY19_JIAOER_ECHOES[aftermath] ?? null;
  if (!echo || ledger.choices[18] !== echo.opening) return null;
  const chapter = JIAOER_AFTERMATHS[echo.opening];
  if (!chapter?.choices.some((choice) => choice.id === aftermath)) return null;
  return { ...echo, aftermath };
}

export function jiaoerFateMemory(state) {
  const memory = day19JiaoerMemory(state);
  if (!memory) return null;
  const ledger = jiaoerLedger(state);
  return {
    choice:memory.opening,
    aftermath:memory.aftermath,
    label:memory.label,
    object:memory.object,
    text:memory.fateText,
    ledger:{
      label:ledger.label,
      detail:ledger.detail,
      outstanding:ledger.outstanding,
      settledBy:ledger.settledBy,
    },
  };
}

const FIVE_PRICE_JIAOER_REPLY_BRIDGES = Object.freeze({
  wu_yueniang:'月娘可以限定总印怎样引用它，却不能用正堂一枚印把娇儿的路线、收据、席位或断路收成公物。',
  pan_jinlian:'金莲可以逐字追问门外怎样歪讲它，却不能替娇儿补一句证词、忠心或重新开路。',
  li_pinger:'瓶儿可以保管自己的货封与退路，却不能拿一枚封签抵押娇儿留下的车筹、收据或证人席。',
  meng_yulou:'玉楼可以具名安排递信与回程，却不能把车费、退席路或已经终止的西厢差事写成娇儿长期应办的人情。',
  sun_xuee:'雪娥可以把热饭、车脚与守门工钱逐项入簿，却不能让一顿饭购买回答，也不能给已经搬走的第六把椅子补一个假经手。',
});

function fivePriceJiaoerEcho(state, stage, heroine = null) {
  const memory = day19JiaoerMemory(state);
  if (!memory) return null;
  const text = stage === 'overview' ? memory.overviewText
    : stage === 'right' ? memory.counterText
      : stage === 'resolution' ? memory.resolutionText
        : stage === 'reply' && FIVE_PRICE_JIAOER_REPLY_BRIDGES[heroine]
          ? `第十八日留下的“${memory.label}”仍在桌边。${FIVE_PRICE_JIAOER_REPLY_BRIDGES[heroine]}`
          : memory.replyText;
  return { opening:memory.opening, aftermath:memory.aftermath, label:memory.label, object:memory.object, text };
}

function fivePriceDayPreparation(state, stage, heroine = null) {
  const source = recordedDayPreparation(state, 19, DAY19_PRICE_PREPARATIONS);
  if (!source) return null;
  const preparation = source.preparation;
  const text = stage === 'overview' ? preparation.overviewText
    : stage === 'protocol' ? preparation.protocolText
      : stage === 'right' ? preparation.rightText
        : stage === 'resolution' ? preparation.resolutionText
          : stage === 'reply' ? preparation.replies[heroine]
            : null;
  if (!text) return null;
  return {
    sourceDay:19, sourceAction:source.action, sourceActor:source.actor,
    label:preparation.label, object:preparation.object, text,
  };
}

function fivePriceHistoryBeforeProtocol(state) {
  const index = state.history.findIndex((entry) => entry.type === 'five_price_protocol' && entry.day === 19);
  return state.history.slice(0, index < 0 ? state.history.length : index);
}

function fivePriceBasis(state) {
  const history = fivePriceHistoryBeforeProtocol(state);
  const bonds = derivedBonds(history);
  const stances = derivedRouteStances(history);
  const accords = new Set(history.filter((entry) => entry.type === 'accord_term').map((entry) => entry.term));
  const overrides = Object.fromEntries(HEROINE_IDS.map((id) => [id, 0]));
  for (const entry of history.filter((row) => row.type === 'visit_choice')) {
    for (const flag of routeChoiceById(entry.heroine, entry.choice)?.effects?.flags ?? []) {
      const heroine = OVERRIDE_FLAG_TO_HEROINE[flag];
      if (heroine) overrides[heroine] += 1;
    }
  }
  return { history, bonds, stances, accords, overrides };
}

function fivePriceSupport(basis, heroine) {
  const candidates = HEROINE_IDS
    .filter((id) => id !== heroine)
    .map((id) => {
      const trust = basis.bonds[bondKey(heroine, id)] ?? 0;
      const witnessed = basis.history.some((entry) => (
        entry.type === 'pair_interlude'
        && entry.pair?.includes(heroine)
        && entry.pair?.includes(id)
        && ['listen', 'mediate'].includes(entry.choice)
      ));
      return { heroine:id, trust, witnessed };
    })
    .filter((row) => row.trust >= (row.witnessed ? 6 : 10))
    .sort((left, right) => right.trust - left.trust);
  const strongest = candidates[0] ?? null;
  const supported = !!strongest;
  const ally = strongest?.heroine ?? null;
  return { supported, ally, trust: ally ? basis.bonds[bondKey(heroine, ally)] ?? 0 : null };
}

function fivePriceBreakSource(basis, breakIndex, heroine) {
  const breachFlag = HEROINE_BOUNDARY_FLAGS[heroine]?.broken;
  if (!breachFlag) return null;
  const isBreachChoice = (entry) => (
    entry?.type === 'visit_choice'
    && entry.heroine === heroine
    && (routeChoiceById(heroine, entry.choice)?.effects?.flags ?? []).includes(breachFlag)
  );
  // chooseVisit 会先应用 effects（此时写 route_break），再写 visit_choice；旧档与
  // 手工测试也可能保留相反顺序。两种顺序都必须把这项选择识别为破裂源，而非修回。
  const next = basis.history[breakIndex + 1];
  if (next?.day === basis.history[breakIndex]?.day && isBreachChoice(next)) {
    return { entry:next, index:breakIndex + 1 };
  }
  for (let index = breakIndex - 1; index >= 0; index -= 1) {
    if (isBreachChoice(basis.history[index])) return { entry:basis.history[index], index };
  }
  return null;
}

function fivePriceBreakRepair(entry, heroine) {
  return (
    ((entry.type === 'visit_choice' || entry.type === 'accord_term') && entry.heroine === heroine)
    || (entry.type === 'route_aftermath' && entry.heroine === heroine && ['public','direct'].includes(entry.choice))
    || (entry.type === 'memory_reckoning' && entry.heroine === heroine && ['keep','rewrite'].includes(entry.choice))
    || (entry.type === 'favor_reckoning' && entry.heroine === heroine && ['honor','rewrite'].includes(entry.choice))
  );
}

function fivePriceBreakStatus(basis, heroine) {
  let breakIndex = -1;
  for (let index = 0; index < basis.history.length; index += 1) {
    const entry = basis.history[index];
    if (entry.type !== 'route_break' || (entry.heroine !== heroine && entry.heroine !== null)) continue;
    if (entry.heroine === heroine && (basis.overrides[heroine] ?? 0) < BREAK_OVERRIDE_LIMIT) continue;
    breakIndex = index;
  }
  if (breakIndex < 0) return { entry:null, index:-1, source:null, repair:null, unresolved:false };
  const source = basis.history[breakIndex].heroine === heroine
    ? fivePriceBreakSource(basis, breakIndex, heroine)
    : null;
  let repair = null;
  for (let index = breakIndex + 1; index < basis.history.length; index += 1) {
    if (source?.index === index || !fivePriceBreakRepair(basis.history[index], heroine)) continue;
    repair = { entry:basis.history[index], index };
    break;
  }
  return {
    entry:basis.history[breakIndex],
    index:breakIndex,
    source,
    repair,
    unresolved:!repair,
  };
}

function fivePriceUnresolvedBreak(basis, heroine) {
  return fivePriceBreakStatus(basis, heroine).unresolved;
}

function fivePriceReplyReasons(heroine, { accord, stance, support, arrangement, broken }) {
  const lane = stance.covenant === stance.private ? 'tie' : stance.covenant > stance.private ? 'covenant' : 'private';
  const ally = support.ally ? HEROINES[support.ally].short : null;
  const own = {
    wu_yueniang:[
      broken ? '最近一次越过总印与正堂边界的后果仍未由后来的共账修回，她不会把旧失信假装不存在。' : accord ? '公账之约已经落印，她先问总印究竟只管哪一页。' : '正堂还没有一条可追责的公账之约，她更怕秩序再次只剩一个人担。',
      lane === 'covenant' ? '她近来把总印更多用来分清各院责任。' : lane === 'private' ? '她近来更常把最难看的账留在门内，不肯轻易公开总代表。' : '她在公账分责与门内保留之间尚未偏向一边。',
      ally ? `${ally}的另一枚印如今仍站得住，可以核她没有替别人落款。` : arrangement ? `她仍握着“${arrangement.label}”这条门内约定，只肯按约定范围落印。` : '眼下没有另一院的印能替她证明总印没有越界。',
    ],
    pan_jinlian:[
      broken ? '最近一次公开越过她原话的后果尚未修回，她先防自己的话再次被剪短。' : accord ? '真话之约已经落账，她会先查“不知”、期限和补正权是否仍在。' : '真话之约还没有成为共同规矩，先声对她既是机会也是陷阱。',
      lane === 'covenant' ? '她近来更愿把难听原话留给别人核回。' : lane === 'private' ? '她近来更看重一句只在门内算数的真话。' : '公开纠错与门内真话在她这里仍互不相让。',
      ally ? `${ally}仍肯替她保留被删掉的后半句，而不是替她发言。` : arrangement ? `她记得“${arrangement.label}”怎样约束停问与补话。` : '没有另一道声音能保证首版之后仍有人把漏字补回。',
    ],
    li_pinger:[
      broken ? '最近一次越过她安全边界的后果尚未修回，她先看钥匙与退路是否仍归本人。' : accord ? '安全之约已经落账，她会把抄页、封签和撤回路线分开算。' : '安全之约还没成为宅中规矩，洗名价可能只是换走她唯一的硬封。',
      lane === 'covenant' ? '她近来更愿让货封进入共同证链，但不等于交出私箱。' : lane === 'private' ? '她近来更看重钥匙仍在自己袖里，哪怕共同证链因此变薄。' : '共同封存与本人退路尚未分出先后。',
      ally ? `${ally}仍肯见证她只撤哪一枚封，而不把退路解释成背叛。` : arrangement ? `她仍按“${arrangement.label}”保管自己的钥匙。` : '没有另一院能同时证明货封去向与她仍有撤回权。',
    ],
    meng_yulou:[
      broken ? '最近一次把圆场当作她分内的后果尚未修回，她先查递帖是否又成无期限义务。' : accord ? '具名之约已经落账，她会先分清归还名帖功劳与购买新差事。' : '具名之约还没站稳，漂亮署名很容易重新变成无价收席。',
      lane === 'covenant' ? '她近来更愿把来往人情写成可共同追偿的明帖。' : lane === 'private' ? '她近来更坚持名帖只在本人愿意时借出。' : '共同外事与本人撤帖权在她这里仍需逐次立契。',
      ally ? `${ally}仍能见证哪封帖由谁放行，让她不必独自补全整场。` : arrangement ? `她仍以“${arrangement.label}”衡量这次借名有没有到期。` : '没有另一院替她核递送时辰，迟帖与失帖都会只落她名下。',
    ],
    sun_xuee:[
      broken ? '最近一次把做活人的名字压回“灶上”的后果尚未修回，她先保工簿不再替整案背书。' : accord ? '工簿里的劳动之约已经落账，她会先查人名、时辰与原页是否仍在灶上。' : '工簿里的劳动之约还没成为硬规矩，一页具名也可能离门后重新变成无名认账。',
      lane === 'covenant' ? '她近来更愿把米斗与工名接进共同证链。' : lane === 'private' ? '她近来更坚持原簿留在做活人手里，不拿劳动换宅门体面。' : '共同成案与原簿自持在她这里仍须逐页权衡。',
      ally ? `${ally}仍肯见证原页没有被补成她未见过的整案。` : arrangement ? `她仍用“${arrangement.label}”判断谁有权动灶簿。` : '没有另一院能替做活人证明副页没有吞掉原名。',
    ],
  };
  return own[heroine];
}

function expectedFivePriceReply(state, heroine) {
  const basis = fivePriceBasis(state);
  const accord = basis.accords.has(FIVE_PRICE_ACCORD[heroine]);
  const stance = basis.stances[heroine] ?? { covenant:0, private:0 };
  const support = fivePriceSupport(basis, heroine);
  const broken = fivePriceUnresolvedBreak(basis, heroine);
  const arrangement = latestIntimacyArrangement({ history:basis.history }, heroine);
  const supportCanCounter = support.supported && stance.covenant >= stance.private;
  let outcome = 'accept';
  if (accord && stance.covenant > stance.private) outcome = 'expose';
  else if (accord && stance.private > stance.covenant) outcome = 'refuse';
  else if (accord && support.supported) outcome = 'expose';
  else if (accord && arrangement) outcome = 'refuse';
  else if (accord || supportCanCounter || stance.covenant > stance.private) outcome = 'counter';
  if (broken) outcome = outcome === 'expose' ? 'counter' : outcome === 'counter' ? (accord ? 'refuse' : 'accept') : outcome;
  const reasons = fivePriceReplyReasons(heroine, { accord, stance, support, arrangement, broken });
  return { heroine, offer:FIVE_PRIVATE_PRICES.offers[heroine].id, outcome, reasons };
}

function expectedFivePriceReplies(state) {
  return HEROINE_IDS.map((heroine) => {
    const { reasons, ...stored } = expectedFivePriceReply(state, heroine);
    return stored;
  });
}

function fivePriceCoalition(protocol, right, replies) {
  const members = replies.filter((reply) => (
    ['expose', 'counter'].includes(reply.outcome)
    || (reply.outcome === 'refuse' && (protocol === 'common_floor_annex' || right === 'no_retaliation'))
  )).map((reply) => reply.heroine);
  return {
    kind:members.length === HEROINE_IDS.length ? 'full' : members.length >= 2 ? 'limited' : 'failed',
    members,
  };
}

function applyFivePriceReplyEffects(state, replies) {
  for (const reply of replies) {
    if (reply.outcome === 'expose') {
      changeResources(state, { power:1, exposure:2 });
      changeRel(state, reply.heroine, { qing:1, du:-1 }, '她按自己的院约公开了写给本人的价书');
    } else if (reply.outcome === 'counter') {
      changeResources(state, { house:1 });
      changeRel(state, reply.heroine, { qing:1 }, '她没有照单全收，而是亲手写下可撤回的条件');
    } else if (reply.outcome === 'refuse') {
      changeResources(state, { exposure:-1 });
      changeRel(state, reply.heroine, { du:-1 }, '她拒绝了价，也不需要用忠诚证明这项拒绝');
    } else {
      changeResources(state, { power:-1, house:-1 });
      changeRel(state, reply.heroine, { du:2 }, '她接下对自己有现实价值的价，代价留到外账兑现');
    }
  }
}

function applyFivePriceCounterCost(state, mode, right) {
  if (mode === 'scoped' && right !== 'original_quote') changeResources(state, { power:-1 });
  if (mode === 'limited' && right === 'withdrawal') changeResources(state, { house:-2 });
  if (mode === 'street') changeResources(state, right === 'original_quote' ? { exposure:3, repute:1 } : { exposure:5, repute:-1 });
}

function validStoredFivePriceReplies(replies) {
  return Array.isArray(replies)
    && replies.length === HEROINE_IDS.length
    && replies.every((reply, index) => hasExactKeys(reply, ['heroine', 'offer', 'outcome'])
      && reply.heroine === HEROINE_IDS[index]
      && FIVE_PRIVATE_PRICES.offers[reply.heroine]?.id === reply.offer
      && FIVE_PRICE_OUTCOMES.has(reply.outcome));
}

export function currentFivePrivatePrices(state) {
  if (state.phase !== 'five_private_prices' || state.day !== 19 || !state.fivePrivatePrices) return null;
  const pending = state.fivePrivatePrices;
  const day16 = fivePrivatePriceDay16Source(state);
  if (!hasExactKeys(pending, ['event','day16Mode','day16Result','protocol','replies','beat','right','coalition'])
    || pending.event !== FIVE_PRIVATE_PRICES.id
    || !FIVE_PRIVATE_PRICES.counters[pending.day16Mode]
    || pending.day16Mode !== day16.mode
    || pending.day16Result !== day16.result
    || !Number.isInteger(pending.beat)) return null;
  if (pending.protocol === null) {
    if (pending.right !== null || pending.coalition !== null || pending.replies.length || ![0, 1].includes(pending.beat)) return null;
    const stage = pending.beat === 0 ? 'overview' : 'protocol';
    const jiaoerEcho = fivePriceJiaoerEcho(state, stage);
    const dayPreparation = fivePriceDayPreparation(state, stage);
    return {
      ...FIVE_PRIVATE_PRICES, stage, beat:pending.beat, count:9,
      day16Mode:pending.day16Mode, day16Result:pending.day16Result,
      awaitingChoice:pending.beat === 1, resolved:false, jiaoerEcho, dayPreparation,
      current:pending.beat === 0
        ? { title:FIVE_PRIVATE_PRICES.title, body:[FIVE_PRIVATE_PRICES.body, dayPreparation?.text, jiaoerEcho?.text].filter(Boolean).join(' ') }
        : { title:'先决定答复权怎样分配', body:['协议只决定谁能看原文、怎样留证，不能替任何人改成接受、拒绝或公开。', dayPreparation?.text, jiaoerEcho?.text].filter(Boolean).join(' ') },
    };
  }
  const protocolHistory = state.history.find((entry) => entry.type === 'five_price_protocol' && entry.day === 19);
  if (!FIVE_PRICE_PROTOCOL_IDS.has(pending.protocol) || !validStoredFivePriceReplies(pending.replies)
    || protocolHistory?.protocol !== pending.protocol
    || JSON.stringify(protocolHistory?.replies) !== JSON.stringify(pending.replies)
    || JSON.stringify(pending.replies) !== JSON.stringify(expectedFivePriceReplies(state))) return null;
  if (pending.right === null) {
    if (pending.coalition !== null || pending.beat < 2 || pending.beat > 7) return null;
    if (pending.beat <= 6) {
      const reply = pending.replies[pending.beat - 2];
      const detail = expectedFivePriceReply(state, reply.heroine);
      const offer = FIVE_PRIVATE_PRICES.offers[reply.heroine];
      const outcome = offer.outcomes[reply.outcome];
      const jiaoerEcho = fivePriceJiaoerEcho(state, 'reply', reply.heroine);
      const dayPreparation = fivePriceDayPreparation(state, 'reply', reply.heroine);
      return {
        ...FIVE_PRIVATE_PRICES, stage:'reply', beat:pending.beat, count:9, awaitingChoice:false, resolved:false,
        day16Mode:pending.day16Mode, day16Result:pending.day16Result,
        protocol:pending.protocol, reply:{ ...reply, reasons:detail.reasons }, offer, outcome, speaker:reply.heroine, jiaoerEcho, dayPreparation,
        current:{ title:outcome.label, body:[offer.offer, outcome.body, dayPreparation?.text, jiaoerEcho?.text].filter(Boolean).join(' ') },
      };
    }
    const counterBase = FIVE_PRIVATE_PRICES.counters[pending.day16Mode];
    const sourceLead = FIVE_PRIVATE_PRICES.resultLeads[pending.day16Result] ?? '';
    const counter = { ...counterBase, sourceResult:pending.day16Result, body:`${sourceLead} ${counterBase.body}` };
    const jiaoerEcho = fivePriceJiaoerEcho(state, 'right');
    const dayPreparation = fivePriceDayPreparation(state, 'right');
    return {
      ...FIVE_PRIVATE_PRICES, stage:'right', beat:7, count:9, awaitingChoice:true, resolved:false,
      day16Mode:pending.day16Mode, day16Result:pending.day16Result,
      protocol:pending.protocol, counter, jiaoerEcho, dayPreparation,
      current:{ title:counter.title, body:[counter.body, dayPreparation?.text, jiaoerEcho?.text].filter(Boolean).join(' ') },
    };
  }
  if (!FIVE_PRICE_RIGHT_IDS.has(pending.right) || pending.beat !== 8
    || !hasExactKeys(pending.coalition, ['kind','members'])
    || !state.history.some((entry) => entry.type === 'five_price_settlement'
      && entry.day === 19 && entry.protocol === pending.protocol && entry.right === pending.right
      && entry.day16Mode === pending.day16Mode
      && entry.day16Result === pending.day16Result
      && JSON.stringify(entry.replies) === JSON.stringify(pending.replies)
      && JSON.stringify(entry.coalition) === JSON.stringify(pending.coalition))
    || JSON.stringify(pending.coalition) !== JSON.stringify(fivePriceCoalition(pending.protocol, pending.right, pending.replies))) return null;
  const names = pending.coalition.members.map((id) => HEROINES[id].short).join('、');
  const result = pending.coalition.kind === 'full'
    ? { title:'五封不同的答复仍能互相作证', body:'没有人被要求同声，五个人却都保留了足够的互证条件。明日可以继续谈五院共同出证，但每页仍须本人放行。' }
    : pending.coalition.kind === 'limited'
      ? { title:'有限互证候选成形，今夜尚无人预签同席', body:`${names}愿意成为明日互证候选；其余院门没有被判作失败者，也不会被强拉进共同授权。外账只能写“候选间互证、非候选者自持”，不能提前把候选叫作盟员。` }
      : { title:'五封各归原主，只保下一条权利底线', body:'今夜没有形成可共同授权的联盟。明日仍须结外账，但不能用付银、见官或分册按钮把这道裂口洗成五院圆满。' };
  const jiaoerEcho = fivePriceJiaoerEcho(state, 'resolution');
  const dayPreparation = fivePriceDayPreparation(state, 'resolution');
  return {
    ...FIVE_PRIVATE_PRICES, stage:'resolution', beat:8, count:9, awaitingChoice:false, resolved:true,
    day16Mode:pending.day16Mode, day16Result:pending.day16Result,
    protocol:pending.protocol, right:pending.right, coalition:{ ...pending.coalition, members:[...pending.coalition.members] },
    jiaoerEcho, dayPreparation,
    current:{ ...result, body:[result.body, dayPreparation?.text, jiaoerEcho?.text].filter(Boolean).join(' ') },
  };
}

export function fivePrivatePriceOptions(state) {
  const current = currentFivePrivatePrices(state);
  if (!current?.awaitingChoice) return [];
  const rows = current.stage === 'protocol' ? FIVE_PRIVATE_PRICES.protocols : FIVE_PRIVATE_PRICES.rights;
  return rows.map((choice) => ({ ...choice, meta:forecastTextFromEffects(choice.effects), disabled:false }));
}

export function chooseFivePrivatePriceProtocol(state, protocolId) {
  const current = currentFivePrivatePrices(state);
  const choice = current?.stage === 'protocol' ? FIVE_PRIVATE_PRICES.protocols.find((row) => row.id === protocolId) : null;
  if (!current || !choice) return { ok:false, error:'五封价书还没有摊到这一步。' };
  const replies = expectedFivePriceReplies(state);
  applyEffects(state, choice.effects, null, `五封私价协议：${choice.label}`);
  applyFivePriceReplyEffects(state, replies);
  record(state, 'five_price_protocol', { event:FIVE_PRIVATE_PRICES.id, protocol:choice.id, replies:structuredClone(replies) });
  state.fivePrivatePrices.protocol = choice.id;
  state.fivePrivatePrices.replies = structuredClone(replies);
  state.fivePrivatePrices.beat = 2;
  state.log.push(choice.text);
  const first = currentFivePrivatePrices(state);
  return { ok:true, text:choice.text, announcement:`${choice.label}。五个人将按各自前史答复，你不能替她们改口。${first?.current?.title ?? ''}。` };
}

export function chooseFivePrivatePriceRight(state, rightId) {
  const current = currentFivePrivatePrices(state);
  const choice = current?.stage === 'right' ? FIVE_PRIVATE_PRICES.rights.find((row) => row.id === rightId) : null;
  if (!current || !choice) return { ok:false, error:'外面的反招还没有逼到保权这一问。' };
  applyEffects(state, choice.effects, null, `五封私价保权：${choice.label}`);
  applyFivePriceCounterCost(state, state.fivePrivatePrices.day16Mode, choice.id);
  const coalition = fivePriceCoalition(state.fivePrivatePrices.protocol, choice.id, state.fivePrivatePrices.replies);
  record(state, 'five_price_settlement', {
    event:FIVE_PRIVATE_PRICES.id, day16Mode:state.fivePrivatePrices.day16Mode,
    day16Result:state.fivePrivatePrices.day16Result,
    protocol:state.fivePrivatePrices.protocol, right:choice.id,
    replies:structuredClone(state.fivePrivatePrices.replies), coalition:structuredClone(coalition),
  });
  state.fivePrivatePrices.right = choice.id;
  state.fivePrivatePrices.coalition = coalition;
  state.fivePrivatePrices.beat = 8;
  state.log.push(choice.text);
  const result = currentFivePrivatePrices(state);
  return { ok:true, text:choice.text, announcement:`${choice.label}已经成为明日外账的权利底线。${result?.current?.title ?? ''}。` };
}

export function advanceFivePrivatePrices(state) {
  const current = currentFivePrivatePrices(state);
  if (!current) return { ok:false, error:'五封私价这一页没有接上。' };
  if (current.awaitingChoice) return { ok:false, error:current.stage === 'protocol' ? '先决定五封答复怎样寄出。' : '三种权利只能先保住一种。' };
  if (current.resolved) {
    state.fivePrivatePrices = null;
    enterVisitHub(state);
    return { ok:true, announcement:'五封私价已按真实候选与权利缺口落账，今夜是否同席仍由本人决定。' };
  }
  state.fivePrivatePrices.beat += 1;
  const next = currentFivePrivatePrices(state);
  const speaker = next?.stage === 'reply' ? `${HEROINES[next.reply.heroine].short}按自己的前史作答：${next.outcome.label}。` : '';
  return { ok:true, announcement:`${speaker}${next?.current?.title ?? ''}。${next?.current?.body ?? ''}` };
}

export function jointActionOptions(state) {
  const completed = completedJointActions(state);
  return JOINT_ACTIONS.map((choice) => {
    const missing = choice.requires.filter((key) => !state.accords?.[key]);
    const used = completed.has(choice.id);
    const unaffordable = cannotAfford(state, choice);
    const pairTrust = choice.participants?.length === 2 ? bondValue(state, choice.participants[0], choice.participants[1]) : 0;
    const estranged = pairTrust < -10;
    const beforeAllianceAct = state.day < 6;
    return {
      ...choice,
      meta: `${bondTier(pairTrust)} · 默契 ${pairTrust >= 0 ? '+' : ''}${pairTrust}`,
      disabled: state.phase !== 'day' || beforeAllianceAct || used || missing.length > 0 || unaffordable || estranged,
      locked: beforeAllianceAct
        ? '第一幕先听完五份院约。第六日人情成网后，联院差事才会开启。'
        : used
        ? '这一组已经合办过一桩，不再重复刷同一件事。'
        : missing.length
          ? `还缺院约：${missing.map((key) => accordStatus(state).find((row) => row.key === key)?.label).join('、')}。`
          : estranged
            ? `${choice.participants.map((id) => HEROINES[id].short).join('与')}眼下彼此不肯递证。先在白日让她们接过一次话。`
          : unaffordable
            ? costLockedText(choice)
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
  applyEffects(state, choice.effects, null, `联院差事：${choice.label}`);
  if (choice.participants?.length === 2) changeBond(state, choice.participants[0], choice.participants[1], 8);
  const pressure = resolvePressure(state, choice.id, true);
  state.jointActions.push(choice.id);
  state.selectedDayAction = choice.id;
  // 联院差事不消耗玩家先前在证据板上点中的口风，也不能把那次点选
  // 泄漏进黄昏存档；当天白日动作已经由两院共同完成，证据选择回到空位。
  state.selectedSecret = null;
  state.currentJointAction = choice.id;
  state.jointActionBeat = 0;
  record(state, 'joint_action', { action: choice.id, participants: [...choice.participants], resolved: pressure.resolved });
  const text = `${choice.text} ${pressure.text}`;
  state.log.push(text);
  state.phase = 'joint_result';
  return { ok: true, text };
}

export function currentJointAction(state) {
  const choice = JOINT_ACTIONS.find((row) => row.id === state.currentJointAction);
  if (!choice || !Number.isInteger(state.jointActionBeat)) return null;
  return {
    ...choice,
    beat: state.jointActionBeat,
    count: choice.story.length,
    storyBeat: choice.story[state.jointActionBeat] ?? null,
  };
}

function portablePrecedentSourceHistory(state) {
  const action = state.portablePrecedent?.action
    ?? state.history.find((entry) => entry.type === 'portable_precedent')?.action
    ?? null;
  const jointIndex = state.history.findIndex((entry) => entry.type === 'joint_action' && entry.action === action);
  return state.history.slice(0, jointIndex < 0 ? state.history.length : jointIndex + 1);
}

function portablePrecedentBasis(history) {
  const overrides = Object.fromEntries(HEROINE_IDS.map((id) => [id, 0]));
  for (const entry of history.filter((row) => row.type === 'visit_choice')) {
    for (const flag of routeChoiceById(entry.heroine, entry.choice)?.effects?.flags ?? []) {
      const heroine = OVERRIDE_FLAG_TO_HEROINE[flag];
      if (heroine) overrides[heroine] += 1;
    }
  }
  return {
    history,
    bonds:derivedBonds(history),
    stances:derivedRouteStances(history),
    accords:new Set(history.filter((entry) => entry.type === 'accord_term').map((entry) => entry.term)),
    overrides,
  };
}

function portablePrecedentReplyFromBasis(basis, event, joint, heroine) {
  const pair = basis.history.find((entry) => entry.type === 'pair_interlude'
    && entry.pair?.includes(joint.participants[0]) && entry.pair?.includes(joint.participants[1])) ?? null;
  const stance = basis.stances[heroine] ?? { covenant:0, private:0 };
  const lane = stance.covenant === stance.private ? 'tie' : stance.covenant > stance.private ? 'covenant' : 'private';
  const broken = fivePriceUnresolvedBreak(basis, heroine);
  const trust = basis.bonds[bondKey(joint.participants[0], joint.participants[1])] ?? 0;
  const accordKey = Object.values(ACCORD_META).find((row) => row.heroine === heroine)?.key ?? null;
  const accord = accordKey ? basis.accords.has(accordKey) : false;
  let outcome = 'narrow';
  if (broken || (pair?.choice === 'claim' && lane === 'private')) outcome = 'withdraw';
  else if (pair?.choice === 'listen' || (lane === 'covenant' && trust >= 0)) outcome = 'stand';
  const laneText = lane === 'covenant'
    ? `共同承担 ${stance.covenant} 次，多于门内保留 ${stance.private} 次`
    : lane === 'private'
      ? `门内保留 ${stance.private} 次，多于共同承担 ${stance.covenant} 次`
      : `共同承担与门内保留同为 ${stance.covenant} 次`;
  const pairText = pair?.choice === 'listen'
    ? '此前双院私议由她们自己听完彼此边界，这次可以共同守住原规则'
    : pair?.choice === 'mediate'
      ? '此前双院私议只同意有限调停，这次也只放行本人范围'
      : pair?.choice === 'claim'
        ? '此前双院私议曾被拉回争宠，她防着程序再次只服务宅主'
        : `两院现有互信为 ${trust >= 0 ? '+' : ''}${trust}，没有一场私议替她们预先同声`;
  const reasons = [
    accord ? `本院院约已经落账，外人只能援引她确实参与执行的条款。` : '本院院约尚未落稳，她不会把一次合办说成永久授权。',
    `${laneText}。${pairText}。`,
    broken ? '最近一次越界仍未修回；撤回是阻止旧话冒充新程序，不是闹脾气。' : (event.replies?.[heroine]?.[outcome]?.reason ?? '她只处分自己亲手签过、见过或保管的部分。'),
  ];
  return { heroine, outcome, reasons };
}

function portablePrecedentReplies(history, actionId) {
  const event = PORTABLE_PRECEDENTS[actionId];
  const joint = JOINT_ACTIONS.find((row) => row.id === actionId);
  if (!event || !joint) return [];
  const jointIndex = history.findIndex((entry) => entry.type === 'joint_action' && entry.action === actionId);
  const basis = portablePrecedentBasis(history.slice(0, jointIndex < 0 ? history.length : jointIndex + 1));
  return joint.participants.map((heroine) => portablePrecedentReplyFromBasis(basis, event, joint, heroine));
}

function expectedPortablePrecedentReplies(history, actionId) {
  return portablePrecedentReplies(history, actionId).map(({ reasons, ...stored }) => {
    return stored;
  });
}

function portablePrecedentScope(choiceId, replies) {
  if (choiceId === 'inside_only') return 'inside';
  if (replies.some((reply) => reply.outcome === 'withdraw')) return 'withdrawn';
  if (choiceId === 'named_exception') return 'exception';
  if (replies.some((reply) => reply.outcome === 'narrow')) return 'bounded';
  return 'portable';
}

function portablePrecedentSourceEcho(history, event) {
  const day5 = history.find((entry) => entry.type === 'public_followup' && entry.day === 5)?.choice ?? null;
  if (day5 === 'follow_5_name_everyone' && event?.outsider?.id === 'ying_bojue') {
    return '第五日那份逐名副本是玳安亲手送给应伯爵的；他只能据收到的名字与条款来问。';
  }
  return `${event.outsider.name}只持有上一桩差事当面交付的${event.object.portable}，并以${event.object.matchingMarks.join('、')}核它的来路；他不知道院门里的关系史与私物位置。`;
}

function portableResolution(event, choiceId, scope) {
  if (scope === 'withdrawn') {
    const respondents = event.participants.map((heroine) => HEROINES[heroine]?.short ?? heroine).join('与');
    return {
      title:'照撤回落界',
      scopeLabel:'撤回优先，未形成院外先例',
      body:`${respondents}的两份答复分页保留，任何一份撤回都足以阻止这套合办规则外推。${event.outsider.name}带着标明“未获共同授权”的${event.object.portable}离开；他原有的收据、工钱或追索权保留，但不能再借另一人的答复续推。`,
      steps:[
        '两份答复各自落印，不合并成一张共同授权',
        `${event.outsider.name}在${event.object.portable}上签收“未获共同授权”`,
        `${event.object.source}与既有收据各归原持有人，不撤销旧权利`,
      ],
    };
  }
  const row = event?.resolutions?.[choiceId];
  const resolution = row?.[scope] ?? row?.default ?? row ?? null;
  if (!resolution) return null;
  const scopeLead = ({
    portable:'两个人都独立守住旧规矩，这张副契只把同样的成本、叫停与纠错权携到这一名院外经手人手里。',
    bounded:'两个人没有授权同样宽的范围；第二张契只执行较窄交集，外人不能把其中一人的放行扩成另一人的同意。',
    withdrawn:'至少一人已经撤回外推授权；这里尊重撤回，只结清外人原有的收据、工资或追索，不把合办强称成院外常规。',
    exception:'这不是通行先例：受益人、物件、期限与责任人都写在本页，期限一到便须重新请求。',
    inside:'旧规矩仍供宅内复盘，却不授院外执行权；外人已经取得的工资、收据和追索并不因此作废。',
  })[scope] ?? '';
  return { ...resolution, scopeLabel:({
    portable:'一名外人可携副契援引一次', bounded:'只可援引两人共同授权的窄界', withdrawn:'撤回优先，未形成院外先例',
    exception:'具名限次，不形成通例', inside:'只留宅内，外人保留既得权利',
  })[scope] ?? resolution.scopeLabel, body:[scopeLead, resolution.body].filter(Boolean).join(' ') };
}

function startPortablePrecedent(state, actionId) {
  const event = PORTABLE_PRECEDENTS[actionId];
  const source = state.history.find((entry) => entry.type === 'joint_action' && entry.action === actionId);
  if (!event || !source || state.history.some((entry) => entry.type === 'portable_precedent')) return false;
  state.portablePrecedent = { event:event.id, action:actionId, sourceDay:source.day, beat:0, choice:null };
  state.phase = 'portable_precedent';
  return true;
}

export function currentPortablePrecedent(state) {
  const pending = state.portablePrecedent;
  const event = pending ? PORTABLE_PRECEDENTS[pending.action] : null;
  if (state.phase !== 'portable_precedent' || !pending || !event) return null;
  const history = portablePrecedentSourceHistory(state);
  const replies = portablePrecedentReplies(history, pending.action);
  if (replies.length !== 2 || !replies.every((reply) => PORTABLE_PRECEDENT_OUTCOMES.has(reply.outcome))) return null;
  const sourceEcho = portablePrecedentSourceEcho(history, event);
  const reply = pending.beat === 1 ? replies[0] : pending.beat === 2 ? replies[1] : null;
  const response = reply ? event.replies?.[reply.heroine]?.[reply.outcome] ?? null : null;
  const scope = pending.choice ? portablePrecedentScope(pending.choice, replies) : null;
  const resolution = pending.choice ? portableResolution(event, pending.choice, scope) : null;
  const current = pending.beat === 0
    ? { ...event.opening, body:[event.opening?.body, sourceEcho].filter(Boolean).join(' ') }
    : pending.beat < 3
      ? response
      : pending.beat === 3
        ? {
          title:'两个人已经分别作答，现在只能裁决外用范围',
          body:`${event.outsider.name}只拿着${event.object.portable}与${event.object.matchingMarks.join('、')}来援引；${event.object.check} 你不能替两个人改答，只能决定怎样执行她们仍共同授权的部分。`,
        }
        : resolution;
  if (!current) return null;
  return {
    event:event.id, action:pending.action, sourceDay:pending.sourceDay, outsider:event.outsider,
    participants:[...JOINT_ACTIONS.find((row) => row.id === pending.action).participants],
    beat:pending.beat, count:5, stage:['opening','reply','reply','decision','resolution'][pending.beat],
    current, reply, replies:replies.map((row) => ({ ...row, reasons:[...row.reasons] })),
    response, choice:pending.choice, scope, resolution,
    awaitingChoice:pending.beat === 3 && pending.choice === null,
    resolved:pending.beat === 4 && pending.choice !== null,
  };
}

export function portablePrecedentOptions(state) {
  const story = currentPortablePrecedent(state);
  if (!story?.awaitingChoice) return [];
  const event = PORTABLE_PRECEDENTS[story.action];
  return event.choices.map((choice) => {
    const scope = portablePrecedentScope(choice.id, story.replies);
    if (scope === 'withdrawn' && choice.id === 'honor_precedent') return {
      ...choice, scope,
      label:'照撤回落界',
      hint:'不把合办强推到院外；外人保留此前已经取得的收据、工资与追索权',
      text:choice.withdrawText ?? choice.text,
      effects:{},
      effectsByScope:{ ...(choice.effectsByScope ?? {}), withdrawn:{} },
      disabled:false, locked:'',
    };
    if (scope === 'withdrawn') return {
      ...choice, scope, disabled:true,
      locked:'至少一人已撤回外推授权；不能绕过她改立具名例外。',
    };
    const effects = choice.effectsByScope?.[scope] ?? choice.effects;
    const effectiveChoice = { ...choice, effects };
    const resolution = scope === 'bounded' ? portableResolution(event, choice.id, scope) : null;
    const disabled = cannotAfford(state, effectiveChoice);
    return {
      ...effectiveChoice, scope,
      ...(resolution ? { label:resolution.title, hint:resolution.scopeLabel, text:resolution.body } : {}),
      disabled,
      locked:disabled ? costLockedText(effectiveChoice) : '',
    };
  });
}

export function advancePortablePrecedent(state) {
  const story = currentPortablePrecedent(state);
  if (!story) return { ok:false, error:'第二张契没有接上上一桩合办。' };
  if (story.awaitingChoice) return { ok:false, error:'先决定这条规矩怎样面对亲手来援引它的人。' };
  if (story.resolved) {
    const text = story.current.body;
    state.portablePrecedent = null;
    advanceAfterDayAction(state);
    return { ok:true, text, announcement:`${story.outsider.name}已经按“${story.current.title}”带走、限用或拒绝了第二张契。` };
  }
  state.portablePrecedent.beat += 1;
  const next = currentPortablePrecedent(state);
  return { ok:true, announcement:next?.stage === 'reply' ? `${HEROINES[next.reply.heroine].short}自主决定：${next.response.title}。` : `${next?.current?.title ?? '第二张契继续'}。` };
}

export function choosePortablePrecedent(state, choiceId) {
  const story = currentPortablePrecedent(state);
  const choice = portablePrecedentOptions(state).find((row) => row.id === choiceId);
  if (!story?.awaitingChoice || !choice) return { ok:false, error:'第二张契还没到可以裁决的时候。' };
  if (choice.disabled) return { ok:false, error:choice.locked || '眼下承担不起这项先例。' };
  const scope = portablePrecedentScope(choice.id, story.replies);
  const effects = choice.effectsByScope?.[scope] ?? choice.effects;
  applyEffects(state, effects, null, `院外援例：${choice.label}`);
  const replies = story.replies.map(({ heroine, outcome }) => ({ heroine, outcome }));
  record(state, 'portable_precedent', {
    event:story.event, action:story.action, sourceDay:story.sourceDay, outsider:story.outsider.id,
    participants:[...story.participants], replies, choice:choice.id, scope,
  });
  state.portablePrecedent.choice = choice.id;
  state.portablePrecedent.beat = 4;
  const result = currentPortablePrecedent(state);
  state.log.push(result.current.body);
  return { ok:true, text:result.current.body, announcement:`${choice.label}已经落字。${result.current.title}。` };
}

export function recordedPortablePrecedent(state) {
  const row = state?.history?.find((entry) => entry.type === 'portable_precedent') ?? null;
  const event = row ? PORTABLE_PRECEDENTS[row.action] : null;
  if (!row || !event) return null;
  const resolution = portableResolution(event, row.choice, row.scope);
  const disposition = ({
    portable:`${event.object.portable}由${event.outsider.name}亲自持有，可按两份答复同意的范围援引一次`,
    bounded:`${event.object.portable}由${event.outsider.name}持有，但只保留两人共同放行的窄界`,
    withdrawn:`${event.outsider.name}带走标明“未获共同授权”的${event.object.portable}，${event.object.source}归原持有人`,
    exception:`${event.object.portable}由${event.outsider.name}持到具名期限届满，届时剪角作废`,
    inside:`${event.outsider.name}带走被拒原页作记录，${event.object.source}与执行权留在宅内`,
  })[row.scope] ?? '';
  return {
    action:row.action, sourceDay:row.sourceDay, outsider:{ ...event.outsider }, participants:[...row.participants],
    replies:row.replies.map((reply) => ({ ...reply })), choice:row.choice, scope:row.scope,
    object:{ ...event.object, matchingMarks:[...event.object.matchingMarks] },
    title:resolution?.title ?? event.title, body:resolution?.body ?? '', disposition,
  };
}

export function continueJointAction(state) {
  const current = currentJointAction(state);
  if (state.phase !== 'joint_result' || !current?.storyBeat) {
    return { ok: false, error: '眼下没有待收的联院差事。' };
  }
  if (state.jointActionBeat < current.count - 1) {
    state.jointActionBeat += 1;
    return { ok: true, text: current.storyBeat.body };
  }
  const text = current.storyBeat.body;
  const actionId = current.id;
  state.currentJointAction = null;
  state.jointActionBeat = 0;
  if (!startPortablePrecedent(state, actionId)) advanceAfterDayAction(state);
  return { ok: true, text };
}

function householdHistoryChoice(state, day) {
  return state.history.find((entry) => entry.type === 'household' && entry.day === day)?.choice ?? null;
}

function householdAftermathHistoryChoice(state, day) {
  return state.history.find((entry) => entry.type === 'household_aftermath' && entry.day === day)?.choice ?? null;
}

function recordedCouncilVariant(state, day, variants) {
  const event = COUNCIL_EVENTS[day];
  const entry = [...state.history].reverse().find((row) => row.type === 'council' && row.day === day);
  const choice = event?.choices.find((row) => row.id === entry?.choice) ?? null;
  const variant = choice ? variants[choice.id] : null;
  return entry
    && event
    && choice
    && variant
    && entry.event === event.id
    && JSON.stringify(entry.participants) === JSON.stringify(event.participants)
    ? { entry, choice, variant }
    : null;
}

function recordedDayPreparation(state, day, preparations) {
  const entry = [...state.history].reverse().find((row) => row.type === 'day_action' && row.day === day);
  const move = entry ? DAY_AGENDAS[day - 1]?.actions?.[entry.action] : null;
  const preparation = entry ? preparations[entry.action] : null;
  return entry && move && preparation && entry.actor === move.actor
    ? { action:entry.action, actor:entry.actor, preparation }
    : null;
}

function recordedJointPreparation(state, day, preparations) {
  const entry = [...state.history].reverse().find((row) => row.type === 'joint_action' && row.day === day);
  const action = entry ? JOINT_ACTIONS.find((row) => row.id === entry.action) : null;
  const preparation = entry ? preparations[entry.action] : null;
  return entry
    && action
    && preparation
    && JSON.stringify(entry.participants) === JSON.stringify(action.participants)
    ? { action:entry.action, actors:[...action.participants], preparation }
    : null;
}

function recordedEarlyJiaoerPreparation(state, day) {
  const direct = day === 4
    ? recordedDayPreparation(state, 4, DAY4_FLOOR_PREPARATIONS)
    : day === 9 ? recordedDayPreparation(state, 9, DAY9_DEED_PREPARATIONS) : null;
  if (direct) return { sourceType:'day_action', ...direct, actors:[direct.actor] };
  const joint = day === 9 ? recordedJointPreparation(state, 9, DAY9_DEED_JOINT_PREPARATIONS) : null;
  return joint ? { sourceType:'joint_action', ...joint, actor:null } : null;
}

function earlyJiaoerPreparationContext(state) {
  const config = state.day === 4
    ? { day:4, preparations:DAY4_FLOOR_PREPARATIONS, variants:DAY4_FLOOR_TRANSACTION_VARIANTS }
    : state.day === 9
      ? { day:9, preparations:DAY9_DEED_PREPARATIONS, variants:DAY9_DEED_TRANSACTION_VARIANTS }
      : null;
  if (!config) return null;
  const source = recordedEarlyJiaoerPreparation(state, config.day);
  if (!source) return null;
  const variant = config.variants[source.action] ?? (source.sourceType === 'joint_action' ? {
    factId:`day9_joint_preparation_${source.action}`,
    opening:{
      title:`${source.preparation.label}，旧契仍等娇儿落字`,
      object:source.preparation.hint,
      body:source.preparation.text,
    },
    choices:null,
  } : null);
  return variant ? { ...source, variant } : null;
}

export function recordedJiaoerFloorDisposition(state) {
  const source = recordedEarlyJiaoerPreparation(state, 4);
  const opening = householdHistoryChoice(state, 4);
  const aftermath = householdAftermathHistoryChoice(state, 4);
  const chapter = opening ? JIAOER_AFTERMATHS[opening] : null;
  const echo = opening ? JIAOER_EARLY_LONG_ECHOES.floor[opening] : null;
  if (!source || !chapter || !echo || !chapter.choices.some((choice) => choice.id === aftermath)) return null;
  return {
    sourceAction:source.action,
    sourceType:source.sourceType,
    sourceActor:source.actor,
    sourceActors:[...source.actors],
    opening,
    aftermath,
    disposition:opening === 'jiaoer_4_buy' ? 'verified_purchase' : 'unverified_clue',
    factId:echo.factId,
    day9:echo.day9,
    day14:echo.day14,
    day18:echo.day18,
  };
}

export function recordedJiaoerDeedDisposition(state) {
  const source = recordedEarlyJiaoerPreparation(state, 9);
  const opening = householdHistoryChoice(state, 9);
  const aftermath = householdAftermathHistoryChoice(state, 9);
  const chapter = opening ? JIAOER_AFTERMATHS[opening] : null;
  const echo = aftermath ? JIAOER_EARLY_LONG_ECHOES.deed[aftermath] : null;
  if (!source || !chapter || !echo || !chapter.choices.some((choice) => choice.id === aftermath)) return null;
  return {
    sourceAction:source.action,
    sourceType:source.sourceType,
    sourceActor:source.actor,
    sourceActors:[...source.actors],
    opening,
    aftermath,
    factId:echo.factId,
    original:{ ...echo.original },
    copy:{ ...echo.copy },
    receipt:echo.receipt ? { ...echo.receipt } : null,
    day14:echo.day14,
    day18:echo.day18,
  };
}

function earlyJiaoerHistoryEchoes(state) {
  const floor = recordedJiaoerFloorDisposition(state);
  const deed = recordedJiaoerDeedDisposition(state);
  if (state.day === 9) return floor ? [{ factId:floor.factId, ...floor.day9 }] : [];
  if (state.day === 14) return [
    floor ? { factId:floor.factId, ...floor.day14 } : null,
    deed ? { factId:deed.factId, ...deed.day14, original:deed.original, copy:deed.copy, receipt:deed.receipt } : null,
  ].filter(Boolean);
  if (state.day === 18) return [
    floor ? { factId:floor.factId, ...floor.day18 } : null,
    deed ? { factId:deed.factId, ...deed.day18, original:deed.original, copy:deed.copy, receipt:deed.receipt } : null,
  ].filter(Boolean);
  return [];
}

function day12DraftContext(state) {
  const council = recordedCouncilVariant(state, 12, COUNCIL_12_DAY14_DRAFT_VARIANTS);
  const preparation = recordedDayPreparation(state, 14, DAY14_DRAFT_PREPARATIONS);
  return council ? {
    sourceChoice:council.choice.id,
    factId:council.variant.factId,
    opening:council.variant.opening,
    permission:council.variant.permission,
    choices:council.variant.choices,
    preparation,
  } : null;
}

function day17TradeContext(state) {
  const council = recordedCouncilVariant(state, 17, COUNCIL_17_DAY18_VARIANTS);
  const preparation = recordedDayPreparation(state, 18, DAY18_TRADE_PREPARATIONS);
  return council ? {
    sourceChoice:council.choice.id,
    factId:council.variant.factId,
    opening:council.variant.opening,
    permission:council.variant.permission,
    choices:council.variant.choices,
    aftermaths:council.variant.aftermaths,
    day20:council.variant.day20,
    preparation,
  } : null;
}

export function recordedDay14DraftDisposition(state) {
  const opening = householdHistoryChoice(state, 14);
  const aftermath = householdAftermathHistoryChoice(state, 14);
  const disposition = aftermath ? DAY14_DRAFT_DISPOSITIONS[aftermath] ?? null : null;
  if (!opening || !aftermath || !disposition) return null;
  const chapter = JIAOER_AFTERMATHS[opening];
  return chapter?.choices.some((choice) => choice.id === aftermath)
    ? { opening, aftermath, disposition }
    : null;
}

export function jiaoerLedger(state) {
  const choices = Object.fromEntries([4, 9, 14, 18].map((day) => [day, householdHistoryChoice(state, day)]));
  const aftermaths = Object.fromEntries([4, 9, 14, 18].map((day) => [day, householdAftermathHistoryChoice(state, day)]));
  const creditOpened = choices[4] === 'jiaoer_4_buy';
  const settledBy = creditOpened
    ? choices[9] === 'jiaoer_9_copy'
      ? '第九日抄契时补清十两'
      : choices[14] === 'jiaoer_14_sign'
        ? '第十四日兑票时扣清十两'
        : ['jiaoer_18_pay', 'jiaoer_18_share'].includes(choices[18])
          ? choices[18] === 'jiaoer_18_pay' ? '第十八日随封口银付清' : '第十八日并入具名分成'
          : null
    : null;
  const outstanding = creditOpened && !settledBy ? 10 : 0;
  let label = creditOpened ? '匣底仍有旧款' : '每笔都按现价';
  let detail = outstanding ? '第四日少付的十两仍在匣底，下一笔买卖会把它单列追收。' : '没有未清尾款；新交易仍会按各自风险重新报价。';
  if (choices[9] === 'jiaoer_9_take') {
    if (aftermaths[9] === 'jiaoer_9_take_return') {
      label = '强取后归还，窄路待修';
      detail = '原契已经归还，西厢只保留付费验真的窄路；后续守约才能继续修复。';
    } else {
      label = '强取原契，消息断路';
      detail = '原件虽然在你手里，娇儿不再替你从西厢递新消息。';
    }
  }
  if (choices[18] === 'jiaoer_18_pay') {
    label = '银货两清';
    detail = aftermaths[18] === 'jiaoer_18_pay_escape_only'
      ? '封口只限逃路，她仍可用自己的名对假账作证。'
      : settledBy ? `封口银、逃路与旧款逐项结清；${settledBy}。` : '封口银与逃路当面两清，她没有因此卖出忠心。';
  } else if (choices[18] === 'jiaoer_18_share') {
    label = aftermaths[18] === 'jiaoer_18_share_long' ? '长期具名合伙' : '具名合伙';
    detail = aftermaths[18] === 'jiaoer_18_share_case'
      ? '她只参与本案追索，结案后按约退席，不自动卖出下一笔消息。'
      : settledBy ? `她以自己名字持有分成并出堂作证；${settledBy}。` : '她以自己名字持有分成并出堂作证，不再只是卖消息的人。';
  } else if (choices[18] === 'jiaoer_18_refuse') {
    label = aftermaths[18] === 'jiaoer_18_refuse_witness' ? '独立证人席' : outstanding ? '不买沉默，旧款未清' : '不买沉默，各自开口';
    detail = aftermaths[18] === 'jiaoer_18_refuse_witness'
      ? '她可自行决定说什么与何时停下，五院提供安全却不购买预定答案。'
      : outstanding ? '她会以自己的名字说话，也保留追讨第四日十两旧款的权利。' : '你没有买她的沉默，她也不替你逃；双方各自承担开口的后果。';
  } else if (settledBy) {
    label = '旧款已清';
    detail = `${settledBy}；下一笔不再把这十两滚成无名人情。`;
  }
  return { choices, aftermaths, creditOpened, settledBy, outstanding, label, detail };
}

const DAY18_NIGHT_LEDGER_DISPOSITIONS = Object.freeze({
  council_7_tonight:Object.freeze({
    jiaoer_18_pay:'四十两只买娇儿亲见的换车站与逃路；第七夜旧院名已经失效，今晚任何一院去处都须本人重新答复，不能随银买断。',
    jiaoer_18_share:'公契把娇儿的逃路与五院答复分栏；每个人只为今晚重新签下的部分负责，旧夜簿不能替任何人加入证言。',
    jiaoer_18_refuse:'你不买逃路，也不把第七夜的旧答复拿来猜谁会开门；每个人今晚仍可重新答、只答一段或不答。',
  }),
  council_7_their_turn:Object.freeze({
    jiaoer_18_pay:'收据逐项列出娇儿可交的路线；五院只保留本人签过的栏，任何部分开放都不能扩成整院去处。',
    jiaoer_18_share:'娇儿只能接入各人亲签的证言范围；金莲的原话、瓶儿的货单、玉楼的名帖与雪娥的工簿不能由另一张签代开。',
    jiaoer_18_refuse:'交易拒绝只处分娇儿自己的路线；五张本人签仍可各自修改或撤回，空签不被解释成共同拒绝或共同同意。',
  }),
  council_7_hide:Object.freeze({
    jiaoer_18_pay:'封口银只买娇儿亲见的逃路，不能购买任何由夜宿空白推出来的院门、忠诚、动机或物件去向。',
    jiaoer_18_share:'合伙证言只写娇儿亲见的车站与票据；没有去处副本，公契不得补写五院私钥、货单、名帖或工簿。',
    jiaoer_18_refuse:'没有交易，也没有默认答案；娇儿与五院各自承担开口，任何沉默都不能被外柜卖成忠诚或背约的证明。',
  }),
});

function householdChoiceWithNightLedger(state, choice) {
  if (state.day !== 18) return choice;
  const ledger = recordedNightLedger(state);
  const disposition = ledger ? DAY18_NIGHT_LEDGER_DISPOSITIONS[ledger.choice]?.[choice.id] : null;
  const publicOpeningText = ledger?.publicOpeningLongEcho.day18.choiceTexts[choice.id];
  return disposition ? {
    ...choice,
    hint:`${choice.hint}；${ledger.day18.permission}`,
    text:[choice.text, disposition, publicOpeningText].filter(Boolean).join(' '),
    nightLedgerDisposition:{
      factId:ledger.factId,
      choice:ledger.choice,
      title:ledger.day18.title,
      text:[disposition, publicOpeningText].filter(Boolean).join(' '),
      publicOpeningChoice:ledger.publicOpeningChoice,
      publicOpeningLabel:ledger.publicOpeningLabel,
      publicOpeningText,
      openingAftermathTexts:[...ledger.publicOpeningLongEcho.day18.aftermathTexts],
    },
  } : choice;
}

function householdChoiceWithEarlyPreparation(state, choice) {
  const context = earlyJiaoerPreparationContext(state);
  const patch = context?.variant.choices?.[choice.id];
  if (!context) return choice;
  return {
    ...choice,
    label:patch?.label ?? choice.label,
    hint:patch ? `${patch.hint}${choice.hint ? `；${choice.hint}` : ''}` : choice.hint,
    text:patch ? `${choice.text} ${patch.text}` : choice.text,
    transactionPreparationDisposition:{
      factId:context.variant.factId,
      sourceType:context.sourceType,
      sourceAction:context.action,
      sourceActor:context.actor,
      sourceActors:[...context.actors],
      title:context.variant.opening.title,
      object:context.variant.opening.object,
    },
  };
}

function householdChoiceWithCouncilRule(state, choice) {
  const context = state.day === 14 ? day12DraftContext(state) : state.day === 18 ? day17TradeContext(state) : null;
  const patch = context?.choices?.[choice.id];
  if (!patch) return choice;
  const ledger = jiaoerLedger(state);
  const debtEcho = ledger.outstanding && ['jiaoer_14_sign','jiaoer_18_pay','jiaoer_18_share','jiaoer_18_refuse'].includes(choice.id)
    ? ` ${choice.text}`
    : '';
  return {
    ...choice,
    label:patch.label,
    hint:`${patch.hint}${ledger.outstanding ? `；${choice.hint}` : ''}`,
    text:`${patch.text}${debtEcho}`,
    councilRuleDisposition:{
      factId:context.factId,
      sourceChoice:context.sourceChoice,
      title:context.opening.title,
      permission:context.permission.text,
      aftermathEcho:patch.aftermathEcho ?? '',
      preparation:context.preparation ? {
        action:context.preparation.action,
        actor:context.preparation.actor,
        label:context.preparation.preparation.label,
      } : null,
    },
  };
}

function householdChoiceWithDebt(state, choice) {
  const ledger = jiaoerLedger(state);
  if (!ledger.outstanding) return choice;
  const effects = { ...(choice.effects ?? {}) };
  if (choice.id === 'jiaoer_9_copy') {
    effects.silver = (effects.silver ?? 0) - ledger.outstanding;
    return { ...choice, hint: '十五两抄契，再补匣底十两旧款', text: '娇儿把抄契钱与旧款分两行收清，才让墨落到最后一字：“这回不是赏，是两笔都按约结了。”', effects };
  }
  if (choice.id === 'jiaoer_14_sign') {
    effects.silver = (effects.silver ?? 0) - ledger.outstanding;
    return { ...choice, hint: '兑六十两，先从回款扣清十两旧账', text: '你签名以后，娇儿先从兑银里划回匣底十两，再把余款推来：“旧价不拖进新风险，往后才有得谈。”', effects };
  }
  if (choice.id === 'jiaoer_18_pay') {
    effects.silver = (effects.silver ?? 0) - ledger.outstanding;
    return { ...choice, hint: '四十两封口，另付十两旧款', text: '娇儿把四十两封口银与十两旧款分成两摞，逐项写明用途，才交出逃路：“两清不是忘了，是每一笔都有名字。”', effects };
  }
  if (choice.id === 'jiaoer_18_share') {
    return { ...choice, hint: '把十两旧款并入具名分成，再换完整证言', text: '娇儿把匣底十两旧款并入第一期分成，在公契落下自己的名字：“旧账不抹，换一种双方都能追的结法。”', effects };
  }
  if (choice.id === 'jiaoer_18_refuse') {
    return { ...choice, hint: '不买她沉默；十两旧款仍由她保留追索', text: '你不买沉默，也没有补那十两。娇儿收回终局单：“我会用自己的名开口，旧款也仍用自己的名来讨。”', effects };
  }
  return choice;
}

function householdChoiceForState(state, choice) {
  const withDebt = householdChoiceWithDebt(state, choice);
  const withPreparation = householdChoiceWithEarlyPreparation(state, withDebt);
  const withCouncil = householdChoiceWithCouncilRule(state, withPreparation);
  return householdChoiceWithNightLedger(state, withCouncil);
}

export function currentHouseholdEvent(state) {
  const event = HOUSEHOLD_EVENTS[state.day];
  if (event?.id !== state.currentHouseholdEvent) return null;
  const previousDay = ({ 9: 4, 14: 9, 18: 14 })[state.day];
  const previousChoice = previousDay ? householdHistoryChoice(state, previousDay) : null;
  const previousAftermathChoice = previousDay ? householdAftermathHistoryChoice(state, previousDay) : null;
  const previousAftermath = previousChoice && previousAftermathChoice
    ? JIAOER_AFTERMATHS[previousChoice]?.choices.find((choice) => choice.id === previousAftermathChoice)
    : null;
  const memory = previousChoice ? JIAOER_RECKONINGS[state.day]?.[previousChoice] ?? '' : '';
  const nightLedger = state.day === 18 ? recordedNightLedger(state) : null;
  const councilRule = state.day === 14 ? day12DraftContext(state) : state.day === 18 ? day17TradeContext(state) : null;
  const transactionPreparation = earlyJiaoerPreparationContext(state);
  const earlyDayEcho = state.day === 4 ? earlyDayLivingContext(state) : null;
  const stoveEcho = state.day === 9 ? day9StoveLivingContext(state) : null;
  const emergencyEcho = state.day === 14 ? day14EmergencyLivingContext(state) : null;
  const vaultEcho = state.day === 18 ? day18VaultLivingContext(state) : null;
  const earlyLedgers = earlyJiaoerHistoryEchoes(state);
  const memoryText = previousAftermath && !earlyLedgers.length
    ? `${memory} 上一笔最后写成“${previousAftermath.label}”：${previousAftermath.text}`
    : memory;
  return {
    ...event,
    text:[event.text, earlyDayEcho?.householdText, stoveEcho?.householdText, emergencyEcho?.householdText, vaultEcho?.householdText, transactionPreparation?.variant.opening.body, councilRule?.opening.body].filter(Boolean).join(' '),
    memory:memoryText,
    transactionPreparation:transactionPreparation ? {
      factId:transactionPreparation.variant.factId,
      sourceType:transactionPreparation.sourceType,
      sourceAction:transactionPreparation.action,
      sourceActor:transactionPreparation.actor,
      sourceActors:[...transactionPreparation.actors],
      label:transactionPreparation.preparation.label,
      title:transactionPreparation.variant.opening.title,
      object:transactionPreparation.variant.opening.object,
      body:transactionPreparation.variant.opening.body,
    } : null,
    earlyDayEcho:earlyDayEcho ? { ...earlyDayEcho } : null,
    stoveEcho:stoveEcho ? { ...stoveEcho } : null,
    emergencyEcho:emergencyEcho ? { ...emergencyEcho } : null,
    vaultEcho:vaultEcho ? { ...vaultEcho } : null,
    earlyLedgers:earlyLedgers.map((row) => ({ ...row })),
    councilRule:councilRule ? {
      factId:councilRule.factId,
      sourceChoice:councilRule.sourceChoice,
      title:councilRule.opening.title,
      object:councilRule.opening.object,
      label:councilRule.permission.label,
      text:councilRule.permission.text,
      actors:[...councilRule.permission.actors],
      preparation:councilRule.preparation ? {
        action:councilRule.preparation.action,
        actor:councilRule.preparation.actor,
        label:councilRule.preparation.preparation.label,
      } : null,
    } : null,
    nightLedger:nightLedger ? {
      factId:nightLedger.factId,
      sourceChoice:nightLedger.sourceChoice,
      actChoice:nightLedger.actChoice,
      choice:nightLedger.choice,
      publicOpeningChoice:nightLedger.publicOpeningChoice,
      publicOpeningLabel:nightLedger.publicOpeningLabel,
      title:nightLedger.day18.title,
      text:`${nightLedger.day18.text} ${nightLedger.publicOpeningLongEcho.day18.text}`,
      permission:nightLedger.day18.permission,
      publicOpeningText:nightLedger.publicOpeningLongEcho.day18.text,
    } : null,
    ledger: jiaoerLedger(state),
    choices: event.choices.map((choice) => householdChoiceForState(state, choice)),
  };
}

export function householdOptions(state) {
  if (state.phase !== 'household') return [];
  return currentHouseholdEvent(state)?.choices.map((choice) => {
    const unaffordable = cannotAfford(state, choice);
    return { ...choice, disabled: unaffordable, locked: unaffordable ? costLockedText(choice) : '' };
  }) ?? [];
}

export function resolveHouseholdEvent(state, choiceId) {
  if (state.phase !== 'household') return { ok: false, error: '廊下这句话已经说过去了。' };
  const event = currentHouseholdEvent(state);
  if (!event) return { ok: false, error: '眼下没有人在这里等你。' };
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '她没听懂你这句话。' };
  if (cannotAfford(state, choice)) return { ok: false, error: costLockedText(choice) };
  applyEffects(state, choice.effects, null, `宅中：${choice.label}`);
  record(state, 'household', { event: event.id, actor: event.actor, choice: choice.id });
  state.log.push(choice.text);
  state.householdAftermath = { event:event.id, choice:choice.id, beat:0, resolution:null };
  state.phase = 'household_aftermath';
  return { ok: true, text: choice.text };
}

function householdAftermathChoiceForState(state, approach, choice) {
  if (state.day !== 18) return choice;
  const context = day17TradeContext(state);
  const patch = context?.aftermaths?.[approach]?.[choice.id];
  if (!patch) return choice;
  return {
    ...choice,
    text:patch.text ? `${choice.text} ${patch.text}` : choice.text,
    disabled:!!patch.disabled,
    locked:patch.disabled ? patch.reason : '',
    councilRuleDisposition:{
      factId:context.factId,
      sourceChoice:context.sourceChoice,
      title:context.opening.title,
      permission:context.permission.text,
    },
  };
}

export function currentHouseholdAftermath(state) {
  if (state.phase !== 'household_aftermath' || !state.householdAftermath) return null;
  const pending = state.householdAftermath;
  const event = HOUSEHOLD_EVENTS[state.day];
  const openingChoice = currentHouseholdEvent(state)?.choices.find((choice) => choice.id === pending.choice);
  const chapter = JIAOER_AFTERMATHS[pending.choice];
  if (!event || event.id !== pending.event || !openingChoice || !chapter) return null;
  if (pending.resolution) {
    const resolution = chapter.choices
      .map((choice) => householdAftermathChoiceForState(state, pending.choice, choice))
      .find((choice) => choice.id === pending.resolution.choice);
    if (!resolution || resolution.text !== pending.resolution.text) return null;
    const publicOpeningText = openingChoice.nightLedgerDisposition?.openingAftermathTexts?.[3];
    return {
      event, approach:pending.choice, witnesses:[...chapter.witnesses], speaker:resolution.speaker,
      beat:3, count:4, awaitingChoice:false,
      current:{ title:resolution.label, body:[resolution.text, publicOpeningText].filter(Boolean).join(' ') },
      resolution:pending.resolution, openingLabel:openingChoice.label,
      transactionPreparationDisposition:openingChoice.transactionPreparationDisposition ?? null,
      nightLedgerDisposition:openingChoice.nightLedgerDisposition ?? null,
      publicOpeningLongEcho:publicOpeningText ? {
        choice:openingChoice.nightLedgerDisposition.publicOpeningChoice,
        label:openingChoice.nightLedgerDisposition.publicOpeningLabel,
        text:publicOpeningText,
      } : null,
      councilRuleDisposition:openingChoice.councilRuleDisposition ?? null,
    };
  }
  const baseCurrent = pending.beat === 0 ? chapter.opening : chapter.beats[pending.beat - 1];
  const publicOpeningText = openingChoice.nightLedgerDisposition?.openingAftermathTexts?.[pending.beat];
  const openingEchoes = [
    ...(pending.beat === 0 ? [
      openingChoice.nightLedgerDisposition?.text,
      openingChoice.councilRuleDisposition?.aftermathEcho,
      openingChoice.councilRuleDisposition?.permission,
    ] : []),
    publicOpeningText,
  ].filter(Boolean);
  const current = openingEchoes.length ? { ...baseCurrent, body:`${baseCurrent.body} ${openingEchoes.join(' ')}` } : baseCurrent;
  return {
    event, approach:pending.choice, witnesses:[...chapter.witnesses], speaker:current?.speaker,
    beat:pending.beat, count:4, awaitingChoice:pending.beat === 2, current, resolution:null,
    openingLabel:openingChoice.label,
    transactionPreparationDisposition:openingChoice.transactionPreparationDisposition ?? null,
    nightLedgerDisposition:openingChoice.nightLedgerDisposition ?? null,
    publicOpeningLongEcho:publicOpeningText ? {
      choice:openingChoice.nightLedgerDisposition.publicOpeningChoice,
      label:openingChoice.nightLedgerDisposition.publicOpeningLabel,
      text:publicOpeningText,
    } : null,
    councilRuleDisposition:openingChoice.councilRuleDisposition ?? null,
  };
}

export function householdAftermathOptions(state) {
  const current = currentHouseholdAftermath(state);
  if (!current?.awaitingChoice) return [];
  const chapter = JIAOER_AFTERMATHS[current.approach];
  return chapter.choices.map((baseChoice) => {
    const choice = householdAftermathChoiceForState(state, current.approach, baseChoice);
    const unaffordable = cannotAfford(state, choice);
    return {
      ...choice,
      disabled:choice.disabled || unaffordable,
      locked:choice.disabled ? choice.locked : unaffordable ? costLockedText(choice) : '',
    };
  });
}

export function advanceHouseholdAftermath(state) {
  const current = currentHouseholdAftermath(state);
  if (!current) return { ok:false, error:'这笔交易的后话已经断了。' };
  if (state.householdAftermath.resolution) {
    state.householdAftermath = null;
    state.currentHouseholdEvent = null;
    if (PUBLIC_EVENTS[state.day]) state.phase = 'banquet';
    else enterVisitHub(state);
    return { ok:true };
  }
  if (current.awaitingChoice) return { ok:false, error:'娇儿还等着你决定这笔账怎样落字。' };
  state.householdAftermath.beat += 1;
  return { ok:true, text:current.current.body };
}

export function resolveHouseholdAftermath(state, choiceId) {
  const current = currentHouseholdAftermath(state);
  const choice = householdAftermathOptions(state).find((row) => row.id === choiceId);
  if (!current || !choice) return { ok:false, error:'这不是眼下能写进票契的结法。' };
  if (choice.disabled) return { ok:false, error:choice.locked };
  applyEffects(state, choice.effects, null, `娇儿收尾：${choice.label}`);
  record(state, 'household_aftermath', {
    event:current.event.id, approach:current.approach, actor:current.event.actor,
    choice:choice.id, witnesses:[...current.witnesses],
  });
  state.householdAftermath.resolution = { choice:choice.id, text:choice.text };
  state.log.push(choice.text);
  return { ok:true, text:choice.text };
}

function recordedPublicFollowupChoice(state, day) {
  const entry = [...state.history].reverse().find((row) => row.type === 'public_followup' && row.day === day);
  const event = PUBLIC_FOLLOWUPS[day];
  const choice = event?.choices.find((row) => row.id === entry?.choice) ?? null;
  return entry && event && choice && entry.event === event.id ? { entry, event, choice } : null;
}

function day7CouncilHistoryContext(state) {
  const source = recordedPublicFollowupChoice(state, 5);
  const actEntry = [...state.history].reverse().find((row) => row.type === 'act_transition' && row.day === 6);
  const variant = source ? COUNCIL_7_HISTORY_VARIANTS[source.choice.id] : null;
  if (!source
    || !variant
    || !actEntry
    || actEntry.event !== ACT_TRANSITIONS[6]?.id
    || !ACT_TRANSITIONS[6].choices.some((choice) => choice.id === actEntry.choice)
    || !variant.day6Echoes[actEntry.choice]) return null;
  return {
    sourceChoice:source.choice.id,
    actChoice:actEntry.choice,
    variant,
    day6Echo:variant.day6Echoes[actEntry.choice],
    day5Opening:day5PublicOpening(state),
  };
}

function recordedNightLedger(state) {
  const row = [...state.history].reverse().find((entry) => (
    entry.type === 'council'
    && entry.day === 7
    && entry.event === COUNCIL_EVENTS[7]?.id
  ));
  const context = day7CouncilHistoryContext(state);
  const echo = row ? COUNCIL_7_LONG_ECHOES[row.choice] : null;
  const openingLongEcho = context?.day5Opening
    ? DAY5_PUBLIC_OPENING_LONG_ECHOES[context.day5Opening.choice]
    : null;
  return row && context && echo && openingLongEcho ? {
    choice:row.choice,
    factId:echo.factId,
    sourceChoice:context.sourceChoice,
    actChoice:context.actChoice,
    publicOpeningChoice:context.day5Opening.choice,
    publicOpeningLabel:context.day5Opening.label,
    publicOpeningLongEcho:openingLongEcho,
    day13:echo.day13,
    day18:echo.day18,
  } : null;
}

function day7CouncilEvent(state, event) {
  const context = day7CouncilHistoryContext(state);
  const accountEcho = day7AccountLivingContext(state);
  let resolved = event;
  if (context) {
    resolved = {
      ...resolved,
      heading:context.variant.opening.title,
      body:[context.variant.opening.body, context.day6Echo, context.day5Opening?.day7Text].filter(Boolean).join(' '),
      object:context.variant.opening.object,
      sourceChoice:context.sourceChoice,
      actChoice:context.actChoice,
      day5Opening:context.day5Opening,
      choices:resolved.choices.map((choice) => {
        const variantChoice = context.variant.choices.find((row) => row.id === choice.id);
        const contextual = variantChoice ? { ...choice, ...variantChoice, effects:choice.effects } : choice;
        const openingText = context.day5Opening?.councilChoiceTexts?.[choice.id];
        return openingText ? {
          ...contextual,
          text:`${contextual.text} ${openingText}`,
          publicOpeningText:openingText,
        } : contextual;
      }),
    };
  }
  return accountEcho ? {
    ...resolved,
    body:`${resolved.body} ${accountEcho.householdText}`,
    accountEcho:{ ...accountEcho },
  } : resolved;
}

function day10To12EvidenceContext(state) {
  const source = recordedPublicFollowupChoice(state, 10);
  const actEntry = [...state.history].reverse().find((row) => row.type === 'act_transition' && row.day === 11);
  const day10Opening = day10PublicOpening(state);
  if (!source
    || !day10Opening
    || !actEntry
    || actEntry.sourceChoice !== source.choice.id
    || !ACT_TRANSITIONS[11]?.choices.some((choice) => choice.id === actEntry.choice)) return null;
  const sourceRows = {
    follow_10_cross_mark:{
      label:'批注原卷仍在宅中',
      noun:'批注原卷与无批注投门纸',
      text:'第六份假口供连同五人批注仍封在宅中，封线未动；第十一日追到的是重抄旧诬指、没有一字新批注的投门纸，不是外人凭空偷到了五院纠错。',
    },
    follow_10_send_bait:{
      label:'诱饵原件仍在门外',
      noun:'油布、米灰、蜡屑与回流时辰',
      text:'第六份假口供仍在门外流转；第十一日带回的是油布结、青米灰和蜡屑组成的回流路线，五院不能把诱饵冒充已经收回的原证。',
    },
    follow_10_burn_again:{
      label:'原纸已烧，只剩有限记词',
      noun:'五份具名记词与原物核验页',
      text:'第六份假口供已经成灰；第十一日只用五份注明出处与不确定处的记词继续追查，任何人都不能宣称恢复了烧毁原文。',
    },
  };
  const actRows = {
    act_11_swap_read:'五院把材料交叉给另一院核过，眼下能共同保管，也必须保留本人撤回。',
    act_11_verify_first:'五院先护住可核的硬证，眼下材料更稳，外部经手却少追到一截。',
    act_11_return_marked:'五院主动放出标记追收话人，眼下多了一条外部路线，也多了一层自己制造的暴露。',
  };
  const row = sourceRows[source.choice.id];
  const originalPagesText = day10Opening.choice === 'public_10_hide'
    ? '四份本人原页与第一张火盆收讫条；第五格已焚待证'
    : '五份各归本人的原页与五处纸边圈字';
  return row ? {
    ...row,
    sourceChoice:source.choice.id,
    actChoice:actEntry.choice,
    actText:actRows[actEntry.choice],
    day10Opening,
    originalPagesText,
  } : null;
}

function day13CouncilLivingContext(state) {
  if (state.day !== 13) return null;
  const memory = day10To12EvidenceContext(state);
  const entry = [...state.history].reverse().find((row) => row.type === 'council' && row.day === 12);
  const event = COUNCIL_EVENTS[12];
  const choice = event?.choices.find((row) => row.id === entry?.choice) ?? null;
  const echo = choice ? DAY13_COUNCIL_ECHOES[choice.id] : null;
  if (!memory || !entry || !choice || !echo
    || entry.event !== event.id
    || JSON.stringify(entry.participants) !== JSON.stringify(event.participants)) return null;
  return {
    choice:choice.id,
    label:echo.label,
    text:`${memory.label}经过第十二日“${choice.label}”以后，今日先以日用与垫付回账，而不是只留成一条权限。`,
    materialText:`昨夜实际分存的是${memory.noun}；原五证状态仍是${memory.originalPagesText}；${memory.actText}`,
    sourceChoice:memory.sourceChoice,
    actChoice:memory.actChoice,
    publicOpeningChoice:memory.day10Opening.choice,
  };
}

function day12CouncilEvent(state, event) {
  const memory = day10To12EvidenceContext(state);
  const saltEcho = day12SaltLivingContext(state);
  let resolved = event;
  const evidenceChoices = memory ? COUNCIL_12_EVIDENCE_VARIANTS[memory.sourceChoice] : null;
  if (memory && evidenceChoices) {
    resolved = {
      ...resolved,
      body:[resolved.body, memory.text, memory.actText, memory.day10Opening.day12Text].join(' '),
      investigationEcho:{ label:memory.label, text:`第十一日落法：${memory.actText}`, sourceChoice:memory.sourceChoice, actChoice:memory.actChoice },
      day10Opening:memory.day10Opening,
      choices:resolved.choices.map((choice) => {
        const evidence = evidenceChoices[choice.id];
        if (!evidence) return choice;
        const effects = { ...choice.effects };
        for (const [key, delta] of Object.entries(evidence.effectDelta)) {
          effects[key] = (effects[key] ?? 0) + delta;
        }
        return {
          ...choice,
          hint:evidence.hint,
          text:[choice.text, evidence.text, memory.day10Opening.councilChoiceTexts[choice.id]].filter(Boolean).join(' '),
          effects,
          publicOpeningText:memory.day10Opening.councilChoiceTexts[choice.id],
        };
      }),
    };
  }
  return saltEcho ? {
    ...resolved,
    body:`${resolved.body} ${saltEcho.householdText}`,
    saltEcho:{ ...saltEcho },
  } : resolved;
}

export function currentCouncilEvent(state) {
  const event = COUNCIL_EVENTS[state.day] ?? null;
  if (!event) return null;
  if (state.day === 7) return day7CouncilEvent(state, event);
  if (state.day === 12) return day12CouncilEvent(state, event);
  if (state.day !== 17) return event;
  const rebuttal = recordedExternalRebuttal(state);
  const echo = rebuttal ? externalDay17Echo(state, rebuttal) : '';
  const streetVersionOpen = rebuttal?.choice.id.endsWith('_street');
  const publicOpening = rebuttal?.publicOpening ?? null;
  const resolved = rebuttal ? {
    ...event,
    body:[event.body, echo, publicOpening?.day17Text].filter(Boolean).join(' '),
    publicOpening,
    choices:event.choices.map((choice) => {
      const contextual = choice.id === 'council_17_each_door' && streetVersionOpen ? {
        ...choice,
        hint:'五份私答无法共同纠错，应伯爵会成为门外唯一可拼接的版本',
        text:`${choice.text} 应伯爵手里的短帖因此成了门外唯一能把五份私答拼在一起的版本；没有共同纠正页，每一次“不答”都会先按他的次序流出去。`,
        effects:{ ...choice.effects, house:(choice.effects.house ?? 0) - 3, exposure:(choice.effects.exposure ?? 0) + 4 },
      } : choice;
      const publicOpeningText = publicOpening?.councilChoiceTexts?.[choice.id];
      return publicOpeningText ? {
        ...contextual,
        text:`${contextual.text} ${publicOpeningText}`,
        publicOpeningText,
      } : contextual;
    }),
    externalEcho:{
      id:rebuttal.event.id,
      sourceResult:rebuttal.sourceResult,
      label:rebuttal.event.label,
      choice:rebuttal.choice.label,
      text:echo,
      publicOpening,
    },
  } : event;
  const crowdEcho = day17CrowdLivingContext(state);
  return crowdEcho ? {
    ...resolved,
    body:`${resolved.body} ${crowdEcho.councilText}`,
    crowdEcho:{ ...crowdEcho },
  } : resolved;
}

export function councilOptions(state) {
  const event = currentCouncilEvent(state);
  if (state.phase !== 'council' || !event) return [];
  const council7Trade = {
    council_7_tonight:'一夜可核，天亮失效',
    council_7_their_turn:'本人掌权，共同索引变窄',
    council_7_hide:'少一份外传，也失去共同纠错',
  };
  return event.choices.map((choice) => {
    const unaffordable = cannotAfford(state, choice);
    const bondDelta = (choice.effects?.bonds ?? []).reduce((sum, row) => sum + row[2], 0);
    const exposureDelta = choice.effects?.exposure ?? 0;
    return {
      ...choice,
      meta: `院间互信 ${bondDelta >= 0 ? '+' : ''}${bondDelta} · ${choice.effects?.house ? `宅${choice.effects.house >= 0 ? '+' : ''}${choice.effects.house}` : '宅不变'} · ${exposureDelta ? `露${exposureDelta >= 0 ? '+' : ''}${exposureDelta}` : '露不变'}${state.day === 7 ? ` · ${council7Trade[choice.id]}` : ''}`,
      disabled: unaffordable,
      locked: unaffordable ? costLockedText(choice) : '',
    };
  });
}

export function resolveCouncil(state, choiceId) {
  if (state.phase !== 'council') return { ok: false, error: '眼下还没到五院当面议这件事。' };
  const event = currentCouncilEvent(state);
  const choice = councilOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '院议里没有这句话。' };
  if (choice.disabled) return { ok: false, error: choice.locked };
  applyEffects(state, choice.effects, null, `${event.title}：${choice.label}`);
  record(state, 'council', { event: event.id, choice: choice.id, participants: [...event.participants] });
  state.log.push(choice.text);
  state.councilAftermath = { event: event.id, choice: choice.id, beat: 0 };
  state.phase = 'council_aftermath';
  return { ok: true, text: choice.text };
}

export function currentCouncilAftermath(state) {
  if (state.phase !== 'council_aftermath' || !state.councilAftermath) return null;
  const event = currentCouncilEvent(state);
  const choice = event?.choices.find((row) => row.id === state.councilAftermath.choice);
  const council7Context = state.day === 7 ? day7CouncilHistoryContext(state) : null;
  const resolution = council7Context
    ? COUNCIL_7_AFTERMATH_VARIANTS[council7Context.sourceChoice]?.[state.councilAftermath.choice]
    : COUNCIL_AFTERMATHS[state.councilAftermath.choice];
  if (!event || !choice || !resolution || state.councilAftermath.event !== event.id) return null;
  const memory = state.day === 12 ? day10To12EvidenceContext(state) : null;
  const evidenceResolution = memory
    ? COUNCIL_12_EVIDENCE_VARIANTS[memory.sourceChoice]?.[state.councilAftermath.choice]
    : null;
  const day10Opening = memory?.day10Opening ?? null;
  const day15Opening = state.day === 17 ? recordedExternalRebuttal(state)?.publicOpening ?? null : null;
  const followups = evidenceResolution?.beats ?? resolution.beats;
  const beats = [
    {
      speaker: resolution.openingSpeaker,
      title: `${HEROINES[resolution.openingSpeaker].short}先把这条规矩说到明处`,
      body: choice.text,
    },
    ...followups,
  ].map((beat, index) => {
    const echoes = [
      council7Context?.day5Opening?.councilAftermathTexts[index],
      day10Opening?.councilAftermathTexts[index],
      day15Opening?.councilAftermathTexts[index],
    ].filter(Boolean);
    return echoes.length ? { ...beat, body:`${beat.body} ${echoes.join(' ')}` } : beat;
  });
  return {
    event: event.id,
    choice: choice.id,
    label: choice.label,
    participants: [...event.participants],
    beat: state.councilAftermath.beat,
    count: beats.length,
    current: beats[state.councilAftermath.beat] ?? null,
    beats,
    day5Opening:council7Context?.day5Opening ? {
      ...council7Context.day5Opening,
      text:council7Context.day5Opening.councilAftermathTexts[state.councilAftermath.beat],
    } : null,
    day10Opening:day10Opening ? {
      ...day10Opening,
      text:day10Opening.councilAftermathTexts[state.councilAftermath.beat],
    } : null,
    day15Opening:day15Opening ? {
      ...day15Opening,
      text:day15Opening.councilAftermathTexts[state.councilAftermath.beat],
    } : null,
  };
}

export function advanceCouncilAftermath(state) {
  const story = currentCouncilAftermath(state);
  if (!story?.current) return { ok: false, error: '这场院议已经散了。' };
  if (story.beat < story.count - 1) {
    state.councilAftermath.beat += 1;
    return { ok: true, text: story.current.body };
  }
  state.councilAftermath = null;
  if (PUBLIC_EVENTS[state.day]) state.phase = 'banquet';
  else enterVisitHub(state);
  return { ok: true };
}

function actTransitionForState(state) {
  const event = ACT_TRANSITIONS[state.day] ?? null;
  if (!event) return null;
  if (state.day === 16) {
    const draftEcho = day15DraftMemory(state);
    return draftEcho ? {
      ...event,
      body:`${event.body} ${draftEcho.day16Text}`,
      draftEcho,
    } : event;
  }
  if (state.day === 6) {
    const day5Opening = day5PublicOpening(state);
    return day5Opening ? {
      ...event,
      body:`${event.body} ${day5Opening.day6Text}`,
      day5Opening,
    } : event;
  }
  if (state.day !== 11) return event;
  const source = recordedPublicFollowupChoice(state, 10);
  const variant = source ? ACT_TRANSITION_VARIANTS[11]?.[source.choice.id] : null;
  const day10Opening = day10PublicOpening(state);
  return variant ? {
    ...event,
    ...variant,
    body:[variant.body, day10Opening?.day11Text].filter(Boolean).join(' '),
    participants:[...event.participants],
    day10Opening,
    sourceEcho:{
      id:source.choice.id,
      label:source.choice.label,
      text:source.choice.text,
    },
  } : event;
}

function actTransitionAftermathForState(state, choiceId) {
  if (state.day === 11) {
    const source = recordedPublicFollowupChoice(state, 10);
    const variant = source ? ACT_TRANSITION_AFTERMATH_VARIANTS[11]?.[source.choice.id]?.[choiceId] : null;
    if (variant) return variant;
  }
  return ACT_TRANSITION_AFTERMATHS[choiceId] ?? null;
}

export function currentActTransition(state) {
  return state.phase === 'act_transition' ? actTransitionForState(state) : null;
}

export function actTransitionOptions(state) {
  const event = currentActTransition(state);
  if (!event) return [];
  return event.choices.map((choice) => ({
    ...choice,
    disabled: cannotAfford(state, choice),
    locked: cannotAfford(state, choice) ? costLockedText(choice) : '',
  }));
}

export function resolveActTransition(state, choiceId) {
  const event = currentActTransition(state);
  const choice = actTransitionOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '这一幕的揭底已经过去了。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '现在承担不起这一步。' };
  applyEffects(state, choice.effects, null, `${event.title}：${choice.label}`);
  const source = state.day === 11 ? recordedPublicFollowupChoice(state, 10) : null;
  record(state, 'act_transition', {
    event:event.id,
    choice:choice.id,
    participants:[...event.participants],
    ...(source ? { sourceChoice:source.choice.id } : {}),
  });
  state.log.push(choice.text);
  state.actAftermath = { event: event.id, choice: choice.id, beat: 0, resolution:null };
  state.phase = 'act_aftermath';
  return { ok: true, text: choice.text };
}

const externalRebuttalChoiceById = (sourceResult, choiceId) => (
  EXTERNAL_REBUTTALS[sourceResult]?.choices.find((choice) => choice.id === choiceId) ?? null
);

function externalEffectSnapshot(state) {
  return {
    resources:Object.fromEntries(RESOURCE_KEYS.map((key) => [key, state.resources[key]])),
    relations:Object.fromEntries(HEROINE_IDS.map((id) => [id, {
      qing:state.relations[id].qing,
      yu:state.relations[id].yu,
      du:state.relations[id].du,
      ignored:state.relations[id].ignored,
      reasons:[...state.relations[id].reasons],
    }])),
  };
}

function authoritativeEffectSnapshot(state) {
  return {
    ...externalEffectSnapshot(state),
    flags:structuredClone(state.flags),
    household:structuredClone(state.household),
    publicOverrides:structuredClone(state.publicOverrides),
    routeReopensOn:structuredClone(state.routeReopensOn),
    bonds:structuredClone(state.bonds),
    routeStances:structuredClone(state.routeStances),
    accords:structuredClone(state.accords),
    visits:structuredClone(state.visits),
    secrets:[...state.secrets], secretsUsed:[...state.secretsUsed],
    jointActions:[...state.jointActions], resolvedPressures:[...state.resolvedPressures],
    unlocked:[...state.unlocked],
  };
}

function recordedExternalRebuttal(state) {
  const row = [...state.history].reverse().find((entry) => entry.type === 'external_rebuttal' && entry.day === 16);
  if (!row) return null;
  const event = EXTERNAL_REBUTTALS[row.sourceResult];
  const publicOpening = day15PublicOpening(state);
  const choice = withDay15PublicOpeningRebuttalChoice(
    externalRebuttalChoiceById(row.sourceResult, row.choice),
    publicOpening,
  );
  return event && choice && row.event === event.id
    ? { row, event, choice, sourceResult:row.sourceResult, publicOpening }
    : null;
}

function externalDay17Echo(state, rebuttal) {
  if (!rebuttal) return '';
  if (!rebuttal.choice.id.includes('_limited')) return rebuttal.choice.day17Echo;
  const evidence = day17ActionEvidence(state);
  return evidence ? `${rebuttal.choice.day17Echo} ${evidence.text}` : rebuttal.choice.day17Echo;
}

function day17ActionEvidence(state) {
  const entry = state.history.find((row) => row.type === 'day_action' && row.day === 17);
  const move = entry ? DAY_AGENDAS[16]?.actions?.[entry.action] : null;
  if (!entry || !move) return null;
  const rule = pressureRuleFor(state.seed, 17);
  const outcome = entry.resolution === 'favor'
    ? DAY_FAVOR_SOLUTIONS[16].resolved
    : entry.resolution === 'clean'
      ? rule.resolved
      : rule.missed;
  return {
    action:entry.action,
    resolution:entry.resolution,
    resolved:entry.resolved,
    label:move.label,
    text:entry.resolved
      ? `第十七日实际用“${move.label}”收口：${outcome} 这才是有限证言之外新增的证据，不会被改写成另一种行动产物。`
      : `第十七日实际做了“${move.label}”，但危局并未收口：${outcome} 有限证言仍可信，门路与账页之间的缺口也仍在。`,
  };
}

function externalRebuttalContext(state) {
  if (state.day !== 16) return null;
  const evidence = publicEvidenceOutcome(state);
  const event = evidence ? EXTERNAL_REBUTTALS[evidence.id] : null;
  const publicOpening = day15PublicOpening(state);
  const actRow = [...state.history].reverse().find((entry) => entry.type === 'act_transition' && entry.day === 16);
  const actChoice = ACT_TRANSITIONS[16]?.choices.find((choice) => choice.id === actRow?.choice);
  if (!event || !actChoice || !evidence?.chain) return null;
  const missingEvidence = PUBLIC_EVIDENCE_CHAIN.evidence.find((item) => !evidence.chain.includes(item.id)) ?? null;
  return {
    ...event,
    choices:event.choices.map((choice) => withDay15PublicOpeningRebuttalChoice(choice, publicOpening)),
    sourceResult:evidence.id,
    sourceOutcome:evidence.outcome,
    sourceChain:[...evidence.chain],
    missingEvidence,
    publicOpening,
    hearingEcho:day16HearingLivingContext(state),
    actChoice:{ id:actChoice.id, label:actChoice.label, text:actChoice.text },
  };
}

export function currentActAftermath(state) {
  if (state.phase !== 'act_aftermath' || !state.actAftermath) return null;
  const event = actTransitionForState(state);
  const choice = event?.choices.find((row) => row.id === state.actAftermath.choice);
  const aftermath = actTransitionAftermathForState(state, state.actAftermath.choice);
  if (!event || !choice || !aftermath || state.actAftermath.event !== event.id) return null;
  if (state.day === 16) {
    const rebuttal = externalRebuttalContext(state);
    if (!rebuttal || !Number.isInteger(state.actAftermath.beat) || state.actAftermath.beat < 0 || state.actAftermath.beat > 2) return null;
    const resolution = state.actAftermath.resolution;
    if (resolution) {
      const resolvedChoice = rebuttal.choices.find((row) => row.id === resolution.choice);
      if (state.actAftermath.beat !== 2
        || !resolvedChoice
        || resolution.text !== resolvedChoice.text) return null;
      return {
        event:event.id, act:event.act, choice:choice.id, label:choice.label,
        participants:[...event.participants], beat:3, count:4,
        current:{ speaker:resolvedChoice.speaker, title:resolvedChoice.resultTitle, body:resolvedChoice.text },
        draftEcho:event.draftEcho ?? null,
        externalRebuttal:{ ...rebuttal, resolution:resolvedChoice },
        awaitingChoice:false, resolved:true,
      };
    }
    const current = state.actAftermath.beat === 0
      ? Object.freeze({ speaker:aftermath.openingSpeaker, title:choice.label, body:choice.text })
      : state.actAftermath.beat === 1
        ? aftermath.beats[0]
        : Object.freeze({
          speaker:aftermath.beats[1].speaker,
          title:rebuttal.title,
          body:[rebuttal.body, rebuttal.publicOpening?.rebuttalText, rebuttal.question].filter(Boolean).join(' '),
        });
    return {
      event:event.id, act:event.act, choice:choice.id, label:choice.label,
      participants:[...event.participants], beat:state.actAftermath.beat, count:4, current,
      draftEcho:event.draftEcho ?? null,
      internalPractice:state.actAftermath.beat === 1 ? aftermath.beats[1] : null,
      externalRebuttal:state.actAftermath.beat === 2 ? rebuttal : null,
      awaitingChoice:state.actAftermath.beat === 2, resolved:false,
    };
  }
  if (state.actAftermath.resolution !== null) return null;
  const day5Opening = state.day === 6 ? day5PublicOpening(state) : null;
  const day10Opening = state.day === 11 ? day10PublicOpening(state) : null;
  const beats = [
    Object.freeze({ speaker: aftermath.openingSpeaker, title: choice.label, body: choice.text }),
    ...aftermath.beats,
  ].map((beat, index) => {
    const echoes = [day5Opening?.actAftermathTexts[index], day10Opening?.actAftermathTexts[index]].filter(Boolean);
    return echoes.length ? { ...beat, body:`${beat.body} ${echoes.join(' ')}` } : beat;
  });
  return {
    event: event.id,
    act: event.act,
    choice: choice.id,
    label: choice.label,
    participants: [...event.participants],
    beat: state.actAftermath.beat,
    count: beats.length,
    current: beats[state.actAftermath.beat] ?? null,
    day5Opening:day5Opening ? { ...day5Opening, text:day5Opening.actAftermathTexts[state.actAftermath.beat] } : null,
    day10Opening:day10Opening ? { ...day10Opening, text:day10Opening.actAftermathTexts[state.actAftermath.beat] } : null,
    awaitingChoice:false,
    resolved:false,
  };
}

export function actAftermathOptions(state) {
  const story = currentActAftermath(state);
  if (!story?.awaitingChoice || !story.externalRebuttal) return [];
  return story.externalRebuttal.choices.map((choice) => ({
    ...choice,
    meta: [
      choice.effects?.house ? `宅${choice.effects.house > 0 ? '+' : ''}${choice.effects.house}` : '',
      choice.effects?.power ? `势${choice.effects.power > 0 ? '+' : ''}${choice.effects.power}` : '',
      choice.effects?.repute ? `声${choice.effects.repute > 0 ? '+' : ''}${choice.effects.repute}` : '',
      choice.effects?.exposure ? `露${choice.effects.exposure > 0 ? '+' : ''}${choice.effects.exposure}` : '',
      choice.effects?.strain ? `耗${choice.effects.strain > 0 ? '+' : ''}${choice.effects.strain}` : '',
    ].filter(Boolean).join(' · '),
    disabled:cannotAfford(state, choice),
    locked:cannotAfford(state, choice) ? costLockedText(choice) : '',
  }));
}

export function resolveActAftermath(state, choiceId) {
  const story = currentActAftermath(state);
  const choice = actAftermathOptions(state).find((row) => row.id === choiceId);
  if (!story?.awaitingChoice || !story.externalRebuttal || !choice) return { ok:false, error:'三人的反问还没有接到能落字的地方。' };
  if (choice.disabled) return { ok:false, error:choice.locked || '眼下承担不起这次复案的代价。' };
  const effectReason = `三口复案：${choice.label}`;
  const beforeEffects = externalEffectSnapshot(state);
  applyEffects(state, choice.effects, null, effectReason);
  state.externalEffectAudit = {
    event:story.externalRebuttal.id,
    choice:choice.id,
    reason:effectReason,
    before:beforeEffects,
    after:externalEffectSnapshot(state),
  };
  record(state, 'external_rebuttal', {
    event:story.externalRebuttal.id,
    sourceResult:story.externalRebuttal.sourceResult,
    sourceChain:[...story.externalRebuttal.sourceChain],
    actChoice:story.choice,
    choice:choice.id,
    actors:EXTERNAL_REBUTTAL_ACTORS.map((actor) => actor.id),
  });
  state.log.push(choice.text);
  state.actAftermath.resolution = { choice:choice.id, text:choice.text };
  return {
    ok:true,
    text:choice.text,
    announcement:`三口复案落字：${choice.resultTitle}。${choice.day17Echo}`,
  };
}

export function advanceActAftermath(state) {
  const current = currentActAftermath(state);
  if (!current) return { ok: false, error: '这次换幕已经翻过去了。' };
  if (current.awaitingChoice) return { ok:false, error:'先决定怎样回应三个人接成一线的反问。' };
  if (current.resolved) {
    state.actAftermath = null;
    state.phase = 'day';
    return { ok:true, text:current.current.body };
  }
  if (current.beat < current.count - 1) {
    state.actAftermath.beat += 1;
    return { ok: true };
  }
  state.actAftermath = null;
  state.phase = 'day';
  return { ok: true };
}

const DAY5_MEAL_MEMORIES = Object.freeze({
  wu_yueniang:Object.freeze({ dish:'温过两遍的莲子羹', trace:'正堂瓷碗的银盖先在夜里起过一层水汽，门房便把“官人在正堂”听成“正堂先领”。' }),
  pan_jinlian:Object.freeze({ dish:'添了桂花酒的热汤', trace:'食盒绳上打着春梅惯用的斜结，她只催过一回，转到门房嘴里却多出一句“官人吩咐”。' }),
  li_pinger:Object.freeze({ dish:'沉香暖盒里的杏仁茶', trace:'瓶儿私院的暖盒先用了公中的银炭，盒底油印后来又被韩道国写成“灶上自用”。' }),
  meng_yulou:Object.freeze({ dish:'末客散后才封的温酒果羹', trace:'卷棚后间的提盒在席散后仍是热的，送盒人因此把一夜周全误传成了往后都该优先。' }),
  sun_xuee:Object.freeze({ dish:'封火前单留的一碗红枣酪', trace:'灶上本为雪娥留的那碗被管事说成“官人那院先要”，连做饭的人也被自己的火排进了宠次。' }),
});

function day5MealMemory(state) {
  const night = [...state.history].reverse().find((entry) => entry.type === 'night' && entry.day === 4 && HEROINE_IDS.includes(entry.heroine));
  const heroine = night?.heroine ?? 'pan_jinlian';
  const person = HEROINES[heroine];
  const meal = DAY5_MEAL_MEMORIES[heroine];
  const action = night?.action ?? 'talk';
  const actionEcho = action === 'leave'
    ? '你虽在门前停下，灶上却已照着去处把这一碗先封好；人离开了，差事没有自己撤回。'
    : action === 'prelude'
      ? '灯还没落，先送一碗热的便已经被当成留宿信号。'
      : '夜里的相见本只属于一扇门，天亮后却被下人抄成了办差次序。';
  return Object.freeze({
    heroine,
    name:person.name,
    short:person.short,
    house:person.house,
    dish:meal.dish,
    trace:`${meal.trace}${actionEcho}`,
    action,
  });
}

function fillDay5MealText(text, memory) {
  if (typeof text !== 'string') return text;
  return text
    .replaceAll('{mealRecipient}', memory.name)
    .replaceAll('{mealShort}', memory.short)
    .replaceAll('{mealHouse}', memory.house)
    .replaceAll('{mealDish}', memory.dish)
    .replaceAll('{mealTrace}', memory.trace);
}

function day5ChoiceForState(choice, memory) {
  return {
    ...choice,
    label:fillDay5MealText(choice.label, memory),
    hint:fillDay5MealText(choice.hint, memory),
    text:fillDay5MealText(choice.text, memory),
  };
}

function day5PublicPreparation(state, memory = day5MealMemory(state)) {
  const source = recordedDayPreparation(state, 5, DAY5_PUBLIC_PREPARATIONS);
  if (!source) return null;
  const fill = (text) => fillDay5MealText(text, memory);
  return {
    sourceDay:5, sourceAction:source.action, sourceActor:source.actor,
    label:source.preparation.label,
    object:fill(source.preparation.object),
    publicText:fill(source.preparation.publicText),
    followupText:fill(source.preparation.followupText),
    choiceTexts:Object.fromEntries(Object.entries(source.preparation.choiceTexts).map(([id, text]) => [id, fill(text)])),
    aftermathTexts:source.preparation.aftermathTexts.map(fill),
  };
}

function day5PublicOpening(state, memory = day5MealMemory(state)) {
  const event = PUBLIC_EVENTS[5];
  const row = [...state.history].reverse().find((entry) => entry.type === 'banquet' && entry.day === 5);
  const choice = event?.choices.find((item) => item.id === row?.choice);
  const opening = choice && row.event === event.id ? DAY5_PUBLIC_OPENINGS[choice.id] : null;
  if (!opening) return null;
  const fill = (text) => fillDay5MealText(text, memory);
  const fillMap = (rows = {}) => Object.fromEntries(
    Object.entries(rows).map(([id, text]) => [id, fill(text)]),
  );
  return {
    ...opening,
    event:event.id,
    label:fill(opening.label),
    endingText:fill(opening.endingText),
    fateText:fill(opening.fateText),
    followupText:fill(opening.followupText),
    choiceLabels:fillMap(opening.choiceLabels),
    choiceReplacementTexts:fillMap(opening.choiceReplacementTexts),
    choiceTexts:fillMap(opening.choiceTexts),
    aftermathTexts:opening.aftermathTexts.map(fill),
    day6Text:fill(opening.day6Text),
    actAftermathTexts:opening.actAftermathTexts.map(fill),
    day7Text:fill(opening.day7Text),
    councilChoiceTexts:fillMap(opening.councilChoiceTexts),
    councilAftermathTexts:opening.councilAftermathTexts.map(fill),
    effectOverrides:Object.fromEntries(
      Object.entries(opening.effectOverrides ?? {}).map(([id, effects]) => [id, { ...effects }]),
    ),
  };
}

function day5PreparationFollowupChoiceForState(choice, preparation) {
  const text = preparation?.choiceTexts?.[choice.id];
  return text ? {
    ...choice,
    hint:`${choice.hint} · 白日原物仍在场`,
    text:`${choice.text} ${text}`,
    dayPreparationText:text,
  } : choice;
}

function day5OpeningFollowupChoiceForState(choice, opening) {
  const coda = opening?.choiceTexts?.[choice.id];
  if (!coda) return choice;
  const replacement = opening.choiceReplacementTexts?.[choice.id];
  const effectOverride = opening.effectOverrides?.[choice.id];
  return {
    ...choice,
    label:opening.choiceLabels?.[choice.id] ?? choice.label,
    hint:`${choice.hint} · 第五日开场责任仍在`,
    text:replacement
      ? [replacement, choice.dayPreparationText].filter(Boolean).join(' ')
      : `${choice.text} ${coda}`,
    effects:effectOverride ? { ...choice.effects, ...effectOverride } : choice.effects,
    publicOpeningText:coda,
  };
}

function day5EventForState(event, state) {
  const mealMemory = day5MealMemory(state);
  const dayPreparation = day5PublicPreparation(state, mealMemory);
  return {
    ...event,
    heading:fillDay5MealText(event.heading, mealMemory),
    body:[fillDay5MealText(event.body, mealMemory), dayPreparation?.publicText].filter(Boolean).join(' '),
    mealMemory,
    dayPreparation:dayPreparation ? { ...dayPreparation, text:dayPreparation.publicText } : null,
    choices:event.choices.map((choice) => day5ChoiceForState(choice, mealMemory)),
  };
}

function day15DraftMemory(state) {
  const draft = recordedDay14DraftDisposition(state);
  const echo = draft ? DAY15_DRAFT_ECHOES[draft.aftermath] : null;
  return draft && echo ? {
    opening:draft.opening,
    aftermath:draft.aftermath,
    disposition:draft.disposition,
    label:echo.label,
    text:echo.publicText,
    evidenceText:echo.evidenceText,
    day16Text:echo.day16Text,
  } : null;
}

function day10PublicPreparation(state) {
  const source = recordedDayPreparation(state, 10, DAY10_PUBLIC_PREPARATIONS);
  return source ? {
    sourceDay:10,
    sourceAction:source.action,
    sourceActor:source.actor,
    label:source.preparation.label,
    object:source.preparation.object,
    publicText:source.preparation.publicText,
    followupText:source.preparation.followupText,
    choiceTexts:{ ...source.preparation.choiceTexts },
    aftermathTexts:[...source.preparation.aftermathTexts],
  } : null;
}

function day10PublicOpening(state) {
  const event = PUBLIC_EVENTS[10];
  const row = [...state.history].reverse().find((entry) => entry.type === 'banquet' && entry.day === 10);
  const choice = event?.choices.find((item) => item.id === row?.choice);
  const opening = choice && row.event === event.id ? DAY10_PUBLIC_OPENINGS[choice.id] : null;
  return opening ? { ...opening, event:event.id } : null;
}

function day10FollowupChoiceForState(choice, preparation) {
  const text = preparation?.choiceTexts?.[choice.id];
  return text ? {
    ...choice,
    hint:`${choice.hint} · 白日原物仍在场`,
    text:`${choice.text} ${text}`,
    dayPreparationText:text,
  } : choice;
}

function day10OpeningFollowupChoiceForState(choice, opening) {
  const text = opening?.choiceTexts?.[choice.id];
  return text ? {
    ...choice,
    hint:`${choice.hint} · 莲池原页状态不会重置`,
    text:`${choice.text} ${text}`,
    publicOpeningText:text,
  } : choice;
}

export function currentPublicEvent(state) {
  const event = PUBLIC_EVENTS[state.day] ?? null;
  if (!event) return null;
  if (state.day === 5) return day5EventForState(event, state);
  if (state.day === 10) {
    const dayPreparation = day10PublicPreparation(state);
    return dayPreparation ? {
      ...event,
      body:`${event.body} ${dayPreparation.publicText}`,
      dayPreparation:{ ...dayPreparation, text:dayPreparation.publicText },
    } : event;
  }
  if (state.day === 15) {
    const draftEcho = day15DraftMemory(state);
    const firstOpening = openingMemory(state);
    return draftEcho || firstOpening ? {
      ...event,
      body:[event.body, draftEcho?.text, firstOpening?.day15Text].filter(Boolean).join(' '),
      draftEcho,
      openingMemory:firstOpening,
      choices:event.choices.map((choice) => {
        const openingText = firstOpening?.day15ChoiceTexts?.[choice.id];
        return openingText ? { ...choice, text:`${choice.text} ${openingText}`, openingMemoryText:openingText } : choice;
      }),
    } : event;
  }
  return event;
}

function isPublicBalanceChoice(event, choice) {
  return !!event && (choice.effects?.flags ?? []).includes(event.balanceFlag);
}

export function banquetOptions(state) {
  const event = currentPublicEvent(state);
  if (state.phase !== 'banquet' || !event) return [];
  // 失信或外传都会让共同口径没人肯接；三场公开检验各有自己的文案与场景。
  const exposed = state.resources.exposure >= EXPOSURE_LEDGERED;
  const betrayed = anyRouteBoundaryBreachActive(state);
  return event.choices.map((choice) => ({
    ...choice,
    disabled: (isPublicBalanceChoice(event, choice) && (betrayed || exposed)) || cannotAfford(state, choice),
    locked: isPublicBalanceChoice(event, choice) && (betrayed || exposed)
      ? (exposed ? '外头的闲话先进了席，这五个人谁也不肯替你作证。' : '先前有人被你晾过，这句话说得再齐也没人肯信。')
      : cannotAfford(state, choice) ? costLockedText(choice) : '',
  }));
}

export function chooseBanquet(state, choiceId) {
  if (state.phase !== 'banquet') return { ok: false, error: '还没到开席的时候。' };
  const event = currentPublicEvent(state);
  const choice = event?.choices.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个席面选择。' };
  if (isPublicBalanceChoice(event, choice) && state.resources.exposure >= EXPOSURE_LEDGERED) {
    return { ok: false, error: '外头的闲话先进了席，这五个人谁也不肯替你作证。' };
  }
  if (isPublicBalanceChoice(event, choice) && anyRouteBoundaryBreachActive(state)) {
    return { ok: false, error: '先前有人被你晾过。这句话说得再稳，也没人肯替你接。' };
  }
  if (cannotAfford(state, choice)) return { ok: false, error: costLockedText(choice) };
  applyEffects(state, choice.effects, null, `${event.title}上的公开选择`);
  record(state, 'banquet', { event: event.id, choice: choiceId, public: true });
  unlockScene(state, event.scene);
  state.pendingScene = event.scene;
  state.sceneReturnPhase = 'after_public_scene';
  state.sceneBeat = 0;
  state.phase = 'scene';
  state.log.push(choice.text);
  return { ok: true, text: choice.text, scene: event.scene };
}

const publicEvidenceById = (id) => PUBLIC_EVIDENCE_CHAIN.evidence.find((item) => item.id === id) ?? null;

function day15OpeningEvidence(state) {
  const source = recordedDayPreparation(state, 15, DAY15_OPENING_EVIDENCE);
  const evidence = source ? publicEvidenceById(source.preparation.evidence) : null;
  return source && evidence ? {
    sourceDay:15,
    sourceAction:source.action,
    sourceActor:source.actor,
    evidenceId:evidence.id,
    evidence,
    label:source.preparation.label,
    object:source.preparation.object,
    openingText:source.preparation.openingText,
    followupText:source.preparation.followupText,
    aftermathTexts:[...source.preparation.aftermathTexts],
  } : null;
}

function day15PublicOpeningFromHistory(history) {
  const event = PUBLIC_EVENTS[15];
  const row = [...history].reverse().find((entry) => entry.type === 'banquet' && entry.day === 15);
  const choice = event?.choices.find((item) => item.id === row?.choice);
  const opening = choice && row.event === event.id ? DAY15_PUBLIC_OPENINGS[choice.id] : null;
  return opening ? {
    ...opening,
    event:event.id,
    falseScapegoat:choice.id === 'public_15_scapegoat',
  } : null;
}

function day15PublicOpening(state) {
  return day15PublicOpeningFromHistory(state.history);
}

export function publicAccountabilityMemory(state) {
  return [
    [5, day5PublicOpening(state)],
    [10, day10PublicOpening(state)],
    [15, day15PublicOpening(state)],
  ].flatMap(([day, opening]) => opening ? [{
    day,
    choice:opening.choice,
    label:opening.label,
    endingText:opening.endingText,
    fateText:opening.fateText,
  }] : []);
}

function day15RebuttalChoiceKind(choiceId) {
  if (choiceId?.endsWith('_limited')) return 'limited';
  if (choiceId?.endsWith('_street')) return 'street';
  if (choiceId?.endsWith('_reopen')) return 'reopen';
  if (choiceId?.endsWith('_segment')) return 'segment';
  return null;
}

function withDay15PublicOpeningRebuttalChoice(choice, publicOpening) {
  if (!choice) return null;
  const kind = day15RebuttalChoiceKind(choice.id);
  const publicOpeningText = kind ? publicOpening?.rebuttalChoiceTexts?.[kind] : null;
  return publicOpeningText ? {
    ...choice,
    text:`${choice.text} ${publicOpeningText}`,
    publicOpeningText,
  } : choice;
}

function publicEvidenceStepStrength(selected, evidenceId) {
  const before = new Set(selected);
  if (evidenceId === 'grain_measure') return selected.length === 0 ? 2 : 1;
  // 两条“经手”证据放在第二步时能承上；若拖到第三步，只能补强，不能
  // 冒充本应负责拆解改口的收口证据。
  if (evidenceId === 'double_ledger') return before.has('grain_measure') ? (selected.length === 1 ? 2 : 1) : 0;
  if (evidenceId === 'gate_route') return before.has('grain_measure') || before.has('double_ledger')
    ? (selected.length === 1 ? 2 : 1)
    : 0;
  if (evidenceId === 'cross_words') {
    return selected.length >= 2 && (before.has('grain_measure') || before.has('gate_route')) ? 2 : 0;
  }
  return 0;
}

function publicEvidenceEvaluation(selected) {
  if (!Array.isArray(selected)
    || selected.length !== 3
    || new Set(selected).size !== 3
    || selected.some((id) => !publicEvidenceById(id))) return null;
  let score = 0;
  const steps = selected.map((id, index) => {
    const strength = publicEvidenceStepStrength(selected.slice(0, index), id);
    score += strength;
    return { evidence: id, strength };
  });
  const id = score >= 6 ? 'complete' : score >= 3 ? 'rebuttable' : 'broken';
  return { id, score, steps, outcome: PUBLIC_EVIDENCE_CHAIN.outcomes[id] };
}

function publicEvidenceEvaluationForOpening(selected, opening) {
  const raw = publicEvidenceEvaluation(selected);
  if (!raw) return null;
  if (!opening?.falseScapegoat) return { ...raw, rawId:raw.id, contaminated:false };
  const coda = opening.outcomeCoda[raw.id];
  if (raw.id === 'complete') {
    const base = PUBLIC_EVIDENCE_CHAIN.outcomes.rebuttable;
    return {
      ...raw,
      id:'rebuttable',
      rawId:'complete',
      contaminated:true,
      outcome:{
        ...base,
        label:opening.completeVerdict.label,
        title:opening.completeVerdict.title,
        body:`${raw.outcome.body} ${coda}`,
        echo:opening.completeVerdict.echo,
      },
    };
  }
  return {
    ...raw,
    rawId:raw.id,
    contaminated:true,
    outcome:{
      ...raw.outcome,
      body:`${raw.outcome.body} ${coda}`,
      echo:`${raw.outcome.echo} ${coda}`,
    },
  };
}

function publicEvidenceEvaluationForState(state, selected) {
  return publicEvidenceEvaluationForOpening(selected, day15PublicOpening(state));
}

function publicEvidenceEvaluationForHistory(history, selected) {
  return publicEvidenceEvaluationForOpening(selected, day15PublicOpeningFromHistory(history));
}

function structurallyValidPublicEvidenceResult(selected, result) {
  const raw = publicEvidenceEvaluation(selected);
  return !!raw && (raw.id === result || (raw.id === 'complete' && result === 'rebuttable'));
}

function recordedPublicEvidence(state) {
  const row = [...state.history].reverse().find((entry) => entry.type === 'public_evidence_chain' && entry.day === 15);
  if (!row) return null;
  const openingEvidence = day15OpeningEvidence(state);
  if (openingEvidence && row.chain[0] !== openingEvidence.evidenceId) return null;
  const evaluation = publicEvidenceEvaluationForState(state, row.chain);
  return evaluation && evaluation.id === row.result ? { ...evaluation, chain: [...row.chain] } : null;
}

export function currentPublicEvidence(state) {
  if (state.phase !== 'public_evidence' || state.day !== 15 || !state.publicEvidence) return null;
  const selected = [...state.publicEvidence.selected];
  const openingEvidence = day15OpeningEvidence(state);
  const publicOpening = day15PublicOpening(state);
  if (openingEvidence && selected[0] !== openingEvidence.evidenceId) return null;
  const evaluation = selected.length === 3 ? publicEvidenceEvaluationForOpening(selected, publicOpening) : null;
  if ((evaluation?.id ?? null) !== state.publicEvidence.result) return null;
  const draftEcho = day15DraftMemory(state);
  return {
    ...PUBLIC_EVIDENCE_CHAIN,
    body:[PUBLIC_EVIDENCE_CHAIN.body, publicOpening?.evidenceText, openingEvidence?.openingText, draftEcho?.evidenceText].filter(Boolean).join(' '),
    draftEcho,
    publicOpening,
    openingEvidence,
    selected,
    selectedEvidence: selected.map(publicEvidenceById),
    step: selected.length,
    count: 3,
    awaitingChoice: selected.length < 3,
    resolved: selected.length === 3,
    result: evaluation?.outcome ?? null,
    rawResult:evaluation?.rawId ?? null,
    contaminated:evaluation?.contaminated ?? false,
    score: evaluation?.score ?? selected.reduce((sum, id, index) => sum + publicEvidenceStepStrength(selected.slice(0, index), id), 0),
    steps: evaluation?.steps ?? selected.map((id, index) => ({ evidence:id, strength:publicEvidenceStepStrength(selected.slice(0, index), id) })),
  };
}

export function publicEvidenceOptions(state) {
  const current = currentPublicEvidence(state);
  if (!current?.awaitingChoice) return [];
  return PUBLIC_EVIDENCE_CHAIN.evidence
    .filter((item) => !current.selected.includes(item.id))
    .map((item) => {
      const strength = publicEvidenceStepStrength(current.selected, item.id);
      return {
        ...item,
        strength,
        meta: strength === 2
          ? (item.id === 'cross_words' ? '收口成立 · 让改口撞上前证' : '强承接 · 能托住下一步')
          : strength === 1
            ? (item.id === 'grain_measure' ? '事实迟到 · 仍有效但无法回填前缝' : '旁证补强 · 不能代替最后拆口')
            : '承接悬空 · 对方可立即反问',
      };
    });
}

export function choosePublicEvidence(state, evidenceId) {
  const current = currentPublicEvidence(state);
  const evidence = publicEvidenceOptions(state).find((item) => item.id === evidenceId);
  if (!current || !evidence) return { ok:false, error:'这份证物不能在此刻重复递上。' };
  state.publicEvidence.selected.push(evidence.id);
  if (state.publicEvidence.selected.length < 3) {
    state.log.push(`${evidence.label}：${evidence.proves}`);
    return {
      ok:true,
      text:evidence.resistance,
      announcement:`第${state.publicEvidence.selected.length}步，${evidence.label}已落案。反问：${evidence.resistance}`,
    };
  }
  const evaluation = publicEvidenceEvaluationForState(state, state.publicEvidence.selected);
  if (!evaluation) return { ok:false, error:'三步证链没有接成可核的次序。' };
  state.publicEvidence.result = evaluation.id;
  state.log.push(evaluation.outcome.body);
  return {
    ok:true,
    text:evaluation.outcome.body,
    announcement:`第3步，${evidence.label}已落案。判词：${evaluation.outcome.label}。${evaluation.outcome.title}。承接力 ${evaluation.score}/6。${evaluation.outcome.body}`,
  };
}

export function completePublicEvidence(state) {
  const current = currentPublicEvidence(state);
  if (!current?.resolved || !current.result) return { ok:false, error:'先把三份证物依次递完，再进入主签裁决。' };
  applyEffects(state, current.result.effects, null, `堂前公审：${current.result.label}`);
  record(state, 'public_evidence_chain', {
    event:PUBLIC_EVIDENCE_CHAIN.id,
    chain:[...current.selected],
    result:current.result.id,
  });
  state.publicEvidence = null;
  state.phase = 'public_followup';
  return { ok:true, text:current.result.echo };
}

export function publicEvidenceOutcome(state) {
  const current = currentPublicEvidence(state);
  if (current?.resolved) return { ...publicEvidenceEvaluationForState(state, current.selected), chain:[...current.selected] };
  return recordedPublicEvidence(state);
}

function publicFollowupForState(state) {
  const event = PUBLIC_FOLLOWUPS[state.day] ?? null;
  if (!event) return null;
  if (state.day === 10) {
    const dayPreparation = day10PublicPreparation(state);
    const day10Opening = day10PublicOpening(state);
    return dayPreparation || day10Opening ? {
      ...event,
      body:[event.body, day10Opening?.followupText, dayPreparation?.followupText].filter(Boolean).join(' '),
      day10Opening,
      dayPreparation:dayPreparation ? { ...dayPreparation, text:dayPreparation.followupText } : null,
      choices:event.choices.map((choice) => day10OpeningFollowupChoiceForState(
        day10FollowupChoiceForState(choice, dayPreparation),
        day10Opening,
      )),
    } : event;
  }
  if (state.day === 15) {
    const draftEcho = day15DraftMemory(state);
    return draftEcho ? { ...event, draftEcho } : event;
  }
  if (state.day !== 5) return event;
  const mealMemory = day5MealMemory(state);
  const dayPreparation = day5PublicPreparation(state, mealMemory);
  const day5Opening = day5PublicOpening(state, mealMemory);
  return {
    ...event,
    kicker:fillDay5MealText(event.kicker, mealMemory),
    title:fillDay5MealText(event.title, mealMemory),
    body:[fillDay5MealText(event.body, mealMemory), day5Opening?.followupText, dayPreparation?.followupText].filter(Boolean).join(' '),
    mealMemory,
    day5Opening,
    dayPreparation:dayPreparation ? { ...dayPreparation, text:dayPreparation.followupText } : null,
    choices:event.choices.map((choice) => day5OpeningFollowupChoiceForState(
      day5PreparationFollowupChoiceForState(day5ChoiceForState(choice, mealMemory), dayPreparation),
      day5Opening,
    )),
  };
}

export function currentPublicFollowup(state) {
  const event = state.phase === 'public_followup' ? publicFollowupForState(state) : null;
  if (!event) return null;
  const openingEvidence = state.day === 15 ? day15OpeningEvidence(state) : null;
  const publicOpening = state.day === 15 ? day15PublicOpening(state) : null;
  return {
    ...event,
    body:[event.body, publicOpening?.followupText, openingEvidence?.followupText].filter(Boolean).join(' '),
    openingMemory: state.day === 5 ? openingMemory(state) : null,
    evidenceChain: state.day === 15 ? publicEvidenceOutcome(state) : null,
    publicOpening,
    openingEvidence,
  };
}

export function publicFollowupOptions(state) {
  const event = currentPublicFollowup(state);
  if (!event) return [];
  return event.choices.map((choice) => ({
    ...choice,
    disabled: cannotAfford(state, choice),
    locked: cannotAfford(state, choice) ? costLockedText(choice) : '',
  }));
}

export function resolvePublicFollowup(state, choiceId) {
  const event = currentPublicFollowup(state);
  const choice = publicFollowupOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '这一幕已经散场了。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '眼下承担不起这个后果。' };
  applyEffects(state, choice.effects, null, `${event.title}：${choice.label}`);
  record(state, 'public_followup', { event: event.id, choice: choice.id, participants: [...event.participants] });
  state.log.push(choice.text);
  state.publicAftermath = { event: event.id, choice: choice.id, beat: 0 };
  state.phase = 'public_aftermath';
  return { ok: true, text: choice.text };
}

export function currentPublicAftermath(state) {
  if (state.phase !== 'public_aftermath' || !state.publicAftermath) return null;
  const event = publicFollowupForState(state);
  const choice = event?.choices.find((row) => row.id === state.publicAftermath.choice);
  const aftermath = PUBLIC_FOLLOWUP_AFTERMATHS[state.publicAftermath.choice];
  if (!event || !choice || !aftermath || state.publicAftermath.event !== event.id) return null;
  const mealMemory = state.day === 5 ? day5MealMemory(state) : null;
  const dayPreparation = state.day === 5
    ? day5PublicPreparation(state, mealMemory)
    : state.day === 10 ? day10PublicPreparation(state) : null;
  const day5Opening = state.day === 5 ? day5PublicOpening(state, mealMemory) : null;
  const day10Opening = state.day === 10 ? day10PublicOpening(state) : null;
  const openingEvidence = state.day === 15 ? day15OpeningEvidence(state) : null;
  const publicOpening = state.day === 15 ? day15PublicOpening(state) : null;
  const fillBeat = (beat) => mealMemory ? {
    ...beat,
    title:fillDay5MealText(beat.title, mealMemory),
    body:fillDay5MealText(beat.body, mealMemory),
  } : beat;
  const beats = [
    Object.freeze({
      speaker: aftermath.openingSpeaker,
      title: choice.label,
      body: choice.text,
    }),
    ...aftermath.beats.map(fillBeat),
  ].map(fillBeat).map((beat, index) => {
    const echoes = [day5Opening?.aftermathTexts[index], day10Opening?.aftermathTexts[index], publicOpening?.aftermathTexts[index], openingEvidence?.aftermathTexts[index] ?? dayPreparation?.aftermathTexts[index]].filter(Boolean);
    return echoes.length ? { ...beat, body:`${beat.body} ${echoes.join(' ')}` } : beat;
  });
  return {
    event: event.id,
    choice: choice.id,
    label: choice.label,
    participants: [...event.participants],
    mealMemory,
    dayPreparation:dayPreparation ? { ...dayPreparation, text:dayPreparation.aftermathTexts[state.publicAftermath.beat] } : null,
    day5Opening:day5Opening ? { ...day5Opening, text:day5Opening.aftermathTexts[state.publicAftermath.beat] } : null,
    day10Opening:day10Opening ? { ...day10Opening, text:day10Opening.aftermathTexts[state.publicAftermath.beat] } : null,
    publicOpening:publicOpening ? { ...publicOpening, text:publicOpening.aftermathTexts[state.publicAftermath.beat] } : null,
    openingEvidence:openingEvidence ? { ...openingEvidence, text:openingEvidence.aftermathTexts[state.publicAftermath.beat] } : null,
    beat: state.publicAftermath.beat,
    count: beats.length,
    current: beats[state.publicAftermath.beat] ?? null,
  };
}

export function advancePublicAftermath(state) {
  const current = currentPublicAftermath(state);
  if (!current) return { ok: false, error: '这场公开问责已经散了。' };
  if (current.beat < current.count - 1) {
    state.publicAftermath.beat += 1;
    return { ok: true };
  }
  state.publicAftermath = null;
  enterVisitHub(state);
  return { ok: true };
}

function publicEvidenceFutureEcho(state) {
  const evidence = publicEvidenceOutcome(state);
  if (!evidence) return '';
  const publicOpening = day15PublicOpening(state);
  const rebuttal = recordedExternalRebuttal(state);
  const day17Evidence = rebuttal?.choice.id.includes('_limited') ? day17ActionEvidence(state) : null;
  const day17Coda = day17Evidence ? ` ${day17Evidence.text}` : '';
  const coda = rebuttal ? ` ${rebuttal.choice.finalEcho}${day17Coda}` : '';
  if (publicOpening?.falseScapegoat) {
    if (evidence.rawId === 'complete') return `第十五日三步证物本来足以逐段闭合，韩道国却在第一证落堂前先被押成答案；案卷因此以“有案有缝”进入复案。雪娥量过的短米仍接不上他的手，玉楼撤回的程序担保也没有恢复；后续必须先拆开独立证据、押前口供与押后解释，不能拿一条强证链倒洗错误预断。${coda}`;
    if (evidence.id === 'rebuttable') return `第十五日的案卷既有承接空白，也保留韩道国先于证物被押的时辰。复案必须同时补证并区分押前、押后口供；主签不能把一段新证据扩成对旧预断的追认。${coda}`;
    return `第十五日三份证物没有接成链，韩道国又先被押成共同答案。堂外已经把这场公审讲成五院围住一个伙计逼供；今日若不同时清证物次序与错误归罪，缺口会继续被一名替罪者吞掉。${coda}`;
  }
  if (evidence.id === 'complete') return `第十五日那条证链仍能逐段复查：雪娥的米斗定事实，账页或门簿接经手，最后一份证物才拆口供。韩道国、玳安与应伯爵此后只能各自质疑一段，不能再用一套圆话抹掉全部。${coda}`;
  if (evidence.id === 'rebuttable') return `第十五日的案卷仍有一处承接空白。韩道国正要求重验，应伯爵也把“待复核”讲成五院自相矛盾；今日结外账时，必须决定由谁补证而不是再靠主签压过去。${coda}`;
  return `第十五日三份真证没有接成一条链。玳安未认空白门路，韩道国与应伯爵已经把公审改讲成围人逼供；今日若仍只清银不清经手，这个版本会比原件传得更远。${coda}`;
}

function portablePrecedentFinalEcho(state) {
  const precedent = recordedPortablePrecedent(state);
  if (!precedent) return '';
  const event = PORTABLE_PRECEDENTS[precedent.action];
  const replyText = precedent.replies.map((reply) => `${HEROINES[reply.heroine].short}${({stand:'守原规',narrow:'收窄',withdraw:'撤回外推'})[reply.outcome]}`).join('、');
  const limit = ({
    portable:`${precedent.outsider.name}可拿${event.object.portable}证明这套程序曾在宅主不居中时执行过一次`,
    bounded:`${precedent.outsider.name}只能援引两人共同放行的窄界，不能借一人的同意补另一人的空白`,
    withdrawn:`至少一人撤回外推；${precedent.outsider.name}只保留原有收据、工资或追索，第二张契不能替旧案补证`,
    exception:`${precedent.outsider.name}手里的契只对具名物件与期限有效，过期不能称常例`,
    inside:`${precedent.outsider.name}带走宅门拒绝外用的原页；既得权利仍在，但他不替五院证明制度可携出`,
  })[precedent.scope];
  return `第一桩联院差事后来被院外经手人反向援引：${replyText}。你选择“${precedent.title}”；${limit}。${precedent.disposition}。这一有限去处不会把第十五日断掉或缺失的证链补成完整。`;
}

function withPortablePrecedentFinalChoices(state, choices) {
  const precedent = recordedPortablePrecedent(state);
  if (!precedent) return choices;
  const event = PORTABLE_PRECEDENTS[precedent.action];
  const scope = precedent.scope;
  return choices.map((choice) => {
    const echo = choice.id === 'final_evidence_chain'
      ? ['portable','bounded'].includes(scope)
        ? `${precedent.outsider.name}只证明${event.object.portable}的执行程序与授权边界；他不替任何缺失的原话、封签或工簿补来源。`
        : `${precedent.outsider.name}没有可携出的共同程序；这条外账不能拿第二张契修补旧证链。`
      : choice.id === 'final_pay_receipt'
        ? ['exception','inside','withdrawn'].includes(scope)
          ? `本金收据必须另列${precedent.outsider.name}既有的工资、押银或追索；付银不使被撤回或限次的第二张契复活。`
          : `${precedent.outsider.name}可要求收据沿用第二张契的逐项责任与纠错栏，但适用范围仍止于${event.object.portable}。`
        : ['portable','bounded'].includes(scope)
          ? `${precedent.outsider.name}持有的副契可进入外部索引，正文与授权仍按两位原经手人的较窄边界逐项开放。`
          : `${precedent.outsider.name}的原页只登记为既得权利或拒绝记录，不进入五院共同索引。`;
    return { ...choice, hint:`${choice.hint} · 第二契：${precedent.title}`, text:`${choice.text} ${echo}` };
  });
}

export function recordedFivePriceSettlement(state) {
  const row = state?.history?.find((entry) => entry.type === 'five_price_settlement' && entry.day === 19);
  if (!row || !validStoredFivePriceReplies(row.replies)) return null;
  return {
    protocol:row.protocol, right:row.right, day16Mode:row.day16Mode, day16Result:row.day16Result,
    replies:row.replies.map((reply) => ({ ...reply })),
    coalition:{ kind:row.coalition.kind, members:[...row.coalition.members] },
  };
}

function fivePriceFinalContext(state) {
  const settlement = recordedFivePriceSettlement(state);
  if (!settlement) return null;
  const outcomes = { accept:'接价', counter:'反要价', refuse:'拒价', expose:'公开价书' };
  const statuses = settlement.replies.map((reply) => ({
    ...reply, label:outcomes[reply.outcome], title:FIVE_PRIVATE_PRICES.offers[reply.heroine].title,
  }));
  const accepted = statuses.filter((reply) => reply.outcome === 'accept');
  const acceptEcho = accepted.length ? accepted.map((reply) => ({
    wu_yueniang:'正堂页被列作主索引，她日后纠正本人流水会先被官面记作改口',
    pan_jinlian:'应伯爵握有她本人原话的先刊时辰，后来的补正会慢一版',
    li_pinger:'韩道国会指出共同证链已经少了一枚货封',
    meng_yulou:'她本人名帖一夜只走应伯爵的路，迟帖与撤帖都会先压回她名下',
    sun_xuee:'灶簿被称作另案，外柜拒绝让它重新接回共同链',
  })[reply.heroine]).join('；') : '五封没有一封把代答权卖出，外柜只能逐页、逐人追问';
  const protocolEcho = ({
    separate_sealed:'五封各自封回，明日每一页都须重新向本人请求放行',
    cross_witnessed:'每次引用都能同时亮出本人印与见证印，删改可被第二院核回',
    common_floor_annex:'三条共同底线可以组成最小外案，五份附件仍各归本人',
  })[settlement.protocol];
  const rightEcho = ({
    withdrawal:'落印前必须逐人确认昨夜答复今日仍有效',
    original_quote:'任何删句、拼句或抹掉期限的摘录都可由原封对破',
    no_retaliation:'外账不得拿拒价者的工钱、钥匙、名帖或退路抵偿另一封',
  })[settlement.right];
  const coalitionEcho = settlement.coalition.kind === 'full'
    ? '五人仍能互证，却没有共同授权正文'
    : settlement.coalition.kind === 'limited'
      ? `${settlement.coalition.members.map((id) => HEROINES[id].short).join('、')}只是有限互证候选，非候选答复继续自持`
      : '今夜没有形成共同授权，只剩所保的一条权利底线';
  return {
    ...settlement, statuses, accepted,
    echo:`第十九夜五封私价已经分别作答：${statuses.map((row) => `${HEROINES[row.heroine].short}${row.label}`).join('、')}。${acceptEcho}。${protocolEcho}；${rightEcho}。${coalitionEcho}。`,
  };
}

function scopedFinalEffects(effects, context, flags = null) {
  if (!context || context.coalition.kind === 'full') return effects;
  const members = new Set(context.coalition.members);
  if (context.coalition.kind === 'limited') {
    const relAll = Object.fromEntries(Object.entries(effects.relAll ?? {}).filter(([id]) => members.has(id)));
    return {
      ...effects,
      house:effects.house > 0 ? Math.max(1, Math.round(effects.house * members.size / HEROINE_IDS.length)) : effects.house,
      bonds:(effects.bonds ?? []).filter(([left, right]) => members.has(left) && members.has(right)),
      relAll,
      flags:flags ?? [...(effects.flags ?? []), 'final_limited_coalition'],
    };
  }
  return {
    ...effects,
    house:effects.house > 0 ? Math.min(2, effects.house) : effects.house,
    bonds:[], relAll:{}, flags:flags ?? [...(effects.flags ?? []), 'final_rights_floor_only'],
  };
}

function finalEffectsForFivePrice(choice, context) {
  if (!context || context.coalition.kind === 'full') return choice.effects;
  let flags = choice.effects.flags ?? [];
  if (choice.id === 'final_evidence_chain') {
    flags = [context.coalition.kind === 'limited' ? 'final_evidence_chain_limited' : 'final_hard_evidence_only'];
  }
  return scopedFinalEffects(choice.effects, context, flags);
}

function dynamicFinalReckoningChoices(state) {
  const context = fivePriceFinalContext(state);
  if (!context) return FINAL_RECKONING.choices;
  const release = context.coalition.members.map((id) => HEROINES[id].short).join('、') || '无人';
  return FINAL_RECKONING.choices.map((choice) => {
    if (choice.id === 'final_evidence_chain') {
      const label = context.coalition.kind === 'full' ? choice.label : context.coalition.kind === 'limited' ? '按候选答复拼窄链' : '只交无需共同授权的硬证';
      const hint = context.protocol === 'separate_sealed'
        ? '必须逐院重新放行，不能用同桌协议冒充共同授权'
        : context.protocol === 'cross_witnessed'
          ? '每段同时亮本人印与见证印，删改摘句可当场核回'
          : '共同底线只接最小造假链，五份附件仍逐人放行';
      const text = context.coalition.kind === 'failed'
        ? '你只提交此前已经公开、且无须任何人替别人放行的纸脚、页序与官面硬证。五封答复不被拼成新证链；任何仍属个人的原话、货封、名帖与工簿都留在原主手里。'
        : `${choice.text} 今夜真正能相互放行的是${release}；接受外价或退出互证的人，不会在这句话里被重新写成自动交证。`;
      return { ...choice, label, hint, text, effects:finalEffectsForFivePrice(choice, context) };
    }
    if (choice.id === 'final_pay_receipt') {
      return { ...choice, hint:'付银只结合法本金，不替五封私价两讫', text:`${choice.text} 收据另列五封私价仍各归本人，付清本金不能把昨夜的主索引、先刊、撤证、递帖或拆页条件洗成已经同意。`, effects:finalEffectsForFivePrice(choice, context) };
    }
    const label = context.coalition.kind === 'full' ? choice.label : context.coalition.kind === 'limited' ? '候选间互证，非候选者自持' : '五封各归原主';
    const hint = context.coalition.kind === 'full'
      ? choice.hint
      : context.coalition.kind === 'limited'
        ? `${release}可提出共编索引；非候选者的原件与退路仍归各院`
        : '只能兑现昨夜所保的权利底线，不能由一个终局按钮洗成五院圆满';
    const text = context.coalition.kind === 'full'
      ? `${choice.text} 第十九夜五封答复仍各归本人；共同接管只证明她们能互证，不把附件合成一份总授权。`
      : context.coalition.kind === 'limited'
        ? `${release}只为彼此已经同意的页编索引，非候选原件仍各归原院。你没有把有限互证候选改称已经成盟。`
        : '五封原件各归本人，外柜只能按昨夜留下的权利底线逐封处理。没有共同索引，也没有谁因不在候选中便失去自己的钥匙、工钱、名帖或退路。';
    return { ...choice, label, hint, text, effects:finalEffectsForFivePrice(choice, context) };
  });
}

function councilRuleFinalChoices(state, choices) {
  const context = day17TradeContext(state);
  if (!context) return choices;
  return choices.map((choice) => {
    let label = choice.label;
    let hint = `${choice.hint}；${context.day20.permission}`;
    let text = choice.text;
    if (context.sourceChoice === 'council_17_each_door') {
      if (choice.id === 'final_evidence_chain') {
        label = '五份本人材料分别放行';
        hint = '各院只能开放本人物件；不能把五张私答拼成共同授权';
        text = `${choice.text} 五张私答仍各自封存，任何一页出门都须原主重新落字。`;
      } else if (choice.id === 'final_five_custody') {
        label = '原件各归五门';
        hint = '可以登记归还，不得预设跨院双钥总索引';
        text = `${choice.text} 今夜只登记每册归谁，不预写跨院共同查阅权。`;
      }
    } else if (context.sourceChoice === 'council_17_rotating_host') {
      hint = `${choice.hint}；轮值主持只管顺序、复述与叫停，不代答或裁定证言`;
      text = `${choice.text} 轮值主持只排问答与交接次序，证言和原件仍由本人处分。`;
    } else if (choice.id === 'final_evidence_chain') {
      hint = `${choice.hint}；五人可分别追问，任何人仍可拒答、改口或停下`;
      text = `${choice.text} 五人分别追问本人经手段落，停答与更正仍原样入册。`;
    }
    return {
      ...choice, label, hint, text,
      councilRule:{ factId:context.factId, sourceChoice:context.sourceChoice, ...context.day20 },
    };
  });
}

function dynamicFinalReckoningAftermathChoicesForContext(approach, context) {
  const chapter = FINAL_RECKONING_AFTERMATHS[approach];
  if (!chapter || !context || context.coalition.kind === 'full') return chapter?.choices ?? [];
  const names = context.coalition.members.map((id) => HEROINES[id].short).join('、');
  const limited = context.coalition.kind === 'limited';
  const rights = ({
    withdrawal:'逐人重问后仍愿意交出的材料',
    original_quote:'本人原封与见证印能核回的材料',
    no_retaliation:'不拿非候选者生计与退路补缺的材料',
  })[context.right];
  return chapter.choices.map((choice) => {
    let label = choice.label;
    let hint = choice.hint;
    let text = choice.text;
    if (approach === 'final_evidence_chain') {
      if (choice.id === 'final_chain_only_fraud') {
        label = limited ? '候选只交造假窄链' : '只交无需合证的硬证';
        hint = limited ? `${names}只放行彼此已经核过的片段；非候选材料不入链` : `只用${rights}，不新造共同授权`;
        text = limited
          ? `${names}只接起已经互证的页序、纸脚与经手片段；非候选者的原话、货封、名帖和工簿一页不少地退回本人。官面得到一条较窄却可复核的造假链，没有把有限互证候选写成已经同席。`
          : `正堂只交已经公开的日期、纸脚与官面页序；五个人各自取回仍需本人放行的原话、货封、名帖与工簿。外案因材料有限而变慢，却没有凭一个终局按钮生出共同证链。`;
      } else {
        label = limited ? `${names}逐页放行` : '各人只处置本人一页';
        hint = limited ? '候选之间可以互核；非候选者不被列作缺席或默认同意' : `每一页只按${rights}单独决定去留`;
        text = limited
          ? `${names}依次只检查彼此已经见过的片段，逐页决定能走多远；非候选者带走自己的原件，也不替候选间缺口作保。证链比全院共放更薄，但候选与权限都写得清楚。`
          : `没有人替别人补页。每个人只在自己的材料旁写“出”“留”或“撤”，无法单独成立的片段就退出外案。官面拿到的是五份有限决定，不是一条被强称完整的共同证链。`;
      }
    } else if (approach === 'final_pay_receipt') {
      if (choice.id === 'final_receipt_clean_now') {
        label = limited ? '候选核清两讫字样' : '本金两讫，私价逐封另结';
        hint = limited ? `${names}只核本人愿意见证的收据栏` : `付银不使任何私价自动生效；保住${rights}`;
        text = limited
          ? `${names}只核自己愿意见证的本金栏与“两讫”字样，非候选者既不在收据上担保，也不因缺席被连坐。银债当场结清，私价仍逐封另算。`
          : `本金照数交付，收据却把五封私价分列为五项未授权事项；每个人只确认自己那一栏，谁也不替别人落“两讫”。银债结束了，联盟并没有因此凭空出现。`;
      } else {
        label = limited ? '候选共封，非候选不押' : '本金分封，逐人自持';
        hint = limited ? `${names}只共同保管候选份额；其余份额不进共柜` : '不设五院封柜，每份收据条件归本人';
        text = limited
          ? `${names}只把候选间愿共同担保的本金份额封进一只匣，钥匙不越出候选范围；非候选者的收据条件与答复仍各归本人。外柜不能把一只有限封匣说成五院共押。`
          : `本金按五份收据条件分别封存，封套与撤回权都归本人，没有五把小印同开的一只共柜。外柜须逐份交出干净收据，任何一份成立都不能替另一份消账。`;
      }
    } else if (choice.id === 'final_custody_separate') {
      label = limited ? '候选互借，非候选各持' : '五封各归原主';
      hint = limited ? `${names}可逐次相借；其他院门不进共同目录` : `只兑现${rights}，不建立共享保管`;
      text = limited
        ? `${names}只在候选之间逐次相借已经同意的页，借一次留一次双印；非候选者直接领回自己的原件，不进候选目录。有限合作因此可执行，也没有夺走任何非候选者的保管权。`
        : `两本账按原件归属拆回五只封套，每个人领走自己的页并单独签收。宅中不立共享目录、不设代领人，今后若要再合证，只能从一次新的本人请求开始。`;
    } else {
      label = limited ? '候选两钥索引' : '不立索引，只登记归还';
      hint = limited ? `${names}之间可设双钥；索引不得写入非候选原件` : `没有共同索引，只证明${rights}已经兑现`;
      text = limited
        ? `${names}为候选材料编一张不抄正文的双钥索引，任何查询都由两名候选共同开启；非候选者的原件、所在院门与撤回理由都不写进索引。它只服务这一轮有限互证，不是已经成立的盟约。`
        : `月娘不再提出总索引，只逐项登记哪一页已经归还哪位本人；登记簿不写正文、院门或可供合证的页码。今夜留下的只有权利底线已经兑现的凭据，没有共同查阅权。`;
    }
    const collaborative = ['final_chain_each_release','final_receipt_five_escrow','final_custody_two_keys'].includes(choice.id);
    const flags = collaborative
      ? [limited ? `${choice.id}_limited` : `${approach}_rights_floor`]
      : [...(choice.effects.flags ?? []), limited ? 'final_limited_coalition' : 'final_rights_floor_only'];
    return { ...choice, label, hint, text, effects:scopedFinalEffects(choice.effects, context, flags) };
  });
}

function dynamicFinalReckoningAftermathChoices(state, approach) {
  const choices = dynamicFinalReckoningAftermathChoicesForContext(approach, fivePriceFinalContext(state));
  const context = day17TradeContext(state);
  if (!context) return choices;
  return choices.map((choice) => {
    const lockedBySeparateDoors = context.sourceChoice === 'council_17_each_door'
      && choice.id === 'final_custody_two_keys';
    let label = choice.label;
    let hint = `${choice.hint}；${context.day20.permission}`;
    let text = choice.text;
    if (context.sourceChoice === 'council_17_each_door') {
      if (choice.id === 'final_custody_separate') {
        label = '五门各持本人一册';
        hint = '符合第十七日各门自持；任何再合证都须重新逐人请求';
        text = `${choice.text} 这项归还不产生跨院调阅权。`;
      } else if (lockedBySeparateDoors) {
        label = '两钥总索引与五份私答冲突';
        hint = '第十七日已经取消跨院共同纠错；不能在终局凭空恢复共享索引';
      }
    } else if (context.sourceChoice === 'council_17_rotating_host') {
      text = `${choice.text} 本次轮值人只记录执行次序，原件主人仍可拒绝出页。`;
    } else {
      text = `${choice.text} 每次追问仍保留拒答、更正与叫停栏。`;
    }
    return {
      ...choice, label, hint, text,
      disabled:lockedBySeparateDoors,
      locked:lockedBySeparateDoors ? hint : '',
      councilRule:{ factId:context.factId, sourceChoice:context.sourceChoice, ...context.day20 },
    };
  });
}

function dynamicFinalReckoningAftermathBeats(context, approach, chapter) {
  if (!context || context.coalition.kind === 'full') return chapter.beats;
  const limited = context.coalition.kind === 'limited';
  const names = context.coalition.members.map((id) => HEROINES[id].short).join('、');
  const second = ({
    final_evidence_chain: limited
      ? { speaker:'meng_yulou', title:'玉楼只把候选可放行的片段列成两种窄链', body:`玉楼先划掉非候选者的原话、货封、名帖与工簿，不让缺席变成默认同意。${names}眼下只能二选一：交彼此已经核过的最小造假链，或由候选逐页多放材料；无论哪种，非候选原件都不进链。` }
      : { speaker:'meng_yulou', title:'玉楼不再提出共同放行，只问哪些硬证本来就无需合证', body:'玉楼把所有仍需另一人授权的原话、货封、名帖和工簿退回原主，只留下已经公开的日期、纸脚与官面页序。接下来只能在“交这组独立硬证”与“每人单独决定本人一页”之间选择，不能把五份答复拼成新证链。' },
    final_pay_receipt: limited
      ? { speaker:'li_pinger', title:'瓶儿把本金分成候选共核与非候选自持两部分', body:`${names}可以共同核一张只约束候选的干净收据，或只把候选间愿担保的本金份额共封；其余人的收据条件、撤回与私价各归本人。这里没有“五院共封”，只有一只候选边界写清的有限封匣。` }
      : { speaker:'li_pinger', title:'瓶儿把一只共柜拆成五份本人收据', body:'既然今夜没有形成共同授权，本金便不能先塞进一只五院封柜。眼下只能当场让外柜把私价逐封列作未授权，或把本金按本人收据条件分别封存；任何一份付清都不替另一份落“两讫”。' },
    final_five_custody: limited
      ? { speaker:'wu_yueniang', title:'月娘只为候选提出索引，非候选直接领回原件', body:`${names}可以逐次相借已经同意的页，或为候选材料编一张双钥索引；非候选者不写入目录，直接领回自己的原件。两种结构都只服务有限互证，不能预写成今夜已经成盟。` }
      : { speaker:'wu_yueniang', title:'月娘撤下总索引，只保原件归还可查', body:'今夜既没有共同授权，正堂便不立总索引，也不设两钥查阅。眼下只能让五封各归原主，或另做一张不写正文、院门与页码的归还登记，证明所保权利已经兑现。' },
  })[approach];
  return [chapter.beats[0], second];
}

function finalAftermathJiaoerEcho(state, beat) {
  const memory = day19JiaoerMemory(state);
  if (!memory) return null;
  const text = [
    `你选定的外账方向必须先承认第十八日已经留下“${memory.label}”；${memory.object}不能因总账开席便改归外柜或正堂。`,
    `外柜掌事指着${memory.object}反咬，想把一项已经限界、具名或断开的事实重新塞进第二本账，写成五院共同欠下的人情。`,
    `五个人提出的两种执行结构都为“${memory.label}”单列一栏：可以复核它怎样约束本案，不能扩大娇儿已经给出、保留或收回的权利。`,
    `最后签收另列${memory.object}；外账只结今日依法能结的部分，第十八日已经写清的路线、证言、分成、退席或断路仍照原字执行。`,
  ][beat] ?? '';
  return { opening:memory.opening, aftermath:memory.aftermath, label:memory.label, object:memory.object, text };
}

function finalReckoningDayPreparation(state, beat = null) {
  const source = recordedDayPreparation(state, 20, DAY20_RECKONING_PREPARATIONS);
  if (!source) return null;
  const preparation = source.preparation;
  const text = beat === null ? preparation.overviewText : [
    preparation.openingText,
    preparation.rebuttalText,
    preparation.decisionText,
    preparation.resolutionText,
  ][beat];
  if (!text) return null;
  return {
    sourceDay:20, sourceAction:source.action, sourceActor:source.actor,
    label:preparation.label, object:preparation.object, text,
  };
}

export function currentFinalReckoning(state) {
  if (state.phase !== 'final_reckoning' || state.day !== MAX_DAY) return null;
  const evidenceEcho = publicEvidenceFutureEcho(state);
  const publicOpening = day15PublicOpening(state);
  const firstOpening = openingMemory(state);
  const fivePrice = fivePriceFinalContext(state);
  const precedentEcho = portablePrecedentFinalEcho(state);
  const councilRule = day17TradeContext(state);
  const dayPreparation = finalReckoningDayPreparation(state);
  const jiaoerMemory = day19JiaoerMemory(state);
  const jiaoerEcho = jiaoerMemory ? {
    opening:jiaoerMemory.opening, aftermath:jiaoerMemory.aftermath,
    label:jiaoerMemory.label, object:jiaoerMemory.object, text:jiaoerMemory.day20Text,
  } : null;
  const body = [FINAL_RECKONING.body, dayPreparation?.text, evidenceEcho, firstOpening?.finalText, fivePrice?.echo, precedentEcho, councilRule?.day20.text, jiaoerEcho?.text].filter(Boolean).join(' ');
  const choices = councilRuleFinalChoices(state, withPortablePrecedentFinalChoices(state, dynamicFinalReckoningChoices(state))).map((choice) => {
    const openingMemoryText = firstOpening?.finalChoiceTexts?.[choice.id];
    return openingMemoryText ? { ...choice, text:`${choice.text} ${openingMemoryText}`, openingMemoryText } : choice;
  });
  return { ...FINAL_RECKONING, body, evidenceEcho, publicOpening, openingMemory:firstOpening, fivePrice, jiaoerEcho, dayPreparation, councilRule:councilRule ? { factId:councilRule.factId, sourceChoice:councilRule.sourceChoice, ...councilRule.day20 } : null, precedent:recordedPortablePrecedent(state), choices };
}

export function finalReckoningOptions(state) {
  const event = currentFinalReckoning(state);
  if (!event) return [];
  return event.choices.map((choice) => {
    const unaffordable = cannotAfford(state, choice);
    return {
      ...choice,
      disabled:choice.disabled || unaffordable,
      locked:choice.disabled ? choice.locked : unaffordable ? costLockedText(choice) : '',
    };
  });
}

export function resolveFinalReckoning(state, choiceId) {
  const event = currentFinalReckoning(state);
  const choice = finalReckoningOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '外柜已经带着账离开了。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '这笔终局代价眼下付不起。' };
  applyEffects(state, choice.effects, null, `终局对账：${choice.label}`);
  record(state, 'final_reckoning', { event: event.id, choice: choice.id, participants: [...event.participants] });
  state.log.push(choice.text);
  state.finalReckoningAftermath = { event: event.id, choice: choice.id, beat: 0, resolution: null };
  state.phase = 'final_aftermath';
  return { ok: true, text: choice.text };
}

export function currentFinalReckoningAftermath(state) {
  if (state.phase !== 'final_aftermath' || !state.finalReckoningAftermath) return null;
  const pending = state.finalReckoningAftermath;
  const opening = councilRuleFinalChoices(state, dynamicFinalReckoningChoices(state)).find((row) => row.id === pending.choice);
  const chapter = FINAL_RECKONING_AFTERMATHS[pending.choice];
  const aftermathChoices = dynamicFinalReckoningAftermathChoices(state, pending.choice);
  const publicOpening = day15PublicOpening(state);
  const firstOpening = openingMemory(state);
  if (!opening || !chapter || pending.event !== FINAL_RECKONING.id) return null;
  if (pending.resolution) {
    const choice = aftermathChoices.find((row) => row.id === pending.resolution.choice);
    if (!choice || pending.resolution.text !== choice.text) return null;
    const jiaoerEcho = finalAftermathJiaoerEcho(state, 3);
    const dayPreparation = finalReckoningDayPreparation(state, 3);
    return {
      event: pending.event,
      approach: pending.choice,
      label: opening.label,
      participants: [...FINAL_RECKONING.participants],
      beat: 3,
      count: 4,
      awaitingChoice: false,
      resolution: { ...pending.resolution },
      jiaoerEcho,
      dayPreparation,
      publicOpening:publicOpening ? { ...publicOpening, text:publicOpening.finalAftermathTexts[3] } : null,
      openingMemory:firstOpening ? { ...firstOpening, text:firstOpening.finalAftermathTexts[3] } : null,
      current: { speaker: choice.speaker, title: choice.label, body:[choice.text, dayPreparation?.text, jiaoerEcho?.text, publicOpening?.finalAftermathTexts[3], firstOpening?.finalAftermathTexts[3]].filter(Boolean).join(' ') },
    };
  }
  const context = fivePriceFinalContext(state);
  const rightsBeat = context ? ({
    withdrawal:'第十九夜保住撤回权，任何出证或收领都要先逐人再问一次；昨夜点头不能替今日落印。',
    original_quote:'第十九夜保住原话权，外柜若删掉“不知”、期限或撤回条件，原封与见证印会让整段引用失效。',
    no_retaliation:'第十九夜保住不连坐，今日任何结法都不得扣非候选者的工钱、钥匙、名帖或退路来补共同缺口。',
  })[context.right] : '';
  const chapterBeats = dynamicFinalReckoningAftermathBeats(context, pending.choice, chapter);
  const beats = [
    Object.freeze({ speaker: chapter.openingSpeaker, title: opening.label, body: opening.text }),
    ...chapterBeats.map((beat, index) => index === 0 || !rightsBeat ? beat : { ...beat, body:`${beat.body} ${rightsBeat}` }),
  ];
  const jiaoerEcho = finalAftermathJiaoerEcho(state, pending.beat);
  const dayPreparation = finalReckoningDayPreparation(state, pending.beat);
  const current = beats[pending.beat] ?? null;
  return {
    event: pending.event,
    approach: pending.choice,
    label: opening.label,
    participants: [...FINAL_RECKONING.participants],
    beat: pending.beat,
    count: 4,
    awaitingChoice: pending.beat === beats.length - 1,
    resolution: null,
    jiaoerEcho,
    dayPreparation,
    publicOpening:publicOpening ? { ...publicOpening, text:publicOpening.finalAftermathTexts[pending.beat] } : null,
    openingMemory:firstOpening ? { ...firstOpening, text:firstOpening.finalAftermathTexts[pending.beat] } : null,
    current:current ? { ...current, body:[current.body, dayPreparation?.text, jiaoerEcho?.text, publicOpening?.finalAftermathTexts[pending.beat], firstOpening?.finalAftermathTexts[pending.beat]].filter(Boolean).join(' ') } : null,
  };
}

export function finalReckoningAftermathOptions(state) {
  const current = currentFinalReckoningAftermath(state);
  if (!current?.awaitingChoice || current.resolution) return [];
  return dynamicFinalReckoningAftermathChoices(state, current.approach).map((choice) => {
    const unaffordable = cannotAfford(state, choice);
    return {
      ...choice,
      disabled:choice.disabled || unaffordable,
      locked:choice.disabled ? choice.locked : unaffordable ? costLockedText(choice) : '',
    };
  });
}

export function advanceFinalReckoningAftermath(state) {
  const current = currentFinalReckoningAftermath(state);
  if (!current) return { ok: false, error: '终局外账这一页已经合上了。' };
  if (current.resolution) {
    state.finalReckoningAftermath = null;
    enterVisitHub(state);
    return { ok: true };
  }
  if (current.awaitingChoice) return { ok: false, error: '五个人正在等你明确证据与保管权怎样落地。' };
  state.finalReckoningAftermath.beat += 1;
  return { ok: true };
}

export function resolveFinalReckoningAftermath(state, choiceId) {
  const current = currentFinalReckoningAftermath(state);
  const choice = finalReckoningAftermathOptions(state).find((row) => row.id === choiceId);
  if (!current?.awaitingChoice || !choice) return { ok: false, error: '现在还不能这样分配终局外账。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '眼下承担不起这项终局安排。' };
  applyEffects(state, choice.effects, null, `终局外账落地：${choice.label}`);
  record(state, 'final_reckoning_aftermath', {
    event: FINAL_RECKONING.id,
    approach: current.approach,
    choice: choice.id,
    participants: [...FINAL_RECKONING.participants],
  });
  state.finalReckoningAftermath.resolution = { choice: choice.id, text: choice.text };
  state.log.push(choice.text);
  return { ok: true, text: choice.text };
}

export function accordStatus(state) {
  return Object.values(ACCORD_META).map((row) => ({ ...row, complete: !!state.accords?.[row.key] }));
}

export function coalitionProofStatus(state) {
  return Object.values(COALITION_PROOF_META).map((row) => ({ ...row, complete: !!state.flags?.[row.flag] }));
}

export function publicPromisesReady(state) {
  return PUBLIC_BALANCE_FLAGS.every((flag) => state.flags[flag]);
}

export function jointParticipantCoverage(state) {
  const completed = new Set(state.jointActions);
  return new Set(JOINT_ACTIONS
    .filter((action) => completed.has(action.id))
    .flatMap((action) => action.participants ?? []));
}

function personalFinaleArrangementsFromHistory(history, heroine) {
  return intimacyArrangements({ history }, heroine).map((row) => ({
    ...row,
    lane:INTIMACY_ARRANGEMENT_LANES[row.id] ?? null,
  }));
}

function personalFinaleDepartureBasis(history) {
  const rows = Array.isArray(history) ? history : [];
  const overrides = Object.fromEntries(HEROINE_IDS.map((id) => [id, 0]));
  for (const entry of rows.filter((row) => row.type === 'visit_choice')) {
    for (const flag of routeChoiceById(entry.heroine, entry.choice)?.effects?.flags ?? []) {
      const heroine = OVERRIDE_FLAG_TO_HEROINE[flag];
      if (heroine) overrides[heroine] += 1;
    }
  }
  return {
    history:rows,
    stances:derivedRouteStances(rows),
    accords:new Set(rows.filter((entry) => entry.type === 'accord_term').map((entry) => entry.term)),
    arrangements:Object.fromEntries(HEROINE_IDS.map((id) => [id, personalFinaleArrangementsFromHistory(rows, id)])),
    overrides,
  };
}

function personalFinaleDepartureOutcome(basis, heroine, procedure) {
  const stance = basis.stances[heroine] ?? { covenant:0, private:0 };
  const lane = stance.covenant === stance.private ? 'tie' : stance.covenant > stance.private ? 'covenant' : 'private';
  const accord = basis.accords.has(FIVE_PRICE_ACCORD[heroine]);
  const visits = basis.history.filter((entry) => entry.type === 'visit_choice' && entry.heroine === heroine).length;
  const arrangements = basis.arrangements[heroine] ?? [];
  const close = visits >= 6 || arrangements.length > 0;
  const broken = fivePriceUnresolvedBreak(basis, heroine);
  const match = procedure?.lane === lane && lane !== 'tie';
  const opposite = lane !== 'tie' && !match;
  const arrangementLanes = arrangements.map((row) => row.lane).filter(Boolean);
  const arrangementOpposes = arrangementLanes.length > 0 && arrangementLanes.every((lane) => lane !== procedure?.lane);
  if (broken) return 'refuse';
  if (!accord && visits < 2 && !arrangements.length) return 'refuse';
  if (close && (opposite || arrangementOpposes)) return 'refuse';
  if (accord && match && !close) return 'accept';
  return 'amend';
}

const PERSONAL_FINALE_BOUNDARY_OBJECTS = Object.freeze({
  wu_yueniang:'总印、公私分栏与谁能改总账',
  pan_jinlian:'本人原话、当日去处与补正权',
  li_pinger:'私箱钥匙、借银归期与本人退路',
  meng_yulou:'名帖经手、回礼期限与拒绝垫面',
  sun_xuee:'工账署名、粮火次序与做工人的休息',
});

function personalFinaleBoundaryRepairReason(entry, heroineId) {
  if (!entry) return '';
  if (entry.type === 'visit_choice') {
    const choice = routeChoiceById(heroineId, entry.choice);
    return choice ? `第${entry.day}日她以“${choice.label}”（${choice.hint}）重新开门：${choice.text}` : '';
  }
  if (entry.type === 'accord_term') {
    const choice = ACCORD_CHOICES[heroineId];
    return choice ? `第${entry.day}日她亲手落下“${choice.label}”（${choice.hint}）：${choice.text}` : '';
  }
  if (entry.type === 'route_aftermath') {
    const source = routeChoiceById(heroineId, entry.sourceChoice);
    const observer = HEROINES[entry.observer]?.short;
    return `第${entry.day}日她把“${source?.label ?? '此前路线选择'}”的后果以“${ROUTE_AFTERMATH_CHOICE_LABELS[entry.choice]}”重新处置${observer ? `，并让${observer}在场核见` : ''}`;
  }
  if (entry.type === 'memory_reckoning') {
    const source = routeChoiceById(heroineId, entry.sourceChoice);
    const observer = HEROINES[entry.observer]?.short;
    return `第${entry.day}日她把第${entry.sourceDay}日“${source?.label ?? '旧话'}”以“${MEMORY_RECKONING_CHOICE_LABELS[entry.choice]}”重新落定${observer ? `，由${observer}共同见证` : ''}`;
  }
  if (entry.type === 'favor_reckoning') {
    const observer = HEROINES[entry.observer]?.short;
    return `第${entry.day}日她把第${entry.sourceDay}日的人情追账以“${FAVOR_RECKONING_CHOICE_LABELS[entry.choice]}”重新落定${observer ? `，由${observer}共同见证` : ''}`;
  }
  return '';
}

export function personalFinaleBoundaryReason(history, heroineId) {
  if (!HEROINE_IDS.includes(heroineId)) return '';
  const basis = personalFinaleDepartureBasis(Array.isArray(history) ? history : []);
  const accord = ACCORD_CHOICES[heroineId];
  const accordRow = [...basis.history].reverse().find((entry) => (
    entry.type === 'accord_term'
    && entry.heroine === heroineId
    && entry.term === accord.effects.accord
    && entry.choice === accord.id
  )) ?? null;
  const breakStatus = fivePriceBreakStatus(basis, heroineId);
  const boundary = PERSONAL_FINALE_BOUNDARY_OBJECTS[heroineId];
  const heroine = HEROINES[heroineId].short;
  const accordState = accordRow
    ? `第${accordRow.day}日由她本人落下的院约是“${accord.label}”（${accord.hint}）：${accord.text}`
    : `${heroine}从未亲手落下“${accord.label}”（${accord.hint}）这项院约`;

  if (!breakStatus.entry) {
    return accordRow
      ? `${accordState}这条真实旧约现在用来核验${boundary}，只授权她本人答复终夜善后。`
      : `${accordState}；终章不能借被选之人的约补出她的同意，只能把${boundary}逐项交还给她当场决定。`;
  }

  const breakEntry = breakStatus.entry;
  let breakText = `第${breakEntry.day}日宅门跌到${breakEntry.house}，五院同时关门，${heroine}的${boundary}也随之失去共同执行条件`;
  if (breakEntry.heroine === heroineId) {
    const source = breakStatus.source?.entry ? routeChoiceById(heroineId, breakStatus.source.entry.choice) : null;
    breakText = source
      ? `第${breakEntry.day}日“${source.label}”（${source.hint}）留下真实选择：${source.text}这使${heroine}的${boundary}累计被公开越过${breakEntry.overrides ?? basis.overrides[heroineId]}次`
      : `第${breakEntry.day}日，${heroine}的${boundary}累计被公开越过${breakEntry.overrides ?? basis.overrides[heroineId]}次`;
  }
  if (breakStatus.unresolved) {
    return `${breakText}；此后没有一项由她本人具名的修回。${accordState}也不能替后来这次失信消失，因此这是不可被亲近覆盖的硬否决。`;
  }

  const repairText = personalFinaleBoundaryRepairReason(breakStatus.repair?.entry, heroineId);
  const presentRule = accordRow
    ? `修回以后，仍以她自己的“${accord.label}”（${accord.hint}）核验本次善后。`
    : `这次修回只重开了她的答复权，并没有凭空补成“${accord.label}”（${accord.hint}）院约。`;
  return `${breakText}；${repairText || `第${breakStatus.repair?.entry?.day}日她本人具名修回这条边界`}。${presentRule}`;
}

export function personalFinaleRivalryReason(history, heroineId) {
  const memory = rivalryMorningMemories({ history }, heroineId).at(-1) ?? null;
  if (!memory) return '';
  if (memory.role === 'challenger') {
    return `第${memory.day}日，她曾以“${memory.title}”当面问到${memory.otherName}院前：“${memory.opening}”你随后以“${memory.choiceLabel}”落定，留下的实际结果是：“${memory.outcome}”她此刻重提的不是输赢，而是要确认自己当日质问过的偏宠与边界没有被终夜抹去；这件旧案会成为核约证据，却不单独替她接约或拒绝。`;
  }
  return `第${memory.day}日，${memory.otherName}曾以“${memory.title}”追到她院前；她当时亲口回答：“${memory.visitedReply}”你随后以“${memory.choiceLabel}”落定，留下的实际结果是：“${memory.outcome}”她不把当日被偏宠的位置续写成永久优先，只把这句旧答当作今天核约的证据；这件旧案不会单独替她接约或拒绝。`;
}

function personalFinaleSelectedRivalryReason(history, heroineId) {
  const memory = rivalryMorningMemories({ history:Array.isArray(history) ? history : [] }, heroineId).at(-1) ?? null;
  if (!memory) return '';
  if (memory.role === 'challenger') {
    return `第${memory.day}日，她曾以“${memory.title}”当面追到${memory.otherName}院前：“${memory.opening}”你以“${memory.choiceLabel}”落下的真实结果是：“${memory.outcome}”如今她被你选择，也不能忘记自己曾要求偏宠接受追问；因此她只能与你提出善后程序，不能借终夜位置替四院宣布已经服从。`;
  }
  return `第${memory.day}日，${memory.otherName}曾以“${memory.title}”追问她被偏宠的位置；她亲口回答：“${memory.visitedReply}”你以“${memory.choiceLabel}”落下的真实结果是：“${memory.outcome}”如今她仍不把当日被选择或今晚被选择写成永久首位；因此她只能与你提出善后程序，不能把另外四院的沉默解释成同意。`;
}

export function personalFinaleIntimacyReason(history, heroineId, procedure) {
  const arrangements = personalFinaleArrangementsFromHistory(Array.isArray(history) ? history : [], heroineId);
  if (!arrangements.length) return '';
  const clauses = arrangements.map((row) => `第${row.day}夜“${row.label}”（${row.hint}）`);
  const lanes = new Set(arrangements.map((row) => row.lane).filter(Boolean));
  const procedureLabel = procedure?.label ?? '这项善后';
  let alignment = `这些旧约仍须由她逐项核验，不能被“${procedureLabel}”一句带过。`;
  if (lanes.size > 1) {
    alignment = `两项旧约分别保护共同规则与本人私门，“${procedureLabel}”不能只择一项覆盖另一项，须由她逐项补写期限、见证或退出。`;
  } else if (lanes.size === 1 && lanes.has(procedure?.lane)) {
    alignment = `这些旧约与“${procedureLabel}”的权利路径同向，仍须由她逐项确认怎样继续执行。`;
  } else if (lanes.size === 1) {
    alignment = `这些旧约的权利路径都与“${procedureLabel}”相反，不能被终夜善后覆盖。`;
  }
  return `她仍${arrangements.length > 1 ? '同时' : ''}执行${arrangements.length === 1 ? '一项' : '两项'}亲手落定的亲密后约：${clauses.join('；')}。前奏约与留宿约彼此不覆盖；${alignment}`;
}

function personalFinaleRelationshipMemory(history, heroineId) {
  const state = { history };
  const ordinary = latestOrdinaryNightMemory(state, heroineId);
  const conversation = latestNightConversationMemory(state, heroineId);
  const invitation = duskInvitationMemory(state, heroineId);
  const pair = latestPairInterludeMemory(state, heroineId);
  const favor = latestFavorReckoningMemory(state, heroineId);
  const reckoning = latestRouteReckoningMemory(state, heroineId);
  const candidates = [
    ordinary ? {
      kind:'ordinary_night', day:ordinary.day, label:`普通夜章 · ${ordinary.title}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'night_coda' && entry.heroine === heroineId && entry.event === ordinary.event),
      text:`第${ordinary.day}夜“${ordinary.title}”以“${ordinary.actionLabel}”收住：${ordinary.closing}次晨实际发生：${ordinary.morning}`,
    } : null,
    conversation ? {
      kind:'night_conversation', day:conversation.day, label:`专属夜谈 · ${conversation.title}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'night_conversation' && entry.heroine === heroineId && entry.event === conversation.event && entry.choice === conversation.choice),
      text:`第${conversation.day}夜谈“${conversation.title}”时，她以“${conversation.choiceLabel}”落定，并执行“${conversation.stakeLabel}”：${conversation.stakeText}${conversation.observerName}当场接住这项后果；后来继续执行的是：${conversation.future}`,
    } : null,
    invitation ? {
      kind:'dusk_invitation', day:invitation.day, label:`主动邀约 · ${invitation.title}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'dusk_invitation_aftermath' && entry.heroine === heroineId && entry.event === invitation.event && entry.choice === invitation.choice),
      text:`第${invitation.day}日她以“${invitation.invitationTitle}”主动开约，亲口说：${invitation.heroineLine}你先选择“${invitation.approachLabel}”，经${invitation.witnessName}见证后再以“${invitation.choiceLabel}”落成“${invitation.title}”：${invitation.outcome}`,
    } : null,
    pair ? {
      kind:'pair_interlude', day:pair.day, label:`双院落约 · ${pair.title}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'pair_interlude' && entry.event === pair.event && entry.choice === pair.choice && entry.pair?.includes(heroineId)),
      text:`第${pair.day}日她与${pair.partnerName}以“${pair.label}”落下“${pair.title}”，${pair.witnessName}在场见证；实际留下的横向关系是：${pair.memory}`,
    } : null,
    favor ? {
      kind:'favor_reckoning', day:favor.day, label:`人情还账 · ${favor.debtTitle}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'favor_reckoning' && entry.heroine === heroineId && entry.event === favor.event && entry.sourceDay === favor.sourceDay && entry.choice === favor.choice),
      text:`第${favor.sourceDay}日她曾以“${favor.sourceLabel}”替局面付出，留下“${favor.debtTitle}”；第${favor.day}日她与${favor.observerName}看着你以“${favor.choiceLabel}”结账，真实结果是：${favor.outcome}`,
    } : null,
    reckoning ? {
      kind:'route_reckoning', day:reckoning.day, label:`旧话追账 · ${reckoning.stakeLabel}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'memory_reckoning' && entry.heroine === heroineId && entry.event === reckoning.event && entry.sourceDay === reckoning.sourceDay && entry.sourceChoice === reckoning.sourceChoice && entry.choice === reckoning.choice),
      text:`第${reckoning.sourceDay}日“${reckoning.sourceLabel}”留下“${reckoning.stakeLabel}”后，第${reckoning.day}日由${reckoning.observerName}见证，以“${reckoning.choiceLabel}”重新落定；真实结果是：${reckoning.outcome}`,
    } : null,
  ].filter((row) => row && row.historyIndex >= 0);
  if (!candidates.length) return null;
  return candidates.reduce((latest, row) => row.historyIndex > latest.historyIndex ? row : latest);
}

export function personalFinaleRelationshipReason(history, heroineId) {
  if (!HEROINE_IDS.includes(heroineId)) return '';
  const rows = Array.isArray(history) ? history : [];
  const visits = rows.flatMap((entry) => {
    if (entry.type !== 'visit_choice' || entry.heroine !== heroineId) return [];
    const choice = routeChoiceById(heroineId, entry.choice);
    return choice ? [{ day:entry.day, choice }] : [];
  });
  const memory = personalFinaleRelationshipMemory(rows, heroineId);
  const visitScope = visits.length >= 6
    ? `她与你已有${visits.length}次真实路线来往，关系不能用一次物件归还结清。`
    : visits.length >= 2
      ? `她与你已有${visits.length}次真实路线来往，但次数本身不替边界作答。`
      : visits.length === 1
        ? '她与你只有一次真实路线来往，尚不足以让终夜程序自动生效。'
        : '她与你没有一项可核的路线来往，终夜不能从好感或结局位置补造亲近。';
  if (memory) {
    return `${visitScope}最近一项独立于路线计数的关系事实是：${memory.text}这件真事会进入她的核约语境，却不单独替她接受、改写或拒绝善后。`;
  }
  if (!visits.length) return `${visitScope}也没有普通夜章、专属夜谈、主动邀约、双院落约或已结追账可供她引用。`;
  const first = visits[0];
  const latest = visits.at(-1);
  const span = visits.length === 1
    ? `唯一一次是第${first.day}日“${first.choice.label}”：${first.choice.text}`
    : `来往从第${first.day}日“${first.choice.label}”：${first.choice.text}走到第${latest.day}日“${latest.choice.label}”：${latest.choice.text}`;
  return `${visitScope}${span}除此之外没有一项已经完成的独立关系事件；这些具体来往仍须与上一条路线立场一起核验，不能被压成好感通行证。`;
}

export function personalFinaleOutcomeReason(procedure, heroineId, outcome) {
  if (!procedure?.id || !HEROINE_IDS.includes(heroineId) || !PERSONAL_FINALE_DEPARTURE_OUTCOMES.has(outcome)) return '';
  const response = PERSONAL_FINALE_DEPARTURES[procedure.id]?.[heroineId]?.[outcome];
  if (!response) return '';
  const outcomeLabel = ({ accept:'接下程序', amend:'亲手改约', refuse:'自行收回' })[outcome];
  return `${HEROINES[heroineId].short}面对的真实提案是“${procedure.label}”：${procedure.summary}它直接处分${procedure.focus}。她最终选择“${outcomeLabel}”，本人动作是“${response.title}”；这项结论只处理本次善后，不把接受写成祝福、改约写成讨价，或把拒绝写成嫉妒与认输。`;
}

export function personalFinaleRouteReason(history, heroineId, procedure) {
  const rows = (Array.isArray(history) ? history : []).flatMap((entry) => {
    if (entry.type !== 'visit_choice' || entry.heroine !== heroineId) return [];
    const lane = routeChoiceLane(heroineId, entry.choice);
    const choice = routeChoiceById(heroineId, entry.choice);
    if (!lane || !choice) return [];
    return [{ day:entry.day, id:choice.id, lane, label:choice.label, text:choice.text }];
  });
  const covenantRows = rows.filter((row) => row.lane === 'covenant');
  const privateRows = rows.filter((row) => row.lane === 'private');
  let historyText = '她此前没有可核的人物路线选择，因此没有一条隐藏倾向可以替她预先答应善后。';
  if (covenantRows.length > privateRows.length) {
    const latest = covenantRows.at(-1);
    historyText = `她的路线账留下共同承担${covenantRows.length}次、本人私门${privateRows.length}次；最近支撑共同规则的是第${latest.day}日“${latest.label}”：${latest.text}这项真选择，而非汇总分数，构成她今天核约的同向依据。`;
  } else if (privateRows.length > covenantRows.length) {
    const latest = privateRows.at(-1);
    historyText = `她的路线账留下共同承担${covenantRows.length}次、本人私门${privateRows.length}次；最近支撑本人私门的是第${latest.day}日“${latest.label}”：${latest.text}这项真选择，而非汇总分数，构成她今天核约的同向依据。`;
  } else if (rows.length) {
    const covenant = covenantRows.at(-1);
    const privateChoice = privateRows.at(-1);
    historyText = `她的路线账在共同承担与本人私门各有${covenantRows.length}次：最近一项共同规则是第${covenant.day}日“${covenant.label}”：${covenant.text}最近一项本人私门是第${privateChoice.day}日“${privateChoice.label}”：${privateChoice.text}两项都仍在场，没有一边能被系统写成默认答案。`;
  }
  return `${historyText}本次真实提案是“${procedure?.label ?? '未知善后'}”：${procedure?.summary ?? ''}其直接触及${procedure?.focus ?? '本人权利'}。`;
}

export function personalFinaleSelectedProcedureReason(procedure, heroineId) {
  if (!procedure?.id || !HEROINE_IDS.includes(heroineId) || !PERSONAL_FINALE_DEPARTURES[procedure.id]) return '';
  return `你与${HEROINES[heroineId].short}在第三答落下的真实程序是“${procedure.label}”：${procedure.summary}它只处分${procedure.focus}。她可以确认自己怎样陪你执行、怎样不替你遮掩，却不能替另外四院接下、改写或拒绝；因此这项共同决定必须在四个人逐一亲口作答以后才生效。`;
}

export function personalFinaleSelectedReasons(history, heroineId, beatIndex, selectedChoice) {
  if (!HEROINE_IDS.includes(heroineId) || !Number.isInteger(beatIndex) || beatIndex < 0 || beatIndex > 2) return [];
  const finale = PERSONAL_FINALES[heroineId];
  const choice = finale?.beats?.[beatIndex]?.choices?.find((row) => row.id === selectedChoice?.id);
  if (!choice) return [];
  const rows = Array.isArray(history) ? history : [];
  if (beatIndex === 0) return [personalFinaleRelationshipReason(rows, heroineId)];
  if (beatIndex === 1) {
    const boundaryProposal = {
      label:choice.label,
      summary:choice.text,
      focus:finale.beats[beatIndex].title,
      lane:choice.style === 'open' ? 'covenant' : 'private',
    };
    return [
      personalFinaleBoundaryReason(rows, heroineId),
      personalFinaleIntimacyReason(rows, heroineId, boundaryProposal),
    ].filter(Boolean);
  }
  if (!choice.departureProcedure) return [];
  const reasons = [personalFinaleRouteReason(rows, heroineId, choice.departureProcedure)];
  const rivalryReason = personalFinaleSelectedRivalryReason(rows, heroineId);
  if (rivalryReason) reasons.push(rivalryReason);
  reasons.push(personalFinaleSelectedProcedureReason(choice.departureProcedure, heroineId));
  return reasons;
}

function personalFinaleDepartureReasons(basis, heroine, procedure, outcome) {
  const arrangements = basis.arrangements[heroine] ?? [];
  const relationText = arrangements.length
    ? personalFinaleIntimacyReason(basis.history, heroine, procedure)
    : personalFinaleRelationshipReason(basis.history, heroine);
  const reasons = [
    personalFinaleBoundaryReason(basis.history, heroine),
    personalFinaleRouteReason(basis.history, heroine, procedure),
    relationText,
    personalFinaleOutcomeReason(procedure, heroine, outcome),
  ];
  const rivalryReason = personalFinaleRivalryReason(basis.history, heroine);
  if (rivalryReason) reasons.splice(reasons.length - 1, 0, rivalryReason);
  return reasons;
}

function expectedPersonalFinaleDepartures(history, selectedHeroine, procedure) {
  const basis = personalFinaleDepartureBasis(history);
  return HEROINE_IDS.filter((id) => id !== selectedHeroine).map((heroine) => ({
    heroine,
    outcome:personalFinaleDepartureOutcome(basis, heroine, procedure),
  }));
}

function validPersonalFinaleDepartures(rows, selectedHeroine, allowEmpty = false) {
  if (!Array.isArray(rows)) return false;
  if (allowEmpty && rows.length === 0) return true;
  const expectedHeroines = HEROINE_IDS.filter((id) => id !== selectedHeroine);
  return rows.length === expectedHeroines.length && rows.every((row, index) => (
    isRecord(row)
    && hasExactKeys(row, ['heroine', 'outcome'])
    && row.heroine === expectedHeroines[index]
    && PERSONAL_FINALE_DEPARTURE_OUTCOMES.has(row.outcome)
  ));
}

function recordedPersonalFinaleDepartures(state) {
  const row = [...state.history].reverse().find((entry) => entry.type === 'personal_finale' && entry.departures?.length);
  return row?.departures ?? [];
}

function personalFinaleChoiceById(choiceId) {
  for (const finale of Object.values(PERSONAL_FINALES)) {
    for (const beat of finale.beats) {
      const choice = beat.choices.find((row) => row.id === choiceId);
      if (choice) return choice;
    }
  }
  return null;
}

function personalFinaleDepartureResponse(choiceId, heroine, outcome) {
  const procedureId = personalFinaleChoiceById(choiceId)?.departureProcedure?.id;
  return procedureId ? PERSONAL_FINALE_DEPARTURES[procedureId]?.[heroine]?.[outcome] ?? null : null;
}

function recordedPersonalFinaleDepartureDetails(state) {
  if (!Array.isArray(state?.history)) return [];
  const historyIndex = state.history.findLastIndex((entry) => entry.type === 'personal_finale' && entry.departures?.length);
  if (historyIndex < 0) return [];
  const settlement = state.history[historyIndex];
  const choice = personalFinaleChoiceById(settlement.choice);
  const procedure = choice?.departureProcedure;
  if (!procedure) return [];
  const basis = personalFinaleDepartureBasis(state.history.slice(0, historyIndex));
  return settlement.departures.flatMap((departure) => {
    const response = PERSONAL_FINALE_DEPARTURES[procedure.id]?.[departure.heroine]?.[departure.outcome];
    if (!response) return [];
    return [{
      heroine:departure.heroine,
      outcome:departure.outcome,
      procedure:structuredClone(procedure),
      response:structuredClone(response),
      title:response.title,
      line:response.line,
      reasons:personalFinaleDepartureReasons(basis, departure.heroine, procedure, departure.outcome),
    }];
  });
}

export function personalFinaleDepartureDetails(state) {
  return structuredClone(recordedPersonalFinaleDepartureDetails(state));
}

function startPersonalFinale(state, heroine) {
  const finale = PERSONAL_FINALES[heroine];
  if (!finale || state.day !== MAX_DAY || state.personalFinaleChoices.length) return false;
  state.personalFinale = { event: finale.id, heroine, departureBeat:-1, departures:[] };
  state.phase = 'personal_finale';
  return true;
}

export function personalFinaleBeat(state) {
  if (state.phase !== 'personal_finale' || !state.personalFinale) return null;
  const finale = PERSONAL_FINALES[state.personalFinale.heroine];
  if (!finale || finale.id !== state.personalFinale.event) return null;
  const index = state.personalFinaleChoices.length;
  const beat = finale.beats[index];
  if (!beat) return null;
  const previousBeat = index > 0 ? finale.beats[index - 1] : null;
  const previousChoice = previousBeat?.choices.find((choice) => choice.id === state.personalFinaleChoices[index - 1]);
  return {
    ...beat,
    index,
    heroine: state.personalFinale.heroine,
    finale: finale.id,
    asset: finale.asset,
    previousText: previousChoice?.text ?? null,
  };
}

export function personalFinaleOptions(state) {
  const beat = personalFinaleBeat(state);
  if (!beat) return [];
  return beat.choices.map((choice) => ({
    ...choice,
    meta: `${choice.style === 'open' ? '明账相守' : '私门相守'}${choice.effects?.house ? ` · 宅+${choice.effects.house}` : ''}`,
    disabled: cannotAfford(state, choice),
    locked: cannotAfford(state, choice) ? costLockedText(choice) : '',
  }));
}

export function currentPersonalFinaleResult(state) {
  if (state.phase !== 'personal_finale_result' || !state.personalFinale || !state.personalFinaleChoices.length) return null;
  const finale = PERSONAL_FINALES[state.personalFinale.heroine];
  if (!finale || finale.id !== state.personalFinale.event) return null;
  const index = state.personalFinaleChoices.length - 1;
  const beat = finale.beats[index];
  const choice = beat?.choices.find((row) => row.id === state.personalFinaleChoices[index]);
  const response = choice ? PERSONAL_FINALE_RESPONSES[choice.id] : null;
  if (!beat || !choice || !response) return null;
  if (index === finale.beats.length - 1 && state.personalFinale.departureBeat >= 0) {
    const departureIndex = state.personalFinale.departureBeat;
    const departure = state.personalFinale.departures[departureIndex];
    const departureResponse = departure ? personalFinaleDepartureResponse(choice.id, departure.heroine, departure.outcome) : null;
    const thirdHistoryIndex = state.history.findIndex((entry) => (
      entry.type === 'personal_finale'
      && entry.heroine === state.personalFinale.heroine
      && entry.beat === beat.id
    ));
    if (!departure || !departureResponse || thirdHistoryIndex < 0) return null;
    const basis = personalFinaleDepartureBasis(state.history.slice(0, thirdHistoryIndex));
    return {
      finale:finale.id, heroine:state.personalFinale.heroine, asset:finale.asset,
      index, count:finale.beats.length, beat:beat.id, choice,
      response:departureResponse,
      arrangements:intimacyArrangements(state, departure.heroine),
      final:departureIndex === state.personalFinale.departures.length - 1,
      style:personalFinaleStyle(state),
      departure:true,
      departureIndex,
      departureCount:state.personalFinale.departures.length,
      respondent:departure.heroine,
      outcome:departure.outcome,
      procedure:choice.departureProcedure,
      reasons:personalFinaleDepartureReasons(basis, departure.heroine, choice.departureProcedure, departure.outcome),
    };
  }
  return {
    finale:finale.id, heroine:state.personalFinale.heroine, asset:finale.asset,
    index, count:finale.beats.length, beat:beat.id, choice, response,
    arrangements:intimacyArrangements(state, state.personalFinale.heroine),
    final:false,
    style:personalFinaleStyle(state),
    departure:false,
    departureIndex:-1,
    departureCount:state.personalFinale.departures.length,
    respondent:state.personalFinale.heroine,
    outcome:null,
    procedure:choice.departureProcedure,
    reasons:personalFinaleSelectedReasons(state.history, state.personalFinale.heroine, index, choice),
  };
}

export function personalFinaleStyle(state) {
  if (state.personalFinaleChoices.length !== 3) return null;
  const choices = Object.values(PERSONAL_FINALES).flatMap((finale) => finale.beats.flatMap((beat) => beat.choices));
  const open = state.personalFinaleChoices.filter((id) => choices.find((choice) => choice.id === id)?.style === 'open').length;
  return open === 3 ? '明账专情' : open >= 2 ? '有界相守' : '私门深契';
}

export function choosePersonalFinale(state, choiceId) {
  const beat = personalFinaleBeat(state);
  const choice = personalFinaleOptions(state).find((row) => row.id === choiceId);
  if (!beat || !choice) return { ok: false, error: '这封个人终章已经接不到这句话。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '眼下还承担不起这个选择。' };
  if (beat.index === 2 && !choice.departureProcedure) return { ok:false, error:'这项善后还没有写清要处理的权利。' };
  const departures = beat.index === 2
    ? expectedPersonalFinaleDepartures(state.history, beat.heroine, choice.departureProcedure)
    : [];
  applyEffects(state, choice.effects, beat.heroine, `个人终章：${choice.label}`);
  state.personalFinaleChoices.push(choice.id);
  state.personalFinale.departureBeat = -1;
  state.personalFinale.departures = departures;
  record(state, 'personal_finale', { event: beat.finale, heroine: beat.heroine, beat: beat.id, choice: choice.id, departures:structuredClone(departures) });
  state.log.push(choice.text);
  state.phase = 'personal_finale_result';
  return { ok: true, text: choice.text };
}

export function continuePersonalFinaleResult(state) {
  const result = currentPersonalFinaleResult(state);
  if (!result) return {ok:false,error:'这项终章回答还没有得到她的回应。'};
  if (result.departure && result.final) {
    state.personalFinale = null;
    state.ending = determineEnding(state);
    state.phase = 'ending';
    state.over = true;
  } else if (result.departure) {
    state.personalFinale.departureBeat += 1;
  } else if (result.index === result.count - 1) {
    state.personalFinale.departureBeat = 0;
  } else {
    state.phase = 'personal_finale';
  }
  const next = currentPersonalFinaleResult(state);
  const outcomeLabel = next?.outcome ? ({ accept:'接下程序', amend:'亲手改约', refuse:'自行收回' })[next.outcome] : null;
  const announcement = next?.departure
    ? `${HEROINES[next.respondent].name}选择${outcomeLabel}。${next.response.title}。${next.response.line}`
    : state.phase === 'ending'
      ? `四院善后已全部听完。${state.ending.title}。`
      : null;
  return {ok:true,text:result.response.line,announcement};
}

function allianceAssemblyCandidates(state) {
  const settlement = recordedFivePriceSettlement(state);
  if (settlement?.coalition.kind !== 'limited') return [];
  const allowed = new Set(settlement.coalition.members);
  return HEROINE_IDS.filter((id) => allowed.has(id));
}

const ALLIANCE_EVIDENCE_TYPES = new Set(['pair_interlude', 'joint_action', 'route_aftermath', 'day_action']);
const ALLIANCE_DAY20_PROTECTION = new Set(['clear', 'partial', 'violated']);

function allianceEvidence(sourceType, sourceId, sourceDay, otherHeroine) {
  return { sourceType, sourceId, sourceDay, otherHeroine };
}

// 每一对候选只读取最近一笔具名横向行动。初始 bond、好感总量和当前 bond
// 都不能凭空变成支持或冲突；后来的共同执行也能真实覆盖更早的争执。
function allianceHorizontalFact(state, left, right) {
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const entry = state.history[index];
    if (entry.type === 'pair_interlude' && entry.pair?.includes(left) && entry.pair?.includes(right)) {
      const kind = ['listen', 'mediate'].includes(entry.choice) ? 'support' : entry.choice === 'claim' ? 'conflict' : null;
      if (kind) return { kind, evidence:allianceEvidence('pair_interlude', entry.choice, entry.day, right), historyIndex:index };
    }
    if (entry.type === 'joint_action') {
      const joint = JOINT_ACTIONS.find((row) => row.id === entry.action);
      if (joint?.participants.includes(left) && joint.participants.includes(right)) {
        return { kind:'support', evidence:allianceEvidence('joint_action', entry.action, entry.day, right), historyIndex:index };
      }
    }
    if (entry.type === 'route_aftermath'
      && ((entry.heroine === left && entry.observer === right) || (entry.heroine === right && entry.observer === left))) {
      const kind = ['public', 'direct'].includes(entry.choice) ? 'support' : entry.choice === 'private' ? 'conflict' : null;
      if (kind) return { kind, evidence:allianceEvidence('route_aftermath', entry.choice, entry.day, right), historyIndex:index };
    }
    if (entry.type === 'day_action' && Array.isArray(entry.network) && [left, right].includes(entry.actor)) {
      const other = entry.actor === left ? right : left;
      const network = entry.network.find((row) => row.observer === other);
      const kind = (network?.delta ?? 0) > 0 ? 'support' : (network?.delta ?? 0) < 0 ? 'conflict' : null;
      if (kind) return { kind, evidence:allianceEvidence('day_action', entry.action, entry.day, right), historyIndex:index };
    }
  }
  return null;
}

function allianceDay20Protection(state, heroine, right) {
  const finalRow = state.history.find((entry) => entry.type === 'final_reckoning' && entry.day === MAX_DAY) ?? null;
  const aftermath = state.history.find((entry) => entry.type === 'final_reckoning_aftermath' && entry.day === MAX_DAY) ?? null;
  if (!finalRow || !aftermath || aftermath.approach !== finalRow.choice) {
    return { finalChoice:finalRow?.choice ?? null, finalAftermathChoice:aftermath?.choice ?? null, day20Protection:'violated' };
  }
  const clearByRight = {
    withdrawal:new Set(['final_chain_each_release', 'final_receipt_clean_now', 'final_custody_separate']),
    original_quote:new Set(['final_chain_only_fraud', 'final_chain_each_release', 'final_custody_separate', ...(heroine === 'pan_jinlian' ? ['final_receipt_clean_now'] : [])]),
    no_retaliation:new Set(['final_chain_only_fraud', 'final_receipt_clean_now', 'final_custody_separate']),
  };
  return {
    finalChoice:finalRow.choice,
    finalAftermathChoice:aftermath.choice,
    day20Protection:clearByRight[right]?.has(aftermath.choice) ? 'clear' : 'partial',
  };
}

const SHARED_NIGHT_PROTECTION_LABELS = Object.freeze({
  clear:'所保权利已明确落地',
  partial:'所保权利只得到部分落实',
  violated:'所保权利在执行中被越过',
});

function sharedNightProtectionText(right, protection) {
  const texts = {
    withdrawal:{
      clear:'第二十日的二次落字仍逐页留给本人，昨夜答复没有被当成不可撤回的总授权。',
      partial:'第二十日的结构保留了本人处置，却没有逐页重问昨夜答复；同灯以后仍须把撤回当作随时有效，而不是一次性入席条件。',
      violated:'第二十日没有留下本人重新确认的入口；这项执行不足以支持五院同灯。',
    },
    original_quote:{
      clear:'第二十日把原封、引用范围与本人放行分开记录，昨夜原话没有被摘要替代。',
      partial:'第二十日保住了本人材料，却没有把每一处引用都对回原封；同灯以后仍须逐句核印，不能拿共同结论吞掉原话。',
      violated:'第二十日允许摘句替代原封；这项执行不足以支持五院同灯。',
    },
    no_retaliation:{
      clear:'第二十日把每人的物件、工钱、名帖与退路分开处置，没有拿一院答复抵偿另一院。',
      partial:'第二十日没有直接连坐，却仍把部分共同执行压在同一结构里；同灯以后须继续逐人分栏，不能让一院退出拖走另一院权利。',
      violated:'第二十日拿一院的答复抵偿了另一院权利；这项执行不足以支持五院同灯。',
    },
  };
  return texts[right]?.[protection] ?? '这项权利怎样进入第二十日没有形成可核记录。';
}

function sharedNightAccordEntry(state, heroineId) {
  if (!HEROINE_IDS.includes(heroineId)) return null;
  const settlement = recordedFivePriceSettlement(state);
  const sharedNight = state?.history?.find((entry) => entry.type === 'shared_night' && entry.choice === COALITION_CHOICE_ID) ?? null;
  if (!sharedNight || settlement?.coalition.kind !== 'full' || !HEROINE_IDS.every((id) => settlement.coalition.members.includes(id))) return null;
  const reply = settlement.replies.find((entry) => entry.heroine === heroineId);
  const protocol = FIVE_PRIVATE_PRICES.protocols.find((entry) => entry.id === settlement.protocol);
  const right = FIVE_PRIVATE_PRICES.rights.find((entry) => entry.id === settlement.right);
  const offer = FIVE_PRIVATE_PRICES.offers[heroineId];
  const outcome = offer?.outcomes?.[reply?.outcome];
  const finalRow = state.history.find((entry) => entry.type === 'final_reckoning' && entry.day === MAX_DAY) ?? null;
  const aftermathRow = state.history.find((entry) => entry.type === 'final_reckoning_aftermath' && entry.day === MAX_DAY) ?? null;
  const finalChoice = FINAL_RECKONING.choices.find((entry) => entry.id === finalRow?.choice);
  const aftermathChoice = FINAL_RECKONING_AFTERMATHS[finalRow?.choice]?.choices.find((entry) => entry.id === aftermathRow?.choice);
  const accord = ACCORD_CHOICES[heroineId];
  const accordRow = [...state.history].reverse().find((entry) => entry.type === 'accord_term' && entry.heroine === heroineId && entry.choice === accord?.id) ?? null;
  const proof = COALITION_PROOF_META[heroineId];
  const day20 = allianceDay20Protection(state, heroineId, settlement.right);
  if (!reply || !protocol || !right || !offer || !outcome || !finalChoice || !aftermathChoice || aftermathRow.approach !== finalRow.choice || !accordRow || !proof || !state.flags?.[proof.flag]) return null;
  const boundary = PERSONAL_FINALE_BOUNDARY_OBJECTS[heroineId];
  const protectionLabel = SHARED_NIGHT_PROTECTION_LABELS[day20.day20Protection];
  const protectionText = sharedNightProtectionText(settlement.right, day20.day20Protection);
  const reasons = [
    `第19日，她收到“${offer.title}”，本人选择“${outcome.label}”，原话是：${outcome.line} ${outcome.body}这份答复只处分写着她名字的价书，不因五封同桌便成为五院同声。`,
    `第20日先执行“${finalChoice.label}”（${finalChoice.hint}），再以“${aftermathChoice.label}”（${aftermathChoice.hint}）落定。相对于第19日共同保留的“${right.label}”，结果是“${protectionLabel}”：${protectionText}`,
    `她此前亲手落下院约“${accord.label}”（${accord.hint}）：${accord.text}她也真实完成“${proof.label}”。院约与实绩证明她能共同执行，却都不能替她预先同意此后的每一次亲近、出证或留席。`,
  ];
  const sharedChoice = SHARED_NIGHT_CHOICES.find((entry) => entry.id === COALITION_CHOICE_ID);
  return {
    heroine:heroineId,
    boundary,
    accord:{ id:accord.id, day:accordRow.day, label:accord.label, hint:accord.hint, text:accord.text },
    proof:{ flag:proof.flag, label:proof.label },
    day19:{
      protocol:settlement.protocol, protocolLabel:protocol.label, protocolText:protocol.text,
      right:settlement.right, rightLabel:right.label, rightText:right.text,
      offer:offer.id, offerTitle:offer.title,
      outcome:reply.outcome, outcomeLabel:outcome.label, responseLine:outcome.line, result:outcome.body,
    },
    day20:{
      choice:finalChoice.id, choiceLabel:finalChoice.label, choiceText:finalChoice.text,
      aftermathChoice:aftermathChoice.id, aftermathLabel:aftermathChoice.label, aftermathText:aftermathChoice.text,
      protection:day20.day20Protection, protectionLabel, protectionText,
    },
    reasons,
    conclusion:`因此今夜“${sharedChoice?.label ?? '分五种权力给她们'}”只确认她带着自己的答复、院约与实绩参与共同执行；它不授权你或其他四院代管她的${boundary}，也不把第19日的“${outcome.label}”抹成一句整齐的同意。`,
  };
}

export function sharedNightAccordReasons(state, heroineId) {
  return sharedNightAccordEntry(state, heroineId)?.reasons ?? [];
}

export function recordedSharedNightAccord(state) {
  const rows = HEROINE_IDS.map((heroineId) => sharedNightAccordEntry(state, heroineId));
  return rows.every(Boolean) ? rows : [];
}

function allianceAssemblyReply(state, heroine, candidates) {
  const settlement = recordedFivePriceSettlement(state);
  const day19 = settlement?.replies.find((reply) => reply.heroine === heroine) ?? null;
  const horizontal = candidates
    .filter((id) => id !== heroine)
    .map((id, order) => ({ ...allianceHorizontalFact(state, heroine, id), order }))
    .filter((row) => row.kind)
    .sort((left, right) => right.historyIndex - left.historyIndex || left.order - right.order);
  const support = horizontal.find((row) => row.kind === 'support')?.evidence ?? null;
  const conflict = horizontal.find((row) => row.kind === 'conflict')?.evidence ?? null;
  const basis = personalFinaleDepartureBasis(state.history);
  const broken = fivePriceUnresolvedBreak(basis, heroine);
  const day20 = allianceDay20Protection(state, heroine, settlement?.right);
  // Day19 本人答复已经吸收了当时的路线方向。Day20 再问不重复读取累计 stance，
  // 只看本人院约、未修破裂、具名横向前史与刚执行的权利裁决。
  const personallyReady = heroineAccordReady(state, heroine);
  const hasHorizontal = !!support || !!conflict;
  let outcome = 'join';
  if (broken || !personallyReady || !hasHorizontal || day20.day20Protection === 'violated') outcome = 'withdraw';
  else if (conflict || ['counter', 'refuse'].includes(day19?.outcome) || day20.day20Protection === 'partial') outcome = 'amend';
  return {
    heroine,
    outcome,
    day19Outcome:day19?.outcome ?? null,
    ...day20,
    support,
    conflict,
  };
}

function expectedAllianceAssembly(state, candidates = allianceAssemblyCandidates(state)) {
  const replies = candidates.map((heroine) => allianceAssemblyReply(state, heroine, candidates));
  return {
    candidates:[...candidates],
    replies,
    members:replies.filter((reply) => reply.outcome !== 'withdraw').map((reply) => reply.heroine),
  };
}

function allianceAssemblyReasons(state, reply) {
  const settlement = recordedFivePriceSettlement(state);
  const finalLabel = FINAL_RECKONING.choices.find((choice) => choice.id === reply.finalChoice)?.label ?? '第二十日外账';
  const finalAftermathLabel = Object.values(FINAL_RECKONING_AFTERMATHS)
    .flatMap((aftermath) => aftermath.choices)
    .find((choice) => choice.id === reply.finalAftermathChoice)?.label ?? '逐页落字';
  const rightLabel = ({ withdrawal:'撤回权', original_quote:'原话权', no_retaliation:'不连坐' })[settlement?.right] ?? '本人答复权';
  const day19Label = ({ accept:'接价', counter:'反要价', refuse:'拒价', expose:'公开价书' })[reply.day19Outcome] ?? '保留本人答复';
  const evidenceLabel = (source, kind) => {
    if (!source) return null;
    const other = HEROINES[source.otherHeroine].short;
    if (source.sourceType === 'pair_interlude') {
      const label = ({ listen:'让她们说完', mediate:'只主持边界', claim:'拉回争宠' })[source.sourceId];
      return `第${source.sourceDay}日，她与${other}在双院私议选择“${label}”，这笔${kind === 'support' ? '横向承接' : '具名争执'}可以逐项回查。`;
    }
    if (source.sourceType === 'joint_action') {
      const label = JOINT_ACTIONS.find((row) => row.id === source.sourceId)?.label ?? source.sourceId;
      return `第${source.sourceDay}日，她与${other}共同办完“${label}”，席位依据是这桩实事，不是隐藏互信分。`;
    }
    if (source.sourceType === 'route_aftermath') {
      return `第${source.sourceDay}日，她与${other}把路线后果落成“${ROUTE_AFTERMATH_CHOICE_LABELS[source.sourceId]}”，这笔${kind === 'support' ? '共同处理' : '门内保留'}仍约束今夜。`;
    }
    const label = DAY_ACTIONS[source.sourceId]?.label ?? source.sourceId;
    return `第${source.sourceDay}日“${label}”白日办事后，${other}${kind === 'support' ? '明确接过一段后果' : '明确拒绝替这段后果作保'}。`;
  };
  const horizontal = reply.support
    ? evidenceLabel(reply.support, 'support')
    : '候选中没有一人曾与她具名同办或亲自谈过边界；一张共同邀请不能补写横向关系。';
  const conflict = reply.conflict
    ? evidenceLabel(reply.conflict, 'conflict')
    : '候选之间没有一笔需要被隐藏分数替她抹掉的具名冲突。';
  const protection = reply.day20Protection === 'clear'
    ? `“${finalLabel}／${finalAftermathLabel}”明确保住了她的${rightLabel}，所以今日外账没有替她加新条件。`
    : reply.day20Protection === 'partial'
      ? `“${finalLabel}／${finalAftermathLabel}”只部分保住她的${rightLabel}；她已经亲手把今夜条款收窄后才留下。`
      : `今日外账没有兑现她的${rightLabel}，她因此直接撤回，不让第十九夜答复被当作永久授权。`;
  return [
    `第十九夜她选择“${day19Label}”；${protection}`,
    horizontal,
    reply.outcome === 'withdraw'
      ? '她自行回院，不受妒意惩罚；未修边界、个人关系、横向前史或今日权利兑现中至少一项仍不足，玩家不能劝改。'
      : reply.outcome === 'amend'
        ? `${conflict} 修订已经由她本人当场写完并生效，不留给玩家日后补办。`
        : '她的院约、Day19 本人答复与至少一段具名横向行动都仍成立，因此本人明确留下。',
  ];
}

function validAllianceEvidence(source, candidates, heroine) {
  if (source === null) return true;
  if (!source || !hasExactKeys(source, ['sourceType','sourceId','sourceDay','otherHeroine'])
    || !ALLIANCE_EVIDENCE_TYPES.has(source.sourceType)
    || typeof source.sourceId !== 'string'
    || !Number.isInteger(source.sourceDay) || source.sourceDay < 1 || source.sourceDay > MAX_DAY
    || !candidates.includes(source.otherHeroine) || source.otherHeroine === heroine) return false;
  if (source.sourceType === 'pair_interlude') return ['listen','mediate','claim'].includes(source.sourceId);
  if (source.sourceType === 'joint_action') return JOINT_ACTION_IDS.has(source.sourceId);
  if (source.sourceType === 'route_aftermath') return ROUTE_AFTERMATH_CHOICE_IDS.has(source.sourceId);
  return !!DAY_ACTIONS[source.sourceId];
}

export function recordedAllianceAssembly(state) {
  const row = state?.history?.find((entry) => entry.type === 'alliance_assembly' && entry.day === MAX_DAY) ?? null;
  if (!row) return null;
  return {
    candidates:[...row.candidates],
    replies:row.replies.map((reply) => structuredClone(reply)),
    members:[...row.members],
  };
}

export function allianceNightStatus(state) {
  const candidates = allianceAssemblyCandidates(state);
  const attempted = !!recordedAllianceAssembly(state);
  let reason = '';
  if (attempted) reason = '这些人已经逐院答过；拒绝与收窄都不能靠再问一次改写。';
  else if (recordedFivePriceSettlement(state)?.coalition.kind === 'failed') reason = '第十九夜没有两份可以互证的答复；今夜不能凭好感重新拼出联盟。';
  else if (recordedFivePriceSettlement(state)?.coalition.kind === 'full') reason = '第十九夜仍是五人互证；若五院终夜尚未成立，不能由系统静默裁掉其中两人。';
  else if (candidates.length < 2) reason = '第十九夜没有留下至少两名有限互证者。';
  return {
    visible: state.day === MAX_DAY && state.phase === 'choose_visit',
    ready: !attempted && candidates.length >= 2,
    reason,
    candidates,
    size:candidates.length,
  };
}

export function startAllianceNight(state) {
  if (state.phase !== 'choose_visit' || state.day !== MAX_DAY) return { ok: false, error: '还没到逐院问灯的时候。' };
  const status = allianceNightStatus(state);
  if (!status.ready) return { ok: false, error: status.reason || '第十九夜的有限互证还不足以发出同一份邀请。' };
  const assembly = expectedAllianceAssembly(state, status.candidates);
  state.currentHeroine = null;
  state.allianceAssembly = { beat:0, ...structuredClone(assembly) };
  state.allianceMembers = [];
  state.allianceChoices = [];
  record(state, 'alliance_assembly', structuredClone(assembly));
  state.phase = 'alliance_assembly';
  return { ok: true, announcement:'同一份邀请已经送到第十九夜所有有限互证者手里；接下来只听本人答，不再按分数挑人。' };
}

export function currentAllianceAssembly(state) {
  const pending = state.allianceAssembly;
  if (state.phase !== 'alliance_assembly' || !pending) return null;
  const count = pending.candidates.length + 2;
  const beat = pending.beat;
  const reply = beat >= 1 && beat <= pending.candidates.length ? pending.replies[beat - 1] : null;
  const response = reply ? ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine]?.[reply.outcome] ?? null : null;
  const outcomeLabel = { join:'本人留下', amend:'收窄后留下', withdraw:'自行回院' };
  const current = beat === 0
    ? {
      title:'同一份邀请送到每一名有限互证者手里',
      body:`第十九夜的${pending.candidates.map((id) => HEROINES[id].short).join('、')}只同意过外账互证，不曾预签今夜同席。你不能删名、排序或劝改；她们在同一份冻结前史上各自作答。`,
    }
    : reply
      ? { title:response.title, body:`${HEROINES[reply.heroine].name}没有等前一人的回答来改口；她现在只处分自己的席位、权限与手中原物。` }
      : {
        title:pending.members.length >= 2 ? `${pending.members.map((id) => HEROINES[id].short).join('、')}亲自把席留下` : '今夜没有形成有限同盟',
        body:`${pending.replies.map((row) => `${HEROINES[row.heroine].short}：${outcomeLabel[row.outcome]}，${ALLIANCE_ASSEMBLY_RESPONSES[row.heroine][row.outcome].object}`).join('；')}。所有“收窄后留下”的条款都已由本人当场改写并生效，不是等玩家日后补办。`,
      };
  return {
    beat, count, stage:beat === 0 ? 'opening' : reply ? 'reply' : 'resolution', current,
    candidates:[...pending.candidates], replies:pending.replies.map((row) => structuredClone(row)), members:[...pending.members],
    reply, response, reasons:reply ? allianceAssemblyReasons(state, reply) : [],
    final:beat === count - 1,
  };
}

export function advanceAllianceAssembly(state) {
  const story = currentAllianceAssembly(state);
  if (!story) return { ok:false, error:'逐院问灯没有接上第十九夜的答复。' };
  if (!story.final) {
    state.allianceAssembly.beat += 1;
    const next = currentAllianceAssembly(state);
    return { ok:true, announcement:next?.reply ? `${HEROINES[next.reply.heroine].name}本人决定：${next.response.title}。` : next?.current?.title };
  }
  const members = [...story.members];
  state.allianceAssembly = null;
  if (members.length < 2) {
    state.allianceMembers = [];
    state.phase = 'choose_visit';
    return { ok:true, announcement:'不足两人亲自留下，有限同盟没有成立；拒绝者保留原物与院门，不受惩罚。' };
  }
  state.allianceMembers = members;
  record(state, 'alliance_night_start', { members:[...members] });
  state.phase = 'alliance_night';
  return { ok:true, announcement:`${members.map((id) => HEROINES[id].name).join('、')}亲自留下；联盟三问只约束真实成员。` };
}

function allianceNightBoundaryReason(history, heroineId) {
  const basis = personalFinaleDepartureBasis(Array.isArray(history) ? history : []);
  const accord = ACCORD_CHOICES[heroineId];
  const accordRow = [...basis.history].reverse().find((entry) => (
    entry.type === 'accord_term'
    && entry.heroine === heroineId
    && entry.term === accord.effects.accord
    && entry.choice === accord.id
  )) ?? null;
  const breakStatus = fivePriceBreakStatus(basis, heroineId);
  const boundary = PERSONAL_FINALE_BOUNDARY_OBJECTS[heroineId];
  const heroine = HEROINES[heroineId].short;
  const accordState = accordRow
    ? `第${accordRow.day}日，她本人落下“${accord.label}”（${accord.hint}）：${accord.text}`
    : `${heroine}从未亲手落下“${accord.label}”（${accord.hint}）这项院约`;
  if (!breakStatus.entry) {
    return accordRow
      ? `${accordState}这条真实旧约仍只保护她自己的${boundary}，是否放进有限同盟必须由她本人重新确认。`
      : `${accordState}；有限同盟不能拿其他成员的院约补成她的同意，只能让她继续保有${boundary}。`;
  }
  const breakEntry = breakStatus.entry;
  let breakText = `第${breakEntry.day}日宅门跌到${breakEntry.house}，五院同时关门，${heroine}的${boundary}失去共同执行条件`;
  if (breakEntry.heroine === heroineId) {
    const source = breakStatus.source?.entry ? routeChoiceById(heroineId, breakStatus.source.entry.choice) : null;
    breakText = source
      ? `第${breakEntry.day}日“${source.label}”（${source.hint}）留下真实越界：${source.text}这使${heroine}的${boundary}累计被公开越过${breakEntry.overrides ?? basis.overrides[heroineId]}次`
      : `第${breakEntry.day}日，${heroine}的${boundary}累计被公开越过${breakEntry.overrides ?? basis.overrides[heroineId]}次`;
  }
  if (breakStatus.unresolved) return `${breakText}；此后没有本人具名修回。有限同盟不能用成员身份覆盖这项未结失信。`;
  const repairText = personalFinaleBoundaryRepairReason(breakStatus.repair?.entry, heroineId);
  return `${breakText}；${repairText || `第${breakStatus.repair?.entry?.day}日她本人具名修回这条边界`}。修回只让她重新参与核约，不把自己的${boundary}并入其他成员名下。`;
}

function allianceNightIntimacyReason(history, heroineId, choice) {
  const arrangements = personalFinaleArrangementsFromHistory(Array.isArray(history) ? history : [], heroineId);
  if (!arrangements.length) return '';
  const lane = choice.id === 'alliance_separate_doors' ? 'private' : 'covenant';
  const lanes = new Set(arrangements.map((row) => row.lane).filter(Boolean));
  const clauses = arrangements.map((row) => `第${row.day}夜“${row.label}”（${row.hint}）`).join('；');
  let alignment = `这些旧约须逐项核验，不能被“${choice.label}”一句覆盖。`;
  if (lanes.size > 1) alignment = `共同规则与本人私门两类旧约都仍有效，“${choice.label}”不能任选一边吞掉另一边。`;
  else if (lanes.has(lane)) alignment = `这些旧约与“${choice.label}”同向，但仍须由她重新确认成员、期限与退出。`;
  else alignment = `这些旧约与“${choice.label}”方向相反，本拍安排不能倒写当时的同意。`;
  return `她仍执行${arrangements.length}项亲密后约：${clauses}。${alignment}`;
}

function allianceNightRosterReason(state, heroineId) {
  const assembly = recordedAllianceAssembly(state);
  if (!assembly || !assembly.members.includes(heroineId)) return '';
  const withdrawn = assembly.replies.filter((reply) => reply.outcome === 'withdraw').map((reply) => {
    const voice = ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine]?.withdraw;
    return `${HEROINES[reply.heroine].short}本人回院并带走${voice?.object ?? '自己的原物'}`;
  });
  const outside = HEROINE_IDS.filter((id) => !assembly.candidates.includes(id));
  const outsideText = outside.length
    ? `${outside.map((id) => HEROINES[id].short).join('、')}从未进入第十九夜有限互证候选，今夜不能替她们补签。`
    : '第十九夜所有候选都已亲口作答，没有人的沉默可以被解释成同意。';
  return `逐院问灯的真实成员只有${assembly.members.map((id) => HEROINES[id].short).join('、')}；${withdrawn.length ? `${withdrawn.join('；')}。` : '候选中无人被系统静默裁去。'}${outsideText}${HEROINES[heroineId].short}只能决定自己怎样面对未入盟者，不能代表整桌发出邀请或收走院门。`;
}

function allianceNightChoiceReason(choice, heroineId, beatIndex, memberCount) {
  const scope = beatIndex === 0
    ? '真实成员彼此与玩家之间的关系归属'
    : beatIndex === 1
      ? '每名成员自己的钥匙、去处、拒绝与私账'
      : '实际成员、退出者与从未成为候选者之间的边界';
  return `${HEROINES[heroineId].short}本拍面对的真实安排是“${choice.label}”（${choice.hint}）：${choice.text}它只约束${memberCount}名本人留下者的${scope}，不自动扩成五院共同规则。`;
}

export function allianceNightMemberReasons(state, heroineId, beatIndex, selectedChoice) {
  if (!Array.isArray(state?.allianceMembers)
    || ![2, 3, 4].includes(state.allianceMembers.length)
    || !state.allianceMembers.includes(heroineId)
    || !Number.isInteger(beatIndex)
    || beatIndex < 0
    || beatIndex >= ALLIANCE_NIGHT_BEATS.length) return [];
  const choice = ALLIANCE_NIGHT_BEATS[beatIndex].choices.find((row) => row.id === selectedChoice?.id);
  if (!choice) return [];
  const choiceReason = allianceNightChoiceReason(choice, heroineId, beatIndex, state.allianceMembers.length);
  if (beatIndex === 0) {
    const reply = recordedAllianceAssembly(state)?.replies.find((row) => row.heroine === heroineId);
    return reply ? [...allianceAssemblyReasons(state, reply), choiceReason] : [];
  }
  if (beatIndex === 1) {
    return [
      allianceNightBoundaryReason(state.history, heroineId),
      allianceNightIntimacyReason(state.history, heroineId, choice),
      choiceReason,
    ].filter(Boolean);
  }
  return [allianceNightRosterReason(state, heroineId), choiceReason].filter(Boolean);
}

export function allianceNightBeat(state) {
  if (state.phase !== 'alliance_night') return null;
  const index = state.allianceChoices.length;
  const beat = ALLIANCE_NIGHT_BEATS[index];
  if (!beat) return null;
  const previousBeat = index > 0 ? ALLIANCE_NIGHT_BEATS[index - 1] : null;
  const previousChoice = previousBeat?.choices.find((choice) => choice.id === state.allianceChoices[index - 1]);
  const assembly = recordedAllianceAssembly(state);
  const withdrawn = assembly?.replies.filter((reply) => reply.outcome === 'withdraw').map((reply) => ({
    heroine:reply.heroine,
    object:ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine][reply.outcome].object,
  })) ?? [];
  const body = index === 2 && withdrawn.length
    ? `${beat.body} 逐院问灯时，${withdrawn.map((row) => `${HEROINES[row.heroine].short}带走${row.object}`).join('、')}；这第三问必须承认她们的原物与拒绝仍在，不能统称“另外几院”。`
    : beat.body;
  return { ...beat, body, index, members: [...state.allianceMembers], assembly, withdrawn, previousText: previousChoice?.text ?? null };
}

export function currentAllianceNightResult(state) {
  if (state.phase !== 'alliance_night_result' || ![2, 3, 4].includes(state.allianceMembers.length) || !state.allianceChoices.length) return null;
  const index = state.allianceChoices.length - 1;
  const beat = ALLIANCE_NIGHT_BEATS[index];
  const choice = beat?.choices.find((row) => row.id === state.allianceChoices[index]);
  const response = choice ? ALLIANCE_CHOICE_RESPONSES[choice.id] : null;
  if (!beat || !choice || !response) return null;
  return {
    index, count:ALLIANCE_NIGHT_BEATS.length, beat:beat.id, choice, response,
    members:[...state.allianceMembers], final:index === ALLIANCE_NIGHT_BEATS.length - 1,
    bonds:combinations(state.allianceMembers, 2).map(([left, right]) => ({left,right,trust:bondValue(state,left,right)})),
    memberReasons:state.allianceMembers.map((heroine) => ({
      heroine,
      reasons:allianceNightMemberReasons(state, heroine, index, choice),
    })),
  };
}

export function recordedAllianceNightTableau(state) {
  if (!Array.isArray(state?.history)
    || !Array.isArray(state?.allianceMembers)
    || ![2, 3, 4].includes(state.allianceMembers.length)
    || !Array.isArray(state?.allianceChoices)
    || state.allianceChoices.length !== ALLIANCE_NIGHT_BEATS.length) return null;
  const rows = state.history.filter((entry) => entry.type === 'alliance_night');
  if (rows.length !== ALLIANCE_NIGHT_BEATS.length) return null;
  const key = state.allianceChoices.join('|');
  const combination = ALLIANCE_NIGHT_COMBINATIONS[key];
  if (!combination) return null;
  const beats = rows.map((row, index) => {
    const beat = ALLIANCE_NIGHT_BEATS[index];
    const choice = beat?.choices.find((candidate) => candidate.id === row.choice);
    const tableau = choice ? ALLIANCE_NIGHT_TABLEAUS[choice.id] : null;
    if (!beat
      || !choice
      || !tableau
      || row.beat !== beat.id
      || state.allianceChoices[index] !== choice.id
      || JSON.stringify(row.members) !== JSON.stringify(state.allianceMembers)
      || state.allianceMembers.some((heroine) => typeof tableau.actions[heroine] !== 'string')) return null;
    return {
      index,
      beat:beat.id,
      beatTitle:beat.title,
      choice:choice.id,
      choiceLabel:choice.label,
      title:tableau.title,
      body:tableau.body,
      transition:tableau.transition,
      actions:Object.fromEntries(state.allianceMembers.map((heroine) => [heroine, tableau.actions[heroine]])),
    };
  });
  if (beats.some((row) => !row)) return null;
  const assembly = recordedAllianceAssembly(state);
  if (!assembly || JSON.stringify(assembly.members) !== JSON.stringify(state.allianceMembers)) return null;
  const nonmembers = HEROINE_IDS.filter((heroine) => !state.allianceMembers.includes(heroine)).map((heroine) => {
    const reply = assembly.replies.find((row) => row.heroine === heroine) ?? null;
    const voice = reply ? ALLIANCE_ASSEMBLY_RESPONSES[heroine]?.[reply.outcome] ?? null : null;
    return reply?.outcome === 'withdraw' && voice
      ? {
        heroine, kind:'withdrawn', label:'本人撤回', object:voice.object,
        text:`逐院问灯时，她选择“${voice.title}”，带走${voice.object}；这幅群像不能把她补画回成员席。`,
      }
      : {
        heroine, kind:'outside', label:'未入候选', object:null,
        text:'她没有进入第十九夜有限互证候选；今夜不替她补签，也不取消她在宅中公共事务里的原有权利。',
      };
  });
  const names = state.allianceMembers.map((heroine) => HEROINES[heroine].short).join('、');
  return {
    key,
    choices:[...state.allianceChoices],
    members:[...state.allianceMembers],
    memberNames:names,
    size:state.allianceMembers.length,
    title:combination.title,
    lead:`${names}是逐院问灯后真实留下的成员。${combination.lead}`,
    endingText:`${names}${combination.endingText}`,
    nonmembers,
    beats,
  };
}

export function recordedAllianceNightMemberMemories(state) {
  const rows = Array.isArray(state?.history) ? state.history.filter((entry) => entry.type === 'alliance_night') : [];
  if (rows.length !== ALLIANCE_NIGHT_BEATS.length || ![2, 3, 4].includes(state?.allianceMembers?.length)) return [];
  if (rows.some((row) => JSON.stringify(row.members) !== JSON.stringify(state.allianceMembers))) return [];
  const choices = rows.map((row, index) => {
    const beat = ALLIANCE_NIGHT_BEATS[index];
    const choice = beat?.choices.find((candidate) => candidate.id === row.choice);
    return choice && row.beat === beat.id ? { beat, choice } : null;
  });
  if (choices.some((row) => !row)) return [];
  const tableau = recordedAllianceNightTableau(state);
  if (!tableau) return [];
  return state.allianceMembers.map((heroine) => ({
    heroine,
    choices:choices.map(({ beat, choice }, index) => ({
      beat:beat.id,
      beatTitle:beat.title,
      choice:choice.id,
      choiceLabel:choice.label,
      choiceText:choice.text,
      response:ALLIANCE_CHOICE_RESPONSES[choice.id].lines[heroine],
      tableauTitle:tableau.beats[index].title,
      tableauAction:tableau.beats[index].actions[heroine],
      tableauTransition:tableau.beats[index].transition,
      reasons:allianceNightMemberReasons(state, heroine, index, choice),
    })),
  }));
}

export function allianceNightOptions(state) {
  return allianceNightBeat(state)?.choices.map((choice) => ({ ...choice, disabled: false })) ?? [];
}

function changeAllianceBonds(state, delta) {
  for (const [left, right] of combinations(state.allianceMembers, 2)) changeBond(state, left, right, delta);
}

function changeAllianceRelations(state, delta, reason) {
  for (const heroine of state.allianceMembers) changeRel(state, heroine, delta, reason);
}

export function allianceNightStyle(state) {
  const horizontal = ['alliance_each_other', 'alliance_separate_doors', 'alliance_keep_limited']
    .filter((choice) => state.allianceChoices.includes(choice)).length;
  const centered = ['alliance_center_you', 'alliance_open_schedule', 'alliance_leave_open']
    .filter((choice) => state.allianceChoices.includes(choice)).length;
  return horizontal >= 2 ? '横向盟约' : centered >= 2 ? '明账共恋' : '有限共居';
}

export function chooseAllianceNight(state, choiceId) {
  const beat = allianceNightBeat(state);
  const choice = allianceNightOptions(state).find((row) => row.id === choiceId);
  if (!beat || !choice) return { ok: false, error: '这场联盟夜话已经接不到这句话。' };
  if (choiceId === 'alliance_each_other') {
    changeAllianceBonds(state, 6);
    changeAllianceRelations(state, { qing: 2, du: -4 }, '你先让她们彼此说明愿意承担与拒绝的部分');
    changeResources(state, { house: 4 });
  } else if (choiceId === 'alliance_center_you') {
    changeAllianceBonds(state, -2);
    changeAllianceRelations(state, { qing: 5, yu: 3, du: 1 }, '你没有说人人一样，而是逐一承认自己的偏爱');
    changeResources(state, { exposure: 2 });
  } else if (choiceId === 'alliance_separate_doors') {
    changeAllianceBonds(state, 4);
    changeAllianceRelations(state, { qing: 2, du: -3 }, '共同留下以后，她仍保有自己的钥匙与拒绝权');
    changeResources(state, { house: 4 });
  } else if (choiceId === 'alliance_open_schedule') {
    changeAllianceBonds(state, 1);
    changeAllianceRelations(state, { qing: 4, yu: 2, du: 2 }, '夜宿去处会公开，但偏爱不会被假装成平均');
    changeResources(state, { house: 2, exposure: 3 });
  } else if (choiceId === 'alliance_keep_limited') {
    changeAllianceBonds(state, 3);
    changeAllianceRelations(state, { qing: 2, du: -2 }, '这份同盟不替未加入的人决定去处与代价');
    for (const heroine of HEROINE_IDS.filter((id) => !state.allianceMembers.includes(id))) changeRel(state, heroine, { du: -2 }, '有限同盟没有把她的院门当成失败者的位置');
    changeResources(state, { house: 6 });
  } else {
    changeAllianceBonds(state, 2);
    changeAllianceRelations(state, { qing: 4, du: -1 }, '关系可以变化，但任何扩展都必须重新得到全员同意');
    for (const heroine of HEROINE_IDS.filter((id) => !state.allianceMembers.includes(id))) changeRel(state, heroine, { du: 2 }, '她知道这份邀请未来可能变化，却没有被预先替她答应');
    changeResources(state, { house: 2, exposure: 4 });
  }
  state.allianceChoices.push(choice.id);
  record(state, 'alliance_night', { beat: beat.id, choice: choice.id, members: [...state.allianceMembers] });
  state.log.push(choice.text);
  state.phase = 'alliance_night_result';
  return { ok: true, text: choice.text };
}

export function continueAllianceNightResult(state) {
  const result = currentAllianceNightResult(state);
  if (!result) return {ok:false,error:'这项联盟回答还没有让在场的人逐一接住。'};
  if (result.final) {
    state.selectedDayAction = null;
    unlockScene(state, 'inner_court_alliance');
    state.pendingScene = 'inner_court_alliance';
    state.sceneReturnPhase = 'after_alliance_night';
    state.sceneBeat = 0;
    state.phase = 'scene';
    return {ok:true,text:result.response.lead,scene:'inner_court_alliance'};
  } else state.phase = 'alliance_night';
  return {ok:true,text:result.response.lead,scene:null};
}

export function sharedNightStatus(state) {
  const missing = accordStatus(state).filter((row) => !row.complete);
  const jointComplete = jointActionCount(state);
  let reason = '';
  const coverage = jointParticipantCoverage(state);
  const preludeComplete = HEROINE_IDS.filter((id) => state.unlocked.includes(preludeSceneId(id))).length;
  const covenantComplete = HEROINE_IDS.filter((id) => routeStance(state, id).covenant >= COALITION_COVENANT_FLOOR).length;
  const coalitionPairs = JOINT_ACTIONS.map((choice) => ({
    choice,
    trust: bondValue(state, choice.participants[0], choice.participants[1]),
  }));
  const privatePrice = recordedFivePriceSettlement(state);
  if (privatePrice && privatePrice.coalition.kind !== 'full') reason = privatePrice.coalition.kind === 'limited'
    ? `第十九夜只有${privatePrice.coalition.members.map((id) => HEROINES[id].short).join('、')}成为有限互证候选；尚未逐院答应同席，更不能改称五院圆满。`
    : '第十九夜没有形成共同授权；所保的权利底线不能替代五院同盟。';
  else if (!publicPromisesReady(state)) reason = '三场公开问责还没都给出五人可以一同承担的口径。';
  else if (missing.length) reason = `还缺：${missing.map((row) => row.label).join('、')}。`;
  else if (jointComplete < JOINT_ACTION_TARGET) {
    reason = `还要让不同院门合办五桩事（${jointComplete}/${JOINT_ACTION_TARGET}）。`;
  }
  else if (HEROINE_IDS.some((id) => !coverage.has(id))) reason = '五个人还没都在合办事上出过力。';
  else if (state.resolvedPressures.length < PRESSURE_TARGET) reason = `二十日里真正收住的危局还不够（${state.resolvedPressures.length}/${PRESSURE_TARGET}）。同灯不能只靠关系数值。`;
  else if (preludeComplete < HEROINE_IDS.length) reason = `还有${HEROINE_IDS.length - preludeComplete}个人从未亲手邀请你走近。共同余夜不能跳过个人关系。`;
  else if (covenantComplete < HEROINE_IDS.length) reason = `还有${HEROINE_IDS.length - covenantComplete}个人只听过私房话，没有见过你至少两次共同承担。`;
  else if (coalitionPairs.some((row) => row.trust < COALITION_BOND_FLOOR)) {
    const row = coalitionPairs.find((item) => item.trust < COALITION_BOND_FLOOR);
    reason = `${row.choice.participants.map((id) => HEROINES[id].short).join('与')}仍彼此提防；后宫不是把五条个人线硬绑在一起。`;
  }
  else {
    const missingProof = coalitionProofStatus(state).find((row) => !row.complete);
    if (missingProof) reason = `${HEROINES[missingProof.heroine].short}还没拿亲手经历过的事来替这份共约作证。`;
  }
  if (!reason) {
    const low = HEROINE_IDS.find((id) => state.relations[id].qing < 30);
    const angry = HEROINE_IDS.find((id) => state.relations[id].du >= 70);
    if (low) reason = `${HEROINES[low].short}还没肯把这件事当成五个人的事。`;
    else if (angry) reason = `${HEROINES[angry].short}的火还没压下去。`;
    else if (state.resources.house < 45) reason = '宅门还没稳住，五个人谁也不肯替你收外账。';
  }
  return {
    visible: state.day === MAX_DAY && state.phase === 'choose_visit',
    ready: !reason,
    reason,
    complete: ACCORD_KEYS.filter((key) => state.accords?.[key]).length,
    total: ACCORD_KEYS.length,
    jointComplete: Math.min(jointComplete, JOINT_ACTION_TARGET),
    jointTotal: JOINT_ACTION_TARGET,
    proofComplete: coalitionProofStatus(state).filter((row) => row.complete).length,
    proofTotal: Object.keys(COALITION_PROOF_META).length,
    pressureComplete: Math.min(state.resolvedPressures.length, PRESSURE_TARGET),
    pressureTotal: PRESSURE_TARGET,
    preludeComplete,
    preludeTotal: HEROINE_IDS.length,
    covenantComplete,
    covenantTotal: HEROINE_IDS.length,
    networkComplete: coalitionPairs.filter((row) => row.trust >= COALITION_BOND_FLOOR).length,
    networkTotal: coalitionPairs.length,
  };
}

export function startSharedNight(state) {
  if (state.phase !== 'choose_visit' || state.day !== MAX_DAY) {
    return { ok: false, error: '还没到请五人同席的时候。' };
  }
  const status = sharedNightStatus(state);
  if (!status.ready) return { ok: false, error: status.reason || '五个人今夜还坐不到同一张桌上。' };
  state.currentHeroine = null;
  state.phase = 'shared_night';
  record(state, 'shared_night_start', { accordCount: accordStatus(state).filter((row) => row.complete).length });
  return { ok: true };
}

export function sharedNightOptions(state) {
  if (state.phase !== 'shared_night') return [];
  const status = sharedNightStatus({ ...state, phase: 'choose_visit' });
  return SHARED_NIGHT_CHOICES.map((choice) => {
    const cost = choiceSilverCost(choice);
    return {
      ...choice,
      disabled: choice.id === COALITION_CHOICE_ID ? !status.ready : cost > state.resources.silver,
      locked: choice.id === COALITION_CHOICE_ID && !status.ready
        ? status.reason
        : cost > state.resources.silver
          ? `手里凑不出${silverText(cost)}两。`
          : '',
    };
  });
}

export function chooseSharedNight(state, choiceId) {
  if (state.phase !== 'shared_night') return { ok: false, error: '五个人还没坐到同一张桌上。' };
  const choice = sharedNightOptions(state).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个同席选择。' };
  if (choice.disabled) return { ok: false, error: choice.locked };
  applyEffects(state, choice.effects, null, `五人同席：${choice.label}`);
  state.sharedNightChoice = choiceId;
  record(state, 'shared_night', { choice: choiceId, public: true });
  state.log.push(choice.text);
  if (choiceId === COALITION_CHOICE_ID) {
    unlockScene(state, 'inner_court_accord');
    state.pendingScene = 'inner_court_accord';
    state.sceneReturnPhase = 'after_shared_work';
    state.sceneBeat = 0;
    state.phase = 'scene';
    return { ok: true, text: choice.text, scene: 'inner_court_accord' };
  }
  beginCollapseFinale(state, choiceId, 'shared');
  return { ok: true, text: choice.text, scene: null };
}

function sharedFinaleJointReason(state, heroineId) {
  const history = Array.isArray(state?.history) ? state.history : [];
  const row = [...history].reverse().find((entry) => entry.type === 'joint_action' && entry.participants?.includes(heroineId));
  const joint = row ? JOINT_ACTIONS.find((candidate) => candidate.id === row.action && candidate.participants.includes(heroineId)) : null;
  if (!row || !joint) return `${HEROINES[heroineId].short}此前没有一桩可核的具名联院差事；五院共守不能从群像气氛补写她做过的贡献。`;
  const partner = joint.participants.find((id) => id !== heroineId);
  return `第${row.day}日，她与${HEROINES[partner].short}共同办完“${joint.label}”（${joint.hint}）：${joint.text}${row.resolved ? '当日危局也确实被收住。' : '这桩合作没有被夸成自动收住全部危局。'}今夜念名或准她停手，都必须从这桩具名实事出发。`;
}

function sharedFinaleBoundaryReason(history, heroineId) {
  const basis = personalFinaleDepartureBasis(Array.isArray(history) ? history : []);
  const accord = ACCORD_CHOICES[heroineId];
  const accordRow = [...basis.history].reverse().find((entry) => (
    entry.type === 'accord_term'
    && entry.heroine === heroineId
    && entry.term === accord.effects.accord
    && entry.choice === accord.id
  )) ?? null;
  const boundary = PERSONAL_FINALE_BOUNDARY_OBJECTS[heroineId];
  const breakStatus = fivePriceBreakStatus(basis, heroineId);
  const accordText = accordRow
    ? `第${accordRow.day}日她亲手落下“${accord.label}”（${accord.hint}）：${accord.text}`
    : `${HEROINES[heroineId].short}从未亲手落下“${accord.label}”（${accord.hint}）这项院约。`;
  if (!breakStatus.entry) return `${accordText}五院共守只把这条旧约带到同一张桌上，不把她的${boundary}并进一份多数同意。`;
  const breakEntry = breakStatus.entry;
  let breakText = `第${breakEntry.day}日宅门跌到${breakEntry.house}，五院同时关门，她的${boundary}失去共同执行条件`;
  if (breakEntry.heroine === heroineId) {
    const source = breakStatus.source?.entry ? routeChoiceById(heroineId, breakStatus.source.entry.choice) : null;
    breakText = source
      ? `第${breakEntry.day}日“${source.label}”（${source.hint}）真实越过了她的${boundary}：${source.text}`
      : `第${breakEntry.day}日，她的${boundary}累计被公开越过${breakEntry.overrides ?? basis.overrides[heroineId]}次`;
  }
  if (breakStatus.unresolved) return `${breakText}；此后没有由她本人具名修回。共守与亲近都不能替这项未结失信消失。`;
  const repair = personalFinaleBoundaryRepairReason(breakStatus.repair?.entry, heroineId);
  return `${breakText}；${repair || `第${breakStatus.repair?.entry?.day}日她本人具名修回这条边界`}。修回让她重新参与五人核约，却没有把自己的${boundary}交给整桌代管。`;
}

function sharedFinaleIntimacyReason(history, heroineId, choice) {
  const arrangements = personalFinaleArrangementsFromHistory(Array.isArray(history) ? history : [], heroineId);
  if (!arrangements.length) return `${HEROINES[heroineId].short}此前没有一项已经完成的亲密后约；“${choice.label}”只能处理她此刻亲口说出的继续、停下与光线，不能倒造旧同意。`;
  const clauses = arrangements.map((row) => `第${row.day}夜“${row.label}”（${row.hint}）落成“${row.title}”`).join('；');
  return `她仍执行${arrangements.length}项亲密后约：${clauses}。今夜选择“${choice.label}”（${choice.hint}）时，这些约定须逐项保留；共同靠近不能吞掉本人撤回、私物、休息或劳动边界。`;
}

function sharedFinaleRouteReason(history, heroineId) {
  const rows = (Array.isArray(history) ? history : []).flatMap((entry) => {
    if (entry.type !== 'visit_choice' || entry.heroine !== heroineId) return [];
    const choice = routeChoiceById(heroineId, entry.choice);
    const lane = routeChoiceLane(heroineId, entry.choice);
    return choice && lane ? [{ day:entry.day, choice, lane }] : [];
  });
  if (!rows.length) return `${HEROINES[heroineId].short}此前没有一项可核的人物路线选择；重读五约或并肩等天亮都不能从好感数值补出她的长期相处方式。`;
  const covenant = rows.filter((row) => row.lane === 'covenant');
  const privateRows = rows.filter((row) => row.lane === 'private');
  const latest = rows.at(-1);
  return `她在二十日里留下共同承担${covenant.length}次、本人私门${privateRows.length}次；最近一项真实选择是第${latest.day}日“${latest.choice.label}”（${latest.choice.hint}）：${latest.choice.text}五院共守只能继续核验这段具体来往，不能用终夜风格覆盖它。`;
}

function sharedAfterglowChoiceReason(choice, heroineId, beatIndex) {
  const scope = beatIndex === 0
    ? '她已经具名完成的贡献与今晚是否继续承担劳动'
    : beatIndex === 1
      ? '她此刻可收回的靠近、光线、钥匙与拒绝'
      : '她自己的院约、休息和下一次重新确认';
  return `${HEROINES[heroineId].short}这一拍实际回应的是“${choice.label}”（${choice.hint}）：${choice.text}这项安排只处理${scope}，不会因为五个人同在便把一句回答复制成五份授权。`;
}

export function sharedAfterglowMemberReasons(state, heroineId, beatIndex, selectedChoice) {
  if (!Array.isArray(state?.history)
    || !HEROINE_IDS.includes(heroineId)
    || !Number.isInteger(beatIndex)
    || beatIndex < 0
    || beatIndex >= SHARED_AFTERGLOW_BEATS.length) return [];
  const choice = SHARED_AFTERGLOW_BEATS[beatIndex].choices.find((row) => row.id === selectedChoice?.id);
  if (!choice) return [];
  const choiceReason = sharedAfterglowChoiceReason(choice, heroineId, beatIndex);
  if (beatIndex === 0) return [sharedFinaleJointReason(state, heroineId), choiceReason];
  if (beatIndex === 1) return [
    sharedFinaleBoundaryReason(state.history, heroineId),
    sharedFinaleIntimacyReason(state.history, heroineId, choice),
    choiceReason,
  ];
  return [
    sharedFinaleBoundaryReason(state.history, heroineId),
    sharedFinaleRouteReason(state.history, heroineId),
    choiceReason,
  ];
}

function recordedSharedAfterglowChoices(state) {
  if (!Array.isArray(state?.history)
    || !Array.isArray(state?.sharedAfterglowChoices)
    || state.sharedAfterglowChoices.length !== SHARED_AFTERGLOW_BEATS.length) return [];
  const rows = state.history.filter((entry) => entry.type === 'shared_afterglow');
  if (rows.length !== SHARED_AFTERGLOW_BEATS.length) return [];
  return rows.map((row, index) => {
    const beat = SHARED_AFTERGLOW_BEATS[index];
    const choice = beat?.choices.find((candidate) => candidate.id === row.choice);
    return choice && row.beat === beat.id && state.sharedAfterglowChoices[index] === choice.id ? { beat, choice } : null;
  }).filter(Boolean);
}

export function recordedSharedAfterglowTableau(state) {
  const rows = recordedSharedAfterglowChoices(state);
  if (rows.length !== SHARED_AFTERGLOW_BEATS.length) return null;
  const choices = rows.map((row) => row.choice.id);
  const key = choices.join('|');
  const combination = SHARED_AFTERGLOW_COMBINATIONS[key];
  if (!combination) return null;
  const beats = rows.map(({ beat, choice }, index) => {
    const tableau = SHARED_AFTERGLOW_TABLEAUS[choice.id];
    if (!tableau || !HEROINE_IDS.every((heroine) => tableau.actions?.[heroine])) return null;
    return {
      index,
      beat:beat.id,
      beatTitle:beat.title,
      choice:choice.id,
      choiceLabel:choice.label,
      title:tableau.title,
      body:tableau.body,
      transition:tableau.transition,
      actions:Object.fromEntries(HEROINE_IDS.map((heroine) => [heroine, tableau.actions[heroine]])),
    };
  });
  if (!beats.every(Boolean)) return null;
  return { key, choices, title:combination.title, lead:combination.lead, endingText:combination.endingText, beats };
}

export function sharedDawnMemberReasons(state, heroineId, selectedChoice) {
  if (!Array.isArray(state?.history) || !HEROINE_IDS.includes(heroineId)) return [];
  const choice = SHARED_DAWN_CHOICES.find((row) => row.id === selectedChoice?.id);
  const afterglow = recordedSharedAfterglowChoices(state);
  if (!choice || afterglow.length !== SHARED_AFTERGLOW_BEATS.length) return [];
  const prior = afterglow.map(({ beat, choice:afterglowChoice }) => {
    const response = SHARED_AFTERGLOW_RESPONSES[afterglowChoice.id].lines[heroineId];
    return `“${beat.title}／${afterglowChoice.label}”由她本人回答：${response}`;
  }).join('；');
  const response = SHARED_DAWN_RESPONSES[choice.id];
  return [
    `昨夜三拍没有在天亮时合并成一个相处风格：${prior}。这三句真实回答共同限制次晨安排。`,
    sharedFinaleBoundaryReason(state.history, heroineId),
    `${HEROINES[heroineId].short}次晨选择进入“${choice.label}”（${choice.hint}）：${choice.text}她本人这样确认：${response.lines[heroineId]}往后实际执行的是：${response.future}`,
  ];
}

export function sharedAfterglowBeat(state) {
  if (state.phase !== 'shared_afterglow') return null;
  return SHARED_AFTERGLOW_BEATS[state.sharedAfterglowChoices.length] ?? null;
}

export function currentSharedAfterglowResult(state) {
  if (state.phase !== 'shared_afterglow_result' || !state.sharedAfterglowChoices.length) return null;
  const index = state.sharedAfterglowChoices.length - 1;
  const beat = SHARED_AFTERGLOW_BEATS[index];
  const choice = beat?.choices.find((row) => row.id === state.sharedAfterglowChoices[index]);
  const response = choice ? SHARED_AFTERGLOW_RESPONSES[choice.id] : null;
  if (!beat || !choice || !response) return null;
  return {
    index, count:SHARED_AFTERGLOW_BEATS.length, beat:beat.id, choice, response,
    members:[...HEROINE_IDS], final:index === SHARED_AFTERGLOW_BEATS.length - 1,
    memberReasons:HEROINE_IDS.map((heroine) => ({
      heroine,
      reasons:sharedAfterglowMemberReasons(state, heroine, index, choice),
    })),
  };
}

export function sharedAfterglowOptions(state) {
  return sharedAfterglowBeat(state)?.choices.map((choice) => ({
    ...choice,
    disabled: cannotAfford(state, choice),
    locked: cannotAfford(state, choice) ? costLockedText(choice) : '',
  })) ?? [];
}

export function chooseSharedAfterglow(state, choiceId) {
  if (state.phase !== 'shared_afterglow') return { ok: false, error: '外账还没办完，灯下的话接不上。' };
  const beat = sharedAfterglowBeat(state);
  const choice = sharedAfterglowOptions(state).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '眼下没有这句话。' };
  if (choice.disabled) return { ok: false, error: choice.locked };
  applyEffects(state, choice.effects, null, `余夜：${choice.label}`);
  state.sharedAfterglowChoices.push(choice.id);
  record(state, 'shared_afterglow', { beat: beat.id, choice: choice.id });
  state.log.push(choice.text);
  state.phase = 'shared_afterglow_result';
  return { ok: true, text: choice.text };
}

export function continueSharedAfterglowResult(state) {
  const result = currentSharedAfterglowResult(state);
  if (!result) return {ok:false,error:'这项余夜安排还没有听完五个人的回应。'};
  if (result.final) {
    unlockScene(state, 'inner_court_afterglow');
    state.pendingScene = 'inner_court_afterglow';
    state.sceneReturnPhase = 'after_shared_afterglow';
    state.sceneBeat = 0;
    state.phase = 'scene';
    return {ok:true,text:result.response.lead,scene:'inner_court_afterglow'};
  }
  state.phase = 'shared_afterglow';
  return {ok:true,text:result.response.lead,scene:null};
}

export function sharedDawnOptions(state) {
  return state.phase === 'shared_dawn' ? SHARED_DAWN_CHOICES.map((choice) => ({
    ...choice,
    disabled: cannotAfford(state, choice),
    locked: cannotAfford(state, choice) ? costLockedText(choice) : '',
  })) : [];
}

export function chooseSharedDawn(state, choiceId) {
  if (state.phase !== 'shared_dawn') return { ok: false, error: '天还没亮到这一步。' };
  const choice = sharedDawnOptions(state).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个次晨选择。' };
  if (choice.disabled) return { ok: false, error: choice.locked };
  applyEffects(state, choice.effects, null, `次晨：${choice.label}`);
  state.sharedDawnChoice = choice.id;
  record(state, 'shared_dawn', { choice: choice.id });
  state.log.push(choice.text);
  state.phase = 'shared_dawn_result';
  return { ok: true, text: choice.text };
}

export function currentSharedDawnResult(state) {
  if (state.phase !== 'shared_dawn_result' || !SHARED_DAWN_CHOICE_IDS.has(state.sharedDawnChoice)) return null;
  const choice = SHARED_DAWN_CHOICES.find((row) => row.id === state.sharedDawnChoice);
  const response = SHARED_DAWN_RESPONSES[state.sharedDawnChoice];
  if (!choice || !response) return null;
  return {
    choice, response, members:[...HEROINE_IDS],
    memberReasons:HEROINE_IDS.map((heroine) => ({
      heroine,
      reasons:sharedDawnMemberReasons(state, heroine, choice),
    })),
  };
}

export function recordedSharedFinaleHeroineMemories(state) {
  const afterglow = recordedSharedAfterglowChoices(state);
  const dawnRow = Array.isArray(state?.history)
    ? state.history.find((entry) => entry.type === 'shared_dawn' && entry.choice === state.sharedDawnChoice)
    : null;
  const dawnChoice = dawnRow ? SHARED_DAWN_CHOICES.find((choice) => choice.id === dawnRow.choice) : null;
  const dawnResponse = dawnChoice ? SHARED_DAWN_RESPONSES[dawnChoice.id] : null;
  if (afterglow.length !== SHARED_AFTERGLOW_BEATS.length || !dawnChoice || !dawnResponse) return [];
  return HEROINE_IDS.map((heroine) => ({
    heroine,
    afterglow:afterglow.map(({ beat, choice }, index) => ({
      beat:beat.id,
      beatTitle:beat.title,
      choice:choice.id,
      choiceLabel:choice.label,
      choiceText:choice.text,
      response:SHARED_AFTERGLOW_RESPONSES[choice.id].lines[heroine],
      reasons:sharedAfterglowMemberReasons(state, heroine, index, choice),
    })),
    dawn:{
      beat:'shared_dawn',
      beatTitle:'次晨见光',
      choice:dawnChoice.id,
      choiceLabel:dawnChoice.label,
      choiceText:dawnChoice.text,
      response:dawnResponse.lines[heroine],
      future:dawnResponse.future,
      reasons:sharedDawnMemberReasons(state, heroine, dawnChoice),
    },
  }));
}

export function continueSharedDawnResult(state) {
  const result = currentSharedDawnResult(state);
  if (!result) return { ok: false, error: '五个人还没有把昨夜怎样进入白日说完。' };
  finishSharedNight(state);
  return { ok: true, text: result.response.future };
}

function collapseChoiceById(cause, choiceId) {
  return COLLAPSE_FINALES[cause]?.choices.find((choice) => choice.id === choiceId) ?? null;
}

function collapseFinaleLatestHeroineFact(state, heroineId) {
  const history = Array.isArray(state?.history) ? state.history : [];
  const relationship = personalFinaleRelationshipMemory(history, heroineId);
  const arrangement = latestIntimacyArrangement(state, heroineId);
  const rivalry = latestRivalryMorningMemory(state, heroineId);
  const settlement = recordedMorningSettlements(state).filter((row) => row.heroine === heroineId).at(-1) ?? null;
  const latestVisitEntry = [...history].reverse().find((entry) => entry.type === 'visit_choice' && entry.heroine === heroineId);
  const latestVisitChoice = latestVisitEntry ? routeChoiceById(heroineId, latestVisitEntry.choice) : null;
  const settlementHistoryIndex = settlement
    ? lastHistoryIndex(state, (entry) => (
      (entry.type === 'morning_settlement'
        && entry.day === settlement.day
        && entry.cause === settlement.cause
        && entry.heroine === heroineId)
      || (entry.type === 'morning_settlement_restore'
        && entry.settlementDay === settlement.day
        && entry.cause === settlement.cause
        && entry.heroine === heroineId)
    ))
    : -1;
  const candidates = [
    relationship,
    arrangement ? {
      kind:'intimacy', day:arrangement.day, label:`亲密后约 · ${arrangement.label}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'personal_afterglow_aftermath' && entry.heroine === heroineId && entry.choice === arrangement.id),
      text:`第${arrangement.day}夜，她亲手以“${arrangement.label}”落下“${arrangement.title}”：${arrangement.outcome}次晨真正执行的是：${arrangement.morning}后来继续这样生活：${arrangement.future}`,
    } : null,
    rivalry ? {
      kind:'rivalry', day:rivalry.day, label:`偏宠对峙 · ${rivalry.title}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'morning' && entry.event === 'rivalry' && entry.day === rivalry.day && entry.actor === rivalry.actor && entry.visited === rivalry.visited && entry.choice === rivalry.choice),
      text:`第${rivalry.day}日，她${rivalry.role === 'challenger' ? `以“${rivalry.title}”当面追问${rivalry.otherName}：“${rivalry.opening}”` : `在${rivalry.otherName}以“${rivalry.title}”追问偏宠时亲口回答：“${rivalry.visitedReply}”`}你最后以“${rivalry.choiceLabel}”落定，真实结果是：${rivalry.outcome}`,
    } : null,
    settlement ? {
      kind:'morning_settlement', day:settlement.day, label:`晨簿落名 · ${settlement.title}`,
      historyIndex:settlementHistoryIndex,
      text:settlement.restored
        ? `第${settlement.day}日，她亲手收回${settlement.object}并落下“${settlement.title}”；后来真正完成的修复是：${settlement.restoration}`
        : `第${settlement.day}日，她亲手收回${settlement.object}并落下“${settlement.title}”；到第二十夜，“${settlement.restrictionLabel}”仍未由“${settlement.recoveryLabel}”具名补回。`,
    } : null,
    latestVisitEntry && latestVisitChoice ? {
      kind:'route_choice', day:latestVisitEntry.day, label:`人物路线 · ${latestVisitChoice.label}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry === latestVisitEntry),
      text:`第${latestVisitEntry.day}日，她在本人路线中亲手接住“${latestVisitChoice.label}”：${latestVisitChoice.text}这项真实选择没有因为关系未成圆满便从账上消失。`,
    } : null,
  ].filter((row) => row && row.historyIndex >= 0);
  if (!candidates.length) {
    return {
      kind:'absence', day:null, label:'没有可核的本人旧事',
      text:'二十日里没有一项属于她的完整路线、关系章节或具名权利裁决可以引用；破局不能从好感、妒意或结局位置替这处空白编造旧账。',
    };
  }
  const latest = candidates.reduce((current, row) => row.historyIndex > current.historyIndex ? row : current);
  const { historyIndex, ...fact } = latest;
  return fact;
}

export function collapseFinaleHeroineMemory(state, heroineId) {
  if (!HEROINE_IDS.includes(heroineId) || !state?.collapseFinale?.choice) return null;
  const choice = collapseChoiceById(state.collapseFinale.cause, state.collapseFinale.choice);
  if (!choice) return null;
  const fact = collapseFinaleLatestHeroineFact(state, heroineId);
  return {
    heroine:heroineId,
    choice:choice.id,
    choiceLabel:choice.label,
    choiceHint:choice.hint,
    ...fact,
    conclusion:`她不会因“${choice.label}”回到原位；这项最后取舍只承诺${choice.hint}，并且必须先对这件已经发生的旧事负责。`,
  };
}

function collapseStoryBeats(state) {
  const finale = COLLAPSE_FINALES[state.collapseFinale?.cause];
  if (!finale) return [];
  if (state.collapseFinale.cause === 'intrigue' || state.collapseFinale.cause === 'unstable') {
    const variant = finale.variants?.[state.collapseFinale.endingDetail];
    return variant ? [variant, ...finale.beats] : [];
  }
  return [...finale.beats];
}

function beginCollapseFinale(state, cause, source, candidate = null) {
  const finale = COLLAPSE_FINALES[cause];
  if (!finale || !['shared', 'visit'].includes(source)) return false;
  const base = candidate ?? determineEnding(state);
  const endingId = source === 'shared'
    ? cause === 'shared_buy_quiet' ? 'intrigue' : 'unstable'
    : base.id;
  if (!['intrigue', 'unstable'].includes(endingId)) return false;
  const endingDetail = endingId === 'intrigue'
    ? base.intrigueCost ?? (state.resources.exposure >= EXPOSURE_LEDGERED ? 'burned' : state.resources.exposure >= EXPOSURE_STREET ? 'watched' : 'clean')
    : cause === 'shared_false_only' ? 'broke_word' : base.missedBy ?? 'spread_thin';
  state.currentHeroine = null;
  state.selectedDayAction = null;
  state.collapseFinale = { cause, source, endingId, endingDetail, beat: 0, choice: null };
  state.phase = 'collapse_finale';
  record(state, 'collapse_finale_start', { cause, source, endingId, endingDetail });
  state.log.push(`${finale.title}。这局还要亲手结最后一笔。`);
  return true;
}

export function currentCollapseFinale(state) {
  if (state.phase !== 'collapse_finale' || !state.collapseFinale) return null;
  const finale = COLLAPSE_FINALES[state.collapseFinale.cause];
  const beats = collapseStoryBeats(state);
  if (!finale || beats.length !== 3) return null;
  const beat = state.collapseFinale.beat;
  return {
    ...state.collapseFinale,
    kicker: finale.kicker,
    title: finale.title,
    count: beats.length + 1,
    current: beat < beats.length ? beats[beat] : null,
    awaitingChoice: beat === beats.length,
  };
}

export function advanceCollapseFinale(state) {
  const story = currentCollapseFinale(state);
  if (!story || story.awaitingChoice) return { ok: false, error: '这场清算已经走到最后一问。' };
  state.collapseFinale.beat += 1;
  return { ok: true, text: story.current.text };
}

export function collapseFinaleOptions(state) {
  const story = currentCollapseFinale(state);
  if (!story?.awaitingChoice) return [];
  return COLLAPSE_FINALES[story.cause].choices.map((choice) => ({ ...choice, disabled: false, locked: '' }));
}

export function chooseCollapseFinale(state, choiceId) {
  const story = currentCollapseFinale(state);
  const choice = collapseFinaleOptions(state).find((row) => row.id === choiceId);
  if (!story?.awaitingChoice || !choice) return { ok: false, error: '最后这笔还没有走到可以落字的时候。' };
  state.collapseFinale.choice = choice.id;
  record(state, 'collapse_finale', {
    cause: story.cause, source: story.source, endingId: story.endingId,
    endingDetail: story.endingDetail, choice: choice.id,
  });
  state.log.push(choice.text);
  state.collapseFinale.beat = 0;
  state.phase = 'collapse_finale_result';
  return { ok: true, text: choice.text };
}

export function currentCollapseFinaleResult(state) {
  if (state.phase !== 'collapse_finale_result' || !state.collapseFinale?.choice) return null;
  const choice = collapseChoiceById(state.collapseFinale.cause, state.collapseFinale.choice);
  const index = state.collapseFinale.beat;
  if (!choice || !Number.isInteger(index) || !inRange(index, 0, HEROINE_IDS.length - 1)) return null;
  const members = [...HEROINE_IDS];
  const memories = members.map((heroine) => collapseFinaleHeroineMemory(state, heroine));
  const heroine = members[index];
  return {
    ...state.collapseFinale,
    index,
    count:members.length,
    choice,
    response:choice.result,
    members,
    heroine,
    line:choice.result.lines[heroine],
    memory:memories[index],
    previous:members.slice(0, index).map((id, previousIndex) => ({
      heroine:id,
      line:choice.result.lines[id],
      memory:memories[previousIndex],
    })),
    memories,
  };
}

export function continueCollapseFinaleResult(state) {
  const result = currentCollapseFinaleResult(state);
  if (!result) return { ok: false, error: '五个人还没有把这项选择分别说完。' };
  if (result.index + 1 < result.count) {
    state.collapseFinale.beat += 1;
    return { ok: true, text: result.line };
  }
  finishSharedNight(state);
  return { ok: true, text: result.response.lead };
}

function finishSharedNight(state) {
  state.selectedDayAction = null;
  state.ending = determineEnding(state);
  state.phase = 'ending';
  state.over = true;
}

// 个人弧线的拍号 = 你第几次进她的门(结算成功才计次)。
// 取代旧的 state.day - 1:按日历天索引会让轮换玩家撞上「好选项被锁、只能选伤害项」。
function routeStep(state, heroineId) {
  return state.visits?.[heroineId] ?? 0;
}

export function routeComplete(state, heroineId) {
  const routeDone = routeStep(state, heroineId) >= (ROUTE_CHOICES[heroineId]?.length ?? 0);
  const accord = ACCORD_CHOICES[heroineId];
  return routeDone && (!accord || !!state.accords?.[accord.effects.accord]);
}

export function visitChoices(state, heroineId) {
  const rows = routeRowsFor(heroineId, routeStep(state, heroineId), state.routeStances?.[heroineId]);
  const accord = ACCORD_CHOICES[heroineId];
  const choices = accord && !state.accords?.[accord.effects.accord] ? [...rows, accord] : rows;
  return choices.map((choice) => {
    const conditionLocked = !!choice.condition && !hasToken(state, choice.condition);
    const unaffordable = cannotAfford(state, choice);
    const lane = routeChoiceLane(heroineId, choice.id);
    const stance = routeStance(state, heroineId);
    const direction = lane && stance.covenant !== stance.private
      ? lane === (stance.covenant > stance.private ? 'covenant' : 'private') ? '顺着她已经相信的路' : '会把关系转向另一边'
      : '这一步会定下新的倾向';
    return {
      ...choice,
      meta: choice.effects?.accord
        ? '这是她留下的院约'
        : lane === 'covenant'
          ? `共同承担 · 会抬高她与盟友的互信 · ${direction}`
          : `私下情分 · 情欲更快，另外四院更难互信 · ${direction}`,
      disabled: conditionLocked || unaffordable,
      locked: conditionLocked ? choice.locked : unaffordable ? costLockedText(choice) : '',
    };
  });
}

function milestoneFor(heroine, stepIndex, lane) {
  return lane === 'accord' ? null : ROUTE_MILESTONES[heroine]?.[stepIndex] ?? null;
}

function routeChoiceStepIndex(heroine, choiceId) {
  for (let index = 0; index < (ROUTE_CHOICES[heroine]?.length ?? 0); index += 1) {
    const base = ROUTE_CHOICES[heroine]?.[index] ?? [];
    const branches = Object.values(ROUTE_BRANCHES[heroine]?.[index] ?? {}).flat();
    if ([...base, ...branches].some((choice) => choice.id === choiceId)) return index;
  }
  return null;
}

function routeAftermathContext(heroine, actIndex, stepIndex, lane) {
  const milestone = milestoneFor(heroine, stepIndex, lane);
  const template = milestone ?? ROUTE_AFTERMATHS[heroine]?.[actIndex] ?? null;
  const observer = milestone?.observer
    ?? AFTERMATH_OBSERVERS[heroine]?.[actIndex]
    ?? HEROINE_IDS.find((id) => id !== heroine);
  return { template, observer, milestone: !!milestone };
}

function routeAftermathState(state, heroine, sourceChoice, lane, stepIndex) {
  const actIndex = Math.min(3, Math.ceil(state.day / 5) - 1);
  const context = routeAftermathContext(heroine, actIndex, stepIndex, lane);
  return {
    event: context.template?.id ?? null,
    heroine,
    observer: context.observer,
    lane: lane ?? 'accord',
    act: actIndex + 1,
    step: stepIndex,
    beat: 0,
    sourceChoice,
    resolution: null,
  };
}

function fillAftermathText(text, aftermath, source) {
  return String(text ?? '')
    .replaceAll('{observer}', HEROINES[aftermath.observer]?.short ?? '另一院')
    .replaceAll('{heroine}', HEROINES[aftermath.heroine]?.short ?? '她')
    .replaceAll('{choice}', source?.label ?? '刚才那句话');
}

const ROUTE_CHOICE_ECHOES = Object.freeze({
  wu_yueniang: Object.freeze({
    accord: '月娘把院约压在公账下面，没有让它变成一句只在门内好听的话。',
    covenant: '月娘把这一步的经手、代价与谁能追问一并写到页边，等它真正落进明日的账。',
    private: '月娘收下了这句只向她说的偏意，却没有替它免去旁院会追来的疑问。',
  }),
  pan_jinlian: Object.freeze({
    accord: '金莲叫你把原话照字再念一遍，先确认明日没有人能替你改成另一种意思。',
    covenant: '金莲没有只听这句话顺不顺耳，她先问它出了门以后还敢不敢保持原样。',
    private: '金莲承认这句偏爱让她高兴，也立刻问你准备怎样面对另外四扇门的猜测。',
  }),
  li_pinger: Object.freeze({
    accord: '瓶儿把归期、钥匙与可拒绝的范围逐项核过，才让这句话算进彼此的安全。',
    covenant: '瓶儿先确认共同使用没有偷偷变成共同占有，随后才把这一步写进可查的货单。',
    private: '瓶儿把这份只给她的安全握在手里，也提醒你退路与亲近不能互相冒充。',
  }),
  meng_yulou: Object.freeze({
    accord: '玉楼先写清谁借了名、谁得了利、谁能拒绝，才肯把这份体面当作约定收下。',
    covenant: '玉楼没有替这一步润色，她把经手与回礼原样留名，让别人也能看见是谁撑住了场面。',
    private: '玉楼让这份偏爱暂时不欠回礼，却问你天亮后是否仍肯让她不替任何人圆场。',
  }),
  sun_xuee: Object.freeze({
    accord: '雪娥把这句话换算成明日谁做、谁歇、谁领工钱，能落到工簿上才肯作数。',
    covenant: '雪娥先把做事人的名字补齐，再看你选的这一步是否真能减掉一份无名劳动。',
    private: '雪娥没有拿亲近抵工钱，也没有拿工钱抵亲近；她要你分清今晚留下究竟为了哪一件事。',
  }),
});

function routeChoiceEcho(source, aftermath) {
  const lane = ROUTE_CHOICE_ECHOES[aftermath.heroine]?.[aftermath.lane]
    ?? ROUTE_CHOICE_ECHOES[aftermath.heroine]?.covenant
    ?? '';
  return `${source?.text ?? ''} ${lane}`.trim();
}

function lastHistoryIndex(state, predicate) {
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    if (predicate(state.history[index])) return index;
  }
  return -1;
}

function routeContinuityMemory(state, heroine, memories) {
  const { arrangement, nightMemory, conversationMemory, invitationMemory, rivalryMemory, pairMemory } = memories;
  const candidates = [
    arrangement ? {
      kind:'intimacy', day:arrangement.day, label:'亲密之后的具名约定',
      title:`${arrangement.label} · ${arrangement.title}`,
      text:`第${arrangement.day}夜的「${arrangement.label}」没有被收回：${arrangement.outcome} 次晨真实发生：${arrangement.morning} 后来继续这样生活：${arrangement.future}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'personal_afterglow_aftermath' && entry.heroine === heroine && entry.choice === arrangement.id),
    } : null,
    nightMemory ? {
      kind:'ordinary_night', day:nightMemory.day, label:'普通夜章留下的生活事实',
      title:nightMemory.title,
      text:`第${nightMemory.day}夜的「${nightMemory.title}」仍在白日执行：${nightMemory.closing} 次晨真实发生：${nightMemory.morning}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'night_coda' && entry.heroine === heroine && entry.event === nightMemory.event),
    } : null,
    conversationMemory ? {
      kind:'night_conversation', day:conversationMemory.day, label:'专属夜谈留下的制度动作',
      title:conversationMemory.title,
      text:`第${conversationMemory.day}夜谈过的「${conversationMemory.title}」已经进入日常：${conversationMemory.future} 当时执行「${conversationMemory.stakeLabel}」：${conversationMemory.stakeText} ${conversationMemory.observerName}这样接住：${conversationMemory.observerLine}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'night_conversation' && entry.heroine === heroine && entry.event === conversationMemory.event),
    } : null,
    pairMemory ? {
      kind:'pair_interlude', day:pairMemory.day, label:'双院私议留下的横向关系',
      title:`与${pairMemory.partnerName} · ${pairMemory.title}`,
      text:`第${pairMemory.day}日与${pairMemory.partnerName}定下的「${pairMemory.title}」没有消失：${pairMemory.memory}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'pair_interlude' && entry.event === pairMemory.event && entry.choice === pairMemory.choice && entry.pair?.includes(heroine)),
    } : null,
    invitationMemory ? {
      kind:'dusk_invitation', day:invitationMemory.day, label:'她主动提出并走完的邀约',
      title:`${invitationMemory.invitationTitle} · ${invitationMemory.title}`,
      text:`第${invitationMemory.day}日她以“${invitationMemory.invitationTitle}”主动来请，亲口说：${invitationMemory.heroineLine} 你先选择“${invitationMemory.approachLabel}”，${invitationMemory.witnessName}见证后又以“${invitationMemory.choiceLabel}”落成「${invitationMemory.title}」：${invitationMemory.outcome}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'dusk_invitation_aftermath' && entry.heroine === heroine && entry.event === invitationMemory.event && entry.choice === invitationMemory.choice),
    } : null,
    rivalryMemory ? {
      kind:'rivalry', day:rivalryMemory.day, label:'偏宠对峙留下的双方关系',
      title:`与${rivalryMemory.otherName} · ${rivalryMemory.title}`,
      text:`第${rivalryMemory.day}日与${rivalryMemory.otherName}围绕“${rivalryMemory.title}”发生偏宠对峙：${rivalryMemory.role === 'challenger' ? `她当时发难说：${rivalryMemory.opening}` : `她作为昨夜被选择的一院亲口回答：${rivalryMemory.visitedReply}`} 你以“${rivalryMemory.choiceLabel}”落定，实际结果是：${rivalryMemory.outcome}`,
      historyIndex:lastHistoryIndex(state, (entry) => entry.type === 'morning' && entry.event === 'rivalry' && entry.day === rivalryMemory.day && entry.actor === rivalryMemory.actor && entry.visited === rivalryMemory.visited && entry.choice === rivalryMemory.choice),
    } : null,
  ].filter((memory) => memory && memory.historyIndex >= 0);
  if (!candidates.length) return null;
  const latest = candidates.reduce((current, memory) => memory.historyIndex > current.historyIndex ? memory : current);
  const { historyIndex, ...memory } = latest;
  return memory;
}

export function currentRouteAftermath(state) {
  if (state.phase !== 'route_aftermath' || !state.routeAftermath) return null;
  const row = state.routeAftermath;
  const context = routeAftermathContext(row.heroine, row.act - 1, row.step, row.lane);
  const template = context.template;
  const source = [...allRouteChoices(row.heroine), ACCORD_CHOICES[row.heroine]].find((choice) => choice?.id === row.sourceChoice);
  const arrangement = latestIntimacyArrangement(state, row.heroine);
  const nightMemory = latestOrdinaryNightMemory(state, row.heroine);
  const conversationMemory = latestNightConversationMemory(state, row.heroine);
  const invitationMemory = duskInvitationMemory(state, row.heroine);
  const rivalryMemory = latestRivalryMorningMemory(state, row.heroine);
  const pairMemory = latestPairInterludeMemory(state, row.heroine);
  const continuityMemory = routeContinuityMemory(state, row.heroine, {
    arrangement, nightMemory, conversationMemory, invitationMemory, rivalryMemory, pairMemory,
  });
  const beats = source && template
    ? [{ speaker: 'heroine', text: [routeChoiceEcho(source, row), continuityMemory?.text ?? ''].filter(Boolean).join(' ') }, ...(template.beats ?? [])]
    : [];
  const resolutionChoice = row.resolution?.choice ?? null;
  const resolutionChapter = resolutionChoice
    ? ROUTE_AFTERMATH_RESOLUTIONS[row.heroine]?.[row.act - 1]?.[resolutionChoice]
    : null;
  const resolutionStake = resolutionChoice
    ? routeAftermathStake(row.heroine, row.act, resolutionChoice)
    : null;
  const resolutionValid = row.resolution === null || (
    !!row.resolution
    && Object.keys(row.resolution).sort().join('\0') === ['beat', 'choice'].sort().join('\0')
    && ROUTE_AFTERMATH_CHOICE_IDS.has(resolutionChoice)
    && !!resolutionChapter
    && !!resolutionStake
    && Number.isInteger(row.resolution.beat)
    && row.resolution.beat >= 0
    && row.resolution.beat < resolutionChapter.beats.length
    && row.beat === beats.length
  );
  if (!template || template.id !== row.event || row.observer !== context.observer || !source || !HEROINES[row.observer]
    || !Number.isInteger(row.beat) || row.beat < 0 || row.beat > beats.length || !resolutionValid) return null;
  const beatTemplate = beats[row.beat] ?? null;
  const rawBeatText = typeof beatTemplate?.text === 'string'
    ? beatTemplate.text
    : beatTemplate?.text?.[row.lane] ?? beatTemplate?.text?.covenant ?? '';
  const speaker = beatTemplate?.speaker === 'observer' ? row.observer : row.heroine;
  const resolutionBeats = (resolutionChapter?.beats ?? []).map((beat) => {
    const resolutionSpeaker = beat.speaker === 'observer' ? row.observer : row.heroine;
    return {
      speaker: resolutionSpeaker,
      speakerName: HEROINES[resolutionSpeaker].name,
      speakerHouse: HEROINES[resolutionSpeaker].house,
      text: fillAftermathText(beat.text, row, source),
    };
  });
  const resolutionBeat = row.resolution ? resolutionBeats[row.resolution.beat] ?? null : null;
  return {
    ...row,
    title: template.title,
    body: fillAftermathText(template.body, row, source),
    sourceLabel: source.label,
    sourceHint: source.hint,
    sourceText: source.text,
    arrangement,
    nightMemory,
    conversationMemory,
    invitationMemory,
    rivalryMemory,
    pairMemory,
    continuityMemory,
    asset: template.asset ?? null,
    milestone: context.milestone,
    milestoneStep: template.step ?? null,
    beatCount: beats.length,
    readyForDecision: row.resolution === null && row.beat === beats.length,
    storyBeat: beatTemplate ? {
      speaker,
      speakerName: HEROINES[speaker].name,
      speakerHouse: HEROINES[speaker].house,
      text: fillAftermathText(rawBeatText, row, source),
    } : null,
    resolutionTitle: resolutionChapter?.title ?? null,
    resolutionChoice,
    resolutionChoiceLabel: resolutionChoice ? ROUTE_AFTERMATH_CHOICE_LABELS[resolutionChoice] : null,
    resolutionStake,
    resolutionBeat,
    resolutionBeats,
    resolutionCount: resolutionBeats.length,
  };
}

export function advanceRouteAftermath(state) {
  const event = currentRouteAftermath(state);
  if (event?.storyBeat) {
    state.routeAftermath.beat += 1;
    return { ok: true };
  }
  if (!event?.resolutionBeat) return { ok: false, error: '这段对话已经说到该由你回应的地方。' };
  if (state.routeAftermath.resolution.beat + 1 < event.resolutionCount) {
    state.routeAftermath.resolution.beat += 1;
    return { ok: true };
  }
  state.log.push(`${event.resolutionTitle}：${event.resolutionBeat.text}`);
  state.routeAftermath = null;
  state.phase = 'night';
  return { ok: true };
}

export function routeAftermathOptions(state) {
  const event = currentRouteAftermath(state);
  if (!event?.readyForDecision) return [];
  const trust = bondValue(state, event.heroine, event.observer);
  const bases = [
    {
      id: 'public', label: '把这笔拿到长案', hint: '让经手、代价和边界都能被另外四院追问',
      meta: '宅门更稳 · 闲话见光 · 两院互信上升', disabled: false,
    },
    {
      id: 'direct', label: '让她们自己谈',
      hint: trust >= 0
        ? `${HEROINES[event.heroine].short}与${HEROINES[event.observer].short}至少肯听完彼此一句，不由你代答`
        : `两院互信仍是 ${trust}，现在把她们关在一起只会变成争吵`,
      meta: `院间互信 ${trust >= 0 ? '+' : ''}${trust} · 成功后增幅最大`, disabled: trust < 0,
      locked: trust < 0 ? '先在白日或院议里让她们接过一次话。' : '',
    },
    {
      id: 'private', label: '把后果留在门内', hint: `继续护住与${HEROINES[event.heroine].short}的私情，不向${HEROINES[event.observer].short}解释`,
      meta: '情欲更近 · 旁院妒意与隔阂上升', disabled: false,
    },
  ];
  return bases.map((base) => {
    const stake = routeAftermathStake(event.heroine, event.act, base.id);
    const unaffordable = !!stake && cannotAfford(state, { effects:stake.resources });
    return {
      ...base,
      stake,
      meta:`${base.meta}${stake ? ` · ${stake.label} · ${stake.resourceText}` : ''}`,
      disabled:base.disabled || !stake || unaffordable,
      locked:base.locked || (!stake
        ? '这一幕还没有接上实际后约成本。'
        : unaffordable ? costLockedText({ effects:stake.resources }) : ''),
    };
  });
}

export function resolveRouteAftermath(state, choiceId) {
  const event = currentRouteAftermath(state);
  if (event && !event.readyForDecision) return { ok: false, error: '先听完她们把这件事说清。' };
  const option = routeAftermathOptions(state).find((row) => row.id === choiceId);
  if (!event || !option) return { ok: false, error: '这一小章已经翻过去了。' };
  if (option.disabled) return { ok: false, error: option.locked || '她们现在还谈不拢。' };
  const heroine = event.heroine;
  const observer = event.observer;
  const trust = bondValue(state, heroine, observer);
  const resolution = ROUTE_AFTERMATH_RESOLUTIONS[heroine]?.[event.act - 1]?.[choiceId];
  const stake = option.stake;
  if (!resolution?.beats?.length || !stake) return { ok: false, error: '这项处置还没有接上人物后话与实际成本。' };
  if (choiceId === 'public') {
    changeResources(state, { house: 2, exposure: 3 });
    changeBond(state, heroine, observer, 4);
    changeRel(state, heroine, { qing: 2, du: -2 }, `你没有让${HEROINES[heroine].short}独自承担门内选择的公开后果`);
    changeRel(state, observer, { qing: 2, du: -4 }, `你让${HEROINES[observer].short}看见了完整经手与代价`);
  } else if (choiceId === 'direct') {
    const gain = trust >= 10 ? 7 : 5;
    changeResources(state, { house: 3 });
    changeBond(state, heroine, observer, gain);
    changeRel(state, heroine, { qing: 3, du: -4 }, `她可以亲自向${HEROINES[observer].short}说明边界`);
    changeRel(state, observer, { qing: 3, du: -7 }, `她直接听见${HEROINES[heroine].short}愿意说与不愿说的部分`);
  } else {
    changeResources(state, { house: -1 });
    changeBond(state, heroine, observer, -3);
    changeRel(state, heroine, { qing: 5, yu: 4 }, '你把这件事继续留在她的门内');
    changeRel(state, observer, { du: 7 }, `${HEROINES[heroine].short}的门又在解释之前合上`);
  }
  changeResources(state, stake.resources);
  record(state, 'route_aftermath', {
    event: event.event, heroine, observer, lane: event.lane, sourceChoice: event.sourceChoice, choice: choiceId,
  });
  state.log.push(`${stake.label}：${stake.text}（${stake.resourceText}）`);
  state.routeAftermath.resolution = { choice: choiceId, beat: 0 };
  return { ok: true };
}

export function startVisit(state, heroineId) {
  if (state.phase !== 'choose_visit') return { ok: false, error: '现在还不能去她屋里。' };
  if (!HEROINE_IDS.includes(heroineId)) return { ok: false, error: '没有这处院门。' };
  if (routeCooling(state, heroineId)) return { ok: false, error: `${HEROINES[heroineId].short}今日没有开门。先让这笔失信过一夜，再来把话说清。` };
  if (routeComplete(state, heroineId)) return { ok: false, error: '她这条路已经走到了结果，今夜应去回应别的院门。' };
  state.currentHeroine = heroineId;
  state.phase = 'visit';
  record(state, 'visit_start', { heroine: heroineId, visible: true });
  return { ok: true };
}

export function chooseVisit(state, choiceId) {
  if (state.phase !== 'visit' || !state.currentHeroine) return { ok: false, error: '先选一处院门。' };
  const heroine = state.currentHeroine;
  const stepIndex = routeStep(state, heroine);
  const choice = visitChoices(state, heroine).find((item) => item.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个回应。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '前面的话还没接上。' };
  const lane = choice.effects.accord ? 'accord' : routeChoiceLane(heroine, choiceId);
  const reason = choice.effects.accord
    ? `你答应了她：${choice.label}`
    : `那一夜，你选了“${choice.label}”`;
  applyEffects(state, choice.effects, heroine, reason);
  if (choice.effects.accord) {
    record(state, 'accord_term', { heroine, term: choice.effects.accord, choice: choiceId });
  } else {
    if (lane) {
      state.routeStances[heroine][lane] += 1;
      if (lane === 'covenant') {
        changeResources(state, { house: 1 });
        changeRel(state, heroine, { qing: 2 }, '你把她的要求接进了五院都能追问的规矩');
      } else {
        changeRel(state, heroine, { qing: 3, yu: 4 }, '你把这一句只留在她的门内');
        for (const other of HEROINE_IDS.filter((id) => id !== heroine)) {
          changeRel(state, other, { du: 1 }, `${HEROINES[heroine].short}得了一句只有门内才知道的话`);
        }
      }
      for (const row of routeBondChanges(heroine, lane)) changeBond(state, heroine, row.other, row.delta);
    }
    state.visits[heroine] = (state.visits[heroine] ?? 0) + 1;
    record(state, 'visit_choice', { heroine, choice: choiceId, lane, public: !!PUBLIC_EVENTS[state.day] });
  }
  state.log.push(choice.text);
  state.routeAftermath = routeAftermathState(state, heroine, choiceId, lane, stepIndex);
  state.phase = 'route_aftermath';
  return { ok: true, text: choice.text };
}

function explicitSceneId(heroineId) {
  return ({
    wu_yueniang: 'yue_explicit',
    pan_jinlian: 'pan_explicit',
    li_pinger: 'pinger_explicit',
    meng_yulou: 'meng_explicit',
    sun_xuee: 'xuee_explicit',
  })[heroineId];
}

function preludeSceneId(heroineId) {
  return ({
    wu_yueniang: 'yue_prelude',
    pan_jinlian: 'pan_prelude',
    li_pinger: 'pinger_prelude',
    meng_yulou: 'meng_prelude',
    sun_xuee: 'xuee_prelude',
  })[heroineId];
}

function jealousyRise(state, observer, visited, base) {
  const bond = bondValue(state, observer, visited);
  return clamp(base - Math.trunc(bond / 8), 1, 16);
}

export function nightJealousyForecast(state, heroineId, actionId = 'talk') {
  const base = { leave: 2, talk: 5, prelude: 7, explicit: 10 }[actionId] ?? 5;
  const stance = routeStance(state, heroineId);
  const privateExtra = actionId === 'explicit' && stance.covenant < 2 && stance.private >= 3 ? 3 : 0;
  return HEROINE_IDS
    .filter((id) => id !== heroineId)
    .map((id) => ({ id, rise: jealousyRise(state, id, heroineId, base) + privateExtra }))
    .sort((left, right) => right.rise - left.rise);
}

export function visitForecast(state, heroineId) {
  const [mostJealous] = nightJealousyForecast(state, heroineId, 'talk');
  const stepIndex = routeStep(state, heroineId);
  const choices = visitChoices(state, heroineId);
  const routeChoice = choices.find((choice) => !choice.effects?.accord) ?? null;
  const lane = routeChoice ? routeChoiceLane(heroineId, routeChoice.id) : 'accord';
  const context = routeAftermathContext(heroineId, Math.min(3, Math.ceil(state.day / 5) - 1), stepIndex, lane);
  const observer = context.observer && context.observer !== heroineId ? context.observer : null;
  const observerTrust = observer ? bondValue(state, heroineId, observer) : 0;
  const trustGoal = observerTrust < 0
    ? `还差 ${Math.abs(observerTrust)} 到能直谈`
    : observerTrust < 10
      ? `还差 ${10 - observerTrust} 到能合办`
      : observerTrust < 24
        ? `还差 ${24 - observerTrust} 到肯互保`
        : '已经肯互保';
  const choiceKinds = [...new Set(choices.filter((choice) => !choice.disabled).map((choice) => (
    choice.effects?.accord ? '院约' : routeChoiceLane(heroineId, choice.id) === 'covenant' ? '共担' : '私情'
  )))];
  const obligation = activeObligations(state).find((row) => row.heroine === heroineId && row.type !== 'cooldown') ?? null;
  const reopenDay = state.routeReopensOn?.[heroineId] ?? 0;
  const branch = routeBranchContext(state, heroineId);
  return {
    mostJealous,
    step:stepIndex + 1,
    chapter:context.milestone ? `人物关键章${branch ? ` · ${branch.label}` : ''}` : branch ? `历史分支章 · ${branch.label}` : '路线续章',
    branch,
    observer,
    observerTrust,
    trustGoal,
    choiceKinds,
    obligation,
    reopenDay,
    text: `${context.milestone ? '关键章' : branch ? '历史分支章' : '路线续章'}${branch ? ` · ${branch.score}` : ''}${observer ? ` · ${HEROINES[observer].short}会进场` : ''}${mostJealous ? ` · ${HEROINES[mostJealous.id].short}明早约+${mostJealous.rise}妒` : ''}`,
  };
}

function nightEligibility(state, heroineId) {
  const rel = state.relations[heroineId];
  const boundaryBreach = routeBoundaryBreachActive(state, heroineId);
  if (heroineId === 'wu_yueniang') return {
    prelude: rel.qing >= 28 && state.resources.repute >= 3,
    preludeReason: '你在人前还没给够她正堂的脸。',
    explicit: rel.qing >= 55 && state.accords.order && state.resources.house >= 45 && !routeCooling(state, 'wu_yueniang') && ['ledger', 'banquet'].includes(state.selectedDayAction),
    explicitReason: routeCooling(state, 'wu_yueniang') ? '“正堂不是替你擦屁股的。”今日她不留门。' : '先办成答应她的事。今日的账或席面，也得收拾干净。',
  };
  if (heroineId === 'pan_jinlian') return {
    prelude: rel.qing >= 25 && rel.yu >= 40,
    preludeReason: '她还等着一句不躲闪的真话。',
    explicit: rel.qing >= 40 && rel.yu >= 60 && rel.ignored < 2
      && !boundaryBreach
      && state.accords.truth
      && !routeCooling(state, 'pan_jinlian') && state.selectedDayAction === 'listen',
    explicitReason: boundaryBreach
      ? '“官人那句独占，原来五处都能用。”她笑着把门关上。'
      : rel.ignored >= 2
        ? '“两夜不见人，今夜倒想起这扇门？”她没有让开。'
        : routeCooling(state, 'pan_jinlian')
          ? '“空话留给席上说。”她今日笑着关门。'
          : '先还她那杯酒。今日问来的口风，也别瞒着她。',
  };
  if (heroineId === 'li_pinger') return {
    prelude: rel.qing >= 30,
    preludeReason: '那本账，她还没敢交到你手里。',
    explicit: rel.qing >= 55 && state.accords.safety && !boundaryBreach
      && !routeCooling(state, 'li_pinger') && ['ledger', 'office'].includes(state.selectedDayAction),
    explicitReason: boundaryBreach
      ? '“我的账已经叫人听过一回。”她把钥匙重新系回腰间。'
      : routeCooling(state, 'li_pinger')
        ? '“你要的是箱子，不是我。”钥匙今日收着。'
        : '先替她守住那本账。今日的外债，也得亲手办妥。',
  };
  if (heroineId === 'meng_yulou') return {
    prelude: rel.qing >= 28 && state.resources.repute >= 2,
    preludeReason: '她还没看见你能把利害和情分分开讲清。',
    explicit: rel.qing >= 52 && state.accords.grace && !boundaryBreach
      && !routeCooling(state, heroineId) && ['banquet', 'office'].includes(state.selectedDayAction),
    explicitReason: boundaryBreach
      ? '“名帖能借，我的退路不借。”玉楼仍在笑，门闩却已经落下。'
      : routeCooling(state, heroineId)
        ? '“今日先把说过的条件兑现。”她没有留门。'
        : '先让她的功劳能在人前站住，今日也要办妥一桩官面事。',
  };
  return {
    prelude: rel.qing >= 28 && state.resources.house >= 35,
    preludeReason: '她还不信你能看见灶上的人，而不是只看见一碗冷饭。',
    explicit: rel.qing >= 52 && state.accords.hearth && !boundaryBreach
      && !routeCooling(state, heroineId) && ['ledger', 'listen'].includes(state.selectedDayAction),
    explicitReason: boundaryBreach
      ? '“你只要我的证据，没要过我这个人。”雪娥收火后没再回头。'
      : routeCooling(state, heroineId)
        ? '她把围裙系得更紧：“今日不是一句软话就能算了的。”'
        : '先当众还她管灶与作证的权限，今日也要亲手核过账或口供。',
  };
}

function nextNightConversation(state, heroineId) {
  const completed = state.history.filter((entry) => entry.type === 'night_conversation' && entry.heroine === heroineId).length;
  const template = NIGHT_CONVERSATIONS[heroineId]?.[completed];
  if (!template || state.visits[heroineId] < (completed + 1) * 2) return null;
  return { ...template, heroine: heroineId, chapter: completed + 1 };
}

const NIGHT_MODE_LABELS = Object.freeze({ honest: '明说', listen: '由她定界', private: '门内私情' });
const NIGHT_OBSERVER_EFFECTS = Object.freeze({
  honest:Object.freeze({ rel:Object.freeze({ qing:2, du:-2 }), bond:3 }),
  listen:Object.freeze({ rel:Object.freeze({ qing:1, du:-2 }), bond:3 }),
  private:Object.freeze({ rel:Object.freeze({ du:4 }), bond:-2 }),
});

function nightConversationObserverReaction(heroineId, chapter, mode) {
  const row = NIGHT_CONVERSATION_OBSERVERS[heroineId]?.[chapter - 1];
  const line = row?.reactions?.[mode];
  if (!row || !HEROINE_IDS.includes(row.observer) || row.observer === heroineId || !line) return null;
  return {
    heroine:row.observer,
    name:HEROINES[row.observer].name,
    short:HEROINES[row.observer].short,
    line,
  };
}

function nightConversationStake(heroineId, chapter, mode) {
  const row = NIGHT_CONVERSATION_STAKES[heroineId]?.[chapter - 1]?.[mode];
  if (!row?.label || !row?.text || !isRecord(row.resources) || !Object.keys(row.resources).length) return null;
  const resources = { ...row.resources };
  return {
    label:row.label,
    text:row.text,
    resources,
    resourceText:forecastTextFromEffects(resources),
  };
}

function previousNightConversation(state, heroineId, chapter) {
  if (chapter <= 1) return null;
  return [...state.history].reverse().find((entry) => (
    entry.type === 'night_conversation'
    && entry.heroine === heroineId
    && entry.chapter === chapter - 1
  )) ?? null;
}

export function nightConversationMemories(state, heroineId) {
  if (!state || !HEROINE_IDS.includes(heroineId) || !Array.isArray(state.history)) return [];
  return state.history
    .filter((entry) => entry.type === 'night_conversation' && entry.heroine === heroineId)
    .map((entry) => {
      const template = NIGHT_CONVERSATIONS[entry.heroine]?.[entry.chapter - 1];
      const choice = template?.choices.find((row) => row.id === entry.choice && row.mode === entry.mode);
      const morning = NIGHT_CONVERSATION_MORNINGS[entry.heroine]?.[entry.chapter - 1]?.[entry.mode];
      const future = NIGHT_CONVERSATION_FUTURES[entry.heroine]?.[entry.chapter - 1]?.[entry.mode];
      const observerReaction = nightConversationObserverReaction(entry.heroine, entry.chapter, entry.mode);
      const stake = nightConversationStake(entry.heroine, entry.chapter, entry.mode);
      if (!template || template.id !== entry.event || !choice || !morning || !future || !observerReaction || !stake) return null;
      return {
        day:entry.day,
        event:entry.event,
        heroine:entry.heroine,
        chapter:entry.chapter,
        title:template.title,
        prop:template.prop,
        choice:entry.choice,
        choiceLabel:choice.label,
        mode:entry.mode,
        modeLabel:NIGHT_MODE_LABELS[entry.mode],
        morning,
        future,
        observer:observerReaction.heroine,
        observerName:observerReaction.name,
        observerLine:observerReaction.line,
        stakeLabel:stake.label,
        stakeText:stake.text,
        stakeResources:stake.resources,
        stakeResourceText:stake.resourceText,
      };
    })
    .filter(Boolean);
}

export function latestNightConversationMemory(state, heroineId) {
  return nightConversationMemories(state, heroineId).at(-1) ?? null;
}

export function nightRelationshipPattern(state, heroineId) {
  if (!HEROINE_IDS.includes(heroineId)) return null;
  const rows = state.history.filter((entry) => entry.type === 'night_conversation' && entry.heroine === heroineId);
  const counts = { honest: 0, listen: 0, private: 0 };
  for (const row of rows) if (Object.prototype.hasOwnProperty.call(counts, row.mode)) counts[row.mode] += 1;
  if (!rows.length) {
    return {
      heroine: heroineId, mode: null, id: null, label: '尚未成章',
      summary: '她还没有足够夜话把一种相处方式当成你的习惯。', epilogue: '',
      counts, chapters: 0, settled: false,
    };
  }
  const highest = Math.max(...Object.values(counts));
  const tied = new Set(Object.entries(counts).filter(([, count]) => count === highest).map(([mode]) => mode));
  const mode = [...rows].reverse().find((row) => tied.has(row.mode))?.mode ?? rows.at(-1).mode;
  const pattern = NIGHT_RELATIONSHIP_PATTERNS[heroineId][mode];
  return {
    heroine: heroineId, mode, ...pattern,
    counts, chapters: rows.length, settled: rows.length >= 2,
  };
}

function nightConversationContinuity(previousMode, currentMode) {
  if (!previousMode) {
    return {
      kind: 'first',
      label: '这句话会进入下一章',
      text: '她不会把今晚只算成一次好感；下一次再谈，她会拿这句已经发生过的话继续问。',
    };
  }
  if (previousMode === currentMode) {
    return {
      kind: 'kept',
      label: `你连续选择了「${NIGHT_MODE_LABELS[currentMode]}」`,
      text: '相同立场开始成为她能预期的做法，因此更深，也会承担这条路反复选择后的额外代价。',
    };
  }
  return {
    kind: 'reframed',
    label: `你从「${NIGHT_MODE_LABELS[previousMode]}」改成「${NIGHT_MODE_LABELS[currentMode]}」`,
    text: '她没有把改变当成背叛，也不会假装前一章没发生；两次不同回答会一起留在这段关系里。',
  };
}

export function currentNightConversation(state) {
  const row = state?.nightConversation;
  if (state?.phase !== 'night' || !row || !HEROINE_IDS.includes(row.heroine)) return null;
  const template = NIGHT_CONVERSATIONS[row.heroine]?.[row.chapter - 1];
  if (!template || template.id !== row.event || row.heroine !== state.currentHeroine || !Number.isInteger(row.beat) || ![0, 1].includes(row.beat)) return null;
  const resolution = row.resolution && isRecord(row.resolution)
    ? template.choices.find((choice) => choice.id === row.resolution.choice)
    : null;
  const coda = resolution ? NIGHT_CONVERSATION_CODAS[resolution.id] : null;
  const resolutionBeats = resolution && coda
    ? [
      { title: resolution.label, body: resolution.text },
      ...coda.beats,
    ]
    : [];
  if (row.resolution && (
    !resolution
    || !coda
    || row.resolution.text !== resolution.text
    || !Number.isInteger(row.resolution.beat)
    || row.resolution.beat < 0
    || row.resolution.beat >= resolutionBeats.length
  )) return null;
  const previous = previousNightConversation(state, row.heroine, row.chapter);
  const memoryEcho = previous
    ? NIGHT_CONVERSATION_ECHOES[row.heroine]?.[row.chapter - 2]?.[previous.mode] ?? null
    : null;
  const observerReaction = resolution
    ? nightConversationObserverReaction(row.heroine, row.chapter, resolution.mode)
    : null;
  const stake = resolution ? nightConversationStake(row.heroine, row.chapter, resolution.mode) : null;
  if (resolution && (!observerReaction || !stake)) return null;
  return {
    ...template,
    heroine: row.heroine,
    chapter: row.chapter,
    beat: row.beat,
    previousMode: previous?.mode ?? null,
    memoryEcho,
    storyText: row.resolution ? null : row.beat === 0 ? template.opening : template.question,
    resolution: row.resolution ? {
      ...resolution,
      text: row.resolution.text,
      beat: row.resolution.beat,
      current: resolutionBeats[row.resolution.beat],
      beats: resolutionBeats,
      count: resolutionBeats.length,
      continuity: nightConversationContinuity(previous?.mode ?? null, resolution.mode),
      observerReaction,
      stake,
    } : null,
  };
}

export function advanceNightConversation(state) {
  const event = currentNightConversation(state);
  if (!event || event.resolution) return { ok: false, error: '这段夜话已经说到要你回应的地方。' };
  if (event.beat >= 1) return { ok: false, error: '她已经问完，轮到你回答。' };
  state.nightConversation.beat = 1;
  return { ok: true };
}

export function nightConversationOptions(state) {
  const event = currentNightConversation(state);
  if (!event || event.resolution || event.beat < 1) return [];
  return event.choices.map((choice) => {
    const stake = nightConversationStake(event.heroine, event.chapter, choice.mode);
    const disabled = !stake || cannotAfford(state, { effects:stake.resources });
    return {
      id: choice.id,
      label: choice.label,
      hint: choice.hint,
      stake,
      disabled,
      locked:!stake ? '这一章还没有接上实际制度代价。' : disabled ? costLockedText({ effects:stake.resources }) : '',
      meta: `${event.previousMode
        ? choice.mode === event.previousMode ? '延续上章' : '改写上章'
        : '写下第一笔'} · ${{
        honest: '明说欲望 · 妒意下降 · 去处见光',
        listen: '由她定界 · 宅门更稳 · 耗损缓解',
        private: '私情升温 · 旁院会记一笔',
      }[choice.mode]}${stake ? ` · ${stake.label} · ${stake.resourceText}` : ''}`,
    };
  });
}

export function chooseNightConversation(state, choiceId) {
  const event = currentNightConversation(state);
  const choice = event?.choices.find((row) => row.id === choiceId);
  if (!event || event.resolution || event.beat < 1 || !choice) return { ok: false, error: '这句回答接不上她刚才的问题。' };
  const effects = {
    honest: { rel: { qing: 10, yu: 2, du: -7 }, resources: { strain: -5, house: 2, exposure: 2 } },
    listen: { rel: { qing: 8, yu: 3, du: -6 }, resources: { strain: -6, house: 3 } },
    private: { rel: { qing: 7, yu: 8, du: -3 }, resources: { strain: -4, house: -1 } },
  }[choice.mode];
  const observerReaction = nightConversationObserverReaction(event.heroine, event.chapter, choice.mode);
  const observerEffects = NIGHT_OBSERVER_EFFECTS[choice.mode];
  const stake = nightConversationStake(event.heroine, event.chapter, choice.mode);
  if (!observerReaction || !observerEffects || !stake) return { ok: false, error: '这一章还没有接到真正受影响的旁院与制度代价。' };
  if (cannotAfford(state, { effects:stake.resources })) return { ok: false, error: costLockedText({ effects:stake.resources }) };
  changeRel(state, event.heroine, effects.rel, `夜谈：${choice.label}`);
  changeResources(state, effects.resources);
  changeResources(state, stake.resources);
  changeRel(state, observerReaction.heroine, observerEffects.rel, observerReaction.line);
  changeBond(state, event.heroine, observerReaction.heroine, observerEffects.bond);
  if (choice.mode === 'private') {
    for (const other of HEROINE_IDS.filter((id) => id !== event.heroine && id !== observerReaction.heroine)) {
      changeRel(state, other, { du: 1 }, `${HEROINES[event.heroine].short}这一章仍只在门内算数；她尚未亲手接到本章物件`);
    }
  }
  if (event.previousMode === choice.mode) {
    if (choice.mode === 'honest') {
      changeRel(state, event.heroine, { qing: 2, du: -1 }, '她看见你没有只在上一章说一次好听的实话');
      changeResources(state, { house: 1, exposure: 1 });
    } else if (choice.mode === 'listen') {
      changeRel(state, event.heroine, { qing: 1, du: -2 }, '她划过的边界在下一章仍然有效');
      changeResources(state, { house: 1, strain: -2 });
    } else {
      changeRel(state, event.heroine, { yu: 3 }, '连续两章都把答案留在门内，私情更深也更难瞒');
      changeResources(state, { house: -1 });
      changeRel(state, observerReaction.heroine, { du: 2 }, `${observerReaction.short}连续两章都实际接到了门内规则留给旁院的缺口`);
      changeBond(state, event.heroine, observerReaction.heroine, -1);
    }
  } else if (event.previousMode) {
    changeRel(state, event.heroine, { qing: 2, du: -2 }, '你没有抹掉上一章，而是当面说明这一次为什么改了回答');
    changeResources(state, { house: 2, strain: -1 });
    if (event.previousMode === 'private' && choice.mode !== 'private') {
      for (const other of HEROINE_IDS.filter((id) => id !== event.heroine)) {
        changeRel(state, other, { du: -1 }, `${HEROINES[event.heroine].short}门内的一部分旧话终于有了可追问的新边界`);
      }
    }
  }
  record(state, 'night_conversation', {
    event: event.id, heroine: event.heroine, chapter: event.chapter,
    choice: choice.id, mode: choice.mode, previousMode: event.previousMode,
  });
  state.log.push(choice.text, `${stake.label}：${stake.text}（${stake.resourceText}）`);
  state.nightConversation.resolution = { choice: choice.id, text: choice.text, beat: 0 };
  return { ok: true };
}

export function continueNightConversation(state) {
  const event = currentNightConversation(state);
  if (!event?.resolution) return { ok: false, error: '这段夜话还没有落到结果。' };
  if (state.nightConversation.resolution.beat + 1 < event.resolution.count) {
    state.nightConversation.resolution.beat += 1;
    return { ok: true };
  }
  state.nightConversation = null;
  advanceAfterNight(state);
  return { ok: true };
}

export function nightOptions(state) {
  if (!state.currentHeroine || state.nightConversation || state.nightCoda) return [];
  const e = nightEligibility(state, state.currentHeroine);
  const stance = routeStance(state, state.currentHeroine);
  const intimacyPath = stance.covenant >= 2 ? 'covenant' : stance.private >= 3 ? 'private' : null;
  const jealousyMeta = (actionId) => {
    const top = nightJealousyForecast(state, state.currentHeroine, actionId)[0];
    return top ? `明早最酸：${HEROINES[top.id].short}约+${top.rise}` : '';
  };
  return [
    { id: 'leave', meta: jealousyMeta('leave'), disabled: false },
    { id: 'talk', meta: jealousyMeta('talk'), disabled: false },
    { id: 'prelude', scene: preludeSceneId(state.currentHeroine), meta: jealousyMeta('prelude'), disabled: !e.prelude, locked: e.preludeReason },
    {
      id: 'explicit', scene: explicitSceneId(state.currentHeroine), intimacyPath,
      meta: `${intimacyPath === 'covenant' ? '共担路线 · 旁院更容易接纳' : intimacyPath === 'private' ? '私情路线 · 今夜更热，明早醋意更重' : '路线未定'} · ${jealousyMeta('explicit')}`,
      disabled: !e.explicit || !intimacyPath,
      locked: intimacyPath ? e.explicitReason : '她还在看：你会不会两次共同担事，或三次明确把私情留给她。',
    },
  ];
}

function ordinaryNightCodaTemplate(heroineId, actionId, act) {
  return ORDINARY_NIGHT_CODAS[heroineId]?.[actionId]?.[act - 1] ?? null;
}

function ordinaryNightMorningText(heroineId, actionId, act) {
  return ORDINARY_NIGHT_MORNINGS[heroineId]?.[actionId]?.[act - 1] ?? '';
}

function ordinaryNightMemoryFromRow(row) {
  const chapter = ordinaryNightCodaTemplate(row.heroine, row.action, row.act);
  const morning = ordinaryNightMorningText(row.heroine, row.action, row.act);
  if (!chapter || chapter.id !== row.event || !morning) return null;
  return {
    day: row.day,
    event: row.event,
    heroine: row.heroine,
    action: row.action,
    act: row.act,
    title: chapter.title,
    prop: chapter.prop,
    closing: chapter.closing,
    morning,
    actionLabel: row.action === 'leave' ? '停在她愿意的位置' : '把茶喝完',
  };
}

export function ordinaryNightMemories(state, heroineId) {
  if (!state || !HEROINE_IDS.includes(heroineId) || !Array.isArray(state.history)) return [];
  const byEvent = new Map();
  for (const row of state.history.filter((entry) => entry.type === 'night_coda' && entry.heroine === heroineId)) {
    const memory = ordinaryNightMemoryFromRow(row);
    if (!memory) continue;
    const previous = byEvent.get(memory.event);
    const days = [...(previous?.days ?? []), memory.day];
    byEvent.delete(memory.event);
    byEvent.set(memory.event, {
      ...memory,
      firstDay:previous?.firstDay ?? memory.day,
      days,
      count:days.length,
    });
  }
  return [...byEvent.values()];
}

export function latestOrdinaryNightMemory(state, heroineId) {
  return ordinaryNightMemories(state, heroineId).at(-1) ?? null;
}

export function currentOrdinaryNightCoda(state) {
  const row = state?.nightCoda;
  if (state?.phase !== 'night' || !row) return null;
  const template = ordinaryNightCodaTemplate(row.heroine, row.action, row.act);
  const opening = NIGHT_OUTCOMES[row.heroine]?.[row.action]?.[row.act - 1];
  if (!template
    || template.id !== row.event
    || !HEROINE_IDS.includes(row.heroine)
    || !['leave', 'talk'].includes(row.action)
    || !Number.isInteger(row.act)
    || row.act < 1
    || row.act > 4
    || !Number.isInteger(row.beat)
    || row.beat < 0
    || row.beat > 2
    || typeof opening !== 'string') return null;
  const beats = [
    { id: 'choice', title: template.title, body: opening },
    { id: 'turn', title: `${HEROINES[row.heroine].short}没有让这句话停在门内`, body: template.turn },
    { id: 'tomorrow', title: row.action === 'leave' ? '停在这里，也会改变明日' : '茶喝完以后，明日已有一笔要照做', body: template.closing },
  ];
  return {
    ...row,
    title: template.title,
    prop: template.prop,
    count: beats.length,
    current: beats[row.beat],
    beats,
  };
}

export function advanceOrdinaryNightCoda(state) {
  const story = currentOrdinaryNightCoda(state);
  if (!story?.current) return { ok: false, error: '这段夜里的后话已经翻过去了。' };
  if (story.beat < story.count - 1) {
    state.nightCoda.beat += 1;
    return { ok: true };
  }
  record(state, 'night_coda', {
    event: story.event,
    heroine: story.heroine,
    action: story.action,
    act: story.act,
  });
  state.nightCoda = null;
  advanceAfterNight(state);
  return { ok: true };
}

export function chooseNight(state, actionId) {
  if (state.phase !== 'night' || !state.currentHeroine) return { ok: false, error: '夜里的话还没到这里。' };
  const option = nightOptions(state).find((item) => item.id === actionId);
  if (!option) return { ok: false, error: '没有这个夜间选择。' };
  if (option.disabled) return { ok: false, error: option.locked };
  const heroine = state.currentHeroine;
  const actIndex = Math.min(3, Math.ceil(state.day / 5) - 1);
  const conversation = actionId === 'talk' ? nextNightConversation(state, heroine) : null;
  const ordinaryNightText = (action) => {
    const row = NIGHT_OUTCOMES[heroine]?.[action];
    return Array.isArray(row) ? row[actIndex] : row;
  };
  let text = '';
  if (actionId === 'leave') {
    changeRel(state, heroine, { qing: 2, du: -5 }, '她停下时，你没有再往前');
    changeResources(state, { strain: -STRAIN_REST_RELIEF }); // 不进场景的一夜,身体缓过来一些
    text = ordinaryNightText('leave');
    const coda = ordinaryNightCodaTemplate(heroine, 'leave', actIndex + 1);
    state.nightCoda = { event: coda.id, heroine, action: 'leave', act: actIndex + 1, beat: 0 };
  } else if (actionId === 'talk') {
    if (conversation) {
      state.nightConversation = {
        event: conversation.id, heroine, chapter: conversation.chapter,
        beat: 0, resolution: null,
      };
      text = conversation.context;
    } else {
      changeRel(state, heroine, { qing: 8, yu: 6, du: -5 }, '你留下来听她把话说完');
      changeResources(state, { strain: -STRAIN_REST_RELIEF });
      text = ordinaryNightText('talk');
      const coda = ordinaryNightCodaTemplate(heroine, 'talk', actIndex + 1);
      state.nightCoda = { event: coda.id, heroine, action: 'talk', act: actIndex + 1, beat: 0 };
    }
  } else if (actionId === 'prelude') {
    unlockScene(state, option.scene);
    changeRel(state, heroine, { qing: 7, yu: 10, du: -4 }, '她点头以后，你才靠近');
    changeResources(state, { strain: 3 });
    state.pendingScene = option.scene;
    state.sceneReturnPhase = 'after_night';
    state.sceneBeat = 0;
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
    } else if (heroine === 'li_pinger') {
      changeRel(state, heroine, { qing: 12, yu: 6, du: -8 }, '你先护住她的账，才在私院留下');
      changeResources(state, { house: 4, strain: 8 });
      addSecret(state, 'merchant_route');
      addFlag(state, 'pinger_morning_route');
    } else if (heroine === 'meng_yulou') {
      changeRel(state, heroine, { qing: 10, yu: 7, du: -8 }, '条件一项项讲明后，是她亲手落下门闩');
      changeResources(state, { repute: 1, strain: 8 });
      addSecret(state, 'meng_guest_list');
      addFlag(state, 'meng_morning_invitation');
    } else {
      changeRel(state, heroine, { qing: 11, yu: 7, du: -9 }, '你先把免罚与亲近分开，再等她亲手收火');
      changeResources(state, { house: 6, strain: 9 });
      addSecret(state, 'xuee_storehouse_mark');
      addFlag(state, 'xuee_morning_breakfast');
    }
    state.pendingScene = option.scene;
    state.sceneReturnPhase = 'after_night';
    state.sceneBeat = 0;
    state.phase = 'scene';
    text = SCENES[option.scene].body;
    if (option.intimacyPath === 'private') {
      for (const other of HEROINE_IDS.filter((id) => id !== heroine)) {
        changeRel(state, other, { du: 3 }, `${HEROINES[heroine].short}得了一个没有写进共同约定的夜晚`);
      }
      text += ' 这份亲近没有写进五院的明账；今夜更近，明早也会更难解释。';
    }
  }
  record(state, 'night', { heroine, action: actionId, scene: option.scene ?? null, visible: actionId !== 'leave' });
  state.log.push(text);
  if (!option.scene && !state.nightConversation && !state.nightCoda) advanceAfterNight(state);
  if (state.nightCoda) return { ok: true };
  return { ok: true, text, scene: option.scene ?? null };
}

function unlockScene(state, sceneId) {
  if (!SCENES[sceneId]) throw new Error(`未知场景 ${sceneId}`);
  if (!state.unlocked.includes(sceneId)) state.unlocked.push(sceneId);
}

function personalAfterglowTemplate(heroineId, tier) {
  return PERSONAL_AFTERGLOWS[heroineId]?.[tier] ?? null;
}

function personalAfterglowAftermathTemplate(heroineId, tier) {
  return PERSONAL_AFTERGLOW_AFTERMATHS[heroineId]?.[tier] ?? null;
}

export function intimacyArrangements(state, heroineId) {
  if (!state || !HEROINE_IDS.includes(heroineId) || !Array.isArray(state.history)) return [];
  return ['prelude', 'explicit'].flatMap((tier) => {
    const row = [...state.history].reverse().find((entry) => (
      entry.type === 'personal_afterglow_aftermath'
      && entry.heroine === heroineId
      && entry.tier === tier
    ));
    if (!row) return [];
    const chapter = personalAfterglowAftermathTemplate(heroineId, tier);
    const choice = chapter?.choices.find((item) => item.id === row.choice);
    const future = INTIMACY_ARRANGEMENT_ECHOES[row.choice];
    if (!choice || !future) return [];
    return [{
      heroine:heroineId, tier, day:row.day, id:row.choice,
      label:choice.label, hint:choice.hint, title:choice.title,
      outcome:choice.body, morning:choice.morning, future,
    }];
  });
}

export function latestIntimacyArrangement(state, heroineId) {
  return intimacyArrangements(state, heroineId).sort((left, right) => right.day - left.day)[0] ?? null;
}

export function currentPersonalAfterglow(state) {
  if (state.phase !== 'personal_afterglow' || !state.personalAfterglow) return null;
  const row = state.personalAfterglow;
  const template = personalAfterglowTemplate(row.heroine, row.tier);
  if (!template || template.id !== row.event || SCENES[row.scene]?.heroine !== row.heroine || SCENES[row.scene]?.tier !== row.tier) return null;
  return { ...row, ...template };
}

export function personalAfterglowOptions(state) {
  const event = currentPersonalAfterglow(state);
  if (!event) return [];
  return event.choices.map((choice) => {
    const rel = choice.effects?.rel ?? {};
    const changes = [
      rel.qing ? `情${rel.qing > 0 ? '+' : ''}${rel.qing}` : '',
      rel.yu ? `欲${rel.yu > 0 ? '+' : ''}${rel.yu}` : '',
      rel.du ? `妒${rel.du > 0 ? '+' : ''}${rel.du}` : '',
      choice.effects?.house ? `宅${choice.effects.house > 0 ? '+' : ''}${choice.effects.house}` : '',
      choice.effects?.strain ? `耗${choice.effects.strain > 0 ? '+' : ''}${choice.effects.strain}` : '',
    ].filter(Boolean);
    return { ...choice, meta: changes.join(' · '), disabled: cannotAfford(state, choice), locked: cannotAfford(state, choice) ? costLockedText(choice) : '' };
  });
}

export function choosePersonalAfterglow(state, choiceId) {
  const event = currentPersonalAfterglow(state);
  const choice = personalAfterglowOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '这段余夜已经翻过去了。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '现在接不起这句话。' };
  applyEffects(state, choice.effects, event.heroine, `余夜：${choice.label}`);
  record(state, 'personal_afterglow', { event: event.event, heroine: event.heroine, scene: event.scene, tier: event.tier, choice: choice.id });
  state.log.push(choice.text);
  const aftermath = personalAfterglowAftermathTemplate(event.heroine, event.tier);
  if (!aftermath) return { ok:false, error:'这段余夜没有接上天亮前的最后一问。' };
  state.personalAfterglowAftermath = {
    event:aftermath.id, heroine:event.heroine, scene:event.scene, tier:event.tier, approach:choice.id, beat:0, resolution:null,
  };
  state.personalAfterglow = null;
  state.phase = 'personal_afterglow_aftermath';
  return { ok: true, text: choice.text };
}

export function currentPersonalAfterglowAftermath(state) {
  if (state.phase !== 'personal_afterglow_aftermath' || !state.personalAfterglowAftermath) return null;
  const row = state.personalAfterglowAftermath;
  const original = personalAfterglowTemplate(row.heroine, row.tier);
  const chapter = personalAfterglowAftermathTemplate(row.heroine, row.tier);
  const approach = original?.choices.find((choice) => choice.id === row.approach);
  if (!original
    || !chapter
    || !approach
    || row.event !== chapter.id
    || SCENES[row.scene]?.heroine !== row.heroine
    || SCENES[row.scene]?.tier !== row.tier
    || !Number.isInteger(row.beat)
    || row.beat < 0
    || row.beat > 1) return null;
  if (row.resolution) {
    const choice = chapter.choices.find((item) => item.id === row.resolution.choice);
    if (!choice || row.resolution.text !== choice.body) return null;
    return {
      ...row, count:3, step:2, current:{ title:choice.title, body:choice.body }, choice, approachChoice:approach,
      resolved:true, awaitingChoice:false, kicker:chapter.kicker,
    };
  }
  if (row.beat === 0) {
    return {
      ...row, count:3, step:0, current:{ title:'她没有让第一次回答成为结尾', body:approach.text }, approachChoice:approach,
      resolved:false, awaitingChoice:false, kicker:chapter.kicker,
    };
  }
  return {
    ...row, count:3, step:1, current:{ title:chapter.title, body:chapter.body }, approachChoice:approach,
    resolved:false, awaitingChoice:true, kicker:chapter.kicker,
  };
}

export function personalAfterglowAftermathOptions(state) {
  const story = currentPersonalAfterglowAftermath(state);
  if (!story?.awaitingChoice) return [];
  return personalAfterglowAftermathTemplate(story.heroine, story.tier).choices.map((choice) => {
    const rel = choice.effects?.rel ?? {};
    const changes = [
      rel.qing ? `情${rel.qing > 0 ? '+' : ''}${rel.qing}` : '',
      rel.du ? `妒${rel.du > 0 ? '+' : ''}${rel.du}` : '',
      choice.effects?.house ? `宅${choice.effects.house > 0 ? '+' : ''}${choice.effects.house}` : '',
      choice.effects?.exposure ? `露${choice.effects.exposure > 0 ? '+' : ''}${choice.effects.exposure}` : '',
      choice.effects?.strain ? `耗${choice.effects.strain > 0 ? '+' : ''}${choice.effects.strain}` : '',
    ].filter(Boolean);
    return { ...choice, meta:changes.join(' · '), disabled:cannotAfford(state, choice), locked:cannotAfford(state, choice) ? costLockedText(choice) : '' };
  });
}

export function resolvePersonalAfterglowAftermath(state, choiceId) {
  const story = currentPersonalAfterglowAftermath(state);
  const choice = personalAfterglowAftermathOptions(state).find((item) => item.id === choiceId);
  if (!story || !choice) return { ok:false, error:'这项余夜安排已经接不到了。' };
  if (choice.disabled) return { ok:false, error:choice.locked || '眼下承担不起这项安排。' };
  applyEffects(state, choice.effects, story.heroine, `余夜落字：${choice.label}`);
  record(state, 'personal_afterglow_aftermath', {
    event:story.event, heroine:story.heroine, scene:story.scene, tier:story.tier, approach:story.approach, choice:choice.id,
  });
  state.log.push(choice.body);
  state.personalAfterglowAftermath.resolution = { choice:choice.id, text:choice.body };
  return { ok:true, text:choice.body };
}

export function advancePersonalAfterglowAftermath(state) {
  const story = currentPersonalAfterglowAftermath(state);
  if (!story?.current) return { ok:false, error:'这段余夜已经翻过去了。' };
  if (story.resolved) {
    const text = story.current.body;
    state.personalAfterglowAftermath = null;
    advanceAfterNight(state);
    return { ok:true, text };
  }
  if (story.awaitingChoice) return { ok:false, error:'先决定这次亲近怎样进入天亮后的生活。' };
  state.personalAfterglowAftermath.beat = 1;
  return { ok:true, text:story.current.body };
}

export function currentSceneChapter(state) {
  if (state.phase !== 'scene' || !state.pendingScene) return null;
  const scene = SCENES[state.pendingScene];
  const allianceTableau = scene?.id === 'inner_court_alliance' ? recordedAllianceNightTableau(state) : null;
  const allianceTableauBeats = allianceTableau
    ? [allianceTableau.lead, ...allianceTableau.beats.map((entry) => `${entry.body} ${entry.transition}`)]
    : null;
  const sharedAccord = scene?.id === 'inner_court_accord' ? recordedSharedNightAccord(state) : [];
  const sharedAccordBeats = sharedAccord.length
    ? [scene.body, ...sharedAccord.map((entry) => `${entry.reasons.join(' ')} ${entry.conclusion}`)]
    : null;
  const sharedAfterglowTableau = scene?.id === 'inner_court_afterglow' ? recordedSharedAfterglowTableau(state) : null;
  const sharedAfterglowBeats = sharedAfterglowTableau
    ? [sharedAfterglowTableau.lead, ...sharedAfterglowTableau.beats.map((entry) => `${entry.body} ${entry.transition}`)]
    : null;
  const beats = allianceTableauBeats ?? sharedAccordBeats ?? sharedAfterglowBeats ?? (scene?.beats?.length ? scene.beats : [scene?.body]);
  if (!scene || !Number.isInteger(state.sceneBeat) || state.sceneBeat < 0 || state.sceneBeat >= beats.length) return null;
  const index = state.sceneBeat;
  const allianceTableauBeat = allianceTableau?.beats[index - 1] ?? null;
  const accordEntry = sharedAccord[index - 1] ?? null;
  const tableauBeat = sharedAfterglowTableau?.beats[index - 1] ?? null;
  const isPersonal = ['prelude', 'explicit'].includes(scene.tier);
  const kicker = allianceTableau
    ? index === 0
      ? `${allianceTableau.size} 人真实成员 · ${allianceTableau.title}`
      : `联盟第 ${index} 拍 · ${allianceTableauBeat.choiceLabel}`
    : sharedAccord.length
    ? index === 0
      ? '总约先不替任何一院签字'
      : `第 ${index} 印 · ${HEROINES[accordEntry.heroine].name} · ${accordEntry.day19.outcomeLabel}`
    : sharedAfterglowTableau
      ? index === 0
        ? `三拍落成 · ${sharedAfterglowTableau.title}`
        : `余夜第 ${index} 拍 · ${tableauBeat.choiceLabel}`
    : !isPersonal
    ? null
    : scene.tier === 'prelude'
      ? ['她先把边界说清', '距离近了，也仍能停', '这一步由她亲口决定'][index]
      : ['门、钥匙与退路都已说明', '靠近以后仍再次确认', '余夜没有取消任何边界'][index];
  const button = allianceTableau
    ? index === 0
      ? '看第一问怎样变成桌边动作'
      : index + 1 < beats.length
        ? `继续看${allianceTableau.beats[index].beatTitle}`
        : '让这一夜按真实成员落进结局'
    : sharedAccord.length
    ? index === 0
      ? '从第一院开始逐印核约'
      : index + 1 < beats.length
        ? `再听${HEROINES[sharedAccord[index].heroine].short}怎样落印`
        : '让五份本人答复共同留在灯下'
    : sharedAfterglowTableau
      ? index === 0
        ? '看第一拍怎样进入群像'
        : index + 1 < beats.length
          ? `继续看${sharedAfterglowTableau.beats[index].beatTitle}`
          : '带着这三拍等到天亮'
    : !isPersonal
    ? '收下这一页'
    : index + 1 < beats.length
      ? (index === 0 ? '等她继续' : '听她说完')
      : '把余夜接下去';
  return {
    scene,
    index,
    count: beats.length,
    text: beats[index],
    kicker,
    button,
    allianceTableau,
    allianceTableauBeat,
    sharedAccord,
    accordEntry,
    sharedAfterglowTableau,
    tableauBeat,
    final: index === beats.length - 1,
  };
}

export function closeScene(state) {
  if (state.phase !== 'scene' || !state.pendingScene) return { ok: false, error: '没有待收的册页。' };
  const chapter = currentSceneChapter(state);
  if (!chapter) return { ok: false, error: '这段册页的前后次序没有接上。' };
  if (!chapter.final) {
    state.sceneBeat += 1;
    return { ok: true, advanced: true };
  }
  const next = state.sceneReturnPhase;
  const closedScene = state.pendingScene;
  state.pendingScene = null;
  state.sceneReturnPhase = null;
  state.sceneBeat = 0;
  if (next === 'choose_visit') {
    enterVisitHub(state);
  } else if (next === 'after_public_scene') {
    if (state.day === 15) {
      const openingEvidence = day15OpeningEvidence(state);
      state.publicEvidence = { selected:openingEvidence ? [openingEvidence.evidenceId] : [], result:null };
      state.phase = 'public_evidence';
    } else state.phase = 'public_followup';
  } else if (next === 'after_shared_work') {
    state.phase = 'shared_afterglow';
  } else if (next === 'after_shared_afterglow') {
    state.phase = 'shared_dawn';
  } else if (next === 'after_alliance_night') {
    state.ending = determineEnding(state);
    state.phase = 'ending';
    state.over = true;
  } else if (next === 'after_night') {
    const scene = SCENES[closedScene];
    const template = personalAfterglowTemplate(state.currentHeroine, scene?.tier);
    if (!template) return { ok: false, error: '这段余夜没有接上。' };
    state.personalAfterglow = { event: template.id, heroine: state.currentHeroine, scene: closedScene, tier: scene.tier };
    state.phase = 'personal_afterglow';
  } else {
    advanceAfterNight(state);
  }
  return { ok: true };
}

const CRISIS_REPLY_OUTCOMES = new Set(['stand', 'amend', 'withdraw']);

function crisisReplyStored(reply) {
  return {
    heroine:reply.heroine,
    outcome:reply.outcome,
    sourceType:reply.sourceType,
    sourceId:reply.sourceId,
    sourceDay:reply.sourceDay,
    otherHeroine:reply.otherHeroine,
  };
}

function crisisTriggerFacts(state, momentum = pressureMomentum(state)) {
  return {
    missed:momentum.missed,
    silver:state.resources.silver,
    exposure:state.resources.exposure,
    house:state.resources.house,
    strain:state.resources.strain,
  };
}

function crisisHistoryBeforeReplies(state, eventId) {
  const index = state.history.findIndex((entry) => (
    entry.event === eventId
    && (entry.type === 'house_crisis_reply' || entry.type === 'house_crisis')
  ));
  return state.history.slice(0, index < 0 ? state.history.length : index);
}

function crisisMorningReply(history, heroine) {
  const settlement = [...history].reverse().find((entry) => entry.type === 'morning_settlement' && entry.heroine === heroine);
  if (!settlement) return null;
  const restored = history.find((entry) => (
    entry.type === 'morning_settlement_restore'
    && entry.settlementDay === settlement.day
    && entry.cause === settlement.cause
    && entry.heroine === heroine
  ));
  if (restored) return { outcome:'stand', entry:restored, sourceId:`${restored.cause}:${restored.action}` };
  const used = history.find((entry) => (
    entry.type === 'morning_settlement_use'
    && entry.settlementDay === settlement.day
    && entry.cause === settlement.cause
    && entry.heroine === heroine
  ));
  if (settlement.choice === 'accept_stop' || (settlement.choice === 'narrow_authorization' && used)) {
    return { outcome:'withdraw', entry:used ?? settlement, sourceId:`${settlement.cause}:${settlement.choice}` };
  }
  if (['narrow_authorization', 'publish_gap'].includes(settlement.choice)) {
    return { outcome:'amend', entry:settlement, sourceId:`${settlement.cause}:${settlement.choice}` };
  }
  return null;
}

function crisisRelevantReply(entry, event, heroine) {
  const otherParticipant = (ids) => ids?.find((id) => id !== heroine && event.participants.includes(id)) ?? null;
  if (entry.type === 'route_break' && entry.heroine === heroine) return { outcome:'withdraw', otherHeroine:null };
  if (entry.type === 'house_crisis_reply' && entry.heroine === heroine && CRISIS_REPLY_OUTCOMES.has(entry.outcome)) {
    return { outcome:entry.outcome, otherHeroine:entry.otherHeroine ?? null };
  }
  if (entry.type === 'joint_action' && entry.participants?.includes(heroine)) {
    const otherHeroine = otherParticipant(entry.participants);
    if (otherHeroine) return { outcome:'stand', otherHeroine };
  }
  if (entry.type === 'pair_interlude' && entry.pair?.includes(heroine)) {
    const otherHeroine = otherParticipant(entry.pair);
    if (otherHeroine) return {
      outcome:entry.choice === 'listen' ? 'stand' : entry.choice === 'mediate' ? 'amend' : 'withdraw',
      otherHeroine,
    };
  }
  if (entry.type === 'favor_reckoning' && entry.heroine === heroine) {
    return { outcome:entry.choice === 'honor' ? 'stand' : entry.choice === 'rewrite' ? 'amend' : 'withdraw', otherHeroine:entry.observer ?? null };
  }
  if (entry.type === 'memory_reckoning' && entry.heroine === heroine) {
    return { outcome:entry.choice === 'keep' ? 'stand' : entry.choice === 'rewrite' ? 'amend' : 'withdraw', otherHeroine:entry.observer ?? null };
  }
  if (entry.type === 'accord_term' && entry.heroine === heroine) return { outcome:'stand', otherHeroine:null };
  if (entry.type === 'route_aftermath' && entry.heroine === heroine) {
    return { outcome:entry.choice === 'public' ? 'stand' : 'amend', otherHeroine:entry.observer ?? null };
  }
  if (entry.type === 'day_action' && entry.actor === heroine) return { outcome:'stand', otherHeroine:null };
  return null;
}

function crisisReplySourceId(entry) {
  if (!entry) return 'no_named_precedent';
  return String(entry.event ?? entry.action ?? entry.choice ?? entry.term ?? entry.cause ?? entry.type);
}

function crisisReplyReason(outcome, sourceType, sourceDay, otherHeroine) {
  const partner = otherHeroine ? `与${HEROINES[otherHeroine].short}共同留下的` : '她本人具名的';
  const source = sourceType === 'baseline'
    ? '危局前没有一笔共同执行可供外推'
    : `第${sourceDay}日${partner}${({
      morning_settlement:'晨簿物权', morning_settlement_use:'一次授权用毕', morning_settlement_restore:'具名恢复',
      joint_action:'联院差事', pair_interlude:'双院私议', favor_reckoning:'人情追账', memory_reckoning:'旧话追账',
      accord_term:'院约', route_aftermath:'路线后约', day_action:'白日经手', route_break:'未修越界', house_crisis_reply:'上次危局答复',
    })[sourceType] ?? '具名事实'}`;
  return outcome === 'stand'
    ? `${source}仍然有效；她愿按自己已执行过的范围完整接手。`
    : outcome === 'amend'
      ? `${source}只够支持一次窄授权；她先删掉不能由危局自动扩大的部分。`
      : `${source}使原物仍归本人；她收回的是这次调用，不是被系统判作不忠。`;
}

function crisisReplyFromHistory(history, event, heroine) {
  const morning = crisisMorningReply(history, heroine);
  let outcome = morning?.outcome ?? null;
  let source = morning?.entry ?? null;
  let sourceId = morning?.sourceId ?? null;
  let otherHeroine = null;
  if (!outcome) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const relevant = crisisRelevantReply(history[index], event, heroine);
      if (!relevant) continue;
      outcome = relevant.outcome;
      source = history[index];
      sourceId = crisisReplySourceId(source);
      otherHeroine = relevant.otherHeroine;
      break;
    }
  }
  if (!outcome) outcome = 'amend';
  const sourceType = source?.type ?? 'baseline';
  const sourceDay = Number.isInteger(source?.day) ? source.day : 0;
  const template = HOUSE_CRISIS_RESPONSES[event.type]?.[heroine]?.[outcome];
  return template ? {
    heroine,
    outcome,
    sourceType,
    sourceId:sourceId ?? crisisReplySourceId(source),
    sourceDay,
    otherHeroine,
    reason:crisisReplyReason(outcome, sourceType, sourceDay, otherHeroine),
    ...template,
  } : null;
}

function expectedCrisisResponses(state, event) {
  const history = crisisHistoryBeforeReplies(state, event.event);
  return event.participants.map((heroine) => crisisReplyFromHistory(history, event, heroine));
}

function crisisCandidate(state) {
  if (state.day < 3) return null;
  const act = Math.min(4, Math.ceil(state.day / 5));
  if (state.history.some((entry) => entry.type === 'house_crisis' && entry.act === act)) return null;
  const momentum = pressureMomentum(state);
  const severelyExposed = state.resources.exposure >= 42;
  const nearlyEmpty = state.resources.silver <= 24;
  const householdFailing = state.resources.house <= 24 || state.resources.strain >= 78;
  if (momentum.missed < 3 && !(momentum.missed >= 2 && (severelyExposed || nearlyEmpty || householdFailing))) return null;
  const type = nearlyEmpty ? 'empty_pantry' : severelyExposed ? 'witness_recants' : 'household_walkout';
  return {
    event: `${type}_act${act}`,
    type,
    act,
    triggerFacts:crisisTriggerFacts(state, momentum),
  };
}

function beginCrisis(state) {
  const candidate = crisisCandidate(state);
  return candidate ? { ...candidate, replyBeat:0, replies:[] } : null;
}

export function currentHouseCrisis(state) {
  if (state.phase !== 'crisis' || !state.currentCrisis) return null;
  const expected = crisisCandidate(state);
  const row = state.currentCrisis;
  const template = HOUSE_CRISES[row.type];
  if (!expected || !template
    || row.event !== expected.event
    || row.act !== expected.act
    || (row.triggerFacts !== undefined && JSON.stringify(row.triggerFacts) !== JSON.stringify(expected.triggerFacts))
    || !Number.isInteger(row.replyBeat)
    || row.replyBeat < 0
    || row.replyBeat > template.participants.length
    || !Array.isArray(row.replies)
    || row.replies.length !== row.replyBeat) return null;
  const base = { ...row, triggerFacts:row.triggerFacts ?? expected.triggerFacts, ...template };
  const responses = expectedCrisisResponses(state, base);
  if (responses.some((reply) => !reply)
    || JSON.stringify(row.replies) !== JSON.stringify(responses.slice(0, row.replyBeat).map(crisisReplyStored))) return null;
  const currentReply = responses[row.replyBeat] ?? null;
  return {
    ...base,
    responses,
    previousReplies:responses.slice(0, row.replyBeat),
    currentReply,
    awaitingReply:!!currentReply,
    awaitingAuthorization:row.replyBeat === responses.length,
  };
}

export function advanceHouseCrisisReply(state) {
  const event = currentHouseCrisis(state);
  const reply = event?.currentReply;
  if (!event || !reply) return { ok:false, error:'三个人已经各自处分了本人能带来的物件。' };
  const stored = crisisReplyStored(reply);
  record(state, 'house_crisis_reply', {
    event:event.event, crisis:event.type, act:event.act,
    ...stored,
  });
  state.currentCrisis.replies.push(stored);
  state.currentCrisis.replyBeat += 1;
  state.log.push(`${reply.action} ${reply.line}`);
  return { ok:true, text:`${reply.action} ${reply.line}`, announcement:`${HEROINES[reply.heroine].name}${reply.title}：${reply.line}` };
}

export function houseCrisisOptions(state) {
  const event = currentHouseCrisis(state);
  if (!event?.awaitingAuthorization) return [];
  const replyByHeroine = Object.fromEntries(event.responses.map((reply) => [reply.heroine, reply]));
  const structures = (HOUSE_CRISIS_STRUCTURE_CARDS[event.type] ?? [])
    .filter((structure) => structure.participants.every((heroine) => replyByHeroine[heroine]?.outcome !== 'withdraw'))
    .map((structure) => {
      const scope = structure.participants.every((heroine) => replyByHeroine[heroine]?.outcome === 'stand') ? 'full' : 'bounded';
      const boundaries = structure.participants
        .map((heroine) => replyByHeroine[heroine])
        .filter((reply) => reply.outcome === 'amend')
        .map((reply) => reply.action);
      const effects = structure.effectsByScope[scope];
      const text = [scope === 'full' ? structure.fullText : structure.boundedText, ...boundaries].join(' ');
      const option = {
        id:structure.id,
        kind:'crisis_pair',
        label:structure.label,
        hint:structure.hint,
        text,
        morning:event.pairMorning,
        participants:[...structure.participants],
        scope,
        boundaries,
        effects,
        meta:`${scope === 'full' ? '两人完整接手' : '两人按删改后的窄界接手'} · ${forecastTextFromEffects(effects)}`,
      };
      const unaffordable = cannotAfford(state, option);
      return { ...option, disabled:unaffordable, locked:unaffordable ? costLockedText(option) : '' };
    });
  return [...structures, ...event.choices.map((choice) => {
    const unaffordable = cannotAfford(state, choice);
    return { ...choice, kind:'fallback', meta: forecastTextFromEffects(choice.effects), disabled: unaffordable, locked: unaffordable ? costLockedText(choice) : '' };
  })];
}

function forecastTextFromEffects(effects = {}) {
  return RESOURCE_KEYS.map((key) => effects[key] ? `${({ silver: '银', power: '势', repute: '声', exposure: '露', strain: '耗', house: '宅' })[key]}${effects[key] > 0 ? '+' : ''}${effects[key]}` : '')
    .filter(Boolean).join(' · ');
}

export function resolveHouseCrisis(state, choiceId) {
  const event = currentHouseCrisis(state);
  const choice = houseCrisisOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '这场危机已经翻过去了。' };
  if (choice.disabled) return { ok: false, error: choice.locked || '眼下没有这条救法。' };
  applyEffects(state, choice.effects, null, `宅门危机：${choice.label}`);
  const pair = choice.kind === 'crisis_pair' ? [...choice.participants] : null;
  if (pair) {
    changeBond(state, pair[0], pair[1], 8);
    for (const heroine of pair) changeRel(state, heroine, { qing: 4, du: -4 }, `她与${HEROINES[pair.find((id) => id !== heroine)].short}共同把宅门从崩盘边缘拉了回来`);
  }
  const approach = pair ? 'crisis_pair' : choice.id;
  record(state, 'house_crisis', {
    event:event.event, crisis:event.type, act:event.act,
    triggerFacts:event.triggerFacts,
    choice:approach,
    structureId:pair ? choice.id : null,
    scope:pair ? choice.scope : null,
    pair,
    replies:event.responses.map(crisisReplyStored),
  });
  const text = choice.text;
  state.log.push(text);
  if (state.morning?.notes) state.morning.notes.unshift(choice.morning ?? `危机暂时收住。${text}`);
  state.currentCrisis = null;
  state.crisisAftermath = { event:event.event, crisis:event.type, act:event.act, approach, pair, beat:0, resolution:null };
  state.phase = 'crisis_aftermath';
  return { ok: true, text };
}

function crisisAftermathSpeaker(token, event, pair) {
  if (HEROINE_IDS.includes(token)) return token;
  if (token === 'pair_left') return pair?.[0] ?? event.participants[0];
  if (token === 'pair_right') return pair?.[1] ?? event.participants[1];
  if (token === 'remaining') return event.participants.find((id) => !pair?.includes(id)) ?? event.participants.at(-1);
  return event.participants[0];
}

function formatCrisisAftermathText(text, event, pair) {
  const left = pair?.[0] ?? event.participants[0];
  const right = pair?.[1] ?? event.participants[1];
  const remaining = event.participants.find((id) => !pair?.includes(id)) ?? event.participants.at(-1);
  return String(text)
    .replaceAll('{left}', HEROINES[left]?.short ?? '她')
    .replaceAll('{right}', HEROINES[right]?.short ?? '她')
    .replaceAll('{remaining}', HEROINES[remaining]?.short ?? '她');
}

function crisisSourceRow(state, pending) {
  return [...state.history].reverse().find((entry) => (
    entry.type === 'house_crisis'
    && entry.day === state.day
    && entry.event === pending.event
    && entry.crisis === pending.crisis
    && entry.act === pending.act
  )) ?? null;
}

function crisisApproach(state, event, pending) {
  const source = crisisSourceRow(state, pending);
  if (!source || source.choice !== pending.approach || JSON.stringify(source.pair) !== JSON.stringify(pending.pair)) return null;
  if (pending.approach === 'crisis_pair') {
    const structure = (HOUSE_CRISIS_STRUCTURE_CARDS[event.type] ?? []).find((row) => row.id === source.structureId);
    if (!structure
      || !['full', 'bounded'].includes(source.scope)
      || JSON.stringify(structure.participants) !== JSON.stringify(pending.pair)
      || !Array.isArray(source.replies)
      || source.replies.length !== event.participants.length) return null;
    const replyByHeroine = Object.fromEntries(source.replies.map((reply) => [reply.heroine, reply]));
    const scope = structure.participants.every((heroine) => replyByHeroine[heroine]?.outcome === 'stand') ? 'full' : 'bounded';
    if (scope !== source.scope || structure.participants.some((heroine) => replyByHeroine[heroine]?.outcome === 'withdraw')) return null;
    const boundaries = structure.participants
      .map((heroine) => replyByHeroine[heroine])
      .filter((reply) => reply.outcome === 'amend')
      .map((reply) => HOUSE_CRISIS_RESPONSES[event.type]?.[reply.heroine]?.amend?.action)
      .filter(Boolean);
    return {
      id:'crisis_pair',
      label:structure.label,
      text:[scope === 'full' ? structure.fullText : structure.boundedText, ...boundaries].join(' '),
      structureId:structure.id,
      scope,
      replies:source.replies,
    };
  }
  if (source.structureId !== null || source.scope !== null) return null;
  return event.choices.find((choice) => choice.id === pending.approach) ?? null;
}

export function currentHouseCrisisAftermath(state) {
  if (state.phase !== 'crisis_aftermath' || !state.crisisAftermath) return null;
  const pending = state.crisisAftermath;
  const event = HOUSE_CRISES[pending.crisis];
  const chapter = HOUSE_CRISIS_AFTERMATHS[pending.crisis]?.[pending.approach];
  const approach = event ? crisisApproach(state, event, pending) : null;
  if (!event || !chapter || !approach || pending.event !== `${pending.crisis}_act${pending.act}`) return null;
  if (pending.resolution) {
    const resolution = chapter.choices.find((choice) => choice.id === pending.resolution.choice);
    if (!resolution || formatCrisisAftermathText(resolution.text, event, pending.pair) !== pending.resolution.text) return null;
    return {
      event, approach:pending.approach, pair:pending.pair ? [...pending.pair] : null,
      structureId:approach.structureId ?? null, scope:approach.scope ?? null, replies:approach.replies ?? [],
      participants:[...event.participants], speaker:crisisAftermathSpeaker(resolution.speaker, event, pending.pair),
      beat:3, count:4, awaitingChoice:false, current:{ title:resolution.label, body:pending.resolution.text }, resolution:pending.resolution,
    };
  }
  const source = pending.beat === 0
    ? { speaker:chapter.openingSpeaker, title:approach.label, body:approach.text }
    : chapter.beats[pending.beat - 1];
  return {
    event, approach:pending.approach, pair:pending.pair ? [...pending.pair] : null,
    structureId:approach.structureId ?? null, scope:approach.scope ?? null, replies:approach.replies ?? [],
    participants:[...event.participants], speaker:crisisAftermathSpeaker(source?.speaker, event, pending.pair),
    beat:pending.beat, count:4, awaitingChoice:pending.beat === 2,
    current:source ? { title:source.title, body:formatCrisisAftermathText(source.body, event, pending.pair) } : null,
    resolution:null,
  };
}

export function houseCrisisAftermathOptions(state) {
  const current = currentHouseCrisisAftermath(state);
  if (!current?.awaitingChoice) return [];
  return HOUSE_CRISIS_AFTERMATHS[current.event.type][current.approach].choices.map((choice) => {
    const unaffordable = cannotAfford(state, choice);
    return {
      ...choice,
      text:formatCrisisAftermathText(choice.text, current.event, current.pair),
      disabled:unaffordable,
      locked:unaffordable ? costLockedText(choice) : '',
    };
  });
}

export function advanceHouseCrisisAftermath(state) {
  const current = currentHouseCrisisAftermath(state);
  if (!current) return { ok:false, error:'这场危机的后续没有接上。' };
  if (state.crisisAftermath.resolution) {
    const text = state.crisisAftermath.resolution.text;
    if (state.morning?.notes) state.morning.notes.unshift(`危机后的新规：${text}`);
    state.crisisAftermath = null;
    state.pairInterlude = pairInterludeCandidate(state);
    state.phase = state.pairInterlude ? 'pair_interlude' : 'morning';
    return { ok:true, text };
  }
  if (current.awaitingChoice) return { ok:false, error:'这场危机还等着你决定补救以后怎样执行。' };
  state.crisisAftermath.beat += 1;
  return { ok:true, text:current.current.body };
}

export function resolveHouseCrisisAftermath(state, choiceId) {
  const current = currentHouseCrisisAftermath(state);
  const choice = houseCrisisAftermathOptions(state).find((row) => row.id === choiceId);
  if (!current || !choice) return { ok:false, error:'这不是眼下能落下的危机新规。' };
  if (choice.disabled) return { ok:false, error:choice.locked };
  applyEffects(state, choice.effects, null, `危机收尾：${choice.label}`);
  if (choice.pairBond && current.pair?.length === 2) changeBond(state, current.pair[0], current.pair[1], choice.pairBond);
  record(state, 'house_crisis_aftermath', {
    event:state.crisisAftermath.event, crisis:current.event.type, approach:current.approach,
    choice:choice.id, pair:current.pair, participants:[...current.participants],
  });
  state.crisisAftermath.resolution = { choice:choice.id, text:choice.text };
  state.log.push(choice.text);
  return { ok:true, text:choice.text };
}

function pairInterludeCandidate(state) {
  const seen = new Set(state.history.filter((entry) => entry.type === 'pair_interlude').map((entry) => bondKey(entry.pair[0], entry.pair[1])));
  const candidate = PAIR_IDS
    .filter((id) => !seen.has(id) && PAIR_INTERLUDES[id])
    .map((id) => {
      const [left, right] = id.split('|');
      return { id, left, right, trust: bondValue(state, left, right), score: bondValue(state, left, right) * 3 + state.relations[left].qing + state.relations[right].qing };
    })
    .filter((row) => row.trust >= 12 && state.relations[row.left].qing >= 18 && state.relations[row.right].qing >= 18)
    .sort((left, right) => right.score - left.score)[0];
  return candidate ? { event: PAIR_INTERLUDES[candidate.id].id, pair: [candidate.left, candidate.right], beat: 0, resolution: null } : null;
}

const PAIR_INTERLUDE_CHOICE_LABELS = Object.freeze({
  listen: '让她们自己谈完',
  mediate: '主持一份有限交换',
  claim: '把她们拉回你身边',
});

export function currentPairInterlude(state) {
  if (state.phase !== 'pair_interlude' || !state.pairInterlude) return null;
  const row = state.pairInterlude;
  const key = Array.isArray(row.pair) && row.pair.length === 2 ? bondKey(row.pair[0], row.pair[1]) : null;
  const event = key ? PAIR_INTERLUDES[key] : null;
  if (!event || row.event !== event.id || row.pair[0] !== event.left || row.pair[1] !== event.right) return null;
  const beats = [
    { speaker: event.left, text: event.leftLine },
    { speaker: event.right, text: event.rightLine },
    { speaker: null, text: event.jointLine },
  ];
  if (row.resolution === null) {
    const expected = pairInterludeCandidate(state);
    if (!expected || row.event !== expected.event || JSON.stringify(row.pair) !== JSON.stringify(expected.pair)
      || !Number.isInteger(row.beat) || row.beat < 0 || row.beat >= beats.length) return null;
    return {
      ...row, ...event,
      trust: bondValue(state, event.left, event.right),
      count: beats.length,
      storyBeat: beats[row.beat] ?? null,
      resolutionBeat: null,
    };
  }
  const resolution = row.resolution;
  const aftermath = PAIR_INTERLUDE_AFTERMATHS[key];
  const chapter = aftermath?.variants?.[resolution?.choice];
  const matchingHistory = state.history.some((entry) => entry.type === 'pair_interlude'
    && entry.event === event.id
    && entry.choice === resolution?.choice
    && JSON.stringify(entry.pair) === JSON.stringify(row.pair));
  if (!resolution || Object.keys(resolution).sort().join('\0') !== ['beat', 'choice'].sort().join('\0')
    || !PAIR_INTERLUDE_CHOICE_LABELS[resolution.choice] || !chapter
    || !Number.isInteger(resolution.beat) || resolution.beat < 0 || resolution.beat >= chapter.beats.length + 1
    || row.beat !== beats.length - 1 || !matchingHistory || !HEROINES[aftermath.witness]) return null;
  const resolutionBeats = chapter.beats.map((beat) => {
    const speaker = beat.speaker === 'witness' ? aftermath.witness : null;
    return {
      ...beat,
      speaker,
      speakerName: speaker ? HEROINES[speaker].name : `${HEROINES[event.left].short}与${HEROINES[event.right].short}`,
      speakerHouse: speaker ? HEROINES[speaker].house : `${HEROINES[event.left].house} · ${HEROINES[event.right].house}`,
    };
  });
  resolutionBeats.push({
    speaker: null,
    speakerName: `${HEROINES[event.left].short}与${HEROINES[event.right].short}`,
    speakerHouse: `${HEROINES[event.left].house} · ${HEROINES[event.right].house}`,
    title: chapter.title,
    body: chapter.memory,
  });
  return {
    ...row, ...event,
    trust: bondValue(state, event.left, event.right),
    count: beats.length,
    storyBeat: null,
    resolutionChoice: resolution.choice,
    resolutionLabel: PAIR_INTERLUDE_CHOICE_LABELS[resolution.choice],
    resolutionTitle: chapter.title,
    resolutionMemory: chapter.memory,
    resolutionBeat: resolutionBeats[resolution.beat],
    resolutionBeats,
    resolutionCount: resolutionBeats.length,
    witness: aftermath.witness,
  };
}

export function advancePairInterlude(state) {
  const event = currentPairInterlude(state);
  if (event?.resolutionBeat) {
    if (state.pairInterlude.resolution.beat + 1 < event.resolutionCount) {
      state.pairInterlude.resolution.beat += 1;
      return { ok: true };
    }
    state.log.push(`${event.resolutionTitle}：${event.resolutionMemory}`);
    if (state.morning?.notes) state.morning.notes.unshift(`双院新关系：${event.resolutionMemory}`);
    state.pairInterlude = null;
    state.phase = 'morning';
    return { ok: true };
  }
  if (!event || event.beat >= event.count - 1) return { ok: false, error: '她们已经把问题共同交到你面前。' };
  state.pairInterlude.beat += 1;
  return { ok: true };
}

export function pairInterludeOptions(state) {
  const event = currentPairInterlude(state);
  if (!event || event.beat < event.count - 1) return [];
  return [
    {
      id: 'listen', label: '让她们自己谈完', hint: '不要求两人先证明仍以你为中心',
      text: event.results.listen, meta: '两院互信 +8 · 宅 +2 · 联盟路线', disabled: false,
    },
    {
      id: 'mediate', label: '主持一份有限交换', hint: '明确范围、归期与谁能叫停',
      text: event.results.mediate, meta: '两院互信 +4 · 宅 +5 · 耗 +2', disabled: false,
    },
    {
      id: 'claim', label: '把她们拉回你身边', hint: '两人更在意你，但刚形成的横向关系会后退',
      text: event.results.claim, meta: '两人情欲上升 · 两院互信 -6 · 妒意上升', disabled: false,
    },
  ];
}

export function resolvePairInterlude(state, choiceId) {
  const event = currentPairInterlude(state);
  const choice = pairInterludeOptions(state).find((row) => row.id === choiceId);
  if (!event || !choice) return { ok: false, error: '这场双院夜话已经过去了。' };
  if (choiceId === 'listen') {
    changeBond(state, event.left, event.right, 8);
    changeResources(state, { house: 2 });
    for (const heroine of [event.left, event.right]) changeRel(state, heroine, { qing: 1, du: -3 }, `你让她与${HEROINES[heroine === event.left ? event.right : event.left].short}不经你转述也能把话说完`);
  } else if (choiceId === 'mediate') {
    changeBond(state, event.left, event.right, 4);
    changeResources(state, { house: 5, strain: 2 });
    for (const heroine of [event.left, event.right]) changeRel(state, heroine, { qing: 2, du: -2 }, '你只主持边界，没有替任何一人吞掉答案');
  } else {
    changeBond(state, event.left, event.right, -6);
    changeResources(state, { house: -1 });
    for (const heroine of [event.left, event.right]) changeRel(state, heroine, { qing: 5, yu: 4, du: 3 }, '你把两人刚建立的共同话题重新变成了对你的偏爱竞争');
  }
  record(state, 'pair_interlude', { event: event.event, pair: [event.left, event.right], choice: choiceId });
  state.log.push(choice.text);
  state.pairInterlude.resolution = { choice: choiceId, beat: 0 };
  return { ok: true, text: choice.text };
}

function pairInterludeMemoryFromEntry(entry, heroineId) {
  const key = bondKey(entry.pair[0], entry.pair[1]);
  const event = PAIR_INTERLUDES[key];
  const aftermath = PAIR_INTERLUDE_AFTERMATHS[key];
  const chapter = aftermath?.variants?.[entry.choice];
  const partner = entry.pair.find((id) => id !== heroineId);
  if (!event || entry.event !== event.id || !chapter || !partner || !HEROINES[partner] || !HEROINES[aftermath.witness]) return null;
  return {
    day: entry.day,
    event: entry.event,
    pair:key,
    choice: entry.choice,
    label: PAIR_INTERLUDE_CHOICE_LABELS[entry.choice],
    title: chapter.title,
    memory: chapter.memory,
    partner,
    partnerName:HEROINES[partner].name,
    witness: aftermath.witness,
    witnessName:HEROINES[aftermath.witness].name,
  };
}

export function pairInterludeMemories(state, heroineId) {
  if (!state || !Array.isArray(state.history) || !HEROINE_IDS.includes(heroineId)) return [];
  return state.history
    .filter((entry) => entry.type === 'pair_interlude'
      && Array.isArray(entry.pair)
      && entry.pair.length === 2
      && entry.pair.includes(heroineId))
    .map((entry) => pairInterludeMemoryFromEntry(entry, heroineId))
    .filter(Boolean);
}

export function pairInterludeLedger(state) {
  if (!state || !Array.isArray(state.history)) return [];
  const byPair = new Map();
  for (const entry of state.history.filter((row) => row.type === 'pair_interlude' && Array.isArray(row.pair) && row.pair.length === 2)) {
    const memory = HEROINE_IDS.includes(entry.pair[0]) ? pairInterludeMemoryFromEntry(entry, entry.pair[0]) : null;
    if (!memory) continue;
    byPair.delete(memory.pair);
    byPair.set(memory.pair, {
      ...memory,
      left:entry.pair[0],
      leftName:HEROINES[entry.pair[0]].name,
      right:entry.pair[1],
      rightName:HEROINES[entry.pair[1]].name,
    });
  }
  return [...byPair.values()];
}

export function latestPairInterludeMemory(state, heroineId) {
  return pairInterludeMemories(state, heroineId).at(-1) ?? null;
}

function memoryReckoningBase(state, sourceDay, heroine, sourceChoice, promise) {
  const source = state.history.find((entry) => (
    entry.type === 'route_aftermath'
    && entry.day === sourceDay
    && entry.heroine === heroine
    && entry.sourceChoice === sourceChoice
    && entry.choice === promise
  ));
  const template = ROUTE_RECKONINGS[heroine];
  if (!source || source.day > state.day - 2 || !template?.variants?.[source.choice]) return null;
  return {
    event: template.id,
    heroine: source.heroine,
    observer: source.observer,
    sourceDay: source.day,
    sourceChoice: source.sourceChoice,
    promise: source.choice,
  };
}

function sameMemoryReckoningCore(left, right) {
  return !!left && !!right && ['event', 'heroine', 'observer', 'sourceDay', 'sourceChoice', 'promise']
    .every((key) => left[key] === right[key]);
}

function memoryReckoningCandidate(state) {
  if (state.history.some((entry) => entry.type === 'memory_reckoning' && entry.day === state.day)) return null;
  const paid = new Set(state.history.filter((entry) => entry.type === 'memory_reckoning').map((entry) => entry.heroine));
  const source = state.history.find((entry) => (
    entry.type === 'route_aftermath'
    && entry.day <= state.day - 2
    && !paid.has(entry.heroine)
    && ROUTE_RECKONINGS[entry.heroine]?.variants?.[entry.choice]
  ));
  if (!source) return null;
  const base = memoryReckoningBase(state, source.day, source.heroine, source.sourceChoice, source.choice);
  return base ? { ...base, beat: 0, resolution: null } : null;
}

function favorReckoningBase(state, sourceDay, sourceAction) {
  const source = state.history.find((entry) => (
    entry.type === 'day_action'
    && entry.day === sourceDay
    && entry.action === sourceAction
    && entry.resolution === 'favor'
  ));
  if (!source || source.day > state.day - 2) return null;
  const solution = DAY_FAVOR_SOLUTIONS[source.day - 1];
  if (!solution
    || solution.action !== source.action
    || solution.heroine !== source.favorHeroine
    || solution.observer !== source.favorObserver) return null;
  return {
    event: `favor_${DAY_DEFS[source.day - 1].id}`,
    heroine: solution.heroine,
    observer: solution.observer,
    sourceDay: source.day,
    sourceAction: source.action,
  };
}

function sameFavorReckoningCore(left, right) {
  return !!left && !!right && ['event', 'heroine', 'observer', 'sourceDay', 'sourceAction']
    .every((key) => left[key] === right[key]);
}

function favorReckoningCandidate(state) {
  if (state.history.some((entry) => entry.type === 'favor_reckoning' && entry.day === state.day)) return null;
  const settled = new Set(state.history
    .filter((entry) => entry.type === 'favor_reckoning')
    .map((entry) => `${entry.sourceDay}:${entry.sourceAction}`));
  const source = state.history.find((entry) => (
    entry.type === 'day_action'
    && entry.resolution === 'favor'
    && entry.day <= state.day - 2
    && !settled.has(`${entry.day}:${entry.action}`)
  ));
  if (!source) return null;
  const base = favorReckoningBase(state, source.day, source.action);
  return base ? { ...base, beat: 0, resolution: null } : null;
}

export function activeObligations(state) {
  if (!state || !Array.isArray(state.history)) return [];
  const rows = [];
  const statusFor = (dueDay) => dueDay < state.day ? 'overdue' : dueDay === state.day ? 'due' : 'upcoming';
  const statusLabel = (status, dueDay) => ({
    overdue: `已过第${dueDay}日，今日必须先结`,
    due: '今日到期',
    upcoming: `第${dueDay}日到期`,
  })[status];

  const settledFavor = new Set(state.history
    .filter((entry) => entry.type === 'favor_reckoning')
    .map((entry) => `${entry.sourceDay}:${entry.sourceAction}`));
  for (const source of state.history.filter((entry) => entry.type === 'day_action' && entry.resolution === 'favor')) {
    if (settledFavor.has(`${source.day}:${source.action}`)) continue;
    const solution = DAY_FAVOR_SOLUTIONS[source.day - 1];
    if (!solution || solution.action !== source.action) continue;
    const dueDay = Math.min(MAX_DAY, source.day + 2);
    const status = statusFor(dueDay);
    rows.push({
      id:`favor:${source.day}:${source.action}`, type:'favor', status,
      statusLabel:statusLabel(status, dueDay), sourceDay:source.day, dueDay,
      heroine:solution.heroine, observer:solution.observer,
      label:'人情账', title:solution.debtTitle,
      detail:`${HEROINES[solution.heroine].short}先替全宅押下了代价，${HEROINES[solution.observer].short}会一同到场。`,
    });
  }

  const settledMemory = new Set(state.history
    .filter((entry) => entry.type === 'memory_reckoning')
    .map((entry) => entry.heroine));
  for (const heroine of HEROINE_IDS) {
    if (settledMemory.has(heroine)) continue;
    const source = state.history.find((entry) => (
      entry.type === 'route_aftermath'
      && entry.heroine === heroine
      && entry.day <= MAX_DAY - 2
      && ROUTE_RECKONINGS[heroine]?.variants?.[entry.choice]
    ));
    if (!source) continue;
    const variant = ROUTE_RECKONINGS[heroine].variants[source.choice];
    const act = Math.min(4, Math.ceil(source.day / 5));
    const stake = routeAftermathStake(heroine, act, source.choice);
    const stakeReturn = routeAftermathStakeReturn(heroine, act, source.choice);
    if (!stake || !stakeReturn) continue;
    const dueDay = Math.min(MAX_DAY, source.day + 2);
    const status = statusFor(dueDay);
    rows.push({
      id:`memory:${heroine}`, type:'memory', status,
      statusLabel:statusLabel(status, dueDay), sourceDay:source.day, dueDay,
      heroine, observer:source.observer,
      label:'旧话', title:variant.title,
      detail:`${HEROINES[heroine].short}记着你的“${source.choice === 'public' ? '拿到明处' : source.choice === 'direct' ? '让两院直谈' : '留在门内'}”，当时执行的「${stake.label}」也到了归期：${stakeReturn.question}`,
    });
  }

  for (const heroine of HEROINE_IDS) {
    const reopenDay = state.routeReopensOn?.[heroine] ?? 0;
    if (reopenDay <= state.day) continue;
    rows.push({
      id:`cooldown:${heroine}`, type:'cooldown', status:'locked',
      statusLabel:`第${reopenDay}日重开`, sourceDay:state.day, dueDay:reopenDay,
      heroine, observer:null, label:'冷门', title:`${HEROINES[heroine].house}暂不留门`,
      detail:`${HEROINES[heroine].short}不再接受含糊补偿；先让失信的后果过完这一日。`,
    });
  }

  const priority = { overdue:0, due:1, locked:2, upcoming:3 };
  return rows.sort((left, right) => (
    priority[left.status] - priority[right.status]
    || left.dueDay - right.dueDay
    || left.id.localeCompare(right.id)
  ));
}

export function currentFavorReckoning(state) {
  if (state.phase !== 'favor_reckoning' || !state.favorReckoning) return null;
  const stored = state.favorReckoning;
  const expected = favorReckoningBase(state, stored.sourceDay, stored.sourceAction);
  if (!expected || !sameFavorReckoningCore(stored, expected) || !Number.isInteger(stored.beat) || !inRange(stored.beat, 0, 2)) return null;
  const solution = DAY_FAVOR_SOLUTIONS[expected.sourceDay - 1];
  const move = DAY_AGENDAS[expected.sourceDay - 1]?.actions?.[expected.sourceAction];
  const voices = FAVOR_RECKONINGS[expected.heroine];
  if (!solution || !move || !voices) return null;
  const sourceRows = state.history.filter((entry) => (
    entry.type === 'favor_reckoning'
    && entry.sourceDay === expected.sourceDay
    && entry.sourceAction === expected.sourceAction
  ));
  let resolution = null;
  if (stored.resolution === null) {
    const candidate = favorReckoningCandidate(state);
    if (sourceRows.length || !sameFavorReckoningCore(candidate, expected)) return null;
  } else {
    if (stored.beat !== 2
      || !hasExactKeys(stored.resolution, ['choice', 'text'])
      || !['honor', 'rewrite', 'deny'].includes(stored.resolution.choice)
      || stored.resolution.text !== voices.results[stored.resolution.choice]
      || sourceRows.length !== 1) return null;
    const row = sourceRows[0];
    if (row.day !== state.day
      || row.event !== expected.event
      || row.heroine !== expected.heroine
      || row.observer !== expected.observer
      || row.choice !== stored.resolution.choice) return null;
    resolution = stored.resolution;
  }
  const step = resolution ? 3 : stored.beat;
  const current = resolution
    ? {
        title: {
          honor: '欠账还清，情分不再靠含糊维持',
          rewrite: '旧约拆开，两院重新写下边界',
          deny: '人情被赖掉，下一扇门先冷下来',
        }[resolution.choice],
        body: resolution.text,
      }
    : stored.beat === 0
      ? { title: `${HEROINES[expected.heroine].short}把那日借力原样带回来`, body: voices.heroineLine }
      : stored.beat === 1
        ? { title: `${HEROINES[expected.observer].short}把旁院付掉的代价摆上长案`, body: voices.observerLine }
        : { title: solution.debtTitle, body: solution.debtBody };
  return {
    ...stored,
    count: 4,
    step,
    current,
    speaker: resolution ? null : stored.beat === 0 ? expected.heroine : stored.beat === 1 ? expected.observer : null,
    awaitingChoice: !resolution && stored.beat === 2,
    resolved: !!resolution,
    debtTitle: solution.debtTitle,
    debtBody: solution.debtBody,
    sourceLabel: move.label,
    sourceText: move.text,
    heroineLine: voices.heroineLine,
    observerLine: voices.observerLine,
    daysLater: state.day - expected.sourceDay,
    results: voices.results,
  };
}

export function favorReckoningOptions(state) {
  const event = currentFavorReckoning(state);
  if (!event?.awaitingChoice) return [];
  return [
    {
      id: 'honor', label: '把欠下的人、名与银一并补上',
      hint: `公开认领当日借力，付${silverText(FAVOR_HONOR_COST)}两补实际损耗`,
      meta: `银-${FAVOR_HONOR_COST} · 她与旁院互信 +4 · 宅 +3`,
      text: event.results.honor,
      disabled: state.resources.silver < FAVOR_HONOR_COST,
    },
    {
      id: 'rewrite', label: '承认旧还法不够，和两院重谈',
      hint: '不抹掉当日借力，把新出现的损失、期限与退出权补进来',
      meta: '耗 +3 · 两院互信 +1 · 两人情分小升',
      text: event.results.rewrite,
      disabled: false,
    },
    {
      id: 'deny', label: '说她当日本就该替宅里做',
      hint: '不付眼前代价；她会收回下一次替你破局的权限',
      meta: '宅 -6 · 两院互信 -8 · 她的门冷两日',
      text: event.results.deny,
      disabled: false,
    },
  ];
}

export function resolveFavorReckoning(state, choiceId) {
  const event = currentFavorReckoning(state);
  const choice = favorReckoningOptions(state).find((row) => row.id === choiceId);
  if (!event?.awaitingChoice || !choice) return { ok: false, error: '先让两院把这笔人情的来路与代价说完。' };
  if (choice.disabled) return { ok: false, error: `手里凑不出补损耗的${silverText(FAVOR_HONOR_COST)}两。` };
  const { heroine, observer } = event;
  if (choiceId === 'honor') {
    changeResources(state, { silver: -FAVOR_HONOR_COST, house: 3, exposure: 1 });
    changeBond(state, heroine, observer, 4);
    changeRel(state, heroine, { qing: 6, du: -6 }, '你在两日后仍把她替全宅先付的代价逐项还清');
    changeRel(state, observer, { qing: 3, du: -4 }, `你没有叫${HEROINES[heroine].short}独自吞下那日借力的后果`);
  } else if (choiceId === 'rewrite') {
    changeResources(state, { house: 2, strain: 3 });
    changeBond(state, heroine, observer, 1);
    changeRel(state, heroine, { qing: 3, du: -2 }, '你承认原来的还法不足，并让她参与重写');
    changeRel(state, observer, { qing: 2, du: -2 }, '她被允许把自己真正承担的损失补进新约');
  } else {
    changeResources(state, { house: -6 });
    changeBond(state, heroine, observer, -8);
    changeRel(state, heroine, { qing: -9, du: 13 }, '你把她替全宅先押出去的东西说成分内之事');
    changeRel(state, observer, { du: 7 }, `她看见你用完${HEROINES[heroine].short}的人情便不再认账`);
    state.routeReopensOn[heroine] = Math.max(state.routeReopensOn[heroine], state.day + 2);
  }
  record(state, 'favor_reckoning', {
    event: event.event,
    heroine,
    observer,
    sourceDay: event.sourceDay,
    sourceAction: event.sourceAction,
    choice: choiceId,
  });
  state.log.push(choice.text);
  state.favorReckoning.resolution = { choice: choiceId, text: choice.text };
  return { ok: true, text: choice.text };
}

export function advanceFavorReckoning(state) {
  const event = currentFavorReckoning(state);
  if (!event) return { ok: false, error: '这笔人情债已经找不到当日借力的原页。' };
  if (event.resolved) {
    state.favorReckoning = null;
    state.memoryReckoning = memoryReckoningCandidate(state);
    state.phase = state.memoryReckoning ? 'memory_reckoning' : ACT_TRANSITIONS[state.day] ? 'act_transition' : 'day';
    return { ok: true };
  }
  if (event.awaitingChoice) return { ok: false, error: '两院都已把话说完，轮到你裁决这笔人情。' };
  state.favorReckoning.beat += 1;
  return { ok: true };
}

function favorReckoningMemoryFromResolution(state, heroineId, resolution) {
  if (!Number.isInteger(resolution.sourceDay)
    || resolution.sourceDay < 1
    || resolution.sourceDay > MAX_DAY - 2
    || !['honor', 'rewrite', 'deny'].includes(resolution.choice)) return null;
  const source = state.history.find((entry) => (
    entry.type === 'day_action'
    && entry.day === resolution.sourceDay
    && entry.action === resolution.sourceAction
    && entry.resolution === 'favor'
    && entry.favorHeroine === heroineId
    && entry.favorObserver === resolution.observer
  ));
  const solution = DAY_FAVOR_SOLUTIONS[resolution.sourceDay - 1];
  const move = DAY_AGENDAS[resolution.sourceDay - 1]?.actions?.[resolution.sourceAction];
  const voices = FAVOR_RECKONINGS[heroineId];
  const event = `favor_${DAY_DEFS[resolution.sourceDay - 1]?.id}`;
  if (!source || !solution || !move || !voices
    || resolution.event !== event
    || resolution.heroine !== heroineId
    || resolution.observer !== solution.observer
    || resolution.sourceAction !== solution.action
    || source.favorHeroine !== solution.heroine
    || source.favorObserver !== solution.observer
    || !HEROINES[resolution.observer]
    || typeof voices.results[resolution.choice] !== 'string') return null;
  return {
    event,
    day:resolution.day,
    sourceDay:resolution.sourceDay,
    heroine:heroineId,
    observer:resolution.observer,
    observerName:HEROINES[resolution.observer].name,
    sourceAction:resolution.sourceAction,
    sourceLabel:move.label,
    sourceText:move.text,
    debtTitle:solution.debtTitle,
    debtBody:solution.debtBody,
    heroineLine:voices.heroineLine,
    observerLine:voices.observerLine,
    choice:resolution.choice,
    choiceLabel:FAVOR_RECKONING_CHOICE_LABELS[resolution.choice],
    outcome:voices.results[resolution.choice],
  };
}

export function favorReckoningMemories(state, heroineId) {
  if (!state || !Array.isArray(state.history) || !HEROINE_IDS.includes(heroineId)) return [];
  return state.history
    .filter((entry) => (
      entry.type === 'favor_reckoning'
      && entry.heroine === heroineId
      && ['honor', 'rewrite', 'deny'].includes(entry.choice)
    ))
    .map((resolution) => favorReckoningMemoryFromResolution(state, heroineId, resolution))
    .filter(Boolean);
}

export function latestFavorReckoningMemory(state, heroineId) {
  return favorReckoningMemories(state, heroineId).at(-1) ?? null;
}

export function currentMemoryReckoning(state) {
  if (state.phase !== 'memory_reckoning' || !state.memoryReckoning) return null;
  const stored = state.memoryReckoning;
  const expected = memoryReckoningBase(state, stored.sourceDay, stored.heroine, stored.sourceChoice, stored.promise);
  if (!expected || !sameMemoryReckoningCore(stored, expected) || !Number.isInteger(stored.beat) || !inRange(stored.beat, 0, 2)) return null;
  const template = ROUTE_RECKONINGS[expected.heroine];
  const variant = template?.variants?.[expected.promise];
  const source = [...allRouteChoices(expected.heroine), ACCORD_CHOICES[expected.heroine]]
    .find((choice) => choice?.id === expected.sourceChoice);
  const sourceStake = routeAftermathStake(
    expected.heroine,
    Math.min(4, Math.ceil(expected.sourceDay / 5)),
    expected.promise,
  );
  const sourceReturn = routeAftermathStakeReturn(
    expected.heroine,
    Math.min(4, Math.ceil(expected.sourceDay / 5)),
    expected.promise,
  );
  if (!template || !variant || !source || !sourceStake || !sourceReturn) return null;
  const sourceRows = state.history.filter((entry) => entry.type === 'memory_reckoning' && entry.heroine === expected.heroine);
  let resolution = null;
  if (stored.resolution === null) {
    const candidate = memoryReckoningCandidate(state);
    if (sourceRows.length || !sameMemoryReckoningCore(candidate, expected)) return null;
  } else {
    if (stored.beat !== 2
      || !hasExactKeys(stored.resolution, ['choice', 'text'])
      || !['keep', 'rewrite', 'deny'].includes(stored.resolution.choice)
      || stored.resolution.text !== template.results[stored.resolution.choice]
      || sourceRows.length !== 1) return null;
    const row = sourceRows[0];
    if (row.day !== state.day
      || row.event !== expected.event
      || row.observer !== expected.observer
      || row.sourceDay !== expected.sourceDay
      || row.sourceChoice !== expected.sourceChoice
      || row.promise !== expected.promise
      || row.choice !== stored.resolution.choice) return null;
    resolution = stored.resolution;
  }
  const step = resolution ? 3 : stored.beat;
  const current = resolution
    ? {
        title: {
          keep: '旧话兑现，两院开始按它继续生活',
          rewrite: '旧话没有抹掉，新边界在原页之后落笔',
          deny: '口头应允失效，她们改用自己的办法自保',
        }[resolution.choice],
        body: `${resolution.text} ${sourceReturn.results[resolution.choice]}`,
      }
    : stored.beat === 0
      ? { title: `${HEROINES[expected.heroine].short}先把你两日前的话逐字念回`, body: `${variant.heroineLine} ${sourceReturn.returnText}` }
      : stored.beat === 1
        ? { title: `${HEROINES[expected.observer].short}指出这句承诺落到旁院后的代价`, body: sourceReturn.observerText }
        : { title: variant.title, body: `${variant.body} ${sourceReturn.question}` };
  return {
    ...stored,
    count: 4,
    step,
    current,
    speaker: resolution ? null : stored.beat === 0 ? expected.heroine : stored.beat === 1 ? expected.observer : null,
    awaitingChoice: !resolution && stored.beat === 2,
    resolved: !!resolution,
    kicker: template.kicker,
    ...variant,
    heroineName: HEROINES[expected.heroine].name,
    observerName: HEROINES[expected.observer].name,
    sourceLabel: source.label,
    sourceText: source.text,
    sourceStake,
    sourceReturn,
    daysLater: state.day - expected.sourceDay,
    results: template.results,
  };
}

export function memoryReckoningOptions(state) {
  const event = currentMemoryReckoning(state);
  if (!event?.awaitingChoice) return [];
  const promise = {
    public: '你答应过把经手与代价留在明处',
    direct: '你答应过不再替两院转述和裁决',
    private: '你答应过承担把后果留在门内的代价',
  }[event.promise];
  return [
    {
      id: 'keep', label: '照原话兑现', hint: `${event.sourceReturn.question} ${promise}`,
      meta: event.promise === 'private' ? '个人关系更深 · 旁院会看见偏爱成本' : '守信 · 两院互信与宅门上升',
      text: event.results.keep, disabled: false,
    },
    {
      id: 'rewrite', label: '承认旧约不够，重谈', hint: event.sourceReturn.question,
      meta: '宅门更稳 · 关系温和上升 · 耗损 +2', text: event.results.rewrite, disabled: false,
    },
    {
      id: 'deny', label: '说那晚不作数', hint: event.sourceReturn.question,
      meta: '守信破裂 · 两院互信下降 · 她的门冷一日', text: event.results.deny, disabled: false,
    },
  ];
}

export function resolveMemoryReckoning(state, choiceId) {
  const event = currentMemoryReckoning(state);
  const choice = memoryReckoningOptions(state).find((row) => row.id === choiceId);
  if (!event?.awaitingChoice || !choice) return { ok: false, error: '先把她们记住的原话与旁院代价听完。' };
  const { heroine, observer, promise } = event;
  if (choiceId === 'keep') {
    if (promise === 'public') {
      changeResources(state, { house: 5, exposure: 2 });
      changeBond(state, heroine, observer, 4);
      changeRel(state, heroine, { qing: 5, du: -5 }, '你在两日后仍肯让那句公开承诺约束自己');
      changeRel(state, observer, { qing: 2, du: -4 }, `你没有只在${HEROINES[heroine].short}门内认下公开责任`);
    } else if (promise === 'direct') {
      changeResources(state, { house: 4 });
      changeBond(state, heroine, observer, 7);
      changeRel(state, heroine, { qing: 3, du: -4 }, `你没有夺回她与${HEROINES[observer].short}已经谈定的裁量`);
      changeRel(state, observer, { qing: 3, du: -5 }, '两日前的直接交谈没有被你事后推翻');
    } else {
      changeResources(state, { house: -1, exposure: 4 });
      changeBond(state, heroine, observer, -2);
      changeRel(state, heroine, { qing: 7, yu: 4, du: -3 }, '你在代价找上门时仍认下只许给她的偏爱');
      changeRel(state, observer, { du: 4 }, `${HEROINES[heroine].short}门内的承诺由你公开承担了后果`);
    }
  } else if (choiceId === 'rewrite') {
    changeResources(state, { house: 3, strain: 2 });
    changeBond(state, heroine, observer, 2);
    changeRel(state, heroine, { qing: 2, du: -2 }, '你没有抹掉旧话，而是承认它不足以处理今日的新代价');
    changeRel(state, observer, { qing: 2, du: -3 }, '她被允许参与重写会影响自己的边界');
  } else {
    changeResources(state, { house: -6 });
    changeBond(state, heroine, observer, -7);
    changeRel(state, heroine, { qing: -10, du: 14 }, '你当面否认了两日前仍被她记着的应允');
    changeRel(state, observer, { du: 7 }, `她亲眼看见你让${HEROINES[heroine].short}独自吞下旧话`);
    state.routeReopensOn[heroine] = Math.max(state.routeReopensOn[heroine], state.day + 2);
  }
  record(state, 'memory_reckoning', {
    event: event.event, heroine, observer, sourceDay: event.sourceDay,
    sourceChoice: event.sourceChoice, promise, choice: choiceId,
  });
  const resolvedText = `${choice.text} ${event.sourceReturn.results[choiceId]}`;
  state.log.push(resolvedText);
  state.memoryReckoning.resolution = { choice: choiceId, text: choice.text };
  return { ok: true, text: resolvedText };
}

export function advanceMemoryReckoning(state) {
  const event = currentMemoryReckoning(state);
  if (!event) return { ok: false, error: '这笔旧话已经没有人在等你回应。' };
  if (event.resolved) {
    state.memoryReckoning = null;
    state.phase = ACT_TRANSITIONS[state.day] ? 'act_transition' : 'day';
    return { ok: true };
  }
  if (event.awaitingChoice) return { ok: false, error: '两个人都把话说完了，轮到你决定旧约是否还算数。' };
  state.memoryReckoning.beat += 1;
  return { ok: true };
}

function routeReckoningMemoryFromResolution(state, heroineId, resolution) {
  const source = state.history.find((entry) => (
    entry.type === 'route_aftermath'
    && entry.day === resolution.sourceDay
    && entry.heroine === heroineId
    && entry.observer === resolution.observer
    && entry.sourceChoice === resolution.sourceChoice
    && entry.choice === resolution.promise
  ));
  const act = Number.isInteger(resolution.sourceDay) ? Math.min(4, Math.ceil(resolution.sourceDay / 5)) : 0;
  const sourceChoice = [...allRouteChoices(heroineId), ACCORD_CHOICES[heroineId]]
    .find((choice) => choice?.id === resolution.sourceChoice);
  const stake = routeAftermathStake(heroineId, act, resolution.promise);
  const sourceReturn = routeAftermathStakeReturn(heroineId, act, resolution.promise);
  const variant = ROUTE_RECKONINGS[heroineId]?.variants?.[resolution.promise];
  if (!source || !sourceChoice || !stake || !sourceReturn || !variant || !HEROINES[resolution.observer]) return null;
  return {
    event:resolution.event,
    day:resolution.day,
    sourceDay:resolution.sourceDay,
    act,
    heroine:heroineId,
    observer:resolution.observer,
    observerName:HEROINES[resolution.observer].name,
    sourceChoice:resolution.sourceChoice,
    sourceLabel:sourceChoice.label,
    promise:resolution.promise,
    promiseLabel:ROUTE_AFTERMATH_CHOICE_LABELS[resolution.promise],
    choice:resolution.choice,
    choiceLabel:MEMORY_RECKONING_CHOICE_LABELS[resolution.choice],
    title:variant.title,
    stakeLabel:stake.label,
    stakeText:stake.text,
    stakeResourceText:stake.resourceText,
    incident:sourceReturn.returnText,
    observerText:sourceReturn.observerText,
    question:sourceReturn.question,
    outcome:sourceReturn.results[resolution.choice],
  };
}

export function routeReckoningMemories(state, heroineId) {
  if (!state || !Array.isArray(state.history) || !HEROINE_IDS.includes(heroineId)) return [];
  return state.history
    .filter((entry) => (
      entry.type === 'memory_reckoning'
      && entry.heroine === heroineId
      && ['keep', 'rewrite', 'deny'].includes(entry.choice)
    ))
    .map((resolution) => routeReckoningMemoryFromResolution(state, heroineId, resolution))
    .filter(Boolean);
}

export function latestRouteReckoningMemory(state, heroineId) {
  return routeReckoningMemories(state, heroineId).at(-1) ?? null;
}

function morningSettlementSource(state, cause) {
  const actions = cause === 'upkeep_short' ? new Set(['banquet']) : new Set(['office', 'listen']);
  const row = [...state.history].reverse().find((entry) => (
    entry.type === 'day_action'
    && entry.day < state.day
    && actions.has(entry.action)
    && HEROINE_IDS.includes(entry.actor)
  ));
  return row ? { sourceDay:row.day, sourceType:'day_action', sourceId:row.action, heroine:row.actor } : null;
}

function morningSettlementCandidate(state, settlement) {
  // 一次只处理一项真实缺口。旧物件尚未具名补回时，不再叠加第二道行动锁，
  // 避免把“谁承担”重新做成系统暗中封死全部白日动词。
  if (activeMorningSettlementRows(state).length) return null;
  const rows = state.history.filter((entry) => entry.type === 'morning_settlement');
  const lastDay = rows.at(-1)?.day ?? -10;
  const causes = [];
  if (settlement.upkeep.short > 0 && !rows.some((row) => row.cause === 'upkeep_short')) causes.push('upkeep_short');
  if (settlement.exposure.applied && !rows.some((row) => row.cause === 'exposure_fee')) causes.push('exposure_fee');
  if (!causes.length || state.day - lastDay < 2) return null;
  for (const cause of causes) {
    const source = morningSettlementSource(state, cause);
    if (source) return { event:MORNING_SETTLEMENTS.id, cause, ...source, choice:null };
  }
  return null;
}

function morningSettlementBasis(state) {
  const history = [...state.history];
  const overrides = Object.fromEntries(HEROINE_IDS.map((id) => [id, 0]));
  for (const entry of history.filter((row) => row.type === 'visit_choice')) {
    for (const flag of routeChoiceById(entry.heroine, entry.choice)?.effects?.flags ?? []) {
      const heroine = OVERRIDE_FLAG_TO_HEROINE[flag];
      if (heroine) overrides[heroine] += 1;
    }
  }
  return { history, overrides };
}

function morningSettlementNarrowAuthorized(state, heroine) {
  const accord = FIVE_PRICE_ACCORD[heroine];
  const sourceIsNamed = state.morningSettlement?.sourceType === 'day_action'
    && state.morningSettlement?.heroine === heroine
    && state.history.some((entry) => entry.type === 'day_action'
      && entry.day === state.morningSettlement.sourceDay
      && entry.action === state.morningSettlement.sourceId
      && entry.actor === heroine);
  return (!!accord && !!state.accords?.[accord] || sourceIsNamed)
    && !fivePriceUnresolvedBreak(morningSettlementBasis(state), heroine);
}

function morningSettlementSourceText(pending) {
  const move = DAY_AGENDAS[pending.sourceDay - 1]?.actions?.[pending.sourceId];
  const consequence = pending.cause === 'upkeep_short'
    ? '这场具名席面抬高的日用仍在今晨账里'
    : '这次具名见光留下的抄录与见证仍在今晨认价';
  return move ? `第${pending.sourceDay}日“${move.label}”——${consequence}` : `第${pending.sourceDay}日白日行动——${consequence}`;
}

export function currentMorningSettlement(state) {
  const pending = state?.morningSettlement;
  if (state?.phase !== 'morning_settlement' || !pending || pending.event !== MORNING_SETTLEMENTS.id) return null;
  if (!MORNING_SETTLEMENT_CAUSES.has(pending.cause)
    || pending.sourceType !== 'day_action'
    || !Number.isInteger(pending.sourceDay)
    || pending.sourceDay < 1
    || pending.sourceDay >= state.day
    || !['ledger','office','listen','banquet'].includes(pending.sourceId)
    || !HEROINE_IDS.includes(pending.heroine)
    || (pending.choice !== null && !MORNING_SETTLEMENT_CHOICE_IDS.has(pending.choice))) return null;
  const heroine = MORNING_SETTLEMENTS.heroines[pending.heroine];
  const cause = MORNING_SETTLEMENTS.causes[pending.cause];
  if (!heroine || !cause) return null;
  const choice = pending.choice ? MORNING_SETTLEMENTS.choices.find((row) => row.id === pending.choice) : null;
  const resolution = choice ? MORNING_SETTLEMENTS.resolutions[pending.heroine]?.[pending.cause]?.[choice.id] : null;
  if (choice && !resolution) return null;
  const steps = !choice ? [] : choice.id === 'accept_stop'
    ? [heroine.restriction.text, heroine.recovery.text]
    : choice.id === 'narrow_authorization'
      ? [heroine.narrow.limit, `这一物用过即停；${heroine.recovery.label}必须另日完成，不能把一次授权冒充已经恢复。`]
      : [`${heroine.object}仍归本人；${heroine.restriction.label}不再全面停用，但每次硬办都会额外增加四点曝光。`, heroine.recovery.text];
  const imageLabel = !choice
    ? `${HEROINES[pending.heroine].name}亲手收回${heroine.object}`
    : choice.id === 'accept_stop'
      ? `${HEROINES[pending.heroine].name}已经把${heroine.object}收回本人手中`
      : choice.id === 'narrow_authorization'
        ? `${HEROINES[pending.heroine].name}把一次授权写入晨簿，${heroine.object}仍由本人保管`
        : `${HEROINES[pending.heroine].name}把${heroine.object}的归属与缺口公开留名`;
  return {
    ...pending,
    title:cause.title,
    kicker:cause.kicker,
    body:cause.body,
    heroine:{ id:pending.heroine, ...heroine },
    sourceText:morningSettlementSourceText(pending),
    awaitingChoice:pending.choice === null,
    resolved:pending.choice !== null,
    choice,
    resolution,
    steps,
    imageLabel,
  };
}

export function morningSettlementOptions(state) {
  const current = currentMorningSettlement(state);
  if (!current?.awaitingChoice) return [];
  const authorized = morningSettlementNarrowAuthorized(state, current.heroine.id);
  return MORNING_SETTLEMENTS.choices.map((choice) => {
    const exposureFee = current.cause === 'exposure_fee';
    const meta = choice.id === 'accept_stop'
      ? exposureFee ? '行动暂停 · 每晨不再暗付十五两封口银' : '行动暂停 · 次夜停项日用减六'
      : choice.id === 'narrow_authorization'
        ? exposureFee ? '只用一次后暂停 · 每晨封口银仍会结转' : '只用一次后暂停 · 日用仍照常结转'
        : exposureFee
          ? '立即露 +6 · 声 -1 · 每次再露 +4 · 每晨不再暗付十五两'
          : '立即露 +6 · 声 -1 · 每次再露 +4 · 日用仍照常结转';
    return {
      ...choice,
      meta,
      disabled:choice.id === 'narrow_authorization' && !authorized,
      locked:choice.id === 'narrow_authorization' && !authorized
        ? `${HEROINES[current.heroine.id].short}没有留下可核的旧授权，或最近一次越界仍未修回；你不能替她补出一次许可。`
        : '',
    };
  });
}

export function chooseMorningSettlement(state, choiceId) {
  const current = currentMorningSettlement(state);
  const choice = morningSettlementOptions(state).find((row) => row.id === choiceId);
  if (!current || !choice) return { ok:false, error:'这不是眼下能写进晨簿的结法。' };
  if (choice.disabled) return { ok:false, error:choice.locked };
  applyEffects(state, choice.effects, null, `晨簿落名：${choice.label}`);
  record(state, 'morning_settlement', {
    event:MORNING_SETTLEMENTS.id,
    cause:current.cause,
    sourceDay:current.sourceDay,
    sourceType:current.sourceType,
    sourceId:current.sourceId,
    heroine:current.heroine.id,
    object:current.heroine.object,
    restriction:current.heroine.restriction.action,
    recovery:current.heroine.recovery.action,
    choice:choice.id,
  });
  state.morningSettlement.choice = choice.id;
  const resolved = currentMorningSettlement(state);
  state.log.push(resolved?.resolution?.body ?? choice.body);
  const consequence = choice.id === 'accept_stop'
    ? `${current.heroine.restriction.label}已经生效，对应无名滚账也从下一夜停下。`
    : choice.id === 'narrow_authorization'
      ? `一次授权已经写明，等待下一次“${current.heroine.restriction.label}”使用；用后立即停下，仍须${current.heroine.recovery.label}。`
      : `${current.heroine.object}仍归本人；同类行动可以继续，但每次额外增加四点曝光，仍须${current.heroine.recovery.label}。`;
  return { ok:true, text:resolved?.resolution?.body ?? choice.body, announcement:`${HEROINES[current.heroine.id].short}已经亲手处分${current.heroine.object}。${resolved?.resolution?.title ?? choice.resultTitle}。${consequence}` };
}

export function advanceMorningSettlement(state) {
  const current = currentMorningSettlement(state);
  if (!current) return { ok:false, error:'这页晨簿已经断了。' };
  if (!current.resolved) return { ok:false, error:'她已经收回本人之物，先决定宅子怎样承认这道缺口。' };
  state.morningSettlement = null;
  // 晨簿裁决本身可能改变露与家声，从而改变今晨真正爆发的是哪一种危机。
  // 不沿用结算前的候选，否则 currentCrisis 会与当前资源事实脱节，危机页也会
  // 因无法重建而没有任何可选处置。
  state.currentCrisis = beginCrisis(state);
  state.phase = state.currentCrisis ? 'crisis' : state.pairInterlude ? 'pair_interlude' : 'morning';
  return { ok:true, announcement:`${current.resolution.title}。这项限制会留在下一张白日行动卡上，直到${current.heroine.recovery.label}具名补回。` };
}

function advanceAfterNight(state) {
  const visited = state.currentHeroine;
  const nightAction = [...state.history].reverse().find((entry) => entry.type === 'night' && entry.day === state.day)?.action;
  const baseRise = { leave: 2, talk: 5, prelude: 7, explicit: 10 }[nightAction] ?? 5;
  for (const id of HEROINE_IDS) {
    if (id === visited) setIgnored(state, id, 0);
    else {
      setIgnored(state, id, state.relations[id].ignored + 1);
      const rise = jealousyRise(state, id, visited, baseRise);
      changeRel(state, id, { du:rise }, `${HEROINES[id].short}与${HEROINES[visited].short}${bondTier(bondValue(state, id, visited))}，你第${state.day}日去了${HEROINES[visited].house}`);
    }
  }
  state.currentHeroine = null;
  state.selectedDayAction = null;
  if (state.day >= MAX_DAY) {
    const candidate = determineEnding(state);
    if (candidate.id === 'exclusive' && candidate.heroine === visited && startPersonalFinale(state, visited)) return;
    if (['intrigue', 'unstable'].includes(candidate.id)) {
      beginCollapseFinale(state, candidate.id, 'visit', candidate);
      return;
    }
    state.ending = candidate;
    state.phase = 'ending';
    state.over = true;
    return;
  }
  state.day += 1;
  const upkeep = applyUpkeep(state);
  const notes = [upkeep];
  if (state.day === COLLECTOR_WARNING_DAY) notes.push({ type: 'collector_warning' });
  if (state.day === COLLECTOR_DUE_DAY + 1) notes.push(settleCollector(state));
  const exposure = applyExposurePressure(state);
  if (exposure.applied) notes.push(exposure);
  state.morning = buildMorning(state, visited, notes);
  state.currentCrisis = beginCrisis(state);
  state.pairInterlude = state.currentCrisis ? null : pairInterludeCandidate(state);
  state.morningSettlement = morningSettlementCandidate(state, { upkeep, exposure });
  state.phase = state.morningSettlement ? 'morning_settlement' : state.currentCrisis ? 'crisis' : state.pairInterlude ? 'pair_interlude' : 'morning';
}

// 每日结转先扣宅中用度:6 + 声望×3。家声从此是要养的资产——
// 整席面添的每一点声望,都让后面每一天更贵。
function applyUpkeep(state) {
  const r = state.resources;
  const relief = morningSettlementRelief(state, 'upkeep_short').upkeep;
  const cost = Math.max(0, UPKEEP_BASE + r.repute * UPKEEP_PER_REPUTE - relief);
  const paid = Math.min(r.silver, cost);
  changeResources(state, { silver:-paid });
  if (paid < cost) {
    changeResources(state, { house: -4, repute: -1 });
    record(state, 'upkeep_short', { cost, paid });
  }
  state.log.push(upkeepText(cost, paid, relief));
  return { type: 'upkeep', cost, paid, short:cost - paid, relief };
}

// 第 4 日结转收账:四十两了结;拿不出,他就闹上门,宅门、暴露与五人的妒一起涨。
function settleCollector(state) {
  if (state.resources.silver >= COLLECTOR_PRICE) {
    changeResources(state, { silver:-COLLECTOR_PRICE });
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

function upkeepText(cost, paid, relief = 0) {
  const reliefText = relief ? ` 晨簿停下的一类差事让本夜少滚入${silverText(relief)}两无名用度；这不是添银，只是没有继续做那项活。` : '';
  if (paid >= cost) return `天还没亮，灶上、门房和针线房已从柜上支走${silverText(cost)}两，这宅子才又像什么都没发生过一样转起来。${reliefText}`;
  if (paid > 0) return `灶上、门房和针线房一早要${silverText(cost)}两，柜上却只抹出${silverText(paid)}两。锅里少一道菜，门前少一张笑脸，穷先从最看得见的地方露出来。${reliefText}`;
  return `灶上、门房和针线房一早要${silverText(cost)}两，柜上却连一块碎银都摸不出。门房去了一半，灶火也比往日冷得早。${reliefText}`;
}

function collectorText(paid) {
  return paid
    ? `催账人当着门房的面点走${silverText(COLLECTOR_PRICE)}两，又故意将“两讫”说得满院都听得见，这才掏掏袖子走了。`
    : '催账人没见到银子，索性坐在门槛上将数目唱了半条街。邻里的窗一扇扇开了，宅里的门却一扇扇关上。';
}

// 曝光每日结转(F3):高曝光从这夜起开始咬人,三档全部落在场面上。
// ≥25 门房替你打发打听的人,封口钱日扣十五两;≥40 闲话传进院,五人都记一笔妒;
// ≥55 的第三档(官面与公开同盟关门)在 dayOptions()/banquetOptions() 里读。
function applyExposurePressure(state) {
  const exposure = state.resources.exposure;
  const relief = morningSettlementRelief(state, 'exposure_fee');
  let paid = 0;
  const jealousy = {};
  if (exposure >= EXPOSURE_STREET && !relief.feeWaivedBy) {
    paid = Math.min(state.resources.silver, 15);
    changeResources(state, { silver: -paid });
    state.log.push(`门房今早又拦下一个来问昨夜门灯的人。他从柜上实领${silverText(paid)}两；不足十五两的那一截，没有谁可以再拿五院私物悄悄补齐。`);
  } else if (exposure >= EXPOSURE_STREET) {
    state.log.push(`${HEROINES[relief.feeWaivedBy.heroine].short}已经把${relief.feeWaivedBy.object}的缺口具名留在晨簿；门房今早不再暗领十五两封口银，来问的人只能看见这项仍未恢复的限制。`);
  }
  if (exposure >= EXPOSURE_HOUSEHOLD) {
    const source = morningSettlementSource(state, 'exposure_fee');
    for (const id of HEROINE_IDS) {
      const delta = !source ? 4 : id === source.heroine ? 2 : bondValue(state, id, source.heroine) >= 10 ? 2 : bondValue(state, id, source.heroine) >= 0 ? 4 : 6;
      jealousy[id] = delta;
      changeRel(state, id, { du: delta }, source
        ? `第${source.sourceDay}日${HEROINES[source.heroine].short}经手的见光办法仍在院外发酵；她们按彼此互信承受不同后果`
        : '外头的话传进院里，却找不到一名可核的具名经手');
    }
  }
  return { type:'exposure', applied:exposure >= EXPOSURE_STREET, exposure, due:exposure >= EXPOSURE_STREET ? 15 : 0, paid, jealousy, waived:!!relief.feeWaivedBy };
}

// 晨间画面 = 昨夜回响 + 结转报条。报条落在现场画面上(灶上、门房、门外的人),
// 不写账单术语;玩家在第 3 日晨就能看见催账口风,还有机会用白日动作备银。
function buildMorning(state, visited, notes = []) {
  const event = pickMorningEvent(state, visited);
  if (event.id === 'jealousy') event.visited = visited;
  if (event.id === 'rivalry') event.beat = 0;
  event.notes = notes.map((note) => {
    if (note.type === 'upkeep') return upkeepText(note.cost, note.paid, note.relief);
    if (note.type === 'collector') return collectorText(note.paid);
    if (note.type === 'exposure' && note.waived) return '晨簿已经把见光缺口与本人之物的去向公开留名；门房不再暗付十五两封口银，限制仍须按具名动作恢复。';
    if (note.type === 'exposure') return note.paid >= note.due
      ? `门房因外头来问话的人实领${silverText(note.paid)}两。钱付清了，原话、私钥、名帖与工簿却不再默认随银子一起交出去。`
      : `门房要${silverText(note.due)}两才肯拦住来问话的人，柜上只付出${silverText(note.paid)}两。少掉的数已经见光，不能再从任何一院私物里暗补。`;
    return '门外那收账的今日又来问了一回，说这笔账拖不过明日。';
  });
  const afterglowRow = [...state.history].reverse().find((entry) => entry.type === 'personal_afterglow' && entry.day === state.day - 1);
  const afterglowChoice = afterglowRow
    ? personalAfterglowTemplate(afterglowRow.heroine, afterglowRow.tier)?.choices.find((choice) => choice.id === afterglowRow.choice)
    : null;
  if (afterglowChoice?.morning) event.notes.unshift(afterglowChoice.morning);
  const aftermathRow = [...state.history].reverse().find((entry) => entry.type === 'personal_afterglow_aftermath' && entry.day === state.day - 1);
  const aftermathChoice = aftermathRow
    ? personalAfterglowAftermathTemplate(aftermathRow.heroine, aftermathRow.tier)?.choices.find((choice) => choice.id === aftermathRow.choice)
    : null;
  if (aftermathChoice?.morning) event.notes.unshift(aftermathChoice.morning);
  const conversationRow = [...state.history].reverse().find((entry) => (
    entry.type === 'night_conversation'
    && entry.day === state.day - 1
    && entry.heroine === visited
  ));
  const conversationMorning = conversationRow
    ? NIGHT_CONVERSATION_MORNINGS[conversationRow.heroine]?.[conversationRow.chapter - 1]?.[conversationRow.mode]
    : null;
  const conversationObserver = conversationRow
    ? nightConversationObserverReaction(conversationRow.heroine, conversationRow.chapter, conversationRow.mode)
    : null;
  const conversationStake = conversationRow
    ? nightConversationStake(conversationRow.heroine, conversationRow.chapter, conversationRow.mode)
    : null;
  if (conversationObserver) event.notes.unshift(`${conversationObserver.name}在另一院接住这一笔：${conversationObserver.line}`);
  if (conversationStake) event.notes.unshift(`本章制度代价已经入账——${conversationStake.label}：${conversationStake.text}`);
  if (conversationMorning) event.notes.unshift(conversationMorning);
  const ordinaryNightRow = [...state.history].reverse().find((entry) => (
    entry.type === 'night_coda'
    && entry.day === state.day - 1
    && entry.heroine === visited
  ));
  const ordinaryNightMorning = ordinaryNightRow
    ? ordinaryNightMorningText(ordinaryNightRow.heroine, ordinaryNightRow.action, ordinaryNightRow.act)
    : '';
  if (ordinaryNightMorning) event.notes.unshift(ordinaryNightMorning);
  // 催账的那两个早晨给一张门前画面:预告那天他还在门外等,到期那天门已经开过。
  // 一句报条说得清数目,说不清"有人正站在门口"——那是玩家该提前两天看见的压力。
  if (notes.some((note) => note.type === 'collector_warning' || note.type === 'collector')) {
    event.scene = 'scene/gate_collector';
  }
  return event;
}

function formatRivalryText(text, actor, visited) {
  if (typeof text !== 'string') return '';
  return text
    .replaceAll('{actor}', HEROINES[actor]?.short ?? '她')
    .replaceAll('{actorHouse}', HEROINES[actor]?.house ?? '她院里')
    .replaceAll('{visited}', HEROINES[visited]?.short ?? '另一人')
    .replaceAll('{visitedHouse}', HEROINES[visited]?.house ?? '另一院');
}

export function currentMorningStory(state) {
  const event = state?.morning;
  if (!event || event.id !== 'rivalry' || event.resolution || !HEROINE_IDS.includes(event.actor) || !HEROINE_IDS.includes(event.visited)) return null;
  const template = RIVALRY_MORNINGS[event.actor];
  const beat = Number.isInteger(event.beat) ? event.beat : 0;
  if (!template || beat < 0 || beat > 2) return null;
  const rows = [
    { speaker: event.actor, listener: event.visited, text: template.opening },
    { speaker: event.visited, listener: event.actor, text: RIVALRY_VISITED_REPLIES[event.visited] },
    { speaker: event.actor, listener: event.visited, text: template.crossfire },
  ];
  const row = rows[beat];
  return {
    ...row,
    index: beat,
    count: rows.length,
    text: formatRivalryText(row.text, event.actor, event.visited),
  };
}

export function advanceMorningStory(state) {
  if (state.phase !== 'morning' || state.morning?.id !== 'rivalry') return { ok: false, error: '眼下没有要继续听完的争执。' };
  const story = currentMorningStory(state);
  if (!story) return { ok: false, error: '这场对话断了页。' };
  if (story.index >= story.count - 1) return { ok: false, error: '两个人都说完了，轮到你表态。' };
  state.morning.beat += 1;
  return { ok: true };
}

export function currentMorningResolution(state) {
  const event = state?.morning;
  if (!event || event.id !== 'rivalry' || !isRecord(event.resolution)) return null;
  const choice = event.resolution.choice;
  if (!['admit', 'direct', 'hide'].includes(choice) || typeof event.resolution.text !== 'string') return null;
  return {
    choice,
    text: event.resolution.text,
    actor: event.actor,
    visited: event.visited,
    title: {
      admit: '偏爱写进了能追问的明账',
      direct: '这一次，她们没有借你的嘴说话',
      hide: `你当面只护了${HEROINES[event.visited].short}`,
    }[choice],
    consequence: {
      admit: '妒意下降 · 去处见光 · 两院稍近',
      direct: '两院互信增长 · 宅门更稳 · 你退到话外',
      hide: '专情加深 · 两院转冷 · 宅中秩序受损',
    }[choice],
  };
}

export function continueMorningResolution(state) {
  if (state.phase !== 'morning') return { ok: false, error: '这场次晨已经过去了。' };
  const resolution = currentMorningResolution(state);
  if (!resolution) return { ok: false, error: '眼下没有要收下的对峙结果。' };
  state.morning = null;
  state.favorReckoning = favorReckoningCandidate(state);
  if (!state.favorReckoning) state.memoryReckoning = memoryReckoningCandidate(state);
  state.phase = state.favorReckoning ? 'favor_reckoning' : state.memoryReckoning ? 'memory_reckoning' : ACT_TRANSITIONS[state.day] ? 'act_transition' : 'day';
  return { ok: true };
}

export function rivalryMorningMemories(state, heroineId) {
  if (!state || !Array.isArray(state.history) || !HEROINE_IDS.includes(heroineId)) return [];
  return state.history.flatMap((row) => {
    if (row.type !== 'morning'
      || row.event !== 'rivalry'
      || (row.actor !== heroineId && row.visited !== heroineId)
      || !HEROINE_IDS.includes(row.actor)
      || !HEROINE_IDS.includes(row.visited)
      || row.actor === row.visited
      || !RIVALRY_CHOICE_LABELS[row.choice]) return [];
    const template = RIVALRY_MORNINGS[row.actor];
    const visitedReply = RIVALRY_VISITED_REPLIES[row.visited];
    if (!template || !visitedReply || typeof template.results[row.choice] !== 'string') return [];
    const other = row.actor === heroineId ? row.visited : row.actor;
    return [{
      day:row.day,
      event:'rivalry',
      actor:row.actor,
      actorName:HEROINES[row.actor].name,
      visited:row.visited,
      visitedName:HEROINES[row.visited].name,
      role:row.actor === heroineId ? 'challenger' : 'visited',
      other,
      otherName:HEROINES[other].name,
      title:template.title,
      context:formatRivalryText(template.context, row.actor, row.visited),
      opening:formatRivalryText(template.opening, row.actor, row.visited),
      visitedReply:formatRivalryText(visitedReply, row.actor, row.visited),
      crossfire:formatRivalryText(template.crossfire, row.actor, row.visited),
      choice:row.choice,
      choiceLabel:RIVALRY_CHOICE_LABELS[row.choice],
      outcome:formatRivalryText(template.results[row.choice], row.actor, row.visited),
    }];
  });
}

export function latestRivalryMorningMemory(state, heroineId) {
  return rivalryMorningMemories(state, heroineId).at(-1) ?? null;
}

function pickMorningEvent(state, visited) {
  const candidates = HEROINE_IDS.filter((id) => id !== visited).sort((a, b) => state.relations[b].du - state.relations[a].du);
  const actor = candidates[0];
  const rel = state.relations[actor];
  if (state.day === 3 && state.flags.yue_respected && !state.flags.yue_delayed_paid) {
    return {
      id: 'yue_delayed', actor: 'wu_yueniang', tone: 'backing',
      title: '两日前那本账，月娘替你留住了人',
      text: '月娘把一张名单压在你的早茶下：“短款的那个人，我让他在正堂候着。茶是我替你留的，话得你自己去问。”',
    };
  }
  if (state.flags.yue_morning_help && !state.flags.yue_help_paid) {
    return {
      id: 'yue_help', actor: 'wu_yueniang', tone: 'backing',
      title: '催账人先在正堂喝上了茶',
      text: '月娘连早茶也没喝，先把催账人按在正堂：“我只替你留人，不替你还账。去把身上那股酒气洗了，再来见我。”',
    };
  }
  if (state.flags.pinger_morning_route && !state.flags.pinger_route_paid) {
    return { id: 'pinger_help', actor: 'li_pinger', tone: 'backing', title: '瓶儿把一条货路压在早茶下', text: '瓶儿放下茶盘，手指在货单上停了停：“拿这张去城门，别再送那三十两。”她走到门边，又回头加了一句：“晚上回来，让我知道它用在了哪里。”' };
  }
  if (state.flags.meng_morning_invitation && !state.flags.meng_invitation_paid) {
    return {
      id: 'meng_invitation', actor: 'meng_yulou', tone: 'backing', title: '玉楼将五张名帖一张张排在早茶旁',
      text: '玉楼已重新系好衣带，只留一缕头发还没绾起。她按住第三张名帖：“昨夜说的情分留在门内，今日这份功劳，得让门外的人也知道是谁做的。”',
    };
  }
  if (state.flags.xuee_morning_breakfast && !state.flags.xuee_breakfast_paid) {
    return {
      id: 'xuee_breakfast', actor: 'sun_xuee', tone: 'backing', title: '雪娥亲自送来五碗不同的早饭',
      text: '雪娥的围裙已重新系好，手背却还留着昨夜火边的红痕。她把五张食单压在碗底：“谁少了什么，谁多领了什么，我都写了。你要真话，就别只在没人时认我。”',
    };
  }
  if (state.flags.pan_morning_claim && !state.flags.pan_claim_paid) {
    return { id: 'pan_claim', actor: 'pan_jinlian', tone: 'jealous', title: '金莲拿着你昨夜落下的衣带', text: '金莲用你落下的衣带缠着指尖，把门挡得严严实实：“昨夜还会抱着人不放，今早穿好衣裳，就又只认得账了？”' };
  }
  const recentNights = state.history.filter((entry) => entry.type === 'night').slice(-2);
  const repeatedFavorite = recentNights.length === 2 && recentNights.every((entry) => entry.heroine === visited);
  const rivalryActor = candidates.find((id) => (
    ((repeatedFavorite && state.relations[id].ignored >= 2 && state.relations[id].du >= 10)
      || (state.relations[id].ignored >= 4 && state.relations[id].du >= 28))
    && !state.history.some((entry) => entry.type === 'morning' && entry.event === 'rivalry' && entry.actor === id)
  ));
  if (rivalryActor && HEROINE_IDS.includes(visited)) {
    const template = RIVALRY_MORNINGS[rivalryActor];
    return {
      id: 'rivalry', actor: rivalryActor, visited, tone: 'rivalry',
      title: template.title,
      text: formatRivalryText(template.context, rivalryActor, visited),
    };
  }
  if (rel.du >= 18) {
    const jealousy = {
      wu_yueniang: {
        title: '月娘抱着账本等在廊下',
        text: `月娘没朝${HEROINES[visited].house}里看，只将一盏凉茶放到你手边：“人醒了？那便说说，昨夜留下的话，有几句能见日头。”`,
      },
      pan_jinlian: {
        title: '金莲的扇子在门上敲了三下',
        text: `金莲朝${HEROINES[visited].house}一抬下巴，鼻尖几乎碰到你衣领：“她屋里用的什么香？沾了一身，还敢往我跟前站。”`,
      },
      li_pinger: {
        title: '瓶儿送来一盏没放糖的茶',
        text: `瓶儿把茶盏递给你，眼睛却看着${HEROINES[visited].house}的门：“我不问昨夜。只是官人今日若再来，别又叫我从别人嘴里才知道。”`,
      },
      meng_yulou: {
        title: '玉楼请你在廊下补签一张名帖',
        text: `玉楼看了一眼${HEROINES[visited].house}门前没收的灯，笑着将笔递来：“夜里去哪里是情分，白日承认谁做了事是规矩。官人总不会连名字也不敢写。”`,
      },
      sun_xuee: {
        title: '雪娥把一只冷了的食盒放在你手里',
        text: `雪娥朝${HEROINES[visited].house}一扬下巴：“那院里多添一道菜，灶上就得多起一遍火。你们夜里的情分，凭什么叫我们天不亮就替你藏？”`,
      },
    }[actor];
    return {
      id: 'jealousy', actor, tone: 'jealous',
      ...jealousy,
    };
  }
  const actIndex = Math.min(3, Math.ceil(state.day / 5) - 1);
  const quiet = ({
    wu_yueniang: [
      {title:'真账旁多了一盏热茶',text:'月娘已经把缺银页折了角，见你醒来只问昨夜答应的复核还算不算。你点头，她才把热茶推过来。'},
      {title:'公钥仍在桌心',text:'月娘没有替任何一院收钥匙。她把昨夜说过的去处抄进门房簿，又留出一栏给你今日改口。'},
      {title:'堂前名册没有合上',text:'月娘把公审中每个人承担的风险逐项补齐，自己的名字写在第一行，却把你的笔留在空着的最后一格。'},
      {title:'最后几页由她自己写',text:'天将亮时，月娘没有叫你替她落笔。她写完自己的边界才问：“二十日后，这条还能不能由我自己改？”'},
    ],
    pan_jinlian: [
      {title:'扇骨上多了一句真话',text:'金莲没有翻昨夜的旧账，只把你说过的去处刻在扇骨内侧：“今日若改口，我便拿这句问你。”'},
      {title:'角门外的闲话先被她拆了',text:'金莲一早抓住两句互相矛盾的传言，没有替你辩解，只让门房把说话的人各请来一次。'},
      {title:'她先划掉自己问重的一句',text:'公审之后，金莲把昨夜口供重新誊了一遍。最先删掉的不是别人的谎，是她自己逼得太狠的那一问。'},
      {title:'她不再问谁排第一',text:'金莲把五院去处排在一页，偏心可以圈出来，假话必须划掉。她把笔丢给你：“照这个活，比哄我难多了。”'},
    ],
    li_pinger: [
      {title:'钥匙仍在她腕上',text:'瓶儿先检查门窗，再把昨夜没谈完的货单放到茶边。你没伸手，她才坐下与你把点心分完。'},
      {title:'一张货单写了两个归期',text:'瓶儿把公账归期与自己的退路分开写，确认没有人拿“共同”二字夺她私箱，才让货车出门。'},
      {title:'真本与烂账并排放着',text:'瓶儿没有藏掉亏损，也没有交出私钥。她等你把两本都看完才说：“知道难看，还肯照实算，才算安全。”'},
      {title:'最后一箱没有锁死',text:'她封好旧债本，却把一只空箱留给下一局。钥匙仍归自己，箱上写着所有人都看得见的用途与归期。'},
    ],
    meng_yulou: [
      {title:'回礼日期写在帖背',text:'玉楼没有催你道谢，只让你确认借过哪张名帖、要在谁面前还。写清以后，她才留下吃早茶。'},
      {title:'昨夜末席的椅子还在',text:'玉楼叫人先别撤掉最后两把椅子。她要等没说完的人自己回来，不替谁用笑脸宣布争执已经结束。'},
      {title:'她把自己的名字补回功劳簿',text:'堂前众人散后，玉楼逐项找回被“宅中安排”抹掉的经手人。最后一笔，她没有再客气地留空。'},
      {title:'五张名帖都留有退路',text:'玉楼把“可以拒绝”“可以改期”“必须回礼”写在每张帖背。她说这比一场漂亮总宴更难，却更像能过下去的日子。'},
    ],
    sun_xuee: [
      {title:'灶火按她的时辰才起',text:'雪娥没有因为你醒了便提前开锅。她先吃完自己的早饭，再照工簿叫人领米，谁也没被一句“快些”抹去名字。'},
      {title:'欠工与席面分成两页',text:'雪娥把昨夜剩菜重新分好，却不许拿它抵欠工。你在工钱页落名，她才准宴席那页继续往下写。'},
      {title:'米斗从证物变回了米斗',text:'堂前作证用过的米斗被她洗净归仓。雪娥说证据已经说完话，今天它只该用来让做事的人吃饱。'},
      {title:'终局早饭没有默认她来做',text:'五个人各自拿了一样东西进灶房。雪娥只负责自己愿意做的那一锅，余下的由谁吃、谁收、谁洗都当场说定。'},
    ],
  })[visited]?.[actIndex];
  return {
    id: 'quiet', actor: visited, tone: 'quiet', title: quiet?.title ?? '醒酒茶还没凉',
    text: quiet?.text ?? '昨夜的话留到了天亮。',
  };
}

export function morningOptions(state) {
  if (state.phase !== 'morning' || !state.morning) return [];
  if (state.morning.id === 'rivalry') {
    if (state.morning.resolution) return [];
    const story = currentMorningStory(state);
    if (!story || story.index < story.count - 1) return [];
    const actor = state.morning.actor;
    const visited = state.morning.visited;
    const trust = bondValue(state, actor, visited);
    return [
      {
        id: 'admit', label: '当着两人认下偏爱',
        hint: '去处、受益和代价一起见光；妒会降，院里也都会知道',
        meta: '偏爱可追问 · 院间稍近',
      },
      {
        id: 'direct', label: '退开，让她们互问',
        hint: trust >= 0
          ? '你不替任何人回答；她们自行决定说多少、追哪一笔'
          : '两院仍彼此提防，退开只会让这场问话变成互相定罪',
        meta: `院间互信 ${trust >= 0 ? '+' : ''}${trust}`,
        disabled: trust < 0,
      },
      {
        id: 'hide', label: '只护昨夜那一院',
        hint: `明确偏向${HEROINES[visited].short}；亲近会更深，另一院与宅中秩序会记下代价`,
        meta: '专一倾向 · 院间转冷',
      },
    ];
  }
  if (state.morning.id === 'jealousy' || state.morning.id === 'pan_claim') {
    // 按钮报当前实价:妒越深,哄她开门越贵,拖着不安抚只会更贵。
    const cost = appeaseCost(state, state.morning.actor);
    const options = [
      { id: 'appease', label: '陪她亲自挑一件', hint: `花${silverText(cost)}两买的不只是首饰，还有你陪她的半日`, disabled: state.resources.silver < cost },
      { id: 'explain', label: '让她进门，把昨夜说透', hint: '院里会猜，至少她不用靠猜才知道' },
      { id: 'stand', label: '不哄，也不改口', hint: '你保住了今早的体面，她会把这扇门记更久' },
    ];
    if (state.morning.id === 'jealousy' && HEROINE_IDS.includes(state.morning.visited)) {
      const trust = bondValue(state, state.morning.actor, state.morning.visited);
      options.splice(2, 0, {
        id: 'together', label: '请她直接去问',
        hint: trust >= 0
          ? `${HEROINES[state.morning.actor].short}与${HEROINES[state.morning.visited].short}${bondTier(trust)}；让她们自己决定要说多少`
          : `${HEROINES[state.morning.actor].short}与${HEROINES[state.morning.visited].short}还彼此提防，眼下只会把问话变成争吵`,
        meta: `院间互信 ${trust >= 0 ? '+' : ''}${trust}`,
        disabled: trust < 0,
      });
    }
    return options;
  }
  return [
    { id: 'accept', label: '当着她的面收下', hint: '她给的不只是东西，也在等你认下这份情' },
    { id: 'note', label: '只点头，不再许新话', hint: '不让这份帮忙变成另一句空话' },
  ];
}

export function resolveMorning(state, choiceId) {
  if (state.phase !== 'morning' || !state.morning) return { ok: false, error: '眼下没人来敲门。' };
  const event = state.morning;
  const actor = event.actor;
  let resultText = event.text;
  if (event.id === 'rivalry') {
    if (event.resolution) return { ok: false, error: '先看清这次站队落下的后果。' };
    const story = currentMorningStory(state);
    const visited = event.visited;
    if (!story || story.index < story.count - 1) return { ok: false, error: '先让她们把这场话说完。' };
    if (!['admit', 'direct', 'hide'].includes(choiceId)) return { ok: false, error: '两个人都在等你表态。' };
    const trust = bondValue(state, actor, visited);
    if (choiceId === 'direct' && trust < 0) return { ok: false, error: `${HEROINES[actor].short}与${HEROINES[visited].short}还不能在没有你的时候把话问完。` };
    if (choiceId === 'admit') {
      changeBond(state, actor, visited, 3);
      changeRel(state, actor, { qing: 2, du: -12 }, `你当着${HEROINES[visited].short}认下偏爱，也认下它给另一院的后果`);
      changeRel(state, visited, { qing: 4, du: -4 }, `你没有叫她独自承担昨夜被选择的代价`);
      changeResources(state, { exposure: 5, house: 2 });
      setIgnored(state, actor, 0);
    } else if (choiceId === 'direct') {
      changeBond(state, actor, visited, trust >= 10 ? 8 : 6);
      changeRel(state, actor, { qing: 3, du: -14 }, `她能直接问${HEROINES[visited].short}，不必再从你嘴里猜另一个人的意思`);
      changeRel(state, visited, { qing: 3, du: -4 }, `她可以自己回答${HEROINES[actor].short}，也可以拒绝不愿说的部分`);
      changeResources(state, { exposure: 2, house: 4 });
      setIgnored(state, actor, 0);
    } else {
      changeBond(state, actor, visited, -8);
      changeRel(state, actor, { qing: -3, du: 12 }, `你当面选择${HEROINES[visited].short}，也把她的追问留在门外`);
      changeRel(state, visited, { qing: 8, yu: 5, du: -2 }, '你没有拿轮值或体面冲淡昨夜的偏爱');
      changeResources(state, { exposure: 7, house: -5 });
    }
    resultText = formatRivalryText(RIVALRY_MORNINGS[actor].results[choiceId], actor, visited);
  } else if (event.id === 'jealousy' || event.id === 'pan_claim') {
    if (!['appease', 'explain', 'stand', 'together'].includes(choiceId)) return { ok: false, error: '她还在等你的回答。' };
    if (choiceId === 'together') {
      const visited = event.visited;
      if (event.id !== 'jealousy' || !HEROINE_IDS.includes(visited)) return { ok: false, error: '这句话眼下没有第二个人可以接。' };
      const trust = bondValue(state, actor, visited);
      if (trust < 0) return { ok: false, error: `${HEROINES[actor].short}与${HEROINES[visited].short}还不肯把话直接交给对方。` };
      changeBond(state, actor, visited, trust >= 10 ? 6 : 4);
      changeRel(state, actor, { qing: 3, du: trust >= 10 ? -14 : -9 }, `她亲自向${HEROINES[visited].short}问清昨夜，而不是逼你替对方作答`);
      changeRel(state, visited, { qing: 2, du: -3 }, `${HEROINES[actor].short}来问时，她可以自己决定答多少`);
      changeResources(state, { exposure: 2, house: 2 });
      resultText = `${HEROINES[actor].short}没有进你的门，转身去敲${HEROINES[visited].short}那一扇。${HEROINES[visited].short}只答自己愿意答的部分，也反问她真正介意的是去处、谎话，还是被排除。两个人出来时仍不算亲近，却不用再拿你当唯一的传话筒。`;
    } else if (choiceId === 'appease') {
      const cost = appeaseCost(state, actor);
      if (state.resources.silver < cost) return { ok: false, error: `手里连哄人的${silverText(cost)}两都没有。` };
      changeResources(state, { silver: -cost, house: 3 });
      changeRel(state, actor, { qing: 4, du: -18 }, '你带她出去挑了一件东西');
      resultText = ({
        wu_yueniang: `你没叫下人送匣子，而是陪月娘亲自走了一趟。她挑了一支素簪，只花${silverText(cost)}两，回程却一直没有松开你的袖口：“银子算在你账上，这半日算给我。”`,
        pan_jinlian: `金莲试了三支簪，偏挑中最贵的那支。你付下${silverText(cost)}两时，她对着铜镜笑：“官人别心疼。今早花的是银子，再晚一日，我要的就不止这个了。”`,
        li_pinger: `瓶儿原只肯挑一枚便宜的耳坠。你付下${silverText(cost)}两，亲手替她戴好。她对着镜子看了很久，轻声说：“我记得的不是这个，是你今早没让我一个人去。”`,
        meng_yulou: `玉楼挑了一枚只刻名字的玉扣。你付下${silverText(cost)}两，她当着掌柜的面把你的名字也写进定单：“情分不必让外人看，责任却不许只留我一个人的名。”`,
        sun_xuee: `雪娥不肯买簪，最后选了一把真能用的铜刀。你付下${silverText(cost)}两时，她试了试刃口：“这东西我收。你今早亲自来，我也收。两笔别混着算。”`,
      })[actor];
    } else if (choiceId === 'explain') {
      changeResources(state, { exposure: 5 });
      changeRel(state, actor, { qing: 2, du: -10 }, '你关上门，把昨夜的去处说清了');
      resultText = ({
        wu_yueniang: '你把月娘请进门，从昨夜第一杯酒说到天亮。她听完才端起那盏凉茶：“好。真话不一定好听，总比叫我从廊下闲话里拼凑强。”',
        pan_jinlian: '你关上门，当着金莲的面说清昨夜去了哪里、停在哪一步。她的扇子终于不再敲门：“这就对了。我吃醋是我的事，官人撒谎可就是你的错。”',
        li_pinger: '你让瓶儿进门，将昨夜的去处一句不省地说给她。她沉默片刻，把那盏没放糖的茶换走：“我听了会难过。可总好过他人拿它来笑我。”',
        meng_yulou: '你将昨夜的去处和今日会公开的事一并说清。玉楼把那张未署名的名帖撤了：“行。真话不能叫人舒服，却能让我自己决定留不留。”',
        sun_xuee: '你在灶房门口把昨夜说清，没有叫她先放下手里的活。雪娥听完才揭开食盒：“难听是难听。可这比叫我猜着该少做几个人的饭强。”',
      })[actor];
    } else {
      changeResources(state, { house: -3 });
      changeRel(state, actor, { du: 10 }, '你由她生气，也没有改口');
      resultText = ({
        wu_yueniang: '你越过月娘往前走。她没拦，只把那盏凉茶泼在廊下：“好。既然官人不愿对账，这一页我自己记。”',
        pan_jinlian: '你伸手拨开金莲的扇子。她立刻让了路，笑得比方才更甜：“官人走好。今日这股香，我保管叫满院都闻见。”',
        li_pinger: '你只说了一句“别多心”。瓶儿点点头，把没放糖的茶原样端了回去。到门口时，她已经将钥匙换到另一只袖里。',
        meng_yulou: '你没接那支笔。玉楼仍笑着，自己把名帖折起：“好。不敢写的话，就不必说给我听了。”',
        sun_xuee: '你叫雪娥别把灶上的事闹到人前。她拎起冷食盒就走：“行。以后院里多开几遍火，也都算我多事。”',
      })[actor];
    }
    if (event.id === 'pan_claim') addFlag(state, 'pan_claim_paid');
  } else if (event.id === 'yue_delayed') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '先接下正堂这句话。' };
    if (choiceId === 'accept') {
      addSecret(state, 'yue_backing');
      changeRel(state, 'wu_yueniang', { qing: 6, du: -6 }, '两日前交给她的账，今日替你找出了人');
      changeResources(state, { house: 5 });
      resultText = '你端起月娘留的茶，当着她的面喝了：“人我去问，这份情我记你的。”月娘抽走杯底那张名单：“先把人问明白。晚上再来说怎么记。”';
    } else {
      resultText = '你收下名单，只向月娘点了点头。她没追问，把那盏茶留在原处。茶气很快散了，这份人情还在。';
    }
    addFlag(state, 'yue_delayed_paid');
  } else if (event.id === 'yue_help') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '正堂还在等你接这笔账。' };
    if (choiceId === 'accept') {
      addSecret(state, 'yue_backing');
      changeRel(state, 'wu_yueniang', { qing: 4, du: -5 }, '月娘替你把催账人留在正堂');
      changeResources(state, { house: 4 });
      resultText = '你洗净脸，与月娘一同走进正堂。她没替你开口，只在你坐下时，把已经添过两回的茶推到催账人面前：“现在，和我们官人重新算。”';
    } else {
      resultText = '你只说了一声“知道了”，便自己进了正堂。月娘留给你的那盏茶没有动，人却的确替你留住了。';
    }
    addFlag(state, 'yue_help_paid');
  } else if (event.id === 'pinger_help') {
    if (choiceId === 'accept') {
      addSecret(state, 'merchant_route');
      resultText = '你当着瓶儿的面将货单收进怀里。她按住你的袖口：“我不问你能赚多少。只是用完了，把它完整带回来。”你应下，她的手才松开。';
    } else {
      resultText = '你看过货单，却没有收，只说自己已有打算。瓶儿把它重新压回茶盘下，轻声道：“好。那你就照自己的路走。”';
    }
    addFlag(state, 'pinger_route_paid');
  } else if (event.id === 'meng_invitation') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '先回她这五张名帖怎么署名。' };
    if (choiceId === 'accept') {
      addSecret(state, 'meng_guest_list');
      changeRel(state, actor, { qing: 5, du: -6 }, '你把她的名字署在功劳上');
      changeResources(state, { repute: 1 });
      resultText = '你亲手在五张名帖上补了“孟玉楼经手”。她逐张吹干墨迹：“这就好。今夜的事不必写，今日的功劳不许没名。”';
    }
    addFlag(state, 'meng_invitation_paid');
  } else if (event.id === 'xuee_breakfast') {
    if (!['accept', 'note'].includes(choiceId)) return { ok: false, error: '先回她这五张食单要不要入账。' };
    if (choiceId === 'accept') {
      addSecret(state, 'xuee_storehouse_mark');
      changeRel(state, actor, { qing: 5, du: -7 }, '你当着灶上众人认下她的证据');
      changeResources(state, { house: 4 });
      resultText = '你把五张食单原样送进正堂账册，没删她的名字。雪娥这才把最热的那碗面推给你：“吃吧。这碗是我愿意做的。”';
    }
    addFlag(state, 'xuee_breakfast_paid');
  }
  record(state, 'morning', { event: event.id, actor, visited: event.visited ?? null, choice: choiceId });
  state.log.push(resultText);
  if (event.id === 'rivalry') {
    event.resolution = { choice: choiceId, text: resultText };
    return { ok: true };
  }
  state.morning = null;
  state.favorReckoning = favorReckoningCandidate(state);
  if (!state.favorReckoning) state.memoryReckoning = memoryReckoningCandidate(state);
  state.phase = state.favorReckoning ? 'favor_reckoning' : state.memoryReckoning ? 'memory_reckoning' : ACT_TRANSITIONS[state.day] ? 'act_transition' : 'day';
  return { ok: true, text: resultText };
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

function combinations(rows, size, start = 0, prefix = [], result = []) {
  if (prefix.length === size) {
    result.push(prefix);
    return result;
  }
  for (let index = start; index <= rows.length - (size - prefix.length); index += 1) {
    combinations(rows, size, index + 1, [...prefix, rows[index]], result);
  }
  return result;
}

function heroineAccordReady(state, heroineId) {
  const key = Object.values(ACCORD_META).find((row) => row.heroine === heroineId)?.key;
  return !!key && !!state.accords?.[key];
}

function allianceEndingText(members, style = null) {
  const key = members.join('|');
  const exact = ({
    'wu_yueniang|pan_jinlian': '月娘把可追责的事写进正堂，金莲保留当面拆穿每一句偏心的权利。两人仍会争，却不再借你的沉默互相猜。',
    'wu_yueniang|li_pinger': '月娘只管公账，瓶儿仍握私钥。两处院门以归期和不得强取为界，把亲近与财货分成两笔。',
    'wu_yueniang|meng_yulou': '月娘守账，玉楼守人情的来回。一个不许权责含糊，一个不许任何人被拿来垫体面。',
    'pan_jinlian|li_pinger': '金莲负责追问口供，瓶儿负责让每句话对应真物。她们都不肯替你圆谎，却肯替彼此保留退路。',
    'pan_jinlian|sun_xuee': '金莲拆谎，雪娥拿工簿和米斗落证。一个不让话躲，一个不让做事的人再被抹掉。',
    'wu_yueniang|pan_jinlian|meng_yulou': '月娘管权责，金莲管真话，玉楼管每一次借名与回礼。三院没有排出第一，却给你的偏向留下三种不同的追问。',
    'wu_yueniang|li_pinger|sun_xuee': '公账、私钥与粮火分在三人手里。谁都不能单独掐住这座宅子的命脉，也没人需要用亲近换安全。',
  })[key];
  const styleText = style === '横向盟约'
    ? '这一夜最重要的不是她们同时向你许诺，而是她们也亲自向彼此留下了承担、拒绝与追问的权利。'
    : style === '明账共恋'
      ? '去处与偏爱仍围着你发生，却不再靠猜；每一次靠近、改口与独宿都必须当着联盟成员说清。'
      : style === '有限共居'
        ? '她们保留各自院门，只把确实愿意共同承担的部分放到桌心；亲近没有被伪装成吞并。'
        : '';
  if (exact) return `${exact}${styleText ? ` ${styleText}` : ''}`;
  const names = members.map((id) => HEROINES[id].name).join('、');
  return `${names}把能共同承担的事写成一份有限同盟。未入盟的院门仍保留自己的账与去路，你也不能拿这份亲近冒充五院圆满。${styleText ? ` ${styleText}` : ''}`;
}

function heroineEpilogueVariant(state, endingId, allianceMembers, exclusiveHeroine, heroineId) {
  if (endingId === 'balanced') return 'balanced';
  if (endingId === 'alliance') return allianceMembers?.includes(heroineId) ? 'alliance' : 'outside';
  if (endingId === 'exclusive') return exclusiveHeroine === heroineId ? 'exclusive' : 'outside';
  const relation = state.relations?.[heroineId] ?? { qing: 0, du: 100 };
  return relation.qing >= 35 && relation.du < 65 ? 'personal' : 'outside';
}

function endingEpilogues(state, endingId, allianceMembers, exclusiveHeroine) {
  const firstOpening = openingMemory(state);
  const personalDepartures = endingId === 'exclusive' ? recordedPersonalFinaleDepartureDetails(state) : [];
  const allianceMemberMemories = endingId === 'alliance' ? recordedAllianceNightMemberMemories(state) : [];
  const sharedNightAccord = endingId === 'balanced' ? recordedSharedNightAccord(state) : [];
  const sharedFinaleMemories = endingId === 'balanced' ? recordedSharedFinaleHeroineMemories(state) : [];
  const collapseMemories = ['intrigue', 'unstable'].includes(endingId) && state.collapseFinale?.choice
    ? HEROINE_IDS.map((heroine) => collapseFinaleHeroineMemory(state, heroine))
    : [];
  const precedent = recordedPortablePrecedent(state);
  const precedentEvent = precedent ? PORTABLE_PRECEDENTS[precedent.action] : null;
  const assembly = recordedAllianceAssembly(state);
  const morningSettlements = recordedMorningSettlements(state);
  return HEROINE_IDS.map((heroine) => {
    const stance = routeStance(state, heroine);
    const relation = state.relations?.[heroine] ?? { qing: 0, yu: 0, du: 0 };
    const variant = heroineEpilogueVariant(state, endingId, allianceMembers, exclusiveHeroine, heroine);
    const base = EPILOGUES[heroine][variant];
    const habit = nightRelationshipPattern(state, heroine);
    const nightConversations = nightConversationMemories(state, heroine);
    const latestConversation = nightConversations.at(-1) ?? null;
    const arrangements = intimacyArrangements(state, heroine);
    const ordinaryNights = ordinaryNightMemories(state, heroine);
    const ordinaryNight = ordinaryNights.at(-1) ?? null;
    const invitationMemory = duskInvitationMemory(state, heroine);
    const rivalryMemories = rivalryMorningMemories(state, heroine);
    const pairMemories = pairInterludeMemories(state, heroine);
    const pairMemory = pairMemories.at(-1) ?? null;
    const favorReckonings = favorReckoningMemories(state, heroine);
    const favorReckoning = favorReckonings.at(-1) ?? null;
    const routeReckonings = routeReckoningMemories(state, heroine);
    const routeReckoning = routeReckonings.at(-1) ?? null;
    const departure = personalDepartures.find((row) => row.heroine === heroine) ?? null;
    const allianceMemory = allianceMemberMemories.find((row) => row.heroine === heroine) ?? null;
    const sharedNightAccordEntry = sharedNightAccord.find((row) => row.heroine === heroine) ?? null;
    const sharedFinaleMemory = sharedFinaleMemories.find((row) => row.heroine === heroine) ?? null;
    const collapseMemory = collapseMemories.find((row) => row?.heroine === heroine) ?? null;
    const departureResponse = departure?.response ?? null;
    const precedentReply = precedent?.replies.find((row) => row.heroine === heroine) ?? null;
    const precedentVoice = precedentReply ? precedentEvent.replies[heroine][precedentReply.outcome] : null;
    const assemblyReply = assembly?.replies.find((row) => row.heroine === heroine) ?? null;
    const assemblyVoice = assemblyReply ? ALLIANCE_ASSEMBLY_RESPONSES[heroine][assemblyReply.outcome] : null;
    const morningSettlement = [...morningSettlements].reverse().find((row) => row.heroine === heroine) ?? null;
    const morningSettlementText = morningSettlement
      ? morningSettlement.restored
        ? `第${morningSettlement.day}日她收回的${morningSettlement.object}，后来真实留下这项恢复：${morningSettlement.restoration}`
        : `第${morningSettlement.day}日她收回${morningSettlement.object}；到结局时“${morningSettlement.restrictionLabel}”仍有效，不能拿亲近替它销账。`
      : '';
    const firstOpeningText = firstOpening?.epilogueTexts?.[heroine] ?? '';
    const routeHistoryNote = stance.covenant > stance.private
      ? `二十日里，你有 ${stance.covenant} 次把她的要求带到共同规则中，另有 ${stance.private} 次只留在门内。这封笺记住了你更偏向共同承担。`
      : stance.private > stance.covenant
        ? `二十日里，你有 ${stance.private} 次选择私下相护，只有 ${stance.covenant} 次愿意让众人共同追问。这份亲近也留下了旁院要回看的后果。`
        : stance.covenant
          ? `共同承担与私下情分各有 ${stance.covenant} 次。她没有替你把两种选择算成同一件事。`
          : '你没有真正走进她的路线；结局仍会交代她怎样收回自己的名字、钥匙与去处。';
    const habitNote = habit.mode
      ? `已走的 ${habit.chapters}/4 章夜谈更偏向“${habit.label}”：明说 ${habit.counts.honest}、由她定界 ${habit.counts.listen}、门内私情 ${habit.counts.private}。`
      : '你们的专属夜谈尚未走成稳定习惯，这封笺不会替空白编出答案。';
    const arrangementNote = arrangements.length
      ? `已经定下的亲密约定：${arrangements.map((row) => `${row.tier === 'explicit' ? '留宿' : '前奏'}「${row.label}」`).join('、')}。`
      : '你们还没有共同处理过亲密之后怎样继续生活，结局不会替这项空白编造约定。';
    const ordinaryNightNote = ordinaryNights.length
      ? `她仍记得${ordinaryNights.length}种普通夜章：${ordinaryNights.map((memory) => `「${memory.title}」${memory.count > 1 ? `共发生${memory.count}次（第${memory.firstDay}至${memory.day}夜）` : `发生在第${memory.day}夜`}，那次${memory.actionLabel}后来这样见了白日：${memory.morning}`).join('；')}`
      : '你们没有共同走完一章普通夜话，结局不会把短暂停留编成长期记忆。';
    const pairMemoryNote = pairMemories.length
      ? `她与${pairMemories.length}名旁院留下了逐组关系事实：${pairMemories.map((memory) => `第${memory.day}日与${memory.partnerName}以“${memory.label}”落下「${memory.title}」，${memory.witnessName}见证：${memory.memory}`).join('；')}`
      : '她没有与旁院走完一场双院私议，这封笺不会把数值相近编成横向关系。';
    const invitationMemoryText = invitationMemory
      ? `第${invitationMemory.day}日她曾以“${invitationMemory.invitationTitle}”主动来请；你选择“${invitationMemory.approachLabel}”，又与${invitationMemory.witnessName}一同见证「${invitationMemory.title}」真正落地：${invitationMemory.outcome}`
      : '';
    const invitationMemoryNote = invitationMemory
      ? ` 她主动提出的那一夜没有被改写成你挑中她：${invitationMemory.heroineLine} ${invitationMemory.witnessName}见证后，你以“${invitationMemory.choiceLabel}”作了二次安排；一月后仍保留这项结果：${invitationMemory.outcome}`
      : ' 她在本局没有走完一次主动邀约，这封笺不会替她虚构主动选择。';
    const rivalryMemoryTexts = rivalryMemories.map((memory) => (
      `第${memory.day}日她${memory.role === 'challenger'
        ? `带着“${memory.title}”当面追问${memory.otherName}`
        : `在${memory.otherName}以“${memory.title}”追问偏宠时亲口作答`}；你最终选择“${memory.choiceLabel}”，留下这项结果：${memory.outcome}`
    ));
    const rivalryMemoryNote = rivalryMemories.length
      ? ` 她参与的${rivalryMemories.length}场偏宠对峙没有被妒意终值覆盖：${rivalryMemories.map((memory) => `第${memory.day}日与${memory.otherName}围绕“${memory.title}”对质，以“${memory.choiceLabel}”落定：${memory.outcome}`).join('；')}`
      : ' 她没有参与过一场完整偏宠对峙，这封笺不会从妒意数值虚构争执。';
    const nightConversationNote = latestConversation
      ? `专属夜谈已有 ${nightConversations.length}/4 章真正进入白日；最近一章「${latestConversation.title}」执行了「${latestConversation.stakeLabel}」：${latestConversation.stakeText} 一个月后继续这样生活：${latestConversation.future} ${latestConversation.observerName}也没有退回背景，她当时这样接住：${latestConversation.observerLine}`
      : '你们没有走完专属夜谈，结局不会把未曾发生的物件与边界编进生活。';
    const routeReckoningTexts = routeReckonings.map((memory) => (
      `第${memory.sourceDay}日执行的「${memory.stakeLabel}」没有在第${memory.day}日裁决完便消失；你选择“${memory.choiceLabel}”，一月笺仍保留这项原物结果：${memory.outcome}`
    ));
    const routeReckoningNote = routeReckonings.length
      ? ` ${routeReckonings.length}笔旧话逐项留账：${routeReckonings.map((memory) => `第${memory.sourceDay}日“${memory.title}”由${memory.observerName}见证；「${memory.stakeLabel}」以“${memory.choiceLabel}”落定：${memory.outcome}`).join('；')}`
      : '';
    const favorReckoningTexts = favorReckonings.map((memory) => (
      `第${memory.sourceDay}日你借${HEROINES[heroine].short}的「${memory.sourceLabel}」收住危局，留下“${memory.debtTitle}”；第${memory.day}日你选择“${memory.choiceLabel}”，一月后仍照这项结果生活：${memory.outcome}`
    ));
    const favorReckoningNote = favorReckonings.length
      ? ` ${favorReckonings.length}笔人情逐项还账：${favorReckonings.map((memory) => `第${memory.sourceDay}日「${memory.sourceLabel}」借力后，${memory.observerName}一同见证“${memory.debtTitle}”以“${memory.choiceLabel}”落定：${memory.outcome}`).join('；')}`
      : '';
    return {
      heroine,
      variant,
      title: base.title,
      body: [base.body, habit.mode ? habit.epilogue : '', ...nightConversations.map((memory) => memory.future), ...arrangements.map((row) => row.future), ...ordinaryNights.map((memory) => `${memory.closing} 到了次晨，${memory.morning}`), invitationMemoryText, ...rivalryMemoryTexts, ...pairMemories.map((memory) => memory.memory), ...favorReckoningTexts, ...routeReckoningTexts, morningSettlementText, departureResponse?.line ?? '', ...(allianceMemory?.choices.flatMap((row) => [row.response, row.tableauAction]) ?? []), sharedNightAccordEntry?.conclusion ?? '', ...(sharedFinaleMemory ? [...sharedFinaleMemory.afterglow.map((row) => row.response), sharedFinaleMemory.dawn.response, sharedFinaleMemory.dawn.future] : []), precedentVoice ? `院外有人拿第二张契来时，她亲口说：${precedentVoice.line}` : '', assemblyVoice ? `逐院问灯时，她亲自这样处置：${assemblyVoice.action} ${assemblyVoice.line}` : '', firstOpeningText].filter(Boolean).join(' '),
      routeNote: `${routeHistoryNote} ${habitNote} ${nightConversationNote} ${arrangementNote} ${ordinaryNightNote}${invitationMemoryNote}${rivalryMemoryNote} ${pairMemoryNote}${favorReckoningNote}${routeReckoningNote}${morningSettlement ? ` 晨簿“${morningSettlement.title}”留下${morningSettlement.object}，${morningSettlement.restored ? `实际恢复结果是：${morningSettlement.restoration}` : '仍由本人持有且限制未解除'}。` : ''}${departure ? ` 四院善后里，她面对“${departure.procedure.label}”，亲自决定“${departureResponse.title}”；这项程序只处理${departure.procedure.focus}。` : ''}${collapseMemory ? ` 破局清算时，她把“${collapseMemory.label}”带到“${collapseMemory.choiceLabel}”之前：${collapseMemory.text}${collapseMemory.conclusion}` : ''}${allianceMemory ? ` 有限同盟三拍由她本人逐项接住并实际走位：${allianceMemory.choices.map((row) => `“${row.choiceLabel}”——${row.response} 群像动作是：${row.tableauAction} 依据是：${row.reasons.join('；')}`).join('；')}` : ''}${sharedNightAccordEntry ? ` 同灯成立以前，她先以第19日“${sharedNightAccordEntry.day19.outcomeLabel}”答复“${sharedNightAccordEntry.day19.offerTitle}”，第20日又以“${sharedNightAccordEntry.day20.choiceLabel}”接“${sharedNightAccordEntry.day20.aftermathLabel}”，对“${sharedNightAccordEntry.day19.rightLabel}”得到“${sharedNightAccordEntry.day20.protectionLabel}”。${sharedNightAccordEntry.conclusion}` : ''}${sharedFinaleMemory ? ` 五院共守四拍没有合并成一个风格名：${[...sharedFinaleMemory.afterglow, sharedFinaleMemory.dawn].map((row) => `“${row.choiceLabel}”——${row.response} 当时依据是：${row.reasons.join('；')}`).join('；')}` : ''}${precedentVoice ? ` 她对${precedent.outsider.name}的自主答复是“${precedentVoice.title}”；最后${precedent.title}，只处置${precedentEvent.object.portable}。` : ''}${assemblyVoice ? ` 逐院问灯里，她选择“${assemblyVoice.title}”，本人处置的是${assemblyVoice.object}。` : ''}`,
      habit,
      nightConversations,
      arrangements,
      ordinaryNights,
      ordinaryNight,
      invitationMemory,
      rivalryMemories,
      pairMemories,
      pairMemory,
      favorReckonings,
      favorReckoning,
      routeReckonings,
      routeReckoning,
      openingMemory:firstOpeningText ? { choice:firstOpening.choice, title:firstOpening.title, text:firstOpeningText } : null,
      personalDeparture:departure ? structuredClone(departure) : null,
      collapseMemory:collapseMemory ? structuredClone(collapseMemory) : null,
      allianceMemory:allianceMemory ? structuredClone(allianceMemory) : null,
      sharedNightAccord:sharedNightAccordEntry ? structuredClone(sharedNightAccordEntry) : null,
      sharedFinaleMemory:sharedFinaleMemory ? structuredClone(sharedFinaleMemory) : null,
      relation: {
        qing: relationTier(relation.qing, 'qing'),
        yu: relationTier(relation.yu, 'yu'),
        du: relationTier(relation.du, 'du'),
      },
    };
  });
}

export function fateHeroineMemories(state) {
  const endingId = state.ending?.id;
  if (!endingId || !ENDINGS[endingId]) return [];
  const allianceMembers = endingId === 'alliance' ? state.ending.alliance ?? [] : null;
  const exclusiveHeroine = endingId === 'exclusive' ? state.ending.heroine ?? null : null;
  const personalDepartures = endingId === 'exclusive' ? recordedPersonalFinaleDepartureDetails(state) : [];
  return HEROINE_IDS.map((heroine) => {
    const variant = heroineEpilogueVariant(state, endingId, allianceMembers, exclusiveHeroine, heroine);
    const fixedFate = FATE_CODA.heroineEchoes[heroine][variant];
    const allianceMemory = endingId === 'alliance'
      ? recordedAllianceNightMemberMemories(state).find((row) => row.heroine === heroine) ?? null
      : null;
    const allianceEcho = allianceMemory
      ? `有限同盟三拍没有因家业散去合流成一个风格名。她本人依次接住：${allianceMemory.choices.map((row) => `“${row.choiceLabel}”——${row.response} 当夜实际动作是：${row.tableauAction} 当时依据是：${row.reasons.join('；')}`).join('；')}。这些回答只记录她曾怎样决定关系归属、本人边界与未入盟者权利，不改变固定死生，也不把入盟写成获救。`
      : '';
    const sharedNightAccord = endingId === 'balanced'
      ? recordedSharedNightAccord(state).find((row) => row.heroine === heroine) ?? null
      : null;
    const sharedNightAccordEcho = sharedNightAccord
      ? `五院同灯也不是家业稳住以后补写的一句和睦。第19日她面对“${sharedNightAccord.day19.offerTitle}”，本人以“${sharedNightAccord.day19.outcomeLabel}”作答：${sharedNightAccord.day19.responseLine} 第20日实际执行“${sharedNightAccord.day20.choiceLabel}”，再落下“${sharedNightAccord.day20.aftermathLabel}”，对“${sharedNightAccord.day19.rightLabel}”留下“${sharedNightAccord.day20.protectionLabel}”。${sharedNightAccord.conclusion}这份契据只证明她曾怎样进入共守，不改变固定死生，也不把落印写成获救。`
      : '';
    const sharedFinaleMemory = endingId === 'balanced'
      ? recordedSharedFinaleHeroineMemories(state).find((row) => row.heroine === heroine) ?? null
      : null;
    const sharedFinaleEcho = sharedFinaleMemory
      ? `五院共守也没有因家业散去缩成一句同灯。她本人依次接住：${[...sharedFinaleMemory.afterglow, sharedFinaleMemory.dawn].map((row) => `“${row.choiceLabel}”——${row.response} 当时依据是：${row.reasons.join('；')}`).join('；')}。这些回答只保留她怎样把贡献、同意、院约与白日安排带过四拍，不改变固定死生，也不把共守写成获救。`
      : '';
    const collapseMemory = ['intrigue', 'unstable'].includes(endingId)
      ? collapseFinaleHeroineMemory(state, heroine)
      : null;
    const collapseEcho = collapseMemory
      ? `破局清算也没有把她压成五句通用回应之一。她把“${collapseMemory.label}”带到“${collapseMemory.choiceLabel}”之前：${collapseMemory.text}${collapseMemory.conclusion}后来固定命数发生，这项记录只保留她曾怎样追讨自己的旧事与权利，不把最后留下的一笔写成获救，也不把散局写成受罚。`
      : '';
    const arrangements = intimacyArrangements(state, heroine);
    const arrangementEcho = arrangements.length
      ? `这份固定命数也没有把亲密之后的${arrangements.length}项约定当作可以随家业散去的空话：${arrangements.map((arrangement) => `第${arrangement.day}日${arrangement.tier === 'explicit' ? '留宿后' : '前奏后'}以“${arrangement.label}”落成「${arrangement.title}」：${arrangement.outcome} 次晨真实发生：${arrangement.morning} 后来继续这样生活：${arrangement.future}`).join('；')}。这些约定只保留同意、撤回、休息、私物或劳动怎样被尊重，不把亲密写成救命，也不拿后来的死亡与去处撤销当时的边界。`
      : '';
    const invitationMemory = duskInvitationMemory(state, heroine);
    const invitationEcho = invitationMemory
      ? `这份固定命数也没有抹掉她曾主动来请的那一夜：第${invitationMemory.day}日“${invitationMemory.invitationTitle}”，她亲口开约：${invitationMemory.heroineLine} 你选择“${invitationMemory.approachLabel}”，${invitationMemory.witnessName}在场见证，最后以“${invitationMemory.choiceLabel}”落成「${invitationMemory.title}」：${invitationMemory.outcome}。这项记录承认是她先作选择，不把赴约写成获救，也不把拒绝写成她后来死、生路或去处的原因。`
      : '';
    const favorReckonings = favorReckoningMemories(state, heroine);
    const favorReckoning = favorReckonings.at(-1) ?? null;
    const favorReckoningEcho = favorReckonings.length
      ? `这份固定命数也没有替她的${favorReckonings.length}笔人情销账：${favorReckonings.map((memory) => `第${memory.sourceDay}日借「${memory.sourceLabel}」收局，留下“${memory.debtTitle}”；第${memory.day}日以“${memory.choiceLabel}”落定，${memory.observerName}见证的结果是：${memory.outcome}`).join('；')}。这些账只追借来的名、话、物与劳动后来怎样偿还，不把她的死、生路或去处改写成奖惩。`
      : '';
    const routeReckonings = routeReckoningMemories(state, heroine);
    const routeReckoning = routeReckonings.at(-1) ?? null;
    const routeReckoningEcho = routeReckonings.length
      ? `这份固定命数也没有替她的${routeReckonings.length}笔旧话销账：${routeReckonings.map((memory) => `第${memory.sourceDay}日“${memory.stakeLabel}”在第${memory.day}日以“${memory.choiceLabel}”落定，${memory.observerName}见证的原物结果是：${memory.outcome}`).join('；')}。这些账只追谁怎样处置原物，不把她的死、生路或去处改写成被你拯救。`
      : '';
    const personalDeparture = personalDepartures.find((row) => row.heroine === heroine) ?? null;
    const departureEcho = personalDeparture
      ? `专情终章没有替她销掉自己的善后。她面对的程序是“${personalDeparture.procedure.label}”：${personalDeparture.procedure.summary}它只处分${personalDeparture.procedure.focus}；她本人以“${personalDeparture.response.title}”作答：${personalDeparture.response.line}当时逐项核验的真实依据仍是：${personalDeparture.reasons.join('；')}。后来固定命数发生，这份记录只证明她曾怎样处分自己的物件、劳动、原话与退出权，不把当日接受写成获救，也不把拒绝改写成惩罚。`
      : '';
    return {
      heroine,
      name:HEROINES[heroine].name,
      variant,
      title:EPILOGUES[heroine][variant].title,
      text:[fixedFate, arrangementEcho, invitationEcho, favorReckoningEcho, routeReckoningEcho, departureEcho, collapseEcho, allianceEcho, sharedNightAccordEcho, sharedFinaleEcho].filter(Boolean).join(' '),
      arrangements,
      invitationMemory,
      favorReckonings,
      favorReckoning,
      routeReckonings,
      routeReckoning,
      personalDeparture:personalDeparture ? structuredClone(personalDeparture) : null,
      collapseMemory:collapseMemory ? structuredClone(collapseMemory) : null,
      allianceMemory:allianceMemory ? structuredClone(allianceMemory) : null,
      sharedNightAccord:sharedNightAccord ? structuredClone(sharedNightAccord) : null,
      sharedFinaleMemory:sharedFinaleMemory ? structuredClone(sharedFinaleMemory) : null,
    };
  });
}

export function determineEnding(state) {
  const explicitByHeroine = Object.fromEntries(HEROINE_IDS.map((id) => [id, state.unlocked.includes(explicitSceneId(id))]));
  const qing = Object.fromEntries(HEROINE_IDS.map((id) => [id, state.relations[id].qing]));
  const sorted = HEROINE_IDS.slice().sort((a, b) => qing[b] - qing[a]);
  const relationTop = sorted[0];
  const finalNightHeroine = [...state.history].reverse().find((entry) => entry.type === 'night' && entry.day === MAX_DAY)?.heroine ?? null;
  const exclusiveCandidate = finalNightHeroine ?? relationTop;
  let top = relationTop;
  const coalitionPairsReady = JOINT_ACTIONS.every((choice) => bondValue(state, choice.participants[0], choice.participants[1]) >= COALITION_BOND_FLOOR);
  const covenantsReady = HEROINE_IDS.every((heroine) => routeStance(state, heroine).covenant >= COALITION_COVENANT_FLOOR);
  const finishedAlliance = state.allianceMembers?.length >= 2
    && state.allianceChoices?.length === ALLIANCE_NIGHT_BEATS.length
    ? { members: [...state.allianceMembers] }
    : null;
  // 双院／三院结局不再由数值在个人夜后自动弹出。只有亲自走完三拍联盟
  // 终章，才把成员与相处方式锁进结局；否则仍按个人或失稳路线收束。
  const alliance = finishedAlliance;
  const allianceStyle = finishedAlliance ? allianceNightStyle(state) : null;
  let id = 'unstable';
  if (
    state.day === MAX_DAY
    && recordedFivePriceSettlement(state)?.coalition.kind === 'full'
    && state.flags.harem_coalition
    && ACCORD_KEYS.every((key) => state.accords?.[key])
    && state.unlocked.includes('inner_court_accord')
    && state.unlocked.includes('inner_court_afterglow')
    && state.sharedAfterglowChoices.length === SHARED_AFTERGLOW_BEATS.length
    && SHARED_DAWN_CHOICE_IDS.has(state.sharedDawnChoice)
    && jointActionCount(state) >= JOINT_ACTION_TARGET
    && HEROINE_IDS.every((heroine) => jointParticipantCoverage(state).has(heroine))
    && coalitionProofStatus(state).every((row) => row.complete)
    && HEROINE_IDS.every((heroine) => state.unlocked.includes(preludeSceneId(heroine)))
    && coalitionPairsReady
    && covenantsReady
    && state.resolvedPressures.length >= PRESSURE_TARGET
    && HEROINE_IDS.every((heroine) => qing[heroine] >= 30 && state.relations[heroine].du < 70)
    && state.resources.house >= 45
    && publicPromisesReady(state)
  ) {
    id = 'balanced';
  } else if (alliance) {
    id = 'alliance';
  } else if (
    state.day === MAX_DAY
    && qing[exclusiveCandidate] >= 70
    && explicitByHeroine[exclusiveCandidate]
    && state.visits[exclusiveCandidate] >= 6
    && heroineAccordReady(state, exclusiveCandidate)
  ) {
    top = exclusiveCandidate;
    id = 'exclusive';
  } else if (state.day === MAX_DAY && state.secretsUsed.length >= 4 && (state.resources.power >= 5 || state.resources.silver >= INTRIGUE_SILVER)) {
    // 曝光不再是权谋的达成条件(F3:高曝光是代价,不是奖励),它只决定这一局的成色。
    id = 'intrigue';
  }
  const collapseChoice = state.collapseFinale?.choice
    ? collapseChoiceById(state.collapseFinale.cause, state.collapseFinale.choice)
    : null;
  if (collapseChoice && ['intrigue', 'unstable'].includes(state.collapseFinale.endingId)) {
    id = state.collapseFinale.endingId;
    top = relationTop;
  }
  const firstOpening = openingMemory(state);
  const firstOpeningEndingText = firstOpening?.endingTexts?.[id] ?? '';
  const publicAccountability = publicAccountabilityMemory(state);
  let text = ENDINGS[id].text;
  let intrigueCost = null;
  let missedBy = null;
  let coalitionStyle = null;
  const exclusiveStyle = id === 'exclusive' ? personalFinaleStyle(state) : null;
  const allianceMemberMemories = id === 'alliance' ? recordedAllianceNightMemberMemories(state) : [];
  const allianceTableau = id === 'alliance' ? recordedAllianceNightTableau(state) : null;
  const sharedNightAccord = id === 'balanced' ? recordedSharedNightAccord(state) : [];
  const sharedAfterglowTableau = id === 'balanced' ? recordedSharedAfterglowTableau(state) : null;
  const sharedFinaleMemories = id === 'balanced' ? recordedSharedFinaleHeroineMemories(state) : [];
  if (id === 'balanced') {
    const formalChoices = ['after_1_names', 'after_2_hear', 'after_3_pact', 'dawn_keep_pact']
      .filter((choice) => state.sharedAfterglowChoices.includes(choice) || state.sharedDawnChoice === choice).length;
    coalitionStyle = formalChoices >= 3 ? '五院议约' : formalChoices <= 1 ? '明账轮夜' : '各院有门';
    text = coalitionStyle === '五院议约'
      ? '五人把公事、夜宿与拒绝权分成三本账，每五日轮一人主持院议。谁都不是被收编的一房，亲近要经得起下一次同桌追问。'
      : coalitionStyle === '明账轮夜'
        ? '没有排出第一与末席。每晚去处当日明说，每个人都可改口、拒绝或独宿；后宫靠真话维持，不靠同一句情话复制五遍。'
        : '公事入正堂，私情留各院，去处却不再保密。五个人保留自己的门和钥匙，也约好冲突必须在下一顿饭前说开。';
    if (sharedNightAccord.length) {
      text = `${text} 同灯成立以前，五个人先把两日里的本人决定分别留在纸上：${sharedNightAccord.map((entry) => `${HEROINES[entry.heroine].short}第19日“${entry.day19.outcomeLabel}”，第20日以“${entry.day20.aftermathLabel}”把“${entry.day19.rightLabel}”落实为“${entry.day20.protectionLabel}”`).join('；')}。五份契据允许共同执行，不生成彼此代答权。`;
    }
    if (sharedAfterglowTableau) text = `${text} ${sharedAfterglowTableau.endingText}`;
    if (sharedFinaleMemories.length) {
      text = `${text} 共守四拍没有只留下“${coalitionStyle}”这个风格名：${sharedFinaleMemories.map((memory) => `${HEROINES[memory.heroine].short}依次以${[...memory.afterglow, memory.dawn].map((row) => `“${row.choiceLabel}”`).join('、')}接住贡献、同意、院约与白日执行`).join('；')}。`;
    }
  } else if (id === 'alliance') {
    const assembly = recordedAllianceAssembly(state);
    const outcomeLabel = { join:'留下', amend:'收窄后留下', withdraw:'自行回院' };
    const assemblyEcho = assembly
      ? `逐院问灯没有按分数裁人：${assembly.replies.map((reply) => `${HEROINES[reply.heroine].short}${outcomeLabel[reply.outcome]}`).join('、')}。${assembly.replies.filter((reply) => reply.outcome === 'withdraw').map((reply) => `${HEROINES[reply.heroine].short}带走${ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine][reply.outcome].object}`).join('；')}`
      : '';
    const memberEcho = allianceMemberMemories.length
      ? `三拍没有只留下一个风格名：${allianceMemberMemories.map((memory) => `${HEROINES[memory.heroine].short}依次以${memory.choices.map((row) => `“${row.choiceLabel}”`).join('、')}接住关系归属、本人边界与未入盟者权利`).join('；')}。`
      : '';
    text = [allianceEndingText(alliance.members, allianceStyle), assemblyEcho, memberEcho, allianceTableau?.endingText].filter(Boolean).join(' ');
  } else if (id === 'exclusive' && exclusiveStyle) {
    const styleKey = exclusiveStyle === '明账专情' ? 'open' : exclusiveStyle === '有界相守' ? 'bounded' : 'private';
    text = PERSONAL_FINALES[top].endings[styleKey];
  } else if (id === 'intrigue') {
    intrigueCost = collapseChoice && state.collapseFinale.endingId === 'intrigue'
      ? state.collapseFinale.endingDetail
      : state.resources.exposure >= EXPOSURE_LEDGERED ? 'burned' : state.resources.exposure >= EXPOSURE_STREET ? 'watched' : 'clean';
    text = ENDINGS.intrigue.texts[intrigueCost];
  } else if (id === 'unstable') {
    // F4:输要输得明白——按优先级回读具体差在哪一条,不再共用一句收尾。
    if (collapseChoice && state.collapseFinale.endingId === 'unstable') missedBy = state.collapseFinale.endingDetail;
    else if (qing[top] >= 70 && !explicitByHeroine[top]) missedBy = 'no_scene';
    else if (qing[top] >= 70) missedBy = 'second_too_close';
    else if (!publicPromisesReady(state) && HEROINE_IDS.some((heroine) => state.publicOverrides[heroine] > 0)) missedBy = 'broke_word';
    else if (state.secretsUsed.length >= 4) missedBy = 'not_enough_power';
    else missedBy = 'spread_thin';
    text = ENDINGS.unstable.texts[missedBy].replace('{name}', HEROINES[top].name);
  }
  const reckoning = state.flags.final_evidence_chain
    ? { label: '五证成案', text: '祝家外柜的重息与诱供被并成外案，往后即便再来追债，也不能再拿五院私话冒充合法账目。' }
    : state.flags.final_evidence_chain_limited
      ? { label: '盟内窄链', text: '实际结盟者只把彼此已经放行的片段接成窄链，盟外原件仍归本人；外柜的一部分造价被钉住，却没有谁把有限互证冒称五院成案。' }
      : state.flags.final_hard_evidence_only
        ? { label: '单页硬证', text: '正堂只交出无需共同授权的日期、纸脚与官面页序；外柜受到有限追问，五份私人材料却没有被一个终局按钮拼成共同证链。' }
    : state.flags.final_debt_paid
      ? { label: '本金两讫', text: '合法本金已经付清，假利息与买人价被当场划掉；第二本写满院门名字的账没有随银子一起出门。' }
      : state.flags.final_five_custody
        ? { label: '五人分账', text: '两本总账被五个人亲手拆开，外证各归经手、私话各归本人；祝家从此不能再用一册账替她们决定什么可以见光。' }
      : null;
  const publicEvidence = publicEvidenceOutcome(state);
  const dawnResponse = id === 'balanced' ? SHARED_DAWN_RESPONSES[state.sharedDawnChoice] ?? null : null;
  const personalDepartures = id === 'exclusive' ? recordedPersonalFinaleDepartureDetails(state) : [];
  const morningSettlements = recordedMorningSettlements(state);
  if (publicEvidence?.outcome?.echo) text = `${publicEvidence.outcome.echo} ${text}`;
  if (reckoning) text = `${reckoning.text} ${text}`;
  if (dawnResponse?.future) text = `${text} ${dawnResponse.future}`;
  if (collapseChoice) text = `${text} ${collapseChoice.endingText}`;
  if (personalDepartures.length) {
    const outcomeLabel = { accept:'接下程序', amend:'亲手改约', refuse:'自行收回' };
    const summary = personalDepartures.map((row) => `${HEROINES[row.heroine].short}对“${row.procedure.label}”${outcomeLabel[row.outcome]}，落字“${row.response.title}”`).join('；');
    text = `${text} 另外四院没有排队成全：${summary}。每个答案只处分${personalDepartures[0].procedure.focus}中真正属于本人的部分。`;
  }
  if (morningSettlements.length) {
    const summary = morningSettlements.map((row) => (
      `${HEROINES[row.heroine].short}的${row.object}${row.restored
        ? `留下实际恢复：${row.restoration}`
        : `仍由本人持有，“${row.restrictionLabel}”继续有效`}`
    )).join('；');
    text = `${text} 晨簿没有把日用与见光费用写成无主扣款：${summary}。`;
  }
  let routeResult = id === 'balanced' ? coalitionStyle : id === 'alliance'
    ? `${alliance.members.map((heroine) => HEROINES[heroine].short).join('、')}本人落席${allianceStyle ? ` · ${allianceStyle}` : ''}`
    : id === 'exclusive' ? ({
    wu_yueniang: state.flags.yue_private_pact ? '公私双簿' : state.flags.yue_final_pact || state.flags.yue_co_rule ? '五院轮签' : '一院灯深',
    pan_jinlian: state.flags.pan_private_pact ? '扇落即停' : state.flags.pan_final_pact || state.flags.pan_open_choice ? '真话每日可问' : '话已算数',
    li_pinger: state.flags.pinger_private_pact ? '退路仍通' : state.flags.pinger_final_pact || state.flags.pinger_same_chest ? '四锁分存' : '钥匙未收',
    meng_yulou: state.flags.meng_private_pact ? '空席可留' : state.flags.meng_final_pact ? '人情具名' : '名帖有名',
    sun_xuee: state.flags.xuee_private_pact ? '停灶由她' : state.flags.xuee_final_pact ? '烟火轮值' : '米账入册',
  })[top] + (exclusiveStyle ? ` · ${exclusiveStyle}` : '') : null;
  if (dawnResponse) routeResult = `${routeResult} · ${SHARED_DAWN_CHOICES.find((row) => row.id === state.sharedDawnChoice)?.label ?? '次晨落约'}`;
  if (collapseChoice) routeResult = `最后保住：${collapseChoice.label}`;
  const portablePrecedent = recordedPortablePrecedent(state);
  if (portablePrecedent) {
    routeResult = [routeResult, `第二契：${portablePrecedent.title}`].filter(Boolean).join(' · ');
    text = `${text} 第一桩联院差事留下的规矩后来被${portablePrecedent.outsider.name}亲手援引；两位原经手人分别作答，最终只以“${portablePrecedent.title}”处置那张具体副契，没有被写成普遍改制。`;
  }
  text = [text, firstOpeningEndingText, ...publicAccountability.map((row) => row.endingText)].filter(Boolean).join(' ');
  if (morningSettlements.length) {
    const unresolved = morningSettlements.filter((row) => !row.restored);
    routeResult = [
      routeResult,
      unresolved.length
        ? `晨簿未补：${unresolved.map((row) => `${HEROINES[row.heroine].short}·${row.object}`).join('、')}`
        : `晨簿已复核：${morningSettlements.map((row) => `${HEROINES[row.heroine].short}·${row.object}`).join('、')}`,
    ].filter(Boolean).join(' · ');
  }
  const exclusiveHeroine = id === 'exclusive' ? top : null;
  const epilogues = endingEpilogues(state, id, alliance?.members ?? null, exclusiveHeroine);
  const nightPatterns = HEROINE_IDS.map((heroine) => nightRelationshipPattern(state, heroine));
  return {
    id,
    title: id === 'alliance' ? ({ 2:'双院同灯', 3:'三院成盟', 4:'四院共席' })[alliance.members.length] : ENDINGS[id].title,
    tag: id === 'alliance' ? `${alliance.members.map((heroine) => HEROINES[heroine].name).join('、')}选择共同留下` : ENDINGS[id].tag,
    text,
    coalitionStyle,
    alliance: alliance?.members ?? null,
    allianceName: alliance?.members.map((heroine) => HEROINES[heroine].name).join('、') ?? null,
    allianceStyle,
    exclusiveStyle,
    intrigueCost,
    missedBy,
    reckoningResult: reckoning?.label ?? null,
    routeResult,
    heroine: exclusiveHeroine,
    heroineName: exclusiveHeroine ? HEROINES[exclusiveHeroine].name : null,
    finaleAsset: exclusiveHeroine ? PERSONAL_FINALES[exclusiveHeroine].asset : null,
    personalDepartures:structuredClone(personalDepartures),
    allianceMemberMemories:structuredClone(allianceMemberMemories),
    allianceTableau:allianceTableau ? structuredClone(allianceTableau) : null,
    sharedNightAccord:structuredClone(sharedNightAccord),
    sharedAfterglowTableau:sharedAfterglowTableau ? structuredClone(sharedAfterglowTableau) : null,
    sharedFinaleMemories:structuredClone(sharedFinaleMemories),
    portablePrecedent:portablePrecedent ? structuredClone(portablePrecedent) : null,
    morningSettlements:structuredClone(morningSettlements),
    epilogues,
    nightPatterns,
    dawnResult: dawnResponse ? {
      choice: state.sharedDawnChoice,
      title: dawnResponse.title,
    } : null,
    collapseResult: collapseChoice ? {
      cause: state.collapseFinale.cause,
      choice: collapseChoice.id,
      label: collapseChoice.label,
      memories:HEROINE_IDS.map((heroine) => collapseFinaleHeroineMemory(state, heroine)),
    } : null,
    openingMemory:firstOpeningEndingText ? { choice:firstOpening.choice, title:firstOpening.title, text:firstOpeningEndingText } : null,
    publicAccountability:structuredClone(publicAccountability),
    resources: { ...state.resources },
    relations: structuredClone(state.relations),
    householdResults: HOUSEHOLD_IDS.map((householdId) => {
      const ledger = householdId === 'li_jiaoer' ? jiaoerLedger(state) : null;
      return {
        id: householdId,
        name: HOUSEHOLD[householdId].name,
        result: ledger?.label ?? householdTier(state.household[householdId].regard),
        detail: ledger?.detail ?? '',
        outstanding: ledger?.outstanding ?? 0,
        regard: state.household[householdId].regard,
      };
    }),
    unlocked: [...state.unlocked],
    unseen: Object.keys(SCENES).filter((sceneId) => !state.unlocked.includes(sceneId)),
  };
}

// 场景册不应把真实走成的多人终章重新压回 data.js 里的静态简介。
// 这里只从已经封存的 ending 快照投影可序列化册页；不读取或改写当前流程游标。
export function endingSceneArchives(state) {
  if (state?.phase !== 'ending' || !state?.ending) return [];
  const ending = state.ending;
  const archives = [];
  const actionRows = (actions, members) => members.map((heroine) => ({
    heroine,
    label:HEROINES[heroine].name,
    text:actions?.[heroine] ?? '',
  })).filter((row) => row.text);

  if (ending.id === 'balanced'
    && Array.isArray(ending.sharedNightAccord)
    && ending.sharedNightAccord.length === HEROINE_IDS.length) {
    const accord = ending.sharedNightAccord;
    archives.push({
      scene:'inner_court_accord',
      key:`accord:${accord.map((entry) => [entry.heroine, entry.day19?.outcome, entry.day20?.aftermathChoice, entry.day20?.protection].join(':')).join('|')}`,
      title:'五份契据，各有原字',
      summary:'同灯不是五个人说了同一句话，而是五份第十九日答复、第二十日保护、本人院约与具名实绩同时经得起重看。',
      pages:accord.map((entry) => ({
        kicker:`第19日“${entry.day19.outcomeLabel}” · 第20日“${entry.day20.protectionLabel}”`,
        title:`${HEROINES[entry.heroine].name}亲手落印`,
        text:entry.conclusion,
        details:[...entry.reasons],
        actions:[
          { label:'本人边界', text:entry.boundary },
          { label:`第${entry.accord.day}日院约 · ${entry.accord.label}`, text:entry.accord.text },
          { label:'具名实绩', text:entry.proof.label },
        ],
      })),
    });
  }

  const shared = ending.id === 'balanced' ? ending.sharedAfterglowTableau : null;
  if (shared?.key && Array.isArray(shared.beats) && shared.beats.length === SHARED_AFTERGLOW_BEATS.length) {
    archives.push({
      scene:'inner_court_afterglow',
      key:`afterglow:${shared.key}`,
      title:shared.title,
      summary:shared.lead,
      pages:[{
        kicker:'本局真实三拍组合',
        title:shared.title,
        text:shared.lead,
        details:[`选择次序：${shared.beats.map((beat) => `“${beat.choiceLabel}”`).join(' → ')}`, shared.endingText],
        actions:[],
      }, ...shared.beats.map((beat) => ({
        kicker:`第${beat.index + 1}拍 · ${beat.beatTitle} · ${beat.choiceLabel}`,
        title:beat.title,
        text:beat.body,
        details:[beat.transition],
        actions:actionRows(beat.actions, HEROINE_IDS),
      }))],
    });
  }

  const alliance = ending.id === 'alliance' ? ending.allianceTableau : null;
  if (alliance?.key
    && Array.isArray(alliance.members)
    && [2, 3, 4].includes(alliance.members.length)
    && Array.isArray(alliance.beats)
    && alliance.beats.length === ALLIANCE_NIGHT_BEATS.length) {
    archives.push({
      scene:'inner_court_alliance',
      key:`alliance:${alliance.members.join('+')}:${alliance.key}`,
      title:alliance.title,
      summary:alliance.lead,
      pages:[{
        kicker:`${alliance.size}人本人落席 · 有限同盟`,
        title:alliance.title,
        text:alliance.lead,
        details:[`真实成员：${alliance.memberNames}`, alliance.endingText],
        actions:alliance.members.map((heroine) => ({
          heroine,
          label:HEROINES[heroine].name,
          text:'本人在逐院问灯后留下，才进入此后三拍共同生活。',
        })),
        nonmembers:(alliance.nonmembers ?? []).map((entry) => ({
          heroine:entry.heroine,
          label:HEROINES[entry.heroine]?.name ?? entry.heroine,
          kind:entry.kind,
          status:entry.label,
          object:entry.object,
          text:entry.text,
        })),
      }, ...alliance.beats.map((beat) => ({
        kicker:`第${beat.index + 1}问 · ${beat.beatTitle} · ${beat.choiceLabel}`,
        title:beat.title,
        text:beat.body,
        details:[beat.transition],
        actions:actionRows(beat.actions, alliance.members),
      }))],
    });
  }

  return archives;
}

export function endingAfterstoryArchive(state) {
  if (state?.phase !== 'ending'
    || !state?.ending
    || !Array.isArray(state.ending.epilogues)
    || state.ending.epilogues.length !== HEROINE_IDS.length
    || state.ending.epilogues.some((page, index) => page?.heroine !== HEROINE_IDS[index])) return null;
  const ending = state.ending;
  const pages = ending.epilogues.map((source) => {
    const page = structuredClone(source);
    // 这些单数兼容字段只是对应数组的末项；永久总账不重复存一份相同内容。
    delete page.ordinaryNight;
    delete page.pairMemory;
    delete page.favorReckoning;
    delete page.routeReckoning;
    delete page.openingMemory;
    return {
      ...page,
      kicker:`${HEROINES[page.heroine].house} · 一个月后`,
      name:HEROINES[page.heroine].name,
      asset:HEROINES[page.heroine].close,
    };
  });
  pages.push({
    heroine:null,
    kicker:'末页 · 一个月后',
    name:'宅门仍在运转',
    title:ending.title,
    body:ending.text,
    routeNote:`外账结法：${ending.reckoningResult || '尚未真正结清'}。关系结法：${ending.routeResult || ending.tag}。这不是“从此无事”，而是她们愿意怎样继续处理下一次偏爱、欠账与争执。`,
    relation:null,
    asset:ending.id === 'balanced' ? 'cg/group/inner_court_accord' : 'compound',
  });
  return {
    title:'五封一月笺',
    summary:'五个人各自怎样把二十日里的院约、亲近、横向关系、旧话、人情与本人边界带进下一个月；末页再单独留下宅门继续运转的办法。',
    pages,
  };
}

// 命数页不是静态资料页：前两页各有一次玩家处置，第二页还会生成九种
// “两页合看”结果，末页再把本局全部关系、责任与物件史重新编成分卷。
// 永久总账因此保存三页已经走成的精确投影，而不是只存两个 choice ID，
// 也不依赖以后某个新存档去重新推导旧局文本。
export function endingFateArchive(state) {
  const progress = state?.fateCoda;
  const lastPage = FATE_CODA.pages.length - 1;
  if (state?.phase !== 'ending'
    || !state?.ending
    || !progress
    || progress.page !== lastPage
    || !Array.isArray(progress.choices)
    || progress.choices.length !== lastPage
    || progress.choices.some((choiceId, index) => !FATE_CODA.pages[index].options.some((choice) => choice.id === choiceId))) return null;

  const choices = progress.choices.map((choiceId, index) => {
    const source = FATE_CODA.pages[index].options.find((choice) => choice.id === choiceId);
    return {
      page:index,
      kicker:FATE_CODA.pages[index].kicker,
      id:source.id,
      label:source.label,
      echo:source.echo,
      resultTitle:source.resultTitle,
      result:source.result,
    };
  });
  const pages = FATE_CODA.pages.map((_, pageIndex) => {
    const archivedState = structuredClone(state);
    archivedState.fateCoda = {
      page:pageIndex,
      choices:progress.choices.slice(0, Math.min(pageIndex + 1, lastPage)),
    };
    const page = currentFateCoda(archivedState);
    return {
      kicker:page.kicker,
      title:page.title,
      lead:page.lead,
      body:page.body,
      result:page.result ? structuredClone(page.result) : null,
      combination:page.combination ? structuredClone(page.combination) : null,
      finalSections:structuredClone(page.finalSections),
      page:page.page,
      count:page.count,
    };
  });
  const combination = FATE_CODA.choiceCombinations[progress.choices[0]][progress.choices[1]];
  return {
    key:progress.choices.join('+'),
    title:'原著命数三页',
    summary:`${choices.map((choice) => `“${choice.label}”`).join(' → ')}；两页合看为「${combination.title}」。`,
    choices,
    combination:structuredClone(combination),
    pages,
  };
}

export function startFateCoda(state) {
  if (state.phase !== 'ending' || !state.over || !state.ending) return { ok: false, error: '命数只能从已抵达的结局开始。' };
  if (state.fateCoda !== null) return { ok: false, error: '命数三页已经打开。' };
  state.fateCoda = { page: 0, choices: [] };
  return { ok: true };
}

function fateCodaInstitutionEcho(state) {
  const accordNames = Object.values(ACCORD_META)
    .filter((row) => state.accords?.[row.key])
    .map((row) => ({
      order: '月娘留下的正堂定账',
      truth: '金莲留下的去处真话',
      safety: '瓶儿留下的私钥归属',
      grace: '玉楼留下的功劳署名',
      hearth: '雪娥留下的停灶与工账',
    })[row.key]);
  const accordCount = accordNames.length;
  const covenant = Object.values(state.routeStances ?? {}).reduce((sum, row) => sum + (row?.covenant ?? 0), 0);
  const privateCount = Object.values(state.routeStances ?? {}).reduce((sum, row) => sum + (row?.private ?? 0), 0);
  const publicProof = ['harem_coalition', ...Object.keys(state.flags ?? {}).filter((key) => key.includes('public') || key.includes('balance'))]
    .some((key) => state.flags?.[key]);
  const accordEcho = accordCount
    ? `二十日里真正立过的${accordNames.join('、')}没有救回死者，却让后来的人仍能据此拒绝被并账。`
    : '二十日里没有一条院约真正落稳；离散来时，每个人只能凭自己还握得住的物件作证。';
  const departures = recordedPersonalFinaleDepartureDetails(state);
  const departureEcho = state.ending?.id === 'exclusive' && departures.length
    ? ` 专情落下时，${departures.map((row) => {
      return `${HEROINES[row.heroine].short}面对“${row.procedure.label}”，以“${row.response.title}”处分${row.procedure.focus}`;
    }).join('；')}。当时核验的院约、路线、关系与偏宠旧案仍逐项留在各自笺里；后来家业散去，这四份权利也不归被选一院代管。`
    : '';
  const precedent = recordedPortablePrecedent(state);
  const precedentEcho = precedent ? ` 第二契回到${precedent.object.portable}：${precedent.replies.map((reply) => `${HEROINES[reply.heroine].short}“${({stand:'守原规',narrow:'只放窄界',withdraw:'撤回外推'})[reply.outcome]}”`).join('、')}。${precedent.disposition}；它只记下${precedent.outsider.name}与这一张具体契的去处，没有变成天下通例。` : '';
  const assembly = recordedAllianceAssembly(state);
  const assemblyEcho = assembly ? ` 逐院问灯仍按本人答案留账：${assembly.replies.map((reply) => {
    const voice = ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine][reply.outcome];
    return `${HEROINES[reply.heroine].short}“${voice.title}”，${voice.object}`;
  }).join('；')}。后来家业散去，盟内只能承接真实成员共同认领的部分，不能吞并回院者带走的原物。` : '';
  const morningSettlements = recordedMorningSettlements(state);
  const morningEcho = morningSettlements.length ? ` 晨簿里具名收回的物件也各有去处：${morningSettlements.map((row) => (
    `${HEROINES[row.heroine].short}的${row.object}${row.restored
      ? `留下实际恢复：${row.restoration}`
      : `仍归本人，“${row.restrictionLabel}”没有随家业散去而被假称解决`}`
  )).join('；')}。` : '';
  if (publicProof || accordCount >= 4 || covenant > privateCount) return `${accordEcho} 公约与互证多于私下许诺，散局后仍有人能据抄件追问经手者。${departureEcho}${precedentEcho}${assemblyEcho}${morningEcho}`;
  if (privateCount > covenant) return `${accordEcho} 更多决定留在院门以内；散局时，私契保住了退路，也让共同追问变得更难。${departureEcho}${precedentEcho}${assemblyEcho}${morningEcho}`;
  return `${accordEcho} 公约与私门势均，最后能留下多少，要看每一份证物是否真有经手人。${departureEcho}${precedentEcho}${assemblyEcho}${morningEcho}`;
}

function fateCodaFinalSections(state, progress, heroineFates, jiaoerFate, firstOpening, publicAccountability, pairMemories) {
  const labels = FATE_CODA.finalSections;
  const ending = ENDINGS[state.ending?.id];
  const choiceEntries = progress.choices.flatMap((id, index) => {
    const page = FATE_CODA.pages[index];
    const option = page?.options.find((row) => row.id === id);
    return option ? [{ label:page.kicker, title:option.label, text:option.echo }] : [];
  });
  const combination = FATE_CODA.choiceCombinations[progress.choices[0]]?.[progress.choices[1]] ?? null;
  if (combination) choiceEntries.push({ label:'两页合看', title:combination.title, text:combination.text });
  const accountabilityEntries = [
    ...(firstOpening ? [{ label:'第一日', title:firstOpening.title, text:firstOpening.fateText }] : []),
    ...publicAccountability.map((row) => ({ label:`第${row.day}日公议`, title:row.label, text:row.fateText })),
  ];
  return [
    {
      id:'relationship', ...labels.relationship,
      entries:ending ? [{ label:'二十日结局', title:ending.title, text:FATE_CODA.endingEchoes[state.ending.id] }] : [],
    },
    {
      id:'heroines', ...labels.heroines,
      entries:heroineFates.map((row) => ({ label:row.name, title:row.title, text:row.text })),
    },
    {
      id:'jiaoer', ...labels.jiaoer,
      entries:jiaoerFate ? [{ label:jiaoerFate.ledger.label, title:jiaoerFate.label, text:jiaoerFate.text }] : [],
    },
    { id:'choices', ...labels.choices, entries:choiceEntries },
    {
      id:'institution', ...labels.institution,
      entries:[
        { label:'五院旧例', title:'院约、私门与经手', text:fateCodaInstitutionEcho(state) },
        ...(pairMemories.length ? [{
          label:'双院落约',
          title:`${pairMemories.length}组横向关系没有随散局抹平`,
          text:`${pairMemories.map((memory) => `第${memory.day}日，${memory.leftName}与${memory.rightName}以“${memory.label}”落下「${memory.title}」，${memory.witnessName}见证：${memory.memory}`).join('；')}。这些记录只说明两院曾怎样相处，不把一组关系扩成全宅授权，也不改写任何人的固定命数。`,
        }] : []),
      ],
    },
    { id:'accountability', ...labels.accountability, entries:accountabilityEntries },
  ].filter((section) => section.entries.length > 0);
}

export function currentFateCoda(state) {
  const progress = state.fateCoda;
  const page = progress ? FATE_CODA.pages[progress.page] : null;
  if (!page) return null;
  const lastPage = progress.page === FATE_CODA.pages.length - 1;
  const firstOpening = lastPage ? openingMemory(state) : null;
  const publicAccountability = lastPage ? publicAccountabilityMemory(state) : [];
  const heroineFates = lastPage ? fateHeroineMemories(state) : [];
  const jiaoerFate = lastPage ? jiaoerFateMemory(state) : null;
  const pairMemories = lastPage ? pairInterludeLedger(state) : [];
  const choiceId = progress.choices[progress.page] ?? null;
  const choice = page.options.find((row) => row.id === choiceId) ?? null;
  const combination = progress.page === 1 && choice
    ? FATE_CODA.choiceCombinations[progress.choices[0]]?.[choice.id] ?? null
    : null;
  const finalSections = lastPage
    ? fateCodaFinalSections(state, progress, heroineFates, jiaoerFate, firstOpening, publicAccountability, pairMemories)
    : [];
  const finalEcho = finalSections.flatMap((section) => section.entries.map((entry) => entry.text)).join(' ');
  return {
    kicker: page.kicker,
    title: page.title,
    lead:page.body,
    body: [page.body, finalEcho].filter(Boolean).join('\n\n'),
    question: page.question,
    awaitingChoice: page.options.length > 0 && choice === null,
    resolved: page.options.length === 0 || choice !== null,
    current: choice,
    choice,
    result:choice ? { choice:choice.id, title:choice.resultTitle, body:choice.result } : null,
    combination:combination ? { title:combination.title, text:combination.text } : null,
    openingMemory:firstOpening ? { choice:firstOpening.choice, title:firstOpening.title, text:firstOpening.fateText } : null,
    publicAccountability:structuredClone(publicAccountability),
    heroineFates:structuredClone(heroineFates),
    pairMemories:structuredClone(pairMemories),
    jiaoerFate:jiaoerFate ? structuredClone(jiaoerFate) : null,
    finalSections:structuredClone(finalSections),
    page: progress.page,
    count: FATE_CODA.pages.length,
  };
}

export function fateCodaOptions(state) {
  return currentFateCoda(state)?.awaitingChoice ? [...FATE_CODA.pages[state.fateCoda.page].options] : [];
}

export function chooseFateCoda(state, choiceId) {
  const current = currentFateCoda(state);
  if (!current || !current.awaitingChoice) return { ok: false, error: '这一页没有待选的命数处置。' };
  const choice = FATE_CODA.pages[state.fateCoda.page].options.find((row) => row.id === choiceId);
  if (!choice) return { ok: false, error: '没有这个命数选择。' };
  state.fateCoda.choices.push(choice.id);
  record(state, 'fate_coda', { page: state.fateCoda.page, choice: choice.id });
  return { ok: true };
}

export function advanceFateCoda(state) {
  const current = currentFateCoda(state);
  if (!current) return { ok: false, error: '命数三页尚未打开。' };
  if (!current.resolved) return { ok: false, error: '先决定这一页如何留账。' };
  if (state.fateCoda.page >= FATE_CODA.pages.length - 1) return { ok: false, error: '命数三页已经读完。' };
  state.fateCoda.page += 1;
  return { ok: true };
}

export function serialize(state) {
  return JSON.stringify(state);
}

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasFiniteFields = (value, keys) => isRecord(value) && keys.every((key) => Number.isFinite(value[key]));
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

function validExternalAuditSnapshot(snapshot) {
  return hasExactKeys(snapshot, ['resources', 'relations'])
    && hasExactKeys(snapshot.resources, RESOURCE_KEYS)
    && hasFiniteFields(snapshot.resources, RESOURCE_KEYS)
    && hasExactKeys(snapshot.relations, HEROINE_IDS)
    && HEROINE_IDS.every((id) => (
      hasExactKeys(snapshot.relations[id], ['qing', 'yu', 'du', 'ignored', 'reasons'])
      && hasFiniteFields(snapshot.relations[id], ['qing', 'yu', 'du', 'ignored'])
      && Number.isInteger(snapshot.relations[id].ignored)
      && snapshot.relations[id].ignored >= 0
      && Array.isArray(snapshot.relations[id].reasons)
      && snapshot.relations[id].reasons.length <= 3
      && snapshot.relations[id].reasons.every((reason) => typeof reason === 'string')
    ));
}

// 资源与关系不能相信存档自带的“变动清单”：从 seed 起按真实 history 重走同一套
// 引擎动作，并逐条核对新生成的 history，最后只接受重演出的终态。
function replayRecordedEffects(target) {
  const replay = newGame(target.seed);
  const call = (result) => result?.ok === true;
  let externalAudit = null;
  for (let guard = 0; guard < 4000; guard += 1) {
    const personalFinaleCursorMatches = target.phase !== 'personal_finale_result'
      || replay.personalFinale?.departureBeat === target.personalFinale?.departureBeat;
    const portablePrecedentCursorMatches = target.phase !== 'portable_precedent'
      || (replay.portablePrecedent?.action === target.portablePrecedent?.action
        && replay.portablePrecedent?.sourceDay === target.portablePrecedent?.sourceDay
        && replay.portablePrecedent?.beat === target.portablePrecedent?.beat
        && replay.portablePrecedent?.choice === target.portablePrecedent?.choice);
    const allianceAssemblyCursorMatches = target.phase !== 'alliance_assembly'
      || replay.allianceAssembly?.beat === target.allianceAssembly?.beat;
    const morningSettlementCursorMatches = target.phase !== 'morning_settlement'
      || (replay.morningSettlement?.cause === target.morningSettlement?.cause
        && replay.morningSettlement?.sourceDay === target.morningSettlement?.sourceDay
        && replay.morningSettlement?.sourceId === target.morningSettlement?.sourceId
        && replay.morningSettlement?.heroine === target.morningSettlement?.heroine
        && replay.morningSettlement?.choice === target.morningSettlement?.choice);
    const crisisCursorMatches = target.phase !== 'crisis'
      || (replay.currentCrisis?.event === target.currentCrisis?.event
        && replay.currentCrisis?.type === target.currentCrisis?.type
        && replay.currentCrisis?.act === target.currentCrisis?.act
        && replay.currentCrisis?.replyBeat === target.currentCrisis?.replyBeat
        && JSON.stringify(replay.currentCrisis?.replies) === JSON.stringify(target.currentCrisis?.replies));
    const collapseCursorMatches = !['collapse_finale', 'collapse_finale_result'].includes(target.phase)
      || replay.collapseFinale?.beat === target.collapseFinale?.beat;
    if (replay.history.length === target.history.length
      && replay.day === target.day
      && replay.phase === target.phase
      && personalFinaleCursorMatches
      && portablePrecedentCursorMatches
      && allianceAssemblyCursorMatches
      && morningSettlementCursorMatches
      && crisisCursorMatches
      && collapseCursorMatches) {
      return { final:authoritativeEffectSnapshot(replay), externalAudit };
    }
    const beforeHistory = replay.history.length;
    const next = target.history[replay.history.length] ?? null;
    let ok = false;
    switch (replay.phase) {
      case 'opening':
        ok = next?.type === 'opening' && call(chooseOpening(replay, next.choice));
        break;
      case 'opening_aftermath':
        ok = call(advanceOpeningAftermath(replay));
        break;
      case 'crisis': {
        const story = currentHouseCrisis(replay);
        ok = story?.awaitingReply
          ? next?.type === 'house_crisis_reply' && call(advanceHouseCrisisReply(replay))
          : next?.type === 'house_crisis' && call(resolveHouseCrisis(replay, next.structureId ?? next.choice));
        break;
      }
      case 'crisis_aftermath': {
        const story = currentHouseCrisisAftermath(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'house_crisis_aftermath' && call(resolveHouseCrisisAftermath(replay, next.choice))
          : call(advanceHouseCrisisAftermath(replay));
        break;
      }
      case 'pair_interlude': {
        const story = currentPairInterlude(replay);
        ok = story?.resolution === null && story.beat >= story.count - 1
          ? next?.type === 'pair_interlude' && call(resolvePairInterlude(replay, next.choice))
          : call(advancePairInterlude(replay));
        break;
      }
      case 'morning': {
        const story = currentMorningStory(replay);
        const resolution = currentMorningResolution(replay);
        if (story && story.index < story.count - 1) ok = call(advanceMorningStory(replay));
        else if (resolution) ok = call(continueMorningResolution(replay));
        else ok = next?.type === 'morning' && call(resolveMorning(replay, next.choice));
        break;
      }
      case 'morning_settlement': {
        const settlement = currentMorningSettlement(replay);
        ok = settlement?.awaitingChoice
          ? next?.type === 'morning_settlement' && call(chooseMorningSettlement(replay, next.choice))
          : call(advanceMorningSettlement(replay));
        break;
      }
      case 'favor_reckoning': {
        const story = currentFavorReckoning(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'favor_reckoning' && call(resolveFavorReckoning(replay, next.choice))
          : call(advanceFavorReckoning(replay));
        break;
      }
      case 'memory_reckoning': {
        const story = currentMemoryReckoning(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'memory_reckoning' && call(resolveMemoryReckoning(replay, next.choice))
          : call(advanceMemoryReckoning(replay));
        break;
      }
      case 'act_transition':
        ok = next?.type === 'act_transition' && call(resolveActTransition(replay, next.choice));
        break;
      case 'act_aftermath': {
        const story = currentActAftermath(replay);
        if (story?.awaitingChoice) {
          ok = next?.type === 'external_rebuttal' && call(resolveActAftermath(replay, next.choice));
          if (ok) externalAudit = {
            before:structuredClone(replay.externalEffectAudit.before),
            after:structuredClone(replay.externalEffectAudit.after),
          };
        } else ok = call(advanceActAftermath(replay));
        break;
      }
      case 'day':
        if (next?.type === 'day_action') {
          if (next.secretUsed && !call(selectSecret(replay, next.secretUsed))) break;
          ok = call(chooseDayAction(replay, next.action));
        } else if (next?.type === 'joint_action') ok = call(chooseJointAction(replay, next.action));
        break;
      case 'day_aftermath':
        ok = call(advanceDayAftermath(replay));
        break;
      case 'joint_result':
        ok = call(continueJointAction(replay));
        break;
      case 'portable_precedent': {
        const story = currentPortablePrecedent(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'portable_precedent' && call(choosePortablePrecedent(replay, next.choice))
          : call(advancePortablePrecedent(replay));
        break;
      }
      case 'household':
        ok = next?.type === 'household' && call(resolveHouseholdEvent(replay, next.choice));
        break;
      case 'household_aftermath': {
        const story = currentHouseholdAftermath(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'household_aftermath' && call(resolveHouseholdAftermath(replay, next.choice))
          : call(advanceHouseholdAftermath(replay));
        break;
      }
      case 'council':
        ok = next?.type === 'council' && call(resolveCouncil(replay, next.choice));
        break;
      case 'council_aftermath':
        ok = call(advanceCouncilAftermath(replay));
        break;
      case 'banquet':
        ok = next?.type === 'banquet' && call(chooseBanquet(replay, next.choice));
        break;
      case 'public_evidence': {
        const targetEvidence = target.history.find((entry) => entry.type === 'public_evidence_chain');
        const progress = currentPublicEvidence(replay);
        if (!targetEvidence || !progress) break;
        if (progress.selected.length < targetEvidence.chain.length) {
          ok = call(choosePublicEvidence(replay, targetEvidence.chain[progress.selected.length]));
        } else ok = call(completePublicEvidence(replay));
        break;
      }
      case 'public_followup':
        ok = next?.type === 'public_followup' && call(resolvePublicFollowup(replay, next.choice));
        break;
      case 'public_aftermath':
        ok = call(advancePublicAftermath(replay));
        break;
      case 'five_private_prices': {
        const story = currentFivePrivatePrices(replay);
        if (story?.awaitingChoice && story.stage === 'protocol') {
          ok = next?.type === 'five_price_protocol' && call(chooseFivePrivatePriceProtocol(replay, next.protocol));
        } else if (story?.awaitingChoice && story.stage === 'right') {
          ok = next?.type === 'five_price_settlement' && call(chooseFivePrivatePriceRight(replay, next.right));
        } else ok = call(advanceFivePrivatePrices(replay));
        break;
      }
      case 'final_reckoning':
        ok = next?.type === 'final_reckoning' && call(resolveFinalReckoning(replay, next.choice));
        break;
      case 'final_aftermath': {
        const story = currentFinalReckoningAftermath(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'final_reckoning_aftermath' && call(resolveFinalReckoningAftermath(replay, next.choice))
          : call(advanceFinalReckoningAftermath(replay));
        break;
      }
      case 'dusk_invitation':
        ok = next?.type === 'dusk_invitation' && call(resolveDuskInvitation(replay, next.choice));
        break;
      case 'dusk_invitation_aftermath': {
        const story = currentDuskInvitationAftermath(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'dusk_invitation_aftermath' && call(resolveDuskInvitationAftermath(replay, next.choice))
          : call(advanceDuskInvitationAftermath(replay));
        break;
      }
      case 'choose_visit':
        if (next?.type === 'visit_start') ok = call(startVisit(replay, next.heroine));
        else if (next?.type === 'alliance_assembly') ok = call(startAllianceNight(replay));
        else if (next?.type === 'shared_night_start') ok = call(startSharedNight(replay));
        break;
      case 'visit':
        if (next?.type === 'accord_term' || next?.type === 'visit_choice') ok = call(chooseVisit(replay, next.choice));
        break;
      case 'route_aftermath': {
        const story = currentRouteAftermath(replay);
        if (story?.storyBeat || story?.resolutionBeat) ok = call(advanceRouteAftermath(replay));
        else ok = next?.type === 'route_aftermath' && call(resolveRouteAftermath(replay, next.choice));
        break;
      }
      case 'night': {
        const conversation = currentNightConversation(replay);
        const coda = currentOrdinaryNightCoda(replay);
        if (conversation) {
          if (conversation.resolution) ok = call(continueNightConversation(replay));
          else if (conversation.beat >= 1) ok = next?.type === 'night_conversation' && call(chooseNightConversation(replay, next.choice));
          else ok = call(advanceNightConversation(replay));
        } else if (coda) ok = call(advanceOrdinaryNightCoda(replay));
        else ok = next?.type === 'night' && call(chooseNight(replay, next.action));
        break;
      }
      case 'scene':
        ok = call(closeScene(replay));
        break;
      case 'personal_afterglow':
        ok = next?.type === 'personal_afterglow' && call(choosePersonalAfterglow(replay, next.choice));
        break;
      case 'personal_afterglow_aftermath': {
        const story = currentPersonalAfterglowAftermath(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'personal_afterglow_aftermath' && call(resolvePersonalAfterglowAftermath(replay, next.choice))
          : call(advancePersonalAfterglowAftermath(replay));
        break;
      }
      case 'personal_finale':
        ok = next?.type === 'personal_finale' && call(choosePersonalFinale(replay, next.choice));
        break;
      case 'personal_finale_result':
        ok = call(continuePersonalFinaleResult(replay));
        break;
      case 'alliance_assembly':
        ok = call(advanceAllianceAssembly(replay));
        break;
      case 'alliance_night':
        ok = next?.type === 'alliance_night' && call(chooseAllianceNight(replay, next.choice));
        break;
      case 'alliance_night_result':
        ok = call(continueAllianceNightResult(replay));
        break;
      case 'shared_night':
        ok = next?.type === 'shared_night' && call(chooseSharedNight(replay, next.choice));
        break;
      case 'shared_afterglow':
        ok = next?.type === 'shared_afterglow' && call(chooseSharedAfterglow(replay, next.choice));
        break;
      case 'shared_afterglow_result':
        ok = call(continueSharedAfterglowResult(replay));
        break;
      case 'shared_dawn':
        ok = next?.type === 'shared_dawn' && call(chooseSharedDawn(replay, next.choice));
        break;
      case 'shared_dawn_result':
        ok = call(continueSharedDawnResult(replay));
        break;
      case 'collapse_finale': {
        const story = currentCollapseFinale(replay);
        ok = story?.awaitingChoice
          ? next?.type === 'collapse_finale' && call(chooseCollapseFinale(replay, next.choice))
          : call(advanceCollapseFinale(replay));
        break;
      }
      case 'collapse_finale_result':
        ok = call(continueCollapseFinaleResult(replay));
        break;
      case 'ending':
        if (next?.type === 'fate_coda') {
          if (!replay.fateCoda && !call(startFateCoda(replay))) break;
          while (replay.fateCoda.page < next.page && call(advanceFateCoda(replay))) { /* deterministic page advance */ }
          ok = call(chooseFateCoda(replay, next.choice));
        }
        break;
      default:
        break;
    }
    if (!ok) return null;
    for (let index = beforeHistory; index < replay.history.length; index += 1) {
      if (JSON.stringify(replay.history[index]) !== JSON.stringify(target.history[index])) return null;
    }
    if (replay.history.length > target.history.length) return null;
  }
  return null;
}

function validExternalEffectAudit(state, rows) {
  const historyReplay = replayRecordedEffects(state);
  const currentSnapshot = authoritativeEffectSnapshot(state);
  if (!historyReplay || JSON.stringify(historyReplay.final) !== JSON.stringify(currentSnapshot)) return false;
  if (!rows.length) return state.externalEffectAudit === null && historyReplay.externalAudit === null;
  const row = rows[0];
  const audit = state.externalEffectAudit;
  const choice = externalRebuttalChoiceById(row.sourceResult, row.choice);
  const expectedReason = choice ? `三口复案：${choice.label}` : '';
  if (!choice
    || !hasExactKeys(audit, ['event', 'choice', 'reason', 'before', 'after'])
    || audit.event !== row.event
    || audit.choice !== row.choice
    || audit.reason !== expectedReason
    || !validExternalAuditSnapshot(audit.before)
    || !validExternalAuditSnapshot(audit.after)) return false;
  const expectedAfter = structuredClone(audit.before);
  applyResourceDelta(expectedAfter.resources, choice.effects);
  for (const [id, delta] of Object.entries(choice.effects?.relAll ?? {})) {
    if (!HEROINE_IDS.includes(id)) return false;
    applyRelationDelta(expectedAfter.relations[id], delta, expectedReason);
  }
  if (JSON.stringify(expectedAfter) !== JSON.stringify(audit.after)) return false;
  return historyReplay.externalAudit !== null
    && JSON.stringify(historyReplay.externalAudit.before) === JSON.stringify(audit.before)
    && JSON.stringify(historyReplay.externalAudit.after) === JSON.stringify(audit.after);
}

const OPENING_CHOICE_IDS = new Set(OPENING_CHOICES.map((choice) => choice.id));
const ROUTE_CHOICE_IDS = Object.freeze(Object.fromEntries(HEROINE_IDS.map((id) => [
  id,
  new Set([...allRouteChoices(id).map((choice) => choice.id), ACCORD_CHOICES[id]?.id].filter(Boolean)),
])));
const routeChoiceById = (heroineId, choiceId) => [
  ...allRouteChoices(heroineId), ACCORD_CHOICES[heroineId],
].find((choice) => choice?.id === choiceId) ?? null;
const HISTORY_TYPES = new Set([
  'opening', 'act_transition', 'day_action', 'joint_action', 'portable_precedent', 'household', 'household_aftermath', 'council', 'banquet', 'visit_start',
  'public_evidence_chain', 'public_followup', 'external_rebuttal', 'five_price_protocol', 'five_price_settlement', 'final_reckoning', 'final_reckoning_aftermath', 'dusk_invitation', 'dusk_invitation_aftermath', 'accord_term', 'visit_choice', 'route_aftermath', 'night', 'night_coda', 'night_conversation', 'personal_afterglow', 'personal_afterglow_aftermath', 'personal_finale', 'house_crisis_reply', 'house_crisis', 'house_crisis_aftermath', 'pair_interlude', 'morning', 'favor_reckoning', 'memory_reckoning', 'shared_night_start',
  'alliance_assembly', 'alliance_night_start', 'alliance_night', 'shared_night', 'shared_afterglow', 'shared_dawn', 'route_break', 'upkeep_short', 'collector', 'morning_settlement', 'morning_settlement_use', 'morning_settlement_restore',
  'collapse_finale_start', 'collapse_finale',
  'fate_coda',
]);
const KNOWN_SECRET_IDS = new Set([
  ...DAY_DEFS.map((day) => day.intel.id),
  'steward_gap', 'yue_backing', 'merchant_route', 'pan_rumor', 'meng_guest_list',
  'xuee_storehouse_mark', 'collector_floor', 'draft_mark', 'escape_route',
  'guest_obligations', 'kitchen_witness', 'labor_copy', 'old_deed', 'pinger_funds', 'shop_fraud',
]);

function validHistoryEntry(entry, maxDay, seed) {
  if (!isRecord(entry) || !Number.isInteger(entry.day) || entry.day < 1 || entry.day > maxDay || !HISTORY_TYPES.has(entry.type)) return false;
  if (entry.type === 'opening') return entry.day === 1 && OPENING_CHOICE_IDS.has(entry.choice);
  if (entry.type === 'fate_coda') {
    return entry.day === MAX_DAY
      && Number.isInteger(entry.page)
      && entry.page >= 0
      && entry.page < FATE_CODA.pages.length - 1
      && FATE_CODA.pages[entry.page].options.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'act_transition') {
    const event = ACT_TRANSITIONS[entry.day];
    const baseValid = !!event
      && entry.event === event.id
      && event.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.participants) === JSON.stringify(event.participants);
    if (!baseValid) return false;
    if (entry.day !== 11) return hasExactKeys(entry, ['day','type','event','choice','participants']);
    return hasExactKeys(entry, ['day','type','event','choice','participants','sourceChoice'])
      && PUBLIC_FOLLOWUPS[10].choices.some((choice) => choice.id === entry.sourceChoice);
  }
  if (entry.type === 'external_rebuttal') {
    const event = EXTERNAL_REBUTTALS[entry.sourceResult];
    const choice = externalRebuttalChoiceById(entry.sourceResult, entry.choice);
    return entry.day === 16
      && hasExactKeys(entry, ['day', 'type', 'event', 'sourceResult', 'sourceChain', 'actChoice', 'choice', 'actors'])
      && !!event
      && entry.event === event.id
      && structurallyValidPublicEvidenceResult(entry.sourceChain, entry.sourceResult)
      && ACT_TRANSITIONS[16].choices.some((row) => row.id === entry.actChoice)
      && !!choice
      && JSON.stringify(entry.actors) === JSON.stringify(EXTERNAL_REBUTTAL_ACTORS.map((actor) => actor.id));
  }
  if (entry.type === 'day_action') {
    const move = DAY_AGENDAS[entry.day - 1]?.actions?.[entry.action];
    const rule = pressureRuleFor(seed, entry.day);
    const favor = DAY_FAVOR_SOLUTIONS[entry.day - 1];
    const clean = rule?.counter === entry.action;
    const recoveryOnly = entry.action === 'office'
      && typeof entry.executionText === 'string'
      && !entry.executionText.startsWith(move?.text ?? '');
    const borrowed = !recoveryOnly && !clean
      && entry.day <= MAX_DAY - 2
      && favor?.action === entry.action
      && entry.resolution === 'favor';
    const expectedResolution = recoveryOnly ? 'miss' : clean ? 'clean' : borrowed ? 'favor' : 'miss';
    const network = dayNetworkChanges(entry.day, entry.action, move?.actor);
    const crossTalk = move?.actor ? dayNetworkReaction(move.actor, network) : '';
    return !!DAY_ACTIONS[entry.action]
      && !!move
      && entry.actor === move.actor
      && typeof entry.text === 'string'
      && typeof entry.executionText === 'string'
      && (entry.executionText.startsWith(move.text) || recoveryOnly)
      && typeof entry.outcomeText === 'string'
      && entry.text === [entry.executionText, crossTalk, entry.outcomeText].filter(Boolean).join(' ')
      && entry.resolution === expectedResolution
      && entry.resolved === (expectedResolution !== 'miss')
      && entry.favorHeroine === (borrowed ? favor.heroine : null)
      && entry.favorObserver === (borrowed ? favor.observer : null)
      && JSON.stringify(entry.network) === JSON.stringify(network)
      && (entry.action === 'office'
        ? recoveryOnly ? entry.secretUsed === null : entry.secretUsed === null || KNOWN_SECRET_IDS.has(entry.secretUsed)
        : entry.secretUsed === null);
  }
  if (entry.type === 'joint_action') {
    const choice = JOINT_ACTIONS.find((row) => row.id === entry.action);
    return !!choice && entry.resolved === true && JSON.stringify(entry.participants) === JSON.stringify(choice.participants);
  }
  if (entry.type === 'portable_precedent') {
    const event = PORTABLE_PRECEDENTS[entry.action];
    const joint = JOINT_ACTIONS.find((row) => row.id === entry.action);
    return hasExactKeys(entry, ['day','type','event','action','sourceDay','outsider','participants','replies','choice','scope'])
      && !!event && !!joint
      && entry.event === event.id
      && entry.outsider === event.outsider.id
      && Number.isInteger(entry.sourceDay) && entry.sourceDay >= 1 && entry.sourceDay <= entry.day
      && JSON.stringify(entry.participants) === JSON.stringify(joint.participants)
      && Array.isArray(entry.replies) && entry.replies.length === 2
      && entry.replies.every((reply) => hasExactKeys(reply, ['heroine','outcome'])
        && joint.participants.includes(reply.heroine) && PORTABLE_PRECEDENT_OUTCOMES.has(reply.outcome))
      && PORTABLE_PRECEDENT_CHOICE_IDS.has(entry.choice)
      && entry.scope === portablePrecedentScope(entry.choice, entry.replies);
  }
  if (entry.type === 'household') {
    const event = HOUSEHOLD_EVENTS[entry.day];
    return !!event && entry.event === event.id && entry.actor === event.actor && event.choices.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'household_aftermath') {
    const event = HOUSEHOLD_EVENTS[entry.day];
    const chapter = JIAOER_AFTERMATHS[entry.approach];
    return !!event
      && entry.event === event.id
      && entry.actor === event.actor
      && event.choices.some((choice) => choice.id === entry.approach)
      && !!chapter
      && chapter.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.witnesses) === JSON.stringify(chapter.witnesses);
  }
  if (entry.type === 'council') {
    const event = COUNCIL_EVENTS[entry.day];
    return !!event
      && entry.event === event.id
      && event.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.participants) === JSON.stringify(event.participants);
  }
  if (entry.type === 'banquet') {
    const event = PUBLIC_EVENTS[entry.day];
    return !!event && entry.event === event.id && event.choices.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'public_evidence_chain') {
    return entry.day === 15
      && entry.event === PUBLIC_EVIDENCE_CHAIN.id
      && structurallyValidPublicEvidenceResult(entry.chain, entry.result);
  }
  if (entry.type === 'public_followup') {
    const event = PUBLIC_FOLLOWUPS[entry.day];
    return !!event
      && entry.event === event.id
      && event.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.participants) === JSON.stringify(event.participants);
  }
  if (entry.type === 'five_price_protocol') {
    return entry.day === 19
      && hasExactKeys(entry, ['day','type','event','protocol','replies'])
      && entry.event === FIVE_PRIVATE_PRICES.id
      && FIVE_PRICE_PROTOCOL_IDS.has(entry.protocol)
      && validStoredFivePriceReplies(entry.replies);
  }
  if (entry.type === 'five_price_settlement') {
    return entry.day === 19
      && hasExactKeys(entry, ['day','type','event','day16Mode','day16Result','protocol','right','replies','coalition'])
      && entry.event === FIVE_PRIVATE_PRICES.id
      && !!FIVE_PRIVATE_PRICES.counters[entry.day16Mode]
      && ['complete','rebuttable','broken'].includes(entry.day16Result)
      && FIVE_PRICE_PROTOCOL_IDS.has(entry.protocol)
      && FIVE_PRICE_RIGHT_IDS.has(entry.right)
      && validStoredFivePriceReplies(entry.replies)
      && hasExactKeys(entry.coalition, ['kind','members'])
      && ['full','limited','failed'].includes(entry.coalition.kind)
      && Array.isArray(entry.coalition.members)
      && entry.coalition.members.every((id) => HEROINE_IDS.includes(id));
  }
  if (entry.type === 'final_reckoning') {
    return entry.day === MAX_DAY
      && entry.event === FINAL_RECKONING.id
      && FINAL_RECKONING.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.participants) === JSON.stringify(FINAL_RECKONING.participants);
  }
  if (entry.type === 'final_reckoning_aftermath') {
    const chapter = FINAL_RECKONING_AFTERMATHS[entry.approach];
    return entry.day === MAX_DAY
      && entry.event === FINAL_RECKONING.id
      && !!chapter
      && chapter.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.participants) === JSON.stringify(FINAL_RECKONING.participants);
  }
  if (entry.type === 'visit_start') return HEROINE_IDS.includes(entry.heroine);
  if (entry.type === 'accord_term') {
    const choice = ACCORD_CHOICES[entry.heroine];
    return !!choice && entry.choice === choice.id && entry.term === choice.effects.accord;
  }
  if (entry.type === 'visit_choice') return HEROINE_IDS.includes(entry.heroine) && ROUTE_CHOICE_IDS[entry.heroine].has(entry.choice) && entry.choice !== ACCORD_CHOICES[entry.heroine]?.id;
  if (entry.type === 'route_aftermath') {
    if (!HEROINE_IDS.includes(entry.heroine) || !HEROINE_IDS.includes(entry.observer) || entry.heroine === entry.observer) return false;
    const source = routeChoiceById(entry.heroine, entry.sourceChoice);
    const expectedLane = source?.effects?.accord ? 'accord' : routeChoiceLane(entry.heroine, entry.sourceChoice);
    const actIndex = Math.min(3, Math.ceil(entry.day / 5) - 1);
    const stepIndex = expectedLane === 'accord' ? null : routeChoiceStepIndex(entry.heroine, entry.sourceChoice);
    const context = routeAftermathContext(entry.heroine, actIndex, stepIndex, expectedLane);
    return !!source
      && entry.lane === expectedLane
      && entry.event === context.template?.id
      && entry.observer === context.observer
      && ROUTE_AFTERMATH_CHOICE_IDS.has(entry.choice);
  }
  if (entry.type === 'night') {
    if (!HEROINE_IDS.includes(entry.heroine) || !['leave', 'talk', 'prelude', 'explicit'].includes(entry.action)) return false;
    const expectedScene = entry.action === 'prelude' ? preludeSceneId(entry.heroine) : entry.action === 'explicit' ? explicitSceneId(entry.heroine) : null;
    return (entry.scene ?? null) === expectedScene;
  }
  if (entry.type === 'night_coda') {
    const template = ordinaryNightCodaTemplate(entry.heroine, entry.action, entry.act);
    return HEROINE_IDS.includes(entry.heroine)
      && ['leave', 'talk'].includes(entry.action)
      && Number.isInteger(entry.act)
      && entry.act === Math.min(4, Math.ceil(entry.day / 5))
      && template?.id === entry.event
      && !!ordinaryNightMorningText(entry.heroine, entry.action, entry.act);
  }
  if (entry.type === 'night_conversation') {
    const template = NIGHT_CONVERSATIONS[entry.heroine]?.[entry.chapter - 1];
    const choice = template?.choices.find((row) => row.id === entry.choice);
    return HEROINE_IDS.includes(entry.heroine)
      && Number.isInteger(entry.chapter)
      && entry.chapter >= 1
      && entry.chapter <= 4
      && template?.id === entry.event
      && choice?.mode === entry.mode
      && Object.prototype.hasOwnProperty.call(entry, 'previousMode')
      && (entry.previousMode === null || ['honest', 'listen', 'private'].includes(entry.previousMode));
  }
  if (entry.type === 'personal_afterglow') {
    const scene = SCENES[entry.scene];
    const template = personalAfterglowTemplate(entry.heroine, entry.tier);
    return HEROINE_IDS.includes(entry.heroine)
      && !!scene
      && scene.heroine === entry.heroine
      && scene.tier === entry.tier
      && template?.id === entry.event
      && template.choices.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'personal_afterglow_aftermath') {
    const scene = SCENES[entry.scene];
    const original = personalAfterglowTemplate(entry.heroine, entry.tier);
    const chapter = personalAfterglowAftermathTemplate(entry.heroine, entry.tier);
    return HEROINE_IDS.includes(entry.heroine)
      && !!scene
      && scene.heroine === entry.heroine
      && scene.tier === entry.tier
      && chapter?.id === entry.event
      && original?.choices.some((choice) => choice.id === entry.approach)
      && chapter.choices.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'personal_finale') {
    const finale = PERSONAL_FINALES[entry.heroine];
    const beat = finale?.beats.find((row) => row.id === entry.beat);
    const beatIndex = finale?.beats.findIndex((row) => row.id === entry.beat) ?? -1;
    return entry.day === MAX_DAY
      && hasExactKeys(entry, ['day', 'type', 'event', 'heroine', 'beat', 'choice', 'departures'])
      && !!finale
      && entry.event === finale.id
      && !!beat
      && beat.choices.some((choice) => choice.id === entry.choice)
      && (beatIndex < 2 || !!beat.choices.find((choice) => choice.id === entry.choice)?.departureProcedure)
      && validPersonalFinaleDepartures(entry.departures, entry.heroine, beatIndex < 2)
      && (beatIndex === 2 ? entry.departures.length === 4 : entry.departures.length === 0);
  }
  if (entry.type === 'house_crisis_reply') {
    const event = HOUSE_CRISES[entry.crisis];
    return hasExactKeys(entry, ['day','type','event','crisis','act','heroine','outcome','sourceType','sourceId','sourceDay','otherHeroine'])
      && !!event
      && entry.event === `${entry.crisis}_act${entry.act}`
      && entry.act === Math.min(4, Math.ceil(entry.day / 5))
      && event.participants.includes(entry.heroine)
      && CRISIS_REPLY_OUTCOMES.has(entry.outcome)
      && !!HOUSE_CRISIS_RESPONSES[entry.crisis]?.[entry.heroine]?.[entry.outcome]
      && typeof entry.sourceType === 'string'
      && typeof entry.sourceId === 'string'
      && Number.isInteger(entry.sourceDay)
      && entry.sourceDay >= 0
      && entry.sourceDay <= entry.day
      && (entry.otherHeroine === null || (HEROINE_IDS.includes(entry.otherHeroine) && entry.otherHeroine !== entry.heroine));
  }
  if (entry.type === 'house_crisis') {
    const event = HOUSE_CRISES[entry.crisis];
    const repliesValid = Array.isArray(entry.replies)
      && entry.replies.length === event?.participants.length
      && entry.replies.every((reply, index) => (
        hasExactKeys(reply, ['heroine','outcome','sourceType','sourceId','sourceDay','otherHeroine'])
        && reply.heroine === event.participants[index]
        && CRISIS_REPLY_OUTCOMES.has(reply.outcome)
        && typeof reply.sourceType === 'string'
        && typeof reply.sourceId === 'string'
        && Number.isInteger(reply.sourceDay)
        && reply.sourceDay >= 0
        && reply.sourceDay <= entry.day
        && (reply.otherHeroine === null || (HEROINE_IDS.includes(reply.otherHeroine) && reply.otherHeroine !== reply.heroine))
      ));
    const structure = entry.choice === 'crisis_pair'
      ? (HOUSE_CRISIS_STRUCTURE_CARDS[entry.crisis] ?? []).find((row) => row.id === entry.structureId)
      : null;
    const replyByHeroine = repliesValid ? Object.fromEntries(entry.replies.map((reply) => [reply.heroine, reply])) : {};
    const expectedScope = structure?.participants.every((heroine) => replyByHeroine[heroine]?.outcome === 'stand') ? 'full' : 'bounded';
    const pairValid = entry.choice === 'crisis_pair'
      ? Array.isArray(entry.pair)
        && entry.pair.length === 2
        && !!structure
        && JSON.stringify(entry.pair) === JSON.stringify(structure.participants)
        && structure.participants.every((heroine) => replyByHeroine[heroine]?.outcome !== 'withdraw')
        && entry.scope === expectedScope
      : entry.pair === null && entry.structureId === null && entry.scope === null;
    return !!event
      && hasExactKeys(entry, ['day','type','event','crisis','act','triggerFacts','choice','structureId','scope','pair','replies'])
      && isRecord(entry.triggerFacts)
      && hasExactKeys(entry.triggerFacts, ['missed','silver','exposure','house','strain'])
      && hasFiniteFields(entry.triggerFacts, ['missed','silver','exposure','house','strain'])
      && Number.isInteger(entry.act)
      && entry.act === Math.min(4, Math.ceil(entry.day / 5))
      && entry.event === `${entry.crisis}_act${entry.act}`
      && (entry.choice === 'crisis_pair' || event.choices.some((choice) => choice.id === entry.choice))
      && repliesValid
      && pairValid;
  }
  if (entry.type === 'house_crisis_aftermath') {
    const event = HOUSE_CRISES[entry.crisis];
    const chapter = HOUSE_CRISIS_AFTERMATHS[entry.crisis]?.[entry.approach];
    const pairValid = entry.approach === 'crisis_pair'
      ? Array.isArray(entry.pair)
        && entry.pair.length === 2
        && entry.pair.every((id) => event?.participants.includes(id))
        && !!event?.pairTexts[bondKey(entry.pair[0], entry.pair[1])]
      : entry.pair === null;
    return !!event
      && entry.event === `${entry.crisis}_act${Math.min(4, Math.ceil(entry.day / 5))}`
      && !!chapter
      && chapter.choices.some((choice) => choice.id === entry.choice)
      && JSON.stringify(entry.participants) === JSON.stringify(event.participants)
      && pairValid;
  }
  if (entry.type === 'pair_interlude') {
    if (!Array.isArray(entry.pair) || entry.pair.length !== 2 || !entry.pair.every((id) => HEROINE_IDS.includes(id))) return false;
    const event = PAIR_INTERLUDES[bondKey(entry.pair[0], entry.pair[1])];
    return !!event
      && entry.event === event.id
      && entry.pair[0] === event.left
      && entry.pair[1] === event.right
      && ['listen', 'mediate', 'claim'].includes(entry.choice);
  }
  if (entry.type === 'memory_reckoning') {
    const template = ROUTE_RECKONINGS[entry.heroine];
    return !!template
      && entry.event === template.id
      && HEROINE_IDS.includes(entry.observer)
      && entry.observer !== entry.heroine
      && Number.isInteger(entry.sourceDay)
      && entry.sourceDay >= 1
      && entry.sourceDay <= entry.day - 2
      && !!routeChoiceById(entry.heroine, entry.sourceChoice)
      && ['public', 'direct', 'private'].includes(entry.promise)
      && !!template.variants[entry.promise]
      && ['keep', 'rewrite', 'deny'].includes(entry.choice);
  }
  if (entry.type === 'favor_reckoning') {
    const source = DAY_FAVOR_SOLUTIONS[entry.sourceDay - 1];
    return Number.isInteger(entry.sourceDay)
      && entry.sourceDay >= 1
      && entry.sourceDay <= entry.day - 2
      && entry.sourceDay <= MAX_DAY - 2
      && !!source
      && entry.event === `favor_${DAY_DEFS[entry.sourceDay - 1].id}`
      && entry.sourceAction === source.action
      && entry.heroine === source.heroine
      && entry.observer === source.observer
      && ['honor', 'rewrite', 'deny'].includes(entry.choice);
  }
  if (entry.type === 'dusk_invitation') {
    const event = DUSK_INVITATIONS[entry.heroine];
    return entry.day >= 4
      && entry.day < MAX_DAY
      && !!event
      && entry.event === event.id
      && entry.witness === event.witness
      && ['accept', 'open', 'decline'].includes(entry.choice);
  }
  if (entry.type === 'dusk_invitation_aftermath') {
    const event = DUSK_INVITATIONS[entry.heroine];
    const chapter = DUSK_INVITATION_AFTERMATHS[entry.heroine]?.[entry.approach];
    return entry.day >= 4
      && entry.day < MAX_DAY
      && !!event
      && entry.event === event.id
      && entry.witness === event.witness
      && ['accept', 'open', 'decline'].includes(entry.approach)
      && !!chapter
      && chapter.choices.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'morning') {
    if (!HEROINE_IDS.includes(entry.actor) || !MORNING_EVENT_IDS.has(entry.event)) return false;
    if (entry.event === 'rivalry') {
      return HEROINE_IDS.includes(entry.visited)
        && entry.visited !== entry.actor
        && ['admit', 'direct', 'hide'].includes(entry.choice);
    }
    if (entry.choice === 'together') return entry.event === 'jealousy' && HEROINE_IDS.includes(entry.visited) && entry.visited !== entry.actor;
    return true;
  }
  if (entry.type === 'alliance_assembly') {
    return entry.day === MAX_DAY
      && hasExactKeys(entry, ['day','type','candidates','replies','members'])
      && Array.isArray(entry.candidates)
      && entry.candidates.length >= 2
      && entry.candidates.length <= 4
      && new Set(entry.candidates).size === entry.candidates.length
      && entry.candidates.every((id) => HEROINE_IDS.includes(id))
      && Array.isArray(entry.replies)
      && entry.replies.length === entry.candidates.length
      && entry.replies.every((reply, index) => hasExactKeys(reply, ['heroine','outcome','day19Outcome','finalChoice','finalAftermathChoice','day20Protection','support','conflict'])
        && reply.heroine === entry.candidates[index]
        && ALLIANCE_ASSEMBLY_OUTCOMES.has(reply.outcome)
        && FIVE_PRICE_OUTCOMES.has(reply.day19Outcome)
        && FINAL_RECKONING.choices.some((choice) => choice.id === reply.finalChoice)
        && FINAL_RECKONING_AFTERMATHS[reply.finalChoice]?.choices.some((choice) => choice.id === reply.finalAftermathChoice)
        && ALLIANCE_DAY20_PROTECTION.has(reply.day20Protection)
        && validAllianceEvidence(reply.support, entry.candidates, reply.heroine)
        && validAllianceEvidence(reply.conflict, entry.candidates, reply.heroine))
      && Array.isArray(entry.members)
      && JSON.stringify(entry.members) === JSON.stringify(entry.replies.filter((reply) => reply.outcome !== 'withdraw').map((reply) => reply.heroine));
  }
  if (entry.type === 'alliance_night_start') {
    return entry.day === MAX_DAY
      && Array.isArray(entry.members)
      && [2, 3, 4].includes(entry.members.length)
      && new Set(entry.members).size === entry.members.length
      && entry.members.every((id) => HEROINE_IDS.includes(id));
  }
  if (entry.type === 'alliance_night') {
    const beat = ALLIANCE_NIGHT_BEATS.find((row) => row.id === entry.beat);
    return entry.day === MAX_DAY
      && !!beat
      && beat.choices.some((choice) => choice.id === entry.choice)
      && ALLIANCE_NIGHT_CHOICE_IDS.has(entry.choice)
      && Array.isArray(entry.members)
      && [2, 3, 4].includes(entry.members.length)
      && new Set(entry.members).size === entry.members.length
      && entry.members.every((id) => HEROINE_IDS.includes(id));
  }
  if (entry.type === 'morning_settlement') {
    const heroine = MORNING_SETTLEMENTS.heroines[entry.heroine];
    const validSource = entry.cause === 'upkeep_short'
      ? entry.sourceId === 'banquet'
      : ['office','listen'].includes(entry.sourceId);
    return hasExactKeys(entry, ['day','type','event','cause','sourceDay','sourceType','sourceId','heroine','object','restriction','recovery','choice'])
      && entry.event === MORNING_SETTLEMENTS.id
      && MORNING_SETTLEMENT_CAUSES.has(entry.cause)
      && Number.isInteger(entry.sourceDay)
      && entry.sourceDay >= 1
      && entry.sourceDay < entry.day
      && entry.sourceType === 'day_action'
      && validSource
      && !!heroine
      && entry.object === heroine.object
      && entry.restriction === heroine.restriction.action
      && entry.recovery === heroine.recovery.action
      && MORNING_SETTLEMENT_CHOICE_IDS.has(entry.choice);
  }
  if (entry.type === 'morning_settlement_use') {
    return hasExactKeys(entry, ['day','type','settlementDay','cause','heroine','action'])
      && Number.isInteger(entry.settlementDay)
      && entry.settlementDay >= 2
      && entry.settlementDay <= entry.day
      && MORNING_SETTLEMENT_CAUSES.has(entry.cause)
      && HEROINE_IDS.includes(entry.heroine)
      && ['ledger','office','listen','banquet'].includes(entry.action);
  }
  if (entry.type === 'morning_settlement_restore') {
    const recovery = MORNING_SETTLEMENTS.heroines[entry.heroine]?.recovery;
    return hasExactKeys(entry, ['day','type','settlementDay','cause','heroine','action','result'])
      && Number.isInteger(entry.settlementDay)
      && entry.settlementDay >= 2
      && entry.settlementDay <= entry.day
      && MORNING_SETTLEMENT_CAUSES.has(entry.cause)
      && !!recovery
      && entry.action === recovery.action
      && entry.result === recovery.result;
  }
  if (entry.type === 'shared_night_start') return entry.day === MAX_DAY;
  if (entry.type === 'shared_night') return entry.day === MAX_DAY && SHARED_NIGHT_CHOICES.some((choice) => choice.id === entry.choice);
  if (entry.type === 'shared_afterglow') {
    const beat = SHARED_AFTERGLOW_BEATS.find((row) => row.id === entry.beat);
    return entry.day === MAX_DAY && !!beat && beat.choices.some((choice) => choice.id === entry.choice);
  }
  if (entry.type === 'shared_dawn') return entry.day === MAX_DAY && SHARED_DAWN_CHOICE_IDS.has(entry.choice);
  if (entry.type === 'collapse_finale_start') {
    return entry.day === MAX_DAY
      && COLLAPSE_CAUSES.has(entry.cause)
      && ['shared', 'visit'].includes(entry.source)
      && ['intrigue', 'unstable'].includes(entry.endingId)
      && ((entry.endingId === 'intrigue' && ['clean', 'watched', 'burned'].includes(entry.endingDetail))
        || (entry.endingId === 'unstable' && ['no_scene', 'second_too_close', 'broke_word', 'not_enough_power', 'spread_thin'].includes(entry.endingDetail)));
  }
  if (entry.type === 'collapse_finale') {
    return entry.day === MAX_DAY
      && COLLAPSE_CAUSES.has(entry.cause)
      && ['shared', 'visit'].includes(entry.source)
      && ['intrigue', 'unstable'].includes(entry.endingId)
      && !!collapseChoiceById(entry.cause, entry.choice);
  }
  if (entry.type === 'route_break') return entry.heroine === null || HEROINE_IDS.includes(entry.heroine);
  if (entry.type === 'collector') return typeof entry.paid === 'boolean';
  return true;
}

function rowsOn(state, day, types) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  return state.history.filter((entry) => entry.day === day && wanted.has(entry.type));
}

function derivedBonds(history) {
  const bonds = makeBonds();
  let missedRun = 0;
  let fivePriceContext = null;
  const adjust = (left, right, delta) => {
    const key = bondKey(left, right);
    if (key) bonds[key] = clamp(bonds[key] + delta, -100, 100);
  };
  for (const entry of history) {
    if (entry.type === 'opening') {
      const choice = OPENING_CHOICES.find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'day_action') {
      for (const row of dayNetworkChanges(entry.day, entry.action, entry.actor)) adjust(entry.actor, row.observer, row.delta);
      if (entry.resolution === 'favor') adjust(entry.favorHeroine, entry.favorObserver, -2);
      if (!entry.resolved && missedRun >= 1) {
        const focus = DAY_AGENDAS[entry.day - 1]?.focus ?? [];
        for (let index = 0; index < focus.length; index += 1) {
          for (const other of focus.slice(index + 1)) adjust(focus[index], other, -2);
        }
      }
      missedRun = entry.resolved ? 0 : missedRun + 1;
    } else if (entry.type === 'act_transition') {
      const choice = ACT_TRANSITIONS[entry.day]?.choices.find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'external_rebuttal') {
      const choice = externalRebuttalChoiceById(entry.sourceResult, entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'joint_action' && entry.participants?.length === 2) {
      adjust(entry.participants[0], entry.participants[1], 8);
      missedRun = 0;
    } else if (entry.type === 'council') {
      const event = COUNCIL_EVENTS[entry.day];
      const choice = event?.choices.find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'household_aftermath') {
      const choice = JIAOER_AFTERMATHS[entry.approach]?.choices.find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'public_evidence_chain') {
      const outcome = publicEvidenceEvaluationForHistory(history, entry.chain)?.outcome;
      for (const [left, right, delta] of outcome?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'public_followup') {
      const choice = PUBLIC_FOLLOWUPS[entry.day]?.choices.find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'five_price_settlement') {
      fivePriceContext = entry;
    } else if (entry.type === 'final_reckoning') {
      const base = FINAL_RECKONING.choices.find((row) => row.id === entry.choice);
      const choice = base ? { ...base, effects:finalEffectsForFivePrice(base, fivePriceContext) } : null;
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'final_reckoning_aftermath') {
      const choice = dynamicFinalReckoningAftermathChoicesForContext(entry.approach, fivePriceContext).find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
    } else if (entry.type === 'morning' && entry.event === 'rivalry') {
      const key = bondKey(entry.actor, entry.visited);
      const trust = key ? bonds[key] : -1;
      adjust(entry.actor, entry.visited, entry.choice === 'admit' ? 3 : entry.choice === 'direct' ? (trust >= 10 ? 8 : 6) : -8);
    } else if (entry.type === 'morning' && entry.choice === 'together') {
      const key = bondKey(entry.actor, entry.visited);
      const trust = key ? bonds[key] : -1;
      adjust(entry.actor, entry.visited, trust >= 10 ? 6 : 4);
    } else if (entry.type === 'route_aftermath') {
      const key = bondKey(entry.heroine, entry.observer);
      const trust = key ? bonds[key] : -1;
      adjust(entry.heroine, entry.observer, entry.choice === 'public' ? 4 : entry.choice === 'direct' ? (trust >= 10 ? 7 : 5) : -3);
    } else if (entry.type === 'night_conversation') {
      const observer = NIGHT_CONVERSATION_OBSERVERS[entry.heroine]?.[entry.chapter - 1]?.observer;
      const delta = NIGHT_OBSERVER_EFFECTS[entry.mode]?.bond ?? 0;
      if (observer) {
        adjust(entry.heroine, observer, delta);
        if (entry.mode === 'private' && entry.previousMode === 'private') adjust(entry.heroine, observer, -1);
      }
    } else if (entry.type === 'visit_choice') {
      const lane = routeChoiceLane(entry.heroine, entry.choice);
      for (const row of routeBondChanges(entry.heroine, lane)) adjust(entry.heroine, row.other, row.delta);
    } else if (entry.type === 'house_crisis' && entry.choice === 'crisis_pair' && entry.pair?.length === 2) {
      adjust(entry.pair[0], entry.pair[1], 8);
    } else if (entry.type === 'house_crisis_aftermath') {
      const choice = HOUSE_CRISIS_AFTERMATHS[entry.crisis]?.[entry.approach]?.choices.find((row) => row.id === entry.choice);
      for (const [left, right, delta] of choice?.effects?.bonds ?? []) adjust(left, right, delta);
      if (choice?.pairBond && entry.pair?.length === 2) adjust(entry.pair[0], entry.pair[1], choice.pairBond);
    } else if (entry.type === 'pair_interlude' && entry.pair?.length === 2) {
      const delta = entry.choice === 'listen' ? 8 : entry.choice === 'mediate' ? 4 : -6;
      adjust(entry.pair[0], entry.pair[1], delta);
    } else if (entry.type === 'memory_reckoning') {
      const delta = entry.choice === 'keep'
        ? entry.promise === 'public' ? 4 : entry.promise === 'direct' ? 7 : -2
        : entry.choice === 'rewrite' ? 2 : -7;
      adjust(entry.heroine, entry.observer, delta);
    } else if (entry.type === 'favor_reckoning') {
      adjust(entry.heroine, entry.observer, entry.choice === 'honor' ? 4 : entry.choice === 'rewrite' ? 1 : -8);
    } else if (entry.type === 'alliance_night') {
      const delta = ({
        alliance_each_other: 6, alliance_center_you: -2,
        alliance_separate_doors: 4, alliance_open_schedule: 1,
        alliance_keep_limited: 3, alliance_leave_open: 2,
      })[entry.choice] ?? 0;
      for (const [left, right] of combinations(entry.members, 2)) adjust(left, right, delta);
    } else if (entry.type === 'dusk_invitation') {
      adjust(entry.heroine, entry.witness, entry.choice === 'accept' ? -1 : entry.choice === 'open' ? 5 : 0);
    } else if (entry.type === 'dusk_invitation_aftermath') {
      const choice = DUSK_INVITATION_AFTERMATHS[entry.heroine]?.[entry.approach]?.choices.find((row) => row.id === entry.choice);
      if (choice?.pairBond) adjust(entry.heroine, entry.witness, choice.pairBond);
    }
  }
  return bonds;
}

function derivedRouteStances(history) {
  const stances = makeRouteStances();
  for (const entry of history) {
    if (entry.type !== 'visit_choice') continue;
    const lane = routeChoiceLane(entry.heroine, entry.choice);
    if (lane) stances[entry.heroine][lane] += 1;
  }
  return stances;
}

function derivedSecrets(history) {
  const available = [];
  const used = [];
  let valid = true;
  const add = (id) => { if (id && !available.includes(id) && !used.includes(id)) available.push(id); };
  const apply = (effects) => { for (const id of effects?.secrets ?? []) add(id); };
  const consume = (id) => {
    if (!id) return;
    const index = available.indexOf(id);
    if (index < 0) { valid = false; return; }
    available.splice(index, 1); used.push(id);
  };
  for (const entry of history) {
    if (entry.type === 'opening') apply(OPENING_CHOICES.find((row) => row.id === entry.choice)?.effects);
    else if (entry.type === 'day_action') {
      if (entry.action === 'ledger' && entry.day === 3) add('steward_gap');
      if (entry.action === 'listen') add(DAY_DEFS[entry.day - 1]?.intel.id);
      consume(entry.secretUsed);
    } else if (entry.type === 'joint_action') apply(JOINT_ACTIONS.find((row) => row.id === entry.action)?.effects);
    else if (entry.type === 'household') apply(HOUSEHOLD_EVENTS[entry.day]?.choices.find((row) => row.id === entry.choice)?.effects);
    else if (entry.type === 'banquet') apply(PUBLIC_EVENTS[entry.day]?.choices.find((row) => row.id === entry.choice)?.effects);
    else if (entry.type === 'accord_term') apply(ACCORD_CHOICES[entry.heroine]?.effects);
    else if (entry.type === 'visit_choice') apply(routeChoiceById(entry.heroine, entry.choice)?.effects);
    else if (entry.type === 'night' && entry.action === 'explicit') add(({
      wu_yueniang: 'yue_backing', pan_jinlian: 'pan_rumor', li_pinger: 'merchant_route',
      meng_yulou: 'meng_guest_list', sun_xuee: 'xuee_storehouse_mark',
    })[entry.heroine]);
    else if (entry.type === 'morning' && entry.choice === 'accept') {
      add(({
        yue_delayed: 'yue_backing', yue_help: 'yue_backing', pinger_help: 'merchant_route',
        meng_invitation: 'meng_guest_list', xuee_breakfast: 'xuee_storehouse_mark',
      })[entry.event]);
    } else if (entry.type === 'shared_night') apply(SHARED_NIGHT_CHOICES.find((row) => row.id === entry.choice)?.effects);
    else if (entry.type === 'shared_afterglow') apply(SHARED_AFTERGLOW_BEATS.find((row) => row.id === entry.beat)?.choices.find((row) => row.id === entry.choice)?.effects);
    else if (entry.type === 'shared_dawn') apply(SHARED_DAWN_CHOICES.find((row) => row.id === entry.choice)?.effects);
  }
  return { available, used, valid };
}

function validMorningSettlementHistory(state) {
  const rows = state.history.filter((entry) => entry.type === 'morning_settlement');
  if (rows.length > 2 || new Set(rows.map((row) => row.cause)).size !== rows.length) return false;
  if (rows.some((row, index) => index > 0 && row.day - rows[index - 1].day < 2)) return false;
  for (const row of rows) {
    const index = state.history.indexOf(row);
    const prefix = state.history.slice(0, index);
    const expected = morningSettlementSource({ history:prefix, day:row.day }, row.cause);
    if (!expected
      || row.sourceDay !== expected.sourceDay
      || row.sourceType !== expected.sourceType
      || row.sourceId !== expected.sourceId
      || row.heroine !== expected.heroine) return false;
    const identity = morningSettlementIdentity(row);
    const uses = state.history.map((entry, entryIndex) => ({ entry, entryIndex })).filter(({ entry, entryIndex }) => (
      entryIndex > index
      && entry.type === 'morning_settlement_use'
      && `${entry.settlementDay}:${entry.cause}:${entry.heroine}` === identity
    ));
    const restores = state.history.map((entry, entryIndex) => ({ entry, entryIndex })).filter(({ entry, entryIndex }) => (
      entryIndex > index
      && entry.type === 'morning_settlement_restore'
      && `${entry.settlementDay}:${entry.cause}:${entry.heroine}` === identity
    ));
    if (uses.length > 1 || restores.length > 1) return false;
    if (uses.length && (row.choice !== 'narrow_authorization' || uses[0].entry.action !== row.restriction)) return false;
    if (restores.length && (
      restores[0].entry.action !== row.recovery
      || restores[0].entry.result !== MORNING_SETTLEMENTS.heroines[row.heroine]?.recovery?.result
    )) return false;
    if (uses.length && restores.length && uses[0].entryIndex > restores[0].entryIndex) return false;
  }
  for (const entry of state.history.filter((row) => ['morning_settlement_use','morning_settlement_restore'].includes(row.type))) {
    if (!rows.some((row) => `${row.day}:${row.cause}:${row.heroine}` === `${entry.settlementDay}:${entry.cause}:${entry.heroine}`)) return false;
  }
  // 走官面若因高曝光、耗损或无银而只办晨簿恢复，正文不使用当日普通官面
  // 场景；它必须由同日真实 restore 逐项派生，不能借“恢复窄路”伪造任意文本。
  for (const entry of state.history.filter((row) => row.type === 'day_action' && row.action === 'office')) {
    const move = DAY_AGENDAS[entry.day - 1]?.actions?.office;
    if (entry.executionText.startsWith(move?.text ?? '')) continue;
    const restores = state.history.filter((row) => (
      row.type === 'morning_settlement_restore'
      && row.day === entry.day
      && row.action === 'office'
    ));
    const expectedExecution = [morningRecoveryOnlyLead(restores), ...restores.map((row) => row.result)].filter(Boolean).join(' ');
    if (!restores.length || entry.executionText !== expectedExecution) return false;
  }
  return true;
}

function validProcessHistory(state) {
  if (!state.history.every((entry) => validHistoryEntry(entry, state.day, state.seed))) return false;
  if (!state.log.every((entry) => typeof entry === 'string')) return false;
  if (!validMorningSettlementHistory(state)) return false;
  for (const heroine of HEROINE_IDS) {
    const rows = state.history.filter((entry) => entry.type === 'visit_choice' && entry.heroine === heroine);
    const stance = { covenant: 0, private: 0 };
    for (let index = 0; index < rows.length; index += 1) {
      const entry = rows[index];
      const allowed = routeRowsFor(heroine, index, stance);
      const lane = routeChoiceLane(heroine, entry.choice);
      if (!allowed.some((choice) => choice.id === entry.choice) || !['covenant', 'private'].includes(lane) || entry.lane !== lane) return false;
      stance[lane] += 1;
    }
    if (state.routeStances[heroine].covenant !== stance.covenant || state.routeStances[heroine].private !== stance.private) return false;
  }
  const crisisRows = state.history.filter((entry) => entry.type === 'house_crisis');
  const crisisReplyRows = state.history.filter((entry) => entry.type === 'house_crisis_reply');
  if (new Set(crisisRows.map((entry) => entry.act)).size !== crisisRows.length) return false;
  for (const row of crisisRows) {
    const replies = crisisReplyRows.filter((entry) => entry.day === row.day && entry.event === row.event);
    if (replies.length !== row.replies.length
      || JSON.stringify(replies.map(crisisReplyStored)) !== JSON.stringify(row.replies)) return false;
  }
  const pendingCrisis = state.phase === 'crisis' ? state.currentCrisis : null;
  for (const reply of crisisReplyRows) {
    const settled = crisisRows.some((row) => row.day === reply.day && row.event === reply.event);
    const pending = pendingCrisis?.event === reply.event && reply.day === state.day;
    if (!settled && !pending) return false;
  }
  if (pendingCrisis) {
    const replies = crisisReplyRows.filter((entry) => entry.day === state.day && entry.event === pendingCrisis.event);
    if (replies.length !== pendingCrisis.replyBeat
      || JSON.stringify(replies.map(crisisReplyStored)) !== JSON.stringify(pendingCrisis.replies)) return false;
  }
  const pairRows = state.history.filter((entry) => entry.type === 'pair_interlude');
  if (new Set(pairRows.map((entry) => bondKey(entry.pair[0], entry.pair[1]))).size !== pairRows.length) return false;
  const memoryRows = state.history.filter((entry) => entry.type === 'memory_reckoning');
  if (new Set(memoryRows.map((entry) => entry.heroine)).size !== memoryRows.length) return false;
  for (const entry of memoryRows) {
    const source = state.history.find((row) => (
      row.type === 'route_aftermath'
      && row.day === entry.sourceDay
      && row.heroine === entry.heroine
      && row.observer === entry.observer
      && row.sourceChoice === entry.sourceChoice
      && row.choice === entry.promise
    ));
    if (!source) return false;
  }
  for (let day = 1; day <= state.day; day += 1) {
    if (rowsOn(state, day, 'memory_reckoning').length > 1) return false;
  }
  const favorRows = state.history.filter((entry) => entry.type === 'favor_reckoning');
  if (new Set(favorRows.map((entry) => `${entry.sourceDay}:${entry.sourceAction}`)).size !== favorRows.length) return false;
  for (const entry of favorRows) {
    const source = state.history.find((row) => (
      row.type === 'day_action'
      && row.day === entry.sourceDay
      && row.action === entry.sourceAction
      && row.resolution === 'favor'
      && row.favorHeroine === entry.heroine
      && row.favorObserver === entry.observer
    ));
    if (!source) return false;
  }
  for (let day = 1; day <= state.day; day += 1) {
    if (rowsOn(state, day, 'favor_reckoning').length > 1) return false;
  }
  const invitationRows = state.history.filter((entry) => entry.type === 'dusk_invitation');
  if (new Set(invitationRows.map((entry) => entry.heroine)).size !== invitationRows.length) return false;
  for (let day = 1; day <= state.day; day += 1) {
    if (rowsOn(state, day, 'dusk_invitation').length > 1) return false;
  }
  const invitationAftermathRows = state.history.filter((entry) => entry.type === 'dusk_invitation_aftermath');
  if (new Set(invitationAftermathRows.map((entry) => entry.heroine)).size !== invitationAftermathRows.length) return false;
  for (const invitation of invitationRows) {
    const rows = invitationAftermathRows.filter((entry) => entry.day === invitation.day && entry.heroine === invitation.heroine);
    const pending = state.phase === 'dusk_invitation_aftermath'
      && state.duskInvitationAftermath?.heroine === invitation.heroine
      && state.duskInvitationAftermath?.resolution === null;
    if (rows.length !== (pending ? 0 : 1)) return false;
    if (rows.length && (
      rows[0].event !== invitation.event
      || rows[0].witness !== invitation.witness
      || rows[0].approach !== invitation.choice
    )) return false;
  }
  if (invitationAftermathRows.some((entry) => !invitationRows.some((row) => (
    row.day === entry.day && row.heroine === entry.heroine && row.choice === entry.approach
  )))) return false;
  const personalAfterglowRows = state.history.filter((entry) => entry.type === 'personal_afterglow');
  const personalAfterglowAftermathRows = state.history.filter((entry) => entry.type === 'personal_afterglow_aftermath');
  for (const afterglow of personalAfterglowRows) {
    const rows = personalAfterglowAftermathRows.filter((entry) => (
      entry.day === afterglow.day
      && entry.heroine === afterglow.heroine
      && entry.scene === afterglow.scene
      && entry.tier === afterglow.tier
      && entry.approach === afterglow.choice
    ));
    const pending = state.phase === 'personal_afterglow_aftermath'
      && state.personalAfterglowAftermath?.heroine === afterglow.heroine
      && state.personalAfterglowAftermath?.scene === afterglow.scene
      && state.personalAfterglowAftermath?.approach === afterglow.choice
      && state.personalAfterglowAftermath?.resolution === null;
    if (rows.length !== (pending ? 0 : 1)) return false;
  }
  if (personalAfterglowAftermathRows.some((entry) => !personalAfterglowRows.some((row) => (
    row.day === entry.day
    && row.heroine === entry.heroine
    && row.scene === entry.scene
    && row.tier === entry.tier
    && row.choice === entry.approach
  )))) return false;
  const conversationRows = state.history.filter((entry) => entry.type === 'night_conversation');
  for (const heroine of HEROINE_IDS) {
    const rows = conversationRows.filter((entry) => entry.heroine === heroine);
    if (rows.some((entry, index) => entry.chapter !== index + 1)) return false;
    for (let index = 0; index < rows.length; index += 1) {
      const entry = rows[index];
      const night = state.history.find((row) => row.type === 'night' && row.day === entry.day && row.heroine === heroine);
      if (night?.action !== 'talk') return false;
      if (entry.previousMode !== (index === 0 ? null : rows[index - 1].mode)) return false;
    }
  }
  for (let day = 1; day <= state.day; day += 1) {
    if (rowsOn(state, day, 'night_conversation').length > 1) return false;
  }
  const ordinaryNightRows = state.history.filter((entry) => entry.type === 'night_coda');
  if (ordinaryNightRows.some((entry) => {
    const night = state.history.find((row) => row.type === 'night' && row.day === entry.day && row.heroine === entry.heroine);
    return !night || night.action !== entry.action || night.scene !== null;
  })) return false;
  for (let day = 1; day < state.day; day += 1) {
    const night = rowsOn(state, day, 'night')[0];
    if (!night) continue;
    const codas = rowsOn(state, day, 'night_coda');
    const conversations = rowsOn(state, day, 'night_conversation');
    if (night.action === 'leave' && (codas.length !== 1 || conversations.length)) return false;
    if (night.action === 'talk' && codas.length + conversations.length !== 1) return false;
    if (!['leave', 'talk'].includes(night.action) && (codas.length || conversations.length)) return false;
  }
  for (let day = 1; day <= state.day; day += 1) {
    if (rowsOn(state, day, 'night_coda').length > 1) return false;
  }
  const finaleRows = state.history.filter((entry) => entry.type === 'personal_finale');
  if (finaleRows.length !== state.personalFinaleChoices.length) return false;
  if (finaleRows.length) {
    const heroine = finaleRows[0].heroine;
    const finale = PERSONAL_FINALES[heroine];
    if (!finale || finaleRows.some((entry) => entry.heroine !== heroine || entry.event !== finale.id)) return false;
    for (let index = 0; index < finaleRows.length; index += 1) {
      if (finaleRows[index].beat !== finale.beats[index]?.id
        || finaleRows[index].choice !== state.personalFinaleChoices[index]) return false;
    }
    if (finaleRows.length === 3) {
      const thirdIndex = state.history.indexOf(finaleRows[2]);
      const thirdChoice = finale.beats[2]?.choices.find((choice) => choice.id === finaleRows[2].choice);
      const expected = thirdChoice && thirdIndex >= 0
        ? expectedPersonalFinaleDepartures(state.history.slice(0, thirdIndex), heroine, thirdChoice.departureProcedure)
        : null;
      if (!expected || JSON.stringify(finaleRows[2].departures) !== JSON.stringify(expected)) return false;
      if (state.phase === 'personal_finale_result'
        && state.personalFinale
        && JSON.stringify(state.personalFinale.departures) !== JSON.stringify(expected)) return false;
    }
  }
  if (['personal_finale', 'personal_finale_result'].includes(state.phase)) {
    if ((state.phase === 'personal_finale' && state.personalFinaleChoices.length >= 3)
      || (state.phase === 'personal_finale_result' && (state.personalFinaleChoices.length < 1 || state.personalFinaleChoices.length > 3))
      || (finaleRows.length && finaleRows[0].heroine !== state.personalFinale?.heroine)) return false;
    if (state.phase === 'personal_finale_result' && !currentPersonalFinaleResult(state)) return false;
  } else if (state.phase === 'ending' && state.ending?.id === 'exclusive') {
    if (finaleRows.length !== 3 || finaleRows[0]?.heroine !== state.ending.heroine) return false;
  } else if (finaleRows.length || state.personalFinaleChoices.length) return false;
  const derivedPressure = state.history
    .filter((entry) => ['day_action', 'joint_action'].includes(entry.type) && entry.resolved)
    .map((entry) => DAY_DEFS[entry.day - 1].id);
  if (derivedPressure.join('\0') !== state.resolvedPressures.join('\0')) return false;
  const expectedBonds = derivedBonds(state.history);
  if (PAIR_IDS.some((id) => state.bonds[id] !== expectedBonds[id])) return false;
  const expectedStances = derivedRouteStances(state.history);
  if (HEROINE_IDS.some((id) => (
    state.routeStances[id].covenant !== expectedStances[id].covenant
    || state.routeStances[id].private !== expectedStances[id].private
  ))) return false;
  const expectedSecrets = derivedSecrets(state.history);
  if (!expectedSecrets.valid || expectedSecrets.available.join('\0') !== state.secrets.join('\0') || expectedSecrets.used.join('\0') !== state.secretsUsed.join('\0')) return false;
  const externalRows = state.history.filter((entry) => entry.type === 'external_rebuttal');
  if (externalRows.length > 1 || !validExternalEffectAudit(state, externalRows)) return false;
  if (state.phase === 'opening') {
    return state.history.length === 0
      && state.openingAftermath === null
      && state.selectedDayAction === null
      && state.selectedSecret === null
      && state.currentHeroine === null
      && state.currentHouseholdEvent === null
      && state.householdAftermath === null
      && state.currentJointAction === null;
  }
  const openings = state.history.filter((entry) => entry.type === 'opening');
  if (openings.length !== 1) return false;
  const jointRows = state.history.filter((entry) => entry.type === 'joint_action');
  const precedentRows = state.history.filter((entry) => entry.type === 'portable_precedent');
  if (precedentRows.length > 1) return false;
  const firstJoint = jointRows[0] ?? null;
  const firstJointStillOpen = state.phase === 'joint_result' && state.currentJointAction === firstJoint?.action;
  const precedentChoicePending = state.phase === 'portable_precedent' && state.portablePrecedent?.choice === null;
  const expectedPrecedentCount = !firstJoint || firstJointStillOpen || precedentChoicePending ? 0 : 1;
  if (precedentRows.length !== expectedPrecedentCount) return false;
  if (precedentRows.length) {
    const row = precedentRows[0];
    const index = state.history.indexOf(row);
    if (row.action !== firstJoint.action
      || row.sourceDay !== firstJoint.day
      || state.history.indexOf(firstJoint) >= index
      || JSON.stringify(row.participants) !== JSON.stringify(firstJoint.participants)
      || JSON.stringify(row.replies) !== JSON.stringify(expectedPortablePrecedentReplies(state.history.slice(0, index), row.action))
      || row.scope !== portablePrecedentScope(row.choice, row.replies)) return false;
  }
  const day10Followups = rowsOn(state, 10, 'public_followup');
  const day11Transitions = rowsOn(state, 11, 'act_transition');
  if (day11Transitions.length) {
    const source = day10Followups[0];
    const transition = day11Transitions[0];
    if (day10Followups.length !== 1
      || transition.sourceChoice !== source.choice
      || state.history.indexOf(source) >= state.history.indexOf(transition)) return false;
  }
  const fivePriceProtocolRows = rowsOn(state, 19, 'five_price_protocol');
  const fivePriceSettlementRows = rowsOn(state, 19, 'five_price_settlement');
  if (fivePriceProtocolRows.length > 1 || fivePriceSettlementRows.length > 1) return false;
  if (fivePriceProtocolRows.length) {
    const protocol = fivePriceProtocolRows[0];
    if (JSON.stringify(protocol.replies) !== JSON.stringify(expectedFivePriceReplies(state))) return false;
    if (fivePriceSettlementRows.length) {
      const settlement = fivePriceSettlementRows[0];
      if (state.history.indexOf(protocol) >= state.history.indexOf(settlement)
        || settlement.protocol !== protocol.protocol
        || settlement.day16Mode !== fivePrivatePriceDay16Source(state).mode
        || settlement.day16Result !== fivePrivatePriceDay16Source(state).result
        || JSON.stringify(settlement.replies) !== JSON.stringify(protocol.replies)
        || JSON.stringify(settlement.coalition) !== JSON.stringify(fivePriceCoalition(protocol.protocol, settlement.right, protocol.replies))) return false;
    }
  } else if (fivePriceSettlementRows.length) return false;
  if (state.day < 19 && (fivePriceProtocolRows.length || fivePriceSettlementRows.length)) return false;
  if (state.day > 19 && (fivePriceProtocolRows.length !== 1 || fivePriceSettlementRows.length !== 1)) return false;
  if (state.day === 19) {
    if (state.phase === 'five_private_prices') {
      const pending = state.fivePrivatePrices;
      if (fivePriceProtocolRows.length !== (pending?.protocol ? 1 : 0)
        || fivePriceSettlementRows.length !== (pending?.right ? 1 : 0)) return false;
    } else {
      const beforeFivePrices = ['crisis','crisis_aftermath','pair_interlude','morning_settlement','morning','favor_reckoning','memory_reckoning','act_transition','act_aftermath','day','day_aftermath','joint_result','portable_precedent','household','household_aftermath','council','council_aftermath','banquet','public_evidence','public_followup','public_aftermath'].includes(state.phase);
      if (fivePriceProtocolRows.length !== (beforeFivePrices ? 0 : 1)
        || fivePriceSettlementRows.length !== (beforeFivePrices ? 0 : 1)) return false;
    }
  }
  if (state.phase === 'opening_aftermath') {
    return state.day === 1
      && !!currentOpeningAftermath(state)
      && state.selectedDayAction === null
      && state.selectedSecret === null
      && state.currentHeroine === null
      && state.currentHouseholdEvent === null
      && state.currentJointAction === null;
  }
  const crisisAftermathRows = state.history.filter((entry) => entry.type === 'house_crisis_aftermath');
  if (crisisAftermathRows.some((row) => !crisisRows.some((source) => source.day === row.day && source.event === row.event && source.choice === row.approach))) return false;
  for (const row of crisisRows) {
    const matches = crisisAftermathRows.filter((after) => after.day === row.day && after.event === row.event && after.approach === row.choice);
    const pending = state.phase === 'crisis_aftermath'
      && state.crisisAftermath?.event === row.event
      && state.crisisAftermath?.resolution === null;
    if (matches.length !== (pending ? 0 : 1)) return false;
  }
  for (let day = 1; day < state.day; day += 1) {
    if (rowsOn(state, day, ['day_action', 'joint_action']).length !== 1) return false;
    const nightRows = rowsOn(state, day, 'night');
    if (nightRows.length !== 1) return false;
    const afterglowRows = rowsOn(state, day, 'personal_afterglow');
    if (afterglowRows.length !== (nightRows[0].scene ? 1 : 0)) return false;
    if (afterglowRows.length && (afterglowRows[0].heroine !== nightRows[0].heroine || afterglowRows[0].scene !== nightRows[0].scene)) return false;
    const afterglowAftermathRows = rowsOn(state, day, 'personal_afterglow_aftermath');
    if (afterglowAftermathRows.length !== (nightRows[0].scene ? 1 : 0)) return false;
    if (afterglowAftermathRows.length && (
      afterglowAftermathRows[0].heroine !== afterglowRows[0]?.heroine
      || afterglowAftermathRows[0].scene !== afterglowRows[0]?.scene
      || afterglowAftermathRows[0].approach !== afterglowRows[0]?.choice
    )) return false;
    if (ACT_TRANSITIONS[day] && rowsOn(state, day, 'act_transition').length !== 1) return false;
    if (HOUSEHOLD_EVENTS[day]) {
      const householdRows = rowsOn(state, day, 'household');
      const householdAftermathRows = rowsOn(state, day, 'household_aftermath');
      if (householdRows.length !== 1 || householdAftermathRows.length !== 1) return false;
      if (householdAftermathRows[0].approach !== householdRows[0].choice) return false;
    }
    if (COUNCIL_EVENTS[day] && rowsOn(state, day, 'council').length !== 1) return false;
    if (day === 15 && rowsOn(state, day, 'public_evidence_chain').length !== 1) return false;
    if (day === 16 && rowsOn(state, day, 'external_rebuttal').length !== 1) return false;
    if (PUBLIC_FOLLOWUPS[day] && rowsOn(state, day, 'public_followup').length !== 1) return false;
  }
  for (let day = 2; day < state.day; day += 1) {
    if (rowsOn(state, day, 'morning').length !== 1) return false;
  }
  const currentMorningCount = rowsOn(state, state.day, 'morning').length;
  const rivalryResolutionOpen = state.phase === 'morning' && !!currentMorningResolution(state);
  const expectedCurrentMorning = state.day === 1 || (['crisis', 'crisis_aftermath', 'pair_interlude', 'morning_settlement', 'morning'].includes(state.phase) && !rivalryResolutionOpen) ? 0 : 1;
  if (currentMorningCount !== expectedCurrentMorning) return false;

  const currentWork = rowsOn(state, state.day, ['day_action', 'joint_action']);
  const allianceTableauOpen = state.phase === 'scene' && state.sceneReturnPhase === 'after_alliance_night';
  const beforeDayWork = ['crisis', 'crisis_aftermath', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'act_transition', 'act_aftermath', 'day'].includes(state.phase);
  if (currentWork.length !== (beforeDayWork ? 0 : 1)) return false;
  if (beforeDayWork) {
    if (state.selectedDayAction !== null) return false;
  } else if (['personal_finale', 'personal_finale_result', 'collapse_finale', 'collapse_finale_result', 'ending'].includes(state.phase) || allianceTableauOpen) {
    if (state.selectedDayAction !== null) return false;
  } else if (state.selectedDayAction !== currentWork[0].action) return false;
  if (state.phase !== 'day' && state.selectedSecret !== null) return false;

  if (ACT_TRANSITIONS[state.day]) {
    const transitionRows = rowsOn(state, state.day, 'act_transition');
    const beforeTransition = ['crisis', 'crisis_aftermath', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'act_transition'].includes(state.phase);
    if (transitionRows.length !== (beforeTransition ? 0 : 1)) return false;
    if (state.day === 16) {
      const rebuttalRows = rowsOn(state, 16, 'external_rebuttal');
      const rebuttalRecorded = transitionRows.length === 1
        && (state.phase !== 'act_aftermath' || state.actAftermath?.resolution !== null);
      if (rebuttalRows.length !== (rebuttalRecorded ? 1 : 0)) return false;
    }
  }

  if (HOUSEHOLD_EVENTS[state.day]) {
    const householdRows = rowsOn(state, state.day, 'household');
    const beforeHousehold = ['crisis', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'act_transition', 'act_aftermath', 'day', 'day_aftermath', 'joint_result', 'portable_precedent', 'household'].includes(state.phase);
    if (householdRows.length !== (beforeHousehold ? 0 : 1)) return false;
    const householdAftermathRows = rowsOn(state, state.day, 'household_aftermath');
    const aftermathPending = state.phase === 'household_aftermath' && state.householdAftermath?.resolution === null;
    if (householdAftermathRows.length !== (beforeHousehold || aftermathPending ? 0 : 1)) return false;
    if (householdAftermathRows.length && householdAftermathRows[0].approach !== householdRows[0]?.choice) return false;
  }

  if (PUBLIC_FOLLOWUPS[state.day]) {
    if (state.day === 15) {
      const evidenceRows = rowsOn(state, 15, 'public_evidence_chain');
      const beforeEvidence = ['crisis', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'day', 'day_aftermath', 'joint_result', 'portable_precedent', 'household', 'council', 'council_aftermath', 'banquet', 'public_evidence'].includes(state.phase)
        || (state.phase === 'scene' && state.sceneReturnPhase === 'after_public_scene');
      if (evidenceRows.length !== (beforeEvidence ? 0 : 1)) return false;
    }
    const followupRows = rowsOn(state, state.day, 'public_followup');
    const beforeFollowup = ['crisis', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'day', 'day_aftermath', 'joint_result', 'portable_precedent', 'household', 'council', 'council_aftermath', 'banquet', 'public_evidence', 'public_followup'].includes(state.phase)
      || (state.phase === 'scene' && state.sceneReturnPhase === 'after_public_scene');
    if (followupRows.length !== (beforeFollowup ? 0 : 1)) return false;
  }

  if (state.day === MAX_DAY) {
    const reckoningRows = rowsOn(state, MAX_DAY, 'final_reckoning');
    const beforeReckoning = ['crisis', 'pair_interlude', 'morning_settlement', 'morning', 'favor_reckoning', 'memory_reckoning', 'act_transition', 'day', 'day_aftermath', 'joint_result', 'portable_precedent', 'household', 'council', 'council_aftermath', 'banquet', 'public_followup', 'final_reckoning'].includes(state.phase)
      || (state.phase === 'scene' && state.sceneReturnPhase === 'after_public_scene');
    if (reckoningRows.length !== (beforeReckoning ? 0 : 1)) return false;
    const aftermathRows = rowsOn(state, MAX_DAY, 'final_reckoning_aftermath');
    const aftermathPending = state.phase === 'final_aftermath' && state.finalReckoningAftermath?.resolution === null;
    if (aftermathRows.length !== (beforeReckoning || aftermathPending ? 0 : 1)) return false;
    if (aftermathRows.length && aftermathRows[0].approach !== reckoningRows[0]?.choice) return false;
  }

  const personalSceneOpen = state.phase === 'scene' && state.sceneReturnPhase === 'after_night';
  const personalAfterglowOpen = state.phase === 'personal_afterglow';
  const personalAfterglowAftermathOpen = state.phase === 'personal_afterglow_aftermath';
  const personalAfterglowAftermathResolved = personalAfterglowAftermathOpen && state.personalAfterglowAftermath?.resolution !== null;
  const nightConversationOpen = state.phase === 'night' && !!currentNightConversation(state);
  const ordinaryNightCodaOpen = state.phase === 'night' && !!currentOrdinaryNightCoda(state);
  const personalFinaleOpen = ['personal_finale', 'personal_finale_result'].includes(state.phase);
  const allianceEnding = state.phase === 'ending' && state.allianceChoices.length === ALLIANCE_NIGHT_BEATS.length;
  const personalEnding = state.phase === 'ending' && state.sharedNightChoice === null && !allianceEnding;
  const collapseVisitTail = state.collapseFinale?.source === 'visit'
    && ['collapse_finale', 'collapse_finale_result', 'ending'].includes(state.phase);
  const personalTail = personalFinaleOpen || personalEnding || collapseVisitTail;
  const currentNightRows = rowsOn(state, state.day, 'night');
  if (currentNightRows.length !== (nightConversationOpen || ordinaryNightCodaOpen || personalSceneOpen || personalAfterglowOpen || personalAfterglowAftermathOpen || personalTail ? 1 : 0)) return false;
  if (nightConversationOpen) {
    if (currentNightRows[0]?.action !== 'talk' || currentNightRows[0]?.heroine !== state.nightConversation.heroine) return false;
    const currentConversationRows = rowsOn(state, state.day, 'night_conversation');
    if (currentConversationRows.length !== (state.nightConversation.resolution ? 1 : 0)) return false;
  }
  if (ordinaryNightCodaOpen && (
    currentNightRows[0]?.action !== state.nightCoda.action
    || currentNightRows[0]?.heroine !== state.nightCoda.heroine
    || currentNightRows[0]?.scene !== null
  )) return false;
  const currentPersonalAfterglowRows = rowsOn(state, state.day, 'personal_afterglow');
  const expectedPersonalAfterglowRows = (personalAfterglowAftermathOpen || personalTail) && currentNightRows[0]?.scene ? 1 : 0;
  if (currentPersonalAfterglowRows.length !== expectedPersonalAfterglowRows) return false;
  if (currentPersonalAfterglowRows.length && (
    currentPersonalAfterglowRows[0].heroine !== currentNightRows[0]?.heroine
    || currentPersonalAfterglowRows[0].scene !== currentNightRows[0]?.scene
  )) return false;
  const currentPersonalAfterglowAftermathRows = rowsOn(state, state.day, 'personal_afterglow_aftermath');
  const expectedPersonalAfterglowAftermathRows = (personalAfterglowAftermathResolved || personalTail) && currentNightRows[0]?.scene ? 1 : 0;
  if (currentPersonalAfterglowAftermathRows.length !== expectedPersonalAfterglowAftermathRows) return false;
  if (currentPersonalAfterglowAftermathRows.length && (
    currentPersonalAfterglowAftermathRows[0].heroine !== currentPersonalAfterglowRows[0]?.heroine
    || currentPersonalAfterglowAftermathRows[0].scene !== currentPersonalAfterglowRows[0]?.scene
    || currentPersonalAfterglowAftermathRows[0].approach !== currentPersonalAfterglowRows[0]?.choice
  )) return false;
  if (personalFinaleOpen && currentNightRows[0]?.heroine !== state.personalFinale?.heroine) return false;
  if (state.phase === 'ending' && state.ending?.id === 'exclusive' && currentNightRows[0]?.heroine !== state.ending.heroine) return false;

  const visitStarts = rowsOn(state, state.day, 'visit_start');
  const visitResolutions = rowsOn(state, state.day, ['visit_choice', 'accord_term']);
  const aftermathRows = rowsOn(state, state.day, 'route_aftermath');
  const routeAftermathResolved = state.phase === 'route_aftermath' && state.routeAftermath?.resolution !== null;
  const duringPersonalVisit = ['visit', 'route_aftermath', 'night', 'personal_afterglow', 'personal_afterglow_aftermath', 'personal_finale', 'personal_finale_result'].includes(state.phase) || personalSceneOpen || personalEnding || collapseVisitTail;
  if (visitStarts.length !== (duringPersonalVisit ? 1 : 0)) return false;
  if (visitResolutions.length !== (['route_aftermath', 'night', 'personal_afterglow', 'personal_afterglow_aftermath', 'personal_finale', 'personal_finale_result'].includes(state.phase) || personalSceneOpen || personalEnding || collapseVisitTail ? 1 : 0)) return false;
  if (aftermathRows.length !== (routeAftermathResolved || ['night', 'personal_afterglow', 'personal_afterglow_aftermath', 'personal_finale', 'personal_finale_result'].includes(state.phase) || personalSceneOpen || personalEnding || collapseVisitTail ? 1 : 0)) return false;
  if (aftermathRows.length && (
    aftermathRows[0].heroine !== visitStarts[0]?.heroine
    || aftermathRows[0].sourceChoice !== visitResolutions[0]?.choice
    || (routeAftermathResolved && aftermathRows[0].choice !== state.routeAftermath.resolution.choice)
  )) return false;
  if (duringPersonalVisit && visitStarts[0].heroine !== (state.currentHeroine ?? currentNightRows[0]?.heroine)) return false;

  const jointHistory = state.history.filter((entry) => entry.type === 'joint_action').map((entry) => entry.action);
  if (jointHistory.join('\0') !== state.jointActions.join('\0')) return false;
  for (const id of HEROINE_IDS) {
    if (state.visits[id] !== state.history.filter((entry) => entry.type === 'visit_choice' && entry.heroine === id).length) return false;
    const term = ACCORD_CHOICES[id].effects.accord;
    const termCount = state.history.filter((entry) => entry.type === 'accord_term' && entry.heroine === id && entry.term === term).length;
    if (termCount > 1 || state.accords[term] !== (termCount === 1)) return false;
  }
  const routeHistory = state.history.filter((entry) => entry.type === 'visit_choice');
  const routeFlagCount = (flag) => routeHistory.filter((entry) => (
    routeChoiceById(entry.heroine, entry.choice)?.effects?.flags ?? []
  ).includes(flag)).length;
  for (const row of Object.values(COALITION_PROOF_META)) {
    if (!!state.flags[row.flag] !== (routeFlagCount(row.flag) > 0)) return false;
  }
  for (const [flag, heroine] of Object.entries(OVERRIDE_FLAG_TO_HEROINE)) {
    const count = routeFlagCount(flag);
    if (!!state.flags[flag] !== (count > 0) || state.publicOverrides[heroine] !== count) return false;
  }
  for (const day of PUBLIC_EVENT_DAYS) {
    const event = PUBLIC_EVENTS[day];
    const balancedHistory = state.history.some((entry) => entry.type === 'banquet' && entry.day === day
      && event.choices.find((choice) => choice.id === entry.choice)?.effects?.flags?.includes(event.balanceFlag));
    if (!!state.flags[event.balanceFlag] !== balancedHistory) return false;
  }
  const evidenceRows = state.history.filter((entry) => entry.type === 'public_evidence_chain');
  if (evidenceRows.length > 1) return false;
  if (evidenceRows.some((entry) => publicEvidenceEvaluationForState(state, entry.chain)?.id !== entry.result)) return false;
  for (const id of Object.keys(PUBLIC_EVIDENCE_CHAIN.outcomes)) {
    if (!!state.flags[`public_chain_${id}`] !== evidenceRows.some((entry) => entry.result === id)) return false;
  }
  if (externalRows.length) {
    const row = externalRows[0];
    const evidence = evidenceRows[0];
    const actRow = state.history.find((entry) => entry.type === 'act_transition' && entry.day === 16);
    if (!evidence
      || row.sourceResult !== evidence.result
      || JSON.stringify(row.sourceChain) !== JSON.stringify(evidence.chain)
      || row.actChoice !== actRow?.choice) return false;
  }
  for (const event of Object.values(EXTERNAL_REBUTTALS)) {
    for (const choice of event.choices) {
      for (const flag of choice.effects?.flags ?? []) {
        const recorded = externalRows.some((entry) => entry.choice === choice.id);
        if (!!state.flags[flag] !== recorded) return false;
      }
    }
  }

  const derivedUnlocked = new Set();
  for (const entry of state.history) {
    if (entry.type === 'night' && entry.scene) derivedUnlocked.add(entry.scene);
    if (entry.type === 'banquet') derivedUnlocked.add(PUBLIC_EVENTS[entry.day].scene);
    if (entry.type === 'shared_night' && entry.choice === COALITION_CHOICE_ID) derivedUnlocked.add('inner_court_accord');
  }
  const afterglowHistory = state.history.filter((entry) => entry.type === 'shared_afterglow');
  if (afterglowHistory.length === SHARED_AFTERGLOW_BEATS.length && state.phase !== 'shared_afterglow_result') derivedUnlocked.add('inner_court_afterglow');
  const completedAllianceHistory = state.history.filter((entry) => entry.type === 'alliance_night');
  if (completedAllianceHistory.length === ALLIANCE_NIGHT_BEATS.length && state.phase !== 'alliance_night_result') derivedUnlocked.add('inner_court_alliance');
  if (derivedUnlocked.size !== state.unlocked.length || state.unlocked.some((id) => !derivedUnlocked.has(id))) return false;

  const allianceAssemblies = state.history.filter((entry) => entry.type === 'alliance_assembly');
  const allianceStarts = state.history.filter((entry) => entry.type === 'alliance_night_start');
  const allianceRows = state.history.filter((entry) => entry.type === 'alliance_night');
  if (allianceAssemblies.length > 1 || allianceStarts.length > 1) return false;
  const assemblyRow = allianceAssemblies[0] ?? null;
  const privatePrice = recordedFivePriceSettlement(state);
  if (assemblyRow) {
    if (privatePrice?.coalition.kind !== 'limited'
      || JSON.stringify(assemblyRow.candidates) !== JSON.stringify(privatePrice.coalition.members)
      || JSON.stringify(assemblyRow.members) !== JSON.stringify(assemblyRow.replies.filter((reply) => reply.outcome !== 'withdraw').map((reply) => reply.heroine))) return false;
    if (state.phase === 'alliance_assembly') {
      if (allianceStarts.length || state.allianceMembers.length || state.allianceChoices.length
        || JSON.stringify(state.allianceAssembly?.candidates) !== JSON.stringify(assemblyRow.candidates)
        || JSON.stringify(state.allianceAssembly?.replies) !== JSON.stringify(assemblyRow.replies)
        || JSON.stringify(state.allianceAssembly?.members) !== JSON.stringify(assemblyRow.members)) return false;
    } else if (assemblyRow.members.length >= 2) {
      if (allianceStarts.length !== 1 || JSON.stringify(allianceStarts[0].members) !== JSON.stringify(assemblyRow.members)) return false;
    } else if (allianceStarts.length || state.allianceMembers.length || state.allianceChoices.length) return false;
  } else if (allianceStarts.length || state.phase === 'alliance_assembly') return false;
  if (state.allianceMembers.length) {
    if (allianceStarts.length !== 1
      || JSON.stringify(allianceStarts[0].members) !== JSON.stringify(state.allianceMembers)
      || allianceRows.length !== state.allianceChoices.length) return false;
    for (let index = 0; index < allianceRows.length; index += 1) {
      if (allianceRows[index].beat !== ALLIANCE_NIGHT_BEATS[index].id
        || allianceRows[index].choice !== state.allianceChoices[index]
        || JSON.stringify(allianceRows[index].members) !== JSON.stringify(state.allianceMembers)) return false;
    }
    if (state.phase === 'alliance_night') {
      if (state.allianceChoices.length >= ALLIANCE_NIGHT_BEATS.length) return false;
    } else if (state.phase === 'alliance_night_result') {
      if (state.allianceChoices.length < 1
        || state.allianceChoices.length > ALLIANCE_NIGHT_BEATS.length
        || !currentAllianceNightResult(state)) return false;
    } else if (state.phase === 'scene' && state.sceneReturnPhase === 'after_alliance_night') {
      if (state.pendingScene !== 'inner_court_alliance'
        || state.allianceChoices.length !== ALLIANCE_NIGHT_BEATS.length
        || !recordedAllianceNightTableau(state)) return false;
    } else if (state.phase !== 'ending' || state.ending?.id !== 'alliance'
      || state.allianceChoices.length !== ALLIANCE_NIGHT_BEATS.length) return false;
  } else if (allianceStarts.length || allianceRows.length || state.allianceChoices.length) return false;

  const sharedStarts = state.history.filter((entry) => entry.type === 'shared_night_start');
  const sharedRows = state.history.filter((entry) => entry.type === 'shared_night');
  if (allianceStarts.length && (sharedStarts.length || sharedRows.length)) return false;
  if (state.phase === 'shared_night') {
    if (sharedStarts.length !== 1 || sharedRows.length !== 0 || state.sharedNightChoice !== null) return false;
  } else if (state.sharedNightChoice !== null) {
    if (sharedStarts.length !== 1 || sharedRows.length !== 1 || sharedRows[0].choice !== state.sharedNightChoice) return false;
  } else if (sharedStarts.length || sharedRows.length) return false;
  if (afterglowHistory.length !== state.sharedAfterglowChoices.length) return false;
  for (let index = 0; index < afterglowHistory.length; index += 1) {
    if (afterglowHistory[index].beat !== SHARED_AFTERGLOW_BEATS[index].id || afterglowHistory[index].choice !== state.sharedAfterglowChoices[index]) return false;
  }
  const dawnRows = state.history.filter((entry) => entry.type === 'shared_dawn');
  if (state.sharedDawnChoice === null ? dawnRows.length !== 0 : dawnRows.length !== 1 || dawnRows[0].choice !== state.sharedDawnChoice) return false;

  const collapseStarts = state.history.filter((entry) => entry.type === 'collapse_finale_start');
  const collapseRows = state.history.filter((entry) => entry.type === 'collapse_finale');
  if (state.collapseFinale) {
    if (collapseStarts.length !== 1) return false;
    const start = collapseStarts[0];
    if (start.cause !== state.collapseFinale.cause
      || start.source !== state.collapseFinale.source
      || start.endingId !== state.collapseFinale.endingId
      || start.endingDetail !== state.collapseFinale.endingDetail) return false;
    if (collapseRows.length !== (state.collapseFinale.choice ? 1 : 0)) return false;
    if (collapseRows.length && (
      collapseRows[0].cause !== start.cause
      || collapseRows[0].source !== start.source
      || collapseRows[0].endingId !== start.endingId
      || collapseRows[0].endingDetail !== start.endingDetail
      || collapseRows[0].choice !== state.collapseFinale.choice
    )) return false;
    if (state.collapseFinale.source === 'shared') {
      if (!['shared_buy_quiet', 'shared_false_only'].includes(state.sharedNightChoice)
        || state.sharedNightChoice !== state.collapseFinale.cause) return false;
    } else if (state.sharedNightChoice !== null || currentNightRows.length !== 1) return false;
  } else if (collapseStarts.length || collapseRows.length) return false;

  const sharedTail = ['shared_afterglow', 'shared_afterglow_result', 'shared_dawn', 'shared_dawn_result'].includes(state.phase)
    || (state.phase === 'scene' && ['after_shared_work', 'after_shared_afterglow'].includes(state.sceneReturnPhase))
    || (state.phase === 'ending' && state.sharedNightChoice === COALITION_CHOICE_ID);
  if (sharedTail) {
    const readiness = sharedNightStatus({ ...state, phase: 'choose_visit' });
    if (!readiness.ready || state.sharedNightChoice !== COALITION_CHOICE_ID || !state.flags.harem_coalition) return false;
  }
  return true;
}

function validCurrentSave(state) {
  if (!isRecord(state) || state.version !== SAVE_VERSION) return false;
  if (!Number.isSafeInteger(state.seed) || !Number.isInteger(state.day) || state.day < 1 || state.day > MAX_DAY) return false;
  if (!SAVE_PHASES.has(state.phase) || typeof state.over !== 'boolean') return false;
  if (!Number.isInteger(state.sceneBeat) || state.sceneBeat < 0) return false;
  if (!hasExactKeys(state.resources, RESOURCE_KEYS) || !hasFiniteFields(state.resources, RESOURCE_KEYS)) return false;
  if (state.resources.silver < 0
    || !inRange(state.resources.power, 0, 6)
    || !inRange(state.resources.repute, 0, 6)
    || !inRange(state.resources.exposure, 0, 100)
    || !inRange(state.resources.strain, 0, 100)
    || !inRange(state.resources.house, 0, 100)) return false;
  if (!isRecord(state.flags)) return false;
  for (const key of ['secrets', 'secretsUsed', 'history', 'log', 'jointActions', 'resolvedPressures', 'personalFinaleChoices', 'allianceMembers', 'allianceChoices', 'sharedAfterglowChoices', 'unlocked']) {
    if (!Array.isArray(state[key])) return false;
  }
  if ([state.secrets, state.secretsUsed, state.unlocked].some((rows) => new Set(rows).size !== rows.length)) return false;
  if (new Set(state.resolvedPressures).size !== state.resolvedPressures.length || state.resolvedPressures.some((id) => !DAY_DEFS.some((day) => day.id === id))) return false;
  if (state.secrets.some((id) => !KNOWN_SECRET_IDS.has(id)) || state.secretsUsed.some((id) => !KNOWN_SECRET_IDS.has(id))) return false;
  if (state.secrets.some((id) => state.secretsUsed.includes(id))) return false;
  if (state.selectedSecret !== null && (
    typeof state.selectedSecret !== 'string'
    || !state.secrets.includes(state.selectedSecret)
    || !usableSecrets(state).some((row) => row.id === state.selectedSecret)
  )) return false;
  if (![state.relations, state.publicOverrides, state.routeReopensOn, state.visits]
    .every((map) => hasExactKeys(map, HEROINE_IDS))) return false;
  if (!hasExactKeys(state.routeStances, HEROINE_IDS) || !HEROINE_IDS.every((id) => (
    hasExactKeys(state.routeStances[id], ['covenant', 'private'])
    && Number.isInteger(state.routeStances[id].covenant)
    && Number.isInteger(state.routeStances[id].private)
    && state.routeStances[id].covenant >= 0
    && state.routeStances[id].private >= 0
    && state.routeStances[id].covenant + state.routeStances[id].private === state.visits[id]
  ))) return false;
  if (!hasExactKeys(state.bonds, PAIR_IDS) || PAIR_IDS.some((id) => !Number.isInteger(state.bonds[id]) || !inRange(state.bonds[id], -100, 100))) return false;
  if (!HEROINE_IDS.every((id) => (
    hasExactKeys(state.relations?.[id], ['qing', 'yu', 'du', 'ignored', 'reasons'])
    && hasFiniteFields(state.relations[id], ['qing', 'yu', 'du', 'ignored'])
    && Array.isArray(state.relations[id].reasons)
    && inRange(state.relations[id].qing, 0, 100)
    && inRange(state.relations[id].yu, 0, 100)
    && inRange(state.relations[id].du, 0, 100)
    && Number.isInteger(state.relations[id].ignored) && state.relations[id].ignored >= 0
    && Number.isInteger(state.publicOverrides?.[id]) && state.publicOverrides[id] >= 0
    && Number.isInteger(state.routeReopensOn?.[id]) && state.routeReopensOn[id] >= 0
    && Number.isInteger(state.visits?.[id])
    && state.visits[id] >= 0 && state.visits[id] <= (ROUTE_CHOICES[id]?.length ?? 0)
  ))) return false;
  if (!hasExactKeys(state.household, HOUSEHOLD_IDS)) return false;
  if (!HOUSEHOLD_IDS.every((id) => (
    hasFiniteFields(state.household?.[id], ['regard'])
    && Array.isArray(state.household[id].reasons)
    && inRange(state.household[id].regard, -100, 100)
  ))) return false;
  if (!hasExactKeys(state.accords, ACCORD_KEYS)) return false;
  if (!ACCORD_KEYS.every((key) => typeof state.accords?.[key] === 'boolean')) return false;
  const completed = new Set(state.jointActions);
  if (completed.size !== state.jointActions.length || [...completed].some((id) => !JOINT_ACTION_IDS.has(id))) return false;
  if (state.unlocked.some((id) => !SCENES[id])) return false;
  if (state.phase === 'joint_result' && (
    !JOINT_ACTION_IDS.has(state.currentJointAction)
    || !completed.has(state.currentJointAction)
    || !Number.isInteger(state.jointActionBeat)
    || !inRange(state.jointActionBeat, 0, 2)
    || !currentJointAction(state)?.storyBeat
  )) return false;
  if (state.phase !== 'joint_result' && (state.currentJointAction !== null || state.jointActionBeat !== 0)) return false;
  if (state.phase === 'portable_precedent') {
    const firstJoint = state.history.find((entry) => entry.type === 'joint_action') ?? null;
    if (!isRecord(state.portablePrecedent)
      || !hasExactKeys(state.portablePrecedent, ['event','action','sourceDay','beat','choice'])
      || !PORTABLE_PRECEDENTS[state.portablePrecedent.action]
      || state.portablePrecedent.event !== PORTABLE_PRECEDENTS[state.portablePrecedent.action].id
      || !Number.isInteger(state.portablePrecedent.sourceDay)
      || state.portablePrecedent.action !== firstJoint?.action
      || state.portablePrecedent.sourceDay !== firstJoint?.day
      || !Number.isInteger(state.portablePrecedent.beat)
      || !inRange(state.portablePrecedent.beat, 0, 4)
      || (state.portablePrecedent.beat < 4 && state.portablePrecedent.choice !== null)
      || (state.portablePrecedent.beat === 4 && !PORTABLE_PRECEDENT_CHOICE_IDS.has(state.portablePrecedent.choice))
      || !currentPortablePrecedent(state)?.current) return false;
  } else if (state.portablePrecedent !== null) return false;
  if (state.phase === 'household_aftermath') {
    if (!isRecord(state.householdAftermath)
      || !hasExactKeys(state.householdAftermath, ['event', 'choice', 'beat', 'resolution'])
      || !Number.isInteger(state.householdAftermath.beat)
      || !inRange(state.householdAftermath.beat, 0, 2)
      || (state.householdAftermath.resolution !== null && (
        state.householdAftermath.beat !== 2
        || !hasExactKeys(state.householdAftermath.resolution, ['choice', 'text'])
      ))
      || !currentHouseholdAftermath(state)?.current) return false;
  } else if (state.householdAftermath !== null) return false;
  if (state.phase === 'council' && !COUNCIL_EVENTS[state.day]) return false;
  if (state.phase === 'council_aftermath') {
    if (!isRecord(state.councilAftermath)
      || !hasExactKeys(state.councilAftermath, ['event', 'choice', 'beat'])
      || !Number.isInteger(state.councilAftermath.beat)
      || !inRange(state.councilAftermath.beat, 0, 2)
      || !currentCouncilAftermath(state)?.current) return false;
  } else if (state.councilAftermath !== null) return false;
  if (state.phase === 'act_aftermath') {
    if (!isRecord(state.actAftermath)
      || !hasExactKeys(state.actAftermath, ['event', 'choice', 'beat', 'resolution'])
      || !Number.isInteger(state.actAftermath.beat)
      || !inRange(state.actAftermath.beat, 0, 2)
      || (state.day !== 16 && state.actAftermath.resolution !== null)
      || (state.actAftermath.resolution !== null && (
        state.actAftermath.beat !== 2
        || !hasExactKeys(state.actAftermath.resolution, ['choice', 'text'])
      ))
      || !currentActAftermath(state)?.current) return false;
  } else if (state.actAftermath !== null) return false;
  if (state.phase === 'public_evidence') {
    if (state.day !== 15
      || !isRecord(state.publicEvidence)
      || !hasExactKeys(state.publicEvidence, ['selected', 'result'])
      || !Array.isArray(state.publicEvidence.selected)
      || state.publicEvidence.selected.length > 3
      || new Set(state.publicEvidence.selected).size !== state.publicEvidence.selected.length
      || state.publicEvidence.selected.some((id) => !publicEvidenceById(id))
      || (state.publicEvidence.selected.length < 3 && state.publicEvidence.result !== null)
      || (state.publicEvidence.selected.length === 3 && publicEvidenceEvaluationForState(state, state.publicEvidence.selected)?.id !== state.publicEvidence.result)
      || !currentPublicEvidence(state)) return false;
  } else if (state.publicEvidence !== null) return false;
  if (state.phase === 'public_aftermath') {
    if (!isRecord(state.publicAftermath)
      || !hasExactKeys(state.publicAftermath, ['event', 'choice', 'beat'])
      || !Number.isInteger(state.publicAftermath.beat)
      || !inRange(state.publicAftermath.beat, 0, 2)
      || !currentPublicAftermath(state)?.current) return false;
  } else if (state.publicAftermath !== null) return false;
  if (state.phase === 'five_private_prices') {
    if (!isRecord(state.fivePrivatePrices)
      || !hasExactKeys(state.fivePrivatePrices, ['event','day16Mode','day16Result','protocol','replies','beat','right','coalition'])
      || !currentFivePrivatePrices(state)?.current) return false;
  } else if (state.fivePrivatePrices !== null) return false;
  if (state.phase === 'final_aftermath') {
    if (!isRecord(state.finalReckoningAftermath)
      || !hasExactKeys(state.finalReckoningAftermath, ['event', 'choice', 'beat', 'resolution'])
      || !Number.isInteger(state.finalReckoningAftermath.beat)
      || !inRange(state.finalReckoningAftermath.beat, 0, 2)
      || (state.finalReckoningAftermath.resolution !== null && (
        state.finalReckoningAftermath.beat !== 2
        || !hasExactKeys(state.finalReckoningAftermath.resolution, ['choice', 'text'])
      ))
      || !currentFinalReckoningAftermath(state)?.current) return false;
  } else if (state.finalReckoningAftermath !== null) return false;
  if (['visit', 'route_aftermath', 'night', 'personal_afterglow', 'personal_afterglow_aftermath'].includes(state.phase) && !HEROINE_IDS.includes(state.currentHeroine)) return false;
  if (state.phase === 'route_aftermath') {
    if (!isRecord(state.routeAftermath)
      || !hasExactKeys(state.routeAftermath, ['event', 'heroine', 'observer', 'lane', 'act', 'step', 'beat', 'sourceChoice', 'resolution'])
      || !currentRouteAftermath(state)) return false;
  } else if (state.routeAftermath !== null) return false;
  if (state.phase === 'personal_afterglow') {
    if (!isRecord(state.personalAfterglow)
      || !hasExactKeys(state.personalAfterglow, ['event', 'heroine', 'scene', 'tier'])
      || !currentPersonalAfterglow(state)) return false;
  } else if (state.personalAfterglow !== null) return false;
  if (state.phase === 'personal_afterglow_aftermath') {
    if (!isRecord(state.personalAfterglowAftermath)
      || !hasExactKeys(state.personalAfterglowAftermath, ['event', 'heroine', 'scene', 'tier', 'approach', 'beat', 'resolution'])
      || !Number.isInteger(state.personalAfterglowAftermath.beat)
      || !inRange(state.personalAfterglowAftermath.beat, 0, 1)
      || (state.personalAfterglowAftermath.resolution !== null && (
        state.personalAfterglowAftermath.beat !== 1
        || !hasExactKeys(state.personalAfterglowAftermath.resolution, ['choice', 'text'])
      ))
      || !currentPersonalAfterglowAftermath(state)?.current) return false;
  } else if (state.personalAfterglowAftermath !== null) return false;
  if (state.phase === 'night' && state.nightConversation !== null) {
    if (!isRecord(state.nightConversation)
      || !hasExactKeys(state.nightConversation, ['event', 'heroine', 'chapter', 'beat', 'resolution'])
      || !currentNightConversation(state)) return false;
    if (state.nightConversation.resolution !== null && (
      !hasExactKeys(state.nightConversation.resolution, ['choice', 'text', 'beat'])
      || !currentNightConversation(state)?.resolution
    )) return false;
  } else if (state.nightConversation !== null) return false;
  if (state.phase === 'night' && state.nightCoda !== null) {
    if (!isRecord(state.nightCoda)
      || !hasExactKeys(state.nightCoda, ['event', 'heroine', 'action', 'act', 'beat'])
      || state.nightConversation !== null
      || !currentOrdinaryNightCoda(state)) return false;
  } else if (state.nightCoda !== null) return false;
  if (state.personalFinaleChoices.some((id) => !PERSONAL_FINALE_CHOICE_IDS.has(id))
    || new Set(state.personalFinaleChoices).size !== state.personalFinaleChoices.length
    || state.personalFinaleChoices.length > 3) return false;
  if (state.phase === 'personal_finale') {
    if (state.day !== MAX_DAY
      || !isRecord(state.personalFinale)
      || !hasExactKeys(state.personalFinale, ['event', 'heroine', 'departureBeat', 'departures'])
      || state.personalFinale.departureBeat !== -1
      || !Array.isArray(state.personalFinale.departures)
      || state.personalFinale.departures.length !== 0
      || !personalFinaleBeat(state)
      || state.personalFinaleChoices.length >= 3) return false;
  } else if (state.phase === 'personal_finale_result') {
    if (state.day !== MAX_DAY
      || !isRecord(state.personalFinale)
      || !hasExactKeys(state.personalFinale, ['event', 'heroine', 'departureBeat', 'departures'])
      || state.personalFinaleChoices.length < 1
      || state.personalFinaleChoices.length > 3
      || !Number.isInteger(state.personalFinale.departureBeat)
      || state.personalFinale.departureBeat < -1
      || state.personalFinale.departureBeat > 3
      || !Array.isArray(state.personalFinale.departures)
      || !validPersonalFinaleDepartures(state.personalFinale.departures, state.personalFinale.heroine, state.personalFinaleChoices.length < 3)
      || (state.personalFinaleChoices.length < 3 && (state.personalFinale.departureBeat !== -1 || state.personalFinale.departures.length !== 0))
      || (state.personalFinaleChoices.length === 3 && state.personalFinale.departures.length !== 4)
      || !currentPersonalFinaleResult(state)) return false;
  } else if (state.personalFinale !== null) return false;
  if (state.phase === 'alliance_assembly') {
    const story = currentAllianceAssembly(state);
    if (state.day !== MAX_DAY
      || !isRecord(state.allianceAssembly)
      || !hasExactKeys(state.allianceAssembly, ['beat','candidates','replies','members'])
      || !Number.isInteger(state.allianceAssembly.beat)
      || !story
      || state.allianceAssembly.beat < 0
      || state.allianceAssembly.beat >= story.count
      || state.allianceMembers.length
      || state.allianceChoices.length) return false;
  } else if (state.allianceAssembly !== null) return false;
  if (state.collapseFinale !== null) {
    if (!isRecord(state.collapseFinale)
      || !hasExactKeys(state.collapseFinale, ['cause', 'source', 'endingId', 'endingDetail', 'beat', 'choice'])
      || !COLLAPSE_CAUSES.has(state.collapseFinale.cause)
      || !['shared', 'visit'].includes(state.collapseFinale.source)
      || !['intrigue', 'unstable'].includes(state.collapseFinale.endingId)
      || !Number.isInteger(state.collapseFinale.beat)
      || !inRange(state.collapseFinale.beat, 0, HEROINE_IDS.length - 1)
      || (state.collapseFinale.endingId === 'intrigue'
        ? !['clean', 'watched', 'burned'].includes(state.collapseFinale.endingDetail)
        : !['no_scene', 'second_too_close', 'broke_word', 'not_enough_power', 'spread_thin'].includes(state.collapseFinale.endingDetail))) return false;
    if (state.collapseFinale.choice !== null && !collapseChoiceById(state.collapseFinale.cause, state.collapseFinale.choice)) return false;
  }
  if (state.phase === 'collapse_finale') {
    if (state.day !== MAX_DAY
      || !state.collapseFinale
      || state.collapseFinale.choice !== null
      || state.collapseFinale.beat > 3
      || !currentCollapseFinale(state)) return false;
  } else if (state.phase === 'collapse_finale_result') {
    if (state.day !== MAX_DAY
      || !state.collapseFinale?.choice
      || !currentCollapseFinaleResult(state)) return false;
  } else if (state.phase !== 'ending' && state.collapseFinale !== null) return false;
  if (['crisis', 'morning_settlement'].includes(state.phase) && state.currentCrisis !== null) {
    const crisisForValidation = state.phase === 'crisis' ? state : { ...state, phase:'crisis' };
    if (!isRecord(state.currentCrisis)
      || !hasExactKeys(state.currentCrisis, ['event', 'type', 'act', 'triggerFacts', 'replyBeat', 'replies'])
      || !isRecord(state.currentCrisis.triggerFacts)
      || !hasExactKeys(state.currentCrisis.triggerFacts, ['missed','silver','exposure','house','strain'])
      || !hasFiniteFields(state.currentCrisis.triggerFacts, ['missed','silver','exposure','house','strain'])
      || !Number.isInteger(state.currentCrisis.replyBeat)
      || !Array.isArray(state.currentCrisis.replies)
      || (state.phase === 'morning_settlement' && (state.currentCrisis.replyBeat !== 0 || state.currentCrisis.replies.length !== 0))
      || !currentHouseCrisis(crisisForValidation)) return false;
  } else if (state.currentCrisis !== null) return false;
  if (state.phase === 'opening_aftermath') {
    if (!isRecord(state.openingAftermath)
      || !hasExactKeys(state.openingAftermath, ['choice', 'beat'])
      || !OPENING_CHOICE_IDS.has(state.openingAftermath.choice)
      || !Number.isInteger(state.openingAftermath.beat)
      || !inRange(state.openingAftermath.beat, 0, 2)
      || !currentOpeningAftermath(state)) return false;
  } else if (state.openingAftermath !== null) return false;
  if (state.phase === 'crisis_aftermath') {
    if (!isRecord(state.crisisAftermath)
      || !hasExactKeys(state.crisisAftermath, ['event', 'crisis', 'act', 'approach', 'pair', 'beat', 'resolution'])
      || !Number.isInteger(state.crisisAftermath.act)
      || !Number.isInteger(state.crisisAftermath.beat)
      || !inRange(state.crisisAftermath.act, 1, 4)
      || !inRange(state.crisisAftermath.beat, 0, 2)
      || (state.crisisAftermath.pair !== null && (
        !Array.isArray(state.crisisAftermath.pair)
        || state.crisisAftermath.pair.length !== 2
      ))
      || (state.crisisAftermath.resolution !== null && (
        state.crisisAftermath.beat !== 2
        || !hasExactKeys(state.crisisAftermath.resolution, ['choice', 'text'])
      ))
      || !currentHouseCrisisAftermath(state)?.current) return false;
  } else if (state.crisisAftermath !== null) return false;
  if (['pair_interlude', 'morning_settlement'].includes(state.phase) && state.pairInterlude !== null) {
    const pairForValidation = state.phase === 'pair_interlude' ? state : { ...state, phase:'pair_interlude' };
    if (!isRecord(state.pairInterlude)
      || !hasExactKeys(state.pairInterlude, ['event', 'pair', 'beat', 'resolution'])
      || !Array.isArray(state.pairInterlude.pair)
      || !Number.isInteger(state.pairInterlude.beat)
      || !inRange(state.pairInterlude.beat, 0, 2)
      || (state.pairInterlude.resolution !== null && (
        !isRecord(state.pairInterlude.resolution)
        || !hasExactKeys(state.pairInterlude.resolution, ['choice', 'beat'])
        || !PAIR_INTERLUDE_CHOICE_LABELS[state.pairInterlude.resolution.choice]
        || !Number.isInteger(state.pairInterlude.resolution.beat)
        || !inRange(state.pairInterlude.resolution.beat, 0, 2)
      ))
      || (state.phase === 'morning_settlement' && (state.currentCrisis !== null || state.pairInterlude.beat !== 0 || state.pairInterlude.resolution !== null))
      || !currentPairInterlude(pairForValidation)) return false;
  } else if (state.pairInterlude !== null) return false;
  if (state.phase === 'memory_reckoning') {
    if (!isRecord(state.memoryReckoning)
      || !hasExactKeys(state.memoryReckoning, ['event', 'heroine', 'observer', 'sourceDay', 'sourceChoice', 'promise', 'beat', 'resolution'])
      || !Number.isInteger(state.memoryReckoning.beat)
      || !inRange(state.memoryReckoning.beat, 0, 2)
      || (state.memoryReckoning.resolution !== null && (
        state.memoryReckoning.beat !== 2
        || !hasExactKeys(state.memoryReckoning.resolution, ['choice', 'text'])
      ))
      || !currentMemoryReckoning(state)) return false;
  } else if (state.memoryReckoning !== null) return false;
  if (state.phase === 'favor_reckoning') {
    if (!isRecord(state.favorReckoning)
      || !hasExactKeys(state.favorReckoning, ['event', 'heroine', 'observer', 'sourceDay', 'sourceAction', 'beat', 'resolution'])
      || !Number.isInteger(state.favorReckoning.beat)
      || !inRange(state.favorReckoning.beat, 0, 2)
      || (state.favorReckoning.resolution !== null && (
        state.favorReckoning.beat !== 2
        || !hasExactKeys(state.favorReckoning.resolution, ['choice', 'text'])
      ))
      || !currentFavorReckoning(state)) return false;
  } else if (state.favorReckoning !== null) return false;
  if (state.phase === 'dusk_invitation') {
    if (!isRecord(state.duskInvitation)
      || !hasExactKeys(state.duskInvitation, ['event', 'heroine', 'witness'])
      || !currentDuskInvitation(state)) return false;
  } else if (state.duskInvitation !== null) return false;
  if (state.phase === 'dusk_invitation_aftermath') {
    if (!isRecord(state.duskInvitationAftermath)
      || !hasExactKeys(state.duskInvitationAftermath, ['event', 'heroine', 'witness', 'approach', 'beat', 'resolution'])
      || !Number.isInteger(state.duskInvitationAftermath.beat)
      || !inRange(state.duskInvitationAftermath.beat, 0, 2)
      || (state.duskInvitationAftermath.resolution !== null && (
        state.duskInvitationAftermath.beat !== 2
        || !hasExactKeys(state.duskInvitationAftermath.resolution, ['choice', 'text'])
      ))
      || !currentDuskInvitationAftermath(state)?.current) return false;
  } else if (state.duskInvitationAftermath !== null) return false;
  if (state.phase === 'day_aftermath') {
    if (!isRecord(state.dayAftermath)
      || !hasExactKeys(state.dayAftermath, ['event', 'action', 'actor', 'beat'])
      || !Number.isInteger(state.dayAftermath.beat)
      || !inRange(state.dayAftermath.beat, 0, 2)
      || !currentDayAftermath(state)?.current) return false;
  } else if (state.dayAftermath !== null) return false;
  if (state.phase === 'morning_settlement') {
    const current = currentMorningSettlement(state);
    const expectedSource = state.morningSettlement ? morningSettlementSource(state, state.morningSettlement.cause) : null;
    const rows = state.history.filter((entry) => entry.type === 'morning_settlement' && entry.day === state.day);
    if (!isRecord(state.morningSettlement)
      || !hasExactKeys(state.morningSettlement, ['event','cause','sourceDay','sourceType','sourceId','heroine','choice'])
      || !current
      || !expectedSource
      || current.sourceDay !== expectedSource.sourceDay
      || current.sourceType !== expectedSource.sourceType
      || current.sourceId !== expectedSource.sourceId
      || current.heroine.id !== expectedSource.heroine
      || rows.length !== (current.resolved ? 1 : 0)) return false;
    if (rows.length && (
      rows[0].cause !== current.cause
      || rows[0].sourceDay !== current.sourceDay
      || rows[0].sourceId !== current.sourceId
      || rows[0].heroine !== current.heroine.id
      || rows[0].choice !== current.choice.id
    )) return false;
  } else if (state.morningSettlement !== null) return false;
  if (state.phase === 'scene') {
    if (!SCENES[state.pendingScene]
      || !currentSceneChapter(state)
      || !['choose_visit', 'after_public_scene', 'after_night', 'after_shared_work', 'after_shared_afterglow', 'after_alliance_night'].includes(state.sceneReturnPhase)) return false;
    if (state.sceneReturnPhase === 'after_night' && !HEROINE_IDS.includes(state.currentHeroine)) return false;
    if (state.sceneReturnPhase === 'after_night' && SCENES[state.pendingScene].heroine !== state.currentHeroine) return false;
    if (state.sceneReturnPhase === 'choose_visit' && PUBLIC_EVENTS[state.day]?.scene !== state.pendingScene) return false;
    if (state.sceneReturnPhase === 'after_public_scene' && (
      PUBLIC_EVENTS[state.day]?.scene !== state.pendingScene || !PUBLIC_FOLLOWUPS[state.day]
    )) return false;
    if (state.sceneReturnPhase === 'after_shared_work' && (
      state.day !== MAX_DAY
      || state.pendingScene !== 'inner_court_accord'
      || state.sharedNightChoice !== COALITION_CHOICE_ID
      || !state.flags.harem_coalition
      || jointActionCount(state) < JOINT_ACTION_TARGET
      || HEROINE_IDS.some((heroine) => !jointParticipantCoverage(state).has(heroine))
      || !publicPromisesReady(state)
    )) return false;
    if (state.sceneReturnPhase === 'after_shared_afterglow' && (
      state.day !== MAX_DAY
      || state.pendingScene !== 'inner_court_afterglow'
      || state.sharedAfterglowChoices.length !== SHARED_AFTERGLOW_BEATS.length
      || !state.flags.harem_coalition
    )) return false;
    if (state.sceneReturnPhase === 'after_alliance_night' && (
      state.day !== MAX_DAY
      || state.pendingScene !== 'inner_court_alliance'
      || ![2, 3, 4].includes(state.allianceMembers.length)
      || state.allianceChoices.length !== ALLIANCE_NIGHT_BEATS.length
      || state.sharedNightChoice !== null
      || !recordedAllianceNightTableau(state)
    )) return false;
  } else if (state.pendingScene !== null || state.sceneReturnPhase !== null || state.sceneBeat !== 0) return false;
  if (['crisis', 'crisis_aftermath', 'pair_interlude', 'morning_settlement', 'morning'].includes(state.phase)) {
    if (!isRecord(state.morning)
      || !MORNING_EVENT_IDS.has(state.morning.id)
      || !HEROINE_IDS.includes(state.morning.actor)
      || !['tone', 'title', 'text'].every((key) => typeof state.morning[key] === 'string')
      || !Array.isArray(state.morning.notes)) return false;
    if (state.morning.id === 'rivalry') {
      const template = RIVALRY_MORNINGS[state.morning.actor];
      if (!template
        || !HEROINE_IDS.includes(state.morning.visited)
        || state.morning.visited === state.morning.actor
        || !Number.isInteger(state.morning.beat)
        || state.morning.beat < 0
        || state.morning.beat > 2
        || state.morning.title !== template.title
        || state.morning.text !== formatRivalryText(template.context, state.morning.actor, state.morning.visited)
        || (state.morning.resolution
          ? (!hasExactKeys(state.morning.resolution, ['choice', 'text'])
            || state.morning.beat !== 2
            || !currentMorningResolution(state)
            || state.morning.resolution.text !== formatRivalryText(template.results[state.morning.resolution.choice], state.morning.actor, state.morning.visited))
          : !currentMorningStory(state))) return false;
    }
  } else if (state.morning !== null) return false;
  if (['household', 'household_aftermath'].includes(state.phase) && state.currentHouseholdEvent !== HOUSEHOLD_EVENTS[state.day]?.id) return false;
  if (state.phase === 'opening' && state.day !== 1) return false;
  if (['crisis', 'crisis_aftermath', 'pair_interlude', 'morning_settlement', 'morning'].includes(state.phase) && state.day < 2) return false;
  if (state.phase === 'memory_reckoning' && state.day < 3) return false;
  if (state.phase === 'favor_reckoning' && state.day < 3) return false;
  if (state.phase === 'act_transition' && !ACT_TRANSITIONS[state.day]) return false;
  if (state.phase === 'act_aftermath' && !ACT_TRANSITIONS[state.day]) return false;
  if (state.phase === 'final_reckoning' && state.day !== MAX_DAY) return false;
  if (state.phase === 'final_aftermath' && state.day !== MAX_DAY) return false;
  if (state.phase === 'banquet' && !PUBLIC_EVENTS[state.day]) return false;
  if (state.phase === 'public_evidence' && state.day !== 15) return false;
  if (state.phase === 'public_followup' && !PUBLIC_FOLLOWUPS[state.day]) return false;
  if (state.phase === 'public_aftermath' && !PUBLIC_FOLLOWUPS[state.day]) return false;
  if (state.phase === 'five_private_prices' && state.day !== 19) return false;
  if (state.phase === 'shared_night' && (state.day !== MAX_DAY || state.sharedNightChoice !== null)) return false;
  if (state.sharedAfterglowChoices.some((id) => !SHARED_AFTERGLOW_CHOICE_IDS.has(id))) return false;
  if (![0, 2, 3, 4].includes(state.allianceMembers.length)
    || new Set(state.allianceMembers).size !== state.allianceMembers.length
    || state.allianceMembers.some((id) => !HEROINE_IDS.includes(id))) return false;
  if (state.allianceChoices.some((id) => !ALLIANCE_NIGHT_CHOICE_IDS.has(id))) return false;
  if (new Set(state.allianceChoices).size !== state.allianceChoices.length) return false;
  if (state.allianceChoices.length > ALLIANCE_NIGHT_BEATS.length) return false;
  for (let index = 0; index < state.allianceChoices.length; index += 1) {
    if (!ALLIANCE_NIGHT_BEATS[index].choices.some((choice) => choice.id === state.allianceChoices[index])) return false;
  }
  if (state.phase === 'alliance_night' && (
    state.day !== MAX_DAY
    || ![2, 3, 4].includes(state.allianceMembers.length)
    || state.allianceChoices.length >= ALLIANCE_NIGHT_BEATS.length
    || state.sharedNightChoice !== null
  )) return false;
  if (state.phase === 'alliance_night_result' && (
    state.day !== MAX_DAY
    || ![2, 3, 4].includes(state.allianceMembers.length)
    || state.allianceChoices.length < 1
    || state.allianceChoices.length > ALLIANCE_NIGHT_BEATS.length
    || state.sharedNightChoice !== null
    || !currentAllianceNightResult(state)
  )) return false;
  const allianceTableauOpen = state.phase === 'scene' && state.sceneReturnPhase === 'after_alliance_night';
  if (!['alliance_night', 'alliance_night_result', 'ending'].includes(state.phase) && !allianceTableauOpen && (state.allianceMembers.length || state.allianceChoices.length)) return false;
  if (state.sharedAfterglowChoices.length > SHARED_AFTERGLOW_BEATS.length) return false;
  for (let index = 0; index < state.sharedAfterglowChoices.length; index += 1) {
    if (!SHARED_AFTERGLOW_BEATS[index].choices.some((choice) => choice.id === state.sharedAfterglowChoices[index])) return false;
  }
  if (state.sharedDawnChoice !== null && !SHARED_DAWN_CHOICE_IDS.has(state.sharedDawnChoice)) return false;
  if (state.phase === 'shared_afterglow' && (
    state.day !== MAX_DAY
    || state.sharedNightChoice !== COALITION_CHOICE_ID
    || state.sharedAfterglowChoices.length >= SHARED_AFTERGLOW_BEATS.length
    || state.sharedDawnChoice !== null
  )) return false;
  if (state.phase === 'shared_afterglow_result' && (
    state.day !== MAX_DAY
    || state.sharedNightChoice !== COALITION_CHOICE_ID
    || state.sharedAfterglowChoices.length < 1
    || state.sharedAfterglowChoices.length > SHARED_AFTERGLOW_BEATS.length
    || state.sharedDawnChoice !== null
    || !currentSharedAfterglowResult(state)
  )) return false;
  if (state.phase === 'shared_dawn' && (
    state.day !== MAX_DAY
    || state.sharedAfterglowChoices.length !== SHARED_AFTERGLOW_BEATS.length
    || !state.unlocked.includes('inner_court_afterglow')
    || state.sharedDawnChoice !== null
  )) return false;
  if (state.phase === 'shared_dawn_result' && (
    state.day !== MAX_DAY
    || state.sharedAfterglowChoices.length !== SHARED_AFTERGLOW_BEATS.length
    || !state.unlocked.includes('inner_court_afterglow')
    || !SHARED_DAWN_CHOICE_IDS.has(state.sharedDawnChoice)
    || !currentSharedDawnResult(state)
  )) return false;
  if (state.phase === 'ending') {
    if (state.day !== MAX_DAY || !state.over || !isRecord(state.ending) || !ENDINGS[state.ending.id]) return false;
    if (state.ending.id === 'alliance') {
      if (![2, 3, 4].includes(state.allianceMembers.length)
        || state.allianceChoices.length !== ALLIANCE_NIGHT_BEATS.length) return false;
    } else if (state.allianceMembers.length || state.allianceChoices.length) return false;
    if (state.ending.id === 'exclusive') {
      if (state.personalFinaleChoices.length !== 3) return false;
    } else if (state.personalFinaleChoices.length) return false;
    if (['intrigue', 'unstable'].includes(state.ending.id)) {
      if (!state.collapseFinale?.choice
        || state.collapseFinale.endingId !== state.ending.id
        || !state.ending.collapseResult
        || state.ending.collapseResult.choice !== state.collapseFinale.choice) return false;
    } else if (state.collapseFinale !== null) return false;
  } else if (state.over || state.ending !== null) return false;
  if (state.fateCoda !== null) {
    if (state.phase !== 'ending'
      || !hasExactKeys(state.fateCoda, ['page', 'choices'])
      || !Number.isInteger(state.fateCoda.page)
      || state.fateCoda.page < 0
      || state.fateCoda.page >= FATE_CODA.pages.length
      || !Array.isArray(state.fateCoda.choices)
      || state.fateCoda.choices.length > FATE_CODA.pages.length - 1
      || state.fateCoda.choices.length < state.fateCoda.page
      || state.fateCoda.choices.length > Math.min(state.fateCoda.page + 1, FATE_CODA.pages.length - 1)) return false;
    for (let index = 0; index < state.fateCoda.choices.length; index += 1) {
      if (!FATE_CODA.pages[index].options.some((choice) => choice.id === state.fateCoda.choices[index])) return false;
    }
    const fateRows = state.history.filter((entry) => entry.type === 'fate_coda');
    if (fateRows.length !== state.fateCoda.choices.length
      || fateRows.some((entry, index) => entry.page !== index || entry.choice !== state.fateCoda.choices[index])) return false;
    if (!currentFateCoda(state)) return false;
  } else if (state.history.some((entry) => entry.type === 'fate_coda')) return false;
  const personalSceneOpen = state.phase === 'scene' && state.sceneReturnPhase === 'after_night';
  if ((['visit', 'route_aftermath', 'night', 'personal_afterglow', 'personal_afterglow_aftermath'].includes(state.phase) || personalSceneOpen) !== HEROINE_IDS.includes(state.currentHeroine)) return false;
  if ((['household', 'household_aftermath'].includes(state.phase)) !== (state.currentHouseholdEvent !== null)) return false;
  if (!validProcessHistory(state)) return false;
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

export const APPROVED_ADULT_IDS = Object.freeze([
  'wu_yueniang', 'pan_jinlian', 'li_pinger', 'meng_yulou', 'sun_xuee',
]);

export function sceneIsAdultSafe(scene) {
  const approved = new Set(APPROVED_ADULT_IDS);
  return !!scene
    && Array.isArray(scene.participants)
    && scene.participants.length > 0
    && scene.participants.every((id) => approved.has(id) && HEROINES[id]?.adult === true);
}
