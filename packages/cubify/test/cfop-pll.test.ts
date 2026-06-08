import { describe, it, expect } from 'vitest';
import { type RawState, solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import { solvePll, solveTwoLookPll } from '../src/cfop/PllSolver.ts';
import { PLL_CASES, PLL_SOLVED_FINGERPRINT, CPLL_CASES, EPLL_CASES } from '../src/cfop/CaseLibrary.ts';

// z2-solved D-layer: cornerPieces[4..7]=[3,0,1,2], edgePieces[4..11]=[0,3,2,1,9,8,11,10]
// Build a synthetic pre-PLL state from a fingerprint (F2L+OLL solved, U-layer pieces set)
function buildPllState(fp: number[]): RawState {
  return {
    cornerPieces: [fp[0], fp[1], fp[2], fp[3], 3,0,1,2],
    cornerOrient: [0,0,0,0, 0,0,0,0],
    edgePieces:   [fp[4], fp[5], fp[6], fp[7], 0,3,2,1, 9,8,11,10],
    edgeOrient:   [0,0,0,0, 0,0,0,0, 0,0,0,0],
  };
}

function isTopAligned(s: RawState): boolean {
  const sol = PLL_SOLVED_FINGERPRINT;
  return s.cornerPieces[0]===sol[0] && s.cornerPieces[1]===sol[1] &&
         s.cornerPieces[2]===sol[2] && s.cornerPieces[3]===sol[3] &&
         s.edgePieces[0]===sol[4] && s.edgePieces[1]===sol[5] &&
         s.edgePieces[2]===sol[6] && s.edgePieces[3]===sol[7];
}

describe('solvePll', () => {
  it('detects PLL skip (U-layer already solved)', () => {
    const s = applyMove(solvedState(), 18);
    const result = solvePll(s);
    expect(result.alg).toBe('');
    expect(result.caseName).toBe('PLL Skip');
  });

  it('detects PLL skip for all 4 U-rotations of solved state', () => {
    const auf = ['', 'U', 'U2', "U'"];
    for (const pre of auf) {
      let s = applyMove(solvedState(), 18);
      if (pre) s = applyAlg(s, pre);
      const result = solvePll(s);
      expect(result.caseName, `skip AUF=${pre}`).toBe('PLL Skip');
    }
  });

  it('all 21 PLL cases recognised and U-layer solved after alg', () => {
    for (const c of PLL_CASES) {
      const s = buildPllState(c.fingerprint);
      const result = solvePll(s);
      expect(result.caseName, c.wcaId).toBe(c.name);
      const after = result.alg ? applyAlg(s, result.alg) : s;
      expect(isTopAligned(after), `${c.name} (${c.wcaId})`).toBe(true);
    }
  });

  it('handles all 4 pre-AUF rotations for T Perm', () => {
    const tPerm = PLL_CASES.find(c => c.name === 'T Perm')!;
    const auf = ['', 'U', 'U2', "U'"];
    for (const pre of auf) {
      const base = buildPllState(tPerm.fingerprint);
      const s = pre ? applyAlg(base, pre) : base;
      const result = solvePll(s);
      const after = result.alg ? applyAlg(s, result.alg) : s;
      expect(isTopAligned(after), `T Perm AUF=${pre}`).toBe(true);
    }
  });
});

function isCpSolved(s: RawState): boolean {
  const sol = PLL_SOLVED_FINGERPRINT;
  return s.cornerPieces[0]===sol[0] && s.cornerPieces[1]===sol[1] &&
         s.cornerPieces[2]===sol[2] && s.cornerPieces[3]===sol[3];
}

describe('solveTwoLookPll', () => {
  it('CPLL skip: solved U-layer → cpll.alg empty or AUF only, corners solved after it', () => {
    const s = applyMove(solvedState(), 18);
    const r = solveTwoLookPll(s);
    expect(r.cpll.caseName).toBe('CPLL Skip');
    const after = r.cpll.alg ? applyAlg(s, r.cpll.alg) : s;
    expect(isCpSolved(after)).toBe(true);
  });

  it('CPLL cases: corners solved after cpll.alg for all 3 cases + AUF variants', () => {
    const auf = ['', 'U', 'U2', "U'"];
    for (const c of CPLL_CASES) {
      for (const pre of auf) {
        const base = buildPllState(c.fingerprint);
        const s = pre ? applyAlg(base, pre) : base;
        const r = solveTwoLookPll(s);
        const afterCpll = r.cpll.alg ? applyAlg(s, r.cpll.alg) : s;
        expect(isCpSolved(afterCpll), `${c.name} AUF=${pre} corners after CPLL`).toBe(true);
      }
    }
  });

  it('CPLL cases exported count is 3 (Aa, Ab, E)', () => {
    expect(CPLL_CASES).toHaveLength(3);
    const names = CPLL_CASES.map(c => c.wcaId).sort();
    expect(names).toEqual(['Aa', 'Ab', 'E'].sort());
  });

  it('EPLL cases exported count is 4 (Ua, Ub, H, Z)', () => {
    expect(EPLL_CASES).toHaveLength(4);
    const names = EPLL_CASES.map(c => c.wcaId).sort();
    expect(names).toEqual(['H', 'Ua', 'Ub', 'Z'].sort());
  });

  it('full solveTwoLookPll: U-layer solved after cpll+epll for all 21 PLL cases', () => {
    for (const c of PLL_CASES) {
      const s = buildPllState(c.fingerprint);
      const r = solveTwoLookPll(s);
      let after = r.cpll.alg ? applyAlg(s, r.cpll.alg) : s;
      after = r.epll.alg ? applyAlg(after, r.epll.alg) : after;
      expect(isTopAligned(after), `${c.name} (${c.wcaId})`).toBe(true);
    }
  });

  it('full solveTwoLookPll: all 4 AUF variants for Aa-perm', () => {
    const aa = CPLL_CASES.find(c => c.wcaId === 'Aa')!;
    const auf = ['', 'U', 'U2', "U'"];
    for (const pre of auf) {
      const base = buildPllState(aa.fingerprint);
      const s = pre ? applyAlg(base, pre) : base;
      const r = solveTwoLookPll(s);
      let after = r.cpll.alg ? applyAlg(s, r.cpll.alg) : s;
      after = r.epll.alg ? applyAlg(after, r.epll.alg) : after;
      expect(isTopAligned(after), `Aa AUF=${pre}`).toBe(true);
    }
  });
});
