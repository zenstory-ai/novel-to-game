// 资产加载与回退:图片缺失时一律回退色块头像 / 渐变背景,保证没美术也能跑。

const unitPaths = {
  wukong: 'assets/units/wukong.webp', bajie: 'assets/units/bajie.webp', sha: 'assets/units/sha.webp',
  tang: 'assets/units/tang.webp', tudi: 'assets/units/tudi.webp', luosha: 'assets/units/luosha.webp',
  insect: 'assets/units/insect.png', shibi: 'assets/units/shibi.webp',
  niumowang: 'assets/units/niumowang.webp', whitebull: 'assets/units/whitebull.webp',
  pixie: 'assets/units/pixie.webp', mob_fire1: 'assets/units/mob_fire1.webp', mob_fire2: 'assets/units/mob_fire2.webp',
  yumian: 'assets/units/yumian.webp', yaojiang: 'assets/units/yaojiang.webp',
  nezha: 'assets/units/nezha.webp', litianwang: 'assets/units/litianwang.webp',
  lingji: 'assets/units/lingji.webp',
};
const bgPaths = {
  cuiyun: 'assets/bg/cuiyun.jpg?v=20260905', huoyan: 'assets/bg/huoyan.jpg?v=20260905',
  'huoyan-rain': 'assets/bg/huoyan-rain.jpg?v=20260905',
  leiji: 'assets/bg/leiji.jpg?v=20260905', overworld: 'assets/bg/overworld.jpg?v=20260905',
  moyundong: 'assets/bg/moyundong.jpg?v=20260905', bibotan: 'assets/bg/bibotan.jpg?v=20260905',
};
const scenePaths = {
  tudimiao: 'assets/scene/tudimiao.png',
};
// 法宝物件图:灵吉授宝二选一那一屏用。两张是一组互斥选项,主色与母题各不相犯——
// 定风丹走朱与墨(风线截断),避火锦走水青与金线(火舌偏开),并排一眼看出是两样东西。
const treasurePaths = {
  dingfengdan: 'assets/treasure/dingfengdan.jpg',
  bihuojin: 'assets/treasure/bihuojin.jpg',
};

// 回退色块配色(按立绘键)
const fallbackColors = {
  wukong: '#b8862e', bajie: '#7a8a4a', sha: '#5a7a6a', tang: '#d8cfb8', tudi: '#8a7a5a',
  luosha: '#3a7a5a', shibi: '#5a7a4a', insect: '#4a3a2a',
  niumowang: '#5a4a7a', whitebull: '#d8d4c8', pixie: '#2a6b8a',
  mob_fire1: '#a83a2a', mob_fire2: '#c2542a',
  yumian: '#8a6a8a', yaojiang: '#6a6a7a', nezha: '#b8542e', litianwang: '#7a6a4a',
  lingji: '#d8b84a',
};
// 回退背景渐变(按背景键): [上, 中, 下]
const fallbackBg = {
  cuiyun: ['#1e3a2e', '#2e5a42', '#0f1e18'],   // 翠云山 冷绿
  huoyan: ['#3a1618', '#8a2e1e', '#c26a2e'],   // 火焰山 朱红橙
  leiji: ['#2a2438', '#4a3a5a', '#6a5a72'],    // 积雷山 灰紫
  overworld: ['#c2542a', '#e8a04a', '#f2d89a'], // 序幕 火焰山远望
  moyundong: ['#3a2a44', '#5a4a5e', '#7a6a6e'], // 摩云洞 紫灰
  bibotan: ['#0e2a44', '#1a4a66', '#2a6a8a'],  // 碧波潭 深蓝水底
};

const images = {};   // key -> HTMLImageElement | null
const blockCache = {}; // key -> dataURL

function loadOne(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = path + (path.includes('?') ? '&' : '?') + 'art=20260905-reimagine';
  });
}

export async function loadAssets() {
  const jobs = [];
  for (const [k, p] of Object.entries(unitPaths)) jobs.push(loadOne(p).then((i) => (images[`u:${k}`] = i)));
  for (const [k, p] of Object.entries(bgPaths)) jobs.push(loadOne(p).then((i) => (images[`b:${k}`] = i)));
  for (const [k, p] of Object.entries(scenePaths)) jobs.push(loadOne(p).then((i) => (images[`s:${k}`] = i)));
  for (const [k, p] of Object.entries(treasurePaths)) jobs.push(loadOne(p).then((i) => (images[`t:${k}`] = i)));
  await Promise.all(jobs);
  return images;
}

// 单位立绘 URL;缺失时生成带首字的色块 dataURL
export function unitURL(key, name = '') {
  const img = images[`u:${key}`];
  if (img) return img.src;
  if (blockCache[key]) return blockCache[key];
  const c = document.createElement('canvas');
  c.width = 200; c.height = 280;
  const ctx = c.getContext('2d');
  const color = fallbackColors[key] ?? '#666';
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#1a1410');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 200, 280);
  ctx.strokeStyle = 'rgba(201,162,39,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 188, 268);
  ctx.fillStyle = '#f2e8d5';
  ctx.font = 'bold 96px "Songti SC", "SimSun", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || key).slice(0, 1), 100, 140);
  blockCache[key] = c.toDataURL();
  return blockCache[key];
}

export function unitImage(key) {
  return images[`u:${key}`] ?? null;
}

export function sceneImage(key) {
  return images[`s:${key}`] ?? null;
}

// 缺图时返回 null,选择屏退回纯文字两行——法宝的差别本来就写在文案里,没美术照样能选。
export function treasureURL(key) {
  return images[`t:${key}`]?.src ?? null;
}

export function bgStyle(key) {
  const img = images[`b:${key}`];
  if (img) return { backgroundImage: `url(${img.src})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  const [a, b, c] = fallbackBg[key] ?? ['#222', '#444', '#222'];
  return { backgroundImage: `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)` };
}

export function bgURL(key) {
  const img = images[`b:${key}`];
  return img ? img.src : null;
}
