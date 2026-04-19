# Research: 026 — cubify-image-export

## Decision 1: Top-Down Perspective View (not full net)

**Decision**: The 2D renderer shows a top-down perspective view — U face (3×3 centre) plus the top row of each side face (F, B, R, L) rendered as perspective trapezoids. This is NOT the standard cross/net layout described in the spec's "Standard cube net layout" section.

**Rationale**: The existing OLL/PLL images in `public/images/oll/` and `public/images/pll/` are all top-down perspective views matching TwistyPlayer's PG2D visualization. Visual parity requires the same layout. The cross/net layout would not match those images.

**Alternatives considered**: Full cross/net (U, L, F, R, B, D faces unfolded) — rejected because existing assets are top-down and that is the conventional OLL/PLL diagram format.

---

## Decision 2: Canvas 2D API as Primary Renderer

**Decision**: `CubeRenderer2D` uses the browser's Canvas 2D API as its drawing surface. It draws directly onto a `<canvas>` element provided or created by the constructor.

**Rationale**: Canvas 2D is built-in to the browser (no dependency), synchronous, and directly yields a PNG via `canvas.toDataURL('image/png')`. The harness already uses Canvas implicitly (Three.js renderer). This keeps the implementation simple and fast.

**Alternatives considered**: 
- SVG DOM manipulation — works in browser but requires DOM, verbose for polygon drawing
- SVG string construction — portable (Node.js-friendly) but requires a separate PNG conversion step
- OffscreenCanvas — useful for Node.js via wasm-based canvas, deferred to US-002/US-004

**Node.js note**: For the demo script (US-003), SVG string output is the most portable format since Canvas 2D requires a DOM shim in Node.js. The demo script approach: generate SVG string → convert to PNG via `sharp` (already installed in project as dev tool, or via inline canvas). Decision: demo script uses `canvas` npm package (`npm install canvas` dev dep) OR uses Playwright to render the harness. **Final**: demo script uses the `@napi-rs/canvas` or standard `canvas` npm package. This is a dev-only dependency for the demo script, not the renderer module itself.

---

## Decision 3: Visibility Lookup — rawPattern + visMap

**Decision**: `CubeRenderer2D.update(state, visMap)` receives a `CubeState` instance and the pre-computed visMap from `CubeStickering.fromOrbitStringWithState()`. Internally it calls:
1. `state.toFaceArray()` — for sticker colours
2. `state.toRawPattern()` — for piece identity at each orbit slot (to map orbit slot → homePos → visMap key)

**Rationale**: visMap is keyed by homePos (piece identity), not current position. To look up visibility for a sticker currently at a given grid position, we need to know which piece is there. `rawPattern.corners.pieces[slotI]` gives the piece ID, which maps through `CORNER_ORBIT_TO_CUBELET` and `CUBELET_POSITIONS` to homePos.

**Alternative considered**: Pass a flat vis array indexed by grid cell — simpler but loses the piece-identity-tracking that makes OLL/PLL masking correct for non-solved states.

---

## Decision 4: Grid Cell Sticker Mapping Table

**Decision**: Encode all 21 visible cells as a static `GRID_CELLS` constant in `CubeRenderer2D.js`. Each cell entry specifies `{ face, fsi, orbit, slotI, visSlot }` derived from `CORNER_POSITIONS`/`EDGE_POSITIONS` in `CubeState.js`.

Full mapping (verified against CubeState.js CORNER_POSITIONS and EDGE_POSITIONS):

```
Grid (row, col) where row 0 = top, col 0 = left:
(0,0): null          (corner gap)
(0,1): face=5,fsi=2, orbit=CORNERS,slotI=2(ULB),visSlot=5   B strip left
(0,2): face=5,fsi=1, orbit=EDGES,  slotI=2(UB), visSlot=5   B strip mid
(0,3): face=5,fsi=0, orbit=CORNERS,slotI=1(URB),visSlot=5   B strip right
(0,4): null          (corner gap)

(1,0): face=4,fsi=0, orbit=CORNERS,slotI=2(ULB),visSlot=1   L strip top
(1,1): face=0,fsi=0, orbit=CORNERS,slotI=2(ULB),visSlot=2   U[0]
(1,2): face=0,fsi=1, orbit=EDGES,  slotI=2(UB), visSlot=2   U[1]
(1,3): face=0,fsi=2, orbit=CORNERS,slotI=1(URB),visSlot=2   U[2]
(1,4): face=1,fsi=2, orbit=CORNERS,slotI=1(URB),visSlot=0   R strip top

(2,0): face=4,fsi=1, orbit=EDGES,  slotI=3(UL), visSlot=1   L strip mid
(2,1): face=0,fsi=3, orbit=EDGES,  slotI=3(UL), visSlot=2   U[3]
(2,2): face=0,fsi=4, orbit=CENTERS,slotI=0(U),  visSlot=2   U[4] (center)
(2,3): face=0,fsi=5, orbit=EDGES,  slotI=1(UR), visSlot=2   U[5]
(2,4): face=1,fsi=1, orbit=EDGES,  slotI=1(UR), visSlot=0   R strip mid

(3,0): face=4,fsi=2, orbit=CORNERS,slotI=3(ULF),visSlot=1   L strip bot
(3,1): face=0,fsi=6, orbit=CORNERS,slotI=3(ULF),visSlot=2   U[6]
(3,2): face=0,fsi=7, orbit=EDGES,  slotI=0(UF), visSlot=2   U[7]
(3,3): face=0,fsi=8, orbit=CORNERS,slotI=0(URF),visSlot=2   U[8]
(3,4): face=1,fsi=0, orbit=CORNERS,slotI=0(URF),visSlot=0   R strip bot

(4,0): null          (corner gap)
(4,1): face=2,fsi=0, orbit=CORNERS,slotI=3(ULF),visSlot=4   F strip left
(4,2): face=2,fsi=1, orbit=EDGES,  slotI=0(UF), visSlot=4   F strip mid
(4,3): face=2,fsi=2, orbit=CORNERS,slotI=0(URF),visSlot=4   F strip right
(4,4): null          (corner gap)
```

**Derivation**: CubeState.js CORNER_POSITIONS and EDGE_POSITIONS directly list (face, stickerIndex) for each piece × sticker. visSlot follows slot convention: 0=+X(R), 1=-X(L), 2=+Y(U), 3=-Y(D), 4=+Z(F), 5=-Z(B).

**Piece ID ↔ orbit slot mapping**: For a solved cube, piece[i] = i (identity). For any state, rawPattern.corners.pieces[slotI] gives the piece currently in that orbit slot. We then resolve homePos via `CORNER_ORBIT_TO_CUBELET[pieceId]` → `CUBELET_POSITIONS[cubeletIndex]`.

---

## Decision 5: Canvas Geometry

**Decision**: Standard canvas layout for a 400×400 canvas (configurable via `size` option):

```
Layout units (as fractions of size):
  margin     = size * 0.05           (outer padding)
  cellSize   = (size * 0.62) / 3     (U-face cell)
  stripDepth = size * 0.13           (perspective strip height/width)
  uOrigin    = { x: margin + stripDepth, y: margin + stripDepth }
```

Side strips rendered as trapezoids using `ctx.beginPath() / ctx.moveTo / ctx.lineTo / ctx.closePath()`. The inner edge aligns with the U-face grid; the outer edge is shorter by `stripDepth * sin(perspectiveAngle)`.

**Perspective taper factor**: Outer edge width = inner edge width × 0.7 (approximates ~45° viewing angle, matching TwistyPlayer PG2D visuals).

---

## Decision 6: Colour Mapping

**Decision**: Re-use the same colour palette as `CubeRenderer3D.js`. Face → hex colour:

```js
const FACE_COLOURS = {
  U: '#FFFFFF',  // white
  R: '#FF4400',  // red/orange
  F: '#00AA44',  // green
  D: '#FFDD00',  // yellow
  L: '#FF7700',  // orange
  B: '#0055DD',  // blue
  X: '#333333',  // hidden/unknown → dark grey
};
```

Vis levels applied as opacity / tint:
- 0 (hidden): render as grey `#444444`
- 1 (dim): render colour at 40% opacity blended over grey base
- 2 (full): render colour at full opacity

---

## Decision 7: 3D Export via OffscreenCanvas (US-002)

**Decision**: `CubeExporter.toPNG(alg, { style: '3d' })` creates a temporary `CubeRenderer3D` instance on an `OffscreenCanvas`, calls `setState()`, waits one render tick for Three.js to flush, then exports via `renderer.domElement.toDataURL()` (or OffscreenCanvas `transferToImageBitmap` → Canvas 2D → `toDataURL`).

**Rationale**: `CubeRenderer3D` already runs on any canvas — it accepts a `canvas` option in its Three.js `WebGLRenderer`. Routing through OffscreenCanvas avoids DOM pollution and is fully synchronous after the renderer flushes its first frame.

**Implementation notes**:
- `OffscreenCanvas` is available in all modern browsers. No polyfill needed for harness/cfop-app targets.
- Three.js `WebGLRenderer` accepts `{ canvas: offscreenCanvas }` in its constructor options.
- After `setState()`, call `renderer.render(scene, camera)` explicitly once (don't rely on animation loop) — same pattern as the harness `renderOnce()` method if one exists, or just trigger a manual render.
- `offscreenCanvas.convertToBlob({ type: 'image/png' })` returns a Promise<Blob> → convert via FileReader or `URL.createObjectURL` to data URL.
- Alternatively: create a regular `<canvas>` off-DOM (not appended), use `canvas.toDataURL()` — simpler and avoids OffscreenCanvas async path. **Final choice**: off-DOM regular canvas (simpler, synchronous toDataURL).

**Alternatives considered**: Reuse the harness's existing renderer canvas and snapshot it — rejected because it would corrupt the live display.

---

## Decision 9: Demo Script Approach

**Decision**: `cubify-harness/demo/export-test.mjs` runs under Node.js 24. It imports `CubeRenderer2D` and calls a `.toSVG(state, visMap)` method that returns an SVG string (no canvas required). The script converts SVG → PNG using the `sharp` npm package (common image processing library).

**Rationale**: `sharp` is already in the ecosystem toolchain for image work. It accepts SVG string input and produces PNG buffer with a single call. Avoids a headless browser dependency for the demo.

**Install**: `npm install --save-dev sharp` in `cubify-harness/` (dev dependency only, not bundled into the renderer).

**Alternative**: Node.js `canvas` package — heavier to install (native build), harder on CI. Sharp is simpler for SVG→PNG conversion.
