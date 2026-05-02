# CLAUDE.md

Project context for Claude Code. See `specs/spec.md` for the feature ledger.

## Project Scope

- **Repo:** `cubify` — a clean-room 3×3 cube rendering and logic library
- **Library:** `src/` — canonical library source; public entry point is `src/index.js`
- **Harness:** `cubify-harness/` — browser test harness + Vitest suite; imports from `../src/`
- **Scripts:** `cubify-scripts/` — Node.js CLI for cube image generation (`/cubify` skill)
- This repo has no deployed app. All work is local development and library development.

## Current Status

Features 022–028 complete. Features 029–031 planned.

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

## Library Architecture (`src/`)

| File | Role |
|------|------|
| `src/index.js` | Public entry point — re-exports all public API |
| `src/CubeState.js` | Cubing.js KPattern wrapper; `applyMove/applyAlg`, `toFaceArray()`, `invertAlg()` |
| `src/CubeTheme.js` | Theme object, `THEME_PRESETS` (rubiks/modern/minimal), `DEFAULT_THEME`, `effectiveColours()`, `themeToJSON/FromJSON` |
| `src/CubeRenderer3D.js` | Three.js 3D renderer; `setState()`, `animateMove()`, `setSpeed()`, `setStickering()`, `snapshotAt()`, `setTheme()` |
| `src/CubeRenderer2D.js` | Canvas 2D top-down view; `toSVG()`, `update()`, `setTheme()` |
| `src/CubeStickering.js` | Orbit-string mask parsing; `MASK_PRESETS` (15 presets); chars -/I/D/O/S/P |
| `src/CubePlayer.js` | Animation engine; `loadAlg()`, `play/pause/jumpTo/reset`, `setSpeed()`, `setStickering()`, events |
| `src/CubeExporter.js` | `toPNG(alg, { style: '2d'\|'3d' })`; 2D via canvas, 3D via CubeRenderer3D |
| `src/CubeScramble.js` | Pure JS scramble generator; `CubeScramble.random(length?)` |
| `src/AlgParser.js` | WCA notation parser; wide moves, slice moves, x/y/z rotations |
| `types/cubify.d.ts` | TypeScript type definitions for the public API |

## cubify-harness

| File | Role |
|------|------|
| `cubify-harness/index.html` | Interactive harness; imports from `../src/` |
| `test/` | Vitest suite — 167 tests, 10 skipped, no headed browser (`npm test`) |
| `cubify-harness/verify-perms.mjs` | 18-test permutation cross-check suite against cubing.js ground truth |

## cubify-scripts Architecture

| File | Role |
|------|------|
| `cubify.mjs` | Entry point; arg parsing; routes to case/file/alg modes |
| `lib/renderer.mjs` | Playwright headful Chromium + esbuild IIFE bundle; screenshot capture |
| `lib/lookup.mjs` | JSON case lookup from cfop repo data files |
| `lib/masks.mjs` | Orbit string derivation from method + mask field |
| `lib/output.mjs` | Output directory management |

### cubify-scripts path config

Scripts depend on the `cfop` repo for:
- `node_modules/cubing/` (for esbuild bundling and Alg parsing)
- `public/data/*.json` (algorithm JSON files)
- Playwright Chromium (`npx playwright install chromium` from cfop-app)

Default path: `../../cfop/cfop-app` (sibling repo layout). Override with `CFOP_APP_DIR` env var.

```bash
# Default layout (repos side by side):
# /TechLab/cubify/cubify-scripts/
# /TechLab/cfop/cfop-app/

# Or override:
export CFOP_APP_DIR=/path/to/cfop/cfop-app
node cubify-scripts/cubify.mjs --case oll_sune
```

## cubify Skill

The `/cubify` skill is in `.claude/commands/cubify.md`. Run directly with:
```bash
node cubify-scripts/cubify.mjs <alg>
node cubify-scripts/cubify.mjs --case oll_sune
node cubify-scripts/cubify.mjs --file algs-cfop-oll.json
```
- Requires `headless: false` (WebGL blocked in headless Chromium on macOS)
- Requires Playwright Chromium: `cd $CFOP_APP_DIR && npx playwright install chromium`
- Output: `.claude/tmp/cubify/` (gitignored)

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

## Playwright / Web Component Automation

When automating or screenshotting a third-party web component:

1. **Inspect structure first** — write a throwaway script to dump shadow root children and bounding rects.
2. **Clip to the visualization element** — find the exact element (canvas, SVG wrapper) and use `page.screenshot({ clip: rect })`.
3. **Use `page.addInitScript()` for intercepts** — runs before any page script.
4. **`headless: false` required for WebGL on macOS** — headless Chromium blocks WebGL regardless of flags.

See `specs/017-cubify-agent-skill/research.md` for the full debugging record.

## Recent Changes
- 029-cubify-react (planning): React wrapper components. `<CubePlayer>` and `<CubeState>` live in `cfop-app/src/lib/cubify/`. Vite alias `cubify` → `../../../cubify/src/index.ts`. No React in core library (constitution). See `specs/029-cubify-react/plan.md`.
- 025-cubify-theming (complete): `CubeTheme` interface + `THEME_PRESETS` (rubiks/modern/minimal) + `DEFAULT_THEME`. Both renderers accept `setTheme()`. Harness Theming tab with two-column layout, preset buttons, per-face colour pickers, sliders. Hidden stickers use fixed `#888888` grey. 167 Vitest tests.
- 028-cubify-library (complete): Library extracted to `src/` at repo root. `src/index.js` public entry. `CubeScramble.js` (pure JS scramble generator). `CubeRenderer3D.setStickering(presetOrString)`, `snapshotAt(size)`. `CubePlayer.setupMoves` getter. `types/index.d.ts` TypeScript definitions. Harness + tests rewired to `../src/`.
- 027-cubify-tests (complete): Vitest suite (138 tests, 10 skipped). `test/cube-state.test.js`, `cube-stickering.test.js`, `cube-player.test.js` (mock renderer), `cube-exporter.test.js`, `cube-renderer-2d-svg.test.js` (migrated from demo/), `cube-renderer-3d.test.js` (MOVE_AXIS constants). `MOVE_AXIS` exported from CubeRenderer3D.js. `npm test` runs without headed browser.
- 024-cubify-animation (complete): `CubePlayer.js` (new) — animation engine owning `CubeRenderer3D`; `loadAlg(notation, setup, {anchor})`, `play/pause/jumpTo/reset`, `setSpeed(scale)`, `setStickering(str)`, event emitter (`move`, `complete`, `reset`). Harness fully wired to CubePlayer events; `liveState` (Moves tab) remains harness-local; stickering not reapplied during animated play — only on jumpTo/reset/loadAlg.
- 026-cubify-export: `CubeRenderer2D.js` (Canvas 2D + transparent option), `CubeExporter.js` (toPNG routing), harness Export 2D / Export 3D buttons (288px, transparent background). `CubeRenderer3D` gains `alpha + preserveDrawingBuffer`.
- 023-cubify-stickering: `CubeStickering.fromOrbitStringWithState()` with full char set (-/I/D/O/S/P), `MASK_PRESETS` (15 presets), harness stickering panel. Mask materials baked on mesh, travel with cubelets.
- 022-cubify-harness: full harness architecture established; `verify-perms.mjs` 18-test suite; cube-mapping-lessons.md documented.
