/**
 * Hardcoded 3×3 move permutation tables for the CFOP solver.
 * Derived from cubing.js KPattern and verified against verify-perms.mjs.
 *
 * Move index mapping:
 *   0=U  1=U' 2=U2   3=D  4=D' 5=D2
 *   6=R  7=R' 8=R2   9=L 10=L' 11=L2
 *  12=F 13=F' 14=F2 15=B 16=B' 17=B2
 *  18=z2
 *  19=M  20=M' 21=M2  22=S  23=S'  24=E  25=E'
 *  26=r  27=r' 28=r2  29=l  30=l'
 *  31=f(wide) 32=f'(wide)  33=u  34=u'
 *  35=x  36=x' 37=x2  38=y  39=y'  40=z  41=z'
 *
 * Semantics: to apply move M to a state,
 *   newPieces[slot] = oldPieces[CORNER_PIECES[M][slot]]
 *   newOrient[slot] = (oldOrient[CORNER_PIECES[M][slot]] + CORNER_ORIENT[M][slot]) % 3
 * (same for edges, % 2)
 */

export interface RawState {
  cornerPieces: number[];   // [8]
  cornerOrient: number[];   // [8]
  edgePieces:   number[];   // [12]
  edgeOrient:   number[];   // [12]
}

export const MOVE_NAMES = [
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'R', "R'", 'R2',
  'L', "L'", 'L2',
  'F', "F'", 'F2',
  'B', "B'", 'B2',
] as const;

export const N_MOVES = 18;

/** All 15 non-D face moves for F2L search (D/D'/D2 excluded). */
export const F2L_MOVES = [0,1,2, 6,7,8, 9,10,11, 12,13,14, 15,16,17];

// ── Hardcoded permutation tables ──────────────────────────────────────────────

export const CORNER_PIECES: ReadonlyArray<ReadonlyArray<number>> = [
  [1,2,3,0,4,5,6,7],   // U
  [3,0,1,2,4,5,6,7],   // U'
  [2,3,0,1,4,5,6,7],   // U2
  [0,1,2,3,5,6,7,4],   // D
  [0,1,2,3,7,4,5,6],   // D'
  [0,1,2,3,6,7,4,5],   // D2
  [4,0,2,3,7,5,6,1],   // R
  [1,7,2,3,0,5,6,4],   // R'
  [7,4,2,3,1,5,6,0],   // R2
  [0,1,6,2,4,3,5,7],   // L
  [0,1,3,5,4,6,2,7],   // L'
  [0,1,5,6,4,2,3,7],   // L2
  [3,1,2,5,0,4,6,7],   // F
  [4,1,2,0,5,3,6,7],   // F'
  [5,1,2,4,3,0,6,7],   // F2
  [0,7,1,3,4,5,2,6],   // B
  [0,2,6,3,4,5,7,1],   // B'
  [0,6,7,3,4,5,1,2],   // B2
  [5,6,7,4,3,0,1,2],   // z2
  // Wide/slice/rotation moves (indices 19-41):
  [0,1,2,3,4,5,6,7],   // M  (19)
  [0,1,2,3,4,5,6,7],   // M' (20)
  [0,1,2,3,4,5,6,7],   // M2 (21)
  [0,1,2,3,4,5,6,7],   // S  (22)
  [0,1,2,3,4,5,6,7],   // S' (23)
  [0,1,2,3,4,5,6,7],   // E  (24)
  [0,1,2,3,4,5,6,7],   // E' (25)
  [4,0,2,3,7,5,6,1],   // r  (26)
  [1,7,2,3,0,5,6,4],   // r' (27)
  [7,4,2,3,1,5,6,0],   // r2 (28)
  [0,1,6,2,4,3,5,7],   // l  (29)
  [0,1,3,5,4,6,2,7],   // l' (30)
  [3,1,2,5,0,4,6,7],   // f(wide) (31)
  [4,1,2,0,5,3,6,7],   // f'(wide)(32)
  [1,2,3,0,4,5,6,7],   // u  (33)
  [3,0,1,2,4,5,6,7],   // u' (34)
  [4,0,3,5,7,6,2,1],   // x  (35)
  [1,7,6,2,0,3,5,4],   // x' (36)
  [7,4,5,6,1,2,3,0],   // x2 (37)
  [1,2,3,0,7,4,5,6],   // y  (38)
  [3,0,1,2,5,6,7,4],   // y' (39)
  [3,2,6,5,0,4,7,1],   // z  (40)
  [4,7,1,0,5,3,2,6],   // z' (41)
];

export const CORNER_ORIENT: ReadonlyArray<ReadonlyArray<number>> = [
  [0,0,0,0,0,0,0,0],   // U
  [0,0,0,0,0,0,0,0],   // U'
  [0,0,0,0,0,0,0,0],   // U2
  [0,0,0,0,0,0,0,0],   // D
  [0,0,0,0,0,0,0,0],   // D'
  [0,0,0,0,0,0,0,0],   // D2
  [2,1,0,0,1,0,0,2],   // R
  [2,1,0,0,1,0,0,2],   // R'
  [0,0,0,0,0,0,0,0],   // R2
  [0,0,2,1,0,2,1,0],   // L
  [0,0,2,1,0,2,1,0],   // L'
  [0,0,0,0,0,0,0,0],   // L2
  [1,0,0,2,2,1,0,0],   // F
  [1,0,0,2,2,1,0,0],   // F'
  [0,0,0,0,0,0,0,0],   // F2
  [0,2,1,0,0,0,2,1],   // B
  [0,2,1,0,0,0,2,1],   // B'
  [0,0,0,0,0,0,0,0],   // B2
  [0,0,0,0,0,0,0,0],   // z2
  // Wide/slice/rotation moves (indices 19-41):
  [0,0,0,0,0,0,0,0],   // M  (19)
  [0,0,0,0,0,0,0,0],   // M' (20)
  [0,0,0,0,0,0,0,0],   // M2 (21)
  [0,0,0,0,0,0,0,0],   // S  (22)
  [0,0,0,0,0,0,0,0],   // S' (23)
  [0,0,0,0,0,0,0,0],   // E  (24)
  [0,0,0,0,0,0,0,0],   // E' (25)
  [2,1,0,0,1,0,0,2],   // r  (26)
  [2,1,0,0,1,0,0,2],   // r' (27)
  [0,0,0,0,0,0,0,0],   // r2 (28)
  [0,0,2,1,0,2,1,0],   // l  (29)
  [0,0,2,1,0,2,1,0],   // l' (30)
  [1,0,0,2,2,1,0,0],   // f(wide) (31)
  [1,0,0,2,2,1,0,0],   // f'(wide)(32)
  [0,0,0,0,0,0,0,0],   // u  (33)
  [0,0,0,0,0,0,0,0],   // u' (34)
  [2,1,2,1,1,2,1,2],   // x  (35)
  [2,1,2,1,1,2,1,2],   // x' (36)
  [0,0,0,0,0,0,0,0],   // x2 (37)
  [0,0,0,0,0,0,0,0],   // y  (38)
  [0,0,0,0,0,0,0,0],   // y' (39)
  [1,2,1,2,2,1,2,1],   // z  (40)
  [1,2,1,2,2,1,2,1],   // z' (41)
];

export const EDGE_PIECES: ReadonlyArray<ReadonlyArray<number>> = [
  [1,2,3,0,4,5,6,7,8,9,10,11],    // U
  [3,0,1,2,4,5,6,7,8,9,10,11],    // U'
  [2,3,0,1,4,5,6,7,8,9,10,11],    // U2
  [0,1,2,3,7,4,5,6,8,9,10,11],    // D
  [0,1,2,3,5,6,7,4,8,9,10,11],    // D'
  [0,1,2,3,6,7,4,5,8,9,10,11],    // D2
  [0,8,2,3,4,10,6,7,5,9,1,11],    // R
  [0,10,2,3,4,8,6,7,1,9,5,11],    // R'
  [0,5,2,3,4,1,6,7,10,9,8,11],    // R2
  [0,1,2,11,4,5,6,9,8,3,10,7],    // L
  [0,1,2,9,4,5,6,11,8,7,10,3],    // L'
  [0,1,2,7,4,5,6,3,8,11,10,9],    // L2
  [9,1,2,3,8,5,6,7,0,4,10,11],    // F
  [8,1,2,3,9,5,6,7,4,0,10,11],    // F'
  [4,1,2,3,0,5,6,7,9,8,10,11],    // F2
  [0,1,10,3,4,5,11,7,8,9,6,2],    // B
  [0,1,11,3,4,5,10,7,8,9,2,6],    // B'
  [0,1,6,3,4,5,2,7,8,9,11,10],    // B2
  [4,7,6,5,0,3,2,1,9,8,11,10],    // z2
  // Wide/slice/rotation moves (indices 19-41):
  [2,1,6,3,0,5,4,7,8,9,10,11],   // M  (19)
  [4,1,0,3,6,5,2,7,8,9,10,11],   // M' (20)
  [6,1,4,3,2,5,0,7,8,9,10,11],   // M2 (21)
  [0,3,2,7,4,1,6,5,8,9,10,11],   // S  (22)
  [0,5,2,1,4,7,6,3,8,9,10,11],   // S' (23)
  [0,1,2,3,4,5,6,7,9,11,8,10],   // E  (24)
  [0,1,2,3,4,5,6,7,10,8,11,9],   // E' (25)
  [4,8,0,3,6,10,2,7,5,9,1,11],   // r  (26)
  [2,10,6,3,0,8,4,7,1,9,5,11],   // r' (27)
  [6,5,4,3,2,1,0,7,10,9,8,11],   // r2 (28)
  [2,1,6,11,0,5,4,9,8,3,10,7],   // l  (29)
  [4,1,0,9,6,5,2,11,8,7,10,3],   // l' (30)
  [9,3,2,7,8,1,6,5,0,4,10,11],   // f(wide) (31)
  [8,5,2,1,9,7,6,3,4,0,10,11],   // f'(wide)(32)
  [1,2,3,0,4,5,6,7,10,8,11,9],   // u  (33)
  [3,0,1,2,4,5,6,7,9,11,8,10],   // u' (34)
  [4,8,0,9,6,10,2,11,5,7,1,3],   // x  (35)
  [2,10,6,11,0,8,4,9,1,3,5,7],   // x' (36)
  [6,5,4,7,2,1,0,3,10,11,8,9],   // x2 (37)
  [1,2,3,0,5,6,7,4,10,8,11,9],   // y  (38)
  [3,0,1,2,7,4,5,6,9,11,8,10],   // y' (39)
  [9,3,11,7,8,1,10,5,0,4,2,6],   // z  (40)
  [8,5,10,1,9,7,11,3,4,0,6,2],   // z' (41)
];

export const EDGE_ORIENT: ReadonlyArray<ReadonlyArray<number>> = [
  [0,0,0,0,0,0,0,0,0,0,0,0],   // U
  [0,0,0,0,0,0,0,0,0,0,0,0],   // U'
  [0,0,0,0,0,0,0,0,0,0,0,0],   // U2
  [0,0,0,0,0,0,0,0,0,0,0,0],   // D
  [0,0,0,0,0,0,0,0,0,0,0,0],   // D'
  [0,0,0,0,0,0,0,0,0,0,0,0],   // D2
  [0,0,0,0,0,0,0,0,0,0,0,0],   // R
  [0,0,0,0,0,0,0,0,0,0,0,0],   // R'
  [0,0,0,0,0,0,0,0,0,0,0,0],   // R2
  [0,0,0,0,0,0,0,0,0,0,0,0],   // L
  [0,0,0,0,0,0,0,0,0,0,0,0],   // L'
  [0,0,0,0,0,0,0,0,0,0,0,0],   // L2
  [1,0,0,0,1,0,0,0,1,1,0,0],   // F
  [1,0,0,0,1,0,0,0,1,1,0,0],   // F'
  [0,0,0,0,0,0,0,0,0,0,0,0],   // F2
  [0,0,1,0,0,0,1,0,0,0,1,1],   // B
  [0,0,1,0,0,0,1,0,0,0,1,1],   // B'
  [0,0,0,0,0,0,0,0,0,0,0,0],   // B2
  [0,0,0,0,0,0,0,0,0,0,0,0],   // z2
  // Wide/slice/rotation moves (indices 19-41):
  [1,0,1,0,1,0,1,0,0,0,0,0],   // M  (19)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // M' (20)
  [0,0,0,0,0,0,0,0,0,0,0,0],   // M2 (21)
  [0,1,0,1,0,1,0,1,0,0,0,0],   // S  (22)
  [0,1,0,1,0,1,0,1,0,0,0,0],   // S' (23)
  [0,0,0,0,0,0,0,0,1,1,1,1],   // E  (24)
  [0,0,0,0,0,0,0,0,1,1,1,1],   // E' (25)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // r  (26)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // r' (27)
  [0,0,0,0,0,0,0,0,0,0,0,0],   // r2 (28)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // l  (29)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // l' (30)
  [1,1,0,1,1,1,0,1,1,1,0,0],   // f(wide) (31)
  [1,1,0,1,1,1,0,1,1,1,0,0],   // f'(wide)(32)
  [0,0,0,0,0,0,0,0,1,1,1,1],   // u  (33)
  [0,0,0,0,0,0,0,0,1,1,1,1],   // u' (34)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // x  (35)
  [1,0,1,0,1,0,1,0,0,0,0,0],   // x' (36)
  [0,0,0,0,0,0,0,0,0,0,0,0],   // x2 (37)
  [0,0,0,0,0,0,0,0,1,1,1,1],   // y  (38)
  [0,0,0,0,0,0,0,0,1,1,1,1],   // y' (39)
  [1,1,1,1,1,1,1,1,1,1,1,1],   // z  (40)
  [1,1,1,1,1,1,1,1,1,1,1,1],   // z' (41)
];

// ── Move token → index lookup ─────────────────────────────────────────────────

const MOVE_INDEX: Record<string, number> = {};
for (let i = 0; i < MOVE_NAMES.length; i++) MOVE_INDEX[MOVE_NAMES[i]] = i;
MOVE_INDEX['z2'] = 18;
// X2' is non-standard but appears in some alg databases; treat as X2 (180° is its own inverse)
MOVE_INDEX["r2'"] = 28;
MOVE_INDEX["R2'"] = 8; MOVE_INDEX["L2'"] = 11; MOVE_INDEX["U2'"] = 2;
MOVE_INDEX["D2'"] = 5; MOVE_INDEX["F2'"] = 14; MOVE_INDEX["B2'"] = 17;
MOVE_INDEX['M']  = 19; MOVE_INDEX["M'"] = 20; MOVE_INDEX['M2'] = 21;
MOVE_INDEX['S']  = 22; MOVE_INDEX["S'"] = 23;
MOVE_INDEX['E']  = 24; MOVE_INDEX["E'"] = 25;
MOVE_INDEX['r']  = 26; MOVE_INDEX["r'"] = 27; MOVE_INDEX['r2'] = 28;
MOVE_INDEX['l']  = 29; MOVE_INDEX["l'"] = 30;
MOVE_INDEX['f']  = 31; MOVE_INDEX["f'"] = 32;
MOVE_INDEX['u']  = 33; MOVE_INDEX["u'"] = 34;
MOVE_INDEX['x']  = 35; MOVE_INDEX["x'"] = 36; MOVE_INDEX['x2'] = 37;
MOVE_INDEX['y']  = 38; MOVE_INDEX["y'"] = 39;
MOVE_INDEX['z']  = 40; MOVE_INDEX["z'"] = 41;

/** Convert a WCA notation string to an array of move indices. Strips parentheses. */
export function algToMoveIndices(alg: string): number[] {
  if (!alg || !alg.trim()) return [];
  const tokens = alg.replace(/[()[\]]/g, '').trim().split(/\s+/).filter(Boolean);
  return tokens.map(t => {
    const idx = MOVE_INDEX[t];
    if (idx === undefined) throw new Error(`Unknown move token: ${t}`);
    return idx;
  });
}

// ── State application ─────────────────────────────────────────────────────────

/** Apply a single move (by index) to a RawState, returning a new RawState. */
export function applyMove(state: RawState, moveIdx: number): RawState {
  const cp = CORNER_PIECES[moveIdx];
  const co = CORNER_ORIENT[moveIdx];
  const ep = EDGE_PIECES[moveIdx];
  const eo = EDGE_ORIENT[moveIdx];
  const newCP = new Array<number>(8);
  const newCO = new Array<number>(8);
  const newEP = new Array<number>(12);
  const newEO = new Array<number>(12);
  for (let i = 0; i < 8; i++) {
    newCP[i] = state.cornerPieces[cp[i]];
    newCO[i] = (state.cornerOrient[cp[i]] + co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    newEP[i] = state.edgePieces[ep[i]];
    newEO[i] = (state.edgeOrient[ep[i]] + eo[i]) % 2;
  }
  return { cornerPieces: newCP, cornerOrient: newCO, edgePieces: newEP, edgeOrient: newEO };
}

/** Apply a sequence of move indices to a RawState. */
export function applyMoveSeq(state: RawState, moves: number[]): RawState {
  let s = state;
  for (const m of moves) s = applyMove(s, m);
  return s;
}

/** Apply a WCA alg string (strips parens) to a RawState. */
export function applyAlg(state: RawState, alg: string): RawState {
  return applyMoveSeq(state, algToMoveIndices(alg));
}

/** The fully solved RawState (identity permutation, all orientations 0). */
export function solvedState(): RawState {
  return {
    cornerPieces: [0,1,2,3,4,5,6,7],
    cornerOrient: [0,0,0,0,0,0,0,0],
    edgePieces:   [0,1,2,3,4,5,6,7,8,9,10,11],
    edgeOrient:   [0,0,0,0,0,0,0,0,0,0,0,0],
  };
}

/**
 * Deserialise a patternStr from JSON.stringify(kPattern.patternData) into a RawState.
 * Adapts cubing.js CORNERS/EDGES orbit naming.
 */
export function toRawState(patternData: {
  CORNERS: { pieces: number[]; orientation: number[] };
  EDGES: { pieces: number[]; orientation: number[] };
}): RawState {
  return {
    cornerPieces: Array.from(patternData.CORNERS.pieces),
    cornerOrient: Array.from(patternData.CORNERS.orientation),
    edgePieces:   Array.from(patternData.EDGES.pieces),
    edgeOrient:   Array.from(patternData.EDGES.orientation),
  };
}
