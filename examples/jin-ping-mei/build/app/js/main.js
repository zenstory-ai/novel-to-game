// 入口：年龄门 → 标题 → 影游主循环（打字机、自动、快进、隐藏、回看、快存快读、上一选项、限时抉择、察言观色、按住动作、
// 「她记下了」、剧情树节点）。菜单界面在 menus.js。
import { parseScript, Story, HEROINES } from './adv.js';
import { SCRIPT_SOURCES, CAST, SPEAKERS, CG, CUT, ENDINGS, ENDING_KIND, FATES, EXPRESSIONS } from './story/index.js';
import { config, global, saveGlobal, ageConfirmed, confirmAge, writeSave, loadSaves, latestSave, writeNode } from './store.js';
import { syncStage, resetStage, thumbnail, shake, flash, refreshCg, setVeilHook, cgRect, attachFilm, cutVideo, spriteSrc } from './stage.js';
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
  onRemember: (who, delta) => stamp(who, delta),
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
  shown: [], // 当前选择处实际列出的选项（限时开启时「不作声」不列出），数字键按它对应
  timer: null, // 限时抉择 { total, left, last, raf }
  look: null, // 察言观色 { left }
  hold: null, // 按住动作 { progress, elapsed, holding, last, raf, done }
  cueTimer: null, // 剧情过场：等到下一句字幕的时间点自动接上
};
const now = () => performance.now();
const lock = (ms) => { ui.lockUntil = Math.max(ui.lockUntil, now() + ms); };
const locked = () => now() < ui.lockUntil;
const told = new Set();
const tellOnce = (key, text) => { if (!told.has(key)) { told.add(key); toast(text); } };
const choiceStack = []; // 本次游玩经过的选择处，供「上一选项」回退；不落盘

// 剧情树用的章节表：按剧本顺序，路线章节归到那位女主名下
// 按玩家实际走到的先后排：从开头沿跳转与选项深度优先走一遍，章节第一次出现的次序就是剧情次序
// （剧本按文件分，一条路线的章节可能分在不同文件里，按文件顺序会排错）
const playOrder = (() => {
  const seen = new Set();
  const chapters = [];
  const visit = (label) => {
    if (seen.has(label) || !labels[label]) return;
    seen.add(label);
    for (const c of labels[label]) {
      if (c.t === 'chapter') chapters.push(c);
      if (c.t === 'branch') for (const h of HEROINES) visit(`${h}_route`);
      for (const t of [c.target, c.miss, ...(c.options ?? []).map((o) => o.target)].filter(Boolean)) visit(t);
    }
  };
  visit('start');
  return chapters;
})();
export const chapterList = () => playOrder.map((c) => ({
  key: c.sub ? `${c.title} · ${c.sub}` : c.title,
  title: c.title,
  sub: c.sub,
  who: HEROINES.find((h) => c.title.startsWith(CAST[h].full)) ?? null,
}));

// ---------- 屏幕切换 ----------
function show(screen) {
  for (const id of ['gate', 'title', 'game']) $(`#${id}`).hidden = id !== screen;
  document.body.dataset.screen = screen;
  if (screen === 'title') { startPetals($('#petals')); audio.play('title'); unlock('music', 'title'); attachFilm($('#title .title-bg'), 'title'); } else { stopPetals(); attachFilm($('#title .title-bg'), null); }
}

// 「她记下了」：在她的人物色里盖一枚印；连着几枚就排队盖
const stamps = [];
function stamp(who, delta) {
  if (story.replay || !CAST[who]) return;
  stamps.push({ who, text: delta < 0 ? `${CAST[who].name}心里冷了几分` : `${CAST[who].name}会记得这句话` });
  if (stamps.length === 1) nextStamp();
}
function nextStamp() {
  const s = stamps[0];
  const el = $('#stamp');
  if (!s) { el.hidden = true; return; }
  el.style.setProperty('--accent', CAST[s.who].color);
  el.innerHTML = `<span class="seal">${CAST[s.who].full[0]}</span><b>${s.text}</b>`;
  el.hidden = false;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
  audio.se('save');
  setTimeout(() => { stamps.shift(); nextStamp(); }, 2100);
}

export function toTitle() {
  stopModes();
  stopInteractions();
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
  if (!labels[record?.snap?.label]) { toast('剧本已更新，这份存档无法读取'); return; }
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

// 进游戏时在空闲里把五人的全部表情差分拉进缓存：立绘第一次登场或换表情时不会空一下
let spritesWarm = false;
function warmSprites() {
  if (spritesWarm) return;
  spritesWarm = true;
  const load = () => { for (const who of HEROINES) for (const expr of EXPRESSIONS) Object.assign(new Image(), { decoding: 'async', src: spriteSrc(who, expr) }); };
  (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300)))(load);
}

function enterGame() {
  warmSprites();
  stopModes();
  stopInteractions();
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
  if (ev.type === 'look') return showLook(ev);
  if (ev.type === 'hold') return showHold(ev);
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
  watchCue(ev);
}

// 剧情过场里的台词是字幕：影像播到下一句的时间点就自动换句，玩家点击可以先走一步。
// 菜单打开、切走标签页时影像暂停；快进、读档定格或影像缺失时不自动换句，照常点击推进。
function watchCue(ev) {
  clearInterval(ui.cueTimer);
  ui.cueTimer = null;
  $('#game').classList.remove('cue-wait');
  if (!ev.cut || !cutVideo()) return;
  const next = CUT[ev.cut.id]?.cues?.[ev.cut.index + 1];
  // 每句至少留够读完的时间（约每秒 8 字），影像到了时间点也等字幕读完再换；长句因此会比画面晚一点
  const shownAt = now();
  const readMs = Math.min(4500, Math.max(1500, ($('#text').textContent.length * 1000) / 8 + 500));
  ui.cueTimer = setInterval(() => {
    const v = cutVideo();
    if (!v || ui.cur !== ev) { clearInterval(ui.cueTimer); ui.cueTimer = null; $('#game').classList.remove('cue-wait'); return; }
    const hold = menuOpen() || document.hidden;
    if (hold && !v.paused) { v.pause(); v.dataset.held = '1'; }
    else if (!hold && v.dataset.held) { delete v.dataset.held; v.play?.().catch(() => {}); }
    // 字幕还会自己换句时不亮「点击推进」；影像播完、或下一句排在片尾之后，就交回给玩家点击
    const autoNext = next !== undefined && !v.ended && !(v.duration && next >= v.duration);
    $('#game').classList.toggle('cue-wait', autoNext && !ui.skip && !ui.ctrl);
    if (hold || ui.skip || ui.ctrl || !autoNext || v.currentTime < next || now() - shownAt < readMs) return;
    clearInterval(ui.cueTimer);
    ui.cueTimer = null;
    $('#game').classList.remove('cue-wait');
    if (ui.typing) finishTyping();
    clearTimeout(ui.waitTimer);
    step();
  }, 100);
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
  if (ui.cur.type === 'look') { lookAdvance(); return; }
  if (['choice', 'hold'].includes(ui.cur.type)) return;
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
    head.textContent = '今晚去谁那里？';
    box.append(head);
  }
  const timed = ev.timed && config.timed && !story.replay;
  ui.shown = ev.options.filter((o) => !(o.silent && timed));
  ui.shown.forEach((option, n) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.dataset.index = option.i;
    if (option.who) {
      const c = CAST[option.who];
      b.classList.add('door');
      b.classList.toggle('locked', !option.enabled);
      b.setAttribute('aria-disabled', String(!option.enabled));
      b.style.setProperty('--accent', c.color);
      b.innerHTML = `<img class="bust" src="assets/sprite/${option.who}/smile.webp" alt=""><b>${c.house} · ${c.full}</b><small>${option.enabled ? c.line : '她对你的好感还不够，今晚这扇门关着。'}</small>${option.enabled ? '' : '<span class="wick">熄</span>'}`;
    } else {
      b.innerHTML = `<b>${option.text.replace(/“([^”]*)”/g, '「$1」')}</b>`;
      b.classList.toggle('silent', option.silent);
      b.disabled = !option.enabled;
      if (global.chosen.has(choiceKey(option))) { b.classList.add('seen'); b.insertAdjacentHTML('beforeend', '<span class="seen-tag">已选</span>'); }
    }
    b.prepend(Object.assign(document.createElement('i'), { textContent: n + 1 }));
    box.append(b);
  });
  if (timed) {
    const wick = document.createElement('div');
    wick.className = 'wick-timer';
    wick.innerHTML = '<span class="flame"></span><span class="burn"></span><small>限时：时间到就算你不作声</small>';
    box.append(wick);
  }
  box.hidden = false;
  $('#game').classList.add('choosing');
  $('#game').classList.toggle('timed', Boolean(timed));
  if (timed) startTimer(ev.timed * 1000, ev.options.find((o) => o.silent).i);
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
  stopTimer();
  $('#choices').hidden = true;
  $('#game').classList.remove('choosing', 'timed');
}

// ---------- 限时抉择 ----------
// 菜单、隐藏界面、切走标签页时灯芯停烧；时间到了就是「不作声」
const timerPaused = () => menuOpen() || ui.hidden || document.hidden;
function startTimer(total, silentIndex) {
  stopTimer();
  const t = { total, left: total, last: now(), raf: 0 };
  ui.timer = t;
  const wick = $('#choices .wick-timer');
  const tick = () => {
    const at = now();
    if (!timerPaused()) t.left -= at - t.last;
    t.last = at;
    const frac = Math.max(0, t.left / t.total);
    wick.style.setProperty('--left', frac.toFixed(4));
    $('#choices').classList.toggle('hurry', frac < 0.3);
    if (t.left <= 0) { stopTimer(); choose(silentIndex, { timeout: true }); return; }
    t.raf = requestAnimationFrame(tick);
  };
  t.raf = requestAnimationFrame(tick);
}
function stopTimer() {
  if (ui.timer) cancelAnimationFrame(ui.timer.raf);
  ui.timer = null;
  $('#choices').classList.remove('hurry');
}

// ---------- 察言观色 ----------
function placeSpots() {
  const layer = $('#look');
  if (layer.hidden || !ui.look) return;
  const r = cgRect();
  for (const b of layer.querySelectorAll('.spot')) {
    const [x, y, w, h] = JSON.parse(b.dataset.rect);
    Object.assign(b.style, { left: `${r.left + (r.width * x) / 100}px`, top: `${r.top + (r.height * y) / 100}px`, width: `${(r.width * w) / 100}px`, height: `${(r.height * h) / 100}px` });
  }
}
function lookFoot() {
  const left = ui.look.left;
  $('#look .look-left').textContent = left > 0 ? `还能看 ${left} 处` : '看完了';
  $('#look [data-act="look-done"]').textContent = left > 0 ? '不看了' : '继续';
}
function showLook(ev) {
  setSkip(false);
  setAuto(false);
  lock(350);
  ui.look = { left: ev.left };
  ui.line = { name: '', who: null, text: ev.prompt };
  $('#text').textContent = paintLine(ui.line);
  $('#next-ind').classList.remove('on');
  const layer = $('#look');
  layer.innerHTML = `${ev.spots.map((sp) => `<button class="spot ${sp.seen ? 'seen' : ''}" data-i="${sp.i}" data-rect="${JSON.stringify(sp.rect)}" aria-label="${sp.name}"><span>${sp.name}</span></button>`).join('')}
    <div class="look-foot"><span class="look-left"></span><button class="btn" data-act="look-done">不看了</button></div>`;
  layer.hidden = false;
  $('#game').classList.add('looking');
  lookFoot();
  requestAnimationFrame(placeSpots);
  if (!story.replay) saveTo('auto', true);
}
function inspect(i) {
  if (ui.cur?.type !== 'look' || locked()) return;
  const b = $(`#look .spot[data-i="${i}"]`);
  if (!b || b.classList.contains('seen')) { if (b) toast('这里已经看过了'); return; }
  if (ui.look.left <= 0) { toast('能看的都看过了'); return; }
  const spot = ui.cur.spots.find((sp) => sp.i === i);
  audio.se('choice');
  story.inspect(i);
  b.classList.add('seen');
  ui.look.left -= 1;
  lookFoot();
  ui.line = { name: '', who: null, text: `【${spot.name}】${spot.text}` };
  pushBacklog({ name: '', text: `◉ ${spot.name}：${spot.text}`, color: null, choice: true });
  typeText(paintLine(ui.line), config.textSpeed >= 100);
  $('#next-ind').classList.remove('on');
}
// 察言观色时，推进文字的点击、空格与回车也用在这里：没打完的字先打完；看满了就继续；还能看就提示怎么看
function lookAdvance() {
  if (ui.typing) { finishTyping(); $('#next-ind').classList.remove('on'); return; }
  if (ui.look.left <= 0) endLook();
  else tellOnce('look', '点画面上的框看细节；看够了点「不看了」');
}
function endLook() {
  if (ui.cur?.type !== 'look' || locked()) return;
  if (ui.typing) { finishTyping(); $('#next-ind').classList.remove('on'); return; }
  audio.se('click');
  closeLook();
  story.endLook();
  step();
}
function closeLook() {
  ui.look = null;
  $('#look').hidden = true;
  $('#look').innerHTML = '';
  $('#game').classList.remove('looking');
}

// ---------- 按住动作 ----------
// 按住时进度上涨；松手或没按时风把它吹回去。窗口时间内没护满就算灭了。动作辅助打开时自动护住。
// 窗口从第一次按下算起；一直不按，等满 HOLD_GRACE 也开始算，免得读提示的时候灯就自己灭了。
const HOLD_WINDOW = 6500;
const HOLD_GRACE = 4000;
function showHold(ev) {
  setSkip(false);
  setAuto(false);
  lock(500);
  ui.line = { name: '', who: null, text: ev.prompt };
  $('#text').textContent = paintLine(ui.line);
  $('#next-ind').classList.remove('on');
  const layer = $('#hold');
  layer.innerHTML = `<div class="lamp" role="button" tabindex="0" aria-label="${ev.prompt}"><span class="ring"></span><span class="glass"><i class="flame"></i></span></div>
    <p>${config.assist ? '动作辅助已打开，自动护住' : '按住鼠标、触屏或空格'}</p><small class="wind"></small>`;
  layer.hidden = false;
  $('#game').classList.add('holding');
  const h = { ms: ev.ms, progress: 0, elapsed: 0, idle: 0, started: false, holding: false, last: now(), raf: 0, done: false };
  ui.hold = h;
  const ring = layer.querySelector('.ring');
  const lamp = layer.querySelector('.lamp');
  const wind = layer.querySelector('.wind');
  const tick = () => {
    const at = now();
    const dt = menuOpen() || document.hidden ? 0 : at - h.last;
    h.last = at;
    if (!locked()) {
      if (h.holding || config.assist) h.started = true;
      h.idle += dt;
      if (h.started || h.idle >= HOLD_GRACE) h.elapsed += dt;
      const gust = 0.55 + 0.45 * Math.sin(h.elapsed / 380) ** 2; // 风一阵紧一阵松
      const holding = h.holding || config.assist;
      h.progress = Math.min(1, Math.max(0, h.progress + (holding ? dt / h.ms : (-dt / h.ms) * gust * 0.9)));
      lamp.style.setProperty('--sway', `${(holding ? 2 : 14) * gust * Math.sin(h.elapsed / 140)}deg`);
      lamp.style.setProperty('--flame', String(holding ? 1 : Math.max(0.25, 1 - gust * 0.6)));
    }
    ring.style.setProperty('--p', h.progress.toFixed(4));
    // 风一旦刮起来，就告诉玩家还剩多久：别让灯在读提示的时候不明不白地灭掉
    if (h.elapsed > 0 && !config.assist) wind.textContent = `风还要刮 ${Math.max(0, Math.ceil((HOLD_WINDOW - h.elapsed) / 1000))} 秒`;
    lamp.classList.toggle('held', h.holding || config.assist);
    if (h.progress >= 1) return finishHold(true);
    if (h.elapsed >= HOLD_WINDOW) return finishHold(false);
    h.raf = requestAnimationFrame(tick);
  };
  h.raf = requestAnimationFrame(tick);
}
function setHolding(on) {
  if (ui.hold && !ui.hold.done) ui.hold.holding = on;
}
function finishHold(ok) {
  const h = ui.hold;
  if (!h || h.done) return;
  h.done = true;
  cancelAnimationFrame(h.raf);
  audio.se(ok ? 'flare' : 'gust');
  $('#hold .lamp').classList.add(ok ? 'kept' : 'out');
  $('#hold p').textContent = ok ? '灯护住了' : '灯灭了';
  setTimeout(() => {
    if (ui.hold !== h) return;
    closeHold();
    story.resolveHold(ok);
    step();
  }, 900);
}
function closeHold() {
  if (ui.hold) cancelAnimationFrame(ui.hold.raf);
  ui.hold = null;
  $('#hold').hidden = true;
  $('#hold').innerHTML = '';
  $('#game').classList.remove('holding');
}

function stopInteractions() {
  stopTimer();
  closeLook();
  closeHold();
}

export function choose(index, { timeout = false } = {}) {
  if (ui.cur?.type !== 'choice' || (locked() && !timeout)) return;
  if (ui.hidden && !timeout) { setHidden(false); return; } // 隐藏画面时先把字幕请回来，不替玩家做选择
  const option = ui.cur.options.find((o) => o.i === index);
  if (!option) return;
  if (!option.enabled) { if (option.who) toast('好感不够，这扇门今晚没有亮灯。'); return; }
  audio.se('choice');
  if (!option.who) { global.chosen.add(choiceKey(option)); saveGlobal(); }
  pushBacklog({ name: '', text: `▶ ${option.who ? `${CAST[option.who].house} · ${CAST[option.who].full}` : option.text}${timeout ? '（时间到）' : ''}`, color: null, choice: true });
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
  return story.label === `${who}_route` ? `今晚去${CAST[who].house}` : CAST[who].house;
}

function armChapter() {
  clearTimeout(ui.waitTimer);
  ui.waitTimer = setTimeout(() => advance(true), ui.skip || ui.ctrl ? 400 : 2600);
}

// 剧情树：每章开场记下这一刻，之后可从菜单「剧情树」直接回到这里重来
async function recordNode() {
  if (story.replay) return;
  writeNode(story.stage.chapter, await makeSaveRecord());
}

function showChapter(ev) {
  audio.se('chapter');
  recordNode();
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
  showCard(`<div class="fate-bg" style="background-image:url('${CG.fate.src}')"></div><div class="fate-inner"><small>原著命数</small><h2>${who ? who.full : '西门庆'}</h2>${lines.map((l, i) => `<p style="animation-delay:${0.6 + i * 1.4}s">${l}</p>`).join('')}<em>这一春你们走到了哪一步，都改变不了她在原著里的命运。</em></div>`, 'fate');
  unlock('cg', 'fate');
}

// 命数页还在逐行浮现时点了一下：整页一次显出，留在这一页
function revealFate() {
  $('#card').classList.add('reveal');
  ui.lockUntil = Math.min(ui.lockUntil, now() + 1500);
}

// ---------- 模式：自动、快进、隐藏 ----------
// 模式关掉时撤掉已排好的下一步；仍有别的模式开着就按它重新排
function rearmWait() {
  if (ui.cur?.type === 'chapter') return;
  clearTimeout(ui.waitTimer);
  if (!ui.typing && ui.cur?.type === 'say' && (ui.auto || ui.skip || ui.ctrl)) lineDone();
}
const SKIP_HINT = '快进只跳过读过的句子，可以在「设置」里打开「快进未读文字」';
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
  peek: () => { if (!story.replay) openMenu('peek'); },
  tree: () => { if (!story.replay) openMenu('tree'); },
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
  $('#btn-age-no').addEventListener('click', () => { $('#gate .gate-card').innerHTML = '<h1>本作仅限成年人</h1><p>可以直接关闭这个页面。</p>'; });
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
    if (e.target.closest('#quickmenu, #choices, .spot, .look-foot, #hold')) return;
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
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && ui.ctrl) { ui.ctrl = false; badge(); rearmWait(); }
    if (e.key === ' ' || e.key === 'Enter') setHolding(false);
  });
  $('#look').addEventListener('click', (e) => {
    e.stopPropagation();
    const spot = e.target.closest('.spot');
    if (spot) inspect(Number(spot.dataset.i));
    else if (e.target.closest('[data-act="look-done"]')) endLook();
  });
  $('#hold').addEventListener('click', (e) => e.stopPropagation());
  $('#hold').addEventListener('pointerdown', (e) => { e.preventDefault(); setHolding(true); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) $('#hold').addEventListener(type, () => setHolding(false));
  window.addEventListener('resize', placeSpots);
  window.addEventListener('blur', () => { ui.ctrl = false; badge(); setHolding(false); });
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
  if (ui.cur?.type === 'hold' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    if (!e.repeat) setHolding(true);
    return;
  }
  if (ui.cur?.type === 'choice' && /^[1-9]$/.test(e.key)) {
    const option = ui.shown[Number(e.key) - 1];
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
