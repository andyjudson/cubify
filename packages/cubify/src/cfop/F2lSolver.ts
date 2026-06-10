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

// Admissible lower bound: if both target pieces are in wrong D-layer slots, need ≥2 moves.
// Prunes branches that cannot reach the goal within the remaining budget.
function f2lH(s: RawState, target: string): number {
  const def = SLOT_DEFS[target];
  if (slotSolved(s, target)) return 0;
  const cIdx = s.cornerPieces.indexOf(def.cornerPiece);
  const eIdx = s.edgePieces.indexOf(def.edgePiece);
  if (cIdx >= 4 && cIdx !== def.cornerSlot && eIdx >= 4 && eIdx !== def.edgeSlot) return 2;
  return 1;
}

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
  if (budget < f2lH(s, target)) return false; // heuristic pruning

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

// F2L_MOVES IDA* cap at depth 8: worst case ~430ms per slot, ~1.7s for 4 slots.
// Positions needing depth 9+ fall through to the INTUITIVE_MOVES depth-10 fallback.
const F2L_IDA_MAX_DEPTH = 8;

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

    // Primary: comprehensive extraction + trigger approach using all F2L moves.
    // Handles virtually all positions in milliseconds without IDA*.
    const quickAlg = solveSlotFull(s, slot, completedSlots);
    if (quickAlg) {
      result[slot] = quickAlg;
      s = applyAlg(s, quickAlg);
      completedSlots.push(slot);
      continue;
    }

    // Fallback: IDA* with F2L_MOVES + heuristic pruning (≤430ms per slot at depth 8).
    let found = false;
    for (let depth = 1; depth <= F2L_IDA_MAX_DEPTH; depth++) {
      const path: number[] = [];
      if (idaDfs(s, depth, -1, path, slot, completedSlots)) {
        const alg = path.map(m => MOVE_NAMES[m]).join(' ');
        result[slot] = alg;
        for (const m of path) s = applyMove(s, m);
        completedSlots.push(slot);
        found = true;
        break;
      }
      if (_cancelled) break;
    }

    if (!found) {
      result[slot] = '';
      completedSlots.push(slot);
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

// Extended setup algs including F and B for the full (non-intuitive) solver.
// Covers pieces that need front/back-face setups that R/L can't reach.
const FULL_SETUP_ALGS = [
  ...SETUP_ALGS,
  "F U F'", "F U' F'", "F' U' F", "F' U F",
  "B U' B'", "B U B'", "B' U B", "B' U' B",
];

/** Tier-2: both in U-layer but no direct trigger. Brute-force AUF + setup + easy insert. */
function solveSetupInsert(state: RawState, slot: string, setups = SETUP_ALGS): string {
  for (const preAuf of AUF_ALGS) {
    const s1 = preAuf ? applyAlg(state, preAuf) : state;
    for (const setup of setups) {
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

// Short extraction sequences that bring pieces to the U-layer.
// Trying all combos of 1 or 2 of these before setup insert covers all tier-3/4 positions.
const EXTRACTIONS = [
  "R U R'", "R U' R'", "R U2 R'",
  "L' U' L", "L' U L", "L' U2 L",
  "U R U' R'", "U' L' U L",
  "U' R' U R", "U L U' L'",
];

function tryExtractAndInsert(
  state: RawState, slot: string, mustSolve: string[],
  prefix: string,
  setups = SETUP_ALGS,
): string {
  const s = prefix ? applyAlg(state, prefix) : state;
  const easy = solveEasyInsert(s, slot);
  if (easy) {
    const full = [prefix, easy].filter(Boolean).join(' ');
    const after = applyAlg(state, full);
    if (slotSolved(after, slot) && crossOk(after) &&
        mustSolve.every(m => slotSolved(after, m))) return full;
  }
  const setup = solveSetupInsert(s, slot, setups);
  if (setup) {
    const full = [prefix, setup].filter(Boolean).join(' ');
    const after = applyAlg(state, full);
    if (slotSolved(after, slot) && crossOk(after) &&
        mustSolve.every(m => slotSolved(after, m))) return full;
  }
  return '';
}

/** Solve one slot using U+R+L only (intuitive/beginner mode). Returns '' if can't find solution. */
function solveSlotIntuitive(state: RawState, slot: string, mustSolve: string[]): string {
  if (slotSolved(state, slot) && crossOk(state)) return '';

  // Direct (no extraction)
  const direct = tryExtractAndInsert(state, slot, mustSolve, '');
  if (direct) return direct;

  // One-step extraction
  for (const ext of EXTRACTIONS) {
    const alg = tryExtractAndInsert(state, slot, mustSolve, ext);
    if (alg) return alg;
  }

  // Two-step extraction — covers tier-4 (both pieces stuck in D-layer)
  for (const ext1 of EXTRACTIONS) {
    const s1 = applyAlg(state, ext1);
    for (const ext2 of EXTRACTIONS) {
      const alg = tryExtractAndInsert(s1, slot, mustSolve, ext2);
      if (alg) {
        const full = `${ext1} ${alg}`;
        const after = applyAlg(state, full);
        if (slotSolved(after, slot) && crossOk(after) &&
            mustSolve.every(m => slotSolved(after, m))) return full;
      }
    }
  }

  return '';
}

// Extended extractions including F and B moves for the full solver.
const FULL_EXTRACTIONS = [
  ...EXTRACTIONS,
  "F U F'", "F U' F'",
  "B U' B'", "B U B'",
];

/**
 * Solve one slot using all F2L moves (standard CFOP, not restricted to U+R+L).
 * Uses extended extractions and setups including F/B moves — covers all positions
 * without needing slow IDA*.
 */
function solveSlotFull(state: RawState, slot: string, mustSolve: string[]): string {
  if (slotSolved(state, slot) && crossOk(state)) return '';

  // Direct (no extraction)
  const direct = tryExtractAndInsert(state, slot, mustSolve, '', FULL_SETUP_ALGS);
  if (direct) return direct;

  // One-step extraction (extended)
  for (const ext of FULL_EXTRACTIONS) {
    const alg = tryExtractAndInsert(state, slot, mustSolve, ext, FULL_SETUP_ALGS);
    if (alg) return alg;
  }

  // Two-step extraction — covers even the most complex F2L positions
  for (const ext1 of FULL_EXTRACTIONS) {
    const s1 = applyAlg(state, ext1);
    for (const ext2 of FULL_EXTRACTIONS) {
      const alg = tryExtractAndInsert(s1, slot, mustSolve, ext2, FULL_SETUP_ALGS);
      if (alg) {
        const full = `${ext1} ${alg}`;
        const after = applyAlg(state, full);
        if (slotSolved(after, slot) && crossOk(after) &&
            mustSolve.every(m => slotSolved(after, m))) return full;
      }
    }
  }

  return '';
}

/** Solve one slot in intuitive mode: try U+R+L extraction first, fall back to full extraction. */
function solveSlotIntuitiveWithFallback(state: RawState, slot: string, mustSolve: string[]): string {
  return solveSlotIntuitive(state, slot, mustSolve) || solveSlotFull(state, slot, mustSolve);
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
    const alg = solveSlotIntuitiveWithFallback(s, bestSlot, completed);
    if (alg) s = applyAlg(s, alg);
    result.push({ label: bestSlot, alg });
    unsolved.delete(bestSlot);

    // Re-check: only re-add slots that were previously solved (non-empty alg) but got disturbed.
    for (const r of result) {
      if (r.label !== bestSlot && r.alg !== '' && !unsolved.has(r.label) && !slotSolved(s, r.label)) {
        unsolved.add(r.label);
      }
    }
  }

  // Remaining unsolved slots: full extraction then IDA* depth 8 as last resort.
  for (const slot of unsolved) {
    if (_cancelled) return result;
    const completed = result.map(r => r.label);
    let alg = solveSlotIntuitiveWithFallback(s, slot, completed);
    if (!alg) {
      const path: number[] = [];
      for (let depth = 1; depth <= F2L_IDA_MAX_DEPTH && !alg; depth++) {
        if (idaDfs(s, depth, -1, path, slot, completed)) alg = path.map(m => MOVE_NAMES[m]).join(' ');
        if (_cancelled) break;
      }
    }
    if (alg) s = applyAlg(s, alg);
    result.push({ label: slot, alg: alg ?? '' });
  }

  return result;
}
