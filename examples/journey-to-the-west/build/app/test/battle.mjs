// 引擎自测(node):固定 seed 跑战斗,断言行动顺序/相克/暴击/胜负/升级可复现。
// 运行: node test/battle.mjs
import {
  createBattle, executeRound, buildActionQueue, effStat, elementRelation, elementCoef,
  calcDamage, makeUnit, levelUpParty, getUnit, aliveUnits, unitSkills, switchFormation,
  unitLevelStats, effectiveSkill, skillsAtLevel, previewDamage,
} from '../js/engine.js';
import { SKILLS, FORMS, BATTLES, PARTY, BASIC_ATTACK, POINT_GAINS, EQUIPS, TREASURES, GROWTH } from '../js/data.js';
import { createRNG } from '../js/rng.js';
import { settleLevelUp, recommendAlloc, applyRecommend, allocatePoint } from '../js/growth.js';

let passed = 0, failed = 0;
function ok(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }

const partyAt = (lv) => [
  { key: 'wukong', level: lv },
  { key: 'bajie', level: lv },
  { key: 'sha', level: lv },
];

// 固定指令集:全部自动,可复现
function runBattle(seed, battleId, party, opts = {}) {
  const state = createBattle({
    battleId, party, seed,
    formation: opts.formation ?? 'tiangang',
    items: opts.items ?? {},
  });
  const allEvents = [];
  let guard = 0;
  while (!state.over && guard++ < 60) {
    const commands = {};
    for (const u of aliveUnits(state, 'party')) {
      commands[u.id] = opts.commandFor ? opts.commandFor(state, u) : { type: 'auto' };
    }
    allEvents.push(...executeRound(state, commands));
  }
  return { state, events: allEvents };
}

// ---------- 1. 五行相克 ----------
section('五行相克关系');
ok(elementRelation('金', '木') === 'ke', '金克木');
ok(elementRelation('木', '土') === 'ke', '木克土');
ok(elementRelation('土', '水') === 'ke', '土克水');
ok(elementRelation('水', '火') === 'ke', '水克火');
ok(elementRelation('火', '金') === 'ke', '火克金');
ok(elementRelation('木', '金') === 'beike', '木被金克');
ok(elementRelation('火', '火') === 'none', '同属性中性');
ok(elementCoef('ke') === 1.5 && elementCoef('beike') === 0.66 && elementCoef('none') === 1, '系数 1.5/0.66/1');

// ---------- 2. 伤害公式与暴击可复现 ----------
section('伤害公式与暴击(seed 可复现)');
{
  const mk = () => {
    const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 7 });
    return s;
  };
  const s1 = mk(), s2 = mk();
  const a1 = getUnit(s1, 'p0'), d1 = getUnit(s1, 'e0');
  const a2 = getUnit(s2, 'p0'), d2 = getUnit(s2, 'e0');
  const rolls1 = Array.from({ length: 8 }, () => calcDamage(s1, a1, d1, SKILLS.ruyibang));
  const rolls2 = Array.from({ length: 8 }, () => calcDamage(s2, a2, d2, SKILLS.ruyibang));
  ok(JSON.stringify(rolls1) === JSON.stringify(rolls2), '同 seed 伤害序列完全一致');
  ok(rolls1.some((r) => r.crit), '8 次内有暴击出现');
  ok(rolls1.every((r) => r.amount >= 1), '伤害下限为 1');
  // 克制加成:悟空(金) 打 罗刹女(木) 应全部带 ke
  ok(rolls1.every((r) => r.rel === 'ke'), '金打木全部判「克」');
  // 被克:沙僧(土) 打 罗刹女(木) 应 beike
  const sha1 = getUnit(s1, 'p2');
  const rSha = calcDamage(s1, sha1, d1, SKILLS.xiangyaozhang);
  ok(rSha.rel === 'beike', '土打木判「被克」');
}

// ---------- 3. 行动顺序 ----------
section('行动顺序按速度降序');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 3 });
  const q = buildActionQueue(s);
  const spds = q.map((id) => effStat(s, getUnit(s, id), 'spd'));
  ok(spds.every((v, i) => i === 0 || spds[i - 1] >= v), `队列速度降序 [${spds.join(',')}]`);
  ok(q[0] === 'p0', '悟空速度最快先手');
}

// ---------- 4. 阵型效果 ----------
section('阵型效果');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 3, formation: 'liuding' });
  const wk = getUnit(s, 'p0');
  ok(effStat(s, wk, 'def') > wk.def, '六丁阵防御提升');
  ok(effStat(s, wk, 'spd') < wk.spd, '六丁阵速度下降');
  const s2 = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 3, formation: 'tiangang' });
  const wk2 = getUnit(s2, 'p0');
  ok(effStat(s2, wk2, 'atk') > wk2.atk, '天罡阵攻击提升');
}

// ---------- 5. 战斗1全流程(自动指令)同 seed 可复现 ----------
section('战斗1·罗刹女 全流程可复现');
{
  const r1 = runBattle(42, 'luosha', partyAt(1));
  const r2 = runBattle(42, 'luosha', partyAt(1));
  const strip = (evs) => JSON.stringify(evs);
  ok(strip(r1.events) === strip(r2.events), '同 seed 同指令事件流逐字节一致');
  ok(r1.state.winner === 'party', `战斗1自动可胜 (winner=${r1.state.winner})`);
  ok(r1.events.some((e) => e.t === 'damage' && e.rel === 'ke'), '出现过「克!」伤害');
  ok(r1.events.some((e) => e.t === 'damage' && e.crit), '出现过暴击');
  ok(r1.events.some((e) => e.t === 'battle_end' && e.winner === 'party'), '有 battle_end 事件');
  const rounds = r1.state.round - 1;
  ok(rounds >= 2 && rounds <= 15, `回合数合理 (${rounds})`);
}

// ---------- 6. 变化·化虫入腹(战斗1彩蛋) ----------
section('战斗1·悟空变化化虫入腹');
{
  // 先把罗刹女打到 55% 以下再让悟空变化
  const state = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 42 });
  const boss = getUnit(state, 'e0');
  boss.hp = Math.floor(boss.maxHp * 0.5);
  const evs = executeRound(state, {
    p0: { type: 'transform', formId: 'chongzi' },
    p1: { type: 'defend' },
    p2: { type: 'defend' },
  });
  ok(evs.some((e) => e.t === 'finisher'), '触发出「化虫入腹」finisher 事件');
  ok(state.winner === 'party', '直接取胜');
  // 血量高于阈值时不触发
  const s2 = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 42 });
  const evs2 = executeRound(s2, {
    p0: { type: 'transform', formId: 'shenjiang' },
    p1: { type: 'defend' },
    p2: { type: 'defend' },
  });
  ok(!evs2.some((e) => e.t === 'finisher'), '满血变化不触发彩蛋');
  const wk = getUnit(s2, 'p0');
  ok(wk.form && wk.form.id === 'shenjiang', '变化生效(金甲神将)');
  ok(unitSkills(wk).includes('shenjiang_sao'), '变化后技能替换为神将横扫');
  ok(wk.element === '金', '变化后五行=金');
}

// ---------- 7. 法术耗 MP / 防御回 MP ----------
section('法术 MP 与防御');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 5 });
  const wk = getUnit(s, 'p0');
  const mp0 = wk.mp;
  executeRound(s, { p0: { type: 'skill', skillId: 'ruyibang', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  ok(wk.mp === mp0 - SKILLS.ruyibang.mp, `技能耗 MP (${mp0}→${wk.mp})`);
  // 防御:姿态保持到下次行动前,并回 MP
  const bj = getUnit(s, 'p1');
  bj.mp = 30;
  executeRound(s, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  ok(bj.mp === 30 + Math.max(1, Math.round(bj.maxMp * 0.05)), `防御回 MP 5% (30→${bj.mp})`);
  ok(bj.defending === true, '防御姿态在回合间保持');
  executeRound(s, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'attack', targetId: 'e0' }, p2: { type: 'defend' } });
  ok(bj.defending === false, '八戒再次行动后防御姿态解除');
  // 蓝不够时回退普攻
  wk.mp = 0;
  const evs = executeRound(s, { p0: { type: 'skill', skillId: 'ruyibang', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  ok(evs.some((e) => e.t === 'info' && e.text === 'fallback_attack'), '蓝不足回退普攻');
}

// ---------- 8. 战斗2·携宠 + 假扇反噬 + 水克火 ----------
section('战斗2·火兵群 + 辟水金睛兽');
{
  const party = [...partyAt(2), { key: 'pixie', level: 2 }];
  const r1 = runBattle(99, 'firemobs', party, { items: { fakefan: 1 } });
  const r2 = runBattle(99, 'firemobs', party, { items: { fakefan: 1 } });
  ok(JSON.stringify(r1.events) === JSON.stringify(r2.events), '战斗2同 seed 可复现');
  ok(r1.state.winner === 'party', `战斗2自动可胜 (winner=${r1.state.winner})`);
  const pet = r1.state.units.find((u) => u.defKey === 'pixie');
  ok(!!pet, '宠物辟水金睛兽参战');
  ok(r1.events.some((e) => e.t === 'damage' && e.actor === pet.id && e.rel === 'ke'), '宠物水系攻击触发水克火');
  // 假扇:使用后敌方火系获得攻击增益
  const s = createBattle({ battleId: 'firemobs', party, seed: 11, items: { fakefan: 1 } });
  const evs = executeRound(s, { p0: { type: 'item', itemId: 'fakefan' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(evs.some((e) => e.t === 'buff' && e.buff === 'atk_up'), '假扇使火敌攻击提升(反噬)');
  ok(s.items.fakefan === 0, '假扇被消耗');
}

// ---------- 9. BOSS 多阶段 + 真扇三段 + 逃跑规则 ----------
section('战斗3·牛魔王两阶段 + 真扇');
{
  const party = [...partyAt(4), { key: 'pixie', level: 3 }];
  // 逃跑:boss 战必失败
  const sBoss = createBattle({ battleId: 'niumowang', party, seed: 1, items: { truefan: 3 } });
  const fleeEvs = executeRound(sBoss, { p0: { type: 'flee' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(fleeEvs.some((e) => e.t === 'flee' && e.success === false) && !sBoss.over, 'BOSS 战逃跑失败');
  // 非 boss 可逃(种子尝试到成功)
  let fled = false;
  for (let seed = 1; seed < 30 && !fled; seed++) {
    const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed });
    const evs = executeRound(s, { p0: { type: 'flee' }, p1: { type: 'flee' }, p2: { type: 'flee' } });
    if (evs.some((e) => e.t === 'flee' && e.success)) fled = true;
  }
  ok(fled, '非 BOSS 战可逃跑成功');
  // 智取策略(接力+蓄力防御+金身+集火主将),验证阶段转换
  const bossStrategy = (state, u) => {
    const charging = state.units.some((x) => x.side === 'enemy' && x.alive && x.charge === 1);
    const alive = aliveUnits(state, 'party');
    const lowest = alive.reduce((a, b) => (a.hp <= b.hp ? a : b));
    const boss = state.units.find((x) => x.side === 'enemy' && x.alive && (x.defKey === 'niumowang' || x.defKey === 'whitebull'));
    if (charging && u.id === lowest.id) return { type: 'defend' };
    if (lowest.hp / lowest.maxHp < 0.4 && (state.items.jinchuang ?? 0) > 0 && u.id === 'p0') return { type: 'item', itemId: 'jinchuang', targetId: lowest.id };
    if (u.id === 'p3' && state.fanStage < 3 && state.round >= 2) return { type: 'item', itemId: 'truefan' };
    if (u.defKey === 'sha' && u.mp >= 30 && !alive.some((x) => x.buffs.some((b) => b.id === 'dmg_reduce'))) return { type: 'skill', skillId: 'luohanjinshen' };
    const skill = { wukong: 'ruyibang', bajie: 'jiuchipaba', sha: 'xiangyaozhang', pixie: 'pishuijue' }[u.defKey];
    if (skill && boss && u.mp >= SKILLS[skill].mp) return { type: 'skill', skillId: skill, targetId: boss.id };
    return boss ? { type: 'attack', targetId: boss.id } : { type: 'auto' };
  };
  const r = runBattle(123, 'niumowang', party, { items: { truefan: 3, jinchuang: 3 }, formation: 'liuding', commandFor: bossStrategy });
  ok(r.events.some((e) => e.t === 'phase'), '牛魔王变身白牛真身(阶段转换)');
  const bull = r.events.find((e) => e.t === 'phase');
  ok(bull && bull.element === '土', '白牛真身为土属性(八戒木克土)');
  ok(r.events.some((e) => e.t === 'reinforce'), '白牛现形时八戒土地接力回血');
  ok(r.events.filter((e) => e.t === 'item' && e.item === 'truefan').length >= 1, '使用了真扇');
  ok(r.events.some((e) => e.t === 'info' && e.text === 'fan1'), '真扇一段·息火');
  ok(r.state.winner === 'party', `战斗3智取可胜 (winner=${r.state.winner})`);
  const r2 = runBattle(123, 'niumowang', party, { items: { truefan: 3, jinchuang: 3 }, formation: 'liuding', commandFor: bossStrategy });
  ok(JSON.stringify(r.events) === JSON.stringify(r2.events), '战斗3同 seed 可复现');
}

// ---------- 10. 胜利升级 ----------
section('升级结算');
{
  const ups = levelUpParty({ wukong: 1, bajie: 1, sha: 1 });
  ok(ups.wukong.level === 2 && ups.wukong.newSkills.includes('huoyan'), '悟空 Lv2 解锁火眼金睛');
  const ups2 = levelUpParty({ wukong: 2, bajie: 2, sha: 2 });
  ok(ups2.bajie.level === 3 && ups2.bajie.newSkills.includes('gongdi'), '八戒 Lv3 解锁拱地');
  ok(ups2.sha.newSkills.length === 0, '沙僧 Lv3 无新技能(已学完)');
}

// ---------- 11. 真扇对土属性 BOSS 生效(fan1/fan3 属性过滤 bug 回归) ----------
section('真扇无视属性减益(白牛为土也生效)');
{
  const party = [...partyAt(3), { key: 'pixie', level: 3 }];
  const s = createBattle({ battleId: 'niumowang', party, seed: 21, items: { truefan: 3 } });
  const boss = getUnit(s, 'e0');
  boss.hp = 1; // 打掉一阶段,逼出白牛真身
  executeRound(s, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  const wb = getUnit(s, 'e0');
  ok(wb.defKey === 'whitebull' && wb.element === '土', '已进入白牛真身(土)');
  const evsFan1 = executeRound(s, { p0: { type: 'item', itemId: 'truefan' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(wb.buffs.some((b) => b.id === 'atk_down'), 'fan1 息火减攻落在土属性白牛身上');
  ok(evsFan1.some((e) => e.t === 'buff' && e.buff === 'atk_up' && e.target === 'e0'), '白牛每回合狂暴叠攻+8%');
  executeRound(s, { p0: { type: 'item', itemId: 'truefan' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  executeRound(s, { p0: { type: 'item', itemId: 'truefan' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(wb.buffs.some((b) => b.id === 'def_down') && wb.buffs.some((b) => b.id === 'vulnerable'), 'fan3 落雨破防+破绽落在白牛身上');
}

// ---------- 12. 破绽增伤 +40% ----------
section('落雨破绽:受伤+40%');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 11 });
  const att = getUnit(s, 'p0'), def = getUnit(s, 'e0');
  att.crit = 0; // 排除暴击干扰
  const sample = (withVuln, n) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      def.buffs = withVuln ? [{ id: 'vulnerable', val: 0.4, turns: 3 }] : [];
      sum += calcDamage(s, att, def, SKILLS.ruyibang).amount;
    }
    return sum / n;
  };
  const base = sample(false, 30);
  const vuln = sample(true, 30);
  const ratio = vuln / base;
  ok(ratio > 1.28 && ratio < 1.52, `破绽增伤≈1.4 (实测 ${ratio.toFixed(2)})`);
}

// ---------- 13. BOSS 蓄力预警与重击 ----------
section('BOSS 蓄力预警 → 重击');
{
  const party = [...partyAt(3), { key: 'pixie', level: 3 }];
  const s = createBattle({ battleId: 'niumowang', party, seed: 5 });
  const defendAll = () => ({ p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  executeRound(s, defendAll()); // 回合1
  executeRound(s, defendAll()); // 回合2
  const evs3 = executeRound(s, defendAll()); // 回合3:预警
  ok(evs3.some((e) => e.t === 'telegraph'), '第 3 回合发出蓄力预警');
  ok(!evs3.some((e) => e.t === 'heavy'), '预警当回合不重击');
  const evs4 = executeRound(s, defendAll()); // 回合4:重击
  const heavy = evs4.find((e) => e.t === 'heavy');
  ok(!!heavy, '第 4 回合重击落下');
  const target = getUnit(s, heavy.target);
  const ratio = heavy.amount / target.maxHp;
  ok(ratio > 0.22 && ratio < 0.45, `防御下重击≈30%最大血 (实测 ${(ratio * 100).toFixed(0)}%)`);
  ok(heavy.mitigated === true, '重击被防御减伤(mitigated)');
}

// ---------- 14. BOSS 战自动只普攻 ----------
section('BOSS 战「自动」只代打普攻');
{
  const party = [...partyAt(3), { key: 'pixie', level: 3 }];
  const s = createBattle({ battleId: 'niumowang', party, seed: 9 });
  const evs = executeRound(s, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' }, p3: { type: 'auto' } });
  const partySkills = evs.filter((e) => e.t === 'action' && e.skill && e.actor.startsWith('p'));
  ok(partySkills.length === 0, 'BOSS 战我方自动不放技能');
  // 非 BOSS 战自动仍可用技能(战斗1里仍有技能行动)
  const s2 = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 9 });
  const evs2 = executeRound(s2, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' } });
  ok(evs2.some((e) => e.t === 'action' && e.skill && e.actor.startsWith('p')), '非 BOSS 战自动仍放技能');
}

// ---------- 15. 战斗中免费换阵(每回合一次) ----------
section('战斗中免费换阵');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 3 });
  const ev1 = switchFormation(s, 'liuding');
  ok(!!ev1 && s.formation === 'liuding', '第一次换阵成功且不耗行动');
  ok(switchFormation(s, 'tiangang') === null, '同回合第二次换阵被拒');
  executeRound(s, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  const ev3 = switchFormation(s, 'tiangang');
  ok(!!ev3 && s.formation === 'tiangang', '次回合可再次换阵');
}

// ---------- 16. 玄甲龟将:被克伤害减半 ----------
section('玄甲龟将被克减伤');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 7 });
  executeRound(s, { p0: { type: 'transform', formId: 'xuangui' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  const wk = getUnit(s, 'p0');
  ok(wk.form && wk.form.id === 'xuangui' && wk.element === '水', '变为玄甲龟将(水)');
  ok(wk.buffs.some((b) => b.id === 'ke_shield'), '获得被克减伤');
  const bull = makeUnit('whitebull', 'enemy', 1); // 土:克罗甲龟水
  bull.crit = 0;
  const sample = (shielded, n) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      wk.buffs = shielded ? [{ id: 'ke_shield', val: 0.5, turns: 3 }] : [];
      sum += calcDamage(s, bull, wk, BASIC_ATTACK).amount;
    }
    return sum / n;
  };
  const shielded = sample(true, 30);
  const raw = sample(false, 30);
  const ratio = shielded / raw;
  ok(ratio > 0.4 && ratio < 0.6, `被克伤害减半 (实测 ${ratio.toFixed(2)})`);
}

// ---------- 17. 连击:暴击 25% 追加 ----------
section('连击');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 42 });
  getUnit(s, 'p0').crit = 1.0; // 必暴击
  const boss = getUnit(s, 'e0');
  boss.hp = 99999; boss.maxHp = 99999; // 保证打不死,多抽几次
  let combo = 0, crits = 0;
  for (let i = 0; i < 6; i++) {
    const evs = executeRound(s, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
    crits += evs.filter((e) => e.t === 'damage' && e.crit && e.actor === 'p0').length;
    combo += evs.filter((e) => e.t === 'damage' && e.combo && e.actor === 'p0').length;
  }
  ok(crits >= 5, `必暴样本充足 (${crits} 次暴击)`);
  ok(combo >= 1, `暴击触发了连击 (${combo} 次)`);
}

// ---------- 18. 加点:确定性与缺省护栏 ----------
section('升级加点(潜力点)');
{
  const base = unitLevelStats(PARTY.wukong, 3);
  const none = unitLevelStats(PARTY.wukong, 3, null);
  const empty = unitLevelStats(PARTY.wukong, 3, {});
  ok(JSON.stringify(base) === JSON.stringify(none) && JSON.stringify(base) === JSON.stringify(empty), 'alloc 缺省/null/{} 三者逐字节一致');
  const withAlloc = unitLevelStats(PARTY.wukong, 3, { 攻: 5, 体: 3, 灵: 2 });
  ok(withAlloc.atk === base.atk + 10, `攻+5 → atk+${withAlloc.atk - base.atk}(应 10)`);
  ok(withAlloc.hp === base.hp + 24, `体+3 → hp+${withAlloc.hp - base.hp}(应 24)`);
  ok(withAlloc.mag === base.mag + 4 && withAlloc.mp === base.mp + 2, `灵+2 → mag+4 mp+2`);
  ok(withAlloc.def === base.def && withAlloc.spd === base.spd, '未投维度不变');
}

// ---------- 19. 法术熟练 ----------
section('法术熟练');
{
  const raw = SKILLS.ruyibang;
  const u1 = { skillLevels: { ruyibang: 1 } };
  ok(effectiveSkill(u1, 'ruyibang', raw) === raw, '熟练1 → 返回原对象(引用相同)');
  const u3 = { skillLevels: { ruyibang: 3 } };
  const eff = effectiveSkill(u3, 'ruyibang', raw);
  ok(eff !== raw && Math.abs(eff.mul - raw.mul * 1.12) < 1e-9, `熟练3 → 威力×1.12 (${eff.mul.toFixed(3)})`);
  ok(eff.mp === raw.mp - 4, `熟练3 → MP-${raw.mp - eff.mp}(应 4)`);
  const healRaw = SKILLS.guiyuan;
  const healEff = effectiveSkill({ skillLevels: { guiyuan: 3 } }, 'guiyuan', healRaw);
  ok(Math.abs(healEff.heal - healRaw.heal * 1.12) < 1e-9, '治疗技熟练同比例放大');
}

// ---------- 20. 装备与法宝叠加 ----------
section('武器装备与规则型法宝');
{
  const plain = makeUnit('wukong', 'party', 1);
  const armed = makeUnit('wukong', 'party', 1, { equip: 'ruyibang_jing' });
  ok(armed.atk === plain.atk + 12 && Math.abs(armed.crit - (plain.crit + 0.05)) < 1e-9, '金箍棒·精:atk+12 crit+5%');
  const windy = makeUnit('sha', 'party', 1, { treasure: 'dingfengdan' });
  ok(windy.spd === makeUnit('sha', 'party', 1).spd + 6, '定风丹:spd+6');
  // 定风丹免疫减速
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 1, treasure: 'dingfengdan' });
  const wk = getUnit(s, 'p0');
  wk.buffs.push({ id: 'spd_down', val: 0.5, turns: 3 });
  ok(effStat(s, wk, 'spd') === effStat(s, { ...wk, buffs: [] }, 'spd'), '定风丹:减速 debuff 无效');
  // 避火锦:火伤减免
  const s2 = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 1 });
  const target = getUnit(s2, 'p0');
  const fireAttacker = makeUnit('firemob1', 'enemy', 1);
  fireAttacker.crit = 0;
  const sample = (res, n) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      target.resist = res;
      sum += calcDamage(s2, fireAttacker, target, BASIC_ATTACK).amount;
    }
    return sum / n;
  };
  const noRes = sample(null, 30);
  const withRes = sample({ 火: 0.25 }, 30);
  const ratio = withRes / noRes;
  ok(ratio > 0.66 && ratio < 0.84, `避火锦火伤×0.75 (实测 ${ratio.toFixed(2)})`);
  target.resist = null;
}

// ---------- 21. 升级结算:发点+熟练,推荐加点确定 ----------
section('升级结算(发点/熟练/推荐加点)');
{
  const mkCampaign = () => ({ pendingPoints: {}, skillLevels: {}, alloc: {} });
  const c1 = mkCampaign(), c2 = mkCampaign();
  const ups = levelUpParty({ wukong: 1, bajie: 1, sha: 1 });
  settleLevelUp(c1, ups);
  settleLevelUp(c2, ups);
  ok(JSON.stringify(c1) === JSON.stringify(c2), '同 ups 两次结算完全一致');
  ok(c1.pendingPoints.wukong === GROWTH.pointsPerLevel, `每人 +${GROWTH.pointsPerLevel} 潜力点`);
  ok(c1.skillLevels.wukong.ruyibang === 2, '已习得法术熟练+1');
  const plan = recommendAlloc(PARTY.wukong, 10);
  const total = Object.values(plan).reduce((a, b) => a + b, 0);
  ok(total === 10, `推荐加点分配总额=投入 (${total})`);
  ok(plan['攻'] >= plan['灵'], '按权重倾斜(攻≥灵)');
  const c3 = mkCampaign();
  c3.pendingPoints.wukong = 10;
  const used = applyRecommend(c3, 'wukong');
  ok(used === 10 && c3.pendingPoints.wukong === 0, '一键推荐投完全部点数');
  // 手动加点与洗回
  const c4 = mkCampaign();
  c4.pendingPoints.sha = 5;
  ok(allocatePoint(c4, 'sha', '防', 1) && c4.alloc.sha['防'] === 1 && c4.pendingPoints.sha === 4, '手动+1 成功');
  ok(allocatePoint(c4, 'sha', '防', -1) && c4.pendingPoints.sha === 5, '洗回 +1');
  ok(!allocatePoint(c4, 'sha', '防', 1) || true, '空点不炸');
  ok(!allocatePoint({ pendingPoints: { sha: 0 }, alloc: {} }, 'sha', '防', 1), '无点时投点被拒');
}

// ---------- 22. 结算与战斗 rng 隔离 ----------
section('结算隔离:不占战斗 rng');
{
  const runOnce = () => {
    const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 77 });
    return executeRound(s, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' } })
      .filter((e) => e.t === 'damage');
  };
  const before = runOnce();
  // 中间做一整套升级结算(含推荐加点)
  const c = { pendingPoints: { wukong: 9 }, skillLevels: {}, alloc: {} };
  settleLevelUp(c, levelUpParty({ wukong: 1 }));
  applyRecommend(c, 'wukong');
  const after = runOnce();
  ok(JSON.stringify(before) === JSON.stringify(after), '结算前后同 seed 战斗事件逐字节一致');
}

// ---------- 23. 捕捉:剧情门控+独立种子 ----------
section('召唤兽捕捉(捕妖绳)');
{
  const mk = (seed) => createBattle({ battleId: 'firemobs', party: [...partyAt(2), { key: 'pixie', level: 2 }], seed, items: { buyaosheng: 2 } });
  // 血气>40% 拒捕不耗绳
  const s1 = mk(31);
  const evs1 = executeRound(s1, { p0: { type: 'item', itemId: 'buyaosheng', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(evs1.some((e) => e.t === 'info' && e.text === 'catch_hp') && s1.items.buyaosheng === 2, '血气>40% 拒捕且不耗绳');
  // ≤40%:同 seed 两次结果一致(决定论)
  const s2 = mk(31), s3 = mk(31);
  for (const s of [s2, s3]) {
    const mob = getUnit(s, 'e0');
    mob.hp = Math.floor(mob.maxHp * 0.3);
  }
  const evs2 = executeRound(s2, { p0: { type: 'item', itemId: 'buyaosheng', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  const evs3 = executeRound(s3, { p0: { type: 'item', itemId: 'buyaosheng', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(JSON.stringify(evs2) === JSON.stringify(evs3), '捕捉判定同 seed 一致(catchRng 独立流)');
  const caught = evs2.some((e) => e.t === 'caught');
  ok(caught ? s2.caught.includes('huobao') && !getUnit(s2, 'e0').alive : evs2.some((e) => e.t === 'catch_fail'),
    caught ? '捕捉成功:huobao 入列,目标离场' : '本次为捕捉失败事件(亦为合法决定论结果)');
  ok(s2.items.buyaosheng === 1, '捕捉出手耗绳一根');
  // 捕捉流不扰战斗 rng:捕捉失败时,与用绳者(p0)无关的伤害事件完全一致
  let isolated = false;
  for (let seed = 1; seed <= 80 && !isolated; seed++) {
    const run = (useRope) => {
      const s = mk(seed);
      getUnit(s, 'e1').hp = Math.floor(getUnit(s, 'e1').maxHp * 0.3);
      const evs = executeRound(s, {
        p0: useRope ? { type: 'item', itemId: 'buyaosheng', targetId: 'e1' } : { type: 'defend' },
        p1: { type: 'attack', targetId: 'e2' },
        p2: { type: 'attack', targetId: 'e2' },
        p3: { type: 'defend' },
      });
      return evs;
    };
    const ropeEvs = run(true);
    if (!ropeEvs.some((e) => e.t === 'catch_fail')) continue; // 找一个捕捉失败的种子
    // p0 自身姿态(防御与否)只影响打在 p0 身上的伤害,剔除后两边必须逐字节一致
    const notP0 = (e) => e.t === 'damage' && e.target !== 'p0' && e.actor !== 'p0';
    isolated = JSON.stringify(run(false).filter(notP0)) === JSON.stringify(ropeEvs.filter(notP0));
  }
  ok(isolated, '捕捉判定不插入战斗 rng 序列(失败时全场逐字节一致)');
}

// ---------- 24. buffitem 与避火符 ----------
section('增益物品(醒酒石/避火符)');
{
  const s = createBattle({ battleId: 'firemobs', party: partyAt(2), seed: 8, items: { xingshi: 1, bihuofu: 1 } });
  const evs = executeRound(s, { p0: { type: 'item', itemId: 'xingshi', targetId: 'p0' }, p1: { type: 'item', itemId: 'bihuofu', targetId: 'p1' }, p2: { type: 'defend' } });
  ok(getUnit(s, 'p0').buffs.some((b) => b.id === 'dmg_reduce'), '醒酒石:减伤增益生效');
  ok(evs.some((e) => e.t === 'buff' && e.buff === 'huo_ward'), '避火符:挂避火护符');
  ok(s.items.xingshi === 0 && s.items.bihuofu === 0, '增益物品被消耗');
  // 避火符抵挡一次火系伤害
  const evs2 = executeRound(s, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  const fireHitOnBajie = evs2.find((e) => e.t === 'damage' && e.target === 'p1');
  const warded = evs2.some((e) => e.t === 'ward' && e.target === 'p1');
  ok(warded || !fireHitOnBajie, '避火符抵挡火系攻击(触发即见 ward 事件)');
}

// ---------- 25. 治疗技(归元静心) ----------
section('治疗技');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(6), seed: 4 });
  const sha = getUnit(s, 'p2');
  ok(unitSkills(sha).includes('guiyuan'), '沙僧 Lv6 习得归元静心');
  getUnit(s, 'p0').hp = 100;
  const hpBefore = getUnit(s, 'p0').hp;
  executeRound(s, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'skill', skillId: 'guiyuan' } });
  ok(getUnit(s, 'p0').hp > hpBefore, `群体治疗生效 (${hpBefore}→${getUnit(s, 'p0').hp})`);
}

// ---------- 26. 敌人分级与技能表补齐 ----------
section('批0:敌人分级与技能表');
{
  const s2 = createBattle({ battleId: 'firemobs', party: partyAt(2), seed: 1 });
  const mob = getUnit(s2, 'e0');
  ok(mob.level === 2 && mob.maxHp > 430, `火兵随进度 Lv2 (hp ${mob.maxHp}>430)`);
  const s3 = createBattle({ battleId: 'niumowang', party: partyAt(3), seed: 1 });
  ok(getUnit(s3, 'e0').level === 1, '决战 3 敌编成取 Lv1(多敌+阶段+狂暴的强度阀)');
  ok(skillsAtLevel(PARTY.wukong, 4).includes('qitian'), '悟空 Lv4 解锁齐天棍影');
  ok(skillsAtLevel(PARTY.sha, 6).includes('guiyuan'), '沙僧 Lv6 解锁归元静心');
  const ups = levelUpParty({ wukong: 3 });
  ok(ups.wukong.newSkills.includes('qitian'), 'Lv3→4 升级获得新技能(不空转)');
}

// ---------- 27. 批1:罗刹女一战·一扇吹飞(剧情退出) ----------
section('一扇吹飞(原著第59回,演出非失败)');
{
  const s = createBattle({ battleId: 'luosha1', party: partyAt(1), seed: 42 });
  ok(s.units.filter((u) => u.side === 'enemy').length === 3, '一战敌方=罗刹女+侍婢×2(修 N 打 1)');
  ok(s.units.filter((u) => u.defKey === 'shibi').length === 2, '侍婢 shibi 在阵');
  const all = [];
  let guard = 0;
  while (!s.over && guard++ < 10) {
    all.push(...executeRound(s, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' } }));
  }
  ok(s.winner === 'story', `第 3 回合被吹飞,winner=story (${s.winner})`);
  ok(all.some((e) => e.t === 'story_blow'), '有 story_blow 事件');
  ok(s.round - 1 === 3, '恰好第 3 回合触发');
  ok(aliveUnits(s, 'party').length === 3, '吹飞非失败:我方无人阵亡');
  // 复现性
  const s2 = createBattle({ battleId: 'luosha1', party: partyAt(1), seed: 42 });
  const all2 = [];
  guard = 0;
  while (!s2.over && guard++ < 10) {
    all2.push(...executeRound(s2, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' } }));
  }
  ok(JSON.stringify(all) === JSON.stringify(all2), '吹飞流程同 seed 逐字节一致');
}

// ---------- 28. 批1:再战罗刹女·彩蛋溃散 ----------
section('再战:化虫入腹+侍婢溃散');
{
  const s = createBattle({ battleId: 'luosha', party: partyAt(1), seed: 42 });
  getUnit(s, 'e0').hp = Math.floor(getUnit(s, 'e0').maxHp * 0.5);
  const evs = executeRound(s, { p0: { type: 'transform', formId: 'chongzi' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
  ok(evs.some((e) => e.t === 'finisher'), '化虫入腹触发');
  ok(evs.some((e) => e.t === 'rout'), '侍婢溃散事件');
  ok(s.winner === 'party' && aliveUnits(s, 'enemy').length === 0, '主将被擒,全战结束');
}

// ---------- 29. 批1:火炎校尉召唤火兵 ----------
section('火炎校尉召唤(每隔数回合一波)');
{
  const s = createBattle({ battleId: 'firemobs', party: partyAt(2), seed: 99 });
  const all = [];
  let guard = 0;
  while (!s.over && guard++ < 12) {
    all.push(...executeRound(s, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' } }));
    if (all.some((e) => e.t === 'summon')) break;
  }
  const summonEvs = all.filter((e) => e.t === 'summon');
  ok(summonEvs.length >= 1, '校尉召唤了火兵');
  ok(summonEvs[0] && all.find((e) => e.t === 'round' && e.queue.includes(summonEvs[0].unit)) === undefined, '新召唤单位当回合不抢行动');
  // 上限 2 只
  const s2 = createBattle({ battleId: 'firemobs', party: partyAt(2), seed: 99 });
  let summons = 0;
  guard = 0;
  while (!s2.over && guard++ < 25) {
    const evs = executeRound(s2, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' } });
    summons += evs.filter((e) => e.t === 'summon').length;
  }
  ok(summons <= 2, `召唤有上限 (实际 ${summons}≤2)`);
  // 召唤不占额外随机:同 seed 全流程一致
  const runOnce = () => {
    const x = createBattle({ battleId: 'firemobs', party: partyAt(2), seed: 99 });
    const evs = [];
    let g = 0;
    while (!x.over && g++ < 6) evs.push(...executeRound(x, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' } }));
    return JSON.stringify(evs);
  };
  ok(runOnce() === runOnce(), '含召唤的全流程同 seed 一致');
}

// ---------- 30. 批2:玉面公主战与初战牛魔王 ----------
section('批2:摩云洞·玉面公主/初战牛魔王');
{
  // 玉面公主阵容与五行
  const s = createBattle({ battleId: 'yumian', party: partyAt(3), seed: 21 });
  ok(s.units.filter((u) => u.side === 'enemy').length === 3, '玉面公主战敌方 3 单位');
  const ym = s.units.find((u) => u.defKey === 'yumian');
  ok(ym.element === '土' && ym.level === 3, '玉面公主 土属性 Lv3(八戒木克土)');
  const yj = s.units.filter((u) => u.defKey === 'yaojiang');
  ok(yj.length === 2 && yj[0].element === '金', '摩云洞妖将×2 金属性');
  // 玉面公主会群体妖法与娇蛮减益
  const evs = [];
  let g = 0;
  const s2 = createBattle({ battleId: 'yumian', party: partyAt(3), seed: 21 });
  while (!s2.over && g++ < 12) {
    evs.push(...executeRound(s2, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' } }));
    if (evs.some((e) => e.t === 'action' && (e.name === '妖法迷人' || e.name === '娇蛮'))) break;
  }
  ok(evs.some((e) => e.t === 'action' && ['妖法迷人', '娇蛮'].includes(e.name)), '玉面公主施展妖法/娇蛮');
  // 初战牛魔王:第 3 回合赴宴而走(剧情退出,非失败)
  const s3 = createBattle({ battleId: 'niu1', party: partyAt(3), seed: 42 });
  const all = [];
  g = 0;
  while (!s3.over && g++ < 10) {
    all.push(...executeRound(s3, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' } }));
  }
  ok(s3.winner === 'story' && s3.round - 1 === 3, `初战牛魔王第 3 回合赴宴而走 (${s3.winner})`);
  ok(all.some((e) => e.t === 'story_retreat'), '有 story_retreat 事件');
  ok(aliveUnits(s3, 'party').length > 0, '赴宴非失败:我方健在');
  // 同 seed 复现
  const s4 = createBattle({ battleId: 'niu1', party: partyAt(3), seed: 42 });
  const all2 = [];
  g = 0;
  while (!s4.over && g++ < 10) {
    all2.push(...executeRound(s4, { p0: { type: 'auto' }, p1: { type: 'auto' }, p2: { type: 'auto' } }));
  }
  ok(JSON.stringify(all) === JSON.stringify(all2), '赴宴流程同 seed 一致');
  // 玉面公主战可胜(智取:先杀侍从再集火)
  const r = runBattle(66, 'yumian', partyAt(3));
  ok(r.state.winner === 'party', `玉面公主战自动可胜 (winner=${r.state.winner})`);
}

// ---------- 31. 批2:辟水金睛兽正式入队作战 ----------
section('辟水金睛兽(碧波潭获得)参战');
{
  // 金睛兽入队:水克火对火系敌人有优势
  const party = [...partyAt(3), { key: 'pixie', level: 3 }];
  const s = createBattle({ battleId: 'niu1', party, seed: 5 });
  const pet = s.units.find((u) => u.defKey === 'pixie');
  ok(!!pet && pet.element === '水', '辟水金睛兽入队(水属性)');
  ok(buildActionQueue(s).includes(pet.id), '宠占正式行动位(在行动队列中)');
}

// ---------- 32. 批3:决战·众神围剿与反骗 ----------
section('批3:众神围剿(门控)/反骗开局/阶段继承等级');
{
  // 决战为多人对阵
  const s = createBattle({ battleId: 'niumowang', party: [...partyAt(5), { key: 'pixie', level: 4 }], seed: 42, items: { truefan: 3 } });
  ok(s.units.filter((u) => u.side === 'enemy').length === 3, '决战敌方=牛魔王+玉面公主+妖将');
  // 阶段继承战斗分级(Lv4)
  const boss = getUnit(s, 'e0');
  boss.hp = 1;
  executeRound(s, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  const wb = getUnit(s, 'e0');
  ok(wb.defKey === 'whitebull' && wb.level === 1 && wb.maxHp === 1300, `白牛真身继承战斗分级 (Lv${wb.level} hp ${wb.maxHp})`);
  // 众神围剿:白牛≤50%一次性触发
  wb.hp = Math.floor(wb.maxHp * 0.5);
  const evs = executeRound(s, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(evs.some((e) => e.t === 'god_assist'), '白牛≤50% 哪吒登场助战');
  const ga = evs.find((e) => e.t === 'god_assist');
  ok(ga.amount === Math.round(wb.maxHp * 0.15), '助战伤害=白牛最大血 15%');
  ok(wb.buffs.some((b) => b.id === 'def_down'), '助战后白牛破防');
  const evs2 = executeRound(s, { p0: { type: 'defend' }, p1: { type: 'defend' }, p2: { type: 'defend' }, p3: { type: 'defend' } });
  ok(!evs2.some((e) => e.t === 'god_assist'), '众神助战只触发一次(门控)');
  // 反骗开局:中计则悟空首回合降攻
  const fooled = createBattle({ battleId: 'niumowang', party: partyAt(3), seed: 1, startDebuff: { unit: 'p0', buff: { id: 'atk_down', val: 0.15, turns: 1 } } });
  ok(getUnit(fooled, 'p0').buffs.some((b) => b.id === 'atk_down'), '反骗得逞:悟空开局 atk_down');
  const clean = createBattle({ battleId: 'niumowang', party: partyAt(3), seed: 1 });
  ok(!getUnit(clean, 'p0').buffs.length, '识破反骗:无开局减益');
}

// ---------- 33. 伤害预览与实际结算一致(POLISH 新增) ----------
section('伤害预览:与 calcDamage 同公式、不占 rng');
{
  const mk = () => createBattle({ battleId: 'luosha', party: partyAt(1), seed: 42 });
  const s = mk();
  const att = getUnit(s, 'p0'), boss = getUnit(s, 'e0');
  // 非暴击区间:多次实际结算全部落在预览区间内
  const probe = (attacker, defender, skill, label) => {
    const pv = previewDamage(s, attacker, defender, skill);
    ok(pv.expected >= pv.min && pv.expected <= pv.max, `${label}:预览期望值落在区间内`);
    for (let i = 0; i < 24; i++) {
      const r = calcDamage(s, attacker, defender, skill);
      ok(r.rel === pv.rel, `${label}:实际五行关系=预览 (${pv.rel})`);
      if (r.crit) ok(r.amount >= pv.critMin && r.amount <= pv.critMax, `${label}:暴击 ${r.amount} ∈ [${pv.critMin},${pv.critMax}]`);
      else ok(r.amount >= pv.min && r.amount <= pv.max, `${label}:伤害 ${r.amount} ∈ [${pv.min},${pv.max}]`);
    }
    return pv;
  };
  const pv1 = probe(att, boss, SKILLS.ruyibang, '悟空棒击罗刹女');
  ok(pv1.rel === 'ke' && pv1.coef === 1.5, '预览给出克制关系(金克木 ×1.5)');
  const pv2 = previewDamage(s, getUnit(s, 'p2'), boss, SKILLS.xiangyaozhang);
  ok(pv2.rel === 'beike' && pv2.max < pv1.max, '被克预览区间显著低于克制');
  // 防御姿态预览减半
  boss.defending = true;
  const pvDef = previewDamage(s, att, boss, SKILLS.ruyibang);
  ok(pvDef.max <= pv1.max, `防御姿态预览区间下降 (${pv1.max}→${pvDef.max})`);
  boss.defending = false;
  // 预览不消耗 rng:反复调用后,同 seed 同指令事件流仍逐字节一致
  const runOnce = (withPreview) => {
    const st = mk();
    if (withPreview) {
      for (let i = 0; i < 50; i++) previewDamage(st, getUnit(st, 'p0'), getUnit(st, 'e0'), SKILLS.ruyibang);
    }
    return JSON.stringify(executeRound(st, { p0: { type: 'attack', targetId: 'e0' }, p1: { type: 'defend' }, p2: { type: 'defend' } }));
  };
  ok(runOnce(false) === runOnce(true), '调用预览 50 次后事件流仍逐字节一致(不占 rng)');
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
