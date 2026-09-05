// 战斗界面:经典对阵(敌左上斜列、我右下斜列)、行动顺序条、指令菜单、飘字动画。
// 界面只渲染与收集指令,一切数值结算走 engine。

import { SKILLS, FORMATIONS, GROWTH } from './data.js';
import {
  createBattle, executeRound, buildActionQueue, aliveUnits, getUnit,
  effStat, levelUpParty, switchFormation,
} from './engine.js';
import { TEXT } from './text.js';
import { el, toast, showModal, showDialog, onceCard } from './ui.js';
import { unitURL, bgStyle } from './assets.js';
import { audio } from './audio.js';
import { FxLayer } from './fx.js';
import { createBattleAnimator } from './battle_animator.js';
import { createBattleCommands } from './battle_commands.js';
import { getSpeed, setSpeed, getSkipFx, setSkipFx, getShake, setShake } from './settings.js';

export async function runBattleScreen(ctx) {
  // ctx: {root, battleId, partyLevels, petJoined, formation, items, seed, fast, showTutorial, systemControlsHost}
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
  let jumpedIds = [];

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
  // 五行相克环(常驻指令台右格)
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
  // 节奏开关收进顶栏「设」齿轮下拉(简报 T7):不再挂在舞台右上角每张截图里
  const sysDrop = ctx.systemControlsHost;
  const sceneHeading = el('div', 'battle-scene-heading');
  sceneHeading.append(el('span', 'scene-heading-kicker', '三借芭蕉扇 · 西行战记'), el('h2', '', state.def.name));
  field.append(sceneHeading, orderBar, roundTag, banner, formBtn);
  if (sysDrop) sysDrop.appendChild(toggles);
  else field.appendChild(toggles); // 无顶栏的独立挂载场景兜底
  // 战场态势常驻条(地火炙烤/妖将结阵等,数据驱动):名字+一句话效果,开场起挂在回合签下
  const fieldRule = state.def.fieldRule ?? null;
  let ruleChip = null;
  if (fieldRule) {
    ruleChip = el('div', 'field-rule');
    ruleChip.id = 'field-rule';
    ruleChip.title = fieldRule.desc;
    field.appendChild(ruleChip);
  }
  function refreshRuleChip() {
    if (!ruleChip) return;
    if (fieldRule.kind === 'pairGuard') {
      const n = aliveUnits(state, 'enemy').filter((u) => u.defKey === fieldRule.unitKey).length;
      const active = n >= (fieldRule.count ?? 2);
      ruleChip.classList.toggle('broken', !active);
      ruleChip.textContent = active ? `${fieldRule.name}:${fieldRule.short}` : `${fieldRule.name}:已破`;
    } else {
      ruleChip.textContent = `${fieldRule.name}:${fieldRule.short}`;
    }
  }
  const bottom = el('div', 'battle-bottom');
  const cmdStatus = el('div', 'cmd-status');
  const cmdMenu = el('div', 'cmd-menu');
  cmdMenu.id = 'cmd-menu';
  cmdMenu.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) audio.sfx('click');
  });
  // 五行相克环常驻指令台右侧(简报 T8):不再占舞台左下角,预览条也不再压它
  bottom.append(cmdStatus, cmdMenu, ring);
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
  const commandUi = createBattleCommands({
    root,
    state,
    field,
    cmdStatus,
    cmdMenu,
    previewBox,
    cardByUnit,
  });
  const animator = createBattleAnimator({
    root,
    state,
    field,
    banner,
    fx,
    cardByUnit,
    duration: () => D,
    skipEffects: () => skipFx,
    shakeEnabled: () => shakeOn,
    refreshAll,
    renderOrderBar,
    renderUnits,
    pushLog: commandUi.pushLog,
    setJumpedIds: (ids) => { jumpedIds = ids; },
  });

  // ---------- 站位(bottom 锚定 + 每场一条地平线) ----------
  // 地平线常量:卡底边在战场高度的百分比(自顶),按背景画里实际可站的地面读。
  // 立绘经 object-position 底对齐后,脚线 = 卡底边 − 79px(名牌+血条+状态签栈高),
  // 因此卡永远从地平线往下长,第四个单位不会再被场地下缘裁掉。
  const HORIZON = { cuiyun: 98, huoyan: 98, moyundong: 98, leiji: 98 };
  // 敌我各占一条斜列车道,同一套规则(简报 T11):
  // 敌左 3→42%、我右 56→83%;每档卡底只差 4.5%,纵深用 zoom(远小近大)表达。
  // 敌方步进 13% ≥ 缩放后卡宽(168px×0.99≈1280 宽下的 13%),名牌/血条/状态签
  // 不再越界压到相邻单位(此前 7% 步进,玉面公主与妖将的名牌签叠成一团)。
  function laneLayout(list, side) {
    if (window.matchMedia('(max-width: 700px)').matches) {
      const slot = 92 / Math.max(1, list.length);
      return list.map((u, i) => ({
        left: 3 + i * slot + Math.max(0, (slot - (u.big ? 27 : 21)) / 2),
        bottom: side === 'enemy' ? 34 - (i % 2) * 2 : (i % 2) * 2,
        zoom: u.big ? 0.92 : 1,
      }));
    }
    const frontT = HORIZON[state.def.bg] ?? 98;
    const startX = side === 'enemy' ? 3 : 54;
    const stepX = side === 'enemy' ? 14 : 10.5;
    const n = list.length;
    let extra = 0; // 大体积单位(白牛真身)之后的车道右让,避免盖住邻位
    return list.map((u, i) => {
      const pos = {
        left: startX + i * stepX + extra,
        bottom: 100 - (frontT - (n - 1 - i) * (side === 'enemy' ? 2.5 : 4.5)),
        zoom: side === 'enemy' ? Math.min(0.99, 0.84 + i * 0.05) : Math.min(1.03, 0.88 + i * 0.05),
      };
      if (u.big) extra += 12;
      return pos;
    });
  }

  // ---------- 单位卡片 ----------
  function unitCard(u, pos) {
    const card = el('div', `unit-card ${u.side}`);
    card.dataset.unitId = u.id;
    card.dataset.portrait = u.portrait;
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
    // 卡底锚定:bottom 定死脚线高度,zoom 表达纵深(不碰 transform,让位/抖动动画不受影响)
    card.style.left = `${pos.left}%`;
    card.style.bottom = `${pos.bottom}%`;
    card.style.zoom = String(pos.zoom);
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
    const ePos = laneLayout(enemies, 'enemy');
    const pPos = laneLayout(party, 'party');
    for (const [i, u] of enemies.entries()) {
      const uc = unitCard(u, ePos[i]);
      field.appendChild(uc.card);
      cardByUnit.set(u.id, uc);
    }
    for (const [i, u] of party.entries()) {
      const uc = unitCard(u, pPos[i]);
      field.appendChild(uc.card);
      cardByUnit.set(u.id, uc);
    }
    refreshAll();
  }

  function refreshUnit(u) {
    const uc = cardByUnit.get(u.id);
    if (!uc) return;
    uc.card.dataset.portrait = u.portrait;
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
    // 同 id 增益合并显示(白牛狂暴每回合叠一层,不合并会刷出十几个小芯片)
    const merged = new Map(); // id -> {count, turns}
    for (const b of u.buffs) {
      const m = merged.get(b.id);
      if (m) { m.count += 1; m.turns = Math.max(m.turns, b.turns); }
      else merged.set(b.id, { count: 1, turns: b.turns });
    }
    for (const [id, m] of merged) {
      const label = id === 'enrage'
        ? `${TEXT.buffNames.enrage}×${m.count}`
        : m.count > 1
          ? `${TEXT.buffNames[id] ?? id}×${m.count}`
          : `${TEXT.buffNames[id] ?? id}${m.turns}`;
      const chip = el('span', 'buff-chip', label);
      chip.dataset.buff = id;
      uc.chips.appendChild(chip);
    }
    if (u.defending) uc.chips.appendChild(el('span', 'buff-chip', TEXT.float.defend));
    if (u.form) uc.card.classList.add('transformed'); else uc.card.classList.remove('transformed');
  }

  function refreshAll() {
    for (const u of state.units) refreshUnit(u);
    roundTag.textContent = TEXT.ui.round.replace('{n}', state.round);
    refreshRuleChip();
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
    refreshFormationBtn();
    refreshQueueMarks();
    await animator.showBanner(`${TEXT.commands.formation} · ${other.name}`);
    refreshAll();
  });

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
  // 战场态势开场明牌:规则全文(含对双方的诚实表述)先亮一次,常驻条随后一直在场
  if (fieldRule) toast(root, fieldRule.desc, 4600);

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
      animator.clearFloats(); // 新回合开始前,上一回合的飘字一律不留(简报 T9)
      renderOrderBar();
      commandPhase = true;
      commandUi.beginRound();
      refreshFormationBtn();
      const roundCommands = {};
      // 按本回合真实行动序收集我方指令。这样多人同回合使用真扇时，界面显示的
      // 「下一扇」就与实际结算顺序一致，不会被固定队伍编号误导。
      const partyCommandOrder = buildActionQueue(state)
        .map((id) => getUnit(state, id))
        .filter((u) => u?.side === 'party');
      for (const u of partyCommandOrder) {
        if (state.over) break;
        roundCommands[u.id] = await commandUi.collectCommandFor(u);
        renderOrderBar();
      }
      commandPhase = false;
      refreshFormationBtn();
      commandUi.unbindKeyboard(); // 指令阶段结束,菜单清空前先撤掉键盘导航
      commandUi.showIdleBottom(); // 结算期间底栏改展示战况卷轴,不再是空白板
      commandUi.hidePreview();
      const events = executeRound(state, roundCommands);
      await animator.playEvents(events);
      refreshAll();
    }

    // ---------- 结算 ----------
    root.querySelectorAll('.toast').forEach((n) => n.remove()); // 清掉战斗中的提示,别压在结算面板上
    animator.clearFloats(); // 结算帧同样不留飘字残影(简报 T9)
    if (state.winner === 'story') {
      // 剧情桥段:保留战斗画面作过场底景,由 main 在过场结束后移除
      return { winner: 'story', rounds: state.round - 1, levelUps: levelUpParty(partyLevelsOf(ctx, state)) };
    }
    if (animator.hadFinisher()) {
      await showDialog(root, TEXT.story.luoshaMid);
    }

    if (state.winner === 'party') {
      audio.sfx('victory');
      const ups = ctx.rewardLevel === false ? {} : levelUpParty(partyLevelsOf(ctx, state));
      if (ctx.rewardLevel !== false) audio.sfx('levelup');
      await victoryPanel(ups, ctx.rewardLevel === false);
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
    commandUi.dispose();
    toggles.remove(); // 开关是挂在顶栏「设」下拉里的,随战斗结束一并撤下
    fx.dispose();
  }

  function partyLevelsOf(c, st) {
    const map = {};
    for (const d of c.partyDefs) map[d.key] = d.level;
    return map;
  }

  function victoryPanel(ups, finalBattle = false) {
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
      if (finalBattle) {
        rows.push(el('p', 'lv-growth-note final', '平天大圣已伏。真扇在手,该去熄灭八百里火焰。'));
      } else {
        rows.push(el('p', 'lv-growth-note', `每位参战伙伴另得 ${GROWTH.pointsPerLevel} 点潜力与 ${GROWTH.skillPointsPerLevel} 点修炼。顶栏【角色】已留下朱印。`));
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
