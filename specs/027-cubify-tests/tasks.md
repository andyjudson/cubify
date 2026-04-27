# Tasks: 027 — cubify-tests

**Status**: Complete ✅
**Input**: spec.md, plan.md
**Tests**: The tasks ARE the tests — no separate test tasks

---

## Phase 1: Setup

- [X] T001 Install Vitest: add `"vitest": "^2.1.9"` to devDependencies and `"test": "vitest run"` / `"test:watch": "vitest"` scripts in `cubify-harness/package.json`
- [X] T002 Create `cubify-harness/vitest.config.js` — `environment: 'node'`, `include: ['test/**/*.test.js']`
- [X] T003 Add `export` keyword to `MOVE_AXIS` constant in `cubify-harness/src/CubeRenderer3D.js` for testability without WebGL

---

## Phase 2: CubeState tests [US1]

- [X] T004 [P] [US1] Create `test/cube-state.test.js` — 32 tests covering:
  - `toFaceArray()` ground truth: solved, after R (U[2,5,8]=F), after U (L[0,1,2]=F — cubing.js U = WCA U')
  - Commutativity algs: T-perm×2, Sexy×6, Sune×6, Sledgehammer×6 all return solved
  - `isSolved()` after each above
  - Slot ordering: `toRawPattern()` CORNERS `pieces[0]=0` (URF), all solved pieces=identity
  - Orientation formula: after R, slot 0 piece=4 (DRF), orientation=2; `(s-o+3)%3` gives correct colour
  - `invertAlg` round-trip: `applyAlg(inv).applyAlg(alg)` = solved
  - U/D direction: cubing.js `U` = WCA `U'` (L[0,1,2]=F not B)

---

## Phase 3: CubeStickering tests [US2]

- [X] T005 [P] [US2] Create `test/cube-stickering.test.js` — 20 tests covering:
  - All 15 `MASK_PRESETS` parse without error; unique labels; contain EDGES/CORNERS/CENTERS
  - `full` preset: 26 cubelets in visMap; keys are `"x,y,z"` strings; values are `number[6]`
  - `full` preset: all outward slots vis=2
  - Char `'I'`: all outward slots hidden (vis=0)
  - Char `'O'`: U-home piece vis[2]=2, others 0; D-home vis[3]=2; F-edge vis[4]=2
  - Char `'D'`: all outward slots dim (vis=1)
  - Char `'S'`: primary=2, sides=1
  - Char `'P'`: primary=1, sides=2
  - Idempotency: same args → identical Maps
  - `fromOrbitString` delegates to `fromOrbitStringWithState(str, null)`
  - `cross` preset: bottom-layer edges all hidden

---

## Phase 4: CubePlayer tests [US3]

- [X] T006 [US3] Create `test/cube-player.test.js` — 40 tests with mock renderer:
  - `vi.mock('../../src/CubeRenderer3D.js')` hoisted; mock `animateMove` calls `onDone()` synchronously
  - `loadAlg`: moveCount, stepIndex, reset event, empty alg, setup moves
  - `jumpTo`: clamps to [0, moveCount], no move event, calls renderer correctly
  - `play()`: fake timers drain chain; 3 move events; complete event; stepIndex=moveCount after
  - `play()` wraps from last step; no-op if already playing; from step N plays remaining
  - `pause()`: sets isPlaying=false; only N move events emitted; no complete
  - `reset()`: stepIndex=0, emits reset, stops playback
  - `setSpeed`: renderer.setSpeed called with correct ms (300/scale)
  - `setStickering`: stores str; null clears; calls restoreColours + applyStickering
  - Mask travel: `applyStickering` NOT called inside `animateMove` callbacks
  - Public getters: state, renderer, isPlaying

---

## Phase 5: CubeExporter and 2D tests [US4]

- [X] T007 [P] [US4] Create `test/cube-exporter.test.js` — 11 tests covering `CubeExporter._resolve()` (pure, no DOM):
  - `_resolve("R U R'", null)` → setupMoves = invertAlg(["R","U","R'"]) = ["R","U'","R'"]
  - `_resolve("", null)` → solved state
  - `_resolve(cubeStateInstance, null)` → returns same instance, setupMoves=[]
  - `_resolve("R U R'", "z2")` → setupMoves = [...invertedAlg, "z2"]

- [X] T008 [P] [US4] Migrate `demo/export-test.mjs` to `test/cube-renderer-2d-svg.test.js` — 15 tests:
  - `toSVG()` returns string containing `<svg`
  - SVG structure invariant: exactly 13 `<rect>` + 8 `<polygon>` elements
  - Solved state renders correct face colours (white U, red R, green F, yellow D, orange L, blue B)
  - Stickering: hidden slots render grey (`#2a2a2a`)
  - `toSVG()` called twice with same state → identical output (idempotency)
  - Delete `demo/export-test.mjs`; remove `demo/` directory; remove `"demo"` script from package.json

---

## Phase 6: CubeRenderer3D geometry tests [US5]

- [X] T009 [P] [US5] Create `test/cube-renderer-3d.test.js` — 24 tests (4 skipped):
  - `MOVE_AXIS.U.dir = -1` (cubing.js U/D flip)
  - `MOVE_AXIS.D.dir = +1`, `MOVE_AXIS.E.dir = +1`
  - `MOVE_AXIS.R.dir = -1`, `MOVE_AXIS.L.dir = +1`, `MOVE_AXIS.F.dir = -1`, `MOVE_AXIS.B.dir = +1`
  - Filter functions: R filter includes (1,0,0), excludes (-1,0,0)
  - Axis vectors: U.axis = (0,1,0), R.axis = (1,0,0), F.axis = (0,0,1)
  - `describe.skip` block for 4 WebGL-dependent tests

- [X] T010 [P] [US5] Create `test/cube-renderer-2d.test.js` — 6 canvas tests all skipped:
  - `describe.skipIf(!process.env.CUBIFY_CANVAS_TESTS)` guard
  - Enable with `CUBIFY_CANVAS_TESTS=1 npm test` + `npm install canvas`

---

## Phase 7: Polish

- [X] T011 Verify `npm test` runs 138 tests, 10 skipped, 0 failures with no headed browser
- [X] T012 Update `cubify-harness/package.json`: remove `"demo"` script, confirm test scripts present
