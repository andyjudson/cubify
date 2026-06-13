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
4. **Vocabulary** — every `alg` contains only `U/U'/U2`, the working front slot's side face (`R*` or `L*`), and for back slots a `y`/`y'` conjugate. Never `B*`, wide, or slice (FR-006).
5. **Determinism** — equal `state` ⇒ equal result, including `method` (FR-009).
6. **Back-slot method attribution** — a BR/BL solve reports the underlying front procedure's `method` (the conjugation wrapper is not a method).

### Internal helper contracts (not exported from the module beyond tests)

| Helper | Signature | Contract |
|---|---|---|
| `frontProcedure` | `(state, frontSlot, mustSolve) → { alg; method } \| null` | Returns a beginner-vocabulary front-slot solve, or `null` if no procedure matches. Never returns a search result. |
| `conjugateBackSlot` | `(state, backSlot, mustSolve) → { alg; method } \| null` | Maps BR→FR via `y…y'`, BL→FL via `y'…y`; runs `frontProcedure` on the rotated state; `null` on miss. |
| `searchFallback` | `(state, slot, mustSolve) → string` | The demoted, counted IDA* chain (slot-face → U+R+L → full). Always returns a correct (possibly non-tutorial) alg or `''`. |

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

`PROCEDURE_MAX` is the longest length any encoded procedure can emit (a named constant derived from the 2-ply setup-insert worst case after normalisation), asserted rather than hard-coded blindly.

---

## Non-contract (explicitly unchanged)

- `packages/cubify/src/index.ts` exports — no additions/removals.
- `CubeSolverCfop` facade, `CfopSolution`, `SolveStage` — unchanged.
- `solveF2l` (the non-beginner/advanced path) — unchanged.
- 2-look OLL/PLL stages (`OllSolver`, `PllSolver`) — unchanged.
- The advanced recognition table (feature 036) — unaffected.
