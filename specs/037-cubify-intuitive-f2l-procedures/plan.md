# Implementation Plan: Intuitive F2L Procedures (Beginner Solver)

**Branch**: `037-cubify-intuitive-f2l-procedures` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/037-cubify-intuitive-f2l-procedures/spec.md`

## Summary

Make the beginner (intuitive) CFOP F2L solver emit tutorial-shaped move sequences for **every** reachable F2L position, so a learner sees only the moves the method teaches. The current solver already produces method-shaped output for the common cases via tier-based procedures (`solveEasyInsert`, `solveSetupInsert`, the extraction branches of `solveSlotIntuitive`), but a minority of positions fall through to a generic search that can emit unfamiliar moves, and back slots are worked **in place** (L/R-family extraction or a B+U → `y R y'` search) rather than rotated to the front.

The technical approach restructures `solveF2lIntuitive` into two clearly separated layers:

1. **Procedure layer (primary emitter)** — the encoded intuitive procedures, keyed by the pair's classification (tier + white-facing direction), parameterised by AUF prefix and R↔L mirror. **Front slots (FR/FL) are encoded completely; back slots (BR/BL) inherit that coverage by conjugation** — `y [FR-procedure] y'` for BR and `y' [FL-procedure] y` for BL (empirically verified mapping). Because a cube rotation is an isomorphism, a complete FR/FL procedure set automatically solves BR/BL with front-only vocabulary and no B faces.
2. **Search layer (counted safety net)** — the existing slot-face / U+R+L / full-F2L IDA* fallbacks, demoted so they run **only when no procedure matches**, and every such case is counted by a **fall-through counter** (the success metric, driven to zero).

No public API changes: `solveF2lIntuitive` is a `cfop/`-internal function consumed by the CFOP worker, not exported from `packages/cubify/src/index.ts`. The advanced solver (feature 036) and the 2-look OLL/PLL stages are untouched.

## Technical Context

**Language/Version**: TypeScript ES Modules (ES2022), `tsc` build to `dist/`
**Primary Dependencies**: None new. Reuses `CfopMoveTables` (RawState model, `applyMove`/`applyAlg`, `MOVE_NAMES`) and `CaseLibrary` (`F2L_TRIGGERS`).
**Storage**: N/A (pure functions over an in-memory `RawState`)
**Testing**: Vitest headless suite (`packages/cubify/test/`); the fall-through counter extends `cfop-f2l-setup-poc.test.ts`
**Target Platform**: Browser web worker (`cfop.worker.ts`); logic is platform-agnostic pure TS
**Project Type**: Library internals (CFOP solver worker module)
**Performance Goals**: No regression in solver wall-time. Procedure dispatch is O(constant) table lookups; search remains gated and rare. Full Vitest suite stays in the current ~6 s range.
**Constraints**: Beginner move vocabulary only — U turns, the working front slot's outer side face (R or L), and a conjugating cube rotation (`y` / `y'`) for back slots. No B, wide, or slice moves. Every emitted sequence must round-trip (target pair solved; cross + previously-finished pairs intact). Deterministic selection.
**Scale/Scope**: One module (`F2lSolver.ts`) plus a small procedure table and one/two test files. The enumeration domain is the full set of real FR/FL tier-2 and tier-3 positions (a few hundred unique states per slot), with BR/BL covered by conjugation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitution rule | Applies? | Status |
|---|---|---|
| Physical simulation over reconstruction (rendering) | No — solver logic, no rendering | ✅ N/A |
| Mask travels with cubelet | No | ✅ N/A |
| onDone / render-loop sequencing | No | ✅ N/A |
| cubing.js U/D direction is animation-only | No — operates on RawState move tables, not renderer | ✅ N/A |
| Stickering homePos-keyed | No | ✅ N/A |
| z2 orientation is state-level | **Yes** — solver works in z2 frame; back-slot conjugation uses `y`/`y'` as **state-level** rotations via `applyAlg`, never `applyOrientation` | ✅ Honoured |
| Orientation formula `(s - o + N) % N` | Indirect (inside move tables) | ✅ Unchanged |
| Algorithm data lives in cfop repo JSON; cubify does not duplicate | **Yes** | ✅ Procedures are geometric logic authored in-repo (FR-008), not copied alg tables |
| Harness-first development | **Yes** | ✅ Exercised via CFOP worker + "Solve (cfop)" harness button; regression-guarded by Vitest |
| Module responsibility boundaries | **Yes** | ✅ Change confined to `cfop/F2lSolver.ts` (+ optional `CaseLibrary.ts` data) |
| Run `verify-perms.mjs` before merge | **Yes** | ✅ Included in quickstart verification |

**Gate result: PASS** — no violations, no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/037-cubify-intuitive-f2l-procedures/
├── plan.md              # This file
├── spec.md              # Feature spec (authored + clarified)
├── research.md          # Phase 0 output — design decisions
├── data-model.md        # Phase 1 output — Pair Position, Procedure, Coverage Report
├── quickstart.md        # Phase 1 output — run/verify the fall-through counter
├── contracts/
│   └── f2l-beginner-internal.md   # Internal contract: solveF2lIntuitive + coverage diagnostic
├── checklists/
│   └── requirements.md  # Already passed
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/cubify/src/cfop/
├── F2lSolver.ts         # PRIMARY CHANGE — restructure solveF2lIntuitive:
│                        #   • named procedure dispatch (easy / setup / extract)
│                        #   • back-slot conjugation (y FR-proc y' / y' FL-proc y)
│                        #   • demote + count the search fallbacks
│                        #   • return per-slot `method` for coverage measurement
├── CaseLibrary.ts       # OPTIONAL — house a white-facing-keyed procedure table if
│                        #   externalising the dispatch reads cleaner than inline
└── CfopMoveTables.ts    # UNCHANGED — reused (RawState, applyAlg, MOVE_NAMES, y index 38)

packages/cubify/test/
├── cfop-f2l-setup-poc.test.ts   # EVOLVE into the fall-through counter (FR-007/SC-001):
│                                #   enumerate real positions, assert method !== search
├── cfop-f2l-beginner.test.ts    # NEW (optional split) — round-trip + vocabulary asserts
│                                #   (SC-002/SC-003) across all four slots
└── cfop-pll.test.ts (et al.)    # UNCHANGED — must still pass (regression guard)
```

**Structure Decision**: Single-package library change. All production code lives in the existing `packages/cubify/src/cfop/` module; no new directories, build targets, or public surface change. Tests live in the existing `packages/cubify/test/` Vitest root. The only choice deferred to implementation (inline vs. externalised procedure table) is recorded in research.md.

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
