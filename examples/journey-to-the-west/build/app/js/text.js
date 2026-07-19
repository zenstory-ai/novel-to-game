// 玩家可见文案集中于此(简体中文)。数据表里的单位/技能名属于数据,在 data.js。

export const TEXT = {
  gameTitle: '西游记 · 三借芭蕉扇',
  gameSubtitle: '回合制指令 RPG · 第五十九至六十一回',

  title: {
    start: '开始游戏',
    cont: '继续游戏',
    help: '如何游玩',
    newConfirm: '已有存档,开始新游戏将覆盖。确定?',
  },

  topbar: {
    save: '存档', load: '读档', formation: '阵型', help: '帮助',
    hero: '角色', bag: '背包', pet: '召唤兽',
    soundOn: '音效', soundOff: '静音',
  },

  panels: {
    hero: '角色 · 队伍',
    bag: '背包',
    pet: '召唤兽',
    petEmpty: '尚未收服召唤兽。渡过碧波潭后,辟水金睛兽会来投。',
    points: '可用点数',
    recommend: '推荐加点',
    pointsHint: '加点系统随成长玩法开放,敬请期待。',
    bagEmpty: '空空如也',
  },

  commands: {
    attack: '攻击', skill: '法术', defend: '防御', item: '道具',
    special: '特技', auto: '自动', flee: '逃跑',
    back: '返回', targetPick: '选择目标', transform: '七十二变', formation: '切换阵型',
  },

  ui: {
    round: '第 {n} 回合',
    orderTitle: '行动顺序',
    hp: '体力', mp: '法力',
    victory: '战斗胜利!',
    defeat: '败北……',
    levelUp: '等级提升!',
    newSkill: '习得新法术',
    retry: '重整旗鼓',
    continueBtn: '继续',
    gotItem: '获得',
    clickNext: '▼ 点击继续',
    commandFor: '为 {name} 选择指令',
    autoSet: '{name} 交给自动',
    escaped: '成功逃脱!',
    escapeFail: '未能逃脱!',
    bossNoEscape: '此战无法逃脱!',
    noMp: '法力不足!',
    saved: '已存档',
    loaded: '已读档',
    noSave: '没有找到存档',
    formationNow: '当前阵型',
    buffShow: '{name}:{turns}',
  },

  float: {
    crit: '暴击', ke: '克!', beike: '被克', miss: '落空', combo: '连击!',
    defend: '防御', stun: '眩晕', heal: '+{n}', mpUp: '法力+{n}',
    transform: '变化 · {name}', formEnd: '变回原形',
    fleeOk: '脱身!', fleeNo: '逃不掉!',
  },

  battle: {
    telegraph: '{name}蓄力——下回合『{skill}』!',
    heavyMitigated: '防住了!',
    previewKe: '克! ×1.5', previewBeike: '被克 ×0.66', previewNone: '普通',
    formationBtn: '阵型:{name}',
    formationUsed: '本回合已换过阵型',
    specialTip: '悟空专属:七十二变,改五行换技能三回合(无消耗)',
    autoTip: '让 AI 替这个伙伴打一回合(BOSS 战只普攻)',
    attackTip: '不耗法力的普通攻击',
    skillTip: '耗法力的招式:单体/群体/增益减益',
    defendTip: '本回合受伤减半,回复 5% 法力',
    itemTip: '使用丹药与芭蕉扇',
    fleeTip: '脱离战斗(BOSS 战无效)',
  },

  buffNames: {
    atk_up: '攻击↑', atk_down: '攻击↓', def_down: '破防', dmg_reduce: '罗汉金身',
    hit_up: '金睛', spd_up: '生风', regen: '落雨', stun: '眩晕',
    vulnerable: '破绽', ke_shield: '龟甲',
  },

  fanMsgs: {
    fakefan: '假扇反噬!火势更旺,火妖攻击提升!',
    fan1: '真扇第一扇 · 息火!敌方增益尽散、攻势受挫!',
    fan2: '真扇第二扇 · 生风!全队速度提升!',
    fan3: '真扇第三扇 · 落雨!甘霖普降,全队持续恢复,敌方破绽大开!',
    fanUsedUp: '真扇三段已用尽',
    noItem: '没有此道具',
    fallback: '{name} 招式受阻,改为普攻',
  },

  tutorial: {
    title: '第一次战斗 · 怎么打',
    lines: [
      '① 先为每位伙伴依次选择指令:攻击 / 法术 / 防御 / 道具 / 特技 / 自动 / 逃跑。',
      '② 全员下完指令后,双方按【速度】从高到低依次行动(看上方行动顺序条)。',
      '③ 五行相克:金→木→土→水→火→金。克制伤害×1.5 并飘「克!」,被克只有×0.66。出手前点目标可看预览。',
      '④ 法力金贵:技能放几次就见底,普攻穿插防御回蓝,「何时开大」要算计。',
      '⑤ 悟空(金)正克罗刹女(木)。她的芭蕉扇风会打全体,注意体力!',
    ],
    ok: '开战!',
    hintTransform: '罗刹女体力不支!用悟空【特技→七十二变】化作蟭蟟虫,可一举取胜!',
  },

  help: {
    title: '如何游玩',
    body: [
      '【走】小世界里点击地面移动,点击土地问话,去东北方找罗刹女。',
      '【战】每回合先给每位伙伴下指令,下完后双方按速度从高到低依次行动。',
      '【克】金→木→土→水→火→金。克制×1.5 飘「克!」,被克×0.66;出手前把目标对准敌人可看预览。',
    ],
  },

  // 首次相关时的即时小卡片
  onceCards: {
    transform: {
      title: '七十二变',
      lines: [
        '悟空的变化不耗法力,持续三回合:换五行、换属性、换技能。',
        '金甲神将(金)强攻群体、赤焰灵猿(火)火法、玄甲龟将(水)硬克火敌且被克减伤、蟭蟟虫(金)抢速。',
        '诀窍:看敌人五行选形态——按钮会标注能克到谁。',
      ],
    },
    fakefan: {
      title: '假扇与捕妖绳',
      lines: [
        '这柄「芭蕉扇·伪」越扇火越旺,用它会助长火妖(反噬)——留着看个教训也好。',
        '火兵血气≤40%时,可用「捕妖绳」收服为召唤兽,日后上阵助战。',
        '火炎校尉会召唤火兵增援:先集火主将,或用水系法术克火。',
      ],
    },
    truefan: {
      title: '真扇三段',
      lines: [
        '真扇一扇息火(清敌增益+减攻)、二扇生风(全队提速)、三扇落雨(持续回血+敌方破绽:受伤+40%)。',
        '牛魔王每三回合蓄力重击——让血量最低的伙伴防御,或提前开罗汉金身。',
        '白牛真身每回合狂暴叠攻:开落雨破绽,速战集火!',
      ],
    },
  },

  // ---------- 战役剧情 ----------
  story: {
    prologueIntro: [
      { who: null, text: '大唐贞观年间,唐僧师徒西行取经。这一日行至八百里火焰山,只见四季炎热,寸草不生,西路被大火封得严严实实。' },
      { who: 'tang', text: '徒弟们,这般热气,人尚未近,汗已透衣。这火焰山,如何过得去?' },
      { who: 'bajie', text: '师父,依老猪说,不如绕路。哪怕多走三五年,也强过在这火炉里烤熟!' },
      { who: 'wukong', text: '呆子!取经哪有回头路?师父莫急,待俺老孙打听打听。前面有个土地庙,先去问路!' },
      { who: 'sha', text: '大师兄腿脚快,先去探路便是。担子有我挑,师父有我护,放心。' },
    ],
    tudiTalk: [
      { who: 'tudi', text: '大圣!小神是火焰山土地。这八百里火焰,四季不熄,周遭百里,铜脑铁胆也要化为汁水。' },
      { who: 'tudi', text: '要过此山,只有一法:去翠云山芭蕉洞,借铁扇仙的芭蕉扇。那扇子一扇息火、二扇生风、三扇下雨,本地百姓靠她十年一求,熄火种粮。' },
      { who: 'wukong', text: '铁扇仙是何等人物?肯借么?' },
      { who: 'tudi', text: '铁扇仙又名罗刹女,是牛魔王之妻、红孩儿之母。大圣啊,红孩儿在火云洞被观音收去,她母子天各一方——她嘴里,可一直念着您的名儿。' },
      { who: 'wukong', text: '原来是牛魔王的娘子。五百年前俺与他还有结拜之情,这就去借扇!' },
      { who: 'tudi', text: '大圣慢走!小神备了些丹药与一条捕妖绳,路上用得着。切记:好言相借,若动起武来,她那扇子可不是闹着玩的!' },
    ],
    tudiTalkAgain: [
      { who: 'tudi', text: '罗刹女就在东北方芭蕉洞外。大圣,好言相借,切莫动粗啊。她那两个侍婢,也颇有些手段。' },
    ],
    luoshaPre1: [
      { who: 'luosha', text: '孙悟空!你还有脸上我这翠云山?' },
      { who: 'luosha', text: '我孩儿红孩儿,被你这厮撺掇观音收去,母子天各一方——这口气,我咽了三年!' },
      { who: 'wukong', text: '嫂嫂息怒。红孩儿随观音做了善财童子,是成正果,好过占山为妖。' },
      { who: 'wukong', text: '今日俺不为别的:火焰山阻路,求借芭蕉扇一用,熄火之后,完璧奉还!' },
      { who: 'luosha', text: '成正果?我只知道娘想儿!要借扇——先问过我手中双剑,再问过我洞中姐妹!' },
      { who: 'shibi', text: '夫人说得是!这猴子好大的口气,姐妹们,伺候了!' },
    ],
    blowAway: [
      { who: 'luosha', text: '好个齐天大圣,也不过如此。且叫你尝尝我这芭蕉扇的滋味!' },
      { who: null, text: '罗刹女捻诀祭扇,阴风骤起——悟空立脚不住,如风中落叶,被一扇吹出五万余里!' },
      { who: 'wukong', text: '好厉害的扇子!……这风不是常风,硬闯是回不去了。' },
      { who: 'wukong', text: '想当年灵吉菩萨赠过定风丹,专克这路神风。待俺老孙去小须弥山走一遭!' },
    ],
    lingji: [
      { who: 'lingji', text: '大圣别来无恙。当年你大闹天宫,如来命我押你,不想今日为火焰山而来。' },
      { who: 'wukong', text: '菩萨明鉴:罗刹女的芭蕉扇阴风歹毒,一扇把俺扇出五万里。特来求借定风丹!' },
      { who: 'lingji', text: '那芭蕉扇乃混沌开辟、昆仑山后的一柄宝扇,天地灵宝,非凡风可比。' },
      { who: 'lingji', text: '这颗定风丹,你且吞了:百风不侵,纵是芭蕉扇,也休想再动你分毫。去吧。' },
      { who: 'wukong', text: '多谢菩萨!待俺再会会那嫂嫂!' },
    ],
    luoshaPre2: [
      { who: 'luosha', text: '泼猴!吃了我一扇,居然还敢回来?' },
      { who: 'wukong', text: '嫂嫂,俺老孙又回来了!你那扇子,今日只管扇!' },
      { who: null, text: '罗刹女连挥数扇,阴风怒号——悟空吞了定风丹,立在风中,纹丝不动!' },
      { who: 'luosha', text: '这、这怎么可能?!好猴子,真个有些手段……姐妹们,结阵再战!' },
    ],
    luoshaMid: [ // 化虫入腹演出
      { who: null, text: '悟空摇身一变,化作一只蟭蟟虫,趁罗刹女喘息之际,飞入她腹中!' },
      { who: 'luosha', text: '哎哟!疼煞我也!……叔叔饶命,扇子给你便是!' },
      { who: 'wukong', text: '承让承让,借扇一用,熄火即还!' },
    ],
    postBattle1: [
      { who: 'luosha', text: '……扇子拿去!只一条:息了火,须还来!' },
      { who: 'wukong', text: '自然,自然!俺老孙一言九鼎。' },
      { who: null, text: '罗刹女交出芭蕉扇。悟空谢过土地与灵吉,径回火焰山。' },
      { who: 'wukong', text: '扇子到手!师父,看我扇灭这八百里火焰!' },
    ],
    preBattle2: [
      { who: null, text: '悟空来到火前,用力一扇——火光冲天;再扇,火势更旺;三扇,三条火线封死西路!' },
      { who: 'tudi', text: '大圣使不得!这是假扇!真扇一扇息火,这扇越扇火越旺!' },
      { who: 'tudi', text: '这火焰本是五百年前大圣蹬倒八卦炉,落下的余火砖所化……如今火中生出火兵作乱!' },
      { who: 'wukong', text: '好个罗刹女,竟敢哄俺!……师父莫慌,先退了这伙火妖,再找牛魔王算总账!' },
      { who: 'tudi', text: '大圣,火妖血气一衰,正可用捕妖绳收服一二,日后也是个帮手!' },
    ],
    postBattle2: [
      { who: 'wukong', text: '火兵已退。土地,真扇究竟在何处?' },
      { who: 'tudi', text: '真扇还在罗刹女手中。可她只认自家夫君——要取真扇,除非从牛魔王身上想法子。牛魔王现居积雷山摩云洞。' },
      { who: 'tudi', text: '那老牛最爱赴宴,听闻碧波潭龙王常请他吃酒。大圣机变,或可从他行止上做文章。' },
      { who: 'bajie', text: '猴哥,那老牛神通广大,我老猪陪你走一遭!' },
    ],
    preYumian: [
      { who: null, text: '师徒别了火焰山土地,径上积雷山。摩云洞前,怪石嵯峨,妖云缭绕。' },
      { who: 'wukong', text: '牛魔王!五百年前的结拜哥哥,出来见见!' },
      { who: 'bajie', text: '猴哥,这洞里妖气不轻,小心有埋伏。' },
      { who: 'sha', text: '大师兄叫阵,二哥掠阵,我守师父。' },
    ],
    yumianPre: [
      { who: 'yumian', text: '哪里来的野猴,敢在摩云洞前大呼小叫?' },
      { who: 'wukong', text: '俺是孙悟空,寻牛魔王借样东西。你是何人?' },
      { who: 'yumian', text: '好没规矩!我家大王,也是你见得着的?' },
      { who: 'yumian', text: '我乃玉面公主,这摩云洞的女主人。小的们,把这泼猴轰下山去!' },
      { who: 'yaojiang', text: '公主有令——拿下!' },
      { who: 'wukong', text: '好个娇蛮的婆娘!那就先打过再说!' },
    ],
    postYumian: [
      { who: 'yumian', text: '哎哟……大王救我!这猴子欺负人!' },
      { who: 'niumowang', text: '何人在我摩云洞撒野?!……呵,原来是贤弟。五百年不见,你倒打上门来了?' },
      { who: 'wukong', text: '牛哥,非是俺不讲情面。你夫人纵婢行凶在先,俺只是借扇过山!' },
      { who: 'niumowang', text: '借扇?欺到我妻妾头上,还敢提"借"字!贤弟,今日须见个高下!' },
    ],
    niu1Retreat: [
      { who: null, text: '正战间,小妖来报:碧波潭老龙设宴,请大王赴会。' },
      { who: 'niumowang', text: '哼。贤弟,今日且看在这五百年结拜份上,暂且饶你!' },
      { who: 'niumowang', text: '本王还要去碧波潭赴宴——牵我的辟水金睛兽来!' },
      { who: 'wukong', text: '赴宴?……那老牛日日骑的那头金睛兽,倒是个稀罕物。' },
      { who: 'wukong', text: '有了!俺老孙且跟他一程,去碧波潭看个究竟!' },
    ],
    bibotanIntro: [
      { who: null, text: '悟空跟着牛魔王的蹄印,来到碧波潭边。潭水深蓝,水底宫殿隐隐透出宴席灯火。' },
      { who: 'wukong', text: '牛魔王在里面吃酒。硬闯,潭深水急;得变个模样混进去。' },
    ],
    bibotanChoice1: {
      title: '变作什么潜入碧波潭?',
      options: [
        { key: 'insect', label: '蟭蟟虫(太小,恐被水流冲走)' },
        { key: 'crab', label: '螃蟹(水族同类,横行无碍)' },
        { key: 'brute', label: '不变,硬闯!' },
      ],
    },
    bibotanInsectFail: [
      { who: null, text: '悟空化作蟭蟟虫扎入水中——潭底暗流一卷,小小的虫身哪里立得住,被冲回了岸边。' },
      { who: 'wukong', text: '这水不认虫,得变个水族才行!' },
    ],
    bibotanBruteFail: [
      { who: null, text: '悟空抡棒刚要下水,两名虾将横叉拦住:「碧波潭禁地,来者通名!」水面妖气大盛。' },
      { who: 'wukong', text: '硬闯要坏事……还是变个模样混进去。' },
    ],
    bibotanCrabOk: [
      { who: null, text: '悟空摇身一变,化作一只大螃蟹,横着身子沉入潭底。虾兵蟹将只当是同类,谁也不曾多看一眼。' },
    ],
    bibotanChoice2: {
      title: '宴席在前,如何接近?',
      options: [
        { key: 'shift', label: '趁巡守换岗,贴着廊柱潜行' },
        { key: 'rush', label: '径直游向宴席正中' },
      ],
    },
    bibotanRushFail: [
      { who: null, text: '螃蟹径直游到殿中,一只老鼋眯眼打量:「哪来的生蟹?」巡守围拢过来,悟空只得退回暗处。' },
      { who: 'wukong', text: '急不得,等个换岗的空当。' },
    ],
    bibotanShiftOk: [
      { who: null, text: '巡守换岗的间隙,螃蟹贴着廊柱横身而过,一直摸到宴席侧畔。' },
      { who: null, text: '只见牛魔王高坐主位,与老龙把盏谈笑;殿柱上,正拴着那头辟水金睛兽。' },
    ],
    bibotanChoice3: {
      title: '辟水金睛兽就在眼前!',
      options: [
        { key: 'steal', label: '解了缰绳,骑上就走!' },
      ],
    },
    bibotanStealOk: [
      { who: null, text: '螃蟹钳子一挑,缰绳落地。悟空现了本相,翻身骑上金睛兽,冲出碧波潭!' },
      { who: 'wukong', text: '好畜生,借你代步一用!哈哈哈哈!' },
      { who: null, text: '辟水金睛兽本是通灵之物,几番较量,竟服了悟空——辟水金睛兽加入召唤兽!' },
    ],
    pianzhen: [
      { who: null, text: '悟空骑着辟水金睛兽,一路回到翠云山。他摇身一变,化作牛魔王模样,大摇大摆走进芭蕉洞。' },
      { who: 'wukong', text: '夫人,我回来了。那猴子又来缠斗,被我打发了。扇子可还在?' },
      { who: 'luosha', text: '大王回来便好。扇子在此,且收好——莫再教那猴子骗了去。' },
      { who: 'luosha', text: '……奇怪,大王今日,怎么满身水汽?' },
      { who: 'wukong', text: '碧波潭老龙留我吃了几杯水酒。夫人,真扇既在,俺自去熄了火焰山!' },
      { who: null, text: '罗刹女不疑有他,取出真扇相付。悟空接扇在手,心中暗喜,出洞现了本相,扬长而去。' },
    ],
    fanpian1: [
      { who: null, text: '悟空揣着真扇,得意洋洋往回走。迎面忽见「八戒」气喘吁吁赶来。' },
      { who: 'fakeBajie', text: '猴哥!师父怕你拿了扇子不会用,叫我来接应你!' },
      { who: 'wukong', text: '(这呆子来得倒巧……)' },
    ],
    fanpianChoice: {
      title: '「八戒」要替悟空拿扇——',
      options: [
        { key: 'check', label: '多问一句:师父原话怎么说的?' },
        { key: 'give', label: '自家兄弟,把扇交给他' },
      ],
    },
    fanpianCheck: [
      { who: 'fakeBajie', text: '师、师父说……说叫你快快回去!' },
      { who: 'wukong', text: '呔!师父从不多话。你是哪来的妖怪,敢变俺师弟?!' },
      { who: null, text: '「八戒」见被识破,就地一滚,现出牛魔王本相。原来他也会七十二变!' },
      { who: 'niumowang', text: '泼猴!倒有几分眼力!扇子今日你休想拿走!' },
    ],
    fanpianGive: [
      { who: null, text: '悟空顺手把扇递过去。「八戒」接扇在手,哈哈大笑,就地一滚,现出牛魔王本相!' },
      { who: 'niumowang', text: '泼猴!你会骗,我也会骗!这扇子,物归原主了!' },
      { who: 'wukong', text: '一时得意,竟着了这老牛的道!……追!' },
    ],
    preBattle3: [
      { who: null, text: '正在纠缠,真八戒与土地赶到。八戒一见两个「猴哥」争扇,抡耙便上。' },
      { who: 'bajie', text: '好你个老牛,敢变我的模样骗人!猴哥,我老猪来助你了!' },
      { who: 'tudi', text: '大圣!牛魔王神通广大,不可硬拼。小神已急报上天,哪吒三太子与李天王即刻就到!' },
      { who: 'sha', text: '二师兄攻侧翼,我守中路护住师父。大师兄,放开手脚去战。' },
      { who: 'niumowang', text: '泼猴!欺我妻、盗我兽、骗我扇——五百年的结拜之情,今日一笔勾销!' },
      { who: 'niumowang', text: '我平天大圣纵横三界,纵有天兵天将,又奈我何?!' },
    ],
    godAssistDialog: [
      { who: null, text: '云端一声炮响,哪吒三太子脚踏风火轮,托塔李天王手举照妖镜,率天兵压住阵脚!' },
      { who: 'nezha', text: '牛魔王!休得逞凶!' },
    ],
    phase2: [
      { who: null, text: '牛魔王现出白牛真身!头如峻岭,角似铁塔,每回合愈发狂暴——开落雨破绽,集火速决!' },
    ],
    phase2: [
      { who: null, text: '牛魔王现出白牛真身!头如峻岭,角似铁塔,每回合愈发狂暴——开落雨破绽,集火速决!' },
    ],
    ending: [
      { who: null, text: '白牛被众神降伏,牛魔王低头归顺,罗刹女捧出真扇,情愿皈依正道。' },
      { who: 'luosha', text: '扇子……拿去吧。只盼这一回,真能熄了这八百里火。' },
      { who: null, text: '悟空执扇,对着火焰山:一扇息火,八百里烈焰顿收;' },
      { who: null, text: '二扇生风,清风四散,灰烬让出西路;' },
      { who: null, text: '三扇落雨,甘霖普降,焦土重现青色。' },
      { who: null, text: '又连扇四十九扇,断绝火根——火焰山自此成了清凉世界。' },
      { who: null, text: '次日,悟空依言将芭蕉扇归还罗刹女。恩怨两消。' },
      { who: null, text: '师徒四人谢过土地,在雨后清风中踏上西行之路。百姓安居乐业,年年岁岁,风调雨顺。' },
    ],
    endingTitle: '—— 三借芭蕉扇 · 完 ——',
    restart: '再玩一次',
  },

  speakers: {
    wukong: '孙悟空', tang: '唐僧', bajie: '猪八戒', sha: '沙悟净',
    tudi: '土地', luosha: '罗刹女', niumowang: '牛魔王', pixie: '辟水金睛兽',
    lingji: '灵吉菩萨', shibi: '侍婢', huobao: '赤焰火骝',
    yumian: '玉面公主', yaojiang: '摩云洞妖将',
    fakeBajie: '「八戒」', nezha: '哪吒三太子', litianwang: '托塔李天王',
  },

  overworld: {
    title: '序幕 · 火焰山脚',
    tip: '点击地面行走;点击土地问话;去东北方找罗刹女借扇。',
    battle: '前往翠云山芭蕉洞',
  },
};
