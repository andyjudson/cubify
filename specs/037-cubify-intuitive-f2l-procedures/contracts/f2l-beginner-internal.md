# Internal Contract: Beginner F2L Procedure Layer

cubify exposes no new public API for this feature (FR-010). The "contract" is the **package-internal** boundary between the CFOP worker and the beginner F2L solver, plus the test-facing coverage shape. Public surface (`packages/cubify/src/index.ts`) is unchanged.

---

## Contract A — `solveF2lIntuitive` (worker-internal)

**Location**: `packages/cubify/src/cfop/F2lSolver.ts`
**Consumed by**: `packages/cubify/src/cfop/cfop.worker.ts` only

### Before

```ts
export function solveF2lIntuitive(state: RawState): Array<{ label: string; alg: string }>;
```

### After

```ts
export type BeginnerMethod =
  | 'already-solved'
  | 'easy-insert'
  | 'setup-insert'
  | 'extract-insert'
  | 'search-fallback';

export interface IntuitiveStage {
  label: string;          // unchanged
  alg: string;            // unchanged
  method: BeginnerMethod; // NEW
}

export function solveF2lIntuitive(state: RawState): IntuitiveStage[];
```

### Guarantees

1. **Backward compatible for the worker** — `label` and `alg` keep their existing meaning and position; `method` is additive. The worker maps `label`/`alg` into `SolveStage` and ignores `method`. No `SolveStage`/public type changes.
2. **Procedure primacy** — for any position where an encoded procedure matches, the returned `alg` is that procedure's output and `method ≠ 'search-fallback'`. The search is invoked only when no procedure matches (FR-004).
3. **Round-trip** — applying all returned `alg`s in order to `state` solves all four F2L slots and leaves the cross intact (FR-005). Holds for every reachable `state`.
4. **Vocabulary** — every `alg` contains only `U/U'/U2`, the side faces `R*`/`L*`, the front face `F*`, and for back slots a leading/closing `y2`. Never `B*`, `D*`, wide, or slice (FR-006). **Correction vs the original spec**: the front face `F` is part of the beginner vocabulary. ⟨U, side⟩ alone (and even ⟨U, R, L⟩) cannot solve a general F2L slot while keeping the cross — the DF/DB cross edges are never moved by U/R/L — so `F` is group-theoretically required to pair a corner/edge the side face alone can't join. Empirically: U+side → unsolvable, U+R+L → unsolvable (depth 10), **U+side+F → solves ≤8**.
5. **Determinism** — equal `state` ⇒ equal result, including `method` (FR-009).
6. **Back-slot method attribution** — a BR/BL solve reports the underlying front procedure's `method` (the `y2 … y2` wrapper is not a method). **Correction vs the original spec**: the back-slot conjugate is a **`y2`** half turn (BR↔FL, BL↔FR), not a single `y`/`y'`. A single quarter rotation cannot solve a back slot (it only swaps which back slot is at the rear, and `y` flips equatorial edge orientation, so no `y … y'` conjugate of an R/L procedure round-trips); `y2` is its own inverse and does not flip edge orientation, so the same token both leads and closes.
7. **Length bound** — every emitted `alg` is ≤ `PROCEDURE_MAX`. A *procedure* longer than `PROCEDURE_MAX` is rejected like a miss (a 16+-move single-pair insert is not a recognisable beginner procedure); the slot then falls through to the bounded counted net. On the enumerated domain every procedure is already ≤ `PROCEDURE_MAX`, so this rejection never fires there.

### Internal helper contracts (not exported from the module beyond tests)

| Helper | Signature | Contract |
|---|---|---|
| `frontProcedure` | `(state, frontSlot, mustSolve) → { alg; method } \| null` | Returns a beginner-vocabulary (U/R/L/F) front-slot solve, or `null` if no procedure matches. Never returns a search result. |
| `conjugateBackSlot` | `(state, backSlot, mustSolve) → { alg; method } \| null` | Maps BR→FL and BL→FR via `y2 … y2`; runs the front escalation on the `y2`-rotated state (validated in the original frame); `null` on miss. |
| `searchFallback` | `(state, slot, mustSolve) → string` | The demoted, counted IDA* chain (slot-face → U+R+L+F). Stays strictly in beginner vocabulary (no `D`/`B`/wide/slice). Always returns a correct (possibly non-tutorial) alg or `''`. |
| `backConjugateSearch` | `(state, backSlot, mustSolve) → { alg; method } \| null` | Bounded counted net for a back slot that PRESERVES the `y2 … y2` shape: searches the rotated frame in beginner vocabulary, validates each candidate un-rotated, wraps the body `y2 … y2`. Keeps SC-005 even on a procedure miss/over-length. `'search-fallback'` method. |

---

## Contract B — Coverage diagnostic (test-facing)

**Location**: `packages/cubify/test/cfop-f2l-setup-poc.test.ts` (evolved) — reads `method` off `solveF2lIntuitive` results.

### Shape

```ts
interface CoverageReport {
  slot: string;
  tier: number;
  total: number;
  byMethod: Record<BeginnerMethod, number>;
  fallThrough: number;          // count of 'search-fallback'
  roundTripFails: number;
  vocabularyViolations: number;
  maxLen: number;
}
```

### Assertions (build gates at feature completion)

| Assertion | Requirement |
|---|---|
| `report.fallThrough === 0` for every enumerated slot/tier | SC-001 |
| `report.roundTripFails === 0` | SC-002 |
| `report.vocabularyViolations === 0` | SC-003 |
| `report.maxLen ≤ PROCEDURE_MAX` | SC-004 |

The enumeration generator is `U + side-face + F` (`F` was added to de-circularise it: a `U + side`-only generator could only ever produce positions a `U + side` procedure can reverse, masking the `F`-dependent domain). Back slots (BR/BL) are enumerated directly and gated via the `y2 … y2` conjugate.

SC-005 (back slots show a leading/closing `y2`, never an in-place trick) is gated by the end-to-end test (`cfop-f2l-beginner.test.ts`) over real cross-solved scrambles, alongside SC-002/003/004. The counted net for a back slot keeps the `y2 … y2` shape (`backConjugateSearch`), so SC-005 holds even on a procedure miss.

`PROCEDURE_MAX` (= 15) is the longest length any encoded procedure may emit: the back-slot worst case — a front-slot setup-insert (≤13 after normalisation) wrapped in the `y2 … y2` conjugate (+2). Measured exhaustively over the enumerated tier-2/3/4 domain (front max 13, back max 15). It is asserted, not hard-coded blindly; emits beyond it are rejected (Guarantee 7) rather than inflating the bound.

---

## Non-contract (explicitly unchanged)

- `packages/cubify/src/index.ts` exports — no additions/removals.
- `CubeSolverCfop` facade, `CfopSolution`, `SolveStage` — unchanged.
- `solveF2l` (the non-beginner/advanced path) — unchanged.
- 2-look OLL/PLL stages (`OllSolver`, `PllSolver`) — unchanged.
- The advanced recognition table (feature 036) — unaffected.
