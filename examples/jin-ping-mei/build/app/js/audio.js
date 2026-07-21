// 音频:Web Audio 程序化合成,零素材零依赖。
// 明代市井家宅——克制、室内、偏冷。五声音阶(宫商角徵羽),丝竹音色:
// 笛/箫(正弦+轻噪气声+揉音)、琵琶/古筝(快起音快衰减拨弦)、云板/木鱼(短促打击)。
// 功能三色通感:明账=清亮金属音,暗账=几乎听不见的闷木音,风声=不安的擦弦音。
// 一切方法在 AudioContext 不可用时静默降级,绝不影响游戏运行;删掉本模块玩法不变。

const PENTA = [0, 2, 4, 7, 9]; // 宫 商 角 徵 羽
const BASE = 196; // G3,偏冷

function freq(degree, octave = 0) {
  const idx = ((degree % 5) + 5) % 5;
  const extra = Math.floor(degree / 5);
  return BASE * Math.pow(2, octave + extra + PENTA[idx] / 12);
}

// 散板/慢板乐句:[音级(null=休止), 八度, 拍数]。无强拍循环,留白多。
const SCENES = {
  title: {
    bpm: 50, vol: 0.10, voices: ['di'],
    melody: [[0, 0, 3], [2, 0, 2], [null, 0, 1], [4, 0, 3], [2, 0, 1.5], [null, 0, 2], [1, 0, 2], [0, 0, 4], [null, 0, 3]],
    bass: [],
  },
  act1: {
    bpm: 60, vol: 0.07, voices: ['pluck'],
    melody: [[0, 0, 1], [null, 0, 1], [2, 0, 0.5], [null, 0, 1.5], [4, 0, 1], [null, 0, 2], [2, 0, 0.5], [1, 0, 0.5], [null, 0, 2], [0, 0, 1], [null, 0, 3]],
    bass: [0],
  },
  act2: {
    bpm: 66, vol: 0.08, voices: ['pluck', 'di'],
    melody: [[0, 0, 1], [2, 0, 0.5], [4, 0, 1], [7, 0, 1.5], [4, 0, 0.5], [2, 0, 1], [null, 0, 0.5], [4, 0, 1], [7, 0, 1], [9, 0, 2], [7, 0, 1], [4, 0, 1], [null, 0, 1], [2, 0, 2]],
    melody2: [[0, -1, 2], [null, 0, 1], [4, -1, 2], [null, 0, 1], [0, -1, 3], [null, 0, 2]],
    bass: [0, 3],
  },
  act3: {
    bpm: 46, vol: 0.07, voices: ['di'],
    melody: [[4, -1, 2], [null, 0, 2], [2, -1, 1.5], [null, 0, 3], [0, -1, 3], [null, 0, 4]],
    bass: [],
  },
  ending_liyanei: { // 向上收束的完整乐句
    bpm: 54, vol: 0.10, voices: ['di'],
    melody: [[0, 0, 1.5], [2, 0, 1], [4, 0, 1.5], [7, 0, 2], [9, 0, 3], [null, 0, 2], [7, 0, 1.5], [9, 0, 4], [null, 0, 4]],
    bass: [0],
  },
  ending_liuluo: { // 乐句不完整,中途停住
    bpm: 50, vol: 0.09, voices: ['di'],
    melody: [[0, 0, 2], [2, 0, 1.5], [1, 0, 1], [null, 0, 12]],
    bass: [],
  },
  ending_other: {
    bpm: 50, vol: 0.09, voices: ['di'],
    melody: [[4, 0, 2], [2, 0, 1.5], [0, 0, 3], [null, 0, 4], [2, -1, 3], [null, 0, 5]],
    bass: [],
  },
};

const MUTE_KEY = 'jpm_mute';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgm = null;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this._noiseBuf = null;
    this._clearing = false;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.30; // BGM 明显低于音效
        this.bgmGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.55;
        this.sfxGain.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* 静默降级 */ }
  }

  get ready() { return !!this.ctx; }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }
  toggleMuted() { this.setMuted(!this.muted); return this.muted; }

  // ---------- BGM ----------
  playBGM(scene) {
    if (!this.ctx || this._clearing) return;
    if (this.bgm?.scene === scene) return;
    this.stopBGM();
    const cfg = SCENES[scene];
    if (!cfg) return;
    const beatLen = 60 / cfg.bpm;
    const total = cfg.melody.reduce((a, n) => a + n[2], 0);
    const st = { scene, cfg, beatLen, next: this.ctx.currentTime + 0.1, loopLen: total * beatLen };
    st.timer = setInterval(() => this._schedule(st), 400);
    this._schedule(st);
    this.bgm = st;
  }

  stopBGM() {
    if (this.bgm) { clearInterval(this.bgm.timer); this.bgm = null; }
  }

  _schedule(st) {
    if (!this.ctx) return;
    const horizon = this.ctx.currentTime + 1.2;
    while (st.next < horizon) {
      this._loopOnce(st, st.next);
      st.next += st.loopLen;
    }
  }

  _loopOnce(st, t0) {
    const { cfg, beatLen } = st;
    let t = t0;
    for (const [deg, oct, beats] of cfg.melody) {
      if (deg !== null) this._voice(cfg.voices[0], freq(deg, oct), t, beats * beatLen, cfg.vol);
      t += beats * beatLen;
    }
    if (cfg.melody2) {
      let t2 = t0;
      for (const [deg, oct, beats] of cfg.melody2) {
        if (deg !== null) this._voice('di', freq(deg, oct), t2, beats * beatLen, cfg.vol * 0.7);
        t2 += beats * beatLen;
      }
    }
    const perBeat = st.loopLen / Math.max(1, cfg.bass.length);
    cfg.bass.forEach((deg, i) => {
      this._voice('pluckLow', freq(deg, -1), t0 + i * perBeat, perBeat, cfg.vol * 0.6);
    });
  }

  // 丝竹声部:di=笛/箫(气声+揉音), pluck=琵琶/古筝(拨弦), pluckLow=低音拨弦
  _voice(kind, f, t, dur, vol) {
    if (kind === 'di') this._di(f, t, dur, vol);
    else if (kind === 'pluck') this._pluck(f, t, Math.min(dur, 0.9), vol);
    else this._pluck(f, t, Math.min(dur, 1.2), vol * 0.8);
  }

  _di(f, t, dur, vol) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      // 揉音
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 4.5;
      lg.gain.value = f * 0.006;
      lfo.connect(lg).connect(o.frequency);
      const atk = Math.min(0.18, dur * 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
      g.gain.setValueAtTime(vol * 0.85, t + Math.max(atk, dur - 0.25));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.bgmGain);
      o.start(t); o.stop(t + dur + 0.05);
      lfo.start(t); lfo.stop(t + dur + 0.05);
      // 轻噪气声
      this._noise(t, Math.min(dur, 0.4), vol * 0.15, this.bgmGain, f * 4, 6);
    } catch { /* ignore */ }
  }

  _pluck(f, t, dur, vol) {
    if (!this.ctx) return;
    try {
      for (const [mult, v] of [[1, 1], [2, 0.4]]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f * mult;
        g.gain.setValueAtTime(vol * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.bgmGain);
        o.start(t); o.stop(t + dur + 0.05);
      }
    } catch { /* ignore */ }
  }

  _noise(t, dur, vol, dest, filterFreq = 1200, q = 1) {
    if (!this.ctx) return;
    try {
      if (!this._noiseBuf) {
        const len = this.ctx.sampleRate * 0.5;
        this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this._noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
      src.start(t); src.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  _block(t, f, dur, vol, dest) { // 木鱼/云板基件
    this._tone(f, t, dur, 'sine', vol, dest, 0.002, dur * 0.6);
    this._noise(t, Math.min(0.04, dur), vol * 0.5, dest, f * 3, 4);
  }

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
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* ignore */ }
  }

  // ---------- 第79回:两秒内抽空,静默3-4秒 ----------
  // 全作最重要的听觉时刻;任何音效不得盖过这段静默。
  playClear(onDone) {
    if (!this.ctx) { onDone?.(); return; }
    this._clearing = true;
    this.stopBGM();
    const t = this.ctx.currentTime;
    const g = this.bgmGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + 2.0); // 抽空
    // 只剩一个衰减的低音
    this._tone(freq(0, -2), t + 0.3, 2.2, 'sine', 0.12, this.master, 0.02, 1.8);
    // 静默 3.4 秒后归还声场
    setTimeout(() => {
      if (!this.ctx) return;
      this.bgmGain.gain.setTargetAtTime(0.30, this.ctx.currentTime, 0.5);
      this._clearing = false;
      onDone?.();
    }, 2000 + 3400);
  }

  // ---------- SFX ----------
  sfx(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.sfxGain;
    switch (name) {
      case 'ming': // 金:清亮金属泛音,短促上扬
        this._tone(1568, t, 0.14, 'sine', 0.16, out, 0.001, 0.08);
        this._tone(2093, t + 0.05, 0.16, 'sine', 0.12, out, 0.001, 0.1);
        this._tone(2637, t + 0.09, 0.12, 'sine', 0.06, out, 0.001, 0.08);
        break;
      case 'an': // 墨:低而闷的木质轻响,几乎听不见
        this._block(t, 320, 0.06, 0.045, out);
        break;
      case 'wind': // 朱:压抑的擦弦/气声,不安
        this._noise(t, 0.35, 0.09, out, 480, 3);
        this._tone(233, t, 0.3, 'sawtooth', 0.03, out, 0.12, 0.12);
        break;
      case 'submit': // 云板一记
        this._tone(1180, t, 0.1, 'sine', 0.2, out, 0.001, 0.06);
        this._noise(t, 0.05, 0.12, out, 2600, 4);
        break;
      case 'plank': // 木牌翻动
        this._block(t, 640, 0.05, 0.14, out);
        this._block(t + 0.06, 520, 0.05, 0.11, out);
        break;
      case 'paper': // 纸张轻响
        this._noise(t, 0.12, 0.08, out, 3200, 1.2);
        break;
      case 'wang': // 闷实的印章落纸
        this._block(t, 210, 0.1, 0.2, out);
        this._noise(t, 0.07, 0.1, out, 700, 1.5);
        break;
      case 'mou': { // 极轻的连续摩擦,进度越高越明显
        const p = Math.min(1, (opt.progress ?? 30) / 100);
        this._noise(t, 0.3, 0.03 + p * 0.05, out, 900 + p * 600, 5);
        break;
      }
      case 'faluo': { // 沉重的堂木+余响
        this._tone(140, t, 0.4, 'sine', 0.3, out, 0.002, 0.3);
        this._block(t, 260, 0.12, 0.26, out);
        this._noise(t + 0.1, 0.6, 0.08, out, 300, 1);
        break;
      }
      case 'watch': // 远处更漏,两下
        this._block(t, 380, 0.09, 0.07, out);
        this._block(t + 0.5, 340, 0.09, 0.055, out);
        break;
      case 'qing': { // 结局定格:悠长的磬
        this._tone(1047, t, 2.8, 'sine', 0.14, out, 0.004, 2.4);
        this._tone(1568, t, 2.2, 'sine', 0.05, out, 0.004, 1.8);
        this._tone(524, t, 3.0, 'sine', 0.06, out, 0.004, 2.6);
        break;
      }
      case 'click':
        this._block(t, 760, 0.04, 0.1, out);
        break;
      default:
        break;
    }
  }
}

export const audio = new AudioEngine();
