# Contract: Solver Worker Message Protocol

The `CubeSolver` class (main thread) communicates with `solver.worker.ts` via
`postMessage`. All messages are plain objects (structured-cloneable).

---

## Main thread → Worker

### `solve`

Begin a solve from the given cube state.

```typescript
{
  type: 'solve';
  stateData: {
    CORNERS: { pieces: number[]; orientation: number[] };
    EDGES:   { pieces: number[]; orientation: number[] };
  };
  timeoutMs?: number;  // default 10000
}
```

- `stateData` is the raw `patternData` extracted from `player.state`
- Worker responds with one or more `progress` messages followed by exactly one
  `solution` or `error` message
- If a solve is already in progress when `solve` is received, the worker ignores
  the new message (caller must cancel first)

### `cancel`

Abort the current solve. Worker terminates search and sends no further messages.

```typescript
{ type: 'cancel' }
```

---

## Worker → Main thread

### `progress`

Posted at the start of each IDA* depth iteration.

```typescript
{
  type: 'progress';
  depth: number;    // 1–20
}
```

### `solution`

Posted when a solution is found.

```typescript
{
  type: 'solution';
  alg: string;      // WCA-notation move sequence, e.g. "R U R' U'"
  depth: number;    // length of solution
  elapsedMs: number;
}
```

### `error`

Posted on timeout, invalid state, or internal failure.

```typescript
{
  type: 'error';
  reason: 'timeout' | 'invalid-state' | 'internal';
  message: string;
  elapsedMs: number;
}
```

---

## Timeout behaviour

- The main thread sets a timer (`setTimeout`) for `timeoutMs` after posting `solve`
- On expiry: `worker.terminate()` then surface error to UI — no main-thread fallback
- The worker also tracks elapsed time internally and posts `{ type: 'error',
  reason: 'timeout' }` if it detects the limit exceeded during search

## Worker construction failure

If `new Worker(...)` throws, `CubeSolver` sets an internal `unavailable` flag.
Subsequent `solve()` calls immediately reject with `{ reason: 'unavailable' }`.
The harness shows "Solver unavailable" and keeps the Solve button disabled.
There is no fallback to synchronous main-thread execution.

---

## Public TypeScript API (`CubeSolver`)

```typescript
export interface SolveResult {
  alg: string;
  depth: number;
  elapsedMs: number;
}

export interface SolverOptions {
  timeoutMs?: number;        // default 10000
  onProgress?: (depth: number) => void;
}

export class CubeSolver {
  /** True if the web worker initialised successfully. If false, solve() will always reject. */
  readonly available: boolean;

  /** Solve from a KPattern. Rejects on timeout, invalid state, or worker unavailability. */
  solve(state: KPattern, options?: SolverOptions): Promise<SolveResult>;

  /** Abort any in-progress solve. */
  cancel(): void;

  /** Terminate the worker. Call when done with the solver instance. */
  dispose(): void;
}
```

---

## Error handling surface

The harness calls `solver.solve(player.state)` after pressing Solve.

On success: solution alg and elapsed time are appended to the harness event log; `player.loadAlg(alg)` is called and playback begins.

On rejection (timeout, invalid state, unavailable):
- Solve button re-enables
- Progress bar resets to empty
- Error reason is appended to the harness event log — no inline text near the controls
