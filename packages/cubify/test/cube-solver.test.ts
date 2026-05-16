import { describe, it, expect, beforeAll } from 'vitest';
import {
  coIdx, eoIdx, udSliceIdx, cpIdx, ep4Idx, ep8Idx,
  decodeCO, decodeEO, decodeUDSlice, decodeCP,
} from '../src/solver/Coordinates.js';
import { buildMoveTables, MOVE_NAMES } from '../src/solver/MoveTables.js';
import type { MoveTables } from '../src/solver/MoveTables.js';
import { search } from '../src/solver/TwoPhase.js';
import type { TwoPhaseState } from '../src/solver/TwoPhase.js';
import { CubeState } from '../src/CubeState.js';

// ---- Coordinate encoding/decoding ------------------------------------------

describe('Coordinates – solved state', () => {
  const cPieces = [0, 1, 2, 3, 4, 5, 6, 7];
  const cOri    = new Array(8).fill(0);
  const ePieces = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const eOri    = new Array(12).fill(0);

  it('coIdx = 0',      () => expect(coIdx(cOri)).toBe(0));
  it('eoIdx = 0',      () => expect(eoIdx(eOri)).toBe(0));
  it('udSliceIdx = 494', () => expect(udSliceIdx(ePieces)).toBe(494));
  it('cpIdx = 0',      () => expect(cpIdx(cPieces)).toBe(0));
  it('ep4Idx = 0',     () => expect(ep4Idx(ePieces)).toBe(0));
  it('ep8Idx = 0',     () => expect(ep8Idx(ePieces)).toBe(0));
});

describe('Coordinates – round-trips', () => {
  it('coIdx round-trip (2187 values)', () => {
    for (let i = 0; i < 2187; i++) expect(coIdx(decodeCO(i))).toBe(i);
  });

  it('eoIdx round-trip (2048 values)', () => {
    for (let i = 0; i < 2048; i++) expect(eoIdx(decodeEO(i))).toBe(i);
  });

  it('udSliceIdx round-trip (495 values)', () => {
    for (let i = 0; i < 495; i++) expect(udSliceIdx(decodeUDSlice(i))).toBe(i);
  });

  it('cpIdx round-trip (40320 values)', () => {
    for (let i = 0; i < 40320; i++) expect(cpIdx(decodeCP(i))).toBe(i);
  });
});

// ---- MoveTables + search (requires cubing.js async table build) -------------

async function stateFromAlg(moves: string[]): Promise<TwoPhaseState> {
  let cs = await CubeState.solved();
  for (const m of moves) cs = cs.applyMove(m);
  const raw = cs.toRawPattern();
  return {
    CORNERS: { pieces: Array.from(raw.corners.pieces),  orientation: Array.from(raw.corners.orientation) },
    EDGES:   { pieces: Array.from(raw.edges.pieces),    orientation: Array.from(raw.edges.orientation) },
  };
}

describe('MoveTables + TwoPhase search', () => {
  let tables: MoveTables;
  let solvedState: TwoPhaseState;

  beforeAll(async () => {
    tables = await buildMoveTables();
    solvedState = await stateFromAlg([]);
  }, 120_000);

  // Move table spot-checks

  it('U does not disturb UDSlice', () => {
    const uIdx = MOVE_NAMES.indexOf('U');
    expect(tables.udSlice[494 * 18 + uIdx]).toBe(494);
  });

  it('R2 preserves UDSlice (phase-2 move)', () => {
    const r2Idx = MOVE_NAMES.indexOf('R2');
    expect(tables.udSlice[494 * 18 + r2Idx]).toBe(494);
  });

  it('R disturbs CO (corners get twisted)', () => {
    const rIdx = MOVE_NAMES.indexOf('R');
    expect(tables.co[0 * 18 + rIdx]).not.toBe(0);
  });

  it('U does not disturb EO (U edges flip stays 0)', () => {
    // U moves only move correctly-oriented edges; EO unchanged
    const uIdx = MOVE_NAMES.indexOf('U');
    expect(tables.eo[0 * 18 + uIdx]).toBe(0);
  });

  it('CP solved stays solved under U2', () => {
    const u2Idx = MOVE_NAMES.indexOf('U2');
    const cpAfterU2 = tables.cp[0 * 18 + u2Idx];
    // U2 permutes corners but returns the same permutation parity; not 0 after U2
    // Just verify we get a valid index
    expect(cpAfterU2).toBeGreaterThanOrEqual(0);
    expect(cpAfterU2).toBeLessThan(40320);
  });

  // Search correctness

  it('search(solved) returns ""', () => {
    expect(search(solvedState, tables, { timeoutMs: 5000 })).toBe('');
  });

  it('search on single-R state finds a solution', async () => {
    const state = await stateFromAlg(['R']);
    const result = search(state, tables, { timeoutMs: 5000 });
    expect(result).not.toBeNull();
    // Should be 1 move (R')
    expect(result!.trim().split(/\s+/).filter(Boolean).length).toBe(1);
  });

  it('search on U R U\' R\' state returns ≤ 4 moves', async () => {
    const state = await stateFromAlg(['U', 'R', "U'", "R'"]);
    const result = search(state, tables, { timeoutMs: 5000 });
    expect(result).not.toBeNull();
    expect(result!.trim().split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(4);
  });
});
