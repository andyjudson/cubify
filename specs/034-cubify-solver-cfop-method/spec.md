# Feature Specification: CFOP Solver

**Feature Branch**: `034-cfop-solver`
**Created**: 2026-05-16
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Stage-Annotated CFOP Solution (Priority: P1)

A developer or app consumer passes a scrambled cube state to the CFOP solver and receives back a structured solution broken into four labelled stages (Cross, F2L, PLL, OLL), each with its own move sequence. The consumer can feed each stage's moves directly into CubePlayer and apply the matching mask preset for that stage.

**Why this priority**: This is the core deliverable — a structured, human-readable solve that maps onto existing library primitives. All other stories build on it.

**Independent Test**: Pass a known scrambled state; verify the output contains four non-empty stage sequences; verify applying all four sequences in order from the scrambled state produces the solved state.

**Acceptance Scenarios**:

1. **Given** a fully scrambled cube state, **When** the solver is called, **Then** it returns a `CfopSolution` with four stage sequences (cross, f2l, oll, pll) that together restore the cube to solved.
2. **Given** a cube state that is already solved, **When** the solver is called, **Then** all four stage sequences are empty (or the result signals already-solved).
3. **Given** a cube state with only the cross unsolved, **When** the solver is called, **Then** only the cross stage contains moves; F2L, OLL, PLL are empty.

---

### User Story 2 — Per-Stage Replay in CubePlayer (Priority: P2)

A consumer uses the solver output to drive CubePlayer stage by stage — loading each stage's alg with the corresponding mask preset so the viewer sees only the relevant pieces highlighted at each step.

**Why this priority**: This is the primary UX motivation — structured solve with visual stage context. Depends on US1.

**Independent Test**: Load cross alg with cross mask, play it; load F2L alg with F2L mask, play it; verify cube state advances correctly at each boundary.

**Acceptance Scenarios**:

1. **Given** a `CfopSolution`, **When** the cross alg is loaded into CubePlayer with a cross mask preset, **Then** only bottom-layer edges are highlighted and the animation completes the cross.
2. **Given** a completed cross, **When** each F2L slot alg is loaded with its slot mask, **Then** the correct corner-edge pair is inserted and the mask highlights only that slot.
3. **Given** completed F2L, **When** the OLL alg is loaded with an OLL mask, **Then** the top face is oriented and the mask highlights the top layer.

---

### User Story 3 — Harness Integration (Priority: P3)

The development harness exposes a "Solve (cfop)" button alongside the existing solve button, which is relabelled "Solve (search)". Clicking "Solve (cfop)" runs the CFOP solver on the current cube state and plays back the solution stage by stage with automatic mask switching.

**Why this priority**: Validates the full pipeline end-to-end in a visible, interactive way. Useful for development and demonstration but not required for the library API itself.

**Independent Test**: Scramble the cube in the harness, click CFOP Solve, verify the cube animates through four distinct stages with the correct mask applied at each.

**Acceptance Scenarios**:

1. **Given** a scrambled cube in the harness, **When** "Solve (cfop)" is clicked, **Then** the cube plays through Cross → F2L → OLL → PLL with mask transitions between stages.
2. **Given** a solve in progress, **When** the user pauses, **Then** the current stage and mask state are preserved.

---

### Edge Cases

- What happens when the cube state is invalid (unsolvable permutation)?
- How does the solver handle a cube already partially solved (e.g., cross done, F2L slots filled)?
- What if OLL or PLL recognition finds no matching case (state corruption or unrecognised pattern)?
- How does the solver handle a cube orientation where white is not on the bottom face?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The solver MUST accept a cube state and return a structured solution with four labelled stage sequences: Cross, F2L, OLL, PLL.
- **FR-002**: Applying the four stage sequences in order from the input state MUST produce the solved state.
- **FR-003**: The Cross stage MUST begin with a `z2` cube rotation to orient white to the bottom face, followed by the cross moves. The full cross stage (including `z2`) MUST be 9 moves or fewer.
- **FR-004**: Each F2L slot MUST be solved independently; the solver MUST recognise the current corner-edge pair state for that slot and produce an insertion sequence.
- **FR-005**: OLL MUST be solved by recognising the top-face orientation pattern against the full set of 57 cases and returning the known algorithm for that case.
- **FR-006**: PLL MUST be solved by recognising the top-layer permutation pattern against the full set of 21 cases and returning the known algorithm for that case.
- **FR-007**: The solver MUST run off the main thread (in a worker) so it does not block rendering or UI.
- **FR-008**: Each stage sequence MUST be expressed in standard WCA notation, compatible with CubePlayer's `loadAlg()`.
- **FR-009**: The solver MUST expose the stage label for each sequence so consumers can select the appropriate mask preset without hardcoding stage order.
- **FR-010**: The solver MUST return an error (not hang) if the input state is invalid or unsolvable.

### Key Entities

- **CfopSolution**: The structured result — four named stage sequences (cross, f2l, oll, pll) plus optional metadata (move counts per stage, recognised OLL/PLL case names).
- **SolveStage**: One named stage with its move sequence — label, alg string, and suggested mask preset name.
- **OLL/PLL case library**: The 57 OLL and 21 PLL cases with their recognition fingerprints and canonical alg strings. Sourced from the existing cfop-app JSON data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Given any valid scrambled cube state, the solver returns a complete four-stage solution in under 5 seconds.
- **SC-002**: Applying the four stage sequences in order from the scrambled state produces the solved state in 100% of tested inputs.
- **SC-003**: The Cross stage solution (including the opening `z2` rotation) is 9 moves or fewer for 100% of inputs.
- **SC-004**: OLL and PLL stages each return a single algorithm matching a named case from the respective case library.
- **SC-005**: A developer can integrate the solver with CubePlayer in under 20 lines of consuming code, using the stage label to select mask presets without manual mapping.

## Assumptions

- The cube state input is a valid, solvable 3×3 KPattern (same format used by CubePlayer and CubeScramble).
- The OLL and PLL case libraries (alg strings + case recognition fingerprints) will be ported from the existing cfop-app JSON data files.
- The solver handles orientation internally. The cross stage alg always begins with `z2` to rotate white to the bottom face; all subsequent stages (F2L, OLL, PLL) operate in that rotated orientation. The caller does not need to pre-rotate the state.
- The solver targets the browser (web worker) environment — Node.js compatibility is not required for Phase 1.
- 2-look OLL/PLL variants are out of scope; the solver uses the full 57 OLL + 21 PLL case sets for single-look recognition.
- Move count optimisation within each stage is not a primary goal; recognisable, correct algs take priority over shortest possible sequences.
