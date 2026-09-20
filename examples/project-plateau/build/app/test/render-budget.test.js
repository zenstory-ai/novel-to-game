import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_RENDER_PIXEL_RATIO,
  advanceRenderSchedule,
  qualityRenderPixelRatio,
  renderIntervalForState,
  renderPixelRatio,
  shouldRenderFrame,
} from '../src/render-budget.js';

function simulatedFramesPerSecond(refreshHz, interval, seconds = 10) {
  let deadline = 0;
  let frames = 0;
  const refreshInterval = 1000 / refreshHz;
  const frameCount = Math.floor(refreshHz * seconds);
  for (let index = 1; index <= frameCount; index += 1) {
    const now = index * refreshInterval;
    if (!shouldRenderFrame(now, deadline, interval)) continue;
    deadline = advanceRenderSchedule(now, deadline, interval);
    frames += 1;
  }
  return frames / seconds;
}

test('render scale caps Retina fill-rate without degrading standard displays', () => {
  assert.equal(renderPixelRatio(2), MAX_RENDER_PIXEL_RATIO);
  assert.equal(renderPixelRatio(1), 1);
});

test('quality profiles expose bounded fill-rate and active cadence budgets', () => {
  assert.equal(qualityRenderPixelRatio(2, 'low'), 0.85);
  assert.equal(qualityRenderPixelRatio(2, 'balanced'), 1);
  assert.equal(qualityRenderPixelRatio(2, 'high'), MAX_RENDER_PIXEL_RATIO);
});

test('render cadence saves power on title and pause while preserving active play', () => {
  assert.equal(renderIntervalForState({ runActive: true, cameraMode: 'field' }), 1000 / 60);
  assert.equal(renderIntervalForState({ runActive: false, cameraMode: 'title' }), 1000 / 30);
  assert.equal(renderIntervalForState({ runActive: true, cameraMode: 'field', paused: true }), 1000 / 15);
  assert.equal(renderIntervalForState({ hidden: true }), 250);
});

test('idle cadence remains stable on a 120 Hz display', () => {
  assert.equal(
    simulatedFramesPerSecond(120, renderIntervalForState({ cameraMode: 'title' })),
    30,
  );
  assert.equal(
    simulatedFramesPerSecond(120, renderIntervalForState({ runActive: true, paused: true })),
    15,
  );
  assert.equal(
    simulatedFramesPerSecond(120, renderIntervalForState({ hidden: true })),
    4,
  );
});
