// DOM 助手:元素创建、浮字、模态、传闻卡。全部文案走 text.js。

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function toast(container, text, ms = 2600) {
  const t = el('div', 'toast', text);
  container.appendChild(t);
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}

// 双色浮字:金=明账,墨=暗账,朱=风声。同屏弹出,强化此消彼长。
// 摆位用确定性游标(约束:全局禁 Math.random,画面也保持同种子同观感)。
let floatX = 0;
export function spawnFloats(container, floats) {
  for (const f of floats) {
    floatX = (floatX * 7 + 13) % 31;
    const n = el('div', `float-text ${f.k}`, f.t);
    n.style.left = `${28 + floatX}%`;
    container.appendChild(n);
    setTimeout(() => n.remove(), 2400);
  }
}

// 通用模态:宣纸卡片。options: {title, sub, body, choices:[{id,text,hint,disabled,reason}], onPick, dismissible, portrait:{src,alt}}
// portrait 走专属右栏,与文字区物理隔开:收益提示行任何情况下不被遮挡;底部羽化融进纸面。
export function showModal(root, { id, title, sub, body, choices = [], onPick, dismissible = false, wide = false, portrait = null }) {
  closeModal(root);
  const mask = el('div', 'modal-mask');
  if (id) mask.id = id;
  const card = el('div', `modal-card${wide ? ' wide' : ''}${portrait ? ' has-portrait' : ''}`);
  const main = el('div', 'modal-main');
  if (title) main.appendChild(el('h2', 'modal-title', title));
  if (sub) main.appendChild(el('div', 'modal-sub', sub));
  if (body) {
    const b = el('div', 'modal-body');
    if (typeof body === 'string') b.textContent = body;
    else if (Array.isArray(body)) body.forEach((x) => b.appendChild(x));
    else b.appendChild(body);
    main.appendChild(b);
  }
  if (choices.length) {
    const list = el('div', 'choice-list');
    for (const c of choices) {
      const btn = el('button', 'choice-btn');
      btn.dataset.choice = c.id;
      btn.appendChild(el('span', 'choice-text', c.text));
      if (c.hint) btn.appendChild(el('span', 'choice-hint', c.hint));
      if (c.disabled) {
        btn.disabled = true;
        if (c.reason) btn.appendChild(el('span', 'choice-hint', c.reason));
      }
      btn.addEventListener('click', () => onPick?.(c.id));
      list.appendChild(btn);
    }
    main.appendChild(list);
  }
  card.appendChild(main);
  if (portrait) {
    const lane = el('div', 'modal-fig');
    const img = el('img');
    img.src = portrait.src;
    img.alt = portrait.alt ?? '';
    img.draggable = false;
    lane.appendChild(img);
    card.appendChild(lane);
  }
  if (dismissible) {
    const x = el('button', 'modal-x', '×');
    x.addEventListener('click', () => closeModal(root));
    card.appendChild(x);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeModal(root); });
  }
  mask.appendChild(card);
  root.appendChild(mask);
  return mask;
}

export function closeModal(root) {
  root.querySelector('.modal-mask')?.remove();
}

// 汉字印章按钮(探/结/谋/持/藏):零 emoji、零图标字体
export function sealButton(char, label, onClick) {
  const b = el('button', 'seal-btn');
  const stamp = el('span', 'seal-stamp', char);
  b.appendChild(stamp);
  b.appendChild(el('span', 'seal-label', label));
  b.addEventListener('click', onClick);
  return b;
}
