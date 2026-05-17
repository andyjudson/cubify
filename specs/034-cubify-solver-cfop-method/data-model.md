# Data Model: CFOP Solver (034)

## Public types (exported from `packages/cubify/src/CfopSolver.ts`)

### `SolveStageLabel`

```typescript
type SolveStageLabel =
  | 'cross'
  | 'f2l-fr'
  | 'f2l-fl'
  | 'f2l-br'
  | 'f2l-bl'
  | 'oll'
  | 'pll';
```

Fixed set — consumers can switch on this label to select mask presets.

---

### `SolveStage`

```typescript
interface SolveStage {
  label: SolveStageLabel;
  alg: string;          // WCA face moves (no z2, no cube rotations); AUF U-move prefix/suffix included
  mask: string;         // MASK_PRESETS label suggested for this stage
  moves: number;        // HTM count (face moves only; U/U'/U2 AUF moves ARE counted)
  caseName?: string;    // OLL/PLL human name ("Sune", "T-perm") — absent for cross/f2l
  wcaId?: string | number; // OLL/PLL WCA case ID — absent for cross/f2l
}
```

**Notes**:
- `alg` may be empty string for a skip (already-solved stage)
- For OLL/PLL, `alg` includes the pre-AUF U-move prefix and (for PLL) the post-AUF suffix, so `player.loadAlg(stage.alg)` works without extra handling
- AUF U-moves ARE counted in `moves` (they are face moves, not rotations)

---

### `CfopSolution`

```typescript
interface CfopSolution {
  stages: SolveStage[];   // Always 6 entries, in order: cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll, pll
  totalMoves: number;     // HTM sum across all stages; cube rotations (z2, y) excluded
  setupAlg: string;       // Always "z2" — the cube orientation applied before the cross stage
}
```

**Invariants**:
- `stages.length === 6` (one entry per stage; empty alg for skipped stages)
- `totalMoves === stages.reduce((sum, s) => sum + s.moves, 0)`
- Applying `setupAlg` + all `stages[i].alg` in sequence to the input `CubeState` produces the solved state

---

### `CfopSolverOptions`

```typescript
interface CfopSolverOptions {
  timeoutMs?: number;  // Overall solve timeout in ms. Default: 30000.
}
```

---

## Internal types (worker, not exported)

### `RawState`

```typescript
interface RawState {
  cornerPieces: number[];    // [8] — which piece is in each corner slot
  cornerOrient: number[];    // [8] — orientation of piece in each corner slot (0|1|2)
  edgePieces: number[];      // [12] — which piece is in each edge slot
  edgeOrient: number[];      // [12] — orientation of piece in each edge slot (0|1)
}
```

Derived from `kPattern.patternData` at the start of each solve. All IDA* operations work on this struct.

---

### `OllCase` (CaseLibrary.ts)

```typescript
interface OllCase {
  id: string;               // e.g. "oll-1-1"
  name: string;             // e.g. "Sune"
  wcaId: number;            // WCA numeric ID
  alg: string;              // Raw alg string from JSON
  fingerprint: number[];    // [8] — cornerOrient[0..3] + edgeOrient[0..3] for the pre-alg state
}
```

57 entries. Fingerprints computed at worker init from inverse alg application on solved state.

---

### `PllCase` (CaseLibrary.ts)

```typescript
interface PllCase {
  id: string;               // e.g. "pll-1-1"
  name: string;             // e.g. "Ua Perm"
  wcaId: string;            // WCA alpha ID (e.g. "Ua")
  alg: string;              // Raw alg string from JSON
  fingerprint: number[];    // [8] — cornerPieces[0..3] + edgePieces[0..3] for the pre-alg state
}
```

21 entries. Fingerprints computed at worker init from inverse alg application on OLL-solved state.

---

## Slot and piece ID reference

### Corner IDs (cubing.js)

| ID | Name | Home slot |
|----|------|-----------|
| 0 | URF | 0 |
| 1 | URB | 1 |
| 2 | ULB | 2 |
| 3 | ULF | 3 |
| 4 | DRF | 4 |
| 5 | DLF | 5 |
| 6 | DLB | 6 |
| 7 | DRB | 7 |

### Edge IDs (cubing.js)

| ID | Name | Home slot |
|----|------|-----------|
| 0 | UF | 0 |
| 1 | UR | 1 |
| 2 | UB | 2 |
| 3 | UL | 3 |
| 4 | DF | 4 |
| 5 | DR | 5 |
| 6 | DB | 6 |
| 7 | DL | 7 |
| 8 | FR | 8 |
| 9 | FL | 9 |
| 10 | BR | 10 |
| 11 | BL | 11 |

### F2L slot → piece mapping (post-z2 frame)

| Stage label | Corner ID | Corner slot | Edge ID | Edge slot |
|-------------|-----------|-------------|---------|-----------|
| `f2l-fr` | DRF (4) | 4 | FR (8) | 8 |
| `f2l-fl` | DLF (5) | 5 | FL (9) | 9 |
| `f2l-bl` | DLB (6) | 6 | BL (11) | 11 |
| `f2l-br` | DRB (7) | 7 | BR (10) | 10 |

### OLL/PLL U-layer slots

Slots 0–3 are the U-layer positions for both corners and edges:
- Corner slots: 0=URF, 1=URB, 2=ULB, 3=ULF
- Edge slots: 0=UF, 1=UR, 2=UB, 3=UL

U-move clockwise cycle (slot permutation):
- Corners: 0→1→2→3→0 (URF→URB→ULB→ULF→URF)
- Edges: 0→1→2→3→0 (UF→UR→UB→UL→UF)
