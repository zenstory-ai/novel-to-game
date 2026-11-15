// 图片加载与缓存。必需的图读不出时抛错，由启动流程显示出来。
const cache = new Map();

export function image(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`图片读取失败：${src}`));
      img.src = src;
    }));
  }
  return cache.get(src);
}

export const images = (list) => Promise.all(list.map(image));
