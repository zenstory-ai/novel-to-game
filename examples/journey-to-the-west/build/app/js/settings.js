// 玩家偏好设置(localStorage 持久化,简报二.5/二.1):
// 战斗加速 ×2、跳过演出、屏幕震动开关。键名一经写入不再变更(QA 据此断言持久化)。

const KEYS = {
  speed: 'xiyou_speed',
  skipFx: 'xiyou_skipfx',
  shake: 'xiyou_shake',
};

export function getSpeed() {
  return localStorage.getItem(KEYS.speed) === '2' ? 2 : 1;
}
export function setSpeed(v) {
  localStorage.setItem(KEYS.speed, v === 2 ? '2' : '1');
}

export function getSkipFx() {
  return localStorage.getItem(KEYS.skipFx) === '1';
}
export function setSkipFx(on) {
  localStorage.setItem(KEYS.skipFx, on ? '1' : '0');
}

// 震动默认开(克制的 2px),可关
export function getShake() {
  return localStorage.getItem(KEYS.shake) !== '0';
}
export function setShake(on) {
  localStorage.setItem(KEYS.shake, on ? '1' : '0');
}
