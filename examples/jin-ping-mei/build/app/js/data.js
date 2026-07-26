// 《风月总账》设计数据。成人节点只允许 HEROINE_IDS 中的三名成年角色。

export const HEROINE_IDS = Object.freeze(['wu_yueniang', 'pan_jinlian', 'li_pinger']);

export const HEROINES = Object.freeze({
  wu_yueniang: {
    id: 'wu_yueniang', short: '月娘', name: '吴月娘', house: '正堂', glyph: '正',
    portrait: 'heroine/yue', close: 'heroine/yue/close', shape: '方签',
    want: '正堂的话不能只在人前好听', gives: '钥匙、账本，也肯替你挡门外的事',
    voice: '月娘把账册翻到折角那页，指尖按着不动：“官人，白日欠的话，先在这里说清。”',
    colors: ['#203b3a', '#b6995f'],
  },
  pan_jinlian: {
    id: 'pan_jinlian', short: '金莲', name: '潘金莲', house: '花园角门', glyph: '扇',
    portrait: 'heroine/pan', close: 'heroine/pan/close', shape: '斜签',
    want: '你当面说过的话，转身也得认', gives: '耳边的消息，还有一副不怕事的胆子',
    voice: '金莲拿扇骨敲了敲桌沿：“官人进了门，怎么倒不会说话了？”',
    colors: ['#7f231f', '#c88b69'],
  },
  li_pinger: {
    id: 'li_pinger', short: '瓶儿', name: '李瓶儿', house: '瓶儿私院', glyph: '匣',
    portrait: 'heroine/pinger', close: 'heroine/pinger/close', shape: '圆签',
    want: '先护住她这个人，再说箱里的钱', gives: '银钱、货路，也有一间肯留你的屋',
    voice: '瓶儿把茶往你手边推了推：“外头的事我不怕。只怕这屋里的话，也叫人拿去做买卖。”',
    colors: ['#8d6a32', '#ead9b4'],
  },
});

export const HOUSEHOLD_IDS = Object.freeze(['meng_yulou', 'sun_xuee', 'li_jiaoer']);

export const HOUSEHOLD = Object.freeze({
  meng_yulou: {
    id: 'meng_yulou', name: '孟玉楼', short: '玉楼', house: '卷棚后间', adult: true,
    portrait: 'household/meng', glyph: '曲',
    role: '会圆场，也会看人下菜',
    voice: '玉楼总是先笑。等旁人也跟着笑了，她才把最要紧的那句话递过来。',
  },
  sun_xuee: {
    id: 'sun_xuee', name: '孙雪娥', short: '雪娥', house: '灶上', adult: true,
    portrait: 'household/xuee', glyph: '灶',
    role: '管着一宅人的嘴，也听尽一宅人的闲话',
    voice: '雪娥在灶上做事，锅盖一掀就开口，懒得替谁把难听话裹糖。',
  },
  li_jiaoer: {
    id: 'li_jiaoer', name: '李娇儿', short: '娇儿', house: '西厢', adult: true,
    portrait: 'household/jiaoer', glyph: '匣',
    role: '认得城里的门路，更认得银子的分量',
    voice: '娇儿说起银钱从不脸红。先把价码摆明，余下的情分才慢慢算。',
  },
});

export const DAY_NAMES = ['正堂起账', '药材扣在城门', '后仓少了货', '催账人上门', '中秋开席', '最后一笔账'];

export const DAY_PRESSURE = [
  '公中少了五十两。月娘坐在账前等你开口，金莲偏在这时把酒递到手边。',
  '生药铺的车堵在城门。三十两能开门，官面也能开门，若有人肯替你递句话更好。',
  '后仓少了两箱货。掌柜还在前厅赔笑，灶上的雪娥已经骂了半日。',
  '催账人坐进前厅，茶换了两回还不走。昨夜哪扇门响过，他也听了个大概。',
  '中秋席已经摆好。你私下许过谁，等第一杯酒端起来便瞒不住了。',
  '最后一拨债主堵在门外。今夜过后，这宅里还有谁愿意跟你一起见他们？',
];

export const DAY_ACTIONS = Object.freeze({
  ledger: { id: 'ledger', label: '翻账', glyph: '理', description: '先把银子找回来，顺手看看是谁动了账。' },
  office: { id: 'office', label: '走官面', glyph: '办', description: '递银子、递人情，总得递一样进去。' },
  listen: { id: 'listen', label: '问口风', glyph: '探', description: '问来的话能救急，传话的人也会记着你。' },
  banquet: { id: 'banquet', label: '整席面', glyph: '宴', description: '银子花在桌上，开口时才有人肯听。' },
});

export const OPENING_CHOICES = Object.freeze([
  { id: 'respect_yue', label: '账交给月娘', hint: '她来查缺口；金莲这杯酒要凉了', text: '你把账簿推到月娘面前。她这才抬眼：“早交给我，何必叫一屋子人猜？”' },
  { id: 'tease_pan', label: '先喝金莲的酒', hint: '她得了脸；月娘会把这杯记进账里', text: '你接过酒，一口喝了。金莲笑得更近：“官人，杯底可没有后悔药。”' },
]);

const route = (id, label, hint, text, effects = {}, condition = null, locked = '') =>
  Object.freeze({ id, label, hint, text, effects, condition, locked });

const householdChoice = (id, label, hint, text, effects) =>
  Object.freeze({ id, label, hint, text, effects });

export const HOUSEHOLD_EVENTS = Object.freeze({
  2: {
    id: 'meng_namecard', actor: 'meng_yulou', title: '玉楼手里有张名帖',
    text: '玉楼倚在门边，指间夹着一张名帖：“城门那位马指挥使，前日还听我唱过一折。官人若肯叫我递这杯茶，货车兴许就动了。”',
    choices: [
      householdChoice('meng_let_speak', '让她递话', '省下银子，也欠玉楼一回', '玉楼把名帖折进袖里：“我去便是。回来时，官人别又只顾着看账。”', { power: 1, exposure: 4, secrets: ['meng_favor'], household: { id: 'meng_yulou', regard: 18 } }),
      householdChoice('meng_keep_home', '叫她别沾手', '宅里少些闲话，城门那关自己过', '玉楼把名帖搁在案上，还是笑：“成。官人自己去碰那张冷脸。”', { house: 3, household: { id: 'meng_yulou', regard: -8 } }),
    ],
  },
  3: {
    id: 'xuee_storehouse', actor: 'sun_xuee', title: '雪娥堵在后仓门口',
    text: '雪娥拎着一只空米袋，手上还沾着面：“厨房少米，铺里少货，偏偏管钥匙的那位吃得最香。你去不去看？”',
    choices: [
      householdChoice('xuee_check_storehouse', '跟她去后仓', '追回一点货，雪娥也肯认你这回', '你跟她进了后仓。雪娥踢开最里头那只箱子：“喏，老鼠还会扎绳结呢。”', { silver: 25, house: 4, secrets: ['kitchen_witness'], household: { id: 'sun_xuee', regard: 16 } }),
      householdChoice('xuee_pay_shortfall', '叫她先赔上', '眼前添些银子，灶上从此少一句好话', '雪娥把围裙一扯，铜钱拍在桌上：“拿去。今晚谁吃夹生饭，别来问我。”', { silver: 15, house: -6, household: { id: 'sun_xuee', regard: -16 } }),
    ],
  },
  4: {
    id: 'jiaoer_collector', actor: 'li_jiaoer', title: '娇儿认得门外那张脸',
    text: '娇儿抱着描金匣子坐在廊下：“外头那个姓祝，年轻时在我门前站过三夜。他如今来收你的账，价钱我倒知道。”',
    choices: [
      householdChoice('jiaoer_buy_name', '给她二十两', '她替你问底价，银子得先到手', '娇儿掂了掂银子，往袖里一收：“这就对了。情分归情分，跑路也磨鞋底。”', { silver: -20, secrets: ['collector_price'], household: { id: 'li_jiaoer', regard: 16 } }),
      householdChoice('jiaoer_take_box', '扣下她的匣子', '手里多三十两，她会另算这笔', '你伸手扣住匣子。娇儿松了手，脸上反倒没了笑：“官人收好，省得回头说我欠你。”', { silver: 30, exposure: 8, house: -4, household: { id: 'li_jiaoer', regard: -18 } }),
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
      route('yue_offer_seat', '请她坐主席', '这一席由她开口，旁人都看得见', '月娘看了眼正中的座位：“既请我坐，待会儿谁来撒娇，你都别装聋。”', { rel: { qing: 14, yu: 6, du: -10 }, repute: 1 }),
      route('yue_private_only', '等散席再说', '她肯听私话，却不会替你遮席上的难看', '月娘把杯子往前一推：“夜里有夜里的话。眼下这杯，官人先给个说法。”', { rel: { yu: 14, du: 9 }, house: -4 }),
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
      route('pan_keep_toast', '第一杯递给她', '你还她开头那杯，满桌人都看着', '金莲接过酒，先不喝，只盯着你笑：“官人今日倒没装忘。”', { rel: { qing: 18, yu: 12, du: -12 }, flags: ['kept_pan_word'] }, 'pan_promised', '你从没当着众人接过她那杯。'),
      route('pan_call_bluff', '叫她别扫兴', '席面暂且不乱，她会当桌翻你的旧话', '金莲把酒往桌上一搁：“席面要脸，官人说过的话就不要脸了？”', { rel: { qing: -8, du: 22 }, house: -4, flags: ['broken_pan_word'] }),
    ],
    [
      route('pan_choose_openly', '当席留下话', '你说今夜去她那里，谁都听得见', '金莲脸上的笑停了一瞬。她伸手替你理好衣领：“这句话，我等到现在。”', { rel: { qing: 18, yu: 15, du: -10 }, exposure: 7, flags: ['pan_open_choice'] }, 'kept_pan_word', '先把答应她的那杯酒还上。'),
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
      route('pinger_name_source', '货路算两人的', '当桌说明白，她的钱不是谁都能拿', '有人问货从哪里来，你答是和瓶儿一道办的。她抬起头，第一次没避开满桌人的眼。', { rel: { qing: 17, yu: 8, du: -10 }, repute: 1 }, 'protected_pinger', '先前她的账出了事，你没替她说过话。'),
      route('pinger_spend_on_pan', '拿她的钱做脸', '金莲高兴了，瓶儿回屋就换锁', '金莲收了新首饰，笑得明艳。瓶儿也跟着笑，散席后却叫人把箱锁换了。', { rel: { qing: -18, du: 20 }, silver: -30, flags: ['pinger_exposed'] }),
    ],
    [
      route('pinger_share_chest', '把催账带来同算', '你的烂账也放进她的箱子，从此一起担', '瓶儿打开箱笼，把你那本烂账压在自己的账上：“都拿来吧。今夜算不完，明日接着算。”', { rel: { qing: 20, yu: 9, du: -8 }, silver: 70, flags: ['pinger_same_chest'] }, 'protected_pinger', '你还没让她信过，你会先护住她。'),
      route('pinger_return_key', '把钥匙还她', '不再碰那只箱子，听她自己说留不留你', '你把钥匙递过去。瓶儿没接，只把你的手合上：“先放着。今夜别说账。”', { rel: { qing: 13, yu: 12, du: -6 } }),
    ],
  ],
});

export const BANQUET_CHOICES = Object.freeze([
  route('banquet_honor_yue', '请月娘开席', '她先坐稳正堂，金莲这杯酒要往后排', '月娘按住账簿，先叫众人吃菜。方才桌下那些小动作，一时都停了。', { relAll: { wu_yueniang: { qing: 16, du: -14 }, pan_jinlian: { du: 8 }, li_pinger: { qing: 4 } }, house: 10 }),
  route('banquet_toast_pan', '第一杯给金莲', '她等的就是这一杯，另两人也看得真切', '金莲接过杯子却不喝：“官人，今夜这句话还作不作数？”', { relAll: { pan_jinlian: { qing: 17, yu: 12, du: -15 }, wu_yueniang: { du: 10 }, li_pinger: { du: 7 } }, exposure: 5, flags: ['kept_pan_word'] }),
  route('banquet_protect_pinger', '替瓶儿挡这问', '当桌说清她的钱轮不到旁人盘问', '你截住那句追问。瓶儿把钥匙放回袖里，手不再攥着。', { relAll: { li_pinger: { qing: 18, du: -12 }, wu_yueniang: { qing: 4 }, pan_jinlian: { du: 8 } }, repute: 1, flags: ['protected_pinger'] }),
  route('banquet_balance', '三杯一同斟满', '先前没失过信，这一回才有人肯喝', '你亲手斟满三杯。月娘先看你的手，金莲看你的脸，瓶儿等着谁先端杯。', { relAll: { wu_yueniang: { qing: 8, du: -8 }, pan_jinlian: { qing: 8, du: -8 }, li_pinger: { qing: 8, du: -8 } }, house: 6, flags: ['banquet_balanced'] }),
]);

export const SCENES = Object.freeze({
  yue_prelude: {
    id: 'yue_prelude', heroine: 'wu_yueniang', participants: ['wu_yueniang'], tier: 'prelude',
    title: '钥匙未收', asset: 'cg/yue/prelude',
    body: '月娘把账簿推到床脚，仍坐着不动：“答应我的那件事呢？”你把话回清，她才抬手碰了碰你的衣扣。',
  },
  yue_explicit: {
    id: 'yue_explicit', heroine: 'wu_yueniang', participants: ['wu_yueniang'], tier: 'explicit',
    title: '正堂熄灯', asset: 'cg/yue/explicit',
    body: '月娘把钥匙压进你掌心，手却没有收回。床帐落下，她贴着你耳边问：“官人，今夜说的话，明早还认么？”',
  },
  pan_prelude: {
    id: 'pan_prelude', heroine: 'pan_jinlian', participants: ['pan_jinlian'], tier: 'prelude',
    title: '杯沿发热', asset: 'cg/pan/prelude',
    body: '金莲用扇骨挑开你的衣襟，又停住：“官人，今夜还走不走？”她盯着你的嘴，非等一个准字。',
  },
  pan_explicit: {
    id: 'pan_explicit', heroine: 'pan_jinlian', participants: ['pan_jinlian'], tier: 'explicit',
    title: '花园门闩', asset: 'cg/pan/explicit',
    body: '门闩刚落，金莲便把你推回榻边。席上欠她的那几句话，她一句一句讨；门外脚步停了又走，她只当没听见。',
  },
  pinger_prelude: {
    id: 'pinger_prelude', heroine: 'li_pinger', participants: ['li_pinger'], tier: 'prelude',
    title: '钥匙在掌心', asset: 'cg/pinger/prelude',
    body: '瓶儿把钥匙放进你掌心，又用两只手按住：“先答应我，这屋里的话，不拿到外头换人情。”',
  },
  pinger_explicit: {
    id: 'pinger_explicit', heroine: 'li_pinger', participants: ['li_pinger'], tier: 'explicit',
    title: '沉香未散', asset: 'cg/pinger/explicit',
    body: '瓶儿听了半晌门外的动静，才回身解开衣带。箱笼今夜没有上锁；更漏响时，她仍攥着你的手。',
  },
  banquet_conflict: {
    id: 'banquet_conflict', heroine: null, participants: [], tier: 'public',
    title: '三杯都满', asset: 'cg/group/banquet_conflict',
    body: '月娘的手压在账簿上，金莲端着酒等你回话，瓶儿把钥匙藏进袖里。满桌人都停了筷子。',
  },
});

export const NIGHT_TEXT = Object.freeze({
  leave: { label: '今夜就到这里', hint: '替她留着门，也替自己留一句体面' },
  talk: { label: '再坐一会儿', hint: '不催她，只把没说完的话说完' },
  prelude: { label: '等她靠近', hint: '她若点头，你便再近一步' },
  explicit: { label: '今夜不走', hint: '灯一熄，明早便有人来问' },
});

export const ENDINGS = Object.freeze({
  exclusive: { title: '一院灯深', tag: '只留一盏灯', text: '今夜只有一处院门没落闩。桌上放着两把钥匙，旁边那盏茶还冒着热气。' },
  balanced: { title: '三门未关', tag: '三处都有你的座', text: '三处院门都留着灯，也各留着一句话等你回。月娘先收走了总账，叫你明早去正堂。' },
  intrigue: { title: '人情能办事', tag: '拿风月去开门', text: '催账人终于走了，桌上还摊着几张不该见光的名帖。院里有人笑，有人已经叫丫鬟去上锁。' },
  unstable: { title: '门一扇扇关', tag: '这六日没过明白', text: '更漏将尽，廊下只剩你的脚步。你敲了两处门，都没人来开。' },
});
