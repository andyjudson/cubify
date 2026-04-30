# Implementation Plan: Feature 025 — cubify-theming

**Branch**: `main` | **Date**: 2026-04-29 | **Spec**: [spec.md](spec.md)

---

## Summary

Introduce a `CubeTheme` object that drives all visual parameters in both renderers. Replace every hardcoded constant in `CubeRenderer3D` and `CubeRenderer2D` (colours, plastic colour, gap, bevel, sticker texture shape) with values read from the active theme. Expose 4 named presets (rubiks, gan, modern, minimal) and live controls in a new *Theming* tab in the harness. Theme state serialises to JSON for copy/paste sharing.

---

## Technical Context

**Language/Version**: TypeScript 5.x (`src/`), vanilla ES Modules (harness)
**Primary Dependencies**: Three.js (`RoundedBoxGeometry`, `CanvasTexture`, `MeshBasicMaterial`, `MeshStandardMaterial`)
**Storage**: In-memory; JSON clipboard export (no backend, no localStorage for now)
**Testing**: Vitest headless (no browser required for `CubeTheme` unit tests; geometry tests skipped without WebGL)
**Target Platform**: Browser (Chrome, Safari, Firefox); WebGL required for 3D
**Performance Goals**: Material-only theme switch < 16 ms; geometry rebuild (gap/bevel) < 200 ms
**Constraints**: No scene teardown on gap/bevel change; texture cache must not leak GPU memory across theme switches

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Physical simulation invariant | ✓ PASS | `setTheme()` calls `restoreColours()` (valid site); no mid-animation colour change — `abortAnimation()` called first if animating |
| Mask travels with cubelet | ✓ PASS | `setTheme()` re-applies active mask after `restoreColours()` — same as `loadAlg()` path |
| homePos keying | ✓ PASS | Texture selection and center-shape detection both use `homePos` |
| Module boundaries | ✓ PASS | `CubeTheme.ts` owns theme data; renderers accept it but do not compute it |
| 60 fps | WATCH | Geometry rebuild deferred to after current frame; benchmarked in harness |
| No bundler change | ✓ PASS | `CubeTheme.ts` is a plain TS module; no new build dependencies |

---

## Project Structure

### Documentation
```text
specs/025-cubify-theming/
├── spec.md
├── plan.md            ← this file
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── CubeTheme.ts
```

### Source Code
```text
src/
├── CubeTheme.ts           NEW — CubeTheme interface, THEME_PRESETS, helpers
├── CubeRenderer3D.ts      MODIFY — accept theme; setTheme(); per-cubelet geometry; composite texture cache key
├── CubeRenderer2D.ts      MODIFY — accept theme colours; setTheme()
└── index.ts               MODIFY — export CubeTheme, THEME_PRESETS, ThemePresetName

types/
└── index.d.ts             MODIFY — add CubeTheme types to public d.ts

test/
└── cube-theme.test.ts     NEW — CubeTheme validation, presets, effectiveColours, JSON round-trip

cubify-harness/
└── index.html             MODIFY — add Theming tab; wire all controls
```

---

## Architecture — Key Decisions

### 1. Texture cache key

Current: `Map<colourHex, CanvasTexture>` (module-level singleton).
New composite key: `"${colourHex}|${plasticHex}|${opacity}|${pad}|${radius}|${shape}"`.
On `setTheme()`: dispose textures whose keys no longer match the new theme params; retain shared textures where params are unchanged.

### 2. Per-cubelet geometry

Move from one shared `RoundedBoxGeometry` to per-cubelet geometry. Needed for in-place gap/bevel rebuild without scene teardown. Circle centers are a texture change only — no different geometry needed.

On gap or bevel change: `mesh.geometry.dispose()` + `mesh.geometry = new RoundedBoxGeometry(...)` for all 26 cubelets in one pass.

### 3. setTheme() two-path apply

```
setTheme(theme) {
  if (gap or bevel changed)  → geometry rebuild (dispose + new RoundedBoxGeometry per cubelet)
  if (materialType changed)  → material type switch (MeshBasic ↔ MeshStandard)
  always                     → invalidate stale texture cache entries; rebuild affected materials
  always                     → restoreColours()   [valid stickering site]
  if (active mask)           → re-apply current visMap
}
```

### 4. Brightness / saturation in HSL space

`effectiveColours(theme)` converts each face hex → HSL, scales L by `brightness`, S by `saturation`, converts back. Applied at texture-build time. The `colours` record stores originals and is never mutated.

### 5. Circle centers

`isCenter(homePos)` is true when exactly one coordinate is ±1 and the other two are 0 (the 6 face-center cubelets). `makeStickerTexture` receives a boolean `isCenter` flag. When `isCenter && centerShape === 'circle'`, the texture draws `ctx.arc()` disc instead of rounded rect.

### 6. Transparent plastic

When `plasticOpacity < 1`: sticker texture background drawn with alpha; inward face materials become per-instance with `transparent: true`; renderer scene background set to `null`.

### 7. CubeRenderer2D

Derives effective face colours via `effectiveColours(theme)` on each `update()`/`toSVG()` call. `plasticColour` drives the grey/dim colour. No gap/bevel/texture-shape dimension in 2D.

---

## Named Presets (4)

| Name | Feel | Key differentiators |
|------|------|---------------------|
| `rubiks` | Classic toy — chunky tiles, physically lit | pad=24, radius=32, materialType=standard, roughness=0.85 |
| `modern` | Twisty-style — thin tiles, dark grey shell | Twisty colour palette, plasticColour=#2a2a2a, pad=14 |
| `minimal` | White shell, pastel, high bevel | pastel palette, plasticColour=#e8e8e8, saturation=0.8, bevel=0.05, radius=48 |
| `gan` | GAN-inspired — dark, tight, circle centers | Classic colours at 95% brightness, radius=6, centerShape=circle |

The current harness default look ("speed" preset in earlier drafts) is not a named preset — its values become the library defaults when no theme is specified, keeping the harness feeling unchanged at first launch.

---

## Harness Theming Tab Layout

New tab in right panel, after Stickering:

```
[ rubiks ]  [ gan ]  [ modern ]  [ minimal ]

Colours
  U [🎨]  R [🎨]  F [🎨]  D [🎨]  L [🎨]  B [🎨]

Brightness   [────●────────] 1.00
Saturation   [────●────────] 1.00

Plastic
  [🎨]  Opacity [────●────────] 1.00

Geometry
  Gap   [──●──────────] 0.02
  Bevel [────●────────] 0.03

Sticker
  Pad    [──●──────────] 10 px
  Radius [────●────────] 8 px
  Center shape  [square ●] [  circle  ]

Material  [flat] [matte] [satin] [glossy]

────────────────────────────────────────
[Export JSON]  [paste JSON here…] [Apply]
```

All controls call `applyThemePatch(patch)` which merges into `currentTheme` and calls `renderer.setTheme()` + `renderer2d?.setTheme()`.

---

## Implementation Phases

### Phase A — Core library (no harness controls)
1. `src/CubeTheme.ts` — full implementation
2. `src/CubeRenderer3D.ts` — remove hardcoded constants; add `setTheme()`; composite cache key; per-cubelet geometry; circle centers; transparent path
3. `src/CubeRenderer2D.ts` — derive colours from `effectiveColours(theme)`
4. `src/index.ts` + `types/index.d.ts` — exports
5. `test/cube-theme.test.ts` — ~30 tests

### Phase B — Harness controls
6. `cubify-harness/index.html` — Theming tab + all controls + export/import JSON

---

## Files Changed / Created

| File | Action | Delta |
|------|--------|-------|
| `src/CubeTheme.ts` | CREATE | ~120 lines |
| `src/CubeRenderer3D.ts` | MODIFY | ~80 lines changed (remove constants, add setTheme/cache/geometry) |
| `src/CubeRenderer2D.ts` | MODIFY | ~20 lines changed (remove FACE_COLOURS/GREY, derive from theme) |
| `src/index.ts` | MODIFY | +3 export lines |
| `types/index.d.ts` | MODIFY | +CubeTheme types |
| `test/cube-theme.test.ts` | CREATE | ~30 tests |
| `cubify-harness/index.html` | MODIFY | +~120 lines (tab HTML + JS wiring) |

---

## Open Questions / Deferred

| Item | Status |
|------|--------|
| CSS custom-property token output | Deferred post-025; JSON is the exchange format |
| Per-face brightness sliders | Deferred — master slider + colour pickers give full control |
| localStorage persistence | Deferred — clipboard export is sufficient |
| Snap-to-preset on import | Not needed |
