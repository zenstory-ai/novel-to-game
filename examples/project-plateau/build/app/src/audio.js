export const AUDIO_CAPTIONS = Object.freeze({
  'field-start': '[brook water, insects and wind in the fern]',
  examine: '[fern brushes aside; pencil marks the field card]',
  'family-play': '[young feet drum the glade; one animal chirrs]',
  'family-branch': '[a heavy bough creaks above the feeding adult]',
  'camera-raise': '[wood frame lifts; bellows opens]',
  shutter: '[shutter releases]',
  'plate-slide': '[glass plate seats in its case]',
  watch: '[one wing call answers at a distance]',
  search: '[a near call circles overhead]',
  attack: '[wingbeats circle low overhead]',
  cover: '[thorns close overhead]',
  rifle: '[rifle report; echo runs toward the brook]',
  contact: '[case strike; glass cracks]',
  'case-drop': '[the plate case hits the ground; glass settles inside]',
  'brook-response': '[brush thrashes beside the brook]',
  stegosaurus: '[slow, heavy tread from the western trees]',
  'stegosaurus-drinking': '[something heavy drinks at the brook to the west]',
  result: '[glass plates settle on the light board]',
  failure: '[the field sound narrows to wind and brook]',
});

const DEFAULT_VOLUMES = { ambience: 0.34, effects: 0.72, music: 0.2 };
// Recorded field sounds (public/assets/audio, ledger in build/art/audio-assets.json). Every one has a
// synthesized fallback below, so a missing or undecodable file only changes the timbre, never the cue.
const SAMPLE_IDS = [
  'brook', 'insects', 'wind', 'field-start', 'examine', 'family-play', 'family-branch', 'camera-raise', 'shutter',
  'plate-slide', 'wing', 'attack', 'cover', 'rifle', 'contact', 'case-drop', 'brook-response', 'stegosaurus',
  'stegosaurus-drinking', 'result', 'failure', 'step', 'step-crouch',
];
const sampleUrl = (id) => `/assets/audio/${id}.mp3`;
const THREAT_MUSIC_URL = '/assets/audio/threat.mp3';
// Which bus a recorded cue plays on, and at what level.
const SAMPLE_CUES = {
  'field-start': ['ambience', 0.5],
  examine: ['effects', 0.5],
  'family-play': ['ambience', 0.7],
  'family-branch': ['ambience', 0.8],
  'camera-raise': ['effects', 0.6],
  shutter: ['effects', 0.8],
  'plate-slide': ['effects', 0.6],
  cover: ['effects', 0.6],
  rifle: ['effects', 0.9],
  contact: ['effects', 0.8],
  'case-drop': ['effects', 0.7],
  'brook-response': ['ambience', 0.8],
  stegosaurus: ['ambience', 1],
  'stegosaurus-drinking': ['ambience', 0.9],
  result: ['music', 0.9],
  failure: ['music', 0.9],
};
// Bed levels are chosen to be heard on laptop speakers at the default volumes:
// nothing that carries meaning sits below about 90 Hz.
const BED_LEVELS = { brook: 0.55, insects: 0.09, wind: 0.22 };
const STEP_METERS = 0.78;

export function captionForCue(cue) {
  return AUDIO_CAPTIONS[cue] ?? null;
}

// Loudness of the brook for a listener this many metres from the water.
export function brookBedGain(distanceMeters) {
  const nearness = Math.max(0, Math.min(1, (28 - distanceMeters) / 24));
  return BED_LEVELS.brook * nearness ** 1.6;
}

export class FieldAudio {
  constructor() {
    this.context = null;
    this.buses = null;
    this.beds = null;
    this.wing = null;
    this.musicBedGain = null;
    this.volumes = { ...DEFAULT_VOLUMES };
    this.captionsEnabled = true;
    this.history = [];
    this.status = 'idle';
    this.threatState = 'distant';
    this.lastStepAt = 0;
    this.nextWingCallAt = 0;
  }

  // Build the graph early (on the first menu click) and leave it suspended,
  // so starting the run only resumes it.
  prepare() {
    if (this.context) return;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) {
      this.status = 'unavailable';
      return;
    }
    try {
      this.context = new AudioContextClass();
      void this.context.suspend?.();
      this.buildGraph();
    } catch {
      this.context = null;
      this.status = 'blocked';
    }
  }

  buildGraph() {
    const context = this.context;
    const master = context.createGain();
    master.gain.value = 0.8;
    master.connect(context.destination);
    this.buses = Object.fromEntries(
      Object.entries(this.volumes).map(([name, volume]) => {
        const gain = context.createGain();
        gain.gain.value = volume;
        gain.connect(master);
        return [name, gain];
      }),
    );
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noise.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.04) * 0.985;
      samples[index] = white * 0.55 + brown * 2.2;
    }
    const bed = (type, frequency, q) => {
      const source = context.createBufferSource();
      const node = { source };
      source.buffer = noise;
      source.loop = true;
      source.loopStart = Math.random();
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.buses.ambience);
      source.start();
      return Object.assign(node, { filter, gain });
    };
    this.beds = {
      brook: bed('bandpass', 900, 0.6),
      insects: bed('bandpass', 4600, 6),
      wind: bed('lowpass', 420, 0.7),
    };
    this.noise = noise;

    const music = context.createOscillator();
    music.type = 'triangle';
    music.frequency.value = 147;
    const musicBed = context.createGain();
    musicBed.gain.value = 0.0001;
    music.connect(musicBed).connect(this.buses.music);
    music.start();
    this.musicBedGain = musicBed;
    this.musicTone = music;
    this.loadRecordings();

    const panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 6;
    panner.rolloffFactor = 0.8;
    panner.connect(this.buses.effects);
    this.wing = { panner };
  }

  // Fetch the recorded sounds in the background. Beds swap from filtered noise to their recording
  // once it decodes; the threat score replaces the music bed's drone once it can play.
  loadRecordings() {
    const context = this.context;
    this.samples = new Map();
    for (const id of SAMPLE_IDS) {
      fetch(sampleUrl(id))
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(id))))
        .then((bytes) => context.decodeAudioData(bytes))
        .then((buffer) => {
          this.samples.set(id, buffer);
          const bed = this.beds?.[id];
          if (!bed) return;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(bed.gain);
          source.start(0, Math.random() * buffer.duration);
          bed.source.stop();
          bed.source = source;
        })
        .catch(() => {});
    }
    if (typeof Audio === 'undefined') return;
    const score = new Audio(THREAT_MUSIC_URL);
    score.loop = true;
    score.preload = 'auto';
    score.addEventListener('canplay', () => {
      const node = context.createMediaElementSource(score);
      node.connect(this.musicBedGain);
      this.musicTone.disconnect();
      this.score = score;
      this.musicBedLevel = 12; // the recording sits far quieter than the drone it replaces
    }, { once: true });
  }

  playSample(id, target, gainValue = 1) {
    const buffer = this.samples?.get(id);
    if (!buffer || !this.context) return false;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = gainValue;
    source.connect(gain).connect(target);
    source.start();
    return true;
  }

  async start() {
    try {
      this.prepare();
      if (!this.context) {
        this.record('field-start');
        return;
      }
      await this.context.resume();
      this.status = this.context.state;
      this.record('field-start');
    } catch {
      this.status = 'blocked';
      this.record('field-start');
    }
  }

  record(cue) {
    this.history.push({
      cue,
      caption: captionForCue(cue),
      at: Number((this.context?.currentTime ?? 0).toFixed(3)),
    });
    if (this.history.length > 48) this.history.shift();
  }

  tone(frequency, duration, bus = 'effects', gainValue = 0.12, type = 'triangle', delay = 0, target = null) {
    if (!this.context || !this.buses) return;
    const startsAt = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startsAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(gain).connect(target ?? this.buses[bus]);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.02);
    return oscillator;
  }

  burst(duration, frequency, gainValue, delay = 0, bus = 'effects') {
    if (!this.context || !this.noise) return;
    const startsAt = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(gainValue, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    source.connect(filter).connect(gain).connect(this.buses[bus]);
    source.start(startsAt, Math.random());
    source.stop(startsAt + duration + 0.02);
  }

  // A hoarse, falling call from wherever the wing is.
  wingCall(gainValue = 0.22) {
    if (!this.wing) return;
    if (this.playSample('wing', this.wing.panner, gainValue * 3.5)) return;
    const call = this.tone(1350, 0.42, 'effects', gainValue, 'sawtooth', 0, this.wing.panner);
    call?.frequency.exponentialRampToValueAtTime(620, this.context.currentTime + 0.4);
  }

  cue(name) {
    this.record(name);
    if (!this.context || this.context.state !== 'running') return;
    const recorded = SAMPLE_CUES[name];
    if (recorded && this.playSample(name, this.buses[recorded[0]], recorded[1])) return;
    if (name === 'attack' && this.samples?.has('attack')) {
      this.wingCall(0.3);
      this.playSample('attack', this.wing.panner, 1);
      return;
    }
    if (name === 'examine') {
      this.tone(610, 0.08, 'effects', 0.05, 'square');
      this.tone(420, 0.11, 'effects', 0.04, 'triangle', 0.09);
    } else if (name === 'family-play') {
      this.tone(460, 0.16, 'ambience', 0.08, 'triangle');
      this.tone(620, 0.12, 'ambience', 0.06, 'sine', 0.12);
    } else if (name === 'family-branch') {
      this.tone(150, 0.36, 'ambience', 0.09, 'sawtooth');
      this.tone(210, 0.22, 'ambience', 0.06, 'triangle', 0.18);
    } else if (name === 'camera-raise') {
      this.tone(220, 0.14, 'effects', 0.06, 'sawtooth');
    } else if (name === 'shutter') {
      this.tone(820, 0.045, 'effects', 0.11, 'square');
      this.tone(260, 0.08, 'effects', 0.07, 'triangle', 0.045);
    } else if (name === 'plate-slide') {
      this.tone(1180, 0.16, 'effects', 0.045, 'sine');
      this.tone(360, 0.12, 'effects', 0.035, 'square', 0.11);
    } else if (name === 'watch' || name === 'search') {
      this.wingCall(name === 'watch' ? 0.12 : 0.2);
    } else if (name === 'attack') {
      this.wingCall(0.3);
      this.tone(190, 0.5, 'ambience', 0.12, 'sawtooth', 0.1);
    } else if (name === 'cover') {
      this.burst(0.35, 2600, 0.12);
    } else if (name === 'rifle') {
      this.burst(0.5, 1800, 0.6);
      this.tone(110, 0.5, 'effects', 0.3, 'square');
    } else if (name === 'contact') {
      this.burst(0.18, 900, 0.4);
      this.tone(1280, 0.28, 'effects', 0.11, 'triangle', 0.04);
    } else if (name === 'case-drop') {
      this.tone(160, 0.16, 'effects', 0.16, 'triangle');
      this.tone(1120, 0.2, 'effects', 0.035, 'sine', 0.06);
    } else if (name === 'brook-response') {
      this.burst(0.6, 1400, 0.18, 0, 'ambience');
      this.tone(178, 0.35, 'ambience', 0.06, 'triangle', 0.19);
    } else if (name === 'stegosaurus' || name === 'stegosaurus-drinking') {
      // Heavy footfalls: a low thump with enough upper body to survive small speakers.
      for (const delay of [0, 1.1, 2.2]) {
        this.tone(96, 0.4, 'ambience', 0.22, 'sine', delay);
        this.burst(0.22, 320, 0.2, delay, 'ambience');
      }
    } else if (name === 'result') {
      this.tone(196, 0.5, 'music', 0.07, 'triangle');
      this.tone(247, 0.62, 'music', 0.06, 'triangle', 0.18);
    } else if (name === 'failure') {
      this.tone(110, 0.75, 'music', 0.08, 'sine');
    }
  }

  // Per frame: place the listener and the wing, set the beds, tick footsteps.
  update({ listener, forward, brookDistance = 30, wingPosition = null, distanceTravelled = 0, stance = 'walk', elapsed = 0 } = {}) {
    if (!this.context || this.context.state !== 'running' || !this.beds) return;
    const now = this.context.currentTime;
    const audioListener = this.context.listener;
    if (listener && audioListener.positionX) {
      audioListener.positionX.setTargetAtTime(listener.x, now, 0.05);
      audioListener.positionY.setTargetAtTime(listener.y, now, 0.05);
      audioListener.positionZ.setTargetAtTime(listener.z, now, 0.05);
      audioListener.forwardX.setTargetAtTime(forward.x, now, 0.05);
      audioListener.forwardY.setTargetAtTime(forward.y, now, 0.05);
      audioListener.forwardZ.setTargetAtTime(forward.z, now, 0.05);
    }
    if (wingPosition && this.wing.panner.positionX) {
      this.wing.panner.positionX.setTargetAtTime(wingPosition.x, now, 0.05);
      this.wing.panner.positionY.setTargetAtTime(wingPosition.y, now, 0.05);
      this.wing.panner.positionZ.setTargetAtTime(wingPosition.z, now, 0.05);
    }
    this.beds.brook.gain.gain.setTargetAtTime(brookBedGain(brookDistance), now, 0.4);
    this.beds.insects.gain.gain.setTargetAtTime(
      BED_LEVELS.insects * (0.7 + Math.sin(elapsed * 0.6) * 0.3),
      now,
      0.4,
    );
    this.beds.wind.gain.gain.setTargetAtTime(
      BED_LEVELS.wind * (0.6 + Math.sin(elapsed * 0.23) * 0.4),
      now,
      0.8,
    );
    if (distanceTravelled - this.lastStepAt >= STEP_METERS || distanceTravelled < this.lastStepAt) {
      if (distanceTravelled > this.lastStepAt && !this.playSample(stance === 'crouch' ? 'step-crouch' : 'step', this.buses.effects, stance === 'crouch' ? 0.35 : 0.6)) {
        this.burst(0.07, stance === 'crouch' ? 500 : 900, stance === 'crouch' ? 0.05 : 0.12);
      }
      this.lastStepAt = distanceTravelled;
    }
    if (this.threatState === 'attack' && elapsed >= this.nextWingCallAt) {
      this.wingCall(0.24);
      this.nextWingCallAt = elapsed + 1.4;
    }
  }

  setThreatState(state) {
    if (state === this.threatState) return;
    this.threatState = state;
    if (state !== 'distant') this.cue(state);
    if (this.musicBedGain && this.context) {
      const level = this.musicBedLevel ?? 1;
      const target = state === 'search' ? 0.03 * level : state === 'attack' ? 0.06 * level : 0.0001;
      this.musicBedGain.gain.setTargetAtTime(target, this.context.currentTime, 0.18);
      if (this.score && state !== 'distant') this.score.play().catch(() => {});
    }
  }

  resetRun() {
    this.history = [];
    this.threatState = 'distant';
    this.lastStepAt = 0;
    this.nextWingCallAt = 0;
    if (this.musicBedGain && this.context) {
      this.musicBedGain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.08);
    }
  }

  setVolume(channel, value) {
    if (!(channel in this.volumes)) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const bounded = Math.max(0, Math.min(1, numeric));
    this.volumes[channel] = bounded;
    if (this.buses?.[channel] && this.context) {
      this.buses[channel].gain.setTargetAtTime(bounded, this.context.currentTime, 0.03);
    }
  }

  setCaptionsEnabled(enabled) {
    this.captionsEnabled = Boolean(enabled);
  }

  async pause() {
    try {
      if (this.context?.state === 'running') await this.context.suspend();
    } catch {
      this.status = 'blocked';
    }
    this.status = this.context?.state ?? this.status;
  }

  async resume() {
    try {
      if (this.context?.state === 'suspended') await this.context.resume();
    } catch {
      this.status = 'blocked';
    }
    this.status = this.context?.state ?? this.status;
  }

  snapshot() {
    return {
      status: this.context?.state ?? this.status,
      volumes: { ...this.volumes },
      captionsEnabled: this.captionsEnabled,
      threatState: this.threatState,
      recentCues: this.history.slice(-16),
    };
  }
}
