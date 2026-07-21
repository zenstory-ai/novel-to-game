// 音频引擎:Web Audio 程序化合成,零素材零依赖。
// 古风五声音阶(宫商角徵羽)+ 木鱼/板鼓打击感;分场景 BGM + 全套战斗 SFX。
// 一切方法在 AudioContext 不可用时静默降级,绝不影响游戏运行。

// 五声音阶(半音):宫 商 角 徵 羽
const PENTA = [0, 2, 4, 7, 9];
const BASE = 220; // A3

function freq(degree, octave = 0) {
  const idx = ((degree % 5) + 5) % 5;
  const extra = Math.floor(degree / 5);
  return BASE * Math.pow(2, octave + extra + PENTA[idx] / 12);
}

// 各场景 BGM 谱(预写作循环): [音级, 八度, 拍数]
const SCENES = {
  title: {
    bpm: 56, wave: 'triangle', vol: 0.16, percVol: 0.05,
    melody: [[0, 0, 2], [2, 0, 1], [4, 0, 1], [7, 0, 2], [4, 0, 2], [2, 0, 1], [1, 0, 1], [0, 0, 3], [0, 0, 1]],
    bass: [0, -1], perc: [0],
  },
  overworld: {
    bpm: 84, wave: 'triangle', vol: 0.13, percVol: 0.09,
    melody: [[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 0, 1.5], [2, 0, 0.5], [1, 0, 1], [2, 0, 1], [4, 0, 1], [7, 0, 1.5], [4, 0, 0.5], [2, 0, 1], [1, 0, 1], [0, 0, 2]],
    bass: [0, -1, 3, -1], perc: [0, 2, 4, 6],
  },
  battle: {
    bpm: 112, wave: 'square', vol: 0.09, percVol: 0.14,
    melody: [[0, 0, 1], [0, 0, 1], [3, 0, 1], [2, 0, 1], [4, 0, 1.5], [3, 0, 0.5], [2, 0, 1], [1, 0, 1], [2, 0, 2], [0, 0, 2]],
    bass: [0, -1, 0, -1, 2, -1], perc: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  boss: {
    bpm: 76, wave: 'sawtooth', vol: 0.08, percVol: 0.17,
    melody: [[0, -1, 2], [1, -1, 2], [2, -1, 2], [1, -1, 1], [0, -1, 1], [4, -1, 3], [3, -1, 1]],
    bass: [0, -2, 0, -2], perc: [0, 2, 3, 4, 6],
  },
  ending: {
    bpm: 60, wave: 'sine', vol: 0.14, percVol: 0.03,
    melody: [[4, 0, 1], [7, 0, 1], [9, 0, 2], [7, 0, 1], [4, 0, 1], [2, 0, 2], [4, 0, 1], [2, 0, 1], [0, 0, 3]],
    bass: [0, -1], perc: [0],
  },
};

const MUTE_KEY = 'xiyou_mute';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgm = null; // {scene, timer, nextNote}
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this._noiseBuf = null;
  }

  // 需用户手势调用:创建/恢复 AudioContext
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.6;
        this.master.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.5;
        this.bgmGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.7;
        this.sfxGain.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* 音频不可用则静默 */ }
  }

  get ready() {
    return !!this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---------- BGM ----------
  playBGM(scene) {
    if (!this.ctx) return;
    if (this.bgm?.scene === scene) return;
    this.stopBGM();
    const cfg = sceneCfg(scene);
    if (!cfg) return;
    const beatLen = 60 / cfg.bpm;
    const totalBeats = cfg.melody.reduce((a, n) => a + n[2], 0);
    const loopLen = totalBeats * beatLen;
    const state = { scene, next: this.ctx.currentTime + 0.08, beatLen, loopLen, cfg };
    state.timer = setInterval(() => this._scheduleLoop(state), 300);
    this._scheduleLoop(state);
    this.bgm = state;
  }

  stopBGM() {
    if (this.bgm) {
      clearInterval(this.bgm.timer);
      this.bgm = null;
    }
  }

  _scheduleLoop(st) {
    if (!this.ctx) return;
    const horizon = this.ctx.currentTime + 1.0;
    while (st.next < horizon) {
      this._playLoopOnce(st, st.next);
      st.next += st.loopLen;
    }
  }

  _playLoopOnce(st, t0) {
    const { cfg, beatLen } = st;
    let t = t0;
    for (const [deg, oct, beats] of cfg.melody) {
      this._tone(freq(deg, oct), t, beats * beatLen * 0.92, cfg.wave, cfg.vol, this.bgmGain, 0.02, 0.08);
      t += beats * beatLen;
    }
    // 低音 drone:每循环均布
    const perBeat = st.loopLen / cfg.bass.length;
    cfg.bass.forEach((deg, i) => {
      this._tone(freq(deg, -1), t0 + i * perBeat, perBeat * 0.9, 'sine', cfg.vol * 0.7, this.bgmGain, 0.05, 0.1);
    });
    // 木鱼/板鼓:按拍位
    const beatDur = st.loopLen / 8;
    cfg.perc.forEach((b, i) => {
      const pt = t0 + b * beatDur;
      if (i % 4 === 0) this._drum(pt, cfg.percVol, this.bgmGain); // 板鼓重拍
      else this._woodblock(pt, cfg.percVol * 0.8, this.bgmGain);
    });
  }

  // ---------- 基础合成 ----------
  _tone(f, t, dur, wave, vol, dest, attack = 0.005, release = 0.06) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol * 0.8, t + Math.max(attack, dur - release));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch { /* ignore */ }
  }

  _noise(t, dur, vol, dest, filterFreq = 1200, q = 1) {
    if (!this.ctx) return;
    try {
      if (!this._noiseBuf) {
        // 噪声缓冲用固定种子的 mulberry32 生成(全项目禁 Math.random;听感无差异)
        let a = 0xa3d9;
        const len = this.ctx.sampleRate * 0.5;
        this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this._noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          a |= 0;
          a = (a + 0x6d2b79f5) | 0;
          let z = Math.imul(a ^ (a >>> 15), 1 | a);
          z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
          d[i] = (((z ^ (z >>> 14)) >>> 0) / 4294967296) * 2 - 1;
        }
      }
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = filterFreq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(dest);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  // 木鱼:短促高频敲击
  _woodblock(t, vol, dest) {
    this._tone(920, t, 0.05, 'sine', vol, dest, 0.002, 0.03);
    this._noise(t, 0.03, vol * 0.5, dest, 2400, 4);
  }

  // 板鼓:低频膜击
  _drum(t, vol, dest) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.2);
    } catch { /* ignore */ }
    this._noise(t, 0.05, vol * 0.4, dest, 800, 2);
  }

  // ---------- SFX ----------
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.sfxGain;
    switch (name) {
      case 'click':
        this._woodblock(t, 0.25, out);
        break;
      case 'hit':
        this._tone(180, t, 0.1, 'square', 0.22, out, 0.002, 0.05);
        this._noise(t, 0.08, 0.2, out, 900, 1.5);
        break;
      case 'crit':
        this._tone(180, t, 0.1, 'square', 0.24, out, 0.002, 0.05);
        this._tone(1320, t + 0.03, 0.16, 'triangle', 0.2, out, 0.002, 0.08);
        this._noise(t, 0.1, 0.22, out, 1600, 2);
        break;
      case 'skill':
        this._noise(t, 0.25, 0.16, out, 2400, 3);
        this._tone(660, t, 0.18, 'sine', 0.12, out, 0.01, 0.1);
        this._tone(freq(4, 1), t + 0.08, 0.2, 'triangle', 0.12, out, 0.01, 0.1);
        break;
      case 'heal':
        [2, 4, 7].forEach((d, i) => this._tone(freq(d, 1), t + i * 0.07, 0.16, 'sine', 0.14, out, 0.01, 0.08));
        break;
      case 'ke':
        this._tone(1480, t, 0.12, 'triangle', 0.22, out, 0.001, 0.06);
        this._tone(1980, t + 0.04, 0.1, 'sine', 0.14, out, 0.001, 0.05);
        break;
      case 'thud':
        this._tone(110, t, 0.16, 'sine', 0.2, out, 0.003, 0.08);
        this._noise(t, 0.1, 0.1, out, 400, 1);
        break;
      case 'combo':
        this._woodblock(t, 0.2, out);
        this._woodblock(t + 0.07, 0.24, out);
        break;
      case 'transform':
        this._woodblock(t, 0.26, out); // 木鱼
        this._drum(t + 0.12, 0.26, out); // 板鼓
        this._noise(t + 0.24, 0.3, 0.14, out, 1800, 2); // 一声气流
        break;
      case 'telegraph':
        this._drum(t, 0.3, out);
        this._drum(t + 0.18, 0.34, out);
        break;
      case 'heavy':
        this._drum(t, 0.4, out);
        this._noise(t, 0.3, 0.26, out, 500, 1);
        this._tone(70, t, 0.3, 'sawtooth', 0.14, out, 0.005, 0.15);
        break;
      case 'fan1': // 息火:低鸣熄灭
        this._noise(t, 0.5, 0.16, out, 300, 1);
        this._tone(140, t, 0.45, 'sine', 0.14, out, 0.02, 0.3);
        break;
      case 'fan2': // 生风:气流上扬
        this._noise(t, 0.6, 0.16, out, 900, 1);
        this._tone(freq(4, 0), t, 0.4, 'triangle', 0.1, out, 0.05, 0.2);
        this._tone(freq(7, 0), t + 0.12, 0.35, 'triangle', 0.1, out, 0.05, 0.2);
        break;
      case 'fan3': // 落雨:密集雨点+清铃
        for (let i = 0; i < 7; i++) this._noise(t + i * 0.06, 0.05, 0.08, out, 3000 + i * 300, 4);
        this._tone(freq(9, 0), t + 0.1, 0.4, 'sine', 0.12, out, 0.02, 0.25);
        break;
      case 'firefx': // 火系演出:轰燃+余焰
        this._noise(t, 0.5, 0.2, out, 500, 1);
        this._tone(90, t, 0.4, 'sawtooth', 0.12, out, 0.01, 0.25);
        this._noise(t + 0.15, 0.35, 0.1, out, 1800, 2);
        break;
      case 'waterfx': // 水系演出:浪涌+清音
        this._noise(t, 0.45, 0.16, out, 900, 1.5);
        [4, 7].forEach((d, i) => this._tone(freq(d, 0), t + 0.08 + i * 0.09, 0.22, 'sine', 0.1, out, 0.02, 0.12));
        break;
      case 'levelup':
        [0, 2, 4, 7].forEach((d, i) => this._tone(freq(d, 1), t + i * 0.08, 0.16, 'triangle', 0.15, out, 0.01, 0.08));
        break;
      case 'victory':
        [[0, 0], [4, 0.12], [7, 0.24], [9, 0.36]].forEach(([d, dt]) =>
          this._tone(freq(d, 1), t + dt, 0.22, 'square', 0.12, out, 0.01, 0.1));
        this._drum(t, 0.2, out);
        break;
      case 'defeat':
        [4, 2, 0].forEach((d, i) => this._tone(freq(d, -1), t + i * 0.18, 0.3, 'triangle', 0.14, out, 0.01, 0.15));
        break;
      default:
        break;
    }
  }
}

function sceneCfg(scene) {
  return SCENES[scene] ?? null;
}

export const audio = new AudioEngine();
