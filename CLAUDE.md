# CLAUDE.md — Incremental-Clicker (Idle Ascension MVP)

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**Idle Ascension (MVP)** is a browser-based incremental/idle clicker game built with React 19 and Vite. Players tap to damage enemies, hire heroes that deal passive DPS, purchase upgrades, and eventually prestige (ascend) to earn permanent shard bonuses and start over with a stronger multiplier.

The entire application lives inside the `react-app/` subdirectory.

---

## Repository Layout

```
Incremental-Clicker/
├── CLAUDE.md                    # This file
└── react-app/                   # All application code
    ├── index.html               # HTML shell (title: "Idle Ascension (MVP)")
    ├── package.json             # npm scripts & dependencies
    ├── vite.config.js           # Vite build config (React plugin only)
    ├── eslint.config.js         # ESLint 9 flat config
    ├── .gitignore
    └── src/
        ├── main.jsx             # React entry point (strict mode)
        ├── App.jsx              # Root layout (2-column grid)
        ├── styles.css           # Primary stylesheet (dark theme, all active styles)
        ├── index.css            # Vite template CSS (minimal use)
        ├── App.css              # Vite template CSS (mostly inactive)
        ├── assets/
        │   └── react.svg
        ├── hooks/
        │   ├── useGameState.js       # Central game state hook — the main logic hub
        │   └── useGameState.test.js  # Unit tests for the game state hook
        ├── utils/
        │   ├── gameLogic.js          # Balance formulas, cost scaling, damage/reward math
        │   ├── gameLogic.test.js     # Unit tests for game logic formulas
        │   ├── gameState.js          # Default state shape (heroes, upgrades, milestones)
        │   ├── gameState.test.js     # Unit tests for default state
        │   ├── storage.js            # LocalStorage persistence & offline progress sim
        │   └── storage.test.js       # Unit tests for storage/persistence
        ├── test-setup.js             # Vitest/jsdom test environment setup
        └── components/
            ├── CombatSection.jsx    # Battle UI, prestige, game log
            ├── UpgradeSection.jsx   # Upgrades / Heroes / Ascension / Milestones tabs
            └── SettingsSection.jsx  # Save / Load / Hard Reset
```

---

## Technology Stack

| Layer | Choice |
|-------|--------|
| UI framework | React 19.2.0 (JSX) |
| Build tool | Vite 7.3.1 |
| Language | JavaScript (no TypeScript) |
| Styling | Vanilla CSS (one file: `styles.css`) |
| State management | React hooks (`useState`, `useRef`, `useCallback`, `useEffect`) |
| Persistence | Browser `localStorage` |
| Linting | ESLint 9 (flat config) |
| Testing | Vitest + @testing-library/react + @testing-library/jest-dom |

---

## Development Commands

All commands must be run from `react-app/`:

```bash
cd react-app

npm install        # Install dependencies
npm run dev        # Start dev server with HMR (Vite)
npm run build      # Production build → dist/
npm run preview    # Serve the production build locally
npm run lint       # Run ESLint
npm run test       # Run all tests (Vitest, single pass)
npm run test:watch # Run tests in watch mode
```

---

## Architecture & Data Flow

### State Ownership

All game state is owned by the `useGameState` hook (`src/hooks/useGameState.js`). It exposes:
- Current `gameState` and `enemyState` as plain objects
- Action callbacks: `tap`, `dealDamage`, `spawnEnemy`, `buyUpgrade`, `buyHero`, `buyShardUpgrade`, `buyMilestone`, `ascend`, `activateSkill`
- `gameLog` array (last 100 messages)

`App.jsx` calls `useGameState`, then passes state + callbacks down as props to `CombatSection` and `UpgradeSection`. There is no context or external state library.

### Game Tick

The tick loop runs via `requestAnimationFrame` inside `useGameState`. Every frame it:
1. Accumulates hero DPS over elapsed time
2. Calls `dealDamage` if enough damage has accumulated
3. Handles boss timer countdown and escape logic

A `useRef` mirror of `gameState` (`gameStateRef`) ensures the rAF callback always reads the latest state without needing to be recreated on every render.

### Persistence

- **Auto-save:** Every 15 seconds to `localStorage` key `idle_ascension_mvp_v1`
- **Load:** Saved state is merged with the default state (safe for future new fields)
- **Offline progress:** On load, up to 8 hours of hero DPS is simulated
- **Reset:** Clears the key and reinitializes to default state

---

## Game Mechanics Reference

### Stage Progression
- Each stage has 10 substages (`SUBSTAGES_PER_STAGE = 10`)
- Substage 10 of every stage is a boss with a 20-second timer (`BOSS_TIME_LIMIT_MS = 20000`)
- Failing to kill the boss before the timer resets back to substage 1 of that stage

### Damage Formulas (from `gameLogic.js`)

```
tapDamage  = tapBase × 1.15^(tapLevel-1) × tapUpgrade × globalMult × skillMult × sharpening
heroDPS    = baseDps × dpsMultPerLevel^(level-1) × idleUpgrade × globalMult × skillMult × formation
globalMult = 1 + shards × 0.08          // 8% per ascension shard
critMult   = (5 + critUpgradeLevel × 0.5) × damage
```

### Enemy HP & Gold

```
enemyHP   = 10 × 1.35^(stage-1) × 1.07^(substage-1)
bossHP    = enemyHP × 14
goldReward = 2 × 1.28^(stage-1) × 1.04^(substage-1) × goldUpgrade × fortuneBonus × goldVein
bossGold  = goldReward × 8
```

### Upgrade Cost Scaling
- Main upgrades (tap/gold/idle/crit): `baseCost × 1.55^level`
- Hero levels: `baseCost × 1.45^level`
- Shard upgrades: exponential (defined per upgrade in `gameState.js`)

### Ascension (Prestige)
- Shards earned: `floor((highestStageReached / 40)^1.35)` + Prestige Mastery bonus
- Resets stage, substage, gold, heroes, and main upgrades
- Permanent bonuses remain (shards, shard upgrades, milestones)

### Heroes
| Hero | Unlocks at stage |
|------|-----------------|
| Squire | 1 |
| Archer | 8 |
| Mage | 18 |
| Paladin | 30 |
| Necromancer | 50 |

### Milestones (one-time gold purchases)
| Milestone | Stage unlock | Effect |
|-----------|-------------|--------|
| Sharpening Stone | 5 | +25% tap damage |
| Battle Formation | 15 | +20% hero DPS |
| Dragon's Luck | 25 | +5% crit chance |
| Gold Vein | 40 | +30% gold income |

---

## Code Conventions

- **No TypeScript** — plain `.js` / `.jsx` files throughout
- **Functional components only** — no class components
- **Co-located balance constants** — all tunable numbers live in `gameLogic.js` (not scattered across components)
- **Single stylesheet** — all active CSS is in `styles.css`; do not split styles into component modules
- **ESLint** — `react-hooks/exhaustive-deps` is enforced; `no-unused-vars` allows uppercase variables (e.g., React import-style patterns)
- **Imports** — relative paths only; no path aliases configured

### Naming
- Component files: `PascalCase.jsx`
- Utility/hook files: `camelCase.js`
- CSS classes: `kebab-case`
- Game state keys: `camelCase` flat object (no nested namespacing except `heroes[]` and `upgrades[]` arrays)

---

## Key Files to Read First

When investigating a bug or adding a feature, start with:

1. `src/hooks/useGameState.js` — understand state shape and tick loop before touching anything
2. `src/utils/gameLogic.js` — any balance/formula change goes here
3. `src/utils/gameState.js` — to see default state and add new persistent fields
4. The relevant component (`CombatSection`, `UpgradeSection`, etc.) for UI changes

---

## Common Tasks

### Adding a new upgrade
1. Add its default entry to the `upgrades` array in `gameState.js`
2. Add its cost/effect formulas to `gameLogic.js`
3. Wire the `buyUpgrade` action in `useGameState.js` if it needs special handling
4. Render it in `UpgradeSection.jsx`

### Adding a new hero
1. Add to the `heroes` array in `gameState.js` with `name`, `baseDps`, `dpsMultPerLevel`, `baseCost`, `unlockStage`
2. It will automatically be picked up by the DPS loop in `useGameState.js` and rendered in `UpgradeSection.jsx`

### Tuning balance
- All scaling constants are at the top of `gameLogic.js` as named constants — edit there only

### Adding persistence for a new field
- Add the field with a default value to `gameState.js`
- The merge-on-load logic in `storage.js` (`loadGame`) will safely handle it for existing saves

### Running tests
- `npm run test` — single-pass run via Vitest (CI-friendly)
- `npm run test:watch` — watch mode for development
- Test files live alongside the source they test (e.g., `gameLogic.test.js` next to `gameLogic.js`)
- When adding a new util or hook, add a corresponding `.test.js` file

---

## What to Avoid

- Do not move game logic into components — keep it in `gameLogic.js` and `useGameState.js`
- Do not add a state management library (Redux, Zustand, etc.) — the `useRef` + `useState` pattern is intentional for the rAF loop
- Do not split `styles.css` into per-component files — the project uses a single stylesheet by design
- Do not add TypeScript without discussing it first — all files are `.js`/`.jsx`
- Do not persist computed values (e.g., derived DPS) to localStorage — only source-of-truth state is saved
