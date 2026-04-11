# Feature 024 — cubify-theming

## Summary

Define a cube theming system for `cubify-harness`: named themes (Rubik's classic, speed cube, minimal) controlling sticker colours, plastic colour, gap size, roundedness, and surface finish. Expose live controls in the demo for interactive tuning.

---

## Motivation

The default colour scheme (classic Rubik's saturated colours, black plastic, tight gaps) is one valid look but not the only one. Different contexts call for different aesthetics:

- **cfop-app**: wants a clean, modern look — softer colours, less aggressive gaps
- **OLL/PLL diagrams**: high contrast, clear sticker identity
- **Speed cube style**: GAN-like — white or black plastic shell, slightly muted sticker colours, very tight gaps
- **Export images**: may want a specific palette that reads well at small sizes

Rather than hardcoding colours, expose a CSS custom property token layer (`--cubify-U`, `--cubify-R`, etc.) that themes can override.

---

## Theme Dimensions

| Property | Description | Example values |
|----------|-------------|----------------|
| Sticker colours | Per-face hex colours | Classic, Twisty bright, soft/pastel |
| Plastic colour | Body + gap colour | Black `#111`, dark grey `#2a2a2a`, white `#f0f0f0` |
| Gap size | Space between cubelets | 0.01 – 0.08 |
| Bevel radius | Cubelet edge roundedness | 0 (sharp) – 0.08 (very rounded) |
| Surface finish | Roughness/metalness | Matte (roughness 0.9), satin (0.5), glossy (0.1) |
| Sticker shape | Padding + corner radius on texture | Square, rounded, very rounded |

---

## Named Themes (initial set)

| Name | Description |
|------|-------------|
| `rubiks` | Classic saturated colours, black plastic, 0.06 gap — the current default |
| `modern` | Softer/brighter colours (Twisty-style), dark grey plastic, 0.02 gap, slight bevel |
| `speed` | GAN-inspired — black shell, tight 0.01 gap, slightly muted stickers, glossy finish |
| `minimal` | White plastic, very tight gap, pastel stickers, high bevel |

---

## User Stories

**US-001 — Theme token layer**
All colours and geometry parameters driven by a theme object, not hardcoded. `CubeRenderer3D` accepts `{ theme }` option.

**US-002 — Named theme presets**
`CubeTheme.get(name)` returns the full theme object. `CubeRenderer3D` accepts theme name string.

**US-003 — Live controls in demo**
Sliders/buttons in the harness demo for: gap size, bevel radius, plastic colour, surface finish. Instant re-render on change (rebuild cubelet materials, no scene teardown).

**US-004 — Sticker colour palette editor**
Per-face colour pickers or palette presets. Live preview. Export theme as JSON.

---

## Colour Reference

### Classic Rubik's (current)
U: `#ffffff`, R: `#c41e1e`, F: `#1a7c2a`, D: `#ffd000`, L: `#e06000`, B: `#0f4fad`

### Twisty-style (brighter, thinner gaps)
U: `#ffffff`, R: `#ef3030`, F: `#22aa44`, D: `#ffdd00`, L: `#ff8800`, B: `#1155cc`

### Pastel/soft
U: `#f5f5f5`, R: `#e57373`, F: `#81c784`, D: `#fff176`, L: `#ffb74d`, B: `#64b5f6`

---

## Acceptance Criteria

- [ ] Theme object drives all visual parameters — nothing hardcoded in renderer
- [ ] 4 named themes render correctly
- [ ] Live demo controls update cube without page reload
- [ ] Theme JSON can be serialised/deserialised for future export use
