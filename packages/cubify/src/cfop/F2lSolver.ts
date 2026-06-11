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

// IDA* depth limits
const F2L_IDA_MAX_DEPTH = 8;
const INTUITIVE_IDA_MAX_DEPTH = 8;

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
      result[slot] = normalizeAlg(quickAlg);
      s = applyAlg(s, quickAlg);
      completedSlots.push(slot);
      continue;
    }

    // Fallback: IDA* with F2L_MOVES + heuristic pruning (≤430ms per slot at depth 8).
    let found = false;
    for (let depth = 1; depth <= F2L_IDA_MAX_DEPTH; depth++) {
      const path: number[] = [];
      if (idaDfs(s, depth, -1, path, slot, completedSlots)) {
        const alg = normalizeAlg(path.map(m => MOVE_NAMES[m]).join(' '));
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

// Beginner mode setup algs: slot-specific (R-only for right slots, L-only for left).
const R_SETUP_ALGS = ["R U' R'", "R U R'", "R' U R", "R' U' R"];
const L_SETUP_ALGS = ["L' U' L", "L' U L", "L U' L'", "L U L'"];

// Combined for the full (non-beginner) solver.
const SETUP_ALGS = [...R_SETUP_ALGS, ...L_SETUP_ALGS];

// Extended setup algs including F and B for the full (non-intuitive) solver.
const FULL_SETUP_ALGS = [
  ...SETUP_ALGS,
  "F U F'", "F U' F'", "F' U' F", "F' U F",
  "B U' B'", "B U B'", "B' U B", "B' U' B",
];

// Right-side slots use R-family moves; left-side slots use L-family moves.
const RIGHT_SLOTS = new Set(['f2l-fr', 'f2l-br']);

function intuitiveSlotsSetups(slot: string): string[] {
  return RIGHT_SLOTS.has(slot) ? R_SETUP_ALGS : L_SETUP_ALGS;
}

/** Tier-2: both in U-layer but no direct trigger. Brute-force AUF + setup + easy insert. */
function solveSetupInsert(state: RawState, slot: string, setups = SETUP_ALGS): string {
  for (const preAuf of AUF_ALGS) {
    const s1 = preAuf ? applyAlg(state, preAuf) : state;
    for (const setup of setups) {
      const s2 = applyAlg(s1, setup);
      const insert = solveEasyInsert(s2, slot);
      if (insert) {
        const parts = [preAuf, setup, insert].filter(Boolean);
        const full = normalizeAlg(parts.join(' '));
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

// Simplify consecutive same-face moves in an alg string (e.g. U2 U → U', U U' → empty).
function normalizeAlg(alg: string): string {
  if (!alg.trim()) return alg;
  const tokens = alg.trim().split(/\s+/);
  const out: string[] = [];
  for (const tok of tokens) {
    if (out.length === 0) { out.push(tok); continue; }
    const last = out[out.length - 1];
    const lastFace = last.replace(/[2']$/, '');
    const currFace = tok.replace(/[2']$/, '');
    if (lastFace === currFace) {
      const la = last.endsWith('2') ? 2 : last.endsWith("'") ? 3 : 1;
      const ca = tok.endsWith('2')  ? 2 : tok.endsWith("'")  ? 3 : 1;
      const total = (la + ca) % 4;
      out.pop();
      if (total === 1) out.push(lastFace);
      else if (total === 2) out.push(lastFace + '2');
      else if (total === 3) out.push(lastFace + "'");
      // total === 0 → cancels, push nothing
    } else {
      out.push(tok);
    }
  }
  return out.join(' ');
}

// Slot-specific extraction sequences: R-family for right slots, L-family for left slots.
// The tutorial always uses the face matching the target slot (R for FR/BR, L for FL/BL).
const R_EXTRACTIONS = [
  "R U R'", "R U' R'", "R U2 R'",
  "U R U' R'", "U' R' U R",
];
const L_EXTRACTIONS = [
  "L' U' L", "L' U L", "L' U2 L",
  "U' L' U L", "U L U' L'",
];

// Combined (used only by the full non-intuitive solver path).
const EXTRACTIONS = [...R_EXTRACTIONS, ...L_EXTRACTIONS];

// 3-move-only subsets for the two-step extraction path.
const R_SHORT_EXTRACTIONS = ["R U R'", "R U' R'", "R U2 R'"];
const L_SHORT_EXTRACTIONS = ["L' U' L", "L' U L", "L' U2 L"];

// Combined short extractions for the full solver.
const SHORT_EXTRACTIONS = [...R_SHORT_EXTRACTIONS, ...L_SHORT_EXTRACTIONS];

// Slot-restricted move sets for IDA*: U + the slot's face only.
// 6 moves, same-face pruning → ~3^d effective nodes; depth 12 = ~530K nodes, trivially fast.
const RIGHT_MOVES = [0, 1, 2,  6,  7,  8];   // U, U', U2, R, R', R2
const LEFT_MOVES  = [0, 1, 2,  9, 10, 11];   // U, U', U2, L, L', L2
const SLOT_RESTRICTED_DEPTH = 12;

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


// B+U only: lets IDA* find pure B/U algs whose B-moves can be rewritten as y R y'.
const B_U_MOVES = [0, 1, 2, 15, 16, 17]; // U, U', U2, B, B', B2

/** Solve a back slot using only B+U moves, then express as y [R-alg] y'.
 *  Since y R y' = B and U commutes with y, any B+U alg = y [R+U alg] y'.
 *  Unlike the y-frame L/U approach, B-moves can flip edge orientations (EDGE_ORIENT[B]≠0)
 *  so this search succeeds where pure L/U in the rotated frame cannot. */
function solveSlotBackRotation(state: RawState, slot: string, mustSolve: string[]): string {
  const path: number[] = [];
  for (let depth = 1; depth <= 12 && !_cancelled; depth++) {
    path.length = 0;
    if (idaDfs(state, depth, -1, path, slot, mustSolve, B_U_MOVES)) {
      const tokens = path.map(m => MOVE_NAMES[m]).map(t => {
        if (t === 'B')  return 'R';
        if (t === "B'") return "R'";
        if (t === 'B2') return 'R2';
        return t;
      });
      return `y ${tokens.join(' ')} y'`;
    }
  }
  return '';
}

function solveSlotIntuitive(state: RawState, slot: string, mustSolve: string[]): string {
  if (slotSolved(state, slot) && crossOk(state)) return '';

  const isRight    = RIGHT_SLOTS.has(slot);
  const setups     = isRight ? R_SETUP_ALGS : L_SETUP_ALGS;
  const extractions = isRight ? R_EXTRACTIONS : L_EXTRACTIONS;
  const shortExts  = isRight ? R_SHORT_EXTRACTIONS : L_SHORT_EXTRACTIONS;

  // Direct (no extraction)
  const direct = tryExtractAndInsert(state, slot, mustSolve, '', setups);
  if (direct) return direct;

  // One-step extraction — slot-face only
  for (const ext of extractions) {
    const alg = tryExtractAndInsert(state, slot, mustSolve, ext, setups);
    if (alg) return alg;
  }

  // Two-step extraction — both steps slot-face only
  for (const ext1 of shortExts) {
    const s1 = applyAlg(state, ext1);
    for (const ext2 of shortExts) {
      const alg = tryExtractAndInsert(s1, slot, mustSolve, ext2, setups);
      if (alg) {
        const full = normalizeAlg(`${ext1} ${alg}`);
        const after = applyAlg(state, full);
        if (slotSolved(after, slot) && crossOk(after) &&
            mustSolve.every(m => slotSolved(after, m))) return full;
      }
    }
  }

  // Cross-face one-step extraction: piece may be stuck in an opposing-face D-slot.
  const crossExts = isRight ? L_EXTRACTIONS : R_EXTRACTIONS;
  for (const ext of crossExts) {
    const alg = tryExtractAndInsert(state, slot, mustSolve, ext, setups);
    if (alg) return alg;
  }

  // Back slots: fall back to a pure B+U search, expressed as y [R-alg] y'.
  // Searched in the original frame so B-moves can correct edge orientation —
  // unlike the y-frame L/U approach, which cannot flip equatorial edge orientations.
  if (slot === 'f2l-br' || slot === 'f2l-bl') {
    return solveSlotBackRotation(state, slot, mustSolve);
  }

  return '';
}

// Extended extractions including F and B moves for the full solver.
const FULL_EXTRACTIONS = [
  ...EXTRACTIONS,
  "F U F'", "F U' F'",
  "B U' B'", "B U B'",
];

// 3-move-only subset of FULL_EXTRACTIONS for the two-step path in the full solver.
const SHORT_FULL_EXTRACTIONS = [
  "R U R'", "R U' R'", "R U2 R'",
  "L' U' L", "L' U L", "L' U2 L",
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

  // Two-step extraction — 3-move extractions only to keep total sequence length manageable
  for (const ext1 of SHORT_FULL_EXTRACTIONS) {
    const s1 = applyAlg(state, ext1);
    for (const ext2 of SHORT_FULL_EXTRACTIONS) {
      const alg = tryExtractAndInsert(s1, slot, mustSolve, ext2, FULL_SETUP_ALGS);
      if (alg) {
        const full = normalizeAlg(`${ext1} ${alg}`);
        const after = applyAlg(state, full);
        if (slotSolved(after, slot) && crossOk(after) &&
            mustSolve.every(m => slotSolved(after, m))) return full;
      }
    }
  }

  return '';
}

/** Solve one slot in intuitive mode: U+R+L extraction only. F/B fallback is intentionally removed. */
function solveSlotIntuitiveWithFallback(state: RawState, slot: string, mustSolve: string[]): string {
  return solveSlotIntuitive(state, slot, mustSolve);
}

/** Solve all four F2L slots in fluid priority order (easiest tier first).
 *
 *  Fluid priority solves whichever slot is easiest first (tier-1 easy inserts immediately,
 *  then tier-2, etc.). This matches the physical beginner approach: opportunistically solve
 *  connected pairs in the top layer before dealing with stuck pieces.
 *
 *  Each slot's alg uses its face's moves (R for FR/BR, L for FL/BL) as much as possible.
 *  Cross-face extraction is used only when pieces are stuck in an opposing-face D-slot. */
export function solveF2lIntuitive(state: RawState): Array<{ label: string; alg: string }> {
  _cancelled = false;
  const ALL_SLOTS = ['f2l-fr', 'f2l-fl', 'f2l-br', 'f2l-bl'];
  const result: Array<{ label: string; alg: string }> = [];
  const unsolved = new Set(ALL_SLOTS);

  let s = state;
  let maxIter = 20;

  while (unsolved.size > 0 && maxIter-- > 0) {
    if (_cancelled) return [];

    // Mark slots that are already solved
    for (const slot of [...unsolved]) {
      if (slotSolved(s, slot) && crossOk(s)) {
        result.push({ label: slot, alg: '' });
        unsolved.delete(slot);
      }
    }
    if (unsolved.size === 0) break;

    // Pick the slot with the lowest tier (easiest to solve next)
    let bestSlot: string | null = null;
    let bestTier = 5;
    for (const slot of unsolved) {
      const tier = getPairTier(s, slot);
      if (tier < bestTier) { bestTier = tier; bestSlot = slot; }
    }
    if (!bestSlot) break;

    const completed = result.map(r => r.label);
    let alg = normalizeAlg(solveSlotIntuitiveWithFallback(s, bestSlot, completed));
    if (!alg) {
      // Slot-restricted IDA*: U + slot's face only. ~3^12 = 530K nodes — trivially fast.
      const slotMoves = RIGHT_SLOTS.has(bestSlot) ? RIGHT_MOVES : LEFT_MOVES;
      const path: number[] = [];
      for (let depth = 1; depth <= SLOT_RESTRICTED_DEPTH && !alg; depth++) {
        if (idaDfs(s, depth, -1, path, bestSlot, completed, slotMoves)) alg = path.map(m => MOVE_NAMES[m]).join(' ');
        if (_cancelled) break;
      }
    }
    if (!alg) {
      // U+R+L fallback — rare positions where slot-face alone can't reach in SLOT_RESTRICTED_DEPTH.
      const path: number[] = [];
      for (let depth = 1; depth <= INTUITIVE_IDA_MAX_DEPTH && !alg; depth++) {
        if (idaDfs(s, depth, -1, path, bestSlot, completed, INTUITIVE_MOVES)) alg = path.map(m => MOVE_NAMES[m]).join(' ');
        if (_cancelled) break;
      }
    }
    if (!alg) {
      // Last resort: full F2L moves.
      const path: number[] = [];
      for (let depth = 1; depth <= F2L_IDA_MAX_DEPTH && !alg; depth++) {
        if (idaDfs(s, depth, -1, path, bestSlot, completed)) alg = path.map(m => MOVE_NAMES[m]).join(' ');
        if (_cancelled) break;
      }
    }
    if (alg) s = applyAlg(s, alg);
    result.push({ label: bestSlot, alg });
    unsolved.delete(bestSlot);

    // Re-check: re-add any previously solved slots that got disturbed.
    for (const r of result) {
      if (r.label !== bestSlot && r.alg !== '' && !unsolved.has(r.label) && !slotSolved(s, r.label)) {
        unsolved.add(r.label);
      }
    }
  }

  // Any slots remaining after the while loop: apply the same escalation.
  for (const slot of unsolved) {
    if (_cancelled) return result;
    const completed = result.map(r => r.label);
    let alg = solveSlotIntuitiveWithFallback(s, slot, completed);
    if (!alg) {
      const slotMoves = RIGHT_SLOTS.has(slot) ? RIGHT_MOVES : LEFT_MOVES;
      const path: number[] = [];
      for (let depth = 1; depth <= SLOT_RESTRICTED_DEPTH && !alg; depth++) {
        if (idaDfs(s, depth, -1, path, slot, completed, slotMoves)) alg = path.map(m => MOVE_NAMES[m]).join(' ');
        if (_cancelled) break;
      }
    }
    if (!alg) {
      const path: number[] = [];
      for (let depth = 1; depth <= INTUITIVE_IDA_MAX_DEPTH && !alg; depth++) {
        if (idaDfs(s, depth, -1, path, slot, completed, INTUITIVE_MOVES)) alg = path.map(m => MOVE_NAMES[m]).join(' ');
        if (_cancelled) break;
      }
    }
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
