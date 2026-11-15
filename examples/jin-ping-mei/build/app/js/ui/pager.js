// 分页：把容器的直接子元素按可用高度分成几页，一页只摆排得下的那些——菜单里不出滚动条。
// 容器须有确定的高度（.pg-view）。带 data-head 的小标题不会落在页尾。
import { icon } from './icons.js';

export function paginate(view, bar, { page = 0, onChange } = {}) {
  // 翻页条先占好自己的高度，再量内容区还剩多少
  bar.className = 'pg-bar';
  bar.hidden = false;
  bar.innerHTML = `<button type="button" data-pg="-1" aria-label="上一页">${icon('prev')}</button><span aria-live="polite"></span><button type="button" data-pg="1" aria-label="下一页">${icon('next')}</button>`;
  const kids = [...view.children];
  for (const k of kids) k.hidden = false;
  const avail = view.clientHeight;
  const pages = [[]];
  let start = null;
  for (const k of kids) {
    const top = k.offsetTop;
    if (start === null) start = top;
    if (top + k.offsetHeight - start > avail + 0.5 && pages.at(-1).length) { pages.push([]); start = top; }
    pages.at(-1).push(k);
  }
  for (let i = 0; i < pages.length - 1; i += 1) {
    while (pages[i].length > 1 && pages[i].at(-1).hasAttribute('data-head')) pages[i + 1].unshift(pages[i].pop());
  }
  const total = pages.length;
  let at = page === 'last' ? total - 1 : Math.min(total - 1, Math.max(0, Number(page) || 0));

  bar.hidden = total < 2;
  const [prev, label, next] = bar.children;
  const show = () => {
    pages.forEach((list, i) => { for (const k of list) k.hidden = i !== at; });
    label.textContent = `${at + 1} / ${total}`;
    prev.disabled = at === 0;
    next.disabled = at === total - 1;
  };
  const flip = (delta) => {
    const to = Math.min(total - 1, Math.max(0, at + delta));
    if (to === at) return false;
    at = to;
    show();
    onChange?.(at);
    return true;
  };
  bar.onclick = (e) => { const d = e.target.closest('[data-pg]')?.dataset.pg; if (d) flip(Number(d)); };
  show();
  // 把要找的那一项翻到眼前
  const reveal = (el) => { const i = pages.findIndex((list) => list.includes(el)); if (i >= 0 && i !== at) { at = i; show(); onChange?.(at); } };
  return { get page() { return at; }, total, flip, reveal };
}
