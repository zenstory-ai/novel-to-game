// 声音：配乐流式播放并交叉淡入淡出，过场开播时压到三成；短音效解码进内存。
// 文件读不出时，配乐回落到一支程序化的五声长音，音效回落到合成的轻叩；没有 AudioContext 时整体静默，不影响游玩。
import { settings, onSettings } from './store.js';

const bgmSrc = (id) => `assets/audio/bgm/${id}.mp3`;
const SE_IDS = ['click', 'page', 'choice', 'chapter', 'ending', 'save', 'flare', 'gust'];
const LOOP_GAP = 1600; // 曲子放完停一口气再从头来，不硬接循环
const DUCK = 0.3;
const FADE = 900;

let ctx = null;
let seGain = null;
const buffers = new Map();
let current = null; // { id, el, synth }
let wanted = null;
let ducked = false;
let unlocked = false;

const bgmLevel = () => (settings.bgm / 100) * 0.9 * (ducked ? DUCK : 1);

function ramp(el, to, ms, done) {
  const from = el.volume;
  const start = performance.now();
  clearInterval(el.rampTimer);
  el.rampTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(el.rampTimer); done?.(); }
  }, 40);
}

// 回落配乐：羽调式五声音阶上的慢长音，像远处的洞箫
function startSynth() {
  if (!ctx) return null;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);
  const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
  let stopped = false;
  const note = () => {
    if (stopped) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const len = 2.4 + Math.random() * 2.2;
    osc.type = 'sine';
    osc.frequency.value = scale[Math.floor(Math.random() * scale.length)];
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.7);
    g.gain.linearRampToValueAtTime(0, t + len);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.1);
    setTimeout(note, (len * 0.8 + Math.random()) * 1000);
  };
  note();
  return {
    set volume(v) { out.gain.setTargetAtTime(v, ctx.currentTime, 0.3); },
    stop() { stopped = true; out.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => out.disconnect(), 1500); },
  };
}

function stopCurrent() {
  const old = current;
  current = null;
  if (!old) return;
  clearTimeout(old.gapTimer);
  if (old.synth) old.synth.stop();
  if (old.el) ramp(old.el, 0, FADE, () => { old.el.pause(); old.el.src = ''; });
}

function startBgm(id) {
  stopCurrent();
  if (!id) return;
  const el = new Audio(bgmSrc(id));
  const track = { id, el, synth: null, gapTimer: null };
  current = track;
  el.preload = 'auto';
  el.volume = 0;
  el.addEventListener('ended', () => {
    track.gapTimer = setTimeout(() => { if (current === track) { el.currentTime = 0; el.play().catch(() => {}); } }, LOOP_GAP);
  });
  el.addEventListener('error', () => {
    if (current !== track || track.synth) return;
    track.synth = startSynth();
    if (track.synth) track.synth.volume = bgmLevel() * 0.5;
  }, { once: true });
  el.play().then(() => { if (current === track) ramp(el, bgmLevel(), FADE); }).catch(() => { /* 等第一次点击后由 unlock 重放 */ });
}

function applyVolumes() {
  if (seGain) seGain.gain.value = (settings.se / 100) * 0.9;
  if (current?.el) ramp(current.el, bgmLevel(), 300);
  if (current?.synth) current.synth.volume = bgmLevel() * 0.5;
}
onSettings((key) => { if (key === 'bgm' || key === 'se') applyVolumes(); });

function synthTick(id) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime({ choice: 520, chapter: 330, ending: 262, save: 440 }[id] ?? 380, t);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (id === 'ending' || id === 'chapter' ? 0.9 : 0.12));
  osc.connect(g).connect(seGain);
  osc.start(t);
  osc.stop(t + 1);
}

export const audio = {
  // 浏览器要求先有一次用户手势才能出声；年龄门那一下点击之后调用
  unlock() {
    if (unlocked) { if (ctx?.state === 'suspended') ctx.resume().catch(() => {}); return; }
    unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC();
        seGain = ctx.createGain();
        seGain.connect(ctx.destination);
        applyVolumes();
        for (const id of SE_IDS) {
          fetch(`assets/audio/se/${id}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((data) => ctx.decodeAudioData(data))
            .then((buf) => buffers.set(id, buf)).catch(() => {});
        }
      }
    } catch { ctx = null; }
    if (wanted) startBgm(wanted);
  },

  bgm(id) {
    if (id === wanted && (current?.id === id || !unlocked)) return;
    wanted = id;
    if (unlocked) startBgm(id);
  },

  se(id) {
    if (!ctx || !seGain || settings.se <= 0) return;
    const buf = buffers.get(id);
    if (!buf) { synthTick(id); return; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(seGain);
    src.start();
  },

  // 过场开播时把配乐压低，播完或离开时放回
  duck(on) {
    if (ducked === on) return;
    ducked = on;
    if (current?.el) ramp(current.el, bgmLevel(), 500);
    if (current?.synth) current.synth.volume = bgmLevel() * 0.5;
  },

  // 切到后台标签页时停声，回来接着放
  hush(on) {
    if (!current?.el) return;
    if (on) current.el.pause(); else if (unlocked) current.el.play().catch(() => {});
  },

  get playing() { return current?.id ?? null; },
};

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => audio.hush(document.hidden));
