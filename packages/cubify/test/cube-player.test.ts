/**
 * CubePlayer unit tests — mock renderer, no DOM or WebGL required.
 *
 * Mock renderer calls animateMove(move, onDone) synchronously so the
 * play() chain can be driven via vi.useFakeTimers() + vi.runAllTimersAsync().
 */

import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { CubeState } from '../src/CubeState.ts';

// vi.mock is hoisted by Vitest before any imports —
// CubePlayer will receive this mock when it imports CubeRenderer3D.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockRenderer: any; // populated by MockCubeRenderer3D constructor

vi.mock('../src/CubeRenderer3D.ts', () => {
  const MockCubeRenderer3D = class {
    _speedMs: number;
    mount: ReturnType<typeof vi.fn>;
    unmount: ReturnType<typeof vi.fn>;
    resetToSolved: ReturnType<typeof vi.fn>;
    applyMovesInstant: ReturnType<typeof vi.fn>;
    animateMove: ReturnType<typeof vi.fn>;
    setSpeed: ReturnType<typeof vi.fn>;
    restoreColours: ReturnType<typeof vi.fn>;
    applyStickering: ReturnType<typeof vi.fn>;
    abortAnimation: ReturnType<typeof vi.fn>;

    constructor() {
      this._speedMs = 300;
      this.mount          = vi.fn();
      this.unmount        = vi.fn();
      this.resetToSolved  = vi.fn();
      this.applyMovesInstant = vi.fn();
      // Synchronous onDone — no animation delay in tests
      this.animateMove    = vi.fn((move: string, onDone: () => void) => onDone());
      this.setSpeed       = vi.fn((ms: number) => { this._speedMs = ms; });
      this.restoreColours = vi.fn();
      this.applyStickering = vi.fn();
      this.abortAnimation = vi.fn();
      mockRenderer = this;
    }
    get isAnimating() { return false; }
  };
  return { CubeRenderer3D: MockCubeRenderer3D };
});

// Import AFTER the mock declaration (Vitest hoisting means mock is already in place)
import { CubePlayer } from '../src/CubePlayer.ts';

// Fake container — mock renderer's mount() ignores the argument
const FAKE_CONTAINER = {} as HTMLElement;

let player: CubePlayer;

beforeAll(async () => {
  // Warm up cubing.js KPuzzle once for the whole suite
  await CubeState.solved();
});

beforeEach(() => {
  player = new CubePlayer(FAKE_CONTAINER, { gapMs: 0 });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── loadAlg — state and events ────────────────────────────────────────────────

describe('loadAlg', () => {
  it('moveCount = 3 for "R U R\'"', async () => {
    await player.loadAlg("R U R'");
    expect(player.moveCount).toBe(3);
  });

  it('stepIndex = 0 after loadAlg', async () => {
    await player.loadAlg("R U R'");
    expect(player.stepIndex).toBe(0);
  });

  it('emits reset event', async () => {
    const resets: unknown[] = [];
    player.on('reset', e => resets.push(e));
    await player.loadAlg("R U R'");
    expect(resets).toHaveLength(1);
  });

  it('moveCount = 0 for empty alg', async () => {
    await player.loadAlg('');
    expect(player.moveCount).toBe(0);
  });

  it('state is solved after loading empty alg (stepIndex=0, no moves)', async () => {
    await player.loadAlg('');
    expect(player.state.isSolved()).toBe(true);
  });

  it('state at step 0 with setup moves applied', async () => {
    // setup="z2": _stateAt(0) = solved.applyAlg(["z2"])
    // After z2, D face stickers are on top — U center should be 'D'
    await player.loadAlg('', 'z2');
    const faces = player.state.toFaceArray();
    // z2 swaps U/D: the U position now shows D-coloured stickers
    expect(faces[0][4]).toBe('D');
  });
});

// ── jumpTo ────────────────────────────────────────────────────────────────────

describe('jumpTo', () => {
  beforeEach(async () => {
    await player.loadAlg("R U R'");
  });

  it('jumpTo(2) → stepIndex = 2', () => {
    player.jumpTo(2);
    expect(player.stepIndex).toBe(2);
  });

  it('jumpTo(-1) clamps to 0', () => {
    player.jumpTo(-1);
    expect(player.stepIndex).toBe(0);
  });

  it('jumpTo(99) clamps to moveCount', () => {
    player.jumpTo(99);
    expect(player.stepIndex).toBe(player.moveCount);
  });

  it('jumpTo does not emit move event', () => {
    const moves: unknown[] = [];
    player.on('move', e => moves.push(e));
    player.jumpTo(1);
    expect(moves).toHaveLength(0);
  });

  it('jumpTo(n) calls renderer.resetToSolved + applyMovesInstant', () => {
    player.jumpTo(2);
    expect(mockRenderer.resetToSolved).toHaveBeenCalled();
    expect(mockRenderer.applyMovesInstant).toHaveBeenCalled();
  });
});

// ── play() event sequence ─────────────────────────────────────────────────────

describe('play() event sequence', () => {
  it('3-move alg emits 3 move events', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    const moves: unknown[] = [];
    player.on('move', e => moves.push(e));
    player.play();
    await vi.runAllTimersAsync();
    expect(moves).toHaveLength(3);
  });

  it('first move event has index=1', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    const moves: Array<{ index: number }> = [];
    player.on('move', e => moves.push(e as { index: number }));
    player.play();
    await vi.runAllTimersAsync();
    expect(moves[0].index).toBe(1);
  });

  it('move event carries correct move string', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    const moves: Array<{ move: string }> = [];
    player.on('move', e => moves.push(e as { move: string }));
    player.play();
    await vi.runAllTimersAsync();
    expect(moves.map(e => e.move)).toEqual(['R', 'U', "R'"]);
  });

  it('move event state matches _stateAt(index)', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    const moveEvents: Array<{ state: CubeState }> = [];
    player.on('move', e => moveEvents.push(e as { state: CubeState }));
    player.play();
    await vi.runAllTimersAsync();

    const solvedState = await CubeState.solved();
    const expectedAfterR = solvedState.applyAlg('R');
    // First move event: index=1, state = solved.applyAlg('R')
    expect(moveEvents[0].state.toFaceArray()).toEqual(expectedAfterR.toFaceArray());
  });

  it('emits complete after last move', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    let completed = false;
    player.on('complete', () => { completed = true; });
    player.play();
    await vi.runAllTimersAsync();
    expect(completed).toBe(true);
  });

  it('stepIndex = moveCount after play completes', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    player.play();
    await vi.runAllTimersAsync();
    expect(player.stepIndex).toBe(3);
  });

  it('play() from last step wraps to 0 and replays all moves', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    player.jumpTo(3); // at end
    const moves: unknown[] = [];
    player.on('move', e => moves.push(e));
    player.play(); // should reset to 0 first
    await vi.runAllTimersAsync();
    expect(moves).toHaveLength(3);
  });

  it('play() while already playing is a no-op (no duplicate events)', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    const moves: unknown[] = [];
    player.on('move', e => moves.push(e));
    player.play();
    player.play(); // second call: no-op
    await vi.runAllTimersAsync();
    expect(moves).toHaveLength(3); // not 6
  });

  it('play() on empty alg does nothing', async () => {
    vi.useFakeTimers();
    await player.loadAlg('');
    let completed = false;
    player.on('complete', () => { completed = true; });
    player.play();
    await vi.runAllTimersAsync();
    expect(completed).toBe(false);
    expect(player.isPlaying).toBe(false);
  });

  it('play() from step N (not 0) emits remaining moves then complete', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R' U'");
    player.jumpTo(2); // at step 2, 2 moves remain (R', U')
    const moves: unknown[] = [];
    let completed = false;
    player.on('move', e => moves.push(e));
    player.on('complete', () => { completed = true; });
    player.play();
    await vi.runAllTimersAsync();
    expect(moves).toHaveLength(2);
    expect(completed).toBe(true);
  });
});

// ── pause() ───────────────────────────────────────────────────────────────────

describe('pause()', () => {
  it('pause() sets isPlaying = false', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R' U'");
    player.play();
    player.pause();
    expect(player.isPlaying).toBe(false);
  });

  it('pause() after first move: only 1 move event emitted', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R' U'");
    const moves: unknown[] = [];
    player.on('move', e => moves.push(e));
    player.play();
    // First move completes synchronously via mock animateMove
    // Timer for second move is now pending; pause before it fires
    player.pause();
    await vi.runAllTimersAsync();
    expect(moves).toHaveLength(1);
  });

  it('complete is not emitted after pause mid-sequence', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R' U'");
    let completed = false;
    player.on('complete', () => { completed = true; });
    player.play();
    player.pause();
    await vi.runAllTimersAsync();
    expect(completed).toBe(false);
  });
});

// ── reset() ───────────────────────────────────────────────────────────────────

describe('reset()', () => {
  it('reset() sets stepIndex = 0', async () => {
    await player.loadAlg("R U R'");
    player.jumpTo(2);
    player.reset();
    expect(player.stepIndex).toBe(0);
  });

  it('reset() emits reset event', async () => {
    await player.loadAlg("R U R'");
    const resets: unknown[] = [];
    player.on('reset', e => resets.push(e));
    player.reset();
    expect(resets).toHaveLength(1);
  });

  it('reset() stops playback', async () => {
    vi.useFakeTimers();
    await player.loadAlg("R U R'");
    player.play();
    player.reset();
    expect(player.isPlaying).toBe(false);
  });
});

// ── setSpeed ──────────────────────────────────────────────────────────────────

describe('setSpeed', () => {
  beforeEach(async () => {
    await player.loadAlg("R U R'");
  });

  it('setSpeed(2.0) calls renderer.setSpeed(150) — effectiveMs = 300/2', () => {
    player.setSpeed(2.0);
    expect(mockRenderer.setSpeed).toHaveBeenCalledWith(150);
  });

  it('setSpeed(0.5) calls renderer.setSpeed(600) — effectiveMs = 300/0.5', () => {
    player.setSpeed(0.5);
    expect(mockRenderer.setSpeed).toHaveBeenCalledWith(600);
  });

  it('setSpeed(1.0) calls renderer.setSpeed(300) — normal speed', () => {
    player.setSpeed(1.0);
    expect(mockRenderer.setSpeed).toHaveBeenCalledWith(300);
  });

  it('setSpeed clamps very small scale to 0.05 minimum', () => {
    player.setSpeed(0.001); // clamped to 0.05
    expect(mockRenderer.setSpeed).toHaveBeenCalledWith(Math.round(300 / 0.05));
  });
});

// ── setStickering ─────────────────────────────────────────────────────────────

describe('setStickering', () => {
  const OLL_STR = 'EDGES:OOOOIIIIIIII,CORNERS:OOOOISIII,CENTERS:-IIIII';

  beforeEach(async () => {
    await player.loadAlg("R U R'");
  });

  it('setStickering(str) stores the stickering string', () => {
    player.setStickering(OLL_STR);
    // Access private field via cast for test verification
    expect((player as unknown as { _stickering: string | null })._stickering).toBe(OLL_STR);
  });

  it('setStickering(null) clears stickering', () => {
    player.setStickering(OLL_STR);
    player.setStickering(null);
    expect((player as unknown as { _stickering: string | null })._stickering).toBeNull();
  });

  it('setStickering calls renderer.restoreColours', () => {
    player.setStickering(OLL_STR);
    expect(mockRenderer.restoreColours).toHaveBeenCalled();
  });

  it('setStickering with valid str calls renderer.applyStickering', () => {
    player.setStickering(OLL_STR);
    expect(mockRenderer.applyStickering).toHaveBeenCalled();
  });

  it('setStickering(null) does not call renderer.applyStickering', () => {
    player.setStickering(OLL_STR);
    vi.clearAllMocks();
    player.setStickering(null);
    expect(mockRenderer.applyStickering).not.toHaveBeenCalled();
  });
});

// ── Mask travel invariant (lessons §16) ──────────────────────────────────────

describe('Mask travel invariant — stickering NOT reapplied in animateMove (lessons §16)', () => {
  it('play() does not call applyStickering inside animateMove callbacks', async () => {
    vi.useFakeTimers();
    const OLL_STR = 'EDGES:OOOOIIIIIIII,CORNERS:OOOOISIII,CENTERS:-IIIII';
    await player.loadAlg("R U R'");
    player.setStickering(OLL_STR);

    // Clear call counts from setStickering
    vi.clearAllMocks();

    player.play();
    await vi.runAllTimersAsync();

    // applyStickering should NOT be called during animation (mask travels with mesh)
    expect(mockRenderer.applyStickering).not.toHaveBeenCalled();
    expect(mockRenderer.restoreColours).not.toHaveBeenCalled();
  });
});

// ── Getters ───────────────────────────────────────────────────────────────────

describe('public getters', () => {
  it('state getter returns CubeState instance', async () => {
    await player.loadAlg("R U R'");
    const state = player.state;
    expect(typeof state.toFaceArray).toBe('function');
    expect(typeof state.isSolved).toBe('function');
  });

  it('renderer getter returns the mock renderer', async () => {
    await player.loadAlg("R U R'");
    expect(player.renderer).toBe(mockRenderer);
  });

  it('isPlaying starts false', async () => {
    await player.loadAlg("R U R'");
    expect(player.isPlaying).toBe(false);
  });
});
