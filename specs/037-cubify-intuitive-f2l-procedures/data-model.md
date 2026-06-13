# Phase 1 Data Model: Intuitive F2L Procedures (Beginner Solver)

This feature is solver logic, not persisted data. The "entities" are the in-memory value types the procedure layer keys off and produces. All live inside `packages/cubify/src/cfop/`.

---

## Entity 1 — F2L Pair Position (input)

The classification of one corner+edge pair relative to its target slot. Derived from `RawState`, not stored.

| Field | Source | Meaning |
|---|---|---|
| `slot` | label | `'f2l-fr' \| 'f2l-fl' \| 'f2l-br' \| 'f2l-bl'` |
| `cornerIdx` | `state.cornerPieces.indexOf(def.cornerPiece)` | where the pair's corner currently sits (0–3 = U-layer, 4–7 = D-layer slot) |
| `edgeIdx` | `state.edgePieces.indexOf(def.edgePiece)` | where the pair's edge currently sits (0–3 = U-layer, 8–11 = slot) |
| `cornerOrient` | `state.cornerOrient[cornerIdx]` | 0–2; white-facing direction of the corner |
| `edgeOrient` | `state.edgeOrient[edgeIdx]` | 0–1; flip of the edge |
| `tier` | `getPairTier(state, slot)` | 1 = direct insert, 2 = both-in-top-needs-setup, 3 = one stuck, 4 = both stuck |

**Derived classification (selector key)**:
- `tier` (existing `getPairTier`) plus, for tier 2/3, the **white-facing direction** (which side face the corner's white sticker points to, computed from `cornerIdx` + `cornerOrient`) determines which procedure fires.

**Validation rules**:
- Selection MUST be deterministic: identical `(cornerIdx, edgeIdx, cornerOrient, edgeOrient, slot)` always selects the same procedure (FR-009).
- A position with `tier === 1` MUST route to easy-insert and emit nothing longer (Acceptance Scenario 1).

**State transitions** (normalisation before selection, reusing existing logic):
- tier 4 → (extract one piece) → tier 3
- tier 3 → (free stuck piece, keep white visible on side) → both-in-top → tier 1/2
- tier 2 → (setup conjugate) → tier 1 → insert
- tier 1 → (AUF + trigger) → solved

---

## Entity 2 — Intuitive Procedure

One taught move-shape. Implemented as a named function `(state, slot, mustSolve) → ProcedureResult | null`.

| Field | Meaning |
|---|---|
| `method` | stable name — see Entity 4 enum |
| `appliesWhen` | the tier + white-facing predicate that selects it |
| `aufPrefix` | one of `'' \| 'U' \| 'U2' \| "U'"` chosen to keep white visible on a side face (FR-003) |
| `mirror` | R-family for FR/BR-via-FR, L-family for FL/BL-via-FL |
| `body` | the setup/insert composition in beginner vocabulary |
| `emit` | normalised alg string (via `normalizeAlg`) |

**Procedure inventory** (front-slot; back slots inherit by conjugation):

| `method` | Tier | Shape (existing source) |
|---|---|---|
| `easy-insert` | 1 | AUF + trigger (`solveEasyInsert` / `F2L_TRIGGERS`) |
| `setup-insert` | 2 | AUF + 1-ply setup (white-on-side) **or** 2-ply setup (white-up) + easy-insert (`solveSetupInsert`) |
| `extract-insert` | 3/4 | slot-face extraction (free stuck piece, white visible) then `setup-insert`/`easy-insert` (extraction branches of `solveSlotIntuitive`, restricted to the slot's own face + U) |

**Validation rules**:
- `emit` MUST contain only U-layer turns and the working front slot's outer side face (R or L); back-slot results additionally wrapped in a `y`/`y'` conjugate — no B/wide/slice (FR-006/SC-003).
- `emit` MUST round-trip: `applyAlg(position, emit)` solves the target slot and leaves cross + `mustSolve` slots intact (FR-005/SC-002).
- When setting up/hiding a corner, `aufPrefix` MUST be the direction keeping white visible on a side face (FR-003).

---

## Entity 3 — Back-Slot Conjugation (wrapper, not a distinct procedure)

| Field | Value |
|---|---|
| `slot` | `'f2l-br'` or `'f2l-bl'` |
| `lead` | `y` (BR) / `y'` (BL) — brings the back slot to its front working position |
| `frontSlot` | `f2l-fr` (BR) / `f2l-fl` (BL) |
| `close` | `y'` (BR) / `y` (BL) — restores canonical z2 orientation |
| `emit` | `lead + [front-procedure on the y-rotated state] + close`, normalised |

**Validation rules**:
- `frontSlot`/`lead` pair MUST match the verified mapping (research Decision 1): `y`→BR-to-FR, `y'`→BL-to-FL.
- The conjugated body MUST be solved against the **rotated** state so the front procedure sees a genuine front-slot position.
- `method` reported for a conjugated solve is the **underlying front procedure's** method (coverage measures real procedure work, not the wrapper).

---

## Entity 4 — Coverage Report (fall-through counter, output)

The success metric. Produced by enumerating positions and tallying the `method` of each solve.

```ts
type BeginnerMethod =
  | 'already-solved'
  | 'easy-insert'
  | 'setup-insert'
  | 'extract-insert'
  | 'search-fallback';   // the counted fall-through

interface IntuitiveStage {
  label: string;          // slot label (existing)
  alg: string;            // emitted sequence (existing)
  method: BeginnerMethod; // NEW — coverage tag
}
```

| Aggregate | Meaning | Target |
|---|---|---|
| `total` | enumerated positions per slot/tier | — |
| `byMethod` | count per `BeginnerMethod` | — |
| `fallThrough` | count where `method === 'search-fallback'` | **0 at completion (SC-001)** |
| `roundTripFails` | count where the full solve does not solve all four slots + cross | **0 (SC-002)** |
| `vocabularyViolations` | count of emits containing a B/wide/slice move | **0 (SC-003)** |
| `maxLen` | longest single-pair emit | ≤ procedure-derived max (SC-004) |

**Validation rules**:
- `fallThrough`, `roundTripFails`, `vocabularyViolations` are the hard gates; the test fails the build if any is non-zero at completion.
- The report MUST be repeatable and deterministic (same enumeration → same counts).
