import type { CubeState } from './CubeState.js';
import type { SolveStage, CfopSolution, SolveStageLabel } from './cfop/cfop.worker.js';

export type { SolveStage, CfopSolution, SolveStageLabel };

export interface CfopSolverOptions {
  /** Overall solve timeout in ms. Default: 30000. */
  timeoutMs?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pending = { resolve: (s: CfopSolution) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> | null };

/**
 * CFOP-method cube solver.
 * Runs in a web worker; returns a stage-annotated solution covering
 * cross → F2L×4 → OLL → PLL.
 *
 * Dispose the solver when done: `solver.dispose()`.
 */
export class CfopSolver {
  readonly available: boolean;
  private _worker: Worker | null = null;
  private _pending: Pending | null = null;

  constructor() {
    try {
      this._worker = new Worker(
        new URL('./cfop/cfop.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this._worker.addEventListener('message', this._onMessage.bind(this));
      this._worker.addEventListener('error', this._onWorkerError.bind(this));
      this.available = true;
    } catch {
      this.available = false;
    }
  }

  /** Solve from the given CubeState. Rejects on timeout or error. */
  solve(state: CubeState, options: CfopSolverOptions = {}): Promise<CfopSolution> {
    if (!this.available || !this._worker) {
      return Promise.reject(new Error('CfopSolver unavailable'));
    }
    if (this._pending) {
      return Promise.reject(new Error('Already solving — call cancel() first'));
    }

    const timeoutMs = options.timeoutMs ?? 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending = null;
        this._worker?.postMessage({ type: 'cancel' });
        reject(new Error(`CFOP solve timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this._pending = { resolve, reject, timer };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patternStr = JSON.stringify((state as any).kPattern.patternData);
      this._worker!.postMessage({ type: 'solve', patternStr, timeoutMs });
    });
  }

  /** Abort an in-progress solve. */
  cancel(): void {
    this._worker?.postMessage({ type: 'cancel' });
    if (this._pending) {
      const p = this._pending;
      this._pending = null;
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error('cancelled'));
    }
  }

  /** Terminate the worker. Call when done with this instance. */
  dispose(): void {
    this.cancel();
    this._worker?.terminate();
    this._worker = null;
  }

  private _onMessage(event: MessageEvent): void {
    const msg = event.data;
    if (!this._pending) return;
    if (msg.type === 'solution') {
      const p = this._pending;
      this._pending = null;
      if (p.timer) clearTimeout(p.timer);
      p.resolve(msg.solution as CfopSolution);
    } else if (msg.type === 'error') {
      const p = this._pending;
      this._pending = null;
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error(`${msg.reason}: ${msg.message}`));
    }
  }

  private _onWorkerError(event: ErrorEvent): void {
    if (this._pending) {
      const p = this._pending;
      this._pending = null;
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error(`worker error: ${event.message}`));
    }
  }
}
