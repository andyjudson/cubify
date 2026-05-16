// Coordinate encoding/decoding for Kociemba 2-phase solver.
//
// Phase 1 coordinates: CO (3^7=2187), EO (2^11=2048), UDSlice (C(12,4)=495)
// Phase 2 coordinates: CP (8!=40320), EP4 (4!=24), EP8 (8!=40320)

// ---- helpers ----------------------------------------------------------------

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

// Lehmer code: rank a permutation in Factorial Number System
function permRank(perm: number[]): number {
  const n = perm.length;
  let idx = 0;
  const used = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    let cnt = 0;
    for (let j = 0; j < perm[i]; j++) if (!used[j]) cnt++;
    idx = idx * (n - i) + cnt;
    used[perm[i]] = true;
  }
  return idx;
}

function rankToPerm(rank: number, n: number): number[] {
  const avail: number[] = [];
  for (let i = 0; i < n; i++) avail.push(i);
  const perm: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const f = FACTORIAL[i];
    const j = Math.floor(rank / f);
    perm.push(avail[j]);
    avail.splice(j, 1);
    rank %= f;
  }
  return perm;
}

// ---- Phase 1 ----------------------------------------------------------------

/** Corner orientation index: 3^7 = 2187. Orientations 0..2186. Solved = 0. */
export function coIdx(ori: number[]): number {
  let idx = 0;
  for (let i = 0; i < 7; i++) idx = idx * 3 + ori[i];
  return idx;
}

export function decodeCO(idx: number): number[] {
  const ori = new Array(8).fill(0);
  let sum = 0;
  for (let i = 6; i >= 0; i--) {
    ori[i] = idx % 3;
    sum += ori[i];
    idx = Math.floor(idx / 3);
  }
  ori[7] = (3 - (sum % 3)) % 3;
  return ori;
}

/** Edge orientation index: 2^11 = 2048. Solved = 0. */
export function eoIdx(ori: number[]): number {
  let idx = 0;
  for (let i = 0; i < 11; i++) idx = (idx << 1) | ori[i];
  return idx;
}

export function decodeEO(idx: number): number[] {
  const ori = new Array(12).fill(0);
  let sum = 0;
  for (let i = 10; i >= 0; i--) {
    ori[i] = idx & 1;
    sum += ori[i];
    idx >>= 1;
  }
  ori[11] = sum % 2;
  return ori;
}

/**
 * UDSlice index: C(12,4) = 495.
 * Encodes which 4 of the 12 edge slots contain UD-slice pieces (pieces 8-11).
 * Solved state (pieces 8-11 in slots 8-11) = 494.
 */
export function udSliceIdx(pieces: number[]): number {
  const pos: number[] = [];
  for (let i = 0; i < 12; i++) if (pieces[i] >= 8) pos.push(i);
  pos.sort((a, b) => a - b);
  return choose(pos[0], 1) + choose(pos[1], 2) + choose(pos[2], 3) + choose(pos[3], 4);
}

/**
 * Decode UDSlice index to a 12-element piece array.
 * Slice pieces (8-11) are placed in the correct slots; non-slice (0-7) fill the rest.
 */
export function decodeUDSlice(idx: number): number[] {
  // Find ascending positions s0<s1<s2<s3 via combinatorial number system
  const pos: number[] = [];
  let rem = idx;
  for (let k = 4; k >= 1; k--) {
    let n = k - 1;
    while (choose(n + 1, k) <= rem) n++;
    pos.unshift(n);
    rem -= choose(n, k);
  }
  // pos = [s0, s1, s2, s3] ascending
  const pieces = new Array(12).fill(0);
  let sliceP = 8, nonSliceP = 0;
  for (let i = 0; i < 12; i++) {
    pieces[i] = pos.includes(i) ? sliceP++ : nonSliceP++;
  }
  return pieces;
}

// ---- Phase 2 ----------------------------------------------------------------

/** Corner permutation index: 8! = 40320. Solved = 0. */
export function cpIdx(pieces: number[]): number {
  return permRank(pieces);
}

export function decodeCP(idx: number): number[] {
  return rankToPerm(idx, 8);
}

/**
 * EP4: permutation of the 4 UD-slice edges within slots 8-11. 4! = 24.
 * Only meaningful when udSliceIdx = 494 (phase 2).
 */
export function ep4Idx(pieces: number[]): number {
  return permRank([pieces[8] - 8, pieces[9] - 8, pieces[10] - 8, pieces[11] - 8]);
}

export function decodeEP4(idx: number): number[] {
  return rankToPerm(idx, 4);
}

/**
 * EP8: permutation of the 8 non-slice edges in slots 0-7. 8! = 40320.
 * Only meaningful in phase 2.
 */
export function ep8Idx(pieces: number[]): number {
  return permRank(pieces.slice(0, 8));
}

export function decodeEP8(idx: number): number[] {
  return rankToPerm(idx, 8);
}
