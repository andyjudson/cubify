# Feature 023 — Cubify Stickering: Implementation Summary

## What was built

A complete stickering mask system for the `cubify-harness` 3D renderer, matching TwistyPlayer's CFOP stickering semantics.

### Core modules

**`CubeStickering.js`**
- `fromOrbitStringWithState(str, rawPattern)` — parses orbit strings into a `Map<homePos, number[6]>` visibility map
- Vis levels: `0` = hidden (grey plastic), `1` = dim (faded colour), `2` = full colour
- Supported chars: `-` (full), `I` (hidden), `D` (dim), `O` (IgnoreNonPrimary), `P` (PermuteNonPrimary)
- Keyed by `homePos` (piece identity) so materials travel naturally through moves

**`CubeRenderer3D.js`**
- `applyStickering(visMap)` — applies vis levels to mesh materials; slot-indexed so no quaternion needed
- `restoreColours()` — resets all stickers to home colours before re-masking
- `FACE_DIM_COLOURS_HEX` — each face colour blended 50% toward grey-160 for dim mode
- `getWorldFaceMap()` — diagnostic: quaternion-based slot→world-face map

### 11 CFOP mask presets (harness UI)

| Label | Description |
|-------|-------------|
| Full | All stickers visible |
| Cross | D edges + D centre only |
| F2L | D + equatorial layer; U hidden |
| OLL-face | U primary (yellow) wherever it is; F2L full |
| OLL-face-dim | OLL-face with F2L faded |
| OLL-cross | U edges yellow, U corners hidden; F2L full |
| OLL-cross-dim | OLL-cross with F2L faded |
| PLL-corn | All corners full, U edges yellow; F2L full |
| PLL-corn-dim | PLL-corn with F2L faded |
| PLL-face | All U-face stickers bright; F2L faded |
| PLL-face-dim | U sides bright, yellow faint (P); F2L faded |

## Key design decisions

### Mask travels with the cubelet (§16)
Grey sticker textures are baked into Three.js mesh materials. When `animateMove` physically moves the mesh, materials travel with it — no extra work needed. `reapplyMask` is only called on case load, mask change, or reset. Never in animation callbacks.

### 'O' = piece's own facelet[0], not the sticker currently facing U (§17)
`IgnoreNonPrimary` shows the piece's own primary sticker (slot3=yellow for DRF pieces, slot2=white for URF pieces) wherever the mesh quaternion places it. For twisted OLL corners, yellow appears on the side face correctly. The primary slot is derived from `homePos`, not from the current world position.

### Identity-based rendering
The visibility map is keyed by `homePos` (piece identity, never changes). Slot indices in `vis[slot]` are also mesh-local. Both stay in sync through any rotation or move, so `applyStickering` can use `vis[slot]` directly without quaternion lookup.

## Reference docs added

- `specs/cubing-js-architecture.md` — KPuzzle/KPattern data model
- `specs/cube-physical-rules.md` — physical cube rules, CFOP conventions, masking philosophy
- `specs/cubing-js-stickering.md` — TwistyPlayer stickering architecture, char semantics
- `specs/cube-mapping-lessons.md` §16–17 — stickering implementation gotchas
