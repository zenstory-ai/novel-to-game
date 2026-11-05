// 本地持久化：设置、跨周目解锁（CG／回想／曲目／结局／已读／已选）、存档槽。全部容错，存储不可用时照常可玩。
const KEYS = { config: 'jpm2_config', global: 'jpm2_global', saves: 'jpm2_saves', nodes: 'jpm2_nodes' };
export const AGE_KEY = 'jpm_age_confirmed';
export const SLOT_PAGES = 4;
export const SLOTS_PER_PAGE = 9;

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

export const DEFAULT_CONFIG = Object.freeze({
  textSpeed: 45, // 字／秒；100 = 瞬间
  autoSpeed: 50, // 0 慢 … 100 快
  bgm: 60,
  se: 70,
  skipUnread: false,
  adult: true,
  boxAlpha: 90, // 文字框浓淡 40…100
  film: true, // 动态影像：剧情过场与 CG／背景的待机影像；关闭时过场换成定格画面，字幕照常
  timed: true, // 限时抉择；关闭时不计时，「不作声」列为普通选项
  assist: false, // 动作辅助：按住动作自动完成
});

export const config = { ...DEFAULT_CONFIG, ...read(KEYS.config, {}) };
export const saveConfig = () => write(KEYS.config, config);

const g = read(KEYS.global, {});
export const global = {
  cg: new Set(g.cg ?? []),
  scene: new Set(g.scene ?? []),
  music: new Set(g.music ?? []),
  ending: new Set(g.ending ?? []),
  read: new Set(g.read ?? []),
  cut: new Set(g.cut ?? []), // 看过的剧情过场，鉴赏里可以重看
  chosen: new Set(g.chosen ?? []), // 「标签:选项文字」，后续周目给走过的选项标「已选」
};
let globalTimer = null;
export function saveGlobal(now = false) {
  const flush = () => {
    globalTimer = null;
    write(KEYS.global, Object.fromEntries(Object.entries(global).map(([k, v]) => [k, [...v]])));
  };
  if (now) { clearTimeout(globalTimer); flush(); } else if (!globalTimer) globalTimer = setTimeout(flush, 800);
}

export function ageConfirmed() {
  try { return sessionStorage.getItem(AGE_KEY) === 'yes'; } catch { return false; }
}
export function confirmAge() {
  try { sessionStorage.setItem(AGE_KEY, 'yes'); } catch { /* 本次会话内仍按已确认处理 */ }
}

// 存档：{ [slotId]: { snap, chapter, text, date, thumb } }；slotId 为 1..36、'quick'、'auto'
export const loadSaves = () => read(KEYS.saves, {});
export function writeSave(slot, record) {
  const saves = loadSaves();
  saves[slot] = record;
  if (write(KEYS.saves, saves)) return true;
  // 空间不足时先丢掉缩略图再试一次
  saves[slot] = { ...record, thumb: null };
  return write(KEYS.saves, saves);
}
export function deleteSave(slot) {
  const saves = loadSaves();
  delete saves[slot];
  write(KEYS.saves, saves);
}
export function latestSave() {
  const saves = loadSaves();
  return Object.entries(saves).sort((a, b) => (b[1].time ?? 0) - (a[1].time ?? 0))[0] ?? null;
}

// 剧情树节点：{ 章节名: 存档记录 }，每章开场记下最近一次到达时的状态，跨周目保留
export const loadNodes = () => read(KEYS.nodes, {});
export function writeNode(key, record) {
  const nodes = loadNodes();
  nodes[key] = record;
  if (write(KEYS.nodes, nodes)) return;
  nodes[key] = { ...record, thumb: null };
  write(KEYS.nodes, nodes);
}
