import { fmt, tapDamage, heroDps, globalMult } from '../utils/gameLogic.js';

function StatsBar({ state }) {
  const tapDmg = tapDamage(state.tapLevel, state.tapBase, state.upgrades, state.shards, state.skillActiveUntil);
  const hDps = heroDps(state.heroes, state.upgrades, state.shards, state.skillActiveUntil);
  const gMult = globalMult(state.shards);

  return (
    <>
      <div className="row">
        <div>
          <div className="stat">Gold</div>
          <div className="big">{fmt(state.gold)}</div>
        </div>
        <div>
          <div className="stat">Stage</div>
          <div className="big"><span>{state.stage}</span><span className="muted"> / </span><span>{state.substage}</span></div>
        </div>
        <div>
          <div className="stat">Ascension Shards</div>
          <div className="big">{fmt(state.shards)}</div>
        </div>
      </div>

      <div className="row">
        <div className="pill">Tap DMG: <b>{fmt(tapDmg)}</b></div>
        <div className="pill">Hero DPS: <b>{fmt(hDps)}</b></div>
        <div className="pill">Crit: <b>{Math.round(state.critChance * 100)}%</b> × <b>{state.critMult}</b></div>
        <div className="pill">Global: <b>{gMult.toFixed(2)}×</b></div>
      </div>
    </>
  );
}

export default StatsBar;