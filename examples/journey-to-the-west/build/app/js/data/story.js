// 玩家读到的剧情与提示文案（简体中文）。who 为 null 是旁白。

export const SPEAKERS = {
  wukong: { name: '孙悟空', art: 'wukong' }, tang: { name: '唐僧', art: 'tang' }, bajie: { name: '猪八戒', art: 'bajie' },
  sha: { name: '沙悟净', art: 'sha' }, tudi: { name: '土地', art: 'tudi' }, luosha: { name: '罗刹女', art: 'luosha' },
  niumowang: { name: '牛魔王', art: 'niumowang' }, lingji: { name: '灵吉菩萨', art: 'lingji' }, shibi: { name: '侍婢', art: 'shibi' },
  huobao: { name: '赤焰火妖', art: 'mob_fire1' }, yumian: { name: '玉面公主', art: 'yumian' }, yaojiang: { name: '摩云洞妖将', art: 'yaojiang' },
  fakeBajie: { name: '猪八戒', art: 'bajie' }, nezha: { name: '哪吒三太子', art: 'nezha' }, gaoshao: { name: '卖糕少年', art: 'gaoshao' },
  laozhe: { name: '庄上老者', art: 'laozhe' },
  // 悟空变作牛魔王骗扇：名牌与立绘都按变出来的模样，免得画面上还是悟空本相
  wukongAsNiu: { name: '「牛魔王」（悟空所变）', art: 'niumowang' },
};

const FINAL_COMMON = [
  { who: 'bajie', text: '好你个老牛，偷了我的脸还敢露面！猴哥闪开，看老猪筑他九个窟窿！' },
  { who: 'tudi', text: '大圣，莫让他拖住！小神已报上天庭，哪吒三太子与李天王正在赶来！' },
  { who: 'sha', text: '二师兄压住侧翼，我守住后路。大师兄，只管盯住老牛。' },
  { who: 'niumowang', text: '欺我夫人，盗我坐骑，又变作我的模样骗扇！孙悟空，你我五百年的情分，到今日为止！' },
];

export const STORY = {
  prologue: [
    { who: null, text: '师徒一路西行，来到八百里火焰山。热风卷着火星扑面，前路已叫烈焰封死。' },
    { who: 'tang', text: '悟空，还没到山脚，衣裳便湿透了。这片火海，该从哪里过去？' },
    { who: 'bajie', text: '师父，这火可不认人。依老猪看，绕一绕也好，总强过连人带行李一并烤了。' },
    { who: 'wukong', text: '又说泄气话！前面有座土地庙，俺去问个明白。' },
  ],
  tudi: [
    { who: 'tudi', text: '大圣留步！小神正是此山土地。这火烧了整整八百里，便是铁打的身子也挨不住。' },
    { who: 'tudi', text: '要开西路，得去翠云山芭蕉洞借扇。那扇一扇息火，二扇生风，三扇落雨；这里的百姓每隔十年，都靠它熄火下种。' },
    { who: 'wukong', text: '这扇子在谁手里？俺去借来。' },
    { who: 'tudi', text: '主人是铁扇仙，也叫罗刹女——牛魔王的夫人，红孩儿的母亲。红孩儿被观音收去以后，她见不着孩子，只怕不会给大圣好脸色。' },
    { who: 'wukong', text: '原来是牛大哥家里。俺与他五百年前拜过把子，叫一声嫂嫂，借三日也就是了。' },
    { who: 'tudi', text: '大圣莫急。庄南那条山路通翠云山。见了罗刹女，先把话说软些；她若举起扇子，可千万小心。' },
  ],
  tudiAgain: [{ who: 'tudi', text: '芭蕉洞从庄南的山路上去。大圣记着，先开口借，莫一上来便动棒。' }],
  luoshaPre1: [
    { who: 'luosha', text: '孙悟空？你竟敢走到我门前来。' },
    { who: 'luosha', text: '三年了。我见不着孩儿，连他一声“娘”都听不见——这笔账，我日日都记着。' },
    { who: 'wukong', text: '嫂嫂，红孩儿如今在观音座前做善财童子，总好过守着火云洞做妖王。' },
    { who: 'luosha', text: '“善财童子”四个字，说来倒轻巧。你得了正果的名，我却没了膝前的孩子。今日还想来借我的扇？' },
    { who: 'wukong', text: '红孩儿的事，你尽管怪俺。可山下的庄稼等不得。扇子借俺三日，火一熄，原物奉还。' },
    { who: 'luosha', text: '三日？我连一个字也不信。想拿扇子，先过了我这双剑！' },
  ],
  approachCalm: [
    { who: 'wukong', text: '嫂嫂这三年如何熬过，俺听明白了。可山下百姓也在火里熬着。沙师弟，先把阵脚站稳！' },
    { who: 'sha', text: '大师兄只管应敌。我守中路，二师兄照看两翼。' },
  ],
  approachRush: [
    { who: 'wukong', text: '话已说尽，嫂嫂仍要动剑，俺便先试试这洞门前的剑法！' },
    { who: 'bajie', text: '猴哥又抢在头里！后头的师父行李，还得老猪去顾。' },
  ],
  blowAway: [
    { who: 'luosha', text: '齐天大圣，也站稳了再说大话！' },
    { who: null, text: '罗刹女捻诀一扇。阴风拔地而起，悟空双脚离山，转眼被吹出五万余里。' },
    { who: 'wukong', text: '好扇子！这不是寻常风，顶着回去只会再吃一扇。' },
    { who: 'wukong', text: '对了，灵吉菩萨手里有颗定风丹。俺去小须弥山借来，再同她分说！' },
  ],
  lingji: [
    { who: 'lingji', text: '大圣匆匆而来，想必已经见识过芭蕉扇的风了。' },
    { who: 'wukong', text: '正是！一扇把俺送出五万里。菩萨，把定风丹借俺一用。' },
    { who: 'lingji', text: '我这里有定风丹，也有一幅避火锦。丹能定住身形，不受神风妖丝迟滞；锦能隔去烈焰，护你们穿行火海。' },
    { who: 'lingji', text: '两件都交给你，只是上阵时只能带一件，阵外可随时换。眼前是罗刹女的扇，前面是八百里火焰山——大圣自己掂量。' },
  ],
  luoshaPre2: {
    dingfengdan: [
      { who: 'luosha', text: '一扇没叫你长记性，还敢回来？' },
      { who: 'wukong', text: '嫂嫂，俺又来借扇了。你只管扇，看今日吹不吹得动！' },
      { who: null, text: '罗刹女连挥数扇，阴风卷得山石乱滚。悟空含着定风丹，钉在洞前，半步未退。' },
      { who: 'luosha', text: '竟定得住我的风……侍婢，随我上！' },
    ],
    bihuojin: [
      { who: 'luosha', text: '一扇没叫你长记性，还敢回来？' },
      { who: 'wukong', text: '嫂嫂，俺又来借扇了。今日便再领教几回！' },
      { who: null, text: '阴风接连压来，悟空翻着筋斗跌出老远。他裹紧避火锦，爬起又冲回洞前。' },
      { who: 'luosha', text: '甩也甩不掉……侍婢，随我上！' },
    ],
  },
  recallCalm: [
    { who: 'luosha', text: '上回来，你肯站着听完我的话；可听过便算了么？孩儿仍不在我身边。' },
    { who: 'wukong', text: '俺不敢说一句话便能了结此怨。今日仍为山下生民来借扇。' },
  ],
  recallRush: [
    { who: 'luosha', text: '上回来只顾抢先挥棒，今日又来逞强。你纵快过双剑，可快不过我的扇风。' },
    { who: 'wukong', text: '上回是俺性急。可火焰山一日不熄，百姓便多受一日苦。' },
  ],
  wukongPlan: [{ who: 'wukong', text: '（扇子硬抢不来。等她斗得气喘，俺老孙变个蟭蟟虫，钻进她肚里去！）' }],
  intoBelly: [
    { who: null, text: '罗刹女气息一乱，悟空已化作蟭蟟虫，趁她张口换气钻入腹中。' },
    { who: 'luosha', text: '疼死我了！叔叔快住手……我把扇子给你！' },
    { who: 'wukong', text: '早借不就省事了？俺熄了火，立刻回来还你！' },
    { who: 'luosha', text: '出来！扇子给你。火一熄，马上送还。' },
  ],
  // 没变虫、硬打到她认输：没有「出来」可喊
  luoshaYield: [
    { who: 'luosha', text: '罢了，罢了……再打下去，这洞门也要叫你拆了。' },
    { who: 'luosha', text: '扇子拿去。火一熄，马上送还。' },
  ],
  gotFan: [
    { who: 'wukong', text: '俺老孙说到做到。' },
    { who: null, text: '罗刹女递来芭蕉扇，手指仍扣着扇柄。她看了悟空一眼，这才松开。' },
    { who: 'luosha', text: '去吧。看看它合不合你的心意。' },
    { who: 'wukong', text: '师父，扇子借到了！且看俺去火口，开出一条西路！' },
  ],
  trialEmber: [
    { who: 'wukong', text: '且慢。先拿路旁这簇小火试一试，莫把整座山都惊动了。' },
    { who: 'sha', text: '火苗迎风反涨——这扇子有假。大师兄快收手，山口的地火已经翻动了。' },
    { who: 'tudi', text: '虽未催旺大火，砖缝里的火兵也闻风醒了！大圣，先护住西路！' },
  ],
  trialFull: [
    { who: 'wukong', text: '师父且看，俺老孙一扇开出西路！' },
    { who: 'bajie', text: '猴哥，火不曾低，怎么反往咱们脚边蹿？快收了扇子！' },
    { who: 'tudi', text: '这是假的！这一扇催旺了地火，火兵借着火势，更凶了！' },
  ],
  trialKnown: [
    { who: 'wukong', text: '这扇子俺在路上试过了，越扇火越旺，是把假货。罗刹女松手前那一眼，原来是这个意思。' },
    { who: 'tudi', text: '大圣既已识破，便莫再扇。只是方才那阵火气，已把砖缝里的火兵惊出来了！' },
  ],
  afterFire: [
    { who: 'wukong', text: '火兵退了。土地，那柄真扇究竟藏在哪里？' },
    { who: 'tudi', text: '还在罗刹女手中。她不信旁人，只听夫君牛魔王的话。牛魔王如今住在积雷山摩云洞，真要取扇，还得从他身上寻门路。' },
    { who: 'bajie', text: '猴哥，那老牛可不好斗。俺也去，真动起手来还能替你挡一阵。' },
  ],
  afterFireEmber: [{ who: 'sha', text: '幸而先试的是边火，认出假扇便收住了。这回吃亏，也算看清了它的底细。' }],
  afterFireFull: [{ who: 'bajie', text: '方才那一扇把火兵都扇凶了三分。下回拿到扇子，咱们可得先辨真假。' }],
  dealKeep: [{ who: 'wukong', text: '既肯收住野性，便随俺们走。往后出力，不许再借火伤人。' }],
  dealRelease: [
    { who: 'huobao', text: '火脉外头有条旧退路。若撞上巡穴的妖气，贴着冷砖走，能避过一回。' },
    { who: 'wukong', text: '这条路俺记下了。去吧，莫再替妖王守火。' },
  ],
  huntIntro: [
    { who: 'tudi', text: '大圣再看这个。火炎校尉掉下一角残图，上面五脉交错，像是八卦炉砖落地时压住的一处旧藏。' },
    { who: 'wukong', text: '来得巧。见老牛之前，正好去摸几件趁手的东西。' },
    { who: 'sha', text: '图上只画地脉，没画凶险。拿够了就走，别等妖气把退路封住。' },
  ],
  huntSafe: [{ who: 'bajie', text: '够了够了，袋子都沉了！再挖下去惊动妖穴，眼前这些也保不住。猴哥，走吧。' }],
  huntDeep: [{ who: 'wukong', text: '外面的收好了，深处也看了个遍。妖气还没围上来——收棒，走！' }],
  huntForced: [{ who: 'sha', text: '退路要合了！外层的行囊我护住了，深处的不要了。人先出去。' }],
  preYumian: [
    { who: null, text: '摩云洞外怪石交错，低云里不时传出兵刃碰响。' },
    { who: 'wukong', text: '牛大哥！五百年不见，老朋友到门前了！' },
    { who: 'yumian', text: '谁在洞外嚷？也不看看这里是什么地方。' },
    { who: 'wukong', text: '俺是孙悟空，来找牛魔王借一样东西。你叫他出来。' },
    { who: 'yumian', text: '大王正在歇息。你空着手上门，张口便要借东西，哪来的规矩？来人，把这无礼的猴子赶下山去！' },
    { who: 'yaojiang', text: '护住洞门！拿下他！' },
  ],
  afterYumian: [
    { who: 'yumian', text: '大王！这猴子一路打到洞门，你还不管么？' },
    { who: 'niumowang', text: '谁敢动我的人？……原来是贤弟。五百年不见，你送的竟是这份见面礼。' },
    { who: 'wukong', text: '牛哥，俺去翠云山借扇，你夫人闭门便打；到这里，又是你的人先动手。俺只为过山。' },
    { who: 'niumowang', text: '先欺我夫人，又闯我洞府，还把“借”字挂在嘴边？贤弟，今日先算清这笔账！' },
  ],
  niuLeaves: [
    { who: null, text: '棍棒正紧，一名小妖奔来传话：碧波潭老龙王已摆好酒席，催大王赴宴。' },
    { who: 'niumowang', text: '今日有客相候，没工夫与你耗。贤弟，这一棒先记着！把辟水金睛兽牵来，本王赴碧波潭吃酒去！' },
    { who: 'wukong', text: '碧波潭……他那头金睛兽倒能避水。老牛，你去吃酒，俺便跟去看看！' },
  ],
  pondIntro: [
    { who: null, text: '悟空循着蹄印赶到碧波潭。深蓝水面下，龙宫的宴灯一层层亮着。' },
    { who: 'wukong', text: '老牛就在底下。潭水又深，守卫又多，得换个不起眼的模样混进去。' },
  ],
  pondInsect: [
    { who: null, text: '蟭蟟虫刚扎进水里，便被一道暗流卷住，滴溜溜冲回岸边。' },
    { who: 'wukong', text: '身子太轻，连方向都稳不住。得变个水里的东西。' },
  ],
  pondBrute: [
    { who: null, text: '悟空刚抡棒踏进水中，两名虾将便横叉挡路。四下号角齐响，整座水府都惊动了。' },
    { who: 'wukong', text: '这么闯，老牛早跑了。还是悄悄进去。' },
  ],
  pondCrab: [{ who: null, text: '悟空变作一只螃蟹，横着沉入潭底。沿途虾兵蟹将见是同类，无人盘问。' }],
  pondRush: [
    { who: null, text: '螃蟹才游进殿中，一只老鼋便盯住了他：“哪里的生面孔？”巡守闻声围来，悟空只得缩回暗处。' },
    { who: 'wukong', text: '差点露馅。等他们换岗再过。' },
  ],
  pondShift: [
    { who: null, text: '两队巡守交班时，螃蟹贴住廊柱的阴影，一路横到宴席旁。' },
    { who: null, text: '珠帘后的宴席上，传来牛魔王与老龙王劝酒碰杯的笑声。那头辟水金睛兽就拴在帘外廊下的石柱上，没人看着。' },
  ],
  pondSteal: [
    { who: null, text: '蟹钳轻轻一挑，缰绳落地。悟空现出本相，翻身上鞍，催着金睛兽冲破水门！' },
    { who: 'wukong', text: '好坐骑，随俺走一趟！' },
    { who: null, text: '辟水金睛兽挣了几下，见甩不脱背上的人，渐渐收住四蹄。' },
  ],
  trickFan: [
    { who: null, text: '悟空骑着金睛兽赶回翠云山，变作牛魔王的模样，压低声音走进芭蕉洞。' },
    { who: 'wukongAsNiu', text: '夫人，我回来了。那猴子纠缠半日，总算叫我赶走。扇子还在么？' },
    { who: 'luosha', text: '你回来就好。扇子在这里，你亲自收着吧，我再不想看见那猴子。' },
    { who: 'luosha', text: '他说孩儿在南海做善财童子……大王，你说他夜里醒来，会不会还找娘？' },
    { who: 'wukongAsNiu', text: '……观音座前有人照看，他不会受苦。' },
    { who: 'luosha', text: '大王，你衣甲上怎么全是水？' },
    { who: 'wukongAsNiu', text: '老龙王留酒，多耽搁了一阵。扇子给我，为夫这就去把山火收拾了。' },
    { who: null, text: '罗刹女把真扇交到“夫君”手里。悟空攥住扇柄，却没像来时那样得意，只匆匆转身出了洞。' },
  ],
  meetBajie: [
    { who: null, text: '悟空独自带着真扇下山。走不多远，却见八戒气喘吁吁地迎面跑来。' },
    { who: 'fakeBajie', text: '猴哥！师父怕你不会使扇，特地叫我来接你！扇子重，给我拿着罢。' },
    { who: 'wukong', text: '这呆子来得倒快……' },
  ],
  checkBajie: [
    { who: 'fakeBajie', text: '师父说……叫你拿到扇子，快些回去。' },
    { who: 'wukong', text: '不对。师父若打发八戒来，少不得先嘱咐他看好行李。你这呆子，是哪一头变的？' },
    { who: null, text: '来人脸色一沉，翻身现出牛魔王本相。那老牛果然也会七十二变。' },
    { who: 'niumowang', text: '泼猴，还真叫你看破了！可这扇子，你一样带不走！' },
  ],
  giveBajie: [
    { who: null, text: '悟空顺手递出扇子。来人一把攥住，笑声骤然变粗，翻身现出牛魔王本相。' },
    { who: 'niumowang', text: '泼猴，你会变我，我便不会变你师弟么？扇子归我了！' },
    { who: 'wukong', text: '只顾着扇子，倒让老牛钻了空子。哪里走！' },
  ],
  finalKept: [
    { who: null, text: '悟空护住真扇，与老牛一路斗回积雷山前。土地领着八戒、沙僧从山下赶来，师父留在后方。' },
    ...FINAL_COMMON,
  ],
  finalFooled: [
    { who: null, text: '悟空一路追到积雷山前，趁老牛转身迎战，一棒挑回真扇，心神却还未定。土地领着八戒、沙僧从山下赶来，师父留在后方。' },
    ...FINAL_COMMON,
  ],
  phase2: [{ who: null, text: '牛魔王伏地一吼，现出白牛真身。巨角挑开云层，四蹄踏裂山石。阵后的土地把拐杖往地上一顿，引来一口山间地气，要替众人稳住阵脚。' }],
  assist: [
    { who: null, text: '云头炮响。哪吒踏着风火轮落在阵前，李天王举起照妖镜，天兵从四面封住山口。' },
    { who: 'nezha', text: '牛魔王，四路都封了。还不现出原形！' },
  ],
  surrender: [
    { who: 'luosha', text: '大王，住手吧！孩儿已在南海，你若再被押走，这翠云山还剩下谁？' },
    { who: 'luosha', text: '他要扇子，我借。你把兵刃放下，跟我回去。' },
    { who: 'niumowang', text: '……连你也这样说。罢了！由他拿去。这个平天大圣，今日便做到头！' },
  ],
  ending: [
    { scene: 'battle', text: '白牛伏地收角。悟空握着方才交战用过的真扇，望向罗刹女。' },
    { who: 'luosha', text: '拿去吧。把山下的火熄了，莫再叫那些人守着焦田过日子。' },
    { fan: 1, text: '悟空登上高坡，朝火焰山挥出第一扇。烈焰齐齐低头，八百里火光顷刻退去。' },
    { fan: 2, text: '第二扇生风。清风卷走灰烬，烧断的西路重新露了出来。' },
    { fan: 3, text: '第三扇落雨。雨脚越过山脊，焦黑的土缝里慢慢透出青色。' },
    { text: '悟空又连扇四十九扇，直到地底再无火声，才把扇子合起。' },
    { text: '次日清晨，悟空依约回到翠云山，将芭蕉扇原物奉还。罗刹女接过扇子，没有再提旧账。' },
    { text: '师徒谢过土地，沿着雨后新开的山路继续西行。身后，百姓已经扛着锄头走进田里。' },
  ],
};

export const CHOICES = {
  approach: {
    title: '罗刹女双剑出鞘，如何迎战？',
    options: [
      { key: 'calm', label: '听完怨话，稳住阵脚', note: '让沙僧整队：头两回合，全队所受伤害减少 15%。' },
      { key: 'rush', label: '先试剑法，强攻破势', note: '悟空抢先逼住剑锋：头两回合，悟空攻击提高 15%。' },
    ],
  },
  treasure: {
    title: '灵吉菩萨授宝 · 上阵先带哪一件',
    options: [
      { key: 'dingfengdan', label: '定风丹', art: 'dingfengdan', note: '罗刹女的扇风能把人吹出五万里，洞中妖丝也缠脚。带上此丹：全队速度 +6，不受迟滞。' },
      { key: 'bihuojin', label: '避火锦', art: 'bihuojin', note: '前面是八百里火焰山，火兵与牛魔王都使烈焰。披上此锦：全队所受火伤减少四分之一。' },
    ],
  },
  fanTrial: {
    title: '借来的扇子，先往哪里试？',
    options: [
      { key: 'ember', label: '先试路边小火', note: '先辨扇势，不对便收手，不惊动大火。' },
      { key: 'full', label: '直扇火焰山口', note: '一扇见分晓。若扇势有异，火口的妖怪会借火逞凶：头三回合攻击提高 30%。' },
    ],
  },
  deal: {
    title: '被缚的火妖收住烈焰，不再挣扎',
    options: [
      { key: 'keep', label: '留在队中', note: '赤焰火妖留作召唤兽，可继续上阵。' },
      { key: 'release', label: '解绳放归', note: '火妖离队。它指的一条旧退路，能在残图外层替你避过头一回妖气。' },
    ],
  },
  loot: {
    title: '摩云洞兵器架上三件好物 · 悟空拣一件',
    options: [
      { key: 'ruyibang_jing', label: '点钢棒箍', note: '攻击 +12，暴击 +5%。下一战便要对上老牛，先把他的混铁棍压回去。' },
      { key: 'suozijia', label: '锁子黄金甲', note: '防御 +12，气血 +40。老牛蓄力一棍极重，先站得住，才有机会还手。' },
      { key: 'fengchiguan', label: '凤翅紫金冠', note: '速度 +8，暴击 +3%。赶在老牛出棍之前动手。' },
    ],
  },
  pond1: {
    title: '变作什么潜进碧波潭？',
    options: [{ key: 'insect', label: '变蟭蟟虫' }, { key: 'crab', label: '变螃蟹' }, { key: 'brute', label: '不变化，提棒硬闯' }],
  },
  pond2: {
    title: '宴席就在前面，怎么靠近？',
    options: [{ key: 'shift', label: '等巡守换岗，贴着廊柱过去' }, { key: 'rush', label: '直接游进宴席' }],
  },
  pond3: { title: '辟水金睛兽就在眼前', options: [{ key: 'steal', label: '挑开缰绳，骑上便走' }] },
  bajie: {
    title: '八戒伸手来接扇子——',
    options: [{ key: 'check', label: '先问：师父原话怎么说？' }, { key: 'give', label: '把扇子递给师弟' }],
  },
};

// 战外对白的底景：说话的地方是哪里，就用哪里的图（灵吉在小须弥山，不在罗刹女洞府外）
export const STORY_BG = { lingji: 'xumi' };

// 二借交扇：化虫入腹得手与硬打到认输，各走各的台词，再接同一段交扇
export const fanHandover = (intoBelly) => [...(intoBelly ? STORY.intoBelly : STORY.luoshaYield), ...STORY.gotFan];

export const CHAPTERS = {
  c1: { bg: 'cuiyun', title: '第一借 · 洞前起风', sub: '第五十九回　唐三藏路阻火焰山　孙行者一调芭蕉扇' },
  c2: { bg: 'cuiyun', title: '第二借 · 化虫取扇', sub: '硬借不成，便钻进她肚里去借' },
  c3: { bg: 'huoyan', title: '第三借 · 各显变化', sub: '第六十回　牛魔王罢战赴华筵　孙行者二调芭蕉扇（原著把前两借合称一调，这一借即书里的二调）' },
  c4: { bg: 'leiji', title: '积雷山 · 决战', sub: '第六十一回　猪八戒助力败魔王　孙行者三调芭蕉扇' },
};

// 土地的封妖令
export const BOUNTY = {
  offer: '大圣，炉砖缝里又钻出火妖，搅得四下不得安生。这道封妖令，可愿接下？',
  hunting: '那火妖还在闹着，大圣快去。它就在明处游走，过去点它便是。',
  report: '大圣辛苦，庄上都记着这份情。还有一处火妖，接着去么？',
  roundDone: '十环已满！小神从庙里翻出一件旧物，已放进大圣行囊。',
};

export const SHOP_LINES = { gaoshao: '客官要点什么？糕管饱，药管用。', laozhe: '兵器护甲，都是自家炉里打的。' };

export const HELP = [
  ['行路', '点地面行走，也可用方向键。头顶有「!」的人推动主线；点右上的任务，悟空会自己走过去，隔着山也认得路。'],
  ['交战', '每回合先给每位伙伴下令，再看敌我按速度快慢依次出手。上方那一排头像就是出手顺序。'],
  ['五行', '金克木、木克土、土克水、水克火、火克金。克制对手，伤害多五成；被对手克制，只剩六成六。选目标时会先告诉你。'],
  ['法术与防御', '法术耗法力。防御让这回合受伤减半，还回一成法力。'],
  ['特技', '挨打会攒愤怒，攒够了人人能放特技。悟空另有七十二变：三回合内换一身五行与招式。'],
  ['封妖令', '借过一回扇之后，可找土地领封妖令：明处游走的火妖，点它开打，得历练、银两与兵甲。'],
  ['存档', '每场战斗之后自动存档。设置里也可以随时手动存。'],
];

// 首战的逐步指点：只在对应时刻出现一条
export const COACH = {
  wukong1: '悟空属金，罗刹女属木——金克木。点【攻击】，再点罗刹女。',
  bajie1: '八戒的钉耙一扫三个：点【法术】，选「钉耙乱筑」。',
  sha1: '沙僧稳得住：点【防御】，这回合受伤减半，还回一点法力。',
  ke: '金克木：这一下多打了五成。选对五行，比多打一棍管用。',
  round2: '上方是出手顺序，快的先动。指令已全部放开，随你调遣。',
  weary: '罗刹女已露疲态。轮到悟空时点【特技】，选「七十二变 · 蟭蟟虫」。',
  burn: '地火每回合烧人，属水的不怕。悟空的七十二变里，玄甲龟将属水。',
  fan: '土地传音：「真扇就在【道具】里！三扇须依次扇出——息火、生风、落雨。这一战『自动』不会替你扇。」',
  heavy: '老牛在蓄力！下一击已锁定此刻气血最少的人（头顶「被盯上」），给他补血也不会换人：让他【防御】、喂药，或由伙伴【保护】。',
};

// 结局第 i 句（从 0 数）时画面上是哪一层地景：头一句还在积雷山战场，罗刹女说「把山下的火熄了」时看见烈火，一扇火灭成灰（灰雾未散）、二扇风吹开灰雾露出西路、三扇落雨，末两句换还扇西行图。
// 结局页按这条规则换图，回归据此核对字幕写到的火势与画面一致。
export function endingScene(i, lines = STORY.ending) {
  if (lines[i]?.scene) return lines[i].scene;
  if (i >= lines.length - 2) return 'farewell';
  const fan = Math.max(0, ...lines.slice(0, i + 1).map((l) => l.fan ?? 0));
  return ['fire', 'ash', 'wind', 'rain'][fan];
}
