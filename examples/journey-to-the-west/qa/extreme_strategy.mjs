// 极端策略验证:qa 契约要求把引擎从界面剥离,用固定种子跑「纯 A / 纯 B / 混合」,
// 比较最终状态与结局,判断设计声明的取舍是否真的存在。
//
// 本文件验证 GAME_DESIGN「支柱一·五行相克成体系」及其**否决现象**:
//   「无视相克全程无脑普攻，也能以相近回合数打通战役」
// 若纯普攻策略能以相近回合数通关，支柱一被证否,按契约记 major 归 design。
//
// 跑法: node qa/extreme_strategy.mjs [--write]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../build/app');

const {
  createBattle, executeRound, aliveUnits, unitSkills, elementRelation, levelUpParty,
} = await import(`${APP}/js/engine.js`);
const { SKILLS, CAMPAIGN_BATTLES, BATTLES, FORMS } = await import(`${APP}/js/data.js`);

const MAX_ROUNDS = 80;

// ---------- 策略 A:无视相克,全程普攻 ----------
// 目标固定取存活敌人的第一个,完全不看五行、不变化、不用道具、不放法术。
function blindCommands(state) {
  const foes = aliveUnits(state, 'enemy');
  const cmds = {};
  for (const u of aliveUnits(state, 'party')) {
    cmds[u.id] = { type: 'attack', targetId: foes[0]?.id };
  }
  return cmds;
}

// ---------- 策略 B:相克优先,用满体系 ----------
// 每个单位优先打自己能克的敌人;悟空在无可克目标时变化成能克场上敌人的形态;
// BOSS 战前三回合依次开真扇三段。
function awareCommands(state, round) {
  const foes = aliveUnits(state, 'enemy');
  const cmds = {};
  const party = aliveUnits(state, 'party');

  // 真扇三段:BOSS 战每回合由第一个存活单位开一次,共三次
  let fanUser = null;
  if (state.def.boss && (state.items?.truefan ?? 0) > 0 && round <= 3) {
    fanUser = party[0];
  }

  for (const u of party) {
    if (fanUser && u.id === fanUser.id) {
      cmds[u.id] = { type: 'item', itemId: 'truefan' };
      continue;
    }
    const ked = foes.filter((f) => elementRelation(u.element, f.element) === 'ke');
    const target = (ked.length ? ked : foes).reduce((a, b) => (a.hp <= b.hp ? a : b));

    // 悟空:场上无可克目标时变化到能克的形态
    if (u.hasTransform && !ked.length && !u.form) {
      const formId = Object.keys(FORMS).find((k) =>
        foes.some((f) => elementRelation(FORMS[k].element, f.element) === 'ke'));
      if (formId) { cmds[u.id] = { type: 'transform', formId }; continue; }
    }

    // 选一个负担得起、且面向该目标的最强单体/群体技
    const skills = unitSkills(u)
      .map((k) => ({ key: k, def: SKILLS[k] }))
      .filter((s) => s.def && s.def.mp <= u.mp && s.def.mul > 0);
    const aoe = skills.filter((s) => s.def.target === 'enemies');
    const single = skills.filter((s) => s.def.target === 'enemy');
    if (foes.length >= 2 && aoe.length) {
      cmds[u.id] = { type: 'skill', skillId: aoe.sort((a, b) => b.def.mul - a.def.mul)[0].key };
    } else if (single.length) {
      cmds[u.id] = {
        type: 'skill',
        skillId: single.sort((a, b) => b.def.mul - a.def.mul)[0].key,
        targetId: target.id,
      };
    } else {
      cmds[u.id] = { type: 'attack', targetId: target.id };
    }
  }
  return cmds;
}

// ---------- 混合:奇数回合用体系,偶数回合普攻 ----------
function mixedCommands(state, round) {
  return round % 2 === 1 ? awareCommands(state, round) : blindCommands(state);
}

// ---------- 全程「自动」:战斗内 aiCommand 代打(玩家全程点「自动」钮的等价物) ----------
function autoCommands(state) {
  const cmds = {};
  for (const u of aliveUnits(state, 'party')) cmds[u.id] = { type: 'auto' };
  return cmds;
}

function playBattle(battleId, party, seed, policy, items) {
  const state = createBattle({ battleId, party, seed, formation: 'tiangang', items: { ...items } });
  let round = 0;
  try {
  while (!state.over && round < MAX_ROUNDS) {
    round += 1;
    executeRound(state, policy(state, round));
  }
  } catch (e) {
    console.error(`CRASH battleId=${battleId} seed=${seed} round=${round} over=${state.over} enemiesAlive=${aliveUnits(state,'enemy').length} partyAlive=${aliveUnits(state,'party').length} lv=${JSON.stringify(party.map(p=>p.level))}`);
    console.error('  ', e.message);
    throw e;
  }
  return { rounds: round, winner: state.over ? state.winner : 'timeout', state };
}

// 战役:每胜一场全员升一级(与 main.js 同口径);storyExit 场次为剧情退出。
function playCampaign(policy, seed) {
  let levels = { wukong: 1, bajie: 1, sha: 1, pixie: 1 };
  const log = [];
  let total = 0;
  for (const battleId of CAMPAIGN_BATTLES) {
    const def = BATTLES[battleId];
    const withPet = battleId !== 'luosha1' && battleId !== 'luosha';
    const party = [
      { key: 'wukong', level: levels.wukong },
      { key: 'bajie', level: levels.bajie },
      { key: 'sha', level: levels.sha },
      ...(withPet ? [{ key: 'pixie', level: levels.pixie }] : []),
    ];
    const items = battleId === 'niumowang' ? { truefan: 3, jinchuang: 2, falidan: 1 }
      : battleId === 'firemobs' ? { fakefan: 1, jinchuang: 2 }
      : { jinchuang: 2, falidan: 1 };
    const r = playBattle(battleId, party, seed, policy, items);
    total += r.rounds;
    log.push({ battleId, name: def.name, rounds: r.rounds, winner: r.winner, scripted: Boolean(def.storyExit) });
    if (r.winner === 'party' || def.storyExit) {
      const ups = levelUpParty(levels);
      levels = Object.fromEntries(Object.entries(levels).map(([k]) => [k, (ups?.[k]?.level ?? levels[k] + 1)]));
    }
    if (r.winner === 'enemy' || r.winner === 'timeout') break;
  }
  return { log, total, cleared: log.every((x) => x.winner === 'party' || x.scripted) && log.length === CAMPAIGN_BATTLES.length };
}

const SEEDS = [42, 7, 101, 2026, 31337];
const POLICIES = [
  ['纯普攻·无视相克', (s, r) => blindCommands(s, r)],
  ['相克优先·用满体系', (s, r) => awareCommands(s, r)],
  ['混合·隔回合切换', (s, r) => mixedCommands(s, r)],
  ['全程自动', (s) => autoCommands(s)],
];

const results = {};
for (const [name, policy] of POLICIES) {
  results[name] = SEEDS.map((seed) => ({ seed, ...playCampaign(policy, seed) }));
}

// ---------- 报告 ----------
const out = [];
out.push('# 极端策略验证（支柱一·五行相克成体系）');
out.push('');
out.push('由 `qa/extreme_strategy.mjs` 生成。引擎从界面剥离直接跑完整战役，');
out.push(`固定种子 ${SEEDS.join(' / ')}，每种策略跑满 ${CAMPAIGN_BATTLES.length} 场。`);
out.push('');
out.push('`GAME_DESIGN` 支柱一的**否决现象**为「无视相克全程无脑普攻，也能以相近回合数打通战役」。');
out.push('');
out.push('## 通关率与总回合');
out.push('');
out.push('| 策略 | 通关种子数 | 总回合（各种子） | 中位总回合 |');
out.push('|---|---|---|---|');
for (const [name] of POLICIES) {
  const rs = results[name];
  const cleared = rs.filter((r) => r.cleared).length;
  const totals = rs.map((r) => (r.cleared ? r.total : null));
  const ok = totals.filter((t) => t !== null).sort((a, b) => a - b);
  const med = ok.length ? ok[Math.floor(ok.length / 2)] : '—';
  out.push(`| ${name} | ${cleared}/${SEEDS.length} | ${totals.map((t) => t ?? '未通关').join(' / ')} | ${med} |`);
}
out.push('');
out.push('## 逐场明细（种子 42）');
out.push('');
out.push('| 战斗 | 纯普攻 | 相克优先 | 混合 | 全程自动 |');
out.push('|---|---|---|---|---|');
const byId = (name) => Object.fromEntries(results[name][0].log.map((x) => [x.battleId, x]));
const a = byId('纯普攻·无视相克'), b = byId('相克优先·用满体系'), c = byId('混合·隔回合切换'), d = byId('全程自动');
for (const id of CAMPAIGN_BATTLES) {
  const f = (x) => (x ? `${x.rounds} 回合 · ${x.winner === 'party' ? '胜' : x.winner === 'enemy' ? '败' : x.winner}` : '未到达');
  out.push(`| ${BATTLES[id].name}${BATTLES[id].storyExit ? '（剧情退出）' : ''} | ${f(a[id])} | ${f(b[id])} | ${f(c[id])} | ${f(d[id])} |`);
}
out.push('');

// ---------- 战场态势聚焦:两场杂兵战「全程自动」的代价 ----------
out.push('## 战场态势：杂兵战「全程自动」的代价');
out.push('');
out.push('两场杂兵战各有一条常驻战场规则：火焰山·火口「地火炙烤」（回合末灼烧我方非水系单位');
out.push('最大体力 4%，水系免疫，避火锦减 25%）、积雷山·摩云洞前「妖将结阵」（双妖将同在，');
out.push('敌方全体防御 +30%，折其一即解）。下表为这五场种子在该两战的逐种子回合数。');
out.push('');
out.push('| 战斗 | 全程自动 | 相克优先·用满体系 | 纯普攻·无视相克 |');
out.push('|---|---|---|---|');
const ruled = {};
for (const id of ['firemobs', 'yumian']) {
  const cell = (name) => {
    const rs = results[name].map((r) => r.log.find((x) => x.battleId === id)).filter(Boolean);
    const rounds = rs.map((x) => x.rounds).sort((x, y) => x - y);
    const med = rounds.length ? rounds[Math.floor(rounds.length / 2)] : null;
    return { text: `${rs.map((x) => x.rounds).join(' / ')}（中位 ${med ?? '—'}）`, med };
  };
  const auto = cell('全程自动'), aware = cell('相克优先·用满体系'), blind = cell('纯普攻·无视相克');
  ruled[id] = { auto: auto.med, aware: aware.med, blind: blind.med };
  out.push(`| ${BATTLES[id].name} | ${auto.text} | ${aware.text} | ${blind.text} |`);
}
out.push('');
if (ruled.firemobs.auto !== null && ruled.firemobs.aware !== null) {
  out.push(`火口一役：全程自动中位 ${ruled.firemobs.auto} 回合，相克优先中位 ${ruled.firemobs.aware} 回合——`
    + `${ruled.firemobs.auto > ruled.firemobs.aware ? '地火炙烤惩罚拖延，自动明显更慢。' : '两者接近，地火压力未拉开差距(如实记录)。'}`);
  out.push(`摩云洞前一役：全程自动中位 ${ruled.yumian.auto} 回合，相克优先中位 ${ruled.yumian.aware} 回合——`
    + `${ruled.yumian.auto > ruled.yumian.aware ? '结阵惩罚不换目标的打法，自动明显更慢。' : '两者接近:结阵减伤在这一场的战役编成下拉不开整回合差(该战约 4 回合即决,如实记录)。'}`);
  out.push('');
}

const blind = results['纯普攻·无视相克'];
const aware = results['相克优先·用满体系'];
const blindCleared = blind.filter((r) => r.cleared).length;
const awareCleared = aware.filter((r) => r.cleared).length;
const blindMed = blind.filter((r) => r.cleared).map((r) => r.total).sort((x, y) => x - y);
const awareMed = aware.filter((r) => r.cleared).map((r) => r.total).sort((x, y) => x - y);
const ratio = blindMed.length && awareMed.length
  ? (blindMed[Math.floor(blindMed.length / 2)] / awareMed[Math.floor(awareMed.length / 2)]) : null;

out.push('## 裁决');
out.push('');
if (blindCleared === 0) {
  out.push(`纯普攻策略 ${SEEDS.length} 个种子**全部未能通关**，相克优先通关 ${awareCleared}/${SEEDS.length}。`);
  out.push('否决现象未发生：无视相克无法打通战役，取舍成立。支柱一**通过**。');
} else if (ratio !== null && ratio < 1.25) {
  out.push(`纯普攻通关 ${blindCleared}/${SEEDS.length}，中位总回合为相克优先的 ${ratio.toFixed(2)} 倍（<1.25）。`);
  out.push('**否决现象发生**：无视相克能以相近回合数通关，支柱一被证否，按 qa 契约记 `major` 归 `design`。');
} else {
  out.push(`纯普攻通关 ${blindCleared}/${SEEDS.length}，中位总回合为相克优先的 ${ratio === null ? '—' : ratio.toFixed(2)} 倍。`);
  out.push('否决现象未发生：无视相克即使能通关也付出显著更多回合，取舍成立。支柱一**通过**。');
}
out.push('');

const md = out.join('\n');
console.log(md);
if (process.argv.includes('--write')) {
  writeFileSync(resolve(HERE, 'evidence/extreme-strategy.md'), md, 'utf8');
  console.log('\n已写 qa/evidence/extreme-strategy.md');
}
