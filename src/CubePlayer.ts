/**
 * CubePlayer — animation engine for cubify.
 *
 * Owns a CubeRenderer3D instance. Manages the move timeline, playback state,
 * speed, stickering, and event emission.
 */

import { CubeRenderer3D } from './CubeRenderer3D.js';
import { CubeState } from './CubeState.js';
import { CubeStickering } from './CubeStickering.js';
import { AlgParser } from './AlgParser.js';

export type PlayerEventName = 'move' | 'complete' | 'reset';

export interface MoveEventData {
  index: number;
  move: string;
  state: CubeState;
}

export interface LoadAlgOptions {
  anchor?: 'start' | 'end';
}

type EventCallback = (data: MoveEventData | Record<string, never>) => void;

export class CubePlayer {
  private _renderer: CubeRenderer3D;
  private _baseSpeedMs: number;
  private _speedScale: number;
  private _gapMs: number;
  private _stickering: string | null;

  private _moves: string[];
  private _setupMoves: string[];
  private _anchor: 'start' | 'end';
  private _stepIndex: number;
  private _isPlaying: boolean;
  private _baseState: CubeState | null;

  private _listeners: Map<string, Set<EventCallback>>;

  constructor(container: HTMLElement, { animSpeed = 300, gapMs = 60, debug = false } = {}) {
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
    this._baseState  = null;

    this._listeners = new Map();
  }

  // ── Event emitter ─────────────────────────────────────────────────────────

  on(event: string, cb: EventCallback): this {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(cb);
    return this;
  }

  off(event: string, cb: EventCallback): this {
    this._listeners.get(event)?.delete(cb);
    return this;
  }

  emit(event: string, data: MoveEventData | Record<string, never>): void {
    this._listeners.get(event)?.forEach(cb => cb(data));
  }

  // ── State computation ──────────────────────────────────────────────────────

  private _stateAt(n: number): CubeState {
    return this._baseState!.applyAlg([...this._setupMoves, ...this._moves.slice(0, n)]);
  }

  // ── Core API ───────────────────────────────────────────────────────────────

  async loadAlg(notation: string, setup: string | null = null, { anchor = 'start' }: LoadAlgOptions = {}): Promise<void> {
    this.pause();

    this._moves      = notation ? AlgParser.parse(notation) : [];
    this._setupMoves = setup    ? AlgParser.parse(setup)    : [];
    this._anchor     = anchor;
    this._stepIndex  = 0;

    if (!this._baseState) this._baseState = await CubeState.solved();

    this._applyState(0);
    this.emit('reset', {});
  }

  play(): void {
    if (this._isPlaying || this._moves.length === 0) return;
    if (this._stepIndex >= this._moves.length) {
      this._stepIndex = 0;
      this._applyState(0);
    }
    this._isPlaying = true;
    this._playNext();
  }

  pause(): void {
    this._isPlaying = false;
  }

  jumpTo(n: number): void {
    this._stepIndex = Math.max(0, Math.min(n, this._moves.length));
    this._applyState(this._stepIndex);
  }

  reset(): void {
    this.pause();
    this.jumpTo(0);
    this.emit('reset', {});
  }

  setSpeed(scale: number): void {
    this._speedScale = Math.max(0.05, scale);
    this._renderer.setSpeed(Math.round(this._baseSpeedMs / this._speedScale));
  }

  setStickering(str: string | null): void {
    this._stickering = str || null;
    if (this._baseState) this._reapplyStickering();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get state(): CubeState | null { return this._baseState ? this._stateAt(this._stepIndex) : null; }
  get renderer(): CubeRenderer3D { return this._renderer; }
  get stepIndex(): number    { return this._stepIndex; }
  get isPlaying(): boolean   { return this._isPlaying; }
  get moveCount(): number    { return this._moves.length; }
  get setupMoves(): string[] { return [...this._setupMoves]; }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _applyState(n: number): void {
    if (!this._baseState) return;
    const allMoves = [...this._setupMoves, ...this._moves.slice(0, n)];
    this._renderer.resetToSolved();
    if (allMoves.length) this._renderer.applyMovesInstant(allMoves);
    this._reapplyStickering();
  }

  private _reapplyStickering(): void {
    this._renderer.restoreColours();
    if (this._stickering && this._baseState) {
      const raw    = this._stateAt(this._stepIndex).toRawPattern();
      const visMap = CubeStickering.fromOrbitStringWithState(this._stickering, raw);
      this._renderer.applyStickering(visMap);
    }
  }

  private _playNext(): void {
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
