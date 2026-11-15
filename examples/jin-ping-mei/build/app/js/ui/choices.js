// 选项：普通选择、限时抉择（选项下方一条烧短的灯芯，烧尽即「不作声」）、分岔夜的五扇院门。
import { CAST, doorSrc } from '../story/registry.js';
import { record } from '../store.js';
import { icon } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const PICK_MS = 460;
const EXPIRE_MS = 1200; // 灯芯烧尽后先把「你没开口」摆出来这么久，再走沉默的后果
let live = null; // 当前打开的选项实例

function finish(index, onPick, target = live) {
  if (!target || live !== target || target.picked) return;
  target.picked = true;
  target.stop();
  const root = $('#choices');
  for (const btn of target.buttons) btn.classList.add(Number(btn.dataset.i) === index ? 'taken' : 'gone');
  root.classList.add('leaving');
  target.pickTimer = setTimeout(() => {
    if (live !== target) return;
    root.hidden = true;
    root.innerHTML = '';
    root.className = '';
    live = null;
    onPick(index);
  }, PICK_MS);
}

// timer：{ seconds, paused() }；有它就是限时抉择。onPick(index) 在选项收起之后调用。
export function showChoices(beat, { onPick, timer = null }) {
  closeChoices();
  const root = $('#choices');
  const chosen = (i) => record.chosen.has(`${beat.at}:${i}`);
  let html;
  if (beat.branch) {
    html = `<p class="doors-title">今夜往哪扇门去</p><div class="doors">${beat.options.map((o) => {
      const c = CAST[o.who];
      return `<button type="button" class="door ${o.enabled ? 'lit' : 'dark'}" data-i="${o.i}" ${o.enabled ? '' : 'disabled'} style="--c:${c.color};--glow:${c.glow}">
        <img src="${doorSrc(o.who)}" alt="" draggable="false">
        <span class="door-lamp">${o.enabled ? '灯亮着' : '灯已熄'}</span>
        <span class="door-info"><b>${c.house}</b><em>${c.full}</em>${o.enabled ? `<q>${c.line}</q>` : ''}</span>
      </button>`;
    }).join('')}</div>`;
  } else {
    const list = beat.options.filter((o) => o.enabled && !(timer && o.silent));
    html = `<div class="choice-list">${list.map((o, n) => `
      <button type="button" class="choice${o.silent ? ' silent' : ''}${o.clue ? ' clued' : ''}" data-i="${o.i}">
        <i class="num">${n + 1}</i><span class="choice-text">${o.text}${o.clue ? `<small class="clue">${icon('hide')}看见了「${o.clue}」才说得出口</small>` : ''}</span>${chosen(o.i) ? '<em class="was">已选</em>' : ''}
      </button>`).join('')}</div>${timer ? `
      <div class="wick" role="timer" aria-label="限时抉择">
        <div class="wick-line"><i></i><b></b></div>
        <p class="wick-note">灯芯烧尽之前不开口，就是不作声</p>
      </div>` : ''}`;
  }
  root.className = beat.branch ? 'branch' : timer ? 'timed' : '';
  root.innerHTML = html;
  root.hidden = false;
  const buttons = [...root.querySelectorAll('button[data-i]')];
  const session = {
    beat,
    buttons,
    onPick,
    picked: false,
    expired: false,
    raf1: 0,
    raf2: 0,
    wickRaf: 0,
    pickTimer: 0,
    expireTimer: 0,
    stop() {
      cancelAnimationFrame(this.raf1);
      cancelAnimationFrame(this.raf2);
      cancelAnimationFrame(this.wickRaf);
      clearTimeout(this.pickTimer);
      clearTimeout(this.expireTimer);
    },
  };
  live = session;
  session.raf1 = requestAnimationFrame(() => {
    session.raf2 = requestAnimationFrame(() => {
      if (live === session) root.classList.add('on');
    });
  });
  for (const btn of buttons) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!btn.disabled && live === session) finish(Number(btn.dataset.i), onPick, session);
    });
  }
  if (timer) {
    const silent = beat.options.find((o) => o.silent);
    const wick = root.querySelector('.wick');
    const total = timer.seconds * 1000;
    let left = total;
    let last = performance.now();
    const frame = (now) => {
      if (live !== session) return;
      const dt = Math.min(100, now - last);
      last = now;
      const paused = timer.paused();
      wick.classList.toggle('paused', paused);
      if (!paused) left -= dt;
      wick.style.setProperty('--left', Math.max(0, left / total).toFixed(4));
      wick.classList.toggle('urgent', left < 3000);
      if (left <= 0) {
        // 灯芯烧尽：先让玩家看清楚是时间到了、自己没开口，再演沉默的后果；这期间再按数字键也不算数
        session.expired = true;
        root.classList.add('expired');
        for (const btn of buttons) btn.disabled = true;
        wick.querySelector('.wick-note').textContent = '灯芯烧尽了——你没有开口';
        session.expireTimer = setTimeout(() => { if (live === session) finish(silent.i, onPick, session); }, EXPIRE_MS);
        return;
      }
      session.wickRaf = requestAnimationFrame(frame);
    };
    session.wickRaf = requestAnimationFrame(frame);
  }
}

export const choicesOpen = () => Boolean(live && !live.picked);
export const choicesExpired = () => Boolean(live?.expired && !live.picked);

// 数字键：按屏幕上的第 n 项（与鼠标点同一个按钮同一个结果）。分岔夜的五扇门按位置数，熄了灯的那扇不算。
// 返回 'picked'、'dark'（那扇门灯已熄）或 null
export function pickByNumber(n) {
  if (!live || live.picked || live.expired) return null;
  const btn = live.buttons[n - 1];
  if (!btn) return null;
  if (btn.disabled) return 'dark';
  finish(Number(btn.dataset.i), live.onPick, live);
  return 'picked';
}

// ↑↓ 在选项间移动焦点；回车由按钮自己的点击处理，所以不会误选第一项
export function moveFocus(dir) {
  if (!live || live.picked || live.expired) return;
  const list = live.buttons.filter((b) => !b.disabled);
  const at = list.indexOf(document.activeElement);
  list[(at + dir + list.length) % list.length]?.focus();
}

export function closeChoices() {
  if (live) {
    live.stop();
    live = null;
  }
  const root = $('#choices');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
  root.className = '';
}
