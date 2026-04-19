# Research: 023 — cubify-stickering

## Decision 1 — Orbit string slot → cubelet index mapping

**Decision**: Hardcode three lookup arrays in `CubeStickering.js` mapping CORNERS/EDGES/CENTERS orbit slot indices to the 26-element cubelet index used by `CubeRenderer3D`.

**Rationale**: The mapping is derived from fixed geometry — cubelet positions are built by iterating `x,y,z ∈ {-1,0,1}` (skipping core), and orbit slot names (URF, UF, U etc.) map directly to known coordinates. Values are stable and do not change.

**Alternatives considered**: Deriving the lookup at runtime from `CubeState` CORNER_POSITIONS/EDGE_POSITIONS — rejected because it would introduce a CubeState import into CubeStickering and add runtime complexity for a purely static mapping.

---

## Decision 2 — Use masks.mjs orbit strings directly (z2 setup convention)

**Decision**: `CubeStickering.PRESETS` uses orbit string values copied from `masks.mjs` unchanged. The harness uses the same `z2` setup convention as cubify-scripts and cfop-app.

**Rationale**: The `z2` setup move is standard across all cubify rendering: before applying the inverse case alg, `z2` is applied to flip U↔D. This positions the case on the **D layer** (y=-1) for display. The camera looks down from above — the viewer sees the cross on top and the case pattern below, matching how a solver holds the cube. `masks.mjs` orbit strings target D-layer positions (slots 4–7) precisely because of this.

Using a different orientation in the harness would mean the stickering presets diverge from cfop-app. Since the harness is a test bed for cfop-app integration (spec 031), it must match. Using `masks.mjs` values directly means no translation layer ever.

**`O` token** with z2 convention: `O` shows only the D-face sticker (slot 3, -Y). After z2, the "yellow up" sticker of a D-layer piece faces downward at slot 3 — this is the sticker that reveals orientation in the OLL case pattern.

**Alternatives considered**: Define harness-specific orbit strings for U-layer-up display — rejected because it would create a permanent divergence between harness and cfop-app stickering, requiring translation when spec 031 integrates the library.

---

## Decision 3 — No cross-package import from cubify-scripts

**Decision**: `CubeStickering.js` does not import from `cubify-scripts/lib/masks.mjs`. Preset strings are embedded as constants, values manually kept in sync with `masks.mjs`.

**Rationale**: `cubify-scripts` and `cubify-harness` are separate packages. A cross-package relative import is fragile and would break if either directory moves. The orbit strings are a handful of short constants — cheap to duplicate.

**When the library is extracted (spec 028)**: masks.mjs and CubeStickering.PRESETS can be unified into a single shared constants file.
