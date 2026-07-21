// 战斗界面:经典对阵(敌左上斜列、我右下斜列)、行动顺序条、指令菜单、飘字动画。
// 界面只渲染与收集指令,一切数值结算走 engine。

import { SKILLS, FORMS, FORMATIONS, ITEMS, BASIC_ATTACK } from './data.js';
import {
  createBattle, executeRound, buildActionQueue, aliveUnits, getUnit,
  effStat, unitSkills, levelUpParty, elementRelation, switchFormation,
  previewDamage, effectiveSkill,
} from './engine.js';
import { TEXT } from './text.js';
import { el, floatText, stampText, toast, showModal, showDialog, onceCard, iconBadge } from './ui.js';
import { unitURL, bgStyle } from './assets.js';
import { audio } from './audio.js';
import { FxLayer } from './fx.js';
import { getSpeed, setSpeed, getSkipFx, setSkipFx, getShake, setShake } from './settings.js';

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
  // 节奏开关(简报二.5):加速 ×2 与跳过演出均持久化;D 为动画时长系数,随开关即时生效
  let speed = getSpeed();
  let skipFx = getSkipFx();
  let shakeOn = getShake();
  let D = (fast ? 0.22 : 1) / speed;
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
  // 节奏开关组(加速/演出/震动,全部持久化)
  const toggles = el('div', 'battle-toggles');
  const speedBtn = el('button', 'btn toggle-btn');
  speedBtn.id = 'btn-speed';
  const skipBtn = el('button', 'btn toggle-btn');
  skipBtn.id = 'btn-skipfx';
  const shakeBtn = el('button', 'btn toggle-btn');
  shakeBtn.id = 'btn-shake';
  toggles.append(speedBtn, skipBtn, shakeBtn);
  field.append(orderBar, roundTag, banner, ring, formBtn, toggles);
  const bottom = el('div', 'battle-bottom');
  const cmdStatus = el('div', 'cmd-status');
  const cmdMenu = el('div', 'cmd-menu');
  cmdMenu.id = 'cmd-menu';
  cmdMenu.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) audio.sfx('click');
  });
  bottom.append(cmdStatus, cmdMenu);
  // 悬停/键盘聚焦时的预期效果预览(简报一.2):打谁、伤害区间、五行利弊
  const previewBox = el('div', 'cmd-preview');
  previewBox.id = 'cmd-preview';
  previewBox.style.display = 'none';
  bRoot.append(field, bottom, previewBox);
  root.appendChild(bRoot);

  // 演出层(粒子+背景色调突变)与节奏开关
  const fx = new FxLayer(field);
  fx.resize();
  function refreshToggles() {
    speedBtn.textContent = speed === 2 ? '加速×2' : '常速';
    speedBtn.classList.toggle('on', speed === 2);
    speedBtn.title = '战斗动画速度(持久化,二周目推荐 ×2)';
    skipBtn.textContent = skipFx ? '跳过演出' : '演出';
    skipBtn.classList.toggle('on', skipFx);
    skipBtn.title = '跳过标志性法术演出(持久化)';
    shakeBtn.textContent = shakeOn ? '震动' : '震关';
    shakeBtn.classList.toggle('on', shakeOn);
    shakeBtn.title = '命中屏幕震动(克制幅度,可关)';
  }
  speedBtn.addEventListener('click', () => {
    speed = speed === 2 ? 1 : 2;
    setSpeed(speed);
    D = (fast ? 0.22 : 1) / speed;
    refreshToggles();
    audio.sfx('click');
  });
  skipBtn.addEventListener('click', () => {
    skipFx = !skipFx;
    setSkipFx(skipFx);
    refreshToggles();
    audio.sfx('click');
  });
  shakeBtn.addEventListener('click', () => {
    shakeOn = !shakeOn;
    setShake(shakeOn);
    refreshToggles();
    audio.sfx('click');
  });
  refreshToggles();

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
    const capL = el('i', 'bar-cap l');
    const capR = el('i', 'bar-cap r');
    const ghost = el('div', 'bar-ghost');
    const fill = el('div', 'bar-fill');
    const text = el('div', 'bar-text');
    wrap.append(capL, capR, ghost, fill, text);
    return { wrap, ghost, fill, text, cur: undefined };
  }

  // 两段式血条(简报一.1):
  // 掉血——亮色层即时到位,暗红残层留在原处、0.4s 追上,看得见「刚才挨了多少」;
  // 回血——残层先到位,亮色层 0.3s 生长。
  function setBar(bar, frac) {
    frac = Math.max(0, Math.min(1, frac));
    const prev = bar.cur;
    if (prev === undefined) {
      bar.fill.style.transition = 'none';
      bar.ghost.style.transition = 'none';
      bar.fill.style.width = bar.ghost.style.width = `${frac * 100}%`;
      bar.cur = frac;
      return;
    }
    if (frac < prev - 0.001) {
      bar.fill.style.transition = 'none';
      bar.fill.style.width = `${frac * 100}%`;
      bar.ghost.style.transition = 'none';
      bar.ghost.style.width = `${prev * 100}%`;
      void bar.wrap.offsetWidth; // 立即应用亮层新宽度
      bar.ghost.style.transition = 'width 0.4s ease';
      bar.ghost.style.width = `${frac * 100}%`;
    } else if (frac > prev + 0.001) {
      bar.ghost.style.transition = 'none';
      bar.ghost.style.width = `${frac * 100}%`;
      bar.fill.style.transition = 'none';
      bar.fill.style.width = `${prev * 100}%`;
      void bar.wrap.offsetWidth;
      bar.fill.style.transition = 'width 0.3s ease';
      bar.fill.style.width = `${frac * 100}%`;
    }
    bar.cur = frac;
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
    setBar(uc.hpBar, u.hp / u.maxHp);
    uc.hpBar.text.textContent = `${u.hp}/${u.maxHp}`;
    uc.hpBar.wrap.classList.toggle('low', u.alive && u.hp / u.maxHp < 0.25);
    if (uc.mpBar) {
      setBar(uc.mpBar, u.mp / u.maxMp);
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

  // ---------- 行动顺序条(时间轴) ----------
  function renderOrderBar(highlightId = null, doneIds = []) {
    // FLIP:记录旧位置,重排后头像沿时间轴滑过去——加减速/减员带来的先后变化看得见(简报一.4)
    const old = new Map();
    orderChips.querySelectorAll('.order-chip').forEach((c) => {
      old.set(c.dataset.unitId, c.getBoundingClientRect().left);
    });
    orderChips.innerHTML = '';
    const q = buildActionQueue(state);
    for (const id of q) {
      const u = getUnit(state, id);
      const chip = el('div', 'order-chip');
      chip.dataset.unitId = id;
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
    for (const chip of orderChips.children) {
      const prevLeft = old.get(chip.dataset.unitId);
      if (prevLeft === undefined) continue;
      const dx = prevLeft - chip.getBoundingClientRect().left;
      if (Math.abs(dx) > 2) {
        chip.animate(
          [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
          { duration: 420 * D, easing: 'cubic-bezier(.2,.8,.25,1)' },
        );
      }
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

  // ---------- 预期效果预览(简报一.2:悬停实时显示打谁/伤害区间/五行利弊) ----------
  function relInfo(rel) {
    if (rel === 'ke') return { label: `${TEXT.battle.previewKe} · 有利`, cls: 'good' };
    if (rel === 'beike') return { label: `${TEXT.battle.previewBeike} · 不利`, cls: 'bad' };
    return { label: TEXT.battle.previewNone, cls: 'none' };
  }

  function showPreview(rows) {
    previewBox.innerHTML = '';
    for (const r of rows) {
      const line = el('div', 'pv-line');
      if (typeof r === 'string') {
        line.textContent = r;
      } else {
        line.append(el('span', 'pv-main', r.main));
        if (r.side) line.append(el('span', `pv-side ${r.cls ?? ''}`, r.side));
      }
      previewBox.appendChild(line);
    }
    previewBox.style.display = 'block';
    // 预览条与常驻五行环挤在同一条带上会叠字。预览本身就写明了「金→木 克! ×1.5」,
    // 比图例信息更全,所以预览在时让图例让位。
    document.body.classList.add('preview-on');
  }

  function hidePreview() {
    previewBox.style.display = 'none';
    document.body.classList.remove('preview-on');
  }

  // 对单目标的预览行:伤害区间 + 双方五行 + 利弊 + 命中
  function dmgPreviewOn(u, skill, target, label) {
    const pv = previewDamage(state, u, target, skill);
    const rel = relInfo(pv.rel);
    return [{
      main: `${label} → ${target.name} · 约 ${pv.min}~${pv.max}`,
      side: `${u.element}→${target.element} ${rel.label} · 命中${Math.round(pv.hit * 100)}%`,
      cls: rel.cls,
    }];
  }

  // 指令默认预览:单体取首个活敌,群体按全体活敌聚合区间
  function dmgPreviewRows(u, skill, label) {
    const foes = aliveUnits(state, 'enemy');
    if (foes.length === 0) return [`${label}:没有可攻击的目标`];
    if (skill.target === 'enemies') {
      let lo = Infinity, hi = 0, keN = 0, bkN = 0;
      for (const f of foes) {
        const pv = previewDamage(state, u, f, skill);
        lo = Math.min(lo, pv.min);
        hi = Math.max(hi, pv.max);
        if (pv.rel === 'ke') keN += 1;
        else if (pv.rel === 'beike') bkN += 1;
      }
      return [{
        main: `${label} → 敌方全体 ×${foes.length}`,
        side: `每敌约 ${lo}~${hi}${keN ? ` · 克 ${keN} 敌` : ''}${bkN ? ` · 被克 ${bkN} 敌` : ''}`,
        cls: keN ? 'good' : bkN ? 'bad' : 'none',
      }];
    }
    return dmgPreviewOn(u, skill, foes[0], label);
  }

  function skillPreviewRows(u, eff) {
    if (eff.mul > 0 && (eff.target === 'enemy' || eff.target === 'enemies')) return dmgPreviewRows(u, eff, eff.name);
    if (eff.heal) {
      const amount = Math.max(1, Math.round(effStat(state, u, 'mag') * eff.heal));
      return [{ main: `${eff.name} → 我方 · 约回复 ${amount}`, side: `MP ${eff.mp}`, cls: 'good' }];
    }
    return [`${eff.name}:${eff.desc || '辅助招式'} · MP ${eff.mp}`];
  }

  // 悬停与键盘聚焦共用同一预览(kbdhover 由键盘导航派发)
  function attachPreview(btn, rowsFn) {
    btn.addEventListener('mouseenter', () => showPreview(rowsFn()));
    btn.addEventListener('mouseleave', hidePreview);
    btn.addEventListener('kbdhover', () => showPreview(rowsFn()));
  }

  // ---------- 键盘导航(简报一.2:方向键+回车全流程,数字键 1-6 直选) ----------
  let kbd = null;      // 当前指令菜单导航 {all, enabled, idx, cols, escBtn}
  let picking = false; // 目标选择中,键盘由 pickTarget 独占

  function guessCols(items) {
    if (items.length < 2) return 1;
    const top = items[0].offsetTop;
    let c = 0;
    for (const it of items) {
      if (it.offsetTop !== top) break;
      c += 1;
    }
    return Math.max(1, c);
  }

  function bindKbd(container, { escBtn = null } = {}) {
    unbindKbd();
    const all = [...container.querySelectorAll('button')];
    const enabled = all.filter((b) => !b.classList.contains('disabled'));
    if (all.length === 0) return;
    kbd = { all, enabled, idx: 0, cols: guessCols(enabled), escBtn };
    if (enabled.length) focusKbd(0);
  }

  function unbindKbd() {
    if (kbd) for (const b of kbd.enabled) b.classList.remove('kbd-focus');
    kbd = null;
  }

  function focusKbd(i) {
    if (!kbd || kbd.enabled.length === 0) return;
    kbd.enabled[kbd.idx]?.classList.remove('kbd-focus');
    kbd.idx = ((i % kbd.enabled.length) + kbd.enabled.length) % kbd.enabled.length;
    const b = kbd.enabled[kbd.idx];
    b.classList.add('kbd-focus');
    b.dispatchEvent(new Event('kbdhover'));
  }

  function onGlobalKey(ev) {
    if (picking || !kbd) return;
    // 有模态/对话时,键盘交还给它们自己的处理
    if (document.querySelector('.modal-mask, .dlg-box')) return;
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      const d = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : k === 'ArrowUp' ? -kbd.cols : kbd.cols;
      focusKbd(kbd.idx + d);
      ev.preventDefault();
    } else if (k === 'Enter' || k === ' ') {
      const b = kbd.enabled[kbd.idx];
      if (b) {
        b.click();
        ev.preventDefault();
      }
    } else if (/^[1-9]$/.test(k)) {
      // 数字键直选:按按钮固定顺序(含禁用位),保证 1攻2法3防4道5特6自7逃 手感稳定
      const b = kbd.all[Number(k) - 1];
      if (b) {
        if (b.classList.contains('disabled')) toast(root, b.title || '不可用');
        else b.click();
        ev.preventDefault();
      }
    } else if (k === 'Escape' && kbd.escBtn) {
      kbd.escBtn.click();
      ev.preventDefault();
    }
  }
  window.addEventListener('keydown', onGlobalKey);

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

  function pickTarget(u, side, skill = BASIC_ATTACK, label = TEXT.commands.attack) {
    // side: 'enemy' | 'party';悬停目标显示五行预览,键盘方向键循环、回车确认、数字键直选、Esc 取消
    return new Promise((resolve) => {
      picking = true;
      const tipEl = cmdStatus.querySelector('.cmd-who-tip');
      if (tipEl) tipEl.textContent = TEXT.commands.targetPick;
      else cmdStatus.textContent = TEXT.commands.targetPick;
      const valid = aliveUnits(state, side);
      const cards = valid.map((t) => cardByUnit.get(t.id).card);
      const badges = new Map();
      for (const c of cards) c.classList.add('targetable');
      const showCardPreview = (card) => {
        const target = getUnit(state, card.dataset.unitId);
        if (skill.mul > 0) showPreview(dmgPreviewOn(u, skill, target, label));
        else if (skill.heal) {
          const amount = Math.max(1, Math.round(effStat(state, u, 'mag') * skill.heal));
          showPreview([{ main: `${label} → ${target.name} · 约回复 ${amount}`, cls: 'good' }]);
        } else {
          showPreview([`${label} → ${target.name}`]);
        }
      };
      let focusIdx = 0;
      const applyFocus = (i) => {
        focusIdx = ((i % cards.length) + cards.length) % cards.length;
        for (const c of cards) c.classList.remove('kbd-target');
        const card = cards[focusIdx];
        card.classList.add('kbd-target');
        showCardPreview(card);
      };
      applyFocus(0);
      const onOver = (ev) => {
        const card = ev.target.closest('.unit-card');
        if (!card || !cards.includes(card)) return;
        if (!badges.has(card)) {
          const target = getUnit(state, card.dataset.unitId);
          const rel = elementRelation(u.element, target.element);
          const b = el('div', `preview-badge ${rel === 'ke' ? 'good' : rel === 'beike' ? 'bad' : 'none'}`,
            rel === 'ke' ? TEXT.battle.previewKe : rel === 'beike' ? TEXT.battle.previewBeike : TEXT.battle.previewNone);
          card.appendChild(b);
          badges.set(card, b);
        }
        showCardPreview(card);
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
        const k = ev.key;
        if (k === 'Escape') { cleanup(); resolve(null); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { applyFocus(focusIdx - 1); ev.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'ArrowDown') { applyFocus(focusIdx + 1); ev.preventDefault(); }
        else if (k === 'Enter' || k === ' ') {
          const id = cards[focusIdx].dataset.unitId;
          cleanup(); resolve(id); ev.preventDefault();
        } else if (/^[1-9]$/.test(k)) {
          const n = Number(k) - 1;
          if (n < cards.length) {
            const id = cards[n].dataset.unitId;
            cleanup(); resolve(id); ev.preventDefault();
          } else return;
        } else return;
        ev.stopImmediatePropagation();
      };
      function cleanup() {
        picking = false;
        hidePreview();
        for (const c of cards) c.classList.remove('targetable', 'kbd-target');
        for (const b of badges.values()) b.remove();
        field.removeEventListener('click', onClick);
        field.removeEventListener('mouseover', onOver);
        field.removeEventListener('mouseout', onOut);
        window.removeEventListener('keydown', onKey, true);
      }
      field.addEventListener('click', onClick);
      field.addEventListener('mouseover', onOver);
      field.addEventListener('mouseout', onOut);
      window.addEventListener('keydown', onKey, true);
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
      attachPreview(bAtk, () => dmgPreviewRows(u, BASIC_ATTACK, TEXT.commands.attack));
      bAtk.onclick = async () => {
        const t = await pickTarget(u, 'enemy', BASIC_ATTACK, TEXT.commands.attack);
        resolve(t ? { type: 'attack', targetId: t } : null);
      };
      const bSkill = cmdButton(TEXT.commands.skill, 'skill');
      bSkill.title = TEXT.battle.skillTip;
      attachPreview(bSkill, () => [TEXT.battle.skillTip]);
      bSkill.onclick = () => skillMenu(u, resolve);
      const bDef = cmdButton(TEXT.commands.defend, 'defend');
      bDef.title = TEXT.battle.defendTip;
      attachPreview(bDef, () => [TEXT.battle.defendTip]);
      bDef.onclick = () => resolve({ type: 'defend' });
      const bItem = cmdButton(TEXT.commands.item, 'item');
      bItem.title = TEXT.battle.itemTip;
      attachPreview(bItem, () => [TEXT.battle.itemTip]);
      bItem.onclick = () => itemMenu(u, resolve);
      const bSp = cmdButton(TEXT.commands.special, 'special');
      bSp.title = TEXT.battle.specialTip;
      attachPreview(bSp, () => [TEXT.battle.specialTip]);
      if (!u.hasTransform) {
        bSp.classList.add('disabled');
        bSp.title = TEXT.battle.specialTip;
      } else {
        bSp.onclick = () => specialMenu(u, resolve);
      }
      const bAuto = cmdButton(TEXT.commands.auto, 'auto');
      bAuto.title = TEXT.battle.autoTip;
      attachPreview(bAuto, () => [TEXT.battle.autoTip]);
      bAuto.onclick = () => {
        const tipEl = cmdStatus.querySelector('.cmd-who-tip');
        if (tipEl) tipEl.textContent = '交给自动';
        resolve({ type: 'auto' });
      };
      const bFlee = cmdButton(TEXT.commands.flee, 'flee');
      bFlee.title = TEXT.battle.fleeTip;
      attachPreview(bFlee, () => [TEXT.battle.fleeTip]);
      bFlee.onclick = () => resolve({ type: 'flee' });

      wrap.append(bAtk, bSkill, bDef, bItem, bSp, bAuto, bFlee);
      cmdMenu.appendChild(wrap);
      bindKbd(wrap);
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
      const eff = effectiveSkill(u, k, s); // 预览与结算同走熟练强化(简报验收:预览=结算)
      const item = el('button', 'btn cmd-item');
      item.dataset.skill = k;
      const nm = el('span', 'cmd-item-name');
      nm.append(iconBadge(s.kind === 'mag' ? '法' : '物', { sm: true }), document.createTextNode(' ' + s.name));
      const meta = el('span', 'cmd-item-meta', `${targetLabel[s.target] ?? ''}${s.kind === 'mag' ? '法术' : '物理'}·${u.element} · MP${eff.mp}`);
      item.append(nm, meta);
      if (s.desc) item.title = s.desc;
      attachPreview(item, () => skillPreviewRows(u, eff));
      if (eff.mp > u.mp) {
        item.classList.add('disabled');
        item.title = TEXT.ui.noMp;
      } else {
        item.onclick = async () => {
          if (s.target === 'enemy') {
            const t = await pickTarget(u, 'enemy', eff, s.name);
            resolve(t ? { type: 'skill', skillId: k, targetId: t } : null);
          } else if (s.target === 'ally') {
            const t = await pickTarget(u, 'party', eff, s.name);
            resolve(t ? { type: 'skill', skillId: k, targetId: t } : null);
          } else {
            resolve({ type: 'skill', skillId: k });
          }
        };
      }
      wrap.appendChild(item);
    }
    const back = backButton(resolve);
    wrap.appendChild(back);
    cmdMenu.appendChild(wrap);
    bindKbd(wrap, { escBtn: back });
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
      attachPreview(item, () => [`${it.name}:${it.desc}`]);
      item.onclick = async () => {
        if (it.target === 'ally') {
          const t = await pickTarget(u, 'party', { mul: 0 }, it.name);
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else if (it.target === 'enemy') {
          const t = await pickTarget(u, 'enemy', { mul: 0 }, it.name);
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else {
          resolve({ type: 'item', itemId: k });
        }
      };
      wrap.appendChild(item);
    }
    const back = backButton(resolve);
    wrap.appendChild(back);
    cmdMenu.appendChild(wrap);
    bindKbd(wrap, { escBtn: back });
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
      attachPreview(item, () => [`${f.name}:${f.desc}${hint}`]);
      if (countered.length > 0) item.classList.add('counter');
      item.onclick = () => resolve({ type: 'transform', formId: fk });
      wrap.appendChild(item);
    }
    const back = backButton(resolve);
    wrap.appendChild(back);
    cmdMenu.appendChild(wrap);
    bindKbd(wrap, { escBtn: back });
  }

  // ---------- 事件动画 ----------
  function cardOf(id) { return cardByUnit.get(id); }

  // 标志性法术 → 演出种类(简报二.4):火/水/金身各有专属粒子+色调,不再共用通用特效。
  // 只给标志性技能(玩家绝技与 BOSS 大招);小怪的寻常火弹走通用音效,避免场场连播演出拖节奏。
  const skillKeyByName = Object.fromEntries(Object.entries(SKILLS).map(([k, s]) => [s.name, k]));
  const SPELL_FX = {
    lieyan_quan: 'fire', huolian: 'fire', fenye: 'fire', chiyan: 'fire',
    sihuo: 'fire',
    pishuijue: 'water', xuanbing_ji: 'water', jinglang: 'water', bingfeng: 'water',
    luohanjinshen: 'gold', hufa: 'gold', gangtie: 'gold', huoyan: 'gold',
    douzhan: 'gold', jinjing: 'gold', guiyuan: 'water',
  };

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

  function shake(id, hard = false) {
    const uc = cardOf(id);
    if (!uc) return;
    uc.card.classList.remove('shake', 'shake-hard');
    void uc.card.offsetWidth;
    uc.card.classList.add(hard ? 'shake-hard' : 'shake');
  }

  function flashHit(id) {
    const uc = cardOf(id);
    if (!uc) return;
    uc.img.classList.remove('hit-flash');
    void uc.img.offsetWidth;
    uc.img.classList.add('hit-flash');
    setTimeout(() => uc.img.classList.remove('hit-flash'), 380);
  }

  // 屏幕震动:克制幅度(2px),暴击/克制命中更重(4px);可关(简报二.1)
  function quake(heavy = false) {
    if (!shakeOn) return;
    field.classList.remove('quake', 'quake-hi');
    void field.offsetWidth;
    field.classList.add(heavy ? 'quake-hi' : 'quake');
    setTimeout(() => field.classList.remove('quake', 'quake-hi'), 500);
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
          const uc = u ? cardOf(ev.actor) : null;
          if (uc) floatText(uc.anchor, ev.name, 'info');
          if (ev.skill) {
            const fxKind = SPELL_FX[skillKeyByName[ev.name]];
            if (fxKind && uc) {
              // 标志性法术演出:粒子 + 背景色调突变 + 音效(跳过演出时缩为一道色闪)
              audio.sfx(fxKind === 'fire' ? 'firefx' : fxKind === 'water' ? 'waterfx' : 'skill');
              await fx.play(fxKind, uc.card, { D, skipFx });
            } else {
              audio.sfx('skill');
              await sleep(160 * D);
            }
          } else {
            await sleep(160 * D);
          }
          break;
        }
        case 'damage': {
          lunge(ev.actor, ev.target);
          await sleep(120 * D);
          const uc = cardOf(ev.target);
          if (uc) {
            const slot = nextSlot(ev.target);
            const hard = !!(ev.crit || ev.rel === 'ke'); // 暴击/克制命中明显更重(简报二.1)
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
              // 五行教学:克制命中时在目标身上盖「金克木」三字印(简报二.3)
              if (ev.rel === 'ke') {
                const atkU = getUnit(state, ev.actor);
                const defU = getUnit(state, ev.target);
                if (atkU && defU) stampText(uc.anchor, `${atkU.element}克${defU.element}`, 'wuxing-stamp');
              }
              if (ev.rel === 'beike') floatText(uc.anchor, TEXT.float.beike, 'beike-label', slot + 1);
            }
            shake(ev.target, hard);
            flashHit(ev.target);
            quake(ev.crit || ev.rel === 'ke'); // 普通命中 2px,暴击/克制 4px
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
          // 定风丹护体:免疫减速时给出可辨识演出(简报二.4)
          if (ev.buff === 'spd_down') {
            const tu = getUnit(state, ev.target);
            if (tu?.immuneSpdDown && uc) {
              floatText(uc.anchor, TEXT.battle.dingfeng, 'ke');
              audio.sfx('ke');
              await fx.play('ward', uc.card, { D, skipFx });
            }
          }
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
          quake(true);
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
            shake(ev.target, true);
            flashHit(ev.target);
          }
          quake(true);
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
          // 罗刹女祭真扇:悟空被吹飞(演出)——满场风痕,阴风骤起
          audio.sfx('fan2');
          const bossUc = ev.actor ? cardOf(ev.actor) : null;
          if (bossUc) {
            bossUc.card.classList.add('flash');
            setTimeout(() => bossUc.card.classList.remove('flash'), 500 * D);
          }
          await showBanner('芭蕉扇——!', 'fan-banner');
          const fxP = fx.play('wind', null, { D, skipFx });
          const wk = cardOf('p0');
          if (wk) {
            wk.card.classList.add('blown');
            floatText(wk.anchor, '吹飞五万里!', 'heavy');
          }
          quake(true);
          await fxP;
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
            shake(ev.target, true);
            flashHit(ev.target);
          }
          quake(true);
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
          if (ev.item === 'truefan' && ev.stage) {
            // 真扇三段专属演出:一息火(灰烬)/二生风(风痕)/三落雨(甘霖),各不相同
            audio.sfx(`fan${ev.stage}`);
            await showBanner(it.name, 'fan-banner');
            await fx.play(`fan${ev.stage}`, null, { D, skipFx });
          } else if (ev.item === 'fakefan') {
            audio.sfx('thud');
            await showBanner(it.name, 'fan-banner');
            await fx.play('backfire', null, { D, skipFx });
          } else {
            await showBanner(it.name, ev.item?.includes('fan') ? 'fan-banner' : '');
          }
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
  // 开场一瞬的地域色调(简报三.1 递进):翠云青绿/火焰朱红/摩云紫/积雷灰紫,三次借扇场景各自不同
  const PLACE_TINT = {
    cuiyun: 'linear-gradient(180deg, rgba(60,120,90,0.22), rgba(16,40,30,0.26))',
    huoyan: 'linear-gradient(180deg, rgba(220,80,30,0.24), rgba(120,20,8,0.28))',
    moyundong: 'linear-gradient(180deg, rgba(120,80,140,0.22), rgba(40,24,50,0.26))',
    leiji: 'linear-gradient(180deg, rgba(110,90,140,0.22), rgba(36,28,48,0.26))',
  };
  if (PLACE_TINT[state.def.bg]) fx.tint(PLACE_TINT[state.def.bg], 1100 * D);
  if (state.units.some((u) => u.id === 'p0' && u.buffs.some((b) => b.id === 'atk_down' && b.turns === 1))) {
    toast(root, '悟空中了反骗之计!首回合攻击-15%');
  }

  try {
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
      unbindKbd(); // 指令阶段结束,菜单清空前先撤掉键盘导航
      cmdMenu.innerHTML = '';
      clearStatus();
      hidePreview();
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
  } finally {
    window.removeEventListener('keydown', onGlobalKey);
    unbindKbd();
    hidePreview();
    fx.dispose();
  }

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

