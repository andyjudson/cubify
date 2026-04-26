# cubify

Clean-room 3×3 cube rendering and logic library. Built to understand and eventually replace cubing.js TwistyPlayer in the Learning CFOP app with a dependency-free renderer — no IntersectionObserver constraints, no shadow DOM, no baked-in controls.

## What's Built

### cubify-harness

Browser test harness and library implementation. Open `cubify-harness/index.html` directly — no build step.

<img src="screenshot.png" width="900" alt="cubify-harness" />

| Module | Description |
|--------|-------------|
| `CubeState` | cubing.js KPattern wrapper — `applyMove/applyAlg`, `toFaceArray()`, `invertAlg()` |
| `CubeRenderer3D` | Three.js 3D renderer — `setState()`, `animateMove()`, `animateAlg()`, `setSpeed()`; alpha + preserveDrawingBuffer for PNG export |
| `CubeRenderer2D` | Canvas 2D top-down view (U face + side strips + corner quads); SVG for Node.js; transparent background option |
| `CubeStickering` | CFOP orbit-string masking — `fromOrbitStringWithState()` with full char set (-/I/D/O/S/P); `MASK_PRESETS` (15 presets) |
| `CubeExporter` | `toPNG(alg, { style: '2d'\|'3d' })` — 288px transparent PNG export |
| `AlgParser` | WCA notation parser (face turns, wide moves, slice moves, rotations) |
| `verify-perms.mjs` | 18-test permutation cross-check suite against cubing.js ground truth |
| `demo/export-test.mjs` | Node.js sharp-based PNG validation |

**Design goals:** Clean public API, CSS custom property theming, no hidden dependencies, MIT licensed.

### cubify-scripts

Node.js CLI for on-demand cube image generation. Used as the `/cubify` Claude Code skill.

```bash
node cubify-scripts/cubify.mjs R U R' U'
node cubify-scripts/cubify.mjs --case oll_sune
node cubify-scripts/cubify.mjs --file algs-cfop-oll.json
```

Requires Playwright headful Chromium (WebGL blocked in headless on macOS) and the [cfop](https://github.com/andyjudson/cfop) repo for cubing.js and algorithm data.

**Default layout** (repos side by side in the same parent directory):
```
TechLab/
├── cubify/    ← this repo
└── cfop/      ← cfop repo (provides cubing.js + data)
```

Override with `CFOP_APP_DIR=/path/to/cfop/cfop-app`.

## Reference Docs

| Doc | Content |
|-----|---------|
| [`specs/cubing-js-architecture.md`](specs/cubing-js-architecture.md) | Cubing.js KPuzzle/KPattern data model, orbit slot ordering, move application |
| [`specs/cubing-js-stickering.md`](specs/cubing-js-stickering.md) | Cubing.js Stickering architecture, orbit string char semantics |
| [`specs/cube-physical-rules.md`](specs/cube-physical-rules.md) | Physical cube geometry, CFOP conventions, masking philosophy |
| [`specs/cube-mapping-lessons.md`](specs/cube-mapping-lessons.md) | Hard-won implementation gotchas (slot ordering, orientation formula, animation) |
| [`specs/cube-concepts.md`](specs/cube-concepts.md) | Face state and KPattern concepts overview |

## Built With

- **[cubing.js](https://github.com/cubing/cubing.js)** (Lucas Garron) — KPattern state model
- **Three.js** — 3D rendering
- **Playwright** (cubify-scripts only) — headful Chromium screenshot capture

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Status**: Features 022–023, 026 complete • 024–031 planned
