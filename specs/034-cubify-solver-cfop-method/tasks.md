# Tasks: CFOP Solver (034)

**Input**: Design documents from `specs/034-cubify-solver-cfop-method/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/CfopSolver.ts ✓

**Note**: `stages.length` is always **7** (cross + 4×F2L + oll + pll). The spec docs say "6" — that is a typo throughout; the 7-item label list is authoritative.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no inter-task dependencies)
- **[Story]**: US1 / US2 / US3 maps to spec.md user stories
- Paths are relative to repo root

---

## Phase 1: Setup

**Purpose**: Create the `cfop/` directory and file stubs so all subsequent tasks have clean targets.

- [X] T001 Create `packages/cubify/src/cfop/` directory with empty stub files: `cfop.worker.ts`, `CfopMoveTables.ts`, `CrossSolver.ts`, `F2lSolver.ts`, `OllSolver.ts`, `PllSolver.ts`, `CaseLibrary.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data structures and move tables that every stage solver depends on. Must complete before any US1 work.

**⚠️ CRITICAL**: All of Phase 3 is blocked until this phase is complete.

- [X] T002 Define `RawState` interface and `toRawState(kPatternData)` helper in `packages/cubify/src/cfop/CfopMoveTables.ts` — fields: `cornerPieces[8]`, `cornerOrient[8]`, `edgePieces[12]`, `edgeOrient[12]`
- [X] T003 Implement all 18-move permutation tables in `packages/cubify/src/cfop/CfopMoveTables.ts` — `CORNER_PIECES[18][8]`, `CORNER_ORIENT[18][8]`, `EDGE_PIECES[18][12]`, `EDGE_ORIENT[18][12]`; moves indexed as: 0=U,1=U',2=U2,3=R,4=R',5=R2,6=F,7=F',8=F2,9=D,10=D',11=D2,12=L,13=L',14=L2,15=B,16=B',17=B2; derive from cubing.js KPattern verified against `verify-perms.mjs` (depends on T002)
- [X] T004 Implement `CaseLibrary.ts` — port 57 OLL alg strings from `cubify-scripts/data/algs-cfop-oll.json` and 21 PLL alg strings from `cubify-scripts/data/algs-cfop-pll.json` as TypeScript arrays; compute OLL fingerprints (cornerOrient[0..3] + edgeOrient[0..3]) and PLL fingerprints (cornerPieces[0..3] + edgePieces[0..3]) at module init by applying inverse alg to solved state using `CfopMoveTables`; export `OLL_CASES: OllCase[]` and `PLL_CASES: PllCase[]` (depends on T003)

**Checkpoint**: Move tables verified, case library fingerprints computed — stage solvers can now be built.

---

## Phase 3: User Story 1 — Stage-Annotated CFOP Solution (Priority: P1) 🎯 MVP

**Goal**: `CfopSolver.solve(state)` returns a `CfopSolution` with 7 ordered `SolveStage` entries (cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll, pll); applying them in sequence from the input state produces the solved state.

**Independent Test**: `const s = await solver.solve(scrambledState); let st = s.stages.reduce((acc, stage) => stage.alg ? acc.applyAlg(stage.alg) : acc, scrambledState.applyAlg(s.setupAlg)); assert(st.isSolved())` for 20 different scrambles.

### Implementation for User Story 1

- [X] T005 Implement `CrossSolver.ts` — IDA* over `RawState` using `CfopMoveTables`; move set: all 18 moves; heuristic: `Math.ceil(misplacedCrossEdges / 4)` where misplaced = D-edge (pieces[4..7]) not in home slot or orientation ≠ 0; depth cap 9; export `solveCross(state: RawState): string` (depends on T003)
- [X] T006 Implement `F2lSolver.ts` — IDA* per slot; move set: 15 moves (all except D/D'/D2); goal: target slot solved AND cross edges intact AND earlier solved slots intact; heuristic: 0 if solved else 1; depth cap 12; slot definitions from data-model.md; export `solveF2l(state: RawState, solvedSlots: SolveStageLabel[]): Record<SolveStageLabel, string>` solving fr→fl→br→bl in order (depends on T003, T005)
- [X] T007 [P] Implement `OllSolver.ts` — extract U-layer fingerprint `[cornerOrient[0..3], edgeOrient[0..3]]`; try all 4 U-rotations against `OLL_CASES`; emit pre-AUF prefix (U/U'/U2 or empty) + case alg; skip if all 8 values are 0; export `solveOll(state: RawState): { alg: string; caseName: string; wcaId: number }` (depends on T003, T004)
- [X] T008 [P] Implement `PllSolver.ts` — extract U-layer fingerprint `[cornerPieces[0..3], edgePieces[0..3]]`; try all 4 U-rotations against `PLL_CASES`; emit pre-AUF prefix + case alg + final AUF suffix (computed by applying alg then checking which U-rotation fully aligns top layer); skip if fingerprint already matches identity; export `solvePll(state: RawState): { alg: string; caseName: string; wcaId: string }` (depends on T003, T004)
- [X] T009 Implement `cfop.worker.ts` — listen for `{ type: 'solve', patternStr, timeoutMs }` and `{ type: 'cancel' }`; extract `RawState` from `JSON.parse(patternStr)`; apply z2 to state; run Cross → F2L×4 → OLL → PLL in sequence; accumulate `SolveStage[]`; post `{ type: 'solution', solution }` or `{ type: 'error', reason, message }`; respect `_cancelled` flag between stages; set `busy` flag (depends on T005, T006, T007, T008)
- [X] T010 Implement `CfopSolver.ts` — mirrors `CubeSolver.ts`; spawn worker via `new Worker(new URL('./cfop/cfop.worker.ts', import.meta.url), { type: 'module' })`; `solve()` serialises state with `JSON.stringify(state.kPattern.patternData)` and returns a Promise resolved/rejected from worker messages; `cancel()` posts cancel message; `dispose()` terminates worker; export `CfopSolver`, `CfopSolution`, `SolveStage`, `SolveStageLabel`, `CfopSolverOptions` (depends on T009)
- [X] T011 Export `CfopSolver`, `CfopSolution`, `SolveStage`, `SolveStageLabel`, `CfopSolverOptions` from `packages/cubify/src/index.ts` (depends on T010)
- [X] T012 [P] Write cross solver tests in `packages/cubify/test/cfop-cross.test.ts` — test cross solved detection, heuristic values, known scramble → cross solution applies to solved state within depth 9, cross moves restore cross edges (depends on T005)
- [X] T013 [P] Write OLL recognition tests in `packages/cubify/test/cfop-oll.test.ts` — test all 57 cases recognised correctly (apply inverse alg to solved state, fingerprint should match), OLL skip case, all 4 U-rotations handled (depends on T007)
- [X] T014 [P] Write PLL recognition tests in `packages/cubify/test/cfop-pll.test.ts` — test all 21 cases recognised correctly, PLL skip case, final AUF computed correctly for each case (depends on T008)
- [X] T015 [P] Write F2L solver tests in `packages/cubify/test/cfop-f2l.test.ts` — test per-slot goal condition, cross-edge preservation, slot order independence (depends on T006)
- [X] T016 Run test suite — `npm test` from repo root; verify all existing 237 tests still pass plus new cfop tests pass (depends on T012, T013, T014, T015)

**Checkpoint**: Full CFOP solve works end-to-end. `solve(scrambledState)` returns a valid `CfopSolution` verified by re-applying all stages and checking `isSolved()`.

---

## Phase 4: User Story 2 — Per-Stage Replay in CubePlayer (Priority: P2)

**Goal**: Each `SolveStage` in the solution carries a `mask` label from `MASK_PRESETS` that consumers can pass directly to `player.setStickering()`. No new library code needed — this phase verifies correctness and documents the integration.

**Independent Test**: Load cross alg with cross mask, verify CubePlayer animates correctly; load OLL alg with oll-face-dim mask, verify top-face highlight.

### Implementation for User Story 2

- [X] T017 [US2] Verify mask labels in `cfop.worker.ts` match existing `MASK_PRESETS` keys in `packages/cubify/src/CubeStickering.ts` — cross → `'cross'`, f2l-* → `'f2l'`, oll → `'oll-face-dim'`, pll → `'pll-face-dim'`; confirm all 4 keys exist in MASK_PRESETS; fix any mismatches (depends on T009)
- [X] T018 [US2] Add end-to-end smoke test in `packages/cubify/test/cfop-solver.test.ts` — instantiate `CfopSolver`, solve 5 known scrambles, assert `stages.length === 7`, assert applying all stages produces solved state, assert each stage mask is a valid MASK_PRESETS key (depends on T011)

**Checkpoint**: All stage mask labels verified; end-to-end integration test passes.

---

## Phase 5: User Story 3 — Harness Integration (Priority: P3)

**Goal**: The harness has a "Solve (cfop)" button that runs the CFOP solver and plays back stages with automatic mask switching. Existing "Solve" button is relabelled "Solve (search)".

**Independent Test**: Scramble the cube in the harness, click "Solve (cfop)", verify four distinct animation stages with mask transitions.

### Implementation for User Story 3

- [X] T019 [US3] Relabel existing "Solve" button to "Solve (search)" in `cubify-harness/index.html`
- [X] T020 [US3] Add "Solve (cfop)" button to `cubify-harness/index.html` alongside existing solve button
- [X] T021 [US3] Implement `handleCfopSolve()` in `cubify-harness/index.html` — instantiate `CfopSolver` (once, on first use); call `solver.solve(currentState)`; iterate `solution.stages`; for each non-empty stage: `player.loadAlg(stage.alg, ...)` (passing scramble + z2 as setup for cross stage), `player.setStickering(stage.mask)`, await `complete` event; display `caseName`/`wcaId` for OLL/PLL stages (depends on T011, T020)

**Checkpoint**: Harness "Solve (cfop)" button works end-to-end with stage-by-stage animation and mask switching.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Run full test suite `npm test` and confirm all tests pass (no regressions in existing 237 tests)
- [X] T023 [P] Build packages — `npm run build --workspace=packages/cubify` and `npm run build --workspace=packages/cubify-react` — confirm TypeScript compilation succeeds with no errors
- [X] T024 Update `CLAUDE.md` Recent Changes section to reflect feature 034 completion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all US phases
- **Phase 3 (US1)**: Depends on Phase 2 completion — T005/T007/T008 can start in parallel; T006 needs T005; T009 needs T005+T006+T007+T008; T010 needs T009; T011 needs T010; tests can run after their target module
- **Phase 4 (US2)**: Depends on T009 (T017) and T011 (T018)
- **Phase 5 (US3)**: Depends on T011
- **Phase 6 (Polish)**: Depends on all preceding phases

### Within Phase 3 — Parallel Opportunities

```
T003 complete
  ├── T005 CrossSolver
  │     └── T006 F2lSolver ──────────────────────────────┐
  ├── T007 OllSolver (parallel with T005/T006) ──────────┤
  └── T008 PllSolver (parallel with T005/T006) ──────────┴── T009 cfop.worker.ts
                                                                   └── T010 CfopSolver.ts
                                                                         └── T011 index.ts

Tests (parallel, after target module):
  T012 (after T005), T013 (after T007), T014 (after T008), T015 (after T006)
```

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002 → T003 → T004)
3. Phase 3: Core modules (T005 → T006, T007, T008 in parallel → T009 → T010 → T011)
4. Run tests (T012–T016)
5. **STOP and validate**: `solver.solve(scrambled).then(s => verifySolved(s))` ✓
6. Add US2 verification (T017, T018), then US3 harness (T019–T021)

### Parallel Execution

With the foundational phase done, T005 + T007 + T008 can all run simultaneously since they're different files with no inter-dependency.

---

## Notes

- `CfopMoveTables.ts` is the hardest and most critical task — verify against `verify-perms.mjs` before proceeding
- OLL/PLL alg data lives at `cubify-scripts/data/algs-cfop-oll.json` and `algs-cfop-pll.json` (via symlink to cfop-app public data)
- Worker spawning mirrors `CubeSolver` / `solver.worker.ts` exactly — use `new URL('./cfop/cfop.worker.ts', import.meta.url)`
- Constitution rule 6: the solver applies z2 internally; `setupAlg: 'z2'` is returned on the solution for harness use
- `stages.length` is always 7 — the "6 entries" in the spec docs is a typo
