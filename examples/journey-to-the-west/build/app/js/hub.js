// 场景枢纽：把行走场景、HUD、任务(主线/日常封妖)、商店与剧情触发接在一起。
// 主线剧情与战斗仍由 main.js 编排;这里只决定「谁头上有 !、点了谁会发生什么、去哪里」。

import { SCENES, BARKS, PARTY_BANTER, nextPortalToward } from './world.js';
import { runScene } from './overworld.js';
import { createHud, logLine } from './hud.js';
import { el, npcMenu, bigToast, toast, showPanel } from './ui.js';
import { audio } from './audio.js';
import { itemIcon } from './assets.js';
import { TEXT } from './text.js';
import { PARTY, ITEMS, EQUIPS, ECONOMY, SHOPS } from './data.js';
import { unitLevelStats } from './engine.js';
import { expToNext, levelCap, grantExp, bountyReward, applyLoot, buy, goodName } from './progress.js';
import { createRNG } from './rng.js';

const STAGE_ORDER = ['prologue', 'pre_fire', 'treasure_fire', 'pre_yumian', 'pre_niu1', 'pre_boss', 'done'];
const stageAtLeast = (c, s) => STAGE_ORDER.indexOf(c.stage) >= STAGE_ORDER.indexOf(s);

// 主线当前一步：标题、说明、目标场景与 NPC(头上挂「!」)
export function mainStep(c) {
  const s = c.stage;
  if (s === 'prologue' && !c.flags?.tudi) return { title: '问路土地', text: '火焰山挡住西路。到土地庙前，向头顶有「!」的土地打听过山之法。', scene: 'village', actor: 'tudi' };
  // here:人已在目标场景时换一句就地的说法，不再叫人「经村南山路」
  if (s === 'prologue' && !c.luosha1Done) return { title: '一借芭蕉扇', text: '芭蕉扇在翠云山芭蕉洞的罗刹女手里。从村南山路上翠云山。', here: '罗刹女就守在芭蕉洞前，上前好言相借。', scene: 'cuiyun', actor: 'luosha' };
  if (s === 'prologue') return { title: '二借芭蕉扇', text: '得了灵吉菩萨的法宝，再上芭蕉洞找罗刹女。', here: '芭蕉洞前，再向罗刹女借一回扇。', scene: 'cuiyun', actor: 'luosha' };
  if (s === 'pre_fire') return { title: '火焰山试扇', text: '扇子到手。去东北的火焰山火口，土地在那里等着看你扇火。', here: '土地就在火口，过去试扇。', scene: 'huokou', actor: 'tudi' };
  if (s === 'treasure_fire') return { title: '火脉残图', text: '土地拿着火炎校尉掉下的残图，在火口等你。', here: '土地拿着残图等你，过去问问。', scene: 'huokou', actor: 'tudi' };
  if (s === 'pre_yumian') return { title: '寻牛魔王', text: '罗刹女只听牛魔王的。从村东山道上积雷山摩云洞。', here: '摩云洞前有人守门，上前叫阵。', scene: 'jilei', actor: 'yumian' };
  if (s === 'pre_niu1') return { title: '会一会老牛', text: '牛魔王就在摩云洞门前。', scene: 'jilei', actor: 'niumowang' };
  if (s === 'done') return { title: '火息路开', text: '火焰山已熄，师徒继续西行。', scene: 'village', actor: null };
  return { title: '携扇下山', text: '真扇到手。下翠云山回火焰山——路上像是有人来接。', here: '下山路上，有人迎面跑来。', scene: 'cuiyun', actor: 'fakeBajie' };
}

function portalLocked(c, to) {
  if (to === 'huokou') return !stageAtLeast(c, 'pre_fire');
  if (to === 'jilei') return !stageAtLeast(c, 'pre_yumian');
  return false;
}

export function createHub(deps) {
  const { app, fast } = deps;
  const C = () => deps.campaign();
  let ctl = null;
  let hud = null;
  let busy = false;
  let travel = null; // 跨图自动寻路的目标 {scene, actor}
  let barkTimer = 0, banterTimer = 0, speakerIdx = 0, banterIdx = 0;
  const lineIdx = {}; // 每个 NPC 各自的台词游标：轮到谁说话，就说他下一句没说过的
  let hintTimer = 0;

  function nextLine(id) {
    const lines = BARKS[id] ?? ['……'];
    const i = lineIdx[id] ?? 0;
    lineIdx[id] = i + 1;
    return lines[i % lines.length];
  }
  // 说一句：气泡总在;只有省略号的不进聊天频道(免得刷屏)
  function say(id, name, line) {
    ctl.bark(id, line);
    if (line.replace(/[…\.。]/g, '').trim()) logLine('cur', `[${name}] ${line}`);
  }
  function dismissHint() {
    hud?.setHint(null);
    hud?.flashTracker(false);
    hintTimer = 0;
  }

  function ensureHud() {
    if (hud) return;
    hud = createHud(app, {
      onTrack: (q) => goTo(q.target),
      onMinimap: (x, y) => { if (!busy && !document.querySelector('.dlg-box, .modal-mask, .npc-menu, .chapter-card')) { travel = null; ctl?.walkToMinimap(x, y); } },
      collapseTracker: window.innerWidth < 1366,
    });
  }

  // ---------- 日常 · 封妖令 ----------
  function bounty() {
    const c = C();
    c.bounty = c.bounty ?? { ring: 0, round: 1, demon: null, report: false, accepted: false };
    return c.bounty;
  }
  const bountyOpen = () => !!C().luosha1Done;
  const demonScene = () => (stageAtLeast(C(), 'pre_fire') ? 'huokou' : 'village');

  function spawnDemon() {
    const b = bounty();
    const sceneId = demonScene();
    const rng = createRNG((C().seedBase + 7000 + b.round * 97 + b.ring * 13) >>> 0);
    const area = SCENES[sceneId].demonArea ?? [[700, 420], [1250, 760]];
    const x = Math.round(area[0][0] + rng() * (area[1][0] - area[0][0]));
    const y = Math.round(area[0][1] + rng() * (area[1][1] - area[0][1]));
    const strong = b.ring % 3 === 2;
    b.demon = {
      id: `demon${b.round}_${b.ring}`, scene: sceneId, x, y,
      battle: strong ? 'bounty_b' : 'bounty_a',
      unit: strong ? 'mob_fire2' : 'mob_fire1',
      name: strong ? '火炎小校' : '炉砖火妖',
      seed: Math.floor(rng() * 1e9),
    };
    b.accepted = true;
  }

  // ---------- 场景内的人 ----------
  function actorsFor(sceneId) {
    const c = C();
    const step = mainStep(c);
    const b = bounty();
    const list = [];
    for (const [id, n] of Object.entries(SCENES[sceneId].npcs)) {
      if (!npcPresent(sceneId, id, c)) continue;
      list.push({ id, unit: n.unit, name: n.name, title: n.title, x: n.at[0], y: n.at[1], h: n.h, kind: n.demon ? 'demon' : 'npc', mark: null });
    }
    for (const a of list) {
      if (step.scene === sceneId && step.actor === a.id) a.mark = '!';
      else if (a.id === 'tudi' && bountyOpen() && (sceneId === 'village' || b.report)) a.mark = b.report ? '?' : !b.accepted ? '!' : null;
    }
    if (b.demon && b.demon.scene === sceneId) {
      list.push({ id: b.demon.id, unit: b.demon.unit, name: b.demon.name, title: '封妖令', x: b.demon.x, y: b.demon.y, h: 112, kind: 'demon', wander: true, seed: b.demon.seed });
    }
    return list;
  }

  function npcPresent(sceneId, id, c) {
    if (sceneId === 'cuiyun' && id === 'luosha') return c.stage !== 'pre_boss';
    if (sceneId === 'cuiyun' && id === 'fakeBajie') return c.stage === 'pre_boss';
    if (sceneId === 'huokou' && id === 'tudi') return c.stage === 'pre_fire' || c.stage === 'treasure_fire';
    if (sceneId === 'jilei' && id === 'yumian') return c.stage === 'pre_yumian';
    if (sceneId === 'jilei' && id === 'niumowang') return c.stage === 'pre_niu1';
    if (sceneId === 'jilei' && id.startsWith('guard')) return c.stage === 'pre_yumian' || c.stage === 'pre_niu1';
    return true;
  }

  function questList() {
    const c = C();
    const step = mainStep(c);
    const here = ctl?.sceneId === step.scene && step.here;
    const list = [{ id: 'main', kind: '主线', title: step.title, text: here ? step.here : step.text, target: step.actor ? { scene: step.scene, actor: step.actor } : null }];
    if (bountyOpen()) {
      const b = bounty();
      const ringText = `第${b.round}轮 ${Math.min(b.ring + 1, ECONOMY.bountyRing)}/${ECONOMY.bountyRing}`;
      const capNote = (c.levels.wukong ?? 1) >= levelCap(c) ? '(已到本章等级上限，仍得银两与掉落)' : '';
      if (b.demon) {
        // 坐标与左上角小地图同一套(原图像素 / 10)
        const where = `${SCENES[b.demon.scene].name.split(' · ')[1]}(${Math.round(b.demon.x / 10)},${Math.round(b.demon.y / 10)})`;
        list.push({ id: 'bounty', kind: '日常', title: `封妖令 ${ringText}`, text: `${where} 有${b.demon.name}作乱，前去收服。${capNote}`, brief: `【日常】${where}`, target: { scene: b.demon.scene, actor: b.demon.id } });
      } else if (b.report) {
        // 火口的土地也收回报：人在火口就不必跑回村
        const here = ctl?.sceneId;
        const tudiHere = here && SCENES[here].npcs.tudi && npcPresent(here, 'tudi', c);
        const scene = tudiHere ? here : 'village';
        list.push({ id: 'bounty', kind: '日常', title: '封妖令 · 回报', text: `火妖已收，向${scene === 'village' ? '村里' : '火口'}的土地回报，领下一环。`, target: { scene, actor: 'tudi' } });
      } else list.push({ id: 'bounty', kind: '日常', title: '封妖令（可选）', text: `土地在村里发封妖令：收服炉砖里钻出的火妖，得历练、银两和兵甲。${capNote}`, target: { scene: 'village', actor: 'tudi' } });
    }
    return list;
  }

  function refresh() {
    if (!ctl || !hud) return;
    const c = C();
    ctl.setActors(actorsFor(ctl.sceneId));
    ctl.setPortals(Object.entries(SCENES[ctl.sceneId].portals).map(([id, p]) => ({ id, to: p.to, x: p.at[0], y: p.at[1], label: p.label, locked: portalLocked(c, p.to) })));
    const lv = c.levels.wukong ?? 1;
    const st = unitLevelStats(PARTY.wukong, lv, c.alloc.wukong ?? null);
    hud.setHero({ unit: 'wukong', name: '孙悟空', level: lv, hp: st.hp, mp: st.mp, exp: c.exp ?? 0, expNeed: expToNext(lv), capped: lv >= levelCap(c), money: c.money ?? 0 });
    const pet = c.pets.find((p) => p.active);
    if (pet) {
      const plv = c.levels[pet.key] ?? 1;
      const ps = unitLevelStats(PARTY[pet.key], plv, c.alloc[pet.key] ?? null);
      hud.setPet({ unit: PARTY[pet.key].portrait, name: PARTY[pet.key].name, level: plv, hp: ps.hp, mp: ps.mp });
    } else hud.setPet(null);
    hud.setQuests(questList());
    hud.setMap(SCENES[ctl.sceneId].name);
  }

  // ---------- 进场 / 跨图 ----------
  function enter(sceneId, arrival = null) {
    const c = C();
    deps.setPhase('overworld');
    deps.clearScreens();
    ctl?.dispose();
    ensureHud();
    busy = false;
    const scene = SCENES[sceneId];
    const spawn = Array.isArray(arrival) ? arrival : arrival ? scene.arrivals?.[arrival] : null;
    c.world = { scene: sceneId };
    ctl = runScene({
      root: app, sceneId, spawn, fast,
      minimap: hud.minimap,
      onActor: (id) => interact(id),
      onPortal: (id) => usePortal(id),
      onManualMove: () => { travel = null; },
      onFrame: (info) => { hud?.setCoords(info.x, info.y); tick(); },
    });
    refresh();
    audio.playBGM('overworld');
    logLine('sys', `来到 ${scene.name}`);
    if (travel) {
      const t = travel;
      const mine = ctl;
      // 只在同一场景实例上续走：读档/重开换了场景后，旧的寻路目标不再生效
      setTimeout(() => { if (ctl === mine && travel === t) goTo(t); }, fast ? 60 : 350);
    }
    deps.onEnter?.();
    return ctl;
  }

  function goTo(target) {
    if (busy || !ctl || !target || document.querySelector('.dlg-box, .modal-mask, .npc-menu, .chapter-card')) return;
    if (ctl.sceneId === target.scene) {
      travel = null;
      if (!ctl.approachActor(target.actor)) toast(app, '此人眼下不在这里。');
      return;
    }
    const portalId = nextPortalToward(ctl.sceneId, target.scene);
    const portal = SCENES[ctl.sceneId].portals[portalId];
    if (!portal || portalLocked(C(), portal.to)) { toast(app, '这条路还没打听清楚。'); travel = null; return; }
    travel = target;
    ctl.approachPortal(portalId);
  }

  function usePortal(id) {
    const p = SCENES[ctl.sceneId].portals[id];
    if (portalLocked(C(), p.to)) {
      ctl.bark('player', '这条路还没打听清楚，先办眼前的事。');
      travel = null;
      return;
    }
    audio.sfx('portal');
    enter(p.to, p.arrive);
    deps.save(true); // 进场后再存，读档落在新场景
  }

  // ---------- 点人 ----------
  async function interact(id) {
    if (busy || document.querySelector('.dlg-box, .modal-mask, .npc-menu, .chapter-card')) return;
    const c = C();
    const step = mainStep(c);
    const isMain = step.scene === ctl.sceneId && step.actor === id;
    const b = bounty();
    if (b.demon && id === b.demon.id) return fightDemon();
    const npc = SCENES[ctl.sceneId].npcs[id];
    if (!npc) return;
    dismissHint(); // 第一次跟人说上话，行路提示就收起
    if (id === 'tudi' && bountyOpen() && (ctl.sceneId === 'village' || b.report)) return tudiMenu(isMain);
    if (id === 'gaoshao' || id === 'laozhe') return shopMenu(id);
    if (isMain) return runStory(step);
    say(id, npc.name, nextLine(id));
  }

  async function runStory(step) {
    busy = true;
    ctl.setBusy(true);
    travel = null;
    const handler = {
      tudi: ctl.sceneId === 'village' ? deps.story.tudi : C().stage === 'treasure_fire' ? deps.story.treasure : deps.story.fire,
      luosha: deps.story.luosha, yumian: deps.story.yumian, niumowang: deps.story.niu1, fakeBajie: deps.story.fanpian,
    }[step.actor];
    const next = await handler();
    busy = false;
    if (next === 'ending') { dispose(); deps.showEnding(); return; }
    if (next?.scene) enter(next.scene, next.arrival ?? null);
    else { ctl?.setBusy(false); refresh(); }
    deps.save(true);
    const after = mainStep(C());
    // 一个时刻只亮一张提示：这一段的所得并进「任务更新」里
    const reward = next?.reward ?? '';
    if (reward) logLine('sys', reward);
    if (after.title !== step.title) {
      audio.sfx('quest');
      bigToast(app, '任务更新', `【主线】${after.title}`, 'quest', reward);
      logLine('sys', `主线更新：${after.title}`);
    } else if (reward) {
      audio.sfx('quest');
      bigToast(app, '有所得', reward, 'quest');
    }
  }

  async function tudiMenu(isMain) {
    const b = bounty();
    const options = [];
    if (isMain) options.push({ key: 'main', label: mainStep(C()).title });
    if (b.report) options.push({ key: 'report', label: '回报封妖令' });
    else if (!b.accepted) options.push({ key: 'accept', label: `领取封妖令(第${b.ring + 1}环)` });
    options.push({ key: 'chat', label: '打听火焰山的来历' }, { key: 'leave', label: '告辞' });
    busy = true;
    ctl.setBusy(true);
    const pick = await npcMenu(app, { who: 'tudi', name: '土地', text: b.accepted && !b.report ? '那火妖还在作乱，大圣辛苦。' : '炉砖里又钻出火妖来了。大圣若肯出手，小神这里有封妖令，收一只记一环，十环另有重谢。', options });
    busy = false;
    ctl.setBusy(false);
    if (pick === 'main') return runStory(mainStep(C()));
    if (pick === 'chat') say('tudi', '土地', nextLine('tudi'));
    if (pick === 'report') reportBounty();
    if (pick === 'accept') {
      spawnDemon();
      audio.sfx('quest');
      logLine('sys', `接下封妖令：${SCENES[b.demon.scene].name} 的${b.demon.name}`);
      bigToast(app, '接取任务', `【日常】封妖令 第${b.ring + 1}环`, 'quest');
      deps.save(true);
      refresh();
    }
  }

  function reportBounty() {
    const c = C();
    const b = bounty();
    b.report = false;
    b.accepted = false;
    const bonus = 20 + b.ring * 5;
    applyLoot(c, { money: bonus });
    audio.sfx('coin');
    logLine('sys', `回报封妖令，土地另赠银两 ${bonus}`);
    if (b.ring >= ECONOMY.bountyRing) {
      b.ring = 0;
      b.round += 1;
      bigToast(app, '十环圆满', '封妖令满一轮，土地重谢已入囊。', 'quest');
    }
    deps.save(true);
    refresh();
  }

  // ---------- 明雷封妖战 ----------
  async function fightDemon() {
    const c = C();
    const b = bounty();
    const d = b.demon;
    busy = true;
    ctl.setBusy(true);
    travel = null;
    const ringNo = b.ring + 1;
    const reward = bountyReward(c, ringNo, d.seed);
    const lines = [`历练 +${reward.exp}`, `银两 +${reward.money}`];
    for (const [k, n] of Object.entries(reward.items)) lines.push(`${ITEMS[k].name} ×${n}`);
    for (const k of reward.equips) lines.push(`${EQUIPS[k].name}(${EQUIPS[k].desc})`);
    const result = await deps.runBattle(d.battle, 9000 + b.round * 101 + ringNo * 7, {
      enemyLevel: c.levels.wukong ?? 1,
      rewardLevel: false,
      victoryLines: lines,
    });
    if (result.winner === 'party') {
      deps.applyCaught(result.caught);
      const { ups, capped } = grantExp(c, reward.exp);
      applyLoot(c, reward);
      b.ring = ringNo;
      b.demon = null;
      b.report = true;
      logLine('sys', `封妖令第${ringNo}环完成：${lines.join('，')}`);
      deps.save(true);
      enter(ctl.sceneId, [d.x, d.y + 40]);
      audio.sfx('coin');
      if (Object.keys(ups).length) {
        deps.onBountyLevelUp(ups);
        const lv = c.levels.wukong;
        ctl.levelUpFx();
        audio.sfx('levelup');
        bigToast(app, `升级!Lv.${lv}`, '全队境界提升，潜力点与修炼点已发放', 'level');
        logLine('sys', `队伍升到 Lv.${lv}(每人 +5 潜力、+1 修炼)`);
      } else {
        bigToast(app, '任务完成', `封妖令 ${ringNo}/${ECONOMY.bountyRing} · 回村向土地回报`, 'quest');
      }
      if (capped) logLine('sys', `历练已满：本章上限 Lv.${levelCap(c)}，推进主线后可再升级。`);
      refresh();
      return;
    }
    // 逃跑：妖怪还在原地
    enter(ctl.sceneId, [d.x - 120, d.y + 30]);
  }

  // ---------- 商店 ----------
  async function shopMenu(id) {
    const npc = SCENES[ctl.sceneId].npcs[id];
    busy = true;
    ctl.setBusy(true);
    const pick = await npcMenu(app, {
      who: npc.unit, name: npc.name,
      text: id === 'gaoshao' ? '客官，热糕、金疮药、法力丹，打妖怪的都备着！' : '火大铁好打。兵刃护甲，看看哪件趁手。',
      options: [{ key: 'shop', label: id === 'gaoshao' ? '买药' : '看看兵甲' }, { key: 'chat', label: '闲聊' }, { key: 'leave', label: '告辞' }],
    });
    busy = false;
    ctl.setBusy(false);
    if (pick === 'chat') say(id, npc.name, nextLine(id));
    if (pick === 'shop') openShop(id);
  }

  function openShop(id) {
    const shop = SHOPS[id];
    let close = null;
    const render = () => {
      const c = C();
      const nodes = [el('p', 'panel-note', `现有银两 ${c.money ?? 0}。买下的兵甲在【角色】面板换上。`)];
      for (const good of shop.goods) {
        const row = el('div', 'list-row shop-row');
        const desc = good.item ? ITEMS[good.item].desc : `${EQUIPS[good.equip].desc}`;
        const owned = good.item ? (c.items[good.item] ?? 0) : (c.equipBag?.[good.equip] ?? 0);
        row.append(itemIcon(good.item ?? good.equip, { slot: good.equip ? EQUIPS[good.equip].slot : null }), el('span', 'shop-name', goodName(good)), el('span', 'shop-desc', `${desc} · 已有 ${owned}`), el('span', 'shop-price', `${good.price} 两`));
        const btn = el('button', `btn stat-btn wide${(c.money ?? 0) >= good.price ? '' : ' disabled'}`, '购买');
        btn.dataset.buy = good.item ?? good.equip;
        btn.addEventListener('click', () => {
          if (!buy(C(), good)) { toast(app, '银两不够。'); return; }
          audio.sfx('coin');
          logLine('sys', `花费 ${good.price} 两，购得 ${goodName(good)}`);
          deps.save(true);
          close?.();
          render();
          refresh();
        });
        row.appendChild(btn);
        nodes.push(row);
      }
      close = showPanel(app, { id: 'modal-shop', title: shop.title, bodyNodes: nodes });
    };
    render();
  }

  // ---------- 闲话与队伍拌嘴 ----------
  function tick() {
    if (busy || !ctl || document.querySelector('.dlg-box, .modal-mask, .npc-menu')) return;
    hintTimer += 0.12;
    if (hintTimer > 15) dismissHint(); // 行路提示最多挂 15 秒
    barkTimer += 0.12;
    banterTimer += 0.12;
    if (barkTimer > 11) {
      barkTimer = 0;
      const npcs = Object.entries(SCENES[ctl.sceneId].npcs).filter(([id]) => BARKS[id] && npcPresent(ctl.sceneId, id, C()));
      if (npcs.length) {
        const [id, n] = npcs[speakerIdx++ % npcs.length];
        say(id, n.name, nextLine(id));
      }
    }
    if (banterTimer > 29) {
      banterTimer = 0;
      // 拌嘴只挑跟当前场景对得上的(翠云山不说烫脚，火口不说卖糕)
      const pool = PARTY_BANTER.filter((l) => !l.scene || l.scene.includes(ctl.sceneId));
      if (pool.length) {
        const line = pool[banterIdx++ % pool.length];
        ctl.bark(line.who, line.text);
        logLine('team', `[${TEXT.speakers[line.who]}] ${line.text}`);
      }
    }
  }

  function dispose() {
    ctl?.dispose();
    ctl = null;
    hud?.dispose();
    hud = null;
    travel = null;
  }

  return {
    enter,
    refresh,
    dispose,
    goTo,
    cancelTravel: () => { travel = null; ctl?.stopWalking(); },
    setHint: (t) => { hintTimer = 0; hud?.setHint(t); },
    flashTracker: (on) => hud?.flashTracker(on),
    get scene() { return ctl; },
    busy: () => busy,
    screenPos: (id) => ctl?.screenPos(id) ?? null,
    quests: () => questList(),
    sceneId: () => ctl?.sceneId ?? null,
  };
}

