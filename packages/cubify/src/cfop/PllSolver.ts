import { type RawState, applyMove, applyAlg, algToMoveIndices, applyMoveSeq } from './CfopMoveTables.js';
import { PLL_CASES, PLL_SOLVED_FINGERPRINT, CPLL_CASES } from './CaseLibrary.js';

// U rotation cycle for PLL fingerprint  (CORNER_PIECES[U] = [1,2,3,0,...])
// After U: slot 0 gets slot 1's value, slot 1 gets slot 2's, etc.
function rotateUFp(fp: number[]): number[] {
  return [fp[1], fp[2], fp[3], fp[0], fp[5], fp[6], fp[7], fp[4]];
}

function rotateUFp_n(fp: number[], n: number): number[] {
  let r = fp;
  for (let i = 0; i < n; i++) r = rotateUFp(r);
  return r;
}

function fpMatch8(a: number[], b: number[]): boolean {
  return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[3]===b[3] &&
         a[4]===b[4] && a[5]===b[5] && a[6]===b[6] && a[7]===b[7];
}

// AUF rotations: 0=none, 1=U(idx 0), 2=U2(idx 2), 3=U'(idx 1)
const AUF_STR = ['', 'U', 'U2', "U'"];
const AUF_MIDX = [-1, 0, 2, 1]; // move index; -1 = no move

export interface PllResult {
  alg: string;
  caseName: string;
  wcaId: string;
}

export interface TwoLookPllResult {
  cpll: PllResult;
  epll: PllResult;
}

const solvedCp = PLL_SOLVED_FINGERPRINT.slice(0, 4);

/** Solve CPLL: permute U-layer corners only (edges may be in any position). */
function solveCpll(state: RawState): PllResult {
  const cp = [state.cornerPieces[0], state.cornerPieces[1], state.cornerPieces[2], state.cornerPieces[3]];

  // Check skip: corners already solved under some AUF
  for (let n = 0; n < 4; n++) {
    const rot = rotateUFp_n(cp as number[], n);
    if (rot[0]===solvedCp[0] && rot[1]===solvedCp[1] && rot[2]===solvedCp[2] && rot[3]===solvedCp[3]) {
      return { alg: AUF_STR[n], caseName: 'CPLL Skip', wcaId: '' };
    }
  }

  // Brute-force: 4 pre-AUF × 3 CPLL cases — check if corners solved under any post-AUF
  for (let preN = 0; preN < 4; preN++) {
    for (const c of CPLL_CASES) {
      let s = state;
      const m1 = AUF_MIDX[preN];
      if (m1 >= 0) s = applyMove(s, m1);
      s = applyMoveSeq(s, algToMoveIndices(c.alg));
      for (let postN = 0; postN < 4; postN++) {
        let t = s;
        const m2 = AUF_MIDX[postN];
        if (m2 >= 0) t = applyMove(t, m2);
        if (t.cornerPieces[0]===solvedCp[0] && t.cornerPieces[1]===solvedCp[1] &&
            t.cornerPieces[2]===solvedCp[2] && t.cornerPieces[3]===solvedCp[3]) {
          const parts = [AUF_STR[preN], c.alg, AUF_STR[postN]].filter(Boolean);
          return { alg: parts.join(' '), caseName: c.name, wcaId: c.wcaId };
        }
      }
    }
  }

  // Should not occur for valid post-OLL states
  throw new Error(`CPLL case not found for cp [${cp}]`);
}

/**
 * Solve PLL in two looks: CPLL (permute corners only) then EPLL (permute edges).
 * Uses solvePll for the EPLL step — after CPLL, corners are solved, so solvePll
 * will return an edge-permutation-only case (Ua/Ub/H/Z) or a skip.
 */
export function solveTwoLookPll(state: RawState): TwoLookPllResult {
  const cpll = solveCpll(state);
  const afterCpll = cpll.alg ? applyAlg(state, cpll.alg) : state;
  const epll = solvePll(afterCpll);
  return { cpll, epll };
}

/** Solve PLL: match U-layer piece fingerprint, return pre-AUF + case alg + post-AUF. */
export function solvePll(state: RawState): PllResult {
  const cp = state.cornerPieces;
  const ep = state.edgePieces;
  const fp = [cp[0], cp[1], cp[2], cp[3], ep[0], ep[1], ep[2], ep[3]];

  // PLL skip: fingerprint matches solved z2 frame (under any U-rotation)
  for (let auf = 0; auf < 4; auf++) {
    if (fpMatch8(rotateUFp_n(fp, auf), PLL_SOLVED_FINGERPRINT)) {
      return { alg: AUF_STR[auf], caseName: 'PLL Skip', wcaId: '' };
    }
  }

  for (let auf = 0; auf < 4; auf++) {
    const rotFp = rotateUFp_n(fp, auf);
    for (const c of PLL_CASES) {
      if (fpMatch8(rotFp, c.fingerprint)) {
        const prefix = AUF_STR[auf];
        const postAuf = computePostAuf(state, auf, c.alg);
        const parts = [prefix, c.alg, postAuf].filter(Boolean);
        return { alg: parts.join(' '), caseName: c.name, wcaId: c.wcaId };
      }
    }
  }

  // Fingerprint didn't match (state arose from a non-pure OLL alg that shifted U-layer positions).
  // Brute-force: try every pre-AUF × PLL alg and check whether a post-AUF completes the solve.
  for (let auf = 0; auf < 4; auf++) {
    for (const c of PLL_CASES) {
      let s = state;
      const m1 = AUF_MIDX[auf];
      if (m1 >= 0) s = applyMove(s, m1);
      s = applyMoveSeq(s, algToMoveIndices(c.alg));
      for (let postAufIdx = 0; postAufIdx < 4; postAufIdx++) {
        let t = s;
        const m2 = AUF_MIDX[postAufIdx];
        if (m2 >= 0) t = applyMove(t, m2);
        if (isTopLayerAligned(t)) {
          const parts = [AUF_STR[auf], c.alg, AUF_STR[postAufIdx]].filter(Boolean);
          return { alg: parts.join(' '), caseName: c.name, wcaId: c.wcaId };
        }
      }
    }
  }

  throw new Error(`PLL case not found for fingerprint [${fp}]`);
}

/** After applying pre-AUF + PLL alg, determine which U-move (if any) aligns the top layer. */
function computePostAuf(state: RawState, preAufCount: number, caseAlg: string): string {
  let s = state;
  const mIdx = AUF_MIDX[preAufCount];
  if (mIdx >= 0) s = applyMove(s, mIdx);
  s = applyMoveSeq(s, algToMoveIndices(caseAlg));

  for (let i = 0; i < 4; i++) {
    let t = s;
    const mIdx2 = AUF_MIDX[i];
    if (mIdx2 >= 0) t = applyMove(t, mIdx2);
    if (isTopLayerAligned(t)) return AUF_STR[i];
  }
  return '';
}

/** Check that U-layer corner and edge pieces match the solved z2-frame positions. */
function isTopLayerAligned(s: RawState): boolean {
  const sol = PLL_SOLVED_FINGERPRINT;
  return s.cornerPieces[0]===sol[0] && s.cornerPieces[1]===sol[1] &&
         s.cornerPieces[2]===sol[2] && s.cornerPieces[3]===sol[3] &&
         s.edgePieces[0]===sol[4] && s.edgePieces[1]===sol[5] &&
         s.edgePieces[2]===sol[6] && s.edgePieces[3]===sol[7];
}
