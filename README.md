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
| `CubeTheme` | Theme system — `THEME_PRESETS` (default/rubiks/speed-dark/speed-light), `DEFAULT_THEME`, `effectiveColours()`, `themeToJSON/themeFromJSON` |
| `CubeRenderer2D` | Top-down 2D renderer — `toSVG()` (static, no DOM), canvas `update()` / `toDataURL()`, `setTheme()` |
| `CubeRenderer3D` | Three.js 3D renderer — `animateMove()` (full wide-move support), `setSpeed()`, `applyStickering()`, `snapshotAt()`, `setTheme()` |
| `CubePlayer` | Animation engine — `loadAlg()`, `play/pause/jumpTo/reset`, `setSpeed()`, `setStickering()`; events (`move`, `complete`, `reset`) |
| `CubeExporter` | `toPNG(alg, { style: '2d'\|'3d' })` — transparent PNG export |

TypeScript definitions: [`types/index.d.ts`](types/index.d.ts)

## Development

```bash
npm install        # install all dependencies
npm test           # run Vitest suite (181 pass, 10 skip)
npm run dev        # start Vite dev server (cubify-harness/index.html)
npm run typecheck  # tsc type-check + emit declarations to types/
```

## cubify-harness

Interactive browser dev environment — algorithm selector, play/step controls, export buttons.

<img src="screenshot.png" width="900" alt="cubify-harness" />

| File | Description |
|------|-------------|
| `cubify-harness/index.html` | Interactive harness UI |
| `test/` | Vitest suite — 181 tests, no headed browser |
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

## React Usage

cubify has no React dependency — the library is plain ES modules. For React apps, wrap the imperative API using `useRef` + `useEffect`:

```tsx
// <CubePlayer> — animated algorithm player
<CubePlayer alg="R U R' U R U2 R'" stickering="oll" theme="speed"
            playing={isPlaying} onComplete={() => setPlaying(false)}
            style={{ width: 320, height: 320 }} />

// <CubeState> — static snapshot (no animation)
<CubeState alg={scramble} style={{ width: 120, height: 120 }} />
```

See [`specs/029-cubify-react/quickstart.md`](specs/029-cubify-react/quickstart.md) for full usage examples, prop reference, and Vite alias setup. The reference implementation lives in `cfop-app/src/lib/cubify/`.

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

**Status**: Features 022–029 complete (+ wide move support) • 030–032 planned
