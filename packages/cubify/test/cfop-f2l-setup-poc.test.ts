import { describe, it } from 'vitest';
import { solvedState, applyMove, applyAlg, MOVE_NAMES, type RawState } from '../src/cfop/CfopMoveTables.ts';
import { solveF2lIntuitive, getPairTier } from '../src/cfop/F2lSolver.ts';

// ── POC: characterize current intuitive setup-insert (tier-2) output for FR ──
//
// We generate REAL tier-2 FR cases with no third-party algs: enumerate short
// U+R sequences from z2-solved, keep states where the cross is intact, FL/BL/BR
// are still solved, FR is unsolved, both FR pieces are in the top (U) layer, and
// there is no direct easy-insert trigger (getPairTier === 2). These are exactly
// the "setup pair then insert" positions from IntuitivePage Step 3.

const z2 = () => applyMove(solvedState(), 18);

const SLOT_DEFS: Record<string, { cornerSlot: number; edgeSlot: number; cornerPiece: number; edgePiece: number }> = {
  'f2l-fr': { cornerSlot: 4, edgeSlot: 8,  cornerPiece: 3, edgePiece: 9  },
  'f2l-fl': { cornerSlot: 5, edgeSlot: 9,  cornerPiece: 0, edgePiece: 8  },
  'f2l-bl': { cornerSlot: 6, edgeSlot: 11, cornerPiece: 1, edgePiece: 10 },
  'f2l-br': { cornerSlot: 7, edgeSlot: 10, cornerPiece: 2, edgePiece: 11 },
};

function crossOk(s: RawState): boolean {
  return s.edgePieces[4]===0 && s.edgeOrient[4]===0 &&
         s.edgePieces[5]===3 && s.edgeOrient[5]===0 &&
         s.edgePieces[6]===2 && s.edgeOrient[6]===0 &&
         s.edgePieces[7]===1 && s.edgeOrient[7]===0;
}
function slotSolved(s: RawState, label: string): boolean {
  const d = SLOT_DEFS[label];
  return s.cornerPieces[d.cornerSlot] === d.cornerPiece && s.cornerOrient[d.cornerSlot] === 0 &&
         s.edgePieces[d.edgeSlot] === d.edgePiece && s.edgeOrient[d.edgeSlot] === 0;
}
function key(s: RawState): string {
  return s.cornerPieces.join('')+'|'+s.cornerOrient.join('')+'|'+s.edgePieces.join('')+'|'+s.edgeOrient.join('');
}

function inTop(s: RawState, slot: string): { c: boolean; e: boolean } {
  const d = SLOT_DEFS[slot];
  return { c: s.cornerPieces.indexOf(d.cornerPiece) < 4, e: s.edgePieces.indexOf(d.edgePiece) < 4 };
}

// Enumerate cases for `target` slot at a given tier, reachable by U + the slot's
// face, with the cross and all OTHER slots solved (so we measure that slot in
// isolation). Returns unique states.
function enumerateCases(target: string, tier: number, maxLen: number): RawState[] {
  const isRight = target === 'f2l-fr' || target === 'f2l-br';
  const face = isRight ? [6,7,8] : [9,10,11];      // R family / L family
  const GEN = [0,1,2, ...face];
  const others = ['f2l-fr','f2l-fl','f2l-bl','f2l-br'].filter(l => l !== target);
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

function moveCount(alg: string): number {
  return alg.trim() ? alg.trim().split(/\s+/).length : 0;
}

function characterize(label: string, target: string, tier: number, maxLen: number) {
  const cases = enumerateCases(target, tier, maxLen);
  const lengths: number[] = [];
  let roundTripFails = 0;
  const worst: Array<{ len: number; alg: string }> = [];

  for (const c of cases) {
    const stages = solveF2lIntuitive(c);
    const st = stages.find(x => x.label === target);
    const alg = st?.alg ?? '';
    lengths.push(moveCount(alg));
    let s = c;
    for (const x of stages) if (x.alg) s = applyAlg(s, x.alg);
    const solved = ['f2l-fr','f2l-fl','f2l-bl','f2l-br'].every(l => slotSolved(s, l)) && crossOk(s);
    if (!solved) roundTripFails++;
    worst.push({ len: moveCount(alg), alg });
  }
  if (cases.length === 0) { console.log(`\n=== ${label}: 0 cases ===`); return; }
  lengths.sort((a,b)=>a-b);
  const n = lengths.length, sum = lengths.reduce((a,b)=>a+b,0);
  const hist: Record<number, number> = {};
  for (const l of lengths) hist[l] = (hist[l]??0)+1;
  worst.sort((a,b)=>b.len-a.len);
  console.log(`\n=== ${label}: ${n} unique cases ===`);
  console.log(`round-trip failures: ${roundTripFails}`);
  console.log(`move-count: min ${lengths[0]}  median ${lengths[Math.floor(n/2)]}  max ${lengths[n-1]}  mean ${(sum/n).toFixed(2)}`);
  console.log('histogram (len:count):', Object.entries(hist).map(([l,c])=>`${l}:${c}`).join('  '));
  console.log('worst 6:\n  ' + worst.slice(0,6).map(w=>`len ${String(w.len).padStart(2)}  ${w.alg}`).join('\n  '));
}

describe('POC: current intuitive F2L output characterization', () => {
  it('FR tier-2 (setup-insert, both in top)', () => characterize('FR tier-2 setup-insert', 'f2l-fr', 2, 9));
  it('FR tier-3 (one piece stuck in slot)', () => characterize('FR tier-3 stuck-in-slot', 'f2l-fr', 3, 9));
  it('FL tier-2 (setup-insert, both in top)', () => characterize('FL tier-2 setup-insert', 'f2l-fl', 2, 9));
  it('FL tier-3 (one piece stuck in slot)', () => characterize('FL tier-3 stuck-in-slot', 'f2l-fl', 3, 9));
});
