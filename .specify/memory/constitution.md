# Speckit Constitution for cubify

## Project Purpose

cubify is a clean-room 3×3 Rubik's cube rendering and logic library. It wraps cubing.js puzzle logic inside a stable, inspectable API and replaces cubing.js TwistyPlayer in the cfop-app with a dependency-free renderer with a documented public surface.

The primary proving ground is `cubify-harness` — a browser test harness built alongside the library. Every capability must be validated there before being packaged for consumers.

The long-term destination is cfop-app: a personal CFOP learning tool. All features serve this migration goal (see feature sequence 022→031).

---

## Technology Choices

- **Core library**: TypeScript ES Modules — `tsc` build to `dist/` required for npm packaging (feature 031+); source remains Vite-served `.ts` for harness/dev
- **Package distribution**: npm workspaces (`packages/cubify/`, `packages/cubify-react/`); published to GitHub Packages as `@andyjudson/cubify` and `@andyjudson/cubify-react`
- **3D rendering**: Three.js (WebGL); `CubeRenderer3D` owns the scene graph
- **Puzzle logic**: cubing.js (`KPattern`, `KPuzzle`, `cube3x3x3`) — wrapped by `CubeState`, never exposed directly to consumers after feature 028
- **Dev server**: Vite (required — bare specifiers cannot be opened directly in a browser)
- **Target platform**: Browser only (Chrome, Safari, Firefox); WebGL required; no server-side rendering
- **Testing**: `verify-perms.mjs` (18-test cross-check suite) plus browser harness; Vitest headless suite planned in feature 027
- **Future wrappers**: TypeScript definitions (028), React components (029)
- **No frameworks in core**: the library itself has no React, no Vue, no Angular dependency

---

## Architecture Principles

These are hard rules derived from building features 022–026. Violating them has caused bugs that required full rewrites.

### 1. Physical simulation over computational reconstruction

Each cubelet is a physical piece. Its sticker colours are fixed — they never change. Only position and orientation change through animation.

- Bake sticker colours into Three.js mesh materials once at `resetToSolved()` + `applyMovesInstant()` (state load or jump)
- `animateMove()` physically rotates meshes via a pivot group — no colour changes
- Do **not** reset quaternions after animation — let them accumulate naturally
- Do **not** call any colour-setting method after an animated move

**Why**: computational colour reassignment after animation causes "sticker flicker" at the snap point. Physical simulation never flickers.

### 2. Mask travels with the cubelet — never reapply in animation callbacks

`applyStickering()` bakes grey textures into Three.js mesh materials. When a mesh moves during animation, its materials travel with it. This is correct by design.

**Only valid reapply sites**:
- `loadAlg()` — new case loaded
- `jumpTo(n)` / `reset()` — state jump
- `setStickering(str)` — mask changed
- Solved button / case reset

**Never call** `applyStickering` or `restoreColours` inside `animateMove` callbacks, `animateAlg` step callbacks, or any per-frame logic.

### 3. onDone callback chain — never race with the render loop

`animateMove()` drives animation from `_animTick` which runs inside the Three.js render loop. The `onDone` callback is deferred via `setTimeout(() => onDone?.(), 0)` to ensure it fires after the current frame settles.

- Use the `onDone` callback chain for sequencing moves — do not chain `animateMove` calls without waiting for `onDone`
- Use `animateAlg()` or `CubePlayer.play()` for sequences — do not manually schedule moves with `setInterval`
- A small inter-move gap (60 ms default) is required to let cubelet positions snap to integers before the next move's filter runs

### 4. cubing.js U/D direction is animation-only — never translate state

cubing.js `U` = WCA `U'` (counter-clockwise from above). D and E inherit the same flip.

- Fix is applied in `CubeRenderer3D.MOVE_AXIS` only — flip `dir` for U, D, E
- Do **not** translate move strings in `CubeState.applyMove()` or `applyAlg()`
- The internal state representation stays in cubing.js convention throughout

### 5. Stickering is homePos-keyed — never currentPos

The vis map passed to `applyStickering()` is keyed by `"x,y,z"` home grid position (piece identity, unchanged through any move). Slot indices are mesh-local and also unchanged.

- Never key by current world position
- Never query mesh quaternion to determine primary sticker direction — derive from `homePos` only
- After whole-cube rotations (`applyOrientation`), homePos is still the key

### 6. z2 orientation is state-level — never physical rotation for CFOP display

CFOP case display with yellow-on-top uses: `state = solvedBase.applyAlg(['z2', ...invertAlg(caseAlg)])`. The z2 is baked into the KPattern state.

- Do **not** use `applyOrientation('z2')` for CFOP display — this physically moves cubelets and breaks the MOVE_AXIS position filters
- State-level z2 means U layer holds the yellow pieces; all move filters work correctly
- `isSolved()` must use `{ ignorePuzzleOrientation: true }` on z2-rotated states

### 7. Orientation formula — always use (s - orientation + N) % N

- Corners: `colourIdx = (s - orientation + 3) % 3`
- Edges: `colourIdx = (s - orientation + 2) % 2`

The alternative `(s + orientation) % N` is wrong and produces scrambled corner colours.

---

## Rendering Invariants

Constraints that must hold at all times in the rendered state:

| Invariant | Rule |
|---|---|
| Cubelet colours | Set only at `resetToSolved()` + `applyMovesInstant()` |
| Stickering | Applied only at defined reapply sites (loadAlg, jumpTo, reset, setStickering) |
| Quaternion | Never reset to identity mid-sequence; accumulates through moves |
| Mesh position | Rounded to integer grid after every move (animation snap) |
| homePos | Never mutated; used as stickering key for the lifetime of the cubelet |
| animate guard | `_animating` flag prevents overlapping `animateMove` calls |

---

## Quality Standards

### Before any implementation

Read the five reference docs in `specs/` before touching cube state, rendering, or animation:

| Doc | What it guards |
|---|---|
| `lessons.md` | All hard-won gotchas — slot ordering, orientation formula, animation sequencing |
| `cubing-js-architecture.md` | KPuzzle/KPattern data model, orbit slot ordering |
| `cubing-js-stickering.md` | Orbit string semantics, stickering architecture |
| `cube-physical-rules.md` | Physical cube geometry, CFOP conventions |
| `cube-concepts.md` | Face state and KPattern overview |

### Before any merge

Run `verify-perms.mjs` (18 cross-checks of `CubeState.toFaceArray()` against cubing.js ground truth). All 18 must pass.

### Stickering correctness checklist

- [ ] OLL preset on Sune case: only U-face and top-of-side stickers visible
- [ ] Animated through a full Sune solve: grey travels with pieces (no reapplication needed)
- [ ] Reset case then re-apply mask: no sticker accumulation (grey only appears once)
- [ ] Clear mask: all stickers restored to full colour

---

## Development Guidelines

### Specification workflow

- `specs/spec.md` = feature ledger and canonical status record
- `specs/<NNN>-<kebab-name>/` = per-feature lifecycle artifacts (spec.md, plan.md, research.md, data-model.md, tasks.md)
- `CLAUDE.md` = agent context — update with each new module added
- `lessons.md` = living document — add lessons as they are discovered

### Feature sequence and graduation

Features gate each other in a deliberate sequence:

```
022 harness → 023 stickering → 024 animation → 025 theming → 026 export
                                     ↓                             ↓
                               027 tests                    028 library API
                                     ↓                             ↓
                               029 React wrapper ────────► 030 decouple
                                                                  ↓
                                                        031 cfop-app migration
```

Do not begin a feature until its prerequisites are complete and validated in the harness.

### Harness-first development

Every new capability is built and validated in `cubify-harness` before being packaged. The harness is not a demo — it is the development environment and regression suite.

### Module responsibilities

| Module | Responsibility boundary |
|---|---|
| `CubeState` | Immutable KPattern wrapper; no rendering |
| `CubeRenderer3D` | Three.js scene; no puzzle logic; no state tracking |
| `CubeRenderer2D` | Canvas 2D view; no Three.js |
| `CubeStickering` | Orbit string → vis map; no rendering |
| `CubePlayer` | Animation engine; owns `CubeRenderer3D`; emits events |
| `AlgParser` | WCA notation → string[]; no state |
| `CubeExporter` | PNG output; creates temporary renderer instances |

Modules must not reach across these boundaries. `CubeState` does not know about Three.js. `CubeRenderer3D` does not know about KPattern. `CubePlayer` owns the renderer — external code accesses it only via `player.renderer` when unavoidable.

### Dependency rule (post-028)

After feature 028, consumers must not import cubing.js directly. cubing.js is an internal implementation detail of cubify. This rule is enforced in the cfop-app migration (030).

### Harness state management

The harness (`index.html`) maintains two independent state tracks:

- **Simulation track** (`CubePlayer`) — alg-based step-through; driven by `CubePlayer` events
- **Live/Moves track** (`liveState`) — Moves tab exploration; harness-local variable, independent of `CubePlayer`

These must not be conflated. `CubePlayer` does not know about `liveState`.

---

## Constraints and Scope

- WebGL is required — no canvas-only 3D fallback
- No server-side rendering or Node.js 3D rendering path in the core library (cubify-scripts uses a separate Playwright approach)
- No social features, user accounts, or backend
- Algorithm data lives in the cfop repo's JSON files — cubify does not own or duplicate this data
- Mobile: browser-only (PWA via cfop-app); no native iOS/Android packaging in cubify itself
- Performance: 60 fps animation target; no frame budget regressions from new features
