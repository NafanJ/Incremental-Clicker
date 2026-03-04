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
    // Migration v1->v2: convert old float multiplier (1.0, 1.25, 1.5...) to integer session count (0, 1, 2...)
    const saveVersion = data.saveVersion ?? 1;
    if (saveVersion < 2) {
      merged.upgrades.tap = Math.round(((merged.upgrades.tap ?? 1) - 1.0) / 0.25);
    }
    merged.saveVersion = 2;
    merged.milestones = { ...fresh.milestones, ...(data.milestones ?? {}) };
    merged.achievements = { ...fresh.achievements, ...(data.achievements ?? {}) };
    // Always use fresh heroes list (picks up new heroes), merge saved levels in
    merged.heroes = fresh.heroes.map(h => {
      const saved = Array.isArray(data.heroes) && data.heroes.find(s => s.id === h.id);
      return saved ? { ...h, level: saved.level } : h;
    });

    // Offline progress: simulate stage-by-stage advancement for up to 8 hours
    const savedAt = data.savedAt ?? Date.now();
    const offlineMs = Math.max(0, Date.now() - savedAt);
    const offlineCapMs = 8 * 60 * 60 * 1000;
    const simMs = Math.min(offlineMs, offlineCapMs);
    var simTimeLeft = simMs / 1000;

    const dps = heroDps(merged.heroes, merged.upgrades, merged.shards, 0, merged.milestones, merged.shardUpgrades, {});
    if (dps > 0 && simTimeLeft > 1) {
      var totalGold = 0;
      var stagesCleared = 0;
      var stage = merged.stage;
      var substage = merged.substage;
      var SUBSTAGES = 10;
      var maxIterations = 5000;
      var iterations = 0;

      while (simTimeLeft > 0 && iterations < maxIterations) {
        iterations++;
        // Skip bosses offline - player should fight them manually
        if (substage === SUBSTAGES) break;

        var hp = enemyMaxHp(stage, substage, false);
        var timeToKill = hp / dps;

        if (timeToKill > simTimeLeft) break;

        simTimeLeft -= timeToKill;
        var reward = enemyReward(stage, substage, false, merged.upgrades, merged.shardUpgrades ?? {}, merged.milestones ?? {});
        totalGold += reward;

        // Advance substage
        substage++;
        if (substage >= SUBSTAGES) {
          // Reached boss substage - stop here
          break;
        }
        stagesCleared++;
      }

      if (totalGold > 0) {
        merged.gold += totalGold;
        merged.lifetimeGold += totalGold;
        merged.stage = stage;
        merged.substage = substage;
        if (stage > (merged.highestStage ?? 1)) merged.highestStage = stage;
        var minutes = Math.floor((simMs / 1000 - simTimeLeft) / 60);
        var stageNote = stagesCleared > 0 ? ", advanced " + stagesCleared + " substages" : "";
        merged.offlineLog = "Offline progress: +" + fmt(totalGold) + " gold" + stageNote + " (" + minutes + " min simulated).";
      }
    }

    return merged;
  } catch {
    return null;
  }
}

export function reset() {
  localStorage.removeItem(KEY);
}
