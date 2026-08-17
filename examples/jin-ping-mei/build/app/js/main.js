import { TEXT } from './text.js';
import {
  HEROINES, HEROINE_IDS, HOUSEHOLD, HOUSEHOLD_IDS, HOUSEHOLD_EVENTS,
  OPENING_CHOICES, ROUTE_CHOICES, ACCORD_CHOICES, JOINT_ACTIONS, SHARED_NIGHT_CHOICES,
  BANQUET_CHOICES, NIGHT_TEXT, SCENES,
} from './data.js';
import * as E from './engine.js';
import { loadAssets, assetReport, urlFor, assertCriticalAssetSchema } from './assets.js';
import { audio } from './audio.js';

const SAVE_KEY = 'jpm_fengyue_save_v6';
const GALLERY_KEY = 'jpm_fengyue_gallery_v1';
const AGE_KEY = 'jpm_fengyue_age_session';
const params = new URLSearchParams(location.search);
const SEED = params.has('seed') ? Number(params.get('seed')) : (Date.now() % 100000);
const FAST = params.get('fast') === '1';
const SCENE_TOTAL = Object.keys(SCENES).length;
if (FAST) document.documentElement.classList.add('fast');
const app = document.getElementById('app');

let state = null;
let assets = null;
let galleryOpen = false;
let gallerySceneId = null;
let resultCard = null;
let toastTimer = null;
let audioReady = false;

assertCriticalAssetSchema();
boot();

async function boot() {
  assets = await loadAssets();
  if (!assets.ok && params.get('dev') !== '1') {
    renderAssetFailure(assets.missingCritical);
    return;
  }
  render();
}

function renderAssetFailure(missing) {
  app.innerHTML = `<main class="fatal-card" id="asset-error"><h1>有几页画没有装进来</h1><p>先不让你看残页。缺的是：${missing.map(escapeHtml).join('、')}</p></main>`;
}

function ageConfirmed() {
  return sessionStorage.getItem(AGE_KEY) === 'yes';
}

function loadGallery() {
  try {
    const value = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id) => SCENES[id]) : [];
  } catch {
    return [];
  }
}

function save() {
  if (!state) return;
  localStorage.setItem(SAVE_KEY, E.serialize(state));
  const merged = [...new Set([...loadGallery(), ...state.unlocked])];
  localStorage.setItem(GALLERY_KEY, JSON.stringify(merged));
}

function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  const loaded = E.deserialize(raw);
  if (!loaded) {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
  return loaded;
}

function startNew() {
  state = E.newGame(SEED);
  localStorage.removeItem(SAVE_KEY);
  save();
  audio.playBGM('act1');
  render();
}

function continueGame() {
  const loaded = loadSave();
  if (!loaded) return showToast('这本旧账接不上了，只好从第一日重开。');
  state = loaded;
  audio.playBGM('act1');
  render();
}

function restart() {
  state = E.newGame(SEED);
  localStorage.removeItem(SAVE_KEY);
  save();
  render();
}

function sfxForPhase() {
  if (!state) return;
  const map = { day: 'wang', joint_result: 'submit', household: 'paper', visit: 'paper', night: 'watch', morning: 'plank', scene: 'qing', banquet: 'submit', shared_night: 'submit', shared_afterglow: 'watch', shared_dawn: 'plank', ending: 'qing' };
  audio.sfx(map[state.phase] ?? 'click');
}

function act(fn, label = '') {
  resultCard = null;
  const result = fn();
  if (!result?.ok) {
    showToast(result?.error || '这一步走不通。');
    return;
  }
  save();
  sfxForPhase();
  if (result.text && state.phase !== 'scene') {
    resultCard = { title: label || '这句话落下了', text: result.text };
  } else if (result.text && result.scene) {
    resultCard = { title: label || '这一笔有了回声', text: result.text };
  }
  render();
}

function render() {
  if (!assets) {
    app.innerHTML = '<div class="loading">册页还在装订，稍候。</div>';
    return;
  }
  if (!ageConfirmed()) return renderAgeGate();
  if (!state) return renderTitle();
  renderGame();
}

function renderAgeGate() {
  app.innerHTML = `
    <main class="age-gate" id="age-gate">
      <div class="age-seal" aria-hidden="true">18+</div>
      <p class="eyebrow">${TEXT.rating}</p>
      <h1>${TEXT.ageTitle}</h1>
      <p>${TEXT.ageBody}</p>
      <div class="button-row">
        <button class="ink-button primary" id="btn-age-yes">${TEXT.ageYes}</button>
        <button class="ink-button" id="btn-age-no">${TEXT.ageNo}</button>
      </div>
    </main>`;
}

function renderTitle() {
  const hasSave = !!loadSave();
  app.innerHTML = `
    <main class="title-screen">
      <div class="title-art" style="background-image:url('${urlFor('cover')}')" role="img" aria-label="月娘居中、金莲自屏风边前探、瓶儿递来钥匙,三人都在看你"></div>
      <section class="title-copy">
        <p class="eyebrow">成人后宫关系游戏 · 六日一局</p>
        <h1>${TEXT.title}</h1>
        <p class="title-subtitle">${TEXT.subtitle}</p>
        <p class="identity-line">${TEXT.identity}</p>
        <div class="title-actions">
          <button class="ink-button primary" id="btn-start">${TEXT.start}</button>
          <button class="ink-button" id="btn-continue" ${hasSave ? '' : 'disabled'}>${TEXT.continue}</button>
          <button class="ink-button" id="btn-gallery">${TEXT.gallery} <span>${loadGallery().length}/${SCENE_TOTAL}</span></button>
        </div>
        <p class="rating-line">${TEXT.rating}</p>
        <p class="save-note">${TEXT.saveNote}</p>
      </section>
    </main>`;
  if (galleryOpen) appendGallery();
}

function renderGame() {
  const day = E.dayDef(state);
  const content = renderPhase();
  app.innerHTML = `
    <main class="game-shell" id="game-shell" data-phase="${state.phase}">
      <header class="topbar">
        <div class="day-mark"><b id="day-num">第 ${state.day} 日</b><span>${escapeHtml(day.name)}</span></div>
        <div class="resources" aria-label="外账">
          ${resourceChip('银', `${state.resources.silver} 两`, 'silver')}
          ${resourceChip('势', state.resources.power, 'power')}
          ${resourceChip('声', state.resources.repute, 'repute')}
          ${resourceChip('宅', state.resources.house, 'house')}
          ${resourceChip('露', state.resources.exposure, 'exposure')}
          ${resourceChip('耗', state.resources.strain, 'strain')}
        </div>
        <div class="top-actions">
          <button class="plain-button" id="btn-gallery">${TEXT.gallery} ${loadGallery().length}/${SCENE_TOTAL}</button>
          <button class="plain-button" id="btn-mute">${audio.muted ? TEXT.muteOn : TEXT.muteOff}</button>
        </div>
      </header>
      <div class="play-area">
        <aside class="relation-rail" aria-label="人物账">
          <p class="rail-kicker">人物账</p>
          ${HEROINE_IDS.map(renderRelationCard).join('')}
          <section class="ledger-book" aria-label="风月账">
            ${renderLedger()}
          </section>
          <section class="household-roster" aria-label="宅中人">
            <p>宅中人</p>
            ${HOUSEHOLD_IDS.map(renderHouseholdRow).join('')}
          </section>
        </aside>
        <section class="phase-stage" id="phase-stage">
          ${content}
        </section>
      </div>
    </main>`;
  if (resultCard) appendResultCard();
  if (galleryOpen) appendGallery();
}

function resourceChip(glyph, value, key) {
  return `<div class="resource-chip ${key}" data-resource="${key}"><span>${glyph}</span><b>${value}</b></div>`;
}

// 档位变化的一次性提示:按 state 记忆上一次渲染的档位与数值,
// 跨档时给该格加 data-changed="up|down"(方向按数值增减),由 CSS 做墨渗 + 朱印。
const tierMemory = new WeakMap();

function tierChanges(id, rel) {
  let memory = tierMemory.get(state);
  if (!memory) {
    memory = {};
    tierMemory.set(state, memory);
  }
  const changed = {};
  for (const kind of ['qing', 'yu', 'du']) {
    const key = `${id}.${kind}`;
    const tier = E.relationTier(rel[kind], kind);
    const before = memory[key];
    if (before && before.tier !== tier) changed[kind] = rel[kind] > before.value ? 'up' : 'down';
    memory[key] = { tier, value: rel[kind] };
  }
  return changed;
}

function renderRelationCard(id) {
  const heroine = HEROINES[id];
  const rel = state.relations[id];
  const reason = rel.reasons[0] || heroine.want;
  const changed = tierChanges(id, rel);
  const mark = (kind) => (changed[kind] ? ` data-changed="${changed[kind]}"` : '');
  return `
    <article class="relation-card relation-${id}" data-heroine="${id}" data-qing="${rel.qing}" data-yu="${rel.yu}" data-du="${rel.du}">
      <div class="relation-name"><span class="shape-mark">${heroine.glyph}</span><div><b>${heroine.name}</b><small>${heroine.house}</small></div></div>
      <div class="relation-tiers">
        <span${mark('qing')}>情 <b>${E.relationTier(rel.qing, 'qing')}</b></span>
        <span${mark('yu')}>欲 <b>${E.relationTier(rel.yu, 'yu')}</b></span>
        <span${mark('du')}>妒 <b>${E.relationTier(rel.du, 'du')}</b></span>
      </div>
      <p>${escapeHtml(reason)}</p>
    </article>`;
}

function renderHouseholdRow(id) {
  const person = HOUSEHOLD[id];
  const row = state.household[id];
  return `<div class="household-row" data-household="${id}" data-regard="${row.regard}">
    <span>${person.glyph}</span><b>${person.name}</b><small>${E.householdTier(row.regard)}</small>
  </div>`;
}

// 账簿页:左栏中段原是一大块纯黑空白,如今填成 state.history 最近 4 条的竖排墨字。
// 用 WeakMap 按 state 记住上次渲染到的条目数,新记上的几行带 data-fresh 渗入。
const ledgerMemory = new WeakMap();

function renderLedger() {
  const total = state.history.length;
  const seen = ledgerMemory.get(state) ?? 0;
  ledgerMemory.set(state, total);
  const entries = state.history.slice(-4);
  if (!entries.length) return '<p class="ledger-empty">账页还空着</p>';
  const dayGlyph = (day) => `${'一二三四五六'[day - 1] ?? day}日`;
  return entries.map((entry, index) => {
    const fresh = total - entries.length + index >= seen ? ' data-fresh="1"' : '';
    return `<p class="ledger-line"${fresh}><b>${dayGlyph(entry.day)}</b>${escapeHtml(ledgerLine(entry))}</p>`;
  }).join('');
}

function ledgerLine(entry) {
  const cap = (text, max = 5) => {
    const chars = [...String(text ?? '')];
    return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
  };
  switch (entry.type) {
    case 'opening':
      return entry.choice === 'respect_yue' ? '账交月娘' : '先喝金莲酒';
    case 'day_action': {
      const gain = entry.action === 'ledger' ? entry.text?.match(/追回 (\d+) 两/) : null;
      if (gain) return `翻账追回${gain[1]}两`;
      return { office: '走官面递话', listen: '问口风', banquet: '整席面' }[entry.action] ?? '白日办事';
    }
    case 'joint_action': {
      const label = JOINT_ACTIONS.find((item) => item.id === entry.action)?.label ?? '联院差事';
      return cap(label, 7);
    }
    case 'household': {
      const event = Object.values(HOUSEHOLD_EVENTS).find((item) => item.id === entry.event);
      const label = event?.choices.find((item) => item.id === entry.choice)?.label ?? '廊下一句';
      return `${HOUSEHOLD[entry.actor]?.short ?? '宅中人'}·${cap(label)}`;
    }
    case 'banquet': {
      const label = BANQUET_CHOICES.find((item) => item.id === entry.choice)?.label ?? '举杯';
      return cap(label, 6);
    }
    case 'visit_start':
      return `黄昏进${HEROINES[entry.heroine]?.house ?? '内院'}`;
    case 'visit_choice': {
      // 路线按拜访次数走,条目里没有当时的拍号;选项 id 每人唯一,跨拍平铺查找。
      const rows = Object.values(ROUTE_CHOICES[entry.heroine] ?? {}).flat();
      const label = rows.find((item) => item.id === entry.choice)?.label ?? '夜话';
      return cap(label, 6);
    }
    case 'accord_term': {
      const choice = ACCORD_CHOICES[entry.heroine];
      return `${HEROINES[entry.heroine]?.short ?? '她'}·${cap(choice?.label ?? '立约', 5)}`;
    }
    case 'shared_night_start':
      return `三院同席·${entry.accordCount}/3`;
    case 'shared_night': {
      const label = SHARED_NIGHT_CHOICES.find((item) => item.id === entry.choice)?.label ?? '同席定议';
      return cap(label, 7);
    }
    case 'night': {
      const short = HEROINES[entry.heroine]?.short ?? '她';
      return {
        leave: `${short}屋·掩门出`,
        talk: `${short}屋·坐更漏`,
        prelude: `${short}点了头`,
        explicit: `宿${HEROINES[entry.heroine]?.house ?? '内院'}`,
      }[entry.action] ?? '夜话一回';
    }
    case 'morning': {
      const short = HEROINES[entry.actor]?.short ?? '她';
      return {
        jealousy: `${short}来敲门`, pan_claim: `${short}堵门讨话`,
        yue_delayed: '月娘记前话', yue_help: '月娘留账人',
        pinger_help: '瓶儿递货单', quiet: '一盏醒酒茶',
      }[entry.event] ?? '天亮一回';
    }
    case 'route_break':
      return entry.heroine ? `${HEROINES[entry.heroine]?.short ?? '她'}门冷一日` : '各门冷一日';
    case 'upkeep_short':
      return '场面塌一角';
    case 'collector':
      return entry.paid ? '打发收账人' : '收账人闹上门';
    default:
      return '记下一笔';
  }
}

function phaseHeader(kicker, title, body) {
  return `<header class="phase-header"><p class="eyebrow">${kicker}</p><h2>${title}</h2><p>${escapeHtml(body)}</p></header>`;
}

function renderPhase() {
  switch (state.phase) {
    case 'opening': return renderOpening();
    case 'day': return renderDay();
    case 'joint_result': return renderJointResult();
    case 'household': return renderHousehold();
    case 'banquet': return renderBanquet();
    case 'choose_visit': return renderVisitHub();
    case 'shared_night': return renderSharedNight();
    case 'shared_afterglow': return renderSharedAfterglow();
    case 'shared_dawn': return renderSharedDawn();
    case 'visit': return renderVisit();
    case 'night': return renderNight();
    case 'morning': return renderMorning();
    case 'scene': return renderScene();
    case 'ending': return renderEnding();
    default: return '<div class="fatal-card">这页账断了。</div>';
  }
}

function renderOpening() {
  return `
    <div class="opening-scene visual-stage" style="--scene-bg:url('${urlFor('cover')}')">
      <div class="decision-panel opening-panel">
        ${phaseHeader('第一日 · 正堂', '五十两银子不见了', '月娘守着账簿，金莲把酒送到你手边。两个人都等你先看谁。')}
        <p class="speaker-line">月娘：“真账留下。”　金莲：“人也留下，先喝我这杯。”</p>
        <div class="choice-grid">${OPENING_CHOICES.map((choice) => choiceButton(choice, 'opening')).join('')}</div>
      </div>
    </div>`;
}

function renderDay() {
  const def = E.dayDef(state);
  const jointOptions = E.jointActionOptions(state);
  const jointDone = Math.min(E.jointActionCount(state), E.JOINT_ACTION_TARGET);
  return `
    <div class="hub-stage visual-stage" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="courtyard-caption"><span>正堂</span><span>花园角门</span><span>瓶儿私院</span></div>
      <div class="decision-panel day-panel">
        ${phaseHeader(`第 ${state.day} 日 · 白日`, def.name, def.pressure)}
        <p class="phase-lead">${TEXT.dayLead}</p>
        <div class="day-actions">${E.dayOptions(state).map((choice) => choiceButton(choice, 'day-action')).join('')}</div>
        <section class="joint-offers" aria-label="联院差事">
          <header><b>联院差事</b><span>已合办 ${jointDone}/${E.JOINT_ACTION_TARGET} 桩 · 每组只做一次</span></header>
          <div class="joint-actions">${jointOptions.map((choice) => choiceButton(choice, 'joint-action')).join('')}</div>
        </section>
      </div>
    </div>`;
}

function renderJointResult() {
  const choice = E.currentJointAction(state);
  if (!choice) return '<div class="fatal-card">这桩联院差事断了页。</div>';
  return `
    <div class="joint-result-stage visual-stage" style="--scene-bg:url('${urlFor(choice.asset)}')" data-joint-result="${choice.id}">
      <div class="decision-panel joint-result-panel">
        ${phaseHeader(`联院差事 · ${choice.participants.map((id) => HEROINES[id].short).join('与')}`, choice.label, choice.text)}
        <p class="joint-payoff">${choice.hint}</p>
        <button class="ink-button primary" data-joint-continue="1">把这笔记进总账</button>
      </div>
    </div>`;
}

function renderHousehold() {
  const event = E.currentHouseholdEvent(state);
  const person = HOUSEHOLD[event.actor];
  const row = state.household[event.actor];
  return `
    <div class="household-stage visual-stage household-${event.actor}" data-household-event="${event.id}" data-household-actor="${event.actor}" style="--scene-bg:url('${urlFor(person.portrait)}')">
      <div class="decision-panel household-panel">
        ${phaseHeader(`${person.house} · ${person.glyph}`, event.title, event.text)}
        <p class="household-voice">${person.voice}</p>
        <div class="household-standing">她如今${E.householdTier(row.regard)}。</div>
        <div class="choice-grid">${E.householdOptions(state).map((choice) => choiceButton(choice, 'household')).join('')}</div>
      </div>
    </div>`;
}

function renderVisitHub() {
  const status = E.sharedNightStatus(state);
  const accordRows = E.accordStatus(state);
  return `
    <div class="hub-stage visual-stage evening ${status.visible ? 'has-shared' : ''}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="visit-prompt">
        <div>${phaseHeader(`第 ${state.day} 日 · 黄昏`, '院门亮了灯', TEXT.chooseVisit)}</div>
        <aside class="accord-panel" aria-label="三院共约">
          <div class="accord-heading"><b>想让三盏灯一起亮</b><span>边界 ${status.complete}/${status.total} · 同心 ${status.jointComplete}/${status.jointTotal}</span></div>
          <div class="accord-seals">${accordRows.map((row) => `<span class="accord-seal ${row.complete ? 'complete' : ''}" data-accord="${row.key}"><i>${row.glyph}</i>${row.label}</span>`).join('')}</div>
          ${status.visible ? `<button class="shared-invite" data-shared-start="1"><b>请三个人都别走</b><span>${status.ready ? '三句真话、两桩同心事都在，这回她们愿意一起留下。' : status.reason}</span></button>` : '<small>先听清三个人各自要什么，再让她们真的一起做成两件事。</small>'}
        </aside>
      </div>
      <div class="heroine-doors">
        ${HEROINE_IDS.map((id) => {
          const h = HEROINES[id];
          const r = state.relations[id];
          const knock = (state.visits?.[id] ?? 0) + 1;
          return `<button class="door-card door-${id}" data-visit="${id}"><span>${h.house}</span><img src="${urlFor(h.portrait)}" alt="${h.name}"/><div><b>去${h.short}屋里</b><small>${h.want}</small><em>情 ${E.relationTier(r.qing, 'qing')} · 妒 ${E.relationTier(r.du, 'du')}</em><i class="door-knock">第 ${knock} 次进这扇门</i></div></button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderSharedNight() {
  const rows = E.accordStatus(state);
  return `
    <div class="shared-stage visual-stage" style="--scene-bg:url('${urlFor('cg/group/banquet_conflict')}')">
      <div class="decision-panel shared-panel">
        ${phaseHeader('第六夜 · 三人都没走', '账还在桌上，酒已经热了', TEXT.sharedNightLead)}
        <div class="accord-seals shared-seals">${rows.map((row) => `<span class="accord-seal ${row.complete ? 'complete' : ''}" data-accord="${row.key}"><i>${row.glyph}</i>${row.label}</span>`).join('')}</div>
        <p class="shared-proof">白日联院差事：${Math.min(E.jointActionCount(state), E.JOINT_ACTION_TARGET)}/${E.JOINT_ACTION_TARGET}</p>
        <div class="choice-grid">${E.sharedNightOptions(state).map((choice) => choiceButton(choice, 'shared-night')).join('')}</div>
      </div>
    </div>`;
}

function renderSharedAfterglow() {
  const beat = E.sharedAfterglowBeat(state);
  if (!beat) return '<div class="fatal-card">灯下这页断了。</div>';
  return `
    <div class="afterglow-stage visual-stage" data-shared-beat="${beat.id}" style="--scene-bg:url('${urlFor('cg/group/inner_court_accord')}')">
      <div class="decision-panel afterglow-panel">
        ${phaseHeader(beat.kicker, beat.title, beat.body)}
        <p class="shared-proof">夜还在往下走 ${state.sharedAfterglowChoices.length + 1}/2 · 每句话都会有人接</p>
        <div class="choice-grid">${E.sharedAfterglowOptions(state).map((choice) => choiceButton(choice, 'shared-afterglow')).join('')}</div>
      </div>
    </div>`;
}

function renderSharedDawn() {
  return `
    <div class="shared-dawn-stage visual-stage" style="--scene-bg:url('${urlFor('cg/group/inner_court_afterglow')}')">
      <div class="decision-panel shared-dawn-panel">
        ${phaseHeader('第六日 · 晨光进了纱帐', '天亮以后，昨夜依然算数', '月娘已经披衣坐起，金莲还倚着枕，瓶儿正在重新系钥匙。你现在怎样走出这间屋，决定昨夜是一场酒，还是一个开始。')}
        <div class="choice-grid">${E.sharedDawnOptions(state).map((choice) => choiceButton(choice, 'shared-dawn')).join('')}</div>
      </div>
    </div>`;
}

function renderVisit() {
  const id = state.currentHeroine;
  const h = HEROINES[id];
  const choices = E.visitChoices(state, id);
  return `
    <div class="dialogue-stage visual-stage dialogue-${id}">
      <div class="close-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}近景"></div>
      <div class="decision-panel dialogue-panel">
        ${phaseHeader(`${h.house} · ${h.shape}`, h.name, h.voice)}
        <p class="want-line">${h.want}<br/><span>${h.gives}</span></p>
        <div class="choice-stack">${choices.map((choice) => choiceButton(choice, 'route-choice')).join('')}</div>
      </div>
    </div>`;
}

function renderNight() {
  const id = state.currentHeroine;
  const h = HEROINES[id];
  const choices = E.nightOptions(state).map((option) => ({ ...NIGHT_TEXT[option.id], ...option }));
  return `
    <div class="dialogue-stage visual-stage night dialogue-${id}">
      <div class="close-cg closer" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}夜间近景"></div>
      <div class="decision-panel dialogue-panel">
        ${phaseHeader('夜深了', h.name, TEXT.nightLead)}
        <div class="choice-stack">${choices.map((choice) => choiceButton(choice, 'night')).join('')}</div>
        <p class="consent-note">她往前一步，才有下一步。她若停下，门便停在这里。</p>
      </div>
    </div>`;
}

function renderMorning() {
  const event = state.morning;
  const h = HEROINES[event.actor];
  return `
    <div class="morning-stage visual-stage tone-${event.tone}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="morning-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}次晨近景"></div>
      <div class="decision-panel morning-panel">
        ${phaseHeader(`第 ${state.day} 日 · 天刚亮`, event.title, event.text)}
        ${event.scene ? `<div class="morning-scene" style="background-image:url('${urlFor(event.scene)}')" role="img" aria-label="院门外，收账人抱着账册等着"></div>` : ''}
        ${(event.notes ?? []).map((note) => `<p class="morning-note">${escapeHtml(note)}</p>`).join('')}
        <p class="phase-lead">${TEXT.morningLead}</p>
        <div class="choice-stack">${E.morningOptions(state).map((choice) => choiceButton(choice, 'morning')).join('')}</div>
      </div>
    </div>`;
}

function renderBanquet() {
  // 选择前的宴席屏只用宅院界画加暖灯遮罩:三人同框的群像留给选择之后的场景册,
  // 它第一次出现必须发生在玩家按下那个按钮之后。
  return `
    <div class="banquet-stage visual-stage" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="decision-panel banquet-panel">
        ${phaseHeader('第五日 · 中秋席', '第一杯酒还没递出去', TEXT.banquetLead)}
        <div class="choice-grid">${E.banquetOptions(state).map((choice) => choiceButton(choice, 'banquet')).join('')}</div>
      </div>
    </div>`;
}

function renderScene() {
  const scene = SCENES[state.pendingScene];
  const adult = ['prelude', 'explicit', 'ensemble-intimate'].includes(scene.tier);
  const ensemble = scene.tier === 'ensemble';
  return `
    <article class="scene-view" id="scene-view" data-scene-id="${scene.id}" data-scene-tier="${scene.tier}">
      <img id="scene-image" src="${urlFor(scene.asset)}" alt="${scene.title}"/>
      <div class="scene-scrim"></div>
      <div class="scene-caption">
        <p class="eyebrow">${scene.tier === 'ensemble-intimate' ? '18+ · 三个人都点了头' : adult ? '18+ · 她点了头' : ensemble ? '三院共约 · 三个人都在' : '中秋席 · 满桌人都在'}</p>
        <h2>${scene.title}</h2>
        <p>${scene.body}</p>
        <div class="scene-meta"><span>这一页留下了</span><span>${scene.participants.length ? scene.participants.map((id) => HEROINES[id].name).join('、') : '中秋同席'}</span></div>
        <button class="ink-button primary" id="btn-scene-close">${TEXT.sceneContinue}</button>
      </div>
    </article>`;
}

function renderEnding() {
  const end = state.ending;
  const top = HEROINE_IDS.slice().sort((a, b) => state.relations[b].qing - state.relations[a].qing)[0];
  const relationshipSummary = end.id === 'balanced'
    ? '<span>三院关系 <b>都还在桌上</b></span>'
    : `<span>最深关系 <b>${HEROINES[top].name} · ${E.relationTier(state.relations[top].qing, 'qing')}</b></span>`;
  // 结局图跟着结局走:专一给该女主的立绘近景,三院同灯用真正协作的群像,
  // 权谋与不稳退回夜色宅院,由 CSS 按 data-ending 分别调色。
  const artUrl = end.id === 'exclusive' && end.heroine
    ? urlFor(HEROINES[end.heroine].close)
    : end.id === 'balanced'
      ? urlFor('cg/group/inner_court_accord')
      : urlFor('compound');
  return `
    <article class="ending-view" id="ending-view" data-ending="${end.id}">
      <div class="ending-art" style="background-image:linear-gradient(90deg,rgba(16,12,10,.9),rgba(16,12,10,.25)),url('${artUrl}')"></div>
      <div class="ending-copy">
        <p class="eyebrow">第 6 日 · 风月总账</p>
        <h1>${end.title}</h1>
        <p class="ending-tag">${end.tag}${end.heroineName ? ` · ${end.heroineName}` : ''}${end.routeResult ? ` · ${end.routeResult}` : ''}</p>
        <p>${end.text}</p>
        <div class="ending-ledger">
          ${relationshipSummary}
          <span>已得册页 <b>${loadGallery().length}/${SCENE_TOTAL}</b></span>
          <span>用过秘密 <b>${state.secretsUsed.length}</b></span>
          <span>尚有册页 <b>${end.unseen.length} 页未开</b></span>
        </div>
        <div class="household-ending">${end.householdResults.map((item) => `<span><b>${item.name}</b>${item.result}</span>`).join('')}</div>
        <p class="ending-note">天一亮，新的账会来，新的醋也会酿。六日走完，往后的院门才刚打开。</p>
        <div class="button-row"><button class="ink-button primary" id="btn-restart">${TEXT.endingRestart}</button><button class="ink-button" id="btn-gallery">${TEXT.endingGallery}</button></div>
      </div>
    </article>`;
}

function choiceButton(choice, dataName) {
  const id = choice.id;
  const disabled = choice.disabled ? 'disabled' : '';
  const locked = choice.disabled ? (choice.locked || choice.hint || '前事未到') : (choice.hint || '');
  return `<button class="choice-button" data-${dataName}="${id}" ${disabled}><b>${escapeHtml(choice.label || id)}</b><span>${escapeHtml(locked)}</span></button>`;
}

function appendResultCard() {
  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';
  overlay.id = 'result-overlay';
  overlay.innerHTML = `<section class="result-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(resultCard.title)}">
    <p class="eyebrow">她听见了，也给了你回应</p>
    <h2>${escapeHtml(resultCard.title)}</h2>
    <p>${escapeHtml(resultCard.text)}</p>
    <button class="ink-button primary" id="btn-result-continue">接下去</button>
  </section>`;
  app.appendChild(overlay);
}

function appendGallery() {
  const unlocked = new Set(loadGallery());
  const groups = [
    ['吴月娘', ['yue_prelude', 'yue_explicit']],
    ['潘金莲', ['pan_prelude', 'pan_explicit']],
    ['李瓶儿', ['pinger_prelude', 'pinger_explicit']],
    ['同场', ['banquet_conflict', 'inner_court_accord', 'inner_court_afterglow']],
  ];
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';
  overlay.id = 'gallery-modal';
  overlay.innerHTML = `<section class="gallery-book" role="dialog" aria-modal="true" aria-label="场景册" ${gallerySceneId ? 'inert' : ''}>
    <header><div><p class="eyebrow">不会丢的册页</p><h2>${TEXT.gallery} <span>${unlocked.size}/${SCENE_TOTAL}</span></h2><p>${TEXT.galleryKeep}</p></div><button class="plain-button" id="btn-gallery-close">${TEXT.close}</button></header>
    <div class="gallery-grid">${groups.map(([name, ids]) => `<section><h3>${name}</h3><div>${ids.map((id) => galleryCard(SCENES[id], unlocked.has(id))).join('')}</div></section>`).join('')}</div>
  </section>${gallerySceneId ? galleryReplay(SCENES[gallerySceneId]) : ''}`;
  app.appendChild(overlay);
}

function galleryCard(scene, open) {
  return `<button class="gallery-card ${open ? 'unlocked' : 'locked'}" data-gallery-scene="${scene.id}" ${open ? `data-gallery-open="${scene.id}"` : 'disabled'}>
    ${open ? `<img src="${urlFor(scene.asset)}" alt="${scene.title}"/>` : '<div class="locked-art" aria-label="未解锁">未</div>'}
    <div><b>${open ? scene.title : '题签未开'}</b><small>${open ? (scene.tier === 'public' ? '中秋同席' : scene.tier === 'ensemble' ? '三院共约' : scene.tier === 'ensemble-intimate' ? '三院余夜' : scene.tier === 'explicit' ? '那夜留宿' : '帘前一步') : lockedHint(scene.id)}</small></div>
  </button>`;
}

function galleryReplay(scene) {
  return `<article class="gallery-replay" id="gallery-replay" data-replay-scene="${scene.id}" role="dialog" aria-modal="true" aria-label="重看${scene.title}">
    <img id="gallery-replay-image" src="${urlFor(scene.asset)}" alt="${scene.title}"/>
    <div class="gallery-replay-copy">
      <p class="eyebrow">${scene.tier === 'public' ? '再看中秋席' : scene.tier === 'ensemble' ? '再看三院同灯' : scene.tier === 'ensemble-intimate' ? '18+ · 再看灯下余夜' : '18+ · 翻回那一夜'}</p>
      <h2>${scene.title}</h2>
      <p>${scene.body}</p>
      <p class="replay-note">这次只看画，不改已经走过的路。</p>
      <button class="ink-button primary" id="btn-gallery-replay-close">合上这一页</button>
    </div>
  </article>`;
}

function lockedHint(sceneId) {
  if (sceneId === 'banquet_conflict') return '等中秋开席';
  if (sceneId === 'inner_court_accord') return '听完三条院约，再请三人同席';
  if (sceneId === 'inner_court_afterglow') return '共同办完外账，再把余夜走完';
  if (sceneId.startsWith('yue_')) return '先把答应月娘的事办了';
  if (sceneId.startsWith('pan_')) return '先还金莲那杯酒';
  return '先护住瓶儿的账';
}

function showToast(text) {
  let node = document.getElementById('toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    node.className = 'toast';
    app.appendChild(node);
  }
  node.textContent = text;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), FAST ? 150 : 2200);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const actionLabel = button.querySelector('b')?.textContent?.trim() || button.textContent.trim();
  if (!audioReady) { audioReady = true; audio.unlock(); audio.playBGM(state ? 'act1' : 'title'); }
  audio.sfx('click');

  if (button.id === 'btn-result-continue') { resultCard = null; render(); }
  else if (button.id === 'btn-age-yes') {
    sessionStorage.setItem(AGE_KEY, 'yes');
    render();
  } else if (button.id === 'btn-age-no') {
    app.innerHTML = '<main class="age-gate"><h1>这道门不往里开</h1><p>本作只供成年人。你可以直接关闭页面。</p></main>';
  } else if (button.id === 'btn-start') startNew();
  else if (button.id === 'btn-continue') continueGame();
  else if (button.id === 'btn-gallery') { galleryOpen = true; gallerySceneId = null; render(); }
  else if (button.id === 'btn-gallery-close') { galleryOpen = false; gallerySceneId = null; render(); }
  else if (button.id === 'btn-gallery-replay-close') { gallerySceneId = null; render(); }
  else if (button.dataset.galleryOpen) { gallerySceneId = button.dataset.galleryOpen; render(); }
  else if (button.id === 'btn-mute') { audio.unlock(); audio.toggleMuted(); render(); }
  else if (button.id === 'btn-restart') restart();
  else if (button.id === 'btn-scene-close') act(() => E.closeScene(state), actionLabel);
  else if (button.dataset.opening) act(() => E.chooseOpening(state, button.dataset.opening), actionLabel);
  else if (button.dataset.dayAction) act(() => E.chooseDayAction(state, button.dataset.dayAction), actionLabel);
  else if (button.dataset.jointAction) act(() => E.chooseJointAction(state, button.dataset.jointAction), actionLabel);
  else if (button.dataset.jointContinue) act(() => E.continueJointAction(state), actionLabel);
  else if (button.dataset.household) act(() => E.resolveHouseholdEvent(state, button.dataset.household), actionLabel);
  else if (button.dataset.banquet) act(() => E.chooseBanquet(state, button.dataset.banquet), actionLabel);
  else if (button.dataset.sharedStart) act(() => E.startSharedNight(state), actionLabel);
  else if (button.dataset.sharedNight) act(() => E.chooseSharedNight(state, button.dataset.sharedNight), actionLabel);
  else if (button.dataset.sharedAfterglow) act(() => E.chooseSharedAfterglow(state, button.dataset.sharedAfterglow), actionLabel);
  else if (button.dataset.sharedDawn) act(() => E.chooseSharedDawn(state, button.dataset.sharedDawn), actionLabel);
  else if (button.dataset.visit) act(() => E.startVisit(state, button.dataset.visit), actionLabel);
  else if (button.dataset.routeChoice) act(() => E.chooseVisit(state, button.dataset.routeChoice), actionLabel);
  else if (button.dataset.night) act(() => E.chooseNight(state, button.dataset.night), actionLabel);
  else if (button.dataset.morning) act(() => E.resolveMorning(state, button.dataset.morning), actionLabel);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && galleryOpen) {
    if (gallerySceneId) gallerySceneId = null;
    else galleryOpen = false;
    render();
  }
});

window.__game = Object.freeze({
  state: () => state ? E.snapshot(state) : null,
  gallery: () => loadGallery(),
  assets: () => assetReport(),
  seed: SEED,
  newGame: () => startNew(),
  restart,
  chooseOpening: (id) => act(() => E.chooseOpening(state, id)),
  chooseDay: (id) => act(() => E.chooseDayAction(state, id)),
  chooseJointAction: (id) => act(() => E.chooseJointAction(state, id)),
  continueJointAction: () => act(() => E.continueJointAction(state)),
  household: (id) => act(() => E.resolveHouseholdEvent(state, id)),
  chooseBanquet: (id) => act(() => E.chooseBanquet(state, id)),
  startSharedNight: () => act(() => E.startSharedNight(state)),
  chooseSharedNight: (id) => act(() => E.chooseSharedNight(state, id)),
  chooseSharedAfterglow: (id) => act(() => E.chooseSharedAfterglow(state, id)),
  chooseSharedDawn: (id) => act(() => E.chooseSharedDawn(state, id)),
  visit: (id) => act(() => E.startVisit(state, id)),
  chooseVisit: (id) => act(() => E.chooseVisit(state, id)),
  chooseNight: (id) => act(() => E.chooseNight(state, id)),
  morning: (id) => act(() => E.resolveMorning(state, id)),
  closeScene: () => act(() => E.closeScene(state)),
});
