// 场景地图数据(梦幻式 2.5D 场景)：底图、可走区、NPC 站位、传送阵、闲话。
// 场景坐标统一为2400×1600逻辑像素，运行时按 scale 放大成世界坐标;
// 走路用粗网格 + 广度寻路，可走区由多边形圈定，不必逐像素描边。

export const MAP_SCALE = 1.15;
export const GRID = 28; // 寻路网格边长(世界像素)

// 行走立绘的归一化人体锚点：脚底中点与头顶不受画布留白、兵器或飘带影响。
// 单张图可按实际 alpha 边界覆写；缺省值适合本轮约 40° 俯视站姿。
export const WORLD_SPRITE_META = {
  wukong: { anchorX: 0.516, anchorY: 0.875, bodyTop: 0.077, facesLeft: false },
  tang: { anchorX: 0.465, anchorY: 0.882, bodyTop: 0.081, facesLeft: true },
  bajie: { anchorX: 0.613, anchorY: 0.891, bodyTop: 0.206, facesLeft: false },
  sha: { anchorX: 0.56, anchorY: 0.895, bodyTop: 0.098, facesLeft: false },
  tudi: { anchorX: 0.545, anchorY: 0.892, bodyTop: 0.124, facesLeft: false },
  luosha: { anchorX: 0.486, anchorY: 0.873, bodyTop: 0.038, facesLeft: false },
  gaoshao: { anchorX: 0.556, anchorY: 0.877, bodyTop: 0.08, facesLeft: false },
  laozhe: { anchorX: 0.557, anchorY: 0.899, bodyTop: 0.04, facesLeft: false },
  yumian: { anchorX: 0.603, anchorY: 0.915, bodyTop: 0.06, facesLeft: false },
  niumowang: { anchorX: 0.562, anchorY: 0.908, bodyTop: 0.061, facesLeft: false },
  yaojiang: { anchorX: 0.576, anchorY: 0.883, bodyTop: 0.091, facesLeft: false },
  mob_fire1: { anchorX: 0.6, anchorY: 0.899, bodyTop: 0.182, facesLeft: false },
  mob_fire2: { anchorX: 0.638, anchorY: 0.913, bodyTop: 0.142, facesLeft: true },
};

export function worldDepthScale(worldY, worldHeight) {
  const t = Math.max(0, Math.min(1, worldY / Math.max(1, worldHeight)));
  return 0.9 + t * 0.16;
}

export function worldSpriteGeometry({
  groundX,
  groundY,
  bodyHeight,
  imageWidth,
  imageHeight,
  metadata,
  depthScale = 1,
}) {
  const anchorX = metadata?.anchorX ?? 0.5;
  const anchorY = metadata?.anchorY ?? 0.96;
  const bodyTopRatio = Math.min(anchorY - 0.01, metadata?.bodyTop ?? 0.02);
  const bodyPixels = Math.max(1, (anchorY - bodyTopRatio) * imageHeight);
  const imageScale = (bodyHeight * depthScale) / bodyPixels;
  const width = imageWidth * imageScale;
  const height = imageHeight * imageScale;
  return {
    left: groundX - anchorX * width,
    top: groundY - anchorY * height,
    width,
    height,
    anchorX: groundX,
    anchorY: groundY,
    bodyTop: groundY - bodyHeight * depthScale,
    bodyBottom: groundY,
    bodyHeight: bodyHeight * depthScale,
  };
}

export function worldActorBounds(geometry) {
  const halfWidth = Math.max(30, geometry.bodyHeight * 0.32);
  return {
    left: geometry.anchorX - halfWidth,
    right: geometry.anchorX + halfWidth,
    top: geometry.bodyTop - Math.max(70, geometry.bodyHeight * 0.3),
    bottom: geometry.bodyBottom + 18,
  };
}

// NPC 名字颜色沿用梦幻习惯:NPC 黄、主角绿、妖怪红、传送阵青
export const NAME_COLORS = { npc: '#ffe45c', player: '#7dff6a', demon: '#ff6b55', portal: '#7ef3ff', party: '#d8f5c8' };

// 底图1536×1024像素用于校准，统一映射为2400×1600逻辑坐标；不随视口缩放角色。
const mapPoint = ([x, y]) => [x * 25 / 16, y * 25 / 16];
const mapPoly = (points) => points.map(mapPoint);

export const SCENES = {
  village: {
    id: 'village', name: '火焰山脚 · 火焰山庄', bg: 'map-village', size: [2400, 1600],
    walk: mapPoly([[120,90],[220,60],[340,100],[430,155],[560,170],[625,220],[800,280],[940,290],
      [1000,340],[1090,320],[1180,230],[1260,160],[1340,65],[1435,70],[1490,140],[1430,220],
      [1350,290],[1240,340],[1240,410],[1380,390],[1530,365],[1530,470],[1380,480],[1270,500],
      [1150,565],[1150,610],[1060,650],[950,690],[850,760],[900,920],[960,1020],[700,1020],
      [650,920],[600,865],[500,880],[400,900],[250,880],[200,810],[200,750],[250,690],
      [180,670],[100,660],[90,580],[150,490],[125,420],[125,330],[160,260],[240,250],[260,220],
      [220,180],[130,165]]),
    blockers: [
      mapPoly([[150,115],[260,110],[340,150],[320,220],[240,220],[165,185]]),
      mapPoly([[585,155],[780,125],[955,190],[960,280],[825,290],[740,250],[625,235]]),
      mapPoly([[135,270],[230,260],[275,305],[245,355],[160,355],[125,320]]),
      mapPoly([[455,330],[575,320],[650,400],[615,470],[500,455],[445,400]]),
      mapPoly([[95,455],[200,445],[270,470],[365,450],[450,480],[530,520],[555,600],[460,630],[365,570],[260,615],[150,610]]),
      mapPoly([[935,310],[1050,295],[1140,415],[1070,480],[940,465],[855,390]]),
      mapPoly([[490,755],[585,740],[625,785],[600,815],[520,820],[485,785]]),
      mapPoly([[290,745],[410,735],[465,785],[430,830],[340,835],[285,800]]),
      mapPoly([[560,920],[645,870],[705,900],[720,1024],[550,1024]]),
    ],
    spawn: mapPoint([720,570]),
    npcs: {
      tudi: { unit: 'tudi', name: '土地', title: '火焰山土地', at: mapPoint([260,400]), h: 118 },
      gaoshao: { unit: 'gaoshao', name: '卖糕少年', title: '药铺', at: mapPoint([400,655]), h: 104 },
      laozhe: { unit: 'laozhe', name: '庄上老者', title: '铁匠铺', at: mapPoint([810,305]), h: 112 },
    },
    portals: {
      toCuiyun: { to: 'cuiyun', at: mapPoint([840,980]), label: '翠云山 · 芭蕉洞', arrive: 'fromVillage' },
      toHuokou: { to: 'huokou', at: mapPoint([1400,140]), label: '火焰山 · 火口', arrive: 'fromVillage' },
      toJilei: { to: 'jilei', at: mapPoint([1480,420]), label: '积雷山 · 摩云洞', arrive: 'fromVillage' },
    },
    arrivals: { fromCuiyun: mapPoint([820,865]), fromHuokou: mapPoint([1270,265]), fromJilei: mapPoint([1270,455]) },
    landmarks: {
      village_well: { name: '井边水车', at: mapPoint([540,850]), footprint: [110,70] },
      village_fields: { name: '候雨旱田', at: mapPoint([1060,545]), footprint: [110,65] },
    },
    demonSpawns: mapPoly([[745,580],[800,635],[970,545],[1210,455],[730,730]]),
  },
  cuiyun: {
    id: 'cuiyun', name: '翠云山 · 芭蕉洞外', bg: 'map-cuiyun', size: [2400, 1600],
    walk: mapPoly([[55,70],[140,70],[240,150],[410,195],[500,170],[580,200],[600,280],[700,310],
      [740,350],[840,385],[910,400],[980,340],[1040,250],[1090,225],[1230,205],[1320,230],
      [1340,290],[1280,350],[1190,380],[1110,465],[1050,520],[930,565],[840,600],[860,660],
      [900,700],[980,720],[1040,700],[1130,710],[1220,750],[1320,805],[1390,850],[1390,925],
      [1320,970],[1220,920],[1100,885],[1000,890],[930,870],[880,830],[840,820],[750,760],
      [690,700],[650,660],[580,650],[480,630],[360,620],[290,620],[270,680],[220,730],
      [180,790],[190,840],[260,900],[340,940],[370,1020],[230,1020],[160,960],[70,920],
      [10,880],[0,810],[80,800],[120,750],[140,680],[120,610],[160,560],[140,520],
      [80,470],[20,450],[20,380],[140,330],[200,270],[220,240],[170,230],[100,190],[60,140]]),
    blockers: [
      mapPoly([[290,225],[390,210],[450,250],[430,285],[330,275]]),
      mapPoly([[200,260],[280,235],[300,285],[275,335],[210,340]]),
      mapPoly([[350,410],[455,385],[595,410],[685,470],[715,530],[655,555],[565,530],[530,510],[400,500],[325,475]]),
      mapPoly([[730,210],[940,190],[1010,260],[940,365],[850,380],[760,345]]),
      mapPoly([[1100,635],[1250,650],[1280,730],[1210,775],[1130,760]]),
    ],
    spawn: mapPoint([800,570]),
    npcs: {
      luosha: { unit: 'luosha', name: '罗刹女', title: '铁扇仙', at: mapPoint([1130,300]), h: 140 },
      fakeBajie: { unit: 'bajie', name: '「八戒」', title: '迎面跑来', at: mapPoint([770,645]), h: 126 },
    },
    portals: { toVillage: { to: 'village', at: mapPoint([60,860]), label: '火焰山脚', arrive: 'fromCuiyun' } },
    arrivals: { fromVillage: mapPoint([165,880]), fromCave: mapPoint([1100,365]) },
    landmarks: {
      cuiyun_grove: { name: '芭蕉林', at: mapPoint([390,335]), footprint: [100,65] },
      cuiyun_basket: { name: '临溪药篓', at: mapPoint([1080,775]), footprint: [100,65] },
    },
  },
  huokou: {
    id: 'huokou', name: '火焰山 · 火口', bg: 'map-huokou', size: [2400, 1600],
    walk: mapPoly([[0,0],[95,0],[180,70],[230,100],[230,150],[350,195],[450,250],[490,285],
      [620,270],[720,225],[900,160],[1030,150],[1130,180],[1150,235],[1050,270],[960,340],
      [900,400],[930,460],[1070,480],[1180,455],[1300,420],[1385,360],[1490,350],[1530,390],
      [1480,440],[1370,470],[1280,520],[1170,560],[1100,590],[1090,640],[1160,700],[1220,770],
      [1280,825],[1340,900],[1300,975],[1160,965],[1050,920],[980,870],[920,820],[850,800],
      [750,780],[700,800],[640,860],[540,900],[380,890],[300,840],[250,780],[180,750],
      [130,690],[60,670],[0,700],[0,610],[100,590],[200,550],[260,510],[180,500],[80,535],[0,550]]),
    blockers: [
      mapPoly([[250,160],[400,190],[445,260],[380,280],[300,260]]),
      mapPoly([[440,290],[520,270],[580,340],[555,395],[470,405],[425,350]]),
      mapPoly([[960,270],[1080,250],[1150,285],[1175,385],[1110,430],[1020,390],[990,335]]),
      mapPoly([[170,585],[260,560],[350,610],[370,695],[310,735],[245,690]]),
      mapPoly([[400,525],[530,510],[625,550],[680,620],[630,670],[565,645],[480,600],[400,600]]),
      mapPoly([[750,640],[825,630],[890,690],[970,735],[1030,810],[1000,855],[925,820],[850,795],[770,770],[710,735]]),
    ],
    spawn: mapPoint([560,450]),
    npcs: { tudi: { unit: 'tudi', name: '土地', title: '火焰山土地', at: mapPoint([750,405]), h: 118 } },
    portals: { toVillage: { to: 'village', at: mapPoint([65,510]), label: '火焰山脚', arrive: 'fromHuokou' } },
    arrivals: { fromVillage: mapPoint([280,510]) },
    landmarks: {
      huokou_bricks: { name: '八卦炉残砖', at: mapPoint([1100,490]), footprint: [110,70] },
      huokou_shelter: { name: '避风石龛', at: mapPoint([520,700]), footprint: [110,70] },
    },
    demonSpawns: mapPoly([[650,425],[790,475],[885,535],[1000,525],[780,570]]),
  },
  jilei: {
    id: 'jilei', name: '积雷山 · 摩云洞前', bg: 'map-jilei', size: [2400, 1600],
    walk: mapPoly([[15,960],[90,870],[170,805],[200,730],[240,650],[340,570],[420,510],[460,435],
      [535,390],[480,345],[370,300],[260,270],[180,225],[110,215],[80,170],[90,80],
      [180,45],[320,55],[430,110],[475,190],[460,260],[560,315],[640,330],[740,290],
      [805,225],[880,185],[970,175],[1080,180],[1165,210],[1220,260],[1310,290],[1390,315],
      [1455,365],[1430,415],[1390,455],[1370,500],[1300,545],[1250,575],[1300,610],[1380,650],
      [1400,720],[1360,770],[1260,795],[1190,790],[1120,755],[1040,720],[950,670],
      [900,620],[800,595],[690,590],[580,590],[510,620],[460,670],[390,720],[360,790],
      [285,835],[235,900],[165,955],[85,1015],[0,1015]]),
    blockers: [
      mapPoly([[165,90],[275,80],[370,135],[400,205],[360,230],[270,205],[200,190]]),
      mapPoly([[330,320],[410,295],[475,335],[470,370],[405,390]]),
      mapPoly([[600,375],[700,345],[770,350],[780,420],[855,455],[925,500],[900,540],[825,550],[760,510],[690,460],[615,440]]),
      mapPoly([[1040,345],[1120,320],[1230,355],[1290,410],[1270,445],[1150,475],[1070,455],[1030,400]]),
      mapPoly([[505,535],[580,515],[655,545],[640,575],[560,580]]),
      mapPoly([[1040,565],[1110,540],[1170,570],[1180,625],[1110,655],[1060,625]]),
    ],
    spawn: mapPoint([595,430]),
    npcs: {
      yumian: { unit: 'yumian', name: '玉面公主', title: '摩云洞', at: mapPoint([1000,285]), h: 132 },
      niumowang: { unit: 'niumowang', name: '牛魔王', title: '平天大圣', at: mapPoint([1110,260]), h: 150 },
      guardL: { unit: 'yaojiang', name: '摩云洞妖将', title: '把门', at: mapPoint([910,295]), h: 128, demon: true },
      guardR: { unit: 'yaojiang', name: '摩云洞妖将', title: '把门', at: mapPoint([1220,310]), h: 128, demon: true },
    },
    portals: { toVillage: { to: 'village', at: mapPoint([85,920]), label: '火焰山脚', arrive: 'fromJilei' } },
    arrivals: { fromVillage: mapPoint([235,775]) },
    landmarks: {
      jilei_camp: { name: '营外行囊', at: mapPoint([430,270]), footprint: [110,70] },
      jilei_lookout: { name: '望潭台', at: mapPoint([1240,670]), footprint: [110,70] },
    },
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
