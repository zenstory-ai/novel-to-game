// 剧本连通性检查（CI 用，无浏览器）：标签都能跳到、资源都已登记、穷举全部选择（含限时沉默、察言观色的细节组合、按住动作成败）都能走到结局。
import assert from 'node:assert/strict';
import { parseScript, Story, HEROINES } from '../js/adv.js';
import { SCRIPT_SOURCES, CAST, SPEAKERS, BG, CG, MUSIC, ENDINGS, FILM, CUT } from '../js/story/index.js';
import { existsSync } from 'node:fs';

const labels = parseScript(SCRIPT_SOURCES, CAST, SPEAKERS);
for (const [label, list] of Object.entries(labels)) {
  for (const cmd of list) {
    const where = `${label}: ${JSON.stringify(cmd).slice(0, 80)}`;
    for (const target of [cmd.target, cmd.miss, ...(cmd.options ?? []).map((o) => o.target)].filter(Boolean)) assert.ok(labels[target], `跳转目标缺失 ${where}`);
    for (const e of [...(cmd.options ?? []).flatMap((o) => o.effects), ...(cmd.effects ?? []), ...(cmd.spots ?? []).flatMap((sp) => sp.effects)]) {
      if (e.remember) assert.ok(CAST[e.remember], `「记下了」的人物未登记 ${where}`);
    }
    if (cmd.t === 'look') {
      for (const sp of cmd.spots) assert.ok(sp.rect.every((v) => v >= 0 && v <= 100) && sp.rect[0] + sp.rect[2] <= 100 && sp.rect[1] + sp.rect[3] <= 100, `细节框超出画面 ${where}`);
      assert.ok(cmd.spots.length > cmd.max, `细节不多于可看次数，察言观色就没有取舍 ${where}`);
    }
    if (cmd.t === 'bg') assert.ok(cmd.id in BG, `背景未登记 ${where}`);
    if (cmd.t === 'cg' && cmd.id) assert.ok(CG[cmd.id], `CG 未登记 ${where}`);
    if (cmd.t === 'bgm' && cmd.id) assert.ok(MUSIC[cmd.id], `曲目未登记 ${where}`);
    if (cmd.t === 'show') assert.ok(CAST[cmd.who], `立绘人物未登记 ${where}`);
    if (cmd.t === 'ending') assert.ok(ENDINGS[cmd.id], `结局未登记 ${where}`);
    if (cmd.t === 'say' && !cmd.name) assert.doesNotMatch(cmd.text, /^\S{1,5}[(（].+?[)）]：/, `疑似说话人或表情写错 ${where}`);
  }
}

// 穷举所有选择（按 label+位置+变量去重），确认每个结局都可达、每个标签都会被走到、没有死路
const reached = new Set();
const seenLabels = new Set();
const story = new Story(labels, { onUnlock: (kind, id) => { if (kind === 'ending') reached.add(id); } });
const BLOCKING = new Set(['choice', 'look', 'hold']);
const runToChoice = () => {
  for (;;) {
    seenLabels.add(story.label);
    const event = story.next();
    if (event.type === 'end') return null;
    if (BLOCKING.has(event.type)) return event;
  }
};
// 每个阻塞点能做的事：选项逐个选；细节取不超过可看次数的每种组合；按住动作成与败
const subsets = (items, max) => items.reduce((acc, item) => acc.concat(acc.filter((a) => a.length < max).map((a) => [...a, item])), [[]]);
function actions(event) {
  if (event.type === 'choice') {
    const open = event.options.filter((o) => o.enabled);
    assert.ok(open.length, `${story.label} 没有可选项`);
    if (event.timed) assert.ok(event.options.some((o) => o.silent), `${story.label} 限时选项缺少沉默分支`);
    return open.map((o) => () => story.choose(o.i));
  }
  if (event.type === 'look') return subsets(event.spots.filter((sp) => !sp.seen), event.left).map((picked) => () => { for (const sp of picked) story.inspect(sp.i); story.endLook(); });
  return [true, false].map((ok) => () => story.resolveHold(ok));
}
// 去重只看之后还会被读到的标记：某个标签往后能到达的所有条件里提到的 flag。
// 察言观色留下的细节标记大多只在下一两场有回声，不这样裁剪，状态会按细节组合成倍增长。
const edges = (list) => list.flatMap((c) => [c.target, c.miss, ...(c.options ?? []).map((o) => o.target), ...(c.t === 'branch' ? [...HEROINES.map((h) => `${h}_route`), 'lonely'] : [])]).filter(Boolean);
const condFlags = (list) => list.flatMap((c) => [c.cond, ...(c.options ?? []).map((o) => o.cond)]).filter(Boolean).flat().filter((c) => c.flag).map((c) => c.flag);
const liveFlags = {};
for (const label of Object.keys(labels)) {
  const live = new Set();
  const stack = [label];
  const visited = new Set();
  while (stack.length) {
    const l = stack.pop();
    if (visited.has(l)) continue;
    visited.add(l);
    condFlags(labels[l]).forEach((f) => live.add(f));
    stack.push(...edges(labels[l]));
  }
  liveFlags[label] = live;
}
const stateKey = (snap) => JSON.stringify([snap.label, snap.ip, snap.vars.aff, Object.keys(snap.vars.flags).filter((f) => liveFlags[snap.label].has(f)).sort()]);

story.start('start');
runToChoice();
const queue = [story.snapshot()];
const seen = new Set();
while (queue.length) {
  const snap = queue.pop();
  story.restore(snap);
  const branches = actions(story.next());
  for (let n = 0; n < branches.length; n += 1) {
    story.restore(snap);
    actions(story.next())[n]();
    if (!runToChoice()) continue;
    const next = story.snapshot();
    const key = stateKey(next);
    if (!seen.has(key)) { seen.add(key); queue.push(next); }
  }
}
const usedCg = new Set(Object.values(labels).flat().filter((c) => c.t === 'cg' && c.id).map((c) => c.id));
assert.deepEqual(Object.keys(CG).filter((id) => id !== 'title' && id !== 'fate' && !usedCg.has(id)), [], '登记了却从不出现的 CG（鉴赏里会永远锁着）');
for (const [id, film] of Object.entries(FILM)) {
  assert.ok(CG[id] || BG[id], `影像没有对应的 CG 或背景：${id}`);
  assert.ok(!CG[id]?.adult, `成人 CG 不配影像：${id}`);
  assert.ok(existsSync(new URL(`../${film.src}`, import.meta.url)), `影像文件缺失：${film.src}`);
}
// 剧情过场：每段登记过、文件齐全、恰好用一次；@cut 与 @cut off 在同一标签里成对，中间不放选择；
// 字幕时间点与其间的台词一一对应、递增；超过片长的句子留到播完后点击推进
const usedCut = new Map();
for (const [label, list] of Object.entries(labels)) {
  let open = null;
  for (const cmd of list) {
    const where = `${label}: ${JSON.stringify(cmd).slice(0, 60)}`;
    if (cmd.t === 'cut' && cmd.id) {
      assert.ok(!open, `上一段过场还没收起 ${where}`);
      assert.ok(CUT[cmd.id], `过场未登记 ${where}`);
      assert.ok(!usedCut.has(cmd.id), `同一段过场用了两次：${cmd.id}`);
      usedCut.set(cmd.id, 0);
      open = cmd.id;
    } else if (cmd.t === 'cut') {
      assert.ok(open, `没有打开的过场却写了 @cut off ${where}`);
      const { cues, seconds } = CUT[open];
      assert.equal(cues.length, usedCut.get(open), `过场 ${open} 的字幕时间点 ${cues.length} 个，台词 ${usedCut.get(open)} 句`);
      // 时间点超过片长的句子在播完后显示，点击推进；但第一句必须在片中出现
      assert.ok(cues[0] < seconds && cues.every((t, i) => t >= 0 && (i === 0 || t > cues[i - 1])), `过场 ${open} 的字幕时间点要递增，第一句在 ${seconds} 秒内`);
      open = null;
    } else if (open && cmd.t === 'say') usedCut.set(open, usedCut.get(open) + 1);
    else if (open) assert.ok(!['choice', 'look', 'hold', 'branch', 'ending', 'jump', 'if', 'bg', 'cg', 'chapter'].includes(cmd.t), `过场 ${open} 收起之前出现了 ${cmd.t} ${where}`);
  }
  assert.ok(!open, `标签 ${label} 结束时过场 ${open} 还没收起`);
}
for (const [id, cut] of Object.entries(CUT)) {
  assert.ok(usedCut.has(id), `登记了却从不播放的过场：${id}`);
  for (const f of [cut.src, `assets/cut/${id}.jpg`]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `过场文件缺失：${f}`);
}
const unreachedLabels = Object.keys(labels).filter((l) => !seenLabels.has(l));
const missingEndings = Object.keys(ENDINGS).filter((id) => !reached.has(id));
assert.deepEqual(missingEndings, [], `穷举全部选择仍未走到的结局：${missingEndings}`);
assert.deepEqual(unreachedLabels, [], `穷举全部选择仍未走到的标签：${unreachedLabels}`);
const chars = Object.values(labels).flat().filter((c) => c.t === 'say').reduce((n, c) => n + c.text.length, 0);
console.log(`剧情过场 ${Object.keys(CUT).length} 段，待机影像 ${Object.keys(FILM).length} 段；选择点状态 ${seen.size} 个；剧本：${Object.keys(labels).length} 个标签、${chars} 字；${Object.keys(ENDINGS).length} 个结局全部可达。`);
