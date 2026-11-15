// 剧本运行时：在指令带上走到下一处「拍点」（要玩家读、选、看、按的地方）并把它交给表现层。
// 纯逻辑、无 DOM；心意、标记、舞台状态都在这里裁决，表现层只读不改。
//
// 拍点 beat.type：line / chapter / choice / look / hold / ending / fate / end
// 存档点：每个拍点执行之前的完整状态（at、vars、stage）；at 是指令的「标签:序号」，剧本别处增删不影响旧档。读档 = 回到那个状态再走一步，画面与文字一字不差。
import { testCond } from './script.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
// last：上一句显出来的话。读档或回到某个选择时，文本框先把它摆回去，选项才有上文
const blankStage = () => ({ bg: null, bgFx: 'fade', sprites: {}, cg: null, cut: null, cutLine: -1, bgm: null, weather: null, chapter: '', chapterAt: null, last: null });

export class Runtime {
  // hooks：unlock(kind, id)、remember(who, delta)、fx(id)
  constructor(program, { heroines, routeMin, hooks = {} }) {
    this.program = program;
    this.heroines = heroines;
    this.routeMin = routeMin;
    this.hooks = hooks;
    this.index = Object.fromEntries(program.ops.map((op, pc) => [op.at, pc]));
    // 察言观色看见的细节 → 它记下的标记；选项的条件里要了这个标记，就是「看见了才说得出口」的那一项
    this.clues = {};
    for (const op of program.ops) {
      if (op.t !== 'look') continue;
      for (const sp of op.spots) for (const e of sp.effects ?? []) if (e.flag) this.clues[e.flag] = sp.name;
    }
    this.reset();
  }

  reset() {
    this.pc = 0;
    this.vars = { aff: Object.fromEntries(this.heroines.map((h) => [h, 0])), flags: {} };
    this.stage = blankStage();
    this.replay = false;
    this.pending = null; // 当前拍点等待的那条指令
    this.resume = null; // 当前拍点之前的状态
  }

  // flags：回想时带上那一局走到这场时的标记，台词按当时的状态分支
  start(label = 'start', { replay = false, flags = null } = {}) {
    this.reset();
    this.replay = replay;
    if (flags) this.vars.flags = { ...flags };
    this.jump(label);
  }

  jump(label) {
    const pc = this.program.labels[label];
    if (pc === undefined) throw new Error(`跳到不存在的标签：${label}`);
    this.pc = pc;
  }

  apply(effects) {
    for (const e of effects) {
      if (e.flag) this.vars.flags[e.flag] = true;
      else if (e.aff) this.vars.aff[e.aff] = (this.vars.aff[e.aff] ?? 0) + e.delta;
    }
    // 「她记下了」：同一组效果里她的心意升还是降，决定印上写什么
    for (const e of effects) {
      if (!e.remember) continue;
      const delta = effects.filter((x) => x.aff === e.remember).reduce((n, x) => n + x.delta, 0);
      this.hooks.remember?.(e.remember, delta);
    }
  }

  // 走到下一个拍点并返回它
  step() {
    const { ops } = this.program;
    for (let guard = 0; guard < 20000; guard += 1) {
      const cmd = ops[this.pc];
      if (!cmd) throw new Error('剧本走出了指令带');
      const s = this.stage;
      switch (cmd.t) {
        case 'bg': s.bg = cmd.id; s.bgFx = cmd.fx; s.cg = null; s.cut = null; break;
        case 'bgm': s.bgm = cmd.id; if (cmd.id) this.hooks.unlock?.('music', cmd.id); break;
        case 'weather': s.weather = cmd.id; break;
        case 'show': s.sprites[cmd.who] = { pos: cmd.pos, expr: cmd.expr }; break;
        case 'hide': if (cmd.who === 'all') s.sprites = {}; else delete s.sprites[cmd.who]; break;
        case 'fx': this.hooks.fx?.(cmd.id); break;
        case 'cg': s.cg = cmd.id; if (cmd.id) { s.cut = null; this.hooks.unlock?.('cg', cmd.id); } break;
        case 'cut': s.cut = cmd.id; s.cutLine = -1; if (cmd.id) this.hooks.unlock?.('cut', cmd.id); break;
        case 'scene': if (!this.replay) this.hooks.unlock?.('scene', cmd.id); break;
        case 'endscene': if (this.replay) return this.beat(cmd, { type: 'end', replay: true }); break;
        case 'jump': this.jump(cmd.target); continue;
        case 'if': if (testCond(cmd.cond, this.vars)) { this.jump(cmd.target); continue; } break;
        case 'do': this.apply(cmd.effects); break;
        case 'branch':
          if (!this.heroines.some((h) => this.vars.aff[h] >= this.routeMin)) { this.jump('lonely'); continue; }
          return this.beat(cmd, {
            type: 'choice', at: cmd.at, branch: true, timed: 0,
            options: this.heroines.map((h, i) => ({ i, who: h, enabled: this.vars.aff[h] >= this.routeMin })),
          });
        case 'line': {
          this.mark(cmd);
          if (cmd.who && cmd.expr && s.sprites[cmd.who]) s.sprites[cmd.who].expr = cmd.expr;
          s.last = { who: cmd.who, name: cmd.name, text: cmd.text };
          const beat = { type: 'line', at: cmd.at, who: cmd.who, name: cmd.name, expr: cmd.expr, text: cmd.text };
          if (s.cut) { s.cutLine += 1; beat.cut = { id: s.cut, index: s.cutLine }; }
          this.pc += 1;
          return beat;
        }
        case 'chapter':
          this.mark(cmd);
          s.chapter = cmd.sub ? `${cmd.title} · ${cmd.sub}` : cmd.title;
          s.chapterAt = cmd.label;
          this.pc += 1;
          return { type: 'chapter', at: cmd.at, label: cmd.label, title: cmd.title, sub: cmd.sub };
        case 'choice':
          return this.beat(cmd, {
            type: 'choice', at: cmd.at, timed: cmd.timed,
            options: cmd.options.map((o, i) => ({ i, text: o.text, enabled: testCond(o.cond, this.vars), silent: Boolean(o.silent), clue: this.clueOf(o.cond) })),
          });
        case 'look': {
          const spots = cmd.spots.map((sp, i) => ({ i, rect: sp.rect, name: sp.name, text: sp.text, seen: Boolean(this.vars.flags[sp.flag]) }));
          return this.beat(cmd, { type: 'look', at: cmd.at, prompt: cmd.prompt, max: cmd.max, spots, left: cmd.max - spots.filter((sp) => sp.seen).length });
        }
        case 'hold': return this.beat(cmd, { type: 'hold', at: cmd.at, ms: cmd.ms, prompt: cmd.prompt });
        case 'ending':
          this.mark(cmd);
          this.hooks.unlock?.('ending', cmd.id);
          this.pc += 1;
          return { type: 'ending', at: cmd.at, id: cmd.id };
        case 'fate': this.mark(cmd); this.pc += 1; return { type: 'fate', at: cmd.at, who: cmd.who };
        case 'end': return this.beat(cmd, { type: 'end' });
        default: throw new Error(`未知指令类型：${cmd.t}`);
      }
      this.pc += 1;
    }
    throw new Error('剧本陷入死循环');
  }

  // 选项靠哪一处细节解锁：返回那处细节的名字，没有就是 null
  clueOf(cond) {
    const c = cond?.find((x) => x.flag && !x.not && this.clues[x.flag]);
    return c ? this.clues[c.flag] : null;
  }

  mark(cmd) {
    this.resume = { at: cmd.at, vars: clone(this.vars), stage: clone(this.stage) };
    this.pending = cmd;
  }

  // 等玩家回应的拍点：pc 停在这条指令上，由 choose / endLook / resolveHold 推走
  beat(cmd, beat) {
    this.mark(cmd);
    return beat;
  }

  choose(index) {
    const cmd = this.pending;
    if (cmd?.t === 'branch') {
      const who = this.heroines[index];
      if (!who || this.vars.aff[who] < this.routeMin) throw new Error(`这扇门没有亮灯：${index}`);
      this.vars.flags[`route_${who}`] = true;
      this.jump(`${who}_route`);
      return;
    }
    const option = cmd?.t === 'choice' ? cmd.options[index] : null;
    if (!option || !testCond(option.cond, this.vars)) throw new Error(`没有这个选项：${index}`);
    this.apply(option.effects);
    this.jump(option.target);
  }

  // 察言观色：看一处细节，记下它的标记，返回看见的那句话
  inspect(index) {
    const spot = this.pending?.t === 'look' ? this.pending.spots[index] : null;
    if (!spot) throw new Error(`没有这处细节：${index}`);
    this.apply(spot.effects);
    return spot.text;
  }

  endLook() {
    if (this.pending?.t !== 'look') throw new Error('当前不在察言观色');
    this.pc += 1;
  }

  resolveHold(ok) {
    const cmd = this.pending;
    if (cmd?.t !== 'hold') throw new Error('当前没有按住动作');
    this.jump(ok ? cmd.target : cmd.miss);
  }

  snapshot() {
    return clone(this.resume);
  }

  restore(snap, { replay = false } = {}) {
    const pc = this.index[snap?.at];
    if (pc === undefined) throw new Error('存档指向的剧本已不存在');
    this.reset();
    this.replay = replay;
    this.pc = pc;
    this.vars = clone(snap.vars);
    this.stage = { ...blankStage(), ...clone(snap.stage) };
  }
}
