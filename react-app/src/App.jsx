import { useState } from 'react';
import CombatSection from './components/CombatSection.jsx';
import UpgradeSection from './components/UpgradeSection.jsx';
import { useGameState } from './hooks/useGameState.js';
import { fmt, heroDps, now, effectiveSkillDuration, prestigeEarned } from './utils/gameLogic.js';

const TABS = [
  { id: 'upgrades',   icon: '⚔️',  label: 'Upgrades'   },
  { id: 'heroes',     icon: '🦸',  label: 'Heroes'     },
  { id: 'skills',     icon: '✨',  label: 'Skills'     },
  { id: 'ascension',  icon: '🔮',  label: 'Ascend'     },
  { id: 'milestones', icon: '⭐',  label: 'Milestones' },
];

function App() {
  const {
    state, setState, enemy, log, tap, addLog, spawnEnemy,
    unlockShardUpgrade, buyShardUpgrade, buyMilestone,
  } = useGameState();

  const [activeTab, setActiveTab] = useState('upgrades');

  const handleActivateSkill = (skill) => {
    const t = now();
    const activeUntil = state[skill.activeUntilKey] ?? 0;
    const cooldownUntil = state[skill.cooldownUntilKey] ?? 0;
    if (t < activeUntil || t < cooldownUntil) return;
    const duration = effectiveSkillDuration(skill, state.shardUpgrades);
    setState(prev => ({
      ...prev,
      [skill.activeUntilKey]: t + duration,
      [skill.cooldownUntilKey]: t + skill.cooldown,
    }));
    addLog(`${skill.name} activated!`);
  };

  const handlePrestige = () => {
    const earned = prestigeEarned(state.stage, state.substage, state.shardUpgrades);
    if (earned <= 0) return;
    setState(prev => ({
      ...prev,
      shards: prev.shards + earned,
      gold: 0,
      stage: 1 + (prev.shardUpgrades?.headStart ?? 0),
      substage: 1,
      bossEntered: false,
      bossAttemptedThisStage: false,
      heroes: prev.heroes.map(h => ({ ...h, level: 0 })),
      upgrades: { tap: 0, gold: 1, idle: 1, critC: 1, critM: 1 },
      lifetimeGold: 0,
      lastTick: now(),
      lastSave: now(),
    }));
    addLog(`Ascended and gained ${earned} shards. Permanent power increased.`);
    spawnEnemy();
  };

  const hDps = heroDps(
    state.heroes, state.upgrades, state.shards,
    state.skillActiveUntil, state.milestones, state.shardUpgrades
  );

  return (
    <div className="app-shell">

      {/* ── Top HUD Bar ── */}
      <header className="hud-bar">
        <div className="hud-stat">
          <span className="hud-stat__label">Gold</span>
          <span className="hud-stat__value hud-stat__value--gold">{fmt(state.gold)}</span>
        </div>
        <div className="hud-divider" />
        <div className="hud-stat">
          <span className="hud-stat__label">Stage</span>
          <span className="hud-stat__value">{state.stage}<span className="muted">-</span>{state.substage}</span>
        </div>
        <div className="hud-divider" />
        <div className="hud-stat">
          <span className="hud-stat__label">Shards</span>
          <span className="hud-stat__value hud-stat__value--shards">{fmt(state.shards)}</span>
        </div>
        <div className="hud-divider" />
        <div className="hud-stat">
          <span className="hud-stat__label">Hero DPS</span>
          <span className="hud-stat__value hud-stat__value--dps">{fmt(hDps)}/s</span>
        </div>
      </header>

      {/* ── Main Scroll (combat zone) ── */}
      <main className="main-scroll">
        <CombatSection
          state={state}
          setState={setState}
          enemy={enemy}
          log={log}
          tap={tap}
          addLog={addLog}
          spawnEnemy={spawnEnemy}
          activateSkill={handleActivateSkill}
        />
      </main>

      {/* ── Right Panel (upgrade section, desktop: second grid column) ── */}
      <div className="right-panel panel-zone">
        <UpgradeSection
          state={state}
          setState={setState}
          addLog={addLog}
          spawnEnemy={spawnEnemy}
          unlockShardUpgrade={unlockShardUpgrade}
          buyShardUpgrade={buyShardUpgrade}
          buyMilestone={buyMilestone}
          activeTab={activeTab}
          activateSkill={handleActivateSkill}
          handlePrestige={handlePrestige}
        />
      </div>

      {/* ── Bottom Nav (mobile) / Top of right panel (desktop via CSS) ── */}
      <nav className="bottom-nav" aria-label="Game sections">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`bottom-nav__tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            aria-pressed={activeTab === t.id}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

export default App;
