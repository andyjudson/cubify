/**
 * Public API contract for CfopSolver — feature 034.
 * This file is a design contract (not executable); the implementation lives in
 * packages/cubify/src/CfopSolver.ts.
 */

import type { CubeState } from '../../../packages/cubify/src/CubeState.js';

// ── Stage labels ───────────────────────────────────────────────────────────────

export type SolveStageLabel =
  | 'cross'
  | 'f2l-fr'
  | 'f2l-fl'
  | 'f2l-br'
  | 'f2l-bl'
  | 'oll'
  | 'pll';

// ── Per-stage result ───────────────────────────────────────────────────────────

export interface SolveStage {
  /** Stage identifier — use to select mask preset. */
  label: SolveStageLabel;

  /**
   * WCA face-move sequence for this stage. Empty string if stage is already
   * solved (skip). For OLL/PLL: includes pre-AUF prefix and (PLL only) final
   * AUF suffix. Pass directly to CubePlayer.loadAlg().
   */
  alg: string;

  /**
   * Suggested MASK_PRESETS label to apply when playing this stage.
   * One of: 'cross', 'f2l', 'oll-face-dim', 'pll-face-dim'.
   */
  mask: string;

  /** HTM move count for this stage. Cube rotations excluded; AUF U-moves counted. */
  moves: number;

  /** Human-readable case name. Present only for OLL and PLL stages. */
  caseName?: string;

  /** WCA case identifier. Present only for OLL (number) and PLL (string) stages. */
  wcaId?: string | number;
}

// ── Solution ───────────────────────────────────────────────────────────────────

export interface CfopSolution {
  /**
   * Ordered stage results: cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll, pll.
   * Always exactly 6 entries. Skipped stages have alg === '' and moves === 0.
   */
  stages: SolveStage[];

  /**
   * Total HTM face moves across all stages. Cube rotations (z2) excluded;
   * AUF U-moves counted.
   */
  totalMoves: number;

  /**
   * Cube orientation applied before the cross stage. Always "z2".
   * Consumers must apply this to the original CubeState before loading
   * the cross stage alg into CubePlayer (to avoid applyOrientation breaking
   * MOVE_AXIS filters — see constitution rule 6).
   *
   * Pattern:
   *   const z2State = inputState.applyAlg(solution.setupAlg);
   *   await player.loadAlg(crossStage.alg, scrambleAlg + ' ' + solution.setupAlg);
   */
  setupAlg: string;
}

// ── Options ────────────────────────────────────────────────────────────────────

export interface CfopSolverOptions {
  /** Milliseconds before the solve is abandoned. Default: 30000. */
  timeoutMs?: number;
}

// ── Solver class ───────────────────────────────────────────────────────────────

export declare class CfopSolver {
  /** True if the web worker was successfully created. */
  readonly available: boolean;

  constructor();

  /**
   * Solve the given CubeState using CFOP.
   *
   * Returns a Promise that resolves with the structured solution.
   * Rejects with an Error if:
   *   - The solver is unavailable (worker failed to start)
   *   - The state is invalid or unsolvable
   *   - OLL or PLL recognition finds no matching case (state corruption)
   *   - cancel() is called while the solve is in progress
   *   - The solve exceeds timeoutMs
   */
  solve(state: CubeState, options?: CfopSolverOptions): Promise<CfopSolution>;

  /**
   * Abort any in-progress solve. The pending Promise rejects with
   * Error('cancelled'). No-op if no solve is running.
   */
  cancel(): void;

  /**
   * Terminate the worker. All pending solves are cancelled.
   * Call when the solver instance is no longer needed.
   */
  dispose(): void;
}

// ── Usage example (non-executable) ────────────────────────────────────────────

/*
const solver = new CfopSolver();
const solution = await solver.solve(scrambledState);

// Stage-by-stage CubePlayer integration
let currentState = scrambledState.applyAlg(solution.setupAlg);
for (const stage of solution.stages) {
  if (!stage.alg) continue; // skip solved stages
  await player.loadAlg(stage.alg);
  player.setStickering(stage.mask);
  player.play();
  await waitForComplete(player);
  currentState = currentState.applyAlg(stage.alg);
}

solver.dispose();
*/
