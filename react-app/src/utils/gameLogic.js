// ---------- Helpers ----------
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const fmt = (n) => {
  if (!isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs < 1e6) return n.toFixed(2).replace(/\.?0+$/, '').replace(/,/g, ',');
  const units = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
  let u = 0;
  let v = n;
  while (Math.abs(v) >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return `${v.toFixed(2)}${units[u]}`;
};
export const now = () => Date.now();

// ---------- Balance ----------
export const SUBSTAGES_PER_STAGE = 10;
export const BOSS_EVERY_STAGE = 1; // boss at the end of every stage
export const BOSS_TIME_LIMIT_MS = 20000;

export function globalMult(shards) {
  // Permanent shard power: simple and satisfying
  return 1 + shards * 0.08; // 8% per shard
}

export function effectiveCritChance(state) {
  const fromUpgrade = (state.upgrades.critC - 1) * 0.02;
  const fromMilestone = state.milestones?.dragonsLuck ? 0.05 : 0;
  return state.critChance + fromUpgrade + fromMilestone;
}

export function effectiveCritMult(state) {
  return state.critMult + (state.upgrades.critM - 1) * 0.5;
}

export function tapDamage(tapLevel, tapBase, upgrades, shards, skillActiveUntil, milestones = {}) {
  const tapUpgrade = upgrades.tap;
  const skillMult = (now() < skillActiveUntil) ? 2.5 : 1.0;
  const sharpening = milestones.sharpening ? 1.25 : 1;
  return tapBase * Math.pow(1.15, tapLevel - 1) * tapUpgrade * globalMult(shards) * skillMult * sharpening;
}

export function heroDps(heroes, upgrades, shards, skillActiveUntil, milestones = {}) {
  const idleUpgrade = upgrades.idle;
  let dps = 0;
  for (const h of heroes) {
    if (h.level <= 0) continue;
    dps += h.baseDps * Math.pow(h.dpsMultPerLevel, h.level - 1);
  }
  const skillMult = (now() < skillActiveUntil) ? 2.0 : 1.0;
  const formation = milestones.formation ? 1.20 : 1;
  return dps * idleUpgrade * globalMult(shards) * skillMult * formation;
}

export function enemyMaxHp(stage, substage, isBoss) {
  const base = 7 * Math.pow(1.32, stage - 1) * Math.pow(1.07, substage - 1);
  // Graduated boss multiplier: tutorial-friendly early, full threat by stage 6+
  const bossMult = stage <= 2 ? 8 : stage <= 5 ? 12 : 14;
  return isBoss ? base * bossMult : base;
}

export function enemyReward(stage, substage, isBoss, upgrades, shardUpgrades = {}, milestones = {}) {
  const base = 3 * Math.pow(1.28, stage - 1) * Math.pow(1.05, substage - 1);
  const goldUpgrade = upgrades.gold;
  const fortuneBonus = 1 + (shardUpgrades.goldBonus ?? 0) * 0.25;
  const goldVein = milestones.goldVein ? 1.30 : 1;
  return Math.max(1, Math.floor(base * goldUpgrade * (isBoss ? 8 : 1) * fortuneBonus * goldVein));
}

export function prestigeEarned(stage, substage, shardUpgrades = {}) {
  // Reward based on stage reached (roughly)
  const reached = (stage - 1) * SUBSTAGES_PER_STAGE + (substage - 1);
  // Quadratic-ish curve that feels good
  return Math.max(0, Math.floor(Math.pow(reached / 40, 1.35))) + (shardUpgrades.prestigeBonus ?? 0);
}

export function enemyNameFor(stage, isBoss) {
  const names = ["Wisp","Crawler","Shade","Brute","Warden","Spectre","Golem","Harbinger","Titanling","Abyss Knight"];
  const n = names[(stage - 1) % names.length];
  return isBoss ? `Boss ${n}` : n;
}

export function upgradeCost(which, upgrades) {
  const level = upgrades[which];
  const base = { tap: 20, gold: 40, idle: 60, critC: 70, critM: 100 }[which];
  return Math.floor(base * Math.pow(1.55, level - 1));
}

export function heroCost(hero) {
  // Cost rises quickly; tuned for MVP feel
  const base = { squire: 50, archer: 400, mage: 2500, paladin: 15000, necromancer: 80000 }[hero.id] ?? 100;
  return Math.floor(base * Math.pow(1.45, hero.level));
}

export const SHARD_UPGRADES = [
  { key: 'goldBonus',     name: 'Fortune',         desc: '+25% gold income per level',        shardBase: 2, costMult: 3   },
  { key: 'bossTime',      name: 'Boss Extension',   desc: '+5s boss timer per level',          shardBase: 2, costMult: 3   },
  { key: 'prestigeBonus', name: 'Prestige Mastery', desc: '+1 bonus shard per ascension',      shardBase: 5, costMult: 4   },
  { key: 'headStart',     name: 'Head Start',       desc: 'Begin at stage 2+lv after ascend',  shardBase: 3, costMult: 3.5 },
];

export function shardUpgradeCost(key, level) {
  const def = SHARD_UPGRADES.find(u => u.key === key);
  return Math.ceil(def.shardBase * Math.pow(def.costMult, level));
}

export const MILESTONES = [
  { key: 'sharpening',  name: 'Sharpening Stone', unlockStage: 4,  goldCost: 500,   desc: '+25% tap damage (permanent)' },
  { key: 'formation',   name: 'Battle Formation',  unlockStage: 12, goldCost: 2500,  desc: '+20% hero DPS (permanent)'   },
  { key: 'dragonsLuck', name: "Dragon's Luck",     unlockStage: 22, goldCost: 8000,  desc: '+5% crit chance (permanent)' },
  { key: 'goldVein',    name: 'Gold Vein',          unlockStage: 35, goldCost: 25000, desc: '+30% gold income (permanent)' },
];