// 成长结算(纯函数,node 可测):升级发点、熟练进阶、加点/推荐加点。
// 决定论:全部定值或按权重整数分配,不引入新随机;捕捉判定在 engine 走独立 catchRng。

import { GROWTH, PARTY } from './data.js';
import { skillsAtLevel } from './engine.js';

// 升级结算:每位 +N 潜力点;已习得法术熟练+1(上限 GROWTH.skillRankCap)
// ups: levelUpParty 的返回 {key:{level,newSkills}};campaign 就地修改
export function settleLevelUp(campaign, ups) {
  const granted = {};
  for (const [key, up] of Object.entries(ups)) {
    campaign.pendingPoints[key] = (campaign.pendingPoints[key] ?? 0) + GROWTH.pointsPerLevel;
    const def = PARTY[key];
    if (!def) continue;
    campaign.skillLevels[key] = campaign.skillLevels[key] ?? {};
    for (const sk of skillsAtLevel(def, up.level)) {
      const cur = campaign.skillLevels[key][sk] ?? 1;
      campaign.skillLevels[key][sk] = Math.min(GROWTH.skillRankCap, cur + 1);
    }
    granted[key] = { points: GROWTH.pointsPerLevel };
  }
  return granted;
}

// 推荐加点:按 PARTY.recommendedAlloc 权重整数分配(确定、可复现)
export function recommendAlloc(def, points) {
  const weights = def.recommendedAlloc ?? { 攻: 1 };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const alloc = {};
  let used = 0;
  const entries = Object.entries(weights);
  for (const [stat, w] of entries) {
    alloc[stat] = Math.floor((points * w) / total);
    used += alloc[stat];
  }
  // 余数按权重从大到小逐个补齐
  let rest = points - used;
  const byWeight = [...entries].sort((a, b) => b[1] - a[1]);
  for (let i = 0; rest > 0; i = (i + 1) % byWeight.length) {
    alloc[byWeight[i][0]] += 1;
    rest -= 1;
  }
  return alloc;
}

// 手动加点(返回是否成功);delta=+1 投点,-1 洗回
export function allocatePoint(campaign, key, stat, delta) {
  campaign.alloc[key] = campaign.alloc[key] ?? {};
  const cur = campaign.alloc[key][stat] ?? 0;
  const pending = campaign.pendingPoints[key] ?? 0;
  if (delta > 0) {
    if (pending <= 0 || cur >= GROWTH.statCap) return false;
    campaign.alloc[key][stat] = cur + 1;
    campaign.pendingPoints[key] = pending - 1;
    return true;
  }
  if (delta < 0) {
    if (cur <= 0) return false;
    campaign.alloc[key][stat] = cur - 1;
    campaign.pendingPoints[key] = pending + 1;
    return true;
  }
  return false;
}

// 一键推荐加点:把某单位全部 pending 按权重投入(受 statCap 保护)
export function applyRecommend(campaign, key) {
  const def = PARTY[key];
  const pending = campaign.pendingPoints[key] ?? 0;
  if (!def || pending <= 0) return 0;
  const plan = recommendAlloc(def, pending);
  let used = 0;
  campaign.alloc[key] = campaign.alloc[key] ?? {};
  for (const [stat, n] of Object.entries(plan)) {
    const cur = campaign.alloc[key][stat] ?? 0;
    const room = Math.max(0, GROWTH.statCap - cur);
    const put = Math.min(n, room);
    if (put > 0) {
      campaign.alloc[key][stat] = cur + put;
      used += put;
    }
  }
  campaign.pendingPoints[key] = pending - used;
  return used;
}
