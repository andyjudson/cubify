import type { CubeState } from './CubeState.js';

export interface SolveResult {
  alg: string;
  depth: number;
  elapsedMs: number;
}

export interface SolverOptions {
  /** Milliseconds before the search is terminated. Default: 300000. */
  timeoutMs?: number;
  /** If true, return the first solution found (≤20 moves) without proving optimality. Much faster. */
  nonOptimal?: boolean;
  onProgress?: (depth: number, elapsedMs: number, nodes: number) => void;
  onHeartbeat?: (elapsedMs: number, nodes: number) => void;
}

type WorkerOutMessage =
  | { type: 'progress'; depth: number; nodes: number; elapsedMs: number }
  | { type: 'heartbeat'; nodes: number; elapsedMs: number }
  | { type: 'solution'; alg: string; depth: number; elapsedMs: number }
  | { type: 'error'; reason: 'timeout' | 'invalid-state' | 'internal'; message: string; elapsedMs: number };

/**
 * Wraps the 2-phase IDA* solver worker.
 *
 * Worker is constructed with `{ type: 'module' }` — Vite resolves the URL at
 * bundle time. If construction fails, `available` is set to false and all
 * `solve()` calls immediately reject.
 *
 * Dispose the solver when done: `solver.dispose()`.
 */
export class CubeSolver {
  readonly available: boolean;
  private _worker: Worker | null = null;
  private _pending: {
    resolve: (r: SolveResult) => void;
    reject: (e: Error) => void;
    options: SolverOptions;
    timer: ReturnType<typeof setTimeout> | null;
  } | null = null;

  constructor() {
    try {
      // Vite resolves this URL at build time for the bundled consumer.
      // In the dev harness (Vite dev server) it works natively.
      this._worker = new Worker(
        new URL('./solver/solver.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this._worker.addEventListener('message', this._onMessage.bind(this));
      this._worker.addEventListener('error', this._onWorkerError.bind(this));
      this.available = true;
    } catch {
      this.available = false;
    }
  }

  /**
   * Solve from the given CubeState.
   * Rejects if unavailable, on timeout, or on internal error.
   */
  solve(state: CubeState, options: SolverOptions = {}): Promise<SolveResult> {
    if (!this.available || !this._worker) {
      return Promise.reject(new Error('Solver unavailable'));
    }
    if (this._pending) {
      return Promise.reject(new Error('Solve already in progress — cancel first'));
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? 300000;

      const timer = setTimeout(() => {
        if (!this._pending) return;
        this._pending = null;
        this._worker?.terminate();
        this._worker = null;
        // Restart worker for future use
        try {
          this._worker = new Worker(
            new URL('./solver/solver.worker.ts', import.meta.url),
            { type: 'module' },
          );
          this._worker.addEventListener('message', this._onMessage.bind(this));
          this._worker.addEventListener('error', this._onWorkerError.bind(this));
        } catch { /* worker unavailable after restart */ }
        reject(new Error(`timeout after ${timeoutMs}ms`));
      }, timeoutMs + 500); // small buffer beyond worker's own timeout

      this._pending = { resolve, reject, options, timer };

      const raw = state.toRawPattern();
      this._worker!.postMessage({
        type: 'solve',
        nonOptimal: options.nonOptimal ?? false,
        stateData: {
          CORNERS: {
            pieces:      Array.from(raw.corners.pieces),
            orientation: Array.from(raw.corners.orientation),
          },
          EDGES: {
            pieces:      Array.from(raw.edges.pieces),
            orientation: Array.from(raw.edges.orientation),
          },
        },
        timeoutMs,
      });
    });
  }

  /** Abort any in-progress solve. */
  cancel(): void {
    if (!this._pending || !this._worker) return;
    const p = this._pending;
    this._pending = null;
    if (p.timer) clearTimeout(p.timer);
    this._worker.postMessage({ type: 'cancel' });
    p.reject(new Error('cancelled'));
  }

  /** Terminate the worker. Call when done with this instance. */
  dispose(): void {
    if (this._pending) this.cancel();
    this._worker?.terminate();
    this._worker = null;
  }

  private _onMessage(event: MessageEvent<WorkerOutMessage>): void {
    const msg = event.data;
    if (msg.type === 'progress') {
      this._pending?.options.onProgress?.(msg.depth, msg.elapsedMs, msg.nodes);
      return;
    }
    if (msg.type === 'heartbeat') {
      this._pending?.options.onHeartbeat?.(msg.elapsedMs, msg.nodes);
      return;
    }
    const p = this._pending;
    if (!p) return;
    this._pending = null;
    if (p.timer) clearTimeout(p.timer);

    if (msg.type === 'solution') {
      p.resolve({ alg: msg.alg, depth: msg.depth, elapsedMs: msg.elapsedMs });
    } else {
      p.reject(new Error(`${msg.reason}: ${msg.message}`));
    }
  }

  private _onWorkerError(event: ErrorEvent): void {
    const p = this._pending;
    if (!p) return;
    this._pending = null;
    if (p.timer) clearTimeout(p.timer);
    p.reject(new Error(`worker error: ${event.message}`));
  }
}
