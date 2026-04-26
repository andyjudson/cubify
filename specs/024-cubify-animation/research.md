# Research: 024 — CubePlayer Engine

## animateMove constraints

**Decision**: Pause works at sequence level only — mid-move interruption is not possible.

**Rationale**: `CubeRenderer3D.animateMove` sets `_animating = true` for the duration and cannot be stopped once started. If called while animating, it calls `onDone` immediately (skips the animation). CubePlayer's `pause()` sets `_isPlaying = false`; the current move will complete naturally and the `playNext` callback chain will not continue.

**Alternatives considered**: Cancelling animation mid-frame — rejected as it would leave cubelets in a partially-rotated position requiring cleanup logic.

---

## Playback loop pattern

**Decision**: Chain `animateMove` calls via `onDone` callbacks with a `setTimeout` gap (60 ms default).

**Rationale**: This is the same pattern as `CubeRenderer3D.animateAlg`. The gap prevents the next move's quaternion filter from matching cubelets mid-snap (floating-point positions not yet rounded). The chain terminates cleanly on `pause()` — no timer to cancel.

**Alternatives considered**: `setInterval` — rejected: overlaps with ongoing animations if any step takes longer than the interval.

---

## CubeState API

**Decision**: `move` event emits a `CubeState` instance (not raw `KPattern`).

**Rationale**: `CubeState` has `toString()`, `toFaceArray()`, `toRawPattern()`, `isSolved()` — all methods the harness uses for the debug panel. Raw `KPattern` exposes cubing.js internals unnecessarily.

**State at step N** computed as: `baseState.applyAlg([...setupMoves, ...moves.slice(0, N)])`

**`CubeState.solved()` is async** but resolves immediately after first call (KPuzzle cached). `loadAlg` will be async; harness fire-and-forgets (safe since user interaction follows).

---

## 3D stickering during play

**Decision**: Do NOT reapply 3D stickering after each animated move in `play()`.

**Rationale**: `CubeRenderer3D.applyStickering` is homePos-based — textures are baked into cubelet meshes and travel with them during animation. Reapplying each step would create a visible pop as textures are re-greyed from the wrong world positions. Current harness does not reapply stickering during `play()` — only on `jumpTo`/`reset`/`loadAlg`. The 2D view is updated from the `move` event, which is state-based and always correct.

**Alternatives considered**: World-position stickering reapply — would require mapping world positions back to orbit slots. Complex and not needed for current harness use case.

---

## Speed interface

**Decision**: `setSpeed(scale)` where `effectiveMs = Math.round(300 / scale)`.

- `scale 1.0` → 300 ms (normal)
- `scale 0.5` → 600 ms (slow)
- `scale 2.0` → 150 ms (fast)

**Rationale**: Spec requires a scale multiplier. Harness speed buttons currently use `renderer.setSpeed(ms)` with values 500, 300, 120. Post-migration harness buttons will call `player.setSpeed(300 / speedMs)` i.e. 0.6, 1.0, 2.5. These map naturally to the existing button labels (Slow, Normal, Fast).

---

## Renderer ownership and Moves tab

**Decision**: `CubePlayer` owns `CubeRenderer3D` internally; exposes it via a `get renderer()` getter.

**Rationale**: The Moves tab (`applyLiveMove`, `btn-move-apply`, `btn-move-reset`) uses `renderer.animateMove`, `renderer.animateAlg`, `renderer.resetToSolved`, and `renderer.isAnimating` directly. Exposing the getter lets the Moves tab continue with minimal change: replace `renderer.` with `player.renderer.`.

**Alternatives considered**: Wrapping Moves tab calls into `player.applyMove(mv)` — more encapsulated but extra scope for this spec; deferred to spec 028 if needed.

---

## jumpTo state and event

**Decision**: `jumpTo(n)` does NOT emit a `move` event. CubePlayer exposes a `get state()` getter returning the current `CubeState`.

**Rationale**: `move` events are for the animation playback sequence. `jumpTo` is an imperative snap — the harness can call `updateDebugState(player.state)` directly after `player.jumpTo(n)`.

---

## loadAlg signature and ALGS migration

**Decision**: Harness computes setup in its own `loadAlg` handler; passes it as a string to `player.loadAlg(notation, setup, { anchor })`.

```js
// In harness:
const moves = AlgParser.parse(alg.notation);
const setup = alg.caseAlg
  ? ['z2', ...CubeState.invertAlg(moves)].join(' ')
  : null;
await player.loadAlg(alg.notation, setup, { anchor: alg.caseAlg ? 'end' : 'start' });
```

**Rationale**: The `caseAlg` flag and `z2` orientation are harness-domain knowledge. CubePlayer is agnostic — it receives an explicit setup string or null. The ALGS array and `caseAlg` flag remain unchanged in the harness.

---

## liveState and Moves tab independence

**Decision**: `liveState` (Moves tab state) remains a harness-level variable. It is reset to `player.state` when `loadAlg` is called (on receipt of the `reset` event or directly in the loadAlg click handler).

**Rationale**: The Moves tab is a debug/exploration tool independent of the simulation timeline. CubePlayer owns the simulation state; the Moves tab manages its own state using `player.renderer` directly.
