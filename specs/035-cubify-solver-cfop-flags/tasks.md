# Tasks: CFOP Solver Beginner Mode

**Input**: Design documents from `specs/035-cubify-solver-cfop-flags/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[US1]**: 2-Look OLL and PLL
- **[US2]**: Intuitive F2L Method

---

## Phase 1: Setup

**Purpose**: Baseline verification before any changes.

- [X] T001 Run `npm test --workspace=packages/cubify` and confirm 239 pass, 10 skip — baseline recorded

---

## Phase 2: Foundational (Shared API and Type Changes)

**Purpose**: Type and message-protocol changes that both user stories depend on. Must complete before Phase 3 or 4.

- [X] T002 [P] Extend `CfopSolverOptions` in `packages/cubify/src/CubeSolverCfop.ts`: add `beginner?: boolean` field with JSDoc; in `solve()` pass `beginner: options.beginner` in the `postMessage` call alongside existing `patternStr` and `timeoutMs`
- [X] T003 Extend `SolveStageLabel` union in `packages/cubify/src/cfop/cfop.worker.ts`: add `'oll-edges' | 'oll-corners' | 'pll-corners' | 'pll-edges'` to the existing union type
- [X] T004 Extend `WorkerInMessage` solve variant in `packages/cubify/src/cfop/cfop.worker.ts`: add `beginner?: boolean` to the `{ type: 'solve'; ... }` variant
- [X] T005 Add MASK entries for the four new stage labels in the `MASK` record in `packages/cubify/src/cfop/cfop.worker.ts`: `'oll-edges': 'oll-face-dim'`, `'oll-corners': 'oll-face-dim'`, `'pll-corners': 'pll-face-dim'`, `'pll-edges': 'pll-face-dim'`

**Checkpoint**: Types compile cleanly; existing tests still pass (T002–T005 are non-breaking additions)

---

## Phase 3: User Story 1 — 2-Look OLL and PLL (Priority: P1) 🎯 MVP

**Goal**: `beginner: true` splits OLL into EOLL+OCLL and PLL into CPLL+EPLL, producing 9 stages where each sub-step is independently labelled and maskable.

**Independent Test**: Given any scrambled cube, `solveTwoLookOll` applied then `solveTwoLookPll` applied leaves the cube solved. Stage count from the worker = 9.

### Implementation for User Story 1

- [X] T006 [US1] Add `EOLL_CASES`, `CPLL_CASES`, and `EPLL_CASES` to `packages/cubify/src/cfop/CaseLibrary.ts`:
  - Add `EollCase` interface: `{ id, name, alg, eoPattern: number[] }`
  - Add `export const EOLL_CASES: EollCase[]` — 3 entries: `{ id:'eoll-dot', name:'Dot', alg:"F R U R' U' F' f R U R' U' f'", eoPattern:[1,1,1,1] }`, `{ id:'eoll-bar', name:'Bar', alg:"F R U R' U' F'", eoPattern:[0,1,0,1] }`, `{ id:'eoll-l-shape', name:'L-shape', alg:"f R U R' U' f'", eoPattern:[1,1,0,0] }`
  - Add `export const CPLL_CASES` — filter `PLL_CASES` where `c.fingerprint[4]===PLL_SOLVED_FINGERPRINT[4] && c.fingerprint[5]===PLL_SOLVED_FINGERPRINT[5] && c.fingerprint[6]===PLL_SOLVED_FINGERPRINT[6] && c.fingerprint[7]===PLL_SOLVED_FINGERPRINT[7]` (yields Aa-perm, Ab-perm, E-perm)
  - Add `export const EPLL_CASES` — filter `PLL_CASES` where `c.id.startsWith('pll-1-')` (yields Ua, Ub, H, Z perms)

- [X] T007 [P] [US1] Add `solveTwoLookOll(state: RawState): TwoLookOllResult` to `packages/cubify/src/cfop/OllSolver.ts`:
  - Add `TwoLookOllResult = { eoll: OllResult; ocll: OllResult }` interface
  - `solveEoll(state)`: if `eo[0..3]` all 0 → return skip; else for each `auf` (0–3) try rotating eo pattern with `rotateUFp_n`, compare against each `EOLL_CASES[i].eoPattern`; on match return `{ alg: aufStr + case.alg, caseName: case.name, wcaId: 0 }`
  - `solveOcll(state)`: filter `OLL_CASES` where `fp[4]===0 && fp[5]===0 && fp[6]===0 && fp[7]===0` (indices 0–6: Sune through U-Shape); then call existing `solveOll` logic against this subset
  - `solveTwoLookOll`: call `solveEoll`, apply eoll alg, call `solveOcll` on updated state, return `{ eoll, ocll }`

- [X] T008 [P] [US1] Add `solveTwoLookPll(state: RawState): TwoLookPllResult` to `packages/cubify/src/cfop/PllSolver.ts`:
  - Add `TwoLookPllResult = { cpll: PllResult; epll: PllResult }` interface
  - Import `CPLL_CASES`, `EPLL_CASES` from `CaseLibrary.js`
  - `solveCpll(state)`: if cp[0..3] matches `PLL_SOLVED_FINGERPRINT[0..3]` under any AUF rotation → skip; else brute-force: for each `auf` (0–3) × each CPLL_CASES entry, apply AUF then alg, check if cp[0..3] equals `PLL_SOLVED_FINGERPRINT[0..3]` under any post-AUF; return `{ alg: preAuf+case.alg+postAuf, caseName, wcaId }`
  - `solveEpll(state)`: same brute-force (4 × 4 = 16 combos) using EPLL_CASES, check `isTopLayerAligned()` after pre-AUF+alg+post-AUF
  - `solveTwoLookPll`: call `solveCpll`, apply cpll alg, call `solveEpll` on updated state, return `{ cpll, epll }`

- [X] T009 [US1] Wire beginner OLL/PLL dispatch in `packages/cubify/src/cfop/cfop.worker.ts` solve handler:
  - Import `solveTwoLookOll` from `./OllSolver.js` and `solveTwoLookPll` from `./PllSolver.js`
  - In the solve handler after F2L, add: `if (msg.beginner) { const tlo = solveTwoLookOll(state); if (tlo.eoll.alg) state = applyAlg(state, tlo.eoll.alg); stages.push({ label:'oll-edges', alg:tlo.eoll.alg, mask:MASK['oll-edges'], moves:countMoves(tlo.eoll.alg), caseName:tlo.eoll.caseName }); if (tlo.ocll.alg) state = applyAlg(state, tlo.ocll.alg); stages.push({ label:'oll-corners', alg:tlo.ocll.alg, mask:MASK['oll-corners'], moves:countMoves(tlo.ocll.alg), caseName:tlo.ocll.caseName }); ... similarly for solveTwoLookPll } else { ... existing solveOll / solvePll path ... }`

### Tests for User Story 1

- [X] T010 [P] [US1] Add `solveTwoLookOll` tests to `packages/cubify/test/cfop-oll.test.ts`:
  - EOLL skip: state with eo[0..3]=[0,0,0,0] → eoll.alg='', eoll.caseName='EOLL Skip'
  - Dot case: build state with eo=[1,1,1,1], apply `solveTwoLookOll`, verify eo[0..3] all 0 after eoll.alg
  - Bar case (+ all 2 AUF variants): same verify pattern
  - L-shape case (+ all 4 AUF variants): same verify pattern
  - OCLL skip: after EOLL applied, state with co[0..3]=[0,0,0,0] → ocll.alg='', caseName='OLL Skip'
  - All 7 OCLL cases: for each, build state (EOLL-solved, co pattern from OLL_CASES[0..6].fingerprint[0..3]), apply `solveTwoLookOll`, verify co[0..3] all 0 after full alg sequence

- [X] T011 [P] [US1] Add `solveTwoLookPll` tests to `packages/cubify/test/cfop-pll.test.ts`:
  - CPLL skip: U-layer solved → cpll.alg='', caseName='CPLL Skip'
  - Aa-perm, Ab-perm, E-perm: build state from each CPLL_CASES[i].fingerprint, apply `solveTwoLookPll`, verify cp[0..3] solved after cpll.alg, full U-layer solved after epll.alg
  - All 4 EPLL cases: build state with solved cp + each EPLL_CASES[i] edge pattern, verify `isTopLayerAligned()` after epll.alg
  - Combined: all 21 PLL states round-trip through `solveTwoLookPll`

- [X] T012 [US1] Add integration tests to `packages/cubify/test/cfop-solver.test.ts` for worker `beginner: true` dispatch:
  - Mock-worker or direct-worker test: given a representative scramble alg, post `{ type:'solve', patternStr, beginner:true }`, verify response `solution.stages.length === 9`
  - Verify stage labels in order: 'cross', 'f2l-fr'|'f2l-fl'|'f2l-br'|'f2l-bl' ×4, 'oll-edges', 'oll-corners', 'pll-corners', 'pll-edges'
  - Verify skip stages present with alg='' (use a scramble that produces a known OLL skip)
  - Verify `beginner:false` or no flag still produces 7-stage solution (regression)

**Checkpoint**: `beginner:true` produces exactly 9 stages; all sub-steps solve their piece type; all 12 new test cases pass; 239 existing tests unchanged.

---

## Phase 4: User Story 2 — Intuitive F2L Method (Priority: P2)

**Goal**: `beginner: true` also replaces IDA* F2L with a fluid priority loop that mirrors the IntuitivePage tutorial — stage algs decompose into recognisable setup + trigger sequences, and the solve order reflects which pair was easiest at each step.

**Independent Test**: Given any scramble, `solveF2lIntuitive` returns 4 stages whose algs each end in a recognisable insertion trigger. For a state where FL is tier-1 ready and FR is not, FL appears first in the output array.

### Implementation for User Story 2

- [X] T013 [US2] Compute and add `F2L_TRIGGERS` table to `packages/cubify/src/cfop/CaseLibrary.ts`:
  - Add `F2lTrigger` interface: `{ id, alg, cornerSlot, cornerOrient, edgeSlot, edgeOrient, side: 'right'|'left' }`
  - For each of the 4 trigger algs from the tutorial, compute fingerprints by: start from z2-solved state (cross done, FR empty); apply the trigger alg in reverse to find the before-state; record `state.cornerPieces.indexOf(cornerPiece)` → cornerSlot, `state.cornerOrient[cornerSlot]` → cornerOrient, `state.edgePieces.indexOf(edgePiece)` → edgeSlot, `state.edgeOrient[edgeSlot]` → edgeOrient
  - Add `export const F2L_TRIGGERS: F2lTrigger[]` with 4 entries: `{ id:'right-connected', alg:"U R U' R'", side:'right', cornerSlot:?, cornerOrient:?, edgeSlot:?, edgeOrient:? }`, `{ id:'right-disconnected', alg:"R U R'", side:'right', ... }`, `{ id:'left-connected', alg:"U' L' U L", side:'left', ... }`, `{ id:'left-disconnected', alg:"L' U' L", side:'left', ... }`
  - Verify: applying each trigger alg from its before-state leaves the FR (or FL) slot solved

- [X] T014 [US2] Add `getPairTier(state: RawState, slot: string): 1|2|3|4` to `packages/cubify/src/cfop/F2lSolver.ts`:
  - Locate `cornerPiece` and `edgePiece` for slot using `SLOT_DEFS`
  - `cornerInTop = state.cornerPieces.indexOf(cornerPiece) < 4`; `edgeInTop = state.edgePieces.indexOf(edgePiece) < 4`
  - If both in top: check whether configuration matches a F2L_TRIGGERS entry after U-turns → tier 1 if match, tier 2 if not
  - If one in top, one not: tier 3; if neither in top: tier 4

- [X] T015 [P] [US2] Add `solveEasyInsert(state: RawState, slot: string): string` to `packages/cubify/src/cfop/F2lSolver.ts`:
  - Determine target side (FR/BR → right triggers; FL/BL → left triggers)
  - Apply U-turns (0–3) to bring corner piece above the correct working slot (slot 0 for FR, slot 1 for FL after U-adjustment)
  - Look up (cornerOrient, edgeSlot relative, edgeOrient) against F2L_TRIGGERS filtered by `side`
  - Return U-turns string + trigger alg string; return empty string if no match found

- [X] T016 [P] [US2] Add `extractPiece(state: RawState, slot: string): string` to `packages/cubify/src/cfop/F2lSolver.ts`:
  - For tier-3 (one stuck): if corner is stuck → determine which slot it's in; if in a right-side slot apply `R U R'` to extract; if in a left-side slot apply `L' U' L`; if edge is stuck → use equivalent edge extraction
  - For tier-4 (both stuck): extract corner first with `R U R'` or `L' U' L`
  - Return combined extraction alg string

- [X] T017 [US2] Add `solveSetupInsert(state: RawState, slot: string): string` to `packages/cubify/src/cfop/F2lSolver.ts`:
  - Both pieces in top layer but tier-2 (no direct trigger match after U-turns)
  - Apply U-turns to position corner above working slot; examine cornerOrient and edge position to determine sub-case:
    - Sub-case A (white-side, colours match): apply `R` (tuck corner to DFR, white still on side face), apply U-turn to bring edge adjacent, apply `R'` to extract, then call `solveEasyInsert` on updated state; return full sequence
    - Sub-case B (white-side, colours don't match): similar tuck in opposite direction
    - Sub-case C (white-up): move edge to back slot (`U2 R U' R'`), U-turn to bring corner above working slot, extract (`R U R'`), then call `solveEasyInsert`; return full sequence

- [X] T018 [US2] Add `solveF2lIntuitive(state: RawState): Array<{label: string; alg: string}>` fluid priority loop to `packages/cubify/src/cfop/F2lSolver.ts`:
  - Import `F2L_TRIGGERS` from `./CaseLibrary.js`
  - `unsolved = new Set(['f2l-fr','f2l-fl','f2l-br','f2l-bl'])`
  - While unsolved not empty: remove any slots already solved (`slotSolved(s,slot) && crossOk(s)`); find slot with lowest `getPairTier(s,slot)`; route to `solveEasyInsert` (tier 1), `solveSetupInsert` (tier 2), `extractPiece`+retry (tiers 3–4); apply returned alg to state; push `{label, alg}` (alg may be empty for already-solved slots); remove slot from unsolved; include `if (_cancelled) return []` guard each iteration

- [X] T019 [US2] Wire beginner F2L dispatch in `packages/cubify/src/cfop/cfop.worker.ts` solve handler:
  - Import `solveF2lIntuitive` from `./F2lSolver.js`
  - Replace existing `const f2lAlgs = solveF2l(state, [])` block with: `if (msg.beginner) { const intuitiveStages = solveF2lIntuitive(state); for (const { label, alg } of intuitiveStages) { if (_cancelled) { busy=false; return; } const mask = buildF2lMask(state, label); if (alg) state = applyAlg(state, alg); stages.push({ label, alg, mask, moves: countMoves(alg) }); } } else { // existing f2l-fr/fl/bl/br fixed-order path }`

### Tests for User Story 2

- [X] T020 [US2] Add `solveF2lIntuitive` tests to `packages/cubify/test/cfop-f2l.test.ts`:
  - Completion: for a representative scramble set (≥3 scrambles), verify all 4 slots solved after applying the returned algs sequentially
  - Trigger structure: for each non-empty F2L stage alg, verify the last 1–4 moves match one of the known triggers (`R U R'`, `R U' R'`, `L' U' L`, `L' U L`, `U R U' R'`, `U' L' U L`)
  - Opportunistic ordering: build a state where FL slot has its pair directly insertable (tier 1) and FR does not; verify `solveF2lIntuitive` returns FL stage before FR stage
  - Already-solved slot: build state with FR already solved; verify `f2l-fr` stage has alg='' and appears in output

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T021 Run full test suite `npm test --workspace=packages/cubify` — verify all existing 239 tests still pass plus all new tests; total should be ≥ 248 pass, 10 skip
- [X] T022 Manual harness check: temporarily add `beginner: true` to the Solve (cfop) call in `cubify-harness/index.html`; run the harness; confirm 9 stages display with correct labels and mask rendering on each stage; revert the temporary change after verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run immediately
- **Phase 2 (Foundational)**: No dependencies on Phase 1 result — T002–T005 can start immediately; T003/T004/T005 are sequential (same file)
- **Phase 3 (US1)**: Requires Phase 2 complete (needs new types + MASK entries)
- **Phase 4 (US2)**: Requires Phase 2 complete; can start in parallel with Phase 3 after Phase 2

### Within Phase 3

- T006 → T007 [P] + T008 [P] (T007 and T008 use data from T006, different files)
- T007 + T008 → T009 (wire-up imports both solvers)
- T007 → T010 [P]; T008 → T011 [P] (tests can run as soon as their solver is done)
- T009 + T010 + T011 → T012 (integration test needs wire-up complete)

### Within Phase 4

- T013 → T014 (getPairTier checks trigger table)
- T013 → T015 [P] + T016 [P] (easy insert + extract both use trigger data, different code)
- T015 + T016 → T017 (setup insert calls easy insert internally)
- T014 + T015 + T016 + T017 → T018 (priority loop uses all handlers)
- T018 → T019 (wire-up imports solveF2lIntuitive)
- T018 → T020 (tests need solver complete)

### Story Independence

- US1 (Phase 3) and US2 (Phase 4) can be developed in parallel after Phase 2 completes
- US1 is independently verifiable: `solveTwoLookOll`/`solveTwoLookPll` can be tested without F2L changes
- US2 is independently verifiable: `solveF2lIntuitive` can be tested by calling it directly with a known state (worker wire-up T019 is the integration step)

---

## Parallel Opportunities

```
Phase 2: T002 can run in parallel with T003→T004→T005 (different files)
Phase 3: T007 and T008 run in parallel after T006 (different files)
         T010 and T011 run in parallel (different test files)
Phase 4: T015 and T016 run in parallel after T013 (different functions, same file — coordinate on edits)
```

---

## Implementation Strategy

### MVP: User Story 1 Only (2-Look OLL/PLL)

1. Phase 1: Baseline check
2. Phase 2: Foundational (T002–T005)
3. Phase 3: US1 (T006–T012)
4. **Validate**: Run `npm test`; manually verify 9-stage output in harness
5. US1 ships independently — consumers can use `beginner: true` for 2-look LL immediately

### Full Beginner Mode

1. After US1 validated, proceed with Phase 4 (US2, T013–T020)
2. Phase 5 polish
3. Both F2L and LL in beginner mode fully functional

---

## Notes

- The `cfop.worker.ts` file is touched in both Phase 2 (T003–T005) and Phase 3 (T009) and Phase 4 (T019) — coordinate edits; don't apply T009 and T019 simultaneously
- F2L_TRIGGERS fingerprint values (T013) require a computation step: apply each trigger alg in reverse to a known solved state and record the before-configuration; this is implementation work, not a lookup
- EOLL eoPattern values are declared in the plan; verify by applying each alg to a state with that eoPattern and confirming eo[0..3] all become 0
- `solveSetupInsert` (T017) is the most complex handler — test it separately before wiring into the priority loop
