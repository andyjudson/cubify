# Research: Feature 030 — cubify-scripts migration

## Decision 1: TypeScript imports in Node.js

**Decision**: Not needed — both 2D and 3D paths now run in the Vite/Playwright browser context.

**Rationale**: Since the 2D output format is PNG (see Decision 3), `CubeExporter.toPNG(alg, { style: '2d' })` is the natural path. This runs in the same Playwright browser context as the 3D path, where Vite handles TypeScript resolution. There is no separate Node.js TypeScript import problem to solve.

**Alternatives considered**:
- `--experimental-strip-types` (Node 22+) — would allow a Node.js-only 2D path producing SVG, but ruled out by Decision 3 (PNG preferred for consistency)
- `tsx` / `ts-node` — not needed; browser context handles it via Vite

**Scope**: Moot. `cubify.mjs` entry point is plain `.mjs` (no TypeScript); all cubify source is resolved by Vite inside the browser.

---

## Decision 2: 3D renderer page — Vite dev server subprocess

**Decision**: Spawn the cubify Vite dev server as a subprocess, serve a new `cubify-harness/renderer.html` entry point, navigate Playwright to it.

**Rationale**: The harness already runs via `cd cubify-harness && vite` with no config file — Vite uses root `node_modules/` for bare specifier resolution (Three.js, cubing.js). A new `renderer.html` that imports cubify and exposes a global `window.cubifyRender(alg, options)` function reuses this entire resolved environment at zero extra cost. No esbuild, no bundling, no HTTP server to write.

The renderer.mjs:
1. Spawns `npm run dev` subprocess, waits for `localhost:5173` to respond
2. Playwright navigates to `http://localhost:5173/renderer.html`
3. Calls `window.cubifyRender(alg, options)` → returns PNG data URL
4. Base64-decodes and writes to output file
5. Closes browser and kills Vite subprocess

**Alternatives considered**:
- Custom import-map HTTP server — complex to maintain, needs to know all bare specifiers
- `vite build` + static serve — requires a build step; slower for one-off renders
- Keep esbuild + TwistyPlayer — no longer needed now that CubeExporter exists; defeats the point of the migration

---

## Decision 3: 2D output format

**Decision**: PNG (not SVG) for `--2d` path — same format as `--3d`.

**Rationale**: Consistent PNG output across both paths simplifies the consumer (cfop-app batch pipeline, agent skill). `CubeExporter.toPNG(alg, { style: '2d' })` already produces PNG from `CubeRenderer2D` via canvas — no extra work. Both paths use the same Playwright flow; `--2d` just passes `style: '2d'` to the renderer page.

**Visual note**: `CubeRenderer2D` renders U face + 4 side strips + corner quads — a full cube net, not the top-layer-only view from TwistyPlayer's `experimental-2D-LL`. OLL/PLL stickering applies correctly via `MASK_PRESETS`, just with a different layout. Existing cfop-app case images (rendered with TwistyPlayer 2D LL) will differ visually if regenerated with `--2d`.

**Alternatives considered**:
- SVG via `CubeRenderer2D.toSVG()` — Node.js-safe, no browser needed, but inconsistent output format and requires a separate code path; ruled out by preference for uniformity

---

## Decision 4: Stickering resolution in masks.mjs

**Decision**: Replace raw orbit strings in `masks.mjs` with `MASK_PRESETS` labels; resolve using `method + group + mask` from the case JSON.

**Rationale**: `MASK_PRESETS` labels are the stable public API. Raw orbit strings are implementation detail. The new `getMask(method, group, mask)` returns the correct label directly — dim variants are baked in, not appended via `--dim` for case renders.

**Full mapping** (derived from cfop JSON structure):

| method | mask field | group (lowercased) | Label |
|--------|-----------|-------|-------|
| oll | 'edge' | any | `oll-cross-dim` — edge orientation stage: show U edges, hide corners |
| oll | — | any | `oll-face-dim` — full U-face orientation (1-look or corner stage) |
| pll | 'corner' | any | `pll-corn-dim` — mask field wins; corner permutation only |
| pll | — | contains 'corner' | `pll-corn-dim` — covers 'corner' (bgr) and 'Corners Only' (pll) |
| pll | — | contains 'edge' | `pll-edge-dim` — covers 'edge' (bgr) and 'Edges Only' (pll) |
| pll | — | other | `pll-face-dim` — full permutation (Adjacent Swap, Diagonal Swap, G Perms) |

**Why `group` matters**: `algs-cfop-pll.json` (1-look) has no `mask` field — only `group` ("Corners Only", "Edges Only", etc.). Without reading `group`, all 1-look PLL cases would get the same full-stickering label and lose per-case focus. The current code has this gap; 030 fixes it.

**`--dim` flag scope**: Only applies when `--stickering` is passed explicitly for a single-alg render (e.g. `--stickering oll --dim` → `oll-dim` if it exists). For `--case` / `--file` renders, dim is already encoded in the label returned by `getMask()` — `--dim` is a no-op in that path.

---

## Decision 5: cubing.js dependency in cubify-scripts

**Decision**: Remove the cfop-app node_modules dependency entirely for rendering. Keep `lookup.mjs` reading from `CFOP_APP_DIR/public/data/` (configurable) for case lookup.

**Rationale**: cubing.js is already in cubify's root `node_modules/`. The 2D Node.js path imports `CubeState` from `../src/` which uses cubing.js from there. The 3D Playwright path runs in the Vite context which also has cubing.js. Neither path needs cfop-app for rendering.

Case lookup (`--case`, `--file`) still reads JSON from cfop-app's `public/data/` — that data lives there and cubify doesn't duplicate it. The cfop-app dependency is rendering-only, not data-only.

---

## Module change summary

| File | Change |
|------|--------|
| `cubify-scripts/lib/renderer.mjs` | Rewrite: Vite subprocess + Playwright + renderer.html; remove esbuild/TwistyPlayer |
| `cubify-harness/renderer.html` | New: minimal page exposing `window.cubifyRender(alg, { style, stickering, theme, size })` |
| `cubify-scripts/lib/masks.mjs` | Replace raw orbit strings with MASK_PRESETS labels |
| `cubify-scripts/cubify.mjs` | Add `--stickering`, `--masked`, `--dim`, `--2d` arg parsing; pass `style: '2d'|'3d'` to renderer |
| `.claude/commands/cubify.md` | Update flags, remove esbuild/cfop-app rendering dep note |
