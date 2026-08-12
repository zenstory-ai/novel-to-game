export const AUDIO_CAPTIONS = Object.freeze({
  'field-start': '[brook water and insects under the canopy]',
  examine: '[fern brushes aside; pencil marks the field card]',
  'camera-raise': '[wood frame lifts; bellows opens]',
  shutter: '[shutter releases]',
  'plate-slide': '[glass plate seats in its case]',
  watch: '[one wing call answers at a distance]',
  search: '[a near call circles overhead]',
  attack: '[wingbeats tighten into a dive]',
  cover: '[branches scrape the camera; wingbeats widen]',
  rifle: '[rifle report; echo runs toward the brook]',
  contact: '[case strike; glass cracks]',
  'case-drop': '[the plate case hits the ground; glass settles inside]',
  'brook-response': '[brush thrashes beside the brook]',
  result: '[glass plates settle on the light board]',
  failure: '[the field sound narrows to wind and brook]',
});

const DEFAULT_VOLUMES = Object.freeze({ ambience: 0.34, effects: 0.72, music: 0.2 });

export function captionForCue(cue) {
  return AUDIO_CAPTIONS[cue] ?? null;
}

export class FieldAudio {
  constructor() {
    this.context = null;
    this.buses = null;
    this.ambientOscillator = null;
    this.musicOscillator = null;
    this.musicBedGain = null;
    this.volumes = { ...DEFAULT_VOLUMES };
    this.captionsEnabled = true;
    this.history = [];
    this.status = 'idle';
    this.threatState = 'distant';
  }

  async start() {
    try {
      if (!this.context) {
        const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContextClass) {
          this.status = 'unavailable';
          this.record('field-start');
          return;
        }
        this.context = new AudioContextClass();
        const master = this.context.createGain();
        master.gain.value = 0.68;
        master.connect(this.context.destination);
        this.buses = Object.fromEntries(
          Object.entries(this.volumes).map(([name, volume]) => {
            const gain = this.context.createGain();
            gain.gain.value = volume;
            gain.connect(master);
            return [name, gain];
          }),
        );
        this.ambientOscillator = this.context.createOscillator();
        this.ambientOscillator.type = 'sine';
        this.ambientOscillator.frequency.value = 52;
        const ambientBed = this.context.createGain();
        ambientBed.gain.value = 0.025;
        this.ambientOscillator.connect(ambientBed).connect(this.buses.ambience);
        this.ambientOscillator.start();

        this.musicOscillator = this.context.createOscillator();
        this.musicOscillator.type = 'triangle';
        this.musicOscillator.frequency.value = 73;
        const musicBed = this.context.createGain();
        musicBed.gain.value = 0.0001;
        this.musicOscillator.connect(musicBed).connect(this.buses.music);
        this.musicBedGain = musicBed;
        this.musicOscillator.start();
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

  tone(frequency, duration, bus = 'effects', gainValue = 0.12, type = 'triangle', delay = 0) {
    if (!this.context || !this.buses) return;
    const startsAt = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startsAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(gain).connect(this.buses[bus]);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.02);
  }

  cue(name) {
    this.record(name);
    if (!this.context || this.context.state !== 'running') return;
    if (name === 'examine') {
      this.tone(610, 0.08, 'effects', 0.04, 'square');
      this.tone(420, 0.11, 'effects', 0.03, 'triangle', 0.09);
    } else if (name === 'camera-raise') {
      this.tone(145, 0.18, 'effects', 0.06, 'sawtooth');
    } else if (name === 'shutter') {
      this.tone(820, 0.045, 'effects', 0.11, 'square');
      this.tone(260, 0.08, 'effects', 0.07, 'triangle', 0.045);
    } else if (name === 'plate-slide') {
      this.tone(1180, 0.16, 'effects', 0.045, 'sine');
      this.tone(360, 0.12, 'effects', 0.035, 'square', 0.11);
    } else if (name === 'watch' || name === 'search' || name === 'attack') {
      const base = { watch: 320, search: 260, attack: 185 }[name];
      this.tone(base, 0.28, 'ambience', 0.07, 'sawtooth');
      this.tone(base * 1.42, 0.2, 'ambience', 0.045, 'triangle', 0.12);
    } else if (name === 'cover') {
      this.tone(96, 0.32, 'ambience', 0.035, 'sawtooth');
    } else if (name === 'rifle') {
      this.tone(72, 0.38, 'effects', 0.34, 'square');
      this.tone(48, 0.7, 'ambience', 0.16, 'sawtooth', 0.08);
    } else if (name === 'contact') {
      this.tone(110, 0.2, 'effects', 0.2, 'square');
      this.tone(1280, 0.28, 'effects', 0.11, 'triangle', 0.04);
    } else if (name === 'case-drop') {
      this.tone(130, 0.16, 'effects', 0.14, 'triangle');
      this.tone(1120, 0.2, 'effects', 0.035, 'sine', 0.06);
    } else if (name === 'brook-response') {
      this.tone(132, 0.42, 'ambience', 0.06, 'sawtooth');
      this.tone(178, 0.35, 'ambience', 0.04, 'triangle', 0.19);
    } else if (name === 'result') {
      this.tone(196, 0.5, 'music', 0.07, 'triangle');
      this.tone(247, 0.62, 'music', 0.06, 'triangle', 0.18);
    } else if (name === 'failure') {
      this.tone(92, 0.75, 'music', 0.08, 'sine');
    }
  }

  setThreatState(state) {
    if (state === this.threatState) return;
    this.threatState = state;
    if (state !== 'distant') this.cue(state);
    if (this.musicBedGain && this.context) {
      const target = state === 'search' ? 0.018 : state === 'attack' ? 0.035 : 0.0001;
      this.musicBedGain.gain.setTargetAtTime(target, this.context.currentTime, 0.18);
    }
  }

  resetRun() {
    this.history = [];
    this.threatState = 'distant';
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
