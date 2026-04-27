# cubify

Clean-room 3×3 cube rendering and logic library. Built to understand and eventually replace Cubing.js TwistyPlayer in the Learning CFOP app with a dependency-free renderer — no IntersectionObserver constraints, no shadow DOM, no baked-in controls, and css themes.

## Library (`src/`)

Clean public API — import from `src/index.js` or consume as an npm package.

| Module | Description |
|--------|-------------|
| `CubeState` | cubing.js KPattern wrapper — `applyMove/applyAlg`, `toFaceArray()`, `isSolved()`, `invertAlg()` |
| `CubeScramble` | Pure JS scramble generator — `CubeScramble.random(length?)`, no cubing.js dependency |
| `AlgParser` | WCA notation parser (face turns, wide moves, slice moves, rotations) |
| `CubeStickering` | CFOP orbit-string masking — `fromOrbitStringWithState()` with full char set (-/I/D/O/S/P); `MASK_PRESETS` (15 presets) |
| `CubeRenderer2D` | Top-down 2D renderer — `toSVG()` (static, no DOM), canvas `update()` / `toDataURL()` |
| `CubeRenderer3D` | Three.js 3D renderer — `animateMove()`, `setSpeed()`, `applyStickering()`, `snapshotAt()` |
| `CubePlayer` | Animation engine — `loadAlg()`, `play/pause/jumpTo/reset`, `setSpeed()`, `setStickering()`; events (`move`, `complete`, `reset`) |
| `CubeExporter` | `toPNG(alg, { style: '2d'\|'3d' })` — transparent PNG export |

TypeScript definitions: [`types/index.d.ts`](types/index.d.ts)

## Development

```bash
npm install        # install all dependencies
npm test           # run Vitest suite (138 pass, 10 skip)
npm run dev        # start Vite dev server (cubify-harness/index.html)
npm run typecheck  # tsc type-check + emit declarations to types/
```

## cubify-harness

Interactive browser dev environment — algorithm selector, play/step controls, export buttons.

<img src="screenshot.png" width="900" alt="cubify-harness" />

| File | Description |
|------|-------------|
| `cubify-harness/index.html` | Interactive harness UI |
| `test/` | Vitest suite — 138 tests, no headed browser |
| `cubify-harness/verify-perms.mjs` | 18-test permutation cross-check against cubing.js ground truth (`npx tsx verify-perms.mjs`) |

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
| [`specs/cubify.md`](specs/cubify.md) | Library architecture — package layout, tsconfig, declaration generation, public API |
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

**Status**: Features 022–024, 026–028 complete • 025, 029–031 planned
