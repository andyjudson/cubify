---
description: "Task list for feature 037 — Intuitive F2L Procedures (Beginner Solver)"
---

# Tasks: Intuitive F2L Procedures (Beginner Solver)

**Input**: Design documents from `/specs/037-cubify-intuitive-f2l-procedures/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: INCLUDED. The spec designates a fall-through counter (FR-007) and measures success via tests (SC-001..SC-004), so test tasks are first-class here, not optional.

**Organization**: Tasks grouped by the three user stories (P1/P2/P3). Note: unlike a typical multi-file feature, almost all production work lands in a single module (`packages/cubify/src/cfop/F2lSolver.ts`), so most implementation tasks are **sequential** (same file). The three stories remain independently *testable* — each has its own assertion (vocabulary / length / coverage) — but US2 and US3 are verification gates that may drive more encoding back into US1's file. That coupling is called out in Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3
- All paths are repo-relative to `/Users/Andy/Documents/TechLab/cubify/`

## Path Conventions

Single-package library change. Production: `packages/cubify/src/cfop/`. Tests: `packages/cubify/test/`. No new directories.

---

## Phase 1: Setup (Baseline)

**Purpose**: Capture the starting point so the fall-through counter's progress is measurable.

- [ ] T001 Run `npm test` and `npx vitest run packages/cubify/test/cfop-f2l-setup-poc.test.ts`; record the current fall-through count, move-count histograms, and round-trip status for FR/FL tier-2 and tier-3 as the baseline (note in the PR description, not committed to a file).

**Checkpoint**: Baseline numbers known — every later phase is measured against them.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The structural spine — the `method`-tagged return and the procedure-vs-search split — that all three stories build on.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [ ] T002 In `packages/cubify/src/cfop/F2lSolver.ts`, add and export `type BeginnerMethod = 'already-solved' | 'easy-insert' | 'setup-insert' | 'extract-insert' | 'search-fallback'` and `interface IntuitiveStage { label: string; alg: string; method: BeginnerMethod }`; change `solveF2lIntuitive`'s return type to `IntuitiveStage[]` (per contracts/f2l-beginner-internal.md, Contract A).
- [ ] T003 Verify `packages/cubify/src/cfop/cfop.worker.ts` consumes only `label`/`alg` from `solveF2lIntuitive` results; confirm the additive `method` field needs no worker change (adjust only if it destructures the array element shape).
- [ ] T004 In `packages/cubify/src/cfop/F2lSolver.ts`, introduce the dispatch skeleton — `frontProcedure(state, frontSlot, mustSolve): { alg: string; method: BeginnerMethod } | null`, `conjugateBackSlot(state, backSlot, mustSolve): { alg: string; method: BeginnerMethod } | null`, and `searchFallback(state, slot, mustSolve): string` — and rewire BOTH call sites in `solveF2lIntuitive` (the while-loop body, ~L565, and the trailing for-loop, ~L604) to: try procedure → on `null`, run counted `searchFallback` (tag `'search-fallback'`). Skeleton may delegate to existing helpers initially; behaviour preserved.

**Checkpoint**: `solveF2lIntuitive` returns `method`-tagged stages; procedure/search paths are separated; full suite still green.

---

## Phase 3: User Story 1 — Learner sees only moves the method teaches (Priority: P1) 🎯 MVP

**Goal**: Encoded procedures are the primary emitter for every position; back slots solved by front-procedure conjugation; matched procedures are never overridden by search.

**Independent Test**: The vocabulary test (T005) passes — every emitted sequence across all four slots contains only `U/U'/U2`, the working front slot's side face (`R*`/`L*`), and `y`/`y'` for back slots; zero `B`/wide/slice moves.

### Tests for User Story 1

- [ ] T005 [P] [US1] Create `packages/cubify/test/cfop-f2l-beginner.test.ts` with a vocabulary assertion (SC-003/FR-006): enumerate real positions for all four slots, solve via `solveF2lIntuitive`, assert every token is in `{U,U',U2, R,R',R2, L,L',L2, y,y'}` and that back-slot algs are `y`/`y'`-wrapped. Expect FAIL initially.
- [ ] T006 [P] [US1] In the same test file, add a structural "recognisable method" check (proxy for SC-005): assert back-slot emits start with a `y`/`y'` rotation and contain no `B*` token, and that tier-1 positions emit AUF+trigger only (≤ trigger length).

### Implementation for User Story 1

- [ ] T007 [US1] In `F2lSolver.ts`, implement `frontProcedure` for FR/FL by composing the existing logic as named, method-tagged procedures: `easy-insert` (`solveEasyInsert`), `setup-insert` (`solveSetupInsert`, 1-ply white-on-side then 2-ply white-up), `extract-insert` (the slot-face extraction branches of `solveSlotIntuitive`, restricted to the slot's own face + U). Return `{ alg, method }` or `null` on no match. Preserve the FR-003 rule (AUF keeps white visible on a side face).
- [ ] T008 [US1] In `F2lSolver.ts`, implement `conjugateBackSlot` using the verified mapping (research Decision 1): BR → `y` + `frontProcedure(rotated, 'f2l-fr')` + `y'`; BL → `y'` + `frontProcedure(rotated, 'f2l-fl')` + `y`. Apply the leading rotation via `applyAlg`, solve the rotated state, normalise the wrapped sequence, and attribute the **underlying front procedure's** method. Return `null` if the front procedure misses.
- [ ] T009 [US1] In `F2lSolver.ts`, enforce procedure primacy (FR-004): when `frontProcedure`/`conjugateBackSlot` returns non-`null`, return that alg **as-is** — remove the `INTUITIVE_TIGHTEN_LEN` path that re-runs `shorterSlotFaceAlg` to override a matched procedure. The slot-face search survives only inside `searchFallback` (procedure-miss only).
- [ ] T010 [US1] In `F2lSolver.ts`, remove the in-place back-slot handling from the procedure path: delete the `solveSlotBackRotation` call (and the `f2l-br`/`f2l-bl` branch) from `solveSlotIntuitive`, and stop routing BL through L-family-in-place. Back slots now go exclusively through `conjugateBackSlot`. Keep `searchFallback` reachable for any residual miss.

**Checkpoint**: T005/T006 pass. Beginner output is procedure-shaped for the common cases; back slots show the `y`/`y'` conjugate; no B/wide/slice anywhere.

---

## Phase 4: User Story 2 — No surprising long sequences (Priority: P2)

**Goal**: No emitted single-pair sequence exceeds the length the taught procedures produce; the 11–12-move blow-ups are gone.

**Independent Test**: The length test (T012) passes — `maxLen ≤ PROCEDURE_MAX` across the full enumeration.

### Tests for User Story 2

- [ ] T012 [P] [US2] In `packages/cubify/test/cfop-f2l-beginner.test.ts`, add a length assertion (SC-004): across the enumeration for all four slots, assert every single-pair emit's move count ≤ `PROCEDURE_MAX`. Expect FAIL if any procedure (or stray search result) exceeds the bound.

### Implementation for User Story 2

- [ ] T011 [US2] In `F2lSolver.ts`, define `const PROCEDURE_MAX` = the longest normalised emit any encoded procedure can produce (derived from the 2-ply setup-insert worst case + AUF + back-slot conjugate wrapper), with a comment deriving the number rather than hard-coding blindly.
- [ ] T013 [US2] If T012 reveals any procedure emitting longer than `PROCEDURE_MAX`, refine the **procedure** (tighter setup/insert composition or better AUF choice) to stay within bound — never reach for search to shorten a matched procedure (preserves FR-004).

**Checkpoint**: T012 passes; histogram max is bounded by the procedure-derived maximum; no blow-ups.

---

## Phase 5: User Story 3 — Coverage is measurable and complete (Priority: P3)

**Goal**: The fall-through counter reports procedure-vs-search coverage and is driven to zero, with round-trip and vocabulary as hard gates.

**Independent Test**: The counter (T014/T017) reports `fallThrough === 0`, `roundTripFails === 0`, `vocabularyViolations === 0` for every enumerated slot/tier.

### Tests for User Story 3

- [ ] T014 [US3] Evolve `packages/cubify/test/cfop-f2l-setup-poc.test.ts` into the fall-through counter (FR-007): read `method` off each `solveF2lIntuitive` result and compute a `CoverageReport` per slot/tier (`total`, `byMethod`, `fallThrough`, `roundTripFails`, `vocabularyViolations`, `maxLen`) for FR/FL tier-2 and tier-3 via the existing `enumerateCases`. Log the report (visibility while encoding).
- [ ] T015 [US3] In the counter test, add BR/BL coverage: enumerate BR/BL tier-2/tier-3 cases and assert each is solved through conjugation (`method ≠ 'search-fallback'`) and round-trips — verifying back slots inherit front-slot coverage.
- [ ] T017 [US3] Convert the counter into hard build gates (SC-001/002/003): `expect(report.fallThrough).toBe(0)`, `expect(report.roundTripFails).toBe(0)`, `expect(report.vocabularyViolations).toBe(0)` for every slot/tier.

### Implementation for User Story 3

- [ ] T016 [US3] Drive `fallThrough` to 0: for each enumerated position the counter tags `'search-fallback'`, identify its tier + white-facing variant and extend `frontProcedure` in `F2lSolver.ts` to cover it (front slots only — BR/BL follow via conjugation). Iterate T014→T016 until the counter reports zero fall-throughs.

**Checkpoint**: All gates green; `fallThrough === 0`; SC-001 met.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Remove dead code, regression-guard, document.

- [ ] T018 [P] In `F2lSolver.ts`, remove now-dead code surfaced by the refactor (e.g. `solveSlotBackRotation` + `B_U_MOVES` if unused, stale `INTUITIVE_TIGHTEN_LEN` tightening comments, unreferenced combined `SETUP_ALGS`/`EXTRACTIONS` if the full solver no longer needs them — verify with a usage grep before deleting).
- [ ] T019 Run `npm test` — confirm the full CFOP suite (9-stage solution, OLL/PLL stages, PLL recognition) and all prior tests stay green (FR-010 regression guard).
- [ ] T020 Run `node cubify-harness/verify-perms.mjs` — all 18 permutation cross-checks must pass (constitution pre-merge gate).
- [ ] T021 [P] Manual harness smoke test per quickstart.md §5: scramble → "Solve (cfop)" in beginner mode → step through an F2L solve and confirm moves map to named method steps and back slots show a leading `y`/`y'` (qualitative SC-005).
- [ ] T022 [P] Update `CLAUDE.md` (Current Status + Recent Changes for 037) and the `specs/spec.md` ledger entry to mark 037 complete with the final test count.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: depends on Setup; **BLOCKS all stories** (introduces the `method` tag + dispatch split everything else uses).
- **US1 (Phase 3)**: depends on Foundational. Delivers the mechanism — the MVP.
- **US2 (Phase 4)**: depends on US1 (length is a property of the procedures US1 encodes).
- **US3 (Phase 5)**: depends on US1; **drives more encoding back into US1's `frontProcedure`** (T016). US2 and US3 can interleave in practice but US3 is the definition-of-done gate.
- **Polish (Phase 6)**: depends on US1–US3 complete.

### Within Each User Story

- Write the story's test first (T005/T006, T012, T014/T015/T017) and confirm it FAILS before implementing.
- `frontProcedure` (T007) before `conjugateBackSlot` (T008) — back slots reuse the front procedure.
- Procedure primacy (T009) and back-slot removal (T010) after the procedures exist.

### Same-File Serialization (important)

T002, T004, T007, T008, T009, T010, T011, T013, T016, T018 **all edit `F2lSolver.ts`** → they are **sequential**, NOT parallel, despite touching different logical concerns. Only the test-file tasks and the harness/doc tasks are genuinely parallelizable.

### Parallel Opportunities

- T005 + T006 (same new test file — write together, one author) are [P] relative to F2lSolver work but serialize with each other.
- T012 [P] is independent of T005/T006 content but lives in the same test file → coordinate.
- T021 + T022 [P] (harness smoke + docs) are fully independent at the end.

---

## Parallel Example

```bash
# After Foundational (Phase 2), the test scaffold can be written while
# frontProcedure is being implemented (different files):
Task T005: vocabulary test in packages/cubify/test/cfop-f2l-beginner.test.ts
Task T007: frontProcedure in packages/cubify/src/cfop/F2lSolver.ts   # serialize w/ other F2lSolver tasks

# At the very end, independent:
Task T021: manual harness smoke test
Task T022: CLAUDE.md + specs/spec.md ledger update
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → record baseline.
2. Phase 2 Foundational → `method`-tagged return + dispatch split (CRITICAL).
3. Phase 3 US1 → procedures primary + back-slot conjugation.
4. **STOP and VALIDATE**: vocabulary test green; spot-check a beginner solve in the harness.

### Incremental Delivery

1. Setup + Foundational → spine ready.
2. US1 → vocabulary gate green (MVP — output is recognisably the method).
3. US2 → length gate green (no blow-ups).
4. US3 → coverage counter to zero (definition of done).
5. Polish → dead-code removal, regression, docs.

### Definition of Done

- `fallThrough === 0`, `roundTripFails === 0`, `vocabularyViolations === 0` (SC-001/002/003).
- `maxLen ≤ PROCEDURE_MAX` (SC-004).
- `npm test` + `verify-perms.mjs` green; harness smoke confirms recognisable method (SC-005).
- No public-API/advanced/OLL/PLL change (FR-010).

---

## Requirements Coverage Map

| Requirement | Task(s) |
|---|---|
| FR-001 procedures as primary emitter | T004, T007 |
| FR-002 AUF + mirror; back slots via conjugation | T007, T008 |
| FR-003 U-turn keeps white visible | T007 |
| FR-004 procedure wins; search never overrides | T009 |
| FR-005 round-trip | T014, T015, T017 |
| FR-006 beginner vocabulary only | T005, T010 |
| FR-007 fall-through counter | T014, T015 |
| FR-008 authored in geometric terms | T007 (no external source) |
| FR-009 deterministic selection | T007 (table-driven dispatch) |
| FR-010 no public API / advanced / OLL-PLL impact | T003, T019 |
| SC-001 fall-through = 0 | T016, T017 |
| SC-002 round-trip = 100% | T017 |
| SC-003 vocabulary = 100% | T005, T017 |
| SC-004 no blow-ups | T011, T012, T013 |
| SC-005 recognisable method | T006, T021 |

---

## Notes

- [P] = different files, no dependencies. Most impl tasks are NOT [P] (single `F2lSolver.ts`).
- Per the standing no-commit-without-review rule, do not commit between tasks without the user's go-ahead.
- Verify each story's test FAILS before implementing it.
- Stop at any checkpoint to validate independently.
