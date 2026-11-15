// 可走场景：把四块绘景拼成一幅地图，画人物、名字、传送阵与引路线，处理点地行走与方向键。
// 只管「看见与走动」；谁在场、点了谁之后发生什么，由外面的 hub 决定。

import { SCENES, MAP_SIZE, MAP_PX_PER_UNIT, WALK_ART, WALK_SHEETS, WALK_SHEET_CELL } from '../data/maps.js';
import { mapArt, walkArt, walkSheet, uiArt } from '../data/art.js';
import { image } from '../core/assets.js';
import { createNav } from '../rules/nav.js';
import { audio } from '../core/audio.js';
import { pace } from '../core/dom.js';

// 封妖令的头顶记号用卷轴图标，不拿「令」字当图标
let markIcon = null;
image(uiArt('quest')).then((img) => { markIcon = img; }).catch(() => {});

const PX_PER_UNIT = MAP_PX_PER_UNIT; // 绘景底图每地图单位的像素
const WALK_SPEED = 300; // 地图单位/秒
const REACH = 96; // 走到离人这么近就算到了
const TRAIL_GAP = 72;
const NAME_COLOR = { hero: '#9dff8a', party: '#dff5d2', npc: '#ffe66b', foe: '#ff7a63', portal: '#8af1ff', spot: '#bfeee0' };
const FONT = '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC","SimSun",serif';
const navCache = new Map();

export function navFor(sceneId) {
  if (!navCache.has(sceneId)) navCache.set(sceneId, createNav(SCENES[sceneId], MAP_SIZE));
  return navCache.get(sceneId);
}

// 场景底图：一张整幅绘景画进离屏画布，每帧只按相机窗口拷贝
async function composeMap(sceneId) {
  const art = await image(mapArt(sceneId));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(MAP_SIZE[0] * PX_PER_UNIT);
  canvas.height = Math.round(MAP_SIZE[1] * PX_PER_UNIT);
  canvas.getContext('2d').drawImage(art, 0, 0, canvas.width, canvas.height);
  const mini = document.createElement('canvas');
  mini.width = 300; mini.height = 200;
  mini.getContext('2d').drawImage(canvas, 0, 0, 300, 200);
  return { canvas, mini };
}

const AMBIENT = {
  village: { kind: 'ember', n: 26, color: [255, 190, 110] },
  cuiyun: { kind: 'leaf', n: 20, color: [150, 215, 150] },
  huokou: { kind: 'spark', n: 46, color: [255, 150, 70] },
  jilei: { kind: 'leaf', n: 18, color: [225, 120, 100] },
};

export function createWorld(root, handlers) {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  canvas.tabIndex = 0;
  root.append(canvas);
  const ctx = canvas.getContext('2d');
  const sprites = new Map();
  let scene = null, nav = null, map = null, raf = 0, last = 0, running = false, clock = 0;
  let view = { w: 0, h: 0, dpr: 1, zoom: 1, cx: 0, cy: 0 };
  let hero = null, followers = [], actors = [], portals = [], spots = [], motes = [];
  let trail = [], route = [], goal = null, guide = null, hover = null, bubbles = [], puffs = [];
  let followerKeys = [];
  let restT = 0;
  const keys = new Set();
  let inputLocked = false;

  function load(id, src) {
    if (!sprites.has(id)) { sprites.set(id, null); image(src).then((img) => sprites.set(id, img)).catch(() => {}); }
    return sprites.get(id);
  }
  function sprite(key) {
    if (WALK_SHEETS[key]) { load(`${key}/front`, walkSheet(key, 'front')); load(`${key}/back`, walkSheet(key, 'back')); }
    return load(key, walkArt(key));
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = Math.max(320, rect.width); view.h = Math.max(320, rect.height);
    canvas.width = Math.round(view.w * view.dpr); canvas.height = Math.round(view.h * view.dpr);
    view.zoom = Math.max(0.6, Math.min(1.3, Math.max(view.w / 1300, view.h / 880)));
  }

  const toScreen = (x, y) => [(x - view.cx) * view.zoom + view.w / 2, (y - view.cy) * view.zoom + view.h / 2];
  const toMap = (sx, sy) => [(sx - view.w / 2) / view.zoom + view.cx, (sy - view.h / 2) / view.zoom + view.cy];
  const depthScale = (y) => 0.9 + Math.max(0, Math.min(1, y / MAP_SIZE[1])) * 0.16;

  function makeActor(spec) {
    return {
      ...spec, x: spec.x, y: spec.y, home: [spec.x, spec.y], flip: false, phase: Math.random() * 6, moving: false,
      wanderT: 1 + Math.random() * 2, wanderTo: null, appear: 0,
    };
  }

  function placeParty(x, y) {
    hero = makeActor({ id: 'hero', art: 'wukong', name: '孙悟空', title: '齐天大圣', kind: 'hero', h: 122, x, y });
    hero.appear = 1;
    followers = followerKeys.map((key, i) => {
      const f = makeActor({ id: `f-${key}`, art: key, name: { tang: '唐僧', bajie: '猪八戒', sha: '沙悟净' }[key], kind: 'party', h: { tang: 122, bajie: 120, sha: 126 }[key], x: x + [-78, -38, 62][i % 3], y: y + [-22, 46, 36][i % 3] });
      f.appear = 1;
      const p = nav.nearest(f.x, f.y) ?? [x, y];
      f.x = p[0]; f.y = p[1];
      return f;
    });
    trail = [[x, y]];
    route = []; goal = null;
  }

  async function enter(sceneId, { at = null, party = ['tang', 'bajie', 'sha'] } = {}) {
    scene = SCENES[sceneId];
    nav = navFor(sceneId);
    followerKeys = party;
    map = null;
    const start = nav.nearest(...(at ?? scene.spawn));
    placeParty(start[0], start[1]);
    actors = []; portals = []; spots = []; bubbles = []; puffs = []; guide = null; hover = null;
    const amb = AMBIENT[sceneId];
    motes = Array.from({ length: amb.n }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * 6.28 }));
    view.cx = start[0] + lead(); view.cy = start[1];
    clampCamera();
    map = await composeMap(sceneId);
    for (const key of ['wukong', ...party]) sprite(key);
  }

  function setActors(list) {
    const old = new Map(actors.map((a) => [a.id, a]));
    actors = list.map((spec) => {
      const prev = old.get(spec.id);
      const a = prev ? Object.assign(prev, spec, { x: prev.x, y: prev.y }) : makeActor(spec);
      sprite(a.art);
      return a;
    });
  }
  function setPortals(list) { portals = list; }
  function setSpots(list) { spots = list; }

  const lead = () => (view.w > 700 ? 150 / view.zoom : 0);
  function clampCamera() {
    const hw = view.w / 2 / view.zoom, hh = view.h / 2 / view.zoom;
    view.cx = hw * 2 >= MAP_SIZE[0] ? MAP_SIZE[0] / 2 : Math.max(hw, Math.min(MAP_SIZE[0] - hw, view.cx));
    view.cy = hh * 2 >= MAP_SIZE[1] ? MAP_SIZE[1] / 2 : Math.max(hh, Math.min(MAP_SIZE[1] - hh, view.cy));
  }

  // ---------- 行走 ----------
  function walkTo(x, y, then = null) {
    const pts = nav.path([hero.x, hero.y], [x, y]);
    route = pts;
    goal = pts.length ? { then, reach: 0 } : null;
    if (!pts.length && then) then();
    return pts.length > 0;
  }

  // 走到某人或某处跟前；到了调用 then
  function approach(tx, ty, then, reach = REACH) {
    if (Math.hypot(hero.x - tx, hero.y - ty) <= reach + 8) { route = []; goal = null; face(tx); then?.(); return true; }
    const pts = nav.path([hero.x, hero.y], [tx, ty]);
    if (!pts.length) { then?.(); return false; }
    route = pts;
    goal = { then, reach, tx, ty };
    return true;
  }
  // 追上某个人：游走的人被点中就停步等着，悟空按他此刻的位置走过去
  function chase(a, then) {
    if (a.wander) { a.held = true; a.wanderTo = null; }
    return approach(a.x, a.y, then);
  }
  const release = () => { for (const a of actors) a.held = false; };
  const face = (tx) => { if (Math.abs(tx - hero.x) > 4) hero.flip = tx < hero.x; };
  // 朝向：左右翻面；主要往画面上方走时换背身图
  const heading = (who, dx, dy) => { if (Math.abs(dx) > 2) who.flip = dx < 0; who.away = dy < -Math.abs(dx) * 0.6; };
  function stop() { route = []; goal = null; }

  function stepHero(dt) {
    let moved = false;
    const speed = WALK_SPEED * (pace.base < 1 ? 2.6 : 1);
    if (!inputLocked && keys.size) {
      let dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      let dy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
      if (dx || dy) {
        stop(); guide = null; release();
        const len = Math.hypot(dx, dy);
        const [nx, ny] = nav.slide(hero.x, hero.y, (dx / len) * speed * dt, (dy / len) * speed * dt * 0.82);
        moved = nx !== hero.x || ny !== hero.y;
        heading(hero, dx * 10, dy * 10);
        hero.x = nx; hero.y = ny;
        if (moved) handlers.onMove?.();
      }
    }
    let budget = speed * dt;
    while (route.length && budget > 0) {
      if (goal?.reach && Math.hypot(hero.x - goal.tx, hero.y - goal.ty) <= goal.reach) { route = []; break; }
      const [tx, ty] = route[0];
      const d = Math.hypot(tx - hero.x, ty - hero.y);
      if (d > 3) heading(hero, tx - hero.x, ty - hero.y);
      if (d <= budget) { hero.x = tx; hero.y = ty; route.shift(); budget -= d; } else {
        hero.x += ((tx - hero.x) / d) * budget; hero.y += ((ty - hero.y) / d) * budget;
        budget = 0;
      }
      moved = true;
    }
    if (goal && !route.length) {
      const g = goal; goal = null;
      if (g.tx != null) face(g.tx);
      g.then?.();
    }
    hero.moving = moved;
    if (moved) {
      const tip = trail[0];
      if (Math.hypot(hero.x - tip[0], hero.y - tip[1]) > 8) { trail.unshift([hero.x, hero.y]); if (trail.length > 80) trail.pop(); }
    }
    // 悟空走动时徒弟们沿他的脚印鱼贯跟随；他一停，各自散到身旁站定，不叠成一摞
    restT = moved ? 0 : restT + dt;
    followers.forEach((f, i) => {
      let target, want = 0;
      if (restT > 0.2) {
        if (!f.rest) {
          // 在悟空周围找一处走得到、又不挤着别人的空位
          const taken = [[hero.x, hero.y], ...followers.filter((o) => o !== f && o.rest).map((o) => o.rest), ...actors.map((o) => [o.x, o.y])];
          const prefer = [[-96, 14], [96, 24], [-20, 84], [-80, -52], [84, -48], [-170, 44], [170, 50], [60, 120], [-190, -20], [190, -14], [-90, 110], [0, -100], [0, 170], [-260, 20], [260, 20]];
          const start = (i * 3) % prefer.length;
          f.rest = [f.x, f.y];
          for (let k = 0; k < prefer.length; k += 1) {
            const [dx, dy] = prefer[(start + k) % prefer.length];
            const x = hero.x + dx, y = hero.y + dy;
            if (nav.walkable(x, y) && taken.every(([tx, ty]) => Math.hypot(tx - x, (ty - y) * 1.6) > 90)) { f.rest = [x, y]; break; }
          }
        }
        target = f.rest;
      } else {
        f.rest = null;
        want = (i + 1) * TRAIL_GAP;
        let acc = 0;
        target = trail[trail.length - 1];
        for (let k = 0; k < trail.length - 1; k += 1) {
          acc += Math.hypot(trail[k][0] - trail[k + 1][0], trail[k][1] - trail[k + 1][1]);
          if (acc >= want) { target = trail[k + 1]; break; }
        }
      }
      const d = Math.hypot(target[0] - f.x, target[1] - f.y);
      const far = Math.hypot(hero.x - f.x, hero.y - f.y);
      f.moving = d > 6 && (f.rest ? true : far > want * 0.8);
      if (f.moving) {
        const stepLen = Math.min(d, speed * dt * (f.rest ? 0.8 : far > want * 1.6 ? 1.25 : 1));
        const nx = f.x + ((target[0] - f.x) / d) * stepLen, ny = f.y + ((target[1] - f.y) / d) * stepLen;
        heading(f, target[0] - f.x, target[1] - f.y);
        f.x = nx; f.y = ny;
      } else { f.flip = hero.x < f.x; f.away = false; }
    });
  }

  function stepActors(dt) {
    for (const a of actors) {
      a.appear = Math.min(1, a.appear + dt * 2.5);
      a.moving = false;
      // 被点中或悟空走近（约两身位内）的火妖原地站定、转头盯着悟空，好点
      if (a.wander && (a.held || Math.hypot(hero.x - a.x, hero.y - a.y) < 220)) { a.wanderTo = null; a.flip = hero.x < a.x; }
      else if (a.wander) {
        a.wanderT -= dt;
        if (!a.wanderTo && a.wanderT <= 0) {
          const ang = Math.random() * 6.28, r = 40 + Math.random() * 90;
          const p = [a.home[0] + Math.cos(ang) * r, a.home[1] + Math.sin(ang) * r * 0.6];
          if (nav.walkable(p[0], p[1])) a.wanderTo = p;
          a.wanderT = 1.4 + Math.random() * 2.4;
        }
        if (a.wanderTo) {
          const d = Math.hypot(a.wanderTo[0] - a.x, a.wanderTo[1] - a.y);
          if (d < 4) a.wanderTo = null; else {
            const s = Math.min(d, 45 * dt);
            a.x += ((a.wanderTo[0] - a.x) / d) * s; a.y += ((a.wanderTo[1] - a.y) / d) * s;
            a.flip = a.wanderTo[0] < a.x; a.moving = true;
          }
        }
      } else if (a.kind !== 'foe' || !a.still) a.flip = hero.x < a.x;
    }
  }

  // ---------- 绘制 ----------
  function drawFigure(a, opts = {}) {
    const img = sprite(a.art);
    const [sx, sy] = toScreen(a.x, a.y);
    const z = view.zoom * depthScale(a.y);
    const bodyH = a.h * z;
    // 贴脚接触影与柔和方向影
    ctx.save();
    ctx.globalAlpha = 0.36 * (a.appear ?? 1);
    ctx.fillStyle = '#1b120b';
    ctx.beginPath(); ctx.ellipse(sx + bodyH * 0.05, sy + 2 * z, bodyH * 0.27, bodyH * 0.085, 0, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.16 * (a.appear ?? 1);
    ctx.beginPath(); ctx.ellipse(sx + bodyH * 0.2, sy + 5 * z, bodyH * 0.36, bodyH * 0.07, -0.2, 0, 6.283); ctx.fill();
    ctx.restore();
    if (!img) return { sx, sy, top: sy - bodyH };
    if (a.moving) a.phase += opts.dt * (WALK_SHEETS[a.art] ? 9.5 : 11); else a.phase += opts.dt * 1.8;
    const sheets = WALK_SHEETS[a.art];
    const dir = a.away ? 'back' : 'front';
    const sheetImg = a.moving && sheets ? sprites.get(`${a.art}/${dir}`) : null;
    ctx.save();
    ctx.globalAlpha = a.appear ?? 1;
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = 16 * view.dpr; }
    if (sheetImg) {
      // 师徒有逐帧行走图：按步相取帧，脚底对齐同一基线
      const m = sheets[dir];
      const frame = Math.floor((a.phase / 6.2832) * WALK_SHEET_CELL.frames) % WALK_SHEET_CELL.frames;
      const scale = bodyH / ((WALK_SHEET_CELL.foot - m.top) * WALK_SHEET_CELL.h);
      const w = m.w * scale, hh = WALK_SHEET_CELL.h * scale;
      ctx.translate(sx, sy);
      ctx.scale((a.flip ? -1 : 1) * (m.left ? -1 : 1), 1);
      ctx.drawImage(sheetImg, frame * m.w, 0, m.w, WALK_SHEET_CELL.h, -w / 2, -WALK_SHEET_CELL.foot * hh, w, hh);
    } else {
      const meta = WALK_ART[a.art] ?? { ax: 0.5, ay: 0.9, top: 0.05 };
      const scale = bodyH / ((meta.ay - meta.top) * img.height);
      const w = img.width * scale, hh = img.height * scale;
      // 没有逐帧图的人物（火妖等）用颠步与摆身表示走动；站定时只留呼吸
      const walk = a.moving ? 1 : 0;
      const bob = walk ? Math.abs(Math.sin(a.phase)) * 4.2 * z : 0;
      const rock = walk ? Math.sin(a.phase) * 0.035 : 0;
      const breath = walk ? 1 + Math.abs(Math.cos(a.phase)) * 0.018 : 1 + Math.sin(a.phase) * 0.012;
      ctx.translate(sx, sy - bob);
      ctx.rotate(rock);
      ctx.scale((a.flip ? -1 : 1) * (meta.left ? -1 : 1), breath);
      const ox = -meta.ax * w, oy = -meta.ay * hh;
      const split = meta.top + (meta.ay - meta.top) * 0.66;
      const sTop = Math.round(split * img.height);
      ctx.drawImage(img, 0, 0, img.width, sTop, ox, oy, w, sTop * scale);
      const slices = 6, sliceH = (img.height - sTop) / slices;
      for (let i = 0; i < slices; i += 1) {
        const t = (i + 0.5) / slices;
        const shift = walk ? Math.sin(a.phase) * 4.5 * z * t : 0;
        ctx.drawImage(img, 0, sTop + i * sliceH, img.width, sliceH + 1, ox + shift, oy + (sTop + i * sliceH) * scale, w, (sliceH + 1) * scale);
      }
    }
    ctx.restore();
    if (a.moving && a.kind !== 'npc') {
      const beat = Math.floor(a.phase / Math.PI);
      if (beat !== a.beat) {
        a.beat = beat;
        puffs.push({ x: a.x, y: a.y, t: 0 });
        if (a === hero) audio.sfx('step', { volume: 0.32, rate: 0.9 + Math.random() * 0.25 });
      }
    }
    return { sx, sy, top: sy - bodyH };
  }

  function label(text, x, y, color, size, weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.28);
    ctx.strokeStyle = 'rgba(24,16,10,.92)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawNames(a, pos) {
    const size = Math.max(13, 15 * Math.min(1.1, view.zoom + 0.1));
    const color = NAME_COLOR[a.kind] ?? NAME_COLOR.npc;
    if (a.title) label(a.title, pos.sx, pos.sy + size * 1.05, 'rgba(216,236,255,.92)', size * 0.78, 500);
    label(a.name, pos.sx, pos.sy + size * (a.title ? 2.15 : 1.2), color, size);
    if (a.mark) {
      const by = pos.top - 20 - Math.sin(clock * 3.2) * 4;
      const main = a.mark === '!';
      ctx.save();
      ctx.translate(pos.sx, by);
      const r = main ? 17 : 14;
      const g = ctx.createRadialGradient(0, -3, 2, 0, 0, r);
      g.addColorStop(0, main ? '#fff3b0' : '#d6fff5'); g.addColorStop(1, main ? '#e2a019' : '#2f9a8c');
      ctx.fillStyle = g; ctx.strokeStyle = main ? '#7a4a05' : '#124f48'; ctx.lineWidth = 2;
      ctx.shadowColor = main ? 'rgba(255,208,80,.9)' : 'rgba(120,240,220,.8)'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = main ? '#5a2c00' : '#083a35';
      if (main) {
        // 惊叹号直接画：一竖一点，量过的几何中心就是圆心，不受字体留白影响
        ctx.beginPath(); ctx.roundRect(-2.6, -10.5, 5.2, 13, 2.4); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 7.6, 2.9, 0, 6.283); ctx.fill();
      } else if (a.mark === '令' && markIcon) {
        ctx.drawImage(markIcon, -11, -11, 22, 22);
      } else {
        // 其余记号按字形的实际墨迹框居中
        ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        const m = ctx.measureText(a.mark);
        ctx.fillText(a.mark, -(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - m.actualBoundingBoxLeft, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      }
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    }
  }

  function drawPortal(p) {
    const [sx, sy] = toScreen(p.x, p.y);
    const z = view.zoom;
    const pulse = 0.5 + 0.5 * Math.sin(clock * 2.4);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.42);
    const col = p.locked ? '170,170,170' : '110,240,255';
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = `rgba(${col},${(p.locked ? 0.35 : 0.75) - i * 0.2})`;
      ctx.lineWidth = (5 - i) * z;
      ctx.beginPath(); ctx.arc(0, 0, (46 + i * 13 + pulse * 5) * z, 0, 6.283); ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 * z);
    g.addColorStop(0, `rgba(${col},${p.locked ? 0.12 : 0.42})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 62 * z, 0, 6.283); ctx.fill();
    ctx.restore();
    if (!p.locked) {
      for (let i = 0; i < 5; i += 1) {
        const t = (clock * 0.6 + i / 5) % 1;
        ctx.fillStyle = `rgba(190,250,255,${0.8 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(sx + Math.sin(i * 2.4 + clock) * 30 * z, sy - t * 70 * z, 2.2 * z, 0, 6.283); ctx.fill();
      }
    }
    const size = Math.max(13, 15 * Math.min(1.1, z + 0.1));
    label(p.locked ? `${p.label}（未通）` : `前往 ${p.label}`, sx, sy - 44 * z, p.locked ? '#c9c9c9' : NAME_COLOR.portal, size);
  }

  function drawSpot(s) {
    const [sx, sy] = toScreen(s.x, s.y);
    const z = view.zoom;
    const near = Math.hypot(hero.x - s.x, hero.y - s.y) < 260;
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(1, 0.45);
    ctx.strokeStyle = s.done ? 'rgba(150,220,200,.5)' : `rgba(255,236,160,${0.55 + 0.35 * Math.sin(clock * 3)})`;
    ctx.lineWidth = 3 * z; ctx.setLineDash([10 * z, 8 * z]); ctx.lineDashOffset = -clock * 22;
    ctx.beginPath(); ctx.arc(0, 0, 40 * z, 0, 6.283); ctx.stroke();
    ctx.restore();
    if (!s.done) {
      for (let i = 0; i < 3; i += 1) {
        const t = (clock * 0.8 + i / 3) % 1;
        const px = sx + Math.cos(i * 2.1 + clock * 0.7) * 20 * z, py = sy - 10 * z - t * 46 * z;
        ctx.fillStyle = `rgba(255,244,190,${1 - t})`;
        ctx.save(); ctx.translate(px, py); ctx.rotate(0.785); ctx.fillRect(-2.2 * z, -2.2 * z, 4.4 * z, 4.4 * z); ctx.restore();
      }
    }
    if (near || hover === s) label(s.name, sx, sy - 52 * z, s.done ? NAME_COLOR.spot : '#fff0b0', Math.max(13, 14 * z));
  }

  function drawGuide() {
    const pts = route.length ? [[hero.x, hero.y], ...route] : null;
    if (!pts) return;
    ctx.save();
    ctx.setLineDash([3, 14]); ctx.lineCap = 'round';
    ctx.lineDashOffset = -clock * 40;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,228,150,.85)';
    ctx.shadowColor = 'rgba(255,200,80,.8)'; ctx.shadowBlur = 8;
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.restore();
    const end = pts[pts.length - 1];
    const [ex, ey] = toScreen(end[0], end[1]);
    ctx.save(); ctx.translate(ex, ey); ctx.scale(1, 0.45);
    ctx.strokeStyle = 'rgba(255,232,160,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 16 + 5 * Math.sin(clock * 6), 0, 6.283); ctx.stroke();
    ctx.restore();
  }

  function drawBubble(b) {
    const who = b.id === 'hero' ? hero : followers.find((f) => f.id === b.id) ?? actors.find((a) => a.id === b.id);
    if (!who) return;
    const [sx, sy] = toScreen(who.x, who.y);
    const top = sy - who.h * view.zoom * depthScale(who.y) - 34;
    const size = 14;
    ctx.font = `500 ${size}px ${FONT}`;
    const maxW = Math.min(240, view.w * 0.6);
    const lines = []; let line = '';
    for (const ch of b.text) { if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch; }
    lines.push(line);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22, hgt = lines.length * (size + 5) + 14;
    const x = Math.max(8, Math.min(view.w - w - 8, sx - w / 2)), y = Math.max(8, top - hgt);
    const alpha = Math.min(1, b.t * 4, (b.life - b.t) * 3);
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = 'rgba(255,250,236,.96)'; ctx.strokeStyle = 'rgba(138,96,40,.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, hgt, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 7, y + hgt - 1); ctx.lineTo(sx, y + hgt + 9); ctx.lineTo(sx + 7, y + hgt - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2118'; ctx.textAlign = 'left';
    lines.forEach((l, i) => ctx.fillText(l, x + 11, y + 12 + size * 0.85 + i * (size + 5)));
    ctx.restore();
  }

  function drawAmbient(dt) {
    const amb = AMBIENT[scene.id];
    const [r, g, b] = amb.color;
    for (const m of motes) {
      m.p += dt;
      if (amb.kind === 'leaf') { m.y += dt * 0.035 * m.s; m.x += dt * 0.02 + Math.sin(m.p) * 0.0008; } else { m.y -= dt * (amb.kind === 'spark' ? 0.07 : 0.03) * m.s; m.x += Math.sin(m.p * 1.3) * 0.0009 + dt * 0.012; }
      if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } if (m.y > 1.05) { m.y = -0.05; m.x = Math.random(); }
      if (m.x > 1.05) m.x = -0.05;
      const x = m.x * view.w, y = m.y * view.h;
      const tw = 0.45 + 0.4 * Math.sin(m.p * 2.3);
      ctx.fillStyle = `rgba(${r},${g},${b},${tw * (amb.kind === 'leaf' ? 0.75 : 0.9)})`;
      if (amb.kind === 'leaf') { ctx.save(); ctx.translate(x, y); ctx.rotate(m.p); ctx.beginPath(); ctx.ellipse(0, 0, 5 * m.s, 2.2 * m.s, 0, 0, 6.283); ctx.fill(); ctx.restore(); } else { ctx.beginPath(); ctx.arc(x, y, (amb.kind === 'spark' ? 1.8 : 1.4) * m.s, 0, 6.283); ctx.fill(); }
    }
    const vg = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.42, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
    vg.addColorStop(0, 'rgba(20,10,4,0)'); vg.addColorStop(1, 'rgba(20,10,4,.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, view.w, view.h);
    if (scene.id === 'huokou' || scene.id === 'village') {
      const heat = ctx.createLinearGradient(0, 0, 0, view.h);
      heat.addColorStop(0, `rgba(255,120,40,${scene.id === 'huokou' ? 0.14 : 0.07})`); heat.addColorStop(0.6, 'rgba(255,120,40,0)');
      ctx.fillStyle = heat; ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  function render(dt) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#2a2018'; ctx.fillRect(0, 0, view.w, view.h);
    if (!scene) return;
    // 镜头缓跟
    const k = 1 - Math.exp(-dt * 6);
    // 宽屏右侧有人物卡与任务卡占着：镜头往右多看一截，让悟空偏左、前方的人不躲在卡片底下
    view.cx += (hero.x + lead() - view.cx) * k; view.cy += (hero.y - 40 - view.cy) * k;
    clampCamera();
    if (map) {
      const [x0, y0] = toMap(0, 0);
      const sw = view.w / view.zoom, sh = view.h / view.zoom;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(map.canvas, x0 * PX_PER_UNIT, y0 * PX_PER_UNIT, sw * PX_PER_UNIT, sh * PX_PER_UNIT, 0, 0, view.w, view.h);
    }
    for (const p of portals) drawPortal(p);
    for (const s of spots) drawSpot(s);
    drawGuide();
    puffs = puffs.filter((p) => (p.t += dt) < 0.5);
    for (const p of puffs) {
      const [sx, sy] = toScreen(p.x, p.y);
      const t = p.t / 0.5;
      ctx.fillStyle = `rgba(226,200,160,${0.4 * (1 - t)})`;
      ctx.beginPath(); ctx.ellipse(sx, sy - t * 6, (6 + t * 12) * view.zoom, (3 + t * 5) * view.zoom, 0, 0, 6.283); ctx.fill();
    }
    const all = [hero, ...followers, ...actors].sort((a, b) => a.y - b.y);
    const placed = [];
    for (const a of all) placed.push([a, drawFigure(a, { dt, glow: hover === a ? 'rgba(255,236,150,.95)' : a.mark === '!' ? 'rgba(255,214,90,.55)' : null })]);
    for (const [a, pos] of placed) drawNames(a, pos);
    drawAmbient(dt);
    bubbles = bubbles.filter((b) => (b.t += dt) < b.life);
    for (const b of bubbles) drawBubble(b);
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; clock += dt;
    if (scene && hero) { stepHero(dt); stepActors(dt); render(dt); handlers.onFrame?.(); }
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------
  function pickAt(sx, sy) {
    // 人身连同脚下的头衔与名牌都算点中；游走的火妖再放宽一圈，免得点下去时它刚好挪开
    const nameH = Math.max(13, 15 * Math.min(1.1, view.zoom + 0.1)) * 3;
    const hit = (a, loose = 1) => {
      const [ax, ay] = toScreen(a.x, a.y);
      const hgt = a.h * view.zoom * depthScale(a.y);
      return sx > ax - hgt * 0.34 * loose && sx < ax + hgt * 0.34 * loose && sy > ay - hgt - 26 && sy < ay + nameH + (loose - 1) * 30;
    };
    const figures = [...actors].sort((a, b) => b.y - a.y);
    for (const a of figures) if (hit(a)) return { type: 'actor', ref: a };
    for (const a of figures) if (a.wander && hit(a, 1.7)) return { type: 'actor', ref: a };
    // 点在游走火妖身边的空地上（约一身位内），也当是点它
    const [mx, my] = toMap(sx, sy);
    for (const a of figures) if (a.wander && Math.hypot(mx - a.x, (my - (a.y - a.h * 0.4)) * 0.8) < 120) return { type: 'actor', ref: a };
    for (const p of portals) { const [px, py] = toScreen(p.x, p.y); if (Math.hypot(sx - px, (sy - py) * 2) < 70 * view.zoom || (Math.abs(sx - px) < 90 && sy < py - 30 * view.zoom && sy > py - 66 * view.zoom)) return { type: 'portal', ref: p }; }
    for (const s of spots) { const [px, py] = toScreen(s.x, s.y); if (Math.hypot(sx - px, (sy - py) * 1.6) < 52 * view.zoom) return { type: 'spot', ref: s }; }
    return null;
  }

  function onPointer(e) {
    if (inputLocked || !scene) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const hit = pickAt(sx, sy);
    handlers.onMove?.();
    if (hit?.type === 'actor') { chase(hit.ref, () => handlers.onActor(hit.ref)); return; }
    if (hit?.type === 'portal') { approach(hit.ref.x, hit.ref.y, () => handlers.onPortal(hit.ref), 40); return; }
    if (hit?.type === 'spot') { approach(hit.ref.x, hit.ref.y, () => handlers.onSpot(hit.ref), 60); return; }
    const [mx, my] = toMap(sx, sy);
    release();
    walkTo(mx, my);
  }
  function onHover(e) {
    if (!scene) return;
    const rect = canvas.getBoundingClientRect();
    const hit = inputLocked ? null : pickAt(e.clientX - rect.left, e.clientY - rect.top);
    hover = hit?.ref ?? null;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }
  const KEY = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  const onKeyDown = (e) => { const k = KEY[e.key]; if (k && !inputLocked && !e.metaKey && !e.ctrlKey) { keys.add(k); e.preventDefault(); } };
  const onKeyUp = (e) => { const k = KEY[e.key]; if (k) keys.delete(k); };
  const onBlur = () => keys.clear();

  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointermove', onHover);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  const ro = new ResizeObserver(() => { resize(); if (scene) clampCamera(); });
  ro.observe(root);
  resize();

  return {
    enter, setActors, setPortals, setSpots, walkTo, approach, chase, stop,
    get sceneId() { return scene?.id ?? null; },
    get moving() { return route.length > 0; },
    position: () => [Math.round(hero.x), Math.round(hero.y)],
    actor: (id) => actors.find((a) => a.id === id) ?? null,
    say(id, text, life = 3.2) { bubbles = bubbles.filter((b) => b.id !== id); bubbles.push({ id, text, t: 0, life }); },
    lock(v) { inputLocked = v; if (v) { keys.clear(); hover = null; canvas.style.cursor = 'default'; } },
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); },
    pause() { running = false; cancelAnimationFrame(raf); keys.clear(); },
    // 小地图：底图缩略 + 各色标记
    drawMinimap(target) {
      if (!map || !hero) return;
      const c = target.getContext('2d');
      const w = target.width, hgt = target.height;
      c.drawImage(map.mini, 0, 0, w, hgt);
      c.fillStyle = 'rgba(20,12,6,.18)'; c.fillRect(0, 0, w, hgt);
      const dot = (x, y, color, r = 3.2) => { c.fillStyle = color; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1; c.beginPath(); c.arc((x / MAP_SIZE[0]) * w, (y / MAP_SIZE[1]) * hgt, r, 0, 6.283); c.fill(); c.stroke(); };
      for (const p of portals) dot(p.x, p.y, p.locked ? '#999' : '#7ef3ff', 3.6);
      for (const s of spots) if (!s.done) dot(s.x, s.y, '#fff0b0', 2.4);
      for (const a of actors) dot(a.x, a.y, a.mark === '!' ? '#ffcc33' : a.kind === 'foe' ? '#ff6b55' : '#ffe66b', a.mark === '!' ? 4.6 : 3);
      const hw = (view.w / view.zoom / MAP_SIZE[0]) * w, hh = (view.h / view.zoom / MAP_SIZE[1]) * hgt;
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1;
      c.strokeRect((view.cx / MAP_SIZE[0]) * w - hw / 2, (view.cy / MAP_SIZE[1]) * hgt - hh / 2, hw, hh);
      dot(hero.x, hero.y, '#7dff6a', 4.2);
    },
    destroy() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
      canvas.remove();
    },
    // 给验证脚本读的只读画面事实
    probe: () => ({
      scene: scene?.id ?? null, x: hero ? Math.round(hero.x) : null, y: hero ? Math.round(hero.y) : null, moving: route.length > 0, mapReady: !!map,
      // 场上各人此刻在画面里的位置（身体中段），供「点场上的人」定位
      actors: scene ? actors.map((a) => { const [sx, sy] = toScreen(a.x, a.y); return { id: a.id, mark: a.mark ?? null, sx: Math.round(sx), sy: Math.round(sy - a.h * view.zoom * 0.45) }; }) : [],
    }),
    screenOf: (x, y) => toScreen(x, y),
  };
}
