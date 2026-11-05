// 梦幻式场景：可走大地图 + 跟随镜头 + 点地寻路 + NPC/明雷妖怪/传送阵 + 小地图。
// 只管画与走;任务、对话、开战由 hub.js 通过回调决定。

import {
  SCENES,
  MAP_SCALE,
  GRID,
  NAME_COLORS,
  WORLD_SPRITE_META,
  worldActorBounds,
  worldDepthScale,
  worldSpriteGeometry,
} from './world.js';
import { audio } from './audio.js';
import { worldImage, mapTexture } from './assets.js';
import { createNavigation, findInteractionPath } from './world-navigation.js';
import { createMapRenderer } from './map-renderer.js';

const DEFAULT_FOLLOWERS = ['tang', 'bajie', 'sha'];
const FOLLOWER_OFFSETS = [[115, -22], [230, 20], [345, -18]];
// 立绘原本朝左的单位(其余朝右);行走时据此决定是否镜像
const ART_FACES_LEFT = new Set(['wukong', 'pixie']);

export function runScene(ctx) {
  // ctx: {root, sceneId, spawn:[x,y](原图像素), fast, onActor(id), onPortal(id), onLandmark(id), onFrame(info), minimap:canvas}
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
  const initialDensity = Math.min(2, window.devicePixelRatio || 1);
  const mapRenderer = createMapRenderer(scene, { scale: S, density: initialDensity, textureImage: mapTexture });
  const showNavigation = new URLSearchParams(window.location.search).get('nav') === '1';

  // ---------- 可走网格 ----------
  const navigation = createNavigation({
    size: scene.size,
    walk: scene.walk,
    paths: scene.paths,
    blockers: scene.blockers,
    clearance: scene.clearance,
    scale: S,
    grid: GRID,
  });
  const { cellOf, isWalkableCell: isWalk, findPath } = navigation;

  // ---------- 实体 ----------
  const requestedSpawn = (ctx.spawn ?? scene.spawn).map((v) => v * S);
  const spawn = navigation.normalizePoint(...requestedSpawn) ?? requestedSpawn;
  const player = { id: 'player', unit: 'wukong', name: '孙悟空', title: '齐天大圣', x: spawn[0], y: spawn[1], h: 142, path: [], facing: 1, moving: false, kind: 'player' };
  const trail = [];
  const followers = (ctx.followers ?? DEFAULT_FOLLOWERS).map((unit, i) => {
    const [behind, offsetY] = FOLLOWER_OFFSETS[i];
    const desired = [spawn[0] - behind, spawn[1] + offsetY];
    const foot = navigation.normalizePoint(...desired) ?? spawn;
    return {
      unit,
      name: { tang: '唐僧', bajie: '猪八戒', sha: '沙悟净' }[unit],
      x: foot[0],
      y: foot[1],
      h: unit === 'tang' ? 130 : 136,
      facing: 1,
      moving: false,
      kind: 'party',
      route: [],
      routeGoal: foot,
      routeRetry: 0,
    };
  });
  let actors = [];      // hub 提供:{id, unit, name, title, x, y(原图像素), h, mark, kind:'npc'|'demon', wander}
  let portals = [];     // {id, to, x, y, label, locked}
  let landmarks = Object.entries(scene.landmarks ?? {}).map(([id, landmark]) => ({ id, ...landmark, x: landmark.at[0], y: landmark.at[1], visited: false }));
  let hoveredLandmarkId = null;
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
    mapRenderer.setDensity(dpr);
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
    // 右下图标栏与底边历练条也算 HUD：传送阵字、气泡与镜头避让都不压到它们下面
    hudRects = [...document.querySelectorAll('.world-hud .hud-map, .world-hud .hud-cards, .world-hud .hud-tracker, .world-hud .hud-chat, .world-hud .hud-exp, #topbar')]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ l: r.left - cr.left - 8, t: r.top - cr.top - 8, r: r.right - cr.left + 8, b: r.bottom - cr.top + 8 }));
  }
  const hudAt = (box) => hudRects.find((h) => box.l < h.r && box.r > h.l && box.t < h.b && box.b > h.t);
  const hits = (box) => !!hudAt(box);
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
        const bounds = worldActorBounds(presentation({ ...a, x: a.wx, y: a.wy }).geometry);
        const box = { l: bounds.left - c.x, r: bounds.right - c.x, t: bounds.top - c.y, b: bounds.bottom - c.y + 22 };
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

  function presentation(e) {
    const source = worldImage(e.unit);
    const image = source.image;
    const metadata = source.dedicated
      ? (WORLD_SPRITE_META[e.unit] ?? { anchorX: 0.5, anchorY: 0.93, bodyTop: 0.08, facesLeft: false })
      : { anchorX: 0.5, anchorY: 0.97, bodyTop: 0.02, facesLeft: ART_FACES_LEFT.has(e.unit) };
    const depthScale = worldDepthScale(e.y, WH);
    const imageWidth = image?.width ?? 200;
    const imageHeight = image?.height ?? 280;
    return {
      source,
      metadata,
      geometry: worldSpriteGeometry({
        groundX: e.x,
        groundY: e.y,
        bodyHeight: e.h,
        imageWidth,
        imageHeight,
        metadata,
        depthScale,
      }),
    };
  }

  function legalizePlayerPosition() {
    if (!navigation.isPointWalkable(player.x, player.y)) {
      const legalStart = navigation.normalizePoint(player.x, player.y);
      if (!legalStart) return false;
      [player.x, player.y] = legalStart;
      trail.length = 0;
    }
    return true;
  }

  function walkTo(wx, wy) {
    if (!legalizePlayerPosition()) { player.path = []; return false; }
    const path = findPath(player.x, player.y, wx, wy);
    player.path = path;
    return path.length > 0;
  }

  function walkToInteraction(targetX, targetY, candidates, reach) {
    if (!legalizePlayerPosition()) { player.path = []; return false; }
    player.path = findInteractionPath(navigation, {
      from: [player.x, player.y],
      target: [targetX, targetY],
      candidates,
      reach,
    });
    return player.path.length > 0;
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
    a.frozen = true; // 被点名的明雷妖怪停步等你
    // 站到对方身侧一步开外(约 110px),不贴脸、不踩到对方名牌
    const side = player.x < a.wx ? -1 : 1;
    const candidates = [
      [a.wx + side * 110, a.wy + 14],
      [a.wx - side * 110, a.wy + 14],
      [a.wx, a.wy - 110],
      [a.wx, a.wy + 110],
    ];
    if (!walkToInteraction(a.wx, a.wy, candidates, 210)) { a.frozen = false; return false; }
    pendingAct = { type: 'actor', id };
    return true;
  }

  function approachPortal(id) {
    const p = portals.find((x) => x.id === id);
    if (!p) return false;
    dropPending();
    const target = [p.x * S, p.y * S];
    const candidates = [target, [target[0] - 100, target[1]], [target[0] + 100, target[1]], [target[0], target[1] - 100], [target[0], target[1] + 100]];
    if (!walkToInteraction(target[0], target[1], candidates, 150)) return false;
    pendingAct = { type: 'portal', id };
    return true;
  }

  function approachLandmark(id) {
    const landmark = landmarks.find((candidate) => candidate.id === id);
    if (!landmark) return false;
    dropPending();
    const width = landmark.footprint?.[0] ?? 70;
    const height = landmark.footprint?.[1] ?? 58;
    const side = player.x < landmark.wx ? -1 : 1;
    const horizontal = width * S / 2 + 62;
    const vertical = height * S / 2 + 62;
    const candidates = [
      [landmark.wx + side * horizontal, landmark.wy + 18],
      [landmark.wx - side * horizontal, landmark.wy + 18],
      [landmark.wx, landmark.wy - vertical],
      [landmark.wx, landmark.wy + vertical],
    ];
    const reach = Math.max(190, width / 2 + 100) * S;
    if (!walkToInteraction(landmark.wx, landmark.wy, candidates, reach)) return false;
    pendingAct = { type: 'landmark', id };
    return true;
  }

  // 点击区从脚下一直到头顶的「!」(约 70px 高)
  function hitActor(wx, wy) {
    const found = actors.filter((a) => {
      const bounds = worldActorBounds(presentation({ ...a, x: a.wx, y: a.wy }).geometry);
      return wx >= bounds.left && wx <= bounds.right && wy >= bounds.top && wy <= bounds.bottom;
    });
    return found.sort((a, b) => b.wy - a.wy)[0] ?? null;
  }

  function hitPortal(wx, wy) {
    return portals.find((p) => Math.hypot((p.x * S - wx) / 1.6, p.y * S - wy) < 52) ?? null;
  }

  // 阵名字画在阵上方(或下方)，点字也算点阵：屏幕坐标对上一帧画出的字框
  function hitPortalLabel(sx, sy) {
    return portals.find((p) => p.labelBox && sx >= p.labelBox.l - 4 && sx <= p.labelBox.r + 4 && sy >= p.labelBox.t - 4 && sy <= p.labelBox.b + 4) ?? null;
  }

  function hitLandmark(wx, wy) {
    return landmarks.find((landmark) => {
      const [width, height] = landmark.footprint ?? [82, 58];
      return Math.abs(wx - landmark.wx) <= width * S / 2 && Math.abs(wy - landmark.wy) <= height * S / 2;
    }) ?? null;
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
    const landmark = hitLandmark(wx, wy);
    if (landmark) { audio.sfx('click'); approachLandmark(landmark.id); return; }
    dropPending();
    ctx.onManualMove?.();
    const accepted = walkTo(wx, wy);
    const endpoint = player.path.at(-1);
    ripples.push({ x: accepted && endpoint ? endpoint[0] : wx, y: accepted && endpoint ? endpoint[1] : wy, t: 0, rejected: !accepted });
  }
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    const wx = ev.clientX - r.left + cam.x, wy = ev.clientY - r.top + cam.y;
    const landmark = hitLandmark(wx, wy);
    hoveredLandmarkId = landmark?.id ?? null;
    canvas.style.cursor = hitActor(wx, wy) || hitPortalLabel(ev.clientX - r.left, ev.clientY - r.top) || hitPortal(wx, wy) || landmark ? 'pointer' : '';
  });
  canvas.addEventListener('mouseleave', () => { hoveredLandmarkId = null; });

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
      const landmark = landmarks.filter((x) => near(x, 210)).sort((x, y) => Math.hypot(x.wx - player.x, x.wy - player.y) - Math.hypot(y.wx - player.x, y.wy - player.y))[0];
      if (a) approachActor(a.id);
      else if (landmark) approachLandmark(landmark.id);
      if (a || landmark) ev.preventDefault();
    }
  }
  window.addEventListener('keydown', onKey);

  function arrive() {
    const act = pendingAct;
    pendingAct = null;
    if (!act) return;
    if (act.type === 'actor') {
      const a = actors.find((x) => x.id === act.id);
      if (a && near(a, 210) && navigation.lineClear(player.x, player.y, a.wx, a.wy)) {
        player.facing = a.wx >= player.x ? 1 : -1;
        ctx.onActor?.(act.id);
      } else if (a) a.frozen = false;
    } else if (act.type === 'portal') {
      const p = portals.find((x) => x.id === act.id);
      if (p && Math.hypot(p.x * S - player.x, p.y * S - player.y) < 150
        && navigation.lineClear(player.x, player.y, p.x * S, p.y * S)) ctx.onPortal?.(act.id);
    } else {
      const landmark = landmarks.find((x) => x.id === act.id);
      const reach = landmark ? Math.max(190, (landmark.footprint?.[0] ?? 82) / 2 + 100) * S : 0;
      if (landmark && near(landmark, reach)
        && navigation.lineClear(player.x, player.y, landmark.wx, landmark.wy)) ctx.onLandmark?.(act.id);
    }
  }

  // ---------- 逐帧 ----------
  function moveAlong(ent, dt) {
    if (!ent.path.length) { ent.moving = false; return false; }
    const [tx, ty] = ent.path[0];
    if (!navigation.lineClear(ent.x, ent.y, tx, ty)) {
      ent.path = [];
      ent.moving = false;
      dropPending();
      return false;
    }
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

  function followerWaypoint(follower, goalX, goalY, dt) {
    follower.routeRetry = Math.max(0, follower.routeRetry - dt);
    if (navigation.lineClear(follower.x, follower.y, goalX, goalY)) {
      follower.route = [];
      follower.routeGoal = [goalX, goalY];
      return [goalX, goalY];
    }

    while (follower.route.length && Math.hypot(follower.route[0][0] - follower.x, follower.route[0][1] - follower.y) < 5) follower.route.shift();
    const goalMoved = Math.hypot(goalX - follower.routeGoal[0], goalY - follower.routeGoal[1]) > 70;
    const routeBlocked = follower.route.length
      && !navigation.lineClear(follower.x, follower.y, follower.route[0][0], follower.route[0][1]);
    if (routeBlocked) follower.route = [];
    if (goalMoved || routeBlocked || (!follower.route.length && follower.routeRetry <= 0)) {
      follower.route = navigation.findPath(follower.x, follower.y, goalX, goalY);
      follower.routeGoal = [goalX, goalY];
      follower.routeRetry = 0.28;
    }
    const waypoint = follower.route[0];
    return waypoint && navigation.lineClear(follower.x, follower.y, waypoint[0], waypoint[1]) ? waypoint : null;
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
    // 站定时：随从在主角身后错落排开，不挤到 NPC 身上。
    const settled = !player.moving;
    const backDir = -player.facing;
    followers.forEach((f, i) => {
      const idx = trail.length - 1 - (i + 1) * 9;
      let [gx, gy] = idx >= 0 ? trail[idx] : [f.x, f.y];
      if (settled) {
        const [behind, offsetY] = FOLLOWER_OFFSETS[i];
        const ax = player.x + backDir * behind, ay = player.y + offsetY;
        const [c, r] = cellOf(ax, ay);
        const clear = !actors.some((a) => Math.abs(a.wx - ax) < 70 && Math.abs(a.wy - ay) < 60);
        if (isWalk(c, r) && clear) { gx = ax; gy = ay; }
      }
      const waypoint = followerWaypoint(f, gx, gy, dt);
      if (!waypoint) { f.moving = false; return; }
      const dx = waypoint[0] - f.x, dy = waypoint[1] - f.y;
      const d = Math.hypot(dx, dy);
      f.moving = d > 3;
      if (Math.abs(dx) > 2) f.facing = dx > 0 ? 1 : -1;
      const k = ctx.fast
        ? Math.min(1, dt * 6)
        : Math.min(1, (speed * 1.2 * dt) / Math.max(1, d));
      const nextX = f.x + dx * k, nextY = f.y + dy * k;
      if (navigation.lineClear(f.x, f.y, nextX, nextY)) {
        f.x = nextX;
        f.y = nextY;
      } else {
        f.route = [];
        f.routeRetry = 0;
        f.moving = false;
      }
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
        const targetX = (c + 0.5) * GRID;
        const targetY = (r + 0.5) * GRID;
        if (isWalk(c, r) && navigation.lineClear(a.wx, a.wy, targetX, targetY)) { a.tx = targetX; a.ty = targetY; }
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
    const { source, metadata, geometry } = presentation(e);
    const img = source.image;
    const h = geometry.bodyHeight;
    const gait = e.moving ? Math.sin(now / 105) : 0;
    const lift = e.moving ? -Math.abs(gait) * 1.4 : 0;
    const sway = e.moving ? gait * 1.2 : 0;
    const x = e.x - cam.x, y = e.y - cam.y;
    g.save();
    // 径向渐变保留柔和接地影，避免每个人物的 blur 反复滤完整画布。
    g.save();
    g.translate(x + h * 0.035, y + 2);
    g.scale(h * 0.24, h * 0.05);
    const shadow = g.createRadialGradient(-0.14, 0, 0, 0, 0, 1);
    shadow.addColorStop(0, 'rgba(20,12,6,0.27)');
    shadow.addColorStop(0.45, 'rgba(20,12,6,0.12)');
    shadow.addColorStop(1, 'rgba(20,12,6,0)');
    g.fillStyle = shadow;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.translate(x + sway, y + lift);
    const flip = (e.facing < 0) !== !!metadata.facesLeft;
    g.scale(flip ? -1 : 1, 1);
    if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = 18; }
    if (img) {
      g.drawImage(
        img,
        -metadata.anchorX * geometry.width,
        -metadata.anchorY * geometry.height,
        geometry.width,
        geometry.height,
      );
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

  // 名牌互不相压：两人站得近时，后画的那块往下让一格(随从停步时「猪八戒」「沙悟净」不再叠成一团)
  let nameBoxes = [];
  function drawNames(e, color) {
    const x = e.x - cam.x;
    let y = e.y - cam.y;
    g.font = 'bold 15px "Songti SC", "STSong", serif';
    const w = Math.max(g.measureText(e.name).width, e.title ? g.measureText(e.title).width * 0.8 : 0) + 6;
    const h = e.title ? 36 : 20;
    const boxAt = (top) => ({ l: x - w / 2, r: x + w / 2, t: top, b: top + h });
    for (let tries = 0; tries < 4; tries += 1) {
      const box = boxAt(y + 6);
      const clash = nameBoxes.find((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t);
      if (!clash) break;
      y = clash.b - 6 + 2;
    }
    nameBoxes.push(boxAt(y + 6));
    if (e.title) label(e.title, x, y + 6, '#9fd8ff', 12);
    label(e.name, x, y + (e.title ? 22 : 8), color, 15);
  }

  function drawMark(e, mark, now) {
    const geometry = presentation(e).geometry;
    const x = e.x - cam.x, y = geometry.bodyTop - cam.y - 26 - Math.abs(Math.sin(now / 260)) * 8;
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
    const geometry = presentation(e).geometry;
    g.font = '15px "Songti SC", "STSong", serif';
    const w = Math.min(260, g.measureText(text).width + 22);
    // 人站在屏幕边上时气泡往里收，整句话都看得见
    const x = Math.max(8, Math.min(cam.vw - w - 8, e.x - cam.x - w / 2));
    const y = Math.max(8, geometry.bodyTop - cam.y - 64);
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

  function drawLandmark(landmark, now) {
    const x = landmark.wx - cam.x;
    const y = landmark.wy - cam.y;
    const pulse = 1 + Math.sin(now / 420) * 0.08;
    const color = landmark.visited ? 'rgba(76,151,137,' : 'rgba(229,184,67,';
    g.save();
    g.strokeStyle = `${color}${landmark.visited ? 0.52 : 0.82})`;
    g.lineWidth = landmark.visited ? 1.5 : 2;
    g.beginPath();
    g.ellipse(x, y, 28 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
    g.stroke();
    if (!landmark.visited) {
      const glint = (now / 900 + landmark.id.length * 0.17) % 1;
      g.fillStyle = `rgba(255,239,155,${Math.sin(glint * Math.PI) * 0.75})`;
      g.beginPath();
      g.arc(x + (glint - 0.5) * 38, y - 9 - Math.sin(glint * Math.PI) * 7, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawLandmarkLabel(landmark) {
    const nearby = Math.hypot(landmark.wx - player.x, landmark.wy - player.y) < 240;
    if (hoveredLandmarkId !== landmark.id && !nearby && !(pendingAct?.type === 'landmark' && pendingAct.id === landmark.id)) return;
    const x = landmark.wx - cam.x;
    const y = landmark.wy - cam.y;
    const [footprintWidth] = landmark.footprint ?? [82, 58];
    g.font = 'bold 13px "Songti SC", "STSong", serif';
    const width = g.measureText(landmark.name).width + 8;
    const sideOffset = footprintWidth * S / 2 + width / 2 + 10;
    const candidates = [
      { x, y: y - 38 },
      { x: x - sideOffset, y: y - 9 },
      { x: x + sideOffset, y: y - 9 },
    ];
    for (const candidate of candidates) {
      const box = { l: candidate.x - width / 2, r: candidate.x + width / 2, t: candidate.y - 2, b: candidate.y + 18 };
      if (box.l < 8 || box.r > cam.vw - 8 || box.t < 8 || box.b > cam.vh - 8
        || hits(box) || overLandmarkEntity(box)) continue;
      label(landmark.name, candidate.x, candidate.y, landmark.visited ? '#9ad8ca' : '#ffe07a', 13);
      return;
    }
  }

  // 传送阵字:对白/菜单打开时不画;压到 HUD 或 NPC/妖怪(身子+头顶标记+名牌,与 hitActor 同一块点击区)
  // 就挪到阵下方,再不行就不画(小地图上仍有阵眼)——字永远不盖人,点人永远点得到人
  const overActor = (box) => actors.some((a) => {
    const bounds = worldActorBounds(presentation({ ...a, x: a.wx, y: a.wy }).geometry);
    const screen = { l: bounds.left - cam.x, r: bounds.right - cam.x, t: bounds.top - cam.y, b: bounds.bottom - cam.y };
    return box.l < screen.r && box.r > screen.l && box.t < screen.b && box.b > screen.t;
  });
  const landmarkEntityScreenBox = (entity) => {
    const geometry = presentation(entity).geometry;
    const bounds = worldActorBounds(geometry);
    return {
      l: bounds.left - cam.x,
      r: bounds.right - cam.x,
      t: bounds.top - cam.y,
      b: Math.max(bounds.bottom, geometry.anchorY + 42) - cam.y,
    };
  };
  const overLandmarkEntity = (box) => [
    ...actors.map((actor) => ({ ...actor, x: actor.wx, y: actor.wy })),
    player,
    ...followers,
  ].some((entity) => {
    const screen = landmarkEntityScreenBox(entity);
    return box.l < screen.r && box.r > screen.l && box.t < screen.b && box.b > screen.t;
  });
  function drawPortalLabel(p) {
    const x = p.x * S - cam.x, y = p.y * S - cam.y;
    p.labelBox = null;
    if (document.body.classList.contains('dlg-open') || document.body.classList.contains('modal-open') || document.querySelector('.npc-menu')) return;
    const text = p.locked ? `${p.label}（未开）` : `→ ${p.label}`;
    g.font = 'bold 15px "Songti SC", "STSong", serif';
    const w = g.measureText(text).width + 8;
    const boxAt = (lx, ly) => ({ l: lx - w / 2, r: lx + w / 2, t: ly - 2, b: ly + 20 });
    for (const ly of [y - 52, y + 22]) {
      let lx = Math.max(w / 2 + 12, Math.min(cam.vw - w / 2 - 12, x));
      // 压到角落的 HUD(右下图标栏等)就让到它左边
      const blocker = hudAt(boxAt(lx, ly));
      if (blocker) lx = blocker.l - w / 2 - 4;
      const box = boxAt(lx, ly);
      if (lx < w / 2 + 12 || ly < 8 || ly > cam.vh - 26 || hits(box) || overActor(box)) continue;
      label(text, lx, ly, p.locked ? '#c9c9c9' : NAME_COLORS.portal, 15);
      p.labelBox = box;
      return;
    }
  }

  function drawMinimap(now) {
    const mm = ctx.minimap;
    if (!mm || !mm.isConnected) return;
    const mg = mm.getContext('2d');
    mg.clearRect(0, 0, mm.width, mm.height);
    const { k, ox, oy } = mapRenderer.drawPreview(mg, mm.width, mm.height);
    mg.strokeStyle = 'rgba(255,255,255,0.8)';
    mg.lineWidth = 1;
    mg.strokeRect(ox + cam.x * k, oy + cam.y * k, cam.vw * k, cam.vh * k);
    const dot = (x, y, c, r = 3) => { mg.fillStyle = c; mg.beginPath(); mg.arc(ox + x * k, oy + y * k, r, 0, Math.PI * 2); mg.fill(); };
    for (const p of portals) dot(p.x * S, p.y * S, p.locked ? '#aaa' : '#5ef0ff', 3.5);
    for (const landmark of landmarks) dot(landmark.wx, landmark.wy, landmark.visited ? '#63c8b2' : '#f0c64d', landmark.visited ? 2.2 : 3);
    for (const a of actors) dot(a.wx, a.wy, a.kind === 'demon' ? '#ff5a3c' : a.mark ? '#ffd23a' : '#fff1a0', a.mark ? 4 : 2.6);
    dot(player.x, player.y, '#5cff5c', 3.5 + Math.abs(Math.sin(now / 300)));
    mm.dataset.k = String(k); mm.dataset.ox = String(ox); mm.dataset.oy = String(oy);
  }

  function drawRoute() {
    if (!player.path.length) return;
    g.save();
    g.strokeStyle = 'rgba(255,232,152,0.72)';
    g.lineWidth = 1.5;
    g.setLineDash([6, 7]);
    g.beginPath();
    g.moveTo(player.x - cam.x, player.y - cam.y);
    for (const [x, y] of player.path) g.lineTo(x - cam.x, y - cam.y);
    g.stroke();
    g.setLineDash([]);
    const [endX, endY] = player.path.at(-1);
    g.strokeStyle = 'rgba(255,235,164,0.92)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(endX - cam.x, endY - cam.y, 9, 4, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
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
    mapRenderer.drawTerrain(g, cam);
    drawRoute();
    for (const rp of ripples) {
      g.strokeStyle = rp.rejected
        ? `rgba(255,82,62,${1 - rp.t / 0.7})`
        : `rgba(255,240,170,${1 - rp.t / 0.7})`;
      g.lineWidth = 2;
      g.beginPath();
      if (rp.rejected) g.arc(rp.x - cam.x, rp.y - cam.y, 8 + rp.t * 32, 0, Math.PI * 2);
      else g.ellipse(rp.x - cam.x, rp.y - cam.y, 8 + rp.t * 40, (8 + rp.t * 40) * 0.4, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (showNavigation) mapRenderer.drawDebug(g, cam);
    for (const landmark of landmarks) drawLandmark(landmark, now);
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
    const namedDrawables = drawables.filter((d) => d.kind !== 'scenery');
    const namesOrder = [...namedDrawables.filter((d) => d.kind === 'party' || d.kind === 'player'), ...namedDrawables.filter((d) => d.kind !== 'party' && d.kind !== 'player')];
    nameBoxes = [];
    for (const d of namesOrder) {
      const color = d.kind === 'player' ? NAME_COLORS.player : d.kind === 'party' ? NAME_COLORS.party : d.kind === 'demon' ? NAME_COLORS.demon : NAME_COLORS.npc;
      drawNames(d.e, color);
      if (d.src?.mark) drawMark(d.e, d.src.mark, now);
    }
    for (const p of portals) drawPortalLabel(p);
    for (const landmark of landmarks) drawLandmarkLabel(landmark);
    for (const d of namedDrawables) {
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
      return { facing: -1, ...a, h: a.h, wx, wy, hx: wx, hy: wy, tx: wx, ty: wy, wt: 0, seed: (a.seed ?? 7) >>> 0, frozen: false };
    });
  }

  function syncLandmarks(list) {
    hoveredLandmarkId = null;
    landmarks = (list ?? []).map((landmark) => ({
      ...landmark,
      wx: landmark.x * S,
      wy: landmark.y * S,
      footprint: landmark.footprint ?? [82, 58],
    }));
  }
  syncLandmarks(landmarks);

  return {
    sceneId: scene.id,
    setActors: syncActors,
    setPortals(list) { portals = list; },
    setLandmarks: syncLandmarks,
    setBusy(b) { busy = b; if (b) { player.path = []; dropPending(); } },
    stopWalking() { player.path = []; dropPending(); },
    approachActor,
    approachPortal,
    approachLandmark,
    walkToMinimap(px, py) {
      const mm = ctx.minimap;
      const k = Number(mm.dataset.k), ox = Number(mm.dataset.ox), oy = Number(mm.dataset.oy);
      if (!k) return;
      dropPending();
      const wx = (px - ox) / k;
      const wy = (py - oy) / k;
      const accepted = walkTo(wx, wy);
      if (!accepted) ripples.push({ x: wx, y: wy, t: 0, rejected: true });
    },
    bark(id, text, ms = 3600) { bubbles.set(id, { text, until: performance.now() + ms }); },
    hasMember: (unit) => player.unit === unit || followers.some((f) => f.unit === unit),
    levelUpFx() { fxLevelUntil = performance.now() + 1600; },
    unfreeze(id) { const a = actors.find((x) => x.id === id); if (a) a.frozen = false; },
    spatialSnapshot() {
      return {
        time: performance.now(),
        sceneId: scene.id,
        player: { x: player.x, y: player.y, moving: player.moving, path: player.path.map(([x, y]) => [x, y]) },
        followers: followers.map((follower) => ({
          id: follower.unit,
          x: follower.x,
          y: follower.y,
          moving: follower.moving,
        })),
        camera: { x: cam.x, y: cam.y, vw: cam.vw, vh: cam.vh },
        scale: S,
      };
    },
    // QA 钩子：实体在页面上的坐标(身形中部，便于真实点击)
    screenPos(id) {
      const r = canvas.getBoundingClientRect();
      if (id === 'player') {
        const geometry = presentation(player).geometry;
        return { x: r.left + geometry.anchorX - cam.x, y: r.top + (geometry.bodyTop + geometry.bodyBottom) / 2 - cam.y };
      }
      const a = actors.find((x) => x.id === id);
      if (a) {
        const geometry = presentation({ ...a, x: a.wx, y: a.wy }).geometry;
        return { x: r.left + geometry.anchorX - cam.x, y: r.top + (geometry.bodyTop + geometry.bodyBottom) / 2 - cam.y };
      }
      const p = portals.find((x) => x.id === id);
      if (p) return { x: r.left + p.x * S - cam.x, y: r.top + p.y * S - cam.y };
      const landmark = landmarks.find((x) => x.id === id);
      if (landmark) return { x: r.left + landmark.wx - cam.x, y: r.top + landmark.wy - cam.y };
      return null;
    },
    // 隐藏即停帧：战斗与寻宝期间不在底下逐帧绘制
    hide() { wrap.style.display = 'none'; cancelAnimationFrame(raf); raf = 0; },
    show() {
      wrap.style.display = '';
      if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      mapRenderer.dispose();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      wrap.remove();
    },
  };
}
