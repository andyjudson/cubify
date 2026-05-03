# Cubify Specification

## Overview

A clean-room 3×3 cube rendering and logic library. Goal: replace cubing.js TwistyPlayer in the cfop learning app with a dependency-free, inspectable renderer with a clean public API. Built incrementally via the cubify-harness test environment.

---

## Feature 022: cubify-harness

### Status: Complete ✅

### Scope
Establish the foundation: cube state model, 3D renderer, stickering, algorithm parser, and interactive test harness. Cross-check all permutation logic against cubing.js ground truth.

### Completed
- `CubeState` — cubing.js KPattern wrapper; `applyMove/applyAlg`, `toFaceArray()`, `invertAlg()`
- `CubeRenderer3D` — Three.js 3D cube; `setState()`, `animateMove()`, `animateAlg()`; `setSpeed()` / `isAnimating` public API
- `CubeStickering` — hardcoded CFOP preset maps: full, cross, f2l, oll, oll-2look, pll, pll-2look
- `AlgParser` — WCA notation parser; handles wide moves, slice moves, x/y/z rotations
- Interactive harness (`index.html`) — algorithm selector, play/step/speed controls, event log / face state / KPattern debug panels
- `verify-perms.mjs` — 18-test cross-check suite; CubeState ground truth + physical facts
- `cube-mapping-lessons.md` — corner/edge slot ordering, orientation formula, animation sequencing, stickerIndex formulas
- cubing.js U/D direction convention documented and animation-only fix applied

---

## Feature 023: cubify-stickering

### Status: Complete ✅

### Scope
Extend stickering to support the full orbit string format used by cubing.js `experimentalStickeringMaskOrbits`, enabling all 15 CFOP preset masks and arbitrary custom masks.

### Completed
- `CubeStickering.fromOrbitStringWithState()` parses orbit strings into `Map<homePos, vis[6]>` — chars -/I/D/O/S/P
- `MASK_PRESETS` (15 presets: basic/OLL/PLL groups with dim variants) as reusable export from CubeStickering.js
- Harness stickering panel with live preset switching, orbit string input, cubelet count logging
- Mask materials baked on Three.js mesh at `applyStickering()`, travel naturally through moves — never reapplied in callbacks

---

## Feature 024: cubify-animation / CubePlayer Engine

### Status: Complete ✅

### Scope
Extract the move sequencing and playback control into a dedicated `CubePlayer` engine that can be driven as a component from outside.

### Completed
- `CubePlayer` — animation engine owning `CubeRenderer3D`; `loadAlg(notation, setup, {anchor})`, `play/pause/jumpTo/reset`, `setSpeed(scale)`, `setStickering(str)`, event emitter (`move`, `complete`, `reset`)
- Full move timeline with configurable inter-move gap; onDone callback chaining (no setTimeout racing)
- Harness fully rewired to CubePlayer events; `liveState` (Moves tab) remains harness-local
- Stickering not reapplied during animated play — only on jumpTo/reset/loadAlg (mask travels with mesh)

---

## Feature 025: cubify-theming

### Status: Complete ✅

### Scope
Named theme presets for sticker colour schemes, plastic colour, gap size, bevel radius, and surface finish.

### Completed
- `CubeTheme` interface — all visual parameters (colours, brightness, saturation, plasticColour, plasticOpacity, gap, bevel, stickerPad, stickerRadius, centerShape, materialType, roughness, metalness)
- `THEME_PRESETS` — 3 named presets: `rubiks` (classic toy feel), `modern` (white plastic, tight gap, physically lit), `minimal` (Twisty colours, dark grey plastic, flat lit)
- `DEFAULT_THEME` — library default speed/clean look
- HSL colour utilities — `hexToHsl`, `hslToHex`, `effectiveColours(theme)` (brightness + saturation scaling)
- `validateTheme`, `cloneTheme`, `getThemePreset`, `themeToJSON`, `themeFromJSON` — full theme management API
- `CubeRenderer3D.setTheme()` — live theme switching; geometry rebuild (gap/bevel) vs material-only path; texture cache invalidation; stickering re-applied automatically
- `CubeRenderer2D.setTheme()` — derives face colours and plastic colour from theme on every render
- Harness Theming tab — preset buttons, per-face colour pickers, brightness/saturation/gap/bevel/pad/radius sliders, frame colour + opacity, JSON export/import
- All exports added to `src/index.ts` and `types/index.d.ts`

---

## Feature 026: cubify-image-export

### Status: Complete ✅

### Scope
PNG export from both the 2D canvas renderer and the 3D WebGL renderer, at exact pixel dimensions with transparent background.

### Completed
- `CubeRenderer2D` — top-down canvas/SVG view: U face + 4 side strips + corner quads; `transparent` option for PNG export
- `CubeExporter.toPNG(alg, { style: '2d'|'3d' })` — 2D via canvas, 3D via CubeRenderer3D with alpha+preserveDrawingBuffer
- Harness Export 2D / Export 3D buttons (288px, transparent background, stickering-aware)
- SVG export validation migrated to `test/cube-renderer-2d-svg.test.js` (spec 027); `demo/` directory removed
- cubify-scripts Playwright migration deferred (requires Node.js WebGL path) ⏳

---

## Feature 027: cubify-tests

### Status: Complete ✅

### Scope
Vitest unit suite covering the core library without a headed browser.

### Completed
- `test/cube-state.test.ts` — 32 tests: toFaceArray ground truth, slot ordering, orientation formula, isSolved, U/D direction, invertAlg round-trip
- `test/cube-stickering.test.ts` — 20 tests: all 15 MASK_PRESETS parse, 'O'/'D'/'S'/'P'/'I' char semantics, homePos keying, idempotency
- `test/cube-player.test.ts` — 40 tests: full play/pause/jumpTo/reset sequence with mock renderer, event emission, setSpeed, setStickering, mask travel invariant
- `test/cube-exporter.test.ts` — 11 tests: `_resolve` pure state computation, alg inversion, CubeState passthrough, setupAlg ordering
- `test/cube-renderer-2d-svg.test.ts` — 15 tests: migrated from `demo/export-test.mjs`; SVG structure invariants (13 rects + 8 corner quads), colour rendering, idempotency
- `test/cube-renderer-3d.test.ts` — 20 tests (4 skipped): MOVE_AXIS directions and axis assignments; WebGL-dependent tests `.skip`
- `test/cube-renderer-2d.test.ts` — canvas tests (all `.skip`; enable with `CUBIFY_CANVAS_TESTS=1` + `npm install canvas`)
- Tests live at repo root `test/` (not under `cubify-harness/`); written in TypeScript
- `vitest.config.js` at repo root; `npm test` runs from `cubify/` — 138 tests, 10 skipped, 0 failures, no headed browser required
- `MOVE_AXIS` exported from `src/CubeRenderer3D.ts` for testability

---

## Feature 028: cubify.js Library API

### Status: Complete ✅

### Scope
Extract cubify-harness core into a clean standalone library with a documented public API surface.

### Completed
- Library source at `src/` — all files TypeScript (`.ts`); `src/index.ts` public entry point
- `package.json` at repo root with `"exports"` and `"types"` fields; `"main": "./src/index.ts"`
- `src/CubeScramble.ts` — pure JS scramble generator (no cubing.js); `CubeScramble.random(length?)`
- `CubeRenderer3D.setStickering(presetOrString)` — accepts MASK_PRESETS label or raw orbit string
- `CubeRenderer3D.snapshotAt(size?)` — transparent PNG export without accessing internal properties
- `CubeRenderer3D.abortAnimation()` — snaps in-flight animation to t=1 to prevent state corruption on mid-animation alg reload
- `CubePlayer.setupMoves` getter — exposes setup move list publicly
- `CubePlayer` generation counter — discards stale `animateMove` callbacks when state is reset mid-animation
- `CubeRenderer2D` added to public exports in `src/index.ts` and `types/index.d.ts`
- `types/index.d.ts` — full TypeScript definitions for all public exports including `CubeRenderer2D`
- Harness rewired: `index.html` imports from `../src/`; `_` property accesses replaced with public API
- `node_modules` consolidated to repo root — harness `package.json` and `node_modules/` removed
- All 138 Vitest tests pass against the root `src/` library
- `/cubify` skill at `.claude/commands/cubify.md` in this repo
- `.gitignore` at repo root covering `node_modules/`, `dist/`, `.claude/tmp/`
- `cubify-scripts` renderer migration deferred (Playwright + Node.js WebGL path) ⏳

---

## Feature 029: cubify-react

### Status: Complete ✅

### Scope
Thin React wrapper components around the cubify library for use in cfop-app.

### Completed
- `<CubePlayer>` — `alg`, `setup`, `stickering`, `theme`, `playing`, `speed`, `style` props; `onMove`, `onReset`, `onComplete` events; imperative `CubePlayerHandle` ref (`reset`, `resetCamera`)
- `<CubePlayerControls>` — play/pause, reset, camera reset, speed buttons
- `<CubeMoveTape>` — move sequence with active/done highlight; 640px max-width wraps Sexy ×6 to 2 lines
- `<CubeState>` — display-only static snapshot; `alg`, `setup`, `stickering`, `theme`, `style` props
- All components TypeScript-typed with full prop interfaces; mount/unmount lifecycle handled internally
- `CubifyPage` harness in cfop-app: grouped case selector (2-Look OLL/PLL + Fun), mask dropdown, theme toggle buttons, playback controls, collapsible About panel
- Cubify nav entry added to cfop-app between About and Notation
- Vite alias `cubify` → `../../../cubify/src/index.ts`; tsconfig paths aligned
- Core library fully rewritten in TypeScript; 181 Vitest tests
- Theme presets: `speed-dark` (dark plastic, basic material) and `speed-light` (light plastic) replacing earlier `gan`/`speed` iterations
- Wide move support added to `CubeRenderer3D`: `f/b/r/l/u/d` and `Xw` notation — both layers rotate as a single simultaneous pivot; `getMoveKey()` helper added; `AlgParser` regex cleaned up; 12 new tests

---

## Feature 030: cubify-scripts

### Status: Planned 📋

### Scope
Migrate `cubify-scripts/` from TwistyPlayer to the cubify `CubeExporter` API. Remove the esbuild step and cfop-app rendering dependency. Add stickering controls to the CLI and agent skill.

### Goals
- `renderer.mjs` calls `CubeExporter.toPNG()` via Playwright — no TwistyPlayer bundle
- `--stickering <preset|orbitstring>`, `--masked`, `--dim` CLI flags
- `masks.mjs` returns MASK_PRESETS labels; cubify resolves orbit strings internally
- `--2d` mode runs `CubeRenderer2D` in Node.js — no browser needed
- `.claude/commands/cubify.md` updated with new flags and API
- Unblocked now — depends only on Features 026 and 028 (both complete ✅)

---

## Feature 031: cubify-packages

### Status: Planned 📋

### Scope
Publish `@andyjudson/cubify` and `@andyjudson/cubify-react` to GitHub Packages. Replaces the local Vite path alias with a versioned import, unblocking the cfop-app deploy pipeline on a fresh clone.

### Goals
- Build step: `tsc` → `dist/` with ES modules + declarations for both packages
- `@andyjudson/cubify` — core library, no React dependency
- `@andyjudson/cubify-react` — React wrappers (moved from `cfop-app/src/lib/cubify/`), peer-depends on React + `@andyjudson/cubify`; no CSS framework dependency
- `publish.yml` GitHub Actions workflow — triggers on version tag, publishes to `npm.pkg.github.com`
- `cfop-app` `.npmrc` + import path updates; `deploy.yml` authenticates to GitHub Packages
- Prerequisites: 029 (React wrapper) ✅, 030 (scripts) ✅

---

## Feature 032: cubify-cfop-migration

### Status: Planned 📋

### Scope
Full adoption of cubify in cfop-app — scrambles, alg parsing, and 3D visualisation. Absorbs what was previously split as "decouple" (alg imports) and "migration" (TwistyPlayer replacement): they are one coherent delivery.

### Goals
- Scramble generation: `CubeScramble.random()` replaces `randomScrambleForEvent`
- Alg parsing: `AlgParser.parse()` replaces `Alg`/`Move` imports in scrambler + VisualizerModal
- Visualisation: `<CubePlayer>` replaces TwistyPlayer in VisualizerModal
- Scramble preview: `<CubeState>` replaces TwistyPlayer in ScrambleCubePreview
- `useCubePlayer()` hook extracted from `CubifyPage` — encapsulates `playerRef`, `playing`, `stepIndex`, `speed`, and the `handleResetButton`/`handlePlayerReset` split; shared by VisualizerModal and any future consumer
- No cubing.js imports in cfop-app source; IntersectionObserver workarounds removed
- Prerequisites: 029 (React wrapper) ✅, 031 (packages) 📋

### Notes
- `CubifyPage` in cfop-app is the working reference harness for this migration; the state/handler pattern (83–114) is the boilerplate to be encapsulated in `useCubePlayer()`
- Theme presets: `default`, `rubiks`, `speed-dark`, `speed-light` — all tuned and stable

---

## Feature 033: cubify-solver

### Status: Planned 📋

### Scope
Interactive scramble and solve on the CubifyPage harness. `CubeScramble.random()` generates the scramble; cubing.js `experimentalSolve3x3x3IgnoringCenters` computes the solution from the live KPattern state. Phase 1 is two buttons — Scramble and Solve. Phase 2 adds move tracking and hints.

### Goals
- **Scramble** button — `CubeScramble.random()`, loads as setup, resets to scrambled state instantly
- **Solve** button — reads `player.state`, calls cubing.js solver, animates solution
- Loading state while solver computes
- Phase 2: user move tracking via `onMove` events, progress feedback, hint system
- Prerequisites: 029 (React wrapper) ✅, 032 (cfop-migration) 📋

---

## Status Summary

| Feature | Name | Status |
|---------|------|--------|
| 022 | cubify-harness | Complete ✅ |
| 023 | cubify-stickering | Complete ✅ |
| 024 | cubify-animation | Complete ✅ |
| 025 | cubify-theming | Complete ✅ |
| 026 | cubify-image-export | Complete ✅ |
| 027 | cubify-tests | Complete ✅ |
| 028 | cubify-library | Complete ✅ |
| 029 | cubify-react | Complete ✅ |
| 030 | cubify-scripts | Planned 📋 |
| 031 | cubify-packages | Planned 📋 |
| 032 | cfop-migration | Planned 📋 |
| 033 | cubify-solver | Planned 📋 |
