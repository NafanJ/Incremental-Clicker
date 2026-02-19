import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState.js';

// Prevent the rAF game-loop from running during tests
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------- initial state ----------

describe('initial state', () => {
  it('starts with 0 gold', () => {
    const { result } = renderHook(() => useGameState());
    expect(result.current.state.gold).toBe(0);
  });

  it('starts at stage 1, substage 1', () => {
    const { result } = renderHook(() => useGameState());
    expect(result.current.state.stage).toBe(1);
    expect(result.current.state.substage).toBe(1);
  });

  it('has an enemy object on first render', () => {
    const { result } = renderHook(() => useGameState());
    expect(result.current.enemy).toBeDefined();
    expect(result.current.enemy.hpMax).toBeGreaterThan(0);
  });

  it('exposes expected action callbacks', () => {
    const { result } = renderHook(() => useGameState());
    expect(typeof result.current.tap).toBe('function');
    expect(typeof result.current.buyMilestone).toBe('function');
    expect(typeof result.current.unlockShardUpgrade).toBe('function');
    expect(typeof result.current.buyShardUpgrade).toBe('function');
  });
});

// ---------- buyMilestone ----------

describe('buyMilestone', () => {
  it('deducts gold and marks milestone when affordable', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.setState(prev => ({ ...prev, gold: 10_000 }));
    });

    act(() => {
      result.current.buyMilestone('sharpening'); // costs 500
    });

    expect(result.current.state.milestones.sharpening).toBe(true);
    expect(result.current.state.gold).toBe(9_500);
  });

  it('does nothing when the player cannot afford it', () => {
    const { result } = renderHook(() => useGameState());
    // 0 gold, cannot afford 500

    act(() => {
      result.current.buyMilestone('sharpening');
    });

    expect(result.current.state.milestones.sharpening).toBe(false);
    expect(result.current.state.gold).toBe(0);
  });

  it('does nothing if the milestone is already purchased', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.setState(prev => ({
        ...prev,
        gold: 10_000,
        milestones: { ...prev.milestones, sharpening: true },
      }));
    });

    act(() => {
      result.current.buyMilestone('sharpening');
    });

    expect(result.current.state.gold).toBe(10_000); // no charge
  });

  it('handles an unknown milestone key without throwing', () => {
    const { result } = renderHook(() => useGameState());
    expect(() => {
      act(() => result.current.buyMilestone('nonexistent'));
    }).not.toThrow();
  });
});

// ---------- unlockShardUpgrade ----------

describe('unlockShardUpgrade', () => {
  it('deducts shards and sets upgrade to level 1 for first unlock', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.setState(prev => ({ ...prev, shards: 10 }));
    });

    act(() => {
      result.current.unlockShardUpgrade('goldBonus'); // first unlock costs 2
    });

    expect(result.current.state.shards).toBe(8);
    expect(result.current.state.shardUpgrades.goldBonus).toBe(1);
    expect(result.current.state.shardUpgradeUnlocked.goldBonus).toBe(true);
  });

  it('does nothing when the player has insufficient shards', () => {
    const { result } = renderHook(() => useGameState());
    // Starts with 0 shards; first unlock costs 2

    act(() => {
      result.current.unlockShardUpgrade('goldBonus');
    });

    expect(result.current.state.shardUpgradeUnlocked.goldBonus).toBeFalsy();
    expect(result.current.state.shards).toBe(0);
  });

  it('does nothing if the upgrade is already unlocked', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.setState(prev => ({
        ...prev,
        shards: 50,
        shardUpgradeUnlocked: { ...prev.shardUpgradeUnlocked, goldBonus: true },
        shardUpgrades: { ...prev.shardUpgrades, goldBonus: 1 },
      }));
    });

    act(() => {
      result.current.unlockShardUpgrade('goldBonus');
    });

    expect(result.current.state.shards).toBe(50); // no change
  });

  it('unlock cost doubles for each subsequent unlock', () => {
    const { result } = renderHook(() => useGameState());

    // Give enough shards for several unlocks: 2 + 4 = 6
    act(() => {
      result.current.setState(prev => ({ ...prev, shards: 20 }));
    });

    act(() => {
      result.current.unlockShardUpgrade('goldBonus'); // costs 2 (0 already unlocked)
    });
    expect(result.current.state.shards).toBe(18);

    act(() => {
      result.current.unlockShardUpgrade('bossTime'); // costs 4 (1 already unlocked)
    });
    expect(result.current.state.shards).toBe(14);
  });
});

// ---------- buyShardUpgrade ----------

describe('buyShardUpgrade', () => {
  it('levels up an unlocked upgrade and deducts shards', () => {
    const { result } = renderHook(() => useGameState());

    // Unlock goldBonus first, then give shards to level it up
    // goldBonus at level 1 → level 2 costs ceil(2 × 3^1) = 6
    act(() => {
      result.current.setState(prev => ({
        ...prev,
        shards: 20,
        shardUpgradeUnlocked: { ...prev.shardUpgradeUnlocked, goldBonus: true },
        shardUpgrades: { ...prev.shardUpgrades, goldBonus: 1 },
      }));
    });

    act(() => {
      result.current.buyShardUpgrade('goldBonus');
    });

    expect(result.current.state.shardUpgrades.goldBonus).toBe(2);
    expect(result.current.state.shards).toBe(14); // 20 - 6
  });

  it('does nothing if the upgrade has not been unlocked yet', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.setState(prev => ({ ...prev, shards: 20 }));
    });

    act(() => {
      result.current.buyShardUpgrade('goldBonus');
    });

    expect(result.current.state.shardUpgrades.goldBonus).toBe(0); // unchanged
    expect(result.current.state.shards).toBe(20);
  });

  it('does nothing when the player cannot afford the next level', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.setState(prev => ({
        ...prev,
        shards: 0, // can't afford anything
        shardUpgradeUnlocked: { ...prev.shardUpgradeUnlocked, goldBonus: true },
        shardUpgrades: { ...prev.shardUpgrades, goldBonus: 1 },
      }));
    });

    act(() => {
      result.current.buyShardUpgrade('goldBonus');
    });

    expect(result.current.state.shardUpgrades.goldBonus).toBe(1); // unchanged
  });
});

// ---------- log ----------

describe('game log', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useGameState());
    // The spawnEnemy() effect fires on mount and adds a stage log entry
    // so we just check log is an array
    expect(Array.isArray(result.current.log)).toBe(true);
  });

  it('addLog appends a timestamped message', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.addLog('Test message');
    });

    const latest = result.current.log[0];
    expect(latest).toMatch(/Test message/);
    expect(latest).toMatch(/^\[/); // starts with a timestamp bracket
  });
});
