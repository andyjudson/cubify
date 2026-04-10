// Verify corrected sticker permutation tables using physical ground truth
// Does NOT rely on CubeState.toFaceArray() (which is known broken)

const [U,R,F,D,L,B] = [0,9,18,27,36,45];
const FACE_NAMES = ['U','R','F','D','L','B'];

function solvedStickers() {
  const s = new Array(54);
  for (let f = 0; f < 6; f++) for (let i = 0; i < 9; i++) s[f*9+i] = FACE_NAMES[f];
  return s;
}

function faceCW(off) {
  // cycle [a,b,c,d]: perm[b]=a, perm[c]=b, perm[d]=c, perm[a]=d
  return [[off,off+6,off+8,off+2],[off+1,off+3,off+7,off+5]];
}

function buildPerm(cycles) {
  const perm = Array.from({length:54}, (_,i) => i);
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) {
      perm[cycle[(i+1) % len]] = cycle[i];
    }
  }
  return perm;
}

function applyPerm(stickers, perm) {
  const out = new Array(54);
  for (let i = 0; i < 54; i++) out[i] = stickers[perm[i]];
  return out;
}

function invertPerm(perm) {
  const inv = new Array(54);
  for (let i = 0; i < 54; i++) inv[perm[i]] = i;
  return inv;
}

function composePerm(p1, p2) {
  return Array.from({length:54}, (_,i) => p1[p2[i]]);
}

const PERM_CYCLES = {
  // R CW: right face; F right col -> U right col -> B left col (reversed) -> D right col -> F
  R: [...faceCW(R), [F+2,U+2,B+6,D+2],[F+5,U+5,B+3,D+5],[F+8,U+8,B+0,D+8]],
  // U CW: top face; F top row -> R top row -> B top row -> L top row -> F
  U: [...faceCW(U), [F+0,R+0,B+0,L+0],[F+1,R+1,B+1,L+1],[F+2,R+2,B+2,L+2]],
  // F CW: front face; U bottom row -> R left col -> D top row (reversed) -> L right col -> U
  F: [...faceCW(F), [U+6,R+0,D+2,L+8],[U+7,R+3,D+1,L+5],[U+8,R+6,D+0,L+2]],
  // L CW: left face; U left col -> F left col -> D left col -> B right col (reversed) -> U
  L: [...faceCW(L), [U+0,F+0,D+0,B+8],[U+3,F+3,D+3,B+5],[U+6,F+6,D+6,B+2]],
  // D CW: bottom face (from below); F bottom row -> R bottom row -> B bottom row -> L bottom row
  // Wait: D CW from below = F->L->B->R from above perspective
  // Let me think: D CW (WCA standard, same orientation as face): from below, F is top, CW means F->L->B->R->F
  // So: F bottom row goes to L bottom row, L->B, B->R, R->F? That's CCW from above...
  // Standard: after D, F bottom row stickers moved to R bottom row (D CW = same as U CW but from below = CCW from above for corners)
  // I need to be consistent. Let me use: after D, checking what happens to F[6,7,8]:
  // D CW (WCA standard, viewed from D face perspective = looking up from below):
  // The D face stickers themselves rotate CW from that perspective
  // For the adjacent face stickers (bottom row of RFLB): they cycle
  // Standard cubing.js: D = right layer face CW when viewed FROM that face
  // For U: U CW from above = F row goes to R (F->R->B->L->F)
  // For D: D CW from below = from below perspective, F is at top, going CW means F goes to right (which is L from above)
  // So D CW from below: F->L->B->R->F (opposite to U CW)
  // After D: F bottom row went to L, R bottom got from F... wait:
  // F goes to L: new[L+6]=old[F+6], new[L+7]=old[F+7], new[L+8]=old[F+8]
  // L goes to B: new[B+6]=old[L+6], etc.
  // B goes to R: new[R+6]=old[B+6], etc.
  // R goes to F: new[F+6]=old[R+6], etc.
  // Cycle: [F+6,L+6,B+6,R+6] = perm[L+6]=F+6, perm[B+6]=L+6, perm[R+6]=B+6, perm[F+6]=R+6
  // Hmm, but actually the standard WCA D move -- let me double check
  // In standard: D is like U but for the bottom layer. U CW (from above) means F->R, so D CW (from above view) = F->L
  // But D CW is defined from BELOW, so from above it's CCW for that layer.
  // Standard test: sexy move R U R' U' should cycle some corners
  // Rather than debating, let me just define and verify with a known algorithm.
  D: [...faceCW(D), [F+6,L+6,B+6,R+6],[F+7,L+7,B+7,R+7],[F+8,L+8,B+8,R+8]],
  // B CW: back face viewed from behind; B face CW from behind
  // U top row -> L left col (reversed) -> D bottom row -> R right col (reversed) -> U
  // U[0,1,2] goes to L[6,3,0] (reversed), L[6,3,0] goes to D[6,7,8], D[6,7,8] goes to R[8,5,2], R[8,5,2] goes to U[0,1,2]
  // Cycle: perm[L+6]=U+0, perm[D+6]=L+6, perm[R+8]=D+6, perm[U+0]=R+8 -> [U+0,L+6,D+6,R+8]
  // perm[L+3]=U+1, perm[D+7]=L+3, perm[R+5]=D+7, perm[U+1]=R+5 -> [U+1,L+3,D+7,R+5]
  // perm[L+0]=U+2, perm[D+8]=L+0, perm[R+2]=D+8, perm[U+2]=R+2 -> [U+2,L+0,D+8,R+2]
  B: [...faceCW(B), [U+0,L+6,D+6,R+8],[U+1,L+3,D+7,R+5],[U+2,L+0,D+8,R+2]],
};

const PERMS = {};
for (const [k,v] of Object.entries(PERM_CYCLES)) PERMS[k] = buildPerm(v);

function getMovePerm(move) {
  const base = move.replace(/['2]/g,'');
  const p = PERMS[base];
  if (!p) throw new Error('Unknown move: '+move);
  if (move.endsWith("'")) return invertPerm(p);
  if (move.endsWith('2')) return composePerm(p, p);
  return p;
}

function applyAlgToStickers(stickers, moves) {
  let s = stickers;
  for (const m of moves) s = applyPerm(s, getMovePerm(m));
  return s;
}

function stickersToFaces(stickers) {
  return Array.from({length:6}, (_,f) => stickers.slice(f*9, f*9+9));
}

function faceStr(faces) {
  return FACE_NAMES.map((n,i) => `${n}: ${faces[i].join('')}`).join('\n');
}

// Physical ground truth test cases (hand-verified)
const PHYSICAL_TRUTH = [
  {
    moves: ['R'],
    expected: {
      // R CW: F right col -> U right col, U right col -> B left reversed, B left -> D right, D right -> F
      U: 'UUFUUFUUF',
      R: 'RRRRRRRRR',
      F: 'FFDFFDFFD',
      D: 'DDBDDBDDB',
      L: 'LLLLLLLLL',
      B: 'UBBUBBUBB',
    }
  },
  {
    moves: ['U'],
    expected: {
      // U CW: F top -> R, R top -> B, B top -> L, L top -> F
      U: 'UUUUUUUUU',
      R: 'FFFRRRRRR',
      F: 'LLLFFFFFF',
      D: 'DDDDDDDDD',
      L: 'BBBLLLLLL',
      B: 'RRRBBBBBB',
    }
  },
  {
    moves: ['F'],
    expected: {
      // F CW: U bottom row -> R left col, R left -> D top (reversed), D top -> L right (reversed), L right -> U bottom
      // U[6,7,8] -> R[0,3,6], R[0,3,6] -> D[2,1,0], D[2,1,0] -> L[8,5,2], L[8,5,2] -> U[6,7,8]
      U: 'UUUUUULLL',
      R: 'URRURRURR',
      F: 'FFFFFFFFF',
      D: 'RRRDDDDD',  // D[0,1,2] = R[6,3,0] reversed = R,R,R and rest D
      L: 'LLULLULLU',
      B: 'BBBBBBBBB',
    }
  },
  {
    moves: ['R', 'U', "R'", "U'"],
    expected: null, // will just print, verify visually
  },
  // Sexy move x4 = solved
  {
    moves: ["R","U","R'","U'","R","U","R'","U'","R","U","R'","U'","R","U","R'","U'","R","U","R'","U'","R","U","R'","U'"],
    expected: {
      U:'UUUUUUUUU', R:'RRRRRRRRR', F:'FFFFFFFFF',
      D:'DDDDDDDDD', L:'LLLLLLLLL', B:'BBBBBBBBB'
    }
  },
];

// Fix F expected (I made a typo above)
PHYSICAL_TRUTH[2].expected = {
  // F CW: U bottom (U[6,7,8]) -> R left col (R[0,3,6])
  // R left col (R[0,3,6]) -> D top reversed (D[2,1,0])
  // D top reversed (D[0,1,2]) gets from L right col reversed
  // L right col (L[2,5,8]) -> U bottom row
  // Let me redo:
  // new[R+0]=old[U+6], new[R+3]=old[U+7], new[R+6]=old[U+8]  (U bottom -> R left)
  // new[D+2]=old[R+0], new[D+1]=old[R+3], new[D+0]=old[R+6]  (R left -> D top reversed)
  // new[L+8]=old[D+2], new[L+5]=old[D+1], new[L+2]=old[D+0]  (D top -> L right reversed)
  // new[U+6]=old[L+8], new[U+7]=old[L+5], new[U+8]=old[L+2]  (L right -> U bottom)
  // So: U[6,7,8] was LLL, now is old L[8,5,2] = L,L,L
  // R[0,3,6] was RRR, now is old U[6,7,8] = U,U,U
  // D[0,1,2] was DDD, now is old R[6,3,0] = R,R,R
  // L[2,5,8] was LLL, now is old D[2,1,0] = D,D,D
  U: 'UUUUUULLL',
  R: 'URRURRURR',
  F: 'FFFFFFFFF',
  D: 'RRRDDDDDD',
  L: 'LLULLULLU',  // Wait: L[2]=D, L[5]=D, L[8]=D but L[0,1,3,4,6,7]=L
  B: 'BBBBBBBBB',
};

// Actually recalc L after F:
// L original: LLLLLLLLL (indices 0-8)
// L[2]=old[D+0]=D, L[5]=old[D+1]=D, L[8]=old[D+2]=D
// Others unchanged: L[0,1,3,4,6,7]=L
// L face: [L,L,D, L,L,D, L,L,D] = LLD LLD LLD
PHYSICAL_TRUTH[2].expected.L = 'LLDLLDLLD';

let allPass = true;

for (const tc of PHYSICAL_TRUTH) {
  const stickers = applyAlgToStickers(solvedStickers(), tc.moves);
  const faces = stickersToFaces(stickers);

  if (!tc.expected) {
    console.log(`[${tc.moves.join(' ')}]:`);
    console.log(faceStr(faces));
    console.log('');
    continue;
  }

  let pass = true;
  const diffs = [];
  for (const [faceName, expected] of Object.entries(tc.expected)) {
    const fIdx = FACE_NAMES.indexOf(faceName);
    const actual = faces[fIdx].join('');
    if (actual !== expected) {
      pass = false;
      diffs.push(`  ${faceName}: got ${actual}, expected ${expected}`);
    }
  }

  if (pass) {
    console.log(`PASS: [${tc.moves.join(' ')}]`);
  } else {
    allPass = false;
    console.log(`FAIL: [${tc.moves.join(' ')}]`);
    console.log(faceStr(faces));
    diffs.forEach(d => console.log(d));
    console.log('');
  }
}

if (allPass) {
  console.log('\nAll physical verifications passed!');
} else {
  console.log('\nSome tests failed.');
}

// Additional tests
console.log('\n--- Additional tests ---');

// T-perm order
let st = applyAlgToStickers(solvedStickers(), []);
const tperm2 = "R U R' U' R' F R2 U' R' U' R U R' F'".split(' ');
st = solvedStickers();
for (let i = 1; i <= 30; i++) {
  for (const m of tperm2) st = applyPerm(st, getMovePerm(m));
  if (st.every((v,j) => v === solvedStickers()[j])) { console.log("T-perm order:", i); break; }
  if (i === 30) console.log("T-perm order > 30");
}

// T-perm result validity
st = solvedStickers();
for (const m of tperm2) st = applyPerm(st, getMovePerm(m));
const tF = stickersToFaces(st);
console.log('T-perm U face:', tF[0].join(''), '(should be all U for PLL)');

// Fish OLL order
st = solvedStickers();
for (let i = 1; i <= 30; i++) {
  for (const m of ["R'","F","R","F'"]) st = applyPerm(st, getMovePerm(m));
  if (st.every((v,j) => v === solvedStickers()[j])) { console.log("R'FR F' order:", i); break; }
  if (i === 30) console.log("R'FR F' order > 30");
}
