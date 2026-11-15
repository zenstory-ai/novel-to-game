// 剧本与资源的无浏览器检查（CI：npm run verify:model）。
// 一、登记：背景、CG、曲目、立绘、结局、「记下了」的人物都已登记，引用的文件都在。
// 二、过场：@cut 与 @cut off 在同一标签里成对，其间不出现选择或换场；字幕句数与时间点一一对应且递增；每段恰好用一次。
// 三、连通：穷举全部玩法（选项逐个选、限时走沉默、细节取每种不超过三处的组合、护灯成与败），
//     证明十六个结局都能走到、每个标签都会经过、没有死路；穷举时逐句核对引用前文事实的台词与当时的状态相符。
// 四、良缘夜的同意选择：五条线都用字面明确的措辞（「留下过夜」进亲密场景，「不留宿……陪她坐到天明」不进）。
// 五、图文一致：穷举时逐句核对，写夜里的句子不压在白天的背景上；写她背对你、散着头发的句子，画面上不留正面整妆的立绘；
//     写了她卸簪散发，同一场之后出场的 CG 也得是卸了簪的画面（登记 CG[id].undressed）。
//     立绘都站着、手里只拿各自的器物：写她坐着、伏案写字、做针线、抱琴、靠着睡着或满桌酒菜的旁白不压在立绘上（第 5 轮盲玩「灯下看账」）。
// 六、字幕节拍（第 4 轮盲玩：过场字幕前紧后松、旁白跑在画面前面）：时间点按成片逐镜核对、登记在台账与 CUT 里且一致，
//     旁白不早于它的镜头；按 engine/subs.js 的规则以 1× 模拟每段过场，每句都停够读完的时间，出现时画面正演着它的内容。
// 七、限时与解锁（第 4 轮盲玩：两选项的荷亭 7 秒没读完就烧尽、解锁的选项看不出来）：限时秒数够读完选项再想一想；
//     察言观色解锁的选项都能说出是看见了哪一处。
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cutStep, readMs } from '../js/engine/subs.js';
import { compile, jumpTargets } from '../js/engine/script.js';
import { Runtime } from '../js/engine/runtime.js';
import {
  SCRIPT_SOURCES, CAST, SPEAKERS, HEROINES, ROUTE_MIN, BG, CG, MUSIC, ENDINGS, FATES, FILM, CUT, TREE, SCENES, EXPRESSIONS,
  spriteSrc, faceSrc, doorSrc, CURTAIN,
} from '../js/story/registry.js';

const fileExists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const program = compile(SCRIPT_SOURCES, { cast: CAST, speakers: SPEAKERS });
const { ops, labels } = program;

// ---------- 一、登记与文件 ----------
for (const cmd of ops) {
  const where = `${cmd.at} ${JSON.stringify(cmd).slice(0, 70)}`;
  for (const e of [...(cmd.options ?? []).flatMap((o) => o.effects), ...(cmd.effects ?? []), ...(cmd.spots ?? []).flatMap((sp) => sp.effects)]) {
    if (e.remember) assert.ok(CAST[e.remember], `「记下了」的人物未登记 ${where}`);
    if (e.aff) assert.ok(CAST[e.aff], `心意写给了未登记的人物 ${where}`);
  }
  if (cmd.t === 'look') {
    for (const sp of cmd.spots) assert.ok(sp.rect.every((v) => v >= 0 && v <= 100) && sp.rect[0] + sp.rect[2] <= 100 && sp.rect[1] + sp.rect[3] <= 100, `细节框超出画面 ${where}`);
    assert.ok(cmd.spots.length > cmd.max, `细节不多于可看次数，察言观色就没有取舍 ${where}`);
    // 第 4 轮新盲玩：「钱袋」与「旧契」两个框叠在一起，「纸」的框压到了下方的提示字。框两两不相交；
    // 横屏文本框从画面约 77% 高处起，框底不越过这条线（右侧 60% 以外文本框没有字，不受限）
    cmd.spots.forEach((a, i) => cmd.spots.slice(i + 1).forEach((b) => {
      const apart = a.rect[0] + a.rect[2] <= b.rect[0] || b.rect[0] + b.rect[2] <= a.rect[0] || a.rect[1] + a.rect[3] <= b.rect[1] || b.rect[1] + b.rect[3] <= a.rect[1];
      assert.ok(apart, `细节框「${a.name}」与「${b.name}」叠在一起 ${where}`);
    }));
    for (const sp of cmd.spots) assert.ok(sp.rect[0] >= 60 || sp.rect[1] + sp.rect[3] <= 77, `细节框「${sp.name}」压到了文本框里的提示字 ${where}`);
  }
  if (cmd.t === 'choice' && cmd.timed) assert.ok(cmd.options.some((o) => o.silent), `限时选项缺少沉默分支 ${where}`);
  if (cmd.t === 'bg') assert.ok(cmd.id in BG, `背景未登记 ${where}`);
  if (cmd.t === 'cg' && cmd.id) assert.ok(CG[cmd.id], `CG 未登记 ${where}`);
  if (cmd.t === 'bgm' && cmd.id) assert.ok(MUSIC[cmd.id], `曲目未登记 ${where}`);
  if (cmd.t === 'show') assert.ok(CAST[cmd.who], `立绘人物未登记 ${where}`);
  if (cmd.t === 'ending') assert.ok(ENDINGS[cmd.id], `结局未登记 ${where}`);
  if (cmd.t === 'fate') assert.ok(FATES[cmd.who], `命数未登记 ${where}`);
  if (cmd.t === 'line' && !cmd.name) assert.doesNotMatch(cmd.text, /^\S{1,5}[(（].+?[)）]：/, `疑似说话人或表情写错 ${where}`);
}
for (const src of Object.values(BG).filter(Boolean)) assert.ok(fileExists(src), `背景文件缺失：${src}`);
for (const [id, cg] of Object.entries(CG)) assert.ok(fileExists(cg.src), `CG 文件缺失：${id}`);
for (const id of Object.keys(MUSIC)) assert.ok(fileExists(`assets/audio/bgm/${id}.mp3`), `曲目文件缺失：${id}`);
for (const who of HEROINES) {
  for (const expr of EXPRESSIONS) assert.ok(fileExists(spriteSrc(who, expr)), `立绘缺失：${who}/${expr}`);
  for (const src of [faceSrc(who), doorSrc(who)]) assert.ok(fileExists(src), `界面图缺失：${src}`);
  assert.ok(labels[`${who}_route`] !== undefined, `缺少路线入口 ${who}_route`);
}
assert.ok(fileExists(CURTAIN), '帘幕图缺失');
for (const group of TREE) for (const label of group.chapters) assert.ok(program.chapters[label], `剧情树里的章节没有 @chapter：${label}`);
assert.deepEqual(Object.keys(program.chapters).sort(), TREE.flatMap((g) => g.chapters).sort(), '剧情树与剧本里的章节对不上');
for (const [id, scene] of Object.entries(SCENES)) assert.equal(program.scenes[id]?.label, scene.label, `回想 ${id} 的起点标签不对`);
const usedCg = new Set(ops.filter((c) => c.t === 'cg' && c.id).map((c) => c.id));
assert.deepEqual(Object.keys(CG).filter((id) => id !== 'title' && id !== 'fate' && !usedCg.has(id)), [], '登记了却从不出现的 CG（鉴赏里会永远锁着）');
for (const [id, film] of Object.entries(FILM)) {
  assert.ok(CG[id] || BG[id], `待机影像没有对应的 CG 或背景：${id}`);
  assert.ok(!CG[id]?.adult, `成人 CG 不配影像：${id}`);
  assert.ok(fileExists(film.src), `待机影像文件缺失：${film.src}`);
}

// ---------- 二、剧情过场 ----------
const cutLines = new Map();
const cutTexts = {};
let open = null;
let openLabel = null;
for (const cmd of ops) {
  if (open && cmd.label !== openLabel) assert.fail(`标签 ${openLabel} 结束时过场 ${open} 还没收起`);
  if (cmd.t === 'cut' && cmd.id) {
    assert.ok(!open, `上一段过场还没收起 ${cmd.at}`);
    assert.ok(CUT[cmd.id], `过场未登记 ${cmd.at}`);
    assert.ok(!cutLines.has(cmd.id), `同一段过场用了两次：${cmd.id}`);
    cutLines.set(cmd.id, 0);
    open = cmd.id;
    openLabel = cmd.label;
  } else if (cmd.t === 'cut') {
    assert.ok(open, `没有打开的过场却写了 @cut off ${cmd.at}`);
    const { cues, seconds } = CUT[open];
    assert.equal(cues.length, cutLines.get(open), `过场 ${open}：字幕时间点 ${cues.length} 个，台词 ${cutLines.get(open)} 句`);
    assert.ok(cues[0] < seconds && cues.every((t, i) => t >= 0 && (i === 0 || t >= cues[i - 1])), `过场 ${open} 的字幕时间点不能倒退，且第一句在片长 ${seconds} 秒内`);
    assert.equal(CUT[open].ends?.length, cues.length, `过场 ${open}：每句都要登记所属镜头的结束秒数 ends`);
    open = null;
  } else if (open && cmd.t === 'line') { cutLines.set(open, cutLines.get(open) + 1); (cutTexts[open] ??= []).push(cmd); }
  else if (open) assert.ok(['show', 'hide', 'bgm', 'weather', 'fx', 'do'].includes(cmd.t), `过场 ${open} 收起之前出现了 @${cmd.t} ${cmd.at}`);
}
assert.ok(!open, `剧本结束时过场 ${open} 还没收起`);
// 选完就看后果（盲玩发现：荷花饼沉默、箱子之问、契尾等几段过场前面先垫了一句旁白，玩家看到的是立绘加文字，以为这一选没有过场）：
// 选项、限时沉默与护灯的去向标签里若有过场，过场必须是这个标签的第一拍，前面不垫台词或旁白。
const choiceTargets = new Set(ops.flatMap((cmd) => (cmd.t === 'choice' || cmd.t === 'hold' ? jumpTargets(cmd) : [])));
for (const label of choiceTargets) {
  const body = ops.slice(labels[label]).filter((c, i, all) => all.slice(0, i + 1).every((x) => x.label === label));
  const cut = body.findIndex((c) => c.t === 'cut' && c.id);
  if (cut < 0) continue;
  const before = body.slice(0, cut).filter((c) => c.t === 'line');
  assert.deepEqual(before.map((c) => c.text), [], `选项去向 ${label} 的过场 ${body[cut].id} 前面垫了台词，选完不会立刻演出后果`);
}
for (const [id, cut] of Object.entries(CUT)) {
  assert.ok(cutLines.has(id), `登记了却从不播放的过场：${id}`);
  assert.ok(!/adult|_h\d/.test(id), `过场不含成人画面：${id}`);
  for (const f of [cut.src, cut.poster]) assert.ok(fileExists(f), `过场文件缺失：${f}`);
}

// ---------- 六、字幕节拍 ----------
const ledger = JSON.parse(readFileSync(new URL('../../art/cutscenes.json', import.meta.url), 'utf8'));
assert.deepEqual(ledger.shots.map((s) => s.id).sort(), Object.keys(CUT).sort(), '过场台账与 CUT 登记对不上');
// 过场画面的时段（第 6 轮新盲玩：暮色掌灯的晚饭里，凉汤过场的窗外是白天蓝天）：过场所在那一场的背景是夜景时，
// 台账必须登记这段成片已核对为夜里（shot.period === 'night'）；白天背景的场次不许配登记为夜里的过场。
{
  const NIGHT_BG = new Set(['hall_night', 'garden_night', 'kitchen_night', 'court_night', 'court_rain', 'compound']);
  const DAY_BG_CUT = new Set(['hall', 'garden', 'street', 'temple', 'kitchen']);
  let bg = null;
  const cutBg = {};
  for (const cmd of ops) {
    if (cmd.t === 'bg') bg = cmd.id;
    if (cmd.t === 'cut' && cmd.id) cutBg[cmd.id] = bg;
  }
  for (const shot of ledger.shots) {
    const where = `过场 ${shot.id}（所在场次背景 ${cutBg[shot.id]}）`;
    if (NIGHT_BG.has(cutBg[shot.id])) assert.equal(shot.period, 'night', `${where} 是夜里的场次，台账没有登记成片已核对为夜色（period: night）`);
    if (DAY_BG_CUT.has(cutBg[shot.id])) assert.notEqual(shot.period, 'night', `${where} 是白天的场次，却配了夜里的过场`);
  }
  assert.ok(ledger.shots.filter((s) => s.period === 'night').length >= 4, '过场时段检查没有碰到夜里的场次，检查失效了');
}
const subStats = { held: 0, longest: 0 };
for (const shot of ledger.shots) {
  const cut = CUT[shot.id];
  const lines = cutTexts[shot.id];
  assert.deepEqual(shot.cues, cut.cues, `过场 ${shot.id}：台账与运行时的字幕时间点不一致`);
  // 时间点按成片逐镜核对过（台账 method）；这里守住两条：每句的时间点与「还在演它」的秒数合理，
  // 且旁白不比分镜表里它所属镜头的起点早出 1 秒以上（旧时间点把同镜头的几句按 1.2 秒排开，旁白早出 2～6 秒）
  lines.forEach((line, i) => {
    const owners = shot.storyboard.filter((b) => b.lines.includes(i));
    assert.ok(owners.length, `过场 ${shot.id} 第 ${i + 1} 句不属于任何镜头`);
    assert.ok(cut.cues[i] < cut.ends[i] && cut.ends[i] <= cut.seconds + 0.01, `过场 ${shot.id} 第 ${i + 1} 句的时间点 ${cut.cues[i]}–${cut.ends[i]} 不合理`);
    if (!line.name) assert.ok(cut.cues[i] >= owners[0].from - 1, `过场 ${shot.id} 第 ${i + 1} 句旁白「${line.text.slice(0, 12)}」在 ${cut.cues[i]} 秒出现，比它的镜头（分镜 ${owners[0].from} 秒起）早，会跑在画面前面`);
  });
  assert.deepEqual(shot.ends, cut.ends, `过场 ${shot.id}：台账与运行时的 ends 不一致`);
  // 1× 模拟：影像以 20ms 一帧前进（停住时不动），字幕按 cutStep 换句；玩家不点击
  const DT = 20;
  // 第一句等到它的时间点才浮出来（之前画面先演）
  let t = cut.cues[0]; let i = 0; let shown = 0; let wall = cut.cues[0] * 1000; let shownAtT = t;
  const log = [];
  for (let guard = 0; guard < 20000; guard += 1) {
    const step = cutStep(cut, i, t, shown, lines[i].text);
    if (step === 'next') {
      log.push({ i, shownMs: shown, atT: shownAtT });
      i += 1; shown = 0; shownAtT = t;
      continue;
    }
    if (step === 'hold') subStats.held += DT; else t = Math.min(cut.seconds, t + DT / 1000);
    shown += DT; wall += DT;
    if (t >= cut.seconds && (i === lines.length - 1 || t < cut.cues[i + 1])) break; // 演完停在末帧；之后的句子点击推进
  }
  log.push({ i, shownMs: Infinity, atT: shownAtT });
  for (const { i: k, shownMs, atT } of log) {
    assert.ok(shownMs >= readMs(lines[k].text), `过场 ${shot.id} 第 ${k + 1} 句只停了 ${shownMs}ms，读完要 ${readMs(lines[k].text)}ms`);
    assert.ok(atT >= cut.cues[k] - 0.03 && atT <= cut.ends[k], `过场 ${shot.id} 第 ${k + 1} 句在 ${atT.toFixed(2)} 秒出现，不在它的镜头 ${cut.cues[k]}–${cut.ends[k]} 秒里`);
  }
  assert.equal(log.length, lines.length, `过场 ${shot.id}：模拟里只换到第 ${log.length} 句`);
  subStats.longest = Math.max(subStats.longest, wall);
}

// ---------- 七、限时与解锁 ----------
// 选项面板下面摆的是上一句话；上一句压在 CG 上，选项出现时就不能把 CG 撤掉换成别的画面（盲玩：金簪五选一配空园子、荷亭「满席」配独自一人）
ops.forEach((cmd, pc) => {
  if (cmd.t !== 'choice') return;
  for (let k = pc - 1; k >= 0 && ops[k].label === cmd.label && ops[k].t !== 'line'; k -= 1) {
    assert.ok(!(ops[k].t === 'cg' && !ops[k].id), `选项 ${cmd.at} 出现前撤掉了 CG：上一句话还在说 CG 里的场面，画面却换了`);
  }
});
for (const cmd of ops) {
  if (cmd.t !== 'choice' || !cmd.timed) continue;
  const chars = cmd.options.filter((o) => !o.silent).reduce((n, o) => n + [...o.text].length, 0);
  const need = 2 + chars / 7;
  assert.ok(cmd.timed >= need, `限时抉择 ${cmd.at} 只给 ${cmd.timed} 秒，选项共 ${chars} 字，读完再想一想至少要 ${need.toFixed(1)} 秒`);
}
{
  const probe = new Runtime(program, { heroines: HEROINES, routeMin: ROUTE_MIN });
  const sawFlag = (o) => o.cond?.some((x) => x.flag && !x.not && /^saw_/.test(x.flag));
  const clued = ops.filter((c) => c.t === 'choice').flatMap((c) => c.options.filter(sawFlag).map((o) => ({ at: c.at, o })));
  assert.ok(clued.length >= 2, '察言观色解锁的选项一个也没找到，检查失效了');
  for (const { at, o } of clued) assert.ok(probe.clueOf(o.cond), `${at} 的选项「${o.text}」靠看见细节解锁，却找不到是哪一处细节`);
  for (const c of ops.filter((x) => x.t === 'choice')) for (const o of c.options) if (!sawFlag(o)) assert.equal(probe.clueOf(o.cond), null, `${c.at} 的选项「${o.text}」不是看见细节才有的，却会标上「看见了」`);
}

// ---------- 三、穷举连通 ----------
// 引用前文事实的台词：只能在相符的状态下出现（例：荷亭金簪给了谁）。每条个人线里提到金簪的台词都要在这里登记。
const FACTS = [
  { re: /金簪赏出去了，没轮到我/, need: '!pin_pan' },
  { re: /金簪都赏给我了|只留着席上那支金簪|摸了摸那支金簪/, need: 'pin_pan' },
  { re: /清明那支簪……我收着了|清明那日的金簪/, need: 'pin_yue' },
  { re: /清明那支簪，你赏给了旁人/, need: '!pin_yue' },
];
for (const cmd of ops) {
  if (cmd.t !== 'line' || !/金簪|清明那支簪|头彩/.test(cmd.text)) continue;
  if (['q_prize', 'p_yue', 'p_pan', 'p_pinger', 'p_meng', 'p_xuee', 'q_end_tail'].includes(cmd.label)) continue;
  assert.ok(FACTS.some((f) => f.re.test(cmd.text)), `引用金簪的台词没有登记状态条件 ${cmd.at}：${cmd.text}`);
}
const factHits = new Map(FACTS.map((f) => [f, 0]));
// 图文一致（盲玩发现：暮色晚饭、夜里卸妆、拜月卸簪都压在白天正堂或整妆立绘上）
const DAY_BG = new Set(['hall', 'garden', 'street', 'temple', 'kitchen']);
// 旁白写此刻的时段；台词里的「今夜……」多半说的是还没到的晚上，只认「天没黑透」这类当下的说法
const NIGHT_TEXT = /暮色|今夜|夜里|入夜|三更|夜深|灯下|点着灯|点了一盏灯|天没黑透|月色/;
const NIGHT_SPOKEN = /天没黑透|夜深了/;
// 盲玩又发现：「她背过身去揉面」「披着衣裳、头发没梳齐」时画面仍是正面整妆立绘；旁白与她自己说的两种都认
const UNDRESSED_TEXT = /背对着|背过身|看不见她的脸|散着头发|头发散|头发全放|拔下头上的簪|拆头发|头也没梳|没梳齐|披着衣裳|梳那头长发/;
const UNDRESSED_SPOKEN = /头发还没梳/;
const REDRESSED_TEXT = /插回|梳好|转过身来|转回身/;
const pictureHits = { night: 0, undressed: 0, undressedCg: 0, carried: 0, pose: 0 };
const POSE_TEXT = /坐在|坐着|坐回|缩在|蹲着|蹲下|跪着|托着腮|靠在|靠着|睡着|躺着|伏在|提笔|写下去|接着写|笔停|在缝|缝着|抱起月琴|压着.{0,2}弦|接着干活|满桌/;
const STOOD_UP = /站起|起身|站了起来/;
const OTHER_SUBJECT = new RegExp(`^(你|${Object.keys(SPEAKERS).filter((n) => n !== '西门庆').join('|')})`);
// 第 4 轮新盲玩：拜月夜写完「一支一支拔下头上的簪子」，紧接着的 CG 却是高髻满簪。
// 写了她卸簪散发之后，同一场（背景没换、没写她插回簪子）里出场的 CG 也必须登记为卸了簪的画面（CG[id].undressed）。
let undressedScene = null; // { bg, at }：穷举里随快照一起保存与恢复
let nightNow = false;
let nightChapter = null;
const DAY_TEXT = /天亮|天明|清晨|一早|第二天|次日|早饭|晨光|日头|午后|白日|大白天|晌午/;
const checkPicture = (beat) => {
  const s = vm.stage;
  if (undressedScene && undressedScene.bg !== s.bg) undressedScene = null;
  if (REDRESSED_TEXT.test(beat.text)) undressedScene = null;
  if (undressedScene && s.cg && !s.cut) {
    assert.ok(CG[s.cg].undressed, `写了「${undressedScene.text}」（${undressedScene.at}）之后，同一场里出现的 CG「${CG[s.cg].name}」不是卸了簪的画面 ${beat.at}：${beat.text}`);
    pictureHits.undressedCg += 1;
  }
  if ((beat.name ? UNDRESSED_SPOKEN : UNDRESSED_TEXT).test(beat.text) && /簪|头发|梳/.test(beat.text)) undressedScene = { bg: s.bg, at: beat.at, text: beat.text };
  // 时段随场延续（第 4 轮新盲玩：「暮色落下来」之后绕去角门，画面却是白天花园）：旁白写了入夜，
  // 之后直到写天亮或换章，压在背景上的句子都不能配白天的背景
  if (!beat.name && DAY_TEXT.test(beat.text)) nightNow = false;
  if (s.chapterAt !== nightChapter) { nightNow = false; nightChapter = s.chapterAt; }
  if (!beat.name && NIGHT_TEXT.test(beat.text)) nightNow = true;
  if (s.cut || s.cg) return;
  // 第 5 轮新盲玩：「灯下看账」连写她提笔、停笔、接着写，画面却是正面站姿、两手空着的立绘。立绘都站着、整妆，
  // 手里只有各自的器物（金莲团扇、瓶儿钥匙、玉楼名帖）；写她此刻坐着、蹲着、伏案写字、做针线、抱琴、靠着睡着，
  // 或写满桌酒菜的旁白，不能压在立绘上：先写她起身再让立绘登场，或者撤下立绘
  if (!beat.name && Object.keys(s.sprites).length) {
    // 只看主语是她的分句：「你坐着没动」「春梅缩在金莲身后」说的是别人
    const posed = beat.text.split(/[，。；！？]/).find((c) => POSE_TEXT.test(c) && !OTHER_SUBJECT.test(c));
    assert.ok(!posed || STOOD_UP.test(beat.text), `写她「${posed}」，画面上却是站着的立绘 ${beat.at}：${beat.text}`);
    if (s.sprites.pan) assert.doesNotMatch(beat.text, /扇子也没拿|没拿扇子/, `立绘里金莲拿着团扇，文字却写她没拿 ${beat.at}`);
    pictureHits.pose += 1;
  }
  if (nightNow) {
    assert.ok(!DAY_BG.has(s.bg), `前文已入夜，这一句却压在白天的背景「${s.bg}」上 ${beat.at}：${beat.text}`);
    pictureHits.carried += 1;
  }
  if (beat.name ? NIGHT_SPOKEN.test(beat.text) : NIGHT_TEXT.test(beat.text)) {
    assert.ok(!DAY_BG.has(s.bg), `夜里的句子压在白天的背景「${s.bg}」上 ${beat.at}：${beat.text}`);
    pictureHits.night += 1;
  }
  if ((beat.name ? UNDRESSED_SPOKEN : UNDRESSED_TEXT).test(beat.text)) {
    assert.deepEqual(Object.keys(s.sprites), [], `写她背对你或散着头发，画面上却是正面整妆立绘 ${beat.at}：${beat.text}`);
    pictureHits.undressed += 1;
  }
};
// 写她没整妆的句子即使压在 CG 上，同一标签里也不能紧接着让整妆立绘登场，除非中间写了她插回簪子、转过身来
for (const label of Object.keys(labels)) {
  let undressed = null;
  for (const cmd of ops.filter((c) => c.label === label)) {
    if (cmd.t === 'line' && (cmd.name ? UNDRESSED_SPOKEN : UNDRESSED_TEXT).test(cmd.text)) undressed = cmd;
    else if (cmd.t === 'line' && REDRESSED_TEXT.test(cmd.text)) undressed = null;
    if (cmd.t === 'show') assert.ok(!undressed, `写了「${undressed?.text}」之后，同一场里又让整妆立绘登场 ${cmd.at}`);
  }
}
const checkFacts = (beat) => {
  checkPicture(beat);
  for (const f of FACTS) {
    if (!f.re.test(beat.text)) continue;
    const not = f.need.startsWith('!');
    const has = Boolean(vm.vars.flags[f.need.replace('!', '')]);
    assert.equal(has, !not, `台词与状态矛盾 ${beat.at}：「${beat.text}」要求 ${f.need}`);
    factHits.set(f, factHits.get(f) + 1);
  }
};
const reached = new Set();
const seenLabels = new Set();
const vm = new Runtime(program, { heroines: HEROINES, routeMin: ROUTE_MIN, hooks: { unlock: (kind, id) => { if (kind === 'ending') reached.add(id); } } });
const INTERACTIVE = new Set(['choice', 'look', 'hold']);
// 一路读到下一个要玩家动手的拍点；走到 @end 返回 null
const readOn = () => {
  for (;;) {
    seenLabels.add(ops[vm.pc].label);
    const beat = vm.step();
    if (beat.type === 'end') return null;
    if (beat.type === 'line') checkFacts(beat);
    if (INTERACTIVE.has(beat.type)) return beat;
  }
};
const subsets = (items, max) => items.reduce((acc, item) => acc.concat(acc.filter((a) => a.length < max).map((a) => [...a, item])), [[]]);
function moves(beat) {
  if (beat.type === 'choice') {
    const enabled = beat.options.filter((o) => o.enabled);
    assert.ok(enabled.length, `${beat.at} 没有可选项`);
    return enabled.map((o) => () => vm.choose(o.i));
  }
  if (beat.type === 'look') {
    return subsets(beat.spots.filter((sp) => !sp.seen), beat.left).map((picked) => () => { for (const sp of picked) vm.inspect(sp.i); vm.endLook(); });
  }
  return [true, false].map((ok) => () => vm.resolveHold(ok));
}
// 去重只看之后还会被读到的标记：从某个标签往后能到的所有条件里提到的 flag。
// 细节标记大多只在下一两场有回声，不这样裁剪，状态数会按细节组合成倍增长。
const edges = {};
const condFlags = {};
for (const cmd of ops) {
  (edges[cmd.label] ??= new Set());
  (condFlags[cmd.label] ??= new Set());
  for (const t of jumpTargets(cmd)) edges[cmd.label].add(t);
  if (cmd.t === 'branch') for (const t of [...HEROINES.map((h) => `${h}_route`), 'lonely']) edges[cmd.label].add(t);
  for (const c of [cmd.cond, ...(cmd.options ?? []).map((o) => o.cond)].filter(Boolean).flat()) if (c.flag) condFlags[cmd.label].add(c.flag);
}
const liveFlags = {};
for (const label of Object.keys(labels)) {
  const live = new Set();
  const visited = new Set();
  const stack = [label];
  while (stack.length) {
    const l = stack.pop();
    if (visited.has(l)) continue;
    visited.add(l);
    condFlags[l].forEach((f) => live.add(f));
    stack.push(...edges[l]);
  }
  liveFlags[label] = live;
}
const stateKey = (snap) => {
  const label = snap.at.split(':')[0];
  return JSON.stringify([snap.at, snap.vars.aff, Object.keys(snap.vars.flags).filter((f) => liveFlags[label].has(f)).sort()]);
};

vm.start('start');
assert.ok(readOn(), '开场就走到了 @end');
// 图文检查的场内状态（卸了簪、已入夜）不在运行时快照里，随快照一起存取
const pictureState = () => ({ undressedScene, nightNow, nightChapter });
const queue = [{ snap: vm.snapshot(), pic: pictureState() }];
const seen = new Set([stateKey(queue[0].snap)]);
while (queue.length) {
  const { snap, pic } = queue.pop();
  vm.restore(snap);
  const count = moves(vm.step()).length;
  for (let n = 0; n < count; n += 1) {
    vm.restore(snap);
    ({ undressedScene, nightNow, nightChapter } = pic);
    moves(vm.step())[n]();
    if (!readOn()) continue;
    const next = vm.snapshot();
    const key = stateKey(next) + JSON.stringify([undressedScene?.at ?? null, nightNow]);
    if (!seen.has(key)) { seen.add(key); queue.push({ snap: next, pic: pictureState() }); }
  }
}
const missingEndings = Object.keys(ENDINGS).filter((id) => !reached.has(id));
const unreachedLabels = Object.keys(labels).filter((l) => !seenLabels.has(l));
assert.deepEqual(missingEndings, [], `穷举全部选择仍未走到的结局：${missingEndings}`);
assert.deepEqual(unreachedLabels, [], `穷举全部选择仍未走到的标签：${unreachedLabels}`);

assert.deepEqual(FACTS.filter((f) => !factHits.get(f)).map((f) => String(f.re)), [], '有登记的状态台词在穷举里一次也没出现（两种状态都要走到）');
assert.ok(pictureHits.night > 0 && pictureHits.undressed > 0 && pictureHits.undressedCg > 0 && pictureHits.carried > 0 && pictureHits.pose > 0, '图文一致检查没碰到夜里、卸簪、卸簪之后的 CG、入夜之后或压在立绘上的旁白，检查失效了');

// ---------- 四、良缘夜的同意选择 ----------
for (const [id, scene] of Object.entries(SCENES)) {
  const from = labels[scene.label];
  const choice = ops.slice(from).find((c) => c.t === 'choice');
  assert.ok(choice && !choice.timed, `良缘夜 ${id} 的同意选择不能限时`);
  const intimate = choice.options.filter((o) => /_h$/.test(o.target));
  const decline = choice.options.filter((o) => !/_h$/.test(o.target));
  assert.equal(intimate.length, 1, `良缘夜 ${id} 应恰有一个进入亲密场景的选项`);
  assert.match(intimate[0].text, /留下.{0,1}过夜/, `良缘夜 ${id} 进入亲密场景的选项要写明「留下过夜」：${intimate[0].text}`);
  assert.ok(decline.length && decline.every((o) => /不留.{0,2}(宿|过夜)/.test(o.text) && /陪她坐到天明/.test(o.text)), `良缘夜 ${id} 的另一个选项要写明不留宿、陪她坐到天明`);
}

// 回想：五场良缘之夜都能从起点标签播到 @endscene（两种同意选择各走一遍）
for (const [id, scene] of Object.entries(SCENES)) {
  for (const pick of [0, 1]) {
    vm.start(scene.label, { replay: true });
    let beat = vm.step();
    for (let guard = 0; beat.type !== 'end'; guard += 1) {
      assert.ok(guard < 400, `回想 ${id} 没有走到 @endscene`);
      if (beat.type === 'choice') vm.choose(beat.options.filter((o) => o.enabled)[pick].i);
      beat = vm.step();
    }
    assert.ok(beat.replay, `回想 ${id} 没有停在 @endscene`);
  }
}

// 回想带着那一局的标记重放（第 5 轮盲玩：金簪给了月娘，回想里却写旧银簪）：两种状态各走一遍，台词跟着状态走
for (const [flags, want, not] of [[{ pin_yue: true }, /清明那日的金簪/, /旧银簪/], [{}, /旧银簪/, /清明那日的金簪/]]) {
  vm.start(SCENES.yue_night.label, { replay: true, flags });
  const said = [];
  for (let beat = vm.step(), guard = 0; beat.type !== 'end' && guard < 400; guard += 1) {
    if (beat.type === 'line') said.push(beat.text);
    if (beat.type === 'choice') vm.choose(beat.options.filter((o) => o.enabled)[0].i);
    beat = vm.step();
  }
  assert.ok(said.some((t) => want.test(t)) && !said.some((t) => not.test(t)), `回想 yue_night 带标记 ${JSON.stringify(flags)} 时台词没跟着状态走`);
}

const chars = ops.filter((c) => c.t === 'line').reduce((n, c) => n + c.text.length, 0);
console.log(`字幕节拍：${ledger.shots.length} 段过场以 1× 模拟，每句都停够读完的时间、在所属镜头内出现；停住等读累计 ${(subStats.held / 1000).toFixed(0)} 秒，最长一段 ${(subStats.longest / 1000).toFixed(1)} 秒。`);
console.log(`剧情过场 ${Object.keys(CUT).length} 段，待机影像 ${Object.keys(FILM).length} 段；选择点状态 ${seen.size} 个；剧本 ${Object.keys(labels).length} 个标签、${chars} 字；${Object.keys(ENDINGS).length} 个结局全部可达。`);
