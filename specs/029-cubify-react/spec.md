# Feature 029 — cubify-react (React Wrapper)

## Summary

Thin React wrapper components over the `cubify.js` library for use in `cfop-app`. Manages lifecycle (mount/unmount), exposes props for common options, and avoids boilerplate `useRef`/`useEffect` in every consumer component.

---

## Motivation

cfop-app is React/TypeScript. Wiring `CubePlayer` or `CubeRenderer3D` imperatively requires:
- `useRef` for the container and player instance
- `useEffect` for mount/unmount lifecycle
- Event handler cleanup
- Prop-change diffing (stickering change → `setStickering()`, alg change → `loadAlg()`)

This is identical boilerplate in every component. A `<CubePlayer>` React component encapsulates it once.

---

## Components

### `<CubePlayer>`

```tsx
<CubePlayer
  alg="R U R' U R U2 R'"
  stickering="oll"
  theme="modern"
  playing={isPlaying}
  speed={1.0}
  stepIndex={currentStep}         // controlled step position
  onMove={({ index, move }) => {}}
  onComplete={() => {}}
  style={{ width: 320, height: 320 }}
/>
```

- Mounts `CubePlayer` on first render, unmounts on removal
- `playing` prop drives play/pause imperatively
- `stepIndex` prop drives `jumpTo()` when changed
- `alg` prop change triggers `loadAlg()` and resets position
- `stickering` prop change triggers `setStickering()`

### `<CubeState>` (display only, no animation)

```tsx
<CubeState
  alg="R U R' U'"
  stickering="full"
  theme="modern"
  style={{ width: 200, height: 200 }}
/>
```

Wraps `CubeRenderer3D` — mount + `setState`, no player needed.

---

## Package structure

Lives in `cfop-app/src/lib/cubify/` initially (not a separate npm package). Imports from `cubify-harness/src/` via relative path until library is extracted.

---

## Acceptance Criteria

- [ ] `<CubePlayer>` mounts without IntersectionObserver constraint
- [ ] `playing` prop toggles play/pause correctly
- [ ] `stepIndex` prop drives `jumpTo()` correctly
- [ ] Unmount disposes renderer (no memory leak)
- [ ] `<CubeState>` displays correct state for a given alg
- [ ] Both components TypeScript-typed with full prop interfaces
