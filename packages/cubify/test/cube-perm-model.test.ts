/**
 * Independent permutation-model cross-check.
 *
 * Ported from the former standalone `cubify-harness/verify-perms.mjs`. The point
 * of this suite is NOT to test CubeState directly (cube-state.test.ts does that),
 * but to maintain a *second, independent* cube engine — a hand-written cycle-based
 * sticker-permutation model — and confirm it agrees with cubing.js move-by-move.
 * If cubing.js were ever broken (e.g. a bad upgrade), this is the test that does
 * not take it as gospel: the two engines must still agree, and the physical-fact
 * checks (Sexy×6 = solved, etc.) hold regardless of either engine.
 *
 * Conventions (lessons §5, §10): cubing.js U = WCA U' (and D = WCA D'). The model
 * below uses the WCA visual convention, so single-move cross-checks map WCA U↔U'
 * and D↔D'. Multi-move sequences use only R/F/L/B, which are identical in both.
 *
 * Face order: U=0, R=1, F=2, D=3, L=4, B=5
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CubeState } from '../src/CubeState.ts';

const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
const [U, R, F, D, L, B] = [0, 9, 18, 27, 36, 45];

// ── Permutation engine ────────────────────────────────────────────────────────

function solvedStickers(): string[] {
  const s = new Array<string>(54);
  for (let f = 0; f < 6; f++) for (let i = 0; i < 9; i++) s[f * 9 + i] = FACE_NAMES[f];
  return s;
}

// buildPerm cycle [a,b,c,d]: sticker at a moves to b, b→c, c→d, d→a.
// CW (viewed from face): TL→TR→BR→BL = [off, off+2, off+8, off+6].
function faceCW(off: number): number[][] {
  return [[off, off + 2, off + 8, off + 6], [off + 1, off + 5, off + 7, off + 3]];
}

function buildPerm(cycles: number[][]): number[] {
  const perm = Array.from({ length: 54 }, (_, i) => i);
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) perm[cycle[(i + 1) % len]] = cycle[i];
  }
  return perm;
}

function applyPerm(stickers: string[], perm: number[]): string[] {
  return Array.from({ length: 54 }, (_, i) => stickers[perm[i]]);
}

function invertPerm(perm: number[]): number[] {
  const inv = new Array<number>(54);
  for (let i = 0; i < 54; i++) inv[perm[i]] = i;
  return inv;
}

function composePerm(p1: number[], p2: number[]): number[] {
  return Array.from({ length: 54 }, (_, i) => p1[p2[i]]);
}

// Move definitions (WCA standard, viewed from each face).
const PERM_CYCLES: Record<string, number[][]> = {
  R: [...faceCW(R), [F + 2, U + 2, B + 6, D + 2], [F + 5, U + 5, B + 3, D + 5], [F + 8, U + 8, B + 0, D + 8]],
  U: [...faceCW(U), [F + 0, R + 0, B + 0, L + 0], [F + 1, R + 1, B + 1, L + 1], [F + 2, R + 2, B + 2, L + 2]],
  F: [...faceCW(F), [U + 6, R + 0, D + 2, L + 8], [U + 7, R + 3, D + 1, L + 5], [U + 8, R + 6, D + 0, L + 2]],
  L: [...faceCW(L), [U + 0, F + 0, D + 0, B + 8], [U + 3, F + 3, D + 3, B + 5], [U + 6, F + 6, D + 6, B + 2]],
  D: [...faceCW(D), [F + 6, L + 6, B + 6, R + 6], [F + 7, L + 7, B + 7, R + 7], [F + 8, L + 8, B + 8, R + 8]],
  B: [...faceCW(B), [U + 0, L + 6, D + 6, R + 8], [U + 1, L + 3, D + 7, R + 5], [U + 2, L + 0, D + 8, R + 2]],
};

const PERMS: Record<string, number[]> = Object.fromEntries(
  Object.entries(PERM_CYCLES).map(([k, v]) => [k, buildPerm(v)]),
);

function getMovePerm(move: string): number[] {
  const base = move.replace(/['2]/g, '');
  const p = PERMS[base];
  if (!p) throw new Error('Unknown move: ' + move);
  if (move.endsWith("'")) return invertPerm(p);
  if (move.endsWith('2')) return composePerm(p, p);
  return p;
}

function applyModelAlg(stickers: string[], moves: string[]): string[] {
  return moves.reduce((s, m) => applyPerm(s, getMovePerm(m)), stickers);
}

function stickersToFaces(stickers: string[]): string[][] {
  return Array.from({ length: 6 }, (_, f) => stickers.slice(f * 9, f * 9 + 9));
}

// ── Tests ───────────────────────────────────────────────────────────────────

let solved: CubeState;

beforeAll(async () => {
  solved = await CubeState.solved();
});

// WCA model move → equivalent cubing.js move (U/D directionally flipped; lessons §5).
const SINGLE_MOVES: [string[], string[]][] = [
  [['R'], ['R']],
  [['U'], ["U'"]],
  [['F'], ['F']],
  [['L'], ['L']],
  [['D'], ["D'"]],
  [['B'], ['B']],
  [["R'"], ["R'"]],
  [["U'"], ['U']],
  [["F'"], ["F'"]],
  [['R2'], ['R2']],
  [['U2'], ['U2']],
];

// Multi-move sequences use only R/F/L/B — identical in both conventions.
const MULTI_MOVES: string[][] = [
  ['R', 'F'],
  ['R', "F'"],
  ['R', 'F', "R'", "F'"], // sexy
  ['R', 'F', "R'", "F'", 'R', 'F', "R'", "F'", 'R', 'F', "R'", "F'"], // sexy ×3
  ["R'", 'F', 'R', "F'"], // sledge
];

describe('independent perm model — cross-check vs cubing.js (single moves)', () => {
  for (const [modelMoves, csMoves] of SINGLE_MOVES) {
    it(`${modelMoves.join(' ')} (model) === ${csMoves.join(' ')} (cubing.js)`, () => {
      const csFaces = solved.applyAlg(csMoves.join(' ')).toFaceArray();
      const modelFaces = stickersToFaces(applyModelAlg(solvedStickers(), modelMoves));
      expect(modelFaces).toEqual(csFaces);
    });
  }
});

describe('independent perm model — cross-check vs cubing.js (sequences)', () => {
  for (const moves of MULTI_MOVES) {
    it(`${moves.join(' ')}`, () => {
      const csFaces = solved.applyAlg(moves.join(' ')).toFaceArray();
      const modelFaces = stickersToFaces(applyModelAlg(solvedStickers(), moves));
      expect(modelFaces).toEqual(csFaces);
    });
  }
});

describe('physical ground truth (engine-independent)', () => {
  const solvedFaces = stickersToFaces(solvedStickers());

  it('after R, the U right column shows F', () => {
    const afterR = stickersToFaces(applyModelAlg(solvedStickers(), ['R']));
    expect([afterR[0][2], afterR[0][5], afterR[0][8]]).toEqual(['F', 'F', 'F']);
  });

  it('Sexy (R U R\' U\') ×6 = solved', () => {
    const sexy6 = Array(6).fill(['R', 'U', "R'", "U'"]).flat();
    expect(stickersToFaces(applyModelAlg(solvedStickers(), sexy6))).toEqual(solvedFaces);
  });

  it('Sledge (R\' F R F\') ×6 = solved', () => {
    const sledge6 = Array(6).fill(["R'", 'F', 'R', "F'"]).flat();
    expect(stickersToFaces(applyModelAlg(solvedStickers(), sledge6))).toEqual(solvedFaces);
  });
});
