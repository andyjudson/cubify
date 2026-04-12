# Research: 023 — cubify-stickering

## Decision 1 — Orbit string slot → cubelet index mapping

**Decision**: Hardcode three lookup arrays in `CubeStickering.js` mapping CORNERS/EDGES/CENTERS orbit slot indices to the 26-element cubelet index used by `CubeRenderer3D`.

**Rationale**: The mapping is derived from fixed geometry — cubelet positions are built by iterating `x,y,z ∈ {-1,0,1}` (skipping core), and orbit slot names (URF, UF, U etc.) map directly to known coordinates. Verified by computing cubelet index = position in the 3-nested-loop iteration for each piece. Values are stable and do not change.

**Alternatives considered**: Deriving the lookup at runtime from `CubeState` CORNER_POSITIONS/EDGE_POSITIONS — rejected because it would introduce a CubeState import into CubeStickering and add runtime complexity for a purely static mapping.

---

## Decision 2 — `O` token semantics and display orientation

**Decision**: Define harness-specific preset orbit strings (U-layer-up convention) rather than reusing `masks.mjs` strings directly.

**Rationale**: `masks.mjs` was designed for cubify-scripts where the OLL/PLL case setup places the relevant layer at the **bottom** of the rendered cube (D-layer). The harness displays cases with the U layer on top. Using masks.mjs OLL/PLL strings unmodified would sticker the wrong layer. Defining harness constants using the same syntax keeps the format consistent while correcting for orientation.

**`O` token**: shows only the U-face sticker (slot 2, +Y) or D-face sticker (slot 3, -Y) on a piece. Used for edge orientation indication — the coloured band facing up/down without showing side stickers.

**Alternatives considered**: Adapting the cube state orientation so masks.mjs strings could be used directly (flipping the cube 180° for OLL/PLL display) — rejected because it would complicate setState/animation and the existing cases load correctly with U-up.

---

## Decision 3 — No cross-package import from cubify-scripts

**Decision**: `CubeStickering.js` does not import from `cubify-scripts/lib/masks.mjs`. Preset strings are defined as constants within `CubeStickering.js` itself.

**Rationale**: `cubify-scripts` and `cubify-harness` are separate packages with different entry points. A cross-package relative import would be fragile and would break if either directory moves. The orbit string syntax is simple enough to embed directly — the constants are a handful of strings.

**When the library is extracted (spec 028)**: the harness PRESETS constants and masks.mjs MASKS can be reconciled at that point (either unified or clearly documented as having different orientation conventions).
