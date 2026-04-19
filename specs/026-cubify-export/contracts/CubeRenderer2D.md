# Contract: CubeRenderer2D

**Module**: `cubify-harness/src/CubeRenderer2D.js`
**Type**: ES Module, browser + Node.js compatible (SVG path)

---

## Constructor

```js
new CubeRenderer2D(container, options?)
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| container | HTMLElement | yes | DOM node to append the canvas to |
| options.size | number | no | Canvas width/height in px (default: 400) |

Creates a `<canvas>` element sized at `size × size`, appends it to `container`. Throws if `container` is null/undefined.

---

## Method: update

```js
renderer.update(state, visMap)
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| state | CubeState | yes | Current cube state (from CubeState.js) |
| visMap | Map\<string, number[]\> | yes | homePos → vis-level array; use `new Map()` for full visibility |

Clears the canvas and re-renders the top-down view immediately (synchronous). Does not modify `state` or `visMap`.

**Behaviour with empty visMap**: If `visMap` is an empty Map, all stickers render at full colour (vis level 2).

---

## Method: toDataURL

```js
renderer.toDataURL(type?)  → string
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| type | string | `'image/png'` | MIME type for canvas export |

Returns the data URL of the current canvas contents. Must be called after `update()`. Returns an empty canvas data URL if `update()` has never been called.

---

## Method: toSVG (static)

```js
CubeRenderer2D.toSVG(state, visMap, options?)  → string
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| state | CubeState | yes | Cube state |
| visMap | Map | yes | Visibility map |
| options.size | number | no | SVG viewBox size (default: 400) |

Returns an SVG string with no DOM dependency. Suitable for Node.js export.

**Constraints**:
- Returns a complete `<svg>` element (not a fragment)
- All shapes use `<polygon>` (no `<path>` for trapezoids, polygon is simpler)
- No external CSS references; all styles are inline

---

## Method: destroy

```js
renderer.destroy()
```

Removes the canvas element from its parent DOM node. Safe to call multiple times. After `destroy()`, calling `update()` throws.

---

## Integration Contract (harness)

The harness calls `renderer2d.update(cubeState, visMap)` from two call sites:

1. `applyStateToRenderer(state, visMap)` — after any move or setState
2. `reapplyMask(visMap)` — after stickering change without state change

Both call sites already exist for CubeRenderer3D. CubeRenderer2D is wired in parallel.

**Null safety**: If the 2D tab is not active, `update()` is still called (renders off-screen). This is acceptable — the canvas is ready when the tab switches.

---

## Acceptance Criteria

- [ ] `renderer.update(solved, new Map())` draws 9 white U stickers + 12 coloured side stickers
- [ ] `renderer.update(state, ollVisMap)` hides all non-primary stickers correctly for OLL cases
- [ ] `renderer.toDataURL()` returns a non-empty `data:image/png;base64,...` string
- [ ] `CubeRenderer2D.toSVG(state, visMap)` returns valid SVG with exactly 21 `<polygon>` elements (9 U + 3×4 sides)
- [ ] No new npm runtime dependencies (sharp is dev-only for demo script)
