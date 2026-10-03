// 剧本连通性检查（CI 用，无浏览器）：标签都能跳到、资源都已登记、穷举全部选择都能走到结局。
import assert from 'node:assert/strict';
import { parseScript, Story, HEROINES } from '../js/adv.js';
import { SCRIPT_SOURCES, CAST, SPEAKERS, BG, CG, MUSIC, ENDINGS } from '../js/story/index.js';

const labels = parseScript(SCRIPT_SOURCES, CAST, SPEAKERS);
for (const [label, list] of Object.entries(labels)) {
  for (const cmd of list) {
    const where = `${label}: ${JSON.stringify(cmd).slice(0, 80)}`;
    for (const target of [cmd.target, ...(cmd.options ?? []).map((o) => o.target)].filter(Boolean)) assert.ok(labels[target], `跳转目标缺失 ${where}`);
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
const runToChoice = () => {
  for (;;) {
    seenLabels.add(story.label);
    const event = story.next();
    if (event.type === 'end') return null;
    if (event.type === 'choice') return event;
  }
};
story.start('start');
runToChoice();
const queue = [story.snapshot()];
const seen = new Set();
while (queue.length) {
  const snap = queue.pop();
  story.restore(snap);
  const open = story.next().options.filter((o) => o.enabled);
  assert.ok(open.length, `${story.label} 没有可选项`);
  for (const option of open) {
    story.restore(snap);
    story.next();
    story.choose(option.i);
    if (!runToChoice()) continue;
    const next = story.snapshot();
    const key = JSON.stringify([next.label, next.ip, next.vars]);
    if (!seen.has(key)) { seen.add(key); queue.push(next); }
  }
}
const usedCg = new Set(Object.values(labels).flat().filter((c) => c.t === 'cg' && c.id).map((c) => c.id));
assert.deepEqual(Object.keys(CG).filter((id) => id !== 'title' && id !== 'fate' && !usedCg.has(id)), [], '登记了却从不出现的 CG（鉴赏里会永远锁着）');
const unreachedLabels = Object.keys(labels).filter((l) => !seenLabels.has(l));
const missingEndings = Object.keys(ENDINGS).filter((id) => !reached.has(id));
assert.deepEqual(missingEndings, [], `穷举全部选择仍未走到的结局：${missingEndings}`);
assert.deepEqual(unreachedLabels, [], `穷举全部选择仍未走到的标签：${unreachedLabels}`);
const chars = Object.values(labels).flat().filter((c) => c.t === 'say').reduce((n, c) => n + c.text.length, 0);
console.log(`选择点状态 ${seen.size} 个；剧本：${Object.keys(labels).length} 个标签、${chars} 字；${Object.keys(ENDINGS).length} 个结局全部可达。`);
