// ADV 解释器：把 story/*.js 里的行式剧本解析成指令，再一步步执行到下一处需要玩家的地方。
// 纯逻辑、无 DOM，浏览器与 node（test/lint_script.mjs）共用。
//
// 剧本语法（每行一条）：
//   # label                     标签
//   名(表情)：台词               说话；名可为 CAST 里的中文名，表情为 平/笑/怒/哀/羞/惊
//   其他文字                     旁白
//   @bg id [fade|cut|flash]     背景      @bgm id|stop    @se id    @weather rain|petals|none
//   @show id 左|中|右 [表情]     立绘      @hide id|all    @fx shake|flash
//   @chapter 标题|副题           章节标题卡（「标题 · 副题」也写入存档名）
//   @cg id | @cg off            CG        @scene id 题名 / @endscene   回想区段
//   @choice + 若干「- 文本 -> label {yue+1 f:flag} ?yue>=2」
//   @jump label | @if 条件 -> label | @do 效果
//   @branch                     共通线终点：按好感开放各院门
//   @ending id                  记录并展示结局      @fate 人物   原著命数页      @end 回标题

export const EXPR = Object.freeze({ 平: 'neutral', 笑: 'smile', 怒: 'angry', 哀: 'sad', 羞: 'blush', 惊: 'surprised' });
export const POS = Object.freeze({ 左: 'left', 中: 'center', 右: 'right' });
export const HEROINES = Object.freeze(['yue', 'pan', 'pinger', 'meng', 'xuee']);
export const ROUTE_MIN = 3;

const SAY = /^([^\s：:@#\-][^：]{0,5}?)(?:[(（]([平笑怒哀羞惊])[)）])?：(.+)$/;

function parseEffects(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).map((token) => {
    if (token.startsWith('f:')) return { flag: token.slice(2) };
    const m = token.match(/^(\w+)([+-]\d+)$/);
    if (!m) throw new Error(`效果写法不对：${token}`);
    return { aff: m[1], delta: Number(m[2]) };
  });
}

export function parseCond(text) {
  if (!text) return null;
  return text.split('&').map((part) => {
    const s = part.trim();
    let m = s.match(/^(!?)f:(\w+)$/);
    if (m) return { flag: m[2], not: m[1] === '!' };
    m = s.match(/^(\w+)(>=|<=|>|<|==)(-?\d+)$/);
    if (m) return { aff: m[1], op: m[2], value: Number(m[3]) };
    throw new Error(`条件写法不对：${s}`);
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

export function parseScript(sources, cast, speakers = []) {
  const byName = Object.fromEntries(Object.entries(cast).map(([id, c]) => [c.name, id]));
  const labels = {};
  let current = null;
  let pendingChoice = null;
  for (const source of sources) {
    for (const raw of source.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      if (line.startsWith('# ')) {
        current = line.slice(2).trim();
        if (labels[current]) throw new Error(`重复标签：${current}`);
        labels[current] = [];
        pendingChoice = null;
        continue;
      }
      if (!current) throw new Error(`标签之外的行：${line}`);
      const list = labels[current];
      if (line.startsWith('- ') && pendingChoice) {
        const m = line.slice(2).match(/^(.+?)\s*->\s*(\w+)\s*(?:\{([^}]*)\})?\s*(?:\?(\S+))?$/);
        if (!m) throw new Error(`选项写法不对：${line}`);
        pendingChoice.options.push({ text: m[1].trim(), target: m[2], effects: parseEffects(m[3]), cond: parseCond(m[4]) });
        continue;
      }
      pendingChoice = null;
      if (line.startsWith('@')) {
        const [op, ...rest] = line.slice(1).split(/\s+/);
        const arg = line.slice(op.length + 2).trim();
        let cmd;
        if (op === 'bg') cmd = { t: 'bg', id: rest[0], fx: rest[1] || 'fade' };
        else if (op === 'bgm') cmd = { t: 'bgm', id: rest[0] === 'stop' ? null : rest[0] };
        else if (op === 'se') cmd = { t: 'se', id: rest[0] };
        else if (op === 'show') cmd = { t: 'show', who: rest[0], pos: POS[rest[1]] || 'center', expr: EXPR[rest[2]] || 'neutral' };
        else if (op === 'hide') cmd = { t: 'hide', who: rest[0] };
        else if (op === 'fx') cmd = { t: 'fx', id: rest[0] };
        else if (op === 'weather') cmd = { t: 'weather', id: rest[0] === 'none' ? null : rest[0] };
        else if (op === 'chapter') { const [title, sub = ''] = arg.split('|'); cmd = { t: 'chapter', title: title.trim(), sub: sub.trim() }; }
        else if (op === 'cg') cmd = { t: 'cg', id: rest[0] === 'off' ? null : rest[0] };
        else if (op === 'scene') cmd = { t: 'scene', id: rest[0], title: rest.slice(1).join(' ') };
        else if (op === 'endscene') cmd = { t: 'endscene' };
        else if (op === 'choice') { cmd = { t: 'choice', options: [] }; pendingChoice = cmd; }
        else if (op === 'jump') cmd = { t: 'jump', target: rest[0] };
        else if (op === 'if') { const m = arg.match(/^(\S+)\s*->\s*(\w+)$/); cmd = { t: 'if', cond: parseCond(m[1]), target: m[2] }; }
        else if (op === 'do') cmd = { t: 'do', effects: parseEffects(arg) };
        else if (op === 'branch') cmd = { t: 'branch' };
        else if (op === 'ending') cmd = { t: 'ending', id: rest[0] };
        else if (op === 'fate') cmd = { t: 'fate', who: rest[0] };
        else if (op === 'end') cmd = { t: 'end' };
        else throw new Error(`未知指令：${line}`);
        list.push(cmd);
        continue;
      }
      const m = line.match(SAY);
      if (m && (byName[m[1]] || speakers.includes(m[1]))) {
        list.push({ t: 'say', who: byName[m[1]] ?? null, name: m[1], expr: m[2] ? EXPR[m[2]] : null, text: m[3].trim() });
      } else {
        list.push({ t: 'say', who: null, name: '', expr: null, text: line });
      }
    }
  }
  for (const [label, list] of Object.entries(labels)) list.forEach((cmd, ip) => { if (cmd.t === 'say') cmd.id = `${label}:${ip}`; });
  return labels;
}

const blankStage = () => ({ bg: null, bgFx: 'fade', sprites: {}, cg: null, bgm: null, weather: null, chapter: '' });

export class Story {
  constructor(labels, hooks = {}) {
    this.labels = labels;
    this.hooks = hooks; // onUnlock(kind, id)
    this.reset();
  }

  reset() {
    this.label = null;
    this.ip = 0;
    this.vars = { aff: Object.fromEntries(HEROINES.map((h) => [h, 0])), flags: {} };
    this.stage = blankStage();
    this.replay = false;
    this.pending = null;
  }

  start(label = 'start', { replay = false, ip = 0 } = {}) {
    this.reset();
    this.label = label;
    this.ip = ip;
    this.replay = replay;
  }

  jump(target) {
    if (!this.labels[target]) throw new Error(`跳到不存在的标签：${target}`);
    this.label = target;
    this.ip = 0;
  }

  apply(effects) {
    for (const e of effects) {
      if (e.flag) this.vars.flags[e.flag] = true;
      else this.vars.aff[e.aff] = (this.vars.aff[e.aff] ?? 0) + e.delta;
    }
  }

  // 执行到下一个阻塞点并返回它：say / choice / chapter / ending / fate / end
  next() {
    for (let guard = 0; guard < 10000; guard += 1) {
      const list = this.labels[this.label];
      if (!list) throw new Error(`标签缺失：${this.label}`);
      if (this.ip >= list.length) throw new Error(`标签 ${this.label} 没有用 @jump/@end 收尾`);
      const cmd = list[this.ip];
      this.ip += 1;
      const s = this.stage;
      switch (cmd.t) {
        case 'bg': s.bg = cmd.id; s.bgFx = cmd.fx; s.cg = null; break;
        case 'bgm': s.bgm = cmd.id; if (cmd.id) this.hooks.onUnlock?.('music', cmd.id); break;
        case 'se': this.hooks.onSe?.(cmd.id); break;
        case 'fx': this.hooks.onFx?.(cmd.id); break;
        case 'weather': s.weather = cmd.id; break;
        case 'show': s.sprites[cmd.who] = { pos: cmd.pos, expr: cmd.expr }; break;
        case 'hide': if (cmd.who === 'all') s.sprites = {}; else delete s.sprites[cmd.who]; break;
        case 'cg': s.cg = cmd.id; if (cmd.id) this.hooks.onUnlock?.('cg', cmd.id); break;
        case 'scene': if (!this.replay) this.hooks.onUnlock?.('scene', cmd.id); break;
        case 'endscene': if (this.replay) return { type: 'end', replay: true }; break;
        case 'jump': this.jump(cmd.target); break;
        case 'if': if (testCond(cmd.cond, this.vars)) this.jump(cmd.target); break;
        case 'do': this.apply(cmd.effects); break;
        case 'say':
          if (cmd.who && cmd.expr && s.sprites[cmd.who]) s.sprites[cmd.who].expr = cmd.expr;
          return { type: 'say', ...cmd };
        case 'chapter': s.chapter = cmd.sub ? `${cmd.title} · ${cmd.sub}` : cmd.title; return { type: 'chapter', title: cmd.title, sub: cmd.sub };
        case 'choice': {
          const options = cmd.options.map((o, i) => ({ i, text: o.text, enabled: testCond(o.cond, this.vars) }));
          this.pending = cmd.options;
          return { type: 'choice', options };
        }
        case 'branch': {
          const open = HEROINES.filter((h) => this.vars.aff[h] >= ROUTE_MIN);
          if (!open.length) { this.jump('lonely'); break; }
          this.pending = HEROINES.map((h) => ({ target: `${h}_route`, effects: [{ flag: `route_${h}` }] }));
          return { type: 'choice', branch: true, options: HEROINES.map((h, i) => ({ i, who: h, enabled: open.includes(h) })) };
        }
        case 'ending': this.hooks.onUnlock?.('ending', cmd.id); return { type: 'ending', id: cmd.id };
        case 'fate': return { type: 'fate', who: cmd.who };
        case 'end': return { type: 'end' };
        default: throw new Error(`未知指令类型：${cmd.t}`);
      }
    }
    throw new Error('剧本陷入死循环');
  }

  choose(index) {
    const option = this.pending?.[index];
    if (!option) throw new Error(`没有这个选项：${index}`);
    this.pending = null;
    this.apply(option.effects);
    this.jump(option.target);
  }

  // 存档：停在阻塞指令上，读档后回退一格重新执行即可还原同一画面
  snapshot() {
    return JSON.parse(JSON.stringify({ label: this.label, ip: this.ip - 1, vars: this.vars, stage: this.stage }));
  }

  restore(snap) {
    this.reset();
    Object.assign(this, JSON.parse(JSON.stringify({ label: snap.label, ip: snap.ip, vars: snap.vars, stage: snap.stage })));
    if (!this.labels[this.label]) throw new Error('存档指向的剧本已不存在');
  }
}
