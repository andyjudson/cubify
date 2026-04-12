# Data Model: 023 — cubify-stickering

## Orbit String Format

```
"EDGES:------------,CORNERS:--------,CENTERS:------"
```

- Comma-separated `ORBIT:chars` segments (order not guaranteed by parser)
- `EDGES`: 12 chars — slots UF, UR, UB, UL, DF, DR, DB, DL, FR, FL, BR, BL
- `CORNERS`: 8 chars — slots URF, URB, ULB, ULF, DRF, DLF, DLB, DRB
- `CENTERS`: 6 chars — slots U, R, F, D, L, B

## Char semantics (z2 setup convention)

| Char | Name | Slot visibility |
|------|------|-----------------|
| `-` | show | All outward-facing slots visible |
| `I` | ignore | All slots hidden (grey plastic) |
| `O` | orient | Primary (U/D face) grey; side stickers visible — matches twisty player `O` convention |

`O` follows the twisty player `experimentalStickeringMaskOrbits` convention: primary sticker (U face = slot 2, or D face = slot 3) is hidden; side stickers are shown. For a D-layer edge with `O`, the -Y sticker is grey and the side sticker is visible — a yellow side sticker means the piece is flipped, non-yellow means oriented. Middle-layer pieces have no primary face so all outward slots are shown.

## Alg Setup Convention

All OLL or PLL case rendering for cfop-app images, cubify-scripts, and the harness — uses `z2` before the inverse case alg:

```
setup state = z2 + inverse(case_alg) applied to solved cube
```

This positions the case on the D layer (y = -1). The viewer looks from above and sees:
- Cross on top (U layer, y=1) — already solved
- Case pattern on the bottom layer (D layer, y=-1) — being solved

`masks.mjs` orbit strings target D-layer slots (4–7 for edges, 4–7 for corners) because of this convention.

## Preset Constants (matches masks.mjs exactly)

```js
const PRESETS = {
  'full':         'EDGES:------------,CORNERS:--------,CENTERS:------',  // all pieces visible — no masking
  'cross-white':  'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------',  // U-layer edges shown (placement); all corners hidden
  'cross-yellow': 'EDGES:IIIIOOOOIIII,CORNERS:IIIIIIII,CENTERS:------',  // D-layer edge orientation stickers (O) only; all corners hidden
  'f2l':          'EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I',  // U+middle edges + U corners shown; D edges+corners hidden; B center hidden
  'oll-1look':    'EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------',  // D-layer edge+corner orientation (O); U+middle pieces fully shown
  'oll-2look':    'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------',  // D-layer edge orientation only; D corners hidden
  'pll-1look':    'EDGES:------------,CORNERS:--------,CENTERS:------',  // all pieces visible — full colour for permutation recognition
  'pll-2look':    'EDGES:----OOOO----,CORNERS:--------,CENTERS:------',  // D-layer edge orientation only; all corners fully shown
};
```

Values copied from `cubify-scripts/lib/masks.mjs`. Must be kept in sync manually until spec 028 library extraction.

## Lookup Tables (static constants in CubeStickering.js)

```js
// Maps CORNERS orbit slot index → cubelet array index
const CORNER_ORBIT_TO_CUBELET = [25, 23, 6, 8, 19, 2, 0, 17];
// URF=0→25, URB=1→23, ULB=2→6, ULF=3→8, DRF=4→19, DLF=5→2, DLB=6→0, DRB=7→17

// Maps EDGES orbit slot index → cubelet array index
const EDGE_ORBIT_TO_CUBELET = [16, 24, 14, 7, 11, 18, 9, 1, 22, 5, 20, 3];
// UF=0→16, UR=1→24, UB=2→14, UL=3→7, DF=4→11, DR=5→18, DB=6→9, DL=7→1
// FR=8→22, FL=9→5, BR=10→20, BL=11→3

// Maps CENTERS orbit slot index → cubelet array index
const CENTER_ORBIT_TO_CUBELET = [15, 21, 13, 10, 4, 12];
// U=0→15, R=1→21, F=2→13, D=3→10, L=4→4, B=5→12
```

## VisibilityMap

Output of `fromOrbitString()` — unchanged from current API:

```js
Map<cubeletIndex: number, slotVisibility: boolean[6]>
// slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
// true = coloured sticker, false = hidden (grey plastic)
```
