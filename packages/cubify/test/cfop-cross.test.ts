import { describe, it, expect } from 'vitest';
import { solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import { solveCross } from '../src/cfop/CrossSolver.ts';

// In z2 frame: D-layer edge slots [4..7] hold pieces [0,3,2,1] when cross is solved
function crossSolved(s: ReturnType<typeof solvedState>) {
  return s.edgePieces[4]===0 && s.edgeOrient[4]===0 &&
         s.edgePieces[5]===3 && s.edgeOrient[5]===0 &&
         s.edgePieces[6]===2 && s.edgeOrient[6]===0 &&
         s.edgePieces[7]===1 && s.edgeOrient[7]===0;
}

describe('solveCross', () => {
  it('returns empty string for already-solved cross', () => {
    const s = applyMove(solvedState(), 18); // z2 frame
    expect(solveCross(s)).toBe('');
  });

  it('cross solved after applying the cross alg', () => {
    // Scramble from z2-solved state with a few moves that disrupt the cross
    let s = applyMove(solvedState(), 18); // z2
    s = applyAlg(s, "R U R' U' R U R'");
    const alg = solveCross(s);
    const result = alg ? applyAlg(s, alg) : s;
    expect(crossSolved(result)).toBe(true);
  });

  it('cross solved after D-moves scramble', () => {
    let s = applyMove(solvedState(), 18);
    s = applyAlg(s, "D R D' R' D2 F D F'");
    const alg = solveCross(s);
    const result = alg ? applyAlg(s, alg) : s;
    expect(crossSolved(result)).toBe(true);
  });

  it('handles a typical scramble within depth 9', () => {
    let s = applyMove(solvedState(), 18);
    s = applyAlg(s, "F R U R' U' F' R U R' U'");
    const alg = solveCross(s);
    expect(alg.split(' ').filter(Boolean).length).toBeLessThanOrEqual(9);
    const result = alg ? applyAlg(s, alg) : s;
    expect(crossSolved(result)).toBe(true);
  });

  it('solves a hard WCA random-state scramble in reasonable time', () => {
    // Previously timed out (30s) due to weak heuristic — should now be fast
    let s = applyMove(solvedState(), 18);
    s = applyAlg(s, "R2 U2 R2 F' L2 U2 R' F2 R2 U2 B2 D' R2 U' F2 L2 B2 D' R2");
    const t0 = Date.now();
    const alg = solveCross(s);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(5000); // should complete in well under 5s
    const result = alg ? applyAlg(s, alg) : s;
    expect(crossSolved(result)).toBe(true);
  });

  it('cross edges stay solved after cross alg', () => {
    let s = applyMove(solvedState(), 18);
    s = applyAlg(s, "U R' F R B' R' F' R B");
    const alg = solveCross(s);
    const result = alg ? applyAlg(s, alg) : s;
    // All D edges in home slot (z2 frame) with correct orientation
    const crossPieces = [0, 3, 2, 1];
    for (let i = 0; i < 4; i++) {
      expect(result.edgePieces[4 + i]).toBe(crossPieces[i]);
      expect(result.edgeOrient[4 + i]).toBe(0);
    }
  });
});
