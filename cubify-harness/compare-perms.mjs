// Compare cycle-based and piece-based R permutations to find where they differ
import { cube3x3x3 } from 'cubing/puzzles';
const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

const FACE_NAMES = ['U','R','F','D','L','B'];
const fn = (n) => FACE_NAMES[Math.floor(n/9)] + '[' + (n%9) + ']';

const [U,R,F,D,L,B] = [0,9,18,27,36,45];

// Cycle-based R permutation (verified correct for cross-face stickers)
function faceCW(off) { return [[off,off+2,off+8,off+6],[off+1,off+5,off+7,off+3]]; }
function buildPerm(cycles) {
  const perm = Array.from({length:54}, (_,i) => i);
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) perm[cycle[(i+1)%len]] = cycle[i];
  }
  return perm;
}

const cyclePerm_R = buildPerm([...faceCW(R), [F+2,U+2,B+6,D+2],[F+5,U+5,B+3,D+5],[F+8,U+8,B+0,D+8]]);

// Piece-based R permutation
const CORNER_POS = [
  [[0,8],[1,0],[2,2]], // 0:URF
  [[0,2],[5,0],[1,2]], // 1:URB
  [[0,0],[4,0],[5,2]], // 2:ULB
  [[0,6],[2,0],[4,2]], // 3:ULF
  [[3,2],[1,6],[2,8]], // 4:DRF
  [[3,0],[2,6],[4,8]], // 5:DLF
  [[3,6],[4,6],[5,8]], // 6:DLB
  [[3,8],[5,6],[1,8]], // 7:DRB
];
const EDGE_POS = [
  [[0,7],[2,1]], [[0,5],[1,1]], [[0,1],[5,1]], [[0,3],[4,1]],
  [[3,1],[2,7]], [[3,5],[1,7]], [[3,7],[5,7]], [[3,3],[4,7]],
  [[2,5],[1,3]], [[2,3],[4,5]], [[5,3],[1,5]], [[5,5],[4,3]],
];

function buildMovePerm(moveName, formula='minus') {
  const after = solved.applyMove(moveName);
  const d = after.patternData;
  const perm = Array.from({length:54}, (_,i) => i);
  for (let slot = 0; slot < 8; slot++) {
    const pieceId = d.CORNERS.pieces[slot];
    const orient = d.CORNERS.orientation[slot];
    if (pieceId === slot && orient === 0) continue;
    for (let s = 0; s < 3; s++) {
      const colorIdx = formula === 'minus' ? (s - orient + 3) % 3 : (s + orient) % 3;
      const from = CORNER_POS[pieceId][colorIdx][0]*9 + CORNER_POS[pieceId][colorIdx][1];
      const to = CORNER_POS[slot][s][0]*9 + CORNER_POS[slot][s][1];
      perm[to] = from;
    }
  }
  for (let slot = 0; slot < 12; slot++) {
    const pieceId = d.EDGES.pieces[slot];
    const orient = d.EDGES.orientation[slot];
    if (pieceId === slot && orient === 0) continue;
    for (let s = 0; s < 2; s++) {
      const colorIdx = (s - orient + 2) % 2;
      const from = EDGE_POS[pieceId][colorIdx][0]*9 + EDGE_POS[pieceId][colorIdx][1];
      const to = EDGE_POS[slot][s][0]*9 + EDGE_POS[slot][s][1];
      perm[to] = from;
    }
  }
  return perm;
}

const piecePerm_R_minus = buildMovePerm('R', 'minus');
const piecePerm_R_plus = buildMovePerm('R', 'plus');

console.log('Cycle vs Piece(minus) differences for R:');
for (let i = 0; i < 54; i++) {
  if (cyclePerm_R[i] !== piecePerm_R_minus[i]) {
    console.log(`  ${fn(i)}: cycle=${fn(cyclePerm_R[i])}, piece(minus)=${fn(piecePerm_R_minus[i])}`);
  }
}

console.log('\nCycle vs Piece(plus) differences for R:');
for (let i = 0; i < 54; i++) {
  if (cyclePerm_R[i] !== piecePerm_R_plus[i]) {
    console.log(`  ${fn(i)}: cycle=${fn(cyclePerm_R[i])}, piece(plus)=${fn(piecePerm_R_plus[i])}`);
  }
}

// Which formula gives correct T-perm?
function invertPerm(perm) { const inv = new Array(54); for (let i = 0; i < 54; i++) inv[perm[i]] = i; return inv; }
function composePerm(p1, p2) { return Array.from({length:54}, (_,i) => p1[p2[i]]); }
function applyPerm(stickers, perm) { return Array.from({length:54}, (_,i) => stickers[perm[i]]); }

function getMovePermFn(formula) {
  const base = {};
  for (const m of ['R','U','F','L','D','B']) base[m] = buildMovePerm(m, formula);
  return (move) => {
    const b = move.replace(/['2]/g,'');
    const p = base[b];
    if (move.endsWith("'")) return invertPerm(p);
    if (move.endsWith('2')) return composePerm(p, p);
    return p;
  };
}

const solvedStickers = Array.from({length:54}, (_,i) => FACE_NAMES[Math.floor(i/9)]);

for (const formula of ['minus','plus']) {
  const getMP = getMovePermFn(formula);

  // T-perm order
  let s = [...solvedStickers];
  const tperm = "R U R' U' R' F R2 U' R' U' R U R' F'".split(' ');
  let order = -1;
  for (let i = 1; i <= 30; i++) {
    for (const m of tperm) s = applyPerm(s, getMP(m));
    if (s.every((v,j) => v === solvedStickers[j])) { order = i; break; }
  }

  // R physical check
  const afterR = applyPerm(solvedStickers, getMP('R'));
  const uRightCol = [afterR[2], afterR[5], afterR[8]].join('');

  // U physical check
  const afterU = applyPerm(solvedStickers, getMP('U'));
  const rTopRow = [afterU[9], afterU[10], afterU[11]].join('');

  console.log(`\nFormula (${formula}):`);
  console.log(`  T-perm order: ${order}`);
  console.log(`  After R: U[2,5,8]=${uRightCol} (expected FFF)`);
  console.log(`  After U: R[0,1,2]=${rTopRow} (expected FFF)`);
}
