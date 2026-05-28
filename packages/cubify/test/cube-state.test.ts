/**
 * CubeState unit tests — encodes ground truth from cube-mapping-lessons.md
 *
 * Face order: U=0, R=1, F=2, D=3, L=4, B=5
 * Sticker slot layout per face (reading order): 0=TL 1=TM 2=TR 3=ML 4=CTR 5=MR 6=BL 7=BM 8=BR
 *
 * Key invariants from reference docs:
 *   - cubing.js U = WCA U' (direction flipped; lessons §5, §10)
 *   - Corner slot 0 = URF (lessons §1)
 *   - Orientation formula: (s - o + 3) % 3 (lessons §3)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CubeState } from '../src/CubeState.ts';

const SUNE     = "R U R' U R U2 R'";
const TPERM    = "R U R' U' R' F R2 U' R' U' R U R' F'";
const SEXY     = "R U R' U'";
const SLEDGE   = "R' F R F'";

let solved: CubeState;

beforeAll(async () => {
  solved = await CubeState.solved();
});

// ── toFaceArray() ground truth ────────────────────────────────────────────────

describe('toFaceArray — solved state', () => {
  it('each face is a single colour', () => {
    const faces = solved.toFaceArray();
    expect(faces[0].every(s => s === 'U')).toBe(true); // U
    expect(faces[1].every(s => s === 'R')).toBe(true); // R
    expect(faces[2].every(s => s === 'F')).toBe(true); // F
    expect(faces[3].every(s => s === 'D')).toBe(true); // D
    expect(faces[4].every(s => s === 'L')).toBe(true); // L
    expect(faces[5].every(s => s === 'B')).toBe(true); // B
  });

  it('all 54 stickers are non-X', () => {
    const faces = solved.toFaceArray();
    expect(faces.flat().every(s => s !== 'X')).toBe(true);
  });
});

describe('toFaceArray — after R (lessons §4)', () => {
  it('U right column = F,F,F', () => {
    // lessons §4: after R, the F right column travels to U right column
    const faces = solved.applyAlg('R').toFaceArray();
    expect(faces[0][2]).toBe('F'); // U[2]
    expect(faces[0][5]).toBe('F'); // U[5]
    expect(faces[0][8]).toBe('F'); // U[8]
  });
});

describe('toFaceArray — after cubing.js U (lessons §5)', () => {
  it('L top row = F,F,F — cubing.js U is WCA U\' so front moves left', () => {
    // cubing.js U = WCA U': top layer rotates CCW (F→L, L→B, B→R, R→F)
    // So after cubing.js U, L[0,1,2] gets what was on F[0,1,2] = F,F,F
    const faces = solved.applyAlg('U').toFaceArray();
    expect(faces[4][0]).toBe('F'); // L[0]
    expect(faces[4][1]).toBe('F'); // L[1]
    expect(faces[4][2]).toBe('F'); // L[2]
  });
});

describe('toFaceArray — multi-move algs', () => {
  it('T-perm × 2 = solved', () => {
    const tperm2 = `${TPERM} ${TPERM}`;
    expect(solved.applyAlg(tperm2).isSolved()).toBe(true);
  });

  it('T-perm U face = all U — PLL does not twist corners', () => {
    const faces = solved.applyAlg(TPERM).toFaceArray();
    expect(faces[0]).toEqual(Array(9).fill('U'));
  });

  it('Sexy move × 6 = solved (order 6)', () => {
    const alg = Array(6).fill(SEXY).join(' ');
    expect(solved.applyAlg(alg).isSolved()).toBe(true);
  });

  it('Sune × 6 = solved (order 6)', () => {
    const alg = Array(6).fill(SUNE).join(' ');
    expect(solved.applyAlg(alg).isSolved()).toBe(true);
  });

  it('Sledgehammer × 6 = solved (order 6)', () => {
    const alg = Array(6).fill(SLEDGE).join(' ');
    expect(solved.applyAlg(alg).isSolved()).toBe(true);
  });
});

// ── isSolved ─────────────────────────────────────────────────────────────────

describe('isSolved', () => {
  it('solved cube is solved', () => {
    expect(solved.isSolved()).toBe(true);
  });

  it('cube after single R is not solved', () => {
    expect(solved.applyAlg('R').isSolved()).toBe(false);
  });

  it('whole-cube rotation z2 is considered solved — ignorePuzzleOrientation: true', () => {
    // CubeState.isSolved() always uses ignorePuzzleOrientation: true (lessons §14)
    expect(solved.applyAlg('z2').isSolved()).toBe(true);
  });
});

// ── invertAlg round-trip ──────────────────────────────────────────────────────

describe('invertAlg', () => {
  it('applyAlg(alg).applyAlg(inv(alg)) = solved for Sune', () => {
    const moves = SUNE.split(' ');
    const inv = CubeState.invertAlg(moves);
    expect(solved.applyAlg(SUNE).applyAlg(inv.join(' ')).isSolved()).toBe(true);
  });

  it('applyAlg(alg).applyAlg(inv(alg)) = solved for T-perm', () => {
    const moves = TPERM.split(' ');
    const inv = CubeState.invertAlg(moves);
    expect(solved.applyAlg(TPERM).applyAlg(inv.join(' ')).isSolved()).toBe(true);
  });

  it('invertAlg(["R","U","R\'"]) = ["R","U\'","R\'"]', () => {
    // Reverse then invert each: ["R'","U","R"] → ["R","U'","R'"]
    expect(CubeState.invertAlg(["R","U","R'"])).toEqual(["R","U'","R'"]);
  });

  it('invertAlg of double move stays double', () => {
    expect(CubeState.invertAlg(["R2"])).toEqual(["R2"]);
  });
});

// ── Slot ordering (lessons §1, arch §4) ──────────────────────────────────────

describe('KPattern slot ordering — lessons §1', () => {
  it('solved CORNERS: pieces[0] = 0 (URF at slot 0, NOT ULB)', () => {
    // The documented order was wrong; actual slot 0 = URF (lessons §1)
    const raw = solved.toRawPattern();
    expect(raw.corners.pieces[0]).toBe(0);
  });

  it('solved CORNERS: all pieces[i] === i (identity permutation)', () => {
    const raw = solved.toRawPattern();
    raw.corners.pieces.forEach((p, i) => expect(p).toBe(i));
  });

  it('solved EDGES: all pieces[i] === i (identity permutation)', () => {
    const raw = solved.toRawPattern();
    raw.edges.pieces.forEach((p, i) => expect(p).toBe(i));
  });

  it('solved: all corner orientations = 0', () => {
    const raw = solved.toRawPattern();
    raw.corners.orientation.forEach(o => expect(o).toBe(0));
  });

  it('solved: all edge orientations = 0', () => {
    const raw = solved.toRawPattern();
    raw.edges.orientation.forEach(o => expect(o).toBe(0));
  });

  it('after R: CORNERS slot 0 piece != 0 — URF moves', () => {
    const raw = solved.applyAlg('R').toRawPattern();
    expect(raw.corners.pieces[0]).not.toBe(0);
  });

  it('after L: CORNERS slot 0 piece = 0 — URF unaffected by L', () => {
    const raw = solved.applyAlg('L').toRawPattern();
    expect(raw.corners.pieces[0]).toBe(0);
  });
});

// ── Orientation formula (lessons §3) ─────────────────────────────────────────

describe('Orientation formula — lessons §3', () => {
  it('after R: slot 0 contains DRF piece (piece 4), orientation = 2', () => {
    // WCA/cubing.js R: DRF → URF → URB → DRB → DRF cycle
    // Slot 0 (URF position) gets DRF piece (id=4). Orientation=2 means
    // its primary sticker (D=yellow) faces the F direction (not U).
    const raw = solved.applyAlg('R').toRawPattern();
    expect(raw.corners.pieces[0]).toBe(4);    // DRF piece at URF slot
    expect(raw.corners.orientation[0]).toBe(2);
  });

  it('after R R\': slot 0 orientation restored to 0', () => {
    const raw = solved.applyAlg("R R'").toRawPattern();
    expect(raw.corners.orientation[0]).toBe(0);
  });

  it('correct formula (s - o + 3) % 3: slot 0 U face shows green (DRF piece\'s F sticker)', () => {
    // At URF slot, s=0 = U face. DRF piece colours = ['D','F','R'].
    // Correct: (0 - 2 + 3) % 3 = 1 → colours[1] = 'F' (green) at U[8].
    // Wrong:   (0 + 2) % 3 = 2 → colours[2] = 'R' (red) at U[8] — incorrect.
    const faces = solved.applyAlg('R').toFaceArray();
    expect(faces[0][8]).toBe('F'); // U[8] = green (DRF's F sticker, via correct formula)
  });

  it('wrong formula (s + o) % 3 would give red at U[8] — confirmed wrong', () => {
    // DRF piece, orientation=2, at slot s=0 (U face):
    // wrong:  (0 + 2) % 3 = 2 → colours[2] = 'R' (red) — but actual is green
    // correct: (0 - 2 + 3) % 3 = 1 → colours[1] = 'F' (green) ✓
    const faces = solved.applyAlg('R').toFaceArray();
    expect(faces[0][8]).not.toBe('R'); // wrong formula would give red; correct gives green
  });
});

// ── U/D direction cross-check (lessons §5, §10) ───────────────────────────────

describe('U/D direction — cubing.js vs WCA (lessons §5)', () => {
  it('R,F,L,B moves match WCA physical behaviour — R: F right col → U right col', () => {
    // R, F, L, B are not flipped in cubing.js (lessons §10)
    // Physical: after R, U right col = green (F)
    const faces = solved.applyAlg('R').toFaceArray();
    expect(faces[0][2]).toBe('F'); // U[2] = green after R
  });

  it('cubing.js U moves top layer CCW (F→L convention)', () => {
    // cubing.js U = WCA U': F→L, L→B, B→R, R→F
    const faces = solved.applyAlg('U').toFaceArray();
    expect(faces[4][0]).toBe('F'); // L[0] = green (F moved to L)
    expect(faces[1][0]).toBe('B'); // R[0] = blue (B moved to R)
  });
});

// ── applyAlg ─────────────────────────────────────────────────────────────────

describe('applyAlg', () => {
  it('applies a space-separated move string', () => {
    expect(solved.applyAlg("R U R'").isSolved()).toBe(false);
  });

  it('empty string returns solved', () => {
    expect(solved.applyAlg('').isSolved()).toBe(true);
  });
});
