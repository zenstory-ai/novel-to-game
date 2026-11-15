// 美术资源路径与立绘的头像取景框（归一化：中心 x、中心 y、边长相对图高）。

export const FACES = {
  bajie: [0.47, 0.15, 0.25], crab: [0.5, 0.75, 0.42], form_chongzi: [0.5, 0.58, 0.42], form_lieyuan: [0.5, 0.15, 0.26],
  form_shenjiang: [0.46, 0.14, 0.25], form_xuangui: [0.5, 0.2, 0.24], gaoshao: [0.5, 0.19, 0.24], laozhe: [0.52, 0.14, 0.25],
  lingji: [0.52, 0.13, 0.25], luosha: [0.5, 0.14, 0.25], mob_fire1: [0.52, 0.15, 0.25],
  mob_fire2: [0.5, 0.15, 0.25], nezha: [0.5, 0.15, 0.25], niumowang: [0.52, 0.17, 0.26], pixie: [0.72, 0.2, 0.3],
  sha: [0.55, 0.14, 0.25], shibi: [0.47, 0.14, 0.25], tang: [0.45, 0.13, 0.25], tudi: [0.56, 0.18, 0.25],
  whitebull: [0.72, 0.5, 0.3], wukong: [0.47, 0.14, 0.25], yaojiang: [0.55, 0.14, 0.25], yumian: [0.55, 0.13, 0.25],
};

export const unitArt = (key) => `assets/units/${key}.webp`;
export const walkArt = (key) => `assets/world/${key}.webp`;
export const walkSheet = (key, dir) => `assets/walk/${key}_${dir}.webp`;
export const itemArt = (key) => `assets/items/${key}.webp`;
export const uiArt = (key) => `assets/ui/${key}.webp`;
export const bgArt = (key) => `assets/bg/${key}.jpg`;
export const mapArt = (scene) => `assets/terrain/${scene}.webp`;
export const ELEMENT_ICON = { 金: 'element-metal', 木: 'element-wood', 水: 'element-water', 火: 'element-fire', 土: 'element-earth' };
export const ELEMENT_COLOR = { 金: '#c9a03a', 木: '#4c9a48', 水: '#3a8fc0', 火: '#d2492c', 土: '#9a7446' };

// 用 CSS 背景把立绘裁成头像：返回可直接赋给 style 的对象。立绘原图 600×900。
export function faceStyle(key) {
  const [cx, cy, s] = FACES[key] ?? [0.5, 0.15, 0.25];
  const ratio = 600 / 900; // 宽/高
  const sizeX = 100 / (s / ratio); // 背景宽度占头像框的百分比
  const posX = ((cx - s / ratio / 2) / (1 - s / ratio)) * 100;
  const posY = ((cy - s / 2) / (1 - s)) * 100;
  return {
    backgroundImage: `url(${unitArt(key)})`,
    backgroundSize: `${sizeX.toFixed(1)}% auto`,
    backgroundPosition: `${Math.max(0, Math.min(100, posX)).toFixed(1)}% ${Math.max(0, Math.min(100, posY)).toFixed(1)}%`,
    backgroundRepeat: 'no-repeat',
  };
}
