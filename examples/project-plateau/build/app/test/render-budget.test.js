import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTACT_OCCLUSION_PROFILE,
  MAX_RENDER_PIXEL_RATIO,
  QUALITY_PROFILES,
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
  assert.equal(MAX_RENDER_PIXEL_RATIO, 1.25);
  assert.equal(renderPixelRatio(2), 1.25);
  assert.equal(renderPixelRatio(1), 1);
});

test('quality profiles expose bounded fill-rate and active cadence budgets', () => {
  assert.deepEqual(Object.keys(QUALITY_PROFILES), ['low', 'balanced', 'high']);
  assert.equal(qualityRenderPixelRatio(2, 'low'), 0.85);
  assert.equal(qualityRenderPixelRatio(2, 'balanced'), 1);
  assert.equal(qualityRenderPixelRatio(2, 'high'), MAX_RENDER_PIXEL_RATIO);
  assert.equal(QUALITY_PROFILES.low.activeFps, 45);
  assert.equal(QUALITY_PROFILES.balanced.activeFps, 60);
});

test('contact occlusion is world-scaled to grounding geometry rather than a fake scene vignette', () => {
  assert.equal(CONTACT_OCCLUSION_PROFILE.radiusMeters, 0.72);
  assert.ok(CONTACT_OCCLUSION_PROFILE.radiusMeters < 1);
  assert.ok(CONTACT_OCCLUSION_PROFILE.thicknessMeters >= CONTACT_OCCLUSION_PROFILE.radiusMeters);
  assert.ok(CONTACT_OCCLUSION_PROFILE.blendIntensity <= 0.3);
  assert.ok(CONTACT_OCCLUSION_PROFILE.samples <= 6);
  assert.equal(
    CONTACT_OCCLUSION_PROFILE.role,
    'world-space-local-contact-occlusion-of-indirect-light',
  );
  assert.equal(QUALITY_PROFILES.low.gtao, false);
  assert.equal(QUALITY_PROFILES.balanced.gtao, true);
});

test('render cadence saves power on title and pause while preserving active play', () => {
  assert.equal(renderIntervalForState({ runActive: true, cameraMode: 'field' }), 1000 / 60);
  assert.equal(renderIntervalForState({ runActive: false, cameraMode: 'title' }), 1000 / 30);
  assert.equal(renderIntervalForState({ runActive: true, cameraMode: 'field', paused: true }), 1000 / 15);
  assert.equal(renderIntervalForState({ hidden: true }), 250);
});

test('active rendering remains near 60 FPS across standard and high-refresh displays', () => {
  const active = renderIntervalForState({ runActive: true, cameraMode: 'field' });
  for (const refreshHz of [60, 75, 90, 100, 120, 144, 165]) {
    const fps = simulatedFramesPerSecond(refreshHz, active);
    assert.ok(fps >= 59.5 && fps <= 60.1, `${refreshHz} Hz display produced ${fps} FPS`);
  }
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
