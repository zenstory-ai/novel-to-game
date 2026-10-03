// 舞台：背景交叉淡入、立绘进出场与差分、说话人高亮、CG 与成人画面门控、存档缩略图合成。
import { BG, CG, CAST, EXPRESSIONS } from './story/index.js';
import { config, ageConfirmed } from './store.js';

const $ = (sel) => document.querySelector(sel);
const POS_X = { left: 0.24, center: 0.5, right: 0.76 };
const FOCUS_ZOOM = 1.3;

export const spriteSrc = (who, expr) => `assets/sprite/${who}/${EXPRESSIONS.includes(expr) ? expr : 'neutral'}.webp`;
// 构图偏右、左侧留白的 CG：按 focus 裁到人物那一侧（舞台、鉴赏大图、缩略图共用）
export const cgClass = (id) => (CG[id]?.focus ? `focus-${CG[id].focus}` : '');
export const cgVisible = (id) => Boolean(id && CG[id] && (!CG[id].adult || (config.adult && ageConfirmed())));

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
}

// CG：成人 CG 仅在年龄确认且设置开启时加载；否则以帘幕代替
function syncCg(stage) {
  if (stage.cg === shownCg) return;
  shownCg = stage.cg;
  const box = $('#cg');
  if (!stage.cg) { box.classList.remove('on'); return; }
  const visible = cgVisible(stage.cg);
  const img = box.querySelector('img');
  img.src = visible ? CG[stage.cg].src : '';
  img.className = visible ? cgClass(stage.cg) : '';
  box.classList.toggle('veiled', !visible);
  box.classList.add('on');
  if (!visible) onVeil?.();
}

let onVeil = null;
export const setVeilHook = (fn) => { onVeil = fn; };
// 设置里改了「成人画面」：正在显示的 CG 立刻按新设置重画
export function refreshCg(stage) {
  shownCg = undefined;
  syncCg(stage);
}

export function resetStage() {
  shownBg = undefined;
  shownCg = undefined;
  $('#sprites').innerHTML = '';
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
  const cg = stage.cg && CG[stage.cg] && !CG[stage.cg].adult ? await loadImage(CG[stage.cg].src) : null;
  if (cg) cover(cg, CG[stage.cg].focus ? FOCUS_ZOOM : 0);
  else {
    const bg = stage.bg && BG[stage.bg] ? await loadImage(BG[stage.bg]) : null;
    if (bg) cover(bg);
    if (!stage.cg) {
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
