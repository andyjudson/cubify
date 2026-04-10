// Derive correct CORNER_POSITIONS by using the cycle-based permutation as ground truth
// and solving for which [face, slot] assignments make the piece-based perm match.

import { cube3x3x3 } from 'cubing/puzzles';
const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

const FACE_NAMES = ['U','R','F','D','L','B'];
const fn = (n) => FACE_NAMES[Math.floor(n/9)] + '[' + (n%9) + ']';
const [U,R,F,D,L,B] = [0,9,18,27,36,45];

// The CORRECT sticker permutations (verified physically):
function faceCW(off) { return [[off,off+2,off+8,off+6],[off+1,off+5,off+7,off+3]]; }
function buildPerm(cycles) {
  const perm = Array.from({length:54}, (_,i) => i);
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) perm[cycle[(i+1)%len]] = cycle[i];
  }
  return perm;
}

const CORRECT_PERMS = {
  R: buildPerm([...faceCW(R), [F+2,U+2,B+6,D+2],[F+5,U+5,B+3,D+5],[F+8,U+8,B+0,D+8]]),
  U: buildPerm([...faceCW(U), [F+0,R+0,B+0,L+0],[F+1,R+1,B+1,L+1],[F+2,R+2,B+2,L+2]]),
  F: buildPerm([...faceCW(F), [U+6,R+0,D+2,L+8],[U+7,R+3,D+1,L+5],[U+8,R+6,D+0,L+2]]),
  L: buildPerm([...faceCW(L), [U+0,F+0,D+0,B+8],[U+3,F+3,D+3,B+5],[U+6,F+6,D+6,B+2]]),
  D: buildPerm([...faceCW(D), [F+6,L+6,B+6,R+6],[F+7,L+7,B+7,R+7],[F+8,L+8,B+8,R+8]]),
  B: buildPerm([...faceCW(B), [U+0,L+6,D+6,R+8],[U+1,L+3,D+7,R+5],[U+2,L+0,D+8,R+2]]),
};

// For each corner slot, we know which 3 sticker positions are on the 3 adjacent faces.
// We need to find the [face, slot] for each of the 3 sticker positions, in PRIMARY order.
// Primary = U/D face sticker first, then the other two in CW order.

// Method: In solved state, each corner piece has unique stickers.
// After applying moves, we can track where each sticker goes using CORRECT_PERMS.
// By checking which positions are in the same "orbit" as U[8] (URF corner U-sticker),
// we can identify the 3 sticker positions for each corner.

// Corner slot identification from move analysis:
// Corner slots: 0=URF, 1=URB, 2=ULB, 3=ULF, 4=DRF, 5=DLF, 6=DLB, 7=DRB (from cubing.js)

// For each corner SLOT, we need the 3 sticker positions and their ordering.
// I'll use the following approach:
// The 3 sticker positions for URF corner must satisfy:
// 1. They are on the U, R, and F faces
// 2. They are affected by R, U, and F moves (the moves adjacent to URF)
// 3. The PRIMARY (orient=0) position is the U face sticker (U[something])

// From the R cycle analysis: after R, the stickers in U's right column (U[2,5,8]),
// F's right column (F[2,5,8]), D's right column (D[2,5,8]), B's left column (B[0,3,6])
// are the ones that change (along with R face stickers).

// The corner stickers specifically:
// URF corner: U[8] (near FR), R[0] (near UF), F[2] (near UR)
// URB corner: U[2] (near BR), R[2] (near UB), B[0] (near UR from behind)
// DRF corner: D[2] (near FR), R[6] (near DF), F[8] (near DR)
// DRB corner: D[8] (near BR), R[8] (near DB), B[6] (near DR from behind)

// Let me verify these by checking the correct R permutation directly.
// After R: the sticker at URF's U-position goes to the URB's U-position
// (since URF piece goes to URB, and the F-sticker of URF = the F-sticker goes to U face of URB,
// actually this is complex... let me just look at where each R-face-adjacent sticker goes).

// From the CORRECT R perm, list all positions that change:
const changed_R = [];
for (let i = 0; i < 54; i++) {
  if (CORRECT_PERMS.R[i] !== i) changed_R.push(i);
}
console.log('Positions changed by R:', changed_R.map(fn).join(', '));
console.log('');

// Corner sticker positions should be among the changed positions (except R-face ones for U move etc.)
// For R: non-R-face changed positions are the cross-face ones + corner stickers of R-adjacent corners.

// Actually: for each correct move perm, the changed positions include:
// 1. All face stickers for the moved face (8 positions, since center is fixed)
// 2. All adjacent cross-face stickers
// Total: 8 + 12 = 20 positions changed per move.

// The 8 adjacent stickers (non-face ones) include 6 corner stickers + 2 edge stickers...
// No wait: each face has 4 corners with 2 stickers each on adjacent faces = 8, plus 4 edges with 1 sticker each on adjacent face = 4. But some are face-stickers of the moved face.
// Total adjacent non-face: 12.

// Let me identify the corner sticker positions by checking which positions are ONLY changed by
// moves that involve that corner.
// URF is adjacent to R, U, and F.
// URF's 3 sticker positions are changed by all of R, U, F but NOT by L, D, B.

const changedBy = {};
for (let i = 0; i < 54; i++) changedBy[i] = [];
for (const [m, perm] of Object.entries(CORRECT_PERMS)) {
  for (let i = 0; i < 54; i++) {
    if (perm[i] !== i) changedBy[i].push(m);
  }
}

// Corner sticker positions: positions changed by exactly 2 moves (the two non-primary-face moves)
// Wait: URF stickers are on U, R, F faces. Each sticker is changed by 2 of those 3 face moves.
// U[8] is changed by U (U face rotates) and R (R cross-face moves U right col) and F (F cross-face moves U bottom row).
// Actually U[8] is at position 8 = U face, slot 8 = bottom-right of U face.
// Slot 8 = BR of U face. This is adjacent to both R and F faces.
// Changed by R (U right col), F (U bottom row), and U itself.
// Changed by 3 moves: U, R, F. Makes sense.

// Let me just print all positions and which moves change them:
console.log('Sticker positions changed by exactly R, U, F (URF corner stickers):');
for (let i = 0; i < 54; i++) {
  const moves = changedBy[i].sort();
  if (moves.join('') === 'FRU') {
    console.log(`  ${fn(i)}: changed by ${moves.join(',')}`);
  }
}

console.log('');
console.log('All corner positions (changed by exactly 3 adjacent moves):');
const cornerSets = [
  {name:'URF', moves:'FRU'},
  {name:'URB', moves:'BRU'},
  {name:'ULB', moves:'BLU'},
  {name:'ULF', moves:'FLU'},
  {name:'DRF', moves:'DFR'},
  {name:'DLF', moves:'DFL'},
  {name:'DLB', moves:'BDL'},
  {name:'DRB', moves:'BDR'},
];

for (const {name, moves} of cornerSets) {
  const sorted = moves.split('').sort().join('');
  const positions = [];
  for (let i = 0; i < 54; i++) {
    if (changedBy[i].sort().join('') === sorted) {
      positions.push(fn(i));
    }
  }
  console.log(`  ${name} (${moves}): ${positions.join(', ')}`);
}
