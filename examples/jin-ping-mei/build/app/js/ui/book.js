// 册页：存档、读档、回看、剧情树、心意、鉴赏、设置共用的一本菜单。左边是签条，右边是内容；
// Esc、右上角关闭、点册页外面，三种方式回到同一处。标题页与游戏里打开的是同一本，只是签条不同。
// 每一页的内容都按可用高度分页（pager.js）：排不下就翻页，不出滚动条；滚轮与 PageUp／PageDown 也是翻页。
import { CAST, HEROINES, ROUTE_MIN, TREE, ENDINGS, ENDING_KIND, faceSrc } from '../story/registry.js';
import { game } from '../game.js';
import { bus } from '../bus.js';
import { audio } from '../audio.js';
import { record, loadSaves, deleteSave, loadNodes, SLOT_COUNT } from '../store.js';
import { icon } from './icons.js';
import { toast, confirmBox, confirmOpen } from './feedback.js';
import { renderSettings } from './book-settings.js';
import { renderGallery } from './book-gallery.js';
import { paginate } from './pager.js';

const $ = (sel) => document.querySelector(sel);
const TABS = {
  save: { label: '存档', icon: 'save' },
  load: { label: '读档', icon: 'load' },
  backlog: { label: '回看', icon: 'backlog' },
  tree: { label: '剧情树', icon: 'tree' },
  hearts: { label: '心意', icon: 'lamp' },
  gallery: { label: '鉴赏', icon: 'gallery' },
  settings: { label: '设置', icon: 'settings' },
};
let state = null; // { tab, page, back, pager }

// 给当前这一页的内容分页；page 为 null 时用 start（回看从最后一页开始）
function paged(body, view, { start = 0 } = {}) {
  view.classList.add('pg-view');
  const bar = document.createElement('div');
  body.append(bar);
  state.pager = paginate(view, bar, { page: state.page ?? start, onChange: (n) => { state.page = n; audio.se('page'); } });
  state.page = state.pager.page;
  return state.pager;
}

const tabsFor = () => {
  if (game.replaying) return ['backlog', 'settings'];
  if (game.active) return ['save', 'load', 'backlog', 'tree', 'hearts', 'settings'];
  return ['load', 'tree', 'gallery', 'settings'];
};

const fmtTime = (t) => {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 存档／读档 ----------
function slotHtml(slot, rec, mode) {
  const label = slot === 'quick' ? '快存' : slot === 'auto' ? '自动' : `第 ${slot} 格`;
  if (!rec) return `<div class="slot empty"><button type="button" class="slot-main" data-slot="${slot}" ${mode === 'load' ? 'disabled' : ''}><span class="slot-thumb"></span><span class="slot-info"><b>${label}</b><em>${mode === 'save' ? '空 · 存在这里' : '空'}</em></span></button></div>`;
  return `<div class="slot">
    <button type="button" class="slot-main" data-slot="${slot}">
      <span class="slot-thumb">${rec.thumb ? `<img src="${rec.thumb}" alt="">` : ''}</span>
      <span class="slot-info"><b>${label} · ${esc(rec.chapter)}</b><em>${rec.name ? `${esc(rec.name)}：` : ''}${esc(rec.text)}</em><time>${fmtTime(rec.time)}</time></span>
    </button>
    ${typeof slot === 'number' || slot === 'quick' ? `<button type="button" class="slot-del" data-del="${slot}" aria-label="删除${label}" title="删除">${icon('trash')}</button>` : ''}
  </div>`;
}

function renderSaves(body, mode) {
  const saves = loadSaves();
  const pinned = mode === 'load' ? ['auto', 'quick'] : ['quick'];
  body.innerHTML = `
    <div class="slots pinned">${pinned.map((s) => slotHtml(s, saves[s], mode)).join('')}</div>
    <div class="slots">${Array.from({ length: SLOT_COUNT }, (_, n) => slotHtml(n + 1, saves[n + 1], mode)).join('')}</div>`;
  paged(body, body.querySelector('.slots:not(.pinned)'));
  body.onclick = async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const slot = /^\d+$/.test(del.dataset.del) ? Number(del.dataset.del) : del.dataset.del;
      if (await confirmBox('删掉这个存档？', { yes: '删除' })) { deleteSave(slot); renderSaves(body, mode); }
      return;
    }
    const main = e.target.closest('.slot-main');
    if (!main || main.disabled) return;
    const slot = /^\d+$/.test(main.dataset.slot) ? Number(main.dataset.slot) : main.dataset.slot;
    const rec = saves[slot];
    if (mode === 'save') {
      if (rec && !(await confirmBox('盖掉这一格原来的存档？', { yes: '覆盖' }))) return;
      const ok = await game.save(slot);
      toast(ok ? '已存档' : '存不进去：浏览器不让写入');
      renderSaves(body, mode);
    } else if (rec) {
      if (game.active && !(await confirmBox('读取这个存档？', { detail: '眼下这一局没存的进度会丢。', yes: '读取' }))) return;
      book.close();
      game.load(rec);
    }
  };
}

// ---------- 回看 ----------
function renderBacklog(body) {
  const log = game.backlog;
  body.innerHTML = log.length
    ? `<ol class="backlog">${log.map((l) => (l.chose
      ? `<li class="chose"><b>你选了</b><p>${esc(l.text)}</p></li>`
      : `<li style="--c:${l.who ? CAST[l.who].color : 'transparent'}">${l.name ? `<b>${esc(l.name)}</b>` : ''}<p>${l.name ? `「${esc(l.text)}」` : esc(l.text)}</p></li>`)).join('')}</ol>`
    : '<p class="empty-note">还没有读过的文字。</p>';
  body.onclick = null;
  // 最近读的在最后一页，打开时停在那里
  if (log.length) paged(body, body.querySelector('.backlog'), { start: 'last' });
}

// ---------- 剧情树 ----------
function renderTree(body) {
  const nodes = loadNodes();
  const here = game.active ? game.chapterLabel() : null;
  const chapters = game.program.chapters;
  body.innerHTML = `<p class="panel-note">到过的章节可以从开头重来；每条线尽头是它的三个结局。</p><div class="tree">${TREE.map((group) => {
    const c = group.who ? CAST[group.who] : null;
    const ends = Object.entries(ENDINGS).filter(([, e]) => e.who === group.who);
    return `<section class="tree-row" style="--c:${c?.color ?? '#8d7a52'};--glow:${c?.glow ?? '#e6cf9a'}">
      <h3>${c ? `<img src="${faceSrc(group.who)}" alt="">` : '<i class="tree-common"></i>'}<span>${group.name}</span></h3>
      <div class="tree-nodes">${group.chapters.map((label) => {
        const ch = chapters[label];
        const open = Boolean(nodes[label]);
        return `<button type="button" class="tree-node${open ? '' : ' locked'}${label === here ? ' here' : ''}" data-label="${label}" ${open ? '' : 'disabled'}>
          ${open ? `<b>${esc(ch.sub || ch.title)}</b>${label === here ? '<em>眼下</em>' : ''}` : `${icon('lock')}<b>未到</b>`}
        </button>`;
      }).join('<i class="tree-link"></i>')}
        <i class="tree-link"></i>
        <div class="tree-ends">${ends.map(([id, e]) => `<span class="tree-end kind-${e.kind}${record.ending.has(id) ? ' got' : ''}" title="${record.ending.has(id) ? e.title : '还没见过'}">${record.ending.has(id) ? `${ENDING_KIND[e.kind]} · ${e.title}` : '？？？'}</span>`).join('')}</div>
      </div>
    </section>`;
  }).join('')}</div>`;
  // 眼下所在的那条线翻到眼前
  const pager = paged(body, body.querySelector('.tree'));
  const hereRow = body.querySelector('.tree-node.here')?.closest('.tree-row');
  if (hereRow && state.treeSeen !== here) { state.treeSeen = here; pager.reveal(hereRow); }
  body.onclick = async (e) => {
    const btn = e.target.closest('.tree-node');
    if (!btn || btn.disabled) return;
    const ch = chapters[btn.dataset.label];
    const detail = game.active ? '眼下这一局没存的进度会丢；心意与记下的话回到当时的样子。' : '心意与记下的话回到当时的样子。';
    if (!(await confirmBox(`从「${ch.sub || ch.title}」重来？`, { detail, yes: '重来' }))) return;
    book.close();
    if (!game.jumpToChapter(btn.dataset.label)) toast('这一章的记录读不出来了');
  };
}

// ---------- 心意 ----------
// 不给数字：只有她眼下的神色，和那扇门的灯
const MOOD = [
  [7, '看你的时候，眼里是软的'], [5, '同你说话，声气松了些'], [3, '肯多看你一眼了'], [1, '客客气气，看不出什么'], [0, '还和从前一样'], [-99, '见了你，脸是冷的'],
];
function renderHearts(body) {
  const aff = game.vars().aff;
  body.innerHTML = `<p class="panel-note">清明席散那一夜，亮着灯的门才进得去。</p><ul class="hearts">${HEROINES.map((h) => {
    const c = CAST[h];
    const lit = aff[h] >= ROUTE_MIN;
    return `<li class="${lit ? 'lit' : 'dim'}" style="--c:${c.color};--glow:${c.glow}">
      <img src="${faceSrc(h)}" alt="">
      <div><b>${c.full}</b><em>${c.house} · ${c.title}</em><p>${MOOD.find(([min]) => aff[h] >= min)[1]}</p></div>
      <span class="heart-lamp">${icon('lamp')}${lit ? '灯亮着' : '灯将熄'}</span>
    </li>`;
  }).join('')}</ul>`;
  body.onclick = null;
  paged(body, body.querySelector('.hearts'));
}

// ---------- 册页框架 ----------
function paint() {
  const root = $('#book');
  const tabs = tabsFor();
  if (!tabs.includes(state.tab)) [state.tab] = tabs;
  root.innerHTML = `
    <div class="book-panel" role="dialog" aria-modal="true" aria-label="${TABS[state.tab].label}">
      <nav class="book-tabs" aria-label="菜单">
        ${tabs.map((t) => `<button type="button" class="${t === state.tab ? 'on' : ''}" data-tab="${t}" aria-current="${t === state.tab}">${icon(TABS[t].icon)}<span>${TABS[t].label}</span></button>`).join('')}
        <i class="grow"></i>
        ${game.active ? `<button type="button" data-tab="@title" class="to-title">${icon('home')}<span>${game.replaying ? '结束回想' : '回到标题'}</span></button>` : ''}
      </nav>
      <div class="book-main">
        <header><h2>${TABS[state.tab].label}</h2><button type="button" class="book-close" aria-label="关闭">${icon('close')}</button></header>
        <div class="book-body" data-tab="${state.tab}" tabindex="-1"></div>
      </div>
    </div>`;
  const body = root.querySelector('.book-body');
  state.pager = null;
  const ctx = { rerender: paint, close: () => book.close(), paged: (view, opts) => paged(body, view, opts), resetPage: () => { state.page = null; } };
  ({
    save: () => renderSaves(body, 'save'),
    load: () => renderSaves(body, 'load'),
    backlog: () => renderBacklog(body),
    tree: () => renderTree(body),
    hearts: () => renderHearts(body),
    gallery: () => renderGallery(body, state, ctx),
    settings: () => renderSettings(body, state, ctx),
  })[state.tab]();
}

function onClick(e) {
  if (e.target === $('#book')) { book.close(); return; }
  if (e.target.closest('.book-close')) { book.close(); return; }
  const tab = e.target.closest('.book-tabs [data-tab]')?.dataset.tab;
  if (!tab) return;
  if (tab === '@title') {
    if (game.replaying) { book.close(); game.command('leave'); return; }
    confirmBox('回到标题？', { detail: '没存的进度会丢；自动存档停在最近一处选择或章节开头。', yes: '回标题' }).then((ok) => { if (ok) { book.close(); game.toTitle(); } });
    return;
  }
  audio.se('page');
  state.tab = tab;
  state.page = null;
  paint();
  $('#book .book-tabs .on')?.focus();
}

function onKey(e) {
  if (!state || confirmOpen()) return;
  if ($('#viewer') && !$('#viewer').hidden) return; // 鉴赏的大图自己管键盘
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); book.close(); return; }
  if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); state.pager?.flip(e.key === 'PageUp' ? -1 : 1); return; }
  if (e.key === 'Tab') {
    const items = [...$('#book').querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')].filter((el) => el.offsetParent);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); items[items.length - 1].focus(); } else if (!e.shiftKey && at === items.length - 1) { e.preventDefault(); items[0].focus(); }
  }
}

// 滚轮翻页：一格一页，连着滚不会一下翻过好几页
let wheelAt = 0;
function onWheel(e) {
  if (!state?.pager || confirmOpen() || e.target.closest('input[type="range"]')) return;
  if (Math.abs(e.deltaY) < 12 || performance.now() - wheelAt < 320) return;
  if (state.pager.flip(e.deltaY > 0 ? 1 : -1)) wheelAt = performance.now();
}
// 窗口大小变了，每页排得下的数量也变了：重新分页
let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state && !confirmOpen()) paint(); }, 150);
}

export const book = {
  get isOpen() { return Boolean(state); },

  open(tab, { gallery = 'cg' } = {}) {
    if (state) return;
    state = { tab, page: null, gallery, setTab: 'read', pager: null, back: document.activeElement };
    const root = $('#book');
    root.hidden = false;
    paint();
    requestAnimationFrame(() => root.classList.add('on'));
    root.addEventListener('click', onClick);
    root.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey, true);
    game.setBookOpen(true);
    audio.se('page');
    (root.querySelector('.book-tabs .on') ?? root.querySelector('button'))?.focus();
  },

  close() {
    if (!state) return;
    const { back } = state;
    state = null;
    const root = $('#book');
    root.classList.remove('on');
    root.removeEventListener('click', onClick);
    root.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey, true);
    root.hidden = true;
    root.innerHTML = '';
    game.setBookOpen(false);
    bus.emit('book-closed');
    // 游戏里不把焦点还给快捷栏按钮：焦点停在它上面时，空格会再把册页打开，而不是往下读
    if (back?.closest?.('#quick')) document.activeElement?.blur?.();
    else if (back?.isConnected && back.offsetParent) back.focus?.();
  },
};
