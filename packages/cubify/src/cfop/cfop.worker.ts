import { type RawState, toRawState, applyMove, applyAlg, MOVE_NAMES } from './CfopMoveTables.js';
import { solveCross, cancelCross } from './CrossSolver.js';
import { solveF2l, solveF2lIntuitive, cancelF2l } from './F2lSolver.js';
import { solveOll, solveTwoLookOll } from './OllSolver.js';
import { solvePll, solveTwoLookPll } from './PllSolver.js';

export type SolveStageLabel = 'cross' | 'f2l-fr' | 'f2l-fl' | 'f2l-br' | 'f2l-bl' | 'oll' | 'oll-edges' | 'oll-corners' | 'pll' | 'pll-corners' | 'pll-edges';

export interface SolveStage {
  label: SolveStageLabel;
  alg: string;
  mask: string;
  moves: number;
  caseName?: string;
  wcaId?: string | number;
}

export interface CfopSolution {
  stages: SolveStage[];
  totalMoves: number;
  setupAlg: string;
}

type WorkerInMessage =
  | { type: 'solve'; patternStr: string; timeoutMs?: number; beginner?: boolean }
  | { type: 'cancel' };

const MASK: Record<SolveStageLabel, string> = {
  'cross':       'cross-inv-dim',
  'f2l-fr':      'f2l-dim', // overridden dynamically by buildF2lMask
  'f2l-fl':      'f2l-dim',
  'f2l-bl':      'f2l-dim',
  'f2l-br':      'f2l-dim',
  'oll':         'oll-face-dim',
  'oll-edges':   'oll-face-dim',
  'oll-corners': 'oll-face-dim',
  'pll':         'pll-face-dim',
  'pll-corners': 'pll-face-dim',
  'pll-edges':   'pll-face-dim',
};

// Cross edge piece IDs in z2 frame (same as CrossSolver.CROSS_PIECES)
const CROSS_EDGE_PIECES = [0, 3, 2, 1];

function buildCrossMask(state: RawState): string {
  const edges = Array(12).fill('D');
  for (const piece of CROSS_EDGE_PIECES) {
    const slot = state.edgePieces.indexOf(piece);
    if (slot >= 0) edges[slot] = '-';
  }
  return `CORNERS:DDDDDDDD,EDGES:${edges.join('')},CENTERS:------`;
}

// Target piece IDs for each F2L slot (piece IDs are KPattern-compatible, matching toRawState)
const F2L_PIECES: Record<string, { cornerPiece: number; edgePiece: number }> = {
  'f2l-fr': { cornerPiece: 3, edgePiece: 9  },
  'f2l-fl': { cornerPiece: 0, edgePiece: 8  },
  'f2l-bl': { cornerPiece: 1, edgePiece: 10 },
  'f2l-br': { cornerPiece: 2, edgePiece: 11 },
};

/**
 * Build a piece-tracking orbit string for the given F2L stage.
 * Marks the target corner and edge pieces bright (wherever they are) so the
 * material bakes onto the right cubelets and travels with them during animation.
 * Everything else is dimmed; centers stay visible for face-colour reference.
 */
function buildF2lMask(state: RawState, label: string): string {
  const { cornerPiece, edgePiece } = F2L_PIECES[label];
  const cSlot = state.cornerPieces.indexOf(cornerPiece);
  const eSlot = state.edgePieces.indexOf(edgePiece);
  const corners = Array(8).fill('D');
  if (cSlot >= 0) corners[cSlot] = '-';
  const edges = Array(12).fill('D');
  if (eSlot >= 0) edges[eSlot] = '-';
  return `CORNERS:${corners.join('')},EDGES:${edges.join('')},CENTERS:------`;
}

function countMoves(alg: string): number {
  if (!alg.trim()) return 0;
  return alg.trim().split(/\s+/).length;
}

let _cancelled = false;
let busy = false;

self.addEventListener('message', (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    _cancelled = true;
    cancelCross();
    cancelF2l();
    busy = false;
    return;
  }

  if (msg.type !== 'solve') return;
  if (busy) return;

  busy = true;
  _cancelled = false;

  const start = Date.now();

  try {
    const patternData = JSON.parse(msg.patternStr);
    // Apply z2 to bring white to D, yellow to U (solver's working frame)
    let state = applyMove(toRawState(patternData), 18); // move index 18 = z2

    const stages: SolveStage[] = [];

    // — Cross —
    if (_cancelled) { busy = false; return; }
    const crossAlg = solveCross(state);
    const crossMask = buildCrossMask(state); // capture before applying alg
    if (crossAlg) state = applyAlg(state, crossAlg);
    stages.push({ label: 'cross', alg: crossAlg, mask: crossMask, moves: countMoves(crossAlg) });

    // — F2L —
    if (_cancelled) { busy = false; return; }
    if (msg.beginner) {
      const intuitiveStages = solveF2lIntuitive(state);
      for (const { label, alg } of intuitiveStages) {
        if (_cancelled) { busy = false; return; }
        const mask = buildF2lMask(state, label);
        if (alg) state = applyAlg(state, alg);
        stages.push({ label: label as SolveStageLabel, alg, mask, moves: countMoves(alg) });
      }
    } else {
      const f2lAlgs = solveF2l(state, []);
      const f2lOrder: SolveStageLabel[] = ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br'];
      for (const lbl of f2lOrder) {
        if (_cancelled) { busy = false; return; }
        const alg = f2lAlgs[lbl] ?? '';
        const mask = buildF2lMask(state, lbl);
        if (alg) state = applyAlg(state, alg);
        stages.push({ label: lbl, alg, mask, moves: countMoves(alg) });
      }
    }

    // — OLL —
    if (_cancelled) { busy = false; return; }
    if (msg.beginner) {
      const tlo = solveTwoLookOll(state);
      if (tlo.eoll.alg) state = applyAlg(state, tlo.eoll.alg);
      stages.push({ label: 'oll-edges',   alg: tlo.eoll.alg, mask: MASK['oll-edges'],   moves: countMoves(tlo.eoll.alg), caseName: tlo.eoll.caseName, wcaId: tlo.eoll.wcaId });
      if (tlo.ocll.alg) state = applyAlg(state, tlo.ocll.alg);
      stages.push({ label: 'oll-corners', alg: tlo.ocll.alg, mask: MASK['oll-corners'], moves: countMoves(tlo.ocll.alg), caseName: tlo.ocll.caseName, wcaId: tlo.ocll.wcaId });
    } else {
      const ollResult = solveOll(state);
      if (ollResult.alg) state = applyAlg(state, ollResult.alg);
      stages.push({ label: 'oll', alg: ollResult.alg, mask: MASK['oll'], moves: countMoves(ollResult.alg), caseName: ollResult.caseName, wcaId: ollResult.wcaId });
    }

    // — PLL —
    if (_cancelled) { busy = false; return; }
    if (msg.beginner) {
      const tlp = solveTwoLookPll(state);
      if (tlp.cpll.alg) state = applyAlg(state, tlp.cpll.alg);
      stages.push({ label: 'pll-corners', alg: tlp.cpll.alg, mask: MASK['pll-corners'], moves: countMoves(tlp.cpll.alg), caseName: tlp.cpll.caseName, wcaId: tlp.cpll.wcaId });
      if (tlp.epll.alg) state = applyAlg(state, tlp.epll.alg);
      stages.push({ label: 'pll-edges',   alg: tlp.epll.alg, mask: MASK['pll-edges'],   moves: countMoves(tlp.epll.alg), caseName: tlp.epll.caseName, wcaId: tlp.epll.wcaId });
    } else {
      const pllResult = solvePll(state);
      stages.push({ label: 'pll', alg: pllResult.alg, mask: MASK['pll'], moves: countMoves(pllResult.alg), caseName: pllResult.caseName, wcaId: pllResult.wcaId });
    }

    const totalMoves = stages.reduce((sum, s) => sum + s.moves, 0);
    const solution: CfopSolution = { stages, totalMoves, setupAlg: 'z2' };

    self.postMessage({ type: 'solution', solution, elapsedMs: Date.now() - start });
  } catch (err) {
    self.postMessage({ type: 'error', reason: 'internal', message: String(err), elapsedMs: Date.now() - start });
  } finally {
    busy = false;
  }
});
