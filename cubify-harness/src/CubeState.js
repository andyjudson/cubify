/**
 * CubeState — 3×3×3 cube state using cubing.js KPattern as the source of truth.
 *
 * Move application is fully delegated to cubing.js (battle-tested, WCA-compliant).
 * This module adds:
 *   - A static factory from alg notation
 *   - toFaceArray(): converts KPattern piece/orientation data → 6×9 sticker colour array
 *   - invertAlg() utility
 *
 * Face order (WCA standard): U=0, R=1, F=2, D=3, L=4, B=5
 * Sticker values: 'U'|'R'|'F'|'D'|'L'|'B' (face of origin) | 'X' (hidden)
 *
 * Sticker index layout per face (reading order):
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */

import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

// Lazily initialised KPuzzle
let _kpuzzle = null;
async function getKPuzzle() {
  if (!_kpuzzle) _kpuzzle = await cube3x3x3.kpuzzle();
  return _kpuzzle;
}

// ---- Piece → sticker colour lookup tables ----
//
// cubing.js 3×3 orbit definitions:
//   CORNERS: 8 pieces, 3 orientations
//   EDGES: 12 pieces, 2 orientations
//   CENTERS: 6 pieces, 1 orientation (fixed)
//
// Corner piece IDs and their home positions (solved state):
//   0=URF, 1=URB, 2=ULB, 3=ULF, 4=DRF, 5=DLF, 6=DLB, 7=DRB
//
// For each corner piece, at orientation 0, the sticker colours visible on each face are:
//   [face-slot-on-1st-face, face-slot-on-2nd-face, face-slot-on-3rd-face]
// The face order for each corner follows cubing.js convention.
//
// Corner face slots on the 6×9 grid (positions 0–8 per face):
// Corners are at positions 0,2,6,8 on each face.
//
// Corner positions on cube faces (face index, slot index):
//   ULB corner: U[0], L[2], B[2]   (top-left of U, top-right of L, top-right of B)
//   URB corner: U[2], B[0], R[2]   (top-right of U, top-left of B, top-right of R)
//   URF corner: U[8], R[0], F[2]   (bottom-right of U, top-left of R, top-right of F)
//   ULF corner: U[6], F[0], L[2]... wait, need to be precise.
//
// Let me use face-first notation. For each corner POSITION on the cube:
//   The corner has 3 exposed sticker slots, one per adjacent face.
//   Orientation 0 = U/D sticker is on U/D face.
//
// I'll define CORNER_POSITIONS[piece_id] = [[face0, slot0], [face1, slot1], [face2, slot2]]
// where orientation 0 means the sticker at [face0, slot0] is the piece's primary colour.
//
// Face indices: U=0, R=1, F=2, D=3, L=4, B=5
// Slot indices (0-8, reading order):
//   0 1 2
//   3 4 5
//   6 7 8

// Corner definitions: each corner has 3 faces in order.
// Order: [U/D face, clockwise-next face, clockwise-next face] when viewed from outside.
// Orientation 0 = piece's primary sticker (U/D) is on the U/D face.
// Orientation 1 = rotated CW once, 2 = rotated CW twice.
// Corner position table: [face, slot] pairs for each of the 3 stickers per corner.
// Order: [U/D-face slot, clockwise-next face slot, clockwise-next face slot]
// Orientation 0 = U/D sticker is on U/D face (primary).
//
// Face slot layout (reading order, top-left to bottom-right):
//   0 1 2
//   3 4 5
//   6 7 8
//
// Corner IDs (cubing.js 3x3 actual): 0=URF, 1=URB, 2=ULB, 3=ULF, 4=DRF, 5=DLF, 6=DLB, 7=DRB
// Order per entry: [primary (U/D face), secondary, tertiary]
// Secondary/tertiary ordering verified by brute-force search against cubing.js KPattern orientation convention.
// Formula: colours[(s - orientation + 3) % 3] for correct sticker mapping.
const CORNER_POSITIONS = [
  // 0: URF — U[8], R[0], F[2]
  [[0,8],[1,0],[2,2]],
  // 1: URB — U[2], B[0], R[2]  (B is secondary, not R)
  [[0,2],[5,0],[1,2]],
  // 2: ULB — U[0], L[0], B[2]
  [[0,0],[4,0],[5,2]],
  // 3: ULF — U[6], F[0], L[2]
  [[0,6],[2,0],[4,2]],
  // 4: DRF — D[2], F[8], R[6]  (F is secondary, not R)
  [[3,2],[2,8],[1,6]],
  // 5: DLF — D[0], L[8], F[6]  (L is secondary, not F)
  [[3,0],[4,8],[2,6]],
  // 6: DLB — D[6], B[8], L[6]  (B is secondary, not L)
  [[3,6],[5,8],[4,6]],
  // 7: DRB — D[8], R[8], B[6]
  [[3,8],[1,8],[5,6]],
];

// Edge definitions: each edge has 2 faces.
// Order: [primary face, secondary face]
// Orientation 0 = primary sticker is on its home face.
// cubing.js edge slot ordering: 0=UF,1=UR,2=UB,3=UL,4=DF,5=DR,6=DB,7=DL,8=FR,9=FL,10=BR,11=BL
const EDGE_POSITIONS = [
  // 0: UF — U[7], F[1]
  [[0,7],[2,1]],
  // 1: UR — U[5], R[1]
  [[0,5],[1,1]],
  // 2: UB — U[1], B[1]
  [[0,1],[5,1]],
  // 3: UL — U[3], L[1]
  [[0,3],[4,1]],
  // 4: DF — D[1], F[7]
  [[3,1],[2,7]],
  // 5: DR — D[5], R[7]
  [[3,5],[1,7]],
  // 6: DB — D[7], B[7]
  [[3,7],[5,7]],
  // 7: DL — D[3], L[7]
  [[3,3],[4,7]],
  // 8: FR — F[5], R[3]
  [[2,5],[1,3]],
  // 9: FL — F[3], L[5]
  [[2,3],[4,5]],
  // 10: BR — B[3], R[5]
  [[5,3],[1,5]],
  // 11: BL — B[5], L[3]
  [[5,5],[4,3]],
];

// Center positions: one per face, always centre slot (4).
// Piece 0=U, 1=R, 2=F, 3=D, 4=L, 5=B (solved order, fixed on standard 3×3).
const CENTER_FACES = ['U','R','F','D','L','B'];

// Face name by index
const FACE_NAMES = ['U','R','F','D','L','B'];


export class CubeState {
  /**
   * @param {Object} kPattern — a cubing.js KPattern instance
   */
  constructor(kPattern) {
    this._kPattern = kPattern;
  }

  /**
   * Return a new CubeState in the solved position.
   * @returns {Promise<CubeState>}
   */
  static async solved() {
    const kpuzzle = await getKPuzzle();
    return new CubeState(kpuzzle.defaultPattern());
  }

  /**
   * Apply a single move string. Returns a new CubeState (immutable).
   * @param {string} move — e.g. "R", "U'", "F2"
   * @returns {CubeState}
   */
  applyMove(move) {
    return new CubeState(this._kPattern.applyMove(move));
  }

  /**
   * Apply an array (or space-separated string) of moves. Returns a new CubeState (immutable).
   * @param {string[]|string} moves
   * @returns {CubeState}
   */
  applyAlg(moves) {
    const algStr = Array.isArray(moves) ? moves.join(' ') : moves;
    return new CubeState(this._kPattern.applyAlg(new Alg(algStr)));
  }

  /**
   * Return a new CubeState from an alg notation string.
   * @param {string} notation
   * @returns {Promise<CubeState>}
   */
  static async fromAlg(notation) {
    const base = await CubeState.solved();
    return base.applyAlg(notation);
  }

  /**
   * Return a deep copy of this CubeState.
   * @returns {CubeState}
   */
  clone() {
    return new CubeState(this._kPattern);
  }

  /**
   * Convert this CubeState to a 6×9 face sticker array.
   * faces[faceIndex][stickerIndex] = 'U'|'R'|'F'|'D'|'L'|'B'
   *
   * Face order: U=0, R=1, F=2, D=3, L=4, B=5
   * Sticker layout per face (reading order): 0=TL, 1=TM, 2=TR, 3=ML, 4=CTR, 5=MR, 6=BL, 7=BM, 8=BR
   *
   * @returns {string[][]}
   */
  toFaceArray() {
    const faces = Array.from({length: 6}, () => Array(9).fill('X'));

    // Centers (always match face colour on standard 3×3)
    for (let i = 0; i < 6; i++) {
      faces[i][4] = FACE_NAMES[i];
    }

    const data = this._kPattern.patternData;
    const corners = data['CORNERS'];
    const edges = data['EDGES'];

    // ---- Corners ----
    for (let i = 0; i < 8; i++) {
      const pieceId = corners.pieces[i];   // which piece is in slot i
      const orientation = corners.orientation[i]; // 0, 1, or 2

      // The sticker slots for POSITION i (not pieceId) on the cube faces:
      const slots = CORNER_POSITIONS[i]; // [[face, stickerIdx], [face, stickerIdx], [face, stickerIdx]]

      // The colour at each slot depends on which piece is here and its orientation.
      // pieceId's home faces (from CORNER_POSITIONS[pieceId]) give us the 3 colours.
      const homeSlots = CORNER_POSITIONS[pieceId];
      const colours = homeSlots.map(([f]) => FACE_NAMES[f]); // [primary, secondary, tertiary]

      // orientation 0 = primary colour on primary face, 1 = rotated once (primary on face[1]), 2 = on face[2]
      for (let s = 0; s < 3; s++) {
        const colourIdx = (s - orientation + 3) % 3;
        const [face, slot] = slots[s];
        faces[face][slot] = colours[colourIdx];
      }
    }

    // ---- Edges ----
    for (let i = 0; i < 12; i++) {
      const pieceId = edges.pieces[i];
      const orientation = edges.orientation[i]; // 0 or 1

      const slots = EDGE_POSITIONS[i];
      const homeSlots = EDGE_POSITIONS[pieceId];
      const colours = homeSlots.map(([f]) => FACE_NAMES[f]);

      for (let s = 0; s < 2; s++) {
        const colourIdx = (s - orientation + 2) % 2;
        const [face, slot] = slots[s];
        faces[face][slot] = colours[colourIdx];
      }
    }

    return faces;
  }

  /**
   * Return the inverse of a move array.
   * @param {string[]} moves
   * @returns {string[]}
   */
  static invertAlg(moves) {
    return [...moves].reverse().map(m => {
      if (m.endsWith("'")) return m.slice(0, -1);
      if (m.endsWith('2')) return m;
      return m + "'";
    });
  }

  /**
   * Return the raw KPattern piece/orientation data for debugging.
   * @returns {{ corners: { pieces: number[], orientation: number[] }, edges: { pieces: number[], orientation: number[] } }}
   */
  toRawPattern() {
    const d = this._kPattern.patternData;
    return {
      corners: { pieces: [...d.CORNERS.pieces], orientation: [...d.CORNERS.orientation] },
      edges:   { pieces: [...d.EDGES.pieces],   orientation: [...d.EDGES.orientation]   },
    };
  }

  /**
   * Return a compact human-readable string of the face array.
   * @returns {string}
   */
  toString() {
    const fa = this.toFaceArray();
    return FACE_NAMES.map((n, i) => `${n}: ${fa[i].join('')}`).join('\n');
  }

  /**
   * Check if this state is solved.
   * @returns {boolean}
   */
  isSolved() {
    return this._kPattern.experimentalIsSolved();
  }
}
