// 通用 DOM 组件:对话框(梦幻风底框+头像+文字)、弹窗、飘字、提示条。

import { TEXT } from './text.js';
import { unitURL } from './assets.js';
import { audio } from './audio.js';

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 汉字金框徽(图标回退策略:字形+金框)
export function iconBadge(char, { round = false, sm = false } = {}) {
  const b = el('span', `icon-badge${round ? ' round' : ''}${sm ? ' sm' : ''}`, char);
  return b;
}

// 四角木刻角饰
export function addCorners(panel) {
  for (const c of ['tl', 'tr', 'bl', 'br']) panel.appendChild(el('span', `corner ${c}`));
}

// ---------- 剧情对话框 ----------
// lines: [{who, text}]  who=null 为旁白。返回 Promise,播完 resolve。
export function showDialog(root, lines) {
  return new Promise((resolve) => {
    let idx = 0;
    const box = el('div', 'dlg-box');
    box.id = 'dialog';
    addCorners(box);
    const portrait = el('img', 'dlg-portrait');
    const right = el('div', 'dlg-right');
    const name = el('div', 'dlg-name');
    const text = el('div', 'dlg-text');
    const next = el('div', 'dlg-next', TEXT.ui.clickNext);
    right.append(name, text, next);
    box.append(portrait, right);
    root.appendChild(box);

    function render() {
      const line = lines[idx];
      if (line.who) {
        portrait.src = unitURL(line.who, TEXT.speakers[line.who] ?? line.who);
        portrait.style.visibility = 'visible';
        name.textContent = TEXT.speakers[line.who] ?? line.who;
      } else {
        portrait.style.visibility = 'hidden';
        name.textContent = '　';
      }
      text.textContent = line.text;
      box.dataset.idx = String(idx);
    }
    function advance() {
      audio.sfx('click');
      idx += 1;
      if (idx >= lines.length) {
        box.remove();
        resolve();
      } else {
        render();
      }
    }
    box.addEventListener('click', advance);
    render();
  });
}

// ---------- 模态框 ----------
export function showModal(root, { id, title, bodyNodes, buttons }) {
  const mask = el('div', 'modal-mask');
  if (id) mask.id = id;
  const panel = el('div', 'modal-panel');
  addCorners(panel);
  const head = el('div', 'modal-title', title);
  const body = el('div', 'modal-body');
  for (const n of bodyNodes) body.appendChild(n);
  const foot = el('div', 'modal-foot');
  const close = () => mask.remove();
  for (const b of buttons) {
    const btn = el('button', 'btn modal-btn', b.label);
    if (b.id) btn.id = b.id;
    btn.addEventListener('click', () => audio.sfx('click'));
    btn.addEventListener('click', () => {
      if (b.onClick) b.onClick();
      if (b.close !== false) close();
    });
    foot.appendChild(btn);
  }
  panel.append(head, body, foot);
  mask.appendChild(panel);
  root.appendChild(mask);
  return close;
}

// ---------- 统一面板(右上木刻×关闭;供 背包/召唤兽/角色/阵型/帮助 复用) ----------
export function showPanel(root, { id, title, bodyNodes, onClose }) {
  const mask = el('div', 'modal-mask');
  if (id) mask.id = id;
  const panel = el('div', 'modal-panel');
  addCorners(panel);
  const head = el('div', 'modal-title', title);
  const closeBtn = el('button', 'panel-close', '×');
  closeBtn.id = `${id}-close`;
  const body = el('div', 'modal-body');
  for (const n of bodyNodes) body.appendChild(n);
  const close = () => {
    mask.remove();
    if (onClose) onClose();
  };
  closeBtn.addEventListener('click', () => audio.sfx('click'));
  closeBtn.addEventListener('click', close);
  mask.addEventListener('click', (ev) => {
    if (ev.target === mask) close();
  });
  panel.append(head, closeBtn, body);
  mask.appendChild(panel);
  root.appendChild(mask);
  return close;
}

// ---------- 轻提示 ----------
export function toast(root, msg, ms = 2600) {
  const t = el('div', 'toast', msg);
  root.appendChild(t);
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, ms);
}

// ---------- 飘字 ----------
// cls: dmg / crit / heal / miss / ke / beike / info / combo / huge;slot 错层防叠字
export function floatText(parent, text, cls = 'dmg', slot = 0) {
  const f = el('div', `float-text ${cls}`);
  f.textContent = text;
  const x = (Math.random() - 0.5) * 30;
  f.style.left = `calc(50% + ${x}px)`;
  f.style.top = `${slot * 30}px`;
  parent.appendChild(f);
  setTimeout(() => f.remove(), 1400);
  return f;
}

// 「克!」「暴击」印章
export function stampText(parent, text, cls = 'ke-stamp') {
  const f = el('div', `float-stamp ${cls}`);
  f.textContent = text;
  parent.appendChild(f);
  setTimeout(() => f.remove(), 1100);
  return f;
}

// ---------- 顶栏 ----------
export function buildTopbar(root, { onSave, onLoad, onFormation, onHelp, onMute, onHero, onBag, onPet }) {
  const bar = el('div', 'topbar');
  bar.id = 'topbar';
  const title = el('div', 'topbar-title', TEXT.gameTitle);
  const mk = (iconChar, label, id, fn) => {
    const b = el('button', 'btn topbar-btn');
    b.id = id;
    b.append(iconBadge(iconChar), el('span', '', label));
    b.addEventListener('click', () => audio.sfx('click'));
    b.addEventListener('click', fn);
    return b;
  };
  const left = el('div', 'topbar-group');
  const heroB = mk('角', TEXT.topbar.hero, 'btn-hero', onHero);
  const bagB = mk('囊', TEXT.topbar.bag, 'btn-bag', onBag);
  const petB = mk('兽', TEXT.topbar.pet, 'btn-pet', onPet);
  const formB = mk('阵', TEXT.topbar.formation, 'btn-formation', onFormation);
  left.append(heroB, bagB, petB, formB);
  const right = el('div', 'topbar-group');
  const saveB = mk('存', TEXT.topbar.save, 'btn-save', onSave);
  const loadB = mk('读', TEXT.topbar.load, 'btn-load', onLoad);
  const muteB = mk('声', onMute.label(), 'btn-mute', () => {
    onMute.toggle();
    refreshMute();
  });
  const helpB = mk('助', TEXT.topbar.help, 'btn-help', onHelp);
  right.append(saveB, loadB, muteB, helpB);
  const spacer = el('div', 'topbar-spacer');
  const sep = el('div', 'topbar-sep');
  bar.append(title, left, spacer, sep, right);
  root.appendChild(bar);
  const panelBtns = { hero: heroB, bag: bagB, pet: petB, formation: formB };
  function refreshMute() {
    muteB.textContent = '';
    muteB.append(iconBadge('声'), el('span', '', onMute.label()));
  }
  return {
    setOpen(key) {
      for (const [k, b] of Object.entries(panelBtns)) b.classList.toggle('open', k === key);
    },
  };
}

// ---------- 即时小卡片(首次相关时弹一次) ----------
export function onceCard(root, key, title, lines) {
  const flag = `xiyou_card_${key}`;
  if (localStorage.getItem(flag)) return Promise.resolve(false);
  localStorage.setItem(flag, '1');
  return new Promise((resolve) => {
    showModal(root, {
      id: 'modal-once',
      title,
      bodyNodes: lines.map((l) => el('p', 'tutorial-line', l)),
      buttons: [{ label: '知道了', id: 'btn-once-close', onClick: () => resolve(true) }],
    });
  });
}

// ---------- 阵型弹窗 ----------
export function showFormationModal(root, { current, formations, onPick }) {
  const body = [];
  for (const f of Object.values(formations)) {
    const row = el('div', 'formation-row' + (f.key === current ? ' current' : ''));
    row.dataset.formation = f.key;
    const name = el('div', 'formation-name', `${f.name}${f.key === current ? ' (使用中)' : ''}`);
    const desc = el('div', 'formation-desc', f.desc);
    row.append(name, desc);
    row.addEventListener('click', () => onPick(f.key));
    body.push(row);
  }
  const close = showModal(root, {
    id: 'modal-formation',
    title: `${TEXT.topbar.formation} · ${TEXT.ui.formationNow}`,
    bodyNodes: body,
    buttons: [{ label: '关闭', id: 'btn-formation-close' }],
  });
  return close;
}
