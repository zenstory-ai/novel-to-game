// 战斗数据表:单位/敌人/技能/阵型/道具/变化形态/战役战斗。
// 引擎只读这些表,新增角色/敌人/技能只加数据,不改引擎。

// 五行相克:金克木、木克土、土克水、水克火、火克金
export const ELEMENTS = {
  金: { beats: '木' },
  木: { beats: '土' },
  土: { beats: '水' },
  水: { beats: '火' },
  火: { beats: '金' },
};

export const ELEMENT_ORDER = ['金', '木', '水', '火', '土'];

// 克制系数
export const ELEMENT_COEF = { ke: 1.5, beike: 0.66, none: 1.0 };

// kind: 'phy' 用攻击, 'mag' 用灵力; target: enemy/enemies/ally/party/self
export const SKILLS = {
  // —— 悟空 ——
  ruyibang: { name: '如意金箍棒', kind: 'phy', mul: 1.8, mp: 16, target: 'enemy', hit: 0.95, desc: '物理单体高伤' },
  huoyan: { name: '火眼金睛', kind: 'mag', mul: 0, mp: 22, target: 'enemy', buff: { id: 'def_down', val: 0.35, turns: 3 }, desc: '识破破绽,敌防御-35%(3回合)' },
  hengsao: { name: '横扫千军', kind: 'phy', mul: 1.15, mp: 20, target: 'enemies', hit: 0.92, desc: '物理群体' },
  // —— 八戒 ——
  jiuchipaba: { name: '九齿钉耙', kind: 'phy', mul: 1.05, mp: 16, target: 'enemies', hit: 0.92, desc: '物理群体' },
  gongdi: { name: '拱地', kind: 'phy', mul: 0.8, mp: 18, target: 'enemy', hit: 0.9, buff: { id: 'stun', val: 0, turns: 1, chance: 0.65 }, desc: '65%概率击晕敌一回合' },
  // —— 沙僧 ——
  xiangyaozhang: { name: '降妖宝杖', kind: 'phy', mul: 1.35, mp: 14, target: 'enemy', hit: 0.97, selfHeal: 0.35, desc: '稳定单体,自愈35%伤害量' },
  luohanjinshen: { name: '罗汉金身', kind: 'mag', mul: 0, mp: 30, target: 'party', buff: { id: 'dmg_reduce', val: 0.3, turns: 3 }, desc: '全队受伤-30%(3回合)' },
  // —— 辟水金睛兽(宠) ——
  pishuijue: { name: '辟水诀', kind: 'mag', mul: 1.25, mp: 24, target: 'enemies', desc: '水系群体,克火' },
  jinjing: { name: '金睛', kind: 'mag', mul: 0, mp: 18, target: 'party', buff: { id: 'hit_up', val: 0.15, turns: 3 }, desc: '全队命中+15%(3回合)' },
  // —— 变化形态附带技 ——
  shenjiang_sao: { name: '神将横扫', kind: 'phy', mul: 1.3, mp: 0, target: 'enemies', hit: 0.92, desc: '变化技·物理群体' },
  lieyan_quan: { name: '烈焰拳', kind: 'mag', mul: 1.7, mp: 0, target: 'enemy', desc: '变化技·火系单体' },
  xuanbing_ji: { name: '玄冰击', kind: 'mag', mul: 2.0, mp: 0, target: 'enemy', desc: '变化技·水系单体' },
  // —— 敌方 ——
  shuangjian: { name: '双剑击', kind: 'phy', mul: 1.35, mp: 0, target: 'enemy', hit: 0.93, desc: '' },
  zhiwang: { name: '织网缠丝', kind: 'mag', mul: 0.7, mp: 0, target: 'enemy', buff: { id: 'spd_down', val: 0.15, turns: 2 }, desc: '妖丝缠身,速度下降' },
  hujia: { name: '护主心切', kind: 'mag', mul: 0, mp: 0, target: 'ally', heal: 0.8, desc: '抢救主人' },
  huanhuo: { name: '唤火助威', kind: 'mag', mul: 0, mp: 0, target: 'self', summon: { key: 'firemob1', count: 1, maxSummons: 1 }, cooldown: 3, desc: '召唤一波火兵' },
  yaofa: { name: '妖法迷人', kind: 'mag', mul: 0.95, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  jiaoman: { name: '娇蛮', kind: 'mag', mul: 0, mp: 0, target: 'enemy', buff: { id: 'atk_down', val: 0.25, turns: 2 }, desc: '' },
  tiebi: { name: '铁臂横扫', kind: 'phy', mul: 0.9, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  kanxi: { name: '看守重击', kind: 'phy', mul: 1.45, mp: 0, target: 'enemy', hit: 0.9, desc: '' },
  shanfeng: { name: '芭蕉扇风', kind: 'phy', mul: 0.85, mp: 0, target: 'enemies', hit: 0.9, desc: '' },
  huoqiu: { name: '火弹', kind: 'mag', mul: 1.25, mp: 0, target: 'enemy', hit: 0.92, desc: '' },
  lieyan: { name: '烈焰喷吐', kind: 'mag', mul: 1.0, mp: 0, target: 'enemies', hit: 0.88, desc: '' },
  // —— Lv4-6 解锁(批0 技能表补齐) ——
  qitian: { name: '齐天棍影', kind: 'phy', mul: 2.1, mp: 24, target: 'enemy', hit: 0.9, critBonus: 0.1, desc: '物理单体大伤,易暴击' },
  zhenhai: { name: '镇海一棒', kind: 'phy', mul: 1.45, mp: 26, target: 'enemies', hit: 0.9, desc: '物理群体重击' },
  douzhan: { name: '斗战神通', kind: 'mag', mul: 0, mp: 20, target: 'self', buff: { id: 'atk_up', val: 0.25, turns: 3 }, desc: '自身攻击+25%(3回合)' },
  hengpa: { name: '横耙拦截', kind: 'phy', mul: 1.2, mp: 18, target: 'enemies', hit: 0.9, desc: '物理群体' },
  tunshan: { name: '吞山食力', kind: 'phy', mul: 1.4, mp: 20, target: 'enemy', hit: 0.92, selfHeal: 0.6, desc: '单体,大量自愈' },
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

// 基础攻击(指令「攻击」)
export const BASIC_ATTACK = { name: '攻击', kind: 'phy', mul: 1.0, mp: 0, target: 'enemy', hit: 0.95 };

// 悟空变化形态(特技「七十二变」):临时改五行/属性/技能
export const FORMS = {
  shenjiang: { name: '金甲神将', element: '金', turns: 3, mods: { atk: 1.4 }, skills: ['shenjiang_sao'], desc: '攻+40%,得群体物理' },
  lieyuan: { name: '赤焰灵猿', element: '火', turns: 3, mods: { mag: 1.45 }, skills: ['lieyan_quan'], desc: '灵力+45%,得火系法术' },
  xuangui: { name: '玄甲龟将', element: '水', turns: 3, mods: { def: 1.6, spd: 0.8, mag: 1.35 }, skills: ['xuanbing_ji'], keShield: true, desc: '防+60%灵力+35%速-20%,被克伤害减半,得水系法术' },
  chongzi: { name: '蟭蟟虫', element: '金', turns: 3, mods: { spd: 1.5, atk: 0.8 }, skills: [], desc: '速+50%攻-20%,抢速自保' },
};

// 我方单位(成长 = 每级增量;唐僧不参战,随队剧情)
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

// 成长系统
export const GROWTH = { pointsPerLevel: 5, skillRankCap: 3, statCap: 40 };
export const POINT_GAINS = {
  体: { hp: 8 }, 攻: { atk: 2 }, 防: { def: 2 }, 速: { spd: 2 }, 灵: { mag: 2, mp: 1 },
};

// 武器装备(1件/角色,小幅 flat 属性,剧情掉落)
export const EQUIPS = {
  ruyibang_jing: { key: 'ruyibang_jing', name: '如意金箍棒·精', slot: 'weapon', mods: { atk: 12 }, crit: 0.05, desc: '攻击+12,暴击+5%' },
  qinjingpa: { key: 'qinjingpa', name: '上宝沁金耙', slot: 'weapon', mods: { atk: 10, hp: 40 }, desc: '攻击+10,体力+40' },
  xiangyao_jia: { key: 'xiangyao_jia', name: '降妖宝甲', slot: 'armor', mods: { def: 12, hp: 30 }, desc: '防御+12,体力+30' },
};

// 法宝(1件/全队,只做规则型,禁 +atk/+mag/+mp)
export const TREASURES = {
  dingfengdan: { key: 'dingfengdan', name: '定风丹', mods: { spd: 6 }, immuneSpdDown: true, desc: '速度+6,免疫减速(灵吉菩萨赠)' },
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
  tiangang: { key: 'tiangang', name: '天罡阵', desc: '攻击+20% 速度+5%,但受伤+15%', mods: { atk: 1.2, spd: 1.05, dmgTaken: 1.15 } },
  liuding: { key: 'liuding', name: '六丁阵', desc: '防御+18% 受伤-20% 速度-5%', mods: { def: 1.18, spd: 0.95, dmgTaken: 0.8 } },
};

// 道具
export const ITEMS = {
  jinchuang: { key: 'jinchuang', name: '金疮药', type: 'heal', val: 0.5, target: 'ally', desc: '回复单体50%体力' },
  dahuandan: { key: 'dahuandan', name: '大还丹', type: 'heal', val: 1.0, target: 'ally', desc: '回复单体全部体力' },
  falidan: { key: 'falidan', name: '法力丹', type: 'mp', val: 45, target: 'ally', desc: '回复单体45点法力' },
  wubaodan: { key: 'wubaodan', name: '五宝丹', type: 'mp', val: 999, target: 'ally', desc: '回复单体全部法力' },
  xingshi: { key: 'xingshi', name: '醒酒石', type: 'buffitem', buff: { id: 'dmg_reduce', val: 0.4, turns: 2 }, target: 'ally', desc: '2回合受伤-40%' },
  bihuofu: { key: 'bihuofu', name: '避火符', type: 'buffitem', buff: { id: 'huo_ward', val: 1, turns: 2 }, target: 'ally', desc: '2回合内抵免疫一次火系伤害' },
  buyaosheng: { key: 'buyaosheng', name: '捕妖绳', type: 'catch', target: 'enemy', desc: '收服血气≤40%的可捕之妖' },
  fakefan: { key: 'fakefan', name: '芭蕉扇·伪', type: 'fakefan', target: 'none', desc: '一扇火更旺……慎用!' },
  truefan: { key: 'truefan', name: '芭蕉扇', type: 'truefan', target: 'none', desc: '真扇三段:一息火、二生风、三落雨' },
};

// 战役三场战斗
export const BATTLES = {
  luosha1: {
    id: 'luosha1', name: '翠云山·芭蕉洞外', bg: 'cuiyun', boss: false, enemyLevel: 1,
    enemies: ['luosha', 'shibi', 'shibi'],
    // 原著第59回:第3回合罗刹女祭扇吹飞悟空(演出,非失败)
    storyExit: { round: 3, kind: 'blow' },
  },
  luosha: {
    id: 'luosha', name: '翠云山·芭蕉洞外·再战', bg: 'cuiyun', boss: false, enemyLevel: 1,
    enemies: ['luosha', 'shibi', 'shibi'],
    // 教学彩蛋:罗刹女体力≤55%时悟空变化 → 化虫入腹直接取胜(原著第59回)
    transformFinisher: { bossKey: 'luosha', hpBelow: 0.55 },
  },
  firemobs: {
    id: 'firemobs', name: '火焰山·火口', bg: 'huoyan', boss: false, enemyLevel: 2,
    enemies: ['firemob1', 'firemob1', 'firemob2'],
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
  yumian: {
    id: 'yumian', name: '积雷山·摩云洞前', bg: 'moyundong', boss: false, enemyLevel: 3,
    enemies: ['yumian', 'yaojiang', 'yaojiang'],
  },
  niu1: {
    id: 'niu1', name: '摩云洞·激战牛魔王', bg: 'moyundong', boss: false, enemyLevel: 4,
    enemies: ['niumowang', 'yaojiang'],
    // 原著第60回:第3回合牛魔王赴碧波潭之宴而走(演出,引出碧波潭)
    storyExit: { round: 3, kind: 'retreat' },
  },
  niumowang: {
    id: 'niumowang', name: '积雷山·决战', bg: 'leiji', boss: true, enemyLevel: 1,
    // 八戒+土地接力:白牛现形时全队回复 30%(第61回,亦作难度阀)
    phaseHeal: 0.3,
    // 决战:牛魔王(人形→白牛真身)+玉面公主+妖将(第61回多人对阵)
    enemies: ['niumowang', 'yumian', 'yaojiang'],
    // 反骗得逞开局(可选):悟空中计,首回合攻击-15%
    // 众神围剿(门控):白牛真身血气≤50%时哪吒登场助战(一次性,决定论)
    godAssist: { hpBelow: 0.5, bossKey: 'whitebull', name: '哪吒三太子', amount: 0.15, debuff: { id: 'def_down', val: 0.3, turns: 3 } },
  },
};

// 战斗次序(战役推进用)
export const CAMPAIGN_BATTLES = ['luosha1', 'luosha', 'firemobs', 'yumian', 'niu1', 'niumowang'];
