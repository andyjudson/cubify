import { describe, it, expect } from 'vitest';
import { solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import { solveF2l } from '../src/cfop/F2lSolver.ts';

// z2 frame: cross = edgePieces[4..7]=[0,3,2,1], F2L slots use z2-solved piece IDs
function crossSolved(s: ReturnType<typeof solvedState>) {
  return s.edgePieces[4]===0 && s.edgeOrient[4]===0 &&
         s.edgePieces[5]===3 && s.edgeOrient[5]===0 &&
         s.edgePieces[6]===2 && s.edgeOrient[6]===0 &&
         s.edgePieces[7]===1 && s.edgeOrient[7]===0;
}

const SLOT_DEFS: Record<string, { cSlot: number; eSlot: number; cPiece: number; ePiece: number }> = {
  'f2l-fr': { cSlot: 4, eSlot: 8,  cPiece: 3, ePiece: 9  },
  'f2l-fl': { cSlot: 5, eSlot: 9,  cPiece: 0, ePiece: 8  },
  'f2l-bl': { cSlot: 6, eSlot: 11, cPiece: 1, ePiece: 10 },
  'f2l-br': { cSlot: 7, eSlot: 10, cPiece: 2, ePiece: 11 },
};

function slotSolved(s: ReturnType<typeof solvedState>, label: string) {
  const d = SLOT_DEFS[label];
  return s.cornerPieces[d.cSlot]===d.cPiece && s.cornerOrient[d.cSlot]===0 &&
         s.edgePieces[d.eSlot]===d.ePiece && s.edgeOrient[d.eSlot]===0;
}

describe('solveF2l', () => {
  it('returns empty algs when all F2L already solved', () => {
    const s = applyMove(solvedState(), 18); // z2 frame; cross + F2L all solved
    const result = solveF2l(s, []);
    expect(result['f2l-fr']).toBe('');
    expect(result['f2l-fl']).toBe('');
    expect(result['f2l-bl']).toBe('');
    expect(result['f2l-br']).toBe('');
  });

  it('solves f2l-fr without disturbing cross', () => {
    // Displace only the FR slot
    let s = applyMove(solvedState(), 18);
    s = applyAlg(s, "R U R' U'"); // inserts FR pair the wrong way
    const result = solveF2l(s, []);
    let applied = s;
    for (const lbl of ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']) {
      if (result[lbl]) applied = applyAlg(applied, result[lbl]);
    }
    expect(crossSolved(applied)).toBe(true);
    expect(slotSolved(applied, 'f2l-fr')).toBe(true);
  });

  it('cross edges remain intact after all F2L', () => {
    let s = applyMove(solvedState(), 18);
    s = applyAlg(s, "R U R' U' L' U L U F U' F'");
    const result = solveF2l(s, []);
    let applied = s;
    for (const lbl of ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']) {
      if (result[lbl]) applied = applyAlg(applied, result[lbl]);
    }
    expect(crossSolved(applied)).toBe(true);
    for (const lbl of Object.keys(SLOT_DEFS)) {
      expect(slotSolved(applied, lbl), lbl).toBe(true);
    }
  });

  it('previously solved slots are preserved', () => {
    let s = applyMove(solvedState(), 18);
    // Only displace the f2l-bl slot
    s = applyAlg(s, "L' U L U'");
    const result = solveF2l(s, []);
    let applied = s;
    for (const lbl of ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']) {
      if (result[lbl]) applied = applyAlg(applied, result[lbl]);
    }
    // All slots and cross should be solved
    expect(crossSolved(applied)).toBe(true);
    for (const lbl of Object.keys(SLOT_DEFS)) {
      expect(slotSolved(applied, lbl), lbl).toBe(true);
    }
  });
});
