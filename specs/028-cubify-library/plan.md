# Implementation Plan: 028 — cubify.js Library API

**Branch**: `028-cubify-library` | **Spec**: [spec.md](spec.md)

## Summary

Graduate `cubify-harness/src/` from a test-bed into a proper library. Move source to `cubify/src/` at the repo root, create a `package.json` with `exports` and `types`, add `CubeScramble`, extend `CubeRenderer3D` and `CubePlayer` with missing public API, produce TypeScript definitions, and rewire the harness + test suite to import from the library.

`cubify-scripts` renderer migration (Playwright + Node.js WebGL path) deferred to a future increment — the current Playwright/TwistyPlayer renderer continues to work.

---

## Technical Context

**Language/Version**: ES module JavaScript
**Package system**: Node.js package with `"type": "module"`, `"exports"` map, `"types"` field
**TypeScript**: `.d.ts` hand-written definitions (no tsc compilation — library is plain JS)
**Consumers after this feature**: `cubify-harness` (imports from `../src/`), Vitest test suite (imports from `../../src/`)
**External deps**: `three`, `cubing` — remain in `cubify-harness/node_modules`; harness Node.js resolution traverses up to find them

---

## Key Design Decisions

### Source location: repo root `src/`, not inside harness

The library lives at `cubify/src/` (repo root). The harness becomes a pure consumer, importing via relative paths (`../src/`). Vite and Vitest both resolve bare specifiers (`three`, `cubing`) by walking up through parent `node_modules` — they find `cubify-harness/node_modules/` naturally without needing a root install.

### No root `node_modules` install required

Because `three` and `cubing` are already in `cubify-harness/node_modules/`, and both Vite and Node.js module resolution walk up through ancestor directories, the root `cubify/src/*.js` files can import `three` and `cubing` without a separate `npm install` at the repo root.

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

Library source is plain JS. Rather than running `tsc --declaration`, definitions are hand-written in `types/cubify.d.ts` and referenced via `"types"` in `package.json`'s exports map. `skipLibCheck: true` in consumers means any imprecision won't block builds.

---

## Project Structure

```
cubify/                            # repo root — NOW also the library package
├── package.json                   # NEW — name: "cubify", exports, types
├── .gitignore                     # NEW — node_modules/, dist/, .claude/tmp/
├── src/                           # NEW directory — canonical library source
│   ├── index.js                   # NEW — public re-exports
│   ├── CubeScramble.js            # NEW — pure JS scramble generator
│   ├── CubeState.js               # MOVED from cubify-harness/src/
│   ├── AlgParser.js               # MOVED
│   ├── CubeStickering.js          # MOVED
│   ├── CubeRenderer3D.js          # MOVED + setStickering() + snapshotAt() added
│   ├── CubePlayer.js              # MOVED + setupMoves getter added
│   ├── CubeExporter.js            # MOVED
│   └── CubeRenderer2D.js          # MOVED (internal — not in index.js exports)
├── types/
│   └── cubify.d.ts                # NEW — TypeScript definitions
├── cubify-harness/
│   ├── src/                       # DELETED — source now lives at repo root src/
│   ├── index.html                 # MODIFIED — imports from ../src/; snapshotAt() for export
│   └── test/                      # MODIFIED — all imports updated to ../../src/
│       └── cube-player.test.js    # MODIFIED — vi.mock path updated
└── .claude/
    └── commands/
        └── cubify.md              # NEW — /cubify skill in this repo
```

---

## Public API Surface

| Export | Notes |
|--------|-------|
| `CubeState` | unchanged |
| `AlgParser` | unchanged |
| `CubeScramble` | new — `random(length?)` |
| `CubeStickering`, `MASK_PRESETS` | unchanged |
| `CubeRenderer3D`, `MOVE_AXIS` | + `setStickering(presetOrString)`, `snapshotAt(size?)` |
| `CubePlayer` | + `setupMoves` getter |
| `CubeExporter` | unchanged |
| `CubeRenderer2D` | intentionally NOT exported — internal to CubeExporter |

---

## Acceptance Criteria — All Met

- [X] `src/` at repo root contains all library source files
- [X] `package.json` at repo root with `name: "cubify"`, `exports`, `types`
- [X] `CubeScramble.random(length?)` returns valid 20-move WCA string, no external deps
- [X] `CubeRenderer3D.setStickering()` accepts preset label or orbit string
- [X] `CubeRenderer3D.snapshotAt(size?)` returns PNG data URL without internal property access
- [X] `CubePlayer.setupMoves` getter exposed
- [X] `types/cubify.d.ts` covers all public exports
- [X] Harness `index.html` imports from `../src/`; no `_` property accesses remain
- [X] All 138 Vitest tests pass against root `src/`
- [X] `/cubify` skill file at `.claude/commands/cubify.md`
- [X] `.gitignore` at repo root
