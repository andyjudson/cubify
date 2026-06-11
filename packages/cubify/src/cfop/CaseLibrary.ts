/**
 * Pre-computed OLL and PLL case libraries for the CFOP solver.
 *
 * Alg sources: cubehead and jperm (consolidated into one set).
 *
 * Solver alg selection:
 *   OLL_CASES / PLL_CASES  → 1-look CFOP
 *   BGN_OCLL_CASES         → 2-look OLL corner step (beginner)
 *   BGN_EPLL_CASES         → 2-look PLL edge step (beginner)
 *   CPLL_CASES             → 2-look PLL corner step
 *
 * alg+fingerprint pairs must stay in sync — fingerprint is derived from the alg's
 * canonical starting orientation (apply inverse of alg to solved z2 state).
 *
 * OLL fingerprint = [cornerOrient[0..3], edgeOrient[0..3]] (U-layer, z2 frame)
 * PLL fingerprint = [cornerPieces[0..3], edgePieces[0..3]] (U-layer, z2 frame)
 */

export interface OllCase {
  id: string;
  name: string;
  wcaId: number;
  alg: string;
  fingerprint: number[]; // [co0,co1,co2,co3, eo0,eo1,eo2,eo3]
}

export interface PllCase {
  id: string;
  name: string;
  wcaId: string;
  alg: string;
  fingerprint: number[]; // [cp0,cp1,cp2,cp3, ep0,ep1,ep2,ep3]
}

export const OLL_CASES: OllCase[] = [
  { id: 'oll-1-1', name: 'Sune', wcaId: 27, alg: "R U R' U (R U2 R')", fingerprint: [2,2,2,0,0,0,0,0] },
  { id: 'oll-1-2', name: 'Anti-Sune', wcaId: 26, alg: "(R U2 R') U' R U' R'", fingerprint: [1,0,1,1,0,0,0,0] },
  { id: 'oll-1-3', name: 'H Shape', wcaId: 21, alg: "R U R' U (R U' R' U) R U2 R'", fingerprint: [1,2,1,2,0,0,0,0] },
  { id: 'oll-1-4', name: 'Pi Shape', wcaId: 22, alg: "R U2 (R2 U') (R2 U') R2 U2 R", fingerprint: [2,1,1,2,0,0,0,0] },
  { id: 'oll-1-5', name: 'T Shape', wcaId: 24, alg: "(R U R) D (R' U' R) D' R2", fingerprint: [0,2,1,0,0,0,0,0] },
  { id: 'oll-1-6', name: 'L Shape', wcaId: 25, alg: "R2 D' (R U' R') D (R U R)", fingerprint: [0,1,0,2,0,0,0,0] },
  { id: 'oll-1-7', name: 'U Shape', wcaId: 23, alg: "R2 D (R' U2 R) D' (R' U2 R')", fingerprint: [2,0,0,1,0,0,0,0] },
  { id: 'oll-2-1', name: 'Suit Up', wcaId: 45, alg: "F (R U R' U') F'", fingerprint: [0,0,1,2,1,0,1,0] },
  { id: 'oll-2-2', name: 'Tying Shoelaces', wcaId: 33, alg: "(R U R' U') (R' F R F')", fingerprint: [0,0,2,1,1,0,1,0] },
  { id: 'oll-2-3', name: 'P Shape', wcaId: 44, alg: "F (U R U' R') F'", fingerprint: [1,2,0,0,1,1,0,0] },
  { id: 'oll-2-4', name: 'Anti-P Shape', wcaId: 43, alg: "R' (U' F' U F) R", fingerprint: [2,0,0,1,1,1,0,0] },
  { id: 'oll-2-5', name: 'Couch', wcaId: 31, alg: "R' U' F (U R U' R') F' R", fingerprint: [0,0,2,1,1,0,0,1] },
  { id: 'oll-2-6', name: 'Anti-Couch', wcaId: 32, alg: "S (R U R' U') (R' F R f')", fingerprint: [0,0,2,1,0,0,1,1] },
  { id: 'oll-2-7', name: 'Seeing Headlights', wcaId: 46, alg: "R' U' (R' F R F') U R", fingerprint: [1,2,0,0,0,1,0,1] },
  { id: 'oll-2-8', name: 'City', wcaId: 34, alg: "f R f' U' r' U' R U M'", fingerprint: [0,0,2,1,0,1,0,1] },
  { id: 'oll-2-9', name: 'Moustache', wcaId: 38, alg: "(R U R' U) R U' R' U' (R' F R F')", fingerprint: [1,0,2,0,1,1,0,0] },
  { id: 'oll-2-10', name: 'Anti-Moustache', wcaId: 36, alg: "(L' U' L U') L' U L U (r U' r' F)", fingerprint: [0,1,0,2,1,0,0,1] },
  { id: 'oll-3-1', name: 'Righty Square', wcaId: 6, alg: "(r U2 R') U' R U' r'", fingerprint: [1,0,1,1,1,0,0,1] },
  { id: 'oll-3-2', name: 'Lefty Square', wcaId: 5, alg: "(r' U2 R) U R' U r", fingerprint: [0,2,2,2,0,0,1,1] },
  { id: 'oll-3-3', name: 'Stealth', wcaId: 28, alg: "(r U R' U') M (U R U' R')", fingerprint: [0,0,0,0,1,1,0,0] },
  { id: 'oll-3-4', name: 'Mummy', wcaId: 57, alg: "(R U R' U') M' (U R U' r')", fingerprint: [0,0,0,0,1,0,1,0] },
  { id: 'oll-4-1', name: 'Lightning', wcaId: 7, alg: "r U R' U (R U2 r')", fingerprint: [2,2,2,0,1,1,0,0] },
  { id: 'oll-4-2', name: 'Reverse Lightning', wcaId: 8, alg: "R' F' (r U' r') F2 R", fingerprint: [0,1,1,1,1,0,0,1] },
  { id: 'oll-4-3', name: 'Downstairs', wcaId: 11, alg: "r' (R2 U R' U R U2 R') U M'", fingerprint: [2,2,2,0,0,0,1,1] },
  { id: 'oll-4-4', name: 'Upstairs', wcaId: 12, alg: "r (R2 U' R U' R' U2 R) U' M", fingerprint: [1,1,0,1,1,0,0,1] },
  { id: 'oll-4-5', name: 'Anti-Fung', wcaId: 40, alg: "(f R' F' R) (U R U' R') S'", fingerprint: [0,2,0,1,1,0,1,0] },
  { id: 'oll-4-6', name: 'Fung', wcaId: 39, alg: "f' (r U r' U') (r' F r S)", fingerprint: [2,0,1,0,1,0,1,0] },
  { id: 'oll-4-7', name: 'Breakneck', wcaId: 48, alg: "F (R U R' U') (R U R' U') F'", fingerprint: [2,1,1,2,1,1,0,0] },
  { id: 'oll-4-8', name: 'Anti-Breakneck', wcaId: 47, alg: "(F R' F' R) U2 (R U' R' U) R U2 R'", fingerprint: [1,1,2,2,1,1,0,0] },
  { id: 'oll-4-9', name: 'Frying Pan', wcaId: 53, alg: "r' U' R U' (R' U R U') R' U2 r", fingerprint: [1,2,1,2,0,0,1,1] },
  { id: 'oll-4-10', name: 'Anti-Frying Pan', wcaId: 54, alg: "r U R' U (R U' R' U) R U2 r'", fingerprint: [1,2,1,2,1,0,0,1] },
  { id: 'oll-4-11', name: 'Right Back Squeezy', wcaId: 49, alg: "r U' (r2' U) (r2 U) r2' U' r", fingerprint: [2,1,1,2,1,0,0,1] },
  { id: 'oll-4-12', name: 'Right Front Squeezy', wcaId: 50, alg: "r' U (r2 U') (r2' U') r2 U r'", fingerprint: [2,1,1,2,0,0,1,1] },
  { id: 'oll-5-1', name: 'Mounted Fish', wcaId: 37, alg: "(F R' F' R) (U R U' R')", fingerprint: [0,2,0,1,1,1,0,0] },
  { id: 'oll-5-2', name: 'Fish Salad', wcaId: 35, alg: "R U2 R2' (F R F' R) U2 R'", fingerprint: [0,2,0,1,0,0,1,1] },
  { id: 'oll-5-3', name: 'Kite', wcaId: 9, alg: "(R U R' U') R' F (R2 U R' U') F'", fingerprint: [0,1,1,1,1,1,0,0] },
  { id: 'oll-5-4', name: 'Anti-Kite', wcaId: 10, alg: "R U R' U (R' F R F') R U2 R'", fingerprint: [2,0,2,2,0,1,1,0] },
  { id: 'oll-5-5', name: 'Spotted Chameleon', wcaId: 29, alg: "r2 D' (r U r') D r2 U' (r' U' r)", fingerprint: [1,0,0,2,0,1,1,0] },
  { id: 'oll-5-6', name: 'Anti-Spotted Chameleon', wcaId: 30, alg: "F U (R U2 R' U') (R U2 R' U') F'", fingerprint: [0,2,1,0,1,1,0,0] },
  { id: 'oll-5-7', name: 'Dalmatian', wcaId: 41, alg: "(R U R' U R U2 R') F (R U R' U') F'", fingerprint: [0,1,2,0,1,1,0,0] },
  { id: 'oll-5-8', name: 'Anti-Dalmatian', wcaId: 42, alg: "F U R U' R' F' R U2 R2 U' R2 U' R2 U2 R", fingerprint: [0,0,1,2,1,1,0,0] },
  { id: 'oll-6-1', name: 'Bottlecap', wcaId: 51, alg: "F (U R U' R') (U R U' R') F'", fingerprint: [1,2,2,1,1,0,1,0] },
  { id: 'oll-6-2', name: 'Rice Cooker', wcaId: 52, alg: "R' (F' U' F U') R U R' U R", fingerprint: [2,1,1,2,0,1,0,1] },
  { id: 'oll-6-3', name: 'Dead Man', wcaId: 56, alg: "r U r' (U R U' R') (U R U' R') r U' r'", fingerprint: [1,2,1,2,1,0,1,0] },
  { id: 'oll-6-4', name: 'Freeway', wcaId: 55, alg: "R' F (R U R U') R2 F' (R2 U' R') U (R U R')", fingerprint: [2,1,2,1,1,0,1,0] },
  { id: 'oll-6-5', name: 'Anti-Squeegee', wcaId: 16, alg: "R' F' R (L' U' L U) R' F R", fingerprint: [2,2,0,2,1,0,1,0] },
  { id: 'oll-6-6', name: 'Squeegee', wcaId: 15, alg: "r U r' (R U R' U') r U' r'", fingerprint: [1,0,1,1,1,0,1,0] },
  { id: 'oll-6-7', name: 'Gun', wcaId: 13, alg: "(F U R U') R2 F' R (U R U' R')", fingerprint: [2,2,2,0,1,0,1,0] },
  { id: 'oll-6-8', name: 'Anti-Gun', wcaId: 14, alg: "R' F (R U R') F' R (F U' F')", fingerprint: [0,1,1,1,1,0,1,0] },
  { id: 'oll-7-1', name: 'Runway', wcaId: 1, alg: "R U2 (R2 F R F') U2 (R' F R F')", fingerprint: [1,2,1,2,1,1,1,1] },
  { id: 'oll-7-2', name: 'Zamboni', wcaId: 2, alg: "f (U R U' R') S' (U R U' R') F'", fingerprint: [1,2,2,1,1,1,1,1] },
  { id: 'oll-7-3', name: 'Slash', wcaId: 17, alg: "(F R' F' R) U S' (R U' R') S", fingerprint: [0,2,0,1,1,1,1,1] },
  { id: 'oll-7-4', name: 'Checkers', wcaId: 20, alg: "S R' U' (R U) (R U) R U' R' S'", fingerprint: [0,0,0,0,1,1,1,1] },
  { id: 'oll-7-5', name: 'Bunny', wcaId: 19, alg: "S' (R U R') S U' (R' F R F')", fingerprint: [0,0,2,1,1,1,1,1] },
  { id: 'oll-7-6', name: 'Crown', wcaId: 18, alg: "(r U R' U R U2 r') (r' U' R U' R' U2 r)", fingerprint: [2,0,0,1,1,1,1,1] },
  { id: 'oll-7-7', name: 'Mouse', wcaId: 4, alg: "(R' F2 R2 U2 R') F' (R U2 R2 F2 R)", fingerprint: [1,0,1,1,1,1,1,1] },
  { id: 'oll-7-8', name: 'Anti-Mouse', wcaId: 3, alg: "(R' F2 R2 U2 R') F (R U2 R2 F2 R)", fingerprint: [2,2,0,2,1,1,1,1] },
];

// ─── EOLL case library ───────────────────────────────────────────────────────
// Used for the first step of 2-look OLL. Matches only edgeOrient[0..3] (corners
// may still be disoriented — they are handled separately by OCLL).
// eoPattern is the canonical rotation; the solver tries all 4 AUF variants.

export interface EollCase {
  id: string;
  name: string;
  alg: string;
  /** Canonical edgeOrient[0..3] pattern for this EOLL case. */
  eoPattern: number[];
}

export const EOLL_CASES: EollCase[] = [
  { id: 'eoll-dot',  name: 'Dot',  alg: "F R U R' U' F' f R U R' U' f'", eoPattern: [1,1,1,1] },
  { id: 'eoll-bar',  name: 'Line', alg: "F R U R' U' F'",                 eoPattern: [1,0,1,0] },
  { id: 'eoll-hook', name: 'Hook', alg: "f R U R' U' f'",                 eoPattern: [1,1,0,0] },
];

// ─── CPLL / EPLL filtered subsets ───────────────────────────────────────────
// Used for 2-look PLL. CPLL cases: PLL cases whose fingerprint has solved edges
// (ep == PLL_SOLVED_FINGERPRINT[4..7]), meaning only corners need permuting.
// EPLL cases: pll-1-* entries (Ua, Ub, H, Z).

/** Fingerprint of the solved (skip) PLL state in z2 frame. */
export const PLL_SOLVED_FINGERPRINT = [5,6,7,4, 4,7,6,5];

export const PLL_CASES: PllCase[] = [
  { id: 'pll-1-1', name: 'Ua Perm', wcaId: 'Ua', alg: "(R U R' U) R' U' (R2 U' R') U R' U R", fingerprint: [7,4,5,6,6,4,7,5] },
  { id: 'pll-1-2', name: 'Ub Perm', wcaId: 'Ub', alg: "R' U R' U' (R' U') R' U (R U R2)", fingerprint: [5,6,7,4,4,5,7,6] },
  { id: 'pll-1-3', name: 'H Perm', wcaId: 'H', alg: "M2 U' (M2 U2 M2) U' M2", fingerprint: [5,6,7,4,6,5,4,7] },
  { id: 'pll-1-4', name: 'Z Perm', wcaId: 'Z', alg: "M' U' (M2 U') (M2 U') M' U2 M2", fingerprint: [6,7,4,5,6,7,4,5] },
  { id: 'pll-2-1', name: 'Aa Perm', wcaId: 'Aa', alg: "x (R' U R') D2 (R U' R') D2 R2 x'", fingerprint: [7,5,6,4,4,7,6,5] },
  { id: 'pll-2-2', name: 'Ab Perm', wcaId: 'Ab', alg: "x R2 D2 (R U R') D2 (R U' R) x'", fingerprint: [6,7,5,4,4,7,6,5] },
  { id: 'pll-2-3', name: 'E Perm', wcaId: 'E', alg: "x' (R U' R') D (R U R') D' (R U R') D (R U' R') D' x", fingerprint: [6,5,4,7,4,7,6,5] },
  { id: 'pll-3-1', name: 'T Perm', wcaId: 'T', alg: "(R U R' U') R' F (R2 U' R') U' (R U R' F')", fingerprint: [6,5,7,4,4,5,6,7] },
  { id: 'pll-3-2', name: 'F Perm', wcaId: 'F', alg: "R' U' F' (R U R' U') R' F (R2 U' R') U' (R U R') U R", fingerprint: [6,5,7,4,6,7,4,5] },
  { id: 'pll-3-3', name: 'Jb Perm', wcaId: 'Jb', alg: "R U R' F' (R U R' U') R' F (R2 U' R')", fingerprint: [5,4,6,7,4,5,7,6] },
  { id: 'pll-3-4', name: 'Ja Perm', wcaId: 'Ja', alg: "x R2 (F R F' R) U2 (r' U r) U2 x'", fingerprint: [6,5,7,4,4,6,7,5] },
  { id: 'pll-3-5', name: 'Ra Perm', wcaId: 'Ra', alg: "(R U' R' U') R U R D (R' U' R D') R' U2 R'", fingerprint: [5,4,6,7,5,4,6,7] },
  { id: 'pll-3-6', name: 'Rb Perm', wcaId: 'Rb', alg: "(R' U2 R U2) R' F (R U R' U') R' F' R2", fingerprint: [4,6,5,7,4,5,7,6] },
  { id: 'pll-4-1', name: 'Y Perm', wcaId: 'Y', alg: "F (R U' R' U') R U R' F' (R U R' U') R' F R F'", fingerprint: [7,6,5,4,4,7,5,6] },
  { id: 'pll-4-2', name: 'Na Perm', wcaId: 'Na', alg: "(R U R' U) R U R' F' (R U R' U') R' F (R2 U' R') U2 R U' R'", fingerprint: [5,4,7,6,4,5,6,7] },
  { id: 'pll-4-3', name: 'Nb Perm', wcaId: 'Nb', alg: "(R' U R U') R' (F' U' F) R U (R' U' R U') f R f'", fingerprint: [7,6,5,4,4,5,6,7] },
  { id: 'pll-4-4', name: 'V Perm', wcaId: 'V', alg: "(R' U R' U') R D' R' D R' (U D' R2 U' R2 D R2)", fingerprint: [7,6,5,4,4,6,7,5] },
  { id: 'pll-5-1', name: 'Ga Perm', wcaId: 'Ga', alg: "R2 (U R' U R') U' R U' R2 (D U') R' U R D'", fingerprint: [6,5,7,4,7,5,4,6] },
  { id: 'pll-5-2', name: 'Gb Perm', wcaId: 'Gb', alg: "D R' U' R (U D') R2 U R' U (R U' R U') R2", fingerprint: [6,5,7,4,6,4,5,7] },
  { id: 'pll-5-3', name: 'Gc Perm', wcaId: 'Gc', alg: "D R2 (U' R U' R) U R' U R2 (D' U) R U' R'", fingerprint: [6,5,7,4,6,5,7,4] },
  { id: 'pll-5-4', name: 'Gd Perm', wcaId: 'Gd', alg: "R U R' (U' D) R2 U' R U' (R' U R' U) R2 D'", fingerprint: [6,5,7,4,5,6,4,7] },
];

// CPLL cases: PLL_CASES whose fingerprint has solved edge positions.
// Applying these algs fixes corner permutation; edges may shift (EPLL handles that).
// Beginner CPLL cases: T perm + Y perm.
export const CPLL_CASES = PLL_CASES.filter(c => c.id === 'pll-3-1' || c.id === 'pll-4-1');

// EPLL cases: edge-permutation algs (Ua, Ub, H, Z).
export const EPLL_CASES = PLL_CASES.filter(c => c.id.startsWith('pll-1-'));

// ─── 2-look OLL/PLL case sets (beginner) ─────────────────────────────────────
// Used by solveTwoLookOll (OCLL step) and solveTwoLookPll (EPLL step).
// Differ from OLL_CASES / PLL_CASES only for T Shape, L Shape, and Ua Perm —
// where the beginner preferred alg diverges from the 1-look set.
// Fingerprints are computed from each alg's canonical starting orientation.

export const BGN_OCLL_CASES: OllCase[] = [
  { id: 'oll_sune',     name: 'Sune',     wcaId: 27, alg: "R U R' U (R U2 R')",             fingerprint: [2,2,2,0,0,0,0,0] },
  { id: 'oll_antisune', name: 'AntiSune', wcaId: 26, alg: "(R U2 R') U' R U' R'",         fingerprint: [1,0,1,1,0,0,0,0] },
  { id: 'oll_shape_h',  name: 'H shape',  wcaId: 21, alg: "R U R' U (R U' R' U) R U2 R'", fingerprint: [1,2,1,2,0,0,0,0] },
  { id: 'oll_shape_pi', name: 'Pi shape', wcaId: 22, alg: "R U2 (R2 U') (R2 U') R2 U2 R",   fingerprint: [2,1,1,2,0,0,0,0] },
  { id: 'oll_shape_t',  name: 'T shape',  wcaId: 24, alg: "r U R' U' r' F R F'",           fingerprint: [0,0,2,1,0,0,0,0] },
  { id: 'oll_shape_l',  name: 'L shape',  wcaId: 25, alg: "F' r U R' U' r' F R",           fingerprint: [2,0,1,0,0,0,0,0] },
  { id: 'oll_shape_u',  name: 'U shape',  wcaId: 23, alg: "R2 D (R' U2 R) D' (R' U2 R')", fingerprint: [2,0,0,1,0,0,0,0] },
];

// 2-look PLL EPLL set: beginner Ua alg replaces the 1-look Ua; Ub/H/Z are identical.
const BGN_UA: PllCase = { id: 'pll_ua', name: 'Ua Perm', wcaId: 'Ua', alg: "R2 U' R' U' R U R U R U' R", fingerprint: [5,6,7,4,4,6,5,7] };
export const BGN_EPLL_CASES: PllCase[] = [
  BGN_UA,
  ...PLL_CASES.filter(c => c.id === 'pll-1-2' || c.id === 'pll-1-3' || c.id === 'pll-1-4'),
];

// ─── F2L trigger table ───────────────────────────────────────────────────────
// Each entry describes the before-state of a direct insertion trigger — the
// (cornerSlot, cornerOrient, edgeSlot, edgeOrient) configuration that the trigger
// expects. U-layer slots are 0..3. Values were computed empirically by applying the
// inverse of each trigger to the z2-solved state and recording piece positions.
// AUF rotations (U turns) shift the slot indices; the solver adds U-turns to align.

export interface F2lTrigger {
  id: string;
  alg: string;
  cornerSlot: number;   // expected U-layer corner slot before trigger (0..3)
  cornerOrient: number; // expected corner orientation before trigger
  edgeSlot: number;     // expected U-layer edge slot before trigger (0..3)
  edgeOrient: number;   // expected edge orientation before trigger (always 0)
  target: string;       // which F2L slot this trigger inserts into
}

export const F2L_TRIGGERS: F2lTrigger[] = [
  // FR slot — R-family triggers
  { id: 'fr-connected',    alg: "U R U' R'",  cornerSlot: 0, cornerOrient: 2, edgeSlot: 1, edgeOrient: 0, target: 'f2l-fr' },
  { id: 'fr-disconnected', alg: "R U R'",      cornerSlot: 0, cornerOrient: 1, edgeSlot: 2, edgeOrient: 0, target: 'f2l-fr' },
  // FL slot — L-family triggers
  { id: 'fl-connected',    alg: "U' L' U L",   cornerSlot: 3, cornerOrient: 1, edgeSlot: 3, edgeOrient: 0, target: 'f2l-fl' },
  { id: 'fl-disconnected', alg: "L' U' L",      cornerSlot: 3, cornerOrient: 2, edgeSlot: 2, edgeOrient: 0, target: 'f2l-fl' },
  // BR slot — R-back triggers
  { id: 'br-connected',    alg: "U' R' U R",   cornerSlot: 1, cornerOrient: 1, edgeSlot: 1, edgeOrient: 0, target: 'f2l-br' },
  { id: 'br-disconnected', alg: "R' U' R",      cornerSlot: 1, cornerOrient: 2, edgeSlot: 0, edgeOrient: 0, target: 'f2l-br' },
  // BL slot — L-back triggers
  { id: 'bl-connected',    alg: "U L U' L'",   cornerSlot: 2, cornerOrient: 2, edgeSlot: 3, edgeOrient: 0, target: 'f2l-bl' },
  { id: 'bl-disconnected', alg: "L U L'",       cornerSlot: 2, cornerOrient: 1, edgeSlot: 0, edgeOrient: 0, target: 'f2l-bl' },
];
