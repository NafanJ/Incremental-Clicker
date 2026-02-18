import { useState, useEffect } from 'react';
import { fmt, clamp01, now, BOSS_TIME_LIMIT_MS, prestigeEarned } from '../utils/gameLogic.js';
import StatsBar from './StatsBar.jsx';

function CombatSection({ state, setState, enemy, log, tap, addLog, spawnEnemy }) {
  const [bossTimer, setBossTimer] = useState(0);

  useEffect(() => {
    if (!enemy.isBoss) return;
    const interval = setInterval(() => {
      const elapsed = now() - enemy.bossStartAt;
      const remaining = Math.max(0, BOSS_TIME_LIMIT_MS - elapsed);
      setBossTimer(remaining / BOSS_TIME_LIMIT_MS);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [enemy]);

  const handleSkill = () => {
    const t = now();
    if (t < state.skillCooldownUntil && t >= state.skillActiveUntil) return;
    if (t < state.skillActiveUntil) return;
    setState(prev => ({
      ...prev,
      skillActiveUntil: t + 10000,
      skillCooldownUntil: t + 30000,
    }));
    addLog("Power Surge activated!");
  };

  const handleEnterBoss = () => {
    setState(prev => ({ ...prev, substage: 10, bossEntered: true, bossAttemptedThisStage: true }));
    addLog("Entering boss fight...");
    spawnEnemy();
  };

  const handleExitBoss = () => {
    setState(prev => ({ ...prev, bossEntered: false, substage: 9 }));
    addLog("Exited boss fight. Returned to minor enemy.");
    spawnEnemy();
  };

  const handlePrestige = () => {
    const earned = prestigeEarned(state.stage, state.substage);
    if (earned <= 0) return;
    setState(prev => ({
      ...prev,
      shards: prev.shards + earned,
      gold: 0,
      stage: 1,
      substage: 1,
      bossEntered: false,
      bossAttemptedThisStage: false,
      heroes: prev.heroes.map(h => ({ ...h, level: 0 })),
      upgrades: { tap: 1, gold: 1, idle: 1 },
      lifetimeGold: 0,
      lastTick: now(),
      lastSave: now(),
    }));
    addLog(`Ascended and gained ${earned} shards. Permanent power increased.`);
    spawnEnemy();
  };

  const t = now();
  const onCd = t < state.skillCooldownUntil;
  const active = t < state.skillActiveUntil;
  const skillDisabled = onCd && !active;
  const skillText = active ? "Power Surge (active)" : "Power Surge (+10s)";
  const skillInfo = active
    ? `Active for ${(Math.max(0, state.skillActiveUntil - t)/1000).toFixed(0)}s`
    : onCd
    ? `Cooldown: ${(Math.max(0, state.skillCooldownUntil - t)/1000).toFixed(0)}s`
    : "Cooldown: 30s";

  const earn = prestigeEarned(state.stage, state.substage);

  const isBossStage = (state.stage % 1 === 0); // every stage
  const isRound9OfBossStage = (state.substage === 9) && isBossStage;
  const isRound10OfBossStage = (state.substage === 10) && isBossStage;

  return (
    <div className="card stack">
      <StatsBar state={state} />

      <div className="item">
        <div className="split">
          <div>
            <h3>{enemy.name}</h3>
            <p className="tiny">
              HP: <b><span>{Math.floor(enemy.hp).toLocaleString("en-GB")}</span></b> / <span>{Math.floor(enemy.hpMax).toLocaleString("en-GB")}</span>
              <span className="muted">•</span>
              Reward: <b>{fmt(enemy.reward)}</b> gold
              <span className="muted">•</span>
              {enemy.isBoss && <span className="pill">BOSS</span>}
            </p>
          </div>
          <button className="btn primary" onClick={tap}>Tap Attack</button>
        </div>

        <div className="progress" style={{ marginTop: '10px' }}>
          <div className="bar" style={{ width: `${clamp01(enemy.hp / enemy.hpMax) * 100}%` }}></div>
        </div>

        {enemy.isBoss && (
          <div className="progress" style={{ marginTop: '10px' }}>
            <div className="bar" style={{ background: 'linear-gradient(90deg, #ff6b6b, #ffa06b)', width: `${bossTimer * 100}%` }}></div>
          </div>
        )}

        <div className="row" style={{ marginTop: '10px' }}>
          <button className="btn" onClick={handleSkill} disabled={skillDisabled}>{skillText}</button>
          <div className="tiny muted">{skillInfo}</div>
        </div>

        {isRound9OfBossStage && !state.bossEntered && (
          <div className="row" style={{ marginTop: '10px' }}>
            <button className="btn primary" onClick={handleEnterBoss}>Enter Boss Fight</button>
          </div>
        )}

        {isRound10OfBossStage && state.bossEntered && (
          <div className="row" style={{ marginTop: '10px' }}>
            <button className="btn danger" onClick={handleExitBoss}>Exit Boss</button>
          </div>
        )}
      </div>

      <div className="item">
        <div className="row">
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '14px' }}>Prestige</h3>
            <p className="tiny">Reset to earn shards. Shards give permanent global damage.</p>
          </div>
          <button className="btn danger" onClick={handlePrestige} disabled={earn <= 0}>Ascend</button>
        </div>
        <div className="tiny muted">Earn <b>{fmt(earn)}</b> shards if you ascend now.</div>
      </div>

      <div className="log">
        {log.map((msg, i) => <div key={i}>{msg}</div>)}
      </div>
    </div>
  );
}

export default CombatSection;