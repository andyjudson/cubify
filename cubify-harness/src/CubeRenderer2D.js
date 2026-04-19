/**
 * CubeRenderer2D — Canvas 2D / SVG top-down view of a 3×3 cube.
 *
 * Shows the U face (3×3) plus the top row of each adjacent side face
 * (F, B, R, L) as strips. Each corner is a single quadrilateral that combines
 * the adjacent strip cell with a diagonal triangle — outer corner → inner corner.
 *
 * update(state, visMap) — draw on a <canvas> element (browser)
 * static toSVG(state, visMap, options) — return SVG string (no DOM, Node.js-safe)
 *
 * Colour and visibility semantics match CubeRenderer3D:
 *   vis 0 = grey (#444)   vis 1 = dim (40% colour over grey)   vis 2 = full colour
 */

import {
  CORNER_ORBIT_TO_CUBELET,
  EDGE_ORBIT_TO_CUBELET,
  CENTER_ORBIT_TO_CUBELET,
} from './CubeStickering.js';

// ---- Colour palette (matches CubeRenderer3D) ----
const FACE_COLOURS = {
  U: '#ffffff',
  R: '#c41e1e',
  F: '#1a7c2a',
  D: '#ffd000',
  L: '#e06000',
  B: '#0f4fad',
  X: '#2a2a2a',
};
const GREY = '#444444';

// Cubelet positions in same order as CubeStickering.js CUBELET_POSITIONS
const CUBELET_POSITIONS = (() => {
  const out = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
})();

const ORBIT_TO_CUBELET = {
  CORNERS: CORNER_ORBIT_TO_CUBELET,
  EDGES:   EDGE_ORBIT_TO_CUBELET,
  CENTERS: CENTER_ORBIT_TO_CUBELET,
};

// ---- Grid cells (13 rectangular cells: 9 U face + 4 middle strip cells) ----
// Corner strip cells are absorbed into CORNER_POLYS below.
const GRID_CELLS = [
  // B strip middle cell only
  { row:0, col:2, face:5, fsi:1, orbit:'EDGES',   slotI:2, visSlot:5 }, // UB edge → B face
  // Row 1 — U top row (no corner strip cells — those are in CORNER_POLYS)
  { row:1, col:1, face:0, fsi:0, orbit:'CORNERS', slotI:2, visSlot:2 }, // U[0]
  { row:1, col:2, face:0, fsi:1, orbit:'EDGES',   slotI:2, visSlot:2 }, // U[1]
  { row:1, col:3, face:0, fsi:2, orbit:'CORNERS', slotI:1, visSlot:2 }, // U[2]
  // Row 2 — L middle + U middle row + R middle
  { row:2, col:0, face:4, fsi:1, orbit:'EDGES',   slotI:3, visSlot:1 }, // UL edge → L face
  { row:2, col:1, face:0, fsi:3, orbit:'EDGES',   slotI:3, visSlot:2 }, // U[3]
  { row:2, col:2, face:0, fsi:4, orbit:'CENTERS', slotI:0, visSlot:2 }, // U[4] center
  { row:2, col:3, face:0, fsi:5, orbit:'EDGES',   slotI:1, visSlot:2 }, // U[5]
  { row:2, col:4, face:1, fsi:1, orbit:'EDGES',   slotI:1, visSlot:0 }, // UR edge → R face
  // Row 3 — U bottom row (no corner strip cells)
  { row:3, col:1, face:0, fsi:6, orbit:'CORNERS', slotI:3, visSlot:2 }, // U[6]
  { row:3, col:2, face:0, fsi:7, orbit:'EDGES',   slotI:0, visSlot:2 }, // U[7]
  { row:3, col:3, face:0, fsi:8, orbit:'CORNERS', slotI:0, visSlot:2 }, // U[8]
  // F strip middle cell only
  { row:4, col:2, face:2, fsi:1, orbit:'EDGES',   slotI:0, visSlot:4 }, // UF edge → F face
];

// ---- Corner polygons (8 quads: each combines a strip corner cell + its diagonal triangle) ----
// Each is a single sticker displayed as a quadrilateral whose diagonal edge runs
// from the outer image corner to the inner U-face corner.
// TL=ULB, TR=URB, BL=ULF, BR=URF
const CORNER_POLYS = [
  { corner:'TL', side:'top',    face:5, fsi:2, orbit:'CORNERS', slotI:2, visSlot:5 }, // ULB → B
  { corner:'TL', side:'left',   face:4, fsi:0, orbit:'CORNERS', slotI:2, visSlot:1 }, // ULB → L
  { corner:'TR', side:'top',    face:5, fsi:0, orbit:'CORNERS', slotI:1, visSlot:5 }, // URB → B
  { corner:'TR', side:'right',  face:1, fsi:2, orbit:'CORNERS', slotI:1, visSlot:0 }, // URB → R
  { corner:'BL', side:'left',   face:4, fsi:2, orbit:'CORNERS', slotI:3, visSlot:1 }, // ULF → L
  { corner:'BL', side:'bottom', face:2, fsi:0, orbit:'CORNERS', slotI:3, visSlot:4 }, // ULF → F
  { corner:'BR', side:'right',  face:1, fsi:0, orbit:'CORNERS', slotI:0, visSlot:0 }, // URF → R
  { corner:'BR', side:'bottom', face:2, fsi:2, orbit:'CORNERS', slotI:0, visSlot:4 }, // URF → F
];

// ---- Geometry ----
const STRIP_RATIO = 0.5;
const GAP = 4;

function computeGeometry(size) {
  const margin = Math.round(size * 0.025);
  const cellSize = (size - 2 * margin) / (3 + 2 * STRIP_RATIO);
  const stripDepth = cellSize * STRIP_RATIO;
  const uX = margin + stripDepth;
  const uY = margin + stripDepth;
  return { margin, stripDepth, cellSize, uX, uY, size };
}

function computeRect(row, col, geo) {
  const { cellSize, stripDepth, uX, uY } = geo;
  let x, w;
  if (col === 0)     { x = uX - stripDepth; w = stripDepth; }
  else if (col <= 3) { x = uX + (col - 1) * cellSize; w = cellSize; }
  else               { x = uX + 3 * cellSize; w = stripDepth; }
  let y, h;
  if (row === 0)     { y = uY - stripDepth; h = stripDepth; }
  else if (row <= 3) { y = uY + (row - 1) * cellSize; h = cellSize; }
  else               { y = uY + 3 * cellSize; h = stripDepth; }
  return { x, y, w, h };
}

// Returns the 4 vertices of the corner quad (strip cell + diagonal triangle merged).
// Each quad has one diagonal edge from the outer image corner to the inner U-face corner.
function computeCornerPoly(corner, side, geo) {
  const { margin, stripDepth, cellSize: cs, uX, uY } = geo;
  const ox = margin, oy = margin;
  const xR = uX + 3 * cs;
  const yB = uY + 3 * cs;
  const oR = xR + stripDepth;
  const oB = yB + stripDepth;

  // Each entry is [[x,y],[x,y],[x,y],[x,y]] in clockwise order.
  // The implied closing edge is the diagonal from inner to outer corner.
  if (corner === 'TL') {
    if (side === 'top')  return [[ox,oy],[uX+cs,oy],[uX+cs,uY],[uX,uY]];   // B: outer-TL → along top → inner diag
    if (side === 'left') return [[ox,oy],[uX,uY],[uX,uY+cs],[ox,uY+cs]];   // L: outer-TL → inner diag → down
  }
  if (corner === 'TR') {
    if (side === 'top')   return [[xR-cs,oy],[oR,oy],[xR,uY],[xR-cs,uY]];  // B: along top → outer-TR → inner diag
    if (side === 'right') return [[oR,oy],[oR,uY+cs],[xR,uY+cs],[xR,uY]];  // R: outer-TR → down → inner diag
  }
  if (corner === 'BL') {
    if (side === 'left')   return [[ox,yB-cs],[uX,yB-cs],[uX,yB],[ox,oB]]; // L: along strip → inner → outer-BL
    if (side === 'bottom') return [[ox,oB],[uX+cs,oB],[uX+cs,yB],[uX,yB]]; // F: outer-BL → along bottom → inner diag
  }
  if (corner === 'BR') {
    if (side === 'right')  return [[xR,yB-cs],[oR,yB-cs],[oR,oB],[xR,yB]]; // R: along strip → outer-BR → inner diag
    if (side === 'bottom') return [[xR-cs,yB],[xR-cs,oB],[oR,oB],[xR,yB]]; // F: inner diag → outer-BR → along bottom
  }
}

// Per-edge inset: offset each edge inward by d, then intersect adjacent offset edges.
// Matches the GAP/2 per-side behaviour of fillRect — gaps are uniform regardless of polygon shape.
function insetPoly(pts, d) {
  const n = pts.length;
  // Determine winding: positive shoelace = CW in screen coords (y-down)
  let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
  const sign = area >= 0 ? 1 : -1;
  const off = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len * d * sign, ny = dx / len * d * sign;
    return { px: p[0] + nx, py: p[1] + ny, qx: q[0] + nx, qy: q[1] + ny };
  });
  // New vertices = intersections of consecutive offset edges
  return off.map((e1, i) => {
    const e2 = off[(i + 1) % n];
    const dx1 = e1.qx - e1.px, dy1 = e1.qy - e1.py;
    const dx2 = e2.qx - e2.px, dy2 = e2.qy - e2.py;
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 1e-9) return [e2.px, e2.py]; // parallel — just use offset point
    const t = ((e2.px - e1.px) * dy2 - (e2.py - e1.py) * dx2) / det;
    return [e1.px + t * dx1, e1.py + t * dy1];
  });
}

// ---- Vis level helpers ----

function getVisLevel(cell, rawPattern, visMap) {
  if (!visMap || visMap.size === 0) return 2;
  const orbitKey = cell.orbit.toLowerCase();
  const orbitData = rawPattern[orbitKey];
  if (!orbitData) return 2;
  const pieceId = orbitData.pieces[cell.slotI];
  const cubeletIdx = ORBIT_TO_CUBELET[cell.orbit][pieceId];
  const hp = CUBELET_POSITIONS[cubeletIdx];
  const key = `${hp.x},${hp.y},${hp.z}`;
  const visArray = visMap.get(key);
  if (!visArray) return 2;
  return visArray[cell.visSlot] ?? 2;
}

function blendColour(faceChar, visLevel) {
  if (visLevel === 0) return GREY;
  const hex = FACE_COLOURS[faceChar] ?? GREY;
  if (visLevel === 2) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gr = parseInt(GREY.slice(1, 3), 16);
  const gg = parseInt(GREY.slice(3, 5), 16);
  const gb = parseInt(GREY.slice(5, 7), 16);
  const mix = (c, gc) => Math.round(c * 0.4 + gc * 0.6).toString(16).padStart(2, '0');
  return `#${mix(r, gr)}${mix(g, gg)}${mix(b, gb)}`;
}

// ---- Canvas draw helpers ----

function drawRect(ctx, rect, colour) {
  const { x, y, w, h } = rect;
  const i = GAP / 2;
  ctx.fillStyle = colour;
  ctx.fillRect(x + i, y + i, w - GAP, h - GAP);
}

function drawPoly(ctx, pts, colour) {
  const p = insetPoly(pts, GAP / 2);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath();
  ctx.fill();
}

// ---- Public class ----

export class CubeRenderer2D {
  /**
   * @param {HTMLElement|null} container  — DOM node to append canvas to (or null if canvas option given)
   * @param {{ size?: number, canvas?: HTMLCanvasElement }} options
   */
  constructor(container, { size = 400, canvas = null, transparent = false } = {}) {
    this._size = size;
    this._geo = computeGeometry(size);
    this._destroyed = false;
    this._transparent = transparent;

    if (canvas) {
      this._canvas = canvas;
      this._ownCanvas = false;
    } else {
      this._canvas = document.createElement('canvas');
      this._canvas.width  = size;
      this._canvas.height = size;
      this._ownCanvas = true;
      if (container) container.appendChild(this._canvas);
    }
    this._ctx = this._canvas.getContext('2d');
  }

  /**
   * Re-render the top-down view with the current cube state and stickering mask.
   * @param {import('./CubeState.js').CubeState} state
   * @param {Map<string, number[]>} visMap — homePos → vis-level[6]; use new Map() for full colour
   */
  update(state, visMap) {
    if (this._destroyed) throw new Error('CubeRenderer2D: update() called after destroy()');
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._size, this._size);

    if (!this._transparent) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, this._size, this._size);
    }

    const faceArray  = state.toFaceArray();
    const rawPattern = state.toRawPattern();

    // In transparent mode: paint dark plastic over all cell areas first so gaps between
    // stickers show as dark borders rather than transparent holes.
    if (this._transparent) {
      ctx.fillStyle = '#111111';
      for (const poly of CORNER_POLYS) {
        const pts = computeCornerPoly(poly.corner, poly.side, this._geo);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        ctx.fill();
      }
      for (const cell of GRID_CELLS) {
        const { x, y, w, h } = computeRect(cell.row, cell.col, this._geo);
        ctx.fillRect(x, y, w, h);
      }
    }

    // Corner quads first — their anti-aliased edges will be covered by the crisp rect edges
    for (const poly of CORNER_POLYS) {
      const colour = blendColour(faceArray[poly.face][poly.fsi], getVisLevel(poly, rawPattern, visMap));
      drawPoly(ctx, computeCornerPoly(poly.corner, poly.side, this._geo), colour);
    }
    for (const cell of GRID_CELLS) {
      const colour = blendColour(faceArray[cell.face][cell.fsi], getVisLevel(cell, rawPattern, visMap));
      drawRect(ctx, computeRect(cell.row, cell.col, this._geo), colour);
    }
  }

  /** Return a PNG data URL of the current canvas contents. */
  toDataURL(type = 'image/png') {
    return this._canvas.toDataURL(type);
  }

  /** Remove the canvas from the DOM. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._ownCanvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
  }

  /**
   * Generate an SVG string representation — no DOM required, Node.js safe.
   * @param {import('./CubeState.js').CubeState} state
   * @param {Map<string, number[]>} visMap
   * @param {{ size?: number }} options
   * @returns {string}
   */
  static toSVG(state, visMap, { size = 400 } = {}) {
    const geo        = computeGeometry(size);
    const faceArray  = state.toFaceArray();
    const rawPattern = state.toRawPattern();

    let content = '';

    for (const cell of GRID_CELLS) {
      const colour = blendColour(faceArray[cell.face][cell.fsi], getVisLevel(cell, rawPattern, visMap));
      const { x, y, w, h } = computeRect(cell.row, cell.col, geo);
      const i = GAP / 2;
      content += `<rect x="${(x + i).toFixed(1)}" y="${(y + i).toFixed(1)}" width="${(w - GAP).toFixed(1)}" height="${(h - GAP).toFixed(1)}" fill="${colour}"/>\n`;
    }

    for (const poly of CORNER_POLYS) {
      const colour = blendColour(faceArray[poly.face][poly.fsi], getVisLevel(poly, rawPattern, visMap));
      const pts = insetPoly(computeCornerPoly(poly.corner, poly.side, geo), GAP / 2);
      const pointsStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      content += `<polygon points="${pointsStr}" fill="${colour}"/>\n`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n`
      + `<rect width="${size}" height="${size}" fill="#111111"/>\n`
      + content
      + `</svg>`;
  }
}
