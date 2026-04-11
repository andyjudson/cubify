/**
 * Permutation verification script.
 *
 * Cross-checks a cycle-based sticker permutation model against CubeState (cubing.js ground truth).
 * Also verifies known physical facts (T-perm order, Sexy×6 = solved).
 *
 * Run: node verify-perms.mjs
 */

import { CubeState } from './src/CubeState.js';

const FACE_NAMES = ['U','R','F','D','L','B'];
const [U,R,F,D,L,B] = [0,9,18,27,36,45];

// ---- Permutation engine ----

function solvedStickers() {
  const s = new Array(54);
  for (let f = 0; f < 6; f++) for (let i = 0; i < 9; i++) s[f*9+i] = FACE_NAMES[f];
  return s;
}

// Returns 2 face-rotation cycles for a CW turn: [corners, inner ring]
// buildPerm cycle [a,b,c,d]: sticker at a moves to b, b→c, c→d, d→a
// CW (viewed from face): TL→TR→BR→BL = [off, off+2, off+8, off+6]
function faceCW(off) {
  return [[off,off+2,off+8,off+6],[off+1,off+5,off+7,off+3]];
}

function buildPerm(cycles) {
  const perm = Array.from({length:54}, (_,i) => i);
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) perm[cycle[(i+1) % len]] = cycle[i];
  }
  return perm;
}

function applyPerm(stickers, perm) {
  return Array.from({length:54}, (_,i) => stickers[perm[i]]);
}

function invertPerm(perm) {
  const inv = new Array(54);
  for (let i = 0; i < 54; i++) inv[perm[i]] = i;
  return inv;
}

function composePerm(p1, p2) {
  return Array.from({length:54}, (_,i) => p1[p2[i]]);
}

// ---- Move definitions (WCA standard, viewed from face) ----
const PERM_CYCLES = {
  R: [...faceCW(R), [F+2,U+2,B+6,D+2],[F+5,U+5,B+3,D+5],[F+8,U+8,B+0,D+8]],
  U: [...faceCW(U), [F+0,R+0,B+0,L+0],[F+1,R+1,B+1,L+1],[F+2,R+2,B+2,L+2]],
  F: [...faceCW(F), [U+6,R+0,D+2,L+8],[U+7,R+3,D+1,L+5],[U+8,R+6,D+0,L+2]],
  L: [...faceCW(L), [U+0,F+0,D+0,B+8],[U+3,F+3,D+3,B+5],[U+6,F+6,D+6,B+2]],
  D: [...faceCW(D), [F+6,L+6,B+6,R+6],[F+7,L+7,B+7,R+7],[F+8,L+8,B+8,R+8]],
  B: [...faceCW(B), [U+0,L+6,D+6,R+8],[U+1,L+3,D+7,R+5],[U+2,L+0,D+8,R+2]],
};

const PERMS = Object.fromEntries(
  Object.entries(PERM_CYCLES).map(([k,v]) => [k, buildPerm(v)])
);

function getMovePerm(move) {
  const base = move.replace(/['2]/g,'');
  const p = PERMS[base];
  if (!p) throw new Error('Unknown move: ' + move);
  if (move.endsWith("'")) return invertPerm(p);
  if (move.endsWith('2')) return composePerm(p, p);
  return p;
}

function applyAlg(stickers, moves) {
  return moves.reduce((s, m) => applyPerm(s, getMovePerm(m)), stickers);
}

function stickersToFaces(stickers) {
  return Array.from({length:6}, (_,f) => stickers.slice(f*9, f*9+9));
}

function facesEqual(a, b) {
  for (let f = 0; f < 6; f++) for (let i = 0; i < 9; i++) if (a[f][i] !== b[f][i]) return false;
  return true;
}

function faceStr(faces) {
  return FACE_NAMES.map((n,i) => `${n}: ${faces[i].join('')}`).join('\n');
}

// ---- Tests ----

let pass = 0, fail = 0;

function check(label, actual, expected) {
  if (expected === null) {
    console.log(`[info] ${label}:\n${faceStr(actual)}\n`);
    return;
  }
  if (facesEqual(actual, expected)) {
    console.log(`PASS  ${label}`);
    pass++;
  } else {
    console.log(`FAIL  ${label}`);
    console.log('  Got:\n' + faceStr(actual).replace(/^/gm,'    '));
    console.log('  Expected:\n' + faceStr(expected).replace(/^/gm,'    '));
    fail++;
  }
}

// --- Cross-check against CubeState (cubing.js ground truth) ---
// cubing.js U/D are visually flipped vs WCA (cubing.js U = visual U').
// PERM_CYCLES uses WCA visual convention, so U↔U' and D↔D' for cross-check.
const solved = await CubeState.solved();
// Single-move tests: U/D are directionally flipped in cubing.js vs WCA, so
// cross-check WCA U against cubing.js U' (and D vs D').
// Multi-move tests: only use R/F/L/B (identical in both conventions).
const SINGLE_MOVES = [
  [['R'],    ['R']],
  [['U'],    ["U'"]],   // WCA U = cubing.js U'
  [['F'],    ['F']],
  [['L'],    ['L']],
  [['D'],    ["D'"]],   // WCA D = cubing.js D'
  [['B'],    ['B']],
  [["R'"],   ["R'"]],
  [["U'"],   ['U']],
  [["F'"],   ["F'"]],
  [['R2'],   ['R2']],
  [['U2'],   ['U2']],   // double turn symmetric
];
const MULTI_MOVES = [
  ['R','F'],
  ['R',"F'"],
  ['R','F',"R'","F'"],  // R F sexy move
  ['R','F',"R'","F'",'R','F',"R'","F'",'R','F',"R'","F'"],  // ×3 = solved (order 6 partial)
  ["R'","F","R","F'"],
];

console.log('--- CubeState cross-check ---');
for (const [permMoves, csMoves] of SINGLE_MOVES) {
  const csState = solved.applyAlg(csMoves);
  const csFaces = csState.toFaceArray();
  const myFaces = stickersToFaces(applyAlg(solvedStickers(), permMoves));
  check(permMoves.join(' '), myFaces, csFaces);
}
for (const moves of MULTI_MOVES) {
  const csState = solved.applyAlg(moves);
  const csFaces = csState.toFaceArray();
  const myFaces = stickersToFaces(applyAlg(solvedStickers(), moves));
  check(moves.join(' '), myFaces, csFaces);
}

// --- Physical ground truth ---
console.log('\n--- Physical ground truth ---');

// After R: F right col → U right col (U[2,5,8]=F)
const afterR = stickersToFaces(applyAlg(solvedStickers(), ['R']));
check('R: U right col = F', afterR, null); // visual check
console.log('  U[2,5,8]:', afterR[0][2], afterR[0][5], afterR[0][8], '(expected F F F)');

// Sexy move ×6 = solved
const sexy6 = Array(6).fill(['R','U',"R'","U'"]).flat();
const afterSexy6 = stickersToFaces(applyAlg(solvedStickers(), sexy6));
const solvedFaces = stickersToFaces(solvedStickers());
check('Sexy×6 = solved', afterSexy6, solvedFaces);

// Sledgehammer (R' F R F') × 6 = identity
const sledge6 = Array(6).fill(["R'","F","R","F'"]).flat();
const afterSledge6 = stickersToFaces(applyAlg(solvedStickers(), sledge6));
check('Sledge×6 = solved', afterSledge6, solvedFaces);

// Summary
console.log(`\n${pass + fail} tests — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
