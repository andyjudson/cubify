# Research — Feature 025: cubify-theming

Resolved decisions for all technical unknowns identified during planning.

---

## Decision 1: Texture cache invalidation strategy

**Decision**: Move from a module-level singleton cache to a composite cache key that encodes all texture parameters.

Current cache: `Map<colourHex, CanvasTexture>` — module-level singleton.

Problem: if plastic colour, pad, or radius change, cached textures for the same colour hex are stale.

**Resolution**: key the cache by `"${colourHex}|${plasticHex}|${pad}|${radius}|${shape}"`. On `setTheme()`, do not clear the entire cache — only textures for the old theme params become orphaned. Three.js `dispose()` is called for orphaned textures to prevent GPU memory leaks.

**Alternatives considered**:
- Per-instance cache: cleaner isolation but prevents sharing across multiple renderer instances (e.g. CubeExporter spawns temporary renderers). Rejected — the composite key gives sharing where possible.
- Clearing entire cache on every theme change: simpler but causes unnecessary re-uploads for colours that haven't changed. Rejected.

---

## Decision 2: Gap / bevel change — in-place geometry rebuild

**Decision**: on gap or bevel change, dispose the shared `RoundedBoxGeometry` and create a new one, then assign it to all cubelet meshes. This avoids a full scene teardown.

Current code creates one `RoundedBoxGeometry` for all 26 cubelets (shared). A single `geo.dispose()` + `new RoundedBoxGeometry(...)` + assignment to all `mesh.geometry` refs achieves the rebuild in one pass.

Materials are NOT affected by geometry rebuild — they remain on the meshes and retain any applied stickering.

**Alternatives considered**:
- Full unmount/remount: simple but causes ~100ms visual flash and loses OrbitControls camera state. Rejected — jarring UX.
- Per-cubelet geometry: allows per-cubelet shape overrides (needed for circle centers anyway — see Decision 5). Accepted as the forward-compatible path.

---

## Decision 3: Brightness / saturation slider — HSL manipulation

**Decision**: brightness adjustments operate in HSL space on the hex colour:
- Parse hex → RGB → HSL
- Scale `L` (lightness) by a `brightness` factor (default 1.0, range 0.5–1.5)
- Scale `S` (saturation) by a `saturation` factor (default 1.0, range 0.0–1.5)
- Convert back to hex

The master brightness slider in the harness scales all 6 face `L` values proportionally ("lock all sliders" behaviour). Per-face pickers allow independent override.

`brightness` and `saturation` scalars live on the `CubeTheme` object and are applied at theme-application time to derive the effective colours used for texture generation. The `colours` record stores base colours; `brightness`/`saturation` are multipliers applied before texture creation.

**Alternatives considered**:
- Storing pre-brightened colours in the theme: simpler but loses the original colour reference when sliders are reset. Rejected.
- CSS `filter: brightness()` on the canvas element: only works for the whole renderer, not per-face. Rejected.

---

## Decision 4: Transparent cube — plastic opacity

**Decision**: plastic opacity is implemented as an alpha value on the sticker texture background fill and on the inward-face material.

- Sticker texture: `ctx.fillStyle = hexToRgba(plasticColour, opacity)` for the background fill — produces a texture with transparent plastic surround.
- Inward face materials (`BLACK_MATERIAL` currently a shared singleton): must become per-instance when opacity < 1, since `THREE.MeshStandardMaterial` needs `transparent: true` and `opacity` set.
- Scene background must be `null` (transparent) rather than a solid colour when opacity < 1.

At opacity = 1, the existing solid path is used unchanged (no performance cost).

**Alternatives considered**:
- CSS background on the container element: makes the renderer div background show through but sticker texture edges remain opaque (black border visible). Rejected — partial transparency looks wrong.

---

## Decision 5: Circle center pieces (GAN-style)

**Decision**: `centerShape: 'square' | 'circle'` on `CubeTheme`. Only center cubelets (those at `|x|+|y|+|z| = 1`, i.e. exactly one coordinate ±1 and the other two zero) receive the circle texture.

`makeStickerTexture` gains a `shape` parameter. For `'circle'`: fill the canvas with plastic background, then draw a disc using `ctx.arc(cx, cy, r, 0, Math.PI*2)` where r accounts for the `pad`.

Corner and edge cubelets always use the square/rounded-rectangle path regardless of `centerShape`.

Per-cubelet geometry is NOT needed for circle centers — it's purely a texture change on 6 meshes.

**Alternatives considered**:
- Different geometry (round face on center): achievable with custom BufferGeometry but very complex and likely invisible at typical viewing distance. Rejected.

---

## Decision 6: Theme JSON export / import

**Decision**: `CubeTheme` is a plain JS object (no class methods on the data side); `JSON.stringify` / `JSON.parse` round-trips cleanly.

Export: copy `JSON.stringify(theme, null, 2)` to clipboard via `navigator.clipboard.writeText`.
Import: `<textarea>` in the harness, parse on blur/button press, validate shape, call `setTheme`.

Validation: check all required keys present and values within range; throw with a descriptive message on invalid input.

CSS custom-property output is deferred (post-025). The JSON format is forward-compatible with a future CSS token generator.

---

## Decision 7: CubeRenderer3D — geometry shared vs per-cubelet

**Decision**: move from one shared geometry to per-cubelet geometry. This is required for circle centers (Decision 5) and makes in-place gap/bevel rebuilds cleaner. Memory cost is negligible (RoundedBoxGeometry is small; 26 instances at ~3 KB each = ~80 KB — well within budget).

Each `Cubelet` owns its `mesh.geometry`; dispose is called per-cubelet on `setTheme()` when gap or bevel changes.

---

## Decision 8: setTheme() — two-path apply

**Decision**: `setTheme(theme)` inspects which parameters changed from the active theme and takes the minimal path:

| Changed parameter(s) | Path |
|----------------------|------|
| colours / brightness / saturation only | Invalidate affected texture cache entries; call `restoreColours()` (then re-apply active mask if any) |
| plasticColour / stickerPad / stickerRadius / centerShape | Same — texture-only rebuild |
| gap / bevel | Per-cubelet geometry dispose + rebuild; then texture rebuild |
| materialType / roughness | Recreate all outward materials; then texture rebuild |

In the harness, every slider/picker fires `setTheme()` with the full current theme object — the renderer diffs internally.

---

## Decision 9: CubeRenderer2D theme integration

**Decision**: `CubeRenderer2D` only uses face colours (not gap/bevel/texture params — those are its own SVG geometry). `CubeTheme` colours + brightness are applied to its `FACE_COLOURS` lookup.

`CubeRenderer2D` accepts an optional `theme` parameter at construction and a `setTheme(theme)` method. It re-derives effective colours on each `update()` call (cheap — just a lookup). No texture cache involved.

The 2D grey/dim colour (`GREY`) tracks `plasticColour` from the theme.
