# Implementation Plan: cubify-harness (Feature 020)

**Branch**: `020-cubify-harness` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/020-cubify-harness/spec.md`

## Summary

Build `cubify-harness/` — a focused JS library for 3×3 Rubik's cube visualisation and static export, eliminating TwistyPlayer's IntersectionObserver, shadow DOM, and headless Chromium constraints. Scoped to PoC: working 3D renderer (Three.js), CFOP stickering presets, SVG 2D renderer, and static PNG/SVG export. Animation engine and full player controls are deferred to the next feature.

## Technical Context

**Language/Version**: JavaScript ESM (no TypeScript — standalone library, not part of cfop-app's TS build)
**Primary Dependencies**:
- `three` v0.170.0 — already in cfop-app's node_modules (transitive via cubing.js); install directly in cubify-harness
- `cubing/alg` — imported from cfop-app's cubing.js for WCA notation parsing only; no TwistyPlayer
- `node-canvas` v3.x — for Node.js headless PNG export (OffscreenCanvas not available in Node natively)

**Storage**: N/A — library, no persistence
**Testing**: Manual smoke tests in browser; Node.js script for headless export validation
**Target Platform**: Browser (ES2022+) + Node.js (ESM) for headless export
**Project Type**: Standalone JS library within repo
**Performance Goals**: First render < 100ms; PNG export < 2s without browser launch
**Constraints**:
- No TypeScript (library stays plain JS; consuming apps type it themselves)
- No bundler required for the library itself — pure ESM, importable directly
- Must not pull in TwistyPlayer or cubing.js rendering stack
- `OffscreenCanvas` is browser-only — Node.js headless path requires `node-canvas`

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Educational focus | ✅ PASS | Enables better cube visualisation for learning |
| Minimal dependencies | ✅ PASS | Three.js + node-canvas; cubing/alg reused not re-implemented |
| Open source | ✅ PASS | MIT licensed; Three.js MIT, cubing.js MIT |
| No server-side requirements | ✅ PASS | Library is static; headless export runs locally |
| Minimal complexity | ✅ PASS | PoC scope only — no full animation engine |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/020-cubify-harness/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
cubify-harness/
├── src/
│   ├── CubeState.js       — pure cube state: face array, move application, WCA move set
│   ├── AlgParser.js       — thin wrapper around cubing/alg; parses notation → move list
│   ├── CubeStickering.js  — named CFOP presets → sticker visibility map per face/slot
│   ├── CubeRenderer3D.js  — Three.js WebGL renderer; mounts to container via ResizeObserver
│   ├── CubeRenderer2D.js  — SVG flat net renderer; pure string, zero browser dependency
│   └── CubeExporter.js    — PNG (OffscreenCanvas/node-canvas) + SVG export entry point
├── demo/
│   └── index.html         — browser smoke test (mount + stickering + export)
├── package.json           — ESM, MIT, three + node-canvas as dependencies
└── README.md
```

**No `index.js` barrel in PoC** — each module imported directly. Barrel added in full library feature.

## Complexity Tracking

No constitution violations. PoC scope keeps complexity justified.

---

## Phase 0: Research

### Three.js WebGL Renderer — mount pattern

**Decision**: Use `ResizeObserver` on the container to set canvas size and trigger re-render. Initial render fires synchronously on first `ResizeObserver` callback (which fires immediately after `observe()` if the container already has dimensions, or on next layout otherwise).

```js
// CubeRenderer3D.js — mount pattern
mount(container) {
  this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  container.appendChild(this._renderer.domElement);

  // Synchronous initial render if container already has dimensions at mount time
  const { width, height } = container.getBoundingClientRect();
  if (width > 0 && height > 0) this._resize(width, height);

  // ResizeObserver handles all subsequent size changes (async, fires on layout)
  this._ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) this._resize(width, height);
  });
  this._ro.observe(container);
}

_resize(width, height) {
  this._renderer.setSize(width, height);
  this._camera.aspect = width / height;
  this._camera.updateProjectionMatrix();
  this._renderer.render(this._scene, this._camera);
}
```

**No IntersectionObserver, no `setTimeout`, no explicit `px` dimensions required. Renders immediately if container is already sized, or on first ResizeObserver callback if not.**

### Three.js cube geometry

**Decision**: 26 individual `BoxGeometry` cubelets, each with a 6-element `MeshStandardMaterial[]` array (one material per face). Sticker colours set by mutating `material[faceIndex].color`. This is the standard approach used by most cube renderers and gives clean per-face colour control.

Face index mapping (Three.js BoxGeometry): `[+x, -x, +y, -y, +z, -z]` = `[R, L, U, D, F, B]`.

Cubelets positioned on a 3×3×3 grid at `(-1, 0, 1)` on each axis with a small gap for visual separation.

**Alternative rejected**: Single merged geometry with vertex colours — harder to update individual sticker colours per move application.

### OffscreenCanvas / headless export

**Finding**: `OffscreenCanvas` is browser-only. Confirmed: `typeof OffscreenCanvas === 'undefined'` in Node 23.

**Decision**:
- **Browser PNG path**: `new OffscreenCanvas(size, size)` → `WebGLRenderer({ canvas: offscreen })` → `canvas.toDataURL()`. Works without mounting to DOM.
- **Node.js PNG path**: `node-canvas` (`createCanvas`) — Three.js supports a custom canvas injection. PoC documents but defers full implementation.
- **SVG path**: Pure string generation, zero browser/Node dependency. **Primary headless path** — this is what the cubify agent skill migrates to.

**PoC priority**: SVG export fully implemented → browser OffscreenCanvas PNG → Node.js PNG as stretch goal.

### cubing/alg integration

**Confirmed**: `cubing/alg` imports standalone as ESM with zero TwistyPlayer dependency:

```js
import { Alg } from 'cubing/alg';
const alg = new Alg("R U R' U'");
const moves = [...alg.experimentalLeafMoves()]; // → ['R', 'U', "R'", "U'"]
```

`AlgParser.js` wraps this. `cubify-harness/package.json` lists `cubing` as a peer dependency (not bundled).

### CubeState — move application

**Decision**: 6 face arrays of 9 sticker colours (54 values). WCA moves applied by rotating face arrays and cycling adjacent edge stickers. Fully self-contained, no dependencies.

Face order: `[U, R, F, D, L, B]` (WCA standard).

Move coverage: RUFLBD + `'`/`2` modifiers + wide moves (u, d, r, l, f, b) + M, E, S slices + x, y, z rotations.

---

## Phase 1: Data Model

See [data-model.md](data-model.md).
