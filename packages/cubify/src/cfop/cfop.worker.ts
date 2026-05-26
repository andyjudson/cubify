import { type RawState, toRawState, applyMove, applyAlg, MOVE_NAMES } from './CfopMoveTables.js';
import { solveCross, cancelCross } from './CrossSolver.js';
import { solveF2l, cancelF2l } from './F2lSolver.js';
import { solveOll } from './OllSolver.js';
import { solvePll } from './PllSolver.js';

export type SolveStageLabel = 'cross' | 'f2l-fr' | 'f2l-fl' | 'f2l-br' | 'f2l-bl' | 'oll' | 'pll';

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
  | { type: 'solve'; patternStr: string; timeoutMs?: number }
  | { type: 'cancel' };

const MASK: Record<SolveStageLabel, string> = {
  'cross':  'cross-inv-dim',
  'f2l-fr': 'f2l-dim', // overridden dynamically by buildF2lMask
  'f2l-fl': 'f2l-dim',
  'f2l-bl': 'f2l-dim',
  'f2l-br': 'f2l-dim',
  'oll':    'oll-face-dim',
  'pll':    'pll-face-dim',
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
    const f2lAlgs = solveF2l(state, []);
    const f2lOrder: SolveStageLabel[] = ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br'];
    for (const lbl of f2lOrder) {
      if (_cancelled) { busy = false; return; }
      const alg = f2lAlgs[lbl] ?? '';
      const mask = buildF2lMask(state, lbl); // capture piece positions before alg is applied
      if (alg) state = applyAlg(state, alg);
      stages.push({ label: lbl, alg, mask, moves: countMoves(alg) });
    }

    // — OLL —
    if (_cancelled) { busy = false; return; }
    const ollResult = solveOll(state);
    if (ollResult.alg) state = applyAlg(state, ollResult.alg);
    stages.push({
      label: 'oll',
      alg: ollResult.alg,
      mask: MASK['oll'],
      moves: countMoves(ollResult.alg),
      caseName: ollResult.caseName,
      wcaId: ollResult.wcaId,
    });

    // — PLL —
    if (_cancelled) { busy = false; return; }
    const pllResult = solvePll(state);
    stages.push({
      label: 'pll',
      alg: pllResult.alg,
      mask: MASK['pll'],
      moves: countMoves(pllResult.alg),
      caseName: pllResult.caseName,
      wcaId: pllResult.wcaId,
    });

    const totalMoves = stages.reduce((sum, s) => sum + s.moves, 0);
    const solution: CfopSolution = { stages, totalMoves, setupAlg: 'z2' };

    self.postMessage({ type: 'solution', solution, elapsedMs: Date.now() - start });
  } catch (err) {
    self.postMessage({ type: 'error', reason: 'internal', message: String(err), elapsedMs: Date.now() - start });
  } finally {
    busy = false;
  }
});
