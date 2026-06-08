# Quickstart: CFOP Solver Method Flags

Verification scenarios for manual testing via the cubify-harness Solve (cfop) button, and as integration test baselines.

## Scenario 1 — Default Mode Unchanged

**Scramble**: R U R' U R U2 R' (Sune)  
**Options**: none (default)  
**Expected**: 7 stages — cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll, pll  
**Verify**: existing harness Solve (cfop) behaviour unchanged

## Scenario 2 — 2-Look OLL/PLL

**Scramble**: R U R' U R U2 R' (Sune)  
**Options**: `{ beginner: true }`  
**Expected stages**: cross, f2l-fr, f2l-fl, f2l-br, f2l-bl, oll-edges, oll-corners, pll-corners, pll-edges — exactly 9  
**Verify**:
- `oll-edges` alg orients all 4 U-layer edges (eo[0..3] all 0 after application)
- `oll-corners` alg orients all 4 U-layer corners (co[0..3] all 0 after application)
- `pll-corners` alg positions all 4 corners correctly
- `pll-edges` alg leaves U-layer fully solved
- Stage count = 9 regardless of whether any sub-step is a skip

## Scenario 3 — 2-Look Skip Cases

**Cross+F2L solved, OLL skip**:  
Apply `z2` then build a PLL state. Options: `{ beginner: true }`  
**Expected**: oll-edges alg = '', oll-corners alg = '', both stages still present  

**Cross+F2L+OLL solved, PLL skip**:  
Options: `{ beginner: true }`  
**Expected**: pll-corners alg = '', pll-edges alg = '', both stages still present  

## Scenario 4 — Intuitive F2L Stage Order

**Scramble**: choose a scramble where the FL pair happens to be directly insertable at F2L start (FR is not)  
**Options**: `{ beginner: true }`  
**Expected**: f2l-fl stage appears before f2l-fr in the solution stages array  
**Verify**: stage `label` values in array order reflect actual solve sequence

## Scenario 5 — Intuitive F2L Alg Structure

**Any scramble**  
**Options**: `{ beginner: true }`  
**Verify** for each F2L stage:
- If alg is non-empty: last sequence of moves is a recognisable trigger (R U R', R U' R', L' U' L, L' U L, U R U' R', U' L' U L)
- If alg is empty: slot was already solved (accepted)

## Scenario 6 — Beginner Mode Full Integration

**Any scramble**  
**Options**: `{ beginner: true }`  
**Expected**: exactly 9 stages — cross, ×4 f2l (in fluid priority order), oll-edges, oll-corners, pll-corners, pll-edges  
**Verify**: F2L stages use trigger-based algs, OLL and PLL are split, total stage count = 9

## Unit Test Baselines

### EOLL cases
For each of the 3 EOLL cases (+ skip), build a state with the target `eo[0..3]` pattern (corners in any orientation), apply `solveTwoLookOll()`, verify `eo[0..3]` all 0 after EOLL alg.

### OCLL cases  
After EOLL, apply all 7 OCLL cases, verify `co[0..3]` all 0 after OCLL alg. Test all 4 AUF rotations for at least Sune.

### CPLL cases
Build pre-PLL state (OLL solved) for Aa, Ab, E-perm. Apply `solveTwoLookPll()`, verify corners solved after CPLL alg. Test with all 4 AUF pre-rotations.

### EPLL cases
After CPLL, apply all 4 EPLL cases. Verify `isTopLayerAligned()` after EPLL alg.

### Combined 2-look OLL+PLL
For all 57 OLL states + all 21 PLL states: `solveTwoLookOll` → `solveTwoLookPll` chain must leave the cube fully solved.
