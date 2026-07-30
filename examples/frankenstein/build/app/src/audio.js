// The audio layer. Every sound enters the game through a key and nothing else
// schedules a node. A key with no authored voice is silent and the run
// continues — the same principle as the skin's greybox and the font stack's
// Georgia: §13.5's gated keys failing to exist is a release-gate failure, not
// a runtime error.
//
// All sound is synthesised in WebAudio at runtime; no audio files ship
// (ART_DIRECTION §13.2, §13.4: "short filtered noise bursts with authored
// envelopes"). Noise is a fixed index hash — never Math.random, and never the
// engine's seeded RNG, which belongs to the rules and would desync replays.
//
// §13.1's rule: everything heard is something the creature could hear from
// where he is. The position stage below is how a cue learns where he is.

// The twelve release-gated keys (ART_DIRECTION §13.5): the four footfalls,
// the load-down, the latch, the hearth bed at its two levels (GAME_DESIGN
// §7.2: small, built high), the taper strike, the dawn bird, the wind, and
// the guitar. Their absence is a build failure at the gate — not a crash here.
const GATED = [
  'footfall/snow', 'footfall/path', 'footfall/earth', 'footfall/straw',
  'load-down', 'latch',
  'hearth/small', 'hearth/high',
  'taper-strike', 'dawn-bird', 'wind', 'guitar',
];
const GATED_SET = new Set(GATED);

// §13.1, as an optional filter stage every cue passes through:
//   hovel — through the wall and the straw: low-pass ~900 Hz, one short dry
//           reflection;
//   yard  — the same sources open, with the yard's own fainter reflection;
//   room  — dry, close, unfiltered (chapter 15, once in the game). The stage
//           knows it; nothing routes here yet — the slice's door scene plays
//           at the threshold, outside.
const POSITIONS = {
  hovel: { lowpass: 900, reflection: { delay: 0.055, gain: 0.16 } },
  yard: { lowpass: null, reflection: { delay: 0.09, gain: 0.07 } },
  room: { lowpass: null, reflection: null },
};

// Deterministic pseudo-noise: a hash of the sample index, the same det() the
// engraving marks use (render.js). Same buffer on every run, every machine.
function det(i, salt = 0) {
  let h = (Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
  h ^= h >>> 16;
  return (h >>> 8) / 16777216; // 0..1
}

// One shared noise buffer per context (the live one and each offline one).
const noiseBuffers = new WeakMap();
function noiseBuffer(ac) {
  let b = noiseBuffers.get(ac);
  if (!b) {
    const n = Math.floor(ac.sampleRate * 0.5);
    b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = det(i) * 2 - 1;
    noiseBuffers.set(ac, b);
  }
  return b;
}

// One strike of the latch: a band-passed noise burst with an authored
// envelope, over a short wooden body (a pitched thud dropping as it dies).
function strike(ac, out, when, { band, q, peak, decay, thump }) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = band;
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(when); src.stop(when + decay + 0.03);

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(thump, when);
  osc.frequency.exponentialRampToValueAtTime(thump * 0.7, when + decay);
  const og = ac.createGain();
  og.gain.setValueAtTime(0, when);
  og.gain.linearRampToValueAtTime(peak * 0.5, when + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, when + decay * 1.4);
  osc.connect(og); og.connect(out);
  osc.start(when); osc.stop(when + decay * 1.5);
}

// A footfall's grain: one or two band-passed noise grains with a soft authored
// envelope. Low in the mix by design (§13.3: "Continuous, low") — main.js
// paces one of these per step walked, so the sound follows the walk rather
// than firing once.
function scuff(ac, out, when, { band, q, peak, attack, decay, grains = 1, gap = 0.03 }) {
  for (let i = 0; i < grains; i++) {
    const t = when + i * gap;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = band;
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak * (1 - i * 0.35), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t); src.stop(t + attack + decay + 0.03);
  }
}

// The four surfaces (§13.3). The wall's 900 Hz low-pass would eat a step heard
// from inside; these are authored for the yard, where feet are.
function footfallSnow(ac, out, when) { // deep snow: soft, broad
  scuff(ac, out, when, { band: 320, q: 0.6, peak: 0.11, attack: 0.012, decay: 0.10 });
}
function footfallPath(ac, out, when) { // the cleared path: grit
  scuff(ac, out, when, { band: 1150, q: 1.2, peak: 0.10, attack: 0.002, decay: 0.045, grains: 2, gap: 0.035 });
}
function footfallEarth(ac, out, when) { // thawed earth: damp
  scuff(ac, out, when, { band: 240, q: 0.9, peak: 0.12, attack: 0.004, decay: 0.07 });
}
function footfallStraw(ac, out, when) { // straw: dry — dry, not bright: the
  // palette's one bright transient belongs to the taper (§13.2)
  scuff(ac, out, when, { band: 1750, q: 1.6, peak: 0.06, attack: 0.002, decay: 0.04, grains: 2, gap: 0.028 });
}

// Wood settling on wood, three impacts, decaying (§13.3) — the game's reward
// sound.
function loadDown(ac, out, when) {
  strike(ac, out, when, { band: 880, q: 1.3, peak: 0.50, decay: 0.09, thump: 170 });
  strike(ac, out, when + 0.13, { band: 720, q: 1.3, peak: 0.33, decay: 0.10, thump: 140 });
  strike(ac, out, when + 0.28, { band: 600, q: 1.3, peak: 0.18, decay: 0.12, thump: 115 });
}

// Agatha's hand on the latch (§13.3): one latch — the bar lifting, then
// seating ~90 ms later — then silence held. The hold stays structural: the
// two strikes schedule nothing after themselves, so whatever sounds next
// (the dawn bird, the hearth) arrives from its own state, not from this cue.
function latch(ac, out, when) {
  strike(ac, out, when, { band: 1800, q: 1.1, peak: 0.55, decay: 0.045, thump: 340 });
  strike(ac, out, when + 0.09, { band: 1350, q: 1.1, peak: 0.42, decay: 0.06, thump: 260 });
}

// The taper struck (§13.3): one short bright transient — the game's warning
// sound and the only bright transient in the palette (§13.2) — plus a rising
// noise tail as the flare takes.
function taperStrike(ac, out, when) {
  const src0 = ac.createBufferSource();
  src0.buffer = noiseBuffer(ac);
  const bp0 = ac.createBiquadFilter();
  bp0.type = 'bandpass';
  bp0.frequency.value = 4300;
  bp0.Q.value = 2.5;
  const g0 = ac.createGain();
  g0.gain.setValueAtTime(0, when);
  g0.gain.linearRampToValueAtTime(0.5, when + 0.002);
  g0.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
  src0.connect(bp0); bp0.connect(g0); g0.connect(out);
  src0.start(when); src0.stop(when + 0.07);

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(900, when);
  bp.frequency.exponentialRampToValueAtTime(2600, when + 0.45);
  bp.Q.value = 1.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.22, when + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.8);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(when); src.stop(when + 0.85);
}

// One bird, and only at first light (§13.2): "a bird is not a nice detail, it
// is the sound of the deadline." Which species sings is seeded (GAME_DESIGN
// §5) — derived from the seed string's own hash in setSeed(), never from the
// engine's stream, so replays stay in step.
function chirp(ac, out, when, { f0, f1, dur, peak }) {
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(out);
  o.start(when); o.stop(when + dur + 0.02);
}
const BIRDS = [
  [ // a thrush: two clear down-slurs, then their repeat
    { at: 0.00, f0: 3100, f1: 2400, dur: 0.11, peak: 0.26 },
    { at: 0.18, f0: 3300, f1: 2500, dur: 0.09, peak: 0.24 },
    { at: 0.42, f0: 2800, f1: 2100, dur: 0.13, peak: 0.26 },
    { at: 0.62, f0: 2800, f1: 2100, dur: 0.13, peak: 0.21 },
  ],
  [ // a lark: a quick rising trill
    { at: 0.00, f0: 2900, f1: 3500, dur: 0.06, peak: 0.19 },
    { at: 0.09, f0: 3000, f1: 3600, dur: 0.06, peak: 0.20 },
    { at: 0.18, f0: 3100, f1: 3700, dur: 0.06, peak: 0.21 },
    { at: 0.27, f0: 3000, f1: 3600, dur: 0.06, peak: 0.20 },
    { at: 0.36, f0: 2900, f1: 3500, dur: 0.06, peak: 0.19 },
    { at: 0.45, f0: 2800, f1: 3400, dur: 0.08, peak: 0.17 },
  ],
  [ // a dove: two low coos
    { at: 0.00, f0: 950, f1: 720, dur: 0.22, peak: 0.28 },
    { at: 0.34, f0: 900, f1: 680, dur: 0.26, peak: 0.25 },
  ],
];
function dawnBird(ac, out, when) {
  const pattern = BIRDS[seedHash % BIRDS.length];
  for (const c of pattern) chirp(ac, out, when + c.at, c);
}

// The guitar (§13.2): Karplus–Strong plucked strings with gut parameters — a
// low-passed seed burst for low brightness, a fast-decaying loop — playing one
// authored minor-mode air, the same phrase every night. The seeded phrase set
// was cut before the gate; what is seeded is the hour he takes it up, not the
// material (guitarHour() below).
const ksCache = new WeakMap(); // context -> Map(freq key -> AudioBuffer)
function ksNote(ac, freq, seconds) {
  let byFreq = ksCache.get(ac);
  if (!byFreq) { byFreq = new Map(); ksCache.set(ac, byFreq); }
  const key = Math.round(freq * 10);
  let buf = byFreq.get(key);
  if (buf) return buf;
  const sr = ac.sampleRate;
  const n = Math.floor(sr * seconds);
  buf = ac.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const N = Math.round(sr / freq);
  let prev = 0;
  for (let i = 0; i <= N && i < n; i++) { // the pluck: one period of smoothed noise
    const x = det(i, key) * 2 - 1;
    d[i] = (x + prev) * 0.5;
    prev = x;
  }
  const damp = 0.996; // gut: fast damping
  for (let i = N + 1; i < n; i++) d[i] = (d[i - N] + d[i - N - 1]) * 0.5 * damp;
  byFreq.set(key, buf);
  return buf;
}
// A minor, eleven notes, mournful and resolving home: E D C A | G A — C E | D B A.
const PHRASE = [
  [329.63, 0.42], [293.66, 0.21], [261.63, 0.42], [220.00, 0.63],
  [196.00, 0.42], [220.00, 0.84],
  [261.63, 0.42], [329.63, 0.42], [293.66, 0.63], [246.94, 0.42], [220.00, 1.26],
];
function guitar(ac, out, when) {
  let t = when;
  for (const [freq, dur] of PHRASE) {
    const ring = Math.min(1.8, dur + 0.9);
    const src = ac.createBufferSource();
    src.buffer = ksNote(ac, freq, ring);
    const g = ac.createGain();
    g.gain.value = 0.42;
    src.connect(g); g.connect(out);
    src.start(t); src.stop(t + ring);
    t += dur;
  }
}

// The slow crackle generator of §13.2, baked into a four-second loop: 26 pops
// at det()-chosen moments and sizes. Deterministic on every machine.
const crackleBuffers = new WeakMap();
function crackleBuffer(ac) {
  let b = crackleBuffers.get(ac);
  if (!b) {
    const n = Math.floor(ac.sampleRate * 4);
    b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let k = 0; k < 26; k++) {
      const t0 = Math.floor((0.08 + k * 0.15 + det(k, 3) * 0.11) * ac.sampleRate);
      const amp = 0.25 + det(k, 5) * 0.6;
      const len = Math.floor((0.006 + det(k, 11) * 0.035) * ac.sampleRate);
      for (let i = 0; i < len && t0 + i < n; i++) {
        d[t0 + i] += (det(i + t0, 17) * 2 - 1) * amp * Math.exp(-i / (len * 0.35));
      }
    }
    crackleBuffers.set(ac, b);
  }
  return b;
}

// The hearth (§13.2): 80–1200 Hz band-limited noise plus the crackle loop.
// This is a State, not an event — its level follows the fire that is actually
// burning (§7.2), so the two gated keys are the bed at its two levels: small,
// and built high. main.js mirrors render.js's fire read exactly (Firing 0 ->
// silence, 1 -> small, >= 2 -> high) and never fires a one-shot.
function makeHearth(level) {
  return {
    start(ac, out) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      src.loop = true;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 80;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      const g = ac.createGain();
      g.gain.value = level.noise;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      src.start();

      const ck = ac.createBufferSource();
      ck.buffer = crackleBuffer(ac);
      ck.loop = true;
      const cb = ac.createBiquadFilter();
      cb.type = 'bandpass';
      cb.frequency.value = 1500;
      cb.Q.value = 0.8;
      const cg = ac.createGain();
      cg.gain.value = level.crackle;
      ck.connect(cb); cb.connect(cg); cg.connect(out);
      ck.start();

      return {
        set() {},
        stop() {
          try { src.stop(); } catch (e) { /* already stopped */ }
          try { ck.stop(); } catch (e) { /* already stopped */ }
        },
      };
    },
  };
}

// The wind (§13.2): two filtered noise layers, one for the wood and one for
// the yard. The yard layer is silent until the night's last two minutes lift
// it (main.js drives layer2 from nightMinutesLeft) — how dawn is heard before
// it is seen. Continuous, like the footfalls' gait and the hearth's bed.
const WIND_YARD_GAIN = 0.16;
const wind = {
  start(ac, out, params = {}) {
    const mkLayer = (freq, type, q, gainV) => {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      src.loop = true;
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ac.createGain();
      g.gain.value = gainV;
      src.connect(f); f.connect(g); g.connect(out);
      src.start();
      return { src, g };
    };
    const wood = mkLayer(360, 'lowpass', 0.7, 0.05);
    // a slow breath on the wood layer, fixed-rate — ambience, not a draw
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.09;
    const lfoG = ac.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(wood.g.gain);
    lfo.start();
    const yard = mkLayer(750, 'bandpass', 0.5, (params.layer2 || 0) * WIND_YARD_GAIN);
    return {
      set(p = {}) {
        yard.g.gain.setTargetAtTime((p.layer2 || 0) * WIND_YARD_GAIN, ac.currentTime, 0.5);
      },
      stop() {
        try { wood.src.stop(); } catch (e) { /* already stopped */ }
        try { yard.src.stop(); } catch (e) { /* already stopped */ }
        try { lfo.stop(); } catch (e) { /* already stopped */ }
      },
    };
  },
};

// The authored one-shot voices. hearth/* and wind are beds and live in BEDS.
const VOICES = {
  'footfall/snow': footfallSnow,
  'footfall/path': footfallPath,
  'footfall/earth': footfallEarth,
  'footfall/straw': footfallStraw,
  'load-down': loadDown,
  latch,
  'taper-strike': taperStrike,
  'dawn-bird': dawnBird,
  guitar,
};
const BEDS = {
  'hearth/small': makeHearth({ noise: 0.035, crackle: 0.10 }),
  'hearth/high': makeHearth({ noise: 0.085, crackle: 0.30 }),
  wind,
};

const entries = new Map(); // key -> { ready }

// Build the position stage inside any BaseAudioContext (live or offline) and
// return the node a voice should connect into: input -> [low-pass] -> out,
// with the dry reflection tapped off the input.
function positionChain(ac, position, out) {
  const p = POSITIONS[position] || POSITIONS.yard;
  const input = ac.createGain();
  let tail = input;
  if (p.lowpass) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = p.lowpass;
    f.Q.value = 0.7;
    tail.connect(f);
    tail = f;
  }
  tail.connect(out);
  if (p.reflection) {
    const d = ac.createDelay(0.3);
    d.delayTime.value = p.reflection.delay;
    const g = ac.createGain();
    g.gain.value = p.reflection.gain;
    input.connect(d); d.connect(g); g.connect(out);
  }
  return input;
}

let ac = null;          // the live AudioContext, created in load()
let master = null;      // the sound on/off switch every live cue goes through
let soundOn = true;
let positionOf = null;  // main.js supplies the creature's listening position
let phaseOf = null;     // and the phase a cue is logged against, for QA
let seedHash = 0;       // FNV of the run's seed string; ambience only (§5)
const played = [];      // cues actually scheduled, for the QA harness
const liveBeds = new Map(); // key -> { handle, position }

export function load() {
  for (const k of GATED) entries.set(k, { ready: k in VOICES || k in BEDS });
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return; // no WebAudio: every key still plays, silently
  ac = new AC();
  master = ac.createGain();
  master.gain.value = soundOn ? 1 : 0;
  master.connect(ac.destination);
}

// The autoplay policy: the context is suspended until a real user gesture.
// main.js calls this from the first keydown/mousedown; it is idempotent and
// never throws (a rejected resume would surface as a page error).
export function resume() {
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

export function setSound(on) {
  soundOn = !!on;
  if (master) master.gain.value = soundOn ? 1 : 0;
}

// Register the function that reports where the creature is listening from.
export function onPosition(fn) { positionOf = fn; }

// Register the function that reports the current phase, logged with each cue.
export function onPhase(fn) { phaseOf = fn; }

// Ambience seeding (GAME_DESIGN §5: the seed governs ambience only). A plain
// FNV hash of the seed string — a deterministic function of the seed's value,
// never a draw from the engine's stream.
export function setSeed(seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  seedHash = h >>> 0;
}

// The hour De Lacey takes up the guitar, in night-minutes: seeded, inside the
// retiring window while the household is still awake (§13.2, §13.3 "at his own
// hours"). The phrase itself never varies.
export function guitarHour() {
  return 1.5 + (seedHash % 100) / 100 * 2.5;
}

function logCue(key, position, extra = {}) {
  played.push({ key, position, phase: phaseOf ? phaseOf() : null, ...extra });
  if (played.length > 512) played.shift();
}

// Play a key now, live. Off means really off; a missing or pending key is
// silence and the run continues; a suspended context drops the cue rather
// than queueing it to land late.
export function play(key) {
  if (!soundOn || !ac || !master || ac.state !== 'running') return;
  const v = VOICES[key];
  if (!v) return;
  const position = positionOf ? positionOf() : 'yard';
  const out = positionChain(ac, position, master);
  v(ac, out, ac.currentTime);
  logCue(key, position);
}

// State-class cues (§13.2): the hearth at its two levels and the wind are
// beds, not events. level > 0 starts the bed (or keeps it, updating params);
// 0 stops it. A position change rebuilds the bed's stage, the same move the
// one-shots get by re-entering through positionChain.
export function setBed(key, position, level, params = {}) {
  const b = BEDS[key];
  if (!b || !ac || !master) return;
  const cur = liveBeds.get(key);
  if (!level) {
    if (cur) {
      cur.handle.stop();
      liveBeds.delete(key);
      logCue(key, cur.position, { bed: 'stop' });
    }
    return;
  }
  if (cur && cur.position !== position) {
    cur.handle.stop();
    liveBeds.delete(key);
    logCue(key, cur.position, { bed: 'stop' });
  }
  const now = liveBeds.get(key);
  if (!now) {
    const out = positionChain(ac, position, master);
    liveBeds.set(key, { handle: b.start(ac, out, params), position });
    logCue(key, position, { bed: 'start', level });
  } else {
    now.handle.set(params);
  }
}

/** Keys still without an authored voice — what the completion record lists. */
export function pending() {
  return [...entries.entries()].filter(([, e]) => !e.ready).map(([k]) => k);
}

export function gatedPending() {
  return pending().filter(k => GATED_SET.has(k));
}

/** Cues scheduled so far ({key, position, phase, ...}), oldest first. For QA. */
export function playedCues() {
  return played.map(p => ({ ...p }));
}

/** Context state, the switch, and whether a live context exists. For QA. */
export function status() {
  return { context: ac ? ac.state : 'unavailable', soundOn };
}

/** Beds currently sounding ({key, position}) — the State-class cues' liveness.
 * For QA: a bed is asserted sounding, not fired once. */
export function beds() {
  return [...liveBeds.entries()].map(([key, v]) => ({ key, position: v.position }));
}

/**
 * Render a key offline and measure it: the exact voice (or bed) and position
 * stage the live path uses, inside an OfflineAudioContext, with the same
 * sound on/off gain in front. This is how "it really sounds" is proven where
 * nothing can be heard: a missing key or sound=false renders measurable
 * silence instead of throwing. Returns { rms, peak, hf900, samples } — hf900
 * is the energy above the wall's 900 Hz corner (a complementary one-pole
 * split), so the position stage is judged on the band it actually filters
 * (QA_REPORT F14: the full-band figure nets the low-pass against the
 * reflection gain and proves nothing).
 */
export async function audition(key, { position = 'hovel', sound = true, seconds = 0.6, params } = {}) {
  const AC = typeof window !== 'undefined' &&
    (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  if (!AC) return null;
  const off = new AC(1, Math.ceil(seconds * 44100), 44100);
  const m = off.createGain();
  m.gain.value = sound ? 1 : 0;
  m.connect(off.destination);
  const v = VOICES[key];
  const b = BEDS[key];
  if (v) {
    const out = positionChain(off, position, m);
    v(off, out, 0.05);
  } else if (b) {
    const out = positionChain(off, position, m);
    b.start(off, out, params || {});
  }
  const buf = await off.startRendering();
  const d = buf.getChannelData(0);
  let sum = 0, peak = 0, lp = 0, hsum = 0;
  const a = 1 - Math.exp(-2 * Math.PI * 900 / 44100);
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    const ax = Math.abs(x);
    sum += x * x;
    if (ax > peak) peak = ax;
    lp += a * (x - lp);
    const h = x - lp;
    hsum += h * h;
  }
  return { rms: Math.sqrt(sum / d.length), peak, hf900: Math.sqrt(hsum / d.length), samples: d.length };
}
