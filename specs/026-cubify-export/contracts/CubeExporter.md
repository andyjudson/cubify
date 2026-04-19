# Contract: CubeExporter

**Module**: `cubify-harness/src/CubeExporter.js`
**Type**: ES Module, browser (OffscreenCanvas for 3D)

---

## Method: toPNG (static)

```js
CubeExporter.toPNG(algOrState, options)  → Promise<string>
```

Returns a PNG data URL (`data:image/png;base64,...`).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| algOrState | string \| CubeState | yes | Alg notation string or pre-built CubeState |
| options.style | `'2d'` \| `'3d'` | yes | Rendering style |
| options.stickering | string | no | Orbit string mask (default: full visibility) |
| options.size | number | no | Output size in px (default: 400) |
| options.setupAlg | string | no | Setup alg, applied before the display alg |

**Style routing**:
- `'2d'` → `CubeRenderer2D` (top-down perspective, Canvas 2D). Use for OLL/PLL.
- `'3d'` → `CubeRenderer3D` on `OffscreenCanvas` + Three.js. Use for full/cross/F2L.

**setupAlg resolution** (matches `experimentalSetupAnchor: 'end'` from TwistyPlayer):
```js
displayState = solved.applyAlg(invertAlg(alg)).applyAlg(setupAlg ?? '')
```

---

## Rendering Style Convention

| CFOP Stage | Recommended `style` |
|------------|---------------------|
| Full / solved | `'3d'` |
| Cross | `'3d'` |
| F2L | `'3d'` |
| OLL | `'2d'` |
| PLL | `'2d'` |

Both styles support any stickering mask. The convention is caller preference, not enforced.

---

## Acceptance Criteria

- [ ] `CubeExporter.toPNG('R U R\' U\'', { style: '2d', stickering: 'EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD' })` returns a valid PNG data URL
- [ ] `CubeExporter.toPNG('R U R\' U\'', { style: '3d' })` returns a valid PNG data URL
- [ ] Both styles respect the `stickering` orbit string mask
- [ ] `setupAlg` resolution matches TwistyPlayer `experimentalSetupAnchor: 'end'`
- [ ] `demo/export-test.mjs` produces 3 PNGs: sune (OLL, 2D), T-perm (PLL, 2D), cross (3D)
