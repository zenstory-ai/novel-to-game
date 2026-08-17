// 《风月总账》二十日数据。五条感情线中的人物均为成年人。

export const HEROINE_IDS = Object.freeze(['wu_yueniang', 'pan_jinlian', 'li_pinger', 'meng_yulou', 'sun_xuee']);

export const HEROINES = Object.freeze({
  wu_yueniang: { id: 'wu_yueniang', adult: true, short: '月娘', name: '吴月娘', house: '正堂', glyph: '正', portrait: 'heroine/yue', close: 'heroine/yue/close', shape: '方签', want: '公私有序，承诺落到账上', gives: '总账、决断与共同掌家的底气', voice: '月娘把账推来：“先把话写明，再谈今夜留谁。”', colors: ['#203b3a', '#b6995f'] },
  pan_jinlian: { id: 'pan_jinlian', adult: true, short: '金莲', name: '潘金莲', house: '花园角门', glyph: '扇', portrait: 'heroine/pan', close: 'heroine/pan/close', shape: '斜签', want: '偏爱可以存在，谎话不能重用', gives: '锐利口风、拆谎本事与不躲闪的热意', voice: '金莲压住杯沿：“敢选便敢认，别叫我替你圆。”', colors: ['#7f231f', '#c88b69'] },
  li_pinger: { id: 'li_pinger', adult: true, short: '瓶儿', name: '李瓶儿', house: '瓶儿私院', glyph: '匣', portrait: 'heroine/pinger', close: 'heroine/pinger/close', shape: '圆签', want: '人先被留下，银箱才可能打开', gives: '货路、周转与一处不必高声的屋子', voice: '瓶儿握着钥匙：“账能共算，去留要先说清。”', colors: ['#8d6a32', '#ead9b4'] },
  meng_yulou: { id: 'meng_yulou', adult: true, short: '玉楼', name: '孟玉楼', house: '卷棚后间', glyph: '曲', portrait: 'heroine/meng', close: 'heroine/meng/close', shape: '弧签', want: '人情有往有还，体面不是拿她垫脚', gives: '席面转圜、社会契约与替众人留台阶的从容', voice: '玉楼收起名帖：“情面借一次，回礼须当众交。”', colors: ['#4f5140', '#d1b58a'] },
  sun_xuee: { id: 'sun_xuee', adult: true, short: '雪娥', name: '孙雪娥', house: '灶上暖阁', glyph: '灶', portrait: 'heroine/xuee', close: 'heroine/xuee/close', shape: '折签', want: '劳作被看见，分配要有实据', gives: '粮火、证词与把全宅日子真正撑住的手', voice: '雪娥拍净面粉：“好话不顶柴，拿证据来。”', colors: ['#6e422d', '#d39b63'] },
});

export const HOUSEHOLD_IDS = Object.freeze(['li_jiaoer']);
export const HOUSEHOLD = Object.freeze({
  li_jiaoer: { id: 'li_jiaoer', name: '李娇儿', short: '娇儿', house: '西厢', adult: true, portrait: 'household/jiaoer', glyph: '匣', role: '把消息、人情与银钱逐项标价', voice: '娇儿扣上描金匣：“先讲价，后讲情。”' },
});

export const DAY_DEFS = Object.freeze([
  ['d01','正堂开账','公中短了五十两，五处院门都等你先认哪一本账。','账火初燃','missing_fifty','缺银去向','短银经三次拆借流入旧债。'],
  ['d02','城门扣货','药车被扣，交钱与递名帖都要留下价码。','账火初燃','gate_roster','城门名册','扣车人收的是祝家指令。'],
  ['d03','后仓断粮','空箱与空米袋同时出现，货账有人做了两层。','账火初燃','double_seal','双层封绳','仓箱封绳来自内外两批人。'],
  ['d04','西厢报价','娇儿认出债主的旧门路，只肯做一笔明买卖。','账火初燃','collector_floor','债底价','催账人的底价比票面低三成。'],
  ['d05','中秋公席','五只杯都在桌上，旧承诺第一次公开碰面。','账火初燃','toast_order','敬酒次序','有人故意把座次传给街坊。'],
  ['d06','药铺换掌','掌柜递来两本流水，要你当场定哪本作准。','人情成网','ink_batch','墨色批次','假账用的是昨夜新墨。'],
  ['d07','花园来客','陌生车夫翻墙递信，口供只肯对一人说。','人情成网','driver_phrase','车夫暗语','暗语指向南码头的空船。'],
  ['d08','灶火停半','雪娥停下一口锅，逼全宅看见少掉的工钱。','人情成网','kitchen_tally','灶上工簿','三个月柴米被重复报销。'],
  ['d09','匣中旧契','娇儿拿来旧契，赎回与借用是两个价。','人情成网','old_deed','旧契押名','契尾担保人正是现任掌柜。'],
  ['d10','莲池验言','五人沿池复述证词，谁改过一句当场可见。','人情成网','lotus_echo','莲池回话','三份口供共用同一处错字。'],
  ['d11','盐引压桌','官面要一名担责者，宅内却有五份实证。','证据合流','permit_stamp','盐引暗印','暗印来自祝家私章。'],
  ['d12','货船空返','码头只回来空船，货却在城内换了封签。','证据合流','rope_fiber','船绳纤维','新封绳取自西厢旧货。'],
  ['d13','正堂封门','月娘封账半日，逼每笔私借各归其名。','证据合流','loan_chain','私借链','五笔私借最终汇到同一柜坊。'],
  ['d14','银票折价','娇儿愿折价兑票，但要把风险写进明契。','证据合流','draft_mark','银票暗记','票号暗记能锁定幕后兑手。'],
  ['d15','堂前公审','街坊、债主与五院同堂，证据必须有人公开承担。','证据合流','witness_order','证人顺序','先证劳动账可击穿整套假账。'],
  ['d16','债主围门','对方改用人声施压，院内分工不能再含糊。','同灯结盟','crowd_pay','围门花名','围门者多是临时雇来的闲汉。'],
  ['d17','夜查柜坊','五条线索指向同一柜坊，进去的人必须互相作证。','同灯结盟','vault_slot','柜格编号','旧债本藏在七号夹层。'],
  ['d18','最后一口价','娇儿给出终局交易：买断旧债，也买断她的沉默。','同灯结盟','silence_price','封口价','沉默价中藏着债主逃路。'],
  ['d19','五院合账','秩序、真话、安全、体面与烟火必须写成同一份约。','同灯结盟','accord_lines','五约条款','五条边界恰好补全证据链。'],
  ['d20','天明总账','门外要结银，门内要决定二十日后如何共处。','同灯结盟','final_balance','终局余额','五份旧账都能结清，缺口只剩谁肯为哪句话署名。'],
].map(([id,name,pressure,act,intelId,label,reveal]) => Object.freeze({ id,name,pressure,act,intel: Object.freeze({ id:intelId,label,reveal }) })));
export const DAY_NAMES = Object.freeze(DAY_DEFS.map((d) => d.name));
export const DAY_PRESSURE = Object.freeze(DAY_DEFS.map((d) => d.pressure));

export const DAY_ACTIONS = Object.freeze({
  ledger: { id:'ledger', label:'翻账', glyph:'理', description:'核对数目与证物。' },
  office: { id:'office', label:'走官面', glyph:'办', description:'用银钱或人情换公开路径。' },
  listen: { id:'listen', label:'问口风', glyph:'探', description:'让证词落到可追查的人名上。' },
  banquet: { id:'banquet', label:'整席面', glyph:'宴', description:'把私下承诺带到众人面前。' },
});

const route = (id,label,hint,text,effects={},condition=null,locked='') => Object.freeze({ id,label,hint,text,effects,condition,locked });
const householdChoice = (id,label,hint,text,effects) => Object.freeze({ id,label,hint,text,effects });
export const OPENING_CHOICES = Object.freeze([
  route('opening_open_ledger','先开真账','让所有人看见缺口','你把真账摊开。月娘按住页角，另外四人各自报出能核验的一项。',{house:4,flags:['opened_true_ledger']}),
  route('opening_hear_five','先听五人','今日不抢着给答案','你逐一问完。金莲删掉一句假口供，玉楼与雪娥把人情账和工账并排放下。',{exposure:-2,flags:['heard_all_five']}),
]);

export const ACCORD_META = Object.freeze({
  order:{id:'order',key:'order',glyph:'正',label:'秩序',heroine:'wu_yueniang'}, truth:{id:'truth',key:'truth',glyph:'言',label:'真话',heroine:'pan_jinlian'},
  safety:{id:'safety',key:'safety',glyph:'钥',label:'安全',heroine:'li_pinger'}, grace:{id:'grace',key:'grace',glyph:'礼',label:'体面',heroine:'meng_yulou'},
  hearth:{id:'hearth',key:'hearth',glyph:'灶',label:'烟火',heroine:'sun_xuee'},
});
export const ACCORD_CHOICES = Object.freeze({
  wu_yueniang:route('accord_order','总账只认一本','私钥仍归各人','月娘划定公私两栏：“越线便当众说明。”',{rel:{qing:12,du:-5},house:5,accord:'order'}),
  pan_jinlian:route('accord_truth','去处当日说真','偏心不可伪装','金莲折断假口供：“敢偏，便敢让五个人都知道。”',{rel:{qing:12,yu:6,du:-6},accord:'truth'}),
  li_pinger:route('accord_safety','借银先写归期','钥匙永不强取','瓶儿收好钥匙：“写清归期，我才开箱。”',{rel:{qing:13,du:-5},house:3,accord:'safety'}),
  meng_yulou:route('accord_grace','人情必须回礼','不拿谁垫体面','玉楼收下回帖：“借我的名，便当众还我的名。”',{rel:{qing:13,du:-5},repute:1,accord:'grace'}),
  sun_xuee:route('accord_hearth','工账每日落名','先保粮火再排宴','雪娥把工簿钉在墙上：“谁做的，谁领；谁省的，谁记。”',{rel:{qing:13,du:-5},house:5,accord:'hearth'}),
});

export const JOINT_ACTIONS = Object.freeze([
  {id:'joint_yue_pan',participants:['wu_yueniang','pan_jinlian'],asset:'cg/joint/yue_pan',requires:['order','truth'],label:'正堂问口供',hint:'核数再拆谎',text:'月娘指出差额，金莲让掌柜复述；第二遍改口时，两人同时压住证词。',effects:{power:1,exposure:5,relAll:{wu_yueniang:{qing:5},pan_jinlian:{qing:5}}}},
  {id:'joint_yue_pinger',participants:['wu_yueniang','li_pinger'],asset:'cg/joint/yue_pinger',requires:['order','safety'],label:'公账接货单',hint:'明借明还',text:'瓶儿报数，月娘逐项写归期；钥匙没有离手，货却当场入了公账。',effects:{silver:32,house:5,relAll:{wu_yueniang:{qing:5},li_pinger:{qing:5}}}},
  {id:'joint_pan_pinger',participants:['pan_jinlian','li_pinger'],asset:'cg/joint/pan_pinger',requires:['truth','safety'],label:'顺话验货车',hint:'口供对封签',text:'金莲逼车夫说路线，瓶儿拆封逐箱点数；一句谎正好对应一只空格。',effects:{silver:18,power:1,exposure:5,relAll:{pan_jinlian:{qing:5},li_pinger:{qing:5}}}},
  {id:'joint_yue_meng',participants:['wu_yueniang','meng_yulou'],asset:'cg/joint/yue_meng',requires:['order','grace'],label:'排席定回礼',hint:'座次变契约',text:'玉楼先给来客留台阶，月娘再递出写明回礼的名帖；对方收帖便认下欠账。',effects:{repute:2,house:4,relAll:{wu_yueniang:{qing:5},meng_yulou:{qing:5}}}},
  {id:'joint_pan_xuee',participants:['pan_jinlian','sun_xuee'],asset:'cg/joint/pan_xuee',requires:['truth','hearth'],label:'灶上对工簿',hint:'证言配实物',text:'雪娥摆出缺口相合的米斗，金莲让采买逐句重答；第三句便露出假账日期。',effects:{silver:22,exposure:4,house:4,relAll:{pan_jinlian:{qing:5},sun_xuee:{qing:5}}}},
]);

const balanced = (n) => route(`public_balance_${n}`,'五人同担','把功劳与风险写全',`你让五人依次落名。第${n}份公议既记证据，也记谁承担后果。`,{house:8,flags:[`public_vow_${n}`],relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:6,du:-4}]))});
export const PUBLIC_EVENTS = Object.freeze({
  5:{id:'public_day5',title:'中秋公席',heading:'五杯同线',body:'座次被人故意传出，五人要你公开说明谁拥有发言权。',balanceFlag:'public_vow_1',scene:'banquet_conflict',choices:Object.freeze([balanced(1),route('public_5_favor','只敬正堂','暂稳座次却压住四人','月娘接杯后把另外四杯推回：“这不是我要的秩序。”',{house:2,relAll:{wu_yueniang:{qing:5},pan_jinlian:{du:6},li_pinger:{du:6},meng_yulou:{du:6},sun_xuee:{du:6}}})])},
  10:{id:'public_day10',title:'莲池验言',heading:'五证对水',body:'五份证词须沿池复述，改词者会立刻被下一人指出。',balanceFlag:'public_vow_2',scene:'lotus_test',choices:Object.freeze([balanced(2),route('public_10_hide','烧掉错词','证人安全但证链断一环','你烧掉一页错词。瓶儿收好余证，金莲记下你亲手毁了哪句。',{exposure:-6,power:-1,flags:['burned_lotus_page']})])},
  15:{id:'public_day15',title:'堂前公审',heading:'五院作证',body:'债主逼你推出一人担责，五人已把各自证据接成一链。',balanceFlag:'public_vow_3',scene:'public_inquest',choices:Object.freeze([balanced(3),route('public_15_scapegoat','推掌柜顶罪','暂散人群却留假账根','掌柜被押走。雪娥指出工账仍对不上，玉楼当场撤回担保。',{power:1,house:-8,flags:['false_scapegoat']})])},
});
export const BANQUET_CHOICES = PUBLIC_EVENTS[5].choices;

export const HOUSEHOLD_EVENTS = Object.freeze({
  4:{id:'jiaoer_floor',actor:'li_jiaoer',title:'底价写在匣底',text:'娇儿亮出债底价：“二十两买数，三十两买名字。”',choices:[householdChoice('jiaoer_4_buy','买下底价','省十两却欠她回款','她收银递数：“少付的那十两，结局再算。”',{silver:-20,secrets:['collector_floor'],household:{id:'li_jiaoer',regard:8}}),householdChoice('jiaoer_4_refuse','拒绝报价','守住现银但失去底数','娇儿扣匣：“门外那人会按票面收。”',{house:-3,household:{id:'li_jiaoer',regard:-5}})]},
  9:{id:'jiaoer_deed',actor:'li_jiaoer',title:'旧契只租一夜',text:'娇儿按住旧契：“抄一夜十五两，拿走就五十。”',choices:[householdChoice('jiaoer_9_copy','付钱抄契','留下证据不夺原件','她守到墨干才收契，你得到押名。',{silver:-15,secrets:['old_deed'],household:{id:'li_jiaoer',regard:7}}),householdChoice('jiaoer_9_take','强拿旧契','省眼前钱却断西厢路','娇儿松手：“契归你，往后消息不卖。”',{secrets:['old_deed'],exposure:8,household:{id:'li_jiaoer',regard:-18}})]},
  14:{id:'jiaoer_draft',actor:'li_jiaoer',title:'银票折价兑',text:'娇儿敲着票角：“折六十两，风险写你名。”',choices:[householdChoice('jiaoer_14_sign','签名兑票','现银入账风险留名','你签名，她验票兑银，不替你遮暗记。',{silver:60,exposure:5,secrets:['draft_mark'],household:{id:'li_jiaoer',regard:9}}),householdChoice('jiaoer_14_hold','留下银票','不冒名却少周转','娇儿把票退回：“那就等它自己过期。”',{house:-3,household:{id:'li_jiaoer',regard:-3}})]},
  18:{id:'jiaoer_silence',actor:'li_jiaoer',title:'沉默也有价',text:'娇儿摊开终局单：“四十两封口，或把逃路算我一份。”',choices:[householdChoice('jiaoer_18_pay','付封口银','买断消息不买忠心','她数清银子，交出逃路：“今夜之后两清。”',{silver:-40,secrets:['escape_route'],household:{id:'li_jiaoer',regard:5}}),householdChoice('jiaoer_18_share','分她回款','少一成收成换完整证言','娇儿在公契落名：“分成写着，我便出堂作证。”',{silver:-15,power:1,secrets:['escape_route'],flags:['jiaoer_share'],household:{id:'li_jiaoer',regard:15}})]},
});

const step = (...choices) => Object.freeze(choices);
export const ROUTE_CHOICES = Object.freeze({
  wu_yueniang:Object.freeze([
    step(route('yue_1_true','交出真账','让她先核缺口','月娘逐页划线：“明日照这本追。”',{rel:{qing:12},flags:['yue_informed']}),route('yue_1_hide','只报总数','暂避追问','她合笔：“数无来路，便不算账。”',{rel:{du:10}})),
    step(route('yue_2_cut','撤一桌酒','把节省写入公中','她当众封存省下的银：“这才叫守诺。”',{silver:30,house:5,flags:['kept_yue_word']}),route('yue_2_spend','照摆两席','换脸面伤公账','她收走公钥：“排场由你私付。”',{silver:-35,rel:{du:12}})),
    step(route('yue_3_back','请她出面','共同承担官面','月娘带真账入堂，替你挡住第一轮盘问。',{power:1,rel:{qing:14},flags:['yue_backing']},'yue_informed','尚未交真账'),route('yue_3_tea','先递热茶','让争执降温','她接茶坐下：“现在说正事。”',{rel:{qing:8,du:-4}})),
    step(route('yue_4_seat','让她开席','权责一并交付','她定座次也承担失席之责。',{house:6,rel:{qing:12}}),route('yue_4_private','只谈私情','公事仍悬着','她留下半盏茶：“白日账明早补。”',{rel:{yu:12,du:5}})),
    step(route('yue_5_keys','共持公钥','双方互相核验','她分回一半钥匙：“彼此都留证。”',{house:8,rel:{qing:15},flags:['yue_co_rule']},'kept_yue_word','尚未履约'),route('yue_5_lasttea','喝完末茶','今夜不许新愿','她撤去账页，只问你明日几时来。',{rel:{qing:10,yu:8}})),
    step(route('yue_6_record','把承诺入账','让私话可追责','她写下日期，你在旁落名。',{rel:{qing:16,du:-7},flags:['yue_recorded']}),route('yue_6_wait','等她决定','不催她开门','她看完账，亲自把门留了一线。',{rel:{qing:9,du:-4}})),
    step(route('yue_7_delegate','交她调度权','终局由她排班','月娘分派五院任务，并把自己的责任写在首行。',{house:9,flags:['yue_stewardship'],rel:{qing:16}}),route('yue_7_check','陪她复核','共同查最后一遍','两人核出债主重复计息的一栏。',{silver:20,rel:{qing:11}})),
    step(route('yue_8_equal','签共治契','权力与问责同在','她收笔：“今日起，谁也不能拿正堂二字逃责。”',{house:12,flags:['yue_final_pact'],rel:{qing:20,du:-10}}),route('yue_8_rest','替她收账','让她先歇一夜','你锁账，她确认封条后靠回椅背。',{rel:{qing:13,yu:8}})),
  ]),
  pan_jinlian:Object.freeze([
    step(route('pan_1_cup','接她的酒','公开承认偏向','金莲不松杯：“明日也认？”你当席点头。',{rel:{qing:12,yu:12},flags:['pan_promised']}),route('pan_1_hush','压下酒杯','席暂静，话未消','她饮尽后把空杯留作证。',{rel:{du:12}})),
    step(route('pan_2_name','听她报人名','线索落到袖口','她说完便让你复述，免得明日装忘。',{secrets:['shop_fraud'],rel:{qing:13},flags:['pan_involved']}),route('pan_2_flirt','只接她的话','今夜热，线索凉','她收扇：“正事错过不补。”',{rel:{yu:13}})),
    step(route('pan_3_face','带她对质','让拆谎有见证','她逼掌柜连答三遍，第三遍露馅。',{power:1,rel:{qing:15}},'pan_involved','尚未听人名'),route('pan_3_home','叫她等结果','避开闲话','她留下问题清单：“少问一句都别回来。”',{rel:{qing:6,du:7}})),
    step(route('pan_4_open','当面开门','让她看现场','她验过凉茶与脚印，删掉一条谣言。',{secrets:['pan_rumor'],rel:{qing:12,du:-8}}),route('pan_4_wait','让她门外等','保住屋内秘密','她敲三下：“明日我在人前问。”',{rel:{du:15}})),
    step(route('pan_5_repay','补上旧酒','把旧话兑现','你亲手递杯，她先问日期再饮。',{rel:{qing:15},flags:['kept_pan_word']},'pan_promised','尚未接酒'),route('pan_5_bluff','叫她别闹','席面暂稳','她把旧话逐字念给全桌。',{house:-5,rel:{du:18}})),
    step(route('pan_6_openly','公开今夜去处','不让门房替你撒谎','金莲听完传话，才亲手开门。',{exposure:5,rel:{qing:17},flags:['pan_open_choice']},'kept_pan_word','尚未还酒'),route('pan_6_do','少说先做','用行动替代许愿','你按她的清单逐项办完。',{rel:{qing:11,du:-5}})),
    step(route('pan_7_cross','让她交叉问证','把锐气变成程序','她与雪娥轮问采买，锁定假日期。',{power:1,flags:['pan_cross_exam'],rel:{qing:16}}),route('pan_7_apology','认一句旧谎','承担而不辩解','她划掉那句：“这次算你自己说破。”',{rel:{qing:11,du:-9}})),
    step(route('pan_8_truth','签真话契','每次偏向都可追问','金莲把扇印压在契尾：“我不求第一，只求不被骗。”',{flags:['pan_final_pact'],rel:{qing:20,du:-10}}),route('pan_8_watch','请她守口供','让她保管原话','她封好口供，坐到天亮。',{rel:{qing:13,yu:7}})),
  ]),
  li_pinger:Object.freeze([
    step(route('pinger_1_room','先问住处','先问人再问箱','瓶儿指出漏窗，你先叫人修好。',{rel:{qing:13},flags:['pinger_route']}),route('pinger_1_money','先问银数','拿到数也添防备','她报得分毫不差，钥匙却握紧。',{silver:40,rel:{du:8}})),
    step(route('pinger_2_close','替她关窗','保护账本来源','门窗查清后，她递出货簿。',{secrets:['pinger_funds'],rel:{qing:15}}),route('pinger_2_take','先借急银','解燃眉伤安全','她借银并写下你未报归期。',{silver:70,rel:{du:11}})),
    step(route('pinger_3_shield','替她应问','责任写在自己名下','你出堂担责，她把证物交给月娘。',{house:4,flags:['protected_pinger'],rel:{qing:16}},'pinger_route','尚未先问住处'),route('pinger_3_answer','让她自答','公开来路','她答清来路，回房换锁。',{repute:1,rel:{du:10}})),
    step(route('pinger_4_secret','确认账未动','保住证据链','她检查线头后交出下一条货路。',{secrets:['merchant_route'],rel:{qing:13}},'protected_pinger','尚未保护她'),route('pinger_4_tea','陪她饮茶','不追问银箱','她把点心分你一半。',{rel:{qing:10,du:-4}})),
    step(route('pinger_5_credit','货单写她名','功劳归原主','她确认署名后才盖箱印。',{repute:1,flags:['pinger_credited'],rel:{qing:15}}),route('pinger_5_spend','挪钱撑场','换场面伤信任','她散席便重新编号封条。',{silver:-25,rel:{du:16}})),
    step(route('pinger_6_share','共同算债','烂账也向她公开','她把两本账并列，不替你遮亏。',{silver:55,flags:['pinger_same_chest'],rel:{qing:17}},'protected_pinger','尚未保护她'),route('pinger_6_return','归还钥匙','让她决定去留','她收钥匙却留你喝完茶。',{rel:{qing:11,du:-6}})),
    step(route('pinger_7_reserve','设安全储备','先留三日粮银','她封存储备并把数报给五人。',{house:8,flags:['pinger_reserve'],rel:{qing:16}}),route('pinger_7_receipt','补齐借据','旧借都有归期','你补签欠条，她拆下一把旧锁。',{rel:{qing:12,du:-7}})),
    step(route('pinger_8_safe','签安全契','钥匙与同意不可越界','她把契收进箱，却把茶席留在外间。',{flags:['pinger_final_pact'],rel:{qing:20,du:-10}}),route('pinger_8_stay','守到封账','人在而不碰箱','你坐到封条干透，她靠着椅背睡了一刻。',{rel:{qing:13,yu:7}})),
  ]),
  meng_yulou:Object.freeze([
    step(route('meng_1_card','问名帖代价','先定回礼再借名','玉楼写下回礼：“现在可去敲门。”',{flags:['meng_terms'],rel:{qing:13}}),route('meng_1_decline','不用名帖','不欠情也失路径','她收帖：“至少这次没有白借我。”',{rel:{qing:6}})),
    step(route('meng_2_return','亲送回礼','让她被当众看见','你在来客前谢她搭桥，席上无人再抹去她的功。',{repute:1,flags:['meng_repaid'],rel:{qing:15}},'meng_terms','尚未定价'),route('meng_2_private','私下道谢','情意有了，名分未正','她收礼：“这句还欠一个听众。”',{rel:{qing:9,yu:5}})),
    step(route('meng_3_seating','请她排座','把转圜权交给她','她让争执双方隔席落座，仍各有台阶。',{house:6,flags:['meng_hosted'],rel:{qing:14}}),route('meng_3_corner','叫她陪末席','避开锋芒','她坐下替你记清谁先失礼。',{rel:{qing:8}})),
    step(route('meng_4_defend','挡下轻慢','公开承认她的功','你截住讥讽，点明名帖救过药车。',{power:1,rel:{qing:16},flags:['meng_defended']}),route('meng_4_signal','让她自行回话','她能化解却记下你的沉默','玉楼笑着回敬，桌下却把回礼单收走。',{rel:{du:9}})),
    step(route('meng_5_contract','人情逐笔记','让关系可追偿','她把借与还各写一栏。',{house:5,rel:{qing:15},flags:['meng_social_ledger']}),route('meng_5_favor','再借一次笑','先过关后欠债','她替你圆场，回单又添一行。',{repute:1,rel:{du:8}})),
    step(route('meng_6_dance','请她领席','让她决定节奏','玉楼起身移杯，五人顺势换到同桌。',{house:6,rel:{qing:16,yu:6}}),route('meng_6_listen','听她复盘','辨清谁欠谁','她逐人说完，不替你删掉失礼。',{secrets:['guest_obligations'],rel:{qing:11}})),
    step(route('meng_7_witness','让她见证公约','体面成为可执行条款','她逐句确认无人被拿来垫脚。',{flags:['meng_witness'],rel:{qing:17}}),route('meng_7_amend','请她改措辞','让拒绝也留出口','她把命令改成可答应、可拒绝的约定。',{house:4,rel:{qing:13}})),
    step(route('meng_8_grace','签体面契','回礼与拒绝都公开','玉楼压下曲印：“往后谁借名，谁当众还。”',{flags:['meng_final_pact'],rel:{qing:20,du:-10}}),route('meng_8_lastcup','陪她收末席','散席也算劳动','你同她逐桌送客，最后一杯才留给彼此。',{rel:{qing:14,yu:8}})),
  ]),
  sun_xuee:Object.freeze([
    step(route('xuee_1_bag','接过米袋','亲自看缺口','你跟她进仓，她指出重绑的绳结。',{secrets:['kitchen_witness'],flags:['xuee_evidence'],rel:{qing:14}}),route('xuee_1_cash','叫她先垫','眼前有银灶上转冷','她剪下私房银：“往后热水自烧。”',{silver:35,rel:{du:14}})),
    step(route('xuee_2_count','同数米斗','把劳动变证据','你记斗数，她核重量，差额正合假账。',{silver:18,rel:{qing:15}}),route('xuee_2_order','催她开火','先保席面','她开锅却把欠工写在门上。',{house:2,rel:{du:9}})),
    step(route('xuee_3_wage','补发工钱','先付做事的人','她逐人唱名发钱，灶火当场复燃。',{silver:-25,house:7,flags:['xuee_wages'],rel:{qing:16}}),route('xuee_3_praise','只在人前夸','不给实际回报','雪娥把掌声记作零两。',{repute:1,rel:{du:12}})),
    step(route('xuee_4_testify','请她持簿作证','让实物进入公堂','她带米斗与工簿出堂，没人能把她赶回灶间。',{power:1,flags:['xuee_testified'],rel:{qing:17}},'xuee_evidence','尚未查缺口'),route('xuee_4_copy','只拿工簿抄本','保护她不露面','她交抄本，也注明谁没让她作证。',{secrets:['labor_copy'],rel:{qing:8}})),
    step(route('xuee_5_ration','先定三日粮','宴前保住全宅','她封好口粮才批准开席。',{house:8,flags:['xuee_ration'],rel:{qing:15}}),route('xuee_5_feast','先办大席','得名声耗粮火','席面亮，次日灶上只剩稀粥。',{repute:2,house:-8,rel:{du:10}})),
    step(route('xuee_6_rest','替她守一更火','承认她也会疲倦','你看火，她洗净手坐下喝完热汤。',{rel:{qing:16,yu:6,du:-6}}),route('xuee_6_audit','请她再核账','继续劳动但给署名','她核完后在工簿首行写自己的名。',{silver:12,rel:{qing:11}})),
    step(route('xuee_7_allocate','让她排配给','按实做事分资源','她依人数与工时发粮，无人能插队。',{house:9,flags:['xuee_allocator'],rel:{qing:17}}),route('xuee_7_sharemeal','同桌吃灶饭','用一餐确认尊重','她把最热的一碗推给你，也给另外四人留足。',{rel:{qing:13}})),
    step(route('xuee_8_hearth','签烟火契','劳动、休息、粮账同记','雪娥按下灶印：“往后火不靠谁白撑。”',{flags:['xuee_final_pact'],rel:{qing:20,du:-10}}),route('xuee_8_bankfire','陪她封火','让今日劳动真正结束','你同她封好余炭，她洗手后把暖阁门留开。',{rel:{qing:14,yu:7}})),
  ]),
});

const allFive = Object.freeze([...HEROINE_IDS]);
export const SHARED_NIGHT_CHOICES = Object.freeze([
  route('shared_five_roles','五人都留下','各守一约并互证','月娘排账，金莲问证，瓶儿管货，玉楼接客，雪娥守粮；五人逐项应下，也各自保留拒绝权。',{house:14,silver:30,flags:['harem_coalition'],relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:12,du:-12}]))}),
  route('shared_buy_quiet','五袋银买静','只买一夜不买同心','五只荷包各归一处，五份证据也随人离桌。',{silver:-60,house:-2}),
  route('shared_false_only','仍许人人唯一','同一句话当场失效','金莲先复述你昨夜原话，另外四人逐一对证；五扇门同时收回钥匙。',{house:-14,exposure:8,relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:-6,du:18}]))}),
]);
export const SHARED_AFTERGLOW_BEATS = Object.freeze([
  {id:'five_cups',kicker:'外账初定',title:'五杯仍暖',body:'月娘收账，金莲撕假证，瓶儿锁原件，玉楼给雪娥递来热茶；雪娥把最后一碗汤推回桌心。',choices:Object.freeze([route('after_1_names','逐一念名','确认每人贡献','你念出五人的名与所做之事。玉楼纠正一处遗漏，月娘补到账尾，五人都点了头。',{house:5,relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:5}]))}),route('after_1_rest','先叫众人歇','今夜不再派活','雪娥熄灶，瓶儿收钥匙；金莲替月娘拆簪，玉楼把五把椅子挪近。',{house:4})])},
  {id:'five_boundaries',kicker:'更漏过半',title:'五句边界',body:'衣袍都松了些，肩背落在暖灯里；你先问是否继续靠近。五人各自说出愿意与不愿意，没人替别人回答。',choices:Object.freeze([route('after_2_hear','听完再近','每句同意都可收回','你逐句复述。金莲说“这才算真话”，雪娥把门闩交给月娘，瓶儿仍握自己的钥匙。',{house:5,relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:4,yu:3,du:-4}]))}),route('after_2_dim','拨暗灯芯','留得见彼此的光','玉楼先问众人是否愿意，五人都应了，才把纱帐放下一半。',{house:3})])},
  {id:'five_afterglow',kicker:'天色将明',title:'没有谁被落下',body:'金莲把毯角递给瓶儿，瓶儿替雪娥垫好手腕；雪娥催月娘歇息，月娘让玉楼停止替所有人周全。五人相视而笑。',choices:Object.freeze([route('after_3_pact','重读五约','亲密不取消边界','五人轮流读完自己的条款，又替下一人确认。你最后落名。',{flags:['five_accord_sealed'],house:8}),route('after_3_quiet','并肩等天亮','不再追加承诺','五人彼此留出位置，安静听完最后一更。',{house:5})])},
]);
export const SHARED_DAWN_CHOICES = Object.freeze([
  route('dawn_six_tea','摆六盏早茶','昨夜不藏到门后','月娘点账，金莲先试茶，瓶儿递货单，玉楼排回礼，雪娥把热食分成六份。',{house:6,relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:4}]))}),
  route('dawn_five_doors','送到五院岔口','各有门也共守约','五人各自说出今日任务与晚间去处，没人要求你猜。',{house:5,relAll:Object.fromEntries(HEROINE_IDS.map(id=>[id,{qing:3,du:-3}]))}),
  route('dawn_keep_pact','把五约入柜','留一份共同证物','五枚印记并列入柜，钥匙分存正堂、私院与灶上。',{house:7,flags:['five_accord_archived']}),
]);

const personal = (id,heroine,tier,title,asset,body) => Object.freeze({id,heroine,participants:[heroine],tier,title,asset,body});
const ensemble = (id,tier,title,asset,body) => Object.freeze({id,heroine:null,participants:allFive,tier,title,asset,body});
export const SCENES = Object.freeze({
  yue_prelude:personal('yue_prelude','wu_yueniang','prelude','账页压在床边','cg/yue/prelude','月娘卸下簪冠，露出肩侧灯影。她握住你的手：“先问我愿不愿意，再往前。”'),
  yue_explicit:personal('yue_explicit','wu_yueniang','explicit','正堂今夜不落锁','cg/yue/explicit','她确认门已闩好，才牵你靠近；散发落过肩背，她仍保留随时叫停的钥匙。'),
  pan_prelude:personal('pan_prelude','pan_jinlian','prelude','酒还在她唇边','cg/pan/prelude','金莲用扇柄挡住你：“答清今夜去处，我才让你再近一步。”'),
  pan_explicit:personal('pan_explicit','pan_jinlian','explicit','花园门闩落了','cg/pan/explicit','她亲手落闩，又问一次你是否愿意。你答应后，她才松开衣领，露出肩头暖光。'),
  pinger_prelude:personal('pinger_prelude','li_pinger','prelude','钥匙硌在掌心','cg/pinger/prelude','瓶儿把钥匙留在自己掌心，另一只手牵住你：“今夜不谈借银。”'),
  pinger_explicit:personal('pinger_explicit','li_pinger','explicit','沉香过了更漏','cg/pinger/explicit','她确认无人闯入，也确认你听懂界限，才褪下外袍，裸露的肩背隐在沉香与灯影间。'),
  meng_prelude:personal('meng_prelude','meng_yulou','prelude','末席留一杯','cg/meng/prelude','玉楼送走来客才坐下：“今晚不替谁圆场。你若留下，只听我的真话。”'),
  meng_explicit:personal('meng_explicit','meng_yulou','explicit','回礼落在枕边','cg/meng/explicit','她解开外袍前先收走名帖：“这不是交易。”得到你的确认后，她才让裸露的肩背靠近灯下。'),
  xuee_prelude:personal('xuee_prelude','sun_xuee','prelude','灶火终于封好','cg/xuee/prelude','雪娥洗净双手：“今日的活已完。你若坐下，就别再叫我起身取东西。”'),
  xuee_explicit:personal('xuee_explicit','sun_xuee','explicit','暖阁留着余温','cg/xuee/explicit','你替她披好松开的外袍，她却握住系带：“我说慢些便慢些。”肩背在余火里暖亮，她没有再被差遣。'),
  banquet_conflict:ensemble('banquet_conflict','public','五杯等一句真话','cg/group/public_day5','五人各守一杯，要求座次、钱、功劳与劳动都当众说清。'),
  lotus_test:ensemble('lotus_test','public','莲池五证相接','cg/group/public_day10','五人沿池依次复述，后一人既补前证，也指出改动。'),
  public_inquest:ensemble('public_inquest','public','堂前五院作证','cg/group/public_day15','月娘举总账，金莲持口供，瓶儿托货单，玉楼呈名帖，雪娥摆工簿。'),
  inner_court_accord:ensemble('inner_court_accord','ensemble','五约同守一灯','cg/group/inner_court_accord','五项边界写在一纸，各人亲自落印并保留拒绝权。'),
  inner_court_afterglow:ensemble('inner_court_afterglow','ensemble-intimate','灯影里仍有五声回应','cg/group/inner_court_afterglow','外袍与簪饰各自收好，裸露肩背只在柔光中掠过；每次靠近都先有清楚回应。'),
});

export const NIGHT_TEXT = Object.freeze({leave:{label:'替她拢好衣襟',hint:'停在她愿意的位置'},talk:{label:'把茶喝完',hint:'让未完的话有结果'},prelude:{label:'再问一步',hint:'同意后才靠近'},explicit:{label:'由她落闩',hint:'边界可随时收回'}});
export const NIGHT_OUTCOMES = Object.freeze({
  wu_yueniang:{leave:'你替月娘收好账，她约你明早复核。',talk:'她把私话写成一条可兑现的约定。'},
  pan_jinlian:{leave:'你放回扇子，她记下你没有借酒强求。',talk:'她逼你把明日去处说真，才续上酒。'},
  li_pinger:{leave:'你不碰钥匙，她亲自送你到门边。',talk:'她收好银箱，与你分完一碟点心。'},
  meng_yulou:{leave:'你陪她送完末客，她不再独自收席。',talk:'她删掉回礼单上一笔含糊人情。'},
  sun_xuee:{leave:'你封好灶火，她终于按时歇下。',talk:'你听她核完工账，并替她落名。'},
});
export const ENDINGS = Object.freeze({
  exclusive:{title:'一院灯深',tag:'二十日后，只守一份清楚承诺',text:'另外四院收回各自的账与钥匙。被你选择的人没有胜过谁，只要求你把二十日里说过的话继续做下去。'},
  balanced:{title:'五院同灯',tag:'五约让亲近不再靠谎话维持',text:'第六盏茶摆上长案。五人仍各有边界，却能用秩序、真话、安全、体面与烟火互相校验；二十日总账从共同署名开始。'},
  intrigue:{title:'人情替你开门',tag:'每条捷径都留下可追讨的价',texts:{clean:'债已清，五份证物各归其主；你付清借过的人情。',watched:'门开了，未还的回礼与工钱却仍在公契上。',burned:'你烧掉证据换来一夜安静，明日的报价因此更高。'}},
  unstable:{title:'五处各自封灯',tag:'二十日什么都要，便无人替你兜底',texts:{no_scene:'{name}等到天明，只等来又一张空头承诺。',second_too_close:'两处门都留灯，也都看见你隐瞒另一处。',broke_word:'五份旧话被当堂对出，门闩依次落下。',not_enough_power:'证据没有接成链，债主带着新价再来。',spread_thin:'二十日走遍五院，却没在任何一句边界前停下。'}},
});
