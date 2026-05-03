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

- The goal is **not** to wrap `experimentalSolve3x3x3IgnoringCenters` as a black box — it is to
  understand and reuse the underlying search algorithm from the cubing.js source directly
- The local cubing.js clone at `../github.clone/cubing.js` is the starting point for this research
- cubing.js almost certainly uses IDA* (iterative deepening A*) over a move graph with precomputed
  pruning tables — understanding that structure is what enables granular queries:
  - Full solve from current state
  - Solve from here (mid-solve, partial state)
  - Best N next moves (branching factor at current node, ranked by distance-to-solved)
- This lower-level reuse is what makes the hint system meaningful — not "here is move 7 of the
  precomputed solution" but "from this state, these are the 3 moves that reduce the search depth
  the most"
- `CubeScramble.random()` is already in cubify — no cubing.js worker dependency for the scramble side
- `player.state` exposes the live KPattern at any point — the solver reads this directly

---

## Prerequisites

- Feature 029 (React wrapper) ✅
- Feature 032 (cfop-migration) 📋 — cubing.js imports cleaned up; solver import strategy clearer after migration
- `specs/cubing-js-solver.md` — research document produced by reading the local cubing.js clone;
  covers pruning table structure, IDA* search depth/branching, node representation, and
  distance-to-solved scoring. Same pattern as `cubing-js-architecture.md` and
  `cubing-js-stickering.md`. Must exist before implementation begins.

---

## Acceptance Criteria

### Phase 1
- [ ] Scramble button generates a valid random scramble and loads it into `CubePlayer`
- [ ] Cube renders in scrambled state immediately (no animation — instant setup)
- [ ] Solve button computes solution from current `player.state` and animates it
- [ ] Loading/computing state shown while solver runs
- [ ] Works with existing mask and theme controls unchanged
