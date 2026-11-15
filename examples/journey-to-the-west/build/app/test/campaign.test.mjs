// 战役与战外规则回归：主线落账、成长、封妖令、探索、寻宝、存档往返。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCampaign, story, STAGES, mainQuest, portalLocked, npcPresent, followers, portalToward, levelCap, grantExp, expToNext,
  addPoint, recommendPoints, trainSkill, studySkill, recommendSkills, skillRank, equip, unequip, gearOf, buy, itemLabel, addPet, activePet,
  releasePet, battleParty, battleItems, battleSeed, battleSetup, settleBattle, bountyOpen, acceptBounty, winBounty, reportBounty, bountyQuest,
  explore, endingEchoes, pendingTeam, addLoot, TEAM,
} from '../js/rules/campaign.js';
import { createBattle, beginRound, resolveRound, alive, learnedSkills } from '../js/rules/battle.js';
import { GROWTH, ECONOMY, PARTY, EQUIPS, SHOPS } from '../js/data/combat.js';
import { createHunt, dig, atFork, settleSafe, goDeep, deepDone, finishDeep, view, HUNT } from '../js/rules/treasure.js';
import { LANDMARKS } from '../js/data/maps.js';

// 不经界面把主线走到指定阶段
function advance(c, to) {
  const steps = {
    ask: () => story.askedTudi(c),
    borrow1: () => { story.setApproach(c, 'calm'); story.blownAway(c); story.chooseTreasure(c, 'dingfengdan'); },
    borrow2: () => story.gotFan(c),
    tryfan: () => { story.setFanTrial(c, 'ember'); story.firemobsWon(c, false); },
    firemap: () => story.huntDone(c, { guide: 'wukong', items: { jinchuang: 1 }, relics: 1, potential: 1, skillPoint: 0, deepened: false, forced: false, clueUsed: false }),
    moyun: () => { story.yumianWon(c); story.chooseLoot(c, 'suozijia'); },
    niu: () => { story.niuLeft(c); story.gotTrueFan(c); },
    descend: () => { story.setFooled(c, false); story.finalWon(c); },
  };
  while (c.stage !== to) steps[c.stage]();
  return c;
}

test('主线九个阶段依次推进，决战前恰好升到六级，法术全部解锁', () => {
  const c = newCampaign(42);
  const seen = [c.stage];
  while (c.stage !== 'done') { advance(c, STAGES[STAGES.indexOf(c.stage) + 1]); seen.push(c.stage); }
  assert.deepEqual(seen, STAGES);
  assert.equal(c.levels.wukong, 6);
  assert.equal(c.storyLevel, 6);
  assert.equal(c.wins, 4);
  assert.deepEqual(learnedSkills(PARTY.wukong, 6), ['ruyibang', 'huoyan', 'hengsao', 'qitian', 'zhenhai', 'douzhan']);
  assert.equal(activePet(c).key, 'pixie');
  assert.equal(c.levels.pixie, 6);
  assert.equal(c.items.truefan, 3);
});

test('开局空手，问过土地才得丹药与捕妖绳；任务文案在目的地换成就地的说法', () => {
  const c = newCampaign(1);
  assert.deepEqual(c.items, {});
  assert.equal(mainQuest(c).npc, 'tudi');
  story.askedTudi(c);
  assert.deepEqual(c.items, { jinchuang: 2, falidan: 1, buyaosheng: 2 });
  assert.equal(mainQuest(c).scene, 'cuiyun');
  assert.notEqual(mainQuest(c, 'cuiyun').text, mainQuest(c, 'village').text);
});

test('没到时候的路走不通：火口要先借到扇，积雷山要先了结火口', () => {
  const c = newCampaign(1);
  assert.ok(portalLocked(c, 'huokou'));
  assert.ok(portalLocked(c, 'jilei'));
  assert.equal(portalLocked(c, 'cuiyun'), null);
  advance(c, 'tryfan');
  assert.equal(portalLocked(c, 'huokou'), null);
  assert.ok(portalLocked(c, 'jilei'));
  advance(c, 'moyun');
  assert.equal(portalLocked(c, 'jilei'), null);
  assert.equal(portalToward('cuiyun', 'jilei'), 'village');
  assert.equal(portalToward('village', 'jilei'), 'jilei');
});

test('谁在场：牛魔王在玉面公主败后才出洞；下山时真八戒不跟着，山道上站着另一个「八戒」', () => {
  const c = advance(newCampaign(1), 'moyun');
  assert.equal(npcPresent(c, 'jilei', 'yumian'), true);
  assert.equal(npcPresent(c, 'jilei', 'niumowang'), false);
  advance(c, 'niu');
  assert.equal(npcPresent(c, 'jilei', 'niumowang'), true);
  assert.deepEqual(followers(c), ['tang', 'bajie', 'sha']);
  advance(c, 'descend');
  assert.deepEqual(followers(c), []);
  assert.equal(npcPresent(c, 'cuiyun', 'fakeBajie'), true);
  assert.equal(npcPresent(c, 'cuiyun', 'luosha'), false);
});

test('成长：每级五点潜力一点修炼；加点可退；修炼与研习同受三重上限', () => {
  const c = advance(newCampaign(1), 'borrow2');
  assert.equal(c.points.wukong, GROWTH.pointsPerLevel);
  assert.equal(c.skillPoints.wukong, 1);
  assert.equal(pendingTeam(c), 18);
  assert.equal(addPoint(c, 'wukong', '攻'), true);
  assert.equal(addPoint(c, 'wukong', '攻', -1), true);
  assert.equal(addPoint(c, 'wukong', '攻', -1), false);
  assert.equal(recommendPoints(c, 'wukong'), 5);
  assert.equal(c.points.wukong, 0);
  assert.deepEqual(c.alloc.wukong, { 攻: 2, 速: 1, 体: 1, 灵: 1 });
  assert.equal(trainSkill(c, 'wukong', 'zhenhai'), false, '没学会的不能修');
  assert.equal(trainSkill(c, 'wukong', 'ruyibang'), true);
  assert.equal(trainSkill(c, 'wukong', 'ruyibang'), false, '点数用完');
  c.money = 2000;
  assert.equal(studySkill(c, 'wukong', 'ruyibang'), true);
  assert.equal(c.money, 2000 - ECONOMY.studyCost[3]);
  assert.equal(skillRank(c, 'wukong', 'ruyibang'), 3);
  assert.equal(studySkill(c, 'wukong', 'ruyibang'), false, '三重封顶');
  c.skillPoints.bajie = 3;
  assert.equal(recommendSkills(c, 'bajie'), 2, '只有一门法术，修到三重为止');
});

test('封妖令：借过一回扇才开；历练最多领先剧情一级；十环另赠二阶兵甲', () => {
  const c = advance(newCampaign(9), 'borrow1');
  assert.equal(bountyOpen(c), false);
  advance(c, 'borrow2');
  assert.equal(bountyOpen(c), true);
  assert.equal(bountyQuest(c).npc, 'tudi');
  const cap = levelCap(c);
  let equips = 0;
  for (let i = 0; i < 12; i += 1) {
    const demon = acceptBounty(c);
    assert.ok(demon, `第 ${i + 1} 环应能接下`);
    assert.equal(demon.scene, 'village');
    assert.equal(acceptBounty(c), null, '手上有令时不能再接');
    assert.equal(bountyQuest(c).npc, demon.id);
    const out = winBounty(c);
    equips += out.reward.equips.length;
    if (i === 9) { assert.equal(out.roundDone, true); assert.ok(out.reward.equips.length >= 1); }
    assert.equal(c.bounty.state, 'report');
    assert.equal(reportBounty(c), true);
  }
  assert.equal(c.levels.wukong, cap);
  assert.equal(c.exp, expToNext(cap), '封顶后历练停在满条');
  assert.equal(c.bounty.round, 2);
  assert.ok(equips >= 1);
  advance(c, 'tryfan');
  assert.equal(acceptBounty(c).scene, 'huokou');
  assert.equal(c.levels.wukong, cap + 1, '剧情战照样再升一级');
});

test('装备与商店：钱不够买不成；专属装只有悟空能穿；换装时旧件回背囊', () => {
  const c = advance(newCampaign(1), 'borrow2');
  const sword = SHOPS.laozhe.goods[0];
  c.money = sword.price - 1;
  assert.equal(buy(c, sword), false);
  c.money = 1000;
  assert.equal(buy(c, sword), true);
  assert.equal(equip(c, 'bajie', 'jingtie'), true);
  assert.deepEqual(gearOf(c, 'bajie'), ['jingtie']);
  addLoot(c, { equips: ['bintie', 'suozijia'] });
  assert.equal(equip(c, 'bajie', 'suozijia'), false);
  assert.equal(equip(c, 'wukong', 'suozijia'), true);
  assert.equal(equip(c, 'bajie', 'bintie'), true);
  assert.equal(c.equipBag.jingtie, 1);
  assert.equal(unequip(c, 'bajie', 'weapon'), true);
  assert.deepEqual(gearOf(c, 'bajie'), []);
  const party = battleParty(c);
  assert.deepEqual(party.find((p) => p.key === 'wukong').equip, ['suozijia']);
  assert.ok(EQUIPS.suozijia.only);
});

test('假扇：识破之前背囊里只叫芭蕉扇；真扇只带进决战', () => {
  const c = advance(newCampaign(1), 'tryfan');
  assert.equal(c.items.fakefan, 1);
  assert.equal(itemLabel(c, 'fakefan').name, '芭蕉扇');
  assert.ok(!/假|伪/.test(itemLabel(c, 'fakefan').desc));
  const st = createBattle({ battleId: 'bounty_a', party: battleParty(c), items: battleItems(c, 'bounty_a'), seed: 3, enemyLevel: 2 });
  beginRound(st);
  resolveRound(st, { p0: { type: 'item', itemId: 'fakefan' } });
  settleBattle(c, st);
  assert.equal(c.flags.fakeFanKnown, true);
  assert.equal(itemLabel(c, 'fakefan').name, '假芭蕉扇');
  assert.equal(c.items.fakefan, 1, '剧情道具不因战斗增减');
  advance(c, 'descend');
  assert.equal(battleItems(c, 'bounty_a').truefan, undefined);
  assert.equal(battleItems(c, 'niumowang').truefan, 3);
});

test('战后落账：败北不扣药、换种子；得胜扣掉用过的药并带回收服的火妖', () => {
  const c = advance(newCampaign(5), 'tryfan');
  story.setFanTrial(c, 'ember');
  const seed1 = battleSeed(c, 'firemobs');
  const lost = createBattle({ battleId: 'firemobs', party: battleParty(c), items: battleItems(c, 'firemobs'), seed: seed1 });
  lost.items.jinchuang = 0; lost.over = true; lost.winner = 'enemy';
  settleBattle(c, lost);
  assert.equal(c.items.jinchuang, 3);
  assert.notEqual(battleSeed(c, 'firemobs'), seed1);
  const won = createBattle({ battleId: 'firemobs', party: battleParty(c), items: battleItems(c, 'firemobs'), seed: 2 });
  won.items.jinchuang = 1; won.caught = ['huobao']; won.over = true; won.winner = 'party'; won.formation = 'liuding';
  assert.deepEqual(settleBattle(c, won), ['huobao']);
  assert.equal(c.items.jinchuang, 1);
  assert.equal(c.formation, 'liuding');
  assert.equal(activePet(c).key, 'huobao');
  assert.equal(battleParty(c).length, 4);
  assert.deepEqual(battleSetup(c, 'firemobs'), { fanTrial: 'ember' });
});

test('火妖留放：放归则离队、装备退回，并换得残图外层的一次避险', () => {
  const c = advance(newCampaign(1), 'tryfan');
  addPet(c, 'huobao');
  addLoot(c, { equips: ['jingtie'] });
  equip(c, 'huobao', 'jingtie');
  story.setFanTrial(c, 'full');
  story.firemobsWon(c, true);
  assert.equal(c.flags.dealPending, true);
  story.setDeal(c, 'release');
  assert.equal(c.pets.length, 0);
  assert.equal(c.equipBag.jingtie, 1);
  assert.equal(releasePet(c, 'huobao'), false);
  const hunt = createHunt(7, 'bajie', { clue: true });
  assert.equal(view(hunt).clueReady, true);
});

test('支路去处：每处只落账一次，换图或乱填都不算', () => {
  const c = newCampaign(1);
  assert.equal(Object.keys(LANDMARKS).length, 8);
  assert.equal(explore(c, 'cuiyun', 'village_well', 'jinchuang'), null);
  assert.equal(explore(c, 'village', 'village_well', 'nope'), null);
  assert.ok(explore(c, 'village', 'village_well', 'jinchuang'));
  assert.equal(c.items.jinchuang, 1);
  assert.equal(explore(c, 'village', 'village_well', 'falidan'), null);
  assert.ok(explore(c, 'jilei', 'jilei_camp', 'money'));
  assert.equal(c.money, 120);
});

test('火脉残图：同种子同地脉；收手得避火符，深入成功得大还丹与修炼，妖气满格只丢深处所得', () => {
  const a = createHunt(260, 'wukong'), b = createHunt(260, 'wukong');
  assert.deepEqual(a.tiles, b.tiles);
  assert.equal(view(a).tiles.every((t) => !t.open && t.kind === null), true, '未掘只露五行');

  const safe = createHunt(260, 'sha');
  let i = 0;
  while (!atFork(safe)) { dig(safe, i); i += 1; }
  assert.equal(safe.digs.outer, HUNT.outerDigs);
  const r1 = settleSafe(safe);
  assert.equal(r1.items.bihuofu, 1);
  assert.equal(r1.items.dahuandan, undefined);
  assert.equal(r1.skillPoint, 0);

  // 悟空探路：避开火眼金睛标出的两处妖穴。四十个种子里既要见到深探成功，也要见到被逼退
  let deepWins = 0, retreats = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const h = createHunt(seed, seed % 2 ? 'wukong' : 'bajie');
    for (let k = 0; k < 9 && !atFork(h); k += 1) dig(h, k);
    const kept = { ...h.carried };
    const keptRelics = h.carriedRelics;
    goDeep(h);
    const v = view(h);
    if (h.guide === 'wukong') assert.equal(v.tiles.filter((t) => t.marked).length, 2, '火眼金睛认出两处妖穴');
    else assert.equal(v.tiles.filter((t) => t.marked).length, 0);
    for (const t of v.tiles.filter((x) => !x.marked)) if (h.status === 'playing' && !deepDone(h)) dig(h, t.index);
    if (h.status === 'playing' && deepDone(h)) {
      const r = finishDeep(h);
      deepWins += 1;
      assert.equal(r.items.dahuandan, 1);
      assert.equal(r.items.bihuofu, undefined);
      assert.equal(r.skillPoint, 1);
      for (const k of Object.keys(kept)) assert.ok(r.items[k] >= kept[k]);
    } else if (h.result?.forced) {
      retreats += 1;
      assert.deepEqual(h.result.items, kept, '外层所得原样保住');
      assert.equal(h.result.relics, keptRelics);
      assert.equal(h.result.skillPoint, 0);
    }
  }
  assert.ok(deepWins >= 10, `深探成功 ${deepWins} 次`);
  assert.ok(retreats >= 1, `被逼退 ${retreats} 次`);
  // 沙僧只挡一次；外层永不逼退
  for (let seed = 1; seed <= 40; seed += 1) {
    const h = createHunt(seed, 'sha');
    for (let k = 0; k < 9 && !atFork(h); k += 1) dig(h, k);
    assert.equal(h.status, 'playing');
    assert.ok(h.threat <= 2);
  }
});

test('结局回读四句以内，说的是这一局真做过的事；存档经 JSON 往返不走样', () => {
  const c = advance(newCampaign(77), 'done');
  const lines = endingEchoes(c);
  assert.ok(lines.length >= 3 && lines.length <= 4);
  assert.ok(lines.some((l) => l.includes('定风丹')));
  assert.ok(lines.some((l) => l.includes('识破')));
  const copy = JSON.parse(JSON.stringify(c));
  assert.deepEqual(copy, c);
  assert.deepEqual(endingEchoes(copy), lines);
  assert.equal(TEAM.length, 3);
});

test('五场剧情战按规则实打：对症指令能一路打到决战', () => {
  const c = newCampaign(42);
  advance(c, 'borrow1');
  const fightOnce = (id) => {
    const st = createBattle({ battleId: id, party: battleParty(c), formation: c.formation, items: battleItems(c, id), seed: battleSeed(c, id), treasure: c.treasure, setup: battleSetup(c, id) });
    for (let n = 0; n < 40 && !st.over; n += 1) {
      beginRound(st);
      if (st.over) break;
      const cmds = {};
      for (const u of alive(st, 'party')) cmds[u.id] = { type: 'auto' };
      resolveRound(st, cmds);
    }
    return st;
  };
  story.setApproach(c, 'rush');
  const first = fightOnce('luosha1');
  assert.equal(first.winner, 'story');
  assert.ok(first.units.find((u) => u.key === 'wukong').buffs !== undefined);
});

test('灵吉授宝的底景是小须弥山专图，不借任何一场战斗或行走场景的背景', async () => {
  const { STORY_BG } = await import('../js/data/story.js');
  const { BATTLES } = await import('../js/data/combat.js');
  const { existsSync } = await import('node:fs');
  const key = STORY_BG.lingji;
  assert.ok(existsSync(new URL(`../assets/bg/${key}.jpg`, import.meta.url)), '底图文件要在');
  const used = new Set(Object.values(BATTLES).map((b) => b.bg));
  assert.ok(!used.has(key), `小须弥山不能和战斗共用 ${key}`);
  assert.notEqual(key, 'cuiyun');
});

test('二借交扇：硬打到罗刹女认输不说化虫入腹的台词，化虫得手才喊「出来」', async () => {
  const { fanHandover } = await import('../js/data/story.js');
  const text = (lines) => lines.map((l) => l.text).join('\n');
  const ko = text(fanHandover(false));
  const belly = text(fanHandover(true));
  for (const w of ['出来', '肚', '腹', '疼死', '叔叔快住手', '蟭蟟虫']) assert.ok(!ko.includes(w), `认输分支不该有「${w}」：${ko}`);
  assert.ok(belly.includes('出来！扇子给你'));
  assert.ok(ko.includes('扇子拿去'));
  // 两条分支都接上同一段交扇，都还得到假扇的伏笔
  for (const t of [ko, belly]) assert.ok(t.includes('手指仍扣着扇柄') && t.includes('扇子借到了'));
});
