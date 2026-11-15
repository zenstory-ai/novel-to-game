// 三种整屏卡：章节卡（墨底金线，自己收起）、结局卡（盖一枚良缘／寻常／错过的印）、原著命数页（逐行浮现）。
// 每张卡都返回 Promise，卡收起后导演再往下走。
import { CAST, ENDINGS, ENDING_KIND, FATES, CG, faceSrc } from '../story/registry.js';
import { record } from '../store.js';
import { audio } from '../audio.js';

const $ = (sel) => document.querySelector(sel);
const GUARD_MS = 650; // 显出全文后略停，才响应点击，防止连点把整页带过去
let dismiss = null;
let activeCard = null;

function openCard(html, cls, resolve) {
  closeCard();
  const root = $('#card');
  root.className = cls;
  root.innerHTML = html;
  root.hidden = false;
  const session = {
    raf1: 0,
    raf2: 0,
    stepTimer: 0,
    unmountTimer: 0,
    settled: false,
    stop() {
      cancelAnimationFrame(this.raf1);
      cancelAnimationFrame(this.raf2);
      clearTimeout(this.stepTimer);
      clearTimeout(this.unmountTimer);
    },
    abort() {
      if (this.settled) return;
      this.settled = true;
      this.stop();
      dismiss = null;
      if (activeCard === session) activeCard = null;
      root.hidden = true;
      root.innerHTML = '';
      root.className = '';
      resolve(false);
    },
  };
  activeCard = session;
  session.raf1 = requestAnimationFrame(() => {
    session.raf2 = requestAnimationFrame(() => {
      if (activeCard === session) root.classList.add('on');
    });
  });
  return { root, session };
}

function unmount(session, resolve) {
  if (activeCard !== session || session.settled) return;
  const root = $('#card');
  dismiss = null;
  clearTimeout(session.stepTimer);
  root.classList.remove('on');
  root.classList.add('off');
  session.unmountTimer = setTimeout(() => {
    if (activeCard !== session || session.settled) return;
    session.settled = true;
    activeCard = null;
    root.hidden = true;
    root.innerHTML = '';
    root.className = '';
    resolve(true);
  }, 520);
}

export const cardOpen = () => !$('#card').hidden;
// 点击或按键：交给当前这张卡
export function cardAdvance() { dismiss?.(); }
export function closeCard() {
  activeCard?.abort();
  dismiss = null;
  const root = $('#card');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
  root.className = '';
}

export function chapterCard({ title, sub }, { fast = false } = {}) {
  return new Promise((resolve) => {
    const { session } = openCard(`
      <div class="chapter-art"></div>
      <div class="chapter-body">
        <p class="chapter-no">${title}</p>
        <h2 class="chapter-title">${sub || title}</h2>
        <i class="chapter-rule"></i>
      </div>`, 'card-chapter', resolve);
    if (!fast) audio.se('chapter');
    let closed = false;
    const close = () => { if (closed) return; closed = true; unmount(session, resolve); };
    session.stepTimer = setTimeout(close, fast ? 350 : 2600);
    const armed = performance.now() + (fast ? 0 : 500);
    dismiss = () => { if (performance.now() >= armed) close(); };
  });
}

export function endingCard(id) {
  const ending = ENDINGS[id];
  const who = ending.who ? CAST[ending.who] : null;
  const total = Object.keys(ENDINGS).length;
  return new Promise((resolve) => {
    const { session } = openCard(`
      <div class="ending-body" style="--c:${who?.color ?? '#6b6f8c'};--glow:${who?.glow ?? '#b9bdd8'}">
        ${who ? `<img class="ending-face" src="${faceSrc(ending.who)}" alt="">` : '<div class="ending-face blank"></div>'}
        <p class="ending-who">${who ? `${who.full} · ${who.house}` : '西门宅 · 书房'}</p>
        <h2 class="ending-title">${ending.title}</h2>
        <div class="ending-seal kind-${ending.kind}"><span>${ENDING_KIND[ending.kind]}</span></div>
        <p class="ending-count">已见结局 ${record.ending.size} / ${total}</p>
        <p class="card-hint">点击继续</p>
      </div>`, 'card-ending', resolve);
    audio.se('ending');
    const armed = performance.now() + 1500;
    dismiss = () => { if (performance.now() >= armed) unmount(session, resolve); };
  });
}

export function fatePage(who) {
  const lines = FATES[who] ?? [];
  const name = CAST[who]?.full ?? '西门庆';
  return new Promise((resolve) => {
    const { root, session } = openCard(`
      <div class="fate-art" style="background-image:url('${CG.fate.src}')"></div>
      <div class="fate-body">
        <p class="fate-kicker">原著命数</p>
        <h2 class="fate-name">${name}</h2>
        <div class="fate-lines">${lines.map((line) => `<p>${line}</p>`).join('')}</div>
        <p class="fate-foot">这一春你们说成了什么，由你；她在书里的去处，改不了。</p>
        <p class="card-hint" hidden>点击回到标题</p>
      </div>`, 'card-fate', resolve);
    const ps = [...root.querySelectorAll('.fate-lines p')];
    const foot = root.querySelector('.fate-foot');
    const hint = root.querySelector('.card-hint');
    let shownCount = 0;
    let armed = Infinity;
    const finish = () => { foot.classList.add('on'); hint.hidden = false; armed = performance.now() + GUARD_MS; };
    const reveal = () => {
      if (activeCard !== session) return;
      if (shownCount < ps.length) {
        ps[shownCount].classList.add('on');
        shownCount += 1;
        session.stepTimer = setTimeout(reveal, 1900);
      } else finish();
    };
    session.stepTimer = setTimeout(reveal, 900);
    dismiss = () => {
      if (shownCount < ps.length || !foot.classList.contains('on')) {
        // 第一下：把还没浮现的行一次显出来
        clearTimeout(session.stepTimer);
        ps.forEach((p) => p.classList.add('on'));
        shownCount = ps.length;
        finish();
        return;
      }
      if (performance.now() >= armed) unmount(session, resolve);
    };
  });
}
