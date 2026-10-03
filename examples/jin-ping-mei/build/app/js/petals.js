// 标题飘落桃花瓣（canvas），并让标题底图随指针轻微视差。系统要求减少动效时只画静止花瓣。
let raf = 0;
let petals = [];
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function petal(w, h, fresh) {
  return {
    x: Math.random() * w,
    y: fresh ? Math.random() * h : -20,
    r: 5 + Math.random() * 7,
    vx: 0.3 + Math.random() * 0.8,
    vy: 0.6 + Math.random() * 1.1,
    a: Math.random() * Math.PI * 2,
    va: (Math.random() - 0.5) * 0.04,
    hue: 340 + Math.random() * 18,
  };
}

export function startPetals(canvas) {
  stopPetals();
  const ctx = canvas.getContext('2d');
  const fit = () => {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  };
  fit();
  window.addEventListener('resize', fit);
  petals = Array.from({ length: 46 }, () => petal(canvas.width, canvas.height, true));
  const draw = () => {
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    for (const p of petals) {
      if (!reduce()) {
        p.x += p.vx * devicePixelRatio + Math.sin(p.a) * 0.4;
        p.y += p.vy * devicePixelRatio;
        p.a += p.va;
        if (p.y > h + 20 || p.x > w + 20) Object.assign(p, petal(w, h, false), { x: Math.random() * w * 0.8 - w * 0.1 });
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.scale(1, 0.62 + Math.sin(p.a * 2) * 0.25);
      ctx.fillStyle = `hsla(${p.hue}, 78%, 86%, 0.85)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * devicePixelRatio, p.r * 0.62 * devicePixelRatio, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    raf = reduce() ? 0 : requestAnimationFrame(draw);
  };
  draw();
  const bg = canvas.parentElement.querySelector('.title-bg');
  stopPetals.move = (e) => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    bg.style.transform = `scale(1.06) translate(${-x * 14}px, ${-y * 10}px)`;
  };
  window.addEventListener('pointermove', stopPetals.move);
  stopPetals.fit = fit;
}

export function stopPetals() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (stopPetals.move) window.removeEventListener('pointermove', stopPetals.move);
  if (stopPetals.fit) window.removeEventListener('resize', stopPetals.fit);
}
