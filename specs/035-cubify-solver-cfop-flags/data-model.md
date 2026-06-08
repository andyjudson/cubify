# Data Model: CFOP Solver Method Flags

## Changed Types

### `CfopSolverOptions` (in `CubeSolverCfop.ts`)

```typescript
export interface CfopSolverOptions {
  /** Overall solve timeout in ms. Default: 30000. */
  timeoutMs?: number;
  /** Beginner mode: intuitive F2L + 2-look OLL/PLL. Default: false. */
  beginner?: boolean;
}
```

### `SolveStageLabel` (in `cfop.worker.ts`)

```typescript
export type SolveStageLabel =
  | 'cross'
  | 'f2l-fr' | 'f2l-fl' | 'f2l-br' | 'f2l-bl'
  | 'oll'                              // default mode
  | 'oll-edges' | 'oll-corners'        // twoLook mode
  | 'pll'                              // default mode
  | 'pll-corners' | 'pll-edges';       // twoLook mode
```

Stage counts by mode:
- Default (`beginner` not set): 7 stages (cross, ×4 f2l, oll, pll)
- `beginner: true`: 9 stages (cross, ×4 f2l, oll-edges, oll-corners, pll-corners, pll-edges)

## New Types

### `EollCase` (in `CaseLibrary.ts`)

```typescript
export interface EollCase {
  id: string;
  name: 'Dot' | 'Bar' | 'L-shape';
  alg: string;
  /** Canonical eo[0..3] pattern (smallest AUF rotation). */
  eoPattern: number[];  // length 4, values 0|1
}
```

3 entries: dot [1,1,1,1], bar [0,1,0,1], l-shape [1,1,0,0].

### `F2lTrigger` (in `CaseLibrary.ts`)

```typescript
export interface F2lTrigger {
  id: string;
  alg: string;
  /** U-layer corner slot (0..3) and orientation in z2 frame, relative to target slot above FR or FL. */
  cornerSlot: number;
  cornerOrient: number;
  /** U-layer edge slot (0..3) and orientation. */
  edgeSlot: number;
  edgeOrient: number;
  /** Which working side this trigger targets. */
  side: 'right' | 'left';
}
```

4 entries (2 right, 2 left): connected-right, disconnected-right, connected-left, disconnected-left.

## Computed Subsets (no new interface)

### `CPLL_CASES`

Filtered from `PLL_CASES`: entries where `fingerprint[4..7]` equals `PLL_SOLVED_FINGERPRINT[4..7]`.

Result: 3 entries — Aa-perm, Ab-perm, E-perm.

### `EPLL_CASES`

Filtered from `PLL_CASES`: entries where `id.startsWith('pll-1-')`.

Result: 4 entries — Ua-perm, Ub-perm, H-perm, Z-perm.

### `OCLL_CASES`

Filtered from `OLL_CASES` at runtime in `solveTwoLookOll`: entries where `fingerprint[4..7]` are all 0.

Result: 7 entries — Sune, Anti-Sune, H Shape, Pi Shape, T Shape, L Shape, U Shape (indices 0–6).

## Stage Masks

| Stage label | Mask |
|-------------|------|
| `oll-edges` | `'oll-face-dim'` |
| `oll-corners` | `'oll-face-dim'` |
| `pll-corners` | `'pll-face-dim'` |
| `pll-edges` | `'pll-face-dim'` |

Both stages in each pair share the same mask preset since they work on the same U-layer area. The `label` field distinguishes which sub-step the consumer is rendering.

## Worker Message Protocol

```typescript
// Incoming (facade → worker)
{ type: 'solve'; patternStr: string; timeoutMs?: number; beginner?: boolean }
// Outgoing (worker → facade) — unchanged
{ type: 'solution'; solution: CfopSolution; elapsedMs: number }
{ type: 'error'; reason: string; message: string; elapsedMs: number }
```
