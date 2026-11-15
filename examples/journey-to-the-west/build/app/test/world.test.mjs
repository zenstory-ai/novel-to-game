// 场景与素材回归：四张图处处走得到，文案里引用的人物与图片都在。
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCENES, LANDMARKS, WALK_ART, WALK_SHEETS, MAP_SIZE, BANTER, BARKS } from '../js/data/maps.js';
import { createNav, pathLength } from '../js/rules/nav.js';
import { readMs, holdFor, pace } from '../js/core/dom.js';
import { haulText } from '../js/rules/treasure.js';
import { createBattle } from '../js/rules/battle.js';
import { STORY, SPEAKERS, CHOICES, CHAPTERS, COACH, HELP, endingScene } from '../js/data/story.js';
import { PARTY, ENEMIES, FORMS, ITEMS, EQUIPS, TREASURES, BATTLES, SKILLS, STUNTS, BUFF_INFO } from '../js/data/combat.js';
import { FACES, unitArt, walkArt, walkSheet, itemArt, bgArt, mapArt, uiArt, ELEMENT_ICON } from '../js/data/art.js';

const APP = fileURLToPath(new URL('..', import.meta.url));
const has = (rel) => existsSync(`${APP}/${rel}`);

test('四张图：从出生点走得到每个人、每个阵、每处支路与每个明雷点', () => {
  for (const scene of Object.values(SCENES)) {
    const nav = createNav(scene, MAP_SIZE);
    const start = nav.nearest(...scene.spawn);
    assert.ok(nav.walkable(...start), `${scene.id} 出生点`);
    const targets = [
      ...Object.entries(scene.npcs).map(([id, n]) => [`人物 ${id}`, n.at]),
      ...Object.entries(scene.portals).map(([id, p]) => [`传送阵 ${id}`, p.at]),
      ...Object.entries(scene.landmarks ?? {}).map(([id, l]) => [`支路 ${id}`, l.at]),
      ...Object.entries(scene.arrivals).map(([id, a]) => [`落脚点 ${id}`, a]),
      ...(scene.demonSpawns ?? []).map((p, i) => [`明雷 ${i}`, p]),
    ];
    for (const [name, at] of targets) {
      const goal = nav.nearest(...at);
      assert.ok(Math.hypot(goal[0] - at[0], goal[1] - at[1]) < 130, `${scene.id} ${name} 离可走处太远`);
      const path = nav.path(start, at);
      assert.ok(path.length > 0 || Math.hypot(start[0] - goal[0], start[1] - goal[1]) < 30, `${scene.id} ${name} 走不到`);
      let prev = start;
      for (const p of path) {
        const steps = Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 10);
        for (let i = 1; i <= steps; i += 1) {
          const x = prev[0] + ((p[0] - prev[0]) * i) / steps, y = prev[1] + ((p[1] - prev[1]) * i) / steps;
          const [cx, cy] = [Math.floor(x / nav.cell), Math.floor(y / nav.cell)];
          assert.equal(nav.grid[cy * nav.cols + cx], 1, `${scene.id} 去${name}的路穿过了走不得的地方 (${Math.round(x)},${Math.round(y)})`);
        }
        prev = p;
      }
      assert.ok(pathLength(start, path) < 6000);
    }
  }
});

test('走不得的地方点上去，会落到最近的可走处；方向键贴墙时沿边滑动而不穿墙', () => {
  const nav = createNav(SCENES.village, MAP_SIZE);
  const [bx0, by0, bx1, by1] = SCENES.village.blocks[0];
  const inside = [(bx0 + bx1) / 2, (by0 + by1) / 2];
  assert.equal(nav.walkable(...inside), false);
  const near = nav.nearest(...inside);
  assert.equal(nav.walkable(...near), true);
  const [x, y] = nav.nearest(...SCENES.village.spawn);
  const moved = nav.slide(x, y, 6, 0);
  assert.equal(nav.walkable(...moved), true);
  assert.deepEqual(nav.slide(...near, inside[0] - near[0], inside[1] - near[1]).length, 2);
});

test('每处支路去处都落在自己那张图上，并且有重访时的说法', () => {
  for (const [id, def] of Object.entries(LANDMARKS)) {
    assert.ok(SCENES[def.scene].landmarks[id], `${id} 不在 ${def.scene}`);
    assert.ok(def.intro && def.revisit && def.options.length >= 1);
    for (const o of def.options) assert.ok(o.result);
  }
});

test('对白里的说话人都登记过，立绘与头像取景都在', () => {
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      if ('text' in node && node.who != null) assert.ok(SPEAKERS[node.who], `未登记的说话人 ${node.who}`);
      Object.values(node).forEach(walk);
    }
    return null;
  };
  walk(STORY);
  for (const sp of Object.values(SPEAKERS)) { assert.ok(has(unitArt(sp.art)), `缺立绘 ${sp.art}`); assert.ok(FACES[sp.art], `缺头像取景 ${sp.art}`); }
  for (const line of BANTER) assert.ok(['tang', 'bajie', 'sha'].includes(line.who));
  for (const id of Object.keys(BARKS)) assert.ok(Object.values(SCENES).some((s) => s.npcs[id]), `闲话的人 ${id} 不在任何场景`);
});

test('运行时会读的图片与音频都在包里', () => {
  for (const def of [...Object.values(PARTY), ...Object.values(ENEMIES)]) { assert.ok(has(unitArt(def.art)), `单位立绘 ${def.art}`); assert.ok(FACES[def.art], `头像取景 ${def.art}`); }
  for (const f of Object.values(FORMS)) assert.ok(has(unitArt(f.art)), `形态立绘 ${f.art}`);
  for (const k of ['crab', 'nezha', 'lingji']) assert.ok(has(unitArt(k)));
  for (const k of [...Object.keys(ITEMS), ...Object.keys(EQUIPS)]) assert.ok(has(itemArt(k)), `物品图 ${k}`);
  for (const t of Object.values(TREASURES)) assert.ok(has(`assets/treasure/${t.art}.jpg`));
  for (const b of Object.values(BATTLES)) assert.ok(has(bgArt(b.bg)), `战场 ${b.bg}`);
  for (const k of ['title', 'bibotan', 'huoyan', 'huoyan-rain', 'ending', 'cuiyun']) assert.ok(has(bgArt(k)), `底景 ${k}`);
  for (const scene of Object.values(SCENES)) {
    assert.ok(has(mapArt(scene.id)), `绘景 ${scene.id}`);
    for (const n of Object.values(scene.npcs)) { assert.ok(has(walkArt(n.art)), `行走图 ${n.art}`); assert.ok(WALK_ART[n.art]); }
  }
  for (const k of ['wukong', 'tang', 'bajie', 'sha', 'mob_fire1', 'mob_fire2']) assert.ok(has(walkArt(k)));
  for (const k of Object.keys(WALK_SHEETS)) for (const d of ['front', 'back']) assert.ok(has(walkSheet(k, d)), `行走图集 ${k}_${d}`);
  for (const k of ['attack', 'spell', 'defend', 'bag', 'special', 'hero', 'pet', 'quest', 'formation', 'settings', 'coin', 'vitality', 'speed', 'armor', ...Object.values(ELEMENT_ICON)]) assert.ok(has(uiArt(k)), `界面图标 ${k}`);
  for (const k of ['title', 'overworld', 'battle', 'boss', 'ending']) assert.ok(has(`assets/audio/bgm/${k}.mp3`));
  for (const k of ['click', 'hit', 'crit', 'ke', 'heal', 'fan1', 'fan2', 'fan3', 'transform', 'telegraph', 'heavy', 'victory', 'defeat', 'levelup', 'quest', 'portal', 'step', 'coin', 'encounter', 'firefx', 'waterfx', 'skill', 'thud']) assert.ok(has(`assets/audio/sfx/${k}.mp3`), `音效 ${k}`);
});

test('上屏文案不带策划词、内部键名与提前的剧透', () => {
  const texts = [];
  const collect = (node) => {
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect([STORY, CHOICES, CHAPTERS, COACH, HELP, LANDMARKS, BANTER, BARKS]);
  for (const t of Object.values({ ...SKILLS, ...STUNTS })) if (t.desc) texts.push(t.name, t.desc);
  for (const t of [...Object.values(ITEMS), ...Object.values(EQUIPS), ...Object.values(TREASURES), ...Object.values(FORMS)]) texts.push(t.name, t.desc);
  for (const b of Object.values(BATTLES)) { texts.push(b.name, b.goal); if (b.retryHint) texts.push(b.retryHint); if (b.field) texts.push(b.field.name, b.field.short, b.field.desc); }
  for (const b of Object.values(BUFF_INFO)) texts.push(b.name);
  const banned = /物理|单体|群体|输出|增益|减益|buff|debuff|AOE|DPS|BOSS|好感|数值|undefined|NaN|\bnull\b|TODO|作为一名|请注意/i;
  for (const t of texts) assert.ok(!banned.test(t), `文案里有不该上屏的词：${t}`);
  assert.equal(ITEMS.fakefan.name, '芭蕉扇');
  assert.ok(!/假|伪/.test(ITEMS.fakefan.desc), '没识破前不能在说明里点破假扇');
  const early = [...STORY.prologue, ...STORY.tudi, ...STORY.luoshaPre1, ...STORY.gotFan].map((l) => l.text).join('');
  assert.ok(!/假扇|假的/.test(early), '拿到扇子之前的对白不该提假扇');
});

test('结局图文一致：字幕写火已退、灰烬被吹走、落雨时，画面不能还是满山烈火；每层地景都有图', () => {
  const scenes = STORY.ending.map((_, i) => endingScene(i));
  STORY.ending.forEach((line, i) => {
    if (/退去|灰烬|落雨|无火|雨后/.test(line.text)) assert.notEqual(scenes[i], 'fire', `第 ${i + 1} 句「${line.text.slice(0, 12)}…」画面仍是烈火`);
    if (/灰烬/.test(line.text)) assert.equal(scenes[i], 'wind', '灰烬被风卷走那一句要看得见风吹开的西路');
    if (/落雨|雨脚/.test(line.text)) assert.equal(scenes[i], 'rain');
  });
  const first = STORY.ending.findIndex((l) => l.fan === 1);
  assert.equal(scenes[first], 'ash', '一扇息火那一句就换成火灭后的灰烬地景');
  for (const key of ['huoyan', 'huoyan-ash', 'huoyan-rain', 'ending']) assert.ok(has(bgArt(key)), `结局底景 ${key}`);
});

test('蓄力与接力的文案和结算一致：不再写「八戒与土地从侧翼杀到」，蓄力提示写明已锁定', () => {
  assert.ok(!/八戒与土地从侧翼杀到/.test(STORY.phase2.map((l) => l.text).join('')));
  assert.match(STORY.phase2.map((l) => l.text).join(''), /土地/);
  assert.match(COACH.heavy, /锁定/);
  assert.match(BATTLES.niumowang.retryHint, /锁定/);
});

test('字的停留：横幅与提示按字数给足阅读时间（约每秒 6–7 字），玩家开「演出加速」也不缩短', () => {
  const sub = '现了原形，五行转土——克它的是木';
  assert.ok(readMs(`白牛真身${sub}`) >= ((4 + sub.length) / 7) * 1000);
  const saved = { base: pace.base, speed: pace.speed };
  pace.base = 1; pace.speed = 2;
  assert.ok(holdFor(1200, `白牛真身${sub}`) >= readMs(`白牛真身${sub}`), '加速 ×2 不压缩阅读时间');
  pace.base = saved.base; pace.speed = saved.speed;
});

test('小处文案：残图所得没东西才写「无」；同名敌人用短名加甲乙，窄屏名牌放得下', () => {
  assert.equal(haulText({}, 2), '残简 2');
  assert.equal(haulText({}, 0), '无');
  assert.match(haulText({ jinchuang: 1 }, 1), /^金疮药 ×1、残简 1$/);
  for (const id of Object.keys(BATTLES)) {
    const st = createBattle({ battleId: id, party: [{ key: 'wukong', level: 3 }], formation: 'tiangang', items: {}, seed: 1 });
    for (const u of st.units.filter((x) => x.side === 'enemy')) assert.ok([...u.name].length <= 6, `${id} 的「${u.name}」太长，窄屏名牌会被截断`);
  }
});
