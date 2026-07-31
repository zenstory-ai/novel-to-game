import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIO_CAPTIONS, FieldAudio, captionForCue } from '../src/audio.js';

const CORE_CUES = [
  'field-start',
  'examine',
  'camera-raise',
  'shutter',
  'plate-slide',
  'watch',
  'search',
  'attack',
  'cover',
  'rifle',
  'contact',
  'brook-response',
  'result',
  'failure',
];

test('every core field cue has a concise sound caption', () => {
  assert.deepEqual(Object.keys(AUDIO_CAPTIONS), CORE_CUES);
  for (const cue of CORE_CUES) {
    assert.match(captionForCue(cue), /^\[.+\]$/);
  }
  assert.equal(captionForCue('unknown'), null);
});

test('audio settings clamp channel volumes and expose caption state', () => {
  const audio = new FieldAudio();
  audio.setVolume('ambience', -1);
  audio.setVolume('effects', 0.45);
  audio.setVolume('music', 2);
  audio.setVolume('unknown', 0.1);
  audio.setCaptionsEnabled(false);

  assert.deepEqual(audio.snapshot().volumes, {
    ambience: 0,
    effects: 0.45,
    music: 1,
  });
  assert.equal(audio.snapshot().captionsEnabled, false);
});

test('cue history and threat transitions stay observable without Web Audio', async () => {
  const audio = new FieldAudio();
  await audio.start();
  audio.cue('examine');
  audio.setThreatState('watch');
  audio.setThreatState('watch');

  const snapshot = audio.snapshot();
  assert.ok(['unavailable', 'running'].includes(snapshot.status));
  assert.equal(snapshot.threatState, 'watch');
  assert.deepEqual(snapshot.recentCues.map(({ cue }) => cue), ['field-start', 'examine', 'watch']);
});

test('cue history remains bounded during a long field session', () => {
  const audio = new FieldAudio();
  for (let index = 0; index < 60; index += 1) audio.cue('shutter');
  assert.equal(audio.history.length, 48);
  assert.equal(audio.snapshot().recentCues.length, 16);
  audio.resetRun();
  assert.deepEqual(audio.snapshot().recentCues, []);
  assert.equal(audio.snapshot().threatState, 'distant');
});
