// 场景枢纽：把战役状态变成场景里的人、阵与任务，处理点人、过阵、支路去处与封妖令。
// 主线剧情本身写在 story.js，这里只负责「找到谁、走到哪」。

import { h } from '../core/dom.js';
import { SCENES, BARKS, BANTER, LANDMARKS } from '../data/maps.js';
import { BOUNTY } from '../data/story.js';
import { createWorld } from '../world/scene.js';
import { createHud } from '../world/hud.js';
import {
  mainQuest, bountyQuest, portalLocked, npcPresent, followers, portalToward, bountyOpen, acceptBounty, reportBounty,
  explore, pendingTeam, pendingPets,
} from '../rules/campaign.js';
import { say, choose, toast, wipe, modalOpen, getDialogueLog } from '../ui/dialogue.js';
import { openMembers, openBag, openQuests, openFormation, openShop, openSettings, openJournal, expLine } from '../ui/panels.js';
import { audio } from '../core/audio.js';

export function createHub(game) {
  const root = h('div.screen.world.hidden', { data: { ui: 'world' } });
  game.stage.append(root);
  let world = null, hud = null, busy = false, travel = null, mounted = false, chatter = 0, barkIdx = 0, frameN = 0;
  const C = () => game.c;

  function mount() {
    if (mounted) return;
    mounted = true;
    world = createWorld(root, {
      onActor, onPortal, onSpot,
      onMove: () => { if (hintLive) { hintLive = false; hud.hint(null); } travelCancelIfManual(); },
      onFrame,
    });
    hud = createHud(root, {
      onTrack: (q) => track(q),
      onIcon: (key) => openIcon(key),
      onMinimap: (x, y) => { if (!busy && !modalOpen()) { travel = null; world.walkTo(x, y); } },
    });
  }
  let hintLive = false, manualGuard = false;
  function travelCancelIfManual() { if (!manualGuard) travel = null; }

  // ---------- 场景里有谁 ----------
  function actorsFor(sceneId) {
    const c = C();
    const quest = mainQuest(c);
    const b = c.bounty;
    const list = [];
    for (const [id, n] of Object.entries(SCENES[sceneId].npcs)) {
      if (!npcPresent(c, sceneId, id)) continue;
      let mark = null;
      if (quest.scene === sceneId && quest.npc === id) mark = '!';
      else if (id === 'tudi' && bountyOpen(c)) mark = b.state === 'report' ? '?' : b.state === 'idle' ? '令' : null;
      list.push({ id, art: n.art, name: n.name, title: n.title, x: n.at[0], y: n.at[1], h: n.h, kind: n.foe ? 'foe' : 'npc', still: !!n.foe, mark });
    }
    if (b.state === 'hunt' && b.demon?.scene === sceneId) list.push({ id: b.demon.id, art: b.demon.art, name: b.demon.name, title: '封妖令', x: b.demon.x, y: b.demon.y, h: 112, kind: 'foe', wander: true, bounty: true });
    return list;
  }

  function questList() {
    const c = C();
    const main = mainQuest(c, world?.sceneId);
    const list = [{ id: 'main', ...main }];
    const side = bountyQuest(c);
    if (side) list.push({ id: 'bounty', side: true, ...side });
    return list;
  }

  function refresh() {
    if (!world?.sceneId) return;
    const c = C();
    const scene = SCENES[world.sceneId];
    world.setActors(actorsFor(scene.id));
    world.setPortals(Object.entries(scene.portals).map(([id, p]) => ({ id, to: p.to, x: p.at[0], y: p.at[1], label: p.label, locked: !!portalLocked(c, p.to) })));
    world.setSpots(Object.entries(scene.landmarks ?? {}).map(([id, s]) => ({ id, name: s.name, x: s.at[0], y: s.at[1], done: !!c.explored[id] })));
    hud.quests(questList());
    hud.hero(expLine(c));
    hud.dots({ hero: pendingTeam(c), pet: pendingPets(c) });
  }

  function onFrame() {
    frameN += 1;
    if (frameN % 6 === 0) {
      const [x, y] = world.position();
      const scene = SCENES[world.sceneId];
      hud.place(scene.region, scene.name, x, y);
      world.drawMinimap(hud.mapCanvas);
      root.dataset.scene = world.sceneId; root.dataset.x = x; root.dataset.y = y; root.dataset.moving = world.moving ? '1' : '0';
    }
    // 闲话：隔一阵有人说一句
    chatter += 1;
    if (chatter > 60 * 9 && !busy && !modalOpen()) {
      chatter = 0;
      const sceneId = world.sceneId;
      if (barkIdx % 2 === 0) {
        const pool = BANTER.filter((x) => (!x.scenes || x.scenes.includes(sceneId)) && followers(C()).includes(x.who));
        if (pool.length) { const line = pool[(barkIdx / 2) % pool.length | 0]; world.say(`f-${line.who}`, line.text); }
      } else {
        const ids = Object.keys(SCENES[sceneId].npcs).filter((id) => BARKS[id] && npcPresent(C(), sceneId, id));
        if (ids.length) { const id = ids[barkIdx % ids.length]; world.say(id, BARKS[id][(barkIdx >> 1) % BARKS[id].length]); }
      }
      barkIdx += 1;
    }
  }

  // ---------- 进出场景 ----------
  async function enter(sceneId, { at = null, fade = false } = {}) {
    mount();
    const c = C();
    root.classList.remove('hidden');
    hud.show(true);
    root.dataset.ready = '0';
    await world.enter(sceneId, { at: at ?? (c.world.scene === sceneId && c.world.x != null ? [c.world.x, c.world.y] : null), party: followers(c) });
    c.world = { scene: sceneId, x: world.position()[0], y: world.position()[1] };
    refresh();
    world.lock(false);
    world.start();
    audio.music(SCENES[sceneId].music);
    root.dataset.ready = '1';
    busy = false;
    if (fade) await wipe('open');
    if (travel) continueTravel();
  }
  function leave() {
    if (!mounted) return;
    remember();
    world.pause();
    root.classList.add('hidden');
  }
  function remember() {
    if (world?.sceneId) { const [x, y] = world.position(); C().world = { scene: world.sceneId, x, y }; }
  }

  // 做一段剧情：锁住行走，做完按战役状态刷新场景
  async function run(fn) {
    if (busy) return;
    busy = true; travel = null;
    world.lock(true); world.stop();
    hud.hint(null); hud.flash(false); hintLive = false;
    try { await fn(); } finally {
      busy = false;
      if (!root.classList.contains('hidden')) { world.lock(false); refresh(); }
    }
  }

  // ---------- 点人 ----------
  async function npcMenu(a, options) {
    const line = BARKS[a.id]?.[(barkIdx += 1) % BARKS[a.id].length] ?? '';
    return choose({ title: a.name, sub: options.text ?? line, options: [...options.list, { key: 'bye', label: '告辞' }], id: 'npc-menu' });
  }

  function onActor(a) {
    if (busy || modalOpen()) return;
    const c = C();
    const sceneId = world.sceneId;
    const quest = mainQuest(c);
    if (a.bounty) return run(() => game.story.bountyFight());
    if (quest.scene === sceneId && quest.npc === a.id) return run(() => game.story.main());
    if (a.id === 'tudi') return run(() => tudiMenu(a));
    if (a.id === 'gaoshao' || a.id === 'laozhe') return run(async () => {
      const pick = await npcMenu(a, { list: [{ key: 'shop', label: a.id === 'gaoshao' ? '买丹药与捕妖绳' : '买兵器护甲' }] });
      if (pick === 'shop') { await openShop(c, a.id, { onChange: () => { game.save(); refresh(); } }); }
    });
    const lines = BARKS[a.id];
    world.say(a.id, lines ? lines[(barkIdx += 1) % lines.length] : '……');
    return null;
  }

  async function tudiMenu(a) {
    const c = C();
    if (!bountyOpen(c)) { await say([{ who: 'tudi', text: c.stage === 'ask' ? '大圣，有话请讲。' : '芭蕉洞从庄南的山路上去。大圣记着，先开口借，莫一上来便动棒。' }]); return; }
    const b = c.bounty;
    if (b.state === 'hunt') { await say([{ who: 'tudi', text: BOUNTY.hunting }]); return; }
    if (b.state === 'report') { reportBounty(c); game.log('封妖回报：土地记下了这一环。', true); }
    const pick = await npcMenu(a, { text: b.total > 0 ? BOUNTY.report : BOUNTY.offer, list: [{ key: 'take', label: '接下封妖令', note: '除游走火妖，得历练银两' }] });
    if (pick === 'take') {
      const demon = acceptBounty(c);
      if (demon) { audio.sfx('quest'); toast(`封妖令：${SCENES[demon.scene].name}有${demon.name}作乱`); game.log(`接下封妖令：去${SCENES[demon.scene].name}收服${demon.name}。`, true); }
    }
    game.save();
  }

  // ---------- 过阵与支路 ----------
  async function onPortal(p) {
    if (busy || modalOpen()) return;
    const locked = portalLocked(C(), p.to);
    if (locked) { world.say('hero', locked); travel = null; return; }
    const keep = travel;
    busy = true; world.lock(true);
    audio.sfx('portal');
    const from = world.sceneId;
    await wipe('close');
    travel = keep;
    await enter(p.to, { at: SCENES[p.to].arrivals[from] ?? SCENES[p.to].spawn, fade: true });
    game.log(`来到${SCENES[p.to].region} · ${SCENES[p.to].name}。`);
    game.save();
  }

  function onSpot(s) {
    if (busy || modalOpen()) return null;
    return run(async () => {
      const c = C();
      const def = LANDMARKS[s.id];
      if (c.explored[s.id]) { world.say('hero', def.revisit); return; }
      if (def.options.length === 1) {
        const done = explore(c, world.sceneId, s.id, def.options[0].key);
        if (!done) return;
        audio.sfx('quest');
        await say([{ who: null, text: `${def.intro} ${done.result}` }]);
        game.log(`见闻：${def.title}。`, true);
        game.save();
        return;
      }
      const pick = await choose({ title: def.title, sub: def.intro, options: [...def.options.map((o) => ({ key: o.key, label: o.label })), { key: 'later', label: '先不动' }], id: 'landmark' });
      if (pick === 'later') return;
      const done = explore(c, world.sceneId, s.id, pick);
      if (!done) return;
      audio.sfx('coin');
      toast(done.result, 'good');
      game.log(`见闻：${def.title} — ${done.result}`, true);
      game.save();
    });
  }

  // ---------- 自动寻路（可跨图） ----------
  function track(q) {
    if (busy || modalOpen() || !q.scene) return;
    travel = { scene: q.scene, npc: q.npc };
    audio.sfx('click');
    continueTravel();
  }
  function continueTravel() {
    if (!travel || busy) return;
    const here = world.sceneId;
    manualGuard = true;
    if (travel.scene !== here) {
      const via = portalToward(here, travel.scene);
      const p = SCENES[here].portals[via];
      const locked = portalLocked(C(), p.to);
      if (locked) { world.say('hero', locked); travel = null; manualGuard = false; return; }
      world.approach(p.at[0], p.at[1], () => onPortal({ to: p.to, x: p.at[0], y: p.at[1] }), 40);
    } else {
      const a = travel.npc ? world.actor(travel.npc) : null;
      travel = null;
      if (a) world.chase(a, () => onActor(a));
    }
    manualGuard = false;
  }

  function openIcon(key) {
    if (busy || modalOpen()) return;
    const c = C();
    const onChange = () => { game.save(); refresh(); };
    world.lock(true);
    const p = key === 'hero' ? openMembers(c, { onChange }) : key === 'pet' ? openMembers(c, { pets: true, onChange })
      : key === 'bag' ? openBag(c, { onChange }) : key === 'quest' ? openQuests(c, world.sceneId, { onTrack: (q) => setTimeout(() => track(q), 0) })
        : key === 'formation' ? openFormation(c, { onChange }) : key === 'journal' ? openJournal(hud.getLogs(), getDialogueLog())
          : openSettings({ inGame: true, onSave: () => { remember(); game.save(); }, onTitle: () => { remember(); game.save(); game.toTitle(); }, onApply: () => game.applySettings() });
    p.then(() => { if (!busy) world.lock(false); refresh(); });
  }

  return {
    enter, leave, refresh, run, track, remember,
    get sceneId() { return world?.sceneId ?? null; },
    get busy() { return busy; },
    say: (id, text) => world?.say(id, text),
    log: (text, sys) => hud?.log(text, sys),
    firstMinute() { hud.flash(true); },
    probe: () => ({ ...(world?.probe() ?? {}), busy, hidden: root.classList.contains('hidden') }),
    destroy() { world?.destroy(); hud?.destroy(); root.remove(); },
  };
}
