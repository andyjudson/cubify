# Data Model: 026 — cubify-image-export

## Entities

### GridCell

Represents one visible sticker position in the 5×5 top-down grid.

| Field | Type | Description |
|-------|------|-------------|
| row | number (0–4) | Grid row, 0 = top (B side) |
| col | number (0–4) | Grid column, 0 = left (L side) |
| face | number (0–5) | Face index in toFaceArray(): U=0,R=1,F=2,D=3,L=4,B=5 |
| fsi | number (0–8) | Sticker index within that face (reading order) |
| orbit | 'CORNERS'\|'EDGES'\|'CENTERS' | cubing.js orbit name |
| slotI | number | Orbit slot index (0–7 corners, 0–11 edges, 0–5 centers) |
| visSlot | number (0–5) | Slot index in visMap's boolean[6] array to check visibility |

Corner positions `(0,0)`, `(0,4)`, `(4,0)`, `(4,4)` are `null` (no sticker shown).
Total visible cells: 21 (9 U-face + 3 per side strip × 4 sides).

---

### VisMap

`Map<string, number[]>` — homePos → slot vis levels.

- **Key**: homePos string `"x,y,z"` (the piece's solved-state position in the scene)
- **Value**: `number[6]` — vis level per slot: 0=hidden(grey), 1=dim(faded), 2=full colour
- **Source**: `CubeStickering.fromOrbitStringWithState(orbitString, rawPattern)`

---

### RawPattern

Object from `CubeState.toRawPattern()`. Used by CubeRenderer2D to resolve piece identity.

```js
{
  corners: { pieces: number[8], orientation: number[8] },
  edges:   { pieces: number[12], orientation: number[12] },
  centers: { pieces: number[6], orientation: number[6] },
}
```

`pieces[slotI]` = piece ID currently occupying orbit slot `slotI`.

---

### CubeRenderer2D (class)

| Property | Type | Description |
|----------|------|-------------|
| canvas | HTMLCanvasElement | Drawing surface |
| ctx | CanvasRenderingContext2D | 2D context |
| size | number | Canvas size in px (default 400) |
| theme | object | Colour palette (FACE_COLOURS + vis blend config) |

**Constructor**: `new CubeRenderer2D(container, { size = 400 } = {})`
- Creates a `<canvas>` element, appends to container.

**Methods**:

| Method | Signature | Description |
|--------|-----------|-------------|
| update | `(state: CubeState, visMap: Map) → void` | Re-render with current state + mask |
| toDataURL | `(type = 'image/png') → string` | PNG data URL for export |
| toSVG | `(state: CubeState, visMap: Map) → string` | Pure SVG string, no canvas (for Node.js) |
| destroy | `() → void` | Remove canvas from DOM |

---

## Piece Identity Resolution (pseudocode)

```js
function getVisLevel(cell, rawPattern, visMap) {
  const { orbit, slotI, visSlot } = cell;
  const pieces = rawPattern[orbit.toLowerCase()].pieces;  // corners/edges/centers
  const pieceId = pieces[slotI];

  // pieceId → cubelet array index → homePos
  const cubeletIdx = ORBIT_TO_CUBELET[orbit][pieceId];
  const homePos = CUBELET_POSITIONS[cubeletIdx];
  const key = `${homePos.x},${homePos.y},${homePos.z}`;

  const visArray = visMap.get(key);
  if (!visArray) return 2;   // no masking — show full
  return visArray[visSlot];  // 0, 1, or 2
}
```

Where `ORBIT_TO_CUBELET` maps orbit name to the appropriate lookup table:
- `CORNERS` → `CORNER_ORBIT_TO_CUBELET` (imported from CubeStickering.js)
- `EDGES` → `EDGE_ORBIT_TO_CUBELET`
- `CENTERS` → `CENTER_ORBIT_TO_CUBELET`

---

## Canvas Geometry Model

```
┌─────────────────────────────┐  size × size px canvas
│  margin                      │
│  ┌───┬─────────────┬───┐    │
│  │   │  B  strip   │   │    │  stripDepth height
│  ├───┼──┬──┬──┬───┤   │    │
│  │ L │  │  │  │   │ R │    │
│  │   ├──┼──┼──┤   │   │    │  3 × cellSize height
│  │   │  │ U │  │   │   │    │
│  ├───┼──┼──┼──┼───┤   │    │
│  │   │  F  strip   │   │    │  stripDepth height
│  └───┴─────────────┴───┘    │
└─────────────────────────────┘

Layout constants (size = 400):
  margin     = 20px
  cellSize   = 82px   (size * 0.62 / 3, rounded)
  stripDepth = 52px   (size * 0.13)
  uOrigin.x  = margin + stripDepth = 72px
  uOrigin.y  = margin + stripDepth = 72px
  uSize      = cellSize * 3 = 246px
```

Side strip trapezoid vertices (example: F strip, left cell):
```
inner-left  = (uOrigin.x, uOrigin.y + uSize)
inner-right = (uOrigin.x + cellSize, uOrigin.y + uSize)
outer-right = (uOrigin.x + cellSize * taper, uOrigin.y + uSize + stripDepth)
outer-left  = (uOrigin.x - cellSize * (1 - taper) / 2, uOrigin.y + uSize + stripDepth)
```
Where `taper = 0.7` (outer edge is 70% width of inner edge, centred).
