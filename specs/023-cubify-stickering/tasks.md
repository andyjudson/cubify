# Tasks: 023 — cubify-stickering

**Branch**: `023-cubify-stickering`
**Input**: spec.md, plan.md, data-model.md, research.md
**Tests**: Not requested — no test tasks included

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (independent files/sections)
- **[Story]**: User story this task belongs to

---

## Phase 1: Setup

**Purpose**: Understand current CubeStickering.js state before modifying it.

- [ ] T001 Read cubify-harness/src/CubeStickering.js — understand current forPreset() geometric logic and module structure before replacing it

**Checkpoint**: Current implementation understood — safe to proceed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Static lookup data that both the parser (US-001) and preset wrapper (US-002) depend on. Must be complete before either story can be implemented.

- [ ] T002 Add three orbit-to-cubelet lookup tables and CUBELET_POSITIONS to cubify-harness/src/CubeStickering.js:
  - `CORNER_ORBIT_TO_CUBELET = [25, 23, 6, 8, 19, 2, 0, 17]` (URF→DRB)
  - `EDGE_ORBIT_TO_CUBELET = [16, 24, 14, 7, 11, 18, 9, 1, 22, 5, 20, 3]` (UF→BL)
  - `CENTER_ORBIT_TO_CUBELET = [15, 21, 13, 10, 4, 12]` (U→B)
  - `CUBELET_POSITIONS` — 26-entry array of `{x, y, z}` indexed by cubelet index (derived from the `x,y,z ∈ {-1,0,1}` loop, skipping `{0,0,0}`); used to compute `isOutward(cubeletIdx, slot)`

**Checkpoint**: Lookup data in place — US-001 and US-002 can proceed

---

## Phase 3: User Story 1 — Orbit String Parser (Priority: P1) 🎯 MVP

**Goal**: `CubeStickering.fromOrbitString(str)` parses any masks.mjs orbit string into a `Map<cubeletIndex, boolean[6]>` visibility map.

**Independent Test**: Call `fromOrbitString('EDGES:------------,CORNERS:--------,CENTERS:------')` (full preset) — every cubelet entry should have outward-facing slots `true` and inward slots `false`. Call with `cross-white` string — only U-layer edge cubelets (indices 16, 24, 14, 7) should have any `true` entries.

- [ ] T003 [US1] Implement `parseOrbitString(str)` helper in cubify-harness/src/CubeStickering.js — splits `"EDGES:chars,CORNERS:chars,CENTERS:chars"` (order-independent) into `{ EDGES: char[], CORNERS: char[], CENTERS: char[] }`

- [ ] T004 [US1] Implement `fromOrbitString(str)` in cubify-harness/src/CubeStickering.js using the algorithm from plan.md §Phase 1:
  - Call `parseOrbitString(str)` → OrbitMap
  - For each orbit (CORNERS/EDGES/CENTERS), iterate slot index `i`:
    - Look up `cubeletIdx` from lookup table
    - Look up `{x,y,z}` from CUBELET_POSITIONS
    - Build `boolean[6]`: for each face slot 0–5, compute `isOutward = (slot===0 && x===1) || (slot===1 && x===-1) || (slot===2 && y===1) || (slot===3 && y===-1) || (slot===4 && z===1) || (slot===5 && z===-1)`
    - Apply char rule: `-` → `isOutward`; `I` → `false`; `O` → `isOutward && slot === 3`
  - Return `Map<cubeletIdx, boolean[6]>`

**Checkpoint**: `fromOrbitString()` callable from browser console — verify full and cross-white outputs manually

---

## Phase 4: User Story 2 — Named Preset Wrapper (Priority: P1)

**Goal**: `CubeStickering.forPreset(name)` replaces the hand-written geometric logic entirely by wrapping `fromOrbitString`.

**Independent Test**: `CubeStickering.forPreset('cross-white')` produces identical output to `CubeStickering.fromOrbitString('EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------')`. `CubeStickering.presetNames()` returns all 8 names.

- [ ] T005 [US2] Define `PRESETS` constant in cubify-harness/src/CubeStickering.js with all 8 orbit strings (values must match cubify-scripts/lib/masks.mjs exactly):
  - `'full'`, `'cross-white'`, `'cross-yellow'`, `'f2l'`, `'oll-1look'`, `'oll-2look'`, `'pll-1look'`, `'pll-2look'`

- [ ] T006 [US2] Rewrite `forPreset(name)` in cubify-harness/src/CubeStickering.js as `return this.fromOrbitString(PRESETS[name])` — delete all existing geometric logic; add `presetNames()` returning `Object.keys(PRESETS)`

**Checkpoint**: Old `forPreset()` geometric logic fully removed — `presetNames()` returns 8 names

---

## Phase 5: User Story 3 — Harness Demo Controls (Priority: P2)

**Goal**: 8 preset buttons in the harness controls panel; stickering persists through step-through and alg changes.

**Independent Test**: Load an OLL alg, switch to `oll-1look` preset — D-layer edge and corner orientation stickers visible, all side stickers grey. Step through the alg — stickering stays consistent at each step. Reload page — stickering resets to `full`.

- [ ] T007 [US3] Add Stickering control group to cubify-harness/index.html controls panel with 8 buttons matching the layout from plan.md:
  `[Full] [Cross WH] [Cross YL] [F2L] [OLL 2LK] [OLL 1LK] [PLL 2LK] [PLL 1LK]`
  — each button has a `data-preset` attribute matching the PRESETS key

- [ ] T008 [US3] Wire stickering button click handlers in cubify-harness/index.html:
  - On click: call `CubeStickering.forPreset(name)`, pass result to `renderer.applyStickering(map)`
  - Track active preset in a module-level variable (default `'full'`)
  - Toggle `is-active` class on the clicked button, remove from others

- [ ] T009 [US3] Ensure stickering is re-applied after every `setState()` call in cubify-harness/index.html:
  - After step-back / step-forward button handler calls `setState()`
  - After alg text input apply (Enter / Apply button)
  - After play-sequence completion
  - Pattern: `renderer.applyStickering(CubeStickering.forPreset(activePreset))` in a shared helper

**Checkpoint**: All 8 presets work in demo; stickering survives step-through and alg changes

---

## Phase 6: Polish

- [ ] T010 Manual smoke test in browser — verify all 8 presets render correctly:
  - Load a PLL alg (e.g. T-perm): toggle through pll-1look and pll-2look
  - Load an OLL alg (e.g. Sune): toggle through oll-1look and oll-2look
  - Verify cross-white and cross-yellow on a cross alg
  - Step through 3–4 moves on each — confirm no sticker flicker
- [ ] T011 Confirm masks.mjs orbit strings pass through without translation — spot-check by copying a masks.mjs string directly into `fromOrbitString()` in the browser console and verifying the VisibilityMap matches expectations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS US-001 and US-002
- **Phase 3 (US-001)**: Depends on Phase 2
- **Phase 4 (US-002)**: Depends on Phase 3 (fromOrbitString must exist)
- **Phase 5 (US-003)**: Depends on Phase 4 (forPreset must exist)
- **Phase 6 (Polish)**: Depends on Phase 5

### Within Each Phase

- T003 (parseOrbitString) before T004 (fromOrbitString uses it)
- T005 (PRESETS) before T006 (forPreset references PRESETS)
- T007 (buttons in HTML) before T008 (click wiring) before T009 (setState re-apply)

---

## Implementation Strategy

### MVP (US-001 + US-002 only)

1. Phase 1: Read CubeStickering.js
2. Phase 2: Add lookup tables
3. Phase 3: Implement fromOrbitString()
4. Phase 4: Implement forPreset() wrapper
5. **Validate**: Call from browser console — no UI needed yet

### Full Delivery

5. Phase 5: Add preset buttons to harness
6. Phase 6: Smoke test all 8 presets

---

## Total: 11 tasks across 6 phases

| Phase | Tasks | Story |
|-------|-------|-------|
| 1 Setup | 1 | — |
| 2 Foundational | 1 | — |
| 3 US-001 parser | 2 | US1 |
| 4 US-002 wrapper | 2 | US2 |
| 5 US-003 harness | 3 | US3 |
| 6 Polish | 2 | — |
