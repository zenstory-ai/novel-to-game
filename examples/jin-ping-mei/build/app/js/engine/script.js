// 剧本编译器：把 story/*.js 的行式剧本编译成一条扁平指令带。纯函数、无 DOM，浏览器与 node 共用。
//
// 剧本语法（每行一条）：
//   # label                      标签（跳转目标）。每个标签必须以 @jump / @end / @choice / @hold / @branch 收尾
//   名(表情)：台词                 说话。名是 CAST 的短名或 SPEAKERS 里的名字；表情 平/笑/怒/哀/羞/惊
//   其他文字                       旁白
//   @bg id [fade|cut]            背景（同时收起 CG 与过场）；cut 不做交叉淡入
//   @bgm id|stop                 配乐            @weather rain|petals|none   天气层
//   @show id 左|中|右 [表情]      立绘登场或换位   @hide id|all               立绘退场
//   @fx shake                    镜头一震
//   @chapter 标题|副题            章节卡；也是剧情树节点与存档里的章节名
//   @cg id | @cg off             CG
//   @cut id | @cut off           剧情过场：其后的台词是它的字幕，第 i 句在 CUT[id].cues[i] 秒出现；必须在同一标签里成对
//   @scene id 题名 … @endscene    回想区段（鉴赏里可重看）
//   @choice [秒 -> 沉默label {效果}]   选项；写了秒数就是限时抉择，时间到走沉默分支
//     - 文本 -> label {yue+1 f:flag r:yue} ?条件     r:人物 = 盖「她记下了」的印
//   @look 提示                    察言观色：在当前 CG 上看细节，至多三处
//     - x,y,w,h 名称：看见什么 {f:flag}             坐标是画面百分比
//   @hold 毫秒 提示 -> 成功label | 失败label       按住动作
//   @jump label | @if 条件 -> label | @do 效果
//   @branch                      分岔夜：心意够的院门亮灯，全灭则去 lonely
//   @ending id | @fate 人物 | @end
// 条件：f:flag、!f:flag、yue>=7，多个用 & 连接。

export const EXPR = Object.freeze({ 平: 'neutral', 笑: 'smile', 怒: 'angry', 哀: 'sad', 羞: 'blush', 惊: 'surprised' });
export const POS = Object.freeze({ 左: 'left', 中: 'center', 右: 'right' });
export const LOOK_MAX = 3;
export const SILENT_TEXT = '（不作声）';

const SAY = /^([^\s：:@#\-（(][^：（(]{0,5}?)(?:[(（]([平笑怒哀羞惊])[)）])?：(.+)$/;
const TERMINAL = new Set(['jump', 'end', 'choice', 'hold', 'branch']);

function fail(where, message) {
  throw new Error(`剧本 ${where}：${message}`);
}

export function parseEffects(text = '', where = '') {
  return text.trim().split(/\s+/).filter(Boolean).map((token) => {
    if (token.startsWith('f:')) return { flag: token.slice(2) };
    if (token.startsWith('r:')) return { remember: token.slice(2) };
    const m = token.match(/^(\w+)([+-]\d+)$/);
    if (!m) fail(where, `效果写法不对「${token}」`);
    return { aff: m[1], delta: Number(m[2]) };
  });
}

export function parseCond(text, where = '') {
  if (!text) return null;
  return text.split('&').map((part) => {
    const s = part.trim();
    let m = s.match(/^(!?)f:(\w+)$/);
    if (m) return { flag: m[2], not: m[1] === '!' };
    m = s.match(/^(\w+)(>=|<=|>|<|==)(-?\d+)$/);
    if (!m) fail(where, `条件写法不对「${s}」`);
    return { aff: m[1], op: m[2], value: Number(m[3]) };
  });
}

export function testCond(cond, vars) {
  if (!cond) return true;
  return cond.every((c) => {
    if (c.flag) return Boolean(vars.flags[c.flag]) !== c.not;
    const v = vars.aff[c.aff] ?? 0;
    return { '>=': v >= c.value, '<=': v <= c.value, '>': v > c.value, '<': v < c.value, '==': v === c.value }[c.op];
  });
}

function directive(op, rest, arg, where) {
  switch (op) {
    case 'bg': return { t: 'bg', id: rest[0], fx: rest[1] || 'fade' };
    case 'bgm': return { t: 'bgm', id: rest[0] === 'stop' ? null : rest[0] };
    case 'weather': return { t: 'weather', id: rest[0] === 'none' ? null : rest[0] };
    case 'show': return { t: 'show', who: rest[0], pos: POS[rest[1]] || 'center', expr: EXPR[rest[2]] || 'neutral' };
    case 'hide': return { t: 'hide', who: rest[0] };
    case 'fx': return { t: 'fx', id: rest[0] };
    case 'chapter': { const [title, sub = ''] = arg.split('|'); return { t: 'chapter', title: title.trim(), sub: sub.trim() }; }
    case 'cg': return { t: 'cg', id: rest[0] === 'off' ? null : rest[0] };
    case 'cut': return { t: 'cut', id: rest[0] === 'off' ? null : rest[0] };
    case 'scene': return { t: 'scene', id: rest[0], title: rest.slice(1).join(' ') };
    case 'endscene': return { t: 'endscene' };
    case 'choice': {
      const cmd = { t: 'choice', options: [], timed: 0 };
      if (arg) {
        const m = arg.match(/^(\d+)\s*->\s*(\w+)\s*(?:\{([^}]*)\})?$/);
        if (!m) fail(where, '限时选项写法不对');
        cmd.timed = Number(m[1]);
        cmd.silent = { text: SILENT_TEXT, target: m[2], effects: parseEffects(m[3], where), cond: null, silent: true };
      }
      return cmd;
    }
    case 'look': return { t: 'look', prompt: arg, max: LOOK_MAX, spots: [] };
    case 'hold': {
      const m = arg.match(/^(\d+)\s+(.+?)\s*->\s*(\w+)\s*\|\s*(\w+)$/);
      if (!m) fail(where, '按住动作写法不对');
      return { t: 'hold', ms: Number(m[1]), prompt: m[2], target: m[3], miss: m[4] };
    }
    case 'jump': return { t: 'jump', target: rest[0] };
    case 'if': {
      const m = arg.match(/^(\S+)\s*->\s*(\w+)$/);
      if (!m) fail(where, '@if 写法不对');
      return { t: 'if', cond: parseCond(m[1], where), target: m[2] };
    }
    case 'do': return { t: 'do', effects: parseEffects(arg, where) };
    case 'branch': return { t: 'branch' };
    case 'ending': return { t: 'ending', id: rest[0] };
    case 'fate': return { t: 'fate', who: rest[0] };
    case 'end': return { t: 'end' };
    default: return fail(where, `未知指令 @${op}`);
  }
}

// 返回 { ops, labels, chapters, scenes }：
//   ops      扁平指令带，每条带 at（'label:序号'，已读、已选与存档都用它认位置）与 label
//   labels   label → 起始下标
//   chapters label → { title, sub, at }   scenes  id → { title, label }
export function compile(sources, { cast, speakers }) {
  const byName = Object.fromEntries(Object.entries(cast).map(([id, c]) => [c.name, id]));
  const ops = [];
  const labels = {};
  const chapters = {};
  const scenes = {};
  let label = null;
  let count = 0;
  let list = null; // 正在收选项或细节的那条指令
  const closeLabel = () => {
    if (!label) return;
    const last = ops[ops.length - 1];
    if (!last || last.label !== label) fail(label, '标签是空的');
    if (!TERMINAL.has(last.t)) fail(label, '没有用 @jump / @end / @choice / @hold / @branch 收尾');
  };
  const push = (cmd) => {
    cmd.label = label;
    cmd.at = `${label}:${count}`;
    count += 1;
    ops.push(cmd);
    return cmd;
  };

  for (const source of sources) {
    for (const raw of source.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      if (line.startsWith('# ')) {
        closeLabel();
        label = line.slice(2).trim();
        if (label in labels) fail(label, '标签重复');
        labels[label] = ops.length;
        count = 0;
        list = null;
        continue;
      }
      if (!label) fail('(开头)', `标签之外的行「${line}」`);
      const where = `${label}「${line.slice(0, 24)}」`;
      if (line.startsWith('- ') && list?.t === 'choice') {
        const m = line.slice(2).match(/^(.+?)\s*->\s*(\w+)\s*(?:\{([^}]*)\})?\s*(?:\?(\S+))?$/);
        if (!m) fail(where, '选项写法不对');
        list.options.push({ text: m[1].trim(), target: m[2], effects: parseEffects(m[3], where), cond: parseCond(m[4], where) });
        continue;
      }
      if (line.startsWith('- ') && list?.t === 'look') {
        const m = line.slice(2).match(/^([\d.]+),([\d.]+),([\d.]+),([\d.]+)\s+([^：]+)：(.+?)\s*\{([^}]*)\}$/);
        if (!m) fail(where, '细节写法不对');
        const effects = parseEffects(m[7], where);
        const flag = effects.find((e) => e.flag)?.flag;
        if (!flag) fail(where, '细节要记一个 f:标记');
        list.spots.push({ rect: m.slice(1, 5).map(Number), name: m[5].trim(), text: m[6].trim(), effects, flag });
        continue;
      }
      list = null;
      if (line.startsWith('@')) {
        const [op, ...rest] = line.slice(1).split(/\s+/);
        const cmd = push(directive(op, rest, line.slice(op.length + 2).trim(), where));
        if (cmd.t === 'choice' || cmd.t === 'look') list = cmd;
        if (cmd.t === 'chapter') chapters[label] = { title: cmd.title, sub: cmd.sub, at: cmd.at };
        if (cmd.t === 'scene') scenes[cmd.id] = { title: cmd.title, label };
        continue;
      }
      const m = line.match(SAY);
      if (m && (byName[m[1]] || m[1] in speakers)) {
        push({ t: 'line', who: byName[m[1]] ?? null, name: m[1], expr: m[2] ? EXPR[m[2]] : null, text: m[3].trim() });
      } else {
        push({ t: 'line', who: null, name: '', expr: null, text: line });
      }
    }
  }
  closeLabel();

  for (const cmd of ops) {
    if (cmd.t === 'choice') {
      if (cmd.silent) cmd.options.push(cmd.silent);
      if (!cmd.options.length) fail(cmd.at, '@choice 下面没有选项');
    }
    if (cmd.t === 'look' && !cmd.spots.length) fail(cmd.at, '@look 下面没有细节');
    for (const target of jumpTargets(cmd)) if (!(target in labels)) fail(cmd.at, `跳到不存在的标签 ${target}`);
  }
  return { ops, labels, chapters, scenes };
}

// 一条指令可能跳去的标签（@branch 的去向由运行时按人物补上）
export function jumpTargets(cmd) {
  return [cmd.target, cmd.miss, ...(cmd.options ?? []).map((o) => o.target)].filter(Boolean);
}
