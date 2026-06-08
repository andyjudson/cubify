# Research: CFOP Solver Method Flags

## Decision 1 — EOLL Algorithm Table

**Decision**: Separate 3-entry EOLL case table with eo-only fingerprints.

**Rationale**: EOLL algs operate on states with disoriented corners, so they can't be derived from the 57-case OLL library (which orients everything simultaneously). Only 3 EOLL cases exist (+ skip): dot [1,1,1,1], bar [0,1,0,1], L-shape [1,1,0,0]. The bar and L-shape have AUF variants handled by the existing rotateUFp rotation approach.

**Alternatives considered**: filtering OLL_CASES — rejected because OLL fingerprints encode both co and eo simultaneously; there is no subset of OLL that covers EOLL states where corners may still be disoriented.

**Algs**:
- Dot: `F R U R' U' F' f R U R' U' f'` — two-step sequence, transforms dot to skip
- Bar: `F R U R' U' F'`
- L-shape: `f R U R' U' f'`

**Fingerprint computation**: eoPattern values are computed by applying each alg to a state with the corresponding eo pattern and verifying the result. Done in implementation.

---

## Decision 2 — OCLL Reuses OLL_CASES

**Decision**: Filter OLL_CASES where `fp[4..7]` are all 0 (edges already oriented). These are indices 0–6: Sune, Anti-Sune, H Shape, Pi Shape, T Shape, L Shape, U Shape.

**Rationale**: After the EOLL step, all 4 U-layer edges are oriented. The remaining 7 OCLL states ARE present in the existing 57-case OLL library as the subset with eo=0. No new data needed.

---

## Decision 3 — CPLL via Filtered PLL_CASES Subset

**Decision**: Filter `PLL_CASES` where `fingerprint[4..7] == PLL_SOLVED_FINGERPRINT[4..7]` (edges already solved). This yields Aa-perm, Ab-perm, E-perm — the 3 corner-cycle cases.

**Rationale**: These 3 cases happen to start from states where edges are already correctly placed. The Aa/Ab/E algs cycle corners; they also move edges, but EPLL fixes that. Recognition uses brute-force (4 AUF × 3 cases = 12 combinations): apply pre-AUF + alg, check if `cp[0..3]` matches solved corners under any post-AUF.

**Post-AUF computation**: after applying CPLL alg, check which U-rotation (0/U/U2/U') leaves `cp[0..3] == PLL_SOLVED_FINGERPRINT[0..3]`.

---

## Decision 4 — EPLL via Filtered PLL_CASES Subset

**Decision**: Filter `PLL_CASES` by `id.startsWith('pll-1-')` → Ua, Ub, H, Z perms.

**Rationale**: After CPLL, corners are solved. EPLL cases are the 4 edge-permutation algs. Recognition: brute-force (4 AUF × 4 cases = 16 combinations), applying pre-AUF + alg and checking `isTopLayerAligned()`. The existing PLL algs are correct; no new data.

**Post-AUF**: handled by `computePostAuf()` already in PllSolver.ts.

---

## Decision 5 — Intuitive F2L: Hybrid Fluid Priority Loop

**Decision**: Fluid priority loop (scan all unsolved slots each iteration, work on easiest) + procedural positioning (U-turns, extraction) + small F2L_TRIGGERS table (~4 base trigger entries, right/left variants).

**Rationale**: Mirrors the tutorial's 3-step structure (Easy Inserts → Setup Pairs → Setup Inserts) while being state-driven rather than fixed-order. The trigger table is small (4 base cases from tutorial Step 1); all other mechanics are procedural.

**Tier 1 — Easy Insert** (both in top, directly insertable):
- 4 cases: connected-right `U R U' R'`, connected-left `U' L' U L`, disconnected-right `R U R'`, disconnected-left `L' U' L`
- Recognition: U-turns to position corner above target slot, match (cornerOrient, edge relative position) against table

**Tier 2 — Setup Insert** (both in top, needs setup):
- Sub-case: white-side, colours match → R-tuck: `R U' R'`, U-turn for edge, extract `R U R'` → now in tier 1
- Sub-case: white-side, colours don't match → tuck away from edge: `R U R'`, U-turn, `R U' R'` → tier 1
- Sub-case: white-up → park edge in back slot via U2 + R U' R', position corner, extract → tier 1

**Tier 3** (one in top, one in lower slot): `R U R'` extraction (or `L' U' L` for left-side pieces) → tier 2 or 1

**Tier 4** (both in lower slots): `R U R'` extraction of corner → tier 3

**Extraction from solved slots**: if a piece needed for the current slot is stuck in an already-solved slot, extract it (temporarily breaking that slot) and add a re-solve step for the broken slot before continuing. This is rare in practice.

---

## Decision 6 — No New Files

**Decision**: All new case data (EOLL_CASES, CPLL_CASES, EPLL_CASES, F2L_TRIGGERS) inlined in the existing `CaseLibrary.ts`. New solver functions added to existing `OllSolver.ts`, `PllSolver.ts`, `F2lSolver.ts`.

**Rationale**: EOLL adds 3 entries; CPLL/EPLL are computed filters; F2L_TRIGGERS adds ~8 entries. All small enough to inline without impacting readability. Avoids module graph changes.

---

## Decision 7 — Stage Output Order for Intuitive F2L

**Decision**: `solveF2lIntuitive()` returns stages in solve order (fluid priority order). The `cfop.worker.ts` iterates this array to push stages, capturing `buildF2lMask(state, label)` before each alg is applied (same pattern as current `solveF2l` handling).

**Rationale**: The stage array must be playable sequentially. If FL is solved before FR, the FL stage must appear first so the animation plays in the correct order. Stage labels identify which slot was solved; array position reflects when it was solved.
