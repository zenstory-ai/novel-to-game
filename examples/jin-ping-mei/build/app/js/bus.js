// 极小的事件总线：导演（game.js）与菜单册页（ui/book.js）互不直接引用，由 app.js 接线。
const handlers = new Map();
export const bus = {
  on(type, fn) { (handlers.get(type) ?? handlers.set(type, new Set()).get(type)).add(fn); },
  emit(type, payload) { for (const fn of handlers.get(type) ?? []) fn(payload); },
};
