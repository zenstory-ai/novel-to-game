export const SETTINGS_STORAGE_KEY = 'project-plateau:presentation:v2';

export const DEFAULT_SETTINGS = Object.freeze({
  reducedMotion: false,
  captionsEnabled: true,
  textScale: '1',
  quality: 'balanced',
  lookSensitivity: 1,
  volumes: Object.freeze({ ambience: 0.34, effects: 0.72, music: 0.2 }),
});

const TEXT_SCALES = new Set(['1', '1.25', '1.5']);
const QUALITY_LEVELS = new Set(['low', 'balanced', 'high']);

function volume(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function numberInRange(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback;
}

export function normalizeSettings(value = {}, systemReducedMotion = false) {
  const volumes = value?.volumes ?? {};
  return {
    reducedMotion: typeof value?.reducedMotion === 'boolean'
      ? value.reducedMotion
      : Boolean(systemReducedMotion),
    captionsEnabled: typeof value?.captionsEnabled === 'boolean'
      ? value.captionsEnabled
      : DEFAULT_SETTINGS.captionsEnabled,
    textScale: TEXT_SCALES.has(String(value?.textScale))
      ? String(value.textScale)
      : DEFAULT_SETTINGS.textScale,
    quality: QUALITY_LEVELS.has(String(value?.quality))
      ? String(value.quality)
      : DEFAULT_SETTINGS.quality,
    lookSensitivity: numberInRange(
      value?.lookSensitivity,
      DEFAULT_SETTINGS.lookSensitivity,
      0.5,
      2,
    ),
    volumes: {
      ambience: volume(volumes.ambience, DEFAULT_SETTINGS.volumes.ambience),
      effects: volume(volumes.effects, DEFAULT_SETTINGS.volumes.effects),
      music: volume(volumes.music, DEFAULT_SETTINGS.volumes.music),
    },
  };
}

export function loadSettings(storage, systemReducedMotion = false) {
  try {
    const stored = storage?.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(stored ? JSON.parse(stored) : {}, systemReducedMotion);
  } catch {
    return normalizeSettings({}, systemReducedMotion);
  }
}

export function saveSettings(storage, settings) {
  const normalized = normalizeSettings(settings);
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The controls remain usable when storage is blocked or full.
  }
  return normalized;
}

export function clearSettings(storage) {
  try {
    storage?.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // Reset still applies in memory when storage is blocked.
  }
}
