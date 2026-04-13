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
  X: '#2a2a2a',  // dark grey — hidden/masked stickers (distinct from black plastic body)
};
// Three.js slot → WCA face name
const SLOT_TO_FACE = ['R', 'L', 'U', 'D', 'F', 'B'];
const FACE_TO_IDX  = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

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

// ---- Sticker index mapping ----
// Maps cubelet grid position + material slot → sticker index (0-8) on the WCA face array.
// Face sticker layout (reading order):  0 1 2 / 3 4 5 / 6 7 8
function stickerIndex(pos, slot) {
  const { x, y, z } = pos;
  const idx = (col, row) => (row + 1) * 3 + (col + 1);
  switch (slot) {
    case 0: return idx(-z, -y); // +X = R
    case 1: return idx( z, -y); // -X = L
    case 2: return idx( x,  z); // +Y = U
    case 3: return idx( x, -z); // -Y = D
    case 4: return idx( x, -y); // +Z = F
    case 5: return idx(-x, -y); // -Z = B
    default: return 4;
  }
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
   * Instantly apply a CubeState (no animation).
   * Updates each outward face's texture to the correct sticker colour.
   * @param {import('./CubeState.js').CubeState} state
   */
  setState(state) {
    const faces = state.toFaceArray();
    for (const cubelet of this._cubelets) {
      const { mesh, homePos } = cubelet;
      // Reset to home position and identity quaternion — makes setState fully idempotent
      // regardless of how many animated moves preceded it.
      mesh.position.set(homePos.x, homePos.y, homePos.z);
      mesh.quaternion.set(0, 0, 0, 1);
      cubelet.pos = { ...homePos };
      cubelet.isOutward = outwardSlots(homePos);
      const pos = cubelet.pos;
      const isOutward = cubelet.isOutward;
      for (let slot = 0; slot < 6; slot++) {
        if (!isOutward[slot]) {
          // Ensure inner slot always has the shared black material
          if (mesh.material[slot] !== BLACK_MATERIAL) {
            mesh.material[slot] = BLACK_MATERIAL;
          }
          continue;
        }
        const faceIdx = FACE_TO_IDX[SLOT_TO_FACE[slot]];
        const si = stickerIndex(pos, slot);
        const colourKey = faces[faceIdx][si];
        const colourHex = FACE_COLOURS_HEX[colourKey] ?? FACE_COLOURS_HEX.X;
        const tex = makeStickerTexture(colourHex);
        // Replace material if it's the shared black one (slot became outward after a move)
        if (mesh.material[slot] === BLACK_MATERIAL) {
          mesh.material[slot] = new THREE.MeshBasicMaterial({
            map: tex,
          });
        } else {
          mesh.material[slot].map = tex;
          mesh.material[slot].needsUpdate = true;
        }
      }
    }
    this._log('setState');
  }

  /**
   * Override a single cubelet's material slot with a specific face colour.
   * Used to patch center sticker colours after a whole-cube rotation is baked
   * into the KPattern state (e.g. z2 swaps U↔D, R↔L centres).
   * @param {string} homePosKey  e.g. "0,1,0"
   * @param {number} slot        material slot index (0-5)
   * @param {string} faceKey     colour key — 'U'|'R'|'F'|'D'|'L'|'B'
   */
  patchCenterSlot(homePosKey, slot, faceKey) {
    const cubelet = this._cubelets.find(
      c => `${c.homePos.x},${c.homePos.y},${c.homePos.z}` === homePosKey
    );
    if (!cubelet) return;
    const tex = makeStickerTexture(FACE_COLOURS_HEX[faceKey]);
    cubelet.mesh.material[slot].map = tex;
    cubelet.mesh.material[slot].needsUpdate = true;
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
    this._cubelets.forEach(({ mesh, homePos }) => {
      // Mask keyed by home position (piece identity).
      // Orbit strings describe which pieces to show (e.g. "D-layer corners"), not
      // which world positions — z2 orientation moves pieces but doesn't change identity.
      const vis = visibilityMap.get(`${homePos.x},${homePos.y},${homePos.z}`);
      if (!vis) return;
      // Iterate home outward slots — these are the mesh slots that have sticker textures
      // (baked by setState at home orientation). Slot indices are mesh-local and never change
      // even after orientation rotation, so vis[slot] and material[slot] stay in sync.
      const homeOut = outwardSlots(homePos);
      for (let slot = 0; slot < 6; slot++) {
        if (!homeOut[slot]) continue;
        if (!vis[slot]) {
          mesh.material[slot].map = makeStickerTexture(FACE_COLOURS_HEX.X);
          mesh.material[slot].needsUpdate = true;
        }
      }
    });
    this._log('applyStickering');
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
