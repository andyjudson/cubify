# CLAUDE.md

Project context for Claude Code. See `specs/spec.md` for the feature ledger.

## Project Scope

- **Repo:** `cubify` — a clean-room 3×3 cube rendering and logic library
- **Library:** `packages/cubify/src/` — canonical library source; public entry point is `packages/cubify/src/index.ts`
- **React wrappers:** `packages/cubify-react/src/` — React components published as `@andyjudson/cubify-react`
- **Harness:** `cubify-harness/` — browser test harness + Vitest suite; imports from `../packages/cubify/src/`
- **Scripts:** `cubify-scripts/` — Node.js CLI for cube image generation (`/generate-png` skill)
- This repo has no deployed app. All work is local development and library development.

## Current Status

Features 022–035 complete. Feature 035 (cubify-solver-cfop-flags): `beginner?: boolean` flag on `CfopSolverOptions` — intuitive F2L (fluid priority loop + 8-entry trigger table), 2-look OLL (EOLL + OCLL), 2-look PLL (CPLL + EPLL); 9-stage solution. 259 Vitest tests. cfop-migration tracked in cfop repo as Feature 022.

## Reference Docs — Ground Truth

**Before planning or implementing any cube state, rendering, stickering, or animation code, read all five reference docs:**

| Doc | Purpose |
|-----|---------|
| [`specs/cubing-js-architecture.md`](specs/cubing-js-architecture.md) | Cubing.js KPuzzle/KPattern data model, orbit slot ordering, move application |
| [`specs/cubing-js-stickering.md`](specs/cubing-js-stickering.md) | Cubing.js Stickering architecture, orbit string char semantics |
| [`specs/cube-physical-rules.md`](specs/cube-physical-rules.md) | Physical cube geometry, CFOP conventions, masking philosophy |
| [`specs/cube-mapping-lessons.md`](specs/cube-mapping-lessons.md) | Hard-won implementation gotchas (slot ordering, orientation formula, animation) |
| [`specs/cube-concepts.md`](specs/cube-concepts.md) | Face state and KPattern concepts overview |

Key facts from `cube-mapping-lessons.md`:

- Cubing.js KPattern corner/edge slot ordering (§1–2) — the documented order is wrong; verified order is 0=URF
- Orientation formula: `(s - orientation + 3) % 3` for corners — NOT `(s + orientation) % 3` (§3)
- `stickerIndex` formulas for all 6 faces — U and D are easy to swap (§6)
- Cubing.js `U`/`D` = WCA `U'`/`D'` — animation-only fix, do not translate state (§5)
- `faceCW` cycle direction trap — `[off,off+6,off+8,off+2]` is CCW, not CW (§9)
- Animation sequencing — never call `onDone` synchronously from inside the render tick (§7)
- Physical rendering architecture — bake colours once at `setState()`, never reassign after animation (§8)

## Mask Rendering Rules

- **Mask travels with the cubelet** — grey sticker materials are baked into Three.js mesh materials at `applyStickering()`. When a move animates the mesh, materials travel with it — no reapplication needed.
- **Never reapply mask in animation callbacks** — call `applyStickering()` only on case load, mask change, or state reset.
- **Identity-based rendering** — the vis map is keyed by `homePos` (piece identity, never changes through moves).
- **`CubeExporter.toPNG` stickering must use slot-based visMap** — `getVisLevel` in `CubeRenderer2D` looks up by solved-state orbit position keys, so the visMap must be built with `fromOrbitString` (null rawPattern). Calling `fromOrbitStringWithState(str, state.toRawPattern())` rekeys the map by current piece home positions, causing mismatches after any cube rotation (z2 etc.) and making U face look all-dim. `CubeExporter.toPNG` must call `fromOrbitString(stickering)` only.

## Library Architecture (`packages/cubify/src/`)

| File | Role |
|------|------|
| `src/index.ts` | Public entry point — re-exports all public API |
| `src/CubeState.ts` | Cubing.js KPattern wrapper; `applyMove/applyAlg`, `toFaceArray()`, `invertAlg()` |
| `src/CubeTheme.ts` | Theme object, `THEME_PRESETS` (default/rubiks/gan/speed), `DEFAULT_THEME`, `effectiveColours()`, `themeToJSON/FromJSON` |
| `src/CubeRenderer3D.ts` | Three.js 3D renderer; `setState()`, `animateMove()`, `setSpeed()`, `setStickering()`, `snapshotAt()`, `setTheme()` |
| `src/CubeRenderer2D.ts` | Canvas 2D top-down view; `toSVG()`, `update()`, `setTheme()` |
| `src/CubeStickering.ts` | Orbit-string mask parsing; `MASK_PRESETS` (15 presets); chars -/I/D/O/S/P |
| `src/CubePlayer.ts` | Animation engine; `loadAlg()`, `play/pause/jumpTo/reset`, `setSpeed()`, `setStickering()`, events |
| `src/CubeExporter.ts` | `toPNG(alg, { style: '2d'\|'3d' })`; 2D via canvas, 3D via CubeRenderer3D |
| `src/CubeScramble.ts` | Scramble generator; `CubeScramble.random(length?)` (pure JS, sync); `CubeScramble.wca()` (async, WCA random-state via twips WASM) |
| `src/CubeSolverKociemba.ts` | Kociemba solver facade; `new CubeSolverKociemba()` → `solve(state, options?)`, `cancel()`, `dispose()`; runs in web worker |
| `src/CubeSolverCfop.ts` | CFOP solver facade; `new CubeSolverCfop()` → `solve(state, options?)`, `cancel()`, `dispose()`; runs in web worker |
| `src/twips.worker.ts` | cubing.js WASM delegate — `scramble` + `solve333` actions; shared by `CubeScramble` and `CubeSolverKociemba` |
| `src/cfop/` | CFOP worker internals: `cfop.worker.ts`, `CrossSolver.ts`, `F2lSolver.ts`, `OllSolver.ts`, `PllSolver.ts` |
| `src/AlgParser.ts` | WCA notation parser; wide moves, slice moves, x/y/z rotations |

Build: `npm run build --workspace=packages/cubify` → `packages/cubify/dist/` (JS + declarations).

## React Package (`packages/cubify-react/src/`)

| File | Role |
|------|------|
| `src/index.ts` | Re-exports all React components and types |
| `src/CubePlayerComponent.tsx` | `<CubePlayerComponent>` React wrapper; `CubePlayerHandle` ref interface |
| `src/CubePlayerControls.tsx` | Playback controls; `size?: 'md' \| 'sm'` (44px vs 38px buttons); no `onSpeedChange` — speed is consumer-owned |
| `src/CubeMoveTape.tsx` | Move tape; responsive row sizes — 12/row desktop, 9/row mobile (≤600px), zero tolerance on mobile so 10+ move algs always wrap |
| `src/CubeStateComponent.tsx` | `<CubeStateComponent>` static render component |

Build: `npm run build --workspace=packages/cubify-react` → `packages/cubify-react/dist/`.

## cubify-harness

| File | Role |
|------|------|
| `cubify-harness/index.html` | Interactive harness; imports from `../packages/cubify/src/` |
| `packages/cubify/test/` | Vitest suite — 237 tests, 10 skipped, no headed browser (`npm test`) |
| `cubify-harness/verify-perms.mjs` | 18-test permutation cross-check suite against cubing.js ground truth |

## cubify-scripts Architecture

| File | Role |
|------|------|
| `cubify.mjs` | Entry point; arg parsing; routes to case/file/alg modes |
| `lib/renderer.mjs` | Playwright + Vite dev server (port 5175); navigates to `cubify-harness/renderer.html`; calls `window.cubifyRender()`; writes PNG |
| `lib/lookup.mjs` | JSON case lookup from cfop repo data files |
| `lib/masks.mjs` | `getMask(method, group, mask)` → MASK_PRESETS label |
| `lib/output.mjs` | Output to `.tmp/` at cubify repo root |

### cubify-scripts path config

Algorithm JSON is read via the `cubify-scripts/data` symlink (gitignored), which points to `cfop-app/public/data/`. Create it once with:

```bash
ln -s /path/to/cfop/cfop-app/public/data cubify-scripts/data
```

Override with `CFOP_APP_DIR=/path/to/cfop/cfop-app` env var if needed.

### renderer.html

`cubify-harness/renderer.html` exposes `window.cubifyRender(alg, options)`. When `options.setupAlg` is provided, it **pre-computes** the full sequence as `[setupAlg, ...invertAlg(alg)]` and passes `null` as alg — because `CubeExporter._resolve` applies `setupAlg` AFTER `invAlg`, not before.

## generate-png Skill

The `/generate-png` skill is in `.claude/commands/generate-png.md`. Run directly with:
```bash
node cubify-scripts/cubify.mjs <alg>
node cubify-scripts/cubify.mjs --case oll_sune --masked --2d
node cubify-scripts/cubify.mjs --file algs-cfop-oll.json --masked --2d
```
- 2D renders: `headless: true` (works fine)
- 3D renders: `headless: false` required (WebGL blocked in headless Chromium on macOS)
- Requires Playwright Chromium: `cd cubify-scripts && npx playwright install chromium`
- Output: `.tmp/` at cubify repo root (gitignored)
- z2 is correctly applied for OLL/PLL/F2L cases — stickering works correctly after the `fromOrbitString` fix in `CubeExporter`

## Spec Workflow

- `specs/spec.md` = feature ledger for cubify library series (022–031+)
- `specs/<NNN>-<kebab-name>/` = per-feature lifecycle artifacts
- Features numbered starting at 022; next must follow spec.md sequence

## Local Dev Server (cubify-harness)

```bash
cd cubify-harness
# Check for existing Vite processes first:
ps aux | grep -i vite
npm run dev -- --host 127.0.0.1 --port 5174
# URL: http://127.0.0.1:5174/
```

- Bare specifiers (`cubing/alg`, `three`) require Vite — `index.html` cannot be opened directly in a browser
- Kill existing Vite processes before starting to avoid port conflicts

## Working Style

- Iterate in small steps
- Before any merge/push: run `verify-perms.mjs` cross-check suite

## Local Dev (cubify + cfop-app simultaneously)

`cfop-app/vite.config.ts` supports a `CUBIFY_LOCAL=1` flag that aliases `@andyjudson/cubify` and `@andyjudson/cubify-react` to the local TypeScript sources — no build step, live HMR. `cfop-app/.env.local` (gitignored) holds the flag.

```bash
# One-time setup in cfop repo:
echo "CUBIFY_LOCAL=1" >> cfop-app/.env.local
# Then just:
cd cfop-app && npm run dev
```

CI and fresh clones never have `.env.local`, so they always use the published packages from GitHub Packages.

To publish a new version from cubify repo, use the `/publish <version>` skill — it handles all three steps: bump + tag + CI, cfop-app lock file update, and cfop deploy push.

```bash
# Manual equivalent:
bash scripts/version-bump.sh <version>   # bumps both packages, commits, tags
git push && git push --tags              # triggers publish.yml CI → publishes packages + creates GitHub Release
# then update cfop-app/package-lock.json (see /publish skill for full steps)
```

**Release notes**: `publish.yml` creates a GitHub Release automatically with `--generate-notes` (commits since last tag). There is no CHANGELOG.md — GitHub's auto-generated notes are the source of truth. Do not add a CHANGELOG; it will drift.

## GitHub Packages — Lessons Learned (031)

**`workspace:*` is pnpm/yarn syntax — not supported by npm.** Use the actual version range (`^1.0.0`) in devDependencies for sibling workspace packages. npm workspace resolution picks up the local version when it satisfies the range.

**Any workflow that installs from GitHub Packages needs `packages: read` in its permissions block.** Specifying an explicit `permissions:` key in a GitHub Actions workflow restricts `GITHUB_TOKEN` to exactly those scopes — all others are dropped. Without `packages: read`, `npm ci` gets a 403 even for packages you own.

**Never use `npm install <tarball>` to work around a missing token.** It resolves correctly locally but writes `file:/path/to/tarball.tgz` into `package-lock.json`. CI runners don't have that path and fail with `ENOENT`. Use `npm link` instead if you need a local install without publishing — it doesn't touch the lock file.

**Local installs from GitHub Packages need a classic PAT with `read:packages`.** The `gh` CLI OAuth token (`gho_...`) does not have this scope. Add to `~/.zprofile`:
```bash
export NPM_AUTH_TOKEN=<your-pat>
```

## Playwright / Web Component Automation

When automating or screenshotting a third-party web component:

1. **Inspect structure first** — write a throwaway script to dump shadow root children and bounding rects.
2. **Clip to the visualization element** — find the exact element (canvas, SVG wrapper) and use `page.screenshot({ clip: rect })`.
3. **Use `page.addInitScript()` for intercepts** — runs before any page script.
4. **`headless: false` required for WebGL on macOS** — headless Chromium blocks WebGL regardless of flags.

See `specs/017-cubify-agent-skill/research.md` for the full debugging record.

## Recent Changes
- 035-cubify-solver-cfop-flags (complete): `beginner?: boolean` on `CfopSolverOptions`. Intuitive F2L — fluid priority loop, 8-entry `F2L_TRIGGERS` (FR/FL/BR/BL × connected/disconnected), tier-1 easy insert, tier-2 brute-force setup insert, tier-3/4 R/L extraction. 2-look OLL — `solveTwoLookOll()`, 3-entry `EOLL_CASES`, OCLL reuses OLL subset. 2-look PLL — `solveTwoLookPll()`, `CPLL_CASES` (Aa/Ab/E), `EPLL_CASES` (Ua/Ub/H/Z). Fixed PLL skip AUF bug. Fixed EOLL dot alg (z2-frame). 259 Vitest tests.
- refactor-architecture (complete): `CubeSolverCfop` (renamed from `CfopSolver`), `CubeSolverKociemba` (renamed from `CubeSolver`). `CubeSolverInterface<T>` generic interface. `applyAlg()` string-only. `FaceColours` index signature removed. `twips.worker.ts` lifted to `src/`. `CubeState.getPatternData()` @internal. Speed utility extracted to cfop-app. 239 Vitest tests.
- 034-cubify-solver-cfop-method (complete): `CubeSolverCfop` — stage-annotated CFOP solver (cross → F2L×4 → OLL → PLL) running in a dedicated web worker; returns `CfopSolution` with 7 `SolveStage` entries, each carrying `label`, `alg`, `mask`, `caseName`, `wcaId`. IDA* cross + F2L; fingerprint-based OLL (57 cases); WCA PLL recognition with brute-force fallback for all 288 valid pre-PLL states. Harness "Solve (cfop)" button with per-stage mask switching.
- 033-cubify-solver-search-method (complete): `CubeScramble.wca()` async WCA random-state scramble via twips WASM. `CubeSolverKociemba` — Kociemba 2-phase IDA* solver running in a dedicated web worker; `solve(state)`, `cancel()`, `dispose()`. Harness Scramble/Solve buttons. 237 Vitest tests.
- 032-cubify-render-internals (complete): Transparent stickers, inner cubelet walls visible, core mechanism (globe + arm geometry). Theme-consistent material for internals.
- 031-cubify-packages (complete): Repo restructured as npm workspace (`packages/cubify/` + `packages/cubify-react/`). `src/` + `test/` moved to `packages/cubify/`. React wrappers moved from `cfop-app/src/lib/cubify/` to `packages/cubify-react/src/`. Both packages build via `tsc -p tsconfig.build.json` → `dist/`. `.github/workflows/publish.yml` tag-triggered publish to GitHub Packages. `cfop-app` migrated to `@andyjudson/cubify` + `@andyjudson/cubify-react`; `CUBIFY_LOCAL=1` local dev alias via `.env.local`. 181 Vitest tests.
- 029-cubify-react (complete): TypeScript rewrite of core library. React wrappers `<CubePlayer>`, `<CubeState>`, `<CubePlayerControls>`, `<CubeMoveTape>`. CubifyPage interactive harness with case selector, mask/theme controls, playback. 168 Vitest tests.
- 025-cubify-theming (complete): `CubeTheme` interface + `THEME_PRESETS` (default/rubiks/gan/speed) + `DEFAULT_THEME`. `gan` — vivid GAN stickerless colours, white plastic, saturation 2. `speed` — CLASSIC colours, dark plastic, basic material. Both renderers accept `setTheme()`. 168 Vitest tests.
- 028-cubify-library (complete): Library extracted to `src/` at repo root. `src/index.js` public entry. `CubeScramble.js` (pure JS scramble generator). `CubeRenderer3D.setStickering(presetOrString)`, `snapshotAt(size)`. `CubePlayer.setupMoves` getter. `types/index.d.ts` TypeScript definitions. Harness + tests rewired to `../src/`.
- 027-cubify-tests (complete): Vitest suite (138 tests, 10 skipped). `test/cube-state.test.js`, `cube-stickering.test.js`, `cube-player.test.js` (mock renderer), `cube-exporter.test.js`, `cube-renderer-2d-svg.test.js` (migrated from demo/), `cube-renderer-3d.test.js` (MOVE_AXIS constants). `MOVE_AXIS` exported from CubeRenderer3D.js. `npm test` runs without headed browser.
- 024-cubify-animation (complete): `CubePlayer.js` (new) — animation engine owning `CubeRenderer3D`; `loadAlg(notation, setup, {anchor})`, `play/pause/jumpTo/reset`, `setSpeed(scale)`, `setStickering(str)`, event emitter (`move`, `complete`, `reset`). Harness fully wired to CubePlayer events; `liveState` (Moves tab) remains harness-local; stickering not reapplied during animated play — only on jumpTo/reset/loadAlg.
- 026-cubify-export: `CubeRenderer2D.js` (Canvas 2D + transparent option), `CubeExporter.js` (toPNG routing), harness Export 2D / Export 3D buttons (288px, transparent background). `CubeRenderer3D` gains `alpha + preserveDrawingBuffer`.
- 023-cubify-stickering: `CubeStickering.fromOrbitStringWithState()` with full char set (-/I/D/O/S/P), `MASK_PRESETS` (15 presets), harness stickering panel. Mask materials baked on mesh, travel with cubelets.
- 022-cubify-harness: full harness architecture established; `verify-perms.mjs` 18-test suite; cube-mapping-lessons.md documented.

<!-- SPECKIT START -->
- Active plan: [specs/037-cubify-intuitive-f2l-procedures/plan.md](specs/037-cubify-intuitive-f2l-procedures/plan.md) — beginner F2L procedure layer (primary) + counted search safety net; back slots via `y`-conjugation of the front procedure; fall-through counter → 0.
<!-- SPECKIT END -->
