// 战役状态与战斗之外的规则：主线阶段、成长、银两、封妖令、探索落账。纯逻辑，Node 可测。

import { PARTY, GROWTH, POINT_GAINS, SKILLS, EQUIPS, ITEMS, ECONOMY, TREASURES, BATTLES } from '../data/combat.js';
import { SCENES, LANDMARKS } from '../data/maps.js';
import { learnedSkills } from './battle.js';
import { createRNG, chance } from '../core/rng.js';

export const SAVE_VERSION = 1;
export const STAGES = ['ask', 'borrow1', 'borrow2', 'tryfan', 'firemap', 'moyun', 'niu', 'descend', 'done'];
export const TEAM = ['wukong', 'bajie', 'sha'];
const stageIndex = (c) => STAGES.indexOf(c.stage);
export const reached = (c, stage) => stageIndex(c) >= STAGES.indexOf(stage);

export function newCampaign(seed) {
  return {
    version: SAVE_VERSION, seed: seed >>> 0, stage: 'ask', flags: {},
    levels: { wukong: 1, bajie: 1, sha: 1 }, storyLevel: 1, exp: 0, money: 100,
    alloc: {}, skillLevels: {}, points: {}, skillPoints: {},
    gear: {}, equipBag: {}, treasure: null, pets: [], formation: 'tiangang',
    items: {},
    bounty: { round: 1, ring: 0, state: 'idle', demon: null, total: 0 },
    explored: {}, hunt: null, wins: 0, attempts: {},
    world: { scene: 'village', x: null, y: null },
  };
}

// ---------- 主线 ----------
const QUESTS = {
  ask: { title: '问路土地', text: '往土地庙寻土地问路', scene: 'village', npc: 'tudi' },
  borrow1: { title: '一借芭蕉扇', text: '庄南山路上翠云山', here: '芭蕉洞前寻罗刹女', scene: 'cuiyun', npc: 'luosha' },
  borrow2: { title: '二借芭蕉扇', text: '携宝再上翠云山', here: '洞前再寻罗刹女', scene: 'cuiyun', npc: 'luosha' },
  tryfan: { title: '火焰山试扇', text: '往东北火口寻土地', here: '火口边寻土地', scene: 'huokou', npc: 'tudi' },
  firemap: { title: '火脉残图', text: '往火口寻土地启图', here: '火口寻土地启图', scene: 'huokou', npc: 'tudi' },
  moyun: { title: '上积雷山', text: '庄东山道上摩云洞', here: '摩云洞前通名', scene: 'jilei', npc: 'yumian' },
  niu: { title: '会一会老牛', text: '往摩云洞会牛魔王', here: '洞门前会牛魔王', scene: 'jilei', npc: 'niumowang' },
  descend: { title: '携扇下山', text: '下翠云山返火焰山', here: '山道前迎上八戒', scene: 'cuiyun', npc: 'fakeBajie' },
  done: { title: '火息路开', text: '火灭雨落，继续西行', scene: 'village', npc: null },
};

export function mainQuest(c, hereScene = null) {
  const q = QUESTS[c.stage];
  return { ...q, text: hereScene === q.scene && q.here ? q.here : q.text };
}

export function portalLocked(c, to) {
  if (to === 'huokou' && !reached(c, 'tryfan')) return '火口去不得，先把芭蕉扇借到手。';
  if (to === 'jilei' && !reached(c, 'moyun')) return '摩云洞还早，火口那边的事还没了。';
  return null;
}

export function npcPresent(c, sceneId, id) {
  if (sceneId === 'cuiyun' && id === 'luosha') return c.stage !== 'descend' && c.stage !== 'done';
  if (sceneId === 'cuiyun' && id === 'fakeBajie') return c.stage === 'descend';
  if (sceneId === 'huokou' && id === 'tudi') return reached(c, 'tryfan');
  if (sceneId === 'jilei' && id === 'yumian') return c.stage === 'moyun';
  if (sceneId === 'jilei' && id === 'niumowang') return c.stage === 'niu';
  // 把门的两名妖将在摩云洞前一战已被打退；会牛魔王时随他出洞的是另一名（在战斗里登场）
  if (sceneId === 'jilei' && id.startsWith('guard')) return c.stage === 'moyun';
  return true;
}

// 下山遇「八戒」时，真八戒留在师父身边
export const followers = (c) => (c.stage === 'descend' ? [] : ['tang', 'bajie', 'sha']);

// 去另一张图该走哪个传送阵：村子是枢纽
export function portalToward(from, to) {
  if (from === to) return null;
  const portals = SCENES[from].portals;
  return portals[to] ? to : 'village';
}

// ---------- 成长 ----------
export const expToNext = (level) => ECONOMY.expBase * level;
export const levelCap = (c) => c.storyLevel + 1;
const members = (c) => [...TEAM, ...c.pets.map((p) => p.key)];

function levelUp(c, keys) {
  const ups = {};
  for (const key of keys) {
    const def = PARTY[key];
    const before = c.levels[key] ?? 1;
    c.levels[key] = before + 1;
    c.points[key] = (c.points[key] ?? 0) + GROWTH.pointsPerLevel;
    c.skillPoints[key] = (c.skillPoints[key] ?? 0) + GROWTH.skillPointsPerLevel;
    const had = learnedSkills(def, before);
    ups[key] = { level: before + 1, newSkills: learnedSkills(def, before + 1).filter((s) => !had.includes(s)) };
  }
  return ups;
}

// 剧情战：全队升一级，封妖的等级上限随之放开
export function storyLevelUp(c) {
  c.storyLevel += 1;
  c.money += ECONOMY.storyMoney;
  return levelUp(c, members(c));
}

// 封妖历练：满条升级，但不超过剧情等级 +1
export function grantExp(c, amount) {
  const ups = {};
  c.exp += Math.max(0, Math.round(amount));
  for (;;) {
    const lv = c.levels.wukong;
    const need = expToNext(lv);
    if (lv >= levelCap(c)) { c.exp = Math.min(c.exp, need); return { ups, capped: true }; }
    if (c.exp < need) return { ups, capped: false };
    c.exp -= need;
    Object.assign(ups, levelUp(c, members(c).filter((k) => (c.levels[k] ?? 1) < levelCap(c))));
  }
}

export const pendingGrowth = (c, key) => (c.points[key] ?? 0) + (c.skillPoints[key] ?? 0);
export const pendingTeam = (c) => TEAM.reduce((n, k) => n + pendingGrowth(c, k), 0);
export const pendingPets = (c) => c.pets.reduce((n, p) => n + pendingGrowth(c, p.key), 0);

export function addPoint(c, key, stat, delta = 1) {
  const cur = c.alloc[key]?.[stat] ?? 0;
  if (!POINT_GAINS[stat]) return false;
  if (delta > 0 && ((c.points[key] ?? 0) <= 0 || cur >= GROWTH.statCap)) return false;
  if (delta < 0 && cur <= 0) return false;
  c.alloc[key] = { ...c.alloc[key], [stat]: cur + delta };
  c.points[key] = (c.points[key] ?? 0) - delta;
  return true;
}

export function recommendPoints(c, key) {
  const weights = Object.entries(PARTY[key].recommend ?? { 攻: 1 }).sort((a, b) => b[1] - a[1]);
  const total = weights.reduce((n, [, w]) => n + w, 0);
  let used = 0;
  for (let guard = 0; (c.points[key] ?? 0) > 0 && guard < 200; guard += 1) {
    // 每次补给「离目标比例差得最多」的那一项，结果确定
    const spent = weights.reduce((n, [s]) => n + (c.alloc[key]?.[s] ?? 0), 0) + 1;
    const [stat] = weights.reduce((best, w) => {
      const gap = (w[1] / total) * spent - (c.alloc[key]?.[w[0]] ?? 0);
      return gap > best[2] ? [w[0], w[1], gap] : best;
    }, [weights[0][0], weights[0][1], -Infinity]);
    if (!addPoint(c, key, stat)) break;
    used += 1;
  }
  return used;
}

export const skillRank = (c, key, skillId) => c.skillLevels[key]?.[skillId] ?? 1;

function raiseSkill(c, key, skillId) {
  if (!learnedSkills(PARTY[key], c.levels[key] ?? 1).includes(skillId)) return false;
  const cur = skillRank(c, key, skillId);
  if (cur >= GROWTH.skillRankCap) return false;
  c.skillLevels[key] = { ...c.skillLevels[key], [skillId]: cur + 1 };
  return true;
}

export function trainSkill(c, key, skillId) {
  if ((c.skillPoints[key] ?? 0) <= 0 || !raiseSkill(c, key, skillId)) return false;
  c.skillPoints[key] -= 1;
  return true;
}

export const studyCost = (rank) => ECONOMY.studyCost[rank + 1] ?? null;
export function studySkill(c, key, skillId) {
  const cost = studyCost(skillRank(c, key, skillId));
  if (cost == null || c.money < cost || !raiseSkill(c, key, skillId)) return false;
  c.money -= cost;
  return true;
}

export function recommendSkills(c, key) {
  const def = PARTY[key];
  const prefer = (def.recommend?.灵 ?? 0) > (def.recommend?.攻 ?? 0) ? 'mag' : 'phy';
  const score = (id) => (SKILLS[id].kind === prefer ? 1000 : 0) + (SKILLS[id].mul ?? 0) * 100 + (SKILLS[id].heal ?? 0) * 50;
  let used = 0;
  while ((c.skillPoints[key] ?? 0) > 0) {
    const pool = learnedSkills(def, c.levels[key] ?? 1).filter((id) => skillRank(c, key, id) < GROWTH.skillRankCap);
    if (!pool.length) break;
    pool.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
    if (!trainSkill(c, key, pool[0])) break;
    used += 1;
  }
  return used;
}

// ---------- 物品、装备、商店 ----------
export function addLoot(c, { money = 0, items = {}, equips = [] } = {}) {
  c.money += money;
  for (const [k, n] of Object.entries(items)) c.items[k] = (c.items[k] ?? 0) + n;
  for (const k of equips) c.equipBag[k] = (c.equipBag[k] ?? 0) + 1;
}

export function buy(c, good) {
  if (c.money < good.price) return false;
  c.money -= good.price;
  addLoot(c, good.item ? { items: { [good.item]: 1 } } : { equips: [good.equip] });
  return true;
}

export const gearOf = (c, key) => [c.gear[key]?.weapon, c.gear[key]?.armor].filter(Boolean);

export function equip(c, key, equipKey) {
  const eq = EQUIPS[equipKey];
  if (!eq || !(c.equipBag[equipKey] > 0) || (eq.only && eq.only !== key)) return false;
  const old = c.gear[key]?.[eq.slot];
  c.equipBag[equipKey] -= 1;
  if (old) c.equipBag[old] = (c.equipBag[old] ?? 0) + 1;
  c.gear[key] = { ...c.gear[key], [eq.slot]: equipKey };
  return true;
}

export function unequip(c, key, slot) {
  const old = c.gear[key]?.[slot];
  if (!old) return false;
  c.equipBag[old] = (c.equipBag[old] ?? 0) + 1;
  c.gear[key] = { ...c.gear[key], [slot]: null };
  return true;
}

// 道具在界面上的名字：假扇没被识破前只叫「芭蕉扇」
export function itemLabel(c, key) {
  const item = ITEMS[key];
  if (key === 'fakefan' && c.flags.fakeFanKnown) return { name: item.knownName, desc: item.knownDesc };
  return { name: item.name, desc: item.desc };
}

// ---------- 召唤兽 ----------
export const activePet = (c) => c.pets.find((p) => p.active) ?? null;

export function addPet(c, key, { activate = false } = {}) {
  if (c.pets.some((p) => p.key === key)) return false;
  c.levels[key] = Math.max(1, c.levels.wukong - (key === 'pixie' ? 0 : 1));
  c.pets.push({ key, active: false });
  if (activate || c.pets.length === 1) setActivePet(c, key);
  return true;
}

export function setActivePet(c, key) {
  for (const p of c.pets) p.active = p.key === key;
}

export function releasePet(c, key) {
  const i = c.pets.findIndex((p) => p.key === key);
  if (i < 0) return false;
  for (const slot of ['weapon', 'armor']) unequip(c, key, slot);
  const wasActive = c.pets[i].active;
  c.pets.splice(i, 1);
  if (wasActive && c.pets[0]) c.pets[0].active = true;
  return true;
}

// ---------- 进战斗 ----------
export function battleParty(c) {
  const keys = [...TEAM];
  const pet = activePet(c);
  if (pet) keys.push(pet.key);
  return keys.map((key) => ({ key, level: c.levels[key] ?? 1, alloc: c.alloc[key], equip: gearOf(c, key), skillLevels: c.skillLevels[key] }));
}

export function battleItems(c, battleId) {
  const items = { ...c.items };
  delete items.truefan;
  if (BATTLES[battleId].boss) items.truefan = 3;
  return items;
}

export function battleSeed(c, battleId, salt = 0) {
  const n = c.attempts[battleId] ?? 0;
  let h = c.seed ^ (salt * 2654435761);
  for (const ch of battleId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h + n * 7919) >>> 0;
}

// 战后把用掉的消耗品记回行囊；芭蕉扇由剧情管，不在这里增减
export function settleBattle(c, state) {
  c.attempts[state.battleId] = (c.attempts[state.battleId] ?? 0) + 1;
  if (state.fakeFanUsed) c.flags.fakeFanKnown = true;
  if (state.winner === 'enemy') return [];
  for (const [k, n] of Object.entries(state.items)) {
    if (k === 'fakefan' || k === 'truefan') continue;
    c.items[k] = n;
  }
  c.formation = state.formation;
  const joined = [];
  if (state.winner === 'party') for (const key of state.caught) if (addPet(c, key)) joined.push(key);
  return joined;
}

// ---------- 封妖令 ----------
export const bountyOpen = (c) => reached(c, 'borrow2') && c.stage !== 'done';
const bountyScene = (c) => (reached(c, 'tryfan') ? 'huokou' : 'village');

export function acceptBounty(c) {
  const b = c.bounty;
  if (!bountyOpen(c) || b.state !== 'idle') return null;
  const sceneId = bountyScene(c);
  const rng = createRNG((c.seed + 7000 + b.round * 97 + b.ring * 13 + b.total * 31) >>> 0);
  const spots = SCENES[sceneId].demonSpawns;
  const [x, y] = spots[Math.floor(rng() * spots.length)];
  const strong = b.ring % 3 === 2;
  b.demon = {
    id: `demon-${b.total}`, scene: sceneId, x, y, strong,
    battle: strong ? 'bounty_b' : 'bounty_a', art: strong ? 'mob_fire2' : 'mob_fire1', name: strong ? '火炎小校' : '炉砖火妖',
    seed: Math.floor(rng() * 1e9),
  };
  b.state = 'hunt';
  return b.demon;
}

export function bountyReward(c) {
  const b = c.bounty;
  const rng = createRNG(b.demon.seed);
  const ring = b.ring + 1;
  const reward = { exp: Math.round(expToNext(c.levels.wukong) * ECONOMY.bountyExpPct), money: ECONOMY.bountyMoney[0] + ECONOMY.bountyMoney[1] * ring, items: {}, equips: [] };
  for (const drop of ECONOMY.bountyDrops) {
    if (!chance(rng, drop.p)) continue;
    if (drop.item) reward.items[drop.item] = (reward.items[drop.item] ?? 0) + 1; else reward.equips.push(drop.equip);
  }
  if (ring >= ECONOMY.bountyRing && !reward.equips.length) reward.equips.push(b.round % 2 ? 'bintie' : 'xipijia');
  return reward;
}

// 打赢明雷：当场落账，等回报土地再领下一环
export function winBounty(c) {
  const b = c.bounty;
  if (b.state !== 'hunt') return null;
  const reward = bountyReward(c);
  const { ups, capped } = grantExp(c, reward.exp);
  addLoot(c, reward);
  b.ring += 1; b.total += 1; b.demon = null; b.state = 'report';
  const roundDone = b.ring >= ECONOMY.bountyRing;
  if (roundDone) { b.ring = 0; b.round += 1; }
  return { reward, ups, capped, roundDone };
}

export function reportBounty(c) {
  if (c.bounty.state !== 'report') return false;
  c.bounty.state = 'idle';
  return true;
}

export function bountyQuest(c) {
  if (!bountyOpen(c)) return null;
  const b = c.bounty;
  const count = `${b.ring + (b.state === 'report' ? 0 : 1)}/${ECONOMY.bountyRing}`;
  if (b.state === 'hunt') return { title: `封妖 ${count}`, text: `${SCENES[b.demon.scene].name}除${b.demon.name}`, scene: b.demon.scene, npc: b.demon.id };
  if (b.state === 'report') return { title: '封妖 · 复命', text: '回土地庙复命', scene: bountyScene(c), npc: 'tudi' };
  return { title: '封妖令', text: '寻土地领令除火妖', scene: bountyScene(c), npc: 'tudi' };
}

// ---------- 支路探索 ----------
export function explore(c, sceneId, id, choiceKey) {
  const def = LANDMARKS[id];
  if (!def || def.scene !== sceneId || c.explored[id]) return null;
  const choice = def.options.find((o) => o.key === choiceKey);
  if (!choice) return null;
  c.explored[id] = choiceKey;
  addLoot(c, choice.reward);
  return choice;
}

// ---------- 主线各节点的落账 ----------
export const story = {
  // 问过土地：得他相赠的丹药与捕妖绳
  askedTudi(c) {
    if (c.stage !== 'ask') return;
    addLoot(c, { items: { jinchuang: 2, falidan: 1, buyaosheng: 2 } });
    c.stage = 'borrow1';
  },
  setApproach(c, key) { c.flags.approach = key; },
  // 一借被吹飞：虽未取胜也有所得，随后灵吉授宝
  blownAway(c) { return storyLevelUp(c); },
  chooseTreasure(c, key) {
    if (!TREASURES[key]) return false;
    c.treasure = key;
    if (c.stage === 'borrow1') c.stage = 'borrow2';
    return true;
  },
  // 二借得手：拿到的其实是假扇
  gotFan(c) {
    const ups = storyLevelUp(c);
    c.wins += 1;
    addLoot(c, { items: { fakefan: 1, jinchuang: 1 } });
    c.stage = 'tryfan';
    return ups;
  },
  setFanTrial(c, key) { c.flags.fanTrial = key; delete c.items.fakefan; c.flags.fakeFanKnown = true; },
  firemobsWon(c, caughtNow) {
    const ups = storyLevelUp(c);
    c.wins += 1;
    delete c.items.fakefan;
    if (caughtNow) c.flags.dealPending = true;
    c.stage = 'firemap';
    return ups;
  },
  setDeal(c, key) {
    c.flags.deal = key;
    delete c.flags.dealPending;
    if (key === 'release') releasePet(c, 'huobao');
  },
  huntDone(c, result) {
    addLoot(c, { items: result.items });
    c.points[result.guide] = (c.points[result.guide] ?? 0) + result.potential;
    c.skillPoints[result.guide] = (c.skillPoints[result.guide] ?? 0) + result.skillPoint;
    c.hunt = { guide: result.guide, deepened: result.deepened, forced: result.forced, clueUsed: result.clueUsed, relics: result.relics };
    c.stage = 'moyun';
  },
  yumianWon(c) { c.wins += 1; return storyLevelUp(c); },
  chooseLoot(c, key) {
    if (c.flags.loot || !EQUIPS[key]) return false;
    c.flags.loot = key;
    addLoot(c, { equips: [key] });
    equip(c, 'wukong', key);
    c.stage = 'niu';
    return true;
  },
  niuLeft(c) { return storyLevelUp(c); },
  // 碧波潭盗兽、变牛魔王骗得真扇
  gotTrueFan(c) {
    addPet(c, 'pixie', { activate: true });
    c.levels.pixie = Math.max(c.levels.pixie ?? 1, c.levels.wukong);
    c.items.truefan = 3;
    c.stage = 'descend';
  },
  setFooled(c, fooled) { c.flags.fooled = fooled ? 'yes' : 'no'; },
  finalWon(c) { c.wins += 1; c.stage = 'done'; },
};

// 带进战斗的剧情开场效果
export function battleSetup(c, battleId) {
  const setup = {};
  if (battleId === 'luosha1' && c.flags.approach) setup.approach = c.flags.approach;
  if (battleId === 'firemobs' && c.flags.fanTrial) setup.fanTrial = c.flags.fanTrial;
  if (battleId === 'niumowang' && c.flags.fooled) setup.fooled = c.flags.fooled;
  return setup;
}

// 结局里回读这一路的做法
export function endingEchoes(c) {
  const lines = [];
  if (c.treasure) lines.push(`灵吉所授的${TREASURES[c.treasure].name}，一路护到了积雷山。`);
  if (c.hunt) {
    const who = PARTY[c.hunt.guide].name;
    lines.push(`${who}${c.hunt.forced ? '在妖气合围前护住了外层所得' : c.hunt.deepened ? '带队探进了火脉深处' : '见好便收，保住了退路'}。`);
  }
  if (c.flags.deal === 'keep') lines.push('那只肯收住野性的赤焰火妖，随队走到了火根断绝。');
  else if (c.flags.deal === 'release') lines.push(c.hunt?.clueUsed ? '放归的火妖指过一条冷砖退路，替师徒避开了一次妖气。' : '悟空解绳放归了火妖；它指的那条冷砖退路，终究没用上。');
  lines.push(c.flags.fooled === 'yes' ? '悟空也被老牛的变化骗回过一局，又从失扇处把真扇追了回来。' : '悟空多问了一句话，当场识破了老牛变的假八戒。');
  if (c.flags.approach) lines.push(c.flags.approach === 'calm' ? '头一回上芭蕉洞，他站着听完了罗刹女的怨话。' : '头一回上芭蕉洞，他没等话说完便抢先动了棒。');
  return lines.slice(0, 4);
}
