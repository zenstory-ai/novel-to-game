// 战斗之外的成长(纯函数,node 可测)：历练/等级上限、封妖奖励、商店、装备槽、银两研习。
// 随机只走种子流(createRNG)，全项目不用 Math.random。

import { ECONOMY, EQUIPS, ITEMS, PARTY, GROWTH } from './data.js';
import { levelUpParty } from './engine.js';
import { createRNG, chance } from './rng.js';

export const PARTY_KEYS = ['wukong', 'bajie', 'sha'];

export function expToNext(level) {
  return ECONOMY.expBase * level;
}

// 本章等级上限：剧情设计等级 +1。日常最多领先一级，剧情战的难度曲线不被刷穿。
export function levelCap(campaign) {
  return (campaign.storyLevel ?? 1) + 1;
}

// 参与升级的成员：三位师兄弟 + 上阵召唤兽
function growingMembers(campaign) {
  const keys = [...PARTY_KEYS];
  const pet = campaign.pets?.find((p) => p.active);
  if (pet) keys.push(pet.key);
  return keys;
}

// 获得历练。以悟空等级计条;满条则全员(低于上限者)升一级。返回升级明细与是否封顶。
export function grantExp(campaign, amount) {
  const ups = {};
  const cap = levelCap(campaign);
  campaign.exp = (campaign.exp ?? 0) + Math.max(0, Math.round(amount));
  for (;;) {
    const lv = campaign.levels.wukong ?? 1;
    const need = expToNext(lv);
    if (lv >= cap) {
      campaign.exp = Math.min(campaign.exp, need);
      return { ups, capped: true };
    }
    if (campaign.exp < need) return { ups, capped: false };
    campaign.exp -= need;
    const levels = {};
    for (const key of growingMembers(campaign)) {
      const cur = campaign.levels[key] ?? 1;
      if (cur < cap) levels[key] = cur;
    }
    const step = levelUpParty(levels);
    for (const [key, up] of Object.entries(step)) {
      campaign.levels[key] = up.level;
      ups[key] = up;
    }
  }
}

// 封妖奖励：历练按当前所需比例、银两随环数递增、掉落走种子流;第十环必得二阶装备。
export function bountyReward(campaign, ring, seed) {
  const rng = createRNG(seed >>> 0);
  const lv = campaign.levels.wukong ?? 1;
  const reward = {
    exp: Math.round(expToNext(lv) * ECONOMY.bountyExpPct),
    money: ECONOMY.bountyMoney[0] + ECONOMY.bountyMoney[1] * ring,
    items: {},
    equips: [],
  };
  for (const drop of ECONOMY.bountyDrops) {
    if (!chance(rng, drop.p)) continue;
    if (drop.item) reward.items[drop.item] = (reward.items[drop.item] ?? 0) + 1;
    else reward.equips.push(drop.equip);
  }
  if (ring >= ECONOMY.bountyRing && reward.equips.length === 0) {
    reward.equips.push(ring % 2 === 0 ? 'xipijia' : 'bintie');
  }
  return reward;
}

export function applyLoot(campaign, { money = 0, items = {}, equips = [] }) {
  campaign.money = (campaign.money ?? 0) + money;
  for (const [k, n] of Object.entries(items)) campaign.items[k] = (campaign.items[k] ?? 0) + n;
  campaign.equipBag = campaign.equipBag ?? {};
  for (const k of equips) campaign.equipBag[k] = (campaign.equipBag[k] ?? 0) + 1;
}

// 商店购买：银两不足返回 false
export function buy(campaign, good) {
  if ((campaign.money ?? 0) < good.price) return false;
  campaign.money -= good.price;
  applyLoot(campaign, good.item ? { items: { [good.item]: 1 } } : { equips: [good.equip] });
  return true;
}

export function goodName(good) {
  return good.item ? ITEMS[good.item].name : EQUIPS[good.equip].name;
}

// 装备槽：把背包中一件装备穿到某人对应槽位，原装备退回背包
export function equipItem(campaign, unitKey, equipKey) {
  const eq = EQUIPS[equipKey];
  campaign.equipBag = campaign.equipBag ?? {};
  if (!eq || !(campaign.equipBag[equipKey] > 0)) return false;
  campaign.gear = campaign.gear ?? {};
  const slots = (campaign.gear[unitKey] = campaign.gear[unitKey] ?? {});
  const old = slots[eq.slot];
  campaign.equipBag[equipKey] -= 1;
  if (old) campaign.equipBag[old] = (campaign.equipBag[old] ?? 0) + 1;
  slots[eq.slot] = equipKey;
  return true;
}

export function gearOf(campaign, unitKey) {
  const slots = campaign.gear?.[unitKey] ?? {};
  return [slots.weapon, slots.armor].filter(Boolean);
}

// 银两研习：把一门已习得法术提升一重(与修炼点同上限)
export function studyCost(rank) {
  return ECONOMY.studyCost[rank + 1] ?? null;
}

export function studySkill(campaign, unitKey, skillId) {
  if (!PARTY[unitKey]) return false;
  campaign.skillLevels[unitKey] = campaign.skillLevels[unitKey] ?? {};
  const cur = campaign.skillLevels[unitKey][skillId] ?? 1;
  const cost = studyCost(cur);
  if (cur >= GROWTH.skillRankCap || cost == null || (campaign.money ?? 0) < cost) return false;
  campaign.money -= cost;
  campaign.skillLevels[unitKey][skillId] = cur + 1;
  return true;
}

// 召唤兽资质/成长：由单位成长表派生的展示值(梦幻式面板，不另存随机资质)
// 「体力资质」是这类游戏五项资质的通行叫法，有意保留;面板上的属性本身仍叫气血。
export function petAptitude(def) {
  return {
    攻击资质: Math.round(def.base.atk * 16),
    防御资质: Math.round(def.base.def * 24),
    体力资质: Math.round(def.base.hp * 7),
    法力资质: Math.round(def.base.mag * 30),
    速度资质: Math.round(def.base.spd * 18),
    成长: Math.round(((def.growth.hp / 60 + def.growth.atk / 9 + def.growth.mag / 8) / 3) * 1000) / 1000,
  };
}
