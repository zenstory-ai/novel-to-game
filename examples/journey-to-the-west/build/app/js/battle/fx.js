// 战斗特效画布：粒子、刀光、冲击环、火水冰风与真扇三段的全屏天气。只画画面，不碰规则。

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

const PALETTE = {
  金: ['#fff4b8', '#f2c94c', '#c9902a'], 木: ['#d8ffb0', '#6fcf5f', '#2f8f3e'], 水: ['#e2f6ff', '#6ec6ff', '#2a7fc0'],
  火: ['#fff0a0', '#ff8a3c', '#d93a1c'], 土: ['#f6e1b8', '#c79a5c', '#7d5a34'], none: ['#ffffff', '#ffe9b0', '#d8b46a'],
};

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, raf = 0, last = 0, alive = true;
  const parts = [], shapes = [];
  let weather = null, flashA = 0, flashColor = '#fff', tint = null, ambient = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  function spawn(p) { parts.push({ vx: 0, vy: 0, g: 0, drag: 0.98, life: 0.6, t: 0, size: 4, color: '#fff', shape: 'dot', rot: rand(0, TAU), spin: 0, fade: 1, grow: 0, add: true, ...p }); }

  function burst(x, y, { colors = PALETTE.none, count = 18, speed = 320, g = 500, life = 0.55, size = 5, shape = 'dot', spread = TAU, dir = 0, up = 0 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const a = dir + rand(-spread / 2, spread / 2), v = speed * rand(0.35, 1);
      spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, g, life: life * rand(0.6, 1.2), size: size * rand(0.5, 1.3), color: colors[i % colors.length], shape, spin: rand(-8, 8) });
    }
  }

  const fx = {
    resize,
    flash(color = '#fff', a = 0.6) { flashColor = color; flashA = Math.max(flashA, a); },
    tint(color) { tint = color; },
    // 刀光：一道弧形亮痕
    slash(x, y, { el = 'none', big = false, angle = rand(-0.9, -0.3) } = {}) {
      shapes.push({ kind: 'slash', x, y, t: 0, life: big ? 0.32 : 0.24, r: big ? 150 : 96, angle, colors: PALETTE[el] ?? PALETTE.none });
      burst(x, y, { colors: PALETTE[el] ?? PALETTE.none, count: big ? 26 : 14, speed: big ? 520 : 380, life: 0.4, size: big ? 6 : 4.5, shape: 'streak' });
    },
    // 重击：冲击环 + 碎石
    smash(x, y, { el = 'none', big = false } = {}) {
      shapes.push({ kind: 'ring', x, y, t: 0, life: 0.42, r: big ? 230 : 130, colors: PALETTE[el] ?? PALETTE.none, squash: 0.45 });
      shapes.push({ kind: 'star', x, y, t: 0, life: 0.2, r: big ? 150 : 90, colors: PALETTE[el] ?? PALETTE.none });
      burst(x, y, { colors: [...(PALETTE[el] ?? PALETTE.none), '#6b5846'], count: big ? 34 : 20, speed: big ? 560 : 420, g: 1100, life: 0.6, size: big ? 7 : 5, shape: 'shard', spread: Math.PI, dir: -Math.PI / 2 });
    },
    // 横扫：一道宽弧掠过一片
    sweep(x0, x1, y, { el = 'none' } = {}) {
      shapes.push({ kind: 'sweep', x0, x1, y, t: 0, life: 0.34, colors: PALETTE[el] ?? PALETTE.none });
    },
    ring(x, y, { el = 'none', r = 120, life = 0.5, squash = 1 } = {}) { shapes.push({ kind: 'ring', x, y, t: 0, life, r, colors: PALETTE[el] ?? PALETTE.none, squash }); },
    // 弹道：从 a 飞到 b，返回飞行秒数
    bolt(ax, ay, bx, by, { el = '火', dur = 0.28, size = 16 } = {}) {
      shapes.push({ kind: 'bolt', ax, ay, bx, by, t: 0, life: dur, size, colors: PALETTE[el] ?? PALETTE.none });
      return dur;
    },
    fire(x, y, big = false) {
      burst(x, y, { colors: PALETTE.火, count: big ? 46 : 26, speed: 260, g: -520, life: 0.7, size: big ? 11 : 8, shape: 'flame', up: 60 });
      shapes.push({ kind: 'ring', x, y: y + 30, t: 0, life: 0.4, r: big ? 150 : 90, colors: PALETTE.火, squash: 0.4 });
    },
    water(x, y, big = false) {
      burst(x, y, { colors: PALETTE.水, count: big ? 44 : 26, speed: 420, g: 1200, life: 0.7, size: big ? 7 : 5, shape: 'drop', spread: Math.PI * 0.9, dir: -Math.PI / 2 });
      shapes.push({ kind: 'ring', x, y: y + 34, t: 0, life: 0.5, r: big ? 170 : 100, colors: PALETTE.水, squash: 0.35 });
    },
    ice(x, y) {
      for (let i = 0; i < 7; i += 1) spawn({ x: x + rand(-46, 46), y: y + rand(-70, 30), life: 0.75, size: rand(14, 26), color: PALETTE.水[i % 3], shape: 'crystal', rot: rand(-0.4, 0.4), grow: 16 });
      burst(x, y, { colors: PALETTE.水, count: 18, speed: 300, g: 300, life: 0.6, size: 4, shape: 'shard' });
    },
    wave(x0, x1, y) { shapes.push({ kind: 'wave', x0, x1, y, t: 0, life: 0.6 }); },
    heal(x, y) {
      for (let i = 0; i < 16; i += 1) spawn({ x: x + rand(-40, 40), y: y + rand(-10, 50), vy: -rand(70, 160), life: rand(0.7, 1.1), size: rand(4, 8), color: ['#c9ffcf', '#7be08a', '#fff7c0'][i % 3], shape: 'plus', drag: 0.99 });
      shapes.push({ kind: 'ring', x, y: y + 60, t: 0, life: 0.6, r: 80, colors: ['#eaffea', '#7be08a', '#3aa95a'], squash: 0.35 });
    },
    ward(x, y, colors = ['#fff6c8', '#f2c94c', '#c9902a']) {
      shapes.push({ kind: 'dome', x, y, t: 0, life: 0.7, r: 92, colors });
    },
    aura(x, y, el = '金') {
      const colors = PALETTE[el] ?? PALETTE.none;
      for (let i = 0; i < 22; i += 1) spawn({ x: x + rand(-46, 46), y: y + rand(20, 70), vy: -rand(160, 320), life: rand(0.5, 0.9), size: rand(3, 6), color: colors[i % 3], shape: 'streak', rot: -Math.PI / 2, spin: 0 });
    },
    smoke(x, y, { count = 16, color = '#e9e2d6' } = {}) {
      for (let i = 0; i < count; i += 1) spawn({ x: x + rand(-30, 30), y: y + rand(-50, 30), vx: rand(-60, 60), vy: -rand(20, 90), life: rand(0.5, 0.9), size: rand(20, 42), color, shape: 'puff', add: false, grow: 40, drag: 0.94 });
    },
    gale(dir = 1) {
      for (let i = 0; i < 40; i += 1) spawn({ x: dir > 0 ? rand(-w * 0.3, w * 0.4) : rand(w * 0.6, w * 1.3), y: rand(h * 0.1, h * 0.85), vx: dir * rand(1400, 2400), vy: rand(-60, 60), life: rand(0.4, 0.8), size: rand(40, 110), color: 'rgba(235,255,245,.7)', shape: 'wind', drag: 1 });
    },
    charm(x, y) {
      for (let i = 0; i < 16; i += 1) spawn({ x: x + rand(-50, 50), y: y + rand(-60, 30), vx: rand(-30, 30), vy: -rand(30, 90), life: rand(0.6, 1), size: rand(5, 9), color: ['#ffd0ea', '#ff8cc6', '#fff'][i % 3], shape: 'petal', spin: rand(-4, 4), drag: 0.98 });
    },
    sparks(x, y, colors = PALETTE.none, count = 14) { burst(x, y, { colors, count, speed: 380, g: 700, life: 0.45, size: 4, shape: 'streak' }); },
    // 全屏天气：ash 息火落灰 / wind 生风 / rain 落雨 / fire 假扇火卷 / dark 化虫压暗；null 收起
    weather(kind, seconds = 2.2) { weather = kind ? { kind, t: 0, life: seconds } : null; },
    // 场景常驻氛围：火口余烬等
    ambient(kind) { ambient = kind; },
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); },
  };

  function drawPart(p) {
    const k = p.t / p.life;
    const a = Math.max(0, (1 - k) * p.fade);
    const s = p.size + p.grow * k;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
    switch (p.shape) {
      case 'streak': {
        const v = Math.hypot(p.vx, p.vy) || 1;
        ctx.lineWidth = s * 0.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / v) * s * 4, p.y - (p.vy / v) * s * 4); ctx.stroke(); break;
      }
      case 'shard': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(0, -s); ctx.lineTo(s, s * 0.6); ctx.closePath(); ctx.fill(); ctx.restore(); break;
      case 'flame': { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 1.6); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 1.1, s * 1.7, 0, 0, TAU); ctx.fill(); break; }
      case 'drop': ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.6, s * 1.2, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, TAU); ctx.fill(); break;
      case 'crystal': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -s * 1.5); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s * 0.8); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); break;
      case 'plus': ctx.fillRect(p.x - s * 0.2, p.y - s, s * 0.4, s * 2); ctx.fillRect(p.x - s, p.y - s * 0.2, s * 2, s * 0.4); break;
      case 'puff': { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = a * 0.7; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill(); break; }
      case 'wind': ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x - Math.sign(p.vx) * s * 0.5, p.y - 8, p.x - Math.sign(p.vx) * s, p.y); ctx.stroke(); break;
      case 'petal': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
      case 'rain': ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 5, p.y - s); ctx.stroke(); break;
      default: ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
    }
  }

  function drawShape(s) {
    const k = s.t / s.life, e = 1 - (1 - k) * (1 - k);
    const [c0, c1, c2] = s.colors ?? PALETTE.none;
    if (s.kind === 'slash') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.globalAlpha = 1 - k;
      const sweep = Math.PI * 0.95, start = -sweep / 2 + e * 0.5;
      for (let i = 0; i < 3; i += 1) {
        ctx.strokeStyle = [c0, c1, c2][i]; ctx.lineWidth = (16 - i * 5) * (1 - k * 0.6); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, s.r * (0.7 + e * 0.35) - i * 5, start, start + sweep * e); ctx.stroke();
      }
      ctx.restore();
    } else if (s.kind === 'ring') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, s.squash ?? 1);
      ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = c1; ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(0, 0, s.r * e, 0, TAU); ctx.stroke();
      ctx.strokeStyle = c0; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, s.r * e * 0.82, 0, TAU); ctx.stroke();
      ctx.restore();
    } else if (s.kind === 'star') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = 1 - k; ctx.fillStyle = c0;
      for (let i = 0; i < 8; i += 1) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s.r * 0.07, -s.r * 0.3); ctx.lineTo(0, -s.r * (0.5 + e * 0.6)); ctx.lineTo(s.r * 0.07, -s.r * 0.3); ctx.fill(); }
      ctx.restore();
    } else if (s.kind === 'sweep') {
      const x = s.x0 + (s.x1 - s.x0) * e;
      ctx.save(); ctx.globalAlpha = 1 - k;
      const g = ctx.createLinearGradient(s.x0, 0, x, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, c1); g.addColorStop(1, c0);
      ctx.strokeStyle = g; ctx.lineWidth = 26 * (1 - k * 0.5); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x0, s.y + 26); ctx.quadraticCurveTo((s.x0 + x) / 2, s.y - 70, x, s.y + 12); ctx.stroke();
      ctx.restore();
      if (Math.random() < 0.9) burst(x, s.y, { colors: s.colors, count: 3, speed: 300, life: 0.3, size: 4, shape: 'streak' });
    } else if (s.kind === 'bolt') {
      const x = s.ax + (s.bx - s.ax) * k, y = s.ay + (s.by - s.ay) * k - Math.sin(k * Math.PI) * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s.size * 2.2); g.addColorStop(0, c0); g.addColorStop(0.4, c1); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s.size * 2.2, 0, TAU); ctx.fill();
      spawn({ x, y, vx: rand(-40, 40), vy: rand(-40, 40), life: 0.3, size: s.size * 0.5, color: c1, shape: 'flame' });
    } else if (s.kind === 'wave') {
      const x = s.x0 + (s.x1 - s.x0) * e;
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.9;
      for (let i = 0; i < 3; i += 1) {
        ctx.strokeStyle = PALETTE.水[i]; ctx.lineWidth = 12 - i * 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let j = 0; j <= 20; j += 1) { const px = s.x0 + (x - s.x0) * (j / 20), py = s.y - i * 22 + Math.sin(j * 0.9 + s.t * 18 + i) * 16 - (j / 20) * 30 * Math.sin(k * Math.PI); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      ctx.restore();
      burst(x, s.y, { colors: PALETTE.水, count: 2, speed: 260, g: 900, life: 0.4, size: 4, shape: 'drop', spread: Math.PI, dir: -Math.PI / 2 });
    } else if (s.kind === 'dome') {
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.75;
      const g = ctx.createRadialGradient(0, -20, s.r * 0.2, 0, 0, s.r * 1.1); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, c1); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s.r * (0.8 + e * 0.25), s.r * 1.25 * (0.8 + e * 0.25), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = c0; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
  }

  function drawWeather(dt) {
    const wz = weather;
    wz.t += dt;
    const k = Math.min(1, wz.t / wz.life), env = Math.sin(k * Math.PI);
    ctx.globalCompositeOperation = 'source-over';
    if (wz.kind === 'ash') {
      ctx.globalAlpha = env * 0.34; ctx.fillStyle = '#3d4b55'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i += 1) spawn({ x: rand(0, w), y: -10, vx: rand(-30, 30), vy: rand(90, 200), life: rand(1.2, 2), size: rand(2, 4.5), color: ['#cfd3d6', '#8b9198', '#f1ece2'][i % 3], shape: 'dot', add: false, drag: 0.995 });
    } else if (wz.kind === 'wind') {
      ctx.globalAlpha = env * 0.22; ctx.fillStyle = '#bff2e0'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i += 1) spawn({ x: rand(w * 0.6, w * 1.3), y: rand(0, h), vx: -rand(1500, 2600), vy: rand(-80, 40), life: rand(0.35, 0.7), size: rand(50, 130), color: 'rgba(240,255,250,.85)', shape: 'wind', drag: 1 });
    } else if (wz.kind === 'rain') {
      ctx.globalAlpha = env * 0.3; ctx.fillStyle = '#1e4a66'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i += 1) spawn({ x: rand(-40, w + 80), y: -20, vx: -rand(160, 220), vy: rand(1300, 1800), life: rand(0.5, 0.8), size: rand(18, 34), color: 'rgba(210,238,255,.85)', shape: 'rain', drag: 1, add: false });
    } else if (wz.kind === 'fire') {
      const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,90,20,.75)'); g.addColorStop(0.6 * env + 0.1, 'rgba(255,60,10,.25)'); g.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.globalAlpha = env; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i += 1) spawn({ x: rand(-20, w * 0.5 * env + 40), y: rand(h * 0.2, h), vx: rand(200, 520), vy: -rand(60, 260), life: rand(0.5, 0.9), size: rand(10, 22), color: PALETTE.火[i % 3], shape: 'flame', drag: 0.98 });
    } else if (wz.kind === 'dark') {
      ctx.globalAlpha = env * 0.7; ctx.fillStyle = '#0c0705'; ctx.fillRect(0, 0, w, h);
    }
    if (wz.t >= wz.life) weather = null;
  }

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (ambient === 'ember' && Math.random() < 0.5) spawn({ x: rand(0, w), y: h + 6, vx: rand(-20, 40), vy: -rand(60, 150), life: rand(1.6, 3), size: rand(1.2, 2.6), color: PALETTE.火[Math.floor(rand(0, 3))], shape: 'dot', drag: 0.997 });
    if (ambient === 'leaf' && Math.random() < 0.12) spawn({ x: rand(0, w), y: -8, vx: rand(20, 70), vy: rand(40, 90), life: rand(3, 5), size: rand(3, 5), color: ['#bfe8a0', '#7fc77a', '#f0ffd8'][Math.floor(rand(0, 3))], shape: 'petal', spin: rand(-2, 2), drag: 0.999, add: false });
    if (ambient === 'mist' && Math.random() < 0.05) spawn({ x: rand(0, w), y: rand(h * 0.5, h), vx: rand(10, 30), vy: 0, life: rand(3, 5), size: rand(60, 120), color: 'rgba(220,210,235,.5)', shape: 'puff', add: false, grow: 30, fade: 0.5, drag: 1 });
    if (tint) { ctx.globalAlpha = 1; ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h); }
    if (weather) drawWeather(dt);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = shapes.length - 1; i >= 0; i -= 1) {
      const s = shapes[i]; s.t += dt;
      if (s.t >= s.life) { shapes.splice(i, 1); continue; }
      drawShape(s);
    }
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      drawPart(p);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (flashA > 0.01) { ctx.globalAlpha = flashA; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, w, h); flashA *= Math.pow(0.002, dt); } else flashA = 0;
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return fx;
}
