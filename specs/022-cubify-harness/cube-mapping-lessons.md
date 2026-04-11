# Cube State Mapping — Lessons Learned

Hard-won ground truth about cubing.js internals and 3D rendering.
Took significant debugging time to establish. Treat as foundational reference for any future cube state / rendering work.

---

## 1. cubing.js KPattern slot ordering

### Corners (`CORNERS` orbit, 8 slots)

**Actual order** (verified by intersecting which move affects which slots):

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

**How verified**: each corner is uniquely identified by the intersection of the three faces whose moves affect that slot.
e.g. URF = U ∩ R ∩ F = slot 0 ✓

**Common mistake**: older cubing.js docs / comments suggest 0=ULB. This is wrong. The actual order is 0=URF.

### Edges (`EDGES` orbit, 12 slots)

| Slot | Edge | Slot | Edge |
|------|------|------|------|
| 0 | UF | 6 | DB |
| 1 | UR | 7 | DL |
| 2 | UB | 8 | FR |
| 3 | UL | 9 | FL |
| 4 | DF | 10 | BR |
| 5 | DR | 11 | BL |

**How verified**: same intersection method — edge slot = intersection of its two face moves.

---

## 2. CORNER_POSITIONS sticker table

For each corner slot, the three sticker positions `[primary, secondary, tertiary]` as `[face_index, slot_within_face]` (face index: U=0, R=1, F=2, D=3, L=4, B=5; slot: reading order 0–8).

Primary = U or D face sticker.
Secondary/tertiary ordering is NOT simply "clockwise" — it is specific to cubing.js's orientation convention and must be used with the formula below.

```
Slot 0: URF → [[0,8], [1,0], [2,2]]   U[8], R[0], F[2]
Slot 1: URB → [[0,2], [5,0], [1,2]]   U[2], B[0], R[2]   ← B is secondary, not R
Slot 2: ULB → [[0,0], [4,0], [5,2]]   U[0], L[0], B[2]
Slot 3: ULF → [[0,6], [2,0], [4,2]]   U[6], F[0], L[2]
Slot 4: DRF → [[3,2], [2,8], [1,6]]   D[2], F[8], R[6]   ← F is secondary, not R
Slot 5: DLF → [[3,0], [4,8], [2,6]]   D[0], L[8], F[6]   ← L is secondary, not F
Slot 6: DLB → [[3,6], [5,8], [4,6]]   D[6], B[8], L[6]   ← B is secondary, not L
Slot 7: DRB → [[3,8], [1,8], [5,6]]   D[8], R[8], B[6]
```

**Surprising entries**: URB (B before R), DRF (F before R), DLF (L before F), DLB (B before L).
These were found via brute-force search over all 256 orderings, confirmed by checking T-perm order = 2 and T-perm U face = UUUUUUUUU.

---

## 3. Orientation formula

### Corners
```js
colourIdx = (s - orientation + 3) % 3
```
NOT `(s + orientation) % 3` — that formula is wrong and gives scrambled corner colours.

### Edges
```js
colourIdx = (s - orientation + 2) % 2
```

Where `s` is the sticker index within the piece (0=primary, 1=secondary, 2=tertiary for corners) and `orientation` is from `patternData.CORNERS.orientation[slot]` / `EDGES.orientation[slot]`.

---

## 4. toFaceArray() verification tests

A correct `toFaceArray()` implementation must pass all of these:

| Test | Expected |
|------|----------|
| Solved state | Every face is a single colour |
| After R: U[2,5,8] | F, F, F |
| After U: L[0,1,2] | F, F, F (cubing.js U = WCA U', see §5) |
| T-perm × 2 = solved | ✓ |
| T-perm U face | UUUUUUUUU (no corner twists on a PLL) |
| Sexy move (R U R' U') × 6 = solved | ✓ |
| Sune × 6 = solved | ✓ |

---

## 5. cubing.js move direction convention

**cubing.js `U` = WCA `U'`** (counter-clockwise from above). Same for `D`.

**Only U and D are affected.** R, L, F, B, M, S, E all match WCA direction. Verified by manually testing all 7 move pairs in the demo (CW = looking directly at the face).

**The correct fix is animation-only.** Do NOT translate moves in `CubeState.applyMove()` or `applyAlg()`. The internal state representation must stay in cubing.js-native convention throughout — `toFaceArray()`, case setup (inverse alg), and step-through all depend on it being consistent. Translating state breaks case setup.

**Only fix**: flip the Three.js animation `dir` for U and D in `CubeRenderer3D.js`:
```js
U: { axis: new THREE.Vector3(0, 1, 0), dir: -1, ... }  // was +1
D: { axis: new THREE.Vector3(0, 1, 0), dir: +1, ... }  // was -1
```

**Verified**: all named algs (Sune, T-Perm, Ua-Perm, H-Perm) set up correct case states and solve completely.

---

## 6. stickerIndex formula (CubeRenderer3D)

Maps a cubelet's 3D grid position `{x, y, z}` and a Three.js face slot (0–5) to the sticker index (0–8) within the WCA face array.

Three.js BoxGeometry slot order: `[+X=R, -X=L, +Y=U, -Y=D, +Z=F, -Z=B]`

Face sticker reading order (top-left to bottom-right when viewed from outside):
```
0 1 2
3 4 5
6 7 8
```

Correct formulas (where `idx(col, row) = (row+1)*3 + (col+1)`):

```js
case 0: return idx(-z, -y);  // +X = R face
case 1: return idx( z, -y);  // -X = L face
case 2: return idx( x,  z);  // +Y = U face   ← NOTE: +z not -z
case 3: return idx( x, -z);  // -Y = D face   ← NOTE: -z not +z
case 4: return idx( x, -y);  // +Z = F face
case 5: return idx(-x, -y);  // -Z = B face
```

**Common mistake**: U and D formulas were initially swapped (`idx(x,-z)` for U and `idx(x,z)` for D). This caused wrong sticker colours on U/D layer moves. The U and D formulas are mirror images of each other — easy to swap.

**How to verify**: check all 8 corner positions against known sticker indices from CORNER_POSITIONS.

---

## 7. Animation sequencing — never call onDone from inside the render tick

`animateMove()` drives animation via `_animTick`, which is called each frame from the render loop. When `t >= 1`, the move is complete and `_animating = false`.

**The problem**: calling `onDone()` synchronously from inside `_animTick` means the next `animateMove()` call (starting a new sequence) sets `_animTick` while still executing the old one. The new tick gets overwritten on return from the old call.

**The fix**: `setTimeout(() => onDone?.(), 0)` — defers `onDone` to the next event loop turn, after the current frame has fully settled.

**Sequencing moves**: to animate a sequence, use `renderer.animateAlg(moves, onStep, onComplete)`. Do not chain `animateMove` calls manually via callbacks — `animateAlg` handles this correctly.

**The trap**: per-move chaining with `onDone → next()` looks correct but races with the render loop. It worked for single buttons (no chain) but broke for text input sequences. Using `animateAlg` directly is the reliable path.

---

## 8. Physical rendering architecture (critical)

**The fundamental principle**: each cubelet is a physical piece. Its sticker colours are fixed — they never change. Only position and orientation change.

**What goes wrong** if you reassign colours after each animated move:
- `setState()` reads `toFaceArray()` and maps colours via `stickerIndex`
- Any bug in either function causes wrong colours at the animation snap point — visually a "sticker flicker"
- The flicker is hard to debug because the error only appears at the moment of state transition

**Correct architecture**:
- Bake sticker colours into materials once at `setState()` (initial load or instant state jump)
- `animateMove()` physically rotates cubelet meshes via a pivot — no colour changes
- Do **not** reset quaternion after animation — let it accumulate
- Do **not** call `setState()` after animation — colours already travel with the mesh

**When `setState()` is legitimately called**:
- Initial load
- Instant jump to a new algorithm position (step back, load new alg)
- Must reset all quaternions to identity before assigning colours, because `stickerIndex` assumes identity orientation

**Key insight**: a physically-simulated cube never has sticker flicker because stickers don't change in reality. A computationally-reconstructed cube can flicker whenever the reconstruction has a bug. Prefer physical simulation.
