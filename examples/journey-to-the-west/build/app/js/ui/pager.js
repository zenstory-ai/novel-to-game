// 分页：把容器的直接子元素按可用高度分成几页，一页只摆排得下的那些——面板里不出滚动条。
// 容器须有确定的高度（.pg-view）。
import { h } from '../core/dom.js';

export function paginate(view, bar, { page = 0, onChange } = {}) {
  // 翻页条先占好自己的高度，再量内容区还剩多少
  const label = h('span');
  const prev = h('button.btn.small', { type: 'button', data: { pg: 'prev' }, 'aria-label': '上一页' }, '‹');
  const next = h('button.btn.small', { type: 'button', data: { pg: 'next' }, 'aria-label': '下一页' }, '›');
  bar.className = 'pg-bar';
  bar.replaceChildren(prev, label, next);
  const kids = [...view.children];
  for (const k of kids) k.classList.remove('hidden');
  const avail = view.clientHeight;
  const pages = [[]];
  let start = null;
  for (const k of kids) {
    const top = k.offsetTop;
    if (start === null) start = top;
    if (top + k.offsetHeight - start > avail + 0.5 && pages.at(-1).length) { pages.push([]); start = top; }
    pages.at(-1).push(k);
  }
  const total = pages.length;
  let at = Math.min(total - 1, Math.max(0, page));
  bar.classList.toggle('hidden', total < 2);
  const show = () => {
    pages.forEach((list, i) => { for (const k of list) k.classList.toggle('hidden', i !== at); });
    label.textContent = `${at + 1} / ${total}`;
    prev.disabled = at === 0;
    next.disabled = at === total - 1;
  };
  const flip = (d) => { const to = Math.min(total - 1, Math.max(0, at + d)); if (to !== at) { at = to; show(); onChange?.(at); } };
  prev.onclick = () => flip(-1);
  next.onclick = () => flip(1);
  show();
  return { get page() { return at; }, total, flip };
}
