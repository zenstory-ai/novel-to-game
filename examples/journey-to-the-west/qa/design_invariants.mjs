// 独立不变量检查:期望值全部从 design/GAME_DESIGN.md 反向抄出(每条附文档章节名),
// 与实现方的 build/app/test/battle.mjs 无共享断言。跑法:
//   node qa/design_invariants.mjs            # 打印结果
//   node qa/design_invariants.mjs --write     # 同时写 qa/evidence/design-invariants.md
//
// qa 契约要求关键不变量另写一份直接对照 GAME_DESIGN 的检查:用实现自己的常量去验收
// 实现,只能证明自洽。本文件只读 js/data.js 与 js/engine.js 的导出,不引用 battle.mjs。

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../build/app');

const {
  ELEMENTS, ELEMENT_COEF, SKILLS, BASIC_ATTACK, FORMS, PARTY, ENEMIES,
  FORMATIONS, ITEMS, BATTLES, GROWTH, TREASURES, CAMPAIGN_BATTLES,
} = await import(`${APP}/js/data.js`);
const engineSource = await import('node:fs').then((fs) =>
  fs.readFileSync(`${APP}/js/engine.js`, 'utf8'));

const rows = [];
/** @param {string} id @param {string} cite @param {string} item @param {unknown} want @param {unknown} got */
function check(id, cite, item, want, got) {
  const w = JSON.stringify(want), g = JSON.stringify(got);
  rows.push({ id, cite, item, want: w, got: g, ok: w === g });
}

// ---------- 五行与系数 ----------
check('E1', '五行相克', '相克链 金→木→土→水→火→金',
  { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' },
  Object.fromEntries(Object.entries(ELEMENTS).map(([k, v]) => [k, v.beats])));
check('E2', '五行相克', '克制/被克/无关系系数',
  { ke: 1.5, beike: 0.66, none: 1.0 }, ELEMENT_COEF);

// ---------- 阵型 ----------
check('F1', '阵型', '天罡阵 攻/速修正', { atk: 1.2, spd: 1.05 },
  { atk: FORMATIONS.tiangang.mods.atk, spd: FORMATIONS.tiangang.mods.spd });
check('F2', '阵型', '天罡阵 受伤修正', 1.15, FORMATIONS.tiangang.mods.dmgTaken);
check('F3', '阵型', '六丁阵修正', { def: 1.18, spd: 0.95, dmgTaken: 0.8 },
  { def: FORMATIONS.liuding.mods.def, spd: FORMATIONS.liuding.mods.spd, dmgTaken: FORMATIONS.liuding.mods.dmgTaken });

// ---------- 技能耗蓝与倍率 ----------
const SKILL_WANT = {
  ruyibang: { mp: 16, mul: 1.8, hit: 0.95, cite: '技能·悟空' },
  huoyan: { mp: 22, cite: '技能·悟空' },
  hengsao: { mp: 20, mul: 1.15, hit: 0.92, cite: '技能·悟空' },
  jiuchipaba: { mp: 16, mul: 1.05, hit: 0.92, cite: '技能·八戒' },
  gongdi: { mp: 18, mul: 0.8, hit: 0.9, cite: '技能·八戒' },
  xiangyaozhang: { mp: 14, mul: 1.35, hit: 0.97, cite: '技能·沙僧' },
  luohanjinshen: { mp: 30, cite: '技能·沙僧' },
  pishuijue: { mp: 24, mul: 1.25, cite: '技能·携宠' },
  jinjing: { mp: 18, cite: '技能·携宠' },
  xuanbing_ji: { mul: 2.0, cite: '七十二变' },
  shenjiang_sao: { mul: 1.3, cite: '七十二变' },
  lieyan_quan: { mul: 1.7, cite: '七十二变' },
};
for (const [key, want] of Object.entries(SKILL_WANT)) {
  const { cite, ...fields } = want;
  for (const [f, v] of Object.entries(fields)) {
    check(`S:${key}.${f}`, cite, `${SKILLS[key].name}·${f}`, v, SKILLS[key][f]);
  }
}
check('S0', '指令', '基础攻击 命中/倍率/耗蓝',
  { hit: 0.95, mul: 1.0, mp: 0 },
  { hit: BASIC_ATTACK.hit, mul: BASIC_ATTACK.mul, mp: BASIC_ATTACK.mp });

// ---------- 我方数值锚点 ----------
const PARTY_WANT = {
  wukong: { base: { hp: 520, mp: 80, atk: 95, def: 55, spd: 88, mag: 60 }, growth: { hp: 62, mp: 4, atk: 10, def: 5, spd: 4, mag: 7 }, crit: 0.15 },
  bajie: { base: { hp: 640, mp: 55, atk: 88, def: 62, spd: 58, mag: 40 }, growth: { hp: 80, mp: 3, atk: 9, def: 7, spd: 3, mag: 4 }, crit: 0.1 },
  sha: { base: { hp: 700, mp: 70, atk: 80, def: 70, spd: 62, mag: 55 }, growth: { hp: 88, mp: 4, atk: 8, def: 8, spd: 3, mag: 6 }, crit: 0.08 },
  pixie: { base: { hp: 560, mp: 90, atk: 78, def: 52, spd: 76, mag: 78 }, growth: { hp: 66, mp: 5, atk: 8, def: 5, spd: 4, mag: 9 }, crit: 0.1 },
};
for (const [key, want] of Object.entries(PARTY_WANT)) {
  check(`P:${key}.base`, '数值锚点', `${PARTY[key].name}·1级基础`, want.base, PARTY[key].base);
  check(`P:${key}.growth`, '数值锚点', `${PARTY[key].name}·每级成长`, want.growth, PARTY[key].growth);
  check(`P:${key}.crit`, '技能各节', `${PARTY[key].name}·暴击率`, want.crit, PARTY[key].crit);
}

// ---------- 敌人锚点 ----------
const ENEMY_HP = { luosha: 980, firemob1: 430, firemob2: 640, niumowang: 1500, whitebull: 1300 };
for (const [key, hp] of Object.entries(ENEMY_HP)) {
  check(`N:${key}.hp`, '敌人表', `${ENEMIES[key].name}·体力`, hp, ENEMIES[key].base.hp);
}
check('N:whitebull.el', '敌人表', '白牛真身·五行', '土', ENEMIES.whitebull.element);
check('N:niu.phase', '多阶段 Boss', '牛魔王·下一阶段', 'whitebull', ENEMIES.niumowang.nextPhase);

// ---------- 七十二变 ----------
const FORM_WANT = {
  shenjiang: { element: '金', turns: 3, mods: { atk: 1.4 } },
  lieyuan: { element: '火', turns: 3, mods: { mag: 1.45 } },
  xuangui: { element: '水', turns: 3, mods: { def: 1.6, spd: 0.8, mag: 1.35 } },
  chongzi: { element: '金', turns: 3, mods: { spd: 1.5, atk: 0.8 } },
};
for (const [key, want] of Object.entries(FORM_WANT)) {
  check(`T:${key}`, '七十二变', `${FORMS[key].name}·五行/回合/修正`,
    want, { element: FORMS[key].element, turns: FORMS[key].turns, mods: FORMS[key].mods });
}
check('T:cost', '七十二变', '七十二变不耗法力(代价为本回合行动)', false, /transform[\s\S]{0,400}?mp\s*-=/.test(engineSource));
check('T:xuangui.extra', '七十二变', '玄甲龟将 被克伤害减半', true, FORMS.xuangui.keShield);
check('T:finisher', '化虫入腹彩蛋', '化虫入腹 触发线', 0.55, BATTLES.luosha.transformFinisher.hpBelow);

// ---------- 防御 / 逃跑 ----------
check('D1', '指令', '防御 回复最大法力比例', 0.05,
  Number((engineSource.match(/defending = true;[\s\S]{0,200}?maxMp \* ([\d.]+)/) || [])[1]));
check('D2', '伤害公式', '防御姿态 受伤系数', 0.5,
  Number((engineSource.match(/defender\.defending\) dmg \*= ([\d.]+)/) || [])[1]));
check('D3', '指令', '非 Boss 战逃跑成功率', 0.7,
  Number((engineSource.match(/chance\(state\.rng, ([\d.]+)\)\) \{\s*\n\s*state\.fled/) || [])[1]));

// ---------- 芭蕉扇 ----------
check('B1', '假扇', '假扇 生效范围为火敌', true,
  /fakefan[\s\S]{0,300}?element === '火'/.test(engineSource));
check('B2', '假扇', '假扇 火敌攻击 +30% / 3 回合', true,
  /fakefan[\s\S]{0,400}?atk_up', val: 0\.3, turns: 3/.test(engineSource));
check('B3', '真扇', '一扇息火 对敌方全体生效(不按五行筛选)', false,
  /fanStage === 1\)[\s\S]{0,300}?element === '火'/.test(engineSource));
check('B4', '真扇', '二扇生风 全队速度 +30% / 3 回合', true,
  /fanStage === 2\)[\s\S]{0,300}?spd_up', val: 0\.3, turns: 3/.test(engineSource));
check('B5', '真扇', '三扇落雨 回血 8% / 3 回合', true,
  /fanStage === 3\)[\s\S]{0,300}?regen', val: 0\.08, turns: 3/.test(engineSource));
check('B6', '真扇', '三扇落雨 对敌方全体生效(不按五行筛选)', false,
  /fanStage === 3\)[\s\S]{0,600}?element === '火'/.test(engineSource));
check('B7', '真扇', '三扇落雨 附带破绽(受伤+40%)', true,
  /fanStage === 3\)[\s\S]{0,600}?vulnerable', val: 0\.4, turns: 3/.test(engineSource));
check('B8', '真扇', '真扇 携带次数上限', 3,
  Number((engineSource.match(/state\.fanStage >= (\d)/) || [])[1]));

// ---------- 成长与法宝 ----------
check('G1', '数值预算表', '每级潜力点', 5, GROWTH.pointsPerLevel);
check('G2', '升级养成', '法术熟练上限', 3, GROWTH.skillRankCap);
check('G3', '升级养成', '定风丹 速度加成', 6, TREASURES.dingfengdan.mods.spd);
check('G4', '升级养成', '避火锦 火伤减免', 0.25, TREASURES.bihuojin.resist['火']);
check('G5', '升级养成', '捕妖绳 血气门槛描述', true, /40%/.test(ITEMS.buyaosheng.desc));

// ---------- 2026-07-28 补记入设计文档的机制(原为未记载的反向漂移) ----------
check('U1', '伤害公式·连击', '连击触发概率 25%', 0.25,
  Number((engineSource.match(/crit && target\.hp > 0 && chance\(state\.rng, ([\d.]+)\)/) || [])[1]));
check('U2', '决战门控', '众神围剿 触发线 / 削血比例 / 防御减益',
  { hpBelow: 0.5, amount: 0.15, def_down: 0.3 },
  { hpBelow: BATTLES.niumowang.godAssist.hpBelow, amount: BATTLES.niumowang.godAssist.amount,
    def_down: BATTLES.niumowang.godAssist.debuff.val });
check('U3', '决战门控', '八戒·土地接力 全队回复比例', 0.3, BATTLES.niumowang.phaseHeal);
check('U4', '决战门控', '白牛狂暴 每回合攻击叠加', 0.08,
  Number((engineSource.match(/defKey === 'whitebull'\)[\s\S]{0,120}?atk_up', val: ([\d.]+)/) || [])[1]));
check('U5', '敌方也在用相克体系', '敌方择敌读五行(不只看血量)', true,
  /function enemyTarget[\s\S]{0,600}?elementRelation/.test(engineSource));

// ---------- 战役结构 ----------
check('C1', '战役流程', '战役战斗场数', 6, CAMPAIGN_BATTLES.length);
check('C2', '结构', 'BATTLES 表中每项都是战斗定义(含 enemies)', [],
  Object.entries(BATTLES).filter(([, v]) => !Array.isArray(v.enemies)).map(([k]) => k));

// ---------- 输出 ----------
const drift = rows.filter((r) => !r.ok);
const lines = [
  '# 关键不变量期望表（独立于实现方自测）',
  '',
  '期望值逐条从 `design/GAME_DESIGN.md` 反向抄出，`文档章节` 列指向该文档的章节名（行号会随编辑腐坏）。',
  '2026-07-28 按数值回写裁决重抄了一遍期望值，回写记录见该文档「验收与最小游玩验证」。',
  '本表由 `qa/design_invariants.mjs` 生成，只读 `js/data.js` 与 `js/engine.js` 的导出，',
  '不引用 `build/app/test/battle.mjs` 的任何断言或常量。',
  '',
  `复跑：\`node qa/design_invariants.mjs\`  ·  结果：${rows.length - drift.length} 一致 / ${drift.length} 漂移`,
  '',
  '## 逐条结果',
  '',
  '| 编号 | 文档章节 | 不变量 | 设计期望 | 实现实际 | 结论 |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.cite} | ${r.item} | \`${r.want}\` | \`${r.got}\` | ${r.ok ? '一致' : '**漂移**'} |`),
  '',
];
const md = lines.join('\n');

console.log(md);
console.log(`\n结果: ${rows.length - drift.length} 一致, ${drift.length} 漂移`);
if (process.argv.includes('--write')) {
  writeFileSync(resolve(HERE, 'evidence/design-invariants.md'), md, 'utf8');
  console.log('已写 qa/evidence/design-invariants.md');
}
process.exit(drift.length ? 1 : 0);
