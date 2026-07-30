// 「对手是否也在用核心系统」正向验证。qa 契约:被当作核心战术支柱的规则,敌方是否也在用它
// 跟玩家博弈——至少目标选择引用它、至少一条对玩家已选策略的反应。只有玩家单向利用、
// 敌方是纯血墙 + 固定脚本预警,即招牌系统未交付,记 major。
//
// 本文件只调 aiCommand,不引用实现方自测的任何断言。跑法:
//   node qa/enemy_core_system.mjs [--write]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../build/app');
const { createBattle, executeRound, aiCommand, getUnit, aliveUnits } = await import(`${APP}/js/engine.js`);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass, detail });

const mk = () => createBattle({
  battleId: 'firemobs', // 三名火敌,我方带水系携宠
  party: [{ key: 'wukong', level: 3 }, { key: 'bajie', level: 3 }, { key: 'sha', level: 3 }, { key: 'pixie', level: 3 }],
  seed: 42,
});

// ---------- 1. 目标选择引用五行:会克我的目标优先 ----------
{
  const s = mk();
  const foe = aliveUnits(s, 'enemy')[0];              // 火兵
  const pixie = s.units.find((u) => u.defKey === 'pixie');  // 水,克火
  const bajie = s.units.find((u) => u.defKey === 'bajie');  // 木,与火无关系
  // 把「会克我」的携宠血量拉到最高,若 AI 只看血量就绝不会选它
  pixie.hp = pixie.maxHp;
  for (const u of aliveUnits(s, 'party')) if (u.id !== pixie.id) u.hp = Math.round(u.maxHp * 0.3);
  const picks = new Set();
  for (let i = 0; i < 40; i++) picks.add(aiCommand(s, foe).targetId);
  add('目标选择引用五行:火敌在血量最高时仍锁定克它的水系携宠',
    picks.has(pixie.id) && !picks.has(bajie.id),
    `40 次择敌结果集合 = {${[...picks].join(', ')}}；水系携宠=${pixie.id}(满血)、八戒=${bajie.id}(30% 血)`);
}

// ---------- 2. 对玩家已选策略的反应:悟空变化成克敌形态后被集火 ----------
{
  const s = mk();
  const foe = aliveUnits(s, 'enemy')[0];
  const wukong = s.units.find((u) => u.defKey === 'wukong');
  for (const u of aliveUnits(s, 'party')) u.hp = u.maxHp; // 血量齐平,排除血量因素
  const before = aiCommand(s, foe).targetId;
  // 玩家决策:悟空变玄甲龟将(水),克场上火敌
  executeRound(s, { [wukong.id]: { type: 'transform', formId: 'xuangui' } });
  for (const u of aliveUnits(s, 'party')) u.hp = u.maxHp;
  const after = aiCommand(s, getUnit(s, foe.id)).targetId;
  add('对玩家策略的反应:悟空变身成克敌形态后,敌方改为集火悟空',
    before !== wukong.id && after === wukong.id,
    `变身前择敌=${before}，变身后择敌=${after}（悟空=${wukong.id}，变身后五行=${getUnit(s, wukong.id).element}）`);
}

// ---------- 3. 第二条反应:团队增益源优先被拆 ----------
// 需要隔离五行因素:三人队(无水系携宠)对火敌,悟空(金)被火克、八戒(木)与沙僧(土)皆无关系,
// 所以基线择敌只受「我克它」影响。给沙僧上罗汉金身后应改打沙僧。
{
  const s = createBattle({
    battleId: 'firemobs',
    party: [{ key: 'wukong', level: 3 }, { key: 'bajie', level: 3 }, { key: 'sha', level: 3 }],
    seed: 42,
  });
  const foe = aliveUnits(s, 'enemy')[0];
  const sha = s.units.find((u) => u.defKey === 'sha');   // 土,与火无关系
  for (const u of aliveUnits(s, 'party')) u.hp = u.maxHp;
  const before = aiCommand(s, foe).targetId;
  sha.buffs.push({ id: 'dmg_reduce', val: 0.3, turns: 3 }); // 罗汉金身生效中
  const after = aiCommand(s, foe).targetId;
  add('第二条反应:全队减伤增益生效时,敌方优先打增益源',
    before !== sha.id && after === sha.id,
    `上增益前择敌=${before}，上增益后择敌=${after}（沙僧=${sha.id}）`);
}

// ---------- 3b. 优先级次序:五行威胁 > 增益源 ----------
// 在场既有克敌携宠又有增益源时,敌方先处理五行威胁——这是有意的优先级,不是忽略增益。
{
  const s = mk();
  const foe = aliveUnits(s, 'enemy')[0];
  const pixie = s.units.find((u) => u.defKey === 'pixie');
  const sha = s.units.find((u) => u.defKey === 'sha');
  for (const u of aliveUnits(s, 'party')) u.hp = u.maxHp;
  sha.buffs.push({ id: 'dmg_reduce', val: 0.3, turns: 3 });
  const target = aiCommand(s, foe).targetId;
  add('优先级:五行威胁高于增益源', target === pixie.id,
    `择敌=${target}（克敌携宠=${pixie.id}，带增益的沙僧=${sha.id}）`);
}

// ---------- 4. 择敌不消耗 rng:同种子事件流仍逐字节一致 ----------
{
  const run = () => {
    const s = mk();
    const out = [];
    for (let r = 0; r < 4; r++) {
      const cmds = {};
      for (const u of aliveUnits(s, 'party')) cmds[u.id] = { type: 'attack', targetId: aliveUnits(s, 'enemy')[0]?.id };
      out.push(...executeRound(s, cmds));
    }
    return JSON.stringify(out);
  };
  add('择敌为决定论:同种子同指令事件流逐字节一致', run() === run(), '两次独立重放结果比较');
}

// ---------- 5. 敌方不是纯血墙:仍有蓄力预警与召唤等脚本外行为 ----------
{
  const s = createBattle({
    battleId: 'niumowang',
    party: [{ key: 'wukong', level: 5 }, { key: 'bajie', level: 5 }, { key: 'sha', level: 5 }, { key: 'pixie', level: 5 }],
    seed: 42, items: { truefan: 3 },
  });
  const evs = [];
  for (let r = 0; r < 6 && !s.over; r++) {
    const cmds = {};
    for (const u of aliveUnits(s, 'party')) cmds[u.id] = { type: 'attack', targetId: aliveUnits(s, 'enemy')[0]?.id };
    evs.push(...executeRound(s, cmds));
  }
  add('敌方仍有蓄力预警(不只是数值墙)', evs.some((e) => e.t === 'telegraph'),
    `telegraph 事件 ${evs.filter((e) => e.t === 'telegraph').length} 次`);
}

const failed = checks.filter((c) => !c.pass);
const out = [
  '# 敌方是否也在用核心系统（品类保真 go/no-go）',
  '',
  '由 `qa/enemy_core_system.mjs` 生成，只调用 `aiCommand`，不引用实现方自测的断言。',
  '',
  `结论：${failed.length === 0 ? '**go** —— 相克体系对敌方同样成立' : `**no-go** —— ${failed.length} 项未达成`}`,
  '',
  '| 检查项 | 结论 | 证据 |',
  '|---|---|---|',
  ...checks.map((c) => `| ${c.name} | ${c.pass ? '通过' : '**未通过**'} | ${c.detail} |`),
  '',
];
const md = out.join('\n');
console.log(md);
if (process.argv.includes('--write')) {
  writeFileSync(resolve(HERE, 'evidence/enemy-core-system.md'), md, 'utf8');
  console.log('已写 qa/evidence/enemy-core-system.md');
}
process.exit(failed.length ? 1 : 0);
