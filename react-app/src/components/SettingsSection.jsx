import { save, load, reset } from '../utils/storage.js';
import { defaultState } from '../utils/gameState.js';
import { now } from '../utils/gameLogic.js';

function SettingsSection({ state, setState, addLog, spawnEnemy }) {
  const handleSave = () => {
    if (save(state)) {
      addLog("Game saved.");
    }
  };

  const handleLoad = () => {
    const loaded = load();
    if (loaded) {
      setState({ ...loaded, lastTick: now() });
      spawnEnemy();
      addLog("Game loaded.");
    } else {
      addLog("No saved game found.");
    }
  };

  const handleReset = () => {
    reset();
    setState(defaultState());
    addLog("Hard reset complete.");
    spawnEnemy();
  };

  return (
    <div className="item">
      <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Settings</h3>
      <div className="row">
        <button className="btn" onClick={handleSave}>Save</button>
        <button className="btn" onClick={handleLoad}>Load</button>
        <button className="btn" onClick={handleReset}>Hard Reset</button>
      </div>
      <div className="tiny muted">Autosaves every 15 seconds.</div>
    </div>
  );
}

export default SettingsSection;