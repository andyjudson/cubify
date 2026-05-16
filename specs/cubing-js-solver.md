# cubing.js Solver Architecture

Reference document for cubify feature 033 (cubify-solver-search-method). Same pattern as
`cubing-js-architecture.md` and `cubing-js-stickering.md`.

Produced by reading the local cubing.js clone at
`../github.clone/cubing.js` (v0.63.3, May 2026).

---

## Key finding: the 3×3 solver is a compiled blob

The cubing.js 3×3 solver is **not** a readable TypeScript IDA* implementation.
It is Herbert Kociemba's **min2phase** 2-phase algorithm (by cs0x7f), originally
written in Java and compiled to JavaScript via GWT:

```
src/cubing/vendor/mit/cs0x7f/min2phase/3x3x3-min2phase.js
```

This file is ~700 KB of minified/compiled output. It exposes two functions:
- `initialize()` — builds pruning tables (call once; ~200 ms in browser)
- `solvePattern(patternString)` — takes a 54-character facelet string, returns a
  solution move sequence

The cubing.js API wraps this in a web worker and exposes it as
`experimentalSolve3x3x3IgnoringCenters(kPattern)`. There is no readable
TypeScript IDA* source to study for the 3×3 case.

**Implication for cubify-032**: our own IDA* implementation is derived from the
2-phase algorithm specification (well-documented, see below), not from cubing.js
source. The cubing.js codebase confirms the algorithm choice and provides
KPattern-level move application we can reuse.

---

## Algorithm: Kociemba 2-phase (min2phase)

The 2-phase algorithm finds near-optimal solutions in two stages:

### Phase 1 — Reduce to the H subgroup

Goal: orient all edges and corners, and position the UD-slice edges.

Coordinates tracked (3 independent values → compact state):
- **CO** (corner orientation): 7 free corners × 3 orientations = 3^7 = 2187 states
- **EO** (edge orientation): 11 free edges × 2 orientations = 2^11 = 2048 states
- **UD slice** (UD-slice edge positions): C(12,4) = 495 states

Phase 1 pruning table: CO × EO × UD-slice combinations → depth-to-H-subgroup.
Size: ~4.4 million entries.

Phase 1 terminates when all three coordinates reach 0 (the H subgroup state).

### Phase 2 — Solve within the H subgroup

Goal: permute corners and edges to solved, using only H-subgroup moves
(U, D, R2, L2, F2, B2 — no quarter-turns of R, L, F, B).

Coordinates tracked:
- **CP** (corner permutation): 8! / 8 = 40320 states
- **EP** (UD-slice edge permutation): 4! = 24 states
- **UP edge permutation**: 8! = 40320 states (U and D layer edges)

Phase 2 pruning table: CP × EP × UP-EP → depth-to-solved.
Size: ~40 million entries.

### Search structure

IDA* with iterative depth from 1 up to a depth cap (we use 20 = God's number).
At each node:
1. Look up current coordinates in pruning tables → get lower bound on remaining depth
2. If lower bound + depth used > depth limit → prune
3. Otherwise: apply each of 18 moves and recurse

**Branching factor**: 18 moves minus same-face (6) and opposite-face-same-direction
(≈3) reductions → effective branching factor ~13.

**Memory**: pruning tables are built once at worker startup.
Phase 1 table: ~2 MB. Phase 2 table: ~16 MB. Total: ~18 MB — fits comfortably in
a browser tab. Tables can be precomputed offline and shipped as JSON/binary blobs
to avoid startup time, but for a dev harness, on-demand generation (~500 ms) is
acceptable.

---

## Coordinate encoding

### Permutation → index (Lehmer code)

For a permutation P of N elements:
```
index = 0
for i in 0..N:
  count = number of j > i where P[j] < P[i]
  index += count * (N-1-i)!
```
This maps any permutation to a unique integer in [0, N!).

### Orientation → index

For orientations O[0..N-1] with each in [0, M):
```
index = 0
for i in 0..N-1:
  index = index * M + O[i]
```
(Last orientation derived from parity constraint — not stored.)

### KPattern extraction

cubing.js `KPattern.patternData` gives orbit data as:
```typescript
patternData['CORNERS'].pieces    // [0..7] permutation
patternData['CORNERS'].orientation  // [0..2] each
patternData['EDGES'].pieces      // [0..11] permutation
patternData['EDGES'].orientation // [0..1] each
```
The UD-slice edges are indices 8, 9, 10, 11 in the EDGES orbit (FR, FL, BL, BR
in cubing.js slot ordering — verify against `cubing-js-architecture.md`).

---

## Move table structure

For each of 18 moves × each coordinate, precompute new coordinate value:
```
cornerOriMove[move][CO_index] → new CO_index
edgeOriMove[move][EO_index]   → new EO_index
udSliceMove[move][slice_index] → new slice_index
cornerPermMove[move][CP_index] → new CP_index
```

18 moves: U, U2, U', D, D2, D', R, R2, R', L, L2, L', F, F2, F', B, B2, B'

Move tables are built by:
1. Start from solved state for each coordinate
2. Apply each KTransformation (from cubing.js `cube3x3x3` puzzle definition)
3. Re-encode the resulting coordinate

This uses cubing.js KTransformation objects for correctness — we don't reimplement
the permutation composition.

---

## Scramble generation in cubing.js

### Approach

cubing.js uses **random-state scrambles** for 3×3:
```
src/cubing/search/inside/solve/puzzles/3x3x3/index.ts
```

1. `random333Pattern()` — generates a random legal KPattern using Schreier-Sims
   group generators (`sgs3x3x3`). This efficiently samples from the full
   ≈4.3×10^19 state space uniformly.
2. `solve333(randomPattern)` — inverts to get the scramble alg.

### Worker requirement

cubing.js scramble generation uses `mustBeInsideWorker()` guard — it cannot run
synchronously on the main thread. The API is worker-only.

### cubify position

`CubeScramble.random()` generates **random-move scrambles** (not random-state).
Not WCA-quality but instant, synchronous, no dependencies.

`CubeScramble.wca()` — **implemented in feature 033** — wraps
`wasmRandomScrambleForEvent('333')` via a dedicated Scramble Worker. First call
lazy-loads the WASM bundle (~200–400 ms); subsequent calls ~50 ms. This is the
WCA random-state path: uniform distribution over all ~4.3×10¹⁹ cube states.

---

## twips (WCA scramble generator)

### What it is

`cubing/twips` is a WCA-quality scramble generator written in Rust, compiled to
WASM. It is intended to replace tnoodle (Java-based WCA scramble server) as a
browser-native solution.

### Status in this clone

Fully integrated and vendored at:
```
src/cubing/vendor/mpl/twips/   (v0.11.3, released ~2026)
```

Exports:
- `wasmRandomScrambleForEvent(eventID)` — generate random WCA scramble for a
  given event ("333", "222", etc.)
- `wasmDeriveScrambleForEvent(hexSeed, saltHierarchy, eventID)` — deterministic
  scramble from seed (for competition use)
- `wasmTwips(kpuzzleDefinition, searchPattern, options)` — generic IDA* solver

Currently used as the **primary solver for 2×2×2** in cubing.js.

### What works for 3×3

**`wasmRandomScrambleForEvent('333')`** — fast and correct. Routes through the
same two-phase Kociemba machinery used for competition scrambles (pre-built tables
baked into the WASM binary). ~200–400 ms first call, ~50 ms after. **Implemented
in cubify as `CubeScramble.wca()`.**

### What does not work for 3×3 (confirmed 2026-05-16)

**`wasmTwips` / `experimentalSolveTwips`** — generic IDA* that searches from
depth 0 upward. Works for states a few moves from solved (the prune table at
shallow depth is fast). Hangs for WCA scrambles (~20 HTM from solved) because the
prune table at depth 10 needs to enumerate ~11 billion 3×3 states — not feasible
in browser time.

**`twips serve` `/v0/solve/pattern`** — uses the same generic `ImmutableSearchData`
+ `HashPruneTable` path. The `startPruneDepth` option is parsed from the request
but never wired into `serve.rs` — the server always builds from depth 0 and hangs.

**`twips solve-known-puzzle 3x3x3 "..."`** (CLI) — fast (~27 ms, ~25 HTM
solution). Routes through `experimental_scramble_finder_filter_and_or_search` with
the same two-phase path as `wasmRandomScrambleForEvent`. Not yet exposed as an
HTTP endpoint in `twips serve`.

### Future path

Once `twips serve` gains a `/v0/solve/known-puzzle` endpoint (or equivalent),
both scramble and solve could run through the same twips path with no cubing.js
search Worker needed. See `specs/033-cubify-solver-search-method/research.md` for
the full decision record.

---

## Readable IDA* reference in the repo

The kilominx/FTO JavaScript solvers are the most readable IDA* implementations:
```
src/cubing/vendor/mpl/xyzzy/
```

These follow the standard pattern:
- Move tables: `move_CO[move_idx][state_idx]`
- Pruning tables: populated by BFS from solved state
- IDA* function: iterative deepening with heuristic = max(pruning table lookups)

This is the pattern to study for implementing the cubify 3×3 IDA* worker.

---

## Solver worker implementation (cubify-033)

The custom Kociemba IDA* was not completed. The solve path uses
`experimentalSolve3x3x3IgnoringCenters` (min2phase) in a dedicated Solve Worker,
separate from the Scramble Worker so a slow solve never blocks a scramble request.

Actual worker protocol (`packages/cubify/src/solver/twips.worker.ts`):

```typescript
// Main → Worker
{ id: number, action: 'scramble' }
{ id: number, action: 'solve333', patternStr: string }  // JSON-serialised KPatternData

// Worker → Main
{ id: number, result: string }   // alg string on success
{ id: number, error: string }    // on failure
```

The call chain for solves:
```
CubeScramble.solve(kPattern)
  → Solve Worker → experimentalSolve3x3x3IgnoringCenters({ patternData })
  → cubing.js search Worker → search-dynamic-solve-3x3x3-*.js → cs0x7f/min2phase
```
