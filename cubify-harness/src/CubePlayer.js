/**
 * CubePlayer — animation engine for cubify-harness.
 *
 * Owns a CubeRenderer3D instance. Manages the move timeline, playback state,
 * speed, stickering, and event emission. Consumers interact via play/pause/
 * jumpTo/loadAlg and listen for move/complete/reset events.
 *
 * Constitution rules observed:
 * - Physical simulation: colours set only on _applyState(), never in animateMove callbacks
 * - Mask travel: _reapplyStickering() called only on _applyState() and setStickering()
 * - onDone chain: _playNext() chains via animateMove onDone + setTimeout gap
 * - Pause: sets _isPlaying=false; current move completes, chain stops
 */

import { CubeRenderer3D } from './CubeRenderer3D.js';
import { CubeState } from './CubeState.js';
import { CubeStickering } from './CubeStickering.js';
import { AlgParser } from './AlgParser.js';

export class CubePlayer {
  /**
   * @param {HTMLElement} container
   * @param {object} [options]
   * @param {number}  [options.animSpeed=300]  base ms per quarter-turn at scale 1.0
   * @param {number}  [options.gapMs=60]       inter-move gap in ms
   * @param {boolean} [options.debug=false]
   */
  constructor(container, { animSpeed = 300, gapMs = 60, debug = false } = {}) {
    this._renderer = new CubeRenderer3D({ animSpeed, debug });
    this._renderer.mount(container);

    this._baseSpeedMs = animSpeed;
    this._speedScale  = 1.0;
    this._gapMs       = gapMs;
    this._stickering  = null;

    this._moves      = [];
    this._setupMoves = [];
    this._anchor     = 'start';
    this._stepIndex  = 0;
    this._isPlaying  = false;
    this._baseState  = null;   // CubeState (solved), set on first loadAlg

    // Event emitter — T003
    this._listeners = new Map();
  }

  // ── Event emitter ─────────────────────────────────────────────────────────

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
    return this;
  }

  off(event, cb) {
    this._listeners.get(event)?.delete(cb);
    return this;
  }

  emit(event, data) {
    this._listeners.get(event)?.forEach(cb => cb(data));
  }

  // ── State computation ──────────────────────────────────────────────────────

  /** Return CubeState at step n — T004 */
  _stateAt(n) {
    return this._baseState.applyAlg([...this._setupMoves, ...this._moves.slice(0, n)]);
  }

  // ── Core API ───────────────────────────────────────────────────────────────

  /**
   * Load an algorithm. Setup string and anchor are explicit — never derived.
   * @param {string}      notation  WCA move notation e.g. "R U R' U R U2 R'"
   * @param {string|null} setup     setup moves as space-separated string, or null
   * @param {object}      [opts]
   * @param {'start'|'end'} [opts.anchor='start']
   */
  async loadAlg(notation, setup = null, { anchor = 'start' } = {}) {
    this.pause();

    this._moves      = notation ? AlgParser.parse(notation) : [];
    this._setupMoves = setup    ? AlgParser.parse(setup)    : [];
    this._anchor     = anchor;
    this._stepIndex  = 0;

    if (!this._baseState) this._baseState = await CubeState.solved();

    this._applyState(0);
    this.emit('reset', {});
  }

  /** Start or resume playback from current position. */
  play() {
    if (this._isPlaying || this._moves.length === 0) return;
    if (this._stepIndex >= this._moves.length) {
      this._stepIndex = 0;
      this._applyState(0);
    }
    this._isPlaying = true;
    this._playNext();
  }

  /** Stop after current move completes. */
  pause() {
    this._isPlaying = false;
  }

  /**
   * Instantly snap to move index n (no animation).
   * Clamps to [0, moveCount]. Does not emit a move event.
   * @param {number} n
   */
  jumpTo(n) {
    this._stepIndex = Math.max(0, Math.min(n, this._moves.length));
    this._applyState(this._stepIndex);
  }

  /** Jump to step 0 and emit reset. */
  reset() {
    this.pause();
    this.jumpTo(0);
    this.emit('reset', {});
  }

  /**
   * Set playback speed. scale=1.0 = normal (baseSpeedMs), scale=2.0 = double speed.
   * effectiveMs = baseSpeedMs / scale
   * @param {number} scale  > 0
   */
  setSpeed(scale) {
    this._speedScale = Math.max(0.05, scale);
    this._renderer.setSpeed(Math.round(this._baseSpeedMs / this._speedScale));
  }

  /**
   * Apply a stickering mask (orbit string or named preset) to the current state.
   * Pass null to clear.
   * @param {string|null} str
   */
  setStickering(str) {
    this._stickering = str || null;
    if (this._baseState) this._reapplyStickering();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Current CubeState at _stepIndex. */
  get state() { return this._baseState ? this._stateAt(this._stepIndex) : null; }

  /** Direct access to the owned CubeRenderer3D (Moves tab continuity). */
  get renderer() { return this._renderer; }

  get stepIndex()  { return this._stepIndex; }
  get isPlaying()  { return this._isPlaying; }
  get moveCount()  { return this._moves.length; }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Reset visual state to step n: resetToSolved + applyMovesInstant + stickering.
   * The only site where colours are set on the 3D renderer.
   */
  _applyState(n) {
    if (!this._baseState) return;
    const allMoves = [...this._setupMoves, ...this._moves.slice(0, n)];
    this._renderer.resetToSolved();
    if (allMoves.length) this._renderer.applyMovesInstant(allMoves);
    this._reapplyStickering();
  }

  /**
   * Reapply the active stickering mask to the current visual state.
   * Only valid after resetToSolved + applyMovesInstant (i.e. inside _applyState).
   * Never call from animateMove callbacks.
   */
  _reapplyStickering() {
    this._renderer.restoreColours();
    if (this._stickering && this._baseState) {
      const raw = this._stateAt(this._stepIndex).toRawPattern();
      const visMap = CubeStickering.fromOrbitStringWithState(this._stickering, raw);
      this._renderer.applyStickering(visMap);
    }
  }

  /**
   * Internal play loop. Called recursively via setTimeout after each move.
   * Stops when _isPlaying is false or all moves are done.
   */
  _playNext() {
    if (!this._isPlaying || this._stepIndex >= this._moves.length) {
      this._isPlaying = false;
      if (this._stepIndex >= this._moves.length && this._moves.length > 0) {
        this.emit('complete', {});
      }
      return;
    }

    const move = this._moves[this._stepIndex];
    this._renderer.animateMove(move, () => {
      this._stepIndex++;
      const state = this._stateAt(this._stepIndex);
      this.emit('move', { index: this._stepIndex, move, state });
      setTimeout(() => this._playNext(), this._gapMs);
    });
  }
}
