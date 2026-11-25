// 声音：单主控配乐状态机（带单调代次令牌，统一纳管当前轨、交叉淡出旧轨与回落合成器）+ 受设置实时门控的 WebAudio 短音效。
// 首次通过年龄门后的手势解锁；静音、音量归零或切后台立即断声，绝不偷跑；文件读不出时回落到五声长音与合成轻叩。
import { settings, DEFAULT_SETTINGS, clampNumber, onSettings, ageConfirmed } from './store.js';

export const BGM_IDS = ['title', 'daily', 'garden', 'tender', 'tension', 'night', 'sad', 'fate'];
export const SE_IDS = ['click', 'page', 'choice', 'chapter', 'ending', 'save', 'flare', 'gust'];
export const BGM_GAIN_SCALE = 0.9;
export const SE_GAIN_SCALE = 0.9;
export const DUCK_SCALE = 0.3;

const SE_SET = new Set(SE_IDS);
const LOOP_GAP_MS = 1600; // 曲子放完停一口气再从头来，不硬接循环
const FADE_MS = 900;
const VOLUME_RAMP_MS = 160;
const DUCK_RAMP_MS = 380;
const RAMP_TICK_MS = 40;
const MAX_SE_VOICES = 8;
const SE_COOLDOWN_MS = {
  click: 70,
  page: 70,
  choice: 80,
  save: 120,
  gust: 120,
  flare: 120,
  chapter: 180,
  ending: 200,
};
const DEFAULT_SE_COOLDOWN_MS = 60;

const bgmSrc = (id) => `assets/audio/bgm/${id}.mp3`;
const seSrc = (id) => `assets/audio/se/${id}.mp3`;

function clamp01(v) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

export function createAudioController({
  settings: cfg,
  createAudio = (src) => new Audio(src),
  createContext = () => {
    const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    return AC ? new AC() : null;
  },
  fetchImpl = typeof fetch === 'function' ? (...a) => fetch(...a) : null,
  now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  setTick = (fn, ms) => setInterval(fn, ms),
  clearTick = (id) => clearInterval(id),
  isHidden = () => (typeof document !== 'undefined' ? Boolean(document.hidden) : false),
  canUnlock = () => true,
  bindEvents = typeof window !== 'undefined' && typeof document !== 'undefined',
} = {}) {
  const s = cfg ?? settings;

  let ctx = null;
  let seGain = null;
  let compressor = null;
  let unlocked = false;
  let needsGestureRetry = false;
  let wanted = null;
  let current = null; // { id, el, synth, gapTimer, rampTimer, gen }
  let ducked = false;
  let generation = 0;
  let sePlayedCount = 0;
  let seBlockedCount = 0;

  const fading = new Set(); // { id, el, rampTimer }
  const buffers = new Map();
  const loadingSe = new Set();
  const failedSe = new Set();
  const activeSe = new Set(); // { src, gain, id }
  const lastSeAt = new Map();

  function bgmPercent() { return clampNumber(s.bgm, 0, 100, DEFAULT_SETTINGS.bgm); }
  function sePercent() { return clampNumber(s.se, 0, 100, DEFAULT_SETTINGS.se); }
  function voicePercent() { return clampNumber(s.voice, 0, 100, DEFAULT_SETTINGS.voice); }

  function isBgmEnabled() { return !s.mute && s.bgmOn !== false && bgmPercent() > 0; }
  function isSeEnabled() { return !s.mute && s.seOn !== false && sePercent() > 0; }
  function isVoiceEnabled() { return !s.mute && s.voiceOn !== false && voicePercent() > 0; }

  function targetBgmGain() {
    if (!isBgmEnabled()) return 0;
    return clamp01((bgmPercent() / 100) * BGM_GAIN_SCALE * (ducked ? DUCK_SCALE : 1));
  }
  function targetSeGain() {
    if (!isSeEnabled()) return 0;
    return clamp01((sePercent() / 100) * SE_GAIN_SCALE);
  }
  function targetVoiceGain() {
    if (!isVoiceEnabled()) return 0;
    return clamp01(voicePercent() / 100);
  }

  function clearTrackRamp(track) {
    if (track?.rampTimer != null) {
      clearTick(track.rampTimer);
      track.rampTimer = null;
    }
  }

  function clearTrackGap(track) {
    if (track?.gapTimer != null) {
      clearTimer(track.gapTimer);
      track.gapTimer = null;
    }
  }

  function hardStopEl(el, { clearSrc = true } = {}) {
    if (!el) return;
    el.muted = true;
    try { el.volume = 0; } catch { /* ignore */ }
    try { el.pause(); } catch { /* ignore */ }
    if (clearSrc) {
      try {
        if (typeof el.removeAttribute === 'function') el.removeAttribute('src');
        else el.src = '';
        if (typeof el.load === 'function') el.load();
      } catch { /* ignore */ }
    }
  }

  function hardStopTrack(track, { clearSrc = true } = {}) {
    if (!track) return;
    clearTrackRamp(track);
    clearTrackGap(track);
    if (track.synth) {
      track.synth.stop(true);
      track.synth = null;
    }
    if (track.el) hardStopEl(track.el, { clearSrc });
  }

  function hardStopAllFading() {
    for (const entry of [...fading]) {
      fading.delete(entry);
      clearTrackRamp(entry);
      hardStopEl(entry.el, { clearSrc: true });
    }
  }

  // 回落配乐：羽调式五声音阶上的慢长音，像远处的洞箫
  function startSynth() {
    if (!ctx || (ctx.state && ctx.state !== 'running')) return null;
    const out = ctx.createGain();
    if (out.gain) out.gain.value = 0;
    out.connect(ctx.destination);
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const oscs = new Set();
    let stopped = false;
    let noteTimer = null;
    let disconnectTimer = null;
    const note = () => {
      if (stopped || !ctx || isHidden() || !isBgmEnabled()) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime ?? 0;
      const len = 2.4 + Math.random() * 2.2;
      osc.type = 'sine';
      if (osc.frequency) osc.frequency.value = scale[Math.floor(Math.random() * scale.length)];
      if (g.gain && typeof g.gain.setValueAtTime === 'function') {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime?.(0.16, t + 0.7);
        g.gain.linearRampToValueAtTime?.(0, t + len);
      }
      osc.connect(g);
      g.connect(out);
      const voice = { osc, g };
      oscs.add(voice);
      osc.onended = () => {
        oscs.delete(voice);
        try { osc.disconnect(); } catch { /* ignore */ }
        try { g.disconnect(); } catch { /* ignore */ }
      };
      try {
        osc.start(t);
        osc.stop(t + len + 0.1);
      } catch {
        oscs.delete(voice);
      }
      noteTimer = setTimer(note, (len * 0.8 + Math.random()) * 1000);
    };
    note();
    return {
      setVolume(v) {
        if (stopped || !ctx || !out.gain) return;
        const safe = clamp01(v);
        try {
          if (typeof out.gain.setTargetAtTime === 'function') out.gain.setTargetAtTime(safe, ctx.currentTime ?? 0, 0.25);
          else out.gain.value = safe;
        } catch { /* ignore */ }
      },
      stop(immediate = false) {
        if (stopped) return;
        stopped = true;
        if (noteTimer != null) { clearTimer(noteTimer); noteTimer = null; }
        if (disconnectTimer != null) { clearTimer(disconnectTimer); disconnectTimer = null; }
        if (immediate) {
          for (const voice of [...oscs]) {
            oscs.delete(voice);
            try { voice.osc.onended = null; } catch { /* ignore */ }
            try { voice.osc.stop(); } catch { /* ignore */ }
            try { voice.osc.disconnect(); } catch { /* ignore */ }
            try { voice.g.disconnect(); } catch { /* ignore */ }
          }
          try { if (out.gain) out.gain.value = 0; } catch { /* ignore */ }
          try { out.disconnect(); } catch { /* ignore */ }
        } else {
          try {
            if (out.gain && typeof out.gain.setTargetAtTime === 'function' && ctx) out.gain.setTargetAtTime(0, ctx.currentTime ?? 0, 0.2);
            else if (out.gain) out.gain.value = 0;
          } catch { /* ignore */ }
          disconnectTimer = setTimer(() => {
            disconnectTimer = null;
            for (const voice of [...oscs]) {
              oscs.delete(voice);
              try { voice.osc.stop(); } catch { /* ignore */ }
              try { voice.osc.disconnect(); } catch { /* ignore */ }
              try { voice.g.disconnect(); } catch { /* ignore */ }
            }
            try { out.disconnect(); } catch { /* ignore */ }
          }, 900);
        }
      },
    };
  }

  function rampTrackToLive(track, ms) {
    if (!track?.el) return;
    clearTrackRamp(track);
    const el = track.el;
    const liveTo = targetBgmGain();
    if (current !== track || isHidden() || liveTo <= 0) {
      hardStopTrack(track, { clearSrc: current !== track });
      if (current === track && liveTo <= 0) current = null;
      return;
    }
    const from = clamp01(el.volume);
    if (ms <= 0 || Math.abs(from - liveTo) < 0.002) {
      el.muted = false;
      el.volume = liveTo;
      return;
    }
    const start = now();
    el.muted = false;
    track.rampTimer = setTick(() => {
      if (current !== track || isHidden() || !isBgmEnabled()) {
        clearTrackRamp(track);
        hardStopTrack(track, { clearSrc: current !== track });
        if (current === track) current = null;
        return;
      }
      const k = Math.min(1, Math.max(0, (now() - start) / ms));
      const to = targetBgmGain();
      if (to <= 0) {
        clearTrackRamp(track);
        hardStopTrack(track, { clearSrc: false });
        current = null;
        return;
      }
      el.muted = false;
      el.volume = clamp01(from + (to - from) * k);
      if (k >= 1) clearTrackRamp(track);
    }, RAMP_TICK_MS);
  }

  function retireCurrent({ immediate = false } = {}) {
    const old = current;
    current = null;
    if (!old) return;
    clearTrackRamp(old);
    clearTrackGap(old);
    if (old.synth) {
      old.synth.stop(immediate);
      old.synth = null;
    }
    const el = old.el;
    if (!el) return;
    const vol = clamp01(el.volume);
    if (immediate || el.paused || el.muted || vol <= 0.005 || isHidden() || !isBgmEnabled()) {
      hardStopEl(el, { clearSrc: true });
      return;
    }
    // 可听见的交叉淡出：纳入 fading 统一纳管，静音或切后台时可立刻斩断
    const entry = { id: old.id, el, rampTimer: null };
    fading.add(entry);
    const from = vol;
    const start = now();
    entry.rampTimer = setTick(() => {
      if (!fading.has(entry) || el.paused || el.muted || isHidden() || !isBgmEnabled()) {
        fading.delete(entry);
        clearTrackRamp(entry);
        hardStopEl(el, { clearSrc: true });
        return;
      }
      const k = Math.min(1, Math.max(0, (now() - start) / FADE_MS));
      const ceiling = targetBgmGain();
      const next = Math.min(ceiling, from * (1 - k));
      el.volume = clamp01(next);
      if (k >= 1 || next <= 0.002) {
        fading.delete(entry);
        clearTrackRamp(entry);
        hardStopEl(el, { clearSrc: true });
      }
    }, RAMP_TICK_MS);
  }

  function startTrack(id, { fadeIn = true } = {}) {
    const gen = ++generation;
    const oldSame = current && current.id === id;

    if (!id || !unlocked || isHidden() || !isBgmEnabled()) {
      retireCurrent({ immediate: true });
      hardStopAllFading();
      return;
    }

    if (oldSame) {
      if (current.synth) {
        current.synth.setVolume(targetBgmGain() * 0.5);
        needsGestureRetry = false;
        return;
      }
      if (current.el && !current.el.paused) {
        current.gen = gen;
        rampTrackToLive(current, VOLUME_RAMP_MS);
        needsGestureRetry = false;
        return;
      }
      // 当前轨存在但已暂停（如被系统打断或之前拒播）：立即硬停并重建/重播
      retireCurrent({ immediate: true });
    } else {
      retireCurrent({ immediate: false });
    }

    const el = createAudio(bgmSrc(id));
    const track = { id, el, synth: null, gapTimer: null, rampTimer: null, gen };
    current = track;
    el.preload = 'auto';
    el.muted = false;
    el.volume = fadeIn ? 0 : targetBgmGain();

    el.addEventListener?.('ended', () => {
      if (current !== track) return;
      clearTrackGap(track);
      track.gapTimer = setTimer(() => {
        track.gapTimer = null;
        if (current !== track || !unlocked || isHidden() || !isBgmEnabled()) return;
        try { el.currentTime = 0; } catch { /* ignore */ }
        el.muted = false;
        el.volume = targetBgmGain();
        try {
          const p = el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              if (current === track) {
                hardStopTrack(track, { clearSrc: true });
                current = null;
                needsGestureRetry = true;
              }
            });
          }
        } catch {
          if (current === track) {
            hardStopTrack(track, { clearSrc: true });
            current = null;
            needsGestureRetry = true;
          }
        }
      }, LOOP_GAP_MS);
    });

    el.addEventListener?.('error', () => {
      if (current !== track || track.synth || isHidden() || !isBgmEnabled()) return;
      track.synth = startSynth();
      if (track.synth) track.synth.setVolume(targetBgmGain() * 0.5);
    }, { once: true });

    let res;
    try {
      res = el.play();
    } catch {
      if (current === track && track.gen === generation) {
        hardStopTrack(track, { clearSrc: true });
        current = null;
        needsGestureRetry = true;
      }
      return;
    }

    const onStarted = () => {
      if (current !== track || wanted !== id || isHidden() || !isBgmEnabled()) {
        hardStopTrack(track, { clearSrc: true });
        if (current === track) current = null;
        return;
      }
      if (track.gen !== generation) return;
      needsGestureRetry = false;
      const live = targetBgmGain();
      if (live <= 0) {
        hardStopTrack(track, { clearSrc: true });
        current = null;
        return;
      }
      el.muted = false;
      rampTrackToLive(track, fadeIn ? FADE_MS : 0);
    };

    if (res && typeof res.then === 'function') {
      res.then(onStarted, () => {
        if (current === track && (track.gen === generation || (el.paused && isBgmEnabled() && !isHidden()))) {
          hardStopTrack(track, { clearSrc: true });
          current = null;
          needsGestureRetry = true;
        }
      });
    } else {
      onStarted();
    }
  }

  function applySeGain() {
    if (!seGain) return;
    const vol = targetSeGain();
    try {
      if (seGain.gain && typeof seGain.gain.setValueAtTime === 'function' && ctx && typeof ctx.currentTime === 'number') {
        seGain.gain.setValueAtTime(vol, ctx.currentTime);
      }
      if (seGain.gain) seGain.gain.value = vol;
    } catch { /* ignore */ }
  }

  function stopSeVoice(voice) {
    activeSe.delete(voice);
    try { voice.src.onended = null; } catch { /* ignore */ }
    try { voice.src.stop(); } catch { /* ignore */ }
    try { voice.src.disconnect(); } catch { /* ignore */ }
    try { voice.gain?.disconnect(); } catch { /* ignore */ }
  }

  function stopAllSe() {
    for (const voice of [...activeSe]) stopSeVoice(voice);
  }

  function ensureContext() {
    if (ctx) return ctx;
    try {
      ctx = createContext();
      if (!ctx) return null;
      seGain = ctx.createGain();
      applySeGain();
      if (typeof ctx.createDynamicsCompressor === 'function') {
        compressor = ctx.createDynamicsCompressor();
        if (compressor.threshold) compressor.threshold.value = -12;
        if (compressor.knee) compressor.knee.value = 18;
        if (compressor.ratio) compressor.ratio.value = 6;
        if (compressor.attack) compressor.attack.value = 0.003;
        if (compressor.release) compressor.release.value = 0.15;
        seGain.connect(compressor);
        compressor.connect(ctx.destination);
      } else {
        seGain.connect(ctx.destination);
      }
    } catch {
      ctx = null;
      seGain = null;
      compressor = null;
    }
    return ctx;
  }

  async function loadSe(id) {
    if (buffers.has(id) || loadingSe.has(id) || !ctx || !fetchImpl) return;
    loadingSe.add(id);
    try {
      const res = await fetchImpl(seSrc(id));
      if (!res || res.ok === false) { failedSe.add(id); return; }
      const data = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(data);
      if (decoded) {
        buffers.set(id, decoded);
        failedSe.delete(id);
      } else {
        failedSe.add(id);
      }
    } catch {
      failedSe.add(id);
    } finally {
      loadingSe.delete(id);
    }
  }

  function resumeContextIfAllowed() {
    if (!ctx || isHidden() || (!isSeEnabled() && !current?.synth)) return;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => { needsGestureRetry = true; });
      } catch {
        needsGestureRetry = true;
      }
    }
  }

  function synthTick(id) {
    if (!ctx || !seGain) return false;
    const t = ctx.currentTime ?? 0;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    const freq = { choice: 520, chapter: 330, ending: 262, save: 440 }[id] ?? 380;
    const dur = id === 'ending' || id === 'chapter' ? 0.9 : 0.12;
    if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') osc.frequency.setValueAtTime(freq, t);
    else if (osc.frequency) osc.frequency.value = freq;
    if (g.gain && typeof g.gain.setValueAtTime === 'function') {
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime?.(0.001, t + dur);
    }
    osc.connect(g);
    g.connect(seGain);
    const voice = { src: osc, gain: g, id };
    activeSe.add(voice);
    osc.onended = () => {
      activeSe.delete(voice);
      try { osc.disconnect(); } catch { /* ignore */ }
      try { g.disconnect(); } catch { /* ignore */ }
    };
    try {
      osc.start(t);
      osc.stop(t + dur + 0.05);
      sePlayedCount += 1;
      return true;
    } catch {
      stopSeVoice(voice);
      return false;
    }
  }

  function unlock() {
    const first = !unlocked;
    unlocked = true;
    const hadCtx = Boolean(ctx);
    ensureContext();
    applySeGain();
    resumeContextIfAllowed();
    if (!hadCtx && ctx) {
      for (const id of SE_IDS) loadSe(id);
    }
    if (
      wanted && isBgmEnabled() && !isHidden()
      && (first || needsGestureRetry || !current || (current.el && current.el.paused && !current.synth))
    ) {
      startTrack(wanted, { fadeIn: true });
    }
  }

  function bgm(id) {
    const nextId = id || null;
    if (nextId === wanted && (
      !unlocked
      || (nextId === null && !current)
      || (nextId !== null && current?.id === nextId && (current.synth || (current.el && !current.el.paused)))
    )) return;
    wanted = nextId;
    if (!unlocked) {
      if (!nextId) {
        retireCurrent({ immediate: true });
        hardStopAllFading();
      }
      return;
    }
    if (!nextId) {
      generation += 1;
      retireCurrent({ immediate: false });
      return;
    }
    startTrack(nextId, { fadeIn: true });
  }

  function se(id) {
    if (!SE_SET.has(id)) return false;
    if (!isSeEnabled()) {
      seBlockedCount += 1;
      return false;
    }
    if (isHidden() || !ctx || !seGain) return false;
    if (ctx.state && ctx.state !== 'running') return false;

    const buf = buffers.get(id);
    if (!buf) {
      if (!failedSe.has(id)) {
        loadSe(id);
        return false;
      }
    }

    const t = now();
    const cooldown = SE_COOLDOWN_MS[id] ?? DEFAULT_SE_COOLDOWN_MS;
    if (t - (lastSeAt.get(id) ?? -Infinity) < cooldown) return false;
    lastSeAt.set(id, t);

    while (activeSe.size >= MAX_SE_VOICES) {
      const oldest = activeSe.values().next().value;
      if (!oldest) break;
      stopSeVoice(oldest);
    }

    if (!buf) return synthTick(id);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(seGain);
    const voice = { src, gain: null, id };
    activeSe.add(voice);
    src.onended = () => {
      activeSe.delete(voice);
      try { src.disconnect(); } catch { /* ignore */ }
    };
    try {
      src.start();
      sePlayedCount += 1;
      return true;
    } catch {
      stopSeVoice(voice);
      return false;
    }
  }

  function duck(on) {
    const next = Boolean(on);
    if (ducked === next) return;
    ducked = next;
    if (!isBgmEnabled() || isHidden()) return;
    if (current?.el && !current.el.paused) rampTrackToLive(current, DUCK_RAMP_MS);
    if (current?.synth) current.synth.setVolume(targetBgmGain() * 0.5);
  }

  function refresh() {
    applySeGain();
    if (!isSeEnabled()) stopAllSe();
    else if (unlocked) resumeContextIfAllowed();

    if (!isBgmEnabled() || isHidden()) {
      generation += 1;
      retireCurrent({ immediate: true });
      hardStopAllFading();
      return;
    }
    if (!unlocked || !wanted) return;
    if (current?.id === wanted && (current.synth || (current.el && !current.el.paused))) {
      if (current.el) rampTrackToLive(current, VOLUME_RAMP_MS);
      if (current.synth) current.synth.setVolume(targetBgmGain() * 0.5);
    } else {
      startTrack(wanted, { fadeIn: false });
    }
  }

  function stopBgm() {
    wanted = null;
    generation += 1;
    retireCurrent({ immediate: true });
    hardStopAllFading();
  }

  function stopAll() {
    stopBgm();
    stopAllSe();
  }

  function hush(on) {
    if (on) {
      generation += 1;
      retireCurrent({ immediate: true });
      hardStopAllFading();
      stopAllSe();
      if (ctx && ctx.state === 'running' && typeof ctx.suspend === 'function') {
        try {
          const p = ctx.suspend();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch { /* ignore */ }
      }
    } else if (unlocked) {
      refresh();
    }
  }

  function handleVisibilityChange() {
    hush(isHidden());
  }

  function applyVoice(video, { forceMuted = false } = {}) {
    if (!video) return 0;
    const gain = targetVoiceGain();
    const muted = Boolean(forceMuted || gain <= 0);
    video.muted = muted;
    try { video.volume = gain; } catch { /* ignore */ }
    return muted ? 0 : gain;
  }

  function inspect() {
    const tracks = [];
    let unpausedTracks = 0;
    let activeTracks = 0;
    const recordEl = (role, id, el) => {
      if (!el) return;
      const paused = Boolean(el.paused);
      const muted = Boolean(el.muted);
      const volume = Number(el.volume ?? 0);
      if (!paused) unpausedTracks += 1;
      if (!paused && !muted && volume > 0) activeTracks += 1;
      tracks.push({ role, id, paused, muted, volume });
    };
    if (current?.el) recordEl('current', current.id, current.el);
    for (const entry of fading) recordEl('fading', entry.id, entry.el);
    return {
      unlocked,
      wanted,
      active: current?.id ?? null,
      generation,
      ducked,
      muted: Boolean(s.mute),
      bgmEnabled: isBgmEnabled(),
      seEnabled: isSeEnabled(),
      voiceEnabled: isVoiceEnabled(),
      bgmVolume: bgmPercent(),
      seVolume: sePercent(),
      voiceVolume: voicePercent(),
      bgmGain: targetBgmGain(),
      seGain: targetSeGain(),
      voiceGain: targetVoiceGain(),
      activeTracks,
      unpausedTracks,
      fadingCount: fading.size,
      synthActive: Boolean(current?.synth),
      activeSeCount: activeSe.size,
      sePlayedCount,
      seBlockedCount,
      ctxState: ctx?.state ?? 'none',
      tracks,
    };
  }

  const onGesture = () => {
    if (!canUnlock()) return;
    if (
      !unlocked
      || needsGestureRetry
      || (ctx && ctx.state === 'suspended' && isSeEnabled())
      || (wanted && isBgmEnabled() && !isHidden() && (!current || (current.el && current.el.paused && !current.synth)))
    ) {
      unlock();
    }
  };

  if (bindEvents) {
    for (const type of ['pointerdown', 'keydown', 'click']) {
      window.addEventListener(type, onGesture, { capture: true });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function destroy() {
    stopAll();
    if (bindEvents) {
      for (const type of ['pointerdown', 'keydown', 'click']) {
        window.removeEventListener(type, onGesture, { capture: true });
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  return {
    unlock,
    bgm,
    se,
    duck,
    hush,
    refresh,
    stopBgm,
    stopAll,
    applyVoice,
    voiceVolume: targetVoiceGain,
    isBgmEnabled,
    isSeEnabled,
    isVoiceEnabled,
    inspect,
    handleVisibilityChange,
    destroy,
    get playing() { return current?.id ?? null; },
  };
}

export const audio = createAudioController({ settings, canUnlock: ageConfirmed });

onSettings((key) => {
  if (['bgm', 'se', 'bgmOn', 'seOn', 'mute'].includes(key)) audio.refresh();
});
