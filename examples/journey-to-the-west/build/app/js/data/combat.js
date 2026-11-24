// 战斗数据表。规则引擎只读这些表：加角色、敌人、招式只改这里。

export const ELEMENTS = ['金', '木', '土', '水', '火'];
// 金克木、木克土、土克水、水克火、火克金
export const BEATS = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
export const ELEMENT_COEF = { ke: 1.5, beike: 0.66, none: 1 };

// kind: phy 用攻击 / mag 用灵力；target: enemy / enemies / ally / party / self
export const SKILLS = {
  // 悟空
  ruyibang: { name: '棒打', kind: 'phy', mul: 1.8, mp: 16, target: 'enemy', hit: 0.95, fx: 'smash', desc: '如意棒当头砸下，重创一名敌人。' },
  huoyan: { name: '火眼金睛', kind: 'mag', mul: 0, mp: 22, target: 'enemy', buff: { id: 'def_down', val: 0.35, turns: 3 }, fx: 'gaze', desc: '看破破绽，目标防御降低 35%，持续三回合。' },
  hengsao: { name: '横扫千军', kind: 'phy', mul: 1.15, mp: 20, target: 'enemies', hit: 0.92, fx: 'sweep', desc: '金箍棒横扫，痛击全体敌人。' },
  qitian: { name: '齐天棍影', kind: 'phy', mul: 2.1, mp: 24, target: 'enemy', hit: 0.9, critBonus: 0.1, fx: 'smash', desc: '棍影叠落，重创一名敌人，更易暴击。' },
  zhenhai: { name: '镇海一棒', kind: 'phy', mul: 1.45, mp: 26, target: 'enemies', hit: 0.9, fx: 'sweep', desc: '一棒镇海，重创全体敌人。' },
  douzhan: { name: '斗战神通', kind: 'mag', mul: 0, mp: 20, target: 'self', buff: { id: 'atk_up', val: 0.25, turns: 3 }, fx: 'aura', desc: '自身攻击提高 25%，持续三回合。' },
  // 八戒
  jiuchipaba: { name: '钉耙乱筑', kind: 'phy', mul: 1.05, mp: 16, target: 'enemies', hit: 0.92, fx: 'sweep', desc: '九齿钉耙横筑，打击全体敌人。' },
  gongdi: { name: '拱地', kind: 'phy', mul: 0.8, mp: 18, target: 'enemy', hit: 0.9, buff: { id: 'stun', val: 0, turns: 1, chance: 0.65 }, fx: 'quake', desc: '翻土震敌，六成半机会震晕目标一回合。' },
  hengpa: { name: '横耙拦截', kind: 'phy', mul: 1.2, mp: 18, target: 'enemies', hit: 0.9, fx: 'sweep', desc: '横耙拦腰扫去，重击全体敌人。' },
  tunshan: { name: '吞山食力', kind: 'phy', mul: 1.4, mp: 20, target: 'enemy', hit: 0.92, selfHeal: 0.6, fx: 'smash', desc: '猛击一名敌人，六成伤害化为自身气血。' },
  gangtie: { name: '钢鬃铁背', kind: 'mag', mul: 0, mp: 16, target: 'self', buff: { id: 'def_up', val: 0.4, turns: 3 }, fx: 'aura', desc: '自身防御提高 40%，持续三回合。' },
  // 沙僧
  xiangyaozhang: { name: '宝杖降妖', kind: 'phy', mul: 1.35, mp: 14, target: 'enemy', hit: 0.97, selfHeal: 0.35, fx: 'smash', desc: '沉稳一击，三成半伤害化为自身气血。' },
  luohanjinshen: { name: '罗汉金身', kind: 'mag', mul: 0, mp: 30, target: 'party', buff: { id: 'dmg_reduce', val: 0.3, turns: 3 }, fx: 'ward', desc: '全队所受伤害降低 30%，持续三回合。' },
  liusha: { name: '流沙河怒', kind: 'phy', mul: 1.6, mp: 18, target: 'enemy', hit: 0.97, fx: 'smash', desc: '卷起流沙，重击一名敌人，极少落空。' },
  hufa: { name: '护法金身', kind: 'mag', mul: 0, mp: 34, target: 'party', buff: { id: 'dmg_reduce', val: 0.4, turns: 2 }, fx: 'ward', desc: '全队所受伤害降低 40%，持续两回合。' },
  guiyuan: { name: '归元静心', kind: 'mag', mul: 0, mp: 26, target: 'party', heal: 0.9, fx: 'heal', desc: '为全队恢复气血，灵力越高恢复越多。' },
  // 辟水金睛兽
  pishuijue: { name: '辟水诀', kind: 'mag', mul: 1.25, mp: 24, target: 'enemies', fx: 'wave', desc: '寒波卷向全体敌人。' },
  jinjing: { name: '金睛', kind: 'mag', mul: 0, mp: 18, target: 'party', buff: { id: 'hit_up', val: 0.15, turns: 3 }, fx: 'gaze', desc: '全队命中提高 15%，持续三回合。' },
  jinglang: { name: '金睛破浪', kind: 'mag', mul: 1.5, mp: 28, target: 'enemies', fx: 'wave', desc: '巨浪席卷全体敌人。' },
  bingfeng: { name: '冰封', kind: 'mag', mul: 1.8, mp: 24, target: 'enemy', buff: { id: 'stun', val: 0, turns: 1, chance: 0.5 }, fx: 'ice', desc: '寒气重创一名敌人，半数机会将其冻住一回合。' },
  // 赤焰火妖
  huolian: { name: '火焰连珠', kind: 'mag', mul: 1.3, mp: 14, target: 'enemy', fx: 'fire', desc: '连珠火球灼伤一名敌人。' },
  fenye: { name: '焚野', kind: 'mag', mul: 1.1, mp: 20, target: 'enemies', fx: 'firewave', desc: '烈火焚烧全体敌人。' },
  chiyan: { name: '赤焰冲锋', kind: 'phy', mul: 1.5, mp: 16, target: 'enemy', hit: 0.92, fx: 'fire', desc: '裹着赤焰撞向一名敌人。' },
  // 七十二变形态技
  shenjiang_sao: { name: '神将横扫', kind: 'phy', mul: 1.3, mp: 0, target: 'enemies', hit: 0.92, fx: 'sweep', desc: '巨棒横扫全体敌人。' },
  lieyan_quan: { name: '烈焰拳', kind: 'mag', mul: 1.7, mp: 0, target: 'enemy', fx: 'fire', desc: '烈焰裹拳，轰击一名敌人。' },
  xuanbing_ji: { name: '玄冰击', kind: 'mag', mul: 2.0, mp: 0, target: 'enemy', fx: 'ice', desc: '玄冰重击一名敌人。' },
  // 敌方
  shuangjian: { name: '双剑击', kind: 'phy', mul: 1.35, mp: 0, target: 'enemy', hit: 0.93, fx: 'slash' },
  shanfeng: { name: '芭蕉扇风', kind: 'phy', mul: 0.85, mp: 0, target: 'enemies', hit: 0.9, buff: { id: 'spd_down', val: 0.15, turns: 2 }, fx: 'gale' },
  zhiwang: { name: '织网缠丝', kind: 'mag', mul: 0.7, mp: 0, target: 'enemy', buff: { id: 'spd_down', val: 0.15, turns: 2 }, fx: 'silk' },
  hujia: { name: '护主心切', kind: 'mag', mul: 0, mp: 0, target: 'ally', heal: 0.8, fx: 'heal' },
  huoqiu: { name: '火弹', kind: 'mag', mul: 1.25, mp: 0, target: 'enemy', hit: 0.92, fx: 'fire' },
  lieyan: { name: '烈焰喷吐', kind: 'mag', mul: 1.0, mp: 0, target: 'enemies', hit: 0.88, fx: 'firewave' },
  huanhuo: { name: '唤火助威', kind: 'mag', mul: 0, mp: 0, target: 'self', summon: { key: 'firemob1', max: 1 }, cooldown: 3, fx: 'fire' },
  yaofa: { name: '妖法迷人', kind: 'mag', mul: 0.95, mp: 0, target: 'enemies', hit: 0.88, fx: 'charm' },
  jiaoman: { name: '娇嗔', kind: 'mag', mul: 0, mp: 0, target: 'enemy', buff: { id: 'atk_down', val: 0.25, turns: 2 }, fx: 'charm' },
  tiebi: { name: '铁臂横扫', kind: 'phy', mul: 0.9, mp: 0, target: 'enemies', hit: 0.88, fx: 'sweep' },
  kanxi: { name: '看守重击', kind: 'phy', mul: 1.45, mp: 0, target: 'enemy', hit: 0.9, fx: 'smash' },
  tiegun: { name: '混铁棍', kind: 'phy', mul: 1.55, mp: 0, target: 'enemy', hit: 0.93, fx: 'smash' },
  chongzhuang: { name: '蛮牛冲锋', kind: 'phy', mul: 1.15, mp: 0, target: 'enemies', hit: 0.88, fx: 'quake' },
  fatian: { name: '法天象地', kind: 'phy', mul: 1.9, mp: 0, target: 'enemy', hit: 0.9, fx: 'smash' },
  sihuo: { name: '地火燎原', kind: 'mag', mul: 1.2, mp: 0, target: 'enemies', hit: 0.88, fx: 'firewave' },
};

export const BASIC_ATTACK = { name: '攻击', kind: 'phy', mul: 1.0, mp: 0, target: 'enemy', hit: 0.95, fx: 'slash' };

// 愤怒特技：挨打攒愤怒（上限 150），只耗愤怒，人人可用。
export const SP = { max: 150, gainPerHpPct: 0.9, minGain: 3 };
export const STUNTS = {
  poxue: { name: '破血狂攻', sp: 60, kind: 'phy', mul: 1.7, mp: 0, target: 'enemy', hit: 0.95, fx: 'smash', desc: '舍身猛击，重创一名敌人。' },
  luohan: { name: '罗汉金钟', sp: 80, kind: 'mag', mul: 0, mp: 0, target: 'party', buff: { id: 'dmg_reduce', val: 0.3, turns: 2 }, fx: 'ward', desc: '金钟罩顶，全队所受伤害降低 30%，持续两回合。' },
  sihai: { name: '四海升平', sp: 110, kind: 'mag', mul: 0, mp: 0, target: 'party', healPct: 0.2, fx: 'heal', desc: '甘霖遍洒，全队恢复两成气血。' },
};

// 悟空七十二变：三回合内改五行、属性与招式
export const FORMS = {
  shenjiang: { name: '金甲神将', element: '金', turns: 3, mods: { atk: 1.4 }, skills: ['shenjiang_sao'], art: 'form_shenjiang', desc: '攻击提高四成，可使神将横扫。' },
  lieyuan: { name: '赤焰灵猿', element: '火', turns: 3, mods: { mag: 1.45 }, skills: ['lieyan_quan'], art: 'form_lieyuan', desc: '化身为火，灵力提高四成半，可使烈焰拳。' },
  xuangui: { name: '玄甲龟将', element: '水', turns: 3, mods: { def: 1.6, spd: 0.8, mag: 1.35 }, skills: ['xuanbing_ji'], keShield: true, art: 'form_xuangui', desc: '化身为水，防御大增而身法变慢，被克时伤害减半，可使玄冰击。' },
  chongzi: { name: '蟭蟟虫', element: '金', turns: 3, mods: { spd: 1.5, atk: 0.8 }, skills: [], art: 'form_chongzi', desc: '身法提高五成，攻击稍降。' },
};

export const PARTY = {
  wukong: {
    key: 'wukong', name: '孙悟空', element: '金', art: 'wukong', crit: 0.15, hasTransform: true,
    base: { hp: 520, mp: 80, atk: 95, def: 55, spd: 88, mag: 60 },
    growth: { hp: 62, mp: 4, atk: 10, def: 5, spd: 4, mag: 7 },
    skills: { 1: ['ruyibang'], 2: ['huoyan'], 3: ['hengsao'], 4: ['qitian'], 5: ['zhenhai'], 6: ['douzhan'] },
    recommend: { 攻: 3, 速: 2, 体: 1, 灵: 1 },
  },
  bajie: {
    key: 'bajie', name: '猪八戒', element: '木', art: 'bajie', crit: 0.1,
    base: { hp: 640, mp: 55, atk: 88, def: 62, spd: 58, mag: 40 },
    growth: { hp: 80, mp: 3, atk: 9, def: 7, spd: 3, mag: 4 },
    skills: { 1: ['jiuchipaba'], 3: ['gongdi'], 4: ['hengpa'], 5: ['tunshan'], 6: ['gangtie'] },
    recommend: { 攻: 2, 体: 2, 防: 1, 速: 1 },
  },
  sha: {
    key: 'sha', name: '沙悟净', element: '土', art: 'sha', crit: 0.08,
    base: { hp: 700, mp: 70, atk: 80, def: 70, spd: 62, mag: 55 },
    growth: { hp: 88, mp: 4, atk: 8, def: 8, spd: 3, mag: 6 },
    skills: { 1: ['xiangyaozhang'], 2: ['luohanjinshen'], 4: ['liusha'], 5: ['hufa'], 6: ['guiyuan'] },
    recommend: { 体: 2, 防: 2, 攻: 1, 灵: 1 },
  },
  pixie: {
    key: 'pixie', name: '辟水金睛兽', element: '水', art: 'pixie', crit: 0.1, isPet: true,
    base: { hp: 560, mp: 90, atk: 78, def: 52, spd: 76, mag: 78 },
    growth: { hp: 66, mp: 5, atk: 8, def: 5, spd: 4, mag: 9 },
    skills: { 1: ['pishuijue'], 2: ['jinjing'], 4: ['jinglang'], 5: ['bingfeng'] },
    recommend: { 灵: 3, 速: 1, 体: 1 },
  },
  huobao: {
    key: 'huobao', name: '赤焰火妖', element: '火', art: 'mob_fire1', crit: 0.12, isPet: true,
    base: { hp: 470, mp: 70, atk: 82, def: 42, spd: 74, mag: 74 },
    growth: { hp: 56, mp: 4, atk: 9, def: 4, spd: 4, mag: 8 },
    skills: { 1: ['huolian'], 2: ['fenye'], 3: ['chiyan'] },
    recommend: { 灵: 2, 攻: 1, 体: 1 },
  },
};

export const GROWTH = { pointsPerLevel: 5, skillRankCap: 3, statCap: 40, skillPointsPerLevel: 1 };
export const STAT_KEYS = ['体', '攻', '防', '速', '灵'];
export const POINT_GAINS = { 体: { hp: 8 }, 攻: { atk: 2 }, 防: { def: 2 }, 速: { spd: 2 }, 灵: { mag: 2, mp: 1 } };
export const STAT_LABEL = { 体: '体质', 攻: '攻击', 防: '防御', 速: '身法', 灵: '灵力' };
export const STAT_GAIN_TEXT = { 体: '气血 +8', 攻: '攻击 +2', 防: '防御 +2', 速: '速度 +2', 灵: '灵力 +2、法力 +1' };

export const EQUIP_SLOTS = { weapon: '兵器', armor: '护身' };
export const EQUIPS = {
  jingtie: { key: 'jingtie', name: '精铁兵刃', slot: 'weapon', tier: 1, mods: { atk: 5 }, desc: '攻击 +5' },
  mianjia: { key: 'mianjia', name: '棉布护甲', slot: 'armor', tier: 1, mods: { def: 4, hp: 24 }, desc: '防御 +4，气血 +24' },
  bintie: { key: 'bintie', name: '镔铁兵刃', slot: 'weapon', tier: 2, mods: { atk: 8 }, crit: 0.02, desc: '攻击 +8，暴击 +2%' },
  xipijia: { key: 'xipijia', name: '犀皮甲', slot: 'armor', tier: 2, mods: { def: 7, hp: 36 }, desc: '防御 +7，气血 +36' },
  ruyibang_jing: { key: 'ruyibang_jing', name: '点钢棒箍', slot: 'weapon', tier: 3, mods: { atk: 12 }, crit: 0.05, only: 'wukong', desc: '攻击 +12，暴击 +5%' },
  suozijia: { key: 'suozijia', name: '锁子黄金甲', slot: 'armor', tier: 3, mods: { def: 12, hp: 40 }, only: 'wukong', desc: '防御 +12，气血 +40' },
  fengchiguan: { key: 'fengchiguan', name: '凤翅紫金冠', slot: 'armor', tier: 3, mods: { spd: 8 }, crit: 0.03, only: 'wukong', desc: '速度 +8，暴击 +3%' },
};

// 法宝：全队只带一件，只改规则，不加攻击
export const TREASURES = {
  dingfengdan: { key: 'dingfengdan', name: '定风丹', mods: { spd: 6 }, immuneSpdDown: true, art: 'dingfengdan', desc: '全队速度 +6，不受扇风与妖丝的迟滞。' },
  bihuojin: { key: 'bihuojin', name: '避火锦', mods: {}, resist: { 火: 0.25 }, art: 'bihuojin', desc: '全队所受火伤减轻四分之一，地火灼伤同样减轻。' },
};

export const FORMATIONS = {
  tiangang: { key: 'tiangang', name: '天罡阵', gain: '攻击 +20%　速度 +5%', cost: '所受伤害 +15%', mods: { atk: 1.2, spd: 1.05, dmgTaken: 1.15 } },
  liuding: { key: 'liuding', name: '六丁阵', gain: '防御 +18%　所受伤害 −20%', cost: '速度 −5%', mods: { def: 1.18, spd: 0.95, dmgTaken: 0.8 } },
};

export const ITEMS = {
  jinchuang: { key: 'jinchuang', name: '金疮药', type: 'heal', val: 0.5, target: 'ally', desc: '一人恢复一半气血。' },
  dahuandan: { key: 'dahuandan', name: '大还丹', type: 'heal', val: 1.0, target: 'ally', desc: '一人气血回满。' },
  falidan: { key: 'falidan', name: '法力丹', type: 'mp', val: 45, target: 'ally', desc: '一人恢复 45 点法力。' },
  wubaodan: { key: 'wubaodan', name: '五宝丹', type: 'mp', val: 999, target: 'ally', desc: '一人法力回满。' },
  xingshi: { key: 'xingshi', name: '醒酒石', type: 'buff', buff: { id: 'dmg_reduce', val: 0.4, turns: 2 }, target: 'ally', desc: '一人两回合内所受伤害减四成。' },
  bihuofu: { key: 'bihuofu', name: '避火符', type: 'buff', buff: { id: 'huo_ward', val: 1, turns: 2 }, target: 'ally', desc: '一人两回合内挡下一次火伤。' },
  huihun: { key: 'huihun', name: '九转回魂丹', type: 'revive', val: 0.25, target: 'fallen', desc: '救起一位倒下的伙伴，带两成半气血归队。' },
  buyaosheng: { key: 'buyaosheng', name: '捕妖绳', type: 'catch', target: 'enemy', desc: '火妖气血降到四成以下时抛出，有机会收服；取胜后带回。' },
  fakefan: { key: 'fakefan', name: '芭蕉扇', type: 'fakefan', target: 'none', desc: '罗刹女交出的宝扇。乡人说，一扇便能熄火。', knownName: '假芭蕉扇', knownDesc: '越扇火越旺的假货。' },
  truefan: { key: 'truefan', name: '芭蕉扇', type: 'truefan', target: 'none', desc: '真扇。一扇息火，二扇生风，三扇落雨，须依次扇出。' },
};

export const ENEMIES = {
  luosha: {
    key: 'luosha', name: '罗刹女', element: '木', art: 'luosha', crit: 0.1, ai: 'boss',
    base: { hp: 980, mp: 0, atk: 82, def: 44, spd: 72, mag: 55 },
    growth: { hp: 140, mp: 0, atk: 9, def: 5, spd: 3, mag: 6 },
    skills: ['shuangjian', 'shanfeng'],
  },
  shibi: {
    key: 'shibi', name: '芭蕉洞侍婢', short: '侍婢', element: '木', art: 'shibi', crit: 0.05,
    base: { hp: 420, mp: 0, atk: 55, def: 36, spd: 60, mag: 62 },
    growth: { hp: 55, mp: 0, atk: 4, def: 3, spd: 2, mag: 5 },
    skills: ['zhiwang', 'hujia'],
  },
  firemob1: {
    key: 'firemob1', name: '火兵', element: '火', art: 'mob_fire1', crit: 0.06, catchKey: 'huobao',
    base: { hp: 430, mp: 0, atk: 74, def: 32, spd: 66, mag: 70 },
    growth: { hp: 60, mp: 0, atk: 5, def: 3, spd: 2, mag: 5 },
    skills: ['huoqiu'],
  },
  firemob2: {
    key: 'firemob2', name: '火炎校尉', element: '火', art: 'mob_fire2', crit: 0.08,
    base: { hp: 640, mp: 0, atk: 86, def: 40, spd: 58, mag: 82 },
    growth: { hp: 90, mp: 0, atk: 6, def: 4, spd: 2, mag: 6 },
    skills: ['huoqiu', 'lieyan', 'huanhuo'],
  },
  firemob_minor: {
    key: 'firemob_minor', name: '砖缝火苗', element: '火', art: 'mob_fire1', crit: 0.04, small: true,
    base: { hp: 120, mp: 0, atk: 34, def: 18, spd: 60, mag: 32 },
    growth: { hp: 17, mp: 0, atk: 2, def: 2, spd: 2, mag: 2 },
    skills: ['huoqiu'],
  },
  firemob_imp: {
    key: 'firemob_imp', name: '炉砖火妖', element: '火', art: 'mob_fire1', crit: 0.06, catchKey: 'huobao',
    base: { hp: 270, mp: 0, atk: 66, def: 28, spd: 64, mag: 62 },
    growth: { hp: 38, mp: 0, atk: 4, def: 3, spd: 2, mag: 4 },
    skills: ['huoqiu'],
  },
  firemob_bounty: {
    key: 'firemob_bounty', name: '火炎小校', element: '火', art: 'mob_fire2', crit: 0.06,
    base: { hp: 360, mp: 0, atk: 68, def: 30, spd: 58, mag: 64 },
    growth: { hp: 60, mp: 0, atk: 5, def: 3, spd: 2, mag: 5 },
    skills: ['huoqiu', 'lieyan'],
  },
  yumian: {
    key: 'yumian', name: '玉面公主', element: '土', art: 'yumian', crit: 0.08,
    base: { hp: 820, mp: 0, atk: 70, def: 46, spd: 76, mag: 88 },
    growth: { hp: 95, mp: 0, atk: 5, def: 4, spd: 3, mag: 7 },
    skills: ['yaofa', 'jiaoman'],
  },
  yaojiang: {
    key: 'yaojiang', name: '摩云洞妖将', short: '妖将', element: '金', art: 'yaojiang', crit: 0.06,
    base: { hp: 560, mp: 0, atk: 78, def: 60, spd: 50, mag: 40 },
    growth: { hp: 70, mp: 0, atk: 6, def: 5, spd: 2, mag: 3 },
    skills: ['tiebi', 'kanxi'],
  },
  niumowang: {
    key: 'niumowang', name: '牛魔王', element: '火', art: 'niumowang', crit: 0.12, ai: 'boss', heavyName: '混铁棍',
    base: { hp: 1500, mp: 0, atk: 108, def: 62, spd: 78, mag: 70 },
    growth: { hp: 120, mp: 0, atk: 6, def: 4, spd: 2, mag: 5 },
    skills: ['tiegun', 'chongzhuang'], nextPhase: 'whitebull',
  },
  whitebull: {
    key: 'whitebull', name: '白牛真身', element: '土', art: 'whitebull', crit: 0.1, ai: 'boss', big: true, heavyName: '法天象地',
    base: { hp: 1300, mp: 0, atk: 126, def: 64, spd: 56, mag: 75 },
    growth: { hp: 150, mp: 0, atk: 7, def: 4, spd: 1, mag: 5 },
    skills: ['fatian', 'sihuo', 'chongzhuang'],
  },
};

// 剧情选择带进指定战斗的开场效果
export const STORY_SETUP = {
  approach: {
    calm: { battle: 'luosha1', side: 'party', buff: { id: 'dmg_reduce', val: 0.15, turns: 2 } },
    rush: { battle: 'luosha1', side: 'party', unit: 'wukong', buff: { id: 'atk_up', val: 0.15, turns: 2 } },
  },
  fanTrial: {
    full: { battle: 'firemobs', side: 'enemy', element: '火', buff: { id: 'atk_up', val: 0.3, turns: 3 } },
  },
  fooled: {
    yes: { battle: 'niumowang', side: 'party', unit: 'wukong', buff: { id: 'atk_down', val: 0.15, turns: 1 } },
  },
};

export const BATTLES = {
  luosha1: {
    id: 'luosha1', name: '翠云山 · 芭蕉洞外', bg: 'cuiyun', music: 'battle', level: 1,
    enemies: ['luosha', 'shibi', 'shibi'],
    storyExit: { round: 3, kind: 'blow' },
    goal: '与罗刹女交手，看她如何使扇',
  },
  luosha: {
    id: 'luosha', name: '翠云山 · 再战罗刹女', bg: 'cuiyun', music: 'battle', level: 2,
    enemies: ['luosha', 'shibi', 'shibi'],
    finisher: { boss: 'luosha', hpBelow: 0.45, holdAt: 0.3, goalOpen: '罗刹女已气喘：轮到悟空时点【特技】，变蟭蟟虫钻进她腹中（硬打到认输也行）' },
    // 不变化、硬把她打到认输也算借到扇：她一罢手，侍婢跟着收兵，不必再清场
    winOn: { key: 'luosha', title: '罗刹女认输', sub: '侍婢收兵，错过了化虫时机', goal: '打至疲态后变蟭蟟虫' },
    goal: '打至疲态后变蟭蟟虫',
    retryHint: '金克木盯罗刹女，疲态变蟭蟟虫。',
  },
  firemobs: {
    id: 'firemobs', name: '火焰山 · 火口', bg: 'huoyan', music: 'battle', level: 3,
    enemies: ['firemob1', 'firemob1', 'firemob2'],
    field: { kind: 'burn', name: '地火炙烤', pct: 0.06, element: '火', immune: '水', short: '回合末灼伤非水伙伴', desc: '回合末灼伤非水伙伴；水系免伤，火妖不受害。' },
    goal: '击退火兵',
    retryHint: '变玄甲龟将免地火克火，先除校尉。',
  },
  yumian: {
    id: 'yumian', name: '积雷山 · 摩云洞前', bg: 'moyundong', music: 'battle', level: 4,
    enemies: ['yumian', 'yaojiang', 'yaojiang'],
    field: { kind: 'guard', name: '妖将结阵', unit: 'yaojiang', count: 2, reduce: 0.12, short: '双妖将在场，敌全体减伤', desc: '双妖将并肩结阵，敌全体少受伤；折其一即破。' },
    goal: '破阵击退玉面公主',
    retryHint: '先折一名妖将破阵，再攻玉面公主。',
  },
  niu1: {
    id: 'niu1', name: '摩云洞 · 会牛魔王', bg: 'moyundong', music: 'boss', level: 5,
    enemies: ['niumowang', 'yaojiang'],
    storyExit: { round: 3, kind: 'retreat' },
    goal: '接住老牛数合',
  },
  niumowang: {
    id: 'niumowang', name: '积雷山 · 决战', bg: 'leiji', music: 'boss', level: 6, boss: true,
    enemies: ['niumowang', 'yumian', 'yaojiang'],
    enrage: 0.12, phaseHeal: 0.3,
    assist: { boss: 'whitebull', hpBelow: 0.5, name: '哪吒三太子', art: 'nezha', amount: 0.15, debuff: { id: 'def_down', val: 0.3, turns: 3 } },
    winOn: { key: 'whitebull', title: '白牛伏地', sub: '牛魔王罢手，余众四散', goal: '白牛伏地即胜' },
    goal: '降伏牛魔王',
    retryHint: '蓄力已锁定须防御，木克白牛，三扇破局。',
  },
  bounty_a: { id: 'bounty_a', name: '封妖 · 炉砖火妖', bg: 'huoyan', music: 'battle', bounty: true, enemies: ['firemob_imp', 'firemob_minor', 'firemob_minor'], goal: '收服作乱的火妖' },
  bounty_b: { id: 'bounty_b', name: '封妖 · 火炎小校', bg: 'huoyan', music: 'battle', bounty: true, enemies: ['firemob_bounty', 'firemob_minor', 'firemob_minor'], goal: '收服作乱的火妖' },
};

export const BUFF_INFO = {
  atk_up: { name: '攻击提高', good: true },
  enrage: { name: '狂暴', good: true },
  atk_down: { name: '攻击降低', good: false },
  def_up: { name: '铁背', good: true },
  def_down: { name: '破防', good: false },
  dmg_reduce: { name: '减伤', good: true },
  hit_up: { name: '金睛', good: true },
  spd_up: { name: '生风', good: true },
  spd_down: { name: '迟滞', good: false },
  regen: { name: '落雨', good: true },
  stun: { name: '动弹不得', good: false },
  vulnerable: { name: '破绽', good: false },
  ke_shield: { name: '龟甲', good: true },
  huo_ward: { name: '避火', good: true },
};

export const ECONOMY = {
  expBase: 100,
  bountyExpPct: 0.45,
  bountyRing: 10,
  bountyMoney: [60, 12],
  storyMoney: 120,
  bountyDrops: [
    { item: 'jinchuang', p: 0.35 },
    { item: 'falidan', p: 0.2 },
    { equip: 'bintie', p: 0.1 },
    { equip: 'xipijia', p: 0.1 },
  ],
  studyCost: { 2: 300, 3: 700 },
};

export const SHOPS = {
  gaoshao: { title: '卖糕少年的担子', goods: [{ item: 'jinchuang', price: 40 }, { item: 'falidan', price: 60 }, { item: 'buyaosheng', price: 90 }, { item: 'huihun', price: 150 }] },
  laozhe: { title: '庄上铁匠铺', goods: [{ equip: 'jingtie', price: 260 }, { equip: 'mianjia', price: 240 }] },
};
