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

export function tapDamage(tapLevel, tapBase, upgrades, shards, skillActiveUntil) {
  const tapUpgrade = upgrades.tap;
  const skillMult = (now() < skillActiveUntil) ? 2.5 : 1.0;
  return tapBase * Math.pow(1.15, tapLevel - 1) * tapUpgrade * globalMult(shards) * skillMult;
}

export function heroDps(heroes, upgrades, shards, skillActiveUntil) {
  const idleUpgrade = upgrades.idle;
  let dps = 0;
  for (const h of heroes) {
    if (h.level <= 0) continue;
    dps += h.baseDps * Math.pow(h.dpsMultPerLevel, h.level - 1);
  }
  const skillMult = (now() < skillActiveUntil) ? 2.0 : 1.0;
  return dps * idleUpgrade * globalMult(shards) * skillMult;
}

export function enemyMaxHp(stage, substage, isBoss) {
  // Smooth exponential-ish curve
  const base = 10 * Math.pow(1.35, stage - 1) * Math.pow(1.07, substage - 1);
  return isBoss ? base * 14 : base;
}

export function enemyReward(stage, substage, isBoss, upgrades) {
  const base = 2 * Math.pow(1.28, stage - 1) * Math.pow(1.04, substage - 1);
  const goldUpgrade = upgrades.gold;
  return Math.max(1, Math.floor(base * goldUpgrade * (isBoss ? 8 : 1)));
}

export function prestigeEarned(stage, substage) {
  // Reward based on stage reached (roughly)
  const reached = (stage - 1) * SUBSTAGES_PER_STAGE + (substage - 1);
  // Quadratic-ish curve that feels good
  return Math.max(0, Math.floor(Math.pow(reached / 40, 1.35)));
}

export function enemyNameFor(stage, isBoss) {
  const names = ["Wisp","Crawler","Shade","Brute","Warden","Spectre","Golem","Harbinger","Titanling","Abyss Knight"];
  const n = names[(stage - 1) % names.length];
  return isBoss ? `Boss ${n}` : n;
}

export function upgradeCost(which, upgrades) {
  const level = upgrades[which];
  const base = { tap: 30, gold: 60, idle: 90 }[which];
  return Math.floor(base * Math.pow(1.55, level - 1));
}

export function heroCost(hero) {
  // Cost rises quickly; tuned for MVP feel
  const base = { squire: 50, archer: 400, mage: 2500 }[hero.id] ?? 100;
  return Math.floor(base * Math.pow(1.45, hero.level));
}