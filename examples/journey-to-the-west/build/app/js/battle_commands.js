// 战斗指令控制器：负责预览、目标选择与键盘导航，不执行回合结算。

import { SKILLS, FORMS, ITEMS, BASIC_ATTACK, STUNTS, SP } from './data.js';
import {
  aliveUnits,
  effStat,
  effectiveSkill,
  elementRelation,
  getUnit,
  previewDamage,
  unitSkills,
} from './engine.js';
import { TEXT } from './text.js';
import { el, iconBadge, onceCard, toast } from './ui.js';
import { unitURL, hasUnitImage, itemIcon } from './assets.js';

export function createBattleCommands({
  root,
  state,
  field,
  cmdStatus,
  cmdMenu,
  previewBox,
  cardByUnit,
}) {
  // ---------- 指令菜单 ----------
  const CMD_ICONS = { attack: '攻', skill: '法', defend: '防', item: '道', special: '技', auto: '自', flee: '逃', repeat: '续', protect: '护', autoAll: '挂', back: '返' };
  const lastCommands = new Map();
  // 挂机：非 BOSS、非剧情退出的寻常战斗里，一键让全队(含召唤兽)此后每回合自行应战
  const canAutoAll = !state.def.boss && !state.def.storyExit;
  let autoAll = false;
  const autoChip = el('button', 'btn auto-all-chip', TEXT.battle.autoAllChip);
  autoChip.id = 'btn-auto-takeover';
  autoChip.hidden = true;
  autoChip.addEventListener('click', () => setAutoAll(false));
  field.appendChild(autoChip);
  function setAutoAll(on) {
    autoAll = on && canAutoAll;
    autoChip.hidden = !autoAll;
  }
  let plannedFanUses = 0;
  const fanStageNames = ['息火', '生风', '落雨'];

  function beginRound() {
    plannedFanUses = 0;
  }

  function repeatableCommand(u) {
    const cmd = lastCommands.get(u.id);
    if (!cmd) return null;
    if (cmd.type === 'defend' || cmd.type === 'auto') return { ...cmd };
    // 上回合的目标倒了：改打离得最近(序位最靠前)的活敌;实在不行就普通攻击
    const nearestFoe = () => aliveUnits(state, 'enemy')[0] ?? null;
    if (cmd.type === 'attack') {
      const target = getUnit(state, cmd.targetId);
      if (target?.alive && target.side === 'enemy') return { ...cmd };
      const f = nearestFoe();
      return f ? { type: 'attack', targetId: f.id } : null;
    }
    if (cmd.type === 'protect') {
      const target = getUnit(state, cmd.targetId);
      return target?.alive ? { ...cmd } : null;
    }
    if (cmd.type === 'skill') {
      const skill = unitSkills(u).includes(cmd.skillId) ? effectiveSkill(u, cmd.skillId, SKILLS[cmd.skillId]) : null;
      const f = nearestFoe();
      if (!skill || skill.mp > u.mp) return f ? { type: 'attack', targetId: f.id } : null;
      if (cmd.targetId) {
        const target = getUnit(state, cmd.targetId);
        if (!target?.alive) {
          if (skill.target !== 'enemy') return null;
          return f ? { ...cmd, targetId: f.id } : null;
        }
      }
      return { ...cmd };
    }
    return null;
  }

  function commandSummary(cmd) {
    if (!cmd) return '上一回合没有可沿用的指令';
    if (cmd.type === 'attack') return `沿用：攻击 ${getUnit(state, cmd.targetId)?.name ?? ''}`;
    if (cmd.type === 'skill') return `沿用：${SKILLS[cmd.skillId]?.name ?? TEXT.commands.skill}${cmd.targetId ? ` → ${getUnit(state, cmd.targetId)?.name ?? ''}` : ''}`;
    if (cmd.type === 'protect') return `沿用：保护 ${getUnit(state, cmd.targetId)?.name ?? ''}`;
    if (cmd.type === 'defend') return '沿用：防御';
    if (cmd.type === 'auto') return '沿用：自动';
    return TEXT.battle.repeatTip;
  }

  function cmdButton(label, cmd, sub) {
    const b = el('button', 'btn cmd-btn');
    b.dataset.cmd = cmd;
    if (sub) b.dataset.sub = sub;
    b.append(iconBadge(CMD_ICONS[cmd] ?? label[0]), el('span', '', label));
    return b;
  }

  // ---------- 预期效果预览(简报一.2：悬停实时显示打谁/伤害区间/五行利弊) ----------
  function relInfo(rel) {
    if (rel === 'ke') return { label: `${TEXT.battle.previewKe} · 有利`, cls: 'good' };
    if (rel === 'beike') return { label: `${TEXT.battle.previewBeike} · 不利`, cls: 'bad' };
    return { label: TEXT.battle.previewNone, cls: 'none' };
  }

  function showPreview(rows) {
    if (!rows || rows.length === 0) { hidePreview(); return; } // 无实据时报空，不挂静态说明(简报 T10)
    previewBox.innerHTML = '';
    for (const r of rows) {
      const line = el('div', 'pv-line');
      if (typeof r === 'string') {
        line.textContent = r;
      } else {
        line.append(el('span', 'pv-main', r.main));
        // 每段各自不折行(「约 247~303」不会被拆成两行)
        if (r.side) {
          const side = el('span', `pv-side ${r.cls ?? ''}`);
          for (const seg of r.side.split(' · ')) side.append(el('span', 'pv-seg', seg));
          line.append(side);
        }
      }
      previewBox.appendChild(line);
    }
    previewBox.style.display = 'block';
  }

  function hidePreview() {
    previewBox.style.display = 'none';
  }

  // 对单目标的预览行：伤害区间 + 双方五行 + 利弊 + 命中
  function dmgPreviewOn(u, skill, target, label) {
    const pv = previewDamage(state, u, target, skill);
    const rel = relInfo(pv.rel);
    return [{
      main: `${label} → ${target.name} · 约 ${pv.min}~${pv.max}`,
      side: `${u.element}→${target.element} ${rel.label} · 命中 ${Math.round(pv.hit * 100)}%`,
      cls: rel.cls,
    }];
  }

  // 指令默认预览：单体取首个活敌，群体按全体活敌聚合区间
  function dmgPreviewRows(u, skill, label) {
    const foes = aliveUnits(state, 'enemy');
    if (foes.length === 0) return [`${label}：没有可攻击的目标`];
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
    // 单体技的默认预览取首个活敌。这是「悬停预览」而非已确认的出手，必须标明:
    // 独立 QA 的干净上下文裁决在此处卡住——预览已给出具体敌人与完整数值,
    // 玩家无法区分它是悬停提示还是这一击已经落定。
    const rows = dmgPreviewOn(u, skill, foes[0], label);
    if (foes.length > 1) rows[0].side = `${rows[0].side} · 以${foes[0].name}为例，出手时再选`;
    return rows;
  }

  function skillPreviewRows(u, eff) {
    if (eff.mul > 0 && (eff.target === 'enemy' || eff.target === 'enemies')) return dmgPreviewRows(u, eff, eff.name);
    if (eff.heal) {
      const amount = Math.max(1, Math.round(effStat(state, u, 'mag') * eff.heal));
      return [{ main: `${eff.name} → 我方 · 约回复 ${amount}`, side: `耗法力 ${eff.mp}`, cls: 'good' }];
    }
    return [`${eff.name}：${eff.desc || '辅助招式'} · 耗法力 ${eff.mp}`];
  }

  // 悬停与键盘聚焦共用同一预览(kbdhover 由键盘导航派发)
  function attachPreview(btn, rowsFn) {
    btn.addEventListener('mouseenter', () => showPreview(rowsFn()));
    btn.addEventListener('mouseleave', hidePreview);
    btn.addEventListener('kbdhover', () => showPreview(rowsFn()));
  }

  // ---------- 键盘导航(简报一.2：方向键+回车全流程，数字键 1-6 直选) ----------
  let kbd = null;      // 当前指令菜单导航 {all, enabled, idx, cols, escBtn}
  let picking = false; // 目标选择中，键盘由 pickTarget 独占

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
    if (ev.repeat) return; // 按住回车不连发指令
    // 有模态/对话时，键盘交还给它们自己的处理
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
      // 数字键直选：按按钮固定顺序(含禁用位)，保证 1攻2法3防4道5特6自7逃 手感稳定
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

  // 左侧小卷轴牌：当前单位头像(变化中换形态立绘)+名字+五行徽记+提示
  function portraitOf(u, formId = u.form?.id ?? null) {
    return formId && hasUnitImage(`form_${formId}`) ? unitURL(`form_${formId}`) : unitURL(u.portrait, u.name);
  }
  function setStatusFor(u, tipText = '选择指令', view = null) {
    cmdStatus.innerHTML = '';
    const avatar = el('img', 'cmd-avatar');
    const formId = view ? view.form : (u.form?.id ?? null);
    avatar.src = portraitOf(u, formId);
    avatar.alt = u.name;
    avatar.classList.toggle('enemy', u.side === 'enemy');
    const who = el('div', 'cmd-who');
    const nameRow = el('div', 'cmd-who-name');
    nameRow.append(iconBadge(view?.element ?? u.element, { round: true, sm: true }), el('span', '', u.name));
    const tip = el('div', 'cmd-who-tip', tipText);
    who.append(nameRow, tip);
    cmdStatus.append(avatar, who);
  }

  // 结算中：左格跟着「正在出手的人」走
  function showActing(u, view) {
    setStatusFor(u, u.side === 'party' ? '出手' : '敌方出手', view);
  }

  function clearStatus() {
    cmdStatus.innerHTML = '';
    const who = el('div', 'cmd-who');
    who.append(el('div', 'cmd-who-name', '战况'));
    who.append(el('div', 'cmd-who-tip', '号令已下，观战'));
    cmdStatus.append(who);
  }

  // ---------- 战况卷轴(简报 T8) ----------
  // 结算/对话时段，底部指令台不再是一块带「……」的空白板:
  // 右格以宣纸木刻排字列出最近 3 条战报。
  const battleLog = []; // 新条目在前 {text, cls}
  let logLines = null;   // 结算期间挂在底栏的战况行;新战报到来即重绘
  function renderLog() {
    if (!logLines?.isConnected) return;
    logLines.innerHTML = '';
    if (battleLog.length === 0) logLines.append(el('div', 'battle-report-line', '两军对峙，各听号令。'));
    battleLog.slice(0, 4).forEach((l, i) => {
      logLines.append(el('div', `battle-report-line ${l.cls}${i === 0 ? ' fresh' : ''}`.trim(), l.text));
    });
  }
  function pushLog(text, cls = '') {
    battleLog.unshift({ text, cls });
    if (battleLog.length > 12) battleLog.pop();
    renderLog();
  }
  function showIdleBottom() {
    cmdMenu.innerHTML = '';
    clearStatus();
    const sc = el('div', 'battle-report');
    sc.append(el('div', 'battle-report-title', '战况'));
    logLines = el('div', 'battle-report-lines');
    sc.append(logLines);
    cmdMenu.appendChild(sc);
    renderLog();
  }

  // 选目标是模态的：同一时刻只有一个选择器;新菜单/新选择器先撤掉旧的
  let activePick = null;
  function cancelPick() { activePick?.(); }

  function pickTarget(u, side, skill = BASIC_ATTACK, label = TEXT.commands.attack, { dead = false, exclude = null } = {}) {
    // side: 'enemy' | 'party';悬停目标显示五行预览，键盘方向键循环、回车确认、数字键直选、Esc/右键 取消
    cancelPick();
    return new Promise((resolve) => {
      const valid = state.units.filter((t) => t.side === side && (dead ? !t.alive : t.alive) && t.id !== exclude && cardByUnit.get(t.id));
      if (valid.length === 0) { toast(root, dead ? '没有倒下的伙伴。' : '没有可选的目标。'); resolve(null); return; }
      picking = true;
      const tipEl = cmdStatus.querySelector('.cmd-who-tip');
      if (tipEl) tipEl.textContent = TEXT.commands.targetPick;
      else cmdStatus.textContent = TEXT.commands.targetPick;
      const cards = valid.map((t) => cardByUnit.get(t.id).card);
      // 选择期间菜单不可点;只留一枚「取消」
      const grid = cmdMenu.querySelector('.cmd-grid, .cmd-list');
      grid?.classList.add('picking');
      const cancelChip = el('button', 'btn cmd-cancel-chip', '取消选择（右键）');
      cancelChip.addEventListener('click', () => { cleanup(); resolve(null); });
      cmdMenu.appendChild(cancelChip);
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
      const onContext = (ev) => { ev.preventDefault(); cleanup(); resolve(null); };
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
        if (activePick === cancelThis) activePick = null;
        picking = false;
        hidePreview();
        for (const c of cards) c.classList.remove('targetable', 'kbd-target', 'revivable');
        for (const b of badges.values()) b.remove();
        grid?.classList.remove('picking');
        cancelChip.remove();
        field.removeEventListener('click', onClick);
        field.removeEventListener('mouseover', onOver);
        field.removeEventListener('mouseout', onOut);
        field.removeEventListener('contextmenu', onContext);
        window.removeEventListener('keydown', onKey, true);
      }
      function cancelThis() { cleanup(); resolve(null); }
      activePick = cancelThis;
      if (dead) for (const c of cards) c.classList.add('revivable');
      field.addEventListener('click', onClick);
      field.addEventListener('mouseover', onOver);
      field.addEventListener('mouseout', onOut);
      field.addEventListener('contextmenu', onContext);
      window.addEventListener('keydown', onKey, true);
    });
  }

  async function collectCommandFor(u) {
    for (;;) {
      if (autoAll) {
        // 挂机：不弹菜单，略停一拍让玩家看得见轮到谁
        setStatusFor(u, '挂机中');
        highlightCommanding(u.id);
        await new Promise((r) => setTimeout(r, 120));
        highlightCommanding(null);
        if (autoAll) return { type: 'auto' };
      }
      setStatusFor(u);
      highlightCommanding(u.id);
      const cmd = await menuFor(u);
      highlightCommanding(null);
      if (cmd?.type === 'autoAll') {
        setAutoAll(true);
        continue;
      }
      if (cmd) {
        if (['attack', 'skill', 'defend', 'auto', 'protect'].includes(cmd.type)) lastCommands.set(u.id, { ...cmd });
        return cmd;
      }
    }
  }

  function highlightCommanding(id) {
    for (const [, uc] of cardByUnit) uc.card.classList.remove('commanding');
    if (id) cardByUnit.get(id)?.card.classList.add('commanding');
  }

  function menuFor(u) {
    cancelPick();
    return new Promise((resolve) => {
      cmdMenu.innerHTML = '';
      const wrap = el('div', 'cmd-grid');

      // 常驻说明文字已从战场撤掉(简报 T10)：预览条只报「这一击/这个菜单现在是什么」,
      // 静态词条释义收进顶栏「助」帮助面板;防御一条报数值后果，属反馈，保留。
      const bAtk = cmdButton(TEXT.commands.attack, 'attack');
      attachPreview(bAtk, () => dmgPreviewRows(u, BASIC_ATTACK, TEXT.commands.attack));
      bAtk.onclick = async () => {
        const t = await pickTarget(u, 'enemy', BASIC_ATTACK, TEXT.commands.attack);
        resolve(t ? { type: 'attack', targetId: t } : null);
      };
      const bSkill = cmdButton(TEXT.commands.skill, 'skill');
      attachPreview(bSkill, () => [`${TEXT.commands.skill} · ${unitSkills(u).length} 招 · ${TEXT.ui.mp} ${u.mp}/${u.maxMp}`]);
      bSkill.onclick = () => skillMenu(u, resolve);
      const bDef = cmdButton(TEXT.commands.defend, 'defend');
      bDef.title = TEXT.battle.defendTip;
      attachPreview(bDef, () => [TEXT.battle.defendTip]);
      bDef.onclick = () => { cancelPick(); resolve({ type: 'defend' }); };
      const bItem = cmdButton(TEXT.commands.item, 'item');
      bItem.title = TEXT.battle.itemTip;
      attachPreview(bItem, () => [TEXT.battle.itemTip]);
      bItem.onclick = () => itemMenu(u, resolve);
      const bSp = cmdButton(TEXT.commands.special, 'special');
      bSp.title = TEXT.battle.specialTip;
      attachPreview(bSp, () => [TEXT.battle.specialTip]);
      // 人人可用愤怒特技;悟空另有七十二变
      attachPreview(bSp, () => [`${TEXT.battle.specialTip} · 愤怒 ${u.sp ?? 0}/${SP.max}`]);
      bSp.onclick = () => specialMenu(u, resolve);
      const bAuto = cmdButton(TEXT.commands.auto, 'auto');
      bAuto.title = TEXT.battle.autoTip;
      attachPreview(bAuto, () => [TEXT.battle.autoTip]);
      bAuto.onclick = () => {
        cancelPick();
        const tipEl = cmdStatus.querySelector('.cmd-who-tip');
        if (tipEl) tipEl.textContent = '交给自动';
        resolve({ type: 'auto' });
      };
      const bFlee = cmdButton(TEXT.commands.flee, 'flee');
      if (state.def.boss) {
        // 「BOSS 战无效」由按钮变灰来说，不再常驻文案(简报 T10)
        bFlee.classList.add('disabled');
        bFlee.title = TEXT.ui.bossNoEscape;
        attachPreview(bFlee, () => []);
      } else {
        bFlee.onclick = () => { cancelPick(); resolve({ type: 'flee' }); };
        attachPreview(bFlee, () => []);
      }

      const repeat = repeatableCommand(u);
      const bRepeat = cmdButton(TEXT.commands.repeat, 'repeat');
      bRepeat.title = repeat ? commandSummary(repeat) : '上一回合的目标或招式已不可沿用';
      attachPreview(bRepeat, () => repeat ? [commandSummary(repeat)] : []);
      if (!repeat) {
        bRepeat.classList.add('disabled');
      } else {
        bRepeat.onclick = () => { cancelPick(); resolve({ ...repeat }); };
      }

      // 保护：替一位活着的伙伴挡这一回合的单体攻击
      const bProtect = cmdButton('保护', 'protect');
      bProtect.title = TEXT.battle.protectTip;
      attachPreview(bProtect, () => [TEXT.battle.protectTip]);
      if (aliveUnits(state, 'party').length < 2) bProtect.classList.add('disabled');
      else {
        bProtect.onclick = async () => {
          const t = await pickTarget(u, 'party', { mul: 0 }, '保护', { exclude: u.id });
          resolve(t ? { type: 'protect', targetId: t } : null);
        };
      }
      wrap.append(bAtk, bSkill, bDef, bItem, bSp, bAuto, bFlee, bRepeat, bProtect);
      // 挂机(寻常战斗)：此后每回合全队自动，点场上的「接手」收回;强敌与剧情战干脆不摆这颗钮
      if (canAutoAll) {
        const bAutoAll = cmdButton('挂机', 'autoAll');
        bAutoAll.title = TEXT.battle.autoAllTip;
        attachPreview(bAutoAll, () => [TEXT.battle.autoAllTip]);
        bAutoAll.onclick = () => { cancelPick(); resolve({ type: 'autoAll' }); };
        wrap.append(bAutoAll);
      }
      cmdMenu.appendChild(wrap);
      bindKbd(wrap);
    });
  }

  function backButton(resolve) {
    const b = cmdButton(TEXT.commands.back, 'back');
    b.onclick = () => { cancelPick(); resolve(null); };
    return b;
  }

  function skillMenu(u, resolve) {
    cancelPick();
    cmdMenu.innerHTML = '';
    const wrap = el('div', 'cmd-list');
    const keys = unitSkills(u);
    const targetLabel = { enemy: '单体', enemies: '群体', ally: '友方', party: '全队', self: '自身' };
    for (const k of keys) {
      const s = SKILLS[k];
      const eff = effectiveSkill(u, k, s); // 预览与结算同走熟练强化(简报验收：预览=结算)
      const item = el('button', 'btn cmd-item');
      item.dataset.skill = k;
      const nm = el('span', 'cmd-item-name');
      nm.append(iconBadge(s.kind === 'mag' ? '法' : '物', { sm: true }), document.createTextNode(' ' + s.name));
      const meta = el('span', 'cmd-item-meta', `${targetLabel[s.target] ?? ''}${s.kind === 'mag' ? '法术' : '物理'}·${u.element} · 法力${eff.mp}`);
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
    cancelPick();
    cmdMenu.innerHTML = '';
    const wrap = el('div', 'cmd-list');
    const owned = Object.entries(state.items)
      .map(([k, n]) => [k, k === 'truefan' ? Math.max(0, n - plannedFanUses) : n])
      .filter(([, n]) => n > 0);
    if (owned.length === 0) wrap.appendChild(el('div', 'cmd-empty', '——'));
    for (const [k, n] of owned) {
      const it = ITEMS[k];
      const nextFan = k === 'truefan'
        ? fanStageNames[Math.min(2, state.fanStage + plannedFanUses)]
        : null;
      const label = nextFan ? `${it.name} · 下一扇：${nextFan} ×${n}` : `${it.name} ×${n}`;
      const item = el('button', 'btn cmd-item with-icon');
      item.append(itemIcon(k, { cls: 'sm' }), el('span', 'cmd-item-name', label));
      item.dataset.item = k;
      if (it.desc) item.title = it.desc;
      attachPreview(item, () => [`${it.name}：${it.desc}`]);
      item.onclick = async () => {
        if (it.target === 'deadAlly') {
          const t = await pickTarget(u, 'party', { mul: 0 }, it.name, { dead: true });
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else if (it.target === 'ally') {
          const t = await pickTarget(u, 'party', { mul: 0 }, it.name);
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else if (it.target === 'enemy') {
          const t = await pickTarget(u, 'enemy', { mul: 0 }, it.name);
          resolve(t ? { type: 'item', itemId: k, targetId: t } : null);
        } else {
          if (k === 'truefan') plannedFanUses += 1;
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
    cancelPick();
    // 首次打开先弹「七十二变」小卡片
    if (u.hasTransform) await onceCard(root, 'transform', TEXT.onceCards.transform.title, TEXT.onceCards.transform.lines);
    cmdMenu.innerHTML = '';
    const wrap = el('div', 'cmd-list');
    const foes = aliveUnits(state, 'enemy');
    for (const [sk, st] of Object.entries(STUNTS)) {
      const item = el('button', 'btn cmd-item stunt');
      item.dataset.stunt = sk;
      item.append(el('span', 'cmd-item-name', `特技 · ${st.name}`), el('span', 'cmd-item-meta', `${st.desc} · 现有 ${u.sp ?? 0}`));
      attachPreview(item, () => [`${st.name}:${st.desc}`, `愤怒 ${u.sp ?? 0}/${SP.max} · 受伤越重攒得越快`]);
      if ((u.sp ?? 0) < st.sp) {
        item.classList.add('disabled');
        item.title = `愤怒不足(需 ${st.sp})`;
      } else {
        item.onclick = async () => {
          if (st.target === 'enemy') {
            const t = await pickTarget(u, 'enemy', st, st.name);
            resolve(t ? { type: 'stunt', stuntId: sk, targetId: t } : null);
          } else resolve({ type: 'stunt', stuntId: sk });
        };
      }
      wrap.appendChild(item);
    }
    for (const [fk, f] of Object.entries(u.hasTransform ? FORMS : {})) {
      // 五行杠杆提示：该形态能克到场上哪个活敌
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

  function dispose() {
    cancelPick();
    autoChip.remove();
    window.removeEventListener('keydown', onGlobalKey);
    unbindKbd();
    hidePreview();
  }

  return {
    beginRound,
    collectCommandFor,
    dispose,
    hidePreview,
    pushLog,
    showActing,
    showIdleBottom,
    unbindKeyboard: unbindKbd,
  };
}
