// 轻提示与确认框。确认框是模态的：焦点圈在框内，Esc 等于取消。
const $ = (sel) => document.querySelector(sel);
let toastTimer = null;

export function toast(message, ms = 1800) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

// 提示说的事已经过去时立刻收起（第 2、5 轮盲玩：跳过过场后「影像还在演」仍挂着，与「她记下了」的印叠在一起）
export function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').classList.remove('on');
}

let closeConfirm = null;
export const confirmOpen = () => Boolean(closeConfirm);

// 返回 Promise<boolean>
export function confirmBox(message, { yes = '确定', no = '取消', detail = '' } = {}) {
  closeConfirm?.(false);
  const root = $('#confirm');
  const back = document.activeElement;
  root.innerHTML = `
    <div class="confirm-card" role="alertdialog" aria-modal="true" aria-label="${message}">
      <p class="confirm-msg">${message}</p>
      ${detail ? `<p class="confirm-detail">${detail}</p>` : ''}
      <div class="confirm-actions">
        <button type="button" class="btn" data-v="no">${no}</button>
        <button type="button" class="btn primary" data-v="yes">${yes}</button>
      </div>
    </div>`;
  root.hidden = false;
  return new Promise((resolve) => {
    const done = (value) => {
      closeConfirm = null;
      root.hidden = true;
      root.innerHTML = '';
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey, true);
      if (back?.isConnected && back.offsetParent) back.focus?.();
      resolve(value);
    };
    const onClick = (e) => {
      const v = e.target.closest('[data-v]')?.dataset.v;
      if (v) done(v === 'yes');
      else if (e.target === root) done(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); return; }
      if (e.key === 'Tab') {
        const btns = [...root.querySelectorAll('button')];
        const i = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
      }
      e.stopPropagation();
    };
    closeConfirm = done;
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    root.querySelector('[data-v="yes"]').focus();
  });
}
