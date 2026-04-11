# Feature 030 — cubify.js (Visualisation Library)

## Summary

Extract and consolidate the core logic from `cubify-harness` into a clean, standalone `cubify.js` library with a well-designed public API. Rewire all consumers — `cubify-harness`, `cfop-app`, `cubify-scripts`, `cubify-app` — to use the library directly.

---

## Motivation

Feature 020 (`cubify-harness`) built the hard parts: cube state, 3D rendering, move animation, sticker geometry. But the harness is a test bed — the code structure reflects iteration, not design. The library needs a clean API that:

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
| `cfop-app` VisualizerModal | 3D cube display, step-through | Mount, setState, animateAlg, stickering |
| `cfop-app` ScrambleCubePreview | Scramble state display | Mount, setState, no animation needed |
| `cubify-scripts` | Headless image generation | CubeExporter.toSVG/toPNG, no DOM |
| `cubify-app` | Local PNG/SVG export tool | CubeExporter, stickering |

---

## Proposed Public API

```js
// State (pure, no rendering dependency)
import { CubeState } from 'cubify';
const state = await CubeState.solved();
const after = state.applyAlg("R U R' U'");
const faces = after.toFaceArray();          // string[6][9]
const solved = after.isSolved();

// 3D renderer
import { CubeRenderer3D } from 'cubify';
const r = new CubeRenderer3D({ theme: 'modern', gap: 0.02 });
r.mount(containerEl);
r.setState(state);
r.animateMove('R', onDone);
r.animateAlg(moves, onStep, onComplete);
r.setStickering('oll');                     // named preset
r.setStickering(orbitString);               // raw orbit string
r.unmount();

// Player (animation + event API)
import { CubePlayer } from 'cubify';
const p = new CubePlayer(containerEl, { theme: 'modern', stickering: 'oll' });
p.loadAlg("R U R' U R U2 R'");
p.play();
p.pause();
p.jumpTo(3);
p.setSpeed(1.5);
p.reset();
p.on('move', ({ index, move }) => { ... });
p.on('complete', () => { ... });

// Static export (headless-capable)
import { CubeExporter } from 'cubify';
const svg = await CubeExporter.toSVG("R U R' U'", { stickering: 'oll', size: 256 });
const png = await CubeExporter.toPNG("R U R' U'", { stickering: 'oll', size: 256 });
```

---

## Module Structure (target)

```
cubify/
├── src/
│   ├── CubeState.js        — pure state, cubing.js dependency
│   ├── AlgParser.js        — WCA notation parsing
│   ├── CubeStickering.js   — orbit string parser + named presets (Feature 029)
│   ├── CubeTheme.js        — theme objects (Feature 027)
│   ├── CubeRenderer3D.js   — Three.js WebGL renderer
│   ├── CubeRenderer2D.js   — SVG net renderer (Feature 028)
│   ├── CubePlayer.js       — animation engine + event API
│   ├── CubeExporter.js     — static export (Feature 028)
│   └── index.js            — public re-exports
├── css/
│   └── cubify.css          — CSS custom property tokens
└── package.json
```

---

## Refactoring Scope

- **CubeState**: clean up, ensure `applyAlg` / `applyMove` / `toFaceArray` / `isSolved` / `invertAlg` are the full public surface. Remove `toRawPattern` from public API (debug-only, move to internal).
- **CubeRenderer3D**: remove exposed `_animSpeed`, `_animating`, `_cubelets` internals. Wrap speed in `setSpeed()`. Add `setStickering()` accepting preset name or orbit string.
- **CubePlayer**: implement properly (stub only in 020). Full timeline, `jumpTo`, `setSpeed`, event emitter.
- **AlgParser**: no changes needed.
- **CubeExporter**: implement (deferred in 020, covered in Feature 028).

---

## Consumer Migration

### cfop-app
- `VisualizerModal`: replace TwistyPlayer with `CubePlayer` — mount, `loadAlg`, `play/pause`, `jumpTo`
- `ScrambleCubePreview`: replace TwistyPlayer with `CubeRenderer3D` — mount, `setState`
- Remove IntersectionObserver workarounds and explicit px dimension requirements

### cubify-scripts
- Replace Playwright + headful Chromium with `CubeExporter.toSVG()` / `toPNG()`
- Requires Feature 028 complete first

### cubify-app
- Replace direct cubing.js usage with `CubeExporter`

---

## Prerequisites

- Feature 028 (2D export) — `CubeExporter` and `CubeRenderer2D`
- Feature 029 (stickering) — `CubeStickering.fromOrbitString()`
- Feature 027 (theming) — `CubeTheme` optional but desirable before cfop-app migration

---

## Acceptance Criteria

- [ ] All public API methods documented with JSDoc
- [ ] `CubeState` importable with zero rendering dependency
- [ ] `CubeRenderer3D.setStickering()` accepts preset name or orbit string
- [ ] `CubePlayer` fully implements play/pause/jumpTo/setSpeed/on()
- [ ] `cfop-app` VisualizerModal and ScrambleCubePreview migrated off TwistyPlayer
- [ ] `cubify-scripts` migrated off Playwright
- [ ] No internal `_` properties in public API
