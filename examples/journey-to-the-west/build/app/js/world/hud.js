// 行走场景四角的 HUD：小地图、悟空名牌、任务追踪、功能图标、消息。只显示，不存规则。

import { h, clear } from '../core/dom.js';
import { uiArt, faceStyle } from '../data/art.js';
import { MAP_SIZE } from '../data/maps.js';

const ICONS = [
  ['bag', '背囊', 'bag'], ['hero', '角色', 'hero'], ['pet', '召唤兽', 'pet'],
  ['quest', '任务', 'quest'], ['formation', '阵型', 'formation'], ['settings', '设置', 'settings'],
];

export function createHud(root, { onTrack, onIcon, onMinimap }) {
  const mapCanvas = h('canvas', { width: 300, height: 200, title: '点小地图也能走过去' });
  const whereName = h('span');
  const whereXY = h('small');
  const map = h('div.hud-map.plate', { data: { ui: 'minimap' } }, h('div.where', {}, whereName, whereXY), mapCanvas);
  mapCanvas.addEventListener('pointerdown', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    onMinimap(((e.clientX - r.left) / r.width) * MAP_SIZE[0], ((e.clientY - r.top) / r.height) * MAP_SIZE[1]);
  });

  const lv = h('small');
  const expFill = h('i.fill'), expText = h('b');
  const money = h('span');
  const hero = h('button.hud-hero.plate', { type: 'button', data: { ui: 'hero-card' }, title: '打开角色', onclick: () => onIcon('hero') },
    h('div.face', { style: faceStyle('wukong') }),
    h('div.name', {}, '孙悟空', lv),
    h('div.bar.exp', {}, expFill, expText),
    h('div.money', {}, h('img', { src: uiArt('coin'), alt: '' }), money));

  const quests = h('div.hud-quests', { data: { ui: 'quests' } });
  const icons = h('div.hud-icons.plate', { data: { ui: 'icons' } });
  const iconEls = {};
  for (const [key, label, art] of ICONS) {
    const dot = h('span.dot.hidden');
    const b = h('button.hud-icon', { type: 'button', data: { icon: key }, onclick: () => onIcon(key) }, h('img', { src: uiArt(art), alt: '' }), label, dot);
    iconEls[key] = { b, dot };
    icons.append(b);
  }

  const logLast = h('span');
  const logToggle = h('i', { data: { ui: 'log-toggle' } }, '展开');
  const logList = h('div.list');
  const log = h('div.hud-log.plate', { data: { ui: 'log' } },
    h('button.head', { type: 'button', 'aria-expanded': 'false', onclick: (e) => { const open = log.classList.toggle('open'); logToggle.textContent = open ? '收起' : '展开'; e.currentTarget.setAttribute('aria-expanded', String(open)); logList.scrollTop = logList.scrollHeight; } }, h('b', {}, '消息'), logLast, logToggle), logList);
  const hint = h('div.hud-hint.plate.hidden', { data: { ui: 'hint' }, role: 'status' });
  const wrap = h('div.hud', {}, map, hero, quests, icons, log, hint);
  root.append(wrap);

  let flashing = false;
  return {
    mapCanvas,
    place(region, name, x, y) { whereName.textContent = `${region} · ${name}`; whereXY.textContent = `${Math.round(x / 10)}, ${Math.round(y / 10)}`; },
    hero({ level, exp, need, capped, silver }) {
      lv.textContent = `Lv.${level}`;
      expFill.style.width = `${Math.min(100, (exp / need) * 100)}%`;
      expText.textContent = capped ? '历练已满' : `历练 ${exp}/${need}`;
      money.textContent = `银两 ${silver}`;
    },
    quests(list) {
      clear(quests);
      list.forEach((q, i) => {
        const el = h(`button.quest.plate${q.side ? '.side' : ''}${flashing && i === 0 ? '.flash' : ''}`, { type: 'button', data: { quest: q.id }, onclick: () => onTrack(q) },
          h('div.k', {}, h('i', {}, q.side ? '日常' : '主线'), q.title), h('p', {}, q.text), q.scene && h('div.go', {}, '点此自动寻路 ▸'));
        quests.append(el);
      });
    },
    dots(map2) { for (const [k, n] of Object.entries(map2)) { const e = iconEls[k]; if (!e) continue; e.dot.textContent = n > 9 ? '9+' : String(n); e.dot.classList.toggle('hidden', !n); } },
    log(text, sys = false) {
      logLast.textContent = text;
      logList.append(h(`div${sys ? '.sys' : ''}`, {}, text));
      while (logList.children.length > 60) logList.firstChild.remove();
      logList.scrollTop = logList.scrollHeight;
    },
    hint(text) { hint.textContent = text ?? ''; hint.classList.toggle('hidden', !text); },
    flash(on) { flashing = on; quests.firstChild?.classList.toggle('flash', on); },
    show(v) { wrap.classList.toggle('hidden', !v); },
    destroy() { wrap.remove(); },
  };
}
