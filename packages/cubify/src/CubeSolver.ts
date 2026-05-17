import type { CubeState } from './CubeState.js';

export interface SolveResult {
  alg: string;
  depth: number;
  elapsedMs: number;
}

export interface SolverOptions {
  /** Milliseconds before the search is terminated. Default: 30000. */
  timeoutMs?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pending = { resolve: (r: SolveResult) => void; reject: (e: any) => void; startMs: number; timer: ReturnType<typeof setTimeout> | null };

let _idCounter = 0;

/**
 * Solves a 3×3 cube state using the cs0x7f/min2phase two-phase Kociemba solver
 * (via the cubing.js/twips WASM worker). Finds a fast, near-optimal solution
 * without blocking the UI.
 *
 * Dispose the solver when done: `solver.dispose()`.
 */
export class CubeSolver {
  readonly available: boolean;
  private _worker: Worker | null = null;
  private _pending = new Map<number, Pending>();

  constructor() {
    try {
      this._worker = new Worker(
        new URL('./solver/twips.worker.ts', import.meta.url),
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

    const id = _idCounter++;
    const timeoutMs = options.timeoutMs ?? 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this._pending.has(id)) return;
        this._pending.delete(id);
        reject(new Error(`timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this._pending.set(id, { resolve, reject, startMs: Date.now(), timer });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patternStr = JSON.stringify((state as any).kPattern.patternData);
      this._worker!.postMessage({ id, action: 'solve333', patternStr });
    });
  }

  /** Abort all in-progress solves. */
  cancel(): void {
    for (const [id, p] of this._pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error('cancelled'));
      this._pending.delete(id);
    }
  }

  /** Terminate the worker. Call when done with this instance. */
  dispose(): void {
    this.cancel();
    this._worker?.terminate();
    this._worker = null;
  }

  private _onMessage(event: MessageEvent): void {
    const { id, result, error } = event.data;
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    if (p.timer) clearTimeout(p.timer);
    const elapsedMs = Date.now() - p.startMs;
    if (error) {
      p.reject(new Error(error));
    } else {
      const alg = String(result);
      p.resolve({ alg, depth: alg ? alg.split(' ').length : 0, elapsedMs });
    }
  }

  private _onWorkerError(event: ErrorEvent): void {
    for (const [id, p] of this._pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error(`worker error: ${event.message}`));
      this._pending.delete(id);
    }
  }
}
