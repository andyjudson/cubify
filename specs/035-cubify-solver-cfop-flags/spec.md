# Feature Specification: CFOP Solver Method Flags

**Feature Branch**: `035-cubify-solver-cfop-flags`  
**Created**: 2026-05-28  
**Status**: Draft  

## Overview

The CFOP solver currently finds an optimal solution using full 4-slot F2L (best-fit order), 1-look OLL, and 1-look PLL. This feature adds two method flags so the solver can operate in beginner and intermediate modes:

- **`twoLook`** — splits OLL into edge-orientation + corner-orientation and PLL into corner-permutation + edge-permutation, matching the 2-look approach taught to beginners.
- **`f2lMethod: 'intuitive'`** — changes how each F2L slot is solved: rather than searching for the shortest algorithm, the solver follows the intuitive strategy (recognise pair, bring pieces to the top layer, connect corner and edge above the target slot, insert with a standard trigger). This implies FR → FL → BR → BL ordering as a natural consequence of working systematically through the slots.

All changes are contained within the existing CFOP solver internals. The public API gains two optional fields on the existing options object. No new files are introduced.

## User Scenarios & Testing

### User Story 1 — 2-Look OLL and PLL (Priority: P1)

A developer building a learning app wants the solver to demonstrate the 2-look OLL + 2-look PLL approach: first orient edges, then orient corners, then permute corners, then permute edges. This is the most common beginner-to-intermediate progression and is already reflected in the algorithm sets the app ships.

**Why this priority**: 2-look is the most-taught next step after learning the basic CFOP structure. The existing visualiser already groups algorithms into 2-look sets — a solver that matches that grouping makes the two halves of the app coherent.

**Independent Test**: With the flag enabled, a scramble produces a solution whose stages are `cross → f2l × 4 → oll-edges → oll-corners → pll-corners → pll-edges` instead of the default `… → oll → pll`.

**Acceptance Scenarios**:

1. **Given** a scrambled cube, **When** the solver runs with `twoLook: true`, **Then** the solution contains exactly 9 stages: cross, 4 × F2L, OLL-edges, OLL-corners, PLL-corners, PLL-edges.
2. **Given** a scrambled cube, **When** the solver runs with default options, **Then** the solution contains the existing 7 stages and is unchanged.
3. **Given** a cube whose OLL edges are already oriented, **When** `twoLook: true`, **Then** the OLL-edges stage is present with an empty alg (zero moves), not omitted.
4. **Given** a cube that is PLL-skip, **When** `twoLook: true`, **Then** both PLL stages are present with empty algs.

---

### User Story 2 — Intuitive F2L Method (Priority: P2)

A developer wants the solver to demonstrate intuitive F2L: for each slot, the solver shows how to bring the corner and edge pieces to the top layer, connect them as a pair above the target slot, and then insert with a simple trigger (R U R', L' U' L, etc.). This follows the same step-by-step strategy taught on the intuitive F2L page — easy direct inserts, U-turn setups, pair connection, insert — rather than producing an optimal but opaque algorithm sequence.

**Why this priority**: Useful for learning tools that want to explain *why* each move is made, not just what moves to make. Lower priority than 2-look OLL/PLL because intuitive F2L is a more involved solver strategy change.

**Independent Test**: With `f2lMethod: 'intuitive'`, each F2L stage's `alg` decomposes into recognisable setup moves followed by a standard insertion trigger, and stages always appear in FR → FL → BR → BL order.

**Acceptance Scenarios**:

1. **Given** a scrambled cube, **When** solved with `f2lMethod: 'intuitive'`, **Then** F2L stages appear in the fixed order: FR, FL, BR, BL.
2. **Given** a scrambled cube, **When** solved with default options, **Then** F2L stages reflect current best-fit order and algorithm search (unchanged).
3. **Given** a cube where the FR slot is already solved, **When** `f2lMethod: 'intuitive'`, **Then** the `f2l-fr` stage is present with an empty alg (zero moves).
4. **Given** both flags set (`twoLook: true` and `f2lMethod: 'intuitive'`), **When** solved, **Then** both constraints apply — 9 stages in intuitive F2L order.
5. **Given** a pair that can be inserted directly without setup, **When** `f2lMethod: 'intuitive'`, **Then** the stage alg reflects a direct insert (no unnecessary U-turn preamble).

---

### Edge Cases

- What happens when a stage produces zero moves (piece already in place)? Stage must still appear in the solution with an empty `alg` and correct `label`/`mask`.
- What is the stage label and mask for OLL-edges vs OLL-corners? Must be distinct values so consumers can apply the correct visualisation.
- A pair whose corner or edge is stuck in a lower slot needs to be extracted first — the intuitive method must handle this (extraction counts as part of the stage alg for that slot).

## Requirements

### Functional Requirements

- **FR-001**: The solver options object MUST accept an optional `twoLook` boolean flag (default `false`).
- **FR-002**: When `twoLook` is `true`, the solver MUST split the OLL stage into two sequential stages: OLL-edges (orient edges only) and OLL-corners (orient corners only).
- **FR-003**: When `twoLook` is `true`, the solver MUST split the PLL stage into two sequential stages: PLL-corners (permute corners only) and PLL-edges (permute edges only).
- **FR-004**: The solver options object MUST accept an optional `f2lMethod` value of `'optimal'` (default) or `'intuitive'`.
- **FR-005**: When `f2lMethod` is `'intuitive'`, the solver MUST solve F2L slots in fixed FR → FL → BR → BL order.
- **FR-006**: When `f2lMethod` is `'intuitive'`, each slot MUST be solved using the intuitive strategy: extract pieces to the top layer if needed, position pair above target slot using U turns, connect corner and edge, insert with a standard trigger.
- **FR-007**: All solution stages MUST be present in the output even when a stage requires zero moves; empty stages have an empty `alg` string.
- **FR-008**: Each new stage type MUST have a distinct `label` and a valid `mask` value (a recognised stickering preset or orbit string).
- **FR-009**: Default solver behaviour (no flags set) MUST be identical to the current implementation — no regressions.
- **FR-010**: Both flags MUST be composable — `twoLook: true` combined with `f2lMethod: 'intuitive'` MUST produce a valid 9-stage solution.

### Key Entities

- **SolveStage**: Existing — `label`, `alg`, `mask`, `caseName`, `wcaId`. New stage labels needed: `oll-edges`, `oll-corners`, `pll-corners`, `pll-edges`.
- **CfopSolverOptions**: Existing — gains `twoLook?: boolean` and `f2lMethod?: 'optimal' | 'intuitive'`.
- **2-look OLL case library**: Subset of OLL cases — 2 edge-orientation cases and 7 corner-orientation cases. Derivable from the existing 57-case library by filtering on which piece type is being oriented.
- **2-look PLL case library**: Subset of PLL cases — corner-only permutations and edge-only permutations. Derivable from the existing library.
- **Intuitive F2L case library**: For each of the ~41 standard F2L cases, a solution expressed as setup moves + standard insertion trigger rather than an optimal algorithm. Covers direct inserts, U-turn positioning, and extraction-then-insert sequences.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All existing 239 Vitest tests continue to pass with no regressions.
- **SC-002**: New tests cover all acceptance scenarios for each user story (minimum 9 new test cases).
- **SC-003**: A scrambled cube solved with `twoLook: true` produces exactly 9 stages — verifiable in tests for a representative set of scrambles.
- **SC-004**: A scrambled cube solved with `f2lMethod: 'intuitive'` produces F2L stages in FR → FL → BR → BL order — verifiable in tests.
- **SC-005**: Solve time with flags enabled is within 2× the current solve time for the same scramble.

## Assumptions

- The 2-look OLL case library is a strict subset of the existing 57-case OLL library — no new algorithm data needed; cases are filtered by which piece type the alg orients.
- The 2-look PLL case library is a strict subset of the existing PLL library, filtered by which piece type the alg permutes.
- Stage masks for `oll-edges` and `oll-corners` are derivable from existing stickering presets or minor variants — no new stickering primitives needed.
- The intuitive F2L case library covers the same ~41 cases as standard F2L but with beginner-friendly algorithm expressions; this is new data, not a filter of existing data.
- When `f2lMethod` is `'intuitive'`, each slot is solved independently (treating pieces in previously solved slots as fixed); solution length per slot may be longer than optimal.
- No changes to the `CubeSolverCfop` facade constructor or worker protocol — flags travel as part of the solve message payload.
- No UI changes in this feature; consumers wire up the flags independently.
