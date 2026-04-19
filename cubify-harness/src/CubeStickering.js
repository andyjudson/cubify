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
 * visMap values are number[6]: 0=hidden (grey), 1=dim (faded colour), 2=full colour.
 */

// -- Static orbit-to-cubelet lookup tables ---------------------------------
// Maps cubing.js KPattern orbit slot index → cubelet array index (0–25)

export const CORNER_ORBIT_TO_CUBELET = [25, 23, 6, 8, 19, 2, 0, 17];
// URF=0→25, URB=1→23, ULB=2→6, ULF=3→8, DRF=4→19, DLF=5→2, DLB=6→0, DRB=7→17

export const EDGE_ORBIT_TO_CUBELET = [16, 24, 14, 7, 11, 18, 9, 1, 22, 5, 20, 3];
// UF=0→16, UR=1→24, UB=2→14, UL=3→7, DF=4→11, DR=5→18, DB=6→9, DL=7→1
// FR=8→22, FL=9→5, BR=10→20, BL=11→3

export const CENTER_ORBIT_TO_CUBELET = [15, 21, 13, 4, 12, 10];
// Verified slot ordering: U=0→15, R=1→21, F=2→13, L=3→4, B=4→12, D=5→10
// NOTE: cubing.js CENTERS orbit is NOT in standard face order (URFDLB).
// Actual order: U,R,F,L,B,D — verified by observing piece values after z2.

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
   * Position-based: for 'O' pieces always shows slot 2 (U face) or slot 3 (D face)
   * regardless of the piece's actual orientation. Use fromOrbitStringWithState() to
   * correctly show the primary sticker wherever it physically is on twisted pieces.
   *
   * Char semantics (vis level: 0=hidden, 1=dim, 2=full):
   *   '-' → all outward slots full (2)
   *   'I' → all slots hidden (0)
   *   'D' → all outward slots dim/faded (1)
   *   'O' → primary full (2), others hidden (0)
   *   'S' → primary full (2), others dim (1)
   *   'P' → primary dim (1), others full (2)
   *
   * @param {string} str  e.g. "EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------"
   * @returns {Map<string, boolean[]>}  "x,y,z" grid position → boolean[6] slot visibility
   */
  static fromOrbitString(str) {
    return CubeStickering.fromOrbitStringWithState(str, null);
  }

  /**
   * Parse an orbit string with piece-identity-based primary sticker placement.
   *
   * For 'O' (IgnoreNonPrimary), shows the piece's OWN primary sticker (facelet[0] in
   * cubing.js terms) wherever it physically ends up — e.g. a yellow D-face sticker on a
   * twisted OLL corner shows on a side face, matching TwistyPlayer behaviour. The visMap
   * is keyed by homePos (piece identity) and values are slot-indexed booleans — because
   * both keys and slot indices are mesh-local and never change through moves or rotations.
   *
   * @param {string} str          Orbit string, e.g. "EDGES:OOOO--------,CORNERS:OOOO----,CENTERS:------"
   * @param {Object|null} rawPattern  Result of CubeState.toRawPattern(), or null for solved identity.
   * @returns {Map<string, boolean[]>}  homePos "x,y,z" → slot-indexed boolean[6]
   */
  static fromOrbitStringWithState(str, rawPattern) {
    const orbits = parseOrbitString(str);
    const map = new Map();

    const orbitDefs = [
      { key: 'CORNERS', table: CORNER_ORBIT_TO_CUBELET,
        pieces: rawPattern?.corners?.pieces ?? null },
      { key: 'EDGES',   table: EDGE_ORBIT_TO_CUBELET,
        pieces: rawPattern?.edges?.pieces ?? null },
      { key: 'CENTERS', table: CENTER_ORBIT_TO_CUBELET,
        pieces: rawPattern?.centers?.pieces ?? null },
    ];

    for (const { key, table, pieces } of orbitDefs) {
      const chars = orbits[key];
      if (!chars) continue;
      for (let i = 0; i < table.length; i++) {
        const ch = chars[i];

        // j = piece currently in slot i; homePos = that piece's fixed home position in the scene.
        const j = pieces ? pieces[i] : i;
        const homePos = CUBELET_POSITIONS[table[j]];
        const isOut = outwardSlots(homePos);

        // Primary slot for 'O' (IgnoreNonPrimary): the slot carrying the piece's OWN primary
        // sticker — facelet[0] in cubing.js CubieDef terms. This is always the U-face slot
        // for U-home pieces (slot2) and D-face slot for D-home pieces (slot3), regardless of
        // where the piece currently is or which way it is twisted. When twisted, the yellow
        // sticker travels to a side face but keeps its material — we grey the other slots and
        // let the primary sticker show wherever the mesh quaternion places it.
        // (Equatorial edges: F-side slot4 or B-side slot5.)
        const primarySlot =
          homePos.y ===  1 ? 2 :
          homePos.y === -1 ? 3 :
          homePos.z ===  1 ? 4 :
          homePos.z === -1 ? 5 : -1;

        // vis values: 0=hidden (grey plastic), 1=dim (faded colour), 2=full colour
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
