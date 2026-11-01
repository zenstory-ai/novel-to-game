// 四图支路探索：纯数据与一次性结算，不拥有界面、寻路或主线进度。

import { applyLoot } from './progress.js';

export const EXPLORATIONS = {
  village_well: {
    scene: 'village',
    title: '井边水车',
    intro: '井水只够几户轮着挑。水车旁压着两包谢礼，只能匀出一包。',
    revisit: '水槽已经分好，木轮慢慢把余水送进村里。',
    options: [
      { key: 'jinchuang', label: '收下金疮药', reward: { items: { jinchuang: 1 } }, result: '你替庄民扶正水槽，收下金疮药一份。' },
      { key: 'falidan', label: '收下法力丹', reward: { items: { falidan: 1 } }, result: '你替庄民扶正水槽，收下法力丹一份。' },
    ],
  },
  village_fields: {
    scene: 'village',
    title: '候雨旱田',
    intro: '田垄一层层接到山脚，沟底却只剩晒白的泥。庄民把种子收在罐里，等铁扇仙熄火降雨才敢下种。',
    revisit: '空田仍在等雨。师徒若借得真扇，这里才有下一季。',
    options: [{ key: 'observe', label: '记下庄民的难处', reward: {}, result: '唐僧望着空田道：“借扇不只为过山，也为这些等雨的人。”' }],
  },
  cuiyun_grove: {
    scene: 'cuiyun',
    title: '芭蕉林风痕',
    intro: '林中叶面齐向山外翻卷，只有洞口近旁的嫩叶纹丝不动。这里的风从来不是乱吹。',
    revisit: '芭蕉叶仍朝山外伏着，风路清清楚楚。',
    options: [{ key: 'observe', label: '辨认叶上的风路', reward: {}, result: '悟空捻着叶梗道：“扇风有路数。真扇在手，风往哪里去也瞒不过俺。”' }],
  },
  cuiyun_basket: {
    scene: 'cuiyun',
    title: '临溪药篓',
    intro: '石亭边留着采药人的竹篓。篓中两只封好的药瓶压着纸条：过路人可取其一。',
    revisit: '药篓的封口已经扎紧，余药留给后来的过路人。',
    options: [
      { key: 'jinchuang', label: '取金疮药', reward: { items: { jinchuang: 1 } }, result: '你向采药人遥遥道谢，取走金疮药一份。' },
      { key: 'falidan', label: '取法力丹', reward: { items: { falidan: 1 } }, result: '你向采药人遥遥道谢，取走法力丹一份。' },
    ],
  },
  huokou_bricks: {
    scene: 'huokou',
    title: '八卦炉残砖',
    intro: '焦黑巨砖上的云雷纹虽被火蚀，仍认得出兜率宫炉砖的制式。五百年前那一脚，至今还压在这片山上。',
    revisit: '残砖伏在火脉旁，旧日因果没有因年深而消失。',
    options: [{ key: 'observe', label: '细看炉砖旧纹', reward: {}, result: '悟空收了笑脸：“这火有俺老孙一份旧账。既撞见了，便要收拾干净。”' }],
  },
  huokou_shelter: {
    scene: 'huokou',
    title: '避风石龛',
    intro: '青石背火的一面还存着凉气。前人留下的旧匣里，只够取一件护身物。',
    revisit: '石龛里的旧匣已经空了，背风处仍能歇一口气。',
    options: [
      { key: 'bihuofu', label: '取避火符', reward: { items: { bihuofu: 1 } }, result: '你从旧匣里取出避火符一张。' },
      { key: 'jinchuang', label: '取金疮药', reward: { items: { jinchuang: 1 } }, result: '你从旧匣里取出金疮药一份。' },
    ],
  },
  jilei_camp: {
    scene: 'jilei',
    title: '营外行囊',
    intro: '营外卸货时，车后落下一只扎紧的行囊。绳索和散碎银两只能先带走一样。',
    revisit: '车辙向洞门而去，空行囊压在石块底下。',
    options: [
      { key: 'buyaosheng', label: '取捕妖绳', reward: { items: { buyaosheng: 1 } }, result: '你从行囊中取出捕妖绳一条。' },
      { key: 'money20', label: '收起二十两', reward: { money: 20 }, result: '你收起散落的二十两银子。' },
    ],
  },
  jilei_lookout: {
    scene: 'jilei',
    title: '临潭望台',
    intro: '东边云隙下露出一泓碧水。崖道留着宽蹄印，印边沾着未干的青苔，像有异兽常往潭边来去。',
    revisit: '碧水在云下忽明忽暗，蹄印仍指向潭边。',
    options: [{ key: 'observe', label: '察看潭边蹄印', reward: {}, result: '沙僧道：“这脚力来回洞府与碧水之间，洞中主人另有水路可走。”' }],
  },
};

export function explorationEntry(campaign, id) {
  return campaign.exploration?.[id] ?? null;
}

export function explorationDefinition(id) {
  return EXPLORATIONS[id] ?? null;
}

// 验证通过后才同时写记录与奖励；取消、非法地点、跨场景和重访都保持原状态。
export function commitExploration(campaign, sceneId, id, choiceKey) {
  const definition = explorationDefinition(id);
  if (!definition) return { ok: false, reason: 'unknown-landmark' };
  if (definition.scene !== sceneId) return { ok: false, reason: 'wrong-scene' };
  const previous = explorationEntry(campaign, id);
  if (previous) return { ok: false, reason: 'already-visited', entry: previous };
  const choice = definition.options.find((candidate) => candidate.key === choiceKey);
  if (!choice) return { ok: false, reason: 'invalid-choice' };

  campaign.exploration = campaign.exploration ?? {};
  const entry = { choice: choice.key };
  campaign.exploration[id] = entry;
  applyLoot(campaign, choice.reward);
  return { ok: true, entry, reward: choice.reward, result: choice.result };
}

