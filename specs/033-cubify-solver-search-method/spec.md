# Feature 033 — cubify-solver-search-method (scramble + solve)

## Summary

Add interactive scramble and solve to the CubifyPage harness. Scramble generation uses `CubeScramble.random()` initially (with twips as the intended upgrade path). The solver is a purpose-built IDA* implementation derived from reading the cubing.js source — not a call to `experimentalSolve3x3x3IgnoringCenters`. Research into both the solver algorithm and cubing.js/twips scramble generation (`specs/cubing-js-solver.md`) is a hard prerequisite before any implementation begins.

---

## Clarifications

### Session 2026-05-15

- Q: Should the solver run on the main thread or in a web worker? → A: Web worker only — no main-thread fallback; if worker fails, surface error and disable Solve button; own IDA* implementation avoids cubing.js worker complexity; progress bar wired to depth iterations
- Q: Does Phase 1 call experimentalSolve3x3x3IgnoringCenters directly or implement own IDA*? → A: Own IDA* from the start; cubing-js-solver.md research (covering solver algorithm + scramble generation/twips) is a hard gate before any implementation
- Q: How should the solver handle timeout or failure? → A: ~10s timeout default; depth hard-capped at 20 (God's number); timeout fires error message and re-enables Solve button
- Q: What happens to the case selector when Scramble is pressed? → A: Cleared to a "— scramble —" placeholder; selecting any named case restores normal mode

## Motivation

cubify already has all the pieces: live cube state via `player.state`, move-level events, and `CubeScramble.random()`. The cubing.js solver (`experimentalSolve3x3x3IgnoringCenters`) can take a KPattern and return the solution alg. Together these turn the CubifyPage harness from a visualisation tool into a training engine — not just "watch an alg play back" but "here's a scramble, now solve it."

---

## Goals

### Phase 1 — CubifyPage harness (first pass)

Two new buttons alongside the existing controls:

- **Scramble** — generates a scramble and loads it into `CubePlayer` as the setup, resets to scrambled state
- **Solve** — runs own IDA* search on the current `player.state` KPattern (in a web worker), loads the solution alg into `CubePlayer` and plays it back

A **scramble mode toggle** selects between two scramble sources:
- **Random** (default) — `CubeScramble.random()`: pure JS, instant, random-move sequence
- **WCA** — `CubeScramble.wca()`: cubing.js + twips WASM, async (~50 ms after first load), WCA-quality random-state scramble — the same engine that will power official WCA competitions

The WCA mode is non-default but first-class: it demonstrates the upgrade path and lets the quality difference be felt directly. The WCA label makes the distinction clear without requiring the user to understand tnoodle or twips.

The existing mask and theme controls remain unchanged. The case selector gains a "— scramble —" placeholder entry: pressing Scramble clears the selector to this placeholder so it is unambiguous that the cube is in free-play mode (not a named case). Selecting any named case from the dropdown restores normal case mode.

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
- `CubeScramble.wca()` — new static async method wrapping `randomScrambleForEvent('333')` from `cubing/scramble`; cubing.js handles the twips worker and WASM loading internally; returns `Promise<string>`. First call triggers lazy WASM load (~200–400 ms); subsequent calls ~50 ms.
- `player.state` exposes the live KPattern at any point — the solver reads this directly

### Solver execution model

- The IDA* search runs in a **web worker** to keep the UI responsive during computation
- The worker is created with `new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' })` — Vite handles ES module workers cleanly; no special bundler config needed
- Because the worker runs our own IDA* implementation (not cubing.js's solver internals), we avoid inheriting cubing.js's own worker setup complexity and potential WASM/SharedArrayBuffer requirements
- **No main-thread fallback**: if `Worker` construction fails, the Solve button shows an error ("Solver unavailable") and remains disabled. A frozen browser is worse than a clear failure — the fallback is not provided.
- **Progress reporting**: the worker posts `{ type: 'progress', depth: n }` at the start of each IDA* depth iteration; the UI renders this as a stepped progress bar (depth 1–20, early depths fast, later depths slow)
- **Depth cap**: IDA* search is hard-capped at depth 20 (God's number — every valid 3×3 state is solvable within 20 moves; exceeding this indicates an invalid state or implementation bug)
- **Timeout**: default ~10s; if the worker has not posted a solution within the timeout, it is terminated and the Solve button re-enables with an error message ("Could not solve — try again")

---

## Watch: twips (WCA scramble generator)

[`cubing/twips`](https://github.com/cubing/twips) is being developed as the official replacement for tnoodle (the current Java-based WCA scramble server). If it ships as WASM it would run directly in the browser — no backend, no worker roundtrip — and would produce proper WCA random-state scrambles (uniform distribution over cube states) rather than the random-move sequences `CubeScramble.random()` generates.

Relevance to this feature:
- Phase 1 uses `CubeScramble.random()` — good enough for harness use, not WCA quality
- If twips exposes a WASM/JS API (watch the cubing.js integration — Lucas is likely to wire it in), it becomes the natural upgrade for Phase 1 scramble generation
- The solver side is independent of twips; twips is scramble-only

**Action**: Before implementing Phase 1, check whether `twips` or a cubing.js wrapper around it is usable yet. If yes, use it instead of `CubeScramble.random()`. If not, proceed with `CubeScramble.random()` and leave a TODO.

---

## Prerequisites

- Feature 029 (React wrapper) ✅
- Feature 032 (cfop-migration) 📋 — cubing.js imports cleaned up; solver import strategy clearer after migration
- `specs/cubing-js-solver.md` — research document produced by reading the local cubing.js clone;
  covers **two areas**:
  1. **Solver**: pruning table structure, IDA* search depth/branching, node representation,
     distance-to-solved scoring — the basis for our own IDA* implementation
  2. **Scramble generation**: how cubing.js generates scrambles internally; current status of
     [`cubing/twips`](https://github.com/cubing/twips) as the WCA tnoodle replacement (WASM/JS
     API availability, cubing.js integration status) — the basis for choosing or upgrading the
     scramble source
  Same pattern as `cubing-js-architecture.md` and `cubing-js-stickering.md`.
  **Hard gate: must exist before implementation begins.**

---

## Acceptance Criteria

### Phase 1
- [ ] Scramble button generates a scramble and loads it into `CubePlayer`
- [ ] Cube renders in scrambled state immediately (no animation — instant setup)
- [ ] Scramble mode toggle switches between Random (`CubeScramble.random()`) and WCA (`CubeScramble.wca()`)
- [ ] WCA mode shows a brief loading indicator on first use (WASM lazy-load); subsequent scrambles are fast
- [ ] Solve button computes solution from current `player.state` and animates it
- [ ] Progress bar shown while solver runs, stepping through IDA* depth iterations (depth 1–20)
- [ ] Solver depth progress and errors logged to the harness event log (not displayed near controls)
- [ ] Solve button re-enables on timeout or error; the detail is in the event log
- [ ] Works with existing mask and theme controls unchanged
- [ ] Pressing Scramble sets the case selector to "— scramble —"; selecting a named case restores normal case mode
