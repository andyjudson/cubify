/**
 * CubeRenderer3D — Three.js WebGL renderer for a 3×3×3 Rubik's cube.
 *
 * Cubelet layout: 26 BoxGeometry meshes at grid positions {-1,0,1}³
 * Three.js BoxGeometry slot order: [+X=R, -X=L, +Y=U, -Y=D, +Z=F, -Z=B]
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CubeStickering, MASK_PRESETS, type VisMap } from './CubeStickering.js';
import {
  type CubeTheme, type FaceColours, type ThemePresetName,
  DEFAULT_THEME, effectiveColours, getThemePreset, cloneTheme,
} from './CubeTheme.js';

// ---- Colours ----

const SLOT_TO_FACE = ['R', 'L', 'U', 'D', 'F', 'B'] as const;
type SlotFace = typeof SLOT_TO_FACE[number];

// ---- Sticker texture factory ----

const _textureCache = new Map<string, THREE.CanvasTexture>();
let _maxAnisotropy = 1;

function makeStickerTexture(
  colourHex: string,
  plasticHex: string,
  opacity: number,
  pad: number,
  radius: number,
  isCenterPiece: boolean,
  centerShape: 'square' | 'circle',
): THREE.CanvasTexture {
  const shape = (isCenterPiece && centerShape === 'circle') ? 'circle' : 'rect';
  const key = `${colourHex}|${plasticHex}|${opacity}|${pad}|${radius}|${shape}`;
  if (_textureCache.has(key)) return _textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (opacity < 1) {
    const pr = parseInt(plasticHex.slice(1, 3), 16);
    const pg = parseInt(plasticHex.slice(3, 5), 16);
    const pb = parseInt(plasticHex.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${pr},${pg},${pb},${opacity})`;
  } else {
    ctx.fillStyle = plasticHex;
  }
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = colourHex;
  if (shape === 'circle') {
    const cx = size / 2, cy = size / 2, r = (size / 2) - pad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  } else {
    const x = pad, y = pad, w = size - pad * 2, h = size - pad * 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y,     x + w, y + radius,     radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius,          radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y,     x + radius, y,               radius);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = _maxAnisotropy;
  _textureCache.set(key, tex);
  return tex;
}

function dimHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * 0.5 + 160 * 0.5).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

// ---- Cubelet types ----

interface Vec3 { x: number; y: number; z: number; }

const LOCAL_DIRS: THREE.Vector3[] = [
  new THREE.Vector3( 1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3( 0, 1, 0),
  new THREE.Vector3( 0,-1, 0),
  new THREE.Vector3( 0, 0, 1),
  new THREE.Vector3( 0, 0,-1),
];
const _slotDir = new THREE.Vector3();

interface Cubelet {
  mesh: THREE.Mesh<RoundedBoxGeometry, THREE.Material[]>;
  geometry: RoundedBoxGeometry;
  pos: Vec3;
  homePos: Vec3;
  isOutward: boolean[];
}

// ---- Helpers ----

function buildCubeletPositions(): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
}

function outwardSlots({ x, y, z }: Vec3): boolean[] {
  return [x===1, x===-1, y===1, y===-1, z===1, z===-1];
}

function isCenter({ x, y, z }: Vec3): boolean {
  return Math.abs(x) + Math.abs(y) + Math.abs(z) === 1;
}

// ---- Move axis / filter for animation ----

export interface MoveAxisDef {
  axis: THREE.Vector3;
  dir: number;
  filter: (p: Vec3) => boolean;
}

export const MOVE_AXIS: Record<string, MoveAxisDef> = {
  U: { axis: new THREE.Vector3(0,  1, 0), dir: -1, filter: p => p.y ===  1 },
  D: { axis: new THREE.Vector3(0,  1, 0), dir:  1, filter: p => p.y === -1 },
  R: { axis: new THREE.Vector3(1,  0, 0), dir: -1, filter: p => p.x ===  1 },
  L: { axis: new THREE.Vector3(1,  0, 0), dir:  1, filter: p => p.x === -1 },
  F: { axis: new THREE.Vector3(0,  0, 1), dir: -1, filter: p => p.z ===  1 },
  B: { axis: new THREE.Vector3(0,  0, 1), dir:  1, filter: p => p.z === -1 },
  M: { axis: new THREE.Vector3(1,  0, 0), dir:  1, filter: p => p.x ===  0 },
  E: { axis: new THREE.Vector3(0,  1, 0), dir:  1, filter: p => p.y ===  0 },
  S: { axis: new THREE.Vector3(0,  0, 1), dir: -1, filter: p => p.z ===  0 },
  X: { axis: new THREE.Vector3(1,  0, 0), dir: -1, filter: () => true },
  Y: { axis: new THREE.Vector3(0,  1, 0), dir: -1, filter: () => true },
  Z: { axis: new THREE.Vector3(0,  0, 1), dir: -1, filter: () => true },
};

export interface CubeRenderer3DOptions {
  theme?: CubeTheme | ThemePresetName;
  gap?: number;
  animSpeed?: number;
  debug?: boolean;
  canvas?: HTMLCanvasElement | null;
}

export class CubeRenderer3D {
  private _theme: CubeTheme;
  private _plasticMaterial: THREE.Material;
  private _animSpeed: number;
  private _debug: boolean;
  private _container: HTMLElement | null;
  private _renderer: THREE.WebGLRenderer | null;
  private _scene: THREE.Scene | null;
  private _camera: THREE.PerspectiveCamera | null;
  private _controls: OrbitControls | null;
  private _cubelets: Cubelet[];
  private _ro: ResizeObserver | null;
  private _animFrame: number | null;
  private _animTick: ((now: number) => void) | null;
  private _animating: boolean;
  private _debugLog: string[];
  private _offscreenCanvas: HTMLCanvasElement | null;
  private _activeVisMap: VisMap | null;

  constructor({ theme, gap, animSpeed = 300, debug = false, canvas = null }: CubeRenderer3DOptions = {}) {
    let resolved: CubeTheme;
    if (typeof theme === 'string') resolved = getThemePreset(theme);
    else if (theme) resolved = cloneTheme(theme);
    else resolved = cloneTheme(DEFAULT_THEME);
    if (gap !== undefined) resolved = { ...resolved, gap };
    this._theme = resolved;
    this._plasticMaterial = this._makePlasticMaterial();

    this._animSpeed = animSpeed;
    this._debug    = debug;

    this._container = null;
    this._renderer  = null;
    this._scene     = null;
    this._camera    = null;
    this._controls  = null;
    this._cubelets  = [];
    this._ro        = null;
    this._animFrame = null;
    this._animTick  = null;
    this._animating = false;
    this._debugLog  = [];
    this._offscreenCanvas = canvas ?? null;
    this._activeVisMap    = null;
  }

  // ---- Logging ----

  private _log(msg: string): void {
    const entry = `[cubify] ${msg}`;
    this._debugLog.push(entry);
    if (this._debug) console.log(entry);
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('cubify:log', { detail: entry }));
  }

  // ---- Mount / unmount ----

  mount(container: HTMLElement): void {
    this._container = container;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x141414);

    this._camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this._camera.position.set(5.5, 4.5, 5.5);
    this._camera.lookAt(0, 0, 0);

    this._scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(6, 10, 6);
    this._scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-5, -2, -4);
    this._scene.add(fill);

    const rendererOpts: THREE.WebGLRendererParameters = { antialias: true, alpha: true, preserveDrawingBuffer: true };
    if (this._offscreenCanvas) rendererOpts.canvas = this._offscreenCanvas;
    this._renderer = new THREE.WebGLRenderer(rendererOpts);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _maxAnisotropy = this._renderer.capabilities.getMaxAnisotropy();
    if (!this._offscreenCanvas) container.appendChild(this._renderer.domElement);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping  = true;
    this._controls.enablePan      = false;
    this._controls.dampingFactor  = 0.08;
    this._controls.minDistance    = 9;
    this._controls.maxDistance    = 12;
    this._controls.minPolarAngle  = Math.PI * 0.25;
    this._controls.maxPolarAngle  = Math.PI * 0.75;
    this._controls.target.set(0, 0, 0);

    this._buildCubelets();
    this._startLoop();

    const { width, height } = container.getBoundingClientRect();
    if (width > 0 && height > 0) {
      this._resize(width, height);
      this._log(`mount: ${Math.round(width)}×${Math.round(height)}`);
    } else {
      this._log('mount: waiting for ResizeObserver');
    }

    this._ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        this._resize(width, height);
        this._log(`resize: ${Math.round(width)}×${Math.round(height)}`);
      }
    });
    this._ro.observe(container);
  }

  unmount(): void {
    this._stopLoop();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._controls) { this._controls.dispose(); this._controls = null; }
    if (this._renderer) {
      this._renderer.domElement.parentNode?.removeChild(this._renderer.domElement);
      this._renderer.dispose();
      this._renderer = null;
    }
    this._cubelets = [];
    this._scene    = null;
    this._camera   = null;
    this._log('unmounted');
  }

  // ---- Render loop ----

  private _startLoop(): void {
    const loop = (now: number) => {
      this._animFrame = requestAnimationFrame(loop);
      if (this._controls) this._controls.update();
      if (this._animTick) this._animTick(now);
      this._renderer?.render(this._scene!, this._camera!);
    };
    loop(performance.now());
  }

  private _stopLoop(): void {
    if (this._animFrame !== null) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  _resize(w: number, h: number): void {
    this._renderer!.setSize(w, h);
    this._camera!.aspect = w / h;
    this._camera!.updateProjectionMatrix();
  }

  // ---- Material factories ----

  private _makePlasticMaterial(): THREE.Material {
    const { plasticColour, plasticOpacity, materialType, roughness, metalness } = this._theme;
    const colorInt = parseInt(plasticColour.slice(1), 16);
    const transparent = plasticOpacity < 1;
    if (materialType === 'standard') {
      return new THREE.MeshStandardMaterial({ color: colorInt, roughness, metalness, transparent, opacity: plasticOpacity });
    }
    return new THREE.MeshBasicMaterial({ color: colorInt, transparent, opacity: plasticOpacity });
  }

  private _makeStickerMaterial(colourHex: string, isCenterPiece: boolean): THREE.Material {
    const { plasticColour, plasticOpacity, stickerPad, stickerRadius, centerShape, materialType, roughness, metalness } = this._theme;
    const tex = makeStickerTexture(colourHex, plasticColour, plasticOpacity, stickerPad, stickerRadius, isCenterPiece, centerShape);
    const transparent = plasticOpacity < 1;
    if (materialType === 'standard') {
      return new THREE.MeshStandardMaterial({ map: tex, roughness, metalness, transparent });
    }
    return new THREE.MeshBasicMaterial({ map: tex, transparent });
  }

  // ---- Cubelet geometry ----

  private _buildCubelets(): void {
    const positions = buildCubeletPositions();
    const { gap, bevel } = this._theme;
    const size = 1 - gap;
    const effColours = effectiveColours(this._theme);

    for (const pos of positions) {
      const isOutward  = outwardSlots(pos);
      const centerPiece = isCenter(pos);
      const geo = new RoundedBoxGeometry(size, size, size, 2, bevel);

      const materials: THREE.Material[] = SLOT_TO_FACE.map((face, slot) => {
        if (!isOutward[slot]) return this._plasticMaterial;
        return this._makeStickerMaterial(effColours[face], centerPiece);
      });

      const mesh = new THREE.Mesh(geo, materials) as THREE.Mesh<RoundedBoxGeometry, THREE.Material[]>;
      mesh.position.set(pos.x, pos.y, pos.z);
      this._scene!.add(mesh);
      this._cubelets.push({ mesh, geometry: geo, pos: { ...pos }, homePos: { ...pos }, isOutward });
    }
    this._log(`built ${this._cubelets.length} cubelets`);
  }

  // ---- State ----

  resetToSolved(): void {
    this._activeVisMap = null;
    for (const cubelet of this._cubelets) {
      const { mesh, homePos } = cubelet;
      mesh.position.set(homePos.x, homePos.y, homePos.z);
      mesh.quaternion.identity();
      cubelet.pos       = { ...homePos };
      cubelet.isOutward = outwardSlots(homePos);
    }
    this.restoreColours();
    this._log('resetToSolved');
  }

  restoreColours(): void {
    const effColours = effectiveColours(this._theme);
    const { plasticColour, plasticOpacity, stickerPad, stickerRadius, centerShape } = this._theme;
    for (const cubelet of this._cubelets) {
      const { mesh, homePos } = cubelet;
      const homeOut = outwardSlots(homePos);
      const centerPiece = isCenter(homePos);
      for (let slot = 0; slot < 6; slot++) {
        if (!homeOut[slot]) continue;
        const face = SLOT_TO_FACE[slot];
        const tex = makeStickerTexture(
          effColours[face], plasticColour, plasticOpacity,
          stickerPad, stickerRadius, centerPiece, centerShape,
        );
        const mat = mesh.material[slot] as THREE.MeshBasicMaterial;
        if (mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      }
    }
  }

  applyMovesInstant(moves: string[]): void {
    for (const move of moves) {
      const base = move.replace(/'|2/g, '');
      const mod  = move.endsWith("'") ? -1 : move.endsWith('2') ? 2 : 1;
      const def  = MOVE_AXIS[base.toUpperCase()];
      if (!def) continue;

      const totalAngle = (Math.PI / 2) * def.dir * mod;
      const axis = def.axis.clone().normalize();
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, totalAngle);
      const mat4 = new THREE.Matrix4().makeRotationFromQuaternion(quat);

      const moving = this._cubelets.filter(c => def.filter(c.pos));
      for (const { mesh } of moving) {
        mesh.applyMatrix4(mat4);
        mesh.position.x = Math.round(mesh.position.x);
        mesh.position.y = Math.round(mesh.position.y);
        mesh.position.z = Math.round(mesh.position.z);
      }
      this._updateCubeletMetadata();
    }
    this._log(`applyMovesInstant: ${moves.length} moves`);
  }

  // ---- Orientation ----

  applyOrientation(move: string): void {
    const base = move.replace(/'|2/g, '');
    const mod  = move.endsWith("'") ? -1 : move.endsWith('2') ? 2 : 1;
    const def  = MOVE_AXIS[base.toUpperCase()];
    if (!def) return;

    const angle = (Math.PI / 2) * def.dir * mod;
    const quat  = new THREE.Quaternion().setFromAxisAngle(def.axis, angle);
    const mat4  = new THREE.Matrix4().makeRotationFromQuaternion(quat);

    for (const cubelet of this._cubelets) {
      cubelet.mesh.position.applyMatrix4(mat4);
      cubelet.mesh.position.x = Math.round(cubelet.mesh.position.x);
      cubelet.mesh.position.y = Math.round(cubelet.mesh.position.y);
      cubelet.mesh.position.z = Math.round(cubelet.mesh.position.z);
      cubelet.mesh.quaternion.premultiply(quat);
    }
    this._updateCubeletMetadata();
    this._log(`applyOrientation: ${move}`);
  }

  // ---- Animated move ----

  animateMove(move: string, onDone?: () => void): void {
    if (this._animating) {
      onDone?.();
      return;
    }

    const base = move.replace(/'|2/g, '');
    const mod  = move.endsWith("'") ? -1 : move.endsWith('2') ? 2 : 1;
    const def  = MOVE_AXIS[base.toUpperCase()];

    if (!def) {
      onDone?.();
      return;
    }

    const moving     = this._cubelets.filter(c => def.filter(c.pos));
    const totalAngle = (Math.PI / 2) * def.dir * mod;
    const duration   = this._animSpeed * Math.abs(mod);
    const axis       = def.axis.clone().normalize();

    this._animating = true;
    const start = performance.now();

    const pivot = new THREE.Object3D();
    this._scene!.add(pivot);
    for (const { mesh } of moving) {
      this._scene!.remove(mesh);
      pivot.add(mesh);
    }

    this._animTick = (now: number) => {
      const t    = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      pivot.setRotationFromAxisAngle(axis, totalAngle * ease);

      if (t >= 1) {
        this._animTick = null;
        pivot.setRotationFromAxisAngle(axis, totalAngle);
        pivot.updateMatrixWorld();
        for (const { mesh } of moving) {
          pivot.remove(mesh);
          mesh.applyMatrix4(pivot.matrix);
          mesh.position.x = Math.round(mesh.position.x);
          mesh.position.y = Math.round(mesh.position.y);
          mesh.position.z = Math.round(mesh.position.z);
          this._scene!.add(mesh);
        }
        this._scene!.remove(pivot);
        this._updateCubeletMetadata();
        this._animating = false;
        setTimeout(() => onDone?.(), 0);
      }
    };
  }

  private _updateCubeletMetadata(): void {
    for (const cubelet of this._cubelets) {
      const p = cubelet.mesh.position;
      cubelet.pos = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        z: Math.round(p.z),
      };
      cubelet.isOutward = outwardSlots(cubelet.pos);
    }
  }

  animateAlg(moves: string[], onStep: (i: number) => void, onComplete?: () => void, gapMs = 60): void {
    let i = 0;
    const next = () => {
      if (i >= moves.length) { onComplete?.(); return; }
      const move = moves[i++];
      this.animateMove(move, () => {
        onStep?.(i - 1);
        setTimeout(next, gapMs);
      });
    };
    next();
  }

  // ---- Stickering ----

  applyStickering(visibilityMap: VisMap): void {
    this._activeVisMap = visibilityMap;
    const effColours = effectiveColours(this._theme);
    const { plasticColour, plasticOpacity, stickerPad, stickerRadius, centerShape } = this._theme;

    this._cubelets.forEach(({ mesh, homePos }) => {
      const vis = visibilityMap.get(`${homePos.x},${homePos.y},${homePos.z}`);
      if (!vis) return;
      const homeOut = outwardSlots(homePos);
      const centerPiece = isCenter(homePos);
      for (let slot = 0; slot < 6; slot++) {
        if (!homeOut[slot]) continue;
        const level = vis[slot];
        if (level === 2) continue;
        const face = SLOT_TO_FACE[slot];
        const hex  = level === 1 ? dimHex(effColours[face]) : '#888888';
        const tex  = makeStickerTexture(hex, plasticColour, plasticOpacity, stickerPad, stickerRadius, centerPiece, centerShape);
        const mat  = mesh.material[slot] as THREE.MeshBasicMaterial;
        if (mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      }
    });
    this._log('applyStickering');
  }

  getWorldFaceMap(): Map<string, string> {
    const effColours = effectiveColours(this._theme);
    const FACE_BY_EFF_HEX = Object.fromEntries(
      (['U', 'R', 'F', 'D', 'L', 'B'] as const).map(f => [effColours[f], f])
    );
    const result = new Map<string, string>();
    for (const { mesh } of this._cubelets) {
      const wx = Math.round(mesh.position.x);
      const wy = Math.round(mesh.position.y);
      const wz = Math.round(mesh.position.z);
      const outward: string[] = [];
      if (wx ===  1) outward.push('R');
      if (wx === -1) outward.push('L');
      if (wy ===  1) outward.push('U');
      if (wy === -1) outward.push('D');
      if (wz ===  1) outward.push('F');
      if (wz === -1) outward.push('B');

      for (let slot = 0; slot < 6; slot++) {
        _slotDir.copy(LOCAL_DIRS[slot]).applyQuaternion(mesh.quaternion);
        const ax = Math.abs(_slotDir.x), ay = Math.abs(_slotDir.y), az = Math.abs(_slotDir.z);
        let face: string;
        if (ax >= ay && ax >= az) face = _slotDir.x > 0 ? 'R' : 'L';
        else if (ay >= ax && ay >= az) face = _slotDir.y > 0 ? 'U' : 'D';
        else                           face = _slotDir.z > 0 ? 'F' : 'B';
        if (!outward.includes(face)) continue;

        const mat = mesh.material[slot];
        let color: string;
        if (mat === this._plasticMaterial) {
          color = 'plastic';
        } else {
          const entry = [..._textureCache.entries()].find(([, t]) => t === (mat as THREE.MeshBasicMaterial).map);
          const cacheKey = entry?.[0];
          const hex = cacheKey ? cacheKey.split('|')[0] : undefined;
          color = hex ? (FACE_BY_EFF_HEX[hex] ?? hex) : 'unknown';
        }
        result.set(`${wx},${wy},${wz}:${face}`, color);
      }
    }
    return result;
  }

  // ---- Theme ----

  get theme(): CubeTheme { return cloneTheme(this._theme); }

  setTheme(theme: CubeTheme | ThemePresetName): void {
    if (this._animating) this.abortAnimation();

    const prev = this._theme;
    const next = typeof theme === 'string' ? getThemePreset(theme) : cloneTheme(theme);
    this._theme = next;

    // Dispose all cached textures — they'll be rebuilt with new theme params
    for (const [, tex] of _textureCache) tex.dispose();
    _textureCache.clear();

    const geoChanged          = prev.gap !== next.gap || prev.bevel !== next.bevel;
    const materialTypeChanged = prev.materialType !== next.materialType;
    const plasticChanged      = prev.plasticColour !== next.plasticColour ||
                                prev.plasticOpacity !== next.plasticOpacity;

    if (plasticChanged || materialTypeChanged) {
      const oldPlastic = this._plasticMaterial;
      this._plasticMaterial = this._makePlasticMaterial();
      for (const cubelet of this._cubelets) {
        const homeOut = outwardSlots(cubelet.homePos);
        for (let slot = 0; slot < 6; slot++) {
          if (!homeOut[slot]) cubelet.mesh.material[slot] = this._plasticMaterial;
        }
      }
      oldPlastic.dispose();
    }

    if (geoChanged) {
      const { gap, bevel } = next;
      const size = 1 - gap;
      for (const cubelet of this._cubelets) {
        const oldGeo = cubelet.geometry;
        const geo = new RoundedBoxGeometry(size, size, size, 2, bevel);
        cubelet.mesh.geometry = geo;
        cubelet.geometry = geo;
        oldGeo.dispose();
      }
    }

    if (materialTypeChanged) {
      const effColours = effectiveColours(this._theme);
      for (const cubelet of this._cubelets) {
        const homeOut = outwardSlots(cubelet.homePos);
        const centerPiece = isCenter(cubelet.homePos);
        for (let slot = 0; slot < 6; slot++) {
          if (!homeOut[slot]) continue;
          const face = SLOT_TO_FACE[slot];
          const oldMat = cubelet.mesh.material[slot] as THREE.MeshBasicMaterial;
          cubelet.mesh.material[slot] = this._makeStickerMaterial(effColours[face], centerPiece);
          oldMat.dispose();
        }
      }
    }

    this.restoreColours();
    if (this._activeVisMap) this.applyStickering(this._activeVisMap);
    this._log('setTheme');
  }

  // ---- Camera ----

  resetCamera(): void {
    this._camera!.position.set(5.5, 4.5, 5.5);
    this._camera!.lookAt(0, 0, 0);
    this._controls?.reset();
  }

  setSpeed(ms: number): void { this._animSpeed = ms; }

  setStickering(presetOrString: string): void {
    const preset = MASK_PRESETS.find(p => p.label === presetOrString);
    const str    = preset ? preset.str : presetOrString;
    const visMap = CubeStickering.fromOrbitStringWithState(str, null);
    this.restoreColours();
    this.applyStickering(visMap);
  }

  snapshotAt(size?: number): string {
    const renderer = this._renderer!;
    const origRatio = renderer.getPixelRatio();
    const origCssW  = renderer.domElement.clientWidth  || renderer.domElement.width  / origRatio;
    const origCssH  = renderer.domElement.clientHeight || renderer.domElement.height / origRatio;
    const origBg    = this._scene!.background;

    this._scene!.background = null;
    if (size) {
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);
    }
    renderer.render(this._scene!, this._camera!);
    const url = renderer.domElement.toDataURL('image/png');

    this._scene!.background = origBg;
    if (size) {
      renderer.setPixelRatio(origRatio);
      renderer.setSize(origCssW, origCssH, false);
    }
    return url;
  }

  abortAnimation(): void {
    if (!this._animating || !this._animTick) return;
    this._animTick(Infinity); // force t=1 — completes the move instantly, calls onDone via setTimeout
  }

  get isAnimating(): boolean { return this._animating; }

  getDebugLog(): string { return this._debugLog.join('\n'); }
}
