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
 * visMap values use this same index as world-face booleans: vis[2]=true means show U-facing sticker.
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
   * Char semantics:
   *   '-' → show all outward-facing slots on this piece
   *   'I' → hide all slots (grey plastic)
   *   'O' → show U/D-face sticker only (slot 2 for U-layer, slot 3 for D-layer)
   *
   * @param {string} str  e.g. "EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------"
   * @returns {Map<string, boolean[]>}  "x,y,z" grid position → boolean[6] slot visibility
   */
  static fromOrbitString(str) {
    return CubeStickering.fromOrbitStringWithState(str, null);
  }

  /**
   * Parse an orbit string with state-aware primary sticker placement.
   *
   * For 'O' (IgnoreNonPrimary) pieces the primary face is determined by the CURRENT SLOT
   * POSITION (where the piece physically is), not the piece's home position. The visMap
   * values are world-face indexed booleans [R,L,U,D,F,B], and applyStickering() uses the
   * mesh quaternion to map each physical slot to its current world face before greying.
   * This correctly tracks stickers through moves (e.g. a D-layer piece rotated up to U-layer
   * via R exposes its F-sticker on U, not its D-sticker).
   *
   * @param {string} str          Orbit string, e.g. "EDGES:OOOO--------,CORNERS:OOOO----,CENTERS:------"
   * @param {Object|null} rawPattern  Result of CubeState.toRawPattern(), or null for solved identity.
   * @returns {Map<string, boolean[]>}  homePos "x,y,z" → world-face boolean[6] (R,L,U,D,F,B)
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

        // currentSlotPos = world position this slot occupies (solved-state position for slot i).
        // Used to determine which world face is "primary" for 'O' — must follow the slot
        // position, not the piece's home, because the piece may have been moved out of its
        // home layer (e.g. a D-layer piece rotated up to a U-layer slot via R).
        const currentSlotPos = CUBELET_POSITIONS[table[i]];

        // World-face index for 'O' primary face: 0=R,1=L,2=U,3=D,4=F,5=B
        // (matches the SLOT_TO_FACE order in CubeRenderer3D so the same index works for both).
        const primaryWorldFaceIdx =
          currentSlotPos.y ===  1 ? 2 :   // U-layer slot → show U-facing sticker
          currentSlotPos.y === -1 ? 3 :   // D-layer slot → show D-facing sticker
          currentSlotPos.z ===  1 ? 4 :   // Equatorial F-side slot (FL/FR)
          currentSlotPos.z === -1 ? 5 : -1; // Equatorial B-side slot (BL/BR)

        // visMap value is world-face indexed booleans [R,L,U,D,F,B].
        // applyStickering() uses the mesh quaternion to map each physical slot to its current
        // world face, then looks up this array — so the mask follows the sticker wherever it
        // physically ends up after animation, not just the home-slot direction.
        const posKey = `${homePos.x},${homePos.y},${homePos.z}`;
        map.set(posKey, [0, 1, 2, 3, 4, 5].map(faceIdx => {
          if (ch === '-') return true;
          if (ch === 'I') return false;
          if (ch === 'O') return primaryWorldFaceIdx !== -1 && faceIdx === primaryWorldFaceIdx;
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
