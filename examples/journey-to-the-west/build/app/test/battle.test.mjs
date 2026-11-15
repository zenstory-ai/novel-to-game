// 战斗规则回归：五行、指令、真假扇、Boss 机制，以及「对症打法能赢、无脑打法不行」的对照。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle, beginRound, resolveRound, alive, unitById, relation, previewDamage, skillOf, usableSkills,
  finisherOpen, heavyTarget, chargingBoss, switchFormation, fieldGuardActive, effStat, fanPrompt,
} from '../js/rules/battle.js';
import { SKILLS, BASIC_ATTACK, FORMS, BATTLES, ENEMIES, PARTY } from '../js/data/combat.js';
import { COACH } from '../js/data/story.js';
import { newCampaign, battleParty, battleItems, storyLevelUp, recommendPoints, recommendSkills, addPet, TEAM } from '../js/rules/campaign.js';

const ORDER = ['luosha1', 'luosha', 'firemobs', 'yumian', 'niu1', 'niumowang'];

// 走到某一战时的队伍：按剧情等级、推荐加点
function partyAt(battleId, { pet = battleId === 'niumowang' } = {}) {
  const c = newCampaign(1);
  for (let i = 0; i < ORDER.indexOf(battleId); i += 1) storyLevelUp(c);
  if (pet) { addPet(c, 'pixie', { activate: true }); c.levels.pixie = c.levels.wukong; }
  for (const k of [...TEAM, ...c.pets.map((p) => p.key)]) { recommendPoints(c, k); recommendSkills(c, k); }
  c.treasure = 'dingfengdan';
  c.items = { jinchuang: 2, falidan: 1, buyaosheng: 2 };
  return c;
}
function battle(battleId, seed = 7, extra = {}) {
  const c = partyAt(battleId, extra);
  return createBattle({ battleId, party: battleParty(c), formation: extra.formation ?? c.formation, items: { ...battleItems(c, battleId), ...(extra.items ?? {}) }, seed, treasure: extra.treasure ?? c.treasure, setup: extra.setup ?? {} });
}
const byKey = (st, key) => st.units.find((u) => u.key === key);
const round = (st, cmds = {}) => [...beginRound(st), ...(st.over ? [] : resolveRound(st, cmds))];
const defendAll = (st) => Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'defend' }]));

// 读得懂五行、会用变化与真扇的打法
function smart(st) {
  const cmds = {};
  const foes = alive(st, 'enemy');
  const marked = chargingBoss(st) ? heavyTarget(st) : null;
  let fanned = false;
  const best = (u, pred) => usableSkills(u).filter((id) => skillOf(u, id).mp <= u.mp && pred(skillOf(u, id))).sort((a, b) => skillOf(u, b).mul - skillOf(u, a).mul)[0];
  for (const u of alive(st, 'party')) {
    if (marked?.id === u.id) { cmds[u.id] = { type: 'defend' }; continue; }
    if (u.hp / u.maxHp < 0.4 && st.items.jinchuang > 0) { cmds[u.id] = { type: 'item', itemId: 'jinchuang', targetId: u.id }; continue; }
    if (u.key === 'wukong' && st.battleId === 'luosha' && finisherOpen(st)) { cmds[u.id] = { type: 'transform', formId: 'chongzi' }; continue; }
    if (u.key === 'wukong' && st.battleId === 'firemobs' && !u.form) { cmds[u.id] = { type: 'transform', formId: 'xuangui' }; continue; }
    if (st.battleId === 'niumowang' && u.key === 'sha' && !fanned && st.fanStage < 3) {
      const bull = foes.some((f) => f.key === 'whitebull');
      if ((st.fanStage === 0 && st.round >= 2) || (st.fanStage >= 1 && bull)) { cmds[u.id] = { type: 'item', itemId: 'truefan' }; fanned = true; continue; }
    }
    const prefer = { luosha: 'luosha', firemobs: 'firemob2', yumian: 'yaojiang' }[st.battleId];
    const t = foes.find((f) => f.key === prefer) ?? foes.find((f) => f.ai === 'boss') ?? foes.find((f) => relation(u.element, f.element) === 'ke') ?? foes[0];
    const single = best(u, (s) => s.target === 'enemy' && s.mul > 0);
    cmds[u.id] = single ? { type: 'skill', skillId: single, targetId: t.id } : { type: 'attack', targetId: t.id };
  }
  return cmds;
}
const autoAll = (st) => Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'auto' }]));
const basicOnly = (st) => Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: alive(st, 'enemy')[0].id }]));
function play(battleId, policy, seed, extra) {
  const st = battle(battleId, seed, extra);
  for (let i = 0; i < 60 && !st.over; i += 1) { beginRound(st); if (!st.over) resolveRound(st, policy(st)); }
  return st;
}

test('五行相克：金克木、木克土、土克水、水克火、火克金', () => {
  assert.equal(relation('金', '木'), 'ke');
  assert.equal(relation('木', '金'), 'beike');
  assert.equal(relation('火', '金'), 'ke');
  assert.equal(relation('金', '水'), 'none');
  assert.equal(relation('土', '土'), 'none');
});

test('同种子、同指令，事件序列逐条相同', () => {
  const run = () => { const st = battle('yumian', 99); const log = []; for (let i = 0; i < 4 && !st.over; i += 1) log.push(...round(st, smart(st))); return JSON.stringify(log); };
  assert.equal(run(), run());
});

test('预览区间包住实际的非暴击伤害，相克系数写对', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const st = battle('luosha', seed);
    const wukong = byKey(st, 'wukong'), boss = byKey(st, 'luosha');
    const pv = previewDamage(st, wukong, boss, skillOf(wukong, 'ruyibang'));
    assert.equal(pv.rel, 'ke');
    assert.equal(pv.coef, 1.5);
    beginRound(st);
    const ev = resolveRound(st, { [wukong.id]: { type: 'skill', skillId: 'ruyibang', targetId: boss.id } });
    const hit = ev.find((e) => e.t === 'damage' && e.actor === wukong.id && !e.combo);
    if (hit && !hit.crit) assert.ok(hit.amount >= pv.min && hit.amount <= pv.max, `seed ${seed}: ${hit.amount} 不在 ${pv.min}–${pv.max}`);
  }
});

test('防御：受伤减半并回一成法力；法力不够的法术退回普攻', () => {
  const st = battle('luosha', 3);
  const sha = byKey(st, 'sha');
  sha.mp = 5;
  beginRound(st);
  const ev = resolveRound(st, { [sha.id]: { type: 'defend' }, [byKey(st, 'bajie').id]: { type: 'skill', skillId: 'jiuchipaba' } });
  assert.equal(ev.find((e) => e.t === 'defend' && e.unit === sha.id).mp, Math.round(sha.maxMp * 0.1));
  // 防御从下令起整回合有效：这一回合打向沙僧的伤害都按减半算
  const st3 = battle('niu1', 3);
  const sha3 = byKey(st3, 'sha');
  const open = previewDamage(st3, byKey(st3, 'niumowang'), sha3, SKILLS.tiegun).max;
  beginRound(st3);
  const ev3 = resolveRound(st3, { [sha3.id]: { type: 'defend' } });
  for (const hit of ev3.filter((e) => e.t === 'damage' && e.target === sha3.id && !e.crit)) assert.ok(hit.amount <= Math.ceil(open * 0.5) + 1, `防御中受击 ${hit.amount}，不设防上限 ${open}`);
  assert.equal(sha3.defending, false, '回合结束后解除防御');
  const st2 = battle('luosha', 3);
  const w = byKey(st2, 'wukong'); w.mp = 0;
  beginRound(st2);
  const ev2 = resolveRound(st2, { [w.id]: { type: 'skill', skillId: 'ruyibang', targetId: 'e0' } });
  assert.ok(ev2.some((e) => e.t === 'info' && e.text === 'fallback'));
  assert.ok(ev2.some((e) => e.t === 'action' && e.actor === w.id && e.basic));
});

test('保护：替伙伴挡下单体物理攻击，自己受七成', () => {
  let seen = false;
  for (let seed = 1; seed <= 40 && !seen; seed += 1) {
    const st = battle('niu1', seed);
    const [w, b, s] = ['wukong', 'bajie', 'sha'].map((k) => byKey(st, k));
    beginRound(st);
    const ev = resolveRound(st, { [s.id]: { type: 'protect', targetId: w.id }, [b.id]: { type: 'protect', targetId: w.id }, [w.id]: { type: 'defend' } });
    const guarded = ev.find((e) => e.t === 'damage' && e.protectFor === w.id);
    if (guarded) { seen = true; assert.notEqual(guarded.target, w.id); }
  }
  assert.ok(seen, '四十个种子里应当至少挡下一次');
});

test('阵型：每回合只能免费换一次，下一回合恢复', () => {
  const st = battle('yumian');
  beginRound(st);
  assert.equal(switchFormation(st, 'liuding'), true);
  assert.equal(switchFormation(st, 'tiangang'), false);
  resolveRound(st, defendAll(st));
  beginRound(st);
  assert.equal(switchFormation(st, 'tiangang'), true);
});

test('一借第三回合被扇飞，二借气血过半仍不能智取、四成半以下可以', () => {
  const st = battle('luosha1');
  round(st, defendAll(st)); round(st, defendAll(st));
  const ev = beginRound(st);
  assert.equal(st.winner, 'story');
  assert.equal(ev[0].t, 'story_exit');
  assert.equal(ev[0].kind, 'blow');

  const high = battle('luosha');
  const boss = byKey(high, 'luosha');
  boss.hp = Math.ceil(boss.maxHp * 0.5);
  assert.equal(finisherOpen(high), false);
  round(high, { [byKey(high, 'wukong').id]: { type: 'transform', formId: 'chongzi' } });
  assert.notEqual(high.winner, 'party');

  const low = battle('luosha');
  byKey(low, 'luosha').hp = Math.floor(byKey(low, 'luosha').maxHp * 0.45);
  assert.equal(finisherOpen(low), true);
  const ev2 = round(low, { [byKey(low, 'wukong').id]: { type: 'transform', formId: 'chongzi' }, ...Object.fromEntries(['bajie', 'sha'].map((k) => [byKey(low, k).id, { type: 'defend' }])) });
  assert.ok(ev2.some((e) => e.t === 'finisher'));
  assert.equal(low.winner, 'party');
  assert.equal(low.finished, true);
});

test('地火：回合末灼伤不属水的伙伴，玄甲龟将免疫，避火锦减轻', () => {
  const st = battle('firemobs', 5);
  const w = byKey(st, 'wukong');
  const ev = round(st, { [w.id]: { type: 'transform', formId: 'xuangui' }, ...Object.fromEntries(['bajie', 'sha'].map((k) => [byKey(st, k).id, { type: 'defend' }])) });
  const burns = ev.filter((e) => e.t === 'burn');
  assert.ok(burns.length >= 1);
  assert.ok(!burns.some((b) => b.target === w.id), '化身为水不受地火');
  const plain = burns.find((b) => b.target === byKey(st, 'sha').id).amount;
  const st2 = battle('firemobs', 5, { treasure: 'bihuojin' });
  const ev2 = round(st2, defendAll(st2));
  const eased = ev2.find((e) => e.t === 'burn' && e.target === byKey(st2, 'sha').id).amount;
  assert.ok(eased < plain, `${eased} 应小于 ${plain}`);
});

test('妖将结阵：两名妖将同在时敌方少受伤，折其一即破', () => {
  const st = battle('yumian');
  assert.equal(fieldGuardActive(st), true);
  const w = byKey(st, 'wukong'), boss = byKey(st, 'yumian');
  const guarded = previewDamage(st, w, boss, SKILLS.ruyibang).max;
  const guard = st.units.find((u) => u.key === 'yaojiang');
  guard.hp = 1;
  const ev = round(st, { [w.id]: { type: 'attack', targetId: guard.id } });
  if (!guard.alive) {
    assert.ok(ev.some((e) => e.t === 'field_break'));
    assert.equal(fieldGuardActive(st), false);
    assert.ok(previewDamage(st, w, boss, SKILLS.ruyibang).max > guarded * 0.99);
  }
});

test('捕妖绳：四成气血以上捆不住且不耗绳；脱身时未带走的火妖挣脱、退回绳子', () => {
  const st = battle('firemobs', 11);
  const sha = byKey(st, 'sha');
  const mob = st.units.find((u) => u.key === 'firemob1');
  beginRound(st);
  let ev = resolveRound(st, { [sha.id]: { type: 'item', itemId: 'buyaosheng', targetId: mob.id } });
  assert.ok(ev.some((e) => e.t === 'info' && e.text === 'catch_hp'));
  assert.equal(st.items.buyaosheng, 2);
  let caught = false;
  for (let seed = 1; seed <= 30 && !caught; seed += 1) {
    const s2 = battle('firemobs', seed);
    const m2 = s2.units.find((u) => u.key === 'firemob1');
    m2.hp = Math.floor(m2.maxHp * 0.3);
    beginRound(s2);
    ev = resolveRound(s2, { [byKey(s2, 'wukong').id]: { type: 'item', itemId: 'buyaosheng', targetId: m2.id }, [byKey(s2, 'bajie').id]: { type: 'defend' }, [byKey(s2, 'sha').id]: { type: 'defend' } });
    if (ev.some((e) => e.t === 'caught')) {
      caught = true;
      assert.deepEqual(s2.caught, ['huobao']);
      assert.equal(s2.items.buyaosheng, 1);
      for (let i = 0; i < 30 && !s2.over; i += 1) { beginRound(s2); resolveRound(s2, { [alive(s2, 'party')[0].id]: { type: 'flee' } }); }
      if (s2.winner === 'flee') { assert.deepEqual(s2.caught, []); assert.equal(s2.items.buyaosheng, 2); }
    }
  }
  assert.ok(caught, '三十个种子里应当至少收服一次');
});

test('假扇助火；真扇三段须依次扇出，第一扇清敌方增益但留下我方打上的破防', () => {
  const st = battle('firemobs', 2, { items: { fakefan: 1 } });
  const ev = round(st, { [byKey(st, 'sha').id]: { type: 'item', itemId: 'fakefan' } });
  assert.ok(ev.some((e) => e.t === 'fan' && e.stage === 0));
  assert.equal(st.fakeFanUsed, true);
  for (const e of alive(st, 'enemy').filter((u) => u.element === '火')) assert.ok(e.buffs.some((b) => b.id === 'atk_up'));

  const fin = battle('niumowang', 4);
  const boss = byKey(fin, 'niumowang');
  const sha = byKey(fin, 'sha');
  boss.buffs.push({ id: 'atk_up', val: 0.3, turns: 9 }, { id: 'def_down', val: 0.35, turns: 9 });
  let e1 = round(fin, { ...defendAll(fin), [sha.id]: { type: 'item', itemId: 'truefan' } });
  assert.equal(fin.fanStage, 1);
  assert.ok(e1.some((e) => e.t === 'fan' && e.stage === 1));
  assert.ok(!boss.buffs.some((b) => b.id === 'atk_up'));
  assert.ok(boss.buffs.some((b) => b.id === 'def_down'));
  assert.ok(boss.buffs.some((b) => b.id === 'atk_down'));
  round(fin, { ...defendAll(fin), [sha.id]: { type: 'item', itemId: 'truefan' } });
  assert.equal(fin.fanStage, 2);
  assert.ok(byKey(fin, 'wukong').buffs.some((b) => b.id === 'spd_up') || !byKey(fin, 'wukong').alive);
  round(fin, { ...defendAll(fin), [sha.id]: { type: 'item', itemId: 'truefan' } });
  assert.equal(fin.fanStage, 3);
  assert.equal(fin.items.truefan, 0);
  const e4 = round(fin, { ...defendAll(fin), [sha.id]: { type: 'item', itemId: 'truefan' } });
  assert.ok(e4.some((e) => e.t === 'info' && e.text === 'no_item'));
});

test('决战：牛魔王打空即现白牛真身（转土、满血、全队回三成），白牛每回合叠狂暴，半血时哪吒助阵一次', () => {
  const st = battle('niumowang', 6);
  const boss = byKey(st, 'niumowang');
  const w = byKey(st, 'wukong');
  for (const u of alive(st, 'party')) u.hp = Math.round(u.maxHp * 0.5);
  boss.hp = 1;
  const before = byKey(st, 'sha').hp;
  const ev = round(st, Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: boss.id }])));
  const bull = unitById(st, boss.id);
  if (ev.some((e) => e.t === 'phase')) {
    assert.equal(bull.key, 'whitebull');
    assert.equal(bull.element, '土');
    const relief = ev.find((e) => e.t === 'relief');
    assert.ok(relief, '白牛现形时有独立的土地接力事件（界面据此让土地上场）');
    assert.equal(relief.art, 'tudi');
    assert.deepEqual(relief.heals.map((x) => x.target).sort(), alive(st, 'party').map((u) => u.id).sort(), '只给在场的人回血');
    assert.ok(ev.indexOf(relief) > ev.findIndex((e) => e.t === 'phase'), '接力在现形之后演');
    assert.ok(byKey(st, 'sha').hp >= before || !byKey(st, 'sha').alive);
    const e2 = beginRound(st);
    assert.ok(e2.some((e) => e.t === 'buff' && e.buff === 'enrage'));
    resolveRound(st, defendAll(st));
    beginRound(st);
    assert.equal(bull.buffs.filter((b) => b.id === 'enrage').length, 2);
    resolveRound(st, defendAll(st));
    bull.hp = Math.floor(bull.maxHp * 0.5);
    const e3 = beginRound(st);
    assert.ok(e3.some((e) => e.t === 'assist'));
    assert.ok(bull.hp >= 1);
    resolveRound(st, defendAll(st));
    bull.hp = Math.floor(bull.maxHp * 0.3);
    assert.ok(!beginRound(st).some((e) => e.t === 'assist'), '助阵只有一次');
  } else assert.fail('这一棒应当打出换相');
});

test('蓄力重击：第三回合末预警，下一回合落向气血最少者；防御可减半；此战不可逃', () => {
  const st = battle('niumowang', 8, { formation: 'liuding' });
  round(st, defendAll(st)); round(st, defendAll(st));
  const e3 = round(st, defendAll(st));
  assert.ok(e3.some((e) => e.t === 'telegraph'));
  const boss = chargingBoss(st);
  assert.ok(boss);
  const marked = heavyTarget(st);
  const runner = alive(st, 'party').find((u) => u.id !== marked.id);
  const e4 = round(st, { ...defendAll(st), [runner.id]: { type: 'flee' } });
  const heavy = e4.find((e) => e.t === 'damage' && e.heavy);
  assert.ok(heavy, '应有重击');
  assert.equal(heavy.target, marked.id, '落向预告时气血最少的人');
  assert.equal(heavy.softened, true);
  assert.ok(e4.some((e) => e.t === 'flee' && e.ok === false));
  assert.ok(marked);
});

test('蓄力锁定：预警亮起时锁定当时气血最少者，照提示给他补满血，重击仍砸向他而不换人', () => {
  const st = battle('niumowang', 8, { formation: 'liuding' });
  round(st, defendAll(st)); round(st, defendAll(st));
  const e3 = round(st, defendAll(st));
  const tg = e3.find((e) => e.t === 'telegraph');
  assert.ok(tg?.target, '预警事件带上被锁定者');
  const marked = unitById(st, tg.target);
  assert.equal(heavyTarget(st).id, marked.id);
  // 把被点名者补到满血，让别人成为气血最少者
  const other = alive(st, 'party').find((u) => u.id !== marked.id);
  marked.hp = marked.maxHp; other.hp = 1;
  assert.equal(heavyTarget(st).id, marked.id, '补血后预警不换人');
  const e4 = round(st, defendAll(st));
  const heavy = e4.find((e) => e.t === 'damage' && e.heavy);
  assert.ok(heavy);
  assert.equal(heavy.target, marked.id, '重击落在预警点名的人身上');
  // 被锁定者先倒下才改落当时气血最少的人
  const st2 = battle('niumowang', 8, { formation: 'liuding' });
  round(st2, defendAll(st2)); round(st2, defendAll(st2));
  const t2 = round(st2, defendAll(st2)).find((e) => e.t === 'telegraph');
  const gone = unitById(st2, t2.target); gone.alive = false; gone.hp = 0;
  assert.notEqual(heavyTarget(st2).id, gone.id);
});

test('自动：决战里只会普通攻击', () => {
  const st = battle('niumowang', 9);
  const ev = round(st, autoAll(st));
  for (const e of ev.filter((x) => x.t === 'action' && unitById(st, x.actor).side === 'party')) assert.equal(e.basic, true);
});

test('决战真扇提示：一扇未出就每次下令都点明，有人领扇或扇出第一扇才收；别的战不提', () => {
  const st = battle('niumowang', 9);
  assert.equal(st.items.truefan, 3);
  assert.equal(fanPrompt(st), true, '决战开场就该点明真扇');
  // 全队按「自动」打完一回合：自动不动扇，提示照旧留着，等玩家自己应对
  round(st, autoAll(st));
  assert.equal(st.fanStage, 0, '自动不会替玩家扇扇——难度不因提示而变');
  assert.equal(fanPrompt(st), true, '第 2 回合仍未扇，提示不能只给一次');
  // 同一回合已有人领了扇：轮到后面的人时不再重复
  assert.equal(fanPrompt(st, [{ type: 'item', itemId: 'truefan' }]), false);
  assert.equal(fanPrompt(st, [{ type: 'attack', targetId: 'e0' }]), true);
  // 真扇出过第一扇：提示收起
  const holder = byKey(st, 'sha');
  round(st, { ...autoAll(st), [holder.id]: { type: 'item', itemId: 'truefan' } });
  assert.equal(st.fanStage, 1);
  assert.equal(fanPrompt(st), false);
  // 非决战、没带扇：都不提
  assert.equal(fanPrompt(battle('niu1', 9)), false);
  assert.equal(fanPrompt(battle('luosha', 9)), false);
  const empty = battle('niumowang', 9, { items: { truefan: 0 } });
  assert.equal(fanPrompt(empty), false);
  // 提示是世界内的话，点明入口与顺序
  assert.match(COACH.fan, /土地/);
  assert.match(COACH.fan, /【道具】/);
  assert.match(COACH.fan, /息火.*生风.*落雨/);
});

test('减伤叠加有上限，不会把伤害变成回血', () => {
  const st = battle('niu1', 3);
  const sha = byKey(st, 'sha');
  sha.buffs.push({ id: 'dmg_reduce', val: 0.6, turns: 5 }, { id: 'dmg_reduce', val: 0.6, turns: 5 });
  const pv = previewDamage(st, byKey(st, 'niumowang'), sha, SKILLS.tiegun);
  assert.ok(pv.min >= 1);
  assert.ok(effStat(st, sha, 'def') > 0);
});

test('数据表自洽：招式、形态、战斗引用的键都存在', () => {
  for (const def of [...Object.values(PARTY), ...Object.values(ENEMIES)]) {
    const ids = Array.isArray(def.skills) ? def.skills : Object.values(def.skills).flat();
    for (const id of ids) assert.ok(SKILLS[id], `${def.key} 引用了不存在的招式 ${id}`);
  }
  for (const f of Object.values(FORMS)) for (const id of f.skills) assert.ok(SKILLS[id]);
  for (const b of Object.values(BATTLES)) for (const k of b.enemies) assert.ok(ENEMIES[k], `${b.id} 的敌人 ${k}`);
  assert.equal(BASIC_ATTACK.mp, 0);
});

test('对症打法在十个种子里全胜；全程自动或只会普攻打不过决战', () => {
  const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010];
  for (const id of ['luosha', 'firemobs', 'yumian', 'niumowang']) {
    const extra = id === 'niumowang' ? { formation: 'liuding' } : {};
    const wins = seeds.filter((s) => play(id, smart, s, extra).winner === 'party').length;
    assert.equal(wins, seeds.length, `${id}: 对症打法 ${wins}/${seeds.length}`);
  }
  const auto = seeds.filter((s) => play('niumowang', autoAll, s).winner === 'party').length;
  const basic = seeds.filter((s) => play('niumowang', basicOnly, s).winner === 'party').length;
  assert.ok(auto <= 2, `决战全程自动不该常胜：${auto}/10`);
  assert.ok(basic <= 3, `决战只会普攻不该常胜：${basic}/10`);
  const basicFire = seeds.filter((s) => play('firemobs', basicOnly, s).winner === 'party').length;
  assert.ok(basicFire <= 3, `火兵战只会普攻不该常胜：${basicFire}/10`);
  // 两场剧情退场战：不论怎么打，都在第三回合开头结束
  for (const id of ['luosha1', 'niu1']) for (const s of seeds.slice(0, 3)) { const st = play(id, defendAll, s); assert.equal(st.winner, 'story'); assert.equal(st.round, 3); }
});

test('二借靠化虫三四回合可胜，硬拼明显更久', () => {
  const seeds = [11, 22, 33, 44, 55];
  const quick = seeds.map((s) => play('luosha', smart, s).round - 1);
  const slow = seeds.map((s) => play('luosha', basicOnly, s).round - 1);
  assert.ok(Math.max(...quick) <= 5, `化虫回合数 ${quick}`);
  // 硬打到她认输即胜（侍婢随之收兵），所以不再要求清场；但每个种子都不比化虫快，平均慢一回合以上
  seeds.forEach((s, i) => assert.ok(slow[i] >= quick[i], `种子 ${s}：硬拼 ${slow[i]} 回合快过化虫 ${quick[i]}`));
  const mean = (a) => a.reduce((n, x) => n + x, 0) / a.length;
  assert.ok(mean(slow) >= mean(quick) + 1, `硬拼 ${slow} 应明显慢于化虫 ${quick}`);
});

test('二借化虫窗口至少留一次下令：下令时她还没露疲态，这回合打不穿护身线', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const st = battle('luosha', seed);
    const boss = byKey(st, 'luosha');
    boss.hp = Math.ceil(boss.maxHp * 0.5); // 下令时窗口没开
    beginRound(st);
    assert.equal(finisherOpen(st), false);
    for (const u of alive(st, 'party')) u.atk *= 12; // 不管这一回合打得多狠，都停在护身线上
    const ev = resolveRound(st, Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: boss.id }])));
    assert.ok(boss.alive, `seed ${seed}：窗口还没给玩家看过就被打穿`);
    assert.ok(boss.hp >= Math.ceil(boss.maxHp * BATTLES.luosha.finisher.holdAt), `seed ${seed}：停在护身线 ${boss.hp}`); // 侍婢之后可能再替她疗一点
    assert.ok(ev.some((e) => e.t === 'finisher_hold' && e.unit === boss.id), '要有「护身退开」的事件给画面演');
    if (boss.hp / boss.maxHp > BATTLES.luosha.finisher.hpBelow) continue; // 被侍婢疗回窗口之上：下一回合照常再打
    assert.equal(finisherOpen(st), true, '下一回合窗口开着');
    // 下一回合玩家看见了疲态：照样硬打就能打到认输
    beginRound(st);
    boss.hp = 1;
    resolveRound(st, Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: boss.id }])));
    if (!boss.alive) { assert.equal(st.winner, 'party'); assert.notEqual(st.finished, true); }
  }
});

test('二借硬打到罗刹女认输：当场判胜，侍婢随之收兵，不留一个灰着站着选不中的她', () => {
  const st = battle('luosha', 5);
  const boss = byKey(st, 'luosha');
  boss.hp = Math.floor(boss.maxHp * 0.4);
  beginRound(st);
  assert.equal(finisherOpen(st), true);
  boss.hp = 1;
  const ev = resolveRound(st, Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: boss.id }])));
  assert.equal(boss.alive, false);
  assert.equal(st.over, true);
  assert.equal(st.winner, 'party');
  assert.notEqual(st.finished, true, '这是认输分支，不是化虫');
  assert.equal(alive(st, 'enemy').length, 0, '侍婢一并收兵');
  assert.ok(ev.some((e) => e.t === 'rout' && e.title === BATTLES.luosha.winOn.title));
  assert.ok(BATTLES.luosha.winOn.sub.includes('错过'), '认输时要说清化虫的机会错过了');
  assert.ok(BATTLES.luosha.finisher.goalOpen.includes('特技'), '窗口开着时「此战」要改写成怎么变化');
});

test('决战：白牛真身伏地即判胜，玉面公主与妖将当场溃散，不要玩家再清残敌', () => {
  const st = battle('niumowang', 6);
  const boss = byKey(st, 'niumowang');
  boss.hp = 1;
  round(st, Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: boss.id }])));
  const bull = unitById(st, boss.id);
  assert.equal(bull.key, 'whitebull', '先要现出白牛真身');
  assert.ok(alive(st, 'enemy').length > 1, '余众此时仍在场');
  assert.equal(st.over, false);
  bull.hp = 1;
  for (const u of alive(st, 'enemy')) if (u.id !== bull.id) u.hp = u.maxHp;
  const ev = round(st, Object.fromEntries(alive(st, 'party').map((u) => [u.id, { type: 'attack', targetId: bull.id }])));
  assert.equal(st.over, true);
  assert.equal(st.winner, 'party');
  assert.equal(alive(st, 'enemy').length, 0);
  const rout = ev.findIndex((e) => e.t === 'rout');
  assert.ok(rout >= 0, '应有白牛伏地的溃散事件');
  assert.ok(ev.slice(rout + 1).filter((e) => e.t === 'death' && e.rout).length >= 1, '余众随之溃散');
  assert.ok(BATTLES.niumowang.winOn.goal.includes('伏地即胜'), '白牛在场时「此战」要写明伏地即胜');
});

test('其他战不受白牛规则影响：摩云洞前须打退全部敌人', () => {
  assert.equal(BATTLES.yumian.winOn, undefined);
  assert.equal(BATTLES.niu1.winOn, undefined);
});
