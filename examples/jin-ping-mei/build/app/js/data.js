// 数据表驱动:新增节令/传闻/谋算/对手只加数据,不改引擎。
// 内容边界(17+):情欲只作权力货币与后果来写——留宿、失宠、灯、更漏、眼风;
// 笔法取明清世情小说的留白,永远停在帐幔落下那一刻。器官与性行为过程绝对不写。

// ---------- 结局判定阈值 ----------
export const ENDING = {
  siHigh: 800,   // 私房高档
  siMid: 300,    // 私房中档
  windHigh: 60,  // 风声高位
};

// ---------- 对手(五位有目标的行动者;李娇儿只上榜、不主动出手) ----------
export const RIVALS = {
  yue:     { name: '吴月娘', join: 1, ming: 60, si: 300, style: 'steady' },
  lijiaoer:{ name: '李娇儿', join: 1, ming: 35, si: 260, style: 'hoarder' },
  xuee:    { name: '孙雪娥', join: 1, ming: 18, si: 40,  style: 'chaos' },
  pan:     { name: '潘金莲', join: 4, ming: 26, si: 20,  style: 'aggressive' },
  pinger:  { name: '李瓶儿', join: 6, ming: 38, si: 900, style: 'defensive' },
  chunmei: { name: '庞春梅', join: 1, ming: 12, si: 5,   style: 'climber', offBoard: true },
};

// ---------- 仆役情报网 ----------
export const SERVANTS = {
  daian:    { price: 30, closeTo: null },      // 玳安:谁都能聊,但嘴不稳
  xiaoyu:   { price: 20, closeTo: 'yue' },
  fengmama: { price: 20, closeTo: 'pinger' },
  xuemei:   { price: 0,  closeTo: 'player' },  // 薛媒婆:你的旧识,不收钱
};

// 可信度 → 为真的概率
export const CRED_TRUTH = { '高': 0.9, '中': 0.7, '低': 0.5 };

// 传闻模板:{name}=对象房。kind 用于证实后可知的事实类型。
// 「争」的一档写情欲作为权力货币:灯、更漏、座次、赏赐——不写帐子里的事。
export const RUMOR_TEXTS = {
  cang: [
    '听说{name}院里这几个月只进不出，箱笼都换了新锁。',
    '{name}房里前两日叫人抬了两口箱子出去，不知去了哪儿。',
    '{name}屋里的丫头去当铺回来，手里空着，脸上却松快。',
    '{name}把陪嫁的那对镯子摘了，说是压箱底，压的什么箱底谁知道。',
    '{name}院里近日总在夜里点灯理账，理到很晚。',
    '{name}托了外头的人写契，写的什么，写契的先生不肯说。',
  ],
  zheng: [
    '家主前儿把新到的缎子先紧着{name}院里挑了。',
    '节下的席面，{name}的座次又往前挪了一位。',
    '{name}院里的灯，这几夜亮得都比别处久。',
    '家主昨儿回来，先拐进了{name}院里，到四更才听见关门。',
    '{name}房里新换了一副头面，是外头铺子里最好的水头。',
  ],
  scheme: [
    '有人瞧见{name}院里的人，半夜往{other}院里去。',
    '{name}房里的妈妈近日总往{other}院门口凑，没安好心。',
    '{name}问过{other}屋里的丫头两回话，问的都是不该问的。',
    '{name}使人打听{other}的娘家在哪条街上，打听得很细。',
    '{name}和{other}院里那个惯会传话的，近来走得近。',
  ],
  hostile: [
    '{name}提起你就咬牙，当心些。',
    '{name}院里放出话来，说你的闲话早晚要递到大娘子跟前。',
    '{name}院里的灯这几夜黑得早，黑得早的人，心里都有事。',
  ],
  calm: [
    '{name}院里安安静静的，没什么动静。',
    '{name}这几日只在屋里做针线，哪儿也没去。',
    '{name}院门早早就闭了，连丫头也不大出来走动。',
    '打{name}窗下过了两回，只听见翻书页的声音。',
    '{name}近日不大说话，问什么都只应一声。',
    '{name}院里那株石榴谢了，也没见人去扫。',
    '{name}这几日照常起居，该请安请安，该回房回房。',
    '厨下说{name}院里的饭食减了一样，别的一切照旧。',
  ],
};

// ---------- 谋算种类 ----------
export const SCHEMES = {
  sanbu:   { name: '散布流言', desc: '暗中散播对某房不利的说法', mingHit: 14, selfTiyan: 4 },
  duozhang:{ name: '夺其差事', desc: '运作让某房失去手中差事',   mingHit: 18, selfTiyan: 8 },
  zuoshi:  { name: '坐实传闻', desc: '把一条已证实的传闻递到明处', mingHit: 22, selfTiyan: 6, needRumor: true },
  jiexin:  { name: '截留书信', desc: '截看某房与外间往来的书信',   mingHit: 6,  selfTiyan: 2, reveal: true },
};
export const SCHEME_STEP = 34;      // 每次「谋」推进的进度
export const SCHEME_WIND = 6;       // 每次推进升起的风声

// ---------- 差事 ----------
export const DUTIES = {
  zhongkui: { tiyan: 12, chong: 4, gong: 120, desc: '执掌中馈，一宅的饭食人事从你手里过' },
  puzhang:  { tiyan: 10, chong: 3, gong: 260, desc: '理铺子的账，公中银由你经手' },
  yanyan:   { tiyan: 14, chong: 5, gong: 80,  desc: '操办节令宴席，体面来得最快' },
};

// ---------- 退路 ----------
export const TUILU = {
  niangjia: { name: '娘家门路', open: 3,  cost: 200, desc: '薛媒婆替你走动，娘家那边先递了话' },
  puzi:     { name: '铺子门路', open: 9,  cost: 300, desc: '韩道国的绒线铺里，有你一分子' },
  guanmei:  { name: '官媒门路', open: 16, cost: 400, desc: '薛媒婆说，李衙内那边，她替你先看一看' },
};

// ---------- 24 节令 ----------
// choice.effects: {tiyan,chong,sifang,feng,gong,renqing:{who:delta},tuilu,flag,setVar}
export const FESTIVALS = [
  { n: 1, act: 1, name: '过门', chapter: '第七回',
    intro: '嫁妆箱笼抬进仪门，账房先生执笔待记。你的嫁妆上千两，还有两张南京拔步床、三二百筒三梭布。',
    choices: [
      { id: 'gong', text: '登记入公中', hint: '+体面 +宠',
        effects: { tiyan: 15, chong: 10, sifang: 200 },
        result: '账房记下你的名字，大娘子当众赞了一句「懂事」。满宅都看见了你的体面。' },
      { id: 'si', text: '留一半在自己名下', hint: '+私房',
        effects: { tiyan: 3, sifang: 600 },
        result: '你把一半箱笼径直抬回自己院里。没人说什么，但也没有人为你说什么。' },
    ] },
  { n: 2, act: 1, name: '元宵', chapter: '第十五回',
    intro: '元宵放灯。堂屋设席，座次就是名分。排行榜今夜第一次挂出来。',
    settle: 'yanxi' },
  { n: 3, act: 1, name: '清明', chapter: '第二十五回',
    intro: '清明烧纸。仆役们开始往你院里走动——传闻可买了。薛媒婆说，娘家那条路，随时可以替你开。',
    grantRumor: { servant: 'xiaoyu', target: 'xuee', cred: '高', truth: true } },
  { n: 4, act: 1, name: '端午', chapter: '第九回',
    intro: '潘金莲入门，行拜见礼，排行第五。她没有嫁妆，没有娘家，只有一双眼睛。排行榜添了一块新木牌。',
    join: ['pan'] },
  { n: 5, act: 1, name: '七夕', chapter: '第二十二回',
    intro: '七夕乞巧。宅里的嘴多起来——从这一令起，买来的传闻里会有假的。',
    grantRumor: { servant: 'daian', target: 'yue', cred: '中', truth: false } },
  { n: 6, act: 1, name: '中秋', chapter: '第十九回',
    intro: '李瓶儿携资入门，排行第六。她带来的银子比你的还多。今夜满院灯火，座次要重排了。',
    join: ['pinger'], settle: 'yanxi', dutyRisk: true },
  { n: 7, act: 2, name: '冬至', chapter: '第三十回',
    intro: '官哥儿降生，西门庆买得金吾卫副千户的官身。生子加官，全宅到了顶点。从这一令起，「谋」与风声入局。',
    unlockMou: true },
  { n: 8, act: 2, name: '立春', chapter: '第三十三回',
    intro: '开春。各房的眼神都变了——有了官哥儿，这宅子里的每一笔账都要重算。' },
  { n: 9, act: 2, name: '花朝', chapter: '第三十六回',
    intro: '花朝节。绒线铺新开张，韩道国做了伙计。铺子那条门路，如今可以走了。' },
  { n: 10, act: 2, name: '佛诞', chapter: '第四十回',
    intro: '浴佛。中馈之权要重新分派，大娘子在看谁接。',
    choices: [
      { id: 'zheng', text: '当众争这权', hint: '+体面 +风声',
        effects: { tiyan: 8, feng: 5 },
        result: '你当席应了下来。有人佩服，也有人记下了你的名字。' },
      { id: 'rang', text: '让给大娘子的人', hint: '+大娘子人情',
        effects: { renqing: { yue: 10 } },
        result: '你退了一步。大娘子看你一眼，什么都没说，什么都记下了。' },
    ] },
  { n: 11, act: 2, name: '夏至', chapter: '第四十四回',
    intro: '夏至。铺账、节礼、人情往来，都赶在这一令。' },
  { n: 12, act: 2, name: '中元', chapter: '第四十八回',
    intro: '中元烧包。官场上有人参了西门庆一本，宅子里气压很低——这一令的明账，涨得虚。' },
  { n: 13, act: 2, name: '重阳', chapter: '第五十二回',
    intro: '重阳登高。家主的应酬越来越多，回来得越来越晚。各房窗下的灯，一盏一盏地等。' },
  { n: 14, act: 2, name: '寒衣', chapter: '第五十六回',
    intro: '寒衣节。李瓶儿房里的灯，常常亮到后半夜。' },
  { n: 15, act: 2, name: '官哥儿夭', chapter: '第五十九回',
    intro: '官哥儿受惊，没了。宅子里人人知道是怎么回事，人人不说。你买下的传闻在你袖子里发烫。',
    choices: [
      { id: 'jiefa', text: '揭发', hint: '+体面 +风声 · 潘金莲成死敌',
        effects: { tiyan: 15, feng: 20, flag: 'jiefa' },
        result: '你把话递到了大娘子跟前。体面是你的了，死敌也是你的了。' },
      { id: 'chenmo', text: '沉默', hint: '无变化',
        effects: {},
        result: '你什么都没说。袖子里那条传闻，慢慢凉了。' },
      { id: 'huanqu', text: '换取好处', hint: '+私房 +潘金莲人情 −体面',
        effects: { sifang: 250, renqing: { pan: 20 }, tiyan: -8, flag: 'huanqu' },
        result: '潘金莲院里的人深夜送来一口小箱子。你们谁都没有提官哥儿。' },
    ], dutyRisk: true },
  { n: 16, act: 2, name: '李瓶儿病故', chapter: '第六十二回',
    intro: '李瓶儿病了三个月，没了。大办丧仪，宅里白幡满院。她的那块木牌，从排行榜上撤了下来。',
    dead: ['pinger'],
    choices: [
      { id: 'jiefa2', text: '借丧仪再提旧事', hint: '+体面 +风声',
        effects: { tiyan: 8, feng: 12 },
        result: '丧仪上你又递了一句话。有人开始躲着你走。' },
      { id: 'songzhong', text: '好好送一程', hint: '+各房人情',
        effects: { renqing: { yue: 8, xuee: 5 } },
        result: '你帮着料理了丧仪。人都说三娘心善。' },
      { id: 'shoulian', text: '收敛不出头', hint: '+私房',
        effects: { sifang: 120 },
        result: '白事乱，账也乱。你把自己的东西清点了一遍，又锁紧了一层。' },
    ] },
  { n: 17, act: 2, name: '元宵·虚顶', chapter: '第七十八回',
    intro: '又是元宵。西门庆权势最盛，烟火放到半夜，各房的灯都为他亮着。明账的收益眼下是最好的——可你听得出，这火太旺了。',
    mingBoost: true },
  { n: 18, act: 2, name: '重阳·虚顶', chapter: '第七十九回前',
    intro: '家主连日在王三官府上赴宴，回来时说心口疼。他夜里走的路越来越长，排行榜上的数字还在涨，涨得让人眼热。',
    mingBoost: true },
  { n: 19, act: 3, name: '第七十九回', chapter: '第七十九回', clear: true,
    intro: '这一日，宅子里的事，一件接着一件。' },
  { n: 20, act: 3, name: '分家 · 债主上门', chapter: '第八十回',
    intro: '家主一倒，债主上门。李娇儿已经悄悄卷了财物回院里去了。吴月娘主持分家，先问的是现银。',
    dead: ['lijiaoer'],
    choices: [
      { id: 'dadian', text: '拿私房打点', hint: '−150私房 +大娘子人情', needSi: 150,
        effects: { sifang: -150, renqing: { yue: 12 } },
        result: '银子递出去，债主的口气软了。大娘子看在眼里。' },
      { id: 'shuoxiang', text: '请大娘子说项', hint: '−12大娘子人情', needRq: { who: 'yue', n: 12 },
        effects: { renqing: { yue: -12 }, sifang: 60 },
        result: '大娘子出面回了几笔。欠她的，从此你心里有数。' },
      { id: 'yingding', text: '硬顶着不出', hint: '+风声',
        effects: { feng: 10 },
        result: '你一两没出。债主走了，话留下了。' },
    ] },
  { n: 21, act: 3, name: '分家 · 铺子关张', chapter: '第八十一回',
    intro: '韩道国拐了一千两货款远遁，来保也欺主自开布铺。铺子一间间关张，人手星散。',
    settle: 'puzi' },
  { n: 22, act: 3, name: '分家 · 月娘分派', chapter: '第八十五回',
    intro: '月娘按礼法与实际把持，分派余下的家产。春梅已被发卖，潘金莲也被逐出。宅子里越来越空。',
    settle: 'fenpei' },
  { n: 23, act: 3, name: '去向', chapter: '第九十一回',
    intro: '尘埃落定。你的去路，只看你这些年藏下的那本账。',
    ending: true },
  { n: 24, act: 3, name: '第一百回', chapter: '第一百回',
    intro: '后来。',
    epilogue: true },
];

// ---------- 留宿与「耗」 ----------
// 「宠」的具体载体:每节令结算时判定家主今夜歇在谁院里。
// 权重是各房「争夜」的脾性——潘金莲最激进,李娇儿几乎从不(她的对照组身份因此更清晰)。
// 实际中签还叠加各自当前明账(ming*0.25)与玩家的「争夜」布置(+55)。
export const YE_WEIGHT = {
  yue: 12,      // 正妻有名分在,不争也有灯
  lijiaoer: 1,  // 几乎从不争夜:她的心思从来不在宅子里
  xuee: 4,
  pan: 30,      // 最激进
  pinger: 10,
  chunmei: 8,   // 通房丫鬟,灯也常落在她头上
};
export const YE_COST = 60;   // 「争夜」的私房花费:置办酒菜、头面、灯烛
export const YE_HAO = 7;     // 一次「争夜」添的耗
export const YE_BONUS = 55;  // 「争夜」给留宿抽签加的权重

// 耗:不上榜的暗指标,暗账的负债项。长期争宠的人,到分家时已经病了。
// 结局判定时:耗≥55 降一档,≥85 降两档(不推翻发落判定,只削弱出路)。
export const HAO = { weak: 55, grave: 85 };

// 留宿文案:明清世情笔法的留白——永远停在帐幔落下那一刻,镜头不进帐子。
export const LODGING_TEXTS = {
  playerWin: '西角门的灯,今夜落在你的院里。帐幔放下来的时候,更鼓正打三下。',
  playerYeWin: '你备下的那盏茶没有白凉。灯落在你院里——别的院子,一扇一扇都黑了。',
  yeFail: '灯落在了{name}院里。你备下的酒菜与头面,原样收回了箱底。',
  rival: '{name}院里的灯,今夜亮着。',
  rivalPan: '{name}院里的灯,直烧到四更。',
};

// ---------- 24 节令天色 ----------
// 不重画背景图:sky 是天色渐变(远景层),tint 是叠加在宅院上的调光(multiply),
// particles 是氛围粒子:willow 柳絮 / rain 雨丝 / snow 雪 / ember 灯火余烬 / petal 花瓣 / ash 纸灰。
export const SKY = [
  { sky: ['#d9b98a', '#e8d5b0'], tint: 'rgba(216,170,90,0.16)', particles: 'none' },   // 1 过门 暖暮
  { sky: ['#232c48', '#4a5470'], tint: 'rgba(30,40,70,0.34)', particles: 'ember' },    // 2 元宵 冷蓝夜
  { sky: ['#9aa8a0', '#c8cfc4'], tint: 'rgba(140,160,150,0.15)', particles: 'rain' },  // 3 清明 青灰雨
  { sky: ['#d8c090', '#e8d8b0'], tint: 'rgba(200,160,60,0.12)', particles: 'willow' }, // 4 端午 燥黄
  { sky: ['#7a6a8a', '#c0a8b0'], tint: 'rgba(120,90,140,0.15)', particles: 'none' },   // 5 七夕 暮紫
  { sky: ['#3a4a68', '#8a9ab8'], tint: 'rgba(40,60,100,0.28)', particles: 'ember' },   // 6 中秋 清白月
  { sky: ['#2e3a4e', '#6a788c'], tint: 'rgba(30,45,75,0.30)', particles: 'snow' },     // 7 冬至 墨蓝雪
  { sky: ['#b8c8a8', '#e0e4c8'], tint: 'rgba(150,180,120,0.12)', particles: 'willow' },// 8 立春 新绿
  { sky: ['#d8b8c0', '#ecdcd8'], tint: 'rgba(220,160,170,0.12)', particles: 'petal' }, // 9 花朝 花信
  { sky: ['#b8ccd8', '#e4e8dc'], tint: 'rgba(150,190,210,0.10)', particles: 'none' },  // 10 佛诞 晴
  { sky: ['#d8d0a8', '#ece4c0'], tint: 'rgba(220,200,120,0.14)', particles: 'none' },  // 11 夏至 白燥
  { sky: ['#8a9484', '#c0bfa8'], tint: 'rgba(110,130,100,0.18)', particles: 'ash' },   // 12 中元 烧包
  { sky: ['#c8a86a', '#e0cba0'], tint: 'rgba(190,140,60,0.16)', particles: 'none' },   // 13 重阳 琥珀
  { sky: ['#9aa0a8', '#c8c8c0'], tint: 'rgba(120,130,140,0.18)', particles: 'none' },  // 14 寒衣 冷灰
  { sky: ['#8a8a88', '#b8b6ae'], tint: 'rgba(100,100,100,0.22)', particles: 'ash' },   // 15 官哥儿夭 灰
  { sky: ['#a8a8a4', '#d0cec4'], tint: 'rgba(160,160,155,0.20)', particles: 'none' },  // 16 病故 缟素
  { sky: ['#3a3050', '#7a5a50'], tint: 'rgba(60,40,90,0.28)', particles: 'ember' },    // 17 元宵·虚顶 火太旺
  { sky: ['#b09a6a', '#d0bd98'], tint: 'rgba(170,140,80,0.16)', particles: 'none' },   // 18 重阳·虚顶
  { sky: ['#4a5058', '#8a8c88'], tint: 'rgba(60,70,80,0.25)', particles: 'none' },     // 19 第七十九回
  { sky: ['#585c60', '#9a988c'], tint: 'rgba(70,76,82,0.24)', particles: 'none' },     // 20 债主上门
  { sky: ['#4e545c', '#8e8c82'], tint: 'rgba(64,72,80,0.24)', particles: 'none' },     // 21 铺子关张
  { sky: ['#48505c', '#84867e'], tint: 'rgba(56,66,78,0.26)', particles: 'snow' },     // 22 月娘分派 雪
  { sky: ['#424a56', '#7c7e76'], tint: 'rgba(50,60,72,0.26)', particles: 'snow' },     // 23 去向
  { sky: ['#3c4450', '#74766e'], tint: 'rgba(46,56,68,0.28)', particles: 'snow' },     // 24 第一百回
];

// ---------- 上门事件 ----------
// 节令中途有人主动来找你,打断行动分配,要求当场表态。
// 文案三行以内,像有人真的站在门口;选项都有代价,没有安全选项。
// cond 读当前 state(函数不进存档,只用于筛选);flag 效果记录触发时的节令号。
export const VISITS = [
  { id: 'xuee_jieqian', min: 3, weight: 3,
    cond: (s) => s.rivals.xuee.alive,
    title: '孙雪娥来了', portrait: 'portrait/sun_xuee',
    text: '她在门口站着，眼睛是红的。\n开口借六十两，说是家里的事，不肯细说。',
    choices: [
      { id: 'give', text: '借她六十两', hint: '−60私房 · 她记下这份情',
        effects: { sifang: -60, renqing: { xuee: 15 } },
        result: '她攥着银子，朝你福下去，什么都没说。' },
      { id: 'refuse', text: '推说手头也紧', hint: '她会记恨',
        effects: { hostility: { xuee: 20 } },
        result: '她笑了一下，转身走了。那笑比哭还难看。' },
    ] },
  { id: 'pan_chai', min: 5, weight: 3,
    cond: (s) => s.rivals.pan.joined && s.rivals.pan.alive && !s.flags.panChai,
    title: '潘金莲来了', portrait: 'portrait/pan_jinlian',
    text: '她手里拿着一支钗，不由分说插在你妆台上。\n「姊妹一场，别跟我见外。」',
    choices: [
      { id: 'accept', text: '收下这支钗', hint: '欠她的，日后要还',
        effects: { flag: 'panChai', affection: { pan: 20 } },
        result: '她替你拢了拢鬓角，眼风在你脸上一转，笑着走了。' },
      { id: 'refuse', text: '不敢受，退回去', hint: '当场结仇',
        effects: { hostility: { pan: 25 }, feng: 4 },
        result: '她捏着那支钗站了一会儿。「三娘好清高。」门帘甩得山响。' },
    ] },
  { id: 'pan_collect', min: 7, weight: 4,
    cond: (s) => !!s.flags.panChai && s.rivals.pan.alive && s.festival >= s.flags.panChai + 2,
    title: '潘金莲又来了', portrait: 'portrait/pan_jinlian',
    text: '她坐下就吃你的茶，吃到第三盏才开口。\n「钗子戴着可还称心？——我如今，有一件小事要你办。」',
    choices: [
      { id: 'pay', text: '替她走一百两的账', hint: '−100私房 · 两清', needSi: 100,
        effects: { sifang: -100, renqing: { pan: 10 }, unflag: 'panChai' },
        result: '银子过了手，她起身告辞，比来时客气了三分。' },
      { id: 'word', text: '替她往外递一句话', hint: '+风声',
        effects: { feng: 8, affection: { pan: 15 }, unflag: 'panChai' },
        result: '话当夜就递出去了。你知道，这话收不回来。' },
      { id: 'sick', text: '装病回绝', hint: '结仇',
        effects: { hostility: { pan: 40 }, feng: 4 },
        result: '她盯着你看了一会儿。「三娘好生养着。」帘子落下，钗的情分也落了。' },
    ] },
  { id: 'daian_menkan', min: 4, weight: 3,
    cond: (s) => s.player.sifang >= 100,
    title: '玳安来了', portrait: 'servant/daian',
    text: '玳安凑近了，声音压得很低：\n「三娘上个月那两口箱子……小的都瞧见了。」',
    choices: [
      { id: 'seal', text: '封他的口', hint: '−80私房', needSi: 80,
        effects: { sifang: -80 },
        result: '银子入手，他笑得见牙不见眼：小的什么也没瞧见。' },
      { id: 'ignore', text: '不理他', hint: '+风声',
        effects: { feng: 8 },
        result: '他躬身退下了。第二天，这话就长在了别人的舌头上。' },
    ] },
  { id: 'chunmei_qing', min: 8, weight: 2,
    cond: (s) => s.rivals.chunmei.alive,
    title: '春梅来了', portrait: 'portrait/pang_chunmei',
    text: '春梅越过规矩，亲自来请你。\n「爹屋里新到的果子，请三娘过去说话。」满院的眼睛都看着。',
    choices: [
      { id: 'go', text: '去坐坐', hint: '+她欠你 · 惹人眼',
        effects: { renqing: { chunmei: 10 }, feng: 3 },
        result: '她亲自给你斟茶，手很稳。你们都没提规矩两个字。' },
      { id: 'stay', text: '托词不去', hint: '她会记下',
        effects: { hostility: { chunmei: 15 } },
        result: '她福了一福，退出去，脊背挺得笔直。' },
    ] },
  { id: 'ximen_ye', min: 6, weight: 3,
    cond: (s) => true, // 家主深夜上门,前两幕都可能
    title: '家主深夜到了院门口', portrait: 'portrait/ximen_qing',
    text: '更鼓打过两下，院门外来了脚步声。\n只有两个小厮打着灯——他今夜，是冲你来的。',
    choices: [
      { id: 'open', text: '开门迎灯', hint: '灯落你院 · +耗',
        effects: { chong: 5, hao: 8, lodging: 'player' },
        result: '那一夜灯直烧到四更。天明时你的眼圈是青的，腰还是直的。' },
      { id: 'decline', text: '推说身子不适', hint: '−宠 · 保住这一夜',
        effects: { chong: -8 },
        result: '灯在门外停了一停，往别处去了。你睡了一个整觉。' },
    ] },
];

// ---------- 行动的即时世情反馈 ----------
// 每个动作落定后的一句白描:浮字给数值,短句给意义。按(节令×行动序)定选,不走 RNG 流。
export const ACTION_ECHO = {
  tan: ['小玉端着茶站在门口，没有进来。', '玳安把话揣进袖子，左右看了一眼。', '冯妈妈的嘴，凑到你耳边才张开。'],
  jie: ['礼单递进去，那边院里安静了一会儿。', '收礼的妈妈嘴上说不敢当，手很稳。', '这份人情摆在明面上，满宅都看见了。'],
  ye: ['你叫人把院里的灯，提前点上了。', '小厨房温上了酒，没有声张。'],
  mou: ['有一句话放出去了，收不回来。', '知情人又多了一个。你把名字记在心里。'],
  chi: ['账房把钥匙交到你手上时，廊下几个人都看着。', '差事落到你头上，担子也落到你头上。'],
  cang: ['箱笼的锁，又换了一把。', '这一笔，只有你自己知道。'],
  verify: ['话递了回去，要一个准信。'],
};

// ---------- 宴席结算(排行榜的诱惑):宠高者席位靠前,额外体面 ----------
export const YANXI = [
  { minChong: 40, tiyan: 8, text: '你的席位排得靠前，众人举杯先敬你。' },
  { minChong: 20, tiyan: 4, text: '你的席位不差，也算体面。' },
  { minChong: 0, tiyan: 0, text: '你的席位靠后。满桌的笑语，隔着几个人才传到你耳边。' },
];
