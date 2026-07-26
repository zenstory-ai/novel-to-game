// 视觉键表：发布模式对 7 张关键 CG 采用 fail-closed，不静默回退。

export const ASSET_PATHS = Object.freeze({
  cover: 'assets/cg/group/banquet_conflict.webp',
  compound: 'assets/bg/compound_act1.jpg',
  'heroine/yue': 'assets/portrait/wu_yueniang.png',
  'heroine/pan': 'assets/portrait/pan_jinlian.png',
  'heroine/pinger': 'assets/portrait/li_pinger.png',
  'heroine/yue/close': 'assets/cg/yue/prelude.webp',
  'heroine/pan/close': 'assets/cg/pan/prelude.webp',
  'heroine/pinger/close': 'assets/cg/pinger/prelude.webp',
  'cg/yue/prelude': 'assets/cg/yue/prelude.webp',
  'cg/yue/explicit': 'assets/cg/yue/explicit.webp',
  'cg/pan/prelude': 'assets/cg/pan/prelude.webp',
  'cg/pan/explicit': 'assets/cg/pan/explicit.webp',
  'cg/pinger/prelude': 'assets/cg/pinger/prelude.webp',
  'cg/pinger/explicit': 'assets/cg/pinger/explicit.webp',
  'cg/group/banquet_conflict': 'assets/cg/group/banquet_conflict.webp',
});

export const CRITICAL_CG_KEYS = Object.freeze([
  'cg/yue/prelude', 'cg/yue/explicit', 'cg/pan/prelude', 'cg/pan/explicit',
  'cg/pinger/prelude', 'cg/pinger/explicit', 'cg/group/banquet_conflict',
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
