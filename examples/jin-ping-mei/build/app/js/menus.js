// 覆盖层菜单：回看记录、存读档、设置、系统菜单与心意、鉴赏（CG／回想／音乐／结局）、退出。
import { CAST, CG, MUSIC, ENDINGS, ENDING_KIND } from './story/index.js';
import { HEROINES, ROUTE_MIN } from './adv.js';
import { config, saveConfig, global, loadSaves, deleteSave, SLOT_PAGES, SLOTS_PER_PAGE, DEFAULT_CONFIG } from './store.js';
import { audio } from './audio.js';
import { cgVisible, cgClass } from './stage.js';
import { story, toTitle, loadSnapshot, saveTo, startReplay, setAuto, setSkip, afterMenuClose, applyBoxAlpha } from './main.js';

const $ = (sel) => document.querySelector(sel);
const overlay = () => $('#overlay');
let current = null;
const trail = []; // 从哪一层进来的：Esc 与「返回」退回上一层
let savePage = 1;
let extrasTab = 'cg';
const backlog = [];
export let closedAt = 0;

export const menuOpen = () => current !== null;
export function pushBacklog(entry) { backlog.push(entry); if (backlog.length > 300) backlog.shift(); }
export function clearBacklog(entries = []) { backlog.splice(0, backlog.length, ...entries); }
export const backlogTail = () => backlog.slice(-80);

export function closeMenu() {
  const was = current;
  current = null;
  trail.length = 0;
  clearInterval(preview.timer);
  overlay().hidden = true;
  overlay().innerHTML = '';
  closedAt = performance.now();
  if (was === null) return;
  audio.play(ingame() ? story.stage.bgm : 'title');
  if (ingame()) afterMenuClose();
}

export function openMenu(kind, sub) {
  setAuto(false);
  setSkip(false);
  trail.length = 0;
  if (kind === 'extras' && sub) extrasTab = sub;
  if (['backlog', 'save', 'load'].includes(kind)) audio.se('page');
  go(kind, false);
}

function go(kind, remember = true) {
  if (remember && current) trail.push(current);
  current = kind;
  overlay().hidden = false;
  overlay().className = `menu-${kind}`;
  render();
}

export function backMenu() {
  const prev = trail.pop();
  if (prev) { current = prev; overlay().className = `menu-${prev}`; render(); } else closeMenu();
}

export function confirmBox(text, yes) {
  confirmState.text = text;
  confirmState.yes = yes;
  if (current) go('confirm');
  else { setAuto(false); setSkip(false); go('confirm', false); }
}

const ingame = () => document.body.dataset.screen === 'game';
const frame = (title, body, extra = '', cls = '') => `
  <div class="panel ${cls}" role="dialog" aria-label="${title}">
    <header><h2>${title}</h2>${extra}<button class="close" data-act="close" aria-label="返回">返回</button></header>
    <div class="panel-body">${body}</div>
  </div>`;

function render() {
  const o = overlay();
  clearInterval(preview.timer);
  if (current === 'backlog') o.innerHTML = frame('回看', `<ol class="backlog">${backlog.map((b) => `<li class="${b.choice ? 'chosen' : ''}">${b.name ? `<b style="color:${b.color ?? '#6b4b2e'}">${b.name}</b>` : ''}<p>${b.text}</p></li>`).join('') || '<li><p>还没有读过的句子。</p></li>'}</ol>`);
  else if (current === 'save' || current === 'load') o.innerHTML = frame(current === 'save' ? '存档' : '读档', slotsHtml(), pagesHtml(), 'slots-panel');
  else if (current === 'config') o.innerHTML = frame('设置', configHtml());
  else if (current === 'system') o.innerHTML = frame('菜单', systemHtml());
  else if (current === 'peek') o.innerHTML = frame('心意', peekHtml());
  else if (current === 'extras') o.innerHTML = frame('鉴赏', extrasHtml(), tabsHtml(), 'tall');
  else if (current === 'exit') o.innerHTML = `<div class="panel small"><h2>已离开</h2><p>浏览器不允许网页自行关闭窗口，你可以直接关掉这个标签页。</p><div class="row"><button class="btn primary" data-act="close">回到标题</button></div></div>`;
  else if (current === 'confirm') o.innerHTML = `<div class="panel small"><p>${confirmState.text}</p><div class="row"><button class="btn primary" data-act="yes">确定</button><button class="btn" data-act="close">取消</button></div></div>`;
  else if (current === 'cgview') o.innerHTML = `<figure class="cgview" data-act="view"><div class="cg-frame"><img class="${cgClass(viewing)}" src="${CG[viewing].src}" alt="${CG[viewing].name}"></div><figcaption>${CG[viewing].name}　·　← → 翻看　点中间关闭</figcaption></figure>`;
  if (current === 'backlog') { const body = o.querySelector('.panel-body'); body.scrollTop = body.scrollHeight; }
  if (current === 'config') startPreview();
  o.querySelector('[data-focus], .panel button:not(.close), .panel button')?.focus({ preventScroll: true });
}

// ---------- 存读档 ----------
function pagesHtml() {
  const pages = [...Array(SLOT_PAGES)].map((_, i) => `<button class="tab ${savePage === i + 1 ? 'on' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('');
  return `<nav class="tabs">${pages}<button class="tab ${savePage === 'q' ? 'on' : ''}" data-page="q">快存／自动</button></nav>`;
}
const slotName = (id) => (id === 'quick' ? '快速存档' : id === 'auto' ? '自动存档' : `No.${id.padStart(2, '0')}`);
function slotsHtml() {
  const saves = loadSaves();
  const ids = savePage === 'q' ? ['quick', 'auto'] : [...Array(SLOTS_PER_PAGE)].map((_, i) => String((savePage - 1) * SLOTS_PER_PAGE + i + 1));
  return `<div class="slots">${ids.map((id) => {
    const s = saves[id];
    const locked = current === 'save' && (id === 'auto' || !ingame() || story.replay);
    return `<button class="slot ${s ? '' : 'empty'}" data-slot="${id}" ${(current === 'load' && !s) || locked ? 'disabled' : ''}>
      <span class="thumb" ${s?.thumb ? `style="background-image:url(${s.thumb})"` : ''}>${s ? '' : '空'}</span>
      <span class="meta"><b>${slotName(id)}</b><em>${s ? s.chapter : '——'}</em><small>${s ? s.date : ''}</small><q>${s?.text ?? ''}</q></span>
    </button>`;
  }).join('')}</div><p class="count slot-hint">右键点一份存档，可以删掉它。</p>`;
}

// ---------- 设置 ----------
const preview = { timer: null };
const PREVIEW_LINE = '金莲：「官人，这字走得快些，还是慢些？」';
function startPreview() {
  clearInterval(preview.timer);
  const el = $('#cfg-type');
  if (!el) return;
  let start = performance.now();
  preview.timer = setInterval(() => {
    if (config.textSpeed >= 100) { el.textContent = PREVIEW_LINE; return; }
    const shown = Math.floor(((performance.now() - start) * config.textSpeed) / 1000);
    el.textContent = PREVIEW_LINE.slice(0, shown);
    if (shown > PREVIEW_LINE.length + config.textSpeed) start = performance.now(); // 停一秒再重打
  }, 16);
}
function configHtml() {
  const out = (key) => (key === 'textSpeed' && config[key] >= 100 ? '瞬间' : config[key]);
  const range = (key, label, min = 0, max = 100) => `<label class="cfg"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${config[key]}" data-cfg="${key}"><output>${out(key)}</output></label>`;
  const toggle = (key, label, hint) => `<label class="cfg toggle"><span>${label}<small>${hint}</small></span><input type="checkbox" ${config[key] ? 'checked' : ''} data-cfg="${key}"></label>`;
  return `<div class="cfg-grid">
    ${range('textSpeed', '文字速度', 10)}
    ${range('autoSpeed', '自动速度')}
    ${range('bgm', '背景音乐')}
    ${range('se', '音效')}
    ${range('boxAlpha', '文字框浓淡', 40)}
    ${toggle('skipUnread', '快进未读文字', '关闭时，快进只跳过读过的句子')}
    ${toggle('adult', '成人画面', '关闭后，亲密 CG 以帘幕代替')}
  </div>
  <p class="cfg-preview"><span id="cfg-type"></span></p>
  <p class="cfg-keys">点击推进　右键隐藏　滚轮上翻回看　按住 Ctrl 快进　A 自动　← 上一选项　Esc 菜单</p>
  <div class="row"><button class="btn" data-act="fullscreen">全屏切换</button><button class="btn" data-act="defaults">恢复默认</button></div>`;
}

// ---------- 系统菜单与心意 ----------
function systemHtml() {
  return `<div class="sys">
    <button class="btn" data-go="save" ${story.replay ? 'disabled' : ''}>存档</button>
    <button class="btn" data-go="load">读档</button>
    <button class="btn" data-go="config">设置</button>
    <button class="btn" data-go="peek" ${story.replay ? 'disabled' : ''}>心意</button>
    <button class="btn" data-go="backlog">回看记录</button>
    <button class="btn" data-act="title">回到标题</button>
    <button class="btn primary" data-act="close" data-focus>继续游戏</button>
  </div>`;
}
// 心意一瞥只给她的神色和院门灯，不给档位
function peekHtml() {
  return `<p class="peek-note">只是一眼。清明席散之后，只有还为你亮着灯的门，才会开。</p><div class="peek">${HEROINES.map((h) => {
    const v = story.vars.aff[h] ?? 0;
    const face = v >= 6 ? 'blush' : v >= 1 ? 'smile' : 'neutral';
    const lit = v >= ROUTE_MIN;
    return `<div class="peek-card" style="--accent:${CAST[h].color}"><img src="assets/sprite/${h}/${face}.webp" alt=""><b>${CAST[h].full}</b><span class="lantern ${lit ? 'lit' : 'dim'}">${lit ? '灯亮着' : '灯将熄'}</span></div>`;
  }).join('')}</div>`;
}

// ---------- 鉴赏 ----------
const TABS = { cg: 'CG', scene: '回想', music: '音乐', ending: '结局' };
function tabsHtml() {
  return `<nav class="tabs">${Object.entries(TABS).map(([k, v]) => `<button class="tab ${extrasTab === k ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</nav>`;
}
const SCENES = [
  ['yue_night', 'yue_good', 'yue', '月下焚香'], ['pan_night', 'pan_good', 'pan', '琵琶不冷'], ['pinger_night', 'pinger_good', 'pinger', '钥匙在她手里'],
  ['meng_night', 'meng_good', 'meng', '她自己开的门'], ['xuee_night', 'xuee_good', 'xuee', '天亮前的两碗粥'],
];
const cgGroup = (id) => CG[id].group ?? HEROINES.find((h) => id.startsWith(`${h}_`)) ?? 'common';
const GROUPS = ['common', ...HEROINES];
// 鉴赏里的顺序：先共通，再按五人分组；大图左右翻看也按这个顺序
const galleryIds = () => Object.keys(CG).filter((id) => id !== 'title').sort((a, b) => GROUPS.indexOf(cgGroup(a)) - GROUPS.indexOf(cgGroup(b)));
const viewable = () => galleryIds().filter((id) => global.cg.has(id) && cgVisible(id));
function extrasHtml() {
  if (extrasTab === 'cg') {
    const ids = galleryIds();
    const open = ids.filter((id) => global.cg.has(id)).length;
    const groups = GROUPS.map((g) => {
      const members = ids.filter((id) => cgGroup(id) === g);
      const got = members.filter((id) => global.cg.has(id)).length;
      return `<h3 class="cg-group">${g === 'common' ? '共通' : CAST[g].name}<small>${got} / ${members.length}</small></h3><div class="cg-grid">${members.map((id) => {
        const unlocked = global.cg.has(id);
        const show = unlocked && cgVisible(id);
        return `<button class="cg-cell ${unlocked ? '' : 'locked'}" data-cg="${id}" ${show ? '' : 'disabled'}>${show ? `<span class="cg-thumb"><img loading="lazy" class="${cgClass(id)}" src="${CG[id].src}" alt=""></span>` : `<span>${unlocked ? '帘' : '？'}</span>`}<small>${unlocked ? CG[id].name : '未解锁'}</small></button>`;
      }).join('')}</div>`;
    }).join('');
    return `<p class="count">已收集 ${open} / ${ids.length}</p>${groups}`;
  }
  if (extrasTab === 'scene') {
    return `<div class="scene-list">${SCENES.map(([id, label, who, title]) => {
      const ok = global.scene.has(id);
      return `<button class="scene-cell" style="--accent:${CAST[who].color}" data-replay="${label}" ${ok ? '' : 'disabled'}><img src="assets/sprite/${who}/${ok ? 'blush' : 'neutral'}.webp" alt=""><b>${ok ? title : '？？？'}</b><small>${CAST[who].full} · ${ok ? '良缘之夜' : '走到她的良缘结局后解锁'}</small></button>`;
    }).join('')}</div>`;
  }
  if (extrasTab === 'music') {
    return `<ol class="music">${Object.entries(MUSIC).map(([id, name], i) => {
      const ok = global.music.has(id);
      return `<li><button class="btn ${ok && audio.track?.id === id ? 'primary' : ''}" data-music="${id}" ${ok ? '' : 'disabled'}>${String(i + 1).padStart(2, '0')}　${ok ? name : '？？？'}</button></li>`;
    }).join('')}</ol>`;
  }
  const cell = (id) => {
    const e = ENDINGS[id];
    const ok = global.ending.has(id);
    return `<div class="end-cell ${e.kind} ${ok ? 'ok' : ''}"><small>${ENDING_KIND[e.kind]}</small><b>${ok ? e.title : '？？？'}</b></div>`;
  };
  const total = Object.keys(ENDINGS).length;
  return `<p class="count">已到达 ${[...global.ending].filter((id) => ENDINGS[id]).length} / ${total}</p>
  <div class="flow"><div class="flow-root">共通线 · 序章～清明荷亭</div>
    <div class="flow-routes">${HEROINES.map((h) => `<div class="flow-col" style="--accent:${CAST[h].color}"><div class="flow-head">${CAST[h].full}篇</div>${['good', 'normal', 'bad'].map((k) => cell(`${h}_${k}`)).join('')}</div>`).join('')}
    <div class="flow-col lonely"><div class="flow-head">无人留灯</div>${cell('lonely')}</div></div></div>`;
}

// ---------- 交互 ----------
const confirmState = { text: '', yes: null };
let viewing = null;
function stepCg(dir) {
  const ids = viewable();
  if (!ids.length) return;
  viewing = ids[(ids.indexOf(viewing) + dir + ids.length) % ids.length];
  render();
}

overlay().addEventListener('click', async (e) => {
  const t = e.target.closest('button, figure');
  if (!t) return;
  audio.se('click');
  const d = t.dataset;
  if (d.act === 'close') backMenu();
  else if (d.act === 'view') { const x = e.clientX / window.innerWidth; if (x < 1 / 3) stepCg(-1); else if (x > 2 / 3) stepCg(1); else backMenu(); }
  else if (d.act === 'yes') { const fn = confirmState.yes; confirmState.yes = null; await fn?.(); }
  else if (d.act === 'title') confirmBox('回到标题？未存档的进度会丢失。', toTitle);
  else if (d.act === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
  else if (d.act === 'defaults') { Object.assign(config, DEFAULT_CONFIG, { adult: config.adult }); saveConfig(); audio.setVolumes(config.bgm, config.se); applyBoxAlpha(); render(); }
  else if (d.go) go(d.go);
  else if (d.page) { savePage = d.page === 'q' ? 'q' : Number(d.page); render(); }
  else if (d.tab) { extrasTab = d.tab; render(); }
  else if (d.slot) {
    const record = loadSaves()[d.slot];
    if (current === 'load') loadSnapshot(record);
    else if (record) confirmBox(`覆盖 ${slotName(d.slot)} 的存档？`, async () => { await saveTo(d.slot); backMenu(); });
    else { await saveTo(d.slot); render(); }
  } else if (d.cg) { viewing = d.cg; go('cgview'); }
  else if (d.replay) startReplay(d.replay);
  else if (d.music) { audio.play(d.music); render(); }
});

overlay().addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const slot = e.target.closest('[data-slot]')?.dataset.slot;
  if (slot && loadSaves()[slot] && (current === 'save' || current === 'load')) {
    confirmBox(`删除 ${slotName(slot)} 的存档？`, () => { deleteSave(slot); backMenu(); });
  } else backMenu();
});
overlay().addEventListener('wheel', (e) => {
  if (current !== 'backlog' || e.deltaY <= 0) return;
  const body = overlay().querySelector('.panel-body');
  if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) closeMenu();
}, { passive: true });
overlay().addEventListener('input', (e) => {
  const key = e.target.dataset.cfg;
  if (!key) return;
  config[key] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
  saveConfig();
  audio.setVolumes(config.bgm, config.se);
  if (key === 'boxAlpha') applyBoxAlpha();
  if (key === 'textSpeed') startPreview();
  const out = e.target.parentElement.querySelector('output');
  if (out) out.textContent = key === 'textSpeed' && config[key] >= 100 ? '瞬间' : config[key];
});
document.addEventListener('keydown', (e) => {
  if (current !== 'cgview') return;
  if (e.key === 'ArrowLeft') stepCg(-1);
  else if (e.key === 'ArrowRight') stepCg(1);
});
