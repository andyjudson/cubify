# Research: Cubify Render Internals

**Feature**: 033-cubify-render-internals  
**Date**: 2026-05-13

---

## Decision 1: Sticker transparency approach

**Decision**: Mutate existing material properties (`transparent`, `opacity`, `depthWrite`) on sticker `THREE.Material` instances.

**Rationale**: Each outward slot has its own material instance (not shared). Setting `opacity < 1` with `transparent: true` applies alpha blending over the full sticker texture — the canvas texture already encodes the right colour; the material-level opacity scales it uniformly. No new textures needed. Material-level opacity is preserved through `resetToSolved()` and `applyStickering()` because those methods only update `mat.map`, not opacity/transparent flags.

**Alternatives considered**:
- New texture variant per opacity level: Cache miss explosion (texture cache keys colour+plastic+opacity+pad+radius+shape); would require a new texture per sticker per opacity change.
- Shader override: Far more complex; not warranted for a simple opacity toggle.
- `THREE.MeshBasicMaterial.alphaMap`: Requires a separate greyscale texture; no benefit over material opacity.

**`depthWrite: false` rationale**: When many transparent overlapping faces exist (full cube), disabling depth write prevents occluded transparent faces from writing to the depth buffer and hiding other transparent faces behind them. Standard Three.js pattern for transparent overlapping geometry.

---

## Decision 2: Internal wall rendering via DoubleSide + new material

**Decision**: Create `_internalsWallMaterial` with `THREE.DoubleSide`, `transparent: true`, `opacity: wallOpacity`, frame colour. Replace all inward-facing cubelet slots with this material when internals is enabled; restore to `_plasticMaterial` when disabled.

**Rationale**: The RoundedBoxGeometry generates normals pointing outward from the cubelet centre. For a cubelet at x=-1, its +X face has a normal pointing +X (inward toward cube centre). Back-face culling hides this face from the camera. Making the material `DoubleSide` renders both the outward-normal face AND the inward-normal back face. This makes the inner shell visible when looking through transparent stickers — exactly the "transparent hollow cube" illusion.

**Alternatives considered**:
- Add reversed-normal inner shell geometry per cubelet: Extra 26 BoxGeometry objects, more vertices/draw calls, more complex dispose logic.
- `THREE.BackSide` material only: Loses the outward plastic face appearance between sticker gaps. `DoubleSide` preserves both.
- Using the existing `_plasticMaterial` with `DoubleSide` flag: `_plasticMaterial` is shared; if we set `DoubleSide` on it, it affects all cubelets correctly — but we also need different opacity (wallOpacity vs plasticOpacity). Safest to create a dedicated instance.

**Frame colour derivation**: Use `this._theme.plasticColour` (same as the cubelet frame colour). The internal walls should match the physical plastic colour, not the sticker colour.

---

## Decision 3: Core geometry sizing

**Decision**: Sphere radius 0.22, arm cylinder radius 0.08, height 0.80, centred at ±0.62 along each axis.

**Rationale**: 
- Spec requires ~15% of cube half-size (1.5) = 0.225 → rounded to 0.22
- Arm length chosen so far end ≈ 1.02 from origin ≈ centre-piece position (1.0), matching spec "approximately the centre-piece position on each face"
- Cylinder radius 0.08 is visually proportionate to sphere at 0.22
- `SphereGeometry(0.22, 16, 12)` — 16 width segments, 12 height segments: smooth enough, minimal vertex count

**Arm rotation to align CylinderGeometry with each axis**:
CylinderGeometry is aligned to the Y axis by default. Rotations needed:
- ±Y arm: no rotation needed; just offset position to (0, ±0.62, 0)
- ±X arm: `rotation.z = Math.PI / 2`; offset to (±0.62, 0, 0)
- ±Z arm: `rotation.x = Math.PI / 2`; offset to (0, 0, ±0.62)

All 6 arms use the same `CylinderGeometry` instance (shared geometry, 6 meshes).

---

## Decision 4: Core material colour

**Decision**: Use `this._theme.plasticColour` as the core colour.

**Rationale**: The physical core mechanism of a real Rubik's cube is black plastic (same material as the cubelet frame). Using the theme's `plasticColour` matches the frame visual language. At `coreOpacity` (default 0.5) it appears as a dark translucent mechanism centre, which reads correctly.

**Alternatives considered**:
- A distinct accent colour: Would look out of place; the core isn't a feature piece, it's a mechanism.
- Derived from average of face colours: Overly complex; wrong semantics.

---

## Decision 5: `setInternals()` interaction with `setTheme()`

**Decision**: `setTheme()` calls `_applyInternalsToMaterials()` at the end if `_internalsEnabled`.

**Rationale**: `setTheme()` conditionally creates new material instances when `plasticChanged` or `materialTypeChanged`. New instances have default opacity=1. Calling `_applyInternalsToMaterials()` after `setTheme()` re-stamps all internals opacity settings and updates core/wall material colours to match the new theme's plastic colour.

`_applyInternalsToMaterials()` is a single private method that encapsulates all the opacity/DoubleSide mutations, called from both `setInternals(true)` and the `setTheme()` hook.

---

## Decision 6: `setInternals()` during animation

**Decision**: `setInternals()` proceeds even if the renderer is animating; material mutations are safe mid-animation.

**Rationale**: Material property mutations (opacity, transparent) are immediate and thread-safe in Three.js. The render loop will pick up the new values at the next frame. The core Group is added/removed from the scene directly — safe to do at any time since it's not part of any pivot group. This is simpler than queueing the enable until animation completes, and the spec does not require deferred enabling.

**Edge case noted in spec**: "What happens when `internals` is toggled mid-animation?" The spec says material update should "apply cleanly without visual artefact." Direct material mutation satisfies this.

---

## Decision 7: CubeExporter.toPNG — no internals mode

**Decision**: `CubeExporter.toPNG` does not support internals mode in this feature.

**Rationale**: The spec explicitly scopes this out: "only the live 3D renderer; export may remain fully opaque unless explicitly enabled." The exporter creates temporary renderer instances without internals state — fully opaque exports.

---

## Decision 8: React wrapper — no changes

**Decision**: `CubePlayerComponent` (`CubePlayer` React wrapper) does not add `internals` prop in this feature.

**Rationale**: The feature is a library extension validated in the harness. React wrapper exposure (a new `internals` prop on `<CubePlayer>`) would be a follow-on feature. Harness access is via `player.renderer.setInternals()` directly. The `CubePlayer.setInternals()` passthrough is added for completeness and future use.

---

## Decision 9: New module `CubeInternals.ts`

**Decision**: Extract core geometry construction into `packages/cubify/src/CubeInternals.ts`.

**Rationale**: Keeps `CubeRenderer3D.ts` focused on scene/animation management. `CubeInternals.ts` provides pure factory functions (`buildCoreGroup`, `buildWallMaterial`) — no class, no state, easily tree-shaken. The module is not exported from `index.ts` — it's an internal implementation detail.
