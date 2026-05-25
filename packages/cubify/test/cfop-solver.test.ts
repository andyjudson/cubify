import { describe, it, expect } from 'vitest';
import { solvedState, applyAlg, applyMove } from '../src/cfop/CfopMoveTables.ts';
import type { RawState } from '../src/cfop/CfopMoveTables.ts';
import { solveCross } from '../src/cfop/CrossSolver.ts';
import { solveF2l } from '../src/cfop/F2lSolver.ts';
import { solveOll } from '../src/cfop/OllSolver.ts';
import { solvePll } from '../src/cfop/PllSolver.ts';
import { MASK_PRESETS } from '../src/CubeStickering.ts';

const VALID_MASK_KEYS = new Set(MASK_PRESETS.map(p => p.label));

const STAGE_MASKS: Record<string, string> = {
  'cross':  'cross',
  'f2l-fr': 'f2l', 'f2l-fl': 'f2l',
  'f2l-bl': 'f2l', 'f2l-br': 'f2l',
  'oll':    'oll-face-dim',
  'pll':    'pll-face-dim',
};

interface Stage { label: string; alg: string; mask: string; }

// Simulates cfop.worker.ts pipeline: scramble in standard frame, z2, then solve.
function buildSolution(scramble: string): { stages: Stage[]; finalState: RawState } {
  // Worker receives already-scrambled state, then applies z2
  let s = applyMove(applyAlg(solvedState(), scramble), 18);

  const stages: Stage[] = [];

  const crossAlg = solveCross(s);
  stages.push({ label: 'cross', alg: crossAlg, mask: STAGE_MASKS['cross'] });
  if (crossAlg) s = applyAlg(s, crossAlg);

  const f2l = solveF2l(s, []);
  for (const lbl of ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br']) {
    const alg = f2l[lbl] ?? '';
    stages.push({ label: lbl, alg, mask: STAGE_MASKS[lbl] });
    if (alg) s = applyAlg(s, alg);
  }

  const oll = solveOll(s);
  stages.push({ label: 'oll', alg: oll.alg, mask: STAGE_MASKS['oll'] });
  if (oll.alg) s = applyAlg(s, oll.alg);

  const pll = solvePll(s);
  stages.push({ label: 'pll', alg: pll.alg, mask: STAGE_MASKS['pll'] });
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

  it('each stage mask is a valid MASK_PRESETS key', () => {
    for (const scramble of SCRAMBLES) {
      const { stages } = buildSolution(scramble);
      for (const stage of stages) {
        expect(VALID_MASK_KEYS.has(stage.mask), `mask "${stage.mask}" for stage "${stage.label}"`).toBe(true);
      }
    }
  });

  it('stage labels are in correct order', () => {
    const { stages } = buildSolution("R U R' U'");
    const labels = stages.map(s => s.label);
    expect(labels).toEqual(['cross', 'f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br', 'oll', 'pll']);
  });
});
