// 本地持久化：设置、跨周目记录（解锁、已读、已选、剧情树节点）、存档槽。全部容错：存储不可用时照常可玩，只是不留档。
const NS = 'fyzz2';
const KEYS = { settings: `${NS}.settings`, record: `${NS}.record`, saves: `${NS}.saves`, nodes: `${NS}.nodes`, scenes: `${NS}.scenes` };
const AGE_KEY = `${NS}.age`;

export const SLOT_COUNT = 36;
export const SAVE_VERSION = 2;

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

export const DEFAULT_SETTINGS = Object.freeze({
  textSpeed: 45, // 字／秒；100 = 一次显出整句
  autoSpeed: 50, // 0 慢 … 100 快
  bgm: 60,
  se: 70,
  voice: 85, // 剧情过场里的人声与环境声
  boxAlpha: 80, // 文字框浓淡 30…100
  skipUnread: false,
  film: true, // 动态影像：剧情过场与待机影像；关闭时过场换成末帧定格，字幕点击推进
  calm: false, // 减弱动效：停掉推镜、视差、落花与立绘弹跳，过场同样回落为定格
  timed: true, // 限时抉择；关闭时不计时，「不作声」列为普通选项
  assist: false, // 动作辅助：护灯自动完成
  adult: true, // 成人画面；关闭时以帘幕代替
});

export const settings = { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
export const saveSettings = () => write(KEYS.settings, settings);
const listeners = new Set();
export const onSettings = (fn) => listeners.add(fn);
export function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  for (const fn of listeners) fn(key, value);
}

// 跨周目记录
const raw = read(KEYS.record, {});
const SETS = ['cg', 'cut', 'scene', 'music', 'ending', 'read', 'chosen'];
export const record = Object.fromEntries(SETS.map((k) => [k, new Set(raw[k] ?? [])]));
let recordTimer = null;
function flushRecord() {
  recordTimer = null;
  write(KEYS.record, Object.fromEntries(SETS.map((k) => [k, [...record[k]]])));
}
export function saveRecord(now = false) {
  if (now) { clearTimeout(recordTimer); flushRecord(); } else if (!recordTimer) recordTimer = setTimeout(flushRecord, 800);
}
export function unlock(kind, id) {
  if (record[kind].has(id)) return false;
  record[kind].add(id);
  saveRecord(kind !== 'read');
  return true;
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => saveRecord(true));

// 年龄确认只记在本次会话里：每次新开浏览器都先过年龄门
export function ageConfirmed() {
  try { return sessionStorage.getItem(AGE_KEY) === 'yes'; } catch { return memoryAge; }
}
let memoryAge = false;
export function confirmAge() {
  memoryAge = true;
  try { sessionStorage.setItem(AGE_KEY, 'yes'); } catch { /* 本次页面内仍按已确认处理 */ }
}

// 存档：{ [slot]: { v, snap, trail, backlog, chapter, name, text, time, thumb } }；slot 为 1…36、'quick'、'auto'
export const loadSaves = () => {
  const saves = read(KEYS.saves, {});
  for (const [slot, rec] of Object.entries(saves)) if (rec?.v !== SAVE_VERSION) delete saves[slot];
  return saves;
};
export function writeSave(slot, rec) {
  const saves = loadSaves();
  saves[slot] = { ...rec, v: SAVE_VERSION };
  if (write(KEYS.saves, saves)) return true;
  // 空间不足：先放弃缩略图，再试一次
  saves[slot] = { ...saves[slot], thumb: null };
  return write(KEYS.saves, saves);
}
export function deleteSave(slot) {
  const saves = loadSaves();
  delete saves[slot];
  write(KEYS.saves, saves);
}
export function latestSave() {
  return Object.entries(loadSaves()).sort((a, b) => (b[1].time ?? 0) - (a[1].time ?? 0))[0]?.[1] ?? null;
}

// 剧情树节点：{ 章节标签: { snap, time } }，每章开场记下最近一次走到这里时的状态
export const loadNodes = () => read(KEYS.nodes, {});
export function writeNode(label, snap) {
  const nodes = loadNodes();
  nodes[label] = { snap, time: Date.now() };
  write(KEYS.nodes, nodes);
}

// 回想：记下最近一次走到这场良缘夜时的标记（金簪给了谁等），回想按那一局的状态分台词（第 5 轮盲玩：金簪给了月娘，回想却写旧银簪）
export const sceneFlags = (id) => read(KEYS.scenes, {})[id] ?? {};
export function rememberScene(id, flags) {
  const all = read(KEYS.scenes, {});
  all[id] = { ...flags };
  write(KEYS.scenes, all);
}
