# Quickstart: Cubify Render Internals

**Feature**: 033-cubify-render-internals  
**Date**: 2026-05-13

---

## Basic Usage

```typescript
import {
  CubeRenderer3D, getThemePreset,
  type InternalsOptions, DEFAULT_INTERNALS_OPTIONS
} from '@andyjudson/cubify';

const renderer = new CubeRenderer3D();
renderer.mount(document.getElementById('cube-container')!);
renderer.resetToSolved();

// Enable internals with defaults (stickerOpacity: 0.65, wallOpacity: 0.40, coreOpacity: 0.50)
renderer.setInternals(true);

// Enable with custom opacity
renderer.setInternals(true, { stickerOpacity: 0.5, wallOpacity: 0.3, coreOpacity: 0.6 });

// Update options while already enabled (idempotent)
renderer.setInternals(true, { stickerOpacity: 0.8 });

// Disable — restores fully opaque rendering
renderer.setInternals(false);
```

---

## Recommended Theme Pairing

The `internals` theme preset is designed to pair with internals mode — wide gap, high bevel, and light plastic give the transparent cube the most visual depth:

```typescript
import { getThemePreset } from '@andyjudson/cubify';

renderer.setTheme(getThemePreset('internals'));
renderer.setInternals(true);
```

---

## Via CubePlayer

```typescript
import { CubePlayer } from '@andyjudson/cubify';

const player = new CubePlayer(document.getElementById('cube-container')!);
player.loadAlg("R U R' U R U2 R'", null);  // Sune

// Enable internals — delegated to the renderer
player.setInternals(true, { stickerOpacity: 0.6 });

// Play the alg — core stays stationary while layers animate
player.play();
```

---

## Harness Integration Scenario

The harness exposes internals mode in the Theme tab with:
- A toggle button (Internals on/off)
- Three sliders: stickerOpacity, wallOpacity, coreOpacity

```javascript
// In cubify-harness/index.html (harness JS, not library code)
const toggleBtn = document.getElementById('btn-internals');
const stickerSlider = document.getElementById('slider-sticker-opacity');
const wallSlider    = document.getElementById('slider-wall-opacity');
const coreSlider    = document.getElementById('slider-core-opacity');

let internalsEnabled = false;

toggleBtn.addEventListener('click', () => {
  internalsEnabled = !internalsEnabled;
  toggleBtn.classList.toggle('is-active', internalsEnabled);
  player.renderer.setInternals(internalsEnabled, {
    stickerOpacity: parseFloat(stickerSlider.value),
    wallOpacity:    parseFloat(wallSlider.value),
    coreOpacity:    parseFloat(coreSlider.value),
  });
});

[stickerSlider, wallSlider, coreSlider].forEach(el => {
  el.addEventListener('input', () => {
    if (!internalsEnabled) return;
    player.renderer.setInternals(true, {
      stickerOpacity: parseFloat(stickerSlider.value),
      wallOpacity:    parseFloat(wallSlider.value),
      coreOpacity:    parseFloat(coreSlider.value),
    });
  });
});
```

---

## Edge Cases

### Toggle during animation

Safe — material mutations apply immediately; core group add/remove is safe mid-animation:

```typescript
// Fine to call during a move sequence
player.play();
setTimeout(() => renderer.setInternals(true), 500);
```

### Stickering + internals

Masked stickers retain their grey colour but gain transparency:

```typescript
renderer.setInternals(true);
renderer.setStickering('oll-face-dim');  // Grey masked stickers are also semi-transparent
```

### Theme change while internals active

Colours update in the same render frame:

```typescript
renderer.setInternals(true);
renderer.setTheme('speed-dark');   // Core and walls update to new plastic colour immediately
```
