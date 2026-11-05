// 场景地图数据(梦幻式 2.5D 场景)：底图、可走区、NPC 站位、传送阵、闲话。
// 场景坐标统一为2400×1600逻辑像素，运行时按 scale 放大成世界坐标;
// 走路用粗网格 + 广度寻路，道路宽度与物件占地同时用于绘制和碰撞。

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

// 道路、物件与占地是地图的共同事实；不再把低分辨率整幅风景拉大后另描碰撞。
const road = (points, width = 260) => ({ points, width });
const plaza = (at, width = 360) => road([at], width);
// 透明物件的实际不透明基线各不相同；锚点来自源图 alpha>160 的底边测量。
const PROP_ANCHOR_Y = {
  shrine:0.974, market:0.960, forge:0.956, tree:0.937, rocks:0.821, cave:0.884,
  furnace:0.971, 'demon-gate':0.982, well:0.947, basket:0.927, banana:0.884,
  'village-house':0.987, 'water-cart':0.98, bamboo:0.952, 'basalt-ridge':0.887,
  'furnace-ruin':0.898, 'dead-tree':0.957, 'demon-banner':0.956, 'supply-crates':0.941, 'lakeside-crag':0.925,
};
const prop = (id, art, at, size, footprint, extra = {}) => ({
  id, art, at, size, footprint, anchor:[0.5, PROP_ANCHOR_Y[art] ?? 0.97], ...extra,
});
const PAINTED_VISUAL_BLOCKER_ARTS = new Set([
  'village-house','market','forge','shrine','tree','dead-tree',
  'cave','demon-gate','furnace','furnace-ruin','bamboo','banana',
]);
const blockerPolygon = (p, footprint) => {
  const [l,t,r,b] = footprint, [x,y] = p.at;
  return [[x+l,y+t],[x+r,y+t],[x+r,y+b],[x+l,y+b]];
};
function mapScene(scene) {
  scene.terrain.chunks = ['nw','ne','sw','se'].map((quadrant, index) => ({
    art: `${scene.id}${scene.terrain.overlap ? '-overlap' : scene.terrain.painted ? '-painted' : ''}-${quadrant}`,
    at: [(index % 2) * (scene.terrain.overlap ? 1080 : 1200), Math.floor(index / 2) * (scene.terrain.overlap ? 720 : 800)],
    size: scene.terrain.overlap ? [1320,880] : [1200,800],
    fadeLeft: scene.terrain.overlap && index % 2 ? 240 : 0,
    fadeTop: scene.terrain.overlap && index > 1 ? 160 : 0,
  }));
  scene.walk = [[36,36],[2364,36],[2364,1564],[36,1564]];
  scene.clearance = 18;
  const solidScenery = scene.scenery.filter((p) => p.solid !== false && p.footprint);
  scene.physicalBlockers = solidScenery.map((p) => blockerPolygon(p, p.footprint));
  scene.paintedBlockers = solidScenery.map((p) => {
    const navigationFootprint = PAINTED_VISUAL_BLOCKER_ARTS.has(p.art)
      ? [-p.size[0] * p.anchor[0], -p.size[1] * p.anchor[1], p.size[0] * (1 - p.anchor[0]), p.size[1] * (1 - p.anchor[1])]
      : p.footprint;
    return blockerPolygon(p, navigationFootprint);
  });
  scene.blockers = scene.terrain.painted ? scene.paintedBlockers : scene.physicalBlockers;
  return scene;
}

export const SCENES = {
  village: mapScene({
    id: 'village', name: '火焰山脚 · 火焰山庄', size: [2400,1600],
    terrain: { painted:true, overlap:true, ground:'sand', baseColor:'#aaa183', roadColor:'#cabea1', edgeColor:'#a89a7e', waterColor:'#74968c' },
    paths: [
      road([[1312,1530],[1100,1200],[1125,890],[1200,650],[1400,500],[1750,500],[2187,219]]),
      road([[1125,890],[820,780],[600,650],[406,625]]),
      road([[820,780],[650,1000],[625,1023]]),
      road([[1200,650],[1265,476]]),
      road([[1100,1200],[844,1328]]),
      road([[1125,890],[1450,880],[1656,852],[1910,900],[2312,656]]),
      plaza([406,625]),plaza([625,1023]),plaza([1265,476]),plaza([844,1328],300),plaza([1656,852],320),
    ],
    features: [],
    scenery: [
      prop('earth-shrine','shrine',[406,500],[340,300],[-135,-65,135,0]),
      prop('food-stall','market',[625,920],[280,230],[-115,-55,115,0]),
      prop('blacksmith','forge',[1265,350],[340,300],[-140,-65,140,0]),
      prop('north-house','village-house',[1580,260],[380,330],[-145,-70,145,0]),
      prop('east-house','village-house',[1910,270],[350,305],[-135,-65,135,0]),
      prop('west-hamlet','village-house',[300,950],[350,305],[-135,-65,135,0]),
      prop('orchard-shade','tree',[500,1450],[270,310],[-45,-35,45,0]),
      prop('old-well','well',[780,1220],[180,160],[-65,-40,65,0]),
      prop('v-tree-west','tree',[190,920],[220,260],[-38,-35,38,0]),
      prop('v-tree-crossroads','tree',[960,590],[270,310],[-40,-35,40,0]),
      prop('v-tree-well-road','tree',[1400,1240],[260,300],[-40,-35,40,0]),
      prop('v-rock-market-path','rocks',[850,1100],[215,140],[-80,-40,80,0]),
      prop('v-rock-workshop','rocks',[1500,675],[220,145],[-80,-40,80,0]),
      prop('v-tree-north','tree',[910,355],[240,280],[-40,-35,40,0]),
      prop('v-tree-east','tree',[1990,1200],[220,260],[-40,-35,40,0]),
      prop('v-rock-west','rocks',[340,1180],[210,140],[-80,-45,80,0]),
      prop('v-rock-east','rocks',[1870,430],[200,130],[-75,-40,75,0]),
      prop('courtyard-house','village-house',[1510,470],[390,335],[-150,-70,150,0]),
      prop('south-house','village-house',[1580,1480],[400,340],[-155,-72,155,0]),
      prop('east-hamlet-house','village-house',[2220,1080],[370,320],[-145,-68,145,0]),
      prop('well-water-cart','water-cart',[730,1400],[240,190],[-80,-38,80,0]),
      prop('field-dry-north','dry-field',[1910,1180],[480,340],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('field-dry-south','dry-field',[1900,1420],[460,280],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('courtyard-crates','supply-crates',[1040,330],[210,155],[-75,-38,75,0]),
      prop('south-crates','supply-crates',[1450,1160],[220,160],[-78,-40,78,0]),
      prop('field-dead-tree','dead-tree',[2260,1390],[260,310],[-42,-34,42,0]),
      prop('south-orchard-tree','tree',[1750,1510],[260,300],[-42,-35,42,0]),
    ],
    spawn: [790,640],
    npcs: {
      tudi:{unit:'tudi',name:'土地',title:'火焰山土地',at:[406,625],h:118},
      gaoshao:{unit:'gaoshao',name:'卖糕少年',title:'药铺',at:[625,1023],h:104},
      laozhe:{unit:'laozhe',name:'庄上老者',title:'铁匠铺',at:[1265,476],h:112},
    },
    portals: {
      toCuiyun:{to:'cuiyun',at:[1312,1530],label:'翠云山 · 芭蕉洞',arrive:'fromVillage'},
      toHuokou:{to:'huokou',at:[2187,219],label:'火焰山 · 火口',arrive:'fromVillage'},
      toJilei:{to:'jilei',at:[2312,656],label:'积雷山 · 摩云洞',arrive:'fromVillage'},
    },
    arrivals:{fromCuiyun:[1260,1420],fromHuokou:[2000,340],fromJilei:[2140,720]},
    landmarks:{
      village_well:{name:'井边水车',at:[844,1328],footprint:[110,70]},
      village_fields:{name:'候雨旱田',at:[1656,852],footprint:[110,65]},
    },
    demonSpawns:[[1125,990],[1470,880],[1660,500],[1200,715],[840,1280]],
  }),
  cuiyun: mapScene({
    id:'cuiyun',name:'翠云山 · 芭蕉洞外',size:[2400,1600],
    terrain:{painted:true,overlap:true,ground:'moss',baseColor:'#768b74',roadColor:'#a3b092',edgeColor:'#7c8e72',waterColor:'#749c9e'},
    paths:[
      road([[94,1344],[258,1375],[500,1300],[700,1120],[820,1050]],260),
      road([[850,1050],[1250,1050]],110),
      road([[1280,1050],[1480,800],[1718,570],[1765,469]]),
      road([[820,1050],[700,800],[609,523]]),
      road([[1280,1050],[1500,1210],[1687,1210]]),
      plaza([609,523],360),plaza([1765,469],480),plaza([1687,1210],360),
    ],
    features:[{kind:'water',polygon:[[980,650],[1080,660],[1130,740],[1115,860],[1140,970],[1130,1120],[1170,1250],[1140,1370],[1230,1530],[1190,1580],[1010,1560],[1020,1430],[960,1310],[980,1190],[960,1080],[970,950],[945,840],[965,740]],color:'#719b9a'}],
    scenery:[
      prop('banana-cave','cave',[1765,300],[440,340],[-180,-80,180,0]),
      prop('stream-bridge','wood-crossing',[1050,1050],[440,300],null,{solid:false,layer:'ground',anchor:[0.5,0.505]}),
      prop('grove-one','banana',[480,350],[280,320],[-45,-35,45,0]),
      prop('grove-two','banana',[380,650],[250,290],[-45,-35,45,0]),
      prop('grove-three','banana',[850,490],[230,270],[-42,-35,42,0]),
      prop('banana-grove-back','banana',[630,270],[300,320],[-45,-35,45,0]),
      prop('banana-grove-west','banana',[280,470],[270,300],[-45,-35,45,0]),
      prop('banana-grove-south','banana',[360,900],[280,300],[-45,-35,45,0]),
      prop('c-tree-north','tree',[1480,300],[250,290],[-45,-35,45,0]),
      prop('c-tree-east','tree',[2050,980],[260,300],[-45,-35,45,0]),
      prop('c-rock-north','rocks',[1220,570],[250,170],[-95,-55,95,0]),
      prop('c-rock-bank','rocks',[810,1410],[220,145],[-85,-45,85,0]),
      prop('herb-basket','basket',[1730,1100],[140,125],[-42,-25,42,0]),
      prop('riverbank-upper','riverbank',[1040,780],[430,310],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('riverbank-middle','riverbank',[1060,1240],[440,320],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('riverbank-south','riverbank',[1160,1470],[480,240],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('riverbank-west','riverbank',[760,1460],[390,230],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('bamboo-northwest','bamboo',[170,270],[300,350],[-42,-38,42,0]),
      prop('bamboo-grove-back','bamboo',[760,190],[330,370],[-45,-38,45,0]),
      prop('bamboo-creek-north','bamboo',[990,390],[290,340],[-42,-36,42,0]),
      prop('bamboo-cave-east','bamboo',[2180,420],[330,380],[-46,-40,46,0]),
      prop('bamboo-east-bank','bamboo',[2180,1320],[320,370],[-45,-38,45,0]),
      prop('bamboo-south-bank','bamboo',[1490,1520],[330,380],[-46,-40,46,0]),
      prop('bamboo-west-path','bamboo',[310,1160],[300,350],[-42,-36,42,0]),
      prop('creek-stones-north','rocks',[900,850],[220,145],[-82,-44,82,0]),
      prop('creek-stones-south','rocks',[1300,1390],[230,150],[-86,-45,86,0]),
    ],
    spawn:[1280,1030],
    npcs:{luosha:{unit:'luosha',name:'罗刹女',title:'铁扇仙',at:[1765,469],h:140},fakeBajie:{unit:'bajie',name:'猪八戒',title:'从山下赶来',at:[1535,850],h:126}},
    portals:{toVillage:{to:'village',at:[94,1344],label:'火焰山脚',arrive:'fromCuiyun'}},
    arrivals:{fromVillage:[258,1375],fromCave:[1718,570]},
    landmarks:{cuiyun_grove:{name:'芭蕉林',at:[609,523],footprint:[100,65]},cuiyun_basket:{name:'临溪药篓',at:[1687,1210],footprint:[100,65]}},
  }),
  huokou: mapScene({
    id:'huokou',name:'火焰山 · 火口',size:[2400,1600],
    terrain:{painted:true,overlap:true,ground:'basalt',baseColor:'#605a51',roadColor:'#9a8a78',edgeColor:'#73675b',waterColor:'#9c4e31'},
    paths:[
      road([[102,797],[437,797],[850,800],[1172,633],[1450,660],[1718,766]]),
      road([[850,800],[812,1094]]),
      road([[1172,633],[1200,1100],[1800,1100],[1900,850],[1718,766]],210),
      plaza([1172,633],420),plaza([1718,766],380),plaza([812,1094],360),
    ],
    features:[{kind:'lava',polygon:[[1370,930],[1510,950],[1640,920],[1740,975],[1760,1070],[1840,1150],[1890,1280],[1770,1360],[1650,1320],[1510,1380],[1400,1330],[1280,1230],[1320,1130],[1290,1040]],color:'#984a2b'}],
    scenery:[
      prop('fallen-furnace','furnace-ruin',[1810,570],[430,330],[-165,-80,165,0]),
      prop('shelter-rock','rocks',[810,950],[290,190],[-105,-60,105,0]),
      prop('lava-bridge','stone-crossing',[1500,1100],[640,296],null,{solid:false,layer:'ground',anchor:[0.5,0.38],sourceRect:[26,309,1720,343]}),
      prop('h-rock-north','rocks',[700,500],[270,175],[-100,-50,100,0]),
      prop('h-rock-west','rocks',[320,1190],[270,180],[-100,-55,100,0]),
      prop('h-rock-east','rocks',[2110,1000],[250,165],[-95,-50,95,0]),
      prop('h-ridge-west','basalt-ridge',[330,470],[430,290],[-155,-72,155,0]),
      prop('h-ridge-north','basalt-ridge',[1500,290],[470,310],[-170,-78,170,0]),
      prop('h-ridge-east','basalt-ridge',[2120,620],[420,280],[-150,-70,150,0]),
      prop('h-rock-south','rocks',[1080,1370],[260,175],[-95,-50,95,0]),
      prop('ash-west','ash-ground',[390,920],[460,330],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('ash-north','ash-ground',[1180,330],[470,310],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('ash-east','ash-ground',[2040,850],[450,320],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('ash-south','ash-ground',[1060,1450],[480,250],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('ridge-northwest','basalt-ridge',[700,250],[450,300],[-165,-75,165,0]),
      prop('ridge-southwest','basalt-ridge',[350,1460],[440,290],[-160,-72,160,0]),
      prop('ridge-southeast','basalt-ridge',[2130,1390],[460,300],[-168,-75,168,0]),
      prop('ridge-lava-rim','basalt-ridge',[1550,1460],[430,285],[-155,-70,155,0]),
      prop('charred-tree-west','dead-tree',[120,420],[270,330],[-42,-36,42,0]),
      prop('charred-tree-north','dead-tree',[1100,220],[260,320],[-40,-35,40,0]),
      prop('charred-tree-east','dead-tree',[2290,900],[280,340],[-44,-38,44,0]),
      prop('charred-tree-south','dead-tree',[760,1490],[270,330],[-42,-36,42,0]),
      prop('furnace-bricks','furnace-ruin',[1940,760],[300,220],[-105,-50,105,0]),
      prop('furnace-rubble','furnace-ruin',[1640,430],[270,205],[-95,-48,95,0]),
      prop('ridge-far-west','basalt-ridge',[110,1080],[400,270],[-145,-68,145,0]),
      prop('charred-tree-rim','dead-tree',[2280,320],[270,330],[-42,-36,42,0]),
    ],
    spawn:[875,703],
    npcs:{tudi:{unit:'tudi',name:'土地',title:'火焰山土地',at:[1172,633],h:118}},
    portals:{toVillage:{to:'village',at:[102,797],label:'火焰山脚',arrive:'fromHuokou'}},
    arrivals:{fromVillage:[437,797]},
    landmarks:{huokou_bricks:{name:'八卦炉残砖',at:[1718,766],footprint:[110,70]},huokou_shelter:{name:'避风石龛',at:[812,1094],footprint:[110,70]}},
    demonSpawns:[[850,800],[1000,720],[1430,660],[1800,1140],[1200,1000]],
  }),
  jilei: mapScene({
    id:'jilei',name:'积雷山 · 摩云洞前',size:[2400,1600],
    terrain:{painted:true,overlap:true,ground:'slate',baseColor:'#797984',roadColor:'#aaa6a8',edgeColor:'#84808a',waterColor:'#76959b'},
    paths:[
      road([[133,1437],[367,1211],[700,1100],[1000,900],[1250,750],[1500,600],[1562,445]]),
      road([[1000,900],[850,650],[672,422]]),
      road([[1250,750],[1600,900],[1938,1047]]),
      plaza([1650,500],600),plaza([672,422],380),plaza([1938,1047],320),
    ],
    features:[{kind:'water',polygon:[[2210,770],[2330,810],[2380,750],[2390,1580],[1610,1580],[1730,1450],[1860,1420],[1920,1330],[2030,1290],[2100,1180],[2160,1150],[2110,1050],[2160,970],[2130,870]],color:'#76959b'}],
    scenery:[
      prop('cloud-cave-gate','demon-gate',[1700,300],[450,350],[-185,-85,185,0]),
      prop('supply-camp','supply-crates',[650,280],[280,220],[-105,-55,105,0]),
      prop('j-tree-west','tree',[330,800],[250,290],[-42,-35,42,0]),
      prop('j-tree-south','tree',[1250,1240],[240,280],[-42,-35,42,0]),
      prop('j-tree-east','tree',[2200,670],[250,290],[-42,-35,42,0]),
      prop('j-grove-camp','tree',[950,300],[300,330],[-45,-35,45,0]),
      prop('j-grove-west','tree',[720,1400],[300,340],[-45,-35,45,0]),
      prop('j-grove-gate','tree',[2050,280],[280,310],[-45,-35,45,0]),
      prop('j-rock-camp','rocks',[490,520],[220,145],[-85,-45,85,0]),
      prop('j-rock-mid','rocks',[1230,450],[260,170],[-95,-50,95,0]),
      prop('j-rock-lookout','lakeside-crag',[2040,890],[310,220],[-110,-58,110,0]),
      prop('grass-camp','mountain-grass',[620,410],[440,300],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('grass-west','mountain-grass',[340,1120],[460,320],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('grass-gate','mountain-grass',[1720,650],[480,330],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('grass-lookout','mountain-grass',[1940,1190],[450,310],null,{solid:false,layer:'ground',anchor:[0.5,0.5]}),
      prop('camp-crates-west','supply-crates',[470,340],[230,170],[-82,-42,82,0]),
      prop('camp-crates-east','supply-crates',[820,300],[230,170],[-82,-42,82,0]),
      prop('camp-banner-west','demon-banner',[390,310],[180,300],[-28,-24,28,0]),
      prop('camp-banner-east','demon-banner',[900,330],[180,300],[-28,-24,28,0]),
      prop('gate-banner-left','demon-banner',[1360,330],[190,320],[-30,-25,30,0]),
      prop('gate-banner-right','demon-banner',[2040,360],[190,320],[-30,-25,30,0]),
      prop('lake-crag-north','lakeside-crag',[2220,780],[370,260],[-132,-65,132,0]),
      prop('lake-crag-middle','lakeside-crag',[2240,1120],[390,270],[-140,-68,140,0]),
      prop('lake-crag-south','lakeside-crag',[2050,1470],[420,290],[-150,-72,150,0]),
      prop('gate-crag-left','lakeside-crag',[1270,250],[340,240],[-122,-60,122,0]),
      prop('gate-crag-right','lakeside-crag',[2150,260],[350,245],[-125,-62,125,0]),
    ],
    spawn:[930,672],
    npcs:{
      yumian:{unit:'yumian',name:'玉面公主',title:'摩云洞',at:[1562,445],h:132},
      niumowang:{unit:'niumowang',name:'牛魔王',title:'平天大圣',at:[1734,406],h:150},
      guardL:{unit:'yaojiang',name:'摩云洞妖将',title:'把门',at:[1422,461],h:128,demon:true},
      guardR:{unit:'yaojiang',name:'摩云洞妖将',title:'把门',at:[1906,484],h:128,demon:true},
    },
    portals:{toVillage:{to:'village',at:[133,1437],label:'火焰山脚',arrive:'fromJilei'}},
    arrivals:{fromVillage:[367,1211]},
    landmarks:{jilei_camp:{name:'营外行囊',at:[672,422],footprint:[110,70]},jilei_lookout:{name:'望潭台',at:[1938,1047],footprint:[110,70]}},
  }),
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
  gaoshao: ['热糕！刚出笼的热糕！', '这地方不种庄稼，糕粉都是拿钱去外头换的。', '金疮药也有，打妖怪的客官多带两贴！'],
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
