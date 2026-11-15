// 极小的 DOM 工具：h() 建节点，其余是事件与等待。

export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = `${el.className} ${v}`.trim();
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clear = (el) => { el.replaceChildren(); return el; };

// 全局节奏：?fast=1 或设置里的「加速」会缩短所有等待与演出
export const pace = { base: 1, speed: 1, get factor() { return this.base / this.speed; } };
export const ms = (t) => Math.max(0, t * pace.factor);
export const wait = (t) => new Promise((resolve) => setTimeout(resolve, ms(t)));
// 字幕、横幅、提示条的停留：按字数给足阅读时间（约每秒 6–7 字再加 0.8 秒），
// 只随测试用的 fast 参数压缩，不随玩家的「演出加速」缩短——加速演出不该让字来不及读
export const readMs = (text) => 800 + [...String(text ?? '').replace(/\s/g, '')].length * 150;
export const holdFor = (hold, text) => Math.max(ms(hold), readMs(text) * pace.base);
export const waitReal = (t) => new Promise((resolve) => setTimeout(resolve, t));
export const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export function icon(src, cls = '') {
  return h(`img.icon${cls ? `.${cls}` : ''}`, { src, alt: '', draggable: false });
}

const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
export { fmt };

// 新出现的可点层（战斗指令台、结算卡、章节卡）：刚出现的一小会儿不认点击与回车；
// 指针点击还要求「按下」发生在可点之后——连点上一段对白的那一下，落不到新出现的按钮上。
export function armGuard(el, delay) {
  const at = performance.now() + delay;
  let downOk = false;
  el.dataset.armed = '0';
  const timer = setTimeout(() => { el.dataset.armed = '1'; }, delay);
  const down = () => { downOk = performance.now() >= at; };
  const click = (e) => { if (performance.now() < at || (e.detail > 0 && !downOk)) { e.stopPropagation(); e.preventDefault(); } };
  el.addEventListener('pointerdown', down, true);
  el.addEventListener('click', click, true);
  return {
    ready: () => performance.now() >= at,
    off() { clearTimeout(timer); el.removeEventListener('pointerdown', down, true); el.removeEventListener('click', click, true); delete el.dataset.armed; },
  };
}
