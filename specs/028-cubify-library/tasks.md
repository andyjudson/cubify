# Tasks: 028 — cubify.js Library API

**Status**: Complete ✅
**Input**: spec.md, plan.md
**Tests**: Validated by Vitest suite at repo root `test/` (138 tests, 10 skipped, 0 failures)

---

## Phase 1: Setup

- [X] T001 Create `cubify/src/` directory at repo root
- [X] T002 Move and convert all `cubify-harness/src/*.js` files to `cubify/src/*.ts`
- [X] T003 Create `cubify/.gitignore` — `node_modules/`, `dist/`, `.claude/tmp/`

---

## Phase 2: New library files

- [X] T004 [P] Create `cubify/src/CubeScramble.ts` — pure JS scramble generator:
  - `FACES`, `SUFFIXES`, `OPPOSITE`, `AXIS` constants
  - `CubeScramble.random(length=20)` — filter-based selection, no retry loop
  - Axis exclusion: after two opposite-face moves, exclude entire axis (equivalent to cfop's two constraints combined)

- [X] T005 [P] Create `cubify/src/index.ts` — public entry point:
  - Exports: `CubeState`, `AlgParser`, `CubeScramble`, `CubeStickering`, `MASK_PRESETS`, `CubeRenderer3D`, `MOVE_AXIS`, `CubePlayer`, `CubeExporter`, `CubeRenderer2D`, `CubeRenderer2DOptions`
  - `CubeRenderer2D` is exported publicly (decision made during 028 — not internal)

- [X] T006 [P] Create `cubify/package.json` (single root package):
  - `"name": "cubify"`, `"version": "0.1.0"`, `"type": "module"`
  - `"main": "./src/index.ts"`
  - `"exports": { ".": { "import": "./src/index.ts", "types": "./types/index.d.ts" } }`
  - `"types": "./types/index.d.ts"`
  - dev/build scripts: `dev`, `build`, `test`, `test:watch`, `typecheck`
  - Removed harness `package.json` — node_modules consolidated at root

---

## Phase 3: Public API extensions [US1]

- [X] T007 Add `import { CubeStickering, MASK_PRESETS }` to `cubify/src/CubeRenderer3D.ts` (top of file)

- [X] T008 Add `CubeRenderer3D.setStickering(presetOrString)` method to `src/CubeRenderer3D.ts`:
  - Resolves label via `MASK_PRESETS.find(p => p.label === presetOrString)`
  - Falls through to orbit string if not found
  - Calls `fromOrbitStringWithState(str, null)` then `restoreColours()` + `applyStickering(visMap)`

- [X] T009 Add `CubeRenderer3D.snapshotAt(size?)` and `abortAnimation()` methods to `src/CubeRenderer3D.ts`:
  - Saves `pixelRatio`, CSS dimensions, `scene.background`
  - If `size`: `setPixelRatio(1)` + `setSize(size, size, false)`
  - Renders transparent frame; captures `domElement.toDataURL('image/png')`
  - Restores all saved values; returns data URL

- [X] T010 Add `CubePlayer.setupMoves` getter and `_generation` counter to `src/CubePlayer.ts`:
  - `get setupMoves()` — `return [...this._setupMoves]`
  - `private _generation: number` (init 0); incremented on `pause()` and `loadAlg()`
  - `_applyState()` calls `abortAnimation()` before `resetToSolved()` to avoid cubelet detach corruption
  - `_playNext()` captures `const gen = this._generation` before `animateMove`; callback checks `if (this._generation !== gen) return`

---

## Phase 4: TypeScript definitions [US2]

- [X] T011 Create `cubify/types/index.d.ts` with full definitions for public API:
  - `CubeState` — `solved()`, `applyMove/Alg`, `toFaceArray`, `isSolved`, `invertAlg`, `toRawPattern`
  - `AlgParser` — `parse(notation)`
  - `CubeScramble` — `random(length?)`
  - `CubeStickering`, `MASK_PRESETS`, `MaskPreset`, `VisValue`
  - `CubeRenderer3D`, `MOVE_AXIS`, `MoveAxisDef`, `CubeRenderer3DOptions`
  - `CubeRenderer2D`, `CubeRenderer2DOptions` (exported publicly)
  - `CubePlayer`, `LoadAlgOptions`, `PlayerEventName`, `MoveEventData`
  - `CubeExporter`, `ExportOptions`

---

## Phase 5: Rewire harness and tests [US3]

- [X] T012 Update `cubify-harness/index.html` imports: `'./src/X.js'` → `'../src/X.js'` (5 imports)

- [X] T013 Replace harness 3D export with `player.renderer.snapshotAt(EXPORT_SIZE)` — remove direct `_renderer`/`_scene`/`_camera` access

- [X] T014 Replace `player._setupMoves` in harness telemetry with `player.setupMoves`

- [X] T015 Migrate test files from `cubify-harness/test/*.test.js` to `test/*.test.ts` at repo root; update imports to use explicit `.ts` extension (`'../src/CubeRenderer3D.ts'` etc.) — Vite auto-remapping doesn't apply outside the harness project root

- [X] T016 Update `vi.mock` path in `test/cube-player.test.ts`: `'../src/CubeRenderer3D.ts'`; TypeScript-ify mock class (all methods as typed fields)

- [X] T017 Delete `cubify-harness/src/` directory and `cubify-harness/package.json`

---

## Phase 6: Skill and validation [US4]

- [X] T018 Create `.claude/commands/cubify.md` in cubify repo — `/cubify` skill pointing to `node cubify-scripts/cubify.mjs` from cubify repo root

- [X] T019 Run `npm test` at repo root — confirm 138 tests, 10 skipped, 0 failures

---

## Phase 7: Documentation

- [X] T020 Update `CLAUDE.md` — new library architecture table, status line, Recent Changes entry
- [X] T021 Update `specs/spec.md` — 028 status Planned → Complete, Completed section added, status table updated
- [X] T022 Update `README.md` — new Library section, cubify-harness section, status line
