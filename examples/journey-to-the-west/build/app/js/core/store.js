// 本机存档与设置。读不出或版本不符时当作没有存档。
import { SAVE_VERSION } from '../rules/campaign.js';

const SAVE_KEY = 'xiyou-fan.save';
const SETTINGS_KEY = 'xiyou-fan.settings';
export const SETTINGS_DEFAULTS = Object.freeze({
  music: 0.6,
  sound: 0.8,
  musicOn: true,
  soundOn: true,
  mute: false,
  shake: true,
  speed: 1,
  seen: {},
});

function clamp01(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const seen = src.seen && typeof src.seen === 'object' && !Array.isArray(src.seen) ? { ...src.seen } : {};
  return {
    music: clamp01(src.music, SETTINGS_DEFAULTS.music),
    sound: clamp01(src.sound, SETTINGS_DEFAULTS.sound),
    musicOn: typeof src.musicOn === 'boolean' ? src.musicOn : SETTINGS_DEFAULTS.musicOn,
    soundOn: typeof src.soundOn === 'boolean' ? src.soundOn : SETTINGS_DEFAULTS.soundOn,
    mute: Boolean(src.mute),
    shake: typeof src.shake === 'boolean' ? src.shake : SETTINGS_DEFAULTS.shake,
    speed: src.speed === 2 ? 2 : 1,
    seen,
  };
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const settings = normalizeSettings(read(SETTINGS_KEY));

export function reloadSettings() {
  Object.assign(settings, normalizeSettings(read(SETTINGS_KEY)));
  return settings;
}

export const saveSettings = () => {
  const clean = normalizeSettings(settings);
  Object.assign(settings, clean);
  return write(SETTINGS_KEY, clean);
};

export function loadGame() {
  const data = read(SAVE_KEY);
  return data && data.version === SAVE_VERSION && data.stage ? data : null;
}
export const saveGame = (campaign) => write(SAVE_KEY, campaign);
export function clearGame() { try { localStorage.removeItem(SAVE_KEY); } catch { /* 无存储时无事可做 */ } }

// 只出现一次的提示（教学卡等）
export function firstTime(id) {
  if (settings.seen[id]) return false;
  settings.seen[id] = true;
  saveSettings();
  return true;
}
