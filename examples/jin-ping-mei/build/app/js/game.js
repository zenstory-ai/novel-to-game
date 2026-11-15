// 导演：驱动运行时走拍点，把每个拍点交给舞台与界面，再把玩家的输入送回运行时。
// 规则（心意、标记、去向）全在 engine/runtime.js；这里只管「怎么演」与「等谁」。
import { compile } from './engine/script.js';
import { Runtime } from './engine/runtime.js';
import { SCRIPT_SOURCES, CAST, SPEAKERS, HEROINES, ROUTE_MIN, CUT, SCENES, faceSrc } from './story/registry.js';
import { stage, calm } from './stage.js';
import { audio } from './audio.js';
import { bus } from './bus.js';
import { settings, record, unlock, saveRecord, writeSave, loadSaves, writeNode, loadNodes, onSettings, rememberScene, sceneFlags } from './store.js';
import { icon } from './ui/icons.js';
import { toast, hideToast, confirmOpen } from './ui/feedback.js';
import { chapterCard, endingCard, fatePage, cardOpen, cardAdvance } from './ui/cards.js';
import { showChoices, choicesOpen, choicesExpired, pickByNumber, moveFocus, closeChoices } from './ui/choices.js';
import { lookAround, lookOpen } from './ui/look.js';
import { holdLamp } from './ui/hold.js';
import { stamps } from './ui/stamps.js';
import { cutStep } from './engine/subs.js';

const $ = (sel) => document.querySelector(sel);
const program = compile(SCRIPT_SOURCES, { cast: CAST, speakers: SPEAKERS });
const vm = new Runtime(program, {
  heroines: HEROINES,
  routeMin: ROUTE_MIN,
  hooks: {
    unlock: (kind, id) => {
      if (kind === 'scene' && !ui.replay) rememberScene(id, vm.vars.flags);
      if (!ui.replay || kind === 'music') unlock(kind, id);
    },
    remember: (who, delta) => stamps.push(who, delta),
    fx: (id) => { if (id === 'shake' && !fast()) stage.shake(); },
  },
});

const TRAIL_MAX = 8;
const BACKLOG_MAX = 300;
const BACKLOG_SAVED = 120; // 存档里带上的回看句数：读档后仍能往前翻
const SKIP_MS = 45;
const CUT_SKIP_WINDOW = 2200; // 过场最后一句上，这么久之内点第二下才跳过这段影像
const ui = {
  active: false, // 正在一局游戏里
  beat: null,
  replay: null, // 回想中的场景 id
  typing: null, // 打字机：{ timer, done() }
  shownAt: 0,
  awaitCue: false, // 过场字幕在等它的时间点
  ahead: false, // 玩家点过「先走一步」：下一句不等时间点
  subMs: 0, // 过场里这一句字幕已经在屏上停了多久（菜单开着等暂停时不算）
  subAt: 0,
  cutSkipArmed: 0,
  auto: false,
  skip: false,
  ctrl: false,
  hidden: false,
  bookOpen: false,
  instant: false, // 读档、回退后的第一拍：不播转场，过场显示定格
  timer: 0,
  trail: [], // 走过的选择点（「上一选项」用）
  backlog: [],
  token: 0, // 每次重开一局加一，旧的异步回调据此作废
};
const fast = () => ui.skip || ui.ctrl;
const paused = () => ui.bookOpen || ui.hidden || document.hidden || confirmOpen();

// ---------- 文本框 ----------
const dlg = {
  root: null, who: null, text: null,
  init() {
    this.root = $('#dialogue');
    this.who = $('#who');
    this.text = $('#text');
  },
  // kind：adv 文本框 / cg 画面在场时的字幕条 / sub 过场字幕 / none
  show(kind, { name = '', who = null, note = '', text = '', read = false, quote = false, instant = false } = {}, onDone) {
    this.stop();
    this.root.dataset.kind = kind;
    this.root.classList.toggle('waiting', false);
    const c = who ? CAST[who] : null;
    this.root.style.setProperty('--c', c?.color ?? '#8d7a52');
    this.root.style.setProperty('--glow', c?.glow ?? '#e6cf9a');
    this.who.hidden = !name;
    if (name) {
      // 名牌上是她的小像；没有立绘的说话人只留名字前一道描金
      const face = this.who.querySelector('.who-face');
      face.hidden = !c;
      this.who.classList.toggle('plain', !c);
      if (c && face.firstChild.getAttribute('src') !== faceSrc(who)) face.firstChild.src = faceSrc(who);
      this.who.querySelector('.who-name').textContent = name;
      this.who.querySelector('.who-note').textContent = note;
    } else {
      // 旁白：把上一位说话人的名牌清空，不只是藏起来——读屏与无障碍快照不会再把旁白挂在她名下（第 4 轮盲玩）
      this.who.querySelector('.who-name').textContent = '';
      this.who.querySelector('.who-note').textContent = '';
    }
    this.who.querySelector('.read-mark').hidden = !read || !name;
    this.root.classList.toggle('was-read', read);
    const body = quote ? `「${text}」` : text;
    const perSec = settings.textSpeed;
    if (instant || kind === 'sub' || perSec >= 100 || fast()) {
      this.text.textContent = body;
      this.text.classList.toggle('fade-in', kind === 'sub' && !instant);
      if (kind === 'sub') { void this.text.offsetWidth; }
      onDone?.();
      return;
    }
    // 打字机：没显出来的部分先占着位置，换行不会在打字途中跳
    this.text.innerHTML = '<span class="shown"></span><span class="rest"></span>';
    const shown = this.text.firstChild;
    const rest = this.text.lastChild;
    rest.textContent = body;
    let n = 0;
    let acc = 0;
    let last = performance.now();
    const finish = () => {
      clearInterval(timer);
      ui.typing = null;
      this.text.textContent = body;
      onDone?.();
    };
    const timer = setInterval(() => {
      const now = performance.now();
      if (paused()) { last = now; return; }
      acc += ((now - last) / 1000) * perSec;
      last = now;
      const step = Math.floor(acc);
      if (!step) return;
      acc -= step;
      n = Math.min(body.length, n + step);
      shown.textContent = body.slice(0, n);
      rest.textContent = body.slice(n);
      if (n >= body.length) finish();
    }, 24);
    ui.typing = { finish };
  },
  stop() { if (ui.typing) { const t = ui.typing; ui.typing = null; t.finish(); } },
  hide() { this.stop(); this.root.dataset.kind = 'none'; this.text.textContent = ''; this.who.hidden = true; this.who.querySelector('.who-name').textContent = ''; this.who.querySelector('.who-note').textContent = ''; },
  mark(on) { this.root.classList.toggle('waiting', on); },
};

// ---------- 快捷栏 ----------
const QUICK = [
  ['backlog', '回看', 'backlog', '↑'], ['auto', '自动', 'auto', 'A'], ['skip', '快进', 'skip', 'Ctrl'], ['rollback', '上一选项', 'rollback', '←'],
  ['qsave', '快存', 'qsave', 'Q'], ['qload', '快读', 'qload', 'W'], ['hide', '隐藏', 'hide', 'H'], ['menu', '菜单', 'menu', 'Esc'],
];
function buildQuick() {
  $('#quick').innerHTML = QUICK.map(([act, label, ico, key]) => `<button type="button" data-act="${act}" title="${label}（${key}）">${icon(ico)}<span>${label}</span></button>`).join('')
    + `<button type="button" data-act="leave" class="leave" hidden>${icon('close')}<span>结束回想</span></button>`;
  $('#quick').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    // 先把焦点从按钮上拿开再执行：册页关上时不会把焦点还给它，之后的空格、回车仍是「往下读」
    e.target.closest('button').blur();
    command(act);
  });
}
function paintModes() {
  for (const [act, on] of [['auto', ui.auto], ['skip', ui.skip || ui.ctrl]]) $(`#quick [data-act="${act}"]`).classList.toggle('active', on);
  const tag = $('#mode-tag');
  tag.hidden = !(ui.auto || ui.skip || ui.ctrl);
  tag.textContent = ui.skip || ui.ctrl ? '快进' : '自动';
  const replay = Boolean(ui.replay);
  for (const btn of $('#quick').querySelectorAll('button')) {
    const act = btn.dataset.act;
    btn.hidden = replay ? !['backlog', 'auto', 'skip', 'hide', 'leave'].includes(act) : act === 'leave';
  }
  $('#quick [data-act="rollback"]').disabled = !ui.trail.length;
}
function setHidden(on) {
  ui.hidden = on;
  $('#game').classList.toggle('ui-hidden', on);
  stage.pauseCut(paused());
}
function stopModes() {
  clearTimeout(ui.timer);
  ui.auto = false;
  ui.skip = false;
  paintModes();
}

// ---------- 走拍点 ----------
function next() {
  clearTimeout(ui.timer);
  if (!ui.active) return;
  let beat;
  try {
    beat = vm.step();
  } catch (error) {
    console.error(error);
    toast('这一段剧本读不下去了，已为你回到标题。');
    game.toTitle();
    return;
  }
  ui.beat = beat;
  present(beat);
}

function scheduleAuto(text = '') {
  clearTimeout(ui.timer);
  if (fast()) { ui.timer = setTimeout(next, SKIP_MS); return; }
  if (!ui.auto) return;
  const perChar = 130 - settings.autoSpeed * 0.9;
  ui.timer = setTimeout(() => { if (paused()) scheduleAuto(text); else next(); }, 900 + text.length * perChar);
}

function speakerMeta(beat) {
  if (!beat.name) return { name: '', note: '' };
  if (beat.who) return { name: beat.name, note: CAST[beat.who].title };
  return { name: beat.name, note: SPEAKERS[beat.name]?.note ?? '' };
}

function presentLine(beat) {
  const instant = ui.instant || fast();
  const wasCutLive = stage.cutLive();
  stage.sync(vm.stage, { speaker: beat.who, instant });
  const read = record.read.has(beat.at);
  const firstEver = record.read.size === 0;
  // 快进默认只跳已读：走到没读过的句子就停下
  if (fast() && !read && !settings.skipUnread) {
    ui.skip = false;
    ui.ctrl = false;
    paintModes();
    toast('前面是没读过的文字，快进停在这里');
  }
  unlock('read', beat.at);
  const meta = speakerMeta(beat);
  ui.backlog.push({ name: meta.name, who: beat.who, text: beat.text });
  if (ui.backlog.length > BACKLOG_MAX) ui.backlog.shift();
  $('#first-hint').hidden = !(firstEver && !ui.replay);
  beat.view = { name: meta.name, who: beat.who, note: meta.note, text: beat.text, read, quote: Boolean(beat.name) };
  // 刚离开一段过场（或这一拍没有过场）：压着的印这时盖
  if (!beat.cut && (wasCutLive || !stage.cutLive())) stamps.flush();
  const ahead = ui.ahead;
  ui.ahead = false;
  showLine(beat, { instant, force: ahead });
}

// 把一句话显出来。过场里的句子若还没到时间点，先让画面演，到点再由 cutTick 叫回来（force）
function showLine(beat, { instant = false, force = false } = {}) {
  ui.shownAt = performance.now();
  ui.awaitCue = false;
  ui.cutSkipArmed = 0;
  dlg.mark(false);
  if (!beat.cut) {
    dlg.show(vm.stage.cg ? 'cg' : 'adv', { ...beat.view, instant }, () => { dlg.mark(true); scheduleAuto(beat.text); });
    return;
  }
  const v = stage.cutVideo();
  const cue = CUT[beat.cut.id].cues[beat.cut.index] ?? 0;
  if (stage.cutLive() && !force && v.currentTime + 0.08 < cue) {
    ui.awaitCue = true;
    dlg.show('sub', { ...beat.view, name: '', text: '' });
    return;
  }
  // 玩家点了「先走一步」：画面跟着字幕跳到这一句所属的镜头，不让字幕跑在画面前面
  if (force && stage.cutLive() && v.currentTime + 0.08 < cue) v.currentTime = cue;
  ui.subMs = 0;
  ui.subAt = performance.now();
  stage.holdCut(false);
  dlg.show('sub', { ...beat.view, instant }, () => {
    const live = stage.cutLive();
    dlg.mark(!live);
    if (!live) { stamps.flush(); scheduleAuto(beat.text); }
  });
}

// 过场播放期间每帧看一眼：进度线、到点浮字幕、到下一句的时间点就换句
function cutTick() {
  requestAnimationFrame(cutTick);
  const v = ui.active ? stage.cutVideo() : null;
  const bar = $('#filmbar');
  if (!v || !stage.cutLive()) { bar.classList.remove('on'); return; }
  bar.classList.add('on');
  bar.firstElementChild.style.transform = `scaleX(${v.duration ? Math.min(1, v.currentTime / v.duration) : 0})`;
  const beat = ui.beat;
  const now = performance.now();
  const dt = now - ui.subAt;
  ui.subAt = now;
  if (beat?.type !== 'line' || !beat.cut) { stage.holdCut(false); return; }
  if (paused()) return;
  ui.subMs += Math.min(dt, 100);
  const cut = CUT[beat.cut.id];
  if (ui.awaitCue) {
    stage.holdCut(false);
    if (v.currentTime + 0.03 >= cut.cues[beat.cut.index]) showLine(beat, { force: true });
    return;
  }
  // 每句停够读完的时间；镜头演完还没读完，影像停在镜头交界处等（engine/subs.js）
  const step = cutStep(cut, beat.cut.index, v.currentTime, ui.subMs, beat.text);
  stage.holdCut(step === 'hold');
  dlg.mark(step === 'hold'); // 停住等读时亮出「点一下继续」的记号
  if (step === 'next') next();
}

// 读档、回退后直接落在选项或护灯上：把上一句摆回文本框，眼前的选择才有上文
function recallLastLine() {
  const last = vm.stage.last;
  if (dlg.root.dataset.kind !== 'none' || !last) return;
  const meta = speakerMeta(last);
  dlg.show(vm.stage.cut ? 'sub' : vm.stage.cg ? 'cg' : 'adv', { name: meta.name, who: last.who, note: meta.note, text: last.text, quote: Boolean(last.name), read: true, instant: true });
}

function presentChoice(beat) {
  stage.sync(vm.stage, { instant: ui.instant || fast() });
  recallLastLine();
  const timed = Boolean(beat.timed && settings.timed);
  // 限时抉择不替玩家读过去：快进与自动到这里一律停下；快进停了要说出来，按钮同时熄掉（第 4 轮盲玩：停了却像还在跑）
  if ((ui.skip || ui.ctrl) && !ui.instant) toast('快进停在选择前');
  else if (timed && ui.auto) toast('自动停在限时抉择前');
  if (timed || ui.skip || ui.ctrl) stopModes();
  ui.ctrl = false;
  stamps.flush();
  dlg.mark(false);
  if (!ui.replay) autosave();
  showChoices(beat, {
    timer: timed ? { seconds: beat.timed, paused } : null,
    onPick: (index) => {
      if (ui.beat !== beat) return;
      if (!ui.replay) {
        ui.trail.push({ ...vm.snapshot(), logAt: ui.backlog.length });
        if (ui.trail.length > TRAIL_MAX) ui.trail.shift();
        unlock('chosen', `${beat.at}:${index}`);
      }
      audio.se('choice');
      // 回看里留下自己选的那句（限时烧尽就是「不作声」），事后对得上自己说过什么
      const picked = beat.branch ? `去${CAST[beat.options[index].who].house} · ${CAST[beat.options[index].who].full}` : beat.options[index]?.text;
      if (picked) ui.backlog.push({ name: '', who: null, text: picked, chose: true });
      vm.choose(index);
      paintModes();
      next();
    },
  });
  paintModes();
}

function presentLook(beat) {
  stopModes();
  stage.sync(vm.stage, { instant: ui.instant });
  dlg.show('cg', { text: beat.prompt, instant: true });
  dlg.mark(false);
  lookAround(beat, {
    inspect: (i) => vm.inspect(i),
    say: (name, text) => {
      ui.backlog.push({ name: '', who: null, text: `【${name}】${text}` });
      dlg.show('cg', { text: `【${name}】${text}` });
    },
  }).then(() => {
    if (ui.beat !== beat) return;
    vm.endLook();
    next();
  });
}

function presentHold(beat) {
  stopModes();
  stage.sync(vm.stage, { instant: ui.instant });
  dlg.hide();
  const token = ui.token;
  holdLamp(beat, { paused }).then((ok) => {
    if (ui.token !== token || ui.beat !== beat) return;
    // 灯灭了照样往下演；顺带说一句还有别的办法（第 4 轮盲玩：连点推进的人没换成按住）
    if (!ok && !settings.assist) toast('灯灭了。要按住才护得住；嫌手忙，设置里可打开「动作辅助」', 3600);
    vm.resolveHold(ok);
    next();
  });
}

function present(beat) {
  $('#game').dataset.beat = beat.type;
  if (beat.type !== 'end') audio.bgm(vm.stage.bgm);
  switch (beat.type) {
    case 'line': presentLine(beat); break;
    case 'choice': presentChoice(beat); break;
    case 'look': presentLook(beat); break;
    case 'hold': presentHold(beat); break;
    case 'chapter': {
      const token = ui.token;
      const quick = ui.instant || fast();
      dlg.hide();
      // 章节卡先盖上来，背后再换场
      setTimeout(() => { if (ui.token === token && ui.beat === beat) { stage.sync(vm.stage, { instant: true }); $('#chapter-tag').textContent = vm.stage.chapter; } }, quick ? 0 : 420);
      if (!ui.replay) { writeNode(beat.label, vm.snapshot()); autosave(); }
      chapterCard(beat, { fast: quick }).then(() => { if (ui.token === token) next(); });
      break;
    }
    case 'ending': {
      const token = ui.token;
      stopModes();
      stage.sync(vm.stage, { instant: true });
      dlg.hide();
      saveRecord(true);
      endingCard(beat.id).then(() => { if (ui.token === token) next(); });
      break;
    }
    case 'fate': {
      const token = ui.token;
      audio.bgm('fate');
      unlock('music', 'fate');
      unlock('cg', 'fate');
      fatePage(beat.who).then(() => { if (ui.token === token) next(); });
      break;
    }
    case 'end':
      if (beat.replay || ui.replay) { const id = ui.replay; game.leave(); bus.emit('replay-ended', id); } else game.toTitle();
      break;
    default: throw new Error(`未知拍点：${beat.type}`);
  }
  ui.instant = false;
  if (beat.type !== 'chapter') $('#chapter-tag').textContent = ui.active ? vm.stage.chapter : '';
  paintModes();
}

// ---------- 输入 ----------
// 点击画面、空格、回车：往下读
function advance() {
  if (!ui.active || ui.bookOpen) return;
  if (ui.hidden) { setHidden(false); return; }
  if (cardOpen()) { cardAdvance(); return; }
  const beat = ui.beat;
  if (beat?.type !== 'line') return;
  $('#first-hint').hidden = true;
  if (ui.typing) { dlg.stop(); return; }
  if (ui.auto) { ui.auto = false; paintModes(); }
  if (ui.awaitCue) { showLine(beat, { force: true }); return; }
  if (beat.cut && stage.cutLive()) {
    const cues = CUT[beat.cut.id].cues;
    if (performance.now() - ui.shownAt < 220) return; // 字幕刚换句，这一下多半是手快
    if (beat.cut.index + 1 >= cues.length) {
      // 最后一句：影像还在演，第一下只提示，第二下才跳过
      const now = performance.now();
      if (now - ui.cutSkipArmed > CUT_SKIP_WINDOW) { ui.cutSkipArmed = now; toast('影像还在演 · 再点一次跳过', 1600); return; }
      hideToast();
    } else ui.ahead = true;
  }
  audio.se('click');
  next();
}

function command(act) {
  if (!ui.active) return;
  switch (act) {
    case 'backlog': bus.emit('open-book', 'backlog'); break;
    case 'menu': bus.emit('open-book', ui.replay ? 'settings' : 'save'); break;
    case 'save': if (!ui.replay) bus.emit('open-book', 'save'); break;
    case 'load': if (!ui.replay) bus.emit('open-book', 'load'); break;
    case 'tree': if (!ui.replay) bus.emit('open-book', 'tree'); break;
    case 'auto':
      ui.auto = !ui.auto;
      ui.skip = false;
      paintModes();
      if (ui.auto && ui.beat?.type === 'line' && !ui.typing && !ui.awaitCue && !stage.cutLive()) scheduleAuto(ui.beat.text);
      else if (!ui.auto) clearTimeout(ui.timer);
      break;
    case 'skip':
      ui.skip = !ui.skip;
      ui.auto = false;
      paintModes();
      if (ui.skip && ui.beat?.type === 'line') { dlg.stop(); ui.awaitCue = false; scheduleAuto(); } else clearTimeout(ui.timer);
      break;
    case 'hide': if (!choicesOpen() && !lookOpen()) setHidden(!ui.hidden); break;
    case 'qsave': if (!ui.replay) game.save('quick').then((ok) => toast(ok ? '已快存' : '存不进去：浏览器不让写入')); break;
    case 'qload': {
      const rec = loadSaves().quick;
      if (rec && !ui.replay) { game.load(rec); toast('已读回快存'); } else toast('还没有快存');
      break;
    }
    case 'rollback': {
      if (ui.replay || !ui.trail.length) { toast('前面没有可回的选择'); break; }
      const snap = ui.trail.pop();
      resume(snap, ui.trail, ui.backlog.slice(0, snap.logAt ?? ui.backlog.length));
      toast('回到上一个选择');
      break;
    }
    case 'leave': { const id = ui.replay; game.leave(); bus.emit('replay-ended', id); break; }
    default: break;
  }
}

function onKey(e) {
  if (!ui.active || ui.bookOpen || confirmOpen() || e.metaKey || e.altKey) return;
  const key = e.key;
  if (key === 'Control') { if (!ui.ctrl && ui.beat?.type === 'line') { ui.ctrl = true; dlg.stop(); ui.awaitCue = false; paintModes(); scheduleAuto(); } return; }
  if (e.ctrlKey) return;
  if (ui.hidden) { e.preventDefault(); setHidden(false); return; }
  const onButton = e.target.closest?.('button, input, select, a');
  if (choicesOpen()) {
    if (/^[1-9]$/.test(key)) {
      e.preventDefault();
      if (choicesExpired()) toast('灯芯已经烧尽，这一回你没有开口');
      else if (pickByNumber(Number(key)) === 'dark') toast('这扇门的灯已经熄了');
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowRight') { e.preventDefault(); moveFocus(1); return; }
    if (key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); return; }
  }
  if (key === ' ' || key === 'Enter' || key === 'ArrowDown') {
    if (onButton && key !== 'ArrowDown') return; // 让按钮自己响应
    e.preventDefault();
    advance();
    return;
  }
  if (cardOpen()) return;
  const map = { Escape: 'menu', ArrowUp: 'backlog', PageUp: 'backlog', b: 'backlog', B: 'backlog', ArrowLeft: 'rollback', a: 'auto', A: 'auto', f: 'skip', F: 'skip', h: 'hide', H: 'hide', q: 'qsave', Q: 'qsave', w: 'qload', W: 'qload', s: 'save', S: 'save', l: 'load', L: 'load', t: 'tree', T: 'tree' };
  if (map[key]) { e.preventDefault(); command(map[key]); }
}

function bindInput() {
  const gameEl = $('#game');
  gameEl.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, #hold, #choices, #look-ui')) return;
    advance();
  });
  gameEl.addEventListener('contextmenu', (e) => { e.preventDefault(); command('hide'); });
  gameEl.addEventListener('wheel', (e) => { if (e.deltaY < -20 && !ui.bookOpen && !cardOpen()) command('backlog'); }, { passive: true });
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && ui.ctrl) { ui.ctrl = false; clearTimeout(ui.timer); paintModes(); }
  });
  document.addEventListener('visibilitychange', () => stage.pauseCut(paused()));
  onSettings((key) => {
    if (key === 'voice') stage.setVoiceVolume();
    if (['film', 'calm', 'adult'].includes(key) && ui.active) stage.refresh(vm.stage);
    if (key === 'boxAlpha') applyBoxAlpha();
  });
}
const applyBoxAlpha = () => document.documentElement.style.setProperty('--box-alpha', (settings.boxAlpha / 100).toFixed(2));

// ---------- 存读档 ----------
async function makeRecord() {
  const snap = vm.snapshot();
  const state = snap.stage;
  const beat = ui.beat;
  const who = beat?.type === 'line' ? speakerMeta(beat).name : '';
  const text = beat?.type === 'line' ? beat.text : beat?.type === 'choice' ? '（面前有一个选择）' : beat?.type === 'look' ? '（正在端详）' : '';
  return { snap, trail: ui.trail.slice(-TRAIL_MAX), backlog: ui.backlog.slice(-BACKLOG_SAVED), chapter: vm.stage.chapter || '序章', name: who, text, time: Date.now(), thumb: await stage.thumbnail(state) };
}
function autosave() {
  const token = ui.token;
  makeRecord().then((rec) => { if (ui.token === token) writeSave('auto', rec); });
}

function begin() {
  ui.token += 1;
  ui.active = true;
  ui.beat = null;
  ui.backlog = [];
  ui.auto = false;
  ui.skip = false;
  ui.ctrl = false;
  ui.awaitCue = false;
  ui.ahead = false;
  clearTimeout(ui.timer);
  closeChoices();
  stamps.clear();
  setHidden(false);
  dlg.hide();
  stage.reset();
  $('#chapter-tag').textContent = '';
  bus.emit('screen', 'game');
}

function resume(snap, trail = [], backlog = []) {
  const replay = ui.replay;
  begin();
  ui.replay = replay;
  ui.backlog = Array.isArray(backlog) ? backlog.slice(-BACKLOG_MAX) : [];
  vm.restore(snap, { replay: Boolean(replay) });
  ui.trail = trail.slice();
  ui.instant = true;
  next();
}

export const game = {
  program,
  get active() { return ui.active; },
  get replaying() { return ui.replay; },
  get backlog() { return ui.backlog; },
  get beat() { return ui.beat; },
  vars: () => vm.vars,
  chapterLabel: () => vm.stage.chapterAt,

  init() {
    dlg.init();
    stage.init();
    stage.onCut({
      ended: () => {
        dlg.mark(true);
        stamps.flush();
        if (ui.beat?.type === 'line' && !ui.awaitCue) scheduleAuto(ui.beat.text);
        // 等时间点的那句排在片尾之后：影像演完就浮出来
        if (ui.awaitCue && ui.beat?.type === 'line') showLine(ui.beat, { force: true });
      },
    });
    buildQuick();
    bindInput();
    applyBoxAlpha();
    document.documentElement.classList.toggle('calm', calm());
    requestAnimationFrame(cutTick);
  },

  start() {
    begin();
    ui.replay = null;
    ui.trail = [];
    vm.start('start');
    next();
  },

  // from：'continue' 是标题上的「继续」——落在哪里要说一声（第 4 轮盲玩：刷新后继续回到了上一个选择，以为存档坏了）
  load(rec, { from = null } = {}) {
    ui.replay = null;
    resume(rec.snap, rec.trail ?? [], rec.backlog ?? []);
    if (from === 'continue') {
      const type = ui.beat?.type;
      toast(type === 'choice' ? '自动存档停在最近的选择处，从这里接着走' : type === 'chapter' ? '自动存档停在这一章开头，从这里接着走' : '从上次存档处接着走', 3200);
    }
  },

  async save(slot) {
    if (!ui.active || ui.replay) return false;
    const ok = writeSave(slot, await makeRecord());
    if (ok) audio.se('save');
    return ok;
  },

  // 剧情树：从到过的章节开头重来
  jumpToChapter(label) {
    const node = loadNodes()[label];
    if (!node) return false;
    ui.replay = null;
    resume(node.snap, []);
    return true;
  },

  // 鉴赏 · 回想
  replayScene(id) {
    begin();
    ui.replay = id;
    ui.trail = [];
    vm.start(SCENES[id].label, { replay: true, flags: sceneFlags(id) });
    next();
  },

  // 离开这一局（不存档）：停掉影像与计时
  leave() {
    ui.token += 1;
    ui.active = false;
    ui.replay = null;
    ui.beat = null;
    clearTimeout(ui.timer);
    closeChoices();
    stamps.clear();
    dlg.hide();
    stage.reset();
    saveRecord(true);
  },

  toTitle() {
    this.leave();
    bus.emit('screen', 'title');
  },

  setBookOpen(on) {
    ui.bookOpen = on;
    stage.pauseCut(paused());
    if (!on && ui.auto && ui.beat?.type === 'line' && !ui.typing) scheduleAuto(ui.beat.text);
  },

  command,
};
