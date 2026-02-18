import { useState, useEffect, useCallback } from 'react';
import { defaultState } from '../utils/gameState.js';
import { load, save } from '../utils/storage.js';
import { now, SUBSTAGES_PER_STAGE, BOSS_EVERY_STAGE, BOSS_TIME_LIMIT_MS, tapDamage, heroDps, enemyMaxHp, enemyReward, enemyNameFor, globalMult } from '../utils/gameLogic.js';

export function useGameState() {
  const [state, setState] = useState(() => {
    const loaded = load();
    return loaded || defaultState();
  });

  const [enemy, setEnemy] = useState(() => {
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

  const [log, setLog] = useState([]);

  const addLog = useCallback((msg) => {
    const t = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog(prev => [`[${t}] ${msg}`, ...prev].slice(0, 100)); // keep last 100
  }, []);

  // Spawn enemy
  const spawnEnemy = useCallback(() => {
    setState(prev => {
      const isBossStage = (prev.substage === SUBSTAGES_PER_STAGE) && (prev.stage % BOSS_EVERY_STAGE === 0);
      const actuallySpawnBoss = isBossStage && prev.bossEntered;
      const hpMax = Math.floor(enemyMaxHp(prev.stage, prev.substage, actuallySpawnBoss));
      setEnemy({
        isBoss: actuallySpawnBoss,
        name: enemyNameFor(prev.stage, actuallySpawnBoss),
        hp: hpMax,
        hpMax,
        reward: enemyReward(prev.stage, prev.substage, actuallySpawnBoss, prev.upgrades),
        bossStartAt: actuallySpawnBoss ? now() : 0,
      });
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

  // Advance stage
  const advanceStage = useCallback(() => {
    setState(prev => {
      let newSubstage = prev.substage + 1;
      let newStage = prev.stage;
      if (newSubstage > SUBSTAGES_PER_STAGE) {
        newSubstage = 1;
        newStage++;
        // Reset boss flags for new stage
        return { ...prev, stage: newStage, substage: newSubstage, bossEntered: false, bossAttemptedThisStage: false };
      }
      return { ...prev, substage: newSubstage };
    });
  }, [spawnEnemy]);

  // Deal damage
  const dealDamage = useCallback((amount, sourceLabel) => {
    setEnemy(prevEnemy => {
      if (prevEnemy.hp <= 0) return prevEnemy;

      // Boss time limit
      if (prevEnemy.isBoss) {
        const elapsed = now() - prevEnemy.bossStartAt;
        if (elapsed > BOSS_TIME_LIMIT_MS) {
          addLog("Boss escaped! You’re pushed back a little.");
          setState(prev => {
            if (prev.substage > 1) {
              return { ...prev, substage: prev.substage - 1, bossEntered: false };
            }
            return prev;
          });
          setTimeout(spawnEnemy, 0);
          return prevEnemy;
        }
      }

      const newHp = Math.max(0, prevEnemy.hp - amount);
      if (newHp === 0) {
        setState(prev => {
          const g = prevEnemy.reward;
          const newGold = prev.gold + g;
          const newLifetime = prev.lifetimeGold + g;
          addLog(`${sourceLabel} defeated ${prevEnemy.name} (+${g} gold)`);
          setTimeout(advanceStage, 0);
          return { ...prev, gold: newGold, lifetimeGold: newLifetime };
        });
      }
      return { ...prevEnemy, hp: newHp };
    });
  }, [addLog, spawnEnemy, advanceStage]);

  // Tap
  const tap = useCallback(() => {
    const dmg = tapDamage(state.tapLevel, state.tapBase, state.upgrades, state.shards, state.skillActiveUntil);
    const isCrit = Math.random() < state.critChance;
    const finalDmg = isCrit ? dmg * state.critMult : dmg;
    dealDamage(finalDmg, isCrit ? "CRIT tap" : "Tap");
  }, [state, dealDamage]);

  // Game tick
  useEffect(() => {
    let rafId;
    const tick = () => {
      const t = now();
      setState(prev => {
        const dt = Math.min(0.25, (t - prev.lastTick) / 1000);
        const dps = heroDps(prev.heroes, prev.upgrades, prev.shards, prev.skillActiveUntil);
        if (dps > 0) {
          dealDamage(dps * dt, "Heroes");
        }
        // Autosave
        if (t - prev.lastSave > 15000) {
          save(prev);
          addLog("Game saved.");
          return { ...prev, lastTick: t, lastSave: t };
        }
        return { ...prev, lastTick: t };
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dealDamage, addLog]);

  // Init
  useEffect(() => {
    spawnEnemy();
    if (state.offlineLog) {
      addLog(state.offlineLog);
      setState(prev => ({ ...prev, offlineLog: undefined }));
    }
  }, []); // run once

  return { state, setState, enemy, log, tap, addLog, spawnEnemy, advanceStage, dealDamage };
}