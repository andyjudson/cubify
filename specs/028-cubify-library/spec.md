# Feature 028 — cubify.js (Library API)

## Summary

Extract and consolidate the core logic from `cubify-harness` into a clean, standalone `cubify.js` library with a well-designed public API. Rewire all consumers — `cubify-harness`, `cfop-app`, `cubify-scripts`, `cubify-app` — to use the library directly.

---

## Motivation

Feature 022 (`cubify-harness`) built the hard parts: cube state, 3D rendering, move animation, sticker geometry. But the harness is a test bed — the code structure reflects iteration, not design. The library needs a clean API that:

- Is the same interface regardless of consumer (React component, agent skill, standalone demo)
- Doesn't expose internal details like `_animTick`, `_kPattern`, material indices
- Is tree-shakeable — `CubeState` has zero rendering dependency; `CubeRenderer3D` doesn't pull in `CubePlayer`
- Is documented and stable enough to version

This is the "graduate the PoC" step.

---

## Consumers and Their Needs

| Consumer | Primary use | Key requirements |
|----------|-------------|-----------------|
| `cubify-harness` | Test bed / demo | All features, live controls |
| `cfop-app` VisualizerModal | 3D cube display, step-through | `CubePlayer` — mount, loadAlg, play/pause, jumpTo, stickering |
| `cfop-app` ScrambleCubePreview | Scramble state display | `CubeRenderer3D` — mount, setState |
| `cfop-app` scramble utils | Scramble generation + alg parsing | `CubeScramble`, `AlgParser` |
| `cubify-scripts` | Headless image generation | `CubeExporter.toPNG()`, no DOM |
| `cubify-app` | Local PNG export tool | `CubeExporter`, stickering |

---

## Public API

```js
// State — pure, no rendering dependency
import { CubeState } from 'cubify';
const state = await CubeState.solved();
const after  = state.applyAlg("R U R' U'");
const faces  = after.toFaceArray();       // string[6][9]
const solved = after.isSolved();
const inv    = CubeState.invertAlg(moves);

// Alg parsing
import { AlgParser } from 'cubify';
const moves = AlgParser.parse("R U R' U'");  // string[]

// Scramble generation
import { CubeScramble } from 'cubify';
const scramble = CubeScramble.random();      // 20-move string, no same-face / A-B-A

// Stickering
import { CubeStickering } from 'cubify';
const vis = CubeStickering.forPreset('oll');
const vis = CubeStickering.fromOrbitString('EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------');

// 3D renderer (browser only)
import { CubeRenderer3D } from 'cubify';
const r = new CubeRenderer3D({ theme: 'modern', gap: 0.02 });
r.mount(containerEl);
r.setState(state);
r.setStickering('oll');          // preset name or raw orbit string
r.animateMove('R', onDone);
r.animateAlg(moves, onStep, onComplete);
r.setSpeed(1.5);
r.resetCamera();
r.unmount();

// Player — animation + event API (browser only)
import { CubePlayer } from 'cubify';
const p = new CubePlayer(containerEl, { theme: 'modern', stickering: 'oll' });
p.loadAlg("R U R' U R U2 R'");
p.play();
p.pause();
p.jumpTo(3);
p.setSpeed(1.5);
p.reset();
p.on('move',     ({ index, move, state }) => { });
p.on('complete', () => { });
p.on('reset',    () => { });

// Image export — headless-capable
import { CubeExporter } from 'cubify';
const png = await CubeExporter.toPNG("R U R' U'", {
  style:      '2d',        // '2d' flat net | '3d' rendered
  stickering: 'oll',
  setupAlg:   '',
  size:       256,
  theme:      'modern',
});
```

---

## Module Structure

```
cubify/
├── src/
│   ├── CubeState.js        — pure state, cubing.js KPattern (internal dep)
│   ├── AlgParser.js        — WCA notation parsing, no dependencies
│   ├── CubeScramble.js     — scramble generator, no cubing.js
│   ├── CubeStickering.js   — orbit string parser + named presets
│   ├── CubeTheme.js        — theme objects
│   ├── CubeRenderer3D.js   — Three.js WebGL renderer (browser)
│   ├── CubePlayer.js       — animation engine + event API (browser)
│   ├── CubeExporter.js     — PNG export, delegates to 2D/3D renderer
│   └── index.js            — public re-exports
├── css/
│   └── cubify.css          — CSS custom property tokens
└── package.json
```

`CubeRenderer2D` is an internal implementation detail of `CubeExporter` — not exported publicly.

---

## Dependency boundaries

| Module | External deps | Notes |
|--------|--------------|-------|
| `CubeState` | `cubing/puzzles`, `cubing/alg` | cubing.js internal only, not exposed |
| `AlgParser` | none | pure JS |
| `CubeScramble` | none | pure JS |
| `CubeStickering` | none | pure JS |
| `CubeTheme` | none | pure JS |
| `CubeRenderer3D` | `three` | browser only |
| `CubePlayer` | `CubeRenderer3D`, `CubeState` | browser only |
| `CubeExporter` | `three` (3D path), `CubeState` | browser + Node.js |

---

## Refactoring Scope

- **CubeState**: `applyAlg` / `applyMove` / `toFaceArray` / `isSolved` / `invertAlg` are the full public surface. `toRawPattern` moves to internal/debug only.
- **CubeRenderer3D**: remove `_animSpeed`, `_animating`, `_cubelets` from public access. Add `setSpeed()`, `setStickering()`.
- **CubePlayer**: implement fully (stub in 022). See Feature 024.
- **AlgParser**: no changes needed.
- **CubeScramble**: migrate from `scrambleGenerator.ts`, remove `Alg` import. See Feature 030.
- **CubeExporter**: implement. See Feature 026.

---

## Prerequisites

- Feature 023 (stickering) — `CubeStickering.fromOrbitString()`
- Feature 024 (animation) — `CubePlayer` fully implemented
- Feature 025 (theming) — `CubeTheme`
- Feature 026 (image export) — `CubeExporter.toPNG()`

---

## Acceptance Criteria

- [ ] All public API methods documented with JSDoc
- [ ] `CubeState`, `AlgParser`, `CubeScramble`, `CubeStickering` importable with zero rendering dependency
- [ ] `CubeRenderer3D.setStickering()` accepts preset name or orbit string
- [ ] `CubePlayer` fully implements play/pause/jumpTo/setSpeed/on()
- [ ] `CubeExporter.toPNG()` supports `style: '2d'|'3d'`
- [ ] No `_` properties in public API
- [ ] `grep -r "from 'cubing" cfop-app/src` returns no matches after consumer migration
