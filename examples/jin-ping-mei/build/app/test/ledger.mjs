#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../js/engine.js';
import {
  HEROINE_IDS, HEROINES, HOUSEHOLD_IDS, DAY_DEFS, DAY_NAMES, DAY_PRESSURE,
  DAY_ACTIONS, OPENING_CHOICES, ACCORD_CHOICES, ACCORD_META, JOINT_ACTIONS,
  PUBLIC_EVENTS, HOUSEHOLD_EVENTS, ROUTE_CHOICES, SHARED_NIGHT_CHOICES,
  SHARED_AFTERGLOW_BEATS, SHARED_DAWN_CHOICES, SCENES, NIGHT_TEXT,
} from '../js/data.js';
import { ASSET_PATHS, CRITICAL_CG_KEYS } from '../js/assets.js';
import { TEXT } from '../js/text.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADULTS = new Set(['wu_yueniang', 'pan_jinlian', 'li_pinger', 'meng_yulou', 'sun_xuee']);
let passed = 0;
let failed = 0;

function section(name) { console.log(`\n== ${name} ==`); }
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  PASS  ${name}`); }
  catch (error) { failed += 1; console.log(`  FAIL  ${name}`); console.error(`        ${error.stack ?? error.message}`); }
}
const ok = (value, message) => assert.ok(value, message);
const eq = (actual, expected, message) => assert.deepEqual(actual, expected, message);

function resolveMorning(state) {
  if (state.phase !== 'morning') return;
  const rows = E.morningOptions(state);
  const option = rows.find((row) => row.id === 'appease' && !row.disabled)
    ?? rows.find((row) => row.id === 'explain' && !row.disabled)
    ?? rows.find((row) => !row.disabled);
  ok(option, `第${state.day}日没有可用晨间选择`);
  assert.equal(E.resolveMorning(state, option.id).ok, true);
}

function settleInterlude(state) {
  if (state.phase === 'joint_result') assert.equal(E.continueJointAction(state).ok, true);
  if (state.phase === 'household') {
    const option = E.householdOptions(state).find((row) => !row.disabled);
    ok(option, `第${state.day}日没有可用娇儿选择`);
    assert.equal(E.resolveHouseholdEvent(state, option.id).ok, true);
  }
  if (state.phase === 'banquet') {
    const event = PUBLIC_EVENTS[state.day];
    const option = E.banquetOptions(state).find((row) => row.effects?.flags?.includes(event.balanceFlag) && !row.disabled)
      ?? E.banquetOptions(state).find((row) => !row.disabled);
    ok(option, `第${state.day}日没有可用公开选择`);
    assert.equal(E.chooseBanquet(state, option.id).ok, true);
    assert.equal(state.phase, 'scene');
    assert.equal(E.closeScene(state).ok, true);
  }
}

function doDay(state) {
  const joint = E.jointActionOptions(state).find((row) => !row.disabled);
  const result = joint ? E.chooseJointAction(state, joint.id) : E.chooseDayAction(state, 'ledger');
  assert.equal(result.ok, true, result.error);
  settleInterlude(state);
}

function doVisit(state, heroineId, firstVisit) {
  assert.equal(E.startVisit(state, heroineId).ok, true);
  const rows = E.visitChoices(state, heroineId);
  const option = firstVisit
    ? rows.find((row) => row.id === ACCORD_CHOICES[heroineId].id)
    : rows.filter((row) => !row.effects?.accord && !row.disabled)
      .sort((a, b) => (b.effects?.rel?.qing ?? 0) - (a.effects?.rel?.qing ?? 0))[0];
  ok(option, `第${state.day}日 ${heroineId} 没有可用路线选择`);
  assert.equal(E.chooseVisit(state, option.id).ok, true);
  assert.equal(E.chooseNight(state, 'talk').ok, true);
}

function balancedToDay20(collect = null) {
  const state = E.newGame(42);
  collect?.(state);
  assert.equal(E.chooseOpening(state, 'opening_open_ledger').ok, true);
  collect?.(state);
  const seen = new Set();
  for (let day = 1; day <= 19; day += 1) {
    resolveMorning(state); collect?.(state);
    assert.equal(state.day, day);
    doDay(state); collect?.(state);
    const heroineId = HEROINE_IDS[(day - 1) % HEROINE_IDS.length];
    doVisit(state, heroineId, !seen.has(heroineId));
    seen.add(heroineId);
    collect?.(state);
  }
  resolveMorning(state); collect?.(state);
  assert.equal(state.day, 20);
  doDay(state); collect?.(state);
  assert.equal(state.phase, 'choose_visit');
  return state;
}

function finishBalanced(state, collect = null) {
  assert.equal(E.startSharedNight(state).ok, true); collect?.(state);
  assert.equal(E.chooseSharedNight(state, E.COALITION_CHOICE_ID).ok, true); collect?.(state);
  assert.equal(state.pendingScene, 'inner_court_accord');
  assert.equal(E.closeScene(state).ok, true); collect?.(state);
  for (const choiceId of ['after_1_names', 'after_2_hear', 'after_3_pact']) {
    assert.equal(E.chooseSharedAfterglow(state, choiceId).ok, true); collect?.(state);
    if (state.phase === 'scene') { assert.equal(E.closeScene(state).ok, true); collect?.(state); }
  }
  assert.equal(E.chooseSharedDawn(state, 'dawn_six_tea').ok, true); collect?.(state);
  assert.equal(state.phase, 'ending');
  return state;
}

function reachPersonalScenes(heroineId) {
  const action = {
    wu_yueniang: 'ledger', pan_jinlian: 'listen', li_pinger: 'ledger',
    meng_yulou: 'office', sun_xuee: 'ledger',
  }[heroineId];
  const state = E.newGame(71);
  assert.equal(E.chooseOpening(state, 'opening_open_ledger').ok, true);
  let accordDone = false;
  for (let guard = 0; guard < 12; guard += 1) {
    resolveMorning(state);
    assert.equal(state.phase, 'day');
    const dayResult = E.chooseDayAction(state, action);
    assert.equal(dayResult.ok, true, dayResult.error);
    settleInterlude(state);
    assert.equal(E.startVisit(state, heroineId).ok, true);
    const choices = E.visitChoices(state, heroineId);
    const routeChoice = !accordDone
      ? choices.find((choice) => choice.id === ACCORD_CHOICES[heroineId].id)
      : choices.filter((choice) => !choice.disabled && !choice.effects?.accord)
        .sort((a, b) => (b.effects?.rel?.qing ?? 0) - (a.effects?.rel?.qing ?? 0))[0];
    ok(routeChoice, `${heroineId} 第${state.day}日没有可用路线选择`);
    assert.equal(E.chooseVisit(state, routeChoice.id).ok, true);
    accordDone ||= !!routeChoice.effects?.accord;
    const nights = E.nightOptions(state);
    const explicit = nights.find((choice) => choice.id === 'explicit');
    const prelude = nights.find((choice) => choice.id === 'prelude');
    let nightChoice = 'talk';
    if (!state.unlocked.includes(`${({ wu_yueniang: 'yue', pan_jinlian: 'pan', li_pinger: 'pinger', meng_yulou: 'meng', sun_xuee: 'xuee' })[heroineId]}_prelude`) && prelude && !prelude.disabled) nightChoice = 'prelude';
    else if (explicit && !explicit.disabled) nightChoice = 'explicit';
    assert.equal(E.chooseNight(state, nightChoice).ok, true);
    if (state.phase === 'scene') {
      const loaded = E.deserialize(E.serialize(state));
      ok(loaded, `${heroineId} 场景中存档必须可续读`);
      const sceneId = loaded.pendingScene;
      assert.equal(E.closeScene(loaded).ok, true);
      if (sceneId.endsWith('_explicit')) return loaded;
      Object.assign(state, loaded);
    }
  }
  throw new Error(`${heroineId} 十二日内未走到明确场景`);
}

function forgedCoalition(day) {
  const state = E.newGame(9);
  state.day = day;
  state.phase = 'choose_visit';
  for (const key of E.ACCORD_KEYS) state.accords[key] = true;
  for (const flag of E.PUBLIC_BALANCE_FLAGS) state.flags[flag] = true;
  state.jointActions = JOINT_ACTIONS.map((row) => row.id);
  state.flags.harem_coalition = true;
  state.sharedNightChoice = E.COALITION_CHOICE_ID;
  state.sharedAfterglowChoices = SHARED_AFTERGLOW_BEATS.map((beat) => beat.choices[0].id);
  state.sharedDawnChoice = SHARED_DAWN_CHOICES[0].id;
  state.unlocked = ['inner_court_accord', 'inner_court_afterglow'];
  state.resources.house = 100;
  for (const id of HEROINE_IDS) state.relations[id] = { qing: 100, yu: 100, du: 0, ignored: 0, reasons: [] };
  return state;
}

function roundTrip(state) { eq(E.deserialize(E.serialize(state)), state); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function directorySize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const target = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? directorySize(target) : fs.statSync(target).size);
  }, 0);
}

section('二十日历与五人身份');
test('日历恰有二十个有编号的压力节点', () => { eq(DAY_DEFS.length, 20); eq(DAY_NAMES.length, 20); eq(DAY_PRESSURE.length, 20); });
test('二十个压力 ID 与规范化正文逐日不同', () => {
  eq(new Set(DAY_DEFS.map((row) => row.id)).size, 20);
  eq(new Set(DAY_PRESSURE.map((text) => text.replace(/\s+/g, ' ').trim())).size, 20);
});
test('dayDef 一至二十日逐项命中', () => {
  for (let day = 1; day <= 20; day += 1) {
    const state = E.newGame(1); state.day = day;
    const actual = E.dayDef(state); const expected = DAY_DEFS[day - 1];
    eq({ day: actual.day, id: actual.id, name: actual.name, pressure: actual.pressure }, { day, id: expected.id, name: expected.name, pressure: expected.pressure });
  }
});
test('完整二十日模拟不出现空标题或压力文案', () => {
  const trace = []; balancedToDay20((state) => trace.push(E.dayDef(state)));
  ok(trace.every((row) => row.id && row.name && row.pressure && row.act));
});
test('第十九夜推进到第二十日而非提前结束', () => { const state = balancedToDay20(); eq(state.day, 20); eq(state.phase, 'choose_visit'); eq(state.over, false); });
test('人物、关系、拜访、越界与冷却映射严格为五人', () => {
  const state = E.newGame(1);
  eq(new Set(HEROINE_IDS), ADULTS);
  for (const key of ['relations', 'visits', 'publicOverrides', 'routeReopensOn']) eq(new Set(Object.keys(state[key])), ADULTS, key);
});
test('五名女主都在数据中明确标记成年', () => { for (const id of HEROINE_IDS) assert.equal(HEROINES[id].adult, true, id); });
test('非女主常驻关系只留下娇儿一名交易角色', () => { eq(HOUSEHOLD_IDS, ['li_jiaoer']); });

section('五条路线与协作结构');
test('每名女主有八拍且每拍两选', () => { for (const id of HEROINE_IDS) { eq(ROUTE_CHOICES[id].length, 8, id); for (const step of ROUTE_CHOICES[id]) eq(step.length, 2, id); } });
test('每一拍至少一个无条件选择', () => { for (const id of HEROINE_IDS) for (const step of ROUTE_CHOICES[id]) ok(step.some((row) => !row.condition), id); });
test('五条路线选择序列互不重复', () => {
  const signatures = HEROINE_IDS.map((id) => JSON.stringify(ROUTE_CHOICES[id].map((step) => step.map((row) => [row.id, row.text, row.effects]))));
  eq(new Set(signatures).size, 5);
});
test('五人各有一项不同的院约', () => { eq(new Set(Object.values(ACCORD_CHOICES).map((row) => row.effects.accord)), new Set(E.ACCORD_KEYS)); eq(E.ACCORD_KEYS.length, 5); });
test('拜访只推进当前人物路线拍号', () => {
  const state = E.newGame(1); E.chooseOpening(state, 'opening_open_ledger'); doDay(state);
  assert.equal(E.startVisit(state, 'meng_yulou').ok, true);
  const option = E.visitChoices(state, 'meng_yulou').find((row) => !row.effects?.accord && !row.disabled);
  E.chooseVisit(state, option.id);
  eq(state.visits.meng_yulou, 1); for (const id of HEROINE_IDS.filter((row) => row !== 'meng_yulou')) eq(state.visits[id], 0, id);
});
test('八拍与院约都完成后路线才算完成', () => {
  for (const id of HEROINE_IDS) {
    const state = E.newGame(1); state.visits[id] = 8;
    eq(E.routeComplete(state, id), false, `${id} 未立约`);
    state.accords[ACCORD_CHOICES[id].effects.accord] = true;
    eq(E.routeComplete(state, id), true, id);
  }
});
test('五名女主均有独立前奏与明确场景', () => {
  for (const id of HEROINE_IDS) eq(new Set(Object.values(SCENES).filter((row) => row.heroine === id).map((row) => row.tier)), new Set(['prelude', 'explicit']), id);
});
for (const heroineId of HEROINE_IDS) {
  test(`${HEROINES[heroineId].name}的前奏与明确场景可由正常选择到达、保存并关闭`, () => {
    const state = reachPersonalScenes(heroineId);
    const prefix = { wu_yueniang: 'yue', pan_jinlian: 'pan', li_pinger: 'pinger', meng_yulou: 'meng', sun_xuee: 'xuee' }[heroineId];
    ok(state.unlocked.includes(`${prefix}_prelude`));
    ok(state.unlocked.includes(`${prefix}_explicit`));
  });
}
test('五项联办覆盖五人且每项参与组合不同', () => {
  eq(JOINT_ACTIONS.length, 5); eq(new Set(JOINT_ACTIONS.map((row) => row.participants.slice().sort().join('|'))).size, 5);
  eq(new Set(JOINT_ACTIONS.flatMap((row) => row.participants)), ADULTS);
});
test('二十日正常策略可取得五约五联办三公议', () => {
  const state = balancedToDay20(); ok(E.sharedNightStatus(state).ready, E.sharedNightStatus(state).reason);
  eq(state.jointActions.length, 5); ok(E.publicPromisesReady(state)); ok(E.ACCORD_KEYS.every((key) => state.accords[key]));
});

section('十九日前不得提前后宫结局');
test('共同邀请在一至十九日始终不可见', () => { for (let day = 1; day <= 19; day += 1) { const state = forgedCoalition(day); eq(E.sharedNightStatus(state).visible, false, `day ${day}`); } });
test('即便伪造全部条件，一至十九日也不能开始共同夜', () => { for (let day = 1; day <= 19; day += 1) { const state = forgedCoalition(day); ok(!E.startSharedNight(state).ok, `day ${day}`); } });
test('即便伪造全部条件，一至十九日也不能判为五院同灯', () => { for (let day = 1; day <= 19; day += 1) { const state = forgedCoalition(day); ok(E.determineEnding(state).id !== 'balanced', `day ${day}`); } });
test('第二十日共同结局仍要求五约', () => { const state = forgedCoalition(20); state.accords.order = false; ok(!E.sharedNightStatus(state).ready); });
test('第二十日共同结局仍要求三次公开共担', () => { const state = forgedCoalition(20); delete state.flags.public_vow_2; ok(!E.sharedNightStatus(state).ready); ok(E.determineEnding(state).id !== 'balanced'); });
test('重复或未知联办 ID 不能凑够五项', () => {
  const state = forgedCoalition(20); state.jointActions = ['joint_yue_pan', 'joint_yue_pan', 'forged_a', 'forged_b', 'forged_c'];
  ok(!E.sharedNightStatus(state).ready); ok(E.determineEnding(state).id !== 'balanced');
});
test('缺少任一人物的联办覆盖不能凑成五院同灯', () => {
  const state = forgedCoalition(20); state.jointActions = JOINT_ACTIONS.filter((row) => !row.participants.includes('sun_xuee')).map((row) => row.id);
  ok(!E.sharedNightStatus(state).ready); ok(E.determineEnding(state).id !== 'balanced');
});
test('非结盟同席选项不会解锁群像亲密册页', () => {
  const state = balancedToDay20(); E.startSharedNight(state); const result = E.chooseSharedNight(state, 'shared_false_only');
  ok(result.ok); eq(state.phase, 'ending'); ok(!state.unlocked.includes('inner_court_accord')); ok(state.ending.id !== 'balanced');
});
test('真实二十日路径走完三拍余夜并达成五院同灯', () => { const state = finishBalanced(balancedToDay20()); eq(state.ending.id, 'balanced'); eq(state.sharedAfterglowChoices.length, 3); eq(state.day, 20); });

section('存档严格校验');
test('当前 schema 往返保持状态', () => roundTrip(E.newGame(7)));
test('可达各阶段存档均可往返', () => {
  const samples = new Map();
  const collect = (state) => { if (!samples.has(state.phase)) samples.set(state.phase, E.snapshot(state)); };
  const state = balancedToDay20(collect); finishBalanced(state, collect);
  for (const phase of ['opening', 'day', 'morning', 'choose_visit', 'shared_night', 'scene', 'shared_afterglow', 'shared_dawn', 'ending']) ok(samples.has(phase), `缺 ${phase}`);
  for (const [phase, sample] of samples) { const loaded = E.deserialize(E.serialize(sample)); ok(loaded, phase); eq(loaded, sample, phase); }
});
test('第一、十九、二十日可达边界存档可往返', () => {
  const samples = new Map();
  balancedToDay20((state) => { if (state.phase === 'day' && [1, 19, 20].includes(state.day)) samples.set(state.day, E.snapshot(state)); });
  eq(new Set(samples.keys()), new Set([1, 19, 20]));
  for (const state of samples.values()) roundTrip(state);
});
test('拒绝零日、二十一日、小数、字符串、空值和 NaN', () => {
  for (const day of [0, 21, 1.5, '2', null, Number.NaN]) { const state = E.newGame(1); state.day = day; eq(E.deserialize(E.serialize(state)), null, String(day)); }
});
test('拒绝一至十一版旧存档', () => { for (let version = 1; version < E.SAVE_VERSION; version += 1) { const state = E.newGame(1); state.version = version; eq(E.deserialize(E.serialize(state)), null, `v${version}`); } });
test('拒绝缺少任一五人映射或联盟字段', () => {
  for (const field of ['relations', 'visits', 'publicOverrides', 'routeReopensOn', 'accords', 'jointActions', 'sharedAfterglowChoices']) { const state = E.newGame(1); delete state[field]; eq(E.deserialize(E.serialize(state)), null, field); }
});
test('拒绝五人映射中的多余、缺失或未知 ID', () => {
  for (const field of ['relations', 'visits', 'publicOverrides', 'routeReopensOn']) {
    const extra = E.newGame(1); extra[field].stranger = field === 'relations' ? { qing: 0, yu: 0, du: 0, ignored: 0, reasons: [] } : 0; eq(E.deserialize(E.serialize(extra)), null, `${field} extra`);
    const missing = E.newGame(1); delete missing[field].sun_xuee; eq(E.deserialize(E.serialize(missing)), null, `${field} missing`);
  }
});
test('拒绝越界或非整数路线、关系与资源值', () => {
  const cases = [
    (s) => { s.visits.wu_yueniang = 8.5; }, (s) => { s.visits.wu_yueniang = 9; },
    (s) => { s.relations.pan_jinlian.qing = 101; }, (s) => { s.relations.li_pinger.du = -1; },
    (s) => { s.resources.house = 101; }, (s) => { s.resources.power = Number.POSITIVE_INFINITY; },
  ];
  for (const mutate of cases) { const state = E.newGame(1); mutate(state); eq(E.deserialize(E.serialize(state)), null); }
});
test('拒绝非公开日的 banquet 阶段', () => { const state = E.newGame(1); state.day = 6; state.phase = 'banquet'; eq(E.deserialize(E.serialize(state)), null); });
test('拒绝个人场景与 currentHeroine 矛盾', () => {
  const state = E.newGame(1); state.phase = 'scene'; state.currentHeroine = 'pan_jinlian'; state.pendingScene = 'yue_prelude'; state.sceneReturnPhase = 'after_night'; eq(E.deserialize(E.serialize(state)), null);
});
test('拒绝无历史伪造的明确成人夜间状态', () => {
  const state = E.newGame(1); state.day = 8; state.phase = 'night'; state.currentHeroine = 'wu_yueniang'; state.selectedDayAction = 'ledger'; state.relations.wu_yueniang.qing = 100; state.accords.order = true;
  eq(E.deserialize(E.serialize(state)), null);
});
test('拒绝无历史伪造的五院同灯结局', () => {
  const state = forgedCoalition(20); state.phase = 'ending'; state.over = true; state.ending = E.determineEnding(state);
  eq(state.ending.id, 'balanced'); eq(E.deserialize(E.serialize(state)), null);
});
test('拒绝缺五约、联办、公议过程的共享次晨', () => {
  const state = forgedCoalition(20); state.phase = 'shared_dawn'; state.sharedDawnChoice = null;
  eq(E.deserialize(E.serialize(state)), null);
});
test('拒绝未知、重复或同时处于已用与未用集合的秘密', () => {
  const unknown = E.newGame(1); unknown.secrets = ['not_a_secret']; eq(E.deserialize(E.serialize(unknown)), null);
  const duplicate = E.newGame(1); duplicate.secrets = ['shop_fraud', 'shop_fraud']; eq(E.deserialize(E.serialize(duplicate)), null);
  const overlap = E.newGame(1); overlap.secrets = ['shop_fraud']; overlap.secretsUsed = ['shop_fraud']; eq(E.deserialize(E.serialize(overlap)), null);
});
test('拒绝没有当日白日动作历史的公开事件存档', () => {
  const state = E.newGame(1); state.day = 5; state.phase = 'banquet'; eq(E.deserialize(E.serialize(state)), null);
});
test('结局存档回读时重建派生展示字段', () => {
  const state = finishBalanced(balancedToDay20()); state.ending = { id: 'balanced', title: '伪造' };
  const loaded = E.deserialize(E.serialize(state)); eq(loaded.ending.id, 'balanced'); ok(loaded.ending.title !== '伪造'); eq(loaded.ending.householdResults.length, 1);
});

section('成年人场景与美术完整性');
test('引擎成年白名单与独立白名单完全一致', () => eq(new Set(E.APPROVED_ADULT_IDS), ADULTS));
test('所有亲密场景参与者非空且全部在独立成年白名单', () => {
  for (const scene of Object.values(SCENES).filter((row) => ['prelude', 'explicit', 'ensemble-intimate'].includes(row.tier))) {
    ok(scene.participants.length > 0, scene.id); ok(scene.participants.every((id) => ADULTS.has(id)), scene.id); ok(E.sceneIsAdultSafe(scene), scene.id);
  }
});
test('个人亲密场景仅包含对应一名女主', () => { for (const scene of Object.values(SCENES).filter((row) => ['prelude', 'explicit'].includes(row.tier))) eq(scene.participants, [scene.heroine], scene.id); });
test('最终成人群像参与者恰为五名成年人', () => { eq(new Set(SCENES.inner_court_afterglow.participants), ADULTS); });
test('亲密场景不含未成年 ID 或禁用称谓', () => {
  const source = JSON.stringify(Object.values(SCENES).filter((row) => ['prelude', 'explicit', 'ensemble-intimate'].includes(row.tier)));
  for (const word of ['guan_ge', 'xiao_ge', '官哥儿', '孝哥儿', '孩童', '未成年']) ok(!source.includes(word), word);
});
test('十五个场景都有唯一美术键', () => { eq(Object.keys(SCENES).length, 15); ok(Object.values(SCENES).every((row) => ASSET_PATHS[row.asset])); eq(new Set(Object.values(SCENES).map((row) => row.asset)).size, 15); });
test('十五个场景解析到十五条不同路径与文件哈希', () => {
  const files = Object.values(SCENES).map((row) => path.join(ROOT, ASSET_PATHS[row.asset]));
  eq(new Set(files).size, 15); ok(files.every((file) => fs.existsSync(file))); eq(new Set(files.map(sha256)).size, 15);
});
test('五张院门人物图 URL 与哈希互不重复', () => {
  const paths = HEROINE_IDS.map((id) => ASSET_PATHS[HEROINES[id].portrait]); const files = paths.map((value) => path.join(ROOT, value));
  eq(new Set(paths).size, 5); eq(new Set(files.map(sha256)).size, 5);
});
test('全部关键视觉文件存在且不是占位小图', () => { for (const key of CRITICAL_CG_KEYS) { const file = path.join(ROOT, ASSET_PATHS[key]); ok(fs.existsSync(file), key); ok(fs.statSync(file).size > 100000, `${key}: ${fs.statSync(file).size}`); } });
test('运行包体保持低于二十五 MB', () => ok(directorySize(ROOT) < 25 * 1024 * 1024, `${directorySize(ROOT)} bytes`));

section('声口与完整路径');
test('二十日追踪没有缺日、重日或重复压力', () => {
  const days = [];
  const state = E.newGame(42); E.chooseOpening(state, 'opening_open_ledger');
  const seen = new Set();
  for (let day = 1; day <= 19; day += 1) { days.push(E.dayDef(state)); resolveMorning(state); doDay(state); const id = HEROINE_IDS[(day - 1) % 5]; doVisit(state, id, !seen.has(id)); seen.add(id); }
  resolveMorning(state); days.push(E.dayDef(state)); doDay(state);
  eq(days.map((row) => row.day), Array.from({ length: 20 }, (_, i) => i + 1)); eq(new Set(days.map((row) => row.id)).size, 20); eq(new Set(days.map((row) => row.pressure)).size, 20);
});
test('所有主按钮不超过十个汉字', () => {
  const labels = [
    ...OPENING_CHOICES.map((row) => row.label), ...Object.values(DAY_ACTIONS).map((row) => row.label),
    ...Object.values(ROUTE_CHOICES).flat(2).map((row) => row.label), ...Object.values(ACCORD_CHOICES).map((row) => row.label),
    ...JOINT_ACTIONS.map((row) => row.label), ...Object.values(PUBLIC_EVENTS).flatMap((row) => row.choices.map((choice) => choice.label)),
    ...SHARED_NIGHT_CHOICES.map((row) => row.label), ...SHARED_AFTERGLOW_BEATS.flatMap((row) => row.choices.map((choice) => choice.label)),
    ...SHARED_DAWN_CHOICES.map((row) => row.label), ...Object.values(NIGHT_TEXT).map((row) => row.label),
  ];
  for (const label of labels) ok([...label].length <= 10, label);
});
test('运行时文案不命中典型说明书腔与廉价 AI 腔', () => {
  const source = JSON.stringify({ TEXT, HEROINES, DAY_DEFS, ROUTE_CHOICES, ACCORD_CHOICES, JOINT_ACTIONS, PUBLIC_EVENTS, HOUSEHOLD_EVENTS, SHARED_NIGHT_CHOICES, SHARED_AFTERGLOW_BEATS, SHARED_DAWN_CHOICES, SCENES });
  for (const pattern of [/并非.{0,20}而是/, /不是.{0,20}而是/, /真正的.{0,20}从来不是/, /这一刻你终于明白/, /这意味着/, /眼中闪过/, /嘴角勾起/, /带着一丝/, /宛若/]) ok(!pattern.test(source), pattern);
});
test('五人声口各自留下稳定词域', () => {
  ok(HEROINES.wu_yueniang.voice.includes('账')); ok(HEROINES.pan_jinlian.voice.includes('敢'));
  ok(HEROINES.li_pinger.voice.includes('钥匙')); ok(HEROINES.meng_yulou.voice.includes('回礼')); ok(HEROINES.sun_xuee.voice.includes('柴'));
});
test('二十日结局状态重开后回到第一日开场且五人映射清空', () => {
  const ended = finishBalanced(balancedToDay20()); eq(ended.ending.id, 'balanced');
  const reset = E.newGame(42); eq(reset.day, 1); eq(reset.phase, 'opening'); eq(reset.over, false); eq(reset.visits, Object.fromEntries(HEROINE_IDS.map((id) => [id, 0]))); eq(reset.jointActions, []);
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if (failed) process.exit(1);
