import { describe, it, expect } from 'vitest';
import { type RawState, solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import { solveOll, solveTwoLookOll } from '../src/cfop/OllSolver.ts';
import { OLL_CASES, EOLL_CASES } from '../src/cfop/CaseLibrary.ts';

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

// Build a synthetic EOLL-phase state: F2L solved, corners in any orientation, specific eo pattern
function buildEollState(coPattern: number[], eoPattern: number[]): RawState {
  return {
    cornerPieces: [5,6,7,4, 3,0,1,2],
    cornerOrient: [...coPattern, 0,0,0,0],
    edgePieces:   [4,7,6,5, 0,3,2,1, 9,8,11,10],
    edgeOrient:   [...eoPattern, 0,0,0,0,0,0,0,0],
  };
}

describe('solveTwoLookOll', () => {
  it('EOLL skip: eo already all 0', () => {
    const s = buildEollState([2,2,2,0], [0,0,0,0]); // Sune corners, edges already oriented
    const r = solveTwoLookOll(s);
    expect(r.eoll.alg).toBe('');
    expect(r.eoll.caseName).toBe('EOLL Skip');
  });

  it('all 3 EOLL cases: eo[0..3] all 0 after eoll.alg (any corner state)', () => {
    const someCo = [2,1,0,0]; // valid: sum=3 ≡ 0 mod 3
    for (const c of EOLL_CASES) {
      const s = buildEollState(someCo, c.eoPattern);
      const r = solveTwoLookOll(s);
      const afterEoll = r.eoll.alg ? applyAlg(s, r.eoll.alg) : s;
      expect(afterEoll.edgeOrient.slice(0,4), `${c.name} eo after EOLL`).toEqual([0,0,0,0]);
    }
  });

  it('bar and L-shape: all 4 AUF variants each produce eo all 0 after eoll.alg', () => {
    const auf = ['', 'U', 'U2', "U'"];
    for (const c of EOLL_CASES.filter(x => x.name !== 'Dot')) {
      for (const pre of auf) {
        const base = buildEollState([1,1,1,0], c.eoPattern); // valid: sum=3 ≡ 0 mod 3
        const s = pre ? applyAlg(base, pre) : base;
        const r = solveTwoLookOll(s);
        const after = r.eoll.alg ? applyAlg(s, r.eoll.alg) : s;
        expect(after.edgeOrient.slice(0,4), `${c.name} AUF=${pre}`).toEqual([0,0,0,0]);
      }
    }
  });

  it('full solveTwoLookOll chain: eo and co all 0 after eoll+ocll', () => {
    // Test against all 57 OLL cases — verify full two-look chain solves them
    for (const c of OLL_CASES) {
      const s = buildOllState(c.fingerprint);
      const r = solveTwoLookOll(s);
      let after = r.eoll.alg ? applyAlg(s, r.eoll.alg) : s;
      after = r.ocll.alg ? applyAlg(after, r.ocll.alg) : after;
      expect(after.edgeOrient.slice(0,4), `${c.name} eo`).toEqual([0,0,0,0]);
      expect(after.cornerOrient.slice(0,4), `${c.name} co`).toEqual([0,0,0,0]);
    }
  });

  it('OLL skip → both eoll and ocll are skips', () => {
    const s = applyMove(solvedState(), 18); // z2 frame, fully solved
    const r = solveTwoLookOll(s);
    expect(r.eoll.alg).toBe('');
    expect(r.ocll.alg).toBe('');
  });
});
