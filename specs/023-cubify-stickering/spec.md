# Feature 023 — cubify-stickering

## Summary

Implement a stickering/masking system for `cubify-harness` using the orbit string syntax from `cubify-scripts/lib/masks.mjs` as the source of truth. Add masking controls to the demo including CFOP presets. Interactive cubelet toggle controls (iamcube-style) are noted below but out of scope for this iteration.

---

## Motivation

Feature 020 stubbed `CubeStickering.forPreset()` with hand-written geometric logic. The real design is:

- Orbit strings (`EDGES:----IIIIIIII,...`) are the source of truth — already defined in `masks.mjs`
- `CubeStickering.fromOrbitString()` parses them into `Map<cubeletIndex, boolean[6]>` for `CubeRenderer3D.applyStickering()`
- No duplication between `cubify-scripts` and `cubify-harness`

---

## Orbit String Syntax (masks.mjs)

```
EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------
```

- `EDGES`: 12 slots — UF=0, UR=1, UB=2, UL=3, DF=4, DR=5, DB=6, DL=7, FR=8, FL=9, BR=10, BL=11
- `CORNERS`: 8 slots — URF=0, URB=1, ULB=2, ULF=3, DRF=4, DLF=5, DLB=6, DRB=7
- `CENTERS`: 6 slots — U=0, R=1, F=2, D=3, L=4, B=5
- `-` = show all stickers on this piece
- `I` = ignore (hide all stickers — grey plastic)
- `O` = orient: primary sticker (U face slot 2, or D face slot 3) grey; side stickers visible — twisty player convention

---

## Presets

| Preset         | Orbit string | Description |
|----------------|-------------|-------------|
| full           | `EDGES:------------,CORNERS:--------,CENTERS:------` | All pieces visible — no masking |
| cross-white    | `EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------` | U-layer edges shown (placement); corners hidden |
| cross-yellow   | `EDGES:IIIIOOOOIIII,CORNERS:IIIIIIII,CENTERS:------` | D-layer edge orientation stickers only; corners hidden |
| f2l            | `EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I` | U+middle edges + U corners; D edges+corners hidden |
| oll-1look      | `EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------` | D-layer edge+corner orientation (O); U+middle fully shown |
| oll-2look      | `EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------` | EOLL: D-layer edge orientation only; D corners hidden |
| pll-1look      | `EDGES:------------,CORNERS:--------,CENTERS:------` | All pieces — full colour for permutation recognition |
| pll-2look      | `EDGES:----OOOO----,CORNERS:--------,CENTERS:------` | CPLL: D-layer edge orientation only; all corners fully shown |

---

## User Stories

**US-001 — Orbit string parser**
`CubeStickering.fromOrbitString(str)` parses a masks.mjs string and returns the visibility map. Passes all 8 preset strings without error.

**US-002 — Named presets**
`CubeStickering.forPreset(name)` is a thin wrapper over `fromOrbitString(PRESETS[name])`. Replaces current geometric logic entirely.

**US-003 — CFOP stickering controls in demo**
Preset buttons in the harness demo: Full / Cross W / Cross Y / F2L / OLL 2LK / OLL 1LK / PLL 2LK / PLL 1LK. Active preset persists across alg changes and step-through.

**US-004 — iamcube-style interactive controls** *(out of scope for this iteration — deferred)*
Click/toggle individual cubelet groups in the demo:
- Centres on/off
- Edges on/off
- Corners on/off
- By layer (U / mid / D)
- Sticker ID labels (show piece name on each sticker)
- Edge orientation demo (flip an edge, show `O` sticker behaviour)
- Corner twist demo

---

## Out of Scope (023)

- US-004 interactive cubelet toggles — an "iamcube"-style feature worth its own spec when the harness matures

---

## Acceptance Criteria

- [ ] `fromOrbitString()` parses all masks.mjs strings correctly
- [ ] All 8 presets render correctly in demo
- [ ] Stickering persists correctly through step-through and play
- [ ] `masks.mjs` strings can be passed directly — no translation layer

---

## Clarifications

### Session 2026-04-12

- Q: Is US-004 iamthecu.be interactive toggle system in scope for 023 or deferred? → A: Keep in spec but mark explicitly out of scope for this iteration — it's more of an iamcube concept to revisit later
