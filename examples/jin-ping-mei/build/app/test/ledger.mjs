#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../js/engine.js';
import {
  HEROINE_IDS, HOUSEHOLD_IDS, HOUSEHOLD, HOUSEHOLD_EVENTS,
  ROUTE_CHOICES, ACCORD_CHOICES, JOINT_ACTIONS, SHARED_NIGHT_CHOICES,
  SHARED_AFTERGLOW_BEATS, SHARED_DAWN_CHOICES,
  SCENES, DAY_ACTIONS, OPENING_CHOICES, BANQUET_CHOICES,
} from '../js/data.js';
import { ASSET_PATHS, CRITICAL_CG_KEYS } from '../js/assets.js';
import { TEXT } from '../js/text.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let passed=0, failed=0;
const section=n=>console.log(`\n== ${n} ==`);
function test(n,fn){try{fn();passed++;console.log(`  PASS  ${n}`)}catch(e){failed++;console.log(`  FAIL  ${n}`);console.error(`        ${e.message}`)}}
const ok=(v,m)=>assert.ok(v,m), eq=(a,b,m)=>assert.deepEqual(a,b,m);
function morning(s,p){if(s.phase!=='morning')return;const o=E.morningOptions(s).find(x=>x.id===p&&!x.disabled)||E.morningOptions(s).find(x=>!x.disabled);const r=E.resolveMorning(s,o.id);assert.equal(r.ok,true,r.error)}
function afterDay(s,banquet='banquet_balance'){if(s.phase==='household'){const option=E.householdOptions(s).find(x=>!x.disabled);assert.ok(option);assert.equal(E.resolveHouseholdEvent(s,option.id).ok,true)}if(s.phase==='banquet'){let b=E.chooseBanquet(s,banquet);if(!b.ok)b=E.chooseBanquet(s,'banquet_honor_yue');assert.equal(b.ok,true,b.error);E.closeScene(s)}}
function day(s,a,banquet='banquet_balance'){const r=E.chooseDayAction(s,a);assert.equal(r.ok,true,r.error);afterDay(s,banquet)}
function jointDay(s,a,banquet='banquet_balance'){const r=E.chooseJointAction(s,a);assert.equal(r.ok,true,r.error);assert.equal(s.phase,'joint_result');assert.equal(E.continueJointAction(s).ok,true);afterDay(s,banquet)}
function finishBalancedTail(s){
  assert.equal(E.closeScene(s).ok,true);assert.equal(s.phase,'shared_afterglow','共同办事后不能直接结算');
  assert.equal(E.chooseSharedAfterglow(s,'afterglow_yue_cup').ok,true);assert.equal(s.phase,'shared_afterglow');
  assert.equal(E.chooseSharedAfterglow(s,'afterglow_close_door').ok,true);assert.equal(s.phase,'scene');assert.equal(s.pendingScene,'inner_court_afterglow');
  assert.equal(E.closeScene(s).ok,true);assert.equal(s.phase,'shared_dawn');
  assert.equal(E.chooseSharedDawn(s,'dawn_same_table').ok,true);assert.equal(s.phase,'ending');
}
// 伤害性选项:掉她的情,或公开越过她(置失信旗标)。轮换测试用它证明「有得选」。
const HARMFUL_FLAGS=new Set(['broken_yue_word','broken_pan_word','pinger_exposed']);
const harmfulChoice=c=>(c.effects?.rel?.qing??0)<0||(c.effects?.flags??[]).some(f=>HARMFUL_FLAGS.has(f));
const kindChoice=rows=>rows.find(x=>!x.disabled&&!harmfulChoice(x));
function visit(s,h,c,n='talk'){assert.equal(E.startVisit(s,h).ok,true);const rows=E.visitChoices(s,h);const rc=rows.find(x=>x.id===c&&!x.disabled)||rows.find(x=>!x.disabled);assert.ok(rc,`no route d${s.day} ${h}`);assert.equal(E.chooseVisit(s,rc.id).ok,true);const nights=E.nightOptions(s);const nc=nights.find(x=>x.id===n&&!x.disabled)||nights.find(x=>x.id==='prelude'&&!x.disabled)||nights.find(x=>x.id==='talk');assert.ok(nc);const r=E.chooseNight(s,nc.id);assert.equal(r.ok,true,r.error);if(s.phase==='scene')E.closeScene(s);return nc.id}
function strategy(kind){const s=E.newGame(42);if(kind==='exclusive'){E.chooseOpening(s,'respect_yue');const cs=['yue_share_shortfall','yue_show_accounts','yue_keep_word','yue_ask_backing','yue_offer_seat','yue_share_keys'],as=['ledger','ledger','banquet','ledger','ledger','ledger'];for(let d=1;d<=6;d++){morning(s,'explain');day(s,as[d-1],'banquet_honor_yue');visit(s,'wu_yueniang',cs[d-1],d>=3?'explicit':'prelude')}}else if(kind==='balanced'){E.chooseOpening(s,'respect_yue');day(s,'ledger');visit(s,'wu_yueniang','accord_yue_order','talk');morning(s,'explain');day(s,'ledger');visit(s,'pan_jinlian','accord_pan_truth','talk');morning(s,'explain');jointDay(s,'joint_yue_pan');visit(s,'li_pinger','accord_pinger_key','talk');morning(s,'explain');jointDay(s,'joint_yue_pinger');visit(s,'wu_yueniang','yue_share_shortfall','talk');morning(s,'explain');day(s,'banquet');visit(s,'pan_jinlian','pan_take_cup','talk');morning(s,'explain');day(s,'ledger');assert.equal(E.startSharedNight(s).ok,true);assert.equal(E.chooseSharedNight(s,'shared_divide_roles').ok,true);assert.equal(s.pendingScene,'inner_court_accord');finishBalancedTail(s)}else{E.chooseOpening(s,'tease_pan');const hs=['pan_jinlian','pan_jinlian','wu_yueniang','pan_jinlian','li_pinger','wu_yueniang'],cs=['pan_take_cup','pan_take_clue','yue_public_spend','pan_answer_door','pinger_spend_on_pan','yue_last_tea'],as=['listen','listen','office','listen','office','ledger'];for(let d=1;d<=6;d++){morning(s,'explain');day(s,as[d-1],'banquet_honor_yue');visit(s,hs[d-1],cs[d-1])}}return s}
function explicit(h){const s=E.newGame(91),p={wu_yueniang:['respect_yue',['yue_share_shortfall','yue_show_accounts','yue_keep_word']],pan_jinlian:['tease_pan',['pan_take_cup','pan_take_clue']],li_pinger:['respect_yue',['pinger_settle_room','pinger_protect_books','pinger_protect_public']]}[h];E.chooseOpening(s,p[0]);for(let i=0;i<p[1].length;i++){morning(s,'explain');const final=i===p[1].length-1;day(s,h==='pan_jinlian'&&final?'listen':'ledger');visit(s,h,p[1][i],final?'explicit':'prelude')}return s}
function explicitGate(h,action){const s=E.newGame(17),p={wu_yueniang:['respect_yue',['yue_share_shortfall','yue_show_accounts','yue_keep_word']],pan_jinlian:['tease_pan',['pan_take_cup','pan_take_clue']],li_pinger:['respect_yue',['pinger_settle_room','pinger_protect_books','pinger_protect_public']]}[h],choices=p[1];E.chooseOpening(s,p[0]);for(const choice of choices.slice(0,-1)){morning(s,'explain');day(s,'ledger');visit(s,h,choice,'prelude')}morning(s,'explain');day(s,action);E.startVisit(s,h);E.chooseVisit(s,choices.at(-1));return !E.nightOptions(s).find(x=>x.id==='explicit').disabled}
function directorySize(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,entry)=>{const target=path.join(dir,entry.name);return sum+(entry.isDirectory()?directorySize(target):fs.statSync(target).size)},0)}

section('身份与存档');
test('新局版本 11 且三条成人深线不变',()=>{const s=E.newGame(1);eq(s.version,11);eq(Object.keys(s.relations),['wu_yueniang','pan_jinlian','li_pinger']);eq(s.visits,{wu_yueniang:0,pan_jinlian:0,li_pinger:0});eq(s.accords,{order:false,truth:false,safety:false});eq(s.jointActions,[]);eq(s.sharedAfterglowChoices,[]);eq(s.sharedDawnChoice,null)});
test('开场是正堂身份选择',()=>{const s=E.newGame(1);eq(s.phase,'opening');ok(OPENING_CHOICES.some(x=>x.id==='respect_yue'))});
test('旧 schema 一律拒读而不猜测迁移',()=>{for(let version=1;version<11;version+=1){const old=E.newGame(1);old.version=version;eq(E.deserialize(JSON.stringify(old)),null,`v${version}`)}});
test('当前 schema 缺任一核心状态块时拒读',()=>{for(const field of ['resources','relations','household','flags','history','log','accords','jointActions']){const broken=E.newGame(1);delete broken[field];eq(E.deserialize(JSON.stringify(broken)),null,field)}});
test('当前 schema 的阶段与在途对象矛盾时拒读',()=>{const scene=E.newGame(1);scene.phase='scene';eq(E.deserialize(JSON.stringify(scene)),null,'scene 无 pendingScene');const joint=E.newGame(1);joint.phase='joint_result';eq(E.deserialize(JSON.stringify(joint)),null,'joint_result 无 currentJointAction');for(const phase of ['visit','night']){const heroine=E.newGame(1);heroine.phase=phase;eq(E.deserialize(JSON.stringify(heroine)),null,`${phase} 无 currentHeroine`)}const morning=E.newGame(1);morning.phase='morning';morning.morning={id:'quiet',actor:'nobody',tone:'quiet',title:'天亮了',text:'茶',notes:[]};eq(E.deserialize(JSON.stringify(morning)),null,'morning actor 不存在');for(const phase of ['banquet','shared_night']){const wrongDay=E.newGame(1);wrongDay.phase=phase;eq(E.deserialize(JSON.stringify(wrongDay)),null,`${phase} 不得出现在第1日`)}const ending=E.newGame(1);ending.phase='ending';eq(E.deserialize(JSON.stringify(ending)),null,'ending 无结算对象')});
test('结局存档只信过程状态并重建派生展示字段',()=>{const ended=strategy('balanced');ended.ending={id:'balanced'};const loaded=E.deserialize(JSON.stringify(ended));eq(loaded.ending.id,'balanced');eq(loaded.ending.householdResults.length,3);ok(Array.isArray(loaded.ending.unseen))});
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
test('9 个唯一 scene_id',()=>eq(Object.keys(SCENES).sort(),['banquet_conflict','inner_court_accord','inner_court_afterglow','pan_explicit','pan_prelude','pinger_explicit','pinger_prelude','yue_explicit','yue_prelude']));
test('成人亲密参与者全是白名单严格子集',()=>{for(const sc of Object.values(SCENES).filter(x=>['prelude','explicit'].includes(x.tier))){ok(sc.participants.length>0&&sc.participants.length<ADULTS.size);ok(sc.participants.every(x=>ADULTS.has(x)));ok(E.sceneIsAdultSafe(sc))}});
test('三院共约是三名成年人的安全群体协作场景',()=>{const sc=SCENES.inner_court_accord;eq(new Set(sc.participants),ADULTS);eq(sc.tier,'ensemble');ok(E.sceneIsAdultSafe(sc));ok(!['prelude','explicit'].includes(sc.tier))});
test('三院余夜只含三名成年人并属于成人群像',()=>{const sc=SCENES.inner_court_afterglow;eq(new Set(sc.participants),ADULTS);eq(sc.tier,'ensemble-intimate');ok(E.sceneIsAdultSafe(sc))});
test('成人节点零未成年词',()=>{const p=JSON.stringify(Object.values(SCENES).filter(x=>['prelude','explicit','ensemble-intimate'].includes(x.tier)));for(const t of ['官哥儿','孝哥儿','guan_ge','xiao_ge'])ok(!p.includes(t),t)});
test('9 个资产键不复用',()=>eq(new Set(Object.values(SCENES).map(x=>x.asset)).size,9));
test('人物运行资产不再引用旧 PNG 肖像',()=>{for(const key of ['heroine/yue','heroine/pan','heroine/pinger','household/meng','household/xuee','household/jiaoer'])ok(!ASSET_PATHS[key].endsWith('.png'),`${key}: ${ASSET_PATHS[key]}`)});
test('关键视觉文件全部存在且非占位小图',()=>{for(const k of CRITICAL_CG_KEYS){const f=path.join(ROOT,ASSET_PATHS[k]);ok(fs.existsSync(f),f);ok(fs.statSync(f).size>100000,k)}});
test('运行包体低于 25 MB',()=>ok(directorySize(ROOT)<25*1024*1024,`${directorySize(ROOT)} bytes`));

section('路线与关系');
test('关系值全程钳在 0–100',()=>{const s=strategy('exclusive');for(const r of Object.values(s.relations))for(const k of ['qing','yu','du'])ok(r[k]>=0&&r[k]<=100)});
test('锁定的明确场景给人物化原因',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'ledger');E.startVisit(s,'wu_yueniang');E.chooseVisit(s,'yue_share_shortfall');const o=E.nightOptions(s).find(x=>x.id==='explicit');ok(o.disabled&&o.locked.length>8)});
test('“到此为止”始终可选',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');day(s,'ledger');E.startVisit(s,'li_pinger');E.chooseVisit(s,'pinger_settle_room');eq(E.nightOptions(s).find(x=>x.id==='leave').disabled,false)});
test('月娘前奏与明确场景可由守约赢得',()=>{const s=explicit('wu_yueniang');ok(s.unlocked.includes('yue_prelude'));ok(s.unlocked.includes('yue_explicit'));ok(s.flags.kept_yue_word);eq(s.morning.id,'yue_help')});
test('金莲前奏与明确场景可由真话赢得',()=>{const s=explicit('pan_jinlian');ok(s.unlocked.includes('pan_prelude'));ok(s.unlocked.includes('pan_explicit'));ok(s.flags.pan_promised);eq(s.morning.id,'pan_claim')});
test('瓶儿前奏与明确场景可由保护赢得',()=>{const s=explicit('li_pinger');ok(s.unlocked.includes('pinger_prelude'));ok(s.unlocked.includes('pinger_explicit'));ok(s.flags.protected_pinger);eq(s.morning.id,'pinger_help')});
test('亲密前奏改变情、欲与身体三项',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'ledger');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');const b=E.snapshot(s);E.chooseNight(s,'prelude');ok(s.relations.pan_jinlian.qing!==b.relations.pan_jinlian.qing);ok(s.relations.pan_jinlian.yu!==b.relations.pan_jinlian.yu);ok(s.resources.strain!==b.resources.strain)});
test('金莲被连续冷落两夜后会当面关门',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');day(s,'ledger');visit(s,'wu_yueniang','yue_share_shortfall');morning(s);day(s,'ledger');visit(s,'li_pinger','pinger_settle_room');eq(s.relations.pan_jinlian.ignored,2);morning(s);day(s,'listen');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');s.relations.pan_jinlian.qing=70;s.relations.pan_jinlian.yu=80;const option=E.nightOptions(s).find(x=>x.id==='explicit');ok(option.disabled);ok(option.locked.includes('两夜不见人'),option.locked)});
test('瓶儿的私账一旦被公开，钥匙会真实收回',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');day(s,'ledger');visit(s,'li_pinger','pinger_settle_room');morning(s);day(s,'ledger');visit(s,'li_pinger','pinger_protect_books');morning(s);day(s,'ledger');E.startVisit(s,'li_pinger');E.chooseVisit(s,'pinger_blame');ok(s.flags.pinger_exposed);s.flags.protected_pinger=true;s.relations.li_pinger.qing=80;const option=E.nightOptions(s).find(x=>x.id==='explicit');ok(option.disabled);ok(option.locked.includes('钥匙重新系回'),option.locked)});
test('四种白天动作各有路线亲和且无一通吃',()=>{const expected={ledger:['wu_yueniang','li_pinger'],office:['li_pinger'],listen:['pan_jinlian'],banquet:['wu_yueniang']};for(const [action,winners] of Object.entries(expected))eq(HEROINE_IDS.filter(h=>explicitGate(h,action)),winners,action)});

section('路线按「她的第几次」走');
test('拜访结算才计次,拍号钳在最后一拍',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');day(s,'ledger');E.startVisit(s,'wu_yueniang');eq(s.visits.wu_yueniang,0,'进门未结算不计次');E.chooseVisit(s,'yue_share_shortfall');eq(s.visits.wu_yueniang,1);eq(s.visits.pan_jinlian,0,'别人的门不计')});
test('同一晚再进她的门走第二拍,与日历无关',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');day(s,'ledger');E.startVisit(s,'li_pinger');E.chooseVisit(s,'pinger_settle_room');E.chooseNight(s,'talk');morning(s);day(s,'ledger');E.startVisit(s,'li_pinger');const ids=E.visitChoices(s,'li_pinger').map(x=>x.id);ok(ids.includes('pinger_protect_books'),'第二次进门应给第二拍,实际:'+ids)});
// 这正是设计评审 §3 缺的那条证明:不是「结局在状态机里存在」,而是「玩家能走到」。
test('六种轮换顺序:三条院约不挑顺序,共同分工结局都可达',()=>{
  const PERMS=[['wu_yueniang','pan_jinlian','li_pinger'],['wu_yueniang','li_pinger','pan_jinlian'],['pan_jinlian','wu_yueniang','li_pinger'],['pan_jinlian','li_pinger','wu_yueniang'],['li_pinger','wu_yueniang','pan_jinlian'],['li_pinger','pan_jinlian','wu_yueniang']];
  const accordByHeroine={wu_yueniang:'accord_yue_order',pan_jinlian:'accord_pan_truth',li_pinger:'accord_pinger_key'};
  const pairId=(a,b)=>JOINT_ACTIONS.find((choice)=>choice.participants.includes(a)&&choice.participants.includes(b)).id;
  for(const perm of PERMS){
    const s=E.newGame(42);E.chooseOpening(s,'respect_yue');
    for(let d=1;d<=2;d++){
      morning(s,'explain');day(s,'ledger');visit(s,perm[d-1],accordByHeroine[perm[d-1]],'talk');
    }
    morning(s,'explain');jointDay(s,pairId(perm[0],perm[1]));visit(s,perm[2],accordByHeroine[perm[2]],'talk');
    morning(s,'explain');jointDay(s,pairId(perm[0],perm[2]));
    assert.equal(E.startVisit(s,perm[0]).ok,true);
    const fourth=kindChoice(E.visitChoices(s,perm[0]));assert.ok(fourth);assert.equal(E.chooseVisit(s,fourth.id).ok,true);assert.equal(E.chooseNight(s,'talk').ok,true);
    morning(s,'explain');day(s,'banquet');
    assert.equal(E.startVisit(s,perm[1]).ok,true);
    const fifth=kindChoice(E.visitChoices(s,perm[1]));assert.ok(fifth);assert.equal(E.chooseVisit(s,fifth.id).ok,true);assert.equal(E.chooseNight(s,'talk').ok,true);
    morning(s,'explain');day(s,'ledger');
    ok(E.sharedNightStatus(s).ready,`${perm.join('>')} 第六夜共同分工应就绪: ${E.sharedNightStatus(s).reason}`);
    assert.equal(E.startSharedNight(s).ok,true);
    assert.equal(E.chooseSharedNight(s,'shared_divide_roles').ok,true);
    finishBalancedTail(s);
    eq(s.ending.id,'balanced',`${perm.join('>')} 应可达平衡结局,实际 ${s.ending.id}`);
    ok(s.flags.banquet_balanced,`${perm.join('>')} 三杯同斟应可斟`);
    ok(s.flags.harem_coalition,`${perm.join('>')} 应实际完成三人协作`);
  }
});

section('三院共约');
test('院约占一夜但不偷走个人路线拍',()=>{const s=E.newGame(8);E.chooseOpening(s,'respect_yue');day(s,'ledger');E.startVisit(s,'wu_yueniang');ok(E.visitChoices(s,'wu_yueniang').some(x=>x.id==='accord_yue_order'));eq(s.visits.wu_yueniang,0);const result=E.chooseVisit(s,'accord_yue_order');ok(result.ok,result.error);eq(s.visits.wu_yueniang,0);eq(s.accords.order,true);ok(s.history.some(x=>x.type==='accord_term'&&x.term==='order'))});
test('联院差事明示所需院约,每组只能做一次',()=>{const s=E.newGame(8);E.chooseOpening(s,'respect_yue');let option=E.jointActionOptions(s).find(x=>x.id==='joint_yue_pan');ok(option.disabled);ok(option.locked.includes('正堂定账')&&option.locked.includes('去处说真'),option.locked);s.accords.order=true;s.accords.truth=true;option=E.jointActionOptions(s).find(x=>x.id==='joint_yue_pan');ok(!option.disabled);const before=E.snapshot(s);ok(E.chooseJointAction(s,'joint_yue_pan').ok);eq(s.phase,'joint_result');ok(s.resources.power>before.resources.power);ok(s.relations.wu_yueniang.qing>before.relations.wu_yueniang.qing);ok(s.relations.pan_jinlian.qing>before.relations.pan_jinlian.qing);ok(E.continueJointAction(s).ok);s.phase='day';option=E.jointActionOptions(s).find(x=>x.id==='joint_yue_pan');ok(option.disabled);ok(option.locked.includes('不再重复'))});
test('联院差事结果可中途存读且不能同日再做白天动作',()=>{const s=E.newGame(8);E.chooseOpening(s,'respect_yue');s.accords.order=true;s.accords.truth=true;ok(E.chooseJointAction(s,'joint_yue_pan').ok);eq(E.chooseDayAction(s,'ledger').ok,false);const loaded=E.deserialize(E.serialize(s));eq(loaded.phase,'joint_result');eq(loaded.currentJointAction,'joint_yue_pan');eq(loaded.jointActions,['joint_yue_pan']);ok(E.continueJointAction(loaded).ok);eq(loaded.phase,'choose_visit');eq(loaded.currentJointAction,null)});
test('三种联院差事覆盖三组不同搭档且回报不同',()=>{eq(new Set(JOINT_ACTIONS.map(x=>x.participants.slice().sort().join('+'))).size,3);eq(new Set(JOINT_ACTIONS.map(x=>JSON.stringify(x.effects))).size,3);ok(JOINT_ACTIONS.every(x=>x.participants.length===2&&x.requires.length===2))});
test('缺任何院约时共同分工会把具体缺口写在按钮上',()=>{const s=E.newGame(8);s.day=6;s.phase='choose_visit';s.flags.banquet_balanced=true;for(const id of HEROINE_IDS){s.relations[id].qing=50;s.relations[id].du=10}s.accords={order:true,truth:false,safety:true};ok(E.startSharedNight(s).ok);const option=E.sharedNightOptions(s).find(x=>x.id==='shared_divide_roles');ok(option.disabled);ok(option.locked.includes('去处说真'),option.locked)});
test('院约齐备但少于两桩联院差事时会写出 0/2 缺口',()=>{const s=E.newGame(8);s.day=6;s.phase='choose_visit';s.flags.banquet_balanced=true;s.accords={order:true,truth:true,safety:true};for(const id of HEROINE_IDS){s.relations[id].qing=50;s.relations[id].du=10}const status=E.sharedNightStatus(s);ok(!status.ready);ok(status.reason.includes('0/2'),status.reason)});
test('重复或伪造的联院 ID 不能冒充两种不同搭档',()=>{const s=E.newGame(8);s.day=6;s.phase='choose_visit';s.flags.banquet_balanced=true;s.flags.harem_coalition=true;s.accords={order:true,truth:true,safety:true};s.jointActions=['joint_yue_pan','joint_yue_pan','joint_forged'];s.unlocked.push('inner_court_accord');for(const id of HEROINE_IDS){s.relations[id].qing=80;s.relations[id].du=0}eq(E.jointActionCount(s),1);const status=E.sharedNightStatus(s);ok(!status.ready);ok(status.reason.includes('1/2'),status.reason);eq(E.determineEnding(s).id,'unstable')});
test('数值、宴席、旗标与群像齐备仍不能伪造缺过程的后宫结局',()=>{const s=E.newGame(8);for(const id of HEROINE_IDS){s.relations[id].qing=80;s.relations[id].du=0}s.resources.house=80;s.flags.banquet_balanced=true;s.flags.harem_coalition=true;s.unlocked.push('inner_court_accord');eq(E.determineEnding(s).id,'unstable')});
test('花钱买静与再许人人第一都不会解锁群像或后宫结局',()=>{const make=()=>{const s=E.newGame(8);s.day=6;s.phase='choose_visit';s.flags.banquet_balanced=true;s.accords={order:true,truth:true,safety:true};s.jointActions=['joint_yue_pan','joint_yue_pinger'];s.resources.house=70;s.resources.silver=100;for(const id of HEROINE_IDS){s.relations[id].qing=50;s.relations[id].du=10}E.startSharedNight(s);return s};for(const choice of ['shared_buy_quiet','shared_promise_all']){const s=make();const r=E.chooseSharedNight(s,choice);ok(r.ok,r.error);eq(s.phase,'ending');ok(!s.unlocked.includes('inner_court_accord'));ok(!s.flags.harem_coalition);ok(s.ending.id!=='balanced')}});
test('共同分工后必须走完两段余夜与次晨才结算',()=>{const s=strategy('balanced');eq(s.jointActions,['joint_yue_pan','joint_yue_pinger']);eq(s.sharedNightChoice,'shared_divide_roles');eq(s.sharedAfterglowChoices,['afterglow_yue_cup','afterglow_close_door']);eq(s.sharedDawnChoice,'dawn_same_table');ok(s.flags.harem_coalition);ok(s.unlocked.includes('inner_court_accord'));ok(s.unlocked.includes('inner_court_afterglow'));eq(s.ending.id,'balanced');ok(s.history.filter(x=>x.type==='shared_afterglow').length===2);ok(s.history.some(x=>x.type==='shared_dawn'))});
test('共同办事合页后仍未结束，且余夜每一步都可存读',()=>{const s=E.newGame(8);s.day=6;s.phase='choose_visit';s.flags.banquet_balanced=true;s.accords={order:true,truth:true,safety:true};s.jointActions=['joint_yue_pan','joint_yue_pinger'];s.resources.house=70;for(const id of HEROINE_IDS){s.relations[id].qing=50;s.relations[id].du=10}ok(E.startSharedNight(s).ok);ok(E.chooseSharedNight(s,'shared_divide_roles').ok);ok(E.closeScene(s).ok);eq(s.phase,'shared_afterglow');let loaded=E.deserialize(E.serialize(s));ok(loaded);ok(E.chooseSharedAfterglow(loaded,'afterglow_pan_fan').ok);eq(loaded.phase,'shared_afterglow');loaded=E.deserialize(E.serialize(loaded));ok(loaded);ok(E.chooseSharedAfterglow(loaded,'afterglow_keep_lamp').ok);eq(loaded.pendingScene,'inner_court_afterglow')});
test('未同斟三杯不得启动三人同席',()=>{const s=E.newGame(8);s.day=6;s.phase='choose_visit';eq(E.startSharedNight(s).ok,false);s.flags.banquet_balanced=true;ok(E.startSharedNight(s).ok)});

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

section('曝光开始咬人(F3)与具名失败(F4)');
test('曝光≥25 每日结转扣十五两,白日压力先看见门房',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');s.resources.exposure=30;const b=s.resources.silver;day(s,'ledger');E.startVisit(s,'li_pinger');E.chooseVisit(s,'pinger_settle_room');E.chooseNight(s,'talk');const upkeep=E.UPKEEP_BASE+4*E.UPKEEP_PER_REPUTE;eq(s.resources.silver,b+22-upkeep-15);ok(E.dayDef(s).pressure.startsWith('门房今早又打发走一个来打听的。'))});
test('曝光≥40 三人各记一笔「外头的话传到院里了」',()=>{const s=E.newGame(1);E.chooseOpening(s,'respect_yue');s.resources.exposure=45;day(s,'ledger');E.startVisit(s,'li_pinger');E.chooseVisit(s,'pinger_settle_room');const before=Object.fromEntries(HEROINE_IDS.map(id=>[id,s.relations[id].du]));E.chooseNight(s,'talk');for(const id of HEROINE_IDS){ok(s.relations[id].du>=before[id]+4,id);ok(s.relations[id].reasons.some(r=>r.includes('外头的话，传到院里了')),id)}});
test('曝光≥55 走官面与三杯同斟都关门',()=>{const s=E.newGame(1);s.resources.exposure=60;ok(E.dayOptions(s).find(o=>o.id==='office').disabled);ok(!E.dayOptions(s).find(o=>o.id==='ledger').disabled);eq(E.chooseDayAction(s,'office').ok,false);s.phase='banquet';const bal=E.banquetOptions(s).find(o=>o.id==='banquet_balance');ok(bal.disabled);ok(bal.locked.includes('外头的闲话'));eq(E.chooseBanquet(s,'banquet_balance').ok,false)});
test('权谋不再要求高曝光,曝光只分成色',()=>{const mk=x=>{const s=E.newGame(1);s.secretsUsed=['a','b'];s.resources.power=5;s.resources.exposure=x;return E.determineEnding(s)};eq(mk(0).id,'intrigue','零曝光也能成权谋——曝光是代价不是门票');eq(mk(0).intrigueCost,'clean');eq(mk(30).intrigueCost,'watched');eq(mk(60).intrigueCost,'burned');ok(mk(60).text.includes('开价会比今天高'))});
test('不稳定结局按缺口给具名收尾',()=>{const a=E.newGame(1);a.relations.pan_jinlian.qing=70;const noScene=E.determineEnding(a);eq(noScene.id,'unstable');eq(noScene.missedBy,'no_scene');ok(noScene.text.includes('潘金莲的灯亮到三更'));const b=E.newGame(1);b.publicOverrides.li_pinger=1;eq(E.determineEnding(b).missedBy,'broke_word');eq(E.determineEnding(E.newGame(1)).missedBy,'spread_thin')});

section('银钱收紧:用度、催账与分档安抚');
test('银钱收紧:起始 120,翻账 22,同箱 38,第 6 日 34',()=>{const s=E.newGame(1);eq(s.resources.silver,120);E.chooseOpening(s,'tease_pan');const b=s.resources.silver;E.chooseDayAction(s,'ledger');eq(s.resources.silver,b+22);const c=E.newGame(1);E.chooseOpening(c,'tease_pan');c.flags.pinger_same_chest=true;const b2=c.resources.silver;E.chooseDayAction(c,'ledger');eq(c.resources.silver,b2+38);const d=E.newGame(1);E.chooseOpening(d,'tease_pan');d.day=6;const b3=d.resources.silver;E.chooseDayAction(d,'ledger');eq(d.resources.silver,b3+34)});
test('宅中用度按声望计价,次晨报在现场画面上',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');const b=s.resources.silver;E.chooseDayAction(s,'ledger');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');E.chooseNight(s,'talk');eq(s.resources.silver,b+22-15);ok(s.morning.notes[0].includes('支走十五两'));ok(s.morning.notes[0].includes('灶上、门房和针线房'));const c=E.newGame(1);E.chooseOpening(c,'respect_yue');const b2=c.resources.silver;E.chooseDayAction(c,'ledger');E.startVisit(c,'li_pinger');E.chooseVisit(c,'pinger_settle_room');E.chooseNight(c,'talk');eq(c.resources.silver,b2+22-(E.UPKEEP_BASE+4*E.UPKEEP_PER_REPUTE));ok(c.morning.notes[0].includes('十八两'),'声望 4 时报十八两')});
test('用度付不起:扣到 0 为止,宅里的穷在具体场面露出来',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');s.resources.silver=10;E.chooseDayAction(s,'listen');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');E.chooseNight(s,'talk');eq(s.resources.silver,0,'不许出现负银');eq(s.resources.repute,2);eq(s.resources.house,65-4-4);ok(s.morning.notes[0].includes('只抹出十两'));ok(s.morning.notes[0].includes('锅里少一道菜'));ok(s.history.some(x=>x.type==='upkeep_short'))});
test('第 3 日晨间先给催账口风,不是无预告的惩罚',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');morning(s);day(s,'ledger');visit(s,'pan_jinlian','pan_take_cup');morning(s);day(s,'ledger');visit(s,'pan_jinlian','pan_take_cup');eq(s.day,3);eq(s.phase,'morning');ok(s.morning.notes.some(n=>n.includes('收账的今日又来问了一回')),s.morning.notes?.join('|'))});
test('第 4 日结转:银子够,四十两了结',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');for(let d=1;d<=4;d++){morning(s,'explain');day(s,'ledger');visit(s,'pan_jinlian','pan_take_cup')}eq(s.day,5);const entry=s.history.find(x=>x.type==='collector');ok(entry&&entry.paid===true);ok(s.morning.notes.some(n=>n.includes('两讫')),s.morning.notes?.join('|'));eq(s.resources.silver,120+22*4+25-20-15*4-40,'翻账四日、雪娥 +25、娇儿 −20、用度四日、催账 −40')});
test('第 4 日结转:拿不出四十两,他闹上门',()=>{const s=E.newGame(1);E.chooseOpening(s,'tease_pan');s.day=4;s.phase='day';s.resources.silver=30;E.chooseDayAction(s,'listen');E.resolveHouseholdEvent(s,'jiaoer_buy_name');E.startVisit(s,'pan_jinlian');E.chooseVisit(s,'pan_take_cup');E.chooseNight(s,'talk');const entry=s.history.find(x=>x.type==='collector');ok(entry&&entry.paid===false);eq(s.resources.silver,0,'闹上门不扣银,但用度短欠已扣到 0');eq(s.resources.house,65-4-4-8,'tease −4、用度塌 −4、闹上门 −8');eq(s.resources.repute,2);eq(s.resources.exposure,7+10);eq(s.relations.wu_yueniang.du,20);eq(s.relations.li_pinger.du,10);ok(s.morning.notes.some(n=>n.includes('只抹出十两')));ok(s.morning.notes.some(n=>n.includes('唱了半条街')))});
test('安抚按妒分档计价,按钮报当前实价',()=>{const s=E.newGame(1);s.phase='morning';s.morning={id:'jealousy',actor:'pan_jinlian',tone:'jealous',title:'t',text:'x',notes:[]};s.relations.pan_jinlian.du=30;eq(E.appeaseCost(s,'pan_jinlian'),20);ok(E.morningOptions(s).find(o=>o.id==='appease').hint.includes('二十两'));s.relations.pan_jinlian.du=55;eq(E.appeaseCost(s,'pan_jinlian'),35);ok(E.morningOptions(s).find(o=>o.id==='appease').hint.includes('三十五两'),'按钮要报当前实价,不写死二十两');s.resources.silver=30;ok(E.morningOptions(s).find(o=>o.id==='appease').disabled,'实价三十五两时三十两应点不动');s.resources.silver=40;const r=E.resolveMorning(s,'appease');ok(r.ok,r.error);eq(s.resources.silver,5)});
test('雪娥两臂各有其局面:同一串白日动作下，这一选决定第 4 日催账是两讫还是闹上门',()=>{const arm=a=>{const s=E.newGame(7);E.chooseOpening(s,'respect_yue');for(let d=1;d<=4;d++){morning(s,'explain');assert.equal(E.chooseDayAction(s,['ledger','office','listen','banquet'][d-1]).ok,true);if(s.phase==='household'){const o=E.householdOptions(s);E.resolveHouseholdEvent(s,(o.find(x=>x.id===a&&!x.disabled)||o.find(x=>!x.disabled)).id)}if(s.phase==='banquet'){let b=E.chooseBanquet(s,'banquet_balance');if(!b.ok)E.chooseBanquet(s,'banquet_honor_yue');E.closeScene(s)}visit(s,'wu_yueniang','x')}return s.history.find(x=>x.type==='collector')?.paid};eq(arm('xuee_check_storehouse'),false,'后仓只添 25 两,这条线接不住第 4 日那笔账');eq(arm('xuee_pay_shortfall'),true,'赔上的 40 两正好接住');});
test('权谋银钱支路按收紧后的实测门槛判定',()=>{eq(E.INTRIGUE_SILVER,240,'门槛须与 GAME_DESIGN 第 10 节实测值一致(bench_silver.mjs:无资源侧封顶 181,全采 350)');const mk=x=>{const s=E.newGame(1);s.secretsUsed=['a','b'];s.resources.power=2;s.resources.silver=x;return E.determineEnding(s)};eq(mk(E.INTRIGUE_SILVER).id,'intrigue');ok(mk(E.INTRIGUE_SILVER-1).id!=='intrigue','差一两也不该算')});

section('三种收束');
const ex=strategy('exclusive'),bal=strategy('balanced'),intr=strategy('intrigue');
test('专一深线 6 日可达',()=>eq(ex.ending.id,'exclusive'));
test('平衡后宫 6 日可达',()=>eq(bal.ending.id,'balanced'));
test('权谋风月 6 日可达',()=>eq(intr.ending.id,'intrigue'));
test('脚本 A 张力:第 3 夜解锁月娘明确场景,另两人妒意上桌',()=>{ok(ex.history.some(x=>x.type==='night'&&x.day===3&&x.scene==='yue_explicit'),'第 3 夜应解锁 yue_explicit');for(const id of HEROINE_IDS.filter(h=>h!=='wu_yueniang'))ok(ex.relations[id].du>=30,`${id} du=${ex.relations[id].du}`);ok(ex.history.some(x=>x.type==='morning'&&x.event==='jealousy'),'至少一人触发晨间对质')});
test('脚本 B 张力:两组联院差事后才落平衡,并实际走完成人群像余夜',()=>{eq(bal.ending.id,'balanced');eq(bal.jointActions.length,2);ok(bal.unlocked.includes('inner_court_accord'));ok(bal.unlocked.includes('inner_court_afterglow'));ok(!['yue_explicit','pan_explicit','pinger_explicit'].some(id=>bal.unlocked.includes(id)),'不应伪造任何个人明确场景')});
test('三种策略状态不同',()=>eq(new Set([E.serialize(ex),E.serialize(bal),E.serialize(intr)]).size,3));
test('专一路线回读理解型结果',()=>{eq(ex.ending.heroineName,'吴月娘');eq(ex.ending.routeResult,'共掌一宅');ok(ex.unlocked.includes('yue_explicit'))});
test('平衡路线三人情近且无人翻脸',()=>{for(const r of Object.values(bal.relations)){ok(r.qing>=30);ok(r.du<70)}});
test('权谋路线消费两条人情秘密并留下暴露成色',()=>{ok(intr.secretsUsed.length>=2);ok(intr.resources.power>=4);ok(intr.resources.exposure>=25);ok(['watched','burned'].includes(intr.ending.intrigueCost),'高曝光应留下成色注脚')});
test('无白天动作同时抬升全部外账',()=>{for(const a of Object.keys(DAY_ACTIONS)){const s=E.newGame(1);E.chooseOpening(s,'respect_yue');const b=E.snapshot(s.resources);ok(E.chooseDayAction(s,a).ok);ok(['silver','power','repute','house'].filter(k=>s.resources[k]>b[k]).length<4,a)}});

section('声口与数据完整性');
test('所有主按钮不超过 10 个汉字',()=>{const ls=[...OPENING_CHOICES.map(x=>x.label),...Object.values(DAY_ACTIONS).map(x=>x.label),...Object.values(ROUTE_CHOICES).flat(2).map(x=>x.label),...Object.values(ACCORD_CHOICES).map(x=>x.label),...JOINT_ACTIONS.map(x=>x.label),...SHARED_NIGHT_CHOICES.map(x=>x.label),...SHARED_AFTERGLOW_BEATS.flatMap(x=>x.choices.map(c=>c.label)),...SHARED_DAWN_CHOICES.map(x=>x.label),...BANQUET_CHOICES.map(x=>x.label)];for(const l of ls)ok([...l].length<=10,l)});
test('运行时文本不命中禁用 AI 腔',()=>{const p=JSON.stringify({TEXT,ROUTE_CHOICES,ACCORD_CHOICES,JOINT_ACTIONS,SHARED_NIGHT_CHOICES,SHARED_AFTERGLOW_BEATS,SHARED_DAWN_CHOICES,SCENES,OPENING_CHOICES,BANQUET_CHOICES,HOUSEHOLD_EVENTS});for(const x of [/并非.{0,20}而是/,/不是.{0,20}而是/,/真正的.{0,20}从来不是/,/这一刻你终于明白/,/这意味着/,/眼中闪过/,/嘴角勾起/,/仿佛/,/宛若/,/带着一丝/])ok(!x.test(p),x);ok((p.match(/兑现/g)||[]).length<=2,'“兑现”重复过多')});
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
