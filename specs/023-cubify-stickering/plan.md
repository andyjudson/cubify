# Implementation Plan: 023 — cubify-stickering

**Branch**: `023-cubify-stickering` | **Spec**: [spec.md](spec.md)

## Summary

Replace `CubeStickering.forPreset()`'s hand-written geometric logic with an orbit string parser (`fromOrbitString()`), using `cubify-scripts/lib/masks.mjs` as the single source of truth for all preset definitions. Add stickering preset controls to the harness demo.

---

## Technical Context

**Language/Version**: ES module JavaScript (Node 24 / browser)  
**Primary Dependencies**: Three.js (via CubeRenderer3D), cubing.js (via CubeState) — neither changes  
**Storage**: N/A  
**Testing**: `verify-perms.mjs` pattern — standalone Node ESM verification script  
**Target Platform**: Browser (harness demo) + Node (future library)  
**Project Type**: Library module + demo wiring  
**Performance Goals**: Stickering is applied once per setState — no per-frame cost  
**Constraints**: Must not change `CubeRenderer3D.applyStickering()` API — it already accepts `Map<cubeletIndex, boolean[6]>`

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Educational focus | ✅ | Stickering directly supports CFOP case learning |
| Minimal dependencies | ✅ | No new dependencies — internal refactor |
| Open source / no paywall | ✅ | |
| Spec workflow compliance | ✅ | Branch created, plan.md in place |

---

## Project Structure

```
cubify-harness/
├── src/
│   └── CubeStickering.js      # MODIFIED — fromOrbitString() replaces geometric logic
├── index.html                 # MODIFIED — stickering preset buttons in controls panel
cubify-scripts/
│   └── lib/masks.mjs          # READ ONLY — source of truth for preset orbit strings
specs/023-cubify-stickering/
├── plan.md                    # This file
├── research.md                # Phase 0
└── data-model.md              # Phase 1
```

---

## Phase 0: Research

### R1 — Orbit string slot → cubelet index mapping

The cubelet array in `CubeRenderer3D` is built as:
```js
for x of [-1,0,1] / for y of [-1,0,1] / for z of [-1,0,1], skip (0,0,0)
```
That gives 26 cubelets at indices 0–25.

**CORNERS** orbit slot → cubelet index (derived from position):

| Slot | Corner | Position | Cubelet idx |
|------|--------|----------|-------------|
| 0 | URF | {x:1, y:1, z:1} | 25 |
| 1 | URB | {x:1, y:1, z:-1} | 23 |
| 2 | ULB | {x:-1, y:1, z:-1} | 6 |
| 3 | ULF | {x:-1, y:1, z:1} | 8 |
| 4 | DRF | {x:1, y:-1, z:1} | 19 |
| 5 | DLF | {x:-1, y:-1, z:1} | 2 |
| 6 | DLB | {x:-1, y:-1, z:-1} | 0 |
| 7 | DRB | {x:1, y:-1, z:-1} | 17 |

**EDGES** orbit slot → cubelet index:

| Slot | Edge | Position | Cubelet idx |
|------|------|----------|-------------|
| 0 | UF | {x:0, y:1, z:1} | 16 |
| 1 | UR | {x:1, y:1, z:0} | 24 |
| 2 | UB | {x:0, y:1, z:-1} | 14 |
| 3 | UL | {x:-1, y:1, z:0} | 7 |
| 4 | DF | {x:0, y:-1, z:1} | 11 |
| 5 | DR | {x:1, y:-1, z:0} | 18 |
| 6 | DB | {x:0, y:-1, z:-1} | 9 |
| 7 | DL | {x:-1, y:-1, z:0} | 1 |
| 8 | FR | {x:1, y:0, z:1} | 22 |
| 9 | FL | {x:-1, y:0, z:1} | 5 |
| 10 | BR | {x:1, y:0, z:-1} | 20 |
| 11 | BL | {x:-1, y:0, z:-1} | 3 |

**CENTERS** orbit slot → cubelet index:

| Slot | Face | Position | Cubelet idx |
|------|------|----------|-------------|
| 0 | U | {x:0, y:1, z:0} | 15 |
| 1 | R | {x:1, y:0, z:0} | 21 |
| 2 | F | {x:0, y:0, z:1} | 13 |
| 3 | D | {x:0, y:-1, z:0} | 10 |
| 4 | L | {x:-1, y:0, z:0} | 4 |
| 5 | B | {x:0, y:0, z:-1} | 12 |

### R2 — `O` token semantics vs harness display orientation

The `O` (oriented) token means: show only the U or D face sticker on this piece.

In `masks.mjs` the OLL preset uses `O` on D-layer edges/corners (slots 4–7). This was designed for cubify-scripts where the case setup places the OLL case at the bottom of the displayed cube. In the **harness the case is shown with the U layer on top**, so OLL case setup places relevant pieces in the **U layer** (slots 0–3).

**Resolution**: define harness-specific preset orbit strings for presets where the display orientation differs from cubify-scripts. Specifically OLL and PLL presets need adapted strings. `cross` and `f2l` strings can be used directly.

**Harness-adapted preset strings** (U-layer-up convention):

| Preset | Orbit string | Rationale |
|--------|-------------|-----------|
| full | `EDGES:------------,CORNERS:--------,CENTERS:------` | All visible, same as masks.mjs default |
| cross | `EDGES:------------,CORNERS:IIIIIIII,CENTERS:------` | U+middle edges visible, all corners hidden |
| f2l | `EDGES:IIII--------,CORNERS:IIII----,CENTERS:I-----` | Hide U layer; show D + middle |
| oll | `EDGES:----IIII----,CORNERS:----OOOO,CENTERS:------` | U layer: all; D+middle: hide; corners: U sticker only |
| oll-2look | `EDGES:OOOOIIII----,CORNERS:IIIIIIII,CENTERS:------` | U edge orientations only, corners hidden |
| pll | `EDGES:IIII--------,CORNERS:IIII----,CENTERS:------` | U layer all, rest hidden |
| pll-2look | `EDGES:IIII--------,CORNERS:IIII----,CENTERS:------` | Top corners only |

> **Note**: the harness preset strings differ from masks.mjs because the rendering perspective is inverted. This is documented — masks.mjs remains the source of truth for cubify-scripts; harness defines its own constants that follow the same syntax.

### R3 — `O` token slot visibility

For a given piece, `O` (oriented) means:
- Show only the **outward sticker on the U or D face**
- Three.js slot 2 = +Y = U face; slot 3 = -Y = D face
- All other outward slots → false

---

## Phase 1: Design & Contracts

### Data Model

```js
// Parsed orbit map — intermediate representation
type OrbitChar = '-' | 'I' | 'O'
type OrbitMap = {
  EDGES:   OrbitChar[12],
  CORNERS: OrbitChar[8],
  CENTERS: OrbitChar[6],
}

// Output — same as current CubeRenderer3D.applyStickering() input
type VisibilityMap = Map<cubeletIndex: number, slotVisibility: boolean[6]>
```

### `CubeStickering` API (revised)

```js
// Orbit string constants — harness display convention (U-layer up)
CubeStickering.PRESETS  // { full, cross, f2l, oll, 'oll-2look', pll, 'pll-2look' }

// Parse orbit string → VisibilityMap
CubeStickering.fromOrbitString(str: string): Map<number, boolean[6]>

// Named preset shorthand (thin wrapper)
CubeStickering.forPreset(name: string): Map<number, boolean[6]>

// List preset names
CubeStickering.presetNames(): string[]
```

`fromOrbitString` algorithm:
1. Parse `ORBIT:chars` segments → `OrbitMap`
2. For each of the 3 lookup tables (CORNERS, EDGES, CENTERS):
   - For each slot index `i`, get char and cubelet index
   - Build `boolean[6]`: iterate slots 0–5, check `isOutward[slot]`, then apply char rule:
     - `-` → `isOutward[slot]`
     - `I` → `false`
     - `O` → `isOutward[slot] && (slot === 2 || slot === 3)` (U or D face only)
3. Return `Map<cubeletIndex, boolean[6]>`

### Harness Demo Controls

Add a **Stickering** control group to the controls column in `index.html`, above or below the Algorithm group:

```
[Full] [Cross] [F2L] [OLL 2L] [OLL] [PLL 2L] [PLL]
```

- Active preset button highlighted (`is-active`)  
- Stickering reapplied on preset change, on step-through, and on alg load  
- Default preset: `full`

---

## Implementation Notes

- Keep `CubeStickering.js` as an ES module in `cubify-harness/src/` — do not import from `cubify-scripts/` directly (different package, would create cross-package dependency)
- The lookup tables (CORNERS/EDGES/CENTERS slot → cubelet index) are constants derived from the position math above — embed directly in `CubeStickering.js`
- `applyStickering()` in CubeRenderer3D greys hidden stickers using `FACE_COLOURS_HEX.X` — no API changes needed
- Stickering needs to be re-applied after `setState()` (step-through, alg load) — the harness wires this up in `index.html`
