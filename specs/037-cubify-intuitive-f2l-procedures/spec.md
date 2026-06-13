# Feature Specification: Intuitive F2L Procedures (Beginner Solver)

**Feature Branch**: `037-cubify-intuitive-f2l-procedures`  
**Created**: 2026-06-13  
**Status**: Draft  
**Input**: User description: "Tightly map the beginner (intuitive) CFOP F2L solver output to the standard intuitive-F2L teaching method, so the on-screen moves match what a learner following the method would naturally do."

## Overview

The beginner (intuitive) CFOP solver exists to *teach*, not to be optimal. When a learner watches the solver work a first-two-layers (F2L) pair, every move on screen is part of the lesson: the learner is meant to recognise the same positional cues and reproduce the same short sequences they are being taught. Today the beginner solver mostly produces these tutorial-shaped sequences, but a minority of positions fall through to a generic search that can emit moves the learner has never seen — breaking the teaching contract even when the cube is solved correctly.

This feature makes the beginner solver's output a faithful, deliberate mirror of the standard intuitive F2L method. It encodes the method's decision tree as the primary source of moves, and keeps any search strictly as an invisible last resort. The advanced solver (separate feature 036) is unaffected — it may continue to choose freely from full algorithm sets.

## Clarifications

### Session 2026-06-13

- Q: When an encoded procedure and the search fallback could both solve a position, which wins? → A: The encoded procedure always wins; the search only runs when no procedure matches the position.
- Q: Is producing the *exact* canonical move sequence the goal, or only "a sequence a learner would recognise as the method"? → A: The latter — output must follow the method's logic and stay within the beginner move vocabulary and the taught procedure shape; it need not match any single source's exact spelling character-for-character.
- Q: How are back slots (BL/BR) handled — worked in place, or rotated to the front? → A: Rotated to the front. A back slot is brought to a front working position by a cube rotation, solved with the front-slot procedure, then the cube is squared back up — i.e. the front procedure is wrapped in a rotation conjugate (`y …front… y'` for BR→FR, `y' …front… y` for BL→FL; verified mapping). Mirrors how the learner physically turns the cube to bring the slot forward and squares it back afterwards. No back-face (B) moves are used.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner sees only moves the method teaches (Priority: P1)

A learner steps through a beginner-mode solve of an F2L pair. Every move shown belongs to the intuitive method they are learning: position the pair, keep the white sticker visible as the reference, set up, and insert. The learner can pause at any point and explain *why* each move was made using the method's own language.

**Why this priority**: This is the entire purpose of the beginner solver. If the moves don't match the method, the tool actively confuses the learner — worse than not existing.

**Independent Test**: Enumerate real F2L positions and confirm each solved pair uses only the beginner move vocabulary (U turns plus the working front slot's side face, with an optional leading cube rotation for back slots) and follows one of the taught procedure shapes, with no foreign moves appearing.

**Acceptance Scenarios**:

1. **Given** a pair with both pieces in the top layer directly insertable, **When** the beginner solver runs, **Then** it emits the easy-insert procedure with an alignment turn, and nothing longer.
2. **Given** a pair with both pieces in the top layer needing alignment, **When** the beginner solver runs, **Then** it emits a set-up-then-insert (or white-up hide-and-restore) procedure that keeps the white sticker visible as it sets up.
3. **Given** a pair where one piece is stuck in the slot, **When** the beginner solver runs, **Then** it first frees the piece keeping white visible on the side, then applies the matching insert procedure.

---

### User Story 2 - No surprising long sequences (Priority: P2)

For every reachable F2L position, the beginner solver produces a sequence whose length is in line with the taught procedures (a single pair is a short sequence, not a long unrecognisable one). The previously observed blow-ups (sequences far longer than the method would ever produce) no longer occur.

**Why this priority**: Long, unfamiliar sequences are the most visible symptom of the solver drifting away from the method. Eliminating them is the measurable proxy for "the output looks like the method."

**Independent Test**: Across the full enumeration, record the move count per pair and confirm no pair exceeds the length the taught procedures produce.

**Acceptance Scenarios**:

1. **Given** any enumerated F2L position, **When** the beginner solver solves the pair, **Then** the emitted sequence length does not exceed the procedure-derived maximum.

---

### User Story 3 - Coverage is measurable and complete (Priority: P3)

The team can see, at any moment, exactly how many real F2L positions are handled by an encoded procedure versus how many still fall through to the search safety net. This number is tracked and driven to zero, giving an objective definition of "the method is fully encoded."

**Why this priority**: Without a counter, "tightly mapped" is subjective. The counter turns the goal into a finishable, verifiable task and prevents silent regressions.

**Independent Test**: A repeatable check reports the fall-through count for all four slots; the team asserts it is at (or trending to) zero.

**Acceptance Scenarios**:

1. **Given** the full enumeration of F2L positions, **When** the coverage check runs, **Then** it reports the count of positions solved by a procedure and the count that fell through to the search.
2. **Given** the feature is complete, **When** the coverage check runs, **Then** the fall-through count is zero.

---

### Edge Cases

- **Already-paired / trivially solved slot**: the solver emits an empty or single alignment sequence, not a redundant procedure.
- **Back slots (BL/BR)**: retargeted to a front working position (FR/FL) by wrapping the front-slot procedure in a cube-rotation conjugate (`y …front… y'` for BR→FR, `y' …front… y` for BL→FL) — the learner rotates the cube to bring the slot forward, solves it, and squares the cube back up, rather than working it in place; no back-face (B) moves are introduced.
- **A position that no encoded procedure matches**: the search safety net solves it correctly and the position is counted as a fall-through (a backlog item to encode), never left unsolved.
- **A procedure that would disturb the cross or an already-finished pair**: rejected; the solver must keep the cross and previously-finished slots intact.
- **Symmetric / ambiguous recognition**: where the white sticker can face more than one taught direction, the procedure selection is deterministic (same input always yields the same procedure).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The beginner F2L solver MUST select its moves primarily from an encoded set of intuitive-method procedures: easy insert, set-up-pair-then-insert, white-up (hide the edge into a back slot then re-pair), and the stuck-in-slot branches keyed by which way the white sticker faces.
- **FR-002**: Each procedure MUST be parameterised by a U-layer alignment (AUF) prefix and a left/right mirror, so one front-slot procedure definition serves both front slots. Back slots (BL/BR) MUST be retargeted to a front working position by wrapping the front-slot procedure in a cube-rotation conjugate (a leading rotation that brings the slot forward and a trailing inverse rotation that squares the cube back up — `y …front… y'` for BR→FR, `y' …front… y` for BL→FL) — not worked in place with a back face. A complete front-slot (FR/FL) procedure set therefore covers the back slots automatically.
- **FR-003**: When setting up or hiding a corner, the solver MUST choose the U-turn direction that keeps the white sticker visible on a side face — the positional reference the method relies on.
- **FR-004**: Encoded procedures MUST be the primary emitter. The existing constrained slot-face search MUST be used only as a last-resort safety net when no procedure matches, and MUST NOT override a procedure that matches.
- **FR-005**: Every emitted sequence MUST round-trip: applying the case setup and then the solver's sequence solves the target pair while leaving the cross and all previously-finished pairs intact.
- **FR-006**: Emitted sequences MUST use only the beginner move vocabulary — U-layer turns, the working (front) slot's outer side-face turn (R or L), and cube rotations (`y` / `y'`) used solely as the conjugating wrapper that brings a back slot to the front working position and squares the cube back up. No back-face (B), wide, or slice moves appear.
- **FR-007**: The solver MUST provide a measurable coverage signal (a "fall-through counter") reporting, over an enumeration of real F2L positions across all four slots, how many are solved by a procedure versus the search fallback.
- **FR-008**: Procedure definitions MUST be authored in the project's own geometric terms (corner position/orientation, edge position/orientation, white-facing direction, in the established solver frame). No external tutorial, PDF, or third-party material is cited, copied, or transcribed.
- **FR-009**: Procedure selection MUST be deterministic — identical input positions always yield the identical procedure and sequence.
- **FR-010**: The change MUST NOT alter the public API and MUST NOT affect the advanced solver or the 2-look OLL/PLL stages.

### Key Entities

- **F2L Pair Position**: the state of one corner+edge pair relative to its target slot — described by the pieces' locations (top layer vs. in slot), their orientations, and which way the white sticker faces. The input that procedure selection keys off.
- **Intuitive Procedure**: one taught move-shape (easy insert, set-up-then-insert, white-up, stuck-in-slot branches), parameterised by AUF prefix and left/right mirror, that emits a short sequence in the beginner vocabulary.
- **Coverage Report (fall-through counter)**: a count, over the enumerated position set, of positions solved by a procedure vs. the search fallback — the success metric.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across the full enumeration of real F2L positions for all four slots, 100% of positions are solved by an encoded procedure (fall-through count = 0) at feature completion.
- **SC-002**: 100% of emitted sequences round-trip correctly (target pair solved; cross and finished pairs intact) — zero failures.
- **SC-003**: 100% of emitted sequences use only the beginner vocabulary (U-layer turns, the working front slot's side face, and `y` / `y'` cube rotations as the conjugating wrapper for back slots); zero sequences contain a back-face, wide, or slice move.
- **SC-004**: No emitted single-pair sequence exceeds the maximum length produced by the taught procedures (no blow-ups); the previously observed long sequences are eliminated.
- **SC-005**: A reviewer can map every move of any beginner-mode F2L solve back to a named step of the method (qualitative acceptance: "this is recognisably the method").

## Assumptions

- The current extraction logic (bringing a wrong-slot or stuck piece up into the top layer) is reused as a normalisation step before procedure selection; the recovery of pieces from arbitrary wrong slots is not re-derived here.
- The beginner move vocabulary is U-layer turns plus the working front slot's outer side-face turn, with `y` / `y'` cube rotations permitted as the conjugating wrapper that brings a back slot to a front working position and squares the cube back up; no back-face, wide, or slice moves.
- The constrained slot-face search already exists and is correct; this feature reuses it unchanged as the demoted safety net.
- The enumeration of "real F2L positions" covers both-pieces-in-top and one-piece-stuck-in-slot cases for all four slots, generated from the solved state using the beginner vocabulary — sufficient to characterise the method's domain.
- The advanced recognition-table work (feature 036) is separate and unchanged; the two solvers are deliberately different mechanisms.
- Existing beginner-solver tests (9-stage solution, round-trip, OLL/PLL stages) continue to pass unchanged.
