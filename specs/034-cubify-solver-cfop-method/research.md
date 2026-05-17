# Research: CFOP Solver (034)

## Decision 1 — Move tables approach

**Decision**: Hardcode 18-move permutation tables in `CfopMoveTables.ts` as TypeScript constant arrays.

**Rationale**: The 3×3 move permutations are fixed physics. Hardcoding them avoids any async initialisation in the worker and keeps the module self-contained. The existing `MoveTables.ts` in the 2-phase solver uses the same pattern. Tables are derived from the well-established cubing.js KPattern move data (verified against `verify-perms.mjs`).

**Format**: For each of 18 moves (U,U',U2, R,R',R2, F,F',F2, D,D',D2, L,L',L2, B,B',B2):
- `cornerPieces[moveIdx][slot]`: after the move, slot `i` contains the piece that was previously in `cornerPieces[moveIdx][i]`
- `cornerOrient[moveIdx][slot]`: orientation delta added to the piece arriving in slot `i`
- `edgePieces[moveIdx][slot]`, `edgeOrient[moveIdx][slot]`: same for edges

**Alternatives considered**: (a) Use cubing.js KPattern inside the worker — adds async init overhead and heavier bundle; (b) Derive tables at runtime from cubing.js — correct but slow first-use. Hardcoded tables are instantaneous and testable.

---

## Decision 2 — IDA* structure

**Decision**: Iterative deepening depth-first search (IDA*) with a per-stage admissible heuristic, cancellable via a `_cancelled` flag. Single-pass depth iteration (no resumable state). Adapted directly from `TwoPhase.ts` structure.

**Rationale**: IDA* is optimal for short-depth search with a good heuristic. Cross and F2L are shallow (≤9 and ≤12 moves), making IDA* tractable. The existing solver worker already uses this pattern.

**Alternatives considered**: BFS — too memory-heavy for F2L search space; A* — heap overhead not justified for shallow depths; pattern databases — overkill for a library solver.

---

## Decision 3 — Cross heuristic

**Decision**: `h = max(0, Math.ceil(misplacedCrossEdges / 4))` where `misplacedCrossEdges` is the count of D-layer edges (slots 4–7) not in home position with correct orientation.

**Rationale**: Each quarter-turn can fix at most 1 cross edge reliably. Dividing by 4 is conservative but admissible. This keeps the heuristic simple and guaranteed not to overestimate, which is required for IDA* correctness.

**Cross solved condition**: `edges.pieces[4]==4 && edges.orient[4]==0 && edges.pieces[5]==5 && edges.orient[5]==0 && edges.pieces[6]==6 && edges.orient[6]==0 && edges.pieces[7]==7 && edges.orient[7]==0`

---

## Decision 4 — F2L move set and goal

**Decision**: Move set = all 18 face moves minus D/D'/D2 (15 moves). Goal = target slot solved AND all 4 cross edges in home positions AND any previously solved F2L slots intact.

**Rationale**: D moves never appear in F2L algorithms and excluding them halves the branching factor from 18 to 15, reducing the search tree significantly. The cross-edges check in the goal condition ensures the IDA* naturally finds solutions that restore cross edges after temporary disturbance (e.g., in `R U R'` sequences), without needing to maintain cross edges as an invariant at every node.

**F2L slot definitions (piece IDs)**:
| Slot label | Corner piece | Corner slot | Edge piece | Edge slot |
|------------|-------------|-------------|------------|-----------|
| `f2l-fr` | DRF (4) | slot 4 | FR (8) | slot 8 |
| `f2l-fl` | DLF (5) | slot 5 | FL (9) | slot 9 |
| `f2l-bl` | DLB (6) | slot 6 | BL (11) | slot 11 |
| `f2l-br` | DRB (7) | slot 7 | BR (10) | slot 10 |

**F2L heuristic**: returns 0 if goal met, else 1 (constant). Depth cap: 12 moves. Combined with move-ordering (U moves first, already-useful moves first), this is sufficient for ≤12-depth search.

---

## Decision 5 — OLL fingerprint and recognition

**Decision**: Fingerprint = `[cornerOrient[0], cornerOrient[1], cornerOrient[2], cornerOrient[3], edgeOrient[0], edgeOrient[1], edgeOrient[2], edgeOrient[3]]` — the orientation values of the 4 U-layer corner and edge slots.

**Recognition algorithm**:
1. Compute fingerprint from current raw state
2. For each of 4 U-rotations (identity, U, U', U2): permute the 8 fingerprint values according to the U-move cycle, compare against each of 57 stored fingerprints
3. First match → emit the U rotation as a pre-AUF prefix (if not identity), apply the stored alg

**U-layer slot permutation for U move** (clockwise):
- Corners: slot 0 ← slot 3 ← slot 2 ← slot 1 ← slot 0 (URF←ULF←ULB←URB cycle)
- Edges: slot 0 ← slot 3 ← slot 2 ← slot 1 ← slot 0 (UF←UL←UB←UR cycle)

**OLL skip**: if all 8 orientation values are 0, the stage is a skip (empty alg).

---

## Decision 6 — PLL fingerprint, recognition, and final AUF

**Decision**: Fingerprint = `[cornerPieces[0], cornerPieces[1], cornerPieces[2], cornerPieces[3], edgePieces[0], edgePieces[1], edgePieces[2], edgePieces[3]]` — the piece IDs in U-layer slots.

**Recognition**: Same 4-rotation search as OLL. After matching, apply the alg (using move tables) and check which U rotation aligns the top layer — this is the final AUF, appended to the stage alg string.

**PLL skip**: if all 8 piece values equal their slot indices (0–3), permutation is already solved (empty alg, no final AUF needed).

**Final AUF computation**: after applying the PLL alg moves to the state, check `corners.pieces[0..3]` and `edges.pieces[0..3]`. Try U, U', U2, identity. The one that makes all 8 equal their slot indices (and matches side face colors) is the final AUF.

---

## Decision 7 — Case library initialisation

**Decision**: `CaseLibrary.ts` stores alg strings as TypeScript arrays (ported from the JSON). Fingerprints are computed once at worker startup by applying the inverse alg to an "OLL-solved" / "F2L-solved" base state using `CfopMoveTables`, extracting the orientation/permutation values.

**Rationale**: Computing fingerprints from alg strings at startup is reliable (no hand-editing of lookup tables), fast (57 + 21 = 78 algs, each ≤15 moves), and self-documenting. If an alg changes, the fingerprint automatically updates.

**Base states for fingerprint derivation**:
- OLL: start from F2L-solved state (`corners.pieces=[0,1,2,3,4,5,6,7]`, `corners.orient=all 0 except [0..3]` configured for an all-twisted-U-layer state, `edges.pieces=[0..11]`, `edges.orient=all 0 except [0..3]` — specifically the fully-solved state with all orientations 0, which is also the solved state)
- Actually simpler: start from fully solved state, apply the inverse of the alg, extract U-layer orientations (for OLL) / permutations (for PLL). This gives the fingerprint of the state the alg is designed to solve.

---

## Decision 8 — Worker message protocol

**Decision**: Mirrors `solver.worker.ts` — typed discriminated-union messages, single-solve-at-a-time via `busy` flag.

**Worker → main** messages:
```ts
{ type: 'solution'; solution: CfopSolutionData; elapsedMs: number }
{ type: 'error'; reason: 'timeout' | 'invalid' | 'no-case' | 'internal'; message: string; elapsedMs: number }
```

**Main → worker** messages:
```ts
{ type: 'solve'; patternStr: string; timeoutMs: number }
{ type: 'cancel' }
```

`patternStr` is `JSON.stringify(state.kPattern.patternData)` — same serialisation used by `CubeSolver`.

---

## Decision 9 — Slot order for F2L substages

**Decision**: Fixed order: `f2l-fr` → `f2l-fl` → `f2l-br` → `f2l-bl`. Each subsequent search has the constraint that all previously-solved slots remain solved.

**Rationale**: Fixed order is simple, deterministic, and testable. Greedy ordering (cheapest slot next) deferred to a future optimisation.
