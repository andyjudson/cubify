/**
 * CubeStickering — CFOP stickering presets for CubeRenderer3D.
 *
 * forPreset(name) returns a Map<cubeletIndex, boolean[6]> where each boolean
 * indicates whether that slot's sticker is visible (true = coloured, false = hidden/grey).
 *
 * Cubelet index order matches buildCubeletPositions() in CubeRenderer3D.js:
 *   for x of [-1,0,1] / for y of [-1,0,1] / for z of [-1,0,1], skip core (0,0,0).
 *
 * Three.js slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
 *
 * Presets designed around CFOP stages:
 *   full        — all stickers visible                         (masks.mjs: default)
 *   cross       — D-face stickers on 4 bottom edges only       (masks.mjs: cross)
 *   f2l         — bottom two layers fully visible, top hidden  (masks.mjs: f2l)
 *   oll         — full top layer (1-look OLL)                  (masks.mjs: oll_1look)
 *   oll-2look   — U-face on top edges only, corners hidden     (masks.mjs: oll_2look)
 *   pll         — full top layer (1-look PLL)                  (masks.mjs: pll_1look)
 *   pll-2look   — top corners only, edges hidden               (masks.mjs: pll_2look)
 */

const CUBELET_POSITIONS = (() => {
  const out = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
})();

// Which slots face outward for a given position
function outwardSlots({ x, y, z }) {
  return [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1];
}

// Piece type helpers
const isTopLayer    = p => p.y ===  1;
const isBottomLayer = p => p.y === -1;
const isMiddleLayer = p => p.y ===  0;
const isCorner      = p => Math.abs(p.x) === 1 && Math.abs(p.z) === 1;
const isEdge        = p => !isCorner(p);  // among non-centre cubelets: edge if not corner
const isCenter      = p => (p.x === 0 && p.z === 0) || (p.x === 0 && p.y === 0) || (p.z === 0 && p.y === 0);

// slot 2 = +Y = U face, slot 3 = -Y = D face
const U_SLOT = 2;
const D_SLOT = 3;

export class CubeStickering {
  /**
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
          // White cross: U centre + 4 top edges + 4 middle layer edges (both stickers each)
          const isUCentre    = pos.x === 0 && pos.y === 1 && pos.z === 0;
          const isTopEdge    = isTopLayer(pos)    && !isCorner(pos) && !isCenter(pos);
          const isMiddleEdge = isMiddleLayer(pos) && !isCenter(pos); // FR, FL, BR, BL
          vis = outward.map((isOut, slot) => {
            if (isUCentre && slot === U_SLOT) return true;
            if (isTopEdge    && isOut) return true;
            if (isMiddleEdge && isOut) return true;
            return false;
          });
          break;
        }

        case 'f2l':
          // Bottom two layers fully visible, top layer hidden
          vis = outward.map(isOut => isOut && !isTopLayer(pos));
          break;

        case 'oll':
        case 'pll':
          // Full top layer — all outward stickers on y=1 pieces
          vis = outward.map(isOut => isOut && isTopLayer(pos));
          break;

        case 'oll-2look': {
          // 2-look OLL step 1: U-face on top edges only, corners hidden
          // Matches masks.mjs oll_2look: EDGES:----OOOO----, CORNERS:----IIII
          const isTopEdge = isTopLayer(pos) && !isCorner(pos) && !isCenter(pos);
          vis = outward.map((isOut, slot) => isOut && isTopEdge && slot === U_SLOT);
          break;
        }

        case 'pll-2look': {
          // 2-look PLL step 1: top corners only, top edges hidden
          // Matches masks.mjs pll_2look: EDGES:----OOOO----, CORNERS:--------
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
