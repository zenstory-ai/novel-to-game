// 战斗画面：把规则引擎吐出的事件演成出招、受击、飘字，并收集玩家每回合的指令。
// 规则在 rules/battle.js；这里不改任何数值，只读状态与事件。

import {
  beginRound, resolveRound, alive, unitById, usableSkills, skillOf, previewDamage, relation, actionQueue,
  finisherOpen, heavyTarget, chargingBoss, switchFormation, fieldGuardActive, fanPrompt,
} from '../rules/battle.js';
import { BASIC_ATTACK, STUNTS, FORMS, FORMATIONS, ITEMS, BUFF_INFO, BEATS, ELEMENTS } from '../data/combat.js';
import { COACH } from '../data/story.js';
import { h, clear, ms, wait, pace, holdFor, waitReal, armGuard } from '../core/dom.js';
import { unitArt, bgArt, uiArt, itemArt, faceStyle } from '../data/art.js';
import { createFx } from './fx.js';
import { audio } from '../core/audio.js';
import { settings, saveSettings, firstTime } from '../core/store.js';
import { toast } from '../ui/dialogue.js';

const SLOTS = {
  // 两条平行的斜线相向而立：敌方在左上，我方在右下
  wide: { enemy: [[22, 59], [8, 72], [36, 46], [47, 66], [33, 77]], party: [[78, 67], [92, 55], [64, 77], [51, 74], [72, 49]] },
  tall: { enemy: [[50, 34], [17, 30], [83, 30], [33, 20], [67, 20]], party: [[18, 63], [62, 62], [38, 84], [84, 83], [50, 84]] },
};
const AMBIENT = { huoyan: 'ember', cuiyun: 'leaf', moyundong: 'mist', leiji: 'mist' };
const YIELDS = new Set(['luosha', 'niumowang', 'whitebull']);
const IMPACT = new Set(['damage', 'miss', 'ward', 'heal', 'mp', 'buff', 'resist', 'immune']);
const RESULT = new Set([...IMPACT, 'death', 'phase', 'relief', 'summon', 'field_break', 'revive', 'caught', 'catch_fail', 'rout']);
const relText = (rel, a, d) => (rel === 'ke' ? `${a}克${d}` : rel === 'beike' ? '受克' : '');

export function runBattleView(stage, { state, labels, tutorial = false, canAutoAll = true, onBeat = null }) {
  state.trackSnap = true;
  const def = state.def;
  const bg = h('div.battle-bg', { style: { backgroundImage: `url(${bgArt(def.bg)})` } });
  const field = h('div.battle-field');
  const fxCanvas = h('canvas.battle-fx');
  const shaker = h('div.battle-shake', {}, bg, field, fxCanvas);
  const orderBar = h('div.order.plate', { data: { ui: 'order' } });
  const roundChip = h('div.chip.plate', { data: { ui: 'round' } }, '第 1 回合');
  const formationChip = h('button.chip.plate', { type: 'button', data: { ui: 'formation' }, title: '每回合可免费换一次阵型' });
  const autoChip = h('button.chip.plate', { type: 'button', data: { ui: 'auto-all' }, title: '之后每回合全队自行出手，随时可接手' }, '挂机');
  const speedChip = h('button.chip.plate', { type: 'button', data: { ui: 'speed' } });
  const top = h('div.battle-top', {}, orderBar, h('div.battle-info', {}, roundChip, formationChip, canAutoAll && autoChip, speedChip));
  const ruleChip = def.field ? h('div.chip.plate.rule', { data: { ui: 'field-rule' } }, h('b', {}, def.field.name), def.field.short) : null;
  const place = h('div.battle-place', {}, h('div.chip.plate.where', {}, def.name), ruleChip);
  const logLine = h('div.sr-only', { role: 'log', 'aria-live': 'polite' });
  const cueBar = h('div.cmd-cue.hidden', { data: { ui: 'cue-bar' } });
  const panelBody = h('div.cmd-inner');
  const panel = h('div.cmd-panel.card', { data: { ui: 'commands' } }, cueBar, panelBody);
  const brought = new Set(Object.keys(state.items).filter((k) => state.items[k] > 0)); // 开战时带着的道具
  const root = h('div.screen.battle', { data: { ui: 'battle', battle: state.battleId, phase: 'intro', round: 1 } }, shaker, top, place, logLine, panel);
  stage.append(root);
  const fx = createFx(fxCanvas);
  fx.ambient(AMBIENT[def.bg] ?? null);

  const els = new Map();
  const last = {}; // 每位伙伴上一回合的指令（给「沿用」用）
  let autoAll = false, shownRound = 1, resolveDone, tall = false, commandAbort = null, destroyed = false, commandPhases = 0, curWarn = null, curCoach = null;
  const done = new Promise((r) => { resolveDone = r; });

  // ---------- 布局 ----------
  function layout() {
    const rect = field.getBoundingClientRect();
    tall = root.clientWidth < 700;
    root.style.setProperty('--field-h', `${rect.height}px`);
    for (const u of state.units) place1(u);
    fx.resize();
  }
  function place1(u) {
    const el = els.get(u.id);
    if (!el) return;
    const table = SLOTS[tall ? 'tall' : 'wide'][u.side];
    const [x, y] = table[Math.min(u.slot, table.length - 1)];
    el.root.style.left = `${x}%`; el.root.style.top = `${y}%`; el.body.style.zIndex = String(10 + Math.round(y));
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);

  function pt(id, part = 'chest') {
    const el = els.get(id);
    const base = shaker.getBoundingClientRect();
    const r = el.hit.getBoundingClientRect();
    const x = r.left + r.width / 2 - base.left;
    if (part === 'feet') return { x, y: r.bottom - base.top };
    if (part === 'head') return { x, y: r.top - base.top + r.height * 0.12 };
    return { x, y: r.top - base.top + r.height * 0.45 };
  }

  // ---------- 单位 ----------
  function artOf(u, snap) {
    const form = snap ? snap.form : u.form?.id;
    return form ? FORMS[form].art : (snap?.art ?? u.art);
  }
  function mount(u, appear = false) {
    const img = h('img', { src: unitArt(artOf(u)), alt: '', draggable: false });
    img.style.animationDelay = `${-Math.random() * 3}s`;
    const body = h('div.unit-body', {}, img);
    const hpFill = h('i.fill'), hpLag = h('i.lag'), hpText = h('b');
    const mpFill = h('i.fill'), spFill = h('i.fill');
    const elBadge = h('span.el');
    const name = h('span.unit-name');
    const tags = h('div.unit-tags');
    const plate = h('div.unit-plate', {}, h('div.row', {}, elBadge, name), h('div.bar.hp', {}, hpLag, hpFill, hpText),
      u.side === 'party' && h('div.bar.mp', {}, mpFill), u.side === 'party' && h('div.bar.sp', {}, spFill), tags);
    const pin = h('div.unit-pin');
    const hit = h('div.unit-hit');
    const rootEl = h('div.unit', { data: { id: u.id, side: u.side, key: u.key } }, h('div.unit-shadow'), body, hit, plate, pin);
    if (u.big) rootEl.classList.add('big');
    if (u.small) rootEl.classList.add('small');
    if (u.isPet) rootEl.classList.add('pet');
    field.append(rootEl);
    const el = { root: rootEl, body, img, hit, hpFill, hpLag, hpText, mpFill, spFill, elBadge, name, tags, pin, art: artOf(u) };
    els.set(u.id, el);
    place1(u);
    paint(u.id, { hp: u.hp, maxHp: u.maxHp, mp: u.mp, maxMp: u.maxMp, sp: u.sp, alive: u.alive, element: u.element, name: u.name, art: u.art, form: null, defending: false, charging: false, big: u.big, buffs: u.buffs });
    if (appear) body.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ms(320), easing: 'cubic-bezier(.2,1.4,.4,1)' });
    return el;
  }

  function paint(id, s) {
    const el = els.get(id);
    const u = unitById(state, id);
    if (!el || !s) return;
    el.name.textContent = s.name;
    el.elBadge.dataset.el = s.element; el.elBadge.textContent = s.element;
    const hp = Math.max(0, s.hp / s.maxHp) * 100;
    el.hpFill.style.width = `${hp}%`; el.hpLag.style.width = `${hp}%`;
    el.hpText.textContent = `${s.hp}/${s.maxHp}`;
    if (u.side === 'party') { el.mpFill.style.width = `${(s.mp / Math.max(1, s.maxMp)) * 100}%`; el.spFill.style.width = `${(s.sp / 150) * 100}%`; }
    el.root.classList.toggle('defending', !!s.defending);
    el.root.classList.toggle('charging', !!s.charging);
    el.root.classList.toggle('big', !!s.big);
    const art = s.form ? FORMS[s.form].art : s.art;
    if (art !== el.art) { el.art = art; el.img.src = unitArt(art); }
    clear(el.tags);
    if (s.form) el.tags.append(h('span.tag.form', {}, FORMS[s.form].name));
    if (s.charging) el.tags.append(h('span.tag.rage', {}, '蓄力'));
    const fin = def.finisher;
    if (fin && u.key === fin.boss && s.alive && s.hp / s.maxHp <= fin.hpBelow) el.tags.append(h('span.tag.weary', { data: { ui: 'weary' } }, '疲态·可智取'));
    const seen = new Map();
    for (const b of s.buffs) { const e = seen.get(b.id) ?? { n: 0, turns: 0 }; e.n += 1; e.turns = Math.max(e.turns, b.turns); seen.set(b.id, e); }
    for (const [bid, e] of seen) {
      const info = BUFF_INFO[bid]; if (!info) continue;
      const good = info.good === (u.side === 'party') || (bid === 'enrage');
      const text = bid === 'enrage' ? `狂暴×${e.n}` : `${info.name}${e.turns < 50 ? `·${e.turns}` : ''}`;
      el.tags.append(h(`span.tag.${bid === 'enrage' ? 'rage' : good ? 'good' : 'bad'}`, {}, text));
    }
    if (!s.alive && !el.root.classList.contains('yield')) el.root.classList.add('dead');
    if (s.alive) el.root.classList.remove('dead', 'gone', 'fallen');
  }
  const paintAll = (snap) => { if (snap) for (const id of Object.keys(snap)) if (els.has(id)) paint(id, snap[id]); };

  function setPins() {
    for (const [id, el] of els) {
      clear(el.pin);
      const u = unitById(state, id);
      if (!u?.alive) continue;
      if (el.root.classList.contains('active')) el.pin.append(h('span.pin.turn'));
      if (el.queued) el.pin.append(h('span.pin.queued', {}, el.queued));
      if (el.rel) el.pin.append(h(`span.pin.${el.rel}`, {}, el.rel === 'ke' ? '克制' : '受克'));
    }
    const boss = chargingBoss(state);
    const marked = boss ? heavyTarget(state) : null;
    if (marked && els.get(marked.id)) els.get(marked.id).pin.prepend(h('span.pin.locked', { data: { ui: 'locked' } }, '被盯上'));
  }

  // ---------- 小工具 ----------
  function anim(el, frames, opts) {
    const a = el.animate(frames, { fill: 'forwards', easing: 'ease-out', ...opts, duration: ms(opts.duration) });
    return a.finished.catch(() => {});
  }
  function float(id, text, cls = 'dmg', dy = 0) {
    const p = pt(id, 'chest');
    const el = h(`div.float.${cls}`, {}, text);
    el.style.left = `${p.x + (Math.random() - 0.5) * 30}px`; el.style.top = `${p.y - 30 + dy}px`;
    el.style.animationDuration = `${Math.max(380, ms(1050))}ms`;
    shaker.append(el);
    setTimeout(() => el.remove(), Math.max(400, ms(1100)));
  }
  function stamp(id, text, cls = '') {
    const p = pt(id, 'head');
    const el = h(`div.stamp${cls ? `.${cls}` : ''}`, {}, text);
    el.style.left = `${p.x + 46}px`; el.style.top = `${p.y + 10}px`;
    el.style.animationDuration = `${Math.max(420, ms(1100))}ms`;
    shaker.append(el);
    setTimeout(() => el.remove(), Math.max(440, ms(1150)));
  }
  let calloutEl = null;
  function callout(u, text, sub = '') {
    calloutEl?.remove();
    calloutEl = h(`div.callout${u.side === 'enemy' ? '.enemy' : ''}`, {}, h('div.face', { style: faceStyle(els.get(u.id)?.art ?? u.art) }), h('span', {}, text), sub && h('small', {}, sub));
    root.append(calloutEl);
    const mine = calloutEl;
    setTimeout(() => { if (mine === calloutEl) { mine.remove(); calloutEl = null; } else mine.remove(); }, Math.max(500, ms(1200)));
  }
  function quake(power = 4) {
    if (!settings.shake) return;
    const k = [];
    for (let i = 0; i < 7; i += 1) k.push({ transform: `translate(${(Math.random() - 0.5) * power * 2}px, ${(Math.random() - 0.5) * power * 2}px)` });
    k.push({ transform: 'none' });
    shaker.animate(k, { duration: Math.max(90, ms(260)) });
  }
  function log(text) { logLine.textContent = text ?? ''; }
  const nm = (id) => unitById(state, id)?.name ?? '';
  function renderCueBar() {
    clear(cueBar);
    if (curWarn) cueBar.append(h('div.cue-pill.warn-pill', { data: { ui: 'warn' }, role: 'alert' }, curWarn));
    if (curCoach) cueBar.append(h('div.cue-pill.coach-pill', { data: { ui: 'coach' }, role: 'status' }, curCoach));
    cueBar.classList.toggle('hidden', !curWarn && !curCoach);
  }
  function warn(text) { curWarn = text || null; renderCueBar(); }
  function coach(text) { curCoach = text || null; renderCueBar(); }
  function refreshChips() {
    const f = FORMATIONS[state.formation];
    clear(formationChip).append(`阵型 · ${f.name}`);
    formationChip.disabled = state.formationSwitched || root.dataset.phase !== 'command';
    formationChip.title = `${f.gain}；${f.cost}。每回合可免费换一次，不占行动。`;
    clear(speedChip).append(settings.speed === 2 ? '加速 ×2' : '常速 ×1');
    autoChip.classList.toggle('on', autoAll);
    autoChip.textContent = autoAll ? '挂机中 · 点此接手' : '挂机';
    roundChip.textContent = `第 ${shownRound} 回合`;
    root.dataset.round = String(shownRound);
    if (ruleChip && def.field.kind === 'guard') ruleChip.classList.toggle('broken', !fieldGuardActive(state));
  }
  function buildOrder(queue, doneIds = new Set(), now = null) {
    clear(orderBar).append(h('label', {}, '出手顺序'));
    for (const id of queue) {
      const u = unitById(state, id);
      if (!u) continue;
      const item = h('div.order-item', { data: { id, side: u.side }, title: u.name }, h('div.face', { style: faceStyle(els.get(id)?.art ?? u.art) }), h('span.el', { data: { el: u.element } }, u.element));
      if (doneIds.has(id) || !u.alive) item.classList.add('done');
      if (id === now) item.classList.add('now');
      orderBar.append(item);
    }
  }

  // ---------- 演出 ----------
  async function lunge(actorId, to, onImpact, heavy = false) {
    const el = els.get(actorId);
    const from = pt(actorId, 'feet');
    const dx = (to.x - from.x) * 0.74, dy = (to.y - from.y) * 0.74;
    el.body.style.zIndex = '250';
    await anim(el.body, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${-Math.sign(dx) * 14}px,0) scale(0.97,1.03)`, offset: heavy ? 0.45 : 0.3 }, { transform: `translate(${dx}px,${dy}px) scale(1.06)` }], { duration: heavy ? 420 : 240, easing: 'cubic-bezier(.5,0,.8,.3)' });
    onImpact();
    await wait(heavy ? 150 : 100);
    await anim(el.body, [{ transform: `translate(${dx}px,${dy}px) scale(1.06)` }, { transform: 'translate(0,0) scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' });
    place1(unitById(state, actorId));
  }
  async function castPose(actorId, el5) {
    const el = els.get(actorId);
    const p = pt(actorId, 'feet');
    fx.aura(p.x, p.y - 40, el5);
    await anim(el.body, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,-12px) scale(1.05)' }, { transform: 'translate(0,0) scale(1)' }], { duration: 380 });
  }
  function hitReact(id, power = 1, side = 1) {
    const el = els.get(id);
    if (!el) return;
    el.body.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${side * 16 * power}px,-4px) rotate(${side * 3 * power}deg)` }, { transform: `translate(${-side * 6}px,0)` }, { transform: 'translate(0,0)' }], { duration: Math.max(80, ms(300)), easing: 'ease-out' });
    el.img.animate([{ filter: 'brightness(3.2) saturate(0.2)' }, { filter: 'brightness(1)' }], { duration: Math.max(60, ms(200)) });
  }

  function impactFx(e, fxKind, attackEl) {
    const p = pt(e.target);
    const big = !!e.crit || !!e.heavy;
    switch (fxKind) {
      case 'fire': case 'firewave': fx.fire(p.x, p.y, big); audio.sfx('firefx', { volume: 0.7 }); break;
      case 'wave': fx.water(p.x, p.y, big); audio.sfx('waterfx', { volume: 0.7 }); break;
      case 'ice': fx.ice(p.x, p.y); audio.sfx('waterfx', { volume: 0.7, rate: 1.3 }); break;
      case 'sweep': fx.slash(p.x, p.y, { el: attackEl, big }); break;
      case 'slash': fx.slash(p.x, p.y, { el: attackEl, big }); break;
      case 'gale': fx.sparks(p.x, p.y, ['#eafff5', '#9fe8cf', '#fff']); break;
      case 'silk': fx.sparks(p.x, p.y, ['#fff', '#e8d8ff', '#bfa6ff'], 10); break;
      case 'charm': fx.charm(p.x, p.y); break;
      case 'heavy': fx.smash(p.x, p.y + 30, { el: attackEl, big: true }); fx.flash('#fff', 0.5); break;
      default: fx.smash(p.x, p.y + 20, { el: attackEl, big });
    }
  }

  async function showImpact(e, action) {
    const target = unitById(state, e.target);
    const side = target?.side === 'party' ? 1 : -1;
    if (e.t === 'damage') {
      impactFx(e, action?.fx ?? e.fx, e.attackEl);
      hitReact(e.target, e.crit || e.heavy ? 1.6 : 1, side);
      const cls = e.crit ? 'crit' : e.rel === 'ke' ? 'ke' : e.rel === 'beike' ? 'weak' : 'dmg';
      float(e.target, `-${e.amount}`, cls);
      if (e.crit) stamp(e.target, '暴击');
      else if (e.combo) stamp(e.target, '连击！');
      if (e.rel === 'ke') { setTimeout(() => stamp(e.target, relText('ke', e.attackEl, e.targetEl), target.side === 'enemy' ? 'gold' : ''), e.crit ? ms(180) : 0); }
      if (e.rel === 'beike') stamp(e.target, '受克', 'grey');
      if (e.protectFor) float(e.target, `护住${nm(e.protectFor)}`, 'note', -44);
      if (e.heavy && e.softened) float(e.target, '挡住了！', 'note', -44);
      audio.sfx(e.crit ? 'crit' : e.heavy ? 'heavy' : e.rel === 'ke' ? 'ke' : 'hit', { volume: e.crit || e.heavy ? 1 : 0.8 });
      quake(e.heavy ? 9 : e.crit || e.rel === 'ke' ? 5 : 2.5);
      log(`${nm(e.actor)}命中${e.targetName ?? nm(e.target)}，${e.amount} 点伤害${e.rel === 'ke' ? `（${relText('ke', e.attackEl, e.targetEl)}，多打五成）` : e.rel === 'beike' ? '（受克，只剩六成六）' : ''}${e.crit ? '，暴击' : ''}`);
      if (e.rel === 'ke' && tutorial && target.side === 'enemy' && firstTime('coach-ke')) { coachHold = true; coach(COACH.ke); setTimeout(() => { coachHold = false; coach(null); }, ms(2600)); }
      if (e.crit) await wait(70);
    } else if (e.t === 'miss') {
      const el = els.get(e.target);
      el.body.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${side * 26}px,0)` }, { transform: 'translate(0,0)' }], { duration: Math.max(80, ms(300)) });
      float(e.target, '落空', 'miss');
      log(`${nm(e.actor)}的招式被${nm(e.target)}闪开`);
    } else if (e.t === 'ward') {
      const p = pt(e.target); fx.ward(p.x, p.y, ['#fff', '#ffd08a', '#ff8a3c']);
      float(e.target, '避火符挡下', 'note');
    } else if (e.t === 'heal') {
      const p = pt(e.target); fx.heal(p.x, p.y);
      float(e.target, `+${e.amount}`, 'heal', e.regen ? -20 : 0);
      if (!e.regen) audio.sfx('heal', { volume: 0.7 });
    } else if (e.t === 'mp') {
      float(e.target, `法力 +${e.amount}`, 'mp');
    } else if (e.t === 'buff') {
      const info = BUFF_INFO[e.buff];
      const u = unitById(state, e.target);
      const good = info.good === (u.side === 'party');
      const p = pt(e.target);
      if (e.buff === 'enrage') { fx.sparks(p.x, p.y, ['#ff5630', '#ffb38a', '#fff'], 16); float(e.target, `狂暴 ×${e.stacks ?? ''}`, 'burn', -30); } else {
        fx.aura(p.x, p.y + 10, good ? '木' : '火');
        float(e.target, info.name, 'note', -30);
      }
    } else if (e.t === 'resist') float(e.target, '没中招', 'miss');
    else if (e.t === 'immune') float(e.target, '定风', 'note');
    paint(e.target, e.snap?.[e.target]);
    if (e.actor && e.actor !== e.target) paint(e.actor, e.snap?.[e.actor]);
  }

  async function playAfter(e) {
    if (e.t === 'death') {
      const u = unitById(state, e.unit);
      const el = els.get(e.unit);
      if (!el) return;
      if (YIELDS.has(u.key) && u.side === 'enemy') {
        el.root.classList.add('yield');
        await anim(el.body, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,6%) scale(0.94,0.9)' }], { duration: 420 });
        float(e.unit, u.key === 'luosha' ? '罢手' : '伏地', 'note');
      } else if (u.side === 'party') {
        // 伙伴倒下留在原地：侧倒、褪色，一眼看得出谁倒了，回魂时再站起来
        const p = pt(e.unit); fx.smoke(p.x, p.y, { count: 10 });
        float(e.unit, '倒下', 'miss');
        await anim(el.body, [{ opacity: 1, transform: 'translate(0,0) rotate(0)' }, { opacity: 0.8, transform: 'translate(18%,12%) rotate(72deg)' }], { duration: 420, easing: 'ease-in' });
        el.root.classList.add('dead', 'fallen');
        log(`${u.name}倒下了`);
      } else {
        const p = pt(e.unit); fx.smoke(p.x, p.y, { count: 12 });
        await anim(el.body, [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: `translate(${u.side === 'enemy' ? -30 : 30}px,10px) rotate(${u.side === 'enemy' ? -8 : 8}deg)` }], { duration: 380 });
        el.root.classList.add('dead', 'gone');
        log(u.side === 'enemy' ? `${u.name}${e.rout ? '溃散' : '倒下'}` : `${u.name}倒下了`);
      }
      paint(e.unit, e.snap?.[e.unit]);
    } else if (e.t === 'rout') {
      audio.sfx('quest');
      await bannerLite(e.title, e.sub, 1400);
    } else if (e.t === 'field_break') {
      audio.sfx('quest');
      await bannerLite(`${e.name} · 已破`, '对面不再少受伤害');
    } else if (e.t === 'phase') {
      const p = pt(e.unit);
      audio.sfx('transform'); audio.sfx('heavy');
      fx.flash('#fff', 0.95); quake(12);
      fx.smoke(p.x, p.y, { count: 30 }); fx.smash(p.x, p.y + 40, { el: '土', big: true });
      await wait(260);
      paint(e.unit, e.snap?.[e.unit]);
      const el = els.get(e.unit);
      el.root.classList.remove('yield', 'dead');
      el.body.style.opacity = 1;
      anim(el.body, [{ transform: 'scale(0.5)', opacity: 0.2 }, { transform: 'scale(1.08)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.2,1.3,.4,1)' });
      await bannerLite(e.name, `现了原形，五行转${e.element}——克它的是${Object.keys(BEATS).find((k) => BEATS[k] === e.element)}`, 1700);
      await onBeat?.('phase');
    } else if (e.t === 'relief') {
      // 土地接力：土地立绘从右侧入场，在场伙伴逐个回血飘字，再退场
      audio.sfx('quest');
      const pic = h('div.dlg-figure.right.relief', { data: { ui: 'relief' }, style: { backgroundImage: `url(${unitArt(e.art)})`, height: '62%', zIndex: 11, bottom: '18%' } });
      root.append(pic);
      pic.animate([{ translate: '60% 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: ms(360), easing: 'ease-out', fill: 'forwards' });
      const names = e.heals.map((x) => nm(x.target)).join('、');
      log(`${e.name}接力：${names}各回三成气血`);
      const show = bannerLite(`${e.name}接力`, `山神地气护阵——在场伙伴各回 ${Math.round(e.pct * 100)}% 气血`, 1500);
      await Promise.all(e.heals.map((x, k) => wait(200 + k * 90).then(() => {
        const p = pt(x.target); fx.heal(p.x, p.y); float(x.target, `+${x.amount}`, 'heal');
      })));
      audio.sfx('heal');
      paintAll(e.snap);
      await show;
      await anim(pic, [{ translate: '0 0', opacity: 1 }, { translate: '40% 0', opacity: 0 }], { duration: 420, easing: 'ease-in' });
      pic.remove();
    } else if (e.t === 'summon') {
      const u = unitById(state, e.unit);
      mount(u, true);
      const p = pt(e.unit); fx.fire(p.x, p.y, true); audio.sfx('firefx');
      float(e.unit, '援兵', 'note');
      await wait(320);
    } else if (e.t === 'revive') {
      const el = els.get(e.target);
      el.root.classList.remove('dead', 'gone', 'fallen');
      el.body.style.opacity = 1;
      el.body.getAnimations().forEach((a) => a.cancel());
      paint(e.target, e.snap?.[e.target]);
      const p = pt(e.target); fx.heal(p.x, p.y); audio.sfx('heal');
      float(e.target, '回魂', 'heal');
      await wait(380);
    } else if (e.t === 'caught') {
      const el = els.get(e.target);
      const p = pt(e.target); fx.ring(p.x, p.y, { el: '金', r: 110, life: 0.5, squash: 0.5 }); fx.sparks(p.x, p.y, ['#fff3b0', '#f2c94c', '#fff'], 22);
      audio.sfx('levelup');
      float(e.target, '收服！', 'heal');
      await anim(el.body, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.1) rotate(200deg)', opacity: 0 }], { duration: 520, easing: 'ease-in' });
      el.root.classList.add('dead', 'gone');
      log(`${nm(e.target)}被捕妖绳收服，取胜后带回`);
    } else if (e.t === 'catch_fail') {
      const p = pt(e.target); fx.ring(p.x, p.y, { el: '金', r: 90, life: 0.35, squash: 0.5 });
      float(e.target, '挣脱了', 'miss');
      await wait(360);
    }
  }

  async function bannerLite(title, sub = '', hold = 1100) {
    const el = h('div.banner', {}, h('b', {}, title), sub && h('span', {}, sub));
    const stay = holdFor(hold, `${title}${sub}`); // 按字数给足阅读时间
    el.style.animationDuration = `${stay + ms(500)}ms`;
    root.append(el);
    await waitReal(stay);
    setTimeout(() => el.remove(), ms(500));
  }

  async function playAction(e, group) {
    const actor = unitById(state, e.actor);
    const el5 = actor.element;
    callout(actor, e.name, e.heavy ? '蓄力重击' : '');
    audio.sfx(e.basic ? 'thud' : 'skill', { volume: 0.55 });
    const impacts = group.filter((g) => IMPACT.has(g.t));
    const after = group.filter((g) => !IMPACT.has(g.t));
    const targets = e.targets.filter((id) => els.has(id));
    const playImpacts = async () => { await Promise.all(impacts.map((g, i) => wait(i * 70).then(() => showImpact(g, e)))); };
    const foeSide = actor.side === 'party' ? 'enemy' : 'party';
    if (!targets.length) { await castPose(e.actor, el5); await playImpacts(); } else if (e.kind === 'phy' && e.area === 'enemy') {
      const first = impacts.find((g) => g.t === 'damage' || g.t === 'miss');
      const to = pt(first?.target ?? targets[0], 'feet');
      await lunge(e.actor, to, () => { playImpacts(); }, !!e.heavy);
      await wait(impacts.length * 70 + 60);
    } else if (e.kind === 'phy') {
      const pts = targets.map((id) => pt(id, 'feet'));
      const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length, cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
      const xs = pts.map((p) => p.x);
      await lunge(e.actor, { x: cx + (actor.side === 'party' ? 90 : -90), y: cy }, () => {
        fx.sweep(actor.side === 'party' ? Math.max(...xs) + 80 : Math.min(...xs) - 80, actor.side === 'party' ? Math.min(...xs) - 80 : Math.max(...xs) + 80, cy - 90, { el: el5 });
        if (e.fx === 'quake') { fx.ring(cx, cy, { el: '土', r: 260, squash: 0.35 }); quake(7); }
        playImpacts();
      });
      await wait(impacts.length * 70 + 60);
    } else {
      await castPose(e.actor, el5);
      const from = pt(e.actor);
      const hostile = targets.some((id) => unitById(state, id).side === foeSide);
      if (hostile) {
        if (e.fx === 'gale') { fx.gale(actor.side === 'enemy' ? 1 : -1); audio.sfx('fan2', { volume: 0.6 }); await wait(260); } else if (e.fx === 'wave' && targets.length > 1) {
          const xs = targets.map((id) => pt(id).x), y = pt(targets[0], 'feet').y;
          fx.wave(from.x, actor.side === 'party' ? Math.min(...xs) - 60 : Math.max(...xs) + 60, y - 30); audio.sfx('waterfx'); await wait(300);
        } else {
          const boltEl = { fire: '火', firewave: '火', ice: '水', wave: '水', gaze: '金', charm: '木', silk: '木' }[e.fx] ?? el5;
          const durs = targets.map((id) => { const p = pt(id); return fx.bolt(from.x, from.y, p.x, p.y, { el: boltEl }); });
          await wait(Math.max(...durs) * 1000);
        }
      } else if (e.fx === 'ward') { for (const id of targets) { const p = pt(id); fx.ward(p.x, p.y); } audio.sfx('heal', { volume: 0.5, rate: 0.8 }); await wait(200); }
      await playImpacts();
    }
    const lastSnap = group.length ? group[group.length - 1].snap : e.snap;
    for (const g of after) await playAfter(g);
    paintAll(lastSnap);
    setPins();
    await wait(240);
  }

  async function playFan(e) {
    const texts = [
      ['假扇', '扇中蹿出烈火！火妖借着火势，攻势更凶'],
      ['第一扇 · 息火', '敌方增益尽散，攻势顿挫'],
      ['第二扇 · 生风', '清风助阵，全队出手加快'],
      ['第三扇 · 落雨', '甘霖疗伤，敌阵露出破绽——趁现在'],
    ][e.stage];
    const weather = ['fire', 'ash', 'wind', 'rain'][e.stage];
    audio.sfx(['firefx', 'fan1', 'fan2', 'fan3'][e.stage]);
    fx.flash(e.stage === 0 ? '#ff7a30' : '#eafff8', 0.7);
    fx.weather(weather, 2.4 * pace.factor + 0.4);
    quake(e.stage === 0 ? 8 : 5);
    await bannerLite(texts[0], texts[1], 1500);
    log(`${texts[0]}：${texts[1]}`);
    if (e.stage === 3) fx.tint('rgba(40,90,130,.12)');
  }

  async function playEvent(e) {
    switch (e.t) {
      case 'round': shownRound = e.round; buildOrder(e.queue); refreshChips(); break;
      case 'turn': {
        for (const el of els.values()) el.root.classList.remove('active');
        els.get(e.unit)?.root.classList.add('active');
        const el = els.get(e.unit); if (el) el.queued = null;
        setPins();
        orderBar.querySelectorAll('.order-item').forEach((n) => { if (n.classList.contains('now')) { n.classList.remove('now'); n.classList.add('done'); } if (n.dataset.id === e.unit) n.classList.add('now'); });
        paintAll(e.snap);
        await wait(120);
        break;
      }
      case 'stunned': float(e.unit, '动弹不得', 'miss'); await wait(420); break;
      case 'finisher_hold': {
        paint(e.unit, e.snap?.[e.unit]);
        float(e.unit, '护身退开', 'note', -44);
        log(`${nm(e.unit)}护身退开半步，已露疲态——下回合轮到悟空时可以变化`);
        await wait(360); break;
      }
      case 'defend': {
        const p = pt(e.unit); fx.ward(p.x, p.y);
        callout(unitById(state, e.unit), '防御');
        float(e.unit, e.mp ? `防御 · 法力 +${e.mp}` : '防御', 'note');
        paintAll(e.snap); await wait(420); break;
      }
      case 'protect': callout(unitById(state, e.unit), '保护', nm(e.target)); float(e.unit, `护住${nm(e.target)}`, 'note'); await wait(420); break;
      case 'item': {
        const u = unitById(state, e.actor);
        callout(u, labels(e.item).name, '道具');
        audio.sfx('click');
        await castPose(e.actor, u.element);
        break;
      }
      case 'fan': await playFan(e); paintAll(e.snap); break;
      case 'info': {
        const map = { no_item: '行囊里没有了', revive_none: '没有倒下的伙伴', catch_none: '这个收不了', catch_hp: '气血还盛，捆不住', fan_done: '三扇已尽', fallback: '法力不够，改用普通攻击' };
        if (e.unit && els.has(e.unit)) float(e.unit, map[e.text] ?? '', 'note'); else toast(map[e.text] ?? '');
        await wait(420); break;
      }
      case 'transform': {
        const p = pt(e.actor);
        audio.sfx('transform'); fx.smoke(p.x, p.y, { count: 22 }); fx.flash('#fff', 0.35);
        callout(unitById(state, e.actor), `七十二变 · ${e.name}`);
        await wait(200);
        paintAll(e.snap);
        const el = els.get(e.actor);
        anim(el.body, [{ transform: 'scale(0.6) rotate(-8deg)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        float(e.actor, `化身为${e.element}`, 'note');
        log(`悟空变作${e.name}，五行转${e.element}`);
        await wait(520); break;
      }
      case 'form_end': {
        const p = pt(e.unit); fx.smoke(p.x, p.y, { count: 14 }); audio.sfx('transform', { volume: 0.5 });
        paintAll(e.snap); float(e.unit, '变回本相', 'note'); await wait(360); break;
      }
      case 'finisher': {
        const a = pt(e.actor), b = pt(e.target, 'head');
        fx.weather('dark', 2.2 * pace.factor + 0.3);
        const bug = els.get(e.actor);
        await anim(bug.body, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${(b.x - a.x) * 0.5}px,${-120}px) scale(0.5)`, offset: 0.5 }, { transform: `translate(${b.x - a.x}px,${b.y - a.y + 60}px) scale(0.08)` }], { duration: 900, easing: 'ease-in-out' });
        audio.sfx('ke');
        const boss = els.get(e.target);
        boss.body.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-8px,0) rotate(-3deg)' }, { transform: 'translate(8px,0) rotate(3deg)' }, { transform: 'translate(-6px,0)' }, { transform: 'translate(0,0)' }], { duration: Math.max(120, ms(700)) });
        float(e.target, '钻入腹中！', 'ke');
        await bannerLite('化虫入腹', '智取胜过蛮打', 1300);
        bug.body.getAnimations().forEach((x) => x.cancel());
        break;
      }
      case 'telegraph': {
        audio.sfx('telegraph');
        const p = pt(e.unit); fx.ring(p.x, p.y, { el: '火', r: 200, life: 0.8 }); fx.sparks(p.x, p.y, ['#ff5630', '#ffd08a', '#fff'], 24);
        paintAll(e.snap); setPins();
        await bannerLite(`${nm(e.unit)}蓄力`, `下回合「${e.name}」锁定${e.target ? nm(e.target) : '气血最少的人'}：防御、补血或保护`, 1500);
        break;
      }
      case 'assist': {
        audio.sfx('quest');
        const pic = h('div.dlg-figure.right', { style: { backgroundImage: `url(${unitArt(e.art)})`, height: '70%', zIndex: 11, bottom: '18%' } });
        root.append(pic);
        pic.animate([{ translate: '60% 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: ms(360), easing: 'ease-out' });
        await bannerLite(`${e.name}助阵`, '天兵四面合围', 1200);
        await onBeat?.('assist');
        const p = pt(e.target); fx.fire(p.x, p.y, true); fx.smash(p.x, p.y + 30, { el: '火', big: true }); audio.sfx('heavy'); quake(8);
        hitReact(e.target, 1.6, -1); float(e.target, `-${e.amount}`, 'crit');
        paintAll(e.snap);
        await wait(500);
        pic.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(300), fill: 'forwards' }).finished.then(() => pic.remove());
        break;
      }
      case 'burn': {
        const p = pt(e.target); fx.fire(p.x, p.y + 40); float(e.target, `地火 -${e.amount}`, 'burn');
        hitReact(e.target, 0.5, 1); paint(e.target, e.snap?.[e.target]);
        break;
      }
      case 'story_exit': {
        coach(null);
        if (e.kind === 'blow') {
          const boss = unitById(state, e.actor);
          callout(boss, '芭蕉扇', '捻诀一扇');
          await castPose(e.actor, '木');
          audio.sfx('fan2'); fx.gale(1); fx.flash('#eafff5', 0.6); quake(10);
          fx.weather('wind', 1.6 * pace.factor + 0.3);
          const hero = alive(state, 'party').find((u) => u.key === 'wukong') ?? alive(state, 'party')[0];
          if (hero) await anim(els.get(hero.id).body, [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(40vw,-70vh) rotate(720deg) scale(0.3)', opacity: 0.2 }], { duration: 900, easing: 'cubic-bezier(.4,0,.9,.5)' });
          await bannerLite('一扇吹出五万里', '', 1300);
        } else {
          const boss = unitById(state, e.actor);
          callout(boss, '罢战', '赴碧波潭之宴');
          await anim(els.get(e.actor).body, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(-40vw,-6vh)', opacity: 0 }], { duration: 900, easing: 'ease-in' });
          await bannerLite('牛魔王罢战赴宴', '', 1200);
        }
        break;
      }
      case 'flee': {
        if (e.ok) {
          audio.sfx('step');
          await Promise.all(alive(state, 'party').map((u) => anim(els.get(u.id).body, [{ transform: 'translate(0,0)' }, { transform: 'translate(50vw,0)', opacity: 0 }], { duration: 520, easing: 'ease-in' })));
        } else { float(e.unit, state.def.boss ? '此战退不得' : '没能脱身', 'miss'); await wait(460); }
        break;
      }
      case 'end': break;
      default:
        if (RESULT.has(e.t)) { if (IMPACT.has(e.t)) await showImpact(e, null); else await playAfter(e); }
    }
  }

  let coachHold = false;
  async function play(events) {
    root.dataset.phase = 'playing';
    refreshChips();
    for (let i = 0; i < events.length; i += 1) {
      if (destroyed) return;
      const e = events[i];
      if (e.t === 'action') {
        const group = [];
        let j = i + 1;
        while (j < events.length && RESULT.has(events[j].t)) { group.push(events[j]); j += 1; }
        await playAction(e, group);
        i = j - 1;
        continue;
      }
      if (e.t === 'buff' || e.t === 'burn' || (e.t === 'heal' && e.reinforce)) {
        // 同类事件连着来（真扇、地火、接力回血）就一起演
        const batch = [e];
        while (i + 1 < events.length && events[i + 1].t === e.t) { batch.push(events[i + 1]); i += 1; }
        if (e.t === 'burn') audio.sfx('firefx', { volume: 0.6 });
        await Promise.all(batch.map((b, k) => wait(k * 50).then(() => (b.t === 'burn' ? playEvent(b) : showImpact(b, null)))));
        paintAll(batch[batch.length - 1].snap);
        await wait(360);
        continue;
      }
      await playEvent(e);
    }
    for (const el of els.values()) { el.root.classList.remove('active'); el.rel = null; }
    setPins();
  }

  // ---------- 下令 ----------
  function showPreview(u, skill, target) {
    const slot = panel.querySelector('.cmd-preview');
    if (slot) clear(slot);
    if (!slot || !skill || !target) return;
    const bits = [h('i', {}, '→'), h('span', {}, target.name)];
    if (skill.mul > 0) {
      const pv = previewDamage(state, u, target, skill);
      bits.push(h('span', {}, `约 ${pv.min}–${pv.max}`));
      if (pv.rel !== 'none') bits.push(h(`span.rel-${pv.rel}`, {}, pv.rel === 'ke' ? `${u.element}克${target.element} ×1.5` : `受克 ×0.66`));
      bits.push(h('i', {}, `命中 ${Math.round(pv.hit * 100)}%`));
    }
    slot.append(...bits);
  }

  function describe(cmd) {
    if (!cmd) return '';
    switch (cmd.type) {
      case 'attack': return `攻击 → ${nm(cmd.targetId)}`;
      case 'skill': return `${skillOf({ skillLevels: {} }, cmd.skillId).name}${cmd.targetId ? ` → ${nm(cmd.targetId)}` : ''}`;
      case 'stunt': return STUNTS[cmd.stuntId].name;
      case 'defend': return '防御';
      case 'protect': return `保护 ${nm(cmd.targetId)}`;
      case 'item': return `${labels(cmd.itemId).name}${cmd.targetId ? ` → ${nm(cmd.targetId)}` : ''}`;
      case 'transform': return `变 ${FORMS[cmd.formId].name}`;
      case 'flee': return '逃跑';
      case 'auto': return '自行应战';
      default: return '';
    }
  }

  function collectCommands() {
    return new Promise((resolve) => {
      root.dataset.phase = 'command'; place.querySelector('.where')?.classList.add('hidden');
      refreshChips();
      const order = alive(state, 'party');
      const cmds = {};
      let idx = 0, cleanup = [];
      // 指令台刚亮起时不认点击：进战前连点对白、或连点上回合演出的余波，不该替头一位伙伴下令
      const guard = armGuard(panel, commandPhases === 0 ? 600 : 350);
      commandPhases += 1;
      const finish = (result) => { guard.off(); commandAbort = null; clearTargets(); window.removeEventListener('keydown', onKey); coach(null); showPreview(null); root.dataset.turn = ''; resolve(result); };
      commandAbort = () => finish(Object.fromEntries(order.map((u) => [u.id, { type: 'auto' }])));

      function clearTargets() {
        for (const fn of cleanup) fn();
        cleanup = [];
        for (const el of els.values()) { el.root.classList.remove('targetable', 'hover'); el.rel = null; }
        setPins();
        showPreview(null);
      }
      function setActive(u) {
        for (const [id, el] of els) el.root.classList.toggle('active', id === u.id);
        setPins();
        root.dataset.turn = u.id;
      }
      function commit(u, cmd) {
        cmds[u.id] = cmd;
        els.get(u.id).queued = describe(cmd);
        audio.sfx('click');
        idx += 1;
        clearTargets();
        if (idx >= order.length) { for (const u2 of order) last[u2.key] = cmds[u2.id]; finish(cmds); } else showMain();
      }
      function back() {
        clearTargets();
        if (panel.dataset.mode !== 'main') { showMain(); return; }
        if (idx > 0) { idx -= 1; delete cmds[order[idx].id]; els.get(order[idx].id).queued = null; showMain(); }
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); back(); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'PageUp' || e.key === 'PageDown') {
          const flipBtn = panel.querySelector(`.cmd-pager [data-page="${e.key === 'ArrowLeft' || e.key === 'PageUp' ? 'prev' : 'next'}"]:not(:disabled)`);
          if (flipBtn) { e.preventDefault(); flipBtn.click(); }
          return;
        }
        const n = Number(e.key);
        if (n >= 1 && n <= 9 && guard.ready()) {
          const btns = [...panel.querySelectorAll('.cmd:not(:disabled), .cmd-row:not(:disabled)')];
          if (btns[n - 1]) { e.preventDefault(); btns[n - 1].click(); }
        }
      }
      window.addEventListener('keydown', onKey);

      function who(u) {
        const wheel = h('div.wheel', { title: '金克木 · 木克土 · 土克水 · 水克火 · 火克金' }, ELEMENTS.flatMap((el, i) => [h(`span.el${u.element === el ? '.me' : ''}`, { data: { el }, title: el }, el), i < 4 ? h('span', {}, '›') : null]));
        return h('div.cmd-who', {},
          h('div.face.square', { style: faceStyle(els.get(u.id).art) }),
          h('h3', {}, u.name, h('span.el', { data: { el: u.element } }, u.element)),
          h('div.stats', {}, h('div.bar.hp', {}, h('i.fill', { style: { width: `${(u.hp / u.maxHp) * 100}%` } }), h('b', {}, `${u.hp}/${u.maxHp}`)), h('div.bar.mp', {}, h('i.fill', { style: { width: `${(u.mp / Math.max(1, u.maxMp)) * 100}%` } }), h('b', {}, `法 ${u.mp}/${u.maxMp}`)), h('div.bar.sp', {}, h('i.fill', { style: { width: `${(u.sp / 150) * 100}%` } }), h('b', {}, `怒 ${u.sp}`))),
          wheel);
      }
      function side(extra = null) {
        const win = def.winOn;
        const goal = def.finisher && finisherOpen(state) ? def.finisher.goalOpen : win && alive(state, 'enemy').some((x) => x.key === win.key) ? win.goal : def.goal;
        const rows = order.slice(0, idx).map((u) => h('div', {}, h('b', {}, u.name), describe(cmds[u.id])));
        // 子菜单里侧栏只放招式说明（已下令的人头顶有标签），主菜单才放「已下令」与「此战」，免得互相挤压截断
        return h('div.cmd-side', {}, extra, rows.length > 0 && h('h4', {}, '已下令'), h('div.queued', {}, rows), goal && h('div.goal', {}, h('h4', {}, '此战'), h('span', { data: { ui: 'battle-goal' } }, goal)));
      }
      function frame(u, mode, title, content, extra = null) {
        panel.dataset.mode = mode;
        clear(panelBody).append(who(u), h('div.cmd-main', {}, title, content), side(extra));
      }
      const previewSlot = () => h('span.cmd-preview', { data: { ui: 'preview' } });
      // 子菜单：一页排满就翻页，不出滚动条。格子里只有名字与代价，说明放在侧栏（窄屏在标题下一行）
      const elTag = (el) => h('span.el', { data: { el }, title: `五行属${el}` }, el);
      const chip = (sel, attrs, { head, label, cost = '', costCls = '', desc = '' }) => {
        const row = h(`button.cmd-row${sel}`, { type: 'button', ...attrs }, h('b', {}, head), cost && h(`em${costCls}`, {}, cost), h('span', {}, desc));
        row.info = { label, cost, costCls, desc };
        return row;
      };
      function listFrame(u, mode, text, rows, { empty = '', kind = 'pick' } = {}) {
        const cap = kind === 'target' ? 4 : matchMedia('(max-width: 700px)').matches ? 6 : 8;
        const pages = Math.max(1, Math.ceil(rows.length / cap));
        const lit = rows.findIndex((r) => r.classList.contains('glow'));
        let page = lit < 0 ? 0 : Math.floor(lit / cap);
        const grid = h('div.cmd-list', { data: { kind } });
        const details = [h('div.cmd-detail', { data: { ui: 'detail' } }), h('div.cmd-detail.inline')];
        const setDetail = (row) => {
          for (const r of rows) r.classList.toggle('sel', r === row);
          for (const d of details) {
            clear(d);
            if (row?.info) d.append(...[h('b', {}, row.info.label), row.info.cost ? h(`em${row.info.costCls}`, {}, row.info.cost) : null, h('p', {}, row.info.desc)].filter(Boolean));
          }
        };
        for (const row of rows) for (const ev of ['pointerenter', 'pointerdown', 'focus']) row.addEventListener(ev, () => setDetail(row));
        const label = h('span', {});
        const flip = (d) => { page = Math.min(pages - 1, Math.max(0, page + d)); draw(); audio.sfx('click'); };
        const prev = h('button.btn.small', { type: 'button', data: { page: 'prev' }, 'aria-label': '上一页', onclick: () => flip(-1) }, '‹');
        const next = h('button.btn.small', { type: 'button', data: { page: 'next' }, 'aria-label': '下一页', onclick: () => flip(1) }, '›');
        const pager = pages > 1 ? h('div.cmd-pager', {}, prev, label, next) : null;
        function draw() {
          const shown = rows.slice(page * cap, page * cap + cap);
          clear(grid).append(...(shown.length ? shown : [h('div.muted', {}, empty)]));
          label.textContent = `${page + 1} / ${pages}`;
          prev.disabled = page === 0;
          next.disabled = page === pages - 1;
          setDetail(shown.find((r) => r.classList.contains('glow')) ?? shown.find((r) => !r.disabled) ?? shown[0] ?? null);
        }
        const title = titleBar(u, text);
        if (pager) title.insertBefore(pager, title.querySelector('[data-cmd="back"]'));
        draw();
        frame(u, mode, title, h('div.cmd-body', {}, details[1], grid), kind === 'target' ? null : details[0]);
      }
      const titleBar = (u, text, sub = true) => h('div.cmd-title', {}, h('b', {}, u.name), h('span', {}, text), previewSlot(), (sub || idx > 0) && h('button.btn.small', { type: 'button', data: { cmd: 'back' }, onclick: sub ? () => { clearTargets(); showMain(); } : back }, sub ? '返回' : '改上一位'));

      function showMain() {
        const u = order[idx];
        setActive(u);
        panel.dataset.mode = 'main';
        const firstLook = tutorial && state.round === 1 && !u.expanded;
        const weary = finisherOpen(state) && u.hasTransform;
        const boss = chargingBoss(state);
        const fanDue = fanPrompt(state, Object.values(cmds));
        const btn = (key, label, iconKey, fn, { minor = false, disabled = false, glow = false, tip = '' } = {}) => h(`button.cmd${minor ? '.minor' : ''}${glow ? '.glow' : ''}`, { type: 'button', data: { cmd: key }, disabled, title: tip, onclick: fn }, iconKey && h('img', { src: uiArt(iconKey), alt: '' }), label);
        const list = [
          btn('attack', '攻击', 'attack', () => pickTarget(u, 'enemy', BASIC_ATTACK, (t) => ({ type: 'attack', targetId: t }))),
          btn('skill', '法术', 'spell', () => showSkills(u)),
          btn('defend', '防御', 'defend', () => commit(u, { type: 'defend' }), { tip: '这回合受伤减半，回一成法力' }),
        ];
        if (!firstLook) {
          list.push(
            btn('item', '道具', 'bag', () => showItems(u), { glow: fanDue }),
            btn('special', '特技', 'special', () => showSpecial(u), { glow: weary }),
            btn('protect', '保护', null, () => pickTarget(u, 'ally-other', null, (t) => ({ type: 'protect', targetId: t }), '替谁挡这回合的单体攻击？'), { minor: true, disabled: order.length < 2, tip: '替一位伙伴挡下打向他的单体攻击，自己受七成', glow: !!boss && heavyTarget(state)?.id !== u.id }),
            repeatBtn(u, btn),
            btn('auto', '自动', null, () => commit(u, { type: 'auto' }), { minor: true, tip: def.boss ? '这一战自动只会普通攻击，不会动用真扇' : '这回合让他自己拿主意' }),
            btn('flee', '逃跑', null, () => commit(u, { type: 'flee' }), { minor: true, disabled: !!def.boss, tip: def.boss ? '此战退不得' : '七成机会脱身，回场景再来' }),
          );
        } else list.push(btn('more', '全部指令', null, () => { u.expanded = true; showMain(); }, { minor: true }));
        const grid = h('div.cmd-grid', {}, list);
        frame(u, 'main', titleBar(u, '下令', false), grid);
        if (tutorial && state.round === 1) {
          const tip = { wukong: COACH.wukong1, bajie: COACH.bajie1, sha: COACH.sha1 }[u.key];
          const anchor = { wukong: 'attack', bajie: 'skill', sha: 'defend' }[u.key];
          const at = grid.querySelector(`[data-cmd="${anchor}"]`);
          at?.classList.add('glow');
          if (tip) coach(tip);
        } else if (tutorial && state.round === 2 && idx === 0 && firstTime('coach-round2')) coach(COACH.round2);
        // 决战真扇：真扇一扇未出时每次下令在底栏点明，直到有人领扇或扇出第一扇
        else if (fanDue) coach(COACH.fan);
        else if (weary && firstTime(`coach-weary-${state.seed}`)) coach(COACH.weary);
        else if (def.field?.kind === 'burn' && u.hasTransform && state.round === 1 && firstTime('coach-burn')) coach(COACH.burn);
        else if (!coachHold) coach(null);
        warn(boss ? `蓄力锁定：${heavyTarget(state)?.name ?? ''}（防御/保护）` : null);
      }

      // 「沿用」把要沿用的那条指令写在按钮上；沿用道具会再耗一件，标出余量
      function repeatBtn(u, btn) {
        if (!last[u.key]) return btn('repeat', '沿用', null, null, { minor: true, disabled: true, tip: '上回合还没有指令' });
        const c = repeatOf(u);
        const useItem = c.type === 'item';
        const left = useItem ? state.items[c.itemId] ?? 0 : 0;
        const b = btn('repeat', '沿用', null, () => commit(u, c), { minor: true, tip: `沿用：${describe(c)}${useItem ? `（再耗一件，剩 ${left}）` : ''}` });
        b.classList.add('repeat');
        if (useItem) b.classList.add('costly');
        b.append(h('small', { data: { ui: 'repeat-what' } }, `${describe(c)}${useItem ? ` · 剩${left}` : ''}`));
        return b;
      }
      function repeatOf(u) {
        const c = { ...last[u.key] };
        const t = unitById(state, c.targetId);
        if (c.type === 'skill') { const s = skillOf(u, c.skillId); if (!s || !usableSkills(u).includes(c.skillId) || s.mp > u.mp) return { type: 'attack', targetId: alive(state, 'enemy')[0].id }; }
        if (c.type === 'stunt' && u.sp < STUNTS[c.stuntId].sp) return { type: 'attack', targetId: alive(state, 'enemy')[0].id };
        if (c.type === 'item' && !(state.items[c.itemId] > 0)) return { type: 'defend' };
        // 回血、回蓝的药：对象已经满了就不再白吃一件，改为防御（按钮上照实写出）
        if (c.type === 'item' && t?.alive && ((ITEMS[c.itemId]?.type === 'heal' && t.hp >= t.maxHp) || (ITEMS[c.itemId]?.type === 'mp' && t.mp >= t.maxMp))) return { type: 'defend' };
        if (c.targetId && (!t || !t.alive)) c.targetId = (t?.side === 'party' ? u : alive(state, 'enemy')[0]).id;
        return c;
      }

      function showSkills(u) {
        coach(null);
        const rows = usableSkills(u).map((id) => {
          const s = skillOf(u, id);
          const rank = u.skillLevels?.[id] ?? 1;
          return chip('', { data: { skill: id }, disabled: s.mp > u.mp, onclick: () => castChoice(u, s, (t) => ({ type: 'skill', skillId: id, targetId: t })) },
            { head: [s.name, rank > 1 && h('span.pin.ke', {}, `${rank} 重`)], label: s.name, cost: s.mp ? `法力 ${s.mp}` : '不耗法力', desc: s.desc });
        });
        listFrame(u, 'skills', '法术', rows);
      }
      function castChoice(u, s, make) {
        if (s.target === 'enemy') pickTarget(u, 'enemy', s, make);
        else if (s.target === 'ally') pickTarget(u, 'ally', s, make);
        else commit(u, make(undefined));
      }
      function showItems(u) {
        coach(null);
        // 本场带进来的道具用完也留在原格（灰掉、写明用尽），免得后面的格子往前挪、玩家按老位置点空
        const keys = Object.keys(state.items).filter((k) => ITEMS[k] && (state.items[k] > 0 || brought.has(k))).sort((a, b) => Number(ITEMS[b].type.endsWith('fan')) - Number(ITEMS[a].type.endsWith('fan')));
        const rows = keys.map((k) => {
          const it = ITEMS[k]; const lb = labels(k);
          const fan = k === 'truefan';
          const out = !(state.items[k] > 0);
          const name = fan ? `真扇 · ${['一扇息火', '二扇生风', '三扇落雨'][state.fanStage] ?? '三扇已尽'}` : lb.name;
          const desc = out ? (fan ? '三扇都已扇出。' : '本场已用尽。') : fan ? ['散去敌方增益，敌方攻击降三成。', '全队速度提高三成。', '全队持续回血；敌方破防，且受伤多六成。'][state.fanStage] : lb.desc;
          const go = () => {
            if (it.target === 'ally') pickTarget(u, 'ally', null, (t) => ({ type: 'item', itemId: k, targetId: t }), `${lb.name}给谁？`);
            else if (it.target === 'fallen') pickTarget(u, 'fallen', null, (t) => ({ type: 'item', itemId: k, targetId: t }), '救起谁？');
            else if (it.target === 'enemy') pickTarget(u, 'catch', null, (t) => ({ type: 'item', itemId: k, targetId: t }), '捆哪一个？气血四成以下才捆得住');
            else commit(u, { type: 'item', itemId: k });
          };
          const noFallen = it.target === 'fallen' && !state.units.some((x) => x.side === 'party' && !x.alive);
          const noCatch = it.type === 'catch' && !alive(state, 'enemy').some((x) => x.catchKey);
          return chip(fan && !out ? '.glow' : '', { data: { item: k }, disabled: out || noFallen || noCatch, onclick: go },
            { head: [h('img', { src: itemArt(k), alt: '' }), name], label: name, cost: `×${state.items[k]}`, costCls: '.n', desc });
        });
        listFrame(u, 'items', '道具', rows, { empty: '行囊里没有能用的东西。' });
      }
      function showSpecial(u) {
        coach(null);
        const rows = [];
        if (u.hasTransform) {
          const foes = alive(state, 'enemy');
          for (const [fid, f] of Object.entries(FORMS)) {
            const beats = foes.filter((x) => BEATS[f.element] === x.element).length;
            const fin = finisherOpen(state) && fid === 'chongzi';
            rows.push(chip(fin ? '.glow' : '', { data: { form: fid }, disabled: u.form?.id === fid, onclick: () => commit(u, { type: 'transform', formId: fid }) },
              { head: [elTag(f.element), f.name, beats > 0 && h('span.pin.ke', {}, `克 ${beats} 敌`)], label: f.name, cost: '变化 · 三回合', costCls: '.n',
                desc: fin ? '罗刹女已气喘：变作小虫钻进她腹中，一招取胜。' : def.finisher && fid === 'chongzi' ? `${f.desc}罗刹女气血降到四成五以下时变它，可钻进她腹中取胜。` : f.desc }));
          }
        }
        for (const [sid, st] of Object.entries(STUNTS)) {
          rows.push(chip('', { data: { stunt: sid }, disabled: u.sp < st.sp, onclick: () => castChoice(u, st, (t) => ({ type: 'stunt', stuntId: sid, targetId: t })) },
            { head: [st.name], label: st.name, cost: `愤怒 ${st.sp}`, costCls: '.sp', desc: st.desc }));
        }
        listFrame(u, 'special', u.hasTransform ? '特技 · 七十二变不耗法力，占这回合行动' : '特技 · 挨打攒愤怒', rows);
      }

      function pickTarget(u, kind, skill, make, prompt = null) {
        coach(null);
        clearTargets();
        let pool;
        if (kind === 'enemy') pool = alive(state, 'enemy');
        else if (kind === 'catch') pool = alive(state, 'enemy').filter((x) => x.catchKey);
        else if (kind === 'ally') pool = alive(state, 'party');
        else if (kind === 'ally-other') pool = alive(state, 'party').filter((x) => x.id !== u.id);
        else pool = state.units.filter((x) => x.side === 'party' && !x.alive && !x.caught);
        if (!pool.length) { toast('没有可选的目标'); showMain(); return; }
        const hostile = kind === 'enemy' || kind === 'catch';
        const rows = pool.map((t) => {
          const rel = hostile && skill?.mul > 0 ? relation(u.element, t.element) : 'none';
          const pv = hostile && skill?.mul > 0 ? previewDamage(state, u, t, skill) : null;
          const row = chip('', { data: { target: t.id }, onclick: () => commit(u, make(t.id)) },
            { head: [elTag(t.element), t.name, rel === 'ke' && h('span.pin.ke', {}, '克制'), rel === 'beike' && h('span.pin.beike', {}, '受克')], label: t.name,
              cost: `气血 ${Math.round((t.hp / t.maxHp) * 100)}%`, costCls: '.n', desc: pv ? `约 ${pv.min}–${pv.max} 点，命中 ${Math.round(pv.hit * 100)}%` : `${t.hp}/${t.maxHp}` });
          row.addEventListener('pointerenter', () => { showPreview(u, skill, t); els.get(t.id)?.root.classList.add('hover'); });
          row.addEventListener('pointerleave', () => els.get(t.id)?.root.classList.remove('hover'));
          return row;
        });
        listFrame(u, 'target', prompt ?? `${skill?.name ?? ''}：点选${hostile ? '敌人' : '伙伴'}`, rows, { kind: 'target' });
        for (const t of pool) {
          const el = els.get(t.id);
          if (!el) continue;
          el.root.classList.add('targetable');
          if (kind === 'fallen') el.root.classList.remove('gone');
          if (hostile && skill?.mul > 0) { const rel = relation(u.element, t.element); el.rel = rel === 'none' ? null : rel; }
          const click = (ev) => { ev.stopPropagation(); commit(u, make(t.id)); };
          const enter = () => { el.root.classList.add('hover'); showPreview(u, skill, t); };
          const leave = () => el.root.classList.remove('hover');
          el.hit.addEventListener('click', click); el.hit.addEventListener('pointerenter', enter); el.hit.addEventListener('pointerleave', leave);
          cleanup.push(() => { el.hit.removeEventListener('click', click); el.hit.removeEventListener('pointerenter', enter); el.hit.removeEventListener('pointerleave', leave); if (kind === 'fallen' && !t.alive && !el.root.classList.contains('fallen')) el.root.classList.add('gone'); });
        }
        setPins();
        if (pool.length === 1 && hostile) showPreview(u, skill, pool[0]);
      }

      showMain();
    });
  }

  // ---------- 顶栏按钮 ----------
  formationChip.addEventListener('click', () => {
    const next = state.formation === 'tiangang' ? 'liuding' : 'tiangang';
    if (!switchFormation(state, next)) return;
    audio.sfx('quest', { volume: 0.6 });
    const f = FORMATIONS[next];
    toast(`换成${f.name}：${f.gain}；${f.cost}`);
    buildOrder(actionQueue(state));
    refreshChips();
  });
  autoChip.addEventListener('click', () => {
    autoAll = !autoAll;
    refreshChips();
    if (autoAll && commandAbort) commandAbort();
  });
  speedChip.addEventListener('click', () => {
    settings.speed = settings.speed === 2 ? 1 : 2; pace.speed = settings.speed; saveSettings(); refreshChips();
  });

  // ---------- 主循环 ----------
  async function loop() {
    for (const u of state.units) mount(u);
    layout();
    refreshChips();
    buildOrder(actionQueue(state));
    clear(panelBody).append(h('div.cmd-wait', {}, def.name));
    for (const u of state.units) {
      const el = els.get(u.id);
      el.body.animate([{ transform: `translate(${u.side === 'enemy' ? -60 : 60}vw,0)` }, { transform: 'translate(0,0)' }], { duration: ms(520 + u.slot * 90), easing: 'cubic-bezier(.2,.9,.3,1)' });
    }
    audio.sfx('encounter');
    await wait(700);
    while (!state.over && !destroyed) {
      await play(beginRound(state));
      if (state.over || destroyed) break;
      refreshChips();
      const cmds = autoAll ? Object.fromEntries(alive(state, 'party').map((u) => [u.id, { type: 'auto' }])) : await collectCommands();
      if (destroyed) break;
      clear(panelBody).append(h('div.cmd-wait', {}, '交 锋'));
      panel.dataset.mode = 'wait';
      warn(null);
      await play(resolveRound(state, cmds));
    }
    if (destroyed) return;
    root.dataset.phase = 'over';
    root.dataset.winner = state.winner;
    warn(null); coach(null);
    clear(panelBody).append(h('div.cmd-wait', {}, state.winner === 'party' ? '得 胜' : state.winner === 'enemy' ? '败 北' : ''));
    if (state.winner === 'party') {
      audio.sfx('victory');
      for (const u of alive(state, 'party')) els.get(u.id).body.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(0,-22px)' }, { transform: 'translate(0,0)' }], { duration: ms(460), iterations: 2 });
      await wait(900);
    } else if (state.winner === 'enemy') { audio.sfx('defeat'); await wait(700); } else await wait(300);
    resolveDone(state);
  }
  loop();

  return {
    done,
    root,
    destroy() { destroyed = true; ro.disconnect(); fx.destroy(); coach(null); root.remove(); },
  };
}

// 战后结算卡：标题、几行所得、可选提示与按钮。返回按下的按钮 key。
export function resultCard({ title, lost = false, lines = [], hint = null, buttons }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('overlay');
    const mask = h('div.mask.clear', { data: { ui: 'result' } },
      h(`div.result.card${lost ? '.lost' : ''}`, {}, h('h2', {}, title),
        lines.length > 0 && h('div.lines', {}, lines.map(([k, v]) => h('div', {}, h('b', {}, k), h('span', {}, v)))),
        hint && h('div.hint', {}, hint),
        h('div.row', { style: { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' } }, buttons.map((b, i) => h(`button.btn${i === 0 ? '.primary' : ''}`, { type: 'button', data: { act: b.key }, onclick: () => { mask.remove(); resolve(b.key); } }, b.label)))));
    armGuard(mask, 500); // 连点最后一下出招的余波，不该顺手把结算卡点掉
    overlay.append(mask);
    queueMicrotask(() => mask.querySelector('button')?.focus({ preventScroll: true }));
  });
}
