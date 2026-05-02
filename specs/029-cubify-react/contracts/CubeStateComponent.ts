/**
 * Contract: <CubeState> component prop interface
 *
 * Implementation target: cfop-app/src/lib/cubify/CubeStateComponent.tsx
 * Display-only — no animation, no playback controls.
 */

import type { CSSProperties } from 'react';
import type { CubeTheme, ThemePresetName } from 'cubify';

export interface CubeStateProps {
  /**
   * Algorithm in WCA notation. The component displays the cube state produced by
   * applying the INVERSE of this alg to the solved state — the standard CFOP
   * case display convention (show what the case looks like before execution).
   * Change triggers setState() with recomputed state.
   * @example "R U R' U R U2 R'"  — displays the pre-Sune state
   */
  alg?: string;

  /**
   * Setup moves (applied before alg inversion, same convention as CubePlayer).
   * Change triggers setState() with recomputed state.
   */
  setup?: string;

  /**
   * Stickering mask — preset name or raw orbit string.
   * Applied after setState(). Omit for full stickering.
   * @example "oll"
   * @example "EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD"
   */
  stickering?: string;

  /**
   * Theme — named preset or full CubeTheme object.
   * Change triggers renderer.setTheme().
   */
  theme?: CubeTheme | ThemePresetName;

  /** Inline styles applied to the container div. Use to set width/height. */
  style?: CSSProperties;

  /** CSS class name applied to the container div. */
  className?: string;
}

/**
 * Behavioural contract:
 *
 * 1. MOUNT: CubeRenderer3D instance created and mounted into container div on first render.
 *    Disposed on unmount.
 *
 * 2. STATE: When alg or setup change, the display state is recomputed:
 *      displayState = solved.applyAlg(invertAlg(parseAlg(alg)))
 *    renderer.setState(displayState) is called synchronously.
 *
 * 3. STICKERING: When stickering changes, parsed visMap is applied via
 *    renderer.applyStickering(). Applied after any state update in the same cycle.
 *
 * 4. THEME: renderer.setTheme() called on theme change; renderer handles diff.
 *
 * 5. NO ANIMATION: Component never calls animateMove() or any animation method.
 *    It is purely a static snapshot renderer.
 *
 * 6. SOLVED BASE: A single solved CubeState is created once at mount and reused
 *    for all subsequent alg applications. Re-created only on unmount/remount.
 */
