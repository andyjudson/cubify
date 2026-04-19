# Quickstart: 026 — cubify-image-export

## Scenario 1: Browser — solved cube, no mask

```js
import { CubeState } from './src/CubeState.js';
import { CubeRenderer2D } from './src/CubeRenderer2D.js';

const container = document.getElementById('cube-2d');
const renderer = new CubeRenderer2D(container, { size: 400 });

const state = await CubeState.solved();
renderer.update(state, new Map());
// → Canvas shows solved cube top-down view, all stickers full colour
```

---

## Scenario 2: OLL Sune with stickering mask

```js
import { CubeState } from './src/CubeState.js';
import { CubeStickering } from './src/CubeStickering.js';
import { CubeRenderer2D } from './src/CubeRenderer2D.js';

const OLL_SUNE_SETUP = "R U R' U R U2 R'";
const OLL_MASK = 'EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD';

const container = document.getElementById('cube-2d');
const renderer = new CubeRenderer2D(container, { size: 400 });

const state = await CubeState.solved();
const setupState = state.applyAlg(invertAlg(OLL_SUNE_SETUP));
const rawPattern = setupState.toRawPattern();
const visMap = CubeStickering.fromOrbitStringWithState(OLL_MASK, rawPattern);

renderer.update(setupState, visMap);
// → U face shows OLL case; side faces show only primary sticker (yellow), others grey
```

---

## Scenario 3: CubeExporter — 2D OLL export

```js
import { CubeExporter } from './src/CubeExporter.js';

const png = await CubeExporter.toPNG("R U R' U R U2 R'", {
  style: '2d',
  stickering: 'EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD',
  setupAlg: "R U2 R' U' R U' R'",  // Sune setup
  size: 400,
});
// png = 'data:image/png;base64,...'
```

---

## Scenario 3b: CubeExporter — 3D cross/F2L export

```js
import { CubeExporter } from './src/CubeExporter.js';

const png = await CubeExporter.toPNG('', {
  style: '3d',
  stickering: 'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------',  // cross mask
  size: 400,
});
```

---

## Scenario 4: Export PNG from browser canvas directly

```js
renderer.update(state, visMap);
const dataURL = renderer.toDataURL('image/png');

// Download
const a = document.createElement('a');
a.href = dataURL;
a.download = 'oll-sune.png';
a.click();
```

---

## Scenario 4: Node.js SVG string → PNG (demo script)

```js
// demo/export-test.mjs
import { CubeState } from '../src/CubeState.js';
import { CubeStickering } from '../src/CubeStickering.js';
import { CubeRenderer2D } from '../src/CubeRenderer2D.js';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const state = await CubeState.solved();
const visMap = new Map();

const svg = CubeRenderer2D.toSVG(state, visMap, { size: 400 });
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile('./out/solved.png', png);
console.log('Written solved.png, size:', png.length);
```

---

## Scenario 5: Harness 2D tab integration

In `index.html`, the 2D tab wires CubeRenderer2D alongside CubeRenderer3D:

```js
// At init time (after CubeState resolves)
const renderer2d = new CubeRenderer2D(
  document.getElementById('cube-2d'),
  { size: 400 }
);

// In applyStateToRenderer(state, visMap):
renderer3d.setState(state);
renderer2d.update(state, visMap);

// In reapplyMask(visMap):
renderer3d.reapplyMask(visMap);
renderer2d.update(cubeState, visMap);
```

The 2D canvas is always updated (even when the 3D tab is visible), so switching tabs shows the current state immediately.
