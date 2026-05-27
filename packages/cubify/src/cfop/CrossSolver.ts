import { type RawState, applyMove, MOVE_NAMES, N_MOVES } from './CfopMoveTables.js';

// Cross = D-layer edges (slots 4-7) in their z2-frame home positions with orientation 0.
// In z2 frame (solved): edgePieces[4..7] = [0, 3, 2, 1] (originally U-layer edges).
const CROSS_PIECES = [0, 3, 2, 1]; // expected piece ID at slots [4, 5, 6, 7]

function crossSolved(s: RawState): boolean {
  return s.edgePieces[4]===0 && s.edgeOrient[4]===0 &&
         s.edgePieces[5]===3 && s.edgeOrient[5]===0 &&
         s.edgePieces[6]===2 && s.edgeOrient[6]===0 &&
         s.edgePieces[7]===1 && s.edgeOrient[7]===0;
}

function heuristic(s: RawState): number {
  // Count cross pieces NOT currently in any D-layer slot (slots 4–7).
  // One move can bring at most one outside-D piece into D, so this is admissible.
  // Gives values 0–4; dramatically reduces IDA* search at depth 7–8.
  let outsideD = 0;
  for (let t = 0; t < 4; t++) {
    const piece = CROSS_PIECES[t];
    let inD = false;
    for (let i = 4; i < 8; i++) {
      if (s.edgePieces[i] === piece) { inD = true; break; }
    }
    if (!inD) outsideD++;
  }
  if (outsideD > 0) return outsideD;
  return crossSolved(s) ? 0 : 1;
}

// Move pruning: same face or opposite face same axis, lower-indexed last
const MOVE_FACE = [0,0,0, 1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5,5];
const FACE_AXIS = [0,0, 1,1, 2,2]; // U/D=0, R/L=1, F/B=2

function pruned(m: number, prev: number): boolean {
  if (prev < 0) return false;
  const pf = MOVE_FACE[prev], cf = MOVE_FACE[m];
  if (pf === cf) return true;
  if (FACE_AXIS[pf] === FACE_AXIS[cf] && cf < pf) return true;
  return false;
}

const MAX_DEPTH = 9;
const ALL_MOVES = Array.from({ length: N_MOVES }, (_, i) => i);

let _cancelled = false;

function idaDfs(s: RawState, budget: number, last: number, path: number[]): boolean {
  if (_cancelled) return false;
  if (crossSolved(s)) return true;
  const h = heuristic(s);
  if (h > budget) return false;
  if (budget === 0) return false;

  for (const m of ALL_MOVES) {
    if (pruned(m, last)) continue;
    const ns = applyMove(s, m);
    path.push(m);
    if (idaDfs(ns, budget - 1, m, path)) return true;
    path.pop();
  }
  return false;
}

/** Solve the cross (D-layer edges) via IDA*. Returns WCA move string. */
export function solveCross(state: RawState): string {
  _cancelled = false;

  if (crossSolved(state)) return '';

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const path: number[] = [];
    if (idaDfs(state, depth, -1, path)) {
      return path.map(m => MOVE_NAMES[m]).join(' ');
    }
  }

  return '';
}

export function cancelCross(): void {
  _cancelled = true;
}
