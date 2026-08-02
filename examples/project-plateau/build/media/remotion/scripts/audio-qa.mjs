import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

function run(command, args, {encoding = 'utf8'} = {}) {
  const result = spawnSync(command, args, {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = encoding ? result.stderr : Buffer.from(result.stderr || []).toString('utf8');
    throw new Error(`${command} failed: ${String(detail).trim()}`);
  }
  return result;
}

function round(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

function pcmMetrics(buffer, sampleRate, silenceDb = -50) {
  const sampleCount = Math.floor(buffer.length / 2);
  if (!sampleCount) throw new Error('Decoded audio contained no PCM samples.');

  const threshold = 32767 * 10 ** (silenceDb / 20);
  let peak = 0;
  let clipped = 0;
  let active = 0;
  let firstActive = -1;
  let lastActive = -1;

  for (let index = 0; index < sampleCount; index += 1) {
    const absolute = Math.abs(buffer.readInt16LE(index * 2));
    if (absolute > peak) peak = absolute;
    if (absolute >= 32760) clipped += 1;
    if (absolute >= threshold) {
      active += 1;
      if (firstActive < 0) firstActive = index;
      lastActive = index;
    }
  }

  return {
    decodedSamples: sampleCount,
    decodedDurationSeconds: round(sampleCount / sampleRate),
    samplePeakDbfs: peak ? round(20 * Math.log10(peak / 32767), 2) : null,
    clippedSampleRatio: round(clipped / sampleCount, 8),
    activeSampleRatio: round(active / sampleCount, 6),
    leadingSilenceSeconds: firstActive < 0 ? null : round(firstActive / sampleRate),
    trailingSilenceSeconds:
      lastActive < 0 ? null : round((sampleCount - lastActive - 1) / sampleRate),
    silenceThresholdDbfs: silenceDb,
  };
}

function loudnessMetrics(filePath) {
  const result = run(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', filePath, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
  );
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'));
  const integrated = summary.match(/Integrated loudness:[\s\S]*?I:\s*(-inf|-?[\d.]+) LUFS/);
  const range = summary.match(/Loudness range:[\s\S]*?LRA:\s*([\d.]+) LU/);
  const peak = summary.match(/True peak:[\s\S]*?Peak:\s*(-inf|-?[\d.]+) dBFS/);
  if (!integrated || !range || !peak) {
    throw new Error('Could not parse ffmpeg ebur128 summary.');
  }
  return {
    integratedLufs: integrated[1] === '-inf' ? null : Number(integrated[1]),
    loudnessRangeLu: Number(range[1]),
    truePeakDbfs: peak[1] === '-inf' ? null : Number(peak[1]),
  };
}

export async function inspectAudio(filePath, {silenceDb = -50} = {}) {
  const probe = run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size,bit_rate:stream=index,codec_name,codec_type,sample_rate,channels,bit_rate',
    '-of',
    'json',
    filePath,
  ]);
  const decoded = run(
    'ffmpeg',
    ['-v', 'error', '-i', filePath, '-f', 's16le', '-ac', '1', '-ar', '16000', 'pipe:1'],
    {encoding: null},
  );
  const data = JSON.parse(probe.stdout);
  const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
  if (!audio) throw new Error(`No audio stream found in ${filePath}.`);

  const bytes = await readFile(filePath);
  return {
    file: filePath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    codec: audio.codec_name,
    sampleRate: Number(audio.sample_rate),
    channels: audio.channels,
    bitrate: Number(audio.bit_rate || data.format?.bit_rate),
    durationSeconds: round(Number(data.format?.duration)),
    ...pcmMetrics(decoded.stdout, 16000, silenceDb),
    ...loudnessMetrics(filePath),
  };
}

export function evaluateAudio(metrics, criteria = {}) {
  const checks = [];
  const check = (id, passed, evidence) => checks.push({id, passed: Boolean(passed), evidence});

  check('non_empty_file', metrics.bytes >= (criteria.minimumBytes ?? 1024), `${metrics.bytes} bytes`);
  check(
    'positive_duration',
    metrics.durationSeconds >= (criteria.minimumSeconds ?? 0.25),
    `${metrics.durationSeconds}s`,
  );
  if (criteria.maximumSeconds !== undefined) {
    check(
      'duration_ceiling',
      metrics.durationSeconds <= criteria.maximumSeconds,
      `${metrics.durationSeconds}s <= ${criteria.maximumSeconds}s`,
    );
  }
  if (criteria.codec) check('codec', metrics.codec === criteria.codec, `${metrics.codec} == ${criteria.codec}`);
  if (criteria.sampleRate) {
    check('sample_rate', metrics.sampleRate === criteria.sampleRate, `${metrics.sampleRate} == ${criteria.sampleRate}`);
  }
  if (criteria.bitrate) {
    const tolerance = criteria.bitrateTolerance ?? 1000;
    check(
      'bitrate',
      Number.isFinite(metrics.bitrate) && Math.abs(metrics.bitrate - criteria.bitrate) <= tolerance,
      `${metrics.bitrate} bps; target ${criteria.bitrate} ±${tolerance}`,
    );
  }
  if (criteria.channels) check('channels', metrics.channels === criteria.channels, `${metrics.channels} == ${criteria.channels}`);
  check(
    'audible_signal',
    metrics.activeSampleRatio >= (criteria.minimumActiveRatio ?? 0.03),
    `${metrics.activeSampleRatio} active ratio`,
  );
  check(
    'sample_clipping',
    metrics.clippedSampleRatio <= (criteria.maximumClippedRatio ?? 0.0001),
    `${metrics.clippedSampleRatio} clipped ratio`,
  );
  if (criteria.targetLufs !== undefined) {
    const tolerance = criteria.lufsTolerance ?? 1;
    check(
      'integrated_loudness',
      Number.isFinite(metrics.integratedLufs) &&
        Math.abs(metrics.integratedLufs - criteria.targetLufs) <= tolerance,
      `${metrics.integratedLufs} LUFS; target ${criteria.targetLufs} ±${tolerance}`,
    );
  }
  if (criteria.maximumTruePeakDbfs !== undefined) {
    check(
      'true_peak',
      Number.isFinite(metrics.truePeakDbfs) && metrics.truePeakDbfs <= criteria.maximumTruePeakDbfs,
      `${metrics.truePeakDbfs} dBFS <= ${criteria.maximumTruePeakDbfs} dBFS`,
    );
  }
  if (criteria.maximumEdgeSilenceSeconds !== undefined) {
    check(
      'leading_silence',
      metrics.leadingSilenceSeconds !== null && metrics.leadingSilenceSeconds <= criteria.maximumEdgeSilenceSeconds,
      `${metrics.leadingSilenceSeconds}s`,
    );
    check(
      'trailing_silence',
      metrics.trailingSilenceSeconds !== null && metrics.trailingSilenceSeconds <= criteria.maximumEdgeSilenceSeconds,
      `${metrics.trailingSilenceSeconds}s`,
    );
  }

  return {passed: checks.every((item) => item.passed), checks};
}
