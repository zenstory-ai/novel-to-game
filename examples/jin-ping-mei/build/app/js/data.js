// 《风月总账》设计数据。成人节点只允许 HEROINE_IDS 中的三名成年角色。

export const HEROINE_IDS = Object.freeze(['wu_yueniang', 'pan_jinlian', 'li_pinger']);

export const HEROINES = Object.freeze({
  wu_yueniang: {
    id: 'wu_yueniang', short: '月娘', name: '吴月娘', house: '正堂', glyph: '正',
    portrait: 'heroine/yue', close: 'heroine/yue/close', shape: '方签',
    want: '你人前认她是正堂，人后也肯把真账交出来', gives: '钥匙、底气，还有一处不必演给别人看的软处',
    voice: '月娘不问你今夜留不留，只把账页推近一寸：“官人先坐。话说真了，门自然不会关。”',
    colors: ['#203b3a', '#b6995f'],
  },
  pan_jinlian: {
    id: 'pan_jinlian', short: '金莲', name: '潘金莲', house: '花园角门', glyph: '扇',
    portrait: 'heroine/pan', close: 'heroine/pan/close', shape: '斜签',
    want: '你敢当面偏她，也敢当面承认偏过别人', gives: '最快的口风、最辣的反击，和一扇越闹越热的门',
    voice: '金莲用扇骨挑起你的袖口，笑意没进眼底：“怎么，白日敢看，进了我的门反倒不敢了？”',
    colors: ['#7f231f', '#c88b69'],
  },
  li_pinger: {
    id: 'li_pinger', short: '瓶儿', name: '李瓶儿', house: '瓶儿私院', glyph: '匣',
    portrait: 'heroine/pinger', close: 'heroine/pinger/close', shape: '圆签',
    want: '你先把她当成要留的人，再把她的银子当成要借的账', gives: '银钱、货路，和一间不用高声说话的屋子',
    voice: '瓶儿先把窗缝合上，才把茶盏推过来：“钱的事都好说。只是今夜这几句，别让第三个人听见。”',
    colors: ['#8d6a32', '#ead9b4'],
  },
});

export const HOUSEHOLD_IDS = Object.freeze(['meng_yulou', 'sun_xuee', 'li_jiaoer']);

export const HOUSEHOLD = Object.freeze({
  meng_yulou: {
    id: 'meng_yulou', name: '孟玉楼', short: '玉楼', house: '卷棚后间', adult: true,
    portrait: 'household/meng', glyph: '曲',
    role: '会给人台阶，也最会在台阶上留一笔人情',
    voice: '玉楼先笑着替人斟酒，再把话头轻轻一拧。等你发现时，她要的答复已经在你嘴边了。',
  },
  sun_xuee: {
    id: 'sun_xuee', name: '孙雪娥', short: '雪娥', house: '灶上', adult: true,
    portrait: 'household/xuee', glyph: '灶',
    role: '管着一宅的冷热，难听话从不替谁加糖',
    voice: '雪娥揭开锅盖，白汽与话一起扑出来：“爷爱听好话，灶上可只认真米真柴。”',
  },
  li_jiaoer: {
    id: 'li_jiaoer', name: '李娇儿', short: '娇儿', house: '西厢', adult: true,
    portrait: 'household/jiaoer', glyph: '匣',
    role: '认得城里的门路，也认得每一句情话背后的价码',
    voice: '娇儿拢着描金匣笑：“亲归亲，银子归银子。若是官人亲自来求，倒可少算一双鞋钱。”',
  },
});

export const DAY_NAMES = ['正堂起账', '城门扣了货', '后仓丢了箱', '催账人入座', '中秋三杯酒', '灯下收总账'];

export const DAY_PRESSURE = [
  '公中少了五十两。月娘把账本摊开，身边却还给你留着半张凳；金莲倚在门边，手里那杯酒已经等了很久。',
  '生药铺的车扣在城门。三十两能买一条路，一句送对人的话也能——只是人情比银子更难还。',
  '后仓空了两格。掌柜在前厅笑得满头是汗，雪娥拎着空米袋堵在门口，等你选信哪一张脸。',
  '催账人在前厅换了两回茶，鞋尖一次也没朝外。他不只知道你欠多少，连昨夜哪扇门闩得最晚都听说了。',
  '中秋席面已开，三只空杯挨在一处。你这几日私下哄过谁、护过谁、冷落过谁，都要在第一壶酒里对账。',
  '最后一拨债主堵在门外，院里却异常安静。六日里你留下的若不只是情话，今夜才会有人同你一起打开这扇门。',
];

export const DAY_ACTIONS = Object.freeze({
  ledger: { id: 'ledger', label: '翻账', glyph: '理', description: '先把银子找回来，顺手看看是谁动了账。' },
  office: { id: 'office', label: '走官面', glyph: '办', description: '递银子、递人情，总得递一样进去。' },
  listen: { id: 'listen', label: '问口风', glyph: '探', description: '问来的话能救急，传话的人也会记着你。' },
  banquet: { id: 'banquet', label: '整席面', glyph: '宴', description: '银子花在桌上，开口时才有人肯听。' },
});

export const OPENING_CHOICES = Object.freeze([
  { id: 'respect_yue', label: '挨着月娘坐下', hint: '真账交给她；金莲那杯酒会慢慢凉', text: '你没在桌尾站着，而是在月娘留出的半张凳上坐下，把真账压到她手边。她没有立刻翻开，只低声问：“这会儿知道回来了？”' },
  { id: 'tease_pan', label: '就着金莲的手喝', hint: '当着正堂偏她一回；这杯酒会留到夜里', text: '金莲故意不把杯子递稳，你便就着她的手喝了。她的指尖还停在杯沿，眼睛却看着月娘：“当着姐姐的面也敢。夜里可别又装规矩。”' },
]);

const route = (id, label, hint, text, effects = {}, condition = null, locked = '') =>
  Object.freeze({ id, label, hint, text, effects, condition, locked });

const householdChoice = (id, label, hint, text, effects) =>
  Object.freeze({ id, label, hint, text, effects });

// 三院共约不占个人路线拍：玩家分别听完三人的边界，第六夜才有资格请她们同席。
export const ACCORD_CHOICES = Object.freeze({
  wu_yueniang: route(
    'accord_yue_order', '让她收住总账', '公中只认一本账，各院的私钥谁也不抢',
    '月娘把三把钥匙一把把分开，最后只留下总账：“箱子归她们，这本归我。官人若是连这一条都应不下，夜里也不必再来问门。”',
    { rel: { qing: 12, du: -4 }, house: 5, accord: 'order' },
  ),
  pan_jinlian: route(
    'accord_pan_truth', '去谁那里就说真', '可以偏心，别拿同一句情话哄三扇门',
    '金莲用扇尖抵住你心口：“你偏谁，我管不住。只一条——别从我的被窝里起身，转头就去另一处说，今生只有她。”',
    { rel: { qing: 14, yu: 8, du: -6 }, accord: 'truth' },
  ),
  li_pinger: route(
    'accord_pinger_key', '银子可借，钥匙不借', '想动她的箱子，先让她知道你会把人留下',
    '瓶儿把钥匙收回掌心，声音很轻：“你要多少，我都能同你算。可这把钥匙不能拿走——我怕的不是少一箱银子，是早晨醒来，连问话的人都不在了。”',
    { rel: { qing: 14, yu: 4, du: -5 }, house: 3, accord: 'safety' },
  ),
});

// 联院差事是院约的即时读点：每组只做一次，不靠重复刷数值。
export const JOINT_ACTIONS = Object.freeze([
  {
    id: 'joint_yue_pan', participants: ['wu_yueniang', 'pan_jinlian'], asset: 'cg/joint/yue_pan',
    requires: ['order', 'truth'], label: '正堂问口供',
    hint: '月娘对账，金莲追话；势 +1，露 +7',
    text: '月娘把账页推过中线：“他说丢的是药。”金莲用扇骨压住那行墨：“可我在门外听的，怎么是布？”月娘看她一眼，算珠啷地归了位：“请他进来。”金莲笑着起身：“好姐姐，你问钱，我问他这张嘴。”',
    effects: {
      power: 1, exposure: 7, house: 2,
      relAll: {
        wu_yueniang: { qing: 5, du: -4 },
        pan_jinlian: { qing: 5, du: -4 },
      },
    },
  },
  {
    id: 'joint_yue_pinger', participants: ['wu_yueniang', 'li_pinger'], asset: 'cg/joint/yue_pinger',
    requires: ['order', 'safety'], label: '公账接货单',
    hint: '月娘核数，瓶儿调货；银 +32，宅 +5',
    text: '瓶儿亲自开箱，钥匙一直没离手：“这车货，我可以借。”月娘没朝钥匙看，只翻开一张新页：“你说数，我写。你说几时还，就几时还。”瓶儿抬眼看了她片刻，忽然笑了：“难怪这宅里，只有姐姐的笔比官人的话靠谱。”',
    effects: {
      silver: 32, house: 5,
      relAll: {
        wu_yueniang: { qing: 5, du: -4 },
        li_pinger: { qing: 5, du: -4 },
      },
    },
  },
  {
    id: 'joint_pan_pinger', participants: ['pan_jinlian', 'li_pinger'], asset: 'cg/joint/pan_pinger',
    requires: ['truth', 'safety'], label: '顺话验货车',
    hint: '金莲套话，瓶儿验货；银 +18，势 +1，露 +5',
    text: '金莲绕着车夫走了半圈：“昨夜还说走的水路，怎么一见人，鞋底倒干净了？”瓶儿已拆开封条，不紧不慢地点了点空格。金莲朝她一偏头：“妹妹数货，我数他撒了几句谎。”瓶儿笑得很淡：“那你要数慢些，别叫他少赔一箱。”',
    effects: {
      silver: 18, power: 1, exposure: 5,
      relAll: {
        pan_jinlian: { qing: 5, du: -4 },
        li_pinger: { qing: 5, du: -4 },
      },
    },
  },
]);

export const SHARED_NIGHT_CHOICES = Object.freeze([
  route(
    'shared_divide_roles', '今夜谁都别走', '三条院约、两桩联院差事都已谈成，才能把外账与今夜一起留下',
    '月娘把总账一合：“人留在正堂，我问。”金莲抽走她指下的口供：“姐姐问钱，我问他怕谁。”瓶儿将货单压到两人中间：“西门的车我来接，钥匙还在我手里。”月娘看看她们，又看向你：“那就这么办。今夜都不走，省得官人再去三处门前说三遍好话。”',
    {
      relAll: {
        wu_yueniang: { qing: 12, yu: 5, du: -18 },
        pan_jinlian: { qing: 12, yu: 7, du: -18 },
        li_pinger: { qing: 12, yu: 5, du: -18 },
      },
      silver: 30, house: 10, flags: ['harem_coalition'],
    },
  ),
  route(
    'shared_buy_quiet', '拿四十两散了今夜', '银子能买到一晚不吵，买不到三个人同心',
    '四十两分成三只荷包。月娘收进账下，金莲在掌心抛了抛，瓶儿连系带都没拆。三个人各自起身，账本、口供和货单谁也没留。',
    {
      relAll: {
        wu_yueniang: { qing: 2, du: -12 },
        pan_jinlian: { qing: 2, du: -12 },
        li_pinger: { qing: 2, du: -12 },
      },
      silver: -40, house: 2,
    },
  ),
  route(
    'shared_promise_all', '说她们都是唯一', '这句话说得最快，三扇门也会关得最快',
    '“都是唯一？”金莲先笑了，笑得连扇子都在抖。月娘已经把账本收回，瓶儿也将钥匙系紧。金莲起身时朝你眼前一偏头：“好官人，快去追。第一个追回来的，便算第一。”',
    {
      relAll: {
        wu_yueniang: { du: 18, qing: -6 },
        pan_jinlian: { du: 18, qing: -6 },
        li_pinger: { du: 18, qing: -6 },
      },
      house: -10, exposure: 6,
    },
  ),
]);

// 三院线的尾章不再用一张结局图代替过程。共同办完外账后，玩家还要走过两段
// 可见夜话与一次次晨选择；每段都让三个人彼此接话，才落最终结算。
export const SHARED_AFTERGLOW_BEATS = Object.freeze([
  Object.freeze({
    id: 'cups_still_warm',
    kicker: '外账已清 · 酒意才起',
    title: '三个人还坐在你身边',
    body: '门外最后一阵脚步远了，屋里忽然静得能听见灯芯轻响。金莲把口供折成细条，压在酒壶底下；月娘松了松领口，却没有起身；瓶儿把钥匙绕在指间，一圈一圈，目光始终落在你手上。方才谈的是谁守哪一扇门。现在，三个人都在等你先碰哪一只杯。',
    choices: Object.freeze([
      route('afterglow_yue_cup', '握住月娘斟酒的手', '这杯不敬正堂，只敬她今夜没走', '你从月娘手里接酒，却没立刻松开她的手腕。她看了看你交叠的手，低声道：“酒都洒了。”金莲俯身替她扶正杯子，笑得意味深长：“大娘今夜还心疼这几滴？”瓶儿将帕子递来，指尖从你手背上轻轻擦过：“别闹她。她若真想躲，方才就已经走了。”', { relAll: { wu_yueniang: { qing: 5, yu: 5 }, pan_jinlian: { qing: 2, yu: 2 }, li_pinger: { qing: 2, yu: 2 } } }),
      route('afterglow_pan_fan', '从金莲手里夺过扇子', '她若肯让你夺走，便是在等你再近一些', '金莲偏不松手，扇柄在你们掌心来回一寸。你稍一用力，她便顺势靠近，发间的香先落到你衣襟上。月娘淡淡道：“你若只想要人拉你，何必拿扇子作怪。”金莲回头：“姐姐看得这样仔细，不如也来帮他？”瓶儿没忍住笑，悄悄把酒壶挪开，给你们腾出半张桌面。', { relAll: { wu_yueniang: { qing: 2, yu: 2 }, pan_jinlian: { qing: 5, yu: 6 }, li_pinger: { qing: 2, yu: 2 } } }),
      route('afterglow_pinger_key', '替瓶儿解开缠住的钥匙', '只理开她的袖带，不把钥匙拿走', '钥匙缠进瓶儿的袖带，你低头替她一点点理开。她起先还攥着，等你的指节擦过腕骨，才慢慢松了力。金莲托着腮看：“官人今夜倒懂规矩，碰了人，还知道不抢东西。”月娘把瓶儿的杯斟满：“他若敢拿，你就来叫我们。横竖今夜都在一处。”', { relAll: { wu_yueniang: { qing: 2, yu: 2 }, pan_jinlian: { qing: 2, yu: 2 }, li_pinger: { qing: 5, yu: 5 } } }),
    ]),
  }),
  Object.freeze({
    id: 'door_and_lamp',
    kicker: '更漏过半 · 门仍未开',
    title: '灯影里只剩四个人',
    body: '酒壶见了底，月娘终于卸下簪冠，长发沿肩滑落。金莲接住那串流苏，慢慢替她拆开最后一个结；瓶儿坐得近了些，膝边的钥匙碰到床沿，发出极轻的一声。没有人再提总账，也没有人催你熄灯。',
    choices: Object.freeze([
      route('afterglow_close_door', '亲手落下门闩', '今晚不分先后，也不许谁悄悄退场', '门闩落下，屋里最后一线风也断了。金莲先去看月娘：“姐姐方才可是亲口说，谁都不走。”月娘把散发拢到一侧，露出颈边一小片灯影：“我说的是不走，没说由着你胡闹。”瓶儿已把外衣搭在屏风上，回身时耳尖微红：“那就慢一点。反正门已经关了。”', { relAll: { wu_yueniang: { qing: 4, yu: 5 }, pan_jinlian: { qing: 4, yu: 6 }, li_pinger: { qing: 4, yu: 5 } }, house: 3 }),
      route('afterglow_keep_lamp', '只把灯芯拨暗一半', '让彼此看得见，也给羞意留一点影子', '你没有熄灯，只把灯芯压低。金莲扯下半幅纱帐，光便柔在她肩上；月娘替瓶儿取下被发丝勾住的耳坠，又将它放进你掌心：“替她收好，明早少一件都问你。”瓶儿靠过来时，小声道：“那就别让天亮得太快。”', { relAll: { wu_yueniang: { qing: 5, yu: 3 }, pan_jinlian: { qing: 3, yu: 4 }, li_pinger: { qing: 5, yu: 3 } }, strain: -2 }),
      route('afterglow_hear_each', '问她们想怎样留下', '先听见每个人的意思，再把纱帐放下', '月娘说：“明日的账照旧，今夜不拿身份压人。”金莲接得最快：“那我也不争先，只争官人别装睡。”瓶儿握住你的手，仍把钥匙留在自己掌心：“我只要醒来时，人都还在。”三个人说完，谁也没有起身。金莲这才勾下纱帐，贴着你耳边笑：“问完了。现在总该会做了吧？”', { relAll: { wu_yueniang: { qing: 5, du: -4 }, pan_jinlian: { qing: 5, du: -4 }, li_pinger: { qing: 5, du: -4 } }, house: 4 }),
    ]),
  }),
]);

export const SHARED_DAWN_CHOICES = Object.freeze([
  route('dawn_same_table', '把早茶也摆在一处', '天亮以后，昨夜仍是一件大家都认的事', '晨光透进纱帐时，月娘已经披衣坐起，却让人把四盏茶仍送进同一间屋。金莲倚着你的肩，先夺走你那盏尝了一口：“凉的，别喝。”瓶儿重新系好钥匙，顺手替月娘拢住一缕散发。门外有人来问总账，月娘只应了一声“等着”，谁也没有急着避开谁。', { relAll: { wu_yueniang: { qing: 4 }, pan_jinlian: { qing: 4 }, li_pinger: { qing: 4 } }, house: 4 }),
  route('dawn_walk_courtyard', '陪她们走到三院岔口', '各自有门，昨夜说过的话却不各自作废', '长廊尽头，三条路在晨雾里分开。月娘替你整了整衣领：“午前来正堂看账。”金莲倒退着走了两步，眼里还带着未褪的困意：“今晚若想来，白日就说，别叫我猜。”瓶儿摸了摸袖里的钥匙：“货单午后送到。你若得空，也来喝茶。”她们各自转身，没有一盏灯当着你的面熄掉。', { relAll: { wu_yueniang: { qing: 3, du: -3 }, pan_jinlian: { qing: 3, du: -3 }, li_pinger: { qing: 3, du: -3 } }, house: 3 }),
  route('dawn_keep_cups', '锁起昨夜三只酒杯', '留一件谁都能回来查验的旧物', '你将三只酒杯并排放进正堂小柜。金莲笑你多情，月娘却亲手合上柜门；瓶儿从钥匙串上解下一枚小钥，放进你掌心，又把你的手指一根根合住：“只准开这一格。”谁也没许永远。可下次有人说昨夜只是一场酒，她们都知道该到哪里对证。', { relAll: { wu_yueniang: { qing: 3, yu: 2 }, pan_jinlian: { qing: 3, yu: 2 }, li_pinger: { qing: 3, yu: 2 } }, house: 3 }),
]);

export const HOUSEHOLD_EVENTS = Object.freeze({
  2: {
    id: 'meng_namecard', actor: 'meng_yulou', title: '玉楼手里有张名帖',
    text: '玉楼倚在卷棚后门，名帖在指间转了半圈：“城门那位马指挥使，前日还说欠我一杯茶。官人若舍得让我去讨，今日关着的便不只是一扇城门。”',
    choices: [
      householdChoice('meng_let_speak', '让她替你去讨这杯茶', '省下银子，却要记得她是为谁亮的相', '玉楼把名帖收进袖里，走过你身边时又停了停：“我去便是。只是回来后，官人得亲手给我补这杯。”', { power: 1, exposure: 4, secrets: ['meng_favor'], household: { id: 'meng_yulou', regard: 18 } }),
      householdChoice('meng_keep_home', '把名帖按回她手里', '宅里少些闲话，她也知道你不愿欠她', '玉楼顺着你的力道收好名帖，嘴角那点笑没变：“也好。那杯茶我留给自己，官人去城门喝风吧。”', { house: 3, household: { id: 'meng_yulou', regard: -8 } }),
    ],
  },
  3: {
    id: 'xuee_storehouse', actor: 'sun_xuee', title: '雪娥堵在后仓门口',
    text: '雪娥拎着空米袋，掌心还沾着白面：“灶上三口锅，一口没米；后仓八把锁，倒少了两箱货。爷若是只想听好话，我这就回去把锅盖上。”',
    choices: [
      householdChoice('xuee_check_storehouse', '接过米袋，跟她去后仓', '追回一点货，也让她看见你肯沾这手灰', '你接过米袋，跟她走进后仓。雪娥一脚踢开最里那只箱子，露出重新绑过的绳结：“好会过日子的老鼠，偷了米还知道把箱子捆回去。”', { silver: 25, house: 4, secrets: ['kitchen_witness'], household: { id: 'sun_xuee', regard: 16 } }),
      // 她把攒下的私房一次掏干净：眼前的银子比后仓那点货多，代价是灶上从此没有好脸。
      householdChoice('xuee_pay_shortfall', '叫她先拿私房填上', '眼前多出四十两，今后灶上的冷热都得自己咽', '雪娥盯了你半晌，忽然解开围裙，把缝在里层的银子一块块剪下来：“拿去。从今往后，夜里谁口渴、谁要热水，叫她们自己烧。”', { silver: 40, house: -6, household: { id: 'sun_xuee', regard: -16 } }),
    ],
  },
  4: {
    id: 'jiaoer_collector', actor: 'li_jiaoer', title: '娇儿认得门外那张脸',
    text: '娇儿抱着描金匣子坐在廊下，远远看了催账人一眼：“外头那个姓祝，年轻时在我门前站过三夜。如今倒学会穿人模样了。他的账开多少，底价又是多少，我比他自己还清楚。”',
    choices: [
      householdChoice('jiaoer_buy_name', '把二十两放进她匣里', '她替你问底价，先别拿情分抵路费', '银子落进匣里，娇儿连数都没数，只用指尖将匣盖一勾：“这就对了。情分是情分，鞋底是鞋底。官人若想谈别的，等我回来再另算。”', { silver: -20, secrets: ['collector_price'], household: { id: 'li_jiaoer', regard: 16 } }),
      householdChoice('jiaoer_take_box', '伸手扣住她的匣子', '手里多三十两，她从此连你的笑也按价计', '你扣住匣子，娇儿便真的松了手。她面上的笑一点点淡下去：“官人收稳些。往后再来找我，进门钱就不止这三十两了。”', { silver: 30, exposure: 8, house: -4, household: { id: 'li_jiaoer', regard: -18 } }),
    ],
  },
});

export const ROUTE_CHOICES = Object.freeze({
  wu_yueniang: [
    [
      route('yue_share_shortfall', '把短账摊开', '她肯帮你查，宅里也安稳些', '你把缺的五十两直说了。月娘翻开账簿：“早这么说，我何苦猜你？”', { rel: { qing: 18 }, house: 5, flags: ['yue_respected'] }),
      route('yue_bypass', '叫她拿钱补上', '眼前能过，往后别想再碰她的钥匙', '月娘看了你一眼，把钥匙揣进袖里：“公中的窟窿，不能回回拿我的箱子填。”', { rel: { du: 14, qing: -6 }, house: -7 }),
    ],
    [
      route('yue_show_accounts', '账本都给她看', '她看见真账，才肯跟你一同管', '月娘逐页看完，把身旁的凳子拉开半尺：“坐吧。今夜别又说到一半。”', { rel: { qing: 17, yu: 5 }, repute: 1, flags: ['yue_informed'] }),
      route('yue_hide_accounts', '只说已经办妥', '她不碰外账，也不会替你兜底', '“办妥了？”月娘翻开空白那页，又合上，“那你还来问我什么？”', { rel: { du: 12, qing: -5 }, exposure: 6 }),
    ],
    [
      route('yue_keep_word', '撤掉一桌闲酒', '你还记得那句话，她也记得', '闲酒真撤了。月娘叫人收走多余的杯盏，临出门才说：“这一回，算你没哄我。”', { rel: { qing: 22, yu: 8 }, silver: 35, house: 6, flags: ['kept_yue_word'] }, 'yue_respected', '你还没当面许过她什么。'),
      route('yue_public_spend', '偏要再摆一桌', '外头看着热闹，正堂不会替你付钱', '月娘没拦，只把公中的钥匙拿走：“这桌酒是你的脸面，你自己结账。”', { rel: { du: 18, qing: -8 }, silver: -45, repute: 1, house: -8, flags: ['broken_yue_word'] }),
    ],
    [
      route('yue_ask_backing', '请她出面', '她替你挡一回，往后你也得替她撑住正堂', '月娘把账页压平：“我去说。只这一回。下回再烂在外头，你自己收。”', { rel: { qing: 14, yu: 6, du: -8 }, house: 8, secrets: ['yue_backing'] }, 'yue_informed', '你的真账还没给她看过。'),
      route('yue_soften', '先给她斟茶', '今晚少说账，看看她肯不肯留你坐下', '你把茶斟满。月娘听完那几句好话，只道：“茶还热，坐着说。”', { rel: { qing: 9, yu: 13, du: -6 } }),
    ],
    [
      route('yue_offer_seat', '下一席由她开', '往后再摆宴，正中的话先由她说', '你把下一回开席的名帖交给月娘。她看了一眼：“既叫我开口，临到桌前就别又装聋。”', { rel: { qing: 14, yu: 6, du: -10 }, repute: 1 }),
      route('yue_private_only', '只说夜里的话', '她肯听软话，却不会替你遮白日的亏空', '月娘把茶往前一推：“夜里有夜里的话。白日欠的那笔，官人也得给个说法。”', { rel: { yu: 14, du: 9 }, house: -4 }),
    ],
    [
      route('yue_share_keys', '分她一半钥匙', '从今往后，谁也别想绕开正堂动账', '你把钥匙都放到她手里。月娘分出一半，塞回你掌心：“一起拿。省得你又说记性不好。”', { rel: { qing: 18, yu: 8, du: -8 }, house: 10, flags: ['yue_co_rule'] }, 'kept_yue_word', '先前答应她的事，你还没办成。'),
      route('yue_last_tea', '陪她喝完茶', '今夜不许新愿，只把这一盏喝完', '更漏响了一声。月娘替你添茶：“今夜不谈她们。你也别开口胡许。”', { rel: { qing: 12, yu: 10, du: -6 } }),
    ],
  ],
  pan_jinlian: [
    [
      route('pan_take_cup', '喝她这杯', '你敢当着月娘喝，她便敢往下问', '金莲捏着杯脚不松手：“官人喝的是酒，还是我的话？”', { rel: { qing: 12, yu: 20, du: -4 }, flags: ['pan_promised'] }),
      route('pan_hush', '压下她的酒', '正堂清静了，她可没打算忘', '金莲仰头把酒喝净，杯子搁得脆响：“好。官人嫌我多嘴，我记住了。”', { rel: { qing: -5, yu: 8, du: 16 }, house: 4 }),
    ],
    [
      route('pan_take_clue', '听她说出人名', '明日去查掌柜的袖口', '她凑到你耳边报了个名字：“明日先查他袖口。官人若办砸了，可别说是我教的。”', { rel: { qing: 16, yu: 10 }, secrets: ['shop_fraud'], flags: ['pan_involved'] }),
      route('pan_only_flirt', '只逗她两句', '今夜热闹些，铺里的贼先放过去', '金莲用扇骨点住你的手：“正事不爱听，偏爱听我哄你？”', { rel: { qing: 7, yu: 16 } }),
    ],
    [
      route('pan_bring_confrontation', '带她当面对账', '她帮你拿住人，宅里也会传她插手外事', '金莲张口便报出赃货数。掌柜刚跪下，她回头看你：“官人，这回我可不只是会吃醋吧？”', { rel: { qing: 20, yu: 12 }, power: 1, house: -5 }, 'pan_involved', '先前这桩事，你没让她听全。'),
      route('pan_keep_out', '叫她留在宅里', '她不服气，还是给你留了一句提醒', '金莲收了扇子：“不用我也成。待会儿吃了亏，官人别回来说我没提醒。”', { rel: { qing: 6, yu: 10, du: 10 } }),
    ],
    [
      route('pan_answer_door', '开门叫她进', '她要亲眼看看，你昨夜留了什么', '金莲一进门就端起桌上那只凉茶：“人倒是走了，杯子还替她占着地方。”', { rel: { qing: 13, yu: 13, du: -14 }, secrets: ['pan_rumor'] }),
      route('pan_make_wait', '让她在门外等', '她不肯走，明日就会在人前问', '门外安静片刻，扇柄又在门框上敲了三下。金莲道：“官人，我有的是工夫。”', { rel: { yu: 6, du: 18 } }),
    ],
    [
      route('pan_keep_toast', '把欠她的酒补上', '开头那杯没白等，你记得亲手还', '你把酒送到金莲手里。她不急着喝，只盯着你笑：“官人今日倒没装忘。”', { rel: { qing: 18, yu: 12, du: -12 }, flags: ['kept_pan_word'] }, 'pan_promised', '你还没正面接过她那杯。'),
      route('pan_call_bluff', '叫她别扫兴', '席面暂且不乱，她会当桌翻你的旧话', '金莲把酒往桌上一搁：“席面要脸，官人说过的话就不要脸了？”', { rel: { qing: -8, du: 22 }, house: -4, flags: ['broken_pan_word'] }),
    ],
    [
      route('pan_choose_openly', '把今夜传下去', '叫门房都知道你今夜去她那里', '门房领了话。金莲脸上的笑停了一瞬，伸手替你理好衣领：“这句话，我等到现在。”', { rel: { qing: 18, yu: 15, du: -10 }, exposure: 7, flags: ['pan_open_choice'] }, 'kept_pan_word', '先把答应她的那杯酒还上。'),
      route('pan_no_more_words', '少说，做给她看', '不再胡许，先把眼前这一回做好', '“那就闭嘴。”金莲把你的手按在杯边，“官人做得好，我自己会看。”', { rel: { qing: 12, yu: 12, du: -8 } }),
    ],
  ],
  li_pinger: [
    [
      route('pinger_settle_room', '问她住得可好', '先问人，她才肯慢慢说箱子的事', '你没看箱笼，先问她夜里睡得惯不惯。瓶儿捏着钥匙：“这两日，总算敢睡沉些了。”', { rel: { qing: 15, yu: 7 } }),
      route('pinger_ask_money', '问箱里有多少', '先拿四十五两，她也就知道你为何来', '瓶儿把数目一笔笔报清，银子一文不少。钥匙始终压在她掌心。', { rel: { qing: -7, du: 8 }, silver: 45 }),
    ],
    [
      route('pinger_protect_books', '先把门关严', '不碰她的银箱，她才肯把账递过来', '你闩好门，又把窗下的人影赶走。瓶儿这才从箱底取出账本：“你先看这个。”', { rel: { qing: 22, yu: 9 }, secrets: ['pinger_funds'], flags: ['pinger_route'] }),
      route('pinger_take_cash', '拿八十两救急', '银子够用了，这扇门却冷下去', '你取走八十两。瓶儿低头理好空出来的那格：“原来你急的是这个。”', { rel: { qing: -12, du: 12 }, silver: 80 }),
    ],
    [
      route('pinger_protect_public', '替她应下质问', '这笔账算在你身上，她便不用独自站出去', '你把众人的问话拦到自己身上。帘后那只攥紧的手，总算松开了。', { rel: { qing: 22, yu: 10, du: -6 }, house: 4, flags: ['protected_pinger'] }, 'pinger_route', '她还没把自己的账交到你手上。'),
      route('pinger_blame', '叫她自己回话', '院里暂时安静，她回去便会换锁', '瓶儿走出来，把来路一笔一笔说完。回房时，她让丫鬟换了把新锁。', { rel: { qing: -14, du: 15 }, repute: 1, flags: ['pinger_exposed'] }),
    ],
    [
      route('pinger_keep_secret', '告诉她账没动', '她听见这句，才肯再说一条货路', '你说那本账还在原处。瓶儿摸了摸锁扣：“我知道。若动过，线头不会这样。”', { rel: { qing: 15, yu: 11, du: -8 }, secrets: ['merchant_route'] }, 'protected_pinger', '你还没在人前替她挡过一次。'),
      route('pinger_sit_quiet', '陪她吃盏茶', '不问银箱，先把这一盏喝完', '你没提钱。瓶儿把茶续满，又把点心往你这边挪了挪。', { rel: { qing: 12, yu: 8, du: -6 } }),
    ],
    [
      route('pinger_name_source', '货路写她名字', '入账时写明她这一份，不叫旁人吞掉', '你在货单来处写下瓶儿的名字。她看了两遍，才抬起头：“这回不是把我的钱，写成官人自己的脸面？”', { rel: { qing: 17, yu: 8, du: -10 }, repute: 1 }, 'protected_pinger', '先前她的账出了事，你没替她说过话。'),
      route('pinger_spend_on_pan', '拿她的钱做脸', '金莲高兴了，瓶儿回屋就换锁', '金莲收了新首饰，笑得明艳。瓶儿也跟着笑，散席后却叫人把箱锁换了。', { rel: { qing: -18, du: 20 }, silver: -30, flags: ['pinger_exposed'] }),
    ],
    [
      route('pinger_share_chest', '把催账带来同算', '你的烂账也放进她的箱子，从此一起担', '瓶儿打开箱笼，把你那本烂账压在自己的账上：“都拿来吧。今夜算不完，明日接着算。”', { rel: { qing: 20, yu: 9, du: -8 }, silver: 70, flags: ['pinger_same_chest'] }, 'protected_pinger', '你还没让她信过，你会先护住她。'),
      route('pinger_return_key', '把钥匙还她', '不再碰那只箱子，听她自己说留不留你', '你把钥匙递过去。瓶儿没接，只把你的手合上：“先放着。今夜别说账。”', { rel: { qing: 13, yu: 12, du: -6 } }),
    ],
  ],
});

export const BANQUET_CHOICES = Object.freeze([
  route('banquet_honor_yue', '把第一杯放到月娘手边', '先让正堂坐稳；另外两个人会看清你的偏向', '你没有高声敬酒，只把第一杯放到月娘手边。她看了你一眼，才端起来：“这杯我替正堂接。官人后头若再倒偏了，可别怪我当席放下。”金莲转着自己的空杯，笑意薄薄的；瓶儿把钥匙往袖中又收了一寸。', { relAll: { wu_yueniang: { qing: 16, du: -14 }, pan_jinlian: { du: 8 }, li_pinger: { qing: 4 } }, house: 10 }),
  route('banquet_toast_pan', '越过桌面先碰金莲的杯', '她等的就是这一下；另两双眼睛也不会错过', '你的杯沿先碰上金莲那只。她没喝，只用指尖抵着杯脚，越过酒光看你：“席上都看着呢。官人这一下，是敬我，还是又想拿一杯酒哄过去？”月娘把筷子搁平；瓶儿垂眼摸了摸袖中的钥匙。', { relAll: { pan_jinlian: { qing: 17, yu: 12, du: -15 }, wu_yueniang: { du: 10 }, li_pinger: { du: 7 } }, exposure: 5, flags: ['kept_pan_word'] }),
  route('banquet_protect_pinger', '替瓶儿接下那句盘问', '当着满席人的面，把她从银箱后面请出来', '“她的箱子，轮不到旁人问。”你截住那句话，把瓶儿面前的酒重新斟满。她藏在袖里的手终于松开，却没有立刻端杯，只轻声问你：“这句到了明早，也还算么？”金莲挑了挑眉；月娘等着你的下一句话。', { relAll: { li_pinger: { qing: 18, du: -12 }, wu_yueniang: { qing: 4 }, pan_jinlian: { du: 8 } }, repute: 1, flags: ['protected_pinger'] }),
  route('banquet_balance', '把三杯推到同一条线上', '承认三个人都在这张桌上，不再许人人第一', '你亲手斟满三杯，又将杯脚推到同一条线上。月娘先开口：“公账照旧。”金莲接着笑：“去处说真。”瓶儿按住自己的杯：“钥匙仍归我。”三个人各说一条，才一起端起酒。杯沿相碰的那一声很轻，满席却忽然没人敢再说闲话。', { relAll: { wu_yueniang: { qing: 8, du: -8 }, pan_jinlian: { qing: 8, du: -8 }, li_pinger: { qing: 8, du: -8 } }, house: 6, flags: ['banquet_balanced'] }),
]);

export const SCENES = Object.freeze({
  yue_prelude: {
    id: 'yue_prelude', heroine: 'wu_yueniang', participants: ['wu_yueniang'], tier: 'prelude',
    title: '账页压在床边', asset: 'cg/yue/prelude',
    body: '月娘将最后一页账压在床边，抬手替你拂去肩头一粒墨屑：“白日里说得那样好听，到了我这里，倒只会看灯？”她没有催，只将身边的位置又让出一点。你坐下时，她的衣袖擦过你的手背，却没有收回。',
  },
  yue_explicit: {
    id: 'yue_explicit', heroine: 'wu_yueniang', participants: ['wu_yueniang'], tier: 'explicit',
    title: '正堂今夜不落锁', asset: 'cg/yue/explicit',
    body: '月娘将公中的钥匙一枚枚放好，最后那枚却压进你掌心。你刚要合手，她的指尖便跟着陷进来。簪冠卸下，长发落过肩头，她贴近你耳边，声音仍稳：“今夜不问账。可你明早醒来，别又只认得钥匙，不认得人。”',
  },
  pan_prelude: {
    id: 'pan_prelude', heroine: 'pan_jinlian', participants: ['pan_jinlian'], tier: 'prelude',
    title: '酒还在她唇边', asset: 'cg/pan/prelude',
    body: '金莲含着那口酒不咽，手里的扇子却先挑开了你的衣领。等你伸手去夺，她才偏头避开，笑得又近又慢：“白日里那样会选，到了我的门里，怎么连留不留都要我教？”',
  },
  pan_explicit: {
    id: 'pan_explicit', heroine: 'pan_jinlian', participants: ['pan_jinlian'], tier: 'explicit',
    title: '花园门闩落了', asset: 'cg/pan/explicit',
    body: '门闩刚落，金莲便勾住你的衣领，将你拉回灯影里。席上欠她的那杯酒，她偏要你就着她的手一口口还。门外有人走近，又知趣地远去。她贴着你笑：“这回总没有第二扇门，等着官人去说同一句话了吧？”',
  },
  pinger_prelude: {
    id: 'pinger_prelude', heroine: 'li_pinger', participants: ['li_pinger'], tier: 'prelude',
    title: '钥匙硌在掌心', asset: 'cg/pinger/prelude',
    body: '瓶儿把钥匙放进你掌心，却用两只手一起压住。沉香从她袖口慢慢漫出来。她没有看箱笼，只看着你的眼睛：“先答应我，今夜这屋里说的话，不拿到明日换谁的笑。”',
  },
  pinger_explicit: {
    id: 'pinger_explicit', heroine: 'li_pinger', participants: ['li_pinger'], tier: 'explicit',
    title: '沉香过了更漏', asset: 'cg/pinger/explicit',
    body: '瓶儿侧耳听了半晌，确认门外再没有脚步，才解开缠在衣带上的钥匙。你伸手时，她先躲了一下，随后却将你的手牵回来，按在自己腕上。箱笼今夜没有上锁；更漏响过两次，她仍没有松开。',
  },
  banquet_conflict: {
    id: 'banquet_conflict', heroine: null, participants: [], tier: 'public',
    title: '三杯在等一句真话', asset: 'cg/group/banquet_conflict',
    body: '月娘的手压着总账，金莲用指尖慢慢转杯，瓶儿把钥匙拢进袖里。酒香浮在桌面，筷子声却全停了。你接下来把哪只杯推近、把哪句话说破，今晚就会有哪一扇门先开。',
  },
  inner_court_accord: {
    id: 'inner_court_accord', heroine: null,
    participants: ['wu_yueniang', 'pan_jinlian', 'li_pinger'], tier: 'ensemble',
    title: '三院同守一盏灯', asset: 'cg/group/inner_court_accord',
    body: '总账、口供和货单在长案上接成一条线。月娘合数，金莲拆谎，瓶儿用自己的钥匙开最后一只货箱。门外那笔债终于被拦在门槛外。月娘揉了揉发酸的手腕，金莲顺手替她拔下松动的簪子；瓶儿把热酒重新温上。公事已经办完，三个人却谁也没有起身。',
  },
  inner_court_afterglow: {
    id: 'inner_court_afterglow', heroine: null,
    participants: ['wu_yueniang', 'pan_jinlian', 'li_pinger'], tier: 'ensemble-intimate',
    title: '纱帐里没有先后', asset: 'cg/group/inner_court_afterglow',
    body: '门闩落下，灯芯只留一半。月娘的长发散在肩头，金莲替她拆下最后一枚簪，又把流苏绕到你腕上；瓶儿将钥匙搁在枕畔，手却越过它握住你。酒意、沉香和三个人不同的发香混在纱帐里。今晚没有谁被许成唯一，也没有谁被留在门外。',
  },
});

export const NIGHT_TEXT = Object.freeze({
  leave: { label: '替她拢好衣襟', hint: '停在她愿意的位置，门不会因此关死' },
  talk: { label: '把茶喝完再走', hint: '今晚不往前，也别让没说完的话凉掉' },
  prelude: { label: '朝她再近一步', hint: '她若不躲，这一页便会收入场景册' },
  explicit: { label: '亲手落下门闩', hint: '这一夜会留下回声，另两处院门也会听见' },
});

export const NIGHT_OUTCOMES = Object.freeze({
  wu_yueniang: Object.freeze({
    leave: '你替月娘拢好衣襟，将最后一页账压在她手边。她没有留你，只在你起身时说：“明日别叫我等第二遍。”',
    talk: '更漏过了一声，你仍挨着月娘坐着。她将公账合上，终于把手覆到你手背上：“这一盏喝完，再说旁的。”',
  }),
  pan_jinlian: Object.freeze({
    leave: '你将扇子放回金莲膝上，没有借着酒意再逼近。她挑眉看你：“倒真会忍。”嘴上虽不饶人，门却一直开到你走远。',
    talk: '酒凉了，金莲便把杯中剩下的倒进你那盏。她支着下巴听你说完，末了只问：“这些话，明日还算不算？”',
  }),
  li_pinger: Object.freeze({
    leave: '你没有碰那把钥匙，只替瓶儿合好窗缝。她送你到门边，手扶着门框：“下次来，先叫我一声。我好知道不是催账的人。”',
    talk: '茶续到第三回，瓶儿终于不再看门外。她把点心掰成两半，一半放到你掌心：“吃完再走。今晚先别提箱子。”',
  }),
});

export const ENDINGS = Object.freeze({
  exclusive: { title: '一院灯深', tag: '只留一盏灯，也要把这一盏守到天明', text: '另外两处院门已经落闩，只有她还坐在灯下等你。桌上不再摆三只杯，所有没说完的话、没还清的情，都收进这一间屋里。' },
  balanced: { title: '三院同灯', tag: '她们仍会争，却不再靠你的谎话共处', text: '晨光漫进正堂，四盏茶仍在同一张桌上。月娘翻开总账，金莲夺走你手里半盏茶，瓶儿把新货单压到你膝边。昨夜没有让谁消失，也没让谁忽然变得温顺。她们仍会争、会问、会来敲你的门——只是从今日起，这座宅子的风月，不再靠一句“你是唯一”维持。' },
  intrigue: {
    title: '人情替你开了门',
    tag: '拿风月办事，也会被风月记账',
    texts: {
      clean: '催账人走了，名帖也收回袖里。外头只知道西门府把事办成，却还不知道你借了谁的耳朵、谁的笑、谁的一夜灯。',
      watched: '催账人走了，桌上却还摊着不该见光的名帖。院里有人替你添酒，也有人回房换锁。你赢下这笔账，却没能把价码藏住。',
      burned: '催账人终于走了。整条街也都知道，西门大官人的情话、秘密与枕边人，各自值多少银子。下一个来敲门的人，开价会比今天高。',
    },
  },
  unstable: {
    title: '灯一盏盏灭了',
    tag: '六日里什么都想要，最后便没人肯替你留门',
    texts: {
      no_scene: '{name}的灯亮到三更。你在廊下站了很久，到底没推开那扇门。她等的不是一步，是你敢不敢把白日说过的话带进夜里。',
      second_too_close: '两处院门都替你留着灯。留灯的人也都记得，你身上还带着另一间屋的酒香。谁都没有吵，门闩却在同一刻落下。',
      broke_word: '席上那句好听话，三个人都记得。你只记得自己当时说得漂亮。今夜三处门闩一扇比一扇落得早，连廊下的风都没地方去。',
      not_enough_power: '秘密递出去了，门却没有替你打开。明日催账人还会来；更难还的是，院里每个人都知道你拿谁的话换过路。',
      spread_thin: '六日里你在每一处灯下都坐过，却没有在任何一个人开口时真正停下来。更漏将尽，廊下只剩你的脚步声。',
    },
  },
});
