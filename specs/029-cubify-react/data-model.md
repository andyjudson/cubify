# Data Model — Feature 029: cubify-react

## Component Prop Interfaces

### CubePlayerProps

| Prop | Type | Default | Triggers |
|------|------|---------|----------|
| `alg` | `string` | `''` | `player.loadAlg(alg, setup, { anchor })` |
| `setup` | `string` | `''` | (combined with alg) |
| `anchor` | `'start' \| 'end'` | `'end'` | (combined with alg) |
| `stickering` | `string` | — | `player.setStickering(stickering)` |
| `theme` | `CubeTheme \| ThemePresetName` | — | `player.renderer.setTheme(theme)` |
| `playing` | `boolean` | `false` | `player.play()` / `player.pause()` |
| `speed` | `number` | `1.0` | `player.setSpeed(speed)` |
| `stepIndex` | `number` | — | `player.jumpTo(stepIndex)` |
| `onMove` | `(e: MoveEvent) => void` | — | subscribed via `player.on('move', ...)` |
| `onComplete` | `() => void` | — | subscribed via `player.on('complete', ...)` |
| `onReset` | `() => void` | — | subscribed via `player.on('reset', ...)` |
| `style` | `React.CSSProperties` | — | applied to container div |
| `className` | `string` | — | applied to container div |

```typescript
interface MoveEvent {
  index: number;
  move: string;
}
```

### CubeStateProps

| Prop | Type | Default | Triggers |
|------|------|---------|----------|
| `alg` | `string` | `''` | recompute state, `renderer.setState(state)` |
| `setup` | `string` | `''` | (combined with alg) |
| `stickering` | `string` | — | `renderer.applyStickering(visMap)` |
| `theme` | `CubeTheme \| ThemePresetName` | — | `renderer.setTheme(theme)` |
| `style` | `React.CSSProperties` | — | applied to container div |
| `className` | `string` | — | applied to container div |

---

## State Computation for CubeState

`CubeState` (display-only) applies the inverse of `alg` to a solved base to produce the display state. This matches the CFOP case display convention (show the pre-case state):

```
displayState = solvedBase.applyAlg(CubeState.invertAlg(parseAlg(alg)))
```

If a `setup` moves string is also provided, setup moves are applied first (same convention as `CubePlayer.loadAlg`).

---

## Internal Refs (not exposed via props)

### CubePlayerComponent

| Ref | Type | Purpose |
|-----|------|---------|
| `containerRef` | `RefObject<HTMLDivElement>` | DOM mount point |
| `playerRef` | `MutableRefObject<CubePlayerInstance \| null>` | Imperative player instance |

### CubeStateComponent

| Ref | Type | Purpose |
|-----|------|---------|
| `containerRef` | `RefObject<HTMLDivElement>` | DOM mount point |
| `rendererRef` | `MutableRefObject<CubeRenderer3DInstance \| null>` | Imperative renderer instance |
| `stateRef` | `MutableRefObject<CubeStateInstance \| null>` | Cached solved base for alg application |

---

## Effect Dependency Map

### CubePlayerComponent effects

| Effect | Dependencies | Action |
|--------|-------------|--------|
| Mount | `[]` | create player, mount, dispose on cleanup |
| Alg | `[alg, setup, anchor]` | `player.loadAlg(...)` |
| Stickering | `[stickering]` | `player.setStickering(stickering)` |
| Theme | `[theme]` | `player.renderer.setTheme(theme)` |
| Playing | `[playing]` | `player.play()` or `player.pause()` |
| Speed | `[speed]` | `player.setSpeed(speed)` |
| StepIndex | `[stepIndex]` | `player.jumpTo(stepIndex)` |
| Events | `[onMove, onComplete, onReset]` | register/deregister listeners |

### CubeStateComponent effects

| Effect | Dependencies | Action |
|--------|-------------|--------|
| Mount | `[]` | create renderer, mount, dispose on cleanup |
| State | `[alg, setup]` | recompute + `renderer.setState(state)` |
| Stickering | `[stickering]` | parse + `renderer.applyStickering(visMap)` |
| Theme | `[theme]` | `renderer.setTheme(theme)` |

---

## File Layout

```
cfop-app/src/lib/cubify/
├── CubePlayerComponent.tsx    — <CubePlayer> component
├── CubeStateComponent.tsx     — <CubeState> component
└── index.ts                   — re-exports both components

cfop-app/vite.config.ts        — add 'cubify' alias
cfop-app/tsconfig.json         — add paths entry
```
