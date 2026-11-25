// 声音：单轨 BGM 状态机（带单调会话代际防并发叠音）+ 受设置实时门控的 WebAudio 短音效。
// 首次输入后解锁；静音/关闭立即断声，切场景或切回标签页不会偷跑。
import { settings, SETTINGS_DEFAULTS } from './store.js';

export const BGM = ['title', 'overworld', 'battle', 'boss', 'ending'];
export const SFX = ['click', 'coin', 'combo', 'crit', 'defeat', 'encounter', 'fan1', 'fan2', 'fan3', 'firefx', 'heal', 'heavy', 'hit', 'ke', 'levelup', 'portal', 'quest', 'skill', 'step', 'telegraph', 'thud', 'transform', 'victory', 'waterfx'];
export const MUSIC_GAIN_SCALE = 0.55;

const BGM_SET = new Set(BGM);
const SFX_SET = new Set(SFX);
const FADE_IN_MS = 350;
const MAX_SFX_VOICES = 8;
const SFX_COOLDOWN_MS = {
  step: 140,
  firefx: 130,
  waterfx: 130,
  hit: 110,
  ke: 110,
  crit: 110,
};
const DEFAULT_SFX_COOLDOWN_MS = 50;

function clamp01(v, fallback = 0) {
  if (v == null || v === '' || typeof v === 'boolean') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function createAudioController({
  settings: cfg,
  createAudio = (src) => new Audio(src),
  createContext = () => {
    const Ctor = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    return Ctor ? new Ctor() : null;
  },
  fetchImpl = typeof fetch === 'function' ? (...a) => fetch(...a) : null,
  now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
  scheduleFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16)),
  cancelFrame = (id) => {
    if (id == null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  },
  isHidden = () => (typeof document !== 'undefined' ? !!document.hidden : false),
  bindEvents = typeof window !== 'undefined' && typeof document !== 'undefined',
} = {}) {
  const s = cfg ?? settings;
  let ctx = null;
  let sfxMasterGain = null;
  let compressor = null;
  let unlocked = false;
  let needsGestureRetry = false;
  let wanted = null;
  let active = null;
  let generation = 0;
  let sfxPlayedCount = 0;
  let sfxBlockedCount = 0;

  const tracks = new Map();
  const fades = new Map();
  const buffers = new Map();
  const loadingSfx = new Set();
  const activeSfx = new Set();
  const lastSfxAt = new Map();

  function musicLevel() { return clamp01(s.music, SETTINGS_DEFAULTS.music); }
  function soundLevel() { return clamp01(s.sound, SETTINGS_DEFAULTS.sound); }
  function isMusicEnabled() { return !s.mute && s.musicOn !== false && musicLevel() > 0; }
  function isSfxEnabled() { return !s.mute && s.soundOn !== false && soundLevel() > 0; }
  function targetMusicVolume() { return isMusicEnabled() ? musicLevel() * MUSIC_GAIN_SCALE : 0; }
  function targetSfxVolume() { return isSfxEnabled() ? soundLevel() : 0; }

  function cancelFade(el) {
    const id = fades.get(el);
    if (id != null) {
      cancelFrame(id);
      fades.delete(el);
    }
  }

  function cancelAllFades() {
    for (const [el, id] of fades.entries()) {
      cancelFrame(id);
      fades.delete(el);
    }
  }

  function stopTrackEl(el, { resetTime = false } = {}) {
    if (!el) return;
    cancelFade(el);
    el.muted = true;
    el.volume = 0;
    try { el.pause(); } catch { /* 忽略不支持 pause 的环境 */ }
    if (resetTime) {
      try { if (el.currentTime) el.currentTime = 0; } catch { /* 未加载元数据前不可重置 */ }
    }
  }

  function stopAllTracks({ keep = null, resetStopped = false } = {}) {
    for (const [name, el] of tracks.entries()) {
      if (name === keep) continue;
      stopTrackEl(el, { resetTime: resetStopped });
    }
  }

  function getTrack(name) {
    let el = tracks.get(name);
    if (!el) {
      el = createAudio(`assets/audio/bgm/${name}.mp3`);
      el.loop = true;
      el.preload = 'auto';
      el.muted = true;
      el.volume = 0;
      tracks.set(name, el);
    }
    return el;
  }

  function fadeTo(el, name, gen, dur) {
    cancelFade(el);
    const liveTo = targetMusicVolume();
    if (dur <= 0 || Math.abs(el.volume - liveTo) < 0.001) {
      el.muted = liveTo <= 0;
      el.volume = liveTo;
      if (liveTo <= 0) stopTrackEl(el);
      return;
    }
    const from = el.volume;
    const start = now();
    const step = (ts) => {
      if (active !== name || wanted !== name || isHidden() || !isMusicEnabled()) {
        fades.delete(el);
        stopTrackEl(el);
        return;
      }
      if (gen !== generation) {
        fades.delete(el);
        return;
      }
      const cur = typeof ts === 'number' ? ts : now();
      const t = Math.min(1, Math.max(0, (cur - start) / dur));
      const to = targetMusicVolume();
      el.muted = false;
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) fades.set(el, scheduleFrame(step));
      else fades.delete(el);
    };
    fades.set(el, scheduleFrame(step));
  }

  function syncMusic({ fadeIn = false, resetOutgoing = false } = {}) {
    const gen = ++generation;
    cancelAllFades();

    if (!wanted || !unlocked || isHidden() || !isMusicEnabled()) {
      stopAllTracks({ keep: null, resetStopped: false });
      active = null;
      return;
    }

    const name = wanted;
    const isSwitch = active !== name;
    stopAllTracks({ keep: name, resetStopped: resetOutgoing || isSwitch });

    const el = getTrack(name);
    const vol = targetMusicVolume();

    if (!isSwitch && !el.paused) {
      el.muted = false;
      el.volume = vol;
      needsGestureRetry = false;
      return;
    }

    active = name;
    el.muted = false;
    el.volume = fadeIn ? 0 : vol;

    let res;
    try {
      res = el.play();
    } catch {
      if (gen === generation && active === name) {
        stopTrackEl(el);
        active = null;
        needsGestureRetry = true;
      }
      return;
    }

    const onStarted = () => {
      if (wanted !== name || active !== name || isHidden() || !isMusicEnabled()) {
        stopTrackEl(el);
        if (active === name && (wanted !== name || isHidden() || !isMusicEnabled())) active = null;
        return;
      }
      if (gen !== generation) return;
      needsGestureRetry = false;
      const liveVol = targetMusicVolume();
      if (liveVol <= 0) {
        stopTrackEl(el);
        active = null;
        return;
      }
      el.muted = false;
      if (fadeIn) fadeTo(el, name, gen, FADE_IN_MS);
      else el.volume = liveVol;
    };

    if (res && typeof res.then === 'function') {
      res.then(onStarted, () => {
        if (active === name && (gen === generation || (el.paused && isMusicEnabled() && !isHidden()))) {
          stopTrackEl(el);
          active = null;
          needsGestureRetry = true;
        }
      });
    } else {
      onStarted();
    }
  }

  function applySfxGain() {
    if (!sfxMasterGain) return;
    const vol = targetSfxVolume();
    try {
      if (sfxMasterGain.gain && typeof sfxMasterGain.gain.setValueAtTime === 'function' && ctx && typeof ctx.currentTime === 'number') {
        sfxMasterGain.gain.setValueAtTime(vol, ctx.currentTime);
      }
      if (sfxMasterGain.gain) sfxMasterGain.gain.value = vol;
    } catch { /* 忽略已关闭上下文 */ }
  }

  function stopVoice(voice) {
    activeSfx.delete(voice);
    try { voice.src.onended = null; } catch { /* ignore */ }
    try { voice.src.stop(); } catch { /* ignore */ }
    try { voice.src.disconnect(); } catch { /* ignore */ }
    try { voice.gain.disconnect(); } catch { /* ignore */ }
  }

  function stopAllSfx() {
    for (const voice of [...activeSfx]) stopVoice(voice);
  }

  function ensureContext() {
    if (ctx) return ctx;
    try {
      ctx = createContext();
      if (!ctx) return null;
      sfxMasterGain = ctx.createGain();
      applySfxGain();
      if (typeof ctx.createDynamicsCompressor === 'function') {
        compressor = ctx.createDynamicsCompressor();
        if (compressor.threshold) compressor.threshold.value = -12;
        if (compressor.knee) compressor.knee.value = 18;
        if (compressor.ratio) compressor.ratio.value = 6;
        if (compressor.attack) compressor.attack.value = 0.003;
        if (compressor.release) compressor.release.value = 0.15;
        sfxMasterGain.connect(compressor);
        compressor.connect(ctx.destination);
      } else {
        sfxMasterGain.connect(ctx.destination);
      }
    } catch {
      ctx = null;
      sfxMasterGain = null;
      compressor = null;
    }
    return ctx;
  }

  async function loadSfx(name) {
    if (buffers.has(name) || loadingSfx.has(name) || !ctx || !fetchImpl) return;
    loadingSfx.add(name);
    try {
      const res = await fetchImpl(`assets/audio/sfx/${name}.mp3`);
      if (res && res.ok === false) return;
      const ab = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(ab);
      if (decoded) buffers.set(name, decoded);
    } catch {
      // 读不出就保持安静，不影响游玩
    } finally {
      loadingSfx.delete(name);
    }
  }

  function resumeContextIfAllowed() {
    if (!ctx || isHidden() || !isSfxEnabled()) return;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => { needsGestureRetry = true; });
      } catch {
        needsGestureRetry = true;
      }
    }
  }

  function unlock() {
    const first = !unlocked;
    unlocked = true;
    const hadCtx = !!ctx;
    ensureContext();
    applySfxGain();
    resumeContextIfAllowed();
    if (!hadCtx && ctx) {
      for (const name of SFX) loadSfx(name);
    }
    if (first || needsGestureRetry || (wanted && isMusicEnabled() && (!active || tracks.get(active)?.paused))) {
      syncMusic({ fadeIn: first });
    }
  }

  function music(name) {
    if (!BGM_SET.has(name)) return;
    const changed = wanted !== name;
    wanted = name;
    if (!unlocked) return;
    syncMusic({ fadeIn: changed, resetOutgoing: changed });
  }

  function sfx(name, { volume = 1, rate = 1 } = {}) {
    if (!SFX_SET.has(name)) return false;
    if (!isSfxEnabled()) {
      sfxBlockedCount += 1;
      return false;
    }
    if (isHidden()) return false;
    if (!ctx || !sfxMasterGain) return false;
    if (ctx.state && ctx.state !== 'running') return false;

    const buf = buffers.get(name);
    if (!buf) {
      loadSfx(name);
      return false;
    }

    const t = now();
    const cooldown = SFX_COOLDOWN_MS[name] ?? DEFAULT_SFX_COOLDOWN_MS;
    if (t - (lastSfxAt.get(name) ?? -Infinity) < cooldown) return false;
    lastSfxAt.set(name, t);

    while (activeSfx.size >= MAX_SFX_VOICES) {
      const oldest = activeSfx.values().next().value;
      if (!oldest) break;
      stopVoice(oldest);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (src.playbackRate) {
      src.playbackRate.value = Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
    }
    const gain = ctx.createGain();
    if (gain.gain) gain.gain.value = clamp01(volume, 1);
    src.connect(gain);
    gain.connect(sfxMasterGain);

    const voice = { src, gain, name, startedAt: t };
    activeSfx.add(voice);
    src.onended = () => {
      activeSfx.delete(voice);
      try { src.disconnect(); } catch { /* ignore */ }
      try { gain.disconnect(); } catch { /* ignore */ }
    };
    try {
      src.start();
      sfxPlayedCount += 1;
      return true;
    } catch {
      stopVoice(voice);
      return false;
    }
  }

  function refresh() {
    applySfxGain();
    if (!isSfxEnabled()) stopAllSfx();
    else if (unlocked) resumeContextIfAllowed();
    syncMusic({ fadeIn: false, resetOutgoing: false });
  }

  function stopMusic() {
    wanted = null;
    generation += 1;
    cancelAllFades();
    stopAllTracks({ keep: null, resetStopped: true });
    active = null;
  }

  function stopAll() {
    stopMusic();
    stopAllSfx();
  }

  function handleVisibilityChange() {
    if (isHidden()) {
      generation += 1;
      cancelAllFades();
      stopAllTracks({ keep: null, resetStopped: false });
      active = null;
      stopAllSfx();
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

  function inspect() {
    const trackSnapshot = {};
    let unpausedTracks = 0;
    let activeTracks = 0;
    for (const [name, el] of tracks.entries()) {
      const paused = !!el.paused;
      const muted = !!el.muted;
      const volume = Number(el.volume ?? 0);
      if (!paused) unpausedTracks += 1;
      if (!paused && !muted && volume > 0) activeTracks += 1;
      trackSnapshot[name] = { paused, muted, volume };
    }
    return {
      unlocked,
      wanted,
      active,
      generation,
      muted: Boolean(s.mute),
      musicEnabled: isMusicEnabled(),
      sfxEnabled: isSfxEnabled(),
      musicVolume: musicLevel(),
      sfxVolume: soundLevel(),
      musicGain: targetMusicVolume(),
      sfxGain: targetSfxVolume(),
      activeTracks,
      unpausedTracks,
      activeSfxCount: activeSfx.size,
      sfxPlayedCount,
      sfxBlockedCount,
      ctxState: ctx?.state ?? 'none',
      tracks: trackSnapshot,
    };
  }

  const onGesture = () => {
    if (
      !unlocked ||
      needsGestureRetry ||
      (ctx && ctx.state === 'suspended' && isSfxEnabled()) ||
      (wanted && isMusicEnabled() && !isHidden() && (!active || tracks.get(active)?.paused))
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
    music,
    sfx,
    refresh,
    stopMusic,
    stopAll,
    inspect,
    handleVisibilityChange,
    destroy,
  };
}

export const audio = createAudioController({ settings });
