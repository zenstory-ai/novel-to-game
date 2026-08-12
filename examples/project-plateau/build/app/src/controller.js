export const LOOK_SENSITIVITY = Object.freeze({ horizontal: 0.002, vertical: 0.0016 });

const GAMEPLAY_KEY_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyG',
  'ShiftLeft',
  'ShiftRight',
  'KeyC',
  'ControlLeft',
  'ControlRight',
  'Space',
]);

export function shouldCaptureGameplayKey(code, context) {
  return GAMEPLAY_KEY_CODES.has(code)
    && context.runActive
    && !context.paused
    && context.cameraMode === 'field';
}

export function applyLookDelta(
  orientation,
  movement,
  sensitivity = LOOK_SENSITIVITY,
) {
  const movementX = Number.isFinite(movement.movementX) ? movement.movementX : 0;
  const movementY = Number.isFinite(movement.movementY) ? movement.movementY : 0;
  return {
    heading: orientation.heading - movementX * sensitivity.horizontal,
    pitch: Math.max(
      -1.15,
      Math.min(1.1, orientation.pitch - movementY * sensitivity.vertical),
    ),
  };
}

export function planarAxesForHeading(heading) {
  return {
    forward: { x: -Math.sin(heading), z: -Math.cos(heading) },
    right: { x: Math.cos(heading), z: -Math.sin(heading) },
  };
}
