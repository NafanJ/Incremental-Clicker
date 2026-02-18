import { upgradeCost, heroCost, fmt, heroDps, globalMult, now } from '../utils/gameLogic.js';
import SettingsSection from './SettingsSection.jsx';

function UpgradeSection({ state, setState, addLog, spawnEnemy }) {
  const handleUpgrade = (key) => {
    const cost = upgradeCost(key, state.upgrades);
    if (state.gold >= cost) {
      setState(prev => {
        const bump = { tap: 0.25, gold: 0.20, idle: 0.22 }[key] ?? 0.2;
        const newUpgrades = { ...prev.upgrades, [key]: +(prev.upgrades[key] + bump).toFixed(2) };
        addLog(`Bought upgrade: ${key} (+${bump.toFixed(2)})`);
        return { ...prev, gold: prev.gold - cost, upgrades: newUpgrades };
      });
    }
  };

  const handleHeroUpgrade = (heroId) => {
    const hero = state.heroes.find(h => h.id === heroId);
    if (!hero) return;
    const unlocked = state.stage >= hero.unlockStage;
    if (!unlocked) return;
    const cost = heroCost(hero);
    if (state.gold >= cost) {
      setState(prev => {
        const newHeroes = prev.heroes.map(h => h.id === heroId ? { ...h, level: h.level + 1 } : h);
        addLog(`Upgraded ${hero.name} to Lv ${hero.level + 1}`);
        return { ...prev, gold: prev.gold - cost, heroes: newHeroes };
      });
    }
  };

  const upgrades = [
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
  ];

  return (
    <div className="card stack">
      <div className="item">
        <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Upgrades</h3>
        <div className="list">
          {upgrades.map(u => {
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

      <div className="item">
        <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Heroes</h3>
        <div className="list">
          {state.heroes.map(h => {
            const unlocked = state.stage >= h.unlockStage || (state.stage === h.unlockStage && state.substage >= 1);
            const cost = heroCost(h);
            const currentDps = h.level > 0
              ? h.baseDps * Math.pow(h.dpsMultPerLevel, h.level - 1) * state.upgrades.idle * globalMult(state.shards) * ((now() < state.skillActiveUntil) ? 2.0 : 1.0)
              : 0;
            return (
              <div key={h.id} className="item">
                <div className="split">
                  <div>
                    <h3>{h.name} <span className="muted">Lv {h.level}</span></h3>
                    <p>{unlocked ? `Adds idle DPS. Current contribution: <b>${fmt(currentDps)}</b>/s` : `Unlocks at Stage ${h.unlockStage}.`}</p>
                  </div>
                  <button
                    className="btn"
                    disabled={(!unlocked || state.gold < cost)}
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

      <SettingsSection state={state} setState={setState} addLog={addLog} spawnEnemy={spawnEnemy} />
    </div>
  );
}

export default UpgradeSection;