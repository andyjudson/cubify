import { type RawState, applyMove, MOVE_NAMES, F2L_MOVES } from './CfopMoveTables.js';

type SolveStageLabel = 'cross' | 'f2l-fr' | 'f2l-fl' | 'f2l-br' | 'f2l-bl' | 'oll' | 'pll';

// F2L slots in z2 frame — piece IDs match z2-solved state.
// z2-solved: cornerPieces[4..7]=[3,0,1,2], edgePieces[8..11]=[9,8,11,10]
const SLOT_DEFS: Record<string, { cornerSlot: number; edgeSlot: number; cornerPiece: number; edgePiece: number }> = {
  'f2l-fr': { cornerSlot: 4, edgeSlot: 8,  cornerPiece: 3, edgePiece: 9  },
  'f2l-fl': { cornerSlot: 5, edgeSlot: 9,  cornerPiece: 0, edgePiece: 8  },
  'f2l-bl': { cornerSlot: 6, edgeSlot: 11, cornerPiece: 1, edgePiece: 10 },
  'f2l-br': { cornerSlot: 7, edgeSlot: 10, cornerPiece: 2, edgePiece: 11 },
};

// Cross = D-layer edges solved (z2 frame)
function crossOk(s: RawState): boolean {
  return s.edgePieces[4]===0 && s.edgeOrient[4]===0 &&
         s.edgePieces[5]===3 && s.edgeOrient[5]===0 &&
         s.edgePieces[6]===2 && s.edgeOrient[6]===0 &&
         s.edgePieces[7]===1 && s.edgeOrient[7]===0;
}

function slotSolved(s: RawState, label: string): boolean {
  const def = SLOT_DEFS[label];
  return s.cornerPieces[def.cornerSlot] === def.cornerPiece &&
         s.cornerOrient[def.cornerSlot] === 0 &&
         s.edgePieces[def.edgeSlot] === def.edgePiece &&
         s.edgeOrient[def.edgeSlot] === 0;
}

// Move pruning
const MOVE_FACE = [0,0,0, 1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5,5];
const FACE_AXIS = [0,0, 1,1, 2,2];

function pruned(m: number, prev: number): boolean {
  if (prev < 0) return false;
  const pf = MOVE_FACE[prev], cf = MOVE_FACE[m];
  if (pf === cf) return true;
  if (FACE_AXIS[pf] === FACE_AXIS[cf] && cf < pf) return true;
  return false;
}

const MAX_DEPTH = 12;

let _cancelled = false;

function idaDfs(
  s: RawState,
  budget: number,
  last: number,
  path: number[],
  target: string,
  mustSolve: string[],
): boolean {
  if (_cancelled) return false;

  // Goal check: target slot solved AND cross OK AND all previously-solved slots intact
  if (slotSolved(s, target) && crossOk(s)) {
    for (const lbl of mustSolve) {
      if (!slotSolved(s, lbl)) return false;
    }
    return true;
  }

  if (budget === 0) return false;

  for (const m of F2L_MOVES) {
    if (pruned(m, last)) continue;
    const ns = applyMove(s, m);
    path.push(m);
    if (idaDfs(ns, budget - 1, m, path, target, mustSolve)) return true;
    path.pop();
  }
  return false;
}

/** Solve all four F2L slots in order fr→fl→bl→br. Returns a record of alg strings per slot. */
export function solveF2l(
  state: RawState,
  solvedSlots: SolveStageLabel[],
): Record<string, string> {
  _cancelled = false;
  const result: Record<string, string> = {};
  const order: string[] = ['f2l-fr', 'f2l-fl', 'f2l-bl', 'f2l-br'];

  let s = state;
  const completedSlots: string[] = [...solvedSlots as string[]];

  for (const slot of order) {
    if (slotSolved(s, slot) && crossOk(s)) {
      result[slot] = '';
      completedSlots.push(slot);
      continue;
    }

    let found = false;
    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      const path: number[] = [];
      if (idaDfs(s, depth, -1, path, slot, completedSlots)) {
        const alg = path.map(m => MOVE_NAMES[m]).join(' ');
        result[slot] = alg;
        // Apply moves to carry state forward
        for (const m of path) s = applyMove(s, m);
        completedSlots.push(slot);
        found = true;
        break;
      }
      if (_cancelled) break;
    }

    if (!found) {
      result[slot] = '';
    }
  }

  return result;
}

export function cancelF2l(): void {
  _cancelled = true;
}
