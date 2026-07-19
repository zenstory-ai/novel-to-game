// 战斗界面:经典对阵(敌左上斜列、我右下斜列)、行动顺序条、指令菜单、飘字动画。
// 界面只渲染与收集指令,一切数值结算走 engine。

import { SKILLS, FORMS, FORMATIONS, ITEMS } from './data.js';
import {
  createBattle, executeRound, buildActionQueue, aliveUnits, getUnit,
  effStat, unitSkills, levelUpParty, elementRelation, switchFormation,
} from './engine.js';
import { TEXT } from './text.js';
import { el, floatText, stampText, toast, showModal, showDialog, onceCard, iconBadge } from './ui.js';
import { unitURL, bgStyle } from './assets.js';
import { audio } from './audio.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runBattleScreen(ctx) {
  // ctx: {root, battleId, partyLevels, petJoined, formation, items, seed, fast, showTutorial}
  const { root, battleId, fast } = ctx;
  root.querySelectorAll('.toast').forEach((n) => n.remove()); // 清掉上一场残留提示
  const state = createBattle({
    battleId,
    party: ctx.partyDefs,
    formation: ctx.formation,
    items: ctx.items,
    treasure: ctx.treasure ?? null,
    startDebuff: ctx.startDebuff ?? null,
    seed: ctx.seed,
  });
  // QA/调试钩子:读取战斗实时状态
  window.__game = window.__game || {};
  window.__game.battle = state;
  const D = fast ? 0.22 : 1; // 动画时长系数
  let formationNow = ctx.formation;
  let transformHinted = false;
  let sawFinisher = false;
  let sawPhase = false;
  let prevQueue = []; // 上回合行动顺序(抢位检测)
  let jumpedIds = [];
  const floatSlots = new Map(); // 飘字错层防叠字

  // ---------- DOM 骨架 ----------
  const bRoot = el('div', 'battle-root');
  bRoot.id = 'battle-root';
  const field = el('div', 'battle-field');
  field.id = 'battle-field';
  Object.assign(field.style, bgStyle(state.def.bg));
  const orderBar = el('div', 'order-bar');
  orderBar.id = 'order-bar';
  const orderLabel = el('span', 'order-label', TEXT.ui.orderTitle);
  const orderChips = el('div', 'order-chips');
  orderBar.append(orderLabel, orderChips);
  const roundTag = el('div', 'round-tag');
  const banner = el('div', 'skill-banner');
  banner.style.display = 'none';
  // 五行相克环(常驻角落)
  const ring = el('div', 'wuxing-ring');
  ring.title = '五行相克:金克木、木克土、土克水、水克火、火克金';
  const ringSeq = ['金', '木', '土', '水', '火'];
  ringSeq.forEach((e2, i) => {
    const node = el('span', 'ring-el', e2);
    node.dataset.el = e2;
    ring.appendChild(node);
    ring.appendChild(el('span', 'ring-arrow', i === ringSeq.length - 1 ? '↺' : '→'));
  });
  // 战斗中免费换阵(每回合一次)
  const formBtn = el('button', 'btn formation-btn');
  formBtn.id = 'btn-battle-formation';
  field.append(orderBar, roundTag, banner, ring, formBtn);
  const bottom = el('div', 'battle-bottom');
  const cmdStatus = el('div', 'cmd-status');
  const cmdMenu = el('div', 'cmd-menu');
  cmdMenu.id = 'cmd-menu';
  cmdMenu.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) audio.sfx('click');
  });
  bottom.append(cmdStatus, cmdMenu);
  bRoot.append(field, bottom);
  root.appendChild(bRoot);

  const cardByUnit = new Map();

  // ---------- 单位卡片 ----------
  function unitCard(u, idx) {
    const card = el('div', `unit-card ${u.side}`);
    card.dataset.unitId = u.id;
    const anchor = el('div', 'float-anchor');
    const shadow = el('div', 'unit-shadow');
    const img = el('img', 'unit-portrait');
    img.src = unitURL(u.portrait, u.name);
    img.alt = u.name;
    img.draggable = false;
    const name = el('div', 'unit-name', u.name);
    const badge = el('div', 'elem-badge', u.element);
    badge.dataset.el = u.element;
    const bars = el('div', 'unit-bars');
    const hpBar = barEl('hp');
    bars.appendChild(hpBar.wrap);
    let mpBar = null;
    if (u.side === 'party') {
      mpBar = barEl('mp');
      bars.appendChild(mpBar.wrap);
    }
    const chips = el('div', 'buff-chips');
    card.append(anchor, shadow, badge, img, name, bars, chips);
    // 站位:敌左上斜列、我右下斜列
    if (u.side === 'enemy') {
      card.style.left = `${5 + idx * 12}%`;
      card.style.top = `${8 + idx * 14}%`;
    } else {
      card.style.left = `${54 + idx * 10}%`;
      card.style.top = `${33 + idx * 11}%`;
    }
    if (u.big) card.classList.add('big');
    return { card, img, name, badge, hpBar, mpBar, chips, anchor };
  }

  function barEl(kind) {
    const wrap = el('div', `bar ${kind}`);
    const ghost = el('div', 'bar-ghost');
    const fill = el('div', 'bar-fill');
    const text = el('div', 'bar-text');
    wrap.append(ghost, fill, text);
    return { wrap, ghost, fill, text };
  }

  function renderUnits() {
    field.querySelectorAll('.unit-card').forEach((c) => c.remove());
    cardByUnit.clear();
    const enemies = state.units.filter((u) => u.side === 'enemy');
    const party = state.units.filter((u) => u.side === 'party');
    for (const [i, u] of enemies.entries()) {
      const uc = unitCard(u, i);
      field.appendChild(uc.card);
      cardByUnit.set(u.id, uc);
    }
    for (const [i, u] of party.entries()) {
      const uc = unitCard(u, i);
      field.appendChild(uc.card);
      cardByUnit.set(u.id, uc);
    }
    refreshAll();
  }

  function refreshUnit(u) {
    const uc = cardByUnit.get(u.id);
    if (!uc) return;
    const hpPct = `${(u.hp / u.maxHp) * 100}%`;
    uc.hpBar.fill.style.width = hpPct;
    uc.hpBar.ghost.style.width = hpPct;
    uc.hpBar.text.textContent = `${u.hp}/${u.maxHp}`;
    uc.hpBar.wrap.classList.toggle('low', u.alive && u.hp / u.maxHp < 0.25);
    if (uc.mpBar) {
      uc.mpBar.fill.style.width = `${(u.mp / u.maxMp) * 100}%`;
      uc.mpBar.ghost.style.width = `${(u.mp / u.maxMp) * 100}%`;
      uc.mpBar.text.textContent = `${u.mp}/${u.maxMp}`;
    }
    uc.name.textContent = u.name;
    uc.badge.textContent = u.element;
    uc.badge.dataset.el = u.element;
    uc.card.classList.toggle('dead', !u.alive);
    uc.chips.innerHTML = '';
    for (const b of u.buffs) {
      const chip = el('span', 'buff-chip', `${TEXT.buffNames[b.id] ?? b.id}${b.turns}`);
      chip.dataset.buff = b.id;
      uc.chips.appendChild(chip);
    }
    if (u.defending) uc.chips.appendChild(el('span', 'buff-chip', TEXT.float.defend));
    if (u.form) uc.card.classList.add('transformed'); else uc.card.classList.remove('transformed');
  }

  function refreshAll() {
    for (const u of state.units) refreshUnit(u);
    roundTag.textContent = TEXT.ui.round.replace('{n}', state.round);
  }

  // ---------- 行动顺序条 ----------
  function renderOrderBar(highlightId = null, doneIds = []) {
    orderChips.innerHTML = '';
    const q = buildActionQueue(state);
    for (const id of q) {
      const u = getUnit(state, id);
      const chip = el('div', 'order-chip');
      if (id === highlightId) chip.classList.add('current');
      if (doneIds.includes(id)) chip.classList.add('done');
      if (jumpedIds.includes(id)) {
        chip.classList.add('jumped');
        chip.appendChild(el('span', 'jump-badge', '抢'));
      }
      const img = el('img');
      img.src = unitURL(u.portrait, u.name);
      img.alt = u.name;
      chip.append(img, el('span', 'order-chip-name', u.name));
      chip.append(el('span', 'order-chip-spd', String(Math.round(effStat(state, u, 'spd')))));
      chip.title = `${u.name} · 速度 ${Math.round(effStat(state, u, 'spd'))}`;
      orderChips.appendChild(chip);
    }
  }

  // 换阵后/加减速后立即重渲染顺序条(重排当场发生;抢位标记由回合事件维护)
  function refreshQueueMarks() {
    renderOrderBar();
  }

  // ---------- 战斗内免费换阵 ----------
  let commandPhase = false;
  function refreshFormationBtn() {
    const f = FORMATIONS[state.formation];
    formBtn.textContent = TEXT.battle.formationBtn.replace('{name}', f.name);
    formBtn.title = `${f.desc} · 战斗内换阵免费,每回合一次`;
    formBtn.classList.toggle('disabled', state.formationSwitched || !commandPhase);
  }
  formBtn.addEventListener('click', async () => {
    if (!commandPhase || state.formationSwitched) {
      toast(root, state.formationSwitched ? TEXT.battle.formationUsed : '结算中……');
      return;
    }
    const other = Object.values(FORMATIONS).find((f) => f.key !== state.formation);
    const evs = switchFormation(state, other.key);
    if (!evs) return;
    formationNow = other.key;
    refreshFormationBtn();
    refreshQueueMarks();
    await showBanner(`${TEXT.commands.formation} · ${other.name}`);
    refreshAll();
  });

  // ---------- 指令菜单 ----------
  const CMD_ICONS = { attack: '攻', skill: '法', defend: '防', item: '道', special: '技', auto: '自', flee: '逃', back: '返' };

  function cmdButton(label, cmd, sub) {
    const b = el('button', 'btn cmd-btn');
    b.dataset.cmd = cmd;
    if (sub) b.dataset.sub = sub;
    b.append(iconBadge(CMD_ICONS[cmd] ?? label[0]), el('span', '', label));
    return b;
  }

  // 左侧小卷轴牌:当前单位头像+名字+五行徽记+提示
  function setStatusFor(u) {
    cmdStatus.innerHTML = '';
    const avatar = el('img', 'cmd-avatar');
    avatar.src = unitURL(u.portrait, u.name);
    avatar.alt = u.name;
    const who = el('div', 'cmd-who');
    const nameRow = el('div', 'cmd-who-name');
    nameRow.append(iconBadge(u.element, { round: true, sm: true }), el('span', '', u.name));
    const tip = el('div', 'cmd-who-tip', '选择指令');
    who.append(nameRow, tip);
    cmdStatus.append(avatar, who);
  }

  function clearStatus() {
    cmdStatus.innerHTML = '';
    cmdStatus.append(el('div', 'cmd-who-tip', '……'));
  }

  function pickTarget(u, side) {
    // side: 'enemy' | 'party';悬停目标显示五行预览(克!/被克/普通)
    return new Promise((resolve) => {
      const tipEl = cmdStatus.querySelector('.cmd-who-tip');
      if (tipEl) tipEl.textContent = TEXT.commands.targetPick;
      else cmdStatus.textContent = TEXT.commands.targetPick;
      const valid = aliveUnits(state, side);
      const cards = valid.map((t) => cardByUnit.get(t.id).card);
      const badges = new Map();
      for (const c of cards) c.classList.add('targetable');
      const onOver = (ev) => {
        const card = ev.target.closest('.unit-card');
        if (!card || !cards.includes(card)) return;
        if (badges.has(card)) return;
        const target = getUnit(state, card.dataset.unitId);
        const rel = elementRelation(u.element, target.element);
        const b = el('div', `preview-badge ${rel === 'ke' ? 'good' : rel === 'beike' ? 'bad' : 'none'}`,
          rel === 'ke' ? TEXT.battle.previewKe : rel === 'beike' ? TEXT.battle.previewBeike : TEXT.battle.previewNone);
        card.appendChild(b);
        badges.set(card, b);
      };
      const onOut = (ev) => {
        const card = ev.target.closest('.unit-card');
        const b = card && badges.get(card);
        if (b) { b.remove(); badges.delete(card); }
      };
      const onClick = (ev) => {
        const card = ev.target.closest('.unit-card');
        if (!card || !cards.includes(card)) return;
        cleanup();
        resolve(card.dataset.unitId);
      };
      const onKey = (ev) => {
        if (ev.key === 'Escape') { cleanup(); resolve(null); }
      };
      function cleanup() {
        for (const c of cards) c.classList.remove('targetable');
        for (const b of badges.values()) b.remove();
        field.removeEventListener('click', onClick);
        field.removeEventListener('mouseover', onOver);
        field.removeEventListener('mouseout', onOut);
        window.removeEventListener('keydown', onKey);
      }
      field.addEventListener('click', onClick);
      field.addEventListener('mouseover', onOver);
      field.addEventListener('mouseout', onOut);
      window.addEventListener('keydown', onKey);
    });
  }

  async function collectCommandFor(u) {
    for (;;) {
      setStatusFor(u);
      highlightCommanding(u.id);
      const cmd = await menuFor(u);
      highlightCommanding(null);
      if (cmd) return cmd;
    }
  }

  function highlightCommanding(id) {
    for (const [, uc] of cardByUnit) uc.card.classList.remove('commanding');
    if (id) cardByUnit.get(id)?.card.classList.add('commanding');
  }

  function menuFor(u) {
    return new Promise((resolve) => {
      cmdMenu.innerHTML = '';
      const wrap = el('div', 'cmd-grid');

      const bAtk = cmdButton(TEXT.commands.attack, 'attack');
      bAtk.title = TEXT.battle.attackTip;
      bAtk.onclick = async () => {
        const t = await pickTarget(u, 'enemy');
        resolve(t ? { type: 'attack', targetId: t } : null);
      };
      const bSkill = cmdButton(TEXT.commands.skill, 'skill');
      bSkill.title = TEXT.battle.skillTip;
      bSkill.onclick = () => skillMenu(u, resolve);
      const bDef = cmdButton(TEXT.commands.defend, 'defend');
      bDef.title = TEXT.battle.defendTip;
      bDef.onclick = () => resolve({ type: 'defend' });
      const bItem = cmdButton(TEXT.commands.item, 'item');
      bItem.title = TEXT.battle.itemTip;
      bItem.onclick = () => itemMenu(u, resolve);
      const bSp = cmdButton(TEXT.commands.special, 'special');
      bSp.title = TEXT.battle.specialTip;
      if (!u.hasTransform) {
        bSp.classList.add('disabled');
        bSp.title = TEXT.battle.specialTip;
      } else {
        bSp.onclick = () => specialMenu(u, resolve);
      }
      const bAuto = cmdButton(TEXT.commands.auto, 'auto');
      bAuto.title = TEXT.battle.autoTip;
      bAuto.onclick = () => {
        const tipEl = cmdStatus.querySelector('.cmd-who-tip');
        if (tipEl) tipEl.textContent = '交给自动';
        resolve({ type: 'auto' });
      };
      const bFlee = cmdButton(TEXT.commands.flee, 'flee');
      bFlee.title = TEXT.battle.fleeTip;
      bFlee.onclick = () => resolve({ type: 'flee' });

      wrap.append(bAtk, bSkill, bDef, bItem, bSp, bAuto, bFlee);
      cmdMenu.appendChild(wrap);
    });
  }

  function backButton(resolve) {
    const b = cmdButton(TEXT.commands.back, 'back');
    b.onclick = () => resolve(null);
    return b;
  }

  function skillMenu(u, resolve) {
    cmdMenu.innerHTML = '';
    const wrap = el('div', 'cmd-list');
    const keys = unitSkills(u);
    const targetLabel = { enemy: '单体', enemies: '群体', ally: '友方', party: '全队', self: '自身' };
    for (const k of keys) {
      const s = SKILLS[k];
      const item = el('button', 'btn cmd-item');
      item.dataset.skill = k;
      const nm = el('span', 'cmd-item-name');
      nm.append(iconBadge(s.kind === 'mag' ? '法' : '物', { sm: true }), document.createTextNode(' ' + s.name));
      const meta = el('span', 'cmd-item-meta', `${targetLabel[s.target] ?? ''}${s.kind === 'mag' ? '法术' : '物理'}·${u.element} · MP${s.mp}`);
      item.append(nm, meta);
      if (s.desc) item.title = s.desc;
      if (s.mp > u.mp) {
        item.classList.add('disabled');
        item.title = TEXT.ui.noMp;
      } else {
        item.onclick = async () => {
          if (s.target === 'enemy') {
            const t = await pickTarget(u, 'enemy');
            resolve(t ? { type: 'skill', skillId: k, targetId: t } : null);
          } else if (s.target === 'ally') {
            const t = await pickTarget(u, 'party');
            resolve(t ? { type: 'skill', skillId: k, targetId: t } : null);
          } else {
            resolve({ type: 'skill', skillId: k });
          }
        };
      }
      wrap.appendChild(item);
    }
    wrap.appendChild(backButton(resolve));
    cmdMenu.appendChild(wrap);
  }

  function itemMenu(u, resolve) {
    cmdMenu.innerHTML = '';
    const wrap = el('div', 'cmd-list');
    const owned = Object.entries(state.items).filter(([, n]) => n > 0);
    if (owned.length === 0) wrap.appendChild(el('div', 'cmd-empty', '——'));
    for (const [k, n] of owned) {
      const it = ITEMS[k];
      const item = el('button', 'btn cmd-item', `${it.name} ×${n}`);
      item.dataset.item = k;
      if (it.desc) item.title = it.desc;
      item.onclick = async () => {
        if (it.target === 'ally') {
          const t = await pickTarget(u, 'party');
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else if (it.target === 'enemy') {
          const t = await pickTarget(u, 'enemy');
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else {
          resolve({ type: 'item', itemId: k });
        }
      };
      wrap.appendChild(item);
    }
    wrap.appendChild(backButton(resolve));
    cmdMenu.appendChild(wrap);
  }

  async function specialMenu(u, resolve) {
    // 首次打开先弹「七十二变」小卡片
    await onceCard(root, 'transform', TEXT.onceCards.transform.title, TEXT.onceCards.transform.lines);
    cmdMenu.innerHTML = '';
    const wrap = el('div', 'cmd-list');
    const foes = aliveUnits(state, 'enemy');
    for (const [fk, f] of Object.entries(FORMS)) {
      // 五行杠杆提示:该形态能克到场上哪个活敌
      const countered = foes.filter((e) => elementRelation(f.element, e.element) === 'ke');
      const hint = countered.length > 0 ? ` · 克${countered[0].element}·${countered[0].name}` : '';
      const item = el('button', 'btn cmd-item');
      item.dataset.form = fk;
      const nm = el('span', 'cmd-item-name', `${TEXT.commands.transform} · ${f.name}`);
      const meta = el('span', 'cmd-item-meta', `${f.element}属性 · 无消耗${hint}`);
      item.append(nm, meta);
      item.title = f.desc;
      if (countered.length > 0) item.classList.add('counter');
      item.onclick = () => resolve({ type: 'transform', formId: fk });
      wrap.appendChild(item);
    }
    wrap.appendChild(backButton(resolve));
    cmdMenu.appendChild(wrap);
  }

  // ---------- 事件动画 ----------
  function cardOf(id) { return cardByUnit.get(id); }

  async function showBanner(text, cls = '') {
    banner.textContent = text;
    banner.className = `skill-banner ${cls}`;
    banner.style.display = 'block';
    await sleep(520 * D);
    banner.style.display = 'none';
  }

  function lunge(actorId, targetId) {
    const a = cardOf(actorId), t = cardOf(targetId);
    if (!a || !t) return;
    const ar = a.card.getBoundingClientRect(), tr = t.card.getBoundingClientRect();
    const dx = (tr.left - ar.left) * 0.24, dy = (tr.top - ar.top) * 0.24;
    a.card.style.transform = `translate(${dx}px, ${dy}px)`;
    setTimeout(() => { a.card.style.transform = ''; }, 200 * D + 60);
  }

  function shake(id) {
    const uc = cardOf(id);
    if (!uc) return;
    uc.card.classList.remove('shake');
    void uc.card.offsetWidth;
    uc.card.classList.add('shake');
  }

  function flashHit(id) {
    const uc = cardOf(id);
    if (!uc) return;
    uc.img.classList.remove('hit-flash');
    void uc.img.offsetWidth;
    uc.img.classList.add('hit-flash');
    setTimeout(() => uc.img.classList.remove('hit-flash'), 380);
  }

  function quake() {
    field.classList.remove('quake');
    void field.offsetWidth;
    field.classList.add('quake');
    setTimeout(() => field.classList.remove('quake'), 500);
  }

  // 飘字错层:同一目标同时多个飘字时向下排
  function nextSlot(id) {
    const n = (floatSlots.get(id) ?? 0) + 1;
    floatSlots.set(id, n);
    setTimeout(() => floatSlots.set(id, 0), 1200);
    return n - 1;
  }

  async function playEvents(events) {
    const done = [];
    for (const ev of events) {
      switch (ev.t) {
        case 'round':
          // 与上回合顺序比较,标出插到更前的单位(抢位)
          jumpedIds = prevQueue.length
            ? ev.queue.filter((id, i) => {
                const before = prevQueue.indexOf(id);
                return before > -1 && i < before;
              })
            : [];
          prevQueue = [...ev.queue];
          refreshAll();
          renderOrderBar();
          break;
        case 'turn':
          renderOrderBar(ev.unit, done);
          break;
        case 'action': {
          const u = getUnit(state, ev.actor);
          if (u) {
            const uc = cardOf(ev.actor);
            if (uc) floatText(uc.anchor, ev.name, 'info');
          }
          if (ev.skill) audio.sfx('skill');
          await sleep(160 * D);
          break;
        }
        case 'damage': {
          lunge(ev.actor, ev.target);
          await sleep(120 * D);
          const uc = cardOf(ev.target);
          if (uc) {
            const slot = nextSlot(ev.target);
            if (ev.combo) {
              stampText(uc.anchor, TEXT.float.combo, 'combo-stamp');
              floatText(uc.anchor, `${ev.amount}`, 'dmg combo-dmg', slot);
            } else {
              let cls = 'dmg';
              if (ev.crit) cls = 'crit';
              else if (ev.rel === 'ke') cls = 'ke-big';
              else if (ev.rel === 'beike') cls = 'beike';
              if (ev.amount > 200) cls += ' huge';
              floatText(uc.anchor, `${ev.amount}`, cls, slot);
              if (ev.crit) stampText(uc.anchor, TEXT.float.crit, 'crit-stamp');
              if (ev.rel === 'ke') stampText(uc.anchor, TEXT.float.ke, 'ke-stamp');
              if (ev.rel === 'beike') floatText(uc.anchor, TEXT.float.beike, 'beike-label', slot + 1);
            }
            shake(ev.target);
            flashHit(ev.target);
            if (ev.crit) quake();
            if (ev.combo) audio.sfx('combo');
            else if (ev.crit) audio.sfx('crit');
            else if (ev.rel === 'ke') audio.sfx('ke');
            else if (ev.rel === 'beike') audio.sfx('thud');
            else audio.sfx('hit');
          }
          refreshAll();
          await sleep(300 * D);
          break;
        }
        case 'miss': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.miss, 'miss');
          audio.sfx('thud');
          await sleep(240 * D);
          break;
        }
        case 'heal': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.heal.replace('{n}', ev.amount), 'heal');
          audio.sfx('heal');
          refreshAll();
          await sleep(220 * D);
          break;
        }
        case 'mp': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.mpUp.replace('{n}', ev.amount), 'mpup');
          refreshAll();
          break;
        }
        case 'buff': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.buffNames[ev.buff] ?? ev.buff, 'buff');
          refreshAll();
          await sleep(160 * D);
          break;
        }
        case 'resist': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.miss, 'miss');
          break;
        }
        case 'defend': {
          const uc = cardOf(ev.unit);
          if (uc) floatText(uc.anchor, TEXT.float.defend, 'buff');
          refreshAll();
          await sleep(140 * D);
          break;
        }
        case 'stun': {
          const uc = cardOf(ev.unit);
          if (uc) floatText(uc.anchor, TEXT.float.stun, 'beike');
          await sleep(160 * D);
          break;
        }
        case 'transform': {
          const uc = cardOf(ev.actor);
          if (uc) {
            uc.card.classList.add('flash');
            floatText(uc.anchor, TEXT.float.transform.replace('{name}', ev.name), 'ke');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * D);
          }
          audio.sfx('transform');
          refreshAll();
          await sleep(360 * D);
          break;
        }
        case 'form_end': {
          const uc = cardOf(ev.unit);
          if (uc) floatText(uc.anchor, TEXT.float.formEnd, 'info');
          refreshAll();
          break;
        }
        case 'finisher': {
          sawFinisher = true;
          const overlay = el('div', 'finisher-overlay');
          const img = el('img');
          img.src = unitURL('insect', '虫');
          const tx = el('div', 'finisher-text', TEXT.story.luoshaMid[0].text);
          overlay.append(img, tx);
          field.appendChild(overlay);
          shake(ev.target);
          await sleep(1400 * D);
          overlay.remove();
          break;
        }
        case 'reinforce': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.heal.replace('{n}', ev.amount), 'heal');
          refreshAll();
          break;
        }
        case 'phase': {
          sawPhase = true;
          renderUnits();
          const uc = cardOf(ev.unit);
          if (uc) {
            uc.card.classList.add('flash');
            setTimeout(() => uc.card.classList.remove('flash'), 600 * D);
          }
          audio.sfx('telegraph');
          await showBanner(TEXT.story.phase2[0].text, 'phase-banner');
          field.classList.add('quake');
          setTimeout(() => field.classList.remove('quake'), 500);
          refreshAll();
          await sleep(300 * D);
          break;
        }
        case 'death': {
          const uc = cardOf(ev.unit);
          if (uc) uc.card.classList.add('dead');
          refreshAll();
          await sleep(320 * D);
          break;
        }
        case 'telegraph': {
          const u = getUnit(state, ev.unit);
          const uc = cardOf(ev.unit);
          if (uc) uc.card.classList.add('charging');
          audio.sfx('telegraph');
          await showBanner(TEXT.battle.telegraph.replace('{name}', u ? u.name : '').replace('{skill}', ev.name), 'telegraph-banner');
          break;
        }
        case 'heavy': {
          const ac = cardOf(ev.actor);
          if (ac) ac.card.classList.remove('charging');
          const uc = cardOf(ev.target);
          lunge(ev.actor, ev.target);
          if (uc) {
            floatText(uc.anchor, `${ev.amount}`, 'heavy', 0);
            stampText(uc.anchor, ev.name, 'heavy-stamp');
            if (ev.mitigated) floatText(uc.anchor, TEXT.battle.heavyMitigated, 'buff', 1);
            shake(ev.target);
            flashHit(ev.target);
          }
          quake();
          audio.sfx('heavy');
          refreshAll();
          await sleep(420 * D);
          break;
        }
        case 'caught': {
          const uc = cardOf(ev.target);
          if (uc) {
            floatText(uc.anchor, `收服了 ${ev.name}!`, 'ke');
            uc.card.classList.add('dead');
          }
          audio.sfx('levelup');
          toast(root, `收服了 ${ev.name}!可在「召唤兽」中安排上阵`);
          await sleep(420 * D);
          break;
        }
        case 'catch_fail': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '挣脱了!', 'miss');
          await sleep(240 * D);
          break;
        }
        case 'ward': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '避火!', 'buff');
          await sleep(200 * D);
          break;
        }
        case 'story_blow': {
          // 罗刹女祭真扇:悟空被吹飞(演出)
          audio.sfx('fan2');
          const bossUc = ev.actor ? cardOf(ev.actor) : null;
          if (bossUc) {
            bossUc.card.classList.add('flash');
            setTimeout(() => bossUc.card.classList.remove('flash'), 500 * D);
          }
          await showBanner('芭蕉扇——!', 'fan-banner');
          const wk = cardOf('p0');
          if (wk) {
            wk.card.classList.add('blown');
            floatText(wk.anchor, '吹飞五万里!', 'heavy');
          }
          quake();
          await sleep(1400 * D);
          break;
        }
        case 'story_retreat': {
          // 牛魔王赴宴而走(演出)
          audio.sfx('telegraph');
          await showBanner('「罢了!本王还要去碧波潭赴宴——」', 'telegraph-banner');
          const bossUc = ev.actor ? cardOf(ev.actor) : null;
          if (bossUc) {
            bossUc.card.classList.add('retreat');
            floatText(bossUc.anchor, '扬长而去', 'info');
          }
          await sleep(1200 * D);
          break;
        }
        case 'summon': {
          renderUnits();
          const uc = cardOf(ev.unit);
          if (uc) {
            floatText(uc.anchor, `${ev.name} 来援!`, 'buff');
            uc.card.classList.add('flash');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * D);
          }
          audio.sfx('telegraph');
          refreshAll();
          await sleep(320 * D);
          break;
        }
        case 'rout': {
          const uc = cardOf(ev.unit);
          if (uc) {
            floatText(uc.anchor, '溃散!', 'miss');
            uc.card.classList.add('dead');
          }
          refreshAll();
          await sleep(240 * D);
          break;
        }
        case 'god_assist': {
          // 众神围剿:哪吒登场助战(门控演出)
          audio.sfx('victory');
          const overlay = el('div', 'god-overlay');
          const img = el('img');
          img.src = unitURL('nezha', '哪');
          const tx = el('div', 'finisher-text', `${ev.name} 率众神前来助战!`);
          overlay.append(img, tx);
          field.appendChild(overlay);
          const uc = cardOf(ev.target);
          if (uc) {
            floatText(uc.anchor, `${ev.amount}`, 'heavy');
            shake(ev.target);
            flashHit(ev.target);
          }
          quake();
          await sleep(1600 * D);
          overlay.remove();
          refreshAll();
          break;
        }
        case 'flee': {
          toast(root, ev.success ? TEXT.ui.escaped : (state.def.boss ? TEXT.ui.bossNoEscape : TEXT.ui.escapeFail));
          await sleep(300 * D);
          break;
        }
        case 'formation': {
          formationNow = ev.formation;
          const f = FORMATIONS[ev.formation];
          await showBanner(`${TEXT.commands.formation} · ${f.name}`);
          refreshAll();
          break;
        }
        case 'auto': break;
        case 'item': {
          const it = ITEMS[ev.item];
          if (ev.item === 'truefan' && ev.stage) audio.sfx(`fan${ev.stage}`);
          else if (ev.item === 'fakefan') audio.sfx('thud');
          await showBanner(it.name, ev.item.includes('fan') || ev.item === 'truefan' ? 'fan-banner' : '');
          break;
        }
        case 'info': {
          if (ev.text === 'fakefan') toast(root, TEXT.fanMsgs.fakefan, 3200);
          else if (ev.text === 'fan1') toast(root, TEXT.fanMsgs.fan1, 3200);
          else if (ev.text === 'fan2') toast(root, TEXT.fanMsgs.fan2, 3200);
          else if (ev.text === 'fan3') toast(root, TEXT.fanMsgs.fan3, 3200);
          else if (ev.text === 'fallback_attack') {
            const u = getUnit(state, ev.unit);
            if (u) toast(root, TEXT.fanMsgs.fallback.replace('{name}', u.name));
          }
          await sleep(200 * D);
          break;
        }
        case 'buff_end': refreshAll(); break;
        case 'battle_end': break;
      }
      if (ev.t !== 'round' && ev.t !== 'battle_end') {
        const idx = buildActionQueueDoneIndex(ev);
        if (idx) done.push(idx);
      }
      // 速度变化(生风/变化/换阵/增益到期)后立即重排顺序条
      if (['buff', 'transform', 'form_end', 'formation', 'buff_end'].includes(ev.t)) renderOrderBar();
      // 教学提示:罗刹女体弱 → 提示变化
      if (!transformHinted && state.def.transformFinisher && ev.t === 'damage') {
        const fin = state.def.transformFinisher;
        const boss = state.units.find((x) => x.side === 'enemy' && x.defKey === fin.bossKey);
        if (boss && boss.alive && boss.hp / boss.maxHp <= fin.hpBelow) {
          transformHinted = true;
          toast(root, TEXT.tutorial.hintTransform, 4200);
        }
      }
    }
  }

  function buildActionQueueDoneIndex(ev) {
    // 行动完成的单位(用于顺序条勾销):在 turn 事件后该单位即视为已行动
    if (ev.t === 'turn') return ev.unit;
    return null;
  }

  // ---------- 主循环 ----------
  renderUnits();
  renderOrderBar();
  if (state.units.some((u) => u.id === 'p0' && u.buffs.some((b) => b.id === 'atk_down' && b.turns === 1))) {
    toast(root, '悟空中了反骗之计!首回合攻击-15%');
  }

  if (ctx.showTutorial) {
    await new Promise((resolve) => {
      showModal(root, {
        id: 'modal-tutorial',
        title: TEXT.tutorial.title,
        bodyNodes: TEXT.tutorial.lines.map((l) => el('p', 'tutorial-line', l)),
        buttons: [{ label: TEXT.tutorial.ok, id: 'btn-tutorial-ok', onClick: resolve }],
      });
    });
  }
  // 本场战斗的即时小卡片(假扇/真扇等)
  for (const key of ctx.onceCards ?? []) {
    const c = TEXT.onceCards[key];
    if (c) await onceCard(root, key, c.title, c.lines);
  }
  refreshFormationBtn();

  while (!state.over && state.round <= 60) {
    renderOrderBar();
    commandPhase = true;
    refreshFormationBtn();
    const commands = {};
    for (const u of aliveUnits(state, 'party')) {
      if (state.over) break;
      commands[u.id] = await collectCommandFor(u);
      renderOrderBar();
    }
    commandPhase = false;
    refreshFormationBtn();
    cmdMenu.innerHTML = '';
    clearStatus();
    const events = executeRound(state, commands);
    await playEvents(events);
    refreshAll();
  }

  // ---------- 结算 ----------
  if (state.winner === 'story') {
    // 剧情桥段:保留战斗画面作过场底景,由 main 在过场结束后移除
    return { winner: 'story', rounds: state.round - 1 };
  }
  if (sawFinisher) {
    await showDialog(root, TEXT.story.luoshaMid);
  }

  if (state.winner === 'party') {
    audio.sfx('victory');
    const ups = levelUpParty(partyLevelsOf(ctx, state));
    audio.sfx('levelup');
    await victoryPanel(ups);
    bRoot.remove();
    return { winner: 'party', levelUps: ups, rounds: state.round - 1, caught: state.caught };
  }
  if (state.winner === 'flee') {
    bRoot.remove();
    return { winner: 'flee', caught: state.caught };
  }
  // 败北
  audio.sfx('defeat');
  const retry = await new Promise((resolve) => {
    showModal(root, {
      id: 'modal-defeat',
      title: TEXT.ui.defeat,
      bodyNodes: [el('p', 'tutorial-line', '胜败乃兵家常事。调整阵型与指令,再战!')],
      buttons: [{ label: TEXT.ui.retry, id: 'btn-retry', onClick: () => resolve(true) }],
    });
  });
  bRoot.remove();
  return { winner: 'enemy', retry };

  function partyLevelsOf(c, st) {
    const map = {};
    for (const d of c.partyDefs) map[d.key] = d.level;
    return map;
  }

  function victoryPanel(ups) {
    return new Promise((resolve) => {
      const rows = [];
      for (const [key, up] of Object.entries(ups)) {
        const u = state.units.find((x) => x.side === 'party' && x.defKey === key);
        const nm = u ? u.name : key;
        const row = el('div', 'lv-row');
        row.append(el('span', 'lv-name', nm));
        row.append(el('span', 'lv-up', `Lv.${up.level - 1} → Lv.${up.level} ${TEXT.ui.levelUp}`));
        if (up.newSkills.length > 0) {
          row.append(el('span', 'lv-skill', `${TEXT.ui.newSkill}:${up.newSkills.map((s) => SKILLS[s].name).join('、')}`));
        }
        rows.push(row);
      }
      showModal(root, {
        id: 'modal-victory',
        title: TEXT.ui.victory,
        bodyNodes: rows,
        buttons: [{ label: TEXT.ui.continueBtn, id: 'btn-victory-ok', onClick: resolve }],
      });
    });
  }
}

