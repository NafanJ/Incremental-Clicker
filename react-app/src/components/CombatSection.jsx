import { useState, useEffect } from 'react';
import { fmt, clamp01, now, BOSS_TIME_LIMIT_MS, SKILLS } from '../utils/gameLogic.js';

function LogPanel({ log }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: '100%' }}>
      <button className="log-toggle" onClick={() => setOpen(o => !o)}>
        <span>Game Log</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="log-panel">
          {log.map((msg, i) => <div key={i}>{msg}</div>)}
        </div>
      )}
    </div>
  );
}

function CombatSection({ state, setState, enemy, log, tap, addLog, spawnEnemy, activateSkill }) {
  const [bossTimer, setBossTimer] = useState(0);

  useEffect(() => {
    if (!enemy.isBoss) { setBossTimer(0); return; }
    const effectiveBossTimeMs = BOSS_TIME_LIMIT_MS + (state.shardUpgrades?.bossTime ?? 0) * 5000;
    const calc = () => Math.max(0, effectiveBossTimeMs - (now() - enemy.bossStartAt)) / effectiveBossTimeMs;
    setBossTimer(calc());
    const interval = setInterval(() => {
      const remaining = calc();
      setBossTimer(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [enemy.isBoss, enemy.bossStartAt, state.shardUpgrades?.bossTime]);

  const handleEnterBoss = () => {
    setState(prev => ({ ...prev, substage: 10, bossEntered: true, bossAttemptedThisStage: true }));
    addLog('Entering boss fight...');
    spawnEnemy();
  };

  const handleExitBoss = () => {
    setState(prev => ({ ...prev, bossEntered: false, substage: 9 }));
    addLog('Exited boss fight. Returned to minor enemy.');
    spawnEnemy();
  };

  const t = now();
  const activeSkills = SKILLS.filter(s => t < (state[s.activeUntilKey] ?? 0));

  const isBossStage = (state.stage % 1 === 0);
  const isRound9OfBossStage  = state.substage === 9  && isBossStage;
  const isRound10OfBossStage = state.substage === 10 && isBossStage;

  const hpPct = clamp01(enemy.hp / enemy.hpMax);

  return (
    <div className="combat-zone">

      {/* ── Enemy Card ── */}
      <div className="enemy-card">
        <div className="enemy-card__header">
          <h3 className="enemy-card__name">{enemy.name}</h3>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {enemy.isBoss && <span className="boss-badge">BOSS</span>}
            <span className="pill pill--gold">+{fmt(enemy.reward)}g</span>
          </div>
        </div>

        <p className="enemy-card__meta">
          HP: <b>{Math.floor(enemy.hp).toLocaleString('en-GB')}</b>
          {' / '}
          {Math.floor(enemy.hpMax).toLocaleString('en-GB')}
        </p>

        <div className="progress">
          <div
            className={`bar${hpPct < 0.25 ? ' bar--low' : ''}`}
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>

        {enemy.isBoss && (
          <div className="progress progress--boss-timer">
            <div className="bar bar--boss" style={{ width: `${bossTimer * 100}%` }} />
          </div>
        )}

        {activeSkills.length > 0 && (
          <div className="tiny muted" style={{ marginTop: '6px' }}>
            Active: {activeSkills.map(s =>
              `${s.name} (${Math.ceil((state[s.activeUntilKey] - t) / 1000)}s)`
            ).join(' · ')}
          </div>
        )}

        {isRound9OfBossStage && state.bossAttemptedThisStage && !state.bossEntered && (
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

      {/* ── Tap Button ── */}
      <div className="tap-zone">
        <button className="tap-btn" onClick={tap}>
          TAP
          <span className="tap-btn__sub">Attack</span>
        </button>
      </div>

      {/* ── Skills Row ── */}
      <div className="skills-row">
        {SKILLS.map(skill => {
          const isActive  = t < (state[skill.activeUntilKey]   ?? 0);
          const onCooldown = !isActive && t < (state[skill.cooldownUntilKey] ?? 0);
          return (
            <button
              key={skill.key}
              className={`skill-btn${isActive ? ' skill-active' : ''}`}
              onClick={() => activateSkill(skill)}
              disabled={isActive || onCooldown}
            >
              <span className="skill-btn__name">{skill.name}</span>
              <span className="skill-btn__status">
                {isActive
                  ? `${Math.ceil((state[skill.activeUntilKey] - t) / 1000)}s left`
                  : onCooldown
                    ? `CD ${Math.ceil((state[skill.cooldownUntilKey] - t) / 1000)}s`
                    : `${skill.cooldown / 1000}s CD`}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Collapsible Game Log ── */}
      <LogPanel log={log} />

    </div>
  );
}

export default CombatSection;
