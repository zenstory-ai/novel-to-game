// 察言观色：画面停在这场戏的 CG 上，可点的细节多于能看的次数。看见关键物证，后面才多出一句话可说。
// 细节框按百分比放进 CG 的画框里，所以任何宽高比都对得上；键盘用 Tab 逐个选中、回车查看。
import { stage } from '../stage.js';
import { audio } from '../audio.js';

const $ = (sel) => document.querySelector(sel);
let activeLook = null;

// inspect(i) 返回看见的那句话（由运行时记下标记）；say(name, text) 把它交给文本框。
// 返回 Promise<boolean>，在玩家点「不看了／看好了」时为 true，中途读档或退出时为 false。
export function lookAround(beat, { inspect, say }) {
  closeLook();
  const frame = stage.lookFrame();
  const ui = $('#look-ui');
  let left = beat.left;
  const seen = new Set(beat.spots.filter((sp) => sp.seen).map((sp) => sp.i));
  stage.steady(true);

  const layer = document.createElement('div');
  layer.className = 'spots';
  layer.innerHTML = beat.spots.map((sp) => `
    <button type="button" class="spot" data-i="${sp.i}" style="left:${sp.rect[0]}%;top:${sp.rect[1]}%;width:${sp.rect[2]}%;height:${sp.rect[3]}%" aria-label="${sp.name}">
      <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><b class="dot"></b><span class="spot-name">${sp.name}</span>
    </button>`).join('');
  frame.append(layer);

  ui.innerHTML = `
    <div class="look-bar">
      <span class="look-left" aria-live="polite"></span>
      <button type="button" class="btn small" id="look-done"></button>
    </div>
    <div class="look-chips">${beat.spots.map((sp) => `<button type="button" class="chip" data-i="${sp.i}">${sp.name}</button>`).join('')}</div>`;
  ui.hidden = false;
  let closed = false;
  const raf = requestAnimationFrame(() => {
    if (closed) return;
    layer.classList.add('on');
    ui.classList.add('on');
  });

  const paint = () => {
    ui.querySelector('.look-left').innerHTML = `还能看 ${Array.from({ length: beat.max }, (_, n) => `<i class="${n < left ? 'lit' : ''}"></i>`).join('')}`;
    ui.querySelector('#look-done').textContent = left > 0 && seen.size === 0 ? '不看了' : '看好了';
    for (const el of [...layer.querySelectorAll('.spot'), ...ui.querySelectorAll('.chip')]) {
      const i = Number(el.dataset.i);
      el.classList.toggle('seen', seen.has(i));
      el.disabled = seen.has(i) || left <= 0;
    }
    layer.classList.toggle('spent', left <= 0);
  };
  paint();

  return new Promise((resolve) => {
    const chips = ui.querySelector('.look-chips');
    const doneBtn = ui.querySelector('#look-done');
    const look = (i) => {
      if (closed || seen.has(i) || left <= 0) return;
      const spot = beat.spots[i];
      seen.add(i);
      left -= 1;
      audio.se('page');
      say(spot.name, inspect(i));
      if (closed) return;
      paint();
      if (left <= 0) doneBtn.focus();
    };
    const onPick = (e) => {
      const el = e.target.closest('[data-i]');
      if (!el) return;
      e.stopPropagation();
      look(Number(el.dataset.i));
    };
    const hover = (e) => {
      const i = e.target.closest?.('[data-i]')?.dataset.i;
      for (const el of layer.querySelectorAll('.spot')) el.classList.toggle('hot', el.dataset.i === i);
    };
    const cleanup = () => {
      if (closed) return false;
      closed = true;
      cancelAnimationFrame(raf);
      layer.removeEventListener('click', onPick);
      ui.removeEventListener('click', onPick);
      chips.removeEventListener('pointerover', hover);
      layer.remove();
      ui.hidden = true;
      ui.innerHTML = '';
      ui.classList.remove('on');
      stage.steady(false);
      if (activeLook === session) activeLook = null;
      return true;
    };
    const session = { abort: () => { if (cleanup()) resolve(false); } };
    activeLook = session;
    layer.addEventListener('click', onPick);
    ui.addEventListener('click', onPick);
    chips.addEventListener('pointerover', hover);
    doneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cleanup()) resolve(true);
    });
  });
}

export const lookOpen = () => Boolean(activeLook);

export function closeLook() {
  activeLook?.abort();
  const ui = $('#look-ui');
  if (ui) {
    ui.hidden = true;
    ui.innerHTML = '';
    ui.classList.remove('on');
  }
  document.querySelectorAll('.spots').forEach((el) => el.remove());
  stage.steady(false);
}
