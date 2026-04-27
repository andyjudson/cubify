# Implementation Plan: 027 — cubify-tests

**Branch**: `027-cubify-tests` | **Spec**: [spec.md](spec.md)

## Summary

Add a Vitest unit suite for `cubify-harness` that encodes the ground truth from the five reference docs. Run without a headed browser — mock renderer for CubePlayer, SVG path for CubeRenderer2D, `.skip` for WebGL tests.

---

## Technical Context

**Language/Version**: TypeScript (strict mode), Node 18+, ESM (`"type": "module"`)
**Test Runner**: Vitest v2 — ESM-native, no bundler, `"type": "module"` compatible
**Target Platform**: Node.js (all tests); browser (WebGL skipped)
**Dependencies added**: `vitest ^2.1.9` (devDependency in `cubify/package.json`)
**Storage**: N/A
**Performance**: All tests run in < 2s (no headed browser)

---

## Key Design Decisions

### CubePlayer — mock renderer via vi.mock()

`CubePlayer` hardcodes `new CubeRenderer3D()` in its constructor. Vitest hoists `vi.mock()` before any import so the mock is in place before `CubePlayer` loads:

```ts
vi.mock('../src/CubeRenderer3D.ts', () => ({
  CubeRenderer3D: class {
    _speedMs: number;
    mount: ReturnType<typeof vi.fn>;
    animateMove: ReturnType<typeof vi.fn>;
    abortAnimation: ReturnType<typeof vi.fn>;
    // ... all methods declared as typed fields (TypeScript strict mode)
    constructor() {
      this.animateMove = vi.fn((move: string, onDone: () => void) => onDone());
      this.abortAnimation = vi.fn();
      mockRenderer = this;
    }
    get isAnimating() { return false; }
  }
}));
```

The mock captures its instance in a module-level `let mockRenderer: any` variable so tests can inspect calls. All methods must be declared as typed fields — TypeScript strict mode requires this for `vi.fn()` assignments in a class body.

### CubePlayer play() timing — vi.useFakeTimers()

`CubePlayer._playNext()` uses `setTimeout` between moves. Mock `animateMove` calls `onDone()` synchronously, so fake timers drain the entire play chain:

```js
vi.useFakeTimers();
player.play();
await vi.runAllTimersAsync();
// all move + complete events have fired
```

### CubeRenderer2D — SVG path, no DOM

`CubeRenderer2D.toSVG()` is a static pure-JS method (no canvas, no DOM). All 2D structure tests use it — no `jsdom` or `node-canvas` required. Canvas tests are guarded with `CUBIFY_CANVAS_TESTS=1` and all `.skip` by default.

### MOVE_AXIS export

`MOVE_AXIS` was a module-level `const` in `CubeRenderer3D.ts`. Added `export` keyword so tests can import it without loading WebGL.

### demo/export-test.mjs migration

`demo/export-test.mjs` was a test masquerading as a demo. Its SVG structure assertions (13 rects, 8 corner polygons) were migrated to `test/cube-renderer-2d-svg.test.js`. The sharp PNG byte-count assertion was dropped (proxy metric, not a meaningful invariant). `demo/` directory deleted.

---

## Project Structure

```
cubify/                          # repo root
├── src/
│   └── CubeRenderer3D.ts        # MODIFIED — export added to MOVE_AXIS
├── test/                        # test suite lives at repo root (not under harness)
│   ├── cube-state.test.ts       # 32 tests — toFaceArray, slot ordering, orientation
│   ├── cube-stickering.test.ts  # 20 tests — MASK_PRESETS, orbit string chars
│   ├── cube-player.test.ts      # 40 tests — mock renderer, play/pause/jumpTo/events
│   ├── cube-exporter.test.ts    # 11 tests — _resolve() pure state computation
│   ├── cube-renderer-2d-svg.test.ts  # 15 tests — migrated from demo/
│   ├── cube-renderer-3d.test.ts # 20 tests (4 skipped) — MOVE_AXIS constants
│   └── cube-renderer-2d.test.ts # 6 tests (all skipped) — canvas, opt-in
├── package.json                 # vitest added, test scripts; single package for whole repo
├── vitest.config.js             # at repo root; include: ['test/**/*.test.ts']
└── cubify-harness/
    └── demo/                    # DELETED (migrated to test/)
```

Note: tests were initially scoped to `cubify-harness/test/` but migrated to repo root `test/` when the library source moved to `src/` at root (Feature 028). All test files use explicit `.ts` extension in imports (Vite auto-remapping only applies within the harness project root).

---

## Discovered Ground Truth (corrections to spec)

| Item | Spec said | Actual | Source |
|------|-----------|--------|--------|
| After R: slot 0 orientation | 1 | 2 (DRF piece occupies URF slot, orientation=2) | cube-mapping-lessons §3 |
| FR edge orbit index | slot 9 | slot 8 (`EDGES:IIIIIIIIOIII`) | cubing-js-architecture orbit order |
| OLL bottom edges char | 'I' | '-' (full colour) — cross preset uses 'I' | cubing-js-stickering §2 |

---

## Acceptance Criteria — All Met

- [X] `npm test` at repo root runs 138 tests, 10 skipped, 0 failures
- [X] No headed browser required
- [X] `CubeState` ground truth encoded: toFaceArray, slot ordering, orientation formula, U/D direction
- [X] `CubeStickering` encoded: all 15 MASK_PRESETS, char semantics, homePos keying, idempotency
- [X] `CubePlayer` mock renderer: full play/pause/jumpTo/reset/event sequence; `abortAnimation` stubbed
- [X] `CubeExporter._resolve` pure tests
- [X] `CubeRenderer2D` SVG structure tests (migrated from demo/)
- [X] `CubeRenderer3D` MOVE_AXIS geometry tests; WebGL tests `.skip`
- [X] `demo/export-test.mjs` deleted; `demo/` directory removed
