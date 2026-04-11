# Tasks: cubify-harness (Feature 020)

**Input**: Design documents from `/specs/020-cubify-harness/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

**Tests**: No test tasks in this PoC — prove the rendering approach first. Once `CubeState` move logic and stickering geometry are validated visually in the demo, add unit tests for `CubeState.applyMove()` and `CubeStickering.forPreset()` as a follow-up before the full library feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All paths relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `cubify-harness/` package skeleton with correct ESM config and dependencies.

- [x] T001 Create `cubify-harness/` directory structure per plan.md: `src/`, `demo/`, `css/`
- [x] T002 Create `cubify-harness/package.json` — ESM module (`"type": "module"`), MIT license, `three` as dependency, `cubing` as peerDependency, `node-canvas` as optional devDependency
- [x] T003 [P] Create `cubify-harness/css/cubify.css` with `--cubify-*` colour token custom properties (U/R/F/D/L/B face colours, `--cubify-hidden`, `--cubify-bg`)

**Checkpoint**: Package skeleton in place — `src/` ready for module files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `CubeState.js` — the pure-state core used by every other module. Must be complete before renderer or exporter tasks.

**⚠️ CRITICAL**: No user story work can begin until `CubeState.js` is complete.

- [x] T004 Implement `cubify-harness/src/CubeState.js` — wraps cubing.js KPattern; `static solved()`, `applyMove()`, `applyAlg()`, `toFaceArray()`, `clone()` (delegating move logic to cubing.js)
- [x] T005 Implement `toFaceArray()` in `CubeState.js` — converts KPattern piece/orientation data to 6×9 sticker colour array using corner/edge position lookup tables
- [x] T006 [P] Implement `cubify-harness/src/AlgParser.js` — built-in regex parser for WCA notation; optional `parseWith(cubing/alg)` path

**Checkpoint**: `CubeState` + `AlgParser` complete — all user story phases can begin

---

## Phase 3: User Story 1 — Mount Anywhere (P1) 🎯 MVP

**Goal**: A 3D cube mounts and renders correctly in any container, including zero-height containers, with no IntersectionObserver constraint.

**Independent Test**: Open `demo/index.html` in browser; verify 3D cube renders in a container with no explicit height set. Resize browser window — cube should reflow correctly.

- [x] T007 [US1] Implement `cubify-harness/src/CubeRenderer3D.js` — `constructor({ theme, gap })`, internal `_scene`, `_camera`, `_renderer`, `_cubelets[26]` scaffolding
- [x] T008 [US1] Implement cubelet geometry in `CubeRenderer3D.js` — 26 `THREE.BoxGeometry` cubelets at `(-1,0,1)` grid positions, each with `THREE.MeshStandardMaterial[6]` (one per face); inner faces black, sticker faces use colour map
- [x] T009 [US1] Implement `mount(container)` in `CubeRenderer3D.js` — appends `WebGLRenderer` canvas, synchronous initial render if container has dimensions, `ResizeObserver` for subsequent resize events per plan.md pattern
- [x] T010 [US1] Implement `unmount()` in `CubeRenderer3D.js` — removes canvas from DOM, disconnects `ResizeObserver`, disposes Three.js renderer
- [x] T011 [US1] Implement `setState(state)` and `render()` in `CubeRenderer3D.js` — calls `state.toFaceArray()`, maps colour values to `material.color` on each cubelet face, calls `renderer.render()`
- [x] T012 [US1] Add scene lighting to `CubeRenderer3D.js` — `AmbientLight` + `DirectionalLight` for clear sticker visibility; `PerspectiveCamera` at isometric-style angle (45°/35° elevation, looking at cube centre)
- [x] T013 [US1] Create `cubify-harness/demo/index.html` — importmap for three+cubing; alg selector (Sune, T-Perm, Sexy×4, etc.); debug panel with on-page event log and face state view; step-through controls

**Checkpoint**: `demo/index.html` opens in browser and shows a rendered 3D cube for each named alg; face state visible in debug panel; no IntersectionObserver errors in devtools

---

## Phase 4: User Story 2 — CFOP Stickering Presets (P2)

**Goal**: Named presets (`oll`, `pll`, `f2l`, `cross`, `full`) apply correct sticker visibility without requiring opaque orbit strings.

**Independent Test**: In `demo/index.html`, call `renderer.setStickering('oll')` — U face and top-layer edges on RFLB faces should show colour; all other stickers should show `--cubify-hidden` grey.

- [ ] T014 [US2] Implement `cubify-harness/src/CubeStickering.js` — `static forPreset(name)` returns a `Map<cubeletIndex, faceVisibility[6]>` (boolean per Three.js face slot) for presets: `full`, `oll`, `pll`, `f2l`, `cross`, `oll-edges`, `pll-corners`
- [ ] T015 [US2] Define cubelet index layout in `CubeStickering.js` — map 26 cubelet positions (corners, edges, centres) to their face slot indices matching the `CubeRenderer3D` geometry ordering
- [ ] T016 [US2] Implement `setStickering(preset)` in `CubeRenderer3D.js` — calls `CubeStickering.forPreset()`, applies `faceVisibility` to each cubelet's `MeshStandardMaterial[6]` (hidden stickers → `--cubify-hidden` colour), re-renders
- [ ] T017 [US2] Extend `demo/index.html` stickering section — add preset buttons (`full` / `oll` / `pll` / `f2l` / `cross`); log active preset + cubelet visibility counts to the debug panel on each change; combine with the Sune/T-Perm alg selector to visually validate correct mask per case (e.g. Sune + `oll` preset should show coloured U face + top-layer sides)

**Checkpoint**: All 5 named presets render correctly in the demo

---

## Phase 5: User Story 3 — Static Export (P3)

**Goal**: Export a cube state as SVG (any environment) or PNG (browser) without launching a headed browser.

**Independent Test**: Call `CubeExporter.toSVG('R U R\' U\'', { stickering: 'oll' })` from a Node.js script — should return a valid SVG string with 54 coloured rectangles. Call `CubeExporter.toPNG(...)` in browser — should return a Blob that renders as a cube image.

- [ ] T018 [US3] Implement `cubify-harness/src/CubeRenderer2D.js` — `static toSVG(state, { stickering, size, theme })` returns SVG string; standard cube net layout (cross: U top, LFRB middle row, D bottom); each sticker as `<rect>` with fill from colour token map
- [ ] T019 [US3] Implement stickering application in `CubeRenderer2D.js` — applies `CubeStickering.forPreset()` to set hidden stickers to `--cubify-hidden` fill value in the SVG output
- [ ] T020 [US3] Implement `cubify-harness/src/CubeExporter.js` — `static toSVG(algOrState, { stickering, setupAlg, size })` — resolves `algOrState` to a `CubeState` (parsing + applying alg/setupAlg), delegates to `CubeRenderer2D.toSVG()`
- [ ] T021 [US3] Implement `static async toPNG(algOrState, { stickering, setupAlg, size, theme })` in `CubeExporter.js` — browser path using `OffscreenCanvas` + `THREE.WebGLRenderer`; returns `Blob`; guards with `typeof OffscreenCanvas !== 'undefined'`
- [ ] T022 [US3] Implement `setupAlg` resolution in `CubeExporter.js` — if `setupAlg` provided, display state = `solved.applyAlg(inv(alg)).applyAlg(setupAlg)` (matches `experimentalSetupAnchor: 'end'` behaviour)
- [ ] T023 [US3] Create `cubify-harness/demo/export-test.mjs` — Node.js ESM script that calls `CubeExporter.toSVG('R U R\' U\'', { stickering: 'oll' })` and writes output to `/tmp/cubify-test.svg`; validates SVG is non-empty
- [ ] T024 [US3] Extend `demo/index.html` with export buttons — "Export SVG" (downloads file) and "Export PNG" (downloads blob); validates browser export path

**Checkpoint**: `node demo/export-test.mjs` produces a valid SVG; PNG export works in browser demo

---

## Phase 6: User Story 4 — Clean Controls API (P4)

**Goal**: Expose `play()`, `pause()`, `jumpTo()`, `setSpeed()`, `on('move')` so consuming apps can build their own playback controls.

**Independent Test**: In `demo/index.html`, load `R U R' U'` and wire up manual play/pause buttons — cube should animate move by move and emit `move` events to the console.

*Note: US-004 is the most complex story and deferred in PoC scope per spec. Stub the API surface only — animation engine internals are out of scope for 020.*

- [ ] T025 [US4] Create `cubify-harness/src/CubePlayer.js` — constructor accepts `(container, options)`; internally creates `CubeRenderer3D`, `CubeState`; exposes stub methods: `loadAlg(alg)`, `play()`, `pause()`, `jumpTo(index)`, `setSpeed(scale)`, `reset()`, `setStickering(preset)`, `on(event, cb)`
- [ ] T026 [US4] Implement `loadAlg(alg)` in `CubePlayer.js` — parses alg via `AlgParser`, stores move sequence, resets to `CubeState.solved()`, renders initial state
- [ ] T027 [US4] Implement `jumpTo(index)` in `CubePlayer.js` — re-applies moves 0..index-1 from solved state and re-renders; validates index bounds
- [ ] T028 [US4] Implement event emitter in `CubePlayer.js` — simple `on(event, cb)` / `emit(event, data)` pattern; emit `{ index, move }` on each move advance; emit `{}` on `complete`
- [ ] T029 [US4] Extend `demo/index.html` with CubePlayer wiring — load an alg, add prev/next buttons calling `jumpTo()`, log `move` events to page

**Checkpoint**: Demo shows step-through navigation and move event logging

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, README, and demo completeness.

- [ ] T034 [harness] Cubelet inspector — click a cubelet in the 3D view to open a debug panel showing: grid position (x,y,z), the 6 material slot colours currently rendered, what `toFaceArray` + `stickerIndex` says should be there, and whether they agree. Requires Three.js raycasting on canvas click. See `cube-mapping-lessons.md` §6 for why this would have directly revealed the stickerIndex U/D swap bug.

- [ ] T030 [P] Create `cubify-harness/README.md` — quick start (mount 3D cube, export SVG), API surface summary, dependency attribution for Three.js and cubing.js, MIT license notice
- [ ] T031 [P] Add JSDoc comments to all public methods in `CubeState.js`, `AlgParser.js`, `CubeStickering.js`, `CubeExporter.js` — param types and return types for IDE completion
- [ ] T032 Validate acceptance criteria from spec.md against implemented demo — document results in `specs/020-cubify-harness/implementation-summary.md`
- [ ] T033 Note test coverage gaps in `implementation-summary.md` — flag `CubeState.applyMove()` adjacency table and `CubeStickering.forPreset()` slot mappings as priority targets for unit tests in the full library feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user story phases**
- **US1 (Phase 3)**: Depends on Phase 2 (`CubeState` complete)
- **US2 (Phase 4)**: Depends on Phase 3 (`CubeRenderer3D.mount` + `setState` complete)
- **US3 (Phase 5)**: Depends on Phase 2 only (`CubeState` + `AlgParser`); can run in parallel with US2
- **US4 (Phase 6)**: Depends on Phase 3 (US1 complete — needs `CubeRenderer3D` and `CubeState`)
- **Polish (Phase 7)**: Depends on all story phases

### User Story Dependencies

- **US1 (Mount Anywhere)**: Starts after Phase 2 — foundational for all rendering stories
- **US2 (Stickering)**: Starts after US1 — needs `CubeRenderer3D.setState` from T011
- **US3 (Static Export)**: Starts after Phase 2 — independent of US1/US2 (SVG path has no renderer dependency)
- **US4 (Controls API)**: Starts after US1 — wraps `CubeRenderer3D`

### Within Each Story

- Geometry/data before render methods
- Core implementation before demo wiring
- SVG (US3) is independent from 3D renderer — can be parallelised with US2

### Parallel Opportunities

- T003 (CSS tokens) runs in parallel with T004–T006 (Phase 2)
- T006 (`AlgParser`) runs in parallel with T004–T005 (`CubeState`) — different file
- T018–T022 (US3 SVG/PNG export) can run in parallel with T014–T017 (US2 stickering) after Phase 2 completes
- T030 and T031 (Polish) are independent of each other

---

## Parallel Example: After Phase 2

```text
# US2 and US3 can run in parallel once CubeState + AlgParser are done:

Track A (US2):
  T014 CubeStickering.js — forPreset()
  T015 Cubelet index layout
  T016 CubeRenderer3D.setStickering()
  T017 Demo stickering toggles

Track B (US3):
  T018 CubeRenderer2D.toSVG()
  T019 Stickering in SVG
  T020 CubeExporter.toSVG()
  T021 CubeExporter.toPNG()
  T022 setupAlg resolution
  T023 Node.js export test script
```

---

## Implementation Strategy

### MVP (US1 + US3 — the PoC validation targets)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (`CubeState`, `AlgParser`)
3. Complete Phase 3: US1 (`CubeRenderer3D` mount + render)
4. **STOP and VALIDATE**: 3D cube renders in browser with no height constraint
5. Complete Phase 5: US3 (SVG export — headless path)
6. **STOP and VALIDATE**: `node demo/export-test.mjs` produces valid SVG

### Full PoC (all stories)

7. Complete Phase 4: US2 (stickering presets)
8. Complete Phase 6: US4 (CubePlayer API stub)
9. Complete Phase 7: Polish + docs

---

## Notes

- No TypeScript — plain JS ESM with JSDoc
- No bundler required — modules imported directly in demo via `<script type="module">`
- `node-canvas` PNG path is stretch goal — SVG is the primary headless export
- US4 (`CubePlayer`) is an API stub only in this PoC — animation engine internals deferred to Feature 021
- Commit after each phase checkpoint
