# Feature 022 — cubify-harness

## Artifacts

- [spec.md](spec.md) — this file
- [plan.md](plan.md) — implementation plan
- [tasks.md](tasks.md) — task checklist
- [research.md](research.md) — architectural decisions
- [data-model.md](data-model.md) — data model
- [cube-mapping-lessons.md](cube-mapping-lessons.md) — **cubing.js internals, orientation formulas, rendering architecture** (foundational reference)

---

## Summary

Design and build `cubify-harness` — a focused, modern JavaScript library for 3×3 Rubik's cube visualisation, animation, and algorithm tooling. It replaces direct use of `cubing.js` / TwistyPlayer within this project and is architected to be reusable as a standalone open-source library.

This feature is scoped to **architecture + proof of concept**: a working implementation of the hardest sub-problems (WebGL rendering without DOM constraints, clean mount API, CFOP stickering presets) that validates the approach before full library build-out.

---

## Motivation

Every non-trivial integration of TwistyPlayer has required working around undocumented internals:

- **IntersectionObserver gate** — canvas won't initialise unless the container has non-zero height at mount time; requires explicit `px` dimensions and careful DOM ordering
- **Shadow DOM** — web component encapsulation blocks external styling and automation tooling
- **Baked-in controls** — the bundled control panel has poor UI/UX; building custom controls requires suppressing the built-in panel and re-implementing everything
- **`experimentalModel` API** — move progress, timeline state, orbit coordinates all accessed via undocumented, unstable internals
- **Headless rendering** — WebGL blocked in headless Chromium on macOS; the cubify agent skill requires `headless: false` as a workaround
- **Stickering masks** — CFOP stickering requires opaque orbit strings (`EDGES:----OOOO----,...`) with no named presets or documentation

A clean-room library designed around these pain points specifically would eliminate all of them.

---

## Name

**`cubify-harness`** — consistent with the existing `cubify-scripts/` agent skill and `cubify-app/` utility. Not "twisty" anything.

---

## Scope (Feature 020 — PoC)

This feature delivers a working proof of concept, not a complete library. Specifically:

1. Architecture design — module structure, public API surface, rendering approach
2. `CubeState` — pure JS cube state with move application (no rendering dependency)
3. `AlgParser` — notation parsing, move sequence representation
4. `CubeRenderer3D` PoC — WebGL canvas renderer that mounts cleanly to any sized container without IntersectionObserver constraints
5. `CubeStickering` — named CFOP presets (`full`, `oll`, `pll`, `f2l`, `cross`)
6. Static export PoC — PNG/SVG generation path, headless-capable

Full animation engine, player controls, and scramble generator integration are **out of scope for 022** — covered in subsequent features once the PoC validates the core rendering approach.

---

## User Stories

**US-001 — Mount anywhere**
As a developer, I want to mount a 3D cube into any container div without worrying about its size at mount time or DOM ordering constraints.

**US-002 — CFOP stickering presets**
As a developer, I want to set stickering with a named preset (`oll`, `pll`, `f2l`) rather than constructing opaque orbit mask strings.

**US-003 — Static export**
As a developer (or agent skill), I want to export a cube state as a PNG or SVG without launching a headed browser.

**US-004 — Clean controls API**
As a developer, I want to build my own playback controls using exposed methods (`play()`, `pause()`, `jumpTo()`, `setSpeed()`) — the library renders the cube, I own the UI.

---

## Architecture

### Module Structure

```
cubify-harness/
├── src/
│   ├── CubeState.js       — pure maths: face state, move application, validation
│   ├── AlgParser.js       — notation parsing, move sequence, WCA move set
│   ├── CubeRenderer3D.js  — WebGL canvas renderer (Three.js or raw WebGL)
│   ├── CubeRenderer2D.js  — SVG flat net renderer
│   ├── CubePlayer.js      — animation engine: timeline, tempo, move events
│   ├── CubeStickering.js  — stickering presets + custom mask builder
│   ├── CubeExporter.js    — static PNG/SVG generation, headless-capable
│   └── index.js           — public API surface
├── css/
│   └── cubify.css         — CSS custom property tokens, zero framework dependency
└── README.md
```

### Design Principles

- **No web components / shadow DOM** — plain JS class, appends a `<canvas>` or `<svg>` to a container div you control
- **No baked-in controls** — library exposes methods; consuming app builds controls
- **Mount API is lifecycle-safe** — `mount(container)` works regardless of container dimensions at call time; uses ResizeObserver not IntersectionObserver
- **Tree-shakeable** — import only what you need (`CubeState` has zero rendering dependency)
- **CSS custom property tokens** — all colours, sizes, shadow styles exposed as `--cubify-*` tokens
- **Headless-capable** — `CubeExporter` uses offscreen canvas for PNG; SVG export has zero browser dependency

### Public API (target)

```js
// Mount a 3D cube
const cube = new CubePlayer(container, { stickering: 'oll', theme: 'dark' });
cube.loadAlg('R U R\' U R U2 R\'');
cube.play();
cube.pause();
cube.jumpTo(3);          // jump to move index
cube.setSpeed(1.5);      // tempo scale
cube.reset();

// Stickering
cube.setStickering('oll');    // named preset
cube.setStickering('pll');
cube.setStickering('full');

// Static export (no player needed)
const png = await CubeExporter.toPNG(algString, { stickering: 'oll', size: 256 });
const svg = await CubeExporter.toSVG(algString, { stickering: 'oll' });

// Move events
cube.on('move', ({ index, move, notation }) => { ... });
cube.on('complete', () => { ... });
```

### CFOP Stickering Presets (deferred)

| Preset | Description |
|--------|-------------|
| `full` | All stickers visible |
| `oll` | Top face + top layer edges and corners; bottom two layers grey |
| `pll` | Top layer only (all stickers); rest grey |
| `f2l` | Bottom two layers visible; top layer grey |
| `cross` | Bottom cross only; rest grey |
| `oll-edges` | OLL cross not formed variant — top corners hidden |
| `pll-corners` | PLL corner-swap variant |

---

## Rendering Approach

### 3D (WebGL)

Options in priority order:
1. **Three.js** — well-maintained, excellent WebGL abstraction, offscreen canvas support, large community. Likely right choice.
2. **Raw WebGL** — more control, zero dependency, but significant implementation cost for cube geometry + normals + lighting.

The cube geometry is simple (26 cubelets, 54 stickers) — Three.js is not overkill here.

### 2D (deferred)

Pure SVG generation — no canvas, no WebGL. Isometric projection or flat net. This is the reliable headless export path and a fast fallback for low-power devices.

### Headless Export (deferred)

- PNG: `OffscreenCanvas` + WebGL (supported in Node.js via `gl` package or in Worker threads in browser)
- SVG: pure string generation, zero browser dependency
- The cubify agent skill would migrate to use `CubeExporter.toSVG()` or `CubeExporter.toPNG()` directly, removing the Playwright/headless Chromium dependency entirely

---

## Dependency Decision Record

### What we import from cubing.js

| Module | Why |
|--------|-----|
| `Alg`, `Move` (cubing/alg) | WCA-compliant notation parsing, well-tested, not worth reinventing |
| `experimentalLeafMoves()` | Move sequence iteration for animation engine |

Everything else — rendering, animation, stickering, export — is built fresh. This is dependency use, not derivation. Equivalent to using a date library for date parsing.

### What we build fresh

- WebGL/canvas rendering (Three.js)
- SVG flat net renderer
- Animation engine and player API
- Stickering presets
- Static export / headless path
- CSS token theming layer

### Attribution

`cubing.js` credited in README and package.json. Implementation authored under direction of the project owner; AI-assisted development noted transparently.

---

## Licensing

- `cubing.js` is MIT licensed — imported as a dependency with attribution
- `cubify-harness` will also be MIT licensed
- Three.js is MIT licensed
- Nothing GPL or LGPL in the dependency chain

---

## Relationship to This Project

- Lives in a new top-level directory `cubify-harness/` within this repo initially
- Once stable, could be extracted to its own GitHub repository and published to npm
- `cfop-app` and `cubify-scripts` migrate to use `cubify-harness` in place of `cubing.js`/TwistyPlayer in a subsequent feature

---
