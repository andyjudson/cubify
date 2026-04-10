// Verify sticker permutation tables for all 6 face moves
// Uses cubing.js as ground truth

import { CubeState } from './src/CubeState.js';

const [U,R,F,D,L,B] = [0,9,18,27,36,45];
const FACE_NAMES = ['U','R','F','D','L','B'];

// 54-element solved sticker array: sticker[i] = face name
function solvedStickers() {
  const s = new Array(54);
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 9; i++) s[f*9+i] = FACE_NAMES[f];
  }
  return s;
}

// faceCW cycles: 4-cycle around face + 4-cycle around inner ring
// cycle [a,b,c,d] means: new[b]=old[a], new[c]=old[b], new[d]=old[c], new[a]=old[d]
function faceCW(off) {
  return [[off,off+6,off+8,off+2],[off+1,off+3,off+7,off+5]];
}

// Build permutation array from cycles
// perm[dst] = src means position dst gets sticker from src
function buildPerm(cycles) {
  const perm = Array.from({length:54}, (_,i) => i); // identity
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) {
      perm[cycle[(i+1) % len]] = cycle[i];
    }
  }
  return perm;
}

// Apply perm to sticker array
function applyPerm(stickers, perm) {
  const out = new Array(54);
  for (let i = 0; i < 54; i++) out[i] = stickers[perm[i]];
  return out;
}

// Apply inverse perm (prime move)
function invertPerm(perm) {
  const inv = new Array(54);
  for (let i = 0; i < 54; i++) inv[perm[i]] = i;
  return inv;
}

// Apply double (square move)
function composePerm(p1, p2) {
  return Array.from({length:54}, (_,i) => p1[p2[i]]);
}

const PERM_CYCLES = {
  R: [...faceCW(R), [U+2,F+2,D+2,B+6],[U+5,F+5,D+5,B+3],[U+8,F+8,D+8,B+0]],
  U: [...faceCW(U), [F+0,R+0,B+0,L+0],[F+1,R+1,B+1,L+1],[F+2,R+2,B+2,L+2]],
  F: [...faceCW(F), [R+0,U+6,L+8,D+2],[R+3,U+7,L+5,D+1],[R+6,U+8,L+2,D+0]],
  L: [...faceCW(L), [F+0,U+0,B+8,D+0],[F+3,U+3,B+5,D+3],[F+6,U+6,B+2,D+6]],
  D: [...faceCW(D), [R+6,F+6,L+6,B+6],[R+7,F+7,L+7,B+7],[R+8,F+8,L+8,B+8]],
  B: [...faceCW(B), [R+2,U+0,L+6,D+8],[R+5,U+1,L+3,D+7],[R+8,U+2,L+0,D+6]],
};

const PERMS = {};
for (const [k,v] of Object.entries(PERM_CYCLES)) PERMS[k] = buildPerm(v);

// Get move perm (handle prime and double)
function getMovePerm(move) {
  const base = move.replace(/['2]/g,'');
  const p = PERMS[base];
  if (!p) throw new Error('Unknown move: '+move);
  if (move.endsWith("'")) return invertPerm(p);
  if (move.endsWith('2')) return composePerm(p, p);
  return p;
}

// Apply alg to sticker array
function applyAlgToStickers(stickers, moves) {
  let s = stickers;
  for (const m of moves) s = applyPerm(s, getMovePerm(m));
  return s;
}

// Get face array from sticker array
function stickersToFaces(stickers) {
  return Array.from({length:6}, (_,f) => stickers.slice(f*9, f*9+9));
}

// Get face array from CubeState
async function getGroundTruth(moves) {
  const base = await CubeState.solved();
  const state = base.applyAlg(moves);
  return state.toFaceArray();
}

// Compare two face arrays
function facesMatch(a, b) {
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 9; i++) {
      if (a[f][i] !== b[f][i]) return false;
    }
  }
  return true;
}

function facesToStr(faces) {
  return FACE_NAMES.map((n,i) => `${n}: ${faces[i].join('')}`).join('\n');
}

// Test cases
const TEST_CASES = [
  ['R'],
  ['U'],
  ['F'],
  ['L'],
  ['D'],
  ['B'],
  ["R'"],
  ["U'"],
  ['R2'],
  ['R','U'],
  ['R','U',"R'","U'"],
  ['R','U',"R'","U'",'R','U',"R'","U'",'R','U',"R'","U'","R'","F","R","F'"], // Sune partial
];

let allPass = true;
const base = await CubeState.solved();

for (const moves of TEST_CASES) {
  const state = base.applyAlg(moves);
  const gt = state.toFaceArray();
  const myStickers = applyAlgToStickers(solvedStickers(), moves);
  const my = stickersToFaces(myStickers);

  const pass = facesMatch(gt, my);
  if (!pass) {
    allPass = false;
    console.log(`FAIL: [${moves.join(' ')}]`);
    console.log('Ground truth:');
    console.log(facesToStr(gt));
    console.log('Mine:');
    console.log(facesToStr(my));
    console.log('---');
  } else {
    console.log(`PASS: [${moves.join(' ')}]`);
  }
}

if (allPass) {
  console.log('\nAll permutations verified!');
} else {
  console.log('\nSome permutations are wrong — see above.');
}
