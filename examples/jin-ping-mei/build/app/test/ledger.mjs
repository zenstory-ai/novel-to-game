#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../js/engine.js';
import {
  HEROINE_IDS, HOUSEHOLD_IDS, HOUSEHOLD, HOUSEHOLD_EVENTS,
  ROUTE_CHOICES, SCENES, DAY_ACTIONS, OPENING_CHOICES, BANQUET_CHOICES,
} from '../js/data.js';
import { ASSET_PATHS, CRITICAL_CG_KEYS } from '../js/assets.js';
import { TEXT } from '../js/text.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let passed=0, failed=0;
const section=n=>console.log(`\n== ${n} ==`);
function test(n,fn){try{fn();passed++;console.log(`  PASS  ${n}`)}catch(e){failed++;console.log(`  FAIL  ${n}`);console.error(`        ${e.message}`)}}
const ok=(v,m)=>assert.ok(v,m), eq=(a,b,m)=>assert.deepEqual(a,b,m);
function morning(s,p){if(s.phase!=='morning')return;const o=E.morningOptions(s).find(x=>x.id===p&&!x.disabled)||E.morningOptions(s).find(x=>!x.disabled);const r=E.resolveMorning(s,o.id);assert.equal(r.ok,true,r.error)}
function day(s,a,banquet='banquet_balance'){const r=E.chooseDayAction(s,a);assert.equal(r.ok,true,r.error);if(s.phase==='household'){const option=E.householdOptions(s).find(x=>!x.disabled);assert.ok(option);assert.equal(E.resolveHouseholdEvent(s,option.id).ok,true)}if(s.phase==='banquet'){let b=E.chooseBanquet(s,banquet);if(!b.ok)b=E.chooseBanquet(s,'banquet_honor_yue');assert.equal(b.ok,true,b.error);E.closeScene(s)}}
function visit(s,h,c,n='talk'){assert.equal(E.startVisit(s,h).ok,true);const rows=E.visitChoices(s,h);const rc=rows.find(x=>x.id===c&&!x.disabled)||rows.find(x=>!x.disabled);assert.ok(rc,`no route d${s.day} ${h}`);assert.equal(E.chooseVisit(s,rc.id).ok,true);const nights=E.nightOptions(s);const nc=nights.find(x=>x.id===n&&!x.disabled)||nights.find(x=>x.id==='prelude'&&!x.disabled)||nights.find(x=>x.id==='talk');assert.ok(nc);const r=E.chooseNight(s,nc.id);assert.equal(r.ok,true,r.error);if(s.phase==='scene')E.closeScene(s);return nc.id}
function strategy(kind){const s=E.newGame(42);if(kind==='exclusive'){E.chooseOpening(s,'respect_yue');const cs=['yue_share_shortfall','yue_show_accounts','yue_keep_word','yue_ask_backing','yue_offer_seat','yue_share_keys'];for(let d=1;d<=6;d++){morning(s,'explain');day(s,'banquet','banquet_honor_yue');visit(s,'wu_yueniang',cs[d-1],d>=3?'explicit':'prelude')}}else if(kind==='balanced'){E.chooseOpening(s,'respect_yue');const hs=['li_pinger','pan_jinlian','wu_yueniang','li_pinger','pan_jinlian','li_pinger'],cs=['pinger_settle_room','pan_take_clue','yue_keep_word','pinger_sit_quiet','pan_call_bluff','pinger_return_key'];for(let d=1;d<=6;d++){morning(s,'explain');day(s,d===5?'banquet':'ledger');visit(s,hs[d-1],cs[d-1])}}else{E.chooseOpening(s,'tease_pan');const hs=['pan_jinlian','pan_jinlian','wu_yueniang','pan_jinlian','li_pinger','wu_yueniang'],cs=['pan_take_cup','pan_take_clue','yue_public_spend','pan_answer_door','pinger_spend_on_pan','yue_last_tea'],as=['listen','listen','office','listen','office','ledger'];for(let d=1;d<=6;d++){morning(s,'explain');day(s,as[d-1],'banquet_honor_yue');visit(s,hs[d-1],cs[d-1])}}return s}
function explicit(h){const s=E.newGame(91),p={wu_yueniang:['respect_yue',['yue_share_shortfall','yue_show_accounts','yue_keep_word']],pan_jinlian:['tease_pan',['pan_take_cup','pan_take_clue']],li_pinger:['respect_yue',['pinger_settle_room','pinger_protect_books','pinger_protect_public']]}[h];E.chooseOpening(s,p[0]);for(let i=0;i<p[1].length;i++){morning(s,'explain');const final=i===p[1].length-1;day(s,h==='pan_jinlian'&&final?'listen':'ledger');visit(s,h,p[1][i],final?'explicit':'prelude')}return s}
function explicitGate(h,action){const s=E.newGame(17),p={wu_yueniang:['respect_yue',['yue_share_shortfall','yue_show_accounts','yue_keep_word']],pan_jinlian:['tease_pan',['pan_take_cup','pan_take_clue']],li_pinger:['respect_yue',['pinger_settle_room','pinger_protect_books','pinger_protect_public']]}[h],choices=p[1];E.chooseOpening(s,p[0]);for(const choice of choices.slice(0,-1)){morning(s,'explain');day(s,'ledger');visit(s,h,choice,'prelude')}morning(s,'explain');day(s,action);E.startVisit(s,h);E.chooseVisit(s,choices.at(-1));return !E.nightOptions(s).find(x=>x.id==='explicit').disabled}
function directorySize(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,entry)=>{const target=path.join(dir,entry.name);return sum+(entry.isDirectory()?directorySize(target):fs.statSync(target).size)},0)}

section('身份与存档');
test('新局版本 5 且三条成人深线不变',()=>{const s=E.newGame(1);eq(s.version,5);eq(Object.keys(s.relations),['wu_yueniang','pan_jinlian','li_pinger'])});
test('开场是正堂身份选择',()=>{const s=E.newGame(1);eq(s.phase,'opening');ok(OPENING_CHOICES.some(x=>x.id==='respect_yue'))});
test('旧 v1/v2 存档拒读',()=>{eq(E.deserialize('{"version":1}'),null);eq(E.deserialize('{"version":2}'),null)});
test('v3 存档补齐宅中人后迁入 v5',()=>{const old=E.newGame(1);old.version=3;delete old.household;delete old.currentHouseholdEvent;delete old.publicOverrides;delete old.routeReopensOn;const loaded=E.deserialize(JSON.stringify(old));eq(loaded.version,5);eq(Object.keys(loaded.household),HOUSEHOLD_IDS);eq(Object.keys(loaded.publicOverrides),['wu_yueniang','pan_jinlian','li_pinger'])});
test('v4 存档按失信旗标反推越过计数后迁入 v5',()=>{const old=E.newGame(1);old.version=4;old.flags={broken_pan_word:true};delete old.publicOverrides;delete old.routeReopensOn;const loaded=E.deserialize(JSON.stringify(old));eq(loaded.version,5);eq(loaded.publicOverrides.pan_jinlian,1);eq(loaded.publicOverrides.wu_yueniang,0);ok(!E.routeCooling(loaded,'pan_jinlian'))});
test('F1 破裂规则:公开越过一次不锁,两次才冷却一天',()=>{const s=E.newGame(1);s.day=2;
  s.publicOverrides.wu_yueniang=1;ok(!E.evaluateBreak(s,'wu_yueniang'),'一次不该触发破裂');ok(!E.routeCooling(s,'wu_yueniang'),'一次不该锁');
  s.publicOverrides.wu_yueniang=2;ok(E.evaluateBreak(s,'wu_yueniang'),'两次应触发破裂');ok(E.routeCooling(s,'wu_yueniang'),'两次该冷却');
  eq(s.routeReopensOn.wu_yueniang,3);
  s.day=3;ok(!E.routeCooling(s,'wu_yueniang'),'次日应重开,不是永久锁')});
test('F1 破裂规则:house 跌破 30 冷却全部三条线',()=>{const s=E.newGame(1);s.day=2;s.resources.house=28;
  E.evaluateHouseBreak(s);
  for(const id of ['wu_yueniang','pan_jinlian','li_pinger']) ok(E.routeCooling(s,id),id+' 应随 house 跌破而冷却');
  s.day=3;for(const id of ['wu_yueniang','pan_jinlian','li_pinger']) ok(!E.routeCooling(s,id),id+' 次日应重开')});
test('F1 单次公开越过不再永久锁死明确场景',()=>{const s=E.newGame(1);s.day=4;
  // 走过一次公开越过(旗标 + 计数 1),这是修复前会永久锁死明确场景的状态
  s.flags.broken_yue_word=true;s.publicOverrides.wu_yueniang=1;
  ok(!E.routeCooling(s,'wu_yueniang'),'一次失信不得锁死路线');
  // 门控条件齐备时明确场景应可达(不再被永久旗标一票否决)
  s.relations.wu_yueniang.qing=60;s.flags.kept_yue_word=true;s.resources.house=55;s.selectedDayAction='ledger';
  s.currentHeroine='wu_yueniang';s.phase='night';
  const opt=E.nightOptions(s).find(o=>o.id==='explicit');
  ok(!opt.disabled,'条件齐备时明确场景应可达,实际锁定原因:'+(opt.locked??''))});
test('F2 身体耗损有读取点:高耗损撑不起走官面与整席面',()=>{const s=E.newGame(1);s.resources.strain=0;
  const before=E.dayOptions(s);ok(!before.find(o=>o.id==='banquet').disabled,'低耗损时整席面可选');
  s.resources.strain=E.STRAIN_STRAINED;
  const after=E.dayOptions(s);
  ok(after.find(o=>o.id==='banquet').disabled,'高耗损应锁整席面');
  ok(after.find(o=>o.id==='office').disabled,'高耗损应锁走官面');
  ok(!after.find(o=>o.id==='ledger').disabled,'翻账不受耗损影响');
  ok(!after.find(o=>o.id==='listen').disabled,'问口风不受耗损影响')});
test('F2 身体耗损会回落:不进场景的一夜减 6',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'ledger');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');s.resources.strain=20;E.chooseNight(s,'talk');eq(s.resources.strain,20-E.STRAIN_REST_RELIEF)});
test('新存档往返一致',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');eq(E.deserialize(E.serialize(s)),s)});
test('同 seed 同选择逐字节复现',()=>eq(E.serialize(strategy('exclusive')),E.serialize(strategy('exclusive'))));

section('成人安全与资产');
const ADULTS=new Set(['wu_yueniang','pan_jinlian','li_pinger']);
test('成年白名单与独立期望一致',()=>eq(new Set(HEROINE_IDS),ADULTS));
test('7 个唯一 scene_id',()=>eq(Object.keys(SCENES).sort(),['banquet_conflict','pan_explicit','pan_prelude','pinger_explicit','pinger_prelude','yue_explicit','yue_prelude']));
test('成人参与者全是白名单严格子集',()=>{for(const sc of Object.values(SCENES).filter(x=>x.tier!=='public')){ok(sc.participants.length>0&&sc.participants.length<ADULTS.size);ok(sc.participants.every(x=>ADULTS.has(x)));ok(E.sceneIsAdultSafe(sc))}});
test('成人节点零未成年词',()=>{const p=JSON.stringify(Object.values(SCENES).filter(x=>x.tier!=='public'));for(const t of ['官哥儿','孝哥儿','guan_ge','xiao_ge'])ok(!p.includes(t),t)});
test('7 个资产键不复用',()=>eq(new Set(Object.values(SCENES).map(x=>x.asset)).size,7));
test('关键 CG 文件全部存在且非占位小图',()=>{eq(CRITICAL_CG_KEYS.length,7);for(const k of CRITICAL_CG_KEYS){const f=path.join(ROOT,ASSET_PATHS[k]);ok(fs.existsSync(f),f);ok(fs.statSync(f).size>100000,k)}});
test('运行包体低于 25 MB',()=>ok(directorySize(ROOT)<25*1024*1024,`${directorySize(ROOT)} bytes`));

section('路线与关系');
test('关系值全程钳在 0–100',()=>{const s=strategy('exclusive');for(const r of Object.values(s.relations))for(const k of ['qing','yu','du'])ok(r[k]>=0&&r[k]<=100)});
test('锁定的明确场景给人物化原因',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'ledger');E.startVisit(s,'wu_yueniang');E.chooseVisit(s,'yue_share_shortfall');const o=E.nightOptions(s).find(x=>x.id==='explicit');ok(o.disabled&&o.locked.length>8)});
test('“到此为止”始终可选',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');day(s,'ledger');E.startVisit(s,'li_pinger');E.chooseVisit(s,'pinger_settle_room');eq(E.nightOptions(s).find(x=>x.id==='leave').disabled,false)});
test('月娘前奏与明确场景可由守约赢得',()=>{const s=explicit('wu_yueniang');ok(s.unlocked.includes('yue_prelude'));ok(s.unlocked.includes('yue_explicit'));ok(s.flags.kept_yue_word);eq(s.morning.id,'yue_help')});
test('金莲前奏与明确场景可由真话赢得',()=>{const s=explicit('pan_jinlian');ok(s.unlocked.includes('pan_prelude'));ok(s.unlocked.includes('pan_explicit'));ok(s.flags.pan_promised);eq(s.morning.id,'pan_claim')});
test('瓶儿前奏与明确场景可由保护赢得',()=>{const s=explicit('li_pinger');ok(s.unlocked.includes('pinger_prelude'));ok(s.unlocked.includes('pinger_explicit'));ok(s.flags.protected_pinger);eq(s.morning.id,'pinger_help')});
test('亲密前奏改变情、欲与身体三项',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'ledger');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');const b=E.snapshot(s);E.chooseNight(s,'prelude');ok(s.relations.pan_jinlian.qing!==b.relations.pan_jinlian.qing);ok(s.relations.pan_jinlian.yu!==b.relations.pan_jinlian.yu);ok(s.resources.strain!==b.resources.strain)});
test('四种白天动作各有路线亲和且无一通吃',()=>{const expected={ledger:['wu_yueniang','li_pinger'],office:['li_pinger'],listen:['pan_jinlian'],banquet:['wu_yueniang']};for(const [action,winners] of Object.entries(expected))eq(HEROINE_IDS.filter(h=>explicitGate(h,action)),winners,action)});

section('闭环与延迟后果');
test('人物秘密可解决次日白天压力',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'listen');visit(s,'pan_jinlian','pan_take_cup');morning(s);day(s,'listen');visit(s,'pan_jinlian','pan_take_clue');morning(s);ok(s.secrets.includes('shop_fraud'));const b=E.snapshot(s.resources);E.chooseDayAction(s,'office');ok(s.secretsUsed.includes('shop_fraud'));ok(s.resources.power>b.power);ok(s.resources.exposure>b.exposure)});
test('第1日尊重在第3日回响',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');day(s,'ledger');visit(s,'li_pinger','pinger_settle_room');morning(s);day(s,'ledger');visit(s,'pan_jinlian','pan_take_clue');eq(s.morning.id,'yue_delayed');ok(s.morning.title.includes('两日前'))});
test('嫉妒指出玩家可见的具体院门',()=>{const s=explicit('pan_jinlian');morning(s,'explain');day(s,'listen');visit(s,'pan_jinlian','pan_bring_confrontation','talk');eq(s.morning.id,'jealousy');ok(s.morning.text.includes('花园角门'));ok(s.history.some(x=>x.type==='night'&&x.visible))});
test('次晨哄、说明、坚持有不同代价',()=>{const make=()=>{const s=explicit('pan_jinlian');morning(s,'explain');day(s,'listen');visit(s,'pan_jinlian','pan_bring_confrontation','talk');return s},a=make(),b=make(),c=make();E.resolveMorning(a,'appease');E.resolveMorning(b,'explain');E.resolveMorning(c,'stand');ok(a.resources.silver<b.resources.silver);ok(b.resources.exposure>a.resources.exposure);ok(c.resources.house<b.resources.house)});
test('第5日宴席解锁群体冲突 CG',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');for(let d=1;d<=4;d++){morning(s);day(s,'ledger');visit(s,'li_pinger',null)}morning(s);E.chooseDayAction(s,'banquet');E.chooseBanquet(s,'banquet_honor_yue');eq(s.pendingScene,'banquet_conflict');ok(s.unlocked.includes('banquet_conflict'))});

section('宅中短线');
test('新增三名成年宅中人但不混入成人场景白名单',()=>{eq(HOUSEHOLD_IDS,['meng_yulou','sun_xuee','li_jiaoer']);for(const id of HOUSEHOLD_IDS){ok(HOUSEHOLD[id].adult===true,id);ok(!HEROINE_IDS.includes(id),id);ok(!Object.values(SCENES).some(scene=>scene.participants.includes(id)),id)}});
test('第2至4日各有一段两选一事件',()=>{eq(Object.keys(HOUSEHOLD_EVENTS).map(Number),[2,3,4]);for(const event of Object.values(HOUSEHOLD_EVENTS)){eq(event.choices.length,2);ok(event.choices.every(choice=>choice.text&&choice.effects&&choice.label),event.id)}});
test('玉楼事件会留下人情并回到黄昏选门',()=>{const s=E.newGame(5);E.chooseOpening(s,'respect_yue');day(s,'ledger');visit(s,'wu_yueniang','yue_share_shortfall','talk');morning(s);const before=s.household.meng_yulou.regard;E.chooseDayAction(s,'office');eq(s.phase,'household');eq(E.currentHouseholdEvent(s).actor,'meng_yulou');const result=E.resolveHouseholdEvent(s,'meng_let_speak');ok(result.ok);eq(s.phase,'choose_visit');ok(s.household.meng_yulou.regard>before);ok(s.history.some(item=>item.type==='household'&&item.choice==='meng_let_speak'))});
test('娇儿不会让你拿空口换二十两的门路',()=>{const s=E.newGame(5);s.day=4;s.phase='household';s.currentHouseholdEvent='jiaoer_collector';s.resources.silver=19;const paid=E.householdOptions(s).find(item=>item.id==='jiaoer_buy_name');ok(paid.disabled);eq(E.resolveHouseholdEvent(s,'jiaoer_buy_name').ok,false);eq(s.resources.silver,19)});
test('宅中人态度写进最终结算',()=>{const s=strategy('balanced');ok(s.ending.householdResults.length===3);ok(s.ending.householdResults.every(item=>item.name&&item.result))});

section('三种收束');
const ex=strategy('exclusive'),bal=strategy('balanced'),intr=strategy('intrigue');
test('专一深线 6 日可达',()=>eq(ex.ending.id,'exclusive'));
test('平衡后宫 6 日可达',()=>eq(bal.ending.id,'balanced'));
test('权谋风月 6 日可达',()=>eq(intr.ending.id,'intrigue'));
test('三种策略状态不同',()=>eq(new Set([E.serialize(ex),E.serialize(bal),E.serialize(intr)]).size,3));
test('专一路线回读理解型结果',()=>{eq(ex.ending.heroineName,'吴月娘');eq(ex.ending.routeResult,'共掌一宅');ok(ex.unlocked.includes('yue_explicit'))});
test('平衡路线三人情近且无人翻脸',()=>{for(const r of Object.values(bal.relations)){ok(r.qing>=30);ok(r.du<70)}});
test('权谋路线消费两条人情秘密并留下暴露',()=>{ok(intr.secretsUsed.length>=2);ok(intr.resources.power>=4);ok(intr.resources.exposure>=25)});
test('无白天动作同时抬升全部外账',()=>{for(const a of Object.keys(DAY_ACTIONS)){const s=E.newGame(1);E.chooseOpening(s,'respect_yue');const b=E.snapshot(s.resources);ok(E.chooseDayAction(s,a).ok);ok(['silver','power','repute','house'].filter(k=>s.resources[k]>b[k]).length<4,a)}});

section('声口与数据完整性');
test('所有主按钮不超过 10 个汉字',()=>{const ls=[...OPENING_CHOICES.map(x=>x.label),...Object.values(DAY_ACTIONS).map(x=>x.label),...Object.values(ROUTE_CHOICES).flat(2).map(x=>x.label),...BANQUET_CHOICES.map(x=>x.label)];for(const l of ls)ok([...l].length<=10,l)});
test('运行时文本不命中禁用 AI 腔',()=>{const p=JSON.stringify({TEXT,ROUTE_CHOICES,SCENES,OPENING_CHOICES,BANQUET_CHOICES,HOUSEHOLD_EVENTS});for(const x of [/并非.{0,20}而是/,/不是.{0,20}而是/,/真正的.{0,20}从来不是/,/这一刻你终于明白/,/这意味着/,/眼中闪过/,/嘴角勾起/,/仿佛/,/宛若/,/带着一丝/])ok(!x.test(p),x);ok((p.match(/兑现/g)||[]).length<=2,'“兑现”重复过多')});
test('玩家界面不再露出策划说明书用语',()=>{const source=fs.readFileSync(path.join(ROOT,'js/main.js'),'utf8');for(const phrase of ['她要：','她能给：','理解型结果','关系终段','成人前奏','这里不替你总结人生'])ok(!source.includes(phrase),phrase)});
test('六个人各有能听出的声口标记',()=>{const routeText=Object.values(ROUTE_CHOICES).flat(2).map(x=>x.text);ok(routeText.filter(x=>x.includes('官人')).length>=3,'金莲声口');ok(HOUSEHOLD.meng_yulou.voice.includes('笑'),'玉楼声口');ok(HOUSEHOLD.sun_xuee.voice.includes('灶'),'雪娥声口');ok(HOUSEHOLD.li_jiaoer.voice.includes('银'),'娇儿声口')});
test('三人 6 日每天至少一项不锁死',()=>{for(const id of HEROINE_IDS){eq(ROUTE_CHOICES[id].length,6);for(const d of ROUTE_CHOICES[id])ok(d.some(x=>!x.condition),id)}});
test('每名女主都有前奏与关系终段 CG',()=>{for(const id of HEROINE_IDS)eq(new Set(Object.values(SCENES).filter(x=>x.heroine===id).map(x=>x.tier)),new Set(['prelude','explicit']))});
test('剧情旗标写入后都有下游消费',()=>{
  const source=['js/data.js','js/engine.js'].map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');
  const names=new Set();
  for(const group of source.matchAll(/flags:\s*\[([^\]]*)\]/g))
    for(const hit of group[1].matchAll(/'([^']+)'/g))names.add(hit[1]);
  for(const hit of source.matchAll(/addFlag\(state,\s*'([^']+)'/g))names.add(hit[1]);
  for(const name of names)ok(source.split(name).length>2,`${name} 只写未读`);
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if(failed)process.exit(1);
