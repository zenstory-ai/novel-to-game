// 功能面板：角色、召唤兽、背囊、任务、阵型、设置、商店、行前须知。共用一套外壳。

import { h, clear, append } from '../core/dom.js';
import {
  PARTY, SKILLS, EQUIPS, EQUIP_SLOTS, TREASURES, FORMATIONS, ITEMS, GROWTH, STAT_KEYS, STAT_LABEL, STAT_GAIN_TEXT, SHOPS, ECONOMY,
} from '../data/combat.js';
import { HELP, SHOP_LINES } from '../data/story.js';
import { LANDMARKS } from '../data/maps.js';
import { statsAt, learnedSkills, skillOf } from '../rules/battle.js';
import {
  TEAM, addPoint, recommendPoints, trainSkill, studySkill, studyCost, recommendSkills, skillRank, gearOf, equip, unequip,
  setActivePet, pendingGrowth, itemLabel, buy, mainQuest, bountyQuest, expToNext, levelCap,
} from '../rules/campaign.js';
import { unitArt, itemArt, uiArt, faceStyle } from '../data/art.js';
import { audio } from '../core/audio.js';
import { settings, saveSettings } from '../core/store.js';
import { toast } from './dialogue.js';
import { paginate } from './pager.js';

const overlay = () => document.getElementById('overlay');
const STAT_ICON = { hp: 'vitality', atk: 'attack', def: 'defend', spd: 'speed', mag: 'spell' };

// 外壳：标题、关闭、正文、底栏。点遮罩、按 Esc、点关闭都走同一个 close。
function shell({ title, narrow = false, id, money = null, fixed = false }) {
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const body = h('div.panel-body');
  const foot = h('div.panel-foot.hidden');
  const headExtra = h('div.tabs');
  const moneyEl = h('div.money.hidden', {}, h('img', { src: uiArt('coin'), alt: '' }), h('span'));
  const xBtn = h('button.x-btn', { type: 'button', 'aria-label': '关闭', data: { act: 'close' } }, '×');
  const panel = h(`div.panel.card${narrow ? '.narrow' : ''}${fixed ? '.fixed' : ''}`, { role: 'dialog', 'aria-label': title }, h('div.panel-head', {}, h('h2', {}, title), headExtra, moneyEl, xBtn), body, foot);
  const mask = h('div.mask', { data: { ui: 'panel', panel: id } }, panel);
  function close() {
    window.removeEventListener('keydown', onKey, true);
    mask.remove();
    resolveClosed();
  }
  function onKey(e) { if (e.key === 'Escape' && overlay().lastElementChild === mask) { e.preventDefault(); e.stopPropagation(); close(); } }
  xBtn.addEventListener('click', close);
  mask.addEventListener('pointerdown', (e) => { if (e.target === mask) close(); });
  window.addEventListener('keydown', onKey, true);
  overlay().append(mask);
  const setMoney = (n) => { if (n == null) return; moneyEl.classList.remove('hidden'); moneyEl.lastChild.textContent = `${n} 两`; };
  setMoney(money);
  return { body, foot, tabs: headExtra, close, closed, setMoney, setFoot(...nodes) { clear(foot).append(...nodes.filter(Boolean)); foot.classList.toggle('hidden', !nodes.length); } };
}

export function memberStats(c, key) {
  const def = PARTY[key];
  const s = statsAt(def, c.levels[key] ?? 1, c.alloc[key]);
  let crit = def.crit;
  for (const eq of gearOf(c, key)) { for (const [k, v] of Object.entries(EQUIPS[eq].mods ?? {})) s[k] += v; crit += EQUIPS[eq].crit ?? 0; }
  for (const [k, v] of Object.entries(TREASURES[c.treasure]?.mods ?? {})) s[k] += v;
  return { ...s, crit };
}

// ---------- 角色 / 召唤兽 ----------
export function openMembers(c, { pets = false, onChange }) {
  const keys = pets ? c.pets.map((p) => p.key) : TEAM;
  const sh = shell({ title: pets ? '召唤兽' : '角色', id: pets ? 'pet' : 'hero', money: c.money, fixed: true });
  if (!keys.length) {
    sh.body.append(h('div.empty', {}, h('img', { src: uiArt('pet'), alt: '' }), h('p', {}, '还没有召唤兽。'), h('p.muted', {}, '火妖气血降到四成以下时，用捕妖绳能收服；取胜后带回来助战。')));
    return sh.closed;
  }
  let cur = keys.find((k) => pendingGrowth(c, k) > 0) ?? keys[0];
  let tab = 'stats';
  let page = 0; // 修炼与兵甲清单排不下一页时的页码
  const changed = () => { onChange?.(); sh.setMoney(c.money); render(); };

  function render() {
    const def = PARTY[cur];
    const lvl = c.levels[cur] ?? 1;
    const s = memberStats(c, cur);
    const roster = h('div.roster', {}, keys.map((k) => {
      const n = pendingGrowth(c, k);
      const isActive = pets && c.pets.find((p) => p.key === k)?.active;
      return h(`button.roster-item${k === cur ? '.on' : ''}`, { type: 'button', data: { member: k }, onclick: () => { cur = k; page = 0; render(); } },
        h('div.face', { style: faceStyle(PARTY[k].art) }), h('span', {}, PARTY[k].name), isActive && h('em', {}, '上阵'), n > 0 && h('span.dot', {}, n));
    }));
    clear(sh.tabs).append(...[['stats', '概览', c.points[cur] ?? 0], ['skills', '修炼', c.skillPoints[cur] ?? 0], ['gear', '装备', 0]].map(([id, label, n]) => h(`button.tab${tab === id ? '.on' : ''}`, { type: 'button', data: { tab: id }, onclick: () => { tab = id; page = 0; render(); } }, label, n > 0 && h('span.dot', {}, n))));
    const portrait = h('div.member-art', {}, h('img', { src: unitArt(def.art), alt: '' }),
      h('div.member-name', {}, h('span.el', { data: { el: def.element } }, def.element), h('b', {}, def.name), h('small', {}, `Lv.${lvl}`)));
    const pane = h('div.member-pane');
    if (tab === 'stats') {
      const pts = c.points[cur] ?? 0;
      pane.append(
        h('div.stat-grid', {}, [['hp', '气血'], ['mp', '法力'], ['atk', '攻击'], ['def', '防御'], ['spd', '速度'], ['mag', '灵力']].map(([k, label]) => h('div.stat', {}, h('img', { src: uiArt(STAT_ICON[k] ?? 'spell'), alt: '' }), h('span', {}, label), h('b', {}, s[k]))), h('div.stat', {}, h('img', { src: uiArt('special'), alt: '' }), h('span', {}, '暴击'), h('b', {}, `${Math.round(s.crit * 100)}%`))),
        h('div.section-title', {}, `潜力 · 可用 ${pts} 点`),
        h('div.alloc', {}, STAT_KEYS.map((st) => h('div.alloc-row', {}, h('b', {}, STAT_LABEL[st]), h('span.muted', {}, `每点 ${STAT_GAIN_TEXT[st]}`), h('em', {}, c.alloc[cur]?.[st] ?? 0),
          h('button.btn.small', { type: 'button', data: { minus: st }, disabled: !(c.alloc[cur]?.[st] > 0), onclick: () => { addPoint(c, cur, st, -1); changed(); } }, '−'),
          h('button.btn.small.qing', { type: 'button', data: { plus: st }, disabled: pts <= 0, onclick: () => { if (addPoint(c, cur, st, 1)) { audio.sfx('click'); changed(); } } }, '＋')))),
      );
      sh.setFoot(h('div.note', {}, pts > 0 ? '不想细分就点「推荐加点」，随时可以减回来重分。' : '每升一级得 5 点潜力。'),
        pets && h('button.btn', { type: 'button', data: { act: 'field' }, disabled: c.pets.find((p) => p.key === cur)?.active, onclick: () => { setActivePet(c, cur); toast(`${def.name}上阵`); changed(); } }, c.pets.find((p) => p.key === cur)?.active ? '已上阵' : '让它上阵'),
        h('button.btn.primary', { type: 'button', data: { act: 'recommend' }, disabled: pts <= 0, onclick: () => { recommendPoints(c, cur); audio.sfx('levelup', { volume: 0.5 }); changed(); } }, '推荐加点'));
    } else if (tab === 'skills') {
      const sp = c.skillPoints[cur] ?? 0;
      const unit = { skillLevels: c.skillLevels[cur] ?? {} };
      const known = learnedSkills(def, lvl);
      const upcoming = Object.entries(def.skills).filter(([lv]) => Number(lv) > lvl).map(([lv, ids]) => `Lv.${lv} ${ids.map((i) => SKILLS[i].name).join('、')}`);
      append(pane, [h('div.section-title', {}, `修炼 · 可用 ${sp} 点`),
        h('div.skill-list', {}, known.map((id) => {
          const rank = skillRank(c, cur, id);
          const sk = skillOf(unit, id);
          const next = rank < GROWTH.skillRankCap ? skillOf({ skillLevels: { [id]: rank + 1 } }, id) : null;
          const cost = studyCost(rank);
          return h('div.skill', {}, h('div.skill-head', {}, h('b', {}, sk.name), h('span.pips', {}, [1, 2, 3].map((i) => h(`i${i <= rank ? '.on' : ''}`))), h('em', {}, sk.mp ? `法力 ${sk.mp}` : '')),
            h('p', {}, SKILLS[id].desc),
            next && h('p.muted', {}, `再修一重：${sk.mul ? `威力从普攻的 ${sk.mul.toFixed(2)} 倍升到 ${next.mul.toFixed(2)} 倍，` : sk.heal ? `疗效多 ${Math.round((next.heal / sk.heal - 1) * 100)}%，` : ''}法力 ${sk.mp} → ${next.mp}`),
            h('div.skill-acts', {}, rank >= GROWTH.skillRankCap ? h('span.muted', {}, '已修满三重') : [
              h('button.btn.small.qing', { type: 'button', data: { train: id }, disabled: sp <= 0, onclick: () => { if (trainSkill(c, cur, id)) { audio.sfx('levelup', { volume: 0.5 }); changed(); } } }, '修炼一重'),
              cost != null && h('button.btn.small', { type: 'button', data: { study: id }, disabled: c.money < cost, onclick: () => { if (studySkill(c, cur, id)) { audio.sfx('coin'); changed(); } } }, `银两研习 ${cost} 两`),
            ]));
        })),
        upcoming.length > 0 && h('p.muted', {}, `往后可习得：${upcoming.join('；')}`)]);
      sh.setFoot(h('div.note', {}, '每升一级得 1 点修炼。每修一重：威力多 6%，耗法少 2，最多三重。'),
        h('button.btn.primary', { type: 'button', data: { act: 'recommend' }, disabled: sp <= 0, onclick: () => { recommendSkills(c, cur); audio.sfx('levelup', { volume: 0.5 }); changed(); } }, '推荐修炼'));
    } else {
      const slots = ['weapon', 'armor'].map((slot) => {
        const eq = EQUIPS[c.gear[cur]?.[slot]];
        return h('div.slot', {}, h('div.slot-art', {}, eq ? h('img', { src: itemArt(eq.key), alt: '' }) : h('img.ghost', { src: uiArt(slot === 'weapon' ? 'attack' : 'armor'), alt: '' })),
          h('div', {}, h('small.muted', {}, EQUIP_SLOTS[slot]),
            h('b', {}, eq ? eq.name : slot === 'weapon' && BASE_WEAPON[cur] ? `${BASE_WEAPON[cur]}（本命，随身）` : '空着'),
            h('span', {}, eq ? (slot === 'weapon' && BASE_WEAPON[cur] ? `${eq.desc}；配在${BASE_WEAPON[cur]}上` : eq.desc) : slot === 'weapon' && BASE_WEAPON[cur] ? '本命兵器不离手；背囊里的兵刃可再配上去加持' : '背囊里有合用的就能换上')),
          eq && h('button.btn.small', { type: 'button', onclick: () => { unequip(c, cur, slot); changed(); } }, '卸下'));
      });
      const bag = Object.entries(c.equipBag).filter(([k, n]) => n > 0 && (!EQUIPS[k].only || EQUIPS[k].only === cur));
      pane.append(h('div.slots', {}, slots), h('div.section-title', {}, '背囊里的兵甲'),
        bag.length ? h('div.equip-list', {}, bag.map(([k, n]) => h('div.slot', {}, h('div.slot-art', {}, h('img', { src: itemArt(k), alt: '' })), h('div', {}, h('small.muted', {}, `${EQUIP_SLOTS[EQUIPS[k].slot]} · ${'一二三'[EQUIPS[k].tier - 1]}阶 ×${n}`), h('b', {}, EQUIPS[k].name), h('span', {}, EQUIPS[k].desc)),
          h('button.btn.small.qing', { type: 'button', data: { equip: k }, onclick: () => { if (equip(c, cur, k)) { audio.sfx('click'); toast(`${def.name}换上${EQUIPS[k].name}`); changed(); } } }, '换上')))) : h('p.muted', {}, '没有可换的兵甲。庄上铁匠铺有卖，封妖也会掉。'));
      sh.setFoot();
    }
    clear(sh.body).append(h('div.members', {}, roster, portrait, pane));
    // 清单按可用高度分页，不出滚动条
    const list = pane.querySelector('.skill-list, .equip-list');
    if (list) {
      list.classList.add('pg-view');
      const bar = h('div');
      list.after(bar);
      page = paginate(list, bar, { page, onChange: (n) => { page = n; audio.sfx('click'); } }).page;
    }
  }
  render();
  return sh.closed;
}

// ---------- 背囊 ----------
export function openBag(c, { onChange }) {
  const sh = shell({ title: '背囊', id: 'bag', money: c.money });
  let cur = null;
  function render() {
    const items = Object.entries(c.items).filter(([k, n]) => n > 0 && ITEMS[k]);
    const equips = Object.entries(c.equipBag).filter(([, n]) => n > 0);
    if (!cur || !(c.items[cur] > 0)) cur = items[0]?.[0] ?? null;
    const grid = h('div.bag-grid', {}, items.map(([k, n]) => h(`button.bag-cell${k === cur ? '.on' : ''}`, { type: 'button', data: { item: k }, title: itemLabel(c, k).name, onclick: () => { cur = k; render(); } }, h('img', { src: itemArt(k), alt: '' }), h('span', {}, n))),
      equips.map(([k, n]) => h('div.bag-cell.equip', { title: EQUIPS[k].name }, h('img', { src: itemArt(k), alt: '' }), h('span', {}, n))),
      Array.from({ length: Math.max(0, 12 - items.length - equips.length) }, () => h('div.bag-cell.empty')));
    const lb = cur ? itemLabel(c, cur) : null;
    const detail = h('div.bag-detail', {}, lb ? [h('img', { src: itemArt(cur), alt: '' }), h('b', {}, lb.name), h('p', {}, lb.desc), h('small.muted', {}, '交战时在【道具】里使用。')] : h('p.muted', {}, '背囊还是空的。'));
    const t = TREASURES[c.treasure];
    const treasure = t ? h('div.treasure-card', {}, h('div.art', { style: { backgroundImage: `url(assets/treasure/${t.art}.jpg)` } }),
      h('div', {}, h('small.muted', {}, '法宝 · 全队只带一件'), h('b', {}, t.name), h('span', {}, t.desc)),
      h('button.btn.small', { type: 'button', data: { act: 'swap-treasure' }, onclick: () => { c.treasure = c.treasure === 'dingfengdan' ? 'bihuojin' : 'dingfengdan'; toast(`换持${TREASURES[c.treasure].name}`); onChange?.(); render(); } }, `换持${TREASURES[c.treasure === 'dingfengdan' ? 'bihuojin' : 'dingfengdan'].name}`)) : null;
    clear(sh.body).append(h('div.bag', {}, h('div', {}, grid, treasure), detail));
  }
  render();
  return sh.closed;
}

// ---------- 任务 ----------
export function openQuests(c, sceneId, { onTrack }) {
  const sh = shell({ title: '任务', narrow: true, id: 'quest' });
  const main = mainQuest(c, sceneId);
  const side = bountyQuest(c);
  const card = (q, kind) => h(`div.quest-card${kind === '日常' ? '.side' : ''}`, {}, h('div.k', {}, h('i', {}, kind), q.title), h('p', {}, q.text),
    q.npc && h('button.btn.small.qing', { type: 'button', data: { act: 'track' }, onclick: () => { sh.close(); onTrack(q); } }, '自动寻路前往'));
  const seen = Object.keys(c.explored).length;
  append(sh.body, [card(main, '主线'), side && card(side, '日常'),
    h('div.section-title', {}, `沿途见闻 · ${seen} / ${Object.keys(LANDMARKS).length}`),
    h('p.muted', {}, seen ? Object.keys(c.explored).map((id) => LANDMARKS[id].title).join('、') : '四张图的支路上各有两处去处，地上有一圈金色虚线的就是。')]);
  return sh.closed;
}

// ---------- 阵型 ----------
export function openFormation(c, { onChange }) {
  const sh = shell({ title: '阵型', narrow: true, id: 'formation' });
  function render() {
    clear(sh.body).append(h('div.forms', {}, Object.values(FORMATIONS).map((f) => h(`button.form-card${c.formation === f.key ? '.on' : ''}`, { type: 'button', data: { formation: f.key }, onclick: () => { c.formation = f.key; audio.sfx('quest', { volume: 0.6 }); onChange?.(); render(); } },
      h('b', {}, f.name, c.formation === f.key && h('em', {}, '当前')), h('span.gain', {}, f.gain), h('span.cost', {}, `代价：${f.cost}`)))),
    h('p.muted', {}, '交战中每回合也能免费换一次阵，不占任何人的行动。'));
  }
  render();
  return sh.closed;
}

// ---------- 商店 ----------
export function openShop(c, shopId, { onChange }) {
  const shop = SHOPS[shopId];
  const sh = shell({ title: shop.title, narrow: true, id: 'shop', money: c.money });
  function render() {
    clear(sh.body).append(h('p.shop-line', {}, SHOP_LINES[shopId]), h('div.goods', {}, shop.goods.map((g) => {
      const key = g.item ?? g.equip;
      const name = g.item ? ITEMS[key].name : EQUIPS[key].name;
      const desc = g.item ? ITEMS[key].desc : `${EQUIP_SLOTS[EQUIPS[key].slot]} · ${EQUIPS[key].desc}`;
      const have = g.item ? c.items[key] ?? 0 : c.equipBag[key] ?? 0;
      return h('div.slot', {}, h('div.slot-art', {}, h('img', { src: itemArt(key), alt: '' })), h('div', {}, h('b', {}, name), h('span', {}, desc), h('small.muted', {}, `已有 ${have}`)),
        h('button.btn.small.primary', { type: 'button', data: { buy: key }, disabled: c.money < g.price, onclick: () => { if (buy(c, g)) { audio.sfx('coin'); sh.setMoney(c.money); onChange?.(); render(); } } }, `${g.price} 两`));
    })));
  }
  render();
  return sh.closed;
}

// ---------- 设置与须知 ----------
export function openHelp() {
  const sh = shell({ title: '行前须知', narrow: true, id: 'help' });
  sh.body.append(h('div.help', {}, HELP.map(([k, v]) => h('div', {}, h('b', {}, k), h('p', {}, v)))));
  return sh.closed;
}

// 三人的本命兵器一直在手：兵器栏空着时照实写出来，换上的兵刃算配在上面的加持
const BASE_WEAPON = { wukong: '金箍棒', bajie: '九齿钉耙', sha: '降妖宝杖' };

export function openSettings({ inGame, onSave, onTitle, onApply }) {
  const sh = shell({ title: '设置', narrow: true, id: 'settings' });
  const slider = (key, label) => h('label.set-row', {}, h('span', {}, label), h('input', { type: 'range', min: 0, max: 100, value: Math.round(settings[key] * 100), data: { set: key }, oninput: (e) => { settings[key] = Number(e.target.value) / 100; saveSettings(); onApply?.(); } }));
  const toggle = (key, label, onText = '开', offText = '关', map = (v) => v) => {
    const b = h('button.btn.small', { type: 'button', data: { set: key }, onclick: () => { settings[key] = map(settings[key], true); saveSettings(); onApply?.(); paint(); } });
    const paint = () => { const on = key === 'speed' ? settings.speed === 2 : !!settings[key]; b.textContent = on ? onText : offText; b.classList.toggle('qing', on); };
    paint();
    return h('div.set-row', {}, h('span', {}, label), b);
  };
  // 用 dom.append 而不是原生 append：游戏外不显示的存档两行是 false，原生 append 会把它印成字
  append(sh.body, [
    h('div.section-title', {}, '声音'), slider('music', '音乐'), slider('sound', '音效'), toggle('mute', '静音', '已静音', '有声', (v) => !v),
    h('div.section-title', {}, '交战'), toggle('speed', '演出速度', '加速 ×2', '常速 ×1', (v) => (v === 2 ? 1 : 2)), toggle('shake', '震屏', '开', '关', (v) => !v),
    h('div.section-title', {}, '其他'),
    h('div.set-row', {}, h('span', {}, '怎么玩'), h('button.btn.small', { type: 'button', data: { act: 'help' }, onclick: () => openHelp() }, '行前须知')),
    inGame && h('div.set-row', {}, h('span', {}, '存档（每场战斗后也会自动存）'), h('button.btn.small.qing', { type: 'button', data: { act: 'save' }, onclick: () => { onSave(); toast('已存档', 'good'); } }, '现在存档')),
    inGame && h('div.set-row', {}, h('span', {}, '回到标题画面'), h('button.btn.small', { type: 'button', data: { act: 'title' }, onclick: () => { sh.close(); onTitle(); } }, '存档并返回')),
  ]);
  return sh.closed;
}

export const expLine = (c) => ({ level: c.levels.wukong, exp: c.exp, need: expToNext(c.levels.wukong), capped: c.levels.wukong >= levelCap(c), silver: c.money });
export { ECONOMY };
