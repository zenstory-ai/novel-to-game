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
const panelLayers = [];
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
  for (const layer of panelLayers) layer.dispose();
  panelLayers.length = 0;
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
    box.setAttribute('role', 'dialog');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-describedby', 'dialog-body');
    const stage = el('div', 'dlg-stage');
    stage.setAttribute('aria-hidden', 'true');
    const portrait = el('img', 'dlg-portrait');
    portrait.alt = '';
    stage.appendChild(portrait);
    const right = el('div', 'dlg-right');
    const name = el('div', 'dlg-name');
    name.id = 'dialog-speaker';
    const text = el('div', 'dlg-text');
    text.id = 'dialog-body';
    text.dataset.dialogBody = '';
    const footer = el('div', 'dlg-footer');
    const progress = el('span', 'dlg-progress');
    progress.dataset.dialogProgress = '';
    progress.setAttribute('aria-hidden', 'true');
    const next = el('button', 'dlg-next', TEXT.ui.continueBtn);
    next.id = 'dialog-continue';
    next.type = 'button';
    next.setAttribute('aria-controls', 'dialog-body');
    footer.append(progress, next);
    right.append(name, text, footer);
    box.append(right);
    root.append(stage, box);
    const ownerGeneration = shadeOn('dlg');
    // 每句刚出现的一小段时间里不收输入：连点/按住回车不会把下一句(或下一段对话的第一句)吞掉
    let readyAt = 0;
    let pointerGesture = null;
    let lastBodyScrollAt = -Infinity;

    function hasSelectedDialogText(selection = window.getSelection?.()) {
      return Boolean(selection && !selection.isCollapsed && (
        text.contains(selection.anchorNode) || text.contains(selection.focusNode)
      ));
    }

    function render() {
      const line = lines[idx];
      stage.hidden = !line.who;
      box.classList.toggle('narration', !line.who);
      box.dataset.mode = line.who ? 'speaker' : 'narrator';
      if (line.who) {
        // 假八戒沿用八戒面貌；不知道真身前不能由头像提前揭露。
        const portraitKey = { fakeBajie: 'bajie', huobao: 'mob_fire1' }[line.who] ?? line.who;
        portrait.src = unitURL(portraitKey, TEXT.speakers[line.who] ?? line.who);
        stage.dataset.portrait = portraitKey;
        portrait.style.visibility = 'visible';
        name.hidden = false;
        name.textContent = TEXT.speakers[line.who] ?? line.who;
        box.setAttribute('aria-label', `${name.textContent}的对话`);
      } else {
        delete stage.dataset.portrait;
        portrait.style.visibility = 'hidden';
        name.hidden = true; // 旁白不留空名牌行
        name.textContent = '';
        box.setAttribute('aria-label', '剧情旁白');
      }
      text.textContent = line.text;
      text.scrollTop = 0;
      progress.textContent = `${idx + 1} / ${lines.length}`;
      next.textContent = TEXT.ui.continueBtn;
      next.setAttribute('aria-label', `继续对话，第 ${idx + 1} / ${lines.length} 句`);
      box.dataset.idx = String(idx);
      box.dataset.total = String(lines.length);
      pointerGesture = null;
      readyAt = performance.now() + 180;
    }
    function cleanup() {
      window.removeEventListener('keydown', onKey);
      shadeOff('dlg', ownerGeneration);
    }
    function advance() {
      if (root.querySelector('.modal-mask')) return;
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
    box.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.isPrimary === false) return;
      pointerGesture = {
        x: ev.clientX,
        y: ev.clientY,
        scrollTop: text.scrollTop,
        hadSelection: hasSelectedDialogText(),
        moved: false,
      };
    });
    box.addEventListener('pointermove', (ev) => {
      if (!pointerGesture) return;
      if (Math.hypot(ev.clientX - pointerGesture.x, ev.clientY - pointerGesture.y) > 8) {
        pointerGesture.moved = true;
      }
    });
    box.addEventListener('pointercancel', () => { pointerGesture = null; });
    text.addEventListener('scroll', () => { lastBodyScrollAt = performance.now(); });
    box.addEventListener('click', (ev) => {
      if (ev.target.closest('.dlg-next')) return;
      const gesture = pointerGesture;
      pointerGesture = null;
      if (performance.now() - lastBodyScrollAt < 250) return;
      if (gesture && (
        gesture.moved
        || gesture.hadSelection
        || Math.abs(text.scrollTop - gesture.scrollTop) > 1
      )) return;
      if (hasSelectedDialogText()) return;
      advance();
    });
    next.addEventListener('click', (ev) => {
      ev.stopPropagation();
      pointerGesture = null;
      advance();
    });
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

// 两类面板共用外壳、遮罩、顶层输入与焦点归还。
function mountPanel(root, { id, title, bodyNodes, footer, dismiss, onClose, onKey, initialFocus }) {
  root.querySelectorAll('.big-toast').forEach((node) => node.remove());
  const previousFocus = document.activeElement;
  const mask = el('div', 'modal-mask panel-overlay');
  if (id) mask.id = id;
  const panel = el('div', `modal-panel panel-shell${id ? ` panel-${id.replace(/^modal-/, '')}` : ''}`);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.tabIndex = -1;
  const head = el('div', 'modal-title', title);
  head.id = `${id || `panel-${++modalLabelSeq}`}-title`;
  panel.setAttribute('aria-labelledby', head.id);
  const body = el('div', 'modal-body');
  body.append(...bodyNodes);
  panel.append(head, body);
  if (footer) panel.appendChild(footer);
  mask.appendChild(panel);
  root.appendChild(mask);
  const ownerGeneration = shadeOn('modal');
  const events = new AbortController();
  const layer = { mask, panel, dispose: () => events.abort() };
  panelLayers.push(layer);
  refreshLayers();
  let closed = false;
  let backdropPress = false;
  const close = () => {
    if (closed) return;
    closed = true;
    events.abort();
    shadeOff('modal', ownerGeneration);
    mask.remove();
    const index = panelLayers.indexOf(layer);
    if (index >= 0) panelLayers.splice(index, 1);
    refreshLayers();
    onClose?.();
    const top = panelLayers.at(-1);
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected
      && (!top || top.panel.contains(previousFocus))) previousFocus.focus();
  };
  const dismissTop = () => {
    if (panelLayers.at(-1) !== layer || !dismiss) return;
    if (dismiss === true) { audio.sfx('click'); close(); }
    else dismiss();
  };
  const closeBtn = dismiss ? el('button', 'panel-close', '×') : null;
  if (closeBtn) {
    closeBtn.type = 'button';
    closeBtn.id = `${id || 'panel'}-close`;
    closeBtn.setAttribute('aria-label', `关闭${title}`);
    closeBtn.addEventListener('click', dismissTop);
    panel.appendChild(closeBtn);
  }
  mask.addEventListener('pointerdown', (ev) => {
    backdropPress = ev.target === mask && ev.button === 0;
  }, { signal: events.signal });
  mask.addEventListener('pointercancel', () => { backdropPress = false; }, { signal: events.signal });
  mask.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const outside = backdropPress && ev.target === mask;
    backdropPress = false;
    if (outside) dismissTop();
  }, { signal: events.signal });
  window.addEventListener('keydown', (ev) => {
    if (!mask.isConnected) { events.abort(); return; }
    if (panelLayers.at(-1) !== layer) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (!ev.repeat) dismissTop();
    } else if (!trapPanelFocus(panel, ev)) onKey?.(ev, panel);
    if (ev.defaultPrevented) ev.stopImmediatePropagation();
  }, { capture: true, signal: events.signal });
  queueMicrotask(() => {
    if (mask.isConnected && panelLayers.at(-1) === layer) (initialFocus?.() || closeBtn || panel).focus();
  });
  return close;
}

function refreshLayers() {
  // 场景回收可能直接移除旧 DOM；不让旧层参与后续焦点和遮罩。
  for (let index = panelLayers.length - 1; index >= 0; index -= 1) {
    if (!panelLayers[index].mask.isConnected) {
      panelLayers[index].dispose();
      panelLayers.splice(index, 1);
    }
  }
  panelLayers.forEach((layer, index) => {
    layer.mask.classList.toggle('panel-overlay-nested', index > 0);
    layer.mask.style.zIndex = String(60 + index);
    layer.panel.setAttribute('aria-modal', String(index === panelLayers.length - 1));
    layer.panel.inert = index < panelLayers.length - 1;
  });
}

// cancel 明确标识无提交的返回动作；必选步骤不因按钮命名而变成可取消。
export function showModal(root, { id, title, bodyNodes, buttons, focusables = null, onClose }) {
  const foot = el('div', 'modal-foot');
  let close;
  let cancelButton = null;
  for (const action of buttons) {
    const button = el('button', 'btn modal-btn', action.label);
    button.type = 'button';
    if (action.id) button.id = action.id;
    button.disabled = Boolean(action.disabled);
    if (action.cancel && !button.disabled) {
      cancelButton = button;
      button.classList.add('modal-btn-secondary');
    }
    button.addEventListener('click', () => {
      audio.sfx('click');
      // 先归还旧层焦点，再执行动作；动作可以直接打开下一层。
      if (action.close !== false) close();
      action.onClick?.();
    });
    foot.appendChild(button);
  }
  foot.hidden = !buttons.length;
  const btns = (focusables?.length ? [...focusables] : [...foot.querySelectorAll('button')])
    .filter((button) => !button.disabled);
  let fIdx = 0;
  const applyF = (index) => {
    if (!btns.length) return;
    fIdx = ((index % btns.length) + btns.length) % btns.length;
    btns.forEach((button) => button.classList.remove('kbd-focus'));
    btns[fIdx].classList.add('kbd-focus');
    btns[fIdx].focus();
  };
  close = mountPanel(root, {
    id, title, bodyNodes, footer: foot, onClose,
    dismiss: cancelButton ? () => cancelButton.click() : null,
    initialFocus: () => btns[0],
    onKey(ev, panel) {
      const key = ev.key;
      if (ev.repeat && (key === 'Enter' || key === ' ')) { ev.preventDefault(); return; }
      if (key === 'Enter' || key === ' ') {
        const active = document.activeElement?.closest('button:not(:disabled)');
        (active && panel.contains(active) ? active : btns[fIdx])?.click();
      } else if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(key)) {
        const active = btns.indexOf(document.activeElement);
        applyF((active >= 0 ? active : fIdx) + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1));
      } else if (/^[1-9]$/.test(key)) btns[Number(key) - 1]?.click();
      else return;
      ev.preventDefault();
    },
  });
  return close;
}

export function showPanel(root, { id, title, bodyNodes, onClose }) {
  return mountPanel(root, { id, title, bodyNodes, onClose, dismiss: true });
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
        { label: cancel, id: 'btn-confirm-cancel', cancel: true, onClick: () => resolve(false) },
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
      buttons: [{ label: '知道了', id: 'btn-once-close', cancel: true, onClick: () => resolve(true) }],
    });
  });
}

// ---------- 阵型弹窗 ----------
export function showFormationModal(root, { current, formations, onPick, onClose }) {
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
    buttons: [{ label: '关闭', id: 'btn-formation-close', cancel: true }],
    onClose,
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
