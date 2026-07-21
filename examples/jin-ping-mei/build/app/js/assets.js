// 皮肤层:一切可视元素经一个键查表取材。图片缺失/加载失败一律回退灰盒
// (色块/渐变/字形),美术产出后按键放入 assets/ 即替换,不改引擎与交互逻辑。

const KEY_PATHS = {
  'compound/act1': 'assets/bg/compound_act1.jpg',
  'compound/act2': 'assets/bg/compound_act2.jpg',
  'compound/act3': 'assets/bg/compound_act3.jpg',
  'cover': 'assets/cover.jpg',
  'portrait/meng_yulou': 'assets/portrait/meng_yulou.png',
  'portrait/pan_jinlian': 'assets/portrait/pan_jinlian.png',
  'portrait/li_pinger': 'assets/portrait/li_pinger.png',
  'portrait/wu_yueniang': 'assets/portrait/wu_yueniang.png',
  'portrait/sun_xuee': 'assets/portrait/sun_xuee.png',
  'portrait/pang_chunmei': 'assets/portrait/pang_chunmei.png',
  'portrait/ximen_qing': 'assets/portrait/ximen_qing.png',
  'portrait/meng_yulou_mourning': 'assets/portrait/meng_yulou_mourning.png',
  'portrait/pan_jinlian_mourning': 'assets/portrait/pan_jinlian_mourning.png',
  'portrait/li_jiaoer': 'assets/portrait/li_jiaoer.png',
  'portrait/wu_yueniang_mourning': 'assets/portrait/wu_yueniang_mourning.png',
  'portrait/sun_xuee_mourning': 'assets/portrait/sun_xuee_mourning.png',
  'portrait/pang_chunmei_madam': 'assets/portrait/pang_chunmei_madam.png',
  'servant/daian': 'assets/servant/daian.png',
  'servant/xiaoyu': 'assets/servant/xiaoyu.png',
  'servant/feng_mama': 'assets/servant/feng_mama.png',
  'servant/xue_meipo': 'assets/servant/xue_meipo.png',
};

// 回退灰盒配色(宣纸底上的淡彩块)
const FALLBACK = {
  'compound/act1': ['#e8e2d2', '#d8d0bc', '#c9bfa6'],
  'compound/act2': ['#ece4d0', '#e0d4b6', '#cbbd9a'],
  'compound/act3': ['#ddd8cc', '#c8c2b2', '#a9a294'],
  'cover': ['#3a3630', '#57503f', '#7a715c'],
  'portrait/meng_yulou': '#c9c3d0', 'portrait/pan_jinlian': '#a8442e',
  'portrait/li_pinger': '#b89a55', 'portrait/wu_yueniang': '#3e5a54',
  'portrait/sun_xuee': '#8a7f72', 'portrait/pang_chunmei': '#9fb0a0',
  'portrait/ximen_qing': '#2e4a6e',
  'portrait/meng_yulou_mourning': '#d8d4c8', 'portrait/pan_jinlian_mourning': '#d0ccc0',
  'portrait/li_jiaoer': '#7a5a6e',
  'portrait/wu_yueniang_mourning': '#d4d0c4', 'portrait/sun_xuee_mourning': '#c9c2b2',
  'portrait/pang_chunmei_madam': '#9e3a30',
  'servant/daian': '#3a4a4e', 'servant/xiaoyu': '#5a6a5e',
  'servant/feng_mama': '#6e6258', 'servant/xue_meipo': '#8a4a52',
};

const images = {}; // key -> HTMLImageElement | null
const blockCache = {};

function loadOne(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

export async function loadAssets() {
  await Promise.all(
    Object.entries(KEY_PATHS).map(([k, p]) => loadOne(p).then((i) => (images[k] = i)))
  );
  return images;
}

export function hasImage(key) {
  return !!images[key];
}

export function imageOf(key) {
  return images[key] ?? null;
}

export function urlOf(key) {
  const img = images[key];
  return img ? img.src : null;
}

// 宅院背景;缺图回退宣纸渐变
export function compoundStyle(key) {
  const img = images[key];
  if (img) {
    return { backgroundImage: `url(${img.src})`, backgroundSize: 'cover', backgroundPosition: 'center 40%' };
  }
  const [a, b, c] = FALLBACK[key] ?? ['#e0dccc', '#d0c8b4', '#c0b6a0'];
  return { backgroundImage: `linear-gradient(180deg, ${a} 0%, ${b} 60%, ${c} 100%)` };
}

// 立绘/小像 URL;缺图生成带名汉字的色块 dataURL(灰盒占位)
export function portraitURL(key, name = '', tall = true) {
  const img = images[key];
  if (img) return img.src;
  const ck = `${key}|${name}`;
  if (blockCache[ck]) return blockCache[ck];
  const w = tall ? 300 : 200, h = tall ? 900 : 300;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const color = FALLBACK[key] ?? '#8a8272';
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ebe5d5');
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(60,52,40,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = '#3c3428';
  ctx.font = `${tall ? 72 : 56}px "Songti SC", "SimSun", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = (name || key).slice(0, 3).split('');
  chars.forEach((ch, i) => ctx.fillText(ch, w / 2, h / 2 - ((chars.length - 1) * 44) + i * 88));
  blockCache[ck] = c.toDataURL();
  return blockCache[ck];
}

export function coverURL() {
  return images['cover'] ? images['cover'].src : null;
}
