import { type RawState, applyAlg } from './CfopMoveTables.js';
import { OLL_CASES, EOLL_CASES } from './CaseLibrary.js';

// U rotation cycle: slots 0→1→2→3→0  (CORNER_PIECES[U] = [1,2,3,0,...])
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

const AUF = ['', 'U', 'U2', "U'"];

export interface OllResult {
  alg: string;
  caseName: string;
  wcaId: number;
}

export interface TwoLookOllResult {
  eoll: OllResult;
  ocll: OllResult;
}

/** Solve EOLL: orient U-layer edges only (corners may still be disoriented). */
function solveEoll(state: RawState): OllResult {
  const eo = state.edgeOrient;
  if (eo[0]===0 && eo[1]===0 && eo[2]===0 && eo[3]===0) {
    return { alg: '', caseName: 'EOLL Skip', wcaId: 0 };
  }
  // Brute-force: try 4 AUF pre-rotations × 3 EOLL cases.
  // Verify by applying pre-AUF + alg and checking eo[0..3] are all 0.
  for (let auf = 0; auf < 4; auf++) {
    const prefix = AUF[auf];
    for (const c of EOLL_CASES) {
      let s = prefix ? applyAlg(state, prefix) : state;
      s = applyAlg(s, c.alg);
      if (s.edgeOrient[0]===0 && s.edgeOrient[1]===0 && s.edgeOrient[2]===0 && s.edgeOrient[3]===0) {
        return { alg: prefix ? `${prefix} ${c.alg}` : c.alg, caseName: c.name, wcaId: 0 };
      }
    }
  }
  throw new Error(`EOLL case not found for eo pattern [${eo[0]},${eo[1]},${eo[2]},${eo[3]}]`);
}

/**
 * Solve OLL in two looks: EOLL (orient edges only) then OCLL (orient corners only).
 * After EOLL, all U-layer edges are oriented, so solveOll will match one of the 7
 * OCLL cases (fingerprint[4..7] all 0) — or skip if corners also happen to be solved.
 */
export function solveTwoLookOll(state: RawState): TwoLookOllResult {
  const eoll = solveEoll(state);
  const afterEoll = eoll.alg ? applyAlg(state, eoll.alg) : state;
  const ocll = solveOll(afterEoll);
  return { eoll, ocll };
}

/** Solve OLL: match U-layer orientation fingerprint, return pre-AUF + case alg. */
export function solveOll(state: RawState): OllResult {
  const co = state.cornerOrient;
  const eo = state.edgeOrient;

  if (co[0]===0 && co[1]===0 && co[2]===0 && co[3]===0 &&
      eo[0]===0 && eo[1]===0 && eo[2]===0 && eo[3]===0) {
    return { alg: '', caseName: 'OLL Skip', wcaId: 0 };
  }

  const fp = [co[0], co[1], co[2], co[3], eo[0], eo[1], eo[2], eo[3]];

  for (let auf = 0; auf < 4; auf++) {
    const rotFp = rotateUFp_n(fp, auf);
    for (const c of OLL_CASES) {
      if (fpMatch8(rotFp, c.fingerprint)) {
        const prefix = AUF[auf];
        return {
          alg: prefix ? `${prefix} ${c.alg}` : c.alg,
          caseName: c.name,
          wcaId: c.wcaId,
        };
      }
    }
  }

  throw new Error(`OLL case not found for fingerprint [${fp}]`);
}
