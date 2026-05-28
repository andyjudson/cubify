# Cubify library

Cubify is a 3×3 cube rendering library for CFOP apps. Delegates permutation state and move application to cubing.js, then owns the rendering layer — typed theme system, stickering API for CFOP case visualisation, and React wrappers that expose cube state as a first-class value.

## Packages

This repo is an npm workspace publishing two packages to [GitHub Packages](https://github.com/andyjudson?tab=packages):

| Package | Description |
|---------|-------------|
| `@andyjudson/cubify` | Core cube library — state, rendering, animation, export |
| `@andyjudson/cubify-react` | React wrappers — `<CubePlayerComponent>`, `<CubeStateComponent>`, `<CubeMoveTape>`, `<CubePlayerControls>` |

## Install

```bash
# .npmrc (add to your project)
@andyjudson:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}

# Install
npm install @andyjudson/cubify three cubing
npm install @andyjudson/cubify-react react react-dom react-icons  # if using React
```

GitHub Packages requires auth even for public packages. Use a GitHub PAT with `read:packages` scope locally; in CI use `GITHUB_TOKEN`.

See [`specs/cubify.md`](specs/cubify.md) for full setup, usage examples, local dev workflow, and architecture reference.

## Library API (`@andyjudson/cubify`)

| Module | Description |
|--------|-------------|
| `CubeState` | cubing.js KPattern wrapper — `applyMove/applyAlg`, `toFaceArray()`, `isSolved()`, `invertAlg()` |
| `CubeScramble` | Scramble generator — `CubeScramble.random(length?)` sync; `CubeScramble.wca()` async WCA random-state via twips WASM |
| `CubeSolver` | Kociemba 2-phase solver — `new CubeSolver()` → `solve(state)`, `cancel()`, `dispose()`; runs in a web worker |
| `AlgParser` | WCA notation parser (face turns, wide moves, slice moves, rotations) |
| `CubeStickering` | CFOP orbit-string masking; `MASK_PRESETS` (15 presets); chars -/I/D/O/S/P |
| `CubeTheme` | Theme system — `THEME_PRESETS` (default/rubiks/speed-dark/speed-light), `DEFAULT_THEME` |
| `CubeRenderer2D` | Top-down 2D renderer — `toSVG()`, canvas `update()`, `setTheme()` |
| `CubeRenderer3D` | Three.js 3D renderer — `animateMove()`, `setSpeed()`, `applyStickering()`, `snapshotAt()` |
| `CubePlayer` | Animation engine — `loadAlg()`, `play/pause/jumpTo/reset`, events (`move`, `complete`, `reset`) |
| `CubeExporter` | `toPNG(alg, { style: '2d'\|'3d' })` — transparent PNG export |

## Development

```bash
npm install                               # install workspace deps
npm test                                  # Vitest suite (237 pass, 10 skip)
npm run dev                               # Vite dev server → cubify-harness/index.html
npm run build --workspace=packages/cubify          # tsc build → packages/cubify/dist/
npm run build --workspace=packages/cubify-react    # tsc build → packages/cubify-react/dist/
```

## Publishing

```bash
bash scripts/version-bump.sh 1.1.0   # bumps both packages, commits, tags
git push && git push --tags           # triggers publish.yml CI → GitHub Packages
```

## cubify-harness

Interactive browser dev environment — algorithm selector, play/step controls, export buttons.

<img src="screenshot.png" width="900" alt="cubify-harness" />

| File | Description |
|------|-------------|
| `cubify-harness/index.html` | Interactive harness UI |
| `packages/cubify/test/` | Vitest suite — 237 tests, no headed browser |
| `cubify-harness/verify-perms.mjs` | 18-test permutation cross-check against cubing.js ground truth |

## cubify-scripts

Node.js CLI for on-demand cube image generation. Used as the `/cubify` Claude Code skill.

```bash
node cubify-scripts/cubify.mjs "R U R' U R U2 R'"
node cubify-scripts/cubify.mjs --case oll_sune --masked --2d
node cubify-scripts/cubify.mjs --file algs-cfop-oll.json --masked --2d
```

Requires headful Chromium (WebGL blocked in headless on macOS):

```bash
cd cubify-scripts && npx playwright install chromium
ln -s /path/to/cfop/cfop-app/public/data cubify-scripts/data
```

## Reference Docs

| Doc | Content |
|-----|---------|
| [`specs/cubify.md`](specs/cubify.md) | Quickstart, usage examples, local dev workflow, architecture |
| [`specs/cube-concepts.md`](specs/cube-concepts.md) | Face state and KPattern concepts overview |
| [`specs/cube-physical-rules.md`](specs/cube-physical-rules.md) | Physical cube geometry, CFOP conventions, masking philosophy |
| [`specs/cube-mapping-lessons.md`](specs/cube-mapping-lessons.md) | Hard-won implementation gotchas (slot ordering, orientation formula, animation) |
| [`specs/cubing-js-architecture.md`](specs/cubing-js-architecture.md) | Cubing.js KPuzzle/KPattern data model, orbit slot ordering, move application |
| [`specs/cubing-js-stickering.md`](specs/cubing-js-stickering.md) | Cubing.js stickering architecture, orbit string char semantics |
| [`specs/cubing-js-solver.md`](specs/cubing-js-solver.md) | Cubing.js solver architecture — search strategy, worker protocol |
| [`specs/cfop-theory.md`](specs/cfop-theory.md) | CFOP mathematics and group theory background |

## Built With

- **[cubing.js](https://github.com/cubing/cubing.js)** (Lucas Garron & Tom Rokicki) — KPuzzle/KPattern permutation state model, WCA alg parsing, move application, and the 3×3 puzzle definition that cubify builds its rendering layer on top of
- **Three.js** — 3D rendering
- **Playwright** (cubify-scripts only) — headful Chromium screenshot capture

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Status**: Features 022–033 complete • 034 in progress
