import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyLookDelta,
  planarAxesForHeading,
  shouldCaptureGameplayKey,
} from '../src/controller.js';

test('gameplay keys are accepted only by an active unpaused field view', () => {
  const activeField = { runActive: true, paused: false, cameraMode: 'field' };
  assert.equal(shouldCaptureGameplayKey('KeyW', activeField), true);
  assert.equal(shouldCaptureGameplayKey('ShiftLeft', activeField), true);
  assert.equal(shouldCaptureGameplayKey('Space', activeField), true);
  assert.equal(shouldCaptureGameplayKey('KeyW', { ...activeField, runActive: false }), false);
  assert.equal(shouldCaptureGameplayKey('KeyW', { ...activeField, paused: true }), false);
  assert.equal(shouldCaptureGameplayKey('KeyW', { ...activeField, cameraMode: 'order' }), false);
  assert.equal(shouldCaptureGameplayKey('KeyF', activeField), false);
});

test('mouse deltas update heading and pitch with explicit signs and clamps', () => {
  const turned = applyLookDelta(
    { heading: 0.4, pitch: -0.2 },
    { movementX: 50, movementY: -25 },
  );
  assert.ok(Math.abs(turned.heading - 0.3) < 1e-12);
  assert.ok(Math.abs(turned.pitch + 0.16) < 1e-12);

  assert.equal(applyLookDelta({ heading: 0, pitch: 1 }, { movementY: -500 }).pitch, 1.1);
  assert.equal(applyLookDelta({ heading: 0, pitch: -1 }, { movementY: 500 }).pitch, -1.15);
});

test('camera-relative planar axes stay orthogonal for arbitrary headings', () => {
  const heading = 0.73;
  const axes = planarAxesForHeading(heading);
  const dot = axes.forward.x * axes.right.x + axes.forward.z * axes.right.z;
  assert.ok(Math.abs(dot) < 1e-12);
  assert.ok(Math.abs(Math.hypot(axes.forward.x, axes.forward.z) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(axes.right.x, axes.right.z) - 1) < 1e-12);
});
