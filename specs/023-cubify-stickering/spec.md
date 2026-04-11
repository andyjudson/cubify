# Feature 023 — cubify-stickering

## Summary

Implement a stickering/masking system for `cubify-harness` using the orbit string syntax from `cubify-scripts/lib/masks.mjs` as the source of truth. Add masking controls to the demo including CFOP presets and iamthecu.be-style interactive cubelet toggles.

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
- `O` = oriented only (U/D face sticker only — for edge cross detection)

---

## Presets

| Preset      | Orbit string | Description |
|-------------|-------------|-------------|
| full        | `EDGES:------------,CORNERS:--------,CENTERS:------` | All visible |
| cross       | `EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------` | Top edges + U centre |
| f2l         | `EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I` | Bottom two layers |
| oll         | `EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------` | 1-look OLL |
| oll-2look   | `EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------` | 2-look OLL: edges only |
| pll         | `EDGES:------------,CORNERS:--------,CENTERS:------` | 1-look PLL (full) |
| pll-2look   | `EDGES:----OOOO----,CORNERS:--------,CENTERS:------` | 2-look PLL: corners only |

---

## User Stories

**US-001 — Orbit string parser**
`CubeStickering.fromOrbitString(str)` parses a masks.mjs string and returns the visibility map. Passes all 7 preset strings without error.

**US-002 — Named presets**
`CubeStickering.forPreset(name)` is a thin wrapper over `fromOrbitString(PRESETS[name])`. Replaces current geometric logic entirely.

**US-003 — CFOP stickering controls in demo**
Preset buttons in the harness demo: Full / Cross / F2L / OLL 2-look / OLL / PLL 2-look / PLL. Active preset persists across alg changes and step-through.

**US-004 — iamthecu.be-style interactive controls**
Click/toggle individual cubelet groups in the demo:
- Centres on/off
- Edges on/off  
- Corners on/off
- By layer (U / mid / D)
- Sticker ID labels (show piece name on each sticker)
- Edge orientation demo (flip an edge, show `O` sticker behaviour)
- Corner twist demo

---

## Acceptance Criteria

- [ ] `fromOrbitString()` parses all masks.mjs strings correctly
- [ ] All 7 presets render correctly in demo
- [ ] Stickering persists correctly through step-through and play
- [ ] `masks.mjs` strings can be passed directly — no translation layer
