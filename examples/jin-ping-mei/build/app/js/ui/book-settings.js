// 设置页：阅读、声音、影像与辅助、成人画面。改动即时生效并写入本地。
import { settings, setSetting, DEFAULT_SETTINGS } from '../store.js';
import { toast, confirmBox } from './feedback.js';

const RANGES = [
  ['read', '文字速度', 'textSpeed', 10, 100, 5, (v) => (v >= 100 ? '整句显出' : `每秒 ${v} 字`)],
  ['read', '自动翻页', 'autoSpeed', 0, 100, 5, (v) => (v < 34 ? '慢' : v < 67 ? '中' : '快')],
  ['read', '文字框浓淡', 'boxAlpha', 30, 100, 5, (v) => `${v}%`],
  ['sound', '配乐', 'bgm', 0, 100, 5, (v) => `${v}`],
  ['sound', '音效', 'se', 0, 100, 5, (v) => `${v}`],
  ['sound', '过场人声', 'voice', 0, 100, 5, (v) => `${v}`],
];
const TOGGLES = [
  ['read', '快进时也跳过没读过的文字', 'skipUnread', '关着时，快进走到没读过的句子会停下。'],
  ['film', '动态影像', 'film', '剧情过场与画面的待机微动。关掉后过场换成定格画面，字幕点击推进，内容一句不少。'],
  ['film', '减弱动效', 'calm', '停掉推镜、视差、落花与立绘弹跳；过场同样换成定格。'],
  ['assist', '限时抉择', 'timed', '关掉后不计时，「不作声」列为一个普通选项。'],
  ['assist', '动作辅助', 'assist', '雨夜护灯自动完成。'],
  ['adult', '成人画面', 'adult', '关掉后，亲密场景的画面以帘幕代替，文字照常。'],
];
// 设置分四签，每签一页排得下；再窄就由册页的分页接手
const GROUPS = [['read', '阅读', ['read']], ['sound', '声音', ['sound']], ['film', '影像与辅助', ['film', 'assist']], ['other', '其他', ['adult']]];
const SAMPLE = '那年春天，五扇门都为你留过灯。';
let previewTimer = null;

function preview(el) {
  clearInterval(previewTimer);
  if (!el) return;
  let n = 0;
  el.textContent = '';
  if (settings.textSpeed >= 100) { el.textContent = SAMPLE; return; }
  previewTimer = setInterval(() => {
    if (!el.isConnected) { clearInterval(previewTimer); return; }
    n += 1;
    el.textContent = SAMPLE.slice(0, n);
    if (n >= SAMPLE.length) clearInterval(previewTimer);
  }, 1000 / settings.textSpeed);
}

export function renderSettings(body, state, ctx) {
  const fullscreenOk = Boolean(document.documentElement.requestFullscreen);
  const [gid, , kinds] = GROUPS.find(([id]) => id === state.setTab) ?? GROUPS[0];
  const rows = [
    ...RANGES.filter((r) => kinds.includes(r[0])).map(([, label, key, min, max, step, fmt]) => `
      <label class="set-row range"><span>${label}</span>
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}" aria-label="${label}">
        <output>${fmt(settings[key])}</output>
      </label>${key === 'textSpeed' ? '<p class="set-preview" aria-hidden="true"></p>' : ''}`),
    ...TOGGLES.filter((t) => kinds.includes(t[0])).map(([, label, key, note]) => `
      <label class="set-row toggle"><span><b>${label}</b><em>${note}</em></span>
        <input type="checkbox" data-key="${key}" ${settings[key] ? 'checked' : ''} aria-label="${label}"><i class="switch"></i>
      </label>`),
    gid === 'film' ? '<div class="set-row actions"><span><b>一键辅助</b><em>关掉限时、打开动作辅助并减弱动效，按自己的节奏读完。</em></span><button type="button" class="btn small" data-act="easy">打开</button></div>' : '',
    gid === 'other' && fullscreenOk ? '<div class="set-row actions"><span><b>全屏</b></span><button type="button" class="btn small" data-act="full">切换</button></div>' : '',
    gid === 'other' ? '<div class="set-row actions"><span><b>恢复默认设置</b></span><button type="button" class="btn small" data-act="reset">恢复</button></div>' : '',
  ];
  body.innerHTML = `
    <div class="subtabs" role="tablist">${GROUPS.map(([id, name]) => `<button type="button" role="tab" aria-selected="${id === gid}" class="${id === gid ? 'on' : ''}" data-set="${id}">${name}</button>`).join('')}</div>
    <div class="set-list">${rows.join('')}</div>`;
  ctx.paged(body.querySelector('.set-list'));
  preview(body.querySelector('.set-preview'));
  body.oninput = (e) => {
    const input = e.target.closest('input[data-key]');
    if (!input) return;
    const key = input.dataset.key;
    if (input.type === 'checkbox') setSetting(key, input.checked);
    else {
      const value = Number(input.value);
      setSetting(key, value);
      input.parentElement.querySelector('output').textContent = RANGES.find((r) => r[2] === key)[6](value);
      if (key === 'textSpeed') preview(body.querySelector('.set-preview'));
    }
  };
  body.onclick = async (e) => {
    const tab = e.target.closest('[data-set]')?.dataset.set;
    if (tab) { state.setTab = tab; ctx.resetPage(); ctx.rerender(); document.querySelector('#book .subtabs .on')?.focus(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'easy') {
      setSetting('timed', false);
      setSetting('assist', true);
      setSetting('calm', true);
      toast('已打开：不限时、护灯自动、减弱动效');
      ctx.rerender();
    } else if (act === 'full') {
      if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('浏览器没有允许全屏'));
    } else if (act === 'reset') {
      if (!(await confirmBox('把设置恢复成默认？', { detail: '存档、已读与鉴赏记录不受影响。', yes: '恢复' }))) return;
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) setSetting(key, value);
      ctx.rerender();
    }
  };
}
