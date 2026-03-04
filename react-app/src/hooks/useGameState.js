import { useState, useEffect, useCallback, useRef } from 'react';
import { defaultState } from '../utils/gameState.js';
import { load, save } from '../utils/storage.js';
import { now, SUBSTAGES_PER_STAGE, BOSS_EVERY_STAGE, BOSS_TIME_LIMIT_MS, tapDamage, heroDps, enemyMaxHp, enemyReward, enemyNameFor, globalMult, effectiveCritChance, effectiveCritMult, shardUpgradeCost, shardUpgradeUnlockCost, SHARD_UPGRADES, MILESTONES, SKILLS } from '../utils/gameLogic.js';

export function useGameState() {
  const [state, _setStateRaw] = useState(() => {
    const loaded = load();
    const base = loaded || defaultState();
    // Migration: auto-unlock upgrades that were already purchased before unlock system
    if (base.shardUpgrades && !base.shardUpgradeUnlocked) {
      base.shardUpgradeUnlocked = {};
    }
    const unlocked = { ...base.shardUpgradeUnlocked };
    for (const u of SHARD_UPGRADES) {
      if ((base.shardUpgrades[u.key] ?? 0) > 0 && !unlocked[u.key]) {
        unlocked[u.key] = true;
      }
    }
    return { ...base, shardUpgradeUnlocked: unlocked };
  });
  // Ref mirrors game state so the tick can read values synchronously without async updaters
  const stateRef = useRef(state);
  // Wrapped setter — keeps stateRef in sync on every update
  const setState = useCallback((updater) => {
    _setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  const [enemy, setEnemyState] = useState(() => {
    // Initialize enemy
    const s = state;
    const isBossStage = (s.substage === SUBSTAGES_PER_STAGE) && (s.stage % BOSS_EVERY_STAGE === 0);
    const actuallySpawnBoss = isBossStage && s.bossEntered;
    const hpMax = Math.floor(enemyMaxHp(s.stage, s.substage, actuallySpawnBoss));
    return {
      isBoss: actuallySpawnBoss,
      name: enemyNameFor(s.stage, actuallySpawnBoss),
      hp: hpMax,
      hpMax,
      reward: enemyReward(s.stage, s.substage, actuallySpawnBoss, s.upgrades),
      bossStartAt: actuallySpawnBoss ? now() : 0,
    };
  });
  // Ref keeps enemy state synchronously readable without relying on async updaters
  const enemyRef = useRef(null);

  const [log, setLog] = useState([]);

  const addLog = useCallback((msg) => {
    const t = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog(prev => [`[${t}] ${msg}`, ...prev].slice(0, 100)); // keep last 100
  }, []);

  // Spawn enemy — reads latest game state via setState prev, writes enemy via ref+state
  const spawnEnemy = useCallback(() => {
    setState(prev => {
      const isBossStage = (prev.substage === SUBSTAGES_PER_STAGE) && (prev.stage % BOSS_EVERY_STAGE === 0);
      const actuallySpawnBoss = isBossStage && prev.bossEntered;
      const hpMax = Math.floor(enemyMaxHp(prev.stage, prev.substage, actuallySpawnBoss));
      const newEnemy = {
        isBoss: actuallySpawnBoss,
        name: enemyNameFor(prev.stage, actuallySpawnBoss),
        hp: hpMax,
        hpMax,
        reward: enemyReward(prev.stage, prev.substage, actuallySpawnBoss, prev.upgrades, prev.shardUpgrades, prev.milestones),
        bossStartAt: actuallySpawnBoss ? now() : 0,
      };
      enemyRef.current = newEnemy;
      setEnemyState(newEnemy);
      if (actuallySpawnBoss) {
        addLog(`Boss appears at Stage ${prev.stage}!`);
      } else if (isBossStage && !prev.bossEntered) {
        addLog(`Stage ${prev.stage}-${prev.substage} (Boss preparing...)`);
      } else {
        addLog(`Stage ${prev.stage}-${prev.substage}`);
      }
      return prev;
    });
  }, [addLog]);

  // Advance stage — pure setState updater, schedules spawnEnemy outside the updater
  const advanceStage = useCallback(() => {
    setState(prev => {
      let newSubstage = prev.substage + 1;
      let newStage = prev.stage;
      if (newSubstage > SUBSTAGES_PER_STAGE) {
        newSubstage = 1;
        newStage++;
        return { ...prev, stage: newStage, substage: newSubstage, bossEntered: false, bossAttemptedThisStage: false };
      }
      // Auto-enter boss on first reach; after a failed attempt, stay on substage 9
      if (newSubstage === SUBSTAGES_PER_STAGE) {
        if (!prev.bossAttemptedThisStage) {
          return { ...prev, substage: newSubstage, bossEntered: true, bossAttemptedThisStage: true };
        }
        return prev; // keep substage at 9 until player manually re-enters
      }
      return { ...prev, substage: newSubstage };
    });
    setTimeout(spawnEnemy, 0);
  }, [spawnEnemy]);

  // Deal damage — reads/writes enemy synchronously via ref to avoid async updater issues
  const dealDamage = useCallback((amount, sourceLabel) => {
    const prevEnemy = enemyRef.current;
    if (!prevEnemy || prevEnemy.hp <= 0) return;

    // Boss time limit (extended by shard upgrade)
    if (prevEnemy.isBoss) {
      const effectiveBossTimeMs = BOSS_TIME_LIMIT_MS + (stateRef.current.shardUpgrades?.bossTime ?? 0) * 5000;
      const elapsed = now() - prevEnemy.bossStartAt;
      if (elapsed > effectiveBossTimeMs) {
        const escapeGold = Math.floor(prevEnemy.reward * 0.35);
        addLog(`Boss escaped! Recovered ${escapeGold} gold from the battle.`);
        setState(prev => {
          const next = prev.substage > 1
            ? { ...prev, substage: prev.substage - 1, bossEntered: false }
            : { ...prev, bossEntered: false };
          return { ...next, gold: next.gold + escapeGold, lifetimeGold: next.lifetimeGold + escapeGold };
        });
        setTimeout(spawnEnemy, 0);
        return;
      }
    }

    const newHp = Math.max(0, prevEnemy.hp - amount);
    const updatedEnemy = { ...prevEnemy, hp: newHp };
    enemyRef.current = updatedEnemy;
    setEnemyState(updatedEnemy);

    if (newHp === 0) {
      const goldRushMult = (now() < (stateRef.current.goldRushActiveUntil ?? 0)) ? 3 : 1;
      const goldEarned = Math.floor(prevEnemy.reward * goldRushMult);
      setState(prev => ({
        ...prev,
        gold: prev.gold + goldEarned,
        lifetimeGold: prev.lifetimeGold + goldEarned,
      }));
      const goldNote = goldRushMult > 1 ? ' (Gold Rush!)' : '';
      addLog(`${sourceLabel} defeated ${prevEnemy.name} (+${goldEarned} gold${goldNote})`);
      setTimeout(advanceStage, 0);
    }
  }, [addLog, spawnEnemy, advanceStage]);

  // Tap
  const tap = useCallback(() => {
    const dmg = tapDamage(state.tapLevel, state.tapBase, state.upgrades, state.shards, state.skillActiveUntil, state.milestones, state.shardUpgrades);
    const isCrit = Math.random() < effectiveCritChance(state);
    const finalDmg = isCrit ? dmg * effectiveCritMult(state) : dmg;
    dealDamage(finalDmg, isCrit ? "CRIT tap" : "Tap");
  }, [state, dealDamage]);

  // Game tick
  useEffect(() => {
    let rafId;
    const tick = () => {
      const t = now();
      const s = stateRef.current;
      const dt = Math.min(0.25, (t - s.lastTick) / 1000);
      const dps = heroDps(s.heroes, s.upgrades, s.shards, s.skillActiveUntil, s.milestones, s.shardUpgrades, s);

      if (t - s.lastSave > 15000) {
        save(s);
        addLog("Game saved.");
        setState(prev => ({ ...prev, lastTick: t, lastSave: t }));
      } else {
        setState(prev => ({ ...prev, lastTick: t }));
      }

      if (dps * dt > 0) {
        dealDamage(dps * dt, "Heroes");
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dealDamage, addLog]);

  // Unlock a shard upgrade (first spend before leveling)
  const unlockShardUpgrade = useCallback((key) => {
    if (state.shardUpgradeUnlocked?.[key]) return;
    const alreadyUnlocked = Object.values(state.shardUpgradeUnlocked ?? {}).filter(Boolean).length;
    const cost = shardUpgradeUnlockCost(alreadyUnlocked);
    if (state.shards < cost) return;
    const u = SHARD_UPGRADES.find(u => u.key === key);
    setState(prev => ({
      ...prev,
      shards: prev.shards - cost,
      shardUpgradeUnlocked: { ...prev.shardUpgradeUnlocked, [key]: true },
      shardUpgrades: { ...prev.shardUpgrades, [key]: 1 },
    }));
    addLog(`Unlocked ascension upgrade: ${u?.name ?? key} (Level 1)`);
  }, [state, setState, addLog]);

  // Buy shard upgrade (level up an already-unlocked upgrade)
  const buyShardUpgrade = useCallback((key) => {
    if (!state.shardUpgradeUnlocked?.[key]) return;
    const cost = shardUpgradeCost(key, state.shardUpgrades[key]);
    if (state.shards < cost) return;
    setState(prev => ({
      ...prev,
      shards: prev.shards - cost,
      shardUpgrades: { ...prev.shardUpgrades, [key]: prev.shardUpgrades[key] + 1 },
    }));
    addLog(`Leveled up shard upgrade: ${key}`);
  }, [state, setState, addLog]);

  // Buy milestone
  const buyMilestone = useCallback((key) => {
    const m = MILESTONES.find(m => m.key === key);
    if (!m || state.gold < m.goldCost || state.milestones[key]) return;
    setState(prev => ({
      ...prev,
      gold: prev.gold - m.goldCost,
      milestones: { ...prev.milestones, [key]: true },
    }));
    addLog(`Unlocked milestone: ${m.name}`);
  }, [state, setState, addLog]);

  // Init
  useEffect(() => {
    spawnEnemy();
    if (state.offlineLog) {
      addLog(state.offlineLog);
      setState(prev => ({ ...prev, offlineLog: undefined }));
    }
  }, []); // run once

  return { state, setState, enemy, log, tap, addLog, spawnEnemy, advanceStage, dealDamage, unlockShardUpgrade, buyShardUpgrade, buyMilestone };
}