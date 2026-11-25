import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, clampNumber, normalizeSettings } from '../js/store.js';
import { createAudioController, BGM_GAIN_SCALE, SE_GAIN_SCALE, DUCK_SCALE } from '../js/audio.js';

function createFakeAudio(src, playImpl) {
  const listeners = new Map();
  const el = {
    src,
    preload: '',
    paused: true,
    muted: false,
    volume: 1,
    currentTime: 0,
    playCalls: 0,
    pauseCalls: 0,
    addEventListener(type, fn, opts) {
      const list = listeners.get(type) ?? [];
      list.push({ fn, once: Boolean(opts?.once) });
      listeners.set(type, list);
    },
    emit(type) {
      const list = listeners.get(type) ?? [];
      listeners.set(type, list.filter((x) => !x.once));
      for (const item of list) item.fn();
    },
    removeAttribute(attr) {
      if (attr === 'src') this.src = '';
    },
    load() {},
    play() {
      this.playCalls += 1;
      if (playImpl) return playImpl(this);
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
  };
  return el;
}

function createFakeContext(initialState = 'running') {
  const sources = [];
  const oscillators = [];
  const gains = [];
  const ctx = {
    state: initialState,
    currentTime: 1,
    destination: { kind: 'dest' },
    suspendCalls: 0,
    resumeCalls: 0,
    sources,
    oscillators,
    gains,
    createGain() {
      const g = {
        connected: [],
        disconnected: false,
        gain: {
          value: 1,
          setValueAtTime(v) { this.value = v; },
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
          setTargetAtTime(v) { this.value = v; },
        },
        connect(target) { this.connected.push(target); return target; },
        disconnect() { this.disconnected = true; },
      };
      gains.push(g);
      return g;
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect(target) { return target; },
        disconnect() {},
      };
    },
    createBufferSource() {
      const src = {
        buffer: null,
        started: false,
        stopped: false,
        disconnected: false,
        onended: null,
        connect(target) { this.target = target; return target; },
        disconnect() { this.disconnected = true; },
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      sources.push(src);
      return src;
    },
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime(v) { this.value = v; } },
        started: false,
        stopped: false,
        disconnected: false,
        onended: null,
        connect(target) { this.target = target; return target; },
        disconnect() { this.disconnected = true; },
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      oscillators.push(osc);
      return osc;
    },
    async decodeAudioData(data) {
      return { decoded: data };
    },
    suspend() {
      this.suspendCalls += 1;
      this.state = 'suspended';
      return Promise.resolve();
    },
    resume() {
      this.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    },
  };
  return ctx;
}

function createManualClock() {
  let t = 1000;
  let nextId = 1;
  const timers = new Map();
  const ticks = new Map();
  return {
    now: () => t,
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, at: t + ms });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    setTick(fn, ms) {
      const id = nextId++;
      ticks.set(id, { fn, ms, next: t + ms });
      return id;
    },
    clearTick(id) { ticks.delete(id); },
    advance(ms) {
      const target = t + ms;
      while (t < target) {
        t = Math.min(target, t + 40);
        for (const [id, item] of [...timers.entries()]) {
          if (item.at <= t) {
            timers.delete(id);
            item.fn();
          }
        }
        for (const [id, item] of [...ticks.entries()]) {
          if (ticks.has(id) && item.next <= t) {
            item.next = t + item.ms;
            item.fn();
          }
        }
      }
    },
    timerCount: () => timers.size,
    tickCount: () => ticks.size,
  };
}

test('normalizeSettings rejects null, empty string, booleans, NaN and clamps out-of-range values', () => {
  assert.equal(clampNumber(null, 0, 100, 60), 60);
  assert.equal(clampNumber('', 0, 100, 60), 60);
  assert.equal(clampNumber(false, 0, 100, 60), 60);
  assert.equal(clampNumber(true, 0, 100, 60), 60);
  assert.equal(clampNumber('oops', 0, 100, 60), 60);
  assert.equal(clampNumber(NaN, 0, 100, 60), 60);
  assert.equal(clampNumber(200, 0, 100, 60), 100);
  assert.equal(clampNumber(-20, 0, 100, 60), 0);

  const fromCorrupt = normalizeSettings({
    bgm: null,
    se: '',
    voice: 200,
    textSpeed: 'bad',
    bgmOn: 'yes',
    mute: 1,
  });
  assert.equal(fromCorrupt.bgm, DEFAULT_SETTINGS.bgm);
  assert.equal(fromCorrupt.se, DEFAULT_SETTINGS.se);
  assert.equal(fromCorrupt.voice, 100);
  assert.equal(fromCorrupt.textSpeed, DEFAULT_SETTINGS.textSpeed);
  assert.equal(fromCorrupt.bgmOn, true);
  assert.equal(fromCorrupt.mute, false);

  // Backward-compatible legacy save without bgmOn / seOn / voiceOn / mute
  const legacy = normalizeSettings({ bgm: 45, se: 80, voice: 90, adult: false });
  assert.equal(legacy.bgm, 45);
  assert.equal(legacy.se, 80);
  assert.equal(legacy.voice, 90);
  assert.equal(legacy.bgmOn, true);
  assert.equal(legacy.seOn, true);
  assert.equal(legacy.voiceOn, true);
  assert.equal(legacy.mute, false);
  assert.equal(legacy.adult, false);

  // Non-object localStorage payload
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings([]), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings('bad'), DEFAULT_SETTINGS);
});

test('async play() race on rapid title -> daily switch never revives stale track', async () => {
  const clock = createManualClock();
  const created = [];
  let resolveTitlePlay;
  const cfg = normalizeSettings({ bgm: 60, se: 70, voice: 85 });

  const ctrl = createAudioController({
    settings: cfg,
    createAudio: (src) => {
      const el = createFakeAudio(src, (self) => {
        if (src.includes('title')) {
          self.paused = false;
          return new Promise((r) => { resolveTitlePlay = r; });
        }
        self.paused = false;
        return Promise.resolve();
      });
      created.push(el);
      return el;
    },
    createContext: () => createFakeContext('running'),
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setTick: clock.setTick,
    clearTick: clock.clearTick,
    bindEvents: false,
  });

  ctrl.bgm('title');
  ctrl.unlock();
  assert.equal(created.length, 1);

  // Switch immediately to daily while title's play() is still pending at vol=0
  ctrl.bgm('daily');
  await Promise.resolve();
  resolveTitlePlay();
  await Promise.resolve();
  clock.advance(1000);

  assert.equal(created.length, 2);
  const [titleEl, dailyEl] = created;
  assert.equal(titleEl.paused, true);
  assert.equal(titleEl.muted, true);
  assert.equal(titleEl.volume, 0);
  assert.equal(dailyEl.paused, false);
  assert.equal(dailyEl.muted, false);
  assert.ok(Math.abs(dailyEl.volume - 0.6 * BGM_GAIN_SCALE) < 0.01);
  assert.equal(ctrl.inspect().unpausedTracks, 1);
  assert.equal(ctrl.inspect().fadingCount, 0);
});

test('bgm=0 / mute / bgmOn=false / hidden immediately hard-stops both current and crossfading tracks, synth, and gapTimer', async () => {
  const clock = createManualClock();
  const created = [];
  let hidden = false;
  const fakeCtx = createFakeContext('running');
  const cfg = normalizeSettings({ bgm: 60, se: 70, voice: 85 });

  const ctrl = createAudioController({
    settings: cfg,
    createAudio: (src) => {
      const el = createFakeAudio(src);
      created.push(el);
      return el;
    },
    createContext: () => fakeCtx,
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setTick: clock.setTick,
    clearTick: clock.clearTick,
    isHidden: () => hidden,
    bindEvents: false,
  });

  ctrl.bgm('title');
  ctrl.unlock();
  await Promise.resolve();
  clock.advance(1000);
  assert.ok(created[0].volume > 0.5);

  // Start crossfade to daily -> title enters fading
  ctrl.bgm('daily');
  await Promise.resolve();
  clock.advance(120);
  assert.equal(ctrl.inspect().fadingCount, 1);

  // Tab hidden mid-crossfade -> BOTH title (fading) and daily (current) immediately muted & paused, ctx suspended
  hidden = true;
  ctrl.handleVisibilityChange();
  assert.equal(created[0].paused, true);
  assert.equal(created[0].muted, true);
  assert.equal(created[0].volume, 0);
  assert.equal(created[1].paused, true);
  assert.equal(created[1].muted, true);
  assert.equal(created[1].volume, 0);
  assert.equal(ctrl.inspect().unpausedTracks, 0);
  assert.equal(ctrl.inspect().fadingCount, 0);
  assert.equal(fakeCtx.state, 'suspended');

  // Set bgm = 0 before returning visible -> visibilitychange MUST NOT resume playback
  cfg.bgm = 0;
  ctrl.refresh();
  hidden = false;
  ctrl.handleVisibilityChange();
  await Promise.resolve();
  assert.equal(ctrl.inspect().unpausedTracks, 0);
  assert.equal(created.length, 2);

  // Switching track while bgm === 0 MUST NOT create or play audio
  ctrl.bgm('night');
  assert.equal(created.length, 2);
  assert.equal(ctrl.inspect().unpausedTracks, 0);

  // Re-enable bgm -> plays night; fire 'ended' then hide tab during LOOP_GAP -> gapTimer must NOT restart while hidden
  cfg.bgm = 60;
  ctrl.refresh();
  await Promise.resolve();
  clock.advance(200);
  const nightEl = created[2];
  assert.equal(nightEl.paused, false);
  nightEl.emit('ended');
  hidden = true;
  ctrl.handleVisibilityChange();
  const playsBeforeGap = nightEl.playCalls;
  clock.advance(2000);
  assert.equal(nightEl.playCalls, playsBeforeGap);
  assert.equal(nightEl.paused, true);

  // Fallback synth stops cleanly on mute
  hidden = false;
  ctrl.refresh();
  await Promise.resolve();
  const retryEl = created[3];
  retryEl.emit('error');
  assert.equal(ctrl.inspect().synthActive, true);
  assert.ok(fakeCtx.oscillators.length >= 1);
  cfg.mute = true;
  ctrl.refresh();
  assert.equal(ctrl.inspect().synthActive, false);
  assert.equal(fakeCtx.oscillators[0].stopped, true);
});

test('unlock recovers after NotAllowedError rejection and OS interruption pause', async () => {
  const clock = createManualClock();
  const created = [];
  let rejectNext = true;
  const cfg = normalizeSettings({ bgm: 60, se: 70, voice: 85 });

  const ctrl = createAudioController({
    settings: cfg,
    createAudio: (src) => {
      const el = createFakeAudio(src, (self) => {
        if (rejectNext) {
          rejectNext = false;
          self.paused = true;
          return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
        }
        self.paused = false;
        return Promise.resolve();
      });
      created.push(el);
      return el;
    },
    createContext: () => createFakeContext('running'),
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setTick: clock.setTick,
    clearTick: clock.clearTick,
    bindEvents: false,
  });

  ctrl.bgm('title');
  ctrl.unlock();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(ctrl.inspect().active, null);
  assert.equal(created[0].paused, true);

  // Next gesture calls unlock() -> retries and succeeds
  ctrl.unlock();
  await Promise.resolve();
  clock.advance(1000);
  assert.equal(ctrl.inspect().active, 'title');
  assert.equal(created[1].paused, false);
  assert.ok(created[1].volume > 0.5);

  // Simulate OS interruption pausing active <audio> -> subsequent unlock() recovers
  created[1].pause();
  assert.equal(created[1].paused, true);
  ctrl.unlock();
  await Promise.resolve();
  clock.advance(1000);
  assert.equal(ctrl.inspect().active, 'title');
  assert.equal(created[2].paused, false);
});

test('SFX guards suspended AudioContext, enforces cooldown & 8-voice cap, stops active voices on mute, and avoids synthTick while loading', async () => {
  const clock = createManualClock();
  const fakeCtx = createFakeContext('suspended');
  const cfg = normalizeSettings({ bgm: 60, se: 70, voice: 85 });
  let resolveClick;

  const ctrl = createAudioController({
    settings: cfg,
    createAudio: (src) => createFakeAudio(src),
    createContext: () => fakeCtx,
    fetchImpl: (url) => {
      if (url.includes('gust')) return Promise.resolve({ ok: false });
      if (url.includes('click')) {
        return new Promise((r) => {
          resolveClick = () => r({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
        });
      }
      return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setTick: clock.setTick,
    clearTick: clock.clearTick,
    bindEvents: false,
  });

  // Unlock while suspended (simulate resume not yet finished by forcing suspended right after)
  ctrl.unlock();
  fakeCtx.state = 'suspended';
  assert.equal(ctrl.se('page'), false);
  assert.equal(fakeCtx.sources.length, 0);
  assert.equal(fakeCtx.oscillators.length, 0);

  // Running, but 'click' is still loading -> must NOT blast synthTick while fetch is pending
  fakeCtx.state = 'running';
  assert.equal(ctrl.se('click'), false);
  assert.equal(fakeCtx.oscillators.length, 0);

  // Finish decoding 'click' and all other SE buffers
  resolveClick();
  await new Promise((r) => setTimeout(r, 0));

  // 'gust' actually failed fetch -> falls back to synthTick cleanly
  assert.equal(ctrl.se('gust'), true);
  assert.equal(fakeCtx.oscillators.length, 1);

  // Cooldown: immediate second click within 70ms is throttled
  assert.equal(ctrl.se('click'), true);
  assert.equal(ctrl.se('click'), false);
  clock.advance(80);
  assert.equal(ctrl.se('click'), true);

  // Voice cap (MAX 8) across distinct SE ids
  const ids = ['page', 'choice', 'chapter', 'ending', 'save', 'flare', 'gust', 'click', 'page'];
  for (const id of ids) {
    clock.advance(250);
    ctrl.se(id);
  }
  assert.ok(ctrl.inspect().activeSeCount <= 8);

  // Muting immediately stops all active SFX (both buffer sources and synthTick oscillators) and sets seGain to 0
  cfg.seOn = false;
  ctrl.refresh();
  assert.equal(ctrl.inspect().activeSeCount, 0);
  assert.equal(fakeCtx.gains[0].gain.value, 0);
  assert.equal(ctrl.se('click'), false);
  assert.ok(ctrl.inspect().seBlockedCount >= 1);
  assert.ok(fakeCtx.sources.every((s) => s.stopped));
  assert.ok(fakeCtx.oscillators.every((o) => o.stopped));
});

test('bgm(null) stops playing track cleanly, ducking scales live volume, and applyVoice sets muted & clamped volume', async () => {
  const clock = createManualClock();
  const created = [];
  const cfg = normalizeSettings({ bgm: 100, se: 70, voice: 85 });

  const ctrl = createAudioController({
    settings: cfg,
    createAudio: (src) => {
      const el = createFakeAudio(src);
      created.push(el);
      return el;
    },
    createContext: () => createFakeContext('running'),
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setTick: clock.setTick,
    clearTick: clock.clearTick,
    bindEvents: false,
  });

  ctrl.bgm('title');
  ctrl.unlock();
  await Promise.resolve();
  clock.advance(1000);
  assert.equal(ctrl.playing, 'title');
  assert.ok(Math.abs(created[0].volume - BGM_GAIN_SCALE) < 0.01);

  // Ducking
  ctrl.duck(true);
  clock.advance(450);
  assert.ok(Math.abs(created[0].volume - BGM_GAIN_SCALE * DUCK_SCALE) < 0.01);
  ctrl.duck(false);
  clock.advance(450);
  assert.ok(Math.abs(created[0].volume - BGM_GAIN_SCALE) < 0.01);

  // Pause title in gallery via bgm(null)
  ctrl.bgm(null);
  assert.equal(ctrl.playing, null);
  clock.advance(1000);
  assert.equal(created[0].paused, true);
  assert.equal(created[0].muted, true);

  // applyVoice on <video>
  const video = { muted: false, volume: 1 };
  ctrl.applyVoice(video);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 0.85);

  cfg.voice = 0;
  ctrl.applyVoice(video);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0);

  cfg.voice = 80;
  cfg.voiceOn = false;
  ctrl.applyVoice(video);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0);

  cfg.voiceOn = true;
  cfg.mute = true;
  ctrl.applyVoice(video);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0);

  cfg.mute = false;
  cfg.voice = 'oops';
  ctrl.applyVoice(video);
  assert.equal(video.muted, false);
  assert.equal(video.volume, DEFAULT_SETTINGS.voice / 100);
  assert.equal(ctrl.inspect().seGain, (70 / 100) * SE_GAIN_SCALE);
});
