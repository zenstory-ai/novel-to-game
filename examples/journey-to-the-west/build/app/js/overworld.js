// 序幕小世界:火焰山脚。点击移动队伍,点击土地对话,走到罗刹女处进入战斗1。

import { TEXT } from './text.js';
import { el } from './ui.js';
import { audio } from './audio.js';
import { unitImage, sceneImage, bgStyle } from './assets.js';

const W = 1280, H = 720;

export function runOverworld(ctx) {
  // ctx: {root, onTalkTudi:Promise-lines, onReachLuosha, fast}
  const { root } = ctx;
  const wrap = el('div', 'overworld-root');
  const canvas = el('canvas', 'overworld-canvas');
  canvas.id = 'overworld-canvas';
  canvas.width = W; canvas.height = H;
  const tip = el('div', 'overworld-tip', TEXT.overworld.tip);
  const loc = el('div', 'overworld-loc', TEXT.overworld.title);
  wrap.append(canvas, tip, loc);
  root.appendChild(wrap);
  const g = canvas.getContext('2d');
  Object.assign(wrap.style, bgStyle('overworld'));

  // 实体:坐标为世界坐标(1280x720 逻辑)
  const ents = {
    wukong: { key: 'wukong', name: TEXT.speakers.wukong, x: 560, y: 520, h: 150, tx: 560, ty: 520, speed: 300 },
    tang: { key: 'tang', name: TEXT.speakers.tang, x: 480, y: 560, h: 140 },
    bajie: { key: 'bajie', name: TEXT.speakers.bajie, x: 420, y: 600, h: 145 },
    sha: { key: 'sha', name: TEXT.speakers.sha, x: 360, y: 640, h: 148 },
    tudi: { key: 'tudi', name: TEXT.speakers.tudi, x: 300, y: 400, h: 120, npc: true },
    luosha: { key: 'luosha', name: TEXT.speakers.luosha, x: 1060, y: 260, h: 165, npc: true },
  };
  const followers = [
    { e: ents.tang, dx: -80, dy: 40 },
    { e: ents.bajie, dx: -140, dy: 80 },
    { e: ents.sha, dx: -200, dy: 120 },
  ];

  let raf = 0, last = performance.now();
  let busy = false; // 对话中禁止移动
  let luoshaArmed = true;
  let disposed = false;

  function worldFromEvent(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * W,
      y: ((ev.clientY - r.top) / r.height) * H,
    };
  }

  function hitNpc(p) {
    for (const k of ['luosha', 'tudi']) {
      const e = ents[k];
      if (Math.abs(p.x - e.x) < 70 && Math.abs(p.y - e.y) < 90) return k;
    }
    return null;
  }

  async function onClick(ev) {
    if (busy) return;
    const p = worldFromEvent(ev);
    const npc = hitNpc(p);
    if (npc) audio.sfx('click');
    if (npc === 'tudi') {
      await talkTudi();
      return;
    }
    if (npc === 'luosha') {
      await gotoLuosha();
      return;
    }
    // 地面:限制在可走带
    const y = Math.max(180, Math.min(660, p.y));
    ents.wukong.tx = Math.max(80, Math.min(1200, p.x));
    ents.wukong.ty = y;
  }

  async function talkTudi() {
    busy = true;
    ents.wukong.tx = ents.tudi.x + 90; ents.wukong.ty = ents.tudi.y + 40;
    await waitArrive();
    await ctx.onTalkTudi();
    busy = false;
  }

  async function gotoLuosha() {
    busy = true;
    ents.wukong.tx = ents.luosha.x - 110; ents.wukong.ty = ents.luosha.y + 60;
    await waitArrive();
    await triggerLuosha();
  }

  // 键盘移动(简报验收:键盘全流程可通关):方向键走位,回车/空格与附近 NPC 互动
  function onKey(ev) {
    if (disposed || busy) return;
    if (document.querySelector('.modal-mask, .dlg-box')) return;
    const w = ents.wukong;
    const stepN = 70;
    const clampX = (x) => Math.max(80, Math.min(1200, x));
    const clampY = (y) => Math.max(180, Math.min(660, y));
    if (ev.key === 'ArrowLeft') { w.tx = clampX(w.tx - stepN); w.ty = clampY(w.ty); }
    else if (ev.key === 'ArrowRight') { w.tx = clampX(w.tx + stepN); w.ty = clampY(w.ty); }
    else if (ev.key === 'ArrowUp') { w.ty = clampY(w.ty - stepN); w.tx = clampX(w.tx); }
    else if (ev.key === 'ArrowDown') { w.ty = clampY(w.ty + stepN); w.tx = clampX(w.tx); }
    else if (ev.key === 'Enter' || ev.key === ' ') {
      const near = ['tudi', 'luosha'].find((k) => Math.hypot(ents[k].x - w.x, ents[k].y - w.y) < 170);
      if (near === 'tudi') talkTudi();
      else if (near === 'luosha') gotoLuosha();
      else return;
    } else return;
    ev.preventDefault();
  }
  window.addEventListener('keydown', onKey);

  function waitArrive() {
    return new Promise((resolve) => {
      const check = () => {
        const w = ents.wukong;
        if (Math.hypot(w.tx - w.x, w.ty - w.y) < 8) resolve();
        else setTimeout(check, 60);
      };
      check();
    });
  }

  async function triggerLuosha() {
    if (!luoshaArmed) return;
    luoshaArmed = false;
    busy = true;
    await ctx.onReachLuosha();
  }

  function step(dt) {
    const w = ents.wukong;
    const dx = w.tx - w.x, dy = w.ty - w.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const v = Math.min(d, w.speed * dt);
      w.x += (dx / d) * v;
      w.y += (dy / d) * v;
    }
    for (const f of followers) {
      const gx = w.x + f.dx, gy = w.y + f.dy;
      f.e.x += (gx - f.e.x) * Math.min(1, dt * 3.2);
      f.e.y += (gy - f.e.y) * Math.min(1, dt * 3.2);
    }
    // 走到罗刹女附近也触发
    if (luoshaArmed && !busy && Math.hypot(ents.luosha.x - w.x, ents.luosha.y - w.y) < 110) {
      triggerLuosha();
    }
  }

  function drawEnt(e) {
    const img = unitImage(e.key);
    const h = e.h;
    if (img) {
      const wpx = (img.width / img.height) * h;
      g.drawImage(img, e.x - wpx / 2, e.y - h, wpx, h);
    } else {
      // 回退色块
      const wpx = h * 0.62;
      g.fillStyle = e.key === 'luosha' ? '#3a7a5a' : '#7a6a55';
      g.fillRect(e.x - wpx / 2, e.y - h, wpx, h);
      g.strokeStyle = '#c9a227';
      g.lineWidth = 3;
      g.strokeRect(e.x - wpx / 2, e.y - h, wpx, h);
      g.fillStyle = '#f2e8d5';
      g.font = `bold ${Math.round(h * 0.36)}px "Songti SC", serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(e.name.slice(0, 1), e.x, e.y - h / 2);
    }
    // 名牌(置顶,避免与下方单位重叠;描边底+金线保证清晰)
    g.font = '15px "Songti SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    const tw = g.measureText(e.name).width + 14;
    const ly = e.y - e.h - 24;
    g.fillStyle = 'rgba(43,33,24,0.85)';
    g.fillRect(e.x - tw / 2, ly, tw, 22);
    g.strokeStyle = 'rgba(201,162,39,0.8)';
    g.lineWidth = 1;
    g.strokeRect(e.x - tw / 2, ly, tw, 22);
    g.fillStyle = '#f2e8d5';
    g.fillText(e.name, e.x, ly + 20);
  }

  function drawScenery() {
    // 远山(火焰山轮廓) + 芭蕉洞入口标记,有背景图时作为点缀叠加
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#8a2e1e';
    g.beginPath();
    g.moveTo(0, 240); g.lineTo(180, 120); g.lineTo(340, 210); g.lineTo(520, 90);
    g.lineTo(700, 190); g.lineTo(900, 110); g.lineTo(1100, 200); g.lineTo(1280, 130);
    g.lineTo(1280, 0); g.lineTo(0, 0); g.closePath();
    g.fill();
    g.restore();
    // 地面可走带
    g.save();
    g.globalAlpha = 0.2;
    g.fillStyle = '#f2d89a';
    g.fillRect(0, 180, W, H - 180);
    g.restore();
    // 芭蕉洞入口(罗刹女身后)
    g.save();
    g.fillStyle = 'rgba(30,58,46,0.9)';
    g.beginPath();
    g.ellipse(ents.luosha.x + 10, ents.luosha.y - 60, 90, 110, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = '#c9a227';
    g.lineWidth = 3;
    g.stroke();
    // 地标挪到洞口左侧(上方让给「!」指引标记),加描边底牌保证在山体上可读
    g.font = '17px "Songti SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const caveLabel = '翠云山 · 芭蕉洞';
    const clw = g.measureText(caveLabel).width + 18;
    const clx = ents.luosha.x - 186, cly = ents.luosha.y - 150;
    g.fillStyle = 'rgba(43,33,24,0.85)';
    g.fillRect(clx - clw / 2, cly - 13, clw, 26);
    g.strokeStyle = 'rgba(201,162,39,0.8)';
    g.lineWidth = 1;
    g.strokeRect(clx - clw / 2, cly - 13, clw, 26);
    g.fillStyle = '#f2e8d5';
    g.fillText(caveLabel, clx, cly + 1);
    g.restore();
    // 土地庙(贴图优先,缺图回退占位画法)
    const miao = sceneImage('tudimiao');
    if (miao) {
      const mw = 150;
      const mh = (miao.height / miao.width) * mw;
      g.drawImage(miao, ents.tudi.x - 148, ents.tudi.y - mh - 6, mw, mh);
    } else {
      g.save();
      g.fillStyle = 'rgba(90,74,56,0.9)';
      g.fillRect(ents.tudi.x - 70, ents.tudi.y - 190, 60, 70);
      g.fillStyle = '#a8322a';
      g.beginPath();
      g.moveTo(ents.tudi.x - 84, ents.tudi.y - 190);
      g.lineTo(ents.tudi.x - 40, ents.tudi.y - 228);
      g.lineTo(ents.tudi.x + 4, ents.tudi.y - 190);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  function drawMarker(x, y, t, color, text) {
    // 脉冲高亮 + 「!」标记
    const s = 1 + Math.sin(t / 280) * 0.16;
    const yy = y - 200 - Math.abs(Math.sin(t / 300)) * 8;
    g.save();
    g.translate(x, yy);
    g.scale(s, s);
    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.fillStyle = color;
    g.globalAlpha = 0.92;
    g.fill();
    g.strokeStyle = '#c9a227';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 22px "Songti SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', 0, 1);
    g.restore();
    if (text) {
      g.save();
      g.font = '15px "Songti SC", serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(43,33,24,0.85)';
      const tw = g.measureText(text).width + 12;
      g.fillRect(x - tw / 2, yy + 22, tw, 20);
      g.fillStyle = '#ffd75a';
      g.fillText(text, x, yy + 37);
      g.restore();
    }
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    g.clearRect(0, 0, W, H);
    drawScenery();
    // 按 y 排序画,近处盖住远处
    const order = [ents.tudi, ents.luosha, ents.sha, ents.bajie, ents.tang, ents.wukong]
      .sort((a, b) => a.y - b.y);
    for (const e of order) drawEnt(e);
    // 指引标记:土地(问话第一步)、罗刹女(目的地)
    if (!(ctx.isTudiTalked && ctx.isTudiTalked())) {
      drawMarker(ents.tudi.x, ents.tudi.y, now, '#c9a227', '先问土地');
    }
    drawMarker(ents.luosha.x, ents.luosha.y, now, '#a8322a', '借扇于此');
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener('click', onClick);
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      wrap.remove();
    },
    hide() { wrap.style.display = 'none'; },
    show() { wrap.style.display = ''; },
    // QA 钩子:实体的页面坐标
    npcScreenPos(name) {
      const e = ents[name];
      if (!e) return null;
      const r = canvas.getBoundingClientRect();
      return {
        x: r.left + (e.x / W) * r.width,
        y: r.top + (e.y / H) * r.height,
      };
    },
    rearmLuosha() { luoshaArmed = true; busy = false; },
  };
}
