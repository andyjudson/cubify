# Feature 027 — cubify-tests (Unit Test Suite)

## Summary

Add a unit test suite for `cubify-harness` covering the hard-won ground truth in `cube-mapping-lessons.md`. Priority targets: `CubeState` move application and `CubeStickering` orbit string parsing.

---

## Motivation

As the library becomes load-bearing for cfop-app, regressions in `toFaceArray()`, orientation formulas, or sticker slot mappings become user-visible bugs. The test suite encodes the verified facts from `cube-mapping-lessons.md` so they can't silently break.

---

## Test Targets

### CubeState (priority 1)
Based on §4 of cube-mapping-lessons.md:

| Test | Expected |
|------|----------|
| Solved state | All 6 faces single colour |
| After R: U[2,5,8] | F, F, F |
| T-perm × 2 | Solved |
| T-perm U face | UUUUUUUUU |
| Sexy move × 6 | Solved |
| Sune × 6 | Solved |
| Sledgehammer × 6 | Solved |
| `isSolved()` after each above | true |
| `invertAlg()` round-trip | applyAlg(inv(alg)).applyAlg(alg) = solved |

### CubeStickering (priority 2)
- `fromOrbitString()` parses all 7 preset strings without error
- `full` preset: all 26 cubelets have correct outward slots visible
- `oll` preset: exactly 9 top-layer cubelets visible, 0 bottom-layer
- `cross` preset: 5 cubelets visible (U centre + 4 top edges)

### CubeRenderer3D (lower priority — visual, harder to unit test)
- `stickerIndex()` formula: check all 8 corner positions against CORNER_POSITIONS
- `MOVE_AXIS` directions: U dir=-1, D dir=+1 (animation convention verified)

---

## Tooling

- Vitest (ESM-native, no bundler needed, works with `"type": "module"`)
- Tests in `cubify-harness/test/`
- No DOM dependency for `CubeState` tests — pure Node.js
- `CubeRenderer3D` geometry tests may need `jsdom` or skip entirely (visual validation sufficient)

---

## Acceptance Criteria

- [ ] `npm test` in `cubify-harness/` runs all tests
- [ ] All `CubeState` verification tests from cube-mapping-lessons.md pass
- [ ] All `CubeStickering` preset tests pass
- [ ] Tests run in CI (no headed browser required)
