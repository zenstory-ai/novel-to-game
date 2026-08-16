// 战斗指令控制器:负责预览、目标选择与键盘导航,不执行回合结算。

import { SKILLS, FORMS, ITEMS, BASIC_ATTACK } from './data.js';
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
import { unitURL } from './assets.js';

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
    if (!rows || rows.length === 0) { hidePreview(); return; } // 无实据时报空,不挂静态说明(简报 T10)
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
  }

  function hidePreview() {
    previewBox.style.display = 'none';
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
    // 单体技的默认预览取首个活敌。这是「悬停预览」而非已确认的出手,必须标明:
    // 独立 QA 的干净上下文裁决在此处卡住——预览已给出具体敌人与完整数值,
    // 玩家无法区分它是悬停提示还是这一击已经落定。
    const rows = dmgPreviewOn(u, skill, foes[0], label);
    if (foes.length > 1) rows[0].side = `${rows[0].side} · 预览,出手时再选目标`;
    return rows;
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
    const who = el('div', 'cmd-who');
    who.append(el('div', 'cmd-who-name', '战况'));
    who.append(el('div', 'cmd-who-tip', '号令已下,观战'));
    cmdStatus.append(who);
  }

  // ---------- 战况卷轴(简报 T8) ----------
  // 结算/对话时段,底部指令台不再是一块带「……」的空白板:
  // 右格以宣纸木刻排字列出最近 3 条战报。
  const battleLog = []; // 新条目在前
  function pushLog(text) {
    battleLog.unshift(text);
    if (battleLog.length > 6) battleLog.pop();
  }
  function showIdleBottom() {
    cmdMenu.innerHTML = '';
    clearStatus();
    const sc = el('div', 'battle-report');
    sc.append(el('div', 'battle-report-title', '战况'));
    const lines = el('div', 'battle-report-lines');
    if (battleLog.length === 0) lines.append(el('div', 'battle-report-line', '两军对峙,各听号令。'));
    for (const t of battleLog.slice(0, 3)) lines.append(el('div', 'battle-report-line', t));
    sc.append(lines);
    cmdMenu.appendChild(sc);
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

      // 常驻说明文字已从战场撤掉(简报 T10):预览条只报「这一击/这个菜单现在是什么」,
      // 静态词条释义收进顶栏「助」帮助面板;防御一条报数值后果,属反馈,保留。
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
      if (state.def.boss) {
        // 「BOSS 战无效」由按钮变灰来说,不再常驻文案(简报 T10)
        bFlee.classList.add('disabled');
        bFlee.title = TEXT.ui.bossNoEscape;
        attachPreview(bFlee, () => []);
      } else {
        bFlee.onclick = () => resolve({ type: 'flee' });
        attachPreview(bFlee, () => []);
      }

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

  function dispose() {
    window.removeEventListener('keydown', onGlobalKey);
    unbindKbd();
    hidePreview();
  }

  return {
    collectCommandFor,
    dispose,
    hidePreview,
    pushLog,
    showIdleBottom,
    unbindKeyboard: unbindKbd,
  };
}
