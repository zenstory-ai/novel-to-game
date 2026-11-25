// 鉴赏：CG、看过的剧情过场、回想（五场良缘之夜）、曲目与结局流程图。只从标题页进入。
// 成人 CG 只在「成人画面」开启时才请求图片；否则缩略图与大图都是帘幕。
import { CAST, HEROINES, CG, CUT, MUSIC, ENDINGS, ENDING_KIND, FATES, SCENES, CURTAIN, faceSrc } from '../story/registry.js';
import { game } from '../game.js';
import { audio } from '../audio.js';
import { record } from '../store.js';
import { cgAllowed } from '../stage.js';
import { icon } from './icons.js';
import { toast } from './feedback.js';

const SUBS = [['cg', 'CG'], ['cut', '过场'], ['scene', '回想'], ['music', '音乐'], ['ending', '结局']];
const groupOf = (id, item) => item.group ?? HEROINES.find((h) => id.startsWith(`${h}_`) || id === `intro_${h}`) ?? 'common';
const groupName = (g) => (g === 'common' ? '共通' : CAST[g].full);

function grouped(table) {
  const out = new Map([['common', []], ...HEROINES.map((h) => [h, []])]);
  for (const [id, item] of Object.entries(table)) out.get(groupOf(id, item)).push([id, item]);
  return [...out.entries()].filter(([, list]) => list.length);
}

function viewer(html, { onClose } = {}) {
  let root = document.querySelector('#viewer');
  if (!root) { root = document.createElement('div'); root.id = 'viewer'; document.querySelector('#app').append(root); }
  root.innerHTML = `<div class="viewer-body">${html}</div><button type="button" class="viewer-close" aria-label="关闭">${icon('close')}</button>`;
  root.hidden = false;
  const back = document.activeElement;
  const close = () => {
    for (const v of root.querySelectorAll('video')) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    root.hidden = true;
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('visibilitychange', onVis);
    onClose?.();
    back?.focus?.();
  };
  const onVis = () => {
    if (document.hidden) {
      for (const v of root.querySelectorAll('video')) v.pause();
    }
  };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } };
  root.onclick = (e) => { if (!e.target.closest('video')) close(); };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('visibilitychange', onVis);
  root.querySelector('.viewer-close').focus();
  return root;
}

const count = (kind, table) => `${Object.keys(table).filter((id) => record[kind].has(id)).length} / ${Object.keys(table).length}`;

// CG 与过场排在同一张格子里，人物名是横跨一行的小标题；整张格子由册页分页
function cgPanel() {
  return `<div class="cells">${grouped(CG).map(([g, list]) => `
    <h4 data-head>${groupName(g)}</h4>${list.map(([id, cg]) => {
      if (!record.cg.has(id)) return `<div class="cell locked">${icon('lock')}</div>`;
      const ok = cgAllowed(id);
      return `<button type="button" class="cell${cg.focus ? ' focus-right' : ''}" data-cg="${id}"><img loading="lazy" src="${ok ? cg.src : CURTAIN}" alt=""><span>${cg.name}${cg.adult && !ok ? ' · 帘幕' : ''}</span></button>`;
    }).join('')}`).join('')}</div>`;
}

function cutPanel() {
  return `<div class="cells">${grouped(CUT).map(([g, list]) => `
    <h4 data-head>${groupName(g)}</h4>${list.map(([id, cut]) => (record.cut.has(id)
      ? `<button type="button" class="cell" data-cut="${id}"><img loading="lazy" src="${cut.poster}" alt=""><i class="cell-play">${icon('play')}</i><span>${cut.name}</span></button>`
      : `<div class="cell locked">${icon('lock')}</div>`)).join('')}`).join('')}</div>`;
}

function scenePanel() {
  return `<p class="panel-note">走到良缘的那一夜，会收在这里，可以重看。</p><div class="scenes">${Object.entries(SCENES).map(([id, sc]) => {
    const c = CAST[sc.who];
    const open = record.scene.has(id);
    return `<button type="button" class="scene${open ? '' : ' locked'}" data-scene="${id}" ${open ? '' : 'disabled'} style="--c:${c.color};--glow:${c.glow}">
      <img src="${faceSrc(sc.who)}" alt=""><b>${open ? game.program.scenes[id].title : '？？？'}</b><em>${c.full}</em>${open ? icon('play') : icon('lock')}
    </button>`;
  }).join('')}</div>`;
}

function musicPanel() {
  return `<ul class="tracks">${Object.entries(MUSIC).map(([id, name]) => {
    const open = record.music.has(id);
    const on = audio.playing === id;
    return `<li><button type="button" class="track${on ? ' on' : ''}" data-music="${id}" ${open ? '' : 'disabled'}>${icon(open ? (on ? 'pause' : 'play') : 'lock')}<b>${open ? name : '？？？'}</b></button></li>`;
  }).join('')}</ul>`;
}

function endingPanel() {
  const cell = ([id, e]) => {
    const got = record.ending.has(id);
    // 已见的结局可以点开重看结局卡与原著命数（第 5 轮盲玩：点了没反应）
    return got
      ? `<button type="button" class="end-cell kind-${e.kind} got" data-ending="${id}"><b>${e.title}</b><em>${ENDING_KIND[e.kind]}</em></button>`
      : `<div class="end-cell kind-${e.kind}"><b>？？？</b><em>${ENDING_KIND[e.kind]}</em></div>`;
  };
  const rows = HEROINES.map((h) => {
    const c = CAST[h];
    return `<div class="end-row" style="--c:${c.color};--glow:${c.glow}"><div class="end-who"><img src="${faceSrc(h)}" alt=""><span>${c.full}</span></div>${Object.entries(ENDINGS).filter(([, e]) => e.who === h).map(cell).join('')}</div>`;
  }).join('');
  return `<p class="panel-note">共通线走完，心意够的院门亮灯；每条线有良缘、寻常、错过三种收场。五扇门都没亮，就是「无人留灯」。</p>
    <div class="end-flow">${rows}<div class="end-row lonely"><div class="end-who"><i class="tree-common"></i><span>共通线</span></div>${cell(['lonely', ENDINGS.lonely])}</div></div>`;
}

export function renderGallery(body, state, ctx) {
  const sub = state.gallery;
  const counts = { cg: count('cg', CG), cut: count('cut', CUT), scene: count('scene', SCENES), music: count('music', MUSIC), ending: count('ending', ENDINGS) };
  body.innerHTML = `
    <div class="subtabs" role="tablist">${SUBS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === sub}" class="${id === sub ? 'on' : ''}" data-sub="${id}">${label}<em>${counts[id]}</em></button>`).join('')}</div>
    <div class="gallery" data-sub="${sub}">${{ cg: cgPanel, cut: cutPanel, scene: scenePanel, music: musicPanel, ending: endingPanel }[sub]()}</div>`;
  ctx.paged(body.querySelector({ cg: '.cells', cut: '.cells', scene: '.scenes', music: '.tracks', ending: '.end-flow' }[sub]));
  body.onclick = (e) => {
    const t = e.target.closest('[data-sub],[data-cg],[data-cut],[data-scene],[data-music],[data-ending]');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.sub) { state.gallery = d.sub; ctx.resetPage(); ctx.rerender(); document.querySelector('#book .subtabs .on')?.focus(); return; }
    if (d.cg) {
      const ok = cgAllowed(d.cg);
      viewer(`<img class="${CG[d.cg].focus && ok ? 'focus-right' : ''}" src="${ok ? CG[d.cg].src : CURTAIN}" alt="${CG[d.cg].name}"><p>${CG[d.cg].name}</p>`);
      return;
    }
    if (d.cut) {
      const cut = CUT[d.cut];
      const root = viewer(`<video controls playsinline autoplay src="${cut.src}" poster="${cut.poster}"></video><p>${cut.name}</p>`, { onClose: () => audio.duck(false) });
      const v = root.querySelector('video');
      audio.applyVoice(v);
      v.addEventListener('playing', () => audio.duck(!v.muted && v.volume > 0));
      v.addEventListener('volumechange', () => {
        if (!v.paused && !v.ended) audio.duck(!v.muted && v.volume > 0);
      });
      for (const type of ['pause', 'ended']) v.addEventListener(type, () => audio.duck(false));
      return;
    }
    if (d.ending) {
      const end = ENDINGS[d.ending];
      const c = end.who ? CAST[end.who] : null;
      const fate = FATES[end.who ?? 'lonely'] ?? [];
      viewer(`<div class="end-review" style="--c:${c?.color ?? '#6b6f8c'};--glow:${c?.glow ?? '#b9bdd8'}">
        ${c ? `<img src="${faceSrc(end.who)}" alt="">` : ''}
        <span class="viewer-who">${c ? `${c.full} · ${c.house}` : '西门宅 · 书房'} · ${ENDING_KIND[end.kind]}</span>
        <h3>${end.title}</h3>
        <div class="viewer-fate"><p>原著命数</p>${fate.map((line) => `<p>${line}</p>`).join('')}</div>
      </div>`);
      return;
    }
    if (d.scene) { ctx.close(); game.replayScene(d.scene); return; }
    if (d.music) {
      if (audio.playing === d.music) {
        audio.bgm(null);
      } else {
        audio.bgm(d.music);
        if (!audio.isBgmEnabled()) toast('配乐已静音，可在设置里打开');
      }
      ctx.rerender();
    }
  };
}
