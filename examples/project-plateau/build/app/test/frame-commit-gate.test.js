import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrameCommitGate } from '../src/frame-commit-gate.js';

test('asset presentation waits for a rendered-frame commit and supports retry', async () => {
  const gate = createFrameCommitGate();
  let firstSettled = false;
  const first = gate.wait().then(() => { firstSettled = true; });

  await Promise.resolve();
  assert.equal(firstSettled, false);
  assert.equal(gate.pending(), true);
  assert.equal(gate.commit(), true);
  await first;
  assert.equal(firstSettled, true);
  assert.equal(gate.pending(), false);

  const retry = gate.wait();
  assert.equal(gate.pending(), true);
  gate.commit();
  await retry;
  assert.equal(gate.pending(), false);
  assert.equal(gate.commit(), false);
});
