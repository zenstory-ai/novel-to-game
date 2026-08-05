import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const app = path.resolve(import.meta.dirname, '..');
const runner = path.join(app, 'test', 'qa_targeted.py');
const coverage = path.join(app, 'test', 'targeted-coverage.json');

function run(...args) {
  return execFileSync('python3', [runner, ...args], { cwd: app, encoding: 'utf8' });
}

function cleanAuthoritativeMetadata(directory) {
  const parent = path.dirname(directory);
  const name = path.basename(directory);
  rmSync(path.join(parent, `.${name}-authoritative-verify-receipt.json`), { force: true });
  rmSync(path.join(parent, `.${name}-post-verify-audit.json`), { force: true });
  rmSync(`${directory}-verification.json`, { force: true });
  rmSync(`${directory}-verify.log`, { force: true });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fingerprints() {
  return JSON.parse(execFileSync('python3', ['-c', `import json,sys; sys.path.insert(0, ${JSON.stringify(path.join(app, 'test'))}); import qa_targeted; print(json.dumps(qa_targeted.four_fingerprints()))`], { cwd: app, encoding: 'utf8' }));
}

function resources(directory) {
  const records = [];
  function visit(current) {
    for (const name of readdirSync(current)) {
      const absolute = path.join(current, name);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (!['manifest.json', 'freeze.json', 'reviews-freeze.json'].includes(name) && !absolute.includes(`${path.sep}reviews${path.sep}`)) {
        const data = readFileSync(absolute);
        records.push({ path: path.relative(directory, absolute).split(path.sep).join('/'), bytes: data.length, sha256: sha256(data) });
      }
    }
  }
  visit(directory);
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

function writeSyntheticPerformanceBundle(directory) {
  const fp = fingerprints();
  const schema = JSON.parse(readFileSync(path.join(app, 'test', 'telemetry-schema.json'), 'utf8'));
  const contract = schema.performanceContract;
  const stateSelectorHash = sha256(canonical(contract.heaviestStatePredicate));
  const repeatSummaries = [1, 2, 3].map((repeat) => ({
    repeat,
    medianFrameMs: 16.7,
    medianFps: 59.9,
    onePercentLowFps: 59.9,
    worstFrameMs: 16.7,
  }));
  for (const viewport of ['1440x900', '1280x720']) {
    const rows = [];
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      for (let index = 0; index < 600; index += 1) {
        rows.push({
          repeat,
          index,
          timestampMs: ((repeat - 1) * 600 + index + 1) * 16.7,
          frameTimeMs: 16.7,
          viewport,
          profile: 'balanced',
          stateSelectorHash,
          warmupFrames: 300,
          appFingerprint: fp.appFingerprint,
          evidenceMethodFingerprint: fp.evidenceMethodFingerprint,
        });
      }
    }
    const rawPath = path.join(directory, 'performance', `raw-${viewport}-balanced.jsonl`);
    writeFileSync(rawPath, `${rows.map((row) => canonical(row)).join('\n')}\n`);
    writeFileSync(path.join(directory, 'performance', `manifest-${viewport}-balanced.json`), JSON.stringify({
      schemaVersion: 1,
      scenario: 'performance-heaviest',
      viewport,
      profile: 'balanced',
      warmupFrames: 300,
      repeats: 3,
      framesPerRepeat: 600,
      measuredFrames: 1800,
      stateSelector: contract.heaviestStatePredicate,
      stateSelectorHash,
      fingerprints: fp,
      repeatSummaries,
      worstRepeat: { medianFps: 59.9, onePercentLowFps: 59.9 },
      rawFrames: { path: path.basename(rawPath), sha256: sha256(readFileSync(rawPath)) },
    }));
  }
}

function makeCompleteBundle(directory) {
  for (const name of ['frames', 'state', 'browser', 'paths', 'performance', 'contact-sheets', 'reviews']) mkdirSync(path.join(directory, name), { recursive: true });
  const fp = fingerprints();
  const traceId = 'synthetic-structural-test-trace';
  const telemetry = [];
  for (let pf = 1; pf <= 6; pf += 1) {
    for (const viewport of ['1440x900', '1280x720']) {
      const stem = `PF-${String(pf).padStart(2, '0')}-${viewport}`;
      const framePath = path.join(directory, 'frames', `${stem}.jpg`);
      const statePath = path.join(directory, 'state', `${stem}.json`);
      const browserPath = path.join(directory, 'browser', `${stem}.json`);
      const position = { x: 0, z: 70 - pf * 10 };
      writeFileSync(framePath, `frame-${stem}`);
      writeFileSync(statePath, JSON.stringify({
        cameraMode: pf === 6 ? 'terminal' : 'field',
        player: {
          position, heading: 0, pitch: 0,
          result: pf === 6 ? { band: 'strong-field-record' } : null,
          plates: ['brook-partial', 'basalt-scale', 'glade-young-play', 'glade-branch-pull'].map((frameKey) => ({ frameKey })),
        },
      }));
      writeFileSync(browserPath, JSON.stringify({
        viewport, timecodeMs: pf * 1000, traceId, inputOnly: true, uncut: true, diagnostic: false,
      }));
      if (viewport === '1440x900') telemetry.push({
        timestampMs: pf * 1000, pf: `PF-${String(pf).padStart(2, '0')}`, inputTransitions: ['KeyW'],
        position, heading: 0, pitch: 0, cameraMode: pf === 6 ? 'terminal' : 'field',
        linearVelocity: { x: 0, z: 0 }, angularVelocity: 0, stateKey: `pf-${pf}`,
        inputOnly: true, uncut: true, diagnostic: false, captureSource: 'qa_s8-real-browser-input',
        viewport, frameSha256: sha256(readFileSync(framePath)), stateSha256: sha256(readFileSync(statePath)),
        browserSha256: sha256(readFileSync(browserPath)), ...fp, clipTimecodeMs: pf * 1000, traceId,
      });
    }
  }
  const telemetryPath = path.join(directory, 'paths', 'promotion-telemetry.jsonl');
  const clipPath = path.join(directory, 'paths', 'promotion.webm');
  writeFileSync(telemetryPath, `${telemetry.map((row) => canonical(row)).join('\n')}\n`);
  writeFileSync(clipPath, 'uncut-input-only-structural-test');
  writeFileSync(path.join(directory, 'paths', 'capture-1440x900.json'), JSON.stringify({
    captureSource: 'qa_s8-real-browser-input', viewport: '1440x900', inputOnly: true, uncut: true,
    diagnostic: false, traceId, fingerprints: fp,
    telemetry: { sha256: sha256(readFileSync(telemetryPath)) }, clip: { sha256: sha256(readFileSync(clipPath)) },
  }));
  writeFileSync(path.join(directory, 'paths', 'capture-1280x720.json'), JSON.stringify({
    captureSource: 'qa_s8-real-browser-input', viewport: '1280x720', inputOnly: true, uncut: true,
    diagnostic: false, traceId: `${traceId}-1280`, fingerprints: fp,
  }));
  for (const name of ['before.jpg', 'candidate.jpg']) writeFileSync(path.join(directory, 'contact-sheets', name), name);
  copyFileSync(path.join(app, 'test', 'reference', 'ashmaw-contact-sheet.jpg'), path.join(directory, 'contact-sheets', 'reference.jpg'));
  const reviewContract = JSON.parse(readFileSync(path.join(app, 'test', 'visual-review-contract.json'), 'utf8'));
  writeFileSync(path.join(directory, 'contact-sheets', 'before-mapping.json'), JSON.stringify(reviewContract.beforeMapping));
  writeSyntheticPerformanceBundle(directory);
  writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, fingerprints: fingerprints(), resources: resources(directory) }));
}

test('rejects fixture-only promotion evidence without a real-browser capture receipt', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-fixture-promotion-'));
  try {
    makeCompleteBundle(directory);
    rmSync(path.join(directory, 'paths', 'capture-1440x900.json'));
    writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, fingerprints: fingerprints(), resources: resources(directory) }));
    const result = spawnSync('python3', [runner, '--freeze-bundle', directory], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /real-browser capture receipt|fixture-only proof/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function addValidReviews(directory) {
  const fp = fingerprints();
  const contract = JSON.parse(readFileSync(path.join(app, 'test', 'visual-review-contract.json'), 'utf8'));
  for (const reviewerId of ['reviewer-a', 'reviewer-b']) {
    const scores = {};
    for (const pf of contract.activePf) {
      scores[pf] = {
        before: Object.fromEntries(contract.dimensions.map((dimension) => [dimension, 2])),
        candidate: Object.fromEntries(contract.dimensions.map((dimension, index) => [dimension, index < 4 ? 3 : 2])),
        blockers: 0,
        majors: 0,
      };
    }
    scores['PF-06'] = { continuity: 'PASS' };
    const payload = {
      reviewerId,
      rubricFingerprint: fp.rubricFingerprint,
      referenceFingerprint: fp.referenceFingerprint,
      calibration: {
        status: 'PASS', knownFailureAnchorId: 'known-flat-stage', anchorDisposition: 'FAIL',
        identifiedBlocker: 'near/mid/far collapse', rubricFingerprint: fp.rubricFingerprint,
        referenceFingerprint: fp.referenceFingerprint,
      },
      scores,
      disposition: { tier: 'same' },
      independence: { status: 'INDEPENDENT', conflicts: [] },
      blindOrder: ['candidate-C', 'reference-A', 'before-B'],
      beforeMapping: contract.beforeMapping,
      reviewProcess: contract.reviewProcess,
    };
    const form = { ...payload, signature: { type: contract.signatureType, signedBy: reviewerId, signedAt: '2026-08-05T00:00:00Z', payloadSha256: sha256(canonical(payload)) } };
    writeFileSync(path.join(directory, 'reviews', `${reviewerId}.json`), JSON.stringify(form));
  }
}

test('lists every registered selector with authoritative provenance', () => {
  const listing = JSON.parse(run('--list'));
  const selectors = new Map(listing.selectors.map((entry) => [entry.selector, entry]));
  assert.equal(selectors.get('performance-heaviest').registrations.join(','), 'AC-06,AC-07');
  assert.deepEqual(selectors.get('strong-route').authoritativeSuites, ['browser:complete-run']);
  assert.ok(selectors.has('investment-stop-loss'));
  assert.ok(selectors.has('quality-delta-audit'));
  assert.ok(selectors.get('strong-route').assertionSources.includes('test/qa_s8.py#run'));
  assert.ok(selectors.get('strong-route').fixtureOrCheckpointSources.length > 0);
});

test('accepts the canonical exact AC-01 through AC-20 coverage map', () => {
  const audit = JSON.parse(run('--audit-coverage', coverage));
  assert.equal(audit.status, 'PASS');
  assert.equal(audit.registrations, 20);
  assert.deepEqual(audit.coverage, Array.from({ length: 20 }, (_, index) => `AC-${String(index + 1).padStart(2, '0')}`));
  assert.equal(new Set(audit.normalizedRegistrationHashes).size, 20);
});

test('rejects a duplicate AC registration after normalized defaults expand', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-targeted-'));
  try {
    const document = JSON.parse(readFileSync(coverage, 'utf8'));
    document.registrations.push({ ...document.registrations[0], selectorArgs: { viewport: '1440x900', profile: 'balanced' } });
    const duplicate = path.join(directory, 'duplicate.json');
    writeFileSync(duplicate, JSON.stringify(document));
    const result = spawnSync('python3', [runner, '--audit-coverage', duplicate], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /duplicate acId/);
    assert.match(result.stderr, /duplicate full registration/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects unknown acceptance rows and runner-owned assertions', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-targeted-'));
  try {
    const document = JSON.parse(readFileSync(coverage, 'utf8'));
    document.registrations[0].acId = 'AC-21';
    document.registrations[1].assertionSource = 'test/qa_targeted.py#copied-rule';
    const invalid = path.join(directory, 'invalid.json');
    writeFileSync(invalid, JSON.stringify(document));
    const result = spawnSync('python3', [runner, '--audit-coverage', invalid], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown acId/);
    assert.match(result.stderr, /runner-owned duplicate assertion/);
    assert.match(result.stderr, /canonical AC mismatch/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects nonexistent provenance symbols, fixture paths, and suite ids', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-targeted-'));
  try {
    const document = JSON.parse(readFileSync(coverage, 'utf8'));
    document.registrations[0].assertionSource = 'test/qa_s8.py#run_strong_path';
    document.registrations[1].fixtureOrCheckpointSource = 'test/fixtures/not-present.json';
    document.registrations[2].authoritativeSuite = 'browser:not-real';
    const invalid = path.join(directory, 'provenance.json');
    writeFileSync(invalid, JSON.stringify(document));
    const result = spawnSync('python3', [runner, '--audit-coverage', invalid], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Python provenance symbol is not top-level/);
    assert.match(result.stderr, /provenance path does not exist/);
    assert.match(result.stderr, /unknown authoritative suite ids/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects an assertion registered to an unrelated authoritative suite', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-targeted-'));
  try {
    const document = JSON.parse(readFileSync(coverage, 'utf8'));
    document.registrations[0].authoritativeSuite = 'build:production';
    const invalid = path.join(directory, 'suite-membership.json');
    writeFileSync(invalid, JSON.stringify(document));
    const result = spawnSync('python3', [runner, '--audit-coverage', invalid], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /authoritative suite membership mismatch/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps shared spatial anchors bound to the approved baseline', () => {
  const result = JSON.parse(run('--scenario', 'spatial-anchors', '--profile', 'balanced'));
  assert.equal(result.status, 'PASS');
  assert.equal(result.seed, 139);
  assert.deepEqual(Object.keys(result.files).sort(), ['src/collision-layout.js', 'src/environment-layout.js']);
});

test('publishes the required performance and synchronized telemetry schema', () => {
  const schema = JSON.parse(readFileSync(path.join(app, 'test', 'telemetry-schema.json'), 'utf8'));
  assert.equal(schema.performanceContract.defaultWarmupFrames, 300);
  assert.equal(schema.performanceContract.defaultRepeats, 3);
  assert.equal(schema.performanceContract.defaultFramesPerRepeat, 600);
  assert.equal(schema.performanceContract.minimumMeasuredFrames, 1800);
  assert.deepEqual(schema.performanceContract.releaseFloor, { medianFps: 45, onePercentLowFps: 30 });
  for (const field of ['position', 'heading', 'pitch', 'cameraMode', 'linearVelocity', 'angularVelocity', 'inputTransitions']) {
    assert.ok(schema.promotionSampleRequired.includes(field), field);
  }
});

test('keeps route calibration bounded inside the existing forward input segment', () => {
  const result = JSON.parse(execFileSync('python3', ['-c', [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(path.join(app, 'test'))})`,
    'from qa_assertions import ROUTE_INPUT_CONTINUATION_MS, route_input_calibration',
    "print(json.dumps(route_input_calibration('KeyW', ROUTE_INPUT_CONTINUATION_MS)))",
  ].join(';')], { cwd: app, encoding: 'utf8' }));
  assert.deepEqual(result, {
    input: 'KeyW', concurrentInput: 'KeyC', continuationMs: 250, continuousInput: true, noInputSegment: false,
  });
});

test('locks PF-04 to a committed dive and PF-05 to mouse-turn forward return', () => {
  const result = JSON.parse(execFileSync('python3', ['-c', [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(path.join(app, 'test'))})`,
    'from qa_assertions import assert_promotion_pf_semantics',
    "samples=[{'pf':'PF-03','inputTransitions':['KeyW']},{'pf':'PF-04','inputTransitions':['RightMouse','LeftMouse']},{'pf':'PF-05','inputTransitions':['MouseTurn','KeyW','KeyA','KeyD','covered-return']}]",
    "states={'PF-03':{'player':{'heading':0}},'PF-04':{'player':{'heading':0,'position':{'x':2,'z':2},'threatAwareness':3,'threatState':'attack'},'threatVisual':{'attackStage':'fold-dive'}},'PF-05':{'player':{'heading':3.13,'position':{'x':3,'z':35}}}}",
    'print(json.dumps(assert_promotion_pf_semantics(samples,states)))',
  ].join(';')], { cwd: app, encoding: 'utf8' }));
  assert.equal(result.pf04Awareness, 3);
  assert.equal(result.pf04AttackStage, 'fold-dive');
  assert.ok(result.pf05HeadingDelta >= 2.5);
  assert.deepEqual(result.pf05InputTransitions, ['MouseTurn', 'KeyW', 'KeyA', 'KeyD', 'covered-return']);
  const source = readFileSync(path.join(app, 'test', 'qa_promotion.py'), 'utf8');
  assert.match(source, /capture\.checkpoint\("attack"[\s\S]*?move_until\(page, "KeyS"/);
});

test('rejects the former one-row, zero-promotion, weak-review adversarial bundle', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-freeze-'));
  try {
    mkdirSync(path.join(directory, 'performance'));
    writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, fingerprints: fingerprints(), resources: [] }));
    writeFileSync(path.join(directory, 'performance', 'raw-test.jsonl'), `${JSON.stringify({ repeat: 1, frameTimeMs: 16.7 })}\n`);
    const result = spawnSync('python3', [runner, '--freeze-bundle', directory], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /complete bundle missing|promotion|both viewports/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects weak calibration and out-of-range before scores before review freeze', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-weak-review-'));
  try {
    makeCompleteBundle(directory);
    run('--freeze-bundle', directory);
    const fp = fingerprints();
    const contract = JSON.parse(readFileSync(path.join(app, 'test', 'visual-review-contract.json'), 'utf8'));
    for (const reviewerId of ['weak-a', 'weak-b']) {
      const scores = {};
      for (const pf of contract.activePf) {
        scores[pf] = {
          before: Object.fromEntries(contract.dimensions.map((dimension) => [dimension, -100])),
          candidate: Object.fromEntries(contract.dimensions.map((dimension) => [dimension, 3])),
          blockers: 0, majors: 0,
        };
      }
      scores['PF-06'] = { continuity: 'PASS' };
      const payload = {
        reviewerId, rubricFingerprint: fp.rubricFingerprint, referenceFingerprint: fp.referenceFingerprint,
        calibration: { status: 'PASS' }, scores, disposition: { tier: 'same' },
        independence: { status: 'INDEPENDENT', conflicts: [] }, blindOrder: ['a', 'b', 'c'],
        beforeMapping: contract.beforeMapping,
        reviewProcess: contract.reviewProcess,
      };
      writeFileSync(path.join(directory, 'reviews', `${reviewerId}.json`), JSON.stringify({ ...payload, signature: { type: contract.signatureType, signedBy: reviewerId, signedAt: 'now', payloadSha256: sha256(canonical(payload)) } }));
    }
    const result = spawnSync('python3', [runner, '--freeze-reviews', directory], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /calibration evidence is incomplete|before score is outside/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects performance manifests with less than 300 warmup frames', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-weak-performance-'));
  try {
    mkdirSync(path.join(directory, 'performance'));
    writeSyntheticPerformanceBundle(directory);
    for (const viewport of ['1440x900', '1280x720']) {
      const manifestPath = path.join(directory, 'performance', `manifest-${viewport}-balanced.json`);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.warmupFrames = 299;
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    const result = spawnSync('python3', [runner, '--scenario', 'investment-stop-loss', '--evidence', directory], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /weaker than 300 warmup/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects a frozen bundle whose four fingerprints are stale even when file hashes remain self-consistent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-stale-freeze-fingerprint-'));
  try {
    makeCompleteBundle(directory);
    run('--freeze-bundle', directory);
    addValidReviews(directory);
    run('--freeze-reviews', directory);
    const freezePath = path.join(directory, 'freeze.json');
    chmodSync(freezePath, 0o644);
    const freeze = JSON.parse(readFileSync(freezePath, 'utf8'));
    freeze.fingerprints.appFingerprint = '0'.repeat(64);
    writeFileSync(freezePath, JSON.stringify(freeze));
    const result = spawnSync('python3', [runner, '--verify-frozen-bundle', directory], { cwd: app, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /frozen evidence fingerprints do not match current/);
  } finally {
    cleanAuthoritativeMetadata(directory);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('frozen authoritative verify mechanically audits AC-18 and AC-20 before post-hash audit', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-complete-freeze-'));
  try {
    makeCompleteBundle(directory);
    const frozen = JSON.parse(run('--freeze-bundle', directory));
    assert.equal(frozen.performanceSamples, 3600);
    addValidReviews(directory);
    run('--freeze-reviews', directory);
    const consumed = JSON.parse(run('--consume-authoritative-verify', directory));
    assert.equal(consumed.ac18ReviewAudit.status, 'PASS');
    assert.equal(consumed.ac18ReviewAudit.hashAttestedForms, 2);
    assert.equal(consumed.ac20QualityDeltaAudit.status, 'PASS');
    const logPath = `${directory}-verify.log`;
    const verificationPath = `${directory}-verification.json`;
    writeFileSync(logPath, 'authoritativeExitCode=0\n');
    writeFileSync(verificationPath, JSON.stringify({
      schemaVersion: 1,
      sourceFingerprint: fingerprints().appFingerprint,
      verify: {
        exitCode: 0,
        logSha256: sha256(readFileSync(logPath)),
        suites: [{ id: 'synthetic', executed: true, passed: true }],
      },
    }));
    const post = JSON.parse(run('--post-verify-audit', directory, '--verification', verificationPath, '--verification-log', logPath));
    assert.equal(post.ac18ReviewAudit.status, 'PASS');
    assert.equal(post.ac20QualityDeltaAudit.status, 'PASS');
    assert.equal(post.verificationSha256, sha256(readFileSync(verificationPath)));
  } finally {
    cleanAuthoritativeMetadata(directory);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('failed authoritative verification cannot publish PASS audit and releases its receipt', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-failed-authoritative-'));
  try {
    makeCompleteBundle(directory);
    run('--freeze-bundle', directory);
    addValidReviews(directory);
    run('--freeze-reviews', directory);
    run('--consume-authoritative-verify', directory);
    const logPath = `${directory}-verify.log`;
    const verificationPath = `${directory}-verification.json`;
    writeFileSync(logPath, 'authoritativeExitCode=1\n');
    writeFileSync(verificationPath, JSON.stringify({
      schemaVersion: 1,
      sourceFingerprint: fingerprints().appFingerprint,
      verify: {
        exitCode: 1,
        logSha256: sha256(readFileSync(logPath)),
        suites: [{ id: 'synthetic-failure', executed: true, passed: false }],
      },
    }));
    const failed = spawnSync('python3', [runner, '--post-verify-audit', directory, '--verification', verificationPath, '--verification-log', logPath], { cwd: app, encoding: 'utf8' });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /cannot publish a PASS post-audit/);
    assert.equal(readdirSync(path.dirname(directory)).includes(`.${path.basename(directory)}-post-verify-audit.json`), false);
    assert.equal(readdirSync(path.dirname(directory)).includes(`.${path.basename(directory)}-authoritative-verify-receipt.json`), false);
    const retried = JSON.parse(run('--consume-authoritative-verify', directory));
    assert.equal(retried.status, 'PASS');
  } finally {
    cleanAuthoritativeMetadata(directory);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an abandoned dead-process receipt is reclaimed when no successful post-audit exists', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plateau-abandoned-authoritative-'));
  try {
    makeCompleteBundle(directory);
    run('--freeze-bundle', directory);
    addValidReviews(directory);
    run('--freeze-reviews', directory);
    run('--consume-authoritative-verify', directory);
    const receiptPath = path.join(path.dirname(directory), `.${path.basename(directory)}-authoritative-verify-receipt.json`);
    chmodSync(receiptPath, 0o644);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    receipt.pid = 99999999;
    writeFileSync(receiptPath, JSON.stringify(receipt));
    const retried = JSON.parse(run('--consume-authoritative-verify', directory));
    assert.equal(retried.status, 'PASS');
  } finally {
    cleanAuthoritativeMetadata(directory);
    rmSync(directory, { recursive: true, force: true });
  }
});
