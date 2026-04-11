# Research: cubify-harness (Feature 020)

## Decision: Three.js for 3D rendering

**Decision**: Three.js v0.170.0 (already transitive in repo via cubing.js).
**Rationale**: Supports OffscreenCanvas, well-maintained, handles WebGL abstraction (geometry, normals, lighting, camera). Cube geometry (26 cubelets) is simple enough that Three.js is not overkill.
**Alternative rejected**: Raw WebGL — prohibitive implementation cost for geometry, normals, lighting, and projection with no meaningful benefit at this scale.

## Decision: ResizeObserver for mount lifecycle

**Decision**: `ResizeObserver` on the container div. Renderer canvas sized to container on first callback (fires on next layout tick if container is zero-height at mount time).
**Rationale**: Eliminates TwistyPlayer's IntersectionObserver gate — the primary source of `height: 0` bugs. ResizeObserver always fires regardless of visibility or intersection.
**Alternative rejected**: IntersectionObserver (TwistyPlayer's approach) — fires only when element enters viewport and requires non-zero rect at mount time.

## Decision: 26 BoxGeometry cubelets with material arrays

**Decision**: One `BoxGeometry` per cubelet, `MeshStandardMaterial[6]` per cubelet (one material per face). Sticker colour = material colour on the outward-facing face; inner faces set to black.
**Rationale**: Clean per-sticker colour mutation. Standard approach for interactive cube renderers. Easy to remap on stickering preset change.
**Alternative rejected**: Single merged geometry with vertex colours — complex to update individual sticker colours; harder to debug.

## Decision: SVG as primary headless export path

**Decision**: `CubeRenderer2D` generates pure SVG string (no canvas, no browser). This replaces the Playwright/headed-Chromium path in cubify agent skill.
**Rationale**: `OffscreenCanvas` is browser-only (confirmed absent in Node 23). SVG generation has zero runtime dependencies and works in any environment.
**Node.js PNG**: Deferred — requires `node-canvas` + Three.js canvas injection. Document pattern, implement in next feature.

## Decision: cubing/alg as peer dependency

**Decision**: Import `Alg` and `experimentalLeafMoves()` from `cubing/alg`. Listed as `peerDependencies` in `cubify-harness/package.json` — not bundled.
**Rationale**: WCA-compliant notation parsing is well-tested and not worth reinventing. Confirmed importable standalone with zero TwistyPlayer pull-in.
**Alternative rejected**: Custom parser — regexp-based WCA notation parsing is error-prone for wide moves, rotations, and nested groupings.

## Decision: Plain JavaScript ESM, no TypeScript

**Decision**: Library source in `.js` with JSDoc comments. TypeScript consumers can use JSDoc-generated types or write their own `.d.ts`.
**Rationale**: Keeps library zero-build-step. TypeScript build tooling lives in cfop-app, not in a standalone library. JSDoc provides IDE completion without a compile step.
**Alternative rejected**: TypeScript — adds build step requirement for library consumers; unnecessary for a PoC.

## Key finding: OffscreenCanvas in Node.js

`OffscreenCanvas` is **not** available in Node.js 23 natively. Browser-only Web API. For Node.js headless PNG:
- `node-canvas` v3.x provides `createCanvas()` compatible with Three.js's canvas injection pattern
- `gl` v8.x provides a headless WebGL context
- **PoC defers this** — SVG export covers the agent skill migration use case immediately
