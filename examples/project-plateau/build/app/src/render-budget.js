export const MAX_RENDER_PIXEL_RATIO = 1.25;

export const CONTACT_OCCLUSION_PROFILE = Object.freeze({
  // World-space radius: broad enough to connect an adult animal foot, tree
  // buttress or shelf-rock base to the ground, but shorter than the metre-scale
  // gaps that must remain visibly open.
  radiusMeters: 0.72,
  distanceExponent: 1.35,
  thicknessMeters: 0.82,
  distanceFallOff: 1.05,
  scale: 0.94,
  samples: 6,
  blendIntensity: 0.3,
  denoise: Object.freeze({
    lumaPhi: 8,
    depthPhi: 2,
    normalPhi: 3,
    radius: 6,
    radiusExponent: 2,
    rings: 2,
    samples: 4,
  }),
  role: 'world-space-local-contact-occlusion-of-indirect-light',
});

export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({ maxPixelRatio: 0.85, activeFps: 45, gtao: false, shadowMapSize: 1024 }),
  balanced: Object.freeze({ maxPixelRatio: 1, activeFps: 60, gtao: true, shadowMapSize: 2048 }),
  high: Object.freeze({ maxPixelRatio: MAX_RENDER_PIXEL_RATIO, activeFps: 60, gtao: true, shadowMapSize: 2048 }),
});

export function renderPixelRatio(devicePixelRatio = 1) {
  return Math.min(Math.max(Number(devicePixelRatio) || 1, 1), MAX_RENDER_PIXEL_RATIO);
}

export function qualityRenderPixelRatio(devicePixelRatio = 1, quality = 'balanced') {
  const profile = QUALITY_PROFILES[quality] ?? QUALITY_PROFILES.balanced;
  return Math.min(Math.max(Number(devicePixelRatio) || 1, 0.5), profile.maxPixelRatio);
}

export function renderIntervalForState({
  runActive = false,
  cameraMode = 'title',
  paused = false,
  hidden = false,
  activeFps = 60,
} = {}) {
  if (hidden) return 250;
  if (paused || cameraMode === 'terminal') return 1000 / 15;
  if (!runActive && cameraMode === 'title') return 1000 / 30;
  return 1000 / activeFps;
}

export function shouldRenderFrame(now, lastRenderedAt, interval) {
  return now - lastRenderedAt >= Math.max(0, interval - 0.75);
}

export function advanceRenderSchedule(now, previousDeadline, interval) {
  if (!Number.isFinite(previousDeadline) || now - previousDeadline > interval * 4) return now;
  const elapsedIntervals = Math.max(1, Math.floor((now - previousDeadline) / interval));
  return previousDeadline + elapsedIntervals * interval;
}
