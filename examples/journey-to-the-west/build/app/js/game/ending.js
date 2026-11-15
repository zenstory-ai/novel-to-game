// 结局：真扇三段熄灭火焰山，还扇西行；末尾回读这一路的做法。
// 字幕一句一屏，只等玩家点击或按空格才翻，不自动跳——还扇这类收束句不能让人错过。

import { h, wait } from '../core/dom.js';
import { STORY, SPEAKERS, endingScene as sceneOf } from '../data/story.js';
import { bgArt } from '../data/art.js';
import { createFx } from '../battle/fx.js';
import { endingEchoes } from '../rules/campaign.js';
import { audio } from '../core/audio.js';
import { wipe } from '../ui/dialogue.js';

export function runEnding(stage, campaign) {
  return new Promise((resolve) => {
    audio.music('ending');
    // 每句字幕对应一层地景（规则见 data/story.js 的 endingScene）：积雷山 → 烈火 → 一扇火灭成灰（灰雾未散）
    // → 二扇风吹开灰雾 → 三扇落雨 → 还扇西行。只换图层透明度，叠化过去
    const layer = (key, bg) => h('div.ending-bg', { data: { layer: key }, style: { backgroundImage: `url(${bgArt(bg)})`, opacity: 0 } });
    const layers = { battle: layer('battle', 'leiji'), fire: layer('fire', 'huoyan'), ash: layer('ash', 'huoyan-ash'), rain: layer('rain', 'huoyan-rain'), farewell: layer('farewell', 'ending') };
    const haze = h('div.ending-haze', { style: { opacity: 0 } });
    const paintScene = (scene) => {
      const show = { battle: ['battle'], fire: ['fire'], ash: ['ash'], wind: ['ash'], rain: ['rain'], farewell: ['farewell'] }[scene];
      for (const [key, el] of Object.entries(layers)) el.style.opacity = show.includes(key) ? 1 : 0;
      haze.style.opacity = scene === 'ash' ? 1 : 0;
      root.dataset.scene = scene;
    };
    const canvas = h('canvas.ending-fx');
    const text = h('div.ending-text', { role: 'status' });
    const count = h('span.ending-count');
    const hint = h('div.ending-hint', { data: { ui: 'ending-hint' } }, '点击或按空格继续', count);
    const root = h('div.screen.ending', { data: { ui: 'ending', step: 0, scene: 'battle' } }, ...Object.values(layers).slice(0, 3), haze, ...Object.values(layers).slice(3), canvas, h('div.ending-veil'), text, hint);
    stage.append(root);
    const fx = createFx(canvas);
    fx.ambient('ember');
    paintScene('battle');
    let i = -1, ended = false;

    function showEnd() {
      ended = true;
      window.removeEventListener('keydown', onKey, true);
      hint.remove(); text.remove();
      root.style.cursor = 'default';
      const echoes = endingEchoes(campaign);
      root.dataset.step = 'end';
      root.append(h('div.ending-end', { data: { ui: 'ending-end' } },
        h('h1', {}, h('span', {}, '火息路开'), h('i', {}, ' · '), h('span', {}, '继续西行')),
        h('div.echo.plate', {}, h('h3', {}, '这一路'), echoes.map((line) => h('p', {}, line))),
        h('div.row', {},
          h('button.btn.primary', { type: 'button', data: { act: 'restart' }, onclick: () => done('restart') }, '重走这一难'),
          h('button.btn', { type: 'button', data: { act: 'title' }, onclick: () => done('title') }, '回到标题'))));
    }
    function done(kind) { fx.destroy(); root.remove(); resolve(kind); }

    function next() {
      if (ended) return;
      i += 1;
      if (i >= STORY.ending.length) { showEnd(); return; }
      const line = STORY.ending[i];
      root.dataset.step = String(i + 1);
      count.textContent = ` · ${i + 1}/${STORY.ending.length}`;
      text.classList.remove('swap'); void text.offsetWidth; text.classList.add('swap');
      text.replaceChildren(...(line.who ? [h('span.who', {}, SPEAKERS[line.who].name)] : []), line.text);
      if (line.fan) {
        const label = ['', '一扇 · 息火', '二扇 · 生风', '三扇 · 落雨'][line.fan];
        const el = h('div.ending-fan', {}, label);
        root.append(el);
        setTimeout(() => el.remove(), 2600);
        audio.sfx(`fan${line.fan}`);
        fx.flash('#eafff8', 0.55);
        fx.weather(['', 'ash', 'wind', 'rain'][line.fan], 3.4);
        if (line.fan === 1) fx.ambient(null);
      }
      paintScene(sceneOf(i));
    }
    // 按住不放的自动连发不算翻页，免得一按到底把收束句全跳过
    const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) next(); } };
    root.addEventListener('click', (e) => { if (!ended && !e.target.closest('button')) next(); });
    window.addEventListener('keydown', onKey, true);
    wipe('open').then(() => wait(200)).then(next);
  });
}
