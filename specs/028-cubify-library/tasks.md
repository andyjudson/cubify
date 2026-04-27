# Tasks: 028 — cubify.js Library API

**Status**: Complete ✅
**Input**: spec.md, plan.md
**Tests**: Validated by existing 027 Vitest suite (138 tests all pass)

---

## Phase 1: Setup

- [X] T001 Create `cubify/src/` directory at repo root
- [X] T002 Copy all `cubify-harness/src/*.js` files to `cubify/src/`
- [X] T003 Create `cubify/.gitignore` — `node_modules/`, `dist/`, `.claude/tmp/`

---

## Phase 2: New library files

- [X] T004 [P] Create `cubify/src/CubeScramble.js` — pure JS scramble generator:
  - `FACES`, `SUFFIXES`, `OPPOSITE`, `AXIS` constants
  - `CubeScramble.random(length=20)` — filter-based selection, no retry loop
  - Axis exclusion: after two opposite-face moves, exclude entire axis (equivalent to cfop's two constraints combined)

- [X] T005 [P] Create `cubify/src/index.js` — public entry point:
  - Exports: `CubeState`, `AlgParser`, `CubeScramble`, `CubeStickering`, `MASK_PRESETS`, `CubeRenderer3D`, `MOVE_AXIS`, `CubePlayer`, `CubeExporter`
  - `CubeRenderer2D` intentionally omitted (internal implementation detail)

- [X] T006 [P] Create `cubify/package.json`:
  - `"name": "cubify"`, `"version": "0.1.0"`, `"type": "module"`
  - `"main": "./src/index.js"`
  - `"exports": { ".": { "import": "./src/index.js", "types": "./types/cubify.d.ts" } }`
  - `"types": "./types/cubify.d.ts"`
  - `"peerDependencies"`: cubing, three

---

## Phase 3: Public API extensions [US1]

- [X] T007 Add `import { CubeStickering, MASK_PRESETS }` to `cubify/src/CubeRenderer3D.js` (top of file)

- [X] T008 Add `CubeRenderer3D.setStickering(presetOrString)` method:
  - Resolves label via `MASK_PRESETS.find(p => p.label === presetOrString)`
  - Falls through to orbit string if not found
  - Calls `fromOrbitStringWithState(str, null)` then `restoreColours()` + `applyStickering(visMap)`

- [X] T009 Add `CubeRenderer3D.snapshotAt(size?)` method:
  - Saves `pixelRatio`, CSS dimensions, `scene.background`
  - If `size`: `setPixelRatio(1)` + `setSize(size, size, false)`
  - Renders transparent frame; captures `domElement.toDataURL('image/png')`
  - Restores all saved values; returns data URL

- [X] T010 Add `CubePlayer.setupMoves` getter — `return [...this._setupMoves]`

---

## Phase 4: TypeScript definitions [US2]

- [X] T011 Create `cubify/types/cubify.d.ts` with full definitions for public API:
  - `CubeState` — `solved()`, `applyMove/Alg`, `toFaceArray`, `isSolved`, `invertAlg`, `toRawPattern`
  - `AlgParser` — `parse(notation)`
  - `CubeScramble` — `random(length?)`
  - `CubeStickering`, `MASK_PRESETS`, `MaskPreset`, `VisValue`
  - `CubeRenderer3D`, `MOVE_AXIS`, `MoveAxisDef`, `CubeRenderer3DOptions`
  - `CubePlayer`, `LoadAlgOptions`, `PlayerEventName`, `MoveEventData`
  - `CubeExporter`, `ExportOptions`

---

## Phase 5: Rewire harness and tests [US3]

- [X] T012 Update `cubify-harness/index.html` imports: `'./src/X.js'` → `'../src/X.js'` (5 imports)

- [X] T013 Replace harness 3D export with `player.renderer.snapshotAt(EXPORT_SIZE)` — remove direct `_renderer`/`_scene`/`_camera` access

- [X] T014 Replace `player._setupMoves` in harness telemetry with `player.setupMoves`

- [X] T015 Update all test file imports: `'../src/X.js'` → `'../../src/X.js'` (7 files via sed)

- [X] T016 Update `vi.mock` path in `cube-player.test.js`: `'../src/CubeRenderer3D.js'` → `'../../src/CubeRenderer3D.js'`

- [X] T017 Delete `cubify-harness/src/` directory

---

## Phase 6: Skill and validation [US4]

- [X] T018 Create `.claude/commands/cubify.md` in cubify repo — `/cubify` skill pointing to `node cubify-scripts/cubify.mjs` from cubify repo root

- [X] T019 Run `npm test` in `cubify-harness/` — confirm 138 tests pass, 0 failures

---

## Phase 7: Documentation

- [X] T020 Update `CLAUDE.md` — new library architecture table, status line, Recent Changes entry
- [X] T021 Update `specs/spec.md` — 028 status Planned → Complete, Completed section added, status table updated
- [X] T022 Update `README.md` — new Library section, cubify-harness section, status line
