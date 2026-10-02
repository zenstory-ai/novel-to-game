// 战斗事件演出：只解释 engine 事件，不参与数值结算或指令选择。

import { SKILLS, FORMATIONS, ITEMS } from './data.js';
import { getUnit } from './engine.js';
import { TEXT } from './text.js';
import { el, floatText, stampText, toast } from './ui.js';
import { unitURL } from './assets.js';
import { audio } from './audio.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createBattleAnimator({
  root,
  state,
  field,
  banner,
  fx,
  cardByUnit,
  duration,
  skipEffects,
  shakeEnabled,
  renderOrderBar,
  renderUnits,
  pushLog,
  setJumpedIds,
  sync,
  showActing,
}) {
  let transformHinted = false;
  let sawFinisher = false;
  let prevQueue = [];
  let jumpedIds = [];
  const floatSlots = new Map();

  // ---------- 事件动画 ----------
  function cardOf(id) { return cardByUnit.get(id); }

  // 标志性法术 → 演出种类(简报二.4)：火/水/金身各有专属粒子+色调，不再共用通用特效。
  // 只给标志性技能(玩家绝技与 BOSS 大招);小怪的寻常火弹走通用音效，避免场场连播演出拖节奏。
  const skillKeyByName = Object.fromEntries(Object.entries(SKILLS).map(([k, s]) => [s.name, k]));
  const SPELL_FX = {
    lieyan_quan: 'fire', huolian: 'fire', fenye: 'fire', chiyan: 'fire',
    sihuo: 'fire',
    pishuijue: 'water', xuanbing_ji: 'water', jinglang: 'water', bingfeng: 'water',
    luohanjinshen: 'gold', hufa: 'gold', gangtie: 'gold', huoyan: 'gold',
    douzhan: 'gold', jinjing: 'gold', guiyuan: 'water',
    shanfeng: 'wind', // 罗刹女招牌·芭蕉扇风(一借核心意象，非小怪寻常技)
  };

  async function showBanner(text, cls = '') {
    banner.textContent = text;
    banner.className = `skill-banner ${cls}`;
    banner.style.display = 'block';
    await sleep(520 * duration());
    banner.style.display = 'none';
  }

  // 梦幻式扑击：冲到目标身侧(约八成五的路程)→ 停顿出手 → 退回原位;移动中压在众人之上
  function lunge(actorId, targetId) {
    const a = cardOf(actorId), t = cardOf(targetId);
    if (!a || !t || actorId === targetId) return Promise.resolve();
    const ar = a.card.getBoundingClientRect(), tr = t.card.getBoundingClientRect();
    const zoom = parseFloat(a.card.style.zoom) || 1;
    const acx = ar.left + ar.width / 2, tcx = tr.left + tr.width / 2;
    const side = tcx > acx ? -1 : 1; // 停在目标靠近自己的一侧
    const gapX = (tcx + side * tr.width * 0.55) - acx;
    const dx = (gapX * 0.85) / zoom;
    const dy = ((tr.bottom - ar.bottom) * 0.85) / zoom;
    const D = duration();
    const go = 160 * D, hold = 120 * D, back = 160 * D;
    a.card.style.zIndex = '30';
    a.card.style.transition = `transform ${go}ms cubic-bezier(.3,.7,.4,1)`;
    a.card.style.transform = `translate(${dx}px, ${dy}px)`;
    setTimeout(() => {
      a.card.style.transition = `transform ${back}ms ease-in-out`;
      a.card.style.transform = '';
      setTimeout(() => { a.card.style.zIndex = ''; a.card.style.transition = ''; }, back + 30);
    }, go + hold);
    return sleep(go);
  }

  function puff(id) {
    const uc = cardOf(id);
    if (!uc) return Promise.resolve();
    audio.sfx('transform');
    return fx.play('puff', uc.card, { D: duration() });
  }

  // 战况一行：谁打谁、掉多少、克/暴击/被克
  function damageLine(ev) {
    const a = getUnit(state, ev.actor), d = getUnit(state, ev.target);
    if (!a || !d) return;
    const tags = [];
    if (ev.rel === 'ke') tags.push('克！');
    if (ev.crit) tags.push('暴击');
    if (ev.combo) tags.push('连击');
    if (ev.rel === 'beike') tags.push('被克');
    if (ev.protectFor) tags.push(`替${getUnit(state, ev.protectFor)?.name ?? ''}挡下`);
    const cls = ev.crit ? 'crit' : ev.rel === 'ke' ? 'ke' : ev.rel === 'beike' ? 'beike' : '';
    pushLog(`${a.name} → ${d.name} −${ev.amount}${tags.length ? ` ${tags.join(' ')}` : ''}`, cls);
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

  // 屏幕震动：克制幅度(2px)，暴击/克制命中更重(4px);可关(简报二.1)
  function quake(heavy = false) {
    if (!shakeEnabled()) return;
    field.classList.remove('quake', 'quake-hi');
    void field.offsetWidth;
    field.classList.add(heavy ? 'quake-hi' : 'quake');
    setTimeout(() => field.classList.remove('quake', 'quake-hi'), 500);
  }

  // 飘字错层：同一目标同时多个飘字时向下排
  function nextSlot(id) {
    const n = (floatSlots.get(id) ?? 0) + 1;
    floatSlots.set(id, n);
    setTimeout(() => floatSlots.set(id, 0), 1200);
    return n - 1;
  }

  // 回合切换/战斗结束时强制清空飘字层(简报 T9):
  // 飘字动画是真实时长的 CSS,结算睡眠随 duration() 缩放——加速模式下回合结束了,
  // 上一回合的飘字还挂在画面上淡出(残影)。新回合开始前一律不留。
  function clearFloats() {
    field.querySelectorAll('.float-text, .float-stamp').forEach((n) => n.remove());
  }

  async function playEvents(events) {
    const done = [];
    let burnFxPlayed = false; // 地火灼伤同回合可能连跳多人，音效只播一记
    for (const ev of events) {
      switch (ev.t) {
        case 'round':
          // 与上回合顺序比较，标出插到更前的单位(抢位)
          jumpedIds = prevQueue.length
            ? ev.queue.filter((id, i) => {
                const before = prevQueue.indexOf(id);
                return before > -1 && i < before;
              })
            : [];
          prevQueue = [...ev.queue];
          setJumpedIds(jumpedIds);
          sync(ev);
          renderOrderBar();
          break;
        case 'turn':
          renderOrderBar(ev.unit, done);
          showActing?.(ev.unit);
          break;
        case 'action': {
          const u = getUnit(state, ev.actor);
          const uc = u ? cardOf(ev.actor) : null;
          if (uc) floatText(uc.anchor, ev.name, 'info');
          if (u && ev.skill) pushLog(`${u.name} · ${ev.name}`, 'skill');
          sync(ev); // 法力在报招时扣下
          if (ev.skill) {
            const fxKind = SPELL_FX[skillKeyByName[ev.name]];
            if (fxKind && uc) {
              // 标志性法术演出：粒子 + 背景色调突变 + 音效(跳过演出时缩为一道色闪)
              audio.sfx(fxKind === 'fire' ? 'firefx' : fxKind === 'water' ? 'waterfx' : fxKind === 'wind' ? 'fan2' : 'skill');
              await fx.play(fxKind, uc.card, { D: duration(), skipFx: skipEffects() });
            } else {
              audio.sfx('skill');
              await sleep(160 * duration());
            }
          } else {
            await sleep(160 * duration());
          }
          break;
        }
        case 'damage': {
          if (ev.kind === 'phy' && !ev.combo) await lunge(ev.actor, ev.protectFor ?? ev.target);
          else await sleep(160 * duration());
          damageLine(ev);
          const uc = cardOf(ev.target);
          if (ev.protectFor && uc) stampText(uc.anchor, '保护', 'ke-stamp');
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
              // 五行教学：克制命中时在目标身上盖「金克木」三字印(简报二.3)
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
          sync(ev);
          await sleep(300 * duration());
          break;
        }
        case 'miss': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.miss, 'miss');
          audio.sfx('thud');
          await sleep(240 * duration());
          break;
        }
        case 'heal': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.heal.replace('{n}', ev.amount), 'heal');
          audio.sfx('heal');
          const hu = getUnit(state, ev.target);
          if (hu && !ev.regen) pushLog(`${hu.name} 回复 ${ev.amount}`, 'heal');
          sync(ev);
          await sleep(220 * duration());
          break;
        }
        case 'mp': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.mpUp.replace('{n}', ev.amount), 'mpup');
          sync(ev);
          break;
        }
        case 'buff': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.buffNames[ev.buff] ?? ev.buff, 'buff');
          sync(ev);
          await sleep(160 * duration());
          break;
        }
        case 'immune': {
          // 定风丹护体：减速根本不落身，只飘「定风」并给一道金光(简报二.4)
          const uc = cardOf(ev.target);
          if (uc) {
            stampText(uc.anchor, '定风丹', 'ke-stamp');
            floatText(uc.anchor, TEXT.battle.dingfeng, 'ke');
          }
          audio.sfx('ke');
          if (uc) await fx.play('ward', uc.card, { D: duration(), skipFx: skipEffects() });
          break;
        }
        case 'protect': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '受保护', 'buff');
          const g = getUnit(state, ev.unit), t = getUnit(state, ev.target);
          if (g && t) pushLog(`${g.name} 护住 ${t.name}`, 'skill');
          await sleep(160 * duration());
          break;
        }
        case 'revive': {
          const uc = cardOf(ev.target);
          sync(ev);
          if (uc) {
            uc.card.classList.add('flash');
            floatText(uc.anchor, '回魂！', 'heal');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * duration());
          }
          audio.sfx('heal');
          const t = getUnit(state, ev.target);
          if (t) pushLog(`${t.name} 醒转归队`, 'heal');
          await sleep(320 * duration());
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
          sync(ev);
          await sleep(140 * duration());
          break;
        }
        case 'stun': {
          const uc = cardOf(ev.unit);
          if (uc) floatText(uc.anchor, TEXT.float.stun, 'beike');
          await sleep(160 * duration());
          break;
        }
        case 'transform': {
          // 一团墨烟 → 烟里换上形态立绘(与指令台头像一起换)
          const uc = cardOf(ev.actor);
          const actorU = getUnit(state, ev.actor);
          if (actorU) pushLog(`${actorU.name} 变化 · ${ev.name}`, 'skill');
          await puff(ev.actor);
          sync(ev);
          showActing?.(ev.actor);
          if (uc) {
            uc.card.classList.add('flash');
            floatText(uc.anchor, TEXT.float.transform.replace('{name}', ev.name), 'ke');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * duration());
          }
          await sleep(300 * duration());
          break;
        }
        case 'form_end': {
          const uc = cardOf(ev.unit);
          await puff(ev.unit);
          sync(ev);
          if (uc) floatText(uc.anchor, TEXT.float.formEnd, 'info');
          await sleep(160 * duration());
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
          await sleep(1400 * duration());
          overlay.remove();
          break;
        }
        case 'reinforce': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, TEXT.float.heal.replace('{n}', ev.amount), 'heal');
          sync(ev);
          break;
        }
        case 'phase': {
          renderUnits();
          pushLog(TEXT.story.phase2[0].text);
          const uc = cardOf(ev.unit);
          if (uc) {
            uc.card.classList.add('flash');
            setTimeout(() => uc.card.classList.remove('flash'), 600 * duration());
          }
          audio.sfx('telegraph');
          await showBanner(TEXT.story.phase2[0].text, 'phase-banner');
          quake(true);
          sync(ev);
          await sleep(300 * duration());
          break;
        }
        case 'death': {
          const uc = cardOf(ev.unit);
          const deadU = getUnit(state, ev.unit);
          if (deadU) pushLog(deadU.side === 'party' ? `${deadU.name} 倒下了` : `${deadU.name} 败退`, deadU.side === 'party' ? 'beike' : '');
          sync(ev);
          await sleep(320 * duration());
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
          await lunge(ev.actor, ev.target);
          const hu = getUnit(state, ev.target), hb = getUnit(state, ev.actor);
          if (hu && hb) pushLog(`${hb.name} · ${ev.name} → ${hu.name} −${ev.amount}${ev.protectFor ? ' 保护' : ''}`, 'crit');
          if (ev.protectFor && uc) floatText(uc.anchor, '保护', 'ke', 1);
          if (uc) {
            floatText(uc.anchor, `${ev.amount}`, 'heavy', 0);
            stampText(uc.anchor, ev.name, 'heavy-stamp');
            if (ev.mitigated) floatText(uc.anchor, TEXT.battle.heavyMitigated, 'buff', 1);
            shake(ev.target, true);
            flashHit(ev.target);
          }
          quake(true);
          audio.sfx('heavy');
          sync(ev);
          await sleep(420 * duration());
          break;
        }
        case 'caught': {
          sync(ev);
          // 收服是一桩大事：场中央盖一枚不透明的印，与「此战得胜」同一种分量
          pushLog(`收服 ${ev.name}`, 'ke');
          audio.sfx('levelup');
          const seal = el('div', 'seal-toast');
          seal.append(el('div', 'seal-toast-title', `收服 · ${ev.name}`), el('div', 'seal-toast-sub', '战后可在【召唤兽】里安排上阵'));
          field.appendChild(seal);
          await sleep(1300 * duration() + 300);
          seal.remove();
          break;
        }
        case 'catch_fail': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '挣脱了！', 'miss');
          await sleep(240 * duration());
          break;
        }
        case 'ward': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '避火！', 'buff');
          await sleep(200 * duration());
          break;
        }
        case 'story_blow': {
          // 罗刹女祭真扇：悟空被吹飞(演出)——满场风痕，阴风骤起
          audio.sfx('fan2');
          const bossUc = ev.actor ? cardOf(ev.actor) : null;
          if (bossUc) {
            bossUc.card.classList.add('flash');
            setTimeout(() => bossUc.card.classList.remove('flash'), 500 * duration());
          }
          await showBanner('芭蕉扇——!', 'fan-banner');
          const fxP = fx.play('wind', null, { D: duration(), skipFx: skipEffects() });
          const wk = cardOf('p0');
          if (wk) {
            wk.card.classList.add('blown');
            floatText(wk.anchor, '吹飞五万里！', 'heavy');
          }
          quake(true);
          await fxP;
          await sleep(1400 * duration());
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
          await sleep(1200 * duration());
          break;
        }
        case 'summon': {
          sync(ev);
          renderUnits();
          const uc = cardOf(ev.unit);
          if (uc) {
            floatText(uc.anchor, `${ev.name} 来援！`, 'buff');
            uc.card.classList.add('flash');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * duration());
          }
          audio.sfx('telegraph');
          sync(ev);
          await sleep(320 * duration());
          break;
        }
        case 'rout': {
          const uc = cardOf(ev.unit);
          if (uc) {
            floatText(uc.anchor, '溃散！', 'miss');
          }
          sync(ev);
          await sleep(240 * duration());
          break;
        }
        case 'god_assist': {
          // 众神围剿：哪吒登场助战(门控演出)
          audio.sfx('victory');
          const overlay = el('div', 'god-overlay');
          const img = el('img');
          img.src = unitURL('nezha', '哪');
          const tx = el('div', 'finisher-text', `${ev.name} 率众神前来助战！`);
          overlay.append(img, tx);
          field.appendChild(overlay);
          const uc = cardOf(ev.target);
          if (uc) {
            floatText(uc.anchor, `${ev.amount}`, 'heavy');
            shake(ev.target, true);
            flashHit(ev.target);
          }
          quake(true);
          sync(ev);
          await sleep(1600 * duration());
          overlay.remove();
          break;
        }
        case 'flee': {
          toast(root, ev.success ? TEXT.ui.escaped : (state.def.boss ? TEXT.ui.bossNoEscape : TEXT.ui.escapeFail));
          await sleep(300 * duration());
          break;
        }
        case 'formation': {
          const f = FORMATIONS[ev.formation];
          await showBanner(`${TEXT.commands.formation} · ${f.name}`);
          sync(ev);
          break;
        }
        case 'auto': break;
        case 'item': {
          const it = ITEMS[ev.item];
          if (ev.item === 'truefan' && ev.stage) {
            // 真扇三段专属演出：一息火(灰烬)/二生风(风痕)/三落雨(甘霖)，各不相同
            audio.sfx(`fan${ev.stage}`);
            await showBanner(it.name, 'fan-banner');
            await fx.play(`fan${ev.stage}`, null, { D: duration(), skipFx: skipEffects() });
          } else if (ev.item === 'fakefan') {
            audio.sfx('thud');
            await showBanner(it.name, 'fan-banner');
            await fx.play('backfire', null, { D: duration(), skipFx: skipEffects() });
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
          await sleep(200 * duration());
          break;
        }
        case 'buff_end': sync(ev); break;
        case 'field_burn': {
          // 战场态势·地火炙烤：与「克!」同一套反馈语言——数字+印章+受击抖动
          const uc = cardOf(ev.target);
          if (uc) {
            const slot = nextSlot(ev.target);
            floatText(uc.anchor, `${ev.amount}`, 'burn', slot);
            stampText(uc.anchor, state.def.fieldRule?.name ?? '地火', 'burn-stamp');
            shake(ev.target);
            flashHit(ev.target);
            const u = getUnit(state, ev.target);
            if (u) pushLog(`${state.def.fieldRule?.name ?? '地火'} · ${u.name} −${ev.amount}`, 'burn');
          }
          if (!burnFxPlayed) { audio.sfx('firefx'); burnFxPlayed = true; }
          sync(ev);
          await sleep(260 * duration());
          break;
        }
        case 'field_break': {
          // 结阵被破：横幅+常驻条变灰，敌方防御回落当场可见
          pushLog(`${ev.name} 已破`);
          audio.sfx('ke');
          await showBanner(`${ev.name} · 破！`, 'phase-banner');
          sync(ev);
          await sleep(240 * duration());
          break;
        }
        case 'battle_end': break;
      }
      if (ev.t !== 'round' && ev.t !== 'battle_end') {
        const idx = buildActionQueueDoneIndex(ev);
        if (idx) done.push(idx);
      }
      sync(ev); // 每个事件播完，画面就停在它发生后的样子
      // 速度变化(生风/变化/换阵/增益到期)后立即重排顺序条
      if (['buff', 'transform', 'form_end', 'formation', 'buff_end'].includes(ev.t)) renderOrderBar();
      // 教学提示：罗刹女体弱 → 提示变化
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
    // 行动完成的单位(用于顺序条勾销)：在 turn 事件后该单位即视为已行动
    if (ev.t === 'turn') return ev.unit;
    return null;
  }

  return {
    clearFloats,
    hadFinisher: () => sawFinisher,
    playEvents,
    showBanner,
  };
}
