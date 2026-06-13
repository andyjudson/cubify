# Feature Specification: CFOP F2L Recognition Table (Advanced Solver)

**Feature Branch**: `036-cubify-f2l-recognition-table`  
**Created**: 2026-06-13  
**Status**: Draft  
**Input**: User description: "036 — cubify-f2l-recognition-table: Give the advanced (default, non-beginner) CFOP F2L solver a canonical recognition→algorithm lookup table covering the standard F2L case set, replacing the IDA* search that currently discovers an arbitrary working sequence per slot. The advanced path works with full freedom — the curated/shared algorithm sets and cube rotations are allowed — preferring front-slot (FR/FL) solutions and using y/y' rotation wrappers for back slots. Case enumeration and algorithms are authored into a neutral in-repo case-data file as the ground truth. Existing extraction logic is retained only to normalize wrong-slot pieces into the top layer before recognition. IDA* remains a last resort. Output must round-trip. The beginner/intuitive path is governed separately (feature 037) and is NOT changed here."

## Context & Background

The cubify CFOP solver has two F2L paths. The **beginner (intuitive)** path is deliberately constrained to mirror how a learner is taught, and is governed by its own feature (037). The **advanced (default, non-beginner)** path has no such constraint — it should produce efficient, canonical, recognisable solutions and may freely use cube rotations and the project's curated algorithm sets.

Today the advanced path solves each F2L slot by **IDA\* search**: it discovers the first short sequence that lands the slot. That sequence is correct but arbitrary — it is not the canonical algorithm an advanced solver recognises for that case, it doesn't consistently prefer the cleaner front-slot solution, and it can't reuse the algorithm sets the project already curates. The result is solver output that is harder to recognise and reason about than it should be.

The standard F2L method enumerates the **41 standard F2L cases** as a finite, recognition-keyed set, each with a well-known short algorithm. This is exactly a lookup table: given where the corner and edge pieces are (and their orientations), there is a canonical answer. Encoding this table lets the advanced solver select the known-good algorithm directly — preferring front-slot solutions and wrapping back slots in a rotation — instead of discovering an arbitrary one by search.

This feature replaces the search-based core of the **advanced** F2L solver with that recognition table, while keeping the existing extraction step to first move any "stuck in the wrong slot" piece up into the top layer so the position reduces to one of the 41 standard cases.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Canonical algorithm for every standard F2L case (Priority: P1)

A user runs the advanced solver on a scrambled cube's F2L. For each of the four slots, when both target pieces are in (or reducible to) the top layer, the solver emits the **canonical algorithm the standard method recognises** for that case, rather than an IDA\*-derived equivalent that happens to work but looks arbitrary.

**Why this priority**: This is the core value — the advanced solver becomes recognisable and consistent, drawing on the curated algorithm sets instead of search output. Delivering just this story already replaces the bulk of the search-derived F2L output.

**Independent Test**: For each of the 41 standard cases, construct the case position (apply the documented case setup to a solved cube in the solver frame), run the advanced solver on the affected slot, and assert the emitted algorithm matches the canonical algorithm for that case (after AUF normalization) and that applying it solves the slot.

**Acceptance Scenarios**:

1. **Given** a cube where the FR corner and edge form a connected pair in the top layer, **When** the advanced solver solves the FR slot, **Then** it emits the canonical "easy insert" algorithm for that case (with any required AUF prefix) and the FR slot is solved.
2. **Given** a cube where the FR pieces form a disconnected (split) pair in the top layer, **When** the advanced solver solves the FR slot, **Then** it emits the canonical disconnected-pair algorithm and the slot is solved without a longer search-derived alternative.
3. **Given** a cube where the FR corner is already in its slot (mis-oriented) and the edge is in the top layer, **When** the advanced solver solves FR, **Then** it emits the canonical corner-in-slot algorithm.
4. **Given** any of the 41 standard cases in any AUF rotation, **When** the solver recognizes it, **Then** the correct canonical algorithm is selected and a correct AUF prefix is prepended so the algorithm applies in that rotation.

---

### User Story 2 - Back slots solved with full move freedom (Priority: P2)

When the advanced solver solves a back slot (BL or BR), it MAY work the slot directly — using back-slot moves (including back faces) from the curated algorithm sets — or wrap the equivalent front-slot canonical algorithm in a cube rotation (e.g. `y` / `y2`). Unlike the beginner path (feature 037), the advanced path is **not** forced to rotate every back slot to the front; it has the full move set available and may choose whichever yields the cleaner solution.

**Why this priority**: Back-slot freedom is what distinguishes the advanced path from the beginner path — it can avoid unnecessary rotations. The cube is still correctly solved either way, so this is a quality/efficiency layer on the core table.

**Independent Test**: For each standard case targeting a back slot, run the solver and assert the target slot is solved with the cross and previously-solved slots intact, and that the emitted solution is drawn from the curated algorithm set (a rotation-wrapped front-slot algorithm or an equivalent direct back-slot algorithm) rather than an arbitrary search result.

**Acceptance Scenarios**:

1. **Given** a standard case that needs solving in the BL or BR slot, **When** the solver produces a solution, **Then** the solution is a curated-algorithm solution for that slot — either the front-slot canonical algorithm wrapped in a cube rotation or a direct back-slot equivalent — and applying it solves the slot.
2. **Given** a back-slot solution, **When** it is applied to the cube, **Then** the target slot is solved and the cross plus all previously-solved slots remain intact.

---

### User Story 3 - Stuck (wrong-slot) pieces reduce to a standard case (Priority: P3)

When one or both target pieces are stuck in a *different* F2L slot (not the top layer, not the target slot), the solver first applies an extraction move to lift the stuck piece into the top layer, then recognizes and solves the resulting standard case from the table.

**Why this priority**: Necessary for full coverage of arbitrary scrambles, but it reuses the existing, working extraction logic and is less common than top-layer cases. It ensures the table-based path is reached for the maximum number of positions.

**Independent Test**: Construct positions with a piece stuck in a non-target slot, run the solver, and assert the slot is solved and the cross/previously-solved slots are preserved; confirm the recognition table was reached after extraction (the resulting sub-sequence matches a canonical case algorithm).

**Acceptance Scenarios**:

1. **Given** the target edge is stuck in a non-target F2L slot, **When** the solver runs, **Then** it extracts the edge to the top layer, recognizes the now-standard case, and solves the slot.
2. **Given** a position no table entry and no extraction resolves, **When** the solver runs, **Then** it falls back to the existing IDA\* search and still solves the slot (correctness preserved as a last resort).

---

### Edge Cases

- **Already-solved slot**: If a slot is already solved with the cross intact, the solver emits an empty algorithm for that slot (no change).
- **AUF skip**: When a case requires no AUF (offset zero), no leading U move is emitted; the algorithm is not padded with a redundant turn.
- **Pre-solved pair piece (keyhole)**: Cases where one of the two pieces is already correctly placed are recognized as their own standard cases; the table entry for that case is used rather than disturbing the placed piece unnecessarily.
- **Solved-slot preservation**: Every selected algorithm must leave the cross and all previously-solved F2L slots intact; an algorithm that solves the target slot but disturbs another is not a valid selection.
- **No matching table entry**: If recognition fails (position is not one of the 41 standard cases and cannot be reduced by extraction), the solver falls back to existing search so a solution is still returned.
- **Move cancellation**: An AUF prefix or rotation that is adjacent to the algorithm's first move must be simplified (e.g. `U' U2` → `U`) so output has no redundant consecutive same-face turns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The advanced F2L solver MUST recognize each of the 41 standard F2L cases (4 easy inserts, 10 disconnected pairs, 10 connected pairs, 6 corner-in-slot, 6 edge-in-slot, 5 both-pieces-in-slot) from the position of the target corner and edge pieces and their orientations.
- **FR-002**: For each recognized standard case, the solver MUST select the canonical algorithm defined for that case in the in-repo case-data file, in preference to any search-derived alternative.
- **FR-003**: The solver MUST compute and prepend a correct AUF (U-turn) prefix so the selected canonical algorithm applies regardless of the case's U-layer rotation, omitting the prefix when no adjustment is needed.
- **FR-004**: For front slots (FR, FL) the solver MUST emit the front-slot canonical algorithm directly. For back slots (BL, BR) the solver MAY either wrap the equivalent front-slot canonical algorithm in a cube rotation (e.g. `y` / `y2`) OR solve the slot directly with back-slot moves (including back faces) from the curated algorithm sets. The advanced path has the full move set and curated algorithm sets available and is NOT forced to rotate back slots to the front — in contrast to the beginner path (feature 037), which must rotate and may not use back faces.
- **FR-005**: Before recognition, the solver MUST extract any target piece stuck in a non-target F2L slot up into the top layer using the existing extraction logic, so the position reduces to a standard case.
- **FR-006**: Every algorithm the solver selects or constructs MUST, when applied, solve the target slot while leaving the cross and all previously-solved F2L slots intact.
- **FR-007**: The solver MUST retain the existing IDA\* search strictly as a last-resort fallback, used only when neither the recognition table nor extraction-then-recognition yields a valid solution.
- **FR-008**: The solver MUST simplify the emitted algorithm so it contains no redundant consecutive same-face turns (e.g. an AUF that cancels into the first move is collapsed).
- **FR-009**: The change MUST NOT alter the solver's public API surface (its inputs, outputs, and exported types remain unchanged); only the internal selection of F2L algorithms changes.
- **FR-010**: The 18 edge-in-wrong-slot and 18 corner-in-wrong-slot dedicated recovery cases from the extended F2L set are explicitly OUT OF SCOPE as table entries; such positions are handled by extraction-then-recognition (FR-005) or, failing that, the fallback (FR-007).
- **FR-011**: The 41 standard cases MUST be authored into a neutral in-repo case-data file as the single ground truth — each entry carrying its category, recognition signature, and canonical front-slot algorithm — defined as static data so each case is individually inspectable and testable. The recognition table is built from this file; no external source is cited or copied into the repository.
- **FR-012**: The change targets the **advanced (default, non-beginner)** F2L path only. The beginner/intuitive path MUST be unaffected by this feature — it is governed separately by feature 037 (intuitive procedures). A shared case-data file MAY be reused by both, but each path selects from it under its own rules.

### Key Entities

- **Standard F2L Case**: One of the 41 enumerated standard cases. Attributes: category (easy insert / disconnected pair / connected pair / corner-in-slot / edge-in-slot / both-pieces-in-slot), human-readable case name, recognition signature (target corner position + orientation, target edge position + orientation, expressed in the solver's reference frame), and the canonical front-slot algorithm.
- **Recognition Signature**: The set of observable facts about a slot's two target pieces used to identify which standard case the current position is — positions and orientations of the corner and edge relative to the target slot, normalized for AUF.
- **AUF Prefix**: The leading U-layer turn (0–3 quarter turns) computed from the rotational offset between the current position and the case's canonical orientation.
- **Rotation Wrapper**: The cube-rotation prefix (e.g. `y` / `y2`) applied to a front-slot canonical algorithm to retarget it at a back slot.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For all 41 standard cases, in every AUF rotation, the advanced solver selects the canonical algorithm from the case-data file and applying it (with the computed AUF prefix) solves the target slot — 100% match and 100% solve rate in the case-coverage test suite.
- **SC-002**: For the standard top-layer cases (the 41), the selected algorithm's move count is less than or equal to the curated canonical algorithm for that slot plus any AUF prefix — i.e. no case is solved with more moves than the standard method's canonical algorithm (for back slots, "curated canonical algorithm" means whichever the solver chose: the rotation-wrapped front-slot algorithm or a direct back-slot equivalent).
- **SC-003**: Across a representative sample of at least 100 random scrambles, every F2L slot is solved with the cross and previously-solved slots intact (0 failures), confirming extraction-then-recognition and the fallback preserve correctness.
- **SC-004**: The IDA\* search no longer produces the primary algorithm for any of the 41 standard cases (it is reached only via the documented last-resort fallback path), measurable by case-coverage tests asserting table provenance.
- **SC-005**: The existing Vitest suite continues to pass with the standard-case round-trip tests added, and no regression in solver solve-rate on the existing scramble tests; the beginner path's tests are unchanged.

## Assumptions

- The 41 cases and their canonical algorithms are drawn from the standard, widely-published intuitive F2L case set (cube states and standard solving algorithms are facts/methods, not copyrightable expression) and authored into a neutral in-repo case-data file in the project's own terms; no third-party document text, layout, or wording is copied into the repository. Where a case admits multiple solutions (e.g. angle variants, "slot open" optimizations), the **primary front-slot (FR/FL) solution** is the one encoded.
- The 41-case count is the standard F2L set: 4 easy inserts + 10 disconnected pairs + 10 connected pairs + 6 corner-in-slot + 6 edge-in-slot + 5 both-pieces-in-slot.
- The solver operates in the existing z2 reference frame used by the current F2L solver; recognition signatures are expressed in that frame, consistent with the existing `SLOT_DEFS` and trigger table.
- The existing extraction sequences are sufficient to move a wrong-slot piece into the top layer for the in-scope cases; no new extraction technique is required for this feature.
- "Advanced solver" refers to the default (non-beginner) solver path; the beginner/intuitive path is gated by the existing `beginner` flag and governed by feature 037.
- Correctness is verified by state round-trip (apply setup → solve → assert solved), not by string-comparing against a single canonical spelling where multiple equivalent spellings solve identically — though SC-001 additionally checks canonical-algorithm provenance for the table path.
- No public API, exported type, or consumer-facing behavior changes; this is an internal algorithm-selection improvement.

## Out of Scope

- The 18 edge-in-wrong-slot and 18 corner-in-wrong-slot dedicated recovery cases as first-class table entries.
- Advanced/optimization variants (multi-angle solutions, "slot open" move-savers, keyhole-specific shortcuts beyond the standard case algorithm).
- Any change to the cross, OLL, or PLL stages.
- Any change to the beginner/intuitive F2L path (feature 037).
- Changes to rendering, the harness, or cfop-app.
