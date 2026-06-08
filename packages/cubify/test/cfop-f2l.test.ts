import { describe, it, expect } from 'vitest';
import { solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import { solveF2l, solveF2lIntuitive, getPairTier } from '../src/cfop/F2lSolver.ts';

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

const KNOWN_TRIGGERS = [
  "R U R'", "R U' R'", "U R U' R'", "U' R U R'",
  "L' U' L", "L' U L", "U' L' U L", "U L' U' L",
  "U' R' U R", "R' U' R",
  "U L U' L'", "L U L'",
];

function endsInKnownTrigger(alg: string): boolean {
  for (const t of KNOWN_TRIGGERS) {
    const moves = t.split(' ');
    const algMoves = alg.trim().split(/\s+/);
    if (algMoves.length >= moves.length) {
      const tail = algMoves.slice(-moves.length).join(' ');
      if (tail === t) return true;
    }
  }
  return false;
}

describe('solveF2lIntuitive', () => {
  const SCRAMBLES = [
    "R U R' U'",
    "F R U R' U' F'",
    "R U2 R' U' R U' R'",
    "R U R' U R U2 R'",
    "F R U R' U' F' R U R' U R U2 R'",
  ];

  it('solves all 4 slots correctly for representative scrambles', () => {
    for (const scramble of SCRAMBLES) {
      // Start from cross-solved state
      let s = applyMove(solvedState(), 18); // z2 frame
      s = applyAlg(s, scramble);
      const stages = solveF2lIntuitive(s);
      let applied = s;
      for (const { alg } of stages) {
        if (alg) applied = applyAlg(applied, alg);
      }
      for (const lbl of Object.keys(SLOT_DEFS)) {
        expect(slotSolved(applied, lbl), `${lbl} not solved after "${scramble}"`).toBe(true);
      }
      expect(crossSolved(applied), `cross broken after "${scramble}"`).toBe(true);
    }
  });

  it('tier-1 states produce algs ending in a known trigger', () => {
    // Build a state where FR is directly insertable (tier-1)
    // Use the fr-connected trigger's inverse to create the before-state
    const z2sol = applyMove(solvedState(), 18);
    const tier1State = applyAlg(z2sol, "R U R' U'"); // inverse of U R U' R'
    expect(getPairTier(tier1State, 'f2l-fr')).toBe(1);
    const stages = solveF2lIntuitive(tier1State);
    const frStage = stages.find(s => s.label === 'f2l-fr');
    expect(frStage).toBeDefined();
    if (frStage?.alg) {
      expect(endsInKnownTrigger(frStage.alg), `FR alg "${frStage.alg}" should end in trigger`).toBe(true);
    }
  });

  it('opportunistic ordering: tier-1 slot solved before tier-4 slot', () => {
    // Build a state where FL is tier-1 (direct insert) and FR is tier-4 (both pieces stuck).
    // Inverse of fl-connected trigger (U' L' U L) produces FL as tier-1.
    // Then apply R2 U2 to ensure FR pieces are in D-layer (tier-4).
    const z2sol = applyMove(solvedState(), 18);
    const flTier1 = applyAlg(z2sol, "L' U' L U"); // FL pair in tier-1 position
    // Apply FR-slot disturber without touching FL pieces
    const testState = applyAlg(flTier1, "R2"); // drops FR pair to bottom

    expect(getPairTier(testState, 'f2l-fl')).toBe(1);

    const stages = solveF2lIntuitive(testState);
    // FL should appear before FR in output (solved first due to better tier)
    const flIdx = stages.findIndex(s => s.label === 'f2l-fl');
    const frIdx = stages.findIndex(s => s.label === 'f2l-fr');
    expect(flIdx).toBeGreaterThanOrEqual(0);
    expect(frIdx).toBeGreaterThanOrEqual(0);
    expect(flIdx).toBeLessThan(frIdx);

    // And all slots are solved
    let s = testState;
    for (const { alg } of stages) {
      if (alg) s = applyAlg(s, alg);
    }
    for (const lbl of Object.keys(SLOT_DEFS)) {
      expect(slotSolved(s, lbl), `${lbl} not solved`).toBe(true);
    }
  });

  it('already-solved slot produces alg="" in output', () => {
    const z2sol = applyMove(solvedState(), 18);
    // FR is solved in z2sol; apply only a non-FR scramble
    const s = applyAlg(z2sol, "L' U L"); // only disturbs FL
    const stages = solveF2lIntuitive(s);
    const frStage = stages.find(st => st.label === 'f2l-fr');
    expect(frStage).toBeDefined();
    expect(frStage?.alg).toBe('');
  });
});

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
