// 天气与标题页的粒子层：落花（petals）与雨（rain）。画在一张 canvas 上，页面不可见或没有天气时不耗帧。
const PETAL_COLORS = ['#f6c1cf', '#f2a9bd', '#fbdbe3', '#ee96b0'];

export class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.kind = null;
    this.items = [];
    this.raf = 0;
    this.last = 0;
    this.tick = this.tick.bind(this);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.kind) this.run(); });
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.w = box.width;
    this.h = box.height;
    this.canvas.width = Math.max(1, Math.round(box.width * ratio));
    this.canvas.height = Math.max(1, Math.round(box.height * ratio));
    this.g.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  set(kind) {
    if (kind === this.kind) return;
    this.kind = kind;
    this.items = [];
    this.canvas.dataset.kind = kind ?? '';
    if (!kind) { cancelAnimationFrame(this.raf); this.raf = 0; this.g.clearRect(0, 0, this.w ?? 0, this.h ?? 0); return; }
    this.resize();
    const count = kind === 'rain' ? Math.round(this.w / 9) : Math.round(Math.min(46, this.w / 30));
    for (let i = 0; i < count; i += 1) this.items.push(this.spawn(true));
    this.run();
  }

  spawn(anywhere) {
    const { w, h } = this;
    if (this.kind === 'rain') {
      return { x: Math.random() * (w + 200) - 100, y: anywhere ? Math.random() * h : -40, len: 14 + Math.random() * 22, v: 900 + Math.random() * 500, a: 0.12 + Math.random() * 0.22 };
    }
    return {
      x: Math.random() * (w + 160) - 80, y: anywhere ? Math.random() * h : -20,
      r: 4 + Math.random() * 6, v: 26 + Math.random() * 44, drift: 14 + Math.random() * 30,
      phase: Math.random() * 6.28, spin: (Math.random() - 0.5) * 2.4, rot: Math.random() * 6.28,
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)], a: 0.55 + Math.random() * 0.4,
    };
  }

  run() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.raf = 0;
    if (!this.kind || document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { g, w, h } = this;
    g.clearRect(0, 0, w, h);
    if (this.kind === 'rain') {
      g.lineWidth = 1.1;
      g.lineCap = 'round';
      for (const p of this.items) {
        p.y += p.v * dt;
        p.x -= p.v * dt * 0.16;
        if (p.y > h + 40) Object.assign(p, this.spawn(false));
        g.strokeStyle = `rgba(206, 220, 255, ${p.a})`;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x + p.len * 0.16, p.y - p.len);
        g.stroke();
      }
    } else {
      for (const p of this.items) {
        p.phase += dt * 1.3;
        p.rot += p.spin * dt;
        p.y += p.v * dt;
        p.x += Math.sin(p.phase) * p.drift * dt + 10 * dt;
        if (p.y > h + 20 || p.x > w + 90) Object.assign(p, this.spawn(false));
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, 0.55 + 0.4 * Math.sin(p.phase * 1.7));
        g.globalAlpha = p.a;
        g.fillStyle = p.color;
        g.beginPath();
        g.moveTo(0, -p.r);
        g.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.8, 0, p.r);
        g.bezierCurveTo(-p.r * 0.7, p.r * 0.8, -p.r * 0.9, -p.r * 0.6, 0, -p.r);
        g.fill();
        g.restore();
      }
    }
    this.raf = requestAnimationFrame(this.tick);
  }
}
