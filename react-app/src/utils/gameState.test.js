import { describe, it, expect } from 'vitest';
import { defaultState } from './gameState.js';

describe('defaultState', () => {
  it('starts with 0 gold', () => expect(defaultState().gold).toBe(0));
  it('starts at stage 1', () => expect(defaultState().stage).toBe(1));
  it('starts at substage 1', () => expect(defaultState().substage).toBe(1));
  it('starts with 0 shards', () => expect(defaultState().shards).toBe(0));
  it('has save version 2', () => expect(defaultState().saveVersion).toBe(2));
  it('starts with 0 lifetime gold', () => expect(defaultState().lifetimeGold).toBe(0));

  it('base crit chance is 10%', () => expect(defaultState().critChance).toBe(0.10));
  it('base crit multiplier is 5×', () => expect(defaultState().critMult).toBe(5));

  it('tap training sessions start at 0', () => expect(defaultState().upgrades.tap).toBe(0));
  // gold/idle/critC/critM start at 1 so upgradeCost() base cases work correctly
  it('gold upgrade starts at level 1', () => expect(defaultState().upgrades.gold).toBe(1));
  it('idle upgrade starts at level 1', () => expect(defaultState().upgrades.idle).toBe(1));
  it('critC upgrade starts at level 1', () => expect(defaultState().upgrades.critC).toBe(1));
  it('critM upgrade starts at level 1', () => expect(defaultState().upgrades.critM).toBe(1));

  describe('heroes', () => {
    it('has exactly 5 heroes', () => expect(defaultState().heroes).toHaveLength(5));

    it('all heroes start at level 0', () => {
      expect(defaultState().heroes.every(h => h.level === 0)).toBe(true);
    });

    it('hero IDs are in the expected order', () => {
      const ids = defaultState().heroes.map(h => h.id);
      expect(ids).toEqual(['squire', 'archer', 'mage', 'paladin', 'necromancer']);
    });

    it('hero unlock stages are correct', () => {
      const { heroes } = defaultState();
      const stageOf = (id) => heroes.find(h => h.id === id).unlockStage;
      expect(stageOf('squire')).toBe(1);
      expect(stageOf('archer')).toBe(8);
      expect(stageOf('mage')).toBe(18);
      expect(stageOf('paladin')).toBe(30);
      expect(stageOf('necromancer')).toBe(55);
    });

    it('hero base DPS values are set', () => {
      const { heroes } = defaultState();
      expect(heroes.find(h => h.id === 'squire').baseDps).toBe(2);
      expect(heroes.find(h => h.id === 'necromancer').baseDps).toBe(700);
    });
  });

  describe('milestones', () => {
    it('has all four milestone keys', () => {
      const keys = Object.keys(defaultState().milestones).sort();
      expect(keys).toEqual(['dragonsLuck', 'formation', 'goldVein', 'sharpening']);
    });

    it('all milestones default to false', () => {
      expect(Object.values(defaultState().milestones).every(v => v === false)).toBe(true);
    });
  });

  describe('shardUpgrades', () => {
    it('has all 14 shard upgrade keys', () => {
      expect(Object.keys(defaultState().shardUpgrades)).toHaveLength(14);
    });

    it('all shard upgrades default to level 0', () => {
      expect(Object.values(defaultState().shardUpgrades).every(v => v === 0)).toBe(true);
    });
  });

  describe('skill timestamps', () => {
    it('all skill active/cooldown timestamps default to 0', () => {
      const s = defaultState();
      expect(s.skillActiveUntil).toBe(0);
      expect(s.skillCooldownUntil).toBe(0);
      expect(s.goldRushActiveUntil).toBe(0);
      expect(s.goldRushCooldownUntil).toBe(0);
      expect(s.bloodFrenzyActiveUntil).toBe(0);
      expect(s.bloodFrenzyCooldownUntil).toBe(0);
    });
  });

  it('returns a fresh object on every call (no shared reference)', () => {
    const a = defaultState();
    const b = defaultState();
    a.gold = 9999;
    expect(b.gold).toBe(0);
  });

  it('heroes array is not shared between calls', () => {
    const a = defaultState();
    const b = defaultState();
    a.heroes[0].level = 99;
    expect(b.heroes[0].level).toBe(0);
  });
});
