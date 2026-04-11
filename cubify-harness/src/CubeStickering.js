/**
 * CubeStickering — CFOP stickering presets for CubeRenderer3D.
 *
 * forPreset(name) returns a Map<cubeletIndex, boolean[6]> where each boolean
 * indicates whether that slot's sticker is visible.
 *
 * Cubelet index order matches buildCubeletPositions() in CubeRenderer3D.js:
 *   for x of [-1,0,1] / for y of [-1,0,1] / for z of [-1,0,1], skip core.
 *
 * Three.js slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
 */

// Cubelet positions in the same iteration order as CubeRenderer3D._buildCubelets()
const CUBELET_POSITIONS = (() => {
  const out = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
})();

// Slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
function outwardSlots({ x, y, z }) {
  return [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1];
}

export class CubeStickering {
  /**
   * Returns a sticker visibility map for a named CFOP preset.
   *
   * Supported presets:
   *   full         — all stickers visible
   *   oll          — top layer (y=1) all stickers; rest hidden
   *   pll          — top layer (y=1) all stickers; rest hidden (same mask as oll)
   *   f2l          — bottom two layers (y≤0) all stickers; top hidden
   *   cross        — D-face sticker only on D-center + 4 D-layer edges; rest hidden
   *   oll-edges    — U-face + top-layer edge stickers only (no top corners)
   *   pll-corners  — top-layer corner stickers only (no edges)
   *
   * @param {string} name
   * @returns {Map<number, boolean[]>} cubelet index → slot visibility[6]
   */
  static forPreset(name) {
    const map = new Map();

    CUBELET_POSITIONS.forEach((pos, i) => {
      const outward = outwardSlots(pos);
      let vis;

      switch (name) {
        case 'full':
          vis = outward.slice(); // all outward slots visible
          break;

        case 'oll':
        case 'pll':
          // Top layer only — all outward stickers of y=1 cubelets
          vis = outward.map(isOut => isOut && pos.y === 1);
          break;

        case 'f2l':
          // Bottom two layers — all outward stickers of y≤0 cubelets
          vis = outward.map(isOut => isOut && pos.y <= 0);
          break;

        case 'cross': {
          // D center (0,-1,0) + 4 D-layer edges (one of x,z is 0, the other is 0 too... no)
          // D edges: (±1,-1,0) and (0,-1,±1) — exactly one of |x|,|z| is 1, the other 0
          // D corners: |x|=1 AND |z|=1 → excluded
          const isCrosspiece = pos.y === -1 &&
            !(Math.abs(pos.x) === 1 && Math.abs(pos.z) === 1);
          // Show only the D-face slot (slot 3) on these pieces
          vis = outward.map((isOut, slot) => isOut && isCrosspiece && slot === 3);
          break;
        }

        case 'oll-edges': {
          // U face + top-layer edge stickers; corners hidden (no top-corner stickers shown)
          // Top-layer corners: |x|=1 AND |z|=1 at y=1
          const isTopCorner = pos.y === 1 && Math.abs(pos.x) === 1 && Math.abs(pos.z) === 1;
          vis = outward.map(isOut => isOut && pos.y === 1 && !isTopCorner);
          break;
        }

        case 'pll-corners': {
          // Top-layer corner stickers only
          const isTopCorner = pos.y === 1 && Math.abs(pos.x) === 1 && Math.abs(pos.z) === 1;
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

  /**
   * Return all supported preset names.
   * @returns {string[]}
   */
  static presetNames() {
    return ['full', 'oll', 'pll', 'f2l', 'cross', 'oll-edges', 'pll-corners'];
  }
}
