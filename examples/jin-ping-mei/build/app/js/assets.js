// 视觉键表：发布模式对所有首屏、人物近景与奖励 CG 采用 fail-closed，不静默回退。

export const ASSET_PATHS = Object.freeze({
  // 标题与全套 CG 使用同一批二维新国风叙事母版：角色集中在中右区域，
  // 左侧春庭留白交给真实 HTML 标题，既保留古代世界，也给玩家想象空间。
  cover: 'assets/cg/group/title_new_guofeng.webp',
  compound: 'assets/bg/compound_new_guofeng.webp',
  // 催账到期那两个早晨的门前画面：来人、契纸与受阻门槛承担压力，不靠压黑画面。
  // 不进 CRITICAL_CG_KEYS——报条文字已经把账说清楚,缺图不该拦住一局。
  'scene/gate_collector': 'assets/scene/gate_collector.webp',
  // 门卡与对话使用同一张二维身份母版，脸、发式、衣色与器物贯穿所有剧情 CG。
  'heroine/yue': 'assets/heroine/yue/night.webp',
  'heroine/pan': 'assets/heroine/pan/night.webp',
  'heroine/pinger': 'assets/heroine/pinger/night.webp',
  'heroine/meng': 'assets/heroine/meng/night.webp',
  'heroine/xuee': 'assets/heroine/xuee/night.webp',
  'household/jiaoer': 'assets/household/li_jiaoer.webp',
  // 日常近景、门卡与人物身份母版统一；夜间专属图只改变关系动作与灯月，不更换画风。
  'heroine/yue/close': 'assets/heroine/yue/night.webp',
  'heroine/pan/close': 'assets/heroine/pan/night.webp',
  'heroine/pinger/close': 'assets/heroine/pinger/night.webp',
  'heroine/meng/close': 'assets/heroine/meng/night.webp',
  'heroine/xuee/close': 'assets/heroine/xuee/night.webp',
  'cg/yue/prelude': 'assets/cg/yue/prelude.webp',
  'cg/yue/explicit': 'assets/cg/yue/explicit.webp',
  'cg/pan/prelude': 'assets/cg/pan/prelude.webp',
  'cg/pan/explicit': 'assets/cg/pan/explicit.webp',
  'cg/pinger/prelude': 'assets/cg/pinger/prelude.webp',
  'cg/pinger/explicit': 'assets/cg/pinger/explicit.webp',
  'cg/meng/prelude': 'assets/cg/meng/prelude.webp',
  'cg/meng/explicit': 'assets/cg/meng/explicit.webp',
  'cg/xuee/prelude': 'assets/cg/xuee/prelude.webp',
  'cg/xuee/explicit': 'assets/cg/xuee/explicit.webp',
  'cg/group/public_day5': 'assets/cg/group/public_day5.webp',
  'cg/group/public_day10': 'assets/cg/group/public_day10.webp',
  'cg/group/public_day15': 'assets/cg/group/public_day15.webp',
  'cg/group/inner_court_alliance': 'assets/cg/group/inner_court_alliance.webp',
  'cg/group/inner_court_accord': 'assets/cg/group/inner_court_accord_five.webp',
  'cg/group/inner_court_afterglow': 'assets/cg/group/inner_court_afterglow_five.webp',
  'cg/joint/yue_pan': 'assets/cg/joint/yue_pan.webp',
  'cg/joint/yue_pinger': 'assets/cg/joint/yue_pinger.webp',
  'cg/joint/pan_pinger': 'assets/cg/joint/pan_pinger.webp',
  'cg/joint/yue_meng': 'assets/cg/joint/yue_meng.webp',
  'cg/joint/pan_xuee': 'assets/cg/joint/pan_xuee.webp',
  // 第二十夜的一院终章不是把旧门卡放大：五个人各有一张能读出
  // 她的核心边界与另外四院善后方式的安全终章画面。
  'cg/finale/yue': 'assets/cg/finale/yue.webp',
  'cg/finale/pan': 'assets/cg/finale/pan.webp',
  'cg/finale/pinger': 'assets/cg/finale/pinger.webp',
  'cg/finale/meng': 'assets/cg/finale/meng.webp',
  'cg/finale/xuee': 'assets/cg/finale/xuee.webp',
  // 命数三页不用任何人物遗照消费悲剧；空宅、六把钥匙、五张名签、
  // 药碗与未写完的账页承担第 30—100 回的长期回声。
  'cg/finale/fate_coda': 'assets/cg/finale/fate_coda.webp',
  'cg/milestone/yue': 'assets/cg/milestone/yue.webp',
  'cg/milestone/pan': 'assets/cg/milestone/pan.webp',
  'cg/milestone/pinger': 'assets/cg/milestone/pinger.webp',
  'cg/milestone/meng': 'assets/cg/milestone/meng.webp',
  'cg/milestone/xuee': 'assets/cg/milestone/xuee.webp',
});

export const CRITICAL_CG_KEYS = Object.freeze([
  'cover', 'heroine/yue', 'heroine/pan', 'heroine/pinger', 'heroine/meng', 'heroine/xuee',
  'household/jiaoer',
  'heroine/yue/close', 'heroine/pan/close', 'heroine/pinger/close', 'heroine/meng/close', 'heroine/xuee/close',
  'cg/yue/prelude', 'cg/yue/explicit', 'cg/pan/prelude', 'cg/pan/explicit',
  'cg/pinger/prelude', 'cg/pinger/explicit', 'cg/meng/prelude', 'cg/meng/explicit',
  'cg/xuee/prelude', 'cg/xuee/explicit', 'cg/group/public_day5', 'cg/group/public_day10', 'cg/group/public_day15',
  'cg/group/inner_court_alliance', 'cg/group/inner_court_accord', 'cg/group/inner_court_afterglow',
  'cg/joint/yue_pan', 'cg/joint/yue_pinger', 'cg/joint/pan_pinger', 'cg/joint/yue_meng', 'cg/joint/pan_xuee',
  'cg/finale/yue', 'cg/finale/pan', 'cg/finale/pinger', 'cg/finale/meng', 'cg/finale/xuee', 'cg/finale/fate_coda',
  'cg/milestone/yue', 'cg/milestone/pan', 'cg/milestone/pinger', 'cg/milestone/meng', 'cg/milestone/xuee',
]);

export const BOOT_ASSET_KEYS = Object.freeze(['cover', 'compound']);
export const ADULT_ASSET_KEYS = Object.freeze([
  'cg/yue/prelude', 'cg/yue/explicit', 'cg/pan/prelude', 'cg/pan/explicit',
  'cg/pinger/prelude', 'cg/pinger/explicit', 'cg/meng/prelude', 'cg/meng/explicit',
  'cg/xuee/prelude', 'cg/xuee/explicit', 'cg/group/inner_court_afterglow',
]);
export const FINALE_ASSET_KEYS = Object.freeze([
  'cg/finale/yue', 'cg/finale/pan', 'cg/finale/pinger', 'cg/finale/meng', 'cg/finale/xuee', 'cg/finale/fate_coda',
]);
export const MILESTONE_ASSET_KEYS = Object.freeze([
  'cg/milestone/yue', 'cg/milestone/pan', 'cg/milestone/pinger', 'cg/milestone/meng', 'cg/milestone/xuee',
]);
// 终章画是安全内容，但不该在玩家刚过年龄门时就把五张结局一起下载。
// 第四幕再闲时预取，真正进入终章时浏览器也会从相同 URL 直接复用缓存。
export const SAFE_GAME_ASSET_KEYS = Object.freeze(CRITICAL_CG_KEYS.filter((key) => (
  !ADULT_ASSET_KEYS.includes(key) && !FINALE_ASSET_KEYS.includes(key) && !MILESTONE_ASSET_KEYS.includes(key)
)));

const loaded = new Map();
const requested = new Set();
const inflight = new Map();

function loadOne(key, path) {
  if (loaded.get(key)?.ok === true) return Promise.resolve();
  if (inflight.has(key)) return inflight.get(key);
  requested.add(key);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { loaded.set(key, { ok: true, width: image.naturalWidth, height: image.naturalHeight }); inflight.delete(key); resolve(); };
    image.onerror = () => { loaded.set(key, { ok: false, width: 0, height: 0 }); inflight.delete(key); resolve(); };
    image.src = path;
  });
  inflight.set(key, promise);
  return promise;
}

export async function loadAssets(keys = BOOT_ASSET_KEYS) {
  await Promise.all(keys.map((key) => loadOne(key, ASSET_PATHS[key])));
  return assetReport();
}

export function preloadSafeAssets() {
  return loadAssets(SAFE_GAME_ASSET_KEYS);
}

export function preloadFinaleAssets() {
  return loadAssets(FINALE_ASSET_KEYS);
}

export function assetReport() {
  const missingCritical = CRITICAL_CG_KEYS.filter((key) => requested.has(key) && loaded.get(key)?.ok === false);
  const bootReady = BOOT_ASSET_KEYS.every((key) => loaded.get(key)?.ok === true);
  return {
    missingCritical,
    loaded: Object.fromEntries([...loaded.entries()]),
    requested: [...requested],
    adultRequested: ADULT_ASSET_KEYS.filter((key) => requested.has(key)),
    bootReady,
    complete: CRITICAL_CG_KEYS.every((key) => loaded.get(key)?.ok === true),
    ok: bootReady && missingCritical.length === 0,
  };
}

export function urlFor(key) {
  const path = ASSET_PATHS[key] ?? '';
  return globalThis.document ? new URL(path, document.baseURI).href : path;
}

export function assertCriticalAssetSchema() {
  const missingKeys = CRITICAL_CG_KEYS.filter((key) => !ASSET_PATHS[key]);
  if (missingKeys.length) throw new Error(`关键 CG 未登记：${missingKeys.join(', ')}`);
  return true;
}
