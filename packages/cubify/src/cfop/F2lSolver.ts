import { type RawState, applyMove, applyAlg, MOVE_NAMES, F2L_MOVES } from './CfopMoveTables.js';
import { type F2lTrigger, F2L_TRIGGERS } from './CaseLibrary.js';

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

// U + R + L only — never disturbs the cross; used for the intuitive F2L fallback
const INTUITIVE_MOVES = [0,1,2, 6,7,8, 9,10,11];

function idaDfs(
  s: RawState,
  budget: number,
  last: number,
  path: number[],
  target: string,
  mustSolve: string[],
  moves: number[] = F2L_MOVES,
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

  for (const m of moves) {
    if (pruned(m, last)) continue;
    const ns = applyMove(s, m);
    path.push(m);
    if (idaDfs(ns, budget - 1, m, path, target, mustSolve, moves)) return true;
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

// ─── Intuitive F2L ──────────────────────────────────────────────────────────

const AUF_ALGS = ['', 'U', 'U2', "U'"];

// Under k U turns, a piece at slot s moves to slot (s - k + 4) % 4.
// To check if piece at cIdx aligns with trigger.cornerSlot after k turns:
//   k = (cIdx - trigger.cornerSlot + 4) % 4
// Both corner and edge must require the same k for a match.

/** Returns tier 1–4 for a F2L slot based on where its pieces are. */
export function getPairTier(state: RawState, slot: string): 1 | 2 | 3 | 4 {
  const def = SLOT_DEFS[slot];
  const cIdx = state.cornerPieces.indexOf(def.cornerPiece);
  const eIdx = state.edgePieces.indexOf(def.edgePiece);
  const cInTop = cIdx < 4;
  const eInTop = eIdx < 4;

  if (!cInTop && !eInTop) return 4;
  if (cInTop !== eInTop) return 3;

  // Both in U-layer — tier 1 if any trigger matches with some k
  const cOrient = state.cornerOrient[cIdx];
  const eOrient = state.edgeOrient[eIdx];
  for (const t of F2L_TRIGGERS) {
    if (t.target !== slot) continue;
    const k = (cIdx - t.cornerSlot + 4) % 4;
    if (k === (eIdx - t.edgeSlot + 4) % 4 &&
        cOrient === t.cornerOrient && eOrient === t.edgeOrient) {
      return 1;
    }
  }
  return 2;
}

/** Tier-1: both pieces in U-layer and directly insertable. Returns AUF + trigger alg. */
function solveEasyInsert(state: RawState, slot: string): string {
  const def = SLOT_DEFS[slot];
  const cIdx = state.cornerPieces.indexOf(def.cornerPiece);
  const eIdx = state.edgePieces.indexOf(def.edgePiece);
  if (cIdx >= 4 || eIdx >= 4) return '';

  const cOrient = state.cornerOrient[cIdx];
  const eOrient = state.edgeOrient[eIdx];
  for (const t of F2L_TRIGGERS) {
    if (t.target !== slot) continue;
    const k = (cIdx - t.cornerSlot + 4) % 4;
    if (k === (eIdx - t.edgeSlot + 4) % 4 &&
        cOrient === t.cornerOrient && eOrient === t.edgeOrient) {
      const auf = AUF_ALGS[k];
      return auf ? `${auf} ${t.alg}` : t.alg;
    }
  }
  return '';
}

const SETUP_ALGS = [
  "R U' R'", "R U R'", "R' U R", "R' U' R",
  "L' U' L", "L' U L", "L U' L'", "L U L'",
];

/** Tier-2: both in U-layer but no direct trigger. Brute-force AUF + setup + easy insert. */
function solveSetupInsert(state: RawState, slot: string): string {
  for (const preAuf of AUF_ALGS) {
    const s1 = preAuf ? applyAlg(state, preAuf) : state;
    for (const setup of SETUP_ALGS) {
      const s2 = applyAlg(s1, setup);
      const insert = solveEasyInsert(s2, slot);
      if (insert) {
        const parts = [preAuf, setup, insert].filter(Boolean);
        const full = parts.join(' ');
        const after = applyAlg(state, full);
        if (slotSolved(after, slot) && crossOk(after)) return full;
      }
    }
  }
  return '';
}

/** Tier-3/4: extract one or both stuck pieces to U-layer with a single R/L move. */
function extractPiece(state: RawState, slot: string): string {
  const def = SLOT_DEFS[slot];
  const cIdx = state.cornerPieces.indexOf(def.cornerPiece);
  const eIdx = state.edgePieces.indexOf(def.edgePiece);

  // Extract corner if it's stuck in D-layer (not in target slot)
  if (cIdx >= 4 && cIdx !== def.cornerSlot) {
    // Right-side slots (FR=4, BR=7) → R U R'; left-side (FL=5, BL=6) → L' U' L
    const rightSlots = new Set([4, 7]);
    return rightSlots.has(cIdx) ? "R U R'" : "L' U' L";
  }

  // Extract edge if it's stuck in equatorial layer (not in target slot)
  if (eIdx >= 4 && eIdx !== def.edgeSlot) {
    const rightEdgeSlots = new Set([8, 10]); // FR=8, BR=10
    return rightEdgeSlots.has(eIdx) ? "R U R'" : "L' U' L";
  }

  return '';
}

/** Solve one slot intuitively. Returns the alg string (may be empty if already solved). */
function solveSlotIntuitive(state: RawState, slot: string, mustSolve: string[]): string {
  if (slotSolved(state, slot) && crossOk(state)) return '';

  const tier = getPairTier(state, slot);

  if (tier === 1) {
    const alg = solveEasyInsert(state, slot);
    if (alg) return alg;
  }

  if (tier <= 2) {
    const alg = solveSetupInsert(state, slot);
    if (alg) return alg;
  }

  if (tier >= 3) {
    const extract = extractPiece(state, slot);
    if (extract) {
      const afterExtract = applyAlg(state, extract);
      const insert = solveEasyInsert(afterExtract, slot) || solveSetupInsert(afterExtract, slot);
      if (insert) {
        const full = `${extract} ${insert}`;
        const after = applyAlg(state, full);
        if (slotSolved(after, slot) && crossOk(after)) return full;
      }
    }
  }

  // Fallback: IDA* restricted to U + R + L (no B moves in beginner path)
  const path: number[] = [];
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    if (idaDfs(state, depth, -1, path, slot, mustSolve, INTUITIVE_MOVES)) {
      return path.map(m => MOVE_NAMES[m]).join(' ');
    }
    if (_cancelled) return '';
  }
  return '';
}

/** Solve all four F2L slots in fluid priority order (easiest slot first). */
export function solveF2lIntuitive(state: RawState): Array<{ label: string; alg: string }> {
  _cancelled = false;
  const ALL_SLOTS = ['f2l-fr', 'f2l-fl', 'f2l-br', 'f2l-bl'];
  const result: Array<{ label: string; alg: string }> = [];
  const unsolved = new Set(ALL_SLOTS);

  let s = state;
  let maxIter = 20;

  while (unsolved.size > 0 && maxIter-- > 0) {
    if (_cancelled) return [];

    // Add already-solved slots to result with empty alg
    for (const slot of [...unsolved]) {
      if (slotSolved(s, slot) && crossOk(s)) {
        result.push({ label: slot, alg: '' });
        unsolved.delete(slot);
      }
    }
    if (unsolved.size === 0) break;

    // Pick slot with lowest tier
    let bestSlot: string | null = null;
    let bestTier = 5;
    for (const slot of unsolved) {
      const tier = getPairTier(s, slot);
      if (tier < bestTier) { bestTier = tier; bestSlot = slot; }
    }
    if (!bestSlot) break;

    const completed = result.map(r => r.label);
    const alg = solveSlotIntuitive(s, bestSlot, completed);
    if (alg) s = applyAlg(s, alg);
    result.push({ label: bestSlot, alg });
    unsolved.delete(bestSlot);

    // Re-check: if any previously solved slot got disturbed, re-add it
    for (const r of result) {
      if (r.label !== bestSlot && !unsolved.has(r.label) && !slotSolved(s, r.label)) {
        unsolved.add(r.label);
      }
    }
  }

  // Include any remaining unsolved slots via IDA* fallback (U + R + L only)
  for (const slot of unsolved) {
    if (_cancelled) return result;
    const completed = result.map(r => r.label);
    const path: number[] = [];
    let found = false;
    for (let depth = 1; depth <= MAX_DEPTH && !found; depth++) {
      if (idaDfs(s, depth, -1, path, slot, completed, INTUITIVE_MOVES)) found = true;
      if (_cancelled) break;
    }
    const alg = found ? path.map(m => MOVE_NAMES[m]).join(' ') : '';
    if (alg) s = applyAlg(s, alg);
    result.push({ label: slot, alg });
  }

  return result;
}
