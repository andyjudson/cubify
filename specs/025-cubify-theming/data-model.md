# Data Model — Feature 025: cubify-theming

---

## CubeTheme

The central value object. Plain JS object — no class, fully JSON-serialisable.

```typescript
interface CubeTheme {
  // ---- Sticker colours (base, before brightness/saturation adjustment) ----
  colours: {
    U: string;  // hex, e.g. '#ffffff'
    R: string;
    F: string;
    D: string;
    L: string;
    B: string;
  };

  // ---- Colour adjustments (applied to colours at render time) ----
  brightness: number;   // HSL lightness multiplier; 1.0 = no change; range 0.5–1.5
  saturation: number;   // HSL saturation multiplier; 1.0 = no change; range 0.0–1.5

  // ---- Plastic ----
  plasticColour: string;  // hex, e.g. '#141414'
  plasticOpacity: number; // 0 (transparent) – 1 (opaque)

  // ---- Cubelet geometry ----
  gap: number;    // world-space gap between cubelets; 0.01–0.08
  bevel: number;  // RoundedBoxGeometry bevel radius; 0 (sharp) – 0.08

  // ---- Sticker texture (on 256×256 px canvas) ----
  stickerPad: number;    // background border width in px; 4–40
  stickerRadius: number; // corner radius in px; 0 (square) – 128 (circle)

  // ---- Center piece override ----
  centerShape: 'square' | 'circle';  // circle = GAN-style disc on center cubelets only

  // ---- Material ----
  materialType: 'basic' | 'standard';
  roughness: number;   // only used when materialType = 'standard'; 0 (glossy) – 1 (matte)
  metalness: number;   // only used when materialType = 'standard'; typically 0
}
```

### Validation rules

| Field | Range / constraint |
|-------|--------------------|
| colours.* | Valid 6-digit hex string |
| brightness | 0.3 – 2.0 (clamped at apply time) |
| saturation | 0.0 – 2.0 (clamped at apply time) |
| plasticColour | Valid 6-digit hex |
| plasticOpacity | 0 – 1 |
| gap | 0.005 – 0.1 (renderer clamps silently) |
| bevel | 0 – 0.15 (renderer clamps silently) |
| stickerPad | 0 – 100 (px) |
| stickerRadius | 0 – 128 (px) |
| centerShape | 'square' or 'circle' |
| materialType | 'basic' or 'standard' |
| roughness | 0 – 1 |
| metalness | 0 – 1 |

---

## THEME_PRESETS

Named presets. Keys are `ThemePresetName` string literals.

```typescript
type ThemePresetName = 'speed' | 'rubiks' | 'modern' | 'minimal' | 'gan';

const THEME_PRESETS: Record<ThemePresetName, CubeTheme>
```

### Preset values

**`speed`** (current harness look — default)
```
colours: Classic (U=#ffffff R=#c41e1e F=#1a7c2a D=#ffd000 L=#e06000 B=#0f4fad)
brightness: 1.0, saturation: 1.0
plasticColour: #141414, plasticOpacity: 1
gap: 0.02, bevel: 0.03
stickerPad: 10, stickerRadius: 8
centerShape: square
materialType: basic, roughness: 0.9, metalness: 0
```

**`rubiks`** (classic toy)
```
colours: Classic
brightness: 1.0, saturation: 1.0
plasticColour: #141414, plasticOpacity: 1
gap: 0.02, bevel: 0.03
stickerPad: 24, stickerRadius: 32
centerShape: square
materialType: standard, roughness: 0.85, metalness: 0
```

**`modern`** (Twisty-style)
```
colours: Twisty (U=#ffffff R=#ef3030 F=#22aa44 D=#ffdd00 L=#ff8800 B=#1155cc)
brightness: 1.0, saturation: 1.0
plasticColour: #2a2a2a, plasticOpacity: 1
gap: 0.02, bevel: 0.04
stickerPad: 14, stickerRadius: 16
centerShape: square
materialType: basic, roughness: 0.9, metalness: 0
```

**`minimal`** (white plastic, pastel)
```
colours: Pastel (U=#f5f5f5 R=#e57373 F=#81c784 D=#fff176 L=#ffb74d B=#64b5f6)
brightness: 1.0, saturation: 0.8
plasticColour: #e8e8e8, plasticOpacity: 1
gap: 0.015, bevel: 0.05
stickerPad: 12, stickerRadius: 48
centerShape: square
materialType: basic, roughness: 0.9, metalness: 0
```

**`gan`** (GAN-inspired, circle centers)
```
colours: Classic, saturation: 0.85
brightness: 0.95, saturation: 0.85
plasticColour: #1a1a1a, plasticOpacity: 1
gap: 0.018, bevel: 0.025
stickerPad: 12, stickerRadius: 6
centerShape: circle
materialType: basic, roughness: 0.9, metalness: 0
```

---

## TextureCacheKey

Internal (not public). Composite string key for the module-level texture cache.

```
"${colourHex}|${plasticHex}|${opacity}|${pad}|${radius}|${shape}"
```

`shape` is `'circle'` only for center cubelets in a `gan`-style theme; `'square'` otherwise.

---

## EffectiveColours

Derived value, not stored. Computed from `CubeTheme.colours` + `brightness` + `saturation`:

```typescript
function effectiveColours(theme: CubeTheme): Record<string, string>
```

Returns hex strings for each face after HSL adjustment. Used by both renderers when building textures / drawing cells.

---

## Relationships

```
CubeTheme ──── used by ──── CubeRenderer3D.setTheme()
                             CubeRenderer2D.setTheme()
                             CubeExporter (passed through to renderer)

THEME_PRESETS ──── are ──── Record<ThemePresetName, CubeTheme>
                             accessed via CubeTheme.get(name)

EffectiveColours ──── derived from ──── CubeTheme (at apply time)
TextureCacheKey  ──── derived from ──── CubeTheme + cubelet center flag
```
