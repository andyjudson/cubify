# Contract: CubeRenderer3D Internals API

**Feature**: 033-cubify-render-internals  
**Module**: `packages/cubify/src/CubeRenderer3D.ts`  
**Date**: 2026-05-13

---

## New Public Exports (`packages/cubify/src/index.ts`)

```typescript
export interface InternalsOptions {
  stickerOpacity: number;  // 0.3–1.0
  wallOpacity:    number;  // 0.0–1.0
  coreOpacity:    number;  // 0.0–1.0
}

export const DEFAULT_INTERNALS_OPTIONS: InternalsOptions;
// { stickerOpacity: 0.65, wallOpacity: 0.40, coreOpacity: 0.50 }
```

---

## `CubeRenderer3D.setInternals()`

```typescript
setInternals(enabled: boolean, options?: Partial<InternalsOptions>): void
```

**Parameters**:
- `enabled` — `true` to enable internals rendering; `false` to disable and restore original state
- `options` — optional partial overrides; merged with `DEFAULT_INTERNALS_OPTIONS`

**Behaviour when `enabled = true`**:
1. Merges `options` with `DEFAULT_INTERNALS_OPTIONS`; stores result as `_internalsOptions`
2. For every outward sticker material on every cubelet: sets `transparent = true`, `opacity = options.stickerOpacity`, `depthWrite = false`, `needsUpdate = true`
3. Creates `_internalsWallMaterial` (MeshStandardMaterial, `side = THREE.DoubleSide`, `transparent = true`, `opacity = options.wallOpacity`, colour from `this._theme.plasticColour`)
4. Replaces all inward cubelet slot materials with `_internalsWallMaterial`
5. Builds core group (`buildCoreGroup` from `CubeInternals.ts`) and adds it to `_scene`
6. Sets `_internalsEnabled = true`

**Behaviour when `enabled = false`**:
1. For every outward sticker material: restores `transparent = (this._theme.plasticOpacity < 1)`, `opacity = 1.0`, `depthWrite = (this._theme.plasticOpacity >= 1)`, `needsUpdate = true`
2. Restores all inward cubelet slots to `this._plasticMaterial`
3. Removes `_coreGroup` from `_scene`; disposes core geometry and material; sets `_coreGroup = null`
4. Disposes `_internalsWallMaterial`; sets `_internalsWallMaterial = null`
5. Sets `_internalsEnabled = false`

**Guard conditions**:
- May be called before or after `mount()`; if `_scene` is null (not yet mounted) when enabling, core group creation is deferred until `mount()` completes
- Safe to call while animating (material mutations are applied immediately; core add/remove is safe mid-frame)
- Calling `setInternals(true)` while already enabled: updates options and re-applies all material values (idempotent)
- Calling `setInternals(false)` while already disabled: no-op

---

## `CubeRenderer3D.setTheme()` modification

```typescript
setTheme(theme: CubeTheme | ThemePresetName): void  // existing signature, unchanged
```

**New behaviour appended to existing `setTheme()` logic**:
- After existing `restoreColours()` + `applyStickering()` calls at end of method:
  ```typescript
  if (this._internalsEnabled) this._applyInternalsToMaterials();
  ```

`_applyInternalsToMaterials()` is a private method that:
1. Re-stamps sticker opacity (in case new material instances were created)
2. Updates `_internalsWallMaterial` colour to new `this._theme.plasticColour`
3. Updates core material colour to new `this._theme.plasticColour`

---

## `CubePlayer.setInternals()` (new passthrough)

```typescript
setInternals(enabled: boolean, options?: Partial<InternalsOptions>): void
```

Delegates directly to `this._renderer.setInternals(enabled, options)`. No additional logic.

---

## `CubeInternals.ts` internal module (not exported from index.ts)

```typescript
import * as THREE from 'three';
import type { InternalsOptions } from './CubeRenderer3D.js';

export function buildCoreGroup(plasticColour: string, options: InternalsOptions): THREE.Group;
// Returns a THREE.Group containing sphere + 6 arm meshes.
// Caller is responsible for adding to / removing from scene.
// Caller disposes by iterating group.children and calling mesh.geometry.dispose() + mesh.material.dispose()

export function buildWallMaterial(plasticColour: string, options: InternalsOptions): THREE.Material;
// Returns a MeshStandardMaterial with DoubleSide, transparent, opacity=options.wallOpacity, colour=plasticColour
```

---

## Acceptance Tests (library-level)

These verify the contract without WebGL:

```typescript
// cube-internals.test.ts

it('DEFAULT_INTERNALS_OPTIONS has expected values', () => {
  expect(DEFAULT_INTERNALS_OPTIONS.stickerOpacity).toBe(0.65);
  expect(DEFAULT_INTERNALS_OPTIONS.wallOpacity).toBe(0.40);
  expect(DEFAULT_INTERNALS_OPTIONS.coreOpacity).toBe(0.50);
});

it('DEFAULT_INTERNALS_OPTIONS values are all in range [0,1]', () => {
  const { stickerOpacity, wallOpacity, coreOpacity } = DEFAULT_INTERNALS_OPTIONS;
  expect(stickerOpacity).toBeGreaterThanOrEqual(0);
  expect(stickerOpacity).toBeLessThanOrEqual(1);
  expect(wallOpacity).toBeGreaterThanOrEqual(0);
  expect(wallOpacity).toBeLessThanOrEqual(1);
  expect(coreOpacity).toBeGreaterThanOrEqual(0);
  expect(coreOpacity).toBeLessThanOrEqual(1);
});
```

Visual acceptance tests (harness-based):

1. With `internals` theme, enable internals mode → sticker panels visibly translucent from all angles
2. Rotate cube → core sphere + arms remain at world origin; cubelet layers animate around them
3. Animate full Sune sequence → no visual pop, no sticker reapplication, internal walls travel correctly with cubelets
4. Toggle internals off → cube returns to fully opaque; core absent from scene
5. Switch theme while internals on → colours update in same render frame
