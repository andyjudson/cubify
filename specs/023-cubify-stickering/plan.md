# Implementation Plan: 023 — cubify-stickering

**Branch**: `023-cubify-stickering` | **Spec**: [spec.md](spec.md)

## Summary

Replace `CubeStickering.forPreset()`'s hand-written geometric logic with an orbit string parser (`fromOrbitString()`), using the same orbit string values as `cubify-scripts/lib/masks.mjs` — the single source of truth for all preset definitions. Add stickering preset controls to the harness demo.

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

### R2 — The z2 setup convention and masks.mjs alignment

**This is the fundamental design constraint for stickering.**

In the cfop-app, cube case images are generated using a `z2` setup move before the inverse case alg. `z2` swaps the U and D layers (U↔D, L↔R). This means:

- After `z2 + inverse(case_alg)`, the case is positioned on the **D layer** (y=-1 in 3D)
- The camera looks from above — the "interesting" case layer appears at the bottom of the cube
- `masks.mjs` orbit strings target **D-layer slots (4–7)** for OLL/PLL precisely because of this

This is intentional: the image shows the solved cross on top (white/U face visible at y=1) and the case pattern below — the viewer sees the cube as they would hold it, with the last layer facing them from below.

**Consequence for the harness**: the harness must use the same `z2` setup convention for OLL/PLL cases to match the cfop-app rendering. The case alg buttons should include `z2` in their setup, and `masks.mjs` strings should be used **directly** — not adapted for a different orientation.

**`O` token semantics** (oriented only): show only the D-face sticker (slot 3, -Y) on D-layer pieces. For `O` on D edges/corners after z2 setup, this shows the yellow U-face sticker as it would appear in the OLL case pattern. All side stickers hidden.

### R3 — No cross-package import

`CubeStickering.js` does not import `masks.mjs` directly (separate packages). Preset strings are embedded as constants in `CubeStickering.js` with values copied from `masks.mjs`. These must be kept in sync manually until spec 028 library extraction.

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
// Preset orbit strings — values match masks.mjs, z2-setup convention
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
     - `O` → `isOutward[slot] && slot === 3` (D face only — the "yellow up" sticker after z2)
3. Return `Map<cubeletIndex, boolean[6]>`

### Harness Demo Controls

Add a **Stickering** control group to the controls column in `index.html`:

```
[Full] [Cross] [F2L] [OLL 2L] [OLL] [PLL 2L] [PLL]
```

- Active preset button highlighted (`is-active`)
- Stickering reapplied on preset change, on step-through, and on alg load
- Default preset: `full`
- Case alg buttons for OLL/PLL should use `z2` in their setup (same as cfop-app) so stickering renders correctly

---

## Implementation Notes

- Keep `CubeStickering.js` as an ES module in `cubify-harness/src/` — do not import from `cubify-scripts/`
- The lookup tables are static constants derived from position math — embed directly
- `applyStickering()` in CubeRenderer3D greys hidden stickers — no API changes needed
- Stickering must be re-applied after every `setState()` call (step-through, alg load)
- The `z2` setup convention is the **standard across all cubify apps** — document in cube-mapping-lessons.md §11
