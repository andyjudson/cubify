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
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { AlgParser } from './AlgParser.js';

// ---- Exported types for consumers (CubeStickering, CubeRenderer2D, CubeExporter) ----

export interface RawOrbitData {
  pieces: number[];
  orientation: number[];
}

export interface RawPattern {
  corners: RawOrbitData;
  edges: RawOrbitData;
  centers: RawOrbitData | null;
}

// Internal type for cubing.js patternData (minimal surface)
interface OrbitData {
  pieces: ArrayLike<number>;
  orientation: ArrayLike<number>;
}
interface PatternData {
  [orbitName: string]: OrbitData | undefined;
}

// KPuzzle — single load, Promise cached to prevent race on parallel callers
let _kpuzzlePromise: Promise<KPuzzle> | null = null;
function getKPuzzle(): Promise<KPuzzle> {
  if (!_kpuzzlePromise) _kpuzzlePromise = cube3x3x3.kpuzzle();
  return _kpuzzlePromise;
}
// Pre-warm on module import so the puzzle is ready before any component mounts
getKPuzzle();

// ---- Piece → sticker colour lookup tables ----
//
// Corner IDs (cubing.js 3x3): 0=URF, 1=URB, 2=ULB, 3=ULF, 4=DRF, 5=DLF, 6=DLB, 7=DRB
// Order per entry: [primary (U/D face), secondary, tertiary]
// Formula: colours[(s - orientation + 3) % 3] for correct sticker mapping.
type SlotPos = [number, number];
const CORNER_POSITIONS: [SlotPos, SlotPos, SlotPos][] = [
  // 0: URF — U[8], R[0], F[2]
  [[0,8],[1,0],[2,2]],
  // 1: URB — U[2], B[0], R[2]
  [[0,2],[5,0],[1,2]],
  // 2: ULB — U[0], L[0], B[2]
  [[0,0],[4,0],[5,2]],
  // 3: ULF — U[6], F[0], L[2]
  [[0,6],[2,0],[4,2]],
  // 4: DRF — D[2], F[8], R[6]
  [[3,2],[2,8],[1,6]],
  // 5: DLF — D[0], L[8], F[6]
  [[3,0],[4,8],[2,6]],
  // 6: DLB — D[6], B[8], L[6]
  [[3,6],[5,8],[4,6]],
  // 7: DRB — D[8], R[8], B[6]
  [[3,8],[1,8],[5,6]],
];

// Edge IDs: 0=UF,1=UR,2=UB,3=UL,4=DF,5=DR,6=DB,7=DL,8=FR,9=FL,10=BR,11=BL
const EDGE_POSITIONS: [SlotPos, SlotPos][] = [
  [[0,7],[2,1]], // 0: UF
  [[0,5],[1,1]], // 1: UR
  [[0,1],[5,1]], // 2: UB
  [[0,3],[4,1]], // 3: UL
  [[3,1],[2,7]], // 4: DF
  [[3,5],[1,7]], // 5: DR
  [[3,7],[5,7]], // 6: DB
  [[3,3],[4,7]], // 7: DL
  [[2,5],[1,3]], // 8: FR
  [[2,3],[4,5]], // 9: FL
  [[5,3],[1,5]], // 10: BR
  [[5,5],[4,3]], // 11: BL
];

const FACE_NAMES = ['U','R','F','D','L','B'] as const;

export class CubeState {
  private _kPattern: KPattern;

  constructor(kPattern: KPattern) {
    this._kPattern = kPattern;
  }

  /** @internal Direct access to the underlying cubing.js KPattern. Not part of the public API. */
  get kPattern(): KPattern { return this._kPattern; }

  /**
   * @internal For solver implementations only — patternData is not typed in cubing.js.
   */
  getPatternData(): unknown { return (this._kPattern as unknown as { patternData: unknown }).patternData; }

  static async solved(): Promise<CubeState> {
    const kpuzzle = await getKPuzzle();
    return new CubeState(kpuzzle.defaultPattern());
  }

  applyMove(move: string): CubeState {
    return new CubeState(this._kPattern.applyMove(move));
  }

  applyAlg(moves: string): CubeState {
    return new CubeState(this._kPattern.applyAlg(moves));
  }

  static async fromAlg(notation: string): Promise<CubeState> {
    const base = await CubeState.solved();
    return base.applyAlg(notation);
  }

  clone(): CubeState {
    return new CubeState(this._kPattern);
  }

  toFaceArray(): string[][] {
    const faces: string[][] = Array.from({length: 6}, () => Array(9).fill('X'));
    const data = this._kPattern.patternData as unknown as PatternData;

    // Centers
    const CENTER_SLOT_TO_FACE_IDX = [0, 1, 2, 4, 5, 3];
    const CENTER_PIECE_TO_FACE    = ['U','R','F','L','B','D'];
    const centersOrbit = data['CENTERS'];
    if (centersOrbit) {
      for (let slot = 0; slot < 6; slot++) {
        const faceIdx  = CENTER_SLOT_TO_FACE_IDX[slot];
        const pieceId  = centersOrbit.pieces[slot];
        faces[faceIdx][4] = CENTER_PIECE_TO_FACE[pieceId] ?? FACE_NAMES[faceIdx];
      }
    } else {
      for (let i = 0; i < 6; i++) faces[i][4] = FACE_NAMES[i];
    }

    const corners = data['CORNERS']!;
    const edges   = data['EDGES']!;

    // Corners
    for (let i = 0; i < 8; i++) {
      const pieceId     = corners.pieces[i];
      const orientation = corners.orientation[i];
      const slots       = CORNER_POSITIONS[i];
      const homeSlots   = CORNER_POSITIONS[pieceId];
      const colours     = homeSlots.map(([f]) => FACE_NAMES[f]);

      for (let s = 0; s < 3; s++) {
        const colourIdx   = (s - orientation + 3) % 3;
        const [face, slot] = slots[s];
        faces[face][slot] = colours[colourIdx];
      }
    }

    // Edges
    for (let i = 0; i < 12; i++) {
      const pieceId     = edges.pieces[i];
      const orientation = edges.orientation[i];
      const slots       = EDGE_POSITIONS[i];
      const homeSlots   = EDGE_POSITIONS[pieceId];
      const colours     = homeSlots.map(([f]) => FACE_NAMES[f]);

      for (let s = 0; s < 2; s++) {
        const colourIdx   = (s - orientation + 2) % 2;
        const [face, slot] = slots[s];
        faces[face][slot] = colours[colourIdx];
      }
    }

    return faces;
  }

  static invertAlg(moves: string[]): string[] {
    return [...moves].reverse().map(m => {
      if (m.endsWith("'")) return m.slice(0, -1);
      if (m.endsWith('2')) return m;
      return m + "'";
    });
  }

  // Build a setup string: rotation (e.g. 'z2') + inverse of alg.
  // Use this when storing cases as { alg, rotation } rather than hardcoding the full setup.
  static setupFromAlg(alg: string, rotation?: string): string {
    const inv = CubeState.invertAlg(AlgParser.parse(alg)).join(' ');
    return rotation ? `${rotation} ${inv}` : inv;
  }

  toRawPattern(): RawPattern {
    const d = this._kPattern.patternData as unknown as PatternData;
    const corners = d['CORNERS']!;
    const edges   = d['EDGES']!;
    const centers = d['CENTERS'] ?? null;
    return {
      corners: { pieces: Array.from(corners.pieces),   orientation: Array.from(corners.orientation) },
      edges:   { pieces: Array.from(edges.pieces),     orientation: Array.from(edges.orientation) },
      centers: centers ? { pieces: Array.from(centers.pieces), orientation: Array.from(centers.orientation) } : null,
    };
  }

  toString(): string {
    const fa = this.toFaceArray();
    return FACE_NAMES.map((n, i) => `${n}: ${fa[i].join('')}`).join('\n');
  }

  isSolved(): boolean {
    return this._kPattern.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
  }
}
