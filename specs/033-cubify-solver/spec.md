# Feature 033 — cubify-solver (scramble + solve)

## Summary

Add interactive scramble and solve to the CubifyPage harness, using `CubeScramble.random()` for scramble generation and cubing.js's experimental solver to compute the solution from the scrambled KPattern state.

---

## Motivation

cubify already has all the pieces: live cube state via `player.state`, move-level events, and `CubeScramble.random()`. The cubing.js solver (`experimentalSolve3x3x3IgnoringCenters`) can take a KPattern and return the solution alg. Together these turn the CubifyPage harness from a visualisation tool into a training engine — not just "watch an alg play back" but "here's a scramble, now solve it."

---

## Goals

### Phase 1 — CubifyPage harness (first pass)

Two new buttons alongside the existing controls:

- **Scramble** — generates a random scramble via `CubeScramble.random()`, loads it into `CubePlayer` as the setup, resets to scrambled state
- **Solve** — calls cubing.js solver on the current `player.state` KPattern, loads the solution alg into `CubePlayer` and plays it back

The existing case selector, mask, and theme controls remain unchanged — scramble/solve operate as an independent mode.

### Phase 2 — Interactive solve tracking (future)

- User enters moves manually or via move tape; `onMove` events track progress against the solution
- Visual feedback: pieces highlight as they reach their solved position
- Hint system: next best move computed from remaining solution

---

## Technical Notes

- cubing.js solver: `experimentalSolve3x3x3IgnoringCenters` — marked experimental but stable enough for Lucas to use in TwistyPlayer's own scramble verification
- Solver takes a `KPattern`, returns a solution alg string; async (may take a few hundred ms)
- `CubeScramble.random()` is already in cubify — no cubing.js worker dependency for the scramble side
- Solver itself may require the cubing.js worker; needs testing in the Vite context
- `player.state` exposes the live KPattern at any point — the solve button reads this directly

---

## Prerequisites

- Feature 029 (React wrapper) ✅
- Feature 032 (cfop-migration) 📋 — cubing.js imports cleaned up; solver import strategy clearer after migration

---

## Acceptance Criteria

### Phase 1
- [ ] Scramble button generates a valid random scramble and loads it into `CubePlayer`
- [ ] Cube renders in scrambled state immediately (no animation — instant setup)
- [ ] Solve button computes solution from current `player.state` and animates it
- [ ] Loading/computing state shown while solver runs
- [ ] Works with existing mask and theme controls unchanged
