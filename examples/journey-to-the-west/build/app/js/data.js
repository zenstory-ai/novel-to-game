// 战斗数据表：单位/敌人/技能/阵型/道具/变化形态/战役战斗。
// 引擎只读这些表，新增角色/敌人/技能只加数据，不改引擎。

// 五行相克：金克木、木克土、土克水、水克火、火克金
export const ELEMENTS = {
  金: { beats: '木' },
  木: { beats: '土' },
  土: { beats: '水' },
  水: { beats: '火' },
  火: { beats: '金' },
};

// 克制系数
export const ELEMENT_COEF = { ke: 1.5, beike: 0.66, none: 1.0 };

// kind: 'phy' 用攻击, 'mag' 用灵力; target: enemy/enemies/ally/party/self
export const SKILLS = {
  // —— 悟空 ——
  ruyibang: { name: '棒打', kind: 'phy', mul: 1.8, mp: 16, target: 'enemy', hit: 0.95, desc: '物理单体高伤' },
  huoyan: { name: '火眼金睛', kind: 'mag', mul: 0, mp: 22, target: 'enemy', buff: { id: 'def_down', val: 0.35, turns: 3 }, desc: '识破破绽，敌防御-35%(3回合)' },
  hengsao: { name: '横扫千军', kind: 'phy', mul: 1.15, mp: 20, target: 'enemies', hit: 0.92, desc: '物理群体' },
  // —— 八戒 ——
  jiuchipaba: { name: '钉耙乱筑', kind: 'phy', mul: 1.05, mp: 16, target: 'enemies', hit: 0.92, desc: '物理群体' },
  gongdi: { name: '拱地', kind: 'phy', mul: 0.8, mp: 18, target: 'enemy', hit: 0.9, buff: { id: 'stun', val: 0, turns: 1, chance: 0.65 }, desc: '65%概率击晕敌一回合' },
  // —— 沙僧 ——
  xiangyaozhang: { name: '宝杖降妖', kind: 'phy', mul: 1.35, mp: 14, target: 'enemy', hit: 0.97, selfHeal: 0.35, desc: '稳定单体，自愈35%伤害量' },
  luohanjinshen: { name: '罗汉金身', kind: 'mag', mul: 0, mp: 30, target: 'party', buff: { id: 'dmg_reduce', val: 0.3, turns: 3 }, desc: '全队受伤-30%(3回合)' },
  // —— 辟水金睛兽(宠) ——
  pishuijue: { name: '辟水诀', kind: 'mag', mul: 1.25, mp: 24, target: 'enemies', desc: '水系群体，克火' },
  jinjing: { name: '金睛', kind: 'mag', mul: 0, mp: 18, target: 'party', buff: { id: 'hit_up', val: 0.15, turns: 3 }, desc: '全队命中+15%(3回合)' },
  // —— 变化形态附带技 ——
  shenjiang_sao: { name: '神将横扫', kind: 'phy', mul: 1.3, mp: 0, target: 'enemies', hit: 0.92, desc: '变化技·物理群体' },
  lieyan_quan: { name: '烈焰拳', kind: 'mag', mul: 1.7, mp: 0, target: 'enemy', desc: '变化技·火系单体' },
  xuanbing_ji: { name: '玄冰击', kind: 'mag', mul: 2.0, mp: 0, target: 'enemy', desc: '变化技·水系单体' },
  // —— 敌方 ——
  shuangjian: { name: '双剑击', kind: 'phy', mul: 1.35, mp: 0, target: 'enemy', hit: 0.93, desc: '' },
  zhiwang: { name: '织网缠丝', kind: 'mag', mul: 0.7, mp: 0, target: 'enemy', buff: { id: 'spd_down', val: 0.15, turns: 2 }, desc: '妖丝缠身，速度下降' },
  hujia: { name: '护主心切', kind: 'mag', mul: 0, mp: 0, target: 'ally', heal: 0.8, desc: '抢救主人' },
  huanhuo: { name: '唤火助威', kind: 'mag', mul: 0, mp: 0, target: 'self', summon: { key: 'firemob1', count: 1, maxSummons: 1 }, cooldown: 3, desc: '召唤一波火兵' },
  yaofa: { name: '妖法迷人', kind: 'mag', mul: 0.95, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  jiaoman: { name: '娇蛮', kind: 'mag', mul: 0, mp: 0, target: 'enemy', buff: { id: 'atk_down', val: 0.25, turns: 2 }, desc: '' },
  tiebi: { name: '铁臂横扫', kind: 'phy', mul: 0.9, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  kanxi: { name: '看守重击', kind: 'phy', mul: 1.45, mp: 0, target: 'enemy', hit: 0.9, desc: '' },
  // 扇风卷人：命中附带减速(定风丹可免，见 TREASURES.dingfengdan)
  shanfeng: { name: '芭蕉扇风', kind: 'phy', mul: 0.85, mp: 0, target: 'enemies', hit: 0.9, buff: { id: 'spd_down', val: 0.15, turns: 2 }, desc: '' },
  huoqiu: { name: '火弹', kind: 'mag', mul: 1.25, mp: 0, target: 'enemy', hit: 0.92, desc: '' },
  lieyan: { name: '烈焰喷吐', kind: 'mag', mul: 1.0, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  // —— Lv4-6 解锁(批0 技能表补齐) ——
  qitian: { name: '齐天棍影', kind: 'phy', mul: 2.1, mp: 24, target: 'enemy', hit: 0.9, critBonus: 0.1, desc: '物理单体大伤，易暴击' },
  zhenhai: { name: '镇海一棒', kind: 'phy', mul: 1.45, mp: 26, target: 'enemies', hit: 0.9, desc: '物理群体重击' },
  douzhan: { name: '斗战神通', kind: 'mag', mul: 0, mp: 20, target: 'self', buff: { id: 'atk_up', val: 0.25, turns: 3 }, desc: '自身攻击+25%(3回合)' },
  hengpa: { name: '横耙拦截', kind: 'phy', mul: 1.2, mp: 18, target: 'enemies', hit: 0.9, desc: '物理群体' },
  tunshan: { name: '吞山食力', kind: 'phy', mul: 1.4, mp: 20, target: 'enemy', hit: 0.92, selfHeal: 0.6, desc: '单体，大量自愈' },
  gangtie: { name: '钢鬃铁背', kind: 'mag', mul: 0, mp: 16, target: 'self', buff: { id: 'def_up', val: 0.4, turns: 3 }, desc: '自身防御+40%(3回合)' },
  liusha: { name: '流沙河怒', kind: 'phy', mul: 1.6, mp: 18, target: 'enemy', hit: 0.97, desc: '稳定单体' },
  hufa: { name: '护法金身', kind: 'mag', mul: 0, mp: 34, target: 'party', buff: { id: 'dmg_reduce', val: 0.4, turns: 2 }, desc: '全队受伤-40%(2回合)' },
  guiyuan: { name: '归元静心', kind: 'mag', mul: 0, mp: 26, target: 'party', heal: 0.9, desc: '群体治疗(灵力加成)' },
  jinglang: { name: '金睛破浪', kind: 'mag', mul: 1.5, mp: 28, target: 'enemies', desc: '水系群体巨浪' },
  bingfeng: { name: '冰封', kind: 'mag', mul: 1.8, mp: 24, target: 'enemy', buff: { id: 'stun', val: 0, turns: 1, chance: 0.5 }, desc: '水系单体,50%冻结' },
  huolian: { name: '火焰连珠', kind: 'mag', mul: 1.3, mp: 14, target: 'enemy', desc: '火系单体' },
  fenye: { name: '焚野', kind: 'mag', mul: 1.1, mp: 20, target: 'enemies', desc: '火系群体' },
  chiyan: { name: '赤焰冲锋', kind: 'phy', mul: 1.5, mp: 16, target: 'enemy', hit: 0.92, desc: '物理单体' },
  tiegun: { name: '混铁棍', kind: 'phy', mul: 1.55, mp: 0, target: 'enemy', hit: 0.93, desc: '' },
  chongzhuang: { name: '蛮牛冲锋', kind: 'phy', mul: 1.15, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  fatian: { name: '法天象地', kind: 'phy', mul: 1.9, mp: 0, target: 'enemy', hit: 0.9, desc: '' },
  sihuo: { name: '地火燎原', kind: 'mag', mul: 1.2, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
};

// 愤怒特技(梦幻式)：我方受伤积累愤怒(上限 150)，特技不耗法力只耗愤怒，人人可用。
// 挨打越重攒得越快；决战的蓄力重击因此也成了翻盘的本钱。
export const SP = { max: 150, gainPerHpPct: 0.9, minGain: 3 };
export const STUNTS = {
  poxue: { name: '破血狂攻', sp: 60, kind: 'phy', mul: 1.7, mp: 0, target: 'enemy', hit: 0.95, desc: '愤怒 60 · 物理单体重击' },
  luohan: { name: '罗汉金钟', sp: 80, kind: 'mag', mul: 0, mp: 0, target: 'party', buff: { id: 'dmg_reduce', val: 0.3, turns: 2 }, desc: '愤怒 80 · 全队受伤 -30%(2回合)' },
  sihai: { name: '四海升平', sp: 110, kind: 'mag', mul: 0, mp: 0, target: 'party', healPct: 0.2, desc: '愤怒 110 · 全队回复 20% 气血' },
};

// 基础攻击(指令「攻击」)
export const BASIC_ATTACK = { name: '攻击', kind: 'phy', mul: 1.0, mp: 0, target: 'enemy', hit: 0.95 };

// 悟空变化形态(特技「七十二变」)：临时改五行/属性/技能
export const FORMS = {
  shenjiang: { name: '金甲神将', element: '金', turns: 3, mods: { atk: 1.4 }, skills: ['shenjiang_sao'], desc: '攻+40%，得群体物理' },
  lieyuan: { name: '赤焰灵猿', element: '火', turns: 3, mods: { mag: 1.45 }, skills: ['lieyan_quan'], desc: '灵力+45%，得火系法术' },
  xuangui: { name: '玄甲龟将', element: '水', turns: 3, mods: { def: 1.6, spd: 0.8, mag: 1.35 }, skills: ['xuanbing_ji'], keShield: true, desc: '防+60%灵力+35%速-20%，被克伤害减半，得水系法术' },
  chongzi: { name: '蟭蟟虫', element: '金', turns: 3, mods: { spd: 1.5, atk: 0.8 }, skills: [], desc: '速+50%攻-20%，抢速自保' },
};

// 我方单位(成长 = 每级增量；唐僧不参战，随队剧情)
export const PARTY = {
  wukong: {
    key: 'wukong', name: '孙悟空', element: '金', portrait: 'wukong', crit: 0.15,
    base: { hp: 520, mp: 80, atk: 95, def: 55, spd: 88, mag: 60 },
    growth: { hp: 62, mp: 4, atk: 10, def: 5, spd: 4, mag: 7 },
    skills: { 1: ['ruyibang'], 2: ['huoyan'], 3: ['hengsao'], 4: ['qitian'], 5: ['zhenhai'], 6: ['douzhan'] },
    hasTransform: true,
    recommendedAlloc: { 攻: 3, 速: 2, 体: 1, 灵: 1 },
  },
  bajie: {
    key: 'bajie', name: '猪八戒', element: '木', portrait: 'bajie', crit: 0.1,
    base: { hp: 640, mp: 55, atk: 88, def: 62, spd: 58, mag: 40 },
    growth: { hp: 80, mp: 3, atk: 9, def: 7, spd: 3, mag: 4 },
    skills: { 1: ['jiuchipaba'], 3: ['gongdi'], 4: ['hengpa'], 5: ['tunshan'], 6: ['gangtie'] },
    recommendedAlloc: { 攻: 2, 体: 2, 防: 1, 速: 1 },
  },
  sha: {
    key: 'sha', name: '沙悟净', element: '土', portrait: 'sha', crit: 0.08,
    base: { hp: 700, mp: 70, atk: 80, def: 70, spd: 62, mag: 55 },
    growth: { hp: 88, mp: 4, atk: 8, def: 8, spd: 3, mag: 6 },
    skills: { 1: ['xiangyaozhang'], 2: ['luohanjinshen'], 4: ['liusha'], 5: ['hufa'], 6: ['guiyuan'] },
    recommendedAlloc: { 体: 2, 防: 2, 攻: 1, 灵: 1 },
  },
  pixie: {
    key: 'pixie', name: '辟水金睛兽', element: '水', portrait: 'pixie', crit: 0.1, isPet: true,
    base: { hp: 560, mp: 90, atk: 78, def: 52, spd: 76, mag: 78 },
    growth: { hp: 66, mp: 5, atk: 8, def: 5, spd: 4, mag: 9 },
    skills: { 1: ['pishuijue'], 2: ['jinjing'], 4: ['jinglang'], 5: ['bingfeng'] },
    recommendedAlloc: { 灵: 3, 速: 1, 体: 1 },
  },
  huobao: {
    key: 'huobao', name: '赤焰火骝', element: '火', portrait: 'mob_fire1', crit: 0.12, isPet: true,
    base: { hp: 470, mp: 70, atk: 82, def: 42, spd: 74, mag: 74 },
    growth: { hp: 56, mp: 4, atk: 9, def: 4, spd: 4, mag: 8 },
    skills: { 1: ['huolian'], 2: ['fenye'], 3: ['chiyan'] },
    recommendedAlloc: { 灵: 2, 攻: 1, 体: 1 },
  },
};

// 成长系统(修炼点：每级 1 点，投给已习得法术换熟练；不再自动进阶)
export const GROWTH = { pointsPerLevel: 5, skillRankCap: 3, statCap: 40, skillPointsPerLevel: 1 };
export const POINT_GAINS = {
  体: { hp: 8 }, 攻: { atk: 2 }, 防: { def: 2 }, 速: { spd: 2 }, 灵: { mag: 2, mp: 1 },
};

// 装备：每人两个槽位(兵器 weapon / 护身 armor)，三阶——
// 一阶 庄上铁匠铺可买；二阶 封妖掉落与十环奖励；三阶 摩云洞剧情缴获。小幅 flat 属性，数值紧。
export const EQUIP_SLOTS = { weapon: '兵器', armor: '护身' };
export const EQUIPS = {
  jingtie: { key: 'jingtie', name: '精铁兵刃', slot: 'weapon', tier: 1, mods: { atk: 5 }, desc: '攻击+5' },
  mianjia: { key: 'mianjia', name: '棉布护甲', slot: 'armor', tier: 1, mods: { def: 4, hp: 24 }, desc: '防御+4，气血+24' },
  bintie: { key: 'bintie', name: '镔铁兵刃', slot: 'weapon', tier: 2, mods: { atk: 8 }, crit: 0.02, desc: '攻击+8，暴击+2%' },
  xipijia: { key: 'xipijia', name: '犀皮甲', slot: 'armor', tier: 2, mods: { def: 7, hp: 36 }, desc: '防御+7，气血+36' },
  // 三阶·摩云洞后缴获三选一(悟空)：输出/生存/节奏三种定位，选后不二退换
  ruyibang_jing: { key: 'ruyibang_jing', name: '如意金箍棒·精', slot: 'weapon', tier: 3, mods: { atk: 12 }, crit: 0.05, desc: '攻击+12，暴击+5%' },
  suozijia: { key: 'suozijia', name: '锁子黄金甲', slot: 'armor', tier: 3, mods: { def: 12, hp: 40 }, desc: '防御+12，气血+40' },
  fengchiguan: { key: 'fengchiguan', name: '凤翅紫金冠', slot: 'armor', tier: 3, mods: { spd: 8 }, crit: 0.03, desc: '速度+8，暴击+3%' },
};

// 历练与银两(数值紧：日常封妖最多比剧情设计等级高 1 级，决战仍须用对真扇)
export const ECONOMY = {
  expBase: 100,          // 升下一级所需历练 = expBase × 当前等级(以悟空等级计)
  bountyExpPct: 0.45,    // 每环封妖得「当前所需历练」的 45%，约两环半升一级
  bountyRing: 10,        // 封妖令十环一轮，满轮另赏二阶装备
  bountyMoney: [60, 12], // 银两 = 基数 + 每环递增
  storyMoney: 120,       // 剧情战胜利银两
  bountyDrops: [
    { item: 'jinchuang', p: 0.35 },
    { item: 'falidan', p: 0.2 },
    { equip: 'bintie', p: 0.1 },
    { equip: 'xipijia', p: 0.1 },
  ],
  studyCost: { 2: 300, 3: 700 }, // 研习法术到二重/三重所需银两(修炼点之外的另一条路)
};

// 商店(NPC 键 → 货架)
export const SHOPS = {
  gaoshao: { title: '卖糕摊 · 药铺', goods: [{ item: 'jinchuang', price: 40 }, { item: 'falidan', price: 60 }, { item: 'buyaosheng', price: 90 }, { item: 'huihun', price: 150 }] },
  laozhe: { title: '庄上铁匠铺', goods: [{ equip: 'jingtie', price: 260 }, { equip: 'mianjia', price: 240 }] },
};

// 法宝(1件/全队，只做规则型，禁 +atk/+mag/+mp)
export const TREASURES = {
  dingfengdan: { key: 'dingfengdan', name: '定风丹', mods: { spd: 6 }, immuneSpdDown: true, desc: '速度+6，免疫减速(灵吉菩萨赠)' },
  bihuojin: { key: 'bihuojin', name: '避火锦', mods: {}, resist: { 火: 0.25 }, desc: '全队火伤减免25%' },
};

// 敌方单位
export const ENEMIES = {
  luosha: {
    key: 'luosha', name: '罗刹女', element: '木', portrait: 'luosha', crit: 0.1,
    base: { hp: 980, mp: 0, atk: 82, def: 44, spd: 72, mag: 55 },
    growth: { hp: 140, mp: 0, atk: 9, def: 5, spd: 3, mag: 6 },
    skills: { 1: ['shuangjian', 'shanfeng'] }, ai: 'boss',
  },
  shibi: {
    key: 'shibi', name: '芭蕉洞侍婢', element: '木', portrait: 'shibi', crit: 0.05,
    base: { hp: 420, mp: 0, atk: 55, def: 36, spd: 60, mag: 62 },
    growth: { hp: 55, mp: 0, atk: 4, def: 3, spd: 2, mag: 5 },
    skills: { 1: ['zhiwang', 'hujia'] }, ai: 'mob',
  },
  firemob1: {
    key: 'firemob1', name: '火兵', element: '火', portrait: 'mob_fire1', crit: 0.06,
    base: { hp: 430, mp: 0, atk: 74, def: 32, spd: 66, mag: 70 },
    growth: { hp: 60, mp: 0, atk: 5, def: 3, spd: 2, mag: 5 },
    skills: { 1: ['huoqiu'] }, ai: 'mob', catchKey: 'huobao',
  },
  firemob2: {
    key: 'firemob2', name: '火炎校尉', element: '火', portrait: 'mob_fire2', crit: 0.08,
    base: { hp: 640, mp: 0, atk: 86, def: 40, spd: 58, mag: 82 },
    growth: { hp: 90, mp: 0, atk: 6, def: 4, spd: 2, mag: 6 },
    skills: { 1: ['huoqiu', 'lieyan', 'huanhuo'] }, ai: 'mob',
  },
  // 封妖小卒：砖缝里钻出的火苗，气血约头目的一半弱、攻击约火兵四成半，挂机两三回合可清
  firemob_minor: {
    key: 'firemob_minor', name: '砖缝火苗', element: '火', portrait: 'mob_fire1', crit: 0.04, small: true,
    base: { hp: 120, mp: 0, atk: 34, def: 18, spd: 60, mag: 32 },
    growth: { hp: 17, mp: 0, atk: 2, def: 2, spd: 2, mag: 2 },
    skills: { 1: ['huoqiu'] }, ai: 'mob',
  },
  // 封妖头目：炉砖里钻出的火妖，比剧情火兵薄一截；照样可用捕妖绳收服
  firemob_imp: {
    key: 'firemob_imp', name: '炉砖火妖', element: '火', portrait: 'mob_fire1', crit: 0.06,
    base: { hp: 270, mp: 0, atk: 66, def: 28, spd: 64, mag: 62 },
    growth: { hp: 38, mp: 0, atk: 4, def: 3, spd: 2, mag: 4 },
    skills: { 1: ['huoqiu'] }, ai: 'mob', catchKey: 'huobao',
  },
  // 封妖用的火炎小校：不召唤，气血比剧情里的校尉薄
  firemob_bounty: {
    key: 'firemob_bounty', name: '火炎小校', element: '火', portrait: 'mob_fire2', crit: 0.06,
    base: { hp: 360, mp: 0, atk: 68, def: 30, spd: 58, mag: 64 },
    growth: { hp: 60, mp: 0, atk: 5, def: 3, spd: 2, mag: 5 },
    skills: { 1: ['huoqiu', 'lieyan'] }, ai: 'mob',
  },
  yumian: {
    key: 'yumian', name: '玉面公主', element: '土', portrait: 'yumian', crit: 0.08,
    base: { hp: 820, mp: 0, atk: 70, def: 46, spd: 76, mag: 88 },
    growth: { hp: 95, mp: 0, atk: 5, def: 4, spd: 3, mag: 7 },
    skills: { 1: ['yaofa', 'jiaoman'] }, ai: 'mob',
  },
  yaojiang: {
    key: 'yaojiang', name: '摩云洞妖将', element: '金', portrait: 'yaojiang', crit: 0.06,
    base: { hp: 560, mp: 0, atk: 78, def: 60, spd: 50, mag: 40 },
    growth: { hp: 70, mp: 0, atk: 6, def: 5, spd: 2, mag: 3 },
    skills: { 1: ['tiebi', 'kanxi'] }, ai: 'mob',
  },
  niumowang: {
    key: 'niumowang', name: '牛魔王', element: '火', portrait: 'niumowang', crit: 0.12,
    base: { hp: 1500, mp: 0, atk: 108, def: 62, spd: 78, mag: 70 },
    growth: { hp: 120, mp: 0, atk: 6, def: 4, spd: 2, mag: 5 },
    skills: { 1: ['tiegun', 'chongzhuang'] }, ai: 'boss', heavyName: '混铁棍',
    nextPhase: 'whitebull',
  },
  whitebull: {
    key: 'whitebull', name: '白牛真身', element: '土', portrait: 'whitebull', crit: 0.1, big: true,
    base: { hp: 1300, mp: 0, atk: 126, def: 64, spd: 56, mag: 75 },
    growth: { hp: 150, mp: 0, atk: 7, def: 4, spd: 1, mag: 5 },
    skills: { 1: ['fatian', 'sihuo', 'chongzhuang'] }, ai: 'boss', heavyName: '法天象地',
  },
};

// 阵型
export const FORMATIONS = {
  tiangang: { key: 'tiangang', name: '天罡阵', desc: '攻击+20% 速度+5%，但受伤+15%', mods: { atk: 1.2, spd: 1.05, dmgTaken: 1.15 } },
  liuding: { key: 'liuding', name: '六丁阵', desc: '防御+18% 受伤-20% 速度-5%', mods: { def: 1.18, spd: 0.95, dmgTaken: 0.8 } },
};

// 道具
export const ITEMS = {
  jinchuang: { key: 'jinchuang', name: '金疮药', type: 'heal', val: 0.5, target: 'ally', desc: '一人回复一半气血' },
  dahuandan: { key: 'dahuandan', name: '大还丹', type: 'heal', val: 1.0, target: 'ally', desc: '一人气血回满' },
  falidan: { key: 'falidan', name: '法力丹', type: 'mp', val: 45, target: 'ally', desc: '一人回复45点法力' },
  wubaodan: { key: 'wubaodan', name: '五宝丹', type: 'mp', val: 999, target: 'ally', desc: '一人法力回满' },
  xingshi: { key: 'xingshi', name: '醒酒石', type: 'buffitem', buff: { id: 'dmg_reduce', val: 0.4, turns: 2 }, target: 'ally', desc: '一人两回合内受伤减四成' },
  bihuofu: { key: 'bihuofu', name: '避火符', type: 'buffitem', buff: { id: 'huo_ward', val: 1, turns: 2 }, target: 'ally', desc: '一人两回合内挡下一次火伤' },
  buyaosheng: { key: 'buyaosheng', name: '捕妖绳', type: 'catch', target: 'enemy', desc: '妖怪气血低于四成时可收服，收服后能带上阵' },
  fakefan: { key: 'fakefan', name: '芭蕉扇·伪', type: 'fakefan', target: 'none', desc: '扇一扇，火反倒更旺……慎用！' },
  truefan: { key: 'truefan', name: '芭蕉扇', type: 'truefan', target: 'none', desc: '真扇三段：一息火、二生风、三落雨' },
  huihun: { key: 'huihun', name: '九转回魂丹', type: 'revive', val: 0.25, target: 'deadAlly', desc: '救起一位倒下的伙伴，带两成半气血归队' },
};

// 战役六场战斗。剧情退出场同样给历练，因此后续敌方等级与队伍同步抬升，
// 确保 Lv4-6 招式能在决战前真正进入玩家手里。
export const BATTLES = {
  luosha1: {
    id: 'luosha1', name: '翠云山·芭蕉洞外', bg: 'cuiyun', boss: false, enemyLevel: 1,
    enemies: ['luosha', 'shibi', 'shibi'],
    // 原著第59回：第3回合罗刹女祭扇吹飞悟空(演出，非失败)
    storyExit: { round: 3, kind: 'blow' },
    hint: '侍婢会替罗刹女回血：先合力打倒一名侍婢，血少的伙伴用金疮药或防御。',
  },
  luosha: {
    id: 'luosha', name: '翠云山·芭蕉洞外·再战', bg: 'cuiyun', boss: false, enemyLevel: 2,
    enemies: ['luosha', 'shibi', 'shibi'],
    // 教学彩蛋：罗刹女气血≤55%时悟空变化 → 化虫入腹直接取胜(原著第59回)
    transformFinisher: { bossKey: 'luosha', hpBelow: 0.55 },
    hint: '悟空属金，正克罗刹女的木：集中打她，气血过半后让悟空变蟭蟟虫，一招取胜。',
  },
  firemobs: {
    id: 'firemobs', name: '火焰山·火口', bg: 'huoyan', boss: false, enemyLevel: 3,
    enemies: ['firemob1', 'firemob1', 'firemob2'],
    // 战场态势·地火炙烤(数据驱动,engine 通用执行)：回合末灼烧我方非水系单位;
    // 敌方本是火中妖，自不受害；避火锦的火抗对灼伤同样减免
    fieldRule: {
      kind: 'roundEndBurn', id: 'dihuo', name: '地火炙烤',
      pct: 0.06, element: '火', immuneElement: '水',
      short: '回合末烧伤非水属性伙伴',
      desc: '火口地火：每回合末烧伤我方所有非水属性的伙伴，火妖自己不怕。悟空变玄甲龟将可免，避火锦也能减轻。',
    },
    hint: '火口每回合灼人：先让悟空变玄甲龟将，集中打火炎校尉，血少就用金疮药。',
  },
  yumian: {
    id: 'yumian', name: '积雷山·摩云洞前', bg: 'moyundong', boss: false, enemyLevel: 4,
    enemies: ['yumian', 'yaojiang', 'yaojiang'],
    // 战场态势·妖将结阵：两名妖将同时在场，敌方全体防御+30%；折其一即解
    fieldRule: {
      kind: 'pairGuard', id: 'yaozhen', name: '妖将结阵',
      unitKey: 'yaojiang', count: 2, reduce: 0.12,
      short: '两妖将都在，敌方少受伤',
      desc: '妖将结阵：两名妖将都站着时，敌方人人少受伤；先打倒其中一个，阵就破了。',
    },
    hint: '两名妖将都在，敌方人人少受伤：先合力打倒一名妖将，再收拾玉面公主。',
  },
  niu1: {
    id: 'niu1', name: '摩云洞·激战牛魔王', bg: 'moyundong', boss: false, enemyLevel: 5,
    enemies: ['niumowang', 'yaojiang'],
    // 原著第60回：第3回合牛魔王赴碧波潭之宴而走(演出，引出碧波潭)
    storyExit: { round: 3, kind: 'retreat' },
    hint: '老牛只想拖住你几回合：让沙僧开罗汉金身，其余人防御或用药，撑过去就好。',
  },
  niumowang: {
    id: 'niumowang', name: '积雷山·决战', bg: 'leiji', boss: true, enemyLevel: 6,
    // 白牛每回合独立累积狂暴；一扇息火可清。独立 buff id 让界面能明确显示压力来源。
    enragePerRound: 0.12,
    // 八戒+土地接力：白牛现形时全队回复 30%(第61回，亦作难度阀)
    phaseHeal: 0.3,
    // 决战：牛魔王(人形→白牛真身)+玉面公主+妖将(第61回多人对阵)
    enemies: ['niumowang', 'yumian', 'yaojiang'],
    // 反骗得逞开局(可选)：悟空中计，首回合攻击-15%
    // 众神围剿(门控)：白牛真身血气≤50%时哪吒登场助战(一次性，决定论)
    godAssist: { hpBelow: 0.5, bossKey: 'whitebull', name: '哪吒三太子', amount: 0.15, debuff: { id: 'def_down', val: 0.3, turns: 3 } },
    hint: '换六丁阵；老牛蓄力时让血最少的人防御；真扇三扇有先后，第一扇息火最好留到白牛狂暴叠起时再扇。',
  },
};

// 日常封妖(明雷)：敌方等级在开战时按队伍等级给出(engine createBattle enemyLevel)
export const BOUNTY_BATTLES = {
  bounty_a: { id: 'bounty_a', name: '封妖 · 炉砖火妖', bg: 'huoyan', boss: false, bounty: true, enemies: ['firemob_imp', 'firemob_minor', 'firemob_minor'], hint: '先打炉砖火妖本身，火苗没了领头的也闹不起来。' },
  bounty_b: { id: 'bounty_b', name: '封妖 · 火炎小校', bg: 'huoyan', boss: false, bounty: true, enemies: ['firemob_bounty', 'firemob_minor', 'firemob_minor'], hint: '火炎小校血厚：八戒的钉耙一扫，火苗先倒。' },
};
Object.assign(BATTLES, BOUNTY_BATTLES);

// 战斗次序(战役推进用)
