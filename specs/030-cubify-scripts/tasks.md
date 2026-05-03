# Tasks: Feature 030 — cubify-scripts migration

**Input**: `specs/030-cubify-scripts/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, contracts/cli.md ✓, quickstart.md ✓

---

## Phase 1: Setup

**Purpose**: Remove stale dependencies and confirm baseline

- [X] T001 Update `cubify-scripts/package.json` — remove TwistyPlayer/esbuild references; confirm `playwright` dep present; update description

---

## Phase 2: Foundational — Renderer page

**Purpose**: `renderer.html` is required by all render paths; must exist before any render tasks can be tested

**⚠️ CRITICAL**: No US1 render work can be verified until this page exists

- [X] T002 Create `cubify-harness/renderer.html` — minimal HTML page importing cubify from `../src/index.ts` (Vite resolves); exposes `window.cubifyRender(alg, options)` calling `CubeExporter.toPNG(alg, { style: options.style ?? '3d', stickering: options.stickering, theme: options.theme, size: options.size ?? 288, setup: options.setup })`; returns PNG data URL string

**Checkpoint**: `http://localhost:5173/renderer.html` loadable in Vite dev server with `window.cubifyRender` callable from console

---

## Phase 3: User Story 1 — Core renderer replacement (P1) 🎯 MVP

**Goal**: `node cubify.mjs R U R'` generates a PNG via cubify CubeExporter — no TwistyPlayer, no esbuild, no cfop-app rendering dependency

**Independent Test**: `node cubify-scripts/cubify.mjs "R U R' U R U2 R'"` writes a PNG to the output dir; file is non-zero; no TwistyPlayer or esbuild involved

### Implementation

- [X] T003 [US1] Rewrite `cubify-scripts/lib/renderer.mjs` — replace entire TwistyPlayer/esbuild/HTTP-server implementation with: (1) spawn `npm run dev` subprocess in cubify root, (2) poll `http://localhost:5173` until ready (max 10s), (3) `chromium.launch({ headless: false })`, (4) navigate to `http://localhost:5173/renderer.html`, (5) `page.evaluate(({ alg, options }) => window.cubifyRender(alg, options), { alg, options })`, (6) base64-decode data URL and write PNG to `options.output`, (7) `browser.close()` + `vite.kill()` in finally block; export `render(alg, options)`
- [X] T004 [US1] Update `cubify-scripts/cubify.mjs` — (1) add symmetric `--2d` / `--3d` flags (default `3d` when neither given; no inference from method), (2) remove `getAlg()` / cubing.js Alg import from `cfop-app/node_modules` — use cubify `AlgParser.parse()` for validation instead, (3) replace `renderCube(config)` calls with `render(alg, { style, output, stickering, theme, size, setup })` from new `renderer.mjs`

**Checkpoint**: Single alg, case lookup, and batch `--file` all produce PNGs via CubeExporter

---

## Phase 4: User Story 2 — Stickering pipeline (P2)

**Goal**: `--stickering`, `--masked`, and `--dim` flags work correctly; case renders use the right MASK_PRESETS label derived from `method + group + mask`; OLL/PLL cases export with appropriate dim stickering

**Independent Test**: `node cubify-scripts/cubify.mjs --case oll_sune --masked --2d` produces a PNG with `oll-face-dim` stickering; `node cubify-scripts/cubify.mjs --case oll_cross_line --masked --2d` produces `oll-cross-dim` stickering; `node cubify-scripts/cubify.mjs --stickering oll-face --dim --alg "R U R'"` resolves to `oll-face-dim`

### Implementation

- [X] T005 [P] [US2] Rewrite `cubify-scripts/lib/masks.mjs` — replace `MASKS` object and `maskForCase(method, mask)` with `getMask(method, group, mask)` returning MASK_PRESETS labels: OLL → `mask==='edge'` gives `oll-cross-dim`, else `oll-face-dim`; PLL → lowercase `group.includes('corner')` or `mask==='corner'` gives `pll-corn-dim`, `group.includes('edge')` gives `pll-edge-dim`, else `pll-face-dim`; f2l → `f2l-dim`; cross → `cross-dim`; default → `full`
- [X] T006 [US2] Add `--stickering`, `--masked`, `--dim` to `cubify-scripts/cubify.mjs` — parse new flags; resolve stickering: `--stickering` value used directly, `--masked` calls `getMask(method, group, mask)` from case JSON, `--dim` appends `-dim` to label only when used with `--stickering` (no-op for `--masked` path where dim is already baked in); forward `group` from case JSON entry to `getMask()`; pass resolved `stickering` to `render()`

**Checkpoint**: `node cubify-scripts/cubify.mjs --file algs-cfop-oll.json --masked --2d` batch-exports all OLL cases with correct per-case stickering labels

---

## Phase 5: User Story 3 — Skill update (P3)

**Goal**: `.claude/commands/cubify.md` accurately documents the new CLI — cubify API, all flags, no stale TwistyPlayer/esbuild references

**Independent Test**: Read the skill file; confirm no mention of TwistyPlayer, esbuild, or cfop-app rendering; all flags from contracts/cli.md are documented

### Implementation

- [X] T007 [P] [US3] Update `.claude/commands/cubify.md` — remove TwistyPlayer/esbuild/cfop-app rendering references; document `--stickering <label|orbitstring>`, `--masked`, `--dim`, `--2d`, `--3d` flags with examples matching contracts/cli.md; note that `--dim` only appends to explicit `--stickering` path

---

## Phase 6: Polish & Validation

- [X] T008 Verify no `cfop-app/node_modules` references remain in `cubify-scripts/` — grep for `ESBUILD`, `TwistyPlayer`, `twisty-bundle`, `cfop-app/node_modules`; remove any remnants
- [X] T009 Run quickstart.md scenarios manually — single alg 3D render, single alg 2D render, case + masked + 2D, batch file; confirm PNGs written and non-zero

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all render verification
- **US1 (Phase 3)**: Depends on Phase 2 (renderer.html must exist)
  - T003 and T004 are sequential (T004 wires the render call that T003 implements)
- **US2 (Phase 4)**: Depends on US1 completion
  - T005 (masks.mjs) can run in parallel with T003 — different files, no dependency
  - T006 depends on T004 (cubify.mjs structure) and T005 (getMask available)
- **US3 (Phase 5)**: Can run after Phase 3 is complete — T007 is documentation only
- **Polish (Phase 6)**: Depends on all user stories complete

### Parallel Opportunities

- T005 (masks.mjs) [P] can run alongside T003 (renderer.mjs) — different files
- T007 (skill update) [P] can run as soon as the flag interface is finalised (after T004)

---

## Parallel Example: US2

```
# T005 and T003 can run at the same time:
Task T003: Rewrite cubify-scripts/lib/renderer.mjs
Task T005: Rewrite cubify-scripts/lib/masks.mjs
# Then T006 once both T004 and T005 are done
```

---

## Implementation Strategy

### MVP (US1 only)

1. T001 — clean up package.json
2. T002 — renderer.html
3. T003 → T004 — new renderer + cubify.mjs wiring
4. **Validate**: `node cubify-scripts/cubify.mjs "R U R' U R U2 R'"` produces a PNG

### Full delivery

1. MVP above
2. T005 + T006 — stickering pipeline
3. T007 — skill docs
4. T008 + T009 — cleanup + quickstart validation
