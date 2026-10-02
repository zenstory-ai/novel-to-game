// 程序化丝竹：Web Audio 合成，零素材。五声音阶；笛箫（正弦＋揉音＋气声）与琵琶古筝（拨弦）。
// AudioContext 不可用时整体静默，不影响游戏。
const PENTA = [0, 2, 4, 7, 9];
const BASE = 220;
const freq = (degree, octave = 0) => {
  const idx = ((degree % 5) + 5) % 5;
  return BASE * 2 ** (octave + Math.floor(degree / 5) + PENTA[idx] / 12);
};

// 乐句：[音级|null, 八度, 拍]；lead=主声部，pad=低声部，bass=每小节根音
const TRACKS = {
  title: { bpm: 56, lead: 'di', melody: [[2, 0, 2], [4, 0, 1], [5, 0, 1.5], [4, 0, 0.5], [2, 0, 2], [null, 0, 1], [1, 0, 1], [2, 0, 1], [4, 0, 3], [null, 0, 1], [5, 0, 1], [7, 0, 1], [5, 0, 1], [4, 0, 1], [2, 0, 4], [null, 0, 2]], pad: [[0, -1, 8], [3, -1, 8], [4, -1, 8], [0, -1, 8]] },
  daily: { bpm: 84, lead: 'pluck', melody: [[0, 0, 1], [2, 0, 0.5], [4, 0, 0.5], [5, 0, 1], [4, 0, 1], [2, 0, 1], [4, 0, 0.5], [2, 0, 0.5], [1, 0, 1], [0, 0, 1], [null, 0, 1], [2, 0, 1], [4, 0, 1], [5, 0, 0.5], [7, 0, 0.5], [5, 0, 1], [4, 0, 2], [null, 0, 1]], pad: [[0, -1, 4], [4, -1, 4], [3, -1, 4], [0, -1, 4]] },
  garden: { bpm: 92, lead: 'pluck', melody: [[4, 0, 0.5], [5, 0, 0.5], [7, 0, 1], [5, 0, 0.5], [4, 0, 0.5], [2, 0, 1], [4, 0, 1], [7, 0, 0.5], [9, 0, 0.5], [7, 0, 1], [5, 0, 1], [4, 0, 2], [2, 0, 0.5], [4, 0, 0.5], [5, 0, 1], [4, 0, 1], [2, 0, 1], [0, 0, 2]], pad: [[0, -1, 4], [2, -1, 4], [3, -1, 4], [0, -1, 4]], echo: 'di' },
  tender: { bpm: 60, lead: 'di', melody: [[4, 0, 2], [2, 0, 1], [4, 0, 1], [5, 0, 2], [4, 0, 2], [2, 0, 1.5], [1, 0, 0.5], [0, 0, 3], [null, 0, 1], [2, 0, 1], [4, 0, 1], [7, 0, 2], [5, 0, 1], [4, 0, 1], [2, 0, 4]], pad: [[0, -1, 8], [3, -1, 8], [1, -1, 8], [0, -1, 8]], echo: 'pluck' },
  tension: { bpm: 72, lead: 'pluck', melody: [[0, -1, 0.5], [0, -1, 0.5], [3, -1, 1], [null, 0, 0.5], [2, -1, 0.5], [1, -1, 1], [0, -1, 1], [null, 0, 1], [0, -1, 0.5], [0, -1, 0.5], [4, -1, 1], [3, -1, 1], [1, -1, 2], [null, 0, 1]], pad: [[0, -2, 4], [1, -2, 4]] },
  night: { bpm: 50, lead: 'di', melody: [[2, 0, 3], [null, 0, 1], [1, 0, 2], [0, 0, 2], [null, 0, 2], [4, -1, 3], [null, 0, 1], [2, 0, 2], [1, 0, 4], [null, 0, 2]], pad: [[0, -1, 8], [4, -2, 8]], watch: true },
  sad: { bpm: 48, lead: 'di', melody: [[4, 0, 2], [2, 0, 2], [1, 0, 2], [0, 0, 3], [null, 0, 1], [1, 0, 1], [0, 0, 1], [4, -1, 4], [null, 0, 2]], pad: [[0, -1, 8], [3, -2, 8]] },
  fate: { bpm: 44, lead: 'di', melody: [[0, 0, 4], [null, 0, 2], [4, -1, 3], [null, 0, 1], [2, -1, 4], [null, 0, 4]], pad: [[0, -2, 16]] },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.track = null;
    this.timer = null;
    this.bgmVol = 0.6;
    this.seVol = 0.7;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.bgmGain = this.ctx.createGain();
        this.seGain = this.ctx.createGain();
        this.bgmGain.connect(this.ctx.destination);
        this.seGain.connect(this.ctx.destination);
        this.setVolumes(this.bgmVol * 100, this.seVol * 100);
        const pending = this.wanted;
        this.wanted = null;
        if (pending) this.play(pending);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* 静默降级 */ }
  }

  setVolumes(bgm, se) {
    this.bgmVol = bgm / 100;
    this.seVol = se / 100;
    if (!this.ctx) return;
    this.bgmGain.gain.setTargetAtTime(this.bgmVol * 0.32, this.ctx.currentTime, 0.1);
    this.seGain.gain.setTargetAtTime(this.seVol * 0.5, this.ctx.currentTime, 0.05);
  }

  play(id) {
    if (!this.ctx) { this.wanted = id; return; }
    if (this.track?.id === id) return;
    this.stop();
    const cfg = TRACKS[id];
    if (!cfg) return;
    const beat = 60 / cfg.bpm;
    const length = cfg.melody.reduce((n, note) => n + note[2], 0) * beat;
    // 每首曲子单独一路增益，换曲时淡出旧的那一路，不让两段旋律叠在一起
    const out = this.ctx.createGain();
    out.connect(this.bgmGain);
    this.track = { id, out, length, events: this.events(cfg, beat, length), idx: 0, loop: this.ctx.currentTime + 0.15 };
    this.timer = setInterval(() => this.schedule(), 300);
    this.schedule();
  }

  stop() {
    clearInterval(this.timer);
    const t = this.track;
    this.track = null;
    if (!t || !this.ctx) return;
    t.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => t.out.disconnect(), 600);
  }

  // 一轮乐句展开成按时间排好的音符表；调度时一次只订一个音，前瞻 1.5 秒
  events(cfg, beat, length) {
    const list = [];
    let t = 0;
    for (const [deg, oct, beats] of cfg.melody) {
      if (deg !== null) {
        list.push({ at: t, kind: cfg.lead, f: freq(deg, oct), dur: beats * beat, vol: 0.11 });
        if (cfg.echo) list.push({ at: t + beat * 0.5, kind: cfg.echo, f: freq(deg, oct + 1), dur: Math.min(beats * beat, 0.8), vol: 0.03 });
      }
      t += beats * beat;
    }
    let p = 0;
    for (const [deg, oct, beats] of cfg.pad ?? []) {
      if (p >= length) break;
      list.push({ at: p, kind: 'pad', f: freq(deg, oct), dur: Math.min(beats * beat, 2.4), vol: 0.06 });
      p += beats * beat;
    }
    if (cfg.watch) list.push({ at: length * 0.5, kind: 'block', f: 380, dur: 0.08, vol: 0.05 }, { at: length * 0.5 + 0.6, kind: 'block', f: 340, dur: 0.08, vol: 0.04 });
    return list.sort((a, b) => a.at - b.at);
  }

  schedule() {
    const t = this.track;
    if (!t || !this.ctx || !t.events.length) return;
    const now = this.ctx.currentTime;
    // 后台标签页回来时，不补订已经过去的音，免得一齐炸响
    if (t.loop + t.events[t.idx].at < now) t.loop = now + 0.05 - t.events[t.idx].at;
    while (t.loop + t.events[t.idx].at < now + 1.5) {
      const e = t.events[t.idx];
      const at = t.loop + e.at;
      if (e.kind === 'pad') this.pluck(e.f, at, e.dur, e.vol, t.out);
      else if (e.kind === 'block') this.block(at, e.f, e.dur, e.vol, t.out);
      else this.voice(e.kind, e.f, at, e.dur, e.vol, t.out);
      t.idx += 1;
      if (t.idx >= t.events.length) { t.idx = 0; t.loop += t.length; }
    }
  }

  voice(kind, f, t, dur, vol, dest) {
    if (kind === 'di') this.di(f, t, dur, vol, dest);
    else this.pluck(f, t, Math.min(dur, 1.1), vol * 0.9, dest);
  }

  di(f, t, dur, vol, dest = this.bgmGain) {
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      lfo.frequency.value = 5;
      lg.gain.value = f * 0.005;
      lfo.connect(lg).connect(o.frequency);
      const atk = Math.min(0.15, dur * 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
      g.gain.setValueAtTime(vol * 0.8, t + Math.max(atk, dur - 0.2));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    } catch { /* ignore */ }
  }

  pluck(f, t, dur, vol, dest) {
    try {
      for (const [mult, v] of [[1, 1], [2, 0.35], [3, 0.12]]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f * mult;
        g.gain.setValueAtTime(vol * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
      }
    } catch { /* ignore */ }
  }

  block(t, f, dur, vol, dest) {
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  se(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.seGain;
    if (name === 'click') this.block(t, 900, 0.05, 0.12, out);
    else if (name === 'page') { this.block(t, 1400, 0.03, 0.05, out); this.block(t + 0.04, 1100, 0.03, 0.04, out); }
    else if (name === 'choice') { this.pluck(freq(4, 1), t, 0.6, 0.18, out); this.pluck(freq(7, 1), t + 0.08, 0.7, 0.14, out); }
    else if (name === 'chapter') { this.pluck(freq(0, 0), t, 1.6, 0.2, out); this.pluck(freq(4, 0), t + 0.12, 1.6, 0.16, out); this.pluck(freq(7, 0), t + 0.24, 2, 0.14, out); }
    else if (name === 'ending') { for (const [d, o, dt] of [[0, 1, 0], [4, 1, 0.02], [0, 0, 0.04]]) this.di(freq(d, o), t + dt, 3, 0.12, out); }
    else if (name === 'save') { this.pluck(freq(2, 1), t, 0.4, 0.15, out); this.pluck(freq(4, 1), t + 0.07, 0.5, 0.12, out); }
  }
}

export const audio = new AudioEngine();
