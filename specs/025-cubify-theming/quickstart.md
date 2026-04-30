# Quickstart — Feature 025: cubify-theming

Integration scenarios for `CubeTheme` in the library and harness.

---

## Scenario 1: Use a named preset

```typescript
import { CubeRenderer3D } from './src/index.js';
import { getThemePreset } from './src/CubeTheme.js';

const renderer = new CubeRenderer3D({ theme: getThemePreset('rubiks') });
renderer.mount(document.getElementById('cube'));
```

Or pass the name string directly (renderer resolves it):

```typescript
const renderer = new CubeRenderer3D({ theme: 'modern' });
```

---

## Scenario 2: Switch theme at runtime

```typescript
renderer.setTheme('minimal');
// or
renderer.setTheme({ ...currentTheme, plasticColour: '#f0f0f0', gap: 0.01 });
```

`setTheme()` diffs against the current theme and takes the minimal rebuild path. Geometry is only rebuilt when `gap` or `bevel` changes.

---

## Scenario 3: Brightness slider (harness)

```javascript
// Master brightness slider — adjusts all 6 face colours uniformly
brightnessSlider.addEventListener('input', () => {
  const t = { ...currentTheme, brightness: parseFloat(brightnessSlider.value) };
  renderer.setTheme(t);
  currentTheme = t;
});
```

`effectiveColours(theme)` applies the brightness in HSL space; the original `colours` record is never mutated.

---

## Scenario 4: GAN circle centers

```typescript
import { THEME_PRESETS } from './src/CubeTheme.js';

const ganTheme = THEME_PRESETS.gan;
// ganTheme.centerShape === 'circle'
renderer.setTheme(ganTheme);
// → center cubelets get disc texture; corners/edges unchanged
```

---

## Scenario 5: Transparent cube

```typescript
renderer.setTheme({ ...THEME_PRESETS.modern, plasticOpacity: 0.0 });
// → sticker texture backgrounds become transparent
// → inward face materials become transparent
// → scene background becomes null (transparent renderer)
```

---

## Scenario 6: Export and import theme JSON

```typescript
import { themeToJSON, themeFromJSON } from './src/CubeTheme.js';

// Export
const json = themeToJSON(renderer.theme);
await navigator.clipboard.writeText(json);

// Import
const pasted = await navigator.clipboard.readText();
const imported = themeFromJSON(pasted);  // throws on invalid input
renderer.setTheme(imported);
```

---

## Scenario 7: CubeRenderer2D with theme

```typescript
import { CubeRenderer2D } from './src/index.js';

const r2d = new CubeRenderer2D(container, { theme: 'modern' });
r2d.update(state, visMap);
r2d.setTheme('rubiks');
r2d.update(state, visMap);  // re-renders with Rubik's colours
```

---

## Scenario 8: Harness Theming tab

The Theming tab in the harness right panel exposes all controls. No code changes needed for basic use — the tab is part of `index.html`.

Key wiring pattern for any control:

```javascript
function applyThemePatch(patch) {
  currentTheme = { ...currentTheme, ...patch };
  player.renderer.setTheme(currentTheme);
  if (renderer2d) renderer2d.setTheme(currentTheme);
}

gapSlider.addEventListener('input', () =>
  applyThemePatch({ gap: parseFloat(gapSlider.value) }));

plasticPicker.addEventListener('input', () =>
  applyThemePatch({ plasticColour: plasticPicker.value }));
```
