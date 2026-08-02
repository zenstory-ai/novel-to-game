import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {evaluateAudio, inspectAudio} from './audio-qa.mjs';

function wavFixture({seconds = 0.5, frequency = 440, amplitude = 0.25, sampleRate = 16000} = {}) {
  const samples = Math.round(seconds * sampleRate);
  const pcm = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude * 32767);
    pcm.writeInt16LE(value, index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

test('audio inspection proves that a valid non-silent WAV decodes', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'novel-to-game-audio-qa-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'tone.wav');
  await writeFile(file, wavFixture());

  const metrics = await inspectAudio(file);
  const result = evaluateAudio(metrics, {
    codec: 'pcm_s16le',
    sampleRate: 16000,
    channels: 1,
    minimumSeconds: 0.4,
  });

  assert.equal(result.passed, true);
  assert.ok(metrics.activeSampleRatio > 0.9);
  assert.ok(metrics.sha256);
});

test('audio evaluation rejects silence and clipping', () => {
  const result = evaluateAudio({
    bytes: 4096,
    durationSeconds: 1,
    activeSampleRatio: 0,
    clippedSampleRatio: 0.5,
    codec: 'pcm_s16le',
    sampleRate: 16000,
    channels: 1,
  });
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.checks.filter((item) => !item.passed).map((item) => item.id),
    ['audible_signal', 'sample_clipping'],
  );
});

test('audio evaluation records and enforces the declared bitrate budget', () => {
  const result = evaluateAudio(
    {
      bytes: 4096,
      durationSeconds: 1,
      activeSampleRatio: 0.5,
      clippedSampleRatio: 0,
      codec: 'mp3',
      sampleRate: 44100,
      channels: 1,
      bitrate: 128000,
    },
    {bitrate: 192000, bitrateTolerance: 4000},
  );
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => item.id === 'bitrate' && !item.passed));
});

// The release verifier runs on gitignored audio, so CI never executes it. These pure cases are the
// only thing standing between a neutered gate and a green build: hold a full pass baseline and break
// one criterion at a time, using the exact criteria verify-voiceover.mjs applies to the final WAV.
test('every declared audio gate fails on its own', () => {
  const passing = {
    bytes: 4096,
    durationSeconds: 30,
    codec: 'pcm_s16le',
    sampleRate: 48000,
    channels: 2,
    activeSampleRatio: 0.7,
    clippedSampleRatio: 0,
    integratedLufs: -16,
    truePeakDbfs: -5,
    leadingSilenceSeconds: 0.1,
    trailingSilenceSeconds: 0.1,
  };
  const criteria = {
    codec: 'pcm_s16le',
    sampleRate: 48000,
    channels: 2,
    minimumSeconds: 1,
    maximumSeconds: 30.85,
    minimumActiveRatio: 0.03,
    maximumClippedRatio: 0.0001,
    targetLufs: -16,
    lufsTolerance: 1,
    maximumTruePeakDbfs: -1.9,
    maximumEdgeSilenceSeconds: 1,
  };
  assert.equal(evaluateAudio(passing, criteria).passed, true);

  const breakages = [
    ['non_empty_file', {bytes: 512}],
    ['positive_duration', {durationSeconds: 0.1}],
    ['duration_ceiling', {durationSeconds: 31}],
    ['codec', {codec: 'mp3'}],
    ['sample_rate', {sampleRate: 44100}],
    ['channels', {channels: 1}],
    ['audible_signal', {activeSampleRatio: 0.01}],
    ['sample_clipping', {clippedSampleRatio: 0.01}],
    ['integrated_loudness', {integratedLufs: -22}],
    ['integrated_loudness', {integratedLufs: null}],
    ['true_peak', {truePeakDbfs: -0.5}],
    ['true_peak', {truePeakDbfs: null}],
    ['leading_silence', {leadingSilenceSeconds: 2}],
    ['leading_silence', {leadingSilenceSeconds: null}],
    ['trailing_silence', {trailingSilenceSeconds: 2}],
    ['trailing_silence', {trailingSilenceSeconds: null}],
  ];
  for (const [checkId, patch] of breakages) {
    const result = evaluateAudio({...passing, ...patch}, criteria);
    const label = JSON.stringify(patch);
    assert.equal(result.passed, false, `evaluation survived ${label}`);
    assert.equal(result.checks.find((item) => item.id === checkId).passed, false, `${checkId} ignored ${label}`);
  }
});

test('loudness measurement reports a real integrated level and true peak', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'novel-to-game-audio-qa-loudness-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'tone.wav');
  // A 0.25 full-scale sine has a deterministic true peak of 20*log10(0.25) = -12.04 dBFS. The
  // integrated level varies between ffmpeg builds, so only assert that it was actually measured.
  await writeFile(file, wavFixture({seconds: 4, amplitude: 0.25}));

  const metrics = await inspectAudio(file);
  assert.ok(Math.abs(metrics.truePeakDbfs - -12.04) <= 0.5, `true peak was ${metrics.truePeakDbfs}`);
  assert.ok(Number.isFinite(metrics.integratedLufs), `integrated loudness was ${metrics.integratedLufs}`);
  assert.ok(metrics.integratedLufs > -40 && metrics.integratedLufs < 0);
  assert.ok(Number.isFinite(metrics.loudnessRangeLu));
});

test('audio inspection reports a silent file without mistaking it for usable speech', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'novel-to-game-audio-qa-silence-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'silence.wav');
  await writeFile(file, wavFixture({amplitude: 0}));

  const metrics = await inspectAudio(file);
  const result = evaluateAudio(metrics, {maximumTruePeakDbfs: -0.1});
  assert.equal(result.passed, false);
  assert.equal(metrics.activeSampleRatio, 0);
  assert.ok(result.checks.some((item) => item.id === 'audible_signal' && !item.passed));
});
