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

let _cancelled = false;

// U + R + L + F — the beginner vocabulary (front-block faces). Used for the
// intuitive F2L search net. Excludes D/B/wide/slice.
const INTUITIVE_MOVES = [0,1,2, 6,7,8, 9,10,11, 12,13,14];

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

/** Coverage tag for one beginner F2L slot solve. `'search-fallback'` is the
 *  counted fall-through driven to zero (FR-007/SC-001); all others are encoded
 *  procedures. Back-slot solves report the underlying front procedure's method
 *  (the y-conjugation wrapper is not itself a method). */
export type BeginnerMethod =
  | 'already-solved'
  | 'easy-insert'
  | 'setup-insert'
  | 'extract-insert'
  | 'search-fallback';

export interface IntuitiveStage {
  label: string;          // slot label (unchanged)
  alg: string;            // emitted sequence (unchanged)
  method: BeginnerMethod; // coverage tag (additive — worker ignores it)
}

/** Longest move count any encoded beginner procedure can emit (SC-004 bound).
 *  Worst case is a back-slot solve: a front-slot 3-ply setup-insert — preAUF +
 *  three side/F setup conjugates + an easy insert, ≤13 after normalisation —
 *  wrapped in the `y2 … y2` rotation conjugate (+2) = 15. Measured exhaustively
 *  over the enumerated tier-2/3/4 domain (front max 13, back max 15). This is the
 *  maximum the taught procedures produce, NOT an efficiency target — the beginner
 *  method prefers the recognisable spelling over the shortest one (research
 *  Decision 2). The coverage counter asserts every emit is ≤ this. */
export const PROCEDURE_MAX = 15;

const AUF_ALGS = ['', 'U', 'U2', "U'"];

/** Canonical goal check used by the procedure layer: the target slot is solved,
 *  the cross is intact, and every previously-finished slot is undisturbed. Back
 *  slots are solved in the same (un-rotated) frame — see `conjugateBackSlot` — so
 *  no rotation-awareness is needed here. */
function goalReached(after: RawState, slot: string, mustSolve: string[]): boolean {
  if (!(slotSolved(after, slot) && crossOk(after))) return false;
  return mustSolve.every(m => slotSolved(after, m));
}

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

/** Which pair to solve and which trigger/face family to solve it with.
 *  For a front slot the pieces and triggers are the slot's own (identity).
 *  For a back slot solved by conjugation (`conjugateBackSlot`) the pieces are the
 *  back slot's own IDs but `triggerSlot` is the FRONT slot the cube has been
 *  rotated into — so the FR/FL trigger table, slot offsets and R/L face family are
 *  reused unchanged while still targeting the real back-slot pieces. */
interface PairTarget { cornerPiece: number; edgePiece: number; triggerSlot: string; }

function targetFor(slot: string): PairTarget {
  const d = SLOT_DEFS[slot];
  return { cornerPiece: d.cornerPiece, edgePiece: d.edgePiece, triggerSlot: slot };
}

/** Tier-1: both pieces in U-layer and directly insertable. Returns AUF + trigger alg.
 *  Matching is keyed to `target.triggerSlot`'s trigger set and slot offsets, but the
 *  pieces looked up are `target`'s own — so a back slot can borrow the front slot's
 *  trigger table in the rotated frame. */
function solveEasyInsert(state: RawState, target: PairTarget): string {
  const cIdx = state.cornerPieces.indexOf(target.cornerPiece);
  const eIdx = state.edgePieces.indexOf(target.edgePiece);
  if (cIdx >= 4 || eIdx >= 4) return '';

  const cOrient = state.cornerOrient[cIdx];
  const eOrient = state.edgeOrient[eIdx];
  for (const t of F2L_TRIGGERS) {
    if (t.target !== target.triggerSlot) continue;
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
// Includes the U2 conjugate ("edge across" in IntuitivePage Step 3) so a single
// hide→reposition→restore setup covers both next-to and across positions.
const R_SETUP_ALGS = ["R U' R'", "R U R'", "R U2 R'", "R' U R", "R' U' R", "R' U2 R"];
const L_SETUP_ALGS = ["L' U' L", "L' U L", "L' U2 L", "L U' L'", "L U L'", "L U2 L'"];

// Front-face (F) setup conjugates. The intuitive method uses an F turn to PAIR a
// corner and edge that the side face alone cannot join (the corner/edge sit on
// opposite sides of the working column), then restores. F is part of the beginner
// vocabulary for pair setups — confirmed — and is shared by both front slots.
const F_SETUP_ALGS = ["F' U' F", "F' U F", "F' U2 F", "F U F'", "F U' F'", "F U2 F'"];

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

function algLen(alg: string): number {
  return alg.trim() ? alg.trim().split(/\s+/).length : 0;
}

/** Tier-2: both in U-layer but no direct trigger. Encodes IntuitivePage Step 3:
 *  hide a piece (one setup conjugate), reposition, restore → easy insert.
 *  "White on side" needs one setup (next-to / across via U2); "white up" needs two
 *  composed conjugates. We search 1-ply first, then 2-ply, and return the SHORTEST
 *  round-tripping result so output always matches the logical flow rather than an
 *  arbitrary first hit. */
function solveSetupInsert(
  state: RawState, slot: string, mustSolve: string[] = [], setups = SETUP_ALGS,
  target: PairTarget = targetFor(slot),
  goal: (after: RawState) => boolean = (after) => goalReached(after, slot, mustSolve),
): string {
  let best = '';
  let bestLen = Infinity;
  const consider = (raw: string) => {
    const full = normalizeAlg(raw);
    const after = applyAlg(state, full);
    if (goal(after)) {
      const len = algLen(full);
      if (len < bestLen) { bestLen = len; best = full; }
    }
  };

  // 1-ply: preAuf + setup + insert (white-on-side: next-to or across).
  for (const preAuf of AUF_ALGS) {
    const s1 = preAuf ? applyAlg(state, preAuf) : state;
    for (const setup of setups) {
      const insert = solveEasyInsert(applyAlg(s1, setup), target);
      if (insert) consider([preAuf, setup, insert].filter(Boolean).join(' '));
    }
  }
  if (best) return best;

  // 2-ply: preAuf + setup1 + setup2 + insert (white-up: edge hidden then re-paired).
  for (const preAuf of AUF_ALGS) {
    const s1 = preAuf ? applyAlg(state, preAuf) : state;
    for (const setup1 of setups) {
      const sA = applyAlg(s1, setup1);
      for (const setup2 of setups) {
        const insert = solveEasyInsert(applyAlg(sA, setup2), target);
        if (insert) consider([preAuf, setup1, setup2, insert].filter(Boolean).join(' '));
      }
    }
  }
  if (best) return best;

  // 3-ply: preAuf + setup1 + setup2 + setup3 + insert. Covers the "white-up corner"
  // tier-2 awkward cases that a single re-pair cannot re-orient (e.g. corner twisted
  // so its white sticker faces up): hide, re-orient, re-pair, then insert.
  for (const preAuf of AUF_ALGS) {
    const s1 = preAuf ? applyAlg(state, preAuf) : state;
    for (const setup1 of setups) {
      const sA = applyAlg(s1, setup1);
      for (const setup2 of setups) {
        const sB = applyAlg(sA, setup2);
        for (const setup3 of setups) {
          const insert = solveEasyInsert(applyAlg(sB, setup3), target);
          if (insert) consider([preAuf, setup1, setup2, setup3, insert].filter(Boolean).join(' '));
        }
      }
    }
  }
  return best;
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

// Front-face extractions: an F turn pops a piece lodged in either FRONT slot
// (FR/FL) up to the top. Part of the beginner pairing vocabulary.
const F_EXTRACTIONS = ["F' U' F", "F' U F", "F' U2 F", "F U F'", "F U' F'", "F U2 F'"];

// 3-move-only subsets for the two-step extraction path.
const R_SHORT_EXTRACTIONS = ["R U R'", "R U' R'", "R U2 R'"];
const L_SHORT_EXTRACTIONS = ["L' U' L", "L' U L", "L' U2 L"];
const F_SHORT_EXTRACTIONS = ["F U F'", "F U' F'", "F' U' F", "F' U F"];

// Slot-restricted move sets for IDA*: U + the slot's side face + front face F.
// ⟨U, side⟩ alone cannot solve a slot keeping the cross (the DF/DB cross edges are
// never moved by U/R/L); the F turn is required for pairing/insertion. With F the
// front-block is complete and a single pair is always solvable in ≤8 moves.
const RIGHT_MOVES = [0, 1, 2,  6,  7,  8,  12, 13, 14];   // U + R + F
const LEFT_MOVES  = [0, 1, 2,  9, 10, 11,  12, 13, 14];   // U + L + F
// A single pair (incl. AUF) is solvable within the front-block in ≤8 moves, so the
// slot-restricted net never needs to search deeper. (Was 12 when the set was the
// 6-move U+side family; the 9-move U+side+F set makes deeper IDA* both unnecessary
// and expensive.)
const SLOT_RESTRICTED_DEPTH = 8;

function tryExtractAndInsert(
  state: RawState, slot: string, mustSolve: string[],
  prefix: string,
  setups = SETUP_ALGS,
  target: PairTarget = targetFor(slot),
  goal: (after: RawState) => boolean = (after) => goalReached(after, slot, mustSolve),
): string {
  const s = prefix ? applyAlg(state, prefix) : state;
  const easy = solveEasyInsert(s, target);
  if (easy) {
    const full = [prefix, easy].filter(Boolean).join(' ');
    if (goal(applyAlg(state, full))) return full;
  }
  const setup = solveSetupInsert(s, slot, mustSolve, setups, target, goal);
  if (setup) {
    const full = [prefix, setup].filter(Boolean).join(' ');
    if (goal(applyAlg(state, full))) return full;
  }
  return '';
}

// ── Procedure layer (primary emitter) ───────────────────────────────────────
// FR/FL are encoded completely; BR/BL inherit that coverage by conjugation
// (research Decision 1). A matched procedure is always returned as-is — the
// search layer (searchFallback) runs only on a procedure miss (FR-004).

/** Core procedure escalation, shared by front and back slots. Escalates
 *  easy → setup → extract using only U + the `target.triggerSlot` face (R for an
 *  FR-keyed target, L for an FL-keyed target). `goal(after)` decides success: it
 *  receives the working-frame state after a candidate and returns whether the real
 *  slot/cross/mustSolve hold (front: directly; back: after the closing rotation).
 *  Returns the first match tagged with its method, or `null` if nothing matches. */
function runProcedure(
  state: RawState, target: PairTarget, goal: (after: RawState) => boolean,
): { alg: string; method: BeginnerMethod } | null {
  if (goal(state)) return { alg: '', method: 'already-solved' };

  const isRight     = RIGHT_SLOTS.has(target.triggerSlot);
  const slot        = target.triggerSlot;
  // Setups draw from the slot's own side face AND the front face F (F pairs a
  // corner/edge the side face alone cannot join — the proven-necessary move).
  const sideSetups  = isRight ? R_SETUP_ALGS : L_SETUP_ALGS;
  const setups      = [...sideSetups, ...F_SETUP_ALGS];
  // A stuck piece can sit in any slot: R pops the FR/BR column, L pops FL/BL,
  // F pops the FR/FL front pair. Extraction prefixes draw from all three (still
  // U/R/L/F), own side-face first so the common shape is preferred.
  const ownExts     = isRight ? R_EXTRACTIONS : L_EXTRACTIONS;
  const otherExts   = isRight ? L_EXTRACTIONS : R_EXTRACTIONS;
  const extractions = [...ownExts, ...F_EXTRACTIONS, ...otherExts];
  const ownShort    = isRight ? R_SHORT_EXTRACTIONS : L_SHORT_EXTRACTIONS;
  const otherShort  = isRight ? L_SHORT_EXTRACTIONS : R_SHORT_EXTRACTIONS;
  const shortExts   = [...ownShort, ...F_SHORT_EXTRACTIONS, ...otherShort];

  // Tier 1 — easy insert (AUF + trigger). FR-003: the trigger's AUF keeps white
  // visible on a side face by construction (the trigger table only matches when
  // the corner's white sticker is side-facing).
  const easy = solveEasyInsert(state, target);
  if (easy) {
    const full = normalizeAlg(easy);
    if (goal(applyAlg(state, full))) return { alg: full, method: 'easy-insert' };
  }

  // Tier 2 — setup insert (1-ply white-on-side / 2-ply white-up, then easy insert).
  const setup = solveSetupInsert(state, slot, [], setups, target, goal);
  if (setup) return { alg: normalizeAlg(setup), method: 'setup-insert' };

  // Tier 3/4 — extract a stuck piece, then setup/easy insert. We keep the SHORTEST
  // round-tripping spelling (not the first hit): this is still a procedure, picked
  // among procedures — it is NOT the search-tightening of a matched procedure that
  // research Decision 2 forbids. Preferring the shortest extraction also keeps the
  // SC-004 length bound (PROCEDURE_MAX) tight and stable across positions.
  let bestExt = '';
  let bestLen = Infinity;
  const considerExt = (full: string) => {
    const norm = normalizeAlg(full);
    if (!goal(applyAlg(state, norm))) return;
    const len = algLen(norm);
    if (len < bestLen) { bestLen = len; bestExt = norm; }
  };
  for (const ext of extractions) {
    const alg = tryExtractAndInsert(state, slot, [], ext, setups, target, goal);
    if (alg) considerExt(alg);
  }
  for (const ext1 of shortExts) {
    const s1 = applyAlg(state, ext1);
    for (const ext2 of shortExts) {
      const alg = tryExtractAndInsert(s1, slot, [], ext2, setups, target, goal);
      if (alg) considerExt(`${ext1} ${alg}`);
    }
  }
  if (bestExt) return { alg: bestExt, method: 'extract-insert' };

  return null;
}

/** Front-slot procedure dispatch (FR/FL): the target is the slot's own pieces and
 *  the goal is validated directly in the canonical frame. */
function frontProcedure(
  state: RawState, slot: string, mustSolve: string[],
): { alg: string; method: BeginnerMethod } | null {
  return runProcedure(state, targetFor(slot), (after) => goalReached(after, slot, mustSolve));
}

/** Back-slot conjugation. A single `y`/`y'` cannot solve a back slot — it only
 *  swaps which back slot is in back (and `y` flips equatorial edge orientation),
 *  so no `y … y'` conjugate of an R/L-family procedure round-trips (verified
 *  empirically). A **half** turn does the job:
 *    BR → `y2 [FL-procedure] y2`   (`y2` sends BR to the FL working slot → L-family)
 *    BL → `y2 [FR-procedure] y2`   (`y2` sends BL to the FR working slot → R-family)
 *  Note the face SWAPS across the 180° turn (right-back is solved as left-front),
 *  and `y2` is its own inverse so the same token both leads and closes.
 *
 *  We rotate the cube by `y2`, run the standard front-slot escalation there — but
 *  the target is the BACK slot's own pieces matched against the OPPOSITE FRONT
 *  slot's trigger table/offsets, so the body comes out in U + that front face.
 *  `y2` does not flip edge orientation, so the front trigger table matches the
 *  relocated pieces directly. Validation happens in the ORIGINAL frame: the goal
 *  applies the closing `y2` and checks the real back slot, so `slotSolved`/
 *  `crossOk` (NOT rotation-invariant) are always evaluated un-rotated. The body is
 *  wrapped `y2 … y2`, keeping the emit beginner-clean (no B/wide/slice). The
 *  reported `method` is the underlying front procedure's — the rotation wrapper is
 *  not itself a method. Returns `null` if no procedure matches (→ searchFallback). */
function conjugateBackSlot(
  state: RawState, slot: string, mustSolve: string[],
): { alg: string; method: BeginnerMethod } | null {
  if (slotSolved(state, slot) && crossOk(state) && mustSolve.every(m => slotSolved(state, m))) {
    return { alg: '', method: 'already-solved' };
  }

  // y2 maps BR→FL (solve with L-family) and BL→FR (solve with R-family).
  const frontSlot = slot === 'f2l-br' ? 'f2l-fl' : 'f2l-fr';
  const d         = SLOT_DEFS[slot];
  const target: PairTarget = { cornerPiece: d.cornerPiece, edgePiece: d.edgePiece, triggerSlot: frontSlot };

  const sPrime = applyAlg(state, 'y2');
  // Goal validates the real (un-rotated) back slot: undo the lead via the closing y2.
  const proc = runProcedure(sPrime, target, (after) => goalReached(applyAlg(after, 'y2'), slot, mustSolve));
  if (!proc) return null;

  const full = normalizeAlg(`y2 ${proc.alg} y2`);
  // Defensive round-trip in the original frame (guards the relabel/normalise path).
  const after = applyAlg(state, full);
  if (slotSolved(after, slot) && crossOk(after) && mustSolve.every(m => slotSolved(after, m))) {
    return { alg: full, method: proc.method };
  }
  return null;
}

// ── Search layer (counted safety net) ────────────────────────────────────────

/** Demoted IDA* chain, run ONLY when no procedure matches (FR-004). Escalates
 *  slot-face (U + R/L) → U+R+L. Both tiers stay strictly in beginner vocabulary
 *  (no F/B/wide/slice), so even a fall-through never violates SC-003; every
 *  invocation is counted as a `'search-fallback'`. */
function searchFallback(state: RawState, slot: string, mustSolve: string[]): string {
  const slotMoves = RIGHT_SLOTS.has(slot) ? RIGHT_MOVES : LEFT_MOVES;
  const tiers: number[][] = [slotMoves, INTUITIVE_MOVES];
  const limits = [SLOT_RESTRICTED_DEPTH, INTUITIVE_IDA_MAX_DEPTH];
  for (let t = 0; t < tiers.length; t++) {
    for (let depth = 1; depth <= limits[t] && !_cancelled; depth++) {
      const path: number[] = [];
      if (idaDfs(state, depth, -1, path, slot, mustSolve, tiers[t])) {
        return path.map(m => MOVE_NAMES[m]).join(' ');
      }
    }
    if (_cancelled) break;
  }
  return '';
}

const BACK_SLOTS = new Set(['f2l-br', 'f2l-bl']);

/** Bounded counted search for a back slot that PRESERVES the recognisable
 *  `y2 … y2` shape (SC-005), used only when no encoded procedure covers the
 *  position within PROCEDURE_MAX. We search the y2-rotated frame in beginner
 *  vocabulary (the back slot's own pieces relocate to the opposite front slot)
 *  and validate each candidate in the ORIGINAL frame by applying the closing
 *  `y2` first — `slotSolved`/`crossOk` are NOT rotation-invariant, so the goal
 *  must be checked un-rotated. The body is wrapped `y2 … y2` and stays ≤ 8 plies,
 *  so the emit is ≤ 10 (well within PROCEDURE_MAX). Counted as `search-fallback`.
 *  Returns null only if no bounded conjugated solution exists (→ plain net). */
function backConjugateSearch(
  state: RawState, slot: string, mustSolve: string[],
): { alg: string; method: BeginnerMethod } | null {
  const frontSlot = slot === 'f2l-br' ? 'f2l-fl' : 'f2l-fr';
  const slotMoves = RIGHT_SLOTS.has(frontSlot) ? RIGHT_MOVES : LEFT_MOVES;
  const sPrime = applyAlg(state, 'y2');
  const reaches = (sp: RawState): boolean => {
    const orig = applyAlg(sp, 'y2'); // close the conjugate, validate un-rotated
    return slotSolved(orig, slot) && crossOk(orig) && mustSolve.every(m => slotSolved(orig, m));
  };
  const dfs = (sp: RawState, budget: number, last: number, path: number[], mv: number[]): boolean => {
    if (_cancelled) return false;
    if (reaches(sp)) return true;
    if (budget === 0) return false;
    for (const m of mv) {
      if (pruned(m, last)) continue;
      path.push(m);
      if (dfs(applyMove(sp, m), budget - 1, m, path, mv)) return true;
      path.pop();
    }
    return false;
  };
  for (const mv of [slotMoves, INTUITIVE_MOVES]) {
    for (let depth = 1; depth <= INTUITIVE_IDA_MAX_DEPTH && !_cancelled; depth++) {
      const path: number[] = [];
      if (dfs(sPrime, depth, -1, path, mv)) {
        return { alg: normalizeAlg(`y2 ${path.map(m => MOVE_NAMES[m]).join(' ')} y2`), method: 'search-fallback' };
      }
    }
  }
  return null;
}

// ── FR-centric solve (the y-rotation working-slot model) ─────────────────────

/** Slot → front-right rotation conjugate. `y` cycles FR→FL→BL→BR, so the listed
 *  `lead` rotation brings each slot's pair into the front-right working slot and
 *  `close` undoes it. FL/BR use a quarter turn (which flips equatorial edge
 *  orientation — handled by structural verification, not table matching); BL uses
 *  the self-inverse `y2`. "Lots of y turns" is the expected beginner shape. */
const SLOT_ROTATION: Record<string, { lead: string; close: string }> = {
  'f2l-fr': { lead: '',   close: ''   },
  'f2l-fl': { lead: "y'", close: 'y'  },
  'f2l-bl': { lead: 'y2', close: 'y2' },
  'f2l-br': { lead: 'y',  close: "y'" },
};

/** Slot → front-LEFT rotation conjugate (the mirror of `SLOT_ROTATION`). Brings a
 *  slot's pair into the front-left working slot, where it is solved with L-family
 *  triggers (the L face touches BL, the slot used to hide the edge). */
const SLOT_ROTATION_FL: Record<string, { lead: string; close: string }> = {
  'f2l-fr': { lead: 'y',  close: "y'" },
  'f2l-fl': { lead: '',   close: ''   },
  'f2l-bl': { lead: "y'", close: 'y'  },
  'f2l-br': { lead: 'y2', close: 'y2' },
};

/** Canonical front-slot inserts — clean side-hand triggers (the taught shapes). AUF
 *  is enumerated separately, so these three + AUF cover the connected, disconnected
 *  and U2 cases. R-family at the FR working slot, L-family at FL. */
const FR_TRIGGERS = ["R U R'", "R U' R'", "R U2 R'"];
const FL_TRIGGERS = ["L' U' L", "L' U L", "L' U2 L"];

/** A front working slot the target can be rotated into: the rotation conjugate plus
 *  the side-face move sets used there. The beginner solves each pair from EITHER the
 *  front-right (R-family, hide via BR) or front-left (L-family, hide via BL) working
 *  slot — whichever the edge's colours suit — so both are tried and the cleaner
 *  (shortest round-tripping) shape wins. */
interface WorkSlot {
  lead: string; close: string;
  triggers: string[]; sideSetups: string[]; setups: string[];
  extracts: string[]; shortExt: string[];
}

function frontWorkSlots(slot: string): WorkSlot[] {
  const fr = SLOT_ROTATION[slot], fl = SLOT_ROTATION_FL[slot];
  return [
    { ...fr, triggers: FR_TRIGGERS, sideSetups: R_SETUP_ALGS,
      setups: [...R_SETUP_ALGS, ...F_SETUP_ALGS],
      extracts: [...R_EXTRACTIONS, ...F_EXTRACTIONS],
      shortExt: [...R_SHORT_EXTRACTIONS, ...F_SHORT_EXTRACTIONS] },
    { ...fl, triggers: FL_TRIGGERS, sideSetups: L_SETUP_ALGS,
      setups: [...L_SETUP_ALGS, ...F_SETUP_ALGS],
      extracts: [...L_EXTRACTIONS, ...F_EXTRACTIONS],
      shortExt: [...L_SHORT_EXTRACTIONS, ...F_SHORT_EXTRACTIONS] },
  ];
}

/** A shortest-round-tripping accumulator over candidate bodies wrapped in a working
 *  slot's rotation conjugate. Each candidate is APPLIED and VERIFIED against the real
 *  slot in the original frame (so it is robust to the quarter-y edge-orientation flip
 *  that breaks trigger-table matching), length-pruned against the current best and
 *  PROCEDURE_MAX. `flush(method)` returns the shortest hit so far and resets. */
function shortestSolve(state: RawState, slot: string, mustSolve: string[]) {
  let best = ''; let bestLen = Infinity;
  return {
    consider(cfg: WorkSlot, body: string) {
      const full = normalizeAlg(cfg.lead ? `${cfg.lead} ${body} ${cfg.close}` : body);
      const len = algLen(full);
      if (len >= bestLen || len > PROCEDURE_MAX) return;
      const after = applyAlg(state, full);
      if (slotSolved(after, slot) && crossOk(after) && mustSolve.every(m => slotSolved(after, m))) {
        bestLen = len; best = full;
      }
    },
    flush(method: BeginnerMethod): { alg: string; method: BeginnerMethod } | null {
      if (!best) return null;
      const r = { alg: best, method }; best = ''; bestLen = Infinity; return r;
    },
  };
}

/** True iff the slot's corner is in the U-layer with its white sticker facing UP
 *  (cornerOrient 0) — the white-up case. Verified empirically: a D-layer corner in a
 *  U-slot is white-up exactly when cornerOrient === 0 (orient 1/2 = white on a side,
 *  directly insertable). */
function isWhiteUpCorner(state: RawState, slot: string): boolean {
  const def = SLOT_DEFS[slot];
  const cIdx = state.cornerPieces.indexOf(def.cornerPiece);
  return cIdx < 4 && state.cornerOrient[cIdx] === 0;
}

/** White-up corner — a DISTINCT procedure with its own move logic. The corner sits
 *  in the U-layer with white facing up; you read the EDGE's colours: if its side
 *  sticker matches the RIGHT centre (other colour to front) the pair is solved at the
 *  front-RIGHT working slot, hiding the edge via BR (R-family); if it matches the LEFT
 *  centre, at the front-LEFT, hiding via BL (L-family) — roughly 50:50. The taught
 *  shape is `AUF · hide(side conjugate) · AUF · insert(side trigger)` (set the edge,
 *  hide it to the back, bring the corner over, re-pair, insert) using ONLY the side
 *  family (never F). We try both working slots and keep the shortest round-tripping
 *  shape — which self-selects the colour-correct side, since only that side hides and
 *  restores cleanly. Returns null if the corner is not white-up or no template fits
 *  (e.g. the edge is stuck → handled by `solveFromFront`). */
function solveWhiteUp(
  state: RawState, slot: string, mustSolve: string[],
): { alg: string; method: BeginnerMethod } | null {
  if (!isWhiteUpCorner(state, slot)) return null;
  const acc = shortestSolve(state, slot, mustSolve);
  const cfgs = frontWorkSlots(slot);

  // Set edge · hide to back (one side conjugate) · bring corner over · insert.
  for (const cfg of cfgs)
    for (const a of AUF_ALGS) for (const su of cfg.sideSetups) for (const b of AUF_ALGS) for (const ins of cfg.triggers)
      acc.consider(cfg, [a, su, b, ins].filter(Boolean).join(' '));
  let r = acc.flush('setup-insert'); if (r) return r;

  // Awkward white-up that one hide cannot re-orient: two side conjugates, then insert.
  for (const cfg of cfgs)
    for (const a of AUF_ALGS) for (const s1 of cfg.sideSetups) for (const s2 of cfg.sideSetups) for (const ins of cfg.triggers)
      acc.consider(cfg, [a, s1, s2, ins].filter(Boolean).join(' '));
  r = acc.flush('setup-insert'); if (r) return r;

  return null;
}

/** Solve a slot from a front working slot — the core beginner model for everything
 *  that is NOT a white-up corner (`solveWhiteUp`) or a trivial in-place easy insert:
 *  white-on-side pairs that need a setup, and stuck pieces that need extracting. The
 *  pair is rotated into the front-right (R-family) OR front-left (L-family) working
 *  slot — whichever the edge's colours suit — worked there with clean side (+F to
 *  hide/extract) triggers, then the rotation is closed. "Lots of y turns" is the
 *  expected beginner shape; an FR-target solves in place, an FL/back slot rotates in.
 *
 *  Both working slots are tried at every tier and the SHORTEST round-tripping shape
 *  wins (clean spelling, ≤PROCEDURE_MAX). Escalates easy → 1/2 setups → extract
 *  (+setup) → two-step extract. Returns null on a miss (→ conjugate procedure / net). */
function solveFromFront(
  state: RawState, slot: string, mustSolve: string[],
): { alg: string; method: BeginnerMethod } | null {
  const acc = shortestSolve(state, slot, mustSolve);
  const cfgs = frontWorkSlots(slot);

  // Tier easy — AUF + clean trigger (connected/insertable pair brought to front).
  for (const cfg of cfgs)
    for (const a of AUF_ALGS) for (const ins of cfg.triggers)
      acc.consider(cfg, [a, ins].filter(Boolean).join(' '));
  let r = acc.flush('easy-insert'); if (r) return r;

  // Tier setup ×1 — the hide-to-back staging (side family only): set the edge, hide
  // it via the back slot (one side conjugate), bring the other piece over (mid-AUF),
  // then insert. This is the same taught shape as the white-up case, for a corner
  // whose white faces a side. F is reserved for genuine stuck-piece extraction below.
  for (const cfg of cfgs)
    for (const a of AUF_ALGS) for (const su of cfg.sideSetups) for (const b of AUF_ALGS) for (const ins of cfg.triggers)
      acc.consider(cfg, [a, su, b, ins].filter(Boolean).join(' '));
  r = acc.flush('setup-insert'); if (r) return r;

  // Tier setup ×2 — stage twice (side family) for an awkward pair.
  for (const cfg of cfgs)
    for (const a of AUF_ALGS) for (const s1 of cfg.sideSetups) for (const s2 of cfg.sideSetups) for (const ins of cfg.triggers)
      acc.consider(cfg, [a, s1, s2, ins].filter(Boolean).join(' '));
  r = acc.flush('setup-insert'); if (r) return r;

  // Tier extract — pop the stuck piece (top-layer piece turned aside), re-pair, insert.
  for (const cfg of cfgs)
    for (const ex of cfg.extracts) for (const a of AUF_ALGS) for (const ins of cfg.triggers)
      acc.consider(cfg, [ex, a, ins].filter(Boolean).join(' '));
  for (const cfg of cfgs)
    for (const ex of cfg.extracts) for (const a of AUF_ALGS) for (const su of cfg.setups) for (const ins of cfg.triggers)
      acc.consider(cfg, [ex, a, su, ins].filter(Boolean).join(' '));
  r = acc.flush('extract-insert'); if (r) return r;

  // Tier extract ×2 — two short extractions for a doubly-stuck pair.
  for (const cfg of cfgs)
    for (const e1 of cfg.shortExt) for (const e2 of cfg.shortExt) for (const a of AUF_ALGS) for (const ins of cfg.triggers)
      acc.consider(cfg, [e1, e2, a, ins].filter(Boolean).join(' '));
  r = acc.flush('extract-insert'); if (r) return r;

  return null;
}

/** Solve one F2L slot in beginner mode. Dispatch mirrors the taught recognition:
 *    1. Easy insert — a connected pair, white on a side, dropping straight into its
 *       own front slot with one clean trigger (no rotation).
 *    2. White-up corner — a DISTINCT procedure (`solveWhiteUp`): read the edge's
 *       colours, hide it to the back via BR/BL, bring the corner over, re-pair,
 *       insert (side family only; FR or FL working slot, ~50:50 by colour).
 *    3. Everything else (`solveFromFront`) — white-on-side setups and stuck pieces,
 *       rotated into the FR (R-family) or FL (L-family) working slot.
 *  The conjugate procedure and the counted search net remain as fallbacks for any
 *  miss. A solve over PROCEDURE_MAX (SC-004) is rejected like a miss; back slots keep
 *  the recognisable rotation conjugate via `backConjugateSearch` (SC-005). */
function solveOneSlot(
  state: RawState, slot: string, completed: string[],
): { alg: string; method: BeginnerMethod } {
  const isBack = BACK_SLOTS.has(slot);
  if (goalReached(state, slot, completed)) return { alg: '', method: 'already-solved' };

  // 1. Easy insert in place (front slots only — back slots always rotate in).
  if (!isBack) {
    const easy = solveEasyInsert(state, targetFor(slot));
    if (easy) {
      const full = normalizeAlg(easy);
      if (goalReached(applyAlg(state, full), slot, completed)) {
        return { alg: full, method: 'easy-insert' };
      }
    }
  }

  // 2. White-up corner — its own hide-to-back / corner-over / re-pair / insert logic.
  const wu = solveWhiteUp(state, slot, completed);
  if (wu && algLen(wu.alg) <= PROCEDURE_MAX) return wu;

  // 3. White-on-side setup / stuck extraction, from the FR or FL working slot.
  const front = solveFromFront(state, slot, completed);
  if (front && algLen(front.alg) <= PROCEDURE_MAX) return front;

  // 3b. Conjugate procedure — coverage for any miss above.
  const proc = isBack
    ? conjugateBackSlot(state, slot, completed)
    : frontProcedure(state, slot, completed);
  if (proc && algLen(proc.alg) <= PROCEDURE_MAX) return proc;

  // 4. Counted search net (back slots keep the y2 conjugate shape).
  if (isBack) {
    const wrapped = backConjugateSearch(state, slot, completed);
    if (wrapped) return wrapped;
  }
  return { alg: normalizeAlg(searchFallback(state, slot, completed)), method: 'search-fallback' };
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

/** Solve all four F2L slots in fluid priority order (easiest tier first).
 *
 *  Fluid priority solves whichever slot is easiest first (tier-1 easy inserts
 *  immediately, then tier-2, etc.). This matches the physical beginner approach:
 *  opportunistically solve connected pairs in the top layer before dealing with
 *  stuck pieces.
 *
 *  Each slot is solved by an encoded procedure (`frontProcedure` for FR/FL,
 *  `conjugateBackSlot` for BR/BL); the counted `searchFallback` runs only when no
 *  procedure matches (FR-004). Every stage carries a `method` tag so the
 *  fall-through counter (FR-007/SC-001) can measure procedure-vs-search coverage. */
export function solveF2lIntuitive(state: RawState): IntuitiveStage[] {
  _cancelled = false;
  const ALL_SLOTS = ['f2l-fr', 'f2l-fl', 'f2l-br', 'f2l-bl'];
  const result: IntuitiveStage[] = [];
  const unsolved = new Set(ALL_SLOTS);

  let s = state;
  let maxIter = 20;

  while (unsolved.size > 0 && maxIter-- > 0) {
    if (_cancelled) return [];

    // Mark slots that are already solved
    for (const slot of [...unsolved]) {
      if (slotSolved(s, slot) && crossOk(s)) {
        result.push({ label: slot, alg: '', method: 'already-solved' });
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
    const { alg, method } = solveOneSlot(s, bestSlot, completed);
    if (alg) s = applyAlg(s, alg);
    result.push({ label: bestSlot, alg, method });
    unsolved.delete(bestSlot);

    // Re-check: re-add any previously solved slots that got disturbed.
    for (const r of result) {
      if (r.label !== bestSlot && r.alg !== '' && !unsolved.has(r.label) && !slotSolved(s, r.label)) {
        unsolved.add(r.label);
      }
    }
  }

  // Any slots remaining after the while loop: apply the same dispatch.
  for (const slot of unsolved) {
    if (_cancelled) return result;
    const completed = result.map(r => r.label);
    const { alg, method } = solveOneSlot(s, slot, completed);
    if (alg) s = applyAlg(s, alg);
    result.push({ label: slot, alg, method });
  }

  return result;
}
