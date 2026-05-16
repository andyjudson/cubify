import { coIdx, eoIdx, udSliceIdx, cpIdx, ep4Idx, ep8Idx } from './Coordinates.js';
import { MOVE_NAMES, PHASE2_MOVES, N_MOVES } from './MoveTables.js';
import type { MoveTables } from './MoveTables.js';

export interface TwoPhaseState {
  CORNERS: { pieces: number[]; orientation: number[] };
  EDGES:   { pieces: number[]; orientation: number[] };
}

// face index per move (0=U 1=D 2=R 3=L 4=F 5=B), axis per face
const MOVE_FACE = [0,0,0, 1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5,5];
const FACE_AXIS = [0,0, 1,1, 2,2]; // U/D=0, R/L=1, F/B=2

function pruned(m: number, prev: number): boolean {
  if (prev < 0) return false;
  const pf = MOVE_FACE[prev], cf = MOVE_FACE[m];
  if (pf === cf) return true;
  if (FACE_AXIS[pf] === FACE_AXIS[cf] && cf < pf) return true;
  return false;
}

let _cancelled = false;
let _deadline = 0;
let _nodeCount = 0;
let _onHeartbeat: ((nodes: number) => void) | undefined;
let _lastHeartbeatAt = 0;

function checkTimeout(): boolean {
  if (++_nodeCount % 10000 === 0) {
    const now = Date.now();
    if (now > _deadline) { _cancelled = true; return true; }
    if (now - _lastHeartbeatAt >= 30000) {
      _lastHeartbeatAt = now;
      _onHeartbeat?.(_nodeCount);
    }
  }
  return _cancelled;
}

/**
 * Re-derive edge piece array by replaying the move path from the initial edge state.
 * Used to compute ep4/ep8 once phase 1 is complete (since ep4 is undefined when ud!=494).
 */
function replayEdgePieces(
  initPieces: number[],
  path: number[],
  tables: MoveTables,
): number[] {
  const pieces = initPieces.slice();
  for (const m of path) {
    const p = tables.edgePerm[m];
    const np = pieces.slice();
    for (let i = 0; i < 12; i++) pieces[i] = np[p[i]];
  }
  return pieces;
}

// ---- phase 2 IDA* -----------------------------------------------------------

function phase2IDA(
  cp: number, ep4: number, ep8: number,
  budget: number, lastMove: number,
  path: number[], tables: MoveTables,
): number[] | null {
  if (checkTimeout()) return null;

  const h2 = Math.max(
    tables.prune2CpEp4[cp * 24 + ep4],
    tables.prune2Ep8[ep8],
  );
  if (h2 > budget) return null;

  if (cp === 0 && ep4 === 0 && ep8 === 0) return [...path];

  for (const m of PHASE2_MOVES) {
    if (pruned(m, lastMove)) continue;
    const ncp  = tables.cp[cp * N_MOVES + m];
    const nep4 = tables.ep4[ep4 * N_MOVES + m];
    const nep8 = tables.ep8[ep8 * N_MOVES + m];
    path.push(m);
    const result = phase2IDA(ncp, nep4, nep8, budget - 1, m, path, tables);
    path.pop();
    if (result !== null) return result;
  }
  return null;
}

// ---- phase 1 IDA* -----------------------------------------------------------

function phase1IDA(
  co: number, eo: number, ud: number,
  cp: number,                    // tracked so it's correct at phase-1 solution
  budget: number, lastMove: number,
  path: number[],
  initEdgePieces: number[],
  tables: MoveTables,
): number[] | null {
  if (checkTimeout()) return null;

  const h1 = Math.max(
    tables.prune1CoUD[co * 495 + ud],
    tables.prune1EoUD[eo * 495 + ud],
  );
  if (h1 > budget) return null;

  if (co === 0 && eo === 0 && ud === 494) {
    // Derive phase-2 edge coordinates from the replayed edge piece array
    const ep = replayEdgePieces(initEdgePieces, path, tables);
    const ep4 = ep4Idx(ep);
    const ep8 = ep8Idx(ep);
    // Try phase-2 budgets from 0 up to remaining
    for (let b2 = 0; b2 <= budget; b2++) {
      const result = phase2IDA(cp, ep4, ep8, b2, lastMove, path, tables);
      if (result !== null) return result;
      if (_cancelled) return null;
    }
    return null;
  }

  for (let m = 0; m < N_MOVES; m++) {
    if (pruned(m, lastMove)) continue;
    const nco = tables.co[co * N_MOVES + m];
    const neo = tables.eo[eo * N_MOVES + m];
    const nud = tables.udSlice[ud * N_MOVES + m];
    const ncp = tables.cp[cp * N_MOVES + m];
    path.push(m);
    const result = phase1IDA(nco, neo, nud, ncp, budget - 1, m, path, initEdgePieces, tables);
    path.pop();
    if (result !== null) return result;
  }
  return null;
}

// ---- public API -------------------------------------------------------------

export interface SearchOptions {
  timeoutMs?: number;
  /** If true, return the first solution found (≤20 moves) without proving optimality. Much faster. */
  nonOptimal?: boolean;
  onProgress?: (depth: number, nodes: number) => void;
  onHeartbeat?: (nodes: number) => void;
}

/**
 * Find a solution using 2-phase Kociemba IDA*.
 * Returns a WCA-notation move sequence or null on timeout.
 */
export function search(
  state: TwoPhaseState,
  tables: MoveTables,
  options: SearchOptions = {},
): string | null {
  const { timeoutMs = 10000, nonOptimal = false, onProgress, onHeartbeat } = options;
  _deadline = Date.now() + timeoutMs;
  _cancelled = false;
  _nodeCount = 0;
  _onHeartbeat = onHeartbeat;
  _lastHeartbeatAt = 0;

  const co0  = coIdx(state.CORNERS.orientation);
  const eo0  = eoIdx(state.EDGES.orientation);
  const ud0  = udSliceIdx(state.EDGES.pieces);
  const cp0  = cpIdx(state.CORNERS.pieces);
  const ep4_0 = ep4Idx(state.EDGES.pieces);
  const ep8_0 = ep8Idx(state.EDGES.pieces);

  if (co0 === 0 && eo0 === 0 && ud0 === 494 && cp0 === 0 && ep4_0 === 0 && ep8_0 === 0) {
    return '';
  }

  // Start from the pruning lower bound — depths below this are provably impossible.
  const h0 = Math.max(
    tables.prune1CoUD[co0 * 495 + ud0],
    tables.prune1EoUD[eo0 * 495 + ud0],
  );
  const globalDeadline = _deadline;

  for (let depth = Math.max(1, h0); depth <= 20; depth++) {
    onProgress?.(depth, _nodeCount);

    // Non-optimal: cap each depth at 5s so we skip to deeper searches rather
    // than exhaustively proving no solution exists at this depth.
    if (nonOptimal) _deadline = Math.min(globalDeadline, Date.now() + 5000);

    const path: number[] = [];
    const result = phase1IDA(
      co0, eo0, ud0, cp0, depth, -1, path,
      Array.from(state.EDGES.pieces),
      tables,
    );
    if (result !== null) return result.map(m => MOVE_NAMES[m]).join(' ');

    if (_cancelled) {
      if (nonOptimal && Date.now() < globalDeadline) {
        // Per-depth cap hit — reset deadline and try next depth.
        _cancelled = false;
        _deadline = globalDeadline;
      } else {
        return null; // global timeout
      }
    }
  }
  return null;
}
