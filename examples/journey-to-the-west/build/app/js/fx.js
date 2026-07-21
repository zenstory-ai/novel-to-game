// 战斗演出层:Canvas 粒子 + 背景色调突变,零素材零依赖(简报二.4)。
// 标志性法术各有可辨识的 2-3 秒演出:真扇三段(息火/生风/落雨)、火系、水系、金身、定风丹。
// 粒子轨迹只用演出专用视觉随机(与战斗 rng 物理隔离,不影响可复现约束);全项目禁 Math.random。

import { createRNG } from './rng.js';

const vrng = createRNG(0xf2a7); // 只决定粒子轨迹,与战斗结算无关
const rf = (a, b) => a + vrng() * (b - a);

export class FxLayer {
  constructor(field) {
    this.field = field;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx-canvas';
    this.g = this.canvas.getContext('2d');
    this.tintEl = document.createElement('div');
    this.tintEl.className = 'fx-tint';
    field.append(this.canvas, this.tintEl);
    this.parts = [];
    this.raf = 0;
    this._tintT = 0;
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  resize() {
    const r = this.field.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width));
    this.canvas.height = Math.max(1, Math.round(r.height));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this._tintT);
    window.removeEventListener('resize', this._onResize);
    this.canvas.remove();
    this.tintEl.remove();
  }

  // 背景色调突变:铺一层彩色渐变,达到峰值后退回(演出的「变天」感)
  tint(css, ms) {
    const el = this.tintEl;
    el.style.background = css;
    el.classList.remove('on');
    void el.offsetWidth;
    el.style.transition = `opacity ${Math.round(ms * 0.45)}ms ease`;
    el.classList.add('on');
    clearTimeout(this._tintT);
    this._tintT = setTimeout(() => {
      el.style.transition = `opacity ${Math.round(ms * 0.55)}ms ease`;
      el.classList.remove('on');
    }, Math.round(ms * 0.45));
  }

  spawn(n, make) {
    for (let i = 0; i < n; i++) this.parts.push(make(i));
    this.kick();
  }

  kick() {
    if (this.raf) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = this.g;
      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
      for (const p of this.parts) p.draw(g, dt);
      if (this.parts.length > 0) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.raf = 0;
        g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  anchorOf(card) {
    // 单位卡片中心在演出画布上的坐标;无卡片则取场中偏上
    const fr = this.field.getBoundingClientRect();
    if (!card) return { x: fr.width * 0.5, y: fr.height * 0.42 };
    const r = card.getBoundingClientRect();
    return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height * 0.42 };
  }

  // ---------- 粒子造型 ----------
  ember(x, y, big = false) {
    const a = -Math.PI / 2 + rf(-0.7, 0.7);
    const sp = rf(40, big ? 190 : 130);
    const colors = ['#ff8a3a', '#ffc766', '#e24a24', '#ffdca0'];
    return {
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rf(0.7, 1.5), maxLife: 1.5,
      size: rf(1.6, big ? 4.6 : 3.2), color: colors[Math.floor(rf(0, colors.length)) % colors.length],
      draw(g, dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vy -= 60 * dt; this.vx *= 0.99; // 火星上飘
        g.globalAlpha = Math.max(0, this.life / this.maxLife);
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      },
    };
  }

  drop(x, y) {
    const sp = rf(120, 240);
    return {
      x: x + rf(-46, 46), y: y + rf(-30, 10), vx: rf(-16, 16), vy: -sp * 0.4,
      life: rf(0.6, 1.2), maxLife: 1.2, size: rf(1.6, 3),
      color: ['#9ad0f0', '#6ab0e0', '#d0ecff'][Math.floor(rf(0, 3)) % 3],
      draw(g, dt) {
        this.vy += 420 * dt; this.x += this.vx * dt; this.y += this.vy * dt; // 水珠先扬后落
        g.globalAlpha = Math.max(0, this.life / this.maxLife);
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      },
    };
  }

  streak(y) {
    // 横向风痕:长线条从右往左掠过全场
    const h = this.canvas.height;
    const w = this.canvas.width;
    return {
      x: w + rf(0, w * 0.6), y: y ?? rf(h * 0.12, h * 0.85),
      vx: -rf(520, 900), vy: rf(-14, 14),
      life: rf(0.5, 1.1), maxLife: 1.1, len: rf(60, 170),
      color: `rgba(210, 235, 240, ${rf(0.35, 0.8)})`,
      draw(g, dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        g.globalAlpha = Math.max(0, this.life / this.maxLife);
        g.strokeStyle = this.color;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(this.x, this.y);
        g.lineTo(this.x + this.len, this.y + 4);
        g.stroke();
        g.globalAlpha = 1;
      },
    };
  }

  mote(x, y) {
    // 金身光尘:绕锚点缓升
    return {
      x: x + rf(-56, 56), y: y + rf(-10, 70),
      vx: rf(-8, 8), vy: -rf(22, 60),
      life: rf(0.9, 1.7), maxLife: 1.7, size: rf(1.4, 3),
      color: ['#e6c766', '#fff2c0', '#c9a227'][Math.floor(rf(0, 3)) % 3],
      draw(g, dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        g.globalAlpha = Math.max(0, this.life / this.maxLife);
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      },
    };
  }

  rainLine() {
    const w = this.canvas.width;
    return {
      x: rf(0, w), y: rf(-40, -5), vx: -rf(60, 110), vy: rf(520, 760),
      life: rf(0.4, 0.9), maxLife: 0.9,
      color: `rgba(150, 200, 235, ${rf(0.3, 0.65)})`,
      draw(g, dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        g.globalAlpha = Math.max(0, this.life / this.maxLife);
        g.strokeStyle = this.color;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(this.x, this.y);
        g.lineTo(this.x + 6, this.y + 26);
        g.stroke();
        g.globalAlpha = 1;
      },
    };
  }

  ash() {
    // 熄火余烬:灰白碎屑缓缓飘落
    const w = this.canvas.width, h = this.canvas.height;
    return {
      x: rf(0, w), y: rf(0, h * 0.5), vx: rf(-26, 10), vy: rf(18, 60),
      life: rf(0.9, 1.8), maxLife: 1.8, size: rf(1.4, 3),
      color: `rgba(220, 215, 200, ${rf(0.3, 0.7)})`,
      draw(g, dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        g.globalAlpha = Math.max(0, this.life / this.maxLife);
        g.fillStyle = this.color;
        g.fillRect(this.x, this.y, this.size, this.size);
        g.globalAlpha = 1;
      },
    };
  }

  // ---------- 标志性演出 ----------
  // kind: fire/water/gold/wind/fan1/fan2/fan3/backfire/ward
  // 时长 2-3 秒(随加速系数缩放);skipFx 时只保留一道短色闪,保证节奏。
  play(kind, card, { D = 1, skipFx = false } = {}) {
    const anchor = this.anchorOf(card);
    const W = this.canvas.width;
    if (skipFx) {
      const flash = {
        fire: 'linear-gradient(180deg, rgba(255,110,40,0.20), rgba(120,20,8,0.24))',
        water: 'linear-gradient(180deg, rgba(60,140,200,0.20), rgba(16,40,70,0.24))',
        gold: 'linear-gradient(180deg, rgba(230,199,102,0.20), rgba(120,90,20,0.18))',
        wind: 'linear-gradient(180deg, rgba(160,220,225,0.18), rgba(40,80,90,0.2))',
        fan1: 'linear-gradient(180deg, rgba(200,210,200,0.18), rgba(60,70,62,0.22))',
        fan2: 'linear-gradient(180deg, rgba(150,220,230,0.2), rgba(30,70,90,0.22))',
        fan3: 'linear-gradient(180deg, rgba(90,150,220,0.22), rgba(20,40,80,0.26))',
        backfire: 'linear-gradient(180deg, rgba(255,80,30,0.26), rgba(140,20,8,0.3))',
        ward: 'linear-gradient(180deg, rgba(230,199,102,0.22), rgba(120,90,20,0.14))',
      }[kind] ?? 'rgba(255,255,255,0.12)';
      this.tint(flash, 380 * D + 120);
      return sleepMs(380 * D + 120);
    }
    let ms = 2100;
    switch (kind) {
      case 'fire':
        ms = 2200;
        this.tint('radial-gradient(ellipse at 50% 40%, rgba(255,110,40,0.30), rgba(120,20,8,0.16) 65%, transparent)', ms);
        this.spawn(46, () => this.ember(anchor.x + rf(-30, 30), anchor.y + rf(-20, 30), true));
        break;
      case 'water':
        ms = 2100;
        this.tint('radial-gradient(ellipse at 50% 40%, rgba(70,150,210,0.30), rgba(16,40,70,0.18) 65%, transparent)', ms);
        this.spawn(42, () => this.drop(anchor.x, anchor.y));
        break;
      case 'gold':
        ms = 1900;
        this.tint('radial-gradient(ellipse at 50% 55%, rgba(230,199,102,0.26), transparent 70%)', ms);
        this.spawn(34, () => this.mote(anchor.x, anchor.y));
        break;
      case 'wind':
        ms = 2000;
        this.tint('linear-gradient(180deg, rgba(170,225,230,0.20), rgba(40,80,90,0.14))', ms);
        this.spawn(38, () => this.streak());
        break;
      case 'fan1': // 一息火:火色褪为灰烬
        ms = 2400;
        this.tint('linear-gradient(180deg, rgba(205,212,200,0.26), rgba(50,58,52,0.30))', ms);
        this.spawn(40, () => this.ash());
        this.spawn(14, () => this.streak());
        break;
      case 'fan2': // 二生风:满场风痕
        ms = 2300;
        this.tint('linear-gradient(180deg, rgba(150,220,230,0.28), rgba(30,70,90,0.20))', ms);
        this.spawn(56, () => this.streak());
        break;
      case 'fan3': // 三落雨:甘霖普降
        ms = 2600;
        this.tint('linear-gradient(180deg, rgba(90,150,220,0.30), rgba(20,40,80,0.34))', ms);
        this.spawn(90, () => this.rainLine());
        break;
      case 'backfire': // 假扇反噬:火势倒卷
        ms = 2200;
        this.tint('radial-gradient(ellipse at 30% 30%, rgba(255,80,30,0.34), rgba(140,20,8,0.22) 70%, transparent)', ms);
        this.spawn(52, () => this.ember(rf(W * 0.1, W * 0.5), rf(this.canvas.height * 0.2, this.canvas.height * 0.7), true));
        break;
      case 'ward': // 定风丹:一点金光定住风势(短)
        ms = 800;
        this.tint('radial-gradient(ellipse at 50% 50%, rgba(230,199,102,0.22), transparent 60%)', ms);
        this.spawn(16, () => this.mote(anchor.x, anchor.y));
        break;
      default:
        ms = 600;
        break;
    }
    return sleepMs(ms * D);
  }
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
