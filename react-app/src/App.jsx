import CombatSection from './components/CombatSection.jsx';
import UpgradeSection from './components/UpgradeSection.jsx';
import { useGameState } from './hooks/useGameState.js';

function App() {
  const { state, setState, enemy, log, tap, addLog, spawnEnemy } = useGameState();

  return (
    <div className="wrap">
      <h1>Idle Ascension (MVP)</h1>

      <div className="grid">
        <CombatSection
          state={state}
          setState={setState}
          enemy={enemy}
          log={log}
          tap={tap}
          addLog={addLog}
          spawnEnemy={spawnEnemy}
        />

        <UpgradeSection
          state={state}
          setState={setState}
          addLog={addLog}
          spawnEnemy={spawnEnemy}
        />
      </div>
    </div>
  );
}

export default App;
