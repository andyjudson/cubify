# Feature Specification: CFOP Solver Method Flags

**Feature Branch**: `035-cubify-solver-cfop-flags`  
**Created**: 2026-05-28  
**Status**: Complete ✅  

## Overview

The CFOP solver currently finds an optimal solution using full 4-slot F2L (best-fit order), 1-look OLL, and 1-look PLL. This feature adds a single `beginner` flag that switches the solver into a beginner-friendly mode:

- **F2L**: fluid priority loop — works on whichever pair is easiest at each step (directly insertable, both in top layer, split, or both stuck); inserts via recognisable triggers (R U R', L' U' L, etc.) rather than opaque optimal sequences.
- **OLL**: split into two stages — EOLL (orient edges only) then OCLL (orient corners only).
- **PLL**: split into two stages — CPLL (permute corners only) then EPLL (permute edges only).

All changes are contained within the existing CFOP solver internals. The public API gains one optional field on the existing options object. No new files are introduced.

## Clarifications

### Session 2026-06-08

- Q: Should the EOLL step use a separate 3-entry algorithm table (dot/bar/L-shape) rather than deriving from the existing 57-case OLL library? → A: Yes — separate 3-entry EOLL table; OCLL reuses the 7 matching entries from the existing OLL library.
- Q: Should `f2lMethod: 'intuitive'` use a full 41-entry case-lookup table, procedural step-by-step logic, or a hybrid approach? → A: Option C — hybrid: procedural positioning (U-turns to bring corner above target slot + extraction when pieces are in a lower slot) plus a small ~14-entry trigger table for the final insertion. Goal is learning the *stages* (easy inserts, then setup pairs for inserts) rather than memorising algorithms.
- Q: Should the solver insert a pair immediately when already in a directly-insertable position, and should this apply across all unsolved slots not just the current target? → A: Fully fluid priority loop — at each step, scan all unsolved slots and work on whichever pair is in the easiest state: (1) pair already connected and directly insertable → apply trigger immediately; (2) both pieces in the top layer → pair and insert; (3) one piece in top layer, one in lower slot → extract, pair, insert; (4) both stuck in lower slots → extract, pair, insert. No fixed slot order; solve order in the output reflects whichever slot was easiest at each step.
- Note: FR is the preferred insert target (R-move triggers); FL is secondary (L-move triggers). BR and BL are not primary insert targets — they are used as hiding slots to temporarily park pieces and clear the top layer during active pair setup. Pairs belonging to BR/BL are solved via the FR/FL working area with a U-move to position the finished pair above the back slot before inserting. Two distinct hiding mechanics: (A) single R or R' tuck — corner moves to DFR with white still visible on the side face, U-layer freely positions the edge, then extract back (used in Setup Insert cases 1 and 2); (B) back-slot park — edge is temporarily placed in a back slot while the corner is positioned above it, then extracted and paired (used in Setup Insert case 3, white-up).

---

## User Scenarios & Testing

### User Story 1 — 2-Look OLL and PLL (Priority: P1)

A developer building a learning app wants the solver to demonstrate the 2-look OLL + 2-look PLL approach: first orient edges, then orient corners, then permute corners, then permute edges. This is the most common beginner-to-intermediate progression and is already reflected in the algorithm sets the app ships.

**Why this priority**: 2-look is the most-taught next step after learning the basic CFOP structure. The existing visualiser already groups algorithms into 2-look sets — a solver that matches that grouping makes the two halves of the app coherent.

**Independent Test**: With `beginner: true`, a scramble produces a solution whose stages are `cross → f2l × 4 → oll-edges → oll-corners → pll-corners → pll-edges` instead of the default `… → oll → pll`.

**Acceptance Scenarios**:

1. **Given** a scrambled cube, **When** the solver runs with `beginner: true`, **Then** the solution contains exactly 9 stages: cross, 4 × F2L, OLL-edges, OLL-corners, PLL-corners, PLL-edges.
2. **Given** a scrambled cube, **When** the solver runs with default options, **Then** the solution contains the existing 7 stages and is unchanged.
3. **Given** a cube whose OLL edges are already oriented, **When** `beginner: true`, **Then** the OLL-edges stage is present with an empty alg (zero moves), not omitted.
4. **Given** a cube that is PLL-skip, **When** `beginner: true`, **Then** both PLL stages are present with empty algs.

---

### User Story 2 — Intuitive F2L Method (Priority: P2)

A developer wants the solver to demonstrate intuitive F2L: for each slot, the solver shows how to bring the corner and edge pieces to the top layer, connect them as a pair above the target slot, and then insert with a simple trigger (R U R', L' U' L, etc.). This follows the same step-by-step strategy taught on the intuitive F2L page — easy direct inserts, U-turn setups, pair connection, insert — rather than producing an optimal but opaque algorithm sequence.

**Why this priority**: Useful for learning tools that want to explain *why* each move is made, not just what moves to make. Lower priority than 2-look OLL/PLL because intuitive F2L is a more involved solver strategy change.

**Independent Test**: With `beginner: true`, each F2L stage's `alg` decomposes into recognisable setup moves followed by a standard insertion trigger. Stages appear in solve order, reflecting the fluid priority loop — the slot worked on at each step is whichever had the easiest pair state, not a fixed sequence.

**Acceptance Scenarios**:

1. **Given** a scrambled cube, **When** solved with `beginner: true`, **Then** the F2L stage that appears first in the solution is whichever slot had the easiest pair state at the start (not necessarily FR).
2. **Given** a scrambled cube where the FL pair is directly insertable at the start and FR is not, **When** solved with `beginner: true`, **Then** the `f2l-fl` stage appears before `f2l-fr` in the solution.
3. **Given** a scrambled cube, **When** solved with default options, **Then** F2L stages reflect current best-fit order and algorithm search (unchanged).
4. **Given** a cube where the FR slot is already solved, **When** `beginner: true`, **Then** the `f2l-fr` stage is present with an empty alg (zero moves).
5. **Given** a pair that is already connected and positioned above its slot, **When** `beginner: true`, **Then** the stage alg is only the insertion trigger — no unnecessary U-turns prepended.

---

### Edge Cases

- What happens when a stage produces zero moves (piece already in place)? Stage must still appear in the solution with an empty `alg` and correct `label`/`mask`.
- What is the stage label and mask for OLL-edges vs OLL-corners? Must be distinct values so consumers can apply the correct visualisation.
- A pair whose corner or edge is stuck in a lower slot needs to be extracted first — the intuitive method must handle this (extraction counts as part of the stage alg for that slot).

## Requirements

### Functional Requirements

- **FR-001**: The solver options object MUST accept an optional `beginner` boolean flag (default `false`).
- **FR-002**: When `beginner` is `true`, the solver MUST use intuitive F2L: a fully fluid priority loop where at each step all unsolved slots are scanned and the pair in the highest-priority state is worked on. Priority order (highest to lowest): (1) Easy Insert — both pieces in the top layer and already in a directly-insertable configuration → apply trigger immediately; (2) Setup Insert — both pieces in the top layer but not yet paired/oriented → tuck-hide or back-slot-park to position, then trigger; (3) one piece in the top layer, one in a lower slot → extract the lower piece, then apply tier 1 or 2; (4) both pieces in lower slots or pair misaligned in slot → extract as needed, then apply tier 1, 2, or 3. FR is the preferred insert target (R-move triggers); FL is secondary (L-move triggers). BR and BL are used as hiding slots or holding slots for U-move positioning, not as primary insert targets. F2L stages in the solution appear in the order the solver actually worked on each slot.
- **FR-003**: When `beginner` is `true`, the solver MUST split the OLL stage into two sequential stages: OLL-edges (orient edges only) and OLL-corners (orient corners only).
- **FR-004**: When `beginner` is `true`, the solver MUST split the PLL stage into two sequential stages: PLL-corners (permute corners only) and PLL-edges (permute edges only).
- **FR-005**: When `beginner` is `true`, each F2L slot MUST be solved using the intuitive strategy: extract pieces to the top layer if needed, position pair above target slot using U turns, connect corner and edge, insert with a standard trigger.
- **FR-006**: All solution stages MUST be present in the output even when a stage requires zero moves; empty stages have an empty `alg` string.
- **FR-007**: Each new stage type MUST have a distinct `label` and a valid `mask` value (a recognised stickering preset or orbit string).
- **FR-008**: Default solver behaviour (`beginner` not set or `false`) MUST be identical to the current implementation — no regressions.

### Key Entities

- **SolveStage**: Existing — `label`, `alg`, `mask`, `caseName`, `wcaId`. New stage labels needed: `oll-edges`, `oll-corners`, `pll-corners`, `pll-edges`.
- **CfopSolverOptions**: Existing — gains `beginner?: boolean`.
- **2-look OLL case library**: Two separate tables — (1) EOLL: 3 edge-orientation algs (dot, bar/line, L-shape), a new table not derivable from the existing 57-case OLL library; (2) OCLL: 7 corner-orientation cases reused from the existing OLL library (the subset where U-layer edges are already oriented).
- **2-look PLL case library**: Subset of PLL cases — corner-only permutations and edge-only permutations. Derivable from the existing library.
- **Intuitive F2L trigger table**: A small table covering the pair configurations when the corner is above FR or FL — each entry maps a (corner orientation, edge position relative to corner) to a standard insertion trigger (R U R', R U' R', L' U' L, L' U L, etc.). FR-insert and FL-insert triggers form two mirrored sets. Positioning (U-turns), extraction (pieces in lower slots), hiding (temporarily parking a piece in a back slot), and U-move positioning for back-slot inserts are all handled procedurally.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All existing 239 Vitest tests continue to pass with no regressions.
- **SC-002**: New tests cover all acceptance scenarios for each user story (minimum 9 new test cases).
- **SC-003**: A scrambled cube solved with `beginner: true` produces exactly 9 stages — verifiable in tests for a representative set of scrambles.
- **SC-004**: A scrambled cube solved with `beginner: true` produces F2L stages in fluid solve order — the slot worked on at each step is the one with the easiest pair state at that moment. Verifiable in tests using scrambles where the easiest slot is not FR.
- **SC-005**: Solve time with flags enabled is within 2× the current solve time for the same scramble.

## Assumptions

- The 2-look OLL implementation requires a new 3-entry EOLL algorithm table (dot, bar/line, L-shape) — this is not derivable from the existing 57-case OLL library. The OCLL portion (7 cases) does reuse entries from the existing OLL library.
- The 2-look PLL case library is a strict subset of the existing PLL library, filtered by which piece type the alg permutes.
- Stage masks for `oll-edges` and `oll-corners` are derivable from existing stickering presets or minor variants — no new stickering primitives needed.
- The intuitive F2L implementation is a hybrid: procedural U-turn positioning, extraction (when a piece is in a lower slot), and hiding (temporarily parking a piece in a back slot to clear the top layer). The trigger table covers FR-insert and FL-insert cases only — two mirrored sets of configurations. Pairs belonging to BR/BL slots are solved via the FR/FL working area and a U-move to slide the finished pair into the back slot. The trigger table is new data (not derived from the existing optimal F2L library) but small enough to inline in the existing solver file.
- When `f2lMethod` is `'intuitive'`, each slot is solved independently (treating pieces in previously solved slots as fixed); solution length per slot may be longer than optimal.
- No changes to the `CubeSolverCfop` facade constructor or worker protocol — the `beginner` flag travels as part of the solve message payload.
- No UI changes in this feature; consumers wire up the flags independently.
