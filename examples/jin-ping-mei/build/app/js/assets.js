// 视觉键表：发布模式对所有首屏、人物近景与奖励 CG 采用 fail-closed，不静默回退。

export const ASSET_PATHS = Object.freeze({
  // cover 与宴席群像解绑:三人同框的册页只属于「按下那个按钮之后」。
  // 标题另出一张专用群像(ART_DIRECTION《标题：三人都在看你》:月娘正中偏后、
  // 金莲从屏风边前探、瓶儿递来钥匙,三条视线汇向镜头下方的玩家),
  // 它不占用任何奖励位,右三分之一留暗给标题栏。
  cover: 'assets/cg/group/title_three.webp',
  compound: 'assets/bg/compound_act1.jpg',
  'heroine/yue': 'assets/portrait/wu_yueniang.png',
  'heroine/pan': 'assets/portrait/pan_jinlian.png',
  'heroine/pinger': 'assets/portrait/li_pinger.png',
  'household/meng': 'assets/portrait/meng_yulou.png',
  'household/xuee': 'assets/portrait/sun_xuee.png',
  'household/jiaoer': 'assets/portrait/li_jiaoer.png',
  // 日常近景用新生成的着装夜间立绘(与宴席群像同一谱系,横构图整版,人物在右侧,
  // 左三分之一暗部留给对话面板);18+ 前奏 CG 收回解锁之后,只做场景册奖励。
  // assets/portrait/ 里吴月娘、潘金莲、李瓶儿三张立绘从此只服务门卡与开场群像。
  'heroine/yue/close': 'assets/heroine/yue/night.webp',
  'heroine/pan/close': 'assets/heroine/pan/night.webp',
  'heroine/pinger/close': 'assets/heroine/pinger/night.webp',
  'cg/yue/prelude': 'assets/cg/yue/prelude.webp',
  'cg/yue/explicit': 'assets/cg/yue/explicit.webp',
  'cg/pan/prelude': 'assets/cg/pan/prelude.webp',
  'cg/pan/explicit': 'assets/cg/pan/explicit.webp',
  'cg/pinger/prelude': 'assets/cg/pinger/prelude.webp',
  'cg/pinger/explicit': 'assets/cg/pinger/explicit.webp',
  'cg/group/banquet_conflict': 'assets/cg/group/banquet_conflict.webp',
});

export const CRITICAL_CG_KEYS = Object.freeze([
  'cover', 'heroine/yue/close', 'heroine/pan/close', 'heroine/pinger/close',
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
