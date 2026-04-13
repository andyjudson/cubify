/**
 * CubeStickering — CFOP stickering presets for CubeRenderer3D.
 *
 * forPreset(name) returns a Map<cubeletIndex, boolean[6]> where each boolean
 * indicates whether that slot's sticker is visible (true = coloured, false = hidden/grey).
 *
 * fromOrbitString(str) parses a masks.mjs orbit string into the same map format.
 *
 * Cubelet index order matches buildCubeletPositions() in CubeRenderer3D.js:
 *   for x of [-1,0,1] / for y of [-1,0,1] / for z of [-1,0,1], skip core (0,0,0).
 *
 * Three.js slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
 * Slot 3 (-Y = D face) is the orientation sticker targeted by 'O' after z2 setup.
 */

// -- Static orbit-to-cubelet lookup tables ---------------------------------
// Maps cubing.js KPattern orbit slot index → cubelet array index (0–25)

const CORNER_ORBIT_TO_CUBELET = [25, 23, 6, 8, 19, 2, 0, 17];
// URF=0→25, URB=1→23, ULB=2→6, ULF=3→8, DRF=4→19, DLF=5→2, DLB=6→0, DRB=7→17

const EDGE_ORBIT_TO_CUBELET = [16, 24, 14, 7, 11, 18, 9, 1, 22, 5, 20, 3];
// UF=0→16, UR=1→24, UB=2→14, UL=3→7, DF=4→11, DR=5→18, DB=6→9, DL=7→1
// FR=8→22, FL=9→5, BR=10→20, BL=11→3

const CENTER_ORBIT_TO_CUBELET = [15, 21, 13, 10, 4, 12];
// U=0→15, R=1→21, F=2→13, D=3→10, L=4→4, B=5→12

// -- Cubelet geometry -------------------------------------------------------

const CUBELET_POSITIONS = (() => {
  const out = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
})();

// Returns boolean[6] — true if that face slot is outward-facing for this position
// Slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
function outwardSlots({ x, y, z }) {
  return [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1];
}

// Piece type helpers (used by legacy forPreset geometric logic)
const isTopLayer    = p => p.y ===  1;
const isMiddleLayer = p => p.y ===  0;
const isCorner      = p => Math.abs(p.x) === 1 && Math.abs(p.z) === 1;
const isCenter      = p => (p.x === 0 && p.z === 0) || (p.x === 0 && p.y === 0) || (p.z === 0 && p.y === 0);

// slot 2 = +Y = U face, slot 3 = -Y = D face
const U_SLOT = 2;

// -- Orbit string parser ---------------------------------------------------

/**
 * Parse "EDGES:chars,CORNERS:chars,CENTERS:chars" into orbit char arrays.
 * Segment order is not guaranteed by the format.
 */
function parseOrbitString(str) {
  const result = {};
  for (const segment of str.split(',')) {
    const colon = segment.indexOf(':');
    result[segment.slice(0, colon)] = segment.slice(colon + 1).split('');
  }
  return result;
}

// -- Public API ------------------------------------------------------------

export class CubeStickering {

  /**
   * Parse an orbit string (masks.mjs format) into a visibility map.
   *
   * Char semantics (z2 setup convention — case on D layer after z2):
   *   '-' → show all outward-facing slots on this piece
   *   'I' → hide all slots (grey plastic)
   *   'O' → show D-face sticker only (slot 3, -Y — orientation after z2)
   *
   * @param {string} str  e.g. "EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------"
   * @returns {Map<string, boolean[]>}  "x,y,z" grid position → boolean[6] slot visibility
   */
  static fromOrbitString(str) {
    const orbits = parseOrbitString(str);
    const map = new Map();

    const orbitDefs = [
      { key: 'CORNERS', table: CORNER_ORBIT_TO_CUBELET },
      { key: 'EDGES',   table: EDGE_ORBIT_TO_CUBELET },
      { key: 'CENTERS', table: CENTER_ORBIT_TO_CUBELET },
    ];

    for (const { key, table } of orbitDefs) {
      const chars = orbits[key];
      if (!chars) continue;
      for (let i = 0; i < table.length; i++) {
        const cubeletIdx = table[i];
        const pos = CUBELET_POSITIONS[cubeletIdx];
        const isOut = outwardSlots(pos);
        const ch = chars[i];
        // 'O' = IgnoreNonPrimary: show primary sticker only, grey others.
        // Primary slot is derived from the canonical orbit position (fixed by orbit definition):
        //   +Y (slot 2) for U-layer positions, -Y (slot 3) for D-layer, all for middle.
        const primarySlot = pos.y === 1 ? 2 : pos.y === -1 ? 3 : -1;
        // Key by grid position string — position-based semantics:
        // "show D-face only for whatever piece is currently at DRF" not "for piece #19".
        const posKey = `${pos.x},${pos.y},${pos.z}`;
        map.set(posKey, isOut.map((outward, slot) => {
          if (ch === '-') return outward;
          if (ch === 'I') return false;
          if (ch === 'O') return primarySlot === -1 ? outward : (outward && slot === primarySlot);
          return false;
        }));
      }
    }

    return map;
  }

  /**
   * Legacy geometric preset logic — kept for reference while fromOrbitString is validated.
   * @param {string} name
   * @returns {Map<number, boolean[]>}
   */
  static forPreset(name) {
    const map = new Map();

    CUBELET_POSITIONS.forEach((pos, i) => {
      const outward = outwardSlots(pos);
      let vis;

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

  static presetNames() {
    return ['full', 'cross', 'f2l', 'oll', 'oll-2look', 'pll', 'pll-2look'];
  }
}
