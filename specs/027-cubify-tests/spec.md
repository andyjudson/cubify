# Feature 027 — cubify-tests (Unit Test Suite)

## Summary

Add a unit test suite for `cubify-harness` encoding the hard-won ground truth from the five reference docs in `specs/`. Priority targets: `CubeState` move application, `CubeStickering` orbit string parsing, and `CubePlayer` event sequencing.

**Reference docs this suite encodes:**
| Doc | Lessons encoded |
|-----|----------------|
| `lessons.md` | §1–17 — slot ordering, orientation formula, move direction, stickering invariants |
| `cubing-js-architecture.md` | §2–4, §8 — KPattern data model, solved state, isSolved |
| `cubing-js-stickering.md` | §2–3 — facelet[0] semantics, IgnoreNonPrimary 'O' |
| `cube-physical-rules.md` | §3.4, §4 — animation axis direction, orientation convention |

**Test environment by module:**
| Module | DOM? | WebGL? | Strategy |
|--------|------|--------|----------|
| `CubeState` | No | No | Pure Node.js |
| `CubeStickering` | No | No | Pure Node.js |
| `CubePlayer` | No | No | Mock renderer |
| `CubeExporter._resolve` | No | No | Pure Node.js |
| `CubeRenderer2D` / `CubeExporter._render2D` | Yes (canvas) | No | jsdom + node-canvas |
| `CubeRenderer3D` / `CubeExporter._render3D` | Yes | Yes | Skip in CI; Playwright for acceptance |

---

## Motivation

As the library becomes load-bearing for cfop-app, regressions in `toFaceArray()`, orientation formulas, or sticker slot mappings become user-visible bugs. The test suite encodes the verified facts from `lessons.md` so they can't silently break.

Also refer to cubify-harness/verify-perms.mjs

---

## Test Targets

### CubeState (priority 1)

**toFaceArray() ground truth** — `lessons.md §4`, `cubing-js-architecture.md §2–4`:

| Test | Expected | Source |
|------|----------|--------|
| Solved state | All 6 faces single colour | §4 |
| After R: U[2,5,8] | F, F, F | §4 |
| After U: L[0,1,2] | F, F, F | §4, §5 — cubing.js U = WCA U' |
| T-perm × 2 | Solved | §4 |
| T-perm U face | UUUUUUUUU (no corner twists on PLL) | §4 |
| Sexy move × 6 | Solved | §4 |
| Sune × 6 | Solved | §4 |
| Sledgehammer × 6 | Solved | §4 |
| `isSolved()` after each above | true | §4 |
| `invertAlg()` round-trip | `applyAlg(inv(alg)).applyAlg(alg)` = solved | general |

**Slot ordering** — `lessons.md §1`, `cubing-js-architecture.md §2`:

| Test | Expected | Source |
|------|----------|--------|
| Solved `toRawPattern()` CORNERS `pieces[0]` | 0 (URF at slot 0, NOT ULB) | §1 |
| Solved CORNERS all `pieces[i] === i` | true | arch §4 |
| Solved EDGES all `pieces[i] === i` | true | arch §4 |
| Solved all `orientation[i] === 0` | true | arch §4 |
| After R: CORNERS slot 0 piece | non-zero (URF moves) | §1 |
| After L: CORNERS slot 0 piece | 0 (URF unaffected by L) | §1 |

**Orientation formula** — `lessons.md §3`, `cube-physical-rules.md §4.1`:

| Test | Expected | Source |
|------|----------|--------|
| After R: URF corner (slot 0) orientation | 1 | §3 |
| After R R': slot 0 orientation | 0 (restored) | §3 |
| Orientation formula `(s - o + 3) % 3` gives correct face colour for twisted corner | true | §3 |
| Alternative formula `(s + o) % 3` gives WRONG colour | true (negative test) | §3 |

**isSolved with whole-cube rotation** — `lessons.md §14`, `cubing-js-architecture.md §8`:

| Test | Expected | Source |
|------|----------|--------|
| `solved.applyAlg(['z2']).isSolved({ ignorePuzzleOrientation: true })` | true | §14, arch §8 |
| `solved.applyAlg(['z2']).isSolved()` (no flag) | throws or false | §14 |

**U/D direction cross-check** — `lessons.md §5, §10`, `cube-physical-rules.md §3.4`:

| Test | Expected | Source |
|------|----------|--------|
| cubing.js `applyAlg(["U"])` L[0,1,2] | F, F, F (same as WCA U') | §5 |
| `applyAlg(["R","F","L","B"])` cross-checkable against WCA perm | yes — R,F,L,B match WCA | §10 |
| Multi-move alg with U/D NOT cross-checked against WCA | N/A — document restriction | §10 |

---

### CubeStickering (priority 2)

**Orbit string parsing** — `cubing-js-stickering.md §2–3`, `cube-physical-rules.md §5`:

| Test | Expected | Source |
|------|----------|--------|
| All 15 `MASK_PRESETS` parse without error | true | §4 stickering doc |
| `full` preset: all 26 cubelets in visMap | true | general |
| `oll` preset: exactly 8 U-layer corner+edge slots visible (not counting centre) | true | §3 stickering doc |
| `cross` preset: U centre + 4 top edges (5 cubelets) visible | true | general |
| `fromOrbitStringWithState` called twice with same args | identical Maps | §12 lessons |
| visMap keys are `"x,y,z"` format strings (homePos, not currentPos) | true | §13 lessons |

**'O' primary sticker semantics** — `lessons.md §17`, `cubing-js-stickering.md §2–3`:

| Test | Expected | Source |
|------|----------|--------|
| U-home piece (y=1): 'O' → slot 2 visible, slots 0,4 grey | vis[2]=true, vis[0]=false | §17 lessons |
| D-home piece (y=-1): 'O' → slot 3 visible | vis[3]=true | §17 lessons |
| Equatorial F-edge (y=0, z=1): 'O' → slot 4 visible | vis[4]=true | §17 lessons |
| 'O' semantics = piece's OWN facelet[0], NOT what faces primary direction | true | §17 lessons, stickering §2 |

**Idempotency** — `lessons.md §12, §15`:

| Test | Expected | Source |
|------|----------|--------|
| `fromOrbitStringWithState(str, raw)` → same result if called twice | identical | §12 |
| `applyStickering` preceded by `restoreColours` gives clean result (no accumulation) | true | §12 |

### CubePlayer (priority 2 — integration)

These test the playback engine in isolation with a mock renderer. No DOM or WebGL required.

**State and sequencing:**

| Test | Expected |
|------|----------|
| `loadAlg("R U R'")` → `moveCount` | 3 |
| `loadAlg("R U R'")` → `stepIndex` | 0 |
| `loadAlg` emits `reset` event | payload `{}` |
| `jumpTo(2)` → `stepIndex` | 2 |
| `jumpTo(-1)` clamps → `stepIndex` | 0 |
| `jumpTo(99)` clamps → `stepIndex` | `moveCount` |
| `_stateAt(0)` on empty alg | solved state |
| `_stateAt(n)` with setup moves | `_baseState.applyAlg([...setup, ...moves.slice(0,n)])` |

**Event sequence during play (mock renderer):**

| Test | Expected |
|------|----------|
| `play()` on 3-move alg → move events | 3 events with correct `{index, move, state}` |
| `move` event `index` after first move | 1 |
| `move` event `state` matches `_stateAt(index)` | true |
| `play()` emits `complete` after last move | true |
| `pause()` mid-sequence → `isPlaying` | false after current move |
| `play()` from step N (not 0) → `complete` fires | after remaining moves |
| `play()` from last step → wraps to 0 | yes |
| `play()` while already playing → no-op | true |

**Speed and stickering:**

| Test | Expected |
|------|----------|
| `setSpeed(2.0)` → `renderer.setSpeed` called with | `150` (= 300/2) |
| `setSpeed(0.5)` → effective ms | `600` |
| `setSpeed(0.001)` clamps | `Math.round(300/0.05)` |
| `setStickering(str)` with loaded alg → `_stickering` | `str` |
| `setStickering(null)` → `_stickering` | `null` |

**Mock renderer approach**: stub `CubeRenderer3D` with a fake `animateMove(move, onDone)` that calls `onDone()` synchronously (or via a microtask) — avoids Three.js dependency entirely.

### CubeRenderer3D geometry (lower priority — partial unit test, rest is visual)

**stickerIndex formula** — `lessons.md §6`, `cubing-js-architecture.md §7`:

| Test | Expected | Source |
|------|----------|--------|
| All 8 corner `homePos` × 3 sticker slots match CORNER_POSITIONS table | true | §2, §6 lessons |
| `stickerIndex` for U face: `idx(x, z)` (NOT `idx(x,-z)`) | correct | §6 lessons |
| `stickerIndex` for D face: `idx(x, -z)` (NOT `idx(x,z)`) | correct | §6 lessons |
| `stickerIndex` U and D formulas are mirror images of each other | true | §6 lessons |

**MOVE_AXIS directions** — `lessons.md §5`, `cube-physical-rules.md §3.4`:

| Test | Expected | Source |
|------|----------|--------|
| U axis `dir` | -1 (cubing.js flips vs WCA) | §5, physical §3.4 |
| D axis `dir` | +1 | §5 |
| E axis `dir` | +1 (follows D) | §5 |
| R, L, F, B axis `dir` | match WCA (no flip) | §5 |

**faceCW cycle direction** — `lessons.md §9`:

| Test | Expected | Source |
|------|----------|--------|
| After R: F[2,5,8] | D[2,5,8] (not U — cycle is CW) | §9 |
| `[off, off+2, off+8, off+6]` is the CW cycle (TL→TR→BR→BL) | true | §9 |
| `[off, off+6, off+8, off+2]` is CCW (the trap) | confirmed wrong | §9 |

**Mask travel invariant** — `lessons.md §16`:

Test with mock renderer: after `setStickering(str)` then `play()`, verify `_reapplyStickering` is NOT called inside `animateMove` callbacks (CubePlayer integration test — already covered in CubePlayer section above).

### CubeExporter (priority 3)

**`_resolve` — pure state computation, no DOM:**

| Test | Expected |
|------|----------|
| `_resolve("R U R'", null)` → `setupMoves` | `invertAlg(["R","U","R'"])` = `["R","U'","R'"]` |
| `_resolve("R U R'", null)` → `state` | solved.applyAlg(setupMoves) |
| `_resolve("", null)` → `state` | solved state |
| `_resolve(cubeState, null)` → `state` | the same CubeState instance passed in |
| `_resolve(cubeState, null)` → `setupMoves` | `[]` |
| `_resolve("R U R'", "z2")` → `setupMoves` | `[...invertAlg(["R","U","R'"]), "z2"]` |
| `_resolve` with `setupAlg` appended after invertAlg | correct order |

**`toPNG` routing and output format (jsdom + node-canvas):**

| Test | Expected |
|------|----------|
| `toPNG("R U R'", { style: '2d' })` → return type | string starting with `data:image/png;base64,` |
| `toPNG("R U R'", { style: '2d', size: 288 })` → canvas size | 288×288 |
| `toPNG("R U R'", { style: '2d', stickering: ollStr })` → no throw | true |
| `toPNG(solvedState, { style: '2d' })` → output | data URL (not empty) |
| `toPNG` with `style: '3d'` | skip in headless CI (WebGL) |

**Stickering applied to export:**

| Test | Expected |
|------|----------|
| `toPNG` with `stickering` null → visMap passed to renderer | `new Map()` (empty) |
| `toPNG` with valid orbit string → visMap passed to renderer | non-empty Map |
| Stickering computed from the correct state (resolved, not solved) | true |

### CubeRenderer2D (priority 3 — needed for 2D export)

**Rendering contract (jsdom + node-canvas):**

| Test | Expected |
|------|----------|
| `new CubeRenderer2D(null, { size: 400, canvas })` → no throw | true |
| `renderer.update(solvedState, new Map())` → no throw | true |
| `renderer.toDataURL('image/png')` → data URL | string starting `data:image/png` |
| `renderer.update(state, visMap)` called twice → no throw | true (idempotent) |
| `renderer.destroy()` → no throw | true |
| `transparent: true` option → canvas background alpha = 0 | true (pixel check) |
| Solved state renders correct face colours (U=white, R=red, etc.) | sample pixel per face |

**Face layout sanity (pixel sampling):**

The 2D view renders a top-down cross with U in the centre and side strips. Pixel sampling after `update(solved, emptyMap)`:
- Centre region → U face colour (white)
- Top strip → B face colour (blue)
- Right strip → R face colour (red)
- Bottom strip → F face colour (green)
- Left strip → L face colour (orange)

These pixel tests catch `stickerIndex` U/D swap (§6), face ordering bugs, and `faceCW` cycle direction errors (§9) that only appear in multi-move sequences on the 2D view.

---

## Tooling

- **Vitest** — ESM-native, no bundler required, works with `"type": "module"`
- Tests in `cubify-harness/test/`
- **Pure Node.js** (no DOM): `CubeState`, `CubeStickering`, `CubePlayer` (with mock renderer), `CubeExporter._resolve`
- **jsdom + node-canvas**: `CubeRenderer2D`, `CubeExporter._render2D` — canvas API available without a browser
  - `npm install --save-dev canvas` (node-canvas); configure `vitest.config` with `environment: 'jsdom'` for those test files
  - Alternative: use Vitest's browser mode with Playwright for canvas tests
- **WebGL (skip in CI)**: `CubeRenderer3D` visual tests and `CubeExporter._render3D` — mark `.skip` in headless CI; Playwright acceptance tests cover these
- **`CubePlayer` mock**: inline stub implementing `animateMove(move, onDone)` (calls `onDone()` synchronously), `animateAlg`, `resetToSolved`, `applyMovesInstant`, `restoreColours`, `applyStickering`, `setSpeed`, `mount`, `get isAnimating`
- **Test file organisation**:
  - `test/cube-state.test.js` — CubeState, AlgParser
  - `test/cube-stickering.test.js` — CubeStickering
  - `test/cube-player.test.js` — CubePlayer with mock renderer
  - `test/cube-exporter.test.js` — CubeExporter._resolve (pure) + _render2D (jsdom)
  - `test/cube-renderer-2d.test.js` — CubeRenderer2D canvas rendering (canvas path)
  - `test/cube-renderer-2d-svg.test.js` — **migrated from `demo/export-test.mjs`** (see below)
  - `test/cube-renderer-3d.test.js` — CubeRenderer3D geometry (stickerIndex, MOVE_AXIS); .skip for WebGL

### Migration: demo/export-test.mjs → test/cube-renderer-2d-svg.test.js

`cubify-harness/demo/export-test.mjs` is a test, not a demo. It:
- Runs 3 named test cases (Sune OLL, T-Perm PLL, full solved)
- Asserts SVG structure: exactly 13 `<rect>` elements + 8 `<polygon>` corner quads
- Asserts PNG output is non-trivially sized (> 1000 bytes)
- Sets `process.exitCode = 1` on any failure

Migration tasks:
- Move to `test/cube-renderer-2d-svg.test.js` and convert assertions to `expect()`
- SVG structure checks (`rectCount`, `triCount`) become `expect(rects).toBe(13)` etc. — no dependency changes
- PNG validation via sharp can stay as an integration test or be dropped in favour of the SVG assertions alone (the SVG structure check is the meaningful assertion; PNG byte count is a proxy)
- Delete `demo/export-test.mjs` once migrated; delete the `demo/` directory if empty
- Add to `npm test` in `cubify-harness/package.json`

---

## Acceptance Criteria

- [ ] `npm test` in `cubify-harness/` runs all tests (pure + jsdom tiers)
- [ ] All `CubeState` tests pass — slot ordering, orientation formula, isSolved, U/D direction, toFaceArray ground truth
- [ ] All `CubeStickering` tests pass — preset parsing, 'O' primary slot semantics, homePos keying, idempotency
- [ ] All `CubePlayer` sequencing and event tests pass with mock renderer
- [ ] `CubeExporter._resolve` tests pass — alg inversion, CubeState passthrough, setupAlg ordering
- [ ] `CubeRenderer2D` canvas tests pass — data URL output, face colour layout, transparent mode, idempotency
- [ ] `CubeExporter._render2D` tests pass — data URL format, size, stickering applied
- [ ] `CubeRenderer3D` geometry tests pass — stickerIndex formula, MOVE_AXIS directions, faceCW cycle (WebGL tests `.skip` in CI)
- [ ] `demo/export-test.mjs` migrated to `test/cube-renderer-2d-svg.test.js`; `demo/` directory removed
- [ ] All CI-eligible tests run without a headed browser
- [ ] Each failing test references its source lesson (e.g. `// lessons §3`, `// arch §8`) in the test description
