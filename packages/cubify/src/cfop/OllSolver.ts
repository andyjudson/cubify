import { type RawState } from './CfopMoveTables.js';
import { OLL_CASES } from './CaseLibrary.js';

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
