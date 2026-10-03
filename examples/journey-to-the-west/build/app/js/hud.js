// 梦幻式场景 HUD:左上小地图+地名坐标、右上人物/召唤兽头像与气血法力、右侧任务追踪、
// 左下聊天频道、底部历练条。右下图标栏复用顶栏按钮(CSS 在场景阶段把它挪到右下)。

import { el } from './ui.js';
import { unitURL } from './assets.js';

const CHANNELS = [['all', '综合'], ['cur', '当前'], ['team', '队伍'], ['sys', '系统']];
const history = []; // 跨场景保留的聊天记录 {ch, text}
const sysHistory = []; // 系统消息另存一份：闲话刷得再多，「系统」页也不会丢掉升级等记录

export function logLine(ch, text) {
  history.push({ ch, text });
  if (history.length > 80) history.shift();
  if (ch === 'sys') {
    sysHistory.push({ ch, text });
    if (sysHistory.length > 60) sysHistory.shift();
  }
  activeHud?.renderLog();
}

export function clearChatHistory() {
  history.length = 0;
  sysHistory.length = 0;
}

let activeHud = null;

export function createHud(root, { onTrack, onMinimap, collapseTracker = false }) {
  const hud = el('div', 'world-hud');
  hud.id = 'world-hud';

  // 左上：地名、坐标、小地图
  const mapCard = el('div', 'hud-map');
  const mapName = el('div', 'hud-map-name');
  const coords = el('span', 'hud-coords');
  mapName.append(el('span', 'hud-map-title'), coords);
  const minimap = el('canvas', 'hud-minimap');
  minimap.width = 240; minimap.height = 136;
  minimap.title = '点击小地图可直接走过去';
  minimap.addEventListener('click', (ev) => {
    const r = minimap.getBoundingClientRect();
    onMinimap?.((ev.clientX - r.left) * (minimap.width / r.width), (ev.clientY - r.top) * (minimap.height / r.height));
  });
  mapCard.append(mapName, minimap);

  // 右上：人物与召唤兽
  const cards = el('div', 'hud-cards');
  const petCard = el('div', 'hud-card pet');
  const heroCard = el('div', 'hud-card hero');
  cards.append(petCard, heroCard);

  // 右侧：任务追踪
  const tracker = el('div', 'hud-tracker');
  tracker.id = 'quest-tracker';
  const trackerHead = el('div', 'hud-tracker-head', '任务追踪');
  const fold = el('button', 'hud-tracker-toggle', collapseTracker ? '展开' : '收起');
  if (collapseTracker) tracker.classList.add('collapsed');
  fold.addEventListener('click', () => {
    const c = tracker.classList.toggle('collapsed');
    fold.textContent = c ? '展开' : '收起';
  });
  trackerHead.appendChild(fold);
  const trackerList = el('div', 'hud-tracker-list');
  tracker.append(trackerHead, trackerList);

  // 左下：聊天频道
  const chat = el('div', 'hud-chat');
  const tabs = el('div', 'hud-chat-tabs');
  const logBox = el('div', 'hud-chat-log');
  let tab = 'all';
  for (const [key, label] of CHANNELS) {
    const b = el('button', `hud-chat-tab${key === tab ? ' on' : ''}`, label);
    b.dataset.ch = key;
    b.addEventListener('click', () => {
      tab = key;
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.ch === key));
      renderLog();
    });
    tabs.appendChild(b);
  }
  chat.append(tabs, logBox);

  // 底部：历练条
  const expBar = el('div', 'hud-exp');
  const expFill = el('div', 'hud-exp-fill');
  const expText = el('div', 'hud-exp-text');
  expBar.append(expFill, expText);

  const hint = el('div', 'hud-hint');
  hint.hidden = true;

  hud.append(mapCard, cards, tracker, chat, expBar, hint);
  root.appendChild(hud);

  const CH_LABEL = { cur: '当前', team: '队伍', sys: '系统' };
  function renderLog() {
    logBox.textContent = '';
    const src = tab === 'sys' ? sysHistory : history.filter((l) => tab === 'all' || l.ch === tab);
    for (const line of src.slice(-30)) {
      const row = el('div', `hud-chat-line ch-${line.ch}`);
      row.append(el('span', 'hud-chat-ch', `[${CH_LABEL[line.ch]}]`), el('span', '', line.text));
      logBox.appendChild(row);
    }
    logBox.scrollTop = logBox.scrollHeight;
  }

  function bar(cls, label, cur, max) {
    const b = el('div', `hud-bar ${cls}`);
    const fill = el('div', 'hud-bar-fill');
    fill.style.width = `${Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100))}%`;
    b.append(fill, el('span', 'hud-bar-text', `${label} ${cur}/${max}`));
    return b;
  }

  function card(node, { unit, name, level, hp, mp, extra }) {
    node.textContent = '';
    const face = el('img', 'hud-face');
    face.src = unitURL(unit, name);
    face.alt = name;
    const info = el('div', 'hud-card-info');
    info.append(el('div', 'hud-card-name', `${name}  Lv.${level}`), bar('hp', '气血', hp, hp), bar('mp', '法力', mp, mp));
    if (extra) info.appendChild(extra);
    node.append(face, info);
  }

  activeHud = {
    minimap,
    renderLog,
    setMap(name) { mapName.querySelector('.hud-map-title').textContent = name; },
    setCoords(x, y) { coords.textContent = `(${x},${y})`; },
    setHero(h) {
      const money = el('div', 'hud-money', `银两 ${h.money}`);
      money.id = 'hud-money';
      card(heroCard, { ...h, extra: money });
      expFill.style.width = `${Math.min(100, (h.exp / h.expNeed) * 100)}%`;
      expText.textContent = h.capped
        ? `历练 ${h.exp}/${h.expNeed} · 已达本章上限 Lv.${h.level}，推进主线可再精进`
        : `历练 ${h.exp}/${h.expNeed} · 下一级 Lv.${h.level + 1}`;
      expBar.classList.toggle('capped', !!h.capped);
    },
    setPet(p) {
      petCard.hidden = !p;
      if (p) card(petCard, p);
    },
    setQuests(list) {
      trackerList.textContent = '';
      for (const q of list) {
        const item = el('button', `hud-quest ${q.kind === '主线' ? 'main' : 'daily'}`);
        item.dataset.quest = q.id;
        item.append(el('div', 'hud-quest-title', `【${q.kind}】${q.title}`), el('div', 'hud-quest-text', q.text));
        // 收起时也留一行：妖在何处(点它照样自动寻路)
        if (q.brief) { item.classList.add('live'); item.append(el('div', 'hud-quest-brief', q.brief)); }
        if (q.target) {
          item.append(el('div', 'hud-quest-go', '点击自动寻路 ▸'));
          item.addEventListener('click', () => onTrack?.(q));
        } else item.classList.add('static');
        trackerList.appendChild(item);
      }
    },
    flashTracker(on) { tracker.classList.toggle('flash', on); },
    setHint(text) { hint.hidden = !text; hint.textContent = text ?? ''; },
    dispose() { hud.remove(); if (activeHud?.minimap === minimap) activeHud = null; },
  };
  renderLog();
  return activeHud;
}
