// 场景地图数据(梦幻式 2.5D 场景)：底图、可走区、NPC 站位、传送阵、闲话。
// 坐标一律写在原图像素(1672×941)上，运行时按 scale 放大成世界坐标;
// 走路用粗网格 + 广度寻路，可走区由多边形圈定，不必逐像素描边。

export const MAP_SCALE = 1.15;
export const GRID = 28; // 寻路网格边长(世界像素)

// NPC 名字颜色沿用梦幻习惯:NPC 黄、主角绿、妖怪红、传送阵青
export const NAME_COLORS = { npc: '#ffe45c', player: '#7dff6a', demon: '#ff6b55', portal: '#7ef3ff', party: '#d8f5c8' };

export const SCENES = {
  village: {
    id: 'village', name: '火焰山脚 · 火焰山庄', bg: 'map-village', size: [1672, 941],
    walk: [[330, 330], [520, 240], [700, 205], [850, 125], [960, 112], [1010, 180], [1150, 232], [1450, 178],
      [1610, 132], [1655, 196], [1420, 300], [1330, 420], [1345, 560], [1450, 625], [1320, 760], [1250, 941],
      [800, 941], [720, 860], [520, 800], [440, 700], [300, 712], [230, 640], [300, 560], [240, 490], [200, 470], [230, 420]],
    spawn: [820, 560],
    npcs: {
      tudi: { unit: 'tudi', name: '土地', title: '火焰山土地', at: [236, 482], h: 118 },
      gaoshao: { unit: 'gaoshao', name: '卖糕少年', title: '药铺', at: [330, 610], h: 104 },
      laozhe: { unit: 'laozhe', name: '庄上老者', title: '铁匠铺', at: [610, 262], h: 112 },
    },
    portals: {
      toCuiyun: { to: 'cuiyun', at: [820, 900], label: '翠云山 · 芭蕉洞', arrive: 'fromVillage' },
      toHuokou: { to: 'huokou', at: [1330, 296], label: '火焰山 · 火口', arrive: 'fromVillage' },
      toJilei: { to: 'jilei', at: [1405, 640], label: '积雷山 · 摩云洞', arrive: 'fromVillage' },
    },
    arrivals: { fromCuiyun: [840, 800], fromHuokou: [1260, 360], fromJilei: [1290, 610] },
  },
  cuiyun: {
    id: 'cuiyun', name: '翠云山 · 芭蕉洞外', bg: 'map-cuiyun', size: [1672, 941],
    walk: [[90, 240], [300, 280], [560, 300], [860, 296], [905, 205], [1090, 205], [1120, 300], [1270, 380],
      [1420, 450], [1470, 560], [1360, 622], [1600, 652], [1660, 702], [1600, 762], [1330, 722], [1100, 762],
      [960, 820], [800, 832], [560, 792], [420, 742], [230, 642], [100, 562], [60, 502], [120, 472], [100, 330]],
    spawn: [700, 520],
    npcs: {
      luosha: { unit: 'luosha', name: '罗刹女', title: '铁扇仙', at: [995, 318], h: 140 },
      fakeBajie: { unit: 'bajie', name: '「八戒」', title: '迎面跑来', at: [430, 405], h: 126 },
    },
    portals: {
      toVillage: { to: 'village', at: [110, 262], label: '火焰山脚', arrive: 'fromCuiyun' },
    },
    arrivals: { fromVillage: [250, 330], fromCave: [990, 400] },
  },
  huokou: {
    id: 'huokou', name: '火焰山 · 火口', bg: 'map-huokou', size: [1672, 941],
    walk: [[300, 90], [420, 125], [560, 212], [880, 222], [1100, 232], [1350, 272], [1460, 332], [1450, 442],
      [1560, 542], [1480, 642], [1300, 702], [1100, 802], [800, 842], [620, 702], [480, 622], [400, 502],
      [470, 402], [400, 322], [330, 205], [220, 95], [110, 72]],
    spawn: [760, 480],
    npcs: {
      tudi: { unit: 'tudi', name: '土地', title: '火焰山土地', at: [700, 340], h: 118 },
    },
    portals: {
      toVillage: { to: 'village', at: [340, 222], label: '火焰山脚', arrive: 'fromHuokou' },
    },
    arrivals: { fromVillage: [470, 330] },
    demonArea: [[560, 300], [1380, 760]],
  },
  jilei: {
    id: 'jilei', name: '积雷山 · 摩云洞前', bg: 'map-jilei', size: [1672, 941],
    walk: [[470, 262], [760, 252], [980, 272], [1160, 292], [1400, 332], [1450, 422], [1380, 522], [1330, 642],
      [1280, 802], [1150, 832], [1000, 782], [900, 702], [700, 692], [560, 642], [480, 682], [300, 782],
      [120, 882], [60, 832], [250, 702], [420, 602], [380, 482], [430, 382]],
    spawn: [760, 520],
    npcs: {
      yumian: { unit: 'yumian', name: '玉面公主', title: '摩云洞', at: [900, 392], h: 132 },
      niumowang: { unit: 'niumowang', name: '牛魔王', title: '平天大圣', at: [1092, 312], h: 150 },
      guardL: { unit: 'yaojiang', name: '摩云洞妖将', title: '把门', at: [760, 300], h: 128, demon: true },
      guardR: { unit: 'yaojiang', name: '摩云洞妖将', title: '把门', at: [1300, 372], h: 128, demon: true },
    },
    portals: {
      toVillage: { to: 'village', at: [330, 690], label: '火焰山脚', arrive: 'fromJilei' },
    },
    arrivals: { fromVillage: [470, 610] },
  },
};

// 场景连接图(自动寻路跨图用)：村子是枢纽
export function nextPortalToward(fromScene, toScene) {
  if (fromScene === toScene) return null;
  const scene = SCENES[fromScene];
  const direct = Object.entries(scene.portals).find(([, p]) => p.to === toScene);
  if (direct) return direct[0];
  return Object.entries(scene.portals).find(([, p]) => p.to === 'village')?.[0] ?? null;
}

// NPC 闲话(当前频道 + 头顶气泡);只写看得见的处境，不复述规则
export const BARKS = {
  tudi: ['这山的火，是五百年前从八卦炉里落下来的砖。', '小神原是兜率宫看炉的道人，砖落了，便被罚来守这里。', '火妖又从砖缝里钻出来了……'],
  gaoshao: ['热糕!刚出笼的热糕！', '这地方不种庄稼，糕粉都是拿钱去外头换的。', '金疮药也有，打妖怪的客官多带两贴！'],
  laozhe: ['火大，铁也好打。', '庄上十年才得铁扇仙扇一回雨。', '刀枪趁手了，火妖才近不得身。'],
  luosha: ['……', '我的孩儿……'],
  yumian: ['大王在洞里歇着，闲人莫近。'],
  niumowang: ['哪个在洞外聒噪？'],
};

// 队伍拌嘴:scene 标出说得通的场景(不标 = 哪里都能说)
export const PARTY_BANTER = [
  { who: 'bajie', text: '猴哥，这地皮烫脚，老猪的蹄子都要熟了。', scene: ['village', 'huokou'] },
  { who: 'sha', text: '师父，水囊还有半袋，先润润口。', scene: ['village', 'huokou', 'jilei'] },
  { who: 'tang', text: '悟空，莫与人争强，问清了再动手。' },
  { who: 'bajie', text: '那卖糕的香得很，师兄借几文钱来？', scene: ['village'] },
  { who: 'sha', text: '大师兄，行李我看着，只管去。' },
  { who: 'bajie', text: '这山上倒凉快，老猪不想走了。', scene: ['cuiyun'] },
  { who: 'tang', text: '好一片芭蕉林。那洞里的人，也是做娘的。', scene: ['cuiyun'] },
  { who: 'bajie', text: '这洞口阴森森的，老牛的排场倒不小。', scene: ['jilei'] },
];
