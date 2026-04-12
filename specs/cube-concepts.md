# Cube Concepts — Face State & KPattern

Reference for understanding how a 3×3 cube state is represented in this project.
Companion to [cube-mapping-lessons.md](cube-mapping-lessons.md) (implementation traps).

---

## 1. The physical cube

A 3×3 has **26 visible pieces** (cubelets):
- 8 **corners** — 3 coloured stickers each
- 12 **edges** — 2 coloured stickers each
- 6 **centres** — 1 coloured sticker each (fixed on a standard 3×3, they never move)

Each piece has a **position** (where it is on the cube) and an **orientation** (which way it is twisted/flipped).

---

## 2. Face state — the simple view

The simplest representation: a flat array of 54 sticker colours, one per sticker.

```
faces[faceIndex][stickerIndex] = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
```

**Face order** (WCA standard): `U=0, R=1, F=2, D=3, L=4, B=5`

**Sticker layout** per face (reading order, top-left to bottom-right):
```
0 1 2
3 4 5
6 7 8
```
So `faces[0][0]` = top-left sticker of the U face, `faces[2][4]` = centre of the F face, etc.

**What the values mean**: each value is the *home face* of the sticker's colour — not which face it's currently on, but which colour it is. So `faces[1][0] = 'U'` means the sticker in the top-left of the R face is white (the U colour).

**In the harness debug panel** the Face State tab shows this as:
```
U: UUUUUUUUU
R: RRRRRRRRR
F: FFFFFFFFF
D: DDDDDDDDD
L: LLLLLLLLL
B: BBBBBBBBB
```
A solved cube. After `R`: the right column of U becomes F, the right column of F becomes D, etc.

`CubeState.toFaceArray()` produces this. `CubeState.toString()` formats it as above.

---

## 3. KPattern — the piece-based view

KPattern is cubing.js's internal representation. Rather than 54 stickers, it tracks each **piece** by its current position and orientation.

It has three **orbits** (groups of interchangeable pieces):

### CORNERS orbit — 8 pieces

```js
patternData.CORNERS.pieces[slot]       // which piece is in this position (0–7)
patternData.CORNERS.orientation[slot]  // how it's twisted (0, 1, or 2)
```

**Solved state**: `pieces = [0,1,2,3,4,5,6,7]`, `orientation = [0,0,0,0,0,0,0,0]`

`pieces[slot] = n` means "the piece that belongs at home position n is currently sitting in slot".  
`orientation = 0` means the U/D sticker is facing up/down (its home direction).  
`orientation = 1` means twisted once clockwise, `2` = twice.

**Corner slot → position mapping** (verified, see cube-mapping-lessons.md §1):
| Slot | Corner | Position |
|------|--------|----------|
| 0 | URF | (x=1, y=1, z=1) |
| 1 | URB | (x=1, y=1, z=-1) |
| 2 | ULB | (x=-1, y=1, z=-1) |
| 3 | ULF | (x=-1, y=1, z=1) |
| 4 | DRF | (x=1, y=-1, z=1) |
| 5 | DLF | (x=-1, y=-1, z=1) |
| 6 | DLB | (x=-1, y=-1, z=-1) |
| 7 | DRB | (x=1, y=-1, z=-1) |

### EDGES orbit — 12 pieces

```js
patternData.EDGES.pieces[slot]         // which piece (0–11)
patternData.EDGES.orientation[slot]    // 0 = not flipped, 1 = flipped
```

| Slot | Edge | Slot | Edge |
|------|------|------|------|
| 0 | UF | 6 | DB |
| 1 | UR | 7 | DL |
| 2 | UB | 8 | FR |
| 3 | UL | 9 | FL |
| 4 | DF | 10 | BR |
| 5 | DR | 11 | BL |

### CENTERS orbit — 6 pieces

Fixed on a standard 3×3. Always `pieces = [0,1,2,3,4,5]`, `orientation = [0,0,0,0,0,0]`.

### Reading an example

After `R` (right face clockwise), corners URF/DRF/DRB/URB cycle. In KPattern:

```
Before R: CORNERS.pieces = [0,1,2,3,4,5,6,7]  orientation = [0,0,0,0,0,0,0,0]
After  R: CORNERS.pieces = [4,0,2,3,7,5,6,1]  orientation = [2,1,0,0,1,0,0,2]
```

Slot 0 (URF position) now holds piece 4 (DRF) with orientation 2 — the piece that was at DRF has moved up and twisted twice.

**In the harness debug panel** the KPattern tab shows `pieces` and `orientation` arrays for CORNERS and EDGES raw. Useful for verifying a specific state matches expectations.

---

## 4. Face state vs KPattern — when to use each

| | Face state | KPattern |
|---|---|---|
| **Best for** | Rendering, comparing colours, stickering | Move application, checking piece identity |
| **Source of truth** | Derived — computed from KPattern | Primary — cubing.js maintains this |
| **After a move** | Recompute via `toFaceArray()` | Updated automatically by cubing.js |
| **In this project** | Renderer reads this to colour stickers | `CubeState` wraps this internally |

`CubeState` is the bridge: it holds a KPattern and exposes `toFaceArray()` for rendering and `applyMove/applyAlg` for state transitions.

---

## 5. How `toFaceArray()` works

For each corner slot `i`:
1. Look up which piece `p = pieces[i]` is sitting there
2. Get `p`'s home sticker positions from `CORNER_POSITIONS[p]` — these give the 3 face colours
3. Apply the orientation formula to map each sticker to its current face position:
   ```js
   colourIdx = (s - orientation + 3) % 3
   ```
4. Write the colour to `CORNER_POSITIONS[i][s]` (the slot's face positions)

Same logic for edges with `(s - orientation + 2) % 2`.

The orientation formula direction (`s - orientation`, not `s + orientation`) is critical — the wrong sign gives scrambled corner colours. See cube-mapping-lessons.md §3.

---

## 6. Coordinate system

Three.js world coordinates used in `CubeRenderer3D`:
- **X**: left (−1) → right (+1)
- **Y**: down (−1) → up (+1)  
- **Z**: back (−1) → front (+1)

Cubelet positions are `{x, y, z}` ∈ {−1, 0, 1}³, skipping `(0,0,0)` (the core).

Face correspondence:
| Face | Direction | Normal |
|------|-----------|--------|
| U (up) | +Y | (0, 1, 0) |
| D (down) | −Y | (0, −1, 0) |
| R (right) | +X | (1, 0, 0) |
| L (left) | −X | (−1, 0, 0) |
| F (front) | +Z | (0, 0, 1) |
| B (back) | −Z | (0, 0, −1) |
