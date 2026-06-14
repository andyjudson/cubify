# CLAUDE.md

Project context for Claude Code. See [`specs/ledger.md`](specs/ledger.md) for the feature ledger.

## Project Scope

- **Repo:** `cubify` — a clean-room 3×3 cube rendering and logic library
- **Library:** `packages/cubify/src/` — canonical library source; public entry point is `packages/cubify/src/index.ts`
- **React wrappers:** `packages/cubify-react/src/` — React components published as `@andyjudson/cubify-react`
- **Harness:** `cubify-harness/` — browser test harness + Vitest suite; imports from `../packages/cubify/src/`
- **Scripts:** `cubify-scripts/` — Node.js CLI for cube image generation (`/generate-png` skill)
- This repo has no deployed app. All work is local development and library development.

## Current Status

Features 022–035 and 037 complete. Latest shipped: 035 added `beginner?: boolean` on `CfopSolverOptions` (intuitive F2L + 2-look OLL/PLL, 9-stage solution). 037 restructured the intuitive F2L solver so encoded procedures (U+R+L+F, back slots via `y2 … y2`) are the primary emitter with a demoted counted-search net; fall-through is 0 over the enumerated domain (~1.5% on real scrambles, covered by the safety net). Also retired the standalone `verify-perms.mjs`: its independent permutation cross-check moved into `packages/cubify/test/cube-perm-model.test.ts`, and `npm test` (294 tests) is now the pre-merge gate. Per-feature scope, status, and what-shipped detail is in the feature ledger [`specs/ledger.md`](specs/ledger.md).

## Reference Docs — Ground Truth

**Before planning or implementing any cube state, rendering, stickering, or animation code, read all five reference docs:**

| Doc | Purpose |
|-----|---------|
| [`specs/cubing-js-architecture.md`](specs/cubing-js-architecture.md) | Cubing.js KPuzzle/KPattern data model, orbit slot ordering, move application |
| [`specs/cubing-js-stickering.md`](specs/cubing-js-stickering.md) | Cubing.js Stickering architecture, orbit string char semantics |
| [`specs/cube-physical-rules.md`](specs/cube-physical-rules.md) | Physical cube geometry, CFOP conventions, masking philosophy |
| [`specs/cubify-lessons.md`](specs/cubify-lessons.md) | Hard-won implementation gotchas (slot ordering, orientation formula, animation, mask rendering) |
| [`specs/cube-concepts.md`](specs/cube-concepts.md) | Face state and KPattern concepts overview |
| [`specs/cubify-notes.md`](specs/cubify-notes.md) | Reference & notes — quickstart, usage, architecture, and operational gotchas (publishing, Playwright automation) |

Key facts from `cubify-lessons.md`:

- Cubing.js KPattern corner/edge slot ordering (§1–2) — the documented order is wrong; verified order is 0=URF
- Orientation formula: `(s - orientation + 3) % 3` for corners — NOT `(s + orientation) % 3` (§3)
- `stickerIndex` formulas for all 6 faces — U and D are easy to swap (§6)
- Cubing.js `U`/`D` = WCA `U'`/`D'` — animation-only fix, do not translate state (§5)
- `faceCW` cycle direction trap — `[off,off+6,off+8,off+2]` is CCW, not CW (§9)
- Animation sequencing — never call `onDone` synchronously from inside the render tick (§7)
- Physical rendering architecture — bake colours once at `setState()`, never reassign after animation (§8)

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
| `packages/cubify/test/` | Vitest suite — no headed browser (`npm test`) |
| `packages/cubify/test/cube-perm-model.test.ts` | Independent cycle-based permutation model cross-checked vs cubing.js (ported from the retired `verify-perms.mjs`) |

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

- `specs/ledger.md` = feature ledger for cubify library series (022→)
- `specs/<NNN>-<kebab-name>/` = per-feature lifecycle artifacts
- Features numbered starting at 022; next must follow ledger.md sequence

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
- Before any merge/push: run `npm test` (the Vitest suite is the pre-merge gate; it includes `cube-perm-model.test.ts`, the independent permutation cross-check that replaced the retired standalone `verify-perms.mjs`)

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

**Release notes**: `publish.yml` creates a GitHub Release automatically with `--generate-notes` (commits since last tag). Those are the **consumer-facing** notes and the source of truth — do not add a root `CHANGELOG.md`; it will drift. The **developer** feature history (scope + what shipped, per feature) lives in the feature ledger [`specs/ledger.md`](specs/ledger.md).

## Reference Files (read-on-demand)

- [`specs/ledger.md`](specs/ledger.md) — feature ledger: per-feature scope, status, and what shipped (022→).
- Targeted lessons live in [`specs/cubify-lessons.md`](specs/cubify-lessons.md): **mask rendering rules** §21 (read before touching stickering/renderers/`CubeExporter`).
- Reference & notes live in [`specs/cubify-notes.md`](specs/cubify-notes.md): quickstart, usage, architecture, and operational gotchas — GitHub Packages publishing (read before publishing), Playwright/web-component automation (read before screenshotting a component).

<!-- SPECKIT START -->
- Active plan: [specs/037-cubify-intuitive-f2l-procedures/plan.md](specs/037-cubify-intuitive-f2l-procedures/plan.md) — beginner F2L procedure layer (primary) + counted search safety net; vocabulary U+R+L+F, back slots via `y2 … y2` conjugation of the opposite front procedure; fall-through counter → 0. See spec.md correction block + research.md Decisions 1/1b for the two user-approved corrections (F-vocabulary; `y2` not `y`/`y'`).
<!-- SPECKIT END -->
