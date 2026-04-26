# Tasks: 024 — CubePlayer Engine

**Input**: Design documents from `/specs/024-cubify-animation/`
**Source files**: spec.md, plan.md, research.md, data-model.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (no dependency on in-progress task)
- **[Story]**: User story label (US1 = CubePlayer module, US2 = harness wiring)
- Exact file paths included in all implementation tasks

---

## Phase 1: Setup

**Purpose**: File scaffold and dev environment check

- [X] T001 Confirm Vite dev server is running on port 5174 (`cd cubify-harness && npm run dev -- --host 127.0.0.1 --port 5174`); kill any stale process first
- [X] T002 Create empty `cubify-harness/src/CubePlayer.js` with ES module export scaffold (class stub, constructor signature)

---

## Phase 2: Foundational (blocking prerequisite for both stories)

**Purpose**: Event emitter and state computation — used by every CubePlayer method

⚠️ CRITICAL: US1 and US2 both depend on this phase completing first

- [X] T003 Implement event emitter in `cubify-harness/src/CubePlayer.js`: `_listeners: Map`, `on(event, cb)`, `off(event, cb)`, `emit(event, data)` — simple synchronous emitter, no third-party library
- [X] T004 Implement `_stateAt(n)` private method in `cubify-harness/src/CubePlayer.js`: returns `CubeState` computed as `_baseState.applyAlg([..._setupMoves, ..._moves.slice(0, n)])`; used by play, jumpTo, getters

**Checkpoint**: Emitter and state computation ready — US1 implementation can begin

---

## Phase 3: User Story 1 — CubePlayer Animation Engine (Priority: P1) 🎯 MVP

**Goal**: A fully functional `CubePlayer.js` module that manages the animation timeline, exposes events, and can be imported and driven from any consumer

**Independent Test**: Import CubePlayer in browser console, call `loadAlg("R U R' U R U2 R'", null, {anchor:'start'})`, call `play()` — cube should animate all 7 moves and fire `complete`; `move` events should log `{index, move, state}` after each step

### Implementation for User Story 1

- [X] T005 [US1] Implement constructor in `cubify-harness/src/CubePlayer.js`: accept `(container, options)`, create and mount `CubeRenderer3D`, store `_baseSpeedMs=300`, `_speedScale=1.0`, `_gapMs=60`, `_stickering=null`, `_stepIndex=0`, `_isPlaying=false`, `_moves=[]`, `_setupMoves=[]`, `_anchor='start'`
- [X] T006 [US1] Implement `async loadAlg(notation, setup, {anchor='start'}={})` in `cubify-harness/src/CubePlayer.js`: stop playback, parse notation via `AlgParser.parse()`, parse setup string if provided, compute `_baseState` via `CubeState.solved()`, set `_stepIndex=0`, call `_applyState(0)`, emit `reset`
- [X] T007 [US1] Implement `_applyState(n)` private method in `cubify-harness/src/CubePlayer.js`: `renderer.resetToSolved()`, `renderer.applyMovesInstant([..._setupMoves, ..._moves.slice(0,n)])`, `_reapplyStickering()` — used by loadAlg, jumpTo, reset
- [X] T008 [US1] Implement `play()` in `cubify-harness/src/CubePlayer.js`: guard if already playing or no moves; if `_stepIndex >= _moves.length` reset to 0; set `_isPlaying=true`; start `_playNext()` chain
- [X] T009 [US1] Implement `_playNext()` private method in `cubify-harness/src/CubePlayer.js`: if `!_isPlaying || _stepIndex >= _moves.length` → stop and emit `complete`; else call `renderer.animateMove(move, onDone)` where onDone increments `_stepIndex`, emits `move {index, move, state: _stateAt(_stepIndex)}`, then `setTimeout(_playNext, _gapMs)`
- [X] T010 [US1] Implement `pause()` in `cubify-harness/src/CubePlayer.js`: set `_isPlaying=false`; current animateMove completes naturally, chain does not continue
- [X] T011 [US1] Implement `jumpTo(n)` in `cubify-harness/src/CubePlayer.js`: clamp n to `[0, _moves.length]`; set `_stepIndex=n`; call `_applyState(n)` (resetToSolved + applyMovesInstant + reapplyStickering); no event emitted — caller reads `player.state`
- [X] T012 [US1] Implement `reset()` in `cubify-harness/src/CubePlayer.js`: call `pause()`, call `jumpTo(0)`, emit `reset`
- [X] T013 [US1] Implement `setSpeed(scale)` in `cubify-harness/src/CubePlayer.js`: clamp scale > 0; store `_speedScale=scale`; call `renderer.setSpeed(Math.round(_baseSpeedMs / scale))` immediately so next animateMove uses it
- [X] T014 [P] [US1] Implement `setStickering(str)` in `cubify-harness/src/CubePlayer.js`: store `_stickering=str` (null = clear); call `_reapplyStickering()` immediately
- [X] T015 [P] [US1] Implement `_reapplyStickering()` private method in `cubify-harness/src/CubePlayer.js`: call `renderer.restoreColours()`; if `_stickering` is set, compute visMap via `CubeStickering.fromOrbitStringWithState(_stickering, _stateAt(_stepIndex).toRawPattern())` then call `renderer.applyStickering(visMap)`
- [X] T016 [P] [US1] Implement public getters in `cubify-harness/src/CubePlayer.js`: `get state()` → `_stateAt(_stepIndex)`, `get renderer()` → `_renderer`, `get stepIndex()` → `_stepIndex`, `get isPlaying()` → `_isPlaying`, `get moveCount()` → `_moves.length`

**Checkpoint**: Load `CubePlayer.js` in harness, smoke-test via browser console — all methods should be callable and animation should run correctly before beginning US2

---

## Phase 4: User Story 2 — Harness Wiring (Priority: P2)

**Goal**: `index.html` refactored to drive entirely through `CubePlayer`; all existing UI controls (alg buttons, play/stop, prev/next, move tape, debug panel, speed, stickering, Moves tab) continue to function identically from the user's perspective

**Independent Test**: Open harness in browser; select Sune; click Play — all 7 moves animate with chip highlights; debug state panel updates each step; Pause stops cleanly; Prev/Next step through; speed buttons change pace; OLL stickering applies correctly; Moves tab trigger buttons still animate single moves

### Implementation for User Story 2

- [X] T017 [US2] Update imports in `cubify-harness/index.html`: add `import { CubePlayer } from './src/CubePlayer.js'`; remove `new CubeRenderer3D(...)` and `renderer.mount(container)`; create `const player = new CubePlayer(document.getElementById('cube-container'), { animSpeed: 300, debug: true })`
- [X] T018 [US2] Replace `loadAlg(idx)` function in `cubify-harness/index.html`: compute setup string (`alg.caseAlg ? ['z2',...CubeState.invertAlg(moves)].join(' ') : null`), call `await player.loadAlg(alg.notation, setup, { anchor: alg.caseAlg ? 'end' : 'start' })`; keep `currentAlgIndex`, `updateAlgButtons()`, `appendLog()`
- [X] T019 [US2] Wire `player.on('reset', ...)` in `cubify-harness/index.html`: handler calls `buildMoveTape()`, `updateStepLabel()`, `updateDebugState(player.state)`, resets `liveState = player.state`
- [X] T020 [US2] Wire `player.on('move', ({index, move, state}) => ...)` in `cubify-harness/index.html`: handler calls `updateStepLabel()`, `updateDebugState(state)`, `update2D(state)`, `appendLog(\`[sim] move: ${move} (${index}/${player.moveCount})\`)`
- [X] T021 [US2] Wire `player.on('complete', ...)` in `cubify-harness/index.html`: handler calls `stopPlay()` (updates btn-play/btn-stop disabled states), `appendLog('[sim] playback complete')`
- [X] T022 [US2] Replace `startPlay()` / `stopPlay()` in `cubify-harness/index.html`: `startPlay()` calls `player.play()`; `stopPlay()` calls `player.pause()`; keep btn-play/btn-stop disabled state management; remove old `isPlaying`, `animateStepForward`, `playNext` local code
- [X] T023 [US2] Replace `snapToStep()` and `updateStepLabel()` in `cubify-harness/index.html`: prev/next buttons call `player.jumpTo(player.stepIndex - 1)` / `player.jumpTo(player.stepIndex + 1)`; `updateStepLabel()` reads `player.stepIndex` to mark chips is-active/is-done/plain
- [X] T024 [US2] Wire reset and solved buttons in `cubify-harness/index.html`: `btn-reset` calls `player.reset()`; `btn-solved` calls `player.loadAlg('', null, {anchor:'start'})` or directly `player.jumpTo(0)` on empty alg — restore solved display
- [X] T025 [US2] Wire speed buttons in `cubify-harness/index.html`: change `renderer.setSpeed(ms)` calls to `player.setSpeed(300 / parseInt(btn.dataset.speed))` (maps 500→0.6, 300→1.0, 120→2.5); keep active-class toggle
- [X] T026 [US2] Wire stickering tab in `cubify-harness/index.html`: `applyOrbitString(str)` calls `player.setStickering(str)` and keeps `activeMask = str` for export use; clear button calls `player.setStickering(null)` and clears `activeMask`
- [X] T027 [US2] Wire Moves tab to `player.renderer` in `cubify-harness/index.html`: replace bare `renderer.` references in `applyLiveMove`, `btn-move-reset`, `btn-move-apply`, `btn-export-3d` with `player.renderer.`; keep `liveState` as harness-local variable
- [X] T028 [US2] Remove now-dead local state from `cubify-harness/index.html`: delete `isPlaying`, `stepIndex`, `currentMoves`, `currentSetupMoves`, `currentCaseState` variables; delete `animateStepForward()`, `snapToStep()`, `startPlay()` / `stopPlay()` function bodies (keep wrapper functions that delegate to `player`); verify no remaining references to deleted vars

---

## Phase 5: Polish & Validation

**Purpose**: Smoke-test all acceptance criteria, clean up, commit

- [X] T029 Validate all acceptance criteria in harness: play all ALGS; pause mid-sequence; resume; jumpTo 0 and N; setSpeed Slow/Normal/Fast; OLL mask on Sune case; Moves tab trigger buttons; debug panel updates; verify-perms.mjs passes (`node cubify-harness/verify-perms.mjs`)
- [X] T030 [P] Update `cubify-harness/CLAUDE.md` Recent Changes: mark feature 024 complete with CubePlayer.js summary; update status in `specs/spec.md` from Planned to Complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1
- **Phase 3 (US1 — CubePlayer)**: Depends on Phase 2 — BLOCKS Phase 4
- **Phase 4 (US2 — Harness wiring)**: Depends on Phase 3 complete and smoke-tested
- **Phase 5 (Polish)**: Depends on Phase 4 complete

### Within Phase 3 (US1)

Tasks T005→T016 must largely proceed in order since each method builds on the state initialized by the constructor and state-computation helpers:

```
T005 (constructor) → T006 (loadAlg) → T007 (_applyState) → T008 (play)
                                                           → T009 (_playNext)
                                                           → T010 (pause)
                                                           → T011 (jumpTo)
                                                           → T012 (reset)
                                                           → T013 (setSpeed)
T014 (setStickering) [P with T015, T016]
T015 (_reapplyStickering) [P with T014, T016]
T016 (getters) [P with T014, T015]
```

### Within Phase 4 (US2)

T017 (import swap) must complete first. Thereafter tasks largely follow the event-wiring order:

```
T017 (import/create player) → T018 (loadAlg)
                             → T019 (reset event)
                             → T020 (move event)
                             → T021 (complete event)
                             → T022 (play/pause)
                             → T023 (prev/next)
                             → T024 (reset/solved buttons)
                             → T025 (speed)
                             → T026 (stickering)
                             → T027 (Moves tab)
                             → T028 (dead code removal)
```

---

## Parallel Example: Phase 3 tail (T014–T016)

```bash
# After T013 (setSpeed), these three can be written simultaneously (different methods, same file):
Task: "T014 Implement setStickering(str) in CubePlayer.js"
Task: "T015 Implement _reapplyStickering() in CubePlayer.js"
Task: "T016 Implement public getters in CubePlayer.js"
```

---

## Implementation Strategy

### MVP First (Phase 1–3)

1. Phase 1: Create file scaffold
2. Phase 2: Event emitter + state computation
3. Phase 3: Full CubePlayer module
4. **STOP and smoke-test in browser console before touching index.html**
5. Phase 4: Harness wiring
6. Phase 5: Validate and commit

### Key Implementation Notes (from research.md)

- `loadAlg` is async — harness alg button handlers must `await player.loadAlg(...)` or fire-and-forget (safe after KPuzzle warmup)
- `animateMove` is non-interruptible — pause works by clearing `_isPlaying` before the next `_playNext()` call
- 3D stickering is NOT reapplied in `_playNext()` — only in `_applyState()` (jumpTo/reset/loadAlg) and `setStickering()`
- Speed: `effectiveMs = Math.round(300 / scale)` — harness speed buttons pass `300 / speedMs` as the scale
- Moves tab uses `player.renderer` directly — no CubePlayer API wrapping needed

---

## Summary

| Phase | Tasks | Story |
|---|---|---|
| Setup | T001–T002 | — |
| Foundation | T003–T004 | — |
| US1: CubePlayer module | T005–T016 | US1 |
| US2: Harness wiring | T017–T028 | US2 |
| Polish | T029–T030 | — |
| **Total** | **30 tasks** | |
