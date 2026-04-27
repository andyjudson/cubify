# Implementation Plan: 028 — cubify.js Library API

**Branch**: `028-cubify-library` | **Spec**: [spec.md](spec.md)

## Summary

Graduate `cubify-harness/src/` from a test-bed into a proper library. Move source to `cubify/src/` at the repo root, create a `package.json` with `exports` and `types`, add `CubeScramble`, extend `CubeRenderer3D` and `CubePlayer` with missing public API, produce TypeScript definitions, and rewire the harness + test suite to import from the library.

`cubify-scripts` renderer migration (Playwright + Node.js WebGL path) deferred to a future increment — the current Playwright/TwistyPlayer renderer continues to work.

---

## Technical Context

**Language/Version**: TypeScript (strict mode), ESM (`"type": "module"`), Node 18+
**Package system**: Node.js package with `"type": "module"`, `"exports"` map, `"types"` field; `"main": "./src/index.ts"`
**TypeScript**: All source files `.ts`; declarations hand-written in `types/index.d.ts` (no separate tsc emission step)
**Consumers after this feature**: `cubify-harness` (imports from `../src/`), Vitest test suite (imports from `../src/`)
**External deps**: `three`, `cubing` — in `cubify/node_modules/` (consolidated from harness at repo root via `npm install`)

---

## Key Design Decisions

### Source location: repo root `src/`, not inside harness

The library lives at `cubify/src/` (repo root). The harness becomes a pure consumer, importing via relative paths (`../src/`). Vite and Vitest both resolve bare specifiers (`three`, `cubing`) by walking up through parent `node_modules`.

### node_modules consolidated at repo root

`cubify-harness/package.json` and its `node_modules/` were removed. `npm install` at the repo root creates `cubify/node_modules/` containing `cubing`, `three`, `vitest`, `vite`, and all other deps. Harness `vite` and test `vitest` both find packages via normal upward resolution. This replaces the previous approach (keeping deps in `cubify-harness/node_modules/`).

### CubeRenderer3D.setStickering()

Accepts either a `MASK_PRESETS` label string (e.g. `'oll'`) or a raw orbit string. Imports `CubeStickering` directly — no circular dependency since `CubeStickering` has no renderer dependency.

### CubeRenderer3D.snapshotAt(size?)

Replaces the harness's direct access to `_renderer`, `_scene`, `_camera`. Saves/restores pixel ratio and CSS dimensions so the live canvas is undisturbed after export.

### CubeScramble.js — pure JS, filter-based, no cubing.js

Uses an axis exclusion map rather than a retry loop. Generates N valid moves without rejection sampling. Output is always valid WCA notation by construction — no `Alg.fromString` validation needed.

```js
// After R L: excludeAxis = AXIS[L]=1 → exclude all axis-1 faces (R and L)
// Equivalent to: cfop's two separate constraints combined
```

### TypeScript definitions — hand-written `.d.ts`

Library source is TypeScript. Declarations are hand-written in `types/index.d.ts` and referenced via `"types"` in `package.json`'s exports map. This avoids a separate tsc emission step — the `.ts` source is the canonical form and Vitest/Vite resolve it directly via `"main": "./src/index.ts"`. `skipLibCheck: true` in consumers means any imprecision won't block builds.

### Mid-animation interrupt fix (abortAnimation + generation counter)

Loading a new alg while `CubePlayer` is mid-animation can corrupt both visual and logical state. Two-part fix:

1. `CubeRenderer3D.abortAnimation()` — snaps the in-flight animation to t=1 (calls `_animTick(Infinity)`), which reattaches pivot-parented cubelets before `resetToSolved()` destroys the pivot group.
2. `CubePlayer._generation` counter — each `pause()` / `loadAlg()` increments the counter; `_playNext()` captures `const gen = this._generation` before `animateMove` and discards the callback if `this._generation !== gen` when it fires.

---

## Project Structure

```
cubify/                            # repo root — also the library package
├── package.json                   # name: "cubify", exports, types; single package for whole repo
├── vitest.config.js               # test runner config (moved from harness)
├── .gitignore                     # node_modules/, dist/, .claude/tmp/
├── node_modules/                  # consolidated — cubing, three, vitest, vite, etc.
├── src/                           # canonical library source — all TypeScript
│   ├── index.ts                   # public re-exports incl. CubeRenderer2D
│   ├── CubeScramble.ts            # NEW — pure JS scramble generator
│   ├── CubeState.ts               # MOVED from cubify-harness/src/
│   ├── AlgParser.ts               # MOVED
│   ├── CubeStickering.ts          # MOVED
│   ├── CubeRenderer3D.ts          # MOVED + setStickering() + snapshotAt() + abortAnimation() added
│   ├── CubePlayer.ts              # MOVED + setupMoves getter + _generation counter added
│   ├── CubeExporter.ts            # MOVED
│   └── CubeRenderer2D.ts          # MOVED (exported publicly in index.ts)
├── test/                          # all 7 test files — TypeScript
│   └── *.test.ts
├── types/
│   └── index.d.ts                 # TypeScript definitions for all public exports
├── cubify-harness/
│   ├── src/                       # DELETED — source now at repo root src/
│   ├── package.json               # DELETED — consolidated to root package.json
│   └── index.html                 # MODIFIED — imports from ../src/; snapshotAt() for export
└── .claude/
    └── commands/
        └── cubify.md              # /cubify skill
```

---

## Public API Surface

| Export | Notes |
|--------|-------|
| `CubeState` | unchanged |
| `AlgParser` | unchanged |
| `CubeScramble` | new — `random(length?)` |
| `CubeStickering`, `MASK_PRESETS` | unchanged |
| `CubeRenderer3D`, `MOVE_AXIS` | + `setStickering(presetOrString)`, `snapshotAt(size?)`, `abortAnimation()` |
| `CubePlayer` | + `setupMoves` getter; `_generation` counter (internal) |
| `CubeExporter` | unchanged |
| `CubeRenderer2D`, `CubeRenderer2DOptions` | exported publicly — not internal |

---

## Acceptance Criteria — All Met

- [X] `src/` at repo root contains all library source files (TypeScript)
- [X] `package.json` at repo root with `name: "cubify"`, `exports`, `types`, `"main": "./src/index.ts"`
- [X] `CubeScramble.random(length?)` returns valid 20-move WCA string, no external deps
- [X] `CubeRenderer3D.setStickering()` accepts preset label or orbit string
- [X] `CubeRenderer3D.snapshotAt(size?)` returns PNG data URL without internal property access
- [X] `CubeRenderer3D.abortAnimation()` snaps in-flight animation; prevents state corruption on mid-animation reload
- [X] `CubePlayer.setupMoves` getter exposed
- [X] `CubePlayer._generation` counter discards stale callbacks when state is reset mid-animation
- [X] `CubeRenderer2D` and `CubeRenderer2DOptions` exported publicly from `src/index.ts`
- [X] `types/index.d.ts` covers all public exports including `CubeRenderer2D`
- [X] Harness `index.html` imports from `../src/`; no `_` property accesses remain
- [X] `cubify-harness/package.json` removed; `node_modules` consolidated at repo root
- [X] All 138 Vitest tests pass against root `src/`
- [X] `/cubify` skill file at `.claude/commands/cubify.md`
- [X] `.gitignore` at repo root
