# @andyjudson/cubify

Clean-room 3×3 cube rendering and logic library. Delegates permutation state and move application to [cubing.js](https://github.com/cubing/cubing.js) (KPattern), then owns the rendering layer: a Three.js 3D renderer, a Canvas 2D renderer, a CFOP stickering/masking API, and a move-by-move animation engine.

## Installation

```bash
npm install @andyjudson/cubify
```

Requires peer dependencies: `cubing ^0.63.3`, `three ^0.170.0`

## Key classes

| Class | Purpose |
|-------|---------|
| `CubeState` | KPattern wrapper — `applyAlg()`, `toFaceArray()`, `setupFromAlg()`, `invertAlg()` |
| `CubeRenderer3D` | Three.js 3D renderer — `setState()`, `animateMove()`, `setTheme()`, `setStickering()` |
| `CubeRenderer2D` | Canvas 2D top-down view — `update()`, `toSVG()` |
| `CubePlayer` | Animation engine — `loadAlg()`, `play/pause/stepForward/stepBackward`, events |
| `CubeStickering` | CFOP orbit-string mask parser — `MASK_PRESETS` (15 presets) |
| `CubeExporter` | PNG export — `toPNG(alg, { style: '2d'\|'3d' })` |
| `CubeScramble` | Scramble generator — `random(length?)` (sync); `wca()` (async, WCA random-state via WASM) |
| `CubeSolverKociemba` | Kociemba two-phase solver — `solve(state)`, `cancel()`, `dispose()`; web worker |
| `CubeSolverCfop` | CFOP stage-annotated solver — returns 7 `SolveStage` entries (cross → F2L×4 → OLL → PLL), each with `label`, `alg`, `mask`, `caseName`, `wcaId`; web worker |
| `CubeSolverInterface<T>` | Shared solver interface implemented by both solvers — `available`, `solve()`, `cancel()`, `dispose()` |
| `AlgParser` | WCA notation parser — wide moves, slice moves, rotations, Rn normalisation |
| `CubeTheme` | Theme interface — `THEME_PRESETS`, `DEFAULT_THEME`, `effectiveColours()` |

## Quick start

```typescript
import { CubePlayer, CubeTheme } from '@andyjudson/cubify';

const player = new CubePlayer(containerElement, { animSpeed: 300 });
await player.loadAlg("R U R' U'", "z2");
player.on('move', ({ index, move }) => console.log(index, move));
player.play();
```

## Source

[github.com/andyjudson/cubify](https://github.com/andyjudson/cubify)
