# Tasks: 026 — cubify-image-export

**Input**: Design documents from `/specs/026-cubify-export/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths in all descriptions

---

## Phase 1: Setup

**Purpose**: Dev dependency and output directory for demo script.

- [X] T001 Add `sharp` as a dev dependency in `cubify-harness/` (`npm install --save-dev sharp`) and create output directory `cubify-harness/demo/out/` (gitignore `demo/out/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Static geometry data and colour palette shared by both 2D and 3D paths.

**⚠️ CRITICAL**: Complete before any US implementation.

- [X] T002 Create `cubify-harness/src/CubeRenderer2D.js` with the GRID_CELLS constant (21-entry table mapping each top-down grid cell to `{ row, col, face, fsi, orbit, slotI, visSlot }` — full table is in `specs/026-cubify-export/research.md` Decision 4), the FACE_COLOURS palette, and the vis-level colour blending helpers. No drawing logic yet — just data and exports.

- [X] T003 Add `toRawPattern()` method to `cubify-harness/src/CubeState.js` that returns `{ corners: { pieces, orientation }, edges: { pieces, orientation }, centers: { pieces, orientation } }` from `this._kPattern.patternData`. This is needed by CubeRenderer2D to resolve piece identity for visibility lookup.

**Checkpoint**: GRID_CELLS + FACE_COLOURS in CubeRenderer2D.js; toRawPattern() in CubeState.js

---

## Phase 3: US-001 — 2D Top-Down Renderer + Harness Integration (Priority: P1) 🎯 MVP

**Goal**: CubeRenderer2D renders the top-down perspective view (U face + 4 side strips as perspective trapezoids) in the harness 2D tab, respecting cube state and stickering mask.

**Independent Test**: Open harness, switch to 2D tab — solved cube shows all correct colours. Apply OLL mask via Stickering tab — side stickers grey out correctly. Switch states via moves — 2D view updates.

### Implementation for US-001

- [X] T004 [US1] Implement `CubeRenderer2D` constructor in `cubify-harness/src/CubeRenderer2D.js`: accepts `(container, { size = 400 } = {})`, creates a `<canvas size×size>`, appends to container, stores `ctx` and geometry constants (`cellSize = size * 0.62 / 3`, `stripDepth = size * 0.13`, `margin = size * 0.05`, `taper = 0.7`).

- [X] T005 [US1] Implement `getVisLevel(cell, rawPattern, visMap)` helper in `cubify-harness/src/CubeRenderer2D.js`: resolves `cell.orbit/slotI` → pieceId (via `rawPattern`) → cubeletIndex (via `CORNER_ORBIT_TO_CUBELET` / `EDGE_ORBIT_TO_CUBELET` / `CENTER_ORBIT_TO_CUBELET` imported from CubeStickering.js) → homePos string → `visMap.get(key)[cell.visSlot]`. Returns 2 if visMap is empty or key is missing.

- [X] T006 [US1] Implement `drawCell(ctx, vertices, colour, visLevel)` helper in `cubify-harness/src/CubeRenderer2D.js`: fills a polygon (array of `{x,y}` points) with the given colour blended to grey at visLevel 0 (grey `#444`), faded at visLevel 1 (40% colour over grey), or full colour at visLevel 2. Add a 1px `#1a1a1a` stroke for cell borders.

- [X] T007 [US1] Implement `computeVertices(row, col, size, geometry)` helper in `cubify-harness/src/CubeRenderer2D.js`: returns the 4 corner vertices `{x,y}[]` for a given grid cell. U-face cells are rectangles; side strip cells are trapezoids with `taper = 0.7` (outer edge 70% width, centred on inner edge). Corner cells `(0,0),(0,4),(4,0),(4,4)` return null.

- [X] T008 [US1] Implement `CubeRenderer2D.update(state, visMap)` in `cubify-harness/src/CubeRenderer2D.js`: clears canvas, calls `state.toFaceArray()` for colours, `state.toRawPattern()` for piece identity, then iterates all 21 GRID_CELLS entries calling `getVisLevel`, `computeVertices`, `drawCell`. Synchronous.

- [X] T009 [US1] Implement `CubeRenderer2D.toDataURL(type = 'image/png')` and `CubeRenderer2D.destroy()` in `cubify-harness/src/CubeRenderer2D.js`.

- [X] T010 [US1] Implement `static CubeRenderer2D.toSVG(state, visMap, { size = 400 } = {})` in `cubify-harness/src/CubeRenderer2D.js`: returns a complete `<svg viewBox="0 0 {size} {size}">` string. Each cell is a `<polygon points="..." fill="..." stroke="#1a1a1a" stroke-width="1"/>`. No DOM dependency (string concatenation only).

- [X] T011 [US1] Wire `CubeRenderer2D` into `cubify-harness/index.html`: import at top of the `<script type="module">`, construct `renderer2d = new CubeRenderer2D(document.getElementById('cube-2d'), { size: 400 })` after the harness init resolves, then call `renderer2d.update(cubeState, currentVisMap)` in both `applyStateToRenderer()` and `reapplyMask()` alongside the existing 3D renderer calls.

**Checkpoint**: Harness 2D tab shows correct top-down view, updates on moves and stickering changes.

---

## Phase 4: US-002 — 3D Rendered PNG Export (Priority: P2)

**Goal**: `CubeExporter.toPNG(alg, { style: '3d', ... })` renders CubeRenderer3D onto an off-DOM canvas and returns a PNG data URL. Used for full/cross/F2L exports.

**Independent Test**: Call `CubeExporter.toPNG('', { style: '3d' })` from browser console → returns non-empty `data:image/png;base64,...`. Call with `style: '2d'` → same. Both respect stickering masks.

### Implementation for US-002

- [X] T012 [US2] Create `cubify-harness/src/CubeExporter.js`: ES module with static async `toPNG(algOrState, options)` method. Handle `algOrState` being either a string (apply via `CubeState.solved().then(s => s.applyAlg(alg))`) or a `CubeState` instance. Resolve `setupAlg` using `displayState = solved.applyAlg(invertAlg(alg)).applyAlg(setupAlg ?? '')` (matching `experimentalSetupAnchor: 'end'`). Route to `_render2D` or `_render3D` based on `options.style`.

- [X] T013 [US2] Implement `CubeExporter._render2D(state, visMap, size)` in `cubify-harness/src/CubeExporter.js`: creates a temporary off-DOM `<canvas size×size>` (not appended to document), constructs a `CubeRenderer2D` using that canvas directly (pass canvas as constructor option rather than container), calls `update(state, visMap)`, returns `canvas.toDataURL('image/png')`. Clean up after export.

- [X] T014 [US2] Implement `CubeExporter._render3D(state, visMap, size)` in `cubify-harness/src/CubeExporter.js`: creates a temporary off-DOM `<canvas size×size>`, constructs `CubeRenderer3D` passing `{ canvas }` option to its Three.js `WebGLRenderer`, calls `setState(state)` and `reapplyMask(visMap)`, triggers a single manual `renderer.render(scene, camera)` call, returns `canvas.toDataURL('image/png')`. Dispose Three.js resources after export.

- [X] T015 [US2] Update `CubeRenderer2D` constructor in `cubify-harness/src/CubeRenderer2D.js` to accept an optional `canvas` option (in addition to container): `new CubeRenderer2D(null, { canvas: myCanvas })` — when `canvas` is provided, use it directly instead of creating one and appending to container.

- [X] T016 [US2] Update `CubeRenderer3D` constructor in `cubify-harness/src/CubeRenderer3D.js` to accept an optional `canvas` option passed through to `new THREE.WebGLRenderer({ canvas, antialias: true })`. When canvas option is provided, skip the DOM append step.

**Checkpoint**: `CubeExporter.toPNG` callable from browser console; returns valid PNG data URLs for both styles.

---

## Phase 5: US-003 — Node.js Demo Script (Priority: P3)

**Goal**: `node demo/export-test.mjs` produces 3 PNG files (OLL 2D, PLL 2D, full 3D) validating the SVG export path. Confirms non-empty output and correct dimensions.

**Independent Test**: `cd cubify-harness && node demo/export-test.mjs` exits 0, writes `demo/out/sune-oll.png`, `demo/out/tperm-pll.png`, `demo/out/full-solved.png`, logs file sizes.

### Implementation for US-003

- [X] T017 [US3] Create `cubify-harness/demo/export-test.mjs`: imports `CubeState`, `CubeStickering`, `CubeRenderer2D` (static `toSVG` path only — no canvas), `sharp`. Defines 3 test cases:
  1. OLL Sune: `setup = "R U2 R' U' R U' R'"`, `alg = "R U R' U R U2 R'"`, mask = OLL face-dim-f2l orbit string → 2D SVG
  2. T-Perm: `setup = "R U R' F' R U R' U' R' F R2 U' R'"`, mask = PLL-edge-dim → 2D SVG
  3. Full solved: no alg, no mask → 2D SVG (3D export requires browser; demo uses SVG only)
  Each case: `CubeRenderer2D.toSVG(state, visMap, { size: 400 })` → `sharp(Buffer.from(svg)).png().toBuffer()` → write to `demo/out/<name>.png`, log filename + size. Assert `buffer.length > 1000` else throw.

- [X] T018 [US3] Add `"demo": "node demo/export-test.mjs"` script to `cubify-harness/package.json` (create `package.json` if it doesn't exist — minimal: `{ "type": "module", "scripts": { "demo": "node demo/export-test.mjs" } }`).

**Checkpoint**: `npm run demo` from `cubify-harness/` produces 3 PNG files without errors.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Add `cubify-harness/demo/out/` to `cubify-harness/.gitignore` (or root `.gitignore` if no harness-local one exists)

- [X] T020 [P] Update `CLAUDE.md` Recent Changes section to note `CubeRenderer2D.js` and `CubeExporter.js` added for feature 026

- [X] T021 Update `specs/026-cubify-export/spec.md` acceptance criteria — tick off completed items and note US-004 (cubify-scripts migration) explicitly deferred with rationale (requires Node.js OffscreenCanvas / WebGL path not yet available without browser)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: No dependencies — start immediately
- **Foundational (T002–T003)**: Depends on T001; BLOCKS all US implementation
- **US-001 (T004–T011)**: Depends on T002 + T003; self-contained
- **US-002 (T012–T016)**: Depends on T002 + T003; T015 modifies CubeRenderer2D (run after T009), T016 modifies CubeRenderer3D
- **US-003 (T017–T018)**: Depends on T010 (toSVG method); can start once T010 is complete
- **Polish (T019–T021)**: Depends on all US phases complete

### Within US-001

- T004 (constructor) → T005, T006, T007 can run in parallel → T008 (update, needs all three) → T009, T010 can run in parallel

### Within US-002

- T015 (update CubeRenderer2D constructor) must run before T013
- T016 (update CubeRenderer3D constructor) must run before T014
- T013 and T014 can run in parallel once T012 skeleton exists
- T012 (CubeExporter skeleton) → T013 + T014 in parallel

---

## Parallel Opportunities

```text
After T001: T002 and T003 in parallel
After T002+T003: T004 starts US-001 sequence
Within US-001 after T004: T005, T006, T007 in parallel
After T009 completes: US-002 T015 can start alongside US-001 T010
Within US-002 after T012+T015+T016: T013 and T014 in parallel
After T010: T017 (US-003) can start
T019 and T020 in parallel (polish)
```

---

## Implementation Strategy

### MVP (US-001 only — 2D harness)

1. T001 (setup) → T002 + T003 (foundational)
2. T004 → T005/T006/T007 → T008 → T009/T010 → T011
3. **Validate**: harness 2D tab shows correct cube, OLL/PLL masks work
4. Commit MVP

### Full Feature

5. T012 → T015 + T016 → T013 + T014 (US-002 export wrapper)
6. T017 + T018 (US-003 demo script)
7. T019–T021 (polish)
8. Commit complete feature
