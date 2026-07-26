import { TEXT } from './text.js';
import {
  HEROINES, HEROINE_IDS, HOUSEHOLD, HOUSEHOLD_IDS,
  OPENING_CHOICES, NIGHT_TEXT, SCENES,
} from './data.js';
import * as E from './engine.js';
import { loadAssets, assetReport, urlFor, assertCriticalAssetSchema } from './assets.js';
import { audio } from './audio.js';

const SAVE_KEY = 'jpm_fengyue_save_v4';
const LEGACY_SAVE_KEY = 'jpm_fengyue_save_v3';
const GALLERY_KEY = 'jpm_fengyue_gallery_v1';
const AGE_KEY = 'jpm_fengyue_age_session';
const params = new URLSearchParams(location.search);
const SEED = params.has('seed') ? Number(params.get('seed')) : (Date.now() % 100000);
const FAST = params.get('fast') === '1';
if (FAST) document.documentElement.classList.add('fast');
const app = document.getElementById('app');

let state = null;
let assets = null;
let galleryOpen = false;
let gallerySceneId = null;
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
  const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
  const loaded = E.deserialize(raw);
  if (!loaded) {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
  if (!localStorage.getItem(SAVE_KEY)) {
    localStorage.setItem(SAVE_KEY, E.serialize(loaded));
    localStorage.removeItem(LEGACY_SAVE_KEY);
  }
  return loaded;
}

function startNew() {
  state = E.newGame(SEED);
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_SAVE_KEY);
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
  localStorage.removeItem(LEGACY_SAVE_KEY);
  save();
  render();
}

function sfxForPhase() {
  if (!state) return;
  const map = { day: 'wang', household: 'paper', visit: 'paper', night: 'watch', morning: 'plank', scene: 'qing', banquet: 'submit', ending: 'qing' };
  audio.sfx(map[state.phase] ?? 'click');
}

function act(fn) {
  const result = fn();
  if (!result?.ok) {
    showToast(result?.error || '这一步走不通。');
    return;
  }
  save();
  sfxForPhase();
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
      <div class="title-art" style="background-image:url('${urlFor('cover')}')" role="img" aria-label="吴月娘、潘金莲与李瓶儿在中秋席上看向玩家"></div>
      <section class="title-copy">
        <p class="eyebrow">成人后宫关系游戏 · 六日一局</p>
        <h1>${TEXT.title}</h1>
        <p class="title-subtitle">${TEXT.subtitle}</p>
        <p class="identity-line">${TEXT.identity}</p>
        <div class="title-actions">
          <button class="ink-button primary" id="btn-start">${TEXT.start}</button>
          <button class="ink-button" id="btn-continue" ${hasSave ? '' : 'disabled'}>${TEXT.continue}</button>
          <button class="ink-button" id="btn-gallery">${TEXT.gallery} <span>${loadGallery().length}/7</span></button>
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
          <button class="plain-button" id="btn-gallery">${TEXT.gallery} ${loadGallery().length}/7</button>
          <button class="plain-button" id="btn-mute">${audio.muted ? TEXT.muteOn : TEXT.muteOff}</button>
        </div>
      </header>
      <div class="play-area">
        <aside class="relation-rail" aria-label="人物账">
          <p class="rail-kicker">人物账</p>
          ${HEROINE_IDS.map(renderRelationCard).join('')}
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
  if (galleryOpen) appendGallery();
}

function resourceChip(glyph, value, key) {
  return `<div class="resource-chip ${key}" data-resource="${key}"><span>${glyph}</span><b>${value}</b></div>`;
}

function renderRelationCard(id) {
  const heroine = HEROINES[id];
  const rel = state.relations[id];
  const reason = rel.reasons[0] || heroine.want;
  return `
    <article class="relation-card relation-${id}" data-heroine="${id}" data-qing="${rel.qing}" data-yu="${rel.yu}" data-du="${rel.du}">
      <div class="relation-name"><span class="shape-mark">${heroine.glyph}</span><div><b>${heroine.name}</b><small>${heroine.house}</small></div></div>
      <div class="relation-tiers">
        <span>情 <b>${E.relationTier(rel.qing, 'qing')}</b></span>
        <span>欲 <b>${E.relationTier(rel.yu, 'yu')}</b></span>
        <span>妒 <b>${E.relationTier(rel.du, 'du')}</b></span>
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

function phaseHeader(kicker, title, body) {
  return `<header class="phase-header"><p class="eyebrow">${kicker}</p><h2>${title}</h2><p>${escapeHtml(body)}</p></header>`;
}

function renderPhase() {
  switch (state.phase) {
    case 'opening': return renderOpening();
    case 'day': return renderDay();
    case 'household': return renderHousehold();
    case 'banquet': return renderBanquet();
    case 'choose_visit': return renderVisitHub();
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
    <div class="opening-scene visual-stage" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="opening-women" aria-hidden="true">
        ${heroineFigure('pan_jinlian', 'left')}
        ${heroineFigure('wu_yueniang', 'center')}
        ${heroineFigure('li_pinger', 'right')}
      </div>
      <div class="decision-panel opening-panel">
        ${phaseHeader('第一日 · 正堂', '五十两银子不见了', '月娘守着账簿，金莲把酒送到你手边。两个人都等你先看谁。')}
        <p class="speaker-line">月娘：“账放下。”　金莲：“官人，酒要凉了。”</p>
        <div class="choice-grid">${OPENING_CHOICES.map((choice) => choiceButton(choice, 'opening')).join('')}</div>
      </div>
    </div>`;
}

function renderDay() {
  const def = E.dayDef(state);
  return `
    <div class="hub-stage visual-stage" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="courtyard-caption"><span>正堂</span><span>花园角门</span><span>瓶儿私院</span></div>
      <div class="decision-panel day-panel">
        ${phaseHeader(`第 ${state.day} 日 · 白日`, def.name, def.pressure)}
        <p class="phase-lead">${TEXT.dayLead}</p>
        <div class="day-actions">${E.dayOptions(state).map((choice) => choiceButton(choice, 'day-action')).join('')}</div>
      </div>
    </div>`;
}

function renderHousehold() {
  const event = E.currentHouseholdEvent(state);
  const person = HOUSEHOLD[event.actor];
  const row = state.household[event.actor];
  return `
    <div class="household-stage visual-stage household-${event.actor}" data-household-event="${event.id}" data-household-actor="${event.actor}" style="--scene-bg:url('${urlFor('compound')}')">
      <img class="household-portrait" src="${urlFor(person.portrait)}" alt="${person.name}"/>
      <div class="decision-panel household-panel">
        ${phaseHeader(`${person.house} · ${person.glyph}`, event.title, event.text)}
        <p class="household-voice">${person.voice}</p>
        <div class="household-standing">她如今${E.householdTier(row.regard)}。</div>
        <div class="choice-grid">${E.householdOptions(state).map((choice) => choiceButton(choice, 'household')).join('')}</div>
      </div>
    </div>`;
}

function renderVisitHub() {
  return `
    <div class="hub-stage visual-stage evening" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="visit-prompt">${phaseHeader(`第 ${state.day} 日 · 黄昏`, '院门亮了灯', TEXT.chooseVisit)}</div>
      <div class="heroine-doors">
        ${HEROINE_IDS.map((id) => {
          const h = HEROINES[id];
          const r = state.relations[id];
          return `<button class="door-card door-${id}" data-visit="${id}"><span>${h.house}</span><img src="${urlFor(h.portrait)}" alt="${h.name}"/><div><b>去${h.short}屋里</b><small>${h.want}</small><em>情 ${E.relationTier(r.qing, 'qing')} · 妒 ${E.relationTier(r.du, 'du')}</em></div></button>`;
        }).join('')}
      </div>
    </div>`;
}

function heroineFigure(id, position = '') {
  const h = HEROINES[id];
  return `<img class="heroine-figure ${position}" src="${urlFor(h.portrait)}" alt="${h.name}"/>`;
}

function renderVisit() {
  const id = state.currentHeroine;
  const h = HEROINES[id];
  const choices = E.visitChoices(state, id);
  return `
    <div class="dialogue-stage visual-stage dialogue-${id}">
      <div class="dialogue-backdrop" style="background-image:linear-gradient(90deg,rgba(20,16,13,.94) 0%,rgba(20,16,13,.24) 48%,rgba(20,16,13,.55) 100%),url('${urlFor('compound')}')"></div>
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
      <div class="dialogue-backdrop" style="background-image:linear-gradient(90deg,rgba(14,10,10,.95),rgba(35,18,15,.28)),url('${urlFor('compound')}')"></div>
      <div class="close-cg closer" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}夜间近景"></div>
      <div class="decision-panel dialogue-panel">
        ${phaseHeader('夜深了', h.name, TEXT.nightLead)}
        <div class="choice-stack">${choices.map((choice) => choiceButton(choice, 'night')).join('')}</div>
        <p class="consent-note">随时都能停。若她不肯再近，先前哪句话没说到，她会告诉你。</p>
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
        <p class="phase-lead">${TEXT.morningLead}</p>
        <div class="choice-stack">${E.morningOptions(state).map((choice) => choiceButton(choice, 'morning')).join('')}</div>
      </div>
    </div>`;
}

function renderBanquet() {
  return `
    <div class="banquet-stage visual-stage" style="--scene-bg:url('${urlFor('cg/group/banquet_conflict')}')">
      <div class="decision-panel banquet-panel">
        ${phaseHeader('第五日 · 中秋席', '第一杯酒还没递出去', TEXT.banquetLead)}
        <div class="choice-grid">${E.banquetOptions(state).map((choice) => choiceButton(choice, 'banquet')).join('')}</div>
      </div>
    </div>`;
}

function renderScene() {
  const scene = SCENES[state.pendingScene];
  const adult = scene.tier === 'prelude' || scene.tier === 'explicit';
  return `
    <article class="scene-view" id="scene-view" data-scene-id="${scene.id}" data-scene-tier="${scene.tier}">
      <img id="scene-image" src="${urlFor(scene.asset)}" alt="${scene.title}"/>
      <div class="scene-scrim"></div>
      <div class="scene-caption">
        <p class="eyebrow">${adult ? '18+ · 她点了头' : '中秋席 · 满桌人都在'}</p>
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
  return `
    <article class="ending-view" id="ending-view" data-ending="${end.id}">
      <div class="ending-art" style="background-image:linear-gradient(90deg,rgba(16,12,10,.9),rgba(16,12,10,.25)),url('${urlFor('cover')}')"></div>
      <div class="ending-copy">
        <p class="eyebrow">第 6 日 · 风月总账</p>
        <h1>${end.title}</h1>
        <p class="ending-tag">${end.tag}${end.heroineName ? ` · ${end.heroineName}` : ''}${end.routeResult ? ` · ${end.routeResult}` : ''}</p>
        <p>${end.text}</p>
        <div class="ending-ledger">
          <span>最深关系 <b>${HEROINES[top].name} · ${E.relationTier(state.relations[top].qing, 'qing')}</b></span>
          <span>已得册页 <b>${loadGallery().length}/7</b></span>
          <span>用过秘密 <b>${state.secretsUsed.length}</b></span>
          <span>未见路线 <b>${end.unseen.length}</b></span>
        </div>
        <div class="household-ending">${end.householdResults.map((item) => `<span><b>${item.name}</b>${item.result}</span>`).join('')}</div>
        <p class="ending-note">天一亮，正堂那边已经有人翻开账簿。门外又响了两声。</p>
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

function appendGallery() {
  const unlocked = new Set(loadGallery());
  const groups = [
    ['吴月娘', ['yue_prelude', 'yue_explicit']],
    ['潘金莲', ['pan_prelude', 'pan_explicit']],
    ['李瓶儿', ['pinger_prelude', 'pinger_explicit']],
    ['同场', ['banquet_conflict']],
  ];
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';
  overlay.id = 'gallery-modal';
  overlay.innerHTML = `<section class="gallery-book" role="dialog" aria-modal="true" aria-label="场景册" ${gallerySceneId ? 'inert' : ''}>
    <header><div><p class="eyebrow">不会丢的册页</p><h2>${TEXT.gallery} <span>${unlocked.size}/7</span></h2><p>${TEXT.galleryKeep}</p></div><button class="plain-button" id="btn-gallery-close">${TEXT.close}</button></header>
    <div class="gallery-grid">${groups.map(([name, ids]) => `<section><h3>${name}</h3><div>${ids.map((id) => galleryCard(SCENES[id], unlocked.has(id))).join('')}</div></section>`).join('')}</div>
  </section>${gallerySceneId ? galleryReplay(SCENES[gallerySceneId]) : ''}`;
  app.appendChild(overlay);
}

function galleryCard(scene, open) {
  return `<button class="gallery-card ${open ? 'unlocked' : 'locked'}" data-gallery-scene="${scene.id}" ${open ? `data-gallery-open="${scene.id}"` : 'disabled'}>
    ${open ? `<img src="${urlFor(scene.asset)}" alt="${scene.title}"/>` : '<div class="locked-art" aria-label="未解锁">未</div>'}
    <div><b>${open ? scene.title : '题签未开'}</b><small>${open ? (scene.tier === 'public' ? '中秋同席' : scene.tier === 'explicit' ? '那夜留宿' : '帘前一步') : lockedHint(scene.id)}</small></div>
  </button>`;
}

function galleryReplay(scene) {
  return `<article class="gallery-replay" id="gallery-replay" data-replay-scene="${scene.id}" role="dialog" aria-modal="true" aria-label="重看${scene.title}">
    <img id="gallery-replay-image" src="${urlFor(scene.asset)}" alt="${scene.title}"/>
    <div class="gallery-replay-copy">
      <p class="eyebrow">${scene.tier === 'public' ? '再看中秋席' : '18+ · 翻回那一夜'}</p>
      <h2>${scene.title}</h2>
      <p>${scene.body}</p>
      <p class="replay-note">这次只看画，不改已经走过的路。</p>
      <button class="ink-button primary" id="btn-gallery-replay-close">合上这一页</button>
    </div>
  </article>`;
}

function lockedHint(sceneId) {
  if (sceneId === 'banquet_conflict') return '等中秋开席';
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
  if (!audioReady) { audioReady = true; audio.unlock(); audio.playBGM(state ? 'act1' : 'title'); }
  audio.sfx('click');

  if (button.id === 'btn-age-yes') {
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
  else if (button.id === 'btn-scene-close') act(() => E.closeScene(state));
  else if (button.dataset.opening) act(() => E.chooseOpening(state, button.dataset.opening));
  else if (button.dataset.dayAction) act(() => E.chooseDayAction(state, button.dataset.dayAction));
  else if (button.dataset.household) act(() => E.resolveHouseholdEvent(state, button.dataset.household));
  else if (button.dataset.banquet) act(() => E.chooseBanquet(state, button.dataset.banquet));
  else if (button.dataset.visit) act(() => E.startVisit(state, button.dataset.visit));
  else if (button.dataset.routeChoice) act(() => E.chooseVisit(state, button.dataset.routeChoice));
  else if (button.dataset.night) act(() => E.chooseNight(state, button.dataset.night));
  else if (button.dataset.morning) act(() => E.resolveMorning(state, button.dataset.morning));
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
  household: (id) => act(() => E.resolveHouseholdEvent(state, id)),
  chooseBanquet: (id) => act(() => E.chooseBanquet(state, id)),
  visit: (id) => act(() => E.startVisit(state, id)),
  chooseVisit: (id) => act(() => E.chooseVisit(state, id)),
  chooseNight: (id) => act(() => E.chooseNight(state, id)),
  morning: (id) => act(() => E.resolveMorning(state, id)),
  closeScene: () => act(() => E.closeScene(state)),
});
