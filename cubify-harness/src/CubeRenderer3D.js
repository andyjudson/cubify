/**
 * CubeRenderer3D — Three.js WebGL renderer for a 3×3×3 Rubik's cube.
 *
 * Features:
 * - ResizeObserver mount (no IntersectionObserver constraint)
 * - OrbitControls for mouse drag/zoom
 * - Per-face move animation with configurable speed
 * - setState() for instant state changes (non-animated)
 * - animateMove() for animated single-move transitions
 *
 * Cubelet layout: 26 BoxGeometry meshes at grid positions {-1,0,1}³
 * Each face uses a canvas-generated texture: rounded-rect sticker on black plastic.
 * Three.js BoxGeometry slot order: [+X=R, -X=L, +Y=U, -Y=D, +Z=F, -Z=B]
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ---- Colours (hex strings for canvas, hex numbers for Three) ----
const FACE_COLOURS_HEX = {
  U: '#ffffff',
  R: '#c41e1e',
  F: '#1a7c2a',
  D: '#ffd000',
  L: '#e06000',
  B: '#0f4fad',
  X: '#2a2a2a',  // dark grey — hidden/masked stickers (near-black, blends with plastic body by design)
};
// Three.js slot → WCA face name (slot 0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B)
const SLOT_TO_FACE = ['R', 'L', 'U', 'D', 'F', 'B'];

// Dim variants: each face colour blended 50% toward mid-grey (160) — for F2L context display
const FACE_DIM_COLOURS_HEX = Object.fromEntries(
  Object.entries(FACE_COLOURS_HEX).map(([face, hex]) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const mix = (c) => Math.round(c * 0.5 + 160 * 0.5).toString(16).padStart(2, '0');
    return [face, `#${mix(r)}${mix(g)}${mix(b)}`];
  })
);

// ---- Sticker texture factory ----
// Returns a CanvasTexture with a rounded-rect sticker on a black background.
// Cached by colour string so we share textures across cubelets.
const _textureCache = new Map();
let _maxAnisotropy = 1;  // set once renderer is available

function makeStickerTexture(colourHex) {
  if (_textureCache.has(colourHex)) return _textureCache.get(colourHex);

  const size   = 256;
  const pad    = 10;   // black border width
  const radius = 8;    // corner radius — subtle, speed-cube style

  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Dark grey plastic body
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, size, size);

  // Rounded-rect sticker
  const x = pad, y = pad, w = size - pad * 2, h = size - pad * 2;
  ctx.fillStyle = colourHex;
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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = _maxAnisotropy;
  _textureCache.set(colourHex, tex);
  return tex;
}

// Local slot direction vectors — slot 0=+X(R), 1=-X(L), 2=+Y(U), 3=-Y(D), 4=+Z(F), 5=-Z(B)
const LOCAL_DIRS = [
  new THREE.Vector3( 1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3( 0, 1, 0),
  new THREE.Vector3( 0,-1, 0),
  new THREE.Vector3( 0, 0, 1),
  new THREE.Vector3( 0, 0,-1),
];
const _slotDir = new THREE.Vector3(); // reusable scratch vector for quaternion rotation

// Shared solid-black material for all inner (non-outward) faces — no texture, no sticker shape
const BLACK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x141414,
  roughness: 0.9,
  metalness: 0.0,
});

// ---- Cubelet helpers ----

function buildCubeletPositions() {
  const out = [];
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x !== 0 || y !== 0 || z !== 0)
          out.push({ x, y, z });
  return out;
}

function outwardSlots({ x, y, z }) {
  return [x===1, x===-1, y===1, y===-1, z===1, z===-1];
}

// ---- Face rotation axis/filter for animation ----
const MOVE_AXIS = {
  U: { axis: new THREE.Vector3(0,  1, 0), dir: -1, filter: p => p.y ===  1 },
  D: { axis: new THREE.Vector3(0,  1, 0), dir:  1, filter: p => p.y === -1 },
  R: { axis: new THREE.Vector3(1,  0, 0), dir: -1, filter: p => p.x ===  1 },
  L: { axis: new THREE.Vector3(1,  0, 0), dir:  1, filter: p => p.x === -1 },
  F: { axis: new THREE.Vector3(0,  0, 1), dir: -1, filter: p => p.z ===  1 },
  B: { axis: new THREE.Vector3(0,  0, 1), dir:  1, filter: p => p.z === -1 },
  M: { axis: new THREE.Vector3(1,  0, 0), dir:  1, filter: p => p.x ===  0 },
  E: { axis: new THREE.Vector3(0,  1, 0), dir:  1, filter: p => p.y ===  0 },  // follows D (same flip as D)
  S: { axis: new THREE.Vector3(0,  0, 1), dir: -1, filter: p => p.z ===  0 },
  // Whole-cube rotations — all cubelets move
  X: { axis: new THREE.Vector3(1,  0, 0), dir: -1, filter: () => true },
  Y: { axis: new THREE.Vector3(0,  1, 0), dir: -1, filter: () => true },
  Z: { axis: new THREE.Vector3(0,  0, 1), dir: -1, filter: () => true },
};

export class CubeRenderer3D {
  /**
   * @param {object} [options]
   * @param {number}  [options.gap=0.06]        — gap between cubelets (Three.js units)
   * @param {number}  [options.animSpeed=300]   — ms per quarter-turn animation
   * @param {boolean} [options.debug=false]
   */
  constructor({ gap = 0.02, animSpeed = 300, debug = false } = {}) {
    this._gap = gap;
    this._animSpeed = animSpeed;
    this._debug = debug;

    this._container = null;
    this._renderer  = null;
    this._scene     = null;
    this._camera    = null;
    this._controls  = null;
    this._cubelets  = [];   // { mesh, pos, isOutward }
    this._ro        = null;
    this._animFrame = null;
    this._animTick  = null;
    this._animating = false;
    this._debugLog  = [];
  }

  // ---- Logging ----

  _log(msg) {
    const entry = `[cubify] ${msg}`;
    this._debugLog.push(entry);
    if (this._debug) console.log(entry);
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('cubify:log', { detail: entry }));
  }

  // ---- Mount / unmount ----

  mount(container) {
    this._container = container;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x000000);

    this._camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this._camera.position.set(5.5, 4.5, 5.5);
    this._camera.lookAt(0, 0, 0);

    // Lighting — bright ambient so all faces are readable, key light for depth
    this._scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(6, 10, 6);
    this._scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-5, -2, -4);
    this._scene.add(fill);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _maxAnisotropy = this._renderer.capabilities.getMaxAnisotropy();
    container.appendChild(this._renderer.domElement);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.enablePan = false;
    this._controls.dampingFactor = 0.08;
    this._controls.minDistance = 9;
    this._controls.maxDistance = 12;
    // Limit vertical rotation: min ~15° above horizon, max ~75° (no looking straight down)
    this._controls.minPolarAngle = Math.PI * 0.25;  // 45° from top — limits white visibility
    this._controls.maxPolarAngle = Math.PI * 0.75;  // 135° — 45° past horizontal, symmetric with top
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

  unmount() {
    this._stopLoop();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._controls) { this._controls.dispose(); this._controls = null; }
    if (this._renderer) {
      this._renderer.domElement.parentNode?.removeChild(this._renderer.domElement);
      this._renderer.dispose();
      this._renderer = null;
    }
    this._cubelets = [];
    this._scene = null;
    this._camera = null;
    this._log('unmounted');
  }

  // ---- Render loop ----

  _startLoop() {
    const loop = (now) => {
      this._animFrame = requestAnimationFrame(loop);
      if (this._controls) this._controls.update();
      // Drive animation tick from render loop — no separate rAF, no interleaving
      if (this._animTick) this._animTick(now);
      this._renderer?.render(this._scene, this._camera);
    };
    loop(performance.now());
  }

  _stopLoop() {
    if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }
  }

  _resize(w, h) {
    this._renderer.setSize(w, h);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  // ---- Cubelet geometry ----

  _buildCubelets() {
    const positions = buildCubeletPositions();
    const size = 1 - this._gap;
    // Rounded box geometry — slight bevel on cubelet edges
    const geo = new RoundedBoxGeometry(size, size, size, 2, 0.03);

    for (const pos of positions) {
      const isOutward = outwardSlots(pos);

      // Six materials — one per face slot.
      // Outward faces: sticker texture (rounded rect on black).
      // Inner faces: solid black (shared texture).
      const materials = SLOT_TO_FACE.map((face, slot) => {
        if (!isOutward[slot]) return BLACK_MATERIAL;
        return new THREE.MeshBasicMaterial({
          map: makeStickerTexture(FACE_COLOURS_HEX[face]),
        });
      });

      const mesh = new THREE.Mesh(geo, materials);
      mesh.position.set(pos.x, pos.y, pos.z);
      this._scene.add(mesh);
      // homePos: the original grid position — used by setState to reset before repainting
      this._cubelets.push({ mesh, pos: { ...pos }, homePos: { ...pos }, isOutward });
    }
    this._log(`built ${this._cubelets.length} cubelets`);
  }

  // ---- State ----

  /**
   * Reset every cubelet to its home position with identity quaternion and home colours.
   * Call before applyMovesInstant() to establish a known visual baseline.
   */
  resetToSolved() {
    for (const cubelet of this._cubelets) {
      const { mesh, homePos } = cubelet;
      mesh.position.set(homePos.x, homePos.y, homePos.z);
      mesh.quaternion.identity();
      cubelet.pos      = { ...homePos };
      cubelet.isOutward = outwardSlots(homePos);
    }
    this.restoreColours();
    this._log('resetToSolved');
  }

  /**
   * Restore every outward sticker slot to its home colour.
   * Undoes any grey applied by applyStickering without moving pieces.
   * Call after animation completes, before applying a new stickering mask.
   */
  restoreColours() {
    for (const { mesh, homePos } of this._cubelets) {
      const homeOut = outwardSlots(homePos);
      for (let slot = 0; slot < 6; slot++) {
        if (!homeOut[slot]) continue;
        const tex = makeStickerTexture(FACE_COLOURS_HEX[SLOT_TO_FACE[slot]]);
        if (mesh.material[slot].map !== tex) {
          mesh.material[slot].map = tex;
          mesh.material[slot].needsUpdate = true;
        }
      }
    }
  }

  /**
   * Apply moves synchronously using the same physics as animateMove, but with no
   * visual transition. Quaternions and positions are set exactly as they would be
   * after animation completes. Call after resetToSolved() to reach a target state.
   * @param {string[]} moves
   */
  applyMovesInstant(moves) {
    for (const move of moves) {
      const base = move.replace(/'|2/g, '');
      const mod  = move.endsWith("'") ? -1 : move.endsWith('2') ? 2 : 1;
      const def  = MOVE_AXIS[base.toUpperCase()];
      if (!def) continue;

      const totalAngle = (Math.PI / 2) * def.dir * mod;
      const axis = def.axis.clone().normalize();
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, totalAngle);
      const mat4 = new THREE.Matrix4().makeRotationFromQuaternion(quat);

      // Filter on current positions before applying — same logic as animateMove
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

  /**
   * Instantly apply a whole-cube rotation (e.g. 'z2', 'x', "y'").
   * Physically moves all cubelets — no animation. Updates metadata so position-based
   * stickering works correctly after the rotation.
   * Call after setState() to set a display orientation (e.g. z2 for yellow-on-top).
   * @param {string} move  e.g. 'z2', 'x', "y'"
   */
  applyOrientation(move) {
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

  /**
   * Animate a single WCA move, then call onDone when complete.
   * Colors are physically attached to cubelets — they travel with the mesh.
   * No color reassignment happens here; setState is only for instant state loads.
   * @param {string} move
   * @param {Function} [onDone]
   */
  animateMove(move, onDone) {
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
    this._scene.add(pivot);
    for (const { mesh } of moving) {
      this._scene.remove(mesh);
      pivot.add(mesh);
    }

    this._animTick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      pivot.setRotationFromAxisAngle(axis, totalAngle * ease);

      if (t >= 1) {
        this._animTick = null;
        pivot.setRotationFromAxisAngle(axis, totalAngle);
        pivot.updateMatrixWorld();
        for (const { mesh } of moving) {
          pivot.remove(mesh);
          // Bake the pivot rotation into the mesh — position moves, quaternion accumulates.
          // Do NOT reset quaternion: sticker textures are physically attached and must
          // rotate with the cubelet. Colors never change; only position and orientation do.
          mesh.applyMatrix4(pivot.matrix);
          mesh.position.x = Math.round(mesh.position.x);
          mesh.position.y = Math.round(mesh.position.y);
          mesh.position.z = Math.round(mesh.position.z);
          this._scene.add(mesh);
        }
        this._scene.remove(pivot);
        this._updateCubeletMetadata();
        this._animating = false;
        setTimeout(() => onDone?.(), 0);
      }
    };
  }

  /**
   * Rebuild pos/isOutward metadata from each mesh's current world position.
   * Called after animation completes.
   */
  _updateCubeletMetadata() {
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

  /**
   * Animate a sequence of moves with a gap between each.
   * State tracking is the caller's responsibility.
   * @param {string[]} moves
   * @param {Function} onStep  — called with (moveIndex) after each move
   * @param {Function} [onComplete]
   * @param {number} [gapMs=60]
   */
  animateAlg(moves, onStep, onComplete, gapMs = 60) {
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

  /**
   * Apply a stickering mask. Hidden slots get the grey plastic texture.
   * Looks up each cubelet by its current grid position — position-based semantics.
   * Call setState() first to rebake colors if the cube has been animated since the last setState.
   * @param {Map<string, boolean[]>} visibilityMap — "x,y,z" grid position → slot visibility[6]
   */
  applyStickering(visibilityMap) {
    // visibilityMap: homePos "x,y,z" → number[6] where 0=hidden, 1=dim, 2=full.
    // restoreColours() has already set all slots to full, so we only need to act
    // on slots that are dim (1) or hidden (0).
    this._cubelets.forEach(({ mesh, homePos }) => {
      const vis = visibilityMap.get(`${homePos.x},${homePos.y},${homePos.z}`);
      if (!vis) return;
      const homeOut = outwardSlots(homePos);
      for (let slot = 0; slot < 6; slot++) {
        if (!homeOut[slot]) continue;
        const level = vis[slot];
        if (level === 2) continue; // full — already restored
        const face = SLOT_TO_FACE[slot];
        const hex = level === 1 ? FACE_DIM_COLOURS_HEX[face] : FACE_COLOURS_HEX.X;
        const tex = makeStickerTexture(hex);
        if (mesh.material[slot].map !== tex) {
          mesh.material[slot].map = tex;
          mesh.material[slot].needsUpdate = true;
        }
      }
    });
    this._log('applyStickering');
  }

  /**
   * Returns a world-face color map for diagnostic comparison.
   * For each outward face of each cubelet's current world position, resolves which
   * local slot faces that direction (via mesh quaternion) and what color it carries.
   *
   * @returns {Map<string, string>}  "wx,wy,wz:FACE" → color tag (face letter, 'grey', or 'plastic')
   */
  getWorldFaceMap() {
    const FACE_BY_HEX = Object.fromEntries(
      Object.entries(FACE_COLOURS_HEX).map(([f, h]) => [h, f])
    );
    const result = new Map();
    for (const { mesh } of this._cubelets) {
      const wx = Math.round(mesh.position.x);
      const wy = Math.round(mesh.position.y);
      const wz = Math.round(mesh.position.z);
      // Outward world faces at this world position
      const outward = [];
      if (wx ===  1) outward.push('R');
      if (wx === -1) outward.push('L');
      if (wy ===  1) outward.push('U');
      if (wy === -1) outward.push('D');
      if (wz ===  1) outward.push('F');
      if (wz === -1) outward.push('B');

      for (let slot = 0; slot < 6; slot++) {
        _slotDir.copy(LOCAL_DIRS[slot]).applyQuaternion(mesh.quaternion);
        const ax = Math.abs(_slotDir.x), ay = Math.abs(_slotDir.y), az = Math.abs(_slotDir.z);
        let face;
        if (ax >= ay && ax >= az) face = _slotDir.x > 0 ? 'R' : 'L';
        else if (ay >= ax && ay >= az) face = _slotDir.y > 0 ? 'U' : 'D';
        else                           face = _slotDir.z > 0 ? 'F' : 'B';
        if (!outward.includes(face)) continue;  // faces inward, skip

        const mat = mesh.material[slot];
        let color;
        if (mat === BLACK_MATERIAL) {
          color = 'plastic';
        } else {
          const hex = [..._textureCache.entries()].find(([,t]) => t === mat.map)?.[0];
          color = hex ? (FACE_BY_HEX[hex] ?? hex) : 'unknown';
        }
        result.set(`${wx},${wy},${wz}:${face}`, color);
      }
    }
    return result;
  }

  // ---- Camera ----

  resetCamera() {
    this._camera.position.set(5.5, 4.5, 5.5);
    this._camera.lookAt(0, 0, 0);
    this._controls?.reset();
  }

  setSpeed(ms) { this._animSpeed = ms; }

  get isAnimating() { return this._animating; }

  getDebugLog() { return this._debugLog.join('\n'); }
}
