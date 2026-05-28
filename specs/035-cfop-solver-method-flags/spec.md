# Feature Specification: CFOP Solver Method Flags

**Feature Branch**: `035-cfop-solver-method-flags`  
**Created**: 2026-05-28  
**Status**: Draft  

## Overview

The CFOP solver currently finds an optimal solution using full 4-slot F2L, 1-look OLL, and 1-look PLL. This feature adds method flags so the solver can operate in beginner and intermediate modes — specifically a front-right-first F2L insertion order and a 2-look approach for OLL and PLL. All changes are contained within the existing CFOP solver internals; the public API gains two optional fields on the existing options object.

## User Scenarios & Testing

### User Story 1 — 2-Look OLL and PLL (Priority: P1)

A developer building a learning app wants the solver to demonstrate the 2-look OLL + 2-look PLL approach: first orient edges, then orient corners, then permute corners, then permute edges. This is the most common beginner-to-intermediate progression and is already reflected in the existing algorithm sets the app ships.

**Why this priority**: 2-look is the most-taught next step after beginner CFOP. The existing `cfop-app` visualiser already groups algorithms into 2-look sets — a solver that matches that grouping makes the two halves of the app coherent.

**Independent Test**: With the flag enabled, a solved scramble produces a solution whose stages are `cross → f2l-fr → f2l-fl → f2l-br → f2l-bl → oll-edges → oll-corners → pll-corners → pll-edges` instead of the default `... → oll → pll`.

**Acceptance Scenarios**:

1. **Given** a scrambled cube, **When** the solver runs with `twoLook: true`, **Then** the solution contains exactly 9 stages: cross, 4 × F2L, OLL-edges, OLL-corners, PLL-corners, PLL-edges.
2. **Given** a scrambled cube, **When** the solver runs with the default options (no `twoLook`), **Then** the solution contains the existing 7 stages and is unchanged.
3. **Given** a cube whose OLL edges are already oriented, **When** `twoLook: true`, **Then** the OLL-edges stage is present with an empty alg (zero moves), not omitted.
4. **Given** a cube that is PLL-skip, **When** `twoLook: true`, **Then** both PLL stages are present with empty algs.

---

### User Story 2 — Beginner F2L Slot Order (Priority: P2)

A developer wants the solver to insert F2L pairs in a fixed beginner order (front-right first, then front-left, back-right, back-left) rather than choosing the globally best next slot. This mirrors how the intuitive F2L page teaches the method.

**Why this priority**: Useful for learning apps, but lower priority than 2-look OLL/PLL because full 4-slot F2L (even best-fit) is already an intermediate skill. Beginner order is a refinement within that skill level.

**Independent Test**: With `slotOrder: 'fr-first'`, the solution stage labels always appear as `f2l-fr`, `f2l-fl`, `f2l-br`, `f2l-bl` in that order, regardless of which slot would be fastest to solve globally.

**Acceptance Scenarios**:

1. **Given** a scrambled cube, **When** solved with `slotOrder: 'fr-first'`, **Then** F2L stages appear in the fixed order: FR, FL, BR, BL.
2. **Given** a scrambled cube, **When** solved with default options, **Then** F2L stages reflect best-fit order (current behaviour, unchanged).
3. **Given** a cube where the FR slot is already solved, **When** `slotOrder: 'fr-first'`, **Then** the `f2l-fr` stage is present with an empty alg (zero moves).
4. **Given** both flags set (`twoLook: true` and `slotOrder: 'fr-first'`), **When** solved, **Then** both constraints apply — 9 stages in beginner order.

---

### Edge Cases

- What happens when a stage produces zero moves (piece already in place)? Stage must still appear in the solution with an empty `alg` and correct `label`/`mask`.
- What is the stage label and mask for OLL-edges vs OLL-corners? Must be distinct values so consumers can apply the correct visualisation.
- What if the cube state cannot be solved in a given mode (should not be possible for a valid scramble, but worth verifying)?

## Requirements

### Functional Requirements

- **FR-001**: The solver options object MUST accept an optional `twoLook` boolean flag (default `false`).
- **FR-002**: When `twoLook` is `true`, the solver MUST split the OLL stage into two sequential stages: OLL-edges (orient edges only) and OLL-corners (orient corners only).
- **FR-003**: When `twoLook` is `true`, the solver MUST split the PLL stage into two sequential stages: PLL-corners (permute corners only) and PLL-edges (permute edges only).
- **FR-004**: The solver options object MUST accept an optional `slotOrder` value of `'best-fit'` (default) or `'fr-first'`.
- **FR-005**: When `slotOrder` is `'fr-first'`, the solver MUST insert F2L pairs in the fixed order FR → FL → BR → BL.
- **FR-006**: All solution stages MUST be present in the output even when a stage requires zero moves; empty stages have an empty `alg` string.
- **FR-007**: Each new stage type MUST have a distinct `label` and a valid `mask` value (a recognised stickering preset or orbit string).
- **FR-008**: Default solver behaviour (no flags) MUST be identical to the current implementation — no regressions.
- **FR-009**: Both flags MUST be composable — `twoLook: true` combined with `slotOrder: 'fr-first'` MUST produce a valid 9-stage solution in beginner order.

### Key Entities

- **SolveStage**: Existing — `label`, `alg`, `mask`, `caseName`, `wcaId`. New stage labels needed: `oll-edges`, `oll-corners`, `pll-corners`, `pll-edges`.
- **CfopSolverOptions**: Existing — gains `twoLook?: boolean` and `slotOrder?: 'best-fit' | 'fr-first'`.
- **2-look OLL case library**: Subset of OLL cases — 2 edge-orientation cases (cross, dot) and 7 corner-orientation cases. Derivable from the existing 57-case library.
- **2-look PLL case library**: Subset of PLL cases — U-perms (Ua, Ub), H-perm for corners; A-perms, E-perm, Z-perm for edges (or equivalent minimal sets). Derivable from the existing library.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All existing 239 Vitest tests continue to pass with no regressions.
- **SC-002**: New tests cover all 4 acceptance scenarios for each user story (minimum 8 new test cases).
- **SC-003**: A scrambled cube solved with `twoLook: true` produces exactly 9 stages — verifiable in tests for a representative set of scrambles.
- **SC-004**: A scrambled cube solved with `slotOrder: 'fr-first'` produces F2L stages in the exact fixed order — verifiable in tests.
- **SC-005**: Solve time with flags enabled is within 2× the current solve time for the same scramble (flags add filtering/ordering logic, not additional search depth).

## Assumptions

- The 2-look OLL case library is a strict subset of the existing 57-case OLL library — no new algorithm data needed.
- The 2-look PLL case library is a strict subset of the existing PLL library — no new algorithm data needed.
- Stage masks for `oll-edges` and `oll-corners` are derivable from the existing `oll` and `pll-face-dim` presets or minor variants — no new stickering primitives needed.
- `slotOrder: 'fr-first'` solves each slot independently (treating prior-slot pieces as immovable); solution length may be longer than best-fit.
- No changes to the `CubeSolverCfop` facade constructor or worker protocol — flags travel as part of the solve message payload.
- No UI changes in this feature; consumers (e.g. cfop-app) wire up the flags independently.
