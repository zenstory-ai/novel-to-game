// 纯引擎自测(node,无浏览器):固定种子逐字节可复现。
// 覆盖:五类行动的收益与代价、明暗两账的不对称、风声累积与发落触发、
// 传闻真伪判定、谋算进度与泄密、对手每回合行动、第79回明账清零、
// 五种结局的判定边界、存读一致性。
import {
  newGame, applyAction, actionError, submitTurn, applyEventChoice, skipEventIfNoChoice,
  leaderboard, festivalDef, computeEnding, serialize, deserialize, mingDead, playerRank,
  applyVisitChoice, visitDef,
} from '../js/engine.js';
import { INTIMACY, intimacyTier, INTIMACY_TIERS } from '../js/data.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }

// 跑一个节令:事件(若有选择则选指定或第一个) → 行动 → 提交
function runFestival(state, { choice, actions = [] } = {}) {
  if (state.phase === 'event') {
    if (state.event.choices?.length) {
      const c = choice ?? state.event.choices[0].id;
      const r = applyEventChoice(state, c);
      if (!r.ok) throw new Error(`事件选择失败 F${state.festival}: ${r.msg}`);
    } else skipEventIfNoChoice(state);
  }
  for (const a of actions) {
    const r = applyAction(state, a);
    if (!r.ok) throw new Error(`行动失败 F${state.festival} ${a.type}: ${r.msg}`);
  }
  return submitTurn(state);
}

const snap = (s) => JSON.stringify(s);
const DARK = (s) => ({ si: s.player.sifang, rq: { ...s.player.renqing }, tl: [...s.player.tuilu] });
const darkSame = (a, b) => snap(a) === snap(b);
const MING = (s) => ({ t: s.player.tiyan, c: s.player.chong });

// ================= 1. 五类行动的收益与代价 =================
section('五类行动的收益与代价');
{
  const s = newGame(42);
  applyEventChoice(s, 'si'); // 留一半:私房600
  ok(s.player.sifang === 600, '过门留一半 → 私房600');
  const m0 = MING(s), d0 = DARK(s);
  // 持(2行动点)
  let r = applyAction(s, { type: 'chi', duty: 'zhongkui' });
  ok(r.ok && s.ap === 1, '持 消耗2行动点');
  ok(s.player.tiyan > m0.t && s.player.chong > m0.c, '持 涨体面与宠(明账)');
  ok(s.player.gongzhong > 0, '持 开放公中银');
  ok(darkSame(DARK(s), d0), '持 不动暗账');
  // 结(大礼,私房出)
  const si0 = s.player.sifang, ty0 = s.player.tiyan;
  r = applyAction(s, { type: 'jie', target: 'ximen', size: 'big', fund: 'si' });
  ok(r.ok && s.player.sifang === si0 - 150, '结 大礼耗私房150');
  ok(s.player.chong > 0 && s.player.tiyan >= ty0, '结 涨明账');
  ok(DARK(s).si < si0 && darkSame({ rq: DARK(s).rq, tl: DARK(s).tl }, { rq: d0.rq, tl: d0.tl }), '结 只耗暗账不涨暗账');
  submitTurn(s); skipEventIfNoChoice(s);
  // 探(薛媒婆免费)
  const si1 = s.player.sifang;
  r = applyAction(s, { type: 'tan', servant: 'xuemei', target: 'yue' });
  ok(r.ok && s.player.sifang === si1, '探 薛媒婆不收钱');
  ok(r.rumor && ['高', '中', '低'].includes(r.rumor.cred), '探 得到带可信度的传闻');
  // 探(玳安收钱)
  r = applyAction(s, { type: 'tan', servant: 'daian', target: 'yue' });
  ok(r.ok && s.player.sifang === si1 - 30, '探 玳安收30两');
  // 藏(存私房)
  const si2 = s.player.sifang, m2 = MING(s);
  r = applyAction(s, { type: 'cang', mode: 'save' });
  ok(r.ok && s.player.sifang > si2, '藏 存私房上涨');
  ok(MING(s).t === m2.t && MING(s).c === m2.c, '藏 不涨任何明账');
  submitTurn(s);
}

// ================= 2. 明暗两账的不对称 =================
section('明暗两账的不对称(全程扫描)');
{
  const s = newGame(7);
  let violations = [];
  const acts = (f) => [
    { type: 'tan', servant: 'xuemei', target: 'yue' },
    { type: 'jie', target: 'ximen', size: 'small', fund: 'si' },
    { type: 'shi' },
    { type: 'ye' },
    { type: 'chi', duty: 'yanyan' },
    { type: 'cang', mode: 'save' },
    { type: 'mou', scheme: 'sanbu', target: 'xuee' },
  ];
  for (let f = 1; f <= 18; f++) {
    if (s.phase === 'event') {
      if (s.event.choices?.length) applyEventChoice(s, s.event.choices.at(-1).id);
      else skipEventIfNoChoice(s);
    }
    let guard = 0;
    while (s.ap > 0 && guard++ < 8) {
      const d0 = DARK(s), m0 = MING(s);
      const a = acts(f).find((x) => actionError(s, x) === null); // 纯校验挑可行动作(不干跑、不污染状态)
      if (!a) break;
      applyAction(s, a);
      const d1 = DARK(s), m1 = MING(s);
      const darkUp = d1.si > d0.si || d1.tl.length > d0.tl.length || Object.keys(d1.rq).some((k) => d1.rq[k] > d0.rq[k]);
      const mingUp = m1.t > m0.t || m1.c > m0.c;
      if (a.type !== 'cang' && darkUp) violations.push(`F${f} ${a.type} 涨了暗账`);
      if (a.type === 'cang' && mingUp) violations.push(`F${f} 藏 涨了明账`);
      if (a.type === 'cang' && !darkUp && a.mode === 'save') violations.push(`F${f} 藏 没涨暗账`);
    }
    submitTurn(s);
  }
  ok(violations.length === 0, `不对称无违例${violations.length ? ': ' + violations.join('; ') : ''}`);
}

// ================= 3. 传闻真伪判定与证实 =================
section('传闻真伪判定');
{
  const s = newGame(42);
  applyEventChoice(s, 'gong');
  const r1 = applyAction(s, { type: 'tan', servant: 'xiaoyu', target: 'yue' }).rumor;
  ok(r1.cred === '高', '亲近仆役对该房传闻可信度为高');
  applyAction(s, { type: 'verify', rumorId: r1.id });
  ok(r1.verified === r1.truth, '证实后真伪与事实一致');
  // 仆役对不相熟的房不会出高可信度
  const s2 = newGame(9);
  applyEventChoice(s2, 'gong');
  let sawMidLow = true;
  for (let i = 0; i < 5; i++) {
    const rr = applyAction(s2, { type: 'tan', servant: 'xiaoyu', target: 'xuee' });
    if (rr.ok && rr.rumor.cred === '高') sawMidLow = false;
    if (s2.ap <= 0) { submitTurn(s2); skipEventIfNoChoice(s2); }
  }
  ok(sawMidLow, '不相熟的房不出高可信度');
}

// ================= 4. 谋算进度、知情者与泄密 =================
section('谋算进度与泄密');
{
  const s = newGame(42);
  for (let f = 1; f < 7; f++) runFestival(s, f === 1 ? { choice: 'si' } : {});
  ok(festivalDef(s).n === 7 && s.flags.mou, '第30回(节令7)解锁谋算');
  skipEventIfNoChoice(s);
  const r = applyAction(s, { type: 'mou', scheme: 'sanbu', target: 'pan' });
  ok(r.ok && r.scheme.progress === 34 && r.scheme.informers.length === 1, '谋 推进+知情者');
  const w0 = s.player.fengsheng;
  ok(w0 >= 6, '谋 升风声');
  const panMing0 = s.rivals.pan.ming;
  applyAction(s, { type: 'mou', scheme: 'sanbu', target: 'pan' });
  applyAction(s, { type: 'mou', scheme: 'sanbu', target: 'pan' });
  submitTurn(s);
  ok(!s.schemes.length || s.schemes[0].progress < 100, '谋算已了断(成功或泄密)');
  ok(s.rivals.pan.ming <= panMing0 + 20, '谋算对目标产生效果或已泄密');
  // 坐实传闻需要已证实传闻
  skipEventIfNoChoice(s);
  const bad = applyAction(s, { type: 'mou', scheme: 'zuoshi', target: 'pan', rumorId: 'none' });
  ok(!bad.ok, '无证实的传闻不能坐实');
}

// ================= 5. 风声累积与发落 =================
section('风声累积与发落');
{
  const s = newGame(42);
  for (let f = 1; f < 7; f++) runFestival(s, f === 1 ? { choice: 'si' } : {});
  const si0 = s.player.sifang, ty0 = s.player.tiyan;
  let faluo = null, guard = 0;
  while (!faluo && guard++ < 30) {
    skipEventIfNoChoice(s);
    s.player.fengsheng = 100; // 直接抬高风声验证发落(引擎只对≥90判罚)
    const rep = submitTurn(s);
    if (rep.faluo) faluo = rep;
  }
  ok(!!faluo, '风声≥90 触发发落');
  ok(s.player.faluoEver && s.player.jinzu >= 0, '发落记录与禁足');
  ok(s.player.sifang < si0 + 400, '发落罚没部分私房');
  ok(!s.over, '发落不是 Game Over');
  // 禁足要真的禁:发落后的下一令行动点为 0,再下一令恢复
  skipEventIfNoChoice(s);
  ok(s.ap === 0 && s.player.jinzu === 1, '禁足令:次令行动点为 0');
  ok(actionError(s, { type: 'cang', mode: 'save' }) === '禁足中', '禁足中一切行动被拒');
  submitTurn(s);
  skipEventIfNoChoice(s);
  ok(s.ap === 3 && s.player.jinzu === 0, '禁足一令即解,不误后来');
}

// ================= 6. 对手每回合行动 =================
section('对手每回合行动');
{
  const s = newGame(42);
  applyEventChoice(s, 'gong');
  const m0 = Object.fromEntries(Object.entries(s.rivals).map(([k, r]) => [k, r.ming + r.si]));
  submitTurn(s);
  const changed = Object.entries(s.rivals).filter(([k, r]) => r.joined && r.ming + r.si !== m0[k]);
  ok(changed.length >= 3, `对手本令行动(${changed.length} 家有变化)`);
  // 潘金莲入门后目标重排:第30回后她盯李瓶儿
  for (let f = 2; f < 9; f++) runFestival(s, {});
  ok(s.rivals.pan.joined && s.rivals.pinger.joined, '潘/李按时入门');
}

// ================= 7. 第79回明账清零 =================
section('第79回明账清零');
{
  const s = newGame(42);
  let cleared = false;
  for (let f = 1; f <= 18; f++) {
    const rep = runFestival(s, f === 1 ? { choice: 'gong' } : {});
    if (rep.cleared) cleared = true;
  }
  ok(cleared, '节令19 回报清零');
  ok(s.player.tiyan === 0 && s.player.chong === 0, '体面/宠归零');
  ok(leaderboard(s).length === 0, '排行榜撤下不再出现');
  ok(mingDead(s), '明账已作废');
  ok(typeof s.bestRank === 'number' && s.bestRank >= 1, `记录历史最高位次(${s.bestRank})`);
  ok(s.player.sifang > 0, '暗账保留');
  // 清零后任何动作不涨明账
  skipEventIfNoChoice(s);
  ok(s.ap === 0, '第79回无行动点(纯清算)');
  submitTurn(s); // 进入分家
  if (s.event.choices?.length) applyEventChoice(s, s.event.choices.at(-1).id);
  else skipEventIfNoChoice(s);
  const r = applyAction(s, { type: 'chi', duty: 'yanyan' });
  ok(!r.ok, '清零后「持」不可用');
  const c = applyAction(s, { type: 'cang', mode: 'save' });
  ok(c.ok && s.player.tiyan === 0 && s.player.chong === 0, '清零后「藏」仍可用且不涨明账');
}

// ================= 7b. 排行榜量纲:纯藏玩家肉眼可见掉队 =================
section('排行榜同量纲(藏者掉队/争者居前)');
{
  // 过门选了入公中(明账开局),随后连续3个节令只做「藏」
  const s = newGame(42);
  applyEventChoice(s, 'gong');
  const r0 = playerRank(s);
  submitTurn(s);
  for (let f = 2; f <= 4; f++) {
    skipEventIfNoChoice(s);
    while (s.ap > 0) { if (!applyAction(s, { type: 'cang', mode: 'save' }).ok) break; }
    submitTurn(s);
  }
  const r1 = playerRank(s);
  const total = leaderboard(s).length;
  ok(r0 <= 3, `明账开局位次靠前(${r0})`);
  ok(r1 >= total - 1, `连藏3令位次掉到榜尾区(${r1}/${total})`);
  // 同一节令里只做「结/持」者位次显著高于只做「藏」者
  const a = newGame(42), b = newGame(42);
  applyEventChoice(a, 'gong'); applyEventChoice(b, 'gong');
  for (let f = 2; f <= 6; f++) {
    skipEventIfNoChoice(a); skipEventIfNoChoice(b);
    while (a.ap > 0) {
      let r = applyAction(a, { type: 'chi', duty: 'yanyan' });
      if (!r.ok) r = applyAction(a, { type: 'jie', target: 'ximen', size: 'small', fund: 'si' });
      if (!r.ok) break;
    }
    while (b.ap > 0) { if (!applyAction(b, { type: 'cang', mode: 'save' }).ok) break; }
    submitTurn(a); submitTurn(b);
  }
  const ra = playerRank(a), rb = playerRank(b), n = leaderboard(a).length;
  ok(ra <= 2 && rb >= n - 1, `争榜者(${ra}) 与 纯藏者(${rb}/${n}) 拉开差距`);
  // 位次靠后有真实代价:好差事接不到
  skipEventIfNoChoice(b);
  const blocked = applyAction(b, { type: 'chi', duty: 'yanyan' });
  const allowed = applyAction(b, { type: 'chi', duty: 'puzhang' });
  ok(!blocked.ok && allowed.ok, '位次靠后只能接到铺账(低位分真实代价)');
}

// ================= 8. 五种结局判定边界 =================
section('五种结局判定边界');
{
  const mk = (mut) => {
    const s = newGame(1);
    for (let f = 1; f <= 22; f++) runFestival(s, f === 1 ? { choice: 'si' } : {});
    mut(s);
    return computeEnding(s);
  };
  ok(mk((s) => { s.player.sifang = 900; s.player.tuilu = ['niangjia', 'guanmei']; s.player.fengsheng = 10; }).key === 'liyanei', '退路≥2 且 私房≥800 且 风声<60 → 改嫁李衙内');
  ok(mk((s) => { s.player.sifang = 799; s.player.tuilu = ['niangjia', 'guanmei']; }).key === 'niangjia', '私房799(差一两不到高档) → 归娘家');
  ok(mk((s) => { s.player.sifang = 900; s.player.tuilu = ['niangjia']; }).key === 'niangjia', '只有1条退路 私房900 → 归娘家');
  ok(mk((s) => { s.player.sifang = 299; s.player.tuilu = ['niangjia']; }).key === 'shoufu', '有退路但私房不到中档 → 投奔不起,守寡留府');
  ok(mk((s) => { s.player.sifang = 100; s.player.tuilu = ['niangjia']; }).key === 'shoufu', '有退路但私房低档 → 守寡留府(私房轴连续起作用)');
  ok(mk((s) => { s.player.sifang = 500; s.player.tuilu = []; }).key === 'shoufu', '私房中档 退路0 → 守寡留府');
  ok(mk((s) => { s.player.sifang = 100; s.player.tuilu = []; }).key === 'liuluo', '私房低档 退路0 → 遣散流落');
  ok(mk((s) => { s.player.sifang = 900; s.player.tuilu = ['niangjia', 'guanmei']; s.player.faluoEver = true; s.player.fengsheng = 60; }).key === 'faluo', '触发过发落且风声未回落 → 发落出门');
  ok(mk((s) => { s.player.sifang = 900; s.player.tuilu = ['niangjia', 'guanmei']; s.player.faluoEver = true; s.player.fengsheng = 30; }).key === 'liyanei', '触发过发落但风声已回落 → 不判发落');
  // 排行榜第一与最佳结局无关
  const e = mk((s) => { s.player.sifang = 100; s.player.tuilu = []; s.bestRank = 1; });
  ok(e.key === 'liuluo' && e.bestRank === 1, '历史最高位次第一仍可能遣散流落');
}

// ================= 9. 逐字节可复现 =================
section('同种子同操作逐字节可复现');
{
  const script = (s) => {
    const log = [];
    for (let f = 1; f <= 24 && !s.over; f++) {
      if (s.phase === 'event') {
        if (s.event.choices?.length) applyEventChoice(s, s.event.choices[f % s.event.choices.length].id);
        else skipEventIfNoChoice(s);
      }
      const acts = f < 7
        ? [{ type: 'jie', target: 'ximen', size: 'small', fund: 'si' }, { type: 'cang', mode: 'save' }, { type: 'cang', mode: 'save' }]
        : [{ type: 'mou', scheme: 'sanbu', target: 'pan' }, { type: 'cang', mode: 'save' }, { type: 'tan', servant: 'xuemei', target: 'pan' }];
      for (const a of acts) if (s.ap > 0) { const r = applyAction(s, a); log.push(r.ok ? 1 : 0); }
      const rep = submitTurn(s);
      log.push(rep.rankAfter ?? 0);
    }
    return log;
  };
  const a = newGame(42), b = newGame(42);
  script(a); script(b);
  ok(snap(a) === snap(b), '两次运行最终状态逐字节一致');
  ok(a.ending && a.ending.key, `跑完24节令产生结局(${a.ending?.key})`);
}

// ================= 10. 存读一致性 =================
section('存读一致性');
{
  const s = newGame(42);
  for (let f = 1; f <= 6; f++) runFestival(s, f === 1 ? { choice: 'si' } : {});
  const json = serialize(s);
  const back = deserialize(json);
  ok(!!back && snap(back) === json, '存→读状态逐字节一致');
  // 读档后继续玩,与不间断游玩一致
  const s2 = newGame(42);
  for (let f = 1; f <= 6; f++) runFestival(s2, f === 1 ? { choice: 'si' } : {});
  for (let f = 7; f <= 10; f++) { runFestival(back, {}); runFestival(s2, {}); }
  ok(snap(back) === snap(s2), '读档续玩与连续游玩逐字节一致');
}

// ================= 11. 两种策略导向不同结局 =================
section('策略分叉');
{
  // 策略A:一路追排行榜(结/持为主,不藏不铺路)
  const a = newGame(42);
  for (let f = 1; f <= 24 && !a.over; f++) {
    if (a.phase === 'event') {
      if (a.event.choices?.length) applyEventChoice(a, f === 1 ? 'gong' : a.event.choices[0].id);
      else skipEventIfNoChoice(a);
    }
    let guard = 0;
    while (a.ap > 0 && guard++ < 6) {
      let r = applyAction(a, { type: 'chi', duty: 'yanyan' });
      if (!r.ok) r = applyAction(a, { type: 'jie', target: 'ximen', size: 'big', fund: 'gong' });
      if (!r.ok) r = applyAction(a, { type: 'jie', target: 'ximen', size: 'small', fund: 'gong' });
      if (!r.ok) r = applyAction(a, { type: 'tan', servant: 'xuemei', target: 'yue' });
      if (!r.ok) break;
    }
    submitTurn(a);
  }
  // 策略B:早早藏私房+铺退路
  const b = newGame(42);
  for (let f = 1; f <= 24 && !b.over; f++) {
    if (b.phase === 'event') {
      if (b.event.choices?.length) applyEventChoice(b, f === 1 ? 'si' : b.event.choices.at(-1).id);
      else skipEventIfNoChoice(b);
    }
    let guard = 0;
    while (b.ap > 0 && guard++ < 6) {
      let r = applyAction(b, { type: 'cang', mode: 'tuilu', line: 'guanmei' });
      if (!r.ok) r = applyAction(b, { type: 'cang', mode: 'tuilu', line: 'puzi' });
      if (!r.ok) r = applyAction(b, { type: 'cang', mode: 'tuilu', line: 'niangjia' });
      if (!r.ok) r = applyAction(b, { type: 'cang', mode: 'save' });
      if (!r.ok) break;
    }
    submitTurn(b);
  }
  ok(a.ending && b.ending && a.ending.key !== b.ending.key,
    `追榜(${a.ending?.key}) vs 早藏(${b.ending?.key}) 结局不同`);
  ok(b.ending.key === 'liyanei' || b.ending.key === 'niangjia', '早藏者全身而退');
  ok(a.ending.key === 'shoufu' || a.ending.key === 'liuluo' || a.ending.key === 'faluo', '追榜者留在塌宅或更差');
  ok(typeof a.bestRank === 'number' && a.bestRank <= 3, `追榜者最高位次靠前(${a.bestRank})`);
}

// ================= 12. 留宿与「争夜」 =================
section('留宿与争夜');
{
  const s = newGame(42);
  applyEventChoice(s, 'si');
  const si0 = s.player.sifang, ap0 = s.ap, hao0 = s.player.hao;
  let r = applyAction(s, { type: 'ye' });
  ok(r.ok && s.ap === ap0 - 1 && s.player.sifang === si0 - 60, '争夜 耗1行动+60私房');
  ok(s.player.hao > hao0 && s.yeTonight, '争夜 涨耗并记下布置');
  ok(!applyAction(s, { type: 'ye' }).ok, '一夜只能布置一次');
  const rep = submitTurn(s);
  ok(typeof s.lodging === 'string' && s.lodgingHistory[1] === s.lodging, '节令结算判定留宿并记录');
  ok(rep.notes.some((n) => n.includes('灯')), '结算里有灯的去向');
  ok(rep.lodging && typeof rep.lodging.house === 'string' && typeof rep.lodging.pan === 'boolean',
    `留宿回报携定格所需字段(house=${rep.lodging?.house}, pan=${rep.lodging?.pan})`);
  // 同种子 A/B:争夜显著抬高留宿归己(布置不走 RNG,抽签位置一致,差异全在权重)
  let yeWins = 0, noWins = 0;
  for (let seed = 100; seed < 130; seed++) {
    const run = (ye) => {
      const g = newGame(seed);
      for (let f = 1; f <= 5; f++) {
        if (g.phase === 'event') { if (g.event.choices?.length) applyEventChoice(g, g.event.choices[0].id); else skipEventIfNoChoice(g); }
        if (g.visit) applyVisitChoice(g, visitDef(g).choices[0].id);
        if (f === 5) { g.player.chong = 55; g.player.sifang = 500; if (ye) applyAction(g, { type: 'ye' }); }
        submitTurn(g);
      }
      return g.lodgingHistory[5];
    };
    if (run(true) === 'player') yeWins++;
    if (run(false) === 'player') noWins++;
  }
  ok(yeWins > noWins, `争夜显著抬高中签(${yeWins} vs ${noWins})`);
  // 清零后争夜不可用
  const late = newGame(42);
  for (let f = 1; f <= 18; f++) runFestival(late, f === 1 ? { choice: 'gong' } : {});
  skipEventIfNoChoice(late);
  submitTurn(late);
  if (late.event.choices?.length) applyEventChoice(late, late.event.choices.at(-1).id);
  else skipEventIfNoChoice(late);
  ok(!applyAction(late, { type: 'ye' }).ok, '第79回后「夜」不可用');
}

// ================= 13. 「耗」的累积与对结局的影响 =================
section('耗与结局降档');
{
  const mk = (hao, mut = null) => {
    const g = newGame(1);
    g.player.sifang = 900; g.player.tuilu = ['niangjia', 'guanmei']; g.player.fengsheng = 10;
    g.player.hao = hao;
    mut?.(g);
    return computeEnding(g);
  };
  ok(mk(0).key === 'liyanei', '无耗 → 改嫁李衙内');
  ok(mk(54).key === 'liyanei', '耗54 未过线 → 不降档');
  ok(mk(55).key === 'niangjia', '耗55 → 降一档(改嫁→归娘家)');
  ok(mk(84).key === 'niangjia', '耗84 → 仍只降一档');
  ok(mk(85).key === 'shoufu', '耗85 → 降两档(改嫁→守寡留府)');
  ok(mk(90, (g) => { g.player.faluoEver = true; g.player.fengsheng = 70; }).key === 'faluo', '耗不推翻发落判定');
  ok(mk(85).haoWeak && !mk(0).haoWeak, '结局携回耗的成色(供结算文案)');
  // 耗只涨不减:争夜与迎灯都往里添
  const g = newGame(42);
  applyEventChoice(g, 'si');
  const h0 = g.player.hao;
  applyAction(g, { type: 'ye' });
  submitTurn(g);
  ok(g.player.hao > h0, '耗随争夜累积');
}

// ================= 14. 上门事件分支 =================
section('上门事件分支');
{
  const s = newGame(42);
  applyEventChoice(s, 'si');
  s.visit = { id: 'xuee_jieqian' };
  const si0 = s.player.sifang;
  let r = applyVisitChoice(s, 'give');
  ok(r.ok && s.player.sifang === si0 - 60 && s.player.renqing.xuee === 15, '孙雪娥借钱:给 → −60私房 +人情');
  s.visit = { id: 'xuee_jieqian' };
  const h0 = s.rivals.xuee.hostility;
  r = applyVisitChoice(s, 'refuse');
  ok(r.ok && s.rivals.xuee.hostility === h0 + 20, '孙雪娥借钱:不给 → 记恨');
  s.visit = { id: 'pan_chai' };
  r = applyVisitChoice(s, 'accept');
  ok(r.ok && !!s.flags.panChai, '收下潘金莲的钗 → 记下这笔债');
  s.visit = { id: 'pan_collect' };
  const si1 = s.player.sifang;
  r = applyVisitChoice(s, 'pay');
  ok(r.ok && s.player.sifang === si1 - 100 && !s.flags.panChai, '她日后来收账 → 两清');
  s.visit = { id: 'daian_menkan' };
  const w0 = s.player.fengsheng;
  r = applyVisitChoice(s, 'ignore');
  ok(r.ok && s.player.fengsheng === w0 + 8, '不理玳安 → 风声起');
  s.visit = { id: 'ximen_ye' };
  const hh0 = s.player.hao;
  r = applyVisitChoice(s, 'open');
  ok(r.ok && s.player.hao === hh0 + 8 && s.lodgingOverride === 'player', '开门迎灯 → +耗,灯定在你院');
  submitTurn(s);
  ok(s.lodging === 'player', '迎灯当夜留宿归己(不走抽签)');
  ok(s.visit === null, '节令一过,未应的门自己走了');
  // 第三轮加厚:四个新登门事件,分支都有代价
  s.visit = { id: 'ximen_zui' };
  const cz0 = s.player.chong, hz0 = s.player.hao, hp0 = s.rivals.pan.hostility;
  r = applyVisitChoice(s, 'stay');
  ok(r.ok && s.player.chong === cz0 + 9 && s.player.hao === hz0 + 6 && s.rivals.pan.hostility === hp0 + 12,
    '家主醉后走错院:留他 → +宠+耗,别房敌意起');
  s.visit = { id: 'ximen_zui' };
  const ct0 = s.player.tiyan, cc0 = s.player.chong, ry0 = s.player.renqing.yue;
  r = applyVisitChoice(s, 'back');
  ok(r.ok && s.player.tiyan === ct0 + 6 && s.player.chong === cc0 - 5 && s.player.renqing.yue === ry0 + 8,
    '家主醉后走错院:送回正房 → +体面−宠,大娘子记情');
  s.visit = { id: 'pan_jieren' };
  const ap0 = s.rivals.pan.affection, fw0 = s.player.fengsheng;
  r = applyVisitChoice(s, 'clever');
  ok(r.ok && s.rivals.pan.affection === ap0 + 18 && s.player.fengsheng === fw0 + 5,
    '借伶俐丫头 → 她领情,你屋里的事她也知道了');
  s.visit = { id: 'pan_jieren' };
  const hp1 = s.rivals.pan.hostility;
  r = applyVisitChoice(s, 'refuse');
  ok(r.ok && s.rivals.pan.hostility === hp1 + 20, '一个也不借 → 当场结怨');
  s.visit = { id: 'chunmei_chuanhua' };
  const cc1 = s.player.chong, hh1 = s.player.hao;
  r = applyVisitChoice(s, 'catch');
  ok(r.ok && s.player.chong === cc1 + 7 && s.player.hao === hh1 + 5, '接住春梅的下半句 → +宠+耗');
  s.visit = { id: 'xuemei_yanei' };
  r = applyVisitChoice(s, 'catch');
  ok(r.ok && !!s.flags.yaneiLine, '接住李衙内的风声 → 记下这条退路伏笔');
  s.visit = { id: 'xuemei_yanei' };
  r = applyVisitChoice(s, 'dodge');
  ok(r.ok && !!s.flags.yaneiShut, '岔开话 → 她从此不再提');
  ok(!s.visit, '新登门事件表态后清场');
  // 频次:每 2-3 令至少一次(掷定走 seedRNG)
  const g = newGame(42);
  let count = 0, last = 0, maxGap = 0;
  for (let f = 1; f <= 22 && !g.over; f++) {
    if (g.phase === 'event') { if (g.event.choices?.length) applyEventChoice(g, g.event.choices[0].id); else skipEventIfNoChoice(g); }
    if (g.visit) { applyVisitChoice(g, visitDef(g).choices[0].id); count++; maxGap = Math.max(maxGap, f - last); last = f; }
    while (g.ap > 0) { if (!applyAction(g, { type: 'cang', mode: 'save' }).ok) break; }
    submitTurn(g);
  }
  ok(count >= 6, `全程上门 ${count} 次(≥6)`);
  ok(maxGap <= 3, `上门间隔不超过 3 令(最大 ${maxGap})`);
}

// ================= 15. 「结·私」主动示意 =================
section('结·私(主动示意)');
{
  const s = newGame(42);
  applyEventChoice(s, 'si');
  const si0 = s.player.sifang, ap0 = s.ap, c0 = s.player.chong;
  const rq0 = snap(s.player.renqing), tl0 = s.player.tuilu.length;
  let r = applyAction(s, { type: 'shi' });
  ok(r.ok && s.ap === ap0 - 1 && s.player.sifang === si0 - 40, '结·私 耗1行动+40私房');
  ok(s.shiTonight && s.player.chong === c0 + 2, '结·私 记下铺垫并添一点宠(明账)');
  ok(snap(s.player.renqing) === rq0 && s.player.tuilu.length === tl0, '结·私 不涨任何暗账');
  ok(!applyAction(s, { type: 'shi' }).ok, '一令只能递一份');
  // 节令一过,铺垫清空
  submitTurn(s);
  ok(!s.shiTonight && !s.shiTrace, '节令过后铺垫与痕迹清空');
  // 同种子 A/B:结·私显著抬高留宿归己(与「争夜」同一判据)
  let shiWins = 0, noWins = 0;
  for (let seed = 100; seed < 130; seed++) {
    const run = (shi) => {
      const g = newGame(seed);
      for (let f = 1; f <= 5; f++) {
        if (g.phase === 'event') { if (g.event.choices?.length) applyEventChoice(g, g.event.choices[0].id); else skipEventIfNoChoice(g); }
        if (g.visit) applyVisitChoice(g, visitDef(g).choices[0].id);
        if (f === 5) { g.player.chong = 55; g.player.sifang = 500; if (shi) applyAction(g, { type: 'shi' }); }
        submitTurn(g);
      }
      return g.lodgingHistory[5];
    };
    if (run(true) === 'player') shiWins++;
    if (run(false) === 'player') noWins++;
  }
  ok(shiWins > noWins, `结·私显著抬高中签(${shiWins} vs ${noWins})`);
  // 痕迹:被瞧见时风声起、结算里有话柄(遍历种子必有一例)
  let seenCase = null;
  for (let seed = 1; seed <= 60 && !seenCase; seed++) {
    const g = newGame(seed);
    applyEventChoice(g, 'gong');
    const rr = applyAction(g, { type: 'shi' });
    if (rr.ok && rr.seen) seenCase = g;
  }
  ok(!!seenCase, '存在被仆役瞧见的种子');
  if (seenCase) {
    ok(seenCase.player.fengsheng >= 4 && seenCase.shiTrace?.rival, '被瞧见 → 风声起 + 痕迹记下哪一房');
    const rep2 = submitTurn(seenCase);
    ok(rep2.notes.some((n) => n.includes('瞧见')), '结算里那句话成了话柄');
  }
  // 薛媒婆的路子:接住李衙内的风声,官媒门路便宜一百两
  const g2 = newGame(42);
  for (let f = 1; f <= 16; f++) runFestival(g2, f === 1 ? { choice: 'si' } : {});
  skipEventIfNoChoice(g2);
  g2.player.sifang = 350;
  ok(!applyAction(g2, { type: 'cang', mode: 'tuilu', line: 'guanmei' }).ok, '官媒门路原价400,350两不够');
  g2.flags.yaneiLine = 10;
  const rr2 = applyAction(g2, { type: 'cang', mode: 'tuilu', line: 'guanmei' });
  ok(rr2.ok && g2.player.sifang === 50, '接住风声后官媒门路300两可开');
  // 第79回后主动示意不可用
  const late = newGame(42);
  for (let f = 1; f <= 18; f++) runFestival(late, f === 1 ? { choice: 'gong' } : {});
  skipEventIfNoChoice(late);
  submitTurn(late);
  if (late.event.choices?.length) applyEventChoice(late, late.event.choices.at(-1).id);
  else skipEventIfNoChoice(late);
  ok(!applyAction(late, { type: 'shi' }).ok, '第79回后「结·私」不可用');
}

// ================= 16. 情分(qing)轴与安全线 =================
section('情分(qing)轴与安全线');
{
  // 键集焊死在成年白名单:永不扩键,未成年角色一个字都进不来
  const ADULT = new Set(['ximen', 'yue', 'lijiaoer', 'xuee', 'pan', 'pinger', 'chunmei']);
  const keys = Object.keys(newGame(1).player.qing);
  ok(keys.length > 0 && keys.every((k) => ADULT.has(k)), `qing 键集 ⊆ 成年白名单(${keys.join('/')})`);
  ok(Object.values(newGame(1).player.qing).every((v) => v === 0), 'qing 初始全 0');
  // 旧档迁移:无 qing 的 version 2 存档读进来要回填,不崩
  const legacy = JSON.parse(serialize(newGame(1)));
  delete legacy.player.qing;
  const back = deserialize(JSON.stringify(legacy));
  ok(!!back?.player.qing && Object.keys(back.player.qing).every((k) => ADULT.has(k)), '旧档(无 qing)读入自动回填');
  // 情分的来路:结/结·私/留宿涨,藏不涨——藏是暗账,与情分轴正交
  const s = newGame(42);
  applyEventChoice(s, 'si');
  applyAction(s, { type: 'jie', target: 'ximen', size: 'small', fund: 'si' });
  ok(s.player.qing.ximen > 0, '结(家主) → 情分涨');
  const q0 = s.player.qing.ximen;
  applyAction(s, { type: 'shi' });
  ok(s.player.qing.ximen > q0, '结·私 → 情分再涨');
  applyAction(s, { type: 'cang', mode: 'save' });
  const qAll0 = JSON.stringify(s.player.qing);
  submitTurn(s);
  ok(s.player.qing.ximen < 100, '情分随宠衰减(不维持就淡)');
  const s2 = newGame(42);
  applyEventChoice(s2, 'si');
  const qBefore = JSON.stringify(s2.player.qing);
  applyAction(s2, { type: 'cang', mode: 'save' });
  applyAction(s2, { type: 'cang', mode: 'save' });
  ok(JSON.stringify(s2.player.qing) === qBefore, '「藏」不涨任何情分(暗账正交)');
  // 分档边界:生分/暧昧/亲密/独宠·露骨
  ok(intimacyTier(0) === 'sheng' && intimacyTier(19) === 'sheng'
    && intimacyTier(20) === 'mei' && intimacyTier(49) === 'mei'
    && intimacyTier(50) === 'qin' && intimacyTier(79) === 'qin'
    && intimacyTier(80) === 'du' && intimacyTier(100) === 'du', '亲密四档阈值(20/50/80)');
  ok(INTIMACY_TIERS.every((t) => INTIMACY[t]?.length >= 3), '四档各有至少三条成句');
  // 童角色词共现扫描:官哥儿/孝哥儿出现的行,不许沾任何情欲词
  const EROTIC = ['肌肤', '解衣', '褪', '唇', '颈', '气息', '枕', '帐', '腰', '胸', '腿', '喘', '亵', '情欲', '暧昧', '亲密', '露骨'];
  let clean = true;
  for (const f of ['js/data.js', 'js/text.js']) {
    const lines = readFileSync(join(APP_DIR, f), 'utf8').split('\n');
    for (const line of lines) {
      if (!/官哥儿|孝哥/.test(line)) continue;
      if (EROTIC.some((w) => line.includes(w))) { clean = false; console.log(`    共现违例 ${f}: ${line.trim()}`); }
    }
  }
  ok(clean, '官哥儿/孝哥儿相关串与情欲词零共现');
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
