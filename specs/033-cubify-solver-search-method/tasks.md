# Tasks: cubify-solver (032)

**Input**: Design documents from `specs/033-cubify-solver-search-method/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/solver-worker-protocol.md ✅
**Tests**: Vitest unit tests included for coordinate encoding and known solutions (library correctness gate)

**User Stories**:
- **US1** — Scramble: Random + WCA modes, case selector integration
- **US2** — Solve: IDA* worker, progress bar, event log output

---

## Phase 1: Setup

**Purpose**: Create solver module directory structure

- [X] T001 Create `packages/cubify/src/solver/` directory and stub files (`TwoPhase.ts`, `Coordinates.ts`, `MoveTables.ts`, `solver.worker.ts`) with empty exports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: State encoding and move tables — required by the IDA* search and unit tests. Both files are independent.

**⚠️ CRITICAL**: US2 (Solve) cannot begin until T002 and T003 are complete

- [X] T002 [P] Implement `Coordinates.ts` — CO (3^7), EO (2^11), UDSlice (C(12,4)), CP (8!), EP-slice (4!), EP-UDE (8!) encoding/decoding from `KPatternData` in `packages/cubify/src/solver/Coordinates.ts`
- [X] T003 [P] Implement `MoveTables.ts` — build 18-move × coordinate index tables using cubing.js `KTransformation` objects from `cube3x3x3`; one table per coordinate (CO, EO, UDSlice, CP, EP-slice, EP-UDE) in `packages/cubify/src/solver/MoveTables.ts`

**Checkpoint**: Coordinate encoding and move tables complete — IDA* implementation and unit tests can now begin

---

## Phase 3: User Story 1 — Scramble (Random + WCA)

**Goal**: Scramble button with Random/WCA toggle loads a scramble into `CubePlayer`; case selector shows `— scramble —`; WCA path uses twips via cubing.js

**Independent Test**: Press Scramble (Random mode) → cube renders scrambled, case selector shows `— scramble —`. Press Scramble (WCA mode) → event log shows `WCA scramble: generating…` then `WCA scramble: [alg] (Nms)`; cube renders scrambled. Select a named case → normal case mode restored.

- [X] T004 [P] [US1] Add `static wca(): Promise<string>` to `CubeScramble` — calls `randomScrambleForEvent('333')` from `cubing/scramble`, returns `.toString()` in `packages/cubify/src/CubeScramble.ts`
- [X] T005 [P] [US1] Add `— scramble —` placeholder `<option>` as first entry in the case `<select>`, and add Scramble button + Random/WCA radio toggle HTML structure to `cubify-harness/index.html`
- [X] T006 [US1] Export `CubeScramble.wca` from `packages/cubify/src/index.ts` (verify `CubeScramble` class already exported; no new export line needed if class is already exported — confirm and add if missing)
- [X] T007 [US1] Wire Scramble button in `cubify-harness/index.html`: Random mode calls `CubeScramble.random(20)`; WCA mode calls `CubeScramble.wca()` with button disabled during await; both paths call `player.loadAlg('', scramble)` and set selector to `— scramble —`; WCA path appends `WCA scramble: generating…` and `WCA scramble: [alg] (Nms)` to event log; selecting a named case restores normal mode (depends on T004, T005)

**Checkpoint**: Scramble fully functional — both modes tested, case selector integration confirmed

---

## Phase 4: User Story 2 — Solve (IDA* Worker)

**Goal**: Solve button runs 2-phase IDA* in a web worker; progress bar steps through depth 1–20; solution loads and plays; errors and depth events go to event log

**Independent Test**: Scramble the cube (any mode) → press Solve → progress bar increments through depths in the event log → solution alg animates on the cube → event log shows solution alg and elapsed ms. Press Solve on a solved cube → solution is `""` or trivial, plays immediately.

- [X] T008 [US2] Implement `TwoPhase.ts` — IDA* search using Phase 1 (CO+EO+UDSlice) and Phase 2 (CP+EP-slice+EP-UDE) pruning tables built from `MoveTables`; depth cap 20; yields depth via callback in `packages/cubify/src/solver/TwoPhase.ts` (depends on T002, T003)
- [X] T009 [US2] Implement `solver.worker.ts` — handle `solve`/`cancel` messages; call `TwoPhase.search()`; post `{ type: 'progress', depth }` at each depth; post `{ type: 'solution', alg, depth, elapsedMs }` or `{ type: 'error', reason, message, elapsedMs }`; enforce ~10s timeout in `packages/cubify/src/solver/solver.worker.ts` (depends on T008)
- [X] T010 [US2] Implement `CubeSolver.ts` — `available: boolean`, `solve(state, options?): Promise<SolveResult>`, `cancel()`, `dispose()`; construct worker via `new Worker(new URL('./solver/solver.worker.ts', import.meta.url), { type: 'module' })`; if construction throws set `available = false`; wire `onProgress` callback to progress messages in `packages/cubify/src/CubeSolver.ts` (depends on T009)
- [X] T011 [US2] Export `CubeSolver` and `SolveResult`/`SolverOptions` types from `packages/cubify/src/index.ts` (depends on T010)
- [X] T012 [US2] Add Solve button + `<progress max="20" value="0">` HTML structure to `cubify-harness/index.html`; instantiate `CubeSolver` once on page load; disable Solve button if `!solver.available` with event log entry `Solver unavailable` (depends on T010, T005)
- [X] T013 [US2] Wire Solve button in `cubify-harness/index.html`: call `solver.solve(player.state)`; update progress bar on each `progress` callback; on solution call `player.loadAlg(alg)` and play, append `Solver: [alg] (Nms)` to event log, reset progress bar; on error re-enable button, reset progress bar, append error reason to event log; append `Solver: searching depth N…` for each depth progress event (depends on T012)
- [X] T014 [P] [US2] Write Vitest unit tests in `packages/cubify/test/cube-solver.test.ts`: coordinate round-trips for solved state and each single-move state; move table correctness for R and U (verify against `CubeState.applyMove` ground truth); assert `TwoPhase.search(solved)` returns `""` (depends on T002, T003)

**Checkpoint**: Solve fully functional — scramble then solve animates correctly; event log shows depth progress and solution; timeout test passes

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Verification, documentation, export completeness

- [X] T015 Run `verify-perms.mjs` from `cubify-harness/` and confirm all 18 permutation cross-checks pass (no regressions from new cubing.js imports in `CubeScramble.ts`)
- [X] T016 [P] Update `CLAUDE.md` module table: add `CubeSolver.ts` row; update `CubeScramble.ts` row to note `wca()` async method

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — T002 and T003 run in parallel; BLOCKS T008 and T014
- **Phase 3 (US1 — Scramble)**: T004 and T005 can start after Phase 1 (independent of Phase 2); T006 after T004; T007 after T004+T005
- **Phase 4 (US2 — Solve)**: T008 after T002+T003; T009→T010→T011 sequential; T012 after T010+T005; T013 after T012; T014 after T002+T003 (parallel with T008)
- **Phase 5 (Polish)**: After all implementation complete

### User Story Dependencies

- **US1 (Scramble)**: Independent of Phase 2 — can start after Phase 1. T004 and T005 parallel.
- **US2 (Solve)**: Depends on Phase 2 (T002, T003). T014 tests can run in parallel with T008.

### Parallel Opportunities

```
Phase 2:   T002 ──┐
           T003 ──┤── T008 ── T009 ── T010 ── T011
                  └── T014

Phase 3:   T004 ──┐
           T005 ──┤── T007    T006 (trivial, after T004)
```

---

## Implementation Strategy

### MVP (US1 first — no solver complexity)

1. Complete Phase 1 (T001)
2. Add `CubeScramble.wca()` and harness UI for scramble (T004–T007)
3. **Validate**: both scramble modes work, case selector integrates, event log outputs correctly
4. Then proceed to Phase 2 + US2 (solver)

### Full delivery

1. Phase 1 → Phase 2 (T002+T003 in parallel) → Phase 3 (scramble) → Phase 4 (solve) → Phase 5

---

## Notes

- Harness imports directly from `../packages/cubify/src/` — no build step needed during development
- `CubeScramble.wca()` adds a cubing.js import to the library; verify `cubing/scramble` is accessible via the existing `cubing` devDependency in root `package.json`
- Worker path `new URL('./solver/solver.worker.ts', import.meta.url)` works in Vite dev (harness) and will need `?worker` or equivalent for any bundled consumer — document this in `CubeSolver.ts`
- `randomScrambleForEvent` is async and lazy-loads twips WASM on first call; subsequent calls are fast (~50 ms) — no special handling needed beyond `await`
