// ---------- Helpers ----------
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Letter notation: K, M, B, T, then aa, ab, ac... az, ba, bb...
const letterUnit = (tier) => {
  if (tier <= 0) return "";
  if (tier === 1) return "K";
  if (tier === 2) return "M";
  if (tier === 3) return "B";
  if (tier === 4) return "T";
  const idx = tier - 5; // 0 = aa, 1 = ab, ...
  const first = String.fromCharCode(97 + Math.floor(idx / 26));
  const second = String.fromCharCode(97 + (idx % 26));
  return first + second;
};
export const fmt = (n) => {
  if (!isFinite(n)) return "∞";
  if (Math.abs(n) < 1e3) return n.toFixed(2).replace(/\.?0+$/, '');
  let v = n;
  let tier = 0;
  while (Math.abs(v) >= 1000) { v /= 1000; tier++; }
  return `${v.toFixed(2)}${letterUnit(tier)}`;
};
export const now = () => Date.now();

// ---------- Balance ----------
export const SUBSTAGES_PER_STAGE = 10;
export const BOSS_EVERY_STAGE = 1; // boss at the end of every stage
export const BOSS_TIME_LIMIT_MS = 20000;
export const TAP_TRAINING_BONUS_PER_SESSION = 0.5;

export function globalMult(shards) {
  // Permanent shard power: simple and satisfying
  return 1 + shards * 0.08; // 8% per shard
}

export function effectiveCritChance(state) {
  const fromUpgrade = (state.upgrades.critC - 1) * 0.02;
  const fromMilestone = state.milestones?.dragonsLuck ? 0.05 : 0;
  const fromShard = (state.shardUpgrades?.luckyStrike ?? 0) * 0.03;
  const fromBloodFrenzy = (now() < (state.bloodFrenzyActiveUntil ?? 0)) ? 0.30 : 0;
  if (now() < (state.luckyStrikeActiveUntil ?? 0)) return 1.0;
  return state.critChance + fromUpgrade + fromMilestone + fromShard + fromBloodFrenzy;
}

export function effectiveCritMult(state) {
  const fromShard = (state.shardUpgrades?.killingBlow ?? 0) * 1.0;
  const bloodFrenzyMult = (now() < (state.bloodFrenzyActiveUntil ?? 0)) ? 2.0 : 1.0;
  return (state.critMult + (state.upgrades.critM - 1) * 0.5 + fromShard) * bloodFrenzyMult;
}

export function tapDamage(tapLevel, tapBase, upgrades, shards, skillActiveUntil, milestones = {}, shardUpgrades = {}) {
  const effectiveTapBase = tapBase + (upgrades.tap ?? 0) * TAP_TRAINING_BONUS_PER_SESSION;
  const skillMult = (now() < skillActiveUntil) ? 2.5 : 1.0;
  const sharpening = milestones.sharpening ? 1.25 : 1;
  const tapSynergy = 1 + (shardUpgrades.tapSynergy ?? 0) * 0.15;
  const tapMastery = 1 + (shardUpgrades.tapMastery ?? 0) * 0.20;
  return effectiveTapBase * Math.pow(1.15, tapLevel - 1) * globalMult(shards) * skillMult * sharpening * tapSynergy * tapMastery;
}

export function heroDps(heroes, upgrades, shards, skillActiveUntil, milestones = {}, shardUpgrades = {}, skillTimers = {}) {
  const idleUpgrade = upgrades.idle;
  let dps = 0;
  for (const h of heroes) {
    if (h.level <= 0) continue;
    dps += h.baseDps * Math.pow(h.dpsMultPerLevel, h.level - 1);
  }
  const t = now();
  const skillMult = (t < skillActiveUntil) ? 2.0 : 1.0;
  const rallyCryMult = (t < (skillTimers.rallyCryActiveUntil ?? 0)) ? 3.0 : 1.0;
  const timeWarpMult = (t < (skillTimers.timeWarpActiveUntil ?? 0)) ? 3.0 : 1.0;
  const formation = milestones.formation ? 1.20 : 1;
  const heroMastery = 1 + (shardUpgrades.heroMastery ?? 0) * 0.12;
  return dps * idleUpgrade * globalMult(shards) * skillMult * rallyCryMult * timeWarpMult * formation * heroMastery;
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
  const bossBane = isBoss ? (1 + (shardUpgrades.bossBane ?? 0) * 0.20) : 1;
  return Math.max(1, Math.floor(base * goldUpgrade * (isBoss ? 8 : 1) * fortuneBonus * goldVein * bossBane));
}

export function prestigeEarned(stage, substage, shardUpgrades = {}) {
  // Reward based on stage reached (roughly)
  const reached = (stage - 1) * SUBSTAGES_PER_STAGE + (substage - 1);
  // Quadratic-ish curve that feels good
  const soulBonus = Math.floor((shardUpgrades.soulCollector ?? 0) * 0.5);
  return Math.max(0, Math.floor(Math.pow(reached / 40, 1.35))) + (shardUpgrades.prestigeBonus ?? 0) + soulBonus;
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

export function tapTrainingCost(level) {
  // Integer session level (0, 1, 2...). Scales at same rate as old system (1.55^0.25 ≈ +12% per purchase).
  return Math.floor(20 * Math.pow(1.55, level * 0.25));
}

export function heroCost(hero) {
  // Cost rises quickly; tuned for MVP feel
  const base = {
    squire: 50, archer: 400, mage: 2500, paladin: 15000, necromancer: 80000,
    druid: 350000, samurai: 1500000, warlock: 6000000, valkyrie: 25000000,
    dragonKnight: 100000000, shadowMonk: 400000000, archmage: 1500000000,
    titan: 6000000000, celestial: 25000000000, voidLord: 100000000000,
  }[hero.id] ?? 100;
  return Math.floor(base * Math.pow(1.45, hero.level));
}

export const SHARD_UPGRADES = [
  { key: 'goldBonus',     name: 'Fortune',          desc: '+25% gold income per level',             shardBase: 2, costMult: 3   },
  { key: 'bossTime',      name: 'Boss Extension',    desc: '+5s boss timer per level',               shardBase: 2, costMult: 3   },
  { key: 'prestigeBonus', name: 'Prestige Mastery',  desc: '+1 bonus shard per ascension',           shardBase: 5, costMult: 4   },
  { key: 'headStart',     name: 'Head Start',        desc: 'Begin at stage 2+lv after ascend',       shardBase: 3, costMult: 3.5 },
  { key: 'tapSynergy',    name: 'Tap Synergy',       desc: '+15% tap damage per level',              shardBase: 3, costMult: 3   },
  { key: 'heroMastery',   name: 'Hero Mastery',      desc: '+12% hero DPS per level',                shardBase: 3, costMult: 3   },
  { key: 'luckyStrike',   name: 'Lucky Strike',      desc: '+3% crit chance per level',              shardBase: 4, costMult: 3.5 },
  { key: 'killingBlow',   name: 'Killing Blow',      desc: '+1× crit multiplier per level',          shardBase: 4, costMult: 3.5 },
  { key: 'bossBane',      name: 'Boss Bane',         desc: '+20% boss gold reward per level',        shardBase: 4, costMult: 3.5 },
  { key: 'soulCollector', name: 'Soul Collector',    desc: '+0.5 bonus shards per ascension/level',  shardBase: 6, costMult: 4   },
  { key: 'tapMastery',          name: 'Focused Strike',    desc: '+20% tap damage per level',              shardBase: 4, costMult: 3.5 },
  { key: 'powerSurgeDuration', name: 'Surge Duration',    desc: '+1s to Power Surge per level (max 30s)', shardBase: 2, costMult: 2,   isDurationUpgrade: true },
  { key: 'goldRushDuration',   name: 'Rush Duration',     desc: '+1s to Gold Rush per level (max 30s)',   shardBase: 2, costMult: 2,   isDurationUpgrade: true },
  { key: 'bloodFrenzyDuration',name: 'Frenzy Duration',   desc: '+1s to Blood Frenzy per level (max 30s)',shardBase: 2, costMult: 2,   isDurationUpgrade: true },
  { key: 'rallyCryDuration',   name: 'Rally Duration',    desc: '+1s to Rally Cry per level (max 30s)',   shardBase: 2, costMult: 2,   isDurationUpgrade: true },
  { key: 'luckyStrikeDuration',name: 'Strike Duration',   desc: '+1s to Lucky Strike per level (max 30s)',shardBase: 2, costMult: 2,   isDurationUpgrade: true },
  { key: 'timeWarpDuration',   name: 'Warp Duration',     desc: '+1s to Time Warp per level (max 30s)',   shardBase: 2, costMult: 2,   isDurationUpgrade: true },
];

export function shardUpgradeCost(key, level) {
  const def = SHARD_UPGRADES.find(u => u.key === key);
  return Math.ceil(def.shardBase * Math.pow(def.costMult, level));
}

export function shardUpgradeUnlockCost(unlockedCount) {
  return Math.ceil(2 * Math.pow(2, unlockedCount));
}

// ---------- Skills ----------
export const SKILLS = [
  {
    key: 'powerSurge',
    name: 'Power Surge',
    desc: '2.5× tap damage and 2× hero DPS',
    activeUntilKey: 'skillActiveUntil',
    cooldownUntilKey: 'skillCooldownUntil',
    baseDuration: 10,   // seconds
    cooldown: 30000,    // ms
    durationUpgradeKey: 'powerSurgeDuration',
  },
  {
    key: 'goldRush',
    name: 'Gold Rush',
    desc: '3× gold earned from all enemies',
    activeUntilKey: 'goldRushActiveUntil',
    cooldownUntilKey: 'goldRushCooldownUntil',
    baseDuration: 10,
    cooldown: 45000,
    durationUpgradeKey: 'goldRushDuration',
  },
  {
    key: 'bloodFrenzy',
    name: 'Blood Frenzy',
    desc: '+30% crit chance and 2× crit multiplier',
    activeUntilKey: 'bloodFrenzyActiveUntil',
    cooldownUntilKey: 'bloodFrenzyCooldownUntil',
    baseDuration: 8,
    cooldown: 40000,
    durationUpgradeKey: 'bloodFrenzyDuration',
  },
  {
    key: 'rallyCry',
    name: 'Rally Cry',
    desc: '3× hero DPS',
    activeUntilKey: 'rallyCryActiveUntil',
    cooldownUntilKey: 'rallyCryCooldownUntil',
    baseDuration: 10,
    cooldown: 45000,
    durationUpgradeKey: 'rallyCryDuration',
  },
  {
    key: 'luckyStrike',
    name: 'Lucky Strike',
    desc: '100% crit chance',
    activeUntilKey: 'luckyStrikeActiveUntil',
    cooldownUntilKey: 'luckyStrikeCooldownUntil',
    baseDuration: 8,
    cooldown: 50000,
    durationUpgradeKey: 'luckyStrikeDuration',
  },
  {
    key: 'timeWarp',
    name: 'Time Warp',
    desc: '3× hero attack speed',
    activeUntilKey: 'timeWarpActiveUntil',
    cooldownUntilKey: 'timeWarpCooldownUntil',
    baseDuration: 10,
    cooldown: 60000,
    durationUpgradeKey: 'timeWarpDuration',
  },
];

export function effectiveSkillDuration(skill, shardUpgrades) {
  const bonus = shardUpgrades?.[skill.durationUpgradeKey] ?? 0;
  return Math.min(30, skill.baseDuration + bonus) * 1000; // ms, capped at 30s
}

export const MILESTONES = [
  { key: 'sharpening',  name: 'Sharpening Stone', unlockStage: 4,  goldCost: 500,   desc: '+25% tap damage (permanent)' },
  { key: 'formation',   name: 'Battle Formation',  unlockStage: 12, goldCost: 2500,  desc: '+20% hero DPS (permanent)'   },
  { key: 'dragonsLuck', name: "Dragon's Luck",     unlockStage: 22, goldCost: 8000,  desc: '+5% crit chance (permanent)' },
  { key: 'goldVein',    name: 'Gold Vein',          unlockStage: 35, goldCost: 25000, desc: '+30% gold income (permanent)' },
];