import { describe, it, expect } from 'vitest';
import { solvedState, applyMove, applyAlg, MOVE_NAMES, type RawState } from '../src/cfop/CfopMoveTables.ts';
import { solveCross } from '../src/cfop/CrossSolver.ts';
import { solveF2lIntuitive, PROCEDURE_MAX } from '../src/cfop/F2lSolver.ts';

// End-to-end beginner F2L gate (SC-002/003/005 + FR-009) over realistic cross-
// solved states: scramble, solve the cross, then run the beginner F2L solver.
// Asserts every emit round-trips, stays in beginner vocabulary, drives the back
// slots through the recognisable `y2 … y2` conjugate (never an in-place B/R trick),
// and is deterministic.

const SLOT_DEFS: Record<string, { cornerSlot: number; edgeSlot: number; cornerPiece: number; edgePiece: number }> = {
  'f2l-fr': { cornerSlot: 4, edgeSlot: 8,  cornerPiece: 3, edgePiece: 9  },
  'f2l-fl': { cornerSlot: 5, edgeSlot: 9,  cornerPiece: 0, edgePiece: 8  },
  'f2l-bl': { cornerSlot: 6, edgeSlot: 11, cornerPiece: 1, edgePiece: 10 },
  'f2l-br': { cornerSlot: 7, edgeSlot: 10, cornerPiece: 2, edgePiece: 11 },
};
const ALL_SLOTS = ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br'];
const BACK_SLOTS = new Set(['f2l-br', 'f2l-bl']);
const VOCAB = /^(U[2']?|R[2']?|L[2']?|F[2']?|y2)$/;

function crossOk(s: RawState): boolean {
  return s.edgePieces[4]===0 && s.edgeOrient[4]===0 && s.edgePieces[5]===3 && s.edgeOrient[5]===0 &&
         s.edgePieces[6]===2 && s.edgeOrient[6]===0 && s.edgePieces[7]===1 && s.edgeOrient[7]===0;
}
function slotSolved(s: RawState, label: string): boolean {
  const d = SLOT_DEFS[label];
  return s.cornerPieces[d.cornerSlot]===d.cornerPiece && s.cornerOrient[d.cornerSlot]===0 &&
         s.edgePieces[d.edgeSlot]===d.edgePiece && s.edgeOrient[d.edgeSlot]===0;
}
function key(s: RawState): string {
  return s.cornerPieces.join('')+s.cornerOrient.join('')+s.edgePieces.join('')+s.edgeOrient.join('');
}

// Deterministic PRNG so the sampled scrambles are reproducible (gates are stable).
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random cross-solved, F2L-scrambled state: scramble with random face turns, then
// solve and apply the cross so we start F2L from a real first-step position.
function crossSolvedScramble(rand: () => number): RawState {
  let s = solvedState();
  let last = -1;
  for (let i = 0; i < 25; i++) {
    let m: number;
    do { m = Math.floor(rand() * 18); } while (Math.floor(m/3) === Math.floor(last/3));
    s = applyMove(s, m); last = m;
  }
  const cross = solveCross(s);
  return cross ? applyAlg(s, cross) : s;
}

describe('beginner F2L end-to-end (round-trip + vocabulary + recognisable method)', () => {
  it('solves F2L in beginner vocabulary over 200 cross-solved scrambles', () => {
    const rand = mulberry32(0xC0FFEE);
    let vocabViolations = 0, rtFails = 0, backWithoutY2 = 0, fallThrough = 0, overLength = 0;
    let backProcedures = 0, totalStages = 0;
    for (let n = 0; n < 200; n++) {
      const start = crossSolvedScramble(rand);
      if (!crossOk(start)) continue; // cross solver should always succeed; skip defensively
      const stages = solveF2lIntuitive(start);

      let s = start;
      for (const st of stages) {
        totalStages++;
        if (st.alg) s = applyAlg(s, st.alg);
        const toks = st.alg.trim() ? st.alg.trim().split(/\s+/) : [];
        if (toks.some(t => !VOCAB.test(t))) vocabViolations++;
        if (toks.length > PROCEDURE_MAX) overLength++;
        if (st.method === 'search-fallback') fallThrough++;
        if (BACK_SLOTS.has(st.label) && toks.length > 0) {
          if (toks[0] === 'y2' && toks[toks.length - 1] === 'y2') backProcedures++;
          else backWithoutY2++;
        }
      }
      if (!(ALL_SLOTS.every(l => slotSolved(s, l)) && crossOk(s))) rtFails++;
    }
    console.log(`stages=${totalStages} backProcedures=${backProcedures} fallThrough=${fallThrough} vocab=${vocabViolations} rtFail=${rtFails} backWithoutY2=${backWithoutY2} overLen=${overLength}`);
    // SC-002/003/004/005 are the contract for this end-to-end test. Note that even
    // the counted search net stays in beginner vocabulary (U/R/L/F only — the full-
    // move tier is gone), so vocab/length/round-trip hold regardless of which layer
    // emitted a stage.
    expect(rtFails, 'SC-002: every beginner solve completes all four F2L slots').toBe(0);
    expect(vocabViolations, 'SC-003: only U/R/L/F + y2 tokens').toBe(0);
    expect(overLength, 'SC-004: within PROCEDURE_MAX').toBe(0);
    expect(backWithoutY2, 'SC-005: back slots use the y2…y2 conjugate, never in-place').toBe(0);
    expect(backProcedures, 'sanity: back slots were exercised').toBeGreaterThan(0);
    // SC-001 (fall-through === 0) is formally gated by the EXHAUSTIVE enumerated
    // counter in cfop-f2l-setup-poc.test.ts (per FR-007 / contract line 79). Here,
    // over a random real-scramble sample, the procedure layer is the primary emitter
    // for the overwhelming majority of stages; the residual counted fall-through is
    // the designed invisible safety net (still beginner-vocab, still round-trips).
    expect(fallThrough / totalStages, 'procedures are the primary emitter on real scrambles').toBeLessThan(0.02);
  }, 120000);

  it('is deterministic — equal state ⇒ equal stages incl. method (FR-009)', () => {
    const rand = mulberry32(0x1234);
    for (let n = 0; n < 20; n++) {
      const start = crossSolvedScramble(rand);
      expect(JSON.stringify(solveF2lIntuitive(start))).toBe(JSON.stringify(solveF2lIntuitive(start)));
    }
  });

  it('y2 is its own inverse and equals y·y (move-table sanity)', () => {
    const r = mulberry32(7);
    for (let n = 0; n < 30; n++) {
      let s = solvedState(); let last = -1;
      for (let i = 0; i < 12; i++) { let m: number; do { m = Math.floor(r()*18); } while (Math.floor(m/3)===Math.floor(last/3)); s = applyMove(s, m); last = m; }
      expect(key(applyAlg(s, 'y2'))).toBe(key(applyAlg(s, 'y y')));
      expect(key(applyAlg(s, 'y2 y2'))).toBe(key(s));
    }
    void MOVE_NAMES;
  });
});
