/**
 * CubeRenderer2D — Canvas 2D / SVG top-down view of a 3×3 cube.
 *
 * update(state, visMap) — draw on a <canvas> element (browser)
 * static toSVG(state, visMap, options) — return SVG string (no DOM, Node.js-safe)
 */

import {
  CORNER_ORBIT_TO_CUBELET,
  EDGE_ORBIT_TO_CUBELET,
  CENTER_ORBIT_TO_CUBELET,
  type VisMap,
} from './CubeStickering.js';
import type { CubeState, RawPattern } from './CubeState.js';
import {
  type CubeTheme, type ThemePresetName,
  DEFAULT_THEME, effectiveColours, getThemePreset, cloneTheme,
} from './CubeTheme.js';

// Cubelet positions (same order as CubeStickering.ts)
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

const ORBIT_TO_CUBELET: Record<string, readonly number[]> = {
  CORNERS: CORNER_ORBIT_TO_CUBELET,
  EDGES:   EDGE_ORBIT_TO_CUBELET,
  CENTERS: CENTER_ORBIT_TO_CUBELET,
};

// ---- Cell / poly definitions ----

type OrbitKey = 'EDGES' | 'CORNERS' | 'CENTERS';

interface Cell {
  row: number; col: number;
  face: number; fsi: number;
  orbit: OrbitKey; slotI: number; visSlot: number;
}

type CornerName = 'TL' | 'TR' | 'BL' | 'BR';
type SideName   = 'top' | 'left' | 'right' | 'bottom';

interface CornerPoly {
  corner: CornerName; side: SideName;
  face: number; fsi: number;
  orbit: OrbitKey; slotI: number; visSlot: number;
}

const GRID_CELLS: Cell[] = [
  { row:0, col:2, face:5, fsi:1, orbit:'EDGES',   slotI:2, visSlot:5 },
  { row:1, col:1, face:0, fsi:0, orbit:'CORNERS', slotI:2, visSlot:2 },
  { row:1, col:2, face:0, fsi:1, orbit:'EDGES',   slotI:2, visSlot:2 },
  { row:1, col:3, face:0, fsi:2, orbit:'CORNERS', slotI:1, visSlot:2 },
  { row:2, col:0, face:4, fsi:1, orbit:'EDGES',   slotI:3, visSlot:1 },
  { row:2, col:1, face:0, fsi:3, orbit:'EDGES',   slotI:3, visSlot:2 },
  { row:2, col:2, face:0, fsi:4, orbit:'CENTERS', slotI:0, visSlot:2 },
  { row:2, col:3, face:0, fsi:5, orbit:'EDGES',   slotI:1, visSlot:2 },
  { row:2, col:4, face:1, fsi:1, orbit:'EDGES',   slotI:1, visSlot:0 },
  { row:3, col:1, face:0, fsi:6, orbit:'CORNERS', slotI:3, visSlot:2 },
  { row:3, col:2, face:0, fsi:7, orbit:'EDGES',   slotI:0, visSlot:2 },
  { row:3, col:3, face:0, fsi:8, orbit:'CORNERS', slotI:0, visSlot:2 },
  { row:4, col:2, face:2, fsi:1, orbit:'EDGES',   slotI:0, visSlot:4 },
];

const CORNER_POLYS: CornerPoly[] = [
  { corner:'TL', side:'top',    face:5, fsi:2, orbit:'CORNERS', slotI:2, visSlot:5 },
  { corner:'TL', side:'left',   face:4, fsi:0, orbit:'CORNERS', slotI:2, visSlot:1 },
  { corner:'TR', side:'top',    face:5, fsi:0, orbit:'CORNERS', slotI:1, visSlot:5 },
  { corner:'TR', side:'right',  face:1, fsi:2, orbit:'CORNERS', slotI:1, visSlot:0 },
  { corner:'BL', side:'left',   face:4, fsi:2, orbit:'CORNERS', slotI:3, visSlot:1 },
  { corner:'BL', side:'bottom', face:2, fsi:0, orbit:'CORNERS', slotI:3, visSlot:4 },
  { corner:'BR', side:'right',  face:1, fsi:0, orbit:'CORNERS', slotI:0, visSlot:0 },
  { corner:'BR', side:'bottom', face:2, fsi:2, orbit:'CORNERS', slotI:0, visSlot:4 },
];

// ---- Geometry ----

const STRIP_RATIO = 0.5;
const GAP = 4;

interface Geo {
  margin: number; stripDepth: number; cellSize: number;
  uX: number; uY: number; size: number;
}

function computeGeometry(size: number): Geo {
  const margin     = Math.round(size * 0.025);
  const cellSize   = (size - 2 * margin) / (3 + 2 * STRIP_RATIO);
  const stripDepth = cellSize * STRIP_RATIO;
  const uX = margin + stripDepth;
  const uY = margin + stripDepth;
  return { margin, stripDepth, cellSize, uX, uY, size };
}

interface Rect { x: number; y: number; w: number; h: number; }

function computeRect(row: number, col: number, geo: Geo): Rect {
  const { cellSize, stripDepth, uX, uY } = geo;
  let x: number, w: number;
  if (col === 0)     { x = uX - stripDepth; w = stripDepth; }
  else if (col <= 3) { x = uX + (col - 1) * cellSize; w = cellSize; }
  else               { x = uX + 3 * cellSize; w = stripDepth; }
  let y: number, h: number;
  if (row === 0)     { y = uY - stripDepth; h = stripDepth; }
  else if (row <= 3) { y = uY + (row - 1) * cellSize; h = cellSize; }
  else               { y = uY + 3 * cellSize; h = stripDepth; }
  return { x, y, w, h };
}

type Point = [number, number];

function computeCornerPoly(corner: CornerName, side: SideName, geo: Geo): Point[] {
  const { margin, stripDepth, cellSize: cs, uX, uY } = geo;
  const ox = margin, oy = margin;
  const xR = uX + 3 * cs;
  const yB = uY + 3 * cs;
  const oR = xR + stripDepth;
  const oB = yB + stripDepth;

  if (corner === 'TL') {
    if (side === 'top')  return [[ox,oy],[uX+cs,oy],[uX+cs,uY],[uX,uY]];
    if (side === 'left') return [[ox,oy],[uX,uY],[uX,uY+cs],[ox,uY+cs]];
  }
  if (corner === 'TR') {
    if (side === 'top')   return [[xR-cs,oy],[oR,oy],[xR,uY],[xR-cs,uY]];
    if (side === 'right') return [[oR,oy],[oR,uY+cs],[xR,uY+cs],[xR,uY]];
  }
  if (corner === 'BL') {
    if (side === 'left')   return [[ox,yB-cs],[uX,yB-cs],[uX,yB],[ox,oB]];
    if (side === 'bottom') return [[ox,oB],[uX+cs,oB],[uX+cs,yB],[uX,yB]];
  }
  if (corner === 'BR') {
    if (side === 'right')  return [[xR,yB-cs],[oR,yB-cs],[oR,oB],[xR,yB]];
    if (side === 'bottom') return [[xR-cs,yB],[xR-cs,oB],[oR,oB],[xR,yB]];
  }
  throw new Error(`Unknown corner/side: ${corner}/${side}`);
}

function insetPoly(pts: Point[], d: number): Point[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  const sign = area >= 0 ? 1 : -1;
  const off = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len * d * sign, ny = dx / len * d * sign;
    return { px: p[0] + nx, py: p[1] + ny, qx: q[0] + nx, qy: q[1] + ny };
  });
  return off.map((e1, i) => {
    const e2 = off[(i + 1) % n];
    const dx1 = e1.qx - e1.px, dy1 = e1.qy - e1.py;
    const dx2 = e2.qx - e2.px, dy2 = e2.qy - e2.py;
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 1e-9) return [e2.px, e2.py] as Point;
    const t = ((e2.px - e1.px) * dy2 - (e2.py - e1.py) * dx2) / det;
    return [e1.px + t * dx1, e1.py + t * dy1] as Point;
  });
}

// ---- Vis level helpers ----

// vis-slot ordering (primary, secondary, tertiary) for each cubing.js corner orbit index.
// Derived from CORNER_POSITIONS in CubeState.ts: face→vis-slot mapping is
// U=2, R=0, F=4, D=3, L=1, B=5.
const CORNER_VIS_SLOTS: readonly [number, number, number][] = [
  [2, 0, 4], // 0: URF
  [2, 5, 0], // 1: URB
  [2, 1, 5], // 2: ULB
  [2, 4, 1], // 3: ULF
  [3, 4, 0], // 4: DRF
  [3, 1, 4], // 5: DLF
  [3, 5, 1], // 6: DLB
  [3, 0, 5], // 7: DRB
];

// vis-slot ordering (primary, secondary) for each cubing.js edge orbit index.
const EDGE_VIS_SLOTS: readonly [number, number][] = [
  [2, 4], // 0: UF
  [2, 0], // 1: UR
  [2, 5], // 2: UB
  [2, 1], // 3: UL
  [3, 4], // 4: DF
  [3, 0], // 5: DR
  [3, 5], // 6: DB
  [3, 1], // 7: DL
  [4, 0], // 8: FR
  [4, 1], // 9: FL
  [5, 0], // 10: BR
  [5, 1], // 11: BL
];

// Determine visibility for a single 2D cell, matching 3D "physical mesh" behaviour.
//
// visMap is built slot-based (null rawPattern): each entry is keyed by the slot's
// natural home position and carries the vis array for that orbit slot's mask char.
//
// For corners/edges we use the piece orientation (from rawPattern) to find which
// home sticker index `h` is currently at visual position `s`, then look up the
// vis level for that home sticker's natural direction — all within the SLOT's home
// data. This correctly shows the primary sticker (yellow) wherever it faces, and
// hides non-primary stickers, matching the 3D renderer's material-travel behaviour.
//
// Centers can't twist so they use a direct slot-based lookup.
function getVisLevel(cell: Cell | CornerPoly, visMap: VisMap | null, rawPattern: RawPattern | null): number {
  if (!visMap || visMap.size === 0) return 2;

  if (cell.orbit === 'CORNERS' && rawPattern) {
    const orientation = rawPattern.corners?.orientation?.[cell.slotI] ?? 0;

    const slotVis = CORNER_VIS_SLOTS[cell.slotI];
    const s = slotVis.indexOf(cell.visSlot);
    if (s < 0) return 2;

    const h = (s - orientation + 3) % 3;
    const homeVisSlot = slotVis[h];

    const cubeletIdx = ORBIT_TO_CUBELET['CORNERS'][cell.slotI];
    const hp         = CUBELET_POSITIONS[cubeletIdx];
    const visArray   = visMap.get(`${hp.x},${hp.y},${hp.z}`);
    return visArray ? (visArray[homeVisSlot] ?? 2) : 2;
  }

  if (cell.orbit === 'EDGES' && rawPattern) {
    const orientation = rawPattern.edges?.orientation?.[cell.slotI] ?? 0;

    const slotVis = EDGE_VIS_SLOTS[cell.slotI];
    const s = slotVis.indexOf(cell.visSlot);
    if (s < 0) return 2;

    const h = (s - orientation + 2) % 2;
    const homeVisSlot = slotVis[h];

    const cubeletIdx = ORBIT_TO_CUBELET['EDGES'][cell.slotI];
    const hp         = CUBELET_POSITIONS[cubeletIdx];
    const visArray   = visMap.get(`${hp.x},${hp.y},${hp.z}`);
    return visArray ? (visArray[homeVisSlot] ?? 2) : 2;
  }

  // Centers (can't twist) and fallback: slot-based lookup.
  const cubeletIdx = ORBIT_TO_CUBELET[cell.orbit][cell.slotI];
  const hp         = CUBELET_POSITIONS[cubeletIdx];
  const visArray   = visMap.get(`${hp.x},${hp.y},${hp.z}`);
  return visArray ? (visArray[cell.visSlot] ?? 2) : 2;
}

function blendColour(faceChar: string, visLevel: number, faceColours: Record<string, string>, plastic: string): string {
  if (visLevel === 0) return '#888888';
  const hex = faceColours[faceChar] ?? plastic;
  if (visLevel === 2) return hex;
  const r  = parseInt(hex.slice(1, 3), 16);
  const g  = parseInt(hex.slice(3, 5), 16);
  const b  = parseInt(hex.slice(5, 7), 16);
  const pr = parseInt(plastic.slice(1, 3), 16);
  const pg = parseInt(plastic.slice(3, 5), 16);
  const pb = parseInt(plastic.slice(5, 7), 16);
  const mix = (c: number, gc: number) => Math.round(c * 0.4 + gc * 0.6).toString(16).padStart(2, '0');
  return `#${mix(r, pr)}${mix(g, pg)}${mix(b, pb)}`;
}

// ---- Canvas draw helpers ----

function drawRect(ctx: CanvasRenderingContext2D, rect: Rect, colour: string): void {
  const { x, y, w, h } = rect;
  const i = GAP / 2;
  ctx.fillStyle = colour;
  ctx.fillRect(x + i, y + i, w - GAP, h - GAP);
}

function drawPoly(ctx: CanvasRenderingContext2D, pts: Point[], colour: string): void {
  const p = insetPoly(pts, GAP / 2);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath();
  ctx.fill();
}

// ---- Public class ----

export interface CubeRenderer2DOptions {
  size?: number;
  canvas?: HTMLCanvasElement | null;
  transparent?: boolean;
  theme?: CubeTheme | ThemePresetName;
}

export class CubeRenderer2D {
  private _size: number;
  private _geo: Geo;
  private _destroyed: boolean;
  private _transparent: boolean;
  private _canvas: HTMLCanvasElement;
  private _ownCanvas: boolean;
  private _ctx: CanvasRenderingContext2D;
  private _theme: CubeTheme;

  constructor(container: HTMLElement | null, { size = 400, canvas = null, transparent = false, theme }: CubeRenderer2DOptions = {}) {
    this._size        = size;
    this._geo         = computeGeometry(size);
    this._destroyed   = false;
    this._transparent = transparent;

    if (typeof theme === 'string') this._theme = getThemePreset(theme);
    else if (theme) this._theme = cloneTheme(theme);
    else this._theme = cloneTheme(DEFAULT_THEME);

    if (canvas) {
      this._canvas    = canvas;
      this._ownCanvas = false;
    } else {
      this._canvas        = document.createElement('canvas');
      this._canvas.width  = size;
      this._canvas.height = size;
      this._ownCanvas     = true;
      if (container) container.appendChild(this._canvas);
    }
    const ctx = this._canvas.getContext('2d');
    if (!ctx) throw new Error('CubeRenderer2D: could not get 2d context');
    this._ctx = ctx;
  }

  get theme(): CubeTheme { return cloneTheme(this._theme); }

  setTheme(theme: CubeTheme | ThemePresetName): void {
    if (typeof theme === 'string') this._theme = getThemePreset(theme);
    else this._theme = cloneTheme(theme);
  }

  update(state: CubeState, visMap: VisMap): void {
    if (this._destroyed) throw new Error('CubeRenderer2D: update() called after destroy()');
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._size, this._size);

    const effColours = effectiveColours(this._theme);
    const plastic    = this._theme.plasticColour;

    if (!this._transparent) {
      ctx.fillStyle = plastic;
      ctx.fillRect(0, 0, this._size, this._size);
    }

    const faceArray   = state.toFaceArray();
    const rawPattern  = state.toRawPattern();

    if (this._transparent) {
      ctx.fillStyle = plastic;
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

    for (const poly of CORNER_POLYS) {
      const colour = blendColour(faceArray[poly.face][poly.fsi], getVisLevel(poly, visMap, rawPattern), effColours, plastic);
      drawPoly(ctx, computeCornerPoly(poly.corner, poly.side, this._geo), colour);
    }
    for (const cell of GRID_CELLS) {
      const colour = blendColour(faceArray[cell.face][cell.fsi], getVisLevel(cell, visMap, rawPattern), effColours, plastic);
      drawRect(ctx, computeRect(cell.row, cell.col, this._geo), colour);
    }
  }

  toDataURL(type = 'image/png'): string {
    return this._canvas.toDataURL(type);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._ownCanvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
  }

  static toSVG(state: CubeState, visMap: VisMap, { size = 400, theme }: { size?: number; theme?: CubeTheme | ThemePresetName } = {}): string {
    const resolvedTheme = typeof theme === 'string' ? getThemePreset(theme)
                        : theme ? cloneTheme(theme)
                        : cloneTheme(DEFAULT_THEME);
    const effColours = effectiveColours(resolvedTheme);
    const plastic    = resolvedTheme.plasticColour;
    const geo        = computeGeometry(size);
    const faceArray  = state.toFaceArray();
    const rawPattern = state.toRawPattern();

    let content = '';

    for (const cell of GRID_CELLS) {
      const colour = blendColour(faceArray[cell.face][cell.fsi], getVisLevel(cell, visMap, rawPattern), effColours, plastic);
      const { x, y, w, h } = computeRect(cell.row, cell.col, geo);
      const i = GAP / 2;
      content += `<rect x="${(x + i).toFixed(1)}" y="${(y + i).toFixed(1)}" width="${(w - GAP).toFixed(1)}" height="${(h - GAP).toFixed(1)}" fill="${colour}"/>\n`;
    }

    for (const poly of CORNER_POLYS) {
      const colour = blendColour(faceArray[poly.face][poly.fsi], getVisLevel(poly, visMap, rawPattern), effColours, plastic);
      const pts = insetPoly(computeCornerPoly(poly.corner, poly.side, geo), GAP / 2);
      const pointsStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      content += `<polygon points="${pointsStr}" fill="${colour}"/>\n`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n`
      + `<rect width="${size}" height="${size}" fill="${plastic}"/>\n`
      + content
      + `</svg>`;
  }
}
