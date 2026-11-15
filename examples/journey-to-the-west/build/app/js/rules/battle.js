// 回合制战斗规则：纯逻辑，浏览器与 Node 自测共用。
// 每回合：beginRound（回合开始的剧情与态势）→ 玩家下令 → resolveRound（按速度逐个结算）。
// 所有随机取自 state.rng，同种子同指令得同结果。

import {
  BEATS, ELEMENT_COEF, SKILLS, BASIC_ATTACK, STUNTS, SP, FORMS, PARTY, ENEMIES,
  FORMATIONS, ITEMS, EQUIPS, TREASURES, BATTLES, POINT_GAINS, STORY_SETUP,
} from '../data/combat.js';
import { createRNG, chance, rfloat, pick } from '../core/rng.js';

const STAT_KEYS = ['hp', 'mp', 'atk', 'def', 'spd', 'mag'];

// ---------- 五行 ----------
export function relation(attackEl, defendEl) {
  if (!attackEl || !defendEl || attackEl === defendEl) return 'none';
  if (BEATS[attackEl] === defendEl) return 'ke';
  if (BEATS[defendEl] === attackEl) return 'beike';
  return 'none';
}

// ---------- 单位 ----------
export function statsAt(def, level, alloc = null) {
  const s = {};
  for (const k of STAT_KEYS) s[k] = Math.round(def.base[k] + (def.growth?.[k] ?? 0) * (level - 1));
  for (const [stat, pts] of Object.entries(alloc ?? {})) {
    for (const [k, v] of Object.entries(POINT_GAINS[stat] ?? {})) s[k] += v * pts;
  }
  return s;
}

export function learnedSkills(def, level) {
  if (Array.isArray(def.skills)) return [...def.skills];
  return Object.keys(def.skills ?? {}).filter((lv) => Number(lv) <= level).flatMap((lv) => def.skills[lv]);
}

function makeUnit(id, side, key, level, opts = {}) {
  const def = (side === 'party' ? PARTY : ENEMIES)[key];
  if (!def) throw new Error(`未知单位 ${side}/${key}`);
  const stats = statsAt(def, level, opts.alloc);
  let crit = def.crit ?? 0.05;
  for (const eqKey of opts.equip ?? []) {
    const eq = EQUIPS[eqKey];
    if (!eq) continue;
    for (const [k, v] of Object.entries(eq.mods ?? {})) stats[k] += v;
    crit += eq.crit ?? 0;
  }
  const treasure = side === 'party' ? TREASURES[opts.treasure] : null;
  for (const [k, v] of Object.entries(treasure?.mods ?? {})) stats[k] += v;
  const skills = learnedSkills(def, level);
  const cooldowns = {};
  for (const sk of skills) if (SKILLS[sk]?.summon) cooldowns[sk] = 2; // 首次召唤落在第三回合
  return {
    id, side, key, level, name: opts.name ?? def.name, art: def.art,
    isPet: !!def.isPet, big: !!def.big, small: !!def.small,
    baseElement: def.element, element: def.element,
    crit, maxHp: stats.hp, hp: stats.hp, maxMp: stats.mp, mp: stats.mp,
    atk: stats.atk, def: stats.def, spd: stats.spd, mag: stats.mag,
    skills, skillLevels: opts.skillLevels ?? {},
    resist: treasure?.resist ?? null, immuneSpdDown: !!treasure?.immuneSpdDown,
    catchKey: def.catchKey ?? null, hasTransform: !!def.hasTransform,
    nextPhase: def.nextPhase ?? null, heavyName: def.heavyName ?? null, ai: def.ai ?? 'mob',
    buffs: [], defending: false, form: null, sp: 0, alive: true,
    charging: false, summoned: 0, cooldowns, slot: opts.slot ?? 0,
  };
}

export function createBattle({ battleId, party, formation = 'tiangang', items = {}, seed = 1, treasure = null, setup = {}, enemyLevel = null }) {
  const def = BATTLES[battleId];
  if (!def) throw new Error(`未知战斗 ${battleId}`);
  const level = enemyLevel ?? def.level ?? 1;
  const units = party.map((p, i) => makeUnit(`p${i}`, 'party', p.key, p.level, { ...p, treasure, slot: i }));
  def.enemies.forEach((key, i) => {
    const same = def.enemies.filter((k) => k === key).length;
    const nth = def.enemies.slice(0, i + 1).filter((k) => k === key).length;
    // 同名的几个用短名加甲乙，窄屏名牌也放得下（「芭蕉洞侍婢·甲」会被截成「芭蕉洞侍婢…」）
    const name = same > 1 ? `${ENEMIES[key].short ?? ENEMIES[key].name}·${'甲乙丙丁'[nth - 1]}` : undefined;
    units.push(makeUnit(`e${i}`, 'enemy', key, level, { name, slot: i }));
  });
  for (const [kind, choice] of Object.entries(setup)) {
    const fx = STORY_SETUP[kind]?.[choice];
    if (!fx || fx.battle !== battleId) continue;
    for (const u of units) {
      if (u.side !== fx.side) continue;
      if (fx.unit && u.key !== fx.unit) continue;
      if (fx.element && u.element !== fx.element) continue;
      u.buffs.push({ ...fx.buff });
    }
  }
  return {
    battleId, def, level, seed, rng: createRNG(seed), catchRng: createRNG((seed ^ 0x5eed) >>> 0),
    round: 1, units, formation, formationSwitched: false, items: { ...items },
    fanStage: 0, fakeFanUsed: false, assisted: false, caught: [], protect: {},
    over: false, winner: null, trackSnap: false,
  };
}

export const unitById = (state, id) => state.units.find((u) => u.id === id);
export const alive = (state, side) => state.units.filter((u) => u.side === side && u.alive);
const foesOf = (state, unit) => alive(state, unit.side === 'party' ? 'enemy' : 'party');
const buffSum = (unit, id) => unit.buffs.reduce((sum, b) => (b.id === id ? sum + b.val : sum), 0);
const hasBuff = (unit, id) => unit.buffs.some((b) => b.id === id);

export function effStat(state, unit, key) {
  let v = unit[key];
  if (unit.side === 'party') v *= FORMATIONS[state.formation]?.mods?.[key] ?? 1;
  if (unit.form) v *= FORMS[unit.form.id]?.mods?.[key] ?? 1;
  if (key === 'atk') v *= 1 + buffSum(unit, 'atk_up') + buffSum(unit, 'enrage') - buffSum(unit, 'atk_down');
  if (key === 'def') v *= 1 + buffSum(unit, 'def_up') - buffSum(unit, 'def_down');
  if (key === 'spd') v *= 1 + buffSum(unit, 'spd_up') - (unit.immuneSpdDown ? 0 : buffSum(unit, 'spd_down'));
  return Math.max(1, v);
}

// 行动顺序：速度高者先；同速我方先，再按入场次序
export function actionQueue(state) {
  return state.units.filter((u) => u.alive)
    .map((u) => ({ u, spd: effStat(state, u, 'spd') }))
    .sort((a, b) => b.spd - a.spd || (a.u.side !== b.u.side ? (a.u.side === 'party' ? -1 : 1) : (a.u.id < b.u.id ? -1 : 1)))
    .map((e) => e.u.id);
}

// 法术修炼：每重威力 +6%、耗法 −2
export function skillOf(unit, id) {
  const raw = SKILLS[id] ?? STUNTS[id];
  if (!raw) return null;
  const rank = unit.skillLevels?.[id] ?? 1;
  if (rank <= 1 || STUNTS[id]) return raw;
  const f = 1 + 0.06 * (rank - 1);
  return { ...raw, mul: (raw.mul ?? 0) * f, heal: raw.heal ? raw.heal * f : raw.heal, mp: Math.max(1, (raw.mp ?? 0) - 2 * (rank - 1)) };
}

export function usableSkills(unit) {
  const formSkills = unit.form ? FORMS[unit.form.id].skills : [];
  return formSkills.length ? formSkills : unit.skills;
}

function guardReduce(state, defender) {
  const f = state.def.field;
  if (defender.side !== 'enemy' || f?.kind !== 'guard') return 0;
  return alive(state, 'enemy').filter((u) => u.key === f.unit).length >= f.count ? f.reduce : 0;
}
export const fieldGuardActive = (state) => guardReduce(state, { side: 'enemy' }) > 0;

// 确定性的伤害修正（预览与结算共用）
function damageBase(state, attacker, defender, skill) {
  const atk = effStat(state, attacker, skill.kind === 'mag' ? 'mag' : 'atk');
  const base = Math.max(1, atk * skill.mul - effStat(state, defender, 'def') * 0.5);
  const rel = relation(attacker.element, defender.element);
  let m = ELEMENT_COEF[rel];
  if (defender.defending) m *= 0.5;
  m *= 1 - Math.min(0.8, buffSum(defender, 'dmg_reduce'));
  m *= 1 - guardReduce(state, defender);
  m *= 1 + buffSum(defender, 'vulnerable');
  if (rel === 'ke' && hasBuff(defender, 'ke_shield')) m *= 0.5;
  m *= 1 - (defender.resist?.[attacker.element] ?? 0);
  if (defender.side === 'party') m *= FORMATIONS[state.formation]?.mods?.dmgTaken ?? 1;
  return { value: base * m, rel };
}

export function hitChance(attacker, skill) {
  return Math.min(1, Math.max(0.05, (skill.hit ?? 0.95) + buffSum(attacker, 'hit_up')));
}

// 不消耗随机数的预览：非暴击伤害必落在 [min, max]
export function previewDamage(state, attacker, defender, skill) {
  const { value, rel } = damageBase(state, attacker, defender, skill);
  return {
    rel, coef: ELEMENT_COEF[rel], hit: hitChance(attacker, skill),
    min: Math.max(1, Math.floor(value * 0.9)), max: Math.max(1, Math.ceil(value * 1.1)),
  };
}

// ---------- 结算 ----------
function rollDamage(state, attacker, defender, skill) {
  const { value, rel } = damageBase(state, attacker, defender, skill);
  const crit = chance(state.rng, attacker.crit + (skill.critBonus ?? 0));
  let dmg = value * (crit ? rfloat(state.rng, 1.5, 2.0) : 1);
  dmg *= rfloat(state.rng, 0.9, 1.1);
  return { amount: Math.max(1, Math.round(dmg)), crit, rel };
}

function gainSp(unit, amount) {
  if (unit.side !== 'party' || amount <= 0) return;
  unit.sp = Math.min(SP.max, unit.sp + Math.max(SP.minGain, Math.round((amount / unit.maxHp) * 100 * SP.gainPerHpPct)));
}

function protectorOf(state, target) {
  const g = unitById(state, state.protect[target.id]);
  return g && g.alive && g.id !== target.id ? g : null;
}

function addBuff(unit, buff) {
  unit.buffs.push({ id: buff.id, val: buff.val ?? 0, turns: buff.turns });
}

function checkDeath(state, ev, unit) {
  if (!unit.alive || unit.hp > 0) return;
  if (unit.nextPhase) {
    const def = ENEMIES[unit.nextPhase];
    const stats = statsAt(def, def.phaseLevel ?? unit.level);
    Object.assign(unit, {
      key: def.key, name: def.name, art: def.art, baseElement: def.element, element: def.element,
      big: !!def.big, crit: def.crit, maxHp: stats.hp, hp: stats.hp, atk: stats.atk, def: stats.def,
      spd: stats.spd, mag: stats.mag, skills: learnedSkills(def, unit.level), nextPhase: def.nextPhase ?? null,
      heavyName: def.heavyName ?? null, buffs: [], form: null, charging: false, chargeTarget: null,
    });
    ev.push({ t: 'phase', unit: unit.id, name: unit.name, art: unit.art, element: unit.element });
    if (state.def.phaseHeal) {
      // 土地接力：一个独立事件，演出时土地真的上场，再给在场的人逐个回血（倒下的人不回来）
      const heals = [];
      for (const a of alive(state, 'party')) {
        const amount = Math.max(1, Math.round(a.maxHp * state.def.phaseHeal));
        a.hp = Math.min(a.maxHp, a.hp + amount);
        heals.push({ target: a.id, amount });
      }
      ev.push({ t: 'relief', name: '土地', art: 'tudi', pct: state.def.phaseHeal, heals });
    }
    return;
  }
  const guardWas = fieldGuardActive(state);
  unit.alive = false;
  unit.charging = false;
  ev.push({ t: 'death', unit: unit.id });
  if (guardWas && !fieldGuardActive(state)) ev.push({ t: 'field_break', name: state.def.field.name });
  // 决战以「降伏白牛真身」为胜：主将伏地，余众当场溃散，不再要玩家清场
  const win = state.def.winOn;
  if (win && unit.side === 'enemy' && unit.key === win.key) {
    const rest = alive(state, 'enemy');
    ev.push({ t: 'rout', unit: unit.id, title: win.title, sub: win.sub });
    for (const e of rest) { e.alive = false; e.charging = false; ev.push({ t: 'death', unit: e.id, rout: true }); }
  }
}

function strike(state, ev, attacker, target, skill) {
  if (!target?.alive) return;
  if (attacker.element === '火') {
    const i = target.buffs.findIndex((b) => b.id === 'huo_ward');
    if (i >= 0) {
      target.buffs.splice(i, 1);
      ev.push({ t: 'ward', actor: attacker.id, target: target.id });
      return;
    }
  }
  if (!chance(state.rng, hitChance(attacker, skill))) {
    ev.push({ t: 'miss', actor: attacker.id, target: target.id });
    return;
  }
  const { amount: raw, crit, rel } = rollDamage(state, attacker, target, skill);
  const base = { actor: attacker.id, crit, rel, kind: skill.kind, fx: skill.fx, attackEl: attacker.element, targetEl: target.element };
  const guard = skill.target === 'enemy' && skill.kind === 'phy' ? protectorOf(state, target) : null;
  if (guard) {
    const amount = Math.max(1, Math.round(raw * 0.7));
    guard.hp = Math.max(0, guard.hp - amount);
    gainSp(guard, amount);
    ev.push({ t: 'damage', ...base, target: guard.id, amount, protectFor: target.id });
    checkDeath(state, ev, guard);
    return;
  }
  target.hp = Math.max(0, target.hp - raw);
  gainSp(target, raw);
  ev.push({ t: 'damage', ...base, target: target.id, amount: raw });
  if (crit && target.hp > 0 && chance(state.rng, 0.25)) {
    const extra = Math.max(1, Math.round(rollDamage(state, attacker, target, BASIC_ATTACK).amount * 0.6));
    target.hp = Math.max(0, target.hp - extra);
    ev.push({ t: 'damage', ...base, crit: false, target: target.id, amount: extra, combo: true });
  }
  holdFinisher(state, ev, target);
  if (skill.selfHeal && attacker.alive) {
    const heal = Math.round(raw * skill.selfHeal);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    ev.push({ t: 'heal', target: attacker.id, amount: heal });
  }
  checkDeath(state, ev, target);
}

function targetsFor(state, actor, skill, targetId) {
  const foes = foesOf(state, actor);
  const friends = alive(state, actor.side);
  const wanted = unitById(state, targetId);
  switch (skill.target) {
    case 'enemy': {
      const t = wanted?.alive && wanted.side !== actor.side ? wanted : foes[0];
      return t ? [t] : [];
    }
    case 'enemies': return foes;
    case 'ally': return [wanted?.alive && wanted.side === actor.side ? wanted : actor];
    case 'party': return friends;
    case 'self': return [actor];
    default: return [];
  }
}

function castSkill(state, ev, actor, skill, targetId, skillId) {
  if (skill.summon) {
    const nu = makeUnit(`${actor.side[0]}${state.units.length}`, actor.side, skill.summon.key, state.level);
    const vacated = state.units.find((u) => u.side === actor.side && !u.alive && !u.replaced);
    if (vacated) { vacated.replaced = true; nu.slot = vacated.slot; } else nu.slot = state.units.filter((u) => u.side === actor.side).length;
    state.units.push(nu);
    actor.summoned += 1;
    actor.cooldowns[skillId] = skill.cooldown ?? 3;
    ev.push({ t: 'action', actor: actor.id, name: skill.name, fx: skill.fx, targets: [] });
    ev.push({ t: 'summon', actor: actor.id, unit: nu.id });
    return;
  }
  const targets = targetsFor(state, actor, skill, targetId);
  if (!targets.length) return;
  ev.push({ t: 'action', actor: actor.id, name: skill.name, fx: skill.fx, kind: skill.kind, area: skill.target, targets: targets.map((t) => t.id) });
  if (skill.heal || skill.healPct) {
    for (const t of targets) {
      const amount = Math.max(1, Math.round(skill.healPct ? t.maxHp * skill.healPct : effStat(state, actor, 'mag') * skill.heal));
      t.hp = Math.min(t.maxHp, t.hp + amount);
      ev.push({ t: 'heal', target: t.id, amount });
    }
    return;
  }
  if (skill.buff) {
    for (const t of targets) {
      if (skill.buff.chance && !chance(state.rng, skill.buff.chance)) { ev.push({ t: 'resist', target: t.id, buff: skill.buff.id }); continue; }
      if (skill.buff.id === 'spd_down' && t.immuneSpdDown) { ev.push({ t: 'immune', target: t.id, buff: 'spd_down' }); continue; }
      addBuff(t, skill.buff);
      ev.push({ t: 'buff', target: t.id, buff: skill.buff.id, val: skill.buff.val, turns: skill.buff.turns });
    }
  }
  if (skill.mul > 0) for (const t of targets) strike(state, ev, actor, t, skill);
}

function basicAttack(state, ev, unit, targetId) {
  const t = targetsFor(state, unit, BASIC_ATTACK, targetId)[0];
  if (!t) return;
  ev.push({ t: 'action', actor: unit.id, name: BASIC_ATTACK.name, fx: BASIC_ATTACK.fx, kind: 'phy', area: 'enemy', targets: [t.id], basic: true });
  strike(state, ev, unit, t, BASIC_ATTACK);
}

function useItem(state, ev, actor, itemId, targetId) {
  const item = ITEMS[itemId];
  if (!item || !(state.items[itemId] > 0)) { ev.push({ t: 'info', text: 'no_item', unit: actor.id }); return; }
  const spend = () => { state.items[itemId] -= 1; };
  const ally = () => targetsFor(state, actor, { target: 'ally' }, targetId)[0];
  if (item.type === 'revive') {
    const t = unitById(state, targetId) ?? state.units.find((u) => u.side === actor.side && !u.alive && !u.caught);
    if (!t || t.alive || t.side !== actor.side) { ev.push({ t: 'info', text: 'revive_none', unit: actor.id }); return; }
    spend();
    t.alive = true; t.hp = Math.max(1, Math.round(t.maxHp * item.val)); t.buffs = [];
    ev.push({ t: 'item', actor: actor.id, item: itemId, target: t.id });
    ev.push({ t: 'revive', target: t.id, amount: t.hp });
  } else if (item.type === 'heal') {
    const t = ally(); spend();
    const amount = Math.round(t.maxHp * item.val);
    t.hp = Math.min(t.maxHp, t.hp + amount);
    ev.push({ t: 'item', actor: actor.id, item: itemId, target: t.id });
    ev.push({ t: 'heal', target: t.id, amount });
  } else if (item.type === 'mp') {
    const t = ally(); spend();
    const amount = Math.min(item.val, t.maxMp - t.mp);
    t.mp += amount;
    ev.push({ t: 'item', actor: actor.id, item: itemId, target: t.id });
    ev.push({ t: 'mp', target: t.id, amount });
  } else if (item.type === 'buff') {
    const t = ally(); spend();
    addBuff(t, item.buff);
    ev.push({ t: 'item', actor: actor.id, item: itemId, target: t.id });
    ev.push({ t: 'buff', target: t.id, buff: item.buff.id, val: item.buff.val, turns: item.buff.turns });
  } else if (item.type === 'catch') {
    const t = unitById(state, targetId);
    if (!t?.alive || t.side !== 'enemy' || !t.catchKey) { ev.push({ t: 'info', text: 'catch_none', unit: actor.id }); return; }
    if (t.hp / t.maxHp > 0.4) { ev.push({ t: 'info', text: 'catch_hp', unit: t.id }); return; }
    spend();
    ev.push({ t: 'item', actor: actor.id, item: itemId, target: t.id });
    if (chance(state.catchRng, 0.65)) {
      t.alive = false; t.caught = true;
      state.caught.push(t.catchKey);
      ev.push({ t: 'caught', target: t.id, key: t.catchKey });
    } else ev.push({ t: 'catch_fail', target: t.id });
  } else if (item.type === 'fakefan') {
    spend();
    state.fakeFanUsed = true;
    ev.push({ t: 'item', actor: actor.id, item: itemId });
    ev.push({ t: 'fan', stage: 0 });
    for (const e of alive(state, 'enemy').filter((u) => u.element === '火')) {
      addBuff(e, { id: 'atk_up', val: 0.3, turns: 3 });
      ev.push({ t: 'buff', target: e.id, buff: 'atk_up', val: 0.3, turns: 3 });
    }
  } else if (item.type === 'truefan') {
    if (state.fanStage >= 3) { ev.push({ t: 'info', text: 'fan_done', unit: actor.id }); return; }
    spend();
    state.fanStage += 1;
    ev.push({ t: 'item', actor: actor.id, item: itemId });
    ev.push({ t: 'fan', stage: state.fanStage });
    const each = (side, buff) => {
      for (const u of alive(state, side)) { addBuff(u, buff); ev.push({ t: 'buff', target: u.id, ...{ buff: buff.id, val: buff.val, turns: buff.turns } }); }
    };
    if (state.fanStage === 1) {
      for (const e of alive(state, 'enemy')) e.buffs = e.buffs.filter((b) => ['def_down', 'stun', 'vulnerable', 'atk_down', 'spd_down'].includes(b.id));
      each('enemy', { id: 'atk_down', val: 0.3, turns: 3 });
    } else if (state.fanStage === 2) {
      each('party', { id: 'spd_up', val: 0.3, turns: 3 });
    } else {
      each('party', { id: 'regen', val: 0.08, turns: 3 });
      each('enemy', { id: 'def_down', val: 0.25, turns: 3 });
      each('enemy', { id: 'vulnerable', val: 0.6, turns: 3 });
    }
  }
}

function transform(state, ev, actor, formId) {
  const form = FORMS[formId];
  if (!form || !actor.hasTransform) return;
  actor.buffs = actor.buffs.filter((b) => b.id !== 'ke_shield');
  actor.form = { id: formId, turns: form.turns };
  actor.element = form.element;
  if (form.keShield) addBuff(actor, { id: 'ke_shield', val: 0.5, turns: form.turns });
  ev.push({ t: 'transform', actor: actor.id, form: formId, name: form.name, element: form.element });
  const fin = state.def.finisher;
  const boss = fin && alive(state, 'enemy').find((u) => u.key === fin.boss);
  if (boss && finisherOpen(state)) {
    state.finished = true;
    ev.push({ t: 'finisher', actor: actor.id, target: boss.id });
    for (const e of alive(state, 'enemy')) { e.alive = false; ev.push({ t: 'death', unit: e.id, rout: e.id !== boss.id }); }
  }
}

// 化虫窗口至少留一次下令：这回合下令时她还没露疲态，就打不穿护身的那一线（停在 holdAt），
// 下回合玩家一定能看见「疲态·可智取」再决定变化还是硬打
function holdFinisher(state, ev, target) {
  const fin = state.def.finisher;
  if (!fin || state.finished || state.finisherArmed || target.side !== 'enemy' || target.key !== fin.boss) return;
  const floor = Math.ceil(target.maxHp * (fin.holdAt ?? 0.3));
  if (target.hp >= floor) return;
  target.hp = floor;
  if (state.finisherHeld !== state.round) { state.finisherHeld = state.round; ev.push({ t: 'finisher_hold', unit: target.id }); }
}

// 化虫入腹的窗口：罗刹女气血不高于阈值
export function finisherOpen(state) {
  const fin = state.def.finisher;
  if (!fin) return false;
  const boss = alive(state, 'enemy').find((u) => u.key === fin.boss);
  return !!boss && boss.hp / boss.maxHp <= fin.hpBelow;
}

// 决战里真扇还一扇未出：该在每次下令时点明真扇在哪。已有人这回合领了扇，就不再提醒别人
export function fanPrompt(state, queued = []) {
  if (!state.def.boss || state.over || state.fanStage > 0 || !(state.items.truefan > 0)) return false;
  return !queued.some((c) => c?.type === 'item' && c.itemId === 'truefan');
}

function heavyStrike(state, ev, boss) {
  const marked = heavyTarget(state, boss);
  boss.chargeTarget = null;
  if (!marked) return;
  const guard = protectorOf(state, marked);
  const target = guard ?? marked;
  let amount = marked.maxHp * 0.6 * rfloat(state.rng, 0.9, 1.1);
  if (guard) amount *= 0.7;
  if (target.defending) amount *= 0.5;
  amount *= 1 - Math.min(0.8, buffSum(target, 'dmg_reduce'));
  amount *= FORMATIONS[state.formation]?.mods?.dmgTaken ?? 1;
  amount = Math.max(1, Math.round(amount));
  target.hp = Math.max(0, target.hp - amount);
  gainSp(target, amount);
  ev.push({ t: 'action', actor: boss.id, name: boss.heavyName ?? '重击', fx: 'heavy', kind: 'phy', area: 'enemy', targets: [target.id], heavy: true });
  ev.push({ t: 'damage', actor: boss.id, target: target.id, amount, heavy: true, rel: 'none', kind: 'phy', fx: 'heavy', protectFor: guard ? marked.id : undefined, softened: target.defending || buffSum(target, 'dmg_reduce') > 0 });
  checkDeath(state, ev, target);
}

// 蓄力重击：预警亮起时锁定当时气血最少的伙伴，出手时仍砸向他（补血、防御、保护都算数）；
// 被锁定者先倒下了，才改落当时气血最少的人
const lowestParty = (state) => {
  const list = alive(state, 'party');
  return list.length ? list.reduce((a, b) => (a.hp <= b.hp ? a : b)) : null;
};
export function heavyTarget(state, boss = chargingBoss(state)) {
  const locked = boss?.chargeTarget ? unitById(state, boss.chargeTarget) : null;
  return locked?.alive && locked.side === 'party' ? locked : lowestParty(state);
}
export const chargingBoss = (state) => alive(state, 'enemy').find((u) => u.charging) ?? null;

// ---------- AI（敌方与「自动」共用） ----------
function enemyPick(unit, foes) {
  const score = (f) => (relation(f.element, unit.element) === 'ke' ? 4 : 0)
    + (f.buffs.some((b) => b.id === 'dmg_reduce' || b.id === 'hit_up') ? 2 : 0)
    + (relation(unit.element, f.element) === 'ke' ? 1 : 0);
  return foes.reduce((best, f) => (score(f) > score(best) || (score(f) === score(best) && f.hp < best.hp) ? f : best));
}

export function aiCommand(state, unit) {
  const rng = state.rng;
  const foes = foesOf(state, unit);
  if (!foes.length) return { type: 'defend' };
  // 我方「自动」随手挑一个对手，不替玩家读五行与集火
  const target = () => (unit.side === 'enemy' ? enemyPick(unit, foes) : pick(rng, foes));
  if (state.def.boss && unit.side === 'party') return { type: 'attack', targetId: target().id };
  const usable = usableSkills(unit).map((id) => ({ id, s: skillOf(unit, id) })).filter((x) => x.s && x.s.mp <= unit.mp);
  const summon = usable.find((x) => x.s.summon);
  if (summon && (unit.cooldowns[summon.id] ?? 0) <= 0 && unit.summoned < (summon.s.summon.max ?? 9) && alive(state, unit.side).length < 5) {
    return { type: 'skill', skillId: summon.id };
  }
  const heal = usable.find((x) => x.s.heal);
  if (heal) {
    const hurt = alive(state, unit.side).filter((f) => f.hp / f.maxHp <= 0.55);
    if (hurt.length) return { type: 'skill', skillId: heal.id, targetId: hurt.reduce((a, b) => (a.hp <= b.hp ? a : b)).id };
  }
  const support = usable.find((x) => x.s.buff && (x.s.target === 'party' || x.s.target === 'self') && !x.s.mul && !hasBuff(unit, x.s.buff.id));
  if (support && chance(rng, 0.5)) return { type: 'skill', skillId: support.id };
  const aoe = usable.filter((x) => x.s.target === 'enemies' && x.s.mul > 0);
  if (aoe.length && foes.length >= 2 && chance(rng, 0.55)) return { type: 'skill', skillId: pick(rng, aoe).id };
  const single = usable.filter((x) => x.s.target === 'enemy');
  if (single.length && chance(rng, 0.75)) return { type: 'skill', skillId: pick(rng, single).id, targetId: target().id };
  return { type: 'attack', targetId: target().id };
}

// ---------- 阵型：每回合可免费换一次 ----------
export function switchFormation(state, formationId) {
  if (!FORMATIONS[formationId] || state.formationSwitched || state.formation === formationId) return false;
  state.formation = formationId;
  state.formationSwitched = true;
  return true;
}

// ---------- 回合 ----------
function snapshot(state) {
  const snap = {};
  for (const u of state.units) {
    snap[u.id] = {
      hp: u.hp, maxHp: u.maxHp, mp: u.mp, maxMp: u.maxMp, sp: u.sp, alive: u.alive, element: u.element, name: u.name, art: u.art,
      form: u.form?.id ?? null, defending: u.defending, charging: u.charging, big: u.big,
      buffs: u.buffs.map((b) => ({ id: b.id, turns: b.turns, val: b.val })),
    };
  }
  return snap;
}

function recorder(state) {
  const ev = [];
  if (state.trackSnap) {
    const push = ev.push.bind(ev);
    ev.push = (...items) => { const snap = snapshot(state); for (const e of items) e.snap = snap; return push(...items); };
  }
  return ev;
}

function settle(state) {
  if (state.over) return true;
  if (!alive(state, 'enemy').length) { state.over = true; state.winner = 'party'; }
  else if (!alive(state, 'party').length) { state.over = true; state.winner = 'enemy'; }
  return state.over;
}

// 回合开始：剧情退场、众神围剿、白牛狂暴。返回的事件先于玩家下令播放。
export function beginRound(state) {
  const ev = recorder(state);
  if (state.over) return ev;
  state.formationSwitched = false;
  const exit = state.def.storyExit;
  if (exit && exit.round === state.round) {
    state.over = true; state.winner = 'story';
    ev.push({ t: 'story_exit', kind: exit.kind, actor: alive(state, 'enemy')[0]?.id ?? null });
    ev.push({ t: 'end', winner: 'story' });
    return ev;
  }
  const as = state.def.assist;
  if (as && !state.assisted) {
    const boss = alive(state, 'enemy').find((u) => u.key === as.boss);
    if (boss && boss.hp / boss.maxHp <= as.hpBelow) {
      state.assisted = true;
      const amount = Math.max(1, Math.round(boss.maxHp * as.amount));
      boss.hp = Math.max(1, boss.hp - amount);
      addBuff(boss, as.debuff);
      ev.push({ t: 'assist', name: as.name, art: as.art, target: boss.id, amount });
      ev.push({ t: 'buff', target: boss.id, buff: as.debuff.id, val: as.debuff.val, turns: as.debuff.turns });
    }
  }
  if (state.def.enrage) {
    for (const u of alive(state, 'enemy').filter((e) => e.key === 'whitebull')) {
      addBuff(u, { id: 'enrage', val: state.def.enrage, turns: 99 });
      ev.push({ t: 'buff', target: u.id, buff: 'enrage', val: state.def.enrage, turns: 99, stacks: u.buffs.filter((b) => b.id === 'enrage').length });
    }
  }
  ev.push({ t: 'round', round: state.round, queue: actionQueue(state) });
  return ev;
}

function runCommand(state, ev, unit, cmd) {
  if (cmd.type === 'auto') cmd = aiCommand(state, unit);
  switch (cmd.type) {
    case 'attack': basicAttack(state, ev, unit, cmd.targetId); break;
    case 'skill': {
      const skill = skillOf(unit, cmd.skillId);
      if (!skill || !usableSkills(unit).includes(cmd.skillId) || skill.mp > unit.mp) {
        ev.push({ t: 'info', text: 'fallback', unit: unit.id });
        basicAttack(state, ev, unit, cmd.targetId);
      } else {
        unit.mp -= skill.mp;
        castSkill(state, ev, unit, skill, cmd.targetId, cmd.skillId);
      }
      break;
    }
    case 'stunt': {
      const st = STUNTS[cmd.stuntId];
      if (!st || unit.sp < st.sp) { ev.push({ t: 'info', text: 'fallback', unit: unit.id }); basicAttack(state, ev, unit, cmd.targetId); break; }
      unit.sp -= st.sp;
      castSkill(state, ev, unit, st, cmd.targetId, cmd.stuntId);
      break;
    }
    case 'defend': {
      const mp = Math.min(unit.maxMp - unit.mp, Math.max(1, Math.round(unit.maxMp * 0.1)));
      unit.mp += mp;
      ev.push({ t: 'defend', unit: unit.id, mp });
      break;
    }
    case 'protect': {
      const t = unitById(state, cmd.targetId);
      if (t?.alive && t.id !== unit.id) ev.push({ t: 'protect', unit: unit.id, target: t.id });
      break;
    }
    case 'item': useItem(state, ev, unit, cmd.itemId, cmd.targetId); break;
    case 'transform': transform(state, ev, unit, cmd.formId); break;
    case 'flee': {
      const ok = !state.def.boss && chance(state.rng, 0.7);
      if (ok) {
        // 脱身时没带走的火妖挣脱，绳子退回
        state.items.buyaosheng = (state.items.buyaosheng ?? 0) + state.caught.length;
        state.caught = [];
        state.over = true; state.winner = 'flee';
      }
      ev.push({ t: 'flee', unit: unit.id, ok });
      break;
    }
    default: break;
  }
}

export function resolveRound(state, commands) {
  const ev = recorder(state);
  if (state.over) return ev;
  const cmds = { ...commands };
  state.finisherArmed = finisherOpen(state); // 玩家下令时窗口开着没有
  for (const u of state.units) {
    if (!u.alive || cmds[u.id]) continue;
    cmds[u.id] = u.side === 'enemy' ? aiCommand(state, u) : { type: 'defend' };
  }
  // 防御与保护从下令起整回合有效，不看出手先后：比对手慢的人也防得住这一回合的重击
  state.protect = {};
  for (const u of state.units) u.defending = u.alive && cmds[u.id]?.type === 'defend';
  for (const u of alive(state, 'party')) {
    const c = cmds[u.id];
    if (c?.type === 'protect' && c.targetId && c.targetId !== u.id) state.protect[c.targetId] = u.id;
  }
  for (const id of actionQueue(state)) {
    if (state.over) break;
    const unit = unitById(state, id);
    if (!unit?.alive) continue;
    const regen = buffSum(unit, 'regen');
    if (regen > 0 && unit.hp < unit.maxHp) {
      const amount = Math.min(unit.maxHp - unit.hp, Math.max(1, Math.round(unit.maxHp * regen)));
      unit.hp += amount;
      ev.push({ t: 'heal', target: unit.id, amount, regen: true });
    }
    if (hasBuff(unit, 'stun')) { ev.push({ t: 'stunned', unit: unit.id }); continue; }
    ev.push({ t: 'turn', unit: id });
    if (unit.charging) { unit.charging = false; heavyStrike(state, ev, unit); } else runCommand(state, ev, unit, cmds[id]);
    settle(state);
  }
  // 回合末：计时、地火、下一回合的蓄力预警
  for (const u of state.units) {
    u.defending = false;
    for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1);
    for (const b of u.buffs) b.turns -= 1;
    u.buffs = u.buffs.filter((b) => b.turns > 0);
    if (u.form && (u.form.turns -= 1) <= 0) {
      u.form = null; u.element = u.baseElement;
      if (u.alive) ev.push({ t: 'form_end', unit: u.id });
    }
  }
  const field = state.def.field;
  if (!state.over && field?.kind === 'burn') {
    for (const u of alive(state, 'party')) {
      if (u.element === field.immune) continue;
      const amount = Math.max(1, Math.round(u.maxHp * field.pct * (1 - (u.resist?.[field.element] ?? 0))));
      u.hp = Math.max(0, u.hp - amount);
      ev.push({ t: 'burn', target: u.id, amount });
      checkDeath(state, ev, u);
    }
    settle(state);
  }
  if (!state.over && state.def.boss && state.round % 3 === 0) {
    for (const boss of alive(state, 'enemy').filter((u) => u.ai === 'boss' && !u.charging)) {
      boss.charging = true;
      boss.chargeTarget = lowestParty(state)?.id ?? null;
      ev.push({ t: 'telegraph', unit: boss.id, name: boss.heavyName ?? '重击', target: boss.chargeTarget });
    }
  }
  if (state.over) ev.push({ t: 'end', winner: state.winner });
  state.round += 1;
  return ev;
}
