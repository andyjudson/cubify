import { describe, it, expect } from 'vitest';
import { type RawState, solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import { solveOll } from '../src/cfop/OllSolver.ts';
import { OLL_CASES } from '../src/cfop/CaseLibrary.ts';

// z2-solved state: cornerPieces=[5,6,7,4,3,0,1,2], edgePieces=[4,7,6,5,0,3,2,1,9,8,11,10]
// Build a synthetic pre-OLL state from a fingerprint (F2L solved + U-layer orientations set)
function buildOllState(fp: number[]): RawState {
  return {
    cornerPieces: [5,6,7,4, 3,0,1,2],
    cornerOrient: [fp[0], fp[1], fp[2], fp[3], 0,0,0,0],
    edgePieces:   [4,7,6,5, 0,3,2,1, 9,8,11,10],
    edgeOrient:   [fp[4], fp[5], fp[6], fp[7], 0,0,0,0,0,0,0,0],
  };
}

describe('solveOll', () => {
  it('detects OLL skip (all orientations 0)', () => {
    const s = applyMove(solvedState(), 18); // z2 frame
    const result = solveOll(s);
    expect(result.alg).toBe('');
    expect(result.caseName).toBe('OLL Skip');
  });

  it('all 57 OLL cases recognised correctly', () => {
    for (const c of OLL_CASES) {
      const s = buildOllState(c.fingerprint);
      const result = solveOll(s);
      // After applying the returned alg, U-layer orientations should all be 0
      const after = result.alg ? applyAlg(s, result.alg) : s;
      expect(after.cornerOrient[0], `${c.name} co0`).toBe(0);
      expect(after.cornerOrient[1], `${c.name} co1`).toBe(0);
      expect(after.cornerOrient[2], `${c.name} co2`).toBe(0);
      expect(after.cornerOrient[3], `${c.name} co3`).toBe(0);
      expect(after.edgeOrient[0],   `${c.name} eo0`).toBe(0);
      expect(after.edgeOrient[1],   `${c.name} eo1`).toBe(0);
      expect(after.edgeOrient[2],   `${c.name} eo2`).toBe(0);
      expect(after.edgeOrient[3],   `${c.name} eo3`).toBe(0);
    }
  });

  it('handles all 4 AUF pre-rotations for Sune', () => {
    const c = OLL_CASES[0]; // Sune
    const auf = ['', 'U', 'U2', "U'"];
    for (const pre of auf) {
      const base = buildOllState(c.fingerprint);
      const s = pre ? applyAlg(base, pre) : base;
      const result = solveOll(s);
      const after = result.alg ? applyAlg(s, result.alg) : s;
      expect(after.cornerOrient.slice(0,4), `Sune AUF=${pre}`).toEqual([0,0,0,0]);
      expect(after.edgeOrient.slice(0,4),   `Sune AUF=${pre}`).toEqual([0,0,0,0]);
    }
  });
});
