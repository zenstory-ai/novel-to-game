// 战斗事件演出:只解释 engine 事件,不参与数值结算或指令选择。

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
  refreshAll,
  renderOrderBar,
  renderUnits,
  pushLog,
  setJumpedIds,
}) {
  let transformHinted = false;
  let sawFinisher = false;
  let prevQueue = [];
  let jumpedIds = [];
  const floatSlots = new Map();

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
    shanfeng: 'wind', // 罗刹女招牌·芭蕉扇风(一借核心意象,非小怪寻常技)
  };

  async function showBanner(text, cls = '') {
    banner.textContent = text;
    banner.className = `skill-banner ${cls}`;
    banner.style.display = 'block';
    await sleep(520 * duration());
    banner.style.display = 'none';
  }

  function lunge(actorId, targetId) {
    const a = cardOf(actorId), t = cardOf(targetId);
    if (!a || !t) return;
    const ar = a.card.getBoundingClientRect(), tr = t.card.getBoundingClientRect();
    const dx = (tr.left - ar.left) * 0.24, dy = (tr.top - ar.top) * 0.24;
    a.card.style.transform = `translate(${dx}px, ${dy}px)`;
    setTimeout(() => { a.card.style.transform = ''; }, 200 * duration() + 60);
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
    if (!shakeEnabled()) return;
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

  // 回合切换/战斗结束时强制清空飘字层(简报 T9):
  // 飘字动画是真实时长的 CSS,结算睡眠随 duration() 缩放——加速模式下回合结束了,
  // 上一回合的飘字还挂在画面上淡出(残影)。新回合开始前一律不留。
  function clearFloats() {
    field.querySelectorAll('.float-text, .float-stamp').forEach((n) => n.remove());
  }

  async function playEvents(events) {
    const done = [];
    let burnFxPlayed = false; // 地火灼伤同回合可能连跳多人,音效只播一记
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
          setJumpedIds(jumpedIds);
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
          if (u) pushLog(`${u.name} · ${ev.name}`);
          if (ev.skill) {
            const fxKind = SPELL_FX[skillKeyByName[ev.name]];
            if (fxKind && uc) {
              // 标志性法术演出:粒子 + 背景色调突变 + 音效(跳过演出时缩为一道色闪)
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
          lunge(ev.actor, ev.target);
          await sleep(120 * duration());
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
          refreshAll();
          await sleep(220 * duration());
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
              stampText(uc.anchor, '定风丹', 'ke-stamp');
              floatText(uc.anchor, TEXT.battle.dingfeng, 'ke');
              audio.sfx('ke');
              await fx.play('ward', uc.card, { D: duration(), skipFx: skipEffects() });
            }
          }
          refreshAll();
          await sleep(160 * duration());
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
          const uc = cardOf(ev.actor);
          const actorU = getUnit(state, ev.actor);
          if (actorU) pushLog(`${actorU.name} 变化 · ${ev.name}`);
          if (uc) {
            uc.card.classList.add('flash');
            floatText(uc.anchor, TEXT.float.transform.replace('{name}', ev.name), 'ke');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * duration());
          }
          audio.sfx('transform');
          refreshAll();
          await sleep(360 * duration());
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
          await sleep(1400 * duration());
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
          refreshAll();
          await sleep(300 * duration());
          break;
        }
        case 'death': {
          const uc = cardOf(ev.unit);
          const deadU = getUnit(state, ev.unit);
          if (deadU) pushLog(`${deadU.name} 败退`);
          if (uc) uc.card.classList.add('dead');
          refreshAll();
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
          await sleep(420 * duration());
          break;
        }
        case 'caught': {
          const uc = cardOf(ev.target);
          if (uc) uc.card.classList.add('dead');
          // 只留 toast 一条通道:同一句提示不再「飘字+顶部横幅」两处绘制(记录缺陷 R2)
          pushLog(`收服 ${ev.name}`);
          audio.sfx('levelup');
          toast(root, `收服了 ${ev.name}!可在「召唤兽」中安排上阵`);
          await sleep(420 * duration());
          break;
        }
        case 'catch_fail': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '挣脱了!', 'miss');
          await sleep(240 * duration());
          break;
        }
        case 'ward': {
          const uc = cardOf(ev.target);
          if (uc) floatText(uc.anchor, '避火!', 'buff');
          await sleep(200 * duration());
          break;
        }
        case 'story_blow': {
          // 罗刹女祭真扇:悟空被吹飞(演出)——满场风痕,阴风骤起
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
            floatText(wk.anchor, '吹飞五万里!', 'heavy');
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
          renderUnits();
          const uc = cardOf(ev.unit);
          if (uc) {
            floatText(uc.anchor, `${ev.name} 来援!`, 'buff');
            uc.card.classList.add('flash');
            setTimeout(() => uc.card.classList.remove('flash'), 500 * duration());
          }
          audio.sfx('telegraph');
          refreshAll();
          await sleep(320 * duration());
          break;
        }
        case 'rout': {
          const uc = cardOf(ev.unit);
          if (uc) {
            floatText(uc.anchor, '溃散!', 'miss');
            uc.card.classList.add('dead');
          }
          refreshAll();
          await sleep(240 * duration());
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
          await sleep(1600 * duration());
          overlay.remove();
          refreshAll();
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
        case 'buff_end': refreshAll(); break;
        case 'field_burn': {
          // 战场态势·地火炙烤:与「克!」同一套反馈语言——数字+印章+受击抖动
          const uc = cardOf(ev.target);
          if (uc) {
            const slot = nextSlot(ev.target);
            floatText(uc.anchor, `${ev.amount}`, 'burn', slot);
            stampText(uc.anchor, state.def.fieldRule?.name ?? '地火', 'burn-stamp');
            shake(ev.target);
            flashHit(ev.target);
            const u = getUnit(state, ev.target);
            if (u) pushLog(`${state.def.fieldRule?.name ?? '地火'} · ${u.name} -${ev.amount}`);
          }
          if (!burnFxPlayed) { audio.sfx('firefx'); burnFxPlayed = true; }
          refreshAll();
          await sleep(260 * duration());
          break;
        }
        case 'field_break': {
          // 结阵被破:横幅+常驻条变灰,敌方防御回落当场可见
          pushLog(`${ev.name} 已破`);
          audio.sfx('ke');
          await showBanner(`${ev.name} · 破!`, 'phase-banner');
          refreshAll();
          await sleep(240 * duration());
          break;
        }
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

  return {
    clearFloats,
    hadFinisher: () => sawFinisher,
    playEvents,
    showBanner,
  };
}
