# Feature 024 — cubify-animation (CubePlayer Engine)

## Summary

Implement the `CubePlayer` animation engine — the full move timeline, easing, speed control, and event API. Currently stubbed in Feature 020.

---

## Motivation

Feature 020 deferred the animation engine. `CubePlayer` is the primary integration point for cfop-app (VisualizerModal step-through, scramble preview). Without it, consumers must wire up `animateAlg` and state tracking manually — exactly the pattern we want to replace.

---

## Scope

### CubePlayer internals
- Move queue and timeline: `loadAlg(notation)` parses and stores the move sequence
- `play()` — starts animating from current position, fires `move` events each step
- `pause()` — stops animation, preserves position
- `jumpTo(index)` — instant snap to move N (calls `setState`, no animation); validates bounds
- `setSpeed(scale)` — tempo multiplier (0.5 = half speed, 2.0 = double)
- `reset()` — jump to step 0 (case state if caseAlg, solved otherwise)
- `setStickering(presetOrOrbitString)` — delegates to `CubeRenderer3D`

### Event emitter
- `on(event, cb)` / `off(event, cb)` / `emit(event, data)`
- Events: `move` `{ index, move, state }`, `complete` `{}`, `reset` `{}`

### Gap between moves
- Configurable inter-move gap (default 60ms) — prevents animation overlap
- Uses `animateMove` `onDone` callback chain (not `setTimeout`) per lessons learned

---

## Public API

```js
const p = new CubePlayer(container, { theme: 'modern', stickering: 'oll', speed: 1.0 });
p.loadAlg("R U R' U R U2 R'");
p.play();
p.pause();
p.jumpTo(3);
p.setSpeed(1.5);
p.reset();
p.on('move', ({ index, move, state }) => { ... });
p.on('complete', () => { ... });
```

---

## Acceptance Criteria

- [ ] `play()` animates all moves and fires `complete` at end
- [ ] `pause()` stops mid-sequence; `play()` resumes from current position
- [ ] `jumpTo(n)` snaps instantly to correct state for any valid index
- [ ] `setSpeed(scale)` takes effect on next move (no mid-move speed change needed)
- [ ] `move` events fire with correct index and move string
- [ ] Harness demo wired to `CubePlayer` — existing controls unchanged for user
