// 主线剧情与交战流程：对白 → 抉择 → 战斗 → 落账 → 回到场景。每一步的状态变化都调用 rules/campaign.js。

import { h, wait } from '../core/dom.js';
import { STORY, CHOICES, CHAPTERS, STORY_BG, fanHandover } from '../data/story.js';
import { BATTLES, PARTY, SKILLS, ITEMS, EQUIPS, TREASURES, ECONOMY } from '../data/combat.js';
import { SCENES } from '../data/maps.js';
import { bgArt, unitArt } from '../data/art.js';
import { createBattle } from '../rules/battle.js';
import {
  story as S, battleParty, battleItems, battleSeed, battleSetup, settleBattle, itemLabel, winBounty, levelCap,
} from '../rules/campaign.js';
import { runBattleView, resultCard } from '../battle/view.js';
import { say, choose, toast, banner, chapterCard, wipe } from '../ui/dialogue.js';
import { runHunt } from './hunt.js';
import { audio } from '../core/audio.js';

export function createStory(game) {
  const C = () => game.c;
  const hub = () => game.hub;

  function backdrop(bg, cls = '') {
    const el = h(`div.screen.backdrop${cls ? `.${cls}` : ''}`, { data: { ui: 'backdrop' }, style: { backgroundImage: `url(${bgArt(bg)})` } });
    game.stage.append(el);
    return el;
  }

  const levelLines = (ups) => {
    const lines = [];
    const lv = Object.values(ups)[0]?.level;
    if (lv) lines.push(['升级', `全队升到 Lv.${lv}，每人得 5 点潜力、1 点修炼`]);
    for (const [key, up] of Object.entries(ups)) if (up.newSkills.length) lines.push(['新法术', `${PARTY[key].name}习得「${up.newSkills.map((s) => SKILLS[s].name).join('」「')}」`]);
    return lines;
  };
  const growthHint = (ups) => (Object.keys(ups).length ? '已得潜力与修炼点，可在【角色】分配。' : null);

  // 打一场。败北可再战或回场景整顿；得胜时先落账再出结算卡。返回 { winner, state, close }
  async function fight(battleId, { tutorial = false, enemyLevel = null, salt = 0, onWin = null, onBeat = null } = {}) {
    const c = C();
    const def = BATTLES[battleId];
    for (;;) {
      await wipe('close');
      hub().leave();
      game.stage.querySelectorAll('.backdrop').forEach((n) => n.remove());
      const state = createBattle({
        battleId, party: battleParty(c), formation: c.formation, items: battleItems(c, battleId), seed: battleSeed(c, battleId, salt),
        treasure: c.treasure, setup: battleSetup(c, battleId), enemyLevel,
      });
      const view = runBattleView(game.stage, { state, labels: (k) => itemLabel(c, k), tutorial, canAutoAll: !def.boss && !def.storyExit, onBeat });
      game.battle = { state, view };
      audio.music(def.music);
      await wipe('open');
      await view.done;
      const joined = settleBattle(c, state);
      const close = () => { view.destroy(); game.battle = null; };
      if (state.winner === 'enemy') {
        const pick = await resultCard({ title: '败北', lost: true, hint: def.retryHint ?? '换个打法再来：看清五行，血少的人先防御或吃药。', buttons: [{ key: 'retry', label: '重整旗鼓，再战' }, { key: 'back', label: '先回去整顿' }] });
        close();
        if (pick === 'retry') continue;
        return { winner: 'enemy', state, close: () => {} };
      }
      if (state.winner === 'party') {
        const extra = onWin ? onWin(state, joined) : { lines: [] };
        const lines = [...(extra.lines ?? [])];
        for (const key of joined) lines.push(['收服', `${PARTY[key].name}入队，可在【召唤兽】里让它上阵`]);
        game.save();
        await resultCard({ title: '此战得胜', lines, hint: extra.hint ?? null, buttons: [{ key: 'ok', label: '继续' }] });
      }
      return { winner: state.winner, state, close, joined };
    }
  }

  // 回到场景：先合上墨圈，再撤掉战场或底景
  const back = async (sceneId, at = null, r = null) => { await wipe('close'); r?.close(); game.stage.querySelectorAll('.backdrop').forEach((n) => n.remove()); await hub().enter(sceneId, { at, fade: true }); };
  const first = (battleId) => !(C().attempts[battleId] > 0);

  // ---------- 各段 ----------
  async function askTudi() {
    const c = C();
    await say(STORY.tudi);
    S.askedTudi(c);
    audio.sfx('quest');
    toast('土地相赠：金疮药 ×2、法力丹 ×1、捕妖绳 ×2', 'good');
    game.log('土地相赠：金疮药 ×2、法力丹 ×1、捕妖绳 ×2。', true);
    game.save();
    banner('一借芭蕉扇', '从庄南的山路上翠云山', 1400);
  }

  async function borrow1() {
    const c = C();
    if (first('luosha1')) {
      await chapterCard(CHAPTERS.c1);
      await say(STORY.luoshaPre1);
    }
    if (!c.flags.approach) {
      S.setApproach(c, await choose({ ...CHOICES.approach, id: 'choice-approach' }));
      game.save();
      await say(c.flags.approach === 'calm' ? STORY.approachCalm : STORY.approachRush);
    }
    const r = await fight('luosha1', { tutorial: true });
    if (r.winner !== 'story') { await back('cuiyun', null, r); return; }
    const ups = S.blownAway(c);
    await say(STORY.blowAway);
    await wipe('close');
    r.close();
    backdrop(STORY_BG.lingji, 'cloud');
    audio.music('title');
    await wipe('open');
    await say(STORY.lingji);
    const pick = await choose({ ...CHOICES.treasure, cols: true, id: 'choice-treasure' });
    S.chooseTreasure(c, pick);
    game.save();
    audio.sfx('levelup');
    await banner('虽未取胜，也有所得', `全队升到 Lv.${ups.wukong.level} · 得法宝${TREASURES[pick].name}`, 1700);
    await back('cuiyun', SCENES.cuiyun.arrivals.village);
    game.log(`灵吉菩萨授${TREASURES[pick].name}。升级得了潜力与修炼点，可在【角色】里分配。`, true);
    game.log('土地开始发封妖令了（可选）：收服火妖，得历练与银两。', true);
    toast('已得潜力与修炼点，点【角色】可加点', 'good');
  }

  async function borrow2() {
    const c = C();
    if (first('luosha')) {
      await chapterCard(CHAPTERS.c2);
      await say(STORY.luoshaPre2[c.treasure] ?? STORY.luoshaPre2.dingfengdan);
      if (c.flags.approach) await say(c.flags.approach === 'calm' ? STORY.recallCalm : STORY.recallRush);
      await say(STORY.wukongPlan);
    }
    let ups = {};
    const r = await fight('luosha', { onWin: () => { ups = S.gotFan(c); return { lines: [...levelLines(ups), ['银两', `+${ECONOMY.storyMoney}`], ['所得', '芭蕉扇 ×1、金疮药 ×1']], hint: growthHint(ups) }; } });
    if (r.winner !== 'party') { await back('cuiyun', null, r); return; }
    await say(fanHandover(r.state.finished));
    await back('village', SCENES.village.arrivals.cuiyun, r);
    game.log('借到芭蕉扇。去东北的火口试扇。', true);
    banner('火焰山试扇', '庄子东北，过传送阵便是火口', 1400);
  }

  async function tryFan() {
    const c = C();
    if (!c.flags.fanTrial) {
      if (c.flags.fakeFanKnown) { S.setFanTrial(c, 'known'); await say(STORY.trialKnown); } else {
        S.setFanTrial(c, await choose({ ...CHOICES.fanTrial, id: 'choice-fantrial' }));
        await say(c.flags.fanTrial === 'ember' ? STORY.trialEmber : STORY.trialFull);
      }
      game.save();
    }
    let ups = {};
    const r = await fight('firemobs', { onWin: (state) => { ups = S.firemobsWon(c, state.caught.includes('huobao')); return { lines: [...levelLines(ups), ['银两', `+${ECONOMY.storyMoney}`]], hint: growthHint(ups) }; } });
    if (r.winner !== 'party') { await back('huokou', null, r); return; }
    await say(STORY.afterFire);
    if (c.flags.fanTrial === 'ember') await say(STORY.afterFireEmber); else if (c.flags.fanTrial === 'full') await say(STORY.afterFireFull);
    await fireMap(r);
  }

  async function fireMap(r = null) {
    const c = C();
    await wipe('close');
    r?.close();
    hub().leave();
    game.stage.querySelectorAll('.backdrop').forEach((n) => n.remove());
    backdrop('huoyan');
    audio.music('overworld');
    await wipe('open');
    if (c.flags.dealPending) {
      const pick = await choose({ ...CHOICES.deal, id: 'choice-deal' });
      S.setDeal(c, pick);
      game.save();
      await say(pick === 'keep' ? STORY.dealKeep : STORY.dealRelease);
    }
    await say(STORY.huntIntro);
    const result = await runHunt(game.stage, { seed: (c.seed + 260) >>> 0, clue: c.flags.deal === 'release' });
    S.huntDone(c, result);
    game.save();
    await say([...(result.forced ? STORY.huntForced : result.deepened ? STORY.huntDeep : STORY.huntSafe),
      { who: null, text: `带回的东西都进了背囊；${result.relics ? `${result.relics} 卷残简化作${PARTY[result.guide].name}的 ${result.potential} 点潜力` : '这一趟没翻到残简'}${result.skillPoint ? '，深处另得一重修炼心得。' : '。'}` }]);
    await back('huokou');
    game.log('火脉旧藏已探。上积雷山摩云洞找牛魔王。', true);
    banner('上积雷山', '从火焰山庄东边的山道上去', 1400);
  }

  async function moyun() {
    const c = C();
    if (first('yumian')) await say(STORY.preYumian);
    let ups = {};
    const r = await fight('yumian', { onWin: () => { ups = S.yumianWon(c); return { lines: [...levelLines(ups), ['银两', `+${ECONOMY.storyMoney}`]], hint: growthHint(ups) }; } });
    if (r.winner !== 'party') { await back('jilei', null, r); return; }
    const pick = await choose({ ...CHOICES.loot, cols: true, id: 'choice-loot' });
    S.chooseLoot(c, pick);
    game.save();
    toast(`悟空换上${EQUIPS[pick].name}（${EQUIPS[pick].desc}）`, 'good');
    await say(STORY.afterYumian);
    await back('jilei', null, r);
    game.log(`摩云洞前得${EQUIPS[pick].name}。牛魔王出洞了。`, true);
  }

  async function niu() {
    const c = C();
    const r = await fight('niu1');
    if (r.winner !== 'story') { await back('jilei', null, r); return; }
    const ups = S.niuLeft(c);
    await say(STORY.niuLeaves);
    await wipe('close');
    r.close();
    await pond();
    S.gotTrueFan(c);
    game.save();
    await wipe('close');
    game.stage.querySelectorAll('.backdrop').forEach((n) => n.remove());
    backdrop('cuiyun');
    await wipe('open');
    await chapterCard(CHAPTERS.c3);
    await say(STORY.trickFan);
    audio.sfx('levelup');
    await banner('真扇到手', `全队升到 Lv.${ups.wukong.level} · 辟水金睛兽入队`, 1700);
    await back('cuiyun', SCENES.cuiyun.arrivals.cave);
    game.log('辟水金睛兽入队（已上阵）。真芭蕉扇到手，决战时在【道具】里用。', true);
    toast('全队与金睛兽有新点数可分配', 'good');
  }

  // 碧波潭：三个短判断，错的那条只演一次，悟空自己改主意
  async function pond() {
    const el = backdrop('bibotan');
    audio.music('title');
    const beast = h('div.prop', { style: { backgroundImage: `url(${unitArt('pixie')})`, left: '64%', height: '40%' } });
    const crab = h('div.prop', { style: { backgroundImage: `url(${unitArt('crab')})`, left: '-20%', height: '26%', bottom: '8%', opacity: 0 } });
    // 悟空本相：开场站在潭边，变螃蟹时隐去，挑开缰绳「现出本相」时出现在金睛兽身旁
    const monkey = h('div.prop', { data: { ui: 'pond-wukong' }, style: { backgroundImage: `url(${unitArt('wukong')})`, left: '34%', height: '46%' } });
    el.append(beast, crab, monkey);
    await wipe('open');
    await say(STORY.pondIntro);
    const a = await choose({ ...CHOICES.pond1, id: 'choice-pond1' });
    if (a !== 'crab') { audio.sfx('thud'); await say(a === 'insect' ? STORY.pondInsect : STORY.pondBrute); }
    audio.sfx('transform');
    monkey.style.opacity = 0;
    crab.style.opacity = 1; crab.style.left = '8%';
    await say(STORY.pondCrab);
    const b = await choose({ ...CHOICES.pond2, id: 'choice-pond2' });
    if (b !== 'shift') { audio.sfx('thud'); await say(STORY.pondRush); }
    crab.style.left = '46%';
    await say(STORY.pondShift);
    audio.sfx('levelup');
    crab.style.opacity = 0; beast.style.transform = 'translateY(-30%) scale(1.15)';
    monkey.style.left = '50%'; monkey.style.opacity = 1;
    await say(STORY.pondSteal);
    await wait(200);
  }

  async function finalBattle() {
    const c = C();
    if (!c.flags.fooled) {
      await say(STORY.meetBajie);
      const pick = await choose({ ...CHOICES.bajie, id: 'choice-bajie' });
      S.setFooled(c, pick === 'give');
      game.save();
      await say(pick === 'give' ? STORY.giveBajie : STORY.checkBajie);
      await chapterCard(CHAPTERS.c4);
      await say(c.flags.fooled === 'yes' ? STORY.finalFooled : STORY.finalKept);
    } else await say([{ who: 'niumowang', text: '泼猴，又来！这回看你还有什么手段！' }]);
    const r = await fight('niumowang', {
      onBeat: (kind) => say(kind === 'phase' ? STORY.phase2 : STORY.assist),
      onWin: () => { S.finalWon(c); return { lines: [['降伏', '白牛伏地，牛魔王罢手']] }; },
    });
    if (r.winner !== 'party') { await back('cuiyun', null, r); return; }
    await say(STORY.surrender);
    await wipe('close');
    r.close();
    game.save();
    await game.ending();
  }

  // 日常封妖：点明处的火妖开打
  async function bountyFight() {
    const c = C();
    const demon = c.bounty.demon;
    if (!demon) return;
    const scene = hub().sceneId;
    let out = null;
    const r = await fight(demon.battle, {
      enemyLevel: c.levels.wukong, salt: c.bounty.total + 1,
      onWin: () => {
        out = winBounty(c);
        const lines = [['历练', out.capped ? `已满上限（Lv.${levelCap(c)}）` : `+${out.reward.exp}`], ['银两', `+${out.reward.money}`]];
        const drops = [...Object.entries(out.reward.items).map(([k, n]) => `${ITEMS[k].name} ×${n}`), ...out.reward.equips.map((k) => EQUIPS[k].name)];
        if (drops.length) lines.push(['掉落', drops.join('、')]);
        lines.push(...levelLines(out.ups));
        if (out.roundDone) lines.push(['十环已满', '土地另赠兵甲一件，已放进背囊']);
        return { lines, hint: growthHint(out.ups) ?? '回报土地，可领下一环。' };
      },
    });
    await back(scene, null, r);
    if (r.winner === 'party') game.log(`封妖得胜：银两 +${out.reward.money}。回报土地可领下一环。`, true);
  }

  const MAIN = { ask: askTudi, borrow1, borrow2, tryfan: tryFan, firemap: fireMap, moyun, niu, descend: finalBattle };
  return {
    main: () => MAIN[C().stage]?.(),
    bountyFight,
    async opening() {
      await say(STORY.prologue);
      hub().firstMinute();
    },
  };
}
