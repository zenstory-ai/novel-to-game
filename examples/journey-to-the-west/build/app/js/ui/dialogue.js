// 对话、抉择与各种提示层。都挂在 #overlay 上，返回 Promise 以便剧情按顺序写。

import { h, ms, wait, holdFor, readMs, waitReal, armGuard } from '../core/dom.js';
import { SPEAKERS } from '../data/story.js';
import { unitArt, bgArt, itemArt } from '../data/art.js';
import { audio } from '../core/audio.js';

const overlay = () => document.getElementById('overlay');
export const modalOpen = () => !!overlay().querySelector('.mask, .dlg, .chapter');

// 逐行对话。点击、空格或回车推进；字还在打时先补全。选中文字不算点击。
export const SAY_ARM_MS = 350;
export function say(lines) {
  if (!lines?.length) return Promise.resolve();
  return new Promise((resolve) => {
    const figure = h('div.dlg-figure');
    const name = h('div.dlg-name');
    const text = h('div.dlg-text');
    const box = h('div.dlg-box.card', {}, name, text, h('div.dlg-next', {}, '点击或按空格继续', h('i')));
    const skip = h('button.btn.small.dlg-skip', { type: 'button', onclick: (e) => { e.stopPropagation(); finish(); } }, '跳过这段');
    box.append(skip);
    const root = h('div.dlg', { data: { ui: 'dialogue' } }, figure, box);
    let index = -1, timer = 0, full = '', shown = 0, lastWho;

    function finish() {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      root.remove();
      resolve();
    }
    function show() {
      const line = lines[index];
      const sp = line.who ? SPEAKERS[line.who] : null;
      root.dataset.who = line.who ?? 'narration';
      name.textContent = sp?.name ?? '';
      name.classList.toggle('narration', !sp);
      text.classList.toggle('narration', !sp);
      if (sp) {
        const right = ['luosha', 'niumowang', 'yumian', 'yaojiang', 'shibi', 'fakeBajie', 'lingji', 'nezha', 'huobao'].includes(line.who);
        figure.style.backgroundImage = `url(${unitArt(sp.art)})`;
        figure.classList.toggle('right', right);
        figure.style.opacity = 1;
        if (lastWho !== line.who) { figure.classList.remove('enter'); void figure.offsetWidth; figure.classList.add('enter'); }
      } else figure.style.opacity = 0;
      lastWho = line.who;
      full = line.text; shown = 0; text.textContent = '';
      clearInterval(timer);
      const step = ms(22);
      if (step < 4) { shown = full.length; text.textContent = full; return; }
      timer = setInterval(() => {
        shown += 1;
        text.textContent = full.slice(0, shown);
        if (shown >= full.length) clearInterval(timer);
      }, step);
    }
    function advance() {
      if (shown < full.length) { clearInterval(timer); shown = full.length; text.textContent = full; return; }
      index += 1;
      if (index >= lines.length) { finish(); return; }
      audio.sfx('click', { volume: 0.5 });
      show();
    }
    // 刚弹出的一小会儿不认点击和按键：连点战斗里「沿用」或结算「继续」的余波，不该顺手跳过新一段剧情的头一句
    const openedAt = performance.now();
    const settling = () => performance.now() - openedAt < SAY_ARM_MS;
    function onKey(e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat && !settling()) advance(); }
    }
    root.addEventListener('click', () => { if (!settling() && !String(window.getSelection?.() ?? '')) advance(); });
    window.addEventListener('keydown', onKey, true);
    overlay().append(root);
    advance();
  });
}

// 抉择：返回选中的 key。没有取消——剧情抉择必须作答。
// 选项不带默认焦点：空格/回车是读对白的键，连按时不能顺手替玩家定下分支。
// 键盘要先用方向键（或 Tab）挑中一项，且弹出满一小会儿后，回车/空格才算确认；
// 点击也要等弹出满这一小会儿，且按下发生在弹出之后才算。
export const CHOICE_ARM_MS = 450;
export function choose({ title, sub, options, cols = false, id = 'choice' }) {
  return new Promise((resolve) => {
    const list = h(`div.opts${cols ? '.cols' : ''}`);
    const card = h('div.modal.card', { class: cols ? 'wide' : '', tabindex: '-1' }, h('h2', {}, title), sub && h('div.sub', {}, sub), list,
      h('div.opt-hint', {}, '点选一项', h('span.kbd-only', {}, '；用键盘时先按方向键挑中，再按回车确认')));
    const mask = h('div.mask', { data: { ui: id } }, card);
    const shownAt = performance.now();
    const btns = () => [...list.querySelectorAll('.opt')];
    const done = (key) => { window.removeEventListener('keydown', onKey, true); mask.remove(); resolve(key); };
    function onKey(e) {
      if (!mask.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
      const all = btns();
      const at = all.indexOf(document.activeElement);
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (dir) {
        e.preventDefault(); e.stopPropagation();
        // 不回绕：到头就停在头一项或末一项。头一次按键挑中第一项（↓/→）或最后一项（↑/←），
        // 这样横排两张卡时「→ 再 ←」仍落在左边，不会绕到对面去
        const next = at < 0 ? (dir > 0 ? 0 : all.length - 1) : Math.max(0, Math.min(all.length - 1, at + dir));
        all[next]?.focus({ preventScroll: true });
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        // 没挑中选项、或刚弹出（连按空格的余波）：吞掉，不确认也不漏给场景
        if (at < 0 || performance.now() - shownAt < CHOICE_ARM_MS) { e.preventDefault(); e.stopPropagation(); }
      }
    }
    options.forEach((o) => {
      list.append(h('button.opt', {
        type: 'button', data: { key: o.key },
        onclick: () => { audio.sfx('click'); done(o.key); },
      }, o.art && h('div.art', { style: { backgroundImage: `url(assets/treasure/${o.art}.jpg)` } }), h('b', {}, o.label), o.note && h('span', {}, o.note)));
    });
    window.addEventListener('keydown', onKey, true);
    armGuard(mask, CHOICE_ARM_MS); // 指针也一样：连点上一句对白的那一下，不替玩家点中落在同一处的选项
    overlay().append(mask);
    // 焦点放在卡片本身：既不预选第一项，也不让焦点留在背后的场景按钮上
    queueMicrotask(() => card.focus({ preventScroll: true }));
  });
}

// 通用确认框
export function confirmBox({ title, text, yes = '确定', no = '取消', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => { mask.remove(); resolve(v); };
    const mask = h('div.mask', { data: { ui: 'confirm' }, onclick: (e) => { if (e.target === mask) done(false); } },
      h('div.modal.card', {}, h('h2', {}, title), text && h('div.sub', {}, text),
        h('div.row', {}, no && h('button.btn', { type: 'button', data: { act: 'no' }, onclick: () => done(false) }, no), h(`button.btn.${danger ? 'primary' : 'qing'}`, { type: 'button', data: { act: 'yes' }, onclick: () => done(true) }, yes))));
    armGuard(mask, SAY_ARM_MS);
    overlay().append(mask);
  });
}

let toastBox = null;
export function toast(text, kind = '') {
  if (!toastBox?.isConnected) { toastBox = h('div.toasts'); overlay().append(toastBox); }
  const el = h(`div.toast${kind ? `.${kind}` : ''}`, { role: 'status' }, text);
  toastBox.append(el);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  const stay = Math.max(2700, readMs(text));
  el.style.animationDuration = `${stay - 100}ms`;
  setTimeout(() => el.remove(), stay);
}

// 居中金字横幅（升级、任务更新、阶段转换）
export async function banner(title, sub = '', hold = 1500) {
  const el = h('div.banner', {}, h('b', {}, title), sub && h('span', {}, sub));
  const stay = holdFor(hold, `${title}${sub}`);
  el.style.animationDuration = `${stay + ms(900)}ms`;
  overlay().append(el);
  await waitReal(stay);
  setTimeout(() => el.remove(), ms(900));
}

// 章节卡：那一章的战场作底，中间一枚芭蕉扇的圆徽（不用单字印章）
export function chapterCard({ bg, title, sub }) {
  return new Promise((resolve) => {
    audio.sfx('quest');
    const el = h('div.chapter', { data: { ui: 'chapter' }, style: { backgroundImage: `radial-gradient(circle at 50% 45%, rgba(38, 26, 18, 0.62), rgba(10, 6, 3, 0.93) 78%), url(${bgArt(bg)})` } }, h('div.chapter-in', {}, h('div.emblem', {}, h('img', { src: itemArt('truefan'), alt: '' })), h('h1', {}, title), h('i.rule'), h('p', {}, sub)));
    let done = false;
    const finish = () => { if (done) return; done = true; window.removeEventListener('keydown', onKey, true); el.remove(); resolve(); };
    const guard = armGuard(el, SAY_ARM_MS); // 连点上一句对白的余波不跳过章节卡
    const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat && guard.ready()) finish(); } };
    el.addEventListener('click', finish);
    window.addEventListener('keydown', onKey, true);
    overlay().append(el);
    setTimeout(finish, holdFor(2600, `${title}${sub}`));
  });
}

// 入战与换场的墨圈转场：close 收拢到黑，open 再散开
export async function wipe(mode) {
  let el = overlay().querySelector('.wipe');
  if (mode === 'close' && el?.dataset.closed) return;
  if (mode === 'open' && !el) return;
  if (!el) { el = h('div.wipe'); overlay().append(el); }
  if (mode === 'close') el.dataset.closed = '1';
  const dur = ms(420);
  const from = mode === 'close' ? 120 : 0, to = mode === 'close' ? 0 : 120;
  const start = performance.now();
  await new Promise((resolve) => {
    const step = (now) => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1;
      el.style.setProperty('--r', `${from + (to - from) * (t * t * (3 - 2 * t))}%`);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  if (mode === 'open') el.remove();
}

// 指点气泡：贴在某个元素上方；再次调用即替换，传 null 收起
let coachEl = null;
export function coach(text, anchor = null) {
  coachEl?.remove(); coachEl = null;
  if (!text) return;
  coachEl = h('div.coach', { data: { ui: 'coach' }, role: 'status' }, text);
  overlay().append(coachEl);
  const place = () => {
    if (!coachEl) return;
    const a = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
    const w = coachEl.offsetWidth, hgt = coachEl.offsetHeight;
    // 贴在锚点上方；锚点在面板里时，抬到整块面板之上，不压住面板内容
    const host = anchor?.closest?.('.cmd-panel')?.getBoundingClientRect() ?? null;
    let x = a ? a.left + a.width / 2 - w / 2 : window.innerWidth / 2 - w / 2;
    let y = a ? (host ? host.top : a.top) - hgt - 12 : window.innerHeight * 0.2;
    if (a && y < 8) y = a.bottom + 12; // 锚点贴着上缘时改放到它下方
    const clampX = (v) => Math.max(8, Math.min(window.innerWidth - w - 8, v));
    // 战斗里：气泡别压住名牌与血条（玩家这时正要看谁的血少），在几处横向位置里挑压得最少的
    const plates = host ? [...document.querySelectorAll('.unit:not(.gone) .unit-plate')].map((p) => p.getBoundingClientRect()) : [];
    if (plates.length) {
      const cover = (cx) => plates.reduce((n, r) => n + Math.max(0, Math.min(cx + w, r.right) - Math.max(cx, r.left)) * Math.max(0, Math.min(y + hgt, r.bottom) - Math.max(y, r.top)), 0);
      const tries = [x, host.left + 8, host.left + host.width * 0.25 - w / 2, host.left + host.width / 2 - w / 2, host.right - w - 8].map(clampX);
      x = tries.reduce((best, cx) => (cover(cx) < cover(best) - 1 ? cx : best), tries[0]);
    }
    coachEl.style.left = `${clampX(x)}px`;
    coachEl.style.top = `${Math.max(8, y)}px`;
  };
  place();
  requestAnimationFrame(place);
}
