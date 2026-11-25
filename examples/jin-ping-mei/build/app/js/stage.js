// 舞台：把运行时的舞台状态画出来。背景、立绘、天气、CG、剧情过场与待机影像各占一层；
// 每张画面都是一个 16:9 的「画框」，由这里按视口算好位置（横屏铺满裁切，竖屏时 CG 与过场完整显示、四周垫模糊底），
// 所以察言观色的细节框只要按百分比放进画框，任何宽高比下都对得上。
import { BG, CG, CAST, CUT, FILM, CURTAIN, spriteSrc } from './story/registry.js';
import { settings, ageConfirmed } from './store.js';
import { audio } from './audio.js';
import { Particles } from './fx/particles.js';

const FRAME = 16 / 9;
const $ = (sel) => document.querySelector(sel);
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export const calm = () => settings.calm || Boolean(reduced?.matches);
// 动态影像（过场与待机影像）能不能播
export const filmOk = () => settings.film && !calm();
export const cgAllowed = (id) => Boolean(id && CG[id] && (!CG[id].adult || (settings.adult && ageConfirmed())));
export const isPortrait = () => window.innerWidth / window.innerHeight < 0.8;

// 自定义属性里的 url() 会按样式表所在目录解析，所以先换成绝对地址
const cssUrl = (src) => `url("${new URL(src, document.baseURI).href}")`;

let els = null;
let weather = null;
let shown = { bg: undefined, cg: undefined, cut: undefined };
let bgFront = 0;
let cutListeners = {};
// 过场影像停住的两种原因：菜单开着等（menu），字幕还没读完、停在镜头交界处等（hold）。两样都没有才播
const cutStop = { menu: false, hold: false };
const cutShouldPlay = () => !cutStop.menu && !cutStop.hold;
function applyCutPlay() {
  const v = els?.cutPic.querySelector('video');
  if (!v || v.ended) return;
  if (cutShouldPlay()) v.play().catch(() => {}); else v.pause();
}

function makePic(extra = '') {
  const pic = document.createElement('div');
  pic.className = `pic ${extra}`.trim();
  pic.innerHTML = '<img alt="" draggable="false">';
  return pic;
}

// 按画框比例把 .pic 放进舞台：cover 铺满裁切，contain 完整显示
function fit(pic) {
  if (!pic) return;
  const box = els.stage.getBoundingClientRect();
  const contain = pic.dataset.fit === 'contain';
  const wide = box.width / box.height > FRAME;
  const w = contain === wide ? box.height * FRAME : box.width;
  const h = w / FRAME;
  Object.assign(pic.style, { width: `${w}px`, height: `${h}px`, left: `${(box.width - w) / 2}px`, top: `${(box.height - h) / 2}px` });
}

function fitAll() {
  if (!els) return;
  const portrait = isPortrait();
  document.documentElement.classList.toggle('portrait', portrait);
  for (const pic of els.bgPics) { pic.dataset.fit = 'cover'; fit(pic); }
  for (const pic of [els.cgPic, els.cutPic]) { pic.dataset.fit = portrait ? 'contain' : 'cover'; fit(pic); }
  weather?.resize();
}

// 待机影像：压在那张静帧上循环，开播后淡入；不能播时静帧自己慢慢推近
function attachFilm(pic, id) {
  pic.querySelector('video.film')?.remove();
  pic.classList.remove('live', 'kb');
  const film = id && FILM[id];
  if (!id || calm()) return;
  if (!film || !settings.film) { pic.classList.add('kb'); return; }
  const v = document.createElement('video');
  v.className = 'film';
  Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto', src: film.src });
  v.setAttribute('aria-hidden', 'true');
  v.addEventListener('playing', () => pic.classList.add('live'), { once: true });
  v.addEventListener('error', () => { v.remove(); pic.classList.remove('live'); pic.classList.add('kb'); }, { once: true });
  pic.append(v);
  v.play().catch(() => {});
}

function syncBg(stage, instant) {
  if (stage.bg === shown.bg) return;
  shown.bg = stage.bg;
  const next = els.bgPics[1 - bgFront];
  const prev = els.bgPics[bgFront];
  bgFront = 1 - bgFront;
  const src = stage.bg ? BG[stage.bg] : '';
  const img = next.querySelector('img');
  img.src = src || '';
  img.hidden = !src;
  next.dataset.id = stage.bg ?? '';
  const quick = instant || stage.bgFx === 'cut';
  for (const pic of [next, prev]) pic.classList.toggle('no-anim', quick);
  next.classList.add('on');
  prev.classList.remove('on');
  attachFilm(next, src ? stage.bg : null);
  setTimeout(() => { if (!prev.classList.contains('on')) attachFilm(prev, null); }, quick ? 0 : 1100);
  els.stage.dataset.night = /night|chamber|rain|dawn/.test(stage.bg ?? '') ? 'yes' : 'no';
}

function syncSprites(stage, speaker, instant) {
  const layer = els.sprites;
  const want = stage.sprites;
  layer.dataset.count = Object.keys(want).length;
  for (const el of [...layer.children]) {
    if (want[el.dataset.who] || el.classList.contains('leaving')) continue;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), instant ? 0 : 420);
  }
  for (const [who, { pos, expr }] of Object.entries(want)) {
    let el = layer.querySelector(`.sprite[data-who="${who}"]:not(.leaving)`);
    if (!el) {
      el = document.createElement('div');
      el.className = `sprite entering${instant ? ' no-anim' : ''}`;
      el.dataset.who = who;
      el.dataset.expr = expr;
      el.style.setProperty('--glow', CAST[who].glow);
      el.innerHTML = `<img alt="${CAST[who].full}" draggable="false" src="${spriteSrc(who, expr)}">`;
      layer.append(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering', 'no-anim')));
    }
    el.dataset.pos = pos;
    if (el.dataset.expr !== expr) {
      // 换表情：新差分叠在旧的上面淡入，身体逐像素对齐所以只看见脸在变
      const old = [...el.querySelectorAll('img')];
      const img = document.createElement('img');
      img.alt = CAST[who].full;
      img.draggable = false;
      img.className = 'swap';
      img.src = spriteSrc(who, expr);
      el.append(img);
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('in')));
      setTimeout(() => { old.forEach((o) => o.remove()); img.className = ''; }, instant ? 0 : 280);
      el.dataset.expr = expr;
      if (expr === 'surprised' && !instant && !calm()) replay(el, 'jolt');
    }
    const speaking = Boolean(speaker && speaker === who);
    el.classList.toggle('speaking', speaking);
    el.classList.toggle('dim', Boolean(speaker && CAST[speaker] && !speaking));
  }
}

function syncCg(stage) {
  if (stage.cg === shown.cg) return;
  shown.cg = stage.cg;
  const pic = els.cgPic;
  els.stage.classList.toggle('cg-on', Boolean(stage.cg));
  if (!stage.cg) {
    els.cgPlane.classList.remove('on');
    setTimeout(() => { if (!els.cgPlane.classList.contains('on')) attachFilm(pic, null); }, 700);
    return;
  }
  // 成人 CG 只在年龄确认且设置开启时才请求；否则挂帘幕
  const ok = cgAllowed(stage.cg);
  const src = ok ? CG[stage.cg].src : CURTAIN;
  pic.querySelector('img').src = src;
  pic.classList.toggle('focus-right', ok && CG[stage.cg].focus === 'right');
  els.cgPlane.classList.toggle('veiled', !ok);
  els.cgPlane.style.setProperty('--backdrop', cssUrl(src));
  els.cgPlane.classList.add('on');
  attachFilm(pic, ok && !CG[stage.cg].adult ? stage.cg : null);
}

// 剧情过场：有声、只播一次，播完停在末帧。instant（读档、回退、快进）或影像不可用时直接显示末帧定格。
function syncCut(stage, instant) {
  if (stage.cut === shown.cut) return;
  shown.cut = stage.cut;
  const pic = els.cutPic;
  const plane = els.cutPlane;
  const old = pic.querySelector('video');
  if (old) { old.pause(); old.removeAttribute('src'); old.load(); old.remove(); }
  audio.duck(false);
  els.stage.classList.toggle('cut-on', Boolean(stage.cut));
  plane.classList.remove('ended', 'live', 'held');
  cutStop.hold = false;
  pic.classList.remove('kb');
  if (!stage.cut || !CUT[stage.cut]) { plane.classList.remove('on'); cutListeners.gone?.(); return; }
  const cut = CUT[stage.cut];
  pic.querySelector('img').src = cut.poster;
  plane.style.setProperty('--backdrop', cssUrl(cut.poster));
  plane.classList.toggle('no-anim', Boolean(instant));
  plane.classList.add('on');
  const still = () => {
    plane.classList.add('ended');
    plane.classList.remove('live');
    if (!calm()) pic.classList.add('kb');
    audio.duck(false);
  };
  if (instant || !filmOk()) { still(); return; }
  const v = document.createElement('video');
  Object.assign(v, { playsInline: true, preload: 'auto', src: cut.src });
  audio.applyVoice(v);
  v.addEventListener('playing', () => { plane.classList.add('live'); audio.duck(!v.muted && audio.isVoiceEnabled()); });
  v.addEventListener('pause', () => { audio.duck(false); });
  v.addEventListener('ended', () => { still(); cutListeners.ended?.(); }, { once: true });
  v.addEventListener('error', () => { v.remove(); still(); cutListeners.ended?.(); }, { once: true });
  pic.append(v);
  // 有声自动播放被浏览器拦下时改成静音播，画面照常演完。
  // 只认「不许自动播放」这一种拒绝：菜单恰好在 play() 落定之前打开时，pause() 也会让它以 AbortError 落空，那时不该再播起来
  if (!cutShouldPlay()) return;
  v.play().catch((err) => {
    if (err?.name !== 'NotAllowedError' || !v.isConnected) return;
    v.dataset.autoplayMuted = '1';
    v.muted = true;
    audio.duck(false);
    if (cutShouldPlay()) v.play().catch(() => { v.remove(); still(); cutListeners.ended?.(); });
  });
}

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
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

export const stage = {
  init() {
    const root = $('#stage');
    root.innerHTML = `
      <div id="scene">
        <div class="plane" id="bg-plane"></div>
        <canvas id="weather" aria-hidden="true"></canvas>
        <div id="sprites"></div>
      </div>
      <div class="plane" id="cg-plane"></div>
      <div class="plane" id="cut-plane"></div>
      <div id="shade"></div>`;
    els = {
      stage: root, scene: $('#scene'), sprites: $('#sprites'), cgPlane: $('#cg-plane'), cutPlane: $('#cut-plane'),
      bgPics: [makePic(), makePic()], cgPic: makePic(), cutPic: makePic(),
    };
    $('#bg-plane').append(...els.bgPics);
    els.cgPlane.append(els.cgPic);
    els.cutPlane.append(els.cutPic);
    weather = new Particles($('#weather'));
    window.addEventListener('resize', fitAll);
    new ResizeObserver(fitAll).observe(root);
    // 指针视差：背景与立绘朝反方向挪一点，像隔着一层景深
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || calm()) return;
      const box = root.getBoundingClientRect();
      els.scene.style.setProperty('--px', ((e.clientX - box.left) / box.width - 0.5).toFixed(3));
      els.scene.style.setProperty('--py', ((e.clientY - box.top) / box.height - 0.5).toFixed(3));
    });
    fitAll();
  },

  // 按运行时的舞台状态重画；speaker 是当前说话的人物 id
  sync(state, { instant = false, speaker = null } = {}) {
    syncBg(state, instant);
    syncSprites(state, speaker, instant);
    weather.set(calm() ? null : state.weather);
    syncCg(state);
    syncCut(state, instant);
    // 被 CG 或过场盖住的那层影像先停下，省一路解码
    const covered = Boolean(state.cg || state.cut);
    for (const pic of els.bgPics) { const v = pic.querySelector('video.film'); if (v) { if (covered) v.pause(); else v.play().catch(() => {}); } }
  },

  reset() {
    shown = { bg: undefined, cg: undefined, cut: undefined };
    els.sprites.innerHTML = '';
    this.sync({ bg: null, bgFx: 'cut', sprites: {}, cg: null, cut: null, weather: null }, { instant: true });
    shown = { bg: undefined, cg: undefined, cut: undefined };
  },

  // 设置改了「成人画面／动态影像／减弱动效」：按新设置把当前画面重画一遍（过场不重播，回落为定格）
  refresh(state) {
    shown = { bg: undefined, cg: undefined, cut: undefined };
    this.sync(state, { instant: true });
    document.documentElement.classList.toggle('calm', calm());
  },

  onCut(listeners) { cutListeners = listeners; },
  cutVideo() { return els.cutPic.querySelector('video'); },
  // 过场是否正在播（还没到末帧）
  cutLive() { const v = this.cutVideo(); return Boolean(v && !v.ended && !els.cutPlane.classList.contains('ended')); },
  setVoiceVolume() {
    const v = this.cutVideo();
    if (!v) return;
    if (audio.isVoiceEnabled()) delete v.dataset.autoplayMuted;
    audio.applyVoice(v, { forceMuted: v.dataset.autoplayMuted === '1' });
    const playingNow = !v.paused && !v.ended && !els.cutPlane.classList.contains('ended');
    audio.duck(playingNow && !v.muted && audio.isVoiceEnabled());
  },
  pauseCut(on) { cutStop.menu = Boolean(on); applyCutPlay(); },
  // 字幕还没读完：把影像停在镜头交界处（画面慢慢推近一点，不显得死），读完再接着演
  holdCut(on) {
    if (cutStop.hold === Boolean(on)) return;
    cutStop.hold = Boolean(on);
    els.cutPlane.classList.toggle('held', cutStop.hold && !calm());
    applyCutPlay();
  },
  cutHeld() { return cutStop.hold; },

  // 察言观色用：CG 画框（细节框按百分比放进去），以及观察时让静帧不再推近
  lookFrame() { return els.cgPic; },
  steady(on) { els.cgPic.classList.toggle('steady', on); },

  shake() { if (!calm()) replay(els.stage, 'shake'); },

  // 存档缩略图：按舞台状态重新合成，成人 CG 一律画成帘幕，绝不截入成人画面
  async thumbnail(state) {
    const W = 320;
    const H = 180;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    g.fillStyle = '#14121c';
    g.fillRect(0, 0, W, H);
    const cover = (img, zoomRight = false) => {
      // 取图像中央的 16:9；focus-right 的 CG 与舞台一样放大后靠右
      let sw = Math.min(img.width, img.height * FRAME);
      let sh = sw / FRAME;
      let sx = (img.width - sw) / 2;
      let sy = (img.height - sh) / 2;
      if (zoomRight) { sx += sw - sw / 1.3; sy += (sh - sh / 1.3) / 2; sw /= 1.3; sh /= 1.3; }
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    };
    if (state.cut && CUT[state.cut]) {
      const img = await loadImage(CUT[state.cut].poster);
      if (img) cover(img);
    } else if (state.cg && CG[state.cg]) {
      const adult = CG[state.cg].adult;
      const img = await loadImage(adult ? CURTAIN : CG[state.cg].src);
      if (img) cover(img, !adult && CG[state.cg].focus === 'right');
    } else {
      const bg = state.bg && BG[state.bg] ? await loadImage(BG[state.bg]) : null;
      if (bg) cover(bg);
      const X = { left: 0.26, center: 0.5, right: 0.74 };
      for (const [who, { pos, expr }] of Object.entries(state.sprites)) {
        const img = await loadImage(spriteSrc(who, expr));
        if (!img) continue;
        const h = H * 1.25;
        const w = img.width * (h / img.height);
        g.drawImage(img, W * X[pos] - w / 2, H * 0.08, w, h);
      }
    }
    try { return canvas.toDataURL('image/jpeg', 0.7); } catch { return null; }
  },

  preload(srcs) { for (const src of srcs) if (src) loadImage(src); },
};
