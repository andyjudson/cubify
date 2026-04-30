# Feature 025 — cubify-theming

## Summary

Define a cube theming system for `cubify-harness`: named themes (default, rubiks, modern, minimal) controlling sticker colours, plastic colour, gap size, roundedness, and surface finish. Expose live controls in the demo for interactive tuning.

---

## Clarifications

### Session 2026-04-29

- Q: When a preset button is clicked in the harness, do all sliders reset to preset values? → A: Full replace — all controls (brightness, saturation, colours, geometry, sticker params) snap to the preset's defined values.
- Q: Should `CubeExporter.toPNG()` accept an optional `theme` param in 025? → A: Deferred to 030 — CubeExporter keeps its current API; theming applies only to live renderers.

---

## Motivation

The default colour scheme (classic Rubik's saturated colours, black plastic, tight gaps) is one valid look but not the only one. Different contexts call for different aesthetics:

- **cfop-app**: wants a clean, modern look — softer colours, less aggressive gaps
- **OLL/PLL diagrams**: high contrast, clear sticker identity
- **Speed cube style**: GAN-like — white or black plastic shell, slightly muted sticker colours, very tight gaps
- **Export images**: may want a specific palette that reads well at small sizes

Rather than hardcoding colours, drive all visual parameters from a `CubeTheme` object. A CSS custom-property token layer is a future extension (post-025).

---

## Theme Dimensions

| Property | Description | Example values |
|----------|-------------|----------------|
| Sticker colours | Per-face hex colours | Classic, Twisty bright, soft/pastel |
| Brightness | Master lightness scale applied to all 6 faces uniformly | 0.5 (dark) – 1.5 (bright) |
| Plastic colour | Body + gap colour | Black `#111`, dark grey `#2a2a2a`, white `#f0f0f0` |
| Plastic opacity | 0 = transparent cube, 1 = opaque | 1 (default) |
| Gap size | Space between cubelets | 0.01 – 0.08 |
| Bevel radius | Cubelet edge roundedness | 0 (sharp) – 0.08 (very rounded) |
| Surface finish | Roughness/metalness | Matte (roughness 0.9), satin (0.5), glossy (0.1) |
| Sticker pad | Black border width on 256 px texture canvas | 4 px (tight) – 40 px (thick border) |
| Sticker radius | Corner radius on sticker shape | 0 px (square) – 128 px (circle) |
| Center shape | Shape override for center pieces only | square, circle |

---

## Named Themes (initial set)

The "speed" look (current harness default) is not a named preset — its parameter values become the library defaults when no theme is specified.

| Name | Description |
|------|-------------|
| `rubiks` | Classic toy feel — thick pad, rounded corners, physically lit (MeshStandard, roughness 0.85) |
| `modern` | Twisty-style colours, dark grey plastic, thin gap, flat-lit |
| `minimal` | White/off-white plastic, pastel colours, very tight gap, high bevel |
| `modern` | White plastic shell, tight gap, physically lit — GAN-inspired feel |

---

## User Stories

**US-001 — Theme object layer**
All visual parameters (colours, plastic, gap, bevel, sticker shape) driven by a `CubeTheme` object — nothing hardcoded in the renderer. `CubeRenderer3D` and `CubeRenderer2D` accept a theme at construction and via `setTheme()`.

**US-002 — Named theme presets**
`THEME_PRESETS` record (rubiks, modern, minimal) and `getThemePreset(name)` helper, plus `DEFAULT_THEME`. Presets are plain JSON-serialisable objects. Clicking a preset in the harness fully replaces the current theme — all controls snap to the preset's values.

**US-003 — Live controls in demo**
New *Theming* tab in the harness right panel (after Stickering) with:
- Preset buttons (one per named theme)
- Master brightness slider (scales all 6 face colours proportionally in HSL lightness)
- Per-face colour pickers
- Plastic colour picker + opacity slider
- Gap slider (0.01–0.08)
- Bevel slider (0–0.08)
- Sticker pad slider (4–40 px)
- Sticker corner-radius slider (0–128 px)
- Center shape toggle: square / circle (field exists on CubeTheme; not exposed in harness UI)

**US-004 — Sticker colour palette editor**
Per-face `<input type="color">` pickers with live preview. Colours update without page reload. Palette locked to standard hues by default; pickers allow full override.

**US-005 — Center piece shape**
GAN-style circular center stickers: when `centerShape: 'circle'`, center cubelets use a disc texture instead of a rounded rectangle. All other cubelets remain square/rounded-square.

**US-006 — Theme JSON export / import**
"Export JSON" button in Theming tab copies current theme to clipboard. "Import JSON" input pastes it back. Enables saving and sharing theme configs. `CubeExporter.toPNG()` is not in scope for theming in 025 — deferred to 030. CSS custom-property token output is also a future extension.

---

## Colour Reference

### Classic Rubik's (current harness default)
U: `#ffffff`, R: `#c41e1e`, F: `#1a7c2a`, D: `#ffd000`, L: `#e06000`, B: `#0f4fad`

### Twisty-style (brighter, thinner gaps)
U: `#ffffff`, R: `#ef3030`, F: `#22aa44`, D: `#ffdd00`, L: `#ff8800`, B: `#1155cc`

### Pastel/soft
U: `#f5f5f5`, R: `#e57373`, F: `#81c784`, D: `#fff176`, L: `#ffb74d`, B: `#64b5f6`

---

## Baseline Values (established during 022 harness work)

These are the two aesthetics we want to preserve as named themes.

### `speed` — GAN-inspired (current harness state after 022 tuning)
| Parameter | Value | Note |
|-----------|-------|------|
| `gap` | `0.02` | 3D space between cubelets |
| Texture `pad` | `10` | Black border px on 256px canvas |
| Texture `radius` | `8` | Corner radius px |
| Bevel | `0.03` | RoundedBoxGeometry segments |
| Plastic | `#141414` | Near-black body |
| Material | `MeshBasicMaterial` | Flat-lit — no lighting response on stickers |

Feels modern, clean, speed-cube-like. Faces almost flush, thin gap, minimal black surround.

### `rubiks` — Classic (original harness state)
| Parameter | Value | Note |
|-----------|-------|------|
| `gap` | `0.02` | (same — gap was always tight) |
| Texture `pad` | `24` | Thick black border |
| Texture `radius` | `32` | Pronounced rounded corners |
| Bevel | `0.03` | |
| Plastic | `#141414` | |
| Material | `MeshStandardMaterial` (roughness 0.85) | Physically lit stickers |

Feels like the familiar toy — chunky sticker tiles sitting on black plastic, similar to iamthecu.be.

---

## Acceptance Criteria

- [x] Theme object drives all visual parameters — nothing hardcoded in renderer
- [x] 3 named presets render correctly (rubiks, modern, minimal) plus DEFAULT_THEME
- [x] Harness Theming tab: all controls live-update cube without page reload
- [x] Material-only changes (colour, pad, radius) require no geometry rebuild
- [x] Geometry changes (gap, bevel) rebuild cubelets in-place without scene teardown
- [x] Brightness slider scales all face lightness proportionally in HSL space
- [x] centerShape field on CubeTheme supported by renderer; circle texture path available but not exposed in harness UI
- [x] Theme JSON can be copied to clipboard and re-imported to restore state
- [x] CubeRenderer2D respects theme colours
- [x] All changes pass Vitest suite (138 + new theme tests = 167)
