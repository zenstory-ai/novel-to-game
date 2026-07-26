// 《风月总账》设计数据。成人节点只允许 HEROINE_IDS 中的三名成年角色。

export const HEROINE_IDS = Object.freeze(['wu_yueniang', 'pan_jinlian', 'li_pinger']);

export const HEROINES = Object.freeze({
  wu_yueniang: {
    id: 'wu_yueniang', short: '月娘', name: '吴月娘', house: '正堂', glyph: '正',
    portrait: 'heroine/yue', close: 'heroine/yue/close', shape: '方签',
    want: '名分、秩序、公开尊重', gives: '家宅背书与正堂裁决',
    voice: '她不抬嗓门。账册一合，谁都知道这话到头了。',
    colors: ['#203b3a', '#b6995f'],
  },
  pan_jinlian: {
    id: 'pan_jinlian', short: '金莲', name: '潘金莲', house: '花园角门', glyph: '扇',
    portrait: 'heroine/pan', close: 'heroine/pan/close', shape: '斜签',
    want: '被看见、被优先、能插手局势', gives: '尖消息与敢出手的同谋',
    voice: '她的话又快又热。你若躲，她就追到人前问。',
    colors: ['#7f231f', '#c88b69'],
  },
  li_pinger: {
    id: 'li_pinger', short: '瓶儿', name: '李瓶儿', house: '瓶儿私院', glyph: '匣',
    portrait: 'heroine/pinger', close: 'heroine/pinger/close', shape: '圆签',
    want: '安全、保护、情感确定', gives: '银钱、货路与一处私人依靠',
    voice: '她说话软。说到钱和安危，一字也不绕。',
    colors: ['#8d6a32', '#ead9b4'],
  },
});

export const DAY_NAMES = ['正堂起账', '药材被扣', '掌柜偷货', '门外有人', '中秋宴', '风月总账'];

export const DAY_PRESSURE = [
  '公中短了五十两。月娘在正堂等你一句话，金莲端着酒在旁边笑。',
  '生药铺的货被卡在城门。交银，找官面，或拿一条真消息去说话。',
  '掌柜手脚不净。你若只会砸钱，他明日还敢伸手。',
  '昨夜的门响过几次。宅里没人明说，人人都知道你去了哪里。',
  '中秋开席。私下说过的话，今晚都要摆到桌面上。',
  '外头又来追账，你胸口也发紧。最后一夜，谁肯与你站在一处？',
];

export const DAY_ACTIONS = Object.freeze({
  ledger: { id: 'ledger', label: '理账', glyph: '理', description: '拿银子，也看清谁在账上动手。' },
  office: { id: 'office', label: '办差', glyph: '办', description: '用官势、银钱或秘密压下眼前的事。' },
  listen: { id: 'listen', label: '探话', glyph: '探', description: '找一条有来源的消息。消息也会留下经手人。' },
  banquet: { id: 'banquet', label: '备宴', glyph: '宴', description: '花银子换家声，也为中秋拿主动。' },
});

export const OPENING_CHOICES = Object.freeze([
  { id: 'respect_yue', label: '让月娘主账', hint: '给正堂体面，也把这事交给她', text: '你把公账推到月娘面前。她只说一句：“这才像一家人说话。”' },
  { id: 'tease_pan', label: '接金莲的酒', hint: '先给她脸，月娘会记得', text: '你接了金莲的杯。她当着正堂笑：“官人说话可要算数。”' },
]);

const route = (id, label, hint, text, effects = {}, condition = null, locked = '') =>
  Object.freeze({ id, label, hint, text, effects, condition, locked });

export const ROUTE_CHOICES = Object.freeze({
  wu_yueniang: [
    [
      route('yue_share_shortfall', '把缺口说清', '情更近，家宅更稳', '“少多少，就说多少。”月娘把钥匙推来半寸。', { rel: { qing: 18 }, house: 5, flags: ['yue_respected'] }),
      route('yue_bypass', '叫她先垫上', '眼前省事，她会记这笔', '月娘把钥匙收回袖里：“正堂不是替你遮丑的。”', { rel: { du: 14, qing: -6 }, house: -7 }),
    ],
    [
      route('yue_show_accounts', '先给她看账', '兑现尊重，开共治线', '她逐页看完，抬手给你留了座：“坐。一起算。”', { rel: { qing: 17, yu: 5 }, repute: 1, flags: ['yue_informed'] }),
      route('yue_hide_accounts', '只说已经办妥', '不让她碰外账', '“办妥了？”她合上空白账册，“那就不必来问我。”', { rel: { du: 12, qing: -5 }, exposure: 6 }),
    ],
    [
      route('yue_keep_word', '照她的话省一桌', '守住前约，亲密门槛', '你真撤了一桌闲酒。月娘看了半晌：“你也有说到做到的时候。”', { rel: { qing: 22, yu: 8 }, silver: 35, house: 6, flags: ['kept_yue_word'] }, 'yue_respected', '你还没给过她一个能守的承诺。'),
      route('yue_public_spend', '偏要再摆一桌', '家声涨，正堂翻脸', '月娘不拦，只把公中钥匙拿走：“你的热闹，自己付。”', { rel: { du: 18, qing: -8 }, silver: -45, repute: 1, house: -8, flags: ['broken_yue_word'] }),
    ],
    [
      route('yue_ask_backing', '请她替你压事', '关系换家宅背书', '“我可以替你说一次。”她把“一次”两个字说得很清楚。', { rel: { qing: 14, yu: 6, du: -8 }, house: 8, secrets: ['yue_backing'] }, 'yue_informed', '她还没见过你的真账。'),
      route('yue_soften', '给她斟茶', '少谈账，先哄人', '她接了茶，没有接你的漂亮话。手却没再把杯子推开。', { rel: { qing: 9, yu: 13, du: -6 } }),
    ],
    [
      route('yue_offer_seat', '请她主中秋席', '公开给足正妻体面', '月娘看一眼席面：“既叫我主，就别临席变卦。”', { rel: { qing: 14, yu: 6, du: -10 }, repute: 1 }),
      route('yue_private_only', '只说夜里再谈', '欲升，公开体面受损', '“夜里是夜里，席上是席上。”她没有替你混过去。', { rel: { yu: 14, du: 9 }, house: -4 }),
    ],
    [
      route('yue_share_keys', '把最后的钥匙给她', '理解型结果：共掌一宅', '你把钥匙放到她掌心。她却分一半回来：“两个人拿，才压得住。”', { rel: { qing: 18, yu: 8, du: -8 }, house: 10, flags: ['yue_co_rule'] }, 'kept_yue_word', '你答应过她的事还没做到。'),
      route('yue_last_tea', '陪她喝完这盏', '稳住关系，不作新诺', '更漏过一声。月娘道：“今晚不谈旁人。”', { rel: { qing: 12, yu: 10, du: -6 } }),
    ],
  ],
  pan_jinlian: [
    [
      route('pan_take_cup', '接她的酒', '她要你当众记住这杯', '金莲把杯沿一转：“酒接了，话也接了？”', { rel: { qing: 12, yu: 20, du: -4 }, flags: ['pan_promised'] }),
      route('pan_hush', '叫她收声', '家宅稳，她当场结梁子', '她把酒一饮而尽：“好。官人这句话，我替你记牢。”', { rel: { qing: -5, yu: 8, du: 16 }, house: 4 }),
    ],
    [
      route('pan_take_clue', '让她把话说完', '得掌柜偷货线索', '她凑近报出一个名字：“明日查他袖口。别说是我教的。”', { rel: { qing: 16, yu: 10 }, secrets: ['shop_fraud'], flags: ['pan_involved'] }),
      route('pan_only_flirt', '先不谈铺子', '欲升，错过快线', '“只肯听好听的？”她用扇骨点了点你的手。', { rel: { qing: 7, yu: 16 } }),
    ],
    [
      route('pan_bring_confrontation', '带她去对质', '她参与局势，家宅更乱', '金莲当面报出赃货数，掌柜腿先软了。她回头只问：“这回算我有用？”', { rel: { qing: 20, yu: 12 }, power: 1, house: -5 }, 'pan_involved', '你没有让她碰过这桩事。'),
      route('pan_keep_out', '不让她碰外头事', '她不服，仍给你留一条退路', '金莲把扇子一收：“不用我？那就看看你自己办成什么样。”', { rel: { qing: 6, yu: 10, du: 10 } }),
    ],
    [
      route('pan_answer_door', '开门让她进', '正面接住她的妒', '她进门先看桌上另一只茶盏：“人走了，味还在。”', { rel: { qing: 13, yu: 13, du: -14 }, secrets: ['pan_rumor'] }),
      route('pan_make_wait', '让她在门外等', '欲还在，妒会变成公开发难', '门外静了一阵。扇柄在门框上敲了三下。', { rel: { yu: 6, du: 18 } }),
    ],
    [
      route('pan_keep_toast', '第一杯先敬她', '兑现公开承诺', '金莲接杯时没看酒，只盯着你：“这回没躲。”', { rel: { qing: 18, yu: 12, du: -12 }, flags: ['kept_pan_word'] }, 'pan_promised', '你没当众答应过这杯。'),
      route('pan_call_bluff', '让她别闹席面', '正堂稳，她当众翻脸', '她笑着把杯一放：“席面要体面，官人的话倒不要脸面？”', { rel: { qing: -8, du: 22 }, house: -4, flags: ['broken_pan_word'] }),
    ],
    [
      route('pan_choose_openly', '当众说今夜去她那', '理解型结果：火里同谋', '金莲不再笑。她伸手替你理好衣领：“这句才算数。”', { rel: { qing: 18, yu: 15, du: -10 }, exposure: 7, flags: ['pan_open_choice'] }, 'kept_pan_word', '你许过的话还没当众兑现。'),
      route('pan_no_more_words', '这回不许空口', '稳住她，不再乱许', '“那就少说。”她把你的手按在杯边，“做给我看。”', { rel: { qing: 12, yu: 12, du: -8 } }),
    ],
  ],
  li_pinger: [
    [
      route('pinger_settle_room', '先问她住得安不安', '她记住你先问人', '瓶儿把箱笼钥匙按在掌下：“住处安稳，心才敢放。”', { rel: { qing: 15, yu: 7 } }),
      route('pinger_ask_money', '先问她带了多少', '得银，她把心收回去', '她报了数，一文不少。钥匙却没离开掌心。', { rel: { qing: -7, du: 8 }, silver: 45 }),
    ],
    [
      route('pinger_protect_books', '先替她护住账', '开安全线与货路秘密', '你没碰银箱，先把门关严。瓶儿这才把账本递来。', { rel: { qing: 22, yu: 9 }, secrets: ['pinger_funds'], flags: ['pinger_route'] }),
      route('pinger_take_cash', '先拿八十两救急', '银到手，她看清你先要什么', '银子到手。瓶儿轻声道：“原来你先问的，还是箱子。”', { rel: { qing: -12, du: 12 }, silver: 80 }),
    ],
    [
      route('pinger_protect_public', '当众替她挡话', '兑现保护，明确场景门槛', '你把质问接到自己身上。瓶儿在帘后握紧的手慢慢松了。', { rel: { qing: 22, yu: 10, du: -6 }, house: 4, flags: ['protected_pinger'] }, 'pinger_route', '她还没把账托给你。'),
      route('pinger_blame', '叫她自己解释', '家宅暂稳，她会关箱', '“好。”瓶儿自己把话说清，也把钥匙收了回去。', { rel: { qing: -14, du: 15 }, repute: 1, flags: ['pinger_exposed'] }),
    ],
    [
      route('pinger_keep_secret', '告诉她账还安全', '信任与货路继续', '她摸了摸锁扣：“你没拿它换人情，我知道。”', { rel: { qing: 15, yu: 11, du: -8 }, secrets: ['merchant_route'] }, 'protected_pinger', '你没有在众人面前护过她。'),
      route('pinger_sit_quiet', '陪她坐一会', '不碰账，先把人留住', '你没问银箱。瓶儿把茶续满，肩头终于松下来。', { rel: { qing: 12, yu: 8, du: -6 } }),
    ],
    [
      route('pinger_name_source', '席上替她说明货路', '公开保护她的财', '你把货路说成两个人的安排。瓶儿终于敢在席上抬头。', { rel: { qing: 17, yu: 8, du: -10 }, repute: 1 }, 'protected_pinger', '你没有护过她的账。'),
      route('pinger_spend_on_pan', '拿她的钱给金莲做脸', '银与欲上涨，瓶儿关门', '金莲笑了。瓶儿也笑，回屋便换了锁。', { rel: { qing: -18, du: 20 }, silver: -30, flags: ['pinger_exposed'] }),
    ],
    [
      route('pinger_share_chest', '把追账交给她同办', '理解型结果：同箱共命', '瓶儿打开箱笼，也把你那本烂账放进去：“这回一起算。”', { rel: { qing: 20, yu: 9, du: -8 }, silver: 70, flags: ['pinger_same_chest'] }, 'protected_pinger', '你还没有证明会先护住她。'),
      route('pinger_return_key', '把钥匙还给她', '不取她的财，关系稳住', '她没有接：“放你手里。今夜只谈我们。”', { rel: { qing: 13, yu: 12, du: -6 } }),
    ],
  ],
});

export const BANQUET_CHOICES = Object.freeze([
  route('banquet_honor_yue', '请月娘主席', '稳家宅，兑现正堂体面', '月娘按住公账，先把乱话压回桌面。', { relAll: { wu_yueniang: { qing: 16, du: -14 }, pan_jinlian: { du: 8 }, li_pinger: { qing: 4 } }, house: 10 }),
  route('banquet_toast_pan', '第一杯给金莲', '她得脸，另两人都看见', '金莲举杯不饮，先问你：“今晚也算数？”', { relAll: { pan_jinlian: { qing: 17, yu: 12, du: -15 }, wu_yueniang: { du: 10 }, li_pinger: { du: 7 } }, exposure: 5, flags: ['kept_pan_word'] }),
  route('banquet_protect_pinger', '替瓶儿护住账', '公开说明她不是钱袋', '你把追问挡下。瓶儿手里的钥匙终于不再发抖。', { relAll: { li_pinger: { qing: 18, du: -12 }, wu_yueniang: { qing: 4 }, pan_jinlian: { du: 8 } }, repute: 1, flags: ['protected_pinger'] }),
  route('banquet_balance', '三杯一处倒满', '要前约都没破，换平衡', '你不许任何人压过别人。三只杯都满了，三双眼睛还在等下文。', { relAll: { wu_yueniang: { qing: 8, du: -8 }, pan_jinlian: { qing: 8, du: -8 }, li_pinger: { qing: 8, du: -8 } }, house: 6, flags: ['banquet_balanced'] }),
]);

export const SCENES = Object.freeze({
  yue_prelude: {
    id: 'yue_prelude', heroine: 'wu_yueniang', participants: ['wu_yueniang'], tier: 'prelude',
    title: '钥匙未收', asset: 'cg/yue/prelude',
    body: '月娘把公账推到床脚，没有起身。她先问你答应的事做到了没有。听见肯定，才伸手替你解开外袍扣。',
  },
  yue_explicit: {
    id: 'yue_explicit', heroine: 'wu_yueniang', participants: ['wu_yueniang'], tier: 'explicit',
    title: '正堂熄灯', asset: 'cg/yue/explicit',
    body: '她把钥匙攥在你们相扣的手里。床帐落下后，仍不许你拿漂亮话糊弄；每一次靠近，都要你当面应她。',
  },
  pan_prelude: {
    id: 'pan_prelude', heroine: 'pan_jinlian', participants: ['pan_jinlian'], tier: 'prelude',
    title: '杯沿发热', asset: 'cg/pan/prelude',
    body: '金莲用扇骨挑开你的衣襟，又停在那里：“今晚还走不走？”她要先听一句真话。',
  },
  pan_explicit: {
    id: 'pan_explicit', heroine: 'pan_jinlian', participants: ['pan_jinlian'], tier: 'explicit',
    title: '花园门闩', asset: 'cg/pan/explicit',
    body: '门闩落下，她便不再让你躲。方才席上的狠话被她一件件讨回，连门外脚步停过几次都听得清楚。',
  },
  pinger_prelude: {
    id: 'pinger_prelude', heroine: 'li_pinger', participants: ['li_pinger'], tier: 'prelude',
    title: '钥匙在掌心', asset: 'cg/pinger/prelude',
    body: '瓶儿把钥匙放在你掌心，却按住你的手：“先答应我，不拿这屋里的话去换外头的好处。”',
  },
  pinger_explicit: {
    id: 'pinger_explicit', heroine: 'li_pinger', participants: ['li_pinger'], tier: 'explicit',
    title: '沉香未散', asset: 'cg/pinger/explicit',
    body: '她确认门外无人，才把最后一点防备放下。箱笼没有再上锁；更漏响时，她仍抓着你的手不肯松。',
  },
  banquet_conflict: {
    id: 'banquet_conflict', heroine: null, participants: [], tier: 'public',
    title: '三杯都满', asset: 'cg/group/banquet_conflict',
    body: '月娘压着公账，金莲举杯追问，瓶儿握着钥匙。私下说过的话，今夜都摆到了席面上。',
  },
});

export const NIGHT_TEXT = Object.freeze({
  leave: { label: '到此为止', hint: '尊重边界，今晚离开' },
  talk: { label: '再陪她一会', hint: '稳稳拉近，不解锁场景' },
  prelude: { label: '让她再近些', hint: '进入成人前奏；可随时停下' },
  explicit: { label: '今晚留下', hint: '进入明确 18+ 场景并改变次晨局势' },
});

export const ENDINGS = Object.freeze({
  exclusive: { title: '一院灯深', tag: '专一深线', text: '你把最热的一盏灯留在一处。其余院门冷了些，至少这段关系不是分出来的碎银。' },
  balanced: { title: '三门未关', tag: '平衡后宫', text: '三个人都肯留门，也都知道你还欠话。宅子暂时稳住，明日的功夫比今晚更多。' },
  intrigue: { title: '人情能办事', tag: '权谋风月', text: '你用关系里的秘密压住了外账，钱和势都在手。经手的人也都在，她们会来收下一笔。' },
  unstable: { title: '宅门未稳', tag: '未成局', text: '你尝过几处热，也留下几扇冷门。不是谁教训了你，是答应过的话还没接住。' },
});
