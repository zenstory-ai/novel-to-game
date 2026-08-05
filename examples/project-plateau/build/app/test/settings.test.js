import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  clearSettings,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from '../src/settings.js';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('presentation settings normalize invalid persisted values', () => {
  assert.deepEqual(normalizeSettings({
    reducedMotion: 'yes',
    captionsEnabled: 1,
    textScale: '4',
    quality: 'cinematic',
    lookSensitivity: 8,
    volumes: { ambience: -4, effects: '0.45', music: 8 },
  }, true), {
    reducedMotion: true,
    captionsEnabled: true,
    textScale: '1',
    quality: 'balanced',
    lookSensitivity: 2,
    volumes: { ambience: 0, effects: 0.45, music: 1 },
  });
});

test('settings round-trip through versioned storage and can be reset', () => {
  const storage = fakeStorage();
  const saved = saveSettings(storage, {
    reducedMotion: true,
    captionsEnabled: false,
    textScale: '1.5',
    quality: 'low',
    lookSensitivity: 0.7,
    volumes: { ambience: 0.2, effects: 0.4, music: 0.1 },
  });
  assert.deepEqual(loadSettings(storage), saved);
  clearSettings(storage);
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
});

test('blocked or malformed storage falls back without disabling controls', () => {
  const malformed = fakeStorage({ [SETTINGS_STORAGE_KEY]: '{broken' });
  assert.deepEqual(loadSettings(malformed, true), {
    ...DEFAULT_SETTINGS,
    reducedMotion: true,
    volumes: { ...DEFAULT_SETTINGS.volumes },
  });
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(saveSettings(blocked, DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  assert.doesNotThrow(() => clearSettings(blocked));
});
