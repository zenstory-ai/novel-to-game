// 宅院剖面视图:固定比例舞台(1672:941),三幕背景交叉淡入,
// 房间锚点、人物立像、仆役提灯动线(核心情报)、风声窃语剪影、灭灯演出。
// 三层景深拉开:远景天色(sky)→ 中景宅院(bg)→ 前景廊柱剪影(fg),配极轻微视差。
// 天色与氛围粒子随节令走;灯火即留宿信号;立绘有呼吸、投影与宠衰装色。
// 可视元素一律经皮肤层键查表;缺图时 assets.js 回退灰盒。
// 粒子与视差只影响画面:粒子用独立的局部 PRNG,绝不碰游戏的 seedRNG 流。

import { compoundStyle, portraitURL, hasImage, urlOf } from './assets.js';
import { SKY } from './data.js';
import { el, clear } from './ui.js';

// 房间锚点(相对舞台 %,取房间地坪)。横向:前厅铺面→厢院→仪门→正房→厢院→花园。
export const ROOMS = {
  xuee:    { x: 10, y: 68 },  // 厨下(前厅铺面一侧)
  lijiaoer:{ x: 23, y: 70 },
  player:  { x: 31, y: 70 },
  gate:    { x: 40, y: 72 },  // 仪门(外间来路)
  ximen:   { x: 43, y: 64 },
  yue:     { x: 55, y: 66 },  // 正房
  chunmei: { x: 63, y: 70 },
  pan:     { x: 68, y: 70 },
  pinger:  { x: 76, y: 70 },
  garden:  { x: 90, y: 72 },
};
const CORRIDOR_Y = 78; // 廊道(动线承载区)

const PORTRAIT_KEY = {
  player: ['portrait/meng_yulou', 'portrait/meng_yulou_mourning'],
  pan: ['portrait/pan_jinlian', 'portrait/pan_jinlian_mourning'],
  pinger: ['portrait/li_pinger', 'portrait/li_pinger'],
  yue: ['portrait/wu_yueniang', 'portrait/wu_yueniang_mourning'],
  xuee: ['portrait/sun_xuee', 'portrait/sun_xuee_mourning'],
  chunmei: ['portrait/pang_chunmei', 'portrait/pang_chunmei_madam'], // 她不穿孝,她高升了
  lijiaoer: ['portrait/li_jiaoer', 'portrait/li_jiaoer'],
  ximen: ['portrait/ximen_qing', 'portrait/ximen_qing'],
};
const NAMES = {
  player: '孟玉楼', pan: '潘金莲', pinger: '李瓶儿', yue: '吴月娘',
  xuee: '孙雪娥', chunmei: '庞春梅', lijiaoer: '李娇儿', ximen: '西门庆',
};
const SERVANT_KEY = {
  daian: 'servant/daian', xiaoyu: 'servant/xiaoyu', fengmama: 'servant/feng_mama', xuemei: 'servant/xue_meipo',
};
const SERVANT_NAMES = { daian: '玳安', xiaoyu: '小玉', fengmama: '冯妈妈', xuemei: '薛媒婆' };

// 各房呼吸相位(立绘浮动错开,不同步才像活人)
const BREATH = { xuee: [5.2, 0], lijiaoer: [6.1, 1.3], player: [5.6, 2.2], ximen: [6.8, 0.7], yue: [6.4, 3.1], chunmei: [5.0, 1.8], pan: [4.6, 2.7], pinger: [6.0, 4.0] };

export function createCompound(stage) {
  stage.classList.add('stage');
  const skyLayer = el('div', 'sky-layer');
  const bgA = el('div', 'bg-layer'), bgB = el('div', 'bg-layer');
  const tintLayer = el('div', 'tint-layer');
  // 大气层:背景图是满幅纸色,天色层被它整个盖住,永远看不见。
  // 这一层压在背景之上,只在剖面图够不到的上下两条空白带上色——上为天,下为地。
  const atmoLayer = el('div', 'atmo-layer');
  const glowLayer = el('div', 'glow-layer');
  const roomLayer = el('div', 'room-layer');
  const moveLayer = el('div', 'move-layer');
  const whisperLayer = el('div', 'whisper-layer');
  const particleCanvas = el('canvas', 'particle-layer');
  const fgLayer = el('div', 'fg-layer');
  stage.append(skyLayer, bgA, bgB, tintLayer, atmoLayer, glowLayer, roomLayer, whisperLayer, moveLayer, particleCanvas, fgLayer);
  let curAct = null;
  let bgFlip = false;
  let curSky = -1;

  // ---------- 极轻微视差(鼠标 2-6px,不晕) ----------
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    skyLayer.style.transform = `translate(${(-dx * 4).toFixed(1)}px, ${(-dy * 2).toFixed(1)}px)`;
    fgLayer.style.transform = `translate(${(dx * 6).toFixed(1)}px, ${(dy * 3).toFixed(1)}px)`;
  });

  // ---------- 氛围粒子(局部 PRNG,密度克制;页面隐藏即停) ----------
  const pctx = particleCanvas.getContext('2d');
  let pType = 'none';
  let parts = [];
  let pSeed = 0x2b79f5;
  const prand = () => {
    pSeed |= 0; pSeed = (pSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(pSeed ^ (pSeed >>> 15), 1 | pSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const P_COUNT = { willow: 30, rain: 46, snow: 38, ember: 22, petal: 24, ash: 26 };
  function seedParticles() {
    const w = particleCanvas.width, h = particleCanvas.height;
    const n = P_COUNT[pType] ?? 0;
    parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: prand() * w, y: prand() * h,
        r: 0.8 + prand() * 2.2,
        vx: (prand() - 0.5) * (pType === 'rain' ? 0.4 : 0.9),
        vy: pType === 'rain' ? 5 + prand() * 3.5
          : pType === 'ember' ? -(0.35 + prand() * 0.8)
          : 0.35 + prand() * 0.75,
        ph: prand() * 6.28, // 摆动相位
      });
    }
  }
  function resizeCanvas() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (particleCanvas.width !== w || particleCanvas.height !== h) {
      particleCanvas.width = w;
      particleCanvas.height = h;
      seedParticles();
    }
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(stage);
  else resizeCanvas();

  function drawParticles(t) {
    requestAnimationFrame(drawParticles);
    if (pType === 'none' || document.hidden) return;
    const w = particleCanvas.width, h = particleCanvas.height;
    if (!w || !h) return;
    pctx.clearRect(0, 0, w, h);
    const swayT = t / 1000;
    for (const p of parts) {
      p.x += p.vx + (pType === 'willow' || pType === 'petal' || pType === 'snow' ? Math.sin(swayT * 0.8 + p.ph) * 0.35 : 0);
      p.y += p.vy;
      if (p.y > h + 8) { p.y = -8; p.x = prand() * w; }
      if (p.y < -12 && pType === 'ember') { p.y = h + 8; p.x = prand() * w; }
      if (p.x > w + 8) p.x = -8; else if (p.x < -8) p.x = w + 8;
      if (pType === 'rain') {
        pctx.strokeStyle = 'rgba(210,220,225,0.28)';
        pctx.lineWidth = 1;
        pctx.beginPath(); pctx.moveTo(p.x, p.y); pctx.lineTo(p.x - 1.5, p.y + 9); pctx.stroke();
      } else if (pType === 'ember') {
        pctx.fillStyle = `rgba(255,${168 + Math.round(40 * Math.sin(swayT + p.ph))},80,${0.35 + 0.3 * Math.sin(swayT * 1.7 + p.ph)})`;
        pctx.beginPath(); pctx.arc(p.x, p.y, p.r * 0.8, 0, 6.283); pctx.fill();
      } else {
        const color = pType === 'snow' ? 'rgba(245,246,248,0.75)'
          : pType === 'petal' ? 'rgba(232,182,192,0.6)'
          : pType === 'ash' ? 'rgba(150,148,142,0.5)'
          : 'rgba(250,248,240,0.7)'; // willow 柳絮
        pctx.fillStyle = color;
        pctx.beginPath(); pctx.arc(p.x, p.y, p.r, 0, 6.283); pctx.fill();
      }
    }
  }
  requestAnimationFrame(drawParticles);

  // ---------- 天色与调光:随节令走,不重画背景图 ----------
  function setSky(festival) {
    if (curSky === festival) return;
    curSky = festival;
    const def = SKY[festival - 1] ?? SKY[0];
    skyLayer.style.background = `linear-gradient(180deg, ${def.sky[0]} 0%, ${def.sky[1]} 100%)`;
    tintLayer.style.background = def.tint;
    tintLayer.dataset.sky = `f${festival}:${def.particles}`;
    // 上带铺天色(节令色),下带铺地影;中段全透明,剖面图不受影响
    atmoLayer.style.background =
      `linear-gradient(180deg, ${def.sky[0]} 0%, ${def.sky[0]}cc 12%, ${def.sky[1]}66 24%, rgba(0,0,0,0) 34%),`
      + `linear-gradient(0deg, rgba(34,26,18,0.55) 0%, rgba(34,26,18,0.22) 8%, rgba(0,0,0,0) 17%)`;
    if (def.particles !== pType) {
      pType = def.particles;
      seedParticles();
    }
  }

  function setAct(actKey) {
    if (curAct === actKey) return;
    curAct = actKey;
    const show = bgFlip ? bgA : bgB;
    const hide = bgFlip ? bgB : bgA;
    bgFlip = !bgFlip;
    Object.assign(show.style, compoundStyle(`compound/${actKey}`));
    show.classList.add('on');
    hide.classList.remove('on');
  }

  // ---------- 与你互动的那一房高亮前推,其余压暗 ----------
  let focusId = null;
  function setFocus(id) {
    focusId = id ?? null;
    roomLayer.classList.toggle('focus-others', !!focusId);
    for (const fig of roomLayer.querySelectorAll('.room-fig')) {
      fig.classList.toggle('focus', fig.dataset.house === focusId);
    }
  }

  function render(state, mingDeadNow) {
    setSky(state.festival);
    clear(roomLayer);
    clear(whisperLayer);
    clear(glowLayer);
    const mourning = state.festival >= 19;
    for (const r of Object.values(state.rivals)) {
      if (!r.joined || !r.alive) continue; // 春梅不上榜,但她在宅子里,看得见
      putPortrait(r.id, mourning, r.ming);
      putGlow(r.id, state, mourning);
    }
    putPortrait('player', mourning, state.player.chong * 1.6 + state.player.tiyan * 0.4);
    putGlow('player', state, mourning);
    if (!mingDeadNow && state.festival >= 2) {
      putPortrait('ximen', false, 60);
      putGlow('ximen', state, false);
    }
    // 风声≥60:廊下出现窃窃私语的仆役剪影(可读预警)
    if (state.player.fengsheng >= 60) {
      for (const x of [36, 58, 82]) {
        const w = el('div', 'whisper');
        w.style.left = `${x}%`;
        w.style.top = `${CORRIDOR_Y - 8}%`;
        whisperLayer.appendChild(w);
      }
    }
    if (focusId) setFocus(focusId);
  }

  // 灯火层:全作最省事也最扎心的信号——被留宿那一房的窗亮着,其余暗着。
  // 第三幕灯灭大半,只剩正房与玩家房里一点。
  function putGlow(id, state, mourning) {
    const a = ROOMS[id];
    if (!a) return;
    const g = el('div', 'room-glow');
    g.style.left = `${a.x}%`;
    g.style.top = `${a.y - 10}%`;
    if (mourning) {
      if (id !== 'player' && id !== 'yue') g.classList.add('dim');
    } else if (state.lodging === id) {
      g.classList.add('lit');        // 今夜灯落在这里
      g.dataset.lodging = id;
    } else {
      g.classList.add('dark');       // 你的院子黑着,别人的亮着
    }
    glowLayer.appendChild(g);
  }

  // 立绘:得宠衣饰更盛,失宠素净——皮肤层是单图,用饱和与明度逼近装色(换装仍走 mourning 资产)
  function putPortrait(id, mourning, vigor = 50) {
    const a = ROOMS[id];
    if (!a) return;
    const wrap = el('div', `room-fig fig-${id}`);
    wrap.dataset.house = id;
    wrap.style.left = `${a.x}%`;
    wrap.style.top = `${a.y}%`;
    const keys = PORTRAIT_KEY[id];
    const key = mourning ? keys[1] : keys[0];
    const img = el('img', 'fig-img');
    img.src = portraitURL(key, NAMES[id]);
    img.alt = NAMES[id];
    img.draggable = false;
    if (!mourning) {
      if (vigor >= 55) img.classList.add('bloom');
      else if (vigor <= 25) img.classList.add('pale');
    }
    const [dur, delay] = BREATH[id] ?? [5.5, 0];
    img.style.animationDuration = `${dur}s`;
    img.style.animationDelay = `${-delay}s`;
    wrap.appendChild(img);
    wrap.appendChild(el('span', 'fig-name', NAMES[id]));
    roomLayer.appendChild(wrap);
  }

  // 仆役提灯动线:谁往谁屋里去 = 玩家的核心情报
  function playSightings(sightings, fast) {
    const jobs = sightings.slice(0, 4).map((s, i) => runOne(s, i * (fast ? 0 : 500), fast));
    return Promise.all(jobs);
  }

  function runOne(s, delay, fast) {
    return new Promise((resolve) => {
      const from = ROOMS[s.from] ?? ROOMS.gate;
      const to = ROOMS[s.to] ?? ROOMS.garden;
      const fig = el('div', 'mover');
      const img = el('img', 'mover-img');
      img.src = urlOf(SERVANT_KEY[s.servant]) ?? portraitURL(SERVANT_KEY[s.servant], SERVANT_NAMES[s.servant] ?? '仆', false);
      img.alt = SERVANT_NAMES[s.servant] ?? '仆役';
      img.draggable = false;
      const lamp = el('span', 'mover-lamp');
      fig.append(lamp, img);
      moveLayer.appendChild(fig);
      const dur = fast ? 60 : 700;
      const steps = [
        { x: from.x, y: CORRIDOR_Y },
        { x: to.x, y: CORRIDOR_Y },
        { x: to.x, y: to.y + 6 },
      ];
      fig.style.left = `${from.x}%`;
      fig.style.top = `${from.y + 6}%`;
      let i = 0;
      const stepNext = () => {
        if (i >= steps.length) {
          setTimeout(() => { fig.remove(); resolve(); }, fast ? 60 : 500);
          return;
        }
        const st = steps[i++];
        fig.style.transitionDuration = `${dur}ms`;
        fig.style.left = `${st.x}%`;
        fig.style.top = `${st.y}%`;
        setTimeout(stepNext, dur + 40);
      };
      setTimeout(stepNext, delay);
    });
  }

  // 第79回:灯火逐间熄灭
  function lightsOut() {
    stage.classList.add('lights-out');
  }
  function clearLights() {
    stage.classList.remove('lights-out');
  }

  return { setAct, render, playSightings, lightsOut, clearLights, setFocus, ROOMS };
}
