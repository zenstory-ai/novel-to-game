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
// 键盘:回车/空格/→ 推进(简报一.2 全流程键盘)。
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
        name.style.visibility = 'visible';
        name.textContent = TEXT.speakers[line.who] ?? line.who;
      } else {
        portrait.style.visibility = 'hidden';
        name.style.visibility = 'hidden'; // 旁白不留红色空名牌
        name.textContent = '　';
      }
      text.textContent = line.text;
      box.dataset.idx = String(idx);
    }
    function cleanup() {
      window.removeEventListener('keydown', onKey);
    }
    function advance() {
      audio.sfx('click');
      idx += 1;
      if (idx >= lines.length) {
        box.remove();
        cleanup();
        resolve();
      } else {
        render();
      }
    }
    function onKey(ev) {
      if (!box.isConnected) { cleanup(); return; }
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowRight') {
        advance();
        ev.preventDefault();
      }
    }
    box.addEventListener('click', advance);
    window.addEventListener('keydown', onKey);
    render();
  });
}

// ---------- 模态框 ----------
// 键盘:回车/空格=当前聚焦钮(默认首钮),方向键循环,数字键直选(全流程键盘)。
export function showModal(root, { id, title, bodyNodes, buttons }) {
  const mask = el('div', 'modal-mask');
  if (id) mask.id = id;
  const panel = el('div', 'modal-panel');
  addCorners(panel);
  const head = el('div', 'modal-title', title);
  const body = el('div', 'modal-body');
  for (const n of bodyNodes) body.appendChild(n);
  const foot = el('div', 'modal-foot');
  const close = () => {
    mask.remove();
    window.removeEventListener('keydown', onKey);
  };
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
  const btns = [...foot.querySelectorAll('button')];
  let fIdx = 0;
  const applyF = (i) => {
    if (btns.length === 0) return;
    fIdx = ((i % btns.length) + btns.length) % btns.length;
    btns.forEach((b) => b.classList.remove('kbd-focus'));
    btns[fIdx].classList.add('kbd-focus');
  };
  function onKey(ev) {
    if (!mask.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    const k = ev.key;
    if (k === 'Enter' || k === ' ') { btns[fIdx]?.click(); ev.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { applyF(fIdx - 1); ev.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown') { applyF(fIdx + 1); ev.preventDefault(); }
    else if (/^[1-9]$/.test(k)) {
      const b = btns[Number(k) - 1];
      if (b) { b.click(); ev.preventDefault(); }
    }
  }
  window.addEventListener('keydown', onKey);
  applyF(0);
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
    window.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  function onKey(ev) {
    if (!mask.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (ev.key === 'Escape') { close(); ev.preventDefault(); }
  }
  window.addEventListener('keydown', onKey);
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

// ---------- 章节卡(三借递进,简报三.1) ----------
// 一借·被骗 / 二借·假扇 / 三借·真扇:各借开场亮一张全屏字卡,自动消隐。
// pointer-events:none 不拦截输入;fast 模式缩短。
export function chapterCard(root, { title, sub, seal }, fast = false) {
  return new Promise((resolve) => {
    const card = el('div', 'chapter-card');
    const inner = el('div', 'chapter-inner');
    inner.append(el('div', 'chapter-seal', seal), el('div', 'chapter-title', title), el('div', 'chapter-sub', sub));
    card.appendChild(inner);
    root.appendChild(card);
    const hold = fast ? 900 : 1600;
    setTimeout(() => card.classList.add('out'), hold);
    setTimeout(() => {
      card.remove();
      resolve();
    }, hold + 520);
  });
}

// ---------- 飘字 ----------
// cls: dmg / crit / heal / miss / ke / beike / info / combo / huge;slot 错层防叠字
// 横向抖动走确定序列(全项目禁 Math.random,保证同种子可复现约束在代码层处处成立)
let floatTick = 0;
export function floatText(parent, text, cls = 'dmg', slot = 0) {
  const f = el('div', `float-text ${cls}`);
  f.textContent = text;
  floatTick = (floatTick + 1) % 31;
  const x = ((floatTick * 37) % 31) - 15;
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
// 两组分工(简报一.3):左侧队伍相关(角色/背包/召唤兽/阵型),
// 右侧系统相关(存档/读档/音效/帮助)默认收进一个「设」齿轮。
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
  const sys = el('div', 'topbar-sys');
  const gearB = el('button', 'btn topbar-btn');
  gearB.id = 'btn-system';
  gearB.title = TEXT.topbar.systemTip;
  gearB.append(iconBadge('设'), el('span', '', TEXT.topbar.system));
  const drop = el('div', 'topbar-dropdown');
  drop.style.display = 'none';
  const saveB = mk('存', TEXT.topbar.save, 'btn-save', onSave);
  const loadB = mk('读', TEXT.topbar.load, 'btn-load', onLoad);
  const muteB = mk('声', onMute.label(), 'btn-mute', () => {
    onMute.toggle();
    refreshMute();
  });
  const helpB = mk('助', TEXT.topbar.help, 'btn-help', onHelp);
  drop.append(saveB, loadB, muteB, helpB);
  sys.append(gearB, drop);
  right.append(sys);
  const spacer = el('div', 'topbar-spacer');
  const sep = el('div', 'topbar-sep');
  bar.append(title, left, spacer, sep, right);
  root.appendChild(bar);
  const hideDrop = () => {
    drop.style.display = 'none';
    gearB.classList.remove('open');
  };
  gearB.addEventListener('click', () => audio.sfx('click'));
  gearB.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const open = drop.style.display === 'none';
    drop.style.display = open ? 'flex' : 'none';
    gearB.classList.toggle('open', open);
  });
  drop.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) hideDrop();
  });
  document.addEventListener('click', (ev) => {
    if (drop.isConnected && !sys.contains(ev.target)) hideDrop();
  });
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
