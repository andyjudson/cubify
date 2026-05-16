import { cube3x3x3 } from 'cubing/puzzles';
import {
  coIdx, decodeCO,
  eoIdx, decodeEO,
  udSliceIdx, decodeUDSlice,
  cpIdx, decodeCP,
  ep4Idx, decodeEP4,
  ep8Idx, decodeEP8,
} from './Coordinates.js';

export const MOVE_NAMES = [
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'R', "R'", 'R2',
  'L', "L'", 'L2',
  'F', "F'", 'F2',
  'B', "B'", 'B2',
] as const;

export const N_MOVES = 18;

// Phase-2 allowed move indices: U U' U2 D D' D2 R2 L2 F2 B2
export const PHASE2_MOVES = [0, 1, 2, 3, 4, 5, 8, 11, 14, 17];

export interface MoveTables {
  // Phase-1 coordinate tables (index × N_MOVES → new index)
  co: Int16Array;       // 2187 × 18
  eo: Int16Array;       // 2048 × 18
  udSlice: Int16Array;  // 495  × 18
  // Phase-2 coordinate tables
  cp: Int32Array;       // 40320 × 18
  ep4: Int16Array;      // 24   × 18
  ep8: Int32Array;      // 40320 × 18
  // Raw edge permutations for each move (used to re-derive ep4/ep8 after phase 1)
  edgePerm: number[][];
  // Pruning tables
  prune1CoUD: Uint8Array;   // 2187 × 495
  prune1EoUD: Uint8Array;   // 2048 × 495
  prune2CpEp4: Uint8Array;  // 40320 × 24
  prune2Ep8: Uint8Array;    // 40320
}

export async function buildMoveTables(): Promise<MoveTables> {
  const puzzle = await cube3x3x3.kpuzzle();

  const cornerPerms: number[][] = [];
  const cornerDeltas: number[][] = [];
  const edgePerms: number[][] = [];
  const edgeDeltas: number[][] = [];

  for (const name of MOVE_NAMES) {
    const t = puzzle.moveToTransformation(name);
    const c = t.transformationData['CORNERS'];
    const e = t.transformationData['EDGES'];
    cornerPerms.push(Array.from(c.permutation));
    cornerDeltas.push(Array.from(c.orientationDelta));
    edgePerms.push(Array.from(e.permutation));
    edgeDeltas.push(Array.from(e.orientationDelta));
  }

  const co = buildCOTable(cornerPerms, cornerDeltas);
  const eo = buildEOTable(edgePerms, edgeDeltas);
  const udSlice = buildUDSliceTable(edgePerms);
  const cp = buildCPTable(cornerPerms);
  const ep4 = buildEP4Table(edgePerms);
  const ep8 = buildEP8Table(edgePerms);

  const prune1CoUD = buildPrune1CoUD(co, udSlice);
  const prune1EoUD = buildPrune1EoUD(eo, udSlice);
  const prune2CpEp4 = buildPrune2CpEp4(cp, ep4);
  const prune2Ep8 = buildPrune2Ep8(ep8);

  return { co, eo, udSlice, cp, ep4, ep8, edgePerm: edgePerms, prune1CoUD, prune1EoUD, prune2CpEp4, prune2Ep8 };
}

// ---- coordinate move tables -------------------------------------------------

function buildCOTable(perms: number[][], deltas: number[][]): Int16Array {
  const t = new Int16Array(2187 * N_MOVES);
  for (let idx = 0; idx < 2187; idx++) {
    const ori = decodeCO(idx);
    for (let m = 0; m < N_MOVES; m++) {
      const p = perms[m], d = deltas[m];
      const no = new Array(8);
      for (let i = 0; i < 8; i++) no[i] = (ori[p[i]] + d[i]) % 3;
      t[idx * N_MOVES + m] = coIdx(no);
    }
  }
  return t;
}

function buildEOTable(perms: number[][], deltas: number[][]): Int16Array {
  const t = new Int16Array(2048 * N_MOVES);
  for (let idx = 0; idx < 2048; idx++) {
    const ori = decodeEO(idx);
    for (let m = 0; m < N_MOVES; m++) {
      const p = perms[m], d = deltas[m];
      const no = new Array(12);
      for (let i = 0; i < 12; i++) no[i] = (ori[p[i]] + d[i]) % 2;
      t[idx * N_MOVES + m] = eoIdx(no);
    }
  }
  return t;
}

function buildUDSliceTable(perms: number[][]): Int16Array {
  const t = new Int16Array(495 * N_MOVES);
  for (let idx = 0; idx < 495; idx++) {
    const pieces = decodeUDSlice(idx);
    for (let m = 0; m < N_MOVES; m++) {
      const p = perms[m];
      const np = new Array(12);
      for (let i = 0; i < 12; i++) np[i] = pieces[p[i]];
      t[idx * N_MOVES + m] = udSliceIdx(np);
    }
  }
  return t;
}

function buildCPTable(perms: number[][]): Int32Array {
  const t = new Int32Array(40320 * N_MOVES);
  for (let idx = 0; idx < 40320; idx++) {
    const pieces = decodeCP(idx);
    for (let m = 0; m < N_MOVES; m++) {
      const p = perms[m];
      const np = new Array(8);
      for (let i = 0; i < 8; i++) np[i] = pieces[p[i]];
      t[idx * N_MOVES + m] = cpIdx(np);
    }
  }
  return t;
}

function buildEP4Table(perms: number[][]): Int16Array {
  const t = new Int16Array(24 * N_MOVES);
  for (let idx = 0; idx < 24; idx++) {
    const rel = decodeEP4(idx);
    const pieces12 = [0, 1, 2, 3, 4, 5, 6, 7, rel[0] + 8, rel[1] + 8, rel[2] + 8, rel[3] + 8];
    for (let m = 0; m < N_MOVES; m++) {
      const p = perms[m];
      const np = new Array(12);
      for (let i = 0; i < 12; i++) np[i] = pieces12[p[i]];
      t[idx * N_MOVES + m] = ep4Idx(np);
    }
  }
  return t;
}

function buildEP8Table(perms: number[][]): Int32Array {
  const t = new Int32Array(40320 * N_MOVES);
  for (let idx = 0; idx < 40320; idx++) {
    const perm8 = decodeEP8(idx);
    const pieces12 = [...perm8, 8, 9, 10, 11];
    for (let m = 0; m < N_MOVES; m++) {
      const p = perms[m];
      const np = new Array(12);
      for (let i = 0; i < 12; i++) np[i] = pieces12[p[i]];
      t[idx * N_MOVES + m] = ep8Idx(np);
    }
  }
  return t;
}

// ---- pruning tables (BFS from solved) ---------------------------------------

function buildPrune1CoUD(coTable: Int16Array, udTable: Int16Array): Uint8Array {
  const SIZE = 2187 * 495;
  const t = new Uint8Array(SIZE).fill(255);
  // Solved: co=0, ud=494
  t[0 * 495 + 494] = 0;
  let filled = 1, depth = 0;
  while (filled < SIZE) {
    const next = depth + 1;
    for (let co = 0; co < 2187; co++) {
      for (let ud = 0; ud < 495; ud++) {
        if (t[co * 495 + ud] !== depth) continue;
        for (let m = 0; m < N_MOVES; m++) {
          const nco = coTable[co * N_MOVES + m];
          const nud = udTable[ud * N_MOVES + m];
          const ni = nco * 495 + nud;
          if (t[ni] === 255) { t[ni] = next; filled++; }
        }
      }
    }
    depth++;
    if (depth > 12) break;
  }
  return t;
}

function buildPrune1EoUD(eoTable: Int16Array, udTable: Int16Array): Uint8Array {
  const SIZE = 2048 * 495;
  const t = new Uint8Array(SIZE).fill(255);
  t[0 * 495 + 494] = 0;
  let filled = 1, depth = 0;
  while (filled < SIZE) {
    const next = depth + 1;
    for (let eo = 0; eo < 2048; eo++) {
      for (let ud = 0; ud < 495; ud++) {
        if (t[eo * 495 + ud] !== depth) continue;
        for (let m = 0; m < N_MOVES; m++) {
          const neo = eoTable[eo * N_MOVES + m];
          const nud = udTable[ud * N_MOVES + m];
          const ni = neo * 495 + nud;
          if (t[ni] === 255) { t[ni] = next; filled++; }
        }
      }
    }
    depth++;
    if (depth > 12) break;
  }
  return t;
}

function buildPrune2CpEp4(cpTable: Int32Array, ep4Table: Int16Array): Uint8Array {
  const SIZE = 40320 * 24;
  const t = new Uint8Array(SIZE).fill(255);
  t[0 * 24 + 0] = 0;
  let filled = 1, depth = 0;
  while (filled < SIZE) {
    const next = depth + 1;
    for (let cp = 0; cp < 40320; cp++) {
      for (let ep4 = 0; ep4 < 24; ep4++) {
        if (t[cp * 24 + ep4] !== depth) continue;
        for (const m of PHASE2_MOVES) {
          const ncp = cpTable[cp * N_MOVES + m];
          const nep4 = ep4Table[ep4 * N_MOVES + m];
          const ni = ncp * 24 + nep4;
          if (t[ni] === 255) { t[ni] = next; filled++; }
        }
      }
    }
    depth++;
    if (depth > 18) break;
  }
  return t;
}

function buildPrune2Ep8(ep8Table: Int32Array): Uint8Array {
  const t = new Uint8Array(40320).fill(255);
  t[0] = 0;
  let filled = 1, depth = 0;
  while (filled < 40320) {
    const next = depth + 1;
    for (let ep8 = 0; ep8 < 40320; ep8++) {
      if (t[ep8] !== depth) continue;
      for (const m of PHASE2_MOVES) {
        const nep8 = ep8Table[ep8 * N_MOVES + m];
        if (t[nep8] === 255) { t[nep8] = next; filled++; }
      }
    }
    depth++;
    if (depth > 18) break;
  }
  return t;
}
