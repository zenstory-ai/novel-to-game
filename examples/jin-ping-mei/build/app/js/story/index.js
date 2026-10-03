// 人物、场景、CG、曲目、结局与原著命数登记。剧情正文在同目录的 common.js 与各人路线文件。
import common from './common.js';
import common2 from './common2.js';
import common3 from './common3.js';
import yue from './yue.js';
import pan from './pan.js';
import pinger from './pinger.js';
import meng from './meng.js';
import xuee from './xuee.js';
import dates from './dates.js';

export const SCRIPT_SOURCES = [common, common2, common3, yue, pan, pinger, meng, xuee, dates];

// 立绘差分：每人 neutral/smile/angry/sad/blush/surprised；换到 surprised 时立绘再轻轻一跳
export const CAST = {
  yue: { name: '月娘', full: '吴月娘', color: '#3d5a9e', house: '正院', title: '正头娘子', line: '话要在正堂说清，心要在灯下说软。' },
  pan: { name: '金莲', full: '潘金莲', color: '#c43b4b', house: '花园角门', title: '第五房', line: '你今夜来，是想我了，还是怕我闹？' },
  pinger: { name: '瓶儿', full: '李瓶儿', color: '#b58a3c', house: '东院', title: '第六房', line: '钥匙我自己收着。人，你要不要？' },
  meng: { name: '玉楼', full: '孟玉楼', color: '#8a6aa8', house: '西厢', title: '第三房', line: '我是自己选的这扇门，也记得门怎么开。' },
  xuee: { name: '雪娥', full: '孙雪娥', color: '#3f7f73', house: '灶上', title: '第四房', line: '一屋子人吃的饭，总得有人起早。' },
};
export const SPEAKERS = ['西门庆', '春梅', '玳安', '应伯爵', '李娇儿', '花家老大', '众人', '媒婆'];
export const EXPRESSIONS = ['neutral', 'smile', 'angry', 'sad', 'blush', 'surprised'];

export const BG = {
  hall: 'assets/bg/hall.webp',
  garden: 'assets/bg/garden.webp',
  chamber: 'assets/bg/chamber.webp',
  court_night: 'assets/bg/court_night.webp',
  court_rain: 'assets/bg/court_rain.webp',
  temple: 'assets/bg/temple.webp',
  street: 'assets/bg/street.webp',
  kitchen: 'assets/bg/kitchen.webp',
  compound: 'assets/bg/compound_new_guofeng.webp',
  street_dawn: 'assets/bg/street_dawn.webp', // 同一条街，天亮前：冷青天色、晨雾、灯笼未熄
  black: '',
};

// adult: 只在年龄门之后、且「设置 · 成人画面」开启时加载；关闭时以帘幕代替
// focus: 'right' — 人物在右、左侧留白的构图，显示时裁到右侧（stage.js FOCUS_ZOOM）
// group: 鉴赏里归到谁名下（默认按 id 前缀，无前缀归共通）
export const CG = {
  title: { src: 'assets/cg/group/title_new_guofeng.webp', name: '春庭五人' },
  dinner: { src: 'assets/cg/group/public_day5.webp', name: '五扇门的晚饭' },
  intro_yue: { src: 'assets/heroine/yue/night.webp', name: '初见 · 吴月娘' },
  intro_pan: { src: 'assets/heroine/pan/night.webp', name: '初见 · 潘金莲' },
  intro_pinger: { src: 'assets/heroine/pinger/night.webp', name: '初见 · 李瓶儿' },
  intro_meng: { src: 'assets/heroine/meng/night.webp', name: '初见 · 孟玉楼' },
  intro_xuee: { src: 'assets/heroine/xuee/night.webp', name: '初见 · 孙雪娥' },
  kitchen_quarrel: { src: 'assets/cg/joint/pan_xuee.webp', name: '灶上口角' },
  garden_chest: { src: 'assets/cg/joint/pan_pinger.webp', name: '花园里的箱子' },
  goods: { src: 'assets/cg/joint/yue_meng.webp', name: '沉香与胡椒' },
  gate: { src: 'assets/scene/gate_collector.webp', name: '门前来人' },
  rain_hall: { src: 'assets/cg/joint/yue_pinger.webp', name: '雨夜正堂' },
  pan_yue: { src: 'assets/cg/joint/yue_pan.webp', name: '月娘与金莲', group: 'yue' },
  qingming: { src: 'assets/cg/group/public_day10.webp', name: '清明荷亭' },
  qingming_night: { src: 'assets/cg/group/inner_court_afterglow_five.webp', name: '席散之后' },
  moon_five: { src: 'assets/cg/group/inner_court_alliance.webp', name: '五人同灯' },
  yue_mid: { src: 'assets/cg/milestone/yue.webp', name: '月娘 · 钥匙串', focus: 'right' },
  pan_mid: { src: 'assets/cg/milestone/pan.webp', name: '金莲 · 来信' },
  pinger_mid: { src: 'assets/cg/milestone/pinger.webp', name: '瓶儿 · 空匣', focus: 'right' },
  meng_mid: { src: 'assets/cg/milestone/meng.webp', name: '玉楼 · 名帖' },
  xuee_mid: { src: 'assets/cg/milestone/xuee.webp', name: '雪娥 · 灶前', focus: 'right' },
  yue_moon: { src: 'assets/cg/yue/moon.webp', name: '月娘 · 拜月' },
  yue_end: { src: 'assets/cg/finale/yue.webp', name: '月娘 · 交钥' },
  pan_end: { src: 'assets/cg/finale/pan.webp', name: '金莲 · 春风' },
  pinger_end: { src: 'assets/cg/finale/pinger.webp', name: '瓶儿 · 开匣', focus: 'right' },
  meng_end: { src: 'assets/cg/finale/meng.webp', name: '玉楼 · 自开门', focus: 'right' },
  xuee_end: { src: 'assets/cg/finale/xuee.webp', name: '雪娥 · 两碗粥' },
  yue_h1: { src: 'assets/cg/yue/prelude.webp', name: '月娘 · 卸簪', adult: true },
  yue_h2: { src: 'assets/cg/yue/explicit.webp', name: '月娘 · 同衾', adult: true },
  pan_h1: { src: 'assets/cg/pan/prelude.webp', name: '金莲 · 解扇', adult: true },
  pan_h2: { src: 'assets/cg/pan/explicit.webp', name: '金莲 · 同衾', adult: true },
  pinger_h1: { src: 'assets/cg/pinger/prelude.webp', name: '瓶儿 · 关窗', adult: true },
  pinger_h2: { src: 'assets/cg/pinger/explicit.webp', name: '瓶儿 · 同衾', adult: true },
  meng_h1: { src: 'assets/cg/meng/prelude.webp', name: '玉楼 · 开门', adult: true },
  meng_h2: { src: 'assets/cg/meng/explicit.webp', name: '玉楼 · 同衾', adult: true },
  xuee_h1: { src: 'assets/cg/xuee/prelude.webp', name: '雪娥 · 收火', adult: true },
  xuee_h2: { src: 'assets/cg/xuee/explicit.webp', name: '雪娥 · 同衾', adult: true },
  fate: { src: 'assets/cg/finale/fate_coda.webp', name: '命数' },
};

export const MUSIC = {
  title: '春庭',
  daily: '晨省',
  garden: '花间',
  tender: '灯下',
  tension: '风波',
  night: '更漏',
  sad: '落花',
  fate: '命数',
};

export const ENDINGS = {
  yue_good: { who: 'yue', kind: 'good', title: '月下焚香' },
  yue_normal: { who: 'yue', kind: 'normal', title: '正堂一盏灯' },
  yue_bad: { who: 'yue', kind: 'bad', title: '官人自便' },
  pan_good: { who: 'pan', kind: 'good', title: '琵琶不冷' },
  pan_normal: { who: 'pan', kind: 'normal', title: '半掩的角门' },
  pan_bad: { who: 'pan', kind: 'bad', title: '扇子落地' },
  pinger_good: { who: 'pinger', kind: 'good', title: '钥匙在她手里' },
  pinger_normal: { who: 'pinger', kind: 'normal', title: '窗下的茶' },
  pinger_bad: { who: 'pinger', kind: 'bad', title: '箱笼' },
  meng_good: { who: 'meng', kind: 'good', title: '她自己开的门' },
  meng_normal: { who: 'meng', kind: 'normal', title: '一曲月琴' },
  meng_bad: { who: 'meng', kind: 'bad', title: '名帖退回' },
  xuee_good: { who: 'xuee', kind: 'good', title: '天亮前的两碗粥' },
  xuee_normal: { who: 'xuee', kind: 'normal', title: '灶火未熄' },
  xuee_bad: { who: 'xuee', kind: 'bad', title: '冷灶' },
  lonely: { who: null, kind: 'bad', title: '无人留灯' },
};
export const ENDING_KIND = { good: '良缘', normal: '寻常', bad: '错过' };

// 原著命数：结局只决定这一春她与你之间说成了什么，不改写原著去处（SOURCE_BIBLE 人物名册）
export const FATES = {
  yue: ['第七十九回，西门庆三十三岁而亡，同日孝哥儿出生。', '她守着孝，把一座大宅一点点收小，账一页页合上。', '第一百回，孝哥儿随普静出家。她把那一夜焚的香，一直焚到了老。'],
  pan: ['第七十九回以后，家散了，人也散了。', '第八十七回，她死在武松刀下。', '那把琵琶后来不知落在谁手里。只是这一春，曾有人在角门外，等她把一曲弹完。'],
  pinger: ['第三十回，她生下官哥儿，满宅的灯都为那孩子亮。', '第五十九回，官哥儿夭折；第六十二回，她病故。', '那把钥匙始终在她自己手里。这一春她曾说过：人，你要不要。'],
  meng: ['第七十九回以后，宅门散去。', '第九十一回，她改嫁李衙内，自己选的门，自己走出去。', '临行那日，她没有回头。不是薄情——她一向记得门怎么开。'],
  xuee: ['第七十九回以后，灶火渐冷，人手散尽。', '第九十回，她被拐出宅门；第九十四回，又被卖入火坑。', '原书没有给她一个好结局。这一春，至少有一个清晨，有人看见了她手上的灰。'],
  lonely: ['第七十九回，西门庆三十三岁而亡。', '五扇门后来各自关上，各自走散。', '那年春天，原本有人等过你。'],
};
