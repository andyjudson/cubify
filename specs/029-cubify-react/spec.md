# Feature 029 — cubify-react (React Wrapper)

## Summary

Thin React wrapper components over the `cubify.js` library for use in `cfop-app`. Manages lifecycle (mount/unmount), exposes props for common options, and avoids boilerplate `useRef`/`useEffect` in every consumer component.

---

## Clarifications

### Session 2026-04-30

- Q: What should the component render while the async mount resolves (CubeState.solved() gap)? → A: Bulma skeleton block — pulsating square placeholder at full component size until the renderer is ready, then replaced by the canvas.
- Q: When `alg` contains invalid WCA notation, what should the components do? → A: Silently show a solved cube and emit a `console.warn` — no crash, no `onError` prop needed.

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
- While the renderer is initialising, renders a Bulma `skeleton-block` at the component's width/height — pulsating placeholder; replaced by the canvas on first frame
- Invalid `alg` or unrecognised `stickering` value: silently falls back to solved cube + `console.warn`; does not throw or crash the React tree

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

- Renders a Bulma `skeleton-block` at full size until `CubeState.solved()` resolves and the renderer is ready; skeleton replaced by canvas on first frame
- Invalid `alg`: `console.warn` + show solved cube

---

## Package structure

Lives in `cfop-app/src/lib/cubify/` — not a separate npm package. Imported via a Vite alias (`cubify` → `../../../cubify/src/index.ts`) defined in `cfop-app/vite.config.ts`, making the import surface identical to a future published package.

---

## Acceptance Criteria

- [X] `<CubePlayer>` mounts without IntersectionObserver constraint
- [X] `playing` prop toggles play/pause correctly
- [X] `stepIndex` prop drives `jumpTo()` correctly
- [X] Unmount disposes renderer (no memory leak)
- [X] `<CubeState>` displays correct state for a given alg
- [X] Both components TypeScript-typed with full prop interfaces
- [X] Invalid `alg` prop logs `console.warn` and shows solved cube — does not throw
- [X] Bulma skeleton block shown at correct size before cube is ready — no layout shift on mount
