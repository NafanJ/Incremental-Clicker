import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { save, load, reset } from './storage.js';
import { defaultState } from './gameState.js';

const LS_KEY = 'idle_ascension_mvp_v1';
const FIXED_NOW = new Date('2026-01-01T12:00:00.000Z').getTime();

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- save ----------

describe('save', () => {
  it('returns true and writes to localStorage', () => {
    const state = defaultState();
    const result = save(state);
    expect(result).toBe(true);
    expect(localStorage.getItem(LS_KEY)).not.toBeNull();
  });

  it('persists savedAt using Date.now()', () => {
    save(defaultState());
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    expect(stored.savedAt).toBe(FIXED_NOW);
  });

  it('persists core game fields', () => {
    const state = { ...defaultState(), gold: 1234, stage: 7, substage: 3, shards: 5 };
    save(state);
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    expect(stored.gold).toBe(1234);
    expect(stored.stage).toBe(7);
    expect(stored.substage).toBe(3);
    expect(stored.shards).toBe(5);
  });
});

// ---------- load — happy path ----------

describe('load (happy path)', () => {
  it('returns null when localStorage has no save', () => {
    expect(load()).toBeNull();
  });

  it('round-trips core fields correctly', () => {
    const state = { ...defaultState(), gold: 500, stage: 4, shards: 3 };
    save(state);
    const loaded = load();
    expect(loaded.gold).toBe(500);
    expect(loaded.stage).toBe(4);
    expect(loaded.shards).toBe(3);
  });

  it('deep-merges upgrades so new default keys survive old saves', () => {
    // Save a state that lacks the 'critM' key (simulating an old save)
    const partial = { ...defaultState(), upgrades: { tap: 0, gold: 1, idle: 1, critC: 1 } };
    localStorage.setItem(LS_KEY, JSON.stringify({ ...partial, savedAt: FIXED_NOW }));
    const loaded = load();
    // critM should come from defaultState()
    expect(loaded.upgrades.critM).toBe(defaultState().upgrades.critM);
  });

  it('deep-merges hero levels while keeping default hero metadata', () => {
    const state = defaultState();
    state.heroes[0].level = 7; // level up squire
    save(state);
    const loaded = load();
    expect(loaded.heroes[0].id).toBe('squire');
    expect(loaded.heroes[0].level).toBe(7);
    // Archer should still be at 0
    expect(loaded.heroes[1].level).toBe(0);
  });

  it('forces saveVersion to 2 on load', () => {
    save(defaultState());
    expect(load().saveVersion).toBe(2);
  });
});

// ---------- load — v1 → v2 migration ----------

describe('load (v1→v2 migration)', () => {
  const makeV1Save = (tapValue) => {
    const state = { ...defaultState(), saveVersion: 1, upgrades: { ...defaultState().upgrades, tap: tapValue }, savedAt: FIXED_NOW };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  };

  it('converts tap=1.0 (0 sessions) correctly', () => {
    makeV1Save(1.0);
    expect(load().upgrades.tap).toBe(0);
  });

  it('converts tap=1.25 (1 session) correctly', () => {
    makeV1Save(1.25);
    expect(load().upgrades.tap).toBe(1);
  });

  it('converts tap=1.75 (3 sessions) correctly', () => {
    makeV1Save(1.75);
    expect(load().upgrades.tap).toBe(3);
  });

  it('does NOT re-migrate a v2 save', () => {
    // v2 stores tap as integer session count (e.g. 3)
    const state = { ...defaultState(), saveVersion: 2, upgrades: { ...defaultState().upgrades, tap: 3 }, savedAt: FIXED_NOW };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    expect(load().upgrades.tap).toBe(3);
  });
});

// ---------- load — offline progress ----------

describe('load (offline progress)', () => {
  const stateWithHero = (savedAtOffset) => {
    const state = defaultState();
    state.heroes[0].level = 5; // Squire lv5 → meaningful DPS
    return { ...state, savedAt: FIXED_NOW - savedAtOffset };
  };

  it('grants gold when heroes have levels and time has passed', () => {
    localStorage.setItem(LS_KEY, JSON.stringify(stateWithHero(3_600_000))); // 1 hour ago
    const loaded = load();
    expect(loaded.gold).toBeGreaterThan(0);
    expect(loaded.lifetimeGold).toBeGreaterThan(0);
  });

  it('sets offlineLog with time simulated', () => {
    localStorage.setItem(LS_KEY, JSON.stringify(stateWithHero(3_600_000))); // 1 hour
    const loaded = load();
    expect(loaded.offlineLog).toMatch(/Offline progress/);
    expect(loaded.offlineLog).toMatch(/60 min/);
  });

  it('caps offline simulation at 8 hours even if away longer', () => {
    localStorage.setItem(LS_KEY, JSON.stringify(stateWithHero(36_000_000))); // 10 hours ago
    const loaded = load();
    // Log must show 480 minutes (8h), not 600 (10h)
    expect(loaded.offlineLog).toMatch(/480 min/);
  });

  it('grants no offline gold when all heroes are level 0', () => {
    const state = { ...defaultState(), savedAt: FIXED_NOW - 3_600_000 };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    const loaded = load();
    expect(loaded.gold).toBe(0);
    expect(loaded.offlineLog).toBeUndefined();
  });

  it('grants no offline gold when savedAt equals now (just saved)', () => {
    const state = { ...defaultState(), heroes: [{ ...defaultState().heroes[0], level: 5 }], savedAt: FIXED_NOW };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    const loaded = load();
    expect(loaded.gold).toBe(0);
  });
});

// ---------- load — error handling ----------

describe('load (error handling)', () => {
  it('returns null for corrupted JSON', () => {
    localStorage.setItem(LS_KEY, 'not valid json {{{');
    expect(load()).toBeNull();
  });

  it('returns null when key is absent', () => {
    expect(load()).toBeNull();
  });
});

// ---------- reset ----------

describe('reset', () => {
  it('removes the save key from localStorage', () => {
    save(defaultState());
    expect(localStorage.getItem(LS_KEY)).not.toBeNull();
    reset();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('causes load() to return null after reset', () => {
    save(defaultState());
    reset();
    expect(load()).toBeNull();
  });
});
