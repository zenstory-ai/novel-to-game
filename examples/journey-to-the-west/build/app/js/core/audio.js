// 声音：BGM 用 <audio> 流式播放并交叉淡入，短音效解码进缓冲。首次输入后才出声；读不出就安静，不影响游玩。
import { settings } from './store.js';

const BGM = ['title', 'overworld', 'battle', 'boss', 'ending'];
const SFX = ['click', 'coin', 'combo', 'crit', 'defeat', 'encounter', 'fan1', 'fan2', 'fan3', 'firefx', 'heal', 'heavy', 'hit', 'ke', 'levelup', 'portal', 'quest', 'skill', 'step', 'telegraph', 'thud', 'transform', 'victory', 'waterfx'];

let ctx = null;
let unlocked = false;
let wanted = null;
let current = null;
const tracks = {};
const buffers = {};

function musicVolume() { return settings.mute ? 0 : settings.music * 0.55; }

function fade(el, to, dur = 900) {
  if (!el) return;
  const from = el.volume;
  const start = performance.now();
  cancelAnimationFrame(el._fade);
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) el._fade = requestAnimationFrame(step);
    else if (to === 0) el.pause();
  };
  el._fade = requestAnimationFrame(step);
}

function startWanted() {
  if (!unlocked || !wanted || current === wanted) return;
  fade(tracks[current], 0);
  current = wanted;
  let el = tracks[current];
  if (!el) {
    el = new Audio(`assets/audio/bgm/${current}.mp3`);
    el.loop = true;
    el.preload = 'auto';
    tracks[current] = el;
  }
  el.volume = 0;
  el.play().then(() => fade(el, musicVolume())).catch(() => {});
}

async function loadSfx(name) {
  if (buffers[name] !== undefined || !ctx) return;
  buffers[name] = null;
  try {
    const res = await fetch(`assets/audio/sfx/${name}.mp3`);
    buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
  } catch { buffers[name] = null; }
}

export const audio = {
  unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (const name of SFX) loadSfx(name);
    } catch { ctx = null; }
    startWanted();
  },
  music(name) {
    if (!BGM.includes(name)) return;
    wanted = name;
    startWanted();
  },
  sfx(name, { volume = 1, rate = 1 } = {}) {
    if (!ctx || settings.mute || !buffers[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = settings.sound * volume;
    src.connect(gain).connect(ctx.destination);
    src.start();
  },
  refresh() {
    const el = tracks[current];
    if (el) { el.volume = musicVolume(); if (unlocked && el.paused && musicVolume() > 0) el.play().catch(() => {}); }
  },
};

for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => audio.unlock(), { once: true, capture: true });
document.addEventListener('visibilitychange', () => {
  const el = tracks[current];
  if (!el) return;
  if (document.hidden) el.pause(); else if (unlocked) el.play().catch(() => {});
});
