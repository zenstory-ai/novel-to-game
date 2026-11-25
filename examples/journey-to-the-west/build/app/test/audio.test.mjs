// 声音引擎与设置回归：单轨 BGM 独占、异步切轨防叠音、静音/关开关/拖音量即时生效、切场景与回标签不偷跑、SFX 实时门控与限流、设置持久化。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioController, MUSIC_GAIN_SCALE } from '../js/core/audio.js';
import { normalizeSettings, SETTINGS_DEFAULTS, settings, saveSettings, reloadSettings } from '../js/core/store.js';

function createFakeAudio(src, { deferredPlay = false, rejectNextPlay = false } = {}) {
  const el = {
    src,
    loop: false,
    preload: 'none',
    volume: 1,
    muted: false,
    paused: true,
    currentTime: 0,
    playCalls: 0,
    pauseCalls: 0,
    pendingPlays: [],
    rejectNext: rejectNextPlay,
    play() {
      this.playCalls += 1;
      if (this.rejectNext) {
        this.rejectNext = false;
        this.paused = true;
        return Promise.reject(new Error('NotAllowedError'));
      }
      this.paused = false;
      if (!deferredPlay) return Promise.resolve();
      return new Promise((resolve, reject) => {
        this.pendingPlays.push({ resolve, reject });
      });
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
  };
  return el;
}

function createFakeContext({ state = 'running' } = {}) {
  const sources = [];
  const gains = [];
  const ctx = {
    state,
    currentTime: 0,
    destination: { id: 'dest' },
    resumeCalls: 0,
    suspendCalls: 0,
    sources,
    gains,
    createGain() {
      const g = {
        gain: {
          value: 1,
          setValueAtTime(v) { this.value = v; },
        },
        connectedTo: null,
        disconnected: false,
        connect(target) { this.connectedTo = target; return target; },
        disconnect() { this.disconnected = true; },
      };
      gains.push(g);
      return g;
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 1 },
        attack: { value: 0 },
        release: { value: 0 },
        connect(target) { return target; },
      };
    },
    createBufferSource() {
      const s = {
        buffer: null,
        playbackRate: { value: 1 },
        started: false,
        stopped: false,
        disconnected: false,
        onended: null,
        connect(target) { return target; },
        disconnect() { this.disconnected = true; },
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      sources.push(s);
      return s;
    },
    async decodeAudioData(ab) {
      return { decoded: true, bytes: ab.byteLength };
    },
    resume() {
      this.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      this.suspendCalls += 1;
      this.state = 'suspended';
      return Promise.resolve();
    },
  };
  return ctx;
}

function makeHarness({ cfg = {}, deferredPlay = false, ctxState = 'running' } = {}) {
  const s = normalizeSettings(cfg);
  const created = new Map();
  let fakeNow = 1000;
  let hidden = false;
  let nextFrameId = 1;
  const frames = new Map();
  let ctx = null;

  const ctrl = createAudioController({
    settings: s,
    createAudio: (src) => {
      const el = createFakeAudio(src, { deferredPlay });
      created.set(src, el);
      return el;
    },
    createContext: () => {
      ctx = createFakeContext({ state: ctxState });
      return ctx;
    },
    fetchImpl: async () => ({
      ok: true,
      async arrayBuffer() { return new ArrayBuffer(16); },
    }),
    now: () => fakeNow,
    scheduleFrame: (fn) => {
      const id = nextFrameId++;
      frames.set(id, fn);
      return id;
    },
    cancelFrame: (id) => {
      frames.delete(id);
    },
    isHidden: () => hidden,
    bindEvents: false,
  });

  const stepFrames = (dtMs, count = 1) => {
    for (let i = 0; i < count; i += 1) {
      fakeNow += dtMs;
      const batch = [...frames.entries()];
      frames.clear();
      for (const [, fn] of batch) fn(fakeNow);
    }
  };

  return {
    s,
    ctrl,
    created,
    frames,
    get ctx() { return ctx; },
    get now() { return fakeNow; },
    advance(ms) { fakeNow += ms; },
    stepFrames,
    setHidden(v) { hidden = v; ctrl.handleVisibilityChange(); },
    track(name) { return created.get(`assets/audio/bgm/${name}.mp3`); },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test('单轨 BGM 独占：开局首点同时触发 unlock(title) 与切到 overworld，旧轨异步 resolve 绝不叠音也不成孤儿轨', async () => {
  const h = makeHarness({ deferredPlay: true });
  h.ctrl.music('title');
  h.ctrl.unlock();
  const titleEl = h.track('title');
  assert.ok(titleEl, 'title track created on unlock');
  assert.equal(titleEl.pendingPlays.length, 1);

  // 同一次点击进入大地图，立刻切到 overworld
  h.ctrl.music('overworld');
  const overworldEl = h.track('overworld');
  assert.equal(titleEl.paused, true, 'outgoing title paused immediately');
  assert.equal(titleEl.muted, true, 'outgoing title muted immediately');
  assert.equal(h.ctrl.inspect().unpausedTracks, 1);

  // 旧轨 title.play() 晚于切轨才 resolve
  titleEl.pendingPlays.shift().resolve();
  overworldEl.pendingPlays.shift().resolve();
  await flush();
  h.stepFrames(200, 3);

  assert.equal(titleEl.paused, true, 'stale title resolution must stay paused');
  assert.equal(titleEl.volume, 0, 'stale title volume must remain 0');
  assert.equal(overworldEl.paused, false, 'overworld is the sole active track');
  assert.ok(Math.abs(overworldEl.volume - h.s.music * MUSIC_GAIN_SCALE) < 1e-6);
  assert.equal(h.ctrl.inspect().unpausedTracks, 1);
  assert.equal(h.ctrl.inspect().activeTracks, 1);
});

test('快速连切多首 BGM（含 A->B->A）始终最多只有一轨在播', async () => {
  const h = makeHarness({ deferredPlay: true });
  h.ctrl.unlock();
  for (const name of ['title', 'overworld', 'battle', 'boss', 'overworld', 'ending', 'title']) {
    h.ctrl.music(name);
    assert.ok(h.ctrl.inspect().unpausedTracks <= 1, `at most 1 track unpaused after switching to ${name}`);
  }
  // 逆序让所有旧 play() 全部 resolve
  for (const el of h.created.values()) {
    while (el.pendingPlays.length) el.pendingPlays.shift().resolve();
  }
  await flush();
  h.stepFrames(200, 3);

  const snap = h.ctrl.inspect();
  assert.equal(snap.wanted, 'title');
  assert.equal(snap.active, 'title');
  assert.equal(snap.unpausedTracks, 1);
  assert.equal(snap.activeTracks, 1);
  for (const [name, info] of Object.entries(snap.tracks)) {
    if (name === 'title') {
      assert.equal(info.paused, false);
      assert.equal(info.muted, false);
    } else {
      assert.equal(info.paused, true, `${name} must be paused`);
      assert.equal(info.muted, true, `${name} must be muted`);
      assert.equal(info.volume, 0, `${name} volume must be 0`);
    }
  }
});

test('渐入中途拖音量或静音，不会被旧淡入帧覆盖，也不会误停当前轨', async () => {
  const h = makeHarness({ deferredPlay: true });
  h.ctrl.music('overworld');
  h.ctrl.unlock();
  const el = h.track('overworld');

  // play() 尚未 resolve 时拖低音量到 30%
  h.s.music = 0.3;
  h.ctrl.refresh();
  assert.equal(el.paused, false);
  assert.ok(Math.abs(el.volume - 0.3 * MUSIC_GAIN_SCALE) < 1e-6);

  // 旧的 play() resolve 后不该把轨停掉，也不该覆盖音量
  el.pendingPlays.shift().resolve();
  await flush();
  h.stepFrames(100, 5);
  assert.equal(el.paused, false);
  assert.ok(Math.abs(el.volume - 0.3 * MUSIC_GAIN_SCALE) < 1e-6);

  // 切轨进入淡入中途立刻静音：立即断声且无残留淡入帧
  h.ctrl.music('battle');
  const battleEl = h.track('battle');
  battleEl.pendingPlays.shift().resolve();
  await flush();
  h.stepFrames(80, 1);
  assert.ok(h.frames.size > 0, 'fade-in should be running');

  h.s.mute = true;
  h.ctrl.refresh();
  assert.equal(h.frames.size, 0, 'all fade frames cancelled on mute');
  assert.equal(battleEl.paused, true);
  assert.equal(battleEl.muted, true);
  assert.equal(battleEl.volume, 0);
  assert.equal(h.ctrl.inspect().unpausedTracks, 0);
  assert.equal(h.ctrl.inspect().musicGain, 0);
});

test('音乐独立开关关闭或静音后：切场景、切回标签页绝不偷跑 BGM；重开立刻播当前场景曲目', async () => {
  const h = makeHarness();
  h.ctrl.music('title');
  h.ctrl.unlock();
  await flush();
  h.stepFrames(200, 3);
  assert.equal(h.ctrl.inspect().activeTracks, 1);

  // 关闭音乐开关（保留音效开启）
  h.s.musicOn = false;
  h.ctrl.refresh();
  assert.equal(h.ctrl.inspect().unpausedTracks, 0);
  assert.equal(h.ctrl.inspect().musicGain, 0);
  assert.equal(h.ctrl.inspect().sfxEnabled, true);

  // 连续切场景：全程保持零轨播放
  for (const next of ['overworld', 'battle', 'boss']) {
    h.ctrl.music(next);
    await flush();
    assert.equal(h.ctrl.inspect().unpausedTracks, 0, `must stay silent on ${next}`);
    assert.equal(h.ctrl.inspect().wanted, next);
  }

  // 切离再切回标签页：仍保持静音
  h.setHidden(true);
  h.setHidden(false);
  await flush();
  assert.equal(h.ctrl.inspect().unpausedTracks, 0);

  // 重新打开音乐开关：立刻播放最新的 boss 曲目
  h.s.musicOn = true;
  h.ctrl.refresh();
  await flush();
  assert.equal(h.ctrl.inspect().active, 'boss');
  assert.equal(h.ctrl.inspect().unpausedTracks, 1);
  assert.equal(h.track('boss').paused, false);
  assert.ok(Math.abs(h.track('boss').volume - h.s.music * MUSIC_GAIN_SCALE) < 1e-6);
});

test('SFX 实时门控：关闭音效或静音会立刻掐断正在播的长音效并拦截新音效，重开立刻恢复', async () => {
  const h = makeHarness();
  h.ctrl.unlock();
  await flush(); // 等待 decodeAudioData

  assert.equal(h.ctrl.sfx('victory'), true);
  assert.equal(h.ctrl.inspect().activeSfxCount, 1);
  assert.equal(h.ctx.gains[0].gain.value, h.s.sound);
  const firstSrc = h.ctx.sources[0];
  assert.equal(firstSrc.stopped, false);

  // 播放中途关闭音效开关：主增益归零且正在播的音源被立即 stop()
  h.s.soundOn = false;
  h.ctrl.refresh();
  assert.equal(h.ctx.gains[0].gain.value, 0);
  assert.equal(firstSrc.stopped, true);
  assert.equal(h.ctrl.inspect().activeSfxCount, 0);

  // 关闭期间触发新音效必须被拦截
  h.advance(500);
  assert.equal(h.ctrl.sfx('hit'), false);
  assert.equal(h.ctrl.inspect().sfxBlockedCount, 1);
  assert.equal(h.ctx.sources.length, 1);

  // 重开并调低音量到 40%
  h.s.soundOn = true;
  h.s.sound = 0.4;
  h.ctrl.refresh();
  assert.equal(h.ctx.gains[0].gain.value, 0.4);
  h.advance(500);
  assert.equal(h.ctrl.sfx('hit'), true);
  assert.equal(h.ctx.sources.length, 2);
});

test('SFX 卫生：AudioContext 处于 suspended 时不积压播放；同音效短时间连发去重；并发数有上限', async () => {
  const h = makeHarness({ ctxState: 'suspended' });
  h.ctrl.unlock();
  // unlock 会尝试 resume，手动模拟浏览器把 ctx 重新挂起
  h.ctx.state = 'suspended';
  await flush();
  assert.equal(h.ctrl.sfx('hit'), false, 'must not queue SFX while AudioContext is suspended');
  assert.equal(h.ctx.sources.length, 0);

  // 恢复运行后：同音效 70ms 内连发会被冷却去重（防止 AoE 叠音爆音）
  h.ctx.state = 'running';
  assert.equal(h.ctrl.sfx('firefx'), true);
  h.advance(70);
  assert.equal(h.ctrl.sfx('firefx'), false, 'duplicate firefx within cooldown suppressed');
  h.advance(70);
  assert.equal(h.ctrl.sfx('firefx'), true, 'firefx allowed after cooldown');

  // 不同音效连续爆发不超过最大并发上限（8）
  const distinct = ['click', 'coin', 'combo', 'crit', 'heal', 'heavy', 'ke', 'portal', 'quest', 'skill'];
  for (const name of distinct) {
    h.advance(20);
    h.ctrl.sfx(name);
  }
  assert.ok(h.ctrl.inspect().activeSfxCount <= 8, 'active SFX voices capped at 8');
});

test('设置规范化与跨重载持久化：null/空串/布尔/非法值回退默认值，合法值被夹紧，旧存档兼容，重载后设置不丢失', () => {
  const cleaned = normalizeSettings({ music: 2.5, sound: -1, mute: 1, speed: 99, seen: 'bad' });
  assert.equal(cleaned.music, 1);
  assert.equal(cleaned.sound, 0);
  assert.equal(cleaned.musicOn, true);
  assert.equal(cleaned.soundOn, true);
  assert.equal(cleaned.mute, true);
  assert.equal(cleaned.speed, 1);
  assert.deepEqual(cleaned.seen, {});

  // JSON.stringify(NaN) 会存成 null，不能误当作 0 静音
  const fromNull = normalizeSettings({ music: null, sound: '', mute: false });
  assert.equal(fromNull.music, SETTINGS_DEFAULTS.music);
  assert.equal(fromNull.sound, SETTINGS_DEFAULTS.sound);
  const fromBool = normalizeSettings({ music: false, sound: true });
  assert.equal(fromBool.music, SETTINGS_DEFAULTS.music);
  assert.equal(fromBool.sound, SETTINGS_DEFAULTS.sound);

  // 模拟 localStorage 持久化往返
  const mem = new Map();
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  };
  try {
    Object.assign(settings, { ...SETTINGS_DEFAULTS, music: 0.25, sound: 0.5, musicOn: false, soundOn: true, mute: false });
    assert.equal(saveSettings(), true);
    // 模拟重启/重载前内存被重置，再从 localStorage 读回
    Object.assign(settings, { ...SETTINGS_DEFAULTS });
    reloadSettings();
    assert.equal(settings.music, 0.25);
    assert.equal(settings.sound, 0.5);
    assert.equal(settings.musicOn, false);
    assert.equal(settings.soundOn, true);
    assert.equal(settings.mute, false);
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('play() 异步失败或系统外力暂停当前轨后，下一次手势/unlock 能自动恢复播放', async () => {
  const h = makeHarness({ deferredPlay: true });
  h.ctrl.music('title');
  h.ctrl.unlock();
  const el = h.track('title');

  // play() 挂起期间调音量（gen=2 走快路径），随后旧 play() 异步 reject 且浏览器将 el.paused 置 true
  h.s.music = 0.5;
  h.ctrl.refresh();
  el.paused = true;
  el.pendingPlays.shift().reject(new Error('NotAllowedError'));
  await flush();
  assert.equal(h.ctrl.inspect().active, null, 'rejected track clears active and marks retry');

  // 下一次手势解锁立刻重试并成功播放
  h.ctrl.unlock();
  assert.equal(el.pendingPlays.length, 1);
  el.pendingPlays.shift().resolve();
  await flush();
  assert.equal(h.ctrl.inspect().active, 'title');
  assert.equal(el.paused, false);

  // 模拟移动端系统打断暂停 <audio>：下一次 unlock 也能自动拉起
  el.paused = true;
  h.ctrl.unlock();
  el.pendingPlays.shift().resolve();
  await flush();
  assert.equal(el.paused, false);
  assert.equal(h.ctrl.inspect().unpausedTracks, 1);
});
