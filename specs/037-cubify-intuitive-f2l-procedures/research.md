# Phase 0 Research: Intuitive F2L Procedures (Beginner Solver)

All Technical Context unknowns are resolved below. The spec had no `[NEEDS CLARIFICATION]` markers (three clarifications already recorded in the spec's Clarifications session). The decisions here are design choices that close the gap between the current `F2lSolver.ts` and the spec's requirements.

---

## Decision 1 — Back slots solved by conjugating the front procedure

**Decision**: Solve BR/BL by wrapping the **front-slot procedure** in a cube-rotation conjugate, not by working them in place.
- **BR** → `y [FR-procedure] y'`
- **BL** → `y' [FL-procedure] y`

**Empirically verified mapping** (throwaway Vitest, applying each rotation to the z2-solved state and observing where each back slot's native pieces land):

| Rotation | `f2l-br` pieces land at | `f2l-bl` pieces land at |
|---|---|---|
| `y`  | **f2l-fr** | f2l-br |
| `y'` | f2l-bl | **f2l-fl** |
| `y2` | f2l-fl | f2l-fr |

So a single `y` brings BR to the FR working position (keeping the **R**-family that BR naturally uses), and a single `y'` brings BL to the FL working position (keeping **L**-family). `y2` is **not** needed.

**Rationale**:
- A cube rotation is an isomorphism on cube state, so any FR procedure that is complete for FR automatically solves the rotated BR position. **This means BR/BL inherit coverage for free** once FR/FL procedures are complete — the encoding effort is front-slot-only.
- Vocabulary stays clean: the conjugated body uses only U + R (for BR via FR) or U + L (for BL via FL). No B faces (satisfies FR-006/SC-003).
- The trailing inverse rotation (`y'` / `y`) restores the canonical z2 orientation so downstream slot/cross checks and subsequent slots keep working in the fixed frame the rest of `solveF2lIntuitive` assumes. This mirrors the existing `solveSlotBackRotation` wrapper shape (`y … y'`), so the orchestration is a known-good pattern.

**Spec reconciliation (confirmed by user 2026-06-13)**: FR-002/FR-006/SC-003 originally phrased the rotation as a *"leading"* cube rotation "e.g. `y` / `y2`". The verified solution is a **conjugate** (leading `y`/`y'` **plus** a trailing inverse to return to frame), using `y'` rather than `y2`. The learner physically rotates the cube forward, solves, then squares the cube back up — so the conjugate is faithful to the method. The spec was updated to read "cube rotations (`y`/`y'`) used solely as the conjugating wrapper." This is a wording refinement, not a behaviour change.

**Alternatives considered**:
- *Work back slots in place with L/R-family + B+U search* (current code): rejected — emits B-derived moves and is a search, not a procedure; violates the beginner/advanced split (back-face freedom belongs to advanced 036).
- *Translate front R/U moves through the rotation into the original frame*: rejected — `y`-conjugating R/U produces F moves, which are outside the vocabulary.
- *Leave the cube rotated and carry orientation forward to later slots*: rejected — would force every slot check and the cross check to track a running orientation; far more complex than the self-contained conjugate, for no learner benefit.

---

## Decision 2 — Procedure layer is primary; search is a counted safety net

**Decision**: Reorganise `solveF2lIntuitive`'s per-slot escalation so a matched procedure is **always** returned as-is, and the IDA* searches run **only** when no procedure matches. Each slot's result carries a `method` tag; search results are tagged `search-fallback` and counted.

Per-slot escalation (front slot; back slots run the same against the conjugated front procedure):
1. `easy-insert` (tier 1) — `solveEasyInsert`
2. `setup-insert` (tier 2) — `solveSetupInsert` (1-ply white-on-side, 2-ply white-up)
3. `extract-insert` (tier 3/4) — extraction branches of `solveSlotIntuitive`, **restricted to the slot's own face** (R for FR, L for FL) + U
4. — *no procedure matched* —
5. `search-fallback` — slot-face IDA* → U+R+L IDA* → full-F2L IDA* (unchanged internally, now **counted**)

**Rationale**: FR-004 ("encoded procedures MUST be the primary emitter … MUST NOT override a procedure that matches") and the spec clarification "the encoded procedure always wins." The current code's `INTUITIVE_TIGHTEN_LEN` search-tightening **overrides** a matched procedure whenever its length exceeds 8 — directly contradicting FR-004. Under this feature, length blow-ups are fixed by **encoding the missing procedure**, not by search-tightening a matched one.

**Consequence on length (SC-004)**: dropping the search-tightening of matched procedures may make a few outputs a move or two longer than the interim search-tightened numbers, because the procedure spelling (the method) is preferred over the shortest spelling. This is the explicit beginner/advanced tradeoff the user chose. SC-004's bound is "the maximum length produced by the taught procedures," and the procedures are finite setup+insert compositions (normalised), so no 11–12-move blow-ups recur. Length is **not** the success metric — coverage is.

**Disposition of `INTUITIVE_TIGHTEN_LEN` / `shorterSlotFaceAlg`**: the slot-face search is retained but moved strictly behind the procedure dispatch (only runs on a procedure miss). It is no longer used to "tighten" a matched procedure.

**Disposition of `solveSlotBackRotation` (B+U → `y R y'` search)**: removed from the procedure path; back slots now go through procedure conjugation (Decision 1). If any conjugated case still misses a procedure, it falls to the same counted search as front slots. (Keep the function only if a task proves a residual gap; default is removal to reduce confusion per the existing architecture-review note on orphaned solvers.)

**Alternatives considered**:
- *Keep tightening but only below the procedure's length*: rejected — still lets search shape output; muddies "procedure always wins."
- *Delete the search entirely now*: rejected — it is the safety net that guarantees a correct (if oddly spelled) solve while the procedure coverage is driven to zero fall-throughs; removing it before SC-001 = 0 risks unsolved slots.

---

## Decision 3 — Coverage signal via a per-slot `method` tag on the internal return

**Decision**: Change `solveF2lIntuitive`'s return element shape from `{ label, alg }` to `{ label, alg, method }`, where `method ∈ { 'easy-insert', 'setup-insert', 'extract-insert', 'search-fallback', 'already-solved' }`. The fall-through counter test reads `method` and asserts the count of `'search-fallback'` over the enumerated domain trends to (and at completion equals) zero.

**Rationale**: FR-007/SC-001 require a measurable, repeatable coverage signal. A typed per-slot tag is the most direct, deterministic measurement and needs no separate re-derivation of "which procedure handled this." Back-slot results are tagged with the **underlying front procedure's** method (the conjugation is a wrapper, not a distinct method) so coverage is measured on the real procedure that did the work.

**Public-API safety (FR-010)**: `solveF2lIntuitive` is defined in `cfop/F2lSolver.ts` and imported only by `cfop/cfop.worker.ts`; it is **not** re-exported from `packages/cubify/src/index.ts`. Adding a field is backward-compatible for the worker (which builds `SolveStage` objects field-by-field and ignores extras). Verified: the public surface in `index.ts` is unchanged.

**Alternatives considered**:
- *Module-level mutable coverage array read by the test*: rejected — hidden global state, harder to reason about and not reentrant.
- *Separate exported `beginnerF2lCoverage(state)` diagnostic*: viable but duplicates the dispatch; the inline `method` tag is simpler and always in sync with the real solve.

---

## Decision 4 — Enumeration domain for the fall-through counter

**Decision**: The counter enumerates, per slot, the **real** positions reachable from z2-solved using the slot's beginner generators (U + the slot's face), with the cross and the other three slots solved, the target slot unsolved, partitioned into:
- **tier-2** (both pieces in U-layer, no direct trigger) — `getPairTier === 2`
- **tier-3** (one piece stuck in the slot) — `getPairTier === 3`

depth-bounded (current POC uses `maxLen = 9`), deduplicated by full-state key. FR (and FL by mirror) are enumerated directly; **BR/BL coverage is asserted via the conjugation** (a separate, smaller assertion that the conjugate of a complete FR/FL set solves a sample of BR/BL positions, plus round-trip over enumerated BR/BL cases).

**Rationale**: This is exactly the `enumerateCases(target, tier, maxLen)` harness already in `cfop-f2l-setup-poc.test.ts`, which the spec (FR-007) designates as the counter. Tier-1 (easy insert) is trivially covered and excluded from the blow-up risk. Tier-4 (both stuck) is reached transitively through extraction (one piece freed → reduces to tier-3); it can be added as a third partition if any fall-through is observed there.

**Rationale for "real positions"**: enumerating from the solved state with the legal generator set yields only physically reachable pair configurations — no synthetic/impossible states — so SC-001's "100% of positions" is well-defined and finite.

**Alternatives considered**:
- *Random sampling of scrambles*: rejected — non-deterministic, can't prove SC-001 = 0.
- *Full 12-move enumeration*: unnecessary — the method's domain is characterised at the current depth; deepen only if a gap is found.

---

## Decision 5 — Procedure table location: inline first, externalise only if it improves readability

**Decision**: Keep the procedure definitions in `F2lSolver.ts` (where `solveEasyInsert`/`solveSetupInsert`/extraction logic already live), refactored into clearly named functions returning `{ alg, method } | null`. Externalise a white-facing-keyed table into `CaseLibrary.ts` **only** if the inline dispatch becomes hard to read.

**Rationale**: The existing procedures are already in `F2lSolver.ts`; minimising file churn keeps the diff reviewable. `CaseLibrary.ts` currently holds *data* (trigger/OLL/PLL tables); a procedure table would fit there if it becomes data-shaped, but the dispatch is currently logic, not data. Decide during implementation; either location satisfies FR-008 (authored in geometric terms, no third-party source).

**Alternatives considered**:
- *Up-front externalisation*: rejected as premature — adds a module hop before we know the table shape.

---

## Resolved Technical Context summary

| Item | Resolution |
|---|---|
| Back-slot handling | Conjugate front procedure: `y FR y'` (BR), `y' FL y` (BL); verified mapping; no B faces |
| Procedure vs search precedence | Procedure always wins; search only on miss; matched procedures never tightened |
| Coverage measurement | Per-slot `method` tag on internal return; count `search-fallback` over enumeration |
| Enumeration domain | FR/FL tier-2 + tier-3 via `enumerateCases`; BR/BL via conjugation + round-trip |
| Procedure table location | Inline in `F2lSolver.ts`; externalise only if clearer |
| Public API impact | None — `solveF2lIntuitive` is worker-internal, not in `index.ts` |
| Spec wording refinement | "leading rotation `y`/`y2`" → conjugating rotations `y`/`y'`; confirm with user, no pre-approval edit |
