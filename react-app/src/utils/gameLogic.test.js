import { describe, it, expect } from 'vitest';
import {
  clamp01,
  fmt,
  globalMult,
  tapDamage,
  heroDps,
  enemyMaxHp,
  enemyReward,
  prestigeEarned,
  upgradeCost,
  heroCost,
  shardUpgradeCost,
  shardUpgradeUnlockCost,
  effectiveCritChance,
  effectiveCritMult,
  effectiveSkillDuration,
  SKILLS,
} from './gameLogic.js';

// ---------- clamp01 ----------

describe('clamp01', () => {
  it('clamps values below 0 to 0', () => expect(clamp01(-5)).toBe(0));
  it('clamps values above 1 to 1', () => expect(clamp01(1.5)).toBe(1));
  it('leaves values inside range unchanged', () => expect(clamp01(0.5)).toBe(0.5));
  it('allows boundary value 0', () => expect(clamp01(0)).toBe(0));
  it('allows boundary value 1', () => expect(clamp01(1)).toBe(1));
});

// ---------- fmt ----------

describe('fmt', () => {
  it('formats 0 as "0"', () => expect(fmt(0)).toBe('0'));
  it('formats a plain integer', () => expect(fmt(42)).toBe('42'));
  it('strips trailing decimal zeros', () => expect(fmt(1.5)).toBe('1.5'));
  it('formats 999 without suffix', () => expect(fmt(999)).toBe('999'));
  // Values 1,000–999,999 are formatted as plain numbers (no K suffix);
  // the K entry in the suffix array is only reached by values >= 1e6.
  it('formats 1000 as a plain number (no K suffix)', () => expect(fmt(1000)).toBe('1000'));
  it('formats 999999 as a plain number', () => expect(fmt(999999)).toBe('999999'));
  it('formats 1,000,000 as "1.00M"', () => expect(fmt(1e6)).toBe('1.00M'));
  it('formats 1,500,000 as "1.50M"', () => expect(fmt(1.5e6)).toBe('1.50M'));
  it('formats 1,000,000,000 as "1.00B"', () => expect(fmt(1e9)).toBe('1.00B'));
  it('formats 1,000,000,000,000 as "1.00T"', () => expect(fmt(1e12)).toBe('1.00T'));
  it('returns "∞" for Infinity', () => expect(fmt(Infinity)).toBe('∞'));
  it('returns "∞" for -Infinity', () => expect(fmt(-Infinity)).toBe('∞'));
  it('returns "∞" for NaN (not finite)', () => expect(fmt(NaN)).toBe('∞'));
});

// ---------- globalMult ----------

describe('globalMult', () => {
  it('returns 1 with 0 shards (no bonus)', () => expect(globalMult(0)).toBe(1));
  it('returns 1.08 with 1 shard', () => expect(globalMult(1)).toBeCloseTo(1.08));
  it('returns 1.80 with 10 shards', () => expect(globalMult(10)).toBeCloseTo(1.8));
  it('returns 9.0 with 100 shards', () => expect(globalMult(100)).toBeCloseTo(9.0));
});

// ---------- tapDamage ----------

describe('tapDamage', () => {
  const BASE_UPGRADES = { tap: 0, gold: 1, idle: 1, critC: 1, critM: 1 };
  const INACTIVE_SKILL = 0; // epoch 0 is always in the past

  it('returns tapBase at level 1 with no bonuses', () => {
    // 2 * 1.15^0 * globalMult(0)=1 * skillMult=1 * sharpening=1 * synergy=1 * mastery=1 = 2
    expect(tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {})).toBeCloseTo(2);
  });

  it('scales by 1.15 per tap level', () => {
    const dmg1 = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const dmg2 = tapDamage(2, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    expect(dmg2 / dmg1).toBeCloseTo(1.15);
  });

  it('applies 2.5× multiplier when Power Surge is active', () => {
    const future = Date.now() + 10_000;
    const withoutSkill = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const withSkill    = tapDamage(1, 2, BASE_UPGRADES, 0, future, {}, {});
    expect(withSkill / withoutSkill).toBeCloseTo(2.5);
  });

  it('applies 1.25× from the Sharpening Stone milestone', () => {
    const without = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const with_   = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, { sharpening: true }, {});
    expect(with_ / without).toBeCloseTo(1.25);
  });

  it('applies +15% per tapSynergy shard level', () => {
    const without = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const with_   = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, { tapSynergy: 2 });
    // 1 + 2 × 0.15 = 1.30
    expect(with_ / without).toBeCloseTo(1.30);
  });

  it('applies +20% per tapMastery shard level', () => {
    const without = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const with_   = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, { tapMastery: 3 });
    // 1 + 3 × 0.20 = 1.60
    expect(with_ / without).toBeCloseTo(1.60);
  });

  it('adds +0.5 base damage per tap training session', () => {
    // effectiveTapBase = 2 + 4 × 0.5 = 4; everything else ×1 → 4
    const dmg = tapDamage(1, 2, { ...BASE_UPGRADES, tap: 4 }, 0, INACTIVE_SKILL, {}, {});
    expect(dmg).toBeCloseTo(4);
  });

  it('applies the global shard multiplier', () => {
    const dmg0  = tapDamage(1, 2, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const dmg10 = tapDamage(1, 2, BASE_UPGRADES, 10, INACTIVE_SKILL, {}, {});
    // globalMult(10) = 1.80
    expect(dmg10 / dmg0).toBeCloseTo(1.80);
  });
});

// ---------- heroDps ----------

describe('heroDps', () => {
  const BASE_UPGRADES = { idle: 1, gold: 1, tap: 0, critC: 1, critM: 1 };
  const INACTIVE_SKILL = 0;
  const heroAt = (level) => [{ id: 'squire', level, baseDps: 2, dpsMultPerLevel: 1.12, unlockStage: 1 }];

  it('returns 0 when all heroes are at level 0', () => {
    expect(heroDps(heroAt(0), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {})).toBe(0);
  });

  it('returns baseDps for a level-1 hero (no scaling yet)', () => {
    // 2 × 1.12^0 = 2; idleUpgrade=1, globalMult(0)=1, all others ×1 → 2
    expect(heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {})).toBeCloseTo(2);
  });

  it('scales DPS by dpsMultPerLevel at level 2', () => {
    const lv1 = heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const lv2 = heroDps(heroAt(2), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    expect(lv2 / lv1).toBeCloseTo(1.12);
  });

  it('applies 2.0× multiplier when Power Surge is active', () => {
    const future = Date.now() + 10_000;
    const without = heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const with_   = heroDps(heroAt(1), BASE_UPGRADES, 0, future, {}, {});
    expect(with_ / without).toBeCloseTo(2.0);
  });

  it('applies 1.20× from the Battle Formation milestone', () => {
    const without = heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const with_   = heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, { formation: true }, {});
    expect(with_ / without).toBeCloseTo(1.20);
  });

  it('applies +12% per heroMastery shard level', () => {
    const without = heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {});
    const with_   = heroDps(heroAt(1), BASE_UPGRADES, 0, INACTIVE_SKILL, {}, { heroMastery: 2 });
    // 1 + 2 × 0.12 = 1.24
    expect(with_ / without).toBeCloseTo(1.24);
  });

  it('sums DPS contributions from all leveled heroes', () => {
    const heroes = [
      { id: 'squire', level: 1, baseDps: 2,  dpsMultPerLevel: 1.12, unlockStage: 1 },
      { id: 'archer', level: 1, baseDps: 6,  dpsMultPerLevel: 1.13, unlockStage: 8 },
      { id: 'mage',   level: 0, baseDps: 30, dpsMultPerLevel: 1.14, unlockStage: 18 },
    ];
    // Mage level 0 → skipped; squire(2) + archer(6) = 8
    expect(heroDps(heroes, BASE_UPGRADES, 0, INACTIVE_SKILL, {}, {})).toBeCloseTo(8);
  });

  it('applies the global shard multiplier', () => {
    const dps0  = heroDps(heroAt(1), BASE_UPGRADES, 0,  INACTIVE_SKILL, {}, {});
    const dps10 = heroDps(heroAt(1), BASE_UPGRADES, 10, INACTIVE_SKILL, {}, {});
    expect(dps10 / dps0).toBeCloseTo(1.80); // globalMult(10)
  });
});

// ---------- enemyMaxHp ----------

describe('enemyMaxHp', () => {
  it('returns 7 at stage 1, substage 1 (base case)', () => {
    expect(enemyMaxHp(1, 1, false)).toBeCloseTo(7);
  });

  it('scales by 1.32 per stage', () => {
    const hp1 = enemyMaxHp(1, 1, false);
    const hp2 = enemyMaxHp(2, 1, false);
    expect(hp2 / hp1).toBeCloseTo(1.32);
  });

  it('scales by 1.07 per substage', () => {
    const hpS1 = enemyMaxHp(1, 1, false);
    const hpS2 = enemyMaxHp(1, 2, false);
    expect(hpS2 / hpS1).toBeCloseTo(1.07);
  });

  it('boss at stage 1 has 8× HP (tutorial-friendly multiplier)', () => {
    const normal = enemyMaxHp(1, 1, false);
    const boss   = enemyMaxHp(1, 1, true);
    expect(boss / normal).toBeCloseTo(8);
  });

  it('boss at stage 3 has 12× HP (mid-range multiplier)', () => {
    const normal = enemyMaxHp(3, 1, false);
    const boss   = enemyMaxHp(3, 1, true);
    expect(boss / normal).toBeCloseTo(12);
  });

  it('boss at stage 6+ has 14× HP (full threat)', () => {
    const normal = enemyMaxHp(6, 1, false);
    const boss   = enemyMaxHp(6, 1, true);
    expect(boss / normal).toBeCloseTo(14);
  });
});

// ---------- enemyReward ----------

describe('enemyReward', () => {
  const BASE_UPGRADES = { gold: 1 };

  it('returns 3 gold at stage 1, substage 1 with no bonuses', () => {
    expect(enemyReward(1, 1, false, BASE_UPGRADES, {}, {})).toBe(3);
  });

  it('boss reward is 8× the normal reward', () => {
    const normal = enemyReward(1, 1, false, BASE_UPGRADES, {}, {});
    const boss   = enemyReward(1, 1, true,  BASE_UPGRADES, {}, {});
    expect(boss).toBe(normal * 8);
  });

  it('scales by 1.28 per stage', () => {
    // Use a high stage so Math.floor doesn't compress the ratio into noise
    const r1 = enemyReward(20, 1, false, BASE_UPGRADES, {}, {});
    const r2 = enemyReward(21, 1, false, BASE_UPGRADES, {}, {});
    expect(r2 / r1).toBeCloseTo(1.28);
  });

  it('scales by 1.05 per substage', () => {
    const r1 = enemyReward(20, 1, false, BASE_UPGRADES, {}, {});
    const r2 = enemyReward(20, 2, false, BASE_UPGRADES, {}, {});
    expect(r2 / r1).toBeCloseTo(1.05);
  });

  it('applies +25% per Fortune (goldBonus) shard level', () => {
    const without = enemyReward(20, 1, false, BASE_UPGRADES, {}, {});
    const with_   = enemyReward(20, 1, false, BASE_UPGRADES, { goldBonus: 2 }, {});
    // 1 + 2 × 0.25 = 1.50
    expect(with_ / without).toBeCloseTo(1.50);
  });

  it('applies 1.30× from the Gold Vein milestone', () => {
    const without = enemyReward(20, 1, false, BASE_UPGRADES, {}, {});
    const with_   = enemyReward(20, 1, false, BASE_UPGRADES, {}, { goldVein: true });
    expect(with_ / without).toBeCloseTo(1.30);
  });

  it('applies Boss Bane bonus to boss rewards', () => {
    const boss         = enemyReward(20, 1, true, BASE_UPGRADES, {}, {});
    const bossWithBane = enemyReward(20, 1, true, BASE_UPGRADES, { bossBane: 2 }, {});
    // 1 + 2 × 0.20 = 1.40
    expect(bossWithBane / boss).toBeCloseTo(1.40);
  });

  it('Boss Bane does NOT affect normal enemy rewards', () => {
    const without = enemyReward(1, 1, false, BASE_UPGRADES, {}, {});
    const with_   = enemyReward(1, 1, false, BASE_UPGRADES, { bossBane: 2 }, {});
    expect(with_).toBe(without);
  });

  it('always returns at least 1 gold', () => {
    expect(enemyReward(1, 1, false, { gold: 0.001 }, {}, {})).toBeGreaterThanOrEqual(1);
  });
});

// ---------- prestigeEarned ----------

describe('prestigeEarned', () => {
  it('returns 0 at stage 1, substage 1 (no progress)', () => {
    expect(prestigeEarned(1, 1, {})).toBe(0);
  });

  it('returns 0 in the very early game (not enough progress)', () => {
    // reached = 30 → (30/40)^1.35 < 1 → floor = 0
    expect(prestigeEarned(4, 1, {})).toBe(0);
  });

  it('returns positive shards at high stage', () => {
    expect(prestigeEarned(40, 1, {})).toBeGreaterThan(0);
  });

  it('adds flat shards from Prestige Mastery (prestigeBonus)', () => {
    const base = prestigeEarned(40, 1, {});
    expect(prestigeEarned(40, 1, { prestigeBonus: 3 })).toBe(base + 3);
  });

  it('adds floor(soulCollector × 0.5) bonus shards', () => {
    // soulCollector=4 → floor(4 × 0.5) = 2
    const base = prestigeEarned(40, 1, {});
    expect(prestigeEarned(40, 1, { soulCollector: 4 })).toBe(base + 2);
  });

  it('never returns a negative value', () => {
    expect(prestigeEarned(1, 1, {})).toBeGreaterThanOrEqual(0);
  });
});

// ---------- upgradeCost ----------

describe('upgradeCost', () => {
  it('returns the base cost at level 1 (no scaling applied)', () => {
    expect(upgradeCost('gold',  { gold:  1 })).toBe(40);
    expect(upgradeCost('idle',  { idle:  1 })).toBe(60);
    expect(upgradeCost('critC', { critC: 1 })).toBe(70);
    expect(upgradeCost('critM', { critM: 1 })).toBe(100);
  });

  it('scales by 1.55 per level', () => {
    const l1 = upgradeCost('gold', { gold: 1 });
    const l2 = upgradeCost('gold', { gold: 2 });
    expect(l2 / l1).toBeCloseTo(1.55);
  });
});

// ---------- heroCost ----------

describe('heroCost', () => {
  it('squire at level 0 costs 50 gold', () => {
    // 50 × 1.45^0 = 50
    expect(heroCost({ id: 'squire', level: 0 })).toBe(50);
  });

  it('squire at level 1 costs floor(50 × 1.45) = 72 gold', () => {
    expect(heroCost({ id: 'squire', level: 1 })).toBe(72);
  });

  it('archer at level 0 costs 400 gold', () => {
    expect(heroCost({ id: 'archer', level: 0 })).toBe(400);
  });

  it('cost grows by ~1.45× each level', () => {
    const l0 = heroCost({ id: 'squire', level: 0 });
    const l1 = heroCost({ id: 'squire', level: 1 });
    expect(l1 / l0).toBeCloseTo(1.45, 1);
  });
});

// ---------- shardUpgradeCost ----------

describe('shardUpgradeCost', () => {
  it('goldBonus at level 0 costs 2 shards (shardBase)', () => {
    // ceil(2 × 3^0) = 2
    expect(shardUpgradeCost('goldBonus', 0)).toBe(2);
  });

  it('goldBonus at level 1 costs 6 shards', () => {
    // ceil(2 × 3^1) = 6
    expect(shardUpgradeCost('goldBonus', 1)).toBe(6);
  });

  it('goldBonus at level 2 costs 18 shards', () => {
    // ceil(2 × 3^2) = 18
    expect(shardUpgradeCost('goldBonus', 2)).toBe(18);
  });

  it('prestigeBonus has higher base and multiplier', () => {
    // shardBase=5, costMult=4
    expect(shardUpgradeCost('prestigeBonus', 0)).toBe(5);   // ceil(5 × 4^0) = 5
    expect(shardUpgradeCost('prestigeBonus', 1)).toBe(20);  // ceil(5 × 4^1) = 20
  });
});

// ---------- shardUpgradeUnlockCost ----------

describe('shardUpgradeUnlockCost', () => {
  it('first unlock costs 2 shards', () => expect(shardUpgradeUnlockCost(0)).toBe(2));
  it('second unlock costs 4 shards', () => expect(shardUpgradeUnlockCost(1)).toBe(4));
  it('third unlock costs 8 shards', () => expect(shardUpgradeUnlockCost(2)).toBe(8));
  it('fourth unlock costs 16 shards', () => expect(shardUpgradeUnlockCost(3)).toBe(16));
});

// ---------- effectiveCritChance ----------

describe('effectiveCritChance', () => {
  const baseState = {
    critChance: 0.10,
    upgrades: { critC: 1 },
    milestones: {},
    shardUpgrades: {},
    bloodFrenzyActiveUntil: 0,
  };

  it('returns base 10% with no bonuses', () => {
    expect(effectiveCritChance(baseState)).toBeCloseTo(0.10);
  });

  it('adds 2% per critC upgrade level above 1', () => {
    // (3-1) × 0.02 = 0.04 → total 0.14
    const state = { ...baseState, upgrades: { critC: 3 } };
    expect(effectiveCritChance(state)).toBeCloseTo(0.14);
  });

  it("adds 5% from Dragon's Luck milestone", () => {
    const state = { ...baseState, milestones: { dragonsLuck: true } };
    expect(effectiveCritChance(state)).toBeCloseTo(0.15);
  });

  it('adds 3% per Lucky Strike shard level', () => {
    // 2 × 0.03 = 0.06 → total 0.16
    const state = { ...baseState, shardUpgrades: { luckyStrike: 2 } };
    expect(effectiveCritChance(state)).toBeCloseTo(0.16);
  });

  it('adds 30% when Blood Frenzy is active', () => {
    const state = { ...baseState, bloodFrenzyActiveUntil: Date.now() + 10_000 };
    expect(effectiveCritChance(state)).toBeCloseTo(0.40);
  });

  it('stacks all bonuses correctly', () => {
    // base(0.10) + upgrade(0.04) + milestone(0.05) + shard(0.06) = 0.25
    const state = {
      critChance: 0.10,
      upgrades: { critC: 3 },
      milestones: { dragonsLuck: true },
      shardUpgrades: { luckyStrike: 2 },
      bloodFrenzyActiveUntil: 0,
    };
    expect(effectiveCritChance(state)).toBeCloseTo(0.25);
  });
});

// ---------- effectiveCritMult ----------

describe('effectiveCritMult', () => {
  const baseState = {
    critMult: 5,
    upgrades: { critM: 1 },
    shardUpgrades: {},
    bloodFrenzyActiveUntil: 0,
  };

  it('returns base 5× with no bonuses', () => {
    expect(effectiveCritMult(baseState)).toBeCloseTo(5);
  });

  it('adds 0.5× per critM upgrade level above 1', () => {
    // (3-1) × 0.5 = 1 → total 6
    const state = { ...baseState, upgrades: { critM: 3 } };
    expect(effectiveCritMult(state)).toBeCloseTo(6);
  });

  it('adds 1× per Killing Blow shard level', () => {
    // 2 × 1 = 2 → total 7
    const state = { ...baseState, shardUpgrades: { killingBlow: 2 } };
    expect(effectiveCritMult(state)).toBeCloseTo(7);
  });

  it('doubles the total multiplier when Blood Frenzy is active', () => {
    // (5 + 0 + 0) × 2 = 10
    const state = { ...baseState, bloodFrenzyActiveUntil: Date.now() + 10_000 };
    expect(effectiveCritMult(state)).toBeCloseTo(10);
  });

  it('Blood Frenzy doubles after other bonuses are added', () => {
    // (5 + 1 + 2) × 2 = 16
    const state = {
      critMult: 5,
      upgrades: { critM: 3 },
      shardUpgrades: { killingBlow: 2 },
      bloodFrenzyActiveUntil: Date.now() + 10_000,
    };
    expect(effectiveCritMult(state)).toBeCloseTo(16);
  });
});

// ---------- effectiveSkillDuration ----------

describe('effectiveSkillDuration', () => {
  const powerSurge = SKILLS.find(s => s.key === 'powerSurge'); // baseDuration: 10s

  it('returns baseDuration × 1000 ms with no upgrade', () => {
    expect(effectiveSkillDuration(powerSurge, {})).toBe(10_000);
  });

  it('adds 1000 ms per duration upgrade level', () => {
    expect(effectiveSkillDuration(powerSurge, { powerSurgeDuration: 5 })).toBe(15_000);
  });

  it('caps at 30 seconds regardless of upgrade level', () => {
    expect(effectiveSkillDuration(powerSurge, { powerSurgeDuration: 100 })).toBe(30_000);
  });

  it('Gold Rush base duration is 10s', () => {
    const goldRush = SKILLS.find(s => s.key === 'goldRush');
    expect(effectiveSkillDuration(goldRush, {})).toBe(10_000);
  });

  it('Blood Frenzy base duration is 8s', () => {
    const bloodFrenzy = SKILLS.find(s => s.key === 'bloodFrenzy');
    expect(effectiveSkillDuration(bloodFrenzy, {})).toBe(8_000);
  });
});
