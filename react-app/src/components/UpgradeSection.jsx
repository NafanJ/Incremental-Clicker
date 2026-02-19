import { useState } from 'react';
import { upgradeCost, heroCost, fmt, globalMult, now, SHARD_UPGRADES, shardUpgradeCost, shardUpgradeUnlockCost, MILESTONES } from '../utils/gameLogic.js';
import SettingsSection from './SettingsSection.jsx';

function UpgradeSection({ state, setState, addLog, spawnEnemy, unlockShardUpgrade, buyShardUpgrade, buyMilestone }) {
  const [tab, setTab] = useState('upgrades');

  const handleUpgrade = (key) => {
    const cost = upgradeCost(key, state.upgrades);
    if (state.gold < cost) return;
    setState(prev => {
      const bump = { tap: 0.25, gold: 0.20, idle: 0.22, critC: 1, critM: 1 }[key] ?? 1;
      const newUpgrades = { ...prev.upgrades, [key]: +(prev.upgrades[key] + bump).toFixed(2) };
      addLog(`Bought upgrade: ${key}`);
      return { ...prev, gold: prev.gold - cost, upgrades: newUpgrades };
    });
  };

  const handleHeroUpgrade = (heroId) => {
    const hero = state.heroes.find(h => h.id === heroId);
    if (!hero) return;
    if (state.stage < hero.unlockStage) return;
    const cost = heroCost(hero);
    if (state.gold < cost) return;
    setState(prev => {
      const newHeroes = prev.heroes.map(h => h.id === heroId ? { ...h, level: h.level + 1 } : h);
      addLog(`Upgraded ${hero.name} to Lv ${hero.level + 1}`);
      return { ...prev, gold: prev.gold - cost, heroes: newHeroes };
    });
  };

  const upgradeList = [
    {
      key: "tap",
      title: "Tap Training",
      desc: "Increases tap damage multiplier.",
      effect: () => `Current: ${state.upgrades.tap.toFixed(2)}×`,
    },
    {
      key: "idle",
      title: "Hero Discipline",
      desc: "Increases hero DPS multiplier.",
      effect: () => `Current: ${state.upgrades.idle.toFixed(2)}×`,
    },
    {
      key: "gold",
      title: "Gold Magnet",
      desc: "Increases gold earned from kills.",
      effect: () => `Current: ${state.upgrades.gold.toFixed(2)}×`,
    },
    {
      key: "critC",
      title: "Crit Chance",
      desc: "Increases critical hit chance by 2% per level.",
      effect: () => `Bonus: +${(state.upgrades.critC - 1) * 2}%`,
    },
    {
      key: "critM",
      title: "Crit Multiplier",
      desc: "Increases critical hit multiplier by 0.5× per level.",
      effect: () => `Bonus: +${((state.upgrades.critM - 1) * 0.5).toFixed(1)}×`,
    },
  ];

  const unlockedMilestones = MILESTONES.filter(m => state.stage >= m.unlockStage);

  const tabs = ['upgrades', 'heroes', 'ascension', 'milestones'];

  return (
    <div className="card stack">
      <div className="row" style={{ gap: '4px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t}
            className={`btn${tab === t ? ' primary' : ''}`}
            onClick={() => setTab(t)}
            style={{ flex: '1' }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'upgrades' && (
        <div className="item">
          <div className="list">
            {upgradeList.map(u => {
              const cost = upgradeCost(u.key, state.upgrades);
              return (
                <div key={u.key} className="item">
                  <div className="split">
                    <div>
                      <h3>{u.title}</h3>
                      <p>{u.desc} <span className="muted">{u.effect()}</span></p>
                    </div>
                    <button
                      className="btn"
                      disabled={state.gold < cost}
                      onClick={() => handleUpgrade(u.key)}
                    >
                      Buy ({fmt(cost)})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'heroes' && (
        <div className="item">
          <div className="list">
            {state.heroes.map(h => {
              const unlocked = state.stage >= h.unlockStage;
              const cost = heroCost(h);
              const currentDps = h.level > 0
                ? h.baseDps * Math.pow(h.dpsMultPerLevel, h.level - 1) * state.upgrades.idle * globalMult(state.shards) * ((now() < state.skillActiveUntil) ? 2.0 : 1.0)
                : 0;
              return (
                <div key={h.id} className="item">
                  <div className="split">
                    <div>
                      <h3>{h.name} <span className="muted">Lv {h.level}</span></h3>
                      <p>{unlocked
                        ? <span>Idle DPS. Contribution: <b>{fmt(currentDps)}</b>/s</span>
                        : `Unlocks at Stage ${h.unlockStage}.`}
                      </p>
                    </div>
                    <button
                      className="btn"
                      disabled={!unlocked || state.gold < cost}
                      onClick={() => handleHeroUpgrade(h.id)}
                    >
                      Upgrade ({fmt(cost)})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'ascension' && (
        <div className="item">
          <p className="tiny muted" style={{ marginBottom: '8px' }}>Spend ascension shards on permanent bonuses that survive prestige. Unlock new upgrades first, then level them up.</p>
          <div className="list">
            {(() => {
              const unlockedCount = Object.values(state.shardUpgradeUnlocked ?? {}).filter(Boolean).length;
              const nextUnlockCost = shardUpgradeUnlockCost(unlockedCount);
              return SHARD_UPGRADES.map(u => {
                const isUnlocked = !!(state.shardUpgradeUnlocked?.[u.key]);
                const level = state.shardUpgrades[u.key] ?? 0;
                const levelCost = shardUpgradeCost(u.key, level);
                return (
                  <div key={u.key} className="item" style={{ opacity: isUnlocked ? 1 : 0.65 }}>
                    <div className="split">
                      <div>
                        <h3>
                          {isUnlocked ? null : <span style={{ marginRight: '6px' }}>🔒</span>}
                          {u.name}
                          {isUnlocked && <span className="muted"> Lv {level}</span>}
                        </h3>
                        <p>{u.desc}</p>
                      </div>
                      {isUnlocked ? (
                        <button
                          className="btn"
                          disabled={state.shards < levelCost}
                          onClick={() => buyShardUpgrade(u.key)}
                        >
                          {levelCost} ◆
                        </button>
                      ) : (
                        <button
                          className="btn"
                          disabled={state.shards < nextUnlockCost}
                          onClick={() => unlockShardUpgrade(u.key)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Unlock {nextUnlockCost} ◆
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {tab === 'milestones' && (
        <div className="item">
          {unlockedMilestones.length === 0 ? (
            <p className="tiny muted">No milestones unlocked yet. Reach Stage {MILESTONES[0].unlockStage} to unlock the first one.</p>
          ) : (
            <div className="list">
              {unlockedMilestones.map(m => {
                const bought = state.milestones[m.key];
                return (
                  <div key={m.key} className="item">
                    <div className="split">
                      <div>
                        <h3>{m.name} {bought && <span className="pill">Owned</span>}</h3>
                        <p>{m.desc}</p>
                      </div>
                      <button
                        className="btn"
                        disabled={bought || state.gold < m.goldCost}
                        onClick={() => buyMilestone(m.key)}
                      >
                        {bought ? 'Owned' : `Buy (${fmt(m.goldCost)})`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SettingsSection state={state} setState={setState} addLog={addLog} spawnEnemy={spawnEnemy} />
    </div>
  );
}

export default UpgradeSection;
