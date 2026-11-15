// 雨夜护灯：风把灯吹得要灭，按住（鼠标、触屏或空格）护到火苗站稳。松手早了火苗矮一截，可以再按；矮到底就灭了。
// 两种结果都继续往下演。设置「动作辅助」打开时自动护住。
import { settings } from '../store.js';
import { audio } from '../audio.js';

const $ = (sel) => document.querySelector(sel);
const GRACE_MS = 2600; // 先留出读提示的工夫，火苗才开始矮
const DRAIN_MS = 7000; // 之后不按的话，火苗这么久烧到底
const SLIP = 0.22; // 松手一次，火苗矮这么多
let activeHold = null;

// 返回 Promise<boolean | null>；paused() 为真时（菜单开着、切到后台）不计时，中途读档或退出返回 null
export function holdLamp({ ms, prompt }, { paused }) {
  closeHold();
  const root = $('#hold');
  root.innerHTML = `
    <div class="hold-scrim"></div>
    <div class="hold-body">
      <div class="lantern" aria-hidden="true">
        <svg viewBox="0 0 120 190">
          <!-- 与护灯过场里同一盏：竹竿挑着的素白圆纸灯（第 6 轮盲玩：提示里是六角灯，过场里是圆纸灯） -->
          <path class="l-handle" d="M60 12C80 4 100 -2 122 -6M60 12v16"/>
          <path class="l-frame" d="M60 36C100 36 106 70 106 98S100 160 60 160 14 126 14 98 20 36 60 36z"/>
          <path class="l-rib" d="M60 36v124M42 38C30 70 30 126 42 158M78 38C90 70 90 126 78 158M18 70Q60 80 102 70M14 98Q60 108 106 98M18 126Q60 136 102 126"/>
          <path class="l-foot" d="M48 28h24v8H48zM48 160h24v7H48zM60 167v18"/>
        </svg>
        <i class="flame"></i>
        <svg class="ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle class="ring-fill" cx="60" cy="60" r="54"/></svg>
      </div>
      <p class="hold-prompt">${prompt}</p>
      <p class="hold-how"><b>按住</b>画面或空格，直到火苗站稳</p>
    </div>`;
  root.hidden = false;
  const fill = root.querySelector('.ring-fill');
  const lantern = root.querySelector('.lantern');
  const how = root.querySelector('.hold-how');
  const LEN = 2 * Math.PI * 54;
  fill.style.strokeDasharray = LEN;
  audio.se('gust');

  return new Promise((resolve) => {
    let level = 1; // 火苗高度 0…1
    let held = 0; // 这一次已经按住多久
    let holding = false;
    let last = performance.now();
    let enterRaf = 0;
    let raf = 0;
    let fadeTimer = 0;
    let doneTimer = 0;
    let done = false;
    let settled = false;
    let waited = 0;

    const detach = () => {
      cancelAnimationFrame(enterRaf);
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('keyup', keyup, true);
    };
    const finish = (ok) => {
      if (done) return;
      done = true;
      detach();
      root.classList.add(ok ? 'kept' : 'lost');
      audio.se(ok ? 'flare' : 'gust');
      fadeTimer = setTimeout(() => { if (activeHold === session) root.classList.remove('on'); }, 900);
      doneTimer = setTimeout(() => {
        if (activeHold !== session || settled) return;
        settled = true;
        activeHold = null;
        root.hidden = true;
        root.innerHTML = '';
        root.className = '';
        resolve(ok);
      }, 1400);
    };
    const down = (e) => { e.preventDefault(); holding = true; root.classList.add('holding'); };
    const up = () => {
      if (!holding) return;
      holding = false;
      root.classList.remove('holding');
      // 松手早了：提示行亮起来说「别松手」（第 5 轮盲玩：连点空格的人没意识到要按住）。
      // 读提示的那 2.6 秒里，从对话带过来的连点不扣火苗
      if (held > 0 && held < ms) {
        if (waited > GRACE_MS) level -= SLIP;
        how.classList.remove('nudge');
        void how.offsetWidth;
        how.classList.add('nudge');
        how.innerHTML = '<b>别松手</b>，一直按住画面或空格，等外圈画满';
      }
      held = 0;
    };
    const keydown = (e) => { if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(e); } };
    const keyup = (e) => { if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); up(); } };
    const frame = (now) => {
      if (activeHold !== session) return;
      const dt = Math.min(100, now - last);
      last = now;
      if (!paused()) {
        waited += dt;
        if (holding) held += dt; else if (waited > GRACE_MS) level -= dt / DRAIN_MS;
        if (settings.assist) { held += dt; root.classList.add('holding'); }
      }
      const k = Math.min(1, held / ms);
      fill.style.strokeDashoffset = LEN * (1 - k);
      lantern.style.setProperty('--level', Math.max(0.12, holding || settings.assist ? Math.min(1, level + k * 0.4) : level).toFixed(3));
      if (held >= ms) { finish(true); return; }
      if (level <= 0) { finish(false); return; }
      raf = requestAnimationFrame(frame);
    };
    const session = {
      abort: () => {
        if (settled) return;
        settled = true;
        done = true;
        detach();
        if (activeHold === session) activeHold = null;
        root.hidden = true;
        root.innerHTML = '';
        root.className = '';
        resolve(null);
      },
    };
    activeHold = session;
    enterRaf = requestAnimationFrame(() => { if (activeHold === session) root.classList.add('on'); });
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('keyup', keyup, true);
    raf = requestAnimationFrame(frame);
  });
}

export const holdOpen = () => Boolean(activeHold);

export function closeHold() {
  activeHold?.abort();
  const root = $('#hold');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
  root.className = '';
}
