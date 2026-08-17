// 视觉键表：发布模式对所有首屏、人物近景与奖励 CG 采用 fail-closed，不静默回退。

export const ASSET_PATHS = Object.freeze({
  // cover 与公开席面群像解绑:五人同框的册页只属于「按下那个按钮之后」。
  // 标题专用群像让五道视线汇向玩家，但不占用任何奖励位，
  // 它不占用任何奖励位,右三分之一留暗给标题栏。
  cover: 'assets/cg/group/title_five.webp',
  compound: 'assets/bg/compound_act1.jpg',
  // 催账到期那两个早晨的门前画面:同一谱系的界画白描,人在门外等，院里还没开门。
  // 不进 CRITICAL_CG_KEYS——报条文字已经把账说清楚,缺图不该拦住一局。
  'scene/gate_collector': 'assets/scene/gate_collector.jpg',
  // 门卡与对话使用同一张身份母版，旧 portrait PNG 不再进入运行路径。
  'heroine/yue': 'assets/heroine/yue/night.webp',
  'heroine/pan': 'assets/heroine/pan/night.webp',
  'heroine/pinger': 'assets/heroine/pinger/night.webp',
  'heroine/meng': 'assets/heroine/meng/night.webp',
  'heroine/xuee': 'assets/heroine/xuee/night.webp',
  'household/jiaoer': 'assets/household/li_jiaoer.webp',
  // 日常近景、门卡与人物身份母版统一到同一批着装夜间横幅；18+ 前奏 CG 只做场景册奖励。
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
  'cg/group/inner_court_accord': 'assets/cg/group/inner_court_accord_five.webp',
  'cg/group/inner_court_afterglow': 'assets/cg/group/inner_court_afterglow_five.webp',
  'cg/joint/yue_pan': 'assets/cg/joint/yue_pan.webp',
  'cg/joint/yue_pinger': 'assets/cg/joint/yue_pinger.webp',
  'cg/joint/pan_pinger': 'assets/cg/joint/pan_pinger.webp',
  'cg/joint/yue_meng': 'assets/cg/joint/yue_meng.webp',
  'cg/joint/pan_xuee': 'assets/cg/joint/pan_xuee.webp',
});

export const CRITICAL_CG_KEYS = Object.freeze([
  'cover', 'heroine/yue', 'heroine/pan', 'heroine/pinger', 'heroine/meng', 'heroine/xuee',
  'household/jiaoer',
  'heroine/yue/close', 'heroine/pan/close', 'heroine/pinger/close', 'heroine/meng/close', 'heroine/xuee/close',
  'cg/yue/prelude', 'cg/yue/explicit', 'cg/pan/prelude', 'cg/pan/explicit',
  'cg/pinger/prelude', 'cg/pinger/explicit', 'cg/meng/prelude', 'cg/meng/explicit',
  'cg/xuee/prelude', 'cg/xuee/explicit', 'cg/group/public_day5', 'cg/group/public_day10', 'cg/group/public_day15',
  'cg/group/inner_court_accord', 'cg/group/inner_court_afterglow',
  'cg/joint/yue_pan', 'cg/joint/yue_pinger', 'cg/joint/pan_pinger', 'cg/joint/yue_meng', 'cg/joint/pan_xuee',
]);

const loaded = new Map();

function loadOne(key, path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { loaded.set(key, { ok: true, width: image.naturalWidth, height: image.naturalHeight }); resolve(); };
    image.onerror = () => { loaded.set(key, { ok: false, width: 0, height: 0 }); resolve(); };
    image.src = path;
  });
}

export async function loadAssets() {
  await Promise.all(Object.entries(ASSET_PATHS).map(([key, path]) => loadOne(key, path)));
  return assetReport();
}

export function assetReport() {
  const missingCritical = CRITICAL_CG_KEYS.filter((key) => loaded.get(key)?.ok !== true);
  return {
    missingCritical,
    loaded: Object.fromEntries([...loaded.entries()]),
    ok: missingCritical.length === 0,
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
