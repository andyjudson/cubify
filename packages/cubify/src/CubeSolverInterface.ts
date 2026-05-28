import type { CubeState } from './CubeState.js';

/**
 * Shared contract implemented by all solver classes.
 * `T` is the solution type — `SolveResult` for `CubeSolverKociemba`,
 * `CfopSolution` for `CubeSolverCfop`.
 */
export interface CubeSolverInterface<T> {
  readonly available: boolean;
  solve(state: CubeState, options?: object): Promise<T>;
  cancel(): void;
  dispose(): void;
}
