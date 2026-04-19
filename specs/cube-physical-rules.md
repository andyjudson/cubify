# Cube Physical Rules & CFOP Conventions

Reference document for the cubify renderer and CFOP learning app.
Companion to `cube-mapping-lessons.md` (cubing.js implementation gotchas) and the cubing.js architecture doc.

---

## 1. Physical Cube Geometry

### 1.1 Piece Types

| Type    | Count | Description                                         |
|---------|-------|-----------------------------------------------------|
| Centers | 6     | One per face. Single sticker. Fixed relative to each other. |
| Edges   | 12    | Two-sticker pieces between two faces.               |
| Corners | 8     | Three-sticker pieces at intersections of three faces.|

**Total stickers: 6×1 + 12×2 + 8×3 = 54.**

### 1.2 Default / Solved Orientation (WCA / cubing.js)

| Face | Colour |
|------|--------|
| U    | White  |
| R    | Red    |
| F    | Green  |
| D    | Yellow |
| L    | Orange |
| B    | Blue   |

This is the reference orientation used by cubing.js `defaultPattern()` and all piece/orientation tables in `cube-mapping-lessons.md`.

### 1.3 Center Behaviour

- Centers are **fixed relative to each other** — on a standard 3×3 they cannot be permuted by normal layer moves.
- Centers **do move** when a **slice move** (M, E, S) or **whole-cube rotation** (x, y, z, x2, y2, z2) is applied.
- After a `z2` rotation: U↔D swap (white↔yellow), R↔L swap (red↔orange), F and B are unchanged.
- Centers define the colour of their face. A face's colour is whatever its center sticker shows — this is the canonical reference for "is this piece solved on this face?"

### 1.4 Sticker Locking (Physical Design)

Each sticker is permanently bonded to its cubelet facet at manufacture. The sticker's colour is a property of the physical cubelet, not of position:

- **A corner piece has exactly 3 sticker colours** — one for each of the three faces it touches in its home position.
- **An edge piece has exactly 2 sticker colours** — one for each of the two faces it touches in its home position.
- Moving a piece changes **which position it occupies** and **its orientation** — it does not change **which colours are on it**.
- This is what "orientation" in cubing.js means: the rotational state of a piece relative to its current position slot.

---

## 2. Scrambles and Solving Orientation

### 2.1 Scramble Convention

- WCA scrambles and most digital scramblers generate moves assuming **white U, green F** (the default orientation).
- Scrambles are applied from the solver's point of view looking at the front face.
- cubing.js `applyAlg()` uses this same convention — moves are applied to the default-orientation state.

### 2.2 Cross

- **Visual convention (diagrams, apps):** Cross is typically shown with **white on U** — the cross is on top.
- **Physical solving convention (speed cubing):** Cross is solved with **white on D** — the cross is on the bottom. This frees the U face for F2L slot work without craning to look underneath.
- Implication for masking: when showing a cross diagram, the viewer expects white U. When showing F2L/OLL/PLL, the cube is already flipped with white D.

### 2.3 F2L

- Solved with **white on D** (cross already on bottom).
- F2L pairs (one corner + one edge) are inserted into the four slots between the D-layer cross and the U layer.
- The U face is used as the working space — pieces are manipulated on U before being inserted.
- **Mask:** D layer + middle layer stickered; U layer hidden or minimally shown (e.g. just center).

### 2.4 OLL (Orientation of the Last Layer)

- Solved with **white on D**, **yellow on U**.
- Goal: get all yellow stickers facing up (U face) without regard to permutation.
- **Mask for visualization:** Show F2L (D + middle layers) fully stickered. On the U layer, show **only the U-face sticker** of each piece (yellow) — mask the side stickers on the U-layer corners and edges. This focuses attention on the yellow pattern without colour noise from side stickers.
- Orbit string for this mask: `EDGES:OOOO--------,CORNERS:OOOO----,CENTERS:------`
  - `O` = show primary (U-face) sticker only for this piece
  - `-` = show all outward stickers
  - `I` = hide (grey plastic)

### 2.5 PLL (Permutation of the Last Layer)

- Solved with **white on D**, **yellow on U** (all yellow already facing up after OLL).
- Goal: permute last-layer pieces into their correct positions.
- **Mask for visualization:** Show U layer fully (all stickers visible so permutation pattern is clear). Hide F2L (D + middle layers) as they're already solved and add visual noise.
- Orbit string: `EDGES:----IIIIIIII,CORNERS:----IIII,CENTERS:------`

### 2.6 The z2 Convention in This App

When displaying an F2L, OLL or PLL case:
- The case is defined as an algorithm that, when applied to a solved cube, produces the case starting position.
- We want **yellow on U** for the display.
- Solution: apply `z2` to the solved state first (white↔yellow flip), then apply the inverse of the case algorithm.
- This is baked into the KPattern state: `_solvedBase.applyAlg(['z2', ...invertAlg(caseAlg)])`.
- The animation then plays the case algorithm moves forward — they execute on the yellow-U cube.

---

## 3. Move Notation Reference

### 3.1 Standard Face Moves

| Move | Face  | Direction          |
|------|-------|--------------------|
| U    | Up    | Clockwise (from above) |
| U'   | Up    | Counter-clockwise  |
| U2   | Up    | 180°               |
| R    | Right | Clockwise (from right) |
| F    | Front | Clockwise (from front) |
| D    | Down  | Clockwise (from below) |
| L    | Left  | Clockwise (from left) |
| B    | Back  | Clockwise (from behind) |

"Clockwise" always means from the perspective of looking directly at that face from outside the cube.

### 3.2 Slice Moves

| Move | Slice         | Direction (follows adjacent face) |
|------|---------------|-----------------------------------|
| M    | Middle (L–R)  | Same direction as L               |
| E    | Equatorial    | Same direction as D               |
| S    | Standing      | Same direction as F               |

### 3.3 Whole-Cube Rotations

| Move | Equivalent to | Effect on centers                    |
|------|---------------|--------------------------------------|
| x    | R + L' + M'   | U→F, F→D, D→B, B→U                  |
| y    | U + D' + E'   | F→R, R→B, B→L, L→F                  |
| z    | F + B' + S    | U→R, R→D, D→L, L→U                  |
| z2   | z z           | U↔D, R↔L, F and B unchanged         |

After `z2`: white (was U) is now D, yellow (was D) is now U. Red and orange swap. Green and blue are unchanged.

### 3.4 cubing.js Quirk: Animation Axis Direction

cubing.js animates U moves with the **opposite** visual rotation to the WCA convention. This is an animation-only difference — the **state** (KPattern) is correct. Do not compensate in state logic; compensate only in animation axis direction if needed.

See `cube-mapping-lessons.md` §5 for detail.

---

## 4. Orientation Conventions

### 4.1 Corner Orientation

A corner has 3 possible orientations (0, 1, 2):
- **0** = primary sticker (U or D colour) is on the U or D face.
- **1** = primary sticker has been twisted clockwise once.
- **2** = primary sticker has been twisted clockwise twice (= once counter-clockwise).

Sticker colour at face-slot `s` given piece `pieceId` at orientation `o`:
```
colour = homeColours[(s - o + 3) % 3]
```
where `homeColours` = the 3 colours of `pieceId` in home-slot order. **Not** `(s + o) % 3`.

### 4.2 Edge Orientation

An edge has 2 possible orientations (0, 1):
- **0** = primary sticker is on its primary face.
- **1** = flipped.

```
colour = homeColours[(s - o + 2) % 2]
```

### 4.3 Center Orientation

Centers on a standard 3×3 have fixed orientation — their single sticker always faces outward. The orientation value in the CENTERS orbit is always 0 and can be ignored.

---

## 5. Masking Philosophy

### 5.1 Purpose

Masking grey-plastics pieces not relevant to the current solving step:
- Reduces visual noise.
- Directs attention to the pieces that matter.
- Consistent with how printed CFOP resources show cases.

### 5.2 Mask Levels

| Preset  | What's visible                                           | Orbit string pattern                                        |
|---------|----------------------------------------------------------|-------------------------------------------------------------|
| Full    | Everything                                               | `EDGES:------------,CORNERS:--------,CENTERS:------`        |
| F2L     | D layer + middle layer (cross + F2L slots)               | `EDGES:IIII--------,CORNERS:IIII----,CENTERS:------`        |
| OLL     | F2L fully + U-layer U-face only (yellow top pattern)     | `EDGES:OOOO--------,CORNERS:OOOO----,CENTERS:------`        |
| OLL-2L  | U-layer edges U-face only (corner blind, edge orient)    | `EDGES:OOOOIIIIIIII,CORNERS:IIIIIIII,CENTERS:------`        |
| PLL     | U layer fully + F2L hidden                               | `EDGES:----IIIIIIII,CORNERS:----IIII,CENTERS:------`        |

### 5.3 Orbit String Format

`EDGES:12chars,CORNERS:8chars,CENTERS:6chars`

- Char position = orbit slot index (see cubing.js architecture doc for exact ordering).
- `-` = show all outward stickers on this piece.
- `I` = hide all stickers (grey plastic).
- `O` = show primary sticker only (U-face for U-layer pieces, D-face for D-layer pieces).
- EDGES chars 0–3 = U-layer edges (UF, UR, UB, UL), 4–7 = D-layer, 8–11 = middle.
- CORNERS chars 0–3 = U-layer corners (URF, URB, ULB, ULF), 4–7 = D-layer.

---

## 6. Relationship Between This App and WCA Conventions

- WCA defines the standard colours and orientation.
- This app uses WCA default (white U, green F) as the `_solvedBase`.
- CFOP learning convention (white D for F2L/OLL/PLL) is applied via `z2` at the display layer, not as a permanent orientation change.
- WCA scrambles can be applied directly via `applyAlg()` — no translation needed.
- Algorithm databases (OLL/PLL JSON) store moves in standard WCA notation; they execute correctly after the `z2` display setup.
