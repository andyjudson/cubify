# Data Model: Cubify Render Internals

**Feature**: 033-cubify-render-internals  
**Date**: 2026-05-13

---

## Entities

### InternalsOptions

Public configuration object for `setInternals()`. JSON-serialisable (per FR-008).

| Field | Type | Range | Default | Description |
|---|---|---|---|---|
| `stickerOpacity` | `number` | 0.3–1.0 | 0.65 | Opacity applied to all 54 sticker panel materials |
| `wallOpacity` | `number` | 0.0–1.0 | 0.40 | Opacity of inward-facing cubelet wall surfaces |
| `coreOpacity` | `number` | 0.0–1.0 | 0.50 | Opacity of the central sphere and arm geometry |

```typescript
export interface InternalsOptions {
  stickerOpacity: number;
  wallOpacity: number;
  coreOpacity: number;
}

export const DEFAULT_INTERNALS_OPTIONS: InternalsOptions = {
  stickerOpacity: 0.65,
  wallOpacity:    0.40,
  coreOpacity:    0.50,
};
```

**Validation rules**:
- All values must be finite numbers in range [0.0, 1.0] (clamped silently if out of range)
- `stickerOpacity` minimum of 0.3 recommended (below this, face colours become indistinct)
- Object is plain — no methods, no class instances — safe for JSON serialisation

**Mutability**: `setInternals()` accepts `Partial<InternalsOptions>`; missing keys are filled from `DEFAULT_INTERNALS_OPTIONS`. The renderer stores a merged copy internally.

---

### InternalsState (internal to `CubeRenderer3D`)

Not exported. Tracks the renderer's internals mode state.

| Field | Type | Description |
|---|---|---|
| `_internalsEnabled` | `boolean` | Whether internals mode is currently active |
| `_internalsOptions` | `InternalsOptions` | Merged copy of options (with defaults filled) |
| `_coreGroup` | `THREE.Group \| null` | The core sphere+arms group added to the scene; null when disabled |
| `_internalsWallMaterial` | `THREE.Material \| null` | Shared material for all inward cubelet faces in internals mode; null when disabled |

---

### Core Geometry (Three.js scene objects)

Not a TypeScript entity — describes the Three.js object graph added to the scene when internals is enabled.

```
scene
└── _coreGroup (THREE.Group, position = origin, never animated)
    ├── sphere (THREE.Mesh — SphereGeometry(0.22, 16, 12))
    ├── arm+X  (THREE.Mesh — CylinderGeometry(0.08, 0.08, 0.80, 8), rotation.z = π/2, position (0.62, 0, 0))
    ├── arm-X  (THREE.Mesh — same geo, position (-0.62, 0, 0))
    ├── arm+Y  (THREE.Mesh — no rotation, position (0, 0.62, 0))
    ├── arm-Y  (THREE.Mesh — no rotation, position (0, -0.62, 0))
    ├── arm+Z  (THREE.Mesh — rotation.x = π/2, position (0, 0, 0.62))
    └── arm-Z  (THREE.Mesh — rotation.x = π/2, position (0, 0, -0.62))
```

- All 6 arms share a single `CylinderGeometry` instance (shared geometry, separate mesh transforms)
- Sphere and arms share a single `THREE.MeshStandardMaterial` instance (`_internalsWallMaterial` is a different instance for the cubelet faces; core has its own material)
- The group is attached directly to `scene`, not to any cubelet or pivot group — guaranteed to remain stationary during all move animations

---

## Relationships

```
CubeRenderer3D
  ├── _theme: CubeTheme         (existing)
  ├── _plasticMaterial          (existing — restored to inward slots when internals disabled)
  ├── _internalsEnabled         (new)
  ├── _internalsOptions         (new)
  ├── _coreGroup                (new — null when disabled)
  ├── _internalsWallMaterial    (new — null when disabled)
  └── _cubelets[]: Cubelet      (existing — sticker material.opacity mutated when internals enabled)

CubePlayer
  └── _renderer: CubeRenderer3D  (existing — setInternals() passthrough added)
```
