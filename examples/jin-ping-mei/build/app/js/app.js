// 入口：年龄门 → 标题 → 游戏。年龄确认之前只请求门面那一张不含人物的宅门图，不请求游戏里的任何图片、影像或声音。
import { CG, FILM, ENDINGS } from './story/registry.js';
import { game } from './game.js';
import { stage, filmOk, calm } from './stage.js';
import { audio } from './audio.js';
import { bus } from './bus.js';
import { book } from './ui/book.js';
import { Particles } from './fx/particles.js';
import { ageConfirmed, confirmAge, latestSave, loadNodes, record, unlock, onSettings } from './store.js';

const $ = (sel) => document.querySelector(sel);
const SCREENS = ['gate', 'title', 'game'];
let petals = null;
let gatePetals = null;
let current = null;
// 本次打开页面里是否进过游戏画面（决定回到标题时要不要给「开始游戏」焦点）
let played = false;

function show(name) {
  if (current === name) return;
  current = name;
  // 换屏时把焦点从上一屏的按钮上拿开，否则空格会按到已经看不见的按钮
  document.activeElement?.blur?.();
  for (const id of SCREENS) {
    const el = $(`#${id}`);
    if (id === name) { el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on'))); } else { el.classList.remove('on'); el.hidden = true; }
  }
  $('#app').dataset.screen = name;
  if (name === 'game') played = true;
  if (name === 'title') enterTitle(); else leaveTitle();
}

// ---------- 标题 ----------
function titleFilm() {
  const pic = $('#title .pic');
  pic.querySelector('video')?.remove();
  pic.classList.remove('live', 'kb');
  if (calm()) return;
  if (!filmOk()) { pic.classList.add('kb'); return; }
  const v = document.createElement('video');
  Object.assign(v, { muted: true, loop: true, playsInline: true, src: FILM.title.src });
  v.addEventListener('playing', () => pic.classList.add('live'), { once: true });
  v.addEventListener('error', () => { v.remove(); pic.classList.add('kb'); }, { once: true });
  pic.append(v);
  v.play().catch(() => {});
}

function enterTitle() {
  const img = $('#title .pic img');
  if (!img.getAttribute('src')) img.src = CG.title.src;
  titleFilm();
  petals ??= new Particles($('#title-petals'));
  petals.set(calm() ? null : 'petals');
  audio.bgm('title');
  unlock('music', 'title');
  unlock('cg', 'title');
  $('#title [data-act="continue"]').disabled = !latestSave();
  $('#title [data-act="tree"]').disabled = !Object.keys(loadNodes()).length;
  const seen = record.ending.size;
  $('#title-progress').textContent = seen ? `已见结局 ${seen} / ${Object.keys(ENDINGS).length}` : '成人向 · 单人 · 约二十分钟一条线';
  // 只在本次打开页面第一次来到标题时把焦点给「开始游戏」。玩过一局再回来（结局页、回标题）不给任何按钮焦点：
  // 第 2、5 轮盲玩都是读完命数页连按空格，1.2 秒后焦点落到「开始游戏」上，下一下空格就开了新局、盖掉自动存档。
  // 键盘玩家按上下键就能选到菜单（keydown 里从第一项起）。
  if (played) return;
  setTimeout(() => { if (current === 'title' && !book.isOpen && !played) $('#title [data-act="new"]').focus({ preventScroll: true }); }, 1200);
}

function leaveTitle() {
  petals?.set(null);
  $('#title .pic video')?.remove();
}

function bindTitle() {
  $('#title .title-menu').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    audio.se('choice');
    if (act === 'new') game.start();
    else if (act === 'continue') { const rec = latestSave(); if (rec) game.load(rec, { from: 'continue' }); } else book.open(act);
  });
  // 标题菜单：上下键移动
  // 挂在 document 上：回到标题时没有按钮带焦点，按键落在 body 上
  document.addEventListener('keydown', (e) => {
    if (current !== 'title' || book.isOpen || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const items = [...$('#title .title-menu').querySelectorAll('button:not(:disabled)')];
    const at = items.indexOf(document.activeElement);
    e.preventDefault();
    if (at < 0) { items[e.key === 'ArrowDown' ? 0 : items.length - 1].focus(); return; }
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });
  window.addEventListener('resize', () => petals?.resize());
  onSettings((key) => { if ((key === 'film' || key === 'calm') && current === 'title') { titleFilm(); petals?.set(calm() ? null : 'petals'); } });
}

// ---------- 年龄门 ----------
function bindGate() {
  const gate = $('#gate');
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still()) {
    gatePetals = new Particles($('#gate-petals'));
    gatePetals.set('petals');
    window.addEventListener('resize', () => gatePetals?.resize());
  }
  let opening = false;
  $('#age-yes').addEventListener('click', () => {
    if (opening) return;
    opening = true;
    confirmAge();
    audio.unlock();
    const enter = () => { gatePetals?.set(null); gatePetals = null; boot(); };
    if (still()) { enter(); return; }
    // 推门：镜头推进门里，暖光漫开，再换到标题
    gate.classList.add('opening');
    setTimeout(enter, 820);
  });
  $('#age-no').addEventListener('click', () => {
    $('.gate-actions').hidden = true;
    $('#gate-note').hidden = false;
  });
}

let booted = false;
function boot() {
  if (!booted) {
    booted = true;
    game.init();
    bindTitle();
    bus.on('screen', show);
    bus.on('open-book', (tab) => book.open(tab));
    bus.on('replay-ended', () => { show('title'); book.open('gallery', { gallery: 'scene' }); });
    bus.on('book-closed', () => { if (current === 'title') enterTitleFocus(); });
    stage.preload([CG.title.src]);
  }
  show('title');
}
function enterTitleFocus() {
  $('#title [data-act="continue"]').disabled = !latestSave();
  $('#title [data-act="tree"]').disabled = !Object.keys(loadNodes()).length;
}

bindGate();
if (ageConfirmed()) boot(); else { show('gate'); requestAnimationFrame(() => $('#age-yes').focus()); }
