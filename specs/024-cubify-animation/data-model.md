# Data Model: 024 — CubePlayer Engine

## CubePlayer internal state

```js
class CubePlayer {
  // Owned renderer
  _renderer: CubeRenderer3D       // created from container at construction

  // Alg timeline
  _moves: string[]                // parsed move tokens e.g. ["R", "U", "R'"]
  _setupMoves: string[]           // parsed from setup string; [] if none
  _anchor: 'start' | 'end'       // default: 'start'

  // Cursor
  _stepIndex: number              // 0..moves.length; 0 = before any move

  // Playback
  _isPlaying: boolean

  // Speed
  _baseSpeedMs: number            // 300 — one quarter-turn at 1.0 scale
  _speedScale: number             // 1.0 default; effectiveMs = baseSpeedMs / scale

  // Inter-move gap
  _gapMs: number                  // 60 ms default

  // Stickering
  _stickering: string | null      // orbit string or named preset; null = full

  // Event emitter
  _listeners: Map<string, Set<Function>>
}
```

## State computation

State at step N (0 = initial):

```js
_stateAt(n) {
  return _baseState.applyAlg([..._setupMoves, ..._moves.slice(0, n)]);
}
```

`_baseState` is the solved `CubeState` (cached singleton from `CubeState.solved()`).

## Events

| Event | Payload | When |
|---|---|---|
| `move` | `{ index, move, state }` | after each animated move completes |
| `complete` | `{}` | after the last move of `play()` |
| `reset` | `{}` | on `loadAlg()` and `reset()` |

- `index`: 0-based, the step just completed (1 after first move)
- `move`: move notation string e.g. `"R'"`
- `state`: `CubeState` at `_stepIndex` — fully computed, ready for debug display

## Public method contracts

```js
// Async — safe to fire-and-forget after KPuzzle warmup
async loadAlg(notation: string, setup: string | null, { anchor?: 'start' | 'end' } = {})

// Sync
play()        // start/resume from _stepIndex; no-op if already playing or no moves
pause()       // stop after current move completes; sets _isPlaying = false
jumpTo(n)     // clamp to [0, moves.length]; resetToSolved + applyMovesInstant + reapplyStickering
reset()       // jumpTo(0) + emit reset
setSpeed(scale: number)               // clamps > 0; updates _speedScale
setStickering(str: string | null)    // null = clear; restoreColours + reapplyStickering

on(event, cb)
off(event, cb)

// Getters
get state(): CubeState      // CubeState at current _stepIndex
get renderer(): CubeRenderer3D  // direct access for Moves tab
get stepIndex(): number
get isPlaying(): boolean
get moveCount(): number
```

## Harness wiring: state flow

```
ALGS data
  └─► harness loadAlg() handler
        ├─ parses setup (z2 + invertAlg if caseAlg)
        ├─ await player.loadAlg(notation, setup, { anchor })
        └─ player emits 'reset'
              └─► harness: buildMoveTape, updateStepLabel, updateDebugState(player.state)

player.play()
  └─► animateMove loop (per move):
        ├─ renderer.animateMove(move, onDone)
        ├─ onDone: _stepIndex++, compute state
        ├─ emit 'move' { index, move, state }
        │     └─► harness: updateDebugState(state), update2D(state), updateStepLabel
        └─ if more moves and _isPlaying: setTimeout(next, _gapMs)

player.jumpTo(n)
  ├─ renderer.resetToSolved() + applyMovesInstant(setupMoves + moves[0..n])
  ├─ restoreColours + applyStickering
  └─ (no event — harness updates debug state directly from player.state)

player.pause()
  └─ _isPlaying = false  (current move completes, chain does not continue)
```

## Stickering reapply points

3D stickering is only reapplied on state-resetting operations (not during `play()`):

| Operation | 3D stickering reapplied? |
|---|---|
| `loadAlg()` | Yes |
| `reset()` → `jumpTo(0)` | Yes |
| `jumpTo(n)` | Yes |
| `play()` move step | No (textures travel with cubelets) |
| `setStickering(str)` | Yes (immediate) |
