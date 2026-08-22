import { TEXT } from './text.js';
import {
  HEROINES, HEROINE_IDS, HOUSEHOLD, HOUSEHOLD_IDS, HOUSEHOLD_EVENTS,
  OPENING_CHOICES, ROUTE_CHOICES, ROUTE_BRANCHES, ACCORD_CHOICES, JOINT_ACTIONS, SHARED_NIGHT_CHOICES, DAY_AGENDAS,
  ALLIANCE_ASSEMBLY_RESPONSES, ALLIANCE_VOICES, SHARED_AFTERGLOW_BEATS, PUBLIC_EVENTS, PUBLIC_EVIDENCE_CHAIN, PUBLIC_FOLLOWUPS, ACT_TRANSITIONS, EXTERNAL_REBUTTALS, FINAL_RECKONING, COUNCIL_EVENTS, DUSK_INVITATIONS, DUSK_INVITATION_AFTERMATHS, PERSONAL_AFTERGLOW_AFTERMATHS, NIGHT_TEXT, SCENES,
} from './data.js';
import * as E from './engine.js';
import { ASSET_PATHS, loadAssets, preloadSafeAssets, preloadFinaleAssets, assetReport, urlFor, assertCriticalAssetSchema } from './assets.js';
import { audio } from './audio.js';

const SAVE_KEY = 'jpm_fengyue_save_v66';
const GALLERY_KEY = 'jpm_fengyue_gallery_v1';
const ENDING_ARCHIVE_KEY = 'jpm_fengyue_endings_v1';
const ENDING_ARCHIVE_MAX_CHARS = 2400000;
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
let galleryVariantIndex = 0;
let resultCard = null;
let toastTimer = null;
let audioReady = false;
let safePreloadStarted = false;
let finalePreloadStarted = false;
const narrativeAssetLoads = new Set();
let pendingFocusSelector = null;
let galleryReturnSelector = null;
let newGameConfirmOpen = false;
let rosterOpen = false;
let epilogueOpen = false;
let epilogueIndex = 0;
let epilogueReturnSelector = null;
let archivedEpilogueKey = null;
let fateCodaOpen = false;
let fateCodaReturnSelector = null;
let archivedFateKey = null;
let archivedFateVariantIndex = 0;
let archivedFatePageIndex = 0;

assertCriticalAssetSchema();
assets = assetReport();
const bootPromise = boot();

async function boot() {
  // 年龄门先可读、可操作；确认前只允许浏览器请求安全背景和标题图。
  render();
  assets = await loadAssets();
  if (!assets.bootReady && params.get('dev') !== '1') {
    renderAssetFailure(assets.missingCritical);
    return;
  }
  render();
  if (ageConfirmed()) scheduleSafePreload();
}

function scheduleSafePreload() {
  if (safePreloadStarted) return;
  safePreloadStarted = true;
  const start = () => preloadSafeAssets().then((report) => {
    assets = report;
    if (report.missingCritical.length && params.get('dev') !== '1') renderAssetFailure(report.missingCritical);
  });
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1800 });
  else setTimeout(start, 120);
}

function scheduleFinalePreload(immediate = false) {
  if (finalePreloadStarted) return;
  finalePreloadStarted = true;
  const start = () => preloadFinaleAssets().then((report) => {
    assets = report;
    if (report.missingCritical.length && params.get('dev') !== '1') renderAssetFailure(report.missingCritical);
  });
  if (!immediate && 'requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1800 });
  else if (!immediate) setTimeout(start, 120);
  else start();
}

function ensureNarrativeAsset(key) {
  if (!key || narrativeAssetLoads.has(key)) return;
  narrativeAssetLoads.add(key);
  loadAssets([key]).then((report) => {
    assets = report;
    if (report.missingCritical.includes(key) && params.get('dev') !== '1') renderAssetFailure([key]);
  });
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

const ENDING_GOALS = Object.freeze([
  { id: 'balanced', label: '五院同灯', hint: '让五院都留下，再由余夜与天明选择一种共处制度。' },
  { id: 'pair', label: '双院同灯', hint: '不强求五院圆满，让一对真正互信的女人结成有限同盟。' },
  { id: 'triad', label: '三院成盟', hint: '三人内部每一对都能同桌，才不是靠一条强关系硬拉成团。' },
  { id: 'quad', label: '四院共席', hint: '四个人都由本人留下，系统不再替她们裁掉一席。' },
  { id: 'exclusive', label: '一院灯深', hint: '走深一人的情与欲，也承担另外四院收回钥匙的结果。' },
  { id: 'intrigue', label: '借局翻身', hint: '用证据、银势和官面赢下外账，接受宅内关系留下的代价。' },
  { id: 'unstable', label: '五门各闭', hint: '没有制度托住的偏爱会怎样散掉，也会被总账如实记下。' },
]);

function endingFamily(ending) {
  if (ending?.id === 'alliance') return ({ 2:'pair', 3:'triad', 4:'quad' })[ending.alliance?.length] ?? null;
  return ending?.id ?? null;
}

function endingArchiveEntry(gameState) {
  const ending = gameState?.ending;
  if (!ending?.id || gameState.phase !== 'ending') return null;
  const family = endingFamily(ending);
  const collapseVariant = ending.collapseResult?.choice ? `:${ending.collapseResult.choice}` : '';
  const sceneArchives = E.endingSceneArchives(gameState);
  const scenes = Object.fromEntries(sceneArchives.map((record) => [record.scene, record]));
  const sceneVariant = sceneArchives.map((record) => record.key).join('::');
  const variant = ending.id === 'balanced' ? `${ending.coalitionStyle}:${ending.sharedAfterglowTableau?.key ?? 'no-afterglow'}${sceneVariant ? `:${sceneVariant}` : ''}`
    : ending.id === 'alliance' ? `${ending.alliance?.join('+')}:${ending.allianceTableau?.key ?? 'no-tableau'}${sceneVariant ? `:${sceneVariant}` : ''}`
      : ending.id === 'exclusive' ? ending.heroine
        : ending.id === 'intrigue' ? `${ending.intrigueCost}${collapseVariant}`
          : `${ending.missedBy}${collapseVariant}`;
  return {
    key: `${ending.id}:${variant || 'default'}`,
    family,
    title: ending.title,
    tag: ending.routeResult || ending.tag,
    cast: ending.allianceName || ending.heroineName || '',
    text: ending.text,
    seed: gameState.seed,
    scenes,
    afterstory:E.endingAfterstoryArchive(gameState),
    fates:[E.endingFateArchive(gameState)].filter(Boolean),
  };
}

function loadEndingArchive() {
  try {
    const value = JSON.parse(localStorage.getItem(ENDING_ARCHIVE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((row) => row && typeof row.key === 'string' && typeof row.title === 'string' && typeof row.text === 'string');
  } catch {
    return [];
  }
}

function rememberEnding(gameState) {
  const entry = endingArchiveEntry(gameState);
  if (!entry) return;
  const archive = loadEndingArchive();
  const previous = archive.find((row) => row.key === entry.key);
  const seeds = [...new Set([...(previous?.seeds ?? (Number.isInteger(previous?.seed) ? [previous.seed] : [])), entry.seed])].slice(-6);
  const previousFates = Array.isArray(previous?.fates) ? previous.fates : previous?.fate ? [previous.fate] : [];
  const fates = [...entry.fates, ...previousFates]
    .filter((fate, index, rows) => fate?.key && rows.findIndex((row) => row?.key === fate.key) === index)
    .slice(0, 9);
  const current = { ...previous, ...entry, seeds, fates };
  delete current.fate;
  const candidates = [current, ...archive.filter((row) => row.key !== entry.key)].slice(0, 24);
  const next = [];
  for (const candidate of candidates) {
    const trial = [...next, candidate];
    if (JSON.stringify(trial).length <= ENDING_ARCHIVE_MAX_CHARS) next.push(candidate);
  }
  localStorage.setItem(ENDING_ARCHIVE_KEY, JSON.stringify(next));
}

function save() {
  if (!state) return;
  localStorage.setItem(SAVE_KEY, E.serialize(state));
  const merged = [...new Set([...loadGallery(), ...state.unlocked])];
  localStorage.setItem(GALLERY_KEY, JSON.stringify(merged));
  rememberEnding(state);
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
  newGameConfirmOpen = false;
  epilogueOpen = false;
  archivedEpilogueKey = null;
  fateCodaOpen = false;
  archivedFateKey = null;
  archivedFateVariantIndex = 0;
  archivedFatePageIndex = 0;
  state = E.newGame(SEED);
  localStorage.removeItem(SAVE_KEY);
  save();
  render();
}

function continueGame() {
  newGameConfirmOpen = false;
  const loaded = loadSave();
  if (!loaded) return showToast('这本旧账接不上了，只好从第一日重开。');
  state = loaded;
  rememberEnding(state);
  render();
  focusSoon(firstPhaseActionSelector());
}

function restart(sameSeed = false) {
  const seed = sameSeed ? state.seed : E.nextSeed(state.seed);
  epilogueOpen = false;
  epilogueIndex = 0;
  archivedEpilogueKey = null;
  fateCodaOpen = false;
  archivedFateKey = null;
  archivedFateVariantIndex = 0;
  archivedFatePageIndex = 0;
  state = E.newGame(seed);
  localStorage.removeItem(SAVE_KEY);
  save();
  render();
}

function selectorForButton(button) {
  if (button.id) return `#${CSS.escape(button.id)}`;
  const key = Object.keys(button.dataset)[0];
  if (!key) return null;
  const attr = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `[data-${attr}="${CSS.escape(button.dataset[key])}"]`;
}

function focusSoon(selector) {
  pendingFocusSelector = selector;
  requestAnimationFrame(() => {
    const target = pendingFocusSelector ? document.querySelector(pendingFocusSelector) : null;
    if (target instanceof HTMLElement && !target.hasAttribute('disabled')) target.focus();
    pendingFocusSelector = null;
  });
}

function firstPhaseActionSelector() {
  return '#phase-stage button:not([disabled])';
}

function inertBackgroundExcept(overlay) {
  for (const child of app.children) {
    if (child !== overlay) child.inert = true;
  }
}

function sfxForPhase() {
  if (!state) return;
  const map = { opening_aftermath: 'paper', day: 'wang', day_aftermath: 'paper', crisis: 'plank', crisis_aftermath: 'plank', pair_interlude: 'qing', favor_reckoning: 'submit', memory_reckoning: 'paper', act_transition: 'submit', act_aftermath: 'paper', joint_result: 'submit', portable_precedent: 'paper', household: 'paper', household_aftermath: 'paper', council: 'submit', council_aftermath: 'paper', visit: 'paper', route_aftermath: 'submit', night: 'watch', morning: 'plank', scene: 'qing', personal_afterglow: 'watch', personal_afterglow_aftermath: 'watch', personal_finale: 'qing', personal_finale_result: 'qing', banquet: 'submit', public_evidence: 'paper', public_followup: 'paper', public_aftermath: 'paper', five_private_prices: 'paper', final_reckoning: 'submit', final_aftermath: 'paper', dusk_invitation: 'watch', dusk_invitation_aftermath: 'watch', alliance_assembly: 'paper', alliance_night: 'qing', alliance_night_result: 'qing', shared_night: 'submit', shared_afterglow: 'watch', shared_afterglow_result: 'watch', shared_dawn: 'plank', shared_dawn_result: 'paper', collapse_finale: 'submit', collapse_finale_result: 'paper', ending: 'qing' };
  audio.sfx(map[state.phase] ?? 'click');
}

function bgmCue() {
  if (!state) return 'title';
  if (state.phase === 'ending') {
    if (['balanced', 'alliance', 'exclusive'].includes(state.ending?.id)) return 'ending_liyanei';
    if (state.ending?.id === 'unstable') return 'ending_liuluo';
    return 'ending_other';
  }
  return `act${Math.min(4, Math.ceil(state.day / 5))}`;
}

function syncBGM() {
  if (audioReady) audio.playBGM(bgmCue());
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
  // 延迟追账本身就是上一选择的完整剧情回收；再叠一张晨间结果卡会在窄屏
  // 遮住第三个回应，反而把“有后果”重新做成必须先清掉的 UI 噪声。
  if (result.text && !['opening_aftermath', 'scene', 'day_aftermath', 'joint_result', 'portable_precedent', 'morning_settlement', 'council_aftermath', 'public_evidence', 'public_aftermath', 'act_aftermath', 'five_private_prices', 'final_aftermath', 'crisis', 'crisis_aftermath', 'pair_interlude', 'household', 'household_aftermath', 'council', 'banquet', 'public_followup', 'final_reckoning', 'morning', 'act_transition', 'route_aftermath', 'favor_reckoning', 'memory_reckoning', 'dusk_invitation', 'dusk_invitation_aftermath', 'personal_afterglow_aftermath', 'personal_finale', 'personal_finale_result', 'alliance_night', 'alliance_night_result', 'shared_afterglow_result', 'shared_dawn_result', 'collapse_finale', 'collapse_finale_result', 'ending'].includes(state.phase)) {
    resultCard = { title: label || '这句话落下了', text: result.text };
  } else if (result.text && result.scene) {
    resultCard = { title: label || '这一笔有了回声', text: result.text };
  }
  render();
  if (result.announcement) {
    const announcer = document.getElementById('announcer');
    if (announcer) announcer.textContent = result.announcement;
  }
  if (fateCodaOpen) {
    const fate = E.currentFateCoda(state);
    focusSoon(fate?.awaitingChoice ? '[data-fate-coda]' : fate?.page === fate?.count - 1 ? '#btn-fate-coda-finish' : '[data-fate-coda-continue]');
  } else if (state.phase === 'ending') focusSoon('#ending-view h1');
  else if (['five_private_prices', 'portable_precedent'].includes(state.phase)) focusSoon('#phase-stage .phase-header h2');
  else if (state.phase === 'personal_finale_result' && E.currentPersonalFinaleResult(state)?.departure) focusSoon('#phase-stage .phase-header h2');
  else focusSoon(firstPhaseActionSelector());
}

function render() {
  if (ageConfirmed() && state?.day >= 16) {
    scheduleFinalePreload(['personal_finale', 'personal_finale_result', 'ending'].includes(state.phase));
  }
  if (!ageConfirmed()) renderAgeGate();
  else if (!assets?.bootReady) {
    app.innerHTML = '<div class="loading">只装订封面与宅院，稍候。</div>';
  } else if (!state) renderTitle();
  else renderGame();
  syncBGM();
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
  focusSoon('#btn-age-yes');
}

function renderTitle() {
  const saved = loadSave();
  const hasSave = !!saved;
  app.innerHTML = `
    <main class="title-screen">
      <div class="title-art" style="background-image:url('${urlFor('cover')}')" role="img" aria-label="月娘、金莲、瓶儿、玉楼与雪娥各据一处，五道视线都落在你身上"></div>
      <section class="title-copy">
        <p class="eyebrow">成人后宫关系游戏 · 二十日四幕</p>
        <h1>${TEXT.title}</h1>
        <p class="title-subtitle">${TEXT.subtitle}</p>
        <p class="identity-line">${TEXT.identity}</p>
        <div class="title-actions">
          <button class="ink-button primary" id="btn-start">${hasSave ? '另开新局' : TEXT.start}</button>
          <button class="ink-button" id="btn-continue" ${hasSave ? '' : 'disabled'}>${hasSave ? `接着第 ${saved.day} 日` : TEXT.continue}</button>
          <button class="ink-button" id="btn-gallery">${TEXT.gallery}</button>
        </div>
        <p class="rating-line">${TEXT.rating}</p>
        <p class="save-note">${TEXT.saveNote}</p>
      </section>
    </main>`;
  if (newGameConfirmOpen && hasSave) appendNewGameConfirm(saved);
  if (galleryOpen) appendGallery();
  if (epilogueOpen) appendEpilogue();
  if (fateCodaOpen) appendFateCoda();
  if (!newGameConfirmOpen && !galleryOpen) focusSoon(hasSave ? '#btn-continue' : '#btn-start');
}

function appendNewGameConfirm(saved) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'new-game-confirm';
  overlay.innerHTML = `<section class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="new-game-title">
    <p class="eyebrow">这一步会改写当前账页</p>
    <h2 id="new-game-title">另开一局？</h2>
    <p>现有进度停在第 ${saved.day} 日。另开后，这一局的自动存档会被覆盖；已经收入场景册的册页仍会保留。</p>
    <div class="button-row"><button class="ink-button primary" id="btn-confirm-new">确认另开</button><button class="ink-button" id="btn-cancel-new">保留旧局</button></div>
  </section>`;
  app.appendChild(overlay);
  inertBackgroundExcept(overlay);
  focusSoon('#btn-cancel-new');
}

function renderGame() {
  const day = E.dayDef(state);
  const content = renderPhase();
  const obligations = E.activeObligations(state);
  const notice = hudNotice(obligations);
  const noticeMarkup = notice.text
    ? `<p class="hud-notice ${notice.tone}" aria-live="polite">${notice.text}</p>`
    : '<p class="hud-notice quiet" aria-live="polite"></p>';
  app.innerHTML = `
    <main class="game-shell" id="game-shell" data-phase="${state.phase}" data-act="${Math.min(4, Math.ceil(state.day / 5))}">
      <header class="topbar">
        <div class="day-mark"><b id="day-num">第 ${state.day} 日</b><span>${escapeHtml(day.act)}</span></div>
        ${noticeMarkup}
        <div class="top-actions">
          <button class="plain-button roster-button" id="btn-roster" aria-label="打开完整账册${obligations.length ? '，有旧话待结' : ''}">账册${obligations.length ? ' · 待办' : ''}</button>
          <button class="plain-button" id="btn-gallery">${TEXT.gallery}</button>
          <button class="plain-button" id="btn-mute">${audio.muted ? TEXT.muteOn : TEXT.muteOff}</button>
        </div>
      </header>
      <div class="play-area">
        <section class="phase-stage" id="phase-stage">
          ${content}
        </section>
      </div>
    </main>`;
  collapseSupportingContext(document.getElementById('phase-stage'));
  if (rosterOpen) appendRoster();
  if (resultCard && !rosterOpen && !galleryOpen && !epilogueOpen && !fateCodaOpen) appendResultCard();
  if (galleryOpen) appendGallery();
  if (epilogueOpen) appendEpilogue();
  if (fateCodaOpen) appendFateCoda();
}

function collapseSupportingContext(root) {
  if (!root) return;
  const selector = [
    '.council-external-echo', '.opening-public-echo', '.act-source-echo', '.public-evidence-echo',
    '.route-branch-memory', '.intimacy-memory', '.ordinary-night-memory', '.night-conversation-life-memory',
    '.pair-interlude-memory', '.household-memory', '.crisis-reply-ledger', '.pair-aftermath-transcript',
    '.route-resolution-transcript', '.aftermath-echo', '.aftermath-pair-memory', '.aftermath-route-stake',
    '.memory-thread', '.favor-thread', '.private-price-ledger', '.final-reckoning-cast',
    '.public-followup-cast', '.external-witnesses', '.crisis-ledger', '.crisis-rule',
    '.pair-trust', '.pair-rule', '.collapse-result-transcript', '.route-beat-archive',
    '.public-evidence-long-brief', '.final-aftermath-long-brief',
  ].join(',');
  root.querySelectorAll('.decision-panel').forEach((panel) => {
    if (panel.closest('.roster-overlay, .gallery-overlay, .epilogue-overlay')) return;
    const rows = [...panel.children].filter((child) => child.matches(selector));
    if (!rows.length) return;
    const details = document.createElement('details');
    details.className = 'supporting-context';
    let label = '前情与依据';
    if (rows.some((row) => row.matches('.route-beat-archive'))) label = '本拍完整叙述';
    else if (rows.some((row) => row.matches('.public-evidence-long-brief'))) label = '完整案情与前证';
    else if (rows.some((row) => row.matches('.final-aftermath-long-brief'))) label = '完整来路与旧账';
    else if (panel.classList.contains('dialogue-panel')) label = '此前关系史';
    else if (panel.classList.contains('household-panel')) label = '影响这笔交易的旧账';
    else if (panel.classList.contains('final-reckoning-panel') || panel.classList.contains('final-aftermath-panel')) label = '走到终局的旧账';
    else if (panel.classList.contains('public-evidence-panel') || panel.classList.contains('public-followup-panel') || panel.classList.contains('public-aftermath-panel')) label = '影响本场裁决的前情';
    details.innerHTML = `<summary><b>${label}</b><span>${rows.length} 笔旧事</span></summary><div class="supporting-context-pages"></div>`;
    rows[0].before(details);
    details.querySelector('.supporting-context-pages').append(...rows);
  });
}

function appendRoster() {
  const overlay = document.createElement('div');
  overlay.className = 'roster-overlay';
  overlay.id = 'roster-modal';
  overlay.innerHTML = `<section class="roster-sheet" role="dialog" aria-modal="true" aria-labelledby="roster-title">
    <header><div><p class="eyebrow">需要时再翻，不挤占正戏</p><h2 id="roster-title">宅门账册</h2></div><button class="plain-button" id="btn-roster-close">合上</button></header>
    <div class="roster-scroll">
      <section class="ledger-status" aria-label="外账风向"><header><b>外账风向</b><span>只记当前处境，不把数目压在戏上</span></header><div class="ledger-resources">
        ${resourceChip('银', state.resources.silver, 'silver')}
        ${resourceChip('势', state.resources.power, 'power')}
        ${resourceChip('声', state.resources.repute, 'repute')}
        ${resourceChip('宅', state.resources.house, 'house')}
        ${resourceChip('露', state.resources.exposure, 'exposure')}
        ${resourceChip('耗', state.resources.strain, 'strain')}
      </div></section>
      <section class="roster-relations" aria-label="五院人物账">${HEROINE_IDS.map(renderRelationCard).join('')}</section>
      ${renderHaremOutlook()}${renderObligationBoard(false)}${renderBondBoard(true)}
      <section class="ledger-book">${renderLedger()}</section>
      <section class="household-roster"><p>宅中人</p>${HOUSEHOLD_IDS.map(renderHouseholdRow).join('')}</section>
    </div>
  </section>`;
  app.appendChild(overlay);
  inertBackgroundExcept(overlay);
  focusSoon('#btn-roster-close');
}

function resourceCondition(key, value) {
  if (key === 'silver') return value <= 0 ? '见底' : value < 40 ? '告急' : value < 100 ? '吃紧' : value < 180 ? '可周转' : '宽裕';
  if (key === 'power') return value <= 0 ? '无势' : value <= 2 ? '势薄' : value <= 4 ? '可借' : '得力';
  if (key === 'repute') return value <= 0 ? '无声' : value <= 2 ? '声轻' : value <= 4 ? '有人听' : '传得开';
  if (key === 'house') return value < 25 ? '将散' : value < 50 ? '动荡' : value < 75 ? '尚稳' : '齐整';
  if (key === 'exposure') return value <= 0 ? '无风' : value < 20 ? '微闻' : value < 45 ? '风声起' : value < 70 ? '已见光' : '满城闻';
  return value <= 0 ? '从容' : value < 20 ? '尚轻' : value < 45 ? '劳累' : value < 70 ? '难支' : '将溃';
}

function hudNotice(obligations) {
  if (obligations.some((row) => ['overdue', 'due'].includes(row.status))) return { tone: 'urgent', text: '有人今日等你还话' };
  if (obligations.some((row) => row.status === 'locked')) return { tone: 'watch', text: '有一扇门暂不留话' };
  if (state.resources.silver < 40) return { tone: 'urgent', text: '银钱已经告急' };
  if (state.resources.house < 50) return { tone: 'urgent', text: '宅门正在动荡' };
  if (state.resources.exposure >= 45) return { tone: 'watch', text: '外头风声已紧' };
  if (state.resources.strain >= 45) return { tone: 'watch', text: '众人已经难支' };
  return { tone: 'quiet', text: '' };
}

function resourceChip(glyph, value, key) {
  const condition = resourceCondition(key, value);
  return `<div class="resource-chip ${key}" data-resource="${key}" data-resource-value="${value}" aria-label="${glyph}：${condition}"><span>${glyph}</span><b>${condition}</b></div>`;
}

function narrativeProgress(value, target, labels = ['尚未成形', '正在成形', '已经落定']) {
  if (value <= 0) return labels[0];
  if (value >= target) return labels[2];
  return labels[1];
}

function narrativeStep(index, count, labels = ['起笔', '转折', '收束']) {
  if (count <= 1 || index <= 1) return labels[0];
  if (index >= count) return labels[2];
  return labels[1];
}

function narrativeBeatMark(index) {
  return ['起', '承', '转', '结'][index] ?? '续';
}

function narrativeChoiceMeta(value) {
  if (!value) return '';
  const resourceEffects = {
    银: { '+': '银钱回笼', '-': '要花银钱' },
    势: { '+': '官面更有余地', '-': '官面借势收窄' },
    声: { '+': '名声传开', '-': '名声受损' },
    宅: { '+': '宅门更稳', '-': '宅门更乱' },
    露: { '+': '风声见光', '-': '风声暂歇' },
    耗: { '+': '耗损加重', '-': '得以喘息' },
  };
  const normalized = String(value)
    .replace(/([银势声宅露耗])\s*([+＋−-])\s*\d+(?:\s*两)?/g, (_, key, sign) => resourceEffects[key][sign === '+' || sign === '＋' ? '+' : '-'])
    .replace(/(?:两院|院间)互信\s*([+＋−-])\s*\d+/g, (_, sign) => (sign === '+' || sign === '＋' ? '两院更能互信' : '两院更相提防'))
    .replace(/情\s*([+＋−-])\s*\d+/g, (_, sign) => (sign === '+' || sign === '＋' ? '情意更深' : '情意转淡'))
    .replace(/欲\s*([+＋−-])\s*\d+/g, (_, sign) => (sign === '+' || sign === '＋' ? '更愿亲近' : '亲近退后'))
    .replace(/妒\s*([+＋−-])\s*\d+/g, (_, sign) => (sign === '+' || sign === '＋' ? '妒意上升' : '妒意缓下'));
  const seen = new Set();
  return normalized.split('·').map((part) => part.trim().replace(/\s*[+＋−-]\s*\d+\s*$/, '').trim()).filter((part) => {
    if (!part || seen.has(part)) return false;
    seen.add(part);
    return true;
  }).join(' · ');
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
  const stance = E.routeStance(state, id);
  const habit = E.nightRelationshipPattern(state, id);
  const arrangement = E.latestIntimacyArrangement(state, id);
  const reason = rel.reasons[0] || heroine.want;
  const changed = tierChanges(id, rel);
  const mark = (kind) => (changed[kind] ? ` data-changed="${changed[kind]}"` : '');
  return `
    <article class="relation-card relation-${id}" data-heroine="${id}" data-qing="${rel.qing}" data-yu="${rel.yu}" data-du="${rel.du}">
      <div class="relation-name"><span class="shape-mark">${heroine.glyph}</span><div><b>${heroine.name}</b><small>${heroine.house} · ${stance.tone}</small></div></div>
      <div class="relation-tiers">
        <span${mark('qing')}>情 <b>${E.relationTier(rel.qing, 'qing')}</b></span>
        <span${mark('yu')}>欲 <b>${E.relationTier(rel.yu, 'yu')}</b></span>
        <span${mark('du')}>妒 <b>${E.relationTier(rel.du, 'du')}</b></span>
      </div>
      <span class="relation-habit ${habit.settled ? 'settled' : ''}" data-night-pattern="${habit.id || 'forming'}" ${arrangement ? `data-intimacy-arrangement="${arrangement.id}"` : ''} title="${escapeHtml([habit.summary, arrangement?.future].filter(Boolean).join(' '))}">夜谈 · ${escapeHtml(habit.label)} · ${narrativeProgress(habit.chapters, 4, ['尚在试探', '话已接上', '已成条款'])}${arrangement ? ` · 约：${escapeHtml(arrangement.label)}` : ''}</span>
      <p>${escapeHtml(reason)}</p>
    </article>`;
}

function intimacyMemory(heroineId) {
  const arrangements = E.intimacyArrangements(state, heroineId);
  if (!arrangements.length) return '';
  return `<aside class="intimacy-memory" aria-label="此前亲密约定"><header><b>她仍按以前的约定生活</b><span>${arrangements.length > 1 ? '两项都在执行' : '已有一项约定'}</span></header>${arrangements.map((row) => `<div data-intimacy-memory="${row.id}"><small>${row.tier === 'explicit' ? '留宿后约' : '前奏后约'} · 第 ${row.day} 夜</small><b>${escapeHtml(row.label)} · ${escapeHtml(row.title)}</b><p>${escapeHtml(row.outcome)}</p><em>次晨：${escapeHtml(row.morning)} 此后：${escapeHtml(row.future)}</em></div>`).join('')}</aside>`;
}

function ordinaryNightMemory(heroineId) {
  const memories = E.ordinaryNightMemories(state, heroineId);
  if (!memories.length) return '';
  return memories.map((memory) => `<aside class="ordinary-night-memory" data-ordinary-night-memory="${memory.event}" aria-label="她记得这段普通夜章"><small>普通夜章 · ${memory.count > 1 ? `第 ${memory.firstDay}—${memory.day} 夜反复发生` : `第 ${memory.day} 夜`} · ${escapeHtml(memory.actionLabel)}</small><b>${escapeHtml(memory.title)}</b><p>${escapeHtml(memory.morning)}</p></aside>`).join('');
}

function nightConversationMemory(heroineId) {
  const memories = E.nightConversationMemories(state, heroineId);
  const memory = memories.at(-1);
  if (!memory) return '';
  return `<aside class="night-conversation-life-memory" data-night-conversation-memory="${memory.event}:${memory.mode}" aria-label="专属夜谈已经进入长期生活"><small>专属夜谈 · ${narrativeProgress(memory.chapter, 4, ['刚刚起话', '已经接续', '已成相处条款'])} · ${escapeHtml(memory.prop)} · ${escapeHtml(memory.modeLabel)}</small><b>${escapeHtml(memory.title)}</b><span class="stake">实际执行 · ${escapeHtml(memory.stakeLabel)} · ${escapeHtml(narrativeChoiceMeta(memory.stakeResourceText))}</span><p>${escapeHtml(memory.future)}</p><em>${escapeHtml(memory.observerName)}也接到了这一笔：${escapeHtml(memory.observerLine)}</em></aside>`;
}

function routeReckoningMemory(heroineId) {
  const memories = E.routeReckoningMemories(state, heroineId);
  if (!memories.length) return '';
  return memories.map((memory) => `<aside class="night-conversation-life-memory route-reckoning-life-memory" data-route-reckoning-memory="${memory.event}:${memory.sourceDay}:${memory.choice}" aria-label="两日后旧话裁决仍在执行"><small>已结旧话 · 第 ${memory.sourceDay} 日后约 · 第 ${memory.day} 日由${escapeHtml(memory.observerName)}见证</small><b>${escapeHtml(memory.stakeLabel)} · ${escapeHtml(memory.choiceLabel)}</b><span class="stake">当时执行 · ${escapeHtml(memory.stakeText)} · ${escapeHtml(narrativeChoiceMeta(memory.stakeResourceText))}</span><p>${escapeHtml(memory.incident)} ${escapeHtml(memory.outcome)}</p><em>${escapeHtml(memory.observerName)}当日这样质询：${escapeHtml(memory.observerText)} 只追这一件：${escapeHtml(memory.question)}</em></aside>`).join('');
}

function favorReckoningMemory(heroineId) {
  const memories = E.favorReckoningMemories(state, heroineId);
  if (!memories.length) return '';
  return memories.map((memory) => `<aside class="night-conversation-life-memory favor-reckoning-life-memory" data-favor-reckoning-memory="${memory.event}:${memory.sourceDay}:${memory.choice}" aria-label="人情还账仍在执行"><small>已结人情 · 第 ${memory.sourceDay} 日借力 · 第 ${memory.day} 日由${escapeHtml(memory.observerName)}见证</small><b>${escapeHtml(memory.debtTitle)} · ${escapeHtml(memory.choiceLabel)}</b><span class="stake">当时借力 · ${escapeHtml(memory.sourceLabel)} · ${escapeHtml(memory.sourceText)}</span><p>${escapeHtml(memory.debtBody)} ${escapeHtml(memory.outcome)}</p><em>${escapeHtml(memory.observerName)}当日也把代价摆上长案：${escapeHtml(memory.observerLine)}</em></aside>`).join('');
}

function pairInterludeMemory(heroineId) {
  const memories = E.pairInterludeMemories(state, heroineId);
  if (!memories.length) return '';
  return memories.map((memory) => `<aside class="pair-interlude-memory" data-pair-memory="${memory.event}:${memory.choice}" aria-label="她与旁院已经建立的关系"><small>双院关系 · 第 ${memory.day} 日 · 与${escapeHtml(HEROINES[memory.partner].short)} · ${escapeHtml(memory.label)}</small><b>${escapeHtml(memory.title)}</b><p>${escapeHtml(memory.memory)}</p></aside>`).join('');
}

function duskInvitationMemory(heroineId) {
  const memory = E.duskInvitationMemory(state, heroineId);
  if (!memory) return '';
  return `<aside class="pair-interlude-memory dusk-invitation-memory" data-dusk-invitation-memory="${memory.event}:${memory.approach}:${memory.choice}" aria-label="她主动提出的邀约已经成为长期安排"><small>主动邀约 · 第 ${memory.day} 日 · ${escapeHtml(memory.approachLabel)} · ${escapeHtml(memory.witnessName)}见证</small><b>${escapeHtml(memory.title)}</b><span class="stake">她当时主动说 · ${escapeHtml(memory.heroineLine)}</span><p>${escapeHtml(memory.outcome)}</p><em>${escapeHtml(memory.witnessName)}没有退出后果：${escapeHtml(memory.witnessQuestion)}</em></aside>`;
}

function rivalryMorningMemory(heroineId) {
  const memories = E.rivalryMorningMemories(state, heroineId);
  if (!memories.length) return '';
  return memories.map((memory) => `<aside class="pair-interlude-memory rivalry-morning-memory" data-rivalry-memory="${memory.day}:${memory.actor}:${memory.visited}:${memory.choice}" aria-label="偏宠对峙仍是双方关系史"><small>偏宠对峙 · 第 ${memory.day} 日 · ${memory.role === 'challenger' ? '她发难' : '她是昨夜被选择的一院'} · 与${escapeHtml(memory.otherName)}</small><b>${escapeHtml(memory.title)} · ${escapeHtml(memory.choiceLabel)}</b><span class="stake">她当面说 · ${escapeHtml(memory.role === 'challenger' ? memory.opening : memory.visitedReply)}</span><p>${escapeHtml(memory.outcome)}</p></aside>`).join('');
}

function renderHouseholdRow(id) {
  const person = HOUSEHOLD[id];
  const row = state.household[id];
  const ledger = id === 'li_jiaoer' ? E.jiaoerLedger(state) : null;
  return `<div class="household-row" data-household="${id}" data-regard="${row.regard}">
    <span>${person.glyph}</span><b>${person.name}</b><small>${ledger ? `${escapeHtml(ledger.label)}${ledger.outstanding ? ` · 欠 ${ledger.outstanding} 两` : ''}` : E.householdTier(row.regard)}</small>
  </div>`;
}

function renderHaremOutlook() {
  const outlook = E.haremOutlook(state);
  return `<section class="harem-outlook" aria-label="后宫局势"><header><b>后宫局势</b><span>${outlook.pairCount ? '横向关系已经相接' : '横向关系尚未成形'}</span></header><p>${escapeHtml(outlook.summary)}</p></section>`;
}

function renderBondBoard(showAll = false) {
  const byId = new Map(E.bondStatus(state).map((row) => [row.id, row]));
  const pairs = showAll
    ? E.bondStatus(state)
    : JOINT_ACTIONS.map((action) => byId.get(E.bondKey(action.participants[0], action.participants[1]))).filter(Boolean);
  return `<section class="bond-board ${showAll ? 'all-pairs' : ''}" aria-label="院间关系网"><header><b>院间关系网</b><span>${showAll ? '所有关系都会影响成盟' : '关键联办组合'}</span></header>${pairs.map((row) => `<div data-bond="${row.id}" data-bond-value="${row.value}"><span>${HEROINES[row.left].short} ↔ ${HEROINES[row.right].short}</span><b>${row.tier}</b></div>`).join('')}</section>`;
}

function renderObligationBoard(compact = false) {
  const rows = E.activeObligations(state);
  if (!rows.length) {
    return compact ? '' : '<section class="obligation-board empty" aria-label="待兑现总账"><header><b>待兑现</b><span>没有悬账</span></header><p>已经说出口的话都结到了具体结果。</p></section>';
  }
  const urgent = rows.filter((row) => ['overdue', 'due', 'locked'].includes(row.status)).length;
  const visible = compact ? rows.slice(0, 1) : rows;
  return `<section class="obligation-board ${compact ? 'compact' : ''}" aria-label="待兑现总账">
    <header><b>待兑现</b><span>${urgent ? '旧账正在催' : '这些话都有归期'}</span></header>
    ${visible.map((row) => `<article data-obligation="${row.id}" data-obligation-type="${row.type}" data-obligation-status="${row.status}">
      <div><span>${row.label} · ${HEROINES[row.heroine].short}${row.observer ? ` × ${HEROINES[row.observer].short}` : ''}</span><em>${row.statusLabel}</em></div>
      <b>${escapeHtml(row.title)}</b>
      ${compact ? '' : `<p>${escapeHtml(row.detail)}</p>`}
    </article>`).join('')}
    ${compact && rows.length > visible.length ? '<small>人物账内还有旧话待结</small>' : ''}
  </section>`;
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
  const dayGlyph = (day) => `${E.silverText(day)}日`;
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
      return entry.choice === 'opening_open_ledger' ? '五院同开真账' : '先听完五人';
    case 'day_action': {
      const label = DAY_AGENDAS[entry.day - 1]?.actions?.[entry.action]?.label;
      return cap(label ?? { ledger: '翻账', office: '走官面', listen: '问口风', banquet: '整席面' }[entry.action] ?? '白日办事', 7);
    }
    case 'joint_action': {
      const label = JOINT_ACTIONS.find((item) => item.id === entry.action)?.label ?? '联院差事';
      return cap(label, 7);
    }
    case 'portable_precedent':
      return `院外援例·${cap(({honor_precedent:'照规矩',named_exception:'具名限次',inside_only:'只留宅内'})[entry.choice] ?? '第二张契', 6)}`;
    case 'household': {
      const event = Object.values(HOUSEHOLD_EVENTS).find((item) => item.id === entry.event);
      const label = event?.choices.find((item) => item.id === entry.choice)?.label ?? '廊下一句';
      return `${HOUSEHOLD[entry.actor]?.short ?? '宅中人'}·${cap(label)}`;
    }
    case 'council': {
      const event = Object.values(COUNCIL_EVENTS).find((item) => item.id === entry.event);
      const label = event?.choices.find((item) => item.id === entry.choice)?.label ?? '院议裁决';
      return `院议·${cap(label, 6)}`;
    }
    case 'banquet': {
      const event = Object.values(PUBLIC_EVENTS).find((item) => item.id === entry.event);
      const label = event?.choices.find((item) => item.id === entry.choice)?.label ?? '举杯';
      return cap(label, 6);
    }
    case 'public_evidence_chain':
      return `证链·${{ complete:'闭合', rebuttable:'留缝', broken:'断裂' }[entry.result] ?? '三步'}`;
    case 'visit_start':
      return `黄昏进${HEROINES[entry.heroine]?.house ?? '内院'}`;
    case 'visit_choice': {
      // 路线按拜访次数走,条目里没有当时的拍号;选项 id 每人唯一,跨拍平铺查找。
      const rows = [
        ...Object.values(ROUTE_CHOICES[entry.heroine] ?? {}).flat(),
        ...Object.values(ROUTE_BRANCHES[entry.heroine] ?? {}).flatMap((branch) => Object.values(branch).flat()),
      ];
      const label = rows.find((item) => item.id === entry.choice)?.label ?? '夜话';
      return cap(label, 6);
    }
    case 'act_transition': {
      const label = ACT_TRANSITIONS[entry.day]?.choices.find((row) => row.id === entry.choice)?.label ?? '换幕揭底';
      return `换幕·${cap(label, 6)}`;
    }
    case 'external_rebuttal': {
      const label = EXTERNAL_REBUTTALS[entry.sourceResult]?.choices.find((row) => row.id === entry.choice)?.label ?? '三口复案';
      return `复案·${cap(label, 6)}`;
    }
    case 'route_aftermath': {
      const short = HEROINES[entry.observer]?.short ?? '旁院';
      return `${short}接进此事`;
    }
    case 'memory_reckoning':
      return `${HEROINES[entry.heroine]?.short ?? '她'}追两日前旧话`;
    case 'favor_reckoning':
      return `${HEROINES[entry.heroine]?.short ?? '她'}来收人情账`;
    case 'dusk_invitation':
      return `${HEROINES[entry.heroine]?.short ?? '她'}主动来请`;
    case 'dusk_invitation_aftermath': {
      const choice = DUSK_INVITATION_AFTERMATHS[entry.heroine]?.[entry.approach]?.choices.find((row) => row.id === entry.choice);
      return `${HEROINES[entry.heroine]?.short ?? '她'}·${cap(choice?.label ?? '邀约落字', 6)}`;
    }
    case 'personal_afterglow_aftermath': {
      const choice = PERSONAL_AFTERGLOW_AFTERMATHS[entry.heroine]?.[entry.tier]?.choices.find((row) => row.id === entry.choice);
      return `${HEROINES[entry.heroine]?.short ?? '她'}·${cap(choice?.label ?? '余夜落字', 6)}`;
    }
    case 'personal_finale':
      return `${HEROINES[entry.heroine]?.short ?? '她'}·个人终章`;
    case 'alliance_night_start':
      return `${entry.members.map((id) => HEROINES[id]?.short ?? '她').join('、')}共同留下`;
    case 'alliance_night':
      return `联盟终章·${cap(entry.choice, 6)}`;
    case 'accord_term': {
      const choice = ACCORD_CHOICES[entry.heroine];
      return `${HEROINES[entry.heroine]?.short ?? '她'}·${cap(choice?.label ?? '立约', 5)}`;
    }
    case 'shared_night_start':
      return `五院同席·${entry.accordCount >= E.ACCORD_KEYS.length ? '院约已齐' : '院约仍在落字'}`;
    case 'shared_night': {
      const label = SHARED_NIGHT_CHOICES.find((item) => item.id === entry.choice)?.label ?? '同席定议';
      return cap(label, 7);
    }
    case 'collapse_finale_start':
      return entry.endingId === 'intrigue' ? '权谋代价上门' : '五院破局清算';
    case 'collapse_finale':
      return `最后保住·${cap(entry.choice, 6)}`;
    case 'night': {
      const short = HEROINES[entry.heroine]?.short ?? '她';
      return {
        leave: `${short}屋·掩门出`,
        talk: `${short}屋·坐更漏`,
        prelude: `${short}点了头`,
        explicit: `宿${HEROINES[entry.heroine]?.house ?? '内院'}`,
      }[entry.action] ?? '夜话一回';
    }
    case 'night_conversation':
      return `${HEROINES[entry.heroine]?.short ?? '她'}夜谈·第${entry.chapter}章`;
    case 'morning': {
      const short = HEROINES[entry.actor]?.short ?? '她';
      return {
        jealousy: `${short}来敲门`, rivalry: `${short}当面追问偏爱`, pan_claim: `${short}堵门讨话`,
        yue_delayed: '月娘记前话', yue_help: '月娘留账人',
        pinger_help: '瓶儿递货单', meng_invitation: '玉楼署名帖',
        xuee_breakfast: '雪娥呈食单', quiet: '一盏醒酒茶',
      }[entry.event] ?? '天亮一回';
    }
    case 'public_followup': {
      const label = PUBLIC_FOLLOWUPS[entry.day]?.choices.find((row) => row.id === entry.choice)?.label ?? '再定一笔';
      return `公议后·${cap(label, 6)}`;
    }
    case 'final_reckoning': {
      const label = FINAL_RECKONING.choices.find((row) => row.id === entry.choice)?.label ?? '终局对账';
      return `外账·${cap(label, 6)}`;
    }
    case 'route_break':
      return entry.heroine ? `${HEROINES[entry.heroine]?.short ?? '她'}门冷一日` : '各门冷一日';
    case 'upkeep_short':
      return '场面塌一角';
    case 'morning_settlement':
      return `${HEROINES[entry.heroine]?.short ?? '本院'}·晨簿落名`;
    case 'morning_settlement_use':
      return `${HEROINES[entry.heroine]?.short ?? '本院'}·用过一次窄权`;
    case 'morning_settlement_restore':
      return `${HEROINES[entry.heroine]?.short ?? '本院'}·具名恢复`;
    case 'collector':
      return entry.paid ? '打发收账人' : '收账人闹上门';
    default:
      return '记下一笔';
  }
}

function phaseHeader(kicker, title, body) {
  return `<header class="phase-header"><p class="eyebrow">${kicker}</p><h2 tabindex="-1">${title}</h2><p>${escapeHtml(body)}</p></header>`;
}

function narrativeExcerpt(value, limit = 150) {
  const text = String(value ?? '').trim();
  if (text.length <= limit) return { preview: text, full: '' };
  const candidate = text.slice(0, limit + 1);
  const stops = [...candidate.matchAll(/[。！？；]/g)].map((match) => match.index + 1);
  const sentenceEnd = stops.filter((index) => index >= Math.floor(limit * .58)).at(-1);
  const end = sentenceEnd || limit;
  return { preview: `${text.slice(0, end).trim()}${sentenceEnd ? '' : '……'}`, full: text };
}

function narrativeArchive(copy, className, title) {
  if (!copy.full) return '';
  return `<aside class="council-external-echo ${className}"><span>完整叙述</span><b>${escapeHtml(title)}</b><p>${escapeHtml(copy.full)}</p></aside>`;
}

function renderPhase() {
  switch (state.phase) {
    case 'opening': return renderOpening();
    case 'opening_aftermath': return renderOpeningAftermath();
    case 'crisis': return renderHouseCrisis();
    case 'crisis_aftermath': return renderHouseCrisisAftermath();
    case 'pair_interlude': return renderPairInterlude();
    case 'favor_reckoning': return renderFavorReckoning();
    case 'memory_reckoning': return renderMemoryReckoning();
    case 'act_transition': return renderActTransition();
    case 'act_aftermath': return renderActAftermath();
    case 'day': return renderDay();
    case 'day_aftermath': return renderDayAftermath();
    case 'joint_result': return renderJointResult();
    case 'portable_precedent': return renderPortablePrecedent();
    case 'household': return renderHousehold();
    case 'household_aftermath': return renderHouseholdAftermath();
    case 'council': return renderCouncil();
    case 'council_aftermath': return renderCouncilAftermath();
    case 'banquet': return renderBanquet();
    case 'public_evidence': return renderPublicEvidence();
    case 'public_followup': return renderPublicFollowup();
    case 'public_aftermath': return renderPublicAftermath();
    case 'five_private_prices': return renderFivePrivatePrices();
    case 'final_reckoning': return renderFinalReckoning();
    case 'final_aftermath': return renderFinalReckoningAftermath();
    case 'dusk_invitation': return renderDuskInvitation();
    case 'dusk_invitation_aftermath': return renderDuskInvitationAftermath();
    case 'choose_visit': return renderVisitHub();
    case 'shared_night': return renderSharedNight();
    case 'shared_afterglow': return renderSharedAfterglow();
    case 'shared_afterglow_result': return renderSharedAfterglowResult();
    case 'shared_dawn': return renderSharedDawn();
    case 'shared_dawn_result': return renderSharedDawnResult();
    case 'visit': return renderVisit();
    case 'route_aftermath': return renderRouteAftermath();
    case 'night': return renderNight();
    case 'morning_settlement': return renderMorningSettlement();
    case 'morning': return renderMorning();
    case 'scene': return renderScene();
    case 'personal_afterglow': return renderPersonalAfterglow();
    case 'personal_afterglow_aftermath': return renderPersonalAfterglowAftermath();
    case 'personal_finale': return renderPersonalFinale();
    case 'personal_finale_result': return renderPersonalFinaleResult();
    case 'alliance_assembly': return renderAllianceAssembly();
    case 'alliance_night': return renderAllianceNight();
    case 'alliance_night_result': return renderAllianceNightResult();
    case 'collapse_finale': return renderCollapseFinale();
    case 'collapse_finale_result': return renderCollapseFinaleResult();
    case 'ending': return renderEnding();
    default: return '<div class="fatal-card">这页账断了。</div>';
  }
}

function renderOpening() {
  return `
    <div class="opening-scene visual-stage" style="--scene-bg:url('${urlFor('cover')}')">
      <div class="decision-panel opening-panel">
        ${phaseHeader('第一日 · 正堂', '五十两银子不见了', '月娘守着账簿，金莲把酒送到你手边。瓶儿的钥匙、玉楼的名帖和雪娥的米账，都会在今后二十日进入这本总账。')}
        <p class="speaker-line">月娘：“真账留下。”　金莲：“人也留下，先喝我这杯。”</p>
        <div class="choice-grid">${OPENING_CHOICES.map((choice) => choiceButton(choice, 'opening')).join('')}</div>
      </div>
    </div>`;
}

function renderOpeningAftermath() {
  const story = E.currentOpeningAftermath(state);
  const beat = story?.current;
  const source = OPENING_CHOICES.find((choice) => choice.id === story?.choice);
  if (!story || !beat || !source) return '<div class="fatal-card">正堂第一笔没有接到后章。</div>';
  const active = new Set(beat.speakers);
  const last = story.beat + 1 === story.count;
  return `
    <div class="opening-aftermath-stage visual-stage opening-after-${story.choice}" data-opening-aftermath="${story.choice}:${story.beat}" style="--scene-bg:url('${urlFor('cover')}')">
      <div class="opening-aftermath-cast" aria-label="五个人正在回应你的第一笔选择">
        ${HEROINE_IDS.map((id) => `<figure class="${active.has(id) ? 'speaking' : 'listening'}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><i>${HEROINES[id].glyph}</i><b>${HEROINES[id].short}</b></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel opening-aftermath-panel">
        ${phaseHeader(`第一日 · 正堂起手后章 · ${narrativeStep(story.beat + 1, story.count)}`, beat.title, beat.body)}
        <p class="opening-origin"><span>你刚才选择</span><b>${escapeHtml(source.label)}</b><small>${escapeHtml(source.text)}</small></p>
        ${story.previous.length ? `<ol class="opening-aftermath-transcript" aria-label="开局已经发生的回应">${story.previous.map((row, index) => `<li><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(row.title)}</b><p>${escapeHtml(row.body)}</p></div></li>`).join('')}</ol>` : ''}
        <div class="opening-aftermath-voices">${beat.speakers.map((id) => `<blockquote data-opening-speaker="${id}"><span>${HEROINES[id].house}</span><b>${HEROINES[id].name}</b><p>${escapeHtml(beat.voices[id])}</p></blockquote>`).join('')}</div>
        <button class="ink-button story-continue opening-aftermath-continue" data-opening-aftermath-continue="1">${last ? '带着五条线索进入第一日' : story.beat === 0 ? '听另外三院拿出证物' : '看五十两怎样分出三条去路'}</button>
      </div>
    </div>`;
}

function renderHouseCrisis() {
  const event = E.currentHouseCrisis(state);
  if (!event) return '<div class="fatal-card">这场宅门危机没有接上。</div>';
  const pair = event.rescuePair;
  const currentReply = event.currentReply;
  const replyLedger = event.previousReplies?.length
    ? `<ol class="crisis-reply-ledger" aria-label="三个人已经作出的自主答复">${event.previousReplies.map((reply, index) => `<li data-crisis-reply-record="${reply.heroine}:${reply.outcome}"><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(HEROINES[reply.heroine].short)} · ${escapeHtml(reply.title)}</b><p>${escapeHtml(reply.action)}</p><small>${escapeHtml(reply.reason)}</small></div></li>`).join('')}</ol>`
    : '';
  const replyPanel = currentReply
    ? `<section class="crisis-current-reply" data-crisis-current-reply="${currentReply.heroine}:${currentReply.outcome}" aria-live="polite">
        <header><span>本人答复 · ${narrativeStep(event.replyBeat + 1, event.responses.length)}</span><b>${escapeHtml(HEROINES[currentReply.heroine].name)} · ${escapeHtml(currentReply.title)}</b></header>
        <blockquote>${escapeHtml(currentReply.line)}</blockquote>
        <dl><div><dt>她处分的原物</dt><dd>${escapeHtml(currentReply.object)}</dd></div><div><dt>她实际会做</dt><dd>${escapeHtml(currentReply.action)}</dd></div></dl>
        <p>${escapeHtml(currentReply.reason)}</p>
        <button class="ink-button story-continue crisis-reply-continue" data-house-crisis-reply="1">${event.replyBeat + 1 < event.responses.length ? '听下一人处分本人之物' : '把三份答复并到救法桌上'}</button>
      </section>`
    : `<p class="crisis-rule">三份本人答复已经落齐。现在只能从仍愿开放的原物与劳动里组成救法；撤回者不会因危局被重新算作同意。</p>
      <div class="choice-stack crisis-structure-choices">${E.houseCrisisOptions(state).map((choice) => choiceButton(choice, 'house-crisis')).join('')}</div>`;
  return `
    <div class="house-crisis-stage visual-stage crisis-${event.type}" data-house-crisis="${event.event}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="crisis-cast" aria-label="被卷入危机的三个人">${event.participants.map((id) => `<figure class="${pair?.left === id || pair?.right === id ? 'rescue-ready' : ''} ${currentReply?.heroine === id ? 'answering' : ''}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].short}</b><small>${currentReply?.heroine === id ? '正在处分本人之物' : event.previousReplies?.some((reply) => reply.heroine === id) ? '已经留下本人答复' : pair?.left === id || pair?.right === id ? '当前最可能共同接手' : '仍在等候本人答复'}</small></figcaption></figure>`).join('')}</div>
      <div class="decision-panel house-crisis-panel">
        ${phaseHeader(`${event.kicker} · 第 ${event.act} 幕`, event.title, event.body)}
        <div class="crisis-ledger"><span>应对局面 <b>${E.pressureMomentum(state).missed ? '旧办法已被看穿' : '尚未露怯'}</b></span><span>现银 <b>${resourceCondition('silver', state.resources.silver)}</b></span><span>宅门 <b>${resourceCondition('house', state.resources.house)}</b></span><span>耗损 <b>${resourceCondition('strain', state.resources.strain)}</b></span></div>
        <p class="crisis-rule">危局先问三个人各自愿意开放什么。她们依据真实前史站住、收窄或撤回；玩家不能替她们改答，也不能拿好感数值顶替本人边界。</p>
        ${replyLedger}
        ${replyPanel}
      </div>
    </div>`;
}

function renderHouseCrisisAftermath() {
  const story = E.currentHouseCrisisAftermath(state);
  const beat = story?.current;
  if (!story || !beat) return '<div class="fatal-card">危机后的补救没有接到下一页。</div>';
  const approachLabel = story.approach === 'crisis_pair'
    ? `${story.pair?.map((id) => HEROINES[id].short).join('与') ?? '两院'}接手`
    : story.event.choices.find((choice) => choice.id === story.approach)?.label ?? '危机已止血';
  const action = story.awaitingChoice
    ? `<div class="choice-grid crisis-aftermath-choices">${E.houseCrisisAftermathOptions(state).map((choice) => choiceButton(choice, 'house-crisis-aftermath')).join('')}</div>`
    : `<button class="ink-button story-continue" data-house-crisis-aftermath-continue="1">${story.beat === 3 ? '把新规带进这一日' : story.beat === 0 ? '看谁承担了救法的代价' : '把临时补救问成一条规矩'}</button>`;
  return `
    <div class="crisis-aftermath-stage visual-stage crisis-aftermath-${story.event.type} crisis-aftermath-beat-${story.beat + 1}" data-crisis-aftermath="${story.event.type}" data-crisis-aftermath-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="crisis-aftermath-cast" aria-label="危机后的三人现场">
        ${story.participants.map((id) => `<figure class="${story.speaker === id ? 'speaking' : ''} ${story.pair?.includes(id) ? 'rescue-pair' : ''}" data-crisis-cast="${id}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><i>${HEROINES[id].glyph}</i><b>${HEROINES[id].name}</b><small>${story.pair?.includes(id) ? '参与救局' : '检查谁承担后果'}</small></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel crisis-aftermath-panel">
        ${phaseHeader(`可恢复危机 · 后续${narrativeStep(story.beat + 1, story.count)}`, beat.title, beat.body)}
        <div class="crisis-aftermath-ledger">
          <span><small>初步救法</small><b>${escapeHtml(approachLabel)}</b></span>
          <span><small>当前宅门</small><b>${resourceCondition('house', state.resources.house)}</b></span>
          <span><small>当前耗损</small><b>${resourceCondition('strain', state.resources.strain)}</b></span>
        </div>
        <p class="crisis-aftermath-rule">止住今天不等于解决以后。当前说话的人正在决定：这次救局会不会再次制造单点依赖、无名劳动或不可撤回的证词。</p>
        ${action}
      </div>
    </div>`;
}

function renderPairInterlude() {
  const event = E.currentPairInterlude(state);
  if (!event) return '<div class="fatal-card">这场双院夜话没有接上。</div>';
  const left = HEROINES[event.left];
  const right = HEROINES[event.right];
  if (event.resolutionBeat) {
    const witness = HEROINES[event.witness];
    const previousBeats = event.resolutionBeats.slice(0, event.resolution.beat);
    const witnessSpeaking = event.resolutionBeat.speaker === event.witness;
    const closingBeat = event.resolution.beat + 1 === event.resolutionCount;
    const chapterLead = event.resolution.beat === 0
      ? '这次选择没有停在口头。两院必须先把它做成一件第三个人能够检验的事。'
      : witnessSpeaking
        ? '旁院不替她们喝彩，只说明这份新关系怎样改动了自己的处境。'
        : '当事两院把刚才的异议写回原约，这段关系从一句回应变成往后会被追问的事实。';
    return `
      <div class="pair-interlude-stage pair-aftermath-stage visual-stage pair-${event.left}-${event.right}" data-pair-aftermath="${event.event}:${event.resolutionChoice}:${event.resolution.beat}">
        <div class="pair-portraits pair-aftermath-cast" aria-label="${left.name}与${right.name}正在执行刚才定下的关系">
          <figure class="${witnessSpeaking ? 'settled' : 'speaking'}"><img src="${urlFor(left.close)}" alt="${left.name}"/><figcaption><span>${left.house}</span><b>${left.name}</b><p>${witnessSpeaking ? '她已经做完自己的那一部分，正在听第三院指出代价。' : closingBeat ? '她把第三院指出的代价写回刚才的约定，不让结盟停在好听处。' : '她没有把决定留给明天，正与另一院共同执行。'}</p></figcaption></figure>
          <figure class="${witnessSpeaking ? 'settled' : 'speaking'}"><img src="${urlFor(right.close)}" alt="${right.name}"/><figcaption><span>${right.house}</span><b>${right.name}</b><p>${witnessSpeaking ? '两院的新关系已经落地，现在要看它怎样改变旁院。' : closingBeat ? '她没有撤回共同动作，而是同另一院一起完成最后落字。' : '她不再经由你转述，直接接住了共同动作。'}</p></figcaption></figure>
        </div>
        <figure class="pair-aftermath-witness ${witnessSpeaking ? 'speaking' : closingBeat ? 'settled' : 'waiting'}"><img src="${urlFor(witness.portrait)}" alt="${witness.name}"/><figcaption><span>${witness.house}</span><b>${witness.name}</b><small>${witnessSpeaking ? '她不替两院喝彩，只说明这项新关系怎样落到自己身上。' : closingBeat ? '她的异议没有被压下，已经被当事两院写进最后结果。' : '她会在下一拍检验这份新关系是否真的改变了后宫。'}</small></figcaption></figure>
        <div class="decision-panel pair-interlude-panel pair-aftermath-panel">
          ${phaseHeader(`双院落约 · ${escapeHtml(event.resolutionLabel)} · 后章${narrativeStep(event.resolution.beat + 1, event.resolutionCount)}`, event.resolutionTitle, chapterLead)}
          <p class="pair-aftermath-origin"><span>你刚才选择</span><b>${escapeHtml(event.resolutionLabel)}</b><small>${escapeHtml(event.results[event.resolutionChoice])}</small></p>
          ${previousBeats.length ? `<ol class="pair-aftermath-transcript" aria-label="这次双院选择已经发生的动作">${previousBeats.map((beat, index) => `<li><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(beat.title)}</b><p>${escapeHtml(beat.body)}</p></div></li>`).join('')}</ol>` : ''}
          <blockquote class="pair-aftermath-current ${witnessSpeaking ? 'witness-line' : 'pair-line'}"><span>${escapeHtml(event.resolutionBeat.speakerHouse)}</span><b>${escapeHtml(event.resolutionBeat.title)}</b><p>${escapeHtml(event.resolutionBeat.body)}</p></blockquote>
          <button class="ink-button story-continue" data-pair-story="1">${event.resolution.beat === 0 ? `看${witness.short}怎样接住` : witnessSpeaking ? '听她们把异议写回原约' : '把这份关系带到次晨'}</button>
        </div>
      </div>`;
  }
  const active = event.storyBeat?.speaker;
  const atChoice = event.beat === event.count - 1;
  const portraitLine = (id, line) => active === id
    ? escapeHtml(line)
    : atChoice
      ? '她没有收回刚才的话，正等这份横向关系怎样落地。'
      : event.beat > 0
        ? '上一句话仍留在桌上；她没有替对方抢答。'
        : '她先听对方把条件说完，没有把沉默当成同意。';
  return `
    <div class="pair-interlude-stage visual-stage pair-${event.left}-${event.right}" data-pair-interlude="${event.event}" data-pair-beat="${event.beat}">
      <div class="pair-portraits" aria-label="${left.name}与${right.name}正在直接交谈">
        <figure class="${active === event.left || atChoice ? 'speaking' : 'waiting'}"><img src="${urlFor(left.close)}" alt="${left.name}"/><figcaption><span>${left.house}</span><b>${left.name}</b><p>${portraitLine(event.left, event.leftLine)}</p></figcaption></figure>
        <figure class="${active === event.right || atChoice ? 'speaking' : 'waiting'}"><img src="${urlFor(right.close)}" alt="${right.name}"/><figcaption><span>${right.house}</span><b>${right.name}</b><p>${portraitLine(event.right, event.rightLine)}</p></figcaption></figure>
      </div>
      <div class="decision-panel pair-interlude-panel">
        ${phaseHeader(`${event.kicker} · 双院关系事件`, event.title, event.body)}
        <p class="pair-progress">双院私议 · ${narrativeStep(event.beat + 1, event.count)} · ${atChoice ? '两个人共同把问题交还给你' : active === event.left ? `${left.short}先开口` : `${right.short}接住这句话`}</p>
        ${!atChoice ? `<blockquote class="pair-current-line"><span>${active === event.left ? left.name : right.name}</span>${escapeHtml(event.storyBeat.text)}</blockquote>` : ''}
        ${atChoice ? `<blockquote class="pair-joint-line"><span>她们共同追问</span>${escapeHtml(event.jointLine)}</blockquote>` : ''}
        <div class="pair-trust"><span>她们不经你转述也能谈到这里</span><b>当前关系 · ${E.bondTier(event.trust)}</b></div>
        ${atChoice
          ? `<p class="pair-rule">支持她们形成横向关系，更容易出现双院、三院或五院结局；把话重新拉回你身边，则会提高个人情欲，却削弱她们彼此结盟的可能。</p><div class="choice-stack">${E.pairInterludeOptions(state).map((choice) => choiceButton(choice, 'pair-interlude')).join('')}</div>`
          : '<button class="ink-button story-continue" data-pair-story="1">听她把这句话说完</button>'}
      </div>
    </div>`;
}

function renderFavorReckoning() {
  const event = E.currentFavorReckoning(state);
  if (!event) return '<div class="fatal-card">这笔人情债没有找到当日借力的原页。</div>';
  const heroine = HEROINES[event.heroine];
  const observer = HEROINES[event.observer];
  const castState = (id) => event.speaker === id ? 'speaking' : event.speaker ? 'listening' : event.resolved ? 'settled' : 'weighing';
  const continueLabel = event.resolved
    ? '把双院结果记进总账，进入白日'
    : event.beat === 0
      ? `让${observer.short}把旁院代价摆出来`
      : '两院都已说完，轮到你裁决';
  return `
    <div class="favor-reckoning-stage visual-stage favor-${event.heroine} favor-step-${event.step}" data-favor-reckoning-event="${event.event}" data-favor-reckoning-step="${event.step + 1}">
      <div class="favor-cast" aria-label="${heroine.name}与${observer.name}正在演完人情追账第${event.step + 1}拍">
        <figure class="favor-lead ${castState(event.heroine)}"><img src="${urlFor(heroine.close)}" alt="${heroine.name}"/><figcaption><span>当日先押出自己的人</span><b>${heroine.name}</b><p>${event.speaker === event.heroine ? '她正在开账。' : event.resolved ? '她等你把结果正式记下。' : '她没有收回刚才的话。'}</p></figcaption></figure>
        <figure class="${castState(event.observer)}"><img src="${urlFor(observer.close)}" alt="${observer.name}"/><figcaption><span>看见横向代价的人</span><b>${observer.name}</b><p>${event.speaker === event.observer ? '她正在举证。' : event.resolved ? '她也会记住你如何收尾。' : '她在等自己的那一页。'}</p></figcaption></figure>
      </div>
      <div class="decision-panel favor-reckoning-panel">
        <div class="favor-progress" aria-label="人情追账四拍进度"><span class="${event.step >= 0 ? 'done' : ''}">开账</span><span class="${event.step >= 1 ? 'done' : ''}">举证</span><span class="${event.step >= 2 ? 'done' : ''}">裁决</span><span class="${event.step >= 3 ? 'done' : ''}">结果</span></div>
        ${phaseHeader(`人情追账 · ${narrativeStep(event.step + 1, event.count)} · 第 ${event.sourceDay} 日 → 第 ${state.day} 日`, event.current.title, event.current.body)}
        <div class="favor-thread"><span>那天危局确实收住了，但不是免费收住</span><b>你没有顺着征兆，而是借${heroine.short}的“${escapeHtml(event.sourceLabel)}”先压住局面</b><small>${escapeHtml(event.sourceText)}</small><em>${event.daysLater} 日后，${observer.short}也到场；这次选择会同时改变个人情分与两院互信。</em></div>
        ${event.awaitingChoice
          ? `<div class="favor-verdict-note">两个人已经把来路和代价都说完。现在没有“什么都不做”：你必须决定这笔人情由谁、用什么方式偿还。</div><div class="choice-stack">${E.favorReckoningOptions(state).map((choice) => choiceButton(choice, 'favor-reckoning')).join('')}</div>`
          : `<button class="ink-button story-continue favor-story-continue" data-favor-story="1">${continueLabel}</button>`}
      </div>
    </div>`;
}

function renderMemoryReckoning() {
  const event = E.currentMemoryReckoning(state);
  if (!event) return '<div class="fatal-card">这笔旧话没有找到原页。</div>';
  const heroine = HEROINES[event.heroine];
  const observer = HEROINES[event.observer];
  const castState = (id) => event.speaker === id ? 'speaking' : event.speaker ? 'listening' : event.resolved ? 'settled' : 'weighing';
  const promise = {
    public: '那晚你选择：把后果拿到长案',
    direct: '那晚你选择：让她们自己谈',
    private: '那晚你选择：把后果留在门内',
  }[event.promise];
  const continueLabel = event.resolved
    ? '把这次兑现写回人物总账，进入白日'
    : event.beat === 0
      ? `让${observer.short}说出旁院真正承受的部分`
      : '原话与代价都已摆齐，轮到你决定';
  return `
    <div class="memory-reckoning-stage visual-stage memory-${event.heroine} memory-step-${event.step}" data-memory-reckoning-event="${event.event}" data-memory-reckoning-step="${event.step + 1}">
      <div class="memory-cast" aria-label="${heroine.name}与${observer.name}正在演完旧话追账第${event.step + 1}拍">
        <figure class="memory-lead ${castState(event.heroine)}"><img src="${urlFor(heroine.close)}" alt="${heroine.name}"/><figcaption><span>${heroine.house} · 记住原话的人</span><b>${heroine.name}</b><p>${event.speaker === event.heroine ? '她正在逐字复述。' : event.resolved ? '她在看这句承诺如何落地。' : '她没有替你改写原话。'}</p></figcaption></figure>
        <figure class="${castState(event.observer)}"><img src="${urlFor(observer.close)}" alt="${observer.name}"/><figcaption><span>${observer.house} · 承受外溢的人</span><b>${observer.name}</b><p>${event.speaker === event.observer ? '她正在说明旁院代价。' : event.resolved ? '她也会按这次结果安排自己。' : '她等原话先被完整念完。'}</p></figcaption></figure>
      </div>
      <div class="decision-panel memory-reckoning-panel">
        <div class="memory-progress" aria-label="旧话追账四拍进度"><span class="${event.step >= 0 ? 'done' : ''}">复述</span><span class="${event.step >= 1 ? 'done' : ''}">质询</span><span class="${event.step >= 2 ? 'done' : ''}">裁决</span><span class="${event.step >= 3 ? 'done' : ''}">结果</span></div>
        ${phaseHeader(`${event.kicker} · ${narrativeStep(event.step + 1, event.count)} · 第 ${event.sourceDay} 日 → 第 ${state.day} 日`, event.current.title, event.current.body)}
        <div class="memory-thread"><span>原话没有随那一夜结束</span><b>你先选了“${escapeHtml(event.sourceLabel)}”</b><small>${escapeHtml(event.sourceText)}</small><strong>当时实际执行 · ${escapeHtml(event.sourceStake.label)} · ${escapeHtml(narrativeChoiceMeta(event.sourceStake.resourceText))}</strong><small>${escapeHtml(event.sourceStake.text)}</small><strong>今日只追这一件</strong><small>${escapeHtml(event.sourceReturn.question)}</small><em>${promise} · ${event.daysLater} 日后，这件原物与代价一起回来追账。</em></div>
        ${event.awaitingChoice
          ? `<div class="memory-verdict-note">她们争的不是你还记不记得，而是这句话到了今日是否仍能约束你。兑现、重写或否认，都会成为以后她们判断你口头承诺的依据。</div><div class="choice-stack">${E.memoryReckoningOptions(state).map((choice) => choiceButton(choice, 'memory-reckoning')).join('')}</div>`
          : `<button class="ink-button story-continue memory-story-continue" data-memory-story="1">${continueLabel}</button>`}
      </div>
    </div>`;
}

function renderDuskInvitation() {
  const event = E.currentDuskInvitation(state);
  if (!event) return '<div class="fatal-card">黄昏这份邀约没有找到来处。</div>';
  const heroine = HEROINES[event.heroine];
  const witness = HEROINES[event.witness];
  return `
    <div class="dusk-invitation-stage visual-stage invite-${event.heroine}" data-dusk-invitation-event="${event.event}">
      <div class="dusk-invite-cast">
        <figure class="invite-lead"><img src="${urlFor(heroine.close)}" alt="${heroine.name}"/><figcaption><span>她主动来请</span><b>${heroine.name}</b></figcaption></figure>
        <figure class="invite-witness"><img src="${urlFor(witness.portrait)}" alt="${witness.name}"/><figcaption><span>旁院见证</span><b>${witness.name}</b></figcaption></figure>
      </div>
      <div class="decision-panel dusk-invitation-panel">
        ${phaseHeader(`${event.kicker} · 第 ${state.day} 日黄昏`, event.title, event.body)}
        <div class="dusk-invite-voices"><p><b>${heroine.short}</b>${escapeHtml(event.heroineLine)}</p><p><b>${witness.short}</b>${escapeHtml(event.witnessLine)}</p></div>
        <p class="dusk-invite-rule">她不是免费加好感的随机事件。赴约会直接改变今晚去处；让要求见光会强化两院关系；拒绝也可以，但不能再用一份含糊的“改日”把她留在原地。</p>
        <div class="choice-stack">${E.duskInvitationOptions(state).map((choice) => choiceButton(choice, 'dusk-invitation')).join('')}</div>
      </div>
    </div>`;
}

function renderDuskInvitationAftermath() {
  const story = E.currentDuskInvitationAftermath(state);
  if (!story?.current) return '<div class="fatal-card">这次主动邀约没有接上后话。</div>';
  const heroine = HEROINES[story.heroine];
  const witness = HEROINES[story.witness];
  const event = DUSK_INVITATIONS[story.heroine];
  const approachLabel = { accept:'赴她的约', open:'请她当面说完', decline:'诚实说明今夜不去' }[story.approach];
  const action = story.awaitingChoice
    ? `<div class="choice-grid invitation-aftermath-choices">${E.duskInvitationAftermathOptions(state).map((choice) => choiceButton(choice, 'dusk-invitation-aftermath')).join('')}</div>`
    : `<button class="ink-button story-continue" data-dusk-invitation-aftermath-continue="1">${story.resolved ? (story.approach === 'accept' ? `随${heroine.short}真正进门` : '带着这句话回到五院岔口') : story.step === 0 ? `听${witness.short}把旁院代价问出来` : '让她把今夜的具体安排说清'}</button>`;
  return `
    <div class="invitation-aftermath-stage visual-stage invite-after-${story.heroine} ${story.resolved ? 'resolved' : ''}" data-dusk-invitation-aftermath="${story.approach}" data-invitation-aftermath-beat="${story.step + 1}">
      <div class="invitation-aftermath-cast" aria-label="${heroine.name}与${witness.name}把主动邀约说到底">
        <figure class="${story.speaker === story.heroine ? 'speaking' : 'listening'}"><img src="${urlFor(heroine.close)}" alt="${heroine.name}"/><figcaption><span>主动邀约者</span><b>${heroine.name}</b></figcaption></figure>
        <figure class="${story.speaker === story.witness ? 'speaking' : 'listening'}"><img src="${urlFor(witness.close)}" alt="${witness.name}"/><figcaption><span>旁院见证者</span><b>${witness.name}</b></figcaption></figure>
      </div>
      <div class="decision-panel invitation-aftermath-panel">
        ${phaseHeader(`主动邀约后续 · ${approachLabel} · ${narrativeStep(story.step + 1, story.count)}`, story.current.title, story.current.body)}
        <div class="invitation-aftermath-ledger" aria-label="这次邀约已经发生的事实">
          <span><small>她先说了</small><b>${escapeHtml(event.title)}</b></span>
          <span><small>你先回答</small><b>${escapeHtml(approachLabel)}</b></span>
          <span><small>现在要决定</small><b>${story.resolved ? escapeHtml(story.choice.label) : story.awaitingChoice ? '怎样让偏爱落到可执行的安排' : story.step === 0 ? '旁院是否只能靠猜' : '今晚的钥匙、记录与退出权'}</b></span>
        </div>
        <p class="invitation-aftermath-rule">${story.resolved ? '这项安排已经同时进入个人关系与两院横向关系；它不会在进门以后被一笔好感值抹掉。' : story.awaitingChoice ? '第一次回答决定去不去；这一次决定她们以后怎样追问、拒绝和记住今晚。' : '邀约者与见证者都会把话说完，第三拍以前不会把你送回普通院门。'}</p>
        ${action}
      </div>
    </div>`;
}

function renderActTransition() {
  const event = E.currentActTransition(state);
  if (!event) return '<div class="fatal-card">换幕这页没有接上。</div>';
  const previousPublic = PUBLIC_EVENTS[state.day - 1];
  const background = previousPublic ? SCENES[previousPublic.scene].asset : 'compound';
  return `
    <div class="act-transition-stage visual-stage act-transition-${event.act}" data-act-transition="${event.id}" style="--scene-bg:url('${urlFor(background)}')">
      <div class="act-transition-cast" aria-label="五个人一起看见的真相">${event.participants.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${HEROINES[id].short}</figcaption></figure>`).join('')}</div>
      <div class="decision-panel act-transition-panel">
        ${phaseHeader(event.kicker, event.title, event.body)}
        ${event.day5Opening ? `<aside class="act-source-echo day5-public-opening" data-act-day5-opening="${event.day5Opening.choice}"><span>${event.day5Opening.choice === 'public_5_favor' ? '已认偏宠继续限制假账处理' : '逐手经办继续限制假账处理'}</span><b>${escapeHtml(event.day5Opening.label)}</b><p>${escapeHtml(event.day5Opening.day6Text)}</p></aside>` : ''}
        ${event.sourceEcho ? `<aside class="act-source-echo" data-act-source="${event.sourceEcho.id}"><span>第十日真正留下的处置</span><b>${escapeHtml(event.sourceEcho.label)}</b><p>${escapeHtml(event.sourceEcho.text)}</p></aside>` : ''}
        ${event.day10Opening ? `<aside class="act-source-echo day10-public-opening" data-act-day10-opening="${event.day10Opening.choice}"><span>第十日原页状态也进入第三幕</span><b>${escapeHtml(event.day10Opening.label)}</b><p>${escapeHtml(event.day10Opening.day11Text)}</p></aside>` : ''}
        ${event.draftEcho ? `<aside class="act-source-echo" data-act-draft-source="${event.draftEcho.aftermath}"><span>第十四日银票仍在门外起作用</span><b>${escapeHtml(event.draftEcho.label)}</b><p>${escapeHtml(event.draftEcho.day16Text)}</p></aside>` : ''}
        <blockquote class="act-reveal"><span>这一幕终于看清</span>${escapeHtml(event.reveal)}</blockquote>
        <div class="choice-grid">${E.actTransitionOptions(state).map((choice) => choiceButton(choice, 'act-transition')).join('')}</div>
      </div>
    </div>`;
}

function renderActAftermath() {
  const story = E.currentActAftermath(state);
  const beat = story?.current;
  const previousPublic = PUBLIC_EVENTS[state.day - 1];
  const background = previousPublic ? SCENES[previousPublic.scene].asset : 'compound';
  if (!story || !beat) return '<div class="fatal-card">换幕后果没有接上下一页。</div>';
  const last = story.resolved || story.beat === story.count - 1;
  const rebuttal = story.externalRebuttal;
  const internalPractice = story.internalPractice
    ? `<aside class="act-internal-practice"><span>五院原先定下的新做法</span><b>${escapeHtml(story.internalPractice.title)}</b><p>${escapeHtml(story.internalPractice.body)}</p></aside>`
    : '';
  const rebuttalBlock = rebuttal && !story.resolved ? `
    <section class="external-rebuttal" data-external-rebuttal="${rebuttal.sourceResult}">
      <details class="supporting-context external-rebuttal-context"><summary><b>三口复案的来路</b><span>三人证言</span></summary><div class="supporting-context-pages"><div class="external-rebuttal-context-pages">
      <header><div><small>第十五日原案</small><b>${escapeHtml(rebuttal.sourceOutcome.label)}</b></div><div><small>第十六日第一选择</small><b>${escapeHtml(rebuttal.actChoice.label)}</b></div><div><small>当时未递</small><b>${escapeHtml(rebuttal.missingEvidence?.label ?? '无')}</b></div></header>
      ${rebuttal.publicOpening ? `<aside class="act-source-echo day15-public-opening ${rebuttal.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-day16-public-opening="${rebuttal.publicOpening.choice}"><span>${rebuttal.publicOpening.falseScapegoat ? '复案先拆错误预断' : '复案仍不得预填犯人'}</span><b>${escapeHtml(rebuttal.publicOpening.label)}</b><p>${escapeHtml(rebuttal.publicOpening.rebuttalText)}</p></aside>` : ''}
      ${rebuttal.hearingEcho ? `<aside class="council-external-echo external-hearing-echo" data-day15-hearing-echo="${rebuttal.hearingEcho.sourceAction}"><span>昨日白日经手留下的物件也在受问</span><b>${escapeHtml(rebuttal.hearingEcho.label)}</b><p>${escapeHtml(rebuttal.hearingEcho.rebuttalText)}</p><small>${escapeHtml(rebuttal.hearingEcho.object)}</small></aside>` : ''}
      <ol class="external-rebuttal-voices" aria-label="三名外部人物接成一线的反问">${rebuttal.voices.map((voice, index) => {
        const actor = rebuttal.actors.find((person) => person.id === voice.actor);
        return `<li data-external-rebuttal-actor="${voice.actor}"><i>${narrativeBeatMark(index)}</i><div><span>${escapeHtml(actor?.role ?? '')}</span><b>${escapeHtml(actor?.name ?? voice.actor)}</b><p>${escapeHtml(voice.line)}</p></div></li>`;
      }).join('')}</ol></div></div></details>
      <p class="external-rebuttal-question">${escapeHtml(rebuttal.question)}</p>
      <div class="choice-grid external-rebuttal-choices">${E.actAftermathOptions(state).map((choice) => choiceButton(choice, 'act-aftermath-choice')).join('')}</div>
    </section>` : '';
  const resolutionBlock = rebuttal && story.resolved ? `
    <section class="external-rebuttal-result" data-external-rebuttal-result="${rebuttal.resolution.id}">
      <span>三口复案已经落字</span><b>${escapeHtml(rebuttal.resolution.label)}</b>
      <p>${escapeHtml(rebuttal.resolution.day17Echo)}</p>
    </section>` : '';
  const action = story.awaitingChoice
    ? ''
    : `<button class="ink-button story-continue" data-act-aftermath-continue="1">${story.resolved ? '把复案结果带进第四幕' : last ? `真正进入第 ${story.act} 幕` : story.beat === 0 ? '让五院拿现实来验' : story.beat === 1 && state.day === 16 ? '听三人怎样接成反问' : '看她们怎样定下新做法'}</button>`;
  return `
    <div class="act-aftermath-stage visual-stage act-aftermath-${story.act} act-beat-${story.beat + 1}" data-act-aftermath="${story.choice}" data-act-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor(background)}')">
      <div class="act-aftermath-cast" aria-label="一起验证下一幕真相的五个人">${story.participants.map((id) => `<figure class="${beat.speaker === id ? 'speaking' : 'listening'}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].name}</b></figcaption></figure>`).join('')}</div>
      <div class="decision-panel act-aftermath-panel">
        ${phaseHeader(`第 ${story.act} 幕开启 · ${story.label} · ${narrativeStep(story.beat + 1, story.count)}`, beat.title, beat.body)}
        ${story.day5Opening ? `<aside class="act-source-echo day5-public-opening" data-act-aftermath-day5-opening="${story.day5Opening.choice}:${story.beat + 1}"><span>${story.day5Opening.choice === 'public_5_favor' ? '已认偏宠仍限制这一拍' : '逐手经办仍限制这一拍'}</span><b>${escapeHtml(story.day5Opening.label)}</b><p>${escapeHtml(story.day5Opening.text)}</p></aside>` : ''}
        ${story.day10Opening ? `<aside class="act-source-echo day10-public-opening" data-act-aftermath-day10-opening="${story.day10Opening.choice}:${story.beat + 1}"><span>${story.day10Opening.choice === 'public_10_hide' ? '原页缺口仍限制这一拍' : '五份本人原页仍限制这一拍'}</span><b>${escapeHtml(story.day10Opening.label)}</b><p>${escapeHtml(story.day10Opening.text)}</p></aside>` : ''}
        ${story.draftEcho && story.beat === 0 ? `<aside class="act-source-echo" data-act-aftermath-draft="${story.draftEcho.aftermath}"><span>换幕选择仍要承担银票的生活后果</span><b>${escapeHtml(story.draftEcho.label)}</b><p>${escapeHtml(story.draftEcho.day16Text)}</p></aside>` : ''}
        ${internalPractice}
        ${rebuttalBlock}
        ${resolutionBlock}
        ${!story.awaitingChoice ? `<div class="act-aftermath-rule"><span>${story.beat === 0 ? '先承认你刚选的代价' : story.resolved ? '第二次选择已经留下后续问题' : story.beat === 1 ? '让证物与人物反过来检验它' : '把下一幕真正会执行的办法写清'}</span><b>${last ? '五个人没有靠一句漂亮话收束复案；第十七日会继续读取这次守住和放弃的东西。' : '下一拍不会简单赞成；另一院会拿自己的货、名、工或口供检查这套办法是否站得住。'}</b></div>` : ''}
        ${action}
      </div>
    </div>`;
}

function renderDay() {
  const def = E.dayDef(state);
  const jointOptions = E.jointActionOptions(state);
  const jointDone = Math.min(E.jointActionCount(state), E.JOINT_ACTION_TARGET);
  const opening = state.day === 1 ? E.openingMemory(state) : null;
  const contextRows = [
    opening ? `<aside class="opening-memory-slip" data-opening-memory="${opening.choice}"><span>正堂起手仍在影响这一日</span><b>${escapeHtml(opening.title)}</b><p>${escapeHtml(opening.memory)}</p></aside>` : '',
    def.earlyEcho ? `<aside class="council-external-echo day-early-living-echo" data-early-day-source="${def.earlyEcho.sourceDay}:${def.earlyEcho.sourceAction}"><span>昨日手上留下的物件没有退场</span><b>${escapeHtml(def.earlyEcho.label)}</b><p>${escapeHtml(def.earlyEcho.text)}</p><small>${escapeHtml(def.earlyEcho.object)}</small></aside>` : '',
    def.accountEcho ? `<aside class="council-external-echo day-account-living-echo" data-day6-account-echo="${def.accountEcho.sourceAction}"><span>昨日两本流水正在把食盒接到车路</span><b>${escapeHtml(def.accountEcho.label)}</b><p>${escapeHtml(def.accountEcho.text)}</p><small>${escapeHtml(def.accountEcho.object)}</small></aside>` : '',
    def.driverEcho ? `<aside class="council-external-echo day-driver-living-echo" data-day7-driver-echo="${def.driverEcho.sourceAction}"><span>昨日车夫留下的物件正在拆分四次催火</span><b>${escapeHtml(def.driverEcho.label)}</b><p>${escapeHtml(def.driverEcho.text)}</p><small>${escapeHtml(def.driverEcho.object)}</small></aside>` : '',
    def.stoveEcho ? `<aside class="council-external-echo day-stove-living-echo" data-day8-stove-echo="${def.stoveEcho.sourceAction}"><span>昨日停灶留下的物件正在把旧箱接回生活账</span><b>${escapeHtml(def.stoveEcho.label)}</b><p>${escapeHtml(def.stoveEcho.text)}</p><small>${escapeHtml(def.stoveEcho.object)}</small></aside>` : '',
    def.saltEcho ? `<aside class="council-external-echo day-salt-living-echo" data-day11-salt-echo="${def.saltEcho.sourceAction}"><span>昨日一瓮盐正在改变今日箱路</span><b>${escapeHtml(def.saltEcho.label)}</b><p>${escapeHtml(def.saltEcho.text)}</p><small>${escapeHtml(def.saltEcho.object)}</small></aside>` : '',
    def.emergencyEcho ? `<aside class="council-external-echo day-emergency-living-echo" data-day13-emergency-echo="${def.emergencyEcho.sourceAction}"><span>昨日五件急用决定今日银票会压住谁</span><b>${escapeHtml(def.emergencyEcho.label)}</b><p>${escapeHtml(def.emergencyEcho.text)}</p><small>${escapeHtml(def.emergencyEcho.object)}</small></aside>` : '',
    def.hearingEcho ? `<aside class="council-external-echo day-hearing-living-echo" data-day15-hearing-echo="${def.hearingEcho.sourceAction}"><span>昨日堂前留下的实物正在拆分真债、雇声与饥饿</span><b>${escapeHtml(def.hearingEcho.label)}</b><p>${escapeHtml(def.hearingEcho.text)}</p><small>${escapeHtml(def.hearingEcho.object)}</small></aside>` : '',
    def.crowdEcho ? `<aside class="council-external-echo day-crowd-living-echo" data-day16-crowd-echo="${def.crowdEcho.sourceAction}"><span>昨日拆围门留下的票、鞋与饭正在接出柜坊入口</span><b>${escapeHtml(def.crowdEcho.label)}</b><p>${escapeHtml(def.crowdEcho.text)}</p><small>${escapeHtml(def.crowdEcho.object)}</small></aside>` : '',
    def.vaultEcho ? `<aside class="council-external-echo day-vault-living-echo" data-day17-vault-echo="${def.vaultEcho.sourceAction}"><span>昨夜柜坊留下的实物正在限制逃路报价</span><b>${escapeHtml(def.vaultEcho.label)}</b><p>${escapeHtml(def.vaultEcho.text)}</p><small>${escapeHtml(def.vaultEcho.object)}</small></aside>` : '',
    def.externalPressure ? `<aside class="council-external-echo day-external-pressure" data-external-pressure="${def.externalPressure.sourceResult}"><span>昨日三口复案改变了今日要补的证</span><b>${escapeHtml(def.externalPressure.label)}</b><p>${escapeHtml(def.externalPressure.text)}</p></aside>` : '',
    def.deedEcho ? `<aside class="council-external-echo day-deed-echo" data-day10-deed-echo="${def.deedEcho.aftermath}"><span>第九日旧契真的去了哪里</span><b>${escapeHtml(def.deedEcho.label)}</b><p>${escapeHtml(def.deedEcho.text)}</p></aside>` : '',
    def.councilEcho ? `<aside class="council-external-echo day-council-echo" data-day13-council-echo="${def.councilEcho.choice}" data-day10-opening="${def.councilEcho.publicOpeningChoice ?? ''}"><span>第十二日院议先变成今日用度</span><b>${escapeHtml(def.councilEcho.label)}</b><p>${escapeHtml(def.councilEcho.text)}</p><small>${escapeHtml(def.councilEcho.materialText ?? '')}</small></aside>` : '',
    def.nightLedger ? `<aside class="council-external-echo day-night-ledger" data-night-ledger-day13="${def.nightLedger.choice}" data-day5-opening-long="${def.nightLedger.publicOpeningChoice}"><span>行动权限，不是新增证物</span><b>${escapeHtml(def.nightLedger.title)}</b><p>${escapeHtml(def.nightLedger.text)}</p><small>${escapeHtml(def.nightLedger.permission)} · 第五日仍按“${escapeHtml(def.nightLedger.publicOpeningLabel)}”追责。</small></aside>` : '',
  ].filter(Boolean);
  const contextSection = contextRows.length
    ? `<details class="day-context-details"><summary><b>旧事正在影响今日</b><span>${contextRows.length} 笔旧事</span></summary><div>${contextRows.join('')}</div></details>`
    : '';
  const jointSection = state.day < 6
    ? ''
    : jointDone >= E.JOINT_ACTION_TARGET
      ? ''
      : `<details class="joint-offers" aria-label="联院差事"><summary><b>改做一桩联院差事</b><span>${narrativeProgress(jointDone, E.JOINT_ACTION_TARGET, ['尚未合办', '已有搭档共事', '五组搭档都已共事'])}</span></summary><div class="joint-actions">${jointOptions.map((choice) => choiceButton({ ...choice, meta: '' }, 'joint-action')).join('')}</div></details>`;
  const dayOptions = E.dayOptions(state);
  return `
    <div class="hub-stage visual-stage" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="decision-panel day-panel">
        ${phaseHeader('白日', def.name, `${def.pressure} ${def.tell}`)}
        ${contextSection}
        ${renderEvidenceBoard()}
        <div class="day-actions">${dayOptions.map((choice) => choiceButton({ ...choice, hint: `${choice.actor ? `${HEROINES[choice.actor].short} · ` : ''}${choice.hint}`, meta: '' }, 'day-action')).join('')}</div>
        ${jointSection}
      </div>
    </div>`;
}

function renderEvidenceBoard() {
  const rows = E.secretInventory(state);
  if (!rows.length) return '';
  return `<details class="evidence-board" aria-label="证据板"><summary><b>证据板 · ${rows.length} 条</b><span>${state.selectedSecret ? '已有一条压在官面选项上' : '走官面时再挑'}</span></summary><div>${rows.map((row) => `<button data-secret-select="${row.id}" class="evidence-slip ${row.selected ? 'selected' : ''}" aria-pressed="${row.selected}" ${row.expired ? 'disabled' : ''}><b>${escapeHtml(row.label)}</b><span>${escapeHtml(row.source)}</span><em>${row.confidence}${row.expiresOn ? ` · 第${row.expiresOn}日后失效` : ' · 不限日'}</em></button>`).join('')}</div>${state.selectedSecret ? '<button class="evidence-pay" id="btn-secret-clear">收回证据，改用现银</button>' : ''}</details>`;
}

function renderDayAftermath() {
  const story = E.currentDayAftermath(state);
  const beat = story?.current;
  if (!story || !beat) return '<div class="fatal-card">白日后果没有接上。</div>';
  const actor = HEROINES[story.actor];
  const last = story.beat === story.count - 1;
  const reactionCast = beat.reactions.length
    ? `<div class="day-aftermath-reactions" aria-label="旁院回应">${beat.reactions.map((row) => {
      const heroine = HEROINES[row.heroine];
      return `<figure class="${row.delta > 0 ? 'accepts' : 'resists'}"><img src="${urlFor(heroine.portrait)}" alt="${heroine.name}"/><figcaption><span>${escapeHtml(row.tone)}</span><b>${heroine.name}</b><p>${escapeHtml(row.text)}</p></figcaption></figure>`;
    }).join('')}</div>`
    : '';
  const consequence = beat.resolved === null ? '' : `<div class="day-consequence ${beat.resolved ? 'resolved' : 'missed'}"><span>${beat.resolved ? '危局已收' : '危局漏口'}</span><b>${beat.resolved ? '这一步给后宫关系网留下一条能继续追的线。' : '得到的眼前收益仍在，但真正的对手已经换了下一手。'}</b></div>`;
  return `
    <div class="day-aftermath-stage visual-stage dialogue-${story.actor} beat-${beat.id}" data-day-aftermath="${beat.id}" style="--scene-bg:url('${urlFor(actor.close || actor.portrait)}')">
      <div class="day-aftermath-lead" aria-hidden="true" style="background-image:url('${urlFor(actor.close || actor.portrait)}')"></div>
      ${reactionCast}
      <div class="decision-panel day-aftermath-panel">
        ${phaseHeader(beat.kicker, beat.title, beat.body)}
        <div class="story-progress"><span>${narrativeStep(story.beat + 1, story.count)}</span><i></i><b>${['她先动手', '旁院接话', '危局回手'][story.beat]}</b></div>
        ${beat.speaker ? `<blockquote class="day-speaker"><span>${HEROINES[beat.speaker].name}</span>${escapeHtml(HEROINES[beat.speaker].voice)}</blockquote>` : ''}
        ${consequence}
        <button class="ink-button story-continue day-aftermath-continue" data-day-aftermath-continue="1">${last ? '把后果记进总账' : story.beat === 0 ? '看另外两院怎么接' : '看真正的缺口'}</button>
      </div>
    </div>`;
}

function renderJointResult() {
  const choice = E.currentJointAction(state);
  const beat = choice?.storyBeat;
  if (!choice || !beat) return '<div class="fatal-card">这桩联院差事断了页。</div>';
  const last = choice.beat === choice.count - 1;
  return `
    <div class="joint-result-stage visual-stage joint-beat-${choice.beat + 1}" style="--scene-bg:url('${urlFor(choice.asset)}')" data-joint-result="${choice.id}" data-joint-beat="${choice.beat + 1}">
      <div class="decision-panel joint-result-panel">
        ${phaseHeader(`联院差事 · ${choice.participants.map((id) => HEROINES[id].short).join('与')} · ${narrativeStep(choice.beat + 1, choice.count)}`, beat.title, beat.body)}
        <div class="joint-story-row"><div class="joint-pair-voices">${choice.participants.map((id) => `<span class="${beat.speaker === id ? 'speaking' : ''}"><i>${HEROINES[id].glyph}</i>${HEROINES[id].short}</span>`).join('')}</div><p class="joint-payoff">${last ? `${choice.hint} · 两个人都把对方的方法写进自己的证链` : beat.speaker ? `${HEROINES[beat.speaker].short}主导这一幕，另一人仍保留反对与改手的权利` : '方法已经合流，但两人的边界没有被抹成同一种'}</p></div>
        <button class="ink-button story-continue" data-joint-continue="1">${last ? '把这桩合办记进总账' : choice.beat === 0 ? `听${HEROINES[choice.participants[1]].short}怎么接` : '看两种法子怎样扣在一起'}</button>
      </div>
    </div>`;
}

function renderPortablePrecedent() {
  const story = E.currentPortablePrecedent(state);
  if (!story?.current) return '<div class="fatal-card">第二张契没有接上第一桩联院差事。</div>';
  const activeReply = story.stage === 'reply' ? story.replies.find((row) => row.heroine === story.reply.heroine) : null;
  const cast = story.participants.map((id) => {
    const person = HEROINES[id];
    const reply = story.replies.find((row) => row.heroine === id);
    const label = ({stand:'守原规',narrow:'收窄',withdraw:'撤回外推'})[reply.outcome];
    return `<figure class="${activeReply?.heroine === id ? 'speaking' : ''}" data-precedent-heroine="${id}"><img src="${urlFor(person.portrait)}" alt="${person.name}"/><figcaption><i>${person.glyph}</i><b>${person.name}</b><span>${story.beat >= story.participants.indexOf(id) + 1 ? label : '尚未作答'}</span></figcaption></figure>`;
  }).join('');
  let content = '';
  if (story.stage === 'opening') {
    content = `<section class="precedent-object" aria-label="院外经手人与第二张契"><p><b>${escapeHtml(story.outsider.name)}</b> · ${escapeHtml(story.outsider.role)} · 成年经手人</p><span>他只为自己的交易、证言或工资来援引，不知道院门内的私物和关系史。</span></section><button class="ink-button story-continue" data-portable-precedent-continue="1">让两位原经手人分别答</button>`;
  } else if (story.stage === 'reply') {
    content = `<blockquote class="precedent-reply"><span>${HEROINES[activeReply.heroine].name}自主作答 · ${escapeHtml(story.response.title)}</span>${escapeHtml(story.response.line)}</blockquote><ul class="precedent-reasons" aria-label="她这样回答的真实前史">${activeReply.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul><button class="ink-button story-continue" data-portable-precedent-continue="1">${story.beat === 1 ? `听${HEROINES[story.participants[1]].short}独立作答` : '两份答复都不许由你改口'}</button>`;
  } else if (story.stage === 'decision') {
    content = `<section class="precedent-boundary" aria-label="两位原经手人的授权边界">${story.replies.map((reply) => `<article><b>${HEROINES[reply.heroine].name}</b><span>${({stand:'守原规',narrow:'只放窄界',withdraw:'撤回外推'})[reply.outcome]}</span><p>${escapeHtml(reply.reasons[2])}</p></article>`).join('')}</section><div class="choice-grid">${E.portablePrecedentOptions(state).map((choice) => choiceButton(choice, 'portable-precedent-choice')).join('')}</div>`;
  } else {
    content = `<section class="precedent-scope"><span>实际适用范围</span><b>${escapeHtml(story.resolution.scopeLabel)}</b></section><ol class="precedent-steps" aria-label="第二张契实际执行">${(story.resolution.steps ?? []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><button class="ink-button story-continue" data-portable-precedent-continue="1">把第二张契的去处写进总账</button>`;
  }
  return `<div class="portable-precedent-stage visual-stage stage-${story.stage}" data-portable-precedent="${story.action}" data-portable-precedent-stage="${story.stage}" data-portable-precedent-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor('compound')}')"><div class="precedent-cast" aria-label="两位原经手人">${cast}</div><div class="decision-panel portable-precedent-panel">${phaseHeader(`联院差事的院外回声 · ${narrativeStep(story.beat + 1, story.count)}`, story.current.title, story.current.body)}${content}</div></div>`;
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
        ${event.memory ? `<blockquote class="household-memory"><span>她把上一笔原样拿回来</span>${escapeHtml(event.memory)}</blockquote>` : ''}
        ${event.earlyDayEcho ? `<aside class="council-external-echo household-early-day-echo" data-household-early-day="${event.earlyDayEcho.sourceAction}"><span>第三日实物把娇儿带进这笔报价</span><b>${escapeHtml(event.earlyDayEcho.label)}</b><p>${escapeHtml(event.earlyDayEcho.object)}</p><small>她只认自己能认的来路；这件物没有自动变成免费口供。</small></aside>` : ''}
        ${event.stoveEcho ? `<aside class="council-external-echo household-stove-echo" data-household-stove-echo="${event.stoveEcho.sourceAction}"><span>第八日停灶留下的生活证物把旧箱带到桌前</span><b>${escapeHtml(event.stoveEcho.label)}</b><p>${escapeHtml(event.stoveEcho.object)}</p><small>它只证明一段工钱、寄存或亲见；原契、抄本与押名仍由娇儿在这笔交易里处分。</small></aside>` : ''}
        ${event.emergencyEcho ? `<aside class="council-external-echo household-emergency-echo" data-household-emergency-echo="${event.emergencyEcho.sourceAction}"><span>第十三日归名方式限定这张票能补什么</span><b>${escapeHtml(event.emergencyEcho.label)}</b><p>${escapeHtml(event.emergencyEcho.object)}</p><small>这件纸物只限定责任与用途；银票成交、拒兑及二次处分仍等娇儿亲手落字。</small></aside>` : ''}
        ${event.vaultEcho ? `<aside class="council-external-echo household-vault-echo" data-household-vault-echo="${event.vaultEcho.sourceAction}"><span>第十七日夜查决定她能验真的哪一程</span><b>${escapeHtml(event.vaultEcho.label)}</b><p>${escapeHtml(event.vaultEcho.object)}</p><small>这件实物只能限定一段来路；完整站名、证言与席位仍由娇儿此刻处分。</small></aside>` : ''}
        ${event.transactionPreparation ? `<aside class="council-external-echo household-transaction-preparation" data-household-preparation="${event.transactionPreparation.sourceAction}"><span>今日白日只把交易条件备齐</span><b>${escapeHtml(event.transactionPreparation.title)}</b><p>${escapeHtml(event.transactionPreparation.object)}</p><small>${escapeHtml(event.transactionPreparation.sourceActors.map((id) => HEROINES[id].short).join('、'))}完成“${escapeHtml(event.transactionPreparation.label)}”；具名底价、授权抄本或原件转移仍等娇儿此刻决定。</small></aside>` : ''}
        ${(event.earlyLedgers ?? []).map((echo) => `<aside class="council-external-echo household-early-ledger" data-household-early-ledger="${escapeHtml(echo.factId)}"><span>早先纸物仍按原位回读</span><b>${escapeHtml(echo.title)}</b><p>${escapeHtml(echo.text)}</p><small>${escapeHtml(echo.permission)}</small></aside>`).join('')}
        ${event.councilRule ? `<aside class="council-external-echo household-council-rule" data-household-council-rule="${event.councilRule.sourceChoice}"><span>${state.day === 14 ? '第十二日的三钥规矩正在限定这张票' : '第十七日的追问规矩正在限定这笔交易'}</span><b>${escapeHtml(event.councilRule.title)}</b><p>${escapeHtml(event.councilRule.text)}</p><small>${event.councilRule.preparation ? `今日先由${escapeHtml(HEROINES[event.councilRule.preparation.actor].short)}完成“${escapeHtml(event.councilRule.preparation.label)}”，并未提前成交。` : '这项权限只从真实院议历史派生。'}</small></aside>` : ''}
        ${event.nightLedger ? `<aside class="council-external-echo household-night-ledger" data-night-ledger-day18="${event.nightLedger.choice}" data-day5-opening-long="${event.nightLedger.publicOpeningChoice}"><span>第七夜留下的不是长期同意</span><b>${escapeHtml(event.nightLedger.title)}</b><p>${escapeHtml(event.nightLedger.text)}</p><small>${escapeHtml(event.nightLedger.permission)} · 第五日仍按“${escapeHtml(event.nightLedger.publicOpeningLabel)}”划分责任。</small></aside>` : ''}
        <div class="household-standing">她如今${E.householdTier(row.regard)} · ${escapeHtml(event.ledger.label)}${event.ledger.outstanding ? ` · 未清 ${event.ledger.outstanding} 两` : ''}。</div>
        <div class="choice-grid">${E.householdOptions(state).map((choice) => choiceButton(choice, 'household')).join('')}</div>
      </div>
    </div>`;
}

function renderHouseholdAftermath() {
  const story = E.currentHouseholdAftermath(state);
  const beat = story?.current;
  if (!story || !beat) return '<div class="fatal-card">娇儿这笔交易没有写到下一页。</div>';
  const castIds = ['li_jiaoer', ...story.witnesses];
  const castPerson = (id) => id === 'li_jiaoer' ? HOUSEHOLD.li_jiaoer : HEROINES[id];
  const ledger = E.jiaoerLedger(state);
  const action = story.awaitingChoice
    ? `<div class="choice-grid jiaoer-aftermath-choices">${E.householdAftermathOptions(state).map((choice) => choiceButton(choice, 'household-aftermath')).join('')}</div>`
    : `<button class="ink-button story-continue" data-household-aftermath-continue="1">${story.beat === 3 ? '把这笔写进跨幕总账' : story.beat === 0 ? '让五院见证人看这笔价' : '听她们把隐含代价问完'}</button>`;
  return `
    <div class="jiaoer-aftermath-stage visual-stage jiaoer-aftermath-beat-${story.beat + 1}" data-household-aftermath="${story.approach}" data-household-aftermath-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor(HOUSEHOLD.li_jiaoer.portrait)}')">
      <div class="jiaoer-aftermath-cast" aria-label="交易现场人物">
        ${castIds.map((id) => {
          const person = castPerson(id);
          return `<figure class="${story.speaker === id ? 'speaking' : ''}" data-jiaoer-cast="${id}"><img src="${urlFor(person.portrait)}" alt="${person.name}"/><figcaption><i>${person.glyph}</i>${person.name}</figcaption></figure>`;
        }).join('')}
      </div>
      <div class="decision-panel jiaoer-aftermath-panel">
        ${phaseHeader(`西厢跨幕交易 · ${narrativeStep(story.beat + 1, story.count)}`, beat.title, beat.body)}
        ${story.publicOpeningLongEcho ? `<aside class="council-external-echo household-day5-opening-long" data-household-day5-opening-long="${story.publicOpeningLongEcho.choice}:${story.beat + 1}"><span>第五日责任时序仍限制这一拍</span><b>${escapeHtml(story.publicOpeningLongEcho.label)}</b><p>${escapeHtml(story.publicOpeningLongEcho.text)}</p></aside>` : ''}
        <div class="jiaoer-aftermath-ledger" aria-label="娇儿交易总账">
          <span><small>本次初选</small><b>${escapeHtml(story.openingLabel ?? HOUSEHOLD_EVENTS[state.day].choices.find((choice) => choice.id === story.approach)?.label ?? '已落价')}</b></span>
          <span><small>旧款</small><b>${ledger.outstanding ? `${ledger.outstanding} 两未清` : '已分栏处理'}</b></span>
          <span><small>当前结法</small><b>${escapeHtml(ledger.label)}</b></span>
        </div>
        <p class="jiaoer-aftermath-speaker">${story.speaker === 'li_jiaoer' ? '娇儿守着价格边界' : `${HEROINES[story.speaker]?.name ?? '五院见证人'}正在追问这笔交易`}</p>
        ${action}
      </div>
    </div>`;
}

function renderCouncil() {
  const event = E.currentCouncilEvent(state);
  if (!event) return '<div class="fatal-card">院议这页断了。</div>';
  return `
    <div class="council-stage visual-stage" data-council-event="${event.id}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="decision-panel council-panel">
        ${phaseHeader(`第 ${state.day} 日 · ${event.title}`, event.heading, event.body)}
        ${event.day5Opening ? `<aside class="council-external-echo day5-public-opening" data-council-day5-opening="${event.day5Opening.choice}"><span>${event.day5Opening.choice === 'public_5_favor' ? '已认偏宠正在限定夜簿' : '逐手经办正在限定夜簿'}</span><b>${escapeHtml(event.day5Opening.label)}</b><p>${escapeHtml(event.day5Opening.day7Text)}</p></aside>` : ''}
        ${event.day10Opening ? `<aside class="council-external-echo day10-public-opening" data-council-day10-opening="${event.day10Opening.choice}"><span>${event.day10Opening.choice === 'public_10_hide' ? '四份原页与收讫条正在限定分存' : '五份本人原页正在限定分存'}</span><b>${escapeHtml(event.day10Opening.label)}</b><p>${escapeHtml(event.day10Opening.day12Text)}</p></aside>` : ''}
        ${event.sourceChoice && event.object ? `<aside class="council-external-echo council-night-ledger-source" data-night-ledger-source="${event.sourceChoice}:${event.actChoice}"><span>第五日的描述权与第六日的互见方式一起落到这件物上</span><b>${escapeHtml(event.object)}</b><p>${escapeHtml(PUBLIC_FOLLOWUPS[5].choices.find((choice) => choice.id === event.sourceChoice)?.label ?? event.sourceChoice)} · ${escapeHtml(ACT_TRANSITIONS[6].choices.find((choice) => choice.id === event.actChoice)?.label ?? event.actChoice)}</p></aside>` : ''}
        ${event.accountEcho ? `<aside class="council-external-echo council-account-echo" data-council-account-echo="${event.accountEcho.sourceAction}"><span>第六日假账处理给这场院议留下一件实物</span><b>${escapeHtml(event.accountEcho.label)}</b><p>${escapeHtml(event.accountEcho.object)}</p><small>它只证明纸、话或食盒怎样走，不替任何人取得总代表权。</small></aside>` : ''}
        ${event.externalEcho ? `<aside class="council-external-echo" data-external-echo="${event.externalEcho.sourceResult}"><span>昨日三口复案仍在追问这条规矩</span><b>${escapeHtml(event.externalEcho.choice)}</b><p>${escapeHtml(event.externalEcho.text)}</p></aside>` : ''}
        ${event.publicOpening ? `<aside class="council-external-echo day15-public-opening ${event.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-council-day15-opening="${event.publicOpening.choice}"><span>${event.publicOpening.falseScapegoat ? '先押与撤押必须先于问答规则落字' : '空白罪名栏仍先于问答规则'}</span><b>${escapeHtml(event.publicOpening.label)}</b><p>${escapeHtml(event.publicOpening.day17Text)}</p></aside>` : ''}
        ${event.investigationEcho ? `<aside class="council-external-echo council-investigation-echo" data-investigation-echo="${event.investigationEcho.sourceChoice}:${event.investigationEcho.actChoice}"><span>第十日至第十一日留下的物件没有复原</span><b>${escapeHtml(event.investigationEcho.label)}</b><p>${escapeHtml(event.investigationEcho.text)}</p></aside>` : ''}
        ${event.saltEcho ? `<aside class="council-external-echo council-salt-echo" data-council-salt-echo="${event.saltEcho.sourceAction}"><span>第十一日盐瓮处理正在限定这场院议</span><b>${escapeHtml(event.saltEcho.label)}</b><p>${escapeHtml(event.saltEcho.object)}</p><small>它能接出一段箱路，不能替任何人补成换箱主谋。</small></aside>` : ''}
        ${event.crowdEcho ? `<aside class="council-external-echo council-crowd-echo" data-council-crowd-echo="${event.crowdEcho.sourceAction}"><span>第十六日围门处理给问话规矩留下一件原物</span><b>${escapeHtml(event.crowdEcho.label)}</b><p>${escapeHtml(event.crowdEcho.object)}</p><small>它只接出一段柜坊入口；问话权不能借机收走原票、原物或停问权。</small></aside>` : ''}
        <div class="council-cast" aria-label="参与院议的人">${event.participants.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${HEROINES[id].short}</figcaption></figure>`).join('')}</div>
        <p class="council-note">这不是替她们判输赢。你定的是：以后她们能怎样问、怎样拒绝、怎样彼此交账。</p>
        <div class="choice-grid">${E.councilOptions(state).map((choice) => choiceButton(choice, 'council')).join('')}</div>
      </div>
    </div>`;
}

function renderCouncilAftermath() {
  const story = E.currentCouncilAftermath(state);
  const beat = story?.current;
  if (!story || !beat) return '<div class="fatal-card">院议裁决没有落到下一页。</div>';
  const last = story.beat === story.count - 1;
  return `
    <div class="council-aftermath-stage visual-stage council-resolution-${state.day}" data-council-aftermath="${story.choice}" data-council-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="council-resolution-cast" aria-label="正在试用这条规矩的人">${story.participants.map((id) => `<figure class="${beat.speaker === id ? 'speaking' : 'listening'}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].name}</b></figcaption></figure>`).join('')}</div>
      <div class="decision-panel council-aftermath-panel">
        ${phaseHeader(`院议裁决 · ${story.label} · ${narrativeStep(story.beat + 1, story.count)}`, beat.title, beat.body)}
        ${story.day5Opening ? `<aside class="council-external-echo day5-public-opening" data-council-aftermath-day5-opening="${story.day5Opening.choice}:${story.beat + 1}"><span>${story.day5Opening.choice === 'public_5_favor' ? '已认偏宠仍限制这一拍' : '逐手经办仍限制这一拍'}</span><b>${escapeHtml(story.day5Opening.label)}</b><p>${escapeHtml(story.day5Opening.text)}</p></aside>` : ''}
        ${story.day10Opening ? `<aside class="council-external-echo day10-public-opening" data-council-aftermath-day10-opening="${story.day10Opening.choice}:${story.beat + 1}"><span>${story.day10Opening.choice === 'public_10_hide' ? '缺页仍不能被分钥复活' : '五份本人原页仍各守开封权'}</span><b>${escapeHtml(story.day10Opening.label)}</b><p>${escapeHtml(story.day10Opening.text)}</p></aside>` : ''}
        ${story.day15Opening ? `<aside class="council-external-echo day15-public-opening ${story.day15Opening.falseScapegoat ? 'is-contaminated' : ''}" data-council-aftermath-day15-opening="${story.day15Opening.choice}:${story.beat + 1}"><span>${story.day15Opening.falseScapegoat ? '错误归罪与撤回仍限制这一拍' : '没有预填犯人仍限制这一拍'}</span><b>${escapeHtml(story.day15Opening.label)}</b><p>${escapeHtml(story.day15Opening.text)}</p></aside>` : ''}
        <div class="council-rule-slip"><span>${story.beat === 0 ? '先说到明处' : story.beat === 1 ? '让受影响的人试用' : '写成能被追问的规矩'}</span><b>${last ? '这条规矩从今夜开始进入宅门日常；后面的选择会读取它，而不是只留一个旗标。' : '任何人都可以在下一拍指出它真正伤到谁，规矩还没有定稿。'}</b></div>
        <button class="ink-button story-continue" data-council-aftermath-continue="1">${last ? '让这条规矩真正生效' : story.beat === 0 ? '听受影响的人怎么说' : '看她们怎样把边界写清'}</button>
      </div>
    </div>`;
}

function renderVisitHub() {
  const status = E.sharedNightStatus(state);
  const alliance = E.allianceNightStatus(state);
  const accordRows = E.accordStatus(state);
  return `
    <div class="hub-stage visual-stage evening ${status.visible ? 'has-shared' : ''}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="visit-prompt">
        <div>${phaseHeader(`第 ${state.day} 日 · 黄昏`, '院门亮了灯', TEXT.chooseVisit)}</div>
        <aside class="accord-panel" aria-label="五院共约">
          <div class="accord-heading"><b>想让五盏灯一起亮</b><span>${narrativeProgress(status.complete, status.total, ['边界尚未落字', '边界正在逐院落字', '五院边界已齐'])} · ${narrativeProgress(status.covenantComplete, status.covenantTotal, ['尚未共同担事', '共担已有根基', '共担已经坐实'])} · ${narrativeProgress(status.networkComplete, status.networkTotal, ['院间仍彼此隔着', '院间开始互信', '院间互信已成网'])} · ${narrativeProgress(status.pressureComplete, status.pressureTotal, ['危局仍压着宅门', '多桩危局已经收住', '宅门经住了最后一问'])}</span></div>
          <div class="accord-seals">${accordRows.map((row) => `<span class="accord-seal ${row.complete ? 'complete' : ''}" data-accord="${row.key}"><i>${row.glyph}</i>${row.label}</span>`).join('')}</div>
          ${status.visible ? `<button class="shared-invite" data-shared-start="1" ${status.ready ? '' : 'disabled'}><b>请五个人都别走</b><span>${status.ready ? '五份边界、五份亲历、五桩合办事和三场公开口径都在，这回她们愿意一起留下。' : status.reason}</span></button>` : '<small>先听清五个人各自要什么，再让她们真的一起做成五件事。</small>'}
          ${alliance.visible ? `<button class="shared-invite alliance-invite" data-alliance-start="1" ${alliance.ready ? '' : 'disabled'}><b>${alliance.ready ? `逐院问${alliance.candidates.map((id) => HEROINES[id].short).join('、')}是否留下` : '逐院问灯'}</b><span>${alliance.ready ? '第十九夜真正入席的互证者会分别再答；你不能删名、排序或劝改。' : alliance.reason}</span></button>` : ''}
        </aside>
      </div>
      <div class="heroine-doors">
        ${HEROINE_IDS.map((id) => {
          const h = HEROINES[id];
          const r = state.relations[id];
          const knock = (state.visits?.[id] ?? 0) + 1;
          const complete = E.routeComplete(state, id);
          const cooling = E.routeCooling(state, id);
          const forecast = E.visitForecast(state, id);
          const observer = forecast.observer ? HEROINES[forecast.observer] : null;
          const jealous = forecast.mostJealous ? HEROINES[forecast.mostJealous.id] : null;
          const forecastRows = !complete && !cooling ? `
            <dl class="door-forecast">
              <div><dt>同场</dt><dd title="${escapeHtml(forecast.trustGoal)}">${observer ? `${observer.short} · ${E.bondTier(forecast.observerTrust)}` : '本院独章'}</dd></div>
              <div><dt>明早</dt><dd>${jealous ? `${jealous.short}会来追问这份偏爱` : '暂无旁院追问'}</dd></div>
              <div><dt>可走</dt><dd>${forecast.choiceKinds.length ? forecast.choiceKinds.join('／') : '等待前置条件'}</dd></div>
            </dl>
            ${forecast.obligation ? `<i class="door-due">${forecast.obligation.label} · ${forecast.obligation.statusLabel}</i>` : ''}` : '';
          return `<button class="door-card door-${id} ${complete ? 'complete' : ''} ${cooling ? 'cooling' : ''}" data-visit="${id}" data-visit-observer="${forecast.observer ?? ''}" ${complete || cooling ? 'disabled' : ''}><span>${h.house}</span><img src="${urlFor(h.portrait)}" alt="${h.name}"/><div><b>${complete ? `${h.short}这条路已有结果` : cooling ? `${h.short}今日没有开门` : `去${h.short}屋里`}</b><small>${cooling ? '失信还在门内，今夜不能用一句软话抹掉。' : h.want}</small><em>情 ${E.relationTier(r.qing, 'qing')} · 妒 ${E.relationTier(r.du, 'du')}</em><i class="door-knock">${complete ? '不再重复消耗这一条线' : cooling ? `到第 ${forecast.reopenDay} 日再来把话说清` : `${knock <= 1 ? '初次叩门' : knock <= 3 ? '旧话续上' : '深线将定'} · ${forecast.chapter}`}</i>${forecastRows}</div></button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderPersonalFinale() {
  const beat = E.personalFinaleBeat(state);
  if (!beat) return '<div class="fatal-card">个人终章这页没有接上。</div>';
  const heroine = HEROINES[beat.heroine];
  const others = HEROINE_IDS.filter((id) => id !== beat.heroine);
  return `
    <div class="personal-finale-stage visual-stage dialogue-${beat.heroine}" data-personal-finale="${beat.finale}" data-personal-finale-beat="${beat.id}">
      <div class="personal-finale-main" style="background-image:url('${urlFor(beat.asset)}')" role="img" aria-label="${heroine.name}在第二十夜处理最后的边界与善后"></div>
      <div class="personal-finale-others" aria-label="另外四院仍有各自的去处与权利">
        ${others.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${HEROINES[id].short}<small>${HEROINES[id].house}</small></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel personal-finale-panel">
        ${phaseHeader(`${beat.kicker} · ${heroine.house}`, beat.title, beat.body)}
        <blockquote class="personal-finale-voice"><b>${heroine.name}</b><p>${escapeHtml(beat.heroineLine)}</p></blockquote>
        ${beat.previousText ? `<blockquote class="personal-finale-last"><span>上一拍已经发生</span>${escapeHtml(beat.previousText)}</blockquote>` : ''}
        <p class="shared-proof">个人终章 · ${narrativeStep(beat.index + 1, 3)} · 选择她，不替另外四个人决定输赢</p>
        <div class="choice-grid">${E.personalFinaleOptions(state).map((choice) => choiceButton(choice, 'personal-finale')).join('')}</div>
      </div>
    </div>`;
}

function renderPersonalFinaleResult() {
  const result = E.currentPersonalFinaleResult(state);
  if (!result) return '<div class="fatal-card">这项终章回答没有接到她的回应。</div>';
  const heroine = HEROINES[result.heroine];
  const respondent = HEROINES[result.respondent];
  const others = HEROINE_IDS.filter((id) => id !== result.heroine);
  const agreements = !result.departure && result.arrangements.length
    ? `<section class="personal-finale-agreements"><header><b>以前说过的话也来到终章</b><span>${result.arrangements.length > 1 ? '旧约都在执行' : '旧约仍在执行'}</span></header>${result.arrangements.map((row) => `<div data-finale-agreement="${row.id}"><small>${row.tier === 'explicit' ? '留宿旧约' : '前奏旧约'} · 第 ${row.day} 夜</small><b>${escapeHtml(row.label)}</b><p>${escapeHtml(row.future)}</p></div>`).join('')}</section>`
    : !result.departure
      ? '<p class="personal-finale-no-agreement">此前没有共同处理过亲密之后的生活；这一夜不会替空白编造旧约。</p>'
      : '';
  const outcomeLabel = result.outcome ? ({ accept:'接下程序', amend:'亲手改约', refuse:'自行收回' })[result.outcome] : null;
  const selectedReasonLedger = !result.departure && result.reasons.length
    ? `<section class="personal-departure-reasons personal-selected-reasons" aria-label="${heroine.name}接住这一答的真实历史依据"><header><b>她为何接住这一答</b><span>从二十日旧事来</span></header><ol>${result.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></section>`
    : '';
  const reasonLedger = result.departure
    ? `<section class="personal-departure-reasons" aria-label="${respondent.name}作出这个决定的真实历史依据"><header><b>为何这样答</b><span>不由好感代答</span></header><ol>${result.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></section>`
    : `${selectedReasonLedger}${agreements}`;
  const kicker = result.departure
    ? `第二十夜 · 四院善后 · ${narrativeStep(result.departureIndex + 1, result.departureCount)} · ${respondent.house}`
    : `第二十夜 · ${heroine.house} · 回应${narrativeStep(result.index + 1, result.count)}`;
  const body = result.departure
    ? `${heroine.name}的第三答提出“${result.procedure.label}”：${result.procedure.summary}${respondent.name}现在只就${result.procedure.focus}处分自己的物件与权利。`
    : result.choice.text;
  const continueLabel = result.departure
    ? result.final ? '听完四院，让专情结局落下' : '听下一院自己作答'
    : result.index === result.count - 1 ? '让另外四院自己回应善后' : '听她继续问下一件事';
  return `
    <div class="personal-finale-result-stage visual-stage dialogue-${result.respondent}${result.departure ? ' personal-departure-stage' : ''}" data-personal-finale-result="${result.choice.id}" data-result-index="${result.index}"${result.departure ? ` data-personal-departure="${result.respondent}" data-departure-outcome="${result.outcome}"` : ''}>
      <div class="personal-finale-main personal-finale-result-main" style="background-image:url('${urlFor(result.asset)}')" ${result.departure ? 'aria-hidden="true"' : `role="img" aria-label="${heroine.name}听完终章回答后的反应"`}></div>
      <div class="personal-finale-others result-witnesses" aria-label="另外四院依次处分自己的物件与权利">
        ${others.map((id) => `<figure class="${result.departure && id === result.respondent ? 'is-responding' : ''}" data-departure-heroine="${id}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${HEROINES[id].short}<small>${HEROINES[id].house}</small></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel personal-finale-panel personal-finale-result-panel">
        ${phaseHeader(kicker, result.response.title, body)}
        <blockquote class="personal-finale-response"><b>${respondent.name}</b><p>${escapeHtml(result.response.line)}</p></blockquote>
        ${reasonLedger}
        <div class="personal-finale-result-ledger"><span>${result.departure ? '本人决定' : '这一答'}</span><b>${escapeHtml(outcomeLabel ?? result.choice.label)}</b><em>${result.departure ? `她的回应走到${narrativeStep(result.departureIndex + 1, result.departureCount)} · 被选者不得代答` : `${result.choice.style === 'open' ? '明账相守' : '私门相守'} · 回应已走到${narrativeStep(result.index + 1, result.count)}`}</em></div>
        <button class="ink-button story-continue personal-finale-result-continue" data-personal-finale-result-continue="1">${continueLabel}</button>
      </div>
    </div>`;
}

function renderAllianceAssembly() {
  const story = E.currentAllianceAssembly(state);
  if (!story) return '<div class="fatal-card">逐院问灯没有接上第十九夜的有限互证。</div>';
  const outcomeLabel = { join:'本人留下', amend:'收窄后留下', withdraw:'自行回院' };
  const currentHeroine = story.reply ? HEROINES[story.reply.heroine] : null;
  const roster = story.replies.map((reply) => {
    const heroine = HEROINES[reply.heroine];
    const voice = ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine][reply.outcome];
    const revealed = story.beat > story.candidates.indexOf(reply.heroine);
    return `<figure class="${story.reply?.heroine === reply.heroine ? 'is-responding' : ''} ${revealed || story.final ? `outcome-${reply.outcome}` : 'is-pending'}" data-alliance-candidate="${reply.heroine}"${revealed || story.final ? ` data-alliance-outcome="${reply.outcome}"` : ''}>
      <img src="${urlFor(heroine.close)}" alt="${heroine.name}"/>
      <figcaption><span>${heroine.house}</span><b>${heroine.name}</b><small>${revealed || story.final ? outcomeLabel[reply.outcome] : '本人尚未开口'}</small>${story.final ? `<em>${escapeHtml(voice.object)}</em>` : ''}</figcaption>
    </figure>`;
  }).join('');
  const replyBlock = story.reply && story.response ? `
    <blockquote class="alliance-assembly-answer" aria-live="polite">
      <span>${escapeHtml(story.response.object)}</span>
      <b>${currentHeroine.name} · ${escapeHtml(outcomeLabel[story.reply.outcome])}</b>
      <p>${escapeHtml(story.response.line)}</p>
      <em>${escapeHtml(story.response.action)}</em>
    </blockquote>
    <div class="alliance-assembly-reasons" aria-label="她从真实前史作答的依据">${story.reasons.map((reason) => `<p>${escapeHtml(reason)}</p>`).join('')}</div>` : '';
  const summary = story.final ? `<div class="alliance-assembly-summary" aria-label="逐院问灯结果">
    ${story.replies.map((reply) => {
      const voice = ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine][reply.outcome];
      return `<p data-assembly-summary="${reply.heroine}:${reply.outcome}"><b>${HEROINES[reply.heroine].short} · ${outcomeLabel[reply.outcome]}</b><span>${escapeHtml(voice.action)}</span><em>${escapeHtml(voice.object)}</em></p>`;
    }).join('')}
  </div>` : '';
  const button = story.final
    ? story.members.length >= 2 ? '进入联盟三问' : '回到五院门'
    : story.stage === 'opening' ? '听第一院本人作答' : story.beat === story.candidates.length ? '看真实落席名单' : '听下一院本人作答';
  return `
    <div class="alliance-assembly-stage visual-stage" data-alliance-assembly-beat="${story.beat + 1}" data-alliance-assembly-stage="${story.stage}">
      <div class="alliance-assembly-cast alliance-count-${story.candidates.length}" aria-label="第十九夜有限互证者逐院作答">${roster}</div>
      <div class="decision-panel alliance-assembly-panel">
        ${phaseHeader(`第二十夜 · 逐院问灯 · ${narrativeStep(story.beat + 1, story.count)}`, story.current.title, story.current.body)}
        ${replyBlock}
        ${summary}
        <p class="shared-proof">候选来自第十九夜真实有限互证；答复冻结在邀请发出前，不读取前一人的回答，也不按好感排序。</p>
        <button class="ink-button story-continue" data-alliance-assembly-continue="1">${button}</button>
      </div>
    </div>`;
}

function renderAllianceNight() {
  const beat = E.allianceNightBeat(state);
  if (!beat) return '<div class="fatal-card">联盟终章这页没有接上。</div>';
  const names = beat.members.map((id) => HEROINES[id].short).join('、');
  return `
    <div class="alliance-night-stage visual-stage alliance-size-${beat.members.length}" data-alliance-beat="${beat.id}">
      <div class="alliance-cast" aria-label="${names}正在共同商定联盟">
        ${beat.members.map((id) => {
          const heroine = HEROINES[id];
          const line = ALLIANCE_VOICES[id]?.[beat.voice] ?? '';
          return `<figure><img src="${urlFor(heroine.close)}" alt="${heroine.name}"/><figcaption><span>${heroine.house}</span><b>${heroine.name}</b><p>${escapeHtml(line)}</p></figcaption></figure>`;
        }).join('')}
      </div>
      <div class="decision-panel alliance-night-panel">
        ${phaseHeader(`${beat.kicker} · ${names}`, beat.title, beat.body)}
        <div class="alliance-voices-inline">${beat.members.map((id) => `<p><b>${HEROINES[id].short}</b>${escapeHtml(ALLIANCE_VOICES[id]?.[beat.voice] ?? '')}</p>`).join('')}</div>
        ${beat.previousText ? `<blockquote class="alliance-last-result"><span>上一句话已经落地</span>${escapeHtml(beat.previousText)}</blockquote>` : ''}
        ${beat.assembly ? `<div class="alliance-assembly-chain"><b>第十九夜互证 → 第二十夜本人答复</b>${beat.assembly.replies.map((reply) => {
          const voice = ALLIANCE_ASSEMBLY_RESPONSES[reply.heroine][reply.outcome];
          const label = ({join:'留下',amend:'改约后留下',withdraw:'自行回院'})[reply.outcome];
          return `<span data-alliance-chain="${reply.heroine}:${reply.outcome}">${HEROINES[reply.heroine].short} · ${label}<em>${escapeHtml(voice.object)}</em></span>`;
        }).join('')}</div>` : ''}
        <p class="shared-proof">联盟终章 · ${narrativeStep(beat.index + 1, 3)} · ${beat.members.length === 4 ? '四人全部由本人落席，任何冲突都必须具名处理' : beat.members.length === 3 ? '三个人的关系不由一条强边替另一人作答' : '两个人不是共享同一位恋人的陌生人'}</p>
        <div class="choice-grid">${E.allianceNightOptions(state).map((choice) => choiceButton(choice, 'alliance-night')).join('')}</div>
      </div>
    </div>`;
}

function renderAllianceNightResult() {
  const result = E.currentAllianceNightResult(state);
  if (!result) return '<div class="fatal-card">这项联盟回答没有接到在场人的回应。</div>';
  const names = result.members.map((id) => HEROINES[id].short).join('、');
  const memberReasonLedger = `<section class="personal-departure-reasons alliance-member-reasons" aria-label="真实成员各自接住这项联盟安排的依据"><header><b>她为何在这一拍接住同盟</b><span>成员相同，旧事与边界并不相同</span></header><ol>${result.memberReasons.map((member) => `<li data-alliance-member-reasons="${result.choice.id}:${member.heroine}"><b>${escapeHtml(HEROINES[member.heroine].short)}</b><ol>${member.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></li>`).join('')}</ol></section>`;
  return `
    <div class="alliance-night-stage alliance-night-result-stage visual-stage alliance-size-${result.members.length}" data-alliance-result="${result.choice.id}">
      <div class="alliance-cast alliance-result-cast" aria-label="${names}逐一回应刚才的安排">
        ${result.members.map((id) => `<figure><img src="${urlFor(HEROINES[id].close)}" alt="${HEROINES[id].name}"/><figcaption><span>${HEROINES[id].house}</span><b>${HEROINES[id].name}</b><p>${escapeHtml(result.response.lines[id])}</p></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel alliance-night-panel alliance-result-panel">
        ${phaseHeader(`第二十夜 · ${names} · 回应${narrativeStep(result.index + 1, result.count)}`, result.response.title, result.response.lead)}
        <div class="alliance-result-voices">${result.members.map((id) => `<blockquote data-alliance-speaker="${id}"><b>${HEROINES[id].short}</b><p>${escapeHtml(result.response.lines[id])}</p></blockquote>`).join('')}</div>
        ${memberReasonLedger}
        <div class="alliance-result-ledger"><span>刚才的安排</span><b>${escapeHtml(result.choice.label)}</b><em>${escapeHtml(result.choice.text)}</em></div>
        <div class="alliance-result-bonds">${result.bonds.map((row) => `<span>${HEROINES[row.left].short} ⇄ ${HEROINES[row.right].short}<b>${E.bondTier(row.trust)}</b></span>`).join('')}</div>
        <button class="ink-button story-continue alliance-result-continue" data-alliance-result-continue="1">${result.final ? '让这份有限同盟落下' : '听她们继续谈下一件事'}</button>
      </div>
    </div>`;
}

function renderSharedNight() {
  const rows = E.accordStatus(state);
  const lastPublic = Object.values(PUBLIC_EVENTS).at(-1);
  const backdrop = SCENES[lastPublic?.scene]?.asset ?? 'compound';
  return `
    <div class="shared-stage visual-stage" style="--scene-bg:url('${urlFor(backdrop)}')">
      <div class="decision-panel shared-panel">
        ${phaseHeader('第二十夜 · 五人都没走', '总账还在桌上，五处院门的钥匙都在各自手里', TEXT.sharedNightLead)}
        <div class="accord-seals shared-seals">${rows.map((row) => `<span class="accord-seal ${row.complete ? 'complete' : ''}" data-accord="${row.key}"><i>${row.glyph}</i>${row.label}</span>`).join('')}</div>
        <p class="shared-proof">${narrativeProgress(Math.min(E.jointActionCount(state), E.JOINT_ACTION_TARGET), E.JOINT_ACTION_TARGET, ['联院差事尚未成形', '已有搭档真正共事', '五组搭档都已共事'])} · ${narrativeProgress(state.resolvedPressures.length, E.PRESSURE_TARGET, ['危局仍压着宅门', '多桩危局已经收住', '宅门经得住最后一问'])}</p>
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
        <p class="shared-proof">夜还在往下走 · ${narrativeStep(state.sharedAfterglowChoices.length + 1, SHARED_AFTERGLOW_BEATS.length)} · 每句话都会有人接</p>
        <div class="choice-grid">${E.sharedAfterglowOptions(state).map((choice) => choiceButton(choice, 'shared-afterglow')).join('')}</div>
      </div>
    </div>`;
}

function renderSharedAfterglowResult() {
  const result = E.currentSharedAfterglowResult(state);
  if (!result) return '<div class="fatal-card">这项余夜安排没有接到五个人的回应。</div>';
  const reasonLedger = result.memberReasons?.length
    ? `<section class="personal-departure-reasons shared-finale-reasons" aria-label="五个人各自依据真实前史回应这项共守安排"><header><b>她为何在这一拍接住共守</b><span>同席不等于同一份前史</span></header><ol>${result.memberReasons.map((member) => `<li data-shared-afterglow-reasons="${result.choice.id}:${member.heroine}"><b>${escapeHtml(HEROINES[member.heroine].short)}</b><ol>${member.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></li>`).join('')}</ol></section>`
    : '';
  return `
    <div class="shared-afterglow-result-stage visual-stage" data-shared-afterglow-result="${result.choice.id}" style="--scene-bg:url('${urlFor('cg/group/inner_court_accord')}')">
      <div class="shared-result-cast" aria-label="五个人分别回应这项余夜安排">
        ${result.members.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].short}</b><span>${HEROINES[id].house}</span></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel shared-afterglow-result-panel">
        ${phaseHeader(`第二十夜 · 五院余夜 · 回应${narrativeStep(result.index + 1, result.count)}`, result.response.title, result.response.lead)}
        <div class="shared-result-voices">${result.members.map((id) => `<blockquote data-shared-speaker="${id}"><b>${HEROINES[id].short}</b><p>${escapeHtml(result.response.lines[id])}</p></blockquote>`).join('')}</div>
        ${reasonLedger}
        <div class="shared-result-choice"><span>这一拍</span><b>${escapeHtml(result.choice.label)}</b><em>${escapeHtml(result.choice.text)}</em></div>
        <button class="ink-button story-continue shared-result-continue" data-shared-afterglow-result-continue="1">${result.final ? '让五个人一起走进余夜' : '听下一件事怎样落地'}</button>
      </div>
    </div>`;
}

function renderCollapseFinale() {
  const story = E.currentCollapseFinale(state);
  if (!story) return '<div class="fatal-card">破局清算这页没有接上。</div>';
  const current = story.current;
  const choicePanel = story.awaitingChoice
    ? `<div class="collapse-final-question"><span>最后一笔</span><b>圆满已经失去，你还要保住哪一种可执行的东西？</b><p>这项选择不会把坏局翻成好局。它决定天亮以后仍由谁掌握证据、钥匙、退路与追讨权。</p></div><div class="choice-grid collapse-final-choices">${E.collapseFinaleOptions(state).map((choice) => choiceButton(choice, 'collapse-choice')).join('')}</div>`
    : `<blockquote class="collapse-current-voice" data-collapse-speaker="${current.speaker}"><b>${HEROINES[current.speaker].name}</b><p>${escapeHtml(current.text)}</p></blockquote><button class="ink-button story-continue collapse-continue" data-collapse-continue="1">${story.beat === 0 ? '让下一人把代价接上' : story.beat === 1 ? '看这局还压住了谁' : '亲手决定最后保住什么'}</button>`;
  return `
    <div class="collapse-finale-stage visual-stage collapse-cause-${story.cause}" data-collapse-cause="${story.cause}" data-collapse-step="${story.beat + 1}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="collapse-cast" aria-label="五个人正在清算这场破局">
        ${HEROINE_IDS.map((id) => `<figure class="${current?.speaker === id ? 'speaking' : ''}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].short}</b></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel collapse-finale-panel">
        ${phaseHeader(`${story.kicker} · 清算${narrativeStep(story.beat + 1, story.count)}`, current?.title ?? '最后还能留下什么', current ? story.title : '前面三笔已经说清。现在没有圆满可补，只能决定哪一项权利与事实不再被继续抵押。')}
        <div class="collapse-cause-ledger"><span>破局来源</span><b>${story.cause === 'shared_buy_quiet' ? '拿银买静' : story.cause === 'shared_false_only' ? '复制唯一承诺' : story.endingId === 'intrigue' ? '权谋代价追上门' : '关系与过程同时失守'}</b><em>${story.endingId === 'intrigue' ? '外账或许赢了，借来的人情仍会要价' : '关系不会因最后一次点击恢复，只能停止继续伤人'}</em></div>
        ${choicePanel}
      </div>
    </div>`;
}

function renderCollapseFinaleResult() {
  const result = E.currentCollapseFinaleResult(state);
  if (!result) return '<div class="fatal-card">这项最后选择还没有接到五个人的回应。</div>';
  const heroine = HEROINES[result.heroine];
  const memoryLedger = result.memory
    ? `<section class="personal-departure-reasons collapse-history-reasons collapse-current-memory" data-collapse-memory="${result.memory.choice}:${result.memory.heroine}" aria-label="${escapeHtml(heroine.name)}带到破局清算的真实旧事"><header><b>这件旧事为何追到今夜</b><span>最后取舍不能抹掉她的二十日历史</span></header><div><b>${escapeHtml(heroine.short)} · ${escapeHtml(result.memory.label)}</b><p>${escapeHtml(result.memory.text)}</p><em>${escapeHtml(result.memory.conclusion)}</em></div></section>`
    : '';
  const transcript = result.previous.length
    ? `<ol class="collapse-result-transcript" aria-label="前面已经落下的本人回应">${result.previous.map((row, index) => `<li data-collapse-result-record="${row.heroine}"><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(HEROINES[row.heroine].short)}</b><p>${escapeHtml(row.line)}</p></div></li>`).join('')}</ol>`
    : '';
  return `
    <div class="collapse-result-stage visual-stage collapse-cause-${result.cause}" data-collapse-result="${result.choice.id}" data-collapse-result-step="${result.index + 1}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="collapse-result-cast" aria-label="五个人分别回应最后留下的这一笔">
        ${result.members.map((id) => `<figure class="${id === result.heroine ? 'speaking' : result.previous.some((row) => row.heroine === id) ? 'heard' : ''}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].short}</b><span>${id === result.heroine ? '正在处分本人这一笔' : result.previous.some((row) => row.heroine === id) ? '本人回应已落账' : '仍在等候本人开口'}</span></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel collapse-result-panel">
        ${phaseHeader(`第二十夜 · 破局清算 · 本人回应${narrativeStep(result.index + 1, result.count)}`, `${heroine.name} · ${result.response.title}`, result.index === 0 ? result.response.lead : '前面的回应已经逐份留账。现在只听这一院怎样处置本人的原物、旧事与离开权。')}
        ${transcript}
        <blockquote class="collapse-result-current-voice" data-collapse-result-speaker="${result.heroine}"><b>${escapeHtml(heroine.short)}</b><p>${escapeHtml(result.line)}</p></blockquote>
        ${memoryLedger}
        <div class="collapse-result-ledger"><span>最后保住</span><b>${escapeHtml(result.choice.label)}</b><em>${escapeHtml(result.choice.text)}</em></div>
        <button class="ink-button story-continue collapse-result-continue" data-collapse-result-continue="1">${result.index + 1 < result.count ? '听下一人处分本人这一笔' : '带着五份真实后果走到天亮'}</button>
      </div>
    </div>`;
}

function renderSharedDawn() {
  return `
    <div class="shared-dawn-stage visual-stage" style="--scene-bg:url('${urlFor('cg/group/inner_court_afterglow')}')">
      <div class="decision-panel shared-dawn-panel">
        ${phaseHeader('第二十日 · 晨光进了纱帐', '天亮以后，昨夜依然算数', '月娘已披衣理账，金莲把扇子压在枕边，瓶儿重新系好钥匙，玉楼将五人的条款分别收好，雪娥起身收住最后一点炉火。你现在怎样走出这间屋，决定昨夜是一场酒，还是一个开始。')}
        <div class="choice-grid">${E.sharedDawnOptions(state).map((choice) => choiceButton(choice, 'shared-dawn')).join('')}</div>
      </div>
    </div>`;
}

function renderSharedDawnResult() {
  const result = E.currentSharedDawnResult(state);
  if (!result) return '<div class="fatal-card">次晨这项安排还没有接到五个人的白日回应。</div>';
  const reasonLedger = result.memberReasons?.length
    ? `<section class="personal-departure-reasons shared-finale-reasons" aria-label="五个人分别说明昨夜三拍怎样进入白日"><header><b>昨夜三拍为何能进入白日</b><span>次晨安排仍逐人核验</span></header><ol>${result.memberReasons.map((member) => `<li data-shared-dawn-reasons="${result.choice.id}:${member.heroine}"><b>${escapeHtml(HEROINES[member.heroine].short)}</b><ol>${member.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></li>`).join('')}</ol></section>`
    : '';
  return `
    <div class="shared-dawn-result-stage visual-stage" data-shared-dawn-result="${result.choice.id}" style="--scene-bg:url('${urlFor('cg/group/inner_court_afterglow')}')">
      <div class="shared-dawn-result-cast" aria-label="五个人分别确认昨夜怎样进入白日">
        ${result.members.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].short}</b><span>${HEROINES[id].house}</span></figcaption></figure>`).join('')}
      </div>
      <div class="decision-panel shared-dawn-result-panel">
        ${phaseHeader('第二十日 · 晨光已经见人 · 五院回应', result.response.title, result.response.lead)}
        <div class="shared-dawn-result-voices">${result.members.map((id) => `<blockquote data-shared-dawn-speaker="${id}"><b>${HEROINES[id].short}</b><p>${escapeHtml(result.response.lines[id])}</p></blockquote>`).join('')}</div>
        ${reasonLedger}
        <div class="shared-dawn-result-ledger"><span>次晨安排</span><b>${escapeHtml(result.choice.label)}</b><em>${escapeHtml(result.response.future)}</em></div>
        <button class="ink-button story-continue shared-dawn-result-continue" data-shared-dawn-result-continue="1">让这项白日安排进入五院结局</button>
      </div>
    </div>`;
}

function renderVisit() {
  const id = state.currentHeroine;
  const h = HEROINES[id];
  const choices = E.visitChoices(state, id);
  const stance = E.routeStance(state, id);
  const branch = E.routeBranchContext(state, id);
  return `
    <div class="dialogue-stage visual-stage dialogue-${id}">
      <div class="close-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}近景"></div>
      <div class="decision-panel dialogue-panel">
        ${phaseHeader(`${h.house} · ${h.shape}`, h.name, h.voice)}
        <p class="want-line">${h.want}<br/><span>${h.gives}</span><br/><small>这条线已记：${stance.covenant === stance.private ? (stance.covenant ? '共同承担与私下情分仍在拉扯' : '两种相处都还没有定形') : stance.covenant > stance.private ? '共同承担渐成主线' : '私下情分渐成主线'}</small></p>
        ${branch ? `<aside class="route-branch-memory branch-${branch.lane}" data-route-branch="${branch.lane}:${branch.step}"><span>${escapeHtml(branch.label)} · ${branch.lane === 'covenant' ? '共同承担已经改写后续' : '私下情分已经改写后续'}</span><b>此前的选择把这一章带到这里</b><p>${escapeHtml(branch.body)}</p></aside>` : ''}
        ${favorReckoningMemory(id)}
        ${routeReckoningMemory(id)}
        ${intimacyMemory(id)}
        ${nightConversationMemory(id)}
        ${ordinaryNightMemory(id)}
        ${duskInvitationMemory(id)}
        ${rivalryMorningMemory(id)}
        ${pairInterludeMemory(id)}
        <div class="choice-stack">${choices.map((choice) => choiceButton(choice, 'route-choice')).join('')}</div>
      </div>
    </div>`;
}

function routeContinuityCard(event) {
  const memory = event.continuityMemory;
  if (!memory) return '';
  return `<p class="aftermath-pair-memory aftermath-continuity-memory continuity-${memory.kind}" data-route-continuity="${memory.kind}:${memory.day}"><span>最近一件关系事实进入当前冲突 · ${escapeHtml(memory.label)}</span><b>${escapeHtml(memory.title)}</b><small>${escapeHtml(memory.text)}</small></p>`;
}

function renderRouteAftermath() {
  const event = E.currentRouteAftermath(state);
  if (!event) return '<div class="fatal-card">这段夜话没有接上。</div>';
  ensureNarrativeAsset(event.asset);
  const heroine = HEROINES[event.heroine];
  const observer = HEROINES[event.observer];
  if (event.resolutionBeat) {
    const speaker = HEROINES[event.resolutionBeat.speaker];
    const listener = event.resolutionBeat.speaker === event.heroine ? observer : heroine;
    const previousBeats = event.resolutionBeats.slice(0, event.resolution.beat);
    const beatCopy = narrativeExcerpt(event.resolutionBeat.text);
    return `
      <div class="aftermath-stage aftermath-resolution visual-stage dialogue-${event.resolutionBeat.speaker}" data-aftermath-resolution="${event.event}:${event.resolutionChoice}:${event.resolution.beat}">
        <div class="aftermath-main" style="background-image:url('${urlFor(event.asset || speaker.close)}')" role="img" aria-label="${speaker.name}正在把你的处置做完"></div>
        <figure class="aftermath-observer"><img src="${urlFor(listener.portrait)}" alt="${listener.name}"/><figcaption><span>${listener.house}</span><b>${listener.name}</b></figcaption></figure>
        <div class="decision-panel aftermath-panel aftermath-resolution-panel">
          ${phaseHeader(`${escapeHtml(event.resolutionChoiceLabel)} · ${narrativeStep(event.resolution.beat + 1, event.resolutionCount)}`, event.resolutionTitle, event.body)}
          <p class="aftermath-echo"><span>这项处置从哪里来</span><b>${escapeHtml(event.sourceLabel)}</b><small>${escapeHtml(event.sourceText)}</small></p>
          <aside class="aftermath-route-stake" data-route-stake="${event.act}:${event.resolutionChoice}"><span>这一幕实际付出的后约成本</span><b>${escapeHtml(event.resolutionStake.label)} · ${escapeHtml(narrativeChoiceMeta(event.resolutionStake.resourceText))}</b><p>${escapeHtml(event.resolutionStake.text)}</p></aside>
          ${previousBeats.length ? `<ol class="route-resolution-transcript" aria-label="这项处置已经发生的动作">${previousBeats.map((beat, index) => `<li><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(beat.speakerName)}</b><p>${escapeHtml(beat.text)}</p></div></li>`).join('')}</ol>` : ''}
          ${narrativeArchive(beatCopy, 'route-beat-archive', `${event.resolutionBeat.speakerName}把这项处置说完`)}
          <blockquote class="aftermath-story-quote route-resolution-quote"><span>${escapeHtml(event.resolutionBeat.speakerHouse)}</span><b>${escapeHtml(event.resolutionBeat.speakerName)}</b><p>${escapeHtml(beatCopy.preview)}</p></blockquote>
          <button class="ink-button story-continue aftermath-continue" data-route-story="1">${event.resolution.beat + 1 < event.resolutionCount ? `看${listener.short}怎样接住` : '把这项处置带进今夜'}</button>
        </div>
      </div>`;
  }
  if (event.storyBeat) {
    const speaker = HEROINES[event.storyBeat.speaker];
    const listener = event.storyBeat.speaker === event.heroine ? observer : heroine;
    const lead = event.beat === 0
      ? event.body
      : `${speaker.short}没有让刚才那句话停在漂亮处。她把自己真正会失去的东西摆了出来，等另一人听完。`;
    const beatCopy = narrativeExcerpt(event.storyBeat.text);
    return `
      <div class="aftermath-stage aftermath-story ${event.milestone ? 'milestone-chapter' : ''} visual-stage dialogue-${event.storyBeat.speaker}" data-aftermath="${event.event}" data-story-beat="${event.beat}">
        <div class="aftermath-main" style="background-image:url('${urlFor(event.asset || speaker.close)}')" role="img" aria-label="${speaker.name}正在说话"></div>
        <figure class="aftermath-observer"><img src="${urlFor(listener.portrait)}" alt="${listener.name}"/><figcaption><span>${listener.house}</span><b>${listener.name}</b></figcaption></figure>
        <div class="decision-panel aftermath-panel aftermath-story-panel">
          ${phaseHeader(event.milestone ? '再次进门的关键章' : `路线小章 · ${narrativeStep(event.act, 4)}`, event.title, lead)}
          <p class="aftermath-echo"><span>你的上一拍</span><b>${escapeHtml(event.sourceLabel)}</b><small>${escapeHtml(event.sourceHint)}</small></p>
          ${routeContinuityCard(event)}
          ${narrativeArchive(beatCopy, 'route-beat-archive', `${event.storyBeat.speakerName}把这一拍说完`)}
          <blockquote class="aftermath-story-quote"><span>${escapeHtml(event.storyBeat.speakerHouse)}</span><b>${escapeHtml(event.storyBeat.speakerName)}</b><p>${escapeHtml(beatCopy.preview)}</p></blockquote>
          <button class="ink-button story-continue aftermath-continue" data-route-story="1">${event.beat + 1 < event.beatCount ? '听另一人说完' : '轮到你回应'}</button>
        </div>
      </div>`;
  }
  return `
    <div class="aftermath-stage ${event.milestone ? 'milestone-chapter' : ''} visual-stage dialogue-${event.heroine}" data-aftermath="${event.event}">
      <div class="aftermath-main" style="background-image:url('${urlFor(event.asset || heroine.close)}')" role="img" aria-label="${heroine.name}刚回应完你的选择"></div>
      <figure class="aftermath-observer"><img src="${urlFor(observer.portrait)}" alt="${observer.name}"/><figcaption><span>${observer.house}</span><b>${observer.name}</b></figcaption></figure>
      <div class="decision-panel aftermath-panel">
        ${phaseHeader(event.milestone ? '再次进门的关键章' : `路线小章 · ${narrativeStep(event.act, 4)}`, event.title, event.body)}
        <p class="aftermath-echo"><span>上一拍</span><b>${escapeHtml(event.sourceLabel)}</b><small>${escapeHtml(event.sourceText)}</small></p>
        ${routeContinuityCard(event)}
        <p class="aftermath-question">这件事已经越过一扇院门。你现在决定它怎样进入另外一个人的生活。</p>
        <div class="choice-stack">${E.routeAftermathOptions(state).map((choice) => choiceButton(choice, 'route-aftermath')).join('')}</div>
      </div>
    </div>`;
}

function renderNight() {
  const id = state.currentHeroine;
  const h = HEROINES[id];
  const coda = E.currentOrdinaryNightCoda(state);
  if (coda) {
    const actionLabel = coda.action === 'leave' ? '停在她愿意的位置' : '把未完的话听到底';
    const previousBeats = coda.beats.slice(0, coda.beat);
    return `
      <div class="night-talk-stage ordinary-night-coda visual-stage dialogue-${id}" data-night-coda="${coda.event}:${coda.beat}">
        <div class="close-cg closer night-talk-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}正在把今夜的话说到底"></div>
        <div class="night-talk-prop" aria-hidden="true"><span>${escapeHtml(coda.prop)}</span></div>
        <div class="decision-panel night-talk-panel ordinary-night-coda-panel">
          ${phaseHeader(`第 ${state.day} 夜 · ${actionLabel} · ${narrativeStep(coda.beat + 1, coda.count)}`, coda.current.title, coda.current.body)}
          ${intimacyMemory(id)}
          ${previousBeats.length ? `<ol class="night-coda-transcript" aria-label="今夜已经说过的话">${previousBeats.map((beat, index) => `<li><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(beat.title)}</b><p>${escapeHtml(beat.body)}</p></div></li>`).join('')}</ol>` : ''}
          <p class="night-coda-context"><b>${h.name}</b><span>${coda.action === 'leave' ? '门停在她亲口划下的位置。今夜不欠下一步，明日却会照这个停处重新安排。' : '茶还温着，她要把这句话问到能见明日，再让你带出这扇门。'}</span></p>
          <button class="ink-button story-continue night-talk-continue" data-night-coda-continue="1">${coda.beat + 1 < coda.count ? (coda.beat === 0 ? '让她把话接下去' : '听她说到天亮以后') : '把这句话带出门'}</button>
        </div>
      </div>`;
  }
  const conversation = E.currentNightConversation(state);
  if (conversation?.resolution) {
    const result = conversation.resolution;
    const previousBeats = result.beats.slice(0, result.beat);
    return `
      <div class="night-talk-stage night-talk-result visual-stage dialogue-${id}" data-night-talk-result="${result.id}:${result.beat}">
        <div class="close-cg closer night-talk-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}听见你的回答"></div>
        <div class="night-talk-prop" aria-hidden="true"><span>${escapeHtml(conversation.prop)}</span></div>
        <div class="decision-panel night-talk-panel night-talk-result-panel">
          ${phaseHeader(`第 ${state.day} 夜 · 夜谈${narrativeProgress(conversation.chapter, 4, ['刚刚起话', '正在接续', '已成条款'])} · 回答后章${narrativeStep(result.beat + 1, result.count)}`, result.current.title, result.current.body)}
          ${intimacyMemory(id)}
          ${result.beat === 0 && conversation.memoryEcho ? `<aside class="night-talk-memory"><span>上一章没有消失</span><p>${escapeHtml(conversation.memoryEcho)}</p></aside>` : ''}
          <aside class="night-talk-stake" data-night-stake="${result.mode}"><span>这章实际改变</span><b>${escapeHtml(result.stake.label)} · ${escapeHtml(narrativeChoiceMeta(result.stake.resourceText))}</b><p>${escapeHtml(result.stake.text)}</p></aside>
          ${result.beat > 0 ? `<p class="night-result-origin"><span>你刚才回答</span><b>${escapeHtml(result.label)}</b></p>` : ''}
          ${previousBeats.length ? `<ol class="night-result-transcript" aria-label="这次回答已经发生的后果">${previousBeats.map((beat, index) => `<li><span>${narrativeBeatMark(index)}</span><div><b>${escapeHtml(beat.title)}</b><p>${escapeHtml(beat.body)}</p></div></li>`).join('')}</ol>` : ''}
          ${result.beat + 1 === result.count ? `<div class="night-talk-continuity continuity-${result.continuity.kind}">
            <b>${escapeHtml(result.continuity.label)}</b>
            <p>${escapeHtml(result.continuity.text)}</p>
          </div>` : ''}
          ${result.beat + 1 === result.count && result.observerReaction ? `<aside class="night-talk-observer-reaction" data-night-observer="${result.observerReaction.heroine}"><span>天亮后真正被这项做法影响的人</span><b>${escapeHtml(result.observerReaction.name)}</b><p>${escapeHtml(result.observerReaction.line)}</p></aside>` : ''}
          ${result.beat === 0 ? `<p class="night-talk-consequence">${{
            honest: '实话见光 · 情意更深 · 妒意下降',
            listen: '边界由她决定 · 宅门与喘息都更稳',
            private: '门内亲近升温 · 旁院会记得这份私情',
          }[result.mode]}</p>` : ''}
          <button class="ink-button story-continue night-talk-continue" data-night-conversation-result="1">${result.beat === 0 ? '看她怎样试这句话' : result.beat + 1 < result.count ? '把明早的做法说清' : '让这三幅话一起到天亮'}</button>
        </div>
      </div>`;
  }
  if (conversation) {
    return `
      <div class="night-talk-stage visual-stage dialogue-${id}" data-night-talk="${conversation.id}:${conversation.beat}">
        <div class="close-cg closer night-talk-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}正在说一段只属于今夜的话"></div>
        <div class="night-talk-prop" aria-hidden="true"><span>${escapeHtml(conversation.prop)}</span></div>
        <div class="decision-panel night-talk-panel">
          ${phaseHeader(`第 ${state.day} 夜 · 夜谈${narrativeProgress(conversation.chapter, 4, ['刚刚起话', '正在接续', '已成条款'])} · ${narrativeStep(conversation.beat + 1, 2)}`, conversation.title, conversation.context)}
          ${intimacyMemory(id)}
          ${conversation.memoryEcho ? `<aside class="night-talk-memory"><span>她记得上一章</span><p>${escapeHtml(conversation.memoryEcho)}</p></aside>` : ''}
          <blockquote class="night-talk-voice"><span>${h.house}</span><b>${h.name}</b><p>${escapeHtml(conversation.storyText)}</p></blockquote>
          ${conversation.beat === 0
            ? '<button class="ink-button story-continue night-talk-continue" data-night-story="1">让她把真正的问题说完</button>'
            : `<p class="night-talk-question">这一夜不会由一条通用结果收尾。你现在的回答，会决定她把这段话当作明说、共同定界，还是只留门内的私情。</p><div class="choice-stack">${E.nightConversationOptions(state).map((choice) => choiceButton(choice, 'night-conversation')).join('')}</div>`}
        </div>
      </div>`;
  }
  const choices = E.nightOptions(state).map((option) => ({ ...NIGHT_TEXT[option.id], ...option }));
  return `
    <div class="dialogue-stage visual-stage night dialogue-${id}">
      <div class="close-cg closer" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${h.name}夜间近景"></div>
      <div class="decision-panel dialogue-panel">
        ${phaseHeader('夜深了', h.name, TEXT.nightLead)}
        ${intimacyMemory(id)}
        <div class="choice-stack">${choices.map((choice) => choiceButton(choice, 'night')).join('')}</div>
        <p class="consent-note">她往前一步，才有下一步。她若停下，门便停在这里。</p>
      </div>
    </div>`;
}

function renderMorningSettlement() {
  const story = E.currentMorningSettlement(state);
  if (!story) return '<div class="fatal-card">晨簿上的具名缺口断了页。</div>';
  const h = HEROINES[story.heroine.id];
  if (story.resolved) {
    return `
      <div class="morning-stage visual-stage tone-backing" data-morning-settlement="${story.cause}" data-morning-settlement-choice="${story.choice.id}" style="--scene-bg:url('${urlFor('compound')}')">
        <div class="morning-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${escapeHtml(story.imageLabel)}"></div>
        <div class="decision-panel morning-panel">
          ${phaseHeader(`${story.kicker} · 结算收束`, story.resolution.title, story.resolution.body)}
          <section class="precedent-scope"><span>本人之物</span><b>${escapeHtml(story.heroine.object)}</b></section>
          <ol class="precedent-steps" aria-label="这项限制如何真正执行">
            ${story.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
          <button class="ink-button story-continue" data-morning-settlement-continue="1">把限制写上白日行动卡</button>
        </div>
      </div>`;
  }
  return `
    <div class="morning-stage visual-stage tone-warning" data-morning-settlement="${story.cause}" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="morning-cg" style="background-image:url('${urlFor(h.close)}')" role="img" aria-label="${escapeHtml(story.imageLabel)}"></div>
      <div class="decision-panel morning-panel">
        ${phaseHeader(`${story.kicker} · 本人先处分`, story.title, story.body)}
        <section class="precedent-object" aria-label="缺口来源与本人处分">
          <p><b>${escapeHtml(story.sourceText)}</b> · ${h.name}</p>
          <span>${escapeHtml(story.heroine.opening.body)}</span>
        </section>
        <blockquote class="precedent-reply"><span>${escapeHtml(story.heroine.opening.title)}</span>${escapeHtml(story.heroine.opening.line)}</blockquote>
        <section class="precedent-boundary" aria-label="她已经收回的物件与恢复条件">
          <article><b>${escapeHtml(story.heroine.object)}</b><span>${escapeHtml(story.heroine.restriction.label)}</span><p>${escapeHtml(story.heroine.recovery.label)}</p></article>
        </section>
        <p class="rivalry-question">她已经处分本人之物。你不能选谁少领，只能决定宅子怎样承认这道缺口。</p>
        <div class="choice-grid">${E.morningSettlementOptions(state).map((choice) => choiceButton(choice, 'morning-settlement-choice')).join('')}</div>
      </div>
    </div>`;
}

function renderMorning() {
  const event = state.morning;
  const h = HEROINES[event.actor];
  const resolution = E.currentMorningResolution(state);
  if (resolution) {
    const actor = HEROINES[resolution.actor];
    const visited = HEROINES[resolution.visited];
    return `
      <div class="morning-stage rivalry-stage rivalry-resolved visual-stage tone-rivalry" data-rivalry-result="${resolution.choice}" style="--scene-bg:url('${urlFor('compound')}')">
        <div class="morning-cg rivalry-cg" style="background-image:url('${urlFor(actor.close)}')" role="img" aria-label="${actor.name}听见你的最终表态"></div>
        <figure class="rivalry-listener"><img src="${urlFor(visited.portrait)}" alt="${visited.name}"/><figcaption><span>${visited.house}</span><b>${visited.name}</b><small>她也承担了这次选择的后果</small></figcaption></figure>
        <div class="decision-panel morning-panel rivalry-panel rivalry-result-panel">
          ${phaseHeader(`第 ${state.day} 日 · 对峙结果收束`, resolution.title, resolution.text)}
          <p class="rivalry-consequence">${escapeHtml(resolution.consequence)}</p>
          <div class="rivalry-result-cast" aria-label="这次选择改变了两院关系"><span>${actor.short}</span><i>⇄</i><span>${visited.short}</span></div>
          <button class="ink-button story-continue rivalry-continue" data-morning-resolution="1">收下这次站队的后果</button>
        </div>
      </div>`;
  }
  const story = E.currentMorningStory(state);
  if (story) {
    const speaker = HEROINES[story.speaker];
    const listener = HEROINES[story.listener];
    return `
      <div class="morning-stage rivalry-stage visual-stage tone-rivalry" data-rivalry="${event.actor}:${event.visited}:${story.index}" style="--scene-bg:url('${urlFor('compound')}')">
        <div class="morning-cg rivalry-cg" style="background-image:url('${urlFor(speaker.close)}')" role="img" aria-label="${speaker.name}正在廊下说话"></div>
        <figure class="rivalry-listener"><img src="${urlFor(listener.portrait)}" alt="${listener.name}"/><figcaption><span>${listener.house}</span><b>${listener.name}</b></figcaption></figure>
        <div class="decision-panel morning-panel rivalry-panel">
          ${phaseHeader(`第 ${state.day} 日 · 三人对峙 · ${narrativeStep(story.index + 1, story.count)}`, event.title, event.text)}
          ${story.index === 0 ? (event.notes ?? []).map((note) => `<p class="morning-note">${escapeHtml(note)}</p>`).join('') : ''}
          <blockquote class="rivalry-voice"><span>${speaker.house}</span><b>${speaker.name}</b><p>${escapeHtml(story.text)}</p></blockquote>
          ${story.index < story.count - 1
            ? `<button class="ink-button story-continue rivalry-continue" data-morning-story="1">${story.index === 0 ? `听${listener.short}亲口回应` : '让这场问话说到底'}</button>`
            : `<p class="rivalry-question">她们都已亲口说完。现在才轮到你决定，偏爱要见光、交还给她们，还是继续只留在一扇门内。</p><div class="choice-stack">${E.morningOptions(state).map((choice) => choiceButton(choice, 'morning')).join('')}</div>`}
        </div>
      </div>`;
  }
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
  const current = E.currentPublicEvent(state);
  if (!current) return '<div class="fatal-card">这场公开问责断了页。</div>';
  // 选择前的公开席面只用宅院界画加暖灯遮罩:五人同框的群像留给选择之后的场景册,
  // 它第一次出现必须发生在玩家按下那个按钮之后。
  return `
    <div class="banquet-stage visual-stage" style="--scene-bg:url('${urlFor('compound')}')">
      <div class="decision-panel banquet-panel">
        ${phaseHeader(`第 ${state.day} 日 · ${current.title}`, current.heading ?? current.title, current.body ?? current.text ?? TEXT.banquetLead)}
        ${current.mealMemory ? `<aside class="opening-public-echo" data-meal-memory="${current.mealMemory.heroine}"><span>昨夜去处已经进入今日饭食</span><b>${escapeHtml(current.mealMemory.dish)} · ${escapeHtml(current.mealMemory.house)}</b><p>${escapeHtml(current.mealMemory.trace)}</p></aside>` : ''}
        ${current.dayPreparation ? `<aside class="opening-public-echo public-day-preparation" data-public-day-preparation="${current.dayPreparation.sourceDay}:${current.dayPreparation.sourceAction}"><span>今日白日做法已经进入公议</span><b>${escapeHtml(current.dayPreparation.label)}</b><p>${escapeHtml(current.dayPreparation.text)}</p><small>${escapeHtml(current.dayPreparation.object)}</small></aside>` : ''}
        ${current.draftEcho ? `<aside class="opening-public-echo" data-day15-draft-echo="${current.draftEcho.aftermath}"><span>昨日银票已成为堂前可见事实</span><b>${escapeHtml(current.draftEcho.label)}</b><p>${escapeHtml(current.draftEcho.text)}</p></aside>` : ''}
        ${current.openingMemory ? `<aside class="opening-public-echo first-day-opening-memory" data-day15-first-opening="${current.openingMemory.choice}"><span>第一日的起手原则回到堂前</span><b>${escapeHtml(current.openingMemory.title)}</b><p>${escapeHtml(current.openingMemory.day15Text)}</p></aside>` : ''}
        <div class="choice-grid">${E.banquetOptions(state).map((choice) => choiceButton(choice, 'banquet')).join('')}</div>
      </div>
    </div>`;
}

function renderPublicEvidence() {
  const chain = E.currentPublicEvidence(state);
  if (!chain) return '<div class="fatal-card">堂前的三步证链断了页。</div>';
  const introCopy = narrativeExcerpt(chain.body, 110);
  const slots = Array.from({ length:chain.count }, (_, index) => {
    const picked = chain.selectedEvidence[index];
    const step = chain.steps[index];
    return picked
      ? `<li class="filled strength-${step.strength}" data-public-evidence-slot="${index + 1}"><i>${narrativeBeatMark(index)}</i><span>${escapeHtml(picked.label)}</span><b>${step.strength === 2 ? (picked.id === 'cross_words' ? '收口成立' : '承接成立') : step.strength === 1 ? (picked.id === 'grain_measure' ? '事实迟到' : '旁证补强') : '承接悬空'}</b></li>`
      : `<li data-public-evidence-slot="${index + 1}"><i>${narrativeBeatMark(index)}</i><span>${index === 0 ? '先定事实' : index === 1 ? '再接经手' : '最后收口'}</span><b>等待证物</b></li>`;
  }).join('');
  const last = chain.selectedEvidence.at(-1);
  const result = chain.result;
  return `
    <div class="public-evidence-stage visual-stage ${result ? `result-${result.id}` : ''}" data-public-evidence-step="${chain.step}" style="--scene-bg:url('${urlFor('cg/group/public_day15')}')">
      <div class="decision-panel public-evidence-panel">
        ${phaseHeader(`第十五日 · 堂前举证 · ${narrativeStep(Math.min(chain.step + 1, chain.count), chain.count)}`, chain.title, introCopy.preview)}
        ${narrativeArchive(introCopy, 'public-evidence-long-brief', '三步成证的完整案情')}
        ${chain.publicOpening ? `<aside class="opening-public-echo day15-public-opening ${chain.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-day15-public-opening="${chain.publicOpening.choice}"><span>${chain.publicOpening.falseScapegoat ? '公审已经先押了一个答案' : '公审没有预填罪名'}</span><b>${escapeHtml(chain.publicOpening.label)}</b><p>${escapeHtml(chain.publicOpening.evidenceText)}</p></aside>` : ''}
        ${chain.openingEvidence ? `<aside class="opening-public-echo day15-opening-evidence" data-day15-opening-evidence="${chain.openingEvidence.sourceAction}"><span>白日行动已经递出第一证，不再重选</span><b>${escapeHtml(chain.openingEvidence.label)}</b><p>${escapeHtml(chain.openingEvidence.openingText)}</p><small>${escapeHtml(chain.openingEvidence.object)}</small></aside>` : ''}
        ${chain.draftEcho ? `<aside class="opening-public-echo" data-day15-evidence-draft="${chain.draftEcho.aftermath}"><span>银票只能证明自己的那一段</span><b>${escapeHtml(chain.draftEcho.label)}</b><p>${escapeHtml(chain.draftEcho.evidenceText)}</p></aside>` : ''}
        <div class="external-witnesses" aria-label="会反问证链的外部人物">${chain.witnesses.map((person) => `<article data-external-witness="${person.id}"><small>${escapeHtml(person.role)}</small><b>${escapeHtml(person.name)}</b><p>${escapeHtml(person.stance)}</p></article>`).join('')}</div>
        <ol class="evidence-chain-slots" aria-label="已经排出的证据次序">${slots}</ol>
        ${last && !result ? `<aside class="evidence-resistance"><span>这一手立刻遭到反问</span><p>${escapeHtml(last.resistance)}</p></aside>` : ''}
        ${result
          ? `<section class="evidence-verdict" data-evidence-result="${result.id}"><small>${escapeHtml(result.label)} · ${chain.score >= 5 ? '证链稳固' : chain.score >= 3 ? '证链可用' : '证链仍显吃力'}</small><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.body)}</p><button class="ink-button story-continue" data-public-evidence-complete="1">带证链进入主签</button></section>`
          : `<p class="public-evidence-rule">${chain.openingEvidence ? '第一证已由白日行动落案；现在只决定第二、三证怎样承接。' : chain.step ? '上一证已经落案；现在只决定下一证怎样承接。' : '次序不能撤回；第一证若只有口供或自家账，后两证会一直替它补理由。'}</p><div class="choice-grid public-evidence-choices">${E.publicEvidenceOptions(state).map((choice) => choiceButton(choice, 'public-evidence')).join('')}</div>`}
      </div>
    </div>`;
}

function renderPublicFollowup() {
  const event = E.currentPublicFollowup(state);
  const publicEvent = PUBLIC_EVENTS[state.day];
  if (!event || !publicEvent) return '<div class="fatal-card">这场公议的后半幕断了页。</div>';
  const scene = SCENES[publicEvent.scene];
  return `
    <div class="public-followup-stage visual-stage" data-public-followup="${event.id}" style="--scene-bg:url('${urlFor(scene.asset)}')">
      <div class="decision-panel public-followup-panel">
        ${phaseHeader(event.kicker, event.title, event.body)}
        ${event.mealMemory ? `<aside class="opening-public-echo" data-meal-memory="${event.mealMemory.heroine}"><span>这碗热汤的原始去处</span><b>${escapeHtml(event.mealMemory.short)} · ${escapeHtml(event.mealMemory.dish)}</b><p>${escapeHtml(event.mealMemory.trace)}</p></aside>` : ''}
        ${event.day5Opening ? `<aside class="opening-public-echo day5-public-opening" data-day5-followup-opening="${event.day5Opening.choice}"><span>${event.day5Opening.choice === 'public_5_favor' ? '已认偏宠正在限制第二裁决' : '逐手经办正在限制第二裁决'}</span><b>${escapeHtml(event.day5Opening.label)}</b><p>${escapeHtml(event.day5Opening.followupText)}</p></aside>` : ''}
        ${event.dayPreparation ? `<aside class="opening-public-echo public-day-preparation" data-public-followup-preparation="${event.dayPreparation.sourceDay}:${event.dayPreparation.sourceAction}"><span>白日原物正在限制第二裁决</span><b>${escapeHtml(event.dayPreparation.label)}</b><p>${escapeHtml(event.dayPreparation.text)}</p><small>${escapeHtml(event.dayPreparation.object)}</small></aside>` : ''}
        ${event.day10Opening ? `<aside class="opening-public-echo day10-public-opening" data-day10-followup-opening="${event.day10Opening.choice}"><span>莲池开场留下的原页状态</span><b>${escapeHtml(event.day10Opening.label)}</b><p>${escapeHtml(event.day10Opening.followupText)}</p></aside>` : ''}
        ${event.draftEcho ? `<aside class="opening-public-echo" data-day15-followup-draft="${event.draftEcho.aftermath}"><span>主签不能改写昨日银票</span><b>${escapeHtml(event.draftEcho.label)}</b><p>${escapeHtml(event.draftEcho.text)}</p></aside>` : ''}
        ${event.publicOpening ? `<aside class="opening-public-echo day15-public-opening ${event.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-day15-followup-public-opening="${event.publicOpening.choice}"><span>${event.publicOpening.falseScapegoat ? '错误预断尚未撤回' : '罪名栏仍保持空白'}</span><b>${escapeHtml(event.publicOpening.label)}</b><p>${escapeHtml(event.publicOpening.followupText)}</p></aside>` : ''}
        ${event.openingEvidence ? `<aside class="opening-public-echo day15-opening-evidence" data-day15-followup-opening="${event.openingEvidence.sourceAction}"><span>白日首证继续限制主签</span><b>${escapeHtml(event.openingEvidence.label)}</b><p>${escapeHtml(event.openingEvidence.followupText)}</p><small>${escapeHtml(event.openingEvidence.object)}</small></aside>` : ''}
        ${event.openingMemory ? `<aside class="opening-public-echo" data-opening-memory="${event.openingMemory.choice}"><span>第五日拿回第一笔选择</span><b>${escapeHtml(event.openingMemory.title)}</b><p>${escapeHtml(event.openingMemory.publicEcho)}</p></aside>` : ''}
        ${event.evidenceChain ? `<aside class="public-evidence-echo" data-public-evidence-echo="${event.evidenceChain.id}"><span>刚才排出的三步证链 · ${escapeHtml(event.evidenceChain.outcome.label)}</span><b>${event.evidenceChain.chain.map((id) => escapeHtml(PUBLIC_EVIDENCE_CHAIN.evidence.find((item) => item.id === id)?.label ?? id)).join(' → ')}</b><p>${escapeHtml(event.evidenceChain.outcome.echo)}</p></aside>` : ''}
        <div class="public-followup-cast" aria-label="仍留在现场的五个人">${event.participants.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${HEROINES[id].short}</figcaption></figure>`).join('')}</div>
        <p class="public-followup-note">前一拍解决了“当众说什么”，这一拍决定说完以后谁承担、谁被漏掉，以及五院是否仍愿意互相接证。</p>
        <div class="choice-grid">${E.publicFollowupOptions(state).map((choice) => choiceButton(choice, 'public-followup')).join('')}</div>
      </div>
    </div>`;
}

function renderPublicAftermath() {
  const story = E.currentPublicAftermath(state);
  const beat = story?.current;
  const publicEvent = PUBLIC_EVENTS[state.day];
  if (!story || !beat || !publicEvent) return '<div class="fatal-card">这场公议的后果没有接住。</div>';
  const scene = SCENES[publicEvent.scene];
  const last = story.beat === story.count - 1;
  return `
    <div class="public-aftermath-stage visual-stage public-day-${state.day} public-beat-${story.beat + 1}" data-public-aftermath="${story.choice}" data-public-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor(scene.asset)}')">
      <div class="public-aftermath-cast" aria-label="仍在承担这份公开决定的五个人">${story.participants.map((id) => `<figure class="${beat.speaker === id ? 'speaking' : 'listening'}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].name}</b></figcaption></figure>`).join('')}</div>
      <div class="decision-panel public-aftermath-panel">
        ${phaseHeader(`公开问责 · ${story.label} · ${narrativeStep(story.beat + 1, story.count)}`, beat.title, beat.body)}
        ${story.dayPreparation ? `<aside class="opening-public-echo public-day-preparation" data-public-aftermath-preparation="${story.dayPreparation.sourceDay}:${story.dayPreparation.sourceAction}:${story.beat + 1}"><span>白日原物仍限制这一拍</span><b>${escapeHtml(story.dayPreparation.label)}</b><p>${escapeHtml(story.dayPreparation.text)}</p><small>${escapeHtml(story.dayPreparation.object)}</small></aside>` : ''}
        ${story.day5Opening ? `<aside class="opening-public-echo day5-public-opening" data-day5-aftermath-opening="${story.day5Opening.choice}:${story.beat + 1}"><span>${story.day5Opening.choice === 'public_5_favor' ? '已认偏宠仍限制这一拍' : '逐手经办仍限制这一拍'}</span><b>${escapeHtml(story.day5Opening.label)}</b><p>${escapeHtml(story.day5Opening.text)}</p></aside>` : ''}
        ${story.day10Opening ? `<aside class="opening-public-echo day10-public-opening" data-day10-aftermath-opening="${story.day10Opening.choice}:${story.beat + 1}"><span>原页完整或缺失仍限制这一拍</span><b>${escapeHtml(story.day10Opening.label)}</b><p>${escapeHtml(story.day10Opening.text)}</p></aside>` : ''}
        ${story.publicOpening ? `<aside class="opening-public-echo day15-public-opening ${story.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-day15-aftermath-public-opening="${story.publicOpening.choice}:${story.beat + 1}"><span>${story.publicOpening.falseScapegoat ? '先押人的后果仍在这一拍' : '未预填罪名仍限制这一拍'}</span><b>${escapeHtml(story.publicOpening.label)}</b><p>${escapeHtml(story.publicOpening.text)}</p></aside>` : ''}
        ${story.openingEvidence ? `<aside class="opening-public-echo day15-opening-evidence" data-day15-aftermath-opening="${story.openingEvidence.sourceAction}:${story.beat + 1}"><span>第一证仍按真实次序留在这一拍</span><b>${escapeHtml(story.openingEvidence.label)}</b><p>${escapeHtml(story.openingEvidence.text)}</p><small>${escapeHtml(story.openingEvidence.object)}</small></aside>` : ''}
        <div class="public-aftermath-ledger"><span>${story.beat === 0 ? '公开决定已经落下' : story.beat === 1 ? '受影响的人开始追问' : '这份决定终于进入共同记录'}</span><b>${last ? '人名、证物、责任与撤回权都已写明；今晚以后，五院会按这份真实后果继续相处。' : '席面还没有散。下一拍会由另一院检查：这句话究竟保护了谁，又把代价留给了谁。'}</b></div>
        <button class="ink-button story-continue" data-public-aftermath-continue="1">${last ? '把这场公议完整记入总账' : story.beat === 0 ? '让受影响的人接着说' : '看五院最后怎样收这份决定'}</button>
      </div>
    </div>`;
}

function renderFivePrivatePrices() {
  const story = E.currentFivePrivatePrices(state);
  if (!story?.current) return '<div class="fatal-card">五封私价没有按前史接上。</div>';
  const protocol = story.protocol ? story.protocols.find((row) => row.id === story.protocol) : null;
  const offers = Object.values(story.offers);
  const jiaoerEcho = story.jiaoerEcho
    ? `<aside class="council-external-echo five-price-jiaoer-echo" data-jiaoer-aftermath="${story.jiaoerEcho.aftermath}"><span>第十八日娇儿交易仍在桌边</span><b>${escapeHtml(story.jiaoerEcho.label)}</b><p>${escapeHtml(story.jiaoerEcho.object)}</p></aside>`
    : '';
  const dayPreparation = story.dayPreparation
    ? `<aside class="council-external-echo five-price-day-preparation" data-day19-price-preparation="${story.dayPreparation.sourceAction}"><span>第十九日白日准备仍在这一屏</span><b>${escapeHtml(story.dayPreparation.label)}</b><p>${escapeHtml(story.dayPreparation.object)}</p></aside>`
    : '';
  let content = '';
  if (story.stage === 'overview') {
    content = `<section class="private-price-offers" aria-label="五封分别开给五个人的价">${offers.map((offer) => `<article data-private-offer="${offer.id}"><img src="${urlFor(HEROINES[offer.target].portrait)}" alt="${HEROINES[offer.target].name}"/><div><span>${HEROINES[offer.target].short} · ${escapeHtml(offer.actor === 'dai_an' ? '玳安' : offer.actor === 'han_daoguo' ? '韩道国' : '应伯爵')}</span><b>${escapeHtml(offer.title)}</b><p>${escapeHtml(offer.offer)}</p></div></article>`).join('')}</section><button class="ink-button story-continue" data-five-price-continue="1">让五个人各自取回写着名字的信</button>`;
  } else if (story.stage === 'protocol') {
    content = `<p class="private-price-rule">这里只分配答复权，不替任何人选择接受、反价、拒绝或公开。</p><div class="choice-grid">${E.fivePrivatePriceOptions(state).map((choice) => choiceButton(choice, 'five-price-protocol')).join('')}</div>`;
  } else if (story.stage === 'reply') {
    content = `<section class="private-price-reply" data-private-reply="${story.reply.heroine}:${story.reply.outcome}">
      <figure><img src="${urlFor(HEROINES[story.reply.heroine].close)}" alt="${HEROINES[story.reply.heroine].name}"/><figcaption>${HEROINES[story.reply.heroine].house}</figcaption></figure>
      <article><span>${escapeHtml(story.offer.title)}</span><blockquote>${escapeHtml(story.outcome.line)}</blockquote><p>${escapeHtml(story.outcome.body)}</p><dl><dt>她为何这样答</dt>${story.reply.reasons.map((reason) => `<dd>${escapeHtml(reason)}</dd>`).join('')}</dl><small>${escapeHtml(protocol?.label ?? '')}只决定寄法，没有改掉她的答案。</small></article>
    </section><button class="ink-button story-continue" data-five-price-continue="1">${story.beat < 6 ? '让下一封由本人作答' : '看外面怎样沿第十六日旧路反招'}</button>`;
  } else if (story.stage === 'right') {
    content = `<section class="private-price-counter"><span>第十六日旧路回手 · ${escapeHtml(story.counter.actor === 'dai_an' ? '玳安' : story.counter.actor === 'han_daoguo' ? '韩道国' : '应伯爵')}</span><p>${escapeHtml(story.counter.body)}</p></section><p class="private-price-rule">三项都是真权利，也都会让另外两项在明日更难保全。</p><div class="choice-grid">${E.fivePrivatePriceOptions(state).map((choice) => choiceButton(choice, 'five-price-right')).join('')}</div>`;
  } else {
    const memberSet = new Set(story.coalition.members);
    const continueLabel = story.coalition.kind === 'full' ? '带着五封互证进入第十九夜' : story.coalition.kind === 'limited' ? '带着候选与缺口进入第十九夜' : '带着权利底线进入第十九夜';
    content = `<section class="private-price-coalition" data-private-coalition="${story.coalition.kind}"><div>${HEROINE_IDS.map((id) => `<figure class="${memberSet.has(id) ? 'inside' : 'self-held'}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${memberSet.has(id) ? story.coalition.kind === 'limited' ? '候选互证' : '五院互证' : '本人自持'} · ${HEROINES[id].short}</figcaption></figure>`).join('')}</div><p>${story.coalition.kind === 'full' ? '五封答复互相可核，但正文仍各归本人。' : story.coalition.kind === 'limited' ? '候选间互证、非候选者自持；尚无人因一纸外账预签今夜同席。' : '只保权利底线，不伪造五院圆满。'}</p></section><button class="ink-button story-continue" data-five-price-continue="1">${continueLabel}</button>`;
  }
  return `<div class="five-private-prices-stage visual-stage stage-${story.stage}" data-five-price-stage="${story.stage}" data-five-price-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor('compound')}')"><div class="decision-panel five-private-prices-panel">${phaseHeader(`${story.kicker} · ${narrativeStep(story.beat + 1, story.count)}`, story.current.title, story.current.body)}${dayPreparation}${jiaoerEcho}${content}</div></div>`;
}

function renderFinalReckoning() {
  const event = E.currentFinalReckoning(state);
  if (!event) return '<div class="fatal-card">终局外账没有接上。</div>';
  const priceLedger = event.fivePrice?.statuses?.length
    ? `<section class="private-price-ledger" aria-label="第十九夜五封私价答复">${event.fivePrice.statuses.map((reply) => `<article data-price-reply="${reply.heroine}:${reply.outcome}"><img src="${urlFor(HEROINES[reply.heroine].portrait)}" alt=""/><span>${HEROINES[reply.heroine].short}</span><b>${escapeHtml(reply.label)}</b><small>${escapeHtml(reply.title)}</small></article>`).join('')}</section>`
    : '';
  return `
    <div class="final-reckoning-stage visual-stage" data-final-reckoning="${event.id}" style="--scene-bg:url('${urlFor('cg/group/public_day15')}')">
      <div class="reckoning-ledgers" aria-hidden="true"><i>银</i><i>名</i></div>
      <div class="decision-panel final-reckoning-panel">
        ${phaseHeader(event.kicker, event.title, '外柜两本总账已经摊开。先决定外账怎样结清，再进入黄昏。')}
        <aside class="council-external-echo final-reckoning-long-brief"><span>完整来路收入旧账</span><b>二十日外账怎样走到门槛</b><p>${escapeHtml(event.body)}</p></aside>
        ${priceLedger}
        ${event.dayPreparation ? `<aside class="council-external-echo final-day-preparation" data-day20-reckoning-preparation="${event.dayPreparation.sourceAction}"><span>第二十日白日准备仍在两本总账前</span><b>${escapeHtml(event.dayPreparation.label)}</b><p>${escapeHtml(event.dayPreparation.object)}</p></aside>` : ''}
        ${event.publicOpening ? `<aside class="council-external-echo day15-public-opening ${event.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-final-day15-opening="${event.publicOpening.choice}"><span>${event.publicOpening.falseScapegoat ? '终局不能用强证洗掉先押' : '终局仍不预填承担全案的人'}</span><b>${escapeHtml(event.publicOpening.label)}</b><p>${escapeHtml(event.evidenceEcho)}</p></aside>` : ''}
        ${event.openingMemory ? `<aside class="council-external-echo first-day-opening-memory" data-final-first-opening="${event.openingMemory.choice}"><span>第二十日正在回答第一日怎样起手</span><b>${escapeHtml(event.openingMemory.title)}</b><p>${escapeHtml(event.openingMemory.finalText)}</p></aside>` : ''}
        ${event.jiaoerEcho ? `<aside class="council-external-echo final-jiaoer-echo" data-final-jiaoer-aftermath="${event.jiaoerEcho.aftermath}"><span>第十八日娇儿交易仍约束两本总账</span><b>${escapeHtml(event.jiaoerEcho.label)}</b><p>${escapeHtml(event.jiaoerEcho.object)}</p></aside>` : ''}
        ${event.councilRule ? `<aside class="council-external-echo final-council-rule" data-final-council-rule="${event.councilRule.sourceChoice}"><span>第十七日追问规则仍在约束终局</span><b>${escapeHtml(event.councilRule.title)}</b><p>${escapeHtml(event.councilRule.permission)}</p></aside>` : ''}
        <div class="final-reckoning-cast">${event.participants.map((id) => `<figure><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption>${HEROINES[id].short}<small>${HEROINES[id].want}</small></figcaption></figure>`).join('')}</div>
        <p class="reckoning-note">先结清外账，黄昏后才轮到五院决定谁留下、怎样留下。这里选的是敌人以后还能拿什么追讨，不是替任何女人决定去留。</p>
        <div class="choice-grid">${E.finalReckoningOptions(state).map((choice) => choiceButton(choice, 'final-reckoning')).join('')}</div>
      </div>
    </div>`;
}

function renderFinalReckoningAftermath() {
  const story = E.currentFinalReckoningAftermath(state);
  const beat = story?.current;
  if (!story || !beat) return '<div class="fatal-card">终局外账的接管现场断了页。</div>';
  const beatCopy = narrativeExcerpt(beat.body);
  const resolved = Boolean(story.resolution);
  const options = story.awaitingChoice ? E.finalReckoningAftermathOptions(state) : [];
  return `
    <div class="final-aftermath-stage visual-stage final-approach-${story.approach}" data-final-aftermath="${story.approach}" data-final-beat="${story.beat + 1}" style="--scene-bg:url('${urlFor('cg/group/public_day15')}')">
      <div class="final-aftermath-ledgers" aria-hidden="true"><i>银</i><i>名</i><i>证</i></div>
      <div class="final-aftermath-cast" aria-label="正在接管终局外账的五个人">${story.participants.map((id) => `<figure class="${beat.speaker === id ? 'speaking' : 'listening'}"><img src="${urlFor(HEROINES[id].portrait)}" alt="${HEROINES[id].name}"/><figcaption><b>${HEROINES[id].name}</b></figcaption></figure>`).join('')}</div>
      <div class="decision-panel final-aftermath-panel">
        ${phaseHeader(`第二十日 · 外账接管 · ${narrativeStep(story.beat + 1, story.count)}`, beat.title, beatCopy.preview)}
        ${narrativeArchive(beatCopy, 'final-aftermath-long-brief', '这一拍的完整来路')}
        ${story.dayPreparation ? `<aside class="council-external-echo final-aftermath-day-preparation" data-final-day-preparation="${story.dayPreparation.sourceAction}"><span>白日留下的物件仍限制这一拍</span><b>${escapeHtml(story.dayPreparation.label)}</b><p>${escapeHtml(story.dayPreparation.object)}</p></aside>` : ''}
        ${story.jiaoerEcho ? `<aside class="council-external-echo final-aftermath-jiaoer-echo" data-final-aftermath-jiaoer="${story.jiaoerEcho.aftermath}"><span>第十八日留下的物件没有被总账吞掉</span><b>${escapeHtml(story.jiaoerEcho.label)}</b><p>${escapeHtml(story.jiaoerEcho.object)}</p></aside>` : ''}
        ${story.publicOpening ? `<aside class="council-external-echo day15-public-opening ${story.publicOpening.falseScapegoat ? 'is-contaminated' : ''}" data-final-aftermath-day15-opening="${story.publicOpening.choice}:${story.beat + 1}"><span>${story.publicOpening.falseScapegoat ? '撤押页与证物页仍然分栏' : '空白罪名栏仍然保留'}</span><b>${escapeHtml(story.publicOpening.label)}</b><p>${escapeHtml(story.publicOpening.text)}</p></aside>` : ''}
        ${story.openingMemory ? `<aside class="council-external-echo first-day-opening-memory" data-final-aftermath-first-opening="${story.openingMemory.choice}:${story.beat + 1}"><span>开局原则仍在这一拍兑现</span><b>${escapeHtml(story.openingMemory.title)}</b><p>${escapeHtml(story.openingMemory.text)}</p></aside>` : ''}
        <div class="final-custody-rule"><span>${story.beat === 0 ? '先执行你选定的大方向' : story.beat === 1 ? '外柜拿私话和单一主簿反扑' : story.beat === 2 ? '现在决定证据与保管权怎样落地' : '五个人已经把最后一项权力写清'}</span><b>${resolved ? '外账不再只是清掉一个数值。它已经明确谁能出证、谁能撤回、谁保管原件，以及任何共同查阅需要什么条件。' : story.awaitingChoice ? '两种办法都能成立，但保护隐私、共同查证与行动速度的代价不同；这一步会进入终局总账。' : '下一拍会有人用官面规则反咬这项决定，五院必须亲手守住各自的名字与证据。'}</b></div>
        ${story.awaitingChoice
          ? `<div class="choice-grid final-aftermath-choices">${options.map((choice) => choiceButton(choice, 'final-reckoning-aftermath')).join('')}</div>`
          : `<button class="ink-button story-continue" data-final-aftermath-continue="1">${resolved ? '带着这份外账进入最后黄昏' : story.beat === 0 ? '看外柜怎样反咬' : '让五个人提出最后两种办法'}</button>`}
      </div>
    </div>`;
}

function renderScene() {
  const scene = SCENES[state.pendingScene];
  const chapter = E.currentSceneChapter(state);
  if (!scene || !chapter) return '<div class="fatal-card">这段册页没有接上。</div>';
  ensureNarrativeAsset(scene.asset);
  const adult = ['prelude', 'explicit', 'ensemble-intimate'].includes(scene.tier);
  const ensemble = scene.tier === 'ensemble';
  const allianceOverview = chapter.allianceTableau && !chapter.allianceTableauBeat
    ? `<section class="alliance-tableau-overview" aria-label="有限同盟三次回答怎样形成真实成员群像"><header><b>${escapeHtml(chapter.allianceTableau.title)}</b><span>真实成员本人落席 · 每一问都已执行</span></header><p>${escapeHtml(chapter.allianceTableau.lead)}</p><div class="alliance-tableau-members">${chapter.allianceTableau.members.map((heroine) => `<figure data-alliance-tableau-member="${heroine}"><img src="${urlFor(HEROINES[heroine].portrait)}" alt="${HEROINES[heroine].name}"/><figcaption><b>${escapeHtml(HEROINES[heroine].short)}</b><span>${escapeHtml(HEROINES[heroine].house)}</span></figcaption></figure>`).join('')}</div><div class="alliance-tableau-path">${chapter.allianceTableau.beats.map((beat) => `<span data-alliance-tableau-overview="${beat.choice}"><small>${escapeHtml(beat.beatTitle)}</small><b>${escapeHtml(beat.choiceLabel)}</b><em>${escapeHtml(beat.title)}</em></span>`).join('')}</div><aside class="alliance-tableau-nonmembers"><b>没有被补画进成员席的人</b>${chapter.allianceTableau.nonmembers.map((row) => `<p data-alliance-tableau-nonmember="${row.heroine}:${row.kind}"><strong>${escapeHtml(HEROINES[row.heroine].short)} · ${escapeHtml(row.label)}</strong><span>${escapeHtml(row.text)}</span></p>`).join('')}</aside></section>`
    : '';
  const allianceEntry = chapter.allianceTableauBeat
    ? `<section class="alliance-tableau-entry" data-alliance-tableau-entry="${chapter.allianceTableauBeat.choice}" aria-label="${escapeHtml(chapter.allianceTableauBeat.choiceLabel)}怎样被真实成员实际执行"><header><span>${escapeHtml(chapter.allianceTableauBeat.beatTitle)}</span><b>${escapeHtml(chapter.allianceTableauBeat.title)}</b></header><p>${escapeHtml(chapter.allianceTableauBeat.body)}</p><div class="alliance-tableau-actions">${chapter.allianceTableau.members.map((heroine) => `<article data-alliance-tableau-action="${chapter.allianceTableauBeat.choice}:${heroine}"><img src="${urlFor(HEROINES[heroine].portrait)}" alt=""/><div><b>${escapeHtml(HEROINES[heroine].short)}</b><p>${escapeHtml(chapter.allianceTableauBeat.actions[heroine])}</p></div></article>`).join('')}</div><blockquote>${escapeHtml(chapter.allianceTableauBeat.transition)}</blockquote></section>`
    : '';
  const accordOverview = chapter.sharedAccord?.length && !chapter.accordEntry
    ? `<section class="shared-night-accord-overview" aria-label="五院同灯成立前的五份本人契据"><header><b>同灯为何能成立</b><span>第19日本人答复 → 第20日真实保护 → 今夜各自落印</span></header><div>${chapter.sharedAccord.map((entry) => `<span data-shared-night-accord-overview="${entry.heroine}"><b>${escapeHtml(HEROINES[entry.heroine].short)}</b><em>${escapeHtml(entry.day19.outcomeLabel)}</em><small>${escapeHtml(entry.day20.protectionLabel)}</small></span>`).join('')}</div></section>`
    : '';
  const accordEntry = chapter.accordEntry
    ? `<section class="shared-night-accord-entry" data-shared-night-accord="${chapter.accordEntry.heroine}" aria-label="${escapeHtml(HEROINES[chapter.accordEntry.heroine].name)}为何能亲自进入五院同灯"><header><b>同灯为何能成立 · ${escapeHtml(HEROINES[chapter.accordEntry.heroine].name)}</b><span>${escapeHtml(chapter.accordEntry.day20.protectionLabel)}</span></header><div class="shared-night-accord-ledger"><article><small>第19日 · 本人答复</small><b>${escapeHtml(chapter.accordEntry.day19.offerTitle)} · ${escapeHtml(chapter.accordEntry.day19.outcomeLabel)}</b><blockquote>${escapeHtml(chapter.accordEntry.day19.responseLine)}</blockquote><p>${escapeHtml(chapter.accordEntry.day19.result)}</p></article><article><small>第20日 · 两步执行</small><b>${escapeHtml(chapter.accordEntry.day20.choiceLabel)} → ${escapeHtml(chapter.accordEntry.day20.aftermathLabel)}</b><p>${escapeHtml(chapter.accordEntry.day20.protectionText)}</p></article><article><small>本人旧约与具名实绩</small><b>${escapeHtml(chapter.accordEntry.accord.label)} · ${escapeHtml(chapter.accordEntry.proof.label)}</b><p>${escapeHtml(chapter.accordEntry.accord.text)}</p></article></div><p class="shared-night-accord-conclusion">${escapeHtml(chapter.accordEntry.conclusion)}</p></section>`
    : '';
  const tableauOverview = chapter.sharedAfterglowTableau && !chapter.tableauBeat
    ? `<section class="shared-afterglow-tableau-overview" aria-label="三拍余夜怎样共同形成这一幅成人群像"><header><b>三拍怎样走进这一幅</b><span>${escapeHtml(chapter.sharedAfterglowTableau.title)}</span></header><div>${chapter.sharedAfterglowTableau.beats.map((beat) => `<span data-shared-afterglow-tableau-overview="${beat.choice}"><small>${escapeHtml(beat.beatTitle)}</small><b>${escapeHtml(beat.choiceLabel)}</b><em>${escapeHtml(beat.title)}</em></span>`).join('')}</div></section>`
    : '';
  const tableauEntry = chapter.tableauBeat
    ? `<section class="shared-afterglow-tableau-entry" data-shared-afterglow-tableau-entry="${chapter.tableauBeat.choice}" aria-label="${escapeHtml(chapter.tableauBeat.choiceLabel)}怎样改变五人成人群像"><header><span>${escapeHtml(chapter.tableauBeat.beatTitle)}</span><b>${escapeHtml(chapter.tableauBeat.title)}</b></header><p>${escapeHtml(chapter.tableauBeat.body)}</p><div class="shared-afterglow-tableau-actions">${HEROINE_IDS.map((heroine) => `<article data-shared-afterglow-tableau-action="${chapter.tableauBeat.choice}:${heroine}"><b>${escapeHtml(HEROINES[heroine].short)}</b><p>${escapeHtml(chapter.tableauBeat.actions[heroine])}</p></article>`).join('')}</div><blockquote>${escapeHtml(chapter.tableauBeat.transition)}</blockquote></section>`
    : '';
  return `
    <article class="scene-view" id="scene-view" data-scene-id="${scene.id}" data-scene-tier="${scene.tier}" data-scene-beat="${chapter.index}">
      <img id="scene-image" src="${urlFor(scene.asset)}" alt="${scene.title}"/>
      <div class="scene-scrim"></div>
      <div class="scene-caption">
        <p class="eyebrow">${scene.tier === 'alliance' ? '有限同盟 · 真实成员本人落席' : scene.tier === 'ensemble-intimate' ? '18+ · 五个人都独立点了头' : adult ? '18+ · 她点了头' : ensemble ? '五院共约 · 五个人都在' : '公开席面 · 满桌人都在'}${chapter.count > 1 ? ` · 册页${narrativeStep(chapter.index + 1, chapter.count)}` : ''}</p>
        <h2>${escapeHtml(chapter.allianceTableau?.title ?? scene.title)}</h2>
        ${chapter.kicker ? `<p class="scene-chapter-kicker">${escapeHtml(chapter.kicker)}</p>` : ''}
        ${chapter.allianceTableau || chapter.accordEntry || chapter.tableauBeat ? '' : `<p>${escapeHtml(chapter.text)}</p>`}
        ${allianceOverview}
        ${allianceEntry}
        ${accordOverview}
        ${accordEntry}
        ${tableauOverview}
        ${tableauEntry}
        <div class="scene-meta"><span>这一页留下了</span><span>${chapter.allianceTableau ? chapter.allianceTableau.members.map((id) => HEROINES[id].name).join('、') : scene.participants.length ? scene.participants.map((id) => HEROINES[id].name).join('、') : '中秋同席'}</span></div>
        <button class="ink-button story-continue" id="btn-scene-close">${escapeHtml(chapter.button)}</button>
      </div>
    </article>`;
}

function renderPersonalAfterglow() {
  const event = E.currentPersonalAfterglow(state);
  if (!event) return '<div class="fatal-card">这段余夜没有接上。</div>';
  const heroine = HEROINES[event.heroine];
  const scene = SCENES[event.scene];
  ensureNarrativeAsset(scene.asset);
  return `
    <div class="personal-afterglow-stage visual-stage dialogue-${event.heroine}" data-personal-afterglow="${event.event}" style="--scene-bg:url('${urlFor(heroine.close)}')">
      <div class="afterglow-close" style="background-image:url('${urlFor(heroine.close)}')" role="img" aria-label="${heroine.name}在余夜里的近景"></div>
      <figure class="afterglow-memory"><img src="${urlFor(scene.asset)}" alt="${scene.title}"/><figcaption>${event.tier === 'explicit' ? '刚才那一夜' : '刚才那一步'} · ${scene.title}</figcaption></figure>
      <div class="decision-panel personal-afterglow-panel">
        ${phaseHeader(`${event.kicker} · ${event.tier === 'explicit' ? '留宿余夜' : '帘前余夜'}`, event.title, event.body)}
        <p class="afterglow-lead">靠近已经发生。现在这句话会决定：她明早记住的是被索取、被理解，还是终于能按自己的方式留下。</p>
        <div class="choice-stack">${E.personalAfterglowOptions(state).map((choice) => choiceButton(choice, 'personal-afterglow')).join('')}</div>
      </div>
    </div>`;
}

function renderPersonalAfterglowAftermath() {
  const story = E.currentPersonalAfterglowAftermath(state);
  if (!story) return '<div class="fatal-card">这段余夜后章没有接上。</div>';
  const heroine = HEROINES[story.heroine];
  const scene = SCENES[story.scene];
  ensureNarrativeAsset(scene.asset);
  const action = story.awaitingChoice
    ? `<p class="afterglow-aftermath-question">亲近已经发生；现在才决定，它明日会成为旧凭据、共同制度，还是她仍可改口的一次选择。</p><div class="personal-afterglow-aftermath-choices">${E.personalAfterglowAftermathOptions(state).map((choice) => choiceButton(choice, 'personal-afterglow-aftermath')).join('')}</div>`
    : `<button class="ink-button story-continue personal-afterglow-aftermath-continue" data-personal-afterglow-aftermath-continue="1">${story.resolved ? '让这项安排带到天亮' : '听她把最后一问说完'}</button>`;
  return `
    <div class="personal-afterglow-aftermath-stage visual-stage dialogue-${story.heroine} ${story.resolved ? 'is-resolved' : ''}" data-personal-afterglow-aftermath="${story.event}" data-story-step="${story.step}">
      <div class="personal-afterglow-aftermath-close" style="background-image:url('${urlFor(heroine.close)}')" role="img" aria-label="${heroine.name}在亲近之后继续和你谈天亮后的安排"></div>
      <figure class="personal-afterglow-aftermath-memory"><img src="${urlFor(scene.asset)}" alt="${scene.title}"/><figcaption><span>刚才靠近</span><b>${escapeHtml(scene.title)}</b></figcaption></figure>
      <div class="decision-panel personal-afterglow-aftermath-panel">
        ${phaseHeader(`${story.kicker} · ${story.tier === 'explicit' ? '留宿后章' : '前奏后章'} · ${narrativeStep(story.step + 1, story.count)}`, story.current.title, story.current.body)}
        <div class="personal-afterglow-aftermath-ledger">
          <span><small>第一次回答</small><b>${escapeHtml(story.approachChoice.label)}</b><em>${escapeHtml(story.approachChoice.hint)}</em></span>
          <span class="${story.awaitingChoice ? 'current' : story.resolved ? 'settled' : ''}"><small>${story.resolved ? '带到明日' : '现在要决定'}</small><b>${story.resolved ? escapeHtml(story.choice.label) : story.awaitingChoice ? '她要一项能实行的安排' : '这段话还没有说完'}</b><em>${story.resolved ? escapeHtml(story.choice.hint) : '不是再点一次好感，而是决定以后怎样相处'}</em></span>
        </div>
        ${action}
      </div>
    </div>`;
}

function renderEnding() {
  const end = state.ending;
  const top = HEROINE_IDS.slice().sort((a, b) => state.relations[b].qing - state.relations[a].qing)[0];
  const relationshipSummary = end.id === 'balanced'
    ? '<span>五院关系 <b>都还在桌上</b></span>'
    : end.id === 'alliance'
      ? `<span>同盟院门 <b>${escapeHtml(end.allianceName)}</b></span>`
    : `<span>最深关系 <b>${HEROINES[top].name} · ${E.relationTier(state.relations[top].qing, 'qing')}</b></span>`;
  const nightPatterns = end.nightPatterns ?? [];
  const collapseMemoryLedger = end.collapseResult?.memories?.length
    ? `<section class="personal-departure-reasons ending-collapse-memories" aria-label="破局清算中五个人各自追讨的真实旧事"><header><b>散局没有抹掉的五件旧事</b><span>${escapeHtml(end.collapseResult.label)} · 各归本人</span></header><ol>${end.collapseResult.memories.map((memory) => `<li data-ending-collapse-memory="${memory.choice}:${memory.heroine}"><b>${escapeHtml(HEROINES[memory.heroine].short)} · ${escapeHtml(memory.label)}</b><p>${escapeHtml(memory.text)}</p><em>${escapeHtml(memory.conclusion)}</em></li>`).join('')}</ol></section>`
    : '';
  const allianceMemoryLedger = end.allianceMemberMemories?.length
    ? `<section class="personal-departure-reasons ending-alliance-memories" aria-label="有限同盟真实成员各自落定的三拍"><header><b>同盟不是一个风格名</b><span>三拍都由真实成员逐项接住</span></header><ol>${end.allianceMemberMemories.map((memory) => `<li data-ending-alliance-memory="${memory.heroine}"><b>${escapeHtml(HEROINES[memory.heroine].short)}</b><ol>${memory.choices.map((choice) => `<li><strong>${escapeHtml(choice.choiceLabel)}</strong><p>${escapeHtml(choice.response)}</p></li>`).join('')}</ol></li>`).join('')}</ol></section>`
    : '';
  const allianceTableauLedger = end.allianceTableau
    ? `<section class="personal-departure-reasons ending-alliance-tableau" aria-label="有限同盟三问形成的最终共同生活群像"><header><b>${escapeHtml(end.allianceTableau.title)}</b><span>真实成员逐院落席 · 结构由她们亲手形成</span></header><ol>${end.allianceTableau.beats.map((beat) => `<li data-ending-alliance-tableau="${beat.choice}"><strong>${escapeHtml(beat.choiceLabel)} · ${escapeHtml(beat.title)}</strong><p>${escapeHtml(beat.body)}</p></li>`).join('')}</ol></section>`
    : '';
  const sharedNightAccordLedger = end.sharedNightAccord?.length
    ? `<section class="personal-departure-reasons ending-shared-night-accord" aria-label="五院同灯成立前五个人各自留下的两日契据"><header><b>同灯为何能成立</b><span>不是五个人被一项结局条件自动收编</span></header><ol>${end.sharedNightAccord.map((entry) => `<li data-ending-shared-night-accord="${entry.heroine}"><b>${escapeHtml(HEROINES[entry.heroine].short)} · ${escapeHtml(entry.day19.outcomeLabel)}</b><p>${escapeHtml(entry.day19.responseLine)}</p><em>${escapeHtml(entry.day20.choiceLabel)} → ${escapeHtml(entry.day20.aftermathLabel)} · ${escapeHtml(entry.day20.protectionLabel)}</em></li>`).join('')}</ol></section>`
    : '';
  const sharedFinaleMemoryLedger = end.sharedFinaleMemories?.length
    ? `<section class="personal-departure-reasons ending-shared-finale-memories" aria-label="五院共守四拍由五个人分别留下的真实记忆"><header><b>共守不是一句同灯</b><span>三拍余夜与一拍次晨均逐人落字</span></header><ol>${end.sharedFinaleMemories.map((memory) => `<li data-ending-shared-finale-memory="${memory.heroine}"><b>${escapeHtml(HEROINES[memory.heroine].short)}</b><ol>${[...memory.afterglow, memory.dawn].map((choice) => `<li><strong>${escapeHtml(choice.choiceLabel)}</strong><p>${escapeHtml(choice.response)}</p></li>`).join('')}</ol></li>`).join('')}</ol></section>`
    : '';
  // 结局图跟着结局走:专一给该女主的立绘近景,五院同灯用真正协作的群像,
  // 权谋与不稳退回夜色宅院,由 CSS 按 data-ending 分别调色。
  const allianceArt = end.id === 'alliance' && end.alliance?.length === 2
    ? JOINT_ACTIONS.find((choice) => choice.participants.every((id) => end.alliance.includes(id)))?.asset
    : null;
  const artUrl = end.id === 'exclusive' && end.finaleAsset
    ? urlFor(end.finaleAsset)
    : allianceArt
      ? urlFor(allianceArt)
    : end.id === 'balanced'
      ? urlFor('cg/group/inner_court_accord')
      : urlFor('compound');
  return `
    <article class="ending-view" id="ending-view" data-ending="${end.id}">
      <div class="ending-art" style="background-image:linear-gradient(90deg,rgba(16,12,10,.9),rgba(16,12,10,.25)),url('${artUrl}')"></div>
      <div class="ending-copy">
        <p class="eyebrow">第 20 日 · 风月总账</p>
        <h1 tabindex="-1">${end.title}</h1>
        <p class="ending-tag">${end.tag}${end.heroineName ? ` · ${end.heroineName}` : ''}${end.reckoningResult ? ` · ${end.reckoningResult}` : ''}${end.routeResult ? ` · ${end.routeResult}` : ''}</p>
        <p>${end.text}</p>
        <div class="ending-ledger">
          ${relationshipSummary}
          <span>结局总账 <b>${loadEndingArchive().length ? '已有旧卷' : '首卷落定'}</b></span>
          <span>场景册 <b>${loadGallery().length ? '已有册页' : '尚未开册'}</b></span>
          <span>秘密去向 <b>${state.secretsUsed.length ? '曾经动用' : '未曾动用'}</b></span>
          <span>未开题签 <b>${end.unseen.length ? '仍有旧页待翻' : '已经翻全'}</b></span>
        </div>
        ${nightPatterns.length ? `<section class="ending-habits" aria-label="五院夜谈形成的相处习惯"><header><b>夜谈留下的相处习惯</b><span>不是好感档位，而是以后怎样过</span></header><div>${nightPatterns.map((pattern) => `<article class="${pattern.mode ? '' : 'unformed'}" data-ending-pattern="${pattern.id || `forming-${pattern.heroine}`}"><span>${HEROINES[pattern.heroine].short} · ${narrativeProgress(pattern.chapters, 4, ['刚刚起话', '仍在磨合', '已成相处条款'])}</span><b>${escapeHtml(pattern.label)}</b><small>${escapeHtml(pattern.summary)}</small></article>`).join('')}</div></section>` : ''}
        ${sharedNightAccordLedger}
        ${sharedFinaleMemoryLedger}
        ${allianceTableauLedger}
        ${allianceMemoryLedger}
        ${collapseMemoryLedger}
        <div class="household-ending">${end.householdResults.map((item) => `<span><b>${item.name} · ${escapeHtml(item.result)}</b><small>${escapeHtml(item.detail)}</small></span>`).join('')}</div>
        <p class="ending-note">这一种共处方式已经记进结局总账，却还没有走到原著命数的尽头。可先读一个月后的五院生活，再翻开第 30—100 回不会被好感改写的三页余账。</p>
        <div class="button-row"><button class="ink-button story-continue" id="btn-fate-coda">翻命数三页</button><button class="ink-button" id="btn-epilogue">读五封一月笺</button><button class="ink-button" id="btn-restart">换一套暗线</button><button class="ink-button" id="btn-replay-seed">重走同一局</button><button class="ink-button" id="btn-gallery">看结局总账</button></div>
      </div>
    </article>`;
}

function epiloguePages() {
  if (archivedEpilogueKey) {
    const entry = loadEndingArchive().find((row) => row.key === archivedEpilogueKey);
    const pages = entry?.afterstory?.pages;
    return Array.isArray(pages) ? pages : [];
  }
  const ending = state?.ending;
  const heroinePages = (ending?.epilogues ?? []).map((page) => ({
    ...page,
    kicker: `${HEROINES[page.heroine].house} · 一个月后`,
    name: HEROINES[page.heroine].name,
    asset: HEROINES[page.heroine].close,
  }));
  if (!ending) return heroinePages;
  return [...heroinePages, {
    heroine: null,
    kicker: '末页 · 一个月后',
    name: '宅门仍在运转',
    title: ending.title,
    body: ending.text,
    routeNote: `外账结法：${ending.reckoningResult || '尚未真正结清'}。关系结法：${ending.routeResult || ending.tag}。这不是“从此无事”，而是她们愿意怎样继续处理下一次偏爱、欠账与争执。`,
    relation: null,
    asset: ending.id === 'balanced' ? 'cg/group/inner_court_accord' : 'compound',
  }];
}

function appendEpilogue() {
  const pages = epiloguePages();
  if (!pages.length) return;
  epilogueIndex = Math.max(0, Math.min(epilogueIndex, pages.length - 1));
  const page = pages[epilogueIndex];
  const relation = page.relation
    ? `<div class="epilogue-relations"><span>情 <b>${escapeHtml(page.relation.qing)}</b></span><span>欲 <b>${escapeHtml(page.relation.yu)}</b></span><span>妒 <b>${escapeHtml(page.relation.du)}</b></span></div>`
    : '';
  const habit = page.habit?.mode
    ? `<section class="epilogue-habit" data-epilogue-pattern="${page.habit.id}"><span>${page.habit.settled ? '夜谈形成的关系条款' : '夜谈正在形成的关系条款'} · ${narrativeProgress(page.habit.chapters, 4, ['刚刚起话', '仍在磨合', '已经落定'])}</span><b>${escapeHtml(page.habit.label)}</b><p>${escapeHtml(page.habit.summary)}</p></section>`
    : '';
  const personalDepartureOutcome = page.personalDeparture
    ? ({ accept:'接下程序', amend:'亲手改约', refuse:'自行收回' })[page.personalDeparture.outcome]
    : '';
  const personalDepartureLedger = page.personalDeparture
    ? `<section class="epilogue-night-conversations epilogue-personal-departure" aria-label="个人终章中由她本人落定的善后"><header><span>专情没有让四院排队成全</span><b>${escapeHtml(personalDepartureOutcome)} · ${escapeHtml(page.personalDeparture.response.title)}</b></header><ol><li data-epilogue-personal-departure="${page.personalDeparture.procedure.id}:${page.personalDeparture.outcome}"><small>真实程序 · ${escapeHtml(page.personalDeparture.procedure.label)}</small><b>${escapeHtml(page.personalDeparture.procedure.focus)}</b><span class="stake">怎样执行 · ${escapeHtml(page.personalDeparture.procedure.summary)}</span><p>${escapeHtml(page.personalDeparture.response.line)}</p><em>当时逐项核验</em><ol>${page.personalDeparture.reasons.map((reason, index) => `<li data-epilogue-personal-departure-reason="${index + 1}">${escapeHtml(reason)}</li>`).join('')}</ol></li></ol></section>`
    : '';
  const collapseMemoryLedger = page.collapseMemory
    ? `<section class="epilogue-night-conversations epilogue-collapse-memory" aria-label="破局清算中由她本人追到今夜的旧事"><header><span>散局没有替她销掉这件旧事</span><b>${escapeHtml(page.collapseMemory.choiceLabel)} · ${escapeHtml(page.collapseMemory.label)}</b></header><ol><li data-epilogue-collapse-memory="${page.collapseMemory.choice}:${page.collapseMemory.heroine}"><small>${page.collapseMemory.day ? `第 ${page.collapseMemory.day} 日 · ` : ''}${escapeHtml(page.collapseMemory.kind)}</small><b>${escapeHtml(page.collapseMemory.label)}</b><p>${escapeHtml(page.collapseMemory.text)}</p><em>${escapeHtml(page.collapseMemory.conclusion)}</em></li></ol></section>`
    : '';
  const allianceMemoryLedger = page.allianceMemory
    ? `<section class="epilogue-night-conversations epilogue-alliance-memory" aria-label="有限同盟中由她本人接住并实际执行的三拍"><header><span>入盟不只剩一个相处风格</span><b>${escapeHtml(HEROINES[page.allianceMemory.heroine].short)} · 三拍均由本人落定</b></header><ol>${page.allianceMemory.choices.map((choice) => `<li data-epilogue-alliance-memory="${page.allianceMemory.heroine}:${choice.choice}"><small>${escapeHtml(choice.beatTitle)}</small><b>${escapeHtml(choice.choiceLabel)}</b><p>${escapeHtml(choice.response)}</p><span class="stake">群像中的实际动作 · ${escapeHtml(choice.tableauAction)}</span><em>当时逐项依据</em><ol>${choice.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></li>`).join('')}</ol></section>`
    : '';
  const sharedNightAccordLedger = page.sharedNightAccord
    ? `<section class="epilogue-night-conversations epilogue-shared-night-accord" aria-label="五院同灯成立前由她本人留下的两日契据"><header><span>同灯先经过她本人的两日答复</span><b>${escapeHtml(HEROINES[page.sharedNightAccord.heroine].short)} · ${escapeHtml(page.sharedNightAccord.day20.protectionLabel)}</b></header><ol><li data-epilogue-shared-night-accord="${page.sharedNightAccord.heroine}"><small>第19日 · ${escapeHtml(page.sharedNightAccord.day19.offerTitle)}</small><b>${escapeHtml(page.sharedNightAccord.day19.outcomeLabel)}</b><p>${escapeHtml(page.sharedNightAccord.day19.responseLine)} ${escapeHtml(page.sharedNightAccord.day19.result)}</p><em>第20日真实执行 · ${escapeHtml(page.sharedNightAccord.day20.choiceLabel)} → ${escapeHtml(page.sharedNightAccord.day20.aftermathLabel)}</em><span class="stake">${escapeHtml(page.sharedNightAccord.day20.protectionText)}</span><p>${escapeHtml(page.sharedNightAccord.conclusion)}</p></li></ol></section>`
    : '';
  const sharedFinaleMemoryLedger = page.sharedFinaleMemory
    ? `<section class="epilogue-night-conversations epilogue-shared-finale-memory" aria-label="五院共守中由她本人接住的四拍"><header><span>同灯没有合并她的前史</span><b>${escapeHtml(HEROINES[page.sharedFinaleMemory.heroine].short)} · 四拍均由本人落定</b></header><ol>${[...page.sharedFinaleMemory.afterglow, page.sharedFinaleMemory.dawn].map((choice) => `<li data-epilogue-shared-finale-memory="${page.sharedFinaleMemory.heroine}:${choice.choice}"><small>${escapeHtml(choice.beatTitle ?? '次晨见光')}</small><b>${escapeHtml(choice.choiceLabel)}</b><p>${escapeHtml(choice.response)}</p><em>当时逐项依据</em><ol>${choice.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ol></li>`).join('')}</ol></section>`
    : '';
  const intimacyArrangementLedger = page.arrangements?.length
    ? `<section class="epilogue-night-conversations epilogue-intimacy-arrangements" aria-label="亲密之后仍在执行的具名约定"><header><span>亲密没有替天亮后的生活作答</span><b>${page.arrangements.length > 1 ? '旧约都仍有效' : '这项旧约仍有效'}</b></header><ol>${page.arrangements.map((arrangement) => `<li data-epilogue-intimacy-arrangement="${arrangement.id}"><small>第 ${arrangement.day} 夜 · ${arrangement.tier === 'explicit' ? '留宿后约' : '前奏后约'}</small><b>${escapeHtml(arrangement.label)} · ${escapeHtml(arrangement.title)}</b><p>${escapeHtml(arrangement.outcome)}</p><em>次晨：${escapeHtml(arrangement.morning)} 此后：${escapeHtml(arrangement.future)}</em></li>`).join('')}</ol></section>`
    : '';
  const nightConversationLedger = page.nightConversations?.length
    ? `<section class="epilogue-night-conversations" aria-label="专属夜谈留下的长期生活事实"><header><span>说过的话怎样继续生活</span><b>夜谈已经落到一月后</b></header><ol>${page.nightConversations.map((memory) => `<li data-epilogue-night-conversation="${memory.event}:${memory.mode}"><small>${narrativeProgress(memory.chapter, 4, ['刚刚起话', '已经接续', '已成相处条款'])} · ${escapeHtml(memory.prop)} · ${escapeHtml(memory.modeLabel)}</small><b>${escapeHtml(memory.choiceLabel)}</b><span class="stake">实际执行 · ${escapeHtml(memory.stakeLabel)} · ${escapeHtml(narrativeChoiceMeta(memory.stakeResourceText))}</span><p>${escapeHtml(memory.future)}</p><em>${escapeHtml(memory.observerName)}怎样接住：${escapeHtml(memory.observerLine)}</em></li>`).join('')}</ol></section>`
    : '';
  const ordinaryNightLedger = page.ordinaryNights?.length
    ? `<section class="epilogue-night-conversations epilogue-ordinary-nights" aria-label="普通夜章留下的长期生活事实"><header><span>停下或把茶喝完以后</span><b>这些夜章仍在生活里</b></header><ol>${page.ordinaryNights.map((memory) => `<li data-epilogue-ordinary-night="${memory.event}"><small>${memory.count > 1 ? `第 ${memory.firstDay}—${memory.day} 夜 · 反复发生` : `第 ${memory.day} 夜`} · ${escapeHtml(memory.actionLabel)}</small><b>${escapeHtml(memory.title)}</b><p>${escapeHtml(memory.closing)}</p><em>次晨真正发生：${escapeHtml(memory.morning)}</em></li>`).join('')}</ol></section>`
    : '';
  const pairMemoryLedger = page.pairMemories?.length
    ? `<section class="epilogue-night-conversations epilogue-pair-memories" aria-label="双院私议留下的横向关系事实"><header><span>她与旁院怎样继续相处</span><b>横向关系已经落字</b></header><ol>${page.pairMemories.map((memory) => `<li data-epilogue-pair-memory="${memory.event}:${memory.choice}"><small>第 ${memory.day} 日 · 与${escapeHtml(memory.partnerName)} · ${escapeHtml(memory.label)}</small><b>${escapeHtml(memory.title)}</b><p>${escapeHtml(memory.memory)}</p><em>${escapeHtml(memory.witnessName)}见证这项关系怎样外溢。</em></li>`).join('')}</ol></section>`
    : '';
  const invitationMemoryLedger = page.invitationMemory
    ? `<section class="epilogue-night-conversations epilogue-invitation-memory" aria-label="她主动提出的邀约留下的长期安排"><header><span>不是被挑中，而是她主动来请</span><b>第 ${page.invitationMemory.day} 日 · ${escapeHtml(page.invitationMemory.approachLabel)}</b></header><ol><li data-epilogue-invitation-memory="${page.invitationMemory.event}:${page.invitationMemory.approach}:${page.invitationMemory.choice}"><small>${escapeHtml(page.invitationMemory.invitationTitle)} · ${escapeHtml(page.invitationMemory.witnessName)}见证</small><b>${escapeHtml(page.invitationMemory.title)} · ${escapeHtml(page.invitationMemory.choiceLabel)}</b><span class="stake">她亲口提出 · ${escapeHtml(page.invitationMemory.heroineLine)}</span><p>${escapeHtml(page.invitationMemory.outcome)}</p><em>${escapeHtml(page.invitationMemory.witnessName)}当日这样追问：${escapeHtml(page.invitationMemory.witnessQuestion)}</em></li></ol></section>`
    : '';
  const rivalryMemoryLedger = page.rivalryMemories?.length
    ? `<section class="epilogue-night-conversations epilogue-rivalry-memories" aria-label="偏宠对峙留下的双方关系史"><header><span>偏宠曾经怎样被当面追问</span><b>这些裁决没有被妒意终值覆盖</b></header><ol>${page.rivalryMemories.map((memory) => `<li data-epilogue-rivalry-memory="${memory.day}:${memory.actor}:${memory.visited}:${memory.choice}"><small>第 ${memory.day} 日 · ${memory.role === 'challenger' ? '她发难' : '她是昨夜被选择的一院'} · 与${escapeHtml(memory.otherName)}</small><b>${escapeHtml(memory.title)} · ${escapeHtml(memory.choiceLabel)}</b><span class="stake">她当面说 · ${escapeHtml(memory.role === 'challenger' ? memory.opening : memory.visitedReply)}</span><p>${escapeHtml(memory.outcome)}</p></li>`).join('')}</ol></section>`
    : '';
  const routeReckoningLedger = page.routeReckonings?.length
    ? `<section class="epilogue-night-conversations epilogue-route-reckoning" aria-label="两日后旧话裁决留下的长期结果"><header><span>旧话裁决怎样继续生活</span><b>原物账已经落定</b></header><ol>${page.routeReckonings.map((memory) => `<li data-epilogue-route-reckoning="${memory.event}:${memory.sourceDay}:${memory.choice}"><small>第 ${memory.sourceDay} 日原物 · 第 ${memory.day} 日落定 · ${escapeHtml(memory.promiseLabel)} · ${escapeHtml(memory.observerName)}见证</small><b>${escapeHtml(memory.stakeLabel)} · ${escapeHtml(memory.choiceLabel)}</b><span class="stake">实际执行 · ${escapeHtml(memory.stakeText)} · ${escapeHtml(narrativeChoiceMeta(memory.stakeResourceText))}</span><p>${escapeHtml(memory.incident)} ${escapeHtml(memory.outcome)}</p><em>${escapeHtml(memory.observerName)}当日这样质询：${escapeHtml(memory.observerText)} 只追这一件：${escapeHtml(memory.question)}</em></li>`).join('')}</ol></section>`
    : '';
  const favorReckoningLedger = page.favorReckonings?.length
    ? `<section class="epilogue-night-conversations epilogue-favor-reckoning" aria-label="借人情收危局留下的长期还账结果"><header><span>借来的名、话与实物怎样还</span><b>人情账已经落定</b></header><ol>${page.favorReckonings.map((memory) => `<li data-epilogue-favor-reckoning="${memory.event}:${memory.sourceDay}:${memory.choice}"><small>第 ${memory.sourceDay} 日借力 · 第 ${memory.day} 日落定 · ${escapeHtml(memory.observerName)}见证</small><b>${escapeHtml(memory.debtTitle)} · ${escapeHtml(memory.choiceLabel)}</b><span class="stake">当时借力 · ${escapeHtml(memory.sourceLabel)} · ${escapeHtml(memory.sourceText)}</span><p>${escapeHtml(memory.debtBody)} ${escapeHtml(memory.outcome)}</p><em>${escapeHtml(memory.observerName)}当日怎样举证：${escapeHtml(memory.observerLine)}</em></li>`).join('')}</ol></section>`
    : '';
  const overlay = document.createElement('div');
  overlay.className = 'epilogue-overlay';
  overlay.id = 'epilogue-modal';
  overlay.innerHTML = `<section class="epilogue-book" role="dialog" aria-modal="true" aria-labelledby="epilogue-title" ${archivedEpilogueKey ? `data-archived-ending="${escapeHtml(archivedEpilogueKey)}"` : ''}>
    <div class="epilogue-art"><img src="${urlFor(page.asset)}" alt="${escapeHtml(page.name)}的后日谈"/><span>笺</span></div>
    <article class="epilogue-copy">
      <header><p class="eyebrow">${archivedEpilogueKey ? '永久总账重看 · ' : ''}${escapeHtml(page.kicker)}</p><button class="plain-button" id="btn-epilogue-close">${archivedEpilogueKey ? '回到结局总账' : '合上后日谈'}</button></header>
      <div class="epilogue-scroll">
        <p class="epilogue-progress">后日谈 · ${narrativeStep(epilogueIndex + 1, pages.length)}${page.heroine ? ` · ${escapeHtml(page.name)}` : ''}</p>
        <h2 id="epilogue-title">${escapeHtml(page.title)}</h2>
        <p class="epilogue-body">${escapeHtml(page.body)}</p>
        ${relation}
        ${habit}
        ${personalDepartureLedger}
        ${sharedNightAccordLedger}
        ${sharedFinaleMemoryLedger}
        ${allianceMemoryLedger}
        ${collapseMemoryLedger}
        ${intimacyArrangementLedger}
        ${favorReckoningLedger}
        ${routeReckoningLedger}
        ${nightConversationLedger}
        ${ordinaryNightLedger}
        ${invitationMemoryLedger}
        ${rivalryMemoryLedger}
        ${pairMemoryLedger}
        <p class="epilogue-route-note">${escapeHtml(page.routeNote)}</p>
      </div>
      <footer><button class="ink-button" id="btn-epilogue-prev" ${epilogueIndex === 0 ? 'disabled' : ''}>上一封</button><span>${pages.map((_, index) => `<i class="${index === epilogueIndex ? 'current' : ''}"></i>`).join('')}</span><button class="ink-button story-continue" id="btn-epilogue-next" ${epilogueIndex === pages.length - 1 ? 'disabled' : ''}>下一封</button></footer>
    </article>
  </section>`;
  app.appendChild(overlay);
  inertBackgroundExcept(overlay);
  focusSoon(epilogueIndex === pages.length - 1 ? '#btn-epilogue-close' : '#btn-epilogue-next');
}

function archivedFateContext() {
  if (!archivedFateKey) return null;
  const entry = loadEndingArchive().find((row) => row.key === archivedFateKey);
  const variants = (entry?.fates ?? []).filter((fate) => (
    fate?.key
    && Array.isArray(fate.pages)
    && fate.pages.length === 3
    && fate.pages.every((page, index) => page?.page === index && page.count === 3)
  ));
  if (!variants.length) return null;
  archivedFateVariantIndex = Math.min(Math.max(0, archivedFateVariantIndex), variants.length - 1);
  archivedFatePageIndex = Math.min(Math.max(0, archivedFatePageIndex), variants[archivedFateVariantIndex].pages.length - 1);
  return { entry, variants, fate:variants[archivedFateVariantIndex] };
}

function appendFateCoda() {
  const archive = archivedFateContext();
  const page = archive ? archive.fate.pages[archivedFatePageIndex] : E.currentFateCoda(state);
  if (!page) return;
  const options = archive ? [] : E.fateCodaOptions(state);
  const finalSections = page.finalSections.length
    ? `<div class="fate-coda-sections">${page.finalSections.map((section) => `<section class="fate-coda-ledger-section" aria-label="${escapeHtml(section.title)}">
        <header><span>${escapeHtml(section.kicker)}</span><h3>${escapeHtml(section.title)}</h3></header>
        <div>${section.entries.map((entry) => `<article><span>${escapeHtml(entry.label)}</span><b>${escapeHtml(entry.title)}</b><p>${escapeHtml(entry.text)}</p></article>`).join('')}</div>
      </section>`).join('')}</div>`
    : '';
  const combination = page.combination
    ? `<div class="fate-coda-combination"><span>两页合看</span><b>${escapeHtml(page.combination.title)}</b><p>${escapeHtml(page.combination.text)}</p></div>`
    : '';
  const settled = (archive || page.resolved) && page.result
    ? `<section class="fate-coda-result" aria-label="这一页的取舍已经落定"><span>这一页已经落定</span><b>${escapeHtml(page.result.title)}</b><p>${escapeHtml(page.result.body)}</p>${combination}</section>`
    : '';
  const decision = !archive && page.awaitingChoice
    ? `<section class="fate-coda-decision"><p>${escapeHtml(page.question)}</p><div class="choice-stack">${options.map((choice) => choiceButton(choice, 'fate-coda')).join('')}</div></section>`
    : settled;
  const isLast = page.page === page.count - 1;
  const variantNav = archive?.variants.length > 1
    ? `<nav class="fate-coda-variants" aria-label="同一结局的命数处置版本"><span>本结局另有不同的命数处置</span><div>${archive.variants.map((fate, index) => `<button class="${index === archivedFateVariantIndex ? 'current' : ''}" data-fate-archive-variant="${index}"><b>${index === archivedFateVariantIndex ? '当前余账' : '另一余账'}</b><small>${escapeHtml(fate.combination?.title ?? fate.summary)}</small></button>`).join('')}</div></nav>`
    : '';
  const footerAction = archive
    ? `<button class="ink-button" id="btn-fate-archive-prev" ${page.page === 0 ? 'disabled' : ''}>上一页</button><span>永久余账 · ${narrativeStep(page.page + 1, page.count)}</span><button class="ink-button story-continue" id="btn-fate-archive-next" ${isLast ? 'disabled' : ''}>下一页</button>`
    : page.awaitingChoice
    ? '<span>这里没有能把死亡改成成功的选项</span>'
    : isLast
      ? '<button class="ink-button story-continue" id="btn-fate-coda-finish">把余账留在这里</button>'
      : '<button class="ink-button story-continue" data-fate-coda-continue="1">翻下一页</button>';
  const overlay = document.createElement('div');
  overlay.className = 'fate-coda-overlay';
  overlay.id = 'fate-coda-modal';
  overlay.innerHTML = `<section class="fate-coda-book" role="dialog" aria-modal="true" aria-labelledby="fate-coda-title" data-fate-page="${page.page}" ${archive ? `data-archived-fate="${escapeHtml(archive.entry.key)}"` : ''}>
    <div class="fate-coda-art" style="background-image:url('${urlFor('cg/finale/fate_coda')}')" role="img" aria-label="黎明空宅里的总账、钥匙、私契、药碗与五张分开的名签"></div>
    <article class="fate-coda-copy">
      <header><div><p class="eyebrow">${archive ? '永久总账重看 · ' : ''}原著命数 · ${narrativeStep(page.page + 1, page.count)}</p><p>${escapeHtml(page.kicker)}</p></div><button class="plain-button" id="btn-fate-coda-close">${archive ? '回到结局总账' : '暂合余账'}</button></header>
      <div class="fate-coda-scroll">
        <div class="fate-coda-progress" aria-label="命数三页进度">${Array.from({ length: page.count }, (_, index) => `<i class="${index === page.page ? 'current' : index < page.page ? 'past' : ''}"><span>${['起', '转', '结'][index] ?? '续'}</span></i>`).join('')}</div>
        ${variantNav}
        <h2 id="fate-coda-title">${escapeHtml(page.title)}</h2>
        <p class="fate-coda-body">${escapeHtml(page.lead)}</p>
        ${finalSections}
        ${decision}
      </div>
      <footer>${footerAction}</footer>
    </article>
  </section>`;
  app.appendChild(overlay);
  inertBackgroundExcept(overlay);
  focusSoon(archive ? (isLast ? '#btn-fate-coda-close' : '#btn-fate-archive-next') : page.awaitingChoice ? '[data-fate-coda]' : isLast ? '#btn-fate-coda-finish' : '[data-fate-coda-continue]');
}

function choiceButton(choice, dataName) {
  const id = choice.id;
  const focusableLock = choice.disabled && dataName === 'morning-settlement-choice';
  const disabled = choice.disabled && !focusableLock ? 'disabled' : '';
  const ariaDisabled = focusableLock ? 'aria-disabled="true"' : '';
  const locked = choice.disabled ? (choice.locked || choice.hint || '前事未到') : (choice.hint || '');
  const meta = narrativeChoiceMeta(choice.meta);
  const accessibleLabel = [choice.label || id, locked, meta].filter(Boolean).join('；');
  const title = meta ? ` title="${escapeHtml(meta)}"` : '';
  return `<button class="choice-button" data-${dataName}="${id}" ${disabled} ${ariaDisabled} aria-label="${escapeHtml(accessibleLabel)}"${title}><b>${escapeHtml(choice.label || id)}</b><span>${escapeHtml(locked)}</span></button>`;
}

function appendResultCard() {
  const overlay = document.createElement('aside');
  overlay.className = 'result-feedback';
  overlay.id = 'result-feedback';
  overlay.setAttribute('aria-label', resultCard.title);
  overlay.innerHTML = `<section class="result-card">
    <p class="eyebrow">她听见了，也给了你回应</p>
    <h2>${escapeHtml(resultCard.title)}</h2>
    <p>${escapeHtml(resultCard.text)}</p>
    <button class="plain-button" id="btn-result-dismiss" aria-label="收起这条回应">收起</button>
  </section>`;
  app.appendChild(overlay);
  const announcer = document.getElementById('announcer');
  if (announcer) announcer.textContent = `${resultCard.title}。${resultCard.text}`;
}

function appendGallery() {
  const unlocked = new Set(loadGallery());
  const endings = loadEndingArchive();
  const endingFamilies = new Set(endings.map((row) => row.family));
  const sceneRows = Object.values(SCENES);
  sceneRows.filter((scene) => unlocked.has(scene.id)).forEach((scene) => ensureNarrativeAsset(scene.asset));
  const groups = [
    ...HEROINE_IDS.map((id) => [HEROINES[id].name, sceneRows.filter((scene) => scene.heroine === id).map((scene) => scene.id)]),
    ['公开问责', sceneRows.filter((scene) => scene.tier === 'public').map((scene) => scene.id)],
    ['五人同灯', sceneRows.filter((scene) => ['ensemble', 'ensemble-intimate'].includes(scene.tier)).map((scene) => scene.id)],
  ].filter(([, ids]) => ids.length);
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';
  overlay.id = 'gallery-modal';
  overlay.innerHTML = `<section class="gallery-book" role="dialog" aria-modal="true" aria-label="场景册" ${gallerySceneId ? 'inert' : ''}>
    <header><div><p class="eyebrow">不会丢的结局与册页</p><h2>风月总账 <span>${endings.length ? '旧卷已收入总账' : '首卷尚未结页'} · ${unlocked.size ? '已有册页' : '题签尚未翻开'}</span></h2><p>换一套暗线不会抹掉已经走成的关系制度，也不会收回已经翻开的册页。</p></div><button class="plain-button" id="btn-gallery-close">${TEXT.close}</button></header>
    <section class="ending-archive" aria-label="结局总账">
      <div class="ending-goals">${ENDING_GOALS.map((goal) => `<article class="ending-goal ${endingFamilies.has(goal.id) ? 'complete' : ''}"><i>${endingFamilies.has(goal.id) ? '已' : '未'}</i><div><b>${goal.label}</b><small>${goal.hint}</small></div></article>`).join('')}</div>
      <div class="ending-records">${endings.length ? endings.map(endingArchiveCard).join('') : '<p>第一本总账还没有结页。二十日后，你留下的不是一个分数，而是一种她们是否愿意共同生活的办法。</p>'}</div>
    </section>
    <div class="gallery-grid">${groups.map(([name, ids]) => `<section><h3>${name}</h3><div>${ids.map((id) => galleryCard(SCENES[id], unlocked.has(id), gallerySceneVariants(id, endings).length)).join('')}</div></section>`).join('')}</div>
  </section>${gallerySceneId ? galleryReplay(SCENES[gallerySceneId], gallerySceneVariants(gallerySceneId, endings), galleryVariantIndex) : ''}`;
  app.appendChild(overlay);
  inertBackgroundExcept(overlay);
  focusSoon(gallerySceneId ? '#btn-gallery-replay-close' : '#btn-gallery-close');
}

function endingArchiveCard(entry) {
  const family = ENDING_GOALS.find((row) => row.id === entry.family)?.label ?? '旧账结页';
  const seeds = Array.isArray(entry.seeds) && entry.seeds.length ? entry.seeds : [entry.seed].filter(Number.isInteger);
  const hasAfterstory = Array.isArray(entry.afterstory?.pages) && entry.afterstory.pages.length === HEROINE_IDS.length + 1;
  const fates = (entry.fates ?? []).filter((fate) => Array.isArray(fate?.pages) && fate.pages.length === 3);
  const content = `
    <p><span>${escapeHtml(family)}</span><small>${seeds.length > 1 ? '不同暗线都曾走到这里' : seeds.length ? '这一套暗线留下的旧局' : '旧局'}</small></p>
    <h3>${escapeHtml(entry.title)}${entry.cast ? `<em>${escapeHtml(entry.cast)}</em>` : ''}</h3>
    <b>${escapeHtml(entry.tag || '')}</b>
    <small>${escapeHtml(entry.text)}</small>`;
  const actions = [
    hasAfterstory ? `<button data-ending-open="${escapeHtml(entry.key)}">重读五封一月笺与末页</button>` : '',
    fates.length ? `<button data-fate-ending-open="${escapeHtml(entry.key)}">重读命数三页 · 另有处置</button>` : '',
  ].filter(Boolean).join('');
  return `<article class="ending-record" data-ending-record="${escapeHtml(entry.key)}">${content}${actions ? `<div class="ending-record-actions">${actions}</div>` : ''}</article>`;
}

function gallerySceneVariants(sceneId, endings) {
  const variants = new Map();
  for (const ending of endings) {
    const record = ending?.scenes?.[sceneId];
    if (!record || record.scene !== sceneId || typeof record.key !== 'string' || !Array.isArray(record.pages) || !record.pages.length) continue;
    if (variants.has(record.key)) continue;
    variants.set(record.key, {
      ...record,
      endingKey:ending.key,
      endingTitle:ending.title,
      endingCast:ending.cast,
      seeds:Array.isArray(ending.seeds) ? ending.seeds : [ending.seed].filter(Number.isInteger),
    });
  }
  return [...variants.values()];
}

function galleryCard(scene, open, variantCount = 0) {
  const archiveCount = variantCount ? ' · 另有真实版本' : '';
  return `<button class="gallery-card ${open ? 'unlocked' : 'locked'}" data-gallery-scene="${scene.id}" ${open ? `data-gallery-open="${scene.id}"` : 'disabled'}>
    ${open ? `<img src="${urlFor(scene.asset)}" alt="${scene.title}"/>` : '<div class="locked-art" aria-label="未解锁">未</div>'}
    <div><b>${open ? scene.title : '题签未开'}</b><small>${open ? `${scene.tier === 'public' ? '公开问责' : scene.tier === 'ensemble' ? '五院共约' : scene.tier === 'ensemble-intimate' ? '五院余夜' : scene.tier === 'explicit' ? '那夜留宿' : '帘前一步'}${archiveCount}` : lockedHint(scene.id)}</small></div>
  </button>`;
}

function galleryArchivePage(page, index) {
  const details = Array.isArray(page.details) && page.details.length
    ? `<ul class="gallery-archive-details">${page.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : '';
  const actions = Array.isArray(page.actions) && page.actions.length
    ? `<section class="gallery-archive-actions" aria-label="本页具名动作"><h4>具名动作</h4>${page.actions.map((action) => `<p${action.heroine ? ` data-heroine="${escapeHtml(action.heroine)}"` : ''}><b>${escapeHtml(action.label)}</b><span>${escapeHtml(action.text)}</span></p>`).join('')}</section>` : '';
  const nonmembers = Array.isArray(page.nonmembers) && page.nonmembers.length
    ? `<section class="gallery-archive-nonmembers" aria-label="未入席者边界"><h4>没有被补画进成员席的人</h4>${page.nonmembers.map((entry) => `<p data-heroine="${escapeHtml(entry.heroine)}"><b>${escapeHtml(entry.label)} · ${escapeHtml(entry.status)}</b><span>${escapeHtml(entry.object ? `${entry.object}。${entry.text}` : entry.text)}</span></p>`).join('')}</section>` : '';
  return `<article class="gallery-archive-page" data-gallery-archive-page="${index}">
    <p class="gallery-archive-kicker">${escapeHtml(page.kicker)}</p>
    <h3>${escapeHtml(page.title)}</h3>
    <p>${escapeHtml(page.text)}</p>
    ${details}${actions}${nonmembers}
  </article>`;
}

function galleryReplay(scene, variants = [], selectedIndex = 0) {
  const index = variants.length ? Math.min(Math.max(selectedIndex, 0), variants.length - 1) : 0;
  galleryVariantIndex = index;
  const variant = variants[index] ?? null;
  const variantNav = variants.length > 1
    ? `<nav class="gallery-variant-nav" aria-label="真实路线版本">${variants.map((entry, variantIndex) => `<button class="plain-button ${variantIndex === index ? 'active' : ''}" data-gallery-variant="${variantIndex}" aria-pressed="${variantIndex === index}">${escapeHtml(entry.title)}</button>`).join('')}</nav>` : '';
  const archivedCopy = variant ? `
      <p class="eyebrow">真实路线档案 · ${escapeHtml(variant.endingTitle)}</p>
      <h2>${escapeHtml(variant.title)}</h2>
      <p class="gallery-archive-summary">${escapeHtml(variant.summary)}</p>
      ${variantNav}
      <div class="gallery-archive-pages">${variant.pages.map(galleryArchivePage).join('')}</div>
      <p class="replay-note">这是本局真实走成的成员、答复、物件与动作；重看不会改写已经走过的路。</p>` : `
      <p class="eyebrow">${scene.tier === 'public' ? '再看公开问责' : scene.tier === 'ensemble' ? '再看五院同灯' : scene.tier === 'ensemble-intimate' ? '18+ · 再看灯下余夜' : '18+ · 翻回那一夜'}</p>
      <h2>${escapeHtml(scene.title)}</h2>
      <p>${escapeHtml(scene.body)}</p>
      <p class="replay-note">这页没有结局动态档案；重看只翻静态册页，不改已经走过的路。</p>`;
  return `<article class="gallery-replay" id="gallery-replay" data-replay-scene="${scene.id}" role="dialog" aria-modal="true" aria-label="重看${scene.title}">
    <img id="gallery-replay-image" src="${urlFor(scene.asset)}" alt="${scene.title}"/>
    <div class="gallery-replay-copy">
      ${archivedCopy}
      <button class="ink-button story-continue" id="btn-gallery-replay-close">合上这一页</button>
    </div>
  </article>`;
}

function lockedHint(sceneId) {
  if (SCENES[sceneId]?.tier === 'public') return '等对应的公开问责落席';
  if (sceneId === 'inner_court_accord') return '听完五条院约，再请五人同席';
  if (sceneId === 'inner_court_afterglow') return '共同办完外账，再把三拍余夜走完';
  if (sceneId.startsWith('yue_')) return '先把答应月娘的事办了';
  if (sceneId.startsWith('pan_')) return '先还金莲那杯酒';
  if (sceneId.startsWith('pinger_')) return '先护住瓶儿的账';
  if (sceneId.startsWith('meng_')) return '先把玉楼的条件和功劳写清';
  return '先当众还雪娥管灶与作证的权限';
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
  const announcer = document.getElementById('announcer');
  if (announcer) announcer.textContent = text;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), FAST ? 150 : 2200);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.getAttribute('aria-disabled') === 'true') {
    const reason = button.querySelector('span')?.textContent?.trim() || '前事未到，这项选择暂不可用。';
    showToast(reason);
    const announcer = document.getElementById('announcer');
    if (announcer) announcer.textContent = reason;
    return;
  }
  const actionLabel = button.querySelector('b')?.textContent?.trim() || button.textContent.trim();
  if (!audioReady) { audioReady = true; audio.unlock(); audio.playBGM(bgmCue()); }
  audio.sfx('click');

  if (button.id === 'btn-result-dismiss') { resultCard = null; render(); focusSoon(firstPhaseActionSelector()); }
  else if (button.id === 'btn-age-yes') {
    sessionStorage.setItem(AGE_KEY, 'yes');
    await bootPromise;
    scheduleSafePreload();
    render();
    focusSoon('#btn-start');
  } else if (button.id === 'btn-age-no') {
    app.innerHTML = '<main class="age-gate"><h1>这道门不往里开</h1><p>本作只供成年人。你可以直接关闭页面。</p></main>';
  } else if (button.id === 'btn-start') {
    if (loadSave()) { newGameConfirmOpen = true; render(); }
    else { startNew(); focusSoon(firstPhaseActionSelector()); }
  } else if (button.id === 'btn-confirm-new') { startNew(); focusSoon(firstPhaseActionSelector()); }
  else if (button.id === 'btn-cancel-new') { newGameConfirmOpen = false; render(); focusSoon('#btn-start'); }
  else if (button.id === 'btn-continue') continueGame();
  else if (button.id === 'btn-gallery') { galleryReturnSelector = selectorForButton(button); galleryOpen = true; gallerySceneId = null; galleryVariantIndex = 0; archivedEpilogueKey = null; archivedFateKey = null; render(); }
  else if (button.id === 'btn-fate-coda') {
    fateCodaReturnSelector = selectorForButton(button);
    epilogueOpen = false;
    archivedFateKey = null;
    archivedFateVariantIndex = 0;
    archivedFatePageIndex = 0;
    if (!E.currentFateCoda(state)) {
      const result = E.startFateCoda(state);
      if (!result.ok) return showToast(result.error);
      save();
    }
    fateCodaOpen = true;
    render();
  }
  else if (button.id === 'btn-fate-coda-close' || button.id === 'btn-fate-coda-finish') { const target = fateCodaReturnSelector || '#btn-fate-coda'; fateCodaOpen = false; archivedFateKey = null; archivedFateVariantIndex = 0; archivedFatePageIndex = 0; render(); focusSoon(target); }
  else if (button.id === 'btn-epilogue') { fateCodaOpen = false; archivedEpilogueKey = null; epilogueReturnSelector = selectorForButton(button); epilogueOpen = true; epilogueIndex = 0; render(); }
  else if (button.id === 'btn-epilogue-close') { const target = epilogueReturnSelector || '#btn-epilogue'; epilogueOpen = false; archivedEpilogueKey = null; render(); focusSoon(target); }
  else if (button.id === 'btn-epilogue-prev') { epilogueIndex = Math.max(0, epilogueIndex - 1); render(); }
  else if (button.id === 'btn-epilogue-next') { epilogueIndex = Math.min(epiloguePages().length - 1, epilogueIndex + 1); render(); }
  else if (button.id === 'btn-roster') { rosterOpen = true; render(); }
  else if (button.id === 'btn-roster-close') { rosterOpen = false; render(); focusSoon('#btn-roster'); }
  else if (button.id === 'btn-gallery-close') { galleryOpen = false; gallerySceneId = null; galleryVariantIndex = 0; archivedEpilogueKey = null; archivedFateKey = null; render(); focusSoon(galleryReturnSelector || '#btn-gallery'); }
  else if (button.id === 'btn-gallery-replay-close') { const closed = gallerySceneId; gallerySceneId = null; galleryVariantIndex = 0; render(); focusSoon(`[data-gallery-open="${CSS.escape(closed)}"]`); }
  else if (button.dataset.galleryVariant !== undefined) { galleryVariantIndex = Number(button.dataset.galleryVariant) || 0; render(); }
  else if (button.dataset.galleryOpen) { gallerySceneId = button.dataset.galleryOpen; galleryVariantIndex = 0; render(); }
  else if (button.dataset.endingOpen) { archivedFateKey = null; archivedEpilogueKey = button.dataset.endingOpen; epilogueReturnSelector = selectorForButton(button); epilogueIndex = 0; epilogueOpen = true; render(); }
  else if (button.dataset.fateEndingOpen) { archivedEpilogueKey = null; archivedFateKey = button.dataset.fateEndingOpen; archivedFateVariantIndex = 0; archivedFatePageIndex = 0; fateCodaReturnSelector = selectorForButton(button); fateCodaOpen = true; render(); }
  else if (button.id === 'btn-fate-archive-prev') { archivedFatePageIndex = Math.max(0, archivedFatePageIndex - 1); render(); }
  else if (button.id === 'btn-fate-archive-next') { const archive = archivedFateContext(); archivedFatePageIndex = Math.min((archive?.fate.pages.length ?? 1) - 1, archivedFatePageIndex + 1); render(); }
  else if (button.dataset.fateArchiveVariant !== undefined) { archivedFateVariantIndex = Number(button.dataset.fateArchiveVariant) || 0; archivedFatePageIndex = 0; render(); }
  else if (button.id === 'btn-mute') { audio.unlock(); audio.toggleMuted(); render(); }
  else if (button.id === 'btn-secret-clear') {
    const result = E.selectSecret(state, null); if (!result.ok) showToast(result.error); else { save(); render(); focusSoon('[data-day-action="office"]'); }
  }
  else if (button.dataset.secretSelect) {
    const secretId = button.dataset.secretSelect; const result = E.selectSecret(state, secretId);
    if (!result.ok) showToast(result.error); else { save(); render(); focusSoon(`[data-secret-select="${CSS.escape(secretId)}"]`); }
  }
  else if (button.id === 'btn-restart') { restart(); focusSoon(firstPhaseActionSelector()); }
  else if (button.id === 'btn-replay-seed') { restart(true); focusSoon(firstPhaseActionSelector()); }
  else if (button.id === 'btn-scene-close') act(() => E.closeScene(state), actionLabel);
  else if (button.dataset.opening) act(() => E.chooseOpening(state, button.dataset.opening), actionLabel);
  else if (button.dataset.openingAftermathContinue) act(() => E.advanceOpeningAftermath(state), actionLabel);
  else if (button.dataset.houseCrisisReply) act(() => E.advanceHouseCrisisReply(state), actionLabel);
  else if (button.dataset.houseCrisis) act(() => E.resolveHouseCrisis(state, button.dataset.houseCrisis), actionLabel);
  else if (button.dataset.houseCrisisAftermath) act(() => E.resolveHouseCrisisAftermath(state, button.dataset.houseCrisisAftermath), actionLabel);
  else if (button.dataset.houseCrisisAftermathContinue) act(() => E.advanceHouseCrisisAftermath(state), actionLabel);
  else if (button.dataset.pairStory) act(() => E.advancePairInterlude(state), actionLabel);
  else if (button.dataset.pairInterlude) act(() => E.resolvePairInterlude(state, button.dataset.pairInterlude), actionLabel);
  else if (button.dataset.favorStory) act(() => E.advanceFavorReckoning(state), actionLabel);
  else if (button.dataset.favorReckoning) act(() => E.resolveFavorReckoning(state, button.dataset.favorReckoning), actionLabel);
  else if (button.dataset.memoryStory) act(() => E.advanceMemoryReckoning(state), actionLabel);
  else if (button.dataset.memoryReckoning) act(() => E.resolveMemoryReckoning(state, button.dataset.memoryReckoning), actionLabel);
  else if (button.dataset.duskInvitation) act(() => E.resolveDuskInvitation(state, button.dataset.duskInvitation), actionLabel);
  else if (button.dataset.duskInvitationAftermath) act(() => E.resolveDuskInvitationAftermath(state, button.dataset.duskInvitationAftermath), actionLabel);
  else if (button.dataset.duskInvitationAftermathContinue) act(() => E.advanceDuskInvitationAftermath(state), actionLabel);
  else if (button.dataset.actTransition) act(() => E.resolveActTransition(state, button.dataset.actTransition), actionLabel);
  else if (button.dataset.actAftermathChoice) act(() => E.resolveActAftermath(state, button.dataset.actAftermathChoice), actionLabel);
  else if (button.dataset.actAftermathContinue) act(() => E.advanceActAftermath(state), actionLabel);
  else if (button.dataset.dayAction) act(() => E.chooseDayAction(state, button.dataset.dayAction), actionLabel);
  else if (button.dataset.dayAftermathContinue) act(() => E.advanceDayAftermath(state), actionLabel);
  else if (button.dataset.jointAction) act(() => E.chooseJointAction(state, button.dataset.jointAction), actionLabel);
  else if (button.dataset.jointContinue) act(() => E.continueJointAction(state), actionLabel);
  else if (button.dataset.portablePrecedentContinue) act(() => E.advancePortablePrecedent(state), actionLabel);
  else if (button.dataset.portablePrecedentChoice) act(() => E.choosePortablePrecedent(state, button.dataset.portablePrecedentChoice), actionLabel);
  else if (button.dataset.household) act(() => E.resolveHouseholdEvent(state, button.dataset.household), actionLabel);
  else if (button.dataset.householdAftermath) act(() => E.resolveHouseholdAftermath(state, button.dataset.householdAftermath), actionLabel);
  else if (button.dataset.householdAftermathContinue) act(() => E.advanceHouseholdAftermath(state), actionLabel);
  else if (button.dataset.council) act(() => E.resolveCouncil(state, button.dataset.council), actionLabel);
  else if (button.dataset.councilAftermathContinue) act(() => E.advanceCouncilAftermath(state), actionLabel);
  else if (button.dataset.banquet) act(() => E.chooseBanquet(state, button.dataset.banquet), actionLabel);
  else if (button.dataset.publicEvidence) act(() => E.choosePublicEvidence(state, button.dataset.publicEvidence), actionLabel);
  else if (button.dataset.publicEvidenceComplete) act(() => E.completePublicEvidence(state), actionLabel);
  else if (button.dataset.publicFollowup) act(() => E.resolvePublicFollowup(state, button.dataset.publicFollowup), actionLabel);
  else if (button.dataset.publicAftermathContinue) act(() => E.advancePublicAftermath(state), actionLabel);
  else if (button.dataset.fivePriceContinue) act(() => E.advanceFivePrivatePrices(state), actionLabel);
  else if (button.dataset.fivePriceProtocol) act(() => E.chooseFivePrivatePriceProtocol(state, button.dataset.fivePriceProtocol), actionLabel);
  else if (button.dataset.fivePriceRight) act(() => E.chooseFivePrivatePriceRight(state, button.dataset.fivePriceRight), actionLabel);
  else if (button.dataset.finalReckoning) act(() => E.resolveFinalReckoning(state, button.dataset.finalReckoning), actionLabel);
  else if (button.dataset.finalReckoningAftermath) act(() => E.resolveFinalReckoningAftermath(state, button.dataset.finalReckoningAftermath), actionLabel);
  else if (button.dataset.finalAftermathContinue) act(() => E.advanceFinalReckoningAftermath(state), actionLabel);
  else if (button.dataset.personalFinaleResultContinue) act(() => E.continuePersonalFinaleResult(state), actionLabel);
  else if (button.dataset.personalFinale) act(() => E.choosePersonalFinale(state, button.dataset.personalFinale), actionLabel);
  else if (button.dataset.allianceStart) act(() => E.startAllianceNight(state), actionLabel);
  else if (button.dataset.allianceAssemblyContinue) act(() => E.advanceAllianceAssembly(state), actionLabel);
  else if (button.dataset.allianceResultContinue) act(() => E.continueAllianceNightResult(state), actionLabel);
  else if (button.dataset.allianceNight) act(() => E.chooseAllianceNight(state, button.dataset.allianceNight), actionLabel);
  else if (button.dataset.sharedStart) act(() => E.startSharedNight(state), actionLabel);
  else if (button.dataset.sharedNight) act(() => E.chooseSharedNight(state, button.dataset.sharedNight), actionLabel);
  else if (button.dataset.sharedAfterglowResultContinue) act(() => E.continueSharedAfterglowResult(state), actionLabel);
  else if (button.dataset.sharedAfterglow) act(() => E.chooseSharedAfterglow(state, button.dataset.sharedAfterglow), actionLabel);
  else if (button.dataset.sharedDawn) act(() => E.chooseSharedDawn(state, button.dataset.sharedDawn), actionLabel);
  else if (button.dataset.sharedDawnResultContinue) act(() => E.continueSharedDawnResult(state), actionLabel);
  else if (button.dataset.collapseContinue) act(() => E.advanceCollapseFinale(state), actionLabel);
  else if (button.dataset.collapseChoice) act(() => E.chooseCollapseFinale(state, button.dataset.collapseChoice), actionLabel);
  else if (button.dataset.collapseResultContinue) act(() => E.continueCollapseFinaleResult(state), actionLabel);
  else if (button.dataset.fateCoda) act(() => E.chooseFateCoda(state, button.dataset.fateCoda), actionLabel);
  else if (button.dataset.fateCodaContinue) act(() => E.advanceFateCoda(state), actionLabel);
  else if (button.dataset.visit) act(() => E.startVisit(state, button.dataset.visit), actionLabel);
  else if (button.dataset.routeChoice) act(() => E.chooseVisit(state, button.dataset.routeChoice), actionLabel);
  else if (button.dataset.routeStory) act(() => E.advanceRouteAftermath(state), actionLabel);
  else if (button.dataset.nightCodaContinue) act(() => E.advanceOrdinaryNightCoda(state), actionLabel);
  else if (button.dataset.nightStory) act(() => E.advanceNightConversation(state), actionLabel);
  else if (button.dataset.nightConversation) act(() => E.chooseNightConversation(state, button.dataset.nightConversation), actionLabel);
  else if (button.dataset.nightConversationResult) act(() => E.continueNightConversation(state), actionLabel);
  else if (button.dataset.morningSettlementContinue) act(() => E.advanceMorningSettlement(state), actionLabel);
  else if (button.dataset.morningSettlementChoice) act(() => E.chooseMorningSettlement(state, button.dataset.morningSettlementChoice), actionLabel);
  else if (button.dataset.morningStory) act(() => E.advanceMorningStory(state), actionLabel);
  else if (button.dataset.morningResolution) act(() => E.continueMorningResolution(state), actionLabel);
  else if (button.dataset.routeAftermath) act(() => E.resolveRouteAftermath(state, button.dataset.routeAftermath), actionLabel);
  else if (button.dataset.night) act(() => E.chooseNight(state, button.dataset.night), actionLabel);
  else if (button.dataset.personalAfterglowAftermath) act(() => E.resolvePersonalAfterglowAftermath(state, button.dataset.personalAfterglowAftermath), actionLabel);
  else if (button.dataset.personalAfterglowAftermathContinue) act(() => E.advancePersonalAfterglowAftermath(state), actionLabel);
  else if (button.dataset.personalAfterglow) act(() => E.choosePersonalAfterglow(state, button.dataset.personalAfterglow), actionLabel);
  else if (button.dataset.morning) act(() => E.resolveMorning(state, button.dataset.morning), actionLabel);
});

document.addEventListener('keydown', (event) => {
  const dialog = document.querySelector('#gallery-replay, #new-game-confirm .confirm-card, #roster-modal .roster-sheet, #gallery-modal .gallery-book, #epilogue-modal .epilogue-book, #fate-coda-modal .fate-coda-book');
  if (event.key === 'Tab' && dialog) {
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    return;
  }
  if (event.key !== 'Escape') return;
  if (newGameConfirmOpen) {
    event.preventDefault(); newGameConfirmOpen = false; render(); focusSoon('#btn-start');
  } else if (fateCodaOpen) {
    event.preventDefault();
    const target = fateCodaReturnSelector || '#btn-fate-coda';
    fateCodaOpen = false; archivedFateKey = null; archivedFateVariantIndex = 0; archivedFatePageIndex = 0; render(); focusSoon(target);
  } else if (epilogueOpen) {
    event.preventDefault();
    const target = epilogueReturnSelector || '#btn-epilogue';
    epilogueOpen = false; archivedEpilogueKey = null; render(); focusSoon(target);
  } else if (rosterOpen) {
    event.preventDefault(); rosterOpen = false; render(); focusSoon('#btn-roster');
  } else if (galleryOpen) {
    event.preventDefault();
    if (gallerySceneId) {
      const closed = gallerySceneId; gallerySceneId = null; galleryVariantIndex = 0; render(); focusSoon(`[data-gallery-open="${CSS.escape(closed)}"]`);
    } else {
      galleryOpen = false; galleryVariantIndex = 0; render(); focusSoon(galleryReturnSelector || '#btn-gallery');
    }
  }
});

window.__game = Object.freeze({
  state: () => state ? E.snapshot(state) : null,
  activeObligations: () => state ? E.activeObligations(state) : [],
  dayDef: () => state ? E.dayDef(state) : null,
  pressurePlan: () => state ? { current: E.dayPressureRule(state), next: state.day < E.MAX_DAY ? E.dayPressureRule(state, state.day + 1) : null } : null,
  dayOptions: () => state ? E.dayOptions(state) : [],
  dayAftermath: () => state ? E.currentDayAftermath(state) : null,
  fateCoda: () => state ? E.currentFateCoda(state) : null,
  nightConversation: () => state ? E.currentNightConversation(state) : null,
  nightCoda: () => state ? E.currentOrdinaryNightCoda(state) : null,
  householdOptions: () => state ? E.householdOptions(state) : [],
  householdEvent: () => state ? E.currentHouseholdEvent(state) : null,
  householdAftermath: () => state ? E.currentHouseholdAftermath(state) : null,
  householdAftermathOptions: () => state ? E.householdAftermathOptions(state) : [],
  jiaoerFloorDisposition: () => state ? E.recordedJiaoerFloorDisposition(state) : null,
  jiaoerDeedDisposition: () => state ? E.recordedJiaoerDeedDisposition(state) : null,
  jiaoerLedger: () => state ? E.jiaoerLedger(state) : null,
  councilOptions: () => state ? E.councilOptions(state) : [],
  councilAftermath: () => state ? E.currentCouncilAftermath(state) : null,
  publicFollowupOptions: () => state ? E.publicFollowupOptions(state) : [],
  publicAftermath: () => state ? E.currentPublicAftermath(state) : null,
  secretInventory: () => state ? E.secretInventory(state) : [],
  gallery: () => loadGallery(),
  endingArchive: () => loadEndingArchive(),
  assets: () => assetReport(),
  preloadAllAssets: () => loadAssets(Object.keys(ASSET_PATHS)),
  assetPaths: ASSET_PATHS,
  saveKey: SAVE_KEY,
  seed: SEED,
  audioCue: () => bgmCue(),
  audioScene: () => audio.currentScene,
  newGame: () => startNew(),
  restart,
  replaySeed: () => restart(true),
  chooseOpening: (id) => act(() => E.chooseOpening(state, id)),
  openingAftermath: () => state ? E.currentOpeningAftermath(state) : null,
  advanceOpeningAftermath: () => act(() => E.advanceOpeningAftermath(state)),
  currentHouseCrisis: () => state ? E.currentHouseCrisis(state) : null,
  houseCrisis: (id) => act(() => E.resolveHouseCrisis(state, id)),
  advanceHouseCrisisReply: () => act(() => E.advanceHouseCrisisReply(state)),
  houseCrisisAftermath: () => state ? E.currentHouseCrisisAftermath(state) : null,
  houseCrisisAftermathOptions: () => state ? E.houseCrisisAftermathOptions(state) : [],
  chooseHouseCrisisAftermath: (id) => act(() => E.resolveHouseCrisisAftermath(state, id)),
  advanceHouseCrisisAftermath: () => act(() => E.advanceHouseCrisisAftermath(state)),
  advancePairInterlude: () => act(() => E.advancePairInterlude(state)),
  pairInterlude: (id) => act(() => E.resolvePairInterlude(state, id)),
  currentFavorReckoning: () => state ? E.currentFavorReckoning(state) : null,
  favorReckoningOptions: () => state ? E.favorReckoningOptions(state) : [],
  advanceFavorReckoning: () => act(() => E.advanceFavorReckoning(state)),
  favorReckoning: (id) => act(() => E.resolveFavorReckoning(state, id)),
  currentMemoryReckoning: () => state ? E.currentMemoryReckoning(state) : null,
  memoryReckoningOptions: () => state ? E.memoryReckoningOptions(state) : [],
  advanceMemoryReckoning: () => act(() => E.advanceMemoryReckoning(state)),
  memoryReckoning: (id) => act(() => E.resolveMemoryReckoning(state, id)),
  duskInvitation: (id) => act(() => E.resolveDuskInvitation(state, id)),
  duskInvitationAftermath: () => state ? E.currentDuskInvitationAftermath(state) : null,
  duskInvitationAftermathOptions: () => state ? E.duskInvitationAftermathOptions(state) : [],
  chooseDuskInvitationAftermath: (id) => act(() => E.resolveDuskInvitationAftermath(state, id)),
  advanceDuskInvitationAftermath: () => act(() => E.advanceDuskInvitationAftermath(state)),
  actTransitionOptions: () => state ? E.actTransitionOptions(state) : [],
  actTransition: (id) => act(() => E.resolveActTransition(state, id)),
  actAftermath: () => state ? E.currentActAftermath(state) : null,
  actAftermathOptions: () => state ? E.actAftermathOptions(state) : [],
  chooseActAftermath: (id) => act(() => E.resolveActAftermath(state, id)),
  advanceActAftermath: () => act(() => E.advanceActAftermath(state)),
  chooseDay: (id) => act(() => E.chooseDayAction(state, id)),
  morningSettlement: () => state ? E.currentMorningSettlement(state) : null,
  morningSettlementOptions: () => state ? E.morningSettlementOptions(state) : [],
  chooseMorningSettlement: (id) => act(() => E.chooseMorningSettlement(state, id)),
  advanceMorningSettlement: () => act(() => E.advanceMorningSettlement(state)),
  chooseJointAction: (id) => act(() => E.chooseJointAction(state, id)),
  continueJointAction: () => act(() => E.continueJointAction(state)),
  portablePrecedent: () => state ? E.currentPortablePrecedent(state) : null,
  portablePrecedentOptions: () => state ? E.portablePrecedentOptions(state) : [],
  choosePortablePrecedent: (id) => act(() => E.choosePortablePrecedent(state, id)),
  advancePortablePrecedent: () => act(() => E.advancePortablePrecedent(state)),
  recordedPortablePrecedent: () => state ? E.recordedPortablePrecedent(state) : null,
  household: (id) => act(() => E.resolveHouseholdEvent(state, id)),
  chooseHouseholdAftermath: (id) => act(() => E.resolveHouseholdAftermath(state, id)),
  advanceHouseholdAftermath: () => act(() => E.advanceHouseholdAftermath(state)),
  council: (id) => act(() => E.resolveCouncil(state, id)),
  chooseBanquet: (id) => act(() => E.chooseBanquet(state, id)),
  publicEvidence: () => state ? E.currentPublicEvidence(state) : null,
  publicEvidenceOptions: () => state ? E.publicEvidenceOptions(state) : [],
  choosePublicEvidence: (id) => act(() => E.choosePublicEvidence(state, id)),
  completePublicEvidence: () => act(() => E.completePublicEvidence(state)),
  publicFollowup: (id) => act(() => E.resolvePublicFollowup(state, id)),
  advancePublicAftermath: () => act(() => E.advancePublicAftermath(state)),
  fivePrivatePrices: () => state ? E.currentFivePrivatePrices(state) : null,
  fivePrivatePriceOptions: () => state ? E.fivePrivatePriceOptions(state) : [],
  chooseFivePrivatePriceProtocol: (id) => act(() => E.chooseFivePrivatePriceProtocol(state, id)),
  chooseFivePrivatePriceRight: (id) => act(() => E.chooseFivePrivatePriceRight(state, id)),
  advanceFivePrivatePrices: () => act(() => E.advanceFivePrivatePrices(state)),
  finalReckoningOptions: () => state ? E.finalReckoningOptions(state) : [],
  currentFinalReckoning: () => state ? E.currentFinalReckoning(state) : null,
  finalReckoning: (id) => act(() => E.resolveFinalReckoning(state, id)),
  finalReckoningAftermath: () => state ? E.currentFinalReckoningAftermath(state) : null,
  finalReckoningAftermathOptions: () => state ? E.finalReckoningAftermathOptions(state) : [],
  chooseFinalReckoningAftermath: (id) => act(() => E.resolveFinalReckoningAftermath(state, id)),
  advanceFinalReckoningAftermath: () => act(() => E.advanceFinalReckoningAftermath(state)),
  personalFinaleBeat: () => state ? E.personalFinaleBeat(state) : null,
  personalFinaleResult: () => state ? E.currentPersonalFinaleResult(state) : null,
  choosePersonalFinale: (id) => act(() => E.choosePersonalFinale(state, id)),
  continuePersonalFinaleResult: () => act(() => E.continuePersonalFinaleResult(state)),
  allianceNightStatus: () => state ? E.allianceNightStatus(state) : null,
  startAllianceNight: () => act(() => E.startAllianceNight(state)),
  allianceAssembly: () => state ? E.currentAllianceAssembly(state) : null,
  advanceAllianceAssembly: () => act(() => E.advanceAllianceAssembly(state)),
  allianceNightResult: () => state ? E.currentAllianceNightResult(state) : null,
  chooseAllianceNight: (id) => act(() => E.chooseAllianceNight(state, id)),
  continueAllianceNightResult: () => act(() => E.continueAllianceNightResult(state)),
  startSharedNight: () => act(() => E.startSharedNight(state)),
  chooseSharedNight: (id) => act(() => E.chooseSharedNight(state, id)),
  sharedDawnResult: () => state ? E.currentSharedDawnResult(state) : null,
  continueSharedDawnResult: () => act(() => E.continueSharedDawnResult(state)),
  collapseFinale: () => state ? E.currentCollapseFinale(state) : null,
  collapseFinaleOptions: () => state ? E.collapseFinaleOptions(state) : [],
  advanceCollapseFinale: () => act(() => E.advanceCollapseFinale(state)),
  chooseCollapseFinale: (id) => act(() => E.chooseCollapseFinale(state, id)),
  collapseFinaleResult: () => state ? E.currentCollapseFinaleResult(state) : null,
  continueCollapseFinaleResult: () => act(() => E.continueCollapseFinaleResult(state)),
  sharedAfterglowResult: () => state ? E.currentSharedAfterglowResult(state) : null,
  chooseSharedAfterglow: (id) => act(() => E.chooseSharedAfterglow(state, id)),
  continueSharedAfterglowResult: () => act(() => E.continueSharedAfterglowResult(state)),
  chooseSharedDawn: (id) => act(() => E.chooseSharedDawn(state, id)),
  visit: (id) => act(() => E.startVisit(state, id)),
  chooseVisit: (id) => act(() => E.chooseVisit(state, id)),
  advanceRouteStory: () => act(() => E.advanceRouteAftermath(state)),
  advanceNightConversation: () => act(() => E.advanceNightConversation(state)),
  chooseNightConversation: (id) => act(() => E.chooseNightConversation(state, id)),
  continueNightConversation: () => act(() => E.continueNightConversation(state)),
  advanceMorningStory: () => act(() => E.advanceMorningStory(state)),
  continueMorningResolution: () => act(() => E.continueMorningResolution(state)),
  routeAftermath: (id) => act(() => E.resolveRouteAftermath(state, id)),
  chooseNight: (id) => act(() => E.chooseNight(state, id)),
  personalAfterglow: (id) => act(() => E.choosePersonalAfterglow(state, id)),
  personalAfterglowAftermath: () => state ? E.currentPersonalAfterglowAftermath(state) : null,
  personalAfterglowAftermathOptions: () => state ? E.personalAfterglowAftermathOptions(state) : [],
  choosePersonalAfterglowAftermath: (id) => act(() => E.resolvePersonalAfterglowAftermath(state, id)),
  advancePersonalAfterglowAftermath: () => act(() => E.advancePersonalAfterglowAftermath(state)),
  morning: (id) => act(() => E.resolveMorning(state, id)),
  closeScene: () => act(() => E.closeScene(state)),
});
