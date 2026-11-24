// 行走场景 HUD（严格 ≤4 个紧凑常驻区）：左上小地图、右上悟空名牌、右侧精简追踪卡、右下四键入口（次级功能与纪闻退入按需抽屉）。

import { h, clear } from '../core/dom.js';
import { uiArt, faceStyle } from '../data/art.js';
import { MAP_SIZE } from '../data/maps.js';

const MAIN_ICONS = [
  ['hero', '角色', 'hero'],
  ['pet', '召唤兽', 'pet'],
  ['bag', '背囊', 'bag'],
];
const DRAWER_ICONS = [
  ['quest', '任务', 'quest'],
  ['formation', '阵型', 'formation'],
  ['journal', '纪闻', 'quest'],
  ['settings', '设置', 'settings'],
];

export function createHud(root, { onTrack, onIcon, onMinimap }) {
  // 1. 左上：小地图
  const mapCanvas = h('canvas', { width: 300, height: 200, title: '点小地图移动' });
  const whereName = h('span');
  const whereXY = h('small');
  const map = h('div.hud-map.plate', { data: { ui: 'minimap' } }, h('div.where', {}, whereName, whereXY), mapCanvas);
  mapCanvas.addEventListener('pointerdown', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    onMinimap(((e.clientX - r.left) / r.width) * MAP_SIZE[0], ((e.clientY - r.top) / r.height) * MAP_SIZE[1]);
  });

  // 2. 右上：悟空名牌
  const lv = h('small');
  const expFill = h('i.fill'), expText = h('b');
  const money = h('span');
  const hero = h('button.hud-hero.plate', { type: 'button', data: { ui: 'hero-card' }, title: '打开角色', onclick: () => onIcon('hero') },
    h('div.face', { style: faceStyle('wukong') }),
    h('div.name', {}, '孙悟空', lv),
    h('div.bar.exp', {}, expFill, expText),
    h('div.money', {}, h('img', { src: uiArt('coin'), alt: '' }), money));

  // 3. 右侧：精简目标追踪
  const quests = h('div.hud-quests', { data: { ui: 'quests' } });

  // 4. 右下：紧凑 4 键功能坞 + 按需次级抽屉（任务/阵型/纪闻/设置）
  const dock = h('div.hud-dock', { data: { ui: 'dock' } });
  const drawer = h('div.hud-drawer.plate.hidden', { data: { ui: 'drawer' } });
  const icons = h('div.hud-icons.plate', { data: { ui: 'icons' } });
  const iconEls = {};
  const closeDrawer = () => { drawer.classList.add('hidden'); moreBtn.setAttribute('aria-expanded', 'false'); moreBtn.classList.remove('open'); };
  for (const [key, label, art] of MAIN_ICONS) {
    const dot = h('span.dot.hidden');
    const b = h('button.hud-icon', { type: 'button', data: { icon: key }, onclick: () => { closeDrawer(); onIcon(key); } }, h('img', { src: uiArt(art), alt: '' }), label, dot);
    iconEls[key] = { b, dot };
    icons.append(b);
  }
  const moreBtn = h('button.hud-icon', {
    type: 'button', data: { icon: 'more' }, 'aria-expanded': 'false',
    onclick: (e) => {
      e.stopPropagation();
      const open = drawer.classList.toggle('hidden') === false;
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.classList.toggle('open', open);
    },
  }, h('img', { src: uiArt('settings'), alt: '' }), '更多');
  icons.append(moreBtn);
  for (const [key, label, art] of DRAWER_ICONS) {
    drawer.append(h('button.drawer-item', { type: 'button', data: { icon: key }, onclick: () => { closeDrawer(); onIcon(key); } }, h('img', { src: uiArt(art), alt: '' }), h('span', {}, label)));
  }
  dock.append(drawer, icons);
  root.addEventListener('pointerdown', (e) => { if (!dock.contains(e.target)) closeDrawer(); });

  const wrap = h('div.hud', {}, map, hero, quests, dock);
  root.append(wrap);

  const logs = [];
  let flashing = false;
  return {
    mapCanvas,
    place(region, name, x, y) { whereName.textContent = `${region} · ${name}`; whereXY.textContent = `${Math.round(x / 10)}, ${Math.round(y / 10)}`; },
    hero({ level, exp, need, capped, silver }) {
      lv.textContent = `Lv.${level}`;
      expFill.style.width = `${Math.min(100, (exp / need) * 100)}%`;
      expText.textContent = capped ? '历练已满' : `${exp}/${need}`;
      money.textContent = `${silver} 两`;
    },
    quests(list) {
      clear(quests);
      list.forEach((q, i) => {
        const el = h(`button.quest.plate${q.side ? '.side' : ''}${flashing && i === 0 ? '.flash' : ''}`, { type: 'button', data: { quest: q.id }, onclick: () => { closeDrawer(); onTrack(q); } },
          h('div.k', {}, h('i', {}, q.side ? '日常' : '主线'), h('span.qt', {}, q.title), q.scene && h('em.go', {}, '寻路▸')),
          h('p', {}, q.text));
        quests.append(el);
      });
    },
    dots(map2) { for (const [k, n] of Object.entries(map2)) { const e = iconEls[k]; if (!e) continue; e.dot.textContent = n > 9 ? '9+' : String(n); e.dot.classList.toggle('hidden', !n); } },
    log(text, sys = false) {
      logs.push({ text, sys });
      while (logs.length > 60) logs.shift();
    },
    getLogs() { return logs.slice(); },
    hint() {}, // 取消顶部重复教学横幅，靠场景「!」与追踪卡闪动自然引导
    flash(on) { flashing = on; quests.firstChild?.classList.toggle('flash', on); },
    show(v) { if (!v) closeDrawer(); wrap.classList.toggle('hidden', !v); },
    destroy() { wrap.remove(); },
  };
}
