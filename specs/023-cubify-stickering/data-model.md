# Data Model: 023 — cubify-stickering

## Orbit String Format

```
"EDGES:------------,CORNERS:--------,CENTERS:------"
```

- Comma-separated `ORBIT:chars` segments (order not guaranteed by parser)
- `EDGES`: 12 chars — slots UF, UR, UB, UL, DF, DR, DB, DL, FR, FL, BR, BL
- `CORNERS`: 8 chars — slots URF, URB, ULB, ULF, DRF, DLF, DLB, DRB
- `CENTERS`: 6 chars — slots U, R, F, D, L, B

## Char semantics

| Char | Name | Slot visibility |
|------|------|-----------------|
| `-` | show | All outward-facing slots visible |
| `I` | ignore | All slots hidden (grey plastic) |
| `O` | oriented | Only U face (slot 2) or D face (slot 3) visible |

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

## Preset Constants (U-layer-up convention, harness)

```js
const PRESETS = {
  'full':      'EDGES:------------,CORNERS:--------,CENTERS:------',
  'cross':     'EDGES:------------,CORNERS:IIIIIIII,CENTERS:------',
  'f2l':       'EDGES:IIII--------,CORNERS:IIII----,CENTERS:I-----',
  'oll':       'EDGES:IIII----IIII,CORNERS:OOOOIIII,CENTERS:------',
  'oll-2look': 'EDGES:OOOOIIIIIIII,CORNERS:IIIIIIII,CENTERS:------',
  'pll':       'EDGES:IIII--------,CORNERS:IIII----,CENTERS:------',
  'pll-2look': 'EDGES:IIIIIIIIIIII,CORNERS:IIII----,CENTERS:------',
};
```

> Note: these differ from `masks.mjs` MASKS because the harness displays with U-layer on top,
> while masks.mjs was designed for cubify-scripts which renders OLL/PLL from the D-layer perspective.

## VisibilityMap

Output of `fromOrbitString()` — unchanged from current API:

```js
Map<cubeletIndex: number, slotVisibility: boolean[6]>
// slot order: [0=+X=R, 1=-X=L, 2=+Y=U, 3=-Y=D, 4=+Z=F, 5=-Z=B]
// true = coloured sticker, false = hidden (grey plastic)
```
