import { describe, it, expect } from 'vitest';
import { solvedState, applyMove, applyAlg, type RawState } from '../src/cfop/CfopMoveTables.ts';
import { solveF2lIntuitive, getPairTier, PROCEDURE_MAX, type BeginnerMethod } from '../src/cfop/F2lSolver.ts';

// ── Fall-through counter: the success metric for the beginner F2L layer ──────
//
// We enumerate the REAL reachable positions per slot/tier (no third-party algs):
// short U + slot-face sequences from z2-solved, keeping states where the cross is
// intact, the other three slots are solved, the target slot is unsolved, and the
// pair is at the requested tier. For each we run the full beginner solver, read the
// `method` tag off the target slot's stage, and assert the encoded procedures cover
// 100% of the domain (search-fallback === 0), round-trip, stay in beginner
// vocabulary, and never exceed PROCEDURE_MAX moves (SC-001..SC-004).
//
// Every non-trivial pair is routed to a FRONT working slot via a cube-rotation
// conjugate (FR via no rotation or `y…y'`, FL via `y'…y`, BL via `y2…y2`, BR via
// `y…y'`), so back slots and front slots alike emit `y`/`y'`/`y2` wrappers around a
// side-family body — see F2lSolver.SLOT_ROTATION. They are enumerated and gated here.

const z2 = () => applyMove(solvedState(), 18);

const SLOT_DEFS: Record<string, { cornerSlot: number; edgeSlot: number; cornerPiece: number; edgePiece: number }> = {
  'f2l-fr': { cornerSlot: 4, edgeSlot: 8,  cornerPiece: 3, edgePiece: 9  },
  'f2l-fl': { cornerSlot: 5, edgeSlot: 9,  cornerPiece: 0, edgePiece: 8  },
  'f2l-bl': { cornerSlot: 6, edgeSlot: 11, cornerPiece: 1, edgePiece: 10 },
  'f2l-br': { cornerSlot: 7, edgeSlot: 10, cornerPiece: 2, edgePiece: 11 },
};
const ALL_SLOTS = ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br'];

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
  return s.cornerPieces.join('')+'|'+s.cornerOrient.join('')+'|'+s.edgePieces.join('')+'|'+s.edgeOrient.join('');
}

// Beginner emit vocabulary: U/R/L/F quarter+half turns and the y/y'/y2 working-slot
// rotation wrappers. Never B/D, wide (lowercase), or slice (M/E/S).
const VOCAB = /^(U[2']?|R[2']?|L[2']?|F[2']?|y[2']?)$/;

function enumerateCases(target: string, tier: number, maxLen: number): RawState[] {
  const isRight = target === 'f2l-fr' || target === 'f2l-br';
  const face = isRight ? [6,7,8] : [9,10,11];      // R family / L family
  // Generator includes the front face F (12,13,14): ⟨U, side⟩ alone cannot reach
  // (nor solve) a general pair — the DF/DB cross edges never move under U/R/L — so
  // a U+side-only generator was CIRCULAR (it only produced positions U+side could
  // reverse). U+side+F is the real beginner front-block and the honest domain.
  const GEN = [0,1,2, ...face, 12,13,14];
  const others = ALL_SLOTS.filter(l => l !== target);
  const seen = new Set<string>();
  const cases: RawState[] = [];
  function dfs(s: RawState, depth: number, last: number) {
    if (depth > 0 && crossOk(s) && others.every(l => slotSolved(s, l)) &&
        !slotSolved(s, target) && getPairTier(s, target) === tier) {
      const k = key(s);
      if (!seen.has(k)) { seen.add(k); cases.push(s); }
    }
    if (depth === maxLen) return;
    for (const m of GEN) {
      if (last >= 0 && Math.floor(m/3) === Math.floor(last/3)) continue;
      dfs(applyMove(s, m), depth+1, m);
    }
  }
  dfs(z2(), 0, -1);
  return cases;
}

interface CoverageReport {
  slot: string; tier: number; total: number;
  byMethod: Record<string, number>;
  fallThrough: number; roundTripFails: number; vocabularyViolations: number; maxLen: number;
}

function report(slot: string, tier: number, maxLen = 9): CoverageReport {
  const cases = enumerateCases(slot, tier, maxLen);
  const r: CoverageReport = { slot, tier, total: cases.length, byMethod: {}, fallThrough: 0, roundTripFails: 0, vocabularyViolations: 0, maxLen: 0 };
  for (const c of cases) {
    const stages = solveF2lIntuitive(c);
    const st = stages.find(x => x.label === slot);
    const method = (st?.method ?? 'search-fallback') as BeginnerMethod;
    const alg = st?.alg ?? '';
    r.byMethod[method] = (r.byMethod[method] ?? 0) + 1;
    if (method === 'search-fallback') r.fallThrough++;
    const toks = alg.trim() ? alg.trim().split(/\s+/) : [];
    r.maxLen = Math.max(r.maxLen, toks.length);
    if (toks.some(t => !VOCAB.test(t))) r.vocabularyViolations++;
    let s = c;
    for (const x of stages) if (x.alg) s = applyAlg(s, x.alg);
    if (!(ALL_SLOTS.every(l => slotSolved(s, l)) && crossOk(s))) r.roundTripFails++;
  }
  return r;
}

describe('beginner F2L procedure coverage (fall-through counter)', () => {
  for (const slot of ALL_SLOTS) {
    for (const tier of [2, 3, 4]) {
      it(`${slot} tier-${tier}: 100% procedure coverage, round-trip, vocabulary, length`, () => {
        const r = report(slot, tier);
        const by = Object.entries(r.byMethod).map(([m, n]) => `${m}:${n}`).join(' ');
        console.log(`${slot} tier-${tier}: ${r.total} cases | ${by} | fall-through ${r.fallThrough} | rtFail ${r.roundTripFails} | vocab ${r.vocabularyViolations} | maxLen ${r.maxLen}`);
        expect(r.total, 'enumeration produced cases').toBeGreaterThan(0);
        expect(r.fallThrough, 'SC-001: no search-fallback').toBe(0);
        expect(r.roundTripFails, 'SC-002: every emit round-trips').toBe(0);
        expect(r.vocabularyViolations, 'SC-003: beginner vocabulary only').toBe(0);
        expect(r.maxLen, 'SC-004: within PROCEDURE_MAX').toBeLessThanOrEqual(PROCEDURE_MAX);
      });
    }
  }
});
