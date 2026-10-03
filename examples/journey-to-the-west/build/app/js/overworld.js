// 梦幻式场景：可走大地图 + 跟随镜头 + 点地寻路 + NPC/明雷妖怪/传送阵 + 小地图。
// 只管画与走;任务、对话、开战由 hub.js 通过回调决定。

import { SCENES, MAP_SCALE, GRID, NAME_COLORS } from './world.js';
import { audio } from './audio.js';
import { unitImage, bgImage } from './assets.js';

const FOLLOWERS = ['tang', 'bajie', 'sha'];
// 立绘原本朝左的单位(其余朝右);行走时据此决定是否镜像
const ART_FACES_LEFT = new Set(['wukong', 'pixie']);

export function runScene(ctx) {
  // ctx: {root, sceneId, spawn:[x,y](原图像素), fast, onActor(id), onPortal(id), onFrame(info), minimap:canvas}
  const scene = SCENES[ctx.sceneId];
  const S = MAP_SCALE;
  const WW = scene.size[0] * S, WH = scene.size[1] * S;
  const wrap = document.createElement('div');
  wrap.className = 'overworld-root';
  const canvas = document.createElement('canvas');
  canvas.className = 'overworld-canvas';
  canvas.id = 'overworld-canvas';
  wrap.appendChild(canvas);
  ctx.root.appendChild(wrap);
  const g = canvas.getContext('2d');
  const bg = bgImage(scene.bg);

  // ---------- 可走网格 ----------
  const walkPoly = scene.walk.map(([x, y]) => [x * S, y * S]);
  const cols = Math.ceil(WW / GRID), rows = Math.ceil(WH / GRID);
  const walkable = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      walkable[r * cols + c] = inPoly((c + 0.5) * GRID, (r + 0.5) * GRID, walkPoly) ? 1 : 0;
    }
  }
  const cellOf = (x, y) => [Math.max(0, Math.min(cols - 1, Math.floor(x / GRID))), Math.max(0, Math.min(rows - 1, Math.floor(y / GRID)))];
  const isWalk = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && walkable[r * cols + c] === 1;

  function nearestWalkable(c0, r0) {
    if (isWalk(c0, r0)) return [c0, r0];
    for (let rad = 1; rad < Math.max(cols, rows); rad++) {
      let best = null, bestD = Infinity;
      for (let dc = -rad; dc <= rad; dc++) {
        for (const dr of [-rad, rad]) {
          for (const [c, r] of [[c0 + dc, r0 + dr], [c0 + dr, r0 + dc]]) {
            if (!isWalk(c, r)) continue;
            const d = (c - c0) ** 2 + (r - r0) ** 2;
            if (d < bestD) { bestD = d; best = [c, r]; }
          }
        }
      }
      if (best) return best;
    }
    return [c0, r0];
  }

  function lineClear(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (GRID / 2));
    for (let i = 1; i <= steps; i++) {
      const [c, r] = cellOf(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
      if (!isWalk(c, r)) return false;
    }
    return true;
  }

  // 广度寻路(8 向，不切墙角)+ 拉直
  function findPath(fx, fy, tx, ty) {
    const [sc, sr] = nearestWalkable(...cellOf(fx, fy));
    const [gc, gr] = nearestWalkable(...cellOf(tx, ty));
    const goal = isWalk(...cellOf(tx, ty)) ? [tx, ty] : [(gc + 0.5) * GRID, (gr + 0.5) * GRID];
    if (lineClear(fx, fy, goal[0], goal[1])) return [goal];
    const prev = new Int32Array(cols * rows).fill(-1);
    const start = sr * cols + sc, end = gr * cols + gc;
    prev[start] = start;
    const queue = [start];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (cur === end) break;
      const c = cur % cols, r = (cur / cols) | 0;
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!dc && !dr) continue;
          const nc = c + dc, nr = r + dr;
          if (!isWalk(nc, nr) || (dc && dr && (!isWalk(c + dc, r) || !isWalk(c, r + dr)))) continue;
          const ni = nr * cols + nc;
          if (prev[ni] !== -1) continue;
          prev[ni] = cur;
          queue.push(ni);
        }
      }
    }
    if (start === end || prev[end] === -1) return [goal];
    const cells = [];
    for (let cur = end; cur !== start; cur = prev[cur]) cells.push([((cur % cols) + 0.5) * GRID, (((cur / cols) | 0) + 0.5) * GRID]);
    cells.reverse();
    cells[cells.length - 1] = goal;
    const out = [];
    let ax = fx, ay = fy, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !lineClear(ax, ay, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]);
      [ax, ay] = cells[j];
      i = j + 1;
    }
    return out;
  }

  // ---------- 实体 ----------
  const spawn = (ctx.spawn ?? scene.spawn).map((v) => v * S);
  const player = { id: 'player', unit: 'wukong', name: '孙悟空', title: '齐天大圣', x: spawn[0], y: spawn[1], h: 142, path: [], facing: 1, moving: false, kind: 'player' };
  const trail = [];
  const followers = FOLLOWERS.map((unit, i) => ({ unit, name: { tang: '唐僧', bajie: '猪八戒', sha: '沙悟净' }[unit], x: spawn[0] - 58 * (i + 1), y: spawn[1] + 26 * (i + 1), h: unit === 'tang' ? 130 : 136, facing: 1, moving: false, kind: 'party' }));
  let actors = [];      // hub 提供:{id, unit, name, title, x, y(原图像素), h, mark, kind:'npc'|'demon', wander}
  let portals = [];     // {id, to, x, y, label, locked}
  const bubbles = new Map(); // actorId -> {text, until}
  const ripples = [];
  let fxLevelUntil = 0;
  let pendingAct = null; // {type:'actor'|'portal', id}
  let busy = false;
  let disposed = false;
  let raf = 0, last = performance.now(), stepClock = 0, frameClock = 0;
  const speed = 270 * (ctx.fast ? 3 : 1);
  let cam = { x: 0, y: 0, vw: 1, vh: 1 };

  function resize() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    cam.vw = r.width; cam.vh = r.height; cam.dpr = dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- 镜头:跟随主角,另加一点「让开 HUD」的偏移 ----------
  // HUD(小地图/头像卡/任务追踪/聊天)盖在画布上;头顶挂「!」「?」的人若被盖住,
  // 镜头往旁边让一点(主角仍留在画面中部),新开局时土地也因此一进场就看得见。
  let hudRects = [];
  let hudClock = 1;
  function refreshHudRects() {
    const cr = canvas.getBoundingClientRect();
    hudRects = [...document.querySelectorAll('.world-hud .hud-map, .world-hud .hud-cards, .world-hud .hud-tracker, .world-hud .hud-chat')]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ l: r.left - cr.left - 8, t: r.top - cr.top - 8, r: r.right - cr.left + 8, b: r.bottom - cr.top + 8 }));
  }
  const hits = (box) => hudRects.some((h) => box.l < h.r && box.r > h.l && box.t < h.b && box.b > h.t);
  const bias = { x: 0, y: 0 };
  let snapBias = true; // 进场第一帧直接到位,不从别处慢慢摇过来
  function baseCam() {
    return {
      x: WW <= cam.vw ? (WW - cam.vw) / 2 : player.x - cam.vw / 2,
      y: WH <= cam.vh ? (WH - cam.vh) / 2 : player.y - 40 - cam.vh / 2,
    };
  }
  const clampCam = (x, y) => ({
    x: WW <= cam.vw ? (WW - cam.vw) / 2 : Math.max(0, Math.min(WW - cam.vw, x)),
    y: WH <= cam.vh ? (WH - cam.vh) / 2 : Math.max(0, Math.min(WH - cam.vh, y)),
  });
  function wantedBias() {
    const marked = actors.filter((a) => a.mark && Math.abs(a.wx - player.x) < cam.vw * 0.9 && Math.abs(a.wy - player.y) < cam.vh * 0.9);
    if (!marked.length || !hudRects.length) return { x: 0, y: 0 };
    const b0 = baseCam();
    const ok = (dx, dy) => {
      const c = clampCam(b0.x + dx, b0.y + dy);
      const px = player.x - c.x, py = player.y - c.y;
      if (px < cam.vw * 0.18 || px > cam.vw * 0.82 || py < 140 || py > cam.vh - 40) return false;
      return marked.every((a) => {
        const x = a.wx - c.x, y = a.wy - c.y;
        const box = { l: x - 60, r: x + 60, t: y - a.h - 66, b: y + 40 };
        return box.l > 0 && box.r < cam.vw && box.t > 0 && box.b < cam.vh && !hits(box);
      });
    };
    if (ok(0, 0)) return { x: 0, y: 0 };
    let best = null;
    for (let r = 40; r <= 520; r += 40) {
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r * 0.5], [0, r * 0.5], [-r, -r * 0.5], [-r, r * 0.5], [r, -r * 0.5], [r, r * 0.5]]) {
        if (ok(dx, dy)) { best = { x: dx, y: dy }; break; }
      }
      if (best) break;
    }
    return best ?? { x: 0, y: 0 };
  }
  function updateCamera(dt = 1) {
    hudClock += dt;
    if (hudClock > 0.5) { hudClock = 0; refreshHudRects(); }
    const want = wantedBias();
    const k = snapBias ? 1 : Math.min(1, dt * 5);
    bias.x += (want.x - bias.x) * k;
    bias.y += (want.y - bias.y) * k;
    const b0 = baseCam();
    const c = clampCam(b0.x + bias.x, b0.y + bias.y);
    cam.x = c.x;
    cam.y = c.y;
    if (snapBias && actors.length) snapBias = false;
  }

  function actorWorld(a) {
    return { x: a.x * S, y: a.y * S };
  }

  function walkTo(wx, wy) {
    player.path = findPath(player.x, player.y, wx, wy);
  }

  // ---------- 交互 ----------
  const near = (a, dist) => Math.hypot(a.wx - player.x, a.wy - player.y) < dist;

  // 放弃上一个目标：被点名停步的明雷妖怪恢复游走
  function dropPending() {
    if (pendingAct?.type === 'actor') { const old = actors.find((x) => x.id === pendingAct.id); if (old) old.frozen = false; }
    pendingAct = null;
  }

  function approachActor(id) {
    const a = actors.find((x) => x.id === id);
    if (!a) return false;
    dropPending();
    pendingAct = { type: 'actor', id };
    a.frozen = true; // 被点名的明雷妖怪停步等你
    // 站到对方身侧一步开外(约 110px),不贴脸、不踩到对方名牌
    const side = player.x < a.wx ? -1 : 1;
    walkTo(a.wx + side * 110, a.wy + 14);
    return true;
  }

  function approachPortal(id) {
    const p = portals.find((x) => x.id === id);
    if (!p) return false;
    dropPending();
    pendingAct = { type: 'portal', id };
    walkTo(p.x * S, p.y * S);
    return true;
  }

  // 点击区从脚下一直到头顶的「!」(约 70px 高)
  function hitActor(wx, wy) {
    const found = actors.filter((a) => Math.abs(wx - a.wx) < Math.max(34, a.h * 0.32) && wy < a.wy + 16 && wy > a.wy - a.h - 70);
    return found.sort((a, b) => b.wy - a.wy)[0] ?? null;
  }

  function hitPortal(wx, wy) {
    return portals.find((p) => Math.hypot((p.x * S - wx) / 1.6, p.y * S - wy) < 52) ?? null;
  }

  // 阵名字画在阵上方(或下方)，点字也算点阵：屏幕坐标对上一帧画出的字框
  function hitPortalLabel(sx, sy) {
    return portals.find((p) => p.labelBox && sx >= p.labelBox.l - 4 && sx <= p.labelBox.r + 4 && sy >= p.labelBox.t - 4 && sy <= p.labelBox.b + 4) ?? null;
  }

  function onClick(ev) {
    if (busy || disposed || document.querySelector('.dlg-box, .modal-mask, .npc-menu')) return;
    const r = canvas.getBoundingClientRect();
    const wx = ev.clientX - r.left + cam.x, wy = ev.clientY - r.top + cam.y;
    audio.unlock();
    const a = hitActor(wx, wy);
    if (a) { audio.sfx('click'); approachActor(a.id); return; }
    const pl = hitPortalLabel(ev.clientX - r.left, ev.clientY - r.top);
    if (pl) { approachPortal(pl.id); return; }
    const p = hitPortal(wx, wy);
    if (p) { approachPortal(p.id); return; }
    dropPending();
    ctx.onManualMove?.();
    walkTo(wx, wy);
    ripples.push({ x: wx, y: wy, t: 0 });
  }
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    const wx = ev.clientX - r.left + cam.x, wy = ev.clientY - r.top + cam.y;
    canvas.style.cursor = hitActor(wx, wy) || hitPortalLabel(ev.clientX - r.left, ev.clientY - r.top) || hitPortal(wx, wy) ? 'pointer' : '';
  });

  function onKey(ev) {
    if (busy || disposed || document.querySelector('.modal-mask, .dlg-box, .npc-menu')) return;
    const d = 90;
    const moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    if (moves[ev.key]) {
      dropPending();
      ctx.onManualMove?.();
      const [dx, dy] = moves[ev.key];
      walkTo(player.x + dx, player.y + dy);
      ev.preventDefault();
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      const a = actors.filter((x) => near(x, 190)).sort((x, y) => Math.hypot(x.wx - player.x, x.wy - player.y) - Math.hypot(y.wx - player.x, y.wy - player.y))[0];
      if (a) { approachActor(a.id); ev.preventDefault(); }
    }
  }
  window.addEventListener('keydown', onKey);

  function arrive() {
    const act = pendingAct;
    pendingAct = null;
    if (!act) return;
    if (act.type === 'actor') {
      const a = actors.find((x) => x.id === act.id);
      if (a) {
        player.facing = a.wx >= player.x ? 1 : -1;
        ctx.onActor?.(act.id);
      }
    } else {
      const p = portals.find((x) => x.id === act.id);
      if (p) ctx.onPortal?.(act.id);
    }
  }

  // ---------- 逐帧 ----------
  function moveAlong(ent, dt) {
    if (!ent.path.length) { ent.moving = false; return false; }
    const [tx, ty] = ent.path[0];
    const dx = tx - ent.x, dy = ty - ent.y;
    const d = Math.hypot(dx, dy);
    const v = speed * dt;
    if (Math.abs(dx) > 2) ent.facing = dx > 0 ? 1 : -1;
    ent.moving = true;
    if (d <= v) {
      ent.x = tx; ent.y = ty;
      ent.path.shift();
      if (!ent.path.length) { ent.moving = false; return true; }
    } else {
      ent.x += (dx / d) * v;
      ent.y += (dy / d) * v;
    }
    return false;
  }

  function step(dt, now) {
    if (moveAlong(player, dt)) arrive();
    if (player.moving) {
      stepClock += dt;
      if (stepClock > 0.32) { stepClock = 0; if (!ctx.fast) audio.sfx('step'); }
      const lastT = trail[trail.length - 1];
      if (!lastT || Math.hypot(lastT[0] - player.x, lastT[1] - player.y) > 6) trail.push([player.x, player.y]);
      if (trail.length > 200) trail.shift();
    }
    // 站定时:随从在主角身后排成一道弧(背对正在说话的人),不挤到 NPC 身上
    const settled = !player.moving;
    const backDir = -player.facing;
    followers.forEach((f, i) => {
      const idx = trail.length - 1 - (i + 1) * 9;
      let [gx, gy] = idx >= 0 ? trail[idx] : [f.x, f.y];
      if (settled) {
        const ax = player.x + backDir * (64 + i * 52), ay = player.y + [-34, 26, -4][i];
        const [c, r] = cellOf(ax, ay);
        const clear = !actors.some((a) => Math.abs(a.wx - ax) < 70 && Math.abs(a.wy - ay) < 60);
        if (isWalk(c, r) && clear) { gx = ax; gy = ay; }
      }
      const dx = gx - f.x, dy = gy - f.y;
      const d = Math.hypot(dx, dy);
      f.moving = d > 3;
      if (Math.abs(dx) > 2) f.facing = dx > 0 ? 1 : -1;
      const k = Math.min(1, dt * 6);
      f.x += dx * k; f.y += dy * k;
    });
    for (const a of actors) {
      if (a.kind !== 'demon' || !a.wander || a.frozen) {
        a.moving = false;
        // NPC 会转身看向走近的主角
        if (Math.abs(player.x - a.wx) > 20 && Math.hypot(player.x - a.wx, player.y - a.wy) < 420) a.facing = player.x > a.wx ? 1 : -1;
        continue;
      }
      a.wt -= dt;
      if (a.wt <= 0 || Math.hypot(a.tx - a.wx, a.ty - a.wy) < 4) {
        a.seed = (a.seed * 1103515245 + 12345) >>> 0;
        const ang = (a.seed % 628) / 100, rad = 40 + (a.seed % 90);
        const [c, r] = cellOf(a.hx + Math.cos(ang) * rad, a.hy + Math.sin(ang) * rad * 0.6);
        if (isWalk(c, r)) { a.tx = (c + 0.5) * GRID; a.ty = (r + 0.5) * GRID; }
        a.wt = 1.6 + (a.seed % 20) / 10;
      }
      const dx = a.tx - a.wx, dy = a.ty - a.wy, d = Math.hypot(dx, dy);
      a.moving = d > 3;
      if (a.moving) {
        const v = Math.min(d, 46 * dt);
        a.wx += (dx / d) * v; a.wy += (dy / d) * v;
        if (Math.abs(dx) > 1) a.facing = dx > 0 ? 1 : -1;
      }
    }
    for (const [id, b] of bubbles) if (now > b.until) bubbles.delete(id);
    for (const rp of ripples) rp.t += dt;
    while (ripples.length && ripples[0].t > 0.7) ripples.shift();
  }

  function drawSprite(e, now, opts = {}) {
    const img = unitImage(e.unit);
    const h = e.h;
    const bob = e.moving ? -Math.abs(Math.sin(now / 95)) * 5 : 0;
    const breathe = e.moving ? 1 : 1 + Math.sin(now / 520 + (e.x % 7)) * 0.014;
    const x = e.x - cam.x, y = e.y - cam.y;
    g.save();
    g.fillStyle = 'rgba(20,12,6,0.28)';
    g.beginPath();
    g.ellipse(x, y, h * 0.2, h * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    g.translate(x, y + bob);
    if (e.moving) g.rotate(Math.sin(now / 95) * 0.03);
    g.scale((e.facing < 0) !== ART_FACES_LEFT.has(e.unit) ? -1 : 1, breathe);
    if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = 18; }
    if (img) {
      const w = (img.width / img.height) * h;
      g.drawImage(img, -w / 2, -h, w, h);
    } else {
      g.fillStyle = '#8a6a4a';
      g.fillRect(-h * 0.18, -h, h * 0.36, h);
    }
    g.restore();
  }

  function label(text, x, y, color, size = 15) {
    g.font = `bold ${size}px "Songti SC", "STSong", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineWidth = 3.2;
    g.strokeStyle = 'rgba(12,8,4,0.92)';
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  function drawNames(e, color) {
    const x = e.x - cam.x, y = e.y - cam.y;
    if (e.title) label(e.title, x, y + 6, '#9fd8ff', 12);
    label(e.name, x, y + (e.title ? 22 : 8), color, 15);
  }

  function drawMark(e, mark, now) {
    const x = e.x - cam.x, y = e.y - cam.y - e.h - 26 - Math.abs(Math.sin(now / 260)) * 8;
    g.save();
    const daily = mark === '令';
    g.font = daily ? 'bold 28px "Songti SC", serif' : 'bold 40px "Songti SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = '#4a1d08';
    g.strokeText(mark, x, y);
    const grad = g.createLinearGradient(0, y - 18, 0, y + 18);
    grad.addColorStop(0, daily ? '#e6fbff' : '#fff6a8');
    grad.addColorStop(1, daily ? '#4fc3e8' : mark === '?' ? '#e2b13c' : '#ffb21e');
    g.fillStyle = grad;
    g.fillText(mark, x, y);
    g.restore();
  }

  function drawBubble(e, text) {
    g.font = '15px "Songti SC", "STSong", serif';
    const w = Math.min(260, g.measureText(text).width + 22);
    const x = e.x - cam.x - w / 2, y = e.y - cam.y - e.h - 64;
    g.fillStyle = 'rgba(255,252,240,0.95)';
    g.strokeStyle = 'rgba(90,60,30,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x, y, w, 30, 8);
    g.fill(); g.stroke();
    g.fillStyle = '#2c241c';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(text, x + 11, y + 15, w - 22);
  }

  function drawPortal(p, now) {
    const x = p.x * S - cam.x, y = p.y * S - cam.y;
    const col = p.locked ? 'rgba(170,170,170,' : 'rgba(110,240,255,';
    g.save();
    for (let i = 0; i < 3; i++) {
      const k = ((now / 1400 + i / 3) % 1);
      g.strokeStyle = `${col}${(1 - k) * 0.85})`;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y, 20 + k * 38, (20 + k * 38) * 0.38, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = `${col}0.25)`;
    g.beginPath();
    g.ellipse(x, y, 34, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // 传送阵字:对白/菜单打开时不画;压到 HUD 或 NPC/妖怪(身子+头顶标记+名牌,与 hitActor 同一块点击区)
  // 就挪到阵下方,再不行就不画(小地图上仍有阵眼)——字永远不盖人,点人永远点得到人
  const overActor = (box) => actors.some((a) => {
    const x = a.wx - cam.x, y = a.wy - cam.y, hw = Math.max(34, a.h * 0.32);
    return box.l < x + hw && box.r > x - hw && box.t < y + 40 && box.b > y - a.h - 70;
  });
  function drawPortalLabel(p) {
    const x = p.x * S - cam.x, y = p.y * S - cam.y;
    p.labelBox = null;
    if (document.body.classList.contains('dlg-open') || document.body.classList.contains('modal-open') || document.querySelector('.npc-menu')) return;
    const text = p.locked ? `${p.label}（未开）` : `→ ${p.label}`;
    g.font = 'bold 15px "Songti SC", "STSong", serif';
    const w = g.measureText(text).width + 8;
    const lx = Math.max(w / 2 + 12, Math.min(cam.vw - w / 2 - 12, x));
    for (const ly of [y - 52, y + 22]) {
      const box = { l: lx - w / 2, r: lx + w / 2, t: ly - 2, b: ly + 20 };
      if (ly < 8 || ly > cam.vh - 26 || hits(box) || overActor(box)) continue;
      label(text, lx, ly, p.locked ? '#c9c9c9' : NAME_COLORS.portal, 15);
      p.labelBox = box;
      return;
    }
  }

  function drawMinimap(now) {
    const mm = ctx.minimap;
    if (!mm || !mm.isConnected) return;
    const mg = mm.getContext('2d');
    const k = Math.min(mm.width / WW, mm.height / WH);
    const ox = (mm.width - WW * k) / 2, oy = (mm.height - WH * k) / 2;
    mg.clearRect(0, 0, mm.width, mm.height);
    if (bg) mg.drawImage(bg, ox, oy, WW * k, WH * k);
    mg.strokeStyle = 'rgba(255,255,255,0.8)';
    mg.lineWidth = 1;
    mg.strokeRect(ox + cam.x * k, oy + cam.y * k, cam.vw * k, cam.vh * k);
    const dot = (x, y, c, r = 3) => { mg.fillStyle = c; mg.beginPath(); mg.arc(ox + x * k, oy + y * k, r, 0, Math.PI * 2); mg.fill(); };
    for (const p of portals) dot(p.x * S, p.y * S, p.locked ? '#aaa' : '#5ef0ff', 3.5);
    for (const a of actors) dot(a.wx, a.wy, a.kind === 'demon' ? '#ff5a3c' : a.mark ? '#ffd23a' : '#fff1a0', a.mark ? 4 : 2.6);
    dot(player.x, player.y, '#5cff5c', 3.5 + Math.abs(Math.sin(now / 300)));
    mm.dataset.k = String(k); mm.dataset.ox = String(ox); mm.dataset.oy = String(oy);
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt, now);
    updateCamera(dt);
    const dpr = cam.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1c140c';
    g.fillRect(0, 0, cam.vw, cam.vh);
    if (bg) g.drawImage(bg, -cam.x, -cam.y, WW, WH);
    for (const rp of ripples) {
      g.strokeStyle = `rgba(255,240,170,${1 - rp.t / 0.7})`;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(rp.x - cam.x, rp.y - cam.y, 8 + rp.t * 40, (8 + rp.t * 40) * 0.4, 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of portals) drawPortal(p, now);
    const drawables = [
      ...actors.map((a) => ({ e: { ...a, x: a.wx, y: a.wy }, kind: a.kind, src: a })),
      ...followers.map((f) => ({ e: f, kind: 'party' })),
      { e: player, kind: 'player' },
    ].sort((a, b) => a.e.y - b.e.y);
    const lvFx = now < fxLevelUntil;
    for (const d of drawables) {
      const glow = d.kind === 'player' && lvFx ? '#ffd84a' : d.kind === 'demon' ? 'rgba(255,90,40,0.55)' : null;
      drawSprite(d.e, now, { glow });
    }
    if (lvFx) {
      const k = 1 - (fxLevelUntil - now) / 1600;
      const x = player.x - cam.x, y = player.y - cam.y;
      g.strokeStyle = `rgba(255,220,90,${1 - k})`;
      g.lineWidth = 4;
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.ellipse(x, y - k * 120 - i * 30, 30 + k * 30, 10 + k * 8, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // 名牌:先画自家队伍,再画 NPC/妖怪——两者叠在一起时 NPC 的名字和「!」在上面
    const namesOrder = [...drawables.filter((d) => d.kind === 'party' || d.kind === 'player'), ...drawables.filter((d) => d.kind !== 'party' && d.kind !== 'player')];
    for (const d of namesOrder) {
      const color = d.kind === 'player' ? NAME_COLORS.player : d.kind === 'party' ? NAME_COLORS.party : d.kind === 'demon' ? NAME_COLORS.demon : NAME_COLORS.npc;
      drawNames(d.e, color);
      if (d.src?.mark) drawMark(d.e, d.src.mark, now);
    }
    for (const p of portals) drawPortalLabel(p);
    for (const d of drawables) {
      const b = d.src ? bubbles.get(d.src.id) : d.kind === 'party' ? bubbles.get(d.e.unit) : d.kind === 'player' ? bubbles.get('player') : null;
      if (b) drawBubble(d.e, b.text);
    }
    frameClock += dt;
    if (frameClock > 0.12) {
      frameClock = 0;
      drawMinimap(now);
      ctx.onFrame?.({ x: Math.round(player.x / S / 10), y: Math.round(player.y / S / 10), moving: player.moving });
    }
    raf = requestAnimationFrame(frame);
  }
  refreshHudRects();
  updateCamera(1);
  raf = requestAnimationFrame(frame);

  function syncActors(list) {
    if (!actors.length && list.length) { snapBias = true; refreshHudRects(); }
    const prev = new Map(actors.map((a) => [a.id, a]));
    actors = list.map((a) => {
      const old = prev.get(a.id);
      if (old && old.x === a.x && old.y === a.y) return { ...old, ...a, h: old.h, mark: a.mark, wx: old.wx, wy: old.wy };
      const wx = a.x * S, wy = a.y * S;
      return { facing: -1, ...a, h: Math.round(a.h * 1.1), wx, wy, hx: wx, hy: wy, tx: wx, ty: wy, wt: 0, seed: (a.seed ?? 7) >>> 0, frozen: false };
    });
  }

  return {
    sceneId: scene.id,
    setActors: syncActors,
    setPortals(list) { portals = list; },
    setBusy(b) { busy = b; if (b) { player.path = []; pendingAct = null; } },
    stopWalking() { player.path = []; dropPending(); },
    approachActor,
    approachPortal,
    walkToMinimap(px, py) {
      const mm = ctx.minimap;
      const k = Number(mm.dataset.k), ox = Number(mm.dataset.ox), oy = Number(mm.dataset.oy);
      if (!k) return;
      dropPending();
      walkTo((px - ox) / k, (py - oy) / k);
    },
    bark(id, text, ms = 3600) { bubbles.set(id, { text, until: performance.now() + ms }); },
    levelUpFx() { fxLevelUntil = performance.now() + 1600; },
    unfreeze(id) { const a = actors.find((x) => x.id === id); if (a) a.frozen = false; },
    // QA 钩子：实体在页面上的坐标(身形中部，便于真实点击)
    screenPos(id) {
      const r = canvas.getBoundingClientRect();
      if (id === 'player') return { x: r.left + player.x - cam.x, y: r.top + player.y - cam.y - player.h / 2 };
      const a = actors.find((x) => x.id === id);
      if (a) return { x: r.left + a.wx - cam.x, y: r.top + a.wy - cam.y - a.h / 2 };
      const p = portals.find((x) => x.id === id);
      if (p) return { x: r.left + p.x * S - cam.x, y: r.top + p.y * S - cam.y };
      return null;
    },
    hide() { wrap.style.display = 'none'; },
    show() { wrap.style.display = ''; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      wrap.remove();
    },
  };
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
