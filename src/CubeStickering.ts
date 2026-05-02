/**
 * CubeStickering — CFOP stickering presets for CubeRenderer3D.
 *
 * Cubelet index order matches buildCubeletPositions() in CubeRenderer3D:
 *   for x of [-1,0,1] / for y of [-1,0,1] / for z of [-1,0,1], skip core (0,0,0).
 *
 * Three.js slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
 * visMap values are number[6]: 0=hidden (grey), 1=dim (faded colour), 2=full colour.
 */

import type { RawPattern } from './CubeState.js';

export type VisMap = Map<string, number[]>;

export interface MaskPreset {
  group: string;
  label: string;
  str: string;
}

// -- Static orbit-to-cubelet lookup tables ---------------------------------

export const CORNER_ORBIT_TO_CUBELET: readonly number[] = [25, 23, 6, 8, 19, 2, 0, 17];
export const EDGE_ORBIT_TO_CUBELET:   readonly number[] = [16, 24, 14, 7, 11, 18, 9, 1, 22, 5, 20, 3];
export const CENTER_ORBIT_TO_CUBELET: readonly number[] = [15, 21, 13, 4, 12, 10];

// -- Cubelet geometry -------------------------------------------------------

interface CubeletPos { x: number; y: number; z: number; }

const CUBELET_POSITIONS: CubeletPos[] = (() => {
  const out: CubeletPos[] = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
})();

function outwardSlots({ x, y, z }: CubeletPos): boolean[] {
  return [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1];
}

// Piece type helpers
const isTopLayer    = (p: CubeletPos) => p.y ===  1;
const isMiddleLayer = (p: CubeletPos) => p.y ===  0;
const isCorner      = (p: CubeletPos) => Math.abs(p.x) === 1 && Math.abs(p.z) === 1;
const isCenter      = (p: CubeletPos) => (p.x === 0 && p.z === 0) || (p.x === 0 && p.y === 0) || (p.z === 0 && p.y === 0);

const U_SLOT = 2;

// -- Orbit string parser ---------------------------------------------------

function parseOrbitString(str: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const segment of str.split(',')) {
    const colon = segment.indexOf(':');
    result[segment.slice(0, colon)] = segment.slice(colon + 1).split('');
  }
  return result;
}

// -- Public API ------------------------------------------------------------

export class CubeStickering {

  static fromOrbitString(str: string): VisMap {
    return CubeStickering.fromOrbitStringWithState(str, null);
  }

  static fromOrbitStringWithState(str: string, rawPattern: RawPattern | null): VisMap {
    const orbits = parseOrbitString(str);
    const map: VisMap = new Map();

    const orbitDefs = [
      { key: 'CORNERS', table: CORNER_ORBIT_TO_CUBELET,
        pieces: rawPattern?.corners?.pieces ?? null },
      { key: 'EDGES',   table: EDGE_ORBIT_TO_CUBELET,
        pieces: rawPattern?.edges?.pieces ?? null },
      { key: 'CENTERS', table: CENTER_ORBIT_TO_CUBELET,
        pieces: rawPattern?.centers?.pieces ?? null },
    ] as const;

    for (const { key, table, pieces } of orbitDefs) {
      const chars = orbits[key];
      if (!chars) continue;
      for (let i = 0; i < table.length; i++) {
        const ch = chars[i];
        const j = pieces ? pieces[i] : i;
        const homePos = CUBELET_POSITIONS[table[j]];
        const isOut = outwardSlots(homePos);

        const primarySlot =
          homePos.y ===  1 ? 2 :
          homePos.y === -1 ? 3 :
          homePos.z ===  1 ? 4 :
          homePos.z === -1 ? 5 : -1;

        const posKey = `${homePos.x},${homePos.y},${homePos.z}`;
        map.set(posKey, isOut.map((outward, slot) => {
          if (!outward) return 0;
          if (ch === '-') return 2;
          if (ch === 'I') return 0;
          if (ch === 'D') return 1;
          if (ch === 'O') return (primarySlot === -1 || slot === primarySlot) ? 2 : 0;
          if (ch === 'S') return (primarySlot === -1 || slot === primarySlot) ? 2 : 1;
          if (ch === 'P') return (primarySlot === -1 || slot !== primarySlot) ? 2 : 1;
          return 0;
        }));
      }
    }

    return map;
  }

  static forPreset(name: string): Map<number, boolean[]> {
    const map = new Map<number, boolean[]>();

    CUBELET_POSITIONS.forEach((pos, i) => {
      const outward = outwardSlots(pos);
      let vis: boolean[];

      switch (name) {
        case 'full':
          vis = outward.slice();
          break;

        case 'cross': {
          const isUCentre    = pos.x === 0 && pos.y === 1 && pos.z === 0;
          const isTopEdge    = isTopLayer(pos)    && !isCorner(pos) && !isCenter(pos);
          const isMiddleEdge = isMiddleLayer(pos) && !isCenter(pos);
          vis = outward.map((isOut, slot) => {
            if (isUCentre && slot === U_SLOT) return true;
            if (isTopEdge    && isOut) return true;
            if (isMiddleEdge && isOut) return true;
            return false;
          });
          break;
        }

        case 'f2l':
          vis = outward.map(isOut => isOut && !isTopLayer(pos));
          break;

        case 'oll':
        case 'pll':
          vis = outward.map(isOut => isOut && isTopLayer(pos));
          break;

        case 'oll-2look': {
          const isTopEdge = isTopLayer(pos) && !isCorner(pos) && !isCenter(pos);
          vis = outward.map((isOut, slot) => isOut && isTopEdge && slot === U_SLOT);
          break;
        }

        case 'pll-2look': {
          const isTopCorner = isTopLayer(pos) && isCorner(pos);
          vis = outward.map(isOut => isOut && isTopCorner);
          break;
        }

        default:
          vis = outward.slice();
          break;
      }

      map.set(i, vis);
    });

    return map;
  }

  static presetNames(): string[] {
    return ['full', 'cross', 'f2l', 'oll', 'oll-2look', 'pll', 'pll-2look'];
  }
}

export const MASK_PRESETS: MaskPreset[] = [
  { group: 'basic', label: 'full',              str: 'EDGES:------------,CORNERS:--------,CENTERS:------' },
  { group: 'basic', label: 'cross',             str: 'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------' },
  { group: 'basic', label: 'cross-dim',         str: 'EDGES:----DDDDDDDD,CORNERS:DDDDDDDD,CENTERS:------' },
  { group: 'basic', label: 'f2l',               str: 'EDGES:IIII--------,CORNERS:IIII----,CENTERS:------' },
  { group: 'basic', label: 'f2l-dim',           str: 'EDGES:DDDD--------,CORNERS:DDDD----,CENTERS:------' },
  { group: 'oll',   label: 'oll-face',          str: 'EDGES:OOOO--------,CORNERS:OOOO----,CENTERS:------' },
  { group: 'oll',   label: 'oll-face-dim-gry',  str: 'EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD' },
  { group: 'oll',   label: 'oll-face-dim',  str: 'EDGES:SSSSDDDDDDDD,CORNERS:SSSSDDDD,CENTERS:-DDDDD' },
  { group: 'oll',   label: 'oll-cross',         str: 'EDGES:OOOO--------,CORNERS:IIII----,CENTERS:------' },
  { group: 'oll',   label: 'oll-cross-dim',     str: 'EDGES:OOOODDDDDDDD,CORNERS:IIIIDDDD,CENTERS:-DDDDD' },
  { group: 'pll',   label: 'pll-corn',          str: 'EDGES:OOOO--------,CORNERS:--------,CENTERS:------' },
  { group: 'pll',   label: 'pll-corn-dim',      str: 'EDGES:DDDDDDDDDDDD,CORNERS:----DDDD,CENTERS:DDDDDD' },
  { group: 'pll',   label: 'pll-edge-dim',      str: 'EDGES:----DDDDDDDD,CORNERS:DDDDDDDD,CENTERS:-DDDDD' },
  { group: 'pll',   label: 'pll-face',          str: 'EDGES:----DDDDDDDD,CORNERS:----DDDD,CENTERS:-DDDDD' },
  { group: 'pll',   label: 'pll-face-dim',      str: 'EDGES:PPPPDDDDDDDD,CORNERS:PPPPDDDD,CENTERS:DDDDDD' },
];
