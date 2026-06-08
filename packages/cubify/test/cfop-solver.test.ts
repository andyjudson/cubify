import { describe, it, expect } from 'vitest';
import { solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import type { RawState } from '../src/cfop/CfopMoveTables.ts';
import { solveCross } from '../src/cfop/CrossSolver.ts';
import { solveF2l } from '../src/cfop/F2lSolver.ts';
import { solveOll, solveTwoLookOll } from '../src/cfop/OllSolver.ts';
import { solvePll, solveTwoLookPll } from '../src/cfop/PllSolver.ts';
import { MASK_PRESETS } from '../src/CubeStickering.ts';

const VALID_MASK_KEYS = new Set(MASK_PRESETS.map(p => p.label));

const STATIC_MASKS: Record<string, string> = {
  'oll': 'oll-face-dim',
  'pll': 'pll-face-dim',
};

const F2L_PIECES: Record<string, { cornerPiece: number; edgePiece: number }> = {
  'f2l-fr': { cornerPiece: 3, edgePiece: 9  },
  'f2l-fl': { cornerPiece: 0, edgePiece: 8  },
  'f2l-bl': { cornerPiece: 1, edgePiece: 10 },
  'f2l-br': { cornerPiece: 2, edgePiece: 11 },
};

function buildCrossMask(s: RawState): string {
  const crossPieces = [0, 3, 2, 1];
  const edges = Array(12).fill('D');
  for (const p of crossPieces) { const slot = s.edgePieces.indexOf(p); if (slot >= 0) edges[slot] = '-'; }
  return `CORNERS:DDDDDDDD,EDGES:${edges.join('')},CENTERS:------`;
}

function buildF2lMask(s: RawState, lbl: string): string {
  const { cornerPiece, edgePiece } = F2L_PIECES[lbl];
  const cSlot = s.cornerPieces.indexOf(cornerPiece);
  const eSlot = s.edgePieces.indexOf(edgePiece);
  const corners = Array(8).fill('D');
  if (cSlot >= 0) corners[cSlot] = '-';
  const edges = Array(12).fill('D');
  if (eSlot >= 0) edges[eSlot] = '-';
  return `CORNERS:${corners.join('')},EDGES:${edges.join('')},CENTERS:------`;
}

interface Stage { label: string; alg: string; mask: string; }

// Simulates cfop.worker.ts pipeline: scramble in standard frame, z2, then solve.
function buildSolution(scramble: string): { stages: Stage[]; finalState: RawState } {
  let s = applyMove(applyAlg(solvedState(), scramble), 18);
  const stages: Stage[] = [];

  const crossAlg = solveCross(s);
  const crossMask = buildCrossMask(s);
  if (crossAlg) s = applyAlg(s, crossAlg);
  stages.push({ label: 'cross', alg: crossAlg, mask: crossMask });

  const f2l = solveF2l(s, []);
  for (const lbl of ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']) {
    const alg = f2l[lbl] ?? '';
    const mask = buildF2lMask(s, lbl);
    if (alg) s = applyAlg(s, alg);
    stages.push({ label: lbl, alg, mask });
  }

  const oll = solveOll(s);
  stages.push({ label: 'oll', alg: oll.alg, mask: STATIC_MASKS['oll'] });
  if (oll.alg) s = applyAlg(s, oll.alg);

  const pll = solvePll(s);
  stages.push({ label: 'pll', alg: pll.alg, mask: STATIC_MASKS['pll'] });
  if (pll.alg) s = applyAlg(s, pll.alg);

  return { stages, finalState: s };
}

function isZ2Solved(s: RawState): boolean {
  const expected = applyMove(solvedState(), 18);
  for (let i = 0; i < 8; i++) {
    if (s.cornerPieces[i] !== expected.cornerPieces[i]) return false;
    if (s.cornerOrient[i] !== expected.cornerOrient[i]) return false;
  }
  for (let i = 0; i < 12; i++) {
    if (s.edgePieces[i] !== expected.edgePieces[i]) return false;
    if (s.edgeOrient[i] !== expected.edgeOrient[i]) return false;
  }
  return true;
}

const SCRAMBLES = [
  "R U R' U'",
  "F R U R' U' F'",
  "R U2 R' U' R U' R'",
  "R U R' U R U2 R'",
  "F R U R' U' F' R U R' U R U2 R'",
];

describe('CFOP solver end-to-end', () => {
  it('always produces exactly 7 stages', () => {
    for (const scramble of SCRAMBLES) {
      const { stages } = buildSolution(scramble);
      expect(stages.length, `stages for "${scramble}"`).toBe(7);
    }
  });

  it('applying all stages produces the solved state', () => {
    for (const scramble of SCRAMBLES) {
      const { finalState } = buildSolution(scramble);
      expect(isZ2Solved(finalState), `solved after "${scramble}"`).toBe(true);
    }
  });

  it('each stage mask is a valid preset key or orbit string', () => {
    const dynamicLabels = new Set(['cross', 'f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']);
    for (const scramble of SCRAMBLES) {
      const { stages } = buildSolution(scramble);
      for (const stage of stages) {
        if (dynamicLabels.has(stage.label)) {
          expect(stage.mask, `dynamic mask for "${stage.label}"`).toMatch(/^CORNERS:[A-Z-]{8},EDGES:[A-Z-]{12},CENTERS:/);
        } else {
          expect(VALID_MASK_KEYS.has(stage.mask), `mask "${stage.mask}" for stage "${stage.label}"`).toBe(true);
        }
      }
    }
  });

  it('stage labels are in correct order', () => {
    const { stages } = buildSolution("R U R' U'");
    const labels = stages.map(s => s.label);
    expect(labels).toEqual(['cross', 'f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br', 'oll', 'pll']);
  });
});

// Simulates cfop.worker.ts pipeline with beginner mode enabled.
function buildBeginnerSolution(scramble: string): { stages: { label: string; alg: string; mask: string }[]; finalState: RawState; midOllState: RawState; midPllState: RawState } {
  let s = applyMove(applyAlg(solvedState(), scramble), 18);
  const stages: { label: string; alg: string; mask: string }[] = [];

  const crossAlg = solveCross(s);
  const crossMask = buildCrossMask(s);
  if (crossAlg) s = applyAlg(s, crossAlg);
  stages.push({ label: 'cross', alg: crossAlg, mask: crossMask });

  const f2l = solveF2l(s, []);
  for (const lbl of ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']) {
    const alg = f2l[lbl] ?? '';
    const mask = buildF2lMask(s, lbl);
    if (alg) s = applyAlg(s, alg);
    stages.push({ label: lbl, alg, mask });
  }

  // 2-look OLL
  const tlo = solveTwoLookOll(s);
  stages.push({ label: 'oll-edges',   alg: tlo.eoll.alg, mask: STATIC_MASKS['oll'] });
  if (tlo.eoll.alg) s = applyAlg(s, tlo.eoll.alg);
  stages.push({ label: 'oll-corners', alg: tlo.ocll.alg, mask: STATIC_MASKS['oll'] });
  const midOllState = s; // capture state after EOLL, before OCLL
  if (tlo.ocll.alg) s = applyAlg(s, tlo.ocll.alg);

  // 2-look PLL
  const tlp = solveTwoLookPll(s);
  stages.push({ label: 'pll-corners', alg: tlp.cpll.alg, mask: STATIC_MASKS['pll'] });
  const midPllState = s; // capture state before CPLL
  if (tlp.cpll.alg) s = applyAlg(s, tlp.cpll.alg);
  stages.push({ label: 'pll-edges',   alg: tlp.epll.alg, mask: STATIC_MASKS['pll'] });
  if (tlp.epll.alg) s = applyAlg(s, tlp.epll.alg);

  return { stages, finalState: s, midOllState, midPllState };
}

describe('CFOP solver beginner mode (2-look OLL + 2-look PLL)', () => {
  it('always produces exactly 9 stages', () => {
    for (const scramble of SCRAMBLES) {
      const { stages } = buildBeginnerSolution(scramble);
      expect(stages.length, `stages for "${scramble}"`).toBe(9);
    }
  });

  it('stage labels are in correct beginner order', () => {
    const { stages } = buildBeginnerSolution("R U R' U'");
    const labels = stages.map(s => s.label);
    expect(labels).toEqual(['cross', 'f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br', 'oll-edges', 'oll-corners', 'pll-corners', 'pll-edges']);
  });

  it('applying all 9 stages produces the solved state', () => {
    for (const scramble of SCRAMBLES) {
      const { finalState } = buildBeginnerSolution(scramble);
      expect(isZ2Solved(finalState), `solved after "${scramble}"`).toBe(true);
    }
  });

  it('after oll-edges: U-layer edges all oriented', () => {
    for (const scramble of SCRAMBLES) {
      const { midOllState } = buildBeginnerSolution(scramble);
      expect(midOllState.edgeOrient.slice(0, 4), `eo after EOLL for "${scramble}"`).toEqual([0,0,0,0]);
    }
  });

  it('skip stages present with empty alg when OLL/PLL already solved', () => {
    // Build a state that has cross+F2L+OLL solved — OLL should skip, verify stages still present
    const solved = applyMove(solvedState(), 18);
    const tlo = solveTwoLookOll(solved);
    // Both should be skips
    expect(tlo.eoll.alg).toBe('');
    expect(tlo.ocll.alg).toBe('');
    const tlp = solveTwoLookPll(solved);
    expect(tlp.cpll.caseName).toBe('CPLL Skip');
    expect(tlp.epll.caseName).toBe('PLL Skip');
  });
});
