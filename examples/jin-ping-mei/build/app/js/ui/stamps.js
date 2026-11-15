// 「她记下了」：关键选择之后，在她的人物色里盖一枚印。不出现数字。
import { CAST, faceSrc } from '../story/registry.js';
import { audio } from '../audio.js';

const queue = [];
let busy = false;

function show() {
  if (busy || !queue.length) return;
  busy = true;
  const { who, delta } = queue.shift();
  const c = CAST[who];
  const el = document.createElement('div');
  el.className = `stamp ${delta < 0 ? 'cold' : 'warm'}`;
  el.style.setProperty('--c', c.color);
  el.style.setProperty('--glow', c.glow);
  el.innerHTML = `<img class="stamp-face" src="${faceSrc(who)}" alt=""><span>${delta < 0 ? `${c.name}心里冷了几分` : `${c.name}会记得这句话`}</span>`;
  document.querySelector('#stamps').append(el);
  audio.se('save');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  setTimeout(() => el.classList.add('out'), 3000);
  setTimeout(() => { el.remove(); busy = false; show(); }, 3600);
}

export const stamps = {
  push(who, delta) { queue.push({ who, delta }); },
  // 过场还在演的时候先压着，等它演完或者玩家离开这段过场再盖
  flush() { show(); },
  clear() { queue.length = 0; document.querySelector('#stamps').innerHTML = ''; busy = false; },
  get waiting() { return queue.length; },
};
