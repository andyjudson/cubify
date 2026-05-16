# Research: cubify-solver (032)

Produced during `/speckit-plan 032`. See also `specs/cubing-js-solver.md` for
the full cubing.js source deep-dive.

---

## Decision: Solver algorithm

**Decision**: Implement our own 2-phase (Kociemba) IDA* solver in TypeScript.
Do not call `experimentalSolve3x3x3IgnoringCenters` from cubing.js.

**Rationale**: The cubing.js 3×3 solver (`cs0x7f/min2phase`) is a compiled
Java-via-GWT blob — there is no readable TypeScript source to study or reuse.
The algorithm it implements (Kociemba 2-phase) is well-documented and produces
near-optimal solutions. Implementing it ourselves gives us full visibility into
the search, enables the Phase 2 hint system (best-N-next-moves), and avoids
inheriting cubing.js's worker setup complexity.

**Alternatives considered**:
- Call `experimentalSolve3x3x3IgnoringCenters` directly (rejected — spec
  explicitly requires not treating this as a black box; also inherits cubing.js
  worker ceremony)
- Call twips WASM directly (rejected — also a black box and requires WASM bundle
  support; upgrade path for scrambles only, not relevant to solver ownership)

**⚠️ Post-implementation note (2026-05-16)**: The custom Kociemba IDA* solver
(`CubeSolver.ts`) was never brought to completion. As a working interim,
`CubeScramble.solve()` delegates to `experimentalSolve3x3x3IgnoringCenters`
via a dedicated solve Worker (`twips.worker.ts`).

The original rejection was based on the solver being `cs0x7f/min2phase` (a compiled
Java/GWT blob with no readable source). That remains true — but the decision has been
reversed pragmatically, since completing the custom Kociemba was deferred.

The full chain is:

  `CubeScramble.solve()` → solve Worker → `experimentalSolve3x3x3IgnoringCenters`
  → cubing.js search Worker → `search-dynamic-solve-3x3x3-B2L4IN34.js` → min2phase

Scrambles go via a separate path: `wasmRandomScrambleForEvent('333')` → twips WASM.

**Note on `experimentalSolveTwips`**: The twips README points to this
(https://js.cubing.net/cubing/api/functions/search.experimentalSolveTwips.html) as
the documented solve API. It is a thin wrapper over the generic `wasmTwips` IDA* that
searches from depth 0 upward and returns the optimal solution.

It DOES work for 3×3×3 states that are close to solved — e.g. a 23-move alg with lots
of internal cancellation that leaves the cube only 9 HTM from solved returns almost
instantly. The IDA* at depth 9 is trivially fast.

It DOES NOT work for WCA-quality scrambles, which are specifically ~20 HTM from solved
(God's number = 20). At depth 20 the 3×3×3 search tree is ~10²² nodes; even with the
hash prune table it is not feasible in browser time.

As twips matures this may change — if the generic solver gains puzzle-aware pruning or
a known-puzzle fast path, `experimentalSolveTwips` could become the right call for all
depths. Worth re-evaluating on cubing.js version bumps.

**TODO ��� revisit when twips matures**: The ideal end-state is a unified scramble +
solve API backed entirely by twips, with no cubing.js search Worker in the middle.

As of 2026-05-16:

- `twips serve` cannot solve 3×3 in useful time via its `/v0/solve/pattern` endpoint.
  Root cause: uses generic `ImmutableSearchData` + `HashPruneTable` (18-move IDA*).
  At depth 20, the prune table tries to enumerate ~11B HTM states. Hangs every time.
  `startPruneDepth` from `ServeClientArgs` is parsed but never wired up in `serve.rs`.

- `twips solve-known-puzzle 3x3x3 "..."` IS fast (solves in ~27ms at search depth 10,
  returning a 25-HTM-move solution). It routes through `experimental_scramble_finder_
  filter_and_or_search` with `Event::Cube3x3x3Blindfolded` — the same two-phase
  Kociemba machinery used for scramble generation. Search depth 10 ≠ HTM 10; it's a
  phase-coordinate depth where depth 10 corresponds to ~25 HTM moves.

The fix for `twips serve` is straightforward in principle: add a
`/v0/solve/known-puzzle` endpoint (or a `puzzle` field on the existing endpoint)
that delegates to `solve_known_puzzle(Puzzle::Cube3x3x3, alg)` from
`scramble/random_scramble_for_event.rs`. The function already exists in the lib —
it just isn't wired into the HTTP server.

Once that endpoint exists, `CubeScramble.solveServer()` can route to it for 3×3,
and both scramble and solve would run through the same twips path with no cubing.js
wrapper needed. Consider opening an issue or PR against cubing/twips.

---

## Decision: Scramble generation (Phase 1)

**Decision**: Both scramble sources ship in Phase 1 — `CubeScramble.random()` as
the default and `CubeScramble.wca()` as an optional toggle.

**Rationale**: twips is already vendored in the cubing.js dependency cubify has.
Wrapping `randomScrambleForEvent('333')` is ~20 lines in `CubeScramble.ts` —
the integration cost is negligible. Shipping both in Phase 1 lets the quality
difference be experienced directly, demonstrates the upgrade path, and positions
cubify alongside the future official WCA scramble engine at near-zero extra cost.

`CubeScramble.random()` remains the default — instant, no async, no WASM.
`CubeScramble.wca()` is non-default but first-class: async, WCA random-state
quality, first-call WASM lazy-load cost (~200–400 ms), subsequent calls ~50 ms.

**Alternatives considered**:
- `CubeScramble.random()` only — rejected; twips integration is cheap enough
  that deferring it adds no value
- Calling cubing.js `random333Pattern()` directly — requires reimplementing the
  scramble worker ourselves. Rejected; `randomScrambleForEvent('333')` from
  `cubing/scramble` handles this via the existing cubing.js worker infrastructure

---

## Decision: Worker execution model

**Decision**: Own IDA* runs in a `{ type: 'module' }` web worker using Vite's
`new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })`
pattern. If worker construction fails, the Solve button shows "Solver unavailable"
and remains disabled — no main-thread fallback.

**Rationale**: IDA* at depth 15–20 can run for several seconds. Running on the
main thread would freeze the Three.js render loop and all UI interaction. A frozen
browser is worse than a clear error message. Modern browsers (Chrome, Safari,
Firefox) all support ES module workers; worker construction failure is not a
realistic runtime scenario for the target environment. Removing the fallback path
eliminates a code branch that could mask bugs and would never be exercised in
practice.

**Alternatives considered**:
- Main-thread only — rejected because of UI freeze risk at depth 15+
- Main-thread fallback — rejected; frozen browser is worse than clear failure;
  adds dead code path that is never exercised in the target browser set
- Chunked/async main thread (`setTimeout` yielding) — rejected as fragile and
  complex without meaningful benefit over a proper worker

---

## Decision: Pruning table construction

**Decision**: Build pruning tables on worker startup (one-time cost, ~500 ms
acceptable for a dev harness). Tables stay in the worker's memory for the session.

Phase 1 tables:
- Corner orientation × edge orientation × UD-slice position → lower bound depth
- ~4.4 M entries × ~1 byte each ≈ 4 MB

Phase 2 tables:
- Corner permutation × UD-slice edge permutation × UE permutation → lower bound
- ~40 M entries × ~1 byte each ≈ 40 MB (compact with 2-bit packing: 10 MB)

Move tables:
- 18 moves × each coordinate index → next coordinate index
- Built using cubing.js KTransformation objects (avoids reimplementing permutation
  composition)

**Alternatives considered**:
- Precompute and ship as binary blobs — correct long-term approach for a
  production deployment; deferred for Phase 1 harness
- Use only Phase 1 pruning table (shallower solutions) — rejected, Phase 2 is
  what produces near-optimal solutions

---

## Decision: State encoding bridge

**Decision**: Extract KPattern data from `player.state.patternData` at solve
time; convert to 2-phase coordinate representation inside the worker.

`patternData['CORNERS'].pieces` / `.orientation` and
`patternData['EDGES'].pieces` / `.orientation` are transferred to the worker
via `postMessage` (structured clone — KPatternData is a plain object).

**No KPattern objects are transferred** — only the raw `PatternOrbitData` maps,
which are POJOs and clone without issue.

---

## Decision: Progress reporting

**Decision**: Worker posts `{ type: 'progress', depth: n }` at the start of
each IDA* depth iteration (depth 1–20). UI renders a stepped progress indicator.

Early depths (1–12) complete in milliseconds; depth 13–17 may take 100 ms–2 s
each; depth 18–20 are rare (most scrambles solve in ≤17 moves in practice).
The progress bar gives visual feedback without needing to know total work.

---

## Decision: Solver module location

**Decision**: Solver lives in `packages/cubify/src/` as a new module
(`CubeSolver.ts` + `solver/` directory) exported from `index.ts`. The worker
script lives at `packages/cubify/src/solver/solver.worker.ts`.

**Rationale**: Consistent with library architecture — solver is a library
capability, not a harness-only script. The React wrapper can later expose
`setInternals`-style passthrough if cfop-app needs it.

**Source structure**:
```
packages/cubify/src/
├── CubeSolver.ts           # Public API: SolverOptions, SolverResult, CubeSolver class
└── solver/
    ├── solver.worker.ts    # Worker entry point: postMessage protocol, timeout guard
    ├── TwoPhase.ts         # IDA* search (Phase 1 + Phase 2)
    ├── Coordinates.ts      # State encoding: permIdx, orIdx, UDSliceIdx
    └── MoveTables.ts       # Move table generation using cubing.js KTransformations
```

---

## Cubing.js solver architecture — key facts

From `specs/cubing-js-solver.md`:

- `experimentalSolve3x3x3IgnoringCenters` → delegates to min2phase compiled blob
- Scramble: random-state via `random333Pattern()` (SGS group generators) + solve;
  requires web worker, ~200 ms init, ~50 ms per scramble
- twips: vendored WASM at v0.11.3; exports `wasmRandomScrambleForEvent('333')`
  for WCA-quality scrambles; lazy-loaded; runs in web worker
- Readable IDA* patterns: kilominx/FTO JS solver in `src/cubing/vendor/mpl/xyzzy/`
  (study for branching, pruning table population, coordinate encoding patterns)
