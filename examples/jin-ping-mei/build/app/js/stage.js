// 舞台：背景交叉淡入、立绘进出场与差分、说话人高亮、CG 与成人画面门控、剧情过场、待机影像与回落推镜、存档缩略图合成。
import { BG, CG, CAST, EXPRESSIONS, FILM, CUT } from './story/index.js';
import { config, ageConfirmed } from './store.js';
import { audio } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const POS_X = { left: 0.24, center: 0.5, right: 0.76 };
const FOCUS_ZOOM = 1.3;

export const spriteSrc = (who, expr) => `assets/sprite/${who}/${EXPRESSIONS.includes(expr) ? expr : 'neutral'}.webp`;
// 构图偏右、左侧留白的 CG：按 focus 裁到人物那一侧（舞台、鉴赏大图、缩略图共用）
export const cgClass = (id) => (CG[id]?.focus ? `focus-${CG[id].focus}` : '');
export const cgVisible = (id) => Boolean(id && CG[id] && (!CG[id].adult || (config.adult && ageConfirmed())));

// ---------- 动态影像 ----------
// 影像以那张 CG／背景为首尾帧循环；不能播（关闭、减弱动态、加载失败）时，原图做慢推镜
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
export const filmEnabled = () => config.film && !reducedMotion?.matches;

export function attachFilm(box, id) {
  box.querySelector('video.film')?.remove();
  box.classList.remove('live', 'kb');
  const film = id && FILM[id];
  if (!film || !filmEnabled()) { if (id && (film || box.id === 'cg') && !reducedMotion?.matches) box.classList.add('kb'); return; }
  const v = document.createElement('video');
  v.className = `film ${box.querySelector('img')?.className ?? ''}`.trim(); // 跟 CG 一样按 focus 裁切
  Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto', src: film.src });
  v.setAttribute('aria-hidden', 'true');
  v.addEventListener('playing', () => box.classList.add('live'), { once: true });
  v.addEventListener('error', () => { v.remove(); box.classList.remove('live'); box.classList.add('kb'); }, { once: true });
  box.append(v);
  v.play?.().catch(() => {}); // 自动播放被拦时停在首帧，与原图一致
}

let shownBg = null;
let activeBgLayer = 'a';
let shownCg = null;

export function syncStage(stage, { instant = false, speaker = null } = {}) {
  // 背景
  if (stage.bg !== shownBg) {
    shownBg = stage.bg;
    const next = activeBgLayer === 'a' ? 'b' : 'a';
    const nextEl = $(`#bg-${next}`);
    const prevEl = $(`#bg-${activeBgLayer}`);
    nextEl.style.backgroundImage = stage.bg && BG[stage.bg] ? `url("${BG[stage.bg]}")` : 'none';
    nextEl.dataset.bg = stage.bg ?? '';
    nextEl.classList.toggle('night', /night|chamber|rain/.test(stage.bg ?? ''));
    const fast = instant || stage.bgFx === 'cut';
    nextEl.style.transitionDuration = prevEl.style.transitionDuration = fast ? '0ms' : '';
    nextEl.classList.add('on');
    prevEl.classList.remove('on');
    attachFilm(nextEl, stage.bg);
    setTimeout(() => { if (!prevEl.classList.contains('on')) attachFilm(prevEl, null); }, fast ? 0 : 1000);
    activeBgLayer = next;
    if (stage.bgFx === 'flash' && !instant) flash();
  }

  // 立绘：按 id 增量更新，新登场者淡入上滑，离场者淡出
  const layer = $('#sprites');
  const want = stage.sprites;
  layer.dataset.count = Object.keys(want).length;
  for (const el of [...layer.children]) {
    if (!want[el.dataset.who] && !el.classList.contains('leaving')) {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), instant ? 0 : 420);
    }
  }
  for (const [who, { pos, expr }] of Object.entries(want)) {
    let el = layer.querySelector(`.sprite[data-who="${who}"]:not(.leaving)`);
    if (!el) {
      el = document.createElement('div');
      el.className = `sprite entering${instant ? ' no-anim' : ''}`;
      el.dataset.who = who;
      el.innerHTML = `<img alt="${CAST[who].full}" draggable="false">`;
      el.querySelector('img').src = spriteSrc(who, expr);
      el.dataset.expr = expr;
      layer.append(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering')));
    }
    el.dataset.pos = pos;
    if (el.dataset.expr !== expr) {
      // 差分交叉淡入：新图叠在上面淡入后替换
      const prev = el.querySelector('img:last-child');
      const img = document.createElement('img');
      img.alt = CAST[who].full;
      img.draggable = false;
      img.className = 'swap';
      img.src = spriteSrc(who, expr);
      el.append(img);
      requestAnimationFrame(() => img.classList.add('in'));
      setTimeout(() => { prev.remove(); img.className = ''; }, instant ? 0 : 260);
      el.dataset.expr = expr;
      if (expr === 'surprised' && !instant) jolt(el);
    }
    const speaking = speaker && speaker === who;
    el.classList.toggle('speaking', Boolean(speaking));
    el.classList.toggle('dim', Boolean(speaker && CAST[speaker] && !speaking));
  }

  $('#weather').className = stage.weather ?? '';

  syncCg(stage);
  syncCut(stage, instant);
}

// ---------- 剧情过场 ----------
// 选择之后演出后果的短片：有声、只播一次，播完停在末帧，后面的台词接着在这一帧上读。
// 读档、回退、快进、关闭动态影像或文件缺失时，直接显示末帧定格（poster），字幕与选择一样不缺。
let shownCut = null;
export const cutVideo = () => document.querySelector('#cut video');
const posterOf = (id) => `assets/cut/${id}.jpg`;

function syncCut(stage, instant) {
  if (stage.cut === shownCut) return;
  shownCut = stage.cut;
  const box = $('#cut');
  box.querySelector('video')?.remove();
  audio.duck(false);
  $('#game').classList.toggle('cut-on', Boolean(stage.cut));
  if (!stage.cut || !CUT[stage.cut]) { box.classList.remove('on', 'kb', 'ended'); return; }
  const img = box.querySelector('img');
  img.src = posterOf(stage.cut);
  box.classList.remove('ended', 'kb');
  box.classList.add('on');
  if (instant || !filmEnabled()) { box.classList.add('ended'); if (!reducedMotion?.matches) box.classList.add('kb'); return; }
  const v = document.createElement('video');
  Object.assign(v, { playsInline: true, preload: 'auto', src: CUT[stage.cut].src, volume: Math.min(1, config.se / 100) });
  v.addEventListener('playing', () => audio.duck(true));
  v.addEventListener('ended', () => { box.classList.add('ended'); audio.duck(false); });
  v.addEventListener('error', () => { v.remove(); box.classList.add('ended', 'kb'); audio.duck(false); }, { once: true });
  box.append(v);
  // 有声自动播放被拦时改成静音播，画面照常演完
  v.play?.().catch(() => { v.muted = true; v.play?.().catch(() => { box.classList.add('ended'); }); });
}

// 鉴赏里重看一段过场：独立的播放器，不动舞台状态
export function playCutInto(box, id) {
  box.innerHTML = '';
  const v = document.createElement('video');
  Object.assign(v, { controls: true, playsInline: true, autoplay: true, src: CUT[id].src, poster: posterOf(id), volume: Math.min(1, config.se / 100) });
  v.addEventListener('playing', () => audio.duck(true));
  for (const e of ['pause', 'ended', 'emptied']) v.addEventListener(e, () => audio.duck(false));
  box.append(v);
  return v;
}

// CG：成人 CG 仅在年龄确认且设置开启时加载；否则以帘幕代替
function syncCg(stage) {
  if (stage.cg === shownCg) return;
  shownCg = stage.cg;
  const box = $('#cg');
  $('#game').classList.toggle('cg-on', Boolean(stage.cg));
  if (!stage.cg) { box.classList.remove('on'); setTimeout(() => { if (!box.classList.contains('on')) attachFilm(box, null); }, 800); return; }
  const visible = cgVisible(stage.cg);
  const img = box.querySelector('img');
  img.src = visible ? CG[stage.cg].src : '';
  img.className = visible ? cgClass(stage.cg) : '';
  box.classList.toggle('veiled', !visible);
  box.classList.add('on');
  attachFilm(box, visible && !CG[stage.cg].adult ? stage.cg : null);
  if (!visible) onVeil?.();
}

let onVeil = null;
export const setVeilHook = (fn) => { onVeil = fn; };
// 设置里改了「成人画面」：正在显示的 CG 立刻按新设置重画
export function refreshCg(stage) {
  shownCg = undefined;
  syncCg(stage);
  const bgEl = document.querySelector('.bg.on');
  if (bgEl) attachFilm(bgEl, stage.bg);
}

// 当前 CG 在屏幕上实际铺开的矩形（object-fit: cover 裁切后），察言观色的细节框按它换算
export function cgRect() {
  const box = $('#cg').getBoundingClientRect();
  const img = $('#cg img');
  const iw = img.naturalWidth || 16;
  const ih = img.naturalHeight || 9;
  const scale = Math.max(box.width / iw, box.height / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
}

export function resetStage() {
  shownBg = undefined;
  shownCg = undefined;
  shownCut = undefined;
  $('#sprites').innerHTML = '';
  $('#cut video')?.remove();
  $('#cut').classList.remove('on', 'ended', 'kb');
  $('#game').classList.remove('cut-on');
  audio.duck(false);
}

export function jolt(el) {
  el.classList.remove('jolt');
  void el.offsetWidth;
  el.classList.add('jolt');
}

export function flash() {
  const f = $('#flash');
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

export function shake() {
  const s = $('#stage');
  s.classList.remove('shake');
  void s.offsetWidth;
  s.classList.add('shake');
}

const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

// 存档缩略图：用当前背景＋立绘（或非成人 CG）重新合成，绝不截入成人画面
export async function thumbnail(stage) {
  const W = 320;
  const H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d1a24';
  ctx.fillRect(0, 0, W, H);
  const cover = (img, zoom = 0) => {
    // zoom>0：与舞台 .focus-right 相同，只取右侧 1/zoom 宽、居中 1/zoom 高
    const sw = zoom ? img.width / zoom : img.width;
    const sh = zoom ? img.height / zoom : img.height;
    const sx = img.width - sw;
    const sy = (img.height - sh) / 2;
    const s = Math.max(W / sw, H / sh);
    ctx.drawImage(img, sx, sy, sw, sh, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
  };
  const cut = stage.cut && CUT[stage.cut] ? await loadImage(posterOf(stage.cut)) : null;
  const cg = !cut && stage.cg && CG[stage.cg] && !CG[stage.cg].adult ? await loadImage(CG[stage.cg].src) : null;
  if (cut) cover(cut);
  else if (cg) cover(cg, CG[stage.cg].focus ? FOCUS_ZOOM : 0);
  else {
    const bg = stage.bg && BG[stage.bg] ? await loadImage(BG[stage.bg]) : null;
    if (bg) cover(bg);
    if (!stage.cg && !cut) {
      for (const [who, { pos, expr }] of Object.entries(stage.sprites)) {
        const img = await loadImage(spriteSrc(who, expr));
        if (!img) continue;
        const h = H * 1.15;
        const w = img.width * (h / img.height);
        ctx.drawImage(img, W * POS_X[pos] - w / 2, H * 0.06, w, h);
      }
    }
  }
  try { return canvas.toDataURL('image/jpeg', 0.72); } catch { return null; }
}
