// 成长结算(纯函数,node 可测):升级发点、修炼点投法、加点/推荐加点。
// 决定论:全部定值或按权重整数分配,不引入新随机;捕捉判定在 engine 走独立 catchRng。

import { GROWTH, PARTY, SKILLS } from './data.js';
import { skillsAtLevel } from './engine.js';

// 升级结算:每位 +N 潜力点、+1 修炼点。法术熟练不再自动进阶——
// 修炼点由玩家在「角色」面板投给某一个已习得法术(见 allocateSkillPoint)。
// ups: levelUpParty 的返回 {key:{level,newSkills}};campaign 就地修改
export function settleLevelUp(campaign, ups) {
  const granted = {};
  for (const [key, up] of Object.entries(ups)) {
    campaign.pendingPoints[key] = (campaign.pendingPoints[key] ?? 0) + GROWTH.pointsPerLevel;
    const def = PARTY[key];
    if (!def) continue;
    campaign.skillPoints = campaign.skillPoints ?? {};
    campaign.skillPoints[key] = (campaign.skillPoints[key] ?? 0) + (GROWTH.skillPointsPerLevel ?? 1);
    granted[key] = { points: GROWTH.pointsPerLevel, skillPoints: GROWTH.skillPointsPerLevel ?? 1 };
  }
  return granted;
}

// 修炼点投法:投给某已习得法术,熟练 +1(上限 GROWTH.skillRankCap);不洗点
export function allocateSkillPoint(campaign, key, skillId) {
  const def = PARTY[key];
  campaign.skillPoints = campaign.skillPoints ?? {};
  const pending = campaign.skillPoints[key] ?? 0;
  if (!def || pending <= 0) return false;
  const learned = skillsAtLevel(def, campaign.levels?.[key] ?? 1);
  if (!learned.includes(skillId)) return false;
  campaign.skillLevels[key] = campaign.skillLevels[key] ?? {};
  const cur = campaign.skillLevels[key][skillId] ?? 1;
  if (cur >= GROWTH.skillRankCap) return false;
  campaign.skillLevels[key][skillId] = cur + 1;
  campaign.skillPoints[key] = pending - 1;
  return true;
}

// 推荐修炼选法:与推荐加点同一套确定性权重——该单位 攻/灵 权重决定偏物理还是偏法术,
// 候选按(方向相符 → 倍率 → 回复)排序、键名兜底,取未满级者之首。定值排序,不引入新随机。
export function recommendSkillPick(campaign, key) {
  const def = PARTY[key];
  if (!def) return null;
  const levels = campaign.skillLevels?.[key] ?? {};
  const learned = skillsAtLevel(def, campaign.levels?.[key] ?? 1)
    .filter((k) => (levels[k] ?? 1) < GROWTH.skillRankCap);
  if (learned.length === 0) return null;
  const w = def.recommendedAlloc ?? {};
  const preferKind = (w['灵'] ?? 0) > (w['攻'] ?? 0) ? 'mag' : 'phy';
  const score = (k) => {
    const s = SKILLS[k] ?? {};
    return (s.kind === preferKind ? 1000 : 0) + (s.mul ?? 0) * 100 + (s.heal ?? 0) * 50;
  };
  return [...learned].sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))[0];
}

// 一键推荐修炼:把某单位全部修炼点按上述权重逐点投完(受熟练上限保护)
export function applyRecommendSkills(campaign, key) {
  let used = 0;
  for (;;) {
    const pickKey = recommendSkillPick(campaign, key);
    if (!pickKey || !allocateSkillPoint(campaign, key, pickKey)) break;
    used += 1;
  }
  return used;
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
