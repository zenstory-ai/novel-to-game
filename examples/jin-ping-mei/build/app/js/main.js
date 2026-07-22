// 入口与流程编排:标题 → 24 节令(事件→行动→结算) → 第79回清零演出 → 分家 → 结局 → 收束。
// 引擎在 engine.js(纯逻辑);此文件只做呈现与输入。

import { TEXT } from './text.js';
import { SERVANTS, SCHEMES, DUTIES, TUILU, ENDING, YE_COST, YE_WEIGHT, ACTION_ECHO, LODGING_SCENES, INTIMACY, intimacyTier } from './data.js';
import { pick } from './rng.js';
import * as E from './engine.js';
import { loadAssets, coverURL, portraitURL, compoundStyle } from './assets.js';
import { el, clear, toast, spawnFloats, showModal, closeModal, sealButton } from './ui.js';
import { createCompound } from './compound.js';
import { audio } from './audio.js';

const SAVE_KEY = 'jpm_save_v1';
const params = new URLSearchParams(location.search);
const FAST = params.get('fast') === '1';
const SEED = params.has('seed') ? Number(params.get('seed')) : (Date.now() % 100000);
const wait = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 60) : ms));

const app = document.getElementById('app');
let state = null;
let compound = null;
let els = {}; // 舞台各层引用

// ---------- 音频:首次手势后解锁并按当前场景起 BGM ----------
function sceneFor() {
  if (!state) return 'title';
  return `act${E.festivalDef(state).act}`;
}
let audioArmed = false;
document.addEventListener('pointerdown', () => {
  if (audioArmed) return;
  audioArmed = true;
  audio.unlock();
  audio.playBGM(sceneFor());
}, { capture: true });

// 事件对话卡的立绘(居右)
const EVENT_PORTRAIT = {
  1: 'servant/xue_meipo', 4: 'portrait/pan_jinlian', 6: 'portrait/li_pinger',
  7: 'portrait/ximen_qing', 15: 'portrait/pan_jinlian', 16: 'portrait/li_pinger',
  19: 'portrait/ximen_qing', 20: 'portrait/wu_yueniang_mourning', 21: 'portrait/wu_yueniang_mourning',
  22: 'portrait/wu_yueniang_mourning', 23: 'servant/xue_meipo',
};

// ---------- 启动 ----------
boot();
async function boot() {
  await loadAssets();
  renderTitle();
}

// ---------- 标题画面 ----------
function renderTitle() {
  clear(app);
  const t = el('div', 'title-screen');
  const cover = el('div', 'title-cover');
  const cu = coverURL();
  if (cu) cover.style.backgroundImage = `url(${cu})`;
  else Object.assign(cover.style, compoundStyle('cover'));
  const side = el('div', 'title-side');
  const logo = el('div', 'title-logo');
  logo.appendChild(el('h1', '', TEXT.title));
  logo.appendChild(el('div', 'sub', TEXT.subtitle));
  side.appendChild(logo);
  side.appendChild(el('div', 'title-intro', TEXT.intro.join('\n')));
  const btns = el('div', 'title-btns');
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  const bCont = el('button', 'big-btn', TEXT.btn.cont);
  bCont.id = 'btn-continue';
  bCont.disabled = !hasSave;
  bCont.addEventListener('click', () => {
    const loaded = E.deserialize(localStorage.getItem(SAVE_KEY));
    if (loaded) startGame(loaded);
    else toast(app, '旧账已不可读。');
  });
  const bStart = el('button', 'big-btn primary', TEXT.btn.start);
  bStart.id = 'btn-start';
  bStart.addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); startGame(E.newGame(SEED)); });
  const bHow = el('button', 'big-btn', TEXT.btn.howto);
  bHow.id = 'btn-howto';
  bHow.addEventListener('click', () => {
    // 紧凑版先给,深读折进「细说规矩」——不发词典,愿意细看的自己翻
    const wrap = el('div');
    wrap.appendChild(el('div', 'howto-list', TEXT.howto.join('\n')));
    const more = el('button', 'howto-more', TEXT.howtoMore);
    const deep = el('div', 'howto-list howto-deep', TEXT.howtoDeep.join('\n'));
    deep.style.display = 'none';
    more.addEventListener('click', () => {
      const open = deep.style.display === 'none';
      deep.style.display = open ? '' : 'none';
      more.textContent = open ? '收起规矩' : TEXT.howtoMore;
    });
    wrap.append(more, deep);
    showModal(app, {
      id: 'modal-help', title: TEXT.btn.howto, wide: true,
      body: wrap,
      choices: [{ id: 'ok', text: TEXT.btn.howtoClose }],
      onPick: () => closeModal(app),
    });
  });
  btns.append(bCont, bStart, bHow);
  side.appendChild(btns);
  side.appendChild(el('div', 'title-seed', `种子 ${SEED} · 明代绣像风 · 约莫半个至一个时辰`));
  side.appendChild(el('div', 'title-rating', TEXT.rating));
  t.append(cover, side);
  app.appendChild(t);
}

// ---------- 开局 ----------
function startGame(loaded) {
  state = loaded;
  buildStage();
  compound.setAct(actKey());
  renderAll();
  showEvent();
}

function actKey() {
  return `act${E.festivalDef(state).act}`;
}

// ---------- 舞台搭建 ----------
function buildStage() {
  clear(app);
  const wrap = el('div', 'stage-wrap');
  const stage = el('div');
  stage.id = 'stage';
  compound = createCompound(stage);
  // 顶部:节令 + 风声 + 静音开关
  els.banner = el('div', 'fest-banner');
  els.wind = el('div', 'wind-seal');
  els.mute = el('button', 'mute-btn', audio.muted ? '默' : '音');
  els.mute.id = 'btn-mute';
  els.mute.title = '音效开关';
  els.mute.addEventListener('click', () => {
    audio.unlock();
    els.mute.textContent = audio.toggleMuted() ? '默' : '音';
  });
  // 屏顶北极星条:左榜位、中目标、右暗账——开局就把终局说破
  els.north = el('div', 'northstar');
  // 右上:金色排行榜;左下:墨色暗账
  els.lb = el('div', 'leaderboard');
  els.an = el('div', 'anledger');
  // 传闻与谋算
  els.schemeTray = el('div', 'scheme-tray');
  els.rumorTray = el('div', 'rumor-tray');
  // 底部行动栏
  els.bar = el('div', 'actionbar');
  // 浮字层
  els.floats = el('div', 'float-layer');
  stage.append(els.banner, els.wind, els.mute, els.north, els.lb, els.an, els.schemeTray, els.rumorTray, els.bar, els.floats);
  wrap.appendChild(stage);
  app.appendChild(wrap);
  els.stage = stage;
  // 关系徽记:点开一张关系卡(事件委托,徽记每次 render 重建也不丢)
  stage.addEventListener('click', (e) => {
    const pip = e.target.closest?.('.rel-pip');
    if (pip) openRelCard(pip.dataset.house);
  });
}

// ---------- 关系卡:玩家自己知道的那本小账 ----------
// 只摆玩家已知量:情分档位、人情、妆台上那支钗。对手的真实态度一个字都不读。
function openRelCard(id) {
  const def = TEXT.relCards[id];
  if (!def || state.over) return;
  audio.sfx('paper');
  const q = state.player.qing?.[id] ?? 0;
  const rq = state.player.renqing?.[id] ?? 0;
  const isX = id === 'ximen';
  const tierIdx = isX ? (q >= 80 ? 3 : q >= 50 ? 2 : q >= 20 ? 1 : 0)
    : ((q + rq) >= 50 ? 3 : (q + rq) >= 20 ? 2 : (q + rq) >= 1 ? 1 : 0);
  const lines = el('div', 'rel-lines');
  lines.appendChild(el('div', 'rel-tier', (isX ? TEXT.ui.relTierX : TEXT.ui.relTierR)[tierIdx]));
  lines.appendChild(el('div', '', def.tiers[tierIdx]));
  if (tierIdx === 0) {
    // 生分档:露骨项灰化,提示用角色声口,不用系统腔
    lines.appendChild(el('div', 'dim', isX ? '他还没把心交给你。再走近些。' : '她还没把你算进她的局。常来常往，才有下文。'));
  }
  if (rq > 0) lines.appendChild(el('div', 'dim', `她欠你的人情:${rq}`));
  if (id === 'pan' && state.flags.panChai) lines.appendChild(el('div', 'dim', '她的钗还插在你妆台上。这笔债，她记着呢。'));
  if (id === 'pan') {
    // 梁子是玩家自己的过节流水账:亲眼所见的才记,她的真实敌意一个字不漏
    const lz = state.player.liangzi?.pan ?? 0;
    if (lz > 0) lines.appendChild(el('div', 'dim', `你和她结下的梁子:${lz} 桩。满三桩，她就要当着人发难。`));
    if (state.flags.panShamed && state.festival - state.flags.panShamed <= 1) {
      lines.appendChild(el('div', 'dim', '席上那一仗，她还没缓过来。'));
    }
  }
  showModal(app, {
    id: 'modal-rel', title: def.name, sub: TEXT.rivals[id]?.house ?? '',
    body: lines,
    portrait: { src: portraitURL(relPortraitKey(id), def.name) },
    choices: [{ id: 'ok', text: TEXT.btn.howtoClose }],
    onPick: () => closeModal(app),
  });
}

function relPortraitKey(id) {
  const mourning = state.festival >= 19;
  const map = {
    yue: ['portrait/wu_yueniang', 'portrait/wu_yueniang_mourning'],
    lijiaoer: ['portrait/li_jiaoer', 'portrait/li_jiaoer'],
    xuee: ['portrait/sun_xuee', 'portrait/sun_xuee_mourning'],
    pan: ['portrait/pan_jinlian', 'portrait/pan_jinlian_mourning'],
    pinger: ['portrait/li_pinger', 'portrait/li_pinger'],
    chunmei: ['portrait/pang_chunmei', 'portrait/pang_chunmei_madam'], // 她不穿孝,她高升了
    ximen: ['portrait/ximen_qing', 'portrait/ximen_qing'],
  };
  const pair = map[id] ?? map.yue;
  return mourning ? pair[1] : pair[0];
}

// ---------- 全量渲染 ----------
function renderAll() {
  audio.playBGM(sceneFor());
  renderBanner();
  renderWind();
  renderNorthstar();
  renderLeaderboard();
  renderAnledger();
  renderRumors();
  renderSchemes();
  renderBar();
  compound.render(state, E.mingDead(state));
  drainFloats();
}

// 结算浮字:数字之外带一个具体画面——账是数,也是屋里发生的事。
// 选句按(节令+序位)定选,确定性,不走 RNG 流。
const FLOAT_FLAIR = {
  '宠': ['他今夜多问了句你的起居', '他记着你说过的那句话', '他叫人把你爱吃的送了来', '他的眼风在你脸上多停了一息'],
  '体面': ['满桌都听见了你的名字', '有人把这件事记下了', '你的座次，又往前挪了挪'],
  '私房': ['锁片又扣紧了一齿', '这一笔，只有你自己知道'],
};
function drainFloats() {
  if (state.floats.length) {
    const raw = state.floats.splice(0);
    const kinds = new Set(raw.map((f) => f.k));
    const floats = raw.map((f, i) => {
      const m = f.t.match(/^([+-])(\d+) (.+)$/);
      if (!m || m[1] !== '+') return f;
      const pool = FLOAT_FLAIR[m[3]];
      if (!pool) return f;
      return { ...f, t: `${f.t} · ${pool[(state.festival * 3 + i) % pool.length]}` };
    });
    spawnFloats(els.floats, floats);
    // 三色通感:金=清亮金属音,墨=闷木音,朱=擦弦音
    if (kinds.has('gold')) audio.sfx('ming');
    if (kinds.has('ink')) audio.sfx('an');
    if (kinds.has('red')) audio.sfx('wind');
  }
}

function renderBanner() {
  const ev = E.festivalDef(state);
  clear(els.banner);
  els.banner.appendChild(el('div', 'fest-name', `${ev.name}`));
  els.banner.appendChild(el('div', 'fest-chapter', `${ev.chapter} · 第${ev.n}令`));
  els.banner.appendChild(el('div', 'fest-act', TEXT.ui[`act${ev.act}`]));
  const old = els.stage.querySelector('.jinzu-banner');
  old?.remove();
  if (state.player.jinzu > 0 && state.phase === 'actions') {
    els.stage.appendChild(el('div', 'jinzu-banner', TEXT.ui.jinzu));
  }
}

function renderWind() {
  clear(els.wind);
  const w = state.player.fengsheng;
  els.wind.classList.toggle('hot', w >= 60);
  els.wind.appendChild(el('div', 'wind-stamp', '风'));
  els.wind.appendChild(el('div', 'wind-num', `${w}`));
}

// 北极星条(常驻屏顶):榜位在左,白话目标在中,私房与退路在右。
// 暗账终局开局就明示——79 回清零是「早说过」,不是「被耍」。
function renderNorthstar() {
  clear(els.north);
  const p = state.player;
  let left;
  if (E.mingDead(state)) {
    left = TEXT.ui.northBoardGone;
  } else {
    const lb = E.leaderboard(state);
    const me = lb.find((r) => r.you);
    left = `${TEXT.ui.northBoard} 第${me?.rank ?? '—'}/${lb.length}`;
  }
  const right = `私房 ${p.sifang} · 退路 ${p.tuilu.length ? p.tuilu.map((t) => TUILU[t].name).join('、') : '无'}`;
  els.north.appendChild(el('span', 'ns-left', left));
  els.north.appendChild(el('span', 'ns-goal', E.mingDead(state) ? TEXT.ui.northGoalDead : TEXT.ui.northGoal));
  els.north.appendChild(el('span', 'ns-right', right));
}

let lastRanks = {}; // 位次记忆:变动的那一块木牌要翻,不是数字跳
function renderLeaderboard() {
  clear(els.lb);
  if (E.mingDead(state)) { els.lb.style.display = 'none'; return; }
  els.lb.style.display = '';
  els.lb.appendChild(el('div', 'lb-title', TEXT.ui.leaderboard));
  const ranks = {};
  for (const row of E.leaderboard(state)) {
    const r = el('div', `lb-row${row.you ? ' you' : ''}`);
    r.dataset.house = row.id;
    if (lastRanks[row.id] !== undefined && lastRanks[row.id] !== row.rank) r.classList.add('plank-flip');
    r.appendChild(el('span', 'lb-rank', `${row.rank}`));
    r.appendChild(el('span', 'lb-name', row.name));
    r.appendChild(el('span', 'lb-score', `${row.score}`));
    els.lb.appendChild(r);
    ranks[row.id] = row.rank;
  }
  lastRanks = ranks;
}

function renderAnledger(fullscreenLines = null) {
  const p = state.player;
  if (fullscreenLines) {
    clear(els.an);
    els.an.className = 'anledger fullscreen open';
    const body = el('div', 'an-body');
    const lines = el('div', 'an-fs-lines');
    lines.appendChild(el('div', '', `私房 ${p.sifang} 两`));
    for (const [who, v] of Object.entries(p.renqing)) {
      if (v > 0) lines.appendChild(el('div', 'dim', `${TEXT.rivals[who]?.name ?? who} 欠你人情 ${v}`));
    }
    for (const t of p.tuilu) lines.appendChild(el('div', '', `退路 · ${TUILU[t].name}`));
    if (!p.tuilu.length) lines.appendChild(el('div', 'dim', '退路 · 无'));
    if (p.hao > 0) lines.appendChild(el('div', 'dim', `耗 · ${haoText(p.hao)}`));
    body.appendChild(lines);
    els.an.appendChild(body);
    return;
  }
  els.an.className = `anledger${els.an.classList.contains('open') ? ' open' : ''}`;
  clear(els.an);
  const head = el('div', 'an-head');
  head.appendChild(el('span', '', `暗账 · 私房 ${p.sifang} 两`));
  head.appendChild(el('span', '', els.an.classList.contains('open') ? '合' : '开'));
  head.addEventListener('click', () => {
    const opening = !els.an.classList.contains('open');
    els.an.classList.toggle('open');
    renderAnledger();
    if (opening) {
      // 线装账册翻页:展开时,账页从订线处翻开
      audio.sfx('paper');
      els.an.querySelector('.an-body')?.classList.add('page-flip');
    } else {
      els.an.classList.add('shutting');
      setTimeout(() => els.an.classList.remove('shutting'), 400);
    }
  });
  els.an.appendChild(head);
  const body = el('div', 'an-body');
  const rq = Object.entries(p.renqing).filter(([, v]) => v > 0);
  body.appendChild(anRow('私房', `${p.sifang} 两`));
  if (state.player.gongzhong > 0) body.appendChild(anRow(TEXT.ui.gongzhong, `${p.gongzhong} 两`));
  if (rq.length) {
    body.appendChild(el('div', 'an-sub', '人情'));
    for (const [who, v] of rq) body.appendChild(anRow(`　${TEXT.rivals[who]?.name ?? who}`, `${v}`, 'an-sub'));
  }
  body.appendChild(anRow('退路', p.tuilu.length ? p.tuilu.map((t) => TUILU[t].name).join('、') : '无'));
  if (p.hao > 0) body.appendChild(anRow('耗', haoText(p.hao), 'an-row hao'));
  body.appendChild(el('div', 'an-hint', '不上榜,不给总分。散场时只清算这本。'));
  els.an.appendChild(body);
}
// 耗不用数字示人——它不是账面上的数,是身上的亏
function haoText(h) {
  if (h >= 85) return '沉疴';
  if (h >= 55) return '亏损';
  if (h >= 25) return '有亏';
  return '尚可';
}
// 争夜旁的身体条:四格四档(尚可/有亏/亏损/沉疴),只给成色,不给数字
function haoMeter() {
  const h = state.player.hao;
  const lit = h >= 85 ? 4 : h >= 55 ? 3 : h >= 25 ? 2 : 1;
  const m = el('div', 'hao-meter');
  m.title = `身子:${haoText(h)}`;
  for (let i = 0; i < 4; i++) m.appendChild(el('span', `hm-cell${i < lit ? ' on' : ''}${lit >= 3 ? ' bad' : ''}`));
  return m;
}
function anRow(k, v, cls = 'an-row') {
  const r = el('div', cls);
  r.appendChild(el('span', '', k));
  r.appendChild(el('span', 'v', v));
  return r;
}

function renderRumors() {
  clear(els.rumorTray);
  const rs = [...state.rumors].reverse().slice(0, 8);
  if (!rs.length) return;
  for (const r of rs) {
    const card = el('div', `rumor-card${r.verified === true ? ' verified-true' : r.verified === false ? ' verified-false' : ''}`);
    const src = el('div', 'rc-src');
    src.appendChild(el('span', '', `${TEXT.servants[r.servant]?.name ?? r.servant} 说`));
    src.appendChild(el('span', 'rc-cred', TEXT.ui.cred[r.cred]));
    card.appendChild(src);
    card.appendChild(el('div', 'rc-text', r.text));
    if (r.verified === null && state.phase === 'actions' && state.ap > 0 && !E.mingDead(state)) {
      const b = el('button', 'rc-verify', TEXT.ui.verify);
      b.dataset.verify = r.id;
      b.addEventListener('click', () => doAction({ type: 'verify', rumorId: r.id }));
      card.appendChild(b);
    }
    if (r.verified === false) card.appendChild(el('span', 'wang', '妄'));
    if (r.verified === true) card.appendChild(el('span', 'rc-cred', TEXT.ui.verifiedTrue));
    els.rumorTray.appendChild(card);
  }
}

function renderSchemes() {
  clear(els.schemeTray);
  for (const s of state.schemes) {
    const def = SCHEMES[s.key];
    const t = state.rivals[s.target];
    const card = el('div', 'scheme-card');
    card.appendChild(el('div', 'sc-name', `${def.name} · 对${t.name}`));
    const bar = el('div', 'sc-bar');
    bar.appendChild(el('div', 'sc-fill')).style.width = `${s.progress}%`;
    card.appendChild(bar);
    card.appendChild(el('div', 'sc-info',
      `${TEXT.ui.informers}:${s.informers.map((x) => TEXT.servants[x]?.name ?? x).join('、') || '无'}`));
    els.schemeTray.appendChild(card);
  }
}

// ---------- 行动栏 ----------
// 首回合手把手:同时点亮「结」与「藏」——一只手往上争(会看见),一只手往下藏(散场才认)。
// 压暗只是视觉引导,印章仍然可用;教学藏在后果里,第一笔落定再点破。
const coachNow = () => state && state.festival === 1 && state.phase === 'actions' && state.ap === 3 && !state.over;
function renderBar() {
  clear(els.bar);
  els.floats?.querySelector('.coach-line')?.remove();
  const inActions = state.phase === 'actions' && !state.over;
  const ap = state.ap;
  const dots = el('div', 'ap-dots');
  for (let i = 0; i < 3; i++) dots.appendChild(el('span', `ap-dot${i < ap ? ' on' : ''}`));
  els.bar.appendChild(dots);
  const defs = [
    ['tan', '探', '买传闻'], ['jie', '结', '送礼'], ['ye', '夜', '争夜'],
    ['mou', '谋', '起谋算'], ['chi', '持', '担差事'], ['cang', '藏', '存退路'],
  ];
  const coaching = coachNow();
  for (const [type, char, label] of defs) {
    const b = sealButton(char, label, () => openSub(type));
    b.dataset.seal = type;
    b.disabled = !inActions || ap <= 0 || (type === 'mou' && !state.flags.mou)
      || (type === 'ye' && (E.mingDead(state) || state.yeTonight || state.player.sifang < YE_COST));
    if (type === 'mou' && !state.flags.mou) b.title = '还不到用谋的时候。先学做人，再学用谋。';
    if (type === 'ye') {
      if (E.mingDead(state)) b.title = '明账已清，灯无人可争';
      else if (state.yeTonight) b.title = '今夜已布置下了';
      else if (state.player.sifang < YE_COST) b.title = '置办这桌酒菜头面要六十两，你的私房还凑不齐';
    }
    if (coaching) b.classList.add(type === 'jie' || type === 'cang' ? 'coach-on' : 'coach-dim');
    if (type === 'ye') {
      // 耗改半可见:争夜旁一条身体条,沿用四档声口,不给数字
      const wrap = el('div', 'ye-wrap');
      wrap.appendChild(b);
      wrap.appendChild(haoMeter());
      els.bar.appendChild(wrap);
    } else {
      els.bar.appendChild(b);
    }
  }
  if (coaching) els.floats.appendChild(el('div', 'coach-line', TEXT.ui.coachLine));
  const sub = el('button', 'submit-btn', TEXT.btn.submit);
  sub.id = 'btn-submit';
  sub.disabled = state.over || state.phase !== 'actions';
  sub.addEventListener('click', doSubmit);
  els.bar.appendChild(sub);
}

// ---------- 行动子面板 ----------
let subSel = {};
function openSub(type) {
  closeSub();
  subSel = {};
  // 子面板与首回合手把手卡占同一片区,打开时先收起手把手,避免重叠
  els.floats?.querySelector('.coach-line')?.classList.add('coach-hidden');
  els.bar.querySelector(`[data-seal="${type}"]`)?.classList.add('active');
  const panel = el('div', 'subpanel');
  panel.id = 'subpanel';
  const rows = [];
  const pickRow = (label, options, key) => {
    const row = el('div', 'sub-row');
    row.appendChild(el('span', 'sub-label', label));
    for (const o of options) {
      const b = el('button', 'pick-btn', o.text);
      b.dataset.pick = `${key}:${o.id}`;
      if (o.disabled) { b.disabled = true; b.title = o.reason ?? ''; }
      b.addEventListener('click', () => {
        subSel[key] = o.id;
        row.querySelectorAll('.pick-btn').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        if (key === 'scheme' && o.id === 'zuoshi') pickZuoshiRumor(panel);
        if (key === 'target') compound?.setFocus(o.id); // 被针对的那一房高亮前推
        if (key === 'lu') panel.querySelectorAll('.jie-open').forEach((r) => { r.style.display = o.id === 'si' ? 'none' : ''; });
      });
      row.appendChild(b);
    }
    return row;
  };
  const rivalOpts = (filterDead = true) =>
    Object.values(state.rivals)
      .filter((r) => r.joined && (!filterDead || r.alive))
      .map((r) => ({ id: r.id, text: r.name }));

  let title = '';
  if (type === 'ye') {
    title = '夜 · 争夜';
    rows.push(el('div', 'sub-note', TEXT.ui.yeDesc));
    rows.push(el('div', 'sub-note dim', TEXT.ui.yeWarn));
  } else if (type === 'tan') {
    title = `${TEXT.ui.chooseServant} · ${TEXT.ui.chooseTarget}`;
    rows.push(pickRow('仆役', Object.entries(SERVANTS).map(([id, s]) => ({
      id, text: `${TEXT.servants[id].name}${s.price ? ` ${s.price}两` : ' 不收钱'}`,
      disabled: state.player.sifang < s.price, reason: '线钱还凑不齐',
    })), 'servant'));
    rows.push(pickRow('对象', rivalOpts(), 'target'));
  } else if (type === 'jie') {
    title = '结 · 送礼应酬';
    rows.push(pickRow(TEXT.ui.luLabel, [
      { id: 'open', text: TEXT.ui.luOpen },
      {
        id: 'si', text: TEXT.ui.luPrivate,
        disabled: E.mingDead(state) || state.shiTonight || state.player.sifang < 40,
        reason: E.mingDead(state) ? '明账已清，示意也递不到他手里' : state.shiTonight ? '本令已递过一份了' : '备这份东西要四十两，你的私房还凑不齐',
      },
    ], 'lu'));
    // 路数选「私」时,对象/礼/银出三行与这一记无关,藏起来免得误读
    for (const r of [
      pickRow('对象', [{ id: 'ximen', text: '家主' }, ...rivalOpts()], 'target'),
      pickRow('礼', [{ id: 'small', text: TEXT.ui.giftSmall }, { id: 'big', text: TEXT.ui.giftBig }], 'size'),
      pickRow('银出', [
        { id: 'si', text: TEXT.ui.fundSi },
        { id: 'gong', text: TEXT.ui.fundGong, disabled: !state.player.duty, reason: '不曾担差事，动不了公中' },
      ], 'fund'),
    ]) {
      r.classList.add('jie-open');
      rows.push(r);
    }
    rows.push(el('div', 'sub-note dim', TEXT.ui.shiDesc));
  } else if (type === 'mou') {
    title = TEXT.ui.chooseScheme;
    rows.push(pickRow('谋算', Object.entries(SCHEMES).map(([id, s]) => ({ id, text: s.name })), 'scheme'));
    rows.push(pickRow('对象', rivalOpts(), 'target'));
  } else if (type === 'chi') {
    title = TEXT.ui.chooseDuty;
    const rank = E.playerRank(state);
    rows.push(pickRow('差事', Object.entries(DUTIES).map(([id, d]) => ({
      id, text: `${TEXT.ui.dutyNames[id]}(+${d.tiyan}体面 公中${d.gong})`,
      disabled: rank !== null && rank >= 5 && id !== 'puzhang',
      reason: '位次靠后，好差事轮不到你',
    })), 'duty'));
    rows.push(el('div', 'sub-note', '担差事耗 2 行动;该令若出事,你是第一责任人。'));
  } else if (type === 'cang') {
    title = TEXT.ui.chooseCang;
    rows.push(pickRow('藏', [
      { id: 'save', text: TEXT.ui.cangSave },
      { id: 'help', text: `${TEXT.ui.cangHelp}(40两)` },
      { id: 'tuilu', text: TEXT.ui.cangTuilu },
    ], 'mode'));
    rows.push(pickRow('对象', rivalOpts(), 'target'));
    rows.push(pickRow('退路', Object.entries(TUILU).map(([id, t]) => ({
      id, text: `${t.name} ${E.tuiluCost(state, id)}两`,
      disabled: state.festival < t.open || state.player.tuilu.includes(id) || state.player.sifang < E.tuiluCost(state, id),
      reason: state.festival < t.open ? `第${t.open}令才开` : state.player.tuilu.includes(id) ? '这条路已在你手里' : '银子还凑不齐',
    })), 'line'));
  }
  panel.appendChild(el('div', 'sub-title', title));
  rows.forEach((r) => panel.appendChild(r));
  const actions = el('div', 'sub-actions');
  const bCancel = el('button', 'pick-btn', TEXT.btn.cancel);
  bCancel.addEventListener('click', closeSub);
  const bOk = el('button', 'pick-btn sel', TEXT.btn.confirm);
  bOk.id = 'btn-sub-confirm';
  bOk.addEventListener('click', () => confirmSub(type));
  actions.append(bCancel, bOk);
  panel.appendChild(actions);
  els.stage.appendChild(panel);
}

function pickZuoshiRumor(panel) {
  // 坐实传闻:自动附上该房第一条已证实传闻
  const t = subSel.target;
  if (!t) return;
  const r = state.rumors.find((x) => x.target === t && x.verified === true);
  subSel.rumorId = r?.id ?? null;
}

function closeSub() {
  els.stage?.querySelector('#subpanel')?.remove();
  els.floats?.querySelector('.coach-line')?.classList.remove('coach-hidden'); // 关闭子面板后若仍在首回合恢复手把手
  els.bar?.querySelectorAll('.seal-btn.active').forEach((b) => b.classList.remove('active'));
  compound?.setFocus(null);
}

function confirmSub(type) {
  let a = null;
  if (type === 'ye') a = { type: 'ye' };
  if (type === 'tan') a = { type, servant: subSel.servant, target: subSel.target };
  if (type === 'jie') {
    // 路数「私」:不拣对象与礼,直接成一记「结·私」
    a = subSel.lu === 'si'
      ? { type: 'shi' }
      : { type, target: subSel.target, size: subSel.size ?? 'small', fund: subSel.fund ?? 'si' };
  }
  if (type === 'mou') {
    if (!subSel.scheme || !subSel.target) { toast(app, '话还没说全，拣齐了再定。'); return; }
    a = { type, scheme: subSel.scheme, target: subSel.target };
    if (subSel.scheme === 'zuoshi') {
      pickZuoshiRumor(els.stage.querySelector('#subpanel'));
      a.rumorId = subSel.rumorId;
    }
  }
  if (type === 'chi') a = { type, duty: subSel.duty };
  if (type === 'cang') {
    if (subSel.mode === 'help') a = { type, mode: 'help', target: subSel.target };
    else if (subSel.mode === 'tuilu') a = { type, mode: 'tuilu', line: subSel.line };
    else a = { type, mode: 'save' };
  }
  if (!a || Object.values(a).some((v) => v === undefined)) {
    toast(app, '话还没说全，拣齐了再定。');
    return;
  }
  doAction(a);
  closeSub();
}

// 首回合的「后果教学」:第一笔落定才点破,且每类只说一次(纯界面记忆,不进存档)
const coachShown = new Set();
function coachToast(type) {
  if (state.festival !== 1 || coachShown.has(type)) return;
  coachShown.add(type);
  if (type === 'jie' || type === 'shi') toast(app, '礼递进去了。满宅的眼睛，都记下了你这一笔。', 3600);
  else if (type === 'cang') toast(app, '这一笔没人看见。散场那天，只认它。', 3600);
}

function doAction(a) {
  const r = E.applyAction(state, a);
  if (!r.ok) { toast(app, r.msg); return; }
  if (a.type === 'tan') audio.sfx('paper');
  else if (a.type === 'shi' && r.seen) toast(app, '这份心意,叫旁人瞧见了。');
  else if (a.type === 'verify') {
    audio.sfx(r.rumor?.verified === false ? 'wang' : 'paper');
    toast(app, r.rumor.verified ? '查实了:这话不假。' : '查实了:是假话。');
  } else if (a.type === 'mou') audio.sfx('mou', { progress: r.scheme?.progress });
  else audio.sfx('click');
  coachToast(a.type);
  renderAll();
  echoFor(a);
  save();
  if (a.type === 'ye') showYeRivals();
}

// 争夜赛局播报:布置落定、提交之前,看一眼今夜也在争的人。
// 只定性不定量——榜上的分明人人看得见,这里只写成灯;春梅不上榜,她的斤两一个字不露。
// 全部派生自玩家可见量(排行榜 ming 与各房脾性),不走 RNG,不碰 state.rng。
function showYeRivals() {
  const lines = el('div');
  lines.appendChild(el('div', '', '你院里，灯烛头面都备下了。'));
  for (const r of Object.values(state.rivals)) {
    if (!r.joined || !r.alive || r.offBoard) continue; // 不上榜的人,提都不提
    const w = (YE_WEIGHT[r.id] ?? 4) + (r.id === 'lijiaoer' ? 0 : r.ming * 0.1);
    const t = w >= 20 ? `${r.name}院里也点了灯，备得比你还早。`
      : w >= 8 ? `${r.name}院里留着灯，可争可不争。`
      : `${r.name}院里黑得早，今夜想来不争。`;
    lines.appendChild(el('div', '', t));
  }
  lines.appendChild(el('div', 'dim', '还有些人不上榜，灯却也点着。她们的斤两，你看不见。'));
  showModal(app, {
    id: 'modal-ye-rivals', title: '今夜也在争的人', sub: '只看得见灯，看不见斤两',
    body: lines,
    choices: [{ id: 'ok', text: '各凭本事' }],
    onPick: () => closeModal(app),
  });
}

// 行动的即时世情反馈:浮字给数值,短句给意义。
// 选句按(节令×行动序×传闻数)定选——确定性,不走 RNG 流,不破坏逐字节可复现。
function echoFor(a) {
  const pool = ACTION_ECHO[a.type];
  if (!pool) return;
  els.floats.querySelectorAll('.echo-line').forEach((n) => n.remove()); // 一句说完再一句
  const idx = (state.festival * 5 + (3 - state.ap) * 2 + state.rumorSeq) % pool.length;
  const n = el('div', 'echo-line', pool[idx]);
  els.floats.appendChild(n);
  setTimeout(() => n.remove(), FAST ? 700 : 2900);
}

// ---------- 留宿定格:全作招牌镜头 ----------
// 画面压暗,只中签那一房的窗透暖光;赢时帐幔剪影落下。
// 输时反打:你的窗黑着,别处的笑语隔着几进院子传来。潘金莲的夜,亮得最久。
// 台词按 seedRNG 抽取——取种子流的副本抽,不消耗游戏的随机流,逐字节可复现不受影响。
function playLodgingScene(rep) {
  const l = rep.lodging;
  if (!l || E.mingDead(state)) return Promise.resolve();
  const kind = l.house === 'player' ? (l.ye === true ? 'yewin' : 'win')
    : l.pan ? 'pan'
    : l.ye === 'fail' ? 'fail' : 'lose';
  const rngCopy = { a: state.rng.a };
  const line = pick(rngCopy, LODGING_SCENES[kind]);
  const won = kind === 'win' || kind === 'yewin';
  const sc = el('div', `lodging-scene ls-${kind}`);
  sc.dataset.house = l.house;
  sc.dataset.kind = kind;
  const a = compound.ROOMS[l.house] ?? compound.ROOMS.yue;
  const spot = el('div', 'ls-spot');
  spot.style.left = `${a.x}%`;
  spot.style.top = `${a.y - 10}%`;
  sc.append(el('div', 'ls-dim'), spot);
  if (won) {
    // 帐幔落下:剪影从上垂落
    const cur = el('div', 'ls-curtain');
    cur.style.left = `${a.x}%`;
    cur.style.top = `${a.y - 30}%`;
    sc.appendChild(cur);
  }
  sc.appendChild(el('div', 'ls-line', line));
  if (won) {
    // 玩家主动争到的夜,按情分档叠一层戏(生分/暧昧/亲密/独宠·露骨)。
    // 读的是玩家自己攒的 qing.ximen;副本加盐与定格台词错开,主流一下不动。
    const tier = intimacyTier(state.player.qing?.ximen ?? 0);
    const rc = { a: (state.rng.a ^ 0x9e3779b9) | 0 };
    sc.appendChild(el('div', `ls-intimacy ls-int-${tier}`, pick(rc, INTIMACY[tier])));
    sc.classList.add('ls-has-intimacy');
  }
  els.stage.appendChild(sc);
  audio.sfx('watch'); // 更漏两声,夜里最清楚
  return new Promise((resolve) => {
    requestAnimationFrame(() => sc.classList.add('on'));
    // 招牌场面:定格时长按台词总长给足(露骨档的长段不再一闪而过),并可点一下继续,
    // 让玩家自己掌节奏;fast 模式压缩但保留可观察节拍。
    const textLen = line.length + (sc.querySelector('.ls-intimacy')?.textContent.length ?? 0);
    const hold = FAST ? 420 : Math.min(13000, Math.max(kind === 'pan' ? 4600 : 3600, 2400 + textLen * 95));
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(timer);
      sc.removeEventListener('click', finish);
      sc.classList.add('done');
      setTimeout(resolve, FAST ? 60 : 700);
    };
    if (!FAST) {
      sc.classList.add('clickable');
      setTimeout(() => { if (!done) sc.appendChild(el('div', 'ls-more', '点一下继续')); }, 1500);
      sc.addEventListener('click', finish);
    }
    const timer = setTimeout(finish, hold);
  });
}

// ---------- 亲密微选择:灯落你院,帐内还有一步怎么走 ----------
// 只在 UI 层:不进 headless,不抽 state.rng,不插既有 action 的抽取顺序。
// 改写的是引擎状态(事后情分、次日别房的醋意),不是 DOM;下一令世界自有回响。
// 进攻过快则情分回落一档,下一场重新灰化——把够不着的欲望摆出来。
function showIntimacyChoice() {
  return new Promise((resolve) => {
    const q = state.player.qing?.ximen ?? 0;
    const tier = intimacyTier(q);
    const body = el('div');
    body.appendChild(el('div', '', '他在你屋里，更漏滴得慢。这一夜怎么走，你拿主意。'));
    if (tier === 'sheng') body.appendChild(el('div', 'dim', '他还没允许你走这么近。急了，情分要退。'));
    // 次日别房的醋意落在谁身上:潘金莲在宅必是她,否则取榜上最靠前那房(榜本就可见)
    const envyTarget = () => {
      const pan = state.rivals.pan;
      if (pan?.joined && pan.alive) return pan;
      const top = E.leaderboard(state).find((r) => !r.you);
      return top ? state.rivals[top.id] : null;
    };
    showModal(app, {
      id: 'modal-intimacy', title: '帐幔落下了', sub: '灯落你院',
      body,
      choices: [
        { id: 'jin', text: '你来掌灯', hint: tier === 'sheng' ? '他还没允许你走这么近' : '主导这一夜 · 别房要眼红' },
        { id: 'tui', text: '由他自己来', hint: '顺势，不露头' },
        { id: 'kou', text: '套他一句口风', hint: '枕畔的话最真' },
      ],
      onPick: (id) => {
        const p = state.player;
        let out = '';
        if (id === 'jin') {
          if (q < 20) {
            p.qing.ximen = Math.max(0, q - 3); // 进攻过快:情分回落,下一场重新灰化
            out = '你太急了。手刚抬起来，他笑着按住了你的腕子。帐子里的热乎气，散了一半。';
          } else if (q < 50) {
            p.qing.ximen = Math.min(100, q + 1);
            out = '你抬手把灯芯捻低了一寸。他顺着那点暗靠过来，你没退。这一寸暗，是你给的。';
          } else {
            p.qing.ximen = Math.min(100, q + 3);
            const r = envyTarget();
            if (r) r.hostility += 3; // 醋意涟漪,落在引擎状态上
            out = (q >= 80
              ? '你抬手灭了灯。黑暗里你先抓住他的手腕，把他按进枕里。他喉间那声气音落进你耳中，你便知道，今夜是他输了。烛芯爆了个花。'
              : '你抬手灭了灯。黑暗里是你先抓住他的手腕。他怔了一息，随即便由你摆布。')
              + (r ? `次日请安，${r.name}的眼风在你脸上刮了一下。` : '');
          }
        } else if (id === 'tui') {
          p.qing.ximen = Math.min(100, q + 2);
          out = q >= 80
            ? '你由他来。他的掌心烫，贴上你腰窝时，你咬住唇没出声。帐子里的黑很厚，后来什么都静了，只剩更漏。他睡沉了，你还醒着。'
            : '你由他来。他解你腕上的镯子，解得很慢。镯子落在妆台上，一声轻响，你没去拾。那半寸的靠近，你认了。';
        } else {
          p.qing.ximen = Math.min(100, q + 1);
          const top = E.leaderboard(state).find((r) => !r.you);
          out = top
            ? `事后他靠在你肩上养神。你状似无意问起各房，他漏了一句：「${top.name}院里，近来话多。」你把这句记下了。`
            : '事后他靠在你肩上养神。你问起各房，他只笑了笑。这一夜的话，到枕畔为止。';
        }
        closeModal(app);
        toast(app, out, 4600);
        renderAll();
        save();
        resolve();
      },
    });
  });
}

// ---------- 提交节令 ----------
async function doSubmit() {
  closeSub();
  els.stage.querySelector('.lodging-scene')?.remove();
  els.bar.querySelector('#btn-submit').disabled = true;
  audio.sfx('submit');
  const rep = E.submitTurn(state);
  // 仆役动线先行(情报),再弹账
  if (rep.sightings?.length) await compound.playSightings(rep.sightings, FAST);
  renderAll();
  if (rep.rankBefore && rep.rankAfter && rep.rankBefore !== rep.rankAfter) audio.sfx('plank');
  if (rep.faluo) audio.sfx('faluo');
  // 留宿定格:灯落谁家,这一幕给足
  await playLodgingScene(rep);
  // 灯落你院:定格之后,帐内还有一步怎么走(亲密微选择,只在 UI 层)
  if (rep.lodging?.house === 'player' && !E.mingDead(state)) await showIntimacyChoice();
  await wait(300);
  // 结算不弹窗、不设「继续」:顶部短条按时间轴自动推进,玩家只在需要决策时才点
  if (rep.notes?.length) await showSettleStrip(rep.notes, !!rep.faluo);
  if (rep.reveal) {
    const t = state.rivals[rep.reveal.target];
    toast(app, `截得书信:${t.name}私房里约 ${rep.reveal.si} 两。`);
  }
  save();
  if (state.over) return;
  showEvent();
}

// 顶部滑入短条:逐条亮起,自行熄灭,不阻断画面。
// 停留时长按该句长度给足(长句更久,不再一刀切),点一下可立即翻下一句,由玩家掌节奏。
function showSettleStrip(notes, danger = false) {
  return new Promise((resolve) => {
    const strip = el('div', `settle-strip${danger ? ' danger' : ''}`);
    strip.id = 'settle-strip';
    els.stage.appendChild(strip);
    requestAnimationFrame(() => strip.classList.add('on'));
    let i = 0;
    let timer = null;
    const dwell = (s) => FAST ? 240 : Math.min(6500, 1600 + s.length * 110);
    const tick = () => {
      clearTimeout(timer);
      if (i >= notes.length) {
        strip.removeEventListener('click', advance);
        strip.classList.remove('on');
        setTimeout(() => { strip.remove(); resolve(); }, FAST ? 60 : 450);
        return;
      }
      const line = notes[i++];
      clear(strip);
      strip.appendChild(el('div', 'settle-line', line));
      if (i < notes.length) strip.appendChild(el('div', 'settle-more', '点一下继续'));
      timer = setTimeout(tick, dwell(line));
    };
    const advance = () => { if (!FAST) tick(); };
    if (!FAST) { strip.classList.add('clickable'); strip.addEventListener('click', advance); }
    tick();
  });
}

// ---------- 节令事件 ----------
// 节令转场:每进新节令,一块题签(节令名+回目)滑过,配更漏两声。
// 读档回到同一节令不重播;第79回/结局/收束各有自己的演出,不加题签。
let lastSlip = 0;
function festSlip(ev) {
  if (state.festival === lastSlip) return;
  lastSlip = state.festival;
  els.stage.dataset.festShown = `${state.festival}`;
  const slip = el('div', 'fest-slip');
  slip.appendChild(el('div', 'fs-name', ev.name));
  slip.appendChild(el('div', 'fs-chapter', `${ev.chapter} · 第${ev.n}令`));
  els.stage.appendChild(slip);
  audio.sfx('watch'); // 更漏:节令推进
  requestAnimationFrame(() => slip.classList.add('on'));
  setTimeout(() => {
    slip.classList.remove('on');
    setTimeout(() => slip.remove(), FAST ? 80 : 900);
  }, FAST ? 500 : 2100);
}

function showEvent() {
  save();
  compound.setAct(actKey());
  const ev = state.event;
  if (ev.clear) return clearSequence();
  if (ev.ending) return endingScreen();
  if (ev.epilogue) return epilogueScreen();
  renderAll();
  festSlip(ev);
  // 读档回到行动阶段:事件已定,直接复原画面(顺带修掉重复应用事件效果的老问题)
  if (state.phase !== 'event') {
    if (state.visit) showVisitModal();
    return;
  }
  const choices = (ev.choices ?? []).map((c) => ({
    id: c.id, text: c.text, hint: c.hint,
    disabled: !!E.eventChoiceError(state, c), reason: E.eventChoiceError(state, c),
  }));
  const portraitKey = EVENT_PORTRAIT[ev.n];
  const bodyWrap = el('div');
  bodyWrap.appendChild(el('div', '', ev.intro));
  showModal(app, {
    id: 'modal-event', title: `${ev.name}`, sub: `${ev.chapter}`,
    body: bodyWrap,
    portrait: portraitKey ? { src: portraitURL(portraitKey, '') } : null,
    choices: choices.length ? choices : [{ id: 'ok', text: TEXT.btn.confirm }],
    onPick: (id) => {
      audio.sfx('click');
      if (choices.length) {
        const r = E.applyEventChoice(state, id);
        if (!r.ok) { toast(app, r.msg); return; }
        closeModal(app);
        toast(app, r.choice.result);
      } else {
        E.skipEventIfNoChoice(state);
        closeModal(app);
      }
      renderAll();
      save();
      // 节令中途,有人主动找上门
      if (state.visit) showVisitModal();
    },
  });
}

// ---------- 上门事件:有人站在你门口,要求当场表态 ----------
function showVisitModal() {
  const def = E.visitDef(state);
  if (!def) return;
  audio.sfx('watch'); // 更漏一下,当作叩门
  const choices = def.choices.map((c) => ({
    id: c.id, text: c.text, hint: c.hint,
    disabled: !!E.eventChoiceError(state, c), reason: E.eventChoiceError(state, c),
  }));
  showModal(app, {
    id: 'modal-visit', title: def.title, sub: '有人上门',
    body: def.text,
    portrait: def.portrait ? { src: portraitURL(def.portrait, '') } : null,
    choices,
    onPick: (id) => {
      const r = E.applyVisitChoice(state, id);
      if (!r.ok) { toast(app, r.msg); return; }
      audio.sfx('click');
      closeModal(app);
      // 家主进门的夜,也按情分档叠一层戏(与留宿定格同一套分档)
      const intimate = (def.id === 'ximen_ye' && id === 'open') || (def.id === 'ximen_zui' && id === 'stay');
      if (intimate) {
        const tier = intimacyTier(state.player.qing?.ximen ?? 0);
        const rc = { a: (state.rng.a ^ 0x51ab) | 0 }; // 副本,不动主流
        toast(app, `${r.choice.result}\n${pick(rc, INTIMACY[tier])}`, 4600);
      } else {
        toast(app, r.choice.result, 3200);
      }
      renderAll();
      save();
    },
  });
}

// ---------- 第79回:明账清零演出 ----------
async function clearSequence() {
  renderAll();
  // 音乐在两秒内抽空,静默3-4秒;这段无声不许任何音效盖过
  audio.playClear(() => audio.playBGM('act3'));
  // 清零演出是全作签名场面:即使 fast 模式也保留可观察的最短节拍
  const cw = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 260) : ms));
  const overlay = el('div', 'clear-overlay');
  overlay.id = 'clear-overlay';
  els.stage.appendChild(overlay);
  // 全作最重要的四秒:行动栏、传闻卡、谋算盘、风声全部退场,不许和演出抢注意力
  els.stage.classList.add('in-clearing');
  const lines = [TEXT.clear.title, TEXT.clear.line1, TEXT.clear.line2, TEXT.clear.line3].map((t) => {
    const n = el('div', 'clear-line', t);
    overlay.appendChild(n);
    return n;
  });
  for (const n of lines) { n.classList.add('on'); await cw(1100); }
  // 金色逐项褪色,不是一次消失:体面 → 宠 → 位次,三拍
  const lm = state.flags.lastMing ?? { tiyan: 0, chong: 0, rank: null };
  const beats = [
    `${TEXT.ui.tiyan} ${lm.tiyan}`,
    `${TEXT.ui.chong} ${lm.chong}`,
    `${TEXT.ui.weifen} ${rankText(lm.rank)}`,
  ].map((t) => {
    const n = el('div', 'clear-line gold stat', t);
    overlay.appendChild(n);
    return n;
  });
  for (const b of beats) b.classList.add('on');
  await cw(1400);
  for (const b of beats) {
    b.classList.remove('gold');
    b.classList.add('fadegray');
    b.textContent = '— 熄 —';
    await cw(900);
  }
  await cw(600);
  for (const b of beats) b.classList.remove('on');
  // 灯火逐间熄灭
  compound.lightsOut();
  await cw(2100);
  // 排行榜木牌逐块翻落、掉出画面、不再出现
  const rows = [...els.lb.querySelectorAll('.lb-row')];
  for (const r of rows) { r.classList.add('plank-fall'); await cw(240); }
  els.lb.classList.add('gone');
  // 静默要足够长:木牌落尽之后,什么也不发生,这也是演出的一部分
  await cw(1600);
  overlay.querySelectorAll('.clear-line').forEach((n) => n.classList.remove('on'));
  // 墨色暗账面板从左下角缓慢展开,占满全屏
  renderAnledger(true);
  await cw(2400);
  // 历史最高位次:金字浮出 → 褪灰 → 墨字
  const best = el('div', 'clear-line gold', `${TEXT.ui.historyBest}:${rankText(state.bestRank)}`);
  overlay.appendChild(best);
  best.classList.add('on');
  await cw(1600);
  best.classList.remove('gold');
  best.classList.add('fadegray');
  const zero = el('div', 'clear-line', TEXT.ui.bestUseless);
  overlay.appendChild(zero);
  zero.classList.add('on');
  await cw(2000);
  // 收尾:暗账面板收回角落,进入第三幕
  overlay.remove();
  els.stage.classList.remove('in-clearing');
  compound.clearLights();
  compound.setAct('act3');
  els.an.className = 'anledger open';
  renderAnledger();
  E.skipEventIfNoChoice(state);
  renderAll();
  toast(app, TEXT.clear.anOpen, 3200);
  save();
}

function rankText(r) {
  return ['—', '第一', '第二', '第三', '第四', '第五', '第六'][r] ?? '—';
}

// ---------- 结局 ----------
function endingScreen() {
  renderAll();
  const e = state.ending;
  const def = TEXT.endings[e.key];
  // 结局定格一记磬音;BGM 依分支:李衙内=向上收束,流落=中途停住
  audio.sfx('qing');
  audio.playBGM(e.key === 'liyanei' ? 'ending_liyanei' : e.key === 'liuluo' ? 'ending_liuluo' : 'ending_other');
  const panel = el('div', 'ending-panel');
  panel.appendChild(el('div', 'ending-name', def.name));
  panel.appendChild(el('div', 'ending-line', def.line));
  const stats = el('div', 'ending-stats');
  stats.appendChild(el('div', '', `私房 ${e.sifang} 两 · 退路 ${e.tuilu} 条 · 风声 ${e.wind}`));
  if (e.haoWeak) stats.appendChild(el('div', 'zero', TEXT.ui.haoLine));
  stats.appendChild(el('div', '', `${TEXT.ui.historyBest}:${rankText(e.bestRank)}`));
  stats.appendChild(el('div', 'zero', TEXT.ui.bestUseless));
  panel.appendChild(stats);
  if (def.source) panel.appendChild(el('div', 'ending-src', def.source));
  const root = el('div', `ending-screen ending-${e.key}`);
  root.id = 'ending-root';
  // 定格演出:已有宅院背景 + 滤镜 + 剪影 + 粒子 + 一句题字(粒子摆位确定性,不走随机)
  const scene = el('div', 'ending-scene');
  Object.assign(scene.style, compoundStyle('compound/act3'));
  scene.appendChild(el('div', 'es-veil'));
  scene.appendChild(el('div', `es-sil es-sil-${e.key}`));
  const parts = el('div', 'es-parts');
  for (let i = 0; i < 12; i++) {
    const s = el('span');
    s.style.left = `${(i * 83 + 5) % 97}%`;
    s.style.animationDelay = `${((i * 7) % 11) * 0.6}s`;
    parts.appendChild(s);
  }
  scene.appendChild(parts);
  scene.appendChild(el('div', 'es-tag', def.tag));
  root.appendChild(scene);
  root.appendChild(panel);
  els.stage.appendChild(root);
  const b = el('button', 'big-btn primary', TEXT.btn.next);
  b.id = 'btn-ending-next';
  b.addEventListener('click', () => {
    root.remove();
    E.skipEventIfNoChoice(state);
    save();
    doSubmit();
  });
  panel.appendChild(b);
}

// ---------- 第一百回收束 ----------
function epilogueScreen() {
  renderAll();
  const panel = el('div', 'ending-panel');
  panel.appendChild(el('div', 'ending-name', '第一百回'));
  panel.appendChild(el('div', 'ending-line epilogue-lines', TEXT.epilogue.join('\n')));
  const e = state.ending;
  if (e) {
    const def = TEXT.endings[e.key];
    panel.appendChild(el('div', 'ending-stats', `你的去向：${def.name}`));
  }
  const root = el('div', 'ending-screen');
  root.id = 'epilogue-root';
  root.appendChild(panel);
  els.stage.appendChild(root);
  const b = el('button', 'big-btn primary', TEXT.btn.endingRestart);
  b.id = 'btn-restart';
  b.addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); location.reload(); });
  panel.appendChild(b);
  localStorage.removeItem(SAVE_KEY); // 一局已了
  state.over = true;
}

// ---------- 存读 ----------
function save() {
  if (!state || state.over) return;
  try { localStorage.setItem(SAVE_KEY, E.serialize(state)); } catch { /* 存储不可用时静默 */ }
}

// ---------- QA 钩子 ----------
window.__game = {
  state: () => state,
  phase: () => state?.phase,
  festival: () => state?.festival,
  leaderboard: () => (state ? E.leaderboard(state) : []),
  engine: E,
  seed: SEED,
  fast: FAST,
};
