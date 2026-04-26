# Feature 024 — cubify-animation (CubePlayer Engine)

## Summary

Implement the `CubePlayer` animation engine — the full move timeline, easing, speed control, and event API. Currently stubbed in Feature 020.

---

## Motivation

Feature 020 deferred the animation engine. `CubePlayer` is the primary integration point for:
- **cubify-harness** — trigger-button move replay, move-tape chip highlighting, debug state panel (this spec)
- **cfop-app VisualizerModal** — CFOP case alg step-through and scramble preview (spec 028)

Without it, consumers must wire up `animateAlg` and state tracking manually — exactly the pattern we want to replace.

---

## Scope

### CubePlayer internals

- Owns a `CubeRenderer3D` instance internally (container + options passed at construction)
- Move queue and timeline: `loadAlg(notation, setup, options)` parses and stores the move sequence
- State cursor: tracks current position (index into move sequence)
- `play()` — starts animating from current position; resumes after `pause()`
- `pause()` — stops animation mid-sequence, preserves cursor position
- `jumpTo(index)` — instant snap to move N (calls `setState`, no animation); validates bounds
- `setSpeed(scale)` — tempo multiplier (0.5 = half speed, 2.0 = double); takes effect on next move
- `reset()` — jumps cursor to 0 and restores initial state (see Anchor section)
- `setStickering(presetOrOrbitString)` — delegates to `CubeRenderer3D`

### Event emitter

- `on(event, cb)` / `off(event, cb)` / `emit(event, data)`
- Events:
  - `move` fires **after each move animation completes**: `{ index, move, state }`
    - `index`: 0-based position in move sequence
    - `move`: move notation string e.g. `"R"`
    - `state`: current `KPattern` — consumers use this for debug display and UI sync (move tape chip highlights, step counters)
  - `complete` fires when all moves finish: `{}`
  - `reset` fires on `reset()`: `{}`

### Gap between moves

- Configurable inter-move gap (default 60 ms) — prevents animation overlap
- Uses `animateMove` `onDone` callback chain (not `setTimeout`) — per lessons learned in Feature 020

---

## Anchor: start vs end

The anchor determines which end of the alg is the "reference point" for state and display.

### `anchor: 'start'` (default)

Used by the **harness trigger buttons**.

- Step 0 state = `setup` (if provided) or solved
- Moves play **forward**: step 0 → step N
- `reset()` restores to step 0 (setup/solved state)
- `jumpTo(0)` shows the initial/solved cube

Example: pressing "R U R'" on the harness replays those moves forward from the current solved or setup state.

### `anchor: 'end'`

Used by the **CFOP VisualizerModal** case alg replay.

- The `notation` is the **solve alg** — the sequence that takes the case state to solved
- Step 0 = the **case state** (scrambled/unsolved)
- Step N = solved
- `reset()` restores to step 0 (the case state)
- `jumpTo(0)` shows the unsolved case; `jumpTo(N)` shows solved

**Setup must be provided explicitly** — it cannot be derived algebraically via `inverse(alg)`. CFOP cases require explicit cube orientation conventions (e.g. z2 for yellow-on-top for OLL cases like Sune). The cfop-app JSON supplies `notation` and `setup` together.

---

## Public API

```js
// Harness — forward replay, anchor at start
const p = new CubePlayer(container, {
  theme: 'modern',
  stickering: 'full',
  speed: 1.0
});
p.loadAlg("R U R' U R U2 R'", null, { anchor: 'start' });
p.play();
p.pause();
p.jumpTo(3);
p.setSpeed(1.5);
p.reset();
p.setStickering('oll');

// CFOP VisualizerModal — case alg replay, anchor at end
const p = new CubePlayer(container, { theme: 'modern', stickering: 'oll', speed: 1.0 });
p.loadAlg(caseData.notation, caseData.setup, { anchor: 'end' });
p.play();

// Event API (same for both uses)
p.on('move', ({ index, move, state }) => {
  // update move tape chip highlights, step counter, debug panel
});
p.on('complete', () => { ... });
p.on('reset', () => { ... });
```

---

## Harness wiring (this spec)

This spec implements `CubePlayer` and wires it into the harness. The cfop-app VisualizerModal integration is deferred to spec 028.

Harness use:
- `anchor: 'start'` — trigger buttons replay moves forward from solved/setup state
- Stickering user-selectable via existing harness controls
- Speed control via harness UI
- `move` events drive chip highlights in the move tape and update the debug state panel
- Debug state panel is essential and must be preserved through the migration to `CubePlayer`

---

## Rendering

`CubePlayer` owns its `CubeRenderer3D` and calls it internally. Consumers do **not** call render methods directly — they respond to events. The `move` event payload includes `state` for consumers that need to read the cube state for their own UI (debug panel, chip highlights), but the 3D render is triggered by `CubePlayer` itself.

---

## Acceptance Criteria

- [ ] `play()` animates all moves and fires `complete` at end
- [ ] `pause()` stops mid-sequence; `play()` resumes from current position
- [ ] `jumpTo(n)` snaps instantly to correct state for any valid index
- [ ] `setSpeed(scale)` takes effect on next move (no mid-move speed change needed)
- [ ] `move` events fire with correct `{ index, move, state }` after each animation step
- [ ] `reset()` restores correct state per anchor (step 0 for both, but different start states)
- [ ] anchor `'start'`: step 0 = setup/solved, plays forward
- [ ] anchor `'end'`: step 0 = case state, step N = solved; setup is explicit not derived
- [ ] `setStickering()` works before and after `loadAlg()`
- [ ] Speed and stickering controls work via existing harness UI
- [ ] Harness wired to `CubePlayer` — existing controls (move tape, debug panel) unchanged for user
