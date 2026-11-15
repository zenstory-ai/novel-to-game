// 本机存档与设置。读不出或版本不符时当作没有存档。
import { SAVE_VERSION } from '../rules/campaign.js';

const SAVE_KEY = 'xiyou-fan.save';
const SETTINGS_KEY = 'xiyou-fan.settings';
const defaults = { music: 0.6, sound: 0.8, mute: false, shake: true, speed: 1, seen: {} };

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const settings = { ...defaults, ...(read(SETTINGS_KEY) ?? {}) };
export const saveSettings = () => write(SETTINGS_KEY, settings);

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
