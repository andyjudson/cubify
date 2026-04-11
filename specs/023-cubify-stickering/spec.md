# Feature 023 — cubify-stickering

## Summary

Design and implement a stickering system for `cubify-harness` that uses the orbit string syntax already established in `cubify-scripts/lib/masks.mjs`. Named CFOP presets (`cross`, `f2l`, `oll`, `pll`) and their 2-look variants are expressed as orbit strings, and `CubeStickering` can parse them directly — no duplication between the two systems.

---

## Motivation

Feature 020 built `CubeStickering.forPreset()` using hand-written geometric logic (y-layer filters, slot indices). This works but:

- Duplicates the mask definitions already in `masks.mjs`
- Requires understanding 3D cubelet positions to add new presets
- The `masks.mjs` orbit string syntax (`EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------`) is already the right abstraction — compact, readable, matches cubing.js orbit naming

The correct design is: orbit strings are the source of truth. `CubeStickering` parses them into the `Map<cubeletIndex, boolean[6]>` format `CubeRenderer3D.applyStickering()` expects.

---

## Orbit String Syntax (from masks.mjs)

```
EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------
```

- `EDGES`: 12 characters, one per edge slot (cubing.js order: UF=0, UR=1, UB=2, UL=3, DF=4, DR=5, DB=6, DL=7, FR=8, FL=9, BR=10, BL=11)
- `CORNERS`: 8 characters (URF=0, URB=1, ULB=2, ULF=3, DRF=4, DLF=5, DLB=6, DRB=7)
- `CENTERS`: 6 characters (U=0, R=1, F=2, D=3, L=4, B=5)
- `-` = show all stickers on this piece
- `I` = ignore (hide all stickers — grey plastic)
- `O` = oriented only (show face-matching sticker only — used for edge flip detection)

---

## Presets (from masks.mjs)

| Preset      | Orbit string                                            | Description |
|-------------|--------------------------------------------------------|-------------|
| full        | `EDGES:------------,CORNERS:--------,CENTERS:------`  | All visible |
| cross       | `EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------`  | Top edges + U centre only |
| f2l         | `EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I`  | Bottom two layers |
| oll         | `EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------`  | 1-look OLL |
| oll-2look   | `EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------`  | 2-look OLL: edges only |
| pll         | `EDGES:------------,CORNERS:--------,CENTERS:------`  | 1-look PLL (same as full) |
| pll-2look   | `EDGES:----OOOO----,CORNERS:--------,CENTERS:------`  | 2-look PLL: corners only |

---

## Design

### CubeStickering.fromOrbitString(orbitStr)

Parses a masks.mjs orbit string and returns `Map<cubeletIndex, boolean[6]>`.

Key mapping challenge: orbit strings use cubing.js piece slot order; `CubeRenderer3D` uses cubelet index order from `buildCubeletPositions()` (geometric iteration). These must be cross-referenced.

Approach:
1. Parse orbit string into per-piece visibility: `{ EDGES: char[12], CORNERS: char[8], CENTERS: char[6] }`
2. For each cubelet position, determine its piece type (corner/edge/centre) and its cubing.js slot index by matching 3D position
3. Look up visibility char (`-`/`I`/`O`) and map to `boolean[6]` slot visibility

The 3D position → cubing.js slot mapping is already established in `cube-mapping-lessons.md` (corner/edge ordering verified).

### Named presets

`CubeStickering.forPreset(name)` becomes a thin wrapper over `fromOrbitString(PRESETS[name])`, where `PRESETS` mirrors `masks.mjs`. This replaces the current geometric logic entirely.

### `O` (oriented-only) character

For `O` pieces: show only the sticker on the face whose normal matches the piece's home face. For edges this means the U-face sticker only (if the edge is a top edge). For the PoC, `O` can be treated the same as `-` (show all) — the oriented-only behaviour is a refinement for step 2.

---

## Acceptance Criteria

- [ ] `CubeStickering.fromOrbitString(str)` parses all masks.mjs strings correctly
- [ ] `CubeStickering.forPreset(name)` uses orbit strings as source of truth
- [ ] All 7 presets render correctly in the harness demo
- [ ] Stickering UI wired back into `cubify-harness/index.html` with preset buttons
- [ ] `cubify-scripts/lib/masks.mjs` orbit strings can be passed directly to `fromOrbitString` — no translation layer needed

---

## Relationship to Other Features

- **020-cubify-harness**: `CubeStickering.js` and `CubeRenderer3D.applyStickering()` already exist — this feature completes them
- **017-cubify-agent-skill**: `masks.mjs` is the source of truth for orbit strings — this feature makes harness and scripts share the same definitions
