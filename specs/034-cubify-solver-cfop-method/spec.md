# Feature Specification: CFOP Solver

**Feature Branch**: `034-cfop-solver`
**Created**: 2026-05-16
**Status**: Draft

## Clarifications

### Session 2026-05-17

- Q: What is the error contract when the solver fails (invalid state, unsolvable, OLL/PLL no-match)? → A: Rejected Promise / thrown Error — mirrors `CubeSolver` API.
- Q: How does the consumer instantiate `CfopSolver`? → A: `new CfopSolver()` → `solve(state)` → `dispose()` — identical lifecycle to `CubeSolver`.
- Q: Should `CfopSolver` expose `cancel()`? → A: Yes — mirrors `CubeSolver`, consistent API for harness and consumers.
- Q: Does `totalMoves` count rotations or HTM face moves only? → A: HTM only — cube rotations (`z2`, `y`) excluded from the count.
- Q: Should `CfopSolver` support Node.js as well as the browser? → A: Browser only for Phase 1. Node.js / CLI variant is a future idea (potential `/cubify` skill extension or standalone CLI).

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
- **FR-007**: The solver MUST run off the main thread (in a worker) so it does not block rendering or UI. The public API is `new CfopSolver()` → `solve(state): Promise<CfopSolution>` → `dispose()`, identical in shape to `CubeSolver`. `cancel()` MUST be exposed to abort an in-progress solve, causing the Promise to reject.
- **FR-008**: Each stage sequence MUST be expressed in standard WCA notation, compatible with CubePlayer's `loadAlg()`.
- **FR-009**: The solver MUST expose the stage label for each sequence so consumers can select the appropriate mask preset without hardcoding stage order.
- **FR-010**: The solver MUST reject with an Error (not hang) if the input state is invalid, unsolvable, or if OLL/PLL recognition finds no matching case. The API mirrors `CubeSolver.solve()` — consumers use `.catch()` / `try/catch` with `await`.

### Key Entities

- **CfopSolution**: The structured result — `stages: SolveStage[]` (ordered: cross, f2l×4, oll, pll) plus `totalMoves: number` (HTM face moves only; cube rotations such as `z2` and `y` are excluded).
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
- The solver targets the browser (web worker) environment — Node.js compatibility is out of scope for Phase 1. A Node.js-compatible CLI variant (e.g. as a `/cubify` skill extension) is a future idea but not planned here.
- 2-look OLL/PLL variants are out of scope; the solver uses the full 57 OLL + 21 PLL case sets for single-look recognition.
- Move count optimisation within each stage is not a primary goal; recognisable, correct algs take priority over shortest possible sequences.

## Solver Approach — Design Decisions

### Stage strategies

| Stage | Approach | Rationale |
|-------|----------|-----------|
| Cross | IDA* search, ≤9 moves | Short enough for exhaustive search; no case library needed |
| F2L | IDA* search per slot, cross-preserving move set | See below |
| OLL | Fingerprint → lookup in `algs-cfop-oll.json` | 57 cases is a complete, finite state space |
| PLL | Fingerprint → lookup in `algs-cfop-pll.json` | 21 cases is a complete, finite state space |

### F2L: why IDA* not case lookup

`algs-cfop-f2l.json` is a human-learner flashcard set, not a machine-readable fingerprint table. It covers the 41 standard cases relative to the front-right slot, but building a recognition fingerprint for each case (corner orientation × edge orientation × relative position, across all AUF variants) is non-trivial and was never the file's purpose.

IDA* per slot is simpler to implement correctly — the search infrastructure already exists from the 2-phase solver — and handles all piece configurations uniformly with no fingerprinting required. The move set is constrained to cross-preserving moves; each search is shallow (F2L pairs typically insert in 6–8 moves).

The front-right lock-in approach (rotate cube per slot, apply canonical case) is valid and is how human speedsolvers think about F2L, but the fingerprinting overhead isn't justified here.

### F2L solution structure

F2L is returned as **4 per-slot substages** (`f2l-fr`, `f2l-br`, `f2l-bl`, `f2l-fl`) rather than one concatenated sequence. This enables per-pair mask switching in CubePlayer (US2) and aligns with FR-004. Slot order is fixed; greedy ordering (cheapest slot next) is a future optimisation.

### OLL: fingerprint and lookup

OLL recognition operates on the top layer after F2L is complete. The fingerprint is the orientation pattern of the 8 U-layer pieces — for each of the 4 corners, which face shows the top colour; for each of the 4 edges, whether the top colour is on the U face or a side face. This gives a compact pattern that maps 1:1 to one of the 57 cases (or a skip if the top face is already fully oriented).

Because the same OLL pattern can appear in up to 4 rotational positions on the cube, recognition tries all 4 U-rotations of the fingerprint and matches against the case library. The matching rotation becomes the pre-AUF prefix emitted before the case alg. No `y` moves appear in the OLL JSON, so the alg string is used as-is.

The JSON provides `name` (e.g. "Sune") and `wca_id` (e.g. 27) as bonus metadata, usable as `caseName` in the `SolveStage` output.

### PLL: fingerprint, lookup, and final AUF

PLL recognition operates after OLL. The fingerprint is the permutation of the 8 U-layer pieces — where each corner and edge currently sits relative to where it needs to go. As with OLL, all 4 U-rotations are tried to find the matching case; the matching rotation is the pre-AUF prefix.

After the PLL alg is applied the top layer is correctly permuted but may need a final U rotation to align with the side faces. This final AUF is computed after applying the alg and emitted as a suffix move (U, U', U2, or nothing). It is included in the `pll` stage alg string so consumers can load the full stage sequence into CubePlayer without further adjustment.

The JSON covers all 21 WCA PLL cases (Ua–Gd) plus no skip case — a skip (already permuted) is handled as an empty alg. No `y` moves appear, so alg strings are used as-is.