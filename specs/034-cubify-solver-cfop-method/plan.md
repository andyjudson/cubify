# Implementation Plan: CFOP Solver

**Branch**: `034-cfop-solver` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/034-cubify-solver-cfop-method/spec.md`

## Summary

`CfopSolver` — a CFOP-method cube solver running in a dedicated web worker. Accepts a `CubeState`, returns a `CfopSolution` with 6 `SolveStage` entries (cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll, pll). Cross and F2L stages use IDA* on raw piece/orientation arrays with precomputed move tables. OLL and PLL use orientation/permutation fingerprinting against embedded case libraries derived from `algs-cfop-oll.json` / `algs-cfop-pll.json`. Public API mirrors `CubeSolver`: `new CfopSolver()` → `solve(state)` → `dispose()`; `cancel()` aborts in-progress solves.

## Technical Context

**Language/Version**: TypeScript 5.x, ES Modules
**Primary Dependencies**: cubing.js (KPattern/KPuzzle via CubeState); AlgParser. No new external deps.
**Storage**: N/A — stateless solver
**Testing**: Vitest (existing suite in `packages/cubify/test/`)
**Target Platform**: Browser web worker (Chrome, Safari, Firefox); type: 'module' worker
**Project Type**: Library module — new files under `packages/cubify/src/`
**Performance Goals**: Full solve <5s (SC-001); cross ≤9 face moves (SC-003)
**Constraints**: Browser web worker only; no Node.js; no new npm dependencies
**Scale/Scope**: Single solver class; 6 stage algs per solve; IDA* depth ≤12 per stage

## Constitution Check

| Rule | Status | Notes |
|------|--------|-------|
| Physical simulation (rule 1) | ✓ Clear | Solver never touches the renderer |
| Mask travels with cubelet (rule 2) | ✓ Clear | Solver never touches stickering |
| onDone callback chain (rule 3) | ✓ Clear | No animation in solver |
| U/D direction correction (rule 4) | ✓ Clear | CubeState.applyAlg used for state transforms; no rendering path |
| homePos stickering key (rule 5) | ✓ Clear | No stickering |
| z2 orientation rule (rule 6) | ⚠ Resolved | See below |
| Orientation formula (rule 7) | ✓ Required | Applied in move table derivation and fingerprinting |

### z2 Playback Design

Constitution rule 6 prohibits `applyOrientation('z2')` for CFOP display because it physically moves cubelets and breaks `MOVE_AXIS` position filters. The CFOP solver must work within this constraint.

**Resolution**: The solver worker applies z2 internally to orient white to the bottom before running the cross search. The returned `SolveStage` for cross contains only face moves (no z2 token). The `z2` prefix is returned in a separate `setupAlg` field on the solution.

For harness playback:
1. Apply z2 to the scrambled `CubeState`: `state = scrambledState.applyAlg('z2')`
2. Load cross stage into CubePlayer with the scramble alg + z2 as setup: `player.loadAlg(stage.alg, scrambleAlg + ' z2')`. This passes through `applyMovesInstant`, not `animateMove`, consistent with existing use in cfop-app.
3. Subsequent stages (F2L, OLL, PLL) need no special handling — they are pure face moves relative to the z2-rotated frame.

## Project Structure

### Documentation (this feature)

```text
specs/034-cubify-solver-cfop-method/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code

```text
packages/cubify/src/
├── CfopSolver.ts                    # Public API class (new)
├── cfop/
│   ├── cfop.worker.ts               # Worker entry point (new)
│   ├── CfopMoveTables.ts            # 18-move piece/orientation permutation tables (new)
│   ├── CrossSolver.ts               # IDA* cross solver (new)
│   ├── F2lSolver.ts                 # IDA* F2L per-slot solver (new)
│   ├── OllSolver.ts                 # OLL fingerprint + lookup (new)
│   ├── PllSolver.ts                 # PLL fingerprint + lookup + final AUF (new)
│   └── CaseLibrary.ts               # Embedded OLL/PLL case data (new)
└── index.ts                         # Export CfopSolver + new types (modified)

packages/cubify/test/
├── cfop-cross.test.ts               # Cross solver unit tests (new)
├── cfop-f2l.test.ts                 # F2L solver unit tests (new)
├── cfop-oll.test.ts                 # OLL recognition tests (new)
└── cfop-pll.test.ts                 # PLL recognition tests (new)

cubify-harness/index.html            # "Solve (cfop)" button, stage-by-stage playback (modified)
```

**Structure Decision**: All CFOP internals live under `src/cfop/`, mirroring `src/solver/` for the 2-phase solver. The public surface is `CfopSolver.ts` at `src/` root.

---

## Phase 0: Research

*All findings consolidated in [research.md](./research.md).*

Key decisions resolved in research:

1. **Move tables**: Hardcode 18-move permutation arrays (corner pieces, corner orientations, edge pieces, edge orientations) in `CfopMoveTables.ts`. Tables are fixed constants for 3×3, derived from standard physics. No async init required; tables are zero-cost pure arrays.

2. **IDA* structure**: Adapted from `TwoPhase.ts` — iterative deepening with a lightweight admissible heuristic per stage. Cancellation via a `_cancelled` flag (same pattern as existing solver).

3. **Cross heuristic**: Count of D-layer edges (`DF=4, DR=5, DB=6, DL=7`) not yet in their home slot with correct orientation, divided by 4 (at most 4 cross pieces can be fixed per move group). Admissible and tight enough for depth ≤9.

4. **F2L move set**: All 18 face moves (excludes D moves — D moves are never used in F2L algorithms and pruning them halves the branching factor with no correctness cost). Goal condition: target slot solved AND all 4 cross edges still in home slots AND previously solved slots intact.

5. **F2L heuristic**: Per-slot: 0 if slot solved, otherwise 1 (constant lower bound). F2L search depth capped at 12 moves; typical F2L insertions are ≤8 moves.

6. **OLL fingerprint**: Array of 8 values — corner orientations `[0..2]` for slots 0–3 (URF,URB,ULB,ULF), then edge orientations `[0..1]` for slots 0–3 (UF,UR,UB,UL). Recognition tries all 4 U-layer rotations (U, U', U2, identity) by permuting slots. The matching rotation is emitted as a pre-AUF move prefix if needed.

7. **PLL fingerprint**: Array of 8 values — `corners.pieces[0..3]` then `edges.pieces[0..3]`. Recognition tries all 4 U-layer slot permutations. Matching rotation is pre-AUF. After alg application, a final AUF is computed and appended (U/U'/U2/empty).

8. **Case library init**: `CaseLibrary.ts` embeds the alg strings as TypeScript arrays (copied and transformed from `algs-cfop-oll.json` / `algs-cfop-pll.json`). Fingerprints are computed once at worker startup by applying the inverse alg to a "F2L-solved" base state using `CfopMoveTables`, then extracting the orientation/permutation values. No async cubing.js needed for this.

9. **Worker message protocol**: Mirrors `solver.worker.ts` — typed discriminated-union messages (`solve` / `cancel`), single-solve-at-a-time (`busy` flag). The solve response emits a `solution` message carrying the serialised `CfopSolution` (JSON-safe POJO).

---

## Phase 1: Design & Contracts

*Full details in [data-model.md](./data-model.md) and [contracts/CfopSolver.ts](./contracts/CfopSolver.ts).*

### Data Model Summary

```
CfopSolution
  stages: SolveStage[]          // 6 entries: cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll, pll
  totalMoves: number            // HTM only — cube rotations and AUF U-moves excluded
  setupAlg: string              // "z2" — apply to state before cross-stage CubePlayer load

SolveStage
  label: SolveStageLabel        // 'cross' | 'f2l-fr' | 'f2l-fl' | 'f2l-br' | 'f2l-bl' | 'oll' | 'pll'
  alg: string                   // WCA face moves; AUF prefix/suffix included for OLL/PLL
  mask: string                  // MASK_PRESETS label for this stage
  moves: number                 // HTM count for this stage (rotations excluded)
  caseName?: string             // OLL/PLL case name only (e.g. "Sune", "T-perm")
  wcaId?: string | number       // OLL/PLL WCA ID only
```

### Key Interfaces

```typescript
export class CfopSolver {
  readonly available: boolean;
  constructor();
  solve(state: CubeState, options?: CfopSolverOptions): Promise<CfopSolution>;
  cancel(): void;
  dispose(): void;
}

export interface CfopSolverOptions {
  timeoutMs?: number;   // default 30000
}
```

### MASK_PRESETS labels per stage

| Stage label | Suggested mask |
|-------------|---------------|
| `cross` | `'cross'` |
| `f2l-fr` | `'f2l'` (whole F2L; per-slot masks TBD post-034) |
| `f2l-fl` | `'f2l'` |
| `f2l-br` | `'f2l'` |
| `f2l-bl` | `'f2l'` |
| `oll` | `'oll-face-dim'` |
| `pll` | `'pll-face-dim'` |

Note: per-slot F2L masks (highlighting only the active corner-edge pair) are not in existing `MASK_PRESETS`. They can be added in a follow-on feature. For this feature, `'f2l'` (full F2L preset) is the suggested mask for all four F2L stages.

### Agent Context Update

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/034-cubify-solver-cfop-method/plan.md
<!-- SPECKIT END -->
