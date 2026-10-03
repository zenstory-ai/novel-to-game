// 入口：年龄门 → 标题 → ADV 主循环（打字机、自动、快进、隐藏、回看、快存快读、上一选项）。菜单界面在 menus.js。
import { parseScript, Story, HEROINES } from './adv.js';
import { SCRIPT_SOURCES, CAST, SPEAKERS, CG, ENDINGS, ENDING_KIND, FATES } from './story/index.js';
import { config, global, saveGlobal, ageConfirmed, confirmAge, writeSave, loadSaves, latestSave } from './store.js';
import { syncStage, resetStage, thumbnail, shake, flash, refreshCg, setVeilHook } from './stage.js';
import { audio } from './audio.js';
import { openMenu, closeMenu, backMenu, confirmBox, menuOpen, closedAt, pushBacklog, clearBacklog, backlogTail } from './menus.js';
import { startPetals, stopPetals } from './petals.js';

const $ = (sel) => document.querySelector(sel);
const labels = parseScript(SCRIPT_SOURCES, CAST, SPEAKERS);
const unlock = (kind, id) => {
  if (!global[kind].has(id)) { global[kind].add(id); saveGlobal(); }
};
export const story = new Story(labels, {
  onUnlock: unlock,
  onFx: (id) => (id === 'shake' ? shake() : id === 'flash' ? flash() : null),
  onSe: (id) => audio.se(id),
});

const ui = {
  cur: null, // 当前阻塞事件
  typing: null, // { full, timer }
  auto: false,
  skip: false,
  ctrl: false,
  hidden: false,
  waitTimer: null,
  line: null, // 当前句 { name, who, text }，供存档预览与读档重画
  lineRead: false,
  lockUntil: 0, // 选项、结局、命数刚出现时挡住惯性点击
  wheelAt: 0,
};
const now = () => performance.now();
const lock = (ms) => { ui.lockUntil = Math.max(ui.lockUntil, now() + ms); };
const locked = () => now() < ui.lockUntil;
const told = new Set();
const tellOnce = (key, text) => { if (!told.has(key)) { told.add(key); toast(text); } };
const choiceStack = []; // 本次游玩经过的选择处，供「上一选项」回退；不落盘

// ---------- 屏幕切换 ----------
function show(screen) {
  for (const id of ['gate', 'title', 'game']) $(`#${id}`).hidden = id !== screen;
  document.body.dataset.screen = screen;
  if (screen === 'title') { startPetals($('#petals')); audio.play('title'); unlock('music', 'title'); } else stopPetals();
}

export function toTitle() {
  stopModes();
  closeMenu();
  story.reset();
  resetStage();
  ui.cur = null;
  choiceStack.length = 0;
  $('#title [data-act="continue"]').disabled = !latestSave();
  show('title');
}

export function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, text.length > 16 ? 3200 : 1800);
}

// ---------- 新游戏／读档 ----------
export function newGame() {
  closeMenu();
  clearBacklog();
  resetStage();
  choiceStack.length = 0;
  story.start('start');
  enterGame();
  step();
}

export function startReplay(label) {
  closeMenu();
  clearBacklog();
  resetStage();
  choiceStack.length = 0;
  story.start(label, { replay: true });
  enterGame();
  step();
}

export function loadSnapshot(record, { keepStack = false } = {}) {
  // 先验再拆：读不出的存档不动当前画面
  if (!labels[record?.snap?.label]) { toast('这份存档对应的剧本已改动，读不出来了'); return; }
  closeMenu();
  const tail = record.backlog ?? [];
  clearBacklog(tail.slice(0, -1));
  resetStage();
  story.restore(record.snap);
  if (!keepStack) choiceStack.length = 0;
  enterGame();
  ui.line = record.line ?? null;
  step(true);
  // 停在选择处的存档：把选项前的那一句原样摆回文本框，不打字、不重复记入回看
  if (ui.cur?.type !== 'say' && tail.length) pushBacklog(tail.at(-1));
  if (ui.cur?.type === 'choice' && record.line) $('#text').textContent = paintLine(record.line);
}

function enterGame() {
  stopModes();
  setHidden(false);
  closeChoices();
  hideCard();
  $('#text').textContent = '';
  $('#nameplate').hidden = true;
  $('#game').classList.toggle('replay', story.replay);
  show('game');
}

export async function makeSaveRecord() {
  const snap = story.snapshot();
  return {
    snap,
    chapter: story.stage.chapter || '序章',
    text: ui.line ? `${ui.line.name ? `${ui.line.name}：` : ''}${ui.line.text}`.slice(0, 40) : '',
    line: ui.line,
    date: new Date().toLocaleString('zh-CN', { hour12: false }),
    time: Date.now(),
    thumb: await thumbnail(snap.stage),
    backlog: backlogTail(),
  };
}

export async function saveTo(slot, quiet = false) {
  if (story.replay) { if (!quiet) toast('回想中不能存档'); return false; }
  if (!ui.cur) return false;
  const ok = writeSave(slot, await makeSaveRecord());
  if (!quiet) { audio.se('save'); toast(ok ? (slot === 'quick' ? '已快速存档' : '已存档') : '存储空间不足，存档失败'); }
  return ok;
}

export function quickLoad() {
  const record = loadSaves().quick;
  if (!record) { toast('还没有快速存档'); return; }
  loadSnapshot(record);
  toast('已快速读档');
}

// 菜单关上之后：按新设置重画 CG，章节卡继续自己退场
export function afterMenuClose() {
  refreshCg(story.stage);
  if (ui.cur?.type === 'chapter' && !$('#card').hidden) armChapter();
}

export function applyBoxAlpha() {
  document.documentElement.style.setProperty('--box-alpha', String(config.boxAlpha / 100));
}

// ---------- 主循环 ----------
function step(fromLoad = false) {
  clearTimeout(ui.waitTimer);
  let ev;
  try { ev = story.next(); } catch (error) {
    console.error(error);
    toast(`剧本出错：${error.message}`);
    return;
  }
  ui.cur = ev;
  audio.play(story.stage.bgm ?? null);
  if (ev.type === 'say') return showSay(ev, fromLoad);
  syncStage(story.stage, { instant: fromLoad || ui.skip });
  if (ev.type === 'choice') return showChoice(ev);
  if (ev.type === 'chapter') return showChapter(ev);
  if (ev.type === 'ending') return showEnding(ev);
  if (ev.type === 'fate') return showFate(ev);
  if (ev.type === 'end') {
    if (ev.replay || story.replay) { toTitle(); openMenu('extras', 'scene'); return; }
    toTitle();
    toast('结局已记入「鉴赏 · 结局」');
  }
}

// 名牌（前两章带上她的名分）与引号；返回要显示的整句
function paintLine({ name, who, text }) {
  const plate = $('#nameplate');
  plate.textContent = name;
  if (who && /^(序章|第一章|第二章)/.test(story.stage.chapter)) plate.append(Object.assign(document.createElement('small'), { textContent: ` · ${CAST[who].title}` }));
  plate.hidden = !name;
  plate.style.setProperty('--plate', who ? CAST[who].color : name === '西门庆' ? '#6b4b2e' : '#5d5560');
  $('#textbox').classList.toggle('narration', !name);
  return name && !/^[「『“]/.test(text) ? `「${text}」` : text;
}

function showSay(ev, instant) {
  syncStage(story.stage, { instant: instant || ui.skip, speaker: ev.who });
  ui.line = { name: ev.name, who: ev.who, text: ev.text };
  const full = paintLine(ui.line);
  pushBacklog({ name: ev.name, text: full, color: ev.who ? CAST[ev.who].color : null });
  $('#hint').hidden = global.read.size > 6;
  const wasRead = global.read.has(ev.id);
  global.read.add(ev.id);
  saveGlobal();
  $('#textbox').classList.toggle('read', wasRead);
  ui.lineRead = wasRead;
  if (ui.skip && !canSkip()) { setSkip(false); toast('已到未读处'); }
  typeText(full, ((ui.skip || ui.ctrl) && canSkip()) || config.textSpeed >= 100);
}

// 文字速度＝每秒字数：按经过的时间算该显示到第几个字
function typeText(full, instant) {
  const el = $('#text');
  clearInterval(ui.typing?.timer);
  $('#next-ind').classList.remove('on');
  if (instant) { el.textContent = full; ui.typing = null; return lineDone(); }
  const start = now();
  el.textContent = '';
  ui.typing = { full, timer: setInterval(() => {
    const shown = Math.floor(((now() - start) * config.textSpeed) / 1000);
    el.textContent = full.slice(0, shown);
    if (shown >= full.length) finishTyping();
  }, 16) };
}

function finishTyping() {
  if (!ui.typing) return;
  clearInterval(ui.typing.timer);
  $('#text').textContent = ui.typing.full;
  ui.typing = null;
  lineDone();
}

function lineDone() {
  $('#next-ind').classList.add('on');
  clearTimeout(ui.waitTimer);
  if ((ui.skip || ui.ctrl) && canSkip()) ui.waitTimer = setTimeout(() => advance(true), 45);
  else if (ui.auto) {
    const len = $('#text').textContent.length;
    const perChar = 140 - config.autoSpeed; // ms
    ui.waitTimer = setTimeout(() => advance(true), 900 + len * perChar);
  }
}

const canSkip = () => ui.lineRead || config.skipUnread;

export function advance(fromTimer = false) {
  if (menuOpen() || !ui.cur) return;
  if (ui.hidden) { if (!fromTimer) setHidden(false); return; }
  if (!fromTimer && locked()) { if (ui.cur.type === 'fate') revealFate(); return; }
  if (ui.typing) { finishTyping(); return; }
  if (ui.cur.type === 'choice') return;
  if (!fromTimer) audio.se('click');
  if (ui.cur.type === 'chapter' && fromTimer) lock(350); // 章节卡自己退场时，同一刻的点击不吞掉第一句
  if (ui.cur.type === 'chapter' || ui.cur.type === 'ending' || ui.cur.type === 'fate') hideCard();
  step();
}

// ---------- 选择、章节卡、结局、命数 ----------
const choiceKey = (option) => `${story.label}:${option.text}`;

function showChoice(ev) {
  setSkip(false);
  lock(450);
  const box = $('#choices');
  box.innerHTML = '';
  box.classList.toggle('branch', Boolean(ev.branch));
  if (ev.branch) {
    const head = document.createElement('p');
    head.className = 'choice-head';
    head.textContent = '今夜，你往哪扇门去？';
    box.append(head);
  }
  ev.options.forEach((option, n) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.dataset.index = option.i;
    if (option.who) {
      const c = CAST[option.who];
      b.classList.add('door');
      b.classList.toggle('locked', !option.enabled);
      b.setAttribute('aria-disabled', String(!option.enabled));
      b.style.setProperty('--accent', c.color);
      b.innerHTML = `<img class="bust" src="assets/sprite/${option.who}/smile.webp" alt=""><b>${c.house} · ${c.full}</b><small>${option.enabled ? c.line : '你没在她心上留够分量。门闩上了，灯也熄了。'}</small>${option.enabled ? '' : '<span class="wick">熄</span>'}`;
    } else {
      b.innerHTML = `<b>${option.text.replace(/“([^”]*)”/g, '「$1」')}</b>`;
      b.disabled = !option.enabled;
      if (global.chosen.has(choiceKey(option))) { b.classList.add('seen'); b.insertAdjacentHTML('beforeend', '<span class="seen-tag">已选</span>'); }
    }
    b.prepend(Object.assign(document.createElement('i'), { textContent: n + 1 }));
    box.append(b);
  });
  box.hidden = false;
  $('#game').classList.add('choosing');
  // 焦点只停在选项框上：连按回车读台词的手不会顺势落进第一项；要用键盘选，先按数字、↑↓ 或 Tab
  box.focus({ preventScroll: true });
  if (!story.replay) {
    const snap = story.snapshot();
    const key = JSON.stringify(snap);
    if (choiceStack.at(-1)?.key !== key) choiceStack.push({ key, snap, backlog: backlogTail(), line: ui.line });
    if (choiceStack.length > 20) choiceStack.shift();
  }
  saveTo('auto', true);
}

function closeChoices() {
  $('#choices').hidden = true;
  $('#game').classList.remove('choosing');
}

export function choose(index) {
  if (ui.cur?.type !== 'choice' || locked()) return;
  if (ui.hidden) { setHidden(false); return; } // 隐藏画面时先把字幕请回来，不替玩家做选择
  const option = ui.cur.options.find((o) => o.i === index);
  if (!option) return;
  if (!option.enabled) { if (option.who) toast('这扇门今夜不为你开。'); return; }
  audio.se('choice');
  if (!option.who) { global.chosen.add(choiceKey(option)); saveGlobal(); }
  pushBacklog({ name: '', text: `▶ ${option.who ? `${CAST[option.who].house} · ${CAST[option.who].full}` : option.text}`, color: null, choice: true });
  closeChoices();
  story.choose(index);
  step();
}

function askRollback() {
  if (story.replay) return;
  const target = choiceStack.length - (ui.cur?.type === 'choice' ? 2 : 1);
  if (target < 0) { toast('还没有经过选择'); return; }
  confirmBox('回到上一个选择处？', () => {
    if (ui.cur?.type === 'choice') choiceStack.pop();
    loadSnapshot(choiceStack.pop(), { keepStack: true });
  });
}

function showCard(html, cls) {
  const card = $('#card');
  card.className = cls;
  card.innerHTML = html;
  card.hidden = false;
  $('#game').classList.add('carding');
}

function hideCard() {
  $('#card').hidden = true;
  $('#game').classList.remove('carding');
}

function chapterKicker(title) {
  const who = HEROINES.find((h) => title.startsWith(CAST[h].full));
  if (!who) return '那年春天';
  return story.label === `${who}_route` ? `今夜，往${CAST[who].house}` : CAST[who].house;
}

function armChapter() {
  clearTimeout(ui.waitTimer);
  ui.waitTimer = setTimeout(() => advance(true), ui.skip || ui.ctrl ? 400 : 2600);
}

function showChapter(ev) {
  audio.se('chapter');
  showCard(`<div class="chapter-inner"><small>${chapterKicker(ev.title)}</small><h2>${ev.title}</h2><p>${ev.sub}</p></div>`, 'chapter');
  saveTo('auto', true);
  armChapter();
}

function showEnding(ev) {
  setSkip(false);
  setAuto(false);
  lock(1500);
  audio.se('ending');
  const end = ENDINGS[ev.id];
  const who = end.who ? CAST[end.who] : null;
  showCard(`<div class="ending-band" style="--accent:${who?.color ?? '#7a6a80'}"><small>${who ? `${who.full}篇` : '那年春天'} · ${ENDING_KIND[end.kind]}结局</small><h2>${end.title}</h2><span class="seal">终</span><em>点击继续</em></div>`, `ending ${end.kind}`);
}

function showFate(ev) {
  audio.play('fate');
  unlock('music', 'fate');
  lock(5000);
  const lines = FATES[ev.who] ?? [];
  const who = CAST[ev.who];
  showCard(`<div class="fate-bg" style="background-image:url('${CG.fate.src}')"></div><div class="fate-inner"><small>原著命数</small><h2>${who ? who.full : '西门庆'}</h2>${lines.map((l, i) => `<p style="animation-delay:${0.6 + i * 1.4}s">${l}</p>`).join('')}<em>这一春你们说成了什么，改不了她在书里的去处。</em></div>`, 'fate');
  unlock('cg', 'fate');
}

// 命数页还在逐行浮现时点了一下：整页一次显出，留在这一页
function revealFate() {
  $('#card').classList.add('reveal');
  ui.lockUntil = Math.min(ui.lockUntil, now() + 700);
}

// ---------- 模式：自动、快进、隐藏 ----------
// 模式关掉时撤掉已排好的下一步；仍有别的模式开着就按它重新排
function rearmWait() {
  if (ui.cur?.type === 'chapter') return;
  clearTimeout(ui.waitTimer);
  if (!ui.typing && ui.cur?.type === 'say' && (ui.auto || ui.skip || ui.ctrl)) lineDone();
}
const SKIP_HINT = '没读过的句子不快进——可在「设置」里打开『快进未读文字』';
export function setAuto(on) {
  ui.auto = on;
  $('#quickmenu [data-act="auto"]').classList.toggle('on', on);
  badge();
  rearmWait();
}
export function setSkip(on) {
  if (on && ui.cur?.type === 'say' && !canSkip()) { tellOnce('skip', SKIP_HINT); on = false; }
  ui.skip = on;
  $('#quickmenu [data-act="skip"]').classList.toggle('on', on);
  badge();
  if (on && ui.typing) finishTyping(); else rearmWait();
}
function stopModes() {
  clearInterval(ui.typing?.timer); // 读档/回标题时打断旧行的打字机，免得它改写新画面
  ui.typing = null;
  ui.auto = false;
  ui.skip = false;
  ui.ctrl = false;
  clearTimeout(ui.waitTimer);
  document.querySelectorAll('#quickmenu .on').forEach((b) => b.classList.remove('on'));
  badge();
}
function badge() {
  const b = $('#mode-badge');
  const text = ui.skip || ui.ctrl ? '快进 ▶▶' : ui.auto ? '自动 ▶' : story.replay ? '回想中' : '';
  b.textContent = text;
  b.hidden = !text;
}
export function setHidden(on) {
  ui.hidden = on;
  $('#game').classList.toggle('ui-hidden', on);
}

// ---------- 输入 ----------
const quickActions = {
  backlog: () => openMenu('backlog'),
  rollback: () => askRollback(),
  qsave: () => saveTo('quick'),
  qload: () => quickLoad(),
  save: () => openMenu('save'),
  load: () => openMenu('load'),
  auto: () => setAuto(!ui.auto),
  skip: () => setSkip(!ui.skip),
  config: () => openMenu('config'),
  hide: () => setHidden(true),
  menu: () => openMenu('system'),
};

function bindInput() {
  $('#btn-age-yes').addEventListener('click', () => { confirmAge(); audio.unlock(); toTitle(); });
  $('#btn-age-no').addEventListener('click', () => { $('#gate .gate-card').innerHTML = '<h1>这扇门不往里开</h1><p>本作只供成年人。你可以直接关闭页面。</p>'; });
  // 鼠标点按钮不夺焦点：之后的空格、回车照常推进文字，不会再按一次这个按钮
  for (const sel of ['#quickmenu', '#title .title-menu']) {
    $(sel).addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  }
  $('#title .title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const act = b?.dataset.act;
    if (!act) return;
    b.blur();
    audio.unlock();
    audio.se('click');
    if (act === 'new') newGame();
    else if (act === 'continue') { const latest = latestSave(); if (latest) loadSnapshot(latest[1]); }
    else if (act === 'exit') openMenu('exit');
    else openMenu(act);
  });
  $('#quickmenu').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const act = b?.dataset.act;
    if (act) { e.stopPropagation(); b.blur(); audio.se('click'); quickActions[act](); }
  });
  $('#choices').addEventListener('click', (e) => {
    const b = e.target.closest('button.choice');
    if (b) { e.stopPropagation(); choose(Number(b.dataset.index)); }
  });
  $('#game').addEventListener('click', (e) => {
    if (e.target.closest('#quickmenu, #choices')) return;
    advance();
  });
  $('#game').addEventListener('contextmenu', (e) => { e.preventDefault(); if (!menuOpen()) setHidden(!ui.hidden); });
  $('#game').addEventListener('wheel', (e) => {
    if (menuOpen() || now() - closedAt < 300) return; // 回看刚被滚轮关掉，余下的滚动不算推进
    if (e.deltaY < 0) openMenu('backlog');
    else if (e.deltaY > 0 && now() - ui.wheelAt >= 250) { ui.wheelAt = now(); advance(); }
  }, { passive: true });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => { if (e.key === 'Control' && ui.ctrl) { ui.ctrl = false; badge(); rearmWait(); } });
  window.addEventListener('blur', () => { ui.ctrl = false; badge(); });
}

function onKey(e) {
  if (e.key === 'Escape') {
    if (menuOpen()) backMenu();
    else if (document.body.dataset.screen === 'game') openMenu('system');
    return;
  }
  if (menuOpen() || document.body.dataset.screen !== 'game') return;
  if (e.key === 'Control') {
    if (ui.ctrl) return;
    if (ui.cur?.type === 'say' && !canSkip()) { tellOnce('skip', SKIP_HINT); return; }
    ui.ctrl = true;
    badge();
    if (ui.typing) finishTyping(); else rearmWait();
    return;
  }
  if (ui.cur?.type === 'choice' && /^[1-9]$/.test(e.key)) {
    const option = ui.cur.options[Number(e.key) - 1];
    if (option && !e.repeat) choose(option.i);
    return;
  }
  const k = e.key.toLowerCase();
  if (ui.cur?.type === 'choice' && (k === 'arrowup' || k === 'arrowdown')) {
    e.preventDefault();
    const opts = [...$('#choices').querySelectorAll('button.choice:not(:disabled):not(.locked)')];
    const at = opts.indexOf(document.activeElement);
    const dir = k === 'arrowdown' ? 1 : -1;
    opts.at(at < 0 ? (dir > 0 ? 0 : -1) : (at + dir) % opts.length)?.focus({ preventScroll: true });
    return;
  }
  if ((k === 'enter' || k === ' ') && e.target.closest?.('#choices button')) return; // 交给焦点所在的选项
  if (k === 'enter' || k === ' ' || k === 'arrowdown' || k === 'pagedown') {
    e.preventDefault();
    if (e.repeat && !canSkip()) return; // 按住不放不许冲过没读过的句子
    advance();
  } else if (k === 'arrowup' || k === 'pageup' || k === 'b') openMenu('backlog');
  else if (k === 'arrowleft') askRollback();
  else if (k === 'a') setAuto(!ui.auto);
  else if (k === 'h') setHidden(!ui.hidden);
  else if (k === 's') openMenu('save');
  else if (k === 'l') openMenu('load');
  else if (k === 'q') saveTo('quick');
}

// ---------- 启动 ----------
audio.setVolumes(config.bgm, config.se);
applyBoxAlpha();
setVeilHook(() => tellOnce('veil', '成人画面已关闭，可在设置中开启'));
bindInput();
if (ageConfirmed()) toTitle();
else show('gate');
