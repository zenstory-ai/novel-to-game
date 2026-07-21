// 入口:标题画面 → 战役流程编排(序幕/战斗1/战斗2/BOSS/结局)、存档读档、顶栏。

import { TEXT } from './text.js';
import { FORMATIONS, BATTLES, PARTY, ITEMS, SKILLS, EQUIPS, TREASURES } from './data.js';
import { audio } from './audio.js';
import { loadAssets, coverURL, bgURL, unitURL } from './assets.js';
import { el, showDialog, showModal, showPanel, toast, buildTopbar, showFormationModal, iconBadge, chapterCard } from './ui.js';
import { unitLevelStats, skillsAtLevel } from './engine.js';
import { settleLevelUp, allocatePoint, applyRecommend } from './growth.js';
import { runBattleScreen } from './battle_ui.js';
import { runOverworld } from './overworld.js';
import { runBibotan } from './bibotan.js';

const SAVE_KEY = 'xiyou_save_v1';
const SAVE_VERSION = 3;
const TUT_KEY = 'xiyou_tut_seen';

const params = new URLSearchParams(location.search);
const FAST = params.get('fast') === '1';
const SEED = params.has('seed') ? Number(params.get('seed')) : (Date.now() % 100000);

const app = document.getElementById('app');
let phase = 'boot'; // title | overworld | battle | ending
let overworldCtl = null;

// ---------- 战役状态 ----------
function newCampaign() {
  return {
    version: SAVE_VERSION,
    stage: 'prologue', // prologue → pre_fire → pre_boss
    levels: { wukong: 1, bajie: 1, sha: 1, pixie: 1 },
    alloc: {}, skillLevels: {}, pendingPoints: {},
    equips: {}, treasure: null,
    pets: [], // [{key, active}]
    petJoined: false,
    formation: 'tiangang',
    items: { jinchuang: 2, falidan: 1, buyaosheng: 2 },
    seedBase: SEED,
    battlesWon: 0,
    chaptersSeen: {}, // 三借章节卡各只亮一次(简报三.1)
  };
}
let campaign = newCampaign();

// 三借章节卡:一借·被骗 / 二借·假扇 / 三借·真扇(递进差异的开场仪式)
async function showChapter(key) {
  campaign.chaptersSeen = campaign.chaptersSeen ?? {};
  if (campaign.chaptersSeen[key]) return;
  campaign.chaptersSeen[key] = true;
  saveGame(true);
  await chapterCard(app, TEXT.story.chapters[key], FAST);
}

function saveGame(silent = false) {
  campaign.version = SAVE_VERSION;
  localStorage.setItem(SAVE_KEY, JSON.stringify(campaign));
  if (!silent) toast(app, TEXT.ui.saved);
}
function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) {
      // 存档版本化:旧档不兼容则引导重开,别崩
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    // 缺字段填默认(前向兼容)
    const base = newCampaign();
    for (const k of Object.keys(base)) if (data[k] === undefined) data[k] = base[k];
    return data;
  } catch {
    return null;
  }
}

// ---------- 面板系统(背包/召唤兽/角色/阵型 复用) ----------
let topbarCtl = null;
let openPanelKey = null;
let closeOpenPanel = null;

function togglePanel(key) {
  if (openPanelKey === key) {
    closeOpenPanel?.();
    return;
  }
  closeOpenPanel?.();
  openPanelKey = key;
  topbarCtl?.setOpen(key);
  const onClose = () => {
    if (openPanelKey === key) {
      openPanelKey = null;
      topbarCtl?.setOpen(null);
    }
  };
  if (key === 'hero') closeOpenPanel = showHeroPanel(onClose);
  else if (key === 'bag') closeOpenPanel = showBagPanel(onClose);
  else if (key === 'pet') closeOpenPanel = showPetPanel(onClose);
  else if (key === 'formation') {
    closeOpenPanel = showFormationModal(app, {
      current: campaign.formation,
      formations: FORMATIONS,
      onPick: (k) => {
        campaign.formation = k;
        closeOpenPanel?.();
        toast(app, `${TEXT.ui.formationNow}:${FORMATIONS[k].name}`);
      },
    });
    const origClose = closeOpenPanel;
    closeOpenPanel = () => { origClose(); onClose(); };
  }
}

const STAT_LABELS = [['体', 'hp'], ['攻', 'atk'], ['防', 'def'], ['速', 'spd'], ['灵', 'mag']];

// 五维加点行:当前值(含加点)+ ＋/－ 木钮
function statCells(key, onChange) {
  const def = PARTY[key];
  const lv = campaign.levels[key] ?? 1;
  const stats = unitLevelStats(def, lv, campaign.alloc[key] ?? null);
  const wrap = el('div', 'hero-stats');
  for (const [label, prop] of STAT_LABELS) {
    const cell = el('span', 'stat-cell');
    cell.append(iconBadge(label, { sm: true }), el('span', '', String(stats[prop])));
    const pending = campaign.pendingPoints[key] ?? 0;
    const invested = campaign.alloc[key]?.[label] ?? 0;
    const plus = el('button', `btn stat-btn${pending > 0 ? '' : ' disabled'}`, '＋');
    plus.dataset.allocPlus = `${key}:${label}`;
    plus.title = pending > 0 ? `投 1 点${label}(剩余 ${pending})` : '没有可用点数';
    plus.addEventListener('click', () => { if (allocatePoint(campaign, key, label, 1)) onChange(); });
    const minus = el('button', `btn stat-btn${invested > 0 ? '' : ' disabled'}`, '－');
    minus.title = invested > 0 ? `洗回 1 点${label}` : '未投点';
    minus.addEventListener('click', () => { if (allocatePoint(campaign, key, label, -1)) onChange(); });
    cell.append(plus, minus);
    wrap.appendChild(cell);
  }
  return wrap;
}

function showHeroPanel(onClose) {
  const rebuild = () => {
    saveGame(true);
    closeOpenPanel?.();
    togglePanel('hero');
  };
  const rows = [];
  for (const key of ['wukong', 'bajie', 'sha']) {
    const def = PARTY[key];
    const lv = campaign.levels[key] ?? 1;
    const row = el('div', 'hero-row');
    const face = el('img', 'hero-face');
    face.src = unitURL(def.portrait, def.name);
    const info = el('div', 'hero-info');
    const nm = el('div', 'hero-name');
    nm.append(iconBadge(def.element, { round: true, sm: true }), el('span', '', def.name));
    nm.append(el('span', 'hero-lv', `Lv.${lv} · ${def.element}属性 · 可用点 ${campaign.pendingPoints[key] ?? 0}`));
    const rec = el('button', `btn stat-btn${(campaign.pendingPoints[key] ?? 0) > 0 ? '' : ' disabled'}`, TEXT.panels.recommend);
    rec.dataset.allocRecommend = key;
    rec.title = '按推荐权重投入全部可用点';
    rec.addEventListener('click', () => { if (applyRecommend(campaign, key) > 0) rebuild(); });
    nm.appendChild(rec);
    info.append(nm, statCells(key, rebuild));
    const eq = campaign.equips[key];
    info.appendChild(el('div', 'panel-note', `武器:${eq ? EQUIPS[eq].name : '——'}`));
    row.append(face, info);
    rows.push(row);
  }
  rows.push(el('p', 'panel-note', '每场胜利 +5 潜力点;熟练随等级自动进阶(威力+6%/级,耗蓝-2)。'));
  return showPanel(app, { id: 'modal-hero', title: TEXT.panels.hero, bodyNodes: rows, onClose });
}

const ITEM_ICONS = { jinchuang: '药', falidan: '丹', fakefan: '扇', truefan: '扇' };

function showBagPanel(onClose) {
  const nodes = [];
  // 法宝位(规则型,1件/全队)
  const trRow = el('div', 'list-row');
  trRow.append(iconBadge('宝', { sm: true }), el('span', '', campaign.treasure
    ? `法宝:${TREASURES[campaign.treasure]?.name ?? campaign.treasure} — ${TREASURES[campaign.treasure]?.desc ?? ''}`
    : '法宝:——(尚未获得)'));
  nodes.push(trRow);
  const grid = el('div', 'bag-grid');
  const owned = Object.entries(campaign.items).filter(([, n]) => n > 0);
  if (owned.length === 0) grid.appendChild(el('div', 'cmd-empty', TEXT.panels.bagEmpty));
  for (const [k, n] of owned) {
    const it = ITEMS[k];
    const cell = el('div', 'bag-item');
    const slot = el('div', 'icon-slot', ITEM_ICONS[k] ?? '物');
    slot.title = it.desc;
    slot.appendChild(el('span', 'slot-count', String(n)));
    cell.append(slot, el('span', 'bag-item-name', it.name));
    grid.appendChild(cell);
  }
  nodes.push(grid);
  for (const [k, n] of owned) {
    if (n <= 0) continue;
    const row = el('div', 'list-row');
    row.append(iconBadge(ITEM_ICONS[k] ?? '物', { sm: true }), el('span', '', `${ITEMS[k].name} ×${n} — ${ITEMS[k].desc}`));
    nodes.push(row);
  }
  return showPanel(app, { id: 'modal-bag', title: TEXT.panels.bag, bodyNodes: nodes, onClose });
}

function showPetPanel(onClose) {
  const rebuild = () => {
    saveGame(true);
    closeOpenPanel?.();
    togglePanel('pet');
  };
  const nodes = [];
  if (campaign.pets.length === 0) {
    nodes.push(el('p', 'panel-note', TEXT.panels.petEmpty));
  } else {
    for (const pet of campaign.pets) {
      const def = PARTY[pet.key];
      const lv = campaign.levels[pet.key] ?? 1;
      const row = el('div', 'hero-row');
      row.dataset.pet = pet.key;
      const face = el('img', 'hero-face');
      face.src = unitURL(def.portrait, def.name);
      const info = el('div', 'hero-info');
      const nm = el('div', 'hero-name');
      nm.append(iconBadge(def.element, { round: true, sm: true }), el('span', '', def.name));
      nm.append(el('span', 'hero-lv', `Lv.${lv} · ${def.element}属性 · 可用点 ${campaign.pendingPoints[pet.key] ?? 0}`));
      const up = el('button', `btn stat-btn${pet.active ? ' disabled' : ''}`, pet.active ? '已上阵' : '上阵');
      up.dataset.petActive = pet.key;
      up.title = pet.active ? '当前上阵召唤兽' : '下次战斗由此召唤兽出战';
      up.addEventListener('click', () => {
        for (const p2 of campaign.pets) p2.active = p2.key === pet.key;
        rebuild();
      });
      nm.appendChild(up);
      info.append(nm, statCells(pet.key, rebuild));
      const skills = el('div', 'panel-note');
      skills.textContent = `技能:${skillsAtLevel(def, lv).map((k) => SKILLS[k].name).join('、')}`;
      info.appendChild(skills);
      row.append(face, info);
      nodes.push(row);
    }
    nodes.push(el('p', 'panel-note', '上阵召唤兽占正式行动位;可在火焰山用捕妖绳收服血气≤40%的火妖。'));
  }
  return showPanel(app, { id: 'modal-pet', title: TEXT.panels.pet, bodyNodes: nodes, onClose });
}

// ---------- 顶栏 ----------
function setupTopbar() {
  topbarCtl = buildTopbar(app, {
    onSave: () => {
      if (phase === 'battle') { toast(app, '战斗中不可存档'); return; }
      saveGame();
    },
    onLoad: () => {
      if (phase === 'battle') { toast(app, '战斗中不可读档'); return; }
      const data = loadGameData();
      if (!data) { toast(app, TEXT.ui.noSave); return; }
      campaign = data;
      toast(app, TEXT.ui.loaded);
      gotoStage();
    },
    onFormation: () => {
      if (phase === 'battle') { toast(app, '战斗中请用战场右上「阵型」按钮'); return; }
      togglePanel('formation');
    },
    onHero: () => togglePanel('hero'),
    onBag: () => togglePanel('bag'),
    onPet: () => togglePanel('pet'),
    onHelp: () => {
      showModal(app, {
        id: 'modal-help',
        title: TEXT.help.title,
        bodyNodes: TEXT.help.body.map((l) => el('p', 'tutorial-line', l)),
        buttons: [{ label: '关闭', id: 'btn-help-close' }],
      });
    },
    onMute: {
      label: () => (audio.muted ? TEXT.topbar.soundOff : TEXT.topbar.soundOn),
      toggle: () => { audio.unlock(); audio.toggleMuted(); },
    },
  });
}

// ---------- 标题画面 ----------
function showTitle() {
  phase = 'title';
  audio.playBGM('title');
  clearScreens();
  const s = el('div', 'screen title-screen');
  s.id = 'title-screen';
  const cover = el('div', 'title-cover');
  const url = coverURL();
  if (url) cover.style.backgroundImage = `url(${url})`;
  else cover.classList.add('fallback');
  const mask = el('div', 'title-mask');
  const logo = el('div', 'title-logo');
  const h1 = el('h1', '', TEXT.gameTitle);
  const sub = el('p', '', TEXT.gameSubtitle);
  logo.append(h1, sub);
  const menu = el('div', 'title-menu');
  const hasSave = !!loadGameData();
  if (hasSave) {
    const bCont = el('button', 'btn title-btn', TEXT.title.cont);
    bCont.id = 'btn-continue';
    bCont.addEventListener('click', () => {
      audio.unlock();
      campaign = loadGameData() ?? newCampaign();
      gotoStage();
    });
    menu.appendChild(bCont);
  }
  const bStart = el('button', 'btn title-btn', TEXT.title.start);
  bStart.id = 'btn-start';
  bStart.addEventListener('click', () => {
    audio.unlock();
    if (hasSave && !window.confirm(TEXT.title.newConfirm)) return;
    campaign = newCampaign();
    saveGame(true);
    gotoStage();
  });
  const bHelp = el('button', 'btn title-btn', TEXT.title.help);
  bHelp.id = 'btn-howto';
  bHelp.addEventListener('click', () => {
    showModal(app, {
      id: 'modal-help',
      title: TEXT.help.title,
      bodyNodes: TEXT.help.body.map((l) => el('p', 'tutorial-line', l)),
      buttons: [{ label: '关闭', id: 'btn-help-close' }],
    });
  });
  menu.append(bStart, bHelp);
  s.append(cover, mask, logo, menu);
  app.appendChild(s);
  // 键盘:↑/↓ 循环选钮,回车确认(简报验收:键盘全流程可通关)
  const tBtns = [...menu.querySelectorAll('button')];
  let tIdx = 0;
  const applyT = (i) => {
    tIdx = ((i % tBtns.length) + tBtns.length) % tBtns.length;
    tBtns.forEach((b) => b.classList.remove('kbd-focus'));
    tBtns[tIdx].classList.add('kbd-focus');
  };
  const onTitleKey = (ev) => {
    if (phase !== 'title' || !s.isConnected) {
      window.removeEventListener('keydown', onTitleKey);
      return;
    }
    if (document.querySelector('.modal-mask, .dlg-box')) return;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { applyT(tIdx - 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { applyT(tIdx + 1); ev.preventDefault(); }
    else if (ev.key === 'Enter' || ev.key === ' ') { tBtns[tIdx]?.click(); ev.preventDefault(); }
  };
  window.addEventListener('keydown', onTitleKey);
  applyT(0);
}

function clearScreens() {
  app.querySelectorAll('.screen, .battle-root, .overworld-root, .ending-root, .dlg-box, .modal-mask').forEach((n) => n.remove());
  overworldCtl = null;
}

function gotoStage() {
  if (campaign.stage === 'prologue') startPrologue();
  else if (campaign.stage === 'pre_fire') startPreFire();
  else if (campaign.stage === 'pre_yumian') startPreYumian();
  else if (campaign.stage === 'pre_niu1') startPreNiu1();
  else startPreBoss();
}

// ---------- 战斗包装(败北重试/逃跑回退) ----------
function buildPartyDefs() {
  const defs = ['wukong', 'bajie', 'sha'].map((key) => ({
    key,
    level: campaign.levels[key] ?? 1,
    alloc: campaign.alloc[key],
    skillLevels: campaign.skillLevels[key],
    equip: campaign.equips[key],
  }));
  const activePet = campaign.pets.find((p) => p.active);
  if (activePet) {
    defs.push({
      key: activePet.key,
      level: campaign.levels[activePet.key] ?? 1,
      alloc: campaign.alloc[activePet.key],
      skillLevels: campaign.skillLevels[activePet.key],
      equip: campaign.equips[activePet.key],
    });
  }
  return defs;
}

async function runBattle(battleId, seedOffset, opts = {}) {
  let attempt = 0;
  for (;;) {
    phase = 'battle';
    audio.playBGM(BATTLES[battleId]?.boss ? 'boss' : 'battle');
    const showTutorial = opts.tutorial && !localStorage.getItem(TUT_KEY);
    const result = await runBattleScreen({
      root: app,
      battleId,
      partyDefs: buildPartyDefs(),
      formation: campaign.formation,
      items: campaign.items,
      treasure: campaign.treasure,
      startDebuff: opts.startDebuff ?? null,
      seed: campaign.seedBase + seedOffset + attempt,
      fast: FAST,
      showTutorial,
      onceCards: opts.onceCards ?? [],
    });
    if (showTutorial) localStorage.setItem(TUT_KEY, '1');
    if (result.winner === 'party') return result;
    if (result.winner === 'flee') return result;
    if (result.winner === 'story') return result; // 剧情桥段(吹飞),非败北
    attempt += 1; // 败北 → 换种子重试
  }
}

function applyLevelUps(ups) {
  for (const [k, v] of Object.entries(ups)) campaign.levels[k] = v.level;
  settleLevelUp(campaign, ups); // 发潜力点+法术熟练(定值,不占战斗 rng)
}

// 捕捉成功的新宝宝入队(一生一次)
function applyCaught(caughtKeys) {
  for (const key of caughtKeys ?? []) {
    if (campaign.pets.some((p) => p.key === key)) continue;
    // 首只宝宝自动上阵;后续手动在召唤兽面板替换
    const firstPet = campaign.pets.length === 0;
    campaign.pets.push({ key, active: firstPet });
    campaign.levels[key] = campaign.levels[key] ?? 2;
  }
}

// ---------- 序幕 ----------
async function startPrologue() {
  phase = 'overworld';
  audio.playBGM('overworld');
  clearScreens();
  let tudiTalked = false;
  // 先建小世界场景(火焰山脚背景+队伍),再把序幕旁白叠在上面
  overworldCtl = runOverworld({
    root: app,
    fast: FAST,
    isTudiTalked: () => tudiTalked,
    onTalkTudi: async () => {
      await showDialog(app, tudiTalked ? TEXT.story.tudiTalkAgain : TEXT.story.tudiTalk);
      tudiTalked = true;
    },
    onReachLuosha: async () => {
      // 一战罗刹女(第3回合被吹飞,剧情)→ 灵吉授定风丹 → 再战取扇
      if (!campaign.luosha1Done) {
        await showChapter('c1'); // 第一借 · 好言相借
        await showDialog(app, TEXT.story.luoshaPre1);
        overworldCtl?.hide();
        const r1 = await runBattle('luosha1', 100, { tutorial: true });
        if (r1.winner === 'flee') {
          overworldCtl?.show();
          overworldCtl?.rearmLuosha();
          return;
        }
        // winner === 'story':被芭蕉扇吹飞(演出);战斗画面留作过场底景
        await showDialog(app, TEXT.story.blowAway);
        await showDialog(app, TEXT.story.lingji);
        campaign.treasure = 'dingfengdan';
        campaign.luosha1Done = true;
        saveGame(true);
        toast(app, '获得法宝 · 定风丹');
        await showChapter('c2'); // 第二借 · 化虫入腹
        await showDialog(app, TEXT.story.luoshaPre2);
      } else {
        await showChapter('c2');
        await showDialog(app, TEXT.story.luoshaPre2);
        overworldCtl?.hide();
      }
      app.querySelectorAll('.battle-root').forEach((n) => n.remove()); // 收掉一战底景
      const r = await runBattle('luosha', 150);
      if (r.winner === 'flee') {
        overworldCtl?.show();
        overworldCtl?.rearmLuosha();
        return;
      }
      applyLevelUps(r.levelUps);
      applyCaught(r.caught);
      campaign.battlesWon += 1;
      campaign.stage = 'pre_fire';
      campaign.items.fakefan = 1;
      campaign.items.jinchuang = (campaign.items.jinchuang ?? 0) + 1;
      saveGame(true);
      await showDialog(app, TEXT.story.postBattle1);
      startPreFire();
    },
  });
  // 序幕旁白叠在小世界之上(模态对话框,场景交互被挡,安全)
  await showDialog(app, TEXT.story.prologueIntro);
}

// ---------- 战斗2 前 ----------
async function startPreFire() {
  phase = 'overworld';
  audio.playBGM('overworld');
  clearScreens();
  await showDialog(app, TEXT.story.preBattle2);
  if (!campaign.items.fakefan) campaign.items.fakefan = 1;
  const r = await runBattle('firemobs', 200, { onceCards: ['fakefan'] });
  applyLevelUps(r.levelUps);
  applyCaught(r.caught);
  campaign.battlesWon += 1;
  campaign.stage = 'pre_yumian';
  delete campaign.items.fakefan;
  saveGame(true);
  await showDialog(app, TEXT.story.postBattle2);
  startPreYumian();
}

// ---------- 批2:摩云洞·玉面公主 → 初战牛魔王 ----------
async function startPreYumian() {
  phase = 'overworld';
  audio.playBGM('overworld');
  clearScreens();
  await showDialog(app, TEXT.story.preYumian);
  await showDialog(app, TEXT.story.yumianPre);
  const r = await runBattle('yumian', 400);
  applyLevelUps(r.levelUps);
  applyCaught(r.caught);
  campaign.battlesWon += 1;
  // 装备首件掉落:如意金箍棒·精
  if (!campaign.equips.wukong) {
    campaign.equips.wukong = 'ruyibang_jing';
    toast(app, '获得装备 · 如意金箍棒·精(悟空 攻+12 暴击+5%)');
  }
  saveGame(true);
  await showDialog(app, TEXT.story.postYumian);
  startPreNiu1();
}

async function startPreNiu1() {
  phase = 'overworld';
  audio.playBGM('overworld');
  clearScreens();
  campaign.stage = 'pre_niu1';
  saveGame(true);
  // 初战牛魔王:第3回合赴宴而走(剧情)
  const r = await runBattle('niu1', 500);
  if (r.winner !== 'story') {
    // 意外速胜也按剧情推进(不屈)
  }
  await showDialog(app, TEXT.story.niu1Retreat);
  // 碧波潭:变螃蟹偷金睛兽
  await runBibotan(app, { fast: FAST });
  if (!campaign.pets.some((p) => p.key === 'pixie')) {
    campaign.pets.push({ key: 'pixie', active: !campaign.pets.some((p) => p.active) });
  }
  campaign.petJoined = true;
  campaign.levels.pixie = campaign.levels.pixie ?? Math.max(2, (campaign.levels.wukong ?? 2) - 1);
  saveGame(true);
  toast(app, '辟水金睛兽加入召唤兽!');
  // 变牛魔王骗真扇
  await showChapter('c3'); // 第三借 · 智取真扇
  await showDialog(app, TEXT.story.pianzhen);
  campaign.items.truefan = 3;
  campaign.stage = 'pre_boss';
  saveGame(true);
  toast(app, '获得 芭蕉扇(真)×3');
  startPreBoss();
}

// ---------- BOSS 前 ----------
async function startPreBoss() {
  phase = 'overworld';
  audio.playBGM('overworld');
  clearScreens();
  campaign.petJoined = true;
  if (!campaign.items.truefan) campaign.items.truefan = 3;
  // 牛魔王变假八戒反骗(演出;识破与否影响开局)
  await showDialog(app, TEXT.story.fanpian1);
  campaign.fanFooled = false;
  await new Promise((resolve) => {
    showModal(app, {
      id: 'modal-choice',
      title: TEXT.story.fanpianChoice.title,
      bodyNodes: [],
      buttons: TEXT.story.fanpianChoice.options.map((o) => ({
        label: o.label,
        id: `choice-${o.key}`,
        onClick: () => {
          campaign.fanFooled = o.key === 'give';
          resolve();
        },
      })),
    });
  });
  await showDialog(app, campaign.fanFooled ? TEXT.story.fanpianGive : TEXT.story.fanpianCheck);
  await showDialog(app, TEXT.story.preBattle3);
  const startDebuff = campaign.fanFooled
    ? { unit: 'p0', buff: { id: 'atk_down', val: 0.15, turns: 1 } }
    : null;
  const r = await runBattle('niumowang', 300, { onceCards: ['truefan'], startDebuff });
  applyLevelUps(r.levelUps);
  applyCaught(r.caught);
  campaign.battlesWon += 1;
  saveGame(true);
  showEnding();
}

// ---------- 结局(降伏→真扇三段→四十九扇→还扇西行) ----------
async function showEnding() {
  phase = 'ending';
  audio.playBGM('ending');
  clearScreens();
  const wrap = el('div', 'ending-root');
  wrap.id = 'ending-root';
  const bg = bgURL('cuiyun');
  if (bg) {
    wrap.style.backgroundImage = `linear-gradient(rgba(20,34,44,0.52), rgba(20,34,44,0.38)), url(${bg})`;
    wrap.style.backgroundSize = 'cover';
    wrap.style.backgroundPosition = 'center';
  }
  app.appendChild(wrap);
  const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.max(30, ms * 0.2) : ms));
  const E = TEXT.story.ending;

  // 降伏:众神协助+罗刹女交扇
  await showDialog(app, [...TEXT.story.godAssistDialog, E[0], E[1]]);
  // 真扇三段演出(一息火、二生风、三落雨)
  for (let i = 0; i < 3; i++) {
    audio.sfx(`fan${i + 1}`);
    const banner = el('div', 'fan-stage', E[2 + i].text);
    wrap.appendChild(banner);
    await sleep(1200);
    banner.remove();
    if (i === 2) wrap.classList.add('raining');
  }
  // 四十九扇断火根(结局演出)
  await showDialog(app, [E[5]]);
  const counter = el('div', 'fan-counter', '第 1 扇');
  wrap.appendChild(counter);
  for (let i = 1; i <= 49; i++) {
    counter.textContent = `第 ${i} 扇`;
    if (i % 7 === 0) audio.sfx('click');
    await sleep(45);
  }
  counter.textContent = '第 49 扇 · 火根断绝';
  counter.classList.add('done');
  audio.sfx('victory');
  await sleep(900);
  counter.remove();

  // 还扇西行
  const panel = el('div', 'ending-panel');
  for (const line of [E[6], E[7]]) panel.appendChild(el('p', '', line.text));
  panel.appendChild(el('div', 'ending-title', TEXT.story.endingTitle));
  const btn = el('button', 'btn modal-btn', TEXT.story.restart);
  btn.id = 'btn-restart';
  btn.style.display = 'block';
  btn.style.margin = '14px auto 0';
  btn.addEventListener('click', () => {
    localStorage.removeItem(SAVE_KEY);
    campaign = newCampaign();
    showTitle();
  });
  panel.appendChild(btn);
  wrap.appendChild(panel);
}

// ---------- QA 钩子 ----------
window.__game = {
  phase: () => phase,
  campaign: () => campaign,
  npcScreenPos: (name) => overworldCtl?.npcScreenPos(name) ?? null,
  fast: FAST,
  seed: SEED,
  audio,
};

// ---------- 启动 ----------
(async function boot() {
  await loadAssets();
  setupTopbar();
  showTitle();
  // 首次用户手势即解锁音频(标题 BGM 此后响起)
  document.addEventListener('pointerdown', function once() {
    document.removeEventListener('pointerdown', once);
    audio.unlock();
    if (phase === 'title') audio.playBGM('title');
  });
})();
