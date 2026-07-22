// 战斗引擎:纯逻辑,无 DOM。浏览器与 node 自测共用。
// 指令回合制:我方先下完全部指令 → 按速度降序生成行动队列 → 逐个结算 → 回合结束。
// 一切随机走 state.rng(seedRNG),同 seed 同指令 = 同结果。

import { ELEMENTS, ELEMENT_COEF, SKILLS, BASIC_ATTACK, FORMS, PARTY, ENEMIES, FORMATIONS, ITEMS, BATTLES, POINT_GAINS, EQUIPS, TREASURES } from './data.js';
import { createRNG, chance, pick, rfloat } from './rng.js';

// ---------- 五行 ----------
// 返回 [系数, 关系]: 'ke' 我克敌 / 'beike' 敌克我 / 'none'
export function elementRelation(atkEl, defEl) {
  if (!atkEl || !defEl || atkEl === defEl) return 'none';
  if (ELEMENTS[atkEl].beats === defEl) return 'ke';
  if (ELEMENTS[defEl].beats === atkEl) return 'beike';
  return 'none';
}
export function elementCoef(rel) {
  return ELEMENT_COEF[rel] ?? 1;
}

// ---------- 单位生成 ----------
export function unitLevelStats(def, level, alloc = null) {
  const s = {};
  for (const k of ['hp', 'mp', 'atk', 'def', 'spd', 'mag']) {
    s[k] = Math.round(def.base[k] + (def.growth?.[k] ?? 0) * (level - 1));
  }
  // 护栏:alloc 缺省时与旧行为逐字节一致
  if (alloc) {
    for (const [stat, pts] of Object.entries(alloc)) {
      const gains = POINT_GAINS[stat];
      if (!gains || !pts) continue;
      for (const [k, v] of Object.entries(gains)) s[k] += v * pts;
    }
  }
  return s;
}

export function skillsAtLevel(def, level) {
  const out = [];
  for (const lv of Object.keys(def.skills ?? {})) {
    if (Number(lv) <= level) out.push(...def.skills[lv]);
  }
  return out;
}

let uidCounter = 0;
export function makeUnit(defKey, side, level, opts = {}) {
  const def = (side === 'party' ? PARTY : ENEMIES)[defKey];
  if (!def) throw new Error(`未知单位: ${side}/${defKey}`);
  const stats = unitLevelStats(def, level, opts.alloc ?? null);
  // 护栏:装备/法宝均为可选入参,缺省不加
  let critBonus = 0;
  if (opts.equip && EQUIPS[opts.equip]) {
    const eq = EQUIPS[opts.equip];
    for (const [k, v] of Object.entries(eq.mods ?? {})) stats[k] = (stats[k] ?? 0) + v;
    critBonus += eq.crit ?? 0;
  }
  let treasure = null;
  if (opts.treasure && TREASURES[opts.treasure]) {
    treasure = TREASURES[opts.treasure];
    for (const [k, v] of Object.entries(treasure.mods ?? {})) stats[k] = (stats[k] ?? 0) + v;
  }
  const id = opts.id ?? `${side[0]}${uidCounter++}`;
  const unit = {
    id, defKey, side, level,
    name: opts.name ?? def.name,
    portrait: def.portrait,
    isPet: !!def.isPet,
    baseElement: def.element,
    element: def.element,
    big: !!def.big,
    crit: (def.crit ?? 0.05) + critBonus,
    maxHp: stats.hp, hp: stats.hp,
    maxMp: stats.mp, mp: stats.mp,
    atk: stats.atk, def: stats.def, spd: stats.spd, mag: stats.mag,
    skills: skillsAtLevel(def, level),
    skillLevels: opts.skillLevels ?? null,
    resist: treasure?.resist ?? null,
    immuneSpdDown: !!treasure?.immuneSpdDown,
    catchKey: def.catchKey ?? null,
    hasTransform: !!def.hasTransform,
    nextPhase: def.nextPhase ?? null,
    heavyName: def.heavyName ?? null,
    ai: def.ai ?? 'mob',
    buffs: [], defending: false, form: null,
    alive: true, charge: 0, summonCount: 0,
  };
  // 召唤技初始冷却(2):回合末递减,使首次召唤落在第 3 回合
  for (const lv of Object.keys(def.skills ?? {})) {
    for (const sk of def.skills[lv]) {
      if (SKILLS[sk]?.summon) {
        unit.cooldowns = unit.cooldowns ?? {};
        unit.cooldowns[sk] = 2;
      }
    }
  }
  return unit;
}

// ---------- 战斗创建 ----------
export function createBattle({ battleId, party, formation = 'tiangang', items = {}, seed = 1, treasure = null, startDebuff = null } = {}) {
  const opts = { treasure, startDebuff };
  const battleDef = BATTLES[battleId];
  if (!battleDef) throw new Error(`未知战斗: ${battleId}`);
  uidCounter = 0;
  const units = [];
  party.forEach((p, i) => {
    // 护栏:养成字段 undefined 时与旧行为一致
    units.push(makeUnit(p.key, 'party', p.level, {
      id: `p${i}`, alloc: p.alloc, equip: p.equip, treasure: opts.treasure, skillLevels: p.skillLevels,
    }));
  });
  const enemyLevel = battleDef.enemyLevel ?? 1;
  battleDef.enemies.forEach((key, i) => {
    const u = makeUnit(key, 'enemy', enemyLevel, { id: `e${i}` });
    if (battleDef.enemies.filter((k) => k === key).length > 1) {
      const idx = battleDef.enemies.slice(0, i + 1).filter((k) => k === key).length;
      u.name = `${ENEMIES[key].name}·${'甲乙丙丁'[idx - 1]}`;
    }
    units.push(u);
  });
  // 可选:反骗得逞开局(悟空中计)
  if (opts.startDebuff) {
    const t = units.find((u) => u.id === opts.startDebuff.unit) ?? units.find((u) => u.side === 'party');
    if (t) t.buffs.push({ ...opts.startDebuff.buff });
  }
  return {
    battleId, def: battleDef,
    rng: createRNG(seed), seed,
    catchRng: createRNG((seed ^ 0x5eed) >>> 0), // 捕捉独立种子流,与战斗 rng 物理隔离
    caught: [],
    round: 1, units, formation,
    items: { ...items },
    fanStage: 0,
    formationSwitched: false,
    godAssisted: false,
    over: false, winner: null, fled: false,
  };
}

export function aliveUnits(state, side) {
  return state.units.filter((u) => u.side === side && u.alive);
}
export function getUnit(state, id) {
  return state.units.find((u) => u.id === id);
}

// ---------- 有效属性(阵型/增益/变化) ----------
function buffVal(unit, id) {
  return unit.buffs.filter((b) => b.id === id).reduce((a, b) => a + b.val, 0);
}
export function effStat(state, unit, key) {
  let v = unit[key];
  if (unit.side === 'party') {
    const f = FORMATIONS[state.formation];
    if (f?.mods?.[key]) v *= f.mods[key];
  }
  if (unit.form) {
    const fm = FORMS[unit.form.id];
    if (fm?.mods?.[key]) v *= fm.mods[key];
  }
  if (key === 'atk') v *= 1 + buffVal(unit, 'atk_up') - buffVal(unit, 'atk_down');
  if (key === 'def') v *= 1 - buffVal(unit, 'def_down');
  if (key === 'spd') v *= 1 + buffVal(unit, 'spd_up') - (unit.immuneSpdDown ? 0 : buffVal(unit, 'spd_down'));
  if (key === 'mag') v *= 1 + buffVal(unit, 'mag_up');
  return Math.max(1, v);
}

// 行动队列:速度降序;同速我方先、id 小先(完全确定)
export function buildActionQueue(state) {
  return state.units
    .filter((u) => u.alive)
    .map((u) => ({ id: u.id, spd: effStat(state, u, 'spd') }))
    .sort((a, b) => {
      if (b.spd !== a.spd) return b.spd - a.spd;
      const ua = getUnit(state, a.id), ub = getUnit(state, b.id);
      if (ua.side !== ub.side) return ua.side === 'party' ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    })
    .map((e) => e.id);
}

// ---------- 伤害 ----------
export function calcDamage(state, attacker, defender, skill) {
  const rng = state.rng;
  const atkStat = skill.kind === 'mag' ? effStat(state, attacker, 'mag') : effStat(state, attacker, 'atk');
  const defStat = effStat(state, defender, 'def');
  let base = atkStat * skill.mul - defStat * 0.5;
  if (base < 1) base = 1;
  const rel = elementRelation(attacker.element, defender.element);
  let dmg = base * elementCoef(rel);
  const isCrit = chance(rng, attacker.crit + (skill.critBonus ?? 0));
  if (isCrit) dmg *= rfloat(rng, 1.5, 2.0);
  dmg *= rfloat(rng, 0.9, 1.1);
  if (defender.defending) dmg *= 0.5;
  dmg *= 1 - buffVal(defender, 'dmg_reduce');
  dmg *= 1 + buffVal(defender, 'vulnerable'); // 真扇落雨破绽:受伤+40%
  if (rel === 'ke' && defender.buffs.some((b) => b.id === 'ke_shield')) dmg *= 0.5; // 玄甲龟将:被克减半
  const res = defender.resist?.[attacker.element] ?? 0; // 法宝五行抗性(可选入参)
  if (res) dmg *= 1 - res;
  if (defender.side === 'party') {
    const f = FORMATIONS[state.formation];
    if (f?.mods?.dmgTaken) dmg *= f.mods.dmgTaken;
  }
  return { amount: Math.max(1, Math.round(dmg)), crit: isCrit, rel };
}

export function hitChance(state, attacker, skill) {
  const p = (skill.hit ?? 0.95) + buffVal(attacker, 'hit_up');
  return Math.min(1, Math.max(0.05, p));
}

// ---------- 伤害预览 ----------
// 与 calcDamage 同一公式、同一确定修正顺序,但不消耗 state.rng(悬停预览用)。
// 只取浮动区间两端:实际结算的非暴击伤害必落在 [min,max],暴击必落在 [critMin,critMax]。
// test/battle.mjs 据此断言「预览与实际结算一致」。
export function previewDamage(state, attacker, defender, skill) {
  const atkStat = skill.kind === 'mag' ? effStat(state, attacker, 'mag') : effStat(state, attacker, 'atk');
  const defStat = effStat(state, defender, 'def');
  let base = atkStat * skill.mul - defStat * 0.5;
  if (base < 1) base = 1;
  const rel = elementRelation(attacker.element, defender.element);
  const dmg = base * elementCoef(rel);
  // 确定修正,与 calcDamage 逐项对应(防御/减伤/破绽/龟甲/抗性/阵型)
  let m = 1;
  if (defender.defending) m *= 0.5;
  m *= 1 - buffVal(defender, 'dmg_reduce');
  m *= 1 + buffVal(defender, 'vulnerable');
  if (rel === 'ke' && defender.buffs.some((b) => b.id === 'ke_shield')) m *= 0.5;
  const res = defender.resist?.[attacker.element] ?? 0;
  if (res) m *= 1 - res;
  if (defender.side === 'party') {
    const f = FORMATIONS[state.formation];
    if (f?.mods?.dmgTaken) m *= f.mods.dmgTaken;
  }
  const lo = (x) => Math.max(1, Math.floor(x));
  const hi = (x) => Math.max(1, Math.ceil(x));
  return {
    rel,
    coef: elementCoef(rel),
    hit: hitChance(state, attacker, skill),
    min: lo(dmg * 0.9 * m),
    max: hi(dmg * 1.1 * m),
    critMin: lo(dmg * 1.5 * 0.9 * m),
    critMax: hi(dmg * 2.0 * 1.1 * m),
    expected: Math.max(1, Math.round(dmg * m)),
  };
}

// ---------- 指令执行 ----------
function applyBuff(unit, buff) {
  unit.buffs.push({ id: buff.id, val: buff.val ?? 0, turns: buff.turns });
}

function damageTarget(state, events, attacker, target, skill) {
  if (!target.alive) return;
  // 避火符:抵挡一次火系伤害
  if (attacker.element === '火') {
    const wardIdx = target.buffs.findIndex((b) => b.id === 'huo_ward');
    if (wardIdx >= 0) {
      target.buffs.splice(wardIdx, 1);
      events.push({ t: 'ward', actor: attacker.id, target: target.id });
      return;
    }
  }
  if (!chance(state.rng, hitChance(state, attacker, skill))) {
    events.push({ t: 'miss', actor: attacker.id, target: target.id });
    return;
  }
  const { amount, crit, rel } = calcDamage(state, attacker, target, skill);
  target.hp = Math.max(0, target.hp - amount);
  events.push({ t: 'damage', actor: attacker.id, target: target.id, amount, crit, rel, kind: skill.kind });
  // 连击:暴击时 25% 概率追加一次减伤基础攻击
  if (crit && target.hp > 0 && chance(state.rng, 0.25)) {
    const extra = calcDamage(state, attacker, target, BASIC_ATTACK);
    const amt = Math.max(1, Math.round(extra.amount * 0.6));
    target.hp = Math.max(0, target.hp - amt);
    events.push({ t: 'damage', actor: attacker.id, target: target.id, amount: amt, combo: true, rel: extra.rel, kind: 'phy' });
  }
  if (skill.selfHeal && attacker.alive) {
    const heal = Math.round(amount * skill.selfHeal);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    events.push({ t: 'heal', actor: attacker.id, target: attacker.id, amount: heal });
  }
  checkDeath(state, events, target);
}

function checkDeath(state, events, unit) {
  if (unit.alive && unit.hp <= 0) {
    if (unit.nextPhase) {
      // Boss 换阶段:恢复满血、清增益、换皮换属性(继承战斗分级)
      const def = ENEMIES[unit.nextPhase];
      const stats = unitLevelStats(def, unit.level ?? 1);
      unit.defKey = def.key; unit.name = def.name; unit.portrait = def.portrait;
      unit.baseElement = def.element; unit.element = def.element;
      unit.big = !!def.big; unit.crit = def.crit; unit.ai = def.ai;
      unit.maxHp = stats.hp; unit.hp = stats.hp;
      unit.maxMp = stats.mp; unit.mp = stats.mp;
      unit.atk = stats.atk; unit.def = stats.def; unit.spd = stats.spd; unit.mag = stats.mag;
      unit.skills = skillsAtLevel(def, 1);
      unit.nextPhase = def.nextPhase ?? null;
      unit.heavyName = def.heavyName ?? null;
      unit.buffs = []; unit.form = null;
      events.push({ t: 'phase', unit: unit.id, name: unit.name, portrait: unit.portrait, element: unit.element, big: unit.big });
      // 八戒+土地接力:阶段转换时全队回复(数据驱动)
      if (state.def.phaseHeal) {
        for (const a of aliveUnits(state, 'party')) {
          const amount = Math.max(1, Math.round(a.maxHp * state.def.phaseHeal));
          a.hp = Math.min(a.maxHp, a.hp + amount);
          events.push({ t: 'reinforce', target: a.id, amount });
        }
      }
      return;
    }
    unit.alive = false;
    events.push({ t: 'death', unit: unit.id });
  }
}

function targetsFor(state, actor, skill, targetId) {
  const foes = aliveUnits(state, actor.side === 'party' ? 'enemy' : 'party');
  const friends = aliveUnits(state, actor.side);
  switch (skill.target) {
    case 'enemy': {
      let t = targetId ? getUnit(state, targetId) : null;
      if (!t || !t.alive || t.side === actor.side) t = pick(state.rng, foes); // 目标已倒则改打随机活敌
      return [t];
    }
    case 'enemies': return foes;
    case 'ally': {
      let t = targetId ? getUnit(state, targetId) : null;
      if (!t || !t.alive || t.side !== actor.side) t = actor;
      return [t];
    }
    case 'party': return friends;
    case 'self': return [actor];
    default: return [];
  }
}

function execSkill(state, events, actor, skill, targetId, skillKey = null) {
  // 召唤:spawn 新单位入队(数据驱动,不占额外随机)
  if (skill.summon) {
    events.push({ t: 'action', actor: actor.id, name: skill.name, skill: true });
    const level = state.def.enemyLevel ?? 1;
    for (let i = 0; i < skill.summon.count; i++) {
      const nu = makeUnit(skill.summon.key, actor.side, level, { id: `${actor.side[0]}${state.units.length}` });
      state.units.push(nu);
      actor.summonCount = (actor.summonCount ?? 0) + 1;
      events.push({ t: 'summon', actor: actor.id, unit: nu.id, key: skill.summon.key, name: nu.name });
    }
    actor.cooldowns = actor.cooldowns ?? {};
    actor.cooldowns[skillKey ?? skill.name] = skill.cooldown ?? 3;
    return;
  }
  const targets = targetsFor(state, actor, skill, targetId);
  if (targets.length === 0) return;
  events.push({ t: 'action', actor: actor.id, name: skill.name, skill: true });
  if (skill.heal) {
    // 治疗技:灵力加成,无命中/五行
    const amount = Math.max(1, Math.round(effStat(state, actor, 'mag') * skill.heal));
    for (const t of targets) {
      t.hp = Math.min(t.maxHp, t.hp + amount);
      events.push({ t: 'heal', actor: actor.id, target: t.id, amount });
    }
    return;
  }
  if (skill.buff) {
    for (const t of targets) {
      if (skill.buff.chance && !chance(state.rng, skill.buff.chance)) {
        events.push({ t: 'resist', actor: actor.id, target: t.id, buff: skill.buff.id });
        continue;
      }
      applyBuff(t, skill.buff);
      events.push({ t: 'buff', actor: actor.id, target: t.id, buff: skill.buff.id, val: skill.buff.val, turns: skill.buff.turns });
    }
    if (skill.mul > 0) for (const t of targets) damageTarget(state, events, actor, t, skill);
    return;
  }
  for (const t of targets) damageTarget(state, events, actor, t, skill);
}

function execItem(state, events, actor, itemKey, targetId) {
  const item = ITEMS[itemKey];
  if (!item || (state.items[itemKey] ?? 0) <= 0) {
    events.push({ t: 'info', text: 'no_item' });
    return;
  }
  if (item.type === 'heal') {
    const t = targetsFor(state, actor, { target: 'ally' }, targetId)[0];
    const amount = Math.round(t.maxHp * item.val);
    t.hp = Math.min(t.maxHp, t.hp + amount);
    state.items[itemKey] -= 1;
    events.push({ t: 'item', actor: actor.id, item: itemKey, target: t.id });
    events.push({ t: 'heal', actor: actor.id, target: t.id, amount });
  } else if (item.type === 'mp') {
    const t = targetsFor(state, actor, { target: 'ally' }, targetId)[0];
    t.mp = Math.min(t.maxMp, t.mp + item.val);
    state.items[itemKey] -= 1;
    events.push({ t: 'item', actor: actor.id, item: itemKey, target: t.id });
    events.push({ t: 'mp', target: t.id, amount: item.val });
  } else if (item.type === 'buffitem') {
    // 增益物品:醒酒石/避火符等,给友方挂短时增益
    const t = targetsFor(state, actor, { target: 'ally' }, targetId)[0];
    applyBuff(t, item.buff);
    state.items[itemKey] -= 1;
    events.push({ t: 'item', actor: actor.id, item: itemKey, target: t.id });
    events.push({ t: 'buff', actor: actor.id, target: t.id, buff: item.buff.id, val: item.buff.val, turns: item.buff.turns });
  } else if (item.type === 'catch') {
    // 捕妖绳:剧情门控捕捉;判定走独立 catchRng,不插入战斗 rng 序列
    const foes = aliveUnits(state, 'enemy').filter((e) => e.catchKey);
    const t = targetId ? getUnit(state, targetId) : foes[0];
    if (!t || !t.alive || t.side !== 'enemy' || !t.catchKey) {
      events.push({ t: 'info', text: 'catch_none' });
      return;
    }
    if (t.hp / t.maxHp > 0.4) {
      events.push({ t: 'info', text: 'catch_hp', unit: t.id });
      return; // 血气方刚,拒捕不耗绳
    }
    state.items[itemKey] -= 1;
    events.push({ t: 'item', actor: actor.id, item: itemKey, target: t.id });
    if (chance(state.catchRng, 0.65)) {
      t.alive = false;
      state.caught.push(t.catchKey);
      events.push({ t: 'caught', actor: actor.id, target: t.id, key: t.catchKey, name: t.name });
    } else {
      events.push({ t: 'catch_fail', actor: actor.id, target: t.id });
    }
  } else if (item.type === 'fakefan') {
    state.items[itemKey] -= 1;
    events.push({ t: 'item', actor: actor.id, item: itemKey });
    for (const e of aliveUnits(state, 'enemy').filter((u) => u.element === '火')) {
      applyBuff(e, { id: 'atk_up', val: 0.3, turns: 3 });
      events.push({ t: 'buff', actor: actor.id, target: e.id, buff: 'atk_up', val: 0.3, turns: 3 });
    }
    events.push({ t: 'info', text: 'fakefan' });
  } else if (item.type === 'truefan') {
    if (state.fanStage >= 3) { events.push({ t: 'info', text: 'fan_used_up' }); return; }
    state.fanStage += 1;
    state.items[itemKey] -= 1;
    events.push({ t: 'item', actor: actor.id, item: itemKey, stage: state.fanStage });
    if (state.fanStage === 1) {
      // 一息火:清敌方全部增益,敌方全体攻击-30%(无视属性)
      for (const e of aliveUnits(state, 'enemy')) {
        e.buffs = e.buffs.filter((b) => b.id === 'def_down' || b.id === 'stun' || b.id === 'vulnerable');
        applyBuff(e, { id: 'atk_down', val: 0.3, turns: 3 });
        events.push({ t: 'buff', actor: actor.id, target: e.id, buff: 'atk_down', val: 0.3, turns: 3 });
      }
      events.push({ t: 'info', text: 'fan1' });
    } else if (state.fanStage === 2) {
      // 二生风:全队速度+30%
      for (const a of aliveUnits(state, 'party')) {
        applyBuff(a, { id: 'spd_up', val: 0.3, turns: 3 });
        events.push({ t: 'buff', actor: actor.id, target: a.id, buff: 'spd_up', val: 0.3, turns: 3 });
      }
      events.push({ t: 'info', text: 'fan2' });
    } else if (state.fanStage === 3) {
      // 三落雨:全队持续回血;敌方全体破防25%+破绽(受伤+40%),无视属性
      for (const a of aliveUnits(state, 'party')) {
        applyBuff(a, { id: 'regen', val: 0.08, turns: 3 });
        events.push({ t: 'buff', actor: actor.id, target: a.id, buff: 'regen', val: 0.08, turns: 3 });
      }
      for (const e of aliveUnits(state, 'enemy')) {
        applyBuff(e, { id: 'def_down', val: 0.25, turns: 3 });
        events.push({ t: 'buff', actor: actor.id, target: e.id, buff: 'def_down', val: 0.25, turns: 3 });
        applyBuff(e, { id: 'vulnerable', val: 0.4, turns: 3 });
        events.push({ t: 'buff', actor: actor.id, target: e.id, buff: 'vulnerable', val: 0.4, turns: 3 });
      }
      events.push({ t: 'info', text: 'fan3' });
    }
  }
}

// 悟空特技·七十二变(无消耗;玄甲龟将附被克减伤)
function execTransform(state, events, actor, formId) {
  const form = FORMS[formId];
  if (!form || !actor.hasTransform) return;
  // 战斗1教学彩蛋:罗刹女体弱时变化 → 化虫入腹取胜
  const fin = state.def.transformFinisher;
  if (fin) {
    const boss = state.units.find((u) => u.side === 'enemy' && u.alive && u.defKey === fin.bossKey);
    if (boss && boss.hp / boss.maxHp <= fin.hpBelow) {
      actor.form = { id: formId, turns: form.turns };
      actor.element = form.element;
      events.push({ t: 'transform', actor: actor.id, form: formId, name: form.name, element: form.element });
      events.push({ t: 'finisher', actor: actor.id, target: boss.id });
      boss.alive = false;
      events.push({ t: 'death', unit: boss.id });
      // 主将被擒,余众溃散(忠于原著:罗刹女交扇,侍婢不敢再战)
      for (const e of aliveUnits(state, 'enemy')) {
        e.alive = false;
        events.push({ t: 'rout', unit: e.id });
        events.push({ t: 'death', unit: e.id });
      }
      return;
    }
  }
  actor.form = { id: formId, turns: form.turns };
  actor.element = form.element;
  if (form.keShield) applyBuff(actor, { id: 'ke_shield', val: 0.5, turns: form.turns });
  events.push({ t: 'transform', actor: actor.id, form: formId, name: form.name, element: form.element });
}

// 法术熟练:rank≤1 返回原对象(引用相同);否则返回强化副本
export function effectiveSkill(unit, key, raw) {
  const rank = unit.skillLevels?.[key] ?? 1;
  if (rank <= 1) return raw;
  const f = 1 + 0.06 * (rank - 1);
  return { ...raw, mul: (raw.mul ?? 0) * f, heal: raw.heal ? raw.heal * f : raw.heal, mp: Math.max(1, (raw.mp ?? 0) - 2 * (rank - 1)) };
}

// 单位当前可用技能(变化形态替换)
export function unitSkills(unit) {
  if (unit.form) {
    const f = FORMS[unit.form.id];
    if (f && f.skills.length > 0) return f.skills;
  }
  return unit.skills;
}

// ---------- AI(敌方与「自动」指令共用) ----------
export function aiCommand(state, unit) {
  const rng = state.rng;
  const foes = aliveUnits(state, unit.side === 'party' ? 'enemy' : 'party');
  if (foes.length === 0) return { type: 'defend' };
  // BOSS 战中我方「自动」只代打普通攻击(不许一键碾过)
  if (state.def.boss && unit.side === 'party') {
    return { type: 'attack', targetId: pick(rng, foes).id };
  }
  const usable = unitSkills(unit)
    .map((k) => ({ key: k, def: SKILLS[k] }))
    .filter((s) => s.def && s.def.mp <= unit.mp);
  // 敌方单体技锁定当前血量最低的我方
  const lowestHp = (arr) => arr.reduce((a, b) => (a.hp <= b.hp ? a : b));
  // 召唤技:冷却完毕且未达上限、场上有位即召(决定论,不占 rng)
  const summonSkill = usable.find((s) => s.def.summon);
  if (summonSkill) {
    const cd = unit.cooldowns?.[summonSkill.key] ?? 0;
    const used = unit.summonCount ?? 0;
    const maxN = summonSkill.def.summon.maxSummons ?? 99;
    if (cd <= 0 && used < maxN && aliveUnits(state, unit.side).length < 6) {
      return { type: 'skill', skillId: summonSkill.key };
    }
  }
  // 治疗型:友方有重伤(≤55%)即抢救血量最低者
  const healSkill = usable.find((s) => s.def.heal);
  if (healSkill) {
    const friends = aliveUnits(state, unit.side);
    const hurt = friends.filter((f) => f.hp / f.maxHp <= 0.55);
    if (hurt.length > 0) return { type: 'skill', skillId: healSkill.key, targetId: lowestHp(hurt).id };
  }
  // 辅助型:有机会先上增益/减益
  const support = usable.find((s) => s.def.buff && s.def.target === 'party' && !unit.buffs.some((b) => b.id === s.def.buff.id));
  if (support && chance(rng, 0.5)) return { type: 'skill', skillId: support.key };
  // 群体技:活敌≥2 时半概率使用
  const aoe = usable.filter((s) => s.def.target === 'enemies');
  if (aoe.length > 0 && foes.length >= 2 && chance(rng, 0.55)) {
    return { type: 'skill', skillId: pick(rng, aoe).key };
  }
  const single = usable.filter((s) => s.def.target === 'enemy');
  if (single.length > 0 && chance(rng, 0.75)) {
    const s = pick(rng, single);
    const target = unit.side === 'enemy' ? lowestHp(foes) : pick(rng, foes);
    return { type: 'skill', skillId: s.key, targetId: target.id };
  }
  return { type: 'attack', targetId: pick(rng, foes).id };
}

// ---------- 阵型(战斗中免费切换,每回合一次) ----------
export function switchFormation(state, formationId) {
  if (!FORMATIONS[formationId]) return null;
  if (state.formationSwitched) return null;
  if (state.formation === formationId) return null;
  state.formation = formationId;
  state.formationSwitched = true;
  return [{ t: 'formation', formation: formationId }];
}

// ---------- BOSS 蓄力重击 ----------
function execHeavy(state, events, unit) {
  const foes = aliveUnits(state, 'party');
  if (foes.length === 0) return;
  const target = foes.reduce((a, b) => (a.hp <= b.hp ? a : b));
  let amount = Math.round(target.maxHp * 0.6 * rfloat(state.rng, 0.9, 1.1));
  let mitigated = false;
  if (target.defending) { amount = Math.round(amount * 0.5); mitigated = true; }
  const dr = buffVal(target, 'dmg_reduce');
  if (dr > 0) { amount = Math.round(amount * (1 - dr)); mitigated = true; }
  const f = FORMATIONS[state.formation];
  if (f?.mods?.dmgTaken) amount = Math.round(amount * f.mods.dmgTaken);
  amount = Math.max(1, amount);
  target.hp = Math.max(0, target.hp - amount);
  events.push({ t: 'heavy', actor: unit.id, target: target.id, amount, mitigated, name: unit.heavyName ?? '重击' });
  checkDeath(state, events, target);
}

// 执行单个单位的指令
function execCommand(state, events, unit, cmd) {
  if (cmd.type === 'auto') {
    events.push({ t: 'auto', unit: unit.id });
    return execCommand(state, events, unit, aiCommand(state, unit));
  }
  if (cmd.type === 'attack') {
    events.push({ t: 'action', actor: unit.id, name: BASIC_ATTACK.name, skill: false });
    const t = targetsFor(state, unit, BASIC_ATTACK, cmd.targetId)[0];
    if (t) damageTarget(state, events, unit, t, BASIC_ATTACK);
  } else if (cmd.type === 'skill') {
    const raw = SKILLS[cmd.skillId];
    const skill = raw ? effectiveSkill(unit, cmd.skillId, raw) : null;
    if (!skill || !unitSkills(unit).includes(cmd.skillId) || skill.mp > unit.mp) {
      // 非法指令(蓝不够/未习得)回退为普攻
      events.push({ t: 'info', text: 'fallback_attack', unit: unit.id });
      const t = targetsFor(state, unit, BASIC_ATTACK, cmd.targetId)[0];
      if (t) damageTarget(state, events, unit, t, BASIC_ATTACK);
    } else {
      unit.mp -= skill.mp;
      execSkill(state, events, unit, skill, cmd.targetId, cmd.skillId);
    }
  } else if (cmd.type === 'defend') {
    unit.defending = true;
    const mpBack = Math.max(1, Math.round(unit.maxMp * 0.05));
    unit.mp = Math.min(unit.maxMp, unit.mp + mpBack);
    events.push({ t: 'defend', unit: unit.id, mp: mpBack });
  } else if (cmd.type === 'item') {
    execItem(state, events, unit, cmd.itemId, cmd.targetId);
  } else if (cmd.type === 'transform') {
    execTransform(state, events, unit, cmd.formId);
  } else if (cmd.type === 'flee') {
    if (state.def.boss) {
      events.push({ t: 'flee', success: false });
    } else if (chance(state.rng, 0.7)) {
      state.fled = true; state.over = true; state.winner = 'flee';
      events.push({ t: 'flee', success: true });
    } else {
      events.push({ t: 'flee', success: false });
    }
  }
}

// ---------- 回合 ----------
export function executeRound(state, commands) {
  const events = [];
  if (state.over) return events;
  // 补齐:敌方 AI;我方缺指令的按自动
  for (const u of state.units) {
    if (!u.alive) continue;
    if (!commands[u.id]) {
      commands[u.id] = u.side === 'enemy' ? aiCommand(state, u) : { type: 'defend' };
    }
  }
  const queue = buildActionQueue(state);
  events.push({ t: 'round', round: state.round, queue: [...queue] });

  // 剧情桥段(吹飞/赴宴而走等):到回合触发,演出退出,非失败
  if (state.def.storyExit && state.def.storyExit.round === state.round) {
    const lead = aliveUnits(state, 'enemy')[0];
    events.push({ t: state.def.storyExit.kind === 'retreat' ? 'story_retreat' : 'story_blow', actor: lead ? lead.id : null });
    state.over = true;
    state.winner = 'story';
    events.push({ t: 'battle_end', winner: 'story', fled: false });
    state.round += 1;
    return events;
  }

  // 众神围剿(门控):目标 BOSS 血气≤阈值时,支援一次性登场
  if (state.def.godAssist && !state.godAssisted) {
    const ga = state.def.godAssist;
    const boss = state.units.find((u) => u.side === 'enemy' && u.alive && u.defKey === ga.bossKey);
    if (boss && boss.hp / boss.maxHp <= ga.hpBelow) {
      state.godAssisted = true;
      const amount = Math.max(1, Math.round(boss.maxHp * ga.amount));
      boss.hp = Math.max(0, boss.hp - amount);
      events.push({ t: 'god_assist', name: ga.name, target: boss.id, amount });
      if (ga.debuff) {
        applyBuff(boss, ga.debuff);
        events.push({ t: 'buff', actor: null, target: boss.id, buff: ga.debuff.id, val: ga.debuff.val, turns: ga.debuff.turns });
      }
      checkDeath(state, events, boss);
    }
  }

  // BOSS:每 3 回合蓄力预警(仅 BOSS 级;小怪不蓄力,避免同回合多重重击砸向最低血者)
  // 白牛真身每回合狂暴(攻+8% 可叠加)
  if (state.def.boss) {
    for (const boss of aliveUnits(state, 'enemy').filter((u) => u.ai === 'boss')) {
      if (state.round % 3 === 0 && boss.charge <= 0) {
        boss.charge = 2;
        events.push({ t: 'telegraph', unit: boss.id, name: boss.heavyName ?? '重击' });
      }
    }
  }
  for (const u of aliveUnits(state, 'enemy')) {
    if (u.defKey === 'whitebull') {
      applyBuff(u, { id: 'atk_up', val: 0.08, turns: 99 });
      events.push({ t: 'buff', actor: u.id, target: u.id, buff: 'atk_up', val: 0.08, turns: 99 });
    }
  }

  for (const id of queue) {
    if (state.over) break;
    const unit = getUnit(state, id);
    if (!unit || !unit.alive) continue;
    unit.defending = false; // 防御姿态持续到下次行动前
    // 持续回血(落雨)
    const regen = buffVal(unit, 'regen');
    if (regen > 0) {
      const amount = Math.max(1, Math.round(unit.maxHp * regen));
      unit.hp = Math.min(unit.maxHp, unit.hp + amount);
      events.push({ t: 'heal', actor: unit.id, target: unit.id, amount, regen: true });
    }
    // 眩晕
    if (unit.buffs.some((b) => b.id === 'stun')) {
      events.push({ t: 'stun', unit: unit.id });
      continue;
    }
    // BOSS 蓄力:充满后以重击替代本回合行动
    if (unit.side === 'enemy' && unit.charge > 0) {
      unit.charge -= 1;
      if (unit.charge === 0) {
        events.push({ t: 'turn', unit: id });
        execHeavy(state, events, unit);
        if (!state.over) {
          const foes = aliveUnits(state, 'enemy');
          const friends = aliveUnits(state, 'party');
          if (foes.length === 0) { state.over = true; state.winner = 'party'; }
          else if (friends.length === 0) { state.over = true; state.winner = 'enemy'; }
        }
        continue;
      }
    }
    const cmd = commands[id];
    events.push({ t: 'turn', unit: id });
    execCommand(state, events, unit, cmd);
    // 每次行动后判定胜负
    if (!state.over) {
      const foes = aliveUnits(state, 'enemy');
      const friends = aliveUnits(state, 'party');
      if (foes.length === 0) { state.over = true; state.winner = 'party'; }
      else if (friends.length === 0) { state.over = true; state.winner = 'enemy'; }
    }
  }

  // 回合末:增益、变化与技能冷却计时
  for (const u of state.units) {
    if (u.cooldowns) for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1);
    for (const b of u.buffs) b.turns -= 1;
    const expired = u.buffs.filter((b) => b.turns <= 0);
    for (const b of expired) events.push({ t: 'buff_end', unit: u.id, buff: b.id });
    u.buffs = u.buffs.filter((b) => b.turns > 0);
    if (u.form) {
      u.form.turns -= 1;
      if (u.form.turns <= 0) {
        events.push({ t: 'form_end', unit: u.id });
        u.form = null;
        u.element = u.baseElement;
      }
    }
  }
  if (state.over && state.winner) events.push({ t: 'battle_end', winner: state.winner, fled: state.fled });
  state.round += 1;
  state.formationSwitched = false; // 每回合允许免费换阵一次
  return events;
}

// ---------- 胜利升级 ----------
// 每位参战单位升一级,返回升级明细(新技能解锁)
export function levelUpParty(partyLevels) {
  const result = {};
  for (const [key, lv] of Object.entries(partyLevels)) {
    const def = PARTY[key];
    const newLv = lv + 1;
    const before = skillsAtLevel(def, lv);
    const after = skillsAtLevel(def, newLv);
    result[key] = { level: newLv, newSkills: after.filter((s) => !before.includes(s)) };
  }
  return result;
}
