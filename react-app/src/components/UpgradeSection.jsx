import { useState } from 'react';
import {
  upgradeCost, tapTrainingCost, heroCost, fmt, globalMult, now,
  SHARD_UPGRADES, shardUpgradeCost, shardUpgradeUnlockCost,
  MILESTONES, SKILLS, effectiveSkillDuration, effectiveCritChance,
  effectiveCritMult, tapDamage, heroDps, prestigeEarned, ACHIEVEMENTS,
} from '../utils/gameLogic.js';
import SettingsSection from './SettingsSection.jsx';

function UpgradeSection({
  state, setState, addLog, spawnEnemy,
  unlockShardUpgrade, buyShardUpgrade, buyMilestone,
  activeTab, activateSkill, handlePrestige,
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState(1); // 1, 5, 10, or 'max'

  // Calculate total cost for buying N levels of an upgrade
  const bulkUpgradeCost = (key, count) => {
    let total = 0;
    const tempUpgrades = { ...state.upgrades };
    const bump = { tap: 1, gold: 0.20, idle: 0.22, critC: 1, critM: 1 }[key] ?? 1;
    for (let i = 0; i < count; i++) {
      total += key === 'tap' ? tapTrainingCost(tempUpgrades.tap) : upgradeCost(key, tempUpgrades);
      tempUpgrades[key] = +(tempUpgrades[key] + bump).toFixed(2);
    }
    return total;
  };

  // Calculate how many levels of an upgrade we can afford
  const maxAffordableUpgrades = (key) => {
    let count = 0;
    let gold = state.gold;
    const tempUpgrades = { ...state.upgrades };
    const bump = { tap: 1, gold: 0.20, idle: 0.22, critC: 1, critM: 1 }[key] ?? 1;
    while (count < 1000) {
      const cost = key === 'tap' ? tapTrainingCost(tempUpgrades.tap) : upgradeCost(key, tempUpgrades);
      if (gold < cost) break;
      gold -= cost;
      tempUpgrades[key] = +(tempUpgrades[key] + bump).toFixed(2);
      count++;
    }
    return count;
  };

  // Calculate total cost for buying N levels of a hero
  const bulkHeroCost = (hero, count) => {
    let total = 0;
    const tempHero = { ...hero };
    for (let i = 0; i < count; i++) {
      total += heroCost(tempHero);
      tempHero.level++;
    }
    return total;
  };

  // Calculate how many hero levels we can afford
  const maxAffordableHero = (hero) => {
    let count = 0;
    let gold = state.gold;
    const tempHero = { ...hero };
    while (count < 1000) {
      const cost = heroCost(tempHero);
      if (gold < cost) break;
      gold -= cost;
      tempHero.level++;
      count++;
    }
    return count;
  };

  const effectiveBuyCount = (key, isHero, hero) => {
    if (buyAmount === 'max') {
      return isHero ? maxAffordableHero(hero) : maxAffordableUpgrades(key);
    }
    return buyAmount;
  };

  const handleUpgrade = (key) => {
    const count = effectiveBuyCount(key, false);
    if (count <= 0) return;
    const totalCost = bulkUpgradeCost(key, count);
    if (state.gold < totalCost) return;
    setState(prev => {
      const bump = { tap: 1, gold: 0.20, idle: 0.22, critC: 1, critM: 1 }[key] ?? 1;
      const newUpgrades = { ...prev.upgrades, [key]: +(prev.upgrades[key] + bump * count).toFixed(2) };
      addLog(`Bought ${count}× upgrade: ${key}`);
      return { ...prev, gold: prev.gold - totalCost, upgrades: newUpgrades };
    });
  };

  const handleHeroUpgrade = (heroId) => {
    const hero = state.heroes.find(h => h.id === heroId);
    if (!hero) return;
    if (state.stage < hero.unlockStage) return;
    const count = effectiveBuyCount(null, true, hero);
    if (count <= 0) return;
    const totalCost = bulkHeroCost(hero, count);
    if (state.gold < totalCost) return;
    setState(prev => {
      const newHeroes = prev.heroes.map(h => h.id === heroId ? { ...h, level: h.level + count } : h);
      addLog(`Upgraded ${hero.name} to Lv ${hero.level + count}`);
      return { ...prev, gold: prev.gold - totalCost, heroes: newHeroes };
    });
  };

  const upgradeList = [
    {
      key: 'tap',
      title: 'Tap Training',
      desc: 'Each session increases your flat tap damage base.',
      effect: () => `Sessions: ${state.upgrades.tap} (base: ${(state.tapBase + state.upgrades.tap * 0.5).toFixed(1)})`,
    },
    {
      key: 'idle',
      title: 'Hero Discipline',
      desc: 'Increases hero DPS multiplier.',
      effect: () => `Current: ${state.upgrades.idle.toFixed(2)}×`,
    },
    {
      key: 'gold',
      title: 'Gold Magnet',
      desc: 'Increases gold earned from kills.',
      effect: () => `Current: ${state.upgrades.gold.toFixed(2)}×`,
    },
    {
      key: 'critC',
      title: 'Crit Chance',
      desc: 'Increases critical hit chance by 2% per level.',
      effect: () => `Bonus: +${(state.upgrades.critC - 1) * 2}%`,
    },
    {
      key: 'critM',
      title: 'Crit Multiplier',
      desc: 'Increases critical hit multiplier by 0.5× per level.',
      effect: () => `Bonus: +${((state.upgrades.critM - 1) * 0.5).toFixed(1)}×`,
    },
  ];

  const unlockedMilestones = MILESTONES.filter(m => state.stage >= m.unlockStage);

  // Computed values used by Ascension tab
  const su = state.shardUpgrades ?? {};
  const earn = prestigeEarned(state.stage, state.substage, su);
  const gMult = globalMult(state.shards);
  const tapDmg = tapDamage(state.tapLevel, state.tapBase, state.upgrades, state.shards, state.skillActiveUntil, state.milestones, su);
  const hDps = heroDps(state.heroes, state.upgrades, state.shards, state.skillActiveUntil, state.milestones, su, state);
  const critChance = effectiveCritChance(state);
  const critMult = effectiveCritMult(state);
  const goldMult = state.upgrades.gold * (1 + (su.goldBonus ?? 0) * 0.25) * (state.milestones?.goldVein ? 1.30 : 1);
  const bossGoldMult = goldMult * (1 + (su.bossBane ?? 0) * 0.20);

  const buyLabel = buyAmount === 'max' ? 'Max' : `×${buyAmount}`;

  return (
    <div>

      {/* ── Buy Amount Toggle ── */}
      {(activeTab === 'upgrades' || activeTab === 'heroes') && (
        <div className="buy-toggle">
          {[1, 5, 10, 'max'].map(amt => (
            <button
              key={amt}
              className={`buy-toggle__btn${buyAmount === amt ? ' buy-toggle__btn--active' : ''}`}
              onClick={() => setBuyAmount(amt)}
            >
              {amt === 'max' ? 'Max' : `×${amt}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Upgrades Tab ── */}
      {activeTab === 'upgrades' && (
        <div>
          {upgradeList.map(u => {
            const count = effectiveBuyCount(u.key, false);
            const totalCost = count > 0 ? bulkUpgradeCost(u.key, count) : 0;
            const canAfford = count > 0 && state.gold >= totalCost;
            return (
              <div key={u.key} className="upgrade-item">
                <div className="upgrade-item__info">
                  <div className="upgrade-item__title">{u.title}</div>
                  <div className="upgrade-item__desc">{u.desc}</div>
                  <div className="upgrade-item__effect">{u.effect()}</div>
                </div>
                <button
                  className={`btn${canAfford ? ' primary' : ''}`}
                  disabled={!canAfford}
                  onClick={() => handleUpgrade(u.key)}
                >
                  {count > 0 ? `${fmt(totalCost)}g` : fmt(0) + 'g'}
                  {count > 1 && <span className="buy-count"> ×{count}</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Heroes Tab ── */}
      {activeTab === 'heroes' && (
        <div>
          {state.heroes.filter((h, i, arr) => {
            const unlocked = state.stage >= h.unlockStage;
            const isNextLocked = !unlocked && (i === 0 || state.stage >= arr[i - 1].unlockStage);
            return unlocked || isNextLocked;
          }).map(h => {
            const unlocked = state.stage >= h.unlockStage;
            const count = unlocked ? effectiveBuyCount(null, true, h) : 0;
            const totalCost = count > 0 ? bulkHeroCost(h, count) : 0;
            const canAfford = unlocked && count > 0 && state.gold >= totalCost;
            const currentDps = h.level > 0
              ? h.baseDps * Math.pow(h.dpsMultPerLevel, h.level - 1)
                * state.upgrades.idle * gMult
                * (now() < state.skillActiveUntil ? 2.0 : 1.0)
              : 0;
            return (
              <div key={h.id} className="upgrade-item">
                <div className="upgrade-item__info">
                  <div className="upgrade-item__title">
                    {h.name} <span className="muted">Lv {h.level}</span>
                  </div>
                  <div className="upgrade-item__desc">
                    {unlocked
                      ? <>Idle DPS. Contribution: <b>{fmt(currentDps)}</b>/s</>
                      : `Unlocks at Stage ${h.unlockStage}`}
                  </div>
                </div>
                <button
                  className={`btn${canAfford ? ' primary' : ''}`}
                  disabled={!canAfford}
                  onClick={() => handleHeroUpgrade(h.id)}
                >
                  {unlocked
                    ? <>{fmt(totalCost)}g{count > 1 && <span className="buy-count"> ×{count}</span>}</>
                    : `Stage ${h.unlockStage}`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Skills Tab ── */}
      {activeTab === 'skills' && (
        <div>
          <p className="tiny muted" style={{ marginBottom: '12px' }}>
            Upgrade skill durations with Shards (◆). Activate skills from the combat area.
          </p>
          {SKILLS.map(skill => {
            const t = now();
            const isActive   = t < (state[skill.activeUntilKey]   ?? 0);
            const onCooldown = !isActive && t < (state[skill.cooldownUntilKey] ?? 0);
            const currentDuration = effectiveSkillDuration(skill, state.shardUpgrades) / 1000;
            const durLevel   = state.shardUpgrades?.[skill.durationUpgradeKey] ?? 0;
            const maxDurLevel = 30 - skill.baseDuration;
            const isDurUnlocked = !!(state.shardUpgradeUnlocked?.[skill.durationUpgradeKey]);
            const unlockedCount = Object.values(state.shardUpgradeUnlocked ?? {}).filter(Boolean).length;
            const unlockCost = shardUpgradeUnlockCost(unlockedCount);
            const durCost = shardUpgradeCost(skill.durationUpgradeKey, durLevel);
            return (
              <div key={skill.key} className="upgrade-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div className="split">
                  <div>
                    <div className="upgrade-item__title">{skill.name}</div>
                    <div className="upgrade-item__desc">{skill.desc}</div>
                    <div className="upgrade-item__effect">
                      {currentDuration}s duration · {skill.cooldown / 1000}s CD
                      {durLevel > 0 && ` (Lv ${durLevel})`}
                      {' · '}
                      <span style={{ color: isActive ? 'var(--green)' : onCooldown ? 'var(--red)' : 'var(--muted)' }}>
                        {isActive
                          ? `Active ${Math.ceil((state[skill.activeUntilKey] - t) / 1000)}s`
                          : onCooldown
                            ? `CD ${Math.ceil((state[skill.cooldownUntilKey] - t) / 1000)}s`
                            : 'Ready'}
                      </span>
                    </div>
                  </div>
                  <button
                    className={`btn${isActive ? ' primary' : ''}`}
                    onClick={() => activateSkill(skill)}
                    disabled={isActive || onCooldown}
                  >
                    {isActive ? 'Active' : 'Activate'}
                  </button>
                </div>
                {durLevel < maxDurLevel && (
                  <div className="split">
                    <span className="tiny muted">Duration upgrade</span>
                    {isDurUnlocked ? (
                      <button
                        className="btn"
                        disabled={state.shards < durCost}
                        onClick={() => buyShardUpgrade(skill.durationUpgradeKey)}
                      >
                        +1s ({durCost}◆)
                      </button>
                    ) : (
                      <button
                        className="btn"
                        disabled={state.shards < unlockCost}
                        onClick={() => unlockShardUpgrade(skill.durationUpgradeKey)}
                      >
                        Unlock ({unlockCost}◆)
                      </button>
                    )}
                  </div>
                )}
                {durLevel >= maxDurLevel && (
                  <span className="tiny muted">Duration maxed at 30s</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Ascension Tab ── */}
      {activeTab === 'ascension' && (
        <div>
          {/* Prestige Card */}
          <div className="prestige-card">
            <div className="prestige-card__title">⚡ Ascend</div>
            <p className="prestige-card__desc">
              Reset your run to gain permanent Ascension Shards.
              Each shard grants +10% global damage permanently.
            </p>
            <button
              className="btn danger"
              onClick={handlePrestige}
              disabled={earn <= 0}
              style={{ width: '100%' }}
            >
              Ascend — Earn {fmt(earn)} Shards
            </button>
            <p className="prestige-card__preview">
              Current global bonus: <b>+{((gMult - 1) * 100).toFixed(0)}%</b>
              {' from '}<b>{state.shards}</b> shards
            </p>
          </div>

          {/* Shard Upgrades */}
          <div className="panel-section-title">Permanent Upgrades (◆ Shards)</div>
          <p className="tiny muted" style={{ marginBottom: '10px' }}>
            Unlock new upgrades first, then level them up. Survive prestige resets.
          </p>
          {(() => {
            const unlockedCount = Object.values(state.shardUpgradeUnlocked ?? {}).filter(Boolean).length;
            const nextUnlockCost = shardUpgradeUnlockCost(unlockedCount);
            return SHARD_UPGRADES.filter(u => !u.isDurationUpgrade).map(u => {
              const isUnlocked = !!(state.shardUpgradeUnlocked?.[u.key]);
              const level = state.shardUpgrades[u.key] ?? 0;
              const levelCost = shardUpgradeCost(u.key, level);
              return (
                <div key={u.key} className="upgrade-item" style={{ opacity: isUnlocked ? 1 : 0.65 }}>
                  <div className="upgrade-item__info">
                    <div className="upgrade-item__title">
                      {!isUnlocked && <span style={{ marginRight: '5px' }}>🔒</span>}
                      {u.name}
                      {isUnlocked && <span className="muted"> Lv {level}</span>}
                    </div>
                    <div className="upgrade-item__desc">{u.desc}</div>
                  </div>
                  {isUnlocked ? (
                    <button
                      className="btn"
                      disabled={state.shards < levelCost}
                      onClick={() => buyShardUpgrade(u.key)}
                    >
                      {levelCost}◆
                    </button>
                  ) : (
                    <button
                      className="btn"
                      disabled={state.shards < nextUnlockCost}
                      onClick={() => unlockShardUpgrade(u.key)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Unlock {nextUnlockCost}◆
                    </button>
                  )}
                </div>
              );
            });
          })()}

          {/* Stats Toggle */}
          <button className="stats-toggle" onClick={() => setStatsOpen(o => !o)}>
            <span>📊 View Stats</span>
            <span>{statsOpen ? '▲' : '▼'}</span>
          </button>
          {statsOpen && (
            <div className="stats-content">
              <div className="stat-section-title">Offensive</div>
              <div className="stat-row">
                <span className="stat-row__label">Tap Damage</span>
                <b className="stat-row__value">{fmt(tapDmg)}</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Hero DPS</span>
                <b className="stat-row__value">{fmt(hDps)}/s</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Crit Chance</span>
                <b className="stat-row__value">{Math.round(critChance * 100)}%</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Crit Multiplier</span>
                <b className="stat-row__value">{critMult.toFixed(1)}×</b>
              </div>
              <div className="stat-section-title">Economy</div>
              <div className="stat-row">
                <span className="stat-row__label">Gold Multiplier</span>
                <b className="stat-row__value">{goldMult.toFixed(2)}×</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Boss Gold</span>
                <b className="stat-row__value">{bossGoldMult.toFixed(2)}×</b>
              </div>
              <div className="stat-section-title">Ascension</div>
              <div className="stat-row">
                <span className="stat-row__label">Shards Held</span>
                <b className="stat-row__value">{fmt(state.shards)}</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Global Power</span>
                <b className="stat-row__value">+{((gMult - 1) * 100).toFixed(0)}%</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Ascend Now</span>
                <b className="stat-row__value">+{earn} shards</b>
              </div>
              <div className="stat-section-title">Progress</div>
              <div className="stat-row">
                <span className="stat-row__label">Highest Stage</span>
                <b className="stat-row__value">{state.highestStage ?? 1}</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Total Taps</span>
                <b className="stat-row__value">{fmt(state.totalTaps ?? 0)}</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Ascensions</span>
                <b className="stat-row__value">{state.ascensionCount ?? 0}</b>
              </div>
              <div className="stat-row">
                <span className="stat-row__label">Lifetime Gold</span>
                <b className="stat-row__value">{fmt(state.lifetimeGold)}</b>
              </div>
              <div className="stat-section-title">
                Achievements ({ACHIEVEMENTS.filter(a => state.achievements?.[a.key]).length}/{ACHIEVEMENTS.length})
              </div>
              {ACHIEVEMENTS.map(a => {
                const earned = !!(state.achievements?.[a.key]);
                return (
                  <div key={a.key} className="stat-row" style={{ opacity: earned ? 1 : 0.4 }}>
                    <span className="stat-row__label">
                      {earned ? '\u2713 ' : '\u2022 '}{a.name}
                    </span>
                    <span className="stat-row__value" style={{ fontWeight: 400, fontSize: '11px', color: 'var(--muted)' }}>
                      {a.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Settings inside Ascension tab */}
          <div style={{ marginTop: '16px' }}>
            <SettingsSection state={state} setState={setState} addLog={addLog} spawnEnemy={spawnEnemy} />
          </div>
        </div>
      )}

      {/* ── Milestones Tab ── */}
      {activeTab === 'milestones' && (
        <div>
          {unlockedMilestones.length === 0 ? (
            <div className="item">
              <p className="tiny muted">
                No milestones unlocked yet. Reach Stage {MILESTONES[0].unlockStage} to unlock the first one.
              </p>
            </div>
          ) : (
            unlockedMilestones.map(m => {
              const bought = state.milestones[m.key];
              return (
                <div key={m.key} className="upgrade-item">
                  <div className="upgrade-item__info">
                    <div className="upgrade-item__title">
                      {m.name}
                      {bought && <span className="pill pill--gold" style={{ marginLeft: '6px' }}>Owned</span>}
                    </div>
                    <div className="upgrade-item__desc">{m.desc}</div>
                  </div>
                  <button
                    className={`btn${!bought && state.gold >= m.goldCost ? ' primary' : ''}`}
                    disabled={bought || state.gold < m.goldCost}
                    onClick={() => buyMilestone(m.key)}
                  >
                    {bought ? '✓' : `${fmt(m.goldCost)}g`}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}

export default UpgradeSection;
