export type { CubeTheme, FaceColours, ThemePresetName } from './CubeTheme.js';
export { THEME_PRESETS, DEFAULT_THEME, getThemePreset, cloneTheme, effectiveColours, validateTheme, themeToJSON, themeFromJSON } from './CubeTheme.js';

export { CubeState } from './CubeState.js';
export type { RawOrbitData, RawPattern } from './CubeState.js';

export { AlgParser } from './AlgParser.js';

export { CubeScramble, twipsWarmed } from './CubeScramble.js';
export type { TwipsServerSolveOptions } from './CubeScramble.js';

export { CubeStickering, MASK_PRESETS } from './CubeStickering.js';
export type { VisMap, MaskPreset } from './CubeStickering.js';

export { CubeRenderer2D } from './CubeRenderer2D.js';
export type { CubeRenderer2DOptions } from './CubeRenderer2D.js';

export { CubeRenderer3D, MOVE_AXIS } from './CubeRenderer3D.js';
export type { MoveAxisDef, CubeRenderer3DOptions } from './CubeRenderer3D.js';

export { DEFAULT_INTERNALS_OPTIONS } from './CubeInternals.js';
export type { InternalsOptions } from './CubeInternals.js';

export { CubePlayer } from './CubePlayer.js';
export type { PlayerEventName, MoveEventData, LoadAlgOptions } from './CubePlayer.js';

export { CubeExporter } from './CubeExporter.js';
export type { ExportOptions } from './CubeExporter.js';

export { CubeSolverKociemba } from './CubeSolverKociemba.js';
export type { SolveResult, SolverOptions } from './CubeSolverKociemba.js';

export { CubeSolverCfop } from './CubeSolverCfop.js';
export type { CfopSolution, SolveStage, SolveStageLabel, CfopSolverOptions } from './CubeSolverCfop.js';

/** Shared lifecycle contract implemented by all solver classes. */
export interface CubeSolverInterface {
  readonly available: boolean;
  cancel(): void;
  dispose(): void;
}
