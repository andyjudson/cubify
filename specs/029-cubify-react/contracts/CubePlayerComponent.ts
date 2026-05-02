/**
 * Contract: <CubePlayer> component prop interface
 *
 * Implementation target: cfop-app/src/lib/cubify/CubePlayerComponent.tsx
 */

import type { CSSProperties } from 'react';
import type { CubeTheme, ThemePresetName } from 'cubify';

export interface MoveEvent {
  /** Zero-based index of the move that just completed */
  index: number;
  /** WCA notation string of the completed move, e.g. "R U" */
  move: string;
}

export interface CubePlayerProps {
  /**
   * Algorithm in WCA notation. Change triggers loadAlg() and resets position.
   * @example "R U R' U R U2 R'"
   */
  alg?: string;

  /**
   * Setup moves applied before the alg (case orientation).
   * Change triggers loadAlg() with the new setup.
   */
  setup?: string;

  /**
   * Whether to anchor playback at the start or end of the alg.
   * 'end' = show solved state at end (default, CFOP use case).
   * 'start' = show scrambled state at start.
   */
  anchor?: 'start' | 'end';

  /**
   * Stickering mask — preset name (e.g. 'oll', 'pll') or raw orbit string.
   * Change triggers setStickering(). Omit for full stickering.
   */
  stickering?: string;

  /**
   * Theme — named preset or full CubeTheme object.
   * Change triggers player.renderer.setTheme().
   */
  theme?: CubeTheme | ThemePresetName;

  /**
   * Drives play/pause. Edge-triggered: false→true calls play(), true→false calls pause().
   * The component does not sync player completion state back to this prop.
   */
  playing?: boolean;

  /**
   * Animation speed scale. 1.0 = default. Change triggers setSpeed().
   */
  speed?: number;

  /**
   * Controlled step position. Change triggers jumpTo(stepIndex).
   * Omit for uncontrolled (playback advances internally).
   */
  stepIndex?: number;

  /** Called when a move animation completes. */
  onMove?: (e: MoveEvent) => void;

  /** Called when the last move in the alg completes. */
  onComplete?: () => void;

  /** Called when the player resets to its initial position. */
  onReset?: () => void;

  /** Inline styles applied to the container div. Use to set width/height. */
  style?: CSSProperties;

  /** CSS class name applied to the container div. */
  className?: string;
}

/**
 * Behavioural contract:
 *
 * 1. MOUNT: CubePlayer instance created and mounted into container div on first render.
 *    Disposed on unmount (no memory leak).
 *
 * 2. ALG: When alg/setup/anchor change, loadAlg() is called. If alg is undefined or '',
 *    the renderer shows a solved cube.
 *
 * 3. PLAYING: When playing changes false→true, player.play() is called.
 *    When playing changes true→false, player.pause() is called.
 *    Component does not call pause() automatically on onComplete — consumer controls this.
 *
 * 4. STEP INDEX: When stepIndex is provided and changes, player.jumpTo(stepIndex) is called.
 *    The component does not track step position internally.
 *
 * 5. EVENTS: onMove/onComplete/onReset are registered as player event listeners.
 *    Handlers are cleaned up and re-registered when callback references change.
 *
 * 6. THEME: player.renderer.setTheme() is called; renderer handles diff internally.
 *
 * 7. STRICT MODE: Safe under React StrictMode double-invoke (mount→unmount→mount).
 */
