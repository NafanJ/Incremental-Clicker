import { now } from './gameLogic.js';

export function defaultState() {
  return {
    gold: 0,
    stage: 1,
    substage: 1,         // 1..10 per stage
    shards: 0,
    tapLevel: 1,
    tapBase: 1,
    critChance: 0.10,
    critMult: 5,
    skillActiveUntil: 0,
    skillCooldownUntil: 0,
    bossEntered: false,  // true if player has entered the boss fight
    bossAttemptedThisStage: false,  // tracks if boss has been attempted in current stage
    heroes: [
      { id:"squire",      name:"Squire",      level: 0, baseDps: 1,   dpsMultPerLevel: 1.12, unlockStage: 2  },
      { id:"archer",      name:"Archer",      level: 0, baseDps: 6,   dpsMultPerLevel: 1.13, unlockStage: 8  },
      { id:"mage",        name:"Mage",        level: 0, baseDps: 30,  dpsMultPerLevel: 1.14, unlockStage: 18 },
      { id:"paladin",     name:"Paladin",     level: 0, baseDps: 150, dpsMultPerLevel: 1.15, unlockStage: 30 },
      { id:"necromancer", name:"Necromancer", level: 0, baseDps: 700, dpsMultPerLevel: 1.16, unlockStage: 55 },
    ],
    upgrades: {
      tap: 1,
      gold: 1,
      idle: 1,
      critC: 1,
      critM: 1,
    },
    shardUpgrades: { goldBonus: 0, bossTime: 0, prestigeBonus: 0, headStart: 0, tapSynergy: 0, heroMastery: 0, luckyStrike: 0, killingBlow: 0, bossBane: 0, soulCollector: 0 },
    shardUpgradeUnlocked: {},
    milestones: { sharpening: false, formation: false, dragonsLuck: false, goldVein: false },
    lifetimeGold: 0,
    lastTick: now(),
    lastSave: now(),
  };
}