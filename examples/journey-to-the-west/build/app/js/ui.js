// 通用 DOM 组件：对话框(梦幻风底框+头像+文字)、弹窗、飘字、提示条。

import { TEXT } from './text.js';
import { unitURL } from './assets.js';
import { audio } from './audio.js';
import { getSpeed, setSpeed, getSkipFx, setSkipFx, getShake, setShake } from './settings.js';

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 汉字金框徽(图标回退策略：字形+金框)
export function iconBadge(char, { round = false, sm = false } = {}) {
  const b = el('span', `icon-badge${round ? ' round' : ''}${sm ? ' sm' : ''}`, char);
  return b;
}

// 操作图标使用实际美术资产；名称仍由相邻文字与 aria-label 承担，图片不重复朗读。
export function artIcon(name, cls = '') {
  const img = el('img', `ui-art-icon${cls ? ` ${cls}` : ''}`);
  img.src = `assets/ui/${name}.webp`;
  img.alt = '';
  img.draggable = false;
  img.setAttribute('aria-hidden', 'true');
  return img;
}

// 四角木刻角饰
export function addCorners(panel) {
  for (const c of ['tl', 'tr', 'bl', 'br']) panel.appendChild(el('span', `corner ${c}`));
}

// ---------- 遮罩计数：模态/对话在场时，战斗底部指令台随之一并压暗(简报 T8) ----------
let modalDepth = 0;
let dlgDepth = 0;
let shadeGeneration = 0;
let modalLabelSeq = 0;
function shadeOn(kind) {
  if (kind === 'modal') modalDepth += 1; else dlgDepth += 1;
  document.body.classList.add(kind === 'modal' ? 'modal-open' : 'dlg-open');
  return shadeGeneration;
}
function shadeOff(kind, ownerGeneration) {
  if (ownerGeneration !== shadeGeneration) return;
  if (kind === 'modal') modalDepth = Math.max(0, modalDepth - 1);
  else dlgDepth = Math.max(0, dlgDepth - 1);
  const cls = kind === 'modal' ? 'modal-open' : 'dlg-open';
  if ((kind === 'modal' ? modalDepth : dlgDepth) === 0) document.body.classList.remove(cls);
}

// 切场会直接回收旧 screen；同时归零计数，避免被回收的遮罩把后续指令台永久压暗。
export function resetOverlayShading() {
  shadeGeneration += 1;
  modalDepth = 0;
  dlgDepth = 0;
  document.body.classList.remove('modal-open', 'dlg-open');
}

// ---------- 剧情对话框 ----------
// lines: [{who, text}]  who=null 为旁白。返回 Promise,播完 resolve。
// 键盘：回车/空格/→ 推进(简报一.2 全流程键盘)。
export function showDialog(root, lines) {
  return new Promise((resolve) => {
    let idx = 0;
    const box = el('div', 'dlg-box');
    box.id = 'dialog';
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', '继续对话');
    const stage = el('div', 'dlg-stage');
    stage.setAttribute('aria-hidden', 'true');
    const portrait = el('img', 'dlg-portrait');
    portrait.alt = '';
    stage.appendChild(portrait);
    const right = el('div', 'dlg-right');
    const name = el('div', 'dlg-name');
    const text = el('div', 'dlg-text');
    const next = el('div', 'dlg-next', TEXT.ui.clickNext);
    right.append(name, text, next);
    box.append(right);
    root.append(stage, box);
    const ownerGeneration = shadeOn('dlg');
    // 每句刚出现的一小段时间里不收输入：连点/按住回车不会把下一句(或下一段对话的第一句)吞掉
    let readyAt = 0;

    function render() {
      const line = lines[idx];
      stage.hidden = !line.who;
      box.classList.toggle('narration', !line.who);
      if (line.who) {
        // 假八戒沿用八戒面貌；不知道真身前不能由头像提前揭露。
        const portraitKey = { fakeBajie: 'bajie', huobao: 'mob_fire1' }[line.who] ?? line.who;
        portrait.src = unitURL(portraitKey, TEXT.speakers[line.who] ?? line.who);
        portrait.style.visibility = 'visible';
        name.hidden = false;
        name.textContent = TEXT.speakers[line.who] ?? line.who;
      } else {
        portrait.style.visibility = 'hidden';
        name.hidden = true; // 旁白不留空名牌行
        name.textContent = '';
      }
      text.textContent = line.text;
      next.textContent = `${TEXT.ui.clickNext}  ·  ${idx + 1} / ${lines.length}`;
      box.dataset.idx = String(idx);
      readyAt = performance.now() + 180;
    }
    function cleanup() {
      window.removeEventListener('keydown', onKey);
      shadeOff('dlg', ownerGeneration);
    }
    function advance() {
      if (performance.now() < readyAt) return;
      audio.sfx('click');
      idx += 1;
      if (idx >= lines.length) {
        box.remove();
        stage.remove();
        cleanup();
        resolve();
      } else {
        render();
      }
    }
    function onKey(ev) {
      if (!box.isConnected) { cleanup(); return; }
      if (root.querySelector('.modal-mask')) return;
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        if (ev.repeat) return; // 按住回车不连跳
        advance();
      }
    }
    box.addEventListener('click', advance);
    window.addEventListener('keydown', onKey);
    render();
  });
}

// ---------- 模态框 ----------
function trapPanelFocus(panel, ev) {
  if (ev.key !== 'Tab') return false;
  const focusable = [...panel.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) {
    panel.focus();
    ev.preventDefault();
    return true;
  }
  const current = focusable.indexOf(document.activeElement);
  const next = ev.shiftKey
    ? (current <= 0 ? focusable.length - 1 : current - 1)
    : (current === focusable.length - 1 ? 0 : current + 1);
  focusable[next].focus();
  ev.preventDefault();
  return true;
}

// 键盘：回车/空格=当前聚焦钮(默认首钮)，方向键循环，数字键直选(全流程键盘)。
export function showModal(root, { id, title, bodyNodes, buttons, focusables = null }) {
  root.querySelectorAll('.big-toast').forEach((n) => n.remove()); // 大字提示不压在弹窗上
  const previousFocus = document.activeElement;
  const mask = el('div', 'modal-mask panel-overlay');
  if (id) mask.id = id;
  const panel = el('div', `modal-panel panel-shell${id ? ` panel-${id.replace(/^modal-/, '')}` : ''}`);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('tabindex', '-1');
  addCorners(panel);
  const head = el('div', 'modal-title', title);
  head.id = `${id || `modal-${++modalLabelSeq}`}-title`;
  panel.setAttribute('aria-labelledby', head.id);
  const body = el('div', 'modal-body');
  for (const n of bodyNodes) body.appendChild(n);
  const foot = el('div', 'modal-foot');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    shadeOff('modal', ownerGeneration);
    mask.remove();
    window.removeEventListener('keydown', onKey);
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  for (const b of buttons) {
    const btn = el('button', 'btn modal-btn', b.label);
    if (b.id) btn.id = b.id;
    btn.disabled = Boolean(b.disabled);
    btn.addEventListener('click', () => audio.sfx('click'));
    btn.addEventListener('click', () => {
      if (b.onClick) b.onClick();
      if (b.close !== false) close();
    });
    foot.appendChild(btn);
  }
  const escapeButton = [...foot.querySelectorAll('button:not(:disabled)')]
    .find((btn) => /(?:close|cancel)/i.test(btn.id));
  const topClose = escapeButton ? el('button', 'panel-close', '×') : null;
  if (topClose) {
    topClose.type = 'button';
    topClose.id = `${id || 'modal'}-x`;
    topClose.setAttribute('aria-label', `关闭${title}`);
    topClose.addEventListener('click', () => escapeButton.click());
  }
  const btns = (focusables?.length ? [...focusables] : [...foot.querySelectorAll('button')])
    .filter((btn) => !btn.disabled);
  if (!buttons.length) foot.hidden = true;
  let fIdx = 0;
  const applyF = (i) => {
    if (btns.length === 0) return;
    fIdx = ((i % btns.length) + btns.length) % btns.length;
    btns.forEach((b) => b.classList.remove('kbd-focus'));
    btns[fIdx].classList.add('kbd-focus');
    if (btns[fIdx].isConnected) btns[fIdx].focus();
  };
  function onKey(ev) {
    if (!mask.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    const topMask = [...root.querySelectorAll('.modal-mask')].at(-1);
    if (topMask !== mask) return;
    const k = ev.key;
    if (trapPanelFocus(panel, ev)) return;
    if (ev.repeat && (k === 'Enter' || k === ' ')) { ev.preventDefault(); return; }
    if (k === 'Enter' || k === ' ') {
      const focusedButton = document.activeElement instanceof HTMLElement
        ? document.activeElement.closest('button:not(:disabled)')
        : null;
      (focusedButton && panel.contains(focusedButton) ? focusedButton : btns[fIdx])?.click();
      ev.preventDefault();
    }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') {
      const activeIdx = btns.indexOf(document.activeElement);
      applyF((activeIdx >= 0 ? activeIdx : fIdx) - 1);
      ev.preventDefault();
    }
    else if (k === 'ArrowRight' || k === 'ArrowDown') {
      const activeIdx = btns.indexOf(document.activeElement);
      applyF((activeIdx >= 0 ? activeIdx : fIdx) + 1);
      ev.preventDefault();
    }
    else if (/^[1-9]$/.test(k)) {
      const b = btns[Number(k) - 1];
      if (b) { b.click(); ev.preventDefault(); }
    } else if (k === 'Escape' && escapeButton) { escapeButton.click(); ev.preventDefault(); }
  }
  window.addEventListener('keydown', onKey);
  applyF(0);
  panel.append(head);
  if (topClose) panel.appendChild(topClose);
  panel.append(body, foot);
  mask.appendChild(panel);
  root.appendChild(mask);
  const ownerGeneration = shadeOn('modal');
  queueMicrotask(() => {
    if (!mask.isConnected) return;
    (btns[0] || panel).focus();
  });
  return close;
}

// ---------- 统一面板(右上木刻×关闭;供 背包/召唤兽/角色/阵型/帮助 复用) ----------
export function showPanel(root, { id, title, bodyNodes, onClose }) {
  root.querySelectorAll('.big-toast').forEach((n) => n.remove());
  const previousFocus = document.activeElement;
  const mask = el('div', 'modal-mask panel-overlay');
  if (id) mask.id = id;
  const panel = el('div', `modal-panel panel-shell${id ? ` panel-${id.replace(/^modal-/, '')}` : ''}`);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('tabindex', '-1');
  addCorners(panel);
  const head = el('div', 'modal-title', title);
  head.id = `${id || `panel-${++modalLabelSeq}`}-title`;
  panel.setAttribute('aria-labelledby', head.id);
  const closeBtn = el('button', 'panel-close', '×');
  closeBtn.id = `${id}-close`;
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', `关闭${title}`);
  const body = el('div', 'modal-body');
  for (const n of bodyNodes) body.appendChild(n);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    shadeOff('modal', ownerGeneration);
    mask.remove();
    window.removeEventListener('keydown', onKey);
    if (onClose) onClose();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  function onKey(ev) {
    if (!mask.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    const topMask = [...root.querySelectorAll('.modal-mask')].at(-1);
    if (topMask !== mask) return;
    if (trapPanelFocus(panel, ev)) return;
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
  const ownerGeneration = shadeOn('modal');
  queueMicrotask(() => {
    if (mask.isConnected) closeBtn.focus();
  });
  return close;
}

// ---------- 画风内的确认框(替代浏览器原生 confirm) ----------
export function confirmModal(root, { title, text, ok = '确定', cancel = '取消' }) {
  return new Promise((resolve) => {
    showModal(root, {
      id: 'modal-confirm',
      title,
      bodyNodes: [el('p', 'tutorial-line', text)],
      buttons: [
        { label: ok, id: 'btn-confirm-ok', onClick: () => resolve(true) },
        { label: cancel, id: 'btn-confirm-cancel', onClick: () => resolve(false) },
      ],
    });
  });
}

// ---------- 轻提示 ----------
export function toast(root, msg, ms = 2600) {
  // 提示条串行化：先撤掉同根下的旧 toast,两条提示不再互相叠印(记录缺陷 R4)
  root.querySelectorAll('.toast').forEach((n) => n.remove());
  const t = el('div', 'toast', msg);
  root.appendChild(t);
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, ms);
  return t;
}

// ---------- 章节卡(三借递进，简报三.1) ----------
// 一借·被骗 / 二借·假扇 / 三借·真扇：各借开场亮一张全屏字卡，自动消隐。
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
  // 明确生命周期：动画结束即从 DOM 移除，不靠 opacity 停在画面上(简报 T9 残影);
  // 保底 timeout 兜住动画被打断(节点所在卡片先被回收)的情况
  f.addEventListener('animationend', () => f.remove(), { once: true });
  setTimeout(() => f.remove(), 1500);
  return f;
}

// 「克!」「暴击」印章
export function stampText(parent, text, cls = 'ke-stamp') {
  const f = el('div', `float-stamp ${cls}`);
  f.textContent = text;
  parent.appendChild(f);
  f.addEventListener('animationend', () => f.remove(), { once: true });
  setTimeout(() => f.remove(), 1200);
  return f;
}

// ---------- 顶栏 ----------
// 两组分工(简报一.3)：左侧队伍相关(角色/背包/召唤兽/阵型),
// 右侧系统相关(存档/读档/音效/帮助)默认收进设置。
export function buildTopbar(root, { onSave, onLoad, onFormation, onHelp, onMute, onHero, onBag, onPet, onQuest }) {
  const bar = el('div', 'topbar');
  bar.id = 'topbar';
  const title = el('div', 'topbar-title', TEXT.gameTitle);
  const mk = (iconName, label, id, fn) => {
    const b = el('button', 'btn topbar-btn');
    b.id = id;
    b.setAttribute('aria-label', label);
    if (iconName) b.appendChild(artIcon(iconName, 'topbar-icon'));
    b.appendChild(el('span', 'topbar-label', label));
    b.addEventListener('click', () => audio.sfx('click'));
    b.addEventListener('click', fn);
    return b;
  };
  const left = el('div', 'topbar-group');
  const heroB = mk('hero', TEXT.topbar.hero, 'btn-hero', onHero);
  const heroNotice = el('span', 'topbar-notice');
  heroNotice.hidden = true;
  heroB.appendChild(heroNotice);
  const bagB = mk('bag', TEXT.topbar.bag, 'btn-bag', onBag);
  const petB = mk('pet', TEXT.topbar.pet, 'btn-pet', onPet);
  const formB = mk('formation', TEXT.topbar.formation, 'btn-formation', onFormation);
  const questB = mk('quest', TEXT.topbar.quest, 'btn-quest', onQuest);
  left.append(bagB, heroB, petB, questB, formB);
  const right = el('div', 'topbar-group');
  const sys = el('div', 'topbar-sys');
  const gearB = el('button', 'btn topbar-btn');
  gearB.id = 'btn-system';
  gearB.title = TEXT.topbar.systemTip;
  gearB.setAttribute('aria-label', TEXT.topbar.system);
  gearB.append(artIcon('settings', 'topbar-icon'), el('span', 'topbar-label', TEXT.topbar.system));
  sys.append(gearB);
  right.append(sys);
  const spacer = el('div', 'topbar-spacer');
  const sep = el('div', 'topbar-sep');
  bar.append(title, left, spacer, sep, right);
  root.appendChild(bar);
  let closeSystem = null;
  const openSystem = () => {
    if (closeSystem) { closeSystem(); return; }
    if (root.querySelector('.modal-mask')) return;

    const section = (title, description = '') => {
      const wrap = el('section', 'system-section');
      wrap.appendChild(el('h3', 'system-section-title', title));
      if (description) wrap.appendChild(el('p', 'system-section-note', description));
      return wrap;
    };
    const audioSection = section('声音', '音量调整会立即保存。');
    const STEPS = [0, 0.25, 0.5, 0.75, 1];
    const volRow = (kind, label) => {
      const row = el('div', 'pref-row');
      const minus = el('button', 'btn pref-step', '−');
      const val = el('output', 'pref-val');
      const plus = el('button', 'btn pref-step', '+');
      minus.id = `btn-vol-${kind}-down`;
      plus.id = `btn-vol-${kind}-up`;
      minus.type = plus.type = 'button';
      minus.setAttribute('aria-label', `降低${label}音量`);
      plus.setAttribute('aria-label', `提高${label}音量`);
      const show = () => {
        const level = Math.round(audio.vol[kind] * 100);
        val.textContent = `${level}%`;
        val.setAttribute('aria-label', `${label}音量 ${level}%`);
        minus.disabled = level === 0;
        plus.disabled = level === 100;
      };
      const step = (d) => {
        const i = STEPS.reduce((best, v, j) => (Math.abs(v - audio.vol[kind]) < Math.abs(STEPS[best] - audio.vol[kind]) ? j : best), 0);
        audio.setVolume(kind, STEPS[Math.max(0, Math.min(STEPS.length - 1, i + d))]);
        show();
        audio.sfx('click');
      };
      minus.addEventListener('click', () => step(-1));
      plus.addEventListener('click', () => step(1));
      row.append(el('span', 'pref-label', label), minus, val, plus);
      show();
      return row;
    };
    const muteB = el('button', 'btn system-action');
    muteB.id = 'btn-mute';
    const refreshMute = () => {
      muteB.textContent = onMute.label();
      muteB.setAttribute('aria-pressed', String(audio.muted));
    };
    muteB.addEventListener('click', () => { onMute.toggle(); refreshMute(); audio.sfx('click'); });
    refreshMute();
    const volumeGrid = el('div', 'system-volume-grid');
    volumeGrid.append(volRow('bgm', '音乐'), volRow('sfx', '音效'));
    audioSection.append(volumeGrid, muteB);

    const battleSection = section('战斗偏好', '只影响演出速度和视觉反馈，不改变结算。');
    const toggle = (id, label, value, flip) => {
      const b = el('button', 'btn pref-toggle');
      b.id = id;
      const show = () => {
        const [stateLabel, on] = value();
        b.replaceChildren(el('span', 'pref-toggle-label', label), el('span', 'pref-toggle-value', stateLabel));
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      };
      b.addEventListener('click', () => { flip(); show(); audio.sfx('click'); });
      show();
      return b;
    };
    const toggles = el('div', 'pref-toggles');
    toggles.append(
      toggle('btn-speed', '节奏', () => [getSpeed() === 2 ? '加速 ×2' : '常速 ×1', getSpeed() === 2], () => setSpeed(getSpeed() === 2 ? 1 : 2)),
      toggle('btn-skip-fx', '技能演出', () => [getSkipFx() ? '跳过' : '播放', getSkipFx()], () => setSkipFx(!getSkipFx())),
      toggle('btn-shake', '震屏反馈', () => [getShake() ? '开启' : '关闭', getShake()], () => setShake(!getShake())),
    );
    battleSection.appendChild(toggles);

    const gameSection = section('游戏', '存档、读档与操作说明。');
    const actions = el('div', 'system-actions');
    const action = (id, label, fn) => {
      const b = el('button', 'btn system-action', label);
      b.id = id;
      b.addEventListener('click', () => {
        audio.sfx('click');
        closeSystem?.();
        fn();
      });
      return b;
    };
    actions.append(
      action('btn-save', TEXT.topbar.save, onSave),
      action('btn-load', TEXT.topbar.load, onLoad),
      action('btn-help', TEXT.topbar.help, onHelp),
    );
    gameSection.appendChild(actions);

    gearB.classList.add('open');
    closeSystem = showPanel(root, {
      id: 'modal-system',
      title: TEXT.topbar.system,
      bodyNodes: [audioSection, battleSection, gameSection],
      onClose: () => {
        closeSystem = null;
        gearB.classList.remove('open');
      },
    });
  };
  gearB.addEventListener('click', () => audio.sfx('click'));
  gearB.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openSystem();
  });
  const panelBtns = { hero: heroB, bag: bagB, pet: petB, formation: formB, quest: questB };
  return {
    setOpen(key) {
      for (const [k, b] of Object.entries(panelBtns)) b.classList.toggle('open', k === key);
    },
    setHeroNotice(total) {
      const n = Math.max(0, Number(total) || 0);
      heroNotice.hidden = n === 0;
      heroNotice.textContent = n > 9 ? '9+' : String(n);
      heroB.classList.toggle('has-notice', n > 0);
      heroB.title = n > 0 ? `尚有 ${n} 点潜力或修炼未分配` : '';
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
  const intro = el('div', 'formation-intro');
  intro.appendChild(artIcon('formation', 'formation-art'));
  const introCopy = el('div', 'formation-intro-copy');
  introCopy.append(
    el('p', 'formation-kicker', '行军布阵'),
    el('p', 'formation-guidance', '阵型同时改变队伍的输出、承伤与出手节奏。选择非当前阵型即可切换。'),
  );
  intro.appendChild(introCopy);
  const list = el('div', 'formation-list');
  const rows = [];
  const modLabels = { atk: '攻击', def: '防御', spd: '速度', dmgTaken: '受伤' };
  for (const f of Object.values(formations)) {
    const isCurrent = f.key === current;
    const row = el('button', `formation-row${isCurrent ? ' current' : ''}`);
    row.type = 'button';
    row.dataset.formation = f.key;
    row.disabled = isCurrent;
    row.setAttribute('aria-pressed', String(isCurrent));
    const cardHead = el('div', 'formation-card-head');
    const name = el('div', 'formation-name', f.name);
    const state = el('span', 'formation-state', isCurrent ? '使用中' : '切换此阵');
    cardHead.append(name, state);
    const stats = el('div', 'formation-stats');
    for (const [key, factor] of Object.entries(f.mods ?? {})) {
      if (!modLabels[key]) continue;
      const delta = Math.round((factor - 1) * 100);
      const good = key === 'dmgTaken' ? delta < 0 : delta > 0;
      stats.appendChild(el('span', `formation-stat ${good ? 'gain' : 'cost'}`, `${modLabels[key]} ${delta > 0 ? '+' : ''}${delta}%`));
    }
    row.append(cardHead, stats);
    row.addEventListener('click', () => onPick(f.key));
    list.appendChild(row);
    rows.push(row);
  }
  const close = showModal(root, {
    id: 'modal-formation',
    title: TEXT.topbar.formation,
    bodyNodes: [intro, list],
    buttons: [{ label: '关闭', id: 'btn-formation-close' }],
    focusables: rows,
  });
  return close;
}

// ---------- NPC 对话菜单(梦幻式：头像 + 一段话 + 选项列表) ----------
// options: [{key, label}];返回所选 key。数字键/方向键/回车可选,Esc 等同最后一项(离开)。
export function npcMenu(root, { who, name, text, options }) {
  return new Promise((resolve) => {
    const box = el('div', 'npc-menu');
    box.id = 'npc-menu';
    const face = el('img', 'npc-menu-face');
    face.src = unitURL(who, name);
    face.alt = '';
    const body = el('div', 'npc-menu-body');
    body.append(el('div', 'npc-menu-name', name), el('div', 'npc-menu-text', text));
    const list = el('div', 'npc-menu-options');
    const btns = options.map((o, i) => {
      const b = el('button', 'npc-menu-opt', `${i + 1}. ${o.label}`);
      b.dataset.opt = o.key;
      b.addEventListener('click', () => done(o.key));
      list.appendChild(b);
      return b;
    });
    body.appendChild(list);
    box.append(face, body);
    root.appendChild(box);
    let idx = 0;
    const focus = (i) => {
      idx = (i + btns.length) % btns.length;
      btns.forEach((b, j) => b.classList.toggle('kbd-focus', j === idx));
    };
    focus(0);
    function onKey(ev) {
      if (root.querySelector('.modal-mask')) return;
      if (ev.key === 'ArrowDown') focus(idx + 1);
      else if (ev.key === 'ArrowUp') focus(idx - 1);
      else if (ev.key === 'Enter' || ev.key === ' ') btns[idx].click();
      else if (ev.key === 'Escape') done(options[options.length - 1].key);
      else if (/^[1-9]$/.test(ev.key) && btns[Number(ev.key) - 1]) btns[Number(ev.key) - 1].click();
      else return;
      ev.preventDefault();
    }
    function done(key) {
      audio.sfx('click');
      window.removeEventListener('keydown', onKey);
      box.remove();
      resolve(key);
    }
    window.addEventListener('keydown', onKey);
  });
}

// ---------- 入战转场：墨色漩涡收拢(梦幻进战斗的旋屏) ----------
export function inkSwirl(root, fast = false) {
  return new Promise((resolve) => {
    const s = el('div', 'ink-swirl');
    root.appendChild(s);
    audio.sfx('encounter');
    const ms = fast ? 160 : 680;
    s.style.animationDuration = `${ms}ms`;
    setTimeout(() => { resolve(); setTimeout(() => s.remove(), 260); }, ms);
  });
}

// ---------- 大字提示：升级/任务完成(居中金字，自动消隐，不拦输入) ----------
export function bigToast(root, title, sub = '', kind = 'level', extra = '') {
  root.querySelectorAll('.big-toast').forEach((n) => n.remove()); // 同一时刻只留一张
  const t = el('div', `big-toast ${kind}`);
  t.append(el('div', 'big-toast-title', title));
  if (sub) t.append(el('div', 'big-toast-sub', sub));
  if (extra) t.append(el('div', 'big-toast-extra', extra));
  root.appendChild(t);
  setTimeout(() => t.remove(), extra ? 3200 : 2400);
}
