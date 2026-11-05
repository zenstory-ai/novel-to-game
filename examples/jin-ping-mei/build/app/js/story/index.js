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
  yue: { name: '月娘', full: '吴月娘', color: '#3d5a9e', house: '正院', title: '正头娘子', line: '正堂上讲规矩，回了屋，灯我替你留着。' },
  pan: { name: '金莲', full: '潘金莲', color: '#c43b4b', house: '花园角门', title: '第五房', line: '你今夜来，是想我了，还是怕我闹？' },
  pinger: { name: '瓶儿', full: '李瓶儿', color: '#b58a3c', house: '东院', title: '第六房', line: '钥匙我自己收着。我这个人，你要不要？' },
  meng: { name: '玉楼', full: '孟玉楼', color: '#8a6aa8', house: '西厢', title: '第三房', line: '官人来坐，茶是现成的。有什么话，咱们当面说清楚。' },
  xuee: { name: '雪娥', full: '孙雪娥', color: '#3f7f73', house: '灶上', title: '第四房', line: '五更生火，三更封灶，一屋子人的饭总得有人做。' },
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

// 动态影像：键为 CG 或背景 id。首尾帧即那张 CG／背景，循环播放、无声；
// 关闭「动态影像」、系统减弱动态或加载失败时回落到原图加慢推镜。逐段台账见 build/art/film-shots.json
const FILM_IDS = [
  'title', 'dinner', 'intro_yue', 'intro_pan', 'intro_pinger', 'intro_meng', 'intro_xuee', 'kitchen_quarrel', 'garden_chest', 'goods',
  'gate', 'rain_hall', 'pan_yue', 'qingming', 'qingming_night', 'moon_five', 'yue_mid', 'pan_mid', 'pinger_mid', 'meng_mid',
  'xuee_mid', 'yue_moon', 'yue_end', 'pan_end', 'pinger_end', 'meng_end', 'xuee_end', 'fate',
  'hall', 'garden', 'chamber', 'court_night', 'court_rain', 'temple', 'street', 'kitchen', 'compound', 'street_dawn',
];
export const FILM = Object.fromEntries(FILM_IDS.map((id) => [id, { src: `assets/film/${id}.mp4` }]));

// 剧情过场：选择之后演出后果的短片（多镜头、有声、只播一次），是本作「影游」的主体。
// 剧本里 @cut id 之后的台词就是它的字幕，cues[i] 是第 i 句出现的秒数（超过片长的句子在播完后点击推进）；播完停在末帧（assets/cut/<id>.jpg），
// 关闭动态影像、读档或文件缺失时直接显示末帧定格，字幕改为点击推进。逐段分镜与提示词见 build/art/cutscenes.json
const CUTS = {
  b2_aside: { name: '东院 · 闭门不出', seconds: 9.1, cues: [0, 2.0, 5.0], group: 'pinger' },
  b2_hurt: { name: '东院 · 一排银锭', seconds: 10.0, cues: [0, 1.4, 3.9, 5.1, 8.2], group: 'pinger' },
  b2_trust: { name: '正堂 · 合上的箱盖', seconds: 12.1, cues: [0, 2.0, 3.6, 6.4, 9.4], group: 'pinger' },
  d_pan: { name: '正堂 · 碗底一声', seconds: 9.1, cues: [0, 2.5, 4.9] },
  d_silent: { name: '正堂 · 添来的一筷菜', seconds: 12.1, cues: [0, 2.2, 3.4, 4.6, 9.5] },
  d_xuee: { name: '正堂 · 端走的汤', seconds: 10.0, cues: [0, 1.2, 3.1, 4.3] },
  d_yue: { name: '正堂 · 两人对望', seconds: 12.1, cues: [0, 3.0, 4.2, 5.4, 11.2] },
  g_guard: { name: '花园 · 收回的钥匙', seconds: 11.1, cues: [0, 2.5, 4.9, 7.3, 8.5] },
  g_key: { name: '花园 · 攥紧的钥匙', seconds: 12.1, cues: [0, 1.2, 2.4, 3.6, 4.8, 9.8] },
  g_pan: { name: '花园 · 拢回的箱子', seconds: 10.1, cues: [0, 3.0, 6.9, 8.1] },
  g_silent: { name: '花园 · 锁上的箱子', seconds: 12.1, cues: [0, 1.2, 3.5, 4.7, 5.9, 10.6] },
  k_fair: { name: '灶上 · 金莲认错', seconds: 12.1, cues: [0, 4.5, 5.7, 6.9, 10.0, 11.2] },
  k_pan: { name: '灶上 · 磕缺的碗', seconds: 11.1, cues: [0, 3.0, 6.0, 8.5] },
  k_silent: { name: '灶上 · 门口的月娘', seconds: 12.1, cues: [0, 1.2, 2.4, 8.0] },
  k_xuee: { name: '灶上 · 她盛的粥', seconds: 10.1, cues: [0, 3.6, 5.9] },
  lonely_end: { name: '书房 · 一两不少', seconds: 12.1, cues: [0.5, 2.6, 6.0, 10.3] },
  m2_half: { name: '西厢 · 上锁的匣', seconds: 10.1, cues: [0, 1.6, 6.4], group: 'meng' },
  m2_hurt: { name: '西厢 · 无声月琴', seconds: 11.1, cues: [0, 2.2, 5.6, 9.0], group: 'meng' },
  m2_trust: { name: '正堂 · 落笔名帖', seconds: 12.1, cues: [0, 2.8, 4.0, 5.4, 8.8, 10.2], group: 'meng' },
  meng_bad_end: { name: '正堂 · 待客的茶', seconds: 12.1, cues: [0, 2.6, 4.6, 5.8, 7.0], group: 'meng' },
  meng_good_end: { name: '正堂 · 添的小字', seconds: 12.1, cues: [0, 5.4, 6.8, 10.4], group: 'meng' },
  meng_normal_end: { name: '廊下 · 无名的曲', seconds: 11.1, cues: [0, 2.0, 6.6, 9.4], group: 'meng' },
  p2_cold: { name: '角门 · 门闩落下', seconds: 10.0, cues: [0, 1.2, 3.0, 6.2, 8.4], group: 'pan' },
  p2_scheme: { name: '卧房 · 箱里的小衣', seconds: 12.1, cues: [0, 1.9, 4.7, 10.9, 12.1, 13.3], group: 'pan' },
  p2_trust: { name: '角门 · 抵在胸口', seconds: 12.1, cues: [0, 1.2, 2.4, 3.6, 7.2, 8.4, 11.0], group: 'pan' },
  p_meng: { name: '荷亭 · 一声多谢', seconds: 10.0, cues: [0, 4.0] },
  p_pan: { name: '荷亭 · 扬起的下巴', seconds: 9.1, cues: [0, 2.0] },
  p_pinger: { name: '荷亭 · 帕子按住泪', seconds: 9.1, cues: [0, 1.6] },
  p_xuee: { name: '荷亭 · 擦净的手', seconds: 10.0, cues: [0, 1.2, 2.4] },
  p_yue: { name: '荷亭 · 推到第三回', seconds: 9.1, cues: [0, 2.8] },
  pan_bad_end: { name: '角门 · 扇子落地', seconds: 12.1, cues: [0, 1.4, 4.0, 6.4, 8.2, 10.8], group: 'pan' },
  pan_good_end: { name: '花园 · 袖里的词', seconds: 10.0, cues: [0, 3.8, 8.0, 9.2], group: 'pan' },
  pan_normal_end: { name: '角门 · 没弹完的曲', seconds: 9.1, cues: [0, 3.8], group: 'pan' },
  pinger_bad_end: { name: '东院 · 门里的灯', seconds: 12.1, cues: [0, 1.2, 5.2, 6.8, 9.6], group: 'pinger' },
  pinger_good_end: { name: '东院 · 钥匙系回腰间', seconds: 12.1, cues: [0, 1.2, 2.4, 10.0], group: 'pinger' },
  pinger_normal_end: { name: '东院 · 重绣的桃花', seconds: 12.1, cues: [0, 1.2, 3.0, 7.0], group: 'pinger' },
  q_defend: { name: '荷亭 · 红透的耳根', seconds: 9.1, cues: [0.3, 3.3, 5.8] },
  q_laugh: { name: '荷亭 · 斟满的酒', seconds: 8.1, cues: [0.3, 3.2] },
  q_silent: { name: '荷亭 · 攥住的桃花', seconds: 11.1, cues: [0, 4.6, 8.2] },
  r_lamp_miss: { name: '回廊 · 摸黑的路', seconds: 8.1, cues: [1.0, 3.6] },
  r_lamp_ok: { name: '回廊 · 护住的灯', seconds: 7.1, cues: [2.0] },
  s_force: { name: '门前 · 差人的铁链', seconds: 8.1, cues: [0] },
  s_jiaoer: { name: '账房 · 新添一行', seconds: 8.1, cues: [0, 3.5] },
  s_meng: { name: '正堂 · 三姐姐的情', seconds: 12.1, cues: [0, 2.5, 8.0, 9.2, 10.8] },
  s_read: { name: '正堂 · 契尾小字', seconds: 12.1, cues: [0, 5.0, 7.0, 8.2, 9.4] },
  s_yue: { name: '正堂 · 当堂对契', seconds: 12.1, cues: [0, 1.3, 2.5, 3.7] },
  x2_hurt: { name: '灶前 · 不哭的脸', seconds: 10.1, cues: [0, 1.2, 4.5], group: 'xuee' },
  x2_mud: { name: '灶上 · 没放盐', seconds: 10.1, cues: [0, 3.4, 6.4], group: 'xuee' },
  x2_trust: { name: '仓房 · 攥紧账簿', seconds: 12.1, cues: [0, 1.2, 4.0, 7.8], group: 'xuee' },
  xuee_bad_end: { name: '灶房 · 冷灶膛', seconds: 12.1, cues: [0, 1.2, 2.4, 3.6, 10.0], group: 'xuee' },
  xuee_good_end: { name: '灶上 · 两碗粥', seconds: 10.1, cues: [0, 1.2, 2.4, 3.6], group: 'xuee' },
  xuee_normal_end: { name: '灶边 · 空板凳', seconds: 8.1, cues: [0, 5.5], group: 'xuee' },
  y2_back: { name: '正堂 · 按住的单子', seconds: 11.1, cues: [0, 1.2, 2.4], group: 'yue' },
  y2_dodge: { name: '正堂 · 空着的上首', seconds: 9.1, cues: [0.3, 5.5], group: 'yue' },
  y2_over: { name: '正堂 · 留下的钥匙', seconds: 12.1, cues: [0, 1.2, 2.7, 3.9, 9.6], group: 'yue' },
  yue_bad_end: { name: '正院 · 落下的门闩', seconds: 12.1, cues: [0.3, 3.6, 4.8, 6.0, 11.0], group: 'yue' },
  yue_good_end: { name: '正堂 · 分出的钥匙', seconds: 11.1, cues: [0, 1.2], group: 'yue' },
  yue_normal_end: { name: '正堂 · 留着的灯', seconds: 11.1, cues: [0, 1.2, 5.0, 6.2, 8.0], group: 'yue' },
};
export const CUT = Object.fromEntries(Object.entries(CUTS).map(([id, c]) => [id, { ...c, src: `assets/cut/${id}.mp4` }]));

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
  yue: ['第七十九回，西门庆三十三岁而亡，同日孝哥儿出生。', '她守寡持家，各房的人陆续散去，账也一本本合上了。', '第一百回，孝哥儿随普静出家。'],
  pan: ['第七十九回以后，西门家败落，各房四散。', '第八十七回，她死在武松刀下。', '她那把琵琶，后来不知落到了谁手里。'],
  pinger: ['第三十回，她生下官哥儿，满宅为那孩子点灯挂彩。', '第五十九回，官哥儿夭折；第六十二回，她病故。', '那把小铜钥匙，到最后都在她自己手里。'],
  meng: ['第七十九回以后，西门家各房散去。', '第九十一回，她改嫁李衙内，这门亲事仍是她自己拿的主意。', '西门家几房里，她算是有个好收场的。'],
  xuee: ['第七十九回以后，宅里人手散尽，灶上也冷清了。', '第九十回，她被拐出宅门；第九十四回，又被卖入火坑。', '宅里的饭，后来换了别人烧。'],
  lonely: ['第七十九回，西门庆三十三岁而亡。', '他死后，各房的人或嫁或卖，各自散了。', '那年清明席散的夜里，他一个人回了书房。'],
};
