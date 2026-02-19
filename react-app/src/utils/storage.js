import { defaultState } from './gameState.js';
import { heroDps, enemyMaxHp, enemyReward, fmt } from './gameLogic.js';

const KEY = "idle_ascension_mvp_v1";

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Merge carefully
    const fresh = defaultState();
    const merged = { ...fresh, ...data };
    // Deep-merge nested objects so new keys added to defaultState survive old saves
    merged.upgrades = { ...fresh.upgrades, ...data.upgrades };
    merged.shardUpgrades = { ...fresh.shardUpgrades, ...(data.shardUpgrades ?? {}) };
    // Migration v1→v2: convert old float multiplier (1.0, 1.25, 1.5…) to integer session count (0, 1, 2…)
    const saveVersion = data.saveVersion ?? 1;
    if (saveVersion < 2) {
      merged.upgrades.tap = Math.round(((merged.upgrades.tap ?? 1) - 1.0) / 0.25);
    }
    merged.saveVersion = 2;
    merged.milestones = { ...fresh.milestones, ...(data.milestones ?? {}) };
    // Ensure heroes exist and merge their levels (in case of updates)
    if (Array.isArray(data.heroes) && data.heroes.length > 0) {
      for (let i = 0; i < merged.heroes.length; i++) {
        const savedHero = data.heroes.find(h => h.id === merged.heroes[i].id);
        if (savedHero) {
          merged.heroes[i].level = savedHero.level;
        }
      }
    }

    // Offline progress (basic): simulate hero DPS for up to 8 hours
    const savedAt = data.savedAt ?? Date.now();
    const offlineMs = Math.max(0, Date.now() - savedAt);
    const offlineCapMs = 8 * 60 * 60 * 1000;
    const simMs = Math.min(offlineMs, offlineCapMs);
    const simSeconds = simMs / 1000;

    // Simulate by granting gold proportional to kills approximation:
    // We’ll simulate damage only, so it still respects stage gates/bosses loosely.
    // For MVP, keep it simple: add gold based on DPS and stage reward.
    const approxGold = Math.floor((heroDps(merged.heroes, merged.upgrades, merged.shards, merged.skillActiveUntil) * simSeconds / Math.max(1, enemyMaxHp(merged.stage, merged.substage, false))) * enemyReward(merged.stage, merged.substage, false, merged.upgrades));
    if (approxGold > 0) {
      merged.gold += approxGold;
      merged.lifetimeGold += approxGold;
      merged.offlineLog = `Offline progress: +${fmt(approxGold)} gold (simulated ${Math.floor(simSeconds/60)} min).`;
    }

    return merged;
  } catch {
    return null;
  }
}

export function reset() {
  localStorage.removeItem(KEY);
}